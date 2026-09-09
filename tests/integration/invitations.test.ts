/**
 * Integration test for the invitation flow: an admin invites someone,
 * that person accepts, and ends up with the granted roles.
 *
 * Runs against a real (test) Postgres database — point DATABASE_URL at a
 * disposable test DB before running (e.g. via docker-compose.test.yml).
 * Nodemailer is mocked so no real email is sent.
 */
jest.mock("@/lib/mailer", () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
  invitationEmailHtml: jest.fn().mockReturnValue("<p>mock</p>"),
  organizationSmtpConfig: jest.fn().mockReturnValue({ user: "mock@example.com", appPassword: "mock" }),
}));

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));

import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { sendEmail } from "@/lib/mailer";
import { db } from "@/db";
import { users, organizations, organizationMembers, organizationMemberRoles, invitations } from "@/db/schema";
import { createInvitation, acceptInvitation, resendInvitation, deleteInvitation } from "@/server/actions/invitations";
import { getMemberRoles } from "@/lib/permissions";
import { ForbiddenError } from "@/lib/permissions";

const authMock = auth as unknown as jest.Mock;

describe("invitation flow", () => {
  let adminUserId: string;
  let inviteeUserId: string;
  let organizationId: string;

  beforeAll(async () => {
    const [admin] = await db
      .insert(users)
      .values({ email: "admin@example.com" })
      .returning();
    const [invitee] = await db
      .insert(users)
      .values({ email: "future-benevole@example.com" })
      .returning();
    if (!admin || !invitee) throw new Error("Seed setup failed: users not created.");
    adminUserId = admin.id;
    inviteeUserId = invitee.id;

    const [org] = await db
      .insert(organizations)
      .values({ name: "Asso Test", slug: "asso-test" })
      .returning();
    if (!org) throw new Error("Seed setup failed: organization not created.");
    organizationId = org.id;

    // Seed the admin as an actual org member with the admin role, using the
    // real creation action so the schema/relations are exercised end to end.
    authMock.mockResolvedValue({ user: { id: adminUserId, email: admin.email } });
    const { organizationMembers, organizationMemberRoles } = await import("@/db/schema");
    const [member] = await db
      .insert(organizationMembers)
      .values({ organizationId, userId: adminUserId })
      .returning();
    if (!member) throw new Error("Seed setup failed: member not created.");
    await db.insert(organizationMemberRoles).values({ memberId: member.id, role: "admin" });
  });

  it("lets an admin invite someone, who then accepts with the granted roles", async () => {
    authMock.mockResolvedValue({ user: { id: adminUserId, email: "admin@example.com" } });

    const invitation = await createInvitation({
      organizationId,
      email: "future-benevole@example.com",
      roles: ["benevole", "famille_accueil"],
    });

    expect(invitation.status).toBe("pending");

    authMock.mockResolvedValue({
      user: { id: inviteeUserId, email: "future-benevole@example.com" },
    });

    const result = await acceptInvitation({ token: invitation.token });
    expect(result.organizationId).toBe(organizationId);

    const roles = await getMemberRoles(inviteeUserId, organizationId);
    expect(roles.sort()).toEqual(["benevole", "famille_accueil"].sort());
  });

  it("rejects acceptance when the logged-in email doesn't match the invitation", async () => {
    authMock.mockResolvedValue({ user: { id: adminUserId, email: "admin@example.com" } });
    const invitation = await createInvitation({
      organizationId,
      email: "someone-else@example.com",
      roles: ["benevole"],
    });

    authMock.mockResolvedValue({
      user: { id: inviteeUserId, email: "future-benevole@example.com" },
    });

    await expect(acceptInvitation({ token: invitation.token })).rejects.toThrow(
      /autre adresse email/,
    );
  });
});

const sendEmailMock = sendEmail as unknown as jest.Mock;

// Isolated from the describe block above (which reuses the real
// admin@example.com/"Asso Test" dev fixture and must never be touched) —
// its own uniquely-suffixed org/users, safe to seed and tear down freely.
describe("invitation management", () => {
  let organizationId: string;
  let adminUserId: string;
  let outsiderUserId: string;

  beforeAll(async () => {
    const suffix = randomUUID().slice(0, 8);

    const [admin] = await db.insert(users).values({ email: `invite-admin-${suffix}@example.com` }).returning();
    const [outsider] = await db.insert(users).values({ email: `invite-outsider-${suffix}@example.com` }).returning();
    if (!admin || !outsider) throw new Error("Seed setup failed: users not created.");
    adminUserId = admin.id;
    outsiderUserId = outsider.id;

    const [org] = await db
      .insert(organizations)
      .values({ name: `Test Invitations ${suffix}`, slug: `test-invitations-${suffix}` })
      .returning();
    if (!org) throw new Error("Seed setup failed: organization not created.");
    organizationId = org.id;

    const [member] = await db.insert(organizationMembers).values({ organizationId, userId: adminUserId }).returning();
    if (!member) throw new Error("Seed setup failed: member not created.");
    await db.insert(organizationMemberRoles).values({ memberId: member.id, role: "admin" });
  });

  afterAll(async () => {
    await db.delete(organizations).where(eq(organizations.id, organizationId));
    await db.delete(users).where(eq(users.id, adminUserId));
    await db.delete(users).where(eq(users.id, outsiderUserId));
  });

  beforeEach(() => {
    sendEmailMock.mockClear();
    authMock.mockResolvedValue({ user: { id: adminUserId } });
  });

  it("never creates an invitation row when the email fails to send", async () => {
    const email = `send-fails-${randomUUID().slice(0, 8)}@example.com`;
    sendEmailMock.mockRejectedValueOnce(new Error("Configurez une adresse email d'envoi avant d'envoyer des emails."));

    await expect(createInvitation({ organizationId, email, roles: ["benevole"] })).rejects.toThrow(
      /adresse email d'envoi/,
    );

    const row = await db.query.invitations.findFirst({ where: eq(invitations.email, email) });
    expect(row).toBeUndefined();
  });

  it("rejects inviting an email that already has a pending invitation for this organization", async () => {
    const email = `duplicate-${randomUUID().slice(0, 8)}@example.com`;
    await createInvitation({ organizationId, email, roles: ["benevole"] });

    await expect(createInvitation({ organizationId, email, roles: ["admin"] })).rejects.toThrow(
      /déjà en attente/,
    );
  });

  it("resends an invitation, extending its expiry, but rejects a non-admin", async () => {
    const email = `resend-${randomUUID().slice(0, 8)}@example.com`;
    const invitation = await createInvitation({ organizationId, email, roles: ["benevole"] });
    sendEmailMock.mockClear();

    authMock.mockResolvedValue({ user: { id: outsiderUserId } });
    await expect(
      resendInvitation({ organizationId, invitationId: invitation.id }),
    ).rejects.toThrow(ForbiddenError);

    authMock.mockResolvedValue({ user: { id: adminUserId } });
    const updated = await resendInvitation({ organizationId, invitationId: invitation.id });

    expect(updated.expiresAt.getTime()).toBeGreaterThan(invitation.expiresAt.getTime());
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock.mock.calls[0][0].to).toBe(email);
  });

  it("never extends the expiry when the resend email fails to send", async () => {
    const email = `resend-fails-${randomUUID().slice(0, 8)}@example.com`;
    const invitation = await createInvitation({ organizationId, email, roles: ["benevole"] });
    sendEmailMock.mockRejectedValueOnce(new Error("Panne SMTP"));

    await expect(resendInvitation({ organizationId, invitationId: invitation.id })).rejects.toThrow(
      "Panne SMTP",
    );

    const row = await db.query.invitations.findFirst({ where: eq(invitations.id, invitation.id) });
    expect(row!.expiresAt.getTime()).toBe(invitation.expiresAt.getTime());
  });

  it("deletes a pending invitation, but rejects a non-admin", async () => {
    const email = `delete-${randomUUID().slice(0, 8)}@example.com`;
    const invitation = await createInvitation({ organizationId, email, roles: ["benevole"] });

    authMock.mockResolvedValue({ user: { id: outsiderUserId } });
    await expect(deleteInvitation({ organizationId, invitationId: invitation.id })).rejects.toThrow(
      ForbiddenError,
    );

    authMock.mockResolvedValue({ user: { id: adminUserId } });
    await deleteInvitation({ organizationId, invitationId: invitation.id });

    const gone = await db.query.invitations.findFirst({ where: eq(invitations.id, invitation.id) });
    expect(gone).toBeUndefined();
  });
});
