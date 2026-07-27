import type { InventoryStatus } from "@/db/schema";

/**
 * Denormalized inventory status (inventoryItems.status), recomputed by the
 * application layer whenever quantity/minQuantity/expirationDate change.
 * Priority when multiple conditions apply: rupture (nothing left) > expire
 * (unusable even if some remain) > stock_bas (running low) > ok.
 */
export function computeInventoryStatus(params: {
  quantity: number;
  minQuantity: number;
  expirationDate?: string | null;
}): InventoryStatus {
  if (params.quantity <= 0) return "rupture";

  if (params.expirationDate) {
    const today = new Date().toISOString().slice(0, 10);
    if (params.expirationDate < today) return "expire";
  }

  if (params.quantity <= params.minQuantity) return "stock_bas";

  return "ok";
}
