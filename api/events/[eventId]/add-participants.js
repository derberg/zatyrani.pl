import { verifyToken } from "../../shared/auth.js";
import { validateParticipant } from "../../shared/participant-validation.js";
import { createParticipantRecords, upsertClubs, updateOrCreatePayment } from "../../shared/database-operations.js";
import { sendRegistrationConfirmationEmail } from "../../shared/email.js";
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
    const { participants, extraDonation } = req.body;

    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Co najmniej jeden uczestnik jest wymagany"
      });
    }

    // Validate all participants
    for (const participant of participants) {
      const validation = validateParticipant(participant, eventConfig);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error
        });
      }
    }

    const supabase = getSupabaseClient();

    // Check if editing is still allowed
    const eventDate = new Date(eventConfig.date);
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
      .from("event_payments")
      .select("*")
      .eq("registration_id", registration_id)
      .eq("payment_status", "pending")
      .single();

    // Get latest paid payment (if any). Used to identify which participants are
    // already covered so the pending top-up covers only participants added after that.
    const { data: latestPaidPayment } = await supabase
      .from("event_payments")
      .select("*")
      .eq("registration_id", registration_id)
      .eq("payment_status", "paid")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Create participant records
    const participantRecords = createParticipantRecords(participants, registration_id);

    const { error: participantsError } = await supabase
      .from("event_participants")
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
      .from("event_participants")
      .select("*")
      .eq("registration_id", registration_id);

    if (fetchError) {
      console.error("Error fetching participants:", fetchError);
      return res.status(500).json({
        success: false,
        error: "Nie udało się pobrać uczestników"
      });
    }

    // Update existing pending payment or create new one.
    // - If pending exists AND there's a prior paid payment, the pending is a top-up that
    //   covers only participants added after the last paid_at (matches delete-participant.js).
    // - If pending exists with no prior paid payment, it covers all participants.
    // - If no pending payment (previous was paid), bill only the newly-added participants.
    let participantsForPayment;
    if (existingPendingPayment) {
      if (latestPaidPayment) {
        const paidAt = latestPaidPayment.paid_at || latestPaidPayment.updated_at || latestPaidPayment.created_at;
        participantsForPayment = allParticipants.filter(p => new Date(p.created_at) > new Date(paidAt));
      } else {
        participantsForPayment = allParticipants;
      }
    } else {
      participantsForPayment = participantRecords;
    }
    let updatedPayment;
    try {
      updatedPayment = await updateOrCreatePayment(supabase, registration_id, participantsForPayment, existingPendingPayment, eventConfig, extraDonation);
    } catch (error) {
      console.error("Error updating/creating payment:", error);
      return res.status(500).json({
        success: false,
        error: "Nie udało się zaktualizować płatności"
      });
    }

    // Add clubs to database if they don't exist
    await upsertClubs(supabase, participants);

    // Get registration data for email
    const { data: registration } = await supabase
      .from("event_registrations")
      .select("email, contact_person")
      .eq("id", registration_id)
      .single();

    // Send confirmation email
    if (registration) {
      try {
        // Convert participants from snake_case to camelCase for email
        const participantsForEmail = allParticipants.map(p => ({
          firstName: p.first_name,
          lastName: p.last_name,
          raceCategory: p.race_category
        }));

        await sendRegistrationConfirmationEmail({
          email: registration.email,
          contactPerson: registration.contact_person,
          participants: participantsForEmail,
          payment: {
            totalAmount: updatedPayment.totalAmount || updatedPayment.total_amount,
            charityAmount: updatedPayment.charityAmount || updatedPayment.charity_amount
          },
          registrationId: registration_id,
          eventConfig
        });
      } catch (emailError) {
        console.error("Error sending email:", emailError);
        // Don't fail the request if email fails
      }
    }

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
