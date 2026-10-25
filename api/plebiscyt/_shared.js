import { verifyUser } from "../../src/utils/auth.js";

export { getServiceClient, listActiveMembers, systemError } from "../sms-gate/_shared.js";

// Any logged-in, non-deleted member can vote (no can_send_sms check, unlike /sms).
export async function authorizeVoter(req, supabase) {
  const session = await verifyUser(req);
  const { data: rows, error } = await supabase
    .from("members")
    .select("id, name")
    .eq("id", session.memberId)
    .is("deleted_at", null)
    .limit(1);
  if (error) throw new Error("Lookup failed");
  const member = rows && rows[0];
  if (!member) throw new Error("Brak autoryzacji.");
  return member;
}
