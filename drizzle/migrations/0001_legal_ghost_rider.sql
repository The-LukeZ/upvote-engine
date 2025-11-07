CREATE TABLE `forwardings` (
	`application_id` text PRIMARY KEY NOT NULL,
	`target_url` text NOT NULL,
	`secret` text NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`application_id`) ON UPDATE no action ON DELETE cascade
);
