// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m117_table_feed_run_moments_as_a_social_timeline.ts
//
// Mechanic : M117 — Table Feed: Run Moments as a Social Timeline
// Family   : social_advanced   Layer: ui_component   Priority: 2   Batch: 3
// ML Pair  : m117a
// Deps     : M22
//
// Design Laws:
//   ✦ Deterministic-by-seed  ✦ Server-verified via ledger
//   ✦ Bounded chaos          ✦ No pay-to-win

import {
  clamp,
  computeHash,
  seededShuffle,
  seededIndex,
  buildMacroSchedule,
  buildChaosWindows,
  buildWeightedPool,
  OPPORTUNITY_POOL,
  DEFAULT_CARD,
  DEFAULT_CARD_IDS,
  computeDecayRate,
  EXIT_PULSE_MULTIPLIERS,
  MACRO_EVENTS_PER_RUN,
  CHAOS_WINDOWS_PER_RUN,
  RUN_TOTAL_TICKS,
  PRESSURE_WEIGHTS,
  PHASE_WEIGHTS,
  REGIME_WEIGHTS,
  REGIME_MULTIPLIERS,
} from './mechanicsUtils';

import type {
  RunPhase,
  TickTier,
  MacroRegime,
  PressureTier,
  SolvencyStatus,
  Asset,
  IPAItem,
  GameCard,
  GameEvent,
  ShieldLayer,
  Debt,
  Buff,
  Liability,
  SetBonus,
  AssetMod,
  IncomeItem,
  MacroEvent,
  ChaosWindow,
  AuctionResult,
  PurchaseResult,
  ShieldResult,
  ExitResult,
  TickResult,
  DeckComposition,
  TierProgress,
  WipeEvent,
  RegimeShiftEvent,
  PhaseTransitionEvent,
  TimerExpiredEvent,
  StreakEvent,
  FubarEvent,
  LedgerEntry,
  ProofCard,
  CompletedRun,
  SeasonState,
  RunState,
  MomentEvent,
  ClipBoundary,
  MechanicTelemetryPayload,
  MechanicEmitter,
} from './types';

// ── Import Anchors (keeps every symbol accessible + TS-used) ──────────────────

export const M117_IMPORTED_SYMBOLS = {
  clamp,
  computeHash,
  seededShuffle,
  seededIndex,
  buildMacroSchedule,
  buildChaosWindows,
  buildWeightedPool,
  OPPORTUNITY_POOL,
  DEFAULT_CARD,
  DEFAULT_CARD_IDS,
  computeDecayRate,
  EXIT_PULSE_MULTIPLIERS,
  MACRO_EVENTS_PER_RUN,
  CHAOS_WINDOWS_PER_RUN,
  RUN_TOTAL_TICKS,
  PRESSURE_WEIGHTS,
  PHASE_WEIGHTS,
  REGIME_WEIGHTS,
  REGIME_MULTIPLIERS,
} as const;

export type M117_ImportedTypesAnchor = {
  runPhase: RunPhase;
  tickTier: TickTier;
  macroRegime: MacroRegime;
  pressureTier: PressureTier;
  solvencyStatus: SolvencyStatus;
  asset: Asset;
  ipaItem: IPAItem;
  gameCard: GameCard;
  gameEvent: GameEvent;
  shieldLayer: ShieldLayer;
  debt: Debt;
  buff: Buff;
  liability: Liability;
  setBonus: SetBonus;
  assetMod: AssetMod;
  incomeItem: IncomeItem;
  macroEvent: MacroEvent;
  chaosWindow: ChaosWindow;
  auctionResult: AuctionResult;
  purchaseResult: PurchaseResult;
  shieldResult: ShieldResult;
  exitResult: ExitResult;
  tickResult: TickResult;
  deckComposition: DeckComposition;
  tierProgress: TierProgress;
  wipeEvent: WipeEvent;
  regimeShiftEvent: RegimeShiftEvent;
  phaseTransitionEvent: PhaseTransitionEvent;
  timerExpiredEvent: TimerExpiredEvent;
  streakEvent: StreakEvent;
  fubarEvent: FubarEvent;
  ledgerEntry: LedgerEntry;
  proofCard: ProofCard;
  completedRun: CompletedRun;
  seasonState: SeasonState;
  runState: RunState;
  momentEvent: MomentEvent;
  clipBoundary: ClipBoundary;
  mechanicTelemetryPayload: MechanicTelemetryPayload;
  mechanicEmitter: MechanicEmitter;
};

// ── Local types (mechanic-standalone) ──────────────────────────────────────

export type SocialFeedConfig = {
  version: string;
  maxItems: number; // cap feed size
  highlightCooldownTicks: number; // how often highlight can change
  sharePromptEvery: number; // prompt frequency (ticks)
  sharePromptThreshold: number; // score threshold to prompt
};

export type FeedItem = {
  id: string;
  tick: number;
  teamId: string;
  kind: string;
  text: string;
  severity: number; // 0..1
  score: number; // 0..1
  auditHash: string;
};

export type FeedState = {
  items: FeedItem[];
  highlightedId: string | null;
  lastHighlightTick: number;
  auditHash: string;
};

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M117Input {
  runMoments?: MomentEvent[];
  socialFeedConfig?: SocialFeedConfig;
  teamId?: string;

  // Optional, backward-compatible additions (keeps existing callers intact)
  runId?: string;
  tick?: number;
  stateMacroRegime?: MacroRegime;
  stateRunPhase?: RunPhase;
  statePressureTier?: PressureTier;
}

export interface M117Output {
  feedRendered: boolean;
  momentHighlighted: MomentEvent | null;
  sharePrompted: boolean;

  // extra metadata callers can ignore
  feedState?: FeedState;
  feedItems?: FeedItem[];
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M117Event = 'FEED_UPDATED' | 'MOMENT_HIGHLIGHTED' | 'SHARE_PROMPTED';

export interface M117TelemetryPayload extends MechanicTelemetryPayload {
  event: M117Event;
  mechanic_id: 'M117';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M117_BOUNDS = {
  TRIGGER_THRESHOLD: 3,
  MULTIPLIER: 1.5,
  MAX_AMOUNT: 50_000,
  MIN_CASH_DELTA: -20_000,
  MAX_CASH_DELTA: 20_000,
  MIN_CASHFLOW_DELTA: -10_000,
  MAX_CASHFLOW_DELTA: 10_000,
  TIER_ESCAPE_TARGET: 3_000,
  REGIME_SHIFT_THRESHOLD: 500,
  BASE_DECAY_RATE: 0.02,
  BLEED_CASH_THRESHOLD: 1_000,
  FIRST_REFUSAL_TICKS: 6,
  PULSE_CYCLE: 12,
  MAX_PROCEEDS: 999_999,
  EFFECT_MULTIPLIER: 1.0,
  MIN_EFFECT: 0,
  MAX_EFFECT: 100_000,
} as const;

// ── Internal helpers (pure, deterministic) ─────────────────────────────────

type KV = Record<string, unknown>;

function isRecord(v: unknown): v is KV {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function clampTick(t: number): number {
  return clamp(t, 0, RUN_TOTAL_TICKS - 1);
}

function normalizeRegime(v: unknown): MacroRegime {
  switch (v) {
    case 'BULL':
    case 'NEUTRAL':
    case 'BEAR':
    case 'CRISIS':
      return v;
    case 'RECESSION':
    case 'DOWNTURN':
      return 'BEAR';
    case 'BOOM':
    case 'EXPANSION':
      return 'BULL';
    default:
      return 'NEUTRAL';
  }
}

function normalizePhase(v: unknown, tick: number): RunPhase {
  if (v === 'EARLY' || v === 'MID' || v === 'LATE') return v;
  const p = clamp((tick + 1) / RUN_TOTAL_TICKS, 0, 1);
  return p < 0.33 ? 'EARLY' : p < 0.66 ? 'MID' : 'LATE';
}

function chaosActive(tick: number, windows: ChaosWindow[]): boolean {
  for (const w of windows) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function normalizePressure(v: unknown, phase: RunPhase, chaos: boolean): PressureTier {
  if (v === 'LOW' || v === 'MEDIUM' || v === 'HIGH' || v === 'CRITICAL') return v;
  if (chaos) return 'CRITICAL';
  if (phase === 'EARLY') return 'LOW';
  if (phase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

function tickTierFromPressure(p: PressureTier): TickTier {
  return p === 'CRITICAL' ? 'CRITICAL' : p === 'HIGH' ? 'ELEVATED' : 'STANDARD';
}

function stableRunId(input: M117Input, tick: number, teamId: string): string {
  const explicit = typeof input.runId === 'string' ? input.runId.trim() : '';
  if (explicit.length > 0) return explicit;
  return computeHash(`M117:run:${tick}:${teamId}:${JSON.stringify(input.runMoments ?? null)}`);
}

function defaultFeedConfig(): SocialFeedConfig {
  return {
    version: 'M117:v1',
    maxItems: 50,
    highlightCooldownTicks: 6,
    sharePromptEvery: 12,
    sharePromptThreshold: 0.65,
  };
}

function normalizeConfig(raw: unknown): SocialFeedConfig {
  const d = defaultFeedConfig();
  if (!isRecord(raw)) return d;

  const version = typeof raw.version === 'string' ? raw.version : d.version;
  const maxItems = clamp(Math.round(asNumber(raw.maxItems, d.maxItems)), 5, 250);
  const highlightCooldownTicks = clamp(Math.round(asNumber(raw.highlightCooldownTicks, d.highlightCooldownTicks)), 0, 120);
  const sharePromptEvery = clamp(Math.round(asNumber(raw.sharePromptEvery, d.sharePromptEvery)), 1, 240);
  const sharePromptThreshold = clamp(asNumber(raw.sharePromptThreshold, d.sharePromptThreshold), 0, 1);

  return { version, maxItems, highlightCooldownTicks, sharePromptEvery, sharePromptThreshold };
}

function safeMomentTick(m: MomentEvent, fallbackTick: number): number {
  const t = (m as unknown as { tick?: unknown; atTick?: unknown }).tick ?? (m as unknown as { atTick?: unknown }).atTick;
  return typeof t === 'number' && Number.isFinite(t) ? clampTick(t) : fallbackTick;
}

function safeMomentId(m: MomentEvent, seed: string, idx: number): string {
  const id = (m as unknown as { id?: unknown; momentId?: unknown }).id ?? (m as unknown as { momentId?: unknown }).momentId;
  const s = typeof id === 'string' ? id : '';
  return s.length ? s : computeHash(`${seed}:moment:${idx}:${JSON.stringify(m)}`);
}

function momentKind(m: MomentEvent): string {
  const k =
    (m as unknown as { kind?: unknown; type?: unknown; event?: unknown }).kind ??
    (m as unknown as { type?: unknown }).type ??
    (m as unknown as { event?: unknown }).event;
  const s = typeof k === 'string' ? k : 'MOMENT';
  return s.toUpperCase();
}

function momentText(m: MomentEvent): string {
  const t =
    (m as unknown as { text?: unknown; message?: unknown; label?: unknown }).text ??
    (m as unknown as { message?: unknown }).message ??
    (m as unknown as { label?: unknown }).label;

  const s = typeof t === 'string' ? t : '';
  return s.length ? s : 'Run moment recorded.';
}

function momentSeverity(seed: string, tick: number, kind: string): number {
  const base = seededIndex(`${seed}:sev:${kind}`, tick, 101) / 100;
  const kindBoost =
    kind.includes('WIPE') ? 0.35 :
    kind.includes('FUBAR') ? 0.30 :
    kind.includes('STREAK') ? 0.18 :
    kind.includes('PROOF') ? 0.15 :
    kind.includes('EXIT') ? 0.12 :
    0.05;

  return clamp(base * 0.65 + kindBoost, 0, 1);
}

function momentScore(
  severity: number,
  phaseW: number,
  pressureW: number,
  regimeW: number,
  regimeMul: number,
  decay: number,
  exitPulse: number,
): number {
  const macro = clamp(phaseW * pressureW * regimeW * regimeMul * exitPulse * (1 - decay), 0.25, 3.0);
  return clamp(0.10 + severity * 0.70 + (macro - 0.25) * 0.10, 0, 1);
}

/**
 * FIX: This MUST return MacroRegime (your previous stub returned void),
 * which caused regime to become void and broke computeDecayRate + index ops.
 */
function regimeFromSchedule(tick: number, macroSchedule: MacroEvent[], fallbackRegime: MacroRegime): MacroRegime {
  let r: MacroRegime = fallbackRegime;
  const sorted = [...macroSchedule].sort((a, b) => a.tick - b.tick);

  for (const ev of sorted) {
    const e = ev as unknown as { tick?: unknown; regimeChange?: unknown };
    const t = typeof e.tick === 'number' ? e.tick : undefined;
    if (t === undefined) continue;
    if (t > tick) break;

    if (e.regimeChange != null) r = normalizeRegime(e.regimeChange);
  }

  return r;
}

function buildFeedItems(
  seed: string,
  tickNow: number,
  teamId: string,
  moments: MomentEvent[],
  config: SocialFeedConfig,
  macro: {
    phaseW: number;
    pressureW: number;
    regimeW: number;
    regimeMul: number;
    decay: number;
    exitPulse: number;
  },
): FeedItem[] {
  const normalized = (moments ?? [])
    .map((m, idx) => {
      const tick = safeMomentTick(m, tickNow);
      const id = safeMomentId(m, seed, idx);
      const kind = momentKind(m);
      const text = momentText(m);

      const severity = momentSeverity(seed, tick, kind);
      const score = momentScore(
        severity,
        macro.phaseW,
        macro.pressureW,
        macro.regimeW,
        macro.regimeMul,
        macro.decay,
        macro.exitPulse,
      );

      const auditHash = computeHash(
        JSON.stringify({
          mid: 'M117',
          id,
          tick,
          teamId,
          kind,
          severity,
          score,
          text,
          macro,
        }),
      );

      return { id, tick, teamId, kind, text, severity, score, auditHash };
    })
    .sort((a, b) => b.tick - a.tick);

  const grouped: FeedItem[] = [];
  let i = 0;
  while (i < normalized.length) {
    const t = normalized[i].tick;
    const chunk: FeedItem[] = [];
    while (i < normalized.length && normalized[i].tick === t) {
      chunk.push(normalized[i]);
      i++;
    }
    grouped.push(...seededShuffle(chunk, `${seed}:tickGroup:${t}`));
  }

  return grouped.slice(0, config.maxItems);
}

function chooseHighlight(
  seed: string,
  tickNow: number,
  items: FeedItem[],
  cooldownTicks: number,
  lastHighlightTick: number,
): FeedItem | null {
  if (items.length === 0) return null;
  if (tickNow - lastHighlightTick < cooldownTicks) return null;

  const maxScore = Math.max(...items.map(i => i.score));
  const candidates = items.filter(i => i.score >= clamp(maxScore - 0.05, 0, 1));
  const pick = seededIndex(`${seed}:highlight`, tickNow, candidates.length);
  return candidates[pick] ?? candidates[0] ?? null;
}

// ── Exec hook ─────────────────────────────────────────────────────────────

export function tableFeedRenderer(input: M117Input, emit: MechanicEmitter): M117Output {
  const teamId = asString(input.teamId, '').trim();

  const tick =
    typeof input.tick === 'number' && Number.isFinite(input.tick)
      ? clampTick(input.tick)
      : clampTick(seededIndex(computeHash(`M117:tick:${teamId}`), 0, RUN_TOTAL_TICKS));

  const runId = stableRunId(input, tick, teamId);
  const seed = computeHash(`M117:${runId}:${tick}:${teamId}`);

  const macroSchedule = buildMacroSchedule(`${seed}:macro`, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(`${seed}:chaos`, CHAOS_WINDOWS_PER_RUN);

  const chaos = chaosActive(tick, chaosWindows);
  const phase = normalizePhase(input.stateRunPhase, tick);
  const pressure = normalizePressure(input.statePressureTier, phase, chaos);
  const tickTier = tickTierFromPressure(pressure);

  const fallbackRegime = normalizeRegime(input.stateMacroRegime ?? 'NEUTRAL');
  const regime = regimeFromSchedule(tick, macroSchedule, fallbackRegime);

  const decay = computeDecayRate(regime, M117_BOUNDS.BASE_DECAY_RATE);
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const regimeMul = REGIME_MULTIPLIERS[regime] ?? 1.0;

  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const pressureW = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[regime] ?? 1.0;

  const pool = buildWeightedPool(`${seed}:pool`, phaseW * pressureW, regimeW * regimeMul);
  const themeCard =
    (pool[seededIndex(`${seed}:theme`, tick + 1, Math.max(1, pool.length))] as GameCard | undefined) ??
    OPPORTUNITY_POOL[seededIndex(`${seed}:opp`, tick + 11, OPPORTUNITY_POOL.length)] ??
    DEFAULT_CARD;

  const deckSig = seededShuffle(DEFAULT_CARD_IDS, `${seed}:deckSig`).slice(0, Math.min(3, DEFAULT_CARD_IDS.length));

  const config = normalizeConfig(input.socialFeedConfig);

  const moments = (input.runMoments as MomentEvent[]) ?? [];
  const feedItems = buildFeedItems(
    seed,
    tick,
    teamId,
    moments,
    config,
    { phaseW, pressureW, regimeW, regimeMul, decay, exitPulse },
  );

  const lastHighlightTick = clampTick(seededIndex(`${seed}:lastHighlight`, 0, RUN_TOTAL_TICKS));
  const highlightItem = chooseHighlight(seed, tick, feedItems, config.highlightCooldownTicks, lastHighlightTick);

  const momentHighlighted: MomentEvent | null = (() => {
    if (!highlightItem) return null;
    const idx = feedItems.findIndex(i => i.id === highlightItem.id);
    return idx >= 0 ? (moments[idx] ?? null) : null;
  })();

  const cadenceHit = tick % config.sharePromptEvery === 0;
  const bestScore = feedItems.length ? Math.max(...feedItems.map(i => i.score)) : 0;
  const sharePrompted = cadenceHit && bestScore >= config.sharePromptThreshold;

  const feedAudit = computeHash(
    JSON.stringify({
      mid: 'M117',
      runId,
      tick,
      teamId,
      config,
      macro: { phase, regime, pressure, tickTier, phaseW, pressureW, regimeW, regimeMul, exitPulse, decay },
      bestScore,
      highlightId: highlightItem?.id ?? null,
      themeCardId: (themeCard as unknown as { id?: unknown }).id ?? null,
      deckSig,
      count: feedItems.length,
    }),
  );

  emit({
    event: 'FEED_UPDATED',
    mechanic_id: 'M117',
    tick,
    runId,
    payload: {
      feedAudit,
      teamId,
      count: feedItems.length,
      bestScore,
      phase,
      regime,
      pressure,
      tickTier,
      config,
      themeCardId: (themeCard as unknown as { id?: unknown }).id ?? null,
      deckSig,
    },
  });

  if (highlightItem) {
    emit({
      event: 'MOMENT_HIGHLIGHTED',
      mechanic_id: 'M117',
      tick,
      runId,
      payload: {
        feedAudit,
        teamId,
        highlight: highlightItem,
        reason: 'top_score_with_cooldown',
      },
    });
  }

  if (sharePrompted) {
    emit({
      event: 'SHARE_PROMPTED',
      mechanic_id: 'M117',
      tick,
      runId,
      payload: {
        feedAudit,
        teamId,
        bestScore,
        threshold: config.sharePromptThreshold,
        cadenceEvery: config.sharePromptEvery,
        suggestedCopy: `Post your moment: "${highlightItem?.text ?? 'A run moment'}"`,
      },
    });
  }

  const feedState: FeedState = {
    items: feedItems,
    highlightedId: highlightItem?.id ?? null,
    lastHighlightTick: highlightItem ? tick : lastHighlightTick,
    auditHash: feedAudit,
  };

  return {
    feedRendered: true,
    momentHighlighted,
    sharePrompted,
    feedState,
    feedItems,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M117MLInput {
  feedRendered?: boolean;
  momentHighlighted?: MomentEvent | null;
  sharePrompted?: boolean;
  runId: string;
  tick: number;
}

export interface M117MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

export async function tableFeedRendererMLCompanion(input: M117MLInput): Promise<M117MLOutput> {
  const score = Math.min(0.99, Math.max(0.01, Object.keys(input).length * 0.05));

  const topFactors: string[] = [];
  if (input.feedRendered) topFactors.push('Feed rendered');
  if (input.momentHighlighted) topFactors.push('Moment highlighted');
  if (input.sharePrompted) topFactors.push('Share prompted');
  topFactors.push('Advisory only');

  return {
    score,
    topFactors: topFactors.slice(0, 5),
    recommendation: input.sharePrompted ? 'Prompt share now; convert moment into proof.' : 'Keep capturing moments; highlight top events.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M117'),
    confidenceDecay: 0.05,
  };
}