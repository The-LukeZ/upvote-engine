import { sqliteTable, text, integer, blob, primaryKey, foreignKey } from "drizzle-orm/sqlite-core";
import { DrizzleDB } from "../../types";
import { and, eq } from "drizzle-orm";
import { _NonNullableFields } from "discord-api-types/v10";

export const applications = sqliteTable(
  "applications",
  {
    applicationId: text("application_id").notNull(),
    source: text("source", { enum: ["topgg", "dbl"] }).notNull(),
    secret: text("secret"),
    guildId: text("guild_id"),
    voteRoleId: text("vote_role_id"),
    roleDurationSeconds: integer("role_duration_seconds"),
    invalidRequests: integer("invalid_requests").default(0),
    createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  },
  (table) => [primaryKey({ columns: [table.applicationId, table.source] })],
);

export const forwardings = sqliteTable("forwardings", {
  applicationId: text("application_id").notNull(), // Removed .references() to avoid FK mismatch
  targetUrl: text("target_url").notNull(),
  secret: text("secret").notNull(),
  iv: text("iv").notNull(), // Initialization vector for AES encryption
});

export const votes = sqliteTable(
  "votes",
  {
    id: blob("id", { mode: "bigint" }).primaryKey(), // Snowflake ID by top.gg
    applicationId: text("application_id").notNull(),
    source: text("source", { enum: ["topgg", "dbl"] }).notNull(),
    guildId: text("guild_id"),
    userId: text("user_id").notNull(),
    roleId: text("role_id"),
    hasRole: integer("has_role", { mode: "boolean" }).notNull().default(false), // 1 = true, 0 = false
    expiresAt: text("expires_at"),
  },
  (table) => [
    foreignKey({
      name: "fk_votes_application",
      columns: [table.applicationId, table.source],
      foreignColumns: [applications.applicationId, applications.source],
    }),
  ],
);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // Discord User ID
  dmId: text("dm_id").unique(),
});

export const blacklist = sqliteTable("blacklist", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  guildId: text("guild_id"),
  userId: text("user_id"),
  applicationId: text("application_id"),
  reason: text("reason"),
});

export const verifications = sqliteTable("verifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  applicationId: text("application_id").notNull(),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  verified: integer("verified", { mode: "boolean" }).notNull().default(false),
});

// Separate table for storing owner access tokens
export const owners = sqliteTable("owners", {
  userId: text("user_id").primaryKey(), // Discord User ID
  accessToken: text("access_token").notNull(),
  iv: text("iv").notNull(), // Initialization vector for AES encryption
  expiresAt: text("expires_at").notNull(),
  scope: text("scope").notNull(), // example: "applications.entitlements identify"
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export type ApplicationCfg = typeof applications.$inferSelect;
export type NewApplicationCfg = typeof applications.$inferInsert;

export type Vote = typeof votes.$inferSelect;
export type NewVote = typeof votes.$inferInsert;
export type APIVote = _NonNullableFields<Omit<Vote, "id"> & { id: string }>;

export type ForwardingCfg = typeof forwardings.$inferSelect;
export type NewForwardingCfg = typeof forwardings.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type BlacklistEntry = typeof blacklist.$inferSelect;
export type NewBlacklistEntry = typeof blacklist.$inferInsert;

export type VerificationEntry = typeof verifications.$inferSelect;
export type NewVerificationEntry = typeof verifications.$inferInsert;

export type OwnerToken = typeof owners.$inferSelect;
export type NewOwnerToken = typeof owners.$inferInsert;

export async function deleteApplicationCascade(db: DrizzleDB, applicationId: string, source: string, guildId: string) {
  // Delete related forwardings
  await db.delete(forwardings).where(eq(forwardings.applicationId, applicationId));

  // Delete related votes
  await db.delete(votes).where(and(eq(votes.applicationId, applicationId), eq(votes.source, source as any), eq(votes.guildId, guildId)));

  // Delete the application
  await db
    .delete(applications)
    .where(and(eq(applications.applicationId, applicationId), eq(applications.source, source as any), eq(applications.guildId, guildId)));
}

export async function isUserVerifiedForApplication(
  db: DrizzleDB,
  applicationId: string,
  guildId: string,
  userId: string,
): Promise<boolean> {
  const verification = await db
    .select()
    .from(verifications)
    .where(
      and(
        eq(verifications.applicationId, applicationId),
        eq(verifications.guildId, guildId),
        eq(verifications.userId, userId),
        eq(verifications.verified, true),
      ),
    )
    .limit(1)
    .get();

  return !!verification;
}

export class Cryptor {
  private key: CryptoKey | null = null;

  constructor(private readonly secret: string) {}

  /**
   * Generates a CryptoKey from the provided secret. This is done once and cached.
   */
  private async getKey(): Promise<CryptoKey> {
    if (this.key) return this.key;

    const enc = new TextEncoder();
    this.key = await crypto.subtle.importKey(
      "raw",
      enc.encode(this.secret.padEnd(32, "0").slice(0, 32)), // Ensure 32 bytes for AES-256
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
    return this.key;
  }

  /**
   * Generates a random IV for AES-GCM encryption.
   */
  private generateIV(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(12)); // AES-GCM standard IV length
  }

  public async encryptToken(token: string): Promise<{ token: string; iv: string }> {
    const enc = new TextEncoder();
    const iv = this.generateIV();
    const key = await this.getKey();

    const encryptedBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, enc.encode(token));

    return {
      token: Buffer.from(encryptedBuffer).toString("base64"),
      iv: Buffer.from(iv).toString("base64"),
    };
  }

  public async decryptToken(encryptedToken: string, iv: string): Promise<string> {
    const key = await this.getKey();
    const dec = new TextDecoder();

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: Buffer.from(iv, "base64") },
      key,
      Buffer.from(encryptedToken, "base64"),
    );

    return dec.decode(decryptedBuffer);
  }
}
