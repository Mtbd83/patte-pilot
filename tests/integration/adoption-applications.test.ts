/**
 * Integration tests for the adoption application server actions, run
 * against a real (test) Postgres database. Each run seeds its own
 * uniquely-named organization/users and tears them down in afterAll.
 */
jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));

import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users, organizations, organizationMembers, organizationMemberRoles } from "@/db/schema";
import {
  submitAdoptionApplication,
  listAdoptionApplications,
  getAdoptionApplication,
  updateAdoptionApplicationStatus,
} from "@/server/actions/adoption-applications";
import { ForbiddenError } from "@/lib/permissions";

const authMock = auth as unknown as jest.Mock;

describe("adoption application server actions", () => {
  let organizationId: string;
  let adminUserId: string;
  let outsiderUserId: string;

  beforeAll(async () => {
    const suffix = randomUUID().slice(0, 8);

    const [admin] = await db
      .insert(users)
      .values({ email: `admin-ad-${suffix}@example.com` })
      .returning();
    const [outsider] = await db
      .insert(users)
      .values({ email: `outsider-ad-${suffix}@example.com` })
      .returning();
    if (!admin || !outsider) throw new Error("Seed setup failed: users not created.");
    adminUserId = admin.id;
    outsiderUserId = outsider.id;

    const [org] = await db
      .insert(organizations)
      .values({ name: `Test Adoption ${suffix}`, slug: `test-adoption-${suffix}` })
      .returning();
    if (!org) throw new Error("Seed setup failed: organization not created.");
    organizationId = org.id;

    const [member] = await db
      .insert(organizationMembers)
      .values({ organizationId, userId: adminUserId })
      .returning();
    if (!member) throw new Error("Seed setup failed: member not created.");
    await db.insert(organizationMemberRoles).values({ memberId: member.id, role: "admin" });
  });

  afterAll(async () => {
    await db.delete(organizations).where(eq(organizations.id, organizationId));
    await db.delete(users).where(eq(users.id, adminUserId));
    await db.delete(users).where(eq(users.id, outsiderUserId));
  });

  it("accepts a public submission with no session at all", async () => {
    authMock.mockResolvedValue(null); // proves submitAdoptionApplication never checks auth()
    const application = await submitAdoptionApplication({
      organizationId,
      lastName: "Dupont",
      firstName: "Jeanne",
      city: "Toulon",
      phone: "0600000000",
      email: "jeanne@example.com",
      desiredSpecies: "chat",
    });
    if (!application) throw new Error("Expected a real application, not a honeypot no-op.");
    expect(application.status).toBe("en_attente");
    expect(application.lastName).toBe("Dupont");
  });

  it("silently no-ops when the honeypot field is filled in", async () => {
    authMock.mockResolvedValue(null);
    const result = await submitAdoptionApplication({
      organizationId,
      lastName: "Bot",
      firstName: "Spam",
      city: "Toulon",
      phone: "0600000000",
      email: "bot@example.com",
      desiredSpecies: "chat",
      honeypot: "https://spam.example",
    });
    expect(result).toBeNull();

    authMock.mockResolvedValue({ user: { id: adminUserId, email: "admin@example.com" } });
    const applications = await listAdoptionApplications({ organizationId });
    expect(applications.some((a) => a.lastName === "Bot")).toBe(false);
  });

  it("rejects a submission for a non-existent organization", async () => {
    await expect(
      submitAdoptionApplication({
        organizationId: randomUUID(),
        lastName: "Dupont",
        firstName: "Jeanne",
        city: "Toulon",
        phone: "0600000000",
        email: "jeanne@example.com",
      }),
    ).rejects.toThrow(/introuvable/);
  });

  it("rejects an invalid email", async () => {
    await expect(
      submitAdoptionApplication({
        organizationId,
        lastName: "Dupont",
        firstName: "Jeanne",
        city: "Toulon",
        phone: "0600000000",
        email: "pas-un-email",
      }),
    ).rejects.toThrow();
  });

  it("rejects a submission with no city", async () => {
    await expect(
      submitAdoptionApplication({
        organizationId,
        lastName: "Dupont",
        firstName: "Jeanne",
        city: "",
        phone: "0600000000",
        email: "jeanne-no-city@example.com",
      }),
    ).rejects.toThrow();
  });

  it("stores free-text allergy details instead of a yes/no flag", async () => {
    const withAllergies = await submitAdoptionApplication({
      organizationId,
      lastName: "Dupont",
      firstName: "Jeanne",
      city: "Toulon",
      phone: "0600000000",
      email: `allergies-${randomUUID().slice(0, 8)}@example.com`,
      allergiesDetails: "Poils de chat chez le conjoint",
    });
    expect(withAllergies?.allergiesDetails).toBe("Poils de chat chez le conjoint");

    const withoutAllergies = await submitAdoptionApplication({
      organizationId,
      lastName: "Dupont",
      firstName: "Jeanne",
      city: "Toulon",
      phone: "0600000000",
      email: `no-allergies-${randomUUID().slice(0, 8)}@example.com`,
    });
    expect(withoutAllergies?.allergiesDetails).toBeNull();
  });

  it("lets a member list and fetch applications, but rejects an outsider", async () => {
    authMock.mockResolvedValue({ user: { id: adminUserId, email: "admin@example.com" } });
    const applications = await listAdoptionApplications({ organizationId });
    expect(applications.length).toBeGreaterThan(0);

    const application = applications[0]!;
    const fetched = await getAdoptionApplication({
      applicationId: application.id,
      organizationId,
    });
    expect(fetched.id).toBe(application.id);

    authMock.mockResolvedValue({ user: { id: outsiderUserId, email: "outsider@example.com" } });
    await expect(listAdoptionApplications({ organizationId })).rejects.toThrow(ForbiddenError);
  });

  it("lets an admin change an application's status, but rejects a non-admin", async () => {
    authMock.mockResolvedValue({ user: { id: adminUserId, email: "admin@example.com" } });
    const applications = await listAdoptionApplications({ organizationId });
    const application = applications[0]!;

    const updated = await updateAdoptionApplicationStatus({
      applicationId: application.id,
      organizationId,
      status: "retenu",
      reviewNotes: "Dossier complet",
    });
    expect(updated.status).toBe("retenu");
    expect(updated.reviewNotes).toBe("Dossier complet");

    authMock.mockResolvedValue({ user: { id: outsiderUserId, email: "outsider@example.com" } });
    await expect(
      updateAdoptionApplicationStatus({
        applicationId: application.id,
        organizationId,
        status: "refuse",
      }),
    ).rejects.toThrow(ForbiddenError);
  });
});
