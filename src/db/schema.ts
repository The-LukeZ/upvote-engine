import { sqliteTable, text, integer, blob, primaryKey, foreignKey } from "drizzle-orm/sqlite-core";
import { DrizzleDB } from "../../types";
import { and, eq } from "drizzle-orm";

export const applications = sqliteTable(
  "applications",
  {
    applicationId: text("application_id").notNull(),
    source: text("source", { enum: ["topgg", "dbl"] }).notNull(),
    secret: text("secret").notNull().unique(),
    guildId: text("guild_id").notNull(),
    voteRoleId: text("vote_role_id").notNull(),
    roleDurationSeconds: integer("role_duration_seconds"),
    createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  },
  (table) => [primaryKey({ columns: [table.applicationId, table.source, table.guildId] })],
);

export const forwardings = sqliteTable("forwardings", {
  applicationId: text("application_id").notNull(), // Removed .references() to avoid FK mismatch
  targetUrl: text("target_url").notNull(),
  secret: text("secret").notNull(),
});

export const votes = sqliteTable(
  "votes",
  {
    id: blob("id", { mode: "bigint" }).primaryKey(), // Snowflake ID
    applicationId: text("application_id").notNull(),
    source: text("source", { enum: ["topgg", "dbl"] }).notNull(),
    guildId: text("guild_id").notNull(),
    userId: text("user_id").notNull(),
    roleId: text("role_id").notNull(),
    hasRole: integer("has_role", { mode: "boolean" }).notNull().default(false), // 1 = true, 0 = false
    expiresAt: text("expires_at"),
  },
  (table) => [
    foreignKey({
      name: "fk_votes_application",
      columns: [table.applicationId, table.source, table.guildId],
      foreignColumns: [applications.applicationId, applications.source, applications.guildId],
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
  userId: text("user_id").notNull(), // The requesting user id (user trying to verify ownership)
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  emojiId: text("emoji_id"), // The emoji being verified (ID or markdown)
  verified: integer("verified", { mode: "boolean" }).notNull().default(false),
});

export type ApplicationCfg = typeof applications.$inferSelect;
export type NewApplicationCfg = typeof applications.$inferInsert;

export type Vote = typeof votes.$inferSelect;
export type NewVote = typeof votes.$inferInsert;
export type APIVote = Omit<Vote, "id"> & { id: string };

export type ForwardingCfg = typeof forwardings.$inferSelect;
export type NewForwardingCfg = typeof forwardings.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type BlacklistEntry = typeof blacklist.$inferSelect;
export type NewBlacklistEntry = typeof blacklist.$inferInsert;

export type VerificationEntry = typeof verifications.$inferSelect;
export type NewVerificationEntry = typeof verifications.$inferInsert;

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
