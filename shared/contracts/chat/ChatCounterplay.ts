/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT COUNTERPLAY CONTRACTS
 * FILE: shared/contracts/chat/ChatCounterplay.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared contract surface for language-as-defense in the chat stack.
 *
 * In this repo, some hostile messages are not merely cosmetic. They are
 * pressure events, telegraphs, traps, humiliation attempts, negotiation
 * squeezes, or momentum swings that should open real counter windows.
 *
 * This file defines the shared grammar for:
 * - counter windows,
 * - counter candidates,
 * - authored and inferred reply moves,
 * - timing and read-pressure interplay,
 * - proof-backed reversals,
 * - bluff punishment,
 * - helper-assisted recovery counters,
 * - prestige-grade defensive receipts,
 * - and backend/frontend/server agreement on what "a successful counter"
 *   actually means.
 *
 * Design laws
 * -----------
 * 1. Counterplay is not generic replying. It is a playable response surface.
 * 2. Counters can be silent, visible, social, evidentiary, or economic.
 * 3. Timing matters as much as wording.
 * 4. A counter can defend, reverse, bait, expose, stall, rescue, or close.
 * 5. Counterplay must be scoreable without requiring text generation.
 * 6. Every helper in this file is deterministic and side-effect free.
 * 7. This file must compose with existing scene, relationship, moment,
 *    memory, and message contracts without flattening them.
 * ============================================================================
 */

import type {
  Brand,
  ChatActorKind,
  ChatChannelId,
  ChatDeliveryPriority,
  ChatInterventionId,
  ChatMemoryAnchorId,
  ChatMessageId,
  ChatMomentId,
  ChatNpcId,
  ChatProofHash,
  ChatRelationshipId,
  ChatReplayId,
  ChatRequestId,
  ChatRoomId,
  ChatSceneId,
  ChatSessionId,
  ChatUserId,
  JsonObject,
  Score01,
  Score100,
  TickNumber,
  UnixMs,
} from './ChatChannels';
import {
  CHAT_CONTRACT_AUTHORITIES,
  CHAT_CONTRACT_VERSION,
} from './ChatChannels';

import type {
  ChatAffectSnapshot,
  ChatAttackType,
  ChatPressureTier,
  ChatReputationState,
} from './ChatEvents';

import type {
  ChatMessageToneBand,
  ChatQuoteReference,
} from './ChatMessage';

import type { EpisodicMemoryEventType } from './memory';

import type {
  ChatRelationshipCounterpartKind,
  ChatRelationshipObjective,
  ChatRelationshipStance,
} from './relationship';

import type {
  SharedChatMomentType,
  SharedChatSceneArchetype,
  SharedChatSceneRole,
} from './scene';

// ============================================================================
// MARK: Contract metadata
// ============================================================================

export const CHAT_COUNTERPLAY_CONTRACT_VERSION = '2026-03-19.1' as const;
export const CHAT_COUNTERPLAY_CONTRACT_REVISION = 1 as const;
export const CHAT_COUNTERPLAY_PUBLIC_API_VERSION = 'v1' as const;

export const CHAT_COUNTERPLAY_AUTHORITIES = Object.freeze({
  ...CHAT_CONTRACT_AUTHORITIES,
  sharedContractFile: '/shared/contracts/chat/ChatCounterplay.ts',
  frontendCounterplayRoot: '/pzo-web/src/engines/chat/combat',
  backendCounterplayRoot: '/backend/src/game/engine/chat/combat',
  serverCounterplayRoot: '/pzo-server/src/chat',
} as const);

// ============================================================================
// MARK: Branded identifiers
// ============================================================================

export type ChatCounterplayId = Brand<string, 'ChatCounterplayId'>;
export type ChatCounterWindowId = Brand<string, 'ChatCounterWindowId'>;
export type ChatCounterMoveId = Brand<string, 'ChatCounterMoveId'>;
export type ChatCounterRuleId = Brand<string, 'ChatCounterRuleId'>;
export type ChatCounterSequenceId = Brand<string, 'ChatCounterSequenceId'>;
export type ChatCounterLedgerId = Brand<string, 'ChatCounterLedgerId'>;
export type ChatCounterTemplateId = Brand<string, 'ChatCounterTemplateId'>;
export type ChatCounterReceiptId = Brand<string, 'ChatCounterReceiptId'>;
export type ChatCounterSignalId = Brand<string, 'ChatCounterSignalId'>;
export type ChatCounterCardId = Brand<string, 'ChatCounterCardId'>;
export type ChatCounterPatternId = Brand<string, 'ChatCounterPatternId'>;

// ============================================================================
// MARK: Core discriminants
// ============================================================================

export const CHAT_COUNTERPLAY_KINDS = [
  'DIRECT_DEFENSE',
  'SILENT_ABSORB',
  'PROOF_SPIKE',
  'QUOTE_TURN',
  'BLUFF_CALL',
  'STALL_BREAK',
  'PRESSURE_REDIRECT',
  'HUMILIATION_REVERSAL',
  'NEGOTIATION_ESCAPE',
  'NEGOTIATION_REPRICE',
  'HELPER_ASSIST',
  'CROWD_REFRAME',
  'SHIELD_STABILIZE',
  'EXIT_WINDOW',
  'LEGEND_COUNTER',
] as const;
export type ChatCounterplayKind = (typeof CHAT_COUNTERPLAY_KINDS)[number];

export const CHAT_COUNTER_INTENTS = [
  'DEFEND',
  'REVERSE',
  'EXPOSE',
  'BAIT',
  'STALL',
  'ESCAPE',
  'REPRICE',
  'RESCUE',
  'MASK',
  'HYPE',
  'QUIET_RESET',
  'CLOSE',
] as const;
export type ChatCounterIntent = (typeof CHAT_COUNTER_INTENTS)[number];

export const CHAT_COUNTER_TIMING_CLASSES = [
  'INSTANT',
  'FAST',
  'BEAT_LOCKED',
  'READ_PRESSURE_DELAYED',
  'LATE_BUT_VALID',
  'POST_SCENE',
  'SHADOW_ONLY',
] as const;
export type ChatCounterTimingClass = (typeof CHAT_COUNTER_TIMING_CLASSES)[number];

export const CHAT_COUNTER_EXECUTION_MODES = [
  'PLAYER_TYPED',
  'PLAYER_SELECTED',
  'AUTO_SUGGESTED',
  'HELPER_ASSISTED',
  'SYSTEM_GUIDED',
  'SERVER_FORCED_CLOSE',
  'SHADOW_STAGED',
] as const;
export type ChatCounterExecutionMode = (typeof CHAT_COUNTER_EXECUTION_MODES)[number];

export const CHAT_COUNTER_EFFICACY_BANDS = [
  'WHIFF',
  'GLANCING',
  'STABLE',
  'STRONG',
  'DOMINANT',
  'LEGENDARY',
] as const;
export type ChatCounterEfficacyBand = (typeof CHAT_COUNTER_EFFICACY_BANDS)[number];

export const CHAT_COUNTER_RISK_BANDS = [
  'SAFE',
  'MEASURED',
  'VOLATILE',
  'DANGEROUS',
  'SUICIDAL',
] as const;
export type ChatCounterRiskBand = (typeof CHAT_COUNTER_RISK_BANDS)[number];

export const CHAT_COUNTER_VALIDATION_STATUSES = [
  'UNVALIDATED',
  'WINDOW_OPEN',
  'WINDOW_CLOSED',
  'REQUIRES_PROOF',
  'REQUIRES_QUOTE',
  'REQUIRES_TIMING',
  'REQUIRES_SILENCE',
  'BLOCKED_BY_POLICY',
  'AUTHORITATIVE_REJECT',
  'AUTHORITATIVE_ACCEPT',
] as const;
export type ChatCounterValidationStatus =
  (typeof CHAT_COUNTER_VALIDATION_STATUSES)[number];

export const CHAT_COUNTER_SURFACES = [
  'COMPOSER',
  'QUICK_REPLY',
  'PROOF_CARD',
  'DEAL_ROOM_ACTION',
  'HELPER_BANNER',
  'SHADOW_QUEUE',
  'POST_RUN_REPLAY',
] as const;
export type ChatCounterSurface = (typeof CHAT_COUNTER_SURFACES)[number];

export const CHAT_COUNTER_RECEIPT_CLASSES = [
  'NONE',
  'VISIBLE_RECEIPT',
  'SHADOW_RECEIPT',
  'PROOF_RECEIPT',
  'REPUTATION_RECEIPT',
  'LEGEND_RECEIPT',
] as const;
export type ChatCounterReceiptClass = (typeof CHAT_COUNTER_RECEIPT_CLASSES)[number];

export const CHAT_COUNTER_FAILURE_REASONS = [
  'NO_ACTIVE_WINDOW',
  'WRONG_CHANNEL',
  'WRONG_TARGET',
  'TOO_EARLY',
  'TOO_LATE',
  'LOW_CONFIDENCE',
  'INSUFFICIENT_PROOF',
  'QUOTE_MISMATCH',
  'ATTACK_ALREADY_LANDED',
  'PLAYER_INTERRUPTED_SELF',
  'HELPER_SUPPRESSED',
  'SYSTEM_LOCKOUT',
] as const;
export type ChatCounterFailureReason = (typeof CHAT_COUNTER_FAILURE_REASONS)[number];

// ============================================================================
// MARK: Archetype descriptors
// ============================================================================

export interface ChatCounterArchetypeDescriptor {
  readonly patternId: ChatCounterPatternId;
  readonly label: string;
  readonly kind: ChatCounterplayKind;
  readonly primaryIntent: ChatCounterIntent;
  readonly defaultRiskBand: ChatCounterRiskBand;
  readonly defaultReceiptClass: ChatCounterReceiptClass;
  readonly preferredExecutionModes: readonly ChatCounterExecutionMode[];
  readonly preferredSurfaces: readonly ChatCounterSurface[];
  readonly requiresVisibleReply: boolean;
  readonly canUseSilence: boolean;
  readonly proofWeighted: boolean;
  readonly quoteWeighted: boolean;
  readonly rescueCompatible: boolean;
  readonly negotiationCompatible: boolean;
  readonly legendEligible: boolean;
  readonly notes: readonly string[];
}

export const CHAT_COUNTERPLAY_ARCHETYPES = Object.freeze([
  {
    patternId: 'pattern.direct.defense' as ChatCounterPatternId,
    label: 'Direct Defense',
    kind: 'DIRECT_DEFENSE',
    primaryIntent: 'DEFEND',
    defaultRiskBand: 'MEASURED',
    defaultReceiptClass: 'VISIBLE_RECEIPT',
    preferredExecutionModes: ['PLAYER_TYPED', 'PLAYER_SELECTED'],
    preferredSurfaces: ['COMPOSER', 'QUICK_REPLY'],
    requiresVisibleReply: true,
    canUseSilence: false,
    proofWeighted: false,
    quoteWeighted: false,
    rescueCompatible: true,
    negotiationCompatible: false,
    legendEligible: false,
    notes: ['Baseline defensive reply window.', 'Good when player confidence is stable.'],
  },
  {
    patternId: 'pattern.quote.turn' as ChatCounterPatternId,
    label: 'Quote Turn',
    kind: 'QUOTE_TURN',
    primaryIntent: 'REVERSE',
    defaultRiskBand: 'VOLATILE',
    defaultReceiptClass: 'VISIBLE_RECEIPT',
    preferredExecutionModes: ['PLAYER_TYPED', 'PLAYER_SELECTED', 'AUTO_SUGGESTED'],
    preferredSurfaces: ['COMPOSER', 'QUICK_REPLY', 'POST_RUN_REPLAY'],
    requiresVisibleReply: true,
    canUseSilence: false,
    proofWeighted: false,
    quoteWeighted: true,
    rescueCompatible: false,
    negotiationCompatible: true,
    legendEligible: true,
    notes: ['Turns the opponent’s earlier boast against them.', 'High humiliation swing.'],
  },
  {
    patternId: 'pattern.proof.spike' as ChatCounterPatternId,
    label: 'Proof Spike',
    kind: 'PROOF_SPIKE',
    primaryIntent: 'EXPOSE',
    defaultRiskBand: 'SAFE',
    defaultReceiptClass: 'PROOF_RECEIPT',
    preferredExecutionModes: ['PLAYER_SELECTED', 'AUTO_SUGGESTED', 'SYSTEM_GUIDED'],
    preferredSurfaces: ['PROOF_CARD', 'QUICK_REPLY', 'COMPOSER'],
    requiresVisibleReply: true,
    canUseSilence: false,
    proofWeighted: true,
    quoteWeighted: false,
    rescueCompatible: false,
    negotiationCompatible: true,
    legendEligible: true,
    notes: ['Strong against bluffing, predatory repricing, and public humiliation attempts.'],
  },
  {
    patternId: 'pattern.silent.absorb' as ChatCounterPatternId,
    label: 'Silent Absorb',
    kind: 'SILENT_ABSORB',
    primaryIntent: 'QUIET_RESET',
    defaultRiskBand: 'SAFE',
    defaultReceiptClass: 'SHADOW_RECEIPT',
    preferredExecutionModes: ['PLAYER_SELECTED', 'SHADOW_STAGED'],
    preferredSurfaces: ['SHADOW_QUEUE', 'HELPER_BANNER'],
    requiresVisibleReply: false,
    canUseSilence: true,
    proofWeighted: false,
    quoteWeighted: false,
    rescueCompatible: true,
    negotiationCompatible: true,
    legendEligible: false,
    notes: ['Used when silence outperforms visible engagement.', 'Pairs with delayed reveal windows.'],
  },
  {
    patternId: 'pattern.negotiation.reprice' as ChatCounterPatternId,
    label: 'Negotiation Reprice',
    kind: 'NEGOTIATION_REPRICE',
    primaryIntent: 'REPRICE',
    defaultRiskBand: 'MEASURED',
    defaultReceiptClass: 'REPUTATION_RECEIPT',
    preferredExecutionModes: ['PLAYER_TYPED', 'PLAYER_SELECTED', 'AUTO_SUGGESTED'],
    preferredSurfaces: ['DEAL_ROOM_ACTION', 'COMPOSER'],
    requiresVisibleReply: true,
    canUseSilence: false,
    proofWeighted: true,
    quoteWeighted: true,
    rescueCompatible: false,
    negotiationCompatible: true,
    legendEligible: false,
    notes: ['Turns urgency back onto the counterparty.', 'Best inside DEAL_ROOM pressure lanes.'],
  },
  {
    patternId: 'pattern.helper.assist' as ChatCounterPatternId,
    label: 'Helper Assist',
    kind: 'HELPER_ASSIST',
    primaryIntent: 'RESCUE',
    defaultRiskBand: 'SAFE',
    defaultReceiptClass: 'VISIBLE_RECEIPT',
    preferredExecutionModes: ['HELPER_ASSISTED', 'SYSTEM_GUIDED'],
    preferredSurfaces: ['HELPER_BANNER', 'QUICK_REPLY'],
    requiresVisibleReply: true,
    canUseSilence: true,
    proofWeighted: false,
    quoteWeighted: false,
    rescueCompatible: true,
    negotiationCompatible: false,
    legendEligible: false,
    notes: ['Rapid stabilization move for churn-risk or collapse windows.'],
  },
  {
    patternId: 'pattern.legend.counter' as ChatCounterPatternId,
    label: 'Legend Counter',
    kind: 'LEGEND_COUNTER',
    primaryIntent: 'CLOSE',
    defaultRiskBand: 'DANGEROUS',
    defaultReceiptClass: 'LEGEND_RECEIPT',
    preferredExecutionModes: ['PLAYER_TYPED', 'PLAYER_SELECTED'],
    preferredSurfaces: ['COMPOSER', 'QUICK_REPLY', 'POST_RUN_REPLAY'],
    requiresVisibleReply: true,
    canUseSilence: false,
    proofWeighted: true,
    quoteWeighted: true,
    rescueCompatible: false,
    negotiationCompatible: true,
    legendEligible: true,
    notes: ['Reserved for humiliating reversal, perfect defense, or final boss-turn denial.'],
  },
] as const satisfies readonly ChatCounterArchetypeDescriptor[]);

// ============================================================================
// MARK: Core snapshots and context
// ============================================================================

export interface ChatCounterActorSnapshot {
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly userId?: ChatUserId | null;
  readonly npcId?: ChatNpcId | null;
  readonly relationshipId?: ChatRelationshipId | null;
  readonly counterpartKind?: ChatRelationshipCounterpartKind | null;
  readonly stanceHint?: ChatRelationshipStance | null;
  readonly objectiveHint?: ChatRelationshipObjective | null;
  readonly confidenceScore?: Score100 | null;
  readonly intimidationScore?: Score100 | null;
  readonly embarrassmentScore?: Score100 | null;
}

export interface ChatCounterWindow {
  readonly windowId: ChatCounterWindowId;
  readonly roomId: ChatRoomId;
  readonly sessionId?: ChatSessionId | null;
  readonly requestId?: ChatRequestId | null;
  readonly channelId: ChatChannelId;
  readonly sourceMessageId?: ChatMessageId | null;
  readonly sourceMomentId?: ChatMomentId | null;
  readonly sourceSceneId?: ChatSceneId | null;
  readonly sourceTick?: TickNumber | null;
  readonly sourceAttackType?: ChatAttackType | null;
  readonly sourceMomentType?: SharedChatMomentType | null;
  readonly sourceSceneArchetype?: SharedChatSceneArchetype | null;
  readonly sourceSceneRole?: SharedChatSceneRole | null;
  readonly targetActor: ChatCounterActorSnapshot;
  readonly openedAt: UnixMs;
  readonly closesAt: UnixMs;
  readonly idealResponseAt?: UnixMs | null;
  readonly timingClass: ChatCounterTimingClass;
  readonly validationStatus: ChatCounterValidationStatus;
  readonly preferredDeliveryPriority: ChatDeliveryPriority;
  readonly playerVisible: boolean;
  readonly requiresVisibleReply: boolean;
  readonly allowsSilence: boolean;
  readonly allowsHelperAssist: boolean;
  readonly allowsProofSpike: boolean;
  readonly allowsQuoteTurn: boolean;
  readonly allowsNegotiationEscape: boolean;
  readonly riskBand: ChatCounterRiskBand;
  readonly notes: readonly string[];
}

export interface ChatCounterSignalSnapshot {
  readonly signalId: ChatCounterSignalId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly signalAt: UnixMs;
  readonly attackType?: ChatAttackType | null;
  readonly pressureTier?: ChatPressureTier | null;
  readonly affect?: ChatAffectSnapshot | null;
  readonly reputation?: ChatReputationState | null;
  readonly publicWitness01: Score01;
  readonly humiliationRisk01: Score01;
  readonly bluffLikelihood01: Score01;
  readonly trapLikelihood01: Score01;
  readonly closeWindowRisk01: Score01;
  readonly proofAdvantage01: Score01;
  readonly quoteAdvantage01: Score01;
  readonly silenceValue01: Score01;
  readonly helperNeed01: Score01;
  readonly dominantThreatTag?: string | null;
  readonly tags: readonly string[];
}

export interface ChatCounterMove {
  readonly moveId: ChatCounterMoveId;
  readonly templateId?: ChatCounterTemplateId | null;
  readonly label: string;
  readonly shortLabel?: string | null;
  readonly kind: ChatCounterplayKind;
  readonly intent: ChatCounterIntent;
  readonly executionMode: ChatCounterExecutionMode;
  readonly surface: ChatCounterSurface;
  readonly timingClass: ChatCounterTimingClass;
  readonly toneBand?: ChatMessageToneBand | null;
  readonly riskBand: ChatCounterRiskBand;
  readonly requiresProof: boolean;
  readonly requiresQuote: boolean;
  readonly requiresVisibleReply: boolean;
  readonly canBeSilent: boolean;
  readonly canEscalateCrowd: boolean;
  readonly canReducePressure: boolean;
  readonly canTriggerReprice: boolean;
  readonly canOpenExitWindow: boolean;
  readonly canBecomeLegend: boolean;
  readonly estimatedConfidence01: Score01;
  readonly estimatedEmbarrassmentSwing01: Score01;
  readonly estimatedPressureRelief01: Score01;
  readonly estimatedDominanceSwing01: Score01;
  readonly estimatedTrustGain01: Score01;
  readonly estimatedHumiliationRisk01: Score01;
  readonly estimatedWindowConsumption01: Score01;
  readonly recommendedReplyText?: string | null;
  readonly proofHash?: ChatProofHash | null;
  readonly quoteReference?: ChatQuoteReference | null;
  readonly callbackAnchorIds?: readonly ChatMemoryAnchorId[];
  readonly notes: readonly string[];
}

export interface ChatCounterRule {
  readonly ruleId: ChatCounterRuleId;
  readonly label: string;
  readonly appliesToKinds: readonly ChatCounterplayKind[];
  readonly allowedAttackTypes?: readonly ChatAttackType[];
  readonly allowedPressureTiers?: readonly ChatPressureTier[];
  readonly allowedChannels?: readonly ChatChannelId[];
  readonly minProofAdvantage01?: Score01;
  readonly minQuoteAdvantage01?: Score01;
  readonly minSilenceValue01?: Score01;
  readonly minConfidence01?: Score01;
  readonly maxHumiliationRisk01?: Score01;
  readonly requireWindowOpen: boolean;
  readonly requireVisibleReply?: boolean;
  readonly allowHelperAssist?: boolean;
  readonly allowShadowOnly?: boolean;
  readonly rejectIfLateByMs?: number;
  readonly rejectIfTooEarlyByMs?: number;
  readonly notes: readonly string[];
}

export interface ChatCounterCandidate {
  readonly counterplayId: ChatCounterplayId;
  readonly windowId: ChatCounterWindowId;
  readonly move: ChatCounterMove;
  readonly signal: ChatCounterSignalSnapshot;
  readonly sourceArchetypeId?: ChatCounterPatternId | null;
  readonly generationSource:
    | 'PLAYER_TYPED'
    | 'UI_TEMPLATE'
    | 'HELPER_SUGGESTION'
    | 'RUNTIME_RANKER'
    | 'BACKEND_AUTHORITATIVE';
  readonly score01: Score01;
  readonly riskAdjustedScore01: Score01;
  readonly validationStatus: ChatCounterValidationStatus;
  readonly efficacyBand: ChatCounterEfficacyBand;
  readonly receiptClass: ChatCounterReceiptClass;
  readonly likelyFailureReason?: ChatCounterFailureReason | null;
  readonly legendEligible: boolean;
  readonly pressureReliefScore: Score100;
  readonly reversalScore: Score100;
  readonly prestigeScore: Score100;
  readonly notes: readonly string[];
}

export interface ChatCounterplayPlan {
  readonly planId: ChatCounterSequenceId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly requestId?: ChatRequestId | null;
  readonly windowId: ChatCounterWindowId;
  readonly rankedCandidates: readonly ChatCounterCandidate[];
  readonly selectedCounterplayId?: ChatCounterplayId | null;
  readonly fallbackCounterplayId?: ChatCounterplayId | null;
  readonly helperInterventionId?: ChatInterventionId | null;
  readonly memoryEventHint?: EpisodicMemoryEventType | null;
  readonly sceneArchetypeHint?: SharedChatSceneArchetype | null;
  readonly sceneRoleHint?: SharedChatSceneRole | null;
  readonly createdAt: UnixMs;
  readonly expiresAt: UnixMs;
  readonly allowsManualOverride: boolean;
  readonly lockedByAuthority: boolean;
  readonly debug?: JsonObject;
}

export interface ChatCounterReceipt {
  readonly receiptId: ChatCounterReceiptId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly counterplayId: ChatCounterplayId;
  readonly windowId: ChatCounterWindowId;
  readonly appliedAt: UnixMs;
  readonly class: ChatCounterReceiptClass;
  readonly efficacyBand: ChatCounterEfficacyBand;
  readonly visibleToPlayer: boolean;
  readonly replayId?: ChatReplayId | null;
  readonly proofHash?: ChatProofHash | null;
  readonly generatedQuoteReference?: ChatQuoteReference | null;
  readonly memoryAnchorIds?: readonly ChatMemoryAnchorId[];
  readonly summary: string;
  readonly notes: readonly string[];
}

export interface ChatCounterplayResolution {
  readonly counterplayId: ChatCounterplayId;
  readonly windowId: ChatCounterWindowId;
  readonly resolvedAt: UnixMs;
  readonly succeeded: boolean;
  readonly efficacyBand: ChatCounterEfficacyBand;
  readonly validationStatus: ChatCounterValidationStatus;
  readonly pressureReliefScore: Score100;
  readonly embarrassmentSwingScore: Score100;
  readonly dominanceSwingScore: Score100;
  readonly trustGainScore: Score100;
  readonly reputationDeltaScore: Score100;
  readonly consumedWindow: boolean;
  readonly legendQualified: boolean;
  readonly likelyMemoryEvent?: EpisodicMemoryEventType | null;
  readonly failureReason?: ChatCounterFailureReason | null;
  readonly receipt?: ChatCounterReceipt | null;
  readonly notes: readonly string[];
}

export interface ChatCounterplayLedger {
  readonly ledgerId: ChatCounterLedgerId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly openWindows: readonly ChatCounterWindow[];
  readonly pendingPlans: readonly ChatCounterplayPlan[];
  readonly recentResolutions: readonly ChatCounterplayResolution[];
  readonly lastUpdatedAt: UnixMs;
  readonly contractVersion: typeof CHAT_COUNTERPLAY_CONTRACT_VERSION;
  readonly inheritedChatContractVersion: typeof CHAT_CONTRACT_VERSION;
}

// ============================================================================
// MARK: Scoring breakdowns
// ============================================================================

export interface ChatCounterScoreBreakdown {
  readonly timingWeight: number;
  readonly proofWeight: number;
  readonly quoteWeight: number;
  readonly confidenceWeight: number;
  readonly pressureReliefWeight: number;
  readonly dominanceWeight: number;
  readonly embarrassmentPenaltyWeight: number;
  readonly riskPenaltyWeight: number;
  readonly silenceBonusWeight: number;
  readonly helperBonusWeight: number;
  readonly finalScore01: Score01;
}

export interface ChatCounterEvaluationInput {
  readonly now: UnixMs;
  readonly window: ChatCounterWindow;
  readonly move: ChatCounterMove;
  readonly signal: ChatCounterSignalSnapshot;
  readonly actor?: ChatCounterActorSnapshot | null;
}

// ============================================================================
// MARK: Deterministic helpers
// ============================================================================

function clamp01Number(value: number): number {
  if (Number.isNaN(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return Number(value.toFixed(6));
}

function clamp100Number(value: number): number {
  if (Number.isNaN(value) || value <= 0) return 0;
  if (value >= 100) return 100;
  return Number(value.toFixed(3));
}

export function toScore01(value: number): Score01 {
  return clamp01Number(value) as Score01;
}

export function toScore100(value: number): Score100 {
  return clamp100Number(value) as Score100;
}

export function score100To01(value: Score100 | number | null | undefined): Score01 {
  return toScore01((Number(value ?? 0) || 0) / 100);
}

export function score01To100(value: Score01 | number | null | undefined): Score100 {
  return toScore100((Number(value ?? 0) || 0) * 100);
}

export function nowWithinWindow(
  now: UnixMs,
  window: Pick<ChatCounterWindow, 'openedAt' | 'closesAt'>,
): boolean {
  return Number(now) >= Number(window.openedAt) && Number(now) <= Number(window.closesAt);
}

export function deriveCounterTimingWeight(
  now: UnixMs,
  window: Pick<ChatCounterWindow, 'openedAt' | 'closesAt' | 'idealResponseAt' | 'timingClass'>,
): number {
  const opened = Number(window.openedAt);
  const closes = Number(window.closesAt);
  const ideal = Number(window.idealResponseAt ?? ((opened + closes) / 2) as UnixMs);
  const span = Math.max(1, closes - opened);
  const distance = Math.abs(Number(now) - ideal);
  const centered = 1 - Math.min(1, distance / span);

  switch (window.timingClass) {
    case 'INSTANT':
      return clamp01Number(centered * 1.15);
    case 'FAST':
      return clamp01Number(centered * 1.05);
    case 'BEAT_LOCKED':
      return clamp01Number(centered);
    case 'READ_PRESSURE_DELAYED':
      return clamp01Number(0.7 + centered * 0.3);
    case 'LATE_BUT_VALID':
      return clamp01Number(0.55 + centered * 0.2);
    case 'POST_SCENE':
      return 0.6;
    case 'SHADOW_ONLY':
      return 0.75;
    default:
      return centered;
  }
}

export function deriveCounterRiskPenalty(band: ChatCounterRiskBand): number {
  switch (band) {
    case 'SAFE':
      return 0.02;
    case 'MEASURED':
      return 0.08;
    case 'VOLATILE':
      return 0.16;
    case 'DANGEROUS':
      return 0.28;
    case 'SUICIDAL':
      return 0.42;
    default:
      return 0.12;
  }
}

export function deriveCounterValidationStatus(
  now: UnixMs,
  window: ChatCounterWindow,
  move: Pick<ChatCounterMove, 'requiresProof' | 'requiresQuote' | 'requiresVisibleReply' | 'canBeSilent'>,
): ChatCounterValidationStatus {
  if (!nowWithinWindow(now, window)) return 'WINDOW_CLOSED';
  if (window.validationStatus === 'BLOCKED_BY_POLICY') return 'BLOCKED_BY_POLICY';
  if (move.requiresProof && !window.allowsProofSpike) return 'REQUIRES_PROOF';
  if (move.requiresQuote && !window.allowsQuoteTurn) return 'REQUIRES_QUOTE';
  if (move.requiresVisibleReply && !window.requiresVisibleReply && window.allowsSilence) return 'WINDOW_OPEN';
  if (!move.canBeSilent && window.validationStatus === 'REQUIRES_SILENCE') return 'REQUIRES_SILENCE';
  return 'WINDOW_OPEN';
}

export function deriveCounterEfficacyBand(score01: Score01 | number): ChatCounterEfficacyBand {
  const value = Number(score01);
  if (value >= 0.95) return 'LEGENDARY';
  if (value >= 0.82) return 'DOMINANT';
  if (value >= 0.64) return 'STRONG';
  if (value >= 0.42) return 'STABLE';
  if (value >= 0.22) return 'GLANCING';
  return 'WHIFF';
}

export function deriveCounterReceiptClass(
  move: Pick<ChatCounterMove, 'proofHash' | 'quoteReference' | 'canBecomeLegend'>,
  efficacyBand: ChatCounterEfficacyBand,
  visibleToPlayer: boolean,
): ChatCounterReceiptClass {
  if (efficacyBand === 'LEGENDARY' && move.canBecomeLegend) return 'LEGEND_RECEIPT';
  if (move.proofHash) return 'PROOF_RECEIPT';
  if (!visibleToPlayer) return 'SHADOW_RECEIPT';
  if (move.quoteReference) return 'VISIBLE_RECEIPT';
  return 'VISIBLE_RECEIPT';
}

export function deriveCounterFailureReason(
  status: ChatCounterValidationStatus,
  candidateScore01: Score01 | number,
): ChatCounterFailureReason | null {
  switch (status) {
    case 'WINDOW_CLOSED':
      return 'NO_ACTIVE_WINDOW';
    case 'REQUIRES_PROOF':
      return 'INSUFFICIENT_PROOF';
    case 'REQUIRES_QUOTE':
      return 'QUOTE_MISMATCH';
    case 'REQUIRES_TIMING':
      return 'TOO_LATE';
    case 'REQUIRES_SILENCE':
      return 'PLAYER_INTERRUPTED_SELF';
    case 'BLOCKED_BY_POLICY':
      return 'SYSTEM_LOCKOUT';
    case 'AUTHORITATIVE_REJECT':
      return 'ATTACK_ALREADY_LANDED';
    default:
      return Number(candidateScore01) < 0.2 ? 'LOW_CONFIDENCE' : null;
  }
}

export function evaluateCounterplay(
  input: ChatCounterEvaluationInput,
): ChatCounterScoreBreakdown {
  const { now, window, move, signal, actor } = input;

  const timingWeight = deriveCounterTimingWeight(now, window);
  const proofWeight = move.requiresProof ? Number(signal.proofAdvantage01) : Number(signal.proofAdvantage01) * 0.35;
  const quoteWeight = move.requiresQuote ? Number(signal.quoteAdvantage01) : Number(signal.quoteAdvantage01) * 0.4;

  const actorConfidence01 = score100To01(actor?.confidenceScore ?? 50);
  const actorEmbarrassment01 = score100To01(actor?.embarrassmentScore ?? 40);

  const confidenceWeight =
    Number(move.estimatedConfidence01) * 0.55 + Number(actorConfidence01) * 0.45;

  const pressureReliefWeight =
    Number(move.estimatedPressureRelief01) * 0.6 +
    (1 - Number(signal.closeWindowRisk01)) * 0.1 +
    Number(signal.helperNeed01) * (move.kind === 'HELPER_ASSIST' ? 0.3 : 0.05);

  const dominanceWeight =
    Number(move.estimatedDominanceSwing01) * 0.6 +
    Number(move.estimatedEmbarrassmentSwing01) * 0.15 +
    Number(signal.publicWitness01) * (move.kind === 'CROWD_REFRAME' ? 0.25 : 0.05);

  const embarrassmentPenaltyWeight =
    Number(move.estimatedHumiliationRisk01) * 0.55 + Number(actorEmbarrassment01) * 0.45;

  const riskPenaltyWeight = deriveCounterRiskPenalty(move.riskBand);

  const silenceBonusWeight =
    move.canBeSilent && window.allowsSilence ? Number(signal.silenceValue01) * 0.9 : 0;

  const helperBonusWeight =
    move.kind === 'HELPER_ASSIST' && window.allowsHelperAssist ? Number(signal.helperNeed01) : 0;

  const raw =
    timingWeight * 0.18 +
    proofWeight * 0.10 +
    quoteWeight * 0.08 +
    confidenceWeight * 0.16 +
    pressureReliefWeight * 0.20 +
    dominanceWeight * 0.14 +
    silenceBonusWeight * 0.05 +
    helperBonusWeight * 0.09 -
    embarrassmentPenaltyWeight * 0.12 -
    riskPenaltyWeight * 0.08;

  return {
    timingWeight,
    proofWeight,
    quoteWeight,
    confidenceWeight,
    pressureReliefWeight,
    dominanceWeight,
    embarrassmentPenaltyWeight,
    riskPenaltyWeight,
    silenceBonusWeight,
    helperBonusWeight,
    finalScore01: toScore01(raw),
  };
}

export function buildCounterCandidate(
  window: ChatCounterWindow,
  move: ChatCounterMove,
  signal: ChatCounterSignalSnapshot,
  now: UnixMs,
  actor?: ChatCounterActorSnapshot | null,
  generationSource: ChatCounterCandidate['generationSource'] = 'RUNTIME_RANKER',
  sourceArchetypeId?: ChatCounterPatternId | null,
): ChatCounterCandidate {
  const validationStatus = deriveCounterValidationStatus(now, window, move);
  const breakdown = evaluateCounterplay({ now, window, move, signal, actor });
  const efficacyBand = deriveCounterEfficacyBand(breakdown.finalScore01);

  const reversalScore = toScore100(
    Number(move.estimatedDominanceSwing01) * 70 +
    Number(move.estimatedEmbarrassmentSwing01) * 30,
  );

  const pressureReliefScore = toScore100(
    Number(move.estimatedPressureRelief01) * 100,
  );

  const prestigeScore = toScore100(
    Number(breakdown.finalScore01) * 45 +
    Number(signal.publicWitness01) * 35 +
    (move.canBecomeLegend ? 20 : 0),
  );

  const legendEligible =
    move.canBecomeLegend &&
    efficacyBand !== 'WHIFF' &&
    (Number(signal.publicWitness01) >= 0.45 || move.proofHash != null || move.quoteReference != null);

  const receiptClass = deriveCounterReceiptClass(
    move,
    efficacyBand,
    move.requiresVisibleReply || !move.canBeSilent,
  );

  return {
    counterplayId: (`counter:${window.windowId}:${move.moveId}`) as ChatCounterplayId,
    windowId: window.windowId,
    move,
    signal,
    sourceArchetypeId: sourceArchetypeId ?? null,
    generationSource,
    score01: breakdown.finalScore01,
    riskAdjustedScore01: toScore01(Number(breakdown.finalScore01) - deriveCounterRiskPenalty(move.riskBand)),
    validationStatus,
    efficacyBand,
    receiptClass,
    likelyFailureReason: deriveCounterFailureReason(validationStatus, breakdown.finalScore01),
    legendEligible,
    pressureReliefScore,
    reversalScore,
    prestigeScore,
    notes: [
      `timing=${breakdown.timingWeight.toFixed(3)}`,
      `pressureRelief=${breakdown.pressureReliefWeight.toFixed(3)}`,
      `dominance=${breakdown.dominanceWeight.toFixed(3)}`,
      `riskPenalty=${breakdown.riskPenaltyWeight.toFixed(3)}`,
    ],
  };
}

export function compareCounterCandidates(
  left: ChatCounterCandidate,
  right: ChatCounterCandidate,
): number {
  const delta =
    Number(right.riskAdjustedScore01) - Number(left.riskAdjustedScore01) ||
    Number(right.prestigeScore) - Number(left.prestigeScore) ||
    Number(right.pressureReliefScore) - Number(left.pressureReliefScore);

  if (delta > 0) return 1;
  if (delta < 0) return -1;
  return 0;
}

export function rankCounterCandidates(
  candidates: readonly ChatCounterCandidate[],
): readonly ChatCounterCandidate[] {
  return [...candidates].sort((a, b) => compareCounterCandidates(a, b));
}

export function selectBestCounterCandidate(
  candidates: readonly ChatCounterCandidate[],
): ChatCounterCandidate | null {
  if (candidates.length === 0) return null;
  return rankCounterCandidates(candidates)[0] ?? null;
}

export function inferCounterMemoryEvent(
  candidate: Pick<ChatCounterCandidate, 'move' | 'efficacyBand' | 'legendEligible'>,
): EpisodicMemoryEventType | null {
  if (candidate.legendEligible || candidate.efficacyBand === 'LEGENDARY') {
    return 'PERFECT_DEFENSE';
  }

  switch (candidate.move.kind) {
    case 'BLUFF_CALL':
      return 'BLUFF';
    case 'HUMILIATION_REVERSAL':
      return 'HUMILIATION';
    case 'NEGOTIATION_REPRICE':
    case 'NEGOTIATION_ESCAPE':
      return 'DEAL_ROOM_STANDOFF';
    case 'HELPER_ASSIST':
      return 'RESCUE';
    case 'SHIELD_STABILIZE':
      return 'DISCIPLINE';
    default:
      return null;
  }
}

export function createCounterReceipt(
  candidate: ChatCounterCandidate,
  appliedAt: UnixMs,
  replayId?: ChatReplayId | null,
): ChatCounterReceipt {
  return {
    receiptId: (`receipt:${candidate.counterplayId}`) as ChatCounterReceiptId,
    roomId: candidate.signal.roomId,
    channelId: candidate.signal.channelId,
    counterplayId: candidate.counterplayId,
    windowId: candidate.windowId,
    appliedAt,
    class: candidate.receiptClass,
    efficacyBand: candidate.efficacyBand,
    visibleToPlayer:
      candidate.receiptClass !== 'SHADOW_RECEIPT' && candidate.move.requiresVisibleReply,
    replayId: replayId ?? null,
    proofHash: candidate.move.proofHash ?? null,
    generatedQuoteReference: candidate.move.quoteReference ?? null,
    memoryAnchorIds: candidate.move.callbackAnchorIds,
    summary: summarizeCounterCandidate(candidate),
    notes: candidate.notes,
  };
}

export function summarizeCounterCandidate(
  candidate: Pick<
    ChatCounterCandidate,
    'efficacyBand' | 'move' | 'validationStatus' | 'pressureReliefScore' | 'reversalScore'
  >,
): string {
  return [
    `${candidate.move.label}`,
    `kind=${candidate.move.kind}`,
    `intent=${candidate.move.intent}`,
    `band=${candidate.efficacyBand}`,
    `status=${candidate.validationStatus}`,
    `relief=${Number(candidate.pressureReliefScore).toFixed(1)}`,
    `reversal=${Number(candidate.reversalScore).toFixed(1)}`,
  ].join(' | ');
}

export function resolveCounterplay(
  candidate: ChatCounterCandidate,
  resolvedAt: UnixMs,
  replayId?: ChatReplayId | null,
): ChatCounterplayResolution {
  const succeeded =
    candidate.validationStatus === 'WINDOW_OPEN' &&
    candidate.efficacyBand !== 'WHIFF';

  const receipt = succeeded ? createCounterReceipt(candidate, resolvedAt, replayId) : null;

  return {
    counterplayId: candidate.counterplayId,
    windowId: candidate.windowId,
    resolvedAt,
    succeeded,
    efficacyBand: candidate.efficacyBand,
    validationStatus: candidate.validationStatus,
    pressureReliefScore: candidate.pressureReliefScore,
    embarrassmentSwingScore: candidate.move.estimatedEmbarrassmentSwing01
      ? score01To100(candidate.move.estimatedEmbarrassmentSwing01)
      : toScore100(0),
    dominanceSwingScore: candidate.reversalScore,
    trustGainScore: score01To100(candidate.move.estimatedTrustGain01),
    reputationDeltaScore: toScore100(
      Number(candidate.prestigeScore) * 0.55 + (succeeded ? 12 : -8),
    ),
    consumedWindow: candidate.validationStatus === 'WINDOW_OPEN',
    legendQualified: candidate.legendEligible && succeeded,
    likelyMemoryEvent: inferCounterMemoryEvent(candidate),
    failureReason: succeeded
      ? null
      : deriveCounterFailureReason(candidate.validationStatus, candidate.score01),
    receipt,
    notes: candidate.notes,
  };
}

export function createEmptyCounterplayLedger(
  roomId: ChatRoomId,
  channelId: ChatChannelId,
  now: UnixMs,
): ChatCounterplayLedger {
  return {
    ledgerId: (`ledger:${roomId}:${channelId}`) as ChatCounterLedgerId,
    roomId,
    channelId,
    openWindows: [],
    pendingPlans: [],
    recentResolutions: [],
    lastUpdatedAt: now,
    contractVersion: CHAT_COUNTERPLAY_CONTRACT_VERSION,
    inheritedChatContractVersion: CHAT_CONTRACT_VERSION,
  };
}

export function buildCounterplayPlan(
  roomId: ChatRoomId,
  channelId: ChatChannelId,
  window: ChatCounterWindow,
  candidates: readonly ChatCounterCandidate[],
  createdAt: UnixMs,
  expiresAt: UnixMs,
  helperInterventionId?: ChatInterventionId | null,
  debug?: JsonObject,
): ChatCounterplayPlan {
  const ranked = rankCounterCandidates(candidates);
  const selected = ranked[0] ?? null;
  const fallback = ranked[1] ?? null;

  return {
    planId: (`plan:${window.windowId}`) as ChatCounterSequenceId,
    roomId,
    channelId,
    requestId: window.requestId ?? null,
    windowId: window.windowId,
    rankedCandidates: ranked,
    selectedCounterplayId: selected?.counterplayId ?? null,
    fallbackCounterplayId: fallback?.counterplayId ?? null,
    helperInterventionId: helperInterventionId ?? null,
    memoryEventHint: selected ? inferCounterMemoryEvent(selected) : null,
    sceneArchetypeHint: window.sourceSceneArchetype ?? null,
    sceneRoleHint: window.sourceSceneRole ?? null,
    createdAt,
    expiresAt,
    allowsManualOverride: true,
    lockedByAuthority: false,
    debug,
  };
}

// ============================================================================
// MARK: Default rules
// ============================================================================

export const CHAT_COUNTERPLAY_DEFAULT_RULES = Object.freeze([
  {
    ruleId: 'rule.window.must-be-open' as ChatCounterRuleId,
    label: 'Window must be open',
    appliesToKinds: [...CHAT_COUNTERPLAY_KINDS],
    requireWindowOpen: true,
    requireVisibleReply: false,
    allowHelperAssist: true,
    allowShadowOnly: true,
    notes: ['Universal gating rule.'],
  },
  {
    ruleId: 'rule.proof.requires-proof-window' as ChatCounterRuleId,
    label: 'Proof counters need proof-compatible window',
    appliesToKinds: ['PROOF_SPIKE', 'NEGOTIATION_REPRICE', 'LEGEND_COUNTER'],
    minProofAdvantage01: toScore01(0.25),
    requireWindowOpen: true,
    requireVisibleReply: true,
    allowHelperAssist: false,
    allowShadowOnly: false,
    notes: ['Prevents fake proof spikes in unsupported windows.'],
  },
  {
    ruleId: 'rule.silence.needs-silence-value' as ChatCounterRuleId,
    label: 'Silence counters need silence value',
    appliesToKinds: ['SILENT_ABSORB', 'EXIT_WINDOW'],
    minSilenceValue01: toScore01(0.35),
    requireWindowOpen: true,
    requireVisibleReply: false,
    allowHelperAssist: true,
    allowShadowOnly: true,
    notes: ['Silence is strategic, not absence.'],
  },
  {
    ruleId: 'rule.quote.needs-quote-advantage' as ChatCounterRuleId,
    label: 'Quote turns need quote advantage',
    appliesToKinds: ['QUOTE_TURN', 'HUMILIATION_REVERSAL', 'LEGEND_COUNTER'],
    minQuoteAdvantage01: toScore01(0.20),
    requireWindowOpen: true,
    requireVisibleReply: true,
    allowHelperAssist: false,
    allowShadowOnly: false,
    notes: ['Stops random quote callbacks from pretending to be receipts.'],
  },
] as const satisfies readonly ChatCounterRule[]);

// ============================================================================
// MARK: Predicates
// ============================================================================

export function isCounterRuleSatisfied(
  rule: ChatCounterRule,
  candidate: ChatCounterCandidate,
): boolean {
  if (!rule.appliesToKinds.includes(candidate.move.kind)) return true;
  if (rule.allowedAttackTypes?.length && candidate.signal.attackType) {
    if (!rule.allowedAttackTypes.includes(candidate.signal.attackType)) return false;
  }
  if (rule.allowedPressureTiers?.length && candidate.signal.pressureTier) {
    if (!rule.allowedPressureTiers.includes(candidate.signal.pressureTier)) return false;
  }
  if (rule.allowedChannels?.length) {
    if (!rule.allowedChannels.includes(candidate.signal.channelId)) return false;
  }
  if (rule.minProofAdvantage01 != null) {
    if (Number(candidate.signal.proofAdvantage01) < Number(rule.minProofAdvantage01)) return false;
  }
  if (rule.minQuoteAdvantage01 != null) {
    if (Number(candidate.signal.quoteAdvantage01) < Number(rule.minQuoteAdvantage01)) return false;
  }
  if (rule.minSilenceValue01 != null) {
    if (Number(candidate.signal.silenceValue01) < Number(rule.minSilenceValue01)) return false;
  }
  if (rule.minConfidence01 != null) {
    if (Number(candidate.move.estimatedConfidence01) < Number(rule.minConfidence01)) return false;
  }
  if (rule.maxHumiliationRisk01 != null) {
    if (Number(candidate.move.estimatedHumiliationRisk01) > Number(rule.maxHumiliationRisk01)) return false;
  }
  if (rule.requireWindowOpen && candidate.validationStatus !== 'WINDOW_OPEN') return false;
  if (rule.requireVisibleReply && !candidate.move.requiresVisibleReply) return false;
  if (rule.allowShadowOnly === false && candidate.move.surface === 'SHADOW_QUEUE') return false;
  return true;
}

export function passesDefaultCounterRules(
  candidate: ChatCounterCandidate,
): boolean {
  return CHAT_COUNTERPLAY_DEFAULT_RULES.every((rule) => isCounterRuleSatisfied(rule, candidate));
}

export function shouldCounterBecomeLegend(
  resolution: Pick<
    ChatCounterplayResolution,
    'legendQualified' | 'efficacyBand' | 'pressureReliefScore' | 'dominanceSwingScore'
  >,
): boolean {
  return (
    resolution.legendQualified &&
    (resolution.efficacyBand === 'LEGENDARY' || resolution.efficacyBand === 'DOMINANT') &&
    Number(resolution.pressureReliefScore) >= 70 &&
    Number(resolution.dominanceSwingScore) >= 72
  );
}
