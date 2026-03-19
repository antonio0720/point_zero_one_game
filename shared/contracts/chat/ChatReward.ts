/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT REWARD CONTRACT
 * FILE: shared/contracts/chat/ChatReward.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared contract surface for rewarding prestige-class chat moments.
 *
 * Reward law sits downstream of legend law. A reward is not the legend itself;
 * it is the entitlement, presentation skin, aura, title, phrase, replay access,
 * badge, or ceremonial unlock that the game grants because the legend occurred.
 *
 * Design doctrine
 * ---------------
 * 1. Rewards must be deterministic, serializable, and replay-safe.
 * 2. Grants are auditable; vanity unlocks are still game law.
 * 3. Eligibility is shared-contract truth before runtime writes occur.
 * 4. Reward shape must survive frontend, backend, and transport boundaries.
 * 5. Bundles can contain multiple unlock classes without collapsing identity.
 * 6. A reward can be visible, staged, claimable, or archival-only.
 * 7. Reward helpers in this file are side-effect free and deterministic.
 * 8. This file owns contract shape and normalization law, not economy mutation.
 *
 * Reward targets
 * --------------
 * - title unlocks
 * - aura unlocks
 * - badge unlocks
 * - ceremonial phrase unlocks
 * - emoji skin unlocks
 * - replay vault unlocks
 * - banner treatments
 * - proof-card ornamentation
 * - prestige bundles
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
  CHAT_CONTRACT_AUTHORITIES,
  type Brand,
  type ChatLegendId,
  type ChatReplayId,
  type ChatUserId,
  type JsonValue,
  type Percentage,
  type Score01,
  type Score100,
  type UnixMs,
} from './ChatChannels';

// ============================================================================
// MARK: Brands
// ============================================================================

export type ChatRewardId = Brand<string, 'ChatRewardId'>;
export type ChatRewardGrantId = Brand<string, 'ChatRewardGrantId'>;
export type ChatRewardBundleId = Brand<string, 'ChatRewardBundleId'>;
export type ChatRewardTrackId = Brand<string, 'ChatRewardTrackId'>;
export type ChatRewardClaimId = Brand<string, 'ChatRewardClaimId'>;
export type ChatRewardAuditId = Brand<string, 'ChatRewardAuditId'>;
export type ChatRewardTitleId = Brand<string, 'ChatRewardTitleId'>;
export type ChatRewardAuraId = Brand<string, 'ChatRewardAuraId'>;
export type ChatRewardBadgeId = Brand<string, 'ChatRewardBadgeId'>;
export type ChatRewardPhraseId = Brand<string, 'ChatRewardPhraseId'>;
export type ChatRewardEmojiSkinId = Brand<string, 'ChatRewardEmojiSkinId'>;
export type ChatRewardReplayVaultId = Brand<string, 'ChatRewardReplayVaultId'>;
export type ChatRewardBannerStyleId = Brand<string, 'ChatRewardBannerStyleId'>;
export type ChatRewardProofCardSkinId = Brand<string, 'ChatRewardProofCardSkinId'>;
export type ChatRewardEntitlementId = Brand<string, 'ChatRewardEntitlementId'>;
export type ChatRewardCatalogKey = Brand<string, 'ChatRewardCatalogKey'>;
export type ChatRewardGroupId = Brand<string, 'ChatRewardGroupId'>;
export type ChatRewardEconomyKey = Brand<string, 'ChatRewardEconomyKey'>;
export type ChatRewardClaimToken = Brand<string, 'ChatRewardClaimToken'>;
export type ChatRewardRuleId = Brand<string, 'ChatRewardRuleId'>;

// ============================================================================
// MARK: Versions
// ============================================================================

export const CHAT_REWARD_CONTRACT_VERSION = '2026.03.19' as const;
export const CHAT_REWARD_PUBLIC_API_VERSION = '1.0.0' as const;
export const CHAT_REWARD_REVISION = 'shared.chat.reward.v1' as const;

// ============================================================================
// MARK: Unions
// ============================================================================

export const CHAT_REWARD_CLASSES = [
  'TITLE_UNLOCK',
  'AURA_UNLOCK',
  'BADGE_UNLOCK',
  'PHRASE_UNLOCK',
  'EMOJI_SKIN_UNLOCK',
  'REPLAY_VAULT_UNLOCK',
  'BANNER_STYLE_UNLOCK',
  'PROOF_CARD_SKIN_UNLOCK',
  'PRESTIGE_BUNDLE',
  'ARCHIVE_ONLY_COMMENDATION',
] as const;

export type ChatRewardClass = (typeof CHAT_REWARD_CLASSES)[number];

export const CHAT_REWARD_RARITIES = [
  'COMMON',
  'UNCOMMON',
  'RARE',
  'EPIC',
  'MYTHIC',
  'IMMORTAL',
] as const;

export type ChatRewardRarity = (typeof CHAT_REWARD_RARITIES)[number];

export const CHAT_REWARD_DELIVERY_MODES = [
  'IMMEDIATE',
  'CLAIM_REQUIRED',
  'CEREMONIAL',
  'POST_RUN',
  'SEASONAL_CHEST',
  'ARCHIVE_ONLY',
] as const;

export type ChatRewardDeliveryMode =
  (typeof CHAT_REWARD_DELIVERY_MODES)[number];

export const CHAT_REWARD_VISIBILITY = [
  'VISIBLE',
  'STAGED',
  'HIDDEN_UNTIL_CLAIM',
  'ARCHIVE_ONLY',
] as const;

export type ChatRewardVisibility = (typeof CHAT_REWARD_VISIBILITY)[number];

export const CHAT_REWARD_STATUSES = [
  'PENDING',
  'GRANTED',
  'CLAIMED',
  'EXPIRED',
  'REVOKED',
  'WITHHELD',
] as const;

export type ChatRewardStatus = (typeof CHAT_REWARD_STATUSES)[number];

export const CHAT_REWARD_STACKING = [
  'UNIQUE',
  'STACKABLE',
  'HIGHEST_ONLY',
  'BEST_RECENT',
] as const;

export type ChatRewardStackingPolicy =
  (typeof CHAT_REWARD_STACKING)[number];

export const CHAT_REWARD_ELIGIBILITY_REASONS = [
  'LEGEND_SCORE',
  'PROOF_FLOOR',
  'WITNESS_COUNT',
  'REPLAY_SAFETY',
  'SEASON_RULE',
  'PLAYER_HISTORY',
  'COOLDOWN',
  'MANUAL_BLOCK',
] as const;

export type ChatRewardEligibilityReason =
  (typeof CHAT_REWARD_ELIGIBILITY_REASONS)[number];

export const CHAT_REWARD_SOURCES = [
  'LEGEND_SOVEREIGNTY',
  'LEGEND_COUNTERPLAY',
  'LEGEND_REVERSAL',
  'LEGEND_RESCUE',
  'LEGEND_COMEBACK',
  'NEGOTIATION_HEIST',
  'WORLD_EVENT',
  'MANUAL_GRANT',
] as const;

export type ChatRewardSource = (typeof CHAT_REWARD_SOURCES)[number];

export const CHAT_REWARD_REVOCATION_REASONS = [
  'INTEGRITY_FAILURE',
  'DUPLICATE_GRANT',
  'SEASON_RESET',
  'POLICY_BLOCK',
  'ADMIN_ACTION',
  'RUNTIME_ROLLBACK',
] as const;

export type ChatRewardRevocationReason =
  (typeof CHAT_REWARD_REVOCATION_REASONS)[number];

export const CHAT_REWARD_SURFACES = [
  'CHAT_PANEL',
  'MOMENT_FLASH',
  'PROOF_CARD',
  'PROOF_CARD_V2',
  'BATTLE_HUD',
  'LEAGUE_UI',
  'LOCKER',
  'PROFILE',
  'POST_RUN',
  'NOTIFICATION_TOAST',
] as const;

export type ChatRewardSurface = (typeof CHAT_REWARD_SURFACES)[number];

export const CHAT_REWARD_LEGEND_CLASSES = [
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

export type ChatRewardLegendClass =
  (typeof CHAT_REWARD_LEGEND_CLASSES)[number];

// ============================================================================
// MARK: Constants
// ============================================================================

export const CHAT_REWARD_DEFAULT_VISIBILITY: ChatRewardVisibility = 'VISIBLE';
export const CHAT_REWARD_DEFAULT_STATUS: ChatRewardStatus = 'PENDING';
export const CHAT_REWARD_DEFAULT_DELIVERY_MODE: ChatRewardDeliveryMode =
  'POST_RUN';
export const CHAT_REWARD_DEFAULT_STACKING_POLICY: ChatRewardStackingPolicy =
  'UNIQUE';
export const CHAT_REWARD_MAX_BUNDLE_ITEMS = 24;
export const CHAT_REWARD_MAX_SURFACES = 12;
export const CHAT_REWARD_MAX_LABEL_LENGTH = 96;
export const CHAT_REWARD_MAX_DESCRIPTION_LENGTH = 320;
export const CHAT_REWARD_DEFAULT_EXPIRY_MS = 1000 * 60 * 60 * 24 * 30;
export const CHAT_REWARD_DEFAULT_CLAIM_WINDOW_MS = 1000 * 60 * 60 * 24 * 14;

// ============================================================================
// MARK: Interfaces
// ============================================================================

export interface ChatRewardPresentation {
  readonly label: string;
  readonly description: string;
  readonly shortLabel?: string;
  readonly iconKey?: string;
  readonly colorKey?: string;
  readonly surfaces: readonly ChatRewardSurface[];
  readonly visibility: ChatRewardVisibility;
  readonly sortOrder: number;
}

export interface ChatRewardEligibility {
  readonly eligible: boolean;
  readonly legendId?: ChatLegendId;
  readonly legendClass?: ChatRewardLegendClass;
  readonly legendScore100?: Score100;
  readonly confidenceScore01?: Score01;
  readonly reasons: readonly ChatRewardEligibilityReason[];
  readonly minimumLegendScore100?: Score100;
  readonly minimumWitnessCount?: number;
  readonly requiresReplaySafe?: boolean;
  readonly requiresManualReview?: boolean;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface ChatRewardIdentity {
  readonly rewardId: ChatRewardId;
  readonly class: ChatRewardClass;
  readonly rarity: ChatRewardRarity;
  readonly source: ChatRewardSource;
  readonly catalogKey: ChatRewardCatalogKey;
  readonly groupId?: ChatRewardGroupId;
  readonly trackId?: ChatRewardTrackId;
  readonly economyKey?: ChatRewardEconomyKey;
  readonly stackingPolicy: ChatRewardStackingPolicy;
}

export interface ChatRewardTiming {
  readonly deliveryMode: ChatRewardDeliveryMode;
  readonly grantedAtMs?: UnixMs;
  readonly claimableAtMs?: UnixMs;
  readonly claimByMs?: UnixMs;
  readonly expiresAtMs?: UnixMs;
  readonly revokedAtMs?: UnixMs;
}

export interface ChatRewardEntitlement {
  readonly entitlementId: ChatRewardEntitlementId;
  readonly rewardId: ChatRewardId;
  readonly ownerUserId: ChatUserId;
  readonly status: ChatRewardStatus;
  readonly progress01: Score01;
  readonly claimToken?: ChatRewardClaimToken;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface ChatTitleRewardPayload {
  readonly titleId: ChatRewardTitleId;
  readonly titleText: string;
  readonly titlePrefix?: string;
  readonly titleSuffix?: string;
  readonly isProfileVisible: boolean;
}

export interface ChatAuraRewardPayload {
  readonly auraId: ChatRewardAuraId;
  readonly auraKey: string;
  readonly animationKey?: string;
  readonly glowIntensity01: Score01;
  readonly isChatVisible: boolean;
}

export interface ChatBadgeRewardPayload {
  readonly badgeId: ChatRewardBadgeId;
  readonly badgeKey: string;
  readonly badgeText: string;
  readonly badgeTierText?: string;
  readonly isProfileVisible: boolean;
}

export interface ChatPhraseRewardPayload {
  readonly phraseId: ChatRewardPhraseId;
  readonly phraseText: string;
  readonly phraseCategory: 'OPENING' | 'CLOSER' | 'CEREMONIAL' | 'TAUNT' | 'PRAISE';
  readonly canAutoInject: boolean;
}

export interface ChatEmojiSkinRewardPayload {
  readonly emojiSkinId: ChatRewardEmojiSkinId;
  readonly emojiKey: string;
  readonly skinVariantKey: string;
  readonly isAnimated: boolean;
}

export interface ChatReplayVaultRewardPayload {
  readonly replayVaultId: ChatRewardReplayVaultId;
  readonly replayId?: ChatReplayId;
  readonly vaultKey: string;
  readonly grantsArchiveAccess: boolean;
}

export interface ChatBannerStyleRewardPayload {
  readonly bannerStyleId: ChatRewardBannerStyleId;
  readonly bannerKey: string;
  readonly supportsMomentFlash: boolean;
}

export interface ChatProofCardSkinRewardPayload {
  readonly proofCardSkinId: ChatRewardProofCardSkinId;
  readonly skinKey: string;
  readonly supportsV2: boolean;
}

export interface ChatRewardEconomy {
  readonly displayValue: number;
  readonly prestigeWeight100: Score100;
  readonly scarcityPercentile: Percentage;
  readonly marketLocked: boolean;
  readonly tradable: boolean;
}

export interface ChatRewardAuditEntry {
  readonly auditId: ChatRewardAuditId;
  readonly rewardGrantId: ChatRewardGrantId;
  readonly eventType:
    | 'GRANT_CREATED'
    | 'GRANT_DELIVERED'
    | 'GRANT_CLAIMED'
    | 'GRANT_REVOKED'
    | 'CLAIM_EXPIRED'
    | 'POLICY_WITHHELD';
  readonly timestampMs: UnixMs;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface ChatRewardGrant {
  readonly rewardGrantId: ChatRewardGrantId;
  readonly rewardId: ChatRewardId;
  readonly ownerUserId: ChatUserId;
  readonly legendId?: ChatLegendId;
  readonly status: ChatRewardStatus;
  readonly deliveryMode: ChatRewardDeliveryMode;
  readonly createdAtMs: UnixMs;
  readonly claimableAtMs?: UnixMs;
  readonly claimByMs?: UnixMs;
  readonly claimedAtMs?: UnixMs;
  readonly expiresAtMs?: UnixMs;
  readonly revokedAtMs?: UnixMs;
  readonly revocationReason?: ChatRewardRevocationReason;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface ChatRewardBundleItem {
  readonly rewardId: ChatRewardId;
  readonly quantity: number;
  readonly optional: boolean;
}

export interface ChatRewardBundle {
  readonly bundleId: ChatRewardBundleId;
  readonly label: string;
  readonly description: string;
  readonly items: readonly ChatRewardBundleItem[];
  readonly deliveryMode: ChatRewardDeliveryMode;
  readonly visibility: ChatRewardVisibility;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface ChatRewardCatalogItem {
  readonly identity: ChatRewardIdentity;
  readonly presentation: ChatRewardPresentation;
  readonly timing: ChatRewardTiming;
  readonly eligibility: ChatRewardEligibility;
  readonly entitlement?: ChatRewardEntitlement;
  readonly economy: ChatRewardEconomy;
  readonly titlePayload?: ChatTitleRewardPayload;
  readonly auraPayload?: ChatAuraRewardPayload;
  readonly badgePayload?: ChatBadgeRewardPayload;
  readonly phrasePayload?: ChatPhraseRewardPayload;
  readonly emojiSkinPayload?: ChatEmojiSkinRewardPayload;
  readonly replayVaultPayload?: ChatReplayVaultRewardPayload;
  readonly bannerStylePayload?: ChatBannerStyleRewardPayload;
  readonly proofCardSkinPayload?: ChatProofCardSkinRewardPayload;
  readonly bundle?: ChatRewardBundle;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface ChatRewardClaimReceipt {
  readonly claimId: ChatRewardClaimId;
  readonly rewardGrantId: ChatRewardGrantId;
  readonly rewardId: ChatRewardId;
  readonly ownerUserId: ChatUserId;
  readonly claimedAtMs: UnixMs;
  readonly statusAfterClaim: ChatRewardStatus;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface ChatRewardPolicyThresholds {
  readonly minimumLegendScore100: Score100;
  readonly minimumConfidence01: Score01;
  readonly minimumWitnessCount: number;
  readonly replaySafeLegendClasses: readonly ChatRewardLegendClass[];
  readonly claimWindowMs: UnixMs;
  readonly expiryMs: UnixMs;
}

export interface ChatRewardPolicy {
  readonly thresholds: ChatRewardPolicyThresholds;
  readonly defaultDeliveryMode: ChatRewardDeliveryMode;
  readonly defaultVisibility: ChatRewardVisibility;
  readonly defaultStatus: ChatRewardStatus;
  readonly defaultStackingPolicy: ChatRewardStackingPolicy;
  readonly allowArchiveOnlyRewards: boolean;
  readonly allowManualGrantOverride: boolean;
  readonly allowRevocation: boolean;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface ChatRewardRollup {
  readonly totalCatalogItems: number;
  readonly totalGranted: number;
  readonly totalClaimed: number;
  readonly totalRevoked: number;
  readonly totalExpired: number;
  readonly byClass: Readonly<Record<ChatRewardClass, number>>;
  readonly byRarity: Readonly<Record<ChatRewardRarity, number>>;
  readonly byStatus: Readonly<Record<ChatRewardStatus, number>>;
}

export interface ChatRewardManifestEntry {
  readonly key: 'ChatReward';
  readonly version: typeof CHAT_REWARD_CONTRACT_VERSION;
  readonly publicApiVersion: typeof CHAT_REWARD_PUBLIC_API_VERSION;
  readonly revision: typeof CHAT_REWARD_REVISION;
  readonly path: '/shared/contracts/chat/ChatReward.ts';
  readonly dependsOn: readonly string[];
  readonly authorities: typeof CHAT_CONTRACT_AUTHORITIES;
  readonly rewardClasses: readonly ChatRewardClass[];
  readonly rarities: readonly ChatRewardRarity[];
}

// ============================================================================
// MARK: Defaults
// ============================================================================

export const DEFAULT_CHAT_REWARD_POLICY: ChatRewardPolicy = Object.freeze({
  thresholds: Object.freeze({
    minimumLegendScore100: 74 as Score100,
    minimumConfidence01: 0.45 as Score01,
    minimumWitnessCount: 1,
    replaySafeLegendClasses: Object.freeze([
      'SOVEREIGNTY_UNDER_PRESSURE',
      'PERFECT_COUNTERPLAY',
      'BOSS_FIGHT_CONTAINMENT',
    ]),
    claimWindowMs: CHAT_REWARD_DEFAULT_CLAIM_WINDOW_MS as UnixMs,
    expiryMs: CHAT_REWARD_DEFAULT_EXPIRY_MS as UnixMs,
  }),
  defaultDeliveryMode: CHAT_REWARD_DEFAULT_DELIVERY_MODE,
  defaultVisibility: CHAT_REWARD_DEFAULT_VISIBILITY,
  defaultStatus: CHAT_REWARD_DEFAULT_STATUS,
  defaultStackingPolicy: CHAT_REWARD_DEFAULT_STACKING_POLICY,
  allowArchiveOnlyRewards: true,
  allowManualGrantOverride: true,
  allowRevocation: true,
  metadata: Object.freeze({}),
});

// ============================================================================
// MARK: Guards
// ============================================================================

export function isChatRewardClass(value: string): value is ChatRewardClass {
  return (CHAT_REWARD_CLASSES as readonly string[]).includes(value);
}

export function isChatRewardRarity(value: string): value is ChatRewardRarity {
  return (CHAT_REWARD_RARITIES as readonly string[]).includes(value);
}

export function isChatRewardDeliveryMode(
  value: string,
): value is ChatRewardDeliveryMode {
  return (CHAT_REWARD_DELIVERY_MODES as readonly string[]).includes(value);
}

export function isChatRewardVisibility(
  value: string,
): value is ChatRewardVisibility {
  return (CHAT_REWARD_VISIBILITY as readonly string[]).includes(value);
}

export function isChatRewardStatus(value: string): value is ChatRewardStatus {
  return (CHAT_REWARD_STATUSES as readonly string[]).includes(value);
}

export function isChatRewardStackingPolicy(
  value: string,
): value is ChatRewardStackingPolicy {
  return (CHAT_REWARD_STACKING as readonly string[]).includes(value);
}

export function isChatRewardEligibilityReason(
  value: string,
): value is ChatRewardEligibilityReason {
  return (CHAT_REWARD_ELIGIBILITY_REASONS as readonly string[]).includes(value);
}

export function isChatRewardSource(value: string): value is ChatRewardSource {
  return (CHAT_REWARD_SOURCES as readonly string[]).includes(value);
}

export function isChatRewardRevocationReason(
  value: string,
): value is ChatRewardRevocationReason {
  return (CHAT_REWARD_REVOCATION_REASONS as readonly string[]).includes(value);
}

export function isChatRewardSurface(value: string): value is ChatRewardSurface {
  return (CHAT_REWARD_SURFACES as readonly string[]).includes(value);
}

export function isChatRewardLegendClass(
  value: string,
): value is ChatRewardLegendClass {
  return (CHAT_REWARD_LEGEND_CLASSES as readonly string[]).includes(value);
}

// ============================================================================
// MARK: Brand helpers
// ============================================================================

export function asChatRewardId(value: string): ChatRewardId {
  return value as ChatRewardId;
}

export function asChatRewardGrantId(value: string): ChatRewardGrantId {
  return value as ChatRewardGrantId;
}

export function asChatRewardBundleId(value: string): ChatRewardBundleId {
  return value as ChatRewardBundleId;
}

export function asChatRewardTrackId(value: string): ChatRewardTrackId {
  return value as ChatRewardTrackId;
}

export function asChatRewardClaimId(value: string): ChatRewardClaimId {
  return value as ChatRewardClaimId;
}

export function asChatRewardAuditId(value: string): ChatRewardAuditId {
  return value as ChatRewardAuditId;
}

export function asChatRewardTitleId(value: string): ChatRewardTitleId {
  return value as ChatRewardTitleId;
}

export function asChatRewardAuraId(value: string): ChatRewardAuraId {
  return value as ChatRewardAuraId;
}

export function asChatRewardBadgeId(value: string): ChatRewardBadgeId {
  return value as ChatRewardBadgeId;
}

export function asChatRewardPhraseId(value: string): ChatRewardPhraseId {
  return value as ChatRewardPhraseId;
}

export function asChatRewardEmojiSkinId(value: string): ChatRewardEmojiSkinId {
  return value as ChatRewardEmojiSkinId;
}

export function asChatRewardReplayVaultId(value: string): ChatRewardReplayVaultId {
  return value as ChatRewardReplayVaultId;
}

export function asChatRewardBannerStyleId(value: string): ChatRewardBannerStyleId {
  return value as ChatRewardBannerStyleId;
}

export function asChatRewardProofCardSkinId(
  value: string,
): ChatRewardProofCardSkinId {
  return value as ChatRewardProofCardSkinId;
}

export function asChatRewardEntitlementId(value: string): ChatRewardEntitlementId {
  return value as ChatRewardEntitlementId;
}

export function asChatRewardCatalogKey(value: string): ChatRewardCatalogKey {
  return value as ChatRewardCatalogKey;
}

export function asChatRewardGroupId(value: string): ChatRewardGroupId {
  return value as ChatRewardGroupId;
}

export function asChatRewardEconomyKey(value: string): ChatRewardEconomyKey {
  return value as ChatRewardEconomyKey;
}

export function asChatRewardClaimToken(value: string): ChatRewardClaimToken {
  return value as ChatRewardClaimToken;
}

export function asChatRewardRuleId(value: string): ChatRewardRuleId {
  return value as ChatRewardRuleId;
}

// ============================================================================
// MARK: Primitive helpers
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

export function truncateString(value: string, maxLength: number): string {
  const normalized = String(value ?? '').trim();
  if (normalized.length <= maxLength) return normalized;
  return normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd() + '…';
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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

export function dedupeRewardSurfaces(
  values: readonly ChatRewardSurface[],
): readonly ChatRewardSurface[] {
  const seen = new Set<ChatRewardSurface>();
  const result: ChatRewardSurface[] = [];
  for (const value of values) {
    if (!isChatRewardSurface(value)) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
    if (result.length >= CHAT_REWARD_MAX_SURFACES) break;
  }
  return Object.freeze(result);
}

// ============================================================================
// MARK: Presentation helpers
// ============================================================================

export function createRewardPresentation(
  input: ChatRewardPresentation,
): ChatRewardPresentation {
  return Object.freeze({
    label: truncateString(input.label, CHAT_REWARD_MAX_LABEL_LENGTH),
    description: truncateString(
      input.description,
      CHAT_REWARD_MAX_DESCRIPTION_LENGTH,
    ),
    shortLabel: input.shortLabel
      ? truncateString(input.shortLabel, CHAT_REWARD_MAX_LABEL_LENGTH)
      : undefined,
    iconKey: input.iconKey ? String(input.iconKey) : undefined,
    colorKey: input.colorKey ? String(input.colorKey) : undefined,
    surfaces: dedupeRewardSurfaces(input.surfaces),
    visibility: input.visibility,
    sortOrder: Math.max(0, Math.trunc(input.sortOrder)),
  });
}

// ============================================================================
// MARK: Eligibility helpers
// ============================================================================

export function createRewardEligibility(
  input: Partial<ChatRewardEligibility>,
): ChatRewardEligibility {
  return Object.freeze({
    eligible: Boolean(input.eligible ?? false),
    legendId: input.legendId,
    legendClass: input.legendClass,
    legendScore100:
      input.legendScore100 === undefined
        ? undefined
        : clamp100(Number(input.legendScore100)),
    confidenceScore01:
      input.confidenceScore01 === undefined
        ? undefined
        : clamp01(Number(input.confidenceScore01)),
    reasons: Object.freeze(
      dedupeStrings(input.reasons ?? [])
        .filter((reason): reason is ChatRewardEligibilityReason =>
          isChatRewardEligibilityReason(reason),
        ),
    ),
    minimumLegendScore100:
      input.minimumLegendScore100 === undefined
        ? undefined
        : clamp100(Number(input.minimumLegendScore100)),
    minimumWitnessCount:
      input.minimumWitnessCount === undefined
        ? undefined
        : Math.max(0, Math.trunc(input.minimumWitnessCount)),
    requiresReplaySafe: Boolean(input.requiresReplaySafe ?? false),
    requiresManualReview: Boolean(input.requiresManualReview ?? false),
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}

export function isRewardEligible(
  eligibility: ChatRewardEligibility,
  policy: ChatRewardPolicy = DEFAULT_CHAT_REWARD_POLICY,
): boolean {
  if (!eligibility.eligible) return false;
  if (
    eligibility.minimumLegendScore100 !== undefined &&
    eligibility.legendScore100 !== undefined &&
    Number(eligibility.legendScore100) < Number(eligibility.minimumLegendScore100)
  ) {
    return false;
  }
  if (
    eligibility.minimumLegendScore100 === undefined &&
    eligibility.legendScore100 !== undefined &&
    Number(eligibility.legendScore100) <
      Number(policy.thresholds.minimumLegendScore100)
  ) {
    return false;
  }
  if (
    eligibility.confidenceScore01 !== undefined &&
    Number(eligibility.confidenceScore01) <
      Number(policy.thresholds.minimumConfidence01)
  ) {
    return false;
  }
  return true;
}

// ============================================================================
// MARK: Identity helpers
// ============================================================================

export function createRewardIdentity(
  input: Omit<ChatRewardIdentity, 'rewardId'> & {
    readonly rewardId?: ChatRewardId;
  },
): ChatRewardIdentity {
  const rewardId =
    input.rewardId ??
    asChatRewardId(
      `reward:${String(input.class).toLowerCase()}:${String(input.catalogKey)}`,
    );

  return Object.freeze({
    rewardId,
    class: input.class,
    rarity: input.rarity,
    source: input.source,
    catalogKey: input.catalogKey,
    groupId: input.groupId,
    trackId: input.trackId,
    economyKey: input.economyKey,
    stackingPolicy: input.stackingPolicy,
  });
}

// ============================================================================
// MARK: Timing helpers
// ============================================================================

export function createRewardTiming(
  input: Partial<ChatRewardTiming>,
): ChatRewardTiming {
  return Object.freeze({
    deliveryMode: input.deliveryMode ?? CHAT_REWARD_DEFAULT_DELIVERY_MODE,
    grantedAtMs:
      input.grantedAtMs === undefined ? undefined : asUnixMs(Number(input.grantedAtMs)),
    claimableAtMs:
      input.claimableAtMs === undefined
        ? undefined
        : asUnixMs(Number(input.claimableAtMs)),
    claimByMs:
      input.claimByMs === undefined ? undefined : asUnixMs(Number(input.claimByMs)),
    expiresAtMs:
      input.expiresAtMs === undefined
        ? undefined
        : asUnixMs(Number(input.expiresAtMs)),
    revokedAtMs:
      input.revokedAtMs === undefined
        ? undefined
        : asUnixMs(Number(input.revokedAtMs)),
  });
}

// ============================================================================
// MARK: Entitlement helpers
// ============================================================================

export function createRewardEntitlement(
  input: ChatRewardEntitlement,
): ChatRewardEntitlement {
  return Object.freeze({
    entitlementId: input.entitlementId,
    rewardId: input.rewardId,
    ownerUserId: input.ownerUserId,
    status: input.status,
    progress01: clamp01(Number(input.progress01)),
    claimToken: input.claimToken,
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}

// ============================================================================
// MARK: Payload helpers
// ============================================================================

export function createTitleRewardPayload(
  input: ChatTitleRewardPayload,
): ChatTitleRewardPayload {
  return Object.freeze({
    titleId: input.titleId,
    titleText: truncateString(input.titleText, CHAT_REWARD_MAX_LABEL_LENGTH),
    titlePrefix: input.titlePrefix
      ? truncateString(input.titlePrefix, CHAT_REWARD_MAX_LABEL_LENGTH)
      : undefined,
    titleSuffix: input.titleSuffix
      ? truncateString(input.titleSuffix, CHAT_REWARD_MAX_LABEL_LENGTH)
      : undefined,
    isProfileVisible: Boolean(input.isProfileVisible),
  });
}

export function createAuraRewardPayload(
  input: ChatAuraRewardPayload,
): ChatAuraRewardPayload {
  return Object.freeze({
    auraId: input.auraId,
    auraKey: truncateString(input.auraKey, CHAT_REWARD_MAX_LABEL_LENGTH),
    animationKey: input.animationKey
      ? truncateString(input.animationKey, CHAT_REWARD_MAX_LABEL_LENGTH)
      : undefined,
    glowIntensity01: clamp01(Number(input.glowIntensity01)),
    isChatVisible: Boolean(input.isChatVisible),
  });
}

export function createBadgeRewardPayload(
  input: ChatBadgeRewardPayload,
): ChatBadgeRewardPayload {
  return Object.freeze({
    badgeId: input.badgeId,
    badgeKey: truncateString(input.badgeKey, CHAT_REWARD_MAX_LABEL_LENGTH),
    badgeText: truncateString(input.badgeText, CHAT_REWARD_MAX_LABEL_LENGTH),
    badgeTierText: input.badgeTierText
      ? truncateString(input.badgeTierText, CHAT_REWARD_MAX_LABEL_LENGTH)
      : undefined,
    isProfileVisible: Boolean(input.isProfileVisible),
  });
}

export function createPhraseRewardPayload(
  input: ChatPhraseRewardPayload,
): ChatPhraseRewardPayload {
  return Object.freeze({
    phraseId: input.phraseId,
    phraseText: truncateString(input.phraseText, CHAT_REWARD_MAX_DESCRIPTION_LENGTH),
    phraseCategory: input.phraseCategory,
    canAutoInject: Boolean(input.canAutoInject),
  });
}

export function createEmojiSkinRewardPayload(
  input: ChatEmojiSkinRewardPayload,
): ChatEmojiSkinRewardPayload {
  return Object.freeze({
    emojiSkinId: input.emojiSkinId,
    emojiKey: truncateString(input.emojiKey, CHAT_REWARD_MAX_LABEL_LENGTH),
    skinVariantKey: truncateString(
      input.skinVariantKey,
      CHAT_REWARD_MAX_LABEL_LENGTH,
    ),
    isAnimated: Boolean(input.isAnimated),
  });
}

export function createReplayVaultRewardPayload(
  input: ChatReplayVaultRewardPayload,
): ChatReplayVaultRewardPayload {
  return Object.freeze({
    replayVaultId: input.replayVaultId,
    replayId: input.replayId,
    vaultKey: truncateString(input.vaultKey, CHAT_REWARD_MAX_LABEL_LENGTH),
    grantsArchiveAccess: Boolean(input.grantsArchiveAccess),
  });
}

export function createBannerStyleRewardPayload(
  input: ChatBannerStyleRewardPayload,
): ChatBannerStyleRewardPayload {
  return Object.freeze({
    bannerStyleId: input.bannerStyleId,
    bannerKey: truncateString(input.bannerKey, CHAT_REWARD_MAX_LABEL_LENGTH),
    supportsMomentFlash: Boolean(input.supportsMomentFlash),
  });
}

export function createProofCardSkinRewardPayload(
  input: ChatProofCardSkinRewardPayload,
): ChatProofCardSkinRewardPayload {
  return Object.freeze({
    proofCardSkinId: input.proofCardSkinId,
    skinKey: truncateString(input.skinKey, CHAT_REWARD_MAX_LABEL_LENGTH),
    supportsV2: Boolean(input.supportsV2),
  });
}

// ============================================================================
// MARK: Economy helpers
// ============================================================================

export function createRewardEconomy(
  input: Partial<ChatRewardEconomy>,
): ChatRewardEconomy {
  return Object.freeze({
    displayValue: Math.max(0, Number(input.displayValue ?? 0)),
    prestigeWeight100: clamp100(Number(input.prestigeWeight100 ?? 0)),
    scarcityPercentile: asPercentage(Number(input.scarcityPercentile ?? 0)),
    marketLocked: Boolean(input.marketLocked ?? true),
    tradable: Boolean(input.tradable ?? false),
  });
}

// ============================================================================
// MARK: Audit helpers
// ============================================================================

export function createRewardAuditEntry(
  input: ChatRewardAuditEntry,
): ChatRewardAuditEntry {
  return Object.freeze({
    auditId: input.auditId,
    rewardGrantId: input.rewardGrantId,
    eventType: input.eventType,
    timestampMs: asUnixMs(Number(input.timestampMs)),
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}

// ============================================================================
// MARK: Grant helpers
// ============================================================================

export function createRewardGrant(
  input: Omit<ChatRewardGrant, 'rewardGrantId'> & {
    readonly rewardGrantId?: ChatRewardGrantId;
  },
): ChatRewardGrant {
  const rewardGrantId =
    input.rewardGrantId ??
    asChatRewardGrantId(
      `reward-grant:${String(input.ownerUserId)}:${String(input.rewardId)}:${String(
        input.createdAtMs,
      )}`,
    );

  return Object.freeze({
    rewardGrantId,
    rewardId: input.rewardId,
    ownerUserId: input.ownerUserId,
    legendId: input.legendId,
    status: input.status,
    deliveryMode: input.deliveryMode,
    createdAtMs: asUnixMs(Number(input.createdAtMs)),
    claimableAtMs:
      input.claimableAtMs === undefined
        ? undefined
        : asUnixMs(Number(input.claimableAtMs)),
    claimByMs:
      input.claimByMs === undefined ? undefined : asUnixMs(Number(input.claimByMs)),
    claimedAtMs:
      input.claimedAtMs === undefined
        ? undefined
        : asUnixMs(Number(input.claimedAtMs)),
    expiresAtMs:
      input.expiresAtMs === undefined
        ? undefined
        : asUnixMs(Number(input.expiresAtMs)),
    revokedAtMs:
      input.revokedAtMs === undefined
        ? undefined
        : asUnixMs(Number(input.revokedAtMs)),
    revocationReason: input.revocationReason,
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}

export function isRewardGrantClaimable(
  grant: ChatRewardGrant,
  nowMs: UnixMs,
): boolean {
  if (grant.status !== 'GRANTED' && grant.status !== 'PENDING') return false;
  if (grant.claimableAtMs !== undefined && Number(nowMs) < Number(grant.claimableAtMs)) {
    return false;
  }
  if (grant.claimByMs !== undefined && Number(nowMs) > Number(grant.claimByMs)) {
    return false;
  }
  if (grant.expiresAtMs !== undefined && Number(nowMs) > Number(grant.expiresAtMs)) {
    return false;
  }
  return true;
}

export function claimRewardGrant(
  grant: ChatRewardGrant,
  claimedAtMs: UnixMs,
): ChatRewardGrant {
  return createRewardGrant({
    ...grant,
    status: 'CLAIMED',
    claimedAtMs,
  });
}

export function revokeRewardGrant(
  grant: ChatRewardGrant,
  revokedAtMs: UnixMs,
  reason: ChatRewardRevocationReason,
): ChatRewardGrant {
  return createRewardGrant({
    ...grant,
    status: 'REVOKED',
    revokedAtMs,
    revocationReason: reason,
  });
}

// ============================================================================
// MARK: Bundle helpers
// ============================================================================

export function createRewardBundleItem(
  input: ChatRewardBundleItem,
): ChatRewardBundleItem {
  return Object.freeze({
    rewardId: input.rewardId,
    quantity: Math.max(1, Math.trunc(input.quantity)),
    optional: Boolean(input.optional),
  });
}

export function createRewardBundle(
  input: Omit<ChatRewardBundle, 'items'> & {
    readonly items: readonly ChatRewardBundleItem[];
  },
): ChatRewardBundle {
  return Object.freeze({
    bundleId: input.bundleId,
    label: truncateString(input.label, CHAT_REWARD_MAX_LABEL_LENGTH),
    description: truncateString(
      input.description,
      CHAT_REWARD_MAX_DESCRIPTION_LENGTH,
    ),
    items: Object.freeze(
      input.items.slice(0, CHAT_REWARD_MAX_BUNDLE_ITEMS).map(createRewardBundleItem),
    ),
    deliveryMode: input.deliveryMode,
    visibility: input.visibility,
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}

export function computeRewardBundleDisplayValue(
  bundle: ChatRewardBundle,
  catalog: readonly ChatRewardCatalogItem[],
): number {
  const byRewardId = new Map(catalog.map((item) => [item.identity.rewardId, item]));
  let total = 0;
  for (const item of bundle.items) {
    const catalogItem = byRewardId.get(item.rewardId);
    if (!catalogItem) continue;
    total += catalogItem.economy.displayValue * item.quantity;
  }
  return total;
}

// ============================================================================
// MARK: Catalog helpers
// ============================================================================

export function createRewardCatalogItem(
  input: ChatRewardCatalogItem,
): ChatRewardCatalogItem {
  return Object.freeze({
    identity: createRewardIdentity(input.identity),
    presentation: createRewardPresentation(input.presentation),
    timing: createRewardTiming(input.timing),
    eligibility: createRewardEligibility(input.eligibility),
    entitlement: input.entitlement
      ? createRewardEntitlement(input.entitlement)
      : undefined,
    economy: createRewardEconomy(input.economy),
    titlePayload: input.titlePayload
      ? createTitleRewardPayload(input.titlePayload)
      : undefined,
    auraPayload: input.auraPayload
      ? createAuraRewardPayload(input.auraPayload)
      : undefined,
    badgePayload: input.badgePayload
      ? createBadgeRewardPayload(input.badgePayload)
      : undefined,
    phrasePayload: input.phrasePayload
      ? createPhraseRewardPayload(input.phrasePayload)
      : undefined,
    emojiSkinPayload: input.emojiSkinPayload
      ? createEmojiSkinRewardPayload(input.emojiSkinPayload)
      : undefined,
    replayVaultPayload: input.replayVaultPayload
      ? createReplayVaultRewardPayload(input.replayVaultPayload)
      : undefined,
    bannerStylePayload: input.bannerStylePayload
      ? createBannerStyleRewardPayload(input.bannerStylePayload)
      : undefined,
    proofCardSkinPayload: input.proofCardSkinPayload
      ? createProofCardSkinRewardPayload(input.proofCardSkinPayload)
      : undefined,
    bundle: input.bundle ? createRewardBundle(input.bundle) : undefined,
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}

export function normalizeRewardCatalog(
  items: readonly ChatRewardCatalogItem[],
): readonly ChatRewardCatalogItem[] {
  return Object.freeze(
    items
      .map(createRewardCatalogItem)
      .sort((a, b) => a.presentation.sortOrder - b.presentation.sortOrder),
  );
}

// ============================================================================
// MARK: Claim helpers
// ============================================================================

export function createRewardClaimReceipt(
  input: ChatRewardClaimReceipt,
): ChatRewardClaimReceipt {
  return Object.freeze({
    claimId: input.claimId,
    rewardGrantId: input.rewardGrantId,
    rewardId: input.rewardId,
    ownerUserId: input.ownerUserId,
    claimedAtMs: asUnixMs(Number(input.claimedAtMs)),
    statusAfterClaim: input.statusAfterClaim,
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}

// ============================================================================
// MARK: Policy helpers
// ============================================================================

export function createRewardPolicy(
  input: Partial<ChatRewardPolicy>,
): ChatRewardPolicy {
  const source = input ?? {};
  const thresholds = source.thresholds ?? DEFAULT_CHAT_REWARD_POLICY.thresholds;

  return Object.freeze({
    thresholds: Object.freeze({
      minimumLegendScore100: clamp100(
        Number(thresholds.minimumLegendScore100),
      ),
      minimumConfidence01: clamp01(Number(thresholds.minimumConfidence01)),
      minimumWitnessCount: Math.max(0, Math.trunc(thresholds.minimumWitnessCount)),
      replaySafeLegendClasses: Object.freeze(
        dedupeStrings(thresholds.replaySafeLegendClasses ?? []).filter(
          (value): value is ChatRewardLegendClass =>
            isChatRewardLegendClass(value),
        ),
      ),
      claimWindowMs: asUnixMs(Number(thresholds.claimWindowMs)),
      expiryMs: asUnixMs(Number(thresholds.expiryMs)),
    }),
    defaultDeliveryMode:
      source.defaultDeliveryMode ?? DEFAULT_CHAT_REWARD_POLICY.defaultDeliveryMode,
    defaultVisibility:
      source.defaultVisibility ?? DEFAULT_CHAT_REWARD_POLICY.defaultVisibility,
    defaultStatus: source.defaultStatus ?? DEFAULT_CHAT_REWARD_POLICY.defaultStatus,
    defaultStackingPolicy:
      source.defaultStackingPolicy ??
      DEFAULT_CHAT_REWARD_POLICY.defaultStackingPolicy,
    allowArchiveOnlyRewards:
      source.allowArchiveOnlyRewards ??
      DEFAULT_CHAT_REWARD_POLICY.allowArchiveOnlyRewards,
    allowManualGrantOverride:
      source.allowManualGrantOverride ??
      DEFAULT_CHAT_REWARD_POLICY.allowManualGrantOverride,
    allowRevocation:
      source.allowRevocation ?? DEFAULT_CHAT_REWARD_POLICY.allowRevocation,
    metadata: Object.freeze({ ...(source.metadata ?? {}) }),
  });
}

// ============================================================================
// MARK: Rollup helpers
// ============================================================================

export function createRewardClassCounter(): Record<ChatRewardClass, number> {
  return {
    TITLE_UNLOCK: 0,
    AURA_UNLOCK: 0,
    BADGE_UNLOCK: 0,
    PHRASE_UNLOCK: 0,
    EMOJI_SKIN_UNLOCK: 0,
    REPLAY_VAULT_UNLOCK: 0,
    BANNER_STYLE_UNLOCK: 0,
    PROOF_CARD_SKIN_UNLOCK: 0,
    PRESTIGE_BUNDLE: 0,
    ARCHIVE_ONLY_COMMENDATION: 0,
  };
}

export function createRewardRarityCounter(): Record<ChatRewardRarity, number> {
  return {
    COMMON: 0,
    UNCOMMON: 0,
    RARE: 0,
    EPIC: 0,
    MYTHIC: 0,
    IMMORTAL: 0,
  };
}

export function createRewardStatusCounter(): Record<ChatRewardStatus, number> {
  return {
    PENDING: 0,
    GRANTED: 0,
    CLAIMED: 0,
    EXPIRED: 0,
    REVOKED: 0,
    WITHHELD: 0,
  };
}

export function reduceRewardRollup(
  items: readonly ChatRewardCatalogItem[],
): ChatRewardRollup {
  const byClass = createRewardClassCounter();
  const byRarity = createRewardRarityCounter();
  const byStatus = createRewardStatusCounter();

  let totalGranted = 0;
  let totalClaimed = 0;
  let totalRevoked = 0;
  let totalExpired = 0;

  for (const item of items) {
    byClass[item.identity.class] += 1;
    byRarity[item.identity.rarity] += 1;
    const status = item.entitlement?.status ?? item.timing.grantedAtMs ? 'GRANTED' : 'PENDING';
    byStatus[status] += 1;
    if (status === 'GRANTED') totalGranted += 1;
    if (status === 'CLAIMED') totalClaimed += 1;
    if (status === 'REVOKED') totalRevoked += 1;
    if (status === 'EXPIRED') totalExpired += 1;
  }

  return Object.freeze({
    totalCatalogItems: items.length,
    totalGranted,
    totalClaimed,
    totalRevoked,
    totalExpired,
    byClass: Object.freeze(byClass),
    byRarity: Object.freeze(byRarity),
    byStatus: Object.freeze(byStatus),
  });
}

// ============================================================================
// MARK: Template map
// ============================================================================

export interface ChatRewardTemplate {
  readonly rewardClass: ChatRewardClass;
  readonly rarity: ChatRewardRarity;
  readonly source: ChatRewardSource;
  readonly defaultDeliveryMode: ChatRewardDeliveryMode;
  readonly defaultVisibility: ChatRewardVisibility;
  readonly defaultStackingPolicy: ChatRewardStackingPolicy;
  readonly defaultSurfaces: readonly ChatRewardSurface[];
}

export const CHAT_REWARD_TEMPLATES: Readonly<Record<ChatRewardClass, ChatRewardTemplate>> =
  Object.freeze({
    TITLE_UNLOCK: Object.freeze({
      rewardClass: 'TITLE_UNLOCK',
      rarity: 'EPIC',
      source: 'LEGEND_SOVEREIGNTY',
      defaultDeliveryMode: 'CEREMONIAL',
      defaultVisibility: 'VISIBLE',
      defaultStackingPolicy: 'UNIQUE',
      defaultSurfaces: ['CHAT_PANEL', 'PROFILE', 'POST_RUN'],
    }),
    AURA_UNLOCK: Object.freeze({
      rewardClass: 'AURA_UNLOCK',
      rarity: 'MYTHIC',
      source: 'LEGEND_COUNTERPLAY',
      defaultDeliveryMode: 'POST_RUN',
      defaultVisibility: 'VISIBLE',
      defaultStackingPolicy: 'HIGHEST_ONLY',
      defaultSurfaces: ['CHAT_PANEL', 'LOCKER', 'PROFILE'],
    }),
    BADGE_UNLOCK: Object.freeze({
      rewardClass: 'BADGE_UNLOCK',
      rarity: 'RARE',
      source: 'LEGEND_REVERSAL',
      defaultDeliveryMode: 'POST_RUN',
      defaultVisibility: 'VISIBLE',
      defaultStackingPolicy: 'STACKABLE',
      defaultSurfaces: ['PROFILE', 'POST_RUN', 'NOTIFICATION_TOAST'],
    }),
    PHRASE_UNLOCK: Object.freeze({
      rewardClass: 'PHRASE_UNLOCK',
      rarity: 'RARE',
      source: 'LEGEND_COMEBACK',
      defaultDeliveryMode: 'POST_RUN',
      defaultVisibility: 'VISIBLE',
      defaultStackingPolicy: 'STACKABLE',
      defaultSurfaces: ['CHAT_PANEL', 'LOCKER'],
    }),
    EMOJI_SKIN_UNLOCK: Object.freeze({
      rewardClass: 'EMOJI_SKIN_UNLOCK',
      rarity: 'UNCOMMON',
      source: 'LEGEND_COUNTERPLAY',
      defaultDeliveryMode: 'POST_RUN',
      defaultVisibility: 'VISIBLE',
      defaultStackingPolicy: 'STACKABLE',
      defaultSurfaces: ['CHAT_PANEL', 'LOCKER'],
    }),
    REPLAY_VAULT_UNLOCK: Object.freeze({
      rewardClass: 'REPLAY_VAULT_UNLOCK',
      rarity: 'EPIC',
      source: 'LEGEND_COUNTERPLAY',
      defaultDeliveryMode: 'CLAIM_REQUIRED',
      defaultVisibility: 'VISIBLE',
      defaultStackingPolicy: 'UNIQUE',
      defaultSurfaces: ['POST_RUN', 'PROFILE'],
    }),
    BANNER_STYLE_UNLOCK: Object.freeze({
      rewardClass: 'BANNER_STYLE_UNLOCK',
      rarity: 'RARE',
      source: 'LEGEND_RESCUE',
      defaultDeliveryMode: 'POST_RUN',
      defaultVisibility: 'VISIBLE',
      defaultStackingPolicy: 'UNIQUE',
      defaultSurfaces: ['MOMENT_FLASH', 'POST_RUN'],
    }),
    PROOF_CARD_SKIN_UNLOCK: Object.freeze({
      rewardClass: 'PROOF_CARD_SKIN_UNLOCK',
      rarity: 'RARE',
      source: 'LEGEND_COUNTERPLAY',
      defaultDeliveryMode: 'POST_RUN',
      defaultVisibility: 'VISIBLE',
      defaultStackingPolicy: 'UNIQUE',
      defaultSurfaces: ['PROOF_CARD', 'PROOF_CARD_V2', 'LOCKER'],
    }),
    PRESTIGE_BUNDLE: Object.freeze({
      rewardClass: 'PRESTIGE_BUNDLE',
      rarity: 'IMMORTAL',
      source: 'LEGEND_SOVEREIGNTY',
      defaultDeliveryMode: 'CEREMONIAL',
      defaultVisibility: 'VISIBLE',
      defaultStackingPolicy: 'UNIQUE',
      defaultSurfaces: ['POST_RUN', 'PROFILE', 'NOTIFICATION_TOAST'],
    }),
    ARCHIVE_ONLY_COMMENDATION: Object.freeze({
      rewardClass: 'ARCHIVE_ONLY_COMMENDATION',
      rarity: 'COMMON',
      source: 'WORLD_EVENT',
      defaultDeliveryMode: 'ARCHIVE_ONLY',
      defaultVisibility: 'ARCHIVE_ONLY',
      defaultStackingPolicy: 'BEST_RECENT',
      defaultSurfaces: ['PROFILE'],
    }),
  });

export function getRewardTemplate(rewardClass: ChatRewardClass): ChatRewardTemplate {
  return CHAT_REWARD_TEMPLATES[rewardClass];
}

// ============================================================================
// MARK: Derived catalog helpers
// ============================================================================

export interface BuildRewardCatalogItemInput {
  readonly rewardClass: ChatRewardClass;
  readonly catalogKey: ChatRewardCatalogKey;
  readonly legendId?: ChatLegendId;
  readonly legendClass?: ChatRewardLegendClass;
  readonly legendScore100?: Score100;
  readonly ownerUserId?: ChatUserId;
  readonly label: string;
  readonly description: string;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export function buildRewardCatalogItem(
  input: BuildRewardCatalogItemInput,
  policy: ChatRewardPolicy = DEFAULT_CHAT_REWARD_POLICY,
): ChatRewardCatalogItem {
  const template = getRewardTemplate(input.rewardClass);

  const identity = createRewardIdentity({
    class: input.rewardClass,
    rarity: template.rarity,
    source: template.source,
    catalogKey: input.catalogKey,
    groupId: asChatRewardGroupId(`reward-group:${slugify(input.rewardClass)}`),
    trackId: asChatRewardTrackId(`reward-track:${slugify(template.source)}`),
    economyKey: asChatRewardEconomyKey(`reward-economy:${slugify(input.rewardClass)}`),
    stackingPolicy: template.defaultStackingPolicy,
  });

  const presentation = createRewardPresentation({
    label: input.label,
    description: input.description,
    surfaces: template.defaultSurfaces,
    visibility: template.defaultVisibility,
    sortOrder: rewardClassSortOrder(input.rewardClass),
  });

  const eligibility = createRewardEligibility({
    eligible: true,
    legendId: input.legendId,
    legendClass: input.legendClass,
    legendScore100: input.legendScore100,
    reasons: ['LEGEND_SCORE'],
    minimumLegendScore100: policy.thresholds.minimumLegendScore100,
    requiresReplaySafe: policy.thresholds.replaySafeLegendClasses.includes(
      (input.legendClass ?? 'WITNESS_CASCADE') as ChatRewardLegendClass,
    ),
    metadata: input.metadata ?? {},
  });

  const timing = createRewardTiming({
    deliveryMode: template.defaultDeliveryMode,
    claimByMs:
      template.defaultDeliveryMode === 'CLAIM_REQUIRED'
        ? policy.thresholds.claimWindowMs
        : undefined,
    expiresAtMs: policy.thresholds.expiryMs,
  });

  const economy = createRewardEconomy({
    displayValue: rewardClassDisplayValue(input.rewardClass),
    prestigeWeight100: rewardClassPrestigeWeight(input.rewardClass),
    scarcityPercentile: rewardClassScarcityPercentile(input.rewardClass),
    marketLocked: true,
    tradable: false,
  });

  return createRewardCatalogItem({
    identity,
    presentation,
    timing,
    eligibility,
    economy,
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
    titlePayload:
      input.rewardClass === 'TITLE_UNLOCK'
        ? createTitleRewardPayload({
            titleId: asChatRewardTitleId(`title:${slugify(input.label)}`),
            titleText: input.label,
            isProfileVisible: true,
          })
        : undefined,
    auraPayload:
      input.rewardClass === 'AURA_UNLOCK'
        ? createAuraRewardPayload({
            auraId: asChatRewardAuraId(`aura:${slugify(input.label)}`),
            auraKey: slugify(input.label),
            glowIntensity01: clamp01(0.85),
            isChatVisible: true,
          })
        : undefined,
    badgePayload:
      input.rewardClass === 'BADGE_UNLOCK'
        ? createBadgeRewardPayload({
            badgeId: asChatRewardBadgeId(`badge:${slugify(input.label)}`),
            badgeKey: slugify(input.label),
            badgeText: input.label,
            isProfileVisible: true,
          })
        : undefined,
    phrasePayload:
      input.rewardClass === 'PHRASE_UNLOCK'
        ? createPhraseRewardPayload({
            phraseId: asChatRewardPhraseId(`phrase:${slugify(input.label)}`),
            phraseText: input.description,
            phraseCategory: 'CEREMONIAL',
            canAutoInject: true,
          })
        : undefined,
    emojiSkinPayload:
      input.rewardClass === 'EMOJI_SKIN_UNLOCK'
        ? createEmojiSkinRewardPayload({
            emojiSkinId: asChatRewardEmojiSkinId(`emoji:${slugify(input.label)}`),
            emojiKey: slugify(input.label),
            skinVariantKey: 'legendary',
            isAnimated: true,
          })
        : undefined,
    replayVaultPayload:
      input.rewardClass === 'REPLAY_VAULT_UNLOCK'
        ? createReplayVaultRewardPayload({
            replayVaultId: asChatRewardReplayVaultId(
              `replay-vault:${slugify(input.label)}`,
            ),
            vaultKey: slugify(input.label),
            grantsArchiveAccess: true,
          })
        : undefined,
    bannerStylePayload:
      input.rewardClass === 'BANNER_STYLE_UNLOCK'
        ? createBannerStyleRewardPayload({
            bannerStyleId: asChatRewardBannerStyleId(
              `banner:${slugify(input.label)}`,
            ),
            bannerKey: slugify(input.label),
            supportsMomentFlash: true,
          })
        : undefined,
    proofCardSkinPayload:
      input.rewardClass === 'PROOF_CARD_SKIN_UNLOCK'
        ? createProofCardSkinRewardPayload({
            proofCardSkinId: asChatRewardProofCardSkinId(
              `proof-card:${slugify(input.label)}`,
            ),
            skinKey: slugify(input.label),
            supportsV2: true,
          })
        : undefined,
    bundle:
      input.rewardClass === 'PRESTIGE_BUNDLE'
        ? createRewardBundle({
            bundleId: asChatRewardBundleId(`bundle:${slugify(input.label)}`),
            label: input.label,
            description: input.description,
            items: Object.freeze([
              createRewardBundleItem({
                rewardId: asChatRewardId('reward:title:bundle-title'),
                quantity: 1,
                optional: false,
              }),
              createRewardBundleItem({
                rewardId: asChatRewardId('reward:aura:bundle-aura'),
                quantity: 1,
                optional: false,
              }),
            ]),
            deliveryMode: 'CEREMONIAL',
            visibility: 'VISIBLE',
            metadata: input.metadata ?? {},
          })
        : undefined,
  });
}

// ============================================================================
// MARK: Mapping helpers
// ============================================================================

export function rewardClassSortOrder(value: ChatRewardClass): number {
  switch (value) {
    case 'PRESTIGE_BUNDLE':
      return 10;
    case 'TITLE_UNLOCK':
      return 20;
    case 'AURA_UNLOCK':
      return 30;
    case 'BADGE_UNLOCK':
      return 40;
    case 'PHRASE_UNLOCK':
      return 50;
    case 'REPLAY_VAULT_UNLOCK':
      return 60;
    case 'BANNER_STYLE_UNLOCK':
      return 70;
    case 'PROOF_CARD_SKIN_UNLOCK':
      return 80;
    case 'EMOJI_SKIN_UNLOCK':
      return 90;
    case 'ARCHIVE_ONLY_COMMENDATION':
      return 100;
    default:
      return 999;
  }
}

export function rewardClassDisplayValue(value: ChatRewardClass): number {
  switch (value) {
    case 'PRESTIGE_BUNDLE':
      return 1000;
    case 'TITLE_UNLOCK':
      return 350;
    case 'AURA_UNLOCK':
      return 500;
    case 'BADGE_UNLOCK':
      return 200;
    case 'PHRASE_UNLOCK':
      return 125;
    case 'REPLAY_VAULT_UNLOCK':
      return 275;
    case 'BANNER_STYLE_UNLOCK':
      return 220;
    case 'PROOF_CARD_SKIN_UNLOCK':
      return 180;
    case 'EMOJI_SKIN_UNLOCK':
      return 95;
    case 'ARCHIVE_ONLY_COMMENDATION':
      return 25;
    default:
      return 0;
  }
}

export function rewardClassPrestigeWeight(value: ChatRewardClass): Score100 {
  switch (value) {
    case 'PRESTIGE_BUNDLE':
      return 100 as Score100;
    case 'TITLE_UNLOCK':
      return 88 as Score100;
    case 'AURA_UNLOCK':
      return 92 as Score100;
    case 'BADGE_UNLOCK':
      return 70 as Score100;
    case 'PHRASE_UNLOCK':
      return 64 as Score100;
    case 'REPLAY_VAULT_UNLOCK':
      return 78 as Score100;
    case 'BANNER_STYLE_UNLOCK':
      return 72 as Score100;
    case 'PROOF_CARD_SKIN_UNLOCK':
      return 66 as Score100;
    case 'EMOJI_SKIN_UNLOCK':
      return 45 as Score100;
    case 'ARCHIVE_ONLY_COMMENDATION':
      return 15 as Score100;
    default:
      return 0 as Score100;
  }
}

export function rewardClassScarcityPercentile(value: ChatRewardClass): Percentage {
  switch (value) {
    case 'PRESTIGE_BUNDLE':
      return 99 as Percentage;
    case 'TITLE_UNLOCK':
      return 92 as Percentage;
    case 'AURA_UNLOCK':
      return 95 as Percentage;
    case 'BADGE_UNLOCK':
      return 80 as Percentage;
    case 'PHRASE_UNLOCK':
      return 68 as Percentage;
    case 'REPLAY_VAULT_UNLOCK':
      return 85 as Percentage;
    case 'BANNER_STYLE_UNLOCK':
      return 74 as Percentage;
    case 'PROOF_CARD_SKIN_UNLOCK':
      return 70 as Percentage;
    case 'EMOJI_SKIN_UNLOCK':
      return 55 as Percentage;
    case 'ARCHIVE_ONLY_COMMENDATION':
      return 15 as Percentage;
    default:
      return 0 as Percentage;
  }
}

// ============================================================================
// MARK: Derivation from legend class
// ============================================================================

export function deriveRewardClassesFromLegendClass(
  legendClass: ChatRewardLegendClass,
): readonly ChatRewardClass[] {
  switch (legendClass) {
    case 'SOVEREIGNTY_UNDER_PRESSURE':
      return Object.freeze(['TITLE_UNLOCK', 'AURA_UNLOCK', 'PRESTIGE_BUNDLE']);
    case 'PERFECT_COUNTERPLAY':
      return Object.freeze(['REPLAY_VAULT_UNLOCK', 'PROOF_CARD_SKIN_UNLOCK']);
    case 'HUMILIATING_HATER_REVERSAL':
      return Object.freeze(['BADGE_UNLOCK', 'PHRASE_UNLOCK']);
    case 'MIRACLE_RESCUE':
      return Object.freeze(['BADGE_UNLOCK', 'BANNER_STYLE_UNLOCK']);
    case 'LAST_SECOND_COMEBACK':
      return Object.freeze(['PHRASE_UNLOCK', 'BADGE_UNLOCK']);
    case 'NEGOTIATION_HEIST':
      return Object.freeze(['TITLE_UNLOCK', 'PHRASE_UNLOCK']);
    case 'WITNESS_CASCADE':
      return Object.freeze(['ARCHIVE_ONLY_COMMENDATION']);
    case 'CROWD_CONVERSION':
      return Object.freeze(['TITLE_UNLOCK', 'BADGE_UNLOCK']);
    case 'BOSS_FIGHT_CONTAINMENT':
      return Object.freeze(['AURA_UNLOCK', 'REPLAY_VAULT_UNLOCK']);
    case 'SHADOW_REVEAL_PERFECTION':
      return Object.freeze(['PROOF_CARD_SKIN_UNLOCK', 'PHRASE_UNLOCK']);
    default:
      return Object.freeze(['ARCHIVE_ONLY_COMMENDATION']);
  }
}

// ============================================================================
// MARK: Grant derivation helpers
// ============================================================================

export interface DeriveRewardGrantsInput {
  readonly ownerUserId: ChatUserId;
  readonly legendId: ChatLegendId;
  readonly legendClass: ChatRewardLegendClass;
  readonly legendScore100: Score100;
  readonly createdAtMs: UnixMs;
}

export function deriveRewardGrantsFromLegend(
  input: DeriveRewardGrantsInput,
  policy: ChatRewardPolicy = DEFAULT_CHAT_REWARD_POLICY,
): readonly ChatRewardGrant[] {
  const rewardClasses = deriveRewardClassesFromLegendClass(input.legendClass);
  const result: ChatRewardGrant[] = [];

  for (const rewardClass of rewardClasses) {
    const catalogItem = buildRewardCatalogItem({
      rewardClass,
      catalogKey: asChatRewardCatalogKey(
        `catalog:${slugify(input.legendClass)}:${slugify(rewardClass)}`,
      ),
      legendId: input.legendId,
      legendClass: input.legendClass,
      legendScore100: input.legendScore100,
      ownerUserId: input.ownerUserId,
      label: `${humanizeRewardClass(rewardClass)} — ${humanizeLegendClass(
        input.legendClass,
      )}`,
      description: `Prestige grant derived from ${humanizeLegendClass(
        input.legendClass,
      )}.`,
      metadata: {},
    }, policy);

    if (!isRewardEligible(catalogItem.eligibility, policy)) {
      result.push(
        createRewardGrant({
          rewardId: catalogItem.identity.rewardId,
          ownerUserId: input.ownerUserId,
          legendId: input.legendId,
          status: 'WITHHELD',
          deliveryMode: catalogItem.timing.deliveryMode,
          createdAtMs: input.createdAtMs,
          metadata: Object.freeze({
            withheldReason: 'eligibility',
            rewardClass,
          }),
        }),
      );
      continue;
    }

    const claimByMs =
      catalogItem.timing.deliveryMode === 'CLAIM_REQUIRED'
        ? asUnixMs(
            Number(input.createdAtMs) + Number(policy.thresholds.claimWindowMs),
          )
        : undefined;

    result.push(
      createRewardGrant({
        rewardId: catalogItem.identity.rewardId,
        ownerUserId: input.ownerUserId,
        legendId: input.legendId,
        status: 'GRANTED',
        deliveryMode: catalogItem.timing.deliveryMode,
        createdAtMs: input.createdAtMs,
        claimableAtMs: input.createdAtMs,
        claimByMs,
        expiresAtMs: asUnixMs(
          Number(input.createdAtMs) + Number(policy.thresholds.expiryMs),
        ),
        metadata: Object.freeze({
          rewardClass,
          legendClass: input.legendClass,
        }),
      }),
    );
  }

  return Object.freeze(result);
}

// ============================================================================
// MARK: Humanizers
// ============================================================================

export function humanizeRewardClass(value: ChatRewardClass): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}

export function humanizeLegendClass(value: ChatRewardLegendClass): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}

// ============================================================================
// MARK: Manifest / dependency graph
// ============================================================================

export const CHAT_REWARD_DEPENDENCY_GRAPH = Object.freeze({
  file: '/shared/contracts/chat/ChatReward.ts',
  dependsOn: Object.freeze([
    '/shared/contracts/chat/ChatChannels.ts',
    '/shared/contracts/chat/ChatLegend.ts',
  ]),
  consumedBy: Object.freeze([
    '/pzo-web/src/engines/chat/rewards/ChatRewardHooks.ts',
    '/pzo-web/src/engines/chat/rewards/LegendPresentationPolicy.ts',
    '/backend/src/game/engine/chat/rewards/RewardGrantResolver.ts',
    '/backend/src/game/engine/chat/rewards/LegendMomentLedger.ts',
    '/backend/src/game/engine/chat/rewards/ReplayMomentIndexer.ts',
  ]),
});

export const CHAT_REWARD_MANIFEST: ChatRewardManifestEntry = Object.freeze({
  key: 'ChatReward',
  version: CHAT_REWARD_CONTRACT_VERSION,
  publicApiVersion: CHAT_REWARD_PUBLIC_API_VERSION,
  revision: CHAT_REWARD_REVISION,
  path: '/shared/contracts/chat/ChatReward.ts',
  dependsOn: Object.freeze(['./ChatChannels', './ChatLegend']),
  authorities: CHAT_CONTRACT_AUTHORITIES,
  rewardClasses: CHAT_REWARD_CLASSES,
  rarities: CHAT_REWARD_RARITIES,
});

// ============================================================================
// MARK: Export packs
// ============================================================================

export const ChatRewardConstants = Object.freeze({
  CHAT_REWARD_CONTRACT_VERSION,
  CHAT_REWARD_PUBLIC_API_VERSION,
  CHAT_REWARD_REVISION,
  CHAT_REWARD_CLASSES,
  CHAT_REWARD_RARITIES,
  CHAT_REWARD_DELIVERY_MODES,
  CHAT_REWARD_VISIBILITY,
  CHAT_REWARD_STATUSES,
  CHAT_REWARD_STACKING,
  CHAT_REWARD_ELIGIBILITY_REASONS,
  CHAT_REWARD_SOURCES,
  CHAT_REWARD_REVOCATION_REASONS,
  CHAT_REWARD_SURFACES,
  CHAT_REWARD_LEGEND_CLASSES,
  DEFAULT_CHAT_REWARD_POLICY,
  CHAT_REWARD_TEMPLATES,
  CHAT_REWARD_DEPENDENCY_GRAPH,
  CHAT_REWARD_MANIFEST,
});

export const ChatRewardFactories = Object.freeze({
  createRewardPresentation,
  createRewardEligibility,
  createRewardIdentity,
  createRewardTiming,
  createRewardEntitlement,
  createTitleRewardPayload,
  createAuraRewardPayload,
  createBadgeRewardPayload,
  createPhraseRewardPayload,
  createEmojiSkinRewardPayload,
  createReplayVaultRewardPayload,
  createBannerStyleRewardPayload,
  createProofCardSkinRewardPayload,
  createRewardEconomy,
  createRewardAuditEntry,
  createRewardGrant,
  createRewardBundleItem,
  createRewardBundle,
  createRewardCatalogItem,
  createRewardClaimReceipt,
  createRewardPolicy,
  buildRewardCatalogItem,
});

export const ChatRewardPredicates = Object.freeze({
  isChatRewardClass,
  isChatRewardRarity,
  isChatRewardDeliveryMode,
  isChatRewardVisibility,
  isChatRewardStatus,
  isChatRewardStackingPolicy,
  isChatRewardEligibilityReason,
  isChatRewardSource,
  isChatRewardRevocationReason,
  isChatRewardSurface,
  isChatRewardLegendClass,
  isRewardEligible,
  isRewardGrantClaimable,
});

export const ChatRewardReducers = Object.freeze({
  computeRewardBundleDisplayValue,
  normalizeRewardCatalog,
  reduceRewardRollup,
  deriveRewardClassesFromLegendClass,
  deriveRewardGrantsFromLegend,
  claimRewardGrant,
  revokeRewardGrant,
});

const ChatRewardContract = Object.freeze({
  constants: ChatRewardConstants,
  factories: ChatRewardFactories,
  predicates: ChatRewardPredicates,
  reducers: ChatRewardReducers,
  manifest: CHAT_REWARD_MANIFEST,
});

export default ChatRewardContract;
