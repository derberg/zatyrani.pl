/**
 * Set CORS headers on a response.
 * In production: restrict to zatyrani.pl
 * In development/preview: allow all origins for local testing
 */
export function setCorsHeaders(res) {
  const origin = process.env.VERCEL_ENV === 'production'
    ? 'https://zatyrani.pl'
    : '*';
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version");
}
