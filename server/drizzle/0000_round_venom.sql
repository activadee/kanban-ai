CREATE TABLE `agent_profiles`
(
    `id`          text PRIMARY KEY                  NOT NULL,
    `project_id`  text                              NOT NULL,
    `agent`       text                              NOT NULL,
    `name`        text                              NOT NULL,
    `config_json` text                              NOT NULL,
    `created_at`  integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `updated_at`  integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (`project_id`) REFERENCES `boards` (`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `agent_profiles_global`
(
    `id`          text PRIMARY KEY                  NOT NULL,
    `agent`       text                              NOT NULL,
    `name`        text                              NOT NULL,
    `config_json` text                              NOT NULL,
    `created_at`  integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `updated_at`  integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `attempt_logs`
(
    `id`         text PRIMARY KEY                  NOT NULL,
    `attempt_id` text                              NOT NULL,
    `ts`         integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `level`      text    DEFAULT 'info'            NOT NULL,
    `message`    text                              NOT NULL,
    FOREIGN KEY (`attempt_id`) REFERENCES `attempts` (`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `attempts`
(
    `id`            text PRIMARY KEY                  NOT NULL,
    `card_id`       text                              NOT NULL,
    `board_id`      text                              NOT NULL,
    `agent`         text                              NOT NULL,
    `status`        text                              NOT NULL,
    `base_branch`   text    DEFAULT 'main'            NOT NULL,
    `branch_name`   text                              NOT NULL,
    `worktree_path` text                              NOT NULL,
    `session_id`    text,
    `started_at`    integer,
    `ended_at`      integer,
    `created_at`    integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `updated_at`    integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (`card_id`) REFERENCES `cards` (`id`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (`board_id`) REFERENCES `boards` (`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `boards`
(
    `id`              text PRIMARY KEY                  NOT NULL,
    `name`            text                              NOT NULL,
    `repository_path` text                              NOT NULL,
    `repository_url`  text,
    `repository_slug` text,
    `created_at`      integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `updated_at`      integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cards`
(
    `id`          text PRIMARY KEY                  NOT NULL,
    `title`       text                              NOT NULL,
    `description` text,
    `position`    integer                           NOT NULL,
    `column_id`   text                              NOT NULL,
    `board_id`    text,
    `ticket_key`  text,
    `created_at`  integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `updated_at`  integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (`column_id`) REFERENCES `columns` (`id`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (`board_id`) REFERENCES `boards` (`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cards_board_ticket_key_idx` ON `cards` (`board_id`, `ticket_key`);--> statement-breakpoint
CREATE TABLE `columns`
(
    `id`         text PRIMARY KEY                  NOT NULL,
    `title`      text                              NOT NULL,
    `position`   integer                           NOT NULL,
    `board_id`   text                              NOT NULL,
    `created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (`board_id`) REFERENCES `boards` (`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `conversation_items`
(
    `id`         text PRIMARY KEY                  NOT NULL,
    `attempt_id` text                              NOT NULL,
    `seq`        integer                           NOT NULL,
    `ts`         integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `item_json`  text                              NOT NULL,
    FOREIGN KEY (`attempt_id`) REFERENCES `attempts` (`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `github_connections`
(
    `id`            text PRIMARY KEY                  NOT NULL,
    `username`      text                              NOT NULL,
    `primary_email` text,
    `access_token`  text                              NOT NULL,
    `token_type`    text                              NOT NULL,
    `scope`         text,
    `created_at`    integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `updated_at`    integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `github_issues`
(
    `id`             text PRIMARY KEY                  NOT NULL,
    `board_id`       text                              NOT NULL,
    `card_id`        text                              NOT NULL,
    `owner`          text                              NOT NULL,
    `repo`           text                              NOT NULL,
    `issue_id`       text                              NOT NULL,
    `issue_number`   integer                           NOT NULL,
    `title_snapshot` text                              NOT NULL,
    `url`            text                              NOT NULL,
    `state`          text                              NOT NULL,
    `created_at`     integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `updated_at`     integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (`board_id`) REFERENCES `boards` (`id`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (`card_id`) REFERENCES `cards` (`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `project_settings`
(
    `project_id`            text PRIMARY KEY                  NOT NULL,
    `base_branch`           text    DEFAULT 'main'            NOT NULL,
    `preferred_remote`      text,
    `setup_script`          text,
    `dev_script`            text,
    `cleanup_script`        text,
    `copy_files`            text,
    `default_agent`         text,
    `default_profile_id`    text,
    `auto_cleanup`          integer DEFAULT false             NOT NULL,
    `auto_commit_on_finish` integer DEFAULT false             NOT NULL,
    `ticket_prefix`         text    DEFAULT 'PRJ'             NOT NULL,
    `next_ticket_number`    integer DEFAULT 1                 NOT NULL,
    `created_at`            integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `updated_at`            integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (`project_id`) REFERENCES `boards` (`id`) ON UPDATE no action ON DELETE cascade
);
