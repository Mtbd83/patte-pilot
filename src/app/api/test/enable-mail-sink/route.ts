import { NextResponse } from "next/server";
import { enableTestMailSink } from "@/lib/test-inbox";

/**
 * Test-only: flips the in-memory mail sink on for the currently running
 * dev server process, regardless of how it was started (e.g. a dev server
 * left running from another terminal, which Playwright's reuseExistingServer
 * would otherwise reuse as-is without ENABLE_TEST_MAIL_SINK). Never usable
 * in a production build.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  enableTestMailSink();
  return NextResponse.json({ ok: true });
}
