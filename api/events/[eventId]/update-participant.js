import { verifyToken } from "../../../shared/auth.js";
import { validateParticipant } from "../../../shared/participant-validation.js";
import { updateOrCreatePayment } from "../../../shared/database-operations.js";
import { getSupabaseClient } from "../../../shared/supabase.js";
import { getEventConfig } from "../../config.js";

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
    // Get event config
    let eventConfig;
    try {
      eventConfig = getEventConfig(req.query.eventId);
    } catch {
      return res.status(404).json({ success: false, error: "Nieznane wydarzenie" });
    }

    // Verify JWT token
    const authResult = verifyToken(req, eventConfig);
    if (authResult.error) {
      return res.status(authResult.status).json({
        success: false,
        error: authResult.error
      });
    }

    const { registration_id } = authResult;
    const { participantId, participant } = req.body;

    if (!participantId || !participant) {
      return res.status(400).json({
        success: false,
        error: "ID uczestnika i dane są wymagane"
      });
    }

    // Validate participant data
    const validation = validateParticipant(participant, eventConfig);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    const supabase = getSupabaseClient();

    // Check if payment is paid (editing not allowed)
    const { data: payment, error: paymentCheckError } = await supabase
      .from("payments")
      .select("payment_status")
      .eq("registration_id", registration_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (paymentCheckError && paymentCheckError.code !== 'PGRST116') {
      console.error("Error checking payment:", paymentCheckError);
      return res.status(500).json({
        success: false,
        error: "Nie udało się sprawdzić statusu płatności"
      });
    }

    if (payment && payment.payment_status === 'paid') {
      return res.status(403).json({
        success: false,
        error: "Nie można edytować uczestnika po opłaceniu rejestracji. Skontaktuj się z organizatorem."
      });
    }

    // Check if event date passed
    const eventDate = new Date(eventConfig.date);
    const currentDate = new Date();
    if (currentDate >= eventDate) {
      return res.status(403).json({
        success: false,
        error: "Nie można edytować uczestnika po dacie wydarzenia. Skontaktuj się z organizatorem."
      });
    }

    // Verify participant belongs to this registration
    const { data: existingParticipant, error: participantError } = await supabase
      .from("participants")
      .select("*")
      .eq("id", participantId)
      .eq("registration_id", registration_id)
      .single();

    if (participantError || !existingParticipant) {
      return res.status(404).json({
        success: false,
        error: "Uczestnik nie znaleziony"
      });
    }

    // Update participant
    const { error: updateError } = await supabase
      .from("participants")
      .update({
        first_name: participant.firstName,
        last_name: participant.lastName,
        birth_date: participant.birthDate,
        city: participant.city,
        nationality: participant.nationality,
        club: participant.club || null,
        race_category: participant.raceCategory,
        food_preference: participant.foodPreference || null,
        hide_name_public: participant.hideNamePublic || false,
        tshirt_size: participant.tshirtSize || null,
        phone_number: participant.phoneNumber
      })
      .eq("id", participantId)
      .eq("registration_id", registration_id);

    if (updateError) {
      console.error("Error updating participant:", updateError);
      return res.status(500).json({
        success: false,
        error: "Nie udało się zaktualizować uczestnika"
      });
    }

    // Recalculate payment
    const { data: allParticipants, error: participantsError } = await supabase
      .from("participants")
      .select("*")
      .eq("registration_id", registration_id);

    if (participantsError) {
      console.error("Error fetching participants:", participantsError);
      return res.status(500).json({
        success: false,
        error: "Nie udało się pobrać uczestników"
      });
    }

    // Preserve extra donation from existing pending payment
    const { data: existingPendingPayment } = await supabase
      .from("payments")
      .select("*")
      .eq("registration_id", registration_id)
      .eq("payment_status", "pending")
      .single();

    try {
      await updateOrCreatePayment(supabase, registration_id, allParticipants, existingPendingPayment, eventConfig);
    } catch (paymentError) {
      console.error("Error updating payment:", paymentError);
      // Don't fail the request, participant is updated
    }

    // Add club to database if it doesn't exist
    if (participant.club) {
      await supabase
        .from("clubs")
        .upsert(
          { name: participant.club },
          { onConflict: 'name', ignoreDuplicates: true }
        );
    }

    return res.status(200).json({
      success: true,
      message: "Uczestnik zaktualizowany pomyślnie"
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return res.status(500).json({
      success: false,
      error: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie."
    });
  }
}
