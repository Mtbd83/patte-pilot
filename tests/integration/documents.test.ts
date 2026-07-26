/**
 * Integration tests for the document-generation server actions (engagement
 * certificate + adoption contract), run against a real (test) Postgres
 * database. Nodemailer is mocked so no real email is sent; the certificate
 * file is read from the real public/documents/certificat-engagement.pdf
 * placeholder shipped in the repo.
 */
jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));
jest.mock("@/lib/mailer", () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

import { randomUUID } from "crypto";
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
    });
    expect(document.type).toBe("certificat_engagement");
    expect(document.status).toBe("envoye");
    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    const call = sendEmailMock.mock.calls[0][0];
    expect(call.to).toBe("adoptant@example.com");
    expect(call.attachments[0].filename).toBe("certificat-engagement.pdf");
  });

  it("rejects a non-admin from sending the certificate", async () => {
    authMock.mockResolvedValue({ user: { id: outsiderUserId, email: "outsider@example.com" } });
    await expect(
      sendEngagementCertificate({ organizationId, animalId, toEmail: "adoptant@example.com" }),
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
      paymentMethod: "cb",
      signaturePlace: "Garéoult",
      signatureDate: "2026-07-22",
    });
    expect(document.type).toBe("contrat_adoption");
    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    const call = sendEmailMock.mock.calls[0][0];
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
        paymentMethod: "cb",
        signaturePlace: "Garéoult",
        signatureDate: "2026-07-22",
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("lists documents scoped to the animal", async () => {
    const docs = await listDocuments({ organizationId, animalId });
    expect(docs.length).toBe(2);
    expect(docs.map((d) => d.type).sort()).toEqual(["certificat_engagement", "contrat_adoption"]);
  });
});
