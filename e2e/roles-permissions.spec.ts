import { test, expect, type Page } from "@playwright/test";

/**
 * End-to-end coverage for role-based permissions (see src/lib/permissions.ts):
 * admins can manage everything; bénévoles and familles d'accueil (FA) get
 * read-only access to animaux/stock/familles-accueil/candidatures and are
 * refused on comptabilité/membres/paramètres and on any detail/management
 * page. A FA additionally gets edit rights, on an animal currently placed
 * with her, on: the health checklist, the description (personality/needs),
 * and adding a photo when there isn't one yet (not replacing an existing
 * one) — nothing else on the sheet. A bénévole is also the
 * one exception to "read-only candidatures": she can open a candidature's
 * detail page and change its status / record the adopted animal (FA can't
 * open the detail page at all); the certificate/contract-sending cards on
 * that detail page stay admin-only even for her.
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
    await page.getByLabel("Ville", { exact: true }).fill("Toulon");
    await page.getByLabel("Téléphone").fill("0600000000");
    await page.getByLabel("Adresse mail").fill(applicantEmail);
    await page.getByLabel("Quel âge avez-vous ?").fill("35");
    await page.getByLabel("Votre logement est en zone").selectOption({ label: "Urbaine" });
    await page.getByLabel("Votre logement est un/une").selectOption({ label: "Appartement" });
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
    await page.getByLabel("Qui se chargera de soigner (et sortir si chien) l'animal ?").fill("Moi");
    await page.getByLabel("Dans quel espace l'animal dormira ?").fill("Salon");
    await page.getByLabel("Type d'animal souhaité").selectOption({ label: "Chat" });
    await page.getByRole("button", { name: "Envoyer ma candidature" }).click();
    await expect(page.getByRole("heading", { name: "Merci !" })).toBeVisible();

    await login(page, "admin@example.com", "Password123!");
    await page.goto("/organisations/asso-test/candidatures");
    await page.getByRole("row", { name: new RegExp(`Candidat Refus-${suffix}`) }).getByRole("link").click();
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

    // ...but the candidature detail page is one place she IS let in — just
    // without the certificate/contract-sending cards, which stay admin-only.
    await page.goto(candidatureUrl);
    await expect(page.getByText("Accès refusé")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: `Candidat Refus-${suffix}` })).toBeVisible();
    await expect(page.getByText("Statut de la candidature")).toBeVisible();
    await expect(page.getByText("Certificat d'engagement")).toHaveCount(0);
    await expect(page.getByText("Contrat d'adoption")).toHaveCount(0);

    // --- Famille d'accueil still gets refused on the candidature detail ---
    await login(page, "famille-accueil-test@example.com", "FamilleAccueil123!");
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

    // Her own animal: checklist, description and (photo-less) photo upload
    // are all editable — the rest of the sheet isn't.
    await page.goto("/organisations/asso-test/animaux");
    await page.getByRole("link", { name: responsibleAnimalName }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Changer le statut" })).toHaveCount(0);

    await expect(page.getByRole("button", { name: "Ajouter une photo" })).toBeVisible();
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Ajouter une photo" }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({ name: "photo.jpg", mimeType: "image/jpeg", buffer: Buffer.from("fake") });
    await expect(page.getByText("Photo mise à jour")).toBeVisible();
    // Now that it has a photo, she can no longer replace it.
    await expect(page.getByRole("button", { name: "Ajouter une photo" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Changer la photo" })).toHaveCount(0);

    await page.getByLabel("Description").fill("Câlin, un peu craintif avec les autres chats.");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Description mise à jour")).toBeVisible();

    await expect(page.getByLabel("Primo vaccin fait")).toBeEnabled();
    await page.getByLabel("Primo vaccin fait").check();
    await page.getByRole("button", { name: "Enregistrer la checklist" }).click();
    await expect(page.getByText("Checklist santé mise à jour")).toBeVisible();

    // Another foster family's animal: none of that is available.
    await page.goto("/organisations/asso-test/animaux");
    await page.getByRole("link", { name: otherAnimalName }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Ajouter une photo" })).toHaveCount(0);
    await expect(page.getByLabel("Description")).toHaveCount(0);
    await expect(page.getByLabel("Primo vaccin fait")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Enregistrer la checklist" })).toHaveCount(0);
  });
});

test("un bénévole peut changer le statut d'une candidature et l'animal adopté, une famille d'accueil non", async ({
  page,
}) => {
  const suffix = `${Date.now()}-${test.info().parallelIndex}`;
  const animalName = `PermStatus-${suffix}`;
  const applicantEmail = `perm-status-${suffix}@example.com`;

  await login(page, "admin@example.com", "Password123!");

  await page.goto("/organisations/asso-test/animaux");
  await page.getByRole("button", { name: "Ajouter un animal" }).click();
  await page.getByLabel("Nom", { exact: true }).fill(animalName);
  await page.getByLabel("Statut", { exact: true }).selectOption({ label: "Adopté" });
  await page.getByRole("button", { name: "Ajouter l'animal" }).click();
  await expect(page.getByText("Animal ajouté")).toBeVisible();

  await page.goto("/organisations/asso-test/adopter");
  await page.getByLabel("Prénom", { exact: true }).fill("Perm");
  await page.getByLabel("Nom", { exact: true }).fill(`Status-${suffix}`);
  await page.getByLabel("Ville", { exact: true }).fill("Toulon");
  await page.getByLabel("Téléphone").fill("0600000000");
  await page.getByLabel("Adresse mail").fill(applicantEmail);
  await page.getByLabel("Quel âge avez-vous ?").fill("35");
  await page.getByLabel("Votre logement est en zone").selectOption({ label: "Urbaine" });
  await page.getByLabel("Votre logement est un/une").selectOption({ label: "Appartement" });
  await page.getByLabel("Quelle est votre profession ?").fill("Vétérinaire");
  await page.getByLabel("Vous êtes").selectOption({ label: "Propriétaire" });
  await page.getByLabel("Vivez-vous", { exact: true }).selectOption({ label: "En couple" });
  await page.getByLabel("De combien de personnes se compose la famille ?").fill("2");
  await page.getByLabel("Dont combien d'enfants ?").fill("0");
  await page.getByLabel("Quel est le niveau d'activité de la famille ?").selectOption({ label: "Modéré" });
  await page.getByLabel("Combien de temps l'animal restera seul par jour ?").selectOption({ label: "2h à 4h" });
  await page
    .getByLabel("Que ferez-vous de votre animal pendant les weekends / vacances ?")
    .fill("Il viendra avec nous.");
  await page.getByLabel("Qui se chargera de soigner (et sortir si chien) l'animal ?").fill("Moi");
  await page.getByLabel("Dans quel espace l'animal dormira ?").fill("Salon");
  await page.getByLabel("Type d'animal souhaité").selectOption({ label: "Chat" });
  await page.getByRole("button", { name: "Envoyer ma candidature" }).click();
  await expect(page.getByRole("heading", { name: "Merci !" })).toBeVisible();

  // --- Bénévole: can change the status and record the adopted animal ---
  await login(page, "benevole-test@example.com", "Benevole123!");
  await page.goto("/organisations/asso-test/candidatures");
  const row = page.getByRole("row", { name: new RegExp(`Perm Status-${suffix}`) });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Modifier le statut" }).click();
  await row.getByLabel("Statut").selectOption({ label: "Retenue" });
  await row.getByLabel("Animal adopté").selectOption({ label: animalName });
  await row.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Statut mis à jour")).toBeVisible();

  await page.goto("/organisations/asso-test/candidatures");
  const rowAfter = page.getByRole("row", { name: new RegExp(`Perm Status-${suffix}`) });
  await expect(rowAfter.getByRole("link", { name: animalName })).toBeVisible();
  await expect(rowAfter.getByRole("button", { name: "Supprimer" })).toHaveCount(0);

  // --- Famille d'accueil: read-only, no status control, no delete ---
  await login(page, "famille-accueil-test@example.com", "FamilleAccueil123!");
  await page.goto("/organisations/asso-test/candidatures");
  const faRow = page.getByRole("row", { name: new RegExp(`Perm Status-${suffix}`) });
  await expect(faRow).toBeVisible();
  await expect(faRow.getByRole("combobox")).toHaveCount(0);
  await expect(faRow.getByRole("button", { name: "Supprimer" })).toHaveCount(0);
  await expect(faRow.getByText("Retenue")).toBeVisible();
});
