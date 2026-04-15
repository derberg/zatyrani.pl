import { createClient } from "@supabase/supabase-js";
import { createPaymentLink } from "../../utils/sibs.js";
import { TSHIRT_SIZES } from "../../utils/constants.js";

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase URL or key is not configured.");
  }
  return createClient(url, serviceKey);
}

const TSHIRT_PRICE = 60.0;
const MAX_ITEMS_PER_ORDER = 10;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "OPTIONS,POST");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  return handleCreatePurchase(req, res);
}

async function handleCreatePurchase(req, res) {
  const supabase = getSupabaseClient();
  let insertedIds = [];

  try {
    const { firstName, lastName, email, phoneNumber, items } = req.body || {};

    if (!firstName || !lastName || !email || !phoneNumber) {
      return res.status(400).json({
        success: false,
        error: "Wszystkie dane zamawiającego są wymagane (imię, nazwisko, email, telefon)",
      });
    }

    if (!Array.isArray(items) || items.length < 1 || items.length > MAX_ITEMS_PER_ORDER) {
      return res.status(400).json({
        success: false,
        error: `Zamówienie musi zawierać od 1 do ${MAX_ITEMS_PER_ORDER} koszulek`,
      });
    }

    for (const item of items) {
      if (!item || !TSHIRT_SIZES.includes(item.tshirtSize)) {
        return res.status(400).json({
          success: false,
          error: "Nieprawidłowy rozmiar koszulki",
        });
      }
    }

    const totalAmount = items.length * TSHIRT_PRICE;

    // Insert N rows, each with one tshirt_size; buyer info duplicated
    const rowsToInsert = items.map((item) => ({
      first_name: firstName,
      last_name: lastName,
      email,
      phone_number: phoneNumber,
      tshirt_size: item.tshirtSize,
      amount: TSHIRT_PRICE,
      payment_status: "pending",
    }));

    const { data: insertedRows, error: insertError } = await supabase
      .from("niebocross_tshirt_payments")
      .insert(rowsToInsert)
      .select("id");

    if (insertError || !insertedRows || insertedRows.length !== items.length) {
      console.error("Error creating tshirt payment rows:", insertError);
      return res.status(500).json({
        success: false,
        error: "Błąd podczas tworzenia zamówienia",
      });
    }

    insertedIds = insertedRows.map((r) => r.id);
    const primaryId = insertedIds[0];

    // Group all rows under the primary id (including the primary row itself)
    const { error: groupError } = await supabase
      .from("niebocross_tshirt_payments")
      .update({ order_group_id: primaryId })
      .in("id", insertedIds);

    if (groupError) {
      console.error("Error setting order_group_id:", groupError);
      await supabase.from("niebocross_tshirt_payments").delete().in("id", insertedIds);
      return res.status(500).json({
        success: false,
        error: "Błąd podczas tworzenia zamówienia",
      });
    }

    // Create SIBS payment for the total
    const description = `TSHIRT ${firstName} ${lastName} (${items.length}x)`;
    const paymentResult = await createPaymentLink({
      paymentId: primaryId,
      amount: totalAmount,
      description,
    });

    // Cache formContext + transactionID on the primary row
    const { error: cacheError } = await supabase
      .from("niebocross_tshirt_payments")
      .update({
        payment_link: paymentResult.formContext,
        transaction_id: paymentResult.transactionID,
      })
      .eq("id", primaryId);

    if (cacheError) {
      console.error("Error caching SIBS session:", cacheError);
      // Non-fatal: session still usable via formContext/transactionID returned below.
      // The /[id] endpoint can regenerate if cache is missing on next visit.
    }

    return res.status(200).json({
      success: true,
      payment: {
        id: primaryId,
        amount: totalAmount,
        formContext: paymentResult.formContext,
        transactionID: paymentResult.transactionID,
      },
    });
  } catch (error) {
    console.error("Tshirt purchase error:", error);
    // Clean up any rows we inserted before the failure
    if (insertedIds.length > 0) {
      const { error: cleanupErr } = await supabase
        .from("niebocross_tshirt_payments")
        .delete()
        .in("id", insertedIds);
      if (cleanupErr) {
        console.error("Cleanup failed:", cleanupErr);
      }
    }
    return res.status(500).json({
      success: false,
      error: "Wystąpił błąd podczas tworzenia płatności",
    });
  }
}
