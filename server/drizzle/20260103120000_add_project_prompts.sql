-- Add configurable prompts for ticket enhancement and PR summary per project
ALTER TABLE project_settings ADD COLUMN enhance_prompt TEXT;
ALTER TABLE project_settings ADD COLUMN pr_summary_prompt TEXT;
