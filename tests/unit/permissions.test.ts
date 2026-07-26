// Mock the db module before importing the code under test.
jest.mock("@/db", () => ({
  db: {
    query: {
      organizationMembers: {
        findFirst: jest.fn(),
      },
    },
  },
}));

import { db } from "@/db";
import { getMemberRoles, requireRole, requireAdmin, ForbiddenError } from "@/lib/permissions";

const findFirstMock = db.query.organizationMembers.findFirst as unknown as jest.Mock;

describe("getMemberRoles", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
  });

  it("returns an empty array when the user is not a member", async () => {
    findFirstMock.mockResolvedValue(undefined);
    const roles = await getMemberRoles("user-1", "org-1");
    expect(roles).toEqual([]);
  });

  it("returns all roles held by the member", async () => {
    findFirstMock.mockResolvedValue({
      id: "member-1",
      roles: [{ role: "admin" }, { role: "famille_accueil" }],
    });
    const roles = await getMemberRoles("user-1", "org-1");
    expect(roles).toEqual(["admin", "famille_accueil"]);
  });
});

describe("requireRole", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
  });

  it("throws ForbiddenError when the member lacks any allowed role", async () => {
    findFirstMock.mockResolvedValue({ id: "member-1", roles: [{ role: "benevole" }] });
    await expect(requireRole("user-1", "org-1", ["admin"])).rejects.toThrow(ForbiddenError);
  });

  it("resolves when the member has one of the allowed roles", async () => {
    findFirstMock.mockResolvedValue({ id: "member-1", roles: [{ role: "admin" }] });
    await expect(requireRole("user-1", "org-1", ["admin", "benevole"])).resolves.toEqual([
      "admin",
    ]);
  });
});

describe("requireAdmin", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
  });

  it("rejects non-admin members", async () => {
    findFirstMock.mockResolvedValue({ id: "member-1", roles: [{ role: "famille_accueil" }] });
    await expect(requireAdmin("user-1", "org-1")).rejects.toThrow(ForbiddenError);
  });
});
