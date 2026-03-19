/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT LEGEND CONTRACT
 * FILE: shared/contracts/chat/ChatLegend.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared contract surface for legend moments and prestige chat.
 *
 * A legend moment is not "just another message." It is a prestige-class event
 * produced when a run crosses a dramatic threshold that the social layer should
 * remember, archive, replay, reward, and callback later.
 *
 * Core doctrine
 * -------------
 * 1. Legend moments are authored truth, not cosmetic afterthoughts.
 * 2. Prestige must remain deterministic across frontend, backend, and transport.
 * 3. A legend is stronger when witnesses, proof, timing, and pressure agree.
 * 4. Not every comeback is a legend; this file defines the bar.
 * 5. Replay, archive, callback, and reward hooks must be transport-safe.
 * 6. A legend can emerge from visible or shadow-authority lanes, but it must
 *    serialize into an explainable public artifact.
 * 7. Shared contracts define shape, scoring helpers, and normalization law.
 *    They do not mutate runtime state.
 * 8. All exported helpers in this file are deterministic and side-effect free.
 *
 * Trigger classes
 * ---------------
 * - sovereignty achieved under pressure
 * - perfect counterplay
 * - humiliating hater reversal
 * - miracle rescue
 * - last-second comeback
 * - negotiation heist
 * - witness cascade
 * - crowd conversion
 *
 * Canonical authority roots
 * -------------------------
 * - /shared/contracts/chat
 * - /pzo-web/src/engines/chat
 * - /pzo-web/src/components/chat
 * - /backend/src/game/engine/chat
 * - /pzo-server/src/chat
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import {
  CHAT_ALL_CHANNELS,
  CHAT_CONTRACT_AUTHORITIES,
  CHAT_CONTRACT_VERSION,
  CHAT_SHADOW_CHANNELS,
  CHAT_VISIBLE_CHANNELS,
  type Brand,
  type ChatChannelId,
  type ChatLegendId,
  type ChatMessageId,
  type ChatMomentId,
  type ChatNpcId,
  type ChatProofHash,
  type ChatRelationshipId,
  type ChatReplayId,
  type ChatRoomId,
  type ChatSceneId,
  type ChatSessionId,
  type ChatShadowChannel,
  type ChatUserId,
  type ChatWorldEventId,
  type JsonValue,
  type Percentage,
  type Score01,
  type Score100,
  type UnixMs,
} from './ChatChannels';

// ============================================================================
// MARK: Brands
// ============================================================================

export type ChatLegendArtifactId = Brand<string, 'ChatLegendArtifactId'>;
export type ChatLegendWitnessId = Brand<string, 'ChatLegendWitnessId'>;
export type ChatLegendArchiveEntryId = Brand<string, 'ChatLegendArchiveEntryId'>;
export type ChatLegendCeremonyId = Brand<string, 'ChatLegendCeremonyId'>;
export type ChatLegendPhraseId = Brand<string, 'ChatLegendPhraseId'>;
export type ChatLegendAuraId = Brand<string, 'ChatLegendAuraId'>;
export type ChatLegendTitleId = Brand<string, 'ChatLegendTitleId'>;
export type ChatLegendBadgeId = Brand<string, 'ChatLegendBadgeId'>;
export type ChatLegendBundleId = Brand<string, 'ChatLegendBundleId'>;
export type ChatLegendSurfaceId = Brand<string, 'ChatLegendSurfaceId'>;
export type ChatLegendCallbackId = Brand<string, 'ChatLegendCallbackId'>;
export type ChatLegendProofPacketId = Brand<string, 'ChatLegendProofPacketId'>;
export type ChatLegendSequenceId = Brand<string, 'ChatLegendSequenceId'>;
export type ChatLegendRuleId = Brand<string, 'ChatLegendRuleId'>;
export type ChatLegendArchiveKey = Brand<string, 'ChatLegendArchiveKey'>;
export type ChatLegendReplayKey = Brand<string, 'ChatLegendReplayKey'>;
export type ChatLegendSceneKey = Brand<string, 'ChatLegendSceneKey'>;

// ============================================================================
// MARK: Versions
// ============================================================================

export const CHAT_LEGEND_CONTRACT_VERSION = '2026.03.19' as const;
export const CHAT_LEGEND_PUBLIC_API_VERSION = '1.0.0' as const;
export const CHAT_LEGEND_REVISION = 'shared.chat.legend.v1' as const;

// ============================================================================
// MARK: Enums / unions
// ============================================================================

export const CHAT_LEGEND_CLASSES = [
  'SOVEREIGNTY_UNDER_PRESSURE',
  'PERFECT_COUNTERPLAY',
  'HUMILIATING_HATER_REVERSAL',
  'MIRACLE_RESCUE',
  'LAST_SECOND_COMEBACK',
  'NEGOTIATION_HEIST',
  'WITNESS_CASCADE',
  'CROWD_CONVERSION',
  'BOSS_FIGHT_CONTAINMENT',
  'SHADOW_REVEAL_PERFECTION',
] as const;

export type ChatLegendClass = (typeof CHAT_LEGEND_CLASSES)[number];

export const CHAT_LEGEND_TIERS = [
  'ECHO',
  'ASCENDANT',
  'MYTHIC',
  'IMMORTAL',
] as const;

export type ChatLegendTier = (typeof CHAT_LEGEND_TIERS)[number];

export const CHAT_LEGEND_SEVERITY = [
  'NOTABLE',
  'MAJOR',
  'HISTORIC',
  'RUN_DEFINING',
] as const;

export type ChatLegendSeverity = (typeof CHAT_LEGEND_SEVERITY)[number];

export const CHAT_LEGEND_VISIBILITY = [
  'PUBLIC',
  'PRIVATE',
  'SYNDICATE_ONLY',
  'DEAL_ROOM_ONLY',
  'CEREMONIAL_BROADCAST',
] as const;

export type ChatLegendVisibility = (typeof CHAT_LEGEND_VISIBILITY)[number];

export const CHAT_LEGEND_ARTIFACT_TYPES = [
  'ARCHIVE_ENTRY',
  'REPLAY_LINK',
  'AURA',
  'TITLE',
  'BADGE',
  'PHRASE',
  'REWARD_BUNDLE',
  'PROOF_CARD',
  'MOMENT_FLASH',
  'SYSTEM_BANNER',
] as const;

export type ChatLegendArtifactType = (typeof CHAT_LEGEND_ARTIFACT_TYPES)[number];

export const CHAT_LEGEND_WITNESS_ROLES = [
  'SYSTEM',
  'RIVAL',
  'HELPER',
  'CROWD',
  'DEAL_ROOM',
  'BOSS',
  'SPECTATOR',
  'SELF',
] as const;

export type ChatLegendWitnessRole = (typeof CHAT_LEGEND_WITNESS_ROLES)[number];

export const CHAT_LEGEND_CALLBACK_MODES = [
  'QUOTE',
  'SYSTEM_REFERENCE',
  'TAUNT',
  'PRAISE',
  'WARNING',
  'NEGOTIATION_LEVERAGE',
  'RITUAL_RECALL',
] as const;

export type ChatLegendCallbackMode = (typeof CHAT_LEGEND_CALLBACK_MODES)[number];

export const CHAT_LEGEND_ARCHIVE_SCOPES = [
  'RUN',
  'PLAYER',
  'SEASON',
  'GLOBAL',
  'FACTION',
] as const;

export type ChatLegendArchiveScope = (typeof CHAT_LEGEND_ARCHIVE_SCOPES)[number];

export const CHAT_LEGEND_PRESENTATION_SURFACES = [
  'CHAT_PANEL',
  'MOMENT_FLASH',
  'PROOF_CARD',
  'PROOF_CARD_V2',
  'COUNTERPLAY_MODAL',
  'BATTLE_HUD',
  'LEAGUE_UI',
  'EMPIRE_BLEED_BANNER',
  'RESCUE_WINDOW_BANNER',
  'THREAT_RADAR_PANEL',
  'SABOTAGE_IMPACT_PANEL',
] as const;

export type ChatLegendPresentationSurface =
  (typeof CHAT_LEGEND_PRESENTATION_SURFACES)[number];

export const CHAT_LEGEND_PROOF_LEVELS = [
  'DECLARED',
  'WITNESSED',
  'HASHED',
  'REPLAY_SAFE',
  'CEREMONIAL',
] as const;

export type ChatLegendProofLevel = (typeof CHAT_LEGEND_PROOF_LEVELS)[number];

export const CHAT_LEGEND_COOLDOWN_POLICIES = [
  'NONE',
  'PER_CLASS',
  'PER_PLAYER',
  'PER_CHANNEL',
  'PER_SEASON',
] as const;

export type ChatLegendCooldownPolicy =
  (typeof CHAT_LEGEND_COOLDOWN_POLICIES)[number];

export const CHAT_LEGEND_OUTCOME_TAGS = [
  'TRIUMPH',
  'REVERSAL',
  'SURVIVAL',
  'DOMINANCE',
  'EXTRACTION',
  'HUMILIATION',
  'REDEMPTION',
  'RUMOR',
] as const;

export type ChatLegendOutcomeTag = (typeof CHAT_LEGEND_OUTCOME_TAGS)[number];

export const CHAT_LEGEND_REWARD_HINTS = [
  'TITLE',
  'AURA',
  'PHRASE',
  'EMOJI_SKIN',
  'REPLAY_UNLOCK',
  'BADGE',
  'BANNER_STYLE',
  'NONE',
] as const;

export type ChatLegendRewardHint = (typeof CHAT_LEGEND_REWARD_HINTS)[number];

// ============================================================================
// MARK: Constants
// ============================================================================

export const CHAT_LEGEND_DEFAULT_ARCHIVE_SCOPE: ChatLegendArchiveScope = 'RUN';
export const CHAT_LEGEND_DEFAULT_PROOF_LEVEL: ChatLegendProofLevel = 'WITNESSED';
export const CHAT_LEGEND_DEFAULT_COOLDOWN_POLICY: ChatLegendCooldownPolicy =
  'PER_CLASS';
export const CHAT_LEGEND_DEFAULT_VISIBILITY: ChatLegendVisibility = 'PUBLIC';
export const CHAT_LEGEND_DEFAULT_TIER: ChatLegendTier = 'ECHO';
export const CHAT_LEGEND_DEFAULT_SEVERITY: ChatLegendSeverity = 'NOTABLE';

export const CHAT_LEGEND_MIN_SCORE_FOR_CLASSIFICATION = 67;
export const CHAT_LEGEND_MIN_WITNESS_COUNT = 1;
export const CHAT_LEGEND_MAX_WITNESS_COUNT = 16;
export const CHAT_LEGEND_MAX_REWARD_HINTS = 8;
export const CHAT_LEGEND_MAX_CALLBACKS = 16;
export const CHAT_LEGEND_MAX_ARTIFACTS = 24;
export const CHAT_LEGEND_MAX_PHRASE_LENGTH = 220;
export const CHAT_LEGEND_MAX_TITLE_LENGTH = 72;
export const CHAT_LEGEND_MAX_AURA_KEY_LENGTH = 72;
export const CHAT_LEGEND_MAX_SUMMARY_LENGTH = 320;
export const CHAT_LEGEND_MAX_SURFACE_COUNT = 12;
export const CHAT_LEGEND_DEFAULT_ARCHIVE_RETENTION_MS = 1000 * 60 * 60 * 24 * 365;

// ============================================================================
// MARK: Interfaces
// ============================================================================

export interface ChatLegendPressureSnapshot {
  readonly intimidation: Score01;
  readonly confidence: Score01;
  readonly frustration: Score01;
  readonly trust: Score01;
  readonly desperation: Score01;
  readonly dominance: Score01;
  readonly crowdHeat: Score01;
  readonly timePressure: Score01;
  readonly shieldDanger: Score01;
  readonly riskOfCollapse: Score01;
}

export interface ChatLegendWitness {
  readonly witnessId: ChatLegendWitnessId;
  readonly role: ChatLegendWitnessRole;
  readonly userId?: ChatUserId;
  readonly npcId?: ChatNpcId;
  readonly relationshipId?: ChatRelationshipId;
  readonly channelId: ChatChannelId;
  readonly statementHash?: ChatProofHash;
  readonly credibility: Score01;
  readonly excitement: Score01;
  readonly hostility: Score01;
  readonly timestampMs: UnixMs;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface ChatLegendProofPacket {
  readonly proofPacketId: ChatLegendProofPacketId;
  readonly level: ChatLegendProofLevel;
  readonly proofHashes: readonly ChatProofHash[];
  readonly causalMessageIds: readonly ChatMessageId[];
  readonly sceneId?: ChatSceneId;
  readonly momentId?: ChatMomentId;
  readonly replayId?: ChatReplayId;
  readonly replayKey?: ChatLegendReplayKey;
  readonly worldEventId?: ChatWorldEventId;
  readonly recordedAtMs: UnixMs;
  readonly integrityScore: Score01;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface ChatLegendNarrativeFrame {
  readonly opener: string;
  readonly turningPoint: string;
  readonly closer: string;
  readonly summary: string;
  readonly callbackSeed?: string;
  readonly archiveLabel: string;
}

export interface ChatLegendPresentationPlan {
  readonly visibility: ChatLegendVisibility;
  readonly primaryChannelId: ChatChannelId;
  readonly mirroredChannelIds: readonly ChatChannelId[];
  readonly surfaces: readonly ChatLegendPresentationSurface[];
  readonly ceremonialDelayMs: UnixMs;
  readonly useMomentFlash: boolean;
  readonly useProofCard: boolean;
  readonly useBanner: boolean;
  readonly useAuraPreview: boolean;
  readonly silenceAfterRevealMs: UnixMs;
}

export interface ChatLegendArtifact {
  readonly artifactId: ChatLegendArtifactId;
  readonly type: ChatLegendArtifactType;
  readonly label: string;
  readonly description: string;
  readonly surfaceId: ChatLegendSurfaceId;
  readonly sortOrder: number;
  readonly unlockHint: ChatLegendRewardHint;
  readonly visibleToPlayer: boolean;
  readonly payload: Readonly<Record<string, JsonValue>>;
}

export interface ChatLegendCallbackHook {
  readonly callbackId: ChatLegendCallbackId;
  readonly mode: ChatLegendCallbackMode;
  readonly class: ChatLegendClass;
  readonly anchorText: string;
  readonly priority: number;
  readonly expiresAtMs?: UnixMs;
  readonly channelId?: ChatChannelId;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface ChatLegendCeremony {
  readonly ceremonyId: ChatLegendCeremonyId;
  readonly title: string;
  readonly subtitle?: string;
  readonly phraseId?: ChatLegendPhraseId;
  readonly auraId?: ChatLegendAuraId;
  readonly badgeId?: ChatLegendBadgeId;
  readonly titleId?: ChatLegendTitleId;
  readonly preRevealDelayMs: UnixMs;
  readonly postRevealSilenceMs: UnixMs;
  readonly crowdBeatCount: number;
  readonly allowInterruptions: boolean;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface ChatLegendCooldown {
  readonly policy: ChatLegendCooldownPolicy;
  readonly key: string;
  readonly durationMs: UnixMs;
  readonly startedAtMs: UnixMs;
  readonly expiresAtMs: UnixMs;
}

export interface ChatLegendArchiveEntry {
  readonly archiveEntryId: ChatLegendArchiveEntryId;
  readonly archiveScope: ChatLegendArchiveScope;
  readonly archiveKey: ChatLegendArchiveKey;
  readonly legendId: ChatLegendId;
  readonly class: ChatLegendClass;
  readonly tier: ChatLegendTier;
  readonly severity: ChatLegendSeverity;
  readonly summary: string;
  readonly label: string;
  readonly createdAtMs: UnixMs;
  readonly replayId?: ChatReplayId;
  readonly callbackCount: number;
  readonly witnessCount: number;
  readonly artifactCount: number;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface ChatLegendReplayLink {
  readonly replayId: ChatReplayId;
  readonly replayKey: ChatLegendReplayKey;
  readonly startMessageId?: ChatMessageId;
  readonly endMessageId?: ChatMessageId;
  readonly sceneKey?: ChatLegendSceneKey;
  readonly isPublic: boolean;
  readonly generatedAtMs: UnixMs;
}

export interface ChatLegendRewardHintPacket {
  readonly hints: readonly ChatLegendRewardHint[];
  readonly phraseCandidates: readonly string[];
  readonly badgeCandidates: readonly string[];
  readonly auraCandidates: readonly string[];
  readonly titleCandidates: readonly string[];
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface ChatLegendTriggerContext {
  readonly sessionId: ChatSessionId;
  readonly roomId: ChatRoomId;
  readonly playerUserId: ChatUserId;
  readonly class: ChatLegendClass;
  readonly sourceChannelId: ChatChannelId;
  readonly visibleChannelId?: ChatChannelId;
  readonly shadowChannelId?: ChatShadowChannel;
  readonly runClockMs: UnixMs;
  readonly occurredAtMs: UnixMs;
  readonly pressure: ChatLegendPressureSnapshot;
  readonly tags: readonly ChatLegendOutcomeTag[];
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface ChatLegendScoreBreakdown {
  readonly baseScore100: Score100;
  readonly pressureScore100: Score100;
  readonly proofScore100: Score100;
  readonly witnessScore100: Score100;
  readonly timingScore100: Score100;
  readonly reversalScore100: Score100;
  readonly prestigeScore100: Score100;
  readonly finalScore100: Score100;
}

export interface ChatLegendThresholds {
  readonly notableMin: Score100;
  readonly majorMin: Score100;
  readonly historicMin: Score100;
  readonly runDefiningMin: Score100;
  readonly ascendantMin: Score100;
  readonly mythicMin: Score100;
  readonly immortalMin: Score100;
}

export interface ChatLegendPolicy {
  readonly thresholds: ChatLegendThresholds;
  readonly minWitnessCount: number;
  readonly minProofLevel: ChatLegendProofLevel;
  readonly requiredVisibleSurfaces: readonly ChatLegendPresentationSurface[];
  readonly defaultVisibility: ChatLegendVisibility;
  readonly defaultArchiveScope: ChatLegendArchiveScope;
  readonly defaultCooldownPolicy: ChatLegendCooldownPolicy;
  readonly allowShadowOrigin: boolean;
  readonly allowPrivateLegends: boolean;
  readonly allowDealRoomLegends: boolean;
  readonly allowCeremonialBroadcast: boolean;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface ChatLegendEvent {
  readonly legendId: ChatLegendId;
  readonly class: ChatLegendClass;
  readonly tier: ChatLegendTier;
  readonly severity: ChatLegendSeverity;
  readonly trigger: ChatLegendTriggerContext;
  readonly proof: ChatLegendProofPacket;
  readonly witnesses: readonly ChatLegendWitness[];
  readonly score: ChatLegendScoreBreakdown;
  readonly narrative: ChatLegendNarrativeFrame;
  readonly presentation: ChatLegendPresentationPlan;
  readonly artifacts: readonly ChatLegendArtifact[];
  readonly callbacks: readonly ChatLegendCallbackHook[];
  readonly archiveEntry: ChatLegendArchiveEntry;
  readonly replay?: ChatLegendReplayLink;
  readonly ceremony?: ChatLegendCeremony;
  readonly rewardHintPacket: ChatLegendRewardHintPacket;
  readonly cooldown?: ChatLegendCooldown;
  readonly isReplaySafe: boolean;
  readonly isRewardEligible: boolean;
  readonly isCeremonial: boolean;
  readonly isPublicArtifact: boolean;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface ChatLegendClassifierInput {
  readonly class: ChatLegendClass;
  readonly pressure: ChatLegendPressureSnapshot;
  readonly witnessCount: number;
  readonly proofLevel: ChatLegendProofLevel;
  readonly tags: readonly ChatLegendOutcomeTag[];
  readonly hasReplay: boolean;
  readonly hasVisibleWitness: boolean;
  readonly underTimePressure: boolean;
  readonly underShieldPressure: boolean;
  readonly fromShadow: boolean;
}

export interface ChatLegendRollup {
  readonly totalLegends: number;
  readonly byClass: Readonly<Record<ChatLegendClass, number>>;
  readonly byTier: Readonly<Record<ChatLegendTier, number>>;
  readonly bySeverity: Readonly<Record<ChatLegendSeverity, number>>;
  readonly publicCount: number;
  readonly ceremonialCount: number;
  readonly replaySafeCount: number;
  readonly rewardEligibleCount: number;
  readonly lastOccurredAtMs?: UnixMs;
}

export interface ChatLegendManifestEntry {
  readonly key: 'ChatLegend';
  readonly version: typeof CHAT_LEGEND_CONTRACT_VERSION;
  readonly publicApiVersion: typeof CHAT_LEGEND_PUBLIC_API_VERSION;
  readonly revision: typeof CHAT_LEGEND_REVISION;
  readonly path: '/shared/contracts/chat/ChatLegend.ts';
  readonly dependsOn: readonly string[];
  readonly authorities: typeof CHAT_CONTRACT_AUTHORITIES;
  readonly classes: readonly ChatLegendClass[];
  readonly tiers: readonly ChatLegendTier[];
  readonly severities: readonly ChatLegendSeverity[];
}

// ============================================================================
// MARK: Thresholds and defaults
// ============================================================================

export const DEFAULT_CHAT_LEGEND_THRESHOLDS: ChatLegendThresholds = Object.freeze({
  notableMin: 67 as Score100,
  majorMin: 78 as Score100,
  historicMin: 88 as Score100,
  runDefiningMin: 95 as Score100,
  ascendantMin: 74 as Score100,
  mythicMin: 86 as Score100,
  immortalMin: 96 as Score100,
});

export const DEFAULT_CHAT_LEGEND_POLICY: ChatLegendPolicy = Object.freeze({
  thresholds: DEFAULT_CHAT_LEGEND_THRESHOLDS,
  minWitnessCount: 1,
  minProofLevel: 'WITNESSED',
  requiredVisibleSurfaces: ['CHAT_PANEL'],
  defaultVisibility: CHAT_LEGEND_DEFAULT_VISIBILITY,
  defaultArchiveScope: CHAT_LEGEND_DEFAULT_ARCHIVE_SCOPE,
  defaultCooldownPolicy: CHAT_LEGEND_DEFAULT_COOLDOWN_POLICY,
  allowShadowOrigin: true,
  allowPrivateLegends: true,
  allowDealRoomLegends: true,
  allowCeremonialBroadcast: true,
  metadata: Object.freeze({}),
});

// ============================================================================
// MARK: Guards
// ============================================================================

export function isChatLegendClass(value: string): value is ChatLegendClass {
  return (CHAT_LEGEND_CLASSES as readonly string[]).includes(value);
}

export function isChatLegendTier(value: string): value is ChatLegendTier {
  return (CHAT_LEGEND_TIERS as readonly string[]).includes(value);
}

export function isChatLegendSeverity(value: string): value is ChatLegendSeverity {
  return (CHAT_LEGEND_SEVERITY as readonly string[]).includes(value);
}

export function isChatLegendVisibility(value: string): value is ChatLegendVisibility {
  return (CHAT_LEGEND_VISIBILITY as readonly string[]).includes(value);
}

export function isChatLegendArtifactType(
  value: string,
): value is ChatLegendArtifactType {
  return (CHAT_LEGEND_ARTIFACT_TYPES as readonly string[]).includes(value);
}

export function isChatLegendWitnessRole(
  value: string,
): value is ChatLegendWitnessRole {
  return (CHAT_LEGEND_WITNESS_ROLES as readonly string[]).includes(value);
}

export function isChatLegendCallbackMode(
  value: string,
): value is ChatLegendCallbackMode {
  return (CHAT_LEGEND_CALLBACK_MODES as readonly string[]).includes(value);
}

export function isChatLegendArchiveScope(
  value: string,
): value is ChatLegendArchiveScope {
  return (CHAT_LEGEND_ARCHIVE_SCOPES as readonly string[]).includes(value);
}

export function isChatLegendPresentationSurface(
  value: string,
): value is ChatLegendPresentationSurface {
  return (CHAT_LEGEND_PRESENTATION_SURFACES as readonly string[]).includes(value);
}

export function isChatLegendProofLevel(
  value: string,
): value is ChatLegendProofLevel {
  return (CHAT_LEGEND_PROOF_LEVELS as readonly string[]).includes(value);
}

export function isChatLegendCooldownPolicy(
  value: string,
): value is ChatLegendCooldownPolicy {
  return (CHAT_LEGEND_COOLDOWN_POLICIES as readonly string[]).includes(value);
}

export function isChatLegendOutcomeTag(
  value: string,
): value is ChatLegendOutcomeTag {
  return (CHAT_LEGEND_OUTCOME_TAGS as readonly string[]).includes(value);
}

export function isChatLegendRewardHint(
  value: string,
): value is ChatLegendRewardHint {
  return (CHAT_LEGEND_REWARD_HINTS as readonly string[]).includes(value);
}

// ============================================================================
// MARK: Brand helpers
// ============================================================================

export function asChatLegendArtifactId(value: string): ChatLegendArtifactId {
  return value as ChatLegendArtifactId;
}

export function asChatLegendWitnessId(value: string): ChatLegendWitnessId {
  return value as ChatLegendWitnessId;
}

export function asChatLegendArchiveEntryId(
  value: string,
): ChatLegendArchiveEntryId {
  return value as ChatLegendArchiveEntryId;
}

export function asChatLegendCeremonyId(value: string): ChatLegendCeremonyId {
  return value as ChatLegendCeremonyId;
}

export function asChatLegendPhraseId(value: string): ChatLegendPhraseId {
  return value as ChatLegendPhraseId;
}

export function asChatLegendAuraId(value: string): ChatLegendAuraId {
  return value as ChatLegendAuraId;
}

export function asChatLegendTitleId(value: string): ChatLegendTitleId {
  return value as ChatLegendTitleId;
}

export function asChatLegendBadgeId(value: string): ChatLegendBadgeId {
  return value as ChatLegendBadgeId;
}

export function asChatLegendBundleId(value: string): ChatLegendBundleId {
  return value as ChatLegendBundleId;
}

export function asChatLegendSurfaceId(value: string): ChatLegendSurfaceId {
  return value as ChatLegendSurfaceId;
}

export function asChatLegendCallbackId(value: string): ChatLegendCallbackId {
  return value as ChatLegendCallbackId;
}

export function asChatLegendProofPacketId(
  value: string,
): ChatLegendProofPacketId {
  return value as ChatLegendProofPacketId;
}

export function asChatLegendSequenceId(value: string): ChatLegendSequenceId {
  return value as ChatLegendSequenceId;
}

export function asChatLegendRuleId(value: string): ChatLegendRuleId {
  return value as ChatLegendRuleId;
}

export function asChatLegendArchiveKey(value: string): ChatLegendArchiveKey {
  return value as ChatLegendArchiveKey;
}

export function asChatLegendReplayKey(value: string): ChatLegendReplayKey {
  return value as ChatLegendReplayKey;
}

export function asChatLegendSceneKey(value: string): ChatLegendSceneKey {
  return value as ChatLegendSceneKey;
}

// ============================================================================
// MARK: Score helpers
// ============================================================================

export function clamp01(value: number): Score01 {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return clamped as Score01;
}

export function clamp100(value: number): Score100 {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return Math.round(clamped) as Score100;
}

export function asUnixMs(value: number): UnixMs {
  return Math.max(0, Math.trunc(Number.isFinite(value) ? value : 0)) as UnixMs;
}

export function asPercentage(value: number): Percentage {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)) as Percentage;
}

export function averageScore01(values: readonly Score01[]): Score01 {
  if (!values.length) return clamp01(0);
  const total = values.reduce((sum, value) => sum + Number(value), 0);
  return clamp01(total / values.length);
}

export function averageScore100(values: readonly Score100[]): Score100 {
  if (!values.length) return clamp100(0);
  const total = values.reduce((sum, value) => sum + Number(value), 0);
  return clamp100(total / values.length);
}

// ============================================================================
// MARK: Pressure helpers
// ============================================================================

export function createEmptyLegendPressureSnapshot(): ChatLegendPressureSnapshot {
  return Object.freeze({
    intimidation: clamp01(0),
    confidence: clamp01(0),
    frustration: clamp01(0),
    trust: clamp01(0),
    desperation: clamp01(0),
    dominance: clamp01(0),
    crowdHeat: clamp01(0),
    timePressure: clamp01(0),
    shieldDanger: clamp01(0),
    riskOfCollapse: clamp01(0),
  });
}

export function normalizeLegendPressureSnapshot(
  value: Partial<ChatLegendPressureSnapshot> | undefined,
): ChatLegendPressureSnapshot {
  const source = value ?? {};
  return Object.freeze({
    intimidation: clamp01(Number(source.intimidation ?? 0)),
    confidence: clamp01(Number(source.confidence ?? 0)),
    frustration: clamp01(Number(source.frustration ?? 0)),
    trust: clamp01(Number(source.trust ?? 0)),
    desperation: clamp01(Number(source.desperation ?? 0)),
    dominance: clamp01(Number(source.dominance ?? 0)),
    crowdHeat: clamp01(Number(source.crowdHeat ?? 0)),
    timePressure: clamp01(Number(source.timePressure ?? 0)),
    shieldDanger: clamp01(Number(source.shieldDanger ?? 0)),
    riskOfCollapse: clamp01(Number(source.riskOfCollapse ?? 0)),
  });
}

export function computeLegendPressureWeight(
  pressure: ChatLegendPressureSnapshot,
): Score100 {
  const score =
    Number(pressure.timePressure) * 18 +
    Number(pressure.shieldDanger) * 18 +
    Number(pressure.riskOfCollapse) * 18 +
    Number(pressure.crowdHeat) * 12 +
    Number(pressure.intimidation) * 8 +
    Number(pressure.desperation) * 10 +
    Number(pressure.dominance) * 8 +
    Number(pressure.confidence) * 4 +
    Number(pressure.trust) * 2 +
    Number(pressure.frustration) * 2;
  return clamp100(score);
}

// ============================================================================
// MARK: Witness helpers
// ============================================================================

export function createLegendWitness(
  input: Omit<ChatLegendWitness, 'witnessId'> & {
    readonly witnessId?: ChatLegendWitnessId;
  },
): ChatLegendWitness {
  const witnessId =
    input.witnessId ??
    asChatLegendWitnessId(
      `legend-witness:${String(input.role).toLowerCase()}:${String(
        input.timestampMs,
      )}:${String(input.channelId)}`,
    );

  return Object.freeze({
    witnessId,
    role: input.role,
    userId: input.userId,
    npcId: input.npcId,
    relationshipId: input.relationshipId,
    channelId: input.channelId,
    statementHash: input.statementHash,
    credibility: clamp01(Number(input.credibility)),
    excitement: clamp01(Number(input.excitement)),
    hostility: clamp01(Number(input.hostility)),
    timestampMs: asUnixMs(Number(input.timestampMs)),
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}

export function normalizeLegendWitnesses(
  witnesses: readonly ChatLegendWitness[] | undefined,
): readonly ChatLegendWitness[] {
  return Object.freeze(
    (witnesses ?? [])
      .slice(0, CHAT_LEGEND_MAX_WITNESS_COUNT)
      .map((witness) => createLegendWitness(witness))
      .sort((a, b) => Number(a.timestampMs) - Number(b.timestampMs)),
  );
}

export function computeWitnessPrestigeScore(
  witnesses: readonly ChatLegendWitness[],
): Score100 {
  if (!witnesses.length) return clamp100(0);
  const credibility = averageScore01(witnesses.map((w) => w.credibility));
  const excitement = averageScore01(witnesses.map((w) => w.excitement));
  const diversityCount = new Set(witnesses.map((w) => w.role)).size;
  const diversityWeight = Math.min(1, diversityCount / CHAT_LEGEND_WITNESS_ROLES.length);
  return clamp100(
    Number(credibility) * 45 +
      Number(excitement) * 25 +
      witnesses.length * 3 +
      diversityWeight * 20,
  );
}

// ============================================================================
// MARK: Proof helpers
// ============================================================================

export function rankLegendProofLevel(level: ChatLegendProofLevel): number {
  switch (level) {
    case 'DECLARED':
      return 1;
    case 'WITNESSED':
      return 2;
    case 'HASHED':
      return 3;
    case 'REPLAY_SAFE':
      return 4;
    case 'CEREMONIAL':
      return 5;
    default:
      return 0;
  }
}

export function createLegendProofPacket(
  input: Omit<ChatLegendProofPacket, 'proofPacketId'> & {
    readonly proofPacketId?: ChatLegendProofPacketId;
  },
): ChatLegendProofPacket {
  const proofPacketId =
    input.proofPacketId ??
    asChatLegendProofPacketId(
      `legend-proof:${String(input.recordedAtMs)}:${String(input.replayId ?? 'none')}`,
    );

  return Object.freeze({
    proofPacketId,
    level: input.level,
    proofHashes: Object.freeze([...(input.proofHashes ?? [])]),
    causalMessageIds: Object.freeze([...(input.causalMessageIds ?? [])]),
    sceneId: input.sceneId,
    momentId: input.momentId,
    replayId: input.replayId,
    replayKey: input.replayKey,
    worldEventId: input.worldEventId,
    recordedAtMs: asUnixMs(Number(input.recordedAtMs)),
    integrityScore: clamp01(Number(input.integrityScore)),
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}

export function computeLegendProofScore(
  proof: ChatLegendProofPacket,
): Score100 {
  const levelScore = rankLegendProofLevel(proof.level) * 18;
  const hashScore = Math.min(20, proof.proofHashes.length * 4);
  const causalScore = Math.min(18, proof.causalMessageIds.length * 2);
  const replayScore = proof.replayId ? 16 : 0;
  const integrityScore = Number(proof.integrityScore) * 20;
  return clamp100(levelScore + hashScore + causalScore + replayScore + integrityScore);
}

// ============================================================================
// MARK: Narrative helpers
// ============================================================================

export function createLegendNarrativeFrame(
  input: Partial<ChatLegendNarrativeFrame>,
  fallbackClass: ChatLegendClass,
): ChatLegendNarrativeFrame {
  const summary = truncateString(
    input.summary ??
      `${humanizeLegendClass(fallbackClass)} entered prestige territory.`,
    CHAT_LEGEND_MAX_SUMMARY_LENGTH,
  );

  return Object.freeze({
    opener: truncateString(input.opener ?? summary, CHAT_LEGEND_MAX_SUMMARY_LENGTH),
    turningPoint: truncateString(
      input.turningPoint ?? summary,
      CHAT_LEGEND_MAX_SUMMARY_LENGTH,
    ),
    closer: truncateString(input.closer ?? summary, CHAT_LEGEND_MAX_SUMMARY_LENGTH),
    summary,
    callbackSeed: input.callbackSeed
      ? truncateString(input.callbackSeed, CHAT_LEGEND_MAX_SUMMARY_LENGTH)
      : undefined,
    archiveLabel: truncateString(
      input.archiveLabel ?? humanizeLegendClass(fallbackClass),
      CHAT_LEGEND_MAX_TITLE_LENGTH,
    ),
  });
}

// ============================================================================
// MARK: Presentation helpers
// ============================================================================

export function createLegendPresentationPlan(
  input: Partial<ChatLegendPresentationPlan> & Pick<ChatLegendPresentationPlan, 'primaryChannelId'>,
): ChatLegendPresentationPlan {
  const mirroredChannelIds = dedupeChannels(input.mirroredChannelIds ?? []);
  const surfaces = dedupeLegendSurfaces(input.surfaces ?? ['CHAT_PANEL']);

  return Object.freeze({
    visibility: input.visibility ?? CHAT_LEGEND_DEFAULT_VISIBILITY,
    primaryChannelId: input.primaryChannelId,
    mirroredChannelIds,
    surfaces,
    ceremonialDelayMs: asUnixMs(Number(input.ceremonialDelayMs ?? 0)),
    useMomentFlash: Boolean(input.useMomentFlash ?? surfaces.includes('MOMENT_FLASH')),
    useProofCard: Boolean(
      input.useProofCard ??
        surfaces.includes('PROOF_CARD') ||
        surfaces.includes('PROOF_CARD_V2'),
    ),
    useBanner: Boolean(
      input.useBanner ??
        surfaces.includes('SYSTEM_BANNER' as never) ||
        surfaces.includes('EMPIRE_BLEED_BANNER') ||
        surfaces.includes('RESCUE_WINDOW_BANNER'),
    ),
    useAuraPreview: Boolean(input.useAuraPreview ?? false),
    silenceAfterRevealMs: asUnixMs(Number(input.silenceAfterRevealMs ?? 0)),
  });
}

export function dedupeLegendSurfaces(
  surfaces: readonly ChatLegendPresentationSurface[],
): readonly ChatLegendPresentationSurface[] {
  const allowed = new Set<ChatLegendPresentationSurface>();
  const result: ChatLegendPresentationSurface[] = [];
  for (const surface of surfaces) {
    if (!isChatLegendPresentationSurface(surface)) continue;
    if (allowed.has(surface)) continue;
    allowed.add(surface);
    result.push(surface);
    if (result.length >= CHAT_LEGEND_MAX_SURFACE_COUNT) break;
  }
  return Object.freeze(result);
}

// ============================================================================
// MARK: Artifact helpers
// ============================================================================

export function createLegendArtifact(
  input: Omit<ChatLegendArtifact, 'artifactId'> & {
    readonly artifactId?: ChatLegendArtifactId;
  },
): ChatLegendArtifact {
  const artifactId =
    input.artifactId ??
    asChatLegendArtifactId(
      `legend-artifact:${String(input.type).toLowerCase()}:${String(input.sortOrder)}`,
    );

  return Object.freeze({
    artifactId,
    type: input.type,
    label: truncateString(input.label, CHAT_LEGEND_MAX_TITLE_LENGTH),
    description: truncateString(input.description, CHAT_LEGEND_MAX_SUMMARY_LENGTH),
    surfaceId: input.surfaceId,
    sortOrder: Math.max(0, Math.trunc(input.sortOrder)),
    unlockHint: input.unlockHint,
    visibleToPlayer: Boolean(input.visibleToPlayer),
    payload: Object.freeze({ ...(input.payload ?? {}) }),
  });
}

export function normalizeLegendArtifacts(
  artifacts: readonly ChatLegendArtifact[] | undefined,
): readonly ChatLegendArtifact[] {
  return Object.freeze(
    (artifacts ?? [])
      .slice(0, CHAT_LEGEND_MAX_ARTIFACTS)
      .map((artifact) => createLegendArtifact(artifact))
      .sort((a, b) => a.sortOrder - b.sortOrder),
  );
}

// ============================================================================
// MARK: Callback helpers
// ============================================================================

export function createLegendCallbackHook(
  input: Omit<ChatLegendCallbackHook, 'callbackId'> & {
    readonly callbackId?: ChatLegendCallbackId;
  },
): ChatLegendCallbackHook {
  const callbackId =
    input.callbackId ??
    asChatLegendCallbackId(
      `legend-callback:${String(input.mode).toLowerCase()}:${String(
        input.class,
      ).toLowerCase()}:${String(input.priority)}`,
    );

  return Object.freeze({
    callbackId,
    mode: input.mode,
    class: input.class,
    anchorText: truncateString(input.anchorText, CHAT_LEGEND_MAX_SUMMARY_LENGTH),
    priority: Math.max(0, Math.trunc(input.priority)),
    expiresAtMs:
      input.expiresAtMs === undefined ? undefined : asUnixMs(Number(input.expiresAtMs)),
    channelId: input.channelId,
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}

export function normalizeLegendCallbacks(
  callbacks: readonly ChatLegendCallbackHook[] | undefined,
): readonly ChatLegendCallbackHook[] {
  return Object.freeze(
    (callbacks ?? [])
      .slice(0, CHAT_LEGEND_MAX_CALLBACKS)
      .map((callback) => createLegendCallbackHook(callback))
      .sort((a, b) => b.priority - a.priority),
  );
}

// ============================================================================
// MARK: Ceremony helpers
// ============================================================================

export function createLegendCeremony(
  input: Partial<ChatLegendCeremony> & Pick<ChatLegendCeremony, 'title'>,
): ChatLegendCeremony {
  return Object.freeze({
    ceremonyId:
      input.ceremonyId ??
      asChatLegendCeremonyId(`legend-ceremony:${slugify(input.title)}`),
    title: truncateString(input.title, CHAT_LEGEND_MAX_TITLE_LENGTH),
    subtitle: input.subtitle
      ? truncateString(input.subtitle, CHAT_LEGEND_MAX_SUMMARY_LENGTH)
      : undefined,
    phraseId: input.phraseId,
    auraId: input.auraId,
    badgeId: input.badgeId,
    titleId: input.titleId,
    preRevealDelayMs: asUnixMs(Number(input.preRevealDelayMs ?? 0)),
    postRevealSilenceMs: asUnixMs(Number(input.postRevealSilenceMs ?? 0)),
    crowdBeatCount: Math.max(0, Math.trunc(input.crowdBeatCount ?? 0)),
    allowInterruptions: Boolean(input.allowInterruptions ?? false),
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}

// ============================================================================
// MARK: Cooldown helpers
// ============================================================================

export function createLegendCooldown(
  input: ChatLegendCooldown,
): ChatLegendCooldown {
  return Object.freeze({
    policy: input.policy,
    key: String(input.key),
    durationMs: asUnixMs(Number(input.durationMs)),
    startedAtMs: asUnixMs(Number(input.startedAtMs)),
    expiresAtMs: asUnixMs(Number(input.expiresAtMs)),
  });
}

export function isLegendCooldownActive(
  cooldown: ChatLegendCooldown | undefined,
  nowMs: UnixMs,
): boolean {
  return Boolean(cooldown && Number(cooldown.expiresAtMs) > Number(nowMs));
}

// ============================================================================
// MARK: Archive helpers
// ============================================================================

export function createLegendArchiveEntry(
  input: Omit<ChatLegendArchiveEntry, 'archiveEntryId'> & {
    readonly archiveEntryId?: ChatLegendArchiveEntryId;
  },
): ChatLegendArchiveEntry {
  const archiveEntryId =
    input.archiveEntryId ??
    asChatLegendArchiveEntryId(
      `legend-archive:${String(input.archiveScope).toLowerCase()}:${String(
        input.legendId,
      )}`,
    );

  return Object.freeze({
    archiveEntryId,
    archiveScope: input.archiveScope,
    archiveKey: input.archiveKey,
    legendId: input.legendId,
    class: input.class,
    tier: input.tier,
    severity: input.severity,
    summary: truncateString(input.summary, CHAT_LEGEND_MAX_SUMMARY_LENGTH),
    label: truncateString(input.label, CHAT_LEGEND_MAX_TITLE_LENGTH),
    createdAtMs: asUnixMs(Number(input.createdAtMs)),
    replayId: input.replayId,
    callbackCount: Math.max(0, Math.trunc(input.callbackCount)),
    witnessCount: Math.max(0, Math.trunc(input.witnessCount)),
    artifactCount: Math.max(0, Math.trunc(input.artifactCount)),
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}

// ============================================================================
// MARK: Replay helpers
// ============================================================================

export function createLegendReplayLink(
  input: ChatLegendReplayLink,
): ChatLegendReplayLink {
  return Object.freeze({
    replayId: input.replayId,
    replayKey: input.replayKey,
    startMessageId: input.startMessageId,
    endMessageId: input.endMessageId,
    sceneKey: input.sceneKey,
    isPublic: Boolean(input.isPublic),
    generatedAtMs: asUnixMs(Number(input.generatedAtMs)),
  });
}

// ============================================================================
// MARK: Reward hint helpers
// ============================================================================

export function createLegendRewardHintPacket(
  input: Partial<ChatLegendRewardHintPacket>,
): ChatLegendRewardHintPacket {
  return Object.freeze({
    hints: Object.freeze(
      dedupeStrings(input.hints ?? [])
        .filter((value): value is ChatLegendRewardHint => isChatLegendRewardHint(value))
        .slice(0, CHAT_LEGEND_MAX_REWARD_HINTS),
    ),
    phraseCandidates: Object.freeze(
      dedupeStrings(input.phraseCandidates ?? []).map((item) =>
        truncateString(item, CHAT_LEGEND_MAX_PHRASE_LENGTH),
      ),
    ),
    badgeCandidates: Object.freeze(
      dedupeStrings(input.badgeCandidates ?? []).map((item) =>
        truncateString(item, CHAT_LEGEND_MAX_TITLE_LENGTH),
      ),
    ),
    auraCandidates: Object.freeze(
      dedupeStrings(input.auraCandidates ?? []).map((item) =>
        truncateString(item, CHAT_LEGEND_MAX_AURA_KEY_LENGTH),
      ),
    ),
    titleCandidates: Object.freeze(
      dedupeStrings(input.titleCandidates ?? []).map((item) =>
        truncateString(item, CHAT_LEGEND_MAX_TITLE_LENGTH),
      ),
    ),
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}

// ============================================================================
// MARK: Trigger helpers
// ============================================================================

export function createLegendTriggerContext(
  input: ChatLegendTriggerContext,
): ChatLegendTriggerContext {
  return Object.freeze({
    sessionId: input.sessionId,
    roomId: input.roomId,
    playerUserId: input.playerUserId,
    class: input.class,
    sourceChannelId: input.sourceChannelId,
    visibleChannelId: input.visibleChannelId,
    shadowChannelId: input.shadowChannelId,
    runClockMs: asUnixMs(Number(input.runClockMs)),
    occurredAtMs: asUnixMs(Number(input.occurredAtMs)),
    pressure: normalizeLegendPressureSnapshot(input.pressure),
    tags: Object.freeze(dedupeOutcomeTags(input.tags)),
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}

// ============================================================================
// MARK: Classification helpers
// ============================================================================

export function computeLegendTimingScore(
  input: ChatLegendClassifierInput,
): Score100 {
  const pressureBonus = input.underTimePressure ? 16 : 0;
  const shieldBonus = input.underShieldPressure ? 12 : 0;
  const collapseBonus = input.tags.includes('REVERSAL') ? 18 : 0;
  const shadowBonus = input.fromShadow ? 6 : 0;
  const replayBonus = input.hasReplay ? 14 : 0;
  return clamp100(
    pressureBonus + shieldBonus + collapseBonus + shadowBonus + replayBonus,
  );
}

export function computeLegendReversalScore(
  input: ChatLegendClassifierInput,
): Score100 {
  const tagScore =
    (input.tags.includes('REVERSAL') ? 24 : 0) +
    (input.tags.includes('HUMILIATION') ? 16 : 0) +
    (input.tags.includes('REDEMPTION') ? 18 : 0) +
    (input.tags.includes('SURVIVAL') ? 12 : 0);
  const desperationWeight = Number(input.pressure.desperation) * 20;
  const confidenceWeight = Number(input.pressure.confidence) * 8;
  return clamp100(tagScore + desperationWeight + confidenceWeight);
}

export function computeLegendPrestigeScore(
  input: ChatLegendClassifierInput,
): Score100 {
  const classWeight = legendClassBaseWeight(input.class);
  const visibleWitnessBonus = input.hasVisibleWitness ? 12 : 0;
  const proofBonus = rankLegendProofLevel(input.proofLevel) * 10;
  const replayBonus = input.hasReplay ? 10 : 0;
  const shadowBonus = input.fromShadow ? 4 : 0;
  return clamp100(classWeight + visibleWitnessBonus + proofBonus + replayBonus + shadowBonus);
}

export function classifyLegendSeverity(
  score: Score100,
  thresholds: ChatLegendThresholds = DEFAULT_CHAT_LEGEND_THRESHOLDS,
): ChatLegendSeverity {
  const numeric = Number(score);
  if (numeric >= Number(thresholds.runDefiningMin)) return 'RUN_DEFINING';
  if (numeric >= Number(thresholds.historicMin)) return 'HISTORIC';
  if (numeric >= Number(thresholds.majorMin)) return 'MAJOR';
  return 'NOTABLE';
}

export function classifyLegendTier(
  score: Score100,
  thresholds: ChatLegendThresholds = DEFAULT_CHAT_LEGEND_THRESHOLDS,
): ChatLegendTier {
  const numeric = Number(score);
  if (numeric >= Number(thresholds.immortalMin)) return 'IMMORTAL';
  if (numeric >= Number(thresholds.mythicMin)) return 'MYTHIC';
  if (numeric >= Number(thresholds.ascendantMin)) return 'ASCENDANT';
  return 'ECHO';
}

export function buildLegendScoreBreakdown(
  input: ChatLegendClassifierInput,
  witnessScore100: Score100,
  proofScore100: Score100,
): ChatLegendScoreBreakdown {
  const baseScore100 = clamp100(legendClassBaseWeight(input.class));
  const pressureScore100 = computeLegendPressureWeight(input.pressure);
  const timingScore100 = computeLegendTimingScore(input);
  const reversalScore100 = computeLegendReversalScore(input);
  const prestigeScore100 = computeLegendPrestigeScore(input);

  const finalScore100 = clamp100(
    Number(baseScore100) * 0.18 +
      Number(pressureScore100) * 0.18 +
      Number(proofScore100) * 0.16 +
      Number(witnessScore100) * 0.16 +
      Number(timingScore100) * 0.12 +
      Number(reversalScore100) * 0.10 +
      Number(prestigeScore100) * 0.10,
  );

  return Object.freeze({
    baseScore100,
    pressureScore100,
    proofScore100,
    witnessScore100,
    timingScore100,
    reversalScore100,
    prestigeScore100,
    finalScore100,
  });
}

// ============================================================================
// MARK: Event helpers
// ============================================================================

export function createLegendEvent(
  input: ChatLegendEvent,
): ChatLegendEvent {
  return Object.freeze({
    legendId: input.legendId,
    class: input.class,
    tier: input.tier,
    severity: input.severity,
    trigger: createLegendTriggerContext(input.trigger),
    proof: createLegendProofPacket(input.proof),
    witnesses: normalizeLegendWitnesses(input.witnesses),
    score: Object.freeze({
      ...input.score,
      baseScore100: clamp100(Number(input.score.baseScore100)),
      pressureScore100: clamp100(Number(input.score.pressureScore100)),
      proofScore100: clamp100(Number(input.score.proofScore100)),
      witnessScore100: clamp100(Number(input.score.witnessScore100)),
      timingScore100: clamp100(Number(input.score.timingScore100)),
      reversalScore100: clamp100(Number(input.score.reversalScore100)),
      prestigeScore100: clamp100(Number(input.score.prestigeScore100)),
      finalScore100: clamp100(Number(input.score.finalScore100)),
    }),
    narrative: createLegendNarrativeFrame(input.narrative, input.class),
    presentation: createLegendPresentationPlan(input.presentation),
    artifacts: normalizeLegendArtifacts(input.artifacts),
    callbacks: normalizeLegendCallbacks(input.callbacks),
    archiveEntry: createLegendArchiveEntry(input.archiveEntry),
    replay: input.replay ? createLegendReplayLink(input.replay) : undefined,
    ceremony: input.ceremony ? createLegendCeremony(input.ceremony) : undefined,
    rewardHintPacket: createLegendRewardHintPacket(input.rewardHintPacket),
    cooldown: input.cooldown ? createLegendCooldown(input.cooldown) : undefined,
    isReplaySafe: Boolean(input.isReplaySafe),
    isRewardEligible: Boolean(input.isRewardEligible),
    isCeremonial: Boolean(input.isCeremonial),
    isPublicArtifact: Boolean(input.isPublicArtifact),
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}

export function isLegendRewardEligible(
  event: ChatLegendEvent,
  policy: ChatLegendPolicy = DEFAULT_CHAT_LEGEND_POLICY,
): boolean {
  if (!event.isRewardEligible) return false;
  if (event.witnesses.length < policy.minWitnessCount) return false;
  if (
    rankLegendProofLevel(event.proof.level) <
    rankLegendProofLevel(policy.minProofLevel)
  ) {
    return false;
  }
  return Number(event.score.finalScore100) >= CHAT_LEGEND_MIN_SCORE_FOR_CLASSIFICATION;
}

export function isLegendReplaySafe(event: ChatLegendEvent): boolean {
  return Boolean(
    event.isReplaySafe &&
      event.replay &&
      event.proof.replayId &&
      rankLegendProofLevel(event.proof.level) >= rankLegendProofLevel('REPLAY_SAFE'),
  );
}

// ============================================================================
// MARK: Rollup helpers
// ============================================================================

export function createEmptyLegendRollup(): ChatLegendRollup {
  return Object.freeze({
    totalLegends: 0,
    byClass: Object.freeze(createLegendClassCounter()),
    byTier: Object.freeze(createLegendTierCounter()),
    bySeverity: Object.freeze(createLegendSeverityCounter()),
    publicCount: 0,
    ceremonialCount: 0,
    replaySafeCount: 0,
    rewardEligibleCount: 0,
    lastOccurredAtMs: undefined,
  });
}

export function reduceLegendRollup(
  events: readonly ChatLegendEvent[],
): ChatLegendRollup {
  const classCounter = createLegendClassCounter();
  const tierCounter = createLegendTierCounter();
  const severityCounter = createLegendSeverityCounter();

  let publicCount = 0;
  let ceremonialCount = 0;
  let replaySafeCount = 0;
  let rewardEligibleCount = 0;
  let lastOccurredAtMs: UnixMs | undefined;

  for (const event of events) {
    classCounter[event.class] += 1;
    tierCounter[event.tier] += 1;
    severityCounter[event.severity] += 1;

    if (event.isPublicArtifact) publicCount += 1;
    if (event.isCeremonial) ceremonialCount += 1;
    if (isLegendReplaySafe(event)) replaySafeCount += 1;
    if (isLegendRewardEligible(event)) rewardEligibleCount += 1;

    if (
      lastOccurredAtMs === undefined ||
      Number(event.trigger.occurredAtMs) > Number(lastOccurredAtMs)
    ) {
      lastOccurredAtMs = event.trigger.occurredAtMs;
    }
  }

  return Object.freeze({
    totalLegends: events.length,
    byClass: Object.freeze(classCounter),
    byTier: Object.freeze(tierCounter),
    bySeverity: Object.freeze(severityCounter),
    publicCount,
    ceremonialCount,
    replaySafeCount,
    rewardEligibleCount,
    lastOccurredAtMs,
  });
}

// ============================================================================
// MARK: Template helpers
// ============================================================================

export interface ChatLegendTemplate {
  readonly class: ChatLegendClass;
  readonly defaultTags: readonly ChatLegendOutcomeTag[];
  readonly preferredSurfaces: readonly ChatLegendPresentationSurface[];
  readonly rewardHints: readonly ChatLegendRewardHint[];
  readonly ceremonialByDefault: boolean;
  readonly publicByDefault: boolean;
  readonly archiveScope: ChatLegendArchiveScope;
  readonly proofFloor: ChatLegendProofLevel;
}

export const CHAT_LEGEND_TEMPLATES: Readonly<Record<ChatLegendClass, ChatLegendTemplate>> =
  Object.freeze({
    SOVEREIGNTY_UNDER_PRESSURE: Object.freeze({
      class: 'SOVEREIGNTY_UNDER_PRESSURE',
      defaultTags: ['TRIUMPH', 'DOMINANCE'],
      preferredSurfaces: ['CHAT_PANEL', 'MOMENT_FLASH', 'PROOF_CARD_V2'],
      rewardHints: ['TITLE', 'AURA', 'BADGE'],
      ceremonialByDefault: true,
      publicByDefault: true,
      archiveScope: 'SEASON',
      proofFloor: 'REPLAY_SAFE',
    }),
    PERFECT_COUNTERPLAY: Object.freeze({
      class: 'PERFECT_COUNTERPLAY',
      defaultTags: ['TRIUMPH', 'REVERSAL'],
      preferredSurfaces: ['CHAT_PANEL', 'COUNTERPLAY_MODAL', 'PROOF_CARD'],
      rewardHints: ['PHRASE', 'BADGE', 'REPLAY_UNLOCK'],
      ceremonialByDefault: false,
      publicByDefault: true,
      archiveScope: 'RUN',
      proofFloor: 'HASHED',
    }),
    HUMILIATING_HATER_REVERSAL: Object.freeze({
      class: 'HUMILIATING_HATER_REVERSAL',
      defaultTags: ['HUMILIATION', 'REVERSAL', 'TRIUMPH'],
      preferredSurfaces: ['CHAT_PANEL', 'MOMENT_FLASH', 'THREAT_RADAR_PANEL'],
      rewardHints: ['PHRASE', 'BADGE', 'AURA'],
      ceremonialByDefault: true,
      publicByDefault: true,
      archiveScope: 'PLAYER',
      proofFloor: 'HASHED',
    }),
    MIRACLE_RESCUE: Object.freeze({
      class: 'MIRACLE_RESCUE',
      defaultTags: ['SURVIVAL', 'REDEMPTION'],
      preferredSurfaces: ['CHAT_PANEL', 'RESCUE_WINDOW_BANNER', 'PROOF_CARD'],
      rewardHints: ['TITLE', 'BADGE', 'REPLAY_UNLOCK'],
      ceremonialByDefault: false,
      publicByDefault: true,
      archiveScope: 'RUN',
      proofFloor: 'WITNESSED',
    }),
    LAST_SECOND_COMEBACK: Object.freeze({
      class: 'LAST_SECOND_COMEBACK',
      defaultTags: ['REVERSAL', 'SURVIVAL', 'TRIUMPH'],
      preferredSurfaces: ['CHAT_PANEL', 'MOMENT_FLASH', 'EMPIRE_BLEED_BANNER'],
      rewardHints: ['PHRASE', 'BADGE'],
      ceremonialByDefault: false,
      publicByDefault: true,
      archiveScope: 'RUN',
      proofFloor: 'HASHED',
    }),
    NEGOTIATION_HEIST: Object.freeze({
      class: 'NEGOTIATION_HEIST',
      defaultTags: ['TRIUMPH', 'RUMOR'],
      preferredSurfaces: ['CHAT_PANEL', 'COUNTERPLAY_MODAL', 'PROOF_CARD_V2'],
      rewardHints: ['TITLE', 'PHRASE', 'AURA'],
      ceremonialByDefault: false,
      publicByDefault: false,
      archiveScope: 'PLAYER',
      proofFloor: 'HASHED',
    }),
    WITNESS_CASCADE: Object.freeze({
      class: 'WITNESS_CASCADE',
      defaultTags: ['RUMOR', 'DOMINANCE'],
      preferredSurfaces: ['CHAT_PANEL', 'MOMENT_FLASH'],
      rewardHints: ['BADGE', 'NONE'],
      ceremonialByDefault: false,
      publicByDefault: true,
      archiveScope: 'GLOBAL',
      proofFloor: 'WITNESSED',
    }),
    CROWD_CONVERSION: Object.freeze({
      class: 'CROWD_CONVERSION',
      defaultTags: ['TRIUMPH', 'REDEMPTION'],
      preferredSurfaces: ['CHAT_PANEL', 'LEAGUE_UI', 'PROOF_CARD'],
      rewardHints: ['TITLE', 'BADGE'],
      ceremonialByDefault: true,
      publicByDefault: true,
      archiveScope: 'SEASON',
      proofFloor: 'WITNESSED',
    }),
    BOSS_FIGHT_CONTAINMENT: Object.freeze({
      class: 'BOSS_FIGHT_CONTAINMENT',
      defaultTags: ['SURVIVAL', 'DOMINANCE'],
      preferredSurfaces: ['CHAT_PANEL', 'COUNTERPLAY_MODAL', 'THREAT_RADAR_PANEL'],
      rewardHints: ['AURA', 'BADGE', 'REPLAY_UNLOCK'],
      ceremonialByDefault: false,
      publicByDefault: true,
      archiveScope: 'RUN',
      proofFloor: 'REPLAY_SAFE',
    }),
    SHADOW_REVEAL_PERFECTION: Object.freeze({
      class: 'SHADOW_REVEAL_PERFECTION',
      defaultTags: ['REVERSAL', 'RUMOR'],
      preferredSurfaces: ['CHAT_PANEL', 'PROOF_CARD_V2'],
      rewardHints: ['PHRASE', 'AURA'],
      ceremonialByDefault: false,
      publicByDefault: true,
      archiveScope: 'PLAYER',
      proofFloor: 'HASHED',
    }),
  });

export function getLegendTemplate(legendClass: ChatLegendClass): ChatLegendTemplate {
  return CHAT_LEGEND_TEMPLATES[legendClass];
}

// ============================================================================
// MARK: Comparators and sorting
// ============================================================================

export function compareLegendEventsNewestFirst(
  left: ChatLegendEvent,
  right: ChatLegendEvent,
): number {
  const byTime = Number(right.trigger.occurredAtMs) - Number(left.trigger.occurredAtMs);
  if (byTime !== 0) return byTime;
  return Number(right.score.finalScore100) - Number(left.score.finalScore100);
}

export function compareLegendEventsPrestigeFirst(
  left: ChatLegendEvent,
  right: ChatLegendEvent,
): number {
  const byScore = Number(right.score.finalScore100) - Number(left.score.finalScore100);
  if (byScore !== 0) return byScore;
  return compareLegendEventsNewestFirst(left, right);
}

// ============================================================================
// MARK: Utility helpers
// ============================================================================

export function humanizeLegendClass(value: ChatLegendClass): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function truncateString(value: string, maxLength: number): string {
  const normalized = String(value ?? '').trim();
  if (normalized.length <= maxLength) return normalized;
  return normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd() + '…';
}

export function dedupeStrings(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = String(value);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return Object.freeze(result);
}

export function dedupeOutcomeTags(
  values: readonly ChatLegendOutcomeTag[],
): readonly ChatLegendOutcomeTag[] {
  const seen = new Set<ChatLegendOutcomeTag>();
  const result: ChatLegendOutcomeTag[] = [];
  for (const value of values) {
    if (!isChatLegendOutcomeTag(value)) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return Object.freeze(result);
}

export function dedupeChannels(
  values: readonly ChatChannelId[],
): readonly ChatChannelId[] {
  const allowed = new Set<ChatChannelId>();
  const result: ChatChannelId[] = [];
  for (const value of values) {
    if (!(CHAT_ALL_CHANNELS as readonly string[]).includes(value)) continue;
    if (allowed.has(value)) continue;
    allowed.add(value);
    result.push(value);
  }
  return Object.freeze(result);
}

export function createLegendClassCounter(): Record<ChatLegendClass, number> {
  return {
    SOVEREIGNTY_UNDER_PRESSURE: 0,
    PERFECT_COUNTERPLAY: 0,
    HUMILIATING_HATER_REVERSAL: 0,
    MIRACLE_RESCUE: 0,
    LAST_SECOND_COMEBACK: 0,
    NEGOTIATION_HEIST: 0,
    WITNESS_CASCADE: 0,
    CROWD_CONVERSION: 0,
    BOSS_FIGHT_CONTAINMENT: 0,
    SHADOW_REVEAL_PERFECTION: 0,
  };
}

export function createLegendTierCounter(): Record<ChatLegendTier, number> {
  return {
    ECHO: 0,
    ASCENDANT: 0,
    MYTHIC: 0,
    IMMORTAL: 0,
  };
}

export function createLegendSeverityCounter(): Record<ChatLegendSeverity, number> {
  return {
    NOTABLE: 0,
    MAJOR: 0,
    HISTORIC: 0,
    RUN_DEFINING: 0,
  };
}

export function legendClassBaseWeight(value: ChatLegendClass): number {
  switch (value) {
    case 'SOVEREIGNTY_UNDER_PRESSURE':
      return 96;
    case 'PERFECT_COUNTERPLAY':
      return 88;
    case 'HUMILIATING_HATER_REVERSAL':
      return 90;
    case 'MIRACLE_RESCUE':
      return 84;
    case 'LAST_SECOND_COMEBACK':
      return 86;
    case 'NEGOTIATION_HEIST':
      return 82;
    case 'WITNESS_CASCADE':
      return 78;
    case 'CROWD_CONVERSION':
      return 80;
    case 'BOSS_FIGHT_CONTAINMENT':
      return 89;
    case 'SHADOW_REVEAL_PERFECTION':
      return 87;
    default:
      return 70;
  }
}

// ============================================================================
// MARK: Derivation helpers
// ============================================================================

export function deriveLegendVisibility(
  legendClass: ChatLegendClass,
  preferredChannelId: ChatChannelId,
): ChatLegendVisibility {
  if (preferredChannelId === 'DEAL_ROOM') return 'DEAL_ROOM_ONLY';
  if (preferredChannelId === 'SYNDICATE') return 'SYNDICATE_ONLY';
  if (legendClass === 'SOVEREIGNTY_UNDER_PRESSURE') return 'CEREMONIAL_BROADCAST';
  return 'PUBLIC';
}

export function deriveLegendArchiveScope(
  legendClass: ChatLegendClass,
): ChatLegendArchiveScope {
  return getLegendTemplate(legendClass).archiveScope;
}

export function deriveLegendRewardHints(
  legendClass: ChatLegendClass,
): readonly ChatLegendRewardHint[] {
  return Object.freeze([...getLegendTemplate(legendClass).rewardHints]);
}

export function deriveLegendDefaultSurfaces(
  legendClass: ChatLegendClass,
): readonly ChatLegendPresentationSurface[] {
  return Object.freeze([...getLegendTemplate(legendClass).preferredSurfaces]);
}

export function deriveLegendProofFloor(
  legendClass: ChatLegendClass,
): ChatLegendProofLevel {
  return getLegendTemplate(legendClass).proofFloor;
}

// ============================================================================
// MARK: Builder helpers
// ============================================================================

export interface BuildChatLegendEventInput {
  readonly legendId: ChatLegendId;
  readonly trigger: ChatLegendTriggerContext;
  readonly proof: ChatLegendProofPacket;
  readonly witnesses?: readonly ChatLegendWitness[];
  readonly narrative?: Partial<ChatLegendNarrativeFrame>;
  readonly presentation?: Partial<ChatLegendPresentationPlan>;
  readonly artifacts?: readonly ChatLegendArtifact[];
  readonly callbacks?: readonly ChatLegendCallbackHook[];
  readonly replay?: ChatLegendReplayLink;
  readonly ceremony?: Partial<ChatLegendCeremony>;
  readonly rewardHintPacket?: Partial<ChatLegendRewardHintPacket>;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export function buildChatLegendEvent(
  input: BuildChatLegendEventInput,
  policy: ChatLegendPolicy = DEFAULT_CHAT_LEGEND_POLICY,
): ChatLegendEvent {
  const witnesses = normalizeLegendWitnesses(input.witnesses);
  const proof = createLegendProofPacket(input.proof);

  const classifierInput: ChatLegendClassifierInput = {
    class: input.trigger.class,
    pressure: normalizeLegendPressureSnapshot(input.trigger.pressure),
    witnessCount: witnesses.length,
    proofLevel: proof.level,
    tags: dedupeOutcomeTags(input.trigger.tags),
    hasReplay: Boolean(input.replay ?? proof.replayId),
    hasVisibleWitness: witnesses.some((witness) =>
      (CHAT_VISIBLE_CHANNELS as readonly string[]).includes(witness.channelId),
    ),
    underTimePressure: Number(input.trigger.pressure.timePressure) >= 0.6,
    underShieldPressure: Number(input.trigger.pressure.shieldDanger) >= 0.6,
    fromShadow: Boolean(input.trigger.shadowChannelId),
  };

  const witnessScore100 = computeWitnessPrestigeScore(witnesses);
  const proofScore100 = computeLegendProofScore(proof);
  const score = buildLegendScoreBreakdown(classifierInput, witnessScore100, proofScore100);
  const severity = classifyLegendSeverity(score.finalScore100, policy.thresholds);
  const tier = classifyLegendTier(score.finalScore100, policy.thresholds);

  const presentation = createLegendPresentationPlan({
    primaryChannelId: input.trigger.visibleChannelId ?? input.trigger.sourceChannelId,
    visibility: input.presentation?.visibility ?? deriveLegendVisibility(input.trigger.class, input.trigger.sourceChannelId),
    mirroredChannelIds: input.presentation?.mirroredChannelIds ?? [],
    surfaces: input.presentation?.surfaces ?? deriveLegendDefaultSurfaces(input.trigger.class),
    ceremonialDelayMs: input.presentation?.ceremonialDelayMs ?? 0 as UnixMs,
    useMomentFlash: input.presentation?.useMomentFlash,
    useProofCard: input.presentation?.useProofCard,
    useBanner: input.presentation?.useBanner,
    useAuraPreview: input.presentation?.useAuraPreview,
    silenceAfterRevealMs: input.presentation?.silenceAfterRevealMs ?? 0 as UnixMs,
  });

  const narrative = createLegendNarrativeFrame(input.narrative ?? {}, input.trigger.class);
  const rewardHintPacket = createLegendRewardHintPacket({
    hints: input.rewardHintPacket?.hints ?? deriveLegendRewardHints(input.trigger.class),
    phraseCandidates: input.rewardHintPacket?.phraseCandidates ?? [],
    badgeCandidates: input.rewardHintPacket?.badgeCandidates ?? [],
    auraCandidates: input.rewardHintPacket?.auraCandidates ?? [],
    titleCandidates: input.rewardHintPacket?.titleCandidates ?? [],
    metadata: input.rewardHintPacket?.metadata ?? {},
  });

  const replay = input.replay ? createLegendReplayLink(input.replay) : undefined;
  const ceremony = input.ceremony
    ? createLegendCeremony(input.ceremony)
    : getLegendTemplate(input.trigger.class).ceremonialByDefault
      ? createLegendCeremony({
          title: narrative.archiveLabel,
          subtitle: narrative.summary,
          preRevealDelayMs: 500 as UnixMs,
          postRevealSilenceMs: 300 as UnixMs,
          crowdBeatCount: 2,
          allowInterruptions: false,
        })
      : undefined;

  const artifacts = normalizeLegendArtifacts(input.artifacts);
  const callbacks = normalizeLegendCallbacks(input.callbacks);
  const archiveEntry = createLegendArchiveEntry({
    archiveScope: deriveLegendArchiveScope(input.trigger.class),
    archiveKey: asChatLegendArchiveKey(
      `legend:${slugify(input.trigger.class)}:${String(input.trigger.playerUserId)}`,
    ),
    legendId: input.legendId,
    class: input.trigger.class,
    tier,
    severity,
    summary: narrative.summary,
    label: narrative.archiveLabel,
    createdAtMs: input.trigger.occurredAtMs,
    replayId: replay?.replayId,
    callbackCount: callbacks.length,
    witnessCount: witnesses.length,
    artifactCount: artifacts.length,
    metadata: input.metadata ?? {},
  });

  const cooldown = createLegendCooldown({
    policy: policy.defaultCooldownPolicy,
    key: `${input.trigger.class}:${String(input.trigger.playerUserId)}`,
    durationMs: 1000 as UnixMs,
    startedAtMs: input.trigger.occurredAtMs,
    expiresAtMs: asUnixMs(Number(input.trigger.occurredAtMs) + 1000),
  });

  return createLegendEvent({
    legendId: input.legendId,
    class: input.trigger.class,
    tier,
    severity,
    trigger: createLegendTriggerContext(input.trigger),
    proof,
    witnesses,
    score,
    narrative,
    presentation,
    artifacts,
    callbacks,
    archiveEntry,
    replay,
    ceremony,
    rewardHintPacket,
    cooldown,
    isReplaySafe: Boolean(replay) && rankLegendProofLevel(proof.level) >= rankLegendProofLevel('REPLAY_SAFE'),
    isRewardEligible:
      Number(score.finalScore100) >= CHAT_LEGEND_MIN_SCORE_FOR_CLASSIFICATION &&
      witnesses.length >= policy.minWitnessCount,
    isCeremonial: Boolean(ceremony),
    isPublicArtifact: presentation.visibility === 'PUBLIC' || presentation.visibility === 'CEREMONIAL_BROADCAST',
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}

// ============================================================================
// MARK: Dependency graph / manifest
// ============================================================================

export const CHAT_LEGEND_DEPENDENCY_GRAPH = Object.freeze({
  file: '/shared/contracts/chat/ChatLegend.ts',
  dependsOn: Object.freeze([
    '/shared/contracts/chat/ChatChannels.ts',
  ]),
  consumedBy: Object.freeze([
    '/pzo-web/src/engines/chat/rewards/ChatLegendMomentDetector.ts',
    '/pzo-web/src/engines/chat/rewards/ChatRewardHooks.ts',
    '/pzo-web/src/engines/chat/rewards/LegendPresentationPolicy.ts',
    '/backend/src/game/engine/chat/rewards/LegendMomentLedger.ts',
    '/backend/src/game/engine/chat/rewards/RewardGrantResolver.ts',
    '/backend/src/game/engine/chat/rewards/ReplayMomentIndexer.ts',
    '/pzo-server/src/chat/liveops/ChatEventFanout.ts',
  ]),
});

export const CHAT_LEGEND_MANIFEST: ChatLegendManifestEntry = Object.freeze({
  key: 'ChatLegend',
  version: CHAT_LEGEND_CONTRACT_VERSION,
  publicApiVersion: CHAT_LEGEND_PUBLIC_API_VERSION,
  revision: CHAT_LEGEND_REVISION,
  path: '/shared/contracts/chat/ChatLegend.ts',
  dependsOn: Object.freeze(['./ChatChannels']),
  authorities: CHAT_CONTRACT_AUTHORITIES,
  classes: CHAT_LEGEND_CLASSES,
  tiers: CHAT_LEGEND_TIERS,
  severities: CHAT_LEGEND_SEVERITY,
});

// ============================================================================
// MARK: Export packs
// ============================================================================

export const ChatLegendConstants = Object.freeze({
  CHAT_LEGEND_CONTRACT_VERSION,
  CHAT_LEGEND_PUBLIC_API_VERSION,
  CHAT_LEGEND_REVISION,
  CHAT_LEGEND_CLASSES,
  CHAT_LEGEND_TIERS,
  CHAT_LEGEND_SEVERITY,
  CHAT_LEGEND_VISIBILITY,
  CHAT_LEGEND_ARTIFACT_TYPES,
  CHAT_LEGEND_WITNESS_ROLES,
  CHAT_LEGEND_CALLBACK_MODES,
  CHAT_LEGEND_ARCHIVE_SCOPES,
  CHAT_LEGEND_PRESENTATION_SURFACES,
  CHAT_LEGEND_PROOF_LEVELS,
  CHAT_LEGEND_COOLDOWN_POLICIES,
  CHAT_LEGEND_OUTCOME_TAGS,
  CHAT_LEGEND_REWARD_HINTS,
  DEFAULT_CHAT_LEGEND_THRESHOLDS,
  DEFAULT_CHAT_LEGEND_POLICY,
  CHAT_LEGEND_TEMPLATES,
  CHAT_LEGEND_DEPENDENCY_GRAPH,
  CHAT_LEGEND_MANIFEST,
});

export const ChatLegendFactories = Object.freeze({
  createEmptyLegendPressureSnapshot,
  normalizeLegendPressureSnapshot,
  createLegendWitness,
  normalizeLegendWitnesses,
  createLegendProofPacket,
  createLegendNarrativeFrame,
  createLegendPresentationPlan,
  createLegendArtifact,
  normalizeLegendArtifacts,
  createLegendCallbackHook,
  normalizeLegendCallbacks,
  createLegendCeremony,
  createLegendCooldown,
  createLegendArchiveEntry,
  createLegendReplayLink,
  createLegendRewardHintPacket,
  createLegendTriggerContext,
  createEmptyLegendRollup,
  buildChatLegendEvent,
});

export const ChatLegendScorers = Object.freeze({
  computeLegendPressureWeight,
  computeWitnessPrestigeScore,
  computeLegendProofScore,
  computeLegendTimingScore,
  computeLegendReversalScore,
  computeLegendPrestigeScore,
  buildLegendScoreBreakdown,
  classifyLegendSeverity,
  classifyLegendTier,
  reduceLegendRollup,
});

export const ChatLegendPredicates = Object.freeze({
  isChatLegendClass,
  isChatLegendTier,
  isChatLegendSeverity,
  isChatLegendVisibility,
  isChatLegendArtifactType,
  isChatLegendWitnessRole,
  isChatLegendCallbackMode,
  isChatLegendArchiveScope,
  isChatLegendPresentationSurface,
  isChatLegendProofLevel,
  isChatLegendCooldownPolicy,
  isChatLegendOutcomeTag,
  isChatLegendRewardHint,
  isLegendCooldownActive,
  isLegendRewardEligible,
  isLegendReplaySafe,
});

// ============================================================================
// MARK: Default export pack
// ============================================================================

const ChatLegendContract = Object.freeze({
  constants: ChatLegendConstants,
  factories: ChatLegendFactories,
  scorers: ChatLegendScorers,
  predicates: ChatLegendPredicates,
  manifest: CHAT_LEGEND_MANIFEST,
});

export default ChatLegendContract;
