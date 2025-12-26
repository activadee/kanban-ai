CREATE TABLE IF NOT EXISTS card_plans (
  id TEXT PRIMARY KEY NOT NULL,
  card_id TEXT NOT NULL UNIQUE,
  board_id TEXT NOT NULL,
  plan_markdown TEXT NOT NULL,
  source_message_id TEXT,
  source_attempt_id TEXT,
  created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT card_plans_card_id_fkey FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT card_plans_board_id_fkey FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT card_plans_source_attempt_id_fkey FOREIGN KEY (source_attempt_id) REFERENCES attempts(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_card_plans_board_id ON card_plans(board_id);
CREATE INDEX IF NOT EXISTS idx_card_plans_source_attempt_id ON card_plans(source_attempt_id);

