import { headers } from "next/headers";

/**
 * Best-effort client IP for rate-limiting public, unauthenticated
 * submissions (adoption applications, stray-cat reports/comments). Returns
 * null outside a real request scope (e.g. called directly from a test) or
 * behind a proxy that sets neither header — callers should simply skip
 * rate-limiting in that case rather than fail the call.
 */
export async function getClientIp() {
  try {
    const requestHeaders = await headers();
    const forwardedFor = requestHeaders.get("x-forwarded-for");
    return forwardedFor?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || null;
  } catch {
    return null;
  }
}
