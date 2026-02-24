/**
 * PZO SPRINT 8 — src/engine/antiCheat.ts
 *
 * Deterministic replay verification + anti-cheat hardening.
 *
 * Architecture:
 *   1. Every game action is appended to a tamper-evident action log
 *      (each entry hashes prev_hash + action_data)
 *   2. The full run can be replayed deterministically from (seed + actionLog)
 *   3. A MatchHash is computed at run end — unique fingerprint of the result
 *   4. RulePacks are hashed so any house-rule deviation is detectable
 *   5. Verification compares submitted result vs replay result
 *
 * All operations are synchronous and client-side (no server needed for solo).
 * Club competitive mode should submit matchHash + actionLog to a trusted relay.
 */

import type { SessionAction } from '../types/club';

// ─── Core Hash Utilities ──────────────────────────────────────────────────────

export function fnv32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function fnv32Hex(input: string): string {
  return fnv32(input).toString(16).padStart(8, '0');
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Rule Pack Hashing ────────────────────────────────────────────────────────

export interface RulePack {
  version: string;
  difficultyPreset: string;
  moderatorPreset: string;
  startingCash: number;
  runTicks: number;
  monthTicks: number;
  drawTicks: number;
  fateTicks: number;
  fateFubarPct: number;
  fateMissedPct: number;
  fateSoPct: number;
  maxHand: number;
  // Computed hash — set after buildRulePackHash()
  hash?: string;
}

export function buildRulePackHash(pack: Omit<RulePack, 'hash'>): string {
  const canonical = JSON.stringify({
    v: pack.version,
    diff: pack.difficultyPreset,
    mod: pack.moderatorPreset,
    cash: pack.startingCash,
    ticks: pack.runTicks,
    month: pack.monthTicks,
    draw: pack.drawTicks,
    fate: pack.fateTicks,
    ffpct: pack.fateFubarPct,
    fmpct: pack.fateMissedPct,
    fsopct: pack.fateSoPct,
    hand: pack.maxHand,
  });
  return `RP-${fnv32Hex(canonical)}`;
}

export const DEFAULT_RULE_PACK: RulePack = (() => {
  const pack: Omit<RulePack, 'hash'> = {
    version: '1.0.0',
    difficultyPreset: 'STANDARD',
    moderatorPreset: 'OPEN_CLUB',
    startingCash: 28_000,
    runTicks: 720,
    monthTicks: 12,
    drawTicks: 24,
    fateTicks: 18,
    fateFubarPct: 0.42,
    fateMissedPct: 0.32,
    fateSoPct: 0.21,
    maxHand: 5,
  };
  return { ...pack, hash: buildRulePackHash(pack) };
})();

// ─── Action Log — Tamper-Evident Chain ───────────────────────────────────────

export function hashActionEntry(prevHash: string, action: Omit<SessionAction, 'hash'>): string {
  const payload = [
    prevHash,
    action.tick,
    action.playerId,
    action.type,
    JSON.stringify(action.payload),
    action.timestamp,
  ].join('|');
  return fnv32Hex(payload);
}

export function appendAction(
  log: SessionAction[],
  tick: number,
  playerId: string,
  type: string,
  payload: Record<string, unknown>,
): SessionAction[] {
  const prevHash = log.length > 0 ? log[log.length - 1].hash : '00000000';
  const timestamp = Date.now();
  const withoutHash = { tick, playerId, type, payload, timestamp };
  const hash = hashActionEntry(prevHash, withoutHash);
  return [...log, { ...withoutHash, hash }];
}

export interface VerifyResult {
  valid: boolean;
  chainIntact: boolean;
  firstBreakIndex: number | null;
  totalActions: number;
  suspiciousActions: string[];
  summary: string;
}

export function verifyActionLog(log: SessionAction[]): VerifyResult {
  if (log.length === 0) {
    return { valid: true, chainIntact: true, firstBreakIndex: null, totalActions: 0, suspiciousActions: [], summary: 'Empty log — nothing to verify.' };
  }

  const suspicious: string[] = [];
  let prevHash = '00000000';
  let firstBreak: number | null = null;

  for (let i = 0; i < log.length; i++) {
    const { hash, ...rest } = log[i];
    const expected = hashActionEntry(prevHash, rest);

    if (hash !== expected) {
      if (firstBreak === null) firstBreak = i;
      suspicious.push(`[${i}] hash mismatch: expected ${expected}, got ${hash}`);
    }

    // Tick regression check
    if (i > 0 && log[i].tick < log[i - 1].tick) {
      suspicious.push(`[${i}] tick regression: ${log[i].tick} < ${log[i - 1].tick}`);
    }

    // Timestamp regression check
    if (i > 0 && log[i].timestamp < log[i - 1].timestamp) {
      suspicious.push(`[${i}] timestamp regression`);
    }

    prevHash = hash;
  }

  const valid = suspicious.length === 0;
  return {
    valid,
    chainIntact: firstBreak === null,
    firstBreakIndex: firstBreak,
    totalActions: log.length,
    suspiciousActions: suspicious,
    summary: valid
      ? `✅ Log verified: ${log.length} actions, chain intact.`
      : `❌ ${suspicious.length} integrity violation(s) found. First break at index ${firstBreak}.`,
  };
}

// ─── Match Hash ───────────────────────────────────────────────────────────────

export interface MatchResultSnapshot {
  runSeed: number;
  rulePackHash: string;
  playerId: string;
  finalCash: number;
  finalNetWorth: number;
  finalIncome: number;
  finalExpenses: number;
  totalPlays: number;
  totalFubarHits: number;
  survivedRun: boolean;
  completedObjectiveIds: string[];
  totalScore: number;
  grade: string;
  endTick: number;
  actionLogTailHash: string;   // last hash in action log
}

export function computeMatchHash(snapshot: MatchResultSnapshot): string {
  const canonical = [
    snapshot.runSeed,
    snapshot.rulePackHash,
    snapshot.playerId,
    Math.round(snapshot.finalCash),
    Math.round(snapshot.finalNetWorth),
    Math.round(snapshot.finalIncome),
    Math.round(snapshot.finalExpenses),
    snapshot.totalPlays,
    snapshot.totalFubarHits,
    snapshot.survivedRun ? 1 : 0,
    snapshot.completedObjectiveIds.sort().join(','),
    snapshot.totalScore,
    snapshot.grade,
    snapshot.endTick,
    snapshot.actionLogTailHash,
  ].join('|');

  return `MH-${fnv32Hex(canonical)}-${snapshot.endTick.toString(16)}`;
}

// ─── Deterministic Replay Verifier ───────────────────────────────────────────
//
// Full replay executes the entire action log against the game rules using
// the original seed. The resulting state is compared to the submitted snapshot.
// Any divergence = potential cheat.
//
// Note: Full replay requires the game engine to be importable here.
// The lightweight version below checks statistical plausibility without
// re-running the full engine — use as a fast pre-check.

export interface PlausibilityCheck {
  plausible: boolean;
  flags: string[];
  confidence: number;  // 0–1
}

export function checkResultPlausibility(
  snapshot: MatchResultSnapshot,
  actionLog: SessionAction[],
  rulePack: RulePack,
): PlausibilityCheck {
  const flags: string[] = [];

  // 1. Cash growth sanity: max income per tick * total ticks
  const maxTheoreticalCash = rulePack.startingCash + (rulePack.runTicks / rulePack.monthTicks) * 50_000;
  if (snapshot.finalCash > maxTheoreticalCash) {
    flags.push(`Cash ${snapshot.finalCash} exceeds theoretical max ${maxTheoreticalCash}`);
  }

  // 2. Net worth sanity
  const maxTheoreticalNW = rulePack.startingCash + snapshot.totalPlays * 150_000;
  if (snapshot.finalNetWorth > maxTheoreticalNW) {
    flags.push(`Net worth ${snapshot.finalNetWorth} exceeds theoretical max for ${snapshot.totalPlays} plays`);
  }

  // 3. Total plays vs run ticks
  const maxPlausiblePlays = Math.ceil(rulePack.runTicks / rulePack.drawTicks) * rulePack.maxHand * 2;
  if (snapshot.totalPlays > maxPlausiblePlays) {
    flags.push(`${snapshot.totalPlays} plays exceeds plausible max ${maxPlausiblePlays}`);
  }

  // 4. Action log action count vs total plays
  const playActions = actionLog.filter(a => a.type === 'card_played').length;
  if (Math.abs(playActions - snapshot.totalPlays) > 5) {
    flags.push(`Action log has ${playActions} card_played but snapshot claims ${snapshot.totalPlays}`);
  }

  // 5. Score range check
  const maxScore = 4000 * rulePack.difficultyPreset === 'BRUTAL' ? 1.5 : 1.0;
  if (snapshot.totalScore > maxScore + 2000) {
    flags.push(`Score ${snapshot.totalScore} exceeds plausible range`);
  }

  // 6. End tick check
  if (snapshot.endTick > rulePack.runTicks && snapshot.survivedRun) {
    flags.push(`End tick ${snapshot.endTick} > run length ${rulePack.runTicks}`);
  }

  const confidence = Math.max(0, 1 - flags.length * 0.25);
  return {
    plausible: flags.length === 0,
    flags,
    confidence,
  };
}

// ─── Full Replay Stub ─────────────────────────────────────────────────────────
// The full replay engine rehydrates game state from seed + action log.
// Implement by calling your existing App.tsx startRun() with seed,
// then replaying each SessionAction in order.

export interface ReplayReport {
  matchHash: string;
  verified: boolean;
  logVerification: VerifyResult;
  plausibilityCheck: PlausibilityCheck;
  rulePackHash: string;
  submittedSnapshot: MatchResultSnapshot;
  discrepancies: string[];
  verdict: 'CLEAN' | 'SUSPICIOUS' | 'INVALID';
  verdictReason: string;
}

export function generateReplayReport(
  snapshot: MatchResultSnapshot,
  actionLog: SessionAction[],
  rulePack: RulePack,
): ReplayReport {
  const logVerification = verifyActionLog(actionLog);
  const plausibility = checkResultPlausibility(snapshot, actionLog, rulePack);
  const matchHash = computeMatchHash(snapshot);

  const discrepancies: string[] = [
    ...logVerification.suspiciousActions,
    ...plausibility.flags,
  ];

  const verdict: ReplayReport['verdict'] =
    !logVerification.chainIntact ? 'INVALID' :
    discrepancies.length > 2 ? 'SUSPICIOUS' :
    discrepancies.length > 0 ? 'SUSPICIOUS' : 'CLEAN';

  const verdictReason =
    verdict === 'CLEAN'
      ? 'Result consistent with action log and rule constraints.'
      : verdict === 'INVALID'
      ? `Action log chain broken at index ${logVerification.firstBreakIndex}.`
      : `${discrepancies.length} discrepancy(s) detected. Review required.`;

  return {
    matchHash,
    verified: verdict === 'CLEAN',
    logVerification,
    plausibilityCheck: plausibility,
    rulePackHash: rulePack.hash ?? buildRulePackHash(rulePack),
    submittedSnapshot: snapshot,
    discrepancies,
    verdict,
    verdictReason,
  };
}
