import { createClient } from "@supabase/supabase-js";
import { createPaymentLink } from "../../utils/sibs.js";

const TSHIRT_PRICE = 60.0;

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase URL or key is not configured.");
  }
  return createClient(url, serviceKey);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const primaryId = req.query.id;
    if (!primaryId) {
      return res.status(400).json({ success: false, error: "Missing id" });
    }

    const supabase = getSupabaseClient();

    // Fetch the primary row
    const { data: primary, error: primaryError } = await supabase
      .from("niebocross_tshirt_payments")
      .select("id, first_name, last_name, email, payment_status, payment_link, transaction_id")
      .eq("id", primaryId)
      .single();

    if (primaryError || !primary) {
      return res.status(404).json({ success: false, error: "Not found" });
    }

    if (primary.payment_status === "paid") {
      return res.status(200).json({ success: true, paid: true });
    }

    if (primary.payment_status === "failed") {
      return res.status(410).json({ success: false, error: "Payment failed or cancelled" });
    }

    // Count items in the group to compute amount
    const { count: itemCount, error: countError } = await supabase
      .from("niebocross_tshirt_payments")
      .select("id", { count: "exact", head: true })
      .or(`id.eq.${primaryId},order_group_id.eq.${primaryId}`);

    if (countError || !itemCount) {
      console.error("Error counting order group:", countError);
      return res.status(500).json({ success: false, error: "Błąd odczytu zamówienia" });
    }

    const amount = itemCount * TSHIRT_PRICE;

    // Cached session — return it directly
    if (primary.payment_link && primary.transaction_id) {
      return res.status(200).json({
        success: true,
        payment: {
          id: primary.id,
          amount,
          itemCount,
          formContext: primary.payment_link,
          transactionID: primary.transaction_id,
        },
      });
    }

    // Pending but cache missing — regenerate a SIBS session
    const description = `TSHIRT ${primary.first_name} ${primary.last_name} (${itemCount}x)`;
    const paymentResult = await createPaymentLink({
      paymentId: primary.id,
      amount,
      description,
      email: primary.email,
    });

    await supabase
      .from("niebocross_tshirt_payments")
      .update({
        payment_link: paymentResult.formContext,
        transaction_id: paymentResult.transactionID,
      })
      .eq("id", primary.id);

    return res.status(200).json({
      success: true,
      payment: {
        id: primary.id,
        amount,
        itemCount,
        formContext: paymentResult.formContext,
        transactionID: paymentResult.transactionID,
      },
    });
  } catch (error) {
    console.error("Tshirt purchase GET error:", error);
    return res.status(500).json({ success: false, error: "Wystąpił błąd" });
  }
}
