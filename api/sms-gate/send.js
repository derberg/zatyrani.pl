import twilio from "twilio";
import {
  authorizeSender,
  getBudget,
  getServiceClient,
  getUsedSegments,
  systemError,
} from "./_shared.js";
import { encoding, segments } from "../../src/utils/sms-segments.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { recipientId, body } = req.body || {};
  if (typeof recipientId !== "string" || !recipientId) {
    return res.status(400).json({ error: "Brak odbiorcy.", recipientId: null });
  }
  if (typeof body !== "string" || body.length === 0) {
    return res.status(400).json({ error: "Pusta wiadomość.", recipientId });
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
      return res.status(403).json({ error: "Brak uprawnień.", recipientId });
    }
    return res
      .status(401)
      .json({ error: e.message || "Brak autoryzacji.", recipientId });
  }

  const { data: recipientRows, error: recipientError } = await supabase
    .from("members")
    .select("id, phone")
    .eq("id", recipientId)
    .limit(1);

  if (recipientError) {
    console.error("Recipient lookup error:", recipientError);
    return systemError(res);
  }

  const recipient = recipientRows && recipientRows[0];
  if (!recipient || !recipient.phone) {
    return res.status(404).json({ error: "Nie znaleziono odbiorcy.", recipientId });
  }

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

  if (used + segs > total) {
    return res.status(409).json({
      error: "budget_exceeded",
      remaining: Math.max(0, total - used),
      recipientId,
    });
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

  let twilioSid = null;
  let twilioError = null;
  try {
    const payload = { body, to: recipient.phone };
    if (messagingServiceSid) {
      payload.messagingServiceSid = messagingServiceSid;
    } else {
      payload.from = twilioPhoneNumber;
    }
    const message = await client.messages.create(payload);
    twilioSid = message.sid;
  } catch (err) {
    twilioError = err && err.message ? err.message : String(err);
    console.error("Twilio send failed:", twilioError);
  }

  const status = twilioError ? "failed" : "sent";
  const { error: insertError } = await supabase.from("sms_gate_usage").insert({
    sender_member_id: sender.id,
    recipient_member_id: recipient.id,
    recipient_phone: recipient.phone,
    body,
    segments: segs,
    encoding: enc,
    status,
    twilio_sid: twilioSid,
    error_message: twilioError,
  });

  if (insertError) {
    console.error("Usage insert error:", insertError);
    if (status === "sent") {
      return res.status(200).json({
        ok: true,
        recipientId,
        twilio_sid: twilioSid,
        segments: segs,
        used: used + segs,
        warning: "audit_log_failed",
      });
    }
    return systemError(res);
  }

  if (status === "sent") {
    return res.status(200).json({
      ok: true,
      recipientId,
      twilio_sid: twilioSid,
      segments: segs,
      used: used + segs,
    });
  }

  return res.status(502).json({
    ok: false,
    recipientId,
    error: twilioError,
  });
}
