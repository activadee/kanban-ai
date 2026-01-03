-- Add separate project setting to auto-close tickets on GitHub issue close
ALTER TABLE project_settings
    ADD COLUMN auto_close_ticket_on_issue_close INTEGER NOT NULL DEFAULT 0;
