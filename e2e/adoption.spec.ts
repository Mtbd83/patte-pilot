import { test, expect } from "@playwright/test";

/**
 * End-to-end coverage for the adoption brique: public application form →
 * admin review → sending the engagement certificate as-is → generating and
 * sending the filled adoption contract.
 * Assumes the seeded test DB (see e2e/global-setup.ts): admin@example.com
 * is an admin of the "asso-test" organization.
 */
test("public adoption form → admin review → certificate + contract sent", async ({ page }) => {
  const suffix = `${Date.now()}-${test.info().parallelIndex}`;
  const applicantEmail = `jeanne-${suffix}@example.com`;
  const animalName = `Biscotte-${suffix}`;

  // --- Public form submission (no login) ---
  await page.goto("/organisations/asso-test/adopter");
  await page.getByLabel("Prénom", { exact: true }).fill("Jeanne");
  await page.getByLabel("Nom", { exact: true }).fill(`Dupont-${suffix}`);
  await page.getByLabel("Ville", { exact: true }).fill("Toulon");
  await page.getByLabel("Téléphone").fill("0600000000");
  await page.getByLabel("Adresse mail").fill(applicantEmail);
  await page.getByLabel("Quel âge avez-vous ?").fill("35");
  await page.getByLabel('Votre logement est en zone').selectOption({ label: "Urbaine" });
  await page.getByLabel('Votre logement est un/une').selectOption({ label: "Appartement" });
  await page.getByLabel("Superficie de l'appartement (m²)").fill("45");
  await page.getByLabel("Quelle est votre profession ?").fill("Vétérinaire");
  await page.getByLabel("Vous êtes").selectOption({ label: "Propriétaire" });
  await page.getByLabel("Vivez-vous", { exact: true }).selectOption({ label: "En couple" });
  await page.getByLabel("De combien de personnes se compose la famille ?").fill("2");
  await page.getByLabel("Dont combien d'enfants ?").fill("0");
  await page.getByLabel("Quel est le niveau d'activité de la famille ?").selectOption({ label: "Modéré" });
  await page.getByLabel("Combien de temps l'animal restera seul par jour ?").selectOption({ label: "2h à 4h" });
  await page
    .getByLabel("Que ferez-vous de votre animal pendant les weekends / vacances ?")
    .fill("Il viendra avec nous ou restera avec un proche.");
  await page.getByRole('textbox', { name: 'Dans quel espace l\'animal' }).click();
  await page.getByRole('textbox', { name: 'Dans quel espace l\'animal' }).fill('salon');
  await page.getByRole('textbox', { name: 'Qui se chargera de soigner (' }).click();
  await page.getByRole('textbox', { name: 'Qui se chargera de soigner (' }).fill('moi');
  await page.getByLabel("Type d'animal souhaité").selectOption({ label: "Chat" });
  await page.getByRole("button", { name: "Envoyer ma candidature" }).click();
  await expect(page.getByRole("heading", { name: "Merci !" })).toBeVisible();

  // --- Admin login ---
  await page.goto("/connexion");
  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Mot de passe").fill("Password123!");
  await page.getByRole("button", { name: "Se connecter" }).click();

  // --- The application shows up in the admin list ---
  await page.goto("/organisations/asso-test/candidatures");
  const row = page.getByRole("row", { name: new RegExp(`Dupont-${suffix}`) });
  await expect(row).toBeVisible();
  await row.getByRole("link").click();
  await expect(page.getByRole("heading", { name: `Jeanne Dupont-${suffix}` })).toBeVisible();
  await page.waitForLoadState("networkidle");

  // --- Admin accepts the application ---
  await page.getByLabel("Statut", { exact: true }).selectOption({ label: "Retenue" });
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Statut mis à jour")).toBeVisible();

  // --- Create an animal to attach the documents to ---
  await page.goto("/organisations/asso-test/animaux");
  await page.getByRole("button", { name: "Ajouter un animal" }).click();
  await page.getByLabel("Nom", { exact: true }).fill(animalName);
  await page.getByLabel("Statut", { exact: true }).selectOption({ label: "Adopté" });
  await page.getByRole("button", { name: "Ajouter l'animal" }).click();
  await expect(page.getByText("Animal ajouté")).toBeVisible();

  // --- Back on the application: send the certificate as-is ---
  await page.goto("/organisations/asso-test/candidatures");
  await page.getByRole("row", { name: new RegExp(`Dupont-${suffix}`) }).getByRole("link").click();
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Animal", { exact: true }).first().selectOption({ label: animalName });
  await page.getByRole("button", { name: "Générer l'aperçu du mail" }).first().click();
  await expect(page.getByLabel("Sujet", { exact: true })).not.toHaveValue("");
  await page.getByRole("button", { name: "Envoyer le certificat d'engagement" }).click();
  await expect(page.getByText("Certificat d'engagement envoyé")).toBeVisible();

  // --- Generate and send the filled contract ---
  await page.getByLabel("Animal", { exact: true }).nth(1).selectOption({ label: animalName });
  await page.getByLabel("Adresse", { exact: true }).fill("1 rue des Fleurs");
  await page.getByLabel("Code postal").fill("83210");
  await page.getByLabel("Ville", { exact: true }).fill("Belgentier");
  await page.getByLabel("Frais vétérinaires (€)").fill("180");
  await page.getByLabel("Fait à").fill("Garéoult");
  await page.getByRole("button", { name: "Générer l'aperçu du mail" }).nth(1).click();
  await expect(page.getByLabel("Sujet du mail")).not.toHaveValue("");
  await page.getByRole("button", { name: "Générer et envoyer le contrat" }).click();
  await expect(page.getByText("Contrat d'adoption généré et envoyé")).toBeVisible();

  // --- Both documents are now logged ---
  await expect(page.getByRole("cell", { name: "Certificat d'engagement" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Contrat d'adoption" })).toBeVisible();
});
