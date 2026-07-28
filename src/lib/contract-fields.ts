/**
 * Canonical list of fields the adoption contract can fill in — shared
 * between generation (src/lib/adoption-contract-pdf.ts) and the per-org
 * field-mapping tool (src/app/.../parametres/contrat). Adding/removing a
 * field only touches this file plus those two consumers.
 */
export const CONTRACT_TEXT_FIELDS = [
  { key: "nom", label: "Nom de l'animal" },
  { key: "dateNaissance", label: "Date de naissance de l'animal" },
  { key: "icad", label: "N° ICAD" },
  { key: "pelage", label: "Pelage" },
  { key: "espece", label: "Espèce / race" },
  { key: "adopterName", label: "Nom de l'adoptant·e" },
  { key: "adopterAddress", label: "Adresse de l'adoptant·e" },
  { key: "adopterPostalCode", label: "Code postal" },
  { key: "adopterCity", label: "Ville" },
  { key: "adopterPhone1", label: "Téléphone 1" },
  { key: "adopterPhone2", label: "Téléphone 2" },
  { key: "adopterEmail", label: "Email" },
  { key: "vetFees", label: "Frais vétérinaires" },
  { key: "sterilizationFees", label: "Frais de stérilisation" },
  { key: "donationAmount", label: "Montant du don libre" },
  { key: "donationReason", label: "Motif du don libre" },
  { key: "signaturePlace", label: "Lieu de signature (« Fait à »)" },
  { key: "signatureDate", label: "Date de signature (« Le »)" },
] as const;

export type ContractTextFieldKey = (typeof CONTRACT_TEXT_FIELDS)[number]["key"];

export const CONTRACT_CHECKBOX_FIELDS = [
  { key: "sexeMaleBox", label: "Case « Mâle »" },
  { key: "sexeFemelleBox", label: "Case « Femelle »" },
  { key: "sterilizeOuiBox", label: "Case « Stérilisé : oui »" },
  { key: "sterilizeNonBox", label: "Case « Stérilisé : non »" },
  { key: "santeOuiBox", label: "Case « Certificat de bonne santé : oui »" },
  { key: "santeNonBox", label: "Case « Certificat de bonne santé : non »" },
] as const;

export type ContractCheckboxFieldKey = (typeof CONTRACT_CHECKBOX_FIELDS)[number]["key"];

export type ContractFieldKey = ContractTextFieldKey | ContractCheckboxFieldKey;
