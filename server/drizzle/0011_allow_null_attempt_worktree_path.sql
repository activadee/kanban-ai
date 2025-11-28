PRAGMA
foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_attempts`
(
    `id`            text PRIMARY KEY                  NOT NULL,
    `card_id`       text                              NOT NULL,
    `board_id`      text                              NOT NULL,
    `agent`         text                              NOT NULL,
    `status`        text                              NOT NULL,
    `base_branch`   text    DEFAULT 'main'            NOT NULL,
    `branch_name`   text                              NOT NULL,
    `worktree_path` text,
    `session_id`    text,
    `started_at`    integer,
    `ended_at`      integer,
    `created_at`    integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `updated_at`    integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (`card_id`) REFERENCES `cards` (`id`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (`board_id`) REFERENCES `boards` (`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_attempts`(
    "id",
    "card_id",
    "board_id",
    "agent",
    "status",
    "base_branch",
    "branch_name",
    "worktree_path",
    "session_id",
    "started_at",
    "ended_at",
    "created_at",
    "updated_at"
)
SELECT
    "id",
    "card_id",
    "board_id",
    "agent",
    "status",
    "base_branch",
    "branch_name",
    "worktree_path",
    "session_id",
    "started_at",
    "ended_at",
    "created_at",
    "updated_at"
FROM `attempts`;--> statement-breakpoint
DROP TABLE `attempts`;--> statement-breakpoint
ALTER TABLE `__new_attempts` RENAME TO `attempts`;--> statement-breakpoint
PRAGMA
foreign_keys=ON;

