CREATE TABLE IF NOT EXISTS `card_dependencies`
(
    `card_id`
    text
    NOT
    NULL,
    `depends_on_card_id`
    text
    NOT
    NULL,
    `created_at`
    integer
    DEFAULT
    CURRENT_TIMESTAMP
    NOT
    NULL,
    FOREIGN
    KEY
(
    `card_id`
) REFERENCES `cards`
(
    `id`
) ON UPDATE no action
  ON DELETE cascade,
    FOREIGN KEY
(
    `depends_on_card_id`
) REFERENCES `cards`
(
    `id`
)
  ON UPDATE no action
  ON DELETE cascade
    );
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `card_deps_unique` ON `card_dependencies` (`card_id`, `depends_on_card_id`);

