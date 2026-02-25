/**
 * LiveOps Routes for API Gateway
 */

import express from 'express';
import { Router } from 'express-openapi-validator';
import { authMiddleware } from '../middleware/auth.middleware';
import { PatchNoteService } from '../services/patch-note.service';
import { AlertService } from '../services/alert.service';

const liveOpsRouter = Router();
const patchNoteService = new PatchNoteService();
const alertService = new AlertService();

// Public patch note feed
liveOpsRouter.get('/patch-notes', async (req, res) => {
  try {
    const patchNotes = await patchNoteService.getAll();
    res.json(patchNotes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin RBAC for ops board and alerts
liveOpsRouter.use('/ops-board', authMiddleware('admin'));
liveOpsRouter.get('/ops-board', async (req, res) => {
  try {
    const opsBoard = await patchNoteService.getOpsBoard();
    res.json(opsBoard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

liveOpsRouter.use('/alerts', authMiddleware('admin'));
liveOpsRouter.get('/alerts', async (req, res) => {
  try {
    const alerts = await alertService.getAll();
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export { liveOpsRouter };

