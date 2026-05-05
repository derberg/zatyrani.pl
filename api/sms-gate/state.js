import {
  authorizeSender,
  getBudget,
  getServiceClient,
  getUsedSegments,
  systemError,
} from "./_shared.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let supabase;
  try {
    supabase = getServiceClient();
  } catch (e) {
    console.error("SMS gate config error:", e);
    return systemError(res);
  }

  try {
    await authorizeSender(req, supabase);
  } catch (e) {
    if (e.status === 403) {
      return res.status(403).json({ error: "Brak uprawnień." });
    }
    return res.status(401).json({ error: e.message || "Brak autoryzacji." });
  }

  try {
    const total = getBudget();
    const used = await getUsedSegments(supabase);
    const remaining = Math.max(0, total - used);

    const { data: members, error: membersError } = await supabase
      .from("members")
      .select("id, name, phone")
      .order("name", { ascending: true });

    if (membersError) {
      console.error("Members lookup error:", membersError);
      return systemError(res);
    }

    const seenPhones = new Set();
    const unique = [];
    for (const m of members || []) {
      const phone = (m.phone || "").trim();
      if (!phone) continue;
      if (seenPhones.has(phone)) continue;
      seenPhones.add(phone);
      unique.push({ id: m.id, name: m.name, phone });
    }

    return res.status(200).json({
      budget: { total, used, remaining },
      members: unique,
    });
  } catch (e) {
    console.error("State endpoint error:", e);
    return systemError(res);
  }
}
