/**
 * Integration tests for the platform-manager server actions (signup
 * requests, org creation/edit/delete), run against a real (test) Postgres
 * database. Nodemailer is mocked so no real email is sent.
 */
jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));
jest.mock("@/lib/mailer", () => ({
  ...jest.requireActual("@/lib/mailer"),
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { sendEmail } from "@/lib/mailer";
import { db } from "@/db";
import {
  users,
  organizations,
  invitations,
  organizationMembers,
  organizationMemberRoles,
  organizationMemberPermissions,
  animals,
  adoptionApplications,
  sterilizationCampaigns,
} from "@/db/schema";
import {
  submitOrganizationSignupRequest,
  listOrganizationSignupRequests,
  listOrganizationsForPlatformManager,
  approveOrganizationSignupRequest,
  rejectOrganizationSignupRequest,
  createOrganizationAsPlatformManager,
  updateOrganizationIdentity,
  deleteOrganizationAsPlatformManager,
  getOrganizationDetailForPlatformManager,
  resendInvitation,
  deleteInvitationAsPlatformManager,
} from "@/server/actions/platform";
import { ForbiddenError } from "@/lib/permissions";

const authMock = auth as unknown as jest.Mock;
const sendEmailMock = sendEmail as unknown as jest.Mock;

describe("platform manager server actions", () => {
  let managerId: string;
  let outsiderId: string;

  beforeAll(async () => {
    const suffix = randomUUID().slice(0, 8);
    const [manager] = await db
      .insert(users)
      .values({ email: `manager-${suffix}@example.com`, isPlatformManager: true })
      .returning();
    const [outsider] = await db
      .insert(users)
      .values({ email: `outsider-plat-${suffix}@example.com` })
      .returning();
    if (!manager || !outsider) throw new Error("Seed setup failed.");
    managerId = manager.id;
    outsiderId = outsider.id;
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.id, managerId));
    await db.delete(users).where(eq(users.id, outsiderId));
  });

  beforeEach(() => {
    sendEmailMock.mockClear();
  });

  it("accepts a public signup request with no session at all", async () => {
    authMock.mockResolvedValue(null);
    const request = await submitOrganizationSignupRequest({
      organizationName: `Les Amis des Bêtes ${randomUUID().slice(0, 8)}`,
      contactName: "Jeanne Dupont",
      contactEmail: `jeanne-${randomUUID().slice(0, 8)}@example.com`,
    });
    if (!request) throw new Error("Expected a real request, not a honeypot no-op.");
    expect(request.status).toBe("en_attente");
  });

  it("silently no-ops when the honeypot field is filled in", async () => {
    authMock.mockResolvedValue(null);
    const result = await submitOrganizationSignupRequest({
      organizationName: "Bot Org",
      contactName: "Bot",
      contactEmail: "bot@example.com",
      honeypot: "https://spam.example",
    });
    expect(result).toBeNull();
  });

  it("rejects a non-manager from listing requests or organizations", async () => {
    authMock.mockResolvedValue({ user: { id: outsiderId } });
    await expect(listOrganizationSignupRequests({})).rejects.toThrow(ForbiddenError);
    await expect(listOrganizationsForPlatformManager()).rejects.toThrow(ForbiddenError);
  });

  it("approves a request: creates the org, sends an admin invite, marks the request approved", async () => {
    const suffix = randomUUID().slice(0, 8);
    const contactEmail = `contact-${suffix}@example.com`;

    authMock.mockResolvedValue(null);
    const request = await submitOrganizationSignupRequest({
      organizationName: `Refuge du Var ${suffix}`,
      contactName: "Marc Petit",
      contactEmail,
      siren: "123456789",
      city: "Toulon",
    });
    if (!request) throw new Error("Seed failed.");

    authMock.mockResolvedValue({ user: { id: managerId } });
    const { request: updatedRequest, organization } = await approveOrganizationSignupRequest({
      requestId: request.id,
      slug: `refuge-du-var-${suffix}`,
    });

    expect(updatedRequest.status).toBe("approuve");
    expect(updatedRequest.createdOrganizationId).toBe(organization.id);
    expect(organization.name).toBe(`Refuge du Var ${suffix}`);
    expect(organization.siren).toBe("123456789");

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const call = sendEmailMock.mock.calls[0][0];
    expect(call.to).toBe(contactEmail);
    expect(call.fromName).toBe("PattePilot");

    const invitation = await db.query.invitations.findFirst({
      where: eq(invitations.organizationId, organization.id),
    });
    expect(invitation?.email).toBe(contactEmail);
    expect(invitation?.roles).toEqual(["admin"]);

    await db.delete(organizations).where(eq(organizations.id, organization.id));
  });

  it("rejects a request without sending any email", async () => {
    authMock.mockResolvedValue(null);
    const request = await submitOrganizationSignupRequest({
      organizationName: "Association Refusée",
      contactName: "Paul Martin",
      contactEmail: `paul-${randomUUID().slice(0, 8)}@example.com`,
    });
    if (!request) throw new Error("Seed failed.");

    authMock.mockResolvedValue({ user: { id: managerId } });
    const updated = await rejectOrganizationSignupRequest({
      requestId: request.id,
      reviewNotes: "Hors périmètre géographique",
    });

    expect(updated.status).toBe("refuse");
    expect(updated.reviewNotes).toBe("Hors périmètre géographique");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("rejects approving/rejecting a request twice", async () => {
    authMock.mockResolvedValue(null);
    const request = await submitOrganizationSignupRequest({
      organizationName: "Association Unique",
      contactName: "Alice",
      contactEmail: `alice-${randomUUID().slice(0, 8)}@example.com`,
    });
    if (!request) throw new Error("Seed failed.");

    authMock.mockResolvedValue({ user: { id: managerId } });
    await rejectOrganizationSignupRequest({ requestId: request.id });

    await expect(rejectOrganizationSignupRequest({ requestId: request.id })).rejects.toThrow(
      "déjà été traitée",
    );
  });

  it("creates an organization directly and invites its first admin", async () => {
    const suffix = randomUUID().slice(0, 8);
    const adminEmail = `direct-admin-${suffix}@example.com`;

    authMock.mockResolvedValue({ user: { id: managerId } });
    const organization = await createOrganizationAsPlatformManager({
      name: `Création Directe ${suffix}`,
      slug: `creation-directe-${suffix}`,
      adminEmail,
    });

    expect(organization.name).toBe(`Création Directe ${suffix}`);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock.mock.calls[0][0].to).toBe(adminEmail);

    await db.delete(organizations).where(eq(organizations.id, organization.id));
  });

  it("rejects a non-manager from creating an organization", async () => {
    authMock.mockResolvedValue({ user: { id: outsiderId } });
    await expect(
      createOrganizationAsPlatformManager({
        name: "Interdit",
        slug: `interdit-${randomUUID().slice(0, 8)}`,
        adminEmail: "x@example.com",
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("updates only the identity of an organization", async () => {
    const suffix = randomUUID().slice(0, 8);
    const [organization] = await db
      .insert(organizations)
      .values({ name: `À Renommer ${suffix}`, slug: `a-renommer-${suffix}` })
      .returning();
    if (!organization) throw new Error("Seed failed.");

    authMock.mockResolvedValue({ user: { id: managerId } });
    const updated = await updateOrganizationIdentity({
      organizationId: organization.id,
      name: `Renommée ${suffix}`,
      slug: `renommee-${suffix}`,
    });

    expect(updated.name).toBe(`Renommée ${suffix}`);
    expect(updated.slug).toBe(`renommee-${suffix}`);

    await db.delete(organizations).where(eq(organizations.id, organization.id));
  });

  it("refuses to delete an organization unless the exact name is retyped", async () => {
    const suffix = randomUUID().slice(0, 8);
    const [organization] = await db
      .insert(organizations)
      .values({ name: `À Supprimer ${suffix}`, slug: `a-supprimer-${suffix}` })
      .returning();
    if (!organization) throw new Error("Seed failed.");

    authMock.mockResolvedValue({ user: { id: managerId } });
    await expect(
      deleteOrganizationAsPlatformManager({ organizationId: organization.id, confirmName: "Mauvais nom" }),
    ).rejects.toThrow("ne correspond pas");

    const stillThere = await db.query.organizations.findFirst({
      where: eq(organizations.id, organization.id),
    });
    expect(stillThere).toBeDefined();

    await deleteOrganizationAsPlatformManager({
      organizationId: organization.id,
      confirmName: organization.name,
    });
    const gone = await db.query.organizations.findFirst({
      where: eq(organizations.id, organization.id),
    });
    expect(gone).toBeUndefined();
  });

  describe("organization detail view", () => {
    let organizationId: string;
    let memberUserId: string;
    let invitationId: string;

    beforeAll(async () => {
      const suffix = randomUUID().slice(0, 8);
      const [organization] = await db
        .insert(organizations)
        .values({ name: `Détail Test ${suffix}`, slug: `detail-test-${suffix}` })
        .returning();
      if (!organization) throw new Error("Seed failed.");
      organizationId = organization.id;

      const [memberUser] = await db
        .insert(users)
        .values({ email: `detail-member-${suffix}@example.com` })
        .returning();
      if (!memberUser) throw new Error("Seed failed.");
      memberUserId = memberUser.id;

      const [member] = await db
        .insert(organizationMembers)
        .values({ organizationId, userId: memberUserId })
        .returning();
      if (!member) throw new Error("Seed failed.");
      await db.insert(organizationMemberRoles).values({ memberId: member.id, role: "benevole" });
      await db.insert(organizationMemberPermissions).values({ memberId: member.id, permission: "comptabilite" });

      const [invitation] = await db
        .insert(invitations)
        .values({
          organizationId,
          email: `invited-${suffix}@example.com`,
          roles: ["benevole"],
          token: randomUUID(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          invitedByUserId: managerId,
        })
        .returning();
      if (!invitation) throw new Error("Seed failed.");
      invitationId = invitation.id;

      await db.insert(animals).values({ organizationId, name: "Félix", intakeDate: "2026-01-01" });
      await db.insert(adoptionApplications).values({
        organizationId,
        lastName: "Dupont",
        firstName: "Jeanne",
        city: "Toulon",
        phone: "0600000000",
        email: "jeanne@example.com",
        rgpdConsentAt: new Date(),
      });
      await db.insert(sterilizationCampaigns).values({
        organizationId,
        city: "Toulon",
        partner: "spa",
        vetName: "Dr. Test",
        voucherQuotaTotal: 10,
      });
    });

    afterAll(async () => {
      await db.delete(organizations).where(eq(organizations.id, organizationId));
      await db.delete(users).where(eq(users.id, memberUserId));
    });

    it("shows members with roles/permissions, pending invitations, and headline stats, admin-only", async () => {
      authMock.mockResolvedValue({ user: { id: managerId } });
      const detail = await getOrganizationDetailForPlatformManager({ organizationId });

      expect(detail.members).toHaveLength(1);
      expect(detail.members[0]!.roles.map((r) => r.role)).toEqual(["benevole"]);
      expect(detail.members[0]!.permissions.map((p) => p.permission)).toEqual(["comptabilite"]);

      expect(detail.pendingInvitations).toHaveLength(1);
      expect(detail.pendingInvitations[0]!.id).toBe(invitationId);

      expect(detail.stats).toEqual({ animalsCount: 1, applicationsCount: 1, campaignsCount: 1 });

      authMock.mockResolvedValue({ user: { id: outsiderId } });
      await expect(getOrganizationDetailForPlatformManager({ organizationId })).rejects.toThrow(ForbiddenError);
    });

    it("resends a pending invitation, extending its expiry, but rejects a non-manager", async () => {
      const before = await db.query.invitations.findFirst({ where: eq(invitations.id, invitationId) });

      authMock.mockResolvedValue({ user: { id: outsiderId } });
      await expect(resendInvitation({ invitationId })).rejects.toThrow(ForbiddenError);

      authMock.mockResolvedValue({ user: { id: managerId } });
      const updated = await resendInvitation({ invitationId });

      expect(updated.expiresAt.getTime()).toBeGreaterThan(before!.expiresAt.getTime());
      expect(sendEmailMock).toHaveBeenCalledTimes(1);
      expect(sendEmailMock.mock.calls[0][0].to).toBe(before!.email);
      // This test's organization has no SMTP of its own configured — the
      // platform's shared mailbox must be used as the fallback, not throw.
      expect(sendEmailMock.mock.calls[0][0].organizationSmtp?.user).toBe(process.env.PLATFORM_SMTP_USER);
    });

    it("unlike the platform tool's own resend, the organization's own invitation flow passes no fallback when it has no SMTP of its own", async () => {
      // sendEmail itself is mocked to always resolve in this test file (no
      // real email is ever sent here) — so what actually proves the two
      // code paths differ is what `organizationSmtp` each one hands it, not
      // whether the call throws.
      const { createInvitation } = await import("@/server/actions/invitations");

      // This organization has no SMTP of its own — give the platform
      // manager an admin membership here just to call the org-level action.
      const [adminMember] = await db
        .insert(organizationMembers)
        .values({ organizationId, userId: managerId })
        .returning();
      await db.insert(organizationMemberRoles).values({ memberId: adminMember!.id, role: "admin" });

      sendEmailMock.mockClear();
      authMock.mockResolvedValue({ user: { id: managerId } });
      await createInvitation({ organizationId, email: `strict-${randomUUID().slice(0, 8)}@example.com`, roles: ["benevole"] });

      expect(sendEmailMock.mock.calls[0]![0].organizationSmtp).toBeNull();
    });

    it("refuses to resend an invitation that's no longer pending", async () => {
      await db.update(invitations).set({ status: "accepted" }).where(eq(invitations.id, invitationId));

      authMock.mockResolvedValue({ user: { id: managerId } });
      await expect(resendInvitation({ invitationId })).rejects.toThrow("plus en attente");
    });

    it("deletes an invitation, but rejects a non-manager", async () => {
      const [invitation] = await db
        .insert(invitations)
        .values({
          organizationId,
          email: `to-delete-${randomUUID().slice(0, 8)}@example.com`,
          roles: ["benevole"],
          token: randomUUID(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          invitedByUserId: managerId,
        })
        .returning();
      if (!invitation) throw new Error("Seed failed.");

      authMock.mockResolvedValue({ user: { id: outsiderId } });
      await expect(deleteInvitationAsPlatformManager({ invitationId: invitation.id })).rejects.toThrow(
        ForbiddenError,
      );

      authMock.mockResolvedValue({ user: { id: managerId } });
      await deleteInvitationAsPlatformManager({ invitationId: invitation.id });

      const gone = await db.query.invitations.findFirst({ where: eq(invitations.id, invitation.id) });
      expect(gone).toBeUndefined();
    });
  });
});
