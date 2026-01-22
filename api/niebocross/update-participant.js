import { createClient } from "@supabase/supabase-js";
import { verifyToken } from "./utils/auth.js";

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase URL or key is not configured.");
  }

  return createClient(url, serviceKey);
}

function calculateAge(birthDate, eventDate) {
  const birth = new Date(birthDate);
  const event = new Date(eventDate);
  let age = event.getFullYear() - birth.getFullYear();
  const monthDiff = event.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && event.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function validateParticipant(participant) {
  const { fullName, birthDate, city, nationality, raceCategory, phoneNumber } = participant;
  
  if (!fullName || !birthDate || !city || !nationality || !raceCategory || !phoneNumber) {
    return { valid: false, error: "Wszystkie wymagane pola muszą być wypełnione" };
  }

  // Validate phone number (Polish format: 9 digits)
  if (!/^\d{9}$/.test(phoneNumber)) {
    return { valid: false, error: "Numer telefonu musi składać się z 9 cyfr" };
  }

  // Validate race category
  const validCategories = ['3km_run', '3km_nw', '9km_run', '9km_nw', 'kids_run'];
  if (!validCategories.includes(raceCategory)) {
    return { valid: false, error: "Nieprawidłowa kategoria biegu" };
  }

  // Validate age restrictions (event date: April 12, 2026)
  const eventDate = '2026-04-12';
  const age = calculateAge(birthDate, eventDate);

  const adultRaces = ['3km_run', '3km_nw', '9km_run', '9km_nw'];
  const kidsRaces = ['kids_run'];

  if (adultRaces.includes(raceCategory) && age < 16) {
    return { valid: false, error: "Minimalny wiek dla tras 3km i 9km to 16 lat" };
  }

  if (kidsRaces.includes(raceCategory) && age > 14) {
    return { valid: false, error: "Biegi dzieci dla uczestników do 14 lat" };
  }

  return { valid: true };
}

function calculatePayment(participants) {
  let raceFees = 0;
  let tshirtFees = 0;

  participants.forEach(p => {
    // Race fees
    if (p.race_category === 'kids_run') {
      raceFees += 20;
    } else {
      raceFees += 60;
    }

    // T-shirt fees
    if (p.tshirt_size) {
      tshirtFees += 80;
    }
  });

  // Charity amount: race_fees + (tshirt_fees * 10/80)
  const charityAmount = raceFees + (tshirtFees * 10 / 80);

  return {
    raceFees,
    tshirtFees,
    totalAmount: raceFees + tshirtFees,
    charityAmount
  };
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
    const { participantId, participant } = req.body;

    if (!participantId || !participant) {
      return res.status(400).json({
        success: false,
        error: "ID uczestnika i dane są wymagane"
      });
    }

    // Validate participant data
    const validation = validateParticipant(participant);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    const supabase = getSupabaseClient();

    // Check if payment is paid (editing not allowed)
    const { data: payment, error: paymentCheckError } = await supabase
      .from("niebocross_payments")
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
        error: "Nie można edytować uczestnika po opłaceniu rejestracji. Skontaktuj się z organizatorem: https://zatyrani.pl/niebocross#kontakt"
      });
    }

    // Check if event date passed
    const eventDate = new Date('2026-04-12');
    const currentDate = new Date();
    if (currentDate >= eventDate) {
      return res.status(403).json({
        success: false,
        error: "Nie można edytować uczestnika po dacie wydarzenia. Skontaktuj się z organizatorem: https://zatyrani.pl/niebocross#kontakt"
      });
    }

    // Verify participant belongs to this registration
    const { data: existingParticipant, error: participantError } = await supabase
      .from("niebocross_participants")
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
      .from("niebocross_participants")
      .update({
        full_name: participant.fullName,
        birth_date: participant.birthDate,
        city: participant.city,
        nationality: participant.nationality,
        club: participant.club || null,
        race_category: participant.raceCategory,
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
      .from("niebocross_participants")
      .select("*")
      .eq("registration_id", registration_id);

    if (participantsError) {
      console.error("Error fetching participants:", participantsError);
      return res.status(500).json({
        success: false,
        error: "Nie udało się pobrać uczestników"
      });
    }

    const paymentCalc = calculatePayment(allParticipants);

    // Update pending payment record only
    const { error: paymentUpdateError } = await supabase
      .from("niebocross_payments")
      .update({
        total_amount: paymentCalc.totalAmount,
        race_fees: paymentCalc.raceFees,
        tshirt_fees: paymentCalc.tshirtFees,
        charity_amount: paymentCalc.charityAmount
      })
      .eq("registration_id", registration_id)
      .eq("payment_status", "pending");

    if (paymentUpdateError) {
      console.error("Error updating payment:", paymentUpdateError);
      // Don't fail the request, participant is updated
    }

    // Add club to database if it doesn't exist
    if (participant.club) {
      await supabase
        .from("niebocross_clubs")
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
