DROP TABLE `guilds`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_votes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`has_role` integer DEFAULT false NOT NULL,
	`expires_at` text
);
--> statement-breakpoint
INSERT INTO `__new_votes`("id", "guild_id", "user_id", "role_id", "has_role", "expires_at") SELECT "id", "guild_id", "user_id", "role_id", "has_role", "expires_at" FROM `votes`;--> statement-breakpoint
DROP TABLE `votes`;--> statement-breakpoint
ALTER TABLE `__new_votes` RENAME TO `votes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_webhook_secrets` (
	`application_id` text PRIMARY KEY NOT NULL,
	`secret` text NOT NULL,
	`guild_id` text NOT NULL,
	`vote_role_id` text NOT NULL,
	`role_duration_seconds` integer NOT NULL,
	`created_at` text
);
--> statement-breakpoint
INSERT INTO `__new_webhook_secrets`("application_id", "secret", "guild_id", "vote_role_id", "role_duration_seconds", "created_at") SELECT "application_id", "secret", "guild_id", "vote_role_id", "role_duration_seconds", "created_at" FROM `webhook_secrets`;--> statement-breakpoint
DROP TABLE `webhook_secrets`;--> statement-breakpoint
ALTER TABLE `__new_webhook_secrets` RENAME TO `webhook_secrets`;--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_secrets_secret_unique` ON `webhook_secrets` (`secret`);