/**
 * Moments routes for the Point Zero One Digital backend.
 */

import express from 'express';
import { Moment, MomentDocument } from '../models/moment';
import { verifyEmail } from '../../auth/email-verification';

const router = express.Router();

// POST /host/moments - Log a moment to the database
router.post('/host/moments', async (req, res) => {
  const { momentCode, gameSeed, tick, hostEmail } = req.body;

  // Verify the host email is valid before logging the moment
  await verifyEmail(hostEmail);

  const newMoment: Moment = new Moment({
    momentCode,
    gameSeed,
    tick,
    hostEmail,
  });

  try {
    const savedMoment: MomentDocument = await newMoment.save();
    res.status(201).json(savedMoment);
  } catch (error) {
    console.error('Error logging moment:', error);
    res.status(500).send('Error logging moment');
  }
});

// GET /host/moments/:session_id - Retrieve all moments for a session with timestamps
router.get('/host/moments/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  try {
    const moments: MomentDocument[] = await Moment.find({ sessionId })
      .sort('-createdAt')
      .exec();

    const formattedMoments: Moment[] = moments.map((moment) => ({
      ...moment.toJSON(),
      createdAt: moment.createdAt.toISOString(),
    }));

    res.json(formattedMoments);
  } catch (error) {
    console.error('Error retrieving moments:', error);
    res.status(500).send('Error retrieving moments');
  }
});

export default router;
```

```sql
-- Moment model for Point Zero One Digital backend
CREATE TABLE IF NOT EXISTS moments (
  _id MongoID PRIMARY KEY,
  momentCode VARCHAR(255) NOT NULL,
  gameSeed VARCHAR(255) NOT NULL,
  tick INTEGER NOT NULL,
  hostEmail VARCHAR(255) NOT NULL,
  sessionId VARCHAR(255),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (momentCode, gameSeed, tick, hostEmail)
);

-- Indexes for the Moment model
CREATE INDEX IF NOT EXISTS moment_sessionId_idx ON moments (sessionId);
```

```bash
#!/bin/sh
set -euo pipefail

echo "Logging action: Creating or updating a moment"

# Your script to log the moment goes here
```

```yaml
data "aws_caller_identity" "current" {}

resource "aws_dynamodb_table" "moments" {
  name           = "pz1-moments"
  read_capacity  = 5
  write_capacity = 5
  hash_key       = "momentCode"

  attribute {
    name = "momentCode"
    type = "S"
  }

  attribute {
    name = "gameSeed"
    type = "S"
  }

  attribute {
    name = "tick"
    type = "N"
  }

  attribute {
    name = "hostEmail"
    type = "S"
  }

  attribute {
    name = "sessionId"
    type = "S"
  }

  tags = {
    Name        = "pz1-moments"
    Environment = "${var.environment}"
  }
}
