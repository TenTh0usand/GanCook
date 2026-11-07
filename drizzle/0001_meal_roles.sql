CREATE TABLE `meal_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`slot` text NOT NULL,
	`kind` text NOT NULL,
	`meal_id` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`meal_id`) REFERENCES `meals`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_meal_roles_date` ON `meal_roles` (`date`,`slot`);--> statement-breakpoint
CREATE INDEX `idx_meal_roles_meal` ON `meal_roles` (`meal_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_meal_role` ON `meal_roles` (`user_id`,`date`,`slot`,`kind`);--> statement-breakpoint
-- GanCook-10k：把原有「掌勺人」搬进 meal_roles（已取消的饭局不搬）
INSERT OR IGNORE INTO `meal_roles` (`id`, `user_id`, `date`, `slot`, `kind`, `meal_id`, `source`, `created_at`)
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
       `cook_id`, `date`, `meal_type`, 'cook', `id`, 'meal', `created_at`
FROM `meals`
WHERE `cook_id` IS NOT NULL AND `status` != 'cancelled';
