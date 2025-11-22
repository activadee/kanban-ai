CREATE TABLE IF NOT EXISTS `onboarding_state` (
    `id` text PRIMARY KEY,
    `status` text NOT NULL DEFAULT 'pending',
    `last_step` text,
    `completed_at` integer,
    `created_at` integer NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` integer NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `github_app_configs` (
    `id` text PRIMARY KEY,
    `client_id` text NOT NULL,
    `client_secret` text,
    `created_at` integer NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` integer NOT NULL DEFAULT CURRENT_TIMESTAMP
);
