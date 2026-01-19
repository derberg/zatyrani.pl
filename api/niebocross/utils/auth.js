import jwt from "jsonwebtoken";
import dotenv from 'dotenv';
dotenv.config({ path: './.env.production' });

export function verifyToken(req) {
  // Try to get token from header or cookie
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
    token = cookies.niebocross_session;
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
