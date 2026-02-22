-- File: backend/migrations/2026_02_20_add_offer_impressions.sql

CREATE TABLE IF NOT EXISTS offer_impressions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    offer_id BIGINT NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (offer_id) REFERENCES offers(id),
    UNIQUE (user_id, offer_id)
);

CREATE INDEX IF NOT EXISTS idx_offer_impressions_user_id ON offer_impressions (user_id);
CREATE INDEX IF NOT EXISTS idx_offer_impressions_offer_id ON offer_impressions (offer_id);

CREATE TABLE IF NOT EXISTS offer_decisions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    offer_id BIGINT NOT NULL,
    decision TINYINT NOT NULL CHECK (decision IN (0, 1)), -- 0: rejected, 1: accepted
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (offer_id) REFERENCES offers(id),
    UNIQUE (user_id, offer_id)
);

CREATE INDEX IF NOT EXISTS idx_offer_decisions_user_id ON offer_decisions (user_id);
CREATE INDEX IF NOT EXISTS idx_offer_decisions_offer_id ON offer_decisions (offer_id);

CREATE TABLE IF NOT EXISTS offer_cooldowns (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    offer_id BIGINT NOT NULL,
    cooldown INTEGER NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (offer_id) REFERENCES offers(id),
    UNIQUE (user_id, offer_id)
);

CREATE INDEX IF NOT EXISTS idx_offer_cooldowns_user_id ON offer_cooldowns (user_id);
CREATE INDEX IF NOT EXISTS idx_offer_cooldowns_offer_id ON offer_cooldowns (offer_id);

CREATE TABLE IF NOT EXISTS user_offer_limits (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    offer_id BIGINT NOT NULL,
    limit INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (offer_id) REFERENCES offers(id),
    UNIQUE (user_id, offer_id)
);

CREATE INDEX IF NOT EXISTS idx_user_offer_limits_user_id ON user_offer_limits (user_id);
CREATE INDEX IF NOT EXISTS idx_user_offer_limits_offer_id ON user_offer_limits (offer_id);
