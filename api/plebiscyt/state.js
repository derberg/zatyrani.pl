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

    const { data: votes, error: votesError } = await supabase
      .from("plebiscyt_votes")
      .select("category, candidate_id")
      .eq("edition", PLEBISCYT.edition)
      .eq("voter_id", voter.id);
    if (votesError) throw votesError;

    const { data: achievements, error: achievementError } = await supabase
      .from("plebiscyt_achievements")
      .select("description")
      .eq("edition", PLEBISCYT.edition)
      .eq("member_id", voter.id);
    if (achievementError) throw achievementError;

    return res.status(200).json({
      me: { id: voter.id, name: voter.name },
      candidates: members.map((m) => ({ id: m.id, name: m.name })),
      votes: Object.fromEntries((votes || []).map((v) => [v.category, v.candidate_id])),
      achievement: achievements?.[0]?.description || "",
      closed: isPlebiscytClosed(),
    });
  } catch (e) {
    console.error("Plebiscyt state error:", e);
    return systemError(res);
  }
}
