import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase URL or key is not configured.");
  }

  return createClient(url, serviceKey);
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
      .from("niebocross_auth_codes")
      .select("*")
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
      .from("niebocross_auth_codes")
      .update({ used: true })
      .eq("id", authCode.id);

    // Get registration record
    const { data: registration, error: regError } = await supabase
      .from("niebocross_registrations")
      .select("*")
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

    // Set HTTP-only cookie and status cookie
    res.setHeader('Set-Cookie', [
      `niebocross_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${180 * 24 * 60 * 60}`,
      `niebocross_auth_status=true; Path=/; Secure; SameSite=Strict; Max-Age=${180 * 24 * 60 * 60}`
    ]);

    return res.status(200).json({
      success: true,
      sessionToken,
      registration: {
        id: registration.id,
        email: registration.email,
        fullName: registration.full_name
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
