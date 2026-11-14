CREATE TABLE `meal_companions` (
	`meal_id` text NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`meal_id`) REFERENCES `meals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_meal_companions_meal` ON `meal_companions` (`meal_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_meal_companion` ON `meal_companions` (`meal_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `venues` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`area` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `venues_name_unique` ON `venues` (`name`);--> statement-breakpoint
ALTER TABLE `meals` ADD `kind` text DEFAULT 'home' NOT NULL;--> statement-breakpoint
ALTER TABLE `meals` ADD `out_category` text;--> statement-breakpoint
ALTER TABLE `meals` ADD `venue_id` text REFERENCES venues(id);--> statement-breakpoint
ALTER TABLE `meals` ADD `total_cents` integer;--> statement-breakpoint
ALTER TABLE `meals` ADD `headcount` integer;--> statement-breakpoint
ALTER TABLE `meals` ADD `paid_cents` integer;--> statement-breakpoint
CREATE INDEX `idx_meals_kind` ON `meals` (`kind`);