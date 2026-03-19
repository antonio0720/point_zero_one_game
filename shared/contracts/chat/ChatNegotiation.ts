/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT NEGOTIATION CONTRACT
 * FILE: shared/contracts/chat/ChatNegotiation.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared contract surface for Deal Room and negotiation-aware chat.
 * This file defines the authoritative semantic language used by frontend,
 * backend, and server lanes when representing negotiation posture, inference,
 * pressure, bluffing, concession flow, counter-offer reasoning, leak risk,
 * reputation spillover, and rescue-aware trading outcomes.
 *
 * Design Notes
 * ------------
 * - This file is intentionally self-contained so shared consumers can import it
 *   without creating cyclical dependency pressure inside the broader chat lane.
 * - It follows the same contract philosophy as the wider shared chat estate:
 *   explicit brands, explicit literals, explicit guards, and replay-safe data.
 * - No UI-only fields live here. Anything visual must be derivable from these
 *   semantic contracts in frontend policy layers.
 * - No backend-only mutable state containers live here. Runtime ledgers should
 *   project into these contracts instead of leaking implementation details.
 *
 * Negotiation Doctrine
 * --------------------
 * 1. A negotiation event is not only an offer; it is a social signal.
 * 2. Every offer carries explicit economics and implicit emotional pressure.
 * 3. Players, NPCs, rivals, helpers, and the audience can all influence a deal.
 * 4. Channel-specific context changes meaning: a bluff in DEAL_ROOM is not the
 *    same as a boast in GLOBAL or a whisper in SYNDICATE.
 * 5. Rescue and pressure systems may intervene in negotiation, but must do so
 *    through declared contract fields, not hidden mutation.
 * 6. Negotiation memory must be reconstructable from the transcript.
 *
 * ============================================================================
 */

// ============================================================================
// MARK: Shared primitive brands
// ============================================================================

export type Brand<T, TBrand extends string> = T & { readonly __brand: TBrand };

export type UnixMs = Brand<number, 'UnixMs'>;
export type NegotiationId = Brand<string, 'NegotiationId'>;
export type NegotiationRoundId = Brand<string, 'NegotiationRoundId'>;
export type NegotiationThreadId = Brand<string, 'NegotiationThreadId'>;
export type NegotiationActorId = Brand<string, 'NegotiationActorId'>;
export type NegotiationOfferId = Brand<string, 'NegotiationOfferId'>;
export type NegotiationWindowId = Brand<string, 'NegotiationWindowId'>;
export type NegotiationAnchorId = Brand<string, 'NegotiationAnchorId'>;
export type NegotiationSignalId = Brand<string, 'NegotiationSignalId'>;
export type NegotiationMemoryId = Brand<string, 'NegotiationMemoryId'>;
export type NegotiationSceneId = Brand<string, 'NegotiationSceneId'>;
export type NegotiationLeakId = Brand<string, 'NegotiationLeakId'>;
export type NegotiationProofId = Brand<string, 'NegotiationProofId'>;
export type NegotiationRewardId = Brand<string, 'NegotiationRewardId'>;
export type PlayerId = Brand<string, 'PlayerId'>;
export type NpcId = Brand<string, 'NpcId'>;
export type ChatMessageId = Brand<string, 'ChatMessageId'>;
export type ChatRoomId = Brand<string, 'ChatRoomId'>;
export type RunId = Brand<string, 'RunId'>;
export type SessionId = Brand<string, 'SessionId'>;
export type MatchId = Brand<string, 'MatchId'>;
export type ChannelId = Brand<string, 'ChannelId'>;
export type TranscriptCursor = Brand<string, 'TranscriptCursor'>;
export type ProofHash = Brand<string, 'ProofHash'>;
export type OfferCurrencyCode = Brand<string, 'OfferCurrencyCode'>;
export type PricePoints = Brand<number, 'PricePoints'>;
export type Score0To1 = Brand<number, 'Score0To1'>;
export type Score0To100 = Brand<number, 'Score0To100'>;
export type Probability = Brand<number, 'Probability'>;
export type BasisPoints = Brand<number, 'BasisPoints'>;

// ============================================================================
// MARK: Channel + role literals
// ============================================================================

export const NEGOTIATION_CHANNELS = [
  'DEAL_ROOM',
  'GLOBAL',
  'SYNDICATE',
  'DIRECT',
  'SPECTATOR',
  'SYSTEM_SHADOW',
  'NPC_SHADOW',
  'RIVALRY_SHADOW',
  'RESCUE_SHADOW',
  'LIVEOPS_SHADOW',
] as const;

export type NegotiationChannel = (typeof NEGOTIATION_CHANNELS)[number];

export const NEGOTIATION_ACTOR_KINDS = [
  'PLAYER',
  'NPC',
  'RIVAL',
  'HELPER',
  'SYSTEM',
  'AUDIENCE',
  'LIVEOPS',
  'OBSERVER',
] as const;

export type NegotiationActorKind = (typeof NEGOTIATION_ACTOR_KINDS)[number];

export const NEGOTIATION_PARTY_ROLES = [
  'BUYER',
  'SELLER',
  'BROKER',
  'MEDIATOR',
  'SPECTATOR',
  'AUDITOR',
  'INTERCEPTOR',
  'LEAKER',
] as const;

export type NegotiationPartyRole = (typeof NEGOTIATION_PARTY_ROLES)[number];

export const NEGOTIATION_STANCES = [
  'OPENING',
  'TESTING',
  'PRESSURING',
  'STALLING',
  'PROBING',
  'RESISTING',
  'CONCEDING',
  'COLLAPSING',
  'TRAPPING',
  'CLOSING',
  'EXITING',
] as const;

export type NegotiationStance = (typeof NEGOTIATION_STANCES)[number];

export const NEGOTIATION_PHASES = [
  'ENTRY',
  'ANCHOR',
  'SIGNAL_READ',
  'COUNTER',
  'PRESSURE',
  'WINDOW',
  'CLOSE',
  'WITNESS',
  'POSTMORTEM',
] as const;

export type NegotiationPhase = (typeof NEGOTIATION_PHASES)[number];

export const NEGOTIATION_STATUSES = [
  'DRAFT',
  'OPEN',
  'ACTIVE',
  'SOFT_LOCKED',
  'HARD_LOCKED',
  'RESOLVED',
  'FAILED',
  'ABANDONED',
  'EXPIRED',
  'LEAKED',
] as const;

export type NegotiationStatus = (typeof NEGOTIATION_STATUSES)[number];

// ============================================================================
// MARK: Pressure + intent literals
// ============================================================================

export const NEGOTIATION_INTENTS = [
  'FAIR_TRADE',
  'VALUE_EXTRACT',
  'PRICE_DISCOVERY',
  'LIQUIDATION',
  'PANIC_EXIT',
  'BAIT',
  'TRAP',
  'BLUFF',
  'DELAY',
  'FACE_SAVE',
  'REPUTATION_SIGNAL',
  'HELPER_INTERVENTION',
  'RESCUE_OVERRIDE',
] as const;

export type NegotiationIntent = (typeof NEGOTIATION_INTENTS)[number];

export const NEGOTIATION_SIGNAL_KINDS = [
  'URGENCY',
  'BLUFF',
  'FEAR',
  'OVERPAY_RISK',
  'UNDERBID_RISK',
  'PASSIVITY',
  'AGGRESSION',
  'STALL',
  'ANCHOR_FORCE',
  'LEAK_RISK',
  'REPUTATION_RISK',
  'HELPER_NEED',
  'CHURN_RISK',
  'FACE_THREAT',
  'DOMINANCE_PLAY',
  'TRUST_SIGNAL',
] as const;

export type NegotiationSignalKind = (typeof NEGOTIATION_SIGNAL_KINDS)[number];

export const NEGOTIATION_PRESSURE_SOURCES = [
  'PRICE',
  'TIME',
  'AUDIENCE',
  'RIVAL',
  'HELPER',
  'SYSTEM',
  'MEMORY',
  'PROOF',
  'LEAK',
  'RESCUE',
  'RUN_STATE',
  'LIVEOPS',
] as const;

export type NegotiationPressureSource = (typeof NEGOTIATION_PRESSURE_SOURCES)[number];

export const NEGOTIATION_CONCESSION_TYPES = [
  'PRICE',
  'TIMING',
  'VISIBILITY',
  'PAYMENT_TERMS',
  'RISK_ASSUMPTION',
  'GUARANTEE',
  'PROOF',
  'REPUTATION',
  'CHANNEL_ESCALATION',
  'EXIT_OPTION',
] as const;

export type NegotiationConcessionType = (typeof NEGOTIATION_CONCESSION_TYPES)[number];

export const NEGOTIATION_WINDOW_REASONS = [
  'OPENING_ANCHOR',
  'COUNTER_REQUIRED',
  'TIME_PRESSURE',
  'ESCALATION',
  'LEAK_THREAT',
  'HELPER_TIMEOUT',
  'RESCUE_REQUIRED',
  'LIVEOPS_SURGE',
  'REPUTATION_CHECK',
] as const;

export type NegotiationWindowReason = (typeof NEGOTIATION_WINDOW_REASONS)[number];

export const NEGOTIATION_OUTCOMES = [
  'ACCEPTED',
  'REJECTED',
  'COUNTERED',
  'WITHDRAWN',
  'TIMED_OUT',
  'LEAKED',
  'RESCUED',
  'COLLAPSED',
  'STALL_SUCCESS',
  'STALL_FAILED',
  'FACE_SAVED',
  'REPUTATION_LOSS',
] as const;

export type NegotiationOutcome = (typeof NEGOTIATION_OUTCOMES)[number];

// ============================================================================
// MARK: Core scalar structures
// ============================================================================

export interface NegotiationScoreBand {
  readonly raw: number;
  readonly normalized: Score0To1;
  readonly percentile?: Score0To100;
  readonly source: string;
  readonly computedAt: UnixMs;
}

export interface NegotiationRange {
  readonly min: number;
  readonly max: number;
  readonly preferred?: number;
}

export interface NegotiationPriceVector {
  readonly amount: PricePoints;
  readonly currency: OfferCurrencyCode;
  readonly listedAmount?: PricePoints;
  readonly floorAmount?: PricePoints;
  readonly ceilingAmount?: PricePoints;
  readonly reserveAmount?: PricePoints;
  readonly confidence?: NegotiationScoreBand;
}

export interface NegotiationTimingVector {
  readonly openedAt: UnixMs;
  readonly expiresAt?: UnixMs;
  readonly idealResponseAt?: UnixMs;
  readonly pressureStartAt?: UnixMs;
  readonly graceUntil?: UnixMs;
  readonly cooldownUntil?: UnixMs;
}

export interface NegotiationReputationVector {
  readonly current: Score0To100;
  readonly projectedDelta: number;
  readonly leakRisk: Score0To1;
  readonly faceThreat: Score0To1;
  readonly witnessHeat: Score0To1;
}

export interface NegotiationRiskVector {
  readonly overpayRisk: Score0To1;
  readonly underbidRisk: Score0To1;
  readonly churnRisk: Score0To1;
  readonly bluffLikelihood: Probability;
  readonly collapseRisk: Score0To1;
  readonly leakRisk: Score0To1;
  readonly rescueNeed: Score0To1;
}

export interface NegotiationEmotionVector {
  readonly intimidation: Score0To1;
  readonly confidence: Score0To1;
  readonly frustration: Score0To1;
  readonly curiosity: Score0To1;
  readonly attachment: Score0To1;
  readonly embarrassment: Score0To1;
  readonly relief: Score0To1;
  readonly dominance: Score0To1;
  readonly desperation: Score0To1;
  readonly trust: Score0To1;
}

export interface NegotiationChannelContext {
  readonly channel: NegotiationChannel;
  readonly roomId?: ChatRoomId;
  readonly threadId?: NegotiationThreadId;
  readonly visibleToPlayer: boolean;
  readonly visibleToAudience: boolean;
  readonly witnessPressure: Score0To1;
  readonly secrecyPressure: Score0To1;
  readonly crowdHeat?: Score0To1;
}

// ============================================================================
// MARK: Actor contracts
// ============================================================================

export interface NegotiationActorRef {
  readonly actorId: NegotiationActorId;
  readonly actorKind: NegotiationActorKind;
  readonly role: NegotiationPartyRole;
  readonly playerId?: PlayerId;
  readonly npcId?: NpcId;
  readonly displayName: string;
  readonly personaKey?: string;
  readonly voiceprintKey?: string;
  readonly allianceId?: string;
  readonly rivalryId?: string;
  readonly factionId?: string;
  readonly helperArchetype?: string;
  readonly sourceMessageId?: ChatMessageId;
}

export interface NegotiationActorState {
  readonly actor: NegotiationActorRef;
  readonly stance: NegotiationStance;
  readonly leverage: Score0To1;
  readonly patience: Score0To1;
  readonly aggression: Score0To1;
  readonly honestySignal: Score0To1;
  readonly bluffFrequency: Score0To1;
  readonly urgencySignal: Score0To1;
  readonly attachmentToOutcome: Score0To1;
  readonly walkAwayLikelihood: Score0To1;
  readonly reputation: NegotiationReputationVector;
  readonly emotion: NegotiationEmotionVector;
  readonly updatedAt: UnixMs;
}

export interface NegotiationPartyPair {
  readonly primary: NegotiationActorRef;
  readonly counterparty: NegotiationActorRef;
  readonly helper?: NegotiationActorRef;
  readonly rivalWitness?: NegotiationActorRef;
  readonly audienceWitnessCount?: number;
}

// ============================================================================
// MARK: Signal + inference contracts
// ============================================================================

export interface NegotiationSignalEvidence {
  readonly signalId: NegotiationSignalId;
  readonly kind: NegotiationSignalKind;
  readonly score: NegotiationScoreBand;
  readonly confidence: NegotiationScoreBand;
  readonly extractedFromMessageId?: ChatMessageId;
  readonly extractedFromCursor?: TranscriptCursor;
  readonly note?: string;
  readonly tags?: readonly string[];
}

export interface NegotiationPressureEdge {
  readonly source: NegotiationPressureSource;
  readonly intensity: NegotiationScoreBand;
  readonly actorId?: NegotiationActorId;
  readonly messageId?: ChatMessageId;
  readonly note?: string;
}

export interface NegotiationInferenceFrame {
  readonly negotiationId: NegotiationId;
  readonly phase: NegotiationPhase;
  readonly inferredIntent: NegotiationIntent;
  readonly alternativeIntents: readonly NegotiationIntent[];
  readonly signals: readonly NegotiationSignalEvidence[];
  readonly pressureEdges: readonly NegotiationPressureEdge[];
  readonly risk: NegotiationRiskVector;
  readonly reputation: NegotiationReputationVector;
  readonly emotionProjection: NegotiationEmotionVector;
  readonly createdAt: UnixMs;
}

export interface NegotiationLeakThreat {
  readonly leakId: NegotiationLeakId;
  readonly sourceActorId: NegotiationActorId;
  readonly targetChannel: NegotiationChannel;
  readonly severity: NegotiationScoreBand;
  readonly predictedWitnessHeat: Score0To1;
  readonly canBeContained: boolean;
  readonly note?: string;
}

export interface NegotiationMemoryAnchor {
  readonly memoryId: NegotiationMemoryId;
  readonly anchorId: NegotiationAnchorId;
  readonly kind:
    | 'PAST_OFFER'
    | 'PAST_BLUFF'
    | 'PAST_RESCUE'
    | 'PAST_COLLAPSE'
    | 'PAST_ACCEPTANCE'
    | 'PAST_REPUTATION_DAMAGE'
    | 'PAST_LEAK'
    | 'PAST_HELPER_WARNING';
  readonly salience: Score0To1;
  readonly cursor?: TranscriptCursor;
  readonly messageId?: ChatMessageId;
  readonly note: string;
}

// ============================================================================
// MARK: Offer + concession shapes
// ============================================================================

export interface NegotiationConcession {
  readonly type: NegotiationConcessionType;
  readonly magnitude: number;
  readonly describedAs?: string;
  readonly reversible: boolean;
  readonly costsReputation?: boolean;
  readonly costsUrgency?: boolean;
  readonly costsLeverage?: boolean;
}

export interface NegotiationOfferVector {
  readonly offerId: NegotiationOfferId;
  readonly label?: string;
  readonly price: NegotiationPriceVector;
  readonly valueEstimate?: NegotiationRange;
  readonly riskAdjustmentBps?: BasisPoints;
  readonly urgencyBps?: BasisPoints;
  readonly concessions?: readonly NegotiationConcession[];
  readonly intent: NegotiationIntent;
  readonly phase: NegotiationPhase;
  readonly windowId?: NegotiationWindowId;
}

export interface NegotiationCounterShape {
  readonly isCounter: boolean;
  readonly referencesOfferId?: NegotiationOfferId;
  readonly counterDistance: Score0To1;
  readonly hardReversal: boolean;
  readonly softLanding: boolean;
  readonly faceSaving: boolean;
}

export interface NegotiationOfferEnvelope {
  readonly negotiationId: NegotiationId;
  readonly sceneId?: NegotiationSceneId;
  readonly threadId: NegotiationThreadId;
  readonly offeredBy: NegotiationActorRef;
  readonly offeredTo: NegotiationActorRef;
  readonly vector: NegotiationOfferVector;
  readonly counterShape?: NegotiationCounterShape;
  readonly channelContext: NegotiationChannelContext;
  readonly inference?: NegotiationInferenceFrame;
  readonly createdAt: UnixMs;
}

export interface NegotiationWindow {
  readonly windowId: NegotiationWindowId;
  readonly reason: NegotiationWindowReason;
  readonly channel: NegotiationChannel;
  readonly openedAt: UnixMs;
  readonly closesAt: UnixMs;
  readonly graceUntil?: UnixMs;
  readonly hardStopAt?: UnixMs;
  readonly preferredResponseBand?: NegotiationRange;
  readonly permitsSilence: boolean;
  readonly helperEligibleAt?: UnixMs;
  readonly rescueEligibleAt?: UnixMs;
  readonly leakEligibleAt?: UnixMs;
}

// ============================================================================
// MARK: Transcript-safe scene contracts
// ============================================================================

export interface NegotiationSceneBeat {
  readonly beatId: string;
  readonly phase: NegotiationPhase;
  readonly description: string;
  readonly actorId?: NegotiationActorId;
  readonly messageId?: ChatMessageId;
  readonly witnessHeat?: Score0To1;
  readonly silenceBeforeMs?: number;
  readonly silenceAfterMs?: number;
}

export interface NegotiationSceneState {
  readonly sceneId: NegotiationSceneId;
  readonly negotiationId: NegotiationId;
  readonly status: NegotiationStatus;
  readonly activeWindow?: NegotiationWindow;
  readonly partyPair: NegotiationPartyPair;
  readonly channelContext: NegotiationChannelContext;
  readonly beats: readonly NegotiationSceneBeat[];
  readonly currentOffer?: NegotiationOfferEnvelope;
  readonly currentInference?: NegotiationInferenceFrame;
  readonly memoryAnchors?: readonly NegotiationMemoryAnchor[];
  readonly leakThreat?: NegotiationLeakThreat;
  readonly openedAt: UnixMs;
  readonly updatedAt: UnixMs;
}

// ============================================================================
// MARK: Resolution + reward contracts
// ============================================================================

export interface NegotiationRewardProjection {
  readonly rewardId?: NegotiationRewardId;
  readonly grantsTitle?: string;
  readonly grantsAura?: string;
  readonly grantsLegendMoment?: boolean;
  readonly projectedReputationDelta: number;
  readonly projectedAudienceHeatDelta: number;
}

export interface NegotiationResolution {
  readonly negotiationId: NegotiationId;
  readonly outcome: NegotiationOutcome;
  readonly winningActorId?: NegotiationActorId;
  readonly acceptedOfferId?: NegotiationOfferId;
  readonly finalPrice?: NegotiationPriceVector;
  readonly finalConcessions?: readonly NegotiationConcession[];
  readonly reputationDeltaByActor: Readonly<Record<string, number>>;
  readonly pressureRelief: Score0To1;
  readonly leakOccurred: boolean;
  readonly rescueOccurred: boolean;
  readonly proofId?: NegotiationProofId;
  readonly rewardProjection?: NegotiationRewardProjection;
  readonly resolvedAt: UnixMs;
}

export interface NegotiationProofEnvelope {
  readonly proofId: NegotiationProofId;
  readonly negotiationId: NegotiationId;
  readonly proofHash: ProofHash;
  readonly runId?: RunId;
  readonly sessionId?: SessionId;
  readonly matchId?: MatchId;
  readonly generatedAt: UnixMs;
  readonly sourceOfferId?: NegotiationOfferId;
  readonly sourceWindowId?: NegotiationWindowId;
  readonly notes?: readonly string[];
}

// ============================================================================
// MARK: Root lifecycle contract
// ============================================================================

export interface ChatNegotiation {
  readonly negotiationId: NegotiationId;
  readonly threadId: NegotiationThreadId;
  readonly status: NegotiationStatus;
  readonly phase: NegotiationPhase;
  readonly parties: NegotiationPartyPair;
  readonly primaryChannel: NegotiationChannel;
  readonly actorStates: readonly NegotiationActorState[];
  readonly scene: NegotiationSceneState;
  readonly activeOffer?: NegotiationOfferEnvelope;
  readonly activeWindow?: NegotiationWindow;
  readonly latestInference?: NegotiationInferenceFrame;
  readonly latestResolution?: NegotiationResolution;
  readonly memories?: readonly NegotiationMemoryAnchor[];
  readonly leakThreats?: readonly NegotiationLeakThreat[];
  readonly createdAt: UnixMs;
  readonly updatedAt: UnixMs;
}

// ============================================================================
// MARK: Patch contracts
// ============================================================================

export interface ChatNegotiationPatch {
  readonly negotiationId: NegotiationId;
  readonly phase?: NegotiationPhase;
  readonly status?: NegotiationStatus;
  readonly activeOffer?: NegotiationOfferEnvelope | null;
  readonly activeWindow?: NegotiationWindow | null;
  readonly latestInference?: NegotiationInferenceFrame | null;
  readonly latestResolution?: NegotiationResolution | null;
  readonly appendedBeats?: readonly NegotiationSceneBeat[];
  readonly actorStatePatches?: readonly NegotiationActorState[];
  readonly appendedMemories?: readonly NegotiationMemoryAnchor[];
  readonly appendedLeakThreats?: readonly NegotiationLeakThreat[];
  readonly updatedAt: UnixMs;
}

// ============================================================================
// MARK: Type guards
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

export function isNegotiationChannel(value: unknown): value is NegotiationChannel {
  return hasLiteral(value, NEGOTIATION_CHANNELS);
}

export function isNegotiationActorKind(value: unknown): value is NegotiationActorKind {
  return hasLiteral(value, NEGOTIATION_ACTOR_KINDS);
}

export function isNegotiationPartyRole(value: unknown): value is NegotiationPartyRole {
  return hasLiteral(value, NEGOTIATION_PARTY_ROLES);
}

export function isNegotiationStance(value: unknown): value is NegotiationStance {
  return hasLiteral(value, NEGOTIATION_STANCES);
}

export function isNegotiationPhase(value: unknown): value is NegotiationPhase {
  return hasLiteral(value, NEGOTIATION_PHASES);
}

export function isNegotiationStatus(value: unknown): value is NegotiationStatus {
  return hasLiteral(value, NEGOTIATION_STATUSES);
}

export function isNegotiationIntent(value: unknown): value is NegotiationIntent {
  return hasLiteral(value, NEGOTIATION_INTENTS);
}

export function isNegotiationSignalKind(value: unknown): value is NegotiationSignalKind {
  return hasLiteral(value, NEGOTIATION_SIGNAL_KINDS);
}

export function isNegotiationPressureSource(value: unknown): value is NegotiationPressureSource {
  return hasLiteral(value, NEGOTIATION_PRESSURE_SOURCES);
}

export function isNegotiationConcessionType(value: unknown): value is NegotiationConcessionType {
  return hasLiteral(value, NEGOTIATION_CONCESSION_TYPES);
}

export function isNegotiationWindowReason(value: unknown): value is NegotiationWindowReason {
  return hasLiteral(value, NEGOTIATION_WINDOW_REASONS);
}

export function isNegotiationOutcome(value: unknown): value is NegotiationOutcome {
  return hasLiteral(value, NEGOTIATION_OUTCOMES);
}

export function isNegotiationScoreBand(value: unknown): value is NegotiationScoreBand {
  return (
    isObject(value) &&
    isNumber(value.raw) &&
    isNumber(value.normalized) &&
    isString(value.source) &&
    isNumber(value.computedAt)
  );
}

export function isNegotiationPriceVector(value: unknown): value is NegotiationPriceVector {
  return isObject(value) && isNumber(value.amount) && isString(value.currency);
}

export function isNegotiationActorRef(value: unknown): value is NegotiationActorRef {
  return (
    isObject(value) &&
    isString(value.actorId) &&
    isNegotiationActorKind(value.actorKind) &&
    isNegotiationPartyRole(value.role) &&
    isString(value.displayName)
  );
}

export function isNegotiationActorState(value: unknown): value is NegotiationActorState {
  return (
    isObject(value) &&
    isNegotiationActorRef(value.actor) &&
    isNegotiationStance(value.stance) &&
    isNumber(value.leverage) &&
    isNumber(value.patience) &&
    isNumber(value.aggression) &&
    isNumber(value.updatedAt)
  );
}

export function isNegotiationSignalEvidence(value: unknown): value is NegotiationSignalEvidence {
  return (
    isObject(value) &&
    isString(value.signalId) &&
    isNegotiationSignalKind(value.kind) &&
    isNegotiationScoreBand(value.score) &&
    isNegotiationScoreBand(value.confidence)
  );
}

export function isNegotiationPressureEdge(value: unknown): value is NegotiationPressureEdge {
  return (
    isObject(value) &&
    isNegotiationPressureSource(value.source) &&
    isNegotiationScoreBand(value.intensity)
  );
}

export function isNegotiationInferenceFrame(value: unknown): value is NegotiationInferenceFrame {
  return (
    isObject(value) &&
    isString(value.negotiationId) &&
    isNegotiationPhase(value.phase) &&
    isNegotiationIntent(value.inferredIntent) &&
    Array.isArray(value.alternativeIntents) &&
    Array.isArray(value.signals) &&
    Array.isArray(value.pressureEdges) &&
    isNumber(value.createdAt)
  );
}

export function isNegotiationConcession(value: unknown): value is NegotiationConcession {
  return (
    isObject(value) &&
    isNegotiationConcessionType(value.type) &&
    isNumber(value.magnitude) &&
    typeof value.reversible === 'boolean'
  );
}

export function isNegotiationOfferVector(value: unknown): value is NegotiationOfferVector {
  return (
    isObject(value) &&
    isString(value.offerId) &&
    isNegotiationPriceVector(value.price) &&
    isNegotiationIntent(value.intent) &&
    isNegotiationPhase(value.phase)
  );
}

export function isNegotiationCounterShape(value: unknown): value is NegotiationCounterShape {
  return (
    isObject(value) &&
    typeof value.isCounter === 'boolean' &&
    isNumber(value.counterDistance) &&
    typeof value.hardReversal === 'boolean' &&
    typeof value.softLanding === 'boolean' &&
    typeof value.faceSaving === 'boolean'
  );
}

export function isNegotiationOfferEnvelope(value: unknown): value is NegotiationOfferEnvelope {
  return (
    isObject(value) &&
    isString(value.negotiationId) &&
    isString(value.threadId) &&
    isNegotiationActorRef(value.offeredBy) &&
    isNegotiationActorRef(value.offeredTo) &&
    isNegotiationOfferVector(value.vector) &&
    isObject(value.channelContext) &&
    isNumber(value.createdAt)
  );
}

export function isNegotiationWindow(value: unknown): value is NegotiationWindow {
  return (
    isObject(value) &&
    isString(value.windowId) &&
    isNegotiationWindowReason(value.reason) &&
    isNegotiationChannel(value.channel) &&
    isNumber(value.openedAt) &&
    isNumber(value.closesAt) &&
    typeof value.permitsSilence === 'boolean'
  );
}

export function isNegotiationSceneBeat(value: unknown): value is NegotiationSceneBeat {
  return (
    isObject(value) &&
    isString(value.beatId) &&
    isNegotiationPhase(value.phase) &&
    isString(value.description)
  );
}

export function isNegotiationSceneState(value: unknown): value is NegotiationSceneState {
  return (
    isObject(value) &&
    isString(value.sceneId) &&
    isString(value.negotiationId) &&
    isNegotiationStatus(value.status) &&
    isObject(value.partyPair) &&
    isObject(value.channelContext) &&
    Array.isArray(value.beats) &&
    isNumber(value.openedAt) &&
    isNumber(value.updatedAt)
  );
}

export function isNegotiationResolution(value: unknown): value is NegotiationResolution {
  return (
    isObject(value) &&
    isString(value.negotiationId) &&
    isNegotiationOutcome(value.outcome) &&
    isObject(value.reputationDeltaByActor) &&
    isNumber(value.pressureRelief) &&
    typeof value.leakOccurred === 'boolean' &&
    typeof value.rescueOccurred === 'boolean' &&
    isNumber(value.resolvedAt)
  );
}

export function isChatNegotiation(value: unknown): value is ChatNegotiation {
  return (
    isObject(value) &&
    isString(value.negotiationId) &&
    isString(value.threadId) &&
    isNegotiationStatus(value.status) &&
    isNegotiationPhase(value.phase) &&
    isObject(value.parties) &&
    isNegotiationChannel(value.primaryChannel) &&
    Array.isArray(value.actorStates) &&
    isNegotiationSceneState(value.scene) &&
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

export function asNegotiationId(value: string): NegotiationId {
  return value as NegotiationId;
}

export function asNegotiationThreadId(value: string): NegotiationThreadId {
  return value as NegotiationThreadId;
}

export function asNegotiationOfferId(value: string): NegotiationOfferId {
  return value as NegotiationOfferId;
}

export function asNegotiationWindowId(value: string): NegotiationWindowId {
  return value as NegotiationWindowId;
}

export function asNegotiationActorId(value: string): NegotiationActorId {
  return value as NegotiationActorId;
}

export function asCurrencyCode(value: string): OfferCurrencyCode {
  return value as OfferCurrencyCode;
}

export function asPricePoints(value: number): PricePoints {
  return value as PricePoints;
}

export function asProbability(value: number): Probability {
  return value as Probability;
}

export function asScore0To1(value: number): Score0To1 {
  return value as Score0To1;
}

export function asScore0To100(value: number): Score0To100 {
  return value as Score0To100;
}

export function asBasisPoints(value: number): BasisPoints {
  return value as BasisPoints;
}

export function createNegotiationScoreBand(
  raw: number,
  normalized: number,
  source: string,
  computedAt: number,
  percentile?: number,
): NegotiationScoreBand {
  return {
    raw,
    normalized: asScore0To1(normalized),
    percentile: percentile === undefined ? undefined : asScore0To100(percentile),
    source,
    computedAt: asUnixMs(computedAt),
  };
}

export function createNegotiationPriceVector(
  amount: number,
  currency: string,
  opts: Partial<Omit<NegotiationPriceVector, 'amount' | 'currency'>> = {},
): NegotiationPriceVector {
  return {
    amount: asPricePoints(amount),
    currency: asCurrencyCode(currency),
    ...opts,
  };
}

export function createNegotiationWindow(
  reason: NegotiationWindowReason,
  channel: NegotiationChannel,
  openedAt: number,
  closesAt: number,
  opts: Partial<Omit<NegotiationWindow, 'windowId' | 'reason' | 'channel' | 'openedAt' | 'closesAt' | 'permitsSilence'>> & {
    windowId?: string;
    permitsSilence?: boolean;
  } = {},
): NegotiationWindow {
  return {
    windowId: asNegotiationWindowId(opts.windowId ?? `neg-window:${reason}:${openedAt}`),
    reason,
    channel,
    openedAt: asUnixMs(openedAt),
    closesAt: asUnixMs(closesAt),
    permitsSilence: opts.permitsSilence ?? false,
    graceUntil: opts.graceUntil,
    hardStopAt: opts.hardStopAt,
    preferredResponseBand: opts.preferredResponseBand,
    helperEligibleAt: opts.helperEligibleAt,
    rescueEligibleAt: opts.rescueEligibleAt,
    leakEligibleAt: opts.leakEligibleAt,
  };
}

// ============================================================================
// MARK: Derived helpers
// ============================================================================

export function negotiationWindowDurationMs(window: NegotiationWindow): number {
  return Math.max(0, Number(window.closesAt) - Number(window.openedAt));
}

export function negotiationWindowHasExpired(window: NegotiationWindow, now: UnixMs): boolean {
  return Number(now) > Number(window.closesAt);
}

export function negotiationWindowIsInGrace(window: NegotiationWindow, now: UnixMs): boolean {
  return window.graceUntil !== undefined && Number(now) <= Number(window.graceUntil);
}

export function negotiationResolutionImprovedReputation(
  resolution: NegotiationResolution,
  actorId: NegotiationActorId,
): boolean {
  return (resolution.reputationDeltaByActor[String(actorId)] ?? 0) > 0;
}

export function negotiationResolutionDamagedReputation(
  resolution: NegotiationResolution,
  actorId: NegotiationActorId,
): boolean {
  return (resolution.reputationDeltaByActor[String(actorId)] ?? 0) < 0;
}

export function negotiationIsLive(negotiation: ChatNegotiation): boolean {
  return (
    negotiation.status === 'OPEN' ||
    negotiation.status === 'ACTIVE' ||
    negotiation.status === 'SOFT_LOCKED' ||
    negotiation.status === 'HARD_LOCKED'
  );
}

export function negotiationSupportsRescue(negotiation: ChatNegotiation): boolean {
  return (
    negotiation.primaryChannel === 'DEAL_ROOM' ||
    negotiation.primaryChannel === 'DIRECT' ||
    negotiation.primaryChannel === 'RESCUE_SHADOW'
  );
}

export function negotiationHasLeakThreat(negotiation: ChatNegotiation): boolean {
  return Array.isArray(negotiation.leakThreats) && negotiation.leakThreats.length > 0;
}

export function negotiationHasAudiencePressure(negotiation: ChatNegotiation): boolean {
  return Number(negotiation.scene.channelContext.witnessPressure ?? 0) >= 0.5;
}

export function negotiationPrimaryActorState(
  negotiation: ChatNegotiation,
  actorId: NegotiationActorId,
): NegotiationActorState | undefined {
  return negotiation.actorStates.find((state) => state.actor.actorId === actorId);
}

export function negotiationLatestOfferId(
  negotiation: ChatNegotiation,
): NegotiationOfferId | undefined {
  return negotiation.activeOffer?.vector.offerId;
}

export function negotiationSupportsLegendReward(
  resolution?: NegotiationResolution | null,
): boolean {
  return Boolean(resolution?.rewardProjection?.grantsLegendMoment);
}

export function negotiationInferDominantPressure(
  inference?: NegotiationInferenceFrame | null,
): NegotiationPressureSource | undefined {
  if (!inference || inference.pressureEdges.length === 0) {
    return undefined;
  }
  return [...inference.pressureEdges]
    .sort((a, b) => Number(b.intensity.normalized) - Number(a.intensity.normalized))[0]?.source;
}

export function negotiationShouldLeak(
  leakThreat?: NegotiationLeakThreat | null,
): boolean {
  return Boolean(leakThreat && Number(leakThreat.severity.normalized) >= 0.75 && !leakThreat.canBeContained);
}

// ============================================================================
// MARK: Registry metadata
// ============================================================================

export const CHAT_NEGOTIATION_MODULE_ID = 'shared/contracts/chat/ChatNegotiation' as const;
export const CHAT_NEGOTIATION_MODULE_CATEGORY = 'NEGOTIATION' as const;
export const CHAT_NEGOTIATION_FILE_BASENAME = 'ChatNegotiation.ts' as const;

export const ChatNegotiationModule = {
  id: CHAT_NEGOTIATION_MODULE_ID,
  category: CHAT_NEGOTIATION_MODULE_CATEGORY,
  file: CHAT_NEGOTIATION_FILE_BASENAME,
  channels: NEGOTIATION_CHANNELS,
  actorKinds: NEGOTIATION_ACTOR_KINDS,
  partyRoles: NEGOTIATION_PARTY_ROLES,
  stances: NEGOTIATION_STANCES,
  phases: NEGOTIATION_PHASES,
  statuses: NEGOTIATION_STATUSES,
  intents: NEGOTIATION_INTENTS,
  signals: NEGOTIATION_SIGNAL_KINDS,
  pressureSources: NEGOTIATION_PRESSURE_SOURCES,
  concessionTypes: NEGOTIATION_CONCESSION_TYPES,
  windowReasons: NEGOTIATION_WINDOW_REASONS,
  outcomes: NEGOTIATION_OUTCOMES,
} as const;

export default ChatNegotiationModule;
