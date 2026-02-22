/**
 * Retention Attribution Service for Point Zero One Digital's financial roguelike game.
 * This service attributes retention and quality of life improvements to micro-patches using cohorts and holdbacks in a privacy-safe manner.
 */

declare module '*.json';
import { Request, Response } from 'express';
import { Pool } from 'pg';

// Configuration
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
});

// Types
type Cohort = {
  cohortId: number;
  patchIds: number[];
};

type Holdback = {
  holdbackId: number;
  cohortId: number;
  patchId: number;
};

type RetentionData = {
  cohortId: number;
  retentionRate: number;
};

/**
 * Query functions for database interactions.
 */
const queryCohorts = (callback: (err: Error, result: Cohort[]) => void) => {
  pool.query('SELECT cohort_id, array_agg(patch_id) AS patch_ids FROM cohorts GROUP BY cohort_id', (err, res) => {
    if (err) return callback(err);
    const cohorts: Cohort[] = res.rows.map((row) => ({ cohortId: row.cohort_id, patchIds: row.patch_ids }));
    callback(null, cohorts);
  });
};

const queryHoldbacks = (callback: (err: Error, result: Holdback[]) => void) => {
  pool.query('SELECT holdback_id, cohort_id, patch_id FROM holdbacks', (err, res) => {
    if (err) return callback(err);
    const holdbacks: Holdback[] = res.rows.map((row) => ({ holdbackId: row.holdback_id, cohortId: row.cohort_id, patchId: row.patch_id }));
    callback(null, holdbacks);
  });
};

const queryRetentionData = (callback: (err: Error, result: RetentionData[]) => void) => {
  pool.query('SELECT cohort_id, (COUNT(*) FILTER (WHERE days_played > 7)::float / COUNT(*)) AS retention_rate FROM users GROUP BY cohort_id', (err, res) => {
    if (err) return callback(err);
    const retentionData: RetentionData[] = res.rows.map((row) => ({ cohortId: row.cohort_id, retentionRate: row.retention_rate }));
    callback(null, retentionData);
  });
};

/**
 * API endpoint to attribute retention and quality of life improvements to micro-patches.
 */
export const attributeRetention = (req: Request, res: Response) => {
  queryCohorts((err, cohorts) => {
    if (err) return res.status(500).json({ error: err.message });

    queryHoldbacks((err, holdbacks) => {
      if (err) return res.status(500).json({ error: err.message });

      const newCohorts = cohorts.map((cohort) => ({ ...cohort, patchIds: cohort.patchIds.filter((patchId) => !holdbacks.some((holdback) => holdback.patchId === patchId)) }));

      pool.query('INSERT INTO cohorts (cohort_id, array_agg(patch_id) AS patch_ids) VALUES ($1, $2)', [...newCohorts.map((cohort) => [cohort.cohortId, cohort.patchIds]),], (err, res) => {
        if (err) return res.status(500).json({ error: err.message });

        queryRetentionData((err, retentionData) => {
          if (err) return res.status(500).json({ error: err.message });

          res.json(retentionData);
        });
      });
    });
  });
};
