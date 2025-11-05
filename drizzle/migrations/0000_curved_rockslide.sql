CREATE TABLE `guilds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`vote_role_id` text NOT NULL,
	`role_duration_seconds` integer NOT NULL,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guilds_guild_id_unique` ON `guilds` (`guild_id`);--> statement-breakpoint
CREATE TABLE `votes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`has_role` integer DEFAULT false NOT NULL,
	`expires_at` text,
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`guild_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `webhook_secrets` (
	`application_id` text PRIMARY KEY NOT NULL,
	`secret` text NOT NULL,
	`guild_id` text NOT NULL,
	`created_at` text,
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`guild_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_secrets_secret_unique` ON `webhook_secrets` (`secret`);