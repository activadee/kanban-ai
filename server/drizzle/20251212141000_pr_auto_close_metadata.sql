-- Add PR auto-close scheduler metadata
ALTER TABLE project_settings
    ADD COLUMN last_github_pr_auto_close_at INTEGER;

ALTER TABLE project_settings
    ADD COLUMN last_github_pr_auto_close_status TEXT NOT NULL DEFAULT 'idle';
