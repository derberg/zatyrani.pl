import { verifyToken } from "../../../shared/auth.js";
import { getSupabaseClient } from "../../../shared/supabase.js";
import { getEventConfig } from "../../config.js";

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "https://zatyrani.pl");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
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
    const supabase = getSupabaseClient();

    // Get registration
    const { data: registration, error: regError } = await supabase
      .from("event_registrations")
      .select("*")
      .eq("id", registration_id)
      .single();

    if (regError || !registration) {
      return res.status(404).json({
        success: false,
        error: "Rejestracja nie znaleziona"
      });
    }

    // Get participants
    const { data: participants, error: participantsError } = await supabase
      .from("event_participants")
      .select("*")
      .eq("registration_id", registration_id)
      .order("created_at", { ascending: true });

    if (participantsError) {
      console.error("Error fetching participants:", participantsError);
      return res.status(500).json({
        success: false,
        error: "Nie udało się pobrać uczestników"
      });
    }

    // Get payment
    const { data: payment, error: paymentError } = await supabase
      .from("event_payments")
      .select("*")
      .eq("registration_id", registration_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Payment might not exist yet (if no participants added)
    let paymentData = null;
    if (!paymentError && payment) {
      paymentData = payment;
    }

    // Determine editing permissions
    const eventDate = new Date(eventConfig.date);
    const currentDate = new Date();
    const isPaid = paymentData && paymentData.payment_status === 'paid';
    const isAfterEventDate = currentDate >= eventDate;

    // canEdit: can edit/delete existing participants (only when payment is pending and before event)
    const canEdit = !isPaid && !isAfterEventDate;

    // canAddParticipants: can add new participants (allowed even after payment, creates new pending payment)
    const canAddParticipants = !isAfterEventDate;

    return res.status(200).json({
      success: true,
      registration: {
        id: registration.id,
        email: registration.email,
        fullName: registration.contact_person,
        createdAt: registration.created_at
      },
      participants: participants.map(p => ({
        id: p.id,
        firstName: p.first_name,
        lastName: p.last_name,
        birthDate: p.birth_date,
        city: p.city,
        nationality: p.nationality,
        club: p.club,
        raceCategory: p.race_category,
        gender: p.gender,
        foodPreference: p.food_preference,
        hideNamePublic: p.hide_name_public,
        phoneNumber: p.phone_number,
        tshirtSize: p.tshirt_size,
        createdAt: p.created_at
      })),
      payment: paymentData ? {
        id: paymentData.id,
        totalAmount: paymentData.total_amount,
        raceFees: paymentData.race_fees,
        tshirtFees: paymentData.tshirt_fees,
        charityAmount: paymentData.charity_amount,
        paymentStatus: paymentData.payment_status,
        paymentLink: paymentData.payment_link,
        transactionId: paymentData.transaction_id,
        paidAt: paymentData.paid_at,
        createdAt: paymentData.created_at
      } : null,
      canEdit,
      canAddParticipants
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return res.status(500).json({
      success: false,
      error: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie."
    });
  }
}
