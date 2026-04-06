import crypto from "node:crypto";
import { getSupabaseClient } from '../../../../shared/supabase.js';
import { sendVerificationCodeEmail } from '../../../../shared/email.js';
import { getEventConfig } from '../../../config.js';

function generateVerificationCode() {
  return crypto.randomInt(100000, 999999).toString();
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "https://zatyrani.pl");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let eventConfig;
  try {
    eventConfig = getEventConfig(req.query.eventId);
  } catch {
    return res.status(404).json({ success: false, error: "Event not found" });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email jest wymagany"
      });
    }

    const supabase = getSupabaseClient();

    // Silently check if email exists in registrations (for security - don't reveal if email is registered)
    const { data: registration } = await supabase
      .from("event_registrations")
      .select("email")
      .eq("event_id", eventConfig.id)
      .eq("email", email.toLowerCase())
      .single();

    // If email doesn't exist, still return success to prevent user enumeration
    // The user will see the code entry form but won't receive an email
    if (!registration) {
      console.log(`Login attempt with unregistered email: ${email.toLowerCase()}`);
      return res.status(200).json({
        success: true,
        message: "Kod weryfikacyjny został wysłany na email."
      });
    }

    // Check rate limiting - max 3 codes per hour
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const { data: recentCodes } = await supabase
      .from("event_auth_codes")
      .select("id")
      .eq("event_id", eventConfig.id)
      .eq("email", email.toLowerCase())
      .gte("created_at", oneHourAgo.toISOString());

    if (recentCodes && recentCodes.length >= 3) {
      return res.status(429).json({
        success: false,
        error: "RATE_LIMIT"
      });
    }

    // Generate verification code
    const code = generateVerificationCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Store verification code
    const { error: codeError } = await supabase
      .from("event_auth_codes")
      .insert({
        event_id: eventConfig.id,
        email: email.toLowerCase(),
        code: code,
        expires_at: expiresAt.toISOString(),
        used: false
      });

    if (codeError) {
      console.error("Error storing code:", codeError);
      return res.status(500).json({
        success: false,
        error: "Nie udało się wygenerować kodu. Spróbuj ponownie."
      });
    }

    // Send email with verification code
    try {
      await sendVerificationCodeEmail(email, code, 'login', eventConfig);
    } catch (emailError) {
      console.error("Error sending email:", emailError);
      // Don't fail the request if email fails
    }

    return res.status(200).json({
      success: true,
      message: "Kod weryfikacyjny został wysłany na email."
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return res.status(500).json({
      success: false,
      error: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie."
    });
  }
}
