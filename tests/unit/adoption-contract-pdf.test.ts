import { readFileSync } from "fs";
import path from "path";
import { generateAdoptionContractPdf } from "@/lib/adoption-contract-pdf";
import type { ContractFieldPositions } from "@/db/schema";

const templateBytes = new Uint8Array(
  readFileSync(path.join(process.cwd(), "public", "documents", "contrat-adoption-template.pdf")),
);

/**
 * La Patte Chanceuse's real, historical positions for this exact template —
 * originally hardcoded in adoption-contract-pdf.ts, now the seed data for
 * her organization row (see the one-off migration script). Kept here so
 * this test exercises the same real-world mapping, not a toy one.
 */
const positions: ContractFieldPositions = {
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

const baseData = {
  animal: {
    name: "Petite Biscotte",
    sex: "femelle" as const,
    species: "chat" as const,
    birthDate: "2026-04-30",
    icadNumber: "250269611887468",
    coat: "Tigré gris",
  },
  sterilizationDone: false,
  healthCertificateOk: true,
  adopter: {
    fullName: "GALEA Sandrine",
    address: "1 rue des Fleurs",
    postalCode: "83210",
    city: "Belgentier",
    phone1: "0609709861",
    email: "sandrinegalea@hotmail.fr",
  },
  vetFeesAmount: 180,
  sterilizationFeesAmount: 150,
  signaturePlace: "Garéoult",
  signatureDate: "2026-07-22",
};

describe("generateAdoptionContractPdf", () => {
  it("produces a valid, non-trivial PDF buffer", async () => {
    const bytes = await generateAdoptionContractPdf(baseData, templateBytes, positions);
    const header = Buffer.from(bytes.slice(0, 5)).toString("latin1");
    expect(header).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(500);
  });

  it("doesn't throw when every optional field is omitted", async () => {
    const minimal = {
      animal: { name: "Rex", sex: "male" as const, species: "chien" as const },
      sterilizationDone: false,
      healthCertificateOk: false,
      adopter: {
        fullName: "Jean Dupont",
        address: "2 rue du Test",
        postalCode: "75000",
        city: "Paris",
        phone1: "0600000000",
        email: "jean@example.com",
      },
      vetFeesAmount: 100,
      signaturePlace: "Paris",
      signatureDate: "2026-01-01",
    };

    const bytes = await generateAdoptionContractPdf(minimal, templateBytes, positions);
    expect(Buffer.from(bytes.slice(0, 5)).toString("latin1")).toBe("%PDF-");
  });

  it("still renders with a free donation set", async () => {
    const bytes = await generateAdoptionContractPdf(
      {
        ...baseData,
        sterilizationFeesAmount: undefined,
        freeDonationAmount: 50,
        freeDonationReason: "Don ponctuel",
      },
      templateBytes,
      positions,
    );
    expect(Buffer.from(bytes.slice(0, 5)).toString("latin1")).toBe("%PDF-");
  });

  it("skips fields that have no mapped position instead of throwing", async () => {
    const bytes = await generateAdoptionContractPdf(baseData, templateBytes, {
      nom: positions.nom!,
    });
    expect(Buffer.from(bytes.slice(0, 5)).toString("latin1")).toBe("%PDF-");
  });
});
