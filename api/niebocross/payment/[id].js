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

    if (!registrationId) {
      return res.status(400).json({
        success: false,
        error: "Registration ID is required"
      });
    }

    const supabase = getSupabaseClient();

    // Get pending payment with registration info (needed for SIBS)
    const { data: payment, error: paymentError } = await supabase
      .from("niebocross_payments")
      .select(`
        id,
        total_amount,
        payment_status,
        payment_link,
        created_at,
        niebocross_registrations!inner(email, contact_person)
      `)
      .eq("registration_id", registrationId)
      .eq("payment_status", "pending")
      .single();

    // No pending payment found
    if (paymentError || !payment) {
      return res.status(200).json({
        success: true,
        has_pending_payment: false,
        message: "Brak nieopłaconych płatności"
      });
    }

    // If payment_link already exists, return it
    if (payment.payment_link) {
      return res.status(200).json({
        success: true,
        has_pending_payment: true,
        payment: {
          id: payment.id,
          total_amount: payment.total_amount,
          payment_status: payment.payment_status,
          payment_link: payment.payment_link
        }
      });
    }

    // Create new SIBS payment link
    const registration = payment.niebocross_registrations;

    const paymentResult = await createPaymentLink({
      paymentId: payment.id,
      amount: Math.round(payment.total_amount * 100), // Convert to cents (EUR)
      description: `NieboCross 2026 - rejestracja ${registration.contact_person}`,
      email: registration.email,
      urlReturn: `https://zatyrani.pl/niebocross/panel?payment=success`,
      urlStatus: `https://zatyrani.pl/api/niebocross/payment/webhook`
    });

    // Save payment link to database
    await supabase
      .from("niebocross_payments")
      .update({ payment_link: paymentResult.paymentUrl })
      .eq("id", payment.id);

    return res.status(200).json({
      success: true,
      has_pending_payment: true,
      payment: {
        id: payment.id,
        total_amount: payment.total_amount,
        payment_status: payment.payment_status,
        payment_link: paymentResult.paymentUrl
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
