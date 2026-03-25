/**
 * Send SMS to NieboCross participants about t-shirt purchase.
 * Uses SMSAPI.pl (alphanumeric sender ID, links work with Polish carriers).
 *
 * Usage:
 *   # Test mode — sends one SMS to TEST_SMS_TO_NUMBER
 *   node scripts/send-tshirt-sms.js --test
 *
 *   # Batch mode — sends to ALL participants (with paid registration)
 *   node scripts/send-tshirt-sms.js --batch
 *
 *   # Dry-run — prints what would be sent, no actual SMS
 *   node scripts/send-tshirt-sms.js --batch --dry-run
 *
 * Required env vars: SMSAPI_TOKEN, SMSAPI_SENDER,
 *                    SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 * For test mode: TEST_SMS_TO_NUMBER
 */

import { createClient } from "@supabase/supabase-js";

const SMSAPI_URL = "https://api.smsapi.pl/sms.do";
const TSHIRT_PAGE_BASE_URL = "https://zatyrani.pl/niebocross/koszulka";

function normalizePolishPhone(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (/^\+48\d{9}$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 11) return null;
  const last9 = digits.slice(-9);
  return `+48${last9}`;
}

function buildSmsBody(firstName, participantId) {
  return (
    `Czesc ${firstName}! Tu leszy.run, ktory pomaga w organizacji NieboCross. Mozesz zamowic sportowa koszulke pamiatkowa za 60zl. ` +
    `Mozliwosc zamowienia pod linkiem: ${TSHIRT_PAGE_BASE_URL}?id=${participantId}`
  );
}

async function sendSms(phone, message) {
  const token = process.env.SMSAPI_TOKEN;
  const sender = process.env.SMSAPI_SENDER || "LeszyRun";

  if (!token) {
    return { success: false, error: "SMSAPI_TOKEN not configured" };
  }

  const params = new URLSearchParams({
    to: phone.replace(/\s+/g, ""),
    message,
    from: sender,
    format: "json",
    encoding: "utf-8",
  });

  const res = await fetch(SMSAPI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = await res.json();

  if (data.error) {
    return { success: false, error: `${data.error}: ${data.message || ""}` };
  }

  return { success: true, messageId: data.list?.[0]?.id };
}

async function getParticipants() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Get all participants whose registration has a paid payment
  const { data, error } = await supabase
    .from("niebocross_participants_v2")
    .select(`
      id,
      first_name,
      phone_number,
      registration_id,
      niebocross_registrations!inner(
        id,
        niebocross_payments!inner(payment_status)
      )
    `)
    .eq(
      "niebocross_registrations.niebocross_payments.payment_status",
      "paid"
    );

  if (error) {
    console.error("Error fetching participants:", error);
    process.exit(1);
  }

  return data;
}

async function main() {
  const args = process.argv.slice(2);
  const isTest = args.includes("--test");
  const isBatch = args.includes("--batch");
  const isDryRun = args.includes("--dry-run");

  if (!isTest && !isBatch) {
    console.error("Usage: node scripts/send-tshirt-sms.js --test | --batch [--dry-run]");
    process.exit(1);
  }

  if (!process.env.SMSAPI_TOKEN) {
    console.error("Missing SMSAPI_TOKEN env var");
    process.exit(1);
  }

  if (isTest) {
    const testNumber = process.env.TEST_SMS_TO_NUMBER;
    if (!testNumber) {
      console.error("TEST_SMS_TO_NUMBER env var required for --test mode");
      process.exit(1);
    }
    const body = buildSmsBody("Tester", "00000000-0000-0000-0000-000000000000");
    console.log(`Sending test SMS to ${testNumber}:`);
    console.log(body);
    const result = await sendSms(testNumber, body);
    if (result.success) {
      console.log("Sent! Message ID:", result.messageId);
    } else {
      console.error("Failed:", result.error);
    }
    return;
  }

  // Batch mode
  const participants = await getParticipants();
  console.log(`Found ${participants.length} participants with paid registration.`);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const p of participants) {
    const phone = normalizePolishPhone(p.phone_number);
    if (!phone) {
      console.warn(`Skipping ${p.first_name} (${p.id}) — invalid phone: ${p.phone_number}`);
      skipped++;
      continue;
    }

    const body = buildSmsBody(p.first_name, p.id);

    if (isDryRun) {
      console.log(`[DRY-RUN] To: ${phone} | ${body}`);
      sent++;
      continue;
    }

    try {
      const result = await sendSms(phone, body);
      if (result.success) {
        console.log(`Sent to ${phone} (${p.first_name}) — ID: ${result.messageId}`);
        sent++;
      } else {
        console.error(`Failed for ${phone} (${p.first_name}):`, result.error);
        failed++;
      }
      // Small delay to avoid rate limits
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.error(`Failed for ${phone} (${p.first_name}):`, err.message);
      failed++;
    }
  }

  console.log(`\nDone. Sent: ${sent}, Skipped: ${skipped}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
