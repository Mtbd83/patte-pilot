import { test, expect } from "@playwright/test";

/**
 * End-to-end coverage for the animaux / familles d'accueil brique.
 * Assumes the seeded test DB (see e2e/global-setup.ts): admin@example.com
 * is an admin of the "asso-test" organization.
 *
 * Each test uses a unique suffix in the names it creates so repeated runs
 * against a persistent dev DB never collide with leftover data.
 */
test.describe("Animaux et familles d'accueil", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/connexion");
    await page.getByLabel("Email").fill("admin@example.com");
    await page.getByLabel("Mot de passe").fill("Password123!");
    await page.getByRole("button", { name: "Se connecter" }).click();
  });

  test("admin ajoute une famille d'accueil, y place un animal, met à jour sa checklist santé, puis l'adopte", async ({
    page,
  }) => {
    const suffix = `${Date.now()}-${test.info().parallelIndex}`;
    const familyName = `Sophie Durand-${suffix}`;
    const animalName = `Nala-${suffix}`;

    // --- Foster family creation ---
    await page.goto("/organisations/asso-test/familles-accueil");
    await page.getByRole("button", { name: "Ajouter une famille d'accueil" }).click();
    await page.getByLabel("Prénom").fill("Sophie");
    await page.getByLabel("Nom", { exact: true }).fill(`Durand-${suffix}`);
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(page.getByText("Famille d'accueil ajoutée")).toBeVisible();
    await expect(page.getByRole("link", { name: familyName })).toBeVisible();

    // --- Animal creation, placed with that foster family ---
    await page.goto("/organisations/asso-test/animaux");
    await page.getByRole("button", { name: "Ajouter un animal" }).click();
    await page.getByLabel("Nom", { exact: true }).fill(animalName);
    await page.getByLabel("Famille d'accueil", { exact: true }).selectOption({ label: familyName });
    await page.getByRole("button", { name: "Ajouter l'animal" }).click();
    await expect(page.getByText("Animal ajouté")).toBeVisible();

    await page.getByRole("link", { name: animalName }).click();
    await expect(page.getByRole("heading", { name: animalName })).toBeVisible();
    // Let hydration settle before interacting with the lower sections of the
    // page — clicking a "use client" form before it's hydrated falls back to
    // a native (broken) form submission.
    await page.waitForLoadState("networkidle");

    // --- Health checklist update ---
    await page.getByLabel("Primo vaccin fait").check();
    await page.getByRole("button", { name: "Enregistrer la checklist" }).click();
    await expect(page.getByText("Checklist santé mise à jour")).toBeVisible();

    // --- Adoption: clears the foster-family placement ---
    await page.getByLabel("Statut", { exact: true }).selectOption({ label: "Adopté" });
    await page.getByRole("button", { name: "Changer le statut" }).click();
    await expect(page.getByText("Statut mis à jour")).toBeVisible();
    await expect(page.getByText("Statut actuel :")).toContainText("Adopté");

    // --- The foster family is now free, so it can be deactivated ---
    await page.goto("/organisations/asso-test/familles-accueil");
    await page.getByRole("link", { name: familyName }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Aucun animal hébergé actuellement.")).toBeVisible();
    await page.getByRole("button", { name: "Désactiver cette famille d'accueil" }).click();
    await expect(page.getByText("Famille d'accueil désactivée")).toBeVisible();
  });

  test("refuse de désactiver une famille d'accueil qui héberge encore un animal", async ({ page }) => {
    const suffix = `${Date.now()}-${test.info().parallelIndex}-b`;
    const familyName = `Marc Martin-${suffix}`;
    const animalName = `Rex-${suffix}`;

    await page.goto("/organisations/asso-test/familles-accueil");
    await page.getByRole("button", { name: "Ajouter une famille d'accueil" }).click();
    await page.getByLabel("Prénom").fill("Marc");
    await page.getByLabel("Nom", { exact: true }).fill(`Martin-${suffix}`);
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(page.getByText("Famille d'accueil ajoutée")).toBeVisible();

    await page.goto("/organisations/asso-test/animaux");
    await page.getByRole("button", { name: "Ajouter un animal" }).click();
    await page.getByLabel("Nom", { exact: true }).fill(animalName);
    await page.getByLabel("Espèce", { exact: true }).selectOption({ label: "Chien" });
    await page.getByLabel("Famille d'accueil", { exact: true }).selectOption({ label: familyName });
    await page.getByRole("button", { name: "Ajouter l'animal" }).click();
    await expect(page.getByText("Animal ajouté")).toBeVisible();

    await page.goto("/organisations/asso-test/familles-accueil");
    await page.getByRole("link", { name: familyName }).click();
    await page.waitForLoadState("networkidle");
    // The hosted animal legitimately appears twice (current-hosting list and
    // placement history table), so scope to the first match.
    await expect(page.getByRole("link", { name: animalName }).first()).toBeVisible();
    await page.getByRole("button", { name: "Désactiver cette famille d'accueil" }).click();
    await expect(page.getByText(/actuellement hébergé/)).toBeVisible();
  });
});
