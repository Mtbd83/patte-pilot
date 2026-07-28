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
import { createAnimal } from "@/server/actions/animals";
import { updateOrganizationProfile } from "@/server/actions/organizations";
import {
  sendEngagementCertificate,
  generateAndSendAdoptionContract,
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

global.fetch = jest.fn(async (url: string) => {
  if (url !== FAKE_CERTIFICATE_URL) throw new Error(`Unexpected fetch in test: ${url}`);
  const bytes = readFileSync(PLACEHOLDER_CERTIFICATE_PATH);
  return { ok: true, arrayBuffer: async () => Uint8Array.from(bytes).buffer } as Response;
}) as unknown as typeof fetch;

describe("documents server actions", () => {
  let organizationId: string;
  let adminUserId: string;
  let outsiderUserId: string;
  let animalId: string;

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
      .set({ certificateFileUrl: FAKE_CERTIFICATE_URL })
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

  it("falls back to the default certificate for a chien when no dog-specific one is configured", async () => {
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

    expect(global.fetch).toHaveBeenCalledWith(FAKE_CERTIFICATE_URL);
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
