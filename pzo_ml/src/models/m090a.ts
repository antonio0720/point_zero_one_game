/**
 * M90a — Salvage & Reroll Economy Stabilizer (Loop Detection + Sink Tuning)
 * Source spec: ml/M90a_salvage_reroll_economy_stabilizer_loop_detection_sink_tuning.md
 *
 * Models salvage inflow/outflow to keep reroll tokens valuable.
 * Detects reroll loop exploits (quest cycling, stamp farming) → deterministic cooldowns.
 * Generates tuning proposals for season designers.
 *
 * Deploy to: pzo_ml/src/models/m090a.ts
 */

import { createHash } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LoopType =
  | 'QUEST_CYCLING'         // repeating same quest path to farm rerolls
  | 'STAMP_FARMING'         // grinding same moment type for micro-proof stamps
  | 'REROLL_CHURN'          // rerolling the same slot repeatedly without engaging
  | 'SALVAGE_DUMP'          // mass-salvaging low-value items for volume
  | 'CHALLENGE_EXPLOIT';    // exploiting sponsored bounty payout cycle

export interface SalvageTransaction {
  txId: string;
  playerId: string;
  runSeed: string;
  tickIndex: number;
  itemType: string;
  salvageValue: number;      // tokens generated
  rerollsGranted: number;
  createdAt: number;
}

export interface RerollTransaction {
  txId: string;
  playerId: string;
  runSeed: string;
  tickIndex: number;
  slotId: string;
  rerollCost: number;
  outcomeValue: number;      // value of what was obtained
  createdAt: number;
}

export interface M90aPlayerEconState {
  playerId: string;
  runSeed: string;
  rulesetVersion: string;
  tickIndex: number;
  salvageHistory: SalvageTransaction[];     // last N transactions
  rerollHistory: RerollTransaction[];       // last N transactions
  totalTokensEarned: number;
  totalTokensSpent: number;
  sessionDurationTicks: number;
  achievementsEarnedThisSession: number;
}

export interface LoopDetectionResult {
  loopDetected: boolean;
  loopType: LoopType | null;
  confidence: number;
  cooldownTicks: number;     // deterministic cooldown to apply
  evidence: Record<string, unknown>;
}

export interface SinkTuningProposal {
  targetParam: 'SALVAGE_RATE' | 'REROLL_COST' | 'TOKEN_CAP' | 'COOLDOWN_DURATION';
  currentValue: number;
  proposedValue: number;
  delta: number;
  rationale: string;
}

export interface M90aOutput {
  loopDetection: LoopDetectionResult;
  economyHealth: 'HEALTHY' | 'INFLATING' | 'DEFLATING' | 'EXPLOIT_DETECTED';
  tokenInflowRate: number;   // tokens/tick (bounded [0,1] normalized)
  tokenOutflowRate: number;
  sinkTuningProposals: SinkTuningProposal[];
  cooldownToApply: number;   // ticks; 0 if no action needed
  auditHash: string;
}

export interface M90aConfig {
  mlEnabled: boolean;
  auditHash: string;
  boundedNudges: BoundedNudge[];
  maxNudgeStrength: number;
  windowTicks: number;         // analysis window; default 50 ticks
  loopThreshold: number;       // repetitions before loop is flagged; default 3
}

export interface BoundedNudge {
  min: number;
  max: number;
  nudge(value: number): number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_WINDOW_TICKS = 50;
const DEFAULT_LOOP_THRESHOLD = 3;
const DEFAULT_COOLDOWN_QUEST_CYCLING = 15;
const DEFAULT_COOLDOWN_STAMP_FARMING = 20;
const DEFAULT_COOLDOWN_REROLL_CHURN = 10;
const DEFAULT_COOLDOWN_SALVAGE_DUMP = 8;
const DEFAULT_COOLDOWN_CHALLENGE_EXPLOIT = 25;
const MAX_NUDGE = 0.15;

const COOLDOWN_BY_LOOP: Record<LoopType, number> = {
  QUEST_CYCLING:      DEFAULT_COOLDOWN_QUEST_CYCLING,
  STAMP_FARMING:      DEFAULT_COOLDOWN_STAMP_FARMING,
  REROLL_CHURN:       DEFAULT_COOLDOWN_REROLL_CHURN,
  SALVAGE_DUMP:       DEFAULT_COOLDOWN_SALVAGE_DUMP,
  CHALLENGE_EXPLOIT:  DEFAULT_COOLDOWN_CHALLENGE_EXPLOIT,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

export function createBoundedNudge(min: number, max: number): BoundedNudge {
  return {
    min,
    max,
    nudge(value: number): number {
      return Math.max(min, Math.min(max, value));
    },
  };
}

// ─── Loop Detection ───────────────────────────────────────────────────────────

function detectQuestCycling(salvage: SalvageTransaction[], windowTicks: number, threshold: number): { confidence: number; evidence: Record<string, unknown> } {
  if (salvage.length < threshold) return { confidence: 0, evidence: {} };
  const recentItemTypes = salvage.slice(-threshold * 2).map(s => s.itemType);
  const uniqueTypes = new Set(recentItemTypes).size;
  // Low unique types = cycling the same item
  const cycleRatio = recentItemTypes.length > 0 ? 1 - uniqueTypes / recentItemTypes.length : 0;
  return {
    confidence: clamp(cycleRatio * 1.2),
    evidence: { uniqueTypes, totalRecent: recentItemTypes.length, cycleRatio },
  };
}

function detectStampFarming(salvage: SalvageTransaction[], rerolls: RerollTransaction[], threshold: number): { confidence: number; evidence: Record<string, unknown> } {
  const highVolumeRerolls = rerolls.filter(r => r.rerollCost > 0 && r.outcomeValue < r.rerollCost * 0.5);
  const lossPct = rerolls.length > 0 ? highVolumeRerolls.length / rerolls.length : 0;
  const rapidSalvage = salvage.filter((s, i) =>
    i > 0 && salvage[i - 1] && s.createdAt - salvage[i - 1].createdAt < 1000,
  ).length;
  const confidence = clamp(lossPct * 0.6 + (rapidSalvage > threshold ? 0.4 : 0));
  return { confidence, evidence: { lossPct, rapidSalvage } };
}

function detectRerollChurn(rerolls: RerollTransaction[], windowTicks: number, threshold: number): { confidence: number; evidence: Record<string, unknown> } {
  if (rerolls.length < threshold) return { confidence: 0, evidence: {} };
  // Group by slotId — same slot rerolled many times = churn
  const slotCounts: Record<string, number> = {};
  for (const r of rerolls.slice(-20)) {
    slotCounts[r.slotId] = (slotCounts[r.slotId] ?? 0) + 1;
  }
  const maxSlotCount = Math.max(...Object.values(slotCounts));
  const confidence = maxSlotCount >= threshold ? clamp(maxSlotCount / 10) : 0;
  return {
    confidence,
    evidence: { maxSlotCount, threshold, slotCounts: Object.keys(slotCounts).length },
  };
}

function detectSalvageDump(salvage: SalvageTransaction[], threshold: number): { confidence: number; evidence: Record<string, unknown> } {
  if (salvage.length < threshold) return { confidence: 0, evidence: {} };
  const lowValueRatio = salvage.filter(s => s.salvageValue < 5).length / salvage.length;
  const confidence = lowValueRatio > 0.75 && salvage.length > threshold ? clamp(lowValueRatio) : 0;
  return { confidence, evidence: { lowValueRatio, count: salvage.length } };
}

// ─── Economy Health ───────────────────────────────────────────────────────────

function assessEconomyHealth(
  inflow: number,
  outflow: number,
  loopDetected: boolean,
): M90aOutput['economyHealth'] {
  if (loopDetected) return 'EXPLOIT_DETECTED';
  const ratio = outflow > 0 ? inflow / outflow : 0;
  if (ratio > 1.3) return 'INFLATING';
  if (ratio < 0.7) return 'DEFLATING';
  return 'HEALTHY';
}

// ─── Sink Tuning Proposals ────────────────────────────────────────────────────

function buildSinkProposals(
  health: M90aOutput['economyHealth'],
  inflow: number,
  outflow: number,
  maxNudge: number,
): SinkTuningProposal[] {
  const proposals: SinkTuningProposal[] = [];

  if (health === 'INFLATING') {
    proposals.push({
      targetParam: 'REROLL_COST',
      currentValue: 10,
      proposedValue: 10 + Math.round(clamp((inflow - outflow) / outflow, 0, maxNudge) * 10),
      delta: Math.round(clamp((inflow - outflow) / outflow, 0, maxNudge) * 10),
      rationale: 'Token inflow exceeds outflow — raise reroll cost to add friction',
    });
    proposals.push({
      targetParam: 'TOKEN_CAP',
      currentValue: 500,
      proposedValue: Math.round(500 * (1 - maxNudge * 0.5)),
      delta: -Math.round(500 * maxNudge * 0.5),
      rationale: 'Cap token accumulation to prevent hoarding',
    });
  }

  if (health === 'DEFLATING') {
    proposals.push({
      targetParam: 'SALVAGE_RATE',
      currentValue: 1.0,
      proposedValue: clamp(1.0 + maxNudge * 0.5, 1.0, 1.5),
      delta: maxNudge * 0.5,
      rationale: 'Token scarcity dampening engagement — increase salvage rate slightly',
    });
  }

  if (health === 'EXPLOIT_DETECTED') {
    proposals.push({
      targetParam: 'COOLDOWN_DURATION',
      currentValue: 20,
      proposedValue: 35,
      delta: 15,
      rationale: 'Loop exploit detected — extend cooldown to break cycle',
    });
  }

  return proposals;
}

// ─── Main Model ───────────────────────────────────────────────────────────────

export class M90a {
  private readonly _auditHash: string;
  private readonly _boundedNudges: BoundedNudge[];
  private readonly _mlEnabled: boolean;
  private readonly _windowTicks: number;
  private readonly _loopThreshold: number;
  private readonly _maxNudge: number;

  constructor(auditHash: string, boundedNudges: BoundedNudge[], mlEnabled: boolean, config?: Partial<M90aConfig>) {
    this._auditHash = auditHash;
    this._boundedNudges = boundedNudges;
    this._mlEnabled = mlEnabled;
    this._windowTicks = config?.windowTicks ?? DEFAULT_WINDOW_TICKS;
    this._loopThreshold = config?.loopThreshold ?? DEFAULT_LOOP_THRESHOLD;
    this._maxNudge = config?.maxNudgeStrength ?? MAX_NUDGE;
  }

  public analyze(state: M90aPlayerEconState): M90aOutput {
    if (!this._mlEnabled) {
      throw new Error('M90a: ML is disabled');
    }

    const nudge = this._boundedNudges[0] ?? createBoundedNudge(0, 1);
    const window = this._windowTicks;
    const threshold = this._loopThreshold;
    const recentSalvage = state.salvageHistory.slice(-50);
    const recentRerolls = state.rerollHistory.slice(-50);

    // ── Loop Detection ─────────────────────────────────────────────────────
    const questResult     = detectQuestCycling(recentSalvage, window, threshold);
    const stampResult     = detectStampFarming(recentSalvage, recentRerolls, threshold);
    const churnResult     = detectRerollChurn(recentRerolls, window, threshold);
    const dumpResult      = detectSalvageDump(recentSalvage, threshold);

    // Pick highest confidence loop signal
    const loopSignals: Array<{ type: LoopType; confidence: number; evidence: Record<string, unknown> }> = [
      { type: 'QUEST_CYCLING',  confidence: questResult.confidence,  evidence: questResult.evidence },
      { type: 'STAMP_FARMING',  confidence: stampResult.confidence,  evidence: stampResult.evidence },
      { type: 'REROLL_CHURN',   confidence: churnResult.confidence,  evidence: churnResult.evidence },
      { type: 'SALVAGE_DUMP',   confidence: dumpResult.confidence,   evidence: dumpResult.evidence },
    ].sort((a, b) => b.confidence - a.confidence);

    const topLoop = loopSignals[0];
    const loopDetected = topLoop.confidence >= 0.60;

    const loopDetection: LoopDetectionResult = {
      loopDetected,
      loopType: loopDetected ? topLoop.type : null,
      confidence: nudge.nudge(topLoop.confidence),
      cooldownTicks: loopDetected ? COOLDOWN_BY_LOOP[topLoop.type] : 0,
      evidence: loopDetected ? topLoop.evidence : {},
    };

    // ── Economy Flow ────────────────────────────────────────────────────────
    const totalInflowTokens = recentSalvage.reduce((s, t) => s + t.salvageValue, 0);
    const totalOutflowTokens = recentRerolls.reduce((s, t) => s + t.rerollCost, 0);
    const tickRange = window > 0 ? window : 1;
    const tokenInflowRate = nudge.nudge(clamp(totalInflowTokens / (tickRange * 100)));
    const tokenOutflowRate = nudge.nudge(clamp(totalOutflowTokens / (tickRange * 100)));

    const health = assessEconomyHealth(tokenInflowRate, tokenOutflowRate, loopDetected);
    const proposals = buildSinkProposals(health, tokenInflowRate, tokenOutflowRate, this._maxNudge);

    const auditHash = sha256(JSON.stringify({
      storedAuditHash: this._auditHash,
      playerId: state.playerId,
      runSeed: state.runSeed,
      rulesetVersion: state.rulesetVersion,
      tickIndex: state.tickIndex,
      loopDetected,
      loopType: loopDetection.loopType,
      health,
      modelId: 'M90a',
    })).slice(0, 32);

    return {
      loopDetection,
      economyHealth: health,
      tokenInflowRate,
      tokenOutflowRate,
      sinkTuningProposals: proposals,
      cooldownToApply: loopDetection.cooldownTicks,
      auditHash,
    };
  }

  public getAuditHash(): string { return this._auditHash; }
  public getBoundedNudges(): BoundedNudge[] { return this._boundedNudges; }
  public isMlEnabled(): boolean { return this._mlEnabled; }
}

export function createM90a(
  auditHash: string,
  boundedNudges: BoundedNudge[],
  mlEnabled: boolean,
  config?: Partial<M90aConfig>,
): M90a {
  if (!mlEnabled) throw new Error('M90a: Cannot create model when ML is disabled');
  return new M90a(auditHash, boundedNudges, mlEnabled, config);
}

/**
 * Retrieve an M90a model from a registry/singleton store.
 * In production, inject this via DI container.
 * Here we expose the factory signature for consumers.
 */
export function getMlModel(
  auditHash: string,
  boundedNudges: BoundedNudge[],
  mlEnabled: boolean,
): M90a | null {
  if (!mlEnabled) return null;
  try {
    return createM90a(auditHash, boundedNudges, mlEnabled);
  } catch {
    return null;
  }
}
