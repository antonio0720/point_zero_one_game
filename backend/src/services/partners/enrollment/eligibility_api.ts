/**
 * Eligibility API service for handling roster deltas from HRIS, bank, and EAP systems.
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import { RosterDelta } from '../models/roster-delta';
import { Partner } from '../models/partner';

const router = express.Router();

/**
 * Middleware to verify the JWT token for partner authentication.
 */
function partnerAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).send('Missing Authorization header');

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.PARTNER_SECRET);
    const partnerId = decoded as Partner;
    req.partner = partnerId;
    next();
  } catch (err) {
    return res.status(401).send('Invalid token');
  }
}

/**
 * POST /api/eligibility - Enroll roster deltas from partners.
 */
router.post('/', partnerAuth, async (req, res) => {
  const partner = req.partner;
  const rosterDeltas = req.body as RosterDelta[];

  // Process and persist the roster deltas here...

  res.status(204).send();
});

export default router;
