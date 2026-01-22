import { createClient } from "@supabase/supabase-js";

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

    // Get pending payment first, otherwise get latest payment
    let { data: payment, error: paymentError } = await supabase
      .from("niebocross_payments")
      .select("id, total_amount, payment_status, payment_link, created_at")
      .eq("registration_id", registrationId)
      .eq("payment_status", "pending")
      .single();

    // If no pending payment, get the latest payment
    if (paymentError || !payment) {
      const { data: latestPayment, error: latestError } = await supabase
        .from("niebocross_payments")
        .select("id, total_amount, payment_status, payment_link, created_at")
        .eq("registration_id", registrationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (latestError || !latestPayment) {
        return res.status(404).json({
          success: false,
          error: "Payment not found"
        });
      }

      payment = latestPayment;
    }

    return res.status(200).json({
      success: true,
      payment: {
        id: payment.id,
        total_amount: payment.total_amount,
        payment_status: payment.payment_status,
        payment_link: payment.payment_link,
        created_at: payment.created_at
      }
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return res.status(500).json({
      success: false,
      error: "Wystąpił nieoczekiwany błąd"
    });
  }
}