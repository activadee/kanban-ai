CREATE TABLE IF NOT EXISTS `subtasks` (
    `id` text PRIMARY KEY NOT NULL,
    `ticket_id` text NOT NULL,
    `title` text NOT NULL,
    `description` text,
    `status` text NOT NULL DEFAULT 'todo',
    `position` integer NOT NULL,
    `assignee_id` text,
    `due_date` integer,
    `created_at` integer NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` integer NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`ticket_id`) REFERENCES `cards` (`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `subtasks_ticket_idx` ON `subtasks` (`ticket_id`, `position`);

