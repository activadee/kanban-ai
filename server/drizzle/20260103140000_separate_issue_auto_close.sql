ALTER TABLE project_settings
    ADD COLUMN auto_close_ticket_on_issue_close INTEGER NOT NULL DEFAULT 0;

ALTER TABLE project_settings
    ADD COLUMN last_github_issue_auto_close_at INTEGER;

ALTER TABLE project_settings
    ADD COLUMN last_github_issue_auto_close_status TEXT NOT NULL DEFAULT 'idle';

ALTER TABLE cards
    ADD COLUMN disable_auto_close_on_issue_close INTEGER NOT NULL DEFAULT 0;
