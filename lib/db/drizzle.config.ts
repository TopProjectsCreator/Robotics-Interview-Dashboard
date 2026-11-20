import { defineConfig } from "drizzle-kit";
import path from "path";

const primaryDatabaseUrl =
  process.env.PRIMARY_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();

if (!primaryDatabaseUrl) throw new Error("PRIMARY_DATABASE_URL or DATABASE_URL must be set.");

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: primaryDatabaseUrl,
  },
});
