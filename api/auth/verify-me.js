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

function systemError(res) {
  return res.status(500).json({
    error:
      "Coś nie tak z systemem. Spróbuj znowy za pare minut. Jak problem nadal się powtarze to napisz do Łysego",
  });
}

function parseCookies(req) {
  const header = req.headers["cookie"];
  if (!header || typeof header !== "string") return {};
  return header.split(";").reduce((acc, part) => {
    const [name, ...rest] = part.trim().split("=");
    if (!name) return acc;
    acc[name] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (e) {
    console.error("Supabase config error:", e);
    return systemError(res);
  }

  try {
    const cookies = parseCookies(req);
    const token = cookies[SESSION_COOKIE_NAME];

    if (!token) {
      return res.status(401).json({ error: "Brak aktywnej sesji." });
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
      return systemError(res);
    }

    const session = sessions && sessions[0];

    if (!session) {
      return res.status(401).json({ error: "Sesja wygasła lub nie istnieje." });
    }

    return res.status(200).json({
      success: true,
      memberId: session.member_id,
      expiresAt: session.expires_at,
    });
  } catch (error) {
    console.error("Unexpected error in /api/auth/verify-me:", error);
    return systemError(res);
  }
}
