import { createClient } from "@supabase/supabase-js";
import { verifyToken } from "./utils/auth.js";
import { validateParticipant as validateParticipantBase, calculatePaymentForParticipants } from "./utils/participant-validation.js";
import { createParticipantRecords, upsertClubs } from "./utils/database-operations.js";
import { sendRegistrationConfirmationEmail } from "./utils/email.js";

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase URL or key is not configured.");
  }

  return createClient(url, serviceKey);
}

function validateParticipant(participant) {
  // Use shared validation
  return validateParticipantBase(participant);
}

function calculatePayment(participants) {
  // Convert camelCase to snake_case for shared function
  const participantsForCalc = participants.map(p => ({
    race_category: p.raceCategory,
    tshirt_size: p.tshirtSize
  }));
  return calculatePaymentForParticipants(participantsForCalc);
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
        error: "Nie udało się utworzyć uczestników. Spróbuj ponownie."
      });
    }

    // Calculate payment and add extra donation
    const payment = calculatePayment(participants);
    const extraDonationAmount = Math.max(0, parseInt(extraDonation || '0'));
    payment.totalAmount += extraDonationAmount;
    payment.charityAmount += extraDonationAmount;

    // Create payment record (payment_link will be created on demand when user clicks pay)
    const { error: paymentError } = await supabase
      .from("niebocross_payments")
      .insert({
        registration_id: registration_id,
        total_amount: payment.totalAmount,
        race_fees: payment.raceFees,
        tshirt_fees: payment.tshirtFees,
        charity_amount: payment.charityAmount,
        payment_status: 'pending'
      });

    if (paymentError) {
      console.error("Error creating payment:", paymentError);
      return res.status(500).json({
        success: false,
        error: "Nie udało się utworzyć płatności. Spróbuj ponownie."
      });
    }

    // Get registration email for confirmation
    const { data: registration } = await supabase
      .from("niebocross_registrations")
      .select("email, contact_person")
      .eq("id", registration_id)
      .single();

    // Send confirmation email
    if (registration) {
      try {
        await sendRegistrationConfirmationEmail({
          email: registration.email,
          contactPerson: registration.contact_person,
          participants,
          payment,
          registrationId: registration_id
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
