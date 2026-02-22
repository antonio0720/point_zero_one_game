-- File: backend/migrations/2026_02_20_add_telemetry_timeseries.sql

CREATE TABLE IF NOT EXISTS metric_dimensions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_metric_dimensions_name ON metric_dimensions (name);

CREATE TYPE IF NOT EXISTS metric_value AS (
    dimension_id INT REFERENCES metric_dimensions(id),
    value FLOAT8,
    timestamp TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS metrics_timeseries (
    id SERIAL PRIMARY KEY,
    metric_value metric_value,
    minute INTEGER REFERENCES generate_series(0, 59) ON UPDATE DO NOTHING,
    hour INTEGER REFERENCES generate_series(0, 23) ON UPDATE DO NOTHING,
    day INTEGER REFERENCES generate_series(1, last_day(now())) ON UPDATE DO NOTHING,
    UNIQUE (metric_value, minute, hour, day),
    CONSTRAINT metric_timeseries_is_active CHECK (is_active = true)
);

CREATE INDEX IF NOT EXISTS idx_metrics_timeseries_dimension_id ON metrics_timeseries (dimension_id);
CREATE INDEX IF NOT EXISTS idx_metrics_timeseries_minute ON metrics_timeseries (minute);
CREATE INDEX IF NOT EXISTS idx_metrics_timeseries_hour ON metrics_timeseries (hour);
CREATE INDEX IF NOT EXISTS idx_metrics_timeseries_day ON metrics_timeseries (day);

CREATE TABLE IF NOT EXISTS metric_rollups (
    id SERIAL PRIMARY KEY,
    metric_id INT REFERENCES metrics_timeseries(id),
    rollup_type VARCHAR(255) NOT NULL,
    value FLOAT8,
    timestamp TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_metric_rollups_metric_id ON metric_rollups (metric_id);

CREATE TABLE IF NOT EXISTS metric_anomalies (
    id SERIAL PRIMARY KEY,
    metric_id INT REFERENCES metrics_timeseries(id),
    anomaly_type VARCHAR(255) NOT NULL,
    start_timestamp TIMESTAMP WITH TIME ZONE,
    end_timestamp TIMESTAMP WITH TIME ZONE,
    description TEXT
);

CREATE INDEX IF NOT EXISTS idx_metric_anomalies_metric_id ON metric_anomalies (metric_id);
