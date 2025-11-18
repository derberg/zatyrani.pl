import { verifyUser } from './src/utils/auth.js';

export default async function middleware(request) {
  const url = new URL(request.url);
  console.log('log1', url);
  const { pathname } = url;
  console.log('log2', pathname);

  const protectedPaths = [
    '/wydarzenia-dodaj',
    '/trening-dodaj',
    '/wydarzenia-edytuj/',
    '/trening-edytuj/',
  ];

  if (protectedPaths.some(path => pathname.startsWith(path))) {
    try {
        console.log('log3', request.headers.get('cookie'));
      const req = {
        headers: {
          cookie: request.headers.get('cookie') || '',
        },
      };
      await verifyUser(req);
    } catch {
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
  console.log('ciebie tu nie powinno być');
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
