import { createClient } from "@supabase/supabase-js";
import sgMail from "@sendgrid/mail";
import crypto from "node:crypto";
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

function generateVerificationCode() {
  return crypto.randomInt(100000, 999999).toString();
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
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
    const { email, fullName, rodoAccepted, website } = req.body;

    // Honeypot check - if website field is filled, it's a bot
    if (website) {
      console.log('Bot detected - honeypot field filled');
      return res.status(400).json({
        success: false,
        error: "Invalid request"
      });
    }

    // Validation
    if (!email || !fullName) {
      return res.status(400).json({ 
        success: false,
        error: "EMAIL_REQUIRED"
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ 
        success: false,
        error: "EMAIL_INVALID"
      });
    }

    if (!rodoAccepted) {
      return res.status(400).json({ 
        success: false,
        error: "RODO_REQUIRED"
      });
    }

    const supabase = getSupabaseClient();

    // Check if email already exists
    const { data: existingReg } = await supabase
      .from("niebocross_registrations")
      .select("email")
      .eq("email", email.toLowerCase())
      .single();

    if (existingReg) {
      return res.status(400).json({
        success: false,
        error: "EMAIL_EXISTS"
      });
    }

    // Create registration record
    const { error: regError } = await supabase
      .from("niebocross_registrations")
      .insert({
        email: email.toLowerCase(),
        contact_person: fullName,
        rodo_consent: true
      })
      .select()
      .single();

    if (regError) {
      console.error("Error creating registration:", regError);
      return res.status(500).json({
        success: false,
        error: "DB_ERROR"
      });
    }

    // Generate verification code
    const code = generateVerificationCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Check rate limiting - max 3 codes per hour
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const { data: recentCodes } = await supabase
      .from("niebocross_auth_codes")
      .select("id")
      .eq("email", email.toLowerCase())
      .gte("created_at", oneHourAgo.toISOString());

    if (recentCodes && recentCodes.length >= 3) {
      return res.status(429).json({
        success: false,
        error: "RATE_LIMIT"
      });
    }

    // Store verification code
    const { error: codeError } = await supabase
      .from("niebocross_auth_codes")
      .insert({
        email: email.toLowerCase(),
        code: code,
        expires_at: expiresAt.toISOString(),
        used: false
      });

    if (codeError) {
      console.error("Error storing code:", codeError);
      return res.status(500).json({
        success: false,
        error: "CODE_STORE_ERROR"
      });
    }

    // Send email with verification code
    const sendgridKey = process.env.SENDGRID_API_KEY;
    if (!sendgridKey) {
      console.error("SendGrid API key not configured");
      return res.status(500).json({
        success: false,
        error: "EMAIL_NOT_SENT"
      });
    }

    sgMail.setApiKey(sendgridKey);

    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL || "zatyrani@zatyrani.pl",
      subject: "Kod weryfikacyjny - NieboCross Panel",
      text: `Twój kod weryfikacyjny: ${code}\n\nKod jest ważny przez 10 minut.\n\nJeśli nie próbowałeś się zarejestrować, zignoruj tę wiadomość.\n\n--\nStowarzyszenie ZATYRANI\nwww.zatyrani.pl`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Kod weryfikacyjny - NieboCross 2026</h2>
          <p>Twój kod weryfikacyjny:</p>
          <div style="background-color: #f0f0f0; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${code}
          </div>
          <p>Kod jest ważny przez 10 minut.</p>
          <p>Jeśli nie próbowałeś się zarejestrować na NieboCross, zignoruj tę wiadomość.</p>
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

    return res.status(200).json({
      success: true,
      message: "Kod weryfikacyjny został wysłany na email."
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return res.status(500).json({
      success: false,
      error: "UNEXPECTED_ERROR"
    });
  }
}
