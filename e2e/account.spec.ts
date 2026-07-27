import { test, expect } from "@playwright/test";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { organizations, organizationMembers, organizationMemberRoles, users } from "../src/db/schema";

/**
 * End-to-end coverage for personal account management (src/app/mon-compte)
 * and the "existing user accepts an invite to a second organization" path
 * (src/app/invite/[token]/page.tsx redirects to /connexion instead of
 * forcing a second signup when the invited email already has an account).
 * Assumes the seeded test DB (see e2e/global-setup.ts).
 */

async function login(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/connexion");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

test("un utilisateur peut changer son mot de passe puis se reconnecter avec le nouveau", async ({ page }) => {
  const suffix = `${Date.now()}-${test.info().parallelIndex}`;
  const email = `mdp-test-${suffix}@example.com`;

  await login(page, "admin@example.com", "Password123!");
  await page.goto("/organisations/asso-test/membres");
  await page.getByRole("button", { name: "Inviter un membre" }).click();
  const inviteDialog = page.getByRole("dialog", { name: "Inviter un membre" });
  await inviteDialog.getByLabel("Email").fill(email);
  await inviteDialog.getByLabel("Bénévole").check();
  await inviteDialog.getByRole("button", { name: "Envoyer l'invitation" }).click();
  await expect(page.getByText("Invitation envoyée")).toBeVisible();

  const inboxResponse = await page.request.get(`/api/test/inbox?to=${email}`);
  const { acceptUrl } = await inboxResponse.json();

  await page.goto(acceptUrl);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill("MotDePasseInitial123!");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/organisations\//);

  await page.goto("/mon-compte");
  await page.getByLabel("Mot de passe actuel").fill("MotDePasseInitial123!");
  await page.getByLabel("Nouveau mot de passe", { exact: true }).fill("MotDePasseModifie456!");
  await page.getByLabel("Confirmer le nouveau mot de passe").fill("MotDePasseModifie456!");
  await page.getByRole("button", { name: "Mettre à jour le mot de passe" }).click();
  await expect(page.getByText("Mot de passe mis à jour")).toBeVisible();

  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/(connexion)?$/);

  await login(page, email, "MotDePasseModifie456!");
  await expect(page).toHaveURL(/\/organisations\//);
});

test("un utilisateur peut supprimer son compte", async ({ page }) => {
  const suffix = `${Date.now()}-${test.info().parallelIndex}`;
  const email = `suppr-test-${suffix}@example.com`;

  await login(page, "admin@example.com", "Password123!");
  await page.goto("/organisations/asso-test/membres");
  await page.getByRole("button", { name: "Inviter un membre" }).click();
  const inviteDialog = page.getByRole("dialog", { name: "Inviter un membre" });
  await inviteDialog.getByLabel("Email").fill(email);
  await inviteDialog.getByLabel("Bénévole").check();
  await inviteDialog.getByRole("button", { name: "Envoyer l'invitation" }).click();
  await expect(page.getByText("Invitation envoyée")).toBeVisible();

  const inboxResponse = await page.request.get(`/api/test/inbox?to=${email}`);
  const { acceptUrl } = await inboxResponse.json();

  await page.goto(acceptUrl);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill("MotDePasseInitial123!");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/organisations\//);

  await page.goto("/mon-compte");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Mot de passe", { exact: true }).fill("MotDePasseInitial123!");
  await page.getByRole("button", { name: "Supprimer définitivement mon compte" }).click();
  await expect(page).toHaveURL(/\/$/);

  const deletedUser = await db.query.users.findFirst({ where: eq(users.email, email) });
  expect(deletedUser).toBeUndefined();
});

test("un utilisateur avec un compte existant peut rejoindre une nouvelle organisation via invitation", async ({
  page,
}) => {
  const suffix = `${Date.now()}-${test.info().parallelIndex}`;

  // A second, throwaway organization the existing "famille-accueil-test"
  // user isn't a member of yet, with the admin test account as its admin.
  const [secondOrg] = await db
    .insert(organizations)
    .values({ name: `Asso Secondaire ${suffix}`, slug: `asso-secondaire-${suffix}` })
    .returning();
  if (!secondOrg) throw new Error("Seed failed: could not create second organization.");

  const adminUser = await db.query.users.findFirst({ where: eq(users.email, "admin@example.com") });
  if (!adminUser) throw new Error("Seed failed: admin user not found.");

  const [adminMember] = await db
    .insert(organizationMembers)
    .values({ organizationId: secondOrg.id, userId: adminUser.id })
    .returning();
  if (!adminMember) throw new Error("Seed failed: could not create admin membership.");
  await db.insert(organizationMemberRoles).values({ memberId: adminMember.id, role: "admin" });

  try {
    await login(page, "admin@example.com", "Password123!");
    await page.goto(`/organisations/${secondOrg.slug}/membres`);
    await page.getByRole("button", { name: "Inviter un membre" }).click();
    const inviteDialog = page.getByRole("dialog", { name: "Inviter un membre" });
    await inviteDialog.getByLabel("Email").fill("famille-accueil-test@example.com");
    await inviteDialog.getByLabel("Bénévole").check();
    await inviteDialog.getByRole("button", { name: "Envoyer l'invitation" }).click();
    await expect(page.getByText("Invitation envoyée")).toBeVisible();

    const inboxResponse = await page.request.get(
      "/api/test/inbox?to=famille-accueil-test@example.com",
    );
    const { acceptUrl } = await inboxResponse.json();

    // Visit the invite link while NOT authenticated as the invitee: since
    // that email already has an account, the page must send us to log in
    // (not force a second signup) and come back here afterwards.
    await page.context().clearCookies();
    await page.goto(acceptUrl);
    await expect(page).toHaveURL(/\/connexion/);

    await page.getByLabel("Email").fill("famille-accueil-test@example.com");
    await page.getByLabel("Mot de passe").fill("FamilleAccueil123!");
    await page.getByRole("button", { name: "Se connecter" }).click();

    await expect(page).toHaveURL(new RegExp(`/organisations/${secondOrg.id}$`));
  } finally {
    await db.delete(organizations).where(eq(organizations.id, secondOrg.id));
  }
});

test("un utilisateur peut quitter une organisation tout en restant membre d'une autre", async ({ page }) => {
  const suffix = `${Date.now()}-${test.info().parallelIndex}`;
  const orgName = `Org Temporaire ${suffix}`;

  const [tempOrg] = await db.insert(organizations).values({ name: orgName, slug: `org-temp-${suffix}` }).returning();
  if (!tempOrg) throw new Error("Seed failed: could not create temp organization.");

  const faUser = await db.query.users.findFirst({
    where: eq(users.email, "famille-accueil-test@example.com"),
  });
  if (!faUser) throw new Error("Seed failed: famille-accueil-test user not found.");

  // The fixture org's display name is real, user-editable data (not a
  // fixture this suite controls), so it's looked up rather than hardcoded.
  const mainOrg = await db.query.organizations.findFirst({ where: eq(organizations.slug, "asso-test") });
  if (!mainOrg) throw new Error("Seed failed: asso-test organization not found.");

  const [tempMember] = await db
    .insert(organizationMembers)
    .values({ organizationId: tempOrg.id, userId: faUser.id })
    .returning();
  if (!tempMember) throw new Error("Seed failed: could not create temp membership.");
  await db.insert(organizationMemberRoles).values({ memberId: tempMember.id, role: "benevole" });

  try {
    await login(page, "famille-accueil-test@example.com", "FamilleAccueil123!");
    await page.goto("/mon-compte");

    await expect(page.getByText(mainOrg.name, { exact: true })).toBeVisible();
    await expect(page.getByText(orgName)).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("listitem")
      .filter({ hasText: orgName })
      .getByRole("button", { name: "Quitter" })
      .click();

    await expect(page.getByText(`Vous avez quitté "${orgName}"`)).toBeVisible();
    await expect(page.getByText(orgName)).toHaveCount(0);
    await expect(page.getByText(mainOrg.name, { exact: true })).toBeVisible();
  } finally {
    await db.delete(organizations).where(eq(organizations.id, tempOrg.id));
  }
});
