import { createClient } from "@supabase/supabase-js";

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase URL or key is not configured.");
  return createClient(url, key);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("nwrajd_participants")
      .select("year, firstname, lastname, club, location, hide_name")
      .order("lastname", { ascending: true });

    if (error) throw error;

    const result = data.map(({ hide_name, firstname, lastname, ...rest }) => ({
      ...rest,
      firstname: hide_name ? "–" : firstname,
      lastname: hide_name ? "Uczestnik anonimowy" : lastname,
    }));

    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch participants" });
  }
}
