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

// Results page: only members with can_view_plebiscyt.
export async function authorizeAdmin(req, supabase) {
  const session = await verifyUser(req);
  const { data: rows, error } = await supabase
    .from("members")
    .select("id, name, can_view_plebiscyt")
    .eq("id", session.memberId)
    .is("deleted_at", null)
    .limit(1);
  if (error) throw new Error("Lookup failed");
  const member = rows && rows[0];
  if (!member) throw new Error("Brak autoryzacji.");
  if (!member.can_view_plebiscyt) {
    const err = new Error("forbidden");
    err.status = 403;
    throw err;
  }
  return member;
}
