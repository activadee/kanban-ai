ALTER TABLE "cards" ADD COLUMN "ticket_type" text CHECK ("ticket_type" IN (
    'feat','fix','chore','docs','style','refactor','perf','test','build','ci','revert'
) OR "ticket_type" IS NULL);
