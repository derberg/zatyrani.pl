import { createClient } from "@supabase/supabase-js";

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

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        error: "Zapytanie musi zawierać co najmniej 2 znaki"
      });
    }

    const supabase = getSupabaseClient();

    const { data: clubs, error } = await supabase
      .from("niebocross_clubs")
      .select("name")
      .ilike("name", `%${q}%`)
      .order("name", { ascending: true })
      .limit(20);

    if (error) {
      console.error("Error searching clubs:", error);
      return res.status(500).json({
        success: false,
        error: "Nie udało się wyszukać klubów"
      });
    }

    return res.status(200).json({
      success: true,
      clubs: clubs.map(c => c.name)
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return res.status(500).json({
      success: false,
      error: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie."
    });
  }
}
