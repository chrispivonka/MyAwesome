import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit runs as a plain Node CLI, not through `bun run <file>`, so
// Bun's automatic .env/.env.local loading doesn't apply here — load it
// ourselves. No-op in CI/hosting, where real env vars are already set and
// no .env files exist.
config({ path: ".env.local" });
config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
