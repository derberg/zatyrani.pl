import { verifyToken } from "../../../shared/auth.js";
import { validateParticipant } from "../../../shared/participant-validation.js";
import { createParticipantRecords, upsertClubs, updateOrCreatePayment } from "../../../shared/database-operations.js";
import { sendRegistrationConfirmationEmail } from "../../../shared/email.js";
import { getSupabaseClient } from "../../../shared/supabase.js";
import { getEventConfig } from "../../config.js";
import { setCorsHeaders } from "../../../shared/cors.js";

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

    // Check for existing pending payment (in case of duplicate submission)
    const { data: existingPendingPayment } = await supabase
      .from("event_payments")
      .select("*")
      .eq("registration_id", registration_id)
      .eq("payment_status", "pending")
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
        error: "Nie udało się utworzyć uczestników. Spróbuj ponownie."
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

    // Update existing pending payment or create new one
    let payment;
    try {
      payment = await updateOrCreatePayment(supabase, registration_id, allParticipants, existingPendingPayment, eventConfig, extraDonation);
    } catch (error) {
      console.error("Error updating/creating payment:", error);
      return res.status(500).json({
        success: false,
        error: "Nie udało się utworzyć płatności. Spróbuj ponownie."
      });
    }

    // Get registration email for confirmation
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
            totalAmount: payment.totalAmount || payment.total_amount,
            charityAmount: payment.charityAmount || payment.charity_amount
          },
          registrationId: registration_id,
          eventConfig
        });
      } catch (emailError) {
        console.error("Error sending email:", emailError);
        // Don't fail the request if email fails
      }
    }

    // Add clubs to database if they don't exist
    await upsertClubs(supabase, participants);

    return res.status(200).json({
      success: true,
      registrationId: registration_id,
      message: "Rejestracja utworzona. Link do płatności został wysłany na email."
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return res.status(500).json({
      success: false,
      error: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie."
    });
  }
}
