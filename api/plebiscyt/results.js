import { authorizeAdmin, getServiceClient, listActiveMembers, systemError } from "./_shared.js";
import { PLEBISCYT, isPlebiscytClosed } from "../../src/utils/plebiscyt.js";

const byName = (a, b) => a.name.localeCompare(b.name, "pl");

// Vote counts per category (who voted for whom stays hidden) and everyone's achievements.
export function summarize(entries, names) {
  const nameOf = (id) => names.get(id) || "(osoba usunięta z listy)";

  const categories = PLEBISCYT.categories.map(({ key, label }) => {
    const counts = new Map();
    for (const e of entries) {
      const id = e.votes?.[key];
      if (id) counts.set(id, (counts.get(id) || 0) + 1);
    }
    const results = [...counts]
      .map(([id, votes]) => ({ name: nameOf(id), votes }))
      .sort((a, b) => b.votes - a.votes || byName(a, b));
    const total = results.reduce((sum, r) => sum + r.votes, 0);
    return { key, label, total, results };
  });

  const achievements = entries
    .filter((e) => e.achievement)
    .map((e) => ({ name: nameOf(e.member_id), achievement: e.achievement }))
    .sort(byName);

  return { categories, achievements };
}

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

  try {
    await authorizeAdmin(req, supabase);
  } catch (e) {
    if (e.status === 403) {
      return res.status(403).json({ error: "Brak uprawnień." });
    }
    return res.status(401).json({ error: e.message || "Brak autoryzacji." });
  }

  try {
    const { data: entries, error: entriesError } = await supabase
      .from("plebiscyt_entries")
      .select("member_id, votes, achievement")
      .eq("edition", PLEBISCYT.edition);
    if (entriesError) throw entriesError;

    // Deleted members included, so a vote or text from someone removed later keeps its name.
    const { data: allMembers, error: membersError } = await supabase.from("members").select("id, name");
    if (membersError) throw membersError;

    const active = await listActiveMembers(supabase);
    const names = new Map((allMembers || []).map((m) => [m.id, m.name]));

    return res.status(200).json({
      ...summarize(entries || [], names),
      answered: (entries || []).length,
      members: active.length,
      closed: isPlebiscytClosed(),
    });
  } catch (e) {
    console.error("Plebiscyt results error:", e);
    return systemError(res);
  }
}
