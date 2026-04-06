import { getEventConfig } from "../config.js";
import { getCurrentFees } from "../../shared/participant-validation.js";
import { setCorsHeaders } from "../../shared/cors.js";

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    let eventConfig;
    try {
      eventConfig = getEventConfig(req.query.eventId);
    } catch {
      return res.status(404).json({ success: false, error: "Nieznane wydarzenie" });
    }

    const fees = getCurrentFees(eventConfig);

    return res.status(200).json({
      success: true,
      fees,
      tshirtPrice: eventConfig.tshirtPrice || 0,
      tshirtEnabled: eventConfig.tshirtEnabled || false,
      feeSchedule: eventConfig.feeSchedule || null
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return res.status(500).json({
      success: false,
      error: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie."
    });
  }
}
