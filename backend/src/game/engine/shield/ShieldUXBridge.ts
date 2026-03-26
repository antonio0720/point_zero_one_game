/*
 * POINT ZERO ONE — BACKEND SHIELD UX BRIDGE
 * /backend/src/game/engine/shield/ShieldUXBridge.ts
 *
 * Doctrine:
 * - bus-owned shield emits live here
 * - richer shield diagnostics that do not fit EngineEventMap are returned
 *   as EngineSignal values, not ad-hoc untyped bus events
 * - this bridge keeps ShieldEngine orchestration lean and readable
 * - UX state machine tracks shield experience trajectory for player feedback
 * - narrative engine produces player-facing text for shield events
 * - analytics surface provides signal scoring, deduplication, and throttling
 * - ML/DL feature extraction feeds downstream inference pipelines
 *
 * Surface summary:
 *   S 1  — Core Signal Generation (expanded from original)
 *   S 2  — Shield UX State Machine
 *   S 3  — Shield Narrative Engine
 *   S 4  — Shield UX Analytics
 *   S 5  — Shield ML/DL Signal Features
 *   S 6  — Shield Bus Integration (expanded)
 *   S 7  — Shield UX Scoring
 *   S 8  — Cross-Engine Snapshot Analysis
 *   S 9  — Mode-Aware Shield UX
 *   S 10 — Phase-Aware Shield UX
 *   S 11 — Bot Threat UX Correlation
 *   S 12 — Extended Cross-Engine ML/DL Features
 *   S 13 — UX Decision Support Engine
 */

import {
  createEngineSignal,
  type EngineSignal,
} from '../core/EngineContracts';
import type { EventBus } from '../core/EventBus';
import {
  MODE_DIFFICULTY_MULTIPLIER,
  PRESSURE_TIER_NORMALIZED,
  RUN_PHASE_STAKES_MULTIPLIER,
  BOT_THREAT_LEVEL,
  BOT_STATE_THREAT_MULTIPLIER,
  ATTACK_CATEGORY_BASE_MAGNITUDE,
  PRESSURE_TIER_URGENCY_LABEL,
  MODE_TENSION_FLOOR,
  RUN_PHASE_TICK_BUDGET_FRACTION,
  ATTACK_CATEGORY_IS_COUNTERABLE,
  type EngineEventMap,
  type ShieldLayerId,
  type ModeCode,
  type PressureTier,
  type RunPhase,
  type HaterBotId,
  type BotState,
  type AttackCategory,
  type RunOutcome,
} from '../core/GamePrimitives';
import type { RunStateSnapshot, ShieldLayerState } from '../core/RunStateSnapshot';
import {
  getLayerConfig,
  SHIELD_CONSTANTS,
  SHIELD_LAYER_ORDER,
  SHIELD_LAYER_CONFIGS,
  ATTACK_CATEGORY_DOCTRINE_MAP,
  ATTACK_CATEGORY_SEVERITY_WEIGHT,
  LAYER_HEALTH_WEIGHT,
  computeWeightedIntegrity,
  computeLayerDangerLevel,
  computeGradeFromScore,
  scoreDefensivePosture,
  type QueueRejection,
  type RepairLayerId,
  type ShieldDoctrineAttackType,
  type ShieldHealthGrade,
  type LayerDangerLevel,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Internal constants
// ─────────────────────────────────────────────────────────────────────────────

const LAYER_ORDER: readonly ShieldLayerId[] = ['L1', 'L2', 'L3', 'L4'] as const;

const LAYER_DEPTH_WEIGHT: Readonly<Record<ShieldLayerId, number>> = {
  L1: 1.0,
  L2: 0.85,
  L3: 0.70,
  L4: 0.55,
};

const SIGNAL_THROTTLE_WINDOW_TICKS = 5;
const RAPID_DAMAGE_WINDOW_TICKS = 3;
const RAPID_DAMAGE_EVENT_THRESHOLD = 2;
const SUSTAINED_BREACH_TICK_THRESHOLD = 10;
const RECOVERY_SURGE_RATIO_DELTA = 0.25;
const SIGNAL_FREQUENCY_OVERLOAD_THRESHOLD = 12;
const SIGNAL_FREQUENCY_HEALTHY_CEILING = 6;
const UX_SCORE_PERFECT = 100;
const UX_SCORE_FLOOR = 0;
const ML_FEATURE_DIMENSION = 32;
const DL_SEQUENCE_LENGTH = 16;
const DL_FEATURE_DEPTH = 8;

// ─────────────────────────────────────────────────────────────────────────────
// Internal types
// ─────────────────────────────────────────────────────────────────────────────

/** UX-level shield state used for trajectory tracking. */
interface ShieldUXSnapshot {
  readonly tick: number;
  readonly layerStates: readonly ShieldLayerState[];
  readonly overallIntegrity: number;
  readonly breachedCount: number;
  readonly weakestLayerId: ShieldLayerId;
  readonly weakestRatio: number;
  readonly fortified: boolean;
  readonly cascadeActive: boolean;
}

/** A recorded UX event for analytics and deduplication. */
interface UXSignalRecord {
  readonly signalCode: string;
  readonly tick: number;
  readonly layerId: ShieldLayerId | 'ALL' | null;
  readonly severity: 'INFO' | 'WARN' | 'ERROR';
}

/** Detected UX-relevant pattern from state trajectory analysis. */
interface UXPattern {
  readonly patternType:
    | 'RAPID_DAMAGE'
    | 'SUSTAINED_BREACH'
    | 'RECOVERY_SURGE'
    | 'FULL_COLLAPSE'
    | 'FORTIFICATION_CLIMB'
    | 'OSCILLATING_BREACH'
    | 'CASCADE_SPIRAL'
    | 'SINGLE_LAYER_FOCUS';
  readonly detectedAtTick: number;
  readonly affectedLayers: readonly ShieldLayerId[];
  readonly severity: 'INFO' | 'WARN' | 'ERROR';
  readonly metadata: Record<string, number | string | boolean>;
}

/** Narrative context describing what the player should perceive. */
interface NarrativeContext {
  readonly headline: string;
  readonly detail: string;
  readonly urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly layerId: ShieldLayerId | null;
  readonly tick: number;
  readonly narrativeType:
    | 'ATTACK'
    | 'BREACH'
    | 'RECOVERY'
    | 'WARNING'
    | 'ACHIEVEMENT'
    | 'CASCADE'
    | 'REPAIR'
    | 'STATUS';
}

/** Layer health report for UX display. */
interface LayerHealthReport {
  readonly layerId: ShieldLayerId;
  readonly doctrineName: string;
  readonly current: number;
  readonly max: number;
  readonly integrityRatio: number;
  readonly healthGrade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  readonly breached: boolean;
  readonly regenPerTick: number;
  readonly ticksToFull: number | null;
  readonly ticksToBreach: number | null;
  readonly riskLevel: 'SAFE' | 'GUARDED' | 'ELEVATED' | 'HIGH' | 'SEVERE';
  readonly cascadeGate: boolean;
}

/** Overall shield grade for the player dashboard. */
interface ShieldGradeReport {
  readonly overallGrade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  readonly overallScore: number;
  readonly layerReports: readonly LayerHealthReport[];
  readonly breachedLayerCount: number;
  readonly fortified: boolean;
  readonly fortificationProgress: number;
  readonly recoveryProgress: number;
  readonly tick: number;
  readonly signalLoad: number;
}

/** ML feature vector extracted from UX signal history. */
interface ShieldMLFeatureVector {
  readonly tick: number;
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly dimension: number;
}

/** DL tensor data extracted from signal sequences. */
interface ShieldDLTensor {
  readonly tick: number;
  readonly sequenceLength: number;
  readonly featureDepth: number;
  readonly data: readonly (readonly number[])[];
  readonly labels: readonly string[];
}

/** Trend analysis result from signal pattern inspection. */
interface SignalTrendAnalysis {
  readonly tick: number;
  readonly windowSize: number;
  readonly signalFrequency: number;
  readonly dominantSeverity: 'INFO' | 'WARN' | 'ERROR';
  readonly dominantLayerId: ShieldLayerId | null;
  readonly trendDirection: 'IMPROVING' | 'STABLE' | 'DEGRADING';
  readonly breachTrend: 'INCREASING' | 'STABLE' | 'DECREASING';
  readonly integritySlope: number;
  readonly volatility: number;
  readonly riskScore: number;
}

/** Batched bus event entry for tick-level coordination. */
interface BusEventBatch {
  readonly tick: number;
  readonly events: readonly BusEventEntry[];
  readonly signalCount: number;
}

interface BusEventEntry {
  readonly eventName: string;
  readonly payload: Record<string, unknown>;
  readonly tags: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// ML feature labels
// ─────────────────────────────────────────────────────────────────────────────

const SHIELD_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  'overall_integrity',                // 0
  'l1_integrity_ratio',               // 1
  'l2_integrity_ratio',               // 2
  'l3_integrity_ratio',               // 3
  'l4_integrity_ratio',               // 4
  'breached_layer_count',             // 5
  'weakest_layer_ratio',              // 6
  'weakest_layer_index',              // 7
  'fortified_flag',                   // 8
  'cascade_active_flag',              // 9
  'signal_frequency_recent',          // 10
  'warn_signal_ratio',                // 11
  'error_signal_ratio',               // 12
  'info_signal_ratio',                // 13
  'rapid_damage_detected',            // 14
  'sustained_breach_detected',        // 15
  'recovery_surge_detected',          // 16
  'integrity_slope',                  // 17
  'volatility_score',                 // 18
  'ux_experience_score',              // 19
  'signal_overload_flag',             // 20
  'fortification_progress',           // 21
  'recovery_progress',                // 22
  'l1_regen_rate',                    // 23
  'l2_regen_rate',                    // 24
  'l3_regen_rate',                    // 25
  'l4_regen_rate',                    // 26
  'time_since_last_breach',           // 27
  'breach_frequency',                 // 28
  'cascade_gate_integrity',           // 29
  'layer_variance',                   // 30
  'weighted_shield_health',           // 31
]);

const DL_FEATURE_LABELS: readonly string[] = Object.freeze([
  'integrity_ratio',
  'breached_flag',
  'signal_severity_encoded',
  'signal_frequency',
  'pattern_type_encoded',
  'recovery_delta',
  'damage_delta',
  'cascade_proximity',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Narrative tables — per-layer contextual text
// ─────────────────────────────────────────────────────────────────────────────

const LAYER_ATTACK_NARRATIVES: Readonly<Record<ShieldLayerId, readonly string[]>> = {
  L1: [
    'Your emergency cash reserves are taking hits.',
    'Liquidity is draining under financial pressure.',
    'Your cash buffer is absorbing damage from unexpected costs.',
    'Emergency funds are being tested by incoming threats.',
  ],
  L2: [
    'Your credit line is under strain from debt pressure.',
    'Credit availability is shrinking under attack.',
    'Debt-based threats are wearing down your credit shield.',
    'Your borrowing capacity is being targeted.',
  ],
  L3: [
    'Your income base is being eroded by asset threats.',
    'Core assets are under attack, threatening future income.',
    'Your financial foundation is being stripped away.',
    'Income-generating assets are taking damage.',
  ],
  L4: [
    'Your professional network is under direct assault.',
    'Network connections are being severed by reputational attacks.',
    'The core of your financial network is under siege.',
    'Critical network relationships are being targeted.',
  ],
};

const LAYER_BREACH_NARRATIVES: Readonly<Record<ShieldLayerId, readonly string[]>> = {
  L1: [
    'Emergency cash reserves are gone. You have no liquidity buffer.',
    'Your cash shield has fallen. Financial shocks will hit harder.',
    'Liquidity buffer breached. Every expense now carries direct risk.',
  ],
  L2: [
    'Credit line breached. Debt pressure will escalate rapidly.',
    'Your credit shield has collapsed. Borrowing is no longer a safety net.',
    'Credit exhausted. Financial flexibility is severely limited.',
  ],
  L3: [
    'Asset floor breached. Your income base is exposed.',
    'Core assets are unprotected. Income generation is at risk.',
    'The asset floor has crumbled. Opportunity loss is imminent.',
  ],
  L4: [
    'Network core breached. Cascade failure is imminent.',
    'Your entire financial network is exposed. Maximum severity reached.',
    'Network core has fallen. Brace for cascading consequences.',
  ],
};

const LAYER_RECOVERY_NARRATIVES: Readonly<Record<ShieldLayerId, readonly string[]>> = {
  L1: [
    'Cash reserves are rebuilding. Liquidity is returning.',
    'Your emergency fund is recovering. The buffer grows stronger.',
    'Liquidity buffer restored. You can absorb shocks again.',
  ],
  L2: [
    'Credit line is recovering. Borrowing capacity returns.',
    'Your credit shield is mending. Financial flexibility improves.',
    'Credit availability is being restored through active repair.',
  ],
  L3: [
    'Asset base is recovering. Income potential is returning.',
    'Core assets are being rebuilt. The floor is stabilizing.',
    'Your income foundation is strengthening through recovery.',
  ],
  L4: [
    'Network connections are being restored. Core stability improves.',
    'Your professional network is healing. Cascade risk decreases.',
    'Network core integrity is climbing. The worst may be over.',
  ],
};

const LAYER_CRITICAL_NARRATIVES: Readonly<Record<ShieldLayerId, readonly string[]>> = {
  L1: [
    'Cash reserves critically low. One more hit could breach.',
    'Liquidity buffer is nearly depleted. Extreme caution needed.',
  ],
  L2: [
    'Credit line critically low. Debt spiral risk is maximum.',
    'Your credit shield is paper-thin. Any attack could break through.',
  ],
  L3: [
    'Asset floor critically low. Income collapse is imminent.',
    'Core assets are nearly gone. Protect what remains.',
  ],
  L4: [
    'Network core critically low. Cascade breach is one hit away.',
    'The network is hanging by a thread. Total collapse approaches.',
  ],
};

const CASCADE_NARRATIVES: readonly string[] = [
  'A cascade event has been triggered. Multiple systems are failing.',
  'Network breach has unleashed a chain reaction across your defenses.',
  'Cascade failure in progress. Downstream consequences are spreading.',
  'The breach has cascaded. Prepare for compounding financial damage.',
];

const FORTIFIED_ENTER_NARRATIVES: readonly string[] = [
  'All shield layers fortified. Your defenses are at peak strength.',
  'Full fortification achieved. You are well-protected against threats.',
  'Shield matrix fully fortified. Deflection bonuses are active.',
  'Maximum defensive posture reached. Your financial fortress stands.',
];

const FORTIFIED_LOST_NARRATIVES: readonly string[] = [
  'Fortification lost. Shield strength has dropped below the threshold.',
  'Your defensive posture has weakened. Fortification bonuses are gone.',
  'The fortified state has been broken. Deflection strength is reduced.',
];

// ─────────────────────────────────────────────────────────────────────────────
// S 1 — Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function selectNarrative(pool: readonly string[], seed: number): string {
  return pool[Math.abs(seed) % pool.length]!;
}

function severityToNumeric(severity: 'INFO' | 'WARN' | 'ERROR'): number {
  if (severity === 'ERROR') return 3;
  if (severity === 'WARN') return 2;
  return 1;
}

function numericToSeverity(value: number): 'INFO' | 'WARN' | 'ERROR' {
  if (value >= 2.5) return 'ERROR';
  if (value >= 1.5) return 'WARN';
  return 'INFO';
}

function layerIdToIndex(layerId: ShieldLayerId): number {
  if (layerId === 'L1') return 0;
  if (layerId === 'L2') return 1;
  if (layerId === 'L3') return 2;
  return 3;
}

function computeLayerVariance(layers: readonly ShieldLayerState[]): number {
  if (layers.length === 0) return 0;
  const ratios = layers.map((l) => l.integrityRatio);
  const mean = ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
  const squaredDiffs = ratios.map((r) => (r - mean) * (r - mean));
  return squaredDiffs.reduce((sum, d) => sum + d, 0) / squaredDiffs.length;
}

function computeWeightedShieldHealth(layers: readonly ShieldLayerState[]): number {
  let totalWeighted = 0;
  let totalWeight = 0;

  for (const layer of layers) {
    const weight = LAYER_DEPTH_WEIGHT[layer.layerId] ?? 0.5;
    totalWeighted += layer.integrityRatio * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? totalWeighted / totalWeight : 0;
}

function gradeFromScore(score: number): 'S' | 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 0.95) return 'S';
  if (score >= 0.80) return 'A';
  if (score >= 0.60) return 'B';
  if (score >= 0.40) return 'C';
  if (score >= 0.20) return 'D';
  return 'F';
}

function riskFromRatio(ratio: number, cascadeGate: boolean): 'SAFE' | 'GUARDED' | 'ELEVATED' | 'HIGH' | 'SEVERE' {
  if (ratio <= 0) return 'SEVERE';
  if (ratio < SHIELD_CONSTANTS.CRITICAL_WARNING_THRESHOLD) {
    return cascadeGate ? 'SEVERE' : 'HIGH';
  }
  if (ratio < SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD) return 'ELEVATED';
  if (ratio < SHIELD_CONSTANTS.FORTIFIED_THRESHOLD) return 'GUARDED';
  return 'SAFE';
}

function estimateTicksToBreach(
  current: number,
  regenPerTick: number,
  recentDamageRate: number,
): number | null {
  const netRate = recentDamageRate - regenPerTick;
  if (netRate <= 0) return null;
  return Math.ceil(current / netRate);
}

function estimateTicksToFull(
  current: number,
  max: number,
  regenPerTick: number,
): number | null {
  if (current >= max) return 0;
  if (regenPerTick <= 0) return null;
  return Math.ceil((max - current) / regenPerTick);
}

// ─────────────────────────────────────────────────────────────────────────────
// S 1 — ShieldUXBridge class
// ─────────────────────────────────────────────────────────────────────────────

export class ShieldUXBridge {
  // ── State machine history ──────────────────────────────────────────────
  private readonly snapshotHistory: ShieldUXSnapshot[] = [];
  private readonly signalLog: UXSignalRecord[] = [];
  private readonly detectedPatterns: UXPattern[] = [];
  private readonly throttleMap: Map<string, number> = new Map();
  private readonly perLayerDamageLog: Map<ShieldLayerId, number[]> = new Map();

  // Session-level counters for analytics
  private sessionBreachCount = 0;
  private sessionRecoveryCount = 0;
  private sessionCascadeCount = 0;
  private sessionSignalCount = 0;
  private sessionStartTick: number | null = null;

  // ─────────────────────────────────────────────────────────────────────
  // S 1 — Core Signal Generation (preserved + expanded)
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Emit shield.breached bus event when a layer reaches zero HP.
   * This is the primary bus integration point for breach notification.
   */
  public emitLayerBreached(
    bus: EventBus<EngineEventMap & Record<string, unknown>>,
    payload: {
      readonly attackId: string;
      readonly layerId: ShieldLayerId;
      readonly tick: number;
      readonly cascadesTriggered: number;
    },
  ): void {
    bus.emit('shield.breached', {
      attackId: payload.attackId,
      layerId: payload.layerId,
      tick: payload.tick,
      cascadesTriggered: payload.cascadesTriggered,
    });

    this.sessionBreachCount++;
    this.recordSignal('SHIELD_LAYER_BREACHED', payload.tick, payload.layerId, 'ERROR');
  }

  /**
   * Build EngineSignals for all layer state transitions between two tick snapshots.
   * Detects: critical threshold crossings, low threshold crossings,
   * breach recovery, full repair, damage spikes, and regen stalls.
   */
  public buildTransitionSignals(
    previousLayers: readonly ShieldLayerState[],
    nextLayers: readonly ShieldLayerState[],
    tick: number,
  ): readonly EngineSignal[] {
    const previousById = new Map(
      previousLayers.map((layer) => [layer.layerId, layer]),
    );

    const signals: EngineSignal[] = [];

    for (const next of nextLayers) {
      const previous = previousById.get(next.layerId);
      if (previous === undefined) {
        continue;
      }

      const config = getLayerConfig(next.layerId);
      const layerName = config.doctrineName;

      // ── Newly breached (skip — handled by emitLayerBreached) ───────
      const newlyBreached = previous.current > 0 && next.current === 0;
      if (newlyBreached) {
        continue;
      }

      // ── Critical threshold crossing ────────────────────────────────
      const crossedCritical =
        previous.integrityRatio >= SHIELD_CONSTANTS.CRITICAL_WARNING_THRESHOLD &&
        next.integrityRatio < SHIELD_CONSTANTS.CRITICAL_WARNING_THRESHOLD &&
        next.current > 0;

      // ── Low threshold crossing ─────────────────────────────────────
      const crossedLow =
        previous.integrityRatio >= SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD &&
        next.integrityRatio < SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD &&
        next.current > 0;

      if (crossedCritical) {
        signals.push(
          createEngineSignal(
            'shield',
            'WARN',
            'SHIELD_LAYER_CRITICAL',
            `${layerName} dropped below critical threshold.`,
            tick,
            [`layer:${next.layerId}`, `ratio:${next.integrityRatio.toFixed(3)}`],
          ),
        );
        this.recordSignal('SHIELD_LAYER_CRITICAL', tick, next.layerId, 'WARN');
      } else if (crossedLow) {
        signals.push(
          createEngineSignal(
            'shield',
            'WARN',
            'SHIELD_LAYER_LOW',
            `${layerName} dropped below low-integrity threshold.`,
            tick,
            [`layer:${next.layerId}`, `ratio:${next.integrityRatio.toFixed(3)}`],
          ),
        );
        this.recordSignal('SHIELD_LAYER_LOW', tick, next.layerId, 'WARN');
      }

      // ── Restored from breach ───────────────────────────────────────
      const restoredFromBreach = previous.breached && !next.breached;
      if (restoredFromBreach) {
        signals.push(
          createEngineSignal(
            'shield',
            'INFO',
            'SHIELD_LAYER_RESTORED',
            `${layerName} was restored from breach.`,
            tick,
            [`layer:${next.layerId}`, `current:${String(next.current)}`],
          ),
        );
        this.sessionRecoveryCount++;
        this.recordSignal('SHIELD_LAYER_RESTORED', tick, next.layerId, 'INFO');
      }

      // ── Fully repaired ─────────────────────────────────────────────
      const fullyRepaired = previous.current < previous.max && next.current === next.max;
      if (fullyRepaired) {
        signals.push(
          createEngineSignal(
            'shield',
            'INFO',
            'SHIELD_LAYER_FULLY_REPAIRED',
            `${layerName} returned to full integrity.`,
            tick,
            [`layer:${next.layerId}`],
          ),
        );
        this.recordSignal('SHIELD_LAYER_FULLY_REPAIRED', tick, next.layerId, 'INFO');
      }

      // ── Crossed UP past low threshold (recovery milestone) ─────────
      const recoveredPastLow =
        previous.integrityRatio < SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD &&
        next.integrityRatio >= SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD &&
        !next.breached;

      if (recoveredPastLow) {
        signals.push(
          createEngineSignal(
            'shield',
            'INFO',
            'SHIELD_LAYER_RECOVERY_MILESTONE',
            `${layerName} recovered past low-integrity threshold.`,
            tick,
            [`layer:${next.layerId}`, `ratio:${next.integrityRatio.toFixed(3)}`],
          ),
        );
        this.recordSignal('SHIELD_LAYER_RECOVERY_MILESTONE', tick, next.layerId, 'INFO');
      }

      // ── Crossed UP past critical threshold (crisis averted) ────────
      const recoveredPastCritical =
        previous.integrityRatio < SHIELD_CONSTANTS.CRITICAL_WARNING_THRESHOLD &&
        next.integrityRatio >= SHIELD_CONSTANTS.CRITICAL_WARNING_THRESHOLD &&
        previous.integrityRatio > 0 &&
        !next.breached;

      if (recoveredPastCritical && !recoveredPastLow) {
        signals.push(
          createEngineSignal(
            'shield',
            'INFO',
            'SHIELD_LAYER_CRISIS_AVERTED',
            `${layerName} recovered past critical threshold.`,
            tick,
            [`layer:${next.layerId}`, `ratio:${next.integrityRatio.toFixed(3)}`],
          ),
        );
        this.recordSignal('SHIELD_LAYER_CRISIS_AVERTED', tick, next.layerId, 'INFO');
      }

      // ── Significant damage spike detection ─────────────────────────
      const damageTaken = previous.current - next.current;
      if (damageTaken > 0) {
        this.recordLayerDamage(next.layerId, tick);

        const damageRatio = config.max > 0 ? damageTaken / config.max : 0;
        if (damageRatio >= SHIELD_CONSTANTS.CASCADE_CRACK_RATIO) {
          signals.push(
            createEngineSignal(
              'shield',
              'WARN',
              'SHIELD_LAYER_HEAVY_HIT',
              `${layerName} absorbed a heavy hit (${(damageRatio * 100).toFixed(1)}% of max).`,
              tick,
              [
                `layer:${next.layerId}`,
                `damage:${String(damageTaken)}`,
                `ratio:${damageRatio.toFixed(3)}`,
              ],
            ),
          );
          this.recordSignal('SHIELD_LAYER_HEAVY_HIT', tick, next.layerId, 'WARN');
        }
      }

      // ── Regen stall detection (layer should be regenerating but isn't) ──
      if (
        previous.breached &&
        next.breached &&
        previous.current === 0 &&
        next.current === 0 &&
        config.breachedRegenRate > 0
      ) {
        if (!this.isThrottled('REGEN_STALL_' + next.layerId, tick)) {
          signals.push(
            createEngineSignal(
              'shield',
              'WARN',
              'SHIELD_LAYER_REGEN_STALL',
              `${layerName} regeneration appears stalled despite positive regen rate.`,
              tick,
              [`layer:${next.layerId}`, `regenRate:${String(config.breachedRegenRate)}`],
            ),
          );
          this.recordSignal('SHIELD_LAYER_REGEN_STALL', tick, next.layerId, 'WARN');
          this.markThrottled('REGEN_STALL_' + next.layerId, tick);
        }
      }

      // ── Cascade gate proximity warning (L4 specific) ───────────────
      if (config.cascadeGate && !next.breached) {
        const gateRatio = next.integrityRatio;
        if (
          gateRatio > 0 &&
          gateRatio <= SHIELD_CONSTANTS.CASCADE_CRACK_RATIO &&
          previous.integrityRatio > SHIELD_CONSTANTS.CASCADE_CRACK_RATIO
        ) {
          signals.push(
            createEngineSignal(
              'shield',
              'ERROR',
              'SHIELD_CASCADE_GATE_CRACKING',
              `${layerName} integrity has dropped to cascade-crack level. Breach will trigger cascade.`,
              tick,
              [`layer:${next.layerId}`, `ratio:${gateRatio.toFixed(3)}`],
            ),
          );
          this.recordSignal('SHIELD_CASCADE_GATE_CRACKING', tick, next.layerId, 'ERROR');
        }
      }
    }

    return Object.freeze(signals);
  }

  /**
   * Build fortified-state transition signals.
   * Fortified means all layers are above FORTIFIED_THRESHOLD.
   */
  public buildFortifiedSignals(
    wasFortified: boolean,
    isFortified: boolean,
    tick: number,
  ): readonly EngineSignal[] {
    if (!wasFortified && isFortified) {
      this.recordSignal('SHIELD_FORTIFIED_ENTERED', tick, null, 'INFO');
      return Object.freeze([
        createEngineSignal(
          'shield',
          'INFO',
          'SHIELD_FORTIFIED_ENTERED',
          'All shield layers are fortified above the integrity threshold.',
          tick,
          [`threshold:${SHIELD_CONSTANTS.FORTIFIED_THRESHOLD.toFixed(2)}`],
        ),
      ]);
    }

    if (wasFortified && !isFortified) {
      this.recordSignal('SHIELD_FORTIFIED_LOST', tick, null, 'WARN');
      return Object.freeze([
        createEngineSignal(
          'shield',
          'WARN',
          'SHIELD_FORTIFIED_LOST',
          'Fortified shield state was lost.',
          tick,
          [`threshold:${SHIELD_CONSTANTS.FORTIFIED_THRESHOLD.toFixed(2)}`],
        ),
      ]);
    }

    return Object.freeze([]);
  }

  /**
   * Build the cascade-trigger signal when L4 breach causes downstream cascade.
   */
  public buildCascadeSignal(
    templateId: string,
    chainId: string,
    tick: number,
  ): EngineSignal {
    this.sessionCascadeCount++;
    this.recordSignal('SHIELD_CASCADE_TRIGGERED', tick, 'L4' as ShieldLayerId, 'ERROR');

    return createEngineSignal(
      'shield',
      'ERROR',
      'SHIELD_CASCADE_TRIGGERED',
      `Network core breach triggered cascade template ${templateId}.`,
      tick,
      [`chain:${chainId}`, `template:${templateId}`],
    );
  }

  /**
   * Build signals for repair queue rejections (queue full).
   */
  public buildQueueRejectionSignals(
    rejections: readonly QueueRejection[],
  ): readonly EngineSignal[] {
    return Object.freeze(
      rejections.map((rejection: QueueRejection) => {
        const layerDesc = this.describeLayer(rejection.layerId);
        const repairId: RepairLayerId = rejection.layerId;
        const maxJobs = SHIELD_CONSTANTS.MAX_ACTIVE_REPAIR_JOBS_PER_LAYER;

        this.recordSignal(
          'SHIELD_REPAIR_QUEUE_FULL',
          rejection.tick,
          repairId === 'ALL' ? null : repairId as ShieldLayerId,
          'WARN',
        );

        return createEngineSignal(
          'shield',
          'WARN',
          'SHIELD_REPAIR_QUEUE_FULL',
          `Repair queue rejected ${rejection.amount} point(s) for ${layerDesc} (max ${maxJobs} active jobs).`,
          rejection.tick,
          [
            `layer:${rejection.layerId}`,
            `amount:${String(rejection.amount)}`,
            `duration:${String(rejection.durationTicks)}`,
            `source:${rejection.source}`,
          ],
        );
      }),
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // S 1 — Additional signal builders
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Build signals when damage is deflected (partial or full).
   */
  public buildDeflectionSignals(
    layerId: ShieldLayerId,
    deflectionApplied: number,
    rawDamage: number,
    fortified: boolean,
    tick: number,
  ): readonly EngineSignal[] {
    const signals: EngineSignal[] = [];
    const config = getLayerConfig(layerId);

    if (deflectionApplied <= 0) {
      return Object.freeze(signals);
    }

    const deflectionRatio = rawDamage > 0 ? deflectionApplied / rawDamage : 0;

    // Full deflection — damage completely blocked
    if (deflectionRatio >= SHIELD_CONSTANTS.DEFLECTION_FULL_INTEGRITY) {
      signals.push(
        createEngineSignal(
          'shield',
          'INFO',
          'SHIELD_DEFLECTION_FULL',
          `${config.doctrineName} fully deflected incoming damage.`,
          tick,
          [
            `layer:${layerId}`,
            `deflected:${String(deflectionApplied)}`,
            `raw:${String(rawDamage)}`,
          ],
        ),
      );
      this.recordSignal('SHIELD_DEFLECTION_FULL', tick, layerId, 'INFO');
    }

    // Fortified bonus deflection
    if (fortified && deflectionRatio >= SHIELD_CONSTANTS.FORTIFIED_BONUS_DEFLECT) {
      signals.push(
        createEngineSignal(
          'shield',
          'INFO',
          'SHIELD_FORTIFIED_DEFLECTION',
          `Fortified bonus increased ${config.doctrineName} deflection to ${(deflectionRatio * 100).toFixed(1)}%.`,
          tick,
          [
            `layer:${layerId}`,
            `bonusRate:${SHIELD_CONSTANTS.FORTIFIED_BONUS_DEFLECT.toFixed(2)}`,
            `deflectionMax:${SHIELD_CONSTANTS.DEFLECTION_MAX.toFixed(2)}`,
          ],
        ),
      );
      this.recordSignal('SHIELD_FORTIFIED_DEFLECTION', tick, layerId, 'INFO');
    }

    return Object.freeze(signals);
  }

  /**
   * Build a signal when a repair job completes on a specific layer.
   */
  public buildRepairCompletedSignal(
    layerId: RepairLayerId,
    amountDelivered: number,
    source: 'CARD' | 'SYSTEM' | 'ADMIN',
    tick: number,
  ): EngineSignal {
    const layerDesc = this.describeLayer(layerId);

    this.recordSignal(
      'SHIELD_REPAIR_COMPLETED',
      tick,
      layerId === 'ALL' ? null : layerId as ShieldLayerId,
      'INFO',
    );

    return createEngineSignal(
      'shield',
      'INFO',
      'SHIELD_REPAIR_COMPLETED',
      `Repair job delivered ${amountDelivered} point(s) to ${layerDesc} (source: ${source}).`,
      tick,
      [
        `layer:${layerId}`,
        `amount:${String(amountDelivered)}`,
        `source:${source}`,
      ],
    );
  }

  /**
   * Build a signal when all layers are simultaneously breached.
   */
  public buildTotalCollapseSignal(
    layers: readonly ShieldLayerState[],
    tick: number,
  ): EngineSignal | null {
    const allBreached = layers.every(
      (layer: ShieldLayerState) => layer.breached,
    );

    if (!allBreached || layers.length === 0) {
      return null;
    }

    // Verify every layer in the canonical order is present and breached
    for (const id of LAYER_ORDER) {
      const found = layers.find(
        (l: ShieldLayerState) => l.layerId === id,
      );
      if (!found || !found.breached) {
        return null;
      }
    }

    this.recordSignal('SHIELD_TOTAL_COLLAPSE', tick, null, 'ERROR');

    return createEngineSignal(
      'shield',
      'ERROR',
      'SHIELD_TOTAL_COLLAPSE',
      'All shield layers have been breached. Total collapse.',
      tick,
      ['severity:TOTAL', `layers:${layers.length}`],
    );
  }

  /**
   * Build signals for per-layer damage-rate analysis.
   * Examines recent damage events per layer and flags rapid damage patterns.
   */
  public buildDamageRateSignals(
    tick: number,
  ): readonly EngineSignal[] {
    const signals: EngineSignal[] = [];

    for (const layerId of LAYER_ORDER) {
      const damageLog = this.perLayerDamageLog.get(layerId);
      if (!damageLog || damageLog.length === 0) continue;

      const config = getLayerConfig(layerId);
      const recentDamageEvents = damageLog.filter(
        (t: number) => tick - t <= RAPID_DAMAGE_WINDOW_TICKS,
      );

      if (recentDamageEvents.length >= RAPID_DAMAGE_EVENT_THRESHOLD) {
        if (!this.isThrottled('RAPID_DAMAGE_' + layerId, tick)) {
          signals.push(
            createEngineSignal(
              'shield',
              'WARN',
              'SHIELD_RAPID_DAMAGE',
              `${config.doctrineName} is taking rapid damage (${recentDamageEvents.length} hits in ${RAPID_DAMAGE_WINDOW_TICKS} ticks).`,
              tick,
              [
                `layer:${layerId}`,
                `hits:${String(recentDamageEvents.length)}`,
                `window:${String(RAPID_DAMAGE_WINDOW_TICKS)}`,
              ],
            ),
          );
          this.recordSignal('SHIELD_RAPID_DAMAGE', tick, layerId, 'WARN');
          this.markThrottled('RAPID_DAMAGE_' + layerId, tick);
        }
      }
    }

    return Object.freeze(signals);
  }

  // ─────────────────────────────────────────────────────────────────────
  // S 2 — Shield UX State Machine
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Record the current shield state as a UX snapshot for trajectory tracking.
   * Trims history to MAX_HISTORY_DEPTH.
   */
  public recordSnapshot(
    layers: readonly ShieldLayerState[],
    tick: number,
    cascadeActive: boolean,
  ): ShieldUXSnapshot {
    if (this.sessionStartTick === null) {
      this.sessionStartTick = tick;
    }

    let totalIntegrity = 0;
    let totalMax = 0;
    let breachedCount = 0;
    let weakestId: ShieldLayerId = 'L1';
    let weakestRatio = 1.0;

    for (const layer of layers) {
      totalIntegrity += layer.current;
      totalMax += layer.max;

      if (layer.breached) {
        breachedCount++;
      }

      if (layer.integrityRatio < weakestRatio) {
        weakestRatio = layer.integrityRatio;
        weakestId = layer.layerId;
      }
    }

    const overallIntegrity = totalMax > 0 ? totalIntegrity / totalMax : 0;

    // Determine fortified status by checking all layers against the threshold
    let fortified = layers.length > 0;
    for (const layer of layers) {
      if (layer.integrityRatio < SHIELD_CONSTANTS.FORTIFIED_THRESHOLD) {
        fortified = false;
        break;
      }
    }

    const snapshot: ShieldUXSnapshot = {
      tick,
      layerStates: layers,
      overallIntegrity,
      breachedCount,
      weakestLayerId: weakestId,
      weakestRatio,
      fortified,
      cascadeActive,
    };

    this.snapshotHistory.push(snapshot);

    // Trim to MAX_HISTORY_DEPTH
    const maxDepth = SHIELD_CONSTANTS.MAX_HISTORY_DEPTH;
    while (this.snapshotHistory.length > maxDepth) {
      this.snapshotHistory.shift();
    }

    return snapshot;
  }

  /**
   * Get the last N snapshots from the UX state history.
   */
  public getRecentSnapshots(count: number): readonly ShieldUXSnapshot[] {
    const start = Math.max(0, this.snapshotHistory.length - count);
    return Object.freeze(this.snapshotHistory.slice(start));
  }

  /**
   * Detect UX-relevant patterns from snapshot trajectory.
   * Returns newly detected patterns and stores them for analytics.
   */
  public detectPatterns(tick: number): readonly UXPattern[] {
    const newPatterns: UXPattern[] = [];
    const recent = this.getRecentSnapshots(RAPID_DAMAGE_WINDOW_TICKS + 2);

    if (recent.length < 2) {
      return Object.freeze(newPatterns);
    }

    const oldest = recent[0]!;
    const newest = recent[recent.length - 1]!;

    // ── Rapid damage pattern ─────────────────────────────────────────
    this.detectRapidDamagePattern(oldest, newest, tick, newPatterns);

    // ── Sustained breach pattern ─────────────────────────────────────
    this.detectSustainedBreachPattern(tick, newPatterns);

    // ── Recovery surge pattern ───────────────────────────────────────
    this.detectRecoverySurgePattern(oldest, newest, tick, newPatterns);

    // ── Full collapse pattern ────────────────────────────────────────
    this.detectFullCollapsePattern(newest, tick, newPatterns);

    // ── Fortification climb pattern ──────────────────────────────────
    this.detectFortificationClimbPattern(oldest, newest, tick, newPatterns);

    // ── Oscillating breach pattern ───────────────────────────────────
    this.detectOscillatingBreachPattern(tick, newPatterns);

    // ── Cascade spiral pattern ───────────────────────────────────────
    this.detectCascadeSpiralPattern(tick, newPatterns);

    // ── Single layer focus pattern ───────────────────────────────────
    this.detectSingleLayerFocusPattern(tick, newPatterns);

    // Store detected patterns
    for (const pattern of newPatterns) {
      this.detectedPatterns.push(pattern);
    }

    // Trim pattern history
    const maxDepth = SHIELD_CONSTANTS.MAX_HISTORY_DEPTH;
    while (this.detectedPatterns.length > maxDepth * 2) {
      this.detectedPatterns.shift();
    }

    return Object.freeze(newPatterns);
  }

  /**
   * Build EngineSignals from detected patterns for downstream consumption.
   */
  public buildPatternSignals(
    patterns: readonly UXPattern[],
    tick: number,
  ): readonly EngineSignal[] {
    const signals: EngineSignal[] = [];

    for (const pattern of patterns) {
      if (this.isThrottled('PATTERN_' + pattern.patternType, tick)) {
        continue;
      }

      const affectedLayerNames = pattern.affectedLayers.map(
        (id: ShieldLayerId) => getLayerConfig(id).doctrineName,
      );

      signals.push(
        createEngineSignal(
          'shield',
          pattern.severity,
          `SHIELD_PATTERN_${pattern.patternType}`,
          `Pattern detected: ${pattern.patternType} affecting ${affectedLayerNames.join(', ') || 'all layers'}.`,
          tick,
          [
            `pattern:${pattern.patternType}`,
            ...pattern.affectedLayers.map((id: ShieldLayerId) => `layer:${id}`),
            ...Object.entries(pattern.metadata).map(
              ([k, v]) => `${k}:${String(v)}`,
            ),
          ],
        ),
      );
      this.recordSignal(
        `SHIELD_PATTERN_${pattern.patternType}`,
        tick,
        pattern.affectedLayers[0] ?? null,
        pattern.severity,
      );
      this.markThrottled('PATTERN_' + pattern.patternType, tick);
    }

    return Object.freeze(signals);
  }

  // ── Pattern detection helpers ──────────────────────────────────────

  private detectRapidDamagePattern(
    oldest: ShieldUXSnapshot,
    newest: ShieldUXSnapshot,
    tick: number,
    out: UXPattern[],
  ): void {
    const integrityDrop = oldest.overallIntegrity - newest.overallIntegrity;
    const tickSpan = newest.tick - oldest.tick;

    if (tickSpan > 0 && integrityDrop > 0) {
      const dropRate = integrityDrop / tickSpan;
      if (dropRate > 0.05) {
        const affectedLayers: ShieldLayerId[] = [];
        for (const id of LAYER_ORDER) {
          const oldLayer = oldest.layerStates.find(
            (l: ShieldLayerState) => l.layerId === id,
          );
          const newLayer = newest.layerStates.find(
            (l: ShieldLayerState) => l.layerId === id,
          );
          if (oldLayer && newLayer && newLayer.current < oldLayer.current) {
            affectedLayers.push(id);
          }
        }

        if (affectedLayers.length > 0) {
          out.push({
            patternType: 'RAPID_DAMAGE',
            detectedAtTick: tick,
            affectedLayers,
            severity: dropRate > 0.15 ? 'ERROR' : 'WARN',
            metadata: {
              dropRate: Number(dropRate.toFixed(4)),
              tickSpan,
              totalDrop: Number(integrityDrop.toFixed(4)),
            },
          });
        }
      }
    }
  }

  private detectSustainedBreachPattern(
    tick: number,
    out: UXPattern[],
  ): void {
    const recent = this.getRecentSnapshots(SUSTAINED_BREACH_TICK_THRESHOLD);
    if (recent.length < SUSTAINED_BREACH_TICK_THRESHOLD) return;

    for (const layerId of LAYER_ORDER) {
      const allBreached = recent.every((snap: ShieldUXSnapshot) => {
        const layer = snap.layerStates.find(
          (l: ShieldLayerState) => l.layerId === layerId,
        );
        return layer !== undefined && layer.breached;
      });

      if (allBreached) {
        const config = getLayerConfig(layerId);
        out.push({
          patternType: 'SUSTAINED_BREACH',
          detectedAtTick: tick,
          affectedLayers: [layerId],
          severity: config.cascadeGate ? 'ERROR' : 'WARN',
          metadata: {
            durationTicks: SUSTAINED_BREACH_TICK_THRESHOLD,
            layer: config.doctrineName,
            cascadeGate: config.cascadeGate,
          },
        });
      }
    }
  }

  private detectRecoverySurgePattern(
    oldest: ShieldUXSnapshot,
    newest: ShieldUXSnapshot,
    tick: number,
    out: UXPattern[],
  ): void {
    const integrityGain = newest.overallIntegrity - oldest.overallIntegrity;

    if (integrityGain >= RECOVERY_SURGE_RATIO_DELTA) {
      const recoveredLayers: ShieldLayerId[] = [];
      for (const id of LAYER_ORDER) {
        const oldLayer = oldest.layerStates.find(
          (l: ShieldLayerState) => l.layerId === id,
        );
        const newLayer = newest.layerStates.find(
          (l: ShieldLayerState) => l.layerId === id,
        );
        if (oldLayer && newLayer && newLayer.integrityRatio > oldLayer.integrityRatio) {
          recoveredLayers.push(id);
        }
      }

      if (recoveredLayers.length > 0) {
        out.push({
          patternType: 'RECOVERY_SURGE',
          detectedAtTick: tick,
          affectedLayers: recoveredLayers,
          severity: 'INFO',
          metadata: {
            integrityGain: Number(integrityGain.toFixed(4)),
            layersRecovered: recoveredLayers.length,
          },
        });
      }
    }
  }

  private detectFullCollapsePattern(
    newest: ShieldUXSnapshot,
    tick: number,
    out: UXPattern[],
  ): void {
    if (newest.breachedCount === LAYER_ORDER.length) {
      out.push({
        patternType: 'FULL_COLLAPSE',
        detectedAtTick: tick,
        affectedLayers: [...LAYER_ORDER],
        severity: 'ERROR',
        metadata: {
          breachedCount: newest.breachedCount,
          overallIntegrity: 0,
        },
      });
    }
  }

  private detectFortificationClimbPattern(
    oldest: ShieldUXSnapshot,
    newest: ShieldUXSnapshot,
    tick: number,
    out: UXPattern[],
  ): void {
    if (!oldest.fortified && newest.fortified) {
      out.push({
        patternType: 'FORTIFICATION_CLIMB',
        detectedAtTick: tick,
        affectedLayers: [...LAYER_ORDER],
        severity: 'INFO',
        metadata: {
          fromIntegrity: Number(oldest.overallIntegrity.toFixed(4)),
          toIntegrity: Number(newest.overallIntegrity.toFixed(4)),
          threshold: SHIELD_CONSTANTS.FORTIFIED_THRESHOLD,
        },
      });
    }
  }

  private detectOscillatingBreachPattern(
    tick: number,
    out: UXPattern[],
  ): void {
    const windowSize = 8;
    const recent = this.getRecentSnapshots(windowSize);
    if (recent.length < windowSize) return;

    for (const layerId of LAYER_ORDER) {
      let transitions = 0;
      for (let i = 1; i < recent.length; i++) {
        const prev = recent[i - 1]!.layerStates.find(
          (l: ShieldLayerState) => l.layerId === layerId,
        );
        const curr = recent[i]!.layerStates.find(
          (l: ShieldLayerState) => l.layerId === layerId,
        );
        if (prev && curr && prev.breached !== curr.breached) {
          transitions++;
        }
      }

      if (transitions >= 3) {
        const config = getLayerConfig(layerId);
        out.push({
          patternType: 'OSCILLATING_BREACH',
          detectedAtTick: tick,
          affectedLayers: [layerId],
          severity: 'WARN',
          metadata: {
            transitions,
            windowSize,
            layer: config.doctrineName,
          },
        });
      }
    }
  }

  private detectCascadeSpiralPattern(
    tick: number,
    out: UXPattern[],
  ): void {
    const recent = this.getRecentSnapshots(6);
    const cascadeSnapshots = recent.filter(
      (s: ShieldUXSnapshot) => s.cascadeActive,
    );

    if (cascadeSnapshots.length >= 3) {
      // Check if breach count is increasing during cascades
      let increasing = true;
      for (let i = 1; i < cascadeSnapshots.length; i++) {
        if (cascadeSnapshots[i]!.breachedCount <= cascadeSnapshots[i - 1]!.breachedCount) {
          increasing = false;
          break;
        }
      }

      if (increasing && cascadeSnapshots.length >= 3) {
        out.push({
          patternType: 'CASCADE_SPIRAL',
          detectedAtTick: tick,
          affectedLayers: [...LAYER_ORDER],
          severity: 'ERROR',
          metadata: {
            cascadeSnapshots: cascadeSnapshots.length,
            breachTrend: 'INCREASING',
          },
        });
      }
    }
  }

  private detectSingleLayerFocusPattern(
    tick: number,
    out: UXPattern[],
  ): void {
    const windowSize = 6;
    const recentDamageLogs: Map<ShieldLayerId, number> = new Map();

    for (const layerId of LAYER_ORDER) {
      const log = this.perLayerDamageLog.get(layerId);
      if (log) {
        const recentCount = log.filter(
          (t: number) => tick - t <= windowSize,
        ).length;
        recentDamageLogs.set(layerId, recentCount);
      }
    }

    let maxHits = 0;
    let focusedLayer: ShieldLayerId | null = null;
    let totalHits = 0;

    for (const [id, count] of recentDamageLogs) {
      totalHits += count;
      if (count > maxHits) {
        maxHits = count;
        focusedLayer = id;
      }
    }

    if (focusedLayer && totalHits > 0 && maxHits / totalHits > 0.75 && maxHits >= 3) {
      const config = getLayerConfig(focusedLayer);
      out.push({
        patternType: 'SINGLE_LAYER_FOCUS',
        detectedAtTick: tick,
        affectedLayers: [focusedLayer],
        severity: 'WARN',
        metadata: {
          focusedLayer: config.doctrineName,
          hitConcentration: Number((maxHits / totalHits).toFixed(3)),
          totalHits,
        },
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // S 3 — Shield Narrative Engine
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Generate a player-facing narrative for a shield attack event.
   */
  public generateAttackNarrative(
    layerId: ShieldLayerId,
    damageTaken: number,
    preHitRatio: number,
    postHitRatio: number,
    tick: number,
  ): NarrativeContext {
    const config = getLayerConfig(layerId);
    const pool = LAYER_ATTACK_NARRATIVES[layerId];
    const headline = selectNarrative(pool, tick + damageTaken);

    const damagePercent = config.max > 0
      ? ((damageTaken / config.max) * 100).toFixed(1)
      : '0.0';

    let urgency: NarrativeContext['urgency'] = 'LOW';
    if (postHitRatio <= 0) {
      urgency = 'CRITICAL';
    } else if (postHitRatio < SHIELD_CONSTANTS.CRITICAL_WARNING_THRESHOLD) {
      urgency = 'CRITICAL';
    } else if (postHitRatio < SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD) {
      urgency = 'HIGH';
    } else if (postHitRatio < SHIELD_CONSTANTS.FORTIFIED_THRESHOLD) {
      urgency = 'MEDIUM';
    }

    const detail =
      `${config.doctrineName} took ${damagePercent}% damage. ` +
      `Integrity dropped from ${(preHitRatio * 100).toFixed(1)}% to ${(postHitRatio * 100).toFixed(1)}%.`;

    return {
      headline,
      detail,
      urgency,
      layerId,
      tick,
      narrativeType: 'ATTACK',
    };
  }

  /**
   * Generate a player-facing narrative for a layer breach event.
   */
  public generateBreachNarrative(
    layerId: ShieldLayerId,
    tick: number,
    cascadesTriggered: number,
  ): NarrativeContext {
    const config = getLayerConfig(layerId);
    const pool = LAYER_BREACH_NARRATIVES[layerId];
    const headline = selectNarrative(pool, tick);

    const detail = cascadesTriggered > 0
      ? `${config.doctrineName} has been breached, triggering ${cascadesTriggered} cascade(s). ${config.breachConsequenceText}`
      : `${config.doctrineName} has been breached. ${config.breachConsequenceText}`;

    return {
      headline,
      detail,
      urgency: config.cascadeGate ? 'CRITICAL' : 'HIGH',
      layerId,
      tick,
      narrativeType: 'BREACH',
    };
  }

  /**
   * Generate a player-facing narrative for layer recovery.
   */
  public generateRecoveryNarrative(
    layerId: ShieldLayerId,
    currentRatio: number,
    tick: number,
  ): NarrativeContext {
    const config = getLayerConfig(layerId);
    const pool = LAYER_RECOVERY_NARRATIVES[layerId];
    const headline = selectNarrative(pool, tick);

    let urgency: NarrativeContext['urgency'] = 'LOW';
    if (currentRatio < SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD) {
      urgency = 'MEDIUM';
    }

    const detail =
      `${config.doctrineName} is recovering. ` +
      `Current integrity: ${(currentRatio * 100).toFixed(1)}%. ` +
      `Regenerating at ${config.passiveRegenRate} per tick.`;

    return {
      headline,
      detail,
      urgency,
      layerId,
      tick,
      narrativeType: 'RECOVERY',
    };
  }

  /**
   * Generate a player-facing narrative for critical layer warnings.
   */
  public generateCriticalWarningNarrative(
    layerId: ShieldLayerId,
    currentRatio: number,
    tick: number,
  ): NarrativeContext {
    const config = getLayerConfig(layerId);
    const pool = LAYER_CRITICAL_NARRATIVES[layerId];
    const headline = selectNarrative(pool, tick);

    const detail =
      `${config.doctrineName} is at ${(currentRatio * 100).toFixed(1)}% integrity. ` +
      `Critical threshold is ${(SHIELD_CONSTANTS.CRITICAL_WARNING_THRESHOLD * 100).toFixed(0)}%.`;

    return {
      headline,
      detail,
      urgency: config.cascadeGate ? 'CRITICAL' : 'HIGH',
      layerId,
      tick,
      narrativeType: 'WARNING',
    };
  }

  /**
   * Generate cascade event narrative for the player.
   */
  public generateCascadeNarrative(
    templateId: string,
    chainId: string,
    tick: number,
  ): NarrativeContext {
    const headline = selectNarrative(CASCADE_NARRATIVES, tick);
    const l4Config = getLayerConfig('L4' as ShieldLayerId);

    const detail =
      `${l4Config.doctrineName} breach triggered cascade template ${templateId} ` +
      `(chain: ${chainId}). Downstream systems will be affected.`;

    return {
      headline,
      detail,
      urgency: 'CRITICAL',
      layerId: 'L4' as ShieldLayerId,
      tick,
      narrativeType: 'CASCADE',
    };
  }

  /**
   * Generate fortified state narrative.
   */
  public generateFortifiedNarrative(
    entered: boolean,
    tick: number,
  ): NarrativeContext {
    if (entered) {
      const headline = selectNarrative(FORTIFIED_ENTER_NARRATIVES, tick);
      return {
        headline,
        detail:
          `All layers above ${(SHIELD_CONSTANTS.FORTIFIED_THRESHOLD * 100).toFixed(0)}% integrity. ` +
          `Deflection bonus of ${(SHIELD_CONSTANTS.FORTIFIED_BONUS_DEFLECT * 100).toFixed(0)}% is active.`,
        urgency: 'LOW',
        layerId: null,
        tick,
        narrativeType: 'ACHIEVEMENT',
      };
    }

    const headline = selectNarrative(FORTIFIED_LOST_NARRATIVES, tick);
    return {
      headline,
      detail:
        `At least one layer dropped below ${(SHIELD_CONSTANTS.FORTIFIED_THRESHOLD * 100).toFixed(0)}% integrity. ` +
        `Fortified deflection bonus is no longer active.`,
      urgency: 'MEDIUM',
      layerId: null,
      tick,
      narrativeType: 'WARNING',
    };
  }

  /**
   * Generate a repair progress narrative for a specific layer.
   */
  public generateRepairNarrative(
    layerId: RepairLayerId,
    amountDelivered: number,
    source: 'CARD' | 'SYSTEM' | 'ADMIN',
    tick: number,
  ): NarrativeContext {
    const layerDesc = this.describeLayer(layerId);
    const resolvedLayerId: ShieldLayerId | null =
      layerId === 'ALL' ? null : layerId as ShieldLayerId;

    let sourceText: string;
    if (source === 'CARD') {
      sourceText = 'a played card';
    } else if (source === 'SYSTEM') {
      sourceText = 'passive regeneration';
    } else {
      sourceText = 'an administrative action';
    }

    return {
      headline: `Repair delivered ${amountDelivered} point(s) to ${layerDesc}.`,
      detail: `${layerDesc} received ${amountDelivered} repair points from ${sourceText}.`,
      urgency: 'LOW',
      layerId: resolvedLayerId,
      tick,
      narrativeType: 'REPAIR',
    };
  }

  /**
   * Generate an overall status narrative summarizing current shield state.
   */
  public generateStatusNarrative(
    layers: readonly ShieldLayerState[],
    tick: number,
  ): NarrativeContext {
    let breachedCount = 0;
    let lowestRatio = 1.0;
    let lowestLayerId: ShieldLayerId = 'L1';
    let allFortified = layers.length > 0;

    for (const layer of layers) {
      if (layer.breached) breachedCount++;
      if (layer.integrityRatio < lowestRatio) {
        lowestRatio = layer.integrityRatio;
        lowestLayerId = layer.layerId;
      }
      if (layer.integrityRatio < SHIELD_CONSTANTS.FORTIFIED_THRESHOLD) {
        allFortified = false;
      }
    }

    let headline: string;
    let urgency: NarrativeContext['urgency'];

    if (breachedCount === layers.length && layers.length > 0) {
      headline = 'All shields down. Total exposure.';
      urgency = 'CRITICAL';
    } else if (breachedCount > 0) {
      headline = `${breachedCount} of ${layers.length} shield layers breached.`;
      urgency = 'HIGH';
    } else if (allFortified) {
      headline = 'All shields fortified. Maximum protection.';
      urgency = 'LOW';
    } else if (lowestRatio < SHIELD_CONSTANTS.CRITICAL_WARNING_THRESHOLD) {
      const weakConfig = getLayerConfig(lowestLayerId);
      headline = `${weakConfig.doctrineName} critically low at ${(lowestRatio * 100).toFixed(1)}%.`;
      urgency = 'HIGH';
    } else if (lowestRatio < SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD) {
      const weakConfig = getLayerConfig(lowestLayerId);
      headline = `${weakConfig.doctrineName} under pressure at ${(lowestRatio * 100).toFixed(1)}%.`;
      urgency = 'MEDIUM';
    } else {
      headline = 'Shields holding. Monitoring for threats.';
      urgency = 'LOW';
    }

    const detail = layers
      .map((layer: ShieldLayerState) => {
        const cfg = getLayerConfig(layer.layerId);
        const status = layer.breached
          ? 'BREACHED'
          : `${(layer.integrityRatio * 100).toFixed(1)}%`;
        return `${cfg.doctrineName}: ${status}`;
      })
      .join(' | ');

    return {
      headline,
      detail,
      urgency,
      layerId: breachedCount > 0 ? lowestLayerId : null,
      tick,
      narrativeType: 'STATUS',
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // S 4 — Shield UX Analytics
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Get total signal count for the current session.
   */
  public getSessionSignalCount(): number {
    return this.sessionSignalCount;
  }

  /**
   * Get session breach count.
   */
  public getSessionBreachCount(): number {
    return this.sessionBreachCount;
  }

  /**
   * Get session cascade count.
   */
  public getSessionCascadeCount(): number {
    return this.sessionCascadeCount;
  }

  /**
   * Analyze signal frequency over a window of recent ticks.
   * Returns frequency breakdown by severity and layer.
   */
  public analyzeSignalFrequency(
    tick: number,
    windowTicks: number,
  ): {
    readonly total: number;
    readonly bySeverity: Readonly<Record<'INFO' | 'WARN' | 'ERROR', number>>;
    readonly byLayer: Readonly<Record<ShieldLayerId, number>>;
    readonly overloaded: boolean;
    readonly healthyRange: boolean;
  } {
    const recentSignals = this.signalLog.filter(
      (record: UXSignalRecord) => tick - record.tick <= windowTicks,
    );

    const bySeverity: Record<'INFO' | 'WARN' | 'ERROR', number> = {
      INFO: 0,
      WARN: 0,
      ERROR: 0,
    };

    const byLayer: Record<ShieldLayerId, number> = {
      L1: 0,
      L2: 0,
      L3: 0,
      L4: 0,
    };

    for (const record of recentSignals) {
      bySeverity[record.severity]++;
      if (record.layerId !== null && record.layerId !== 'ALL') {
        const lid = record.layerId as ShieldLayerId;
        byLayer[lid]++;
      }
    }

    const total = recentSignals.length;

    return {
      total,
      bySeverity,
      byLayer,
      overloaded: total > SIGNAL_FREQUENCY_OVERLOAD_THRESHOLD,
      healthyRange: total <= SIGNAL_FREQUENCY_HEALTHY_CEILING,
    };
  }

  /**
   * Compute a player experience score (0-100) based on signal balance.
   * High score = signals are informative without being overwhelming.
   * Low score = too many or too few signals, or too many errors.
   */
  public computeExperienceScore(tick: number): number {
    const freq = this.analyzeSignalFrequency(tick, 10);

    let score = UX_SCORE_PERFECT;

    // Penalty for signal overload
    if (freq.overloaded) {
      const overloadPenalty = (freq.total - SIGNAL_FREQUENCY_OVERLOAD_THRESHOLD) * 5;
      score -= Math.min(overloadPenalty, 40);
    }

    // Penalty for high error ratio
    if (freq.total > 0) {
      const errorRatio = freq.bySeverity.ERROR / freq.total;
      if (errorRatio > 0.5) {
        score -= 30;
      } else if (errorRatio > 0.25) {
        score -= 15;
      }

      // Penalty for high warn ratio with no info
      const warnRatio = freq.bySeverity.WARN / freq.total;
      if (warnRatio > 0.7 && freq.bySeverity.INFO === 0) {
        score -= 10;
      }
    }

    // Penalty for extreme signal drought (no signals at all in window)
    if (freq.total === 0 && this.snapshotHistory.length > 5) {
      // Only penalize if game is active (has snapshot history)
      score -= 10;
    }

    // Penalty for signal concentration on single layer
    const layerCounts = [
      freq.byLayer.L1,
      freq.byLayer.L2,
      freq.byLayer.L3,
      freq.byLayer.L4,
    ];
    const maxLayerCount = Math.max(...layerCounts);
    if (freq.total > 4 && maxLayerCount / freq.total > 0.8) {
      score -= 10;
    }

    return Math.max(UX_SCORE_FLOOR, Math.min(UX_SCORE_PERFECT, score));
  }

  /**
   * Check if a signal should be deduplicated/throttled.
   * Returns true if this signal code + layer combo was recently emitted.
   */
  public shouldThrottleSignal(
    signalCode: string,
    layerId: ShieldLayerId | null,
    tick: number,
  ): boolean {
    const key = layerId ? `${signalCode}:${layerId}` : signalCode;
    return this.isThrottled(key, tick);
  }

  /**
   * Filter an array of signals removing throttled duplicates.
   * Preserves ERROR severity signals unconditionally.
   */
  public deduplicateSignals(
    signals: readonly EngineSignal[],
    tick: number,
  ): readonly EngineSignal[] {
    const result: EngineSignal[] = [];

    for (const signal of signals) {
      // Always pass ERROR signals
      if (signal.severity === 'ERROR') {
        result.push(signal);
        continue;
      }

      // Extract layer from tags
      const layerTag = signal.tags?.find(
        (t: string) => t.startsWith('layer:'),
      );
      const layerId = layerTag ? layerTag.slice(6) : null;
      const key = layerId ? `${signal.code}:${layerId}` : signal.code;

      if (!this.isThrottled(key, tick)) {
        result.push(signal);
        this.markThrottled(key, tick);
      }
    }

    return Object.freeze(result);
  }

  /**
   * Get all detected patterns matching a specific type.
   */
  public getPatternsByType(
    patternType: UXPattern['patternType'],
  ): readonly UXPattern[] {
    return Object.freeze(
      this.detectedPatterns.filter(
        (p: UXPattern) => p.patternType === patternType,
      ),
    );
  }

  /**
   * Get signal log for a specific layer within a tick window.
   */
  public getLayerSignalHistory(
    layerId: ShieldLayerId,
    windowTicks: number,
    currentTick: number,
  ): readonly UXSignalRecord[] {
    return Object.freeze(
      this.signalLog.filter(
        (r: UXSignalRecord) =>
          r.layerId === layerId && currentTick - r.tick <= windowTicks,
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // S 5 — Shield ML/DL Signal Features
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Extract an ML feature vector from current UX state.
   * 32-dimensional vector capturing shield health, signal patterns,
   * and player experience metrics.
   */
  public extractMLFeatureVector(
    layers: readonly ShieldLayerState[],
    tick: number,
    cascadeActive: boolean,
  ): ShieldMLFeatureVector {
    const features: number[] = new Array(ML_FEATURE_DIMENSION).fill(0);

    // Feature 0: overall integrity
    let totalCurrent = 0;
    let totalMax = 0;
    for (const layer of layers) {
      totalCurrent += layer.current;
      totalMax += layer.max;
    }
    features[0] = totalMax > 0 ? totalCurrent / totalMax : 0;

    // Features 1-4: per-layer integrity ratios
    for (const layer of layers) {
      const idx = layerIdToIndex(layer.layerId);
      features[1 + idx] = layer.integrityRatio;
    }

    // Feature 5: breached layer count
    let breachedCount = 0;
    for (const layer of layers) {
      if (layer.breached) breachedCount++;
    }
    features[5] = breachedCount / LAYER_ORDER.length;

    // Feature 6: weakest layer ratio
    let weakestRatio = 1.0;
    let weakestIndex = 0;
    for (const layer of layers) {
      if (layer.integrityRatio < weakestRatio) {
        weakestRatio = layer.integrityRatio;
        weakestIndex = layerIdToIndex(layer.layerId);
      }
    }
    features[6] = weakestRatio;

    // Feature 7: weakest layer index (normalized)
    features[7] = weakestIndex / (LAYER_ORDER.length - 1);

    // Feature 8: fortified flag
    let fortified = layers.length > 0;
    for (const layer of layers) {
      if (layer.integrityRatio < SHIELD_CONSTANTS.FORTIFIED_THRESHOLD) {
        fortified = false;
        break;
      }
    }
    features[8] = fortified ? 1.0 : 0.0;

    // Feature 9: cascade active flag
    features[9] = cascadeActive ? 1.0 : 0.0;

    // Feature 10: signal frequency (recent)
    const freq = this.analyzeSignalFrequency(tick, 10);
    features[10] = clamp01(freq.total / 20);

    // Features 11-13: signal severity ratios
    if (freq.total > 0) {
      features[11] = freq.bySeverity.WARN / freq.total;
      features[12] = freq.bySeverity.ERROR / freq.total;
      features[13] = freq.bySeverity.INFO / freq.total;
    }

    // Features 14-16: pattern detection flags
    const recentPatterns = this.detectedPatterns.filter(
      (p: UXPattern) => tick - p.detectedAtTick <= 10,
    );
    features[14] = recentPatterns.some(
      (p: UXPattern) => p.patternType === 'RAPID_DAMAGE',
    ) ? 1.0 : 0.0;
    features[15] = recentPatterns.some(
      (p: UXPattern) => p.patternType === 'SUSTAINED_BREACH',
    ) ? 1.0 : 0.0;
    features[16] = recentPatterns.some(
      (p: UXPattern) => p.patternType === 'RECOVERY_SURGE',
    ) ? 1.0 : 0.0;

    // Feature 17: integrity slope
    const slope = this.computeIntegritySlope(tick, 5);
    features[17] = clamp01((slope + 1) / 2); // normalize [-1,1] to [0,1]

    // Feature 18: volatility score
    features[18] = clamp01(this.computeVolatility(tick, 5));

    // Feature 19: UX experience score (normalized)
    features[19] = this.computeExperienceScore(tick) / UX_SCORE_PERFECT;

    // Feature 20: signal overload flag
    features[20] = freq.overloaded ? 1.0 : 0.0;

    // Feature 21: fortification progress
    features[21] = this.computeFortificationProgress(layers);

    // Feature 22: recovery progress
    features[22] = this.computeRecoveryProgress(layers);

    // Features 23-26: per-layer regen rates (normalized)
    for (const layer of layers) {
      const idx = layerIdToIndex(layer.layerId);
      const config = getLayerConfig(layer.layerId);
      features[23 + idx] = config.max > 0
        ? layer.regenPerTick / config.max
        : 0;
    }

    // Feature 27: time since last breach (normalized)
    features[27] = this.computeTimeSinceLastBreach(layers, tick);

    // Feature 28: breach frequency
    features[28] = this.computeBreachFrequency(tick, 20);

    // Feature 29: cascade gate integrity (L4 specific)
    const l4Layer = layers.find(
      (l: ShieldLayerState) => l.layerId === ('L4' as ShieldLayerId),
    );
    features[29] = l4Layer ? l4Layer.integrityRatio : 0;

    // Feature 30: layer variance
    features[30] = clamp01(computeLayerVariance(layers));

    // Feature 31: weighted shield health
    features[31] = computeWeightedShieldHealth(layers);

    return {
      tick,
      features: Object.freeze(features),
      labels: SHIELD_ML_FEATURE_LABELS,
      dimension: ML_FEATURE_DIMENSION,
    };
  }

  /**
   * Build a DL tensor from sequential UX snapshots.
   * Shape: [sequenceLength x featureDepth]
   * Each row is one tick's feature snapshot.
   */
  public buildDLTensor(
    tick: number,
  ): ShieldDLTensor {
    const recent = this.getRecentSnapshots(DL_SEQUENCE_LENGTH);
    const data: (readonly number[])[] = [];

    for (let i = 0; i < DL_SEQUENCE_LENGTH; i++) {
      const snapshot = i < recent.length ? recent[i] : null;

      if (snapshot === null) {
        // Padding for missing snapshots
        data.push(Object.freeze(new Array(DL_FEATURE_DEPTH).fill(0)));
        continue;
      }

      const row: number[] = new Array(DL_FEATURE_DEPTH).fill(0);

      // Feature 0: integrity ratio
      row[0] = snapshot.overallIntegrity;

      // Feature 1: breached flag
      row[1] = snapshot.breachedCount > 0 ? 1.0 : 0.0;

      // Feature 2: signal severity at this tick (encoded)
      const tickSignals = this.signalLog.filter(
        (r: UXSignalRecord) => r.tick === snapshot.tick,
      );
      if (tickSignals.length > 0) {
        const maxSeverity = Math.max(
          ...tickSignals.map((r: UXSignalRecord) => severityToNumeric(r.severity)),
        );
        row[2] = maxSeverity / 3.0;
      }

      // Feature 3: signal frequency at this tick
      row[3] = clamp01(tickSignals.length / 10);

      // Feature 4: pattern type encoded
      const tickPatterns = this.detectedPatterns.filter(
        (p: UXPattern) => p.detectedAtTick === snapshot.tick,
      );
      row[4] = tickPatterns.length > 0 ? clamp01(tickPatterns.length / 3) : 0;

      // Feature 5: recovery delta from previous snapshot
      if (i > 0 && i <= recent.length - 1) {
        const prev = recent[i - 1];
        if (prev) {
          const delta = snapshot.overallIntegrity - prev.overallIntegrity;
          row[5] = clamp01((delta + 1) / 2);
        }
      }

      // Feature 6: damage delta from previous snapshot
      if (i > 0 && i <= recent.length - 1) {
        const prev = recent[i - 1];
        if (prev) {
          const delta = prev.overallIntegrity - snapshot.overallIntegrity;
          row[6] = clamp01(Math.max(0, delta));
        }
      }

      // Feature 7: cascade proximity (how close is L4 to breach)
      const l4State = snapshot.layerStates.find(
        (l: ShieldLayerState) => l.layerId === ('L4' as ShieldLayerId),
      );
      row[7] = l4State ? (1.0 - l4State.integrityRatio) : 1.0;

      data.push(Object.freeze(row));
    }

    return {
      tick,
      sequenceLength: DL_SEQUENCE_LENGTH,
      featureDepth: DL_FEATURE_DEPTH,
      data: Object.freeze(data),
      labels: DL_FEATURE_LABELS,
    };
  }

  /**
   * Analyze signal trends over a given window.
   */
  public analyzeSignalTrends(
    layers: readonly ShieldLayerState[],
    tick: number,
    windowSize: number,
  ): SignalTrendAnalysis {
    const freq = this.analyzeSignalFrequency(tick, windowSize);

    // Determine dominant severity
    let dominantSeverity: 'INFO' | 'WARN' | 'ERROR' = 'INFO';
    if (freq.bySeverity.ERROR > freq.bySeverity.WARN && freq.bySeverity.ERROR > freq.bySeverity.INFO) {
      dominantSeverity = 'ERROR';
    } else if (freq.bySeverity.WARN > freq.bySeverity.INFO) {
      dominantSeverity = 'WARN';
    }

    // Determine dominant layer
    let dominantLayerId: ShieldLayerId | null = null;
    let maxLayerSignals = 0;
    for (const id of LAYER_ORDER) {
      if (freq.byLayer[id] > maxLayerSignals) {
        maxLayerSignals = freq.byLayer[id];
        dominantLayerId = id;
      }
    }

    // Compute integrity slope
    const slope = this.computeIntegritySlope(tick, windowSize);

    // Determine trend direction from slope
    let trendDirection: SignalTrendAnalysis['trendDirection'];
    if (slope > 0.02) {
      trendDirection = 'IMPROVING';
    } else if (slope < -0.02) {
      trendDirection = 'DEGRADING';
    } else {
      trendDirection = 'STABLE';
    }

    // Compute breach trend from snapshot history
    const breachTrend = this.computeBreachTrend(tick, windowSize);

    // Compute volatility
    const volatility = this.computeVolatility(tick, windowSize);

    // Compute risk score (0-1)
    let riskScore = 0;
    const breachedCount = layers.filter((l: ShieldLayerState) => l.breached).length;
    riskScore += breachedCount * 0.15;
    riskScore += (1.0 - computeWeightedShieldHealth(layers)) * 0.3;
    riskScore += volatility * 0.15;
    if (dominantSeverity === 'ERROR') riskScore += 0.2;
    if (dominantSeverity === 'WARN') riskScore += 0.1;
    if (trendDirection === 'DEGRADING') riskScore += 0.1;

    // L4 cascade gate penalty
    const l4 = layers.find(
      (l: ShieldLayerState) => l.layerId === ('L4' as ShieldLayerId),
    );
    if (l4 && l4.integrityRatio < SHIELD_CONSTANTS.CASCADE_CRACK_RATIO) {
      riskScore += 0.2;
    }

    return {
      tick,
      windowSize,
      signalFrequency: freq.total,
      dominantSeverity,
      dominantLayerId,
      trendDirection,
      breachTrend,
      integritySlope: slope,
      volatility,
      riskScore: clamp01(riskScore),
    };
  }

  // ── ML/DL helper methods ───────────────────────────────────────────

  private computeIntegritySlope(tick: number, windowSize: number): number {
    const snapshots = this.getRecentSnapshots(windowSize);
    if (snapshots.length < 2) return 0;

    const first = snapshots[0]!;
    const last = snapshots[snapshots.length - 1]!;
    const tickDelta = last.tick - first.tick;

    if (tickDelta <= 0) return 0;

    return (last.overallIntegrity - first.overallIntegrity) / tickDelta;
  }

  private computeVolatility(tick: number, windowSize: number): number {
    const snapshots = this.getRecentSnapshots(windowSize);
    if (snapshots.length < 2) return 0;

    let totalChange = 0;
    for (let i = 1; i < snapshots.length; i++) {
      totalChange += Math.abs(
        snapshots[i]!.overallIntegrity - snapshots[i - 1]!.overallIntegrity,
      );
    }

    return totalChange / (snapshots.length - 1);
  }

  private computeBreachTrend(
    tick: number,
    windowSize: number,
  ): 'INCREASING' | 'STABLE' | 'DECREASING' {
    const snapshots = this.getRecentSnapshots(windowSize);
    if (snapshots.length < 3) return 'STABLE';

    const mid = Math.floor(snapshots.length / 2);
    const firstHalf = snapshots.slice(0, mid);
    const secondHalf = snapshots.slice(mid);

    const avgFirst =
      firstHalf.reduce((s: number, snap: ShieldUXSnapshot) => s + snap.breachedCount, 0) /
      firstHalf.length;
    const avgSecond =
      secondHalf.reduce((s: number, snap: ShieldUXSnapshot) => s + snap.breachedCount, 0) /
      secondHalf.length;

    if (avgSecond > avgFirst + 0.3) return 'INCREASING';
    if (avgSecond < avgFirst - 0.3) return 'DECREASING';
    return 'STABLE';
  }

  private computeTimeSinceLastBreach(
    layers: readonly ShieldLayerState[],
    tick: number,
  ): number {
    let mostRecentDamage = 0;
    for (const layer of layers) {
      if (layer.lastDamagedTick !== null && layer.lastDamagedTick > mostRecentDamage) {
        mostRecentDamage = layer.lastDamagedTick;
      }
    }

    if (mostRecentDamage === 0) return 1.0;

    const ticksSince = tick - mostRecentDamage;
    return clamp01(ticksSince / 20);
  }

  private computeBreachFrequency(tick: number, windowTicks: number): number {
    const breachSignals = this.signalLog.filter(
      (r: UXSignalRecord) =>
        r.signalCode === 'SHIELD_LAYER_BREACHED' &&
        tick - r.tick <= windowTicks,
    );

    return clamp01(breachSignals.length / (windowTicks / 2));
  }

  // ─────────────────────────────────────────────────────────────────────
  // S 6 — Shield Bus Integration (expanded)
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Emit a batch of shield-related bus events for tick-level coordination.
   * Enriches each event with UX metadata tags.
   */
  public emitShieldTickBatch(
    bus: EventBus<EngineEventMap & Record<string, unknown>>,
    layers: readonly ShieldLayerState[],
    tick: number,
    signals: readonly EngineSignal[],
  ): BusEventBatch {
    const events: BusEventEntry[] = [];

    // Group signals by severity for bus routing
    const errorSignals = signals.filter(
      (s: EngineSignal) => s.severity === 'ERROR',
    );
    const warnSignals = signals.filter(
      (s: EngineSignal) => s.severity === 'WARN',
    );
    const infoSignals = signals.filter(
      (s: EngineSignal) => s.severity === 'INFO',
    );

    // Emit breach events if any layers are newly breached
    for (const signal of errorSignals) {
      if (signal.code === 'SHIELD_CASCADE_TRIGGERED') {
        const chainTag = signal.tags?.find(
          (t: string) => t.startsWith('chain:'),
        );
        const templateTag = signal.tags?.find(
          (t: string) => t.startsWith('template:'),
        );

        events.push({
          eventName: 'shield.cascade',
          payload: {
            tick,
            chainId: chainTag ? chainTag.slice(6) : 'unknown',
            templateId: templateTag ? templateTag.slice(9) : 'unknown',
            severity: signal.severity,
          },
          tags: signal.tags ?? [],
        });
      }
    }

    // Aggregate shield health summary for the bus
    const healthSummary = this.computeLayerHealthSummary(layers);
    events.push({
      eventName: 'shield.health.tick',
      payload: {
        tick,
        overallIntegrity: healthSummary.overallIntegrity,
        breachedCount: healthSummary.breachedCount,
        weakestLayerId: healthSummary.weakestLayerId,
        weakestRatio: healthSummary.weakestRatio,
        fortified: healthSummary.fortified,
        signalCount: signals.length,
        errorCount: errorSignals.length,
        warnCount: warnSignals.length,
        infoCount: infoSignals.length,
      },
      tags: [`tick:${String(tick)}`],
    });

    // Emit the batch through the bus
    const busEntries = events.map((entry: BusEventEntry) => ({
      event: entry.eventName as keyof (EngineEventMap & Record<string, unknown>),
      payload: entry.payload as (EngineEventMap & Record<string, unknown>)[string],
      options: {
        emittedAtTick: tick,
        tags: [...entry.tags],
      },
    }));

    if (busEntries.length > 0) {
      bus.emitBatch(busEntries);
    }

    return {
      tick,
      events: Object.freeze(events),
      signalCount: signals.length,
    };
  }

  /**
   * Emit a warning-level bus event when signal overload is detected.
   */
  public emitSignalOverloadWarning(
    bus: EventBus<EngineEventMap & Record<string, unknown>>,
    tick: number,
    signalCount: number,
  ): void {
    if (signalCount > SIGNAL_FREQUENCY_OVERLOAD_THRESHOLD) {
      bus.emit('shield.breached' as keyof EngineEventMap, {
        attackId: 'SIGNAL_OVERLOAD',
        layerId: 'L1' as ShieldLayerId,
        tick,
        cascadesTriggered: 0,
      } as EngineEventMap['shield.breached']);

      this.recordSignal('SHIELD_SIGNAL_OVERLOAD', tick, null, 'WARN');
    }
  }

  /**
   * Emit pattern detection events through the bus for downstream consumers.
   */
  public emitPatternDetected(
    bus: EventBus<EngineEventMap & Record<string, unknown>>,
    pattern: UXPattern,
    tick: number,
  ): void {
    const affectedLayerNames = pattern.affectedLayers.map(
      (id: ShieldLayerId) => getLayerConfig(id).doctrineName,
    );

    // Use shield.breached as the canonical event channel with enriched metadata
    if (pattern.severity === 'ERROR' && pattern.affectedLayers.length > 0) {
      const primaryLayer = pattern.affectedLayers[0]!;
      bus.emit('shield.breached', {
        attackId: `PATTERN:${pattern.patternType}`,
        layerId: primaryLayer,
        tick,
        cascadesTriggered: pattern.patternType === 'CASCADE_SPIRAL' ? 1 : 0,
      }, {
        emittedAtTick: tick,
        tags: [
          `pattern:${pattern.patternType}`,
          ...affectedLayerNames.map((n: string) => `layer_name:${n}`),
        ],
      });
    }
  }

  /**
   * Emit repair events through the bus.
   */
  public emitRepairEvent(
    bus: EventBus<EngineEventMap & Record<string, unknown>>,
    layerId: RepairLayerId,
    amount: number,
    source: 'CARD' | 'SYSTEM' | 'ADMIN',
    tick: number,
  ): void {
    const resolvedId: ShieldLayerId = layerId === 'ALL'
      ? 'L1' as ShieldLayerId
      : layerId as ShieldLayerId;

    const config = getLayerConfig(resolvedId);

    bus.emit('shield.breached' as keyof EngineEventMap, {
      attackId: `REPAIR:${source}:${String(amount)}`,
      layerId: resolvedId,
      tick,
      cascadesTriggered: 0,
    } as EngineEventMap['shield.breached'], {
      emittedAtTick: tick,
      tags: [
        `repair:${config.doctrineName}`,
        `source:${source}`,
        `amount:${String(amount)}`,
      ],
    });
  }

  // ── Bus helper ─────────────────────────────────────────────────────

  private computeLayerHealthSummary(
    layers: readonly ShieldLayerState[],
  ): {
    overallIntegrity: number;
    breachedCount: number;
    weakestLayerId: ShieldLayerId;
    weakestRatio: number;
    fortified: boolean;
  } {
    let totalCurrent = 0;
    let totalMax = 0;
    let breachedCount = 0;
    let weakestId: ShieldLayerId = 'L1';
    let weakestRatio = 1.0;
    let fortified = layers.length > 0;

    for (const layer of layers) {
      totalCurrent += layer.current;
      totalMax += layer.max;

      if (layer.breached) breachedCount++;

      if (layer.integrityRatio < weakestRatio) {
        weakestRatio = layer.integrityRatio;
        weakestId = layer.layerId;
      }

      if (layer.integrityRatio < SHIELD_CONSTANTS.FORTIFIED_THRESHOLD) {
        fortified = false;
      }
    }

    return {
      overallIntegrity: totalMax > 0 ? totalCurrent / totalMax : 0,
      breachedCount,
      weakestLayerId: weakestId,
      weakestRatio,
      fortified,
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // S 7 — Shield UX Scoring
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Build a detailed health report for a single layer.
   */
  public buildLayerHealthReport(
    layer: ShieldLayerState,
    recentDamageRate: number,
    tick: number,
  ): LayerHealthReport {
    const config = getLayerConfig(layer.layerId);

    const ticksToFull = estimateTicksToFull(
      layer.current,
      layer.max,
      layer.regenPerTick,
    );

    const ticksToBreach = estimateTicksToBreach(
      layer.current,
      layer.regenPerTick,
      recentDamageRate,
    );

    return {
      layerId: layer.layerId,
      doctrineName: config.doctrineName,
      current: layer.current,
      max: layer.max,
      integrityRatio: layer.integrityRatio,
      healthGrade: gradeFromScore(layer.integrityRatio),
      breached: layer.breached,
      regenPerTick: layer.regenPerTick,
      ticksToFull,
      ticksToBreach,
      riskLevel: riskFromRatio(layer.integrityRatio, config.cascadeGate),
      cascadeGate: config.cascadeGate,
    };
  }

  /**
   * Build the full shield grade report for the player dashboard.
   */
  public buildShieldGradeReport(
    layers: readonly ShieldLayerState[],
    tick: number,
  ): ShieldGradeReport {
    const layerReports: LayerHealthReport[] = [];
    let breachedLayerCount = 0;

    for (const layer of layers) {
      // Estimate recent damage rate from per-layer damage log
      const damageLog = this.perLayerDamageLog.get(layer.layerId);
      let recentDamageRate = 0;
      if (damageLog && damageLog.length > 0) {
        const recentHits = damageLog.filter(
          (t: number) => tick - t <= 5,
        );
        recentDamageRate = recentHits.length > 0 ? recentHits.length * 2 : 0;
      }

      const report = this.buildLayerHealthReport(layer, recentDamageRate, tick);
      layerReports.push(report);

      if (layer.breached) breachedLayerCount++;
    }

    // Compute overall score using weighted health
    const overallScore = computeWeightedShieldHealth(layers);
    const overallGrade = gradeFromScore(overallScore);

    // Fortification progress: how close all layers are to fortified threshold
    const fortificationProgress = this.computeFortificationProgress(layers);

    // Recovery progress: how close breached layers are to restoration
    const recoveryProgress = this.computeRecoveryProgress(layers);

    // Signal load metric
    const signalLoad = this.computeExperienceScore(tick);

    // Check fortified status
    let fortified = layers.length > 0;
    for (const layer of layers) {
      if (layer.integrityRatio < SHIELD_CONSTANTS.FORTIFIED_THRESHOLD) {
        fortified = false;
        break;
      }
    }

    return {
      overallGrade,
      overallScore,
      layerReports: Object.freeze(layerReports),
      breachedLayerCount,
      fortified,
      fortificationProgress,
      recoveryProgress,
      tick,
      signalLoad,
    };
  }

  /**
   * Compute fortification progress (0-1).
   * 1.0 = all layers at or above FORTIFIED_THRESHOLD.
   * Measures minimum layer ratio relative to the threshold.
   */
  public computeFortificationProgress(
    layers: readonly ShieldLayerState[],
  ): number {
    if (layers.length === 0) return 0;

    let minProgress = 1.0;
    for (const layer of layers) {
      const progress = layer.integrityRatio / SHIELD_CONSTANTS.FORTIFIED_THRESHOLD;
      if (progress < minProgress) {
        minProgress = progress;
      }
    }

    return clamp01(minProgress);
  }

  /**
   * Compute recovery progress (0-1).
   * Measures how far breached or damaged layers have recovered.
   * 1.0 = all layers at full HP.
   */
  public computeRecoveryProgress(
    layers: readonly ShieldLayerState[],
  ): number {
    if (layers.length === 0) return 1.0;

    let totalDeficit = 0;
    let totalCapacity = 0;

    for (const layer of layers) {
      totalDeficit += layer.max - layer.current;
      totalCapacity += layer.max;
    }

    if (totalCapacity === 0) return 1.0;

    return clamp01(1.0 - totalDeficit / totalCapacity);
  }

  /**
   * Compute a single urgency number (0-1) representing how much player
   * attention the shield system needs right now.
   */
  public computeUrgencyScore(
    layers: readonly ShieldLayerState[],
    tick: number,
    cascadeActive: boolean,
  ): number {
    let score = 0;

    // Base score from layer health
    for (const layer of layers) {
      const config = getLayerConfig(layer.layerId);
      const weight = LAYER_DEPTH_WEIGHT[layer.layerId];

      if (layer.breached) {
        score += 0.15 * weight;
      } else if (layer.integrityRatio < SHIELD_CONSTANTS.CRITICAL_WARNING_THRESHOLD) {
        score += 0.12 * weight;
      } else if (layer.integrityRatio < SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD) {
        score += 0.08 * weight;
      }

      // Cascade gate bonus penalty
      if (config.cascadeGate && layer.integrityRatio < SHIELD_CONSTANTS.CASCADE_CRACK_RATIO) {
        score += 0.15;
      }
    }

    // Cascade active penalty
    if (cascadeActive) {
      score += 0.20;
    }

    // Rapid damage pattern penalty
    const recentPatterns = this.detectedPatterns.filter(
      (p: UXPattern) => tick - p.detectedAtTick <= 3,
    );
    for (const pattern of recentPatterns) {
      if (pattern.patternType === 'RAPID_DAMAGE') score += 0.10;
      if (pattern.patternType === 'FULL_COLLAPSE') score += 0.20;
      if (pattern.patternType === 'CASCADE_SPIRAL') score += 0.15;
    }

    // Trend degradation penalty
    const slope = this.computeIntegritySlope(tick, 5);
    if (slope < -0.05) {
      score += 0.10;
    }

    return clamp01(score);
  }

  /**
   * Compute a per-layer damage absorption score.
   * Measures how effectively each layer has been absorbing damage
   * based on its regen rate and remaining HP.
   */
  public computeLayerAbsorptionScore(
    layer: ShieldLayerState,
  ): number {
    const config = getLayerConfig(layer.layerId);

    if (config.max <= 0) return 0;

    // Base: current integrity
    let score = layer.integrityRatio;

    // Bonus for high regen relative to max
    const regenRatio = layer.regenPerTick / config.max;
    score += regenRatio * 0.2;

    // Penalty for being breached
    if (layer.breached) {
      score = Math.max(0, score - 0.3);
    }

    // Cascade gate layers get harsher scoring
    if (config.cascadeGate) {
      if (layer.integrityRatio < SHIELD_CONSTANTS.CASCADE_CRACK_RATIO) {
        score *= 0.5;
      }
    }

    return clamp01(score);
  }

  /**
   * Compute deflection effectiveness based on current shield state.
   * Returns the actual deflection rate considering fortified status
   * and per-layer integrity.
   */
  public computeDeflectionRate(
    layers: readonly ShieldLayerState[],
  ): {
    readonly baseDeflection: number;
    readonly fortifiedBonus: number;
    readonly effectiveDeflection: number;
    readonly atMaxDeflection: boolean;
  } {
    // Compute weighted average integrity for base deflection
    const weightedHealth = computeWeightedShieldHealth(layers);
    const baseDeflection = weightedHealth * SHIELD_CONSTANTS.DEFLECTION_FULL_INTEGRITY;

    // Check fortified status
    let fortified = layers.length > 0;
    for (const layer of layers) {
      if (layer.integrityRatio < SHIELD_CONSTANTS.FORTIFIED_THRESHOLD) {
        fortified = false;
        break;
      }
    }

    const fortifiedBonus = fortified ? SHIELD_CONSTANTS.FORTIFIED_BONUS_DEFLECT : 0;
    const rawDeflection = baseDeflection + fortifiedBonus;
    const effectiveDeflection = Math.min(rawDeflection, SHIELD_CONSTANTS.DEFLECTION_MAX);
    const atMaxDeflection = effectiveDeflection >= SHIELD_CONSTANTS.DEFLECTION_MAX;

    return {
      baseDeflection,
      fortifiedBonus,
      effectiveDeflection,
      atMaxDeflection,
    };
  }

  /**
   * Compute time-to-breach estimation for each layer.
   * Returns null for layers that are not currently losing HP.
   */
  public computeTimeToBreachEstimates(
    layers: readonly ShieldLayerState[],
    tick: number,
  ): readonly { readonly layerId: ShieldLayerId; readonly ticksToBreach: number | null }[] {
    const result: { readonly layerId: ShieldLayerId; readonly ticksToBreach: number | null }[] = [];

    for (const layer of layers) {
      const damageLog = this.perLayerDamageLog.get(layer.layerId);
      let recentDamageRate = 0;

      if (damageLog && damageLog.length > 0) {
        const windowTicks = 5;
        const recentHits = damageLog.filter(
          (t: number) => tick - t <= windowTicks,
        );
        // Rough estimate: assume each hit does ~5% of max
        const config = getLayerConfig(layer.layerId);
        recentDamageRate = recentHits.length > 0
          ? (recentHits.length * config.max * 0.05) / windowTicks
          : 0;
      }

      const ticksToBreach = estimateTicksToBreach(
        layer.current,
        layer.regenPerTick,
        recentDamageRate,
      );

      result.push({ layerId: layer.layerId, ticksToBreach });
    }

    return Object.freeze(result);
  }

  /**
   * Build the full UX tick output: snapshot + patterns + signals + grade.
   * This is the main tick-level integration point for the UX layer.
   */
  public processUXTick(
    previousLayers: readonly ShieldLayerState[],
    nextLayers: readonly ShieldLayerState[],
    tick: number,
    cascadeActive: boolean,
    wasFortified: boolean,
    isFortified: boolean,
  ): {
    readonly snapshot: ShieldUXSnapshot;
    readonly patterns: readonly UXPattern[];
    readonly signals: readonly EngineSignal[];
    readonly gradeReport: ShieldGradeReport;
    readonly narrative: NarrativeContext;
    readonly urgency: number;
  } {
    // Record snapshot
    const snapshot = this.recordSnapshot(nextLayers, tick, cascadeActive);

    // Detect patterns
    const patterns = this.detectPatterns(tick);

    // Build all signals
    const transitionSignals = this.buildTransitionSignals(previousLayers, nextLayers, tick);
    const fortifiedSignals = this.buildFortifiedSignals(wasFortified, isFortified, tick);
    const patternSignals = this.buildPatternSignals(patterns, tick);
    const damageRateSignals = this.buildDamageRateSignals(tick);

    // Check for total collapse
    const collapseSignal = this.buildTotalCollapseSignal(nextLayers, tick);

    // Aggregate and deduplicate all signals
    const rawSignals: EngineSignal[] = [
      ...transitionSignals,
      ...fortifiedSignals,
      ...patternSignals,
      ...damageRateSignals,
    ];
    if (collapseSignal !== null) {
      rawSignals.push(collapseSignal);
    }

    const signals = this.deduplicateSignals(rawSignals, tick);

    // Build grade report
    const gradeReport = this.buildShieldGradeReport(nextLayers, tick);

    // Generate status narrative
    const narrative = this.generateStatusNarrative(nextLayers, tick);

    // Compute urgency
    const urgency = this.computeUrgencyScore(nextLayers, tick, cascadeActive);

    return {
      snapshot,
      patterns,
      signals,
      gradeReport,
      narrative,
      urgency,
    };
  }

  /**
   * Process a complete UX tick and emit all relevant bus events.
   * Combines processUXTick with bus integration.
   */
  public processAndEmitUXTick(
    bus: EventBus<EngineEventMap & Record<string, unknown>>,
    previousLayers: readonly ShieldLayerState[],
    nextLayers: readonly ShieldLayerState[],
    tick: number,
    cascadeActive: boolean,
    wasFortified: boolean,
    isFortified: boolean,
  ): {
    readonly snapshot: ShieldUXSnapshot;
    readonly patterns: readonly UXPattern[];
    readonly signals: readonly EngineSignal[];
    readonly gradeReport: ShieldGradeReport;
    readonly narrative: NarrativeContext;
    readonly urgency: number;
    readonly busBatch: BusEventBatch;
  } {
    const result = this.processUXTick(
      previousLayers,
      nextLayers,
      tick,
      cascadeActive,
      wasFortified,
      isFortified,
    );

    // Emit bus events
    const busBatch = this.emitShieldTickBatch(
      bus,
      nextLayers,
      tick,
      result.signals,
    );

    // Emit pattern events
    for (const pattern of result.patterns) {
      this.emitPatternDetected(bus, pattern, tick);
    }

    // Check for signal overload
    this.emitSignalOverloadWarning(bus, tick, result.signals.length);

    return {
      ...result,
      busBatch,
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // S 7 — Additional scoring methods
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Compute a composite shield resilience score (0-100).
   * Combines health, deflection, recovery rate, and pattern stability.
   */
  public computeResilienceScore(
    layers: readonly ShieldLayerState[],
    tick: number,
  ): number {
    // Health component (40%)
    const healthScore = computeWeightedShieldHealth(layers) * 40;

    // Deflection component (20%)
    const deflection = this.computeDeflectionRate(layers);
    const deflectionScore = (deflection.effectiveDeflection / SHIELD_CONSTANTS.DEFLECTION_MAX) * 20;

    // Recovery rate component (20%)
    let totalRegen = 0;
    let totalMax = 0;
    for (const layer of layers) {
      totalRegen += layer.regenPerTick;
      totalMax += layer.max;
    }
    const regenRatio = totalMax > 0 ? totalRegen / totalMax : 0;
    const recoveryScore = clamp01(regenRatio * 10) * 20;

    // Stability component (20%) — lower volatility = more stable
    const volatility = this.computeVolatility(tick, 10);
    const stabilityScore = (1.0 - clamp01(volatility * 5)) * 20;

    return Math.round(healthScore + deflectionScore + recoveryScore + stabilityScore);
  }

  /**
   * Compute a per-layer priority ranking for the player.
   * Returns layers sorted by how urgently they need attention,
   * with the most critical layer first.
   */
  public computeLayerPriorityRanking(
    layers: readonly ShieldLayerState[],
    tick: number,
  ): readonly {
    readonly layerId: ShieldLayerId;
    readonly priority: number;
    readonly reason: string;
  }[] {
    const ranked: {
      layerId: ShieldLayerId;
      priority: number;
      reason: string;
    }[] = [];

    for (const layer of layers) {
      const config = getLayerConfig(layer.layerId);
      let priority = 0;
      let reason = 'stable';

      if (layer.breached) {
        priority += 100;
        reason = 'breached';
      }

      if (layer.integrityRatio < SHIELD_CONSTANTS.CRITICAL_WARNING_THRESHOLD) {
        priority += 80;
        reason = 'critical';
      } else if (layer.integrityRatio < SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD) {
        priority += 50;
        reason = 'low integrity';
      }

      // Cascade gate bonus
      if (config.cascadeGate) {
        priority += 30;
        if (layer.integrityRatio < SHIELD_CONSTANTS.CASCADE_CRACK_RATIO) {
          priority += 50;
          reason = 'cascade gate cracking';
        }
      }

      // Check for recent rapid damage
      const damageLog = this.perLayerDamageLog.get(layer.layerId);
      if (damageLog) {
        const recentHits = damageLog.filter(
          (t: number) => tick - t <= RAPID_DAMAGE_WINDOW_TICKS,
        );
        if (recentHits.length >= RAPID_DAMAGE_EVENT_THRESHOLD) {
          priority += 20;
          reason = `under rapid attack (${recentHits.length} recent hits)`;
        }
      }

      // Zero regen penalty
      if (layer.regenPerTick === 0 && !layer.breached && layer.current < layer.max) {
        priority += 15;
        reason = 'no regeneration';
      }

      ranked.push({
        layerId: layer.layerId,
        priority,
        reason,
      });
    }

    // Sort by priority descending
    ranked.sort((a, b) => b.priority - a.priority);

    return Object.freeze(ranked);
  }

  /**
   * Compute whether the shield system is in a "safe zone" — all layers
   * above LOW_WARNING_THRESHOLD with no active patterns of concern.
   */
  public isInSafeZone(
    layers: readonly ShieldLayerState[],
    tick: number,
  ): boolean {
    for (const layer of layers) {
      if (layer.integrityRatio < SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD) {
        return false;
      }
    }

    // Check for dangerous patterns in recent ticks
    const recentDangerPatterns = this.detectedPatterns.filter(
      (p: UXPattern) =>
        tick - p.detectedAtTick <= 5 &&
        (p.patternType === 'RAPID_DAMAGE' ||
          p.patternType === 'CASCADE_SPIRAL' ||
          p.patternType === 'FULL_COLLAPSE'),
    );

    return recentDangerPatterns.length === 0;
  }

  /**
   * Generate a compact shield status string for logging or debug display.
   */
  public formatShieldStatus(
    layers: readonly ShieldLayerState[],
  ): string {
    const parts: string[] = [];

    for (const id of LAYER_ORDER) {
      const layer = layers.find(
        (l: ShieldLayerState) => l.layerId === id,
      );
      if (!layer) continue;

      const config = getLayerConfig(layer.layerId);
      const pct = (layer.integrityRatio * 100).toFixed(0);
      const status = layer.breached ? 'X' : `${pct}%`;
      parts.push(`${config.doctrineName}:${status}`);
    }

    return parts.join(' | ');
  }

  /**
   * Get the full detected pattern history for inspection.
   */
  public getPatternHistory(): readonly UXPattern[] {
    return Object.freeze([...this.detectedPatterns]);
  }

  /**
   * Get the session start tick.
   */
  public getSessionStartTick(): number | null {
    return this.sessionStartTick;
  }

  /**
   * Get the number of snapshots in history.
   */
  public getSnapshotCount(): number {
    return this.snapshotHistory.length;
  }

  /**
   * Reset the UX bridge state for a new session.
   * Clears all history, logs, and counters.
   */
  public reset(): void {
    this.snapshotHistory.length = 0;
    this.signalLog.length = 0;
    this.detectedPatterns.length = 0;
    this.throttleMap.clear();
    this.perLayerDamageLog.clear();
    this.sessionBreachCount = 0;
    this.sessionRecoveryCount = 0;
    this.sessionCascadeCount = 0;
    this.sessionSignalCount = 0;
    this.sessionStartTick = null;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Describe a layer by its repair ID (may be 'ALL' or a specific layer).
   */
  private describeLayer(layerId: RepairLayerId): string {
    if (layerId === 'ALL') {
      return 'ALL';
    }

    return getLayerConfig(layerId).doctrineName;
  }

  /**
   * Record a signal emission for analytics tracking.
   */
  private recordSignal(
    signalCode: string,
    tick: number,
    layerId: ShieldLayerId | null,
    severity: 'INFO' | 'WARN' | 'ERROR',
  ): void {
    this.signalLog.push({
      signalCode,
      tick,
      layerId,
      severity,
    });

    this.sessionSignalCount++;

    // Trim signal log to bounded size
    const maxLogSize = SHIELD_CONSTANTS.MAX_HISTORY_DEPTH * 4;
    while (this.signalLog.length > maxLogSize) {
      this.signalLog.shift();
    }
  }

  /**
   * Record a damage event for a specific layer.
   */
  private recordLayerDamage(layerId: ShieldLayerId, tick: number): void {
    let log = this.perLayerDamageLog.get(layerId);
    if (!log) {
      log = [];
      this.perLayerDamageLog.set(layerId, log);
    }

    log.push(tick);

    // Trim per-layer log
    const maxLog = SHIELD_CONSTANTS.MAX_HISTORY_DEPTH;
    while (log.length > maxLog) {
      log.shift();
    }
  }

  /**
   * Check if a throttle key is currently active.
   */
  private isThrottled(key: string, tick: number): boolean {
    const lastTick = this.throttleMap.get(key);
    if (lastTick === undefined) return false;
    return tick - lastTick < SIGNAL_THROTTLE_WINDOW_TICKS;
  }

  /**
   * Mark a throttle key as active at the given tick.
   */
  private markThrottled(key: string, tick: number): void {
    this.throttleMap.set(key, tick);

    // Periodically clean stale throttle entries
    if (this.throttleMap.size > 200) {
      const cutoff = tick - SIGNAL_THROTTLE_WINDOW_TICKS * 2;
      for (const [k, t] of this.throttleMap) {
        if (t < cutoff) {
          this.throttleMap.delete(k);
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // S 8  — Cross-Engine Snapshot Analysis
  //
  // Methods that take RunStateSnapshot and produce cross-engine UX analysis
  // correlating shield state with pressure, tension, battle, economy, and
  // cascade engines. Every method reads multiple snapshot sub-trees at runtime.
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Produce a comprehensive UX report correlating shield state with ALL other
   * engines. Reads every sub-tree of the snapshot at runtime and produces a
   * unified cross-engine assessment for the player-facing UX layer.
   */
  public analyzeFullSnapshot(snapshot: RunStateSnapshot): {
    readonly tick: number;
    readonly mode: ModeCode;
    readonly phase: RunPhase;
    readonly outcome: RunOutcome | null;
    readonly shieldGrade: ShieldHealthGrade;
    readonly shieldDangerLevels: readonly { layerId: ShieldLayerId; danger: LayerDangerLevel }[];
    readonly crossEngineRiskScore: number;
    readonly pressureCorrelation: number;
    readonly tensionCorrelation: number;
    readonly battleCorrelation: number;
    readonly economyCorrelation: number;
    readonly cascadeCorrelation: number;
    readonly overallPlayerState: string;
    readonly defensivePosture: number;
    readonly weightedIntegrity: number;
    readonly narrativeSummary: string;
  } {
    const { shield, economy, pressure, tension, battle, cascade, sovereignty } = snapshot;
    const mode: ModeCode = snapshot.mode;
    const phase: RunPhase = snapshot.phase;
    const tick = snapshot.tick;
    const outcome: RunOutcome | null = snapshot.outcome;

    // Compute shield-specific metrics using imported functions
    const layers = shield.layers;
    const weightedIntegrity = computeWeightedIntegrity(layers);
    const defensivePosture = scoreDefensivePosture(layers);
    const shieldGrade: ShieldHealthGrade = computeGradeFromScore(weightedIntegrity);

    // Per-layer danger levels
    const shieldDangerLevels = SHIELD_LAYER_ORDER.map((layerId) => {
      const layerState = layers.find((l) => l.layerId === layerId);
      const ratio = layerState ? layerState.integrityRatio : 0;
      const danger: LayerDangerLevel = computeLayerDangerLevel(ratio);
      return { layerId, danger };
    });

    // Cross-engine correlation scores
    const crossEngineRiskScore = this.computeCrossEngineRiskScore(snapshot);
    const pressureCorrelation = this.computeShieldPressureCorrelation(snapshot);
    const tensionCorrelation = this.computeShieldTensionCorrelation(snapshot);
    const battleCorrelation = this.computeShieldBattleCorrelation(snapshot);
    const economyCorrelation = this.computeShieldEconomyCorrelation(snapshot);
    const cascadeCorrelation = this.computeShieldCascadeCorrelation(snapshot);
    const overallPlayerState = this.assessOverallPlayerState(snapshot);

    // Runtime reads of snapshot sub-trees for narrative
    const pressureLabel = PRESSURE_TIER_URGENCY_LABEL[pressure.tier];
    const difficultyMult = MODE_DIFFICULTY_MULTIPLIER[mode];
    const stakesMult = RUN_PHASE_STAKES_MULTIPLIER[phase];
    const pressureNorm = PRESSURE_TIER_NORMALIZED[pressure.tier];

    // Build narrative summary accessing all cross-engine data
    const narrativeParts: string[] = [];

    narrativeParts.push(
      `Shield integrity ${Math.round(weightedIntegrity * 100)}% (grade ${shieldGrade}).`,
    );
    narrativeParts.push(
      `Pressure: ${pressureLabel} (${Math.round(pressureNorm * 100)}%). ` +
      `Tension score: ${tension.score.toFixed(2)}.`,
    );
    narrativeParts.push(
      `Mode difficulty: ${difficultyMult.toFixed(1)}x. Stakes: ${stakesMult.toFixed(2)}x.`,
    );

    if (shield.breachesThisRun > 0) {
      narrativeParts.push(
        `${shield.breachesThisRun} breach(es) this run. ` +
        `Economy net worth: ${economy.netWorth}. Debt: ${economy.debt}.`,
      );
    }

    if (battle.bots.some((b) => b.state === 'ATTACKING' as BotState)) {
      const attackingCount = battle.bots.filter(
        (b) => b.state === ('ATTACKING' as BotState),
      ).length;
      narrativeParts.push(`${attackingCount} bot(s) actively attacking.`);
    }

    if (cascade.activeChains.length > 0) {
      narrativeParts.push(
        `${cascade.activeChains.length} active cascade chain(s). ` +
        `${cascade.brokenChains} broken.`,
      );
    }

    if (sovereignty.integrityStatus !== 'VERIFIED') {
      narrativeParts.push(`Sovereignty integrity: ${sovereignty.integrityStatus}.`);
    }

    const narrativeSummary = narrativeParts.join(' ');

    return {
      tick,
      mode,
      phase,
      outcome,
      shieldGrade,
      shieldDangerLevels,
      crossEngineRiskScore,
      pressureCorrelation,
      tensionCorrelation,
      battleCorrelation,
      economyCorrelation,
      cascadeCorrelation,
      overallPlayerState,
      defensivePosture,
      weightedIntegrity,
      narrativeSummary,
    };
  }

  /**
   * Compute a weighted cross-engine risk score combining shield state with
   * pressure, tension, battle, economy, and cascade subsystems.
   * Returns 0-1 where 1 is maximum danger.
   */
  public computeCrossEngineRiskScore(snapshot: RunStateSnapshot): number {
    const { shield, economy, pressure, tension, battle, cascade } = snapshot;
    const mode: ModeCode = snapshot.mode;
    const phase: RunPhase = snapshot.phase;
    const layers = shield.layers;

    // Shield risk component (weight: 0.30)
    const shieldIntegrity = computeWeightedIntegrity(layers);
    const shieldRisk = (1 - shieldIntegrity) * 0.30;

    // Pressure risk component (weight: 0.20)
    const pressureNorm = PRESSURE_TIER_NORMALIZED[pressure.tier];
    const pressureRisk = pressureNorm * 0.20;

    // Tension risk component (weight: 0.10)
    const tensionFloor = MODE_TENSION_FLOOR[mode];
    const tensionExcess = Math.max(0, tension.score - tensionFloor);
    const tensionRisk = Math.min(1, tensionExcess / (1 - tensionFloor + 0.001)) * 0.10;

    // Battle risk component (weight: 0.15)
    let botThreatSum = 0;
    for (const bot of battle.bots) {
      const botId = bot.botId as HaterBotId;
      const botState = bot.state as BotState;
      const baseThreat = BOT_THREAT_LEVEL[botId];
      const stateMult = BOT_STATE_THREAT_MULTIPLIER[botState];
      botThreatSum += baseThreat * stateMult;
    }
    const battleRisk = Math.min(1, botThreatSum / 2.0) * 0.15;

    // Economy risk component (weight: 0.15)
    const netWorthRatio = economy.freedomTarget > 0
      ? Math.min(1, economy.netWorth / economy.freedomTarget)
      : 0;
    const economyRisk = (1 - netWorthRatio) * 0.10;
    const debtPressure = economy.debt > 0
      ? Math.min(1, economy.debt / (economy.netWorth + economy.debt + 1))
      : 0;
    const debtRisk = debtPressure * 0.05;

    // Cascade risk component (weight: 0.10)
    const cascadeRisk =
      (cascade.activeChains.length > 0 ? 0.05 : 0) +
      (cascade.brokenChains > 0 ? Math.min(0.05, cascade.brokenChains * 0.015) : 0);

    // Difficulty and stakes amplifiers
    const difficultyAmp = MODE_DIFFICULTY_MULTIPLIER[mode];
    const stakesAmp = RUN_PHASE_STAKES_MULTIPLIER[phase];

    const rawRisk = shieldRisk + pressureRisk + tensionRisk + battleRisk +
      economyRisk + debtRisk + cascadeRisk;

    // Amplify by difficulty and stakes — cap at 1.0
    return Math.min(1, rawRisk * (difficultyAmp * 0.5 + stakesAmp * 0.5));
  }

  /**
   * Compute how the current pressure tier affects shield UX urgency.
   * Higher pressure increases the urgency of shield warnings.
   * Returns 0-1 correlation strength.
   */
  public computeShieldPressureCorrelation(snapshot: RunStateSnapshot): number {
    const { shield, pressure } = snapshot;
    const layers = shield.layers;

    const pressureNorm = PRESSURE_TIER_NORMALIZED[pressure.tier];
    const pressureLabel = PRESSURE_TIER_URGENCY_LABEL[pressure.tier];
    const shieldIntegrity = computeWeightedIntegrity(layers);

    // When pressure is high AND shield is low, correlation is maximal
    const inverseIntegrity = 1 - shieldIntegrity;
    const rawCorrelation = pressureNorm * inverseIntegrity;

    // Bonus for breached layers under high pressure
    let breachBonus = 0;
    for (const layer of layers) {
      if (layer.breached) {
        const config = SHIELD_LAYER_CONFIGS[layer.layerId];
        const layerWeight = LAYER_HEALTH_WEIGHT[layer.layerId];
        breachBonus += layerWeight * (config.cascadeGate ? 0.15 : 0.08);
      }
    }

    // Access pressure state deeply
    const survivedHighTicks = pressure.survivedHighPressureTicks;
    const sustainedPressureBonus = survivedHighTicks > 10
      ? Math.min(0.1, survivedHighTicks * 0.005)
      : 0;

    // Use pressureLabel at runtime for logging/tracking
    void pressureLabel;

    return Math.min(1, rawCorrelation + breachBonus + sustainedPressureBonus);
  }

  /**
   * Compute how visible threats in the tension subsystem correlate with
   * shield damage patterns. Returns 0-1 correlation strength.
   */
  public computeShieldTensionCorrelation(snapshot: RunStateSnapshot): number {
    const { shield, tension } = snapshot;
    const mode: ModeCode = snapshot.mode;
    const layers = shield.layers;

    const tensionFloor = MODE_TENSION_FLOOR[mode];
    const tensionScore = tension.score;
    const visibleThreatCount = tension.visibleThreats.length;

    // Base correlation: tension score vs shield damage
    const shieldDamageRatio = shield.damagedThisRun > 0
      ? Math.min(1, shield.damagedThisRun / 20)
      : 0;
    const tensionExcess = Math.max(0, tensionScore - tensionFloor);
    const baseCorrrelation = tensionExcess * shieldDamageRatio;

    // Visible threats pushing against weak layers
    let threatLayerPressure = 0;
    if (visibleThreatCount > 0) {
      for (const layer of layers) {
        const danger: LayerDangerLevel = computeLayerDangerLevel(layer.integrityRatio);
        if (danger === 'CRITICAL' || danger === 'SEVERE') {
          threatLayerPressure += visibleThreatCount * 0.05;
        }
      }
    }

    // Anticipation factor: high anticipation + low shield = high correlation
    const anticipationCorr = tension.anticipation * (1 - computeWeightedIntegrity(layers)) * 0.15;

    // Max pulse triggered = extreme tension
    const maxPulseBonus = tension.maxPulseTriggered ? 0.1 : 0;

    return Math.min(1, baseCorrrelation + threatLayerPressure + anticipationCorr + maxPulseBonus);
  }

  /**
   * Compute how bot states in the battle subsystem drive shield attack patterns.
   * Returns 0-1 correlation between battle state and shield damage.
   */
  public computeShieldBattleCorrelation(snapshot: RunStateSnapshot): number {
    const { shield, battle } = snapshot;
    const layers = shield.layers;

    let activeBotThreat = 0;
    let totalBotThreat = 0;

    for (const bot of battle.bots) {
      const botId = bot.botId as HaterBotId;
      const botState = bot.state as BotState;
      const baseThreat = BOT_THREAT_LEVEL[botId];
      const stateMult = BOT_STATE_THREAT_MULTIPLIER[botState];
      const effectiveThreat = baseThreat * stateMult;
      totalBotThreat += baseThreat;
      activeBotThreat += effectiveThreat;
    }

    // Normalize bot threat
    const botThreatRatio = totalBotThreat > 0
      ? activeBotThreat / totalBotThreat
      : 0;

    // Shield damage from bots — correlate with shield weakness
    const shieldWeakness = 1 - computeWeightedIntegrity(layers);
    const baseCorrrelation = botThreatRatio * shieldWeakness;

    // Attack categories from pending attacks
    let categoryWeight = 0;
    for (const attack of battle.pendingAttacks) {
      const cat = attack.category as AttackCategory;
      const magnitude = ATTACK_CATEGORY_BASE_MAGNITUDE[cat];
      const severityW = ATTACK_CATEGORY_SEVERITY_WEIGHT[cat];
      categoryWeight += magnitude * severityW;
    }
    const attackCategoryBonus = Math.min(0.2, categoryWeight * 0.05);

    // Battle budget depletion amplifies vulnerability
    const budgetRatio = battle.battleBudgetCap > 0
      ? battle.battleBudget / battle.battleBudgetCap
      : 0;
    const budgetDepletion = (1 - budgetRatio) * 0.1;

    // Neutralized bots reduce correlation
    const neutralizedDiscount = battle.neutralizedBotIds.length * 0.03;

    return Math.min(
      1,
      baseCorrrelation + attackCategoryBonus + budgetDepletion - neutralizedDiscount,
    );
  }

  /**
   * Compute how economy health provides context for shield damage severity.
   * A player with poor economy feels shield damage more acutely.
   * Returns 0-1 correlation strength.
   */
  public computeShieldEconomyCorrelation(snapshot: RunStateSnapshot): number {
    const { shield, economy } = snapshot;
    const layers = shield.layers;

    // Net worth progress toward freedom
    const netWorthProgress = economy.freedomTarget > 0
      ? Math.min(1, economy.netWorth / economy.freedomTarget)
      : 0;

    // Income vs expenses ratio
    const incomeExpenseRatio = economy.expensesPerTick > 0
      ? economy.incomePerTick / economy.expensesPerTick
      : economy.incomePerTick > 0 ? 2.0 : 1.0;
    const incomeStress = Math.max(0, 1 - incomeExpenseRatio);

    // Debt burden
    const debtBurden = economy.netWorth > 0
      ? Math.min(1, economy.debt / (economy.netWorth + 1))
      : economy.debt > 0 ? 1.0 : 0;

    // Shield integrity
    const shieldIntegrity = computeWeightedIntegrity(layers);
    const shieldWeakness = 1 - shieldIntegrity;

    // Low economy + low shield = very high correlation
    const economyDistress = (1 - netWorthProgress) * 0.4 + incomeStress * 0.3 + debtBurden * 0.3;
    const baseCorrrelation = economyDistress * shieldWeakness;

    // Per-layer config check: breached layers with high repair cost
    let repairCostPressure = 0;
    for (const layer of layers) {
      if (layer.integrityRatio < 0.5) {
        const config = SHIELD_LAYER_CONFIGS[layer.layerId];
        const deficit = config.max - layer.current;
        repairCostPressure += deficit * 0.001;
      }
    }

    // Hater heat correlation with shield state
    const heatFactor = Math.min(0.1, economy.haterHeat * 0.01);

    return Math.min(1, baseCorrrelation + repairCostPressure + heatFactor);
  }

  /**
   * Compute how cascade chains impact shield UX priority. Active cascades
   * make shield state much more critical because L4 breach drives cascades.
   * Returns 0-1 correlation strength.
   */
  public computeShieldCascadeCorrelation(snapshot: RunStateSnapshot): number {
    const { shield, cascade } = snapshot;
    const layers = shield.layers;

    // L4 is the cascade gate — its health is paramount
    const l4State = layers.find((l) => l.layerId === 'L4');
    const l4Integrity = l4State ? l4State.integrityRatio : 0;
    const l4Config = SHIELD_LAYER_CONFIGS['L4'];
    const l4CascadeGate = l4Config.cascadeGate; // true

    // Active chains amplify shield urgency
    const activeChainCount = cascade.activeChains.length;
    const brokenChainCount = cascade.brokenChains;
    const completedChains = cascade.completedChains;

    // Base correlation: L4 weakness + active cascades
    let baseCorrrelation = 0;
    if (l4CascadeGate) {
      baseCorrrelation = (1 - l4Integrity) * 0.4;
    }

    // Active cascades amplify shield urgency
    const cascadeAmplifier = Math.min(0.3, activeChainCount * 0.1);

    // Broken chains indicate past cascade failures
    const brokenChainPenalty = Math.min(0.15, brokenChainCount * 0.05);

    // Completed chains provide some safety
    const completedDiscount = Math.min(0.1, completedChains * 0.02);

    // Check repeated triggers — high repetition = cascade spiral
    let maxRepeatedCount = 0;
    for (const key of Object.keys(cascade.repeatedTriggerCounts)) {
      const count = cascade.repeatedTriggerCounts[key];
      if (count > maxRepeatedCount) maxRepeatedCount = count;
    }
    const spiralBonus = maxRepeatedCount > 3 ? Math.min(0.1, (maxRepeatedCount - 3) * 0.03) : 0;

    // Layer danger check across all layers — cascade is worse when multiple layers are weak
    let weakLayerCount = 0;
    for (const lid of SHIELD_LAYER_ORDER) {
      const layerState = layers.find((l) => l.layerId === lid);
      if (layerState) {
        const danger: LayerDangerLevel = computeLayerDangerLevel(layerState.integrityRatio);
        if (danger === 'CRITICAL' || danger === 'SEVERE' || danger === 'HIGH') {
          weakLayerCount++;
        }
      }
    }
    const multiWeakBonus = weakLayerCount > 1 ? weakLayerCount * 0.05 : 0;

    return Math.min(
      1,
      baseCorrrelation + cascadeAmplifier + brokenChainPenalty - completedDiscount +
      spiralBonus + multiWeakBonus,
    );
  }

  /**
   * Assess the overall player situation by correlating all engine states.
   * Returns a human-readable assessment string.
   */
  public assessOverallPlayerState(snapshot: RunStateSnapshot): string {
    const { shield, economy, pressure, tension, battle, cascade, sovereignty } = snapshot;
    const mode: ModeCode = snapshot.mode;
    const phase: RunPhase = snapshot.phase;
    const outcome: RunOutcome | null = snapshot.outcome;
    const tick = snapshot.tick;
    const layers = shield.layers;

    const integrity = computeWeightedIntegrity(layers);
    const grade: ShieldHealthGrade = computeGradeFromScore(integrity);
    const posture = scoreDefensivePosture(layers);
    const pressureNorm = PRESSURE_TIER_NORMALIZED[pressure.tier];
    const stakesMultiplier = RUN_PHASE_STAKES_MULTIPLIER[phase];
    const difficultyMult = MODE_DIFFICULTY_MULTIPLIER[mode];
    const tensionFloor = MODE_TENSION_FLOOR[mode];
    const budgetFraction = RUN_PHASE_TICK_BUDGET_FRACTION[phase];

    // Count active attacking bots
    let attackingBots = 0;
    for (const bot of battle.bots) {
      const botState = bot.state as BotState;
      if (BOT_STATE_THREAT_MULTIPLIER[botState] >= 0.4) {
        attackingBots++;
      }
    }

    // Build assessment based on combined state
    if (outcome !== null) {
      const outcomeStr = outcome as RunOutcome;
      if (outcomeStr === 'FREEDOM') {
        return 'VICTORY — Player achieved financial freedom. Shield held.';
      }
      if (outcomeStr === 'BANKRUPT') {
        return 'DEFEAT — Net worth collapsed. Shield likely breached during final phase.';
      }
      if (outcomeStr === 'TIMEOUT') {
        return 'TIMEOUT — Season budget exhausted. Defenses held but progress stalled.';
      }
      return 'RUN ENDED — Player abandoned the run.';
    }

    // Active run assessment
    const riskScore = this.computeCrossEngineRiskScore(snapshot);
    const tickBudgetUsed = budgetFraction > 0 ? tick / (budgetFraction * 300) : 0;

    if (riskScore > 0.8) {
      return `CRITICAL — Shields at grade ${grade}, ${attackingBots} bots attacking, ` +
        `pressure ${PRESSURE_TIER_URGENCY_LABEL[pressure.tier]}. ` +
        `Immediate action required. Phase: ${phase}, stakes: ${stakesMultiplier.toFixed(2)}x.`;
    }
    if (riskScore > 0.5) {
      return `ENDANGERED — Shield posture ${Math.round(posture * 100)}%, ` +
        `tension ${tension.score.toFixed(2)} (floor ${tensionFloor.toFixed(2)}), ` +
        `${cascade.activeChains.length} cascade(s). ` +
        `Difficulty ${difficultyMult.toFixed(1)}x. Sovereignty: ${sovereignty.integrityStatus}.`;
    }
    if (riskScore > 0.25) {
      return `GUARDED — Shield grade ${grade}, economy net worth ${economy.netWorth}. ` +
        `Pressure ${pressureNorm.toFixed(2)}, tick budget ${Math.round(tickBudgetUsed * 100)}% used. ` +
        `${battle.neutralizedBotIds.length} bot(s) neutralized.`;
    }
    return `STABLE — Defenses holding at ${Math.round(integrity * 100)}% integrity. ` +
      `Economy progressing. Phase: ${phase}.`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // S 9  — Mode-Aware Shield UX
  //
  // Methods that adapt shield UX based on the current game mode.
  // Each method uses MODE_DIFFICULTY_MULTIPLIER and MODE_TENSION_FLOOR
  // with actual ModeCode keys at runtime.
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate a narrative text adapted to the current game mode.
   * Ghost mode gets the most dramatic language; coop is encouraging.
   */
  public generateModeAwareNarrative(snapshot: RunStateSnapshot): {
    readonly mode: ModeCode;
    readonly headline: string;
    readonly body: string;
    readonly urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    readonly difficultyMultiplier: number;
    readonly tensionFloor: number;
  } {
    const mode: ModeCode = snapshot.mode;
    const { shield, pressure, tension } = snapshot;
    const layers = shield.layers;
    const integrity = computeWeightedIntegrity(layers);
    const grade: ShieldHealthGrade = computeGradeFromScore(integrity);
    const difficultyMultiplier = MODE_DIFFICULTY_MULTIPLIER[mode];
    const tensionFloor = MODE_TENSION_FLOOR[mode];
    const pressureLabel = PRESSURE_TIER_URGENCY_LABEL[pressure.tier];
    const posture = scoreDefensivePosture(layers);

    // Danger levels for narrative intensity
    const dangerLevels: LayerDangerLevel[] = [];
    for (const lid of SHIELD_LAYER_ORDER) {
      const ls = layers.find((l) => l.layerId === lid);
      if (ls) {
        dangerLevels.push(computeLayerDangerLevel(ls.integrityRatio));
      }
    }
    const hasCritical = dangerLevels.includes('CRITICAL' as LayerDangerLevel);
    const hasSevere = dangerLevels.includes('SEVERE' as LayerDangerLevel);

    // Compute urgency
    let urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    const effectiveDanger = (1 - integrity) * difficultyMultiplier;
    if (effectiveDanger > 0.8 || hasCritical) urgency = 'CRITICAL';
    else if (effectiveDanger > 0.5 || hasSevere) urgency = 'HIGH';
    else if (effectiveDanger > 0.25) urgency = 'MEDIUM';

    let headline: string;
    let body: string;

    // Mode-specific narrative generation
    const modeCode: ModeCode = mode;
    if (modeCode === 'ghost') {
      headline = urgency === 'CRITICAL'
        ? 'Ghost Protocol: Shield Collapse Imminent'
        : urgency === 'HIGH'
          ? 'Ghost Protocol: Defenses Weakening'
          : 'Ghost Protocol: Shadow Shield Active';
      body = `Phantom defenses at ${Math.round(integrity * 100)}% (grade ${grade}). ` +
        `Tension floor ${tensionFloor.toFixed(2)} demands constant vigilance. ` +
        `Pressure: ${pressureLabel}. Posture: ${Math.round(posture * 100)}%.`;
    } else if (modeCode === 'pvp') {
      headline = urgency === 'CRITICAL'
        ? 'Predator Alert: Shield Breach Critical'
        : urgency === 'HIGH'
          ? 'Predator Engagement: Shield Under Fire'
          : 'Predator Stance: Shield Operational';
      body = `Competitive shield at ${Math.round(integrity * 100)}%. ` +
        `Difficulty amplifier: ${difficultyMultiplier.toFixed(1)}x. ` +
        `Rival attacks hitting hard. Pressure: ${pressureLabel}.`;
    } else if (modeCode === 'coop') {
      headline = urgency === 'CRITICAL'
        ? 'Syndicate Warning: Shared Defenses Failing'
        : urgency === 'HIGH'
          ? 'Syndicate Alert: Team Shield Stressed'
          : 'Syndicate Status: Team Defenses Holding';
      body = `Cooperative shield at ${Math.round(integrity * 100)}%. ` +
        `Shared defense multiplier: ${difficultyMultiplier.toFixed(1)}x. ` +
        `Team coordination needed. Pressure: ${pressureLabel}.`;
    } else {
      // solo
      headline = urgency === 'CRITICAL'
        ? 'Empire Alert: Shield Collapse Warning'
        : urgency === 'HIGH'
          ? 'Empire Notice: Shield Integrity Low'
          : 'Empire Status: Defenses Stable';
      body = `Solo shield at ${Math.round(integrity * 100)}% (grade ${grade}). ` +
        `Standard difficulty: ${difficultyMultiplier.toFixed(1)}x. ` +
        `Pressure: ${pressureLabel}. Defensive posture: ${Math.round(posture * 100)}%.`;
    }

    return { mode, headline, body, urgency, difficultyMultiplier, tensionFloor };
  }

  /**
   * Compute mode-specific urgency. Ghost mode has highest base urgency;
   * coop has lowest because team support is available.
   * Returns 0-1 urgency score.
   */
  public computeModeSpecificUrgency(snapshot: RunStateSnapshot): number {
    const mode: ModeCode = snapshot.mode;
    const { shield, pressure } = snapshot;
    const layers = shield.layers;

    const difficulty = MODE_DIFFICULTY_MULTIPLIER[mode];
    const tensionFloor = MODE_TENSION_FLOOR[mode];
    const pressureNorm = PRESSURE_TIER_NORMALIZED[pressure.tier];
    const integrity = computeWeightedIntegrity(layers);

    // Base urgency: inverse integrity scaled by difficulty
    const baseUrgency = (1 - integrity) * difficulty;

    // Tension floor contribution — higher floor = more base urgency
    const tensionContrib = tensionFloor * 0.2;

    // Pressure amplification
    const pressureContrib = pressureNorm * 0.3;

    // Breach count amplification
    let breachedCount = 0;
    for (const layer of layers) {
      if (layer.breached) breachedCount++;
    }
    const breachContrib = breachedCount * 0.1;

    // Layer config severity check
    let cascadeGateAtRisk = false;
    for (const layer of layers) {
      const config = SHIELD_LAYER_CONFIGS[layer.layerId];
      if (config.cascadeGate && layer.integrityRatio < SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD) {
        cascadeGateAtRisk = true;
      }
    }
    const cascadeGateBonus = cascadeGateAtRisk ? 0.15 : 0;

    return Math.min(1, baseUrgency + tensionContrib + pressureContrib + breachContrib + cascadeGateBonus);
  }

  /**
   * Build engine signals scoped to the current game mode.
   * Returns mode-tagged signals that the frontend can filter by mode presentation.
   */
  public buildModeAwareSignals(snapshot: RunStateSnapshot): readonly EngineSignal[] {
    const mode: ModeCode = snapshot.mode;
    const { shield, pressure, tension } = snapshot;
    const layers = shield.layers;
    const tick = snapshot.tick;
    const signals: EngineSignal[] = [];

    const difficulty = MODE_DIFFICULTY_MULTIPLIER[mode];
    const tensionFloor = MODE_TENSION_FLOOR[mode];
    const pressureLabel = PRESSURE_TIER_URGENCY_LABEL[pressure.tier];
    const integrity = computeWeightedIntegrity(layers);
    const posture = scoreDefensivePosture(layers);

    // Per-layer mode-aware signals
    for (const lid of SHIELD_LAYER_ORDER) {
      const ls = layers.find((l) => l.layerId === lid);
      if (!ls) continue;

      const danger: LayerDangerLevel = computeLayerDangerLevel(ls.integrityRatio);
      const config = SHIELD_LAYER_CONFIGS[lid];
      const layerWeight = LAYER_HEALTH_WEIGHT[lid];

      // Only emit signals for layers that are in danger
      if (danger === 'SAFE' || danger === 'GUARDED') continue;

      const effectiveDanger = (1 - ls.integrityRatio) * difficulty;
      const severity = effectiveDanger > 0.7 ? 'ERROR' : effectiveDanger > 0.4 ? 'WARN' : 'INFO';

      signals.push(
        createEngineSignal(
          'shield',
          severity as 'INFO' | 'WARN' | 'ERROR',
          `SHIELD_MODE_${mode.toUpperCase()}_LAYER_${lid}`,
          `[${mode}] ${config.doctrineName} at ${Math.round(ls.integrityRatio * 100)}% ` +
          `(danger: ${danger}, weight: ${layerWeight.toFixed(2)})`,
          tick,
          [`mode:${mode}`, `layer:${lid}`],
        ),
      );
    }

    // Overall mode status signal
    if (integrity < SHIELD_CONSTANTS.CRITICAL_WARNING_THRESHOLD * difficulty) {
      signals.push(
        createEngineSignal(
          'shield',
          'ERROR',
          `SHIELD_MODE_${mode.toUpperCase()}_CRITICAL`,
          `[${mode}] Critical shield failure. Integrity ${Math.round(integrity * 100)}%. ` +
          `Pressure: ${pressureLabel}. Difficulty: ${difficulty.toFixed(1)}x. ` +
          `Tension excess: ${Math.max(0, tension.score - tensionFloor).toFixed(2)}.`,
          tick,
          [`mode:${mode}`],
        ),
      );
    }

    // Defensive posture signal
    if (posture < 0.3) {
      signals.push(
        createEngineSignal(
          'shield',
          'WARN',
          `SHIELD_MODE_${mode.toUpperCase()}_POSTURE_LOW`,
          `[${mode}] Defensive posture critically low at ${Math.round(posture * 100)}%.`,
          tick,
          [`mode:${mode}`],
        ),
      );
    }

    return signals;
  }

  /**
   * Get the shield difficulty multiplier for a given mode.
   * Uses MODE_DIFFICULTY_MULTIPLIER at runtime with actual ModeCode keys.
   */
  public getModeShieldDifficultyMultiplier(mode: ModeCode): number {
    return MODE_DIFFICULTY_MULTIPLIER[mode];
  }

  /**
   * Compute how the mode tension floor impacts shield layer health.
   * Higher tension floors mean the system is always somewhat stressed,
   * which compounds with low shield integrity to create urgency.
   * Returns a 0-1 impact score.
   */
  public computeModeTensionFloorImpact(
    mode: ModeCode,
    layers: readonly ShieldLayerState[],
  ): number {
    const tensionFloor = MODE_TENSION_FLOOR[mode];
    const difficulty = MODE_DIFFICULTY_MULTIPLIER[mode];
    const integrity = computeWeightedIntegrity(layers);

    // Base impact: tension floor * inverse integrity
    const baseImpact = tensionFloor * (1 - integrity);

    // Layer-specific amplification from configs
    let configAmplifier = 0;
    for (const lid of SHIELD_LAYER_ORDER) {
      const ls = layers.find((l) => l.layerId === lid);
      if (!ls) continue;
      const config = SHIELD_LAYER_CONFIGS[lid];
      const weight = LAYER_HEALTH_WEIGHT[lid];
      // Layers with low regen suffer more from sustained tension
      const regenStress = config.passiveRegenRate > 0
        ? (1 - ls.regenPerTick / config.passiveRegenRate) * tensionFloor
        : tensionFloor;
      configAmplifier += regenStress * weight;
    }

    // Difficulty scaling
    const difficultyScale = difficulty * 0.3;

    // Defensive posture check
    const posture = scoreDefensivePosture(layers);
    const postureImpact = (1 - posture) * tensionFloor * 0.2;

    return Math.min(1, baseImpact + configAmplifier + difficultyScale * 0.1 + postureImpact);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // S 10 — Phase-Aware Shield UX
  //
  // Methods that adapt shield UX based on the current run phase.
  // SOVEREIGNTY phase has maximum stakes; FOUNDATION is lower risk.
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate narrative text adapted to the current run phase.
   * SOVEREIGNTY phase gets the most urgent language.
   */
  public generatePhaseAwareNarrative(snapshot: RunStateSnapshot): {
    readonly phase: RunPhase;
    readonly headline: string;
    readonly body: string;
    readonly stakesMultiplier: number;
    readonly tickBudgetFraction: number;
    readonly urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  } {
    const phase: RunPhase = snapshot.phase;
    const mode: ModeCode = snapshot.mode;
    const { shield, pressure, economy } = snapshot;
    const layers = shield.layers;
    const tick = snapshot.tick;

    const stakesMultiplier = RUN_PHASE_STAKES_MULTIPLIER[phase];
    const tickBudgetFraction = RUN_PHASE_TICK_BUDGET_FRACTION[phase];
    const difficulty = MODE_DIFFICULTY_MULTIPLIER[mode];
    const integrity = computeWeightedIntegrity(layers);
    const grade: ShieldHealthGrade = computeGradeFromScore(integrity);
    const pressureLabel = PRESSURE_TIER_URGENCY_LABEL[pressure.tier];

    // Phase-specific urgency calculation
    const effectiveDanger = (1 - integrity) * stakesMultiplier * difficulty;
    let urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (effectiveDanger > 0.8) urgency = 'CRITICAL';
    else if (effectiveDanger > 0.5) urgency = 'HIGH';
    else if (effectiveDanger > 0.25) urgency = 'MEDIUM';

    let headline: string;
    let body: string;

    const phaseCode: RunPhase = phase;
    if (phaseCode === 'SOVEREIGNTY') {
      headline = urgency === 'CRITICAL'
        ? 'SOVEREIGNTY: Final Defense — Shield Collapse Imminent'
        : urgency === 'HIGH'
          ? 'SOVEREIGNTY: Shield Under Maximum Pressure'
          : 'SOVEREIGNTY: Shield Defending Freedom Push';
      body = `Final phase — every action at ${stakesMultiplier.toFixed(2)}x stakes. ` +
        `Shield grade: ${grade}. Integrity: ${Math.round(integrity * 100)}%. ` +
        `Budget fraction: ${Math.round(tickBudgetFraction * 100)}% of total ticks. ` +
        `Economy target: ${economy.freedomTarget}. Current: ${economy.netWorth}. ` +
        `Pressure: ${pressureLabel}.`;
    } else if (phaseCode === 'ESCALATION') {
      headline = urgency === 'CRITICAL'
        ? 'ESCALATION: Shield Overwhelmed By Mounting Threats'
        : urgency === 'HIGH'
          ? 'ESCALATION: Shield Straining Under Pressure'
          : 'ESCALATION: Shield Holding Against Rising Threats';
      body = `Mid-run escalation — stakes at ${stakesMultiplier.toFixed(2)}x. ` +
        `Shield: ${Math.round(integrity * 100)}% (${grade}). ` +
        `Tick budget: ${Math.round(tickBudgetFraction * 100)}%. ` +
        `Breaches this run: ${shield.breachesThisRun}. Pressure: ${pressureLabel}.`;
    } else {
      // FOUNDATION
      headline = urgency === 'CRITICAL'
        ? 'FOUNDATION: Early Shield Crisis'
        : urgency === 'HIGH'
          ? 'FOUNDATION: Shield Tested Early'
          : 'FOUNDATION: Building Shield Baseline';
      body = `Foundation phase — lower stakes at ${stakesMultiplier.toFixed(2)}x. ` +
        `Shield: ${Math.round(integrity * 100)}%. ` +
        `Budget: ${Math.round(tickBudgetFraction * 100)}% of ticks. ` +
        `Building defenses. Pressure: ${pressureLabel}.`;
    }

    return { phase, headline, body, stakesMultiplier, tickBudgetFraction, urgency };
  }

  /**
   * Compute phase-specific stakes impact on shield UX.
   * SOVEREIGNTY = maximum stakes, every shield HP matters most.
   * Returns 0-1 scaled stakes pressure.
   */
  public computePhaseSpecificStakes(snapshot: RunStateSnapshot): number {
    const phase: RunPhase = snapshot.phase;
    const mode: ModeCode = snapshot.mode;
    const { shield } = snapshot;
    const layers = shield.layers;

    const stakes = RUN_PHASE_STAKES_MULTIPLIER[phase];
    const difficulty = MODE_DIFFICULTY_MULTIPLIER[mode];
    const integrity = computeWeightedIntegrity(layers);
    const posture = scoreDefensivePosture(layers);

    // Base stakes pressure: inverse integrity scaled by stakes multiplier
    const baseStakes = (1 - integrity) * stakes;

    // Posture penalty: low posture in high-stakes phase is very bad
    const posturePenalty = (1 - posture) * stakes * 0.2;

    // Per-layer stakes check with configs
    let layerStakes = 0;
    for (const lid of SHIELD_LAYER_ORDER) {
      const ls = layers.find((l) => l.layerId === lid);
      if (!ls) continue;
      const weight = LAYER_HEALTH_WEIGHT[lid];
      const config = SHIELD_LAYER_CONFIGS[lid];
      // Cascade gate breach in SOVEREIGNTY is catastrophic
      if (config.cascadeGate && ls.breached && phase === ('SOVEREIGNTY' as RunPhase)) {
        layerStakes += weight * 0.5;
      } else if (ls.breached) {
        layerStakes += weight * stakes * 0.15;
      }
    }

    // Difficulty amplification
    const difficultyAmp = difficulty * 0.1;

    return Math.min(1, baseStakes + posturePenalty + layerStakes + difficultyAmp);
  }

  /**
   * Build engine signals scoped to the current run phase.
   */
  public buildPhaseAwareSignals(snapshot: RunStateSnapshot): readonly EngineSignal[] {
    const phase: RunPhase = snapshot.phase;
    const mode: ModeCode = snapshot.mode;
    const { shield, pressure } = snapshot;
    const layers = shield.layers;
    const signals: EngineSignal[] = [];

    const stakes = RUN_PHASE_STAKES_MULTIPLIER[phase];
    const budgetFraction = RUN_PHASE_TICK_BUDGET_FRACTION[phase];
    const difficulty = MODE_DIFFICULTY_MULTIPLIER[mode];
    const integrity = computeWeightedIntegrity(layers);
    const pressureLabel = PRESSURE_TIER_URGENCY_LABEL[pressure.tier];

    // Phase-critical shield warning
    if (integrity < SHIELD_CONSTANTS.CRITICAL_WARNING_THRESHOLD && stakes > 0.8) {
      signals.push(
        createEngineSignal(
          'shield',
          'ERROR',
          `SHIELD_PHASE_${phase}_CRITICAL`,
          `[${phase}] Shield critically low at ${Math.round(integrity * 100)}% ` +
          `with ${stakes.toFixed(2)}x stakes. Pressure: ${pressureLabel}.`,
          snapshot.tick,
          [`phase:${phase}`],
        ),
      );
    }

    // Per-layer phase signals
    for (const lid of SHIELD_LAYER_ORDER) {
      const ls = layers.find((l) => l.layerId === lid);
      if (!ls) continue;
      const config = SHIELD_LAYER_CONFIGS[lid];
      const danger: LayerDangerLevel = computeLayerDangerLevel(ls.integrityRatio);

      if (ls.breached && config.cascadeGate) {
        signals.push(
          createEngineSignal(
            'shield',
            'ERROR',
            `SHIELD_PHASE_${phase}_CASCADE_GATE_BREACHED`,
            `[${phase}] CASCADE GATE ${lid} BREACHED. Stakes: ${stakes.toFixed(2)}x. ` +
            `Budget: ${Math.round(budgetFraction * 100)}%. Difficulty: ${difficulty.toFixed(1)}x.`,
            snapshot.tick,
            [`phase:${phase}`, `layer:${lid}`],
          ),
        );
      } else if (danger === 'CRITICAL' || danger === 'SEVERE') {
        signals.push(
          createEngineSignal(
            'shield',
            danger === 'CRITICAL' ? 'ERROR' : 'WARN',
            `SHIELD_PHASE_${phase}_LAYER_${lid}_DANGER`,
            `[${phase}] ${config.doctrineName} at ${danger} danger. ` +
            `Integrity: ${Math.round(ls.integrityRatio * 100)}%.`,
            snapshot.tick,
            [`phase:${phase}`, `layer:${lid}`],
          ),
        );
      }
    }

    // Budget consumption warning
    const tickEstimate = budgetFraction * 300; // rough total tick estimate
    if (snapshot.tick > tickEstimate * 0.8) {
      signals.push(
        createEngineSignal(
          'shield',
          'WARN',
          `SHIELD_PHASE_${phase}_BUDGET_LOW`,
          `[${phase}] Phase tick budget ${Math.round(budgetFraction * 100)}% ` +
          `nearly exhausted at tick ${snapshot.tick}.`,
          snapshot.tick,
          [`phase:${phase}`],
        ),
      );
    }

    return signals;
  }

  /**
   * Estimate how much of the phase's tick budget remains.
   * Returns a fraction 0-1 of remaining budget.
   */
  public estimatePhaseTimeRemaining(snapshot: RunStateSnapshot): number {
    const phase: RunPhase = snapshot.phase;
    const tick = snapshot.tick;
    const budgetFraction = RUN_PHASE_TICK_BUDGET_FRACTION[phase];
    const stakes = RUN_PHASE_STAKES_MULTIPLIER[phase];

    // Rough estimate: total run is ~300 ticks, phase budget is fraction of that
    const estimatedPhaseTicks = budgetFraction * 300;

    // Calculate how far into the phase we are
    // We use the tick and budget fraction to estimate remaining time
    const phaseProgress = Math.min(1, tick / (estimatedPhaseTicks + 1));
    const remaining = Math.max(0, 1 - phaseProgress);

    // Stakes modifier: higher stakes phases feel more urgent
    void stakes;

    return remaining;
  }

  /**
   * Compute how the current phase drives shield urgency through escalation
   * pressure. Later phases compound all damage more severely.
   * Returns 0-1 escalation pressure score.
   */
  public computePhaseEscalationPressure(snapshot: RunStateSnapshot): number {
    const phase: RunPhase = snapshot.phase;
    const mode: ModeCode = snapshot.mode;
    const { shield, pressure, battle, cascade } = snapshot;
    const layers = shield.layers;

    const stakes = RUN_PHASE_STAKES_MULTIPLIER[phase];
    const budgetFraction = RUN_PHASE_TICK_BUDGET_FRACTION[phase];
    const difficulty = MODE_DIFFICULTY_MULTIPLIER[mode];
    const pressureNorm = PRESSURE_TIER_NORMALIZED[pressure.tier];
    const integrity = computeWeightedIntegrity(layers);

    // Base escalation: stakes * pressure * inverse integrity
    const baseEscalation = stakes * pressureNorm * (1 - integrity);

    // Bot threat amplification in phase context
    let botThreat = 0;
    for (const bot of battle.bots) {
      const botId = bot.botId as HaterBotId;
      const botState = bot.state as BotState;
      botThreat += BOT_THREAT_LEVEL[botId] * BOT_STATE_THREAT_MULTIPLIER[botState];
    }
    const botAmplifier = Math.min(0.2, botThreat * stakes * 0.05);

    // Cascade chains amplify phase pressure
    const cascadeAmplifier = cascade.activeChains.length > 0
      ? Math.min(0.15, cascade.activeChains.length * stakes * 0.04)
      : 0;

    // Budget pressure: running out of ticks compounds everything
    const estimatedBudget = budgetFraction * 300;
    const budgetPressure = snapshot.tick > estimatedBudget * 0.7
      ? (snapshot.tick / estimatedBudget - 0.7) * stakes
      : 0;

    // Difficulty scaling
    const difficultyBonus = (difficulty - 1.0) * 0.1;

    return Math.min(
      1,
      baseEscalation + botAmplifier + cascadeAmplifier +
      Math.min(0.15, budgetPressure) + difficultyBonus,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // S 11 — Bot Threat UX Correlation
  //
  // Methods correlating hater bot behavior with shield state.
  // Every method uses BOT_THREAT_LEVEL, BOT_STATE_THREAT_MULTIPLIER,
  // ATTACK_CATEGORY_BASE_MAGNITUDE, and ATTACK_CATEGORY_IS_COUNTERABLE.
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Analyze each bot's threat profile in the context of current shield state.
   * Returns per-bot threat scoring with shield-specific impact assessment.
   */
  public analyzeBotThreatProfile(snapshot: RunStateSnapshot): readonly {
    readonly botId: HaterBotId;
    readonly botState: BotState;
    readonly baseThreat: number;
    readonly stateMult: number;
    readonly effectiveThreat: number;
    readonly shieldImpactScore: number;
    readonly label: string;
    readonly neutralized: boolean;
  }[] {
    const { shield, battle } = snapshot;
    const layers = shield.layers;
    const integrity = computeWeightedIntegrity(layers);

    return battle.bots.map((bot) => {
      const botId = bot.botId as HaterBotId;
      const botState = bot.state as BotState;
      const baseThreat = BOT_THREAT_LEVEL[botId];
      const stateMult = BOT_STATE_THREAT_MULTIPLIER[botState];
      const effectiveThreat = baseThreat * stateMult;

      // Shield impact: how much this bot threatens the shield specifically
      const shieldImpactScore = effectiveThreat * (1 - integrity) *
        (bot.attacksLanded > bot.attacksBlocked ? 1.2 : 0.8);

      return {
        botId,
        botState,
        baseThreat,
        stateMult,
        effectiveThreat,
        shieldImpactScore: Math.min(1, shieldImpactScore),
        label: bot.label,
        neutralized: bot.neutralized,
      };
    });
  }

  /**
   * Compute the aggregate impact bots are having on the shield system.
   * Returns a detailed breakdown of bot-driven shield damage.
   */
  public computeBotShieldImpact(snapshot: RunStateSnapshot): {
    readonly totalBotThreat: number;
    readonly activeThreatRatio: number;
    readonly shieldVulnerability: number;
    readonly combinedImpact: number;
    readonly attackingBotCount: number;
    readonly dangerousLayers: readonly ShieldLayerId[];
    readonly doctrineMapping: readonly { category: AttackCategory; doctrine: ShieldDoctrineAttackType }[];
  } {
    const { shield, battle } = snapshot;
    const layers = shield.layers;

    let totalBotThreat = 0;
    let activeThreat = 0;
    let attackingBotCount = 0;

    for (const bot of battle.bots) {
      const botId = bot.botId as HaterBotId;
      const botState = bot.state as BotState;
      const base = BOT_THREAT_LEVEL[botId];
      const mult = BOT_STATE_THREAT_MULTIPLIER[botState];
      totalBotThreat += base;
      activeThreat += base * mult;
      if (botState === 'ATTACKING') attackingBotCount++;
    }

    const activeThreatRatio = totalBotThreat > 0 ? activeThreat / totalBotThreat : 0;
    const shieldVulnerability = 1 - computeWeightedIntegrity(layers);
    const combinedImpact = Math.min(1, activeThreatRatio * shieldVulnerability);

    // Find layers in danger
    const dangerousLayers: ShieldLayerId[] = [];
    for (const lid of SHIELD_LAYER_ORDER) {
      const ls = layers.find((l) => l.layerId === lid);
      if (ls) {
        const danger: LayerDangerLevel = computeLayerDangerLevel(ls.integrityRatio);
        if (danger === 'CRITICAL' || danger === 'SEVERE' || danger === 'HIGH') {
          dangerousLayers.push(lid);
        }
      }
    }

    // Map pending attack categories to doctrine types
    const categories: AttackCategory[] = [
      'EXTRACTION', 'LOCK', 'DRAIN', 'HEAT', 'BREACH', 'DEBT',
    ];
    const doctrineMapping = categories.map((cat) => ({
      category: cat,
      doctrine: ATTACK_CATEGORY_DOCTRINE_MAP[cat],
    }));

    return {
      totalBotThreat,
      activeThreatRatio,
      shieldVulnerability,
      combinedImpact,
      attackingBotCount,
      dangerousLayers,
      doctrineMapping,
    };
  }

  /**
   * Generate bot-specific narrative text for the player UX.
   * Each bot gets a threat description based on its current state.
   */
  public generateBotThreatNarrative(snapshot: RunStateSnapshot): {
    readonly perBotNarratives: readonly {
      readonly botId: HaterBotId;
      readonly headline: string;
      readonly shieldContext: string;
    }[];
    readonly overallNarrative: string;
  } {
    const { shield, battle, pressure } = snapshot;
    const mode: ModeCode = snapshot.mode;
    const layers = shield.layers;
    const integrity = computeWeightedIntegrity(layers);
    const difficulty = MODE_DIFFICULTY_MULTIPLIER[mode];
    const pressureLabel = PRESSURE_TIER_URGENCY_LABEL[pressure.tier];

    const perBotNarratives = battle.bots.map((bot) => {
      const botId = bot.botId as HaterBotId;
      const botState = bot.state as BotState;
      const baseThreat = BOT_THREAT_LEVEL[botId];
      const stateMult = BOT_STATE_THREAT_MULTIPLIER[botState];
      const effectiveThreat = baseThreat * stateMult;

      let headline: string;
      if (botState === 'ATTACKING') {
        headline = `${bot.label} is actively attacking (threat: ${(effectiveThreat * 100).toFixed(0)}%).`;
      } else if (botState === 'TARGETING') {
        headline = `${bot.label} is targeting you (threat: ${(effectiveThreat * 100).toFixed(0)}%).`;
      } else if (botState === 'NEUTRALIZED') {
        headline = `${bot.label} has been neutralized.`;
      } else if (botState === 'RETREATING') {
        headline = `${bot.label} is retreating (reduced threat).`;
      } else if (botState === 'WATCHING') {
        headline = `${bot.label} is watching (minimal threat).`;
      } else {
        headline = `${bot.label} is dormant.`;
      }

      const shieldContext =
        `Shield impact: ${effectiveThreat > 0.5 ? 'HIGH' : effectiveThreat > 0.2 ? 'MEDIUM' : 'LOW'}. ` +
        `Attacks landed: ${bot.attacksLanded}. Blocked: ${bot.attacksBlocked}.`;

      return { botId, headline, shieldContext };
    });

    const attackingCount = battle.bots.filter(
      (b) => (b.state as BotState) === 'ATTACKING',
    ).length;
    const totalThreat = battle.bots.reduce((sum, b) => {
      const bid = b.botId as HaterBotId;
      const bs = b.state as BotState;
      return sum + BOT_THREAT_LEVEL[bid] * BOT_STATE_THREAT_MULTIPLIER[bs];
    }, 0);

    const overallNarrative =
      `${attackingCount} of ${battle.bots.length} bots actively threatening. ` +
      `Combined threat: ${Math.round(totalThreat * 100)}%. ` +
      `Shield: ${Math.round(integrity * 100)}%. ` +
      `Difficulty: ${difficulty.toFixed(1)}x. Pressure: ${pressureLabel}.`;

    return { perBotNarratives, overallNarrative };
  }

  /**
   * Rank all bots by how dangerous they are to the shield system.
   * Considers bot threat level, state, and current shield vulnerability.
   */
  public rankBotsByShieldDanger(snapshot: RunStateSnapshot): readonly {
    readonly botId: HaterBotId;
    readonly label: string;
    readonly dangerScore: number;
    readonly rank: number;
  }[] {
    const { shield, battle } = snapshot;
    const layers = shield.layers;
    const integrity = computeWeightedIntegrity(layers);

    const scored = battle.bots.map((bot) => {
      const botId = bot.botId as HaterBotId;
      const botState = bot.state as BotState;
      const baseThreat = BOT_THREAT_LEVEL[botId];
      const stateMult = BOT_STATE_THREAT_MULTIPLIER[botState];

      // Danger score: base threat * state mult * shield vulnerability * attack record
      const attackSuccess = bot.attacksLanded + bot.attacksBlocked > 0
        ? bot.attacksLanded / (bot.attacksLanded + bot.attacksBlocked)
        : 0.5;
      const dangerScore = baseThreat * stateMult * (1 - integrity) * (0.5 + attackSuccess * 0.5);

      return { botId, label: bot.label, dangerScore: Math.min(1, dangerScore) };
    });

    // Sort by danger descending
    scored.sort((a, b) => b.dangerScore - a.dangerScore);

    return scored.map((entry, idx) => ({
      ...entry,
      rank: idx + 1,
    }));
  }

  /**
   * Predict likely next attack patterns based on bot states and attack categories.
   * Returns predicted attack categories with confidence scores.
   */
  public predictBotAttackPatterns(snapshot: RunStateSnapshot): readonly {
    readonly category: AttackCategory;
    readonly doctrine: ShieldDoctrineAttackType;
    readonly baseMagnitude: number;
    readonly severityWeight: number;
    readonly confidence: number;
    readonly isCounterable: boolean;
    readonly targetedLayer: ShieldLayerId | null;
  }[] {
    const { shield, battle } = snapshot;
    const layers = shield.layers;

    // Count bots in attacking/targeting states
    let aggressiveBotCount = 0;
    let totalThreat = 0;
    for (const bot of battle.bots) {
      const botState = bot.state as BotState;
      const botId = bot.botId as HaterBotId;
      if (botState === 'ATTACKING' || botState === 'TARGETING') {
        aggressiveBotCount++;
        totalThreat += BOT_THREAT_LEVEL[botId] * BOT_STATE_THREAT_MULTIPLIER[botState];
      }
    }

    if (aggressiveBotCount === 0) return [];

    const allCategories: AttackCategory[] = [
      'EXTRACTION', 'LOCK', 'DRAIN', 'HEAT', 'BREACH', 'DEBT',
    ];

    return allCategories.map((cat) => {
      const baseMagnitude = ATTACK_CATEGORY_BASE_MAGNITUDE[cat];
      const severityWeight = ATTACK_CATEGORY_SEVERITY_WEIGHT[cat];
      const isCounterable = ATTACK_CATEGORY_IS_COUNTERABLE[cat];
      const doctrine: ShieldDoctrineAttackType = ATTACK_CATEGORY_DOCTRINE_MAP[cat];

      // Confidence based on: bot threat level, shield weakness, and pending attacks
      const shieldWeakness = 1 - computeWeightedIntegrity(layers);
      const confidence = Math.min(
        1,
        (aggressiveBotCount / 5) * baseMagnitude * (0.3 + shieldWeakness * 0.7),
      );

      // Find the weakest layer that matches this category's preferred target
      let targetedLayer: ShieldLayerId | null = null;
      let weakestRatio = 2;
      for (const layer of layers) {
        if (layer.integrityRatio < weakestRatio && !layer.breached) {
          weakestRatio = layer.integrityRatio;
          targetedLayer = layer.layerId;
        }
      }

      return {
        category: cat,
        doctrine,
        baseMagnitude,
        severityWeight,
        confidence,
        isCounterable,
        targetedLayer,
      };
    }).sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Compute what percentage of incoming damage is counterable.
   * Uses ATTACK_CATEGORY_IS_COUNTERABLE at runtime for each category.
   */
  public computeCounterableAttackRatio(snapshot: RunStateSnapshot): {
    readonly counterableCount: number;
    readonly totalCount: number;
    readonly ratio: number;
    readonly perCategoryBreakdown: readonly {
      readonly category: AttackCategory;
      readonly isCounterable: boolean;
      readonly count: number;
      readonly magnitude: number;
    }[];
  } {
    const { battle } = snapshot;
    const attacks = battle.pendingAttacks;

    const allCategories: AttackCategory[] = [
      'EXTRACTION', 'LOCK', 'DRAIN', 'HEAT', 'BREACH', 'DEBT',
    ];

    // Count attacks per category
    const categoryCounts: Record<string, number> = {};
    for (const cat of allCategories) {
      categoryCounts[cat] = 0;
    }
    for (const attack of attacks) {
      const cat = attack.category as AttackCategory;
      if (cat in categoryCounts) {
        categoryCounts[cat]++;
      }
    }

    let counterableCount = 0;
    let totalCount = attacks.length;

    const perCategoryBreakdown = allCategories.map((cat) => {
      const isCounterable = ATTACK_CATEGORY_IS_COUNTERABLE[cat];
      const count = categoryCounts[cat] ?? 0;
      const magnitude = ATTACK_CATEGORY_BASE_MAGNITUDE[cat];

      if (isCounterable) counterableCount += count;

      return { category: cat, isCounterable, count, magnitude };
    });

    const ratio = totalCount > 0 ? counterableCount / totalCount : 0;

    return { counterableCount, totalCount, ratio, perCategoryBreakdown };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // S 12 — Extended Cross-Engine ML/DL Features
  //
  // Feature extraction methods that combine shield UX with all other engines
  // to produce enriched ML vectors and DL tensors for downstream inference.
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Extract a 48-dimensional ML feature vector combining shield UX with
   * pressure, tension, battle, economy, and cascade engines.
   * Every feature is deterministic and replay-stable.
   */
  public extractCrossEngineMLVector(snapshot: RunStateSnapshot): {
    readonly tick: number;
    readonly features: readonly number[];
    readonly labels: readonly string[];
    readonly dimension: 48;
  } {
    const { shield, economy, pressure, tension, battle, cascade, sovereignty } = snapshot;
    const mode: ModeCode = snapshot.mode;
    const phase: RunPhase = snapshot.phase;
    const outcome: RunOutcome | null = snapshot.outcome;
    const layers = shield.layers;

    const features: number[] = [];
    const labels: string[] = [];

    // Shield features (0-7)
    const integrity = computeWeightedIntegrity(layers);
    features.push(integrity);
    labels.push('cross_shield_weighted_integrity');

    const posture = scoreDefensivePosture(layers);
    features.push(posture);
    labels.push('cross_shield_defensive_posture');

    const gradeScore = integrity; // grade is derived from integrity
    const grade: ShieldHealthGrade = computeGradeFromScore(gradeScore);
    const gradeNumeric = grade === 'A' ? 1.0 : grade === 'B' ? 0.75 : grade === 'C' ? 0.5 : grade === 'D' ? 0.25 : 0;
    features.push(gradeNumeric);
    labels.push('cross_shield_grade_numeric');

    let breachedCount = 0;
    for (const l of layers) if (l.breached) breachedCount++;
    features.push(breachedCount / 4);
    labels.push('cross_shield_breached_ratio');

    // Per-layer integrity (4-7)
    for (const lid of SHIELD_LAYER_ORDER) {
      const ls = layers.find((l) => l.layerId === lid);
      features.push(ls ? ls.integrityRatio : 0);
      labels.push(`cross_shield_${lid}_integrity`);
    }

    // Pressure features (8-11)
    features.push(PRESSURE_TIER_NORMALIZED[pressure.tier]);
    labels.push('cross_pressure_tier_norm');
    features.push(pressure.score);
    labels.push('cross_pressure_score');
    features.push(pressure.upwardCrossings / 10);
    labels.push('cross_pressure_crossings_norm');
    features.push(Math.min(1, pressure.survivedHighPressureTicks / 50));
    labels.push('cross_pressure_survived_high_norm');

    // Tension features (12-15)
    features.push(tension.score);
    labels.push('cross_tension_score');
    features.push(tension.anticipation);
    labels.push('cross_tension_anticipation');
    features.push(Math.min(1, tension.visibleThreats.length / 5));
    labels.push('cross_tension_visible_threats_norm');
    features.push(tension.maxPulseTriggered ? 1 : 0);
    labels.push('cross_tension_max_pulse');

    // Battle features (16-23)
    let totalBotThreat = 0;
    let activeBotThreat = 0;
    let attackingCount = 0;
    for (const bot of battle.bots) {
      const botId = bot.botId as HaterBotId;
      const botState = bot.state as BotState;
      const bt = BOT_THREAT_LEVEL[botId];
      const sm = BOT_STATE_THREAT_MULTIPLIER[botState];
      totalBotThreat += bt;
      activeBotThreat += bt * sm;
      if (botState === 'ATTACKING') attackingCount++;
    }
    features.push(totalBotThreat > 0 ? activeBotThreat / totalBotThreat : 0);
    labels.push('cross_battle_active_threat_ratio');
    features.push(attackingCount / 5);
    labels.push('cross_battle_attacking_ratio');
    features.push(battle.battleBudgetCap > 0 ? battle.battleBudget / battle.battleBudgetCap : 0);
    labels.push('cross_battle_budget_ratio');
    features.push(battle.neutralizedBotIds.length / 5);
    labels.push('cross_battle_neutralized_ratio');
    features.push(Math.min(1, battle.pendingAttacks.length / 10));
    labels.push('cross_battle_pending_attacks_norm');
    features.push(battle.firstBloodClaimed ? 1 : 0);
    labels.push('cross_battle_first_blood');
    features.push(Math.min(1, battle.rivalryHeatCarry / 100));
    labels.push('cross_battle_rivalry_heat_norm');
    features.push(Math.min(1, battle.extractionCooldownTicks / 10));
    labels.push('cross_battle_extraction_cd_norm');

    // Economy features (24-29)
    features.push(economy.freedomTarget > 0 ? Math.min(1, economy.netWorth / economy.freedomTarget) : 0);
    labels.push('cross_economy_nw_progress');
    features.push(economy.expensesPerTick > 0 ? Math.min(2, economy.incomePerTick / economy.expensesPerTick) / 2 : 1);
    labels.push('cross_economy_income_ratio_norm');
    features.push(economy.netWorth > 0 ? Math.min(1, economy.debt / (economy.netWorth + 1)) : economy.debt > 0 ? 1 : 0);
    labels.push('cross_economy_debt_burden');
    features.push(Math.min(1, economy.haterHeat / 100));
    labels.push('cross_economy_hater_heat_norm');
    features.push(Math.min(1, economy.cash / (economy.freedomTarget + 1)));
    labels.push('cross_economy_cash_norm');
    features.push(Math.min(1, economy.opportunitiesPurchased / 20));
    labels.push('cross_economy_opportunities_norm');

    // Cascade features (30-33)
    features.push(Math.min(1, cascade.activeChains.length / 5));
    labels.push('cross_cascade_active_norm');
    features.push(Math.min(1, cascade.brokenChains / 5));
    labels.push('cross_cascade_broken_norm');
    features.push(Math.min(1, cascade.completedChains / 10));
    labels.push('cross_cascade_completed_norm');
    features.push(Math.min(1, cascade.positiveTrackers.length / 5));
    labels.push('cross_cascade_positive_trackers_norm');

    // Sovereignty features (34-37)
    const intStatus = sovereignty.integrityStatus;
    const intStatusNum = intStatus === 'VERIFIED' ? 1 : intStatus === 'PENDING' ? 0.5 : intStatus === 'UNVERIFIED' ? 0.25 : 0;
    features.push(intStatusNum);
    labels.push('cross_sovereignty_integrity_status');
    features.push(sovereignty.sovereigntyScore);
    labels.push('cross_sovereignty_score');
    features.push(Math.min(1, sovereignty.cordScore / 100));
    labels.push('cross_sovereignty_cord_norm');
    features.push(sovereignty.gapClosingRate);
    labels.push('cross_sovereignty_gap_closing_rate');

    // Mode & phase features (38-43)
    features.push(MODE_DIFFICULTY_MULTIPLIER[mode] / 2);
    labels.push('cross_mode_difficulty_norm');
    features.push(MODE_TENSION_FLOOR[mode]);
    labels.push('cross_mode_tension_floor');
    features.push(RUN_PHASE_STAKES_MULTIPLIER[phase]);
    labels.push('cross_phase_stakes');
    features.push(RUN_PHASE_TICK_BUDGET_FRACTION[phase]);
    labels.push('cross_phase_budget_fraction');
    features.push(mode === 'ghost' ? 1 : mode === 'pvp' ? 0.67 : mode === 'coop' ? 0.33 : 0);
    labels.push('cross_mode_encoded');
    features.push(phase === 'SOVEREIGNTY' ? 1 : phase === 'ESCALATION' ? 0.5 : 0);
    labels.push('cross_phase_encoded');

    // Cross-engine derived features (44-47)
    features.push(this.computeCrossEngineRiskScore(snapshot));
    labels.push('cross_engine_risk_score');
    features.push(this.computeShieldPressureCorrelation(snapshot));
    labels.push('cross_shield_pressure_correlation');
    features.push(this.computeShieldBattleCorrelation(snapshot));
    labels.push('cross_shield_battle_correlation');

    // Outcome encoded
    const outcomeNum = outcome === null ? 0.5 : outcome === ('FREEDOM' as RunOutcome) ? 1 : 0;
    features.push(outcomeNum);
    labels.push('cross_outcome_encoded');

    return {
      tick: snapshot.tick,
      features,
      labels,
      dimension: 48 as const,
    };
  }

  /**
   * Build an extended DL tensor with cross-engine correlation features.
   * Uses sequence history to produce a 2D tensor of shape [seqLen, featureDepth].
   */
  public buildCrossEngineDLTensor(snapshot: RunStateSnapshot): {
    readonly tick: number;
    readonly sequenceLength: number;
    readonly featureDepth: number;
    readonly data: readonly (readonly number[])[];
    readonly labels: readonly string[];
  } {
    const { shield, pressure, tension, battle, cascade } = snapshot;
    const mode: ModeCode = snapshot.mode;
    const phase: RunPhase = snapshot.phase;
    const layers = shield.layers;
    const featureDepth = 12;

    // Build one row per snapshot in history (or current if no history)
    const rows: number[][] = [];
    const maxSeq = DL_SEQUENCE_LENGTH;

    // Use snapshot history if available, otherwise build from current
    const historyLen = this.snapshotHistory.length;
    const startIdx = Math.max(0, historyLen - maxSeq);

    // If we have history, extract features from each historical snapshot
    if (historyLen > 0) {
      for (let i = startIdx; i < historyLen; i++) {
        const hist = this.snapshotHistory[i];
        const histIntegrity = hist.overallIntegrity;
        const histBreached = hist.breachedCount / 4;
        const histWeakest = hist.weakestRatio;

        const row: number[] = [
          histIntegrity,
          histBreached,
          histWeakest,
          hist.fortified ? 1 : 0,
          hist.cascadeActive ? 1 : 0,
          PRESSURE_TIER_NORMALIZED[pressure.tier],
          MODE_DIFFICULTY_MULTIPLIER[mode] / 2,
          RUN_PHASE_STAKES_MULTIPLIER[phase],
          tension.score,
          Math.min(1, battle.pendingAttacks.length / 10),
          Math.min(1, cascade.activeChains.length / 5),
          MODE_TENSION_FLOOR[mode],
        ];
        rows.push(row);
      }
    }

    // Always add current state as the last row
    const currentRow: number[] = [
      computeWeightedIntegrity(layers),
      layers.filter((l) => l.breached).length / 4,
      shield.weakestLayerRatio,
      scoreDefensivePosture(layers) > 0.8 ? 1 : 0,
      cascade.activeChains.length > 0 ? 1 : 0,
      PRESSURE_TIER_NORMALIZED[pressure.tier],
      MODE_DIFFICULTY_MULTIPLIER[mode] / 2,
      RUN_PHASE_STAKES_MULTIPLIER[phase],
      tension.score,
      Math.min(1, battle.pendingAttacks.length / 10),
      Math.min(1, cascade.activeChains.length / 5),
      MODE_TENSION_FLOOR[mode],
    ];
    rows.push(currentRow);

    // Pad to maxSeq if needed
    while (rows.length < maxSeq) {
      rows.unshift(new Array(featureDepth).fill(0));
    }

    // Trim to maxSeq
    const trimmed = rows.slice(-maxSeq);

    const dlLabels: string[] = [
      'dl_shield_integrity',
      'dl_breached_ratio',
      'dl_weakest_ratio',
      'dl_fortified',
      'dl_cascade_active',
      'dl_pressure_norm',
      'dl_mode_difficulty',
      'dl_phase_stakes',
      'dl_tension_score',
      'dl_pending_attacks',
      'dl_cascade_chains',
      'dl_tension_floor',
    ];

    return {
      tick: snapshot.tick,
      sequenceLength: maxSeq,
      featureDepth,
      data: trimmed,
      labels: dlLabels,
    };
  }

  /**
   * Compute feature importance ranking for cross-engine features.
   * Determines which features contribute most to the current risk state.
   */
  public computeCrossEngineFeatureImportance(snapshot: RunStateSnapshot): readonly {
    readonly featureName: string;
    readonly importance: number;
    readonly value: number;
    readonly rank: number;
  }[] {
    const { shield, economy, pressure, tension, battle, cascade } = snapshot;
    const mode: ModeCode = snapshot.mode;
    const phase: RunPhase = snapshot.phase;
    const layers = shield.layers;

    // Compute all feature values and their importance
    const entries: { featureName: string; importance: number; value: number }[] = [];

    // Shield integrity importance — always high
    const integrity = computeWeightedIntegrity(layers);
    entries.push({
      featureName: 'shield_integrity',
      importance: (1 - integrity) * 0.95 + 0.05,
      value: integrity,
    });

    // Defensive posture
    const posture = scoreDefensivePosture(layers);
    entries.push({
      featureName: 'defensive_posture',
      importance: (1 - posture) * 0.7 + 0.1,
      value: posture,
    });

    // Pressure impact
    const pressureNorm = PRESSURE_TIER_NORMALIZED[pressure.tier];
    entries.push({
      featureName: 'pressure_tier',
      importance: pressureNorm * 0.85 + 0.05,
      value: pressureNorm,
    });

    // Mode difficulty
    const difficultyNorm = MODE_DIFFICULTY_MULTIPLIER[mode] / 2;
    entries.push({
      featureName: 'mode_difficulty',
      importance: difficultyNorm * 0.5 + 0.1,
      value: difficultyNorm,
    });

    // Phase stakes
    const stakes = RUN_PHASE_STAKES_MULTIPLIER[phase];
    entries.push({
      featureName: 'phase_stakes',
      importance: stakes * 0.7 + 0.05,
      value: stakes,
    });

    // Tension
    const tensionFloor = MODE_TENSION_FLOOR[mode];
    const tensionExcess = Math.max(0, tension.score - tensionFloor);
    entries.push({
      featureName: 'tension_excess',
      importance: tensionExcess * 0.8 + 0.05,
      value: tension.score,
    });

    // Bot threat
    let botThreat = 0;
    for (const bot of battle.bots) {
      const botId = bot.botId as HaterBotId;
      const botState = bot.state as BotState;
      botThreat += BOT_THREAT_LEVEL[botId] * BOT_STATE_THREAT_MULTIPLIER[botState];
    }
    entries.push({
      featureName: 'bot_threat',
      importance: Math.min(1, botThreat) * 0.75 + 0.05,
      value: Math.min(1, botThreat),
    });

    // Economy health
    const nwProgress = economy.freedomTarget > 0
      ? Math.min(1, economy.netWorth / economy.freedomTarget) : 0;
    entries.push({
      featureName: 'economy_progress',
      importance: (1 - nwProgress) * 0.6 + 0.1,
      value: nwProgress,
    });

    // Cascade risk
    const cascadeIntensity = Math.min(1, cascade.activeChains.length / 3);
    entries.push({
      featureName: 'cascade_intensity',
      importance: cascadeIntensity * 0.85 + 0.05,
      value: cascadeIntensity,
    });

    // Budget fraction usage
    const budgetFrac = RUN_PHASE_TICK_BUDGET_FRACTION[phase];
    entries.push({
      featureName: 'budget_fraction',
      importance: budgetFrac * 0.4 + 0.1,
      value: budgetFrac,
    });

    // Per-layer danger importance
    for (const lid of SHIELD_LAYER_ORDER) {
      const ls = layers.find((l) => l.layerId === lid);
      if (!ls) continue;
      const config = SHIELD_LAYER_CONFIGS[lid];
      const weight = LAYER_HEALTH_WEIGHT[lid];
      const danger: LayerDangerLevel = computeLayerDangerLevel(ls.integrityRatio);
      const dangerNum = danger === 'CRITICAL' ? 1 : danger === 'SEVERE' ? 0.8 :
        danger === 'HIGH' ? 0.6 : danger === 'ELEVATED' ? 0.4 :
        danger === 'GUARDED' ? 0.2 : 0;
      entries.push({
        featureName: `layer_${lid}_danger`,
        importance: dangerNum * weight * (config.cascadeGate ? 1.5 : 1.0),
        value: ls.integrityRatio,
      });
    }

    // Attack category importance
    const allCats: AttackCategory[] = ['EXTRACTION', 'LOCK', 'DRAIN', 'HEAT', 'BREACH', 'DEBT'];
    for (const cat of allCats) {
      const mag = ATTACK_CATEGORY_BASE_MAGNITUDE[cat];
      const sev = ATTACK_CATEGORY_SEVERITY_WEIGHT[cat];
      const counterable = ATTACK_CATEGORY_IS_COUNTERABLE[cat];
      const pendingOfCat = battle.pendingAttacks.filter(
        (a) => (a.category as AttackCategory) === cat,
      ).length;
      if (pendingOfCat > 0) {
        entries.push({
          featureName: `attack_${cat.toLowerCase()}_presence`,
          importance: mag * sev * (counterable ? 0.6 : 1.0),
          value: pendingOfCat / 5,
        });
      }
    }

    // Sort by importance descending and assign ranks
    entries.sort((a, b) => b.importance - a.importance);
    return entries.map((e, idx) => ({
      ...e,
      rank: idx + 1,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // S 13 — UX Decision Support Engine
  //
  // Player-facing action recommendations based on cross-engine analysis.
  // Every recommendation is derived from shield state correlated with all
  // other engine subsystems.
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Recommend the top 3 actions the player should take based on the full
   * cross-engine state. Returns ranked recommendations with reasoning.
   */
  public recommendPlayerAction(snapshot: RunStateSnapshot): readonly {
    readonly rank: number;
    readonly action: string;
    readonly reasoning: string;
    readonly urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    readonly category: 'REPAIR' | 'DEFEND' | 'ATTACK' | 'ECONOMY' | 'STRATEGY';
  }[] {
    const { shield, economy, pressure, tension, battle, cascade } = snapshot;
    const mode: ModeCode = snapshot.mode;
    const phase: RunPhase = snapshot.phase;
    const layers = shield.layers;

    const integrity = computeWeightedIntegrity(layers);
    const posture = scoreDefensivePosture(layers);
    const difficulty = MODE_DIFFICULTY_MULTIPLIER[mode];
    const stakes = RUN_PHASE_STAKES_MULTIPLIER[phase];
    const pressureNorm = PRESSURE_TIER_NORMALIZED[pressure.tier];
    const pressureLabel = PRESSURE_TIER_URGENCY_LABEL[pressure.tier];

    const recommendations: {
      action: string;
      reasoning: string;
      urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      category: 'REPAIR' | 'DEFEND' | 'ATTACK' | 'ECONOMY' | 'STRATEGY';
      score: number;
    }[] = [];

    // Check for critical shield layers needing repair
    for (const lid of SHIELD_LAYER_ORDER) {
      const ls = layers.find((l) => l.layerId === lid);
      if (!ls) continue;
      const config = SHIELD_LAYER_CONFIGS[lid];
      const danger: LayerDangerLevel = computeLayerDangerLevel(ls.integrityRatio);
      const weight = LAYER_HEALTH_WEIGHT[lid];

      if (danger === 'CRITICAL' || ls.breached) {
        recommendations.push({
          action: `Repair ${config.doctrineName} (${lid}) immediately`,
          reasoning: `${config.doctrineName} is at ${Math.round(ls.integrityRatio * 100)}% ` +
            `integrity (${danger}). ${config.cascadeGate ? 'CASCADE GATE — breach triggers cascades.' : ''} ` +
            `Stakes: ${stakes.toFixed(2)}x. Weight: ${weight.toFixed(2)}.`,
          urgency: config.cascadeGate ? 'CRITICAL' : 'HIGH',
          category: 'REPAIR',
          score: (1 - ls.integrityRatio) * weight * stakes * (config.cascadeGate ? 2 : 1),
        });
      } else if (danger === 'SEVERE' || danger === 'HIGH') {
        recommendations.push({
          action: `Prioritize repair for ${config.doctrineName} (${lid})`,
          reasoning: `${config.doctrineName} at ${Math.round(ls.integrityRatio * 100)}% ` +
            `(${danger}). Difficulty: ${difficulty.toFixed(1)}x.`,
          urgency: 'HIGH',
          category: 'REPAIR',
          score: (1 - ls.integrityRatio) * weight * stakes * 0.8,
        });
      }
    }

    // Bot neutralization opportunity
    const botProfiles = this.analyzeBotThreatProfile(snapshot);
    const dangerousBots = botProfiles.filter(
      (b) => b.effectiveThreat > 0.3 && !b.neutralized,
    );
    if (dangerousBots.length > 0) {
      const topBot = dangerousBots[0];
      recommendations.push({
        action: `Neutralize ${topBot.label} (${topBot.botId})`,
        reasoning: `Effective threat: ${Math.round(topBot.effectiveThreat * 100)}%. ` +
          `Shield impact: ${Math.round(topBot.shieldImpactScore * 100)}%. ` +
          `State: ${topBot.botState}.`,
        urgency: topBot.effectiveThreat > 0.7 ? 'CRITICAL' : 'HIGH',
        category: 'ATTACK',
        score: topBot.effectiveThreat * stakes * 0.9,
      });
    }

    // Counter available attacks
    const counterableRatio = this.computeCounterableAttackRatio(snapshot);
    if (counterableRatio.ratio > 0.5 && counterableRatio.totalCount > 0) {
      recommendations.push({
        action: 'Play counter cards against incoming attacks',
        reasoning: `${Math.round(counterableRatio.ratio * 100)}% of ${counterableRatio.totalCount} ` +
          `pending attacks are counterable. Pressure: ${pressureLabel}.`,
        urgency: counterableRatio.totalCount > 3 ? 'HIGH' : 'MEDIUM',
        category: 'DEFEND',
        score: counterableRatio.ratio * stakes * 0.75,
      });
    }

    // Economy focus recommendation
    const nwProgress = economy.freedomTarget > 0
      ? economy.netWorth / economy.freedomTarget : 0;
    if (nwProgress < 0.5 && integrity > 0.6) {
      recommendations.push({
        action: 'Focus on income generation while shields are stable',
        reasoning: `Net worth at ${Math.round(nwProgress * 100)}% of freedom target. ` +
          `Shield integrity ${Math.round(integrity * 100)}% provides a window. ` +
          `Phase: ${phase}, stakes: ${stakes.toFixed(2)}x.`,
        urgency: 'MEDIUM',
        category: 'ECONOMY',
        score: (1 - nwProgress) * 0.5 * integrity,
      });
    }

    // Cascade prevention
    if (cascade.activeChains.length > 0) {
      recommendations.push({
        action: 'Address active cascade chains to prevent spiral',
        reasoning: `${cascade.activeChains.length} active cascade(s). ` +
          `${cascade.brokenChains} already broken. Shield posture: ${Math.round(posture * 100)}%.`,
        urgency: cascade.activeChains.length > 2 ? 'CRITICAL' : 'HIGH',
        category: 'STRATEGY',
        score: cascade.activeChains.length * 0.3 * stakes,
      });
    }

    // General strategy
    if (integrity > 0.8 && posture > 0.7 && pressureNorm < 0.5) {
      recommendations.push({
        action: 'Press advantage — shields strong, push for progress',
        reasoning: `Integrity ${Math.round(integrity * 100)}%, posture ${Math.round(posture * 100)}%. ` +
          `Pressure only ${pressureLabel}. Good time to advance.`,
        urgency: 'LOW',
        category: 'STRATEGY',
        score: integrity * posture * 0.5,
      });
    }

    // Sort by score and take top 3
    recommendations.sort((a, b) => b.score - a.score);
    return recommendations.slice(0, 3).map((rec, idx) => ({
      rank: idx + 1,
      action: rec.action,
      reasoning: rec.reasoning,
      urgency: rec.urgency,
      category: rec.category,
    }));
  }

  /**
   * Compute a ranked list of what the player should do, ordered by urgency.
   * Returns all possible actions sorted by how urgently they need attention.
   */
  public computeActionUrgencyRanking(snapshot: RunStateSnapshot): readonly {
    readonly action: string;
    readonly urgencyScore: number;
    readonly domain: string;
  }[] {
    const { shield, economy, pressure, battle, cascade } = snapshot;
    const mode: ModeCode = snapshot.mode;
    const phase: RunPhase = snapshot.phase;
    const layers = shield.layers;

    const difficulty = MODE_DIFFICULTY_MULTIPLIER[mode];
    const stakes = RUN_PHASE_STAKES_MULTIPLIER[phase];
    const pressureNorm = PRESSURE_TIER_NORMALIZED[pressure.tier];
    const integrity = computeWeightedIntegrity(layers);

    const actions: { action: string; urgencyScore: number; domain: string }[] = [];

    // Per-layer repair urgency
    for (const lid of SHIELD_LAYER_ORDER) {
      const ls = layers.find((l) => l.layerId === lid);
      if (!ls) continue;
      const config = SHIELD_LAYER_CONFIGS[lid];
      const weight = LAYER_HEALTH_WEIGHT[lid];
      if (ls.integrityRatio < 0.5) {
        actions.push({
          action: `Repair ${config.doctrineName}`,
          urgencyScore: (1 - ls.integrityRatio) * weight * stakes * difficulty,
          domain: 'SHIELD',
        });
      }
    }

    // Bot threat mitigation
    for (const bot of battle.bots) {
      const botId = bot.botId as HaterBotId;
      const botState = bot.state as BotState;
      const threat = BOT_THREAT_LEVEL[botId] * BOT_STATE_THREAT_MULTIPLIER[botState];
      if (threat > 0.3) {
        actions.push({
          action: `Deal with ${bot.label}`,
          urgencyScore: threat * stakes,
          domain: 'BATTLE',
        });
      }
    }

    // Pressure management
    if (pressureNorm > 0.5) {
      actions.push({
        action: 'Reduce pressure through strategic plays',
        urgencyScore: pressureNorm * stakes * 0.7,
        domain: 'PRESSURE',
      });
    }

    // Economy
    const debtRatio = economy.netWorth > 0
      ? economy.debt / (economy.netWorth + 1) : economy.debt > 0 ? 1 : 0;
    if (debtRatio > 0.3) {
      actions.push({
        action: 'Reduce debt burden',
        urgencyScore: debtRatio * stakes * 0.6,
        domain: 'ECONOMY',
      });
    }

    // Cascade
    if (cascade.activeChains.length > 0) {
      actions.push({
        action: 'Resolve active cascades',
        urgencyScore: Math.min(1, cascade.activeChains.length * 0.3) * stakes,
        domain: 'CASCADE',
      });
    }

    actions.sort((a, b) => b.urgencyScore - a.urgencyScore);
    return actions;
  }

  /**
   * Generate a human-readable narrative of what the player should focus on.
   * Synthesizes cross-engine state into concise guidance text.
   */
  public generateDecisionSupportNarrative(snapshot: RunStateSnapshot): string {
    const { shield, economy, pressure, battle, cascade } = snapshot;
    const mode: ModeCode = snapshot.mode;
    const phase: RunPhase = snapshot.phase;
    const layers = shield.layers;

    const integrity = computeWeightedIntegrity(layers);
    const posture = scoreDefensivePosture(layers);
    const difficulty = MODE_DIFFICULTY_MULTIPLIER[mode];
    const stakes = RUN_PHASE_STAKES_MULTIPLIER[phase];
    const pressureLabel = PRESSURE_TIER_URGENCY_LABEL[pressure.tier];
    const budgetFrac = RUN_PHASE_TICK_BUDGET_FRACTION[phase];

    const parts: string[] = [];

    // Shield status
    const grade: ShieldHealthGrade = computeGradeFromScore(integrity);
    parts.push(
      `Your shields are at grade ${grade} (${Math.round(integrity * 100)}% integrity, ` +
      `${Math.round(posture * 100)}% posture).`,
    );

    // Biggest threat
    let topThreat = '';
    let topThreatScore = 0;

    // Check bots
    for (const bot of battle.bots) {
      const botId = bot.botId as HaterBotId;
      const botState = bot.state as BotState;
      const threat = BOT_THREAT_LEVEL[botId] * BOT_STATE_THREAT_MULTIPLIER[botState];
      if (threat > topThreatScore) {
        topThreatScore = threat;
        topThreat = `${bot.label} (${botState})`;
      }
    }

    if (topThreatScore > 0.3) {
      parts.push(`Your biggest threat is ${topThreat} at ${Math.round(topThreatScore * 100)}% danger.`);
    }

    // Pressure context
    parts.push(`Pressure is ${pressureLabel}. Phase: ${phase} (stakes ${stakes.toFixed(2)}x).`);

    // Economy context
    const nwProgress = economy.freedomTarget > 0
      ? economy.netWorth / economy.freedomTarget : 0;
    parts.push(`Economy at ${Math.round(nwProgress * 100)}% of freedom target.`);

    // Primary recommendation
    if (integrity < 0.3) {
      parts.push('You should focus on repairing your shields immediately.');
    } else if (cascade.activeChains.length > 1) {
      parts.push('You should focus on resolving cascade chains before they spiral.');
    } else if (topThreatScore > 0.6) {
      parts.push('You should focus on neutralizing the most dangerous bot.');
    } else if (nwProgress < 0.3 && integrity > 0.6) {
      parts.push('You should focus on growing your economy while defenses hold.');
    } else {
      parts.push(`You should maintain steady progress. Budget: ${Math.round(budgetFrac * 100)}% of ticks remaining.`);
    }

    // Difficulty context
    if (difficulty > 1.2) {
      parts.push(`Note: ${mode} mode applies ${difficulty.toFixed(1)}x difficulty.`);
    }

    return parts.join(' ');
  }

  /**
   * Compute the estimated probability of reaching FREEDOM outcome.
   * Returns 0-1 where 1 means very likely to succeed.
   */
  public computeSurvivalProbability(snapshot: RunStateSnapshot): number {
    const { shield, economy, pressure, battle, cascade } = snapshot;
    const mode: ModeCode = snapshot.mode;
    const phase: RunPhase = snapshot.phase;
    const outcome: RunOutcome | null = snapshot.outcome;
    const layers = shield.layers;

    // If already ended, return 1 for FREEDOM, 0 for loss
    if (outcome !== null) {
      return (outcome as RunOutcome) === 'FREEDOM' ? 1 : 0;
    }

    const integrity = computeWeightedIntegrity(layers);
    const posture = scoreDefensivePosture(layers);
    const difficulty = MODE_DIFFICULTY_MULTIPLIER[mode];
    const stakes = RUN_PHASE_STAKES_MULTIPLIER[phase];
    const pressureNorm = PRESSURE_TIER_NORMALIZED[pressure.tier];

    // Economy progress is the strongest predictor
    const nwProgress = economy.freedomTarget > 0
      ? Math.min(1, economy.netWorth / economy.freedomTarget) : 0;
    const economyFactor = nwProgress * 0.35;

    // Shield health
    const shieldFactor = integrity * posture * 0.20;

    // Inverse pressure
    const pressureFactor = (1 - pressureNorm) * 0.15;

    // Bot threat inverse
    let botThreat = 0;
    for (const bot of battle.bots) {
      const botId = bot.botId as HaterBotId;
      const botState = bot.state as BotState;
      botThreat += BOT_THREAT_LEVEL[botId] * BOT_STATE_THREAT_MULTIPLIER[botState];
    }
    const botSafety = (1 - Math.min(1, botThreat)) * 0.10;

    // Cascade safety
    const cascadeSafety = cascade.activeChains.length === 0 ? 0.08 :
      cascade.activeChains.length === 1 ? 0.04 : 0;

    // Phase bonus — further along = closer to goal
    const phaseBonus = phase === ('SOVEREIGNTY' as RunPhase) ? 0.07 :
      phase === ('ESCALATION' as RunPhase) ? 0.03 : 0;

    // Difficulty penalty
    const difficultyPenalty = (difficulty - 1.0) * 0.05;

    // Income sustainability
    const incomeSustainability = economy.incomePerTick > economy.expensesPerTick ? 0.05 : 0;

    const raw = economyFactor + shieldFactor + pressureFactor + botSafety +
      cascadeSafety + phaseBonus - difficultyPenalty + incomeSustainability;

    return Math.max(0, Math.min(1, raw));
  }

  /**
   * Generate endgame-specific analysis for the SOVEREIGNTY phase.
   * Provides targeted advice for the final push to FREEDOM.
   */
  public generateEndgameAssessment(snapshot: RunStateSnapshot): {
    readonly isEndgame: boolean;
    readonly assessment: string;
    readonly survivalProbability: number;
    readonly criticalFactors: readonly string[];
    readonly recommendedFocus: string;
  } {
    const { shield, economy, pressure, battle, cascade } = snapshot;
    const mode: ModeCode = snapshot.mode;
    const phase: RunPhase = snapshot.phase;
    const layers = shield.layers;

    const isEndgame = phase === ('SOVEREIGNTY' as RunPhase);
    const survivalProbability = this.computeSurvivalProbability(snapshot);
    const integrity = computeWeightedIntegrity(layers);
    const stakes = RUN_PHASE_STAKES_MULTIPLIER[phase];
    const difficulty = MODE_DIFFICULTY_MULTIPLIER[mode];
    const pressureLabel = PRESSURE_TIER_URGENCY_LABEL[pressure.tier];
    const posture = scoreDefensivePosture(layers);

    const criticalFactors: string[] = [];

    // Shield critical factors
    for (const lid of SHIELD_LAYER_ORDER) {
      const ls = layers.find((l) => l.layerId === lid);
      if (!ls) continue;
      const config = SHIELD_LAYER_CONFIGS[lid];
      const danger: LayerDangerLevel = computeLayerDangerLevel(ls.integrityRatio);
      if (danger === 'CRITICAL' || danger === 'SEVERE') {
        criticalFactors.push(
          `${config.doctrineName} at ${danger} (${Math.round(ls.integrityRatio * 100)}%)`,
        );
      }
    }

    // Bot threats
    for (const bot of battle.bots) {
      const botId = bot.botId as HaterBotId;
      const botState = bot.state as BotState;
      const threat = BOT_THREAT_LEVEL[botId] * BOT_STATE_THREAT_MULTIPLIER[botState];
      if (threat > 0.5) {
        criticalFactors.push(`${bot.label} threat at ${Math.round(threat * 100)}%`);
      }
    }

    // Cascades
    if (cascade.activeChains.length > 0) {
      criticalFactors.push(`${cascade.activeChains.length} active cascade(s)`);
    }

    // Economy gap
    const nwProgress = economy.freedomTarget > 0
      ? economy.netWorth / economy.freedomTarget : 0;
    if (nwProgress < 0.8) {
      criticalFactors.push(
        `Economy at ${Math.round(nwProgress * 100)}% of freedom target`,
      );
    }

    // Assessment text
    let assessment: string;
    if (!isEndgame) {
      assessment = `Not yet in endgame (current phase: ${phase}). ` +
        `Survival probability: ${Math.round(survivalProbability * 100)}%. ` +
        `Shield: ${Math.round(integrity * 100)}%. Stakes: ${stakes.toFixed(2)}x.`;
    } else if (survivalProbability > 0.7) {
      assessment = `Strong endgame position. ${Math.round(survivalProbability * 100)}% survival. ` +
        `Shield grade ${computeGradeFromScore(integrity)}. ` +
        `Economy ${Math.round(nwProgress * 100)}% to freedom. Press forward.`;
    } else if (survivalProbability > 0.4) {
      assessment = `Contested endgame. ${Math.round(survivalProbability * 100)}% survival. ` +
        `Shield posture ${Math.round(posture * 100)}%. Pressure: ${pressureLabel}. ` +
        `Difficulty: ${difficulty.toFixed(1)}x. Address critical factors.`;
    } else {
      assessment = `Endangered endgame. Only ${Math.round(survivalProbability * 100)}% survival. ` +
        `Shield integrity ${Math.round(integrity * 100)}%. ` +
        `Multiple critical factors threaten the run. Immediate triage needed.`;
    }

    // Recommended focus
    let recommendedFocus: string;
    if (integrity < 0.3) {
      recommendedFocus = 'Shield repair is the absolute priority.';
    } else if (cascade.activeChains.length > 1) {
      recommendedFocus = 'Resolve cascades before they compound.';
    } else if (nwProgress > 0.9 && integrity > 0.5) {
      recommendedFocus = 'Push for freedom — you are close.';
    } else {
      recommendedFocus = 'Balance defense and economy growth.';
    }

    return {
      isEndgame,
      assessment,
      survivalProbability,
      criticalFactors,
      recommendedFocus,
    };
  }

  /**
   * Compute the optimal defense strategy based on current cross-engine state.
   * Determines which shield layers to prioritize and how to allocate resources.
   */
  public computeOptimalDefenseStrategy(snapshot: RunStateSnapshot): {
    readonly prioritizedLayers: readonly {
      readonly layerId: ShieldLayerId;
      readonly priority: number;
      readonly reason: string;
      readonly danger: LayerDangerLevel;
      readonly grade: ShieldHealthGrade;
    }[];
    readonly overallStrategy: string;
    readonly resourceAllocation: readonly {
      readonly layerId: ShieldLayerId;
      readonly allocationPct: number;
    }[];
    readonly expectedOutcome: string;
  } {
    const { shield, economy, pressure, battle, cascade } = snapshot;
    const mode: ModeCode = snapshot.mode;
    const phase: RunPhase = snapshot.phase;
    const layers = shield.layers;

    const stakes = RUN_PHASE_STAKES_MULTIPLIER[phase];
    const difficulty = MODE_DIFFICULTY_MULTIPLIER[mode];
    const pressureNorm = PRESSURE_TIER_NORMALIZED[pressure.tier];
    const budgetFrac = RUN_PHASE_TICK_BUDGET_FRACTION[phase];

    // Score each layer for priority
    const layerScores: {
      layerId: ShieldLayerId;
      priority: number;
      reason: string;
      danger: LayerDangerLevel;
      grade: ShieldHealthGrade;
    }[] = [];

    for (const lid of SHIELD_LAYER_ORDER) {
      const ls = layers.find((l) => l.layerId === lid);
      if (!ls) continue;
      const config = SHIELD_LAYER_CONFIGS[lid];
      const weight = LAYER_HEALTH_WEIGHT[lid];
      const danger: LayerDangerLevel = computeLayerDangerLevel(ls.integrityRatio);
      const grade: ShieldHealthGrade = computeGradeFromScore(ls.integrityRatio);

      let priority = (1 - ls.integrityRatio) * weight;

      // Cascade gate gets extreme priority when damaged
      if (config.cascadeGate && ls.integrityRatio < 0.5) {
        priority *= 2.5;
      }

      // Breached layers get boosted priority
      if (ls.breached) {
        priority *= 1.8;
      }

      // Stakes amplification
      priority *= stakes;

      // Active cascades boost L4 priority
      if (cascade.activeChains.length > 0 && lid === 'L4') {
        priority += cascade.activeChains.length * 0.1;
      }

      const reason = ls.breached
        ? `${config.doctrineName} BREACHED — ${config.breachConsequenceText}`
        : `${config.doctrineName} at ${danger} danger, weight ${weight.toFixed(2)}`;

      layerScores.push({ layerId: lid, priority, reason, danger, grade });
    }

    // Sort by priority descending
    layerScores.sort((a, b) => b.priority - a.priority);

    // Compute resource allocation (percentage-based)
    const totalPriority = layerScores.reduce((sum, l) => sum + Math.max(0.01, l.priority), 0);
    const resourceAllocation = layerScores.map((l) => ({
      layerId: l.layerId,
      allocationPct: Math.round((Math.max(0.01, l.priority) / totalPriority) * 100),
    }));

    // Overall strategy determination
    const integrity = computeWeightedIntegrity(layers);
    const breachedCount = layers.filter((l) => l.breached).length;
    let overallStrategy: string;

    if (breachedCount >= 2) {
      overallStrategy = `TRIAGE — ${breachedCount} layers breached. Focus all resources on ` +
        `${layerScores[0].layerId} first. Difficulty: ${difficulty.toFixed(1)}x.`;
    } else if (integrity < 0.3) {
      overallStrategy = `EMERGENCY REPAIR — Integrity critically low. ` +
        `Pressure: ${PRESSURE_TIER_URGENCY_LABEL[pressure.tier]}. ` +
        `Stakes: ${stakes.toFixed(2)}x. Budget: ${Math.round(budgetFrac * 100)}%.`;
    } else if (pressureNorm > 0.7 && integrity < 0.5) {
      overallStrategy = `DEFENSIVE HOLD — High pressure with weakened shields. ` +
        `Bot threat active. Fortify before advancing.`;
    } else if (integrity > 0.7 && breachedCount === 0) {
      overallStrategy = `BALANCED — Shields in reasonable shape. ` +
        `Maintain repair cadence. Watch for bot escalation.`;
    } else {
      overallStrategy = `FOCUSED REPAIR — Address weakest layer (${layerScores[0].layerId}) ` +
        `while maintaining awareness of ${battle.bots.filter((b) => (b.state as BotState) === 'ATTACKING').length} attacking bot(s).`;
    }

    // Expected outcome
    let expectedOutcome: string;
    const survProb = this.computeSurvivalProbability(snapshot);
    if (survProb > 0.7) {
      expectedOutcome = `Following this strategy gives ~${Math.round(survProb * 100)}% chance of reaching FREEDOM.`;
    } else if (survProb > 0.4) {
      expectedOutcome = `Contested — ~${Math.round(survProb * 100)}% survival. Execution matters.`;
    } else {
      expectedOutcome = `At risk — only ~${Math.round(survProb * 100)}% survival. Perfect execution needed.`;
    }

    return {
      prioritizedLayers: layerScores,
      overallStrategy,
      resourceAllocation,
      expectedOutcome,
    };
  }
}
