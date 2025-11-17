import twilio from "twilio";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import dotenv from 'dotenv';
dotenv.config({ path: './.env.production' });

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  console.log("Supabase URL:", url);
  console.log("Supabase Service Role Key:", serviceKey);


  if (!url || !serviceKey) {
    throw new Error("Supabase URL or key is not configured.");
  }

  return createClient(url, serviceKey);
}

function normalizePolishPhone(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();

  // Already in full E.164 format for Poland
  if (/^\+48\d{9}$/.test(trimmed)) {
    return trimmed;
  }

  const digits = trimmed.replace(/\D/g, "");

  // Accept 9–11 digits (local, 0-prefixed, or 48-prefixed),
  // always normalize to +48 and the last 9 digits
  if (digits.length < 9 || digits.length > 11) {
    return null;
  }

  const last9 = digits.slice(-9);
  if (!/^\d{9}$/.test(last9)) {
    return null;
  }

  return `+48${last9}`;
}

function systemError(res) {
  return res.status(500).json({
    error:
      "Coś nie tak z systemem. Spróbuj znowy za pare minut. Jak problem nadal się powtarze to napisz do Łysego",
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { phone } = req.body || {};
  const normalizedPhone = normalizePolishPhone(phone || "");

  if (!normalizedPhone) {
    return res.status(400).json({ error: "Nieprawidłowy numer telefonu." });
  }

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (e) {
    console.error("Supabase config error:", e);
    return systemError(res);
  }

  try {
    const { data: members, error: memberError } = await supabase
      .from("members")
      .select("id, phone")
      .eq("phone", normalizedPhone)
      .limit(1);

    if (memberError) {
      console.error("Supabase error when looking up member:", memberError);
      return systemError(res);
    }

    const member = members && members[0];

    if (!member) {
      return res.status(404).json({ error: "Nie znaleziono konta dla tego numeru. Napisz do Łysego." });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !twilioPhoneNumber) {
      console.error("Twilio environment variables are not set.");
      return systemError(res);
    }

    const client = twilio(accountSid, authToken);
    const code = String(Math.floor(100000 + Math.random() * 900000));

    try {
      await client.messages.create({
        body: `Twój kod do logowania do strony Zatyranych: ${code}`,
        to: normalizedPhone,
        from: twilioPhoneNumber,
      });
    } catch (smsError) {
      console.error("Error sending SMS:", smsError);
      return res.status(503).json({
        error:
          "Coś nie tak z systemem. Spróbuj znowu za pare minut. Jak problem nadal się powtarza to napisz do Łysego",
      });
    }

    const codeHash = crypto.createHash("sha256").update(code).digest("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase.from("login_codes").insert({
      member_id: member.id,
      code_hash: codeHash,
      expires_at: expiresAt,
      attempts: 0,
      used: false,
    });

    if (insertError) {
      console.error("Error inserting login code:", insertError);
      return systemError(res);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Unexpected error in /api/auth/request-code:", error);
    return systemError(res);
  }
}
