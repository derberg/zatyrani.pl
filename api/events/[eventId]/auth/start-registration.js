import crypto from "node:crypto";
import { getSupabaseClient } from '../../../shared/supabase.js';
import { sendVerificationCodeEmail } from '../../../shared/email.js';
import { getEventConfig } from '../../config.js';
import { setCorsHeaders } from '../../../shared/cors.js';

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let eventConfig;
  try {
    eventConfig = getEventConfig(req.query.eventId);
  } catch {
    return res.status(404).json({ success: false, error: "Event not found" });
  }

  try {
    const { email, fullName, rodoAccepted, termsAccepted, website } = req.body;

    // Honeypot
    if (website) {
      return res.status(400).json({ success: false, error: "Invalid request" });
    }

    if (!email || !fullName) {
      return res.status(400).json({ success: false, error: "EMAIL_REQUIRED" });
    }
    if (!validateEmail(email)) {
      return res.status(400).json({ success: false, error: "EMAIL_INVALID" });
    }
    if (!rodoAccepted) {
      return res.status(400).json({ success: false, error: "RODO_REQUIRED" });
    }
    if (!termsAccepted) {
      return res.status(400).json({ success: false, error: "TERMS_REQUIRED" });
    }

    const supabase = getSupabaseClient();

    // Check if email already exists for this event
    const { data: existingReg } = await supabase
      .from("event_registrations")
      .select("email")
      .eq("event_id", eventConfig.id)
      .eq("email", email.toLowerCase())
      .single();

    if (existingReg) {
      return res.status(400).json({ success: false, error: "EMAIL_EXISTS" });
    }

    // Create registration
    const { error: regError } = await supabase
      .from("event_registrations")
      .insert({ event_id: eventConfig.id, email: email.toLowerCase(), contact_person: fullName })
      .select()
      .single();

    if (regError) {
      // Unique constraint violation (race condition with concurrent request)
      if (regError.code === '23505') {
        return res.status(400).json({ success: false, error: "EMAIL_EXISTS" });
      }
      console.error("Error creating registration:", regError);
      return res.status(500).json({ success: false, error: "DB_ERROR" });
    }

    // Rate limit: max 3 codes per hour
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const { data: recentCodes } = await supabase
      .from("event_auth_codes")
      .select("id")
      .eq("event_id", eventConfig.id)
      .eq("email", email.toLowerCase())
      .gte("created_at", oneHourAgo.toISOString());

    if (recentCodes && recentCodes.length >= 3) {
      return res.status(429).json({ success: false, error: "RATE_LIMIT" });
    }

    // Generate and store verification code
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    const { error: codeError } = await supabase
      .from("event_auth_codes")
      .insert({ event_id: eventConfig.id, email: email.toLowerCase(), code, expires_at: expiresAt.toISOString(), used: false });

    if (codeError) {
      return res.status(500).json({ success: false, error: "CODE_STORE_ERROR" });
    }

    try {
      await sendVerificationCodeEmail(email, code, 'registration', eventConfig);
    } catch (emailError) {
      console.error("Error sending email:", emailError);
    }

    return res.status(200).json({ success: true, message: "Kod weryfikacyjny został wysłany na email." });

  } catch (error) {
    console.error("Unexpected error:", error);
    return res.status(500).json({ success: false, error: "UNEXPECTED_ERROR" });
  }
}
