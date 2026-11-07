CREATE TABLE `dish_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`badge` text,
	`sort` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dish_cook_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`dish_id` text NOT NULL,
	`user_id` text,
	`date` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`dish_id`) REFERENCES `dishes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_cook_logs_dish` ON `dish_cook_logs` (`dish_id`);--> statement-breakpoint
CREATE TABLE `menu_features` (
	`id` text PRIMARY KEY NOT NULL,
	`dish_id` text NOT NULL,
	`title` text,
	`poster_path` text,
	`start_date` text,
	`end_date` text,
	`sort` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`dish_id`) REFERENCES `dishes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `dishes` ADD `category` text;--> statement-breakpoint
ALTER TABLE `dishes` ADD `subcategory` text;--> statement-breakpoint
ALTER TABLE `dishes` ADD `pinned` integer DEFAULT false NOT NULL;--> statement-breakpoint
-- GanCook-10k：预置默认分类（大类 + 细类），管理员以后可改
INSERT OR IGNORE INTO `dish_categories` (`id`, `name`, `parent_id`, `sort`) VALUES
  ('meat', '荤菜', NULL, 10),
  ('veg', '素菜', NULL, 20),
  ('soup', '汤羹', NULL, 30),
  ('staple', '主食', NULL, 40),
  ('cold', '凉菜小吃', NULL, 50),
  ('sweet', '甜品饮品', NULL, 60),
  ('other', '其他', NULL, 99),
  ('pork', '猪肉', 'meat', 11),
  ('beef', '牛羊肉', 'meat', 12),
  ('poultry', '禽肉', 'meat', 13),
  ('seafood', '鱼虾海鲜', 'meat', 14),
  ('leafy', '叶菜', 'veg', 21),
  ('root', '根茎瓜果', 'veg', 22),
  ('mushroom', '菌菇', 'veg', 23),
  ('tofu', '豆制品', 'veg', 24),
  ('egg', '蛋类', 'veg', 25),
  ('rice', '米饭粥', 'staple', 41),
  ('noodle', '面条粉', 'staple', 42),
  ('pastry', '面点包饺', 'staple', 43);
--> statement-breakpoint
-- GanCook-10k：老菜品按标签 / 菜名自动猜一个大类（猜不出就留空 = 其他，之后可手动改）
UPDATE `dishes` SET `category` = CASE
  WHEN `tags` LIKE '%汤%' OR `name` LIKE '%汤%' OR `name` LIKE '%羹%' THEN 'soup'
  WHEN `tags` LIKE '%甜%' OR `tags` LIKE '%饮%' OR `name` LIKE '%奶茶%' OR `name` LIKE '%糖水%' THEN 'sweet'
  WHEN `tags` LIKE '%凉菜%' OR `name` LIKE '%凉拌%' THEN 'cold'
  WHEN `tags` LIKE '%主食%' OR `name` LIKE '%饭%' OR `name` LIKE '%面%' OR `name` LIKE '%粥%' OR `name` LIKE '%饺%' OR `name` LIKE '%包子%' OR `name` LIKE '%饼%' THEN 'staple'
  WHEN `tags` LIKE '%素%' OR `name` LIKE '%蛋%' OR `name` LIKE '%豆腐%' OR `name` LIKE '%时蔬%' OR `name` LIKE '%青菜%' THEN 'veg'
  WHEN `tags` LIKE '%荤%' OR `name` LIKE '%肉%' OR `name` LIKE '%排骨%' OR `name` LIKE '%鸡%' OR `name` LIKE '%鸭%' OR `name` LIKE '%鱼%' OR `name` LIKE '%虾%' OR `name` LIKE '%牛%' OR `name` LIKE '%羊%' OR `name` LIKE '%蟹%' THEN 'meat'
  ELSE NULL END
WHERE `category` IS NULL;
