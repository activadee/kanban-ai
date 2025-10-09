PRAGMA
foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_app_settings`
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
    `worktrees_root`       text             DEFAULT '/tmp/kanbanai/worktrees'     NOT NULL,
    `branch_template`      text             DEFAULT '{prefix}/{ticketKey}-{slug}' NOT NULL,
    `gh_pr_title_template` text,
    `gh_pr_body_template`  text,
    `gh_autolink_tickets`  integer          DEFAULT true                          NOT NULL,
    `created_at`           integer          DEFAULT CURRENT_TIMESTAMP             NOT NULL,
    `updated_at`           integer          DEFAULT CURRENT_TIMESTAMP             NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_app_settings`("id", "theme", "language", "telemetry_enabled", "notif_toast_sounds", "notif_desktop",
                                 "editor_type", "editor_command", "git_user_name", "git_user_email", "worktrees_root",
                                 "branch_template", "gh_pr_title_template", "gh_pr_body_template",
                                 "gh_autolink_tickets", "created_at", "updated_at")
SELECT "id",
       "theme",
       "language",
       "telemetry_enabled",
       "notif_toast_sounds",
       "notif_desktop",
       "editor_type",
       "editor_command",
       "git_user_name",
       "git_user_email",
       "worktrees_root",
       "branch_template",
       "gh_pr_title_template",
       "gh_pr_body_template",
       "gh_autolink_tickets",
       "created_at",
       "updated_at"
FROM `app_settings`;--> statement-breakpoint
DROP TABLE `app_settings`;--> statement-breakpoint
ALTER TABLE `__new_app_settings` RENAME TO `app_settings`;--> statement-breakpoint
PRAGMA
foreign_keys=ON;