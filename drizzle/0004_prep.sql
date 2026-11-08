CREATE TABLE `prep_items` (
	`id` text PRIMARY KEY NOT NULL,
	`log_id` text NOT NULL,
	`name` text NOT NULL,
	`source` text DEFAULT 'bought' NOT NULL,
	`qty` text,
	`price_cents` integer,
	`sort` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`log_id`) REFERENCES `prep_logs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_prep_items_log` ON `prep_items` (`log_id`);--> statement-breakpoint
CREATE TABLE `prep_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`date` text NOT NULL,
	`slot` text NOT NULL,
	`meal_id` text,
	`note` text,
	`image_path` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`meal_id`) REFERENCES `meals`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_prep_logs_date` ON `prep_logs` (`date`);