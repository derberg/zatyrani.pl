import { verifyToken } from "../../shared/auth.js";
import { validateParticipant } from "../../shared/participant-validation.js";
import { updateOrCreatePayment } from "../../shared/database-operations.js";
import { getSupabaseClient } from "../../shared/supabase.js";
import { getEventConfig } from "../config.js";
import { setCorsHeaders } from "../../shared/cors.js";

export default async function handler(req, res) {
  setCorsHeaders(res);

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

    // Get all payments to determine this specific participant's payment status.
    // A registration can have paid + pending (top-up) payments coexisting; we must
    // check whether this particular participant was covered by a paid payment, not
    // just whether the most recent payment is paid.
    const { data: allPayments, error: paymentCheckError } = await supabase
      .from("event_payments")
      .select("id, payment_status, paid_at, updated_at, created_at")
      .eq("registration_id", registration_id)
      .order("created_at", { ascending: false });

    if (paymentCheckError && paymentCheckError.code !== 'PGRST116') {
      console.error("Error checking payment:", paymentCheckError);
      return res.status(500).json({
        success: false,
        error: "Nie udało się sprawdzić statusu płatności"
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
      .from("event_participants")
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

    // Per-participant paid check: block edits for participants created on/before the
    // latest paid_at. Mirrors delete-participant.js:88-99.
    const paidPayment = (allPayments || []).find(p => p.payment_status === 'paid');
    if (paidPayment) {
      const paidAt = paidPayment.paid_at || paidPayment.updated_at || paidPayment.created_at;
      if (new Date(existingParticipant.created_at) <= new Date(paidAt)) {
        return res.status(403).json({
          success: false,
          error: "Nie można edytować uczestnika po opłaceniu rejestracji. Skontaktuj się z organizatorem."
        });
      }
    }

    // Update participant
    const { error: updateError } = await supabase
      .from("event_participants")
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
        phone_number: participant.phoneNumber,
        gender: participant.gender || null
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
      .from("event_participants")
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
      .from("event_payments")
      .select("*")
      .eq("registration_id", registration_id)
      .eq("payment_status", "pending")
      .single();

    // Reuse the allPayments fetched at the top for the top-up filter: when a prior
    // payment has been paid, the pending covers only participants added after paid_at.
    // Matches delete-participant.js:155-160.
    const participantsForPayment = paidPayment
      ? allParticipants.filter(p => {
          const paidAt = paidPayment.paid_at || paidPayment.updated_at || paidPayment.created_at;
          return new Date(p.created_at) > new Date(paidAt);
        })
      : allParticipants;

    try {
      await updateOrCreatePayment(supabase, registration_id, participantsForPayment, existingPendingPayment, eventConfig);
    } catch (paymentError) {
      console.error("Error updating payment:", paymentError);
      // Don't fail the request, participant is updated
    }

    // Add club to database if it doesn't exist
    if (participant.club) {
      await supabase
        .from("event_clubs")
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
