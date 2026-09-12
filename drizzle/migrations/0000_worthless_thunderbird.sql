CREATE TABLE `applications` (
	`application_id` text NOT NULL,
	`source` text NOT NULL,
	`secret` text,
	`topgg_project_id` text,
	`topgg_webhook_id` text,
	`topgg_refresh_token` text,
	`topgg_refresh_token_iv` text,
	`guild_id` text,
	`vote_role_id` text,
	`role_duration_seconds` integer,
	`invalid_requests` integer DEFAULT 0,
	`created_at` text,
	PRIMARY KEY(`application_id`, `source`)
);
--> statement-breakpoint
CREATE TABLE `blacklist` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text,
	`user_id` text,
	`application_id` text,
	`reason` text
);
--> statement-breakpoint
CREATE TABLE `forwardings` (
	`application_id` text NOT NULL,
	`target_url` text NOT NULL,
	`secret` text NOT NULL,
	`iv` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `owners` (
	`user_id` text PRIMARY KEY NOT NULL,
	`access_token` text NOT NULL,
	`iv` text NOT NULL,
	`expires_at` text NOT NULL,
	`scope` text NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`dm_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_dm_id_unique` ON `users` (`dm_id`);--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`application_id` text NOT NULL,
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text,
	`verified` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `votes` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`source` text NOT NULL,
	`guild_id` text,
	`user_id` text NOT NULL,
	`role_id` text,
	`has_role` integer DEFAULT false NOT NULL,
	`expires_at` text,
	FOREIGN KEY (`application_id`,`source`) REFERENCES `applications`(`application_id`,`source`) ON UPDATE no action ON DELETE no action
);
