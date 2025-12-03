ALTER TABLE "project_settings" ADD COLUMN "github_issue_sync_enabled" integer NOT NULL DEFAULT 0;
ALTER TABLE "project_settings" ADD COLUMN "github_issue_sync_state" text NOT NULL DEFAULT 'open';
ALTER TABLE "project_settings" ADD COLUMN "github_issue_sync_interval_minutes" integer NOT NULL DEFAULT 15;
ALTER TABLE "project_settings" ADD COLUMN "last_github_issue_sync_at" integer;
ALTER TABLE "project_settings" ADD COLUMN "last_github_issue_sync_status" text NOT NULL DEFAULT 'idle';

