// pzo_engine/src/persistence/ml-store.ts
// Density6 LLC · Point Zero One · Confidential
//
// SQLite-backed ML store for:
// - model weights (per ml_id+tier+ruleset_version)
// - observations (features+outputs)
// - feedback (labels) with applied flag
//
// Requires schema migration (provided below).

import type Database from 'better-sqlite3';
import { getDb } from './db';

export type MLModelRow = {
  ml_id: string;
  tier: string;
  ruleset_version: string;
  model_version: string;
  feature_schema_hash: string;
  weights_json: string;
  step: number;
  created_at: number;
  updated_at: number;
};

export type MLObservationRow = {
  ml_id: string;
  tier: string;
  run_id: string;
  tick_index: number;
  features_json: string;
  output_json: string;
  audit_hash: string;
  created_at: number;
};

export type MLFeedbackRow = {
  id: number;
  ml_id: string;
  tier: string;
  run_id: string;
  tick_index: number;
  label: 0 | 1;
  source: string;
  applied: 0 | 1;
  created_at: number;
  applied_at: number | null;
};

export class MLStore {
  private readonly db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db ?? getDb();
  }

  public getLatestModel(mlId: string, tier: string, rulesetVersion: string): MLModelRow | null {
    const row = this.db.prepare(
      `
      SELECT ml_id, tier, ruleset_version, model_version, feature_schema_hash, weights_json, step, created_at, updated_at
      FROM ml_models
      WHERE ml_id = ? AND tier = ? AND ruleset_version = ?
      LIMIT 1
      `,
    ).get(mlId, tier, rulesetVersion) as MLModelRow | undefined;

    return row ?? null;
  }

  public upsertModel(params: Omit<MLModelRow, 'created_at' | 'updated_at'>): MLModelRow {
    const now = Date.now();

    const existing = this.getLatestModel(params.ml_id, params.tier, params.ruleset_version);
    if (!existing) {
      this.db.prepare(
        `
        INSERT INTO ml_models
          (ml_id, tier, ruleset_version, model_version, feature_schema_hash, weights_json, step, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        params.ml_id,
        params.tier,
        params.ruleset_version,
        params.model_version,
        params.feature_schema_hash,
        params.weights_json,
        params.step,
        now,
        now,
      );

      const created = this.getLatestModel(params.ml_id, params.tier, params.ruleset_version);
      if (!created) throw new Error('[MLStore] insert succeeded but row not found');
      return created;
    }

    this.db.prepare(
      `
      UPDATE ml_models
      SET model_version = ?, feature_schema_hash = ?, weights_json = ?, step = ?, updated_at = ?
      WHERE ml_id = ? AND tier = ? AND ruleset_version = ?
      `,
    ).run(
      params.model_version,
      params.feature_schema_hash,
      params.weights_json,
      params.step,
      now,
      params.ml_id,
      params.tier,
      params.ruleset_version,
    );

    const updated = this.getLatestModel(params.ml_id, params.tier, params.ruleset_version);
    if (!updated) throw new Error('[MLStore] update succeeded but row not found');
    return updated;
  }

  public insertObservation(obs: MLObservationRow): void {
    this.db.prepare(
      `
      INSERT INTO ml_observations
        (ml_id, tier, run_id, tick_index, features_json, output_json, audit_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      obs.ml_id,
      obs.tier,
      obs.run_id,
      obs.tick_index,
      obs.features_json,
      obs.output_json,
      obs.audit_hash,
      obs.created_at,
    );
  }

  public enqueueFeedback(mlId: string, tier: string, runId: string, tickIndex: number, label: 0|1, source: string): void {
    const now = Date.now();
    this.db.prepare(
      `
      INSERT INTO ml_feedback
        (ml_id, tier, run_id, tick_index, label, source, applied, created_at, applied_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, NULL)
      `,
    ).run(mlId, tier, runId, tickIndex, label, source, now);
  }

  public fetchUnappliedFeedback(mlId: string, tier: string, limit: number): MLFeedbackRow[] {
    const rows = this.db.prepare(
      `
      SELECT id, ml_id, tier, run_id, tick_index, label, source, applied, created_at, applied_at
      FROM ml_feedback
      WHERE ml_id = ? AND tier = ? AND applied = 0
      ORDER BY id ASC
      LIMIT ?
      `,
    ).all(mlId, tier, limit) as MLFeedbackRow[];
    return rows ?? [];
  }

  public markFeedbackApplied(ids: readonly number[]): void {
    if (ids.length === 0) return;
    const now = Date.now();

    const stmt = this.db.prepare(
      `
      UPDATE ml_feedback
      SET applied = 1, applied_at = ?
      WHERE id = ?
      `,
    );

    const tx = this.db.transaction(() => {
      for (const id of ids) stmt.run(now, id);
    });

    tx();
  }
}