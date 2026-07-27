import { test, expect, type Page } from "@playwright/test";

/**
 * End-to-end coverage for role-based permissions (see src/lib/permissions.ts):
 * admins can manage everything; bénévoles and familles d'accueil (FA) get
 * read-only access to animaux/stock/familles-accueil/candidatures and are
 * refused on comptabilité/membres/paramètres and on any detail/management
 * page. A FA additionally gets edit rights on the health checklist of an
 * animal currently placed with her — and only that.
 *
 * Assumes the seeded test DB (see e2e/global-setup.ts): a bénévole
 * (benevole-test@example.com) and a famille d'accueil
 * (famille-accueil-test@example.com) are already members of "asso-test".
 * Each test uses a unique suffix in the names it creates so repeated runs
 * against a persistent dev DB never collide with leftover data.
 */

async function login(page: Page, email: string, password: string) {
  await page.goto("/connexion");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

test.describe("Bénévole", () => {
  test("accède en lecture seule aux animaux, au stock, aux familles d'accueil et aux candidatures", async ({
    page,
  }) => {
    await login(page, "benevole-test@example.com", "Benevole123!");

    await page.goto("/organisations/asso-test/animaux");
    await expect(page.getByRole("heading", { name: "Animaux" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ajouter un animal" })).toHaveCount(0);

    await page.goto("/organisations/asso-test/stock");
    await expect(page.getByRole("heading", { name: "Stock" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ajouter un article" })).toHaveCount(0);

    await page.goto("/organisations/asso-test/familles-accueil");
    await expect(page.getByRole("heading", { name: "Familles d'accueil" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ajouter une famille d'accueil" })).toHaveCount(0);

    await page.goto("/organisations/asso-test/candidatures");
    await expect(page.getByRole("heading", { name: "Candidatures d'adoption" })).toBeVisible();
  });

  test("se voit refuser la comptabilité, les membres, les paramètres et les pages de détail admin", async ({
    page,
  }) => {
    const suffix = `${Date.now()}-${test.info().parallelIndex}`;
    const familyName = `Alice Refus-${suffix}`;
    const applicantEmail = `candidat-refus-${suffix}@example.com`;

    // --- Admin creates fixtures whose detail pages we'll probe below ---
    await login(page, "admin@example.com", "Password123!");

    await page.goto("/organisations/asso-test/familles-accueil");
    await page.getByRole("button", { name: "Ajouter une famille d'accueil" }).click();
    await page.getByLabel("Prénom").fill("Alice");
    await page.getByLabel("Nom", { exact: true }).fill(`Refus-${suffix}`);
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(page.getByText("Famille d'accueil ajoutée")).toBeVisible();
    await page.getByRole("link", { name: familyName }).click();
    await expect(page.getByRole("heading", { name: familyName })).toBeVisible();
    const fosterFamilyUrl = page.url();

    await page.goto("/organisations/asso-test/adopter");
    await page.getByLabel("Prénom", { exact: true }).fill("Candidat");
    await page.getByLabel("Nom", { exact: true }).fill(`Refus-${suffix}`);
    await page.getByLabel("Téléphone").fill("0600000000");
    await page.getByLabel("Adresse mail").fill(applicantEmail);
    await page.getByRole("button", { name: "Envoyer ma candidature" }).click();
    await expect(page.getByRole("heading", { name: "Merci !" })).toBeVisible();

    await login(page, "admin@example.com", "Password123!");
    await page.goto("/organisations/asso-test/candidatures");
    await page.getByRole("row", { name: new RegExp(applicantEmail) }).getByRole("link").click();
    await expect(page.getByRole("heading", { name: `Candidat Refus-${suffix}` })).toBeVisible();
    const candidatureUrl = page.url();

    // --- Bénévole is refused on every admin-only page ---
    await login(page, "benevole-test@example.com", "Benevole123!");

    await page.goto("/organisations/asso-test/comptabilite");
    await expect(page.getByText("Accès refusé")).toBeVisible();

    await page.goto("/organisations/asso-test/membres");
    await expect(page.getByText("Accès refusé")).toBeVisible();

    await page.goto("/organisations/asso-test/parametres");
    await expect(page.getByText("Accès refusé")).toBeVisible();

    await page.goto(fosterFamilyUrl);
    await expect(page.getByText("Accès refusé")).toBeVisible();

    await page.goto(candidatureUrl);
    await expect(page.getByText("Accès refusé")).toBeVisible();
  });
});

test.describe("Famille d'accueil", () => {
  test("peut modifier uniquement la checklist santé de l'animal dont elle a la responsabilité", async ({
    page,
  }) => {
    const suffix = `${Date.now()}-${test.info().parallelIndex}`;
    const responsibleFamilyName = `Claire Responsable-${suffix}`;
    const otherFamilyName = `Denis Autre-${suffix}`;
    const responsibleAnimalName = `Tigrou-${suffix}`;
    const otherAnimalName = `Milo-${suffix}`;

    // --- Admin sets up two foster families, links one to the FA test account ---
    await login(page, "admin@example.com", "Password123!");

    await page.goto("/organisations/asso-test/familles-accueil");
    await page.getByRole("button", { name: "Ajouter une famille d'accueil" }).click();
    await page.getByLabel("Prénom").fill("Claire");
    await page.getByLabel("Nom", { exact: true }).fill(`Responsable-${suffix}`);
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(page.getByText("Famille d'accueil ajoutée")).toBeVisible();

    await page.getByRole("button", { name: "Ajouter une famille d'accueil" }).click();
    await page.getByLabel("Prénom").fill("Denis");
    await page.getByLabel("Nom", { exact: true }).fill(`Autre-${suffix}`);
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(page.getByText("Famille d'accueil ajoutée")).toBeVisible();

    await page.getByRole("link", { name: responsibleFamilyName }).click();
    await page.waitForLoadState("networkidle");
    await page
      .getByLabel("Compte utilisateur lié")
      .selectOption({ label: "famille-accueil-test@example.com" });
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Famille d'accueil mise à jour")).toBeVisible();

    // --- One animal placed with each family ---
    await page.goto("/organisations/asso-test/animaux");
    await page.getByRole("button", { name: "Ajouter un animal" }).click();
    await page.getByLabel("Nom", { exact: true }).fill(responsibleAnimalName);
    await page.getByLabel("Famille d'accueil", { exact: true }).selectOption({ label: responsibleFamilyName });
    await page.getByRole("button", { name: "Ajouter l'animal" }).click();
    await expect(page.getByText("Animal ajouté")).toBeVisible();

    await page.goto("/organisations/asso-test/animaux");
    await page.getByRole("button", { name: "Ajouter un animal" }).click();
    await page.getByLabel("Nom", { exact: true }).fill(otherAnimalName);
    await page.getByLabel("Famille d'accueil", { exact: true }).selectOption({ label: otherFamilyName });
    await page.getByRole("button", { name: "Ajouter l'animal" }).click();
    await expect(page.getByText("Animal ajouté")).toBeVisible();

    // --- Log in as the FA test account ---
    await login(page, "famille-accueil-test@example.com", "FamilleAccueil123!");

    // Her own animal: the checklist is editable, the rest of the sheet isn't.
    await page.goto("/organisations/asso-test/animaux");
    await page.getByRole("link", { name: responsibleAnimalName }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Ajouter une photo" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Changer le statut" })).toHaveCount(0);
    await expect(page.getByLabel("Primo vaccin fait")).toBeEnabled();
    await page.getByLabel("Primo vaccin fait").check();
    await page.getByRole("button", { name: "Enregistrer la checklist" }).click();
    await expect(page.getByText("Checklist santé mise à jour")).toBeVisible();

    // Another foster family's animal: the checklist stays read-only too.
    await page.goto("/organisations/asso-test/animaux");
    await page.getByRole("link", { name: otherAnimalName }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByLabel("Primo vaccin fait")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Enregistrer la checklist" })).toHaveCount(0);
  });
});
