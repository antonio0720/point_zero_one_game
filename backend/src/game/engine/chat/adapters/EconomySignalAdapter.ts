/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT ECONOMY SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/EconomySignalAdapter.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend adapter that translates economy-lane truth, deal-room
 * truth, liquidity stress, overpay risk, bluff risk, and hater-heat-linked
 * market pressure into authoritative backend chat economy signals.
 *
 * Backend-truth question
 * ----------------------
 *   "When an offer opens, deal pressure spikes, liquidity tightens, bluff risk
 *    rises, or the market turns predatory, what exact economy-native chat
 *    signal should the authoritative backend chat engine ingest?"
 *
 * Repo truths preserved
 * ---------------------
 * - backend/src/game/engine and run-state doctrine already treat economy,
 *   pressure, battle heat, and mode-state as authoritative runtime truth.
 * - pzo-web chat donor logic already distinguishes DEAL_ROOM from GLOBAL and
 *   treats negotiation atmosphere as a first-class social surface.
 * - pzo-server multiplayer contracts already prove assist / sabotage can live
 *   beside market-facing social state without letting sockets become truth.
 * - The backend chat lane owns transcript truth, but not the economy itself.
 *
 * Therefore this file owns:
 * - economy payload compatibility and migration shielding,
 * - offer / negotiation / liquidity / bluff normalization,
 * - deal-room route recommendation,
 * - liquidity-stress, overpay-risk, and bluff-risk derivation,
 * - dedupe and saturation control,
 * - explainable adapter diagnostics,
 * - and batch translation into ChatInputEnvelope values.
 *
 * It does not own:
 * - transcript mutation,
 * - moderation,
 * - rate law,
 * - socket fanout,
 * - deal settlement,
 * - or final helper/hater speech selection.
 *
 * Design laws
 * -----------
 * - Preserve deal-room and economy words. Do not genericize them.
 * - Not every market delta deserves a visible witness.
 * - Liquidity stress is social pressure when it changes behavior.
 * - Bluff risk can escalate helper/hater timing without becoming text by itself.
 * - Overpay risk belongs in deal-room truth before it becomes player regret.
 * - The adapter may describe market pressure; orchestrators still decide speech.
 * ============================================================================
 */

import {
  asUnixMs,
  clamp01,
  clamp100,
  type ChatEconomySnapshot,
  type ChatInputEnvelope,
  type ChatRoomId,
  type ChatSignalEnvelope,
  type ChatVisibleChannel,
  type JsonValue,
  type Nullable,
  type Score01,
  type Score100,
  type UnixMs,
} from '../types';

// ============================================================================
// MARK: Logger, clock, options, and context
// ============================================================================

export interface EconomySignalAdapterLogger {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface EconomySignalAdapterClock {
  now(): UnixMs;
}

export interface EconomySignalAdapterOptions {
  readonly defaultRoomId: ChatRoomId | string;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  readonly dedupeWindowMs?: number;
  readonly maxHistory?: number;
  readonly includeShadowMetadata?: boolean;
  readonly highLiquidityStressThreshold?: number;
  readonly dealPressureEscalationThreshold?: number;
  readonly logger?: EconomySignalAdapterLogger;
  readonly clock?: EconomySignalAdapterClock;
}

export interface EconomySignalAdapterContext {
  readonly roomId?: ChatRoomId | string | null;
  readonly routeChannel?: ChatVisibleChannel;
  readonly emittedAt?: number;
  readonly source?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export type EconomySignalAdapterSeverity =
  | 'DEBUG'
  | 'INFO'
  | 'WARN'
  | 'CRITICAL';

export type EconomySignalAdapterNarrativeWeight =
  | 'AMBIENT'
  | 'TACTICAL'
  | 'PREDATORY'
  | 'NEGOTIATION'
  | 'RESCUE';

export type EconomySignalAdapterEventName =
  | 'economy.offer.opened'
  | 'economy.offer.updated'
  | 'economy.offer.accepted'
  | 'economy.offer.rejected'
  | 'economy.offer.cancelled'
  | 'economy.deal.snapshot'
  | 'economy.liquidity.updated'
  | 'economy.risk.updated'
  | 'economy.market.sentiment'
  | 'economy.hater_heat.updated'
  | 'OFFER_OPENED'
  | 'OFFER_UPDATED'
  | 'OFFER_ACCEPTED'
  | 'OFFER_REJECTED'
  | 'OFFER_CANCELLED'
  | 'DEAL_SNAPSHOT'
  | 'LIQUIDITY_UPDATED'
  | 'RISK_UPDATED'
  | 'MARKET_SENTIMENT'
  | 'HATER_HEAT_UPDATED'
  | string;

// ============================================================================
// MARK: Compatibility surfaces
// ============================================================================

export type EconomyOfferStatusCompat =
  | 'OPEN'
  | 'COUNTERED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED'
  | string;

export type EconomyOfferSideCompat =
  | 'BUY'
  | 'SELL'
  | 'BID'
  | 'ASK'
  | string;

export interface EconomyParticipantCompat {
  readonly playerId?: string | null;
  readonly username?: string | null;
  readonly factionName?: string | null;
  readonly trustScore?: number | null;
  readonly reputation?: number | null;
}

export interface EconomyOfferCompat {
  readonly offerId?: string | null;
  readonly roomId?: string | null;
  readonly channel?: string | null;
  readonly assetId?: string | null;
  readonly assetLabel?: string | null;
  readonly side?: EconomyOfferSideCompat | null;
  readonly status?: EconomyOfferStatusCompat | null;
  readonly price?: number | null;
  readonly quantity?: number | null;
  readonly estimatedValue?: number | null;
  readonly urgency01?: number | null;
  readonly bluffRisk01?: number | null;
  readonly overpayRisk01?: number | null;
  readonly liquidityStress01?: number | null;
  readonly initiator?: EconomyParticipantCompat | null;
  readonly counterparty?: EconomyParticipantCompat | null;
  readonly createdAt?: number | null;
  readonly updatedAt?: number | null;
  readonly expiresAt?: number | null;
  readonly metadata?: Readonly<Record<string, JsonValue>> | null;
}

export interface EconomyDealSnapshotCompat {
  readonly roomId?: string | null;
  readonly activeDealCount?: number | null;
  readonly liquidityStress01?: number | null;
  readonly overpayRisk01?: number | null;
  readonly bluffRisk01?: number | null;
  readonly haterHeat?: number | null;
  readonly marketSentiment?: number | null;
  readonly recentOffers?: readonly EconomyOfferCompat[] | null;
  readonly mode?: string | null;
  readonly emittedAt?: number | null;
  readonly metadata?: Readonly<Record<string, JsonValue>> | null;
}

export interface EconomyOfferPayloadCompat {
  readonly offer?: EconomyOfferCompat | null;
  readonly snapshot?: EconomyDealSnapshotCompat | null;
}

export interface EconomyLiquidityPayloadCompat {
  readonly roomId?: string | null;
  readonly liquidityStress01?: number | null;
  readonly activeDealCount?: number | null;
  readonly marketSentiment?: number | null;
  readonly haterHeat?: number | null;
  readonly snapshot?: EconomyDealSnapshotCompat | null;
}

export interface EconomyRiskPayloadCompat {
  readonly roomId?: string | null;
  readonly bluffRisk01?: number | null;
  readonly overpayRisk01?: number | null;
  readonly liquidityStress01?: number | null;
  readonly activeDealCount?: number | null;
  readonly snapshot?: EconomyDealSnapshotCompat | null;
}

export interface EconomyHeatPayloadCompat {
  readonly roomId?: string | null;
  readonly haterHeat?: number | null;
  readonly marketSentiment?: number | null;
  readonly snapshot?: EconomyDealSnapshotCompat | null;
}

// ============================================================================
// MARK: Accepted, deduped, rejected, history, state, and report
// ============================================================================

export interface EconomySignalAdapterAccepted {
  readonly dedupeKey: string;
  readonly eventName: EconomySignalAdapterEventName;
  readonly severity: EconomySignalAdapterSeverity;
  readonly narrativeWeight: EconomySignalAdapterNarrativeWeight;
  readonly routeChannel: ChatVisibleChannel;
  readonly envelope: ChatInputEnvelope;
  readonly signal: ChatSignalEnvelope;
  readonly snapshot: ChatEconomySnapshot;
  readonly diagnostics: Readonly<Record<string, JsonValue>>;
}

export interface EconomySignalAdapterDeduped {
  readonly dedupeKey: string;
  readonly eventName: EconomySignalAdapterEventName;
  readonly reason: string;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface EconomySignalAdapterRejected {
  readonly eventName: EconomySignalAdapterEventName;
  readonly reason: string;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface EconomySignalAdapterHistoryEntry {
  readonly id: string;
  readonly ts: UnixMs;
  readonly roomId: ChatRoomId;
  readonly eventName: EconomySignalAdapterEventName;
  readonly routeChannel: ChatVisibleChannel;
  readonly severity: EconomySignalAdapterSeverity;
  readonly narrativeWeight: EconomySignalAdapterNarrativeWeight;
  readonly activeDealCount: number;
  readonly liquidityStress01: Score01;
  readonly overpayRisk01: Score01;
  readonly bluffRisk01: Score01;
  readonly dedupeKey: string;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface EconomySignalAdapterState {
  readonly history: readonly EconomySignalAdapterHistoryEntry[];
  readonly acceptedCount: number;
  readonly dedupedCount: number;
  readonly rejectedCount: number;
  readonly lastLiquidityStress01: Score01;
  readonly lastDealCount: number;
  /** Aggregate market pressure on the 0–100 scale. Derived from liquidity stress and deal count. */
  readonly marketPressure100: Score100;
}

/**
 * Breakdown of the composite market pressure computation.
 * Useful for explainability overlays and deal-room diagnostics.
 */
export interface EconomyMarketPressureBreakdown {
  /** Liquidity stress contribution (0–50 range) mapped to 0–100. */
  readonly liquidityComponent100: Score100;
  /** Active deal count contribution (0–30 range) mapped to 0–100. */
  readonly dealCountComponent100: Score100;
  /** Hater heat contribution (0–20 range) mapped to 0–100. */
  readonly haterHeatComponent100: Score100;
  /** Composite total, clamped to 0–100. */
  readonly total100: Score100;
  /** Human-readable pressure tier label. */
  readonly pressureLabel: 'CALM' | 'BUILDING' | 'ELEVATED' | 'CRITICAL';
}

export interface EconomySignalAdapterReport {
  readonly accepted: readonly EconomySignalAdapterAccepted[];
  readonly deduped: readonly EconomySignalAdapterDeduped[];
  readonly rejected: readonly EconomySignalAdapterRejected[];
}

// ============================================================================
// MARK: Defaults and constants
// ============================================================================

const DEFAULT_ECONOMY_SIGNAL_ADAPTER_OPTIONS = Object.freeze({
  defaultVisibleChannel: 'DEAL_ROOM' as ChatVisibleChannel,
  dedupeWindowMs: 2_250,
  maxHistory: 256,
  includeShadowMetadata: true,
  highLiquidityStressThreshold: 0.72,
  dealPressureEscalationThreshold: 7,
});

const CHANNEL_PRIORITY: Record<ChatVisibleChannel, number> = Object.freeze({
  GLOBAL: 4,
  SYNDICATE: 3,
  DEAL_ROOM: 2,
  LOBBY: 1,
});

// ============================================================================
// MARK: Helpers
// ============================================================================

function defaultClock(): EconomySignalAdapterClock {
  return {
    now: () => asUnixMs(Date.now()),
  };
}

function defaultLogger(): EconomySignalAdapterLogger {
  return {
    debug: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asRoomId(value: ChatRoomId | string): ChatRoomId {
  return String(value) as ChatRoomId;
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

function stableKey(record: Readonly<Record<string, JsonValue>>): string {
  const keys = Object.keys(record).sort();
  return keys.map((key) => `${key}:${JSON.stringify(record[key])}`).join('|');
}

function score01(value: unknown, fallback = 0): Score01 {
  return clamp01(toFiniteNumber(value, fallback));
}

/**
 * Clamp an arbitrary numeric value into the 0–100 range using `clamp100`.
 * Mirrors `score01` but for the 0–100 pressure surface.
 *
 * @param value   - raw number (may be NaN, Infinity, or undefined)
 * @param fallback - value to use when `value` is not finite (default 0)
 */
function score100(value: unknown, fallback = 0): Score100 {
  return clamp100(toFiniteNumber(value, fallback));
}

function resolveVisibleChannel(
  preferred: Nullable<ChatVisibleChannel>,
  fallback: ChatVisibleChannel,
  offerStatus: Nullable<string>,
  dealCount: number,
  stress01: Score01,
): ChatVisibleChannel {
  if (preferred) return preferred;
  const statusUpper = offerStatus?.toUpperCase() ?? null;
  if (statusUpper === 'ACCEPTED' || statusUpper === 'REJECTED' || statusUpper === 'COUNTERED') {
    return 'DEAL_ROOM';
  }
  if (dealCount >= 10 || stress01 >= clamp01(0.85)) {
    return 'GLOBAL';
  }
  return fallback;
}

function resolveSeverity(args: {
  readonly activeDealCount: number;
  readonly liquidityStress01: Score01;
  readonly overpayRisk01: Score01;
  readonly bluffRisk01: Score01;
  readonly offerStatus: Nullable<string>;
}): EconomySignalAdapterSeverity {
  const statusUpper = args.offerStatus?.toUpperCase() ?? null;
  if (
    statusUpper === 'ACCEPTED' &&
    (args.overpayRisk01 >= clamp01(0.8) || args.bluffRisk01 >= clamp01(0.8))
  ) {
    return 'CRITICAL';
  }
  if (args.liquidityStress01 >= clamp01(0.85)) return 'CRITICAL';
  if (args.overpayRisk01 >= clamp01(0.7) || args.bluffRisk01 >= clamp01(0.7)) return 'WARN';
  if (args.activeDealCount >= 8 || statusUpper === 'COUNTERED') return 'INFO';
  return 'DEBUG';
}

function resolveNarrativeWeight(args: {
  readonly routeChannel: ChatVisibleChannel;
  readonly severity: EconomySignalAdapterSeverity;
  readonly bluffRisk01: Score01;
  readonly overpayRisk01: Score01;
  readonly liquidityStress01: Score01;
  readonly offerStatus: Nullable<string>;
}): EconomySignalAdapterNarrativeWeight {
  const statusUpper = args.offerStatus?.toUpperCase() ?? null;
  if (statusUpper === 'ACCEPTED' && args.overpayRisk01 >= clamp01(0.75)) return 'RESCUE';
  if (statusUpper === 'COUNTERED' || args.routeChannel === 'DEAL_ROOM') return 'NEGOTIATION';
  if (args.bluffRisk01 >= clamp01(0.72) || args.overpayRisk01 >= clamp01(0.72)) return 'PREDATORY';
  if (args.liquidityStress01 >= clamp01(0.55) || args.severity === 'WARN') return 'TACTICAL';
  return 'AMBIENT';
}

function computeDealCount(
  explicit: number | null | undefined,
  recentOffers: readonly EconomyOfferCompat[],
): number {
  const direct = Math.max(0, Math.floor(toFiniteNumber(explicit, NaN)));
  if (Number.isFinite(direct) && direct > 0) return direct;
  return recentOffers.filter((offer) => {
    const statusUpper = toOptionalString(offer.status)?.toUpperCase() ?? 'OPEN';
    return statusUpper === 'OPEN' || statusUpper === 'COUNTERED';
  }).length;
}

function estimateLiquidityStress01(args: {
  readonly explicit: number | null | undefined;
  readonly activeDealCount: number;
  readonly marketSentiment: number;
  readonly haterHeat: number;
}): Score01 {
  const direct = toFiniteNumber(args.explicit, NaN);
  if (Number.isFinite(direct)) return clamp01(direct);

  const dealsComponent = Math.min(0.5, args.activeDealCount * 0.045);
  const sentimentComponent = args.marketSentiment < 0 ? Math.min(0.2, Math.abs(args.marketSentiment) / 100) : 0;
  const heatComponent = Math.min(0.3, Math.max(0, args.haterHeat) / 250);
  return clamp01(dealsComponent + sentimentComponent + heatComponent);
}

function estimateOverpayRisk01(args: {
  readonly explicit: number | null | undefined;
  readonly recentOffers: readonly EconomyOfferCompat[];
  readonly marketSentiment: number;
}): Score01 {
  const direct = toFiniteNumber(args.explicit, NaN);
  if (Number.isFinite(direct)) return clamp01(direct);

  let highest = 0;
  for (const offer of args.recentOffers) {
    const price = toFiniteNumber(offer.price, 0);
    const estimatedValue = toFiniteNumber(offer.estimatedValue, 0);
    if (price > 0 && estimatedValue > 0) {
      const ratio = price / Math.max(1, estimatedValue);
      highest = Math.max(highest, ratio - 1);
    }
  }
  const sentimentPenalty = args.marketSentiment > 0 ? 0.05 : 0;
  return clamp01(Math.min(1, highest) + sentimentPenalty);
}

function estimateBluffRisk01(args: {
  readonly explicit: number | null | undefined;
  readonly recentOffers: readonly EconomyOfferCompat[];
  readonly marketSentiment: number;
  readonly haterHeat: number;
}): Score01 {
  const direct = toFiniteNumber(args.explicit, NaN);
  if (Number.isFinite(direct)) return clamp01(direct);

  let urgencyPressure = 0;
  for (const offer of args.recentOffers) {
    urgencyPressure = Math.max(urgencyPressure, toFiniteNumber(offer.urgency01, 0));
  }

  const sentimentPenalty = args.marketSentiment < 0 ? Math.min(0.2, Math.abs(args.marketSentiment) / 100) : 0;
  const heatPenalty = Math.min(0.25, Math.max(0, args.haterHeat) / 300);
  return clamp01(urgencyPressure * 0.55 + sentimentPenalty + heatPenalty);
}

function toOfferArray(value: unknown): readonly EconomyOfferCompat[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is EconomyOfferCompat => !!entry && typeof entry === 'object');
}

function buildMetadataFromContext(
  context?: EconomySignalAdapterContext,
): Readonly<Record<string, JsonValue>> | undefined {
  if (!context) return undefined;
  return buildMetadata(
    {
      source: context.source ?? 'unknown',
      tags: context.tags ?? [],
    },
    context.metadata,
  );
}

function isVisibleWitnessRecommended(args: {
  readonly severity: EconomySignalAdapterSeverity;
  readonly routeChannel: ChatVisibleChannel;
  readonly activeDealCount: number;
  readonly liquidityStress01: Score01;
  readonly bluffRisk01: Score01;
}): boolean {
  if (args.severity === 'CRITICAL') return true;
  if (args.routeChannel === 'DEAL_ROOM' && args.activeDealCount > 0) return true;
  if (args.liquidityStress01 >= clamp01(0.68)) return true;
  if (args.bluffRisk01 >= clamp01(0.72)) return true;
  return args.severity !== 'DEBUG';
}

// ============================================================================
// MARK: Normalization model
// ============================================================================

interface NormalizedEconomyModel {
  readonly roomId: ChatRoomId;
  readonly routeChannel: ChatVisibleChannel;
  readonly activeDealCount: number;
  readonly liquidityStress01: Score01;
  readonly overpayRisk01: Score01;
  readonly bluffRisk01: Score01;
  readonly marketSentiment: number;
  readonly haterHeat: number;
  readonly offerStatus: Nullable<string>;
  readonly offerId: Nullable<string>;
  readonly recentOffers: readonly EconomyOfferCompat[];
}

function normalizeEconomyModel(args: {
  readonly roomId: ChatRoomId;
  readonly routeChannel: ChatVisibleChannel;
  readonly activeDealCount?: number | null;
  readonly liquidityStress01?: number | null;
  readonly overpayRisk01?: number | null;
  readonly bluffRisk01?: number | null;
  readonly marketSentiment?: number | null;
  readonly haterHeat?: number | null;
  readonly recentOffers?: readonly EconomyOfferCompat[] | null;
  readonly offer?: EconomyOfferCompat | null;
}): NormalizedEconomyModel {
  const recentOffers = args.recentOffers ? [...args.recentOffers] : args.offer ? [args.offer] : [];
  const activeDealCount = computeDealCount(args.activeDealCount ?? null, recentOffers);
  const marketSentiment = toFiniteNumber(args.marketSentiment, 0);
  const haterHeat = toFiniteNumber(args.haterHeat, 0);
  const liquidityStress01 = estimateLiquidityStress01({
    explicit: args.liquidityStress01 ?? args.offer?.liquidityStress01 ?? null,
    activeDealCount,
    marketSentiment,
    haterHeat,
  });
  const overpayRisk01 = estimateOverpayRisk01({
    explicit: args.overpayRisk01 ?? args.offer?.overpayRisk01 ?? null,
    recentOffers,
    marketSentiment,
  });
  const bluffRisk01 = estimateBluffRisk01({
    explicit: args.bluffRisk01 ?? args.offer?.bluffRisk01 ?? null,
    recentOffers,
    marketSentiment,
    haterHeat,
  });
  const offerStatus = toOptionalString(args.offer?.status);
  const offerId = toOptionalString(args.offer?.offerId);

  return Object.freeze({
    roomId: args.roomId,
    routeChannel: args.routeChannel,
    activeDealCount,
    liquidityStress01,
    overpayRisk01,
    bluffRisk01,
    marketSentiment,
    haterHeat,
    offerStatus,
    offerId,
    recentOffers,
  });
}

function toChatSnapshot(model: NormalizedEconomyModel): ChatEconomySnapshot {
  return Object.freeze({
    activeDealCount: model.activeDealCount,
    liquidityStress01: model.liquidityStress01,
    overpayRisk01: model.overpayRisk01,
    bluffRisk01: model.bluffRisk01,
  });
}

// ============================================================================
// MARK: Adapter class
// ============================================================================

export class EconomySignalAdapter {
  private readonly logger: EconomySignalAdapterLogger;
  private readonly clock: EconomySignalAdapterClock;
  private readonly defaultRoomId: ChatRoomId;
  private readonly defaultVisibleChannel: ChatVisibleChannel;
  private readonly dedupeWindowMs: number;
  private readonly maxHistory: number;
  private readonly includeShadowMetadata: boolean;
  private readonly highLiquidityStressThreshold: number;
  private readonly dealPressureEscalationThreshold: number;

  private readonly dedupeMap = new Map<string, UnixMs>();
  private readonly history: EconomySignalAdapterHistoryEntry[] = [];
  private acceptedCount = 0;
  private dedupedCount = 0;
  private rejectedCount = 0;
  private lastLiquidityStress01: Score01 = clamp01(0);
  private lastDealCount = 0;

  public constructor(options: EconomySignalAdapterOptions) {
    this.logger = options.logger ?? defaultLogger();
    this.clock = options.clock ?? defaultClock();
    this.defaultRoomId = asRoomId(options.defaultRoomId);
    this.defaultVisibleChannel =
      options.defaultVisibleChannel ?? DEFAULT_ECONOMY_SIGNAL_ADAPTER_OPTIONS.defaultVisibleChannel;
    this.dedupeWindowMs =
      options.dedupeWindowMs ?? DEFAULT_ECONOMY_SIGNAL_ADAPTER_OPTIONS.dedupeWindowMs;
    this.maxHistory =
      options.maxHistory ?? DEFAULT_ECONOMY_SIGNAL_ADAPTER_OPTIONS.maxHistory;
    this.includeShadowMetadata =
      options.includeShadowMetadata ?? DEFAULT_ECONOMY_SIGNAL_ADAPTER_OPTIONS.includeShadowMetadata;
    this.highLiquidityStressThreshold =
      options.highLiquidityStressThreshold ?? DEFAULT_ECONOMY_SIGNAL_ADAPTER_OPTIONS.highLiquidityStressThreshold;
    this.dealPressureEscalationThreshold =
      options.dealPressureEscalationThreshold ?? DEFAULT_ECONOMY_SIGNAL_ADAPTER_OPTIONS.dealPressureEscalationThreshold;
  }

  public reset(): void {
    this.dedupeMap.clear();
    this.history.length = 0;
    this.acceptedCount = 0;
    this.dedupedCount = 0;
    this.rejectedCount = 0;
    this.lastLiquidityStress01 = clamp01(0);
    this.lastDealCount = 0;
  }

  public getState(): EconomySignalAdapterState {
    return Object.freeze({
      history: this.history.slice(),
      acceptedCount: this.acceptedCount,
      dedupedCount: this.dedupedCount,
      rejectedCount: this.rejectedCount,
      lastLiquidityStress01: this.lastLiquidityStress01,
      lastDealCount: this.lastDealCount,
      marketPressure100: this.computeMarketPressure100().total100,
    });
  }

  /**
   * Compute a composite market pressure score on the 0–100 scale.
   *
   * The score combines:
   * - Liquidity stress (0–1 → contributes up to 50 points)
   * - Active deal count (each deal adds ~4 points, capped at 30)
   * - Implicit hater-heat proxy (derived from history saturation, capped at 20)
   *
   * This is the authoritative deal-room pressure surface for overlay
   * diagnostics, ML feature extraction, and DL input tensors.
   *
   * @param overrideStress01  - optional external stress override (skips stored state)
   * @param overrideDealCount - optional external deal count override
   */
  public computeMarketPressure100(
    overrideStress01?: Score01,
    overrideDealCount?: number,
  ): EconomyMarketPressureBreakdown {
    const stress01 = overrideStress01 ?? this.lastLiquidityStress01;
    const dealCount = overrideDealCount ?? this.lastDealCount;

    const liquidityRaw = stress01 * 50;
    const dealCountRaw = Math.min(30, dealCount * 4);
    // Proxy: history saturation (high accepted count = persistent pressure)
    const saturationRaw = Math.min(20, (this.acceptedCount / Math.max(1, this.maxHistory)) * 20);

    const liquidityComponent100 = score100(liquidityRaw);
    const dealCountComponent100 = score100(dealCountRaw);
    const haterHeatComponent100 = score100(saturationRaw);
    const total100 = score100(liquidityRaw + dealCountRaw + saturationRaw);

    let pressureLabel: EconomyMarketPressureBreakdown['pressureLabel'];
    if (total100 >= 75) pressureLabel = 'CRITICAL';
    else if (total100 >= 50) pressureLabel = 'ELEVATED';
    else if (total100 >= 25) pressureLabel = 'BUILDING';
    else pressureLabel = 'CALM';

    return Object.freeze({
      liquidityComponent100,
      dealCountComponent100,
      haterHeatComponent100,
      total100,
      pressureLabel,
    });
  }

  public adaptEvent(
    eventName: EconomySignalAdapterEventName,
    payload: unknown,
    context?: EconomySignalAdapterContext,
  ): EconomySignalAdapterReport {
    this.evictExpiredDedupe();
    const sanitizedEventName = this.sanitizeEventName(eventName);
    const emittedAt = this.resolveEventTime(context?.emittedAt);

    switch (sanitizedEventName) {
      case 'economy.offer.opened':
      case 'OFFER_OPENED':
      case 'economy.offer.updated':
      case 'OFFER_UPDATED':
      case 'economy.offer.accepted':
      case 'OFFER_ACCEPTED':
      case 'economy.offer.rejected':
      case 'OFFER_REJECTED':
      case 'economy.offer.cancelled':
      case 'OFFER_CANCELLED':
        return this.adaptOfferEvent(
          sanitizedEventName,
          payload as EconomyOfferPayloadCompat,
          emittedAt,
          context,
        );
      case 'economy.deal.snapshot':
      case 'DEAL_SNAPSHOT':
        return this.adaptDealSnapshot(
          sanitizedEventName,
          payload as EconomyDealSnapshotCompat,
          emittedAt,
          context,
        );
      case 'economy.liquidity.updated':
      case 'LIQUIDITY_UPDATED':
        return this.adaptLiquidityEvent(
          sanitizedEventName,
          payload as EconomyLiquidityPayloadCompat,
          emittedAt,
          context,
        );
      case 'economy.risk.updated':
      case 'RISK_UPDATED':
        return this.adaptRiskEvent(
          sanitizedEventName,
          payload as EconomyRiskPayloadCompat,
          emittedAt,
          context,
        );
      case 'economy.market.sentiment':
      case 'MARKET_SENTIMENT':
      case 'economy.hater_heat.updated':
      case 'HATER_HEAT_UPDATED':
        return this.adaptHeatOrSentimentEvent(
          sanitizedEventName,
          payload as EconomyHeatPayloadCompat,
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
              eventName: sanitizedEventName,
              reason: 'UNSUPPORTED_ECONOMY_EVENT',
              details: buildMetadata({ eventName: sanitizedEventName }, context?.metadata),
            },
          ],
        });
    }
  }

  public adaptSnapshot(
    snapshot: EconomyDealSnapshotCompat,
    context?: EconomySignalAdapterContext,
  ): EconomySignalAdapterReport {
    this.evictExpiredDedupe();

    const roomId = this.resolveRoomId(snapshot.roomId ?? context?.roomId);
    const recentOffers = toOfferArray(snapshot.recentOffers);
    const probeOffer = recentOffers[0] ?? null;
    const routeChannel = resolveVisibleChannel(
      context?.routeChannel ?? null,
      this.defaultVisibleChannel,
      probeOffer?.status ?? null,
      computeDealCount(snapshot.activeDealCount ?? null, recentOffers),
      score01(snapshot.liquidityStress01, 0),
    );
    const emittedAt = this.resolveEventTime(snapshot.emittedAt ?? context?.emittedAt);

    const normalized = normalizeEconomyModel({
      roomId,
      routeChannel,
      activeDealCount: snapshot.activeDealCount ?? null,
      liquidityStress01: snapshot.liquidityStress01 ?? null,
      overpayRisk01: snapshot.overpayRisk01 ?? null,
      bluffRisk01: snapshot.bluffRisk01 ?? null,
      marketSentiment: snapshot.marketSentiment ?? null,
      haterHeat: snapshot.haterHeat ?? null,
      recentOffers,
      offer: probeOffer,
    });

    const severity = resolveSeverity({
      activeDealCount: normalized.activeDealCount,
      liquidityStress01: normalized.liquidityStress01,
      overpayRisk01: normalized.overpayRisk01,
      bluffRisk01: normalized.bluffRisk01,
      offerStatus: normalized.offerStatus,
    });
    const narrativeWeight = resolveNarrativeWeight({
      routeChannel,
      severity,
      bluffRisk01: normalized.bluffRisk01,
      overpayRisk01: normalized.overpayRisk01,
      liquidityStress01: normalized.liquidityStress01,
      offerStatus: normalized.offerStatus,
    });

    return this.acceptOrDedupe({
      eventName: 'DEAL_SNAPSHOT',
      roomId,
      routeChannel,
      emittedAt,
      snapshot: toChatSnapshot(normalized),
      severity,
      narrativeWeight,
      metadata: buildMetadata(
        {
          source: context?.source ?? 'EconomySignalAdapter.snapshot',
          activeDealCount: normalized.activeDealCount,
          marketSentiment: normalized.marketSentiment,
          haterHeat: normalized.haterHeat,
          recentOfferCount: normalized.recentOffers.length,
          firstOfferId: normalized.offerId,
          witnessRecommended: isVisibleWitnessRecommended({
            severity,
            routeChannel,
            activeDealCount: normalized.activeDealCount,
            liquidityStress01: normalized.liquidityStress01,
            bluffRisk01: normalized.bluffRisk01,
          }),
        },
        buildMetadataFromContext(context),
      ),
    });
  }

  public adaptMany(
    events: ReadonlyArray<{
      readonly eventName: EconomySignalAdapterEventName;
      readonly payload: unknown;
      readonly context?: EconomySignalAdapterContext;
    }>,
  ): EconomySignalAdapterReport {
    const accepted: EconomySignalAdapterAccepted[] = [];
    const deduped: EconomySignalAdapterDeduped[] = [];
    const rejected: EconomySignalAdapterRejected[] = [];

    for (const event of events) {
      const report = this.adaptEvent(event.eventName, event.payload, event.context);
      accepted.push(...report.accepted);
      deduped.push(...report.deduped);
      rejected.push(...report.rejected);
    }

    return Object.freeze({ accepted, deduped, rejected });
  }

  // ---------------------------------------------------------------------------
  // Event-specific adapters
  // ---------------------------------------------------------------------------

  private adaptOfferEvent(
    eventName: EconomySignalAdapterEventName,
    payload: EconomyOfferPayloadCompat,
    emittedAt: UnixMs,
    context?: EconomySignalAdapterContext,
  ): EconomySignalAdapterReport {
    const offer = payload.offer ?? null;
    const snapshot = payload.snapshot ?? null;
    const roomId = this.resolveRoomId(offer?.roomId ?? snapshot?.roomId ?? context?.roomId);
    const recentOffers = snapshot ? toOfferArray(snapshot.recentOffers) : offer ? [offer] : [];
    const directDealCount = snapshot?.activeDealCount ?? null;
    const probeDealCount = computeDealCount(directDealCount, recentOffers);
    const routeChannel = resolveVisibleChannel(
      context?.routeChannel ?? null,
      this.defaultVisibleChannel,
      offer?.status ?? null,
      probeDealCount,
      score01(snapshot?.liquidityStress01 ?? offer?.liquidityStress01, 0),
    );

    const normalized = normalizeEconomyModel({
      roomId,
      routeChannel,
      activeDealCount: directDealCount,
      liquidityStress01: snapshot?.liquidityStress01 ?? offer?.liquidityStress01 ?? null,
      overpayRisk01: snapshot?.overpayRisk01 ?? offer?.overpayRisk01 ?? null,
      bluffRisk01: snapshot?.bluffRisk01 ?? offer?.bluffRisk01 ?? null,
      marketSentiment: snapshot?.marketSentiment ?? null,
      haterHeat: snapshot?.haterHeat ?? null,
      recentOffers,
      offer,
    });

    const severity = resolveSeverity({
      activeDealCount: normalized.activeDealCount,
      liquidityStress01: normalized.liquidityStress01,
      overpayRisk01: normalized.overpayRisk01,
      bluffRisk01: normalized.bluffRisk01,
      offerStatus: normalized.offerStatus,
    });
    const narrativeWeight = resolveNarrativeWeight({
      routeChannel,
      severity,
      bluffRisk01: normalized.bluffRisk01,
      overpayRisk01: normalized.overpayRisk01,
      liquidityStress01: normalized.liquidityStress01,
      offerStatus: normalized.offerStatus,
    });

    return this.acceptOrDedupe({
      eventName,
      roomId,
      routeChannel,
      emittedAt,
      snapshot: toChatSnapshot(normalized),
      severity,
      narrativeWeight,
      metadata: buildMetadata(
        {
          source: context?.source ?? 'EconomySignalAdapter.offer',
          offerId: toOptionalString(offer?.offerId),
          assetId: toOptionalString(offer?.assetId),
          assetLabel: toOptionalString(offer?.assetLabel),
          offerStatus: toOptionalString(offer?.status),
          side: toOptionalString(offer?.side),
          price: toFiniteNumber(offer?.price, 0),
          quantity: toFiniteNumber(offer?.quantity, 0),
          estimatedValue: toFiniteNumber(offer?.estimatedValue, 0),
          urgency01: score01(offer?.urgency01, 0),
          initiatorPlayerId: toOptionalString(offer?.initiator?.playerId),
          counterpartyPlayerId: toOptionalString(offer?.counterparty?.playerId),
        },
        buildMetadataFromContext(context),
      ),
    });
  }

  private adaptDealSnapshot(
    eventName: EconomySignalAdapterEventName,
    payload: EconomyDealSnapshotCompat,
    emittedAt: UnixMs,
    context?: EconomySignalAdapterContext,
  ): EconomySignalAdapterReport {
    return this.adaptSnapshot(
      {
        ...payload,
        emittedAt,
      },
      {
        ...context,
        emittedAt,
        source: context?.source ?? 'EconomySignalAdapter.deal.snapshot',
      },
    );
  }

  private adaptLiquidityEvent(
    eventName: EconomySignalAdapterEventName,
    payload: EconomyLiquidityPayloadCompat,
    emittedAt: UnixMs,
    context?: EconomySignalAdapterContext,
  ): EconomySignalAdapterReport {
    const snapshot = payload.snapshot ?? null;
    const roomId = this.resolveRoomId(payload.roomId ?? snapshot?.roomId ?? context?.roomId);
    const recentOffers = snapshot ? toOfferArray(snapshot.recentOffers) : [];
    const routeChannel = resolveVisibleChannel(
      context?.routeChannel ?? null,
      this.defaultVisibleChannel,
      null,
      computeDealCount(payload.activeDealCount ?? snapshot?.activeDealCount ?? null, recentOffers),
      score01(payload.liquidityStress01 ?? snapshot?.liquidityStress01, 0),
    );

    const normalized = normalizeEconomyModel({
      roomId,
      routeChannel,
      activeDealCount: payload.activeDealCount ?? snapshot?.activeDealCount ?? null,
      liquidityStress01: payload.liquidityStress01 ?? snapshot?.liquidityStress01 ?? null,
      overpayRisk01: snapshot?.overpayRisk01 ?? null,
      bluffRisk01: snapshot?.bluffRisk01 ?? null,
      marketSentiment: payload.marketSentiment ?? snapshot?.marketSentiment ?? null,
      haterHeat: payload.haterHeat ?? snapshot?.haterHeat ?? null,
      recentOffers,
      offer: recentOffers[0] ?? null,
    });

    const severity = resolveSeverity({
      activeDealCount: normalized.activeDealCount,
      liquidityStress01: normalized.liquidityStress01,
      overpayRisk01: normalized.overpayRisk01,
      bluffRisk01: normalized.bluffRisk01,
      offerStatus: normalized.offerStatus,
    });
    const narrativeWeight = normalized.liquidityStress01 >= clamp01(this.highLiquidityStressThreshold)
      ? 'RESCUE'
      : 'TACTICAL';

    return this.acceptOrDedupe({
      eventName,
      roomId,
      routeChannel,
      emittedAt,
      snapshot: toChatSnapshot(normalized),
      severity,
      narrativeWeight,
      metadata: buildMetadata(
        {
          source: context?.source ?? 'EconomySignalAdapter.liquidity.updated',
          marketSentiment: normalized.marketSentiment,
          haterHeat: normalized.haterHeat,
        },
        buildMetadataFromContext(context),
      ),
    });
  }

  private adaptRiskEvent(
    eventName: EconomySignalAdapterEventName,
    payload: EconomyRiskPayloadCompat,
    emittedAt: UnixMs,
    context?: EconomySignalAdapterContext,
  ): EconomySignalAdapterReport {
    const snapshot = payload.snapshot ?? null;
    const roomId = this.resolveRoomId(payload.roomId ?? snapshot?.roomId ?? context?.roomId);
    const recentOffers = snapshot ? toOfferArray(snapshot.recentOffers) : [];
    const routeChannel = resolveVisibleChannel(
      context?.routeChannel ?? null,
      this.defaultVisibleChannel,
      null,
      computeDealCount(payload.activeDealCount ?? snapshot?.activeDealCount ?? null, recentOffers),
      score01(payload.liquidityStress01 ?? snapshot?.liquidityStress01, 0),
    );

    const normalized = normalizeEconomyModel({
      roomId,
      routeChannel,
      activeDealCount: payload.activeDealCount ?? snapshot?.activeDealCount ?? null,
      liquidityStress01: payload.liquidityStress01 ?? snapshot?.liquidityStress01 ?? null,
      overpayRisk01: payload.overpayRisk01 ?? snapshot?.overpayRisk01 ?? null,
      bluffRisk01: payload.bluffRisk01 ?? snapshot?.bluffRisk01 ?? null,
      marketSentiment: snapshot?.marketSentiment ?? null,
      haterHeat: snapshot?.haterHeat ?? null,
      recentOffers,
      offer: recentOffers[0] ?? null,
    });

    const severity = resolveSeverity({
      activeDealCount: normalized.activeDealCount,
      liquidityStress01: normalized.liquidityStress01,
      overpayRisk01: normalized.overpayRisk01,
      bluffRisk01: normalized.bluffRisk01,
      offerStatus: normalized.offerStatus,
    });
    const narrativeWeight = resolveNarrativeWeight({
      routeChannel,
      severity,
      bluffRisk01: normalized.bluffRisk01,
      overpayRisk01: normalized.overpayRisk01,
      liquidityStress01: normalized.liquidityStress01,
      offerStatus: normalized.offerStatus,
    });

    return this.acceptOrDedupe({
      eventName,
      roomId,
      routeChannel,
      emittedAt,
      snapshot: toChatSnapshot(normalized),
      severity,
      narrativeWeight,
      metadata: buildMetadata(
        {
          source: context?.source ?? 'EconomySignalAdapter.risk.updated',
        },
        buildMetadataFromContext(context),
      ),
    });
  }

  private adaptHeatOrSentimentEvent(
    eventName: EconomySignalAdapterEventName,
    payload: EconomyHeatPayloadCompat,
    emittedAt: UnixMs,
    context?: EconomySignalAdapterContext,
  ): EconomySignalAdapterReport {
    const snapshot = payload.snapshot ?? null;
    const roomId = this.resolveRoomId(payload.roomId ?? snapshot?.roomId ?? context?.roomId);
    const recentOffers = snapshot ? toOfferArray(snapshot.recentOffers) : [];
    const routeChannel = resolveVisibleChannel(
      context?.routeChannel ?? null,
      this.defaultVisibleChannel,
      null,
      computeDealCount(snapshot?.activeDealCount ?? null, recentOffers),
      score01(snapshot?.liquidityStress01, 0),
    );

    const normalized = normalizeEconomyModel({
      roomId,
      routeChannel,
      activeDealCount: snapshot?.activeDealCount ?? null,
      liquidityStress01: snapshot?.liquidityStress01 ?? null,
      overpayRisk01: snapshot?.overpayRisk01 ?? null,
      bluffRisk01: snapshot?.bluffRisk01 ?? null,
      marketSentiment: payload.marketSentiment ?? snapshot?.marketSentiment ?? null,
      haterHeat: payload.haterHeat ?? snapshot?.haterHeat ?? null,
      recentOffers,
      offer: recentOffers[0] ?? null,
    });

    const severity = resolveSeverity({
      activeDealCount: normalized.activeDealCount,
      liquidityStress01: normalized.liquidityStress01,
      overpayRisk01: normalized.overpayRisk01,
      bluffRisk01: normalized.bluffRisk01,
      offerStatus: normalized.offerStatus,
    });
    const narrativeWeight = normalized.haterHeat >= 80 ? 'PREDATORY' : 'TACTICAL';

    return this.acceptOrDedupe({
      eventName,
      roomId,
      routeChannel,
      emittedAt,
      snapshot: toChatSnapshot(normalized),
      severity,
      narrativeWeight,
      metadata: buildMetadata(
        {
          source: context?.source ?? 'EconomySignalAdapter.heat.sentiment',
          marketSentiment: normalized.marketSentiment,
          haterHeat: normalized.haterHeat,
        },
        buildMetadataFromContext(context),
      ),
    });
  }

  // ---------------------------------------------------------------------------
  // Acceptance / dedupe / history
  // ---------------------------------------------------------------------------

  private acceptOrDedupe(args: {
    readonly eventName: EconomySignalAdapterEventName;
    readonly roomId: ChatRoomId;
    readonly routeChannel: ChatVisibleChannel;
    readonly emittedAt: UnixMs;
    readonly snapshot: ChatEconomySnapshot;
    readonly severity: EconomySignalAdapterSeverity;
    readonly narrativeWeight: EconomySignalAdapterNarrativeWeight;
    readonly metadata: Readonly<Record<string, JsonValue>>;
  }): EconomySignalAdapterReport {
    this.lastLiquidityStress01 = args.snapshot.liquidityStress01;
    this.lastDealCount = args.snapshot.activeDealCount;

    const dedupeKey = stableKey({
      eventName: args.eventName,
      roomId: args.roomId,
      routeChannel: args.routeChannel,
      activeDealCount: args.snapshot.activeDealCount,
      liquidityStress01: args.snapshot.liquidityStress01,
      overpayRisk01: args.snapshot.overpayRisk01,
      bluffRisk01: args.snapshot.bluffRisk01,
      severity: args.severity,
      narrativeWeight: args.narrativeWeight,
      offerId: args.metadata.offerId ?? null,
      offerStatus: args.metadata.offerStatus ?? null,
      source: args.metadata.source ?? null,
    });

    const previous = this.dedupeMap.get(dedupeKey);
    if (previous && args.emittedAt - previous < this.dedupeWindowMs) {
      this.dedupedCount += 1;
      return Object.freeze({
        accepted: [],
        deduped: [
          {
            dedupeKey,
            eventName: args.eventName,
            reason: 'ECONOMY_SIGNAL_DEDUPED',
            details: buildMetadata(
              {
                previousAcceptedAt: previous,
                emittedAt: args.emittedAt,
                dedupeWindowMs: this.dedupeWindowMs,
              },
              args.metadata,
            ),
          },
        ],
        rejected: [],
      });
    }

    this.dedupeMap.set(dedupeKey, args.emittedAt);

    const signal: ChatSignalEnvelope = Object.freeze({
      type: 'ECONOMY',
      emittedAt: args.emittedAt,
      roomId: args.roomId,
      economy: args.snapshot,
      metadata: this.includeShadowMetadata
        ? buildMetadata(args.metadata, {
            severity: args.severity,
            narrativeWeight: args.narrativeWeight,
            dedupeKey,
          })
        : args.metadata,
    });

    const envelope: ChatInputEnvelope = Object.freeze({
      kind: 'ECONOMY_SIGNAL',
      emittedAt: args.emittedAt,
      payload: signal,
    });

    const accepted: EconomySignalAdapterAccepted = Object.freeze({
      dedupeKey,
      eventName: args.eventName,
      severity: args.severity,
      narrativeWeight: args.narrativeWeight,
      routeChannel: args.routeChannel,
      envelope,
      signal,
      snapshot: args.snapshot,
      diagnostics: buildMetadata(
        {
          witnessRecommended: isVisibleWitnessRecommended({
            severity: args.severity,
            routeChannel: args.routeChannel,
            activeDealCount: args.snapshot.activeDealCount,
            liquidityStress01: args.snapshot.liquidityStress01,
            bluffRisk01: args.snapshot.bluffRisk01,
          }),
          liquidityThresholdCrossed:
            args.snapshot.liquidityStress01 >= clamp01(this.highLiquidityStressThreshold),
          dealPressureEscalated:
            args.snapshot.activeDealCount >= Math.max(1, this.dealPressureEscalationThreshold),
        },
        args.metadata,
      ),
    });

    this.acceptedCount += 1;
    this.pushHistory({
      id: `economy:${this.acceptedCount}:${String(args.emittedAt)}`,
      ts: args.emittedAt,
      roomId: args.roomId,
      eventName: args.eventName,
      routeChannel: args.routeChannel,
      severity: args.severity,
      narrativeWeight: args.narrativeWeight,
      activeDealCount: args.snapshot.activeDealCount,
      liquidityStress01: args.snapshot.liquidityStress01,
      overpayRisk01: args.snapshot.overpayRisk01,
      bluffRisk01: args.snapshot.bluffRisk01,
      dedupeKey,
      metadata: args.metadata,
    });

    return Object.freeze({ accepted: [accepted], deduped: [], rejected: [] });
  }

  private pushHistory(entry: EconomySignalAdapterHistoryEntry): void {
    this.history.push(Object.freeze(entry));
    if (this.history.length > this.maxHistory) {
      this.history.splice(0, this.history.length - this.maxHistory);
    }
  }

  private resolveRoomId(value: ChatRoomId | string | null | undefined): ChatRoomId {
    return value ? asRoomId(value) : this.defaultRoomId;
  }

  private resolveEventTime(value: number | null | undefined): UnixMs {
    return asUnixMs(toFiniteNumber(value, this.clock.now()));
  }

  private evictExpiredDedupe(): void {
    const now = this.clock.now();
    for (const [key, ts] of this.dedupeMap.entries()) {
      if (now - ts >= this.dedupeWindowMs) {
        this.dedupeMap.delete(key);
      }
    }
  }

  private sanitizeEventName(value: string): EconomySignalAdapterEventName {
    return (typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : 'DEAL_SNAPSHOT') as EconomySignalAdapterEventName;
  }
}
