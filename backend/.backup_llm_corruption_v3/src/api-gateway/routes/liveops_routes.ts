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

-- LiveOps Table Structure

CREATE TABLE IF NOT EXISTS patch_notes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alerts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  severity ENUM('info', 'warning', 'error') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  patch_note_id INT,
  FOREIGN KEY (patch_note_id) REFERENCES patch_notes(id)
);

#!/bin/bash
set -euo pipefail

echo "Executing script"
# Your commands here

echo "Script completed successfully"

api_gateway:
  liveops:
    ops_board:
      type: string
      description: Ops board data for admins
    patch_notes:
      type: array
      items:
        type: object
        properties:
          id:
            type: integer
            description: Unique identifier for the patch note
          title:
            type: string
            description: Title of the patch note
          content:
            type: string
            description: Content of the patch note
          created_at:
            type: string
            format: date-time
            description: Timestamp when the patch note was created
          updated_at:
            type: string
            format: date-time
            description: Timestamp when the patch note was last updated
    alerts:
      type: array
      items:
        type: object
        properties:
          id:
            type: integer
            description: Unique identifier for the alert
          title:
            type: string
            description: Title of the alert
          content:
            type: string
            description: Content of the alert
          severity:
            type: string
            enum: ["info", "warning", "error"]
            description: Severity level of the alert
          created_at:
            type: string
            format: date-time
            description: Timestamp when the alert was created
          updated_at:
            type: string
            format: date-time
            description: Timestamp when the alert was last updated
          patch_note_id:
            type: integer
            description: Reference to the related patch note
