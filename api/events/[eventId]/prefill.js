import { verifyToken } from "../../shared/auth.js";
import { getSupabaseClient } from "../../shared/supabase.js";
import { mapParticipantForPrefill } from "../../shared/database-operations.js";
import { getEventConfig } from "../config.js";
import { setCorsHeaders } from "../../shared/cors.js";

/**
 * Return the prefill source event's participants for the JWT-verified email, so a
 * not-logged-in user (state C) who has just verified a code can have their form
 * prefilled. Gated by this event's JWT — personal data only reaches the verified
 * owner of the email. Returns recognized:false (empty) when the email is unknown
 * in the source event (a newcomer) or prefill is not configured.
 */
export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  let eventConfig;
  try {
    eventConfig = getEventConfig(req.query.eventId);
  } catch {
    return res.status(404).json({ success: false, error: "Nieznane wydarzenie" });
  }

  // Auth required: only the verified email owner can read prefill data.
  const authResult = verifyToken(req, eventConfig);
  if (authResult.error) {
    return res.status(authResult.status).json({ success: false, error: authResult.error });
  }

  if (!eventConfig.prefillSourceEventId) {
    return res.status(200).json({ success: true, recognized: false, participants: [] });
  }

  try {
    const supabase = getSupabaseClient();
    const email = authResult.email.toLowerCase();

    const { data: sourceReg } = await supabase
      .from("event_registrations")
      .select("id, contact_person")
      .eq("event_id", eventConfig.prefillSourceEventId)
      .eq("email", email)
      .single();

    if (!sourceReg) {
      return res.status(200).json({ success: true, recognized: false, participants: [] });
    }

    const { data: participants } = await supabase
      .from("event_participants")
      .select("*")
      .eq("registration_id", sourceReg.id)
      .order("created_at", { ascending: true });

    return res.status(200).json({
      success: true,
      recognized: true,
      contactPerson: sourceReg.contact_person,
      participants: (participants || []).map(mapParticipantForPrefill)
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return res.status(500).json({ success: false, error: "UNEXPECTED_ERROR" });
  }
}
