import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const SESSION_COOKIE_NAME = "zatyrani_session";

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase URL or key is not configured.");
  }

  return createClient(url, serviceKey);
}

function normalizePolishPhone(raw) {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");

  if (digits.length === 9) {
    return `+48${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("48")) {
    return `+${digits}`;
  }

  if (digits.length === 10 && digits.startsWith("0")) {
    return `+48${digits.slice(1)}`;
  }

  return null;
}

function systemError(res) {
  return res.status(500).json({
    error:
      "Coś nie tak z systemem. Spróbuj znowy za pare minut. Jak problem nadal się powtarza to napisz do Łysego",
  });
}

function hashCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { phone, code } = req.body || {};

  const normalizedPhone = normalizePolishPhone(phone || "");
  const trimmedCode = typeof code === "string" ? code.replace(/\D/g, "") : "";

  if (!normalizedPhone || trimmedCode.length !== 6) {
    return res.status(400).json({ error: "Nieprawidłowy numer telefonu lub kod." });
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
      return res.status(404).json({ error: "Nie znaleziono konta dla tego numeru." });
    }

    const nowIso = new Date().toISOString();

    const { data: codes, error: codeError } = await supabase
      .from("login_codes")
      .select("id, code_hash, expires_at, attempts, used")
      .eq("member_id", member.id)
      .gt("expires_at", nowIso)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1);

    if (codeError) {
      console.error("Supabase error when loading login_codes:", codeError);
      return systemError(res);
    }

    const loginCode = codes && codes[0];

    if (!loginCode) {
      return res.status(400).json({ error: "Kod jest nieaktualny lub nie istnieje." });
    }

    if (loginCode.attempts >= 3) {
      return res.status(403).json({ error: "Przekroczono dozwoloną liczbę prób logowania." });
    }

    const newAttempts = loginCode.attempts + 1;

    const { error: attemptsError } = await supabase
      .from("login_codes")
      .update({ attempts: newAttempts })
      .eq("id", loginCode.id);

    if (attemptsError) {
      console.error("Error updating attempts:", attemptsError);
      return systemError(res);
    }

    const incomingHash = hashCode(trimmedCode);

    if (incomingHash !== loginCode.code_hash) {
      return res.status(401).json({ error: "Nieprawidłowy kod." });
    }

    const sessionToken = crypto.randomBytes(32).toString("hex");
    const expiresAtDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    const sessionExpiresIso = expiresAtDate.toISOString();

    const { error: sessionError } = await supabase.from("sessions").insert({
      id: sessionToken,
      member_id: member.id,
      expires_at: sessionExpiresIso,
    });

    if (sessionError) {
      console.error("Error creating session:", sessionError);
      return systemError(res);
    }

    const cookie = `${SESSION_COOKIE_NAME}=${sessionToken}; HttpOnly; Secure; Path=/; SameSite=Lax; Expires=${expiresAtDate.toUTCString()}`;

    res.setHeader("Set-Cookie", cookie);

    const { error: usedError } = await supabase
      .from("login_codes")
      .update({ used: true })
      .eq("id", loginCode.id);

    if (usedError) {
      console.error("Error marking login code as used:", usedError);
    }

    return res.status(200).json({
      success: true,
      expiresAt: sessionExpiresIso,
    });
  } catch (error) {
    console.error("Unexpected error in /api/auth/verify-code:", error);
    return systemError(res);
  }
}
