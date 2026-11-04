import { authorizeVoter, getServiceClient, listActiveMembers, systemError } from "./_shared.js";
import { ACHIEVEMENT_MAX_LENGTH, PLEBISCYT, isPlebiscytClosed } from "../../src/utils/plebiscyt.js";

// Body: { votes: { [categoryKey]: candidateId | "abstain" }, achievement: string, gala: string }.
// Every category needs a vote or an abstention, and the gala answer is required.
// The achievement is optional.
function validateInput(body, candidateIds) {
  const rawVotes = body.votes && typeof body.votes === "object" ? body.votes : {};
  const votes = {};
  for (const { key, label } of PLEBISCYT.categories) {
    const id = typeof rawVotes[key] === "string" ? rawVotes[key] : "";
    if (!id) {
      return { error: `Wybierz osobę w kategorii „${label}”.` };
    }
    if (id !== PLEBISCYT.abstain.key && !candidateIds.has(id)) {
      return { error: "Wybranej osoby nie ma na liście. Odśwież stronę i wybierz ponownie." };
    }
    votes[key] = id;
  }

  const achievement = typeof body.achievement === "string" ? body.achievement.trim() : "";
  if (achievement.length > ACHIEVEMENT_MAX_LENGTH) {
    return { error: `Opis może mieć maksymalnie ${ACHIEVEMENT_MAX_LENGTH} znaków.` };
  }

  const gala = typeof body.gala === "string" ? body.gala : "";
  if (!PLEBISCYT.gala.options.some((o) => o.key === gala)) {
    return { error: "Zaznacz, czy będziesz na Gali Zatyranych." };
  }
  return { votes, achievement, gala };
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

    const { votes } = input;
    const { error } = await supabase.from("plebiscyt_entries").upsert(
      {
        edition: PLEBISCYT.edition,
        member_id: voter.id,
        votes,
        achievement: input.achievement || null,
        gala: input.gala,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "edition,member_id" }
    );
    if (error) throw error;

    console.log(`[plebiscyt] saved by ${voter.name} (${voter.id})`);
    return res.status(200).json({ votes, achievement: input.achievement, gala: input.gala });
  } catch (e) {
    console.error("Plebiscyt vote error:", e);
    return systemError(res);
  }
}
