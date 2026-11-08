ALTER TABLE `reviews` ADD `score_x10` integer;--> statement-breakpoint
ALTER TABLE `reviews` ADD `mode` text DEFAULT 'simple' NOT NULL;--> statement-breakpoint
ALTER TABLE `reviews` ADD `dims` text;--> statement-breakpoint
-- GanCook-10k：已有评价（整数星）换算成 ×10 分数
UPDATE `reviews` SET `score_x10` = `rating` * 10 WHERE `score_x10` IS NULL;
