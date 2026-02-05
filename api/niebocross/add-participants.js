import { createClient } from "@supabase/supabase-js";
import { verifyToken } from "./utils/auth.js";
import { validateParticipant } from "./utils/participant-validation.js";
import { createParticipantRecords, upsertClubs, updateOrCreatePayment } from "./utils/database-operations.js";

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

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Verify JWT token
    const authResult = verifyToken(req);
    if (authResult.error) {
      return res.status(authResult.status).json({
        success: false,
        error: authResult.error
      });
    }

    const { registration_id } = authResult;
    const { participants, extraDonation } = req.body;

    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Co najmniej jeden uczestnik jest wymagany"
      });
    }

    // Validate all participants
    for (const participant of participants) {
      const validation = validateParticipant(participant);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error
        });
      }
    }

    const supabase = getSupabaseClient();

    // Check if editing is still allowed
    const eventDate = new Date('2026-04-12');
    const currentDate = new Date();
    if (currentDate >= eventDate) {
      return res.status(400).json({
        success: false,
        error: "Nie można dodać uczestników po dacie wydarzenia"
      });
    }

    // Get existing pending payment (if any)
    // Note: A registration can have multiple payments, but only one pending at a time
    const { data: existingPendingPayment } = await supabase
      .from("niebocross_payments")
      .select("*")
      .eq("registration_id", registration_id)
      .eq("payment_status", "pending")
      .single();

    // Create participant records
    const participantRecords = createParticipantRecords(participants, registration_id);

    const { error: participantsError } = await supabase
      .from("niebocross_participants")
      .insert(participantRecords)
      .select();

    if (participantsError) {
      console.error("Error creating participants:", participantsError);
      return res.status(500).json({
        success: false,
        error: "Nie udało się dodać uczestników. Spróbuj ponownie."
      });
    }

    // Get all participants for this registration
    const { data: allParticipants, error: fetchError } = await supabase
      .from("niebocross_participants")
      .select("*")
      .eq("registration_id", registration_id);

    if (fetchError) {
      console.error("Error fetching participants:", fetchError);
      return res.status(500).json({
        success: false,
        error: "Nie udało się pobrać uczestników"
      });
    }

    // Update existing pending payment or create new one
    // If there's a pending payment, update it; otherwise create a new pending payment
    try {
      await updateOrCreatePayment(supabase, registration_id, allParticipants, existingPendingPayment, extraDonation);
    } catch (error) {
      console.error("Error updating/creating payment:", error);
      return res.status(500).json({
        success: false,
        error: "Nie udało się zaktualizować płatności"
      });
    }

    // Add clubs to database if they don't exist
    await upsertClubs(supabase, participants);

    return res.status(200).json({
      success: true,
      message: participants.length === 1
        ? "Uczestnik został dodany pomyślnie"
        : `${participants.length} uczestników zostało dodanych pomyślnie`
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return res.status(500).json({
      success: false,
      error: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie."
    });
  }
}
