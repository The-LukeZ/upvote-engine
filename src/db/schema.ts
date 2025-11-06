import { sqliteTable, text, integer, blob } from "drizzle-orm/sqlite-core";

export const webhookSecrets = sqliteTable("webhook_secrets", {
  applicationId: text("application_id").primaryKey(),
  secret: text("secret").notNull().unique(),
  guildId: text("guild_id").notNull(),
  voteRoleId: text("vote_role_id").notNull(), // Added per-bot
  roleDurationSeconds: integer("role_duration_seconds").notNull(), // Added per-bot
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

export const votes = sqliteTable("votes", {
  id: blob("id", { mode: "bigint" }).primaryKey(),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  roleId: text("role_id").notNull(),
  hasRole: integer("has_role", { mode: "boolean" }).notNull().default(false), // 1 = true, 0 = false
  expiresAt: text("expires_at"),
});
