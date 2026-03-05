// pzo_engine/src/ml/runtime/m01a-features.ts
// Density6 LLC · Point Zero One · Confidential
//
// Feature extraction for M01A.
// Designed to work from moment-0 with sparse/noisy telemetry.
// Does NOT rely on schema-specific action fields; uses robust heuristics.

import { clamp } from './math';

export type TickSnapshotLite = {
  tickIndex: number;
  tickHash?: string;
  netWorth?: number;
  shieldAvgIntegrity?: number;
  haterHeat?: number;
};

export type M01AFeatureResult = {
  schemaVersion: 'v1';
  featureNames: readonly string[];
  x: number[]; // aligned with featureNames
  flags: string[];
  heuristicAnomaly: number; // 0..1 (higher = more suspicious)
};

const FEATURE_NAMES_V1 = [
  'bias', // intercept
  'timeline_len_log',
  'unique_action_ratio',
  'dup_signature_ratio',
  'fast_burst_ratio',
  'missing_ts_ratio',
  'tick_snaps_present',
  'tick_gap_flag',
  'dup_tick_hash_ratio',
  'net_worth_jump_rate',
  'shield_jump_rate',
  'hater_heat_jump_rate',
  'macro_regime_missing',
] as const;

const NET_WORTH_JUMP_MULT = 10;
const NET_WORTH_JUMP_ABS = 500_000;
const SHIELD_RECOVERY_THRESHOLD = 15;
const HATER_HEAT_DELTA_THRESHOLD = 30;

export function getM01AFeatureNamesV1(): readonly string[] {
  return FEATURE_NAMES_V1;
}

export function extractM01AFeatures(params: {
  actionTimeline: Record<string, unknown>[];
  tickSnapshots?: TickSnapshotLite[];
  expectedTickCount?: number;
  macroRegime?: string;
}): M01AFeatureResult {
  const flags: string[] = [];

  // ── Action timeline robust stats ──────────────────────────────────────────
  const timeline = Array.isArray(params.actionTimeline) ? params.actionTimeline : [];
  const n = timeline.length;

  // Try to find an "action kind" discriminator in each event
  const kinds: string[] = [];
  let tsPresent = 0;
  const sigCounts = new Map<string, number>();
  const tsList: number[] = [];

  for (const ev of timeline) {
    const kind =
      (typeof ev['action'] === 'string' && ev['action']) ||
      (typeof ev['type'] === 'string' && ev['type']) ||
      (typeof ev['kind'] === 'string' && ev['kind']) ||
      (typeof ev['event'] === 'string' && ev['event']) ||
      'UNKNOWN';

    kinds.push(kind);

    const ts =
      (typeof ev['ts'] === 'number' && ev['ts']) ||
      (typeof ev['timestamp'] === 'number' && ev['timestamp']) ||
      (typeof ev['time'] === 'number' && ev['time']) ||
      null;

    if (typeof ts === 'number' && Number.isFinite(ts)) {
      tsPresent += 1;
      tsList.push(ts);
    }

    // signature = kind + (tick if present) + (cardId if present)
    const tickStr =
      (typeof ev['tick'] === 'number' && Number.isFinite(ev['tick'] as number) && String(ev['tick'])) ||
      (typeof ev['tickIndex'] === 'number' && Number.isFinite(ev['tickIndex'] as number) && String(ev['tickIndex'])) ||
      '';
    const cardStr =
      (typeof ev['cardId'] === 'string' && ev['cardId']) ||
      (typeof ev['card_id'] === 'string' && ev['card_id']) ||
      '';
    const sig = `${kind}|${tickStr}|${cardStr}`;
    sigCounts.set(sig, (sigCounts.get(sig) ?? 0) + 1);
  }

  const uniqueKinds = new Set(kinds).size;
  const uniqueActionRatio = n > 0 ? uniqueKinds / n : 0;

  let dupTotal = 0;
  for (const c of sigCounts.values()) if (c > 1) dupTotal += (c - 1);
  const dupSignatureRatio = n > 0 ? dupTotal / n : 0;

  // Fast burst ratio: consecutive timestamps with tiny delta
  let fastPairs = 0;
  if (tsList.length >= 2) {
    tsList.sort((a, b) => a - b);
    for (let i = 1; i < tsList.length; i++) {
      const dt = tsList[i] - tsList[i - 1];
      if (dt >= 0 && dt <= 50) fastPairs += 1; // 50ms burst
    }
  }
  const fastBurstRatio = tsList.length >= 2 ? fastPairs / (tsList.length - 1) : 0;
  const missingTsRatio = n > 0 ? 1 - (tsPresent / n) : 1;

  if (fastBurstRatio > 0.25 && n >= 20) flags.push('FAST_BURST');
  if (dupSignatureRatio > 0.35 && n >= 20) flags.push('DUP_ACTION_SIGNATURES');

  // ── Tick snapshot checks (if provided) ────────────────────────────────────
  const snaps = params.tickSnapshots ?? [];
  const tickSnapsPresent = snaps.length > 0 ? 1 : 0;

  let tickGapFlag = 0;
  let dupTickHashRatio = 0;
  let netWorthJumps = 0;
  let shieldJumps = 0;
  let heatJumps = 0;

  if (snaps.length > 0) {
    // gapless indices?
    const sorted = [...snaps].sort((a, b) => a.tickIndex - b.tickIndex);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].tickIndex !== sorted[0].tickIndex + i) {
        tickGapFlag = 1;
        flags.push('TICK_GAP');
        break;
      }
    }

    // duplicate tick hashes ratio
    const hashes = sorted.map(s => (typeof s.tickHash === 'string' ? s.tickHash : '')).filter(Boolean);
    if (hashes.length > 0) {
      const seen = new Map<string, number>();
      for (const h of hashes) seen.set(h, (seen.get(h) ?? 0) + 1);
      let d = 0;
      for (const c of seen.values()) if (c > 1) d += (c - 1);
      dupTickHashRatio = hashes.length > 0 ? d / hashes.length : 0;
      if (dupTickHashRatio > 0.08) flags.push('DUP_TICK_HASH');
    }

    // anomaly rates
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      const prevNW = typeof prev.netWorth === 'number' ? prev.netWorth : 0;
      const currNW = typeof curr.netWorth === 'number' ? curr.netWorth : 0;
      const prevAbs = Math.abs(prevNW) + 1;
      const currAbs = Math.abs(currNW);
      const deltaNW = currNW - prevNW;

      if (currAbs > prevAbs * NET_WORTH_JUMP_MULT && deltaNW > NET_WORTH_JUMP_ABS) netWorthJumps += 1;

      const prevShield = typeof prev.shieldAvgIntegrity === 'number' ? prev.shieldAvgIntegrity : 0;
      const currShield = typeof curr.shieldAvgIntegrity === 'number' ? curr.shieldAvgIntegrity : 0;
      if ((currShield - prevShield) > SHIELD_RECOVERY_THRESHOLD) shieldJumps += 1;

      const prevHeat = typeof prev.haterHeat === 'number' ? prev.haterHeat : 0;
      const currHeat = typeof curr.haterHeat === 'number' ? curr.haterHeat : 0;
      if (Math.abs(currHeat - prevHeat) > HATER_HEAT_DELTA_THRESHOLD) heatJumps += 1;
    }

    const denom = Math.max(1, sorted.length - 1);
    if ((netWorthJumps / denom) > 0.03) flags.push('NET_WORTH_JUMP');
    if ((shieldJumps / denom) > 0.05) flags.push('SHIELD_JUMP');
    if ((heatJumps / denom) > 0.07) flags.push('HATER_HEAT_JUMP');
  }

  // ── Macro regime presence ────────────────────────────────────────────────
  const macroRegimeMissing = (!params.macroRegime || String(params.macroRegime).trim().length === 0) ? 1 : 0;

  // ── Heuristic anomaly score (0..1) ────────────────────────────────────────
  let heuristic = 0;
  heuristic += clamp(dupSignatureRatio * 0.60, 0, 0.35);
  heuristic += clamp(fastBurstRatio * 0.60, 0, 0.25);
  heuristic += clamp(dupTickHashRatio * 1.20, 0, 0.35);
  heuristic += tickGapFlag ? 0.35 : 0;

  const denomSnaps = Math.max(1, (snaps.length > 0 ? (snaps.length - 1) : 1));
  heuristic += clamp((netWorthJumps / denomSnaps) * 4.0, 0, 0.35);
  heuristic += clamp((shieldJumps / denomSnaps) * 3.0, 0, 0.25);
  heuristic += clamp((heatJumps / denomSnaps) * 2.5, 0, 0.20);

  heuristic = clamp(heuristic, 0, 1);

  const timelineLenLog = n > 0 ? Math.log1p(n) : 0;

  const x: number[] = [
    1, // bias
    timelineLenLog,
    clamp(uniqueActionRatio, 0, 1),
    clamp(dupSignatureRatio, 0, 1),
    clamp(fastBurstRatio, 0, 1),
    clamp(missingTsRatio, 0, 1),
    tickSnapsPresent,
    tickGapFlag,
    clamp(dupTickHashRatio, 0, 1),
    clamp(netWorthJumps / Math.max(1, (snaps.length - 1)), 0, 1),
    clamp(shieldJumps / Math.max(1, (snaps.length - 1)), 0, 1),
    clamp(heatJumps / Math.max(1, (snaps.length - 1)), 0, 1),
    macroRegimeMissing,
  ];

  return {
    schemaVersion: 'v1',
    featureNames: FEATURE_NAMES_V1,
    x,
    flags,
    heuristicAnomaly: heuristic,
  };
}