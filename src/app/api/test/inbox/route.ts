import { NextResponse } from "next/server";
import { findLastTestEmailTo, isTestMailSinkEnabled } from "@/lib/test-inbox";

/**
 * Test-only endpoint that exposes the last email sent to a given address.
 * Only responds when ENABLE_TEST_MAIL_SINK=true — never mounted in prod.
 */
export async function GET(request: Request) {
  if (!isTestMailSinkEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const to = new URL(request.url).searchParams.get("to");
  if (!to) {
    return NextResponse.json({ error: "Missing 'to' query parameter." }, { status: 400 });
  }

  const email = findLastTestEmailTo(to);
  if (!email) {
    return NextResponse.json({ error: "No email found for this recipient." }, { status: 404 });
  }

  const acceptUrl = email.html.match(/href="([^"]+)"/)?.[1] ?? null;

  return NextResponse.json({ to: email.to, subject: email.subject, acceptUrl });
}
