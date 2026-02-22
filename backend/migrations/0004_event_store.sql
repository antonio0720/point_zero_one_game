-- File: backend/migrations/0004_event_store.sql

CREATE TYPE IF NOT EXISTS event_store_aggregate_type AS ENUM ('Player', 'Item', 'Currency', 'Level', 'Shop');
CREATE TYPE IF NOT EXISTS event_store_event_type AS ENUM ('Created', 'Updated', 'Deleted', 'Purchased', 'LevelledUp', 'Equipped');

CREATE SEQUENCE IF NOT EXISTS event_store_id_seq START 1;

CREATE TABLE IF NOT EXISTS global_event_store (
    id INTEGER NOT NULL DEFAULT nextval('event_store_id_seq'),
    aggregate_id VARCHAR(255) NOT NULL,
    aggregate_type event_store_aggregate_type NOT NULL,
    event_type event_store_event_type NOT NULL,
    payload_json JSONB NOT NULL,
    metadata_json JSONB,
    version INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE (aggregate_id, aggregate_type, event_type)
);

CREATE INDEX IF NOT EXISTS global_event_store_aggregate_id_aggregate_type_event_type_idx ON global_event_store (aggregate_id, aggregate_type, event_type);
CREATE INDEX IF NOT EXISTS global_event_store_created_at_idx ON global_event_store (created_at);
CREATE INDEX IF NOT EXISTS global_event_store_monthly_partition_idx ON global_event_store USING hypertable (to_char(created_at, 'YYYY-MM'));
