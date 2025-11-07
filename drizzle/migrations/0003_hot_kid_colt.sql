PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_votes` (
	`id` blob PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`source` text NOT NULL,
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`has_role` integer DEFAULT false NOT NULL,
	`expires_at` text,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`application_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`application_id`,`source`,`guild_id`) REFERENCES `applications`(`application_id`,`source`,`guild_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_votes`("id", "application_id", "source", "guild_id", "user_id", "role_id", "has_role", "expires_at") SELECT "id", "application_id", "source", "guild_id", "user_id", "role_id", "has_role", "expires_at" FROM `votes`;--> statement-breakpoint
DROP TABLE `votes`;--> statement-breakpoint
ALTER TABLE `__new_votes` RENAME TO `votes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;