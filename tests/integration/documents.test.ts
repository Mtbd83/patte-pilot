/**
 * Integration tests for the document-generation server actions (engagement
 * certificate + adoption contract), run against a real (test) Postgres
 * database. Nodemailer is mocked so no real email is sent. The engagement
 * certificate is now fetched from the organization's own uploaded URL
 * (Supabase Storage) rather than a bundled file, so `fetch` is mocked to
 * serve the real placeholder PDF (public/documents/certificat-engagement.pdf)
 * without hitting the network.
 */
jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));
jest.mock("@/lib/mailer", () => ({
  ...jest.requireActual("@/lib/mailer"),
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { sendEmail } from "@/lib/mailer";
import { db } from "@/db";
import { users, organizations, organizationMembers, organizationMemberRoles } from "@/db/schema";
import { createAnimal, updateAnimalHealthChecklist } from "@/server/actions/animals";
import { createFosterFamily } from "@/server/actions/foster-families";
import { updateOrganizationProfile } from "@/server/actions/organizations";
import {
  sendEngagementCertificate,
  generateAndSendAdoptionContract,
  previewContractEmail,
  listDocuments,
} from "@/server/actions/documents";
import { ForbiddenError } from "@/lib/permissions";

const authMock = auth as unknown as jest.Mock;
const sendEmailMock = sendEmail as unknown as jest.Mock;

const PLACEHOLDER_CERTIFICATE_PATH = path.join(
  process.cwd(),
  "public",
  "documents",
  "certificat-engagement.pdf",
);
const FAKE_CERTIFICATE_URL = "https://storage.example.test/documents/certificat-engagement.pdf";
const FAKE_CHIEN_CERTIFICATE_URL = "https://storage.example.test/documents/certificat-chien.pdf";

const CONTRACT_TEMPLATE_PATH = path.join(
  process.cwd(),
  "public",
  "documents",
  "contrat-adoption-template.pdf",
);
const FAKE_CONTRACT_URL = "https://storage.example.test/documents/contrat-adoption-template.pdf";

// La Patte Chanceuse's real, historical positions for this exact template —
// see tests/unit/adoption-contract-pdf.test.ts and e2e/global-setup.ts for
// the same values.
const CONTRACT_POSITIONS = {
  nom: { page: 0, x: 55, y: 633.02 },
  dateNaissance: { page: 0, x: 432, y: 633.02 },
  icad: { page: 0, x: 150, y: 613.62 },
  pelage: { page: 0, x: 404, y: 613.62 },
  espece: { page: 0, x: 295, y: 559.72 },
  adopterName: { page: 0, x: 86, y: 520.62 },
  adopterAddress: { page: 0, x: 70, y: 501.22 },
  adopterPostalCode: { page: 0, x: 85, y: 471.92 },
  adopterCity: { page: 0, x: 338, y: 471.92 },
  adopterPhone1: { page: 0, x: 88, y: 447.42 },
  adopterPhone2: { page: 0, x: 378, y: 447.42 },
  adopterEmail: { page: 0, x: 90, y: 423.02 },
  vetFees: { page: 0, x: 360, y: 398.52, size: 9 },
  sterilizationFees: { page: 0, x: 254, y: 382.92, size: 9 },
  donationAmount: { page: 0, x: 102, y: 354.62, size: 9 },
  donationReason: { page: 0, x: 257, y: 354.62 },
  signaturePlace: { page: 0, x: 53, y: 305.82 },
  signatureDate: { page: 0, x: 281, y: 305.82 },
  sexeMaleBox: { page: 0, x: 202.15, y: 630.8 },
  sexeFemelleBox: { page: 0, x: 245.95, y: 631.6 },
  sterilizeOuiBox: { page: 0, x: 114.75, y: 582.66 },
  sterilizeNonBox: { page: 0, x: 157.65, y: 582.4 },
  santeOuiBox: { page: 0, x: 154.4, y: 558.45 },
  santeNonBox: { page: 0, x: 195.8, y: 558.15 },
};

global.fetch = jest.fn(async (url: string) => {
  if (url === FAKE_CERTIFICATE_URL || url === FAKE_CHIEN_CERTIFICATE_URL) {
    const bytes = readFileSync(PLACEHOLDER_CERTIFICATE_PATH);
    return { ok: true, arrayBuffer: async () => Uint8Array.from(bytes).buffer } as Response;
  }
  if (url === FAKE_CONTRACT_URL) {
    const bytes = readFileSync(CONTRACT_TEMPLATE_PATH);
    return { ok: true, arrayBuffer: async () => Uint8Array.from(bytes).buffer } as Response;
  }
  throw new Error(`Unexpected fetch in test: ${url}`);
}) as unknown as typeof fetch;

describe("documents server actions", () => {
  let organizationId: string;
  let adminUserId: string;
  let outsiderUserId: string;
  let animalId: string;
  let fosterFamilyId: string;

  beforeAll(async () => {
    const suffix = randomUUID().slice(0, 8);

    const [admin] = await db
      .insert(users)
      .values({ email: `admin-doc-${suffix}@example.com` })
      .returning();
    const [outsider] = await db
      .insert(users)
      .values({ email: `outsider-doc-${suffix}@example.com` })
      .returning();
    if (!admin || !outsider) throw new Error("Seed setup failed: users not created.");
    adminUserId = admin.id;
    outsiderUserId = outsider.id;

    const [org] = await db
      .insert(organizations)
      .values({ name: `Test Documents ${suffix}`, slug: `test-documents-${suffix}` })
      .returning();
    if (!org) throw new Error("Seed setup failed: organization not created.");
    organizationId = org.id;

    const [member] = await db
      .insert(organizationMembers)
      .values({ organizationId, userId: adminUserId })
      .returning();
    if (!member) throw new Error("Seed setup failed: member not created.");
    await db.insert(organizationMemberRoles).values({ memberId: member.id, role: "admin" });

    authMock.mockResolvedValue({ user: { id: adminUserId, email: admin.email } });

    await updateOrganizationProfile({
      organizationId,
      siren: "924237563",
      registrationAuthority: "sous-préfecture du Var",
      registrationNumber: "W832021610",
      address: "1 rue Test",
      postalCode: "83000",
      city: "Toulon",
      phone1: "0600000000",
    });
    await db
      .update(organizations)
      .set({
        certificateFileUrlChat: FAKE_CERTIFICATE_URL,
        contractTemplateUrl: FAKE_CONTRACT_URL,
        contractFieldPositions: CONTRACT_POSITIONS,
      })
      .where(eq(organizations.id, organizationId));

    const animal = await createAnimal({
      organizationId,
      name: "Biscotte",
      species: "chat",
      sex: "femelle",
      intakeDate: "2026-01-01",
      status: "adopte",
    });
    animalId = animal.id;

    const fosterFamily = await createFosterFamily({
      organizationId,
      firstName: "Famille",
      lastName: `Test-${suffix}`,
      hasCats: true,
    });
    fosterFamilyId = fosterFamily.id;
  });

  afterAll(async () => {
    await db.delete(organizations).where(eq(organizations.id, organizationId));
    await db.delete(users).where(eq(users.id, adminUserId));
    await db.delete(users).where(eq(users.id, outsiderUserId));
  });

  beforeEach(() => {
    authMock.mockResolvedValue({ user: { id: adminUserId, email: "admin@example.com" } });
    sendEmailMock.mockClear();
  });

  it("sends the engagement certificate as-is and logs it", async () => {
    const document = await sendEngagementCertificate({
      organizationId,
      animalId,
      toEmail: "adoptant@example.com",
      subject: "Certificat d'engagement — Biscotte",
      body: "Bonjour,\n\nVeuillez trouver ci-joint le certificat d'engagement.",
    });
    expect(document.type).toBe("certificat_engagement");
    expect(document.status).toBe("envoye");
    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    const call = sendEmailMock.mock.calls[0][0];
    expect(call.to).toBe("adoptant@example.com");
    expect(call.subject).toBe("Certificat d'engagement — Biscotte");
    expect(call.attachments[0].filename).toBe("certificat-engagement.pdf");
  });

  it("sends the chien-specific certificate for a chien, not the chat one", async () => {
    await db
      .update(organizations)
      .set({ certificateFileUrlChien: FAKE_CHIEN_CERTIFICATE_URL })
      .where(eq(organizations.id, organizationId));

    const dog = await createAnimal({
      organizationId,
      name: "Rex",
      species: "chien",
      sex: "male",
      intakeDate: "2026-01-01",
      status: "adopte",
    });

    await sendEngagementCertificate({
      organizationId,
      animalId: dog.id,
      toEmail: "adoptant@example.com",
      subject: "Certificat d'engagement — Rex",
      body: "Bonjour,",
    });

    expect(global.fetch).toHaveBeenCalledWith(FAKE_CHIEN_CERTIFICATE_URL);
  });

  it("rejects sending for a species group with nothing configured, even though others are (no fallback)", async () => {
    // This org only has certificateFileUrlChat/Chien set (see beforeAll and
    // the previous test) — lapin/autre ("NAC") was never configured, and
    // must not silently borrow the chat certificate.
    const rabbit = await createAnimal({
      organizationId,
      name: "Caramel",
      species: "lapin",
      sex: "femelle",
      intakeDate: "2026-01-01",
      status: "adopte",
    });

    await expect(
      sendEngagementCertificate({
        organizationId,
        animalId: rabbit.id,
        toEmail: "adoptant@example.com",
        subject: "Certificat",
        body: "Bonjour,",
      }),
    ).rejects.toThrow(/Aucun certificat d'engagement configuré pour "NAC"/);
  });

  it("rejects sending a certificate when none is configured for the organization", async () => {
    const [bareOrg] = await db
      .insert(organizations)
      .values({ name: "Sans certificat", slug: `no-cert-${randomUUID().slice(0, 8)}` })
      .returning();
    if (!bareOrg) throw new Error("Seed setup failed.");
    const [member] = await db
      .insert(organizationMembers)
      .values({ organizationId: bareOrg.id, userId: adminUserId })
      .returning();
    if (!member) throw new Error("Seed setup failed.");
    await db.insert(organizationMemberRoles).values({ memberId: member.id, role: "admin" });

    const bareAnimal = await createAnimal({
      organizationId: bareOrg.id,
      name: "Sans Certif",
      species: "chat",
      sex: "femelle",
      intakeDate: "2026-01-01",
      status: "adopte",
    });

    await expect(
      sendEngagementCertificate({
        organizationId: bareOrg.id,
        animalId: bareAnimal.id,
        toEmail: "adoptant@example.com",
        subject: "Certificat",
        body: "Bonjour,",
      }),
    ).rejects.toThrow(/Aucun certificat d'engagement configuré/);

    await db.delete(organizations).where(eq(organizations.id, bareOrg.id));
  });

  it("rejects generating a contract when no template is configured for the organization", async () => {
    const [bareOrg] = await db
      .insert(organizations)
      .values({ name: "Sans contrat", slug: `no-contract-${randomUUID().slice(0, 8)}` })
      .returning();
    if (!bareOrg) throw new Error("Seed setup failed.");
    const [member] = await db
      .insert(organizationMembers)
      .values({ organizationId: bareOrg.id, userId: adminUserId })
      .returning();
    if (!member) throw new Error("Seed setup failed.");
    await db.insert(organizationMemberRoles).values({ memberId: member.id, role: "admin" });

    const bareAnimal = await createAnimal({
      organizationId: bareOrg.id,
      name: "Sans Contrat",
      species: "chat",
      sex: "femelle",
      intakeDate: "2026-01-01",
      status: "adopte",
    });

    await expect(
      generateAndSendAdoptionContract({
        organizationId: bareOrg.id,
        animalId: bareAnimal.id,
        toEmail: "adoptant@example.com",
        adopterFullName: "GALEA Sandrine",
        adopterAddress: "1 rue des Fleurs",
        adopterPostalCode: "83210",
        adopterCity: "Belgentier",
        adopterPhone1: "0609709861",
        sterilizationDone: false,
        healthCertificateOk: true,
        vetFeesAmount: 180,
        signaturePlace: "Garéoult",
        signatureDate: "2026-07-22",
        emailSubject: "Contrat d'adoption",
        emailBody: "Bonjour,",
      }),
    ).rejects.toThrow(/Aucun modèle de contrat configuré/);

    await db.delete(organizations).where(eq(organizations.id, bareOrg.id));
  });

  it("rejects a non-admin from sending the certificate", async () => {
    authMock.mockResolvedValue({ user: { id: outsiderUserId, email: "outsider@example.com" } });
    await expect(
      sendEngagementCertificate({
        organizationId,
        animalId,
        toEmail: "adoptant@example.com",
        subject: "Certificat d'engagement — Biscotte",
        body: "Bonjour,",
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("generates and sends the filled adoption contract", async () => {
    const document = await generateAndSendAdoptionContract({
      organizationId,
      animalId,
      toEmail: "adoptant@example.com",
      adopterFullName: "GALEA Sandrine",
      adopterAddress: "1 rue des Fleurs",
      adopterPostalCode: "83210",
      adopterCity: "Belgentier",
      adopterPhone1: "0609709861",
      sterilizationDone: false,
      healthCertificateOk: true,
      vetFeesAmount: 180,
      sterilizationFeesAmount: 150,
      signaturePlace: "Garéoult",
      signatureDate: "2026-07-22",
      emailSubject: "Contrat d'adoption — Biscotte",
      emailBody: "Bonjour,\n\nVeuillez trouver ci-joint le contrat d'adoption.",
    });
    expect(document.type).toBe("contrat_adoption");
    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    const call = sendEmailMock.mock.calls[0][0];
    expect(call.subject).toBe("Contrat d'adoption — Biscotte");
    expect(call.attachments[0].contentType).toBe("application/pdf");
    expect(Buffer.from(call.attachments[0].content).slice(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("generates the contract without a postal code — not collected by the public adoption form", async () => {
    const otherAnimal = await createAnimal({
      organizationId,
      name: "Sans Code Postal",
      species: "chat",
      sex: "femelle",
      intakeDate: "2026-01-01",
      status: "adopte",
    });
    const document = await generateAndSendAdoptionContract({
      organizationId,
      animalId: otherAnimal.id,
      toEmail: "adoptant@example.com",
      adopterFullName: "GALEA Sandrine",
      adopterCity: "Belgentier",
      adopterPhone1: "0609709861",
      sterilizationDone: false,
      healthCertificateOk: true,
      vetFeesAmount: 180,
      signaturePlace: "Garéoult",
      signatureDate: "2026-07-22",
      emailSubject: "Contrat d'adoption — Biscotte",
      emailBody: "Bonjour,\n\nVeuillez trouver ci-joint le contrat d'adoption.",
    });
    expect(document.type).toBe("contrat_adoption");
  });

  it("includes the booster reminder line when the first vaccine is done but the booster isn't", async () => {
    const dueAnimal = await createAnimal({
      organizationId,
      name: "Rappel Attendu",
      species: "chat",
      sex: "femelle",
      intakeDate: "2026-01-01",
      status: "reserve",
      fosterFamilyId,
    });
    await updateAnimalHealthChecklist({
      organizationId,
      animalId: dueAnimal.id,
      firstVaccineDone: true,
      firstVaccineDate: "2026-01-01",
    });

    const { body } = await previewContractEmail({
      organizationId,
      animalId: dueAnimal.id,
      sterilizationDone: false,
      vetFeesAmount: 180,
    });
    expect(body).toContain("N'oubliez pas le rappel de vaccin");
  });

  it("does not include the booster reminder line once the booster has been marked done", async () => {
    const doneAnimal = await createAnimal({
      organizationId,
      name: "Rappel Fait",
      species: "chat",
      sex: "femelle",
      intakeDate: "2026-01-01",
      status: "reserve",
      fosterFamilyId,
    });
    await updateAnimalHealthChecklist({
      organizationId,
      animalId: doneAnimal.id,
      firstVaccineDone: true,
      firstVaccineDate: "2026-01-01",
      boosterDone: true,
      boosterDate: "2026-02-01",
    });

    const { body } = await previewContractEmail({
      organizationId,
      animalId: doneAnimal.id,
      sterilizationDone: false,
      vetFeesAmount: 180,
    });
    expect(body).not.toContain("N'oubliez pas le rappel de vaccin");
  });

  it("rejects a non-admin from generating the contract", async () => {
    authMock.mockResolvedValue({ user: { id: outsiderUserId, email: "outsider@example.com" } });
    await expect(
      generateAndSendAdoptionContract({
        organizationId,
        animalId,
        toEmail: "adoptant@example.com",
        adopterFullName: "GALEA Sandrine",
        adopterAddress: "1 rue des Fleurs",
        adopterPostalCode: "83210",
        adopterCity: "Belgentier",
        adopterPhone1: "0609709861",
        sterilizationDone: false,
        healthCertificateOk: true,
        vetFeesAmount: 180,
        signaturePlace: "Garéoult",
        signatureDate: "2026-07-22",
        emailSubject: "Contrat d'adoption — Biscotte",
        emailBody: "Bonjour,",
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("lists documents scoped to the animal", async () => {
    const docs = await listDocuments({ organizationId, animalId });
    expect(docs.length).toBe(2);
    expect(docs.map((d) => d.type).sort()).toEqual(["certificat_engagement", "contrat_adoption"]);
  });
});
