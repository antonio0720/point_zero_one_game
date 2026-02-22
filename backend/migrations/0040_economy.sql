-- Point Zero One Digital - Backend Migrations - 0040_economy.sql

CREATE TABLE IF NOT EXISTS entitlements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    entitlement_type VARCHAR(255) NOT NULL,
    expiration_date DATE,
    UNIQUE (user_id, entitlement_type)
);

CREATE TABLE IF NOT EXISTS season_passes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    season VARCHAR(255) NOT NULL,
    expiration_date DATE,
    UNIQUE (user_id, season)
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    subscription_type VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    UNIQUE (user_id, subscription_type)
);

CREATE TABLE IF NOT EXISTS purchases (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    purchase_id VARCHAR(255) NOT NULL UNIQUE,
    item_type VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    transaction_id VARCHAR(255),
    purchase_time TIMESTAMP WITH TIME ZONE NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS cosmetic_inventory (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    item_type VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    UNIQUE (user_id, item_type)
);

CREATE TABLE IF NOT EXISTS receipt_ledger (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    purchase_id VARCHAR(255) NOT NULL,
    item_type VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    transaction_id VARCHAR(255),
    purchase_time TIMESTAMP WITH TIME ZONE NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE (purchase_id, user_id)
);

CREATE TABLE IF NOT EXISTS promo_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(255) UNIQUE NOT NULL,
    discount DECIMAL(10, 2) NOT NULL,
    max_uses INTEGER NOT NULL DEFAULT 0,
    used_count INTEGER NOT NULL DEFAULT 0,
    expiration_date DATE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS b2b_seats (
    id SERIAL PRIMARY KEY,
    game_session_id INTEGER NOT NULL REFERENCES game_sessions(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    seat_number INTEGER NOT NULL UNIQUE,
    FOREIGN KEY (game_session_id) REFERENCES game_sessions(id)
);
