ALTER TABLE `project_settings` ADD COLUMN `inline_agent` text;
ALTER TABLE `project_settings` ADD COLUMN `inline_profile_id` text;
UPDATE `project_settings`
SET
    `inline_agent` = COALESCE(`inline_agent`, `default_agent`, 'DROID'),
    `inline_profile_id` = COALESCE(`inline_profile_id`, `default_profile_id`)
WHERE `inline_agent` IS NULL;

