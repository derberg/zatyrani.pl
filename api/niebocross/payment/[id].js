import { createClient } from "@supabase/supabase-js";
import { createPaymentLink } from "../utils/sibs.js";

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase URL or key is not configured.");
  }

  return createClient(url, serviceKey);
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const registrationId = req.query.id;
    const allowPayment = req.query.allow === 'true';

    if (!registrationId) {
      return res.status(400).json({
        success: false,
        error: "Registration ID is required"
      });
    }

    // Check if payment is allowed via the allow flag
    if (!allowPayment) {
      return res.status(403).json({
        success: false,
        error: "Osiągnęliśmy maksymalną liczbę uczestników dla NieboCross 2026. Płatności zostały zamknięte. W razie pytań lub wątpliwości, skontaktuj się z nami: biuro@zatyrani.pl",
        has_pending_payment: false
      });
    }

    const supabase = getSupabaseClient();

    // Get the latest pending or failed payment (both are actionable — user can pay)
    const { data: payment, error: paymentError } = await supabase
      .from("niebocross_payments")
      .select(`
        id,
        total_amount,
        payment_status,
        payment_link,
        transaction_id,
        niebocross_registrations!inner(email, contact_person)
      `)
      .eq("registration_id", registrationId)
      .in("payment_status", ["pending", "failed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (paymentError || !payment) {
      return res.status(200).json({
        success: true,
        has_pending_payment: false,
        message: "Brak nieopłaconych płatności"
      });
    }

    const registration = payment.niebocross_registrations;

    // Reuse cached SIBS session if it's less than 15 minutes old.
    // Older sessions go stale (card declines don't trigger webhooks, so status stays
    // "pending" with a dead formContext). After 15 min we create a fresh one.
    const SESSION_MAX_AGE_MS = 15 * 60 * 1000;
    if (payment.transaction_id && payment.payment_link) {
      const age = Date.now() - new Date(payment.updated_at || payment.created_at).getTime();
      if (age < SESSION_MAX_AGE_MS) {
        return res.status(200).json({
          success: true,
          has_pending_payment: true,
          payment: {
            id: payment.id,
            total_amount: payment.total_amount,
            payment_status: payment.payment_status,
            formContext: payment.payment_link,
            transactionID: payment.transaction_id
          }
        });
      }
    }

    // Create new SIBS payment link
    const paymentResult = await createPaymentLink({
      paymentId: payment.id,
      amount: payment.total_amount, // SIBS expects amount in PLN (main currency unit)
      description: registration.contact_person,
      email: registration.email,
      urlReturn: `https://zatyrani.pl/niebocross/panel?payment=success`,
      urlStatus: `https://zatyrani.pl/api/niebocross/payment/webhook`
    });

    // Save formContext and transactionID to database (updated_at used for session TTL)
    await supabase
      .from("niebocross_payments")
      .update({
        payment_link: paymentResult.formContext,
        transaction_id: paymentResult.transactionID,
        updated_at: new Date().toISOString()
      })
      .eq("id", payment.id);

    return res.status(200).json({
      success: true,
      has_pending_payment: true,
      payment: {
        id: payment.id,
        total_amount: payment.total_amount,
        payment_status: payment.payment_status,
        formContext: paymentResult.formContext,
        transactionID: paymentResult.transactionID
      }
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return res.status(500).json({
      success: false,
      error: "Wystąpił nieoczekiwany błąd podczas tworzenia płatności"
    });
  }
}
