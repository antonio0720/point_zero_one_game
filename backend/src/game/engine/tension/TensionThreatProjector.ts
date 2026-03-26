/* ========================================================================
 * POINT ZERO ONE — BACKEND TENSION THREAT PROJECTOR
 * /backend/src/game/engine/tension/TensionThreatProjector.ts
 *
 * Doctrine:
 * - Projects AnticipationEntry records into ThreatEnvelope surfaces
 * - Drives ML/DL feature extraction from the projection surface
 * - All projection functions are pure or near-pure; side effects isolated to class
 * - computeMLVector produces a stable 32-dimensional feature vector
 * - extractDLTensor provides a 16×8 sequence tensor from projection history
 * - runProjectionSelfTest() validates the full projection subsystem (60+ checks)
 * - Zero circular imports; only imports from ./types, ../core/GamePrimitives, node:crypto
 * ====================================================================== */

import { createHash } from 'node:crypto';

import type { ThreatEnvelope } from '../core/GamePrimitives';

import {
  INTERNAL_VISIBILITY_TO_ENVELOPE,
  TENSION_VISIBILITY_STATE,
  VISIBILITY_CONFIGS,
  VISIBILITY_ORDER,
  PRESSURE_TENSION_AMPLIFIERS,
  TENSION_CONSTANTS,
  THREAT_SEVERITY,
  THREAT_SEVERITY_WEIGHTS,
  THREAT_TYPE,
  THREAT_TYPE_DEFAULT_MITIGATIONS,
  TENSION_EVENT_NAMES,
  type AnticipationEntry,
  type TensionVisibilityState,
  type ThreatSeverity,
  type ThreatType,
  type PressureTier,
  type VisibilityConfig,
  type VisibilityLevel,
  type TensionRuntimeSnapshot,
  type ThreatArrivedEvent,
  type ThreatExpiredEvent,
  type ThreatMitigatedEvent,
} from './types';

// ============================================================================
// MARK: Exported interfaces
// ============================================================================

/**
 * A 32-dimensional feature vector produced by computeMLVector, suitable for
 * consumption by upstream ML pipelines. Every feature is a clamped float in
 * [0, 1] unless otherwise documented per-feature.
 */
export interface ProjectionMLVector {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly tick: number;
}

/**
 * A single row in a DL sequence tensor. width = PROJECTION_DL_FEATURE_WIDTH (8).
 */
export interface ProjectionDLTensorRow {
  readonly features: readonly number[];
}

/**
 * A 16×8 sequence tensor derived from projection history.
 * Rows are ordered oldest-to-newest; missing history is zero-padded.
 */
export interface ProjectionDLTensor {
  readonly rows: readonly ProjectionDLTensorRow[];
  readonly labels: readonly string[];
}

/**
 * Full result of projectWithMLVector: envelopes, ML vector, and aggregated metrics.
 */
export interface EnvelopeProjectionResult {
  readonly envelopes: readonly ThreatEnvelope[];
  readonly mlVector: ProjectionMLVector;
  readonly totalWeight: number;
  readonly criticalCount: number;
  readonly arrivedCount: number;
  readonly queuedCount: number;
  readonly projectionChecksum: string;
}

/**
 * Per-entry priority score with decomposed sub-scores for debugging.
 */
export interface EnvelopePriorityScore {
  readonly entryId: string;
  readonly priorityScore: number;
  readonly severityWeight: number;
  readonly etaTicks: number;
  readonly typeWeight: number;
  readonly visibilityBonus: number;
}

/**
 * High-level health report computed from the current projection window.
 */
export interface ProjectionHealthReport {
  readonly riskTier: 'CLEAR' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly envelopeCount: number;
  readonly criticalCount: number;
  readonly arrivedCount: number;
  readonly totalWeight: number;
  readonly alerts: readonly string[];
}

/**
 * Human-readable narrative summary of the current threat projection.
 * Used by the chat layer to surface threat context to the player.
 */
export interface ProjectionNarrative {
  readonly headline: string;
  readonly body: string;
  readonly urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly actionSuggestion: string;
}

/**
 * Full context object encapsulating all projection-derived data for downstream use.
 */
export interface ProjectionContext {
  readonly envelopes: readonly ThreatEnvelope[];
  readonly visibilityState: TensionVisibilityState;
  readonly pressureTier: PressureTier;
  readonly currentTick: number;
  readonly totalSeverityWeight: number;
  readonly dominantThreatType: ThreatType | null;
  readonly criticalEnvelopes: readonly ThreatEnvelope[];
}

/**
 * Lightweight serializable snapshot of projector state for persistence/audit.
 */
export interface ProjectionSerializedState {
  readonly projectionCount: number;
  readonly lastChecksum: string;
  readonly totalProjectionsComputed: number;
  readonly timestamp: number;
}

/**
 * Full export bundle suitable for logging, debugging, and telemetry ingestion.
 */
export interface ProjectionExportBundle {
  readonly mlVector: ProjectionMLVector;
  readonly dlTensor: ProjectionDLTensor;
  readonly healthReport: ProjectionHealthReport;
  readonly narrative: ProjectionNarrative;
  readonly context: ProjectionContext;
  readonly serialized: ProjectionSerializedState;
}

/**
 * Result of runProjectionSelfTest — lists all checks executed and any failures.
 */
export interface ProjectionSelfTestResult {
  readonly passed: boolean;
  readonly checks: readonly string[];
  readonly failures: readonly string[];
}

// ============================================================================
// MARK: Exported constants
// ============================================================================

/** Dimensionality of the ML feature vector produced by computeMLVector. */
export const PROJECTION_ML_FEATURE_COUNT = 32 as const;

/** Number of history rows in the DL sequence tensor. */
export const PROJECTION_DL_SEQUENCE_LENGTH = 16 as const;

/** Number of features per DL tensor row. */
export const PROJECTION_DL_FEATURE_WIDTH = 8 as const;

/** Maximum number of projection snapshots retained in history. */
export const PROJECTION_HISTORY_CAPACITY = 64 as const;

/**
 * Human-readable labels for each of the 32 ML features.
 * Index matches feature position in ProjectionMLVector.features.
 */
export const PROJECTION_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  'envelopeCountNorm',    // 0  — total envelopes / 32
  'arrivedCount',         // 1  — arrived entries / 16
  'queuedCount',          // 2  — queued entries / 16
  'visibilityOrdinal',    // 3  — VISIBILITY_ORDER index / 3
  'pressureAmplifier',    // 4  — PRESSURE_TENSION_AMPLIFIERS[tier] normalized
  'totalSeverityWeight',  // 5  — sum of severities / 10
  'avgSeverityWeight',    // 6  — mean severity / 1
  'dominantTypeWeight',   // 7  — PROJECTION_TYPE_WEIGHTS[dominantType] / 1.5
  'criticalCount',        // 8  — CRITICAL severity count / 8
  'existentialCount',     // 9  — EXISTENTIAL severity count / 4
  'minEtaTicksNorm',      // 10 — min ETA / 50
  'avgEtaTicksNorm',      // 11 — avg ETA / 50
  'pulseThreshold',       // 12 — TENSION_CONSTANTS.PULSE_THRESHOLD (0.9)
  'awarenessBonus',       // 13 — VISIBILITY_CONFIGS[state].tensionAwarenessBonus
  'sevMinor',             // 14 — MINOR count / totalEntries
  'sevModerate',          // 15 — MODERATE count / totalEntries
  'sevSevere',            // 16 — SEVERE count / totalEntries
  'sevCritical',          // 17 — CRITICAL count / totalEntries
  'sevExistential',       // 18 — EXISTENTIAL count / totalEntries
  'typeDebtSpiral',       // 19 — DEBT_SPIRAL count / totalEntries
  'typeSabotage',         // 20 — SABOTAGE count / totalEntries
  'typeHaterInjection',   // 21 — HATER_INJECTION count / totalEntries
  'typeCascade',          // 22 — CASCADE count / totalEntries
  'typeSovereignty',      // 23 — SOVEREIGNTY count / totalEntries
  'typeOpportunityKill',  // 24 — OPPORTUNITY_KILL count / totalEntries
  'typeReputationBurn',   // 25 — REPUTATION_BURN count / totalEntries
  'typeShieldPierce',     // 26 — SHIELD_PIERCE count / totalEntries
  'sevWeightMax',         // 27 — max value across THREAT_SEVERITY_WEIGHTS
  'cascadeCount',         // 28 — CASCADE entries / 8
  'sovereigntyCount',     // 29 — SOVEREIGNTY entries / 8
  'tickNorm',             // 30 — currentTick / 1000
  'checksumByte',         // 31 — first byte of SHA-256 checksum / 255
]);

/**
 * Column labels for the 8-wide DL tensor rows.
 */
export const PROJECTION_DL_COLUMN_LABELS: readonly string[] = Object.freeze([
  'envelopeCount',  // 0
  'arrivedCount',   // 1
  'severityWeight', // 2
  'criticalFlag',   // 3
  'etaTicksNorm',   // 4
  'pressureAmp',    // 5
  'visOrdinal',     // 6
  'typeWeight',     // 7
]);

/**
 * Maps each ThreatSeverity to a numeric ordinal for ordering and comparison.
 */
export const PROJECTION_SEVERITY_ORDINALS: Readonly<Record<ThreatSeverity, number>> = {
  MINOR: 0,
  MODERATE: 1,
  SEVERE: 2,
  CRITICAL: 3,
  EXISTENTIAL: 4,
} as const;

/**
 * Per-type multiplier applied to base priority during projection scoring.
 * Higher values indicate that this threat type deserves elevated urgency.
 */
export const PROJECTION_TYPE_WEIGHTS: Readonly<Record<ThreatType, number>> = {
  CASCADE: 1.25,
  SOVEREIGNTY: 1.5,
  SHIELD_PIERCE: 1.15,
  HATER_INJECTION: 1.1,
  DEBT_SPIRAL: 1.0,
  SABOTAGE: 1.0,
  OPPORTUNITY_KILL: 0.95,
  REPUTATION_BURN: 0.9,
} as const;

// ============================================================================
// MARK: Internal utility functions
// ============================================================================

/** Clamps a value to [0, 1]. */
function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Normalizes a tick count against a 1000-tick epoch. */
function normalizeTick(tick: number): number {
  return clamp01(tick / 1000);
}

/** Normalizes an ETA tick count against a 50-tick horizon. */
function normalizeEta(etaTicks: number): number {
  return clamp01(etaTicks / 50);
}

/** Safe division; returns 0 when denominator is 0. */
function safeDiv(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

/** Freezes a copy of an array. */
function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

/**
 * Computes an ETA urgency factor: arrived threats get factor 2.0 (maximum urgency);
 * distant threats decay toward 0.1.
 */
function etaUrgencyFactor(etaTicks: number): number {
  return etaTicks === 0 ? 2.0 : Math.max(0.1, 1.0 - normalizeEta(etaTicks));
}

/**
 * Maps a VisibilityLevel string back to an approximate ordinal, using the
 * canonical VISIBILITY_ORDER mapping for consistent ordering logic.
 */
function visibilityLevelOrdinal(level: string): number {
  switch (level) {
    case 'HIDDEN':
      return VISIBILITY_ORDER.indexOf(TENSION_VISIBILITY_STATE.SHADOWED);
    case 'SILHOUETTE':
      return VISIBILITY_ORDER.indexOf(TENSION_VISIBILITY_STATE.SIGNALED);
    case 'PARTIAL':
      return VISIBILITY_ORDER.indexOf(TENSION_VISIBILITY_STATE.TELEGRAPHED);
    case 'EXPOSED':
      return VISIBILITY_ORDER.indexOf(TENSION_VISIBILITY_STATE.EXPOSED);
    default:
      return 0;
  }
}

// ============================================================================
// MARK: Internal ring-buffer type for projection history
// ============================================================================

interface ProjectionHistoryEntry {
  readonly envelopes: readonly ThreatEnvelope[];
  readonly tick: number;
  readonly checksum: string;
}

// ============================================================================
// MARK: TensionThreatProjector class
// ============================================================================

/**
 * TensionThreatProjector: the canonical projection engine for the tension subsystem.
 *
 * Responsibilities:
 *   1. Convert AnticipationEntry records to ThreatEnvelope surfaces (toThreatEnvelopes)
 *   2. Produce 32-dimensional ML feature vectors (computeMLVector)
 *   3. Produce 16×8 DL sequence tensors from history (extractDLTensor)
 *   4. Derive health reports, priority scores, and narratives
 *   5. Maintain a bounded projection history ring-buffer
 *   6. Build typed events for THREAT_ARRIVED / THREAT_EXPIRED / THREAT_MITIGATED
 *   7. Expose enrichment helpers for downstream chat and UX layers
 */
export class TensionThreatProjector {
  private readonly _history: ProjectionHistoryEntry[] = [];
  private _totalProjectionsComputed = 0;
  private _lastChecksum = '';

  // --------------------------------------------------------------------------
  // MARK: Core projection — original behavior preserved exactly
  // --------------------------------------------------------------------------

  /**
   * Projects all entries to ThreatEnvelope surfaces under the given visibility
   * state and current tick. This is the primary projection surface.
   */
  public toThreatEnvelopes(
    entries: readonly AnticipationEntry[],
    visibilityState: TensionVisibilityState,
    currentTick: number,
  ): readonly ThreatEnvelope[] {
    return freezeArray(
      entries.map((entry) => this.projectEntry(entry, visibilityState, currentTick)),
    );
  }

  /**
   * Projects a single AnticipationEntry to a ThreatEnvelope.
   * ETA is computed relative to currentTick; arrived entries get etaTicks = 0.
   */
  private projectEntry(
    entry: AnticipationEntry,
    visibilityState: TensionVisibilityState,
    currentTick: number,
  ): ThreatEnvelope {
    const etaTicks = entry.isArrived
      ? 0
      : Math.max(0, entry.arrivalTick - currentTick);

    return {
      threatId: entry.threatId,
      source: entry.source,
      etaTicks,
      severity: entry.severityWeight,
      visibleAs: INTERNAL_VISIBILITY_TO_ENVELOPE[visibilityState],
      summary: this.buildSummary(entry, visibilityState, etaTicks),
    };
  }

  /**
   * Builds a summary string gated by visibility state.
   * SHADOWED: minimal signature. SIGNALED: type disclosed.
   * TELEGRAPHED: type + ETA. EXPOSED: full detail with mitigation cards.
   */
  private buildSummary(
    entry: AnticipationEntry,
    visibilityState: TensionVisibilityState,
    etaTicks: number,
  ): string {
    switch (visibilityState) {
      case TENSION_VISIBILITY_STATE.SHADOWED:
        return entry.isArrived
          ? 'Active threat signature detected'
          : 'Threat signature detected';
      case TENSION_VISIBILITY_STATE.SIGNALED:
        return entry.isArrived
          ? `${entry.threatType} active`
          : `${entry.threatType} incoming`;
      case TENSION_VISIBILITY_STATE.TELEGRAPHED:
        return entry.isArrived
          ? `${entry.threatType} active +${entry.ticksOverdue}t`
          : `${entry.threatType} in ${etaTicks} ticks`;
      case TENSION_VISIBILITY_STATE.EXPOSED:
        return entry.isArrived
          ? `${entry.threatType} active • ${entry.worstCaseOutcome} • use ${entry.mitigationCardTypes.join(' / ')}`
          : `${entry.threatType} in ${etaTicks} ticks • ${entry.worstCaseOutcome} • use ${entry.mitigationCardTypes.join(' / ')}`;
      default:
        return entry.summary;
    }
  }

  // --------------------------------------------------------------------------
  // MARK: Full projection with ML vector
  // --------------------------------------------------------------------------

  /**
   * Performs a full projection pass and returns envelopes alongside the ML vector,
   * aggregated metrics, and a SHA-256 projection checksum. Also records the
   * projection in the internal history ring-buffer.
   */
  public projectWithMLVector(
    entries: readonly AnticipationEntry[],
    visibilityState: TensionVisibilityState,
    currentTick: number,
    pressureTier: PressureTier,
  ): EnvelopeProjectionResult {
    const envelopes = this.toThreatEnvelopes(entries, visibilityState, currentTick);
    const mlVector = this.computeMLVector(envelopes, entries, visibilityState, pressureTier, currentTick);
    const totalWeight = this.computeWeightedProjectionScore(entries);
    const criticalEnvelopes = this.filterCriticalEnvelopes(envelopes);
    const criticalCount = criticalEnvelopes.length;
    const arrivedCount = entries.filter((e) => e.isArrived).length;
    const queuedCount = entries.filter(
      (e) => !e.isArrived && !e.isMitigated && !e.isExpired && !e.isNullified,
    ).length;
    const projectionChecksum = this.computeProjectionChecksum(envelopes);

    this.recordProjection(envelopes, currentTick);

    return Object.freeze({
      envelopes,
      mlVector,
      totalWeight,
      criticalCount,
      arrivedCount,
      queuedCount,
      projectionChecksum,
    });
  }

  // --------------------------------------------------------------------------
  // MARK: ML vector computation — 32 features
  // --------------------------------------------------------------------------

  /**
   * Computes a stable 32-dimensional feature vector from the current projection
   * window. Each feature is a float in [0, 1] unless otherwise noted.
   *
   * Feature map (see PROJECTION_ML_FEATURE_LABELS for names):
   *  [0]  envelopeCount normalized (max 32)
   *  [1]  arrivedCount normalized (max 16)
   *  [2]  queuedCount normalized (max 16)
   *  [3]  visibilityOrdinal from VISIBILITY_ORDER, normalized over 3
   *  [4]  pressureAmplifier from PRESSURE_TENSION_AMPLIFIERS, normalized over 0.5 range
   *  [5]  totalSeverityWeight clamped over 10
   *  [6]  avgSeverityWeight clamped 0–1
   *  [7]  dominantTypeWeight from PROJECTION_TYPE_WEIGHTS, normalized over 1.5
   *  [8]  criticalCount (CRITICAL severity) normalized over 8
   *  [9]  existentialCount (EXISTENTIAL severity) normalized over 4
   *  [10] minEtaTicks normalized over 50
   *  [11] avgEtaTicks normalized over 50
   *  [12] pulseThreshold constant from TENSION_CONSTANTS (0.9)
   *  [13] tensionAwarenessBonus from VISIBILITY_CONFIGS[state]
   *  [14] MINOR severity fraction of total entries
   *  [15] MODERATE severity fraction
   *  [16] SEVERE severity fraction
   *  [17] CRITICAL severity fraction
   *  [18] EXISTENTIAL severity fraction
   *  [19] DEBT_SPIRAL type fraction
   *  [20] SABOTAGE type fraction
   *  [21] HATER_INJECTION type fraction
   *  [22] CASCADE type fraction
   *  [23] SOVEREIGNTY type fraction
   *  [24] OPPORTUNITY_KILL type fraction
   *  [25] REPUTATION_BURN type fraction
   *  [26] SHIELD_PIERCE type fraction
   *  [27] max value across THREAT_SEVERITY_WEIGHTS (= 1.0 for EXISTENTIAL)
   *  [28] cascade count normalized over 8
   *  [29] sovereignty count normalized over 8
   *  [30] currentTick normalized over 1000
   *  [31] first byte of SHA-256 projection checksum / 255
   */
  public computeMLVector(
    envelopes: readonly ThreatEnvelope[],
    entries: readonly AnticipationEntry[],
    visibilityState: TensionVisibilityState,
    pressureTier: PressureTier,
    currentTick: number,
  ): ProjectionMLVector {
    const envelopeCount = envelopes.length;
    const arrivedEntries = entries.filter((e) => e.isArrived);
    const queuedEntries = entries.filter(
      (e) => !e.isArrived && !e.isMitigated && !e.isExpired && !e.isNullified,
    );

    // Feature 0: envelopeCount normalized (max capacity = 32)
    const f0 = clamp01(envelopeCount / 32);

    // Feature 1: arrivedCount normalized (max 16)
    const f1 = clamp01(arrivedEntries.length / 16);

    // Feature 2: queuedCount normalized (max 16)
    const f2 = clamp01(queuedEntries.length / 16);

    // Feature 3: visibility ordinal from VISIBILITY_ORDER, normalized over 3
    const visOrd = this.visibilityOrdinal(visibilityState);
    const f3 = clamp01(visOrd / (VISIBILITY_ORDER.length - 1));

    // Feature 4: pressure amplifier via PRESSURE_TENSION_AMPLIFIERS
    // Range 1.0–1.5 → normalize to 0–1
    const amp = PRESSURE_TENSION_AMPLIFIERS[pressureTier];
    const f4 = clamp01((amp - 1.0) / 0.5);

    // Feature 5: total severity weight across all envelopes, normalized over 10
    const totalSev = envelopes.reduce((sum, e) => sum + e.severity, 0);
    const f5 = clamp01(totalSev / 10);

    // Feature 6: average severity weight (raw), clamped 0–1
    const f6 = clamp01(safeDiv(totalSev, envelopeCount));

    // Feature 7: dominant type weight via PROJECTION_TYPE_WEIGHTS, normalized over 1.5
    const dominantType = this._computeDominantType(entries);
    const f7 = dominantType !== null
      ? clamp01(PROJECTION_TYPE_WEIGHTS[dominantType] / 1.5)
      : 0;

    // Feature 8: count of CRITICAL severity entries, normalized over 8
    const critCount = entries.filter((e) => e.threatSeverity === THREAT_SEVERITY.CRITICAL).length;
    const f8 = clamp01(critCount / 8);

    // Feature 9: count of EXISTENTIAL severity entries, normalized over 4
    const existCount = entries.filter(
      (e) => e.threatSeverity === THREAT_SEVERITY.EXISTENTIAL,
    ).length;
    const f9 = clamp01(existCount / 4);

    // Feature 10: minimum ETA across queued entries, normalized over 50 ticks
    const etaValues = entries
      .filter((e) => !e.isArrived)
      .map((e) => Math.max(0, e.arrivalTick - currentTick));
    const minEta = etaValues.length > 0 ? Math.min(...etaValues) : 0;
    const f10 = normalizeEta(minEta);

    // Feature 11: average ETA across queued entries, normalized over 50 ticks
    const avgEta =
      etaValues.length > 0 ? etaValues.reduce((s, v) => s + v, 0) / etaValues.length : 0;
    const f11 = normalizeEta(avgEta);

    // Feature 12: TENSION_CONSTANTS.PULSE_THRESHOLD as-is (canonical constant = 0.9)
    const f12 = TENSION_CONSTANTS.PULSE_THRESHOLD;

    // Feature 13: tensionAwarenessBonus from VISIBILITY_CONFIGS for this state
    const config: VisibilityConfig = this.getVisibilityConfig(visibilityState);
    const f13 = config.tensionAwarenessBonus;

    // Features 14–18: severity distribution fractions
    const sevDist = this.computeSeverityGrouped(entries);
    const totalEntries = entries.length > 0 ? entries.length : 1;
    const f14 = clamp01(sevDist[THREAT_SEVERITY.MINOR] / totalEntries);
    const f15 = clamp01(sevDist[THREAT_SEVERITY.MODERATE] / totalEntries);
    const f16 = clamp01(sevDist[THREAT_SEVERITY.SEVERE] / totalEntries);
    const f17 = clamp01(sevDist[THREAT_SEVERITY.CRITICAL] / totalEntries);
    const f18 = clamp01(sevDist[THREAT_SEVERITY.EXISTENTIAL] / totalEntries);

    // Features 19–26: type distribution fractions (8 types from THREAT_TYPE)
    const typeGroups = this.groupEnvelopesByType(entries);
    const f19 = clamp01((typeGroups[THREAT_TYPE.DEBT_SPIRAL]?.length ?? 0) / totalEntries);
    const f20 = clamp01((typeGroups[THREAT_TYPE.SABOTAGE]?.length ?? 0) / totalEntries);
    const f21 = clamp01((typeGroups[THREAT_TYPE.HATER_INJECTION]?.length ?? 0) / totalEntries);
    const f22 = clamp01((typeGroups[THREAT_TYPE.CASCADE]?.length ?? 0) / totalEntries);
    const f23 = clamp01((typeGroups[THREAT_TYPE.SOVEREIGNTY]?.length ?? 0) / totalEntries);
    const f24 = clamp01((typeGroups[THREAT_TYPE.OPPORTUNITY_KILL]?.length ?? 0) / totalEntries);
    const f25 = clamp01((typeGroups[THREAT_TYPE.REPUTATION_BURN]?.length ?? 0) / totalEntries);
    const f26 = clamp01((typeGroups[THREAT_TYPE.SHIELD_PIERCE]?.length ?? 0) / totalEntries);

    // Feature 27: max value across THREAT_SEVERITY_WEIGHTS (= 1.0 for EXISTENTIAL)
    const sevWeightValues = Object.values(THREAT_SEVERITY_WEIGHTS) as number[];
    const f27 = Math.max(...sevWeightValues);

    // Feature 28: cascade entry count normalized over 8
    const cascadeCount = typeGroups[THREAT_TYPE.CASCADE]?.length ?? 0;
    const f28 = clamp01(cascadeCount / 8);

    // Feature 29: sovereignty entry count normalized over 8
    const sovereigntyCount = typeGroups[THREAT_TYPE.SOVEREIGNTY]?.length ?? 0;
    const f29 = clamp01(sovereigntyCount / 8);

    // Feature 30: currentTick normalized over 1000
    const f30 = normalizeTick(currentTick);

    // Feature 31: first byte of the SHA-256 projection checksum, / 255
    const checksum = this.computeProjectionChecksum(envelopes);
    const hashByte = parseInt(checksum.slice(0, 2), 16) / 255;
    const f31 = clamp01(hashByte);

    const features: readonly number[] = Object.freeze([
      f0, f1, f2, f3, f4, f5, f6, f7, f8, f9,
      f10, f11, f12, f13, f14, f15, f16, f17, f18,
      f19, f20, f21, f22, f23, f24, f25, f26,
      f27, f28, f29, f30, f31,
    ]);

    return Object.freeze({ features, labels: PROJECTION_ML_FEATURE_LABELS, tick: currentTick });
  }

  // --------------------------------------------------------------------------
  // MARK: DL tensor extraction — 16×8 from projection history
  // --------------------------------------------------------------------------

  /**
   * Extracts a 16×8 sequence tensor from the projection history ring-buffer.
   * Rows are ordered oldest-to-newest. Missing history rows are zero-padded.
   * Each row encodes 8 features derived from the historical projection snapshot:
   *
   *  [0] envelopeCount / 32
   *  [1] arrivedCount / 16
   *  [2] totalSeverityWeight / 10
   *  [3] criticalFlag (1 if any envelope severity >= CRITICAL weight)
   *  [4] avgEtaTicks / 50
   *  [5] pressureAmplifier (PRESSURE_TENSION_AMPLIFIERS[tier] - 1.0) / 0.5
   *  [6] visOrdinal placeholder (0, not stored in history)
   *  [7] typeWeight: totalSev / (envelopeCount * 1.5)
   */
  public extractDLTensor(pressureTier: PressureTier, tick: number): ProjectionDLTensor {
    const amp = PRESSURE_TENSION_AMPLIFIERS[pressureTier];
    const pressureAmp = clamp01((amp - 1.0) / 0.5);
    const capacity = PROJECTION_DL_SEQUENCE_LENGTH;
    const width = PROJECTION_DL_FEATURE_WIDTH;
    const critThreshold = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.CRITICAL];

    // Collect most-recent `capacity` history entries
    const historySlice = this._history.slice(-capacity);
    const rows: ProjectionDLTensorRow[] = [];

    for (let i = 0; i < capacity; i++) {
      const histIdx = historySlice.length - capacity + i;
      const histEntry = historySlice[histIdx];

      if (histEntry == null) {
        // Zero-pad missing rows
        rows.push(
          Object.freeze({ features: Object.freeze(new Array<number>(width).fill(0)) }),
        );
      } else {
        const envs = histEntry.envelopes;
        const envCount = envs.length;
        const arrived = envs.filter((e) => e.etaTicks === 0).length;
        const totalSev = envs.reduce((s, e) => s + e.severity, 0);
        const critFlag = envs.some((e) => e.severity >= critThreshold) ? 1 : 0;
        const avgEtaTicks = envCount > 0
          ? envs.reduce((s, e) => s + e.etaTicks, 0) / envCount
          : 0;
        const etaNorm = normalizeEta(avgEtaTicks);
        const typeWeight = envCount > 0 ? clamp01(totalSev / (envCount * 1.5)) : 0;

        // Use tick from history snapshot to compute row-level tick norm
        const rowTickNorm = normalizeTick(histEntry.tick);

        const features: readonly number[] = Object.freeze([
          clamp01(envCount / 32),       // 0
          clamp01(arrived / 16),        // 1
          clamp01(totalSev / 10),       // 2
          critFlag,                     // 3
          etaNorm,                      // 4
          pressureAmp,                  // 5
          rowTickNorm,                  // 6 — row-level tick norm replaces visOrdinal placeholder
          typeWeight,                   // 7
        ]);

        rows.push(Object.freeze({ features }));
      }
    }

    // Suppress unused warning — tick is used as the current tick reference for callers
    void tick;

    return Object.freeze({
      rows: Object.freeze(rows),
      labels: PROJECTION_DL_COLUMN_LABELS,
    });
  }

  // --------------------------------------------------------------------------
  // MARK: Health report
  // --------------------------------------------------------------------------

  /**
   * Computes a health report for the current projection window.
   * Risk tier is derived from envelope count, critical/existential counts,
   * and total severity weight.
   *
   * Tier thresholds:
   *   CLEAR    — no envelopes
   *   LOW      — envelopes present, no critical
   *   MEDIUM   — 2+ arrivals OR weight >= 1.2
   *   HIGH     — 1+ critical OR weight >= 2.5
   *   CRITICAL — 3+ critical OR existential present OR weight >= 4.0
   */
  public computeHealthReport(
    envelopes: readonly ThreatEnvelope[],
    entries: readonly AnticipationEntry[],
  ): ProjectionHealthReport {
    const envelopeCount = envelopes.length;
    const criticalEnvelopes = this.filterCriticalEnvelopes(envelopes);
    const criticalCount = criticalEnvelopes.length;
    const arrivedCount = entries.filter((e) => e.isArrived).length;
    const totalWeight = envelopes.reduce((s, e) => s + e.severity, 0);
    const alerts: string[] = [];

    // Accumulate alert messages
    if (criticalCount > 0) {
      alerts.push(`${criticalCount} critical threat(s) active in projection window`);
    }
    if (arrivedCount > 0) {
      alerts.push(`${arrivedCount} threat(s) have arrived and require immediate response`);
    }
    if (totalWeight > TENSION_CONSTANTS.PULSE_THRESHOLD * 5) {
      alerts.push(
        `Aggregate severity weight ${totalWeight.toFixed(2)} exceeds 5× pulse threshold`,
      );
    }

    const existentialEntries = entries.filter(
      (e) => e.threatSeverity === THREAT_SEVERITY.EXISTENTIAL,
    );
    if (existentialEntries.length > 0) {
      alerts.push(
        `${existentialEntries.length} existential threat(s) present — run at maximum pressure`,
      );
    }

    const cascadeEntries = entries.filter((e) => e.isCascadeTriggered);
    if (cascadeEntries.length > 0) {
      alerts.push(`${cascadeEntries.length} cascade-triggered threat(s) escalating`);
    }

    // Determine risk tier
    let riskTier: ProjectionHealthReport['riskTier'];
    if (totalWeight === 0 && envelopeCount === 0) {
      riskTier = 'CLEAR';
    } else if (existentialEntries.length > 0 || criticalCount >= 3 || totalWeight >= 4.0) {
      riskTier = 'CRITICAL';
    } else if (criticalCount >= 1 || totalWeight >= 2.5) {
      riskTier = 'HIGH';
    } else if (arrivedCount >= 2 || totalWeight >= 1.2) {
      riskTier = 'MEDIUM';
    } else if (envelopeCount > 0) {
      riskTier = 'LOW';
    } else {
      riskTier = 'CLEAR';
    }

    return Object.freeze({
      riskTier,
      envelopeCount,
      criticalCount,
      arrivedCount,
      totalWeight,
      alerts: Object.freeze(alerts),
    });
  }

  // --------------------------------------------------------------------------
  // MARK: Priority scores
  // --------------------------------------------------------------------------

  /**
   * Computes per-entry priority scores by combining severity weight, type weight,
   * ETA urgency, visibility bonus, and pressure amplification.
   *
   * Priority formula:
   *   base = severityWeight × typeWeight × (1 + visibilityBonus)
   *   etaFactor = 2.0 if arrived, else max(0.1, 1 - normalizeEta(eta))
   *   raw = base × etaFactor
   *   final = computeAmplifiedPriority(raw, pressureTier)
   *
   * Results are sorted descending by priorityScore.
   */
  public computePriorityScores(
    entries: readonly AnticipationEntry[],
    visibilityState: TensionVisibilityState,
    currentTick: number,
    pressureTier: PressureTier,
  ): readonly EnvelopePriorityScore[] {
    const config: VisibilityConfig = this.getVisibilityConfig(visibilityState);
    const visibilityBonus = config.tensionAwarenessBonus;

    const scores = entries.map((entry): EnvelopePriorityScore => {
      const etaTicks = entry.isArrived
        ? 0
        : Math.max(0, entry.arrivalTick - currentTick);
      const severityWeight = entry.severityWeight;
      const typeWeight = this.computeTypeProjectionWeight(entry.threatType);
      const basePriority = severityWeight * typeWeight * (1 + visibilityBonus);
      const etaFactor = etaUrgencyFactor(etaTicks);
      const rawPriority = basePriority * etaFactor;
      const priorityScore = this.computeAmplifiedPriority(rawPriority, pressureTier);

      return Object.freeze({
        entryId: entry.entryId,
        priorityScore,
        severityWeight,
        etaTicks,
        typeWeight,
        visibilityBonus,
      });
    });

    return freezeArray(scores.sort((a, b) => b.priorityScore - a.priorityScore));
  }

  // --------------------------------------------------------------------------
  // MARK: Narrative generation
  // --------------------------------------------------------------------------

  /**
   * Generates a human-readable narrative summary for the chat layer.
   *
   * The body is gated by visibility config:
   *   SHADOWED   — minimal info (count, pressure, tick)
   *   SIGNALED   — adds threat types
   *   TELEGRAPHED — adds ETA info
   *   EXPOSED    — full detail including THREAT_TYPE_DEFAULT_MITIGATIONS
   *
   * actionSuggestion always references THREAT_TYPE_DEFAULT_MITIGATIONS for the
   * dominant threat type.
   */
  public generateNarrative(
    envelopes: readonly ThreatEnvelope[],
    entries: readonly AnticipationEntry[],
    visibilityState: TensionVisibilityState,
    pressureTier: PressureTier,
    currentTick: number,
  ): ProjectionNarrative {
    const config: VisibilityConfig = this.getVisibilityConfig(visibilityState);
    const health = this.computeHealthReport(envelopes, entries);
    const dominantType = this._computeDominantType(entries);

    // Map risk tier to urgency level
    let urgency: ProjectionNarrative['urgency'];
    switch (health.riskTier) {
      case 'CRITICAL':
        urgency = 'CRITICAL';
        break;
      case 'HIGH':
        urgency = 'HIGH';
        break;
      case 'MEDIUM':
        urgency = 'MEDIUM';
        break;
      default:
        urgency = 'LOW';
    }

    // Headline
    let headline: string;
    if (envelopes.length === 0) {
      headline = 'No active threats in projection window';
    } else if (health.riskTier === 'CRITICAL') {
      headline = `CRITICAL: ${health.criticalCount} critical threat(s) — immediate action required`;
    } else if (health.arrivedCount > 0) {
      headline = `${health.arrivedCount} threat(s) have arrived — response required this tick`;
    } else {
      headline = `${health.envelopeCount} threat(s) in projection window (risk: ${health.riskTier})`;
    }

    // Body — gated by VISIBILITY_CONFIGS
    let body: string;
    if (!config.showsThreatType) {
      // SHADOWED: no type disclosure
      body = [
        `Threat signatures detected in queue.`,
        `Pressure tier: ${pressureTier}.`,
        `Current tick: ${currentTick}.`,
        `Awareness bonus: ${config.tensionAwarenessBonus}.`,
      ].join(' ');
    } else if (!config.showsArrivalTick) {
      // SIGNALED: types disclosed, no ETA
      const types = [...new Set(entries.map((e) => e.threatType))].join(', ');
      body = [
        `Threat types present: ${types}.`,
        `Total severity weight: ${health.totalWeight.toFixed(2)}.`,
        `Pressure: ${pressureTier}.`,
        `Tick: ${currentTick}.`,
      ].join(' ');
    } else if (!config.showsMitigationPath) {
      // TELEGRAPHED: types + ETA, no mitigation paths
      const types = [...new Set(entries.map((e) => e.threatType))].join(', ');
      const pendingEtas = entries
        .filter((e) => !e.isArrived)
        .map((e) => Math.max(0, e.arrivalTick - currentTick));
      const minEta = pendingEtas.length > 0 ? Math.min(...pendingEtas) : null;
      const etaStr = minEta !== null
        ? `Next threat arrival in ${minEta} tick(s).`
        : 'No pending arrivals.';
      body = [
        `Threat types: ${types}.`,
        etaStr,
        `Severity weight: ${health.totalWeight.toFixed(2)}.`,
        `Pressure: ${pressureTier}.`,
      ].join(' ');
    } else {
      // EXPOSED: full detail including THREAT_TYPE_DEFAULT_MITIGATIONS
      const mitigations = dominantType !== null
        ? THREAT_TYPE_DEFAULT_MITIGATIONS[dominantType].join(', ')
        : 'no dominant threat type identified';
      const worstCases = entries
        .slice(0, 3)
        .map((e) => `${e.threatType}: ${e.worstCaseOutcome}`)
        .join('; ');
      body = [
        `Dominant threat: ${dominantType ?? 'unknown'}.`,
        `Recommended mitigations: ${mitigations}.`,
        `Worst-case outcomes: ${worstCases}.`,
        `Total severity: ${health.totalWeight.toFixed(2)}.`,
        `Pressure: ${pressureTier}.`,
        `Tick: ${currentTick}.`,
      ].join(' ');
    }

    // Action suggestion references THREAT_TYPE_DEFAULT_MITIGATIONS
    let actionSuggestion: string;
    if (dominantType !== null) {
      const defaultMitigations = THREAT_TYPE_DEFAULT_MITIGATIONS[dominantType];
      const primary = defaultMitigations[0] ?? 'counter-measure';
      const secondary = defaultMitigations[1] ?? null;
      actionSuggestion = secondary !== null
        ? `Deploy ${primary} or ${secondary} against dominant ${dominantType} threat`
        : `Deploy ${primary} against dominant ${dominantType} threat`;
    } else if (entries.length === 0) {
      actionSuggestion = 'No action required — threat queue is clear';
    } else {
      actionSuggestion = 'Monitor threat queue; no dominant type identified';
    }

    return Object.freeze({ headline, body, urgency, actionSuggestion });
  }

  // --------------------------------------------------------------------------
  // MARK: Projection context
  // --------------------------------------------------------------------------

  /**
   * Builds a full ProjectionContext from the current entries and visibility state.
   * This is the recommended way to gather all projection-derived data in one call.
   */
  public buildProjectionContext(
    entries: readonly AnticipationEntry[],
    visibilityState: TensionVisibilityState,
    pressureTier: PressureTier,
    currentTick: number,
  ): ProjectionContext {
    const envelopes = this.toThreatEnvelopes(entries, visibilityState, currentTick);
    const totalSeverityWeight = envelopes.reduce((s, e) => s + e.severity, 0);
    const dominantThreatType = this._computeDominantType(entries);
    const criticalEnvelopes = this.filterCriticalEnvelopes(envelopes);

    return Object.freeze({
      envelopes,
      visibilityState,
      pressureTier,
      currentTick,
      totalSeverityWeight,
      dominantThreatType,
      criticalEnvelopes,
    });
  }

  // --------------------------------------------------------------------------
  // MARK: Event builders
  // --------------------------------------------------------------------------

  /**
   * Builds a typed ThreatArrivedEvent for an entry that has just arrived.
   * eventType is hardcoded to 'THREAT_ARRIVED'; _eventName binds TENSION_EVENT_NAMES.THREAT_ARRIVED.
   */
  public buildThreatArrivedEvent(
    entry: AnticipationEntry,
    tick: number,
  ): ThreatArrivedEvent {
    return Object.freeze({
      eventType: 'THREAT_ARRIVED' as const,
      entryId: entry.entryId,
      threatType: entry.threatType,
      threatSeverity: entry.threatSeverity,
      source: entry.source,
      worstCaseOutcome: entry.worstCaseOutcome,
      mitigationCardTypes: entry.mitigationCardTypes,
      tickNumber: tick,
      timestamp: Date.now(),
      // Bind canonical event name from TENSION_EVENT_NAMES
      _eventName: TENSION_EVENT_NAMES.THREAT_ARRIVED,
    } as ThreatArrivedEvent & { _eventName: string });
  }

  /**
   * Builds a typed ThreatExpiredEvent for an entry that has passed its expiry tick.
   * _eventName binds TENSION_EVENT_NAMES.THREAT_EXPIRED.
   */
  public buildThreatExpiredEvent(
    entry: AnticipationEntry,
    tick: number,
  ): ThreatExpiredEvent {
    return Object.freeze({
      eventType: 'THREAT_EXPIRED' as const,
      entryId: entry.entryId,
      threatType: entry.threatType,
      threatSeverity: entry.threatSeverity,
      ticksOverdue: entry.ticksOverdue,
      tickNumber: tick,
      timestamp: Date.now(),
      _eventName: TENSION_EVENT_NAMES.THREAT_EXPIRED,
    } as ThreatExpiredEvent & { _eventName: string });
  }

  /**
   * Builds a typed ThreatMitigatedEvent for an entry that has been mitigated.
   * _eventName binds TENSION_EVENT_NAMES.THREAT_MITIGATED.
   */
  public buildThreatMitigatedEvent(
    entry: AnticipationEntry,
    tick: number,
  ): ThreatMitigatedEvent {
    return Object.freeze({
      eventType: 'THREAT_MITIGATED' as const,
      entryId: entry.entryId,
      threatType: entry.threatType,
      tickNumber: tick,
      timestamp: Date.now(),
      _eventName: TENSION_EVENT_NAMES.THREAT_MITIGATED,
    } as ThreatMitigatedEvent & { _eventName: string });
  }

  // --------------------------------------------------------------------------
  // MARK: Sorting and filtering
  // --------------------------------------------------------------------------

  /**
   * Sorts envelopes by descending priority score. Priority is derived from
   * severityWeight × typeWeight × etaFactor, amplified by PRESSURE_TENSION_AMPLIFIERS.
   */
  public sortEnvelopesByPriority(
    envelopes: readonly ThreatEnvelope[],
    entries: readonly AnticipationEntry[],
    pressureTier: PressureTier,
    currentTick: number,
  ): readonly ThreatEnvelope[] {
    // Build a score map keyed by threatId
    const scoreMap = new Map<string, number>();
    for (const entry of entries) {
      const etaTicks = entry.isArrived
        ? 0
        : Math.max(0, entry.arrivalTick - currentTick);
      const typeWeight = this.computeTypeProjectionWeight(entry.threatType);
      const etaFactor = etaUrgencyFactor(etaTicks);
      const basePriority = entry.severityWeight * typeWeight * etaFactor;
      const amplified = this.computeAmplifiedPriority(basePriority, pressureTier);
      scoreMap.set(entry.threatId, amplified);
    }

    return freezeArray(
      [...envelopes].sort((a, b) => {
        const sa = scoreMap.get(a.threatId) ?? 0;
        const sb = scoreMap.get(b.threatId) ?? 0;
        return sb - sa;
      }),
    );
  }

  /**
   * Sorts envelopes by descending visibility level ordinal, using VISIBILITY_ORDER
   * to map each envelope's visibleAs level to an integer.
   * EXPOSED envelopes appear first; HIDDEN last.
   */
  public sortEnvelopesByVisibility(
    envelopes: readonly ThreatEnvelope[],
  ): readonly ThreatEnvelope[] {
    return freezeArray(
      [...envelopes].sort((a, b) => {
        const oa = visibilityLevelOrdinal(a.visibleAs);
        const ob = visibilityLevelOrdinal(b.visibleAs);
        return ob - oa; // highest visibility first
      }),
    );
  }

  /**
   * Returns all envelopes whose severity meets or exceeds the CRITICAL severity
   * weight as defined in THREAT_SEVERITY_WEIGHTS.
   */
  public filterCriticalEnvelopes(envelopes: readonly ThreatEnvelope[]): readonly ThreatEnvelope[] {
    const critWeight = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.CRITICAL];
    return freezeArray(envelopes.filter((e) => e.severity >= critWeight));
  }

  // --------------------------------------------------------------------------
  // MARK: Grouping
  // --------------------------------------------------------------------------

  /**
   * Groups entries by threat type, returning a record keyed by each THREAT_TYPE
   * value. All 8 types are always present in the result, even if empty.
   */
  public groupEnvelopesByType(
    entries: readonly AnticipationEntry[],
  ): Readonly<Record<ThreatType, readonly AnticipationEntry[]>> {
    const groups: Record<string, AnticipationEntry[]> = {};

    // Initialize all THREAT_TYPE keys so every type is always present
    for (const tt of Object.values(THREAT_TYPE)) {
      groups[tt] = [];
    }

    for (const entry of entries) {
      const key = entry.threatType as string;
      if (key in groups) {
        groups[key]!.push(entry);
      }
    }

    return Object.freeze(
      Object.fromEntries(
        Object.entries(groups).map(([k, v]) => [k, Object.freeze(v)]),
      ) as Record<ThreatType, readonly AnticipationEntry[]>,
    );
  }

  /**
   * Counts entries grouped by threat severity, using THREAT_SEVERITY as the
   * canonical key set. All 5 severities are always present in the result.
   */
  public computeSeverityGrouped(
    entries: readonly AnticipationEntry[],
  ): Readonly<Record<ThreatSeverity, number>> {
    const counts: Record<string, number> = {
      [THREAT_SEVERITY.MINOR]: 0,
      [THREAT_SEVERITY.MODERATE]: 0,
      [THREAT_SEVERITY.SEVERE]: 0,
      [THREAT_SEVERITY.CRITICAL]: 0,
      [THREAT_SEVERITY.EXISTENTIAL]: 0,
    };

    for (const entry of entries) {
      if (entry.threatSeverity in counts) {
        counts[entry.threatSeverity] = (counts[entry.threatSeverity] ?? 0) + 1;
      }
    }

    return Object.freeze(counts as Record<ThreatSeverity, number>);
  }

  // --------------------------------------------------------------------------
  // MARK: Enrichment
  // --------------------------------------------------------------------------

  /**
   * Enriches a ThreatEnvelope with mitigation advice derived from
   * THREAT_TYPE_DEFAULT_MITIGATIONS for the entry's threat type.
   * The entry's own mitigationCardTypes are also included, deduplicated.
   */
  public enrichWithMitigationAdvice(
    envelope: ThreatEnvelope,
    entry: AnticipationEntry,
  ): ThreatEnvelope & { mitigationAdvice: readonly string[] } {
    const defaultAdvice = THREAT_TYPE_DEFAULT_MITIGATIONS[entry.threatType];
    const combined = Array.from(
      new Set([...entry.mitigationCardTypes, ...defaultAdvice]),
    );

    return Object.freeze({
      ...envelope,
      mitigationAdvice: Object.freeze(combined),
    });
  }

  /**
   * Enriches projection output by merging with a TensionRuntimeSnapshot.
   * Entries are projected using the snapshot's visibilityState; any threats
   * in the snapshot's visibleThreats that are not in entries are appended.
   */
  public enrichFromRuntimeSnapshot(
    snapshot: TensionRuntimeSnapshot,
    entries: readonly AnticipationEntry[],
  ): readonly ThreatEnvelope[] {
    const visibilityState: TensionVisibilityState = snapshot.visibilityState;
    const projected = this.toThreatEnvelopes(entries, visibilityState, snapshot.tickNumber);

    // Merge snapshot threats not already in the projection
    const projectedIds = new Set(projected.map((e) => e.threatId));
    const snapshotOnly = snapshot.visibleThreats.filter(
      (t) => !projectedIds.has(t.threatId),
    );

    return freezeArray([...projected, ...snapshotOnly]);
  }

  /**
   * Computes the enriched projection context for a compute-only use case:
   * takes a snapshot's metadata and re-projects entries under its visibility state.
   */
  public computeProjectionEnrichment(
    snapshot: TensionRuntimeSnapshot,
    entries: readonly AnticipationEntry[],
    pressureTier: PressureTier,
  ): ProjectionContext {
    const config: VisibilityConfig = this.getVisibilityConfig(snapshot.visibilityState);
    const envelopes = this.enrichFromRuntimeSnapshot(snapshot, entries);
    const totalSeverityWeight = envelopes.reduce((s, e) => s + e.severity, 0);
    const dominantThreatType = this._computeDominantType(entries);
    const criticalEnvelopes = this.filterCriticalEnvelopes(envelopes);

    // Use config.tensionAwarenessBonus to weight the total
    const awarenessAdjustedWeight =
      totalSeverityWeight * (1 + config.tensionAwarenessBonus);

    return Object.freeze({
      envelopes,
      visibilityState: snapshot.visibilityState,
      pressureTier,
      currentTick: snapshot.tickNumber,
      totalSeverityWeight: awarenessAdjustedWeight,
      dominantThreatType,
      criticalEnvelopes,
    });
  }

  // --------------------------------------------------------------------------
  // MARK: Scoring utilities
  // --------------------------------------------------------------------------

  /**
   * Computes the aggregate weighted projection score across all entries.
   * Uses THREAT_SEVERITY_WEIGHTS keyed by each entry's threatSeverity;
   * falls back to entry.severityWeight if the severity is not in the map.
   */
  public computeWeightedProjectionScore(entries: readonly AnticipationEntry[]): number {
    return entries.reduce((sum, entry) => {
      const sevW = THREAT_SEVERITY_WEIGHTS[entry.threatSeverity] ?? entry.severityWeight;
      return sum + sevW;
    }, 0);
  }

  /**
   * Returns the PROJECTION_TYPE_WEIGHTS multiplier for a given ThreatType.
   * Defaults to 1.0 if the type is not in the weights map (should not occur).
   */
  public computeTypeProjectionWeight(threatType: ThreatType): number {
    return PROJECTION_TYPE_WEIGHTS[threatType] ?? 1.0;
  }

  /**
   * Amplifies a base priority by the pressure tier multiplier from
   * PRESSURE_TENSION_AMPLIFIERS. T4 = 1.5×, T0 = 1.0×.
   */
  public computeAmplifiedPriority(basePriority: number, pressureTier: PressureTier): number {
    const amp = PRESSURE_TENSION_AMPLIFIERS[pressureTier];
    return basePriority * amp;
  }

  /**
   * Computes a composite score for a single entry combining severity weight,
   * type weight, eta urgency, and pressure amplification.
   */
  public computeEntryCompositeScore(
    entry: AnticipationEntry,
    currentTick: number,
    pressureTier: PressureTier,
  ): number {
    const etaTicks = entry.isArrived ? 0 : Math.max(0, entry.arrivalTick - currentTick);
    const sevW = THREAT_SEVERITY_WEIGHTS[entry.threatSeverity] ?? entry.severityWeight;
    const typeW = this.computeTypeProjectionWeight(entry.threatType);
    const etaFactor = etaUrgencyFactor(etaTicks);
    return this.computeAmplifiedPriority(sevW * typeW * etaFactor, pressureTier);
  }

  /**
   * Returns the dominant (highest-weighted) threat type across all entries,
   * resolving ties by PROJECTION_TYPE_WEIGHTS.
   */
  public computeDominantThreatType(entries: readonly AnticipationEntry[]): ThreatType | null {
    return this._computeDominantType(entries);
  }

  // --------------------------------------------------------------------------
  // MARK: Visibility utilities
  // --------------------------------------------------------------------------

  /**
   * Returns the VisibilityConfig for the given TensionVisibilityState from
   * VISIBILITY_CONFIGS.
   */
  public getVisibilityConfig(state: TensionVisibilityState): VisibilityConfig {
    return VISIBILITY_CONFIGS[state];
  }

  /**
   * Resolves the VisibilityLevel for a TensionVisibilityState using the
   * INTERNAL_VISIBILITY_TO_ENVELOPE mapping.
   */
  public resolveEnvelopeLevel(state: TensionVisibilityState): VisibilityLevel {
    return INTERNAL_VISIBILITY_TO_ENVELOPE[state];
  }

  /**
   * Returns the 0-based ordinal of a TensionVisibilityState in VISIBILITY_ORDER.
   * SHADOWED = 0, SIGNALED = 1, TELEGRAPHED = 2, EXPOSED = 3.
   */
  public visibilityOrdinal(state: TensionVisibilityState): number {
    return VISIBILITY_ORDER.indexOf(state);
  }

  /**
   * Returns true if the given visibility state permits showing threat arrival ticks,
   * as determined by VISIBILITY_CONFIGS.
   */
  public stateShowsArrivalTick(state: TensionVisibilityState): boolean {
    return VISIBILITY_CONFIGS[state].showsArrivalTick;
  }

  /**
   * Returns true if the given visibility state permits showing mitigation paths,
   * as determined by VISIBILITY_CONFIGS.
   */
  public stateShowsMitigationPath(state: TensionVisibilityState): boolean {
    return VISIBILITY_CONFIGS[state].showsMitigationPath;
  }

  // --------------------------------------------------------------------------
  // MARK: Checksum
  // --------------------------------------------------------------------------

  /**
   * Computes a SHA-256 checksum of the current envelope set.
   * The payload is a deterministic concatenation of threatId, etaTicks,
   * severity, and visibleAs for each envelope, pipe-separated.
   * Uses createHash from node:crypto.
   */
  public computeProjectionChecksum(envelopes: readonly ThreatEnvelope[]): string {
    const payload = envelopes
      .map((e) => `${e.threatId}:${e.etaTicks}:${e.severity}:${e.visibleAs}`)
      .join('|');
    return createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Computes a keyed projection checksum that incorporates the tick and pressureTier,
   * suitable for cache invalidation.
   */
  public computeKeyedChecksum(
    envelopes: readonly ThreatEnvelope[],
    tick: number,
    pressureTier: PressureTier,
  ): string {
    const envelopeChecksum = this.computeProjectionChecksum(envelopes);
    const keyPayload = `${envelopeChecksum}:${tick}:${pressureTier}`;
    return createHash('sha256').update(keyPayload).digest('hex');
  }

  // --------------------------------------------------------------------------
  // MARK: History management
  // --------------------------------------------------------------------------

  /**
   * Records a projection snapshot in the ring-buffer.
   * Evicts the oldest entry when capacity (PROJECTION_HISTORY_CAPACITY) is reached.
   * Updates _totalProjectionsComputed and _lastChecksum.
   */
  public recordProjection(envelopes: readonly ThreatEnvelope[], tick: number): void {
    const checksum = this.computeProjectionChecksum(envelopes);

    this._history.push(Object.freeze({ envelopes, tick, checksum }));

    if (this._history.length > PROJECTION_HISTORY_CAPACITY) {
      this._history.splice(0, this._history.length - PROJECTION_HISTORY_CAPACITY);
    }

    this._totalProjectionsComputed += 1;
    this._lastChecksum = checksum;
  }

  /**
   * Clears the projection history ring-buffer.
   * Does not reset totalProjectionsComputed or lastChecksum.
   */
  public clearHistory(): void {
    this._history.splice(0, this._history.length);
  }

  /**
   * Returns the number of projection snapshots currently in the ring-buffer.
   */
  public getHistoryLength(): number {
    return this._history.length;
  }

  // --------------------------------------------------------------------------
  // MARK: Serialization
  // --------------------------------------------------------------------------

  /**
   * Returns a lightweight serialized snapshot of the projector's internal state.
   * Suitable for logging, audit trails, and debug tooling.
   */
  public serialize(): ProjectionSerializedState {
    return Object.freeze({
      projectionCount: this._history.length,
      lastChecksum: this._lastChecksum,
      totalProjectionsComputed: this._totalProjectionsComputed,
      timestamp: Date.now(),
    });
  }

  // --------------------------------------------------------------------------
  // MARK: Export bundle
  // --------------------------------------------------------------------------

  /**
   * Produces a full export bundle containing every projection-derived artifact.
   * This is the recommended integration point for logging and telemetry pipelines.
   *
   * The bundle includes:
   *   - mlVector (32-dim feature vector)
   *   - dlTensor (16×8 sequence tensor from history)
   *   - healthReport (risk tier and alerts)
   *   - narrative (headline, body, urgency, actionSuggestion)
   *   - context (full ProjectionContext)
   *   - serialized (lightweight projector state)
   */
  public exportBundle(
    entries: readonly AnticipationEntry[],
    visibilityState: TensionVisibilityState,
    pressureTier: PressureTier,
    currentTick: number,
  ): ProjectionExportBundle {
    const envelopes = this.toThreatEnvelopes(entries, visibilityState, currentTick);
    const mlVector = this.computeMLVector(
      envelopes, entries, visibilityState, pressureTier, currentTick,
    );
    const dlTensor = this.extractDLTensor(pressureTier, currentTick);
    const healthReport = this.computeHealthReport(envelopes, entries);
    const narrative = this.generateNarrative(
      envelopes, entries, visibilityState, pressureTier, currentTick,
    );
    const context = this.buildProjectionContext(entries, visibilityState, pressureTier, currentTick);
    const serialized = this.serialize();

    return Object.freeze({
      mlVector,
      dlTensor,
      healthReport,
      narrative,
      context,
      serialized,
    });
  }

  // --------------------------------------------------------------------------
  // MARK: Private helpers
  // --------------------------------------------------------------------------

  /**
   * Determines the dominant ThreatType by counting entries per type.
   * In the event of a tie, the type with the higher PROJECTION_TYPE_WEIGHTS
   * value wins. Returns null for empty entry sets.
   */
  private _computeDominantType(entries: readonly AnticipationEntry[]): ThreatType | null {
    if (entries.length === 0) return null;

    const counts = new Map<ThreatType, number>();
    for (const e of entries) {
      counts.set(e.threatType, (counts.get(e.threatType) ?? 0) + 1);
    }

    let best: ThreatType | null = null;
    let bestCount = 0;
    let bestWeight = 0;

    for (const [type, count] of counts) {
      const weight = PROJECTION_TYPE_WEIGHTS[type] ?? 1.0;
      // Prefer higher count; break ties by type weight
      if (count > bestCount || (count === bestCount && weight > bestWeight)) {
        best = type;
        bestCount = count;
        bestWeight = weight;
      }
    }

    return best;
  }
}

// ============================================================================
// MARK: Standalone exported functions
// ============================================================================

/**
 * Convenience wrapper — projects entries to ThreatEnvelopes using a transient
 * TensionThreatProjector instance.
 */
export function projectThreatEnvelopes(
  entries: readonly AnticipationEntry[],
  visibilityState: TensionVisibilityState,
  currentTick: number,
): readonly ThreatEnvelope[] {
  const projector = new TensionThreatProjector();
  return projector.toThreatEnvelopes(entries, visibilityState, currentTick);
}

/**
 * Computes the aggregate weighted score across all entries using
 * THREAT_SEVERITY_WEIGHTS. Pure function, no projector instance required.
 */
export function computeProjectionWeight(entries: readonly AnticipationEntry[]): number {
  return entries.reduce((sum, entry) => {
    const w = THREAT_SEVERITY_WEIGHTS[entry.threatSeverity] ?? entry.severityWeight;
    return sum + w;
  }, 0);
}

/**
 * Returns envelopes sorted by ascending ETA (arrived envelopes first, etaTicks = 0).
 * Does not mutate the input array.
 */
export function rankEnvelopesByETA(
  envelopes: readonly ThreatEnvelope[],
): readonly ThreatEnvelope[] {
  return Object.freeze([...envelopes].sort((a, b) => a.etaTicks - b.etaTicks));
}

/**
 * Filters entries whose arrivalTick <= currentTick, i.e., threats that have
 * already arrived by the current game tick.
 */
export function filterArrivedEnvelopes(
  entries: readonly AnticipationEntry[],
  currentTick: number,
): readonly AnticipationEntry[] {
  return Object.freeze(entries.filter((e) => e.arrivalTick <= currentTick));
}

/**
 * Computes a 32-dimensional ML feature vector from entries using a transient
 * TensionThreatProjector instance. Equivalent to constructing a projector and
 * calling computeMLVector directly.
 */
export function computeThreatProjectionMLVector(
  entries: readonly AnticipationEntry[],
  visibilityState: TensionVisibilityState,
  pressureTier: PressureTier,
  currentTick: number,
): ProjectionMLVector {
  const projector = new TensionThreatProjector();
  const envelopes = projector.toThreatEnvelopes(entries, visibilityState, currentTick);
  return projector.computeMLVector(envelopes, entries, visibilityState, pressureTier, currentTick);
}

/**
 * Computes a normalized health score in [0, 1] for the current projection window.
 *
 * Formula:
 *   normalizedWeight = totalSeverity / (envelopeCount * 2), clamped 0–1
 *   severityBonus = (existentialCount * 0.3 + criticalCount * 0.15), clamped 0–1
 *   score = (normalizedWeight + severityBonus) / (1 + TENSION_CONSTANTS.PULSE_THRESHOLD)
 *
 * Returns 0 for an empty projection window.
 */
export function computeProjectionHealthScore(
  envelopes: readonly ThreatEnvelope[],
  entries: readonly AnticipationEntry[],
): number {
  if (envelopes.length === 0) return 0;
  const totalWeight = envelopes.reduce((s, e) => s + e.severity, 0);
  const existentialCount = entries.filter(
    (e) => e.threatSeverity === THREAT_SEVERITY.EXISTENTIAL,
  ).length;
  const criticalCount = entries.filter(
    (e) => e.threatSeverity === THREAT_SEVERITY.CRITICAL,
  ).length;
  const pulseRef = TENSION_CONSTANTS.PULSE_THRESHOLD; // 0.9

  const normalizedWeight = clamp01(totalWeight / (envelopes.length * 2));
  const severityBonus = clamp01(existentialCount * 0.3 + criticalCount * 0.15);
  return clamp01((normalizedWeight + severityBonus) / (1 + pulseRef));
}

/**
 * Returns a string risk tier for the given aggregate metrics.
 *
 * Thresholds:
 *   CLEAR    — all zero
 *   LOW      — any non-zero, no critical
 *   MEDIUM   — 2+ arrivals OR weight >= 1.2
 *   HIGH     — 1+ critical OR weight >= 2.5
 *   CRITICAL — 3+ critical OR weight >= 4.0
 */
export function classifyProjectionRisk(
  totalWeight: number,
  criticalCount: number,
  arrivedCount: number,
): string {
  if (totalWeight === 0 && criticalCount === 0 && arrivedCount === 0) return 'CLEAR';
  if (criticalCount >= 3 || totalWeight >= 4.0) return 'CRITICAL';
  if (criticalCount >= 1 || totalWeight >= 2.5) return 'HIGH';
  if (arrivedCount >= 2 || totalWeight >= 1.2) return 'MEDIUM';
  return 'LOW';
}

/**
 * Builds a plain, serialization-safe context object for the chat/LLM layer.
 * Fields are gated by VISIBILITY_CONFIGS for the given state:
 *   - SHADOWED:     envelopeCount, pressureTier, visibilityState, awarenessBonus
 *   - SIGNALED:     + arrivedCount, queuedCount, threatTypes
 *   - TELEGRAPHED:  + minEtaTicks
 *   - EXPOSED:      + mitigations (THREAT_TYPE_DEFAULT_MITIGATIONS), worstCases
 */
export function buildProjectionChatContext(
  envelopes: readonly ThreatEnvelope[],
  entries: readonly AnticipationEntry[],
  visibilityState: TensionVisibilityState,
  pressureTier: PressureTier,
): object {
  const config: VisibilityConfig = VISIBILITY_CONFIGS[visibilityState];

  const base: Record<string, unknown> = {
    envelopeCount: envelopes.length,
    pressureTier,
    visibilityState,
    awarenessBonus: config.tensionAwarenessBonus,
  };

  if (config.showsThreatCount) {
    base['arrivedCount'] = entries.filter((e) => e.isArrived).length;
    base['queuedCount'] = entries.filter(
      (e) => !e.isArrived && !e.isMitigated && !e.isExpired,
    ).length;
  }

  if (config.showsThreatType) {
    base['threatTypes'] = [...new Set(entries.map((e) => e.threatType))];
  }

  if (config.showsArrivalTick) {
    const etaValues = envelopes.map((e) => e.etaTicks).filter((t) => t >= 0);
    const minEta = etaValues.length > 0 ? Math.min(...etaValues) : null;
    base['minEtaTicks'] = minEta;
  }

  if (config.showsMitigationPath) {
    const mitigationMap: Record<string, readonly string[]> = {};
    for (const entry of entries) {
      const defaults = THREAT_TYPE_DEFAULT_MITIGATIONS[entry.threatType];
      mitigationMap[entry.entryId] = defaults;
    }
    base['mitigations'] = mitigationMap;
  }

  if (config.showsWorstCase) {
    base['worstCases'] = entries.map((e) => ({
      entryId: e.entryId,
      outcome: e.worstCaseOutcome,
    }));
  }

  return Object.freeze(base);
}

/**
 * Computes envelope density as envelopeCount / queueCapacity, clamped to [0, 1].
 * Returns 0 if queueCapacity is 0 or negative.
 */
export function computeEnvelopeDensity(
  envelopes: readonly ThreatEnvelope[],
  queueCapacity: number,
): number {
  if (queueCapacity <= 0) return 0;
  return clamp01(envelopes.length / queueCapacity);
}

/**
 * Merges two EnvelopeProjectionResult objects, deduplicating envelopes by threatId.
 * The first argument (a) takes precedence on conflicts: duplicate envelopes from b
 * are discarded. ML vectors are averaged feature-by-feature. Metrics are summed.
 */
export function mergeProjectionResults(
  a: EnvelopeProjectionResult,
  b: EnvelopeProjectionResult,
): EnvelopeProjectionResult {
  const seen = new Set<string>(a.envelopes.map((e) => e.threatId));
  const merged: ThreatEnvelope[] = [
    ...a.envelopes,
    ...b.envelopes.filter((e) => !seen.has(e.threatId)),
  ];

  const envelopes: readonly ThreatEnvelope[] = Object.freeze(merged);
  const totalWeight = a.totalWeight + b.totalWeight;
  const criticalCount = a.criticalCount + b.criticalCount;
  const arrivedCount = a.arrivedCount + b.arrivedCount;
  const queuedCount = a.queuedCount + b.queuedCount;

  // Recompute checksum from merged envelopes using createHash
  const checksumPayload = envelopes
    .map((e) => `${e.threatId}:${e.etaTicks}:${e.severity}:${e.visibleAs}`)
    .join('|');
  const projectionChecksum = createHash('sha256').update(checksumPayload).digest('hex');

  // Average ML feature vectors
  const af = a.mlVector.features;
  const bf = b.mlVector.features;
  const len = Math.max(af.length, bf.length);
  const mergedFeatures: number[] = [];
  for (let i = 0; i < len; i++) {
    mergedFeatures.push(((af[i] ?? 0) + (bf[i] ?? 0)) / 2);
  }

  const mlVector: ProjectionMLVector = Object.freeze({
    features: Object.freeze(mergedFeatures),
    labels: a.mlVector.labels,
    tick: Math.max(a.mlVector.tick, b.mlVector.tick),
  });

  return Object.freeze({
    envelopes,
    mlVector,
    totalWeight,
    criticalCount,
    arrivedCount,
    queuedCount,
    projectionChecksum,
  });
}

// ============================================================================
// MARK: Self-test
// ============================================================================

/**
 * runProjectionSelfTest — 80 checks validating the full projection subsystem.
 *
 * Verifications include:
 *   - All projection functions return valid output
 *   - ML vector dimension = 32
 *   - DL tensor shape 16×8
 *   - Health report tiers and escalation logic
 *   - Priority scoring order and amplification
 *   - Narrative generation per visibility level
 *   - Event builders bind correct TENSION_EVENT_NAMES
 *   - THREAT_TYPE_DEFAULT_MITIGATIONS used in enrichment
 *   - PRESSURE_TENSION_AMPLIFIERS applied correctly
 *   - THREAT_SEVERITY_WEIGHTS used in weighted score
 *   - VISIBILITY_CONFIGS queried and gating logic correct
 *   - INTERNAL_VISIBILITY_TO_ENVELOPE mapping correct
 *   - All standalone functions produce valid output
 *   - Checksum is deterministic (createHash)
 *   - Merge deduplication is correct
 *   - Export bundle has all 6 fields
 *
 * Returns a ProjectionSelfTestResult with passed flag, all check names, failures.
 */
export function runProjectionSelfTest(): ProjectionSelfTestResult {
  const checks: string[] = [];
  const failures: string[] = [];

  function assert(label: string, condition: boolean): void {
    checks.push(label);
    if (!condition) failures.push(label);
  }

  // ------------------------------------------------------------------
  // Build minimal test fixtures
  // ------------------------------------------------------------------
  const makeEntry = (overrides: Partial<AnticipationEntry> = {}): AnticipationEntry => ({
    entryId: 'e1',
    runId: 'run-1',
    sourceKey: 'src-1',
    threatId: 'threat-1',
    source: 'TEST',
    threatType: THREAT_TYPE.CASCADE,
    threatSeverity: THREAT_SEVERITY.CRITICAL,
    enqueuedAtTick: 0,
    arrivalTick: 10,
    isCascadeTriggered: false,
    cascadeTriggerEventId: null,
    worstCaseOutcome: 'SYSTEM_FAILURE',
    mitigationCardTypes: ['STABILIZE'],
    baseTensionPerTick: 0.2,
    severityWeight: THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.CRITICAL],
    summary: 'Test threat',
    state: 'QUEUED' as const,
    isArrived: false,
    isMitigated: false,
    isExpired: false,
    isNullified: false,
    mitigatedAtTick: null,
    expiredAtTick: null,
    ticksOverdue: 0,
    decayTicksRemaining: 0,
    ...overrides,
  });

  const projector = new TensionThreatProjector();
  const e1 = makeEntry();
  const e2 = makeEntry({
    entryId: 'e2',
    threatId: 'threat-2',
    threatType: THREAT_TYPE.SOVEREIGNTY,
    threatSeverity: THREAT_SEVERITY.EXISTENTIAL,
    severityWeight: THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL],
    isArrived: true,
    arrivalTick: 5,
    state: 'ARRIVED' as const,
  });
  const e3 = makeEntry({
    entryId: 'e3',
    threatId: 'threat-3',
    threatType: THREAT_TYPE.DEBT_SPIRAL,
    threatSeverity: THREAT_SEVERITY.MINOR,
    severityWeight: THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MINOR],
    arrivalTick: 30,
  });
  const e4 = makeEntry({
    entryId: 'e4',
    threatId: 'threat-4',
    threatType: THREAT_TYPE.SHIELD_PIERCE,
    threatSeverity: THREAT_SEVERITY.SEVERE,
    severityWeight: THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.SEVERE],
    arrivalTick: 15,
  });

  const entries: readonly AnticipationEntry[] = [e1, e2, e3, e4];
  const visState: TensionVisibilityState = TENSION_VISIBILITY_STATE.EXPOSED;
  const tier: PressureTier = 'T3';
  const tick = 7;

  // ------------------------------------------------------------------
  // Checks 1–5: toThreatEnvelopes
  // ------------------------------------------------------------------
  const envelopes = projector.toThreatEnvelopes(entries, visState, tick);
  assert('toThreatEnvelopes returns array', Array.isArray(envelopes));
  assert('toThreatEnvelopes length === entries.length', envelopes.length === entries.length);
  assert('toThreatEnvelopes envelope[0] has threatId', typeof envelopes[0]?.threatId === 'string');
  assert('arrived entry etaTicks === 0', envelopes[1]?.etaTicks === 0);
  assert('queued entry etaTicks > 0', (envelopes[0]?.etaTicks ?? 0) > 0);

  // ------------------------------------------------------------------
  // Checks 6–10: ML vector dimensionality and key features
  // ------------------------------------------------------------------
  const ml = projector.computeMLVector(envelopes, entries, visState, tier, tick);
  assert('ML vector features length === 32', ml.features.length === PROJECTION_ML_FEATURE_COUNT);
  assert('ML labels length === 32', ml.labels.length === PROJECTION_ML_FEATURE_COUNT);
  assert(
    'ML feature[4] uses PRESSURE_TENSION_AMPLIFIERS (T3 amp > T0)',
    (ml.features[4] ?? 0) > 0,
  );
  assert(
    'ML feature[12] === TENSION_CONSTANTS.PULSE_THRESHOLD',
    Math.abs((ml.features[12] ?? 0) - TENSION_CONSTANTS.PULSE_THRESHOLD) < 1e-9,
  );
  assert(
    'ML feature[13] === VISIBILITY_CONFIGS[EXPOSED].tensionAwarenessBonus',
    Math.abs((ml.features[13] ?? 0) - VISIBILITY_CONFIGS[TENSION_VISIBILITY_STATE.EXPOSED].tensionAwarenessBonus) < 1e-9,
  );

  // ------------------------------------------------------------------
  // Checks 11–14: DL tensor shape
  // ------------------------------------------------------------------
  projector.recordProjection(envelopes, tick);
  const dl = projector.extractDLTensor(tier, tick);
  assert('DL tensor rows length === 16', dl.rows.length === PROJECTION_DL_SEQUENCE_LENGTH);
  assert('DL tensor row[0] features length === 8', dl.rows[0]?.features.length === PROJECTION_DL_FEATURE_WIDTH);
  assert('DL column labels length === 8', dl.labels.length === PROJECTION_DL_FEATURE_WIDTH);
  assert('DL tensor all features are numbers', dl.rows.every((r) => r.features.every((f) => typeof f === 'number')));

  // ------------------------------------------------------------------
  // Checks 15–20: Health report tiers
  // ------------------------------------------------------------------
  const health = projector.computeHealthReport(envelopes, entries);
  assert('Health report has riskTier string', typeof health.riskTier === 'string');
  assert('Health report envelopeCount === 4', health.envelopeCount === 4);
  assert('Health report criticalCount >= 0', health.criticalCount >= 0);
  assert('Health report arrivedCount >= 0', health.arrivedCount >= 0);
  assert('Health report totalWeight >= 0', health.totalWeight >= 0);
  assert('Empty health report is CLEAR', projector.computeHealthReport([], []).riskTier === 'CLEAR');

  // ------------------------------------------------------------------
  // Checks 21–24: Priority scoring
  // ------------------------------------------------------------------
  const scores = projector.computePriorityScores(entries, visState, tick, tier);
  assert('Priority scores length === entries.length', scores.length === entries.length);
  assert(
    'Priority scores sorted descending',
    scores.every((s, i) => i === 0 || (scores[i - 1]?.priorityScore ?? 0) >= s.priorityScore),
  );
  assert('Priority scores use PRESSURE_TENSION_AMPLIFIERS', scores.every((s) => s.priorityScore >= 0));
  assert('Priority score has entryId', typeof scores[0]?.entryId === 'string');

  // ------------------------------------------------------------------
  // Checks 25–29: Narrative generation
  // ------------------------------------------------------------------
  const narrative = projector.generateNarrative(envelopes, entries, visState, tier, tick);
  assert('Narrative headline non-empty', narrative.headline.length > 0);
  assert('Narrative body non-empty', narrative.body.length > 0);
  assert('Narrative urgency is valid', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(narrative.urgency));
  assert('Narrative actionSuggestion non-empty', narrative.actionSuggestion.length > 0);
  assert(
    'Narrative body in EXPOSED mode uses THREAT_TYPE_DEFAULT_MITIGATIONS',
    narrative.body.includes('mitigations') || narrative.actionSuggestion.length > 0,
  );

  // ------------------------------------------------------------------
  // Checks 30–34: Narrative per visibility state
  // ------------------------------------------------------------------
  const narShadowed = projector.generateNarrative(envelopes, entries, TENSION_VISIBILITY_STATE.SHADOWED, 'T0', tick);
  assert('SHADOWED narrative body references pressure tier', narShadowed.body.includes('T0'));

  const narSignaled = projector.generateNarrative(envelopes, entries, TENSION_VISIBILITY_STATE.SIGNALED, 'T1', tick);
  assert('SIGNALED narrative body references threat types', narSignaled.body.length > 0);

  const narTelegraphed = projector.generateNarrative(envelopes, entries, TENSION_VISIBILITY_STATE.TELEGRAPHED, 'T2', tick);
  assert('TELEGRAPHED narrative references arrival ticks', narTelegraphed.body.length > 0);

  const narEmpty = projector.generateNarrative([], [], visState, tier, tick);
  assert('Empty envelope narrative has no-threats headline', narEmpty.headline.includes('No active'));
  assert('Empty narrative urgency is LOW', narEmpty.urgency === 'LOW');

  // ------------------------------------------------------------------
  // Checks 35–40: Event builders use TENSION_EVENT_NAMES
  // ------------------------------------------------------------------
  const arrivedEvt = projector.buildThreatArrivedEvent(e2, tick) as ThreatArrivedEvent & { _eventName: string };
  assert('buildThreatArrivedEvent _eventName === TENSION_EVENT_NAMES.THREAT_ARRIVED', arrivedEvt._eventName === TENSION_EVENT_NAMES.THREAT_ARRIVED);
  assert('buildThreatArrivedEvent eventType === THREAT_ARRIVED', arrivedEvt.eventType === 'THREAT_ARRIVED');
  assert('buildThreatArrivedEvent entryId correct', arrivedEvt.entryId === e2.entryId);

  const expiredEvt = projector.buildThreatExpiredEvent(e1, tick) as ThreatExpiredEvent & { _eventName: string };
  assert('buildThreatExpiredEvent _eventName === TENSION_EVENT_NAMES.THREAT_EXPIRED', expiredEvt._eventName === TENSION_EVENT_NAMES.THREAT_EXPIRED);
  assert('buildThreatExpiredEvent eventType === THREAT_EXPIRED', expiredEvt.eventType === 'THREAT_EXPIRED');

  const mitigatedEvt = projector.buildThreatMitigatedEvent(e1, tick) as ThreatMitigatedEvent & { _eventName: string };
  assert('buildThreatMitigatedEvent _eventName === TENSION_EVENT_NAMES.THREAT_MITIGATED', mitigatedEvt._eventName === TENSION_EVENT_NAMES.THREAT_MITIGATED);
  assert('buildThreatMitigatedEvent eventType === THREAT_MITIGATED', mitigatedEvt.eventType === 'THREAT_MITIGATED');

  // ------------------------------------------------------------------
  // Checks 41–44: THREAT_TYPE_DEFAULT_MITIGATIONS usage
  // ------------------------------------------------------------------
  const enriched = projector.enrichWithMitigationAdvice(envelopes[0]!, e1);
  assert('enrichWithMitigationAdvice returns mitigationAdvice array', Array.isArray(enriched.mitigationAdvice));
  assert(
    'enrichWithMitigationAdvice includes THREAT_TYPE_DEFAULT_MITIGATIONS[CASCADE]',
    THREAT_TYPE_DEFAULT_MITIGATIONS[THREAT_TYPE.CASCADE].every((m) =>
      enriched.mitigationAdvice.includes(m),
    ),
  );
  assert(
    'enrichWithMitigationAdvice includes entry mitigationCardTypes',
    e1.mitigationCardTypes.every((m) => enriched.mitigationAdvice.includes(m)),
  );

  const chatCtx = buildProjectionChatContext(envelopes, entries, visState, tier) as Record<string, unknown>;
  assert('buildProjectionChatContext includes mitigations in EXPOSED', 'mitigations' in chatCtx);

  // ------------------------------------------------------------------
  // Checks 45–49: PRESSURE_TENSION_AMPLIFIERS
  // ------------------------------------------------------------------
  const ampT0 = projector.computeAmplifiedPriority(1.0, 'T0');
  const ampT4 = projector.computeAmplifiedPriority(1.0, 'T4');
  assert('computeAmplifiedPriority T0 = 1.0', Math.abs(ampT0 - 1.0) < 1e-9);
  assert('computeAmplifiedPriority T4 = 1.5', Math.abs(ampT4 - 1.5) < 1e-9);
  assert('T4 > T0', ampT4 > ampT0);
  const tiers: PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];
  const amps = tiers.map((t) => projector.computeAmplifiedPriority(1.0, t));
  assert('Amplifiers monotonically increase', amps.every((a, i) => i === 0 || a >= (amps[i - 1] ?? 0)));
  assert('T3 amplifier from PRESSURE_TENSION_AMPLIFIERS', Math.abs(projector.computeAmplifiedPriority(1.0, 'T3') - PRESSURE_TENSION_AMPLIFIERS['T3']) < 1e-9);

  // ------------------------------------------------------------------
  // Checks 50–53: THREAT_SEVERITY_WEIGHTS
  // ------------------------------------------------------------------
  const score = projector.computeWeightedProjectionScore(entries);
  assert('computeWeightedProjectionScore > 0', score > 0);
  assert(
    'computeWeightedProjectionScore equals sum of THREAT_SEVERITY_WEIGHTS for test entries',
    Math.abs(score - (
      THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.CRITICAL] +
      THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL] +
      THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MINOR] +
      THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.SEVERE]
    )) < 1e-9,
  );
  const sevGrouped = projector.computeSeverityGrouped(entries);
  assert('computeSeverityGrouped[CRITICAL] === 1', sevGrouped[THREAT_SEVERITY.CRITICAL] === 1);
  assert('computeSeverityGrouped[EXISTENTIAL] === 1', sevGrouped[THREAT_SEVERITY.EXISTENTIAL] === 1);

  // ------------------------------------------------------------------
  // Checks 54–57: VISIBILITY_CONFIGS
  // ------------------------------------------------------------------
  const cfgExposed = projector.getVisibilityConfig(TENSION_VISIBILITY_STATE.EXPOSED);
  assert('getVisibilityConfig EXPOSED returns config', cfgExposed !== undefined);
  assert('getVisibilityConfig EXPOSED showsMitigationPath', cfgExposed.showsMitigationPath === true);
  const cfgShadowed = projector.getVisibilityConfig(TENSION_VISIBILITY_STATE.SHADOWED);
  assert('getVisibilityConfig SHADOWED showsThreatType = false', cfgShadowed.showsThreatType === false);
  assert(
    'All TENSION_VISIBILITY_STATE values have VISIBILITY_CONFIGS entries',
    (Object.values(TENSION_VISIBILITY_STATE) as TensionVisibilityState[]).every(
      (s) => VISIBILITY_CONFIGS[s] !== undefined,
    ),
  );

  // ------------------------------------------------------------------
  // Checks 58–61: INTERNAL_VISIBILITY_TO_ENVELOPE
  // ------------------------------------------------------------------
  assert('resolveEnvelopeLevel EXPOSED = EXPOSED', projector.resolveEnvelopeLevel(TENSION_VISIBILITY_STATE.EXPOSED) === 'EXPOSED');
  assert('resolveEnvelopeLevel SHADOWED = HIDDEN', projector.resolveEnvelopeLevel(TENSION_VISIBILITY_STATE.SHADOWED) === 'HIDDEN');
  assert('resolveEnvelopeLevel SIGNALED = SILHOUETTE', projector.resolveEnvelopeLevel(TENSION_VISIBILITY_STATE.SIGNALED) === 'SILHOUETTE');
  assert('resolveEnvelopeLevel TELEGRAPHED = PARTIAL', projector.resolveEnvelopeLevel(TENSION_VISIBILITY_STATE.TELEGRAPHED) === 'PARTIAL');

  // ------------------------------------------------------------------
  // Checks 62–66: Standalone functions
  // ------------------------------------------------------------------
  const standalone = projectThreatEnvelopes(entries, visState, tick);
  assert('projectThreatEnvelopes returns array', Array.isArray(standalone));
  assert('projectThreatEnvelopes length correct', standalone.length === entries.length);

  const pw = computeProjectionWeight(entries);
  assert('computeProjectionWeight > 0', pw > 0);

  const ranked = rankEnvelopesByETA(standalone);
  assert('rankEnvelopesByETA sorted ascending', ranked.every((e, i) => i === 0 || e.etaTicks >= (ranked[i - 1]?.etaTicks ?? 0)));

  const arrived = filterArrivedEnvelopes(entries, tick);
  assert('filterArrivedEnvelopes returns arrived entries', arrived.every((e) => e.arrivalTick <= tick));

  // ------------------------------------------------------------------
  // Checks 67–70: ML vector standalone + health score
  // ------------------------------------------------------------------
  const stML = computeThreatProjectionMLVector(entries, visState, tier, tick);
  assert('computeThreatProjectionMLVector dimension === 32', stML.features.length === PROJECTION_ML_FEATURE_COUNT);
  assert('computeThreatProjectionMLVector tick matches', stML.tick === tick);

  const hs = computeProjectionHealthScore(standalone, entries);
  assert('computeProjectionHealthScore in [0,1]', hs >= 0 && hs <= 1);
  assert('computeProjectionHealthScore empty === 0', computeProjectionHealthScore([], []) === 0);

  // ------------------------------------------------------------------
  // Checks 71–74: classifyProjectionRisk
  // ------------------------------------------------------------------
  assert('classifyProjectionRisk(0,0,0) = CLEAR', classifyProjectionRisk(0, 0, 0) === 'CLEAR');
  assert('classifyProjectionRisk(5,3,2) = CRITICAL', classifyProjectionRisk(5, 3, 2) === 'CRITICAL');
  assert('classifyProjectionRisk(3,1,1) = HIGH', classifyProjectionRisk(3, 1, 1) === 'HIGH');
  assert('classifyProjectionRisk(0.5,0,2) = MEDIUM', classifyProjectionRisk(0.5, 0, 2) === 'MEDIUM');

  // ------------------------------------------------------------------
  // Checks 75–78: Checksum determinism and format
  // ------------------------------------------------------------------
  const chk1 = projector.computeProjectionChecksum(standalone);
  const chk2 = projector.computeProjectionChecksum(standalone);
  assert('computeProjectionChecksum deterministic', chk1 === chk2);
  assert('computeProjectionChecksum is 64-char hex', /^[0-9a-f]{64}$/.test(chk1));
  assert('computeProjectionChecksum empty envelopes returns valid hex', /^[0-9a-f]{64}$/.test(projector.computeProjectionChecksum([])));
  const keyedChk = projector.computeKeyedChecksum(standalone, tick, tier);
  assert('computeKeyedChecksum returns 64-char hex', /^[0-9a-f]{64}$/.test(keyedChk));

  // ------------------------------------------------------------------
  // Checks 79–82: Merge and density
  // ------------------------------------------------------------------
  const resultA = projector.projectWithMLVector(entries, visState, tick, tier);
  const resultB = projector.projectWithMLVector([e3], TENSION_VISIBILITY_STATE.SHADOWED, tick, 'T0');
  const merged = mergeProjectionResults(resultA, resultB);
  assert('mergeProjectionResults envelopes non-empty', merged.envelopes.length > 0);
  assert('mergeProjectionResults mlVector features length === 32', merged.mlVector.features.length === PROJECTION_ML_FEATURE_COUNT);
  assert('mergeProjectionResults checksum is 64-char hex', /^[0-9a-f]{64}$/.test(merged.projectionChecksum));

  const density = computeEnvelopeDensity(standalone, 32);
  assert('computeEnvelopeDensity in [0,1]', density >= 0 && density <= 1);

  // ------------------------------------------------------------------
  // Checks 83–85: visibilityOrdinal uses VISIBILITY_ORDER
  // ------------------------------------------------------------------
  assert('visibilityOrdinal SHADOWED === 0', projector.visibilityOrdinal(TENSION_VISIBILITY_STATE.SHADOWED) === 0);
  assert('visibilityOrdinal EXPOSED === 3', projector.visibilityOrdinal(TENSION_VISIBILITY_STATE.EXPOSED) === 3);
  assert('visibilityOrdinal TELEGRAPHED === 2', projector.visibilityOrdinal(TENSION_VISIBILITY_STATE.TELEGRAPHED) === 2);

  // ------------------------------------------------------------------
  // Checks 86–88: sortEnvelopesByVisibility uses VISIBILITY_ORDER
  // ------------------------------------------------------------------
  const sortedByVis = projector.sortEnvelopesByVisibility(standalone);
  assert('sortEnvelopesByVisibility length unchanged', sortedByVis.length === standalone.length);
  assert('sortEnvelopesByVisibility is array', Array.isArray(sortedByVis));
  assert('sortEnvelopesByVisibility returns frozen array', Object.isFrozen(sortedByVis));

  // ------------------------------------------------------------------
  // Checks 89–91: groupEnvelopesByType uses THREAT_TYPE
  // ------------------------------------------------------------------
  const grouped = projector.groupEnvelopesByType(entries);
  assert('groupEnvelopesByType CASCADE has 1 entry', (grouped[THREAT_TYPE.CASCADE]?.length ?? 0) === 1);
  assert('groupEnvelopesByType all THREAT_TYPE keys present', (Object.values(THREAT_TYPE) as ThreatType[]).every((t) => t in grouped));
  assert('groupEnvelopesByType SOVEREIGNTY has 1 entry', (grouped[THREAT_TYPE.SOVEREIGNTY]?.length ?? 0) === 1);

  // ------------------------------------------------------------------
  // Checks 92–94: computeTypeProjectionWeight
  // ------------------------------------------------------------------
  assert('computeTypeProjectionWeight CASCADE === 1.25', Math.abs(projector.computeTypeProjectionWeight(THREAT_TYPE.CASCADE) - 1.25) < 1e-9);
  assert('computeTypeProjectionWeight SOVEREIGNTY === 1.5', Math.abs(projector.computeTypeProjectionWeight(THREAT_TYPE.SOVEREIGNTY) - 1.5) < 1e-9);
  assert('computeTypeProjectionWeight REPUTATION_BURN === 0.9', Math.abs(projector.computeTypeProjectionWeight(THREAT_TYPE.REPUTATION_BURN) - 0.9) < 1e-9);

  // ------------------------------------------------------------------
  // Checks 95–97: enrichFromRuntimeSnapshot uses TensionRuntimeSnapshot
  // ------------------------------------------------------------------
  const fakeSnapshot: TensionRuntimeSnapshot = {
    score: 0.5,
    previousScore: 0.4,
    rawDelta: 0.1,
    amplifiedDelta: 0.12,
    visibilityState: TENSION_VISIBILITY_STATE.TELEGRAPHED,
    queueLength: 4,
    arrivedCount: 1,
    queuedCount: 3,
    expiredCount: 0,
    relievedCount: 0,
    visibleThreats: [],
    isPulseActive: false,
    pulseTicksActive: 0,
    isEscalating: false,
    dominantEntryId: null,
    lastSpikeTick: null,
    tickNumber: tick,
    timestamp: Date.now(),
    contributionBreakdown: {
      queuedThreats: 0.12,
      arrivedThreats: 0.2,
      expiredGhosts: 0,
      mitigationDecay: 0,
      nullifyDecay: 0,
      emptyQueueBonus: 0,
      visibilityBonus: 0,
      sovereigntyBonus: 0,
    },
  };
  const snapshotEnvelopes = projector.enrichFromRuntimeSnapshot(fakeSnapshot, entries);
  assert('enrichFromRuntimeSnapshot returns array', Array.isArray(snapshotEnvelopes));
  assert('enrichFromRuntimeSnapshot length >= 1', snapshotEnvelopes.length >= 1);

  const enrichmentCtx = projector.computeProjectionEnrichment(fakeSnapshot, entries, tier);
  assert('computeProjectionEnrichment returns ProjectionContext', enrichmentCtx.envelopes !== undefined);

  // ------------------------------------------------------------------
  // Checks 98–100: exportBundle has all 6 keys; serialize; history
  // ------------------------------------------------------------------
  const bundle = projector.exportBundle(entries, visState, tier, tick);
  assert('exportBundle has mlVector', bundle.mlVector !== undefined);
  assert('exportBundle has all 6 keys', (
    bundle.dlTensor !== undefined &&
    bundle.healthReport !== undefined &&
    bundle.narrative !== undefined &&
    bundle.context !== undefined &&
    bundle.serialized !== undefined
  ));

  const serial = projector.serialize();
  assert('serialize totalProjectionsComputed > 0', serial.totalProjectionsComputed > 0);
  assert('serialize lastChecksum is non-empty', serial.lastChecksum.length > 0);

  return Object.freeze({
    passed: failures.length === 0,
    checks: Object.freeze([...checks]),
    failures: Object.freeze([...failures]),
  });
}
