CREATE TABLE `applications` (
	`application_id` text PRIMARY KEY NOT NULL,
	`secret` text NOT NULL,
	`guild_id` text NOT NULL,
	`vote_role_id` text NOT NULL,
	`role_duration_seconds` integer,
	`created_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `applications_secret_unique` ON `applications` (`secret`);--> statement-breakpoint
CREATE TABLE `votes` (
	`id` blob PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`has_role` integer DEFAULT false NOT NULL,
	`expires_at` text
);
