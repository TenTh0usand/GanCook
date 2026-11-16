CREATE TABLE `meal_photo_votes` (
	`meal_id` text NOT NULL,
	`user_id` text NOT NULL,
	`photo_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`meal_id`) REFERENCES `meals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`photo_id`) REFERENCES `meal_photos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_photo_votes_photo` ON `meal_photo_votes` (`photo_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_photo_vote` ON `meal_photo_votes` (`meal_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `meal_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`meal_id` text NOT NULL,
	`user_id` text,
	`source` text DEFAULT 'meal' NOT NULL,
	`path` text NOT NULL,
	`thumb_path` text NOT NULL,
	`width` integer,
	`height` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`meal_id`) REFERENCES `meals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_meal_photos_meal` ON `meal_photos` (`meal_id`);--> statement-breakpoint
ALTER TABLE `meal_schedules` ADD `deadline_time` text;--> statement-breakpoint
-- GanCook-10k：点菜截止时间往后调（截止可晚于用餐，吃完还能补点）：自动饭局规则按餐次改成固定截止时刻
UPDATE `meal_schedules` SET `deadline_time` = CASE `meal_type`
  WHEN 'breakfast' THEN '10:30'
  WHEN 'lunch' THEN '14:30'
  WHEN 'dinner' THEN '21:30'
  WHEN 'snack' THEN '17:30'
  WHEN 'late' THEN '01:30'
END;--> statement-breakpoint
-- 还在点菜中的饭局：截止时间顺延到新规则（只往后延，不提前；家庭时区按 UTC+8，夜宵 01:30 为次日）
UPDATE `meals` SET `order_deadline` = MAX(`order_deadline`, CASE `meal_type`
  WHEN 'breakfast' THEN unixepoch(`date` || ' 10:30') - 28800
  WHEN 'lunch' THEN unixepoch(`date` || ' 14:30') - 28800
  WHEN 'dinner' THEN unixepoch(`date` || ' 21:30') - 28800
  WHEN 'snack' THEN unixepoch(`date` || ' 17:30') - 28800
  WHEN 'late' THEN unixepoch(`date` || ' 01:30') - 28800 + 86400
END) WHERE `status` = 'ordering';
