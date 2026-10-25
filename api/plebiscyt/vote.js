import { authorizeVoter, getServiceClient, listActiveMembers, systemError } from "./_shared.js";
import { ACHIEVEMENT_MAX_LENGTH, PLEBISCYT, isPlebiscytClosed } from "../../src/utils/plebiscyt.js";

// Body: { votes: { [categoryKey]: candidateId | "" }, achievement: string }.
// An empty candidate removes the vote in that category; an empty achievement removes it.
function validateInput(body, candidateIds) {
  const rawVotes = body.votes && typeof body.votes === "object" ? body.votes : {};
  const votes = {};
  for (const { key } of PLEBISCYT.categories) {
    const id = typeof rawVotes[key] === "string" ? rawVotes[key] : "";
    if (id && !candidateIds.has(id)) {
      return { error: "Wybranej osoby nie ma na liście. Odśwież stronę i wybierz ponownie." };
    }
    votes[key] = id;
  }

  const achievement = typeof body.achievement === "string" ? body.achievement.trim() : "";
  if (achievement.length > ACHIEVEMENT_MAX_LENGTH) {
    return { error: `Opis może mieć maksymalnie ${ACHIEVEMENT_MAX_LENGTH} znaków.` };
  }

  if (!achievement && Object.values(votes).every((id) => !id)) {
    return { error: "Wybierz osobę albo opisz swoje osiągnięcie." };
  }
  return { votes, achievement };
}

export default async function handler(req, res) {
  if (req.method !== "PUT") {
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

  if (isPlebiscytClosed()) {
    return res.status(403).json({ error: "Głosowanie jest już zamknięte." });
  }

  try {
    const members = await listActiveMembers(supabase);
    const input = validateInput(req.body || {}, new Set(members.map((m) => m.id)));
    if (input.error) return res.status(400).json({ error: input.error });

    const now = new Date().toISOString();
    const { edition } = PLEBISCYT;

    for (const [category, candidateId] of Object.entries(input.votes)) {
      if (candidateId) {
        const { error } = await supabase
          .from("plebiscyt_votes")
          .upsert(
            { edition, category, voter_id: voter.id, candidate_id: candidateId, updated_at: now },
            { onConflict: "edition,category,voter_id" }
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("plebiscyt_votes")
          .delete()
          .eq("edition", edition)
          .eq("category", category)
          .eq("voter_id", voter.id);
        if (error) throw error;
      }
    }

    if (input.achievement) {
      const { error } = await supabase
        .from("plebiscyt_achievements")
        .upsert(
          { edition, member_id: voter.id, description: input.achievement, updated_at: now },
          { onConflict: "edition,member_id" }
        );
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("plebiscyt_achievements")
        .delete()
        .eq("edition", edition)
        .eq("member_id", voter.id);
      if (error) throw error;
    }

    console.log(`[plebiscyt] saved by ${voter.name} (${voter.id})`);
    return res.status(200).json({ votes: input.votes, achievement: input.achievement });
  } catch (e) {
    console.error("Plebiscyt vote error:", e);
    return systemError(res);
  }
}
