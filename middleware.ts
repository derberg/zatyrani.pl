import { verifyUser } from './src/utils/auth.js';

export default async function middleware(request) {
  const url = new URL(request.url);
  const { pathname } = url;

  const protectedPaths = [
    '/wydarzenia-dodaj',
    '/trening-dodaj',
    '/wydarzenia-edytuj/',
    '/trening-edytuj/',
  ];

  if (protectedPaths.some(path => pathname.startsWith(path))) {
    try {
      const req = {
        headers: {
          cookie: request.headers.get('cookie') || '',
        },
      };
      await verifyUser(req);
    } catch (error) {
      console.error('Middleware auth failure:', error);
      const redirectUrl = new URL('/', url);
      redirectUrl.searchParams.set('access_denied', 'true');
      return new Response(null, {
        status: 302,
        headers: {
          Location: redirectUrl.toString(),
        },
      });
    }
  }

  return new Response(null, { status: 200 });
}

export const config = {
  matcher: [
    '/wydarzenia-dodaj/:path*',
    '/trening-dodaj/:path*',
    '/wydarzenia-edytuj/:path*',
    '/trening-edytuj/:path*',
  ],
};
