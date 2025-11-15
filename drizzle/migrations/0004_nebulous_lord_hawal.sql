PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_forwardings` (
	`application_id` text NOT NULL,
	`target_url` text NOT NULL,
	`secret` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_forwardings`("application_id", "target_url", "secret") SELECT "application_id", "target_url", "secret" FROM `forwardings`;--> statement-breakpoint
DROP TABLE `forwardings`;--> statement-breakpoint
ALTER TABLE `__new_forwardings` RENAME TO `forwardings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;