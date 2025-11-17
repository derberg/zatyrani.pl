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
  if (req.method !== "POST") {
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

    if (token) {
      const { error: deleteError } = await supabase
        .from("sessions")
        .delete()
        .eq("id", token);

      if (deleteError) {
        console.error("Error deleting session:", deleteError);
      }
    }

    const expiredCookie = `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; Path=/; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    res.setHeader("Set-Cookie", expiredCookie);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Unexpected error in /api/auth/logout:", error);
    return systemError(res);
  }
}
