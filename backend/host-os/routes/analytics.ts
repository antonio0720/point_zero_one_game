/**
 * Analytics routes for the host OS
 */

import express from 'express';
import { verifyAdmin } from '../auth/jwt';
import db from '../db';

const router = express.Router();

// Define the HostAnalytics table schema
db.define('HostAnalytics', {
  email: { type: db.STRING, allowNull: false },
  hostHealthScore: { type: db.FLOAT, allowNull: false },
  streak: { type: db.INTEGER, allowNull: false },
  nightsHosted: { type: db.INTEGER, allowNull: false },
  avgMomentsPerNight: { type: db.FLOAT, allowNull: false },
  clipsPostedRate: { type: db.FLOAT, allowNull: false },
  nextNightBookedRate: { type: db.FLOAT, allowNull: false },
}, {
  indexes: [
    { unique: true, fields: ['email'] },
  ],
});

router.get('/host/analytics/:email', verifyAdmin, async (req, res) => {
  try {
    const email = req.params.email;
    const hostAnalytics = await db.HostAnalytics.findOne({ where: { email } });

    if (!hostAnalytics) {
      return res.status(404).json({ error: 'Host analytics not found' });
    }

    res.json(hostAnalytics.get());
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
