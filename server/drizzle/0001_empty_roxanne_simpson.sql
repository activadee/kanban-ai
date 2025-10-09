CREATE TABLE `app_settings`
(
    `id`                   text PRIMARY KEY DEFAULT 'singleton'                   NOT NULL,
    `theme`                text             DEFAULT 'system'                      NOT NULL,
    `language`             text             DEFAULT 'browser'                     NOT NULL,
    `telemetry_enabled`    integer          DEFAULT false                         NOT NULL,
    `notif_toast_sounds`   integer          DEFAULT false                         NOT NULL,
    `notif_desktop`        integer          DEFAULT false                         NOT NULL,
    `editor_type`          text             DEFAULT 'VS_CODE'                     NOT NULL,
    `editor_command`       text,
    `git_user_name`        text,
    `git_user_email`       text,
    `git_signoff`          integer          DEFAULT false                         NOT NULL,
    `git_gpg_sign`         integer          DEFAULT false                         NOT NULL,
    `worktrees_root`       text             DEFAULT '~/.kanbanAI/worktrees'       NOT NULL,
    `branch_template`      text             DEFAULT '{prefix}/{ticketKey}-{slug}' NOT NULL,
    `gh_default_pr_base`   text,
    `gh_pr_title_template` text,
    `gh_pr_body_template`  text,
    `gh_default_reviewers` text,
    `gh_default_assignees` text,
    `gh_autolink_tickets`  integer          DEFAULT true                          NOT NULL,
    `created_at`           integer          DEFAULT CURRENT_TIMESTAMP             NOT NULL,
    `updated_at`           integer          DEFAULT CURRENT_TIMESTAMP             NOT NULL
);
--> statement-breakpoint
PRAGMA
foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_agent_profiles`
(
    `id`          text PRIMARY KEY                  NOT NULL,
    `project_id`  text                              NOT NULL,
    `agent`       text                              NOT NULL,
    `name`        text                              NOT NULL,
    `config_json` text                              NOT NULL,
    `created_at`  integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `updated_at`  integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_agent_profiles`("id", "project_id", "agent", "name", "config_json", "created_at", "updated_at")
SELECT "id", "project_id", "agent", "name", "config_json", "created_at", "updated_at"
FROM `agent_profiles`;--> statement-breakpoint
DROP TABLE `agent_profiles`;--> statement-breakpoint
ALTER TABLE `__new_agent_profiles` RENAME TO `agent_profiles`;--> statement-breakpoint
PRAGMA
foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_attempt_logs`
(
    `id`         text PRIMARY KEY                  NOT NULL,
    `attempt_id` text                              NOT NULL,
    `ts`         integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `level`      text    DEFAULT 'info'            NOT NULL,
    `message`    text                              NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_attempt_logs`("id", "attempt_id", "ts", "level", "message")
SELECT "id", "attempt_id", "ts", "level", "message"
FROM `attempt_logs`;--> statement-breakpoint
DROP TABLE `attempt_logs`;--> statement-breakpoint
ALTER TABLE `__new_attempt_logs` RENAME TO `attempt_logs`;--> statement-breakpoint
CREATE TABLE `__new_attempts`
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
    `updated_at`    integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_attempts`("id", "card_id", "board_id", "agent", "status", "base_branch", "branch_name",
                             "worktree_path", "session_id", "started_at", "ended_at", "created_at", "updated_at")
SELECT "id",
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
CREATE TABLE `__new_conversation_items`
(
    `id`         text PRIMARY KEY                  NOT NULL,
    `attempt_id` text                              NOT NULL,
    `seq`        integer                           NOT NULL,
    `ts`         integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `item_json`  text                              NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_conversation_items`("id", "attempt_id", "seq", "ts", "item_json")
SELECT "id", "attempt_id", "seq", "ts", "item_json"
FROM `conversation_items`;--> statement-breakpoint
DROP TABLE `conversation_items`;--> statement-breakpoint
ALTER TABLE `__new_conversation_items` RENAME TO `conversation_items`;--> statement-breakpoint
CREATE TABLE `__new_github_issues`
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
    `updated_at`     integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_github_issues`("id", "board_id", "card_id", "owner", "repo", "issue_id", "issue_number",
                                  "title_snapshot", "url", "state", "created_at", "updated_at")
SELECT "id",
       "board_id",
       "card_id",
       "owner",
       "repo",
       "issue_id",
       "issue_number",
       "title_snapshot",
       "url",
       "state",
       "created_at",
       "updated_at"
FROM `github_issues`;--> statement-breakpoint
DROP TABLE `github_issues`;--> statement-breakpoint
ALTER TABLE `__new_github_issues` RENAME TO `github_issues`;