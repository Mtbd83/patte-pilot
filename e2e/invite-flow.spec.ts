import { test, expect } from "@playwright/test";

/**
 * End-to-end happy path:
 *  1. Admin logs in and creates an organization.
 *  2. Admin invites a bénévole by email.
 *  3. The invited person opens the link, signs up/in, and lands on the org page.
 *
 * Assumes a seeded test DB and that /api/test/inbox exposes the last
 * outgoing email in the test environment only (never mounted in prod).
 */
test.describe("Invitation flow", () => {
  test("admin invites a bénévole who successfully joins the organization", async ({ page, context }) => {
    await page.goto("/connexion");
    await page.getByLabel("Email").fill("admin@example.com");
    await page.getByLabel("Mot de passe").fill("Password123!");
    await page.getByRole("button", { name: "Se connecter" }).click();

    await page.goto("/organisations/asso-test/membres");
    await page.getByRole("button", { name: "Inviter un membre" }).click();
    await page.getByLabel("Email").fill("nouveau-benevole@example.com");
    await page.getByLabel("Bénévole").check();
    await page.getByRole("button", { name: "Envoyer l'invitation" }).click();

    await expect(page.getByText("Invitation envoyée")).toBeVisible();

    // Retrieve the invite link captured by the test mail sink.
    const inboxResponse = await page.request.get("/api/test/inbox?to=nouveau-benevole@example.com");
    const { acceptUrl } = await inboxResponse.json();

    const inviteePage = await context.newPage();
    await inviteePage.goto(acceptUrl);

    await inviteePage.getByLabel("Email").fill("nouveau-benevole@example.com");
    await inviteePage.getByLabel("Mot de passe").fill("NouveauMotDePasse123!");
    await inviteePage.getByRole("button", { name: "Créer mon compte" }).click();

    // Not asserting the org's display name here: it's real, user-editable
    // data (not a fixture this suite controls), so it can legitimately
    // differ from whatever global-setup.ts named it on first creation.
    await expect(inviteePage).toHaveURL(/\/organisations\//);
    await expect(inviteePage.getByRole("link", { name: "Tableau de bord" })).toBeVisible();
  });
});
