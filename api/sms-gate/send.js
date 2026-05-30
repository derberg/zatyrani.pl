import twilio from "twilio";
import {
  authorizeSender,
  getBudget,
  getServiceClient,
  getUsedSegments,
  systemError,
} from "./_shared.js";
import { encoding, segments } from "../../src/utils/sms-segments.js";

// Strip zero-width (U+200B-U+200F), bidi (U+202A-U+202E) and isolate (U+2066-U+2069)
// formatting marks that sneak into phone numbers via copy-paste.
function cleanPhone(s) {
  return (s || "").replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, "").trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { recipientId, recipientIds, body } = req.body || {};

  // Accept either a single recipientId (legacy) or a list of recipientIds.
  const requestedIds = Array.isArray(recipientIds)
    ? recipientIds
    : typeof recipientId === "string" && recipientId
      ? [recipientId]
      : [];

  const uniqueIds = [...new Set(requestedIds.filter((id) => typeof id === "string" && id))];

  if (uniqueIds.length === 0) {
    return res.status(400).json({ error: "Brak odbiorców." });
  }
  if (typeof body !== "string" || body.length === 0) {
    return res.status(400).json({ error: "Pusta wiadomość." });
  }

  let supabase;
  try {
    supabase = getServiceClient();
  } catch (e) {
    console.error("SMS gate config error:", e);
    return systemError(res);
  }

  let sender;
  try {
    sender = await authorizeSender(req, supabase);
  } catch (e) {
    if (e.status === 403) {
      return res.status(403).json({ error: "Brak uprawnień." });
    }
    return res.status(401).json({ error: e.message || "Brak autoryzacji." });
  }

  const { data: recipientRows, error: recipientError } = await supabase
    .from("members")
    .select("id, name, phone")
    .in("id", uniqueIds);

  if (recipientError) {
    console.error("Recipient lookup error:", recipientError);
    return systemError(res);
  }

  const byId = new Map((recipientRows || []).map((r) => [r.id, r]));

  const enc = encoding(body);
  const segs = segments(body);

  const total = getBudget();
  let used;
  try {
    used = await getUsedSegments(supabase);
  } catch (e) {
    console.error("Usage lookup error:", e);
    return systemError(res);
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
  if (!accountSid || !authToken || (!messagingServiceSid && !twilioPhoneNumber)) {
    console.error("Twilio environment variables are not set.");
    return systemError(res);
  }

  const client = twilio(accountSid, authToken);

  // Log the batch once: who is sending, to how many, and the message text a
  // single time (per-recipient lines below only carry name/phone/status).
  console.log(
    `[sms-gate] batch by ${sender.name} (${sender.id}) -> ${uniqueIds.length} recipient(s), ` +
      `${segs} seg/${enc}, budget ${used}/${total}\n[sms-gate] text: ${JSON.stringify(body)}`
  );

  const results = [];
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let budgetExceeded = false;
  const seenPhones = new Set();

  // Loop server-side so the send can't be interrupted by the browser tab.
  for (const id of uniqueIds) {
    const recipient = byId.get(id);
    const phone = cleanPhone(recipient && recipient.phone);
    const who = recipient ? `${recipient.name} (${phone || "brak nr"})` : id;

    if (!recipient || !phone) {
      failed++;
      console.warn(`[sms-gate] ✗ ${who} — recipient/phone not found`);
      results.push({ recipientId: id, status: "failed", error: "Nie znaleziono odbiorcy." });
      continue;
    }

    // Guard against sending the same number twice within one batch.
    if (seenPhones.has(phone)) {
      skipped++;
      console.log(`[sms-gate] – ${who} — skipped (duplicate number)`);
      results.push({ recipientId: id, status: "skipped", reason: "duplicate" });
      continue;
    }

    if (used + segs > total) {
      budgetExceeded = true;
      skipped++;
      console.log(`[sms-gate] – ${who} — skipped (budget exceeded)`);
      results.push({ recipientId: id, status: "skipped", reason: "budget_exceeded" });
      continue;
    }

    seenPhones.add(phone);

    let twilioSid = null;
    let twilioError = null;
    try {
      const payload = { body, to: phone };
      if (messagingServiceSid) {
        payload.messagingServiceSid = messagingServiceSid;
      } else {
        payload.from = twilioPhoneNumber;
      }
      const message = await client.messages.create(payload);
      twilioSid = message.sid;
    } catch (err) {
      twilioError = err && err.message ? err.message : String(err);
      console.error(`[sms-gate] ✗ ${who} — Twilio error: ${twilioError}`);
    }

    const status = twilioError ? "failed" : "sent";
    const { error: insertError } = await supabase.from("sms_gate_usage").insert({
      sender_member_id: sender.id,
      recipient_member_id: recipient.id,
      recipient_phone: phone,
      body,
      segments: segs,
      encoding: enc,
      status,
      twilio_sid: twilioSid,
      error_message: twilioError,
    });
    if (insertError) {
      console.error(`[sms-gate] ! audit insert failed for ${who}:`, insertError.message);
    }

    if (status === "sent") {
      sent++;
      used += segs;
      console.log(`[sms-gate] ✓ ${who} — sent ${twilioSid}`);
      results.push({ recipientId: id, status: "sent", twilio_sid: twilioSid });
    } else {
      failed++;
      results.push({ recipientId: id, status: "failed", error: twilioError });
    }
  }

  const failures = results.filter((r) => r.status === "failed");
  console.log(
    `[sms-gate] done: sent=${sent} failed=${failed} skipped=${skipped} ` +
      `budget ${used}/${total}` +
      (failures.length
        ? `\n[sms-gate] failures: ${failures
            .map((f) => `${f.recipientId}: ${f.error}`)
            .join("; ")}`
        : "")
  );

  return res.status(200).json({
    ok: failed === 0,
    sent,
    failed,
    skipped,
    budgetExceeded,
    segments: segs,
    used,
    remaining: Math.max(0, total - used),
    results,
  });
}
