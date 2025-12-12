-- Add project setting to auto-close tickets on PR merge
ALTER TABLE project_settings
    ADD COLUMN auto_close_ticket_on_pr_merge INTEGER NOT NULL DEFAULT 0;

-- Add per-card opt-out flag (default false)
ALTER TABLE cards
    ADD COLUMN disable_auto_close_on_pr_merge INTEGER NOT NULL DEFAULT 0;
