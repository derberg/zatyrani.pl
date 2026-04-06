import jwt from "jsonwebtoken";

/**
 * Verify JWT token from request.
 * Reads cookie named `{eventConfig.cookiePrefix}_session`.
 *
 * @param {Object} req - HTTP request
 * @param {Object} eventConfig - Event config from api/events/config.js
 * @returns {{ registration_id, email } | { error, status }}
 */
export function verifyToken(req, eventConfig) {
  const cookieName = `${eventConfig.cookiePrefix}_session`;
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.headers.cookie) {
    const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {});
    token = cookies[cookieName];
  }

  if (!token) {
    return { error: "Brak tokenu autoryzacji", status: 401 };
  }

  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (!jwtSecret) {
    return { error: "Konfiguracja serwera nieprawidłowa", status: 500 };
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    return { registration_id: decoded.registration_id, email: decoded.email };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return { error: "Sesja wygasła. Zaloguj się ponownie.", status: 401 };
    }
    return { error: "Nieprawidłowy token", status: 401 };
  }
}
