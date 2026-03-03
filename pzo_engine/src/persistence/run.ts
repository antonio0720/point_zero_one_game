// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — ENGINE PERSISTENCE LAYER
// pzo_engine/src/persistence/run.ts
//
// The canonical Run record — complete, immutable record of a finished run.
// Written once by RunStore.save(). Never mutated.
//
// EXTENDED FROM SPRINT 0:
//   ✦ mode, rulesetVersion, isDemoRun
//   ✦ cordScore (full CORD record)
//   ✦ finalMarketRegime
//   ✦ finalShieldLayers (L1–L4)
//   ✦ maxHaterHeat
//   ✦ seasonSnapshot, intelligenceSnapshot
//   ✦ viralMoments
//   ✦ modeStats (mode-specific stat block)
//
// Density6 LLC · Point Zero One · Persistence Layer · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  RunOutcome,
  RunGrade,
  IntegrityStatus,
  GameMode,
  MarketRegime,
  SovereigntyScoreComponents,
  GradeReward,
  TickSnapshot,
  DecisionRecord,
  RunAccumulatorStats,
  RunIdentity,
  CORDScore,
  ShieldLayerSnapshot,
  SeasonStateSnapshot,
  IntelligenceSnapshot,
  ViralMomentRecord,
  ModeSpecificStats,
} from './types';

// =============================================================================
// RUN RECORD
// =============================================================================

export interface Run {
  // ── Primary identity ──────────────────────────────────────────────────────
  readonly id:              string;
  readonly proofHash:       string;
  readonly auditHash:       string;

  // ── Player + run identity ─────────────────────────────────────────────────
  readonly userId:          string;
  readonly seed:            string;
  readonly mode:            GameMode;
  readonly rulesetVersion:  string;
  readonly isDemoRun:       boolean;
  readonly clientVersion:   string;
  readonly engineVersion:   string;

  // ── Outcome ───────────────────────────────────────────────────────────────
  readonly outcome:         RunOutcome;
  readonly grade:           RunGrade;
  readonly integrityStatus: IntegrityStatus;

  // ── Sovereignty score ─────────────────────────────────────────────────────
  readonly score:               number;
  readonly rawScore:            number;
  readonly outcomeMultiplier:   number;
  readonly components:          SovereigntyScoreComponents;

  // ── CORD score ────────────────────────────────────────────────────────────
  readonly cordScore:           CORDScore | null;

  // ── Financial ─────────────────────────────────────────────────────────────
  readonly finalNetWorth:       number;

  // ── Timing ────────────────────────────────────────────────────────────────
  readonly ticksSurvived:       number;
  readonly seasonTickBudget:    number;
  readonly startedAt:           number;
  readonly completedAt:         number;
  readonly durationMs:          number;

  // ── Hater / battle stats ──────────────────────────────────────────────────
  readonly totalHaterAttempts:    number;
  readonly haterSabotagesBlocked: number;
  readonly haterSabotagesCount:   number;
  readonly maxHaterHeat:          number;

  // ── Cascade stats ─────────────────────────────────────────────────────────
  readonly totalCascadeChains: number;
  readonly cascadeChainsBreak: number;

  // ── Market ────────────────────────────────────────────────────────────────
  readonly finalMarketRegime:  MarketRegime;

  // ── Shield layers at run end ──────────────────────────────────────────────
  readonly finalShieldLayers:  ShieldLayerSnapshot[];

  // ── Season + Intelligence snapshots ──────────────────────────────────────
  readonly seasonSnapshot:      SeasonStateSnapshot;
  readonly intelligenceSnapshot: IntelligenceSnapshot;

  // ── Viral moments ─────────────────────────────────────────────────────────
  readonly viralMoments:        ViralMomentRecord[];

  // ── Mode-specific stats ───────────────────────────────────────────────────
  readonly modeStats:           ModeSpecificStats;

  // ── Reward ────────────────────────────────────────────────────────────────
  readonly reward:              GradeReward;

  // ── Audit trail ──────────────────────────────────────────────────────────
  readonly tickSnapshots:   TickSnapshot[];
  readonly decisionRecords: DecisionRecord[];

  // ── DB metadata ───────────────────────────────────────────────────────────
  readonly savedAt:         number;
}

// =============================================================================
// FACTORY — createRunRecord
// =============================================================================

export function createRunRecord(params: {
  accumulator: RunAccumulatorStats;
  identity:    RunIdentity;
  proofHash:   string;
  auditHash:   string;
}): Run {
  const { accumulator: acc, identity, proofHash, auditHash } = params;

  return Object.freeze({
    // ── Primary identity ─────────────────────────────────────────────
    id:              acc.runId,
    proofHash,
    auditHash,

    // ── Player + run identity ────────────────────────────────────────
    userId:          acc.userId,
    seed:            acc.seed,
    mode:            acc.mode,
    rulesetVersion:  acc.rulesetVersion,
    isDemoRun:       acc.isDemoRun,
    clientVersion:   acc.clientVersion,
    engineVersion:   acc.engineVersion,

    // ── Outcome ──────────────────────────────────────────────────────
    outcome:         acc.outcome,
    grade:           identity.score.grade,
    integrityStatus: identity.integrityStatus,

    // ── Sovereignty score ────────────────────────────────────────────
    score:             identity.score.finalScore,
    rawScore:          identity.score.rawScore,
    outcomeMultiplier: identity.score.outcomeMultiplier,
    components:        identity.score.components,

    // ── CORD score ───────────────────────────────────────────────────
    cordScore:         acc.cordScore,

    // ── Financial ────────────────────────────────────────────────────
    finalNetWorth:   acc.finalNetWorth,

    // ── Timing ───────────────────────────────────────────────────────
    ticksSurvived:    acc.ticksSurvived,
    seasonTickBudget: acc.seasonTickBudget,
    startedAt:        acc.startedAt,
    completedAt:      acc.completedAt,
    durationMs:       acc.completedAt - acc.startedAt,

    // ── Hater / battle stats ──────────────────────────────────────────
    totalHaterAttempts:    acc.totalHaterAttempts,
    haterSabotagesBlocked: acc.haterSabotagesBlocked,
    haterSabotagesCount:   acc.haterSabotagesCount,
    maxHaterHeat:          acc.maxHaterHeat,

    // ── Cascade stats ─────────────────────────────────────────────────
    totalCascadeChains: acc.totalCascadeChains,
    cascadeChainsBreak: acc.cascadeChainsBreak,

    // ── Market ───────────────────────────────────────────────────────
    finalMarketRegime:  acc.finalMarketRegime,

    // ── Shield layers ─────────────────────────────────────────────────
    finalShieldLayers:  acc.finalShieldLayers,

    // ── Season + Intelligence ─────────────────────────────────────────
    seasonSnapshot:       acc.seasonSnapshot,
    intelligenceSnapshot: acc.intelligenceSnapshot,

    // ── Viral moments ─────────────────────────────────────────────────
    viralMoments:        acc.viralMoments,

    // ── Mode-specific ─────────────────────────────────────────────────
    modeStats:           acc.modeStats,

    // ── Reward ────────────────────────────────────────────────────────
    reward:              identity.score.reward,

    // ── Audit trail ──────────────────────────────────────────────────
    tickSnapshots:   acc.tickSnapshots,
    decisionRecords: acc.decisionRecords,

    // ── DB metadata ──────────────────────────────────────────────────
    savedAt:         Date.now(),
  } satisfies Run);
}

// =============================================================================
// SERIALIZATION
// =============================================================================

/** Serialize a Run to a plain object for JSON transport to pzo-server. */
export function serializeRun(run: Run): Record<string, unknown> {
  return {
    id:                    run.id,
    proofHash:             run.proofHash,
    auditHash:             run.auditHash,
    userId:                run.userId,
    seed:                  run.seed,
    mode:                  run.mode,
    rulesetVersion:        run.rulesetVersion,
    isDemoRun:             run.isDemoRun,
    clientVersion:         run.clientVersion,
    engineVersion:         run.engineVersion,
    outcome:               run.outcome,
    grade:                 run.grade,
    integrityStatus:       run.integrityStatus,
    score:                 run.score,
    rawScore:              run.rawScore,
    outcomeMultiplier:     run.outcomeMultiplier,
    components:            run.components,
    cordScore:             run.cordScore,
    finalNetWorth:         run.finalNetWorth,
    ticksSurvived:         run.ticksSurvived,
    seasonTickBudget:      run.seasonTickBudget,
    startedAt:             run.startedAt,
    completedAt:           run.completedAt,
    durationMs:            run.durationMs,
    totalHaterAttempts:    run.totalHaterAttempts,
    haterSabotagesBlocked: run.haterSabotagesBlocked,
    haterSabotagesCount:   run.haterSabotagesCount,
    maxHaterHeat:          run.maxHaterHeat,
    totalCascadeChains:    run.totalCascadeChains,
    cascadeChainsBreak:    run.cascadeChainsBreak,
    finalMarketRegime:     run.finalMarketRegime,
    finalShieldLayers:     run.finalShieldLayers,
    seasonSnapshot:        run.seasonSnapshot,
    intelligenceSnapshot:  run.intelligenceSnapshot,
    viralMoments:          run.viralMoments,
    modeStats:             run.modeStats,
    reward:                run.reward,
    // tick stream — included for integrity verification on server
    tickSnapshots:         run.tickSnapshots,
    decisionRecords:       run.decisionRecords,
    savedAt:               run.savedAt,
  };
}

// =============================================================================
// DB ROW → Run DESERIALIZER
// Used by RunStore when reading back from SQLite.
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deserializeRunFromRow(row: Record<string, any>): Omit<Run, 'tickSnapshots' | 'decisionRecords'> {
  return {
    id:                    row['id'],
    proofHash:             row['proof_hash'],
    auditHash:             row['audit_hash'],
    userId:                row['user_id'],
    seed:                  row['seed'],
    mode:                  row['mode'],
    rulesetVersion:        row['ruleset_version'] ?? '2024.12.1',
    isDemoRun:             Boolean(row['is_demo_run']),
    clientVersion:         row['client_version'] ?? '',
    engineVersion:         row['engine_version'] ?? '',
    outcome:               row['outcome'],
    grade:                 row['grade'],
    integrityStatus:       row['integrity_status'],
    score:                 row['score'],
    rawScore:              row['raw_score'],
    outcomeMultiplier:     row['outcome_multiplier'],
    components:            JSON.parse(row['score_components_json'] ?? '{}'),
    cordScore:             row['cord_score_json'] ? JSON.parse(row['cord_score_json']) : null,
    finalNetWorth:         row['final_net_worth'],
    ticksSurvived:         row['ticks_survived'],
    seasonTickBudget:      row['season_tick_budget'],
    startedAt:             row['started_at'],
    completedAt:           row['completed_at'],
    durationMs:            row['duration_ms'],
    totalHaterAttempts:    row['total_hater_attempts'],
    haterSabotagesBlocked: row['hater_sabotages_blocked'],
    haterSabotagesCount:   row['hater_sabotages_count'],
    maxHaterHeat:          row['max_hater_heat'],
    totalCascadeChains:    row['total_cascade_chains'],
    cascadeChainsBreak:    row['cascade_chains_break'],
    finalMarketRegime:     row['final_market_regime'] ?? 'Stable',
    finalShieldLayers:     JSON.parse(row['final_shield_layers_json'] ?? '[]'),
    seasonSnapshot:        JSON.parse(row['season_snapshot_json'] ?? '{}'),
    intelligenceSnapshot:  JSON.parse(row['intelligence_json'] ?? '{}'),
    viralMoments:          [],    // loaded separately if needed
    modeStats:             {},    // loaded from run_mode_stats if needed
    reward:                JSON.parse(row['reward_json'] ?? '{}'),
    savedAt:               row['saved_at'],
  };
}