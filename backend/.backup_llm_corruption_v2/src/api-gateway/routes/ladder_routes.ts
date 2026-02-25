Here is the TypeScript code for mounting ladder routes with auth and public read access policy, adding caching headers per ladder.

```typescript
/**
 * API Gateway - Ladder Routes
 */

import express from 'express';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Cache } from '../cache';
import { Ladder } from '../models/ladder';

const router = express.Router();
const cache = new Cache();

// Middleware to verify JWT token
function auth(req: Request, res: Response, next: Function) {
  const token = req.header('x-auth-token');
  if (!token) return res.status(401).send('Access denied. No token provided.');

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).send('Invalid token.');
  }
}

// Public route to fetch ladder data with caching
router.get('/ladder/:id', auth, async (req: Request, res: Response) => {
  const id = req.params.id;
  let ladderData = cache.get(id);

  if (!ladderData) {
    ladderData = await Ladder.findById(id);
    if (!ladderData) return res.status(404).send('Ladder not found.');

    // Cache the ladder data for 1 hour
    cache.set(id, ladderData, 60 * 60);
  }

  res.set('Cache-Control', 'public, max-age=3600');
  res.json(ladderData);
});

export { router };
