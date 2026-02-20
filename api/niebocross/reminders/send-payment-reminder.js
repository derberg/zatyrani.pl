import { createClient } from "@supabase/supabase-js";
import { getUnpaidRegistrations } from "../utils/database-operations.js";
import { sendPaymentReminderEmail } from "../utils/email.js";

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase URL or key is not configured.");
  }

  return createClient(url, serviceKey);
}

export default async function handler(req, res) {
  // Vercel cron jobs send Authorization: Bearer <CRON_SECRET>
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;

  if (!cronSecret) {
    console.error("[payment-reminder] CRON_SECRET env var is not set");
    return res.status(500).json({ error: "Server misconfiguration" });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error("[payment-reminder] Unauthorized request — invalid or missing Authorization header");
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  console.log("[payment-reminder] Starting weekly payment reminder job");

  const results = { sent: 0, skipped: 0, failed: 0, errors: [] };

  try {
    const supabase = getSupabaseClient();
    const unpaidRegistrations = await getUnpaidRegistrations(supabase);

    console.log(`[payment-reminder] Found ${unpaidRegistrations.length} registrations with pending payments`);

    for (const registration of unpaidRegistrations) {
      const pendingPayment = registration.niebocross_payments[0];

      if (!pendingPayment) {
        console.warn(`[payment-reminder] Registration ${registration.id} has no pending payment row — skipping`);
        results.skipped++;
        continue;
      }

      try {
        await sendPaymentReminderEmail({
          email: registration.email,
          contactPerson: registration.contact_person,
          totalAmount: pendingPayment.total_amount,
          registrationId: registration.id,
        });
        console.log(`[payment-reminder] Reminder sent to ${registration.email} (amount: ${pendingPayment.total_amount} zł)`);
        results.sent++;
      } catch (emailError) {
        console.error(`[payment-reminder] Failed to send reminder to ${registration.email}:`, emailError.message);
        results.failed++;
        results.errors.push({ email: registration.email, error: emailError.message });
      }
    }

    console.log(
      `[payment-reminder] Job complete — sent: ${results.sent}, skipped: ${results.skipped}, failed: ${results.failed}`
    );

    return res.status(200).json({ success: true, ...results });

  } catch (error) {
    console.error("[payment-reminder] Fatal error in payment reminder job:", error.message);
    console.error(error.stack);
    return res.status(500).json({ success: false, error: error.message });
  }
}
