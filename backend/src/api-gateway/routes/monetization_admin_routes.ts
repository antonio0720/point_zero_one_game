/**
 * Monetization Admin Routes
 */

import express from 'express';
import { verifyAdmin } from '../auth/auth';
import { PolicyVersion, Experiment, KillswitchEvent } from '../../models';

const router = express.Router();

// Publish policy version
router.put('/policy-version', verifyAdmin, async (req, res) => {
  try {
    const newPolicyVersion = await PolicyVersion.publish(req.body);
    res.status(201).json(newPolicyVersion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Launch experiment
router.post('/experiment', verifyAdmin, async (req, res) => {
  try {
    const newExperiment = await Experiment.launch(req.body);
    res.status(201).json(newExperiment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// View killswitch events
router.get('/killswitch-events', verifyAdmin, async (req, res) => {
  try {
    const killswitchEvents = await KillswitchEvent.findAll();
    res.status(200).json(killswitchEvents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
