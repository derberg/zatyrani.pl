import { createClient } from "@supabase/supabase-js";
import { createPaymentLink } from "../utils/sibs.js";
import { TSHIRT_SIZES } from "../utils/constants.js";

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase URL or key is not configured.");
  }
  return createClient(url, serviceKey);
}

const TSHIRT_PRICE = 60.0;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "POST") {
    return handleCreatePurchase(req, res);
  }

  if (req.method === "GET") {
    return handleGetParticipant(req, res);
  }

  return res.status(405).json({ error: "Method not allowed" });
}

/**
 * GET — fetch participant data by ID (for pre-filling the form)
 */
async function handleGetParticipant(req, res) {
  const participantId = req.query.participantId;
  if (!participantId) {
    return res.status(200).json({ success: true, participant: null });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("niebocross_participants_v2")
    .select("id, first_name, last_name, phone_number, tshirt_size, registration_id")
    .eq("id", participantId)
    .single();

  if (error || !data) {
    return res.status(404).json({ success: false, error: "Participant not found" });
  }

  // Check if tshirt was already ordered (paid) for this participant
  const { data: existingPayment } = await supabase
    .from("niebocross_tshirt_payments")
    .select("id, tshirt_size, paid_at")
    .eq("participant_id", participantId)
    .eq("payment_status", "paid")
    .limit(1)
    .maybeSingle();

  // Also get email from registration
  const { data: reg } = await supabase
    .from("niebocross_registrations")
    .select("email")
    .eq("id", data.registration_id)
    .single();

  return res.status(200).json({
    success: true,
    alreadyOrdered: !!existingPayment,
    orderedSize: existingPayment?.tshirt_size || null,
    participant: {
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      phoneNumber: data.phone_number,
      email: reg?.email || "",
      tshirtSize: data.tshirt_size || "",
    },
  });
}

/**
 * POST — create a tshirt payment and return SIBS payment widget data
 */
async function handleCreatePurchase(req, res) {
  try {
    const { participantId, firstName, lastName, email, phoneNumber, tshirtSize } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !phoneNumber || !tshirtSize) {
      return res.status(400).json({
        success: false,
        error: "Wszystkie pola są wymagane (imię, nazwisko, email, telefon, rozmiar)",
      });
    }

    if (!TSHIRT_SIZES.includes(tshirtSize)) {
      return res.status(400).json({
        success: false,
        error: "Nieprawidłowy rozmiar koszulki",
      });
    }

    const supabase = getSupabaseClient();

    // Create payment record
    const { data: payment, error: insertError } = await supabase
      .from("niebocross_tshirt_payments")
      .insert({
        participant_id: participantId || null,
        first_name: firstName,
        last_name: lastName,
        email,
        phone_number: phoneNumber,
        tshirt_size: tshirtSize,
        amount: TSHIRT_PRICE,
        payment_status: "pending",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Error creating tshirt payment:", insertError);
      return res.status(500).json({
        success: false,
        error: "Błąd podczas tworzenia zamówienia",
      });
    }

    // Create SIBS payment link
    // Description includes "TSHIRT" prefix so it's identifiable in SIBS dashboard
    const description = `TSHIRT ${firstName} ${lastName} (${tshirtSize})`;

    const paymentResult = await createPaymentLink({
      paymentId: payment.id,
      amount: TSHIRT_PRICE,
      description,
    });

    // Don't store payment_link/transaction_id on pending record.
    // The webhook will store transaction_id only on successful payment.
    // Failed payments get deleted by the webhook.

    return res.status(200).json({
      success: true,
      payment: {
        id: payment.id,
        amount: TSHIRT_PRICE,
        formContext: paymentResult.formContext,
        transactionID: paymentResult.transactionID,
      },
    });
  } catch (error) {
    console.error("Tshirt purchase error:", error);
    return res.status(500).json({
      success: false,
      error: "Wystąpił błąd podczas tworzenia płatności",
    });
  }
}
