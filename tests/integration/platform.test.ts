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
import { users, organizations, invitations } from "@/db/schema";
import {
  submitOrganizationSignupRequest,
  listOrganizationSignupRequests,
  listOrganizationsForPlatformManager,
  approveOrganizationSignupRequest,
  rejectOrganizationSignupRequest,
  createOrganizationAsPlatformManager,
  updateOrganizationIdentity,
  deleteOrganizationAsPlatformManager,
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
});
