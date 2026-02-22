-- Point Zero One Digital - Backend Migration Script - 2026-02-20 - Add Curriculum Entitlements

SET SQL_MODE = 'STRICT_ALL_TABLES';

-- Create table org_entitlements with append-only design
CREATE TABLE IF NOT EXISTS org_entitlements (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  entitlement_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY (organization_id, entitlement_id)
);

-- Create table cohort_entitlements with append-only design
CREATE TABLE IF NOT EXISTS cohort_entitlements (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  cohort_id BIGINT UNSIGNED NOT NULL,
  entitlement_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY (cohort_id, entitlement_id)
);

-- Create table entitlement_receipts with append-only design
CREATE TABLE IF NOT EXISTS entitlement_receipts (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  receipt_id BIGINT UNSIGNED NOT NULL,
  organization_id BIGINT UNSIGNED NOT NULL,
  cohort_id BIGINT UNSIGNED,
  entitlement_id BIGINT UNSIGNED NOT NULL,
  quantity INT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY (receipt_id),
  FOREIGN KEY (organization_id) REFERENCES org_entitlements(organization_id),
  FOREIGN KEY (cohort_id) REFERENCES cohort_entitlements(cohort_id),
  FOREIGN KEY (entitlement_id) REFERENCES game_entitlements(id)
);

-- Indexes for faster query performance
ALTER TABLE org_entitlements ADD INDEX idx_org_entitlements_organization_id (organization_id);
ALTER TABLE cohort_entitlements ADD INDEX idx_cohort_entitlements_cohort_id (cohort_id);
ALTER TABLE entitlement_receipts ADD INDEX idx_entitlement_receipts_organization_id (organization_id);
ALTER TABLE entitlement_receipts ADD INDEX idx_entitlement_receipts_cohort_id (cohort_id);
ALTER TABLE entitlement_receipts ADD INDEX idx_entitlement_receipts_entitlement_id (entitlement_id);
```

TypeScript:

```typescript
/**
 * Migration script for adding curriculum entitlements tables.
 */
export const up = (conn: Connection) => {
  return Promise.all([
    conn.createTable('org_entitlements', {
      id: 'bigint UNSIGNED PRIMARY KEY AUTO_INCREMENT',
      organization_id: 'BIGINT UNSIGNED NOT NULL',
      entitlement_id: 'BIGINT UNSIGNED NOT NULL',
      created_at: 'TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP',
      UNIQUE: ['organization_id', 'entitlement_id'],
    }),
    conn.createTable('cohort_entitlements', {
      id: 'bigint UNSIGNED PRIMARY KEY AUTO_INCREMENT',
      cohort_id: 'BIGINT UNSIGNED NOT NULL',
      entitlement_id: 'BIGINT UNSIGNED NOT NULL',
      created_at: 'TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP',
      UNIQUE: ['cohort_id', 'entitlement_id'],
    }),
    conn.createTable('entitlement_receipts', {
      id: 'bigint UNSIGNED PRIMARY KEY AUTO_INCREMENT',
      receipt_id: 'BIGINT UNSIGNED NOT NULL',
      organization_id: 'BIGINT UNSIGNED NOT NULL',
      cohort_id: 'BIGINT UNSIGNED',
      entitlement_id: 'BIGINT UNSIGNED NOT NULL',
      quantity: 'INT NOT NULL',
      created_at: 'TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP',
      UNIQUE: ['receipt_id'],
      FOREIGN_KEYS: [
        { name: 'org_entitlements', columns: ['organization_id'], references: ['org_entitlements', 'id'] },
        { name: 'cohort_entitlements', columns: ['cohort_id'], references: ['cohort_entitlements', 'id'] },
        { name: 'game_entitlements', columns: ['entitlement_id'], references: ['game_entitlements', 'id'] },
      ],
    }),
  ]);
};

export const down = (conn: Connection) => {
  return Promise.all([
    conn.dropTable('entitlement_receipts'),
    conn.dropTable('cohort_entitlements'),
    conn.dropTable('org_entitlements'),
  ]);
};
