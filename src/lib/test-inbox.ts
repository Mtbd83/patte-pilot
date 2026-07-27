/**
 * In-memory mail sink used only in the E2E test environment. Lets
 * /api/test/inbox hand back the last email sent to a given address instead
 * of actually going through SMTP.
 *
 * Enabled either via ENABLE_TEST_MAIL_SINK=true at process start (when
 * Playwright launches the dev server itself), or at runtime via
 * POST /api/test/enable-mail-sink (when e2e/global-setup.ts finds a dev
 * server already running — e.g. one left open in another terminal — and
 * can't control the env it started with).
 */
export interface SentTestEmail {
  to: string;
  subject: string;
  html: string;
  sentAt: Date;
}

const globalForInbox = globalThis as unknown as {
  testEmailInbox?: SentTestEmail[];
  testMailSinkEnabled?: boolean;
};
const inbox = (globalForInbox.testEmailInbox ??= []);

export function isTestMailSinkEnabled() {
  return process.env.ENABLE_TEST_MAIL_SINK === "true" || globalForInbox.testMailSinkEnabled === true;
}

export function enableTestMailSink() {
  globalForInbox.testMailSinkEnabled = true;
}

export function recordTestEmail(email: SentTestEmail) {
  inbox.push(email);
}

export function findLastTestEmailTo(to: string): SentTestEmail | undefined {
  const normalized = to.toLowerCase().trim();
  for (let i = inbox.length - 1; i >= 0; i -= 1) {
    if (inbox[i]?.to.toLowerCase().trim() === normalized) return inbox[i];
  }
  return undefined;
}
