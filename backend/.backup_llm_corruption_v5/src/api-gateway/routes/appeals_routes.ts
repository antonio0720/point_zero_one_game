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

SQL:

-- Appeal table for Point Zero One Digital's financial roguelike game.
