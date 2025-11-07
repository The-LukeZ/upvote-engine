CREATE TABLE `applications` (
	`application_id` text NOT NULL,
	`source` text NOT NULL,
	`secret` text NOT NULL,
	`guild_id` text NOT NULL,
	`vote_role_id` text NOT NULL,
	`role_duration_seconds` integer,
	`created_at` text,
	PRIMARY KEY(`application_id`, `source`, `guild_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `applications_secret_unique` ON `applications` (`secret`);--> statement-breakpoint
CREATE TABLE `votes` (
	`id` blob PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`source` text NOT NULL,
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`has_role` integer DEFAULT false NOT NULL,
	`expires_at` text,
	FOREIGN KEY (`application_id`,`source`,`guild_id`) REFERENCES `applications`(`application_id`,`source`,`guild_id`) ON UPDATE no action ON DELETE no action
);
