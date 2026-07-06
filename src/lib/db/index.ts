import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// Each concurrent Lambda instance holds its own pool — cap it at 1 so a
// burst of concurrent invocations can't exhaust Neon's connection limit.
// Pair with Neon's pooled (PgBouncer) connection string in production.
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

export const db = drizzle(sql, { schema });
