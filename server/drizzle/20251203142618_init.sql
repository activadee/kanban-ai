-- CreateTable
CREATE TABLE "boards" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "repository_path" TEXT NOT NULL,
    "repository_url" TEXT,
    "repository_slug" TEXT,
    "created_at" INTEGER NOT NULL DEFAULT 0,
    "updated_at" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "project_settings" (
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
    "updated_at" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "columns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "board_id" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL DEFAULT 0,
    "updated_at" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "cards" (
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
    "updated_at" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "card_dependencies" (
    "card_id" TEXT NOT NULL,
    "depends_on_card_id" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("card_id", "depends_on_card_id")
);

-- CreateTable
CREATE TABLE "card_enhancements" (
    "card_id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "suggestion_title" TEXT,
    "suggestion_description" TEXT,
    "updated_at" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "theme" TEXT NOT NULL DEFAULT 'system',
    "language" TEXT NOT NULL DEFAULT 'browser',
    "telemetry_enabled" INTEGER NOT NULL DEFAULT 0,
    "notif_toast_sounds" INTEGER NOT NULL DEFAULT 0,
    "notif_desktop" INTEGER NOT NULL DEFAULT 0,
    "auto_start_agent_on_in_progress" INTEGER NOT NULL DEFAULT 0,
    "editor_type" TEXT NOT NULL DEFAULT 'VS_CODE',
    "editor_command" TEXT,
    "git_user_name" TEXT,
    "git_user_email" TEXT,
    "branch_template" TEXT NOT NULL DEFAULT '{prefix}/{ticketKey}-{slug}',
    "gh_pr_title_template" TEXT,
    "gh_pr_body_template" TEXT,
    "gh_autolink_tickets" INTEGER NOT NULL DEFAULT 1,
    "created_at" INTEGER NOT NULL DEFAULT 0,
    "updated_at" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "agent_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config_json" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL DEFAULT 0,
    "updated_at" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "agent_profiles_global" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agent" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config_json" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL DEFAULT 0,
    "updated_at" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "attempts" (
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
    "ended_at" INTEGER
);

-- CreateTable
CREATE TABLE "attempt_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attempt_id" TEXT NOT NULL,
    "ts" INTEGER NOT NULL DEFAULT 0,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "conversation_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attempt_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "ts" INTEGER NOT NULL DEFAULT 0,
    "item_json" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "attempt_todos" (
    "attempt_id" TEXT NOT NULL PRIMARY KEY,
    "todos_json" TEXT NOT NULL,
    "updated_at" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "github_connections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT,
    "primary_email" TEXT,
    "access_token" TEXT,
    "token_type" TEXT,
    "scope" TEXT,
    "created_at" INTEGER NOT NULL DEFAULT 0,
    "updated_at" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "github_issues" (
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
    "updated_at" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "onboarding_state" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "last_step" TEXT,
    "completed_at" INTEGER,
    "created_at" INTEGER NOT NULL DEFAULT 0,
    "updated_at" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "github_app_configs" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "client_id" TEXT NOT NULL,
    "client_secret" TEXT,
    "created_at" INTEGER NOT NULL DEFAULT 0,
    "updated_at" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "cards_board_ticket_key_idx" ON "cards"("board_id", "ticket_key");

-- CreateIndex
CREATE UNIQUE INDEX "card_deps_unique" ON "card_dependencies"("card_id", "depends_on_card_id");
