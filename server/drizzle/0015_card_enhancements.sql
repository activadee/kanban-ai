CREATE TABLE IF NOT EXISTS `card_enhancements` (
    `card_id` text PRIMARY KEY NOT NULL,
    `status` text NOT NULL,
    `suggestion_title` text,
    `suggestion_description` text,
    `updated_at` integer NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON DELETE cascade ON UPDATE no action
);
