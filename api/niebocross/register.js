import { createClient } from "@supabase/supabase-js";
import sgMail from "@sendgrid/mail";
import { verifyToken } from "./utils/auth.js";
import dotenv from 'dotenv';
dotenv.config({ path: './.env.production' });

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
  const { fullName, birthDate, city, nationality, raceCategory, termsAccepted } = participant;
  
  if (!fullName || !birthDate || !city || !nationality || !raceCategory) {
    return { valid: false, error: "Wszystkie wymagane pola muszą być wypełnione" };
  }

  if (!termsAccepted) {
    return { valid: false, error: "Musisz zaakceptować regulamin" };
  }

  // Validate race category
  const validCategories = ['3km_run', '3km_nw', '9km_run', '9km_nw', 'kids_100m', 'kids_300m'];
  if (!validCategories.includes(raceCategory)) {
    return { valid: false, error: "Nieprawidłowa kategoria biegu" };
  }

  // Validate age restrictions (event date: April 12, 2026)
  const eventDate = '2026-04-12';
  const age = calculateAge(birthDate, eventDate);

  const adultRaces = ['3km_run', '3km_nw', '9km_run', '9km_nw'];
  const kidsRaces = ['kids_100m', 'kids_300m'];

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
    if (p.raceCategory === 'kids_100m' || p.raceCategory === 'kids_300m') {
      raceFees += 20;
    } else {
      raceFees += 60;
    }

    // T-shirt fees
    if (p.tshirtSize) {
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
    const { participants } = req.body;

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
    const participantRecords = participants.map(p => ({
      registration_id: registration_id,
      full_name: p.fullName,
      birth_date: p.birthDate,
      city: p.city,
      nationality: p.nationality,
      club: p.club || null,
      race_category: p.raceCategory,
      hide_name_public: p.hideNamePublic || false,
      tshirt_size: p.tshirtSize || null,
      terms_accepted: p.termsAccepted,
      rodo_accepted: true
    }));

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

    // Calculate payment
    const payment = calculatePayment(participants);

    // Create payment record
    const { data: paymentRecord, error: paymentError } = await supabase
      .from("niebocross_payments")
      .insert({
        registration_id: registration_id,
        total_amount: payment.totalAmount,
        race_fees: payment.raceFees,
        tshirt_fees: payment.tshirtFees,
        charity_amount: payment.charityAmount,
        payment_status: 'pending'
      })
      .select()
      .single();

    if (paymentError) {
      console.error("Error creating payment:", paymentError);
      return res.status(500).json({
        success: false,
        error: "Nie udało się utworzyć płatności. Spróbuj ponownie."
      });
    }

    // TODO: Generate SIBS payment link
    // For now, use placeholder
    const paymentLink = `https://zatyrani.pl/niebocross/payment/${paymentRecord.id}`;

    // Update payment with link
    await supabase
      .from("niebocross_payments")
      .update({ payment_link: paymentLink })
      .eq("id", paymentRecord.id);

    // Get registration email
    const { data: registration } = await supabase
      .from("niebocross_registrations")
      .select("email, full_name")
      .eq("id", registration_id)
      .single();

    // Send confirmation email
    const sendgridKey = process.env.SENDGRID_API_KEY;
    if (sendgridKey && registration) {
      sgMail.setApiKey(sendgridKey);

      const participantsList = participants.map(p => 
        `- ${p.fullName} - ${p.raceCategory.replace('_', ' ')}`
      ).join('\n');

      const msg = {
        to: registration.email,
        from: process.env.SENDGRID_FROM_EMAIL || "zatyrani@zatyrani.pl",
        subject: "Potwierdzenie rejestracji - NieboCross 2026",
        text: `Witaj ${registration.full_name},\n\nDziękujemy za rejestrację na wydarzenie NieboCross 2026!\n\nZarejestrowani uczestnicy:\n${participantsList}\n\nDo zapłaty: ${payment.totalAmount} zł\n(w tym ${payment.charityAmount.toFixed(2)} zł na cel charytatywny)\n\nAby dokończyć rejestrację, opłać udział klikając poniższy link:\n${paymentLink}\n\nLink jest ważny przez 48 godzin.\n\nMożesz sprawdzić status płatności i pobrać potwierdzenie logując się na:\nhttps://zatyrani.pl/niebocross/panel\n\nDo zobaczenia w Nieborowicach 12 kwietnia 2026!\n\n--\nStowarzyszenie ZATYRANI\nwww.zatyrani.pl`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Potwierdzenie rejestracji - NieboCross 2026</h2>
            <p>Witaj ${registration.full_name},</p>
            <p>Dziękujemy za rejestrację na wydarzenie NieboCross 2026!</p>
            <h3>Zarejestrowani uczestnicy:</h3>
            <ul>
              ${participants.map(p => `<li>${p.fullName} - ${p.raceCategory.replace('_', ' ')}</li>`).join('')}
            </ul>
            <div style="background-color: #f9f9f9; padding: 20px; margin: 20px 0; border-left: 4px solid #4CAF50;">
              <p style="margin: 0;"><strong>Do zapłaty: ${payment.totalAmount} zł</strong></p>
              <p style="margin: 5px 0 0 0; color: #666;">(w tym ${payment.charityAmount.toFixed(2)} zł na cel charytatywny)</p>
            </div>
            <p>Aby dokończyć rejestrację, opłać udział klikając poniższy link:</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${paymentLink}" style="background-color: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Opłać rejestrację</a>
            </p>
            <p style="color: #666; font-size: 14px;">Link jest ważny przez 48 godzin.</p>
            <p>Możesz sprawdzić status płatności i pobrać potwierdzenie logując się na:<br>
            <a href="https://zatyrani.pl/niebocross/panel">https://zatyrani.pl/niebocross/panel</a></p>
            <p>Do zobaczenia w Nieborowicach 12 kwietnia 2026!</p>
            <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;">
            <p style="color: #666; font-size: 14px;">
              Stowarzyszenie ZATYRANI<br>
              <a href="https://zatyrani.pl">www.zatyrani.pl</a>
            </p>
          </div>
        `,
      };

      try {
        await sgMail.send(msg);
      } catch (emailError) {
        console.error("Error sending email:", emailError);
        // Don't fail the request if email fails
      }
    }

    // Add clubs to database if they don't exist
    for (const participant of participants) {
      if (participant.club) {
        await supabase
          .from("niebocross_clubs")
          .upsert(
            { name: participant.club },
            { onConflict: 'name', ignoreDuplicates: true }
          );
      }
    }

    return res.status(200).json({
      success: true,
      registrationId: registration_id,
      paymentLink: paymentLink,
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
