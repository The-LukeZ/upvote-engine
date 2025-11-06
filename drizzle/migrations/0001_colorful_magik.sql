ALTER TABLE `webhook_secrets` ADD `vote_role_id` text NOT NULL;--> statement-breakpoint
ALTER TABLE `webhook_secrets` ADD `role_duration_seconds` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `guilds` DROP COLUMN `vote_role_id`;--> statement-breakpoint
ALTER TABLE `guilds` DROP COLUMN `role_duration_seconds`;