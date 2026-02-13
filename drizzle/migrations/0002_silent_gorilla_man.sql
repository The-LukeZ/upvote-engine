CREATE TABLE `integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text DEFAULT 'topgg' NOT NULL,
	`application_id` text NOT NULL,
	`secret` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text
);
