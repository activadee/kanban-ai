PRAGMA foreign_keys=OFF;
PRAGMA defer_foreign_keys=ON;

ALTER TABLE "project_settings" ADD COLUMN "github_issue_auto_create_enabled" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "github_issues" ADD COLUMN "direction" TEXT NOT NULL DEFAULT 'imported';
UPDATE "github_issues" SET "direction" = 'imported' WHERE "direction" IS NULL;

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

