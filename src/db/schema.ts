import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const guilds = sqliteTable("guilds", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  guildId: text("guild_id").notNull().unique(),
  // Removed voteRoleId and roleDurationSeconds to make them per-bot
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const webhookSecrets = sqliteTable("webhook_secrets", {
  applicationId: text("application_id").primaryKey(),
  secret: text("secret").notNull().unique(),
  guildId: text("guild_id")
    .notNull()
    .references(() => guilds.guildId, { onDelete: "cascade" }),
  voteRoleId: text("vote_role_id").notNull(), // Added per-bot
  roleDurationSeconds: integer("role_duration_seconds").notNull(), // Added per-bot
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

export const votes = sqliteTable("votes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  guildId: text("guild_id")
    .notNull()
    .references(() => guilds.guildId, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  roleId: text("role_id").notNull(),
  hasRole: integer("has_role", { mode: "boolean" }).notNull().default(false), // 1 = true, 0 = false
  expiresAt: text("expires_at"),
});
