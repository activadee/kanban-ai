-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_agent_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config_json" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL DEFAULT 0,
    "updated_at" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "agent_profiles_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "boards" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_agent_profiles" ("agent", "config_json", "created_at", "id", "name", "project_id", "updated_at") SELECT "agent", "config_json", "created_at", "id", "name", "project_id", "updated_at" FROM "agent_profiles";
DROP TABLE "agent_profiles";
ALTER TABLE "new_agent_profiles" RENAME TO "agent_profiles";
CREATE TABLE "new_attempt_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attempt_id" TEXT NOT NULL,
    "ts" INTEGER NOT NULL DEFAULT 0,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    CONSTRAINT "attempt_logs_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_attempt_logs" ("attempt_id", "id", "level", "message", "ts") SELECT "attempt_id", "id", "level", "message", "ts" FROM "attempt_logs";
DROP TABLE "attempt_logs";
ALTER TABLE "new_attempt_logs" RENAME TO "attempt_logs";
CREATE TABLE "new_attempt_todos" (
    "attempt_id" TEXT NOT NULL PRIMARY KEY,
    "todos_json" TEXT NOT NULL,
    "updated_at" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "attempt_todos_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_attempt_todos" ("attempt_id", "todos_json", "updated_at") SELECT "attempt_id", "todos_json", "updated_at" FROM "attempt_todos";
DROP TABLE "attempt_todos";
ALTER TABLE "new_attempt_todos" RENAME TO "attempt_todos";
CREATE TABLE "new_attempts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "board_id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "base_branch" TEXT NOT NULL,
    "branch_name" TEXT NOT NULL,
    "worktree_path" TEXT,
    "session_id" TEXT,
    "created_at" INTEGER NOT NULL DEFAULT 0,
    "updated_at" INTEGER NOT NULL DEFAULT 0,
    "started_at" INTEGER,
    "ended_at" INTEGER,
    CONSTRAINT "attempts_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "attempts_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_attempts" ("agent", "base_branch", "board_id", "branch_name", "card_id", "created_at", "ended_at", "id", "session_id", "started_at", "status", "updated_at", "worktree_path") SELECT "agent", "base_branch", "board_id", "branch_name", "card_id", "created_at", "ended_at", "id", "session_id", "started_at", "status", "updated_at", "worktree_path" FROM "attempts";
DROP TABLE "attempts";
ALTER TABLE "new_attempts" RENAME TO "attempts";
CREATE TABLE "new_card_dependencies" (
    "card_id" TEXT NOT NULL,
    "depends_on_card_id" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("card_id", "depends_on_card_id"),
    CONSTRAINT "card_dependencies_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "card_dependencies_depends_on_card_id_fkey" FOREIGN KEY ("depends_on_card_id") REFERENCES "cards" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_card_dependencies" ("card_id", "created_at", "depends_on_card_id") SELECT "card_id", "created_at", "depends_on_card_id" FROM "card_dependencies";
DROP TABLE "card_dependencies";
ALTER TABLE "new_card_dependencies" RENAME TO "card_dependencies";
CREATE UNIQUE INDEX "card_deps_unique" ON "card_dependencies"("card_id", "depends_on_card_id");
CREATE TABLE "new_card_enhancements" (
    "card_id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "suggestion_title" TEXT,
    "suggestion_description" TEXT,
    "updated_at" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "card_enhancements_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_card_enhancements" ("card_id", "status", "suggestion_description", "suggestion_title", "updated_at") SELECT "card_id", "status", "suggestion_description", "suggestion_title", "updated_at" FROM "card_enhancements";
DROP TABLE "card_enhancements";
ALTER TABLE "new_card_enhancements" RENAME TO "card_enhancements";
CREATE TABLE "new_cards" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "column_id" TEXT NOT NULL,
    "board_id" TEXT,
    "ticket_key" TEXT,
    "ticket_type" TEXT,
    "pr_url" TEXT,
    "created_at" INTEGER NOT NULL DEFAULT 0,
    "updated_at" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "cards_column_id_fkey" FOREIGN KEY ("column_id") REFERENCES "columns" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cards_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_cards" ("board_id", "column_id", "created_at", "description", "id", "position", "pr_url", "ticket_key", "ticket_type", "title", "updated_at") SELECT "board_id", "column_id", "created_at", "description", "id", "position", "pr_url", "ticket_key", "ticket_type", "title", "updated_at" FROM "cards";
DROP TABLE "cards";
ALTER TABLE "new_cards" RENAME TO "cards";
CREATE UNIQUE INDEX "cards_board_ticket_key_idx" ON "cards"("board_id", "ticket_key");
CREATE TABLE "new_columns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "board_id" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL DEFAULT 0,
    "updated_at" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "columns_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_columns" ("board_id", "created_at", "id", "position", "title", "updated_at") SELECT "board_id", "created_at", "id", "position", "title", "updated_at" FROM "columns";
DROP TABLE "columns";
ALTER TABLE "new_columns" RENAME TO "columns";
CREATE TABLE "new_conversation_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attempt_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "ts" INTEGER NOT NULL DEFAULT 0,
    "item_json" TEXT NOT NULL,
    CONSTRAINT "conversation_items_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_conversation_items" ("attempt_id", "id", "item_json", "seq", "ts") SELECT "attempt_id", "id", "item_json", "seq", "ts" FROM "conversation_items";
DROP TABLE "conversation_items";
ALTER TABLE "new_conversation_items" RENAME TO "conversation_items";
CREATE TABLE "new_github_issues" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "board_id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "issue_number" INTEGER NOT NULL,
    "title_snapshot" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL DEFAULT 0,
    "updated_at" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "github_issues_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "github_issues_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_github_issues" ("board_id", "card_id", "created_at", "id", "issue_id", "issue_number", "owner", "repo", "state", "title_snapshot", "updated_at", "url") SELECT "board_id", "card_id", "created_at", "id", "issue_id", "issue_number", "owner", "repo", "state", "title_snapshot", "updated_at", "url" FROM "github_issues";
DROP TABLE "github_issues";
ALTER TABLE "new_github_issues" RENAME TO "github_issues";
CREATE TABLE "new_project_settings" (
    "project_id" TEXT NOT NULL PRIMARY KEY,
    "base_branch" TEXT NOT NULL DEFAULT 'main',
    "preferred_remote" TEXT,
    "setup_script" TEXT,
    "dev_script" TEXT,
    "cleanup_script" TEXT,
    "copy_files" TEXT,
    "default_agent" TEXT,
    "default_profile_id" TEXT,
    "inline_agent" TEXT,
    "inline_profile_id" TEXT,
    "auto_commit_on_finish" INTEGER NOT NULL DEFAULT 0,
    "auto_push_on_autocommit" INTEGER NOT NULL DEFAULT 0,
    "ticket_prefix" TEXT NOT NULL DEFAULT 'PRJ',
    "next_ticket_number" INTEGER NOT NULL DEFAULT 1,
    "github_issue_sync_enabled" INTEGER NOT NULL DEFAULT 0,
    "github_issue_sync_state" TEXT NOT NULL DEFAULT 'open',
    "github_issue_sync_interval_minutes" INTEGER NOT NULL DEFAULT 15,
    "last_github_issue_sync_at" INTEGER,
    "last_github_issue_sync_status" TEXT NOT NULL DEFAULT 'idle',
    "created_at" INTEGER NOT NULL DEFAULT 0,
    "updated_at" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "project_settings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "boards" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_project_settings" ("auto_commit_on_finish", "auto_push_on_autocommit", "base_branch", "cleanup_script", "copy_files", "created_at", "default_agent", "default_profile_id", "dev_script", "github_issue_sync_enabled", "github_issue_sync_interval_minutes", "github_issue_sync_state", "inline_agent", "inline_profile_id", "last_github_issue_sync_at", "last_github_issue_sync_status", "next_ticket_number", "preferred_remote", "project_id", "setup_script", "ticket_prefix", "updated_at") SELECT "auto_commit_on_finish", "auto_push_on_autocommit", "base_branch", "cleanup_script", "copy_files", "created_at", "default_agent", "default_profile_id", "dev_script", "github_issue_sync_enabled", "github_issue_sync_interval_minutes", "github_issue_sync_state", "inline_agent", "inline_profile_id", "last_github_issue_sync_at", "last_github_issue_sync_status", "next_ticket_number", "preferred_remote", "project_id", "setup_script", "ticket_prefix", "updated_at" FROM "project_settings";
DROP TABLE "project_settings";
ALTER TABLE "new_project_settings" RENAME TO "project_settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
