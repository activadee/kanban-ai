CREATE TABLE IF NOT EXISTS `attempt_todos`
(
    `attempt_id` text PRIMARY KEY                  NOT NULL,
    `todos_json` text                              NOT NULL,
    `updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (`attempt_id`) REFERENCES `attempts` (`id`) ON UPDATE no action ON DELETE cascade
);

