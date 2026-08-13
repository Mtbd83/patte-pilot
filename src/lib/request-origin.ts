import { headers } from "next/headers";

/**
 * The actual origin this request came in on (e.g. "https://pattepilot.fr"),
 * derived from the request itself rather than NEXT_PUBLIC_APP_URL — a
 * NEXT_PUBLIC_ variable gets baked in at build time, so if it's missing or
 * wrong in one environment (was the actual cause of invite links pointing
 * at localhost in production), every deployment built with it is wrong
 * until rebuilt. Reading the host header instead is always correct for
 * whatever domain actually served the request, previews included.
 */
export async function getRequestOrigin(): Promise<string> {
  try {
    const requestHeaders = await headers();
    const host = requestHeaders.get("host");
    if (host) {
      const proto = requestHeaders.get("x-forwarded-proto") ?? "https";
      return `${proto}://${host}`;
    }
  } catch {
    // Outside a real request scope (e.g. called directly from a test).
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
