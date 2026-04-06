import { getSupabaseClient } from "../../../shared/supabase.js";
import { getEventConfig } from "../../config.js";
import { setCorsHeaders } from "../../../shared/cors.js";

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    getEventConfig(req.query.eventId);
  } catch {
    return res.status(404).json({ error: "Event not found" });
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
      .from("event_clubs")
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
