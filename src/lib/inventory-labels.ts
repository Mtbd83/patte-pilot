import type { InventoryCategory, InventoryStatus } from "@/db/schema";

export const INVENTORY_CATEGORY_LABELS: Record<InventoryCategory, string> = {
  nourriture: "Nourriture",
  materiel: "Matériel",
  medical: "Médical",
  hygiene: "Hygiène",
  autre: "Autre",
};

export const INVENTORY_STATUS_LABELS: Record<InventoryStatus, string> = {
  ok: "OK",
  stock_bas: "Stock bas",
  expire: "Expiré",
  rupture: "Rupture",
};
