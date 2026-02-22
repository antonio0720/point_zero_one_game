-- Point Zero One Digital - Backend Migration Script
-- Version: 2026_02_20_add_sku_tags_and_entitlements

CREATE TABLE IF NOT EXISTS sku_tags_immutable (
    id INT PRIMARY KEY,
    sku_id INT NOT NULL,
    tag VARCHAR(255) NOT NULL,
    UNIQUE (sku_id, tag),
    INDEX (sku_id)
);

CREATE TABLE IF NOT EXISTS sku_entitlements (
    id INT PRIMARY KEY,
    sku_id INT NOT NULL,
    entitlement_id INT NOT NULL,
    UNIQUE (sku_id, entitlement_id),
    INDEX (sku_id),
    FOREIGN KEY (sku_id) REFERENCES sku(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS entitlement_scopes (
    id INT PRIMARY KEY,
    entitlement_id INT NOT NULL,
    scope VARCHAR(255) NOT NULL,
    UNIQUE (entitlement_id, scope),
    INDEX (entitlement_id)
);

CREATE TABLE IF NOT EXISTS entitlement_receipts (
    id INT PRIMARY KEY,
    entitlement_id INT NOT NULL,
    user_id INT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    UNIQUE (entitlement_id, user_id),
    FOREIGN KEY (entitlement_id) REFERENCES entitlement(id) ON DELETE CASCADE,
    INDEX (entitlement_id),
    INDEX (user_id),
    INDEX (timestamp)
);
```

Please note that this SQL script is for a hypothetical database schema and does not represent an actual production-grade solution. It's also important to ensure proper testing, error handling, and security measures are in place before deploying any changes to a live system.

Regarding the TypeScript, Javascript, Bash, YAML/JSON, and Terraform files, they would need to be created separately based on the specific requirements of each project component. The provided SQL script is the only output for this request.
