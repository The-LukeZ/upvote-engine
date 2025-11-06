ALTER TABLE `webhook_secrets` RENAME TO `applications`;--> statement-breakpoint
DROP INDEX `webhook_secrets_secret_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `applications_secret_unique` ON `applications` (`secret`);