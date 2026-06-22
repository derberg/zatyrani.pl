import jwt from "jsonwebtoken";
import { verifyToken } from "../../../shared/auth.js";
import { getSupabaseClient } from "../../../shared/supabase.js";
import { isRegistrationOpen } from "../../../shared/participant-validation.js";
import { getEventCapacity, mapParticipantForPrefill } from "../../../shared/database-operations.js";
import { getEventConfig } from "../../config.js";
import { setCorsHeaders } from "../../../shared/cors.js";

/**
 * Recognise a user who is logged in to the prefill source event (e.g.
 * wilczypolmaraton-2026) and let them register for this event with no extra
 * verification code. Verifies the source session cookie, upserts a registration
 * for this event, mints this event's JWT, and returns the source participants so
 * the form can be prefilled.
 *
 * Only enabled when the event config sets `prefillSourceEventId`.
 */
export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let eventConfig;
  try {
    eventConfig = getEventConfig(req.query.eventId);
  } catch {
    return res.status(404).json({ success: false, error: "Nieznane wydarzenie" });
  }

  if (!eventConfig.prefillSourceEventId) {
    return res.status(400).json({ success: false, error: "PREFILL_NOT_ENABLED" });
  }

  let sourceConfig;
  try {
    sourceConfig = getEventConfig(eventConfig.prefillSourceEventId);
  } catch {
    return res.status(500).json({ success: false, error: "SOURCE_EVENT_MISCONFIGURED" });
  }

  // Must hold a valid session for the source event.
  const sourceAuth = verifyToken(req, sourceConfig);
  if (sourceAuth.error) {
    return res.status(401).json({ success: false, error: "NOT_LOGGED_IN" });
  }

  if (!isRegistrationOpen(eventConfig)) {
    return res.status(400).json({ success: false, error: "REGISTRATION_CLOSED" });
  }

  try {
    const supabase = getSupabaseClient();

    if (eventConfig.enforceTotalLimit) {
      const capacity = await getEventCapacity(supabase, eventConfig);
      if (capacity.available <= 0) {
        return res.status(400).json({ success: false, error: "EVENT_FULL" });
      }
    }

    // Load the source registration tied to the verified session.
    const { data: sourceReg, error: sourceRegErr } = await supabase
      .from("event_registrations")
      .select("id, email, contact_person")
      .eq("event_id", sourceConfig.id)
      .eq("id", sourceAuth.registration_id)
      .single();

    if (sourceRegErr || !sourceReg) {
      return res.status(404).json({ success: false, error: "SOURCE_REGISTRATION_NOT_FOUND" });
    }

    const email = sourceReg.email.toLowerCase();

    // Upsert this event's registration for the same email (idempotent).
    let { data: targetReg } = await supabase
      .from("event_registrations")
      .select("id, email, contact_person")
      .eq("event_id", eventConfig.id)
      .eq("email", email)
      .single();

    if (!targetReg) {
      const { data: created, error: createErr } = await supabase
        .from("event_registrations")
        .insert({ event_id: eventConfig.id, email, contact_person: sourceReg.contact_person })
        .select()
        .single();

      if (created) {
        targetReg = created;
      } else if (createErr && createErr.code === "23505") {
        // Concurrent create — re-read the existing row.
        const { data: refetched } = await supabase
          .from("event_registrations")
          .select("id, email, contact_person")
          .eq("event_id", eventConfig.id)
          .eq("email", email)
          .single();
        targetReg = refetched;
      } else {
        console.error("Error creating registration:", createErr);
        return res.status(500).json({ success: false, error: "DB_ERROR" });
      }
    }

    if (!targetReg) {
      return res.status(500).json({ success: false, error: "DB_ERROR" });
    }

    // Mint this event's session token (same shape and cookies as verify-code.js).
    const jwtSecret = process.env.SUPABASE_JWT_SECRET;
    if (!jwtSecret) {
      console.error("SUPABASE_JWT_SECRET not configured");
      return res.status(500).json({ success: false, error: "SERVER_CONFIG_ERROR" });
    }

    const sessionToken = jwt.sign(
      { registration_id: targetReg.id, email: targetReg.email },
      jwtSecret,
      { expiresIn: "180d" }
    );

    res.setHeader("Set-Cookie", [
      `${eventConfig.cookiePrefix}_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${180 * 24 * 60 * 60}`,
      `${eventConfig.cookiePrefix}_auth_status=true; Path=/; Secure; SameSite=Strict; Max-Age=${180 * 24 * 60 * 60}`
    ]);

    // Source participants for prefill.
    const { data: srcParticipants } = await supabase
      .from("event_participants")
      .select("*")
      .eq("registration_id", sourceReg.id)
      .order("created_at", { ascending: true });

    return res.status(200).json({
      success: true,
      recognized: true,
      contactPerson: sourceReg.contact_person,
      email: targetReg.email,
      participants: (srcParticipants || []).map(mapParticipantForPrefill)
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return res.status(500).json({ success: false, error: "UNEXPECTED_ERROR" });
  }
}
