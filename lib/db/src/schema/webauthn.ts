import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { interviewerAccountsTable } from "./interviewerAccounts";

/**
 * Passkeys (WebAuthn credentials) stored alongside passwords — never instead
 * of them. `public_key` is base64url text so no custom Postgres type is
 * needed; it is decoded to bytes when verifying an assertion. `origin` is
 * the URL the passkey was created on (the authenticator's clientDataJSON
 * origin, falling back to the registration request's origin). NULL means
 * the credential predates origin tracking. Keeping it lets sign-in verify
 * against the site the passkey belongs to even when the dashboard is
 * reached through a mirror origin, instead of trusting only the origin
 * that happens to make the login request.
 */
export const webauthnCredentialsTable = pgTable("webauthn_credentials", {
  id: text("id").primaryKey(),
  interviewerId: text("interviewer_id")
    .notNull()
    .references(() => interviewerAccountsTable.id, { onDelete: "cascade" }),
  credentialId: text("credential_id").notNull().unique(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull().default(0),
  transports: text("transports").notNull().default("[]"),
  label: text("label"),
  origin: text("origin"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export const insertWebauthnCredentialSchema = createInsertSchema(webauthnCredentialsTable).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
});

export type WebauthnCredential = typeof webauthnCredentialsTable.$inferSelect;
export type InsertWebauthnCredential = z.infer<typeof insertWebauthnCredentialSchema>;
