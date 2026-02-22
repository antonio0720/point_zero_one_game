/**
 * PartnerTenant Contract
 */

export interface PartnerTenant {
  id: number;
  partnerId: number;
  tenantId: number;
  skuId?: number;
  featureFlags?: string[];
  billingPlanId?: number;
}

export interface PartnerSKU {
  id: number;
  name: string;
  description?: string;
  price: number;
}

/**
 * Data boundaries for PartnerTenant and PartnerSKU
 */

const partnerTenantTable = 'partner_tenants';
const partnerSkuTable = 'partner_skus';

export const createPartnerTenant = (partnerTenant: PartnerTenant) => {
  // Insert a new row into the partner_tenants table
};

export const updatePartnerTenant = (id: number, updates: Partial<PartnerTenant>) => {
  // Update an existing row in the partner_tenants table with the provided updates
};

export const deletePartnerTenant = (id: number) => {
  // Delete a row from the partner_tenants table with the provided id
};

export const getPartnerTenantById = (id: number) => {
  // Return a single PartnerTenant object matching the provided id from the partner_tenants table
};

export const listPartnerTenants = () => {
  // Return all rows from the partner_tenants table as an array of PartnerTenant objects
};

export const createPartnerSku = (partnerSku: PartnerSKU) => {
  // Insert a new row into the partner_skus table
};

export const updatePartnerSku = (id: number, updates: Partial<PartnerSKU>) => {
  // Update an existing row in the partner_skus table with the provided updates
};

export const deletePartnerSku = (id: number) => {
  // Delete a row from the partner_skus table with the provided id
};

export const getPartnerSkuById = (id: number) => {
  // Return a single PartnerSKU object matching the provided id from the partner_skus table
};

export const listPartnerSkus = () => {
  // Return all rows from the partner_skus table as an array of PartnerSKU objects
};
```

SQL:

```sql
-- PartnerTenant Table
CREATE TABLE IF NOT EXISTS `partner_tenants` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `partner_id` INT(11) UNSIGNED NOT NULL,
  `tenant_id` INT(11) UNSIGNED NOT NULL,
  `sku_id` INT(11) UNSIGNED,
  `feature_flags` TEXT,
  `billing_plan_id` INT(11) UNSIGNED,
  PRIMARY KEY (`id`),
  INDEX `partner_id` (`partner_id`),
  INDEX `tenant_id` (`tenant_id`),
  INDEX `sku_id` (`sku_id`),
  COMMENT 'Partner Tenant Contract'
);

-- PartnerSKU Table
CREATE TABLE IF NOT EXISTS `partner_skus` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `price` DECIMAL(10, 2) NOT NULL,
  PRIMARY KEY (`id`),
  COMMENT 'Partner SKU'
);
```

Bash:

```bash
#!/bin/bash
set -euo pipefail
echo "Action: $0" > /var/log/action.log
```

Terraform (example):

```hcl
resource "aws_rds_instance" "example" {
  allocated_storage      = 20
  storage_type           = "gp2"
  engine                 = "postgres"
  engine_version         = "13.4"
  instance_class         = "db.t2.micro"
  username               = "myuser"
  password               = "mypassword"
  parameter_group_name   = "default.postgres13"
  db_name                = "mydatabase"
  skip_final_snapshot    = true
}
