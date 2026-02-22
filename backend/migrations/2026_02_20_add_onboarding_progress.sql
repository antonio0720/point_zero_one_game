-- Point Zero One Digital - Onboarding Progress Database Migration (2026-02-20)

CREATE TABLE IF NOT EXISTS onboarding_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES account(id),
    current_event_id INTEGER NOT NULL,
    completed_events TEXT[] DEFAULT '{}'::text[],
    UNIQUE (user_id, current_event_id)
);

CREATE TABLE IF NOT EXISTS onboarding_events (
    id SERIAL PRIMARY KEY,
    event_name TEXT NOT NULL UNIQUE,
    order_index INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS onboarding_flags (
    user_id INTEGER NOT NULL REFERENCES account(id),
    flag_name TEXT NOT NULL PRIMARY KEY,
    value BOOLEAN NOT NULL CHECK (value = true OR value = false)
);

CREATE TABLE IF NOT EXISTS guest_to_account_links (
    guest_id INTEGER NOT NULL UNIQUE,
    account_id INTEGER NOT NULL REFERENCES account(id),
    PRIMARY KEY (guest_id, account_id)
);

CREATE INDEX IF NOT EXISTS onboarding_progress_user_id_current_event_id_idx ON onboarding_progress (user_id, current_event_id);
CREATE INDEX IF NOT EXISTS onboarding_events_order_index_idx ON onboarding_events (order_index);
