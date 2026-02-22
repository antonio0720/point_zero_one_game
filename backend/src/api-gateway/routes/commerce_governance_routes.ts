/**
 * Commerce Governance Routes for API Gateway
 */

import express from 'express';
import { Router } from 'express-openapi-validator';
import jwt from 'jsonwebtoken';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import auditLogging from '../audit-logging';
import { RoleBasedAccessControl } from '../rbac';

const router = Router();
const rateLimiter = new RateLimiterRedis({ points: 10, duration: 60 });

// Define the Commerce Governance routes with RBAC and audit logging
router.get('/', RoleBasedAccessControl('admin'), async (req, res) => {
  // Implement the logic for fetching commerce governance data
});

router.post('/', [RoleBasedAccessControl('admin'), rateLimiter.wrap], async (req, res) => {
  // Implement the logic for creating new commerce governance data
});

router.put('/:id', [RoleBasedAccessControl('admin'), rateLimiter.wrap], async (req, res) => {
  // Implement the logic for updating existing commerce governance data
});

router.delete('/:id', [RoleBasedAccessControl('admin'), rateLimiter.wrap], async (req, res) => {
  // Implement the logic for deleting commerce governance data
});

// Export the Commerce Governance routes
export default router;
```

For SQL, I'll provide an example of a simplified `commerce_governance` table with indexes and foreign keys:

```sql
CREATE TABLE IF NOT EXISTS commerce_governance (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  user_id INT REFERENCES users(id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_commerce_governance_name (name)
);
```

For Bash, I'll provide an example of a script that logs all actions:

```bash
#!/bin/bash
set -euo pipefail

echo "Starting action"
# Your command here
echo "Action completed"
```

For YAML or JSON, I'll provide an example of a Terraform configuration for creating an AWS RDS instance:

```hcl
resource "aws_db_instance" "commerce_governance" {
  allocated_storage      = 20
  storage_type           = "gp2"
  engine                 = "postgres"
  engine_version         = "13.2"
  instance_class         = "db.t2.micro"
  username               = "your_username"
  password               = "your_password"
  db_name                = "commerce_governance"
  skip_final_snapshot    = true
  vpc_security_group_ids = [aws_security_group.allow_all.id]
}
