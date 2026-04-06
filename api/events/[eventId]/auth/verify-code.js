import jwt from "jsonwebtoken";
import { getSupabaseClient } from '../../../../shared/supabase.js';
import { getEventConfig } from '../../../config.js';

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
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        error: "CODE_REQUIRED"
      });
    }

    const supabase = getSupabaseClient();

    // Find valid code
    const { data: authCode, error: codeError } = await supabase
      .from("event_auth_codes")
      .select("*")
      .eq("event_id", eventConfig.id)
      .eq("email", email.toLowerCase())
      .eq("code", code)
      .eq("used", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (codeError || !authCode) {
      return res.status(400).json({
        success: false,
        error: "INVALID_CODE"
      });
    }

    // Mark code as used
    await supabase
      .from("event_auth_codes")
      .update({ used: true })
      .eq("id", authCode.id);

    // Get registration record (filter by event_id to prevent cross-event JWT)
    const { data: registration, error: regError } = await supabase
      .from("event_registrations")
      .select("*")
      .eq("event_id", eventConfig.id)
      .eq("email", email.toLowerCase())
      .single();

    if (regError || !registration) {
      return res.status(404).json({
        success: false,
        error: "REGISTRATION_NOT_FOUND"
      });
    }

    // Generate JWT token (valid for 180 days)
    const jwtSecret = process.env.SUPABASE_JWT_SECRET;
    if (!jwtSecret) {
      console.error("SUPABASE_JWT_SECRET not configured");
      return res.status(500).json({
        success: false,
        error: "SERVER_CONFIG_ERROR"
      });
    }

    const sessionToken = jwt.sign(
      {
        registration_id: registration.id,
        email: registration.email
      },
      jwtSecret,
      { expiresIn: '180d' }
    );

    // Set HTTP-only session cookie and readable auth status cookie
    res.setHeader('Set-Cookie', [
      `${eventConfig.cookiePrefix}_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${180 * 24 * 60 * 60}`,
      `${eventConfig.cookiePrefix}_auth_status=true; Path=/; Secure; SameSite=Strict; Max-Age=${180 * 24 * 60 * 60}`
    ]);

    return res.status(200).json({
      success: true,
      sessionToken,
      registration: {
        id: registration.id,
        email: registration.email,
        fullName: registration.contact_person
      }
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return res.status(500).json({
      success: false,
      error: "UNEXPECTED_ERROR"
    });
  }
}
