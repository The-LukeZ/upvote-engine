PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_applications` (
	`application_id` text NOT NULL,
	`source` text NOT NULL,
	`secret` text NOT NULL,
	`guild_id` text NOT NULL,
	`vote_role_id` text NOT NULL,
	`role_duration_seconds` integer,
	`created_at` text,
	PRIMARY KEY(`application_id`, `source`)
);
--> statement-breakpoint
INSERT INTO `__new_applications`("application_id", "source", "secret", "guild_id", "vote_role_id", "role_duration_seconds", "created_at") SELECT "application_id", "source", "secret", "guild_id", "vote_role_id", "role_duration_seconds", "created_at" FROM `applications`;--> statement-breakpoint
DROP TABLE `applications`;--> statement-breakpoint
ALTER TABLE `__new_applications` RENAME TO `applications`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `applications_secret_unique` ON `applications` (`secret`);--> statement-breakpoint
ALTER TABLE `votes` ADD `application_id` text NOT NULL REFERENCES applications(application_id);--> statement-breakpoint
ALTER TABLE `votes` ADD `source` text NOT NULL;