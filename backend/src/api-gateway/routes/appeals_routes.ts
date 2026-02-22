/**
 * Appeals API routes for Point Zero One Digital's financial roguelike game.
 */

import express from 'express';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Define the Appeal model with strict types and no 'any'
interface Appeal {
  id: string;
  userId: string;
  reason: string;
  attachmentLink: string;
}

// Create an in-memory storage for appeals (replace this with a database connection)
const appeals: Appeal[] = [];

/**
 * POST /appeals - Anti-abuse, attachment links only.
 */
router.post('/appeals', async (req: Request, res: Response) => {
  const { userId, reason, attachmentLink } = req.body;

  // Validate input data
  if (!userId || !reason || !attachmentLink) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Generate a unique ID for the appeal
  const appealId = uuidv4();

  // Store the appeal in memory (replace this with database insertion)
  appeals.push({ id: appealId, userId, reason, attachmentLink });

  res.status(201).json({ id: appealId });
});

export default router;
```

SQL:

```sql
-- Appeal table for Point Zero One Digital's financial roguelike game.
CREATE TABLE IF NOT EXISTS appeals (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(36) NOT NULL,
  reason TEXT NOT NULL,
  attachment_link TEXT NOT NULL,
  UNIQUE (userId)
);

-- Indexes for faster lookups.
CREATE INDEX IF NOT EXISTS idx_appeals_user_id ON appeals (userId);
```

Bash:

```bash
#!/bin/sh
set -euo pipefail
echo "Starting log" > /var/log/myapp.log
...
echo "Finished log" >> /var/log/myapp.log
```

Terraform:

```hcl
resource "aws_rds_instance" "appeals_db" {
  allocated_storage = 20
  engine            = "postgres"
  instance_class    = "db.t2.micro"
  name              = "pointzeroonedigital-appeals-db"
  username          = "myuser"
  password          = "mypassword"
  skip_final_snapshot = true
}

resource "aws_rds_table" "appeals" {
  name           = "appeals"
  read_replica_identifier = "${aws_rds_instance.appeals_db.id}-read-replica"
  engine         = aws_rds_instance.appeals_db.engine
  schema         = file("schema.sql")
}
