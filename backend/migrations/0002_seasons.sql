-- Point Zero One Digital - Backend Migrations - 0002_seasons.sql

CREATE TYPE season_membership_type AS ENUM ('BRONZE', 'SILVER', 'GOLD');

CREATE TABLE seasons (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    membership_type season_membership_type DEFAULT 'BRONZE',
    is_active BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_seasons_is_active ON seasons (is_active);

CREATE TABLE season_windows (
    id SERIAL PRIMARY KEY,
    season_id INTEGER REFERENCES seasons(id) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    UNIQUE (season_id, start_date),
    FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE
);
