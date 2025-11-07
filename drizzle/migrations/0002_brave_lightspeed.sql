CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`dm_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_dm_id_unique` ON `users` (`dm_id`);