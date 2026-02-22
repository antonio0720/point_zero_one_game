-- Point Zero One Digital - b2b.sql
-- Senior SQL Engineer
-- Strict types, no 'any', export all public symbols, include JSDoc
-- CREATE IF NOT EXISTS, idempotent

CREATE TABLE IF NOT EXISTS b2b_tenants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    industry_id INT REFERENCES industries(id),
    risk_pack_id INT REFERENCES industry_risk_packs(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tenant_seats (
    id INT PRIMARY KEY AUTO_INCREMENT,
    b2b_tenant_id INT REFERENCES b2b_tenants(id),
    seat_id INT REFERENCES seats(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE (b2b_tenant_id, seat_id)
);

CREATE TABLE IF NOT EXISTS tenant_analytics_snapshots (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_seat_id INT REFERENCES tenant_seats(id),
    timestamp TIMESTAMP NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tenant_custom_scenarios (
    id INT PRIMARY KEY AUTO_INCREMENT,
    b2b_tenant_id INT REFERENCES b2b_tenants(id),
    name VARCHAR(255) NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tenant_audit_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    b2b_tenant_id INT REFERENCES b2b_tenants(id),
    event VARCHAR(255) NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS industry_risk_packs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    risk_level ENUM('low', 'medium', 'high') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_b2b_tenants_industry_id ON b2b_tenants (industry_id);
CREATE INDEX IF NOT EXISTS idx_tenant_seats_b2b_tenant_id ON tenant_seats (b2b_tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_analytics_snapshots_timestamp ON tenant_analytics_snapshots (timestamp);
CREATE INDEX IF NOT EXISTS idx_tenant_custom_scenarios_name ON tenant_custom_scenarios (name);
CREATE INDEX IF NOT EXISTS idx_tenant_audit_log_b2b_tenant_id ON tenant_audit_log (b2b_tenant_id);
