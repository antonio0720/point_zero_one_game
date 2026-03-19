/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT OFFER CONTRACT
 * FILE: shared/contracts/chat/ChatOffer.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared contract surface for offer payloads projected through the
 * chat lane. Whereas ChatNegotiation.ts describes the broader deal lifecycle,
 * this file focuses on the offer object itself: valuation, reveal posture,
 * proof, counter structure, payment terms, witness exposure, and replay-safe
 * analytics.
 *
 * Offer Doctrine
 * --------------
 * 1. An offer is an authored move, not just a number.
 * 2. The same economic value can project differently depending on secrecy,
 *    timing, audience heat, helper support, and prior memory.
 * 3. Offers must survive replay, moderation, proofing, analytics, and counter
 *    resolution without relying on UI-layer heuristics.
 * 4. Offer data should be rich enough for AI/ML/logic layers, but stable enough
 *    to remain deterministic across frontend/backend/server.
 *
 * ============================================================================
 */

// ============================================================================
// MARK: Shared brands
// ============================================================================

export type Brand<T, TBrand extends string> = T & { readonly __brand: TBrand };

export type UnixMs = Brand<number, 'UnixMs'>;
export type ChatOfferId = Brand<string, 'ChatOfferId'>;
export type ChatOfferVersionId = Brand<string, 'ChatOfferVersionId'>;
export type ChatOfferBundleId = Brand<string, 'ChatOfferBundleId'>;
export type ChatOfferAnchorId = Brand<string, 'ChatOfferAnchorId'>;
export type ChatOfferProofId = Brand<string, 'ChatOfferProofId'>;
export type ChatOfferThreadId = Brand<string, 'ChatOfferThreadId'>;
export type ChatOfferWindowId = Brand<string, 'ChatOfferWindowId'>;
export type ChatOfferActorId = Brand<string, 'ChatOfferActorId'>;
export type ChatOfferSceneId = Brand<string, 'ChatOfferSceneId'>;
export type ChatOfferMessageId = Brand<string, 'ChatOfferMessageId'>;
export type ChatOfferRoomId = Brand<string, 'ChatOfferRoomId'>;
export type ChatOfferRunId = Brand<string, 'ChatOfferRunId'>;
export type OfferCurrencyCode = Brand<string, 'OfferCurrencyCode'>;
export type OfferAmount = Brand<number, 'OfferAmount'>;
export type BasisPoints = Brand<number, 'BasisPoints'>;
export type Score0To1 = Brand<number, 'Score0To1'>;
export type Score0To100 = Brand<number, 'Score0To100'>;
export type Probability = Brand<number, 'Probability'>;
export type ProofHash = Brand<string, 'ProofHash'>;

// ============================================================================
// MARK: Offer literals
// ============================================================================

export const CHAT_OFFER_KINDS = [
  'OPENING',
  'COUNTER',
  'SWEETENER',
  'TAKE_IT_OR_LEAVE_IT',
  'BLUFF',
  'RESCUE_OVERRIDE',
  'SYSTEM_RESCUE',
  'HELPER_GUIDED',
  'LIVEOPS_BONUS',
  'LIQUIDATION',
] as const;

export type ChatOfferKind = (typeof CHAT_OFFER_KINDS)[number];

export const CHAT_OFFER_STATUSES = [
  'DRAFT',
  'STAGED',
  'POSTED',
  'READ',
  'UNDER_REVIEW',
  'COUNTERED',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
  'EXPIRED',
  'LEAKED',
] as const;

export type ChatOfferStatus = (typeof CHAT_OFFER_STATUSES)[number];

export const CHAT_OFFER_VISIBILITY = [
  'PRIVATE',
  'DEAL_ROOM_ONLY',
  'DEAL_ROOM_PLUS_HELPER',
  'DEAL_ROOM_PLUS_WITNESSES',
  'PUBLIC',
  'SHADOW_ONLY',
] as const;

export type ChatOfferVisibility = (typeof CHAT_OFFER_VISIBILITY)[number];

export const CHAT_OFFER_PAYMENT_TERMS = [
  'IMMEDIATE',
  'DEFERRED',
  'INSTALLMENTS',
  'CONDITIONAL',
  'PERFORMANCE_BASED',
  'ESCROW',
  'HYBRID',
] as const;

export type ChatOfferPaymentTerms = (typeof CHAT_OFFER_PAYMENT_TERMS)[number];

export const CHAT_OFFER_GUARANTEE_TYPES = [
  'NONE',
  'SOFT_WORD',
  'PROOF_ONLY',
  'REFUND_PARTIAL',
  'REFUND_FULL',
  'ESCALATION_RIGHT',
  'WITNESS_BACKED',
] as const;

export type ChatOfferGuaranteeType = (typeof CHAT_OFFER_GUARANTEE_TYPES)[number];

export const CHAT_OFFER_COUNTER_OUTCOMES = [
  'NONE',
  'LIKELY_ACCEPT',
  'LIKELY_COUNTER',
  'LIKELY_REJECT',
  'LIKELY_STALL',
  'LIKELY_LEAK',
  'LIKELY_RESCUE',
] as const;

export type ChatOfferCounterOutcome = (typeof CHAT_OFFER_COUNTER_OUTCOMES)[number];

export const CHAT_OFFER_REVEAL_MODES = [
  'FULL',
  'PARTIAL',
  'STAGED',
  'TRAP',
  'FAKEOUT',
  'DELAYED_FULL',
] as const;

export type ChatOfferRevealMode = (typeof CHAT_OFFER_REVEAL_MODES)[number];

// ============================================================================
// MARK: Core score/value structures
// ============================================================================

export interface ChatOfferScore {
  readonly raw: number;
  readonly normalized: Score0To1;
  readonly percentile?: Score0To100;
  readonly source: string;
  readonly measuredAt: UnixMs;
}

export interface ChatOfferAmountRange {
  readonly min: OfferAmount;
  readonly max: OfferAmount;
  readonly expected?: OfferAmount;
  readonly fairValue?: OfferAmount;
}

export interface ChatOfferPrice {
  readonly amount: OfferAmount;
  readonly currency: OfferCurrencyCode;
  readonly taxBps?: BasisPoints;
  readonly feeBps?: BasisPoints;
  readonly rebateBps?: BasisPoints;
  readonly discountBps?: BasisPoints;
  readonly marketRange?: ChatOfferAmountRange;
}

export interface ChatOfferWindow {
  readonly windowId: ChatOfferWindowId;
  readonly opensAt: UnixMs;
  readonly closesAt: UnixMs;
  readonly graceUntil?: UnixMs;
  readonly rescueEligibleAt?: UnixMs;
  readonly leakEligibleAt?: UnixMs;
  readonly readPreferredBy?: UnixMs;
}

export interface ChatOfferVisibilityEnvelope {
  readonly visibility: ChatOfferVisibility;
  readonly revealMode: ChatOfferRevealMode;
  readonly witnessCount?: number;
  readonly helperVisible: boolean;
  readonly audienceHeat?: Score0To1;
  readonly secrecyPressure?: Score0To1;
}

// ============================================================================
// MARK: Actor + proof structures
// ============================================================================

export interface ChatOfferActorRef {
  readonly actorId: ChatOfferActorId;
  readonly displayName: string;
  readonly actorKind:
    | 'PLAYER'
    | 'NPC'
    | 'RIVAL'
    | 'HELPER'
    | 'SYSTEM'
    | 'AUDIENCE'
    | 'LIVEOPS';
  readonly factionId?: string;
  readonly personaKey?: string;
  readonly voiceprintKey?: string;
}

export interface ChatOfferProof {
  readonly proofId: ChatOfferProofId;
  readonly proofHash: ProofHash;
  readonly proofType:
    | 'MESSAGE_HASH'
    | 'TRANSCRIPT_SLICE'
    | 'RUN_STATE'
    | 'MARKET_SNAPSHOT'
    | 'HELPER_NOTE'
    | 'SYSTEM_ASSERTION';
  readonly generatedAt: UnixMs;
  readonly notes?: readonly string[];
}

export interface ChatOfferGuarantee {
  readonly type: ChatOfferGuaranteeType;
  readonly strength: ChatOfferScore;
  readonly describedAs?: string;
  readonly proof?: ChatOfferProof;
}

export interface ChatOfferCondition {
  readonly key: string;
  readonly description: string;
  readonly required: boolean;
  readonly hiddenUntilAccept?: boolean;
}

export interface ChatOfferConcession {
  readonly label: string;
  readonly valueDelta?: OfferAmount;
  readonly reputationCost?: number;
  readonly urgencyCost?: number;
  readonly helperRecommended?: boolean;
}

// ============================================================================
// MARK: Counter + analytics
// ============================================================================

export interface ChatOfferCounterRead {
  readonly likelyOutcome: ChatOfferCounterOutcome;
  readonly counterDistance: Score0To1;
  readonly rejectionRisk: Score0To1;
  readonly stallRisk: Score0To1;
  readonly rescueNeed: Score0To1;
  readonly leakRisk: Score0To1;
}

export interface ChatOfferAnalytics {
  readonly fairness: ChatOfferScore;
  readonly aggression: ChatOfferScore;
  readonly urgency: ChatOfferScore;
  readonly bluffLikelihood: Probability;
  readonly desperation: Score0To1;
  readonly trustSignal: Score0To1;
  readonly reputationImpact: number;
  readonly crowdImpact?: number;
}

export interface ChatOfferMemoryHook {
  readonly anchorId: ChatOfferAnchorId;
  readonly kind:
    | 'PAST_OFFER'
    | 'PAST_COUNTER'
    | 'PAST_RESCUE'
    | 'PAST_LEAK'
    | 'PAST_COLLAPSE'
    | 'PAST_WIN';
  readonly salience: Score0To1;
  readonly note: string;
}

// ============================================================================
// MARK: Offer lifecycle objects
// ============================================================================

export interface ChatOfferDraft {
  readonly bundleId?: ChatOfferBundleId;
  readonly kind: ChatOfferKind;
  readonly status: 'DRAFT' | 'STAGED';
  readonly threadId: ChatOfferThreadId;
  readonly roomId?: ChatOfferRoomId;
  readonly sceneId?: ChatOfferSceneId;
  readonly offeredBy: ChatOfferActorRef;
  readonly offeredTo: ChatOfferActorRef;
  readonly price: ChatOfferPrice;
  readonly paymentTerms: ChatOfferPaymentTerms;
  readonly guarantees?: readonly ChatOfferGuarantee[];
  readonly conditions?: readonly ChatOfferCondition[];
  readonly concessions?: readonly ChatOfferConcession[];
  readonly visibility: ChatOfferVisibilityEnvelope;
  readonly window?: ChatOfferWindow;
  readonly analytics?: ChatOfferAnalytics;
  readonly memoryHooks?: readonly ChatOfferMemoryHook[];
  readonly createdAt: UnixMs;
}

export interface ChatOfferVersion {
  readonly versionId: ChatOfferVersionId;
  readonly versionNumber: number;
  readonly price: ChatOfferPrice;
  readonly paymentTerms: ChatOfferPaymentTerms;
  readonly guarantees?: readonly ChatOfferGuarantee[];
  readonly conditions?: readonly ChatOfferCondition[];
  readonly concessions?: readonly ChatOfferConcession[];
  readonly analytics?: ChatOfferAnalytics;
  readonly note?: string;
  readonly createdAt: UnixMs;
}

export interface ChatOffer {
  readonly offerId: ChatOfferId;
  readonly threadId: ChatOfferThreadId;
  readonly roomId?: ChatOfferRoomId;
  readonly runId?: ChatOfferRunId;
  readonly sourceMessageId?: ChatOfferMessageId;
  readonly sceneId?: ChatOfferSceneId;
  readonly kind: ChatOfferKind;
  readonly status: ChatOfferStatus;
  readonly offeredBy: ChatOfferActorRef;
  readonly offeredTo: ChatOfferActorRef;
  readonly currentVersion: ChatOfferVersion;
  readonly priorVersions?: readonly ChatOfferVersion[];
  readonly visibility: ChatOfferVisibilityEnvelope;
  readonly window?: ChatOfferWindow;
  readonly counterRead?: ChatOfferCounterRead;
  readonly proof?: ChatOfferProof;
  readonly createdAt: UnixMs;
  readonly updatedAt: UnixMs;
}

export interface ChatOfferBundle {
  readonly bundleId: ChatOfferBundleId;
  readonly threadId: ChatOfferThreadId;
  readonly offers: readonly ChatOffer[];
  readonly leadOfferId: ChatOfferId;
  readonly createdAt: UnixMs;
  readonly updatedAt: UnixMs;
}

export interface ChatOfferPatch {
  readonly offerId: ChatOfferId;
  readonly status?: ChatOfferStatus;
  readonly currentVersion?: ChatOfferVersion;
  readonly appendedVersions?: readonly ChatOfferVersion[];
  readonly visibility?: ChatOfferVisibilityEnvelope;
  readonly window?: ChatOfferWindow | null;
  readonly counterRead?: ChatOfferCounterRead | null;
  readonly proof?: ChatOfferProof | null;
  readonly updatedAt: UnixMs;
}

// ============================================================================
// MARK: Guards
// ============================================================================

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasLiteral<T extends readonly string[]>(value: unknown, choices: T): value is T[number] {
  return isString(value) && (choices as readonly string[]).includes(value);
}

export function isChatOfferKind(value: unknown): value is ChatOfferKind {
  return hasLiteral(value, CHAT_OFFER_KINDS);
}

export function isChatOfferStatus(value: unknown): value is ChatOfferStatus {
  return hasLiteral(value, CHAT_OFFER_STATUSES);
}

export function isChatOfferVisibility(value: unknown): value is ChatOfferVisibility {
  return hasLiteral(value, CHAT_OFFER_VISIBILITY);
}

export function isChatOfferPaymentTerms(value: unknown): value is ChatOfferPaymentTerms {
  return hasLiteral(value, CHAT_OFFER_PAYMENT_TERMS);
}

export function isChatOfferGuaranteeType(value: unknown): value is ChatOfferGuaranteeType {
  return hasLiteral(value, CHAT_OFFER_GUARANTEE_TYPES);
}

export function isChatOfferCounterOutcome(value: unknown): value is ChatOfferCounterOutcome {
  return hasLiteral(value, CHAT_OFFER_COUNTER_OUTCOMES);
}

export function isChatOfferRevealMode(value: unknown): value is ChatOfferRevealMode {
  return hasLiteral(value, CHAT_OFFER_REVEAL_MODES);
}

export function isChatOfferScore(value: unknown): value is ChatOfferScore {
  return (
    isObject(value) &&
    isNumber(value.raw) &&
    isNumber(value.normalized) &&
    isString(value.source) &&
    isNumber(value.measuredAt)
  );
}

export function isChatOfferPrice(value: unknown): value is ChatOfferPrice {
  return isObject(value) && isNumber(value.amount) && isString(value.currency);
}

export function isChatOfferWindow(value: unknown): value is ChatOfferWindow {
  return (
    isObject(value) &&
    isString(value.windowId) &&
    isNumber(value.opensAt) &&
    isNumber(value.closesAt)
  );
}

export function isChatOfferVisibilityEnvelope(value: unknown): value is ChatOfferVisibilityEnvelope {
  return (
    isObject(value) &&
    isChatOfferVisibility(value.visibility) &&
    isChatOfferRevealMode(value.revealMode) &&
    typeof value.helperVisible === 'boolean'
  );
}

export function isChatOfferActorRef(value: unknown): value is ChatOfferActorRef {
  return (
    isObject(value) &&
    isString(value.actorId) &&
    isString(value.displayName) &&
    isString(value.actorKind)
  );
}

export function isChatOfferProof(value: unknown): value is ChatOfferProof {
  return (
    isObject(value) &&
    isString(value.proofId) &&
    isString(value.proofHash) &&
    isString(value.proofType) &&
    isNumber(value.generatedAt)
  );
}

export function isChatOfferGuarantee(value: unknown): value is ChatOfferGuarantee {
  return (
    isObject(value) &&
    isChatOfferGuaranteeType(value.type) &&
    isChatOfferScore(value.strength)
  );
}

export function isChatOfferCondition(value: unknown): value is ChatOfferCondition {
  return (
    isObject(value) &&
    isString(value.key) &&
    isString(value.description) &&
    typeof value.required === 'boolean'
  );
}

export function isChatOfferConcession(value: unknown): value is ChatOfferConcession {
  return isObject(value) && isString(value.label);
}

export function isChatOfferCounterRead(value: unknown): value is ChatOfferCounterRead {
  return (
    isObject(value) &&
    isChatOfferCounterOutcome(value.likelyOutcome) &&
    isNumber(value.counterDistance) &&
    isNumber(value.rejectionRisk) &&
    isNumber(value.stallRisk) &&
    isNumber(value.rescueNeed) &&
    isNumber(value.leakRisk)
  );
}

export function isChatOfferAnalytics(value: unknown): value is ChatOfferAnalytics {
  return (
    isObject(value) &&
    isChatOfferScore(value.fairness) &&
    isChatOfferScore(value.aggression) &&
    isChatOfferScore(value.urgency) &&
    isNumber(value.bluffLikelihood) &&
    isNumber(value.desperation) &&
    isNumber(value.trustSignal) &&
    isNumber(value.reputationImpact)
  );
}

export function isChatOfferVersion(value: unknown): value is ChatOfferVersion {
  return (
    isObject(value) &&
    isString(value.versionId) &&
    isNumber(value.versionNumber) &&
    isChatOfferPrice(value.price) &&
    isChatOfferPaymentTerms(value.paymentTerms) &&
    isNumber(value.createdAt)
  );
}

export function isChatOffer(value: unknown): value is ChatOffer {
  return (
    isObject(value) &&
    isString(value.offerId) &&
    isString(value.threadId) &&
    isChatOfferKind(value.kind) &&
    isChatOfferStatus(value.status) &&
    isChatOfferActorRef(value.offeredBy) &&
    isChatOfferActorRef(value.offeredTo) &&
    isChatOfferVersion(value.currentVersion) &&
    isChatOfferVisibilityEnvelope(value.visibility) &&
    isNumber(value.createdAt) &&
    isNumber(value.updatedAt)
  );
}

// ============================================================================
// MARK: Builders
// ============================================================================

export function asUnixMs(value: number): UnixMs {
  return value as UnixMs;
}

export function asChatOfferId(value: string): ChatOfferId {
  return value as ChatOfferId;
}

export function asChatOfferThreadId(value: string): ChatOfferThreadId {
  return value as ChatOfferThreadId;
}

export function asChatOfferWindowId(value: string): ChatOfferWindowId {
  return value as ChatOfferWindowId;
}

export function asChatOfferVersionId(value: string): ChatOfferVersionId {
  return value as ChatOfferVersionId;
}

export function asOfferAmount(value: number): OfferAmount {
  return value as OfferAmount;
}

export function asCurrencyCode(value: string): OfferCurrencyCode {
  return value as OfferCurrencyCode;
}

export function asBasisPoints(value: number): BasisPoints {
  return value as BasisPoints;
}

export function asScore0To1(value: number): Score0To1 {
  return value as Score0To1;
}

export function asScore0To100(value: number): Score0To100 {
  return value as Score0To100;
}

export function asProbability(value: number): Probability {
  return value as Probability;
}

export function createChatOfferScore(
  raw: number,
  normalized: number,
  source: string,
  measuredAt: number,
  percentile?: number,
): ChatOfferScore {
  return {
    raw,
    normalized: asScore0To1(normalized),
    percentile: percentile === undefined ? undefined : asScore0To100(percentile),
    source,
    measuredAt: asUnixMs(measuredAt),
  };
}

export function createChatOfferPrice(
  amount: number,
  currency: string,
  opts: Partial<Omit<ChatOfferPrice, 'amount' | 'currency'>> = {},
): ChatOfferPrice {
  return {
    amount: asOfferAmount(amount),
    currency: asCurrencyCode(currency),
    ...opts,
  };
}

export function createChatOfferWindow(
  opensAt: number,
  closesAt: number,
  opts: Partial<Omit<ChatOfferWindow, 'windowId' | 'opensAt' | 'closesAt'>> & { windowId?: string } = {},
): ChatOfferWindow {
  return {
    windowId: asChatOfferWindowId(opts.windowId ?? `offer-window:${opensAt}:${closesAt}`),
    opensAt: asUnixMs(opensAt),
    closesAt: asUnixMs(closesAt),
    graceUntil: opts.graceUntil,
    rescueEligibleAt: opts.rescueEligibleAt,
    leakEligibleAt: opts.leakEligibleAt,
    readPreferredBy: opts.readPreferredBy,
  };
}

export function createChatOfferVersion(
  versionNumber: number,
  price: ChatOfferPrice,
  paymentTerms: ChatOfferPaymentTerms,
  opts: Partial<Omit<ChatOfferVersion, 'versionId' | 'versionNumber' | 'price' | 'paymentTerms' | 'createdAt'>> & {
    versionId?: string;
    createdAt?: number;
  } = {},
): ChatOfferVersion {
  return {
    versionId: asChatOfferVersionId(opts.versionId ?? `offer-version:${versionNumber}`),
    versionNumber,
    price,
    paymentTerms,
    guarantees: opts.guarantees,
    conditions: opts.conditions,
    concessions: opts.concessions,
    analytics: opts.analytics,
    note: opts.note,
    createdAt: asUnixMs(opts.createdAt ?? Date.now()),
  };
}

// ============================================================================
// MARK: Derived helpers
// ============================================================================

export function chatOfferWindowDurationMs(window?: ChatOfferWindow | null): number {
  if (!window) {
    return 0;
  }
  return Math.max(0, Number(window.closesAt) - Number(window.opensAt));
}

export function chatOfferWindowExpired(window: ChatOfferWindow | undefined, now: UnixMs): boolean {
  return Boolean(window && Number(now) > Number(window.closesAt));
}

export function chatOfferHasGuarantee(offer: ChatOffer): boolean {
  return Array.isArray(offer.currentVersion.guarantees) && offer.currentVersion.guarantees.length > 0;
}

export function chatOfferHasConditions(offer: ChatOffer): boolean {
  return Array.isArray(offer.currentVersion.conditions) && offer.currentVersion.conditions.length > 0;
}

export function chatOfferHasConcessions(offer: ChatOffer): boolean {
  return Array.isArray(offer.currentVersion.concessions) && offer.currentVersion.concessions.length > 0;
}

export function chatOfferIsLive(offer: ChatOffer): boolean {
  return (
    offer.status === 'POSTED' ||
    offer.status === 'READ' ||
    offer.status === 'UNDER_REVIEW' ||
    offer.status === 'COUNTERED'
  );
}

export function chatOfferCanLeak(offer: ChatOffer): boolean {
  return (
    offer.visibility.visibility === 'DEAL_ROOM_PLUS_WITNESSES' ||
    offer.visibility.visibility === 'PUBLIC'
  );
}

export function chatOfferSupportsRescue(offer: ChatOffer): boolean {
  return (
    offer.kind === 'RESCUE_OVERRIDE' ||
    offer.kind === 'SYSTEM_RESCUE' ||
    offer.kind === 'HELPER_GUIDED' ||
    (offer.counterRead !== undefined && Number(offer.counterRead.rescueNeed) >= 0.5)
  );
}

export function chatOfferProjectedOutcome(offer: ChatOffer): ChatOfferCounterOutcome {
  return offer.counterRead?.likelyOutcome ?? 'NONE';
}

export function chatOfferLatestVersionCount(offer: ChatOffer): number {
  return 1 + (offer.priorVersions?.length ?? 0);
}

export function chatOfferPriceDeltaFromPrior(offer: ChatOffer): number | undefined {
  const prior = offer.priorVersions?.[offer.priorVersions.length - 1];
  if (!prior) {
    return undefined;
  }
  return Number(offer.currentVersion.price.amount) - Number(prior.price.amount);
}

// ============================================================================
// MARK: Registry metadata
// ============================================================================

export const CHAT_OFFER_MODULE_ID = 'shared/contracts/chat/ChatOffer' as const;
export const CHAT_OFFER_MODULE_CATEGORY = 'NEGOTIATION' as const;
export const CHAT_OFFER_FILE_BASENAME = 'ChatOffer.ts' as const;

export const ChatOfferModule = {
  id: CHAT_OFFER_MODULE_ID,
  category: CHAT_OFFER_MODULE_CATEGORY,
  file: CHAT_OFFER_FILE_BASENAME,
  offerKinds: CHAT_OFFER_KINDS,
  statuses: CHAT_OFFER_STATUSES,
  visibilityModes: CHAT_OFFER_VISIBILITY,
  paymentTerms: CHAT_OFFER_PAYMENT_TERMS,
  guaranteeTypes: CHAT_OFFER_GUARANTEE_TYPES,
  counterOutcomes: CHAT_OFFER_COUNTER_OUTCOMES,
  revealModes: CHAT_OFFER_REVEAL_MODES,
} as const;

export default ChatOfferModule;

// ============================================================================
// MARK: Offer ladder + stress projections
// ============================================================================

export interface ChatOfferStressProjection {
  readonly embarrassmentRisk: Score0To1;
  readonly dominanceShift: Score0To1;
  readonly helperNeed: Score0To1;
  readonly audienceMockeryRisk: Score0To1;
  readonly dealRoomPredationRisk: Score0To1;
  readonly syndicateLeakRisk: Score0To1;
}

export interface ChatOfferLadderStep {
  readonly step: number;
  readonly label: string;
  readonly amount: OfferAmount;
  readonly deltaFromCurrent: number;
  readonly recommendedFor:
    | 'SAFE_CLOSE'
    | 'PRESSURE_TEST'
    | 'BLUFF_PROBE'
    | 'RESCUE_EXIT'
    | 'LEGEND_PUSH';
}

export interface ChatOfferProjection {
  readonly acceptedProbability: Probability;
  readonly counterProbability: Probability;
  readonly rejectProbability: Probability;
  readonly leakProbability: Probability;
  readonly rescueProbability: Probability;
  readonly stress: ChatOfferStressProjection;
  readonly ladder?: readonly ChatOfferLadderStep[];
}

export function createChatOfferStressProjection(
  embarrassmentRisk: number,
  dominanceShift: number,
  helperNeed: number,
  audienceMockeryRisk: number,
  dealRoomPredationRisk: number,
  syndicateLeakRisk: number,
): ChatOfferStressProjection {
  return {
    embarrassmentRisk: asScore0To1(embarrassmentRisk),
    dominanceShift: asScore0To1(dominanceShift),
    helperNeed: asScore0To1(helperNeed),
    audienceMockeryRisk: asScore0To1(audienceMockeryRisk),
    dealRoomPredationRisk: asScore0To1(dealRoomPredationRisk),
    syndicateLeakRisk: asScore0To1(syndicateLeakRisk),
  };
}

export function chatOfferPriceWithinRange(
  offer: ChatOffer,
  min: number,
  max: number,
): boolean {
  const amount = Number(offer.currentVersion.price.amount);
  return amount >= min && amount <= max;
}

export function chatOfferGuaranteeStrength(offer: ChatOffer): number {
  const guarantees = offer.currentVersion.guarantees ?? [];
  if (guarantees.length === 0) {
    return 0;
  }
  return (
    guarantees.reduce((sum, item) => sum + Number(item.strength.normalized), 0) /
    guarantees.length
  );
}

export function chatOfferConcessionCount(offer: ChatOffer): number {
  return offer.currentVersion.concessions?.length ?? 0;
}

export function chatOfferConditionCount(offer: ChatOffer): number {
  return offer.currentVersion.conditions?.length ?? 0;
}

export function chatOfferProjectedSoftness(offer: ChatOffer): number {
  const concessionFactor = Math.min(1, chatOfferConcessionCount(offer) / 5);
  const guaranteeFactor = Math.min(1, chatOfferGuaranteeStrength(offer));
  return (concessionFactor + guaranteeFactor) / 2;
}

export function chatOfferProjectedHostility(offer: ChatOffer): number {
  const aggression = Number(offer.currentVersion.analytics?.aggression.normalized ?? 0);
  const urgency = Number(offer.currentVersion.analytics?.urgency.normalized ?? 0);
  const revealPenalty = offer.visibility.revealMode === 'TRAP' || offer.visibility.revealMode === 'FAKEOUT' ? 0.25 : 0;
  return Math.min(1, aggression * 0.55 + urgency * 0.3 + revealPenalty);
}

export function chatOfferProjectedTrustworthiness(offer: ChatOffer): number {
  const trust = Number(offer.currentVersion.analytics?.trustSignal ?? 0);
  const guarantee = chatOfferGuaranteeStrength(offer);
  const leakPenalty = chatOfferCanLeak(offer) ? 0.15 : 0;
  return Math.max(0, Math.min(1, trust * 0.6 + guarantee * 0.5 - leakPenalty));
}

export function chatOfferShouldTriggerHelperReview(offer: ChatOffer): boolean {
  return (
    chatOfferProjectedHostility(offer) >= 0.7 ||
    Number(offer.counterRead?.rescueNeed ?? 0) >= 0.6 ||
    Number(offer.counterRead?.leakRisk ?? 0) >= 0.7
  );
}

export function chatOfferProjectedOutcomeBand(offer: ChatOffer): 'SAFE' | 'RISKY' | 'VOLATILE' | 'COLLAPSE' {
  const reject = Number(offer.counterRead?.rejectionRisk ?? 0);
  const stall = Number(offer.counterRead?.stallRisk ?? 0);
  const leak = Number(offer.counterRead?.leakRisk ?? 0);
  const rescue = Number(offer.counterRead?.rescueNeed ?? 0);
  const weighted = reject * 0.35 + stall * 0.2 + leak * 0.25 + rescue * 0.2;
  if (weighted >= 0.85) return 'COLLAPSE';
  if (weighted >= 0.6) return 'VOLATILE';
  if (weighted >= 0.35) return 'RISKY';
  return 'SAFE';
}
