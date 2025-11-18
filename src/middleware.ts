import { defineMiddleware } from 'astro:middleware';
import { verifyUser } from './utils/auth.js';

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, redirect } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  const protectedPaths = [
    '/wydarzenia-dodaj',
    '/trening-dodaj',
    '/wydarzenia-edytuj/',
    '/trening-edytuj/',
  ];

  if (protectedPaths.some(path => pathname.startsWith(path))) {
    const cookieHeader = request.headers.get('cookie');

    try {
      await verifyUser({ headers: { cookie: cookieHeader || '' } });
    } catch {
      return redirect('/?access_denied=true');
    }
  }

  return next();
});
