import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const guilds = sqliteTable("guilds", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  guildId: text("guild_id").notNull().unique(),
  voteRoleId: text("vote_role_id").notNull(),
  roleDurationSeconds: integer("role_duration_seconds").notNull(),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const webhookSecrets = sqliteTable("webhook_secrets", {
  applicationId: text("application_id").primaryKey(),
  secret: text("secret").notNull().unique(),
  guildId: text("guild_id")
    .notNull()
    .references(() => guilds.guildId, { onDelete: "cascade" }),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

export const votes = sqliteTable("votes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  guildId: text("guild_id")
    .notNull()
    .references(() => guilds.guildId, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  roleId: text("role_id").notNull(),
  expiresAt: text("expires_at"),
});
