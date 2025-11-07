import { sqliteTable, text, integer, blob } from "drizzle-orm/sqlite-core";

export const applications = sqliteTable("applications", {
  applicationId: text("application_id").primaryKey(),
  secret: text("secret").notNull().unique(),
  guildId: text("guild_id").notNull(),
  voteRoleId: text("vote_role_id").notNull(), // Added per-bot
  roleDurationSeconds: integer("role_duration_seconds"), // Added per-bot
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

export const votes = sqliteTable("votes", {
  id: blob("id", { mode: "bigint" }).primaryKey(), // Snowflake ID
  applicationId: text("application_id")
    .notNull()
    .references(() => applications.applicationId, { onDelete: "cascade" }),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  roleId: text("role_id").notNull(),
  hasRole: integer("has_role", { mode: "boolean" }).notNull().default(false), // 1 = true, 0 = false
  expiresAt: text("expires_at"),
});

export type ApplicationCfg = typeof applications.$inferSelect;
export type NewApplicationCfg = typeof applications.$inferInsert;

export type Vote = typeof votes.$inferSelect;
export type NewVote = typeof votes.$inferInsert;
