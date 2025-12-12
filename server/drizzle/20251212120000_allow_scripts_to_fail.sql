PRAGMA foreign_keys=OFF;
PRAGMA defer_foreign_keys=ON;

CREATE TABLE "new_project_settings" (
    "project_id" TEXT NOT NULL PRIMARY KEY,
    "base_branch" TEXT NOT NULL DEFAULT 'main',
    "preferred_remote" TEXT,
    "setup_script" TEXT,
    "dev_script" TEXT,
    "cleanup_script" TEXT,
    "copy_files" TEXT,
    "allow_scripts_to_fail" INTEGER NOT NULL DEFAULT 0,
    "allow_copy_files_to_fail" INTEGER NOT NULL DEFAULT 0,
    "allow_setup_script_to_fail" INTEGER NOT NULL DEFAULT 0,
    "allow_dev_script_to_fail" INTEGER NOT NULL DEFAULT 0,
    "allow_cleanup_script_to_fail" INTEGER NOT NULL DEFAULT 0,
    "default_agent" TEXT,
    "default_profile_id" TEXT,
    "inline_agent" TEXT,
    "inline_profile_id" TEXT,
    "inline_agent_profile_mapping_json" TEXT,
    "auto_commit_on_finish" INTEGER NOT NULL DEFAULT 0,
    "auto_push_on_autocommit" INTEGER NOT NULL DEFAULT 0,
    "ticket_prefix" TEXT NOT NULL DEFAULT 'PRJ',
    "next_ticket_number" INTEGER NOT NULL DEFAULT 1,
    "github_issue_sync_enabled" INTEGER NOT NULL DEFAULT 0,
    "github_issue_sync_state" TEXT NOT NULL DEFAULT 'open',
    "github_issue_sync_interval_minutes" INTEGER NOT NULL DEFAULT 15,
    "last_github_issue_sync_at" INTEGER,
    "last_github_issue_sync_status" TEXT NOT NULL DEFAULT 'idle',
    "created_at" INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_settings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "boards" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_project_settings" (
    "project_id",
    "base_branch",
    "preferred_remote",
    "setup_script",
    "dev_script",
    "cleanup_script",
    "copy_files",
    "allow_scripts_to_fail",
    "allow_copy_files_to_fail",
    "allow_setup_script_to_fail",
    "allow_dev_script_to_fail",
    "allow_cleanup_script_to_fail",
    "default_agent",
    "default_profile_id",
    "inline_agent",
    "inline_profile_id",
    "inline_agent_profile_mapping_json",
    "auto_commit_on_finish",
    "auto_push_on_autocommit",
    "ticket_prefix",
    "next_ticket_number",
    "github_issue_sync_enabled",
    "github_issue_sync_state",
    "github_issue_sync_interval_minutes",
    "last_github_issue_sync_at",
    "last_github_issue_sync_status",
    "created_at",
    "updated_at"
)
SELECT
    "project_id",
    "base_branch",
    "preferred_remote",
    "setup_script",
    "dev_script",
    "cleanup_script",
    "copy_files",
    0 AS "allow_scripts_to_fail",
    0 AS "allow_copy_files_to_fail",
    0 AS "allow_setup_script_to_fail",
    0 AS "allow_dev_script_to_fail",
    0 AS "allow_cleanup_script_to_fail",
    "default_agent",
    "default_profile_id",
    "inline_agent",
    "inline_profile_id",
    "inline_agent_profile_mapping_json",
    "auto_commit_on_finish",
    "auto_push_on_autocommit",
    "ticket_prefix",
    "next_ticket_number",
    "github_issue_sync_enabled",
    "github_issue_sync_state",
    "github_issue_sync_interval_minutes",
    "last_github_issue_sync_at",
    "last_github_issue_sync_status",
    "created_at",
    "updated_at"
FROM "project_settings";

DROP TABLE "project_settings";
ALTER TABLE "new_project_settings" RENAME TO "project_settings";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

