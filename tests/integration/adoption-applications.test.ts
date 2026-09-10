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
  updateAdoptionFormConfig,
  exportAdoptionApplicationPdf,
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
      .values({
        name: `Test Adoption ${suffix}`,
        slug: `test-adoption-${suffix}`,
        // "logement_type" is required by the bank; "foyer_allergies" is
        // optional — exercises both the required-field check and normal
        // storage. "souhait_temperament" is deliberately NOT selected, to
        // prove an answer for it gets stripped rather than persisted.
        adoptionFormQuestionKeys: [
          "logement_type",
          "foyer_allergies",
          "quotidien_sortie_midi",
          "foyer_accord",
          "foyer_raison_desaccord",
        ],
      })
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
      answers: { logement_type: "appartement", foyer_accord: "oui" },
      rgpdConsent: true,
    });
    if (!application) throw new Error("Expected a real application, not a honeypot no-op.");
    expect(application.status).toBe("en_attente");
    expect(application.lastName).toBe("Dupont");
    expect(application.rgpdConsentAt).toBeInstanceOf(Date);
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
      answers: { logement_type: "appartement", foyer_accord: "oui" },
      rgpdConsent: true,
      honeypot: "https://spam.example",
    });
    expect(result).toBeNull();

    authMock.mockResolvedValue({ user: { id: adminUserId, email: "admin@example.com" } });
    const applications = await listAdoptionApplications({ organizationId });
    expect(applications.some((a) => a.lastName === "Bot")).toBe(false);
  });

  it("rejects a submission without RGPD consent", async () => {
    await expect(
      submitAdoptionApplication({
        organizationId,
        lastName: "Dupont",
        firstName: "Jeanne",
        city: "Toulon",
        phone: "0600000000",
        email: `no-consent-${randomUUID().slice(0, 8)}@example.com`,
        answers: { logement_type: "appartement" },
        rgpdConsent: false,
      }),
    ).rejects.toThrow(/conservé/);
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
        rgpdConsent: true,
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
        rgpdConsent: true,
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
        rgpdConsent: true,
      }),
    ).rejects.toThrow();
  });

  it("rejects a submission missing an answer for a required bank question", async () => {
    await expect(
      submitAdoptionApplication({
        organizationId,
        lastName: "Dupont",
        firstName: "Jeanne",
        city: "Toulon",
        phone: "0600000000",
        email: `missing-required-${randomUUID().slice(0, 8)}@example.com`,
        answers: {}, // logement_type is required by this organization's config
        rgpdConsent: true,
      }),
    ).rejects.toThrow(/obligatoire/);
  });

  it("stores answers only for questions the organization selected, silently dropping the rest", async () => {
    const application = await submitAdoptionApplication({
      organizationId,
      lastName: "Dupont",
      firstName: "Jeanne",
      city: "Toulon",
      phone: "0600000000",
      email: `answers-${randomUUID().slice(0, 8)}@example.com`,
      answers: {
        logement_type: "maison",
        foyer_accord: "oui",
        foyer_allergies: "Poils de chat chez le conjoint",
        // Not in this organization's adoptionFormQuestionKeys — must be dropped.
        souhait_temperament: "Calme et affectueux",
      },
      rgpdConsent: true,
    });
    expect(application?.answers).toEqual({
      logement_type: "maison",
      foyer_accord: "oui",
      foyer_allergies: "Poils de chat chez le conjoint",
    });
  });

  it("keeps a dog-only question's answer only when the desired species is a dog", async () => {
    const forACat = await submitAdoptionApplication({
      organizationId,
      lastName: "Dupont",
      firstName: "Jeanne",
      city: "Toulon",
      phone: "0600000000",
      email: `species-cat-${randomUUID().slice(0, 8)}@example.com`,
      desiredSpecies: "chat",
      answers: { logement_type: "maison", foyer_accord: "oui", quotidien_sortie_midi: "oui" },
      rgpdConsent: true,
    });
    expect(forACat?.answers).toEqual({ logement_type: "maison", foyer_accord: "oui" });

    const forADog = await submitAdoptionApplication({
      organizationId,
      lastName: "Dupont",
      firstName: "Jeanne",
      city: "Toulon",
      phone: "0600000000",
      email: `species-dog-${randomUUID().slice(0, 8)}@example.com`,
      desiredSpecies: "chien",
      answers: { logement_type: "maison", foyer_accord: "oui", quotidien_sortie_midi: "oui" },
      rgpdConsent: true,
    });
    expect(forADog?.answers).toEqual({
      logement_type: "maison",
      foyer_accord: "oui",
      quotidien_sortie_midi: "oui",
    });
  });

  it("only shows/requires a 'si non, pourquoi' follow-up when its parent question was actually answered 'non'", async () => {
    // Parent answered "oui" — the follow-up isn't required, and any answer sent for it is dropped.
    const agreed = await submitAdoptionApplication({
      organizationId,
      lastName: "Dupont",
      firstName: "Jeanne",
      city: "Toulon",
      phone: "0600000000",
      email: `follow-up-agreed-${randomUUID().slice(0, 8)}@example.com`,
      answers: {
        logement_type: "maison",
        foyer_accord: "oui",
        foyer_raison_desaccord: "Ne devrait jamais être stocké",
      },
      rgpdConsent: true,
    });
    expect(agreed?.answers).toEqual({ logement_type: "maison", foyer_accord: "oui" });

    // Parent answered "non" — the follow-up becomes required.
    await expect(
      submitAdoptionApplication({
        organizationId,
        lastName: "Dupont",
        firstName: "Jeanne",
        city: "Toulon",
        phone: "0600000000",
        email: `follow-up-missing-${randomUUID().slice(0, 8)}@example.com`,
        answers: { logement_type: "maison", foyer_accord: "non" },
        rgpdConsent: true,
      }),
    ).rejects.toThrow(/obligatoire/);

    // Parent answered "non" and the follow-up is filled in — both are kept.
    const disagreed = await submitAdoptionApplication({
      organizationId,
      lastName: "Dupont",
      firstName: "Jeanne",
      city: "Toulon",
      phone: "0600000000",
      email: `follow-up-filled-${randomUUID().slice(0, 8)}@example.com`,
      answers: {
        logement_type: "maison",
        foyer_accord: "non",
        foyer_raison_desaccord: "Le conjoint n'est pas prêt",
      },
      rgpdConsent: true,
    });
    expect(disagreed?.answers).toEqual({
      logement_type: "maison",
      foyer_accord: "non",
      foyer_raison_desaccord: "Le conjoint n'est pas prêt",
    });
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

  it("exports an application as a PDF, but rejects an outsider", async () => {
    authMock.mockResolvedValue({ user: { id: adminUserId, email: "admin@example.com" } });
    const applications = await listAdoptionApplications({ organizationId });
    const application = applications[0]!;

    const { pdfBase64 } = await exportAdoptionApplicationPdf({
      applicationId: application.id,
      organizationId,
    });
    const pdfBytes = Buffer.from(pdfBase64, "base64");
    expect(pdfBytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");

    authMock.mockResolvedValue({ user: { id: outsiderUserId, email: "outsider@example.com" } });
    await expect(
      exportAdoptionApplicationPdf({ applicationId: application.id, organizationId }),
    ).rejects.toThrow(ForbiddenError);
  });

  describe("updateAdoptionFormConfig", () => {
    it("lets an admin set the question bank selection and free questions, rejects a non-admin", async () => {
      authMock.mockResolvedValue({ user: { id: adminUserId, email: "admin@example.com" } });
      const updated = await updateAdoptionFormConfig({
        organizationId,
        // "questions_qui_n_existe_pas" isn't in the bank — must be dropped.
        questionKeys: ["logement_type", "animaux_deja_presents", "questions_qui_n_existe_pas"],
        freeQuestions: [{ label: "Un dernier mot ?" }],
      });
      expect(updated.adoptionFormQuestionKeys).toEqual(["logement_type", "animaux_deja_presents"]);
      expect(updated.adoptionFormFreeQuestions).toEqual([{ label: "Un dernier mot ?" }]);

      authMock.mockResolvedValue({ user: { id: outsiderUserId, email: "outsider@example.com" } });
      await expect(
        updateAdoptionFormConfig({ organizationId, questionKeys: [], freeQuestions: [] }),
      ).rejects.toThrow(ForbiddenError);
    });

    it("rejects more than two free questions", async () => {
      authMock.mockResolvedValue({ user: { id: adminUserId, email: "admin@example.com" } });
      await expect(
        updateAdoptionFormConfig({
          organizationId,
          questionKeys: [],
          freeQuestions: [{ label: "Un" }, { label: "Deux" }, { label: "Trois" }],
        }),
      ).rejects.toThrow();
    });
  });
});
