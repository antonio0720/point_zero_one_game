-- Point Zero One Digital - Backend Migration Script - Add SKU Taxonomy (2026-02-20)

CREATE TABLE IF NOT EXISTS skus (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    taxonomy_tag VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS skus_taxonomy_tag_idx ON skus (taxonomy_tag);

CREATE TABLE IF NOT EXISTS sku_versions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sku_id INT NOT NULL,
    version VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sku_id) REFERENCES skus(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS sku_versions_sku_id_idx ON sku_versions (sku_id);

CREATE TABLE IF NOT EXISTS sku_validation_reports (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sku_version_id INT NOT NULL,
    validation_status ENUM('valid', 'invalid') NOT NULL,
    validation_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sku_version_id) REFERENCES sku_versions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS sku_validation_reports_sku_version_id_idx ON sku_validation_reports (sku_version_id);

CREATE TABLE IF NOT EXISTS forbidden_sku_registry (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sku_id INT NOT NULL,
    reason VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sku_id) REFERENCES skus(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS forbidden_sku_registry_sku_id_idx ON forbidden_sku_registry (sku_id);
