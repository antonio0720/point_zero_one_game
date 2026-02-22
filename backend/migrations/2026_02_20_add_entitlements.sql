-- File: backend/migrations/2026_02_20_add_entitlements.sql

CREATE TABLE IF NOT EXISTS user_entitlements (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    userId BIGINT NOT NULL,
    entitlementId BIGINT NOT NULL,
    expirationTimestamp BIGINT NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (entitlementId) REFERENCES entitlements(id)
);

CREATE TABLE IF NOT EXISTS entitlement_receipts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    userId BIGINT NOT NULL,
    entitlementId BIGINT NOT NULL,
    receiptHash VARCHAR(255) NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (entitlementId) REFERENCES entitlements(id),
    UNIQUE (userId, entitlementId, receiptHash)
);

CREATE TABLE IF NOT EXISTS entitlement_compat_cache (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    entitlementId BIGINT NOT NULL,
    gameVersion VARCHAR(255) NOT NULL,
    isCompatible BOOLEAN NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entitlementId) REFERENCES entitlements(id),
    INDEX (entitlementId, gameVersion),
    UNIQUE (entitlementId, gameVersion)
);

CREATE TABLE IF NOT EXISTS ranked_incompat_events (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    userId BIGINT NOT NULL,
    entitlementId BIGINT NOT NULL,
    gameVersion VARCHAR(255) NOT NULL,
    incompatibleEventTimestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (entitlementId) REFERENCES entitlements(id),
    INDEX (userId, entitlementId, gameVersion),
    UNIQUE (userId, entitlementId, gameVersion)
);
