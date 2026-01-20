export default async function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Clear the session cookies
  res.setHeader('Set-Cookie', [
    `niebocross_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
    `niebocross_auth_status=; Path=/; Secure; SameSite=Strict; Max-Age=0`
  ]);

  return res.status(200).json({
    success: true,
    message: "Wylogowano pomyślnie"
  });
}
