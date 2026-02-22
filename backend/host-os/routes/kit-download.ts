/**
 * POST /host/download route handler
 */
import express, { Request, Response } from 'express';
import joi from 'joi';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import webhook from '../webhooks/host_kit_downloaded';

const router = express.Router();
const limiter = new RateLimiterRedis({ points: 3, duration: 86400 }); // 3 downloads per IP per day

// Validate request body schema
const downloadSchema = joi.object({
  email: joi.string().email().required(),
});

router.post('/', async (req: Request, res: Response) => {
  try {
    await limiter.consume(req.ip); // Rate limit check

    const { error } = downloadSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const { email } = req.body;

    // Check if email exists in the database
    const user = await db.oneOrNone('SELECT * FROM users WHERE email = $1', [email]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Log download to the database
    await db.none('INSERT INTO downloads (user_id, created_at) VALUES ($1, NOW())', [user.id]);

    // Trigger GHL webhook
    await webhook(user.id);

    // Generate S3/CDN URL for zip download
    const s3 = new AWS.S3();
    const bucket = process.env.S3_BUCKET;
    const key = `kits/${uuidv4()}.zip`;
    await s3.putObject({ Bucket: bucket, Key: key, Body: Buffer.from(''), ContentType: 'application/zip' }).promise();
    const url = s3.getSignedUrl(bucket, key, { expires: 60 * 5 }); // 5 minutes expiration

    res.json({ url });
  } catch (error) {
    console.error(`Error in /host/download route: ${error}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

SQL:

```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Downloads table
CREATE TABLE IF NOT EXISTS downloads (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
