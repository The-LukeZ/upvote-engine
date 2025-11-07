import { sqliteTable, text, integer, blob, primaryKey, foreignKey } from "drizzle-orm/sqlite-core";

export const applications = sqliteTable(
  "applications",
  {
    applicationId: text("application_id").notNull(),
    source: text("source", { enum: ["topgg", "dbl"] }).notNull(),
    secret: text("secret").notNull().unique(),
    guildId: text("guild_id").notNull(),
    voteRoleId: text("vote_role_id").notNull(), // Added per-bot per-source
    roleDurationSeconds: integer("role_duration_seconds"), // Added per-bot per-source
    createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  },
  (table) => [primaryKey({ columns: [table.applicationId, table.source, table.guildId] })], // Updated: Include guildId in primary key
);

export const forwardings = sqliteTable("forwardings", {
  applicationId: text("application_id")
    .references(() => applications.applicationId, { onDelete: "cascade" })
    .primaryKey(),
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

export type ApplicationCfg = typeof applications.$inferSelect;
export type NewApplicationCfg = typeof applications.$inferInsert;

export type Vote = typeof votes.$inferSelect;
export type NewVote = typeof votes.$inferInsert;
export type APIVote = Omit<Vote, "id"> & { id: string };

export type ForwardingCfg = typeof forwardings.$inferSelect;
export type NewForwardingCfg = typeof forwardings.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
