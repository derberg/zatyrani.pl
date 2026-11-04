import {
  authorizeSender,
  getBudget,
  getServiceClient,
  getUsedSegments,
  listActiveMembers,
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

  let sender;
  try {
    sender = await authorizeSender(req, supabase);
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

    const members = await listActiveMembers(supabase);

    return res.status(200).json({
      budget: { total, used, remaining },
      members,
      meId: sender.id,
    });
  } catch (e) {
    console.error("State endpoint error:", e);
    return systemError(res);
  }
}
