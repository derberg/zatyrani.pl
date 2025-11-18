import { createClient } from "@supabase/supabase-js";

const SESSION_COOKIE_NAME = "zatyrani_session";

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase URL or key is not configured.");
  }

  return createClient(url, serviceKey);
}

function parseCookies(req) {
  const header = req.headers["cookie"];
  if (!header || typeof header !== "string") return {};
  return header.split(";").reduce((acc, part) => {
    const [name, ...rest] = part.trim().split("=");
    if (!name) return acc;
    acc[name] = decodeURIComponent(rest.join("="));
  }, {});
}

export async function verifyUser(req) {
  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (e) {
    console.error("Supabase config error:", e);
    throw new Error("System configuration error");
  }

  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE_NAME];

  if (!token) {
    throw new Error("Wygląda na to, że wygasły twoje uprawnienia do tej funkcji. Wyloguj się i zaloguj ponownie. Jak to nie zadziała to napisz do Łysego.");
  }

  const nowIso = new Date().toISOString();

  const { data: sessions, error: sessionError } = await supabase
    .from("sessions")
    .select("id, member_id, expires_at")
    .eq("id", token)
    .gt("expires_at", nowIso)
    .limit(1);

  if (sessionError) {
    console.error("Error loading session:", sessionError);
    throw new Error("System error");
  }

  const session = sessions && sessions[0];

  if (!session) {
    throw new Error("Wygląda na to, że nie masz uprawnień do tej funkcji. Napisz do Łysego.");
  }

  return {
    memberId: session.member_id,
    expiresAt: session.expires_at,
  };
}
