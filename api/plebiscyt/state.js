import { authorizeVoter, getServiceClient, listActiveMembers, systemError } from "./_shared.js";
import { PLEBISCYT, isPlebiscytClosed } from "../../src/utils/plebiscyt.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let supabase;
  try {
    supabase = getServiceClient();
  } catch (e) {
    console.error("Plebiscyt config error:", e);
    return systemError(res);
  }

  let voter;
  try {
    voter = await authorizeVoter(req, supabase);
  } catch (e) {
    return res.status(401).json({ error: e.message || "Brak autoryzacji." });
  }

  try {
    const members = await listActiveMembers(supabase);

    const { data: entries, error: entryError } = await supabase
      .from("plebiscyt_entries")
      .select("votes, achievement")
      .eq("edition", PLEBISCYT.edition)
      .eq("member_id", voter.id);
    if (entryError) throw entryError;
    const entry = entries?.[0];

    return res.status(200).json({
      me: { id: voter.id, name: voter.name },
      candidates: members.map((m) => ({ id: m.id, name: m.name })),
      votes: entry?.votes || {},
      achievement: entry?.achievement || "",
      closed: isPlebiscytClosed(),
    });
  } catch (e) {
    console.error("Plebiscyt state error:", e);
    return systemError(res);
  }
}
