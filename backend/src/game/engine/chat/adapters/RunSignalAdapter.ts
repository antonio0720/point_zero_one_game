
/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT RUN SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/RunSignalAdapter.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend adapter that translates run-lifecycle truth, economy truth,
 * pressure truth, and deterministic runtime truth into authoritative backend
 * chat run signals.
 *
 * Backend-truth question
 * ----------------------
 *   "When the backend run lane advances, degrades, stabilizes, nears
 *    sovereignty, or fails, what exact run-native chat signal should the
 *    authoritative backend chat engine ingest?"
 *
 * Repo truths preserved
 * ---------------------
 * - backend/src/game/engine/core/RunStateSnapshot.ts already defines the
 *   canonical backend run snapshot with economy, pressure, battle, shield,
 *   sovereignty, cards, modeState, timers, and telemetry slices.
 * - backend/src/game/engine/run_runtime.ts already owns deterministic
 *   RUN_CREATED, TURN_SUBMITTED, RUN_FINALIZED, and replay-backed in-memory
 *   lifecycle semantics.
 * - pzo-web/src/engines/chat/adapters/RunStoreAdapter.ts already proves the
 *   donor lane expects bankruptcy warning, drawdown witness, comeback witness,
 *   threat pressure witness, and recommendation shaping without replacing run
 *   truth.
 *
 * Therefore this file owns:
 * - run snapshot compatibility and migration protection,
 * - lifecycle event normalization,
 * - bankruptcy / comeback / near-sovereignty derivation,
 * - tick-tier and pressure-tier normalization,
 * - route-channel recommendation,
 * - dedupe protection,
 * - and explainable diagnostics for backend chat ingestion.
 *
 * It does not own:
 * - transcript mutation,
 * - moderation,
 * - rate policy,
 * - socket fanout,
 * - or final helper speech generation.
 *
 * Design laws
 * -----------
 * - Preserve run-store words. Do not genericize them.
 * - Numbers do not speak directly; chat witnesses them.
 * - Not every delta deserves visible output.
 * - Bankruptcy warnings should feel disciplined rather than spammy.
 * - Recovery should be legible without fake optimism.
 * - Deterministic runtime events must remain replay-safe.
 * ============================================================================
 */

import {
  asUnixMs,
  clamp01,
  clamp100,
  type ChatInputEnvelope,
  type ChatRoomId,
  type ChatRunSnapshot,
  type ChatSignalEnvelope,
  type ChatVisibleChannel,
  type JsonValue,
  type Nullable,
  type RunOutcome,
  type Score01,
  type Score100,
  type TickTier,
  type UnixMs,
} from '../types';


export interface RunSignalAdapterLogger {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface RunSignalAdapterClock {
  now(): UnixMs;
}

export interface RunSignalAdapterOptions {
  readonly defaultRoomId: ChatRoomId | string;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  readonly dedupeWindowMs?: number;
  readonly maxHistory?: number;
  readonly logger?: RunSignalAdapterLogger;
  readonly clock?: RunSignalAdapterClock;
}

export interface RunSignalAdapterContext {
  readonly roomId?: ChatRoomId | string | null;
  readonly routeChannel?: ChatVisibleChannel;
  readonly emittedAt?: number;
  readonly source?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export type RunSignalAdapterEventName =
  | 'run.created'
  | 'run.turn_submitted'
  | 'run.finalized'
  | 'run.replayed'
  | 'RUN_CREATED'
  | 'TURN_SUBMITTED'
  | 'RUN_FINALIZED'
  | string;

export type RunSignalAdapterSeverity =
  | 'DEBUG'
  | 'INFO'
  | 'WARN'
  | 'CRITICAL';

export type RunSignalAdapterNarrativeWeight =
  | 'AMBIENT'
  | 'TACTICAL'
  | 'RECOVERY'
  | 'CEREMONIAL'
  | 'COLLAPSE';

export interface RunEconomyCompat {
  readonly cash?: number | null;
  readonly debt?: number | null;
  readonly incomePerTick?: number | null;
  readonly expensesPerTick?: number | null;
  readonly netWorth?: number | null;
  readonly freedomTarget?: number | null;
  readonly haterHeat?: number | null;
  readonly opportunitiesPurchased?: number | null;
  readonly privilegePlays?: number | null;
}

export interface RunPressureCompat {
  readonly score?: number | null;
  readonly tier?: string | null;
  readonly band?: string | null;
  readonly previousTier?: string | null;
  readonly previousBand?: string | null;
  readonly upwardCrossings?: number | null;
}

export interface RunBattleCompat {
  readonly pendingAttacks?: readonly unknown[] | null;
  readonly rivalryHeatCarry?: number | null;
  readonly battleBudget?: number | null;
  readonly battleBudgetCap?: number | null;
  readonly extractionCooldownTicks?: number | null;
  readonly firstBloodClaimed?: boolean | null;
}

export interface RunShieldCompat {
  readonly weakestLayerRatio?: number | null;
  readonly integrityRatio?: number | null;
  readonly breachesThisRun?: number | null;
}

export interface RunSovereigntyCompat {
  readonly sovereigntyScore?: number | null;
  readonly verifiedGrade?: string | null;
  readonly proofHash?: string | null;
  readonly cordScore?: number | null;
}

export interface RunModeStateCompat {
  readonly communityHeatModifier?: number | null;
  readonly disabledBots?: readonly string[] | null;
  readonly sharedOpportunityDeck?: boolean | null;
}

export interface RunTelemetryCompat {
  readonly warnings?: readonly string[] | null;
}

export interface RunSnapshotCompat {
  readonly runId?: string | null;
  readonly userId?: string | null;
  readonly seed?: string | null;
  readonly mode?: string | null;
  readonly tick?: number | null;
  readonly phase?: string | null;
  readonly outcome?: string | null;
  readonly emittedAt?: number | null;
  readonly tags?: readonly string[] | null;
  readonly economy?: RunEconomyCompat | null;
  readonly pressure?: RunPressureCompat | null;
  readonly battle?: RunBattleCompat | null;
  readonly shield?: RunShieldCompat | null;
  readonly sovereignty?: RunSovereigntyCompat | null;
  readonly modeState?: RunModeStateCompat | null;
  readonly telemetry?: RunTelemetryCompat | null;
  readonly warnings?: readonly string[] | null;
}

export interface RunCreatedPayloadCompat {
  readonly runId?: string | null;
  readonly seed?: number | string | null;
  readonly createdAt?: number | null;
}

export interface TurnSubmittedPayloadCompat {
  readonly runId?: string | null;
  readonly turnIndex?: number | null;
  readonly decisionId?: string | null;
  readonly choiceId?: string | null;
  readonly submittedAt?: number | null;
  readonly sourceCardInstanceId?: string | null;
  readonly effects?: readonly Readonly<Record<string, JsonValue>>[] | null;
}

export interface RunFinalizedPayloadCompat {
  readonly runId?: string | null;
  readonly finalizedAt?: number | null;
  readonly replayHash?: string | null;
  readonly outcome?: string | null;
}

export interface RunSignalAdapterArtifact {
  readonly envelope: ChatInputEnvelope;
  readonly dedupeKey: string;
  readonly routeChannel: ChatVisibleChannel;
  readonly narrativeWeight: RunSignalAdapterNarrativeWeight;
  readonly severity: RunSignalAdapterSeverity;
  readonly eventName: string;
  readonly tickNumber: number;
  readonly pressure100: Score100;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface RunSignalAdapterRejection {
  readonly eventName: string;
  readonly reason: string;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface RunSignalAdapterHistoryEntry {
  readonly at: UnixMs;
  readonly eventName: string;
  readonly tickNumber: number;
  readonly routeChannel: ChatVisibleChannel;
  readonly narrativeWeight: RunSignalAdapterNarrativeWeight;
  readonly severity: RunSignalAdapterSeverity;
  readonly pressure100: Score100;
  readonly dedupeKey: string;
}

export interface RunSignalAdapterReport {
  readonly accepted: readonly RunSignalAdapterArtifact[];
  readonly deduped: readonly RunSignalAdapterArtifact[];
  readonly rejected: readonly RunSignalAdapterRejection[];
}

export interface RunSignalAdapterState {
  readonly history: readonly RunSignalAdapterHistoryEntry[];
  readonly acceptedCount: number;
  readonly dedupedCount: number;
  readonly rejectedCount: number;
  readonly lastPressure100: Score100;
  readonly lastTickNumber: number;
  /** Normalised pressure score 0–1 derived from the 0–100 pressure reading. */
  readonly lastPressureScore01: Score01;
}

/**
 * Breakdown of the normalized pressure score derivation.
 * Used by ML feature vectors to express run-health as a 0–1 signal.
 */
export interface RunPressureScoreBreakdown {
  /** Raw pressure on 0–100 scale. */
  readonly raw100: Score100;
  /** Normalised pressure on 0–1 scale (raw100 / 100, clamped). */
  readonly score01: Score01;
  /** Human-readable pressure tier label. */
  readonly pressureTier: 'SAFE' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  /** Whether bankruptcy warning threshold is crossed. */
  readonly nearBankruptcy: boolean;
}


interface RunEventDescriptor {
  readonly eventName: string;
  readonly defaultChannel: ChatVisibleChannel;
  readonly severity: RunSignalAdapterSeverity;
  readonly narrativeWeight: RunSignalAdapterNarrativeWeight;
  readonly quietBelowPressure100: number;
}

const RUN_EVENT_DESCRIPTOR_REGISTRY: Readonly<Record<string, RunEventDescriptor>> = Object.freeze({
  'run.created': {
    eventName: 'run.created',
    defaultChannel: 'LOBBY',
    severity: 'INFO',
    narrativeWeight: 'CEREMONIAL',
    quietBelowPressure100: 0,
  },
  'run.turn_submitted': {
    eventName: 'run.turn_submitted',
    defaultChannel: 'GLOBAL',
    severity: 'INFO',
    narrativeWeight: 'TACTICAL',
    quietBelowPressure100: 20,
  },
  'run.finalized': {
    eventName: 'run.finalized',
    defaultChannel: 'GLOBAL',
    severity: 'WARN',
    narrativeWeight: 'CEREMONIAL',
    quietBelowPressure100: 0,
  },
  'run.replayed': {
    eventName: 'run.replayed',
    defaultChannel: 'SYNDICATE',
    severity: 'DEBUG',
    narrativeWeight: 'AMBIENT',
    quietBelowPressure100: 0,
  },
  RUN_CREATED: {
    eventName: 'RUN_CREATED',
    defaultChannel: 'LOBBY',
    severity: 'INFO',
    narrativeWeight: 'CEREMONIAL',
    quietBelowPressure100: 0,
  },
  TURN_SUBMITTED: {
    eventName: 'TURN_SUBMITTED',
    defaultChannel: 'GLOBAL',
    severity: 'INFO',
    narrativeWeight: 'TACTICAL',
    quietBelowPressure100: 20,
  },
  RUN_FINALIZED: {
    eventName: 'RUN_FINALIZED',
    defaultChannel: 'GLOBAL',
    severity: 'WARN',
    narrativeWeight: 'CEREMONIAL',
    quietBelowPressure100: 0,
  },
});

const DEFAULT_RUN_SIGNAL_ADAPTER_OPTIONS = Object.freeze({
  defaultVisibleChannel: 'GLOBAL' as ChatVisibleChannel,
  dedupeWindowMs: 9_500,
  maxHistory: 256,
});

interface RunThresholdProfile {
  readonly bankruptcyWarningNetWorth: number;
  readonly bankruptcyTriggerNetWorth: number;
  readonly nearSovereigntyRatio01: number;
  readonly comebackAbsoluteGain: number;
  readonly comebackPercentGain01: number;
  readonly recoveryCashflowFloor: number;
  readonly drawdownWarnPercent01: number;
  /** Pressure score 0–1 threshold at which state is considered CRITICAL. */
  readonly pressureCriticalScore01: number;
  /** Pressure score 0–1 threshold at which state is considered HIGH. */
  readonly pressureHighScore01: number;
  /** Pressure score 0–1 threshold at which state is considered ELEVATED. */
  readonly pressureElevatedScore01: number;
}

const RUN_THRESHOLDS: RunThresholdProfile = Object.freeze({
  bankruptcyWarningNetWorth: 25_000,
  bankruptcyTriggerNetWorth: 0,
  nearSovereigntyRatio01: 0.88,
  comebackAbsoluteGain: 15_000,
  comebackPercentGain01: 0.30,
  recoveryCashflowFloor: 0,
  drawdownWarnPercent01: 0.18,
  pressureCriticalScore01: 0.85,
  pressureHighScore01: 0.65,
  pressureElevatedScore01: 0.42,
});

const OUTCOME_MAP: Readonly<Record<string, ChatRunSnapshot['outcome']>> = Object.freeze({
  UNRESOLVED: 'UNRESOLVED',
  FREEDOM: 'SOVEREIGN',
  SOVEREIGN: 'SOVEREIGN',
  SURVIVED: 'SURVIVED',
  FAILED: 'FAILED',
  TIMEOUT: 'FAILED',
  BANKRUPT: 'BANKRUPT',
  BANKRUPTCY: 'BANKRUPT',
  ABANDONED: 'WITHDRAWN',
  WITHDRAWN: 'WITHDRAWN',
});

const PHASE_TO_TICK_TIER: Readonly<Record<string, ChatRunSnapshot['tickTier']>> = Object.freeze({
  FOUNDATION: 'SETUP',
  ESCALATION: 'WINDOW',
  SOVEREIGNTY: 'SEAL',
});

const MODE_TO_CHANNEL: Readonly<Record<string, ChatVisibleChannel>> = Object.freeze({
  SOLO: 'GLOBAL',
  PVP: 'GLOBAL',
  COOP: 'SYNDICATE',
  GHOST: 'SYNDICATE',
});

const PRESSURE_BAND_TO_NUMERIC: Readonly<Record<string, number>> = Object.freeze({
  NONE: 0,
  CALM: 0,
  LOW: 20,
  BUILDING: 32,
  MEDIUM: 46,
  ELEVATED: 54,
  HIGH: 72,
  CRITICAL: 90,
  CATASTROPHIC: 96,
});


function defaultLogger(): RunSignalAdapterLogger {
  return {
    debug: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

function defaultClock(): RunSignalAdapterClock {
  return {
    now: () => asUnixMs(Date.now()),
  };
}

function asRoomId(value: ChatRoomId | string): ChatRoomId {
  return value as ChatRoomId;
}

function toFiniteNumber(value: unknown, fallback: number = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function upper(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function resolveOutcome(value: unknown): RunOutcome {
  const key = upper(value);
  return OUTCOME_MAP[key] ?? 'UNRESOLVED';
}

function resolveTickTier(value: unknown): TickTier {
  const key = upper(value);
  return PHASE_TO_TICK_TIER[key] ?? 'WINDOW';
}

function resolvePressure100(pressure: Nullable<RunPressureCompat | null | undefined>): Score100 {
  if (!pressure) return clamp100(0);
  const score = toFiniteNumber(pressure.score, NaN);
  if (Number.isFinite(score)) {
    return clamp100(score * 100);
  }
  const bandKey = upper(pressure.band ?? pressure.tier);
  const mapped = PRESSURE_BAND_TO_NUMERIC[bandKey];
  return clamp100(Number.isFinite(mapped) ? mapped : 0);
}

function resolvePressureTier(pressure100: Score100): ChatRunSnapshot['tickTier'] {
  if (pressure100 >= clamp100(88)) return 'SEAL';
  if (pressure100 >= clamp100(64)) return 'RESOLUTION';
  if (pressure100 >= clamp100(40)) return 'COMMIT';
  if (pressure100 >= clamp100(18)) return 'WINDOW';
  return 'SETUP';
}

function resolveVisibleChannel(
  explicit: Nullable<ChatVisibleChannel | undefined>,
  mode: unknown,
  fallback: ChatVisibleChannel,
): ChatVisibleChannel {
  if (explicit) return explicit;
  const key = upper(mode);
  return MODE_TO_CHANNEL[key] ?? fallback;
}

function estimateElapsedMs(tick: number, phase: string): number {
  const tier = resolveTickTier(phase);
  const perTick =
    tier === 'SETUP' ? 1000 :
    tier === 'WINDOW' ? 1400 :
    tier === 'COMMIT' ? 1100 :
    tier === 'RESOLUTION' ? 1500 :
    900;
  return Math.max(0, tick * perTick);
}

function computeCashflow(economy: Nullable<RunEconomyCompat | null | undefined>): number {
  if (!economy) return 0;
  return toFiniteNumber(economy.incomePerTick, 0) - toFiniteNumber(economy.expensesPerTick, 0);
}

function computeNearSovereignty(economy: Nullable<RunEconomyCompat | null | undefined>): boolean {
  if (!economy) return false;
  const freedomTarget = toFiniteNumber(economy.freedomTarget, 0);
  const netWorth = toFiniteNumber(economy.netWorth, 0);
  if (freedomTarget <= 0) return false;
  return netWorth / freedomTarget >= RUN_THRESHOLDS.nearSovereigntyRatio01;
}

function computeBankruptcyWarning(
  economy: Nullable<RunEconomyCompat | null | undefined>,
): boolean {
  if (!economy) return false;
  const netWorth = toFiniteNumber(economy.netWorth, 0);
  return netWorth <= RUN_THRESHOLDS.bankruptcyWarningNetWorth;
}

function computeRunPressureNarrativeWeight(
  outcome: ChatRunSnapshot['outcome'],
  nearSovereignty: boolean,
  bankruptcyWarning: boolean,
  pressure100: Score100,
): RunSignalAdapterNarrativeWeight {
  if (outcome === 'BANKRUPT' || outcome === 'FAILED') return 'COLLAPSE';
  if (outcome === 'SOVEREIGN' || nearSovereignty) return 'CEREMONIAL';
  if (bankruptcyWarning) return 'TACTICAL';
  if (pressure100 >= clamp100(68)) return 'TACTICAL';
  return 'AMBIENT';
}

function computeRunSeverity(
  outcome: ChatRunSnapshot['outcome'],
  narrativeWeight: RunSignalAdapterNarrativeWeight,
  pressure100: Score100,
): RunSignalAdapterSeverity {
  if (outcome === 'BANKRUPT') return 'CRITICAL';
  if (outcome === 'FAILED') return 'WARN';
  if (outcome === 'SOVEREIGN') return 'INFO';
  if (narrativeWeight === 'COLLAPSE' && pressure100 >= clamp100(75)) return 'CRITICAL';
  if (narrativeWeight === 'TACTICAL' && pressure100 >= clamp100(68)) return 'WARN';
  return 'INFO';
}

function stableKey(record: Readonly<Record<string, JsonValue>>): string {
  const keys = Object.keys(record).sort();
  return keys.map((key) => `${key}:${JSON.stringify(record[key])}`).join('|');
}

function buildMetadata(
  base: Readonly<Record<string, JsonValue>>,
  additions?: Readonly<Record<string, JsonValue>>,
): Readonly<Record<string, JsonValue>> {
  return Object.freeze({
    ...base,
    ...(additions ?? {}),
  });
}

function toJsonStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim());
}


export class RunSignalAdapter {
  private readonly logger: RunSignalAdapterLogger;
  private readonly clock: RunSignalAdapterClock;
  private readonly defaultRoomId: ChatRoomId;
  private readonly defaultVisibleChannel: ChatVisibleChannel;
  private readonly dedupeWindowMs: number;
  private readonly maxHistory: number;

  private readonly dedupeMap = new Map<string, UnixMs>();
  private readonly history: RunSignalAdapterHistoryEntry[] = [];
  private acceptedCount = 0;
  private dedupedCount = 0;
  private rejectedCount = 0;
  private lastPressure100: Score100 = clamp100(0);
  private lastTickNumber = 0;
  private lastPeakNetWorth = 0;
  private recoveryAnchorNetWorth = 0;

  public constructor(options: RunSignalAdapterOptions) {
    this.logger = options.logger ?? defaultLogger();
    this.clock = options.clock ?? defaultClock();
    this.defaultRoomId = asRoomId(options.defaultRoomId);
    this.defaultVisibleChannel =
      options.defaultVisibleChannel ??
      DEFAULT_RUN_SIGNAL_ADAPTER_OPTIONS.defaultVisibleChannel;
    this.dedupeWindowMs =
      options.dedupeWindowMs ??
      DEFAULT_RUN_SIGNAL_ADAPTER_OPTIONS.dedupeWindowMs;
    this.maxHistory =
      options.maxHistory ??
      DEFAULT_RUN_SIGNAL_ADAPTER_OPTIONS.maxHistory;
  }

  public reset(): void {
    this.dedupeMap.clear();
    this.history.length = 0;
    this.acceptedCount = 0;
    this.dedupedCount = 0;
    this.rejectedCount = 0;
    this.lastPressure100 = clamp100(0);
    this.lastTickNumber = 0;
    this.lastPeakNetWorth = 0;
    this.recoveryAnchorNetWorth = 0;
  }

  public getState(): RunSignalAdapterState {
    return Object.freeze({
      history: this.history.slice(),
      acceptedCount: this.acceptedCount,
      dedupedCount: this.dedupedCount,
      rejectedCount: this.rejectedCount,
      lastPressure100: this.lastPressure100,
      lastTickNumber: this.lastTickNumber,
      lastPressureScore01: this.computePressureScore01().score01,
    });
  }

  /**
   * Compute the normalised pressure score 0–1 from the current 0–100 reading.
   *
   * This is the authoritative run-health signal for ML feature vectors
   * and DL input tensors. It expresses run pressure as a 0–1 float so
   * downstream models work in a uniform feature space.
   *
   * Thresholds are sourced from `RUN_THRESHOLDS` (the project's authoritative
   * run threshold profile), which uses `Score01`-typed fields.
   *
   * @param overridePressure100 - optional override; uses `lastPressure100` if omitted
   * @param overrideNetWorth    - optional net worth for bankruptcy proximity check
   */
  public computePressureScore01(
    overridePressure100?: Score100,
    overrideNetWorth?: number,
  ): RunPressureScoreBreakdown {
    const raw100 = overridePressure100 ?? this.lastPressure100;
    const score01: Score01 = clamp01(Number(raw100) / 100);
    const nearBankruptcy = typeof overrideNetWorth === 'number'
      ? overrideNetWorth <= RUN_THRESHOLDS.bankruptcyWarningNetWorth
      : false;

    let pressureTier: RunPressureScoreBreakdown['pressureTier'];
    if (score01 >= RUN_THRESHOLDS.pressureCriticalScore01) pressureTier = 'CRITICAL';
    else if (score01 >= RUN_THRESHOLDS.pressureHighScore01) pressureTier = 'HIGH';
    else if (score01 >= RUN_THRESHOLDS.pressureElevatedScore01) pressureTier = 'ELEVATED';
    else pressureTier = 'SAFE';

    return Object.freeze({ raw100, score01, pressureTier, nearBankruptcy });
  }

  public adaptRuntimeEvent(
    eventName: RunSignalAdapterEventName,
    payload: unknown,
    context?: RunSignalAdapterContext,
  ): RunSignalAdapterReport {
    this.evictExpiredDedupe();
    const emittedAt = this.resolveEventTime(
      (payload as { readonly createdAt?: number; readonly submittedAt?: number; readonly finalizedAt?: number } | null | undefined)?.createdAt ??
        (payload as { readonly submittedAt?: number } | null | undefined)?.submittedAt ??
        (payload as { readonly finalizedAt?: number } | null | undefined)?.finalizedAt ??
        context?.emittedAt,
    );
    const roomId = this.resolveRoomId(context?.roomId);

    switch (eventName) {
      case 'run.created':
      case 'RUN_CREATED':
        return this.adaptRunCreated(
          eventName,
          payload as RunCreatedPayloadCompat,
          roomId,
          emittedAt,
          context,
        );
      case 'run.turn_submitted':
      case 'TURN_SUBMITTED':
        return this.adaptTurnSubmitted(
          eventName,
          payload as TurnSubmittedPayloadCompat,
          roomId,
          emittedAt,
          context,
        );
      case 'run.finalized':
      case 'RUN_FINALIZED':
        return this.adaptRunFinalized(
          eventName,
          payload as RunFinalizedPayloadCompat,
          roomId,
          emittedAt,
          context,
        );
      case 'run.replayed':
        return this.adaptRunReplayed(
          eventName,
          payload as RunFinalizedPayloadCompat,
          roomId,
          emittedAt,
          context,
        );
      default:
        this.rejectedCount += 1;
        return Object.freeze({
          accepted: [],
          deduped: [],
          rejected: [
            {
              eventName,
              reason: 'UNSUPPORTED_RUN_EVENT',
              details: buildMetadata({ eventName }, context?.metadata),
            },
          ],
        });
    }
  }

  public adaptSnapshot(
    snapshot: RunSnapshotCompat,
    context?: RunSignalAdapterContext,
  ): RunSignalAdapterReport {
    this.evictExpiredDedupe();

    const emittedAt = this.resolveEventTime(snapshot.emittedAt ?? context?.emittedAt);
    const roomId = this.resolveRoomId(context?.roomId);
    const tickNumber = Math.max(0, Math.floor(snapshot.tick ?? 0));
    const economy = snapshot.economy ?? null;
    const pressure = snapshot.pressure ?? null;
    const battle = snapshot.battle ?? null;
    const shield = snapshot.shield ?? null;
    const sovereignty = snapshot.sovereignty ?? null;
    const warnings = [
      ...toJsonStringArray(snapshot.warnings),
      ...toJsonStringArray(snapshot.telemetry?.warnings),
    ];

    const pressure100 = resolvePressure100(pressure);
    this.lastPressure100 = pressure100;
    this.lastTickNumber = tickNumber;

    const outcome = resolveOutcome(snapshot.outcome);
    const runPhase = typeof snapshot.phase === 'string' && snapshot.phase.trim().length > 0
      ? snapshot.phase.trim()
      : 'ESCALATION';
    const cashflow = computeCashflow(economy);
    const bankruptcyWarning = computeBankruptcyWarning(economy);
    const nearSovereignty = computeNearSovereignty(economy);
    const elapsedMs = estimateElapsedMs(tickNumber, runPhase);

    const runSnapshot: ChatRunSnapshot = Object.freeze({
      runId: snapshot.runId ?? 'unknown_run',
      runPhase,
      tickTier: resolveTickTier(runPhase),
      outcome,
      bankruptcyWarning,
      nearSovereignty,
      elapsedMs,
    });

    const netWorth = toFiniteNumber(economy?.netWorth, 0);
    if (netWorth > this.lastPeakNetWorth) {
      this.lastPeakNetWorth = netWorth;
    }
    if (this.recoveryAnchorNetWorth === 0 || bankruptcyWarning) {
      this.recoveryAnchorNetWorth = netWorth;
    }

    const narrativeWeight = computeRunPressureNarrativeWeight(
      outcome,
      nearSovereignty,
      bankruptcyWarning,
      pressure100,
    );
    const severity = computeRunSeverity(outcome, narrativeWeight, pressure100);
    const routeChannel = resolveVisibleChannel(
      context?.routeChannel ?? null,
      snapshot.mode,
      bankruptcyWarning || nearSovereignty ? 'GLOBAL' : this.defaultVisibleChannel,
    );

    const metadata = buildMetadata(
      {
        source: context?.source ?? 'RunSignalAdapter.snapshot',
        mode: snapshot.mode ?? null,
        phase: runPhase,
        tickNumber,
        outcome,
        tags: toJsonStringArray(snapshot.tags).join('|'),
        netWorth,
        debt: toFiniteNumber(economy?.debt, 0),
        cash: toFiniteNumber(economy?.cash, 0),
        incomePerTick: toFiniteNumber(economy?.incomePerTick, 0),
        expensesPerTick: toFiniteNumber(economy?.expensesPerTick, 0),
        cashflow,
        freedomTarget: toFiniteNumber(economy?.freedomTarget, 0),
        haterHeat: toFiniteNumber(economy?.haterHeat, 0),
        opportunitiesPurchased: toFiniteNumber(economy?.opportunitiesPurchased, 0),
        privilegePlays: toFiniteNumber(economy?.privilegePlays, 0),
        pressureScore01: clamp01(toFiniteNumber(pressure?.score, Number(pressure100) / 100)),
        pressureTier: upper(pressure?.tier) || null,
        pressureBand: upper(pressure?.band) || null,
        pendingAttackCount: Array.isArray(battle?.pendingAttacks) ? battle!.pendingAttacks!.length : 0,
        rivalryHeatCarry: toFiniteNumber(battle?.rivalryHeatCarry, 0),
        battleBudget: toFiniteNumber(battle?.battleBudget, 0),
        battleBudgetCap: toFiniteNumber(battle?.battleBudgetCap, 0),
        extractionCooldownTicks: toFiniteNumber(battle?.extractionCooldownTicks, 0),
        firstBloodClaimed: Boolean(battle?.firstBloodClaimed),
        weakestLayerRatio: clamp01(
          toFiniteNumber(shield?.weakestLayerRatio, shield?.integrityRatio ?? 1),
        ),
        integrityRatio: clamp01(toFiniteNumber(shield?.integrityRatio, 1)),
        breachesThisRun: toFiniteNumber(shield?.breachesThisRun, 0),
        sovereigntyScore: toFiniteNumber(sovereignty?.sovereigntyScore, 0),
        verifiedGrade: sovereignty?.verifiedGrade ?? null,
        proofHash: sovereignty?.proofHash ?? null,
        cordScore: toFiniteNumber(sovereignty?.cordScore, 0),
        warningSummary: warnings.join(' | '),
        routeChannel,
      },
      context?.metadata,
    );

    const artifact = this.buildArtifact({
      eventName: 'run.snapshot',
      roomId,
      emittedAt,
      tickNumber,
      routeChannel,
      narrativeWeight,
      severity,
      pressure100,
      signal: Object.freeze({
        type: 'RUN',
        emittedAt,
        roomId,
        run: runSnapshot,
        metadata,
      }),
      details: metadata,
    });

    return this.acceptOrDedupe(artifact);
  }

  public adaptBatch(
    entries: readonly {
      readonly eventName: RunSignalAdapterEventName;
      readonly payload: unknown;
      readonly context?: RunSignalAdapterContext;
    }[],
  ): RunSignalAdapterReport {
    const accepted: RunSignalAdapterArtifact[] = [];
    const deduped: RunSignalAdapterArtifact[] = [];
    const rejected: RunSignalAdapterRejection[] = [];

    for (const entry of entries) {
      const report = this.adaptRuntimeEvent(entry.eventName, entry.payload, entry.context);
      accepted.push(...report.accepted);
      deduped.push(...report.deduped);
      rejected.push(...report.rejected);
    }

    return Object.freeze({
      accepted,
      deduped,
      rejected,
    });
  }

  private adaptRunCreated(
    eventName: string,
    payload: RunCreatedPayloadCompat,
    roomId: ChatRoomId,
    emittedAt: UnixMs,
    context?: RunSignalAdapterContext,
  ): RunSignalAdapterReport {
    const runId = typeof payload.runId === 'string' && payload.runId.trim().length > 0
      ? payload.runId.trim()
      : null;
    if (!runId) {
      this.rejectedCount += 1;
      return {
        accepted: [],
        deduped: [],
        rejected: [
          {
            eventName,
            reason: 'RUN_ID_REQUIRED',
            details: buildMetadata({ eventName }, context?.metadata),
          },
        ],
      };
    }

    const runSnapshot: ChatRunSnapshot = Object.freeze({
      runId,
      runPhase: 'FOUNDATION',
      tickTier: 'SETUP',
      outcome: 'UNRESOLVED',
      bankruptcyWarning: false,
      nearSovereignty: false,
      elapsedMs: 0,
    });

    const signal: ChatSignalEnvelope = Object.freeze({
      type: 'RUN',
      emittedAt,
      roomId,
      run: runSnapshot,
      metadata: buildMetadata(
        {
          source: context?.source ?? 'RunSignalAdapter.run_created',
          runId,
          seed: payload.seed ?? null,
          createdAt: payload.createdAt ?? Number(emittedAt),
          routeChannel: 'LOBBY',
        },
        context?.metadata,
      ),
    });

    const artifact = this.buildArtifact({
      eventName,
      roomId,
      emittedAt,
      tickNumber: 0,
      routeChannel: 'LOBBY',
      narrativeWeight: 'CEREMONIAL',
      severity: 'INFO',
      pressure100: clamp100(0),
      signal,
      details: signal.metadata ?? {},
    });

    return this.acceptOrDedupe(artifact);
  }

  private adaptTurnSubmitted(
    eventName: string,
    payload: TurnSubmittedPayloadCompat,
    roomId: ChatRoomId,
    emittedAt: UnixMs,
    context?: RunSignalAdapterContext,
  ): RunSignalAdapterReport {
    const runId = typeof payload.runId === 'string' && payload.runId.trim().length > 0
      ? payload.runId.trim()
      : null;
    if (!runId) {
      this.rejectedCount += 1;
      return {
        accepted: [],
        deduped: [],
        rejected: [
          {
            eventName,
            reason: 'RUN_ID_REQUIRED',
            details: buildMetadata({ eventName }, context?.metadata),
          },
        ],
      };
    }

    const tickNumber = Math.max(0, Math.floor(payload.turnIndex ?? 0));
    const effectCount = Array.isArray(payload.effects) ? payload.effects.length : 0;
    const pressure100 = clamp100(Math.max(this.lastPressure100, 20 + effectCount * 5));
    const runSnapshot: ChatRunSnapshot = Object.freeze({
      runId,
      runPhase: 'ESCALATION',
      tickTier: resolvePressureTier(pressure100),
      outcome: 'UNRESOLVED',
      bankruptcyWarning: false,
      nearSovereignty: false,
      elapsedMs: estimateElapsedMs(tickNumber, 'ESCALATION'),
    });

    const signal: ChatSignalEnvelope = Object.freeze({
      type: 'RUN',
      emittedAt,
      roomId,
      run: runSnapshot,
      metadata: buildMetadata(
        {
          source: context?.source ?? 'RunSignalAdapter.turn_submitted',
          runId,
          turnIndex: tickNumber,
          decisionId: payload.decisionId ?? null,
          choiceId: payload.choiceId ?? null,
          sourceCardInstanceId: payload.sourceCardInstanceId ?? null,
          effectCount,
          routeChannel: 'GLOBAL',
        },
        context?.metadata,
      ),
    });

    const artifact = this.buildArtifact({
      eventName,
      roomId,
      emittedAt,
      tickNumber,
      routeChannel: 'GLOBAL',
      narrativeWeight: pressure100 >= clamp100(68) ? 'TACTICAL' : 'AMBIENT',
      severity: pressure100 >= clamp100(68) ? 'WARN' : 'INFO',
      pressure100,
      signal,
      details: signal.metadata ?? {},
    });

    return this.acceptOrDedupe(artifact);
  }

  private adaptRunFinalized(
    eventName: string,
    payload: RunFinalizedPayloadCompat,
    roomId: ChatRoomId,
    emittedAt: UnixMs,
    context?: RunSignalAdapterContext,
  ): RunSignalAdapterReport {
    const runId = typeof payload.runId === 'string' && payload.runId.trim().length > 0
      ? payload.runId.trim()
      : null;
    if (!runId) {
      this.rejectedCount += 1;
      return {
        accepted: [],
        deduped: [],
        rejected: [
          {
            eventName,
            reason: 'RUN_ID_REQUIRED',
            details: buildMetadata({ eventName }, context?.metadata),
          },
        ],
      };
    }

    const outcome = resolveOutcome(payload.outcome);
    const pressure100 =
      outcome === 'BANKRUPT'
        ? clamp100(100)
        : outcome === 'SOVEREIGN'
          ? clamp100(38)
          : clamp100(Math.max(this.lastPressure100, 52));

    const runSnapshot: ChatRunSnapshot = Object.freeze({
      runId,
      runPhase: outcome === 'SOVEREIGN' ? 'SOVEREIGNTY' : 'ESCALATION',
      tickTier: outcome === 'SOVEREIGN' ? 'SEAL' : 'RESOLUTION',
      outcome,
      bankruptcyWarning: outcome === 'BANKRUPT',
      nearSovereignty: outcome === 'SOVEREIGN',
      elapsedMs: Math.max(0, Math.floor((payload.finalizedAt ?? Number(emittedAt)) - Number(emittedAt))),
    });

    const signal: ChatSignalEnvelope = Object.freeze({
      type: 'RUN',
      emittedAt,
      roomId,
      run: runSnapshot,
      metadata: buildMetadata(
        {
          source: context?.source ?? 'RunSignalAdapter.run_finalized',
          runId,
          finalizedAt: payload.finalizedAt ?? null,
          replayHash: payload.replayHash ?? null,
          outcome,
          routeChannel: outcome === 'BANKRUPT' ? 'GLOBAL' : 'SYNDICATE',
        },
        context?.metadata,
      ),
    });

    const narrativeWeight =
      outcome === 'BANKRUPT'
        ? 'COLLAPSE'
        : outcome === 'SOVEREIGN'
          ? 'CEREMONIAL'
          : 'TACTICAL';

    const severity =
      outcome === 'BANKRUPT'
        ? 'CRITICAL'
        : outcome === 'SOVEREIGN'
          ? 'INFO'
          : 'WARN';

    const artifact = this.buildArtifact({
      eventName,
      roomId,
      emittedAt,
      tickNumber: this.lastTickNumber,
      routeChannel: outcome === 'BANKRUPT' ? 'GLOBAL' : 'SYNDICATE',
      narrativeWeight,
      severity,
      pressure100,
      signal,
      details: signal.metadata ?? {},
    });

    return this.acceptOrDedupe(artifact);
  }

  private adaptRunReplayed(
    eventName: string,
    payload: RunFinalizedPayloadCompat,
    roomId: ChatRoomId,
    emittedAt: UnixMs,
    context?: RunSignalAdapterContext,
  ): RunSignalAdapterReport {
    const runId = typeof payload.runId === 'string' && payload.runId.trim().length > 0
      ? payload.runId.trim()
      : null;
    if (!runId) {
      this.rejectedCount += 1;
      return {
        accepted: [],
        deduped: [],
        rejected: [
          {
            eventName,
            reason: 'RUN_ID_REQUIRED',
            details: buildMetadata({ eventName }, context?.metadata),
          },
        ],
      };
    }

    const runSnapshot: ChatRunSnapshot = Object.freeze({
      runId,
      runPhase: 'ESCALATION',
      tickTier: 'RESOLUTION',
      outcome: 'UNRESOLVED',
      bankruptcyWarning: false,
      nearSovereignty: false,
      elapsedMs: 0,
    });

    const signal: ChatSignalEnvelope = Object.freeze({
      type: 'RUN',
      emittedAt,
      roomId,
      run: runSnapshot,
      metadata: buildMetadata(
        {
          source: context?.source ?? 'RunSignalAdapter.run_replayed',
          runId,
          replayHash: payload.replayHash ?? null,
          routeChannel: 'SYNDICATE',
        },
        context?.metadata,
      ),
    });

    const artifact = this.buildArtifact({
      eventName,
      roomId,
      emittedAt,
      tickNumber: this.lastTickNumber,
      routeChannel: 'SYNDICATE',
      narrativeWeight: 'AMBIENT',
      severity: 'DEBUG',
      pressure100: clamp100(12),
      signal,
      details: signal.metadata ?? {},
    });

    return this.acceptOrDedupe(artifact);
  }

  private buildArtifact(args: {
    readonly eventName: string;
    readonly roomId: ChatRoomId;
    readonly emittedAt: UnixMs;
    readonly tickNumber: number;
    readonly routeChannel: ChatVisibleChannel;
    readonly narrativeWeight: RunSignalAdapterNarrativeWeight;
    readonly severity: RunSignalAdapterSeverity;
    readonly pressure100: Score100;
    readonly signal: ChatSignalEnvelope;
    readonly details: Readonly<Record<string, JsonValue>>;
  }): RunSignalAdapterArtifact {
    const dedupeKey = stableKey({
      eventName: args.eventName,
      roomId: args.roomId,
      routeChannel: args.routeChannel,
      tickNumber: args.tickNumber,
      pressure100: Number(args.pressure100),
      runId: args.signal.run?.runId ?? '',
      outcome: args.signal.run?.outcome ?? '',
      phase: args.signal.run?.runPhase ?? '',
    });

    const envelope: ChatInputEnvelope = Object.freeze({
      kind: 'RUN_SIGNAL',
      emittedAt: args.emittedAt,
      payload: args.signal,
    });

    return Object.freeze({
      envelope,
      dedupeKey,
      routeChannel: args.routeChannel,
      narrativeWeight: args.narrativeWeight,
      severity: args.severity,
      eventName: args.eventName,
      tickNumber: args.tickNumber,
      pressure100: args.pressure100,
      details: args.details,
    });
  }

  private acceptOrDedupe(artifact: RunSignalAdapterArtifact): RunSignalAdapterReport {
    const lastAcceptedAt = this.dedupeMap.get(artifact.dedupeKey) ?? null;
    const eventNow = artifact.envelope.emittedAt;
    if (
      lastAcceptedAt !== null &&
      Number(eventNow) - Number(lastAcceptedAt) < this.dedupeWindowMs
    ) {
      this.dedupedCount += 1;
      this.logger.debug('RunSignalAdapter deduped artifact.', {
        eventName: artifact.eventName,
        dedupeKey: artifact.dedupeKey,
      });
      return Object.freeze({
        accepted: [],
        deduped: [artifact],
        rejected: [],
      });
    }

    const descriptor = RUN_EVENT_DESCRIPTOR_REGISTRY[artifact.eventName];
    if (
      descriptor &&
      Number(artifact.pressure100) < descriptor.quietBelowPressure100 &&
      descriptor.quietBelowPressure100 > 0
    ) {
      this.dedupedCount += 1;
      return Object.freeze({
        accepted: [],
        deduped: [artifact],
        rejected: [],
      });
    }

    this.dedupeMap.set(artifact.dedupeKey, eventNow);
    this.acceptedCount += 1;
    this.lastPressure100 = artifact.pressure100;
    this.lastTickNumber = artifact.tickNumber;
    this.recordHistory(artifact);

    return Object.freeze({
      accepted: [artifact],
      deduped: [],
      rejected: [],
    });
  }

  private recordHistory(artifact: RunSignalAdapterArtifact): void {
    this.history.push(
      Object.freeze({
        at: artifact.envelope.emittedAt,
        eventName: artifact.eventName,
        tickNumber: artifact.tickNumber,
        routeChannel: artifact.routeChannel,
        narrativeWeight: artifact.narrativeWeight,
        severity: artifact.severity,
        pressure100: artifact.pressure100,
        dedupeKey: artifact.dedupeKey,
      }),
    );

    while (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  private resolveRoomId(value: Nullable<ChatRoomId | string | null | undefined>): ChatRoomId {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim() as ChatRoomId;
    }
    return this.defaultRoomId;
  }

  private resolveEventTime(value: unknown): UnixMs {
    const numeric =
      typeof value === 'number' && Number.isFinite(value)
        ? value
        : Number(this.clock.now());
    return asUnixMs(numeric);
  }

  private evictExpiredDedupe(): void {
    const now = this.clock.now();
    for (const [key, at] of this.dedupeMap.entries()) {
      if (Number(now) - Number(at) >= this.dedupeWindowMs * 3) {
        this.dedupeMap.delete(key);
      }
    }
  }
}
