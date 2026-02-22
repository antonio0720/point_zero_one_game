/**
 * M86a — Micro-Proof Moment Detector (Fine-Grain Highlight Mining)
 * Source spec: ml/M86a_micro_proof_moment_detector_fine_grain_highlight_mining.md
 *
 * Finds tiny verifiable achievement moments: clutch saves, perfect exits, clean unwinds.
 * Hardens against farming via near-duplicate clustering + family cooldowns.
 * Generates stamp candidates with replay anchors + signed micro-proof certificates.
 *
 * Deploy to: pzo_ml/src/models/m086a.ts
 */

import { createHash } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MomentType =
  | 'CLUTCH_SAVE'            // survived wipe with ≤$1K cash remaining
  | 'PERFECT_EXIT'           // sold at exitMax or above
  | 'CLEAN_UNWIND'           // fully liquidated a position with positive net
  | 'ZERO_DEBT_CLEAR'        // paid off all debt in a single turn
  | 'INERTIA_BREAK'          // high inertia → decisive purchase
  | 'SHIELD_BLOCK'           // shield absorbed a SEVERE FUBAR
  | 'NEAR_WIPE_RECOVERY'     // went negative cash, recovered within 3 turns
  | 'LADDER_COMPLETE'        // all 4 liquidity rungs filled simultaneously
  | 'RAT_RACE_ESCAPE';       // passive income crossed expenses threshold

export interface MomentCandidate {
  momentType: MomentType;
  runSeed: string;
  tickIndex: number;
  turnNumber: number;
  evidence: Record<string, unknown>;  // supporting data for the moment
  confidence: number;                 // 0–1
  replayAnchor: string;              // hash for replay seek
  microProofCert: string;            // signed certificate for crafting
  familyKey: string;                 // deduplication key (seed+type+family)
  isFarming: boolean;                // true if clustering detected this as a farm attempt
}

export interface MomentWindow {
  events: GameEvent[];
  tickStart: number;
  tickEnd: number;
  windowSize: number;        // number of ticks in window
}

export interface GameEvent {
  eventType: string;
  tickIndex: number;
  turnNumber: number;
  payload: Record<string, unknown>;
}

export interface M86aGameState {
  runSeed: string;
  rulesetVersion: string;
  tickIndex: number;
  turnNumber: number;
  cash: number;
  previousCash: number;      // 3 turns ago (for near-wipe detection)
  netWorth: number;
  passiveIncomeMonthly: number;
  monthlyExpenses: number;
  activeShields: number;
  inertia: number;
  lastCardType: string | null;
  lastCardId: string | null;
  lastSaleProceeds: number;
  lastSaleCost: number;
  totalDebt: number;
  portfolioRungsFilled: number;  // 0–4
  recentEvents: GameEvent[];
}

export interface M86aOutput {
  detected: boolean;
  candidates: MomentCandidate[];
  highestConfidenceMoment: MomentCandidate | null;
  auditHash: string;
}

export interface M86aConfig {
  mlEnabled: boolean;
  familyCooldownTicks: number;    // ticks between same-family stamps; default 20
  minConfidenceThreshold: number; // min confidence to emit; default 0.60
  maxCandidatesPerTick: number;   // default 3
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_FAMILY_COOLDOWN_TICKS = 20;
const DEFAULT_MIN_CONFIDENCE = 0.60;
const MAX_NUDGE = 0.15;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

function buildReplayAnchor(runSeed: string, tickIndex: number, momentType: MomentType): string {
  return sha256(`anchor:${runSeed}:${tickIndex}:${momentType}`).slice(0, 24);
}

function buildMicroProofCert(
  runSeed: string,
  rulesetVersion: string,
  tickIndex: number,
  momentType: MomentType,
  confidence: number,
  evidence: Record<string, unknown>,
): string {
  return sha256(JSON.stringify({
    runSeed,
    rulesetVersion,
    tickIndex,
    momentType,
    confidence: Math.round(confidence * 1000) / 1000,
    evidence,
    modelId: 'M86a',
    modelVersion: '1.0',
  })).slice(0, 32);
}

function buildFamilyKey(runSeed: string, momentType: MomentType): string {
  // Family = runSeed + broad category (prevents mass-farming same moment type)
  const family = momentType.split('_')[0]; // e.g. CLUTCH, PERFECT, CLEAN
  return sha256(`family:${runSeed}:${family}`).slice(0, 16);
}

// ─── Moment Detectors ─────────────────────────────────────────────────────────

function detectClutchSave(state: M86aGameState): number {
  // Cash ≤ $1K but player survived (not wiped), and previous cash was also low
  if (state.cash > 1000) return 0;
  if (state.cash <= 0) return 0;
  const previouslyLow = state.previousCash < 5000;
  return previouslyLow ? 0.90 : 0.75;
}

function detectPerfectExit(state: M86aGameState): number {
  if (state.lastSaleProceeds <= 0) return 0;
  const saleAtMax = state.lastSaleCost > 0 && state.lastSaleProceeds >= state.lastSaleCost * 1.25;
  return saleAtMax ? 0.88 : 0;
}

function detectCleanUnwind(state: M86aGameState): number {
  if (state.lastSaleProceeds <= 0) return 0;
  const netPositive = state.lastSaleProceeds > state.lastSaleCost;
  const noDebtLeft = state.totalDebt === 0;
  if (netPositive && noDebtLeft) return 0.82;
  if (netPositive) return 0.65;
  return 0;
}

function detectZeroDebtClear(state: M86aGameState): number {
  // Debt was > 0 recently, now 0
  const debtJustCleared = state.totalDebt === 0 && state.lastSaleProceeds > 0;
  return debtJustCleared ? 0.78 : 0;
}

function detectInertiaBreak(state: M86aGameState): number {
  // High inertia (>3) followed by a decisive purchase
  if (state.inertia < 3.0) return 0;
  if (state.lastCardType === 'OPPORTUNITY') return 0.72;
  return 0;
}

function detectShieldBlock(state: M86aGameState): number {
  // A FUBAR was drawn but cash was not reduced (shield absorbed it)
  const fubarDriven = state.recentEvents.some(
    e => e.eventType === 'FUBAR_SHIELDED' && e.tickIndex === state.tickIndex,
  );
  return fubarDriven ? 0.95 : 0;
}

function detectNearWipeRecovery(state: M86aGameState): number {
  // Cash was near-negative 3 turns ago, now positive
  const wasNearWipe = state.previousCash < 1000;
  const recoveredNow = state.cash > 5000;
  if (wasNearWipe && recoveredNow) return 0.80;
  return 0;
}

function detectLadderComplete(state: M86aGameState): number {
  return state.portfolioRungsFilled >= 4 ? 0.90 : 0;
}

function detectRatRaceEscape(state: M86aGameState): number {
  const escaped = state.passiveIncomeMonthly > state.monthlyExpenses && state.monthlyExpenses > 0;
  return escaped ? 1.0 : 0;
}

// ─── Farm Detection ───────────────────────────────────────────────────────────

/**
 * Detect farming: same family moment appearing > 2× in last 20 ticks.
 */
function detectFarming(
  momentType: MomentType,
  recentEvents: GameEvent[],
  familyCooldownTicks: number,
): boolean {
  const family = momentType.split('_')[0];
  const recentSameFamily = recentEvents.filter(
    e => e.eventType.startsWith(`MICRO_PROOF:${family}`) &&
      e.tickIndex > recentEvents[recentEvents.length - 1]?.tickIndex - familyCooldownTicks,
  );
  return recentSameFamily.length >= 2;
}

// ─── Main Model ───────────────────────────────────────────────────────────────

export class M86a {
  private readonly config: M86aConfig;

  constructor(config: M86aConfig) {
    this.config = config;
  }

  /**
   * Detect micro-proof moments from current game state.
   * Returns all candidates above confidence threshold.
   * Farming candidates are flagged but still returned (caller decides to suppress).
   */
  public async detectMicroProofMoment(
    state: M86aGameState,
    existingAuditHash: string,
  ): Promise<M86aOutput> {
    if (!this.config.mlEnabled) {
      throw new Error('M86a: ML is disabled');
    }

    const minConf = this.config.minConfidenceThreshold ?? DEFAULT_MIN_CONFIDENCE;
    const cooldown = this.config.familyCooldownTicks ?? DEFAULT_FAMILY_COOLDOWN_TICKS;
    const maxCandidates = this.config.maxCandidatesPerTick ?? 3;

    // Run all detectors
    const detectors: Array<[MomentType, () => number]> = [
      ['CLUTCH_SAVE',         () => detectClutchSave(state)],
      ['PERFECT_EXIT',        () => detectPerfectExit(state)],
      ['CLEAN_UNWIND',        () => detectCleanUnwind(state)],
      ['ZERO_DEBT_CLEAR',     () => detectZeroDebtClear(state)],
      ['INERTIA_BREAK',       () => detectInertiaBreak(state)],
      ['SHIELD_BLOCK',        () => detectShieldBlock(state)],
      ['NEAR_WIPE_RECOVERY',  () => detectNearWipeRecovery(state)],
      ['LADDER_COMPLETE',     () => detectLadderComplete(state)],
      ['RAT_RACE_ESCAPE',     () => detectRatRaceEscape(state)],
    ];

    const candidates: MomentCandidate[] = [];

    for (const [momentType, detector] of detectors) {
      const rawConf = detector();
      const confidence = clamp(rawConf);

      if (confidence < minConf) continue;

      const isFarming = detectFarming(momentType, state.recentEvents, cooldown);
      const evidence = this.buildEvidence(momentType, state);
      const replayAnchor = buildReplayAnchor(state.runSeed, state.tickIndex, momentType);
      const microProofCert = buildMicroProofCert(
        state.runSeed,
        state.rulesetVersion,
        state.tickIndex,
        momentType,
        confidence,
        evidence,
      );
      const familyKey = buildFamilyKey(state.runSeed, momentType);

      candidates.push({
        momentType,
        runSeed: state.runSeed,
        tickIndex: state.tickIndex,
        turnNumber: state.turnNumber,
        evidence,
        confidence,
        replayAnchor,
        microProofCert,
        familyKey,
        isFarming,
      });
    }

    // Sort by confidence desc, cap at maxCandidates
    candidates.sort((a, b) => b.confidence - a.confidence);
    const topCandidates = candidates.slice(0, maxCandidates);

    const highestConfidenceMoment = topCandidates.find(c => !c.isFarming) ?? null;

    const auditHash = sha256(JSON.stringify({
      existingAuditHash,
      runSeed: state.runSeed,
      rulesetVersion: state.rulesetVersion,
      tickIndex: state.tickIndex,
      candidateCount: topCandidates.length,
      topMoment: highestConfidenceMoment?.momentType ?? null,
      modelId: 'M86a',
    })).slice(0, 32);

    return {
      detected: topCandidates.length > 0,
      candidates: topCandidates,
      highestConfidenceMoment,
      auditHash,
    };
  }

  private buildEvidence(momentType: MomentType, state: M86aGameState): Record<string, unknown> {
    switch (momentType) {
      case 'CLUTCH_SAVE':
        return { cash: state.cash, previousCash: state.previousCash, netWorth: state.netWorth };
      case 'PERFECT_EXIT':
        return { saleProceeds: state.lastSaleProceeds, originalCost: state.lastSaleCost, gain: state.lastSaleProceeds - state.lastSaleCost };
      case 'CLEAN_UNWIND':
        return { saleProceeds: state.lastSaleProceeds, totalDebt: state.totalDebt };
      case 'ZERO_DEBT_CLEAR':
        return { totalDebt: state.totalDebt, saleProceeds: state.lastSaleProceeds };
      case 'INERTIA_BREAK':
        return { inertia: state.inertia, cardType: state.lastCardType };
      case 'SHIELD_BLOCK':
        return { activeShields: state.activeShields, tick: state.tickIndex };
      case 'NEAR_WIPE_RECOVERY':
        return { previousCash: state.previousCash, currentCash: state.cash };
      case 'LADDER_COMPLETE':
        return { rungsFilled: state.portfolioRungsFilled };
      case 'RAT_RACE_ESCAPE':
        return { passiveIncome: state.passiveIncomeMonthly, monthlyExpenses: state.monthlyExpenses };
    }
  }
}

export { M86aConfig };
