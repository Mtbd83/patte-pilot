/**
 * Integration test for the invitation flow: an admin invites someone,
 * that person accepts, and ends up with the granted roles.
 *
 * Runs against a real (test) Postgres database — point DATABASE_URL at a
 * disposable test DB before running (e.g. via docker-compose.test.yml).
 * Nodemailer is mocked so no real email is sent.
 */
jest.mock("@/lib/mailer", () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
  invitationEmailHtml: jest.fn().mockReturnValue("<p>mock</p>"),
}));

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users, organizations } from "@/db/schema";
import { createInvitation, acceptInvitation } from "@/server/actions/invitations";
import { getMemberRoles } from "@/lib/permissions";

const authMock = auth as unknown as jest.Mock;

describe("invitation flow", () => {
  let adminUserId: string;
  let inviteeUserId: string;
  let organizationId: string;

  beforeAll(async () => {
    const [admin] = await db
      .insert(users)
      .values({ email: "admin@example.com" })
      .returning();
    const [invitee] = await db
      .insert(users)
      .values({ email: "future-benevole@example.com" })
      .returning();
    if (!admin || !invitee) throw new Error("Seed setup failed: users not created.");
    adminUserId = admin.id;
    inviteeUserId = invitee.id;

    const [org] = await db
      .insert(organizations)
      .values({ name: "Asso Test", slug: "asso-test" })
      .returning();
    if (!org) throw new Error("Seed setup failed: organization not created.");
    organizationId = org.id;

    // Seed the admin as an actual org member with the admin role, using the
    // real creation action so the schema/relations are exercised end to end.
    authMock.mockResolvedValue({ user: { id: adminUserId, email: admin.email } });
    const { organizationMembers, organizationMemberRoles } = await import("@/db/schema");
    const [member] = await db
      .insert(organizationMembers)
      .values({ organizationId, userId: adminUserId })
      .returning();
    if (!member) throw new Error("Seed setup failed: member not created.");
    await db.insert(organizationMemberRoles).values({ memberId: member.id, role: "admin" });
  });

  it("lets an admin invite someone, who then accepts with the granted roles", async () => {
    authMock.mockResolvedValue({ user: { id: adminUserId, email: "admin@example.com" } });

    const invitation = await createInvitation({
      organizationId,
      email: "future-benevole@example.com",
      roles: ["benevole", "famille_accueil"],
    });

    expect(invitation.status).toBe("pending");

    authMock.mockResolvedValue({
      user: { id: inviteeUserId, email: "future-benevole@example.com" },
    });

    const result = await acceptInvitation({ token: invitation.token });
    expect(result.organizationId).toBe(organizationId);

    const roles = await getMemberRoles(inviteeUserId, organizationId);
    expect(roles.sort()).toEqual(["benevole", "famille_accueil"].sort());
  });

  it("rejects acceptance when the logged-in email doesn't match the invitation", async () => {
    authMock.mockResolvedValue({ user: { id: adminUserId, email: "admin@example.com" } });
    const invitation = await createInvitation({
      organizationId,
      email: "someone-else@example.com",
      roles: ["benevole"],
    });

    authMock.mockResolvedValue({
      user: { id: inviteeUserId, email: "future-benevole@example.com" },
    });

    await expect(acceptInvitation({ token: invitation.token })).rejects.toThrow(
      /autre adresse email/,
    );
  });
});
