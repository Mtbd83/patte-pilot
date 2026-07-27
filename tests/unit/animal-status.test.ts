import { statusRequiresFosterFamily, STATUSES_REQUIRING_FOSTER_FAMILY } from "@/lib/animal-status";
import type { AnimalStatus } from "@/db/schema";

describe("statusRequiresFosterFamily", () => {
  it.each(STATUSES_REQUIRING_FOSTER_FAMILY)("returns true for %s", (status) => {
    expect(statusRequiresFosterFamily(status)).toBe(true);
  });

  it.each<AnimalStatus>(["adopte", "archive"])("returns false for %s", (status) => {
    expect(statusRequiresFosterFamily(status)).toBe(false);
  });
});
