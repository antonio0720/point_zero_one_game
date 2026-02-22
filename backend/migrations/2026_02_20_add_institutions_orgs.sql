-- Point Zero One Digital - Institutions, Organizations, and Associations Table Schema
-- Created at 2026-02-20T10:00:00Z

CREATE TABLE IF NOT EXISTS institutions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS organizations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    institution_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(id)
);

CREATE TABLE IF NOT EXISTS institution_users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    institution_id INT NOT NULL,
    role_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (institution_id) REFERENCES institutions(id),
    FOREIGN KEY (role_id) REFERENCES institution_roles(id)
);

CREATE TABLE IF NOT EXISTS institution_roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS institution_sso_configs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    institution_id INT NOT NULL,
    sso_provider VARCHAR(255) NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    client_secret VARCHAR(255) NOT NULL,
    redirect_uri VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(id)
);

CREATE TABLE IF NOT EXISTS institution_entitlements (
    id INT PRIMARY KEY AUTO_INCREMENT,
    institution_id INT NOT NULL,
    entitlement VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(id)
);

-- Indexes for faster lookups
CREATE INDEX institution_slug_idx ON institutions (slug);
CREATE INDEX organization_institution_id_idx ON organizations (institution_id);
CREATE INDEX organization_slug_idx ON organizations (slug);
CREATE INDEX institution_user_role_id_idx ON institution_users (role_id);
CREATE INDEX institution_sso_config_institution_id_idx ON institution_sso_configs (institution_id);
CREATE INDEX institution_entitlement_institution_id_idx ON institution_entitlements (institution_id);
