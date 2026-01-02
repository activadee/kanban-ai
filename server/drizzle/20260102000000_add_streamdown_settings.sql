ALTER TABLE app_settings ADD COLUMN streamdown_assistant_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE app_settings ADD COLUMN streamdown_user_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE app_settings ADD COLUMN streamdown_system_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE app_settings ADD COLUMN streamdown_thinking_enabled INTEGER NOT NULL DEFAULT 1;
