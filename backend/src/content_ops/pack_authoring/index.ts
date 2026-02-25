/**
 * Pack Authoring API
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import db from '../database';
import { PackDraft, Scenario, Rubric, BenchmarkSeed } from './interfaces';

const router = express.Router();

// Define routes for pack drafts, scenarios, rubrics, and benchmark seeds

// Create a new pack draft
router.post('/drafts',
  body('title').notEmpty(),
  body('description').optional(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const packDraft: PackDraft = req.body;
      await db('pack_drafts').insert(packDraft);
      res.status(201).json({ id: packDraft.id });
    } catch (err) {
      console.error(err);
      res.status(500).send();
    }
  });

// Attach a scenario to a pack draft
router.post('/drafts/:packDraftId/scenarios',
  body('scenarioId').isInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const packDraftId = req.params.packDraftId;
      const scenarioId = req.body.scenarioId;
      await db('pack_draft_scenarios').insert({ packDraftId, scenarioId });
      res.status(204).send();
    } catch (err) {
      console.error(err);
      res.status(500).send();
    }
  });

// Define rubrics for a pack draft
router.post('/drafts/:packDraftId/rubrics',
  body('name').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const packDraftId = req.params.packDraftId;
      const rubric: Rubric = req.body;
      await db('rubrics').insert(rubric);
      res.status(201).json({ id: rubric.id });
    } catch (err) {
      console.error(err);
      res.status(500).send();
    }
  });

// Define benchmark seeds for a pack draft
router.post('/drafts/:packDraftId/benchmark_seeds',
  body('name').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const packDraftId = req.params.packDraftId;
      const benchmarkSeed: BenchmarkSeed = req.body;
      await db('benchmark_seeds').insert(benchmarkSeed);
      res.status(201).json({ id: benchmarkSeed.id });
    } catch (err) {
      console.error(err);
      res.status(500).send();
    }
  });

// Publish a new version of a pack draft
router.post('/drafts/:packDraftId/publish',
  body('version').isInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const packDraftId = req.params.packDraftId;
      await db('pack_drafts').update({ published: true, version: req.body.version })
        .where('id', packDraftId);
      res.status(204).send();
    } catch (err) {
      console.error(err);
      res.status(500).send();
    }
  });

export default router;
