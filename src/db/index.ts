import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// A single shared connection pool, reused across the app (and across
// hot-reloads in dev) to avoid exhausting Postgres connections.
const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };

const client =
  globalForDb.pgClient ??
  postgres(process.env.DATABASE_URL, {
    max: process.env.NODE_ENV === "production" ? 10 : 1,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client;
}

export const db = drizzle(client, { schema });
export type Db = typeof db;
