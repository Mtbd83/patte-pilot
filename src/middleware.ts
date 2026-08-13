import { NextResponse, type NextRequest } from "next/server";

// The only domain PattePilot itself loads sub-resources from beyond its own
// origin: Supabase Storage (animal/organization photos, uploaded contract
// templates, generated documents — see src/lib/uploads.ts). Kept as a single
// source of truth since it appears in several CSP directives below.
const SUPABASE_ORIGIN = "https://wrmtfzpdyrmcilfqxtwi.supabase.co";

/**
 * No page embeds another origin, and nothing here is meant to be called
 * cross-origin by a browser (the cron endpoint is called server-to-server by
 * Vercel and is already gated by CRON_SECRET; the /api/test endpoints
 * self-disable outside dev). This allowlist exists so that decision is
 * explicit and easy to extend later rather than left implicit.
 */
const ALLOWED_ORIGINS = [process.env.NEXT_PUBLIC_APP_URL, "http://localhost:3000"].filter(
  (origin): origin is string => Boolean(origin),
);

function buildCspHeader(nonce: string) {
  // Next.js's dev-mode HMR wraps modules in eval() for fast incremental
  // rebuilds — real in `next build` output, so this never weakens
  // production. Without it, every page in `next dev` throws a CSP error.
  const scriptSrc = process.env.NODE_ENV === "development"
    ? `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;
  return [
    `default-src 'self'`,
    // 'strict-dynamic' is what modern browsers actually key off (a script
    // that runs with a valid nonce can load further scripts, which is how
    // Next.js's own chunk-loading works); 'self'/'nonce-…' remain as the
    // fallback for browsers that don't understand 'strict-dynamic' yet.
    `script-src ${scriptSrc}`,
    // Inline style ATTRIBUTES (style={{...}}), used in a few forms — a
    // nonce can't cover those, only 'unsafe-inline' can. Real <style>
    // tags/sheets are still 'self' (Tailwind's compiled CSS).
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' ${SUPABASE_ORIGIN}`,
    `font-src 'self'`,
    // The contract-field-mapper (Paramètres > Contrat) fetches the uploaded
    // PDF template client-side via pdf.js, from Supabase Storage.
    `connect-src 'self' ${SUPABASE_ORIGIN}`,
    // pdf.js's worker (public/pdf.worker.min.mjs), self-hosted.
    `worker-src 'self'`,
    // The adoption-contract PDF preview renders into an <iframe src="blob:…">.
    `frame-src 'self' blob:`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");
}

function applySecurityHeaders(response: NextResponse, nonce: string) {
  response.headers.set("Content-Security-Policy", buildCspHeader(nonce));
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload",
  );
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Nothing in the app uses the camera, microphone or geolocation —
  // disabled outright rather than left open (the boilerplate default of
  // geolocation=* would let ANY page loaded here, including embeds, ask
  // for the visitor's location, which we never want).
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // X-XSS-Protection is deliberately omitted: it's deprecated, ignored by
  // every current browser, and enabling it historically opened its own XSS
  // side-channel in older ones. The CSP above is what actually matters now.
  return response;
}

function applyCorsHeaders(response: NextResponse, origin: string | null) {
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.headers.set("Access-Control-Max-Age", "86400");
    response.headers.set("Vary", "Origin");
  }
  return response;
}

export function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, "");

  if (request.nextUrl.pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin");
    const response =
      request.method === "OPTIONS" ? new NextResponse(null, { status: 204 }) : NextResponse.next();
    return applyCorsHeaders(applySecurityHeaders(response, nonce), origin);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", buildCspHeader(nonce));

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  return applySecurityHeaders(response, nonce);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|sw.js|pdf.worker.min.mjs|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)",
  ],
};
