import { generateAdoptionContractPdf } from "@/lib/adoption-contract-pdf";

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
    const bytes = await generateAdoptionContractPdf(baseData);
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

    const bytes = await generateAdoptionContractPdf(minimal);
    expect(Buffer.from(bytes.slice(0, 5)).toString("latin1")).toBe("%PDF-");
  });

  it("still renders with a free donation set", async () => {
    const bytes = await generateAdoptionContractPdf({
      ...baseData,
      sterilizationFeesAmount: undefined,
      freeDonationAmount: 50,
      freeDonationReason: "Don ponctuel",
    });
    expect(Buffer.from(bytes.slice(0, 5)).toString("latin1")).toBe("%PDF-");
  });
});
