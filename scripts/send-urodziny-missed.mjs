/**
 * One-off: send the CORRECTED "URODZINY ZATYRANYCH" SMS to the 38 members
 * who did NOT receive it (the browser "send to all" loop stopped after 16).
 *
 * - Reads the exact corrected body from sms_gate_usage (verbatim, no drift).
 * - Targets = members whose (cleaned) phone never received the corrected body.
 * - Strips hidden Unicode direction-marks (U+202A/U+202C etc.) from phones.
 * - Records each result in sms_gate_usage (same columns as api/sms-gate/send.js),
 *   attributed to the original sender (Arek) for budget/audit consistency.
 *
 * Dry run by default. To actually send:  LIVE=1 node scripts/send-urodziny-missed.mjs
 */
import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";
import { readFileSync } from "fs";
import { encoding, segments } from "../src/utils/sms-segments.js";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const LIVE = process.env.LIVE === "1";
const DELAY_MS = 400;
const SENDER_MEMBER_ID = "8b209c30-06f2-4eed-927d-2915386ce88e"; // Arek (original sender)

// Strip bidi/zero-width/control formatting characters that sneak in via copy-paste
const cleanPhone = (s) =>
  (s || "").replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, "").trim();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 1) Exact corrected body, verbatim from DB
const { data: corr, error: corrErr } = await supabase
  .from("sms_gate_usage")
  .select("body, recipient_phone")
  .ilike("body", "%9.00 wizyta na grobie%");
if (corrErr) throw corrErr;

const bodies = [...new Set(corr.map((r) => r.body))];
if (bodies.length !== 1) {
  console.error("Expected exactly 1 corrected body variant, found:", bodies.length);
  process.exit(1);
}
const BODY = bodies[0];
const alreadyCorrected = new Set(corr.map((r) => cleanPhone(r.recipient_phone)));

// 2) Build target list
const { data: members, error: memErr } = await supabase
  .from("members")
  .select("id, name, phone")
  .order("name", { ascending: true });
if (memErr) throw memErr;

const targets = [];
for (const m of members) {
  const phone = cleanPhone(m.phone);
  if (!phone) continue;
  if (alreadyCorrected.has(phone)) continue;
  targets.push({ id: m.id, name: m.name, phone });
}

const segs = segments(BODY);
const enc = encoding(BODY);

console.log(LIVE ? "*** LIVE SEND ***" : "--- DRY RUN (no SMS sent, no DB writes) ---");
console.log(`Body (${BODY.length} chars, ${segs} seg, ${enc}):\n${BODY}\n`);
console.log(`Targets: ${targets.length}  | total segments: ${targets.length * segs}\n`);
targets.forEach((t, i) =>
  console.log(`  ${String(i + 1).padStart(2)}. ${t.name.padEnd(36)} ${t.phone}`)
);

if (!LIVE) {
  console.log("\nDry run complete. Re-run with LIVE=1 to send.");
  process.exit(0);
}

// 3) Live send
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const msgSvc = process.env.TWILIO_MESSAGING_SERVICE_SID;
const fromNum = process.env.TWILIO_PHONE_NUMBER;

let sent = 0;
let failed = 0;
const failures = [];

for (const t of targets) {
  let twilioSid = null;
  let twilioError = null;
  try {
    const payload = { body: BODY, to: t.phone };
    if (msgSvc) payload.messagingServiceSid = msgSvc;
    else payload.from = fromNum;
    const message = await client.messages.create(payload);
    twilioSid = message.sid;
    sent++;
    console.log(`  ✓ ${t.name} (${t.phone}) -> ${twilioSid}`);
  } catch (err) {
    twilioError = err && err.message ? err.message : String(err);
    failed++;
    failures.push({ name: t.name, phone: t.phone, reason: twilioError });
    console.log(`  ✗ ${t.name} (${t.phone}) -> ${twilioError}`);
  }

  const { error: insErr } = await supabase.from("sms_gate_usage").insert({
    sender_member_id: SENDER_MEMBER_ID,
    recipient_member_id: t.id,
    recipient_phone: t.phone,
    body: BODY,
    segments: segs,
    encoding: enc,
    status: twilioError ? "failed" : "sent",
    twilio_sid: twilioSid,
    error_message: twilioError,
  });
  if (insErr) console.error(`    ! audit insert failed for ${t.name}:`, insErr.message);

  await new Promise((r) => setTimeout(r, DELAY_MS));
}

console.log(`\nDone. sent=${sent} failed=${failed}`);
if (failures.length) {
  console.log("Failures:");
  for (const f of failures) console.log(`  ${f.name} (${f.phone}) — ${f.reason}`);
}
