import { computeInventoryStatus } from "@/lib/inventory-status";

describe("computeInventoryStatus", () => {
  it("returns rupture when quantity is zero", () => {
    expect(computeInventoryStatus({ quantity: 0, minQuantity: 0 })).toBe("rupture");
  });

  it("returns expire when past its expiration date, even with healthy quantity", () => {
    expect(
      computeInventoryStatus({ quantity: 50, minQuantity: 5, expirationDate: "2000-01-01" }),
    ).toBe("expire");
  });

  it("prioritizes rupture over an expired date", () => {
    expect(
      computeInventoryStatus({ quantity: 0, minQuantity: 5, expirationDate: "2000-01-01" }),
    ).toBe("rupture");
  });

  it("returns stock_bas when quantity is at or below minQuantity", () => {
    expect(computeInventoryStatus({ quantity: 5, minQuantity: 5 })).toBe("stock_bas");
    expect(computeInventoryStatus({ quantity: 3, minQuantity: 5 })).toBe("stock_bas");
  });

  it("returns ok when quantity is healthy and not expired", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);
    expect(computeInventoryStatus({ quantity: 50, minQuantity: 5, expirationDate: future })).toBe(
      "ok",
    );
  });

  it("returns ok when no expiration date is set", () => {
    expect(computeInventoryStatus({ quantity: 50, minQuantity: 5, expirationDate: null })).toBe(
      "ok",
    );
  });
});
