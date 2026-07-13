import { NextRequest, NextResponse } from 'next/server';

// Per-request CSP nonce for the configure pages.
//
// Next.js App Router injects inline `self.__next_f.push(...)` flight scripts
// into the HTML. A strict `script-src 'self'` (no 'unsafe-inline', no nonce)
// blocks them, so React never hydrates and the configure UI is non-interactive
// (dead buttons, panels that never load). Next.js auto-stamps this nonce on
// all its inline scripts during SSR by extracting `nonce-{value}` from the
// request's CSP header, so script-src stays strict without 'unsafe-inline'.
//
// Nonce injection requires dynamic rendering; app/configure/page.tsx opts in
// via `export const dynamic = 'force-dynamic'`. createExpressApp.ts skips its
// own CSP on /configure so the nonce'd CSP here isn't double-set (two CSP
// headers are ANDed, which would re-block the inline scripts).
export function proxy(request: NextRequest) {
  // 128-bit nonce (spec-recommended minimum before base64). getRandomValues
  // is Web Crypto (available in the proxy's Node runtime); Buffer base64-encodes.
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "media-src 'self' https:",
    "form-action 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    'frame-ancestors https://web.stremio.com https://app.stremio.com https://stremio.com',
  ].join('; ');

  // Next.js reads `nonce-<value>` from the request CSP header and stamps it on
  // all inline `__next_f` scripts during SSR.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('Content-Security-Policy', csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('Content-Security-Policy', csp);
  // /configure/install SSRs install URLs that embed debrid API keys; never let
  // a shared cache store a nonce'd (or key-bearing) response.
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
}

export const config = {
  matcher: ['/configure', '/configure/install'],
};