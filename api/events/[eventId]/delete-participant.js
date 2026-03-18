import { verifyToken } from "../../../shared/auth.js";
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
    const { participantId } = req.body;

    if (!participantId) {
      return res.status(400).json({
        success: false,
        error: "ID uczestnika jest wymagane"
      });
    }

    const supabase = getSupabaseClient();

    // Check if payment is paid (deletion not allowed)
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
        error: "Nie można usunąć uczestnika po opłaceniu rejestracji. Skontaktuj się z organizatorem."
      });
    }

    // Check if event date passed
    const eventDate = new Date(eventConfig.date);
    const currentDate = new Date();
    if (currentDate >= eventDate) {
      return res.status(403).json({
        success: false,
        error: "Nie można usunąć uczestnika po dacie wydarzenia. Skontaktuj się z organizatorem."
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

    // Delete participant
    const { error: deleteError } = await supabase
      .from("participants")
      .delete()
      .eq("id", participantId)
      .eq("registration_id", registration_id);

    if (deleteError) {
      console.error("Error deleting participant:", deleteError);
      return res.status(500).json({
        success: false,
        error: "Nie udało się usunąć uczestnika"
      });
    }

    // Recalculate payment
    const { data: remainingParticipants, error: participantsError } = await supabase
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

    // If no participants left, delete pending payment record
    if (!remainingParticipants || remainingParticipants.length === 0) {
      await supabase
        .from("payments")
        .delete()
        .eq("registration_id", registration_id)
        .eq("payment_status", "pending");

      return res.status(200).json({
        success: true,
        message: "Uczestnik usunięty pomyślnie",
        participantsRemaining: 0
      });
    }

    // Get existing pending payment to preserve extra donation
    const { data: existingPendingPayment } = await supabase
      .from("payments")
      .select("*")
      .eq("registration_id", registration_id)
      .eq("payment_status", "pending")
      .single();

    try {
      await updateOrCreatePayment(supabase, registration_id, remainingParticipants, existingPendingPayment, eventConfig);
    } catch (paymentError) {
      console.error("Error updating payment:", paymentError);
      // Don't fail the request, participant is deleted
    }

    return res.status(200).json({
      success: true,
      message: "Uczestnik usunięty pomyślnie",
      participantsRemaining: remainingParticipants.length
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return res.status(500).json({
      success: false,
      error: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie."
    });
  }
}
