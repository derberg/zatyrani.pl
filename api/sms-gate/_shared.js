import { createClient } from "@supabase/supabase-js";
import { verifyUser } from "../../src/utils/auth.js";

export const DEFAULT_BUDGET = 1100;

export function getServiceClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("SMS gate requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(url, serviceKey);
}

export function getBudget() {
  const raw = process.env.SMS_GATE_BUDGET;
  if (!raw) return DEFAULT_BUDGET;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_BUDGET;
}

export function systemError(res) {
  return res.status(500).json({
    error:
      "Coś nie tak z systemem. Spróbuj znowy za pare minut. Jak problem nadal się powtarza to napisz do Łysego",
  });
}

export async function authorizeSender(req, supabase) {
  const session = await verifyUser(req);
  const { data: rows, error } = await supabase
    .from("members")
    .select("id, name, can_send_sms")
    .eq("id", session.memberId)
    .limit(1);
  if (error) throw new Error("Lookup failed");
  const member = rows && rows[0];
  if (!member || !member.can_send_sms) {
    const err = new Error("forbidden");
    err.status = 403;
    throw err;
  }
  return member;
}

export async function getUsedSegments(supabase) {
  const { data, error } = await supabase
    .from("sms_gate_usage")
    .select("segments")
    .eq("status", "sent");
  if (error) throw new Error("Usage lookup failed");
  return (data || []).reduce((sum, row) => sum + (row.segments || 0), 0);
}
