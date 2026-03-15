import { createClient } from "@supabase/supabase-js";

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase URL or key is not configured.");
  return createClient(url, key);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { name, surname, club, location, year, phone, hide_name, website } = req.body;

    // Honeypot check
    if (website) {
      console.log("Bot detected - honeypot field filled");
      return res.status(400).json({ error: "Invalid request" });
    }

    // Required field validation
    if (!name || !surname || !location || !year || !phone) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Max length validation
    if (name.length > 100 || surname.length > 100 || location.length > 100 || year.length > 4 || phone.length > 20) {
      return res.status(400).json({ error: "Input exceeds maximum length" });
    }

    // Year must be a valid number
    if (!/^\d{4}$/.test(year.trim())) {
      return res.status(400).json({ error: "Invalid year format" });
    }

    if (club && club.length > 150) {
      return res.status(400).json({ error: "Input exceeds maximum length" });
    }

    const supabase = getSupabaseClient();

    const { count, error: countError } = await supabase
      .from("nwrajd_participants")
      .select("*", { count: "exact", head: true });

    if (countError) throw countError;
    if (count >= 50) {
      return res.status(409).json({ error: "LIMIT_REACHED" });
    }

    const { error } = await supabase.from("nwrajd_participants").insert({
      year,
      firstname: name,
      lastname: surname,
      club: club || null,
      location,
      phone,
      hide_name: hide_name === true || hide_name === "true" || hide_name === "on",
    });

    if (error) throw error;

    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to process request" });
  }
}
