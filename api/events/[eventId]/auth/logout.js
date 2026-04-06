import { getEventConfig } from '../../config.js';
import { setCorsHeaders } from '../../../shared/cors.js';

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let eventConfig;
  try {
    eventConfig = getEventConfig(req.query.eventId);
  } catch {
    return res.status(404).json({ success: false, error: "Event not found" });
  }

  // Clear the session cookies
  res.setHeader('Set-Cookie', [
    `${eventConfig.cookiePrefix}_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
    `${eventConfig.cookiePrefix}_auth_status=; Path=/; Secure; SameSite=Strict; Max-Age=0`
  ]);

  return res.status(200).json({
    success: true,
    message: "Wylogowano pomyślnie"
  });
}
