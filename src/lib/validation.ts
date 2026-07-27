import { z } from "zod";

/** ISO date string (YYYY-MM-DD), matching Drizzle's `date()` column string mode. */
export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide (AAAA-MM-JJ).");
