// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — ENGINE PERSISTENCE LAYER
// pzo_engine/src/persistence/run-store.ts
//
// Singleton persistence store for completed run records.
//
// REWRITTEN FROM SPRINT 0:
//   ✦ Dual persistence: SQLite (primary) + HTTP to pzo-server (secondary)
//   ✦ mode-aware leaderboard queries (filter by GameMode)
//   ✦ CORD leaderboard (separate ranking from sovereignty score)
//   ✦ isDemoRun: demo runs excluded from all live leaderboards by default
//   ✦ Tick stream + decisions written to normalized tables (not JSON blob)
//   ✦ Mode-specific stats written to run_mode_stats table
//   ✦ Viral moments written to run_viral_moments table
//   ✦ Season snapshot written to season_snapshots table
//   ✦ Leaderboard cache materialized after each save for O(1) lb reads
//   ✦ replayFromSeed updated: rulesetVersion + mode baked into proof replay
//
// PERSISTENCE PRIORITY:
//   1. SQLite write (synchronous, immediate, authoritative)
//   2. HTTP POST to pzo-server (fire-and-forget with retry queue)
//   3. In-memory cache (for sub-millisecond lookup without DB hit)
//
// Density6 LLC · Point Zero One · Persistence Layer · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import { getDb }                               from './db';
import { Run, createRunRecord, serializeRun, deserializeRunFromRow } from './run';
import { ProofHash }                           from './proof-hash';
import { AuditHash, buildAuditHashInput }      from './audit-hash';
import type {
  RunAccumulatorStats,
  RunIdentity,
  RunGrade,
  RunOutcome,
  IntegrityStatus,
  TickSnapshot,
  GameMode,
} from './types';
import { createHash }                          from 'node:crypto';

// =============================================================================
// SECTION 1 — CONFIG
// =============================================================================

interface RunStoreConfig {
  serverUrl:    string | undefined;
  serverApiKey: string | undefined;
  mlEnabled:    boolean;
  auditEnabled: boolean;
}

function resolveConfig(): RunStoreConfig {
  return {
    serverUrl:    process.env['PZO_SERVER_URL'],
    serverApiKey: process.env['PZO_SERVER_API_KEY'],
    mlEnabled:    process.env['PZO_ML_PROOF_HASH'] === 'true',
    auditEnabled: process.env['PZO_AUDIT_HASH']    === 'true',
  };
}

// =============================================================================
// SECTION 2 — RETRY QUEUE
// =============================================================================

interface RetryEntry {
  run:        Run;
  attempts:   number;
  lastTryAt:  number;
  nextTryAt:  number;
}

const MAX_RETRY_ATTEMPTS = 5;
const RETRY_BACKOFF_BASE = 2_000;

// =============================================================================
// SECTION 3 — LEADERBOARD OPTIONS
// =============================================================================

export interface LeaderboardOptions {
  limit?:         number;
  outcome?:       RunOutcome;
  minGrade?:      RunGrade;
  userId?:        string;
  mode?:          GameMode;
  /** Default: false — demo runs excluded */
  includeDemos?:  boolean;
  /** 'score' (sovereignty) | 'cord' — default: 'score' */
  rankBy?:        'score' | 'cord';
}

// =============================================================================
// SECTION 4 — HEALTH REPORT
// =============================================================================

export interface RunStoreHealth {
  totalRunsSaved:    number;
  totalRunsFailed:   number;
  retryQueueDepth:   number;
  serverConnected:   boolean;
  lastSaveAt:        number | null;
  lastFailureAt:     number | null;
  lastFailureReason: string | null;
  mlEnabled:         boolean;
  auditEnabled:      boolean;
  dbPath:            string;
}

// =============================================================================
// SECTION 5 — REPLAY RESULT
// =============================================================================

export interface ReplayResult {
  runId:              string;
  seed:               string;
  mode:               GameMode;
  rulesetVersion:     string;
  tickCount:          number;
  integrityMatch:     boolean;
  firstDivergenceAt:  number | null;
  replayedProofHash:  string;
  storedProofHash:    string;
  proofHashMatch:     boolean;
  isDemoRun:          boolean;
}

// =============================================================================
// SECTION 6 — RUN STORE CLASS
// =============================================================================

export class RunStore {
  /** In-memory cache for fast lookup without DB hit */
  private cache:       Map<string, Run> = new Map();
  private retryQueue:  RetryEntry[]     = [];
  private config:      RunStoreConfig;

  private totalSaved:        number = 0;
  private totalFailed:       number = 0;
  private lastSaveAt:        number | null = null;
  private lastFailureAt:     number | null = null;
  private lastFailureReason: string | null = null;
  private serverConnected:   boolean = false;
  private retryTimer:        ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.config = resolveConfig();
    this.startRetryLoop();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SAVE — primary entry point
  // ═══════════════════════════════════════════════════════════════════════════

  public async save(params: {
    accumulator: RunAccumulatorStats;
    identity:    RunIdentity;
  }): Promise<Run> {
    const { accumulator: acc, identity } = params;

    // ── Proof hash ──────────────────────────────────────────────────────────
    const proofHashGen = new ProofHash();
    await proofHashGen.generateProofHash(acc);
    const proofHash = proofHashGen.getHash();

    // ── Audit hash ──────────────────────────────────────────────────────────
    const auditHashGen = new AuditHash();
    if (this.config.auditEnabled) {
      auditHashGen.generateAuditHash(buildAuditHashInput({
        proofHash,
        acc,
        grade:           identity.score.grade,
        score:           identity.score.finalScore,
        integrityStatus: identity.integrityStatus,
      }));
    }
    const auditHash = auditHashGen.toStorableString();

    // ── Build immutable Run record ──────────────────────────────────────────
    const run = createRunRecord({ accumulator: acc, identity, proofHash, auditHash });

    // ── SQLite write (primary, synchronous) ─────────────────────────────────
    this.writeToDb(run);

    // ── In-memory cache ─────────────────────────────────────────────────────
    this.cache.set(run.id, run);
    this.totalSaved += 1;
    this.lastSaveAt  = Date.now();

    // ── HTTP persistence (non-blocking) ─────────────────────────────────────
    if (this.config.serverUrl) {
      this.persistToServer(run).catch(void 0);
    }

    return run;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SQLITE WRITE
  // ═══════════════════════════════════════════════════════════════════════════

  private writeToDb(run: Run): void {
    const db = getDb();

    db.transaction(() => {
      // ── Main runs row ──────────────────────────────────────────────────────
      db.prepare(`
        INSERT OR REPLACE INTO runs (
          id, user_id, mode, seed, ruleset_version, is_demo_run,
          outcome, grade, integrity_status, proof_hash, audit_hash,
          score, raw_score, outcome_multiplier, final_net_worth,
          ticks_survived, season_tick_budget,
          total_hater_attempts, hater_sabotages_blocked, hater_sabotages_count, max_hater_heat,
          total_cascade_chains, cascade_chains_break,
          final_market_regime, client_version, engine_version,
          xp_awarded, badge_tier_earned, can_export_proof,
          started_at, completed_at, duration_ms, saved_at,
          score_components_json, reward_json, cosmetics_unlocked_json,
          season_snapshot_json, intelligence_json, final_shield_layers_json
        ) VALUES (
          ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
        )
      `).run(
        run.id, run.userId, run.mode, run.seed, run.rulesetVersion, run.isDemoRun ? 1 : 0,
        run.outcome, run.grade, run.integrityStatus, run.proofHash, run.auditHash,
        run.score, run.rawScore, run.outcomeMultiplier, run.finalNetWorth,
        run.ticksSurvived, run.seasonTickBudget,
        run.totalHaterAttempts, run.haterSabotagesBlocked, run.haterSabotagesCount, run.maxHaterHeat,
        run.totalCascadeChains, run.cascadeChainsBreak,
        run.finalMarketRegime, run.clientVersion, run.engineVersion,
        run.reward.xpAwarded, run.reward.badgeTierEarned, run.reward.canExportProof ? 1 : 0,
        run.startedAt, run.completedAt, run.durationMs, run.savedAt,
        JSON.stringify(run.components),
        JSON.stringify(run.reward),
        JSON.stringify(run.reward.cosmeticsUnlocked),
        JSON.stringify(run.seasonSnapshot),
        JSON.stringify(run.intelligenceSnapshot),
        JSON.stringify(run.finalShieldLayers),
      );

      // ── Tick stream ────────────────────────────────────────────────────────
      const insertTick = db.prepare(`
        INSERT OR REPLACE INTO run_tick_stream (
          run_id, tick_index, tick_hash, pressure_score, shield_avg_integrity,
          net_worth, hater_heat, cascade_chains_active, tension_score, tick_tier
        ) VALUES (?,?,?,?,?,?,?,?,?,?)
      `);

      for (const t of run.tickSnapshots) {
        insertTick.run(
          run.id, t.tickIndex, t.tickHash, t.pressureScore, t.shieldAvgIntegrity,
          t.netWorth, t.haterHeat, t.cascadeChainsActive, t.tensionScore, t.tickTier,
        );
      }

      // ── Decision records ───────────────────────────────────────────────────
      const insertDecision = db.prepare(`
        INSERT INTO run_decisions (
          run_id, card_id, decision_window_ms, resolved_in_ms,
          was_auto_resolved, was_optimal_choice, speed_score
        ) VALUES (?,?,?,?,?,?,?)
      `);

      for (const d of run.decisionRecords) {
        insertDecision.run(
          run.id, d.cardId, d.decisionWindowMs, d.resolvedInMs,
          d.wasAutoResolved ? 1 : 0, d.wasOptimalChoice ? 1 : 0, d.speedScore,
        );
      }

      // ── Viral moments ──────────────────────────────────────────────────────
      if (run.viralMoments.length > 0) {
        const insertMoment = db.prepare(`
          INSERT INTO run_viral_moments (run_id, moment_type, tick, headline, cord_bonus)
          VALUES (?,?,?,?,?)
        `);
        for (const m of run.viralMoments) {
          insertMoment.run(run.id, m.type, m.tick, m.headline, m.cordBonus);
        }
      }

      // ── CORD score ─────────────────────────────────────────────────────────
      if (run.cordScore) {
        db.prepare(`
          INSERT OR REPLACE INTO run_cord_scores (
            run_id, user_id, mode, is_demo_run,
            raw_cord, mode_multiplier, final_cord, cord_grade, viral_bonus_total, computed_at
          ) VALUES (?,?,?,?,?,?,?,?,?,?)
        `).run(
          run.id, run.userId, run.mode, run.isDemoRun ? 1 : 0,
          run.cordScore.rawCORD, run.cordScore.modeMultiplier,
          run.cordScore.finalCORD, run.cordScore.cordGrade,
          run.cordScore.viralBonusTotal, run.cordScore.computedAt,
        );
      }

      // ── Mode-specific stats ────────────────────────────────────────────────
      db.prepare(`
        INSERT OR REPLACE INTO run_mode_stats (run_id, mode, stats_json)
        VALUES (?,?,?)
      `).run(run.id, run.mode, JSON.stringify(run.modeStats));

      // ── Season snapshot ────────────────────────────────────────────────────
      const snap = run.seasonSnapshot;
      db.prepare(`
        INSERT INTO season_snapshots (
          run_id, user_id, xp, pass_tier, dominion_control, win_streak,
          battle_pass_level, cord_accumulator, legend_beat_count, bleed_run_count,
          total_runs_completed, snapshot_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        run.id, run.userId, snap.xp, snap.passTier, snap.dominionControl,
        snap.winStreak, snap.battlePassLevel, snap.cordAccumulator,
        snap.legendBeatCount, snap.bleedRunCount, snap.totalRunsCompleted,
        run.completedAt,
      );

      // ── Leaderboard cache ──────────────────────────────────────────────────
      db.prepare(`
        INSERT OR REPLACE INTO leaderboard_cache (
          run_id, user_id, mode, outcome, grade, score, cord_final,
          ticks_survived, final_net_worth, completed_at, is_demo_run, integrity_ok
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        run.id, run.userId, run.mode, run.outcome, run.grade, run.score,
        run.cordScore?.finalCORD ?? 0,
        run.ticksSurvived, run.finalNetWorth, run.completedAt,
        run.isDemoRun ? 1 : 0,
        run.integrityStatus !== 'TAMPERED' ? 1 : 0,
      );
    })();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOOKUP
  // ═══════════════════════════════════════════════════════════════════════════

  public getById(id: string): Run | undefined {
    // Try memory cache first
    if (this.cache.has(id)) return this.cache.get(id);

    // Fall back to DB
    const row = getDb()
      .prepare('SELECT * FROM runs WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;

    if (!row) return undefined;

    // Reconstruct partial Run (no tick stream — load on demand)
    const partial = deserializeRunFromRow(row as Record<string, unknown>);
    // We return partial here — tick stream requires a separate query
    return partial as unknown as Run;
  }

  public getByProofHash(proofHash: string): Run | undefined {
    const base = proofHash.startsWith('DEMO:')
      ? proofHash.slice(5).split(':')[0]!
      : (proofHash.includes(':') ? proofHash.split(':')[0]! : proofHash);

    // Check cache
    for (const run of this.cache.values()) {
      const storedBase = run.proofHash.startsWith('DEMO:')
        ? run.proofHash.slice(5).split(':')[0]!
        : (run.proofHash.includes(':') ? run.proofHash.split(':')[0]! : run.proofHash);
      if (storedBase === base) return run;
    }

    // DB fallback (prefix match on base hash)
    const row = getDb()
      .prepare(`SELECT * FROM runs WHERE proof_hash LIKE ? OR proof_hash = ?`)
      .get(`%${base}%`, base) as Record<string, unknown> | undefined;

    return row ? (deserializeRunFromRow(row) as unknown as Run) : undefined;
  }

  public getByUserId(userId: string): Run[] {
    const rows = getDb()
      .prepare('SELECT * FROM runs WHERE user_id = ? ORDER BY completed_at DESC')
      .all(userId) as Record<string, unknown>[];
    return rows.map(r => deserializeRunFromRow(r) as unknown as Run);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LEADERBOARD
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Pull leaderboard from materialized leaderboard_cache.
   * O(1) indexed read — sub-millisecond at any scale.
   *
   * Tie-breaking (rankBy='score'):
   *   1. score DESC
   *   2. ticks_survived DESC
   *   3. final_net_worth DESC
   *   4. completed_at ASC
   *
   * Tie-breaking (rankBy='cord'):
   *   1. cord_final DESC
   *   2. score DESC
   *   3. ticks_survived DESC
   */
  public getLeaderboard(options: LeaderboardOptions = {}): Run[] {
    const {
      limit        = 10,
      outcome,
      minGrade,
      userId,
      mode,
      includeDemos = false,
      rankBy       = 'score',
    } = options;

    const GRADE_ORDER: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, F: 1 };
    const minGradeRank = minGrade ? (GRADE_ORDER[minGrade] ?? 0) : 0;

    const conditions: string[] = ['integrity_ok = 1'];
    const bindings:   unknown[] = [];

    if (!includeDemos) { conditions.push('is_demo_run = 0'); }
    if (outcome)        { conditions.push('outcome = ?');   bindings.push(outcome); }
    if (userId)         { conditions.push('user_id = ?');   bindings.push(userId); }
    if (mode)           { conditions.push('mode = ?');      bindings.push(mode); }
    if (minGrade) {
      // Map grade to minimum score threshold
      const minScore = Object.entries(GRADE_ORDER)
        .filter(([, rank]) => rank >= minGradeRank)
        .map(([g]) => `'${g}'`)
        .join(',');
      conditions.push(`grade IN (${minScore})`);
    }

    const orderBy = rankBy === 'cord'
      ? 'cord_final DESC, score DESC, ticks_survived DESC, completed_at ASC'
      : 'score DESC, ticks_survived DESC, final_net_worth DESC, completed_at ASC';

    const sql = `
      SELECT run_id FROM leaderboard_cache
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${orderBy}
      LIMIT ?
    `;

    bindings.push(limit);

    const rows = getDb().prepare(sql).all(...bindings) as { run_id: string }[];
    return rows
      .map(r => this.getById(r.run_id))
      .filter((r): r is Run => r !== undefined);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REPLAY FROM SEED
  // ═══════════════════════════════════════════════════════════════════════════

  public replayFromSeed(runId: string): ReplayResult | null {
    const run = this.getById(runId);
    if (!run) {
      console.warn(`[RunStore] replayFromSeed: run ${runId} not found.`);
      return null;
    }

    // Load tick stream from DB (not cached in partial runs)
    const dbTicks = getDb()
      .prepare('SELECT * FROM run_tick_stream WHERE run_id = ? ORDER BY tick_index ASC')
      .all(runId) as Record<string, unknown>[];

    const storedTicks: TickSnapshot[] = dbTicks.map(r => ({
      tickIndex:           r['tick_index'] as number,
      tickHash:            r['tick_hash'] as string,
      pressureScore:       r['pressure_score'] as number,
      shieldAvgIntegrity:  r['shield_avg_integrity'] as number,
      netWorth:            r['net_worth'] as number,
      haterHeat:           r['hater_heat'] as number,
      cascadeChainsActive: r['cascade_chains_active'] as number,
      tensionScore:        r['tension_score'] as number,
      tickTier:            r['tick_tier'] as string,
      decisionsThisTick:   [],
    }));

    const { seedBuffer } = this.initSeedState(run.seed);
    let firstDivergenceAt: number | null = null;
    const replayedHashes: string[] = [];

    for (const stored of storedTicks) {
      const replayedHash = this.recomputeTickHash(stored, seedBuffer);
      replayedHashes.push(replayedHash);
      if (replayedHash !== stored.tickHash && firstDivergenceAt === null) {
        firstDivergenceAt = stored.tickIndex;
      }
    }

    // Recompute proof hash from replayed tick stream
    const replayedStreamInput = replayedHashes.join('|');
    const replayedChecksum    = createHash('sha256')
      .update(replayedStreamInput, 'utf8').digest('hex');

    const replayedProofInput = [
      run.seed,
      replayedChecksum,
      run.outcome,
      run.finalNetWorth.toFixed(2),
      run.userId,
      run.rulesetVersion,
      run.mode,
    ].join('|');

    const replayedProofHash = createHash('sha256')
      .update(replayedProofInput, 'utf8').digest('hex');

    // Normalize stored proof hash for comparison
    const storedBase = run.proofHash.startsWith('DEMO:')
      ? run.proofHash.slice(5).split(':')[0]!
      : (run.proofHash.includes(':') ? run.proofHash.split(':')[0]! : run.proofHash);

    const proofHashMatch = replayedProofHash === storedBase;

    return {
      runId,
      seed:              run.seed,
      mode:              run.mode,
      rulesetVersion:    run.rulesetVersion,
      tickCount:         storedTicks.length,
      integrityMatch:    firstDivergenceAt === null,
      firstDivergenceAt,
      replayedProofHash,
      storedProofHash:   storedBase,
      proofHashMatch,
      isDemoRun:         run.isDemoRun,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SERVER HYDRATION + FETCH
  // ═══════════════════════════════════════════════════════════════════════════

  public async getByIdFromServer(id: string): Promise<Run | null> {
    if (!this.config.serverUrl) return null;
    try {
      const res = await fetch(`${this.config.serverUrl}/runs/${id}`, {
        headers: this.buildAuthHeaders(),
        signal:  AbortSignal.timeout(5_000),
      });
      if (!res.ok) return null;
      const data = await res.json() as Run;
      if (!this.cache.has(data.id)) this.cache.set(data.id, data);
      return data;
    } catch {
      return null;
    }
  }

  public async hydrateFromServer(limit = 200): Promise<void> {
    if (!this.config.serverUrl) return;
    try {
      const res = await fetch(
        `${this.config.serverUrl}/runs?limit=${limit}&sort=completedAt_desc`,
        { headers: this.buildAuthHeaders(), signal: AbortSignal.timeout(10_000) }
      );
      if (!res.ok) {
        console.warn(`[RunStore] Hydration failed: ${res.status}`);
        return;
      }
      const runs = await res.json() as Run[];
      let imported = 0;
      for (const run of runs) {
        if (!this.cache.has(run.id)) {
          this.cache.set(run.id, run);
          imported++;
        }
      }
      this.serverConnected = true;
      console.info(`[RunStore] Hydrated ${imported} runs from pzo-server.`);
    } catch (err) {
      console.warn('[RunStore] Hydration error:', err);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HEALTH
  // ═══════════════════════════════════════════════════════════════════════════

  public getHealth(): RunStoreHealth {
    return {
      totalRunsSaved:    this.totalSaved,
      totalRunsFailed:   this.totalFailed,
      retryQueueDepth:   this.retryQueue.length,
      serverConnected:   this.serverConnected,
      lastSaveAt:        this.lastSaveAt,
      lastFailureAt:     this.lastFailureAt,
      lastFailureReason: this.lastFailureReason,
      mlEnabled:         this.config.mlEnabled,
      auditEnabled:      this.config.auditEnabled,
      dbPath:            process.env['PZO_DB_PATH'] ?? 'pzo.db',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: HTTP PERSISTENCE
  // ═══════════════════════════════════════════════════════════════════════════

  private async persistToServer(run: Run): Promise<void> {
    if (!this.config.serverUrl) return;
    try {
      const res = await fetch(`${this.config.serverUrl}/runs/complete`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...this.buildAuthHeaders() },
        body:    JSON.stringify(serializeRun(run)),
        signal:  AbortSignal.timeout(8_000),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}: ${await res.text()}`);
      this.serverConnected = true;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error(`[RunStore] Failed to persist run ${run.id} to server:`, reason);
      this.serverConnected   = false;
      this.lastFailureAt     = Date.now();
      this.lastFailureReason = reason;
      this.totalFailed      += 1;
      this.retryQueue.push({
        run,
        attempts:  1,
        lastTryAt: Date.now(),
        nextTryAt: Date.now() + RETRY_BACKOFF_BASE,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: RETRY LOOP
  // ═══════════════════════════════════════════════════════════════════════════

  private startRetryLoop(): void {
    if (!this.config.serverUrl) return;
    this.retryTimer = setInterval(() => { this.flushRetryQueue().catch(void 0); }, 30_000);
    if (typeof this.retryTimer?.unref === 'function') this.retryTimer.unref();
  }

  private async flushRetryQueue(): Promise<void> {
    const now   = Date.now();
    const ready = this.retryQueue.filter(e => e.nextTryAt <= now);
    for (const entry of ready) {
      try {
        const res = await fetch(`${this.config.serverUrl}/runs/complete`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', ...this.buildAuthHeaders() },
          body:    JSON.stringify(serializeRun(entry.run)),
          signal:  AbortSignal.timeout(8_000),
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        this.retryQueue = this.retryQueue.filter(e => e !== entry);
        this.serverConnected = true;
        console.info(`[RunStore] Retry succeeded for run ${entry.run.id}.`);
      } catch {
        entry.attempts += 1;
        entry.lastTryAt = Date.now();
        if (entry.attempts >= MAX_RETRY_ATTEMPTS) {
          this.retryQueue = this.retryQueue.filter(e => e !== entry);
          console.error(`[RunStore] Permanent failure — run ${entry.run.id} after ${MAX_RETRY_ATTEMPTS} attempts.`);
        } else {
          entry.nextTryAt = Date.now() + RETRY_BACKOFF_BASE * Math.pow(2, entry.attempts - 1);
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: REPLAY HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private initSeedState(seed: string): { seedBuffer: Buffer } {
    const seedBuffer = Buffer.from(
      createHash('sha256').update(seed, 'utf8').digest('hex'),
      'hex'
    );
    return { seedBuffer };
  }

  private recomputeTickHash(tick: TickSnapshot, _seedBuffer: Buffer): string {
    const input = [
      String(tick.tickIndex),
      tick.pressureScore.toFixed(6),
      tick.shieldAvgIntegrity.toFixed(2),
      tick.netWorth.toFixed(2),
      tick.haterHeat.toFixed(4),
    ].join('|');

    // Post-run replay always uses SHA-256 truncated to 8 chars (matches CRC32 length)
    return createHash('sha256').update(input, 'utf8').digest('hex').slice(0, 8);
  }

  private buildAuthHeaders(): Record<string, string> {
    if (!this.config.serverApiKey) return {};
    return { 'Authorization': `Bearer ${this.config.serverApiKey}` };
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let _instance: RunStore | null = null;

/**
 * Get singleton RunStore.
 *
 * Usage:
 *   const store = getRunStore();
 *   await store.hydrateFromServer();
 *   const run = await store.save({ accumulator, identity });
 *   const top = store.getLeaderboard({ mode: 'GO_ALONE', rankBy: 'cord' });
 *   const replay = store.replayFromSeed(runId);
 */
export function getRunStore(): RunStore {
  if (!_instance) _instance = new RunStore();
  return _instance;
}

/** For testing only — resets singleton so tests get a fresh store. */
export function _resetRunStoreForTesting(): void {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('_resetRunStoreForTesting forbidden in production');
  }
  _instance = null;
}