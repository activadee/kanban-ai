PRAGMA foreign_keys=OFF;
PRAGMA defer_foreign_keys=ON;

CREATE TABLE "dashboard_inbox_items" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "is_read" INTEGER NOT NULL DEFAULT 0,
    "updated_at" INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
);

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

