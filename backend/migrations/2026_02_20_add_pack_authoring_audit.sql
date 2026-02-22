-- File: backend/migrations/2026_02_20_add_pack_authoring_audit.sql

CREATE TABLE IF NOT EXISTS pack_authoring_events (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    event_type ENUM('create', 'update', 'delete') NOT NULL,
    author_id BIGINT NOT NULL,
    pack_id BIGINT NOT NULL,
    content_version_pin BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pack_authoring_events_author_id ON pack_authoring_events (author_id);
CREATE INDEX IF NOT EXISTS idx_pack_authoring_events_pack_id ON pack_authoring_events (pack_id);

CREATE TABLE IF NOT EXISTS content_version_pins (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    game_object_type ENUM('pack', 'card') NOT NULL,
    game_object_id BIGINT NOT NULL,
    version VARCHAR(255) NOT NULL,
    UNIQUE INDEX idx_content_version_pins (game_object_type, game_object_id, version)
);

CREATE TABLE IF NOT EXISTS comparability_guards (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    pack_id BIGINT NOT NULL,
    content_version_pin_from BIGINT NOT NULL,
    content_version_pin_to BIGINT NOT NULL,
    FOREIGN KEY (pack_id) REFERENCES packs(id),
    FOREIGN KEY (content_version_pin_from) REFERENCES content_version_pins(id),
    FOREIGN KEY (content_version_pin_to) REFERENCES content_version_pins(id)
);
```

This SQL script creates three tables: `pack_authoring_events`, `content_version_pins`, and `comparability_guards`. The `pack_authoring_events` table is an append-only table that logs events related to pack authoring. The `content_version_pins` table stores unique versions of game objects (such as packs or cards). Lastly, the `comparability_guards` table defines a range of compatible content versions for each pack.

The script also includes indexes and foreign keys to ensure data integrity and performance.
