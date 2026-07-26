import { test, expect } from "@playwright/test";

/**
 * End-to-end coverage for the comptabilité / stock brique.
 * Assumes the seeded test DB (see e2e/global-setup.ts): admin@example.com
 * is an admin of the "asso-test" organization.
 *
 * Names/comments use a unique suffix per run so repeated runs against a
 * persistent dev DB never collide with leftover data, and totals from
 * previous runs are never asserted on (only this run's own rows are).
 */
test.describe("Comptabilité et stock", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/connexion");
    await page.getByLabel("Email").fill("admin@example.com");
    await page.getByLabel("Mot de passe").fill("Password123!");
    await page.getByRole("button", { name: "Se connecter" }).click();
  });

  test("admin ajoute une écriture comptable puis la supprime", async ({ page }) => {
    const suffix = `${Date.now()}-${test.info().parallelIndex}`;
    const comment = `Don test-${suffix}`;

    await page.goto("/organisations/asso-test/comptabilite");
    await page.getByRole("button", { name: "Ajouter une écriture" }).click();
    await page.getByLabel("Type", { exact: true }).selectOption({ label: "Entrée" });
    await page.getByLabel("Montant (€)").fill("42.50");
    await page.getByLabel("Commentaire").fill(comment);
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(page.getByText("Écriture ajoutée")).toBeVisible();

    const row = page.getByRole("row", { name: new RegExp(comment) });
    await expect(row).toBeVisible();
    await expect(row.getByText("42.50 €")).toBeVisible();

    await row.getByRole("button", { name: "Supprimer" }).click();
    await expect(page.getByText("Écriture supprimée")).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(comment) })).toHaveCount(0);
  });

  test("admin gère un article de stock : création, ajustement de quantité, modification et suppression", async ({
    page,
  }) => {
    const suffix = `${Date.now()}-${test.info().parallelIndex}-b`;
    const articleName = `Croquettes test-${suffix}`;

    await page.goto("/organisations/asso-test/stock");
    await page.getByRole("button", { name: "Ajouter un article" }).click();
    await page.getByLabel("Article", { exact: true }).fill(articleName);
    await page.getByLabel("Quantité").fill("5");
    await page.getByLabel("Stock min.").fill("10");
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(page.getByText("Article ajouté")).toBeVisible();

    const row = page.getByRole("row", { name: new RegExp(articleName) });
    await expect(row).toBeVisible();
    await expect(row.getByText("Stock bas")).toBeVisible();

    // Bring quantity above the minimum: status should flip back to OK.
    for (let i = 0; i < 6; i += 1) {
      await row.getByRole("button", { name: "+", exact: true }).click();
    }
    await expect(row.locator("span", { hasText: "11" })).toBeVisible();
    await expect(row.getByText("OK", { exact: true })).toBeVisible();

    // Editing with a past expiration date should flip status to "Expiré".
    await row.getByRole("button", { name: "Modifier" }).click();
    await page.getByLabel("Expiration").fill("2000-01-01");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Article mis à jour")).toBeVisible();
    await expect(row.getByText("Expiré")).toBeVisible();

    await row.getByRole("button", { name: "Supprimer" }).click();
    await expect(page.getByText("Article supprimé")).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(articleName) })).toHaveCount(0);
  });
});
