/**
 * ==========================================================================
 * POINT ZERO ONE — FRONTEND CHAT REWARD HOOKS
 * FILE: pzo-web/src/engines/chat/rewards/ChatRewardHooks.ts
 * ==========================================================================
 *
 * Purpose
 * -------
 * Frontend-local reward staging, grant surfacing, claim flow, and prestige
 * read models for chat legend moments.
 *
 * This file is intentionally the frontend hook/state companion to:
 * - ChatLegendMomentDetector.ts
 * - LegendPresentationPolicy.ts
 * - /shared/contracts/chat/ChatReward.ts
 * - /shared/contracts/chat/ChatLegend.ts
 *
 * Doctrine
 * --------
 * - Frontend may stage, preview, and claim-intent rewards.
 * - Backend remains final authority for durable entitlements.
 * - Reward state must be optimistic but explainable.
 * - Reward staging must preserve replay-safe context and legend linkage.
 * - Claimability, expiry, withholding, and revocation must stay deterministic.
 * - The chat lane should be able to celebrate rewards without coupling UI shells
 *   directly to raw shared contract payloads.
 *
 * What this file owns
 * -------------------
 * - local catalog hydration for legend-driven reward classes
 * - grant derivation and per-legend grouping
 * - staged claim / dismiss / revoke / expire transitions
 * - surface queue assembly for chat, toast, post-run, and locker previews
 * - rollup summaries for debug panels and prestige drawers
 * - hook-safe output payloads for the render shell
 *
 * What this file does NOT own
 * ---------------------------
 * - backend persistence
 * - permanent economic truth
 * - server fanout
 * - profile / locker writes outside optimistic session scope
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ==========================================================================
 */

import {
  ChatLegendPredicates,
  type ChatLegendClass,
  type ChatLegendEvent,
  type ChatLegendId,
} from '../../../../../shared/contracts/chat/ChatLegend';
import {
  CHAT_REWARD_CLASSES,
  ChatRewardConstants,
  ChatRewardFactories,
  ChatRewardPredicates,
  ChatRewardReducers,
  DEFAULT_CHAT_REWARD_POLICY,
  buildRewardCatalogItem,
  deriveRewardGrantsFromLegend,
  type BuildRewardCatalogItemInput,
  type ChatRewardCatalogItem,
  type ChatRewardClass,
  type ChatRewardClaimReceipt,
  type ChatRewardDeliveryMode,
  type ChatRewardGrant,
  type ChatRewardGrantId,
  type ChatRewardId,
  type ChatRewardPolicy,
  type ChatRewardRevocationReason,
  type ChatRewardRollup,
  type ChatRewardStatus,
  type ChatRewardSurface,
} from '../../../../../shared/contracts/chat/ChatReward';
import type {
  ChatMountTarget,
  ChatUserId,
  UnixMs,
} from '../types';

// ============================================================================
// MARK: Hook contracts
// ============================================================================

export type RewardHookNoticeTone = 'neutral' | 'supportive' | 'warning' | 'celebratory' | 'danger';
export type RewardHookSurfaceSlot = 'CHAT_INLINE' | 'TOAST' | 'MOMENT_FLASH' | 'PROOF_CARD' | 'POST_RUN' | 'LOCKER';

export interface RewardSurfaceDescriptor {
  readonly key: string;
  readonly slot: RewardHookSurfaceSlot;
  readonly rewardGrantId: ChatRewardGrantId;
  readonly rewardId: ChatRewardId;
  readonly legendId?: ChatLegendId;
  readonly rewardClass: ChatRewardClass;
  readonly rewardStatus: ChatRewardStatus;
  readonly mountTarget?: ChatMountTarget;
  readonly label: string;
  readonly shortLabel?: string;
  readonly description: string;
  readonly surface: ChatRewardSurface;
  readonly tone: RewardHookNoticeTone;
  readonly accent: 'silver' | 'gold' | 'violet' | 'emerald' | 'amber' | 'rose';
  readonly iconKey?: string;
  readonly claimable: boolean;
  readonly hiddenUntilClaim: boolean;
  readonly createdAtMs: UnixMs;
  readonly expiresAtMs?: UnixMs;
  readonly claimByMs?: UnixMs;
}

export interface RewardHookNotice {
  readonly id: string;
  readonly rewardGrantId: ChatRewardGrantId;
  readonly slot: RewardHookSurfaceSlot;
  readonly label: string;
  readonly subtitle?: string;
  readonly tone: RewardHookNoticeTone;
  readonly actionLabel?: string;
  readonly createdAtMs: UnixMs;
}

export interface RewardHookLegendGroup {
  readonly legendId: ChatLegendId;
  readonly legendClass: ChatLegendClass;
  readonly score100: number;
  readonly grantIds: readonly ChatRewardGrantId[];
  readonly rewardIds: readonly ChatRewardId[];
  readonly pendingClaimIds: readonly ChatRewardGrantId[];
}

export interface RewardHookState {
  readonly ownerUserId: ChatUserId;
  readonly catalogByRewardId: Readonly<Record<string, ChatRewardCatalogItem>>;
  readonly grantsByGrantId: Readonly<Record<string, ChatRewardGrant>>;
  readonly legendGroupsByLegendId: Readonly<Record<string, RewardHookLegendGroup>>;
  readonly dismissedSurfaceKeys: readonly string[];
  readonly claimReceipts: readonly ChatRewardClaimReceipt[];
  readonly auditTrail: readonly RewardHookAuditEntry[];
  readonly lastUpdatedAtMs: UnixMs;
}

export interface RewardHookView {
  readonly state: RewardHookState;
  readonly rollup: ChatRewardRollup;
  readonly notices: readonly RewardHookNotice[];
  readonly visibleSurfaces: readonly RewardSurfaceDescriptor[];
  readonly lockerSurfaces: readonly RewardSurfaceDescriptor[];
  readonly postRunSurfaces: readonly RewardSurfaceDescriptor[];
  readonly pendingClaims: readonly ChatRewardGrant[];
}

export interface RewardHookAuditEntry {
  readonly id: string;
  readonly rewardGrantId: ChatRewardGrantId;
  readonly rewardId: ChatRewardId;
  readonly eventType: 'LEGEND_INGESTED' | 'CATALOG_INJECTED' | 'CLAIMED' | 'REVOKED' | 'EXPIRED' | 'DISMISSED';
  readonly timestampMs: UnixMs;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface RewardLockerCollection {
  readonly class: ChatRewardClass;
  readonly total: number;
  readonly granted: number;
  readonly claimed: number;
  readonly surfaces: readonly RewardSurfaceDescriptor[];
}

export interface RewardHookSerializableSnapshot {
  readonly ownerUserId: ChatUserId;
  readonly grants: readonly ChatRewardGrant[];
  readonly catalog: readonly ChatRewardCatalogItem[];
  readonly legendGroups: readonly RewardHookLegendGroup[];
  readonly dismissedSurfaceKeys: readonly string[];
  readonly claimReceipts: readonly ChatRewardClaimReceipt[];
  readonly auditTrail: readonly RewardHookAuditEntry[];
  readonly lastUpdatedAtMs: UnixMs;
}

export interface RewardHookDiagnostics {
  readonly generatedAtMs: UnixMs;
  readonly totalCatalogItems: number;
  readonly totalGrants: number;
  readonly totalPendingClaims: number;
  readonly byClass: Readonly<Record<string, number>>;
  readonly byStatus: Readonly<Record<string, number>>;
  readonly lockerCollections: readonly RewardLockerCollection[];
}

export interface RewardHookConfig {
  readonly policy: ChatRewardPolicy;
  readonly maxReceipts: number;
  readonly maxDismissedSurfaceKeys: number;
  readonly defaultMountTarget?: ChatMountTarget;
  readonly surfacePriority: Readonly<Record<RewardHookSurfaceSlot, number>>;
  readonly debug: boolean;
}

export interface RewardHookLegendInput {
  readonly ownerUserId: ChatUserId;
  readonly legend: ChatLegendEvent;
  readonly mountTarget?: ChatMountTarget;
  readonly nowMs?: UnixMs;
}

export interface RewardHookClaimInput {
  readonly rewardGrantId: ChatRewardGrantId;
  readonly claimedAtMs?: UnixMs;
}

export interface RewardHookRevokeInput {
  readonly rewardGrantId: ChatRewardGrantId;
  readonly revokedAtMs?: UnixMs;
  readonly reason: ChatRewardRevocationReason;
}

const DEFAULT_REWARD_HOOK_CONFIG: RewardHookConfig = Object.freeze({
  policy: DEFAULT_CHAT_REWARD_POLICY,
  maxReceipts: 160,
  maxDismissedSurfaceKeys: 400,
  defaultMountTarget: 'BATTLE_HUD',
  surfacePriority: Object.freeze({
    CHAT_INLINE: 20,
    TOAST: 10,
    MOMENT_FLASH: 5,
    PROOF_CARD: 30,
    POST_RUN: 40,
    LOCKER: 50,
  }),
  debug: false,
});

function asUnixMs(value: number): UnixMs {
  return Math.max(0, Math.floor(value)) as UnixMs;
}

function nowFrom(input?: UnixMs): UnixMs {
  return input ?? (Date.now() as UnixMs);
}

function freezeRecord<T>(value: Record<string, T>): Readonly<Record<string, T>> {
  return Object.freeze({ ...value });
}

function freezeArray<T>(value: readonly T[]): readonly T[] {
  return Object.freeze([...value]);
}

function asGrantId(value: string): ChatRewardGrantId {
  return value as ChatRewardGrantId;
}

function normalizeClassName(value: ChatLegendClass): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}

function defaultCatalogLabel(rewardClass: ChatRewardClass, legend: ChatLegendEvent): string {
  return `${normalizeClassName(legend.class)} · ${rewardClass
    .toLowerCase()
    .split('_')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ')}`;
}

function toneForRewardClass(rewardClass: ChatRewardClass): RewardHookNoticeTone {
  switch (rewardClass) {
    case 'TITLE_UNLOCK':
    case 'AURA_UNLOCK':
    case 'BADGE_UNLOCK':
    case 'PRESTIGE_BUNDLE':
      return 'celebratory';
    case 'PHRASE_UNLOCK':
    case 'REPLAY_VAULT_UNLOCK':
    case 'PROOF_CARD_SKIN_UNLOCK':
      return 'supportive';
    case 'ARCHIVE_ONLY_COMMENDATION':
      return 'neutral';
    default:
      return 'supportive';
  }
}

function accentForRewardClass(rewardClass: ChatRewardClass): RewardSurfaceDescriptor['accent'] {
  switch (rewardClass) {
    case 'TITLE_UNLOCK':
      return 'gold';
    case 'AURA_UNLOCK':
      return 'violet';
    case 'BADGE_UNLOCK':
      return 'emerald';
    case 'PHRASE_UNLOCK':
      return 'silver';
    case 'EMOJI_SKIN_UNLOCK':
      return 'rose';
    case 'BANNER_STYLE_UNLOCK':
      return 'amber';
    case 'PROOF_CARD_SKIN_UNLOCK':
      return 'violet';
    case 'REPLAY_VAULT_UNLOCK':
      return 'gold';
    case 'PRESTIGE_BUNDLE':
      return 'gold';
    case 'ARCHIVE_ONLY_COMMENDATION':
      return 'silver';
    default:
      return 'silver';
  }
}

function iconForRewardClass(rewardClass: ChatRewardClass): string {
  switch (rewardClass) {
    case 'TITLE_UNLOCK':
      return 'title';
    case 'AURA_UNLOCK':
      return 'aura';
    case 'BADGE_UNLOCK':
      return 'badge';
    case 'PHRASE_UNLOCK':
      return 'phrase';
    case 'EMOJI_SKIN_UNLOCK':
      return 'emoji';
    case 'REPLAY_VAULT_UNLOCK':
      return 'replay';
    case 'BANNER_STYLE_UNLOCK':
      return 'banner';
    case 'PROOF_CARD_SKIN_UNLOCK':
      return 'proof';
    case 'PRESTIGE_BUNDLE':
      return 'bundle';
    case 'ARCHIVE_ONLY_COMMENDATION':
      return 'archive';
    default:
      return 'reward';
  }
}

function preferredSlotsForSurface(surface: ChatRewardSurface): readonly RewardHookSurfaceSlot[] {
  switch (surface) {
    case 'MOMENT_FLASH':
      return Object.freeze(['MOMENT_FLASH', 'TOAST']);
    case 'PROOF_CARD':
    case 'PROOF_CARD_V2':
      return Object.freeze(['PROOF_CARD', 'CHAT_INLINE']);
    case 'POST_RUN':
      return Object.freeze(['POST_RUN']);
    case 'LOCKER':
    case 'PROFILE':
      return Object.freeze(['LOCKER']);
    case 'NOTIFICATION_TOAST':
      return Object.freeze(['TOAST']);
    case 'CHAT_PANEL':
    default:
      return Object.freeze(['CHAT_INLINE', 'TOAST']);
  }
}

function buildCatalogItemsFromLegend(
  ownerUserId: ChatUserId,
  legend: ChatLegendEvent,
  policy: ChatRewardPolicy,
): readonly ChatRewardCatalogItem[] {
  const rewardClasses = ChatRewardReducers.deriveRewardClassesFromLegendClass(legend.class as ChatRewardClass extends never ? never : any);
  return freezeArray(
    rewardClasses.map((rewardClass) =>
      buildRewardCatalogItem(
        {
          rewardClass,
          catalogKey: `catalog:${String(legend.legendId)}:${rewardClass}` as never,
          legendId: legend.legendId,
          legendClass: legend.class as any,
          legendScore100: legend.score.finalScore100,
          ownerUserId,
          label: defaultCatalogLabel(rewardClass, legend),
          description: `${normalizeClassName(legend.class)} generated ${rewardClass.toLowerCase().replace(/_/g, ' ')} prestige.`,
          metadata: Object.freeze({ legendClass: legend.class, legendTier: legend.tier }),
        },
        policy,
      ),
    ),
  );
}

function buildLegendGroup(
  legend: ChatLegendEvent,
  grants: readonly ChatRewardGrant[],
): RewardHookLegendGroup {
  return Object.freeze({
    legendId: legend.legendId,
    legendClass: legend.class,
    score100: Number(legend.score.finalScore100),
    grantIds: freezeArray(grants.map((grant) => grant.rewardGrantId)),
    rewardIds: freezeArray(grants.map((grant) => grant.rewardId)),
    pendingClaimIds: freezeArray(
      grants.filter((grant) => grant.status === 'GRANTED').map((grant) => grant.rewardGrantId),
    ),
  });
}

function buildSurfaceDescriptors(
  legend: ChatLegendEvent,
  grant: ChatRewardGrant,
  catalog: ChatRewardCatalogItem,
  mountTarget: ChatMountTarget | undefined,
): readonly RewardSurfaceDescriptor[] {
  const descriptors: RewardSurfaceDescriptor[] = [];
  const claimable = ChatRewardPredicates.isRewardGrantClaimable(grant, Date.now() as UnixMs);
  const hiddenUntilClaim = catalog.presentation.visibility === 'HIDDEN_UNTIL_CLAIM';

  for (const surface of catalog.presentation.surfaces) {
    const slots = preferredSlotsForSurface(surface);
    for (const slot of slots) {
      descriptors.push(
        Object.freeze({
          key: `${grant.rewardGrantId}:${surface}:${slot}`,
          slot,
          rewardGrantId: grant.rewardGrantId,
          rewardId: grant.rewardId,
          legendId: legend.legendId,
          rewardClass: catalog.identity.class,
          rewardStatus: grant.status,
          mountTarget,
          label: catalog.presentation.label,
          shortLabel: catalog.presentation.shortLabel,
          description: catalog.presentation.description,
          surface,
          tone: toneForRewardClass(catalog.identity.class),
          accent: accentForRewardClass(catalog.identity.class),
          iconKey: iconForRewardClass(catalog.identity.class),
          claimable,
          hiddenUntilClaim,
          createdAtMs: grant.createdAtMs,
          expiresAtMs: grant.expiresAtMs,
          claimByMs: grant.claimByMs,
        }),
      );
    }
  }

  return freezeArray(descriptors);
}

function summarizeGrant(grant: ChatRewardGrant, catalog: ChatRewardCatalogItem): RewardHookNotice {
  const label = grant.status === 'WITHHELD' ? `${catalog.presentation.label} withheld` : catalog.presentation.label;
  const subtitle =
    grant.status === 'GRANTED'
      ? 'Prestige reward staged locally.'
      : grant.status === 'CLAIMED'
      ? 'Reward claimed in the active session.'
      : grant.status === 'WITHHELD'
      ? 'Eligibility blocked this reward from surfacing.'
      : undefined;

  return Object.freeze({
    id: `notice:${grant.rewardGrantId}`,
    rewardGrantId: grant.rewardGrantId,
    slot: grant.deliveryMode === 'POST_RUN' ? 'POST_RUN' : 'TOAST',
    label,
    subtitle,
    tone: grant.status === 'WITHHELD' ? 'warning' : toneForRewardClass(catalog.identity.class),
    actionLabel:
      grant.status === 'GRANTED' && grant.deliveryMode === 'CLAIM_REQUIRED'
        ? 'Claim'
        : grant.status === 'GRANTED'
        ? 'View'
        : undefined,
    createdAtMs: grant.createdAtMs,
  });
}

function createEmptyState(ownerUserId: ChatUserId, nowMs: UnixMs): RewardHookState {
  return Object.freeze({
    ownerUserId,
    catalogByRewardId: Object.freeze({}),
    grantsByGrantId: Object.freeze({}),
    legendGroupsByLegendId: Object.freeze({}),
    dismissedSurfaceKeys: Object.freeze([]),
    claimReceipts: Object.freeze([]),
    auditTrail: Object.freeze([]),
    lastUpdatedAtMs: nowMs,
  });
}

function appendAuditEntry(
  state: RewardHookState,
  entry: RewardHookAuditEntry,
  maxEntries = 300,
): readonly RewardHookAuditEntry[] {
  return freezeArray([entry, ...state.auditTrail].slice(0, maxEntries));
}

function groupCatalogByClass(
  catalogByRewardId: Readonly<Record<string, ChatRewardCatalogItem>>,
): Readonly<Record<string, ChatRewardCatalogItem[]>> {
  const grouped: Record<string, ChatRewardCatalogItem[]> = {};
  for (const item of Object.values(catalogByRewardId)) {
    const key = item.identity.class;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  }
  return freezeRecord(grouped);
}

function buildLockerCollections(
  lockerSurfaces: readonly RewardSurfaceDescriptor[],
  grantsByGrantId: Readonly<Record<string, ChatRewardGrant>>,
): readonly RewardLockerCollection[] {
  const grouped: Record<string, RewardLockerCollection> = {};
  for (const surface of lockerSurfaces) {
    const grant = grantsByGrantId[String(surface.rewardGrantId)];
    const existing = grouped[surface.rewardClass] ?? {
      class: surface.rewardClass,
      total: 0,
      granted: 0,
      claimed: 0,
      surfaces: [] as RewardSurfaceDescriptor[],
    };
    const next = {
      ...existing,
      total: existing.total + 1,
      granted: existing.granted + (grant?.status === 'GRANTED' ? 1 : 0),
      claimed: existing.claimed + (grant?.status === 'CLAIMED' ? 1 : 0),
      surfaces: [...existing.surfaces, surface],
    };
    grouped[surface.rewardClass] = next;
  }
  return freezeArray(Object.values(grouped).map((value) => Object.freeze({ ...value, surfaces: freezeArray(value.surfaces) })));
}

function buildDiagnosticsFromView(view: RewardHookView): RewardHookDiagnostics {
  const byClass: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const grant of Object.values(view.state.grantsByGrantId)) {
    const catalog = view.state.catalogByRewardId[String(grant.rewardId)];
    if (catalog) {
      byClass[catalog.identity.class] = (byClass[catalog.identity.class] ?? 0) + 1;
    }
    byStatus[grant.status] = (byStatus[grant.status] ?? 0) + 1;
  }
  return Object.freeze({
    generatedAtMs: Date.now() as UnixMs,
    totalCatalogItems: Object.keys(view.state.catalogByRewardId).length,
    totalGrants: Object.keys(view.state.grantsByGrantId).length,
    totalPendingClaims: view.pendingClaims.length,
    byClass: freezeRecord(byClass),
    byStatus: freezeRecord(byStatus),
    lockerCollections: buildLockerCollections(view.lockerSurfaces, view.state.grantsByGrantId),
  });
}

function serializeSnapshot(state: RewardHookState): RewardHookSerializableSnapshot {
  return Object.freeze({
    ownerUserId: state.ownerUserId,
    grants: freezeArray(Object.values(state.grantsByGrantId)),
    catalog: freezeArray(Object.values(state.catalogByRewardId)),
    legendGroups: freezeArray(Object.values(state.legendGroupsByLegendId)),
    dismissedSurfaceKeys: state.dismissedSurfaceKeys,
    claimReceipts: state.claimReceipts,
    auditTrail: state.auditTrail,
    lastUpdatedAtMs: state.lastUpdatedAtMs,
  });
}

function hydrateSnapshot(snapshot: RewardHookSerializableSnapshot): RewardHookState {
  const catalogByRewardId: Record<string, ChatRewardCatalogItem> = {};
  const grantsByGrantId: Record<string, ChatRewardGrant> = {};
  const legendGroupsByLegendId: Record<string, RewardHookLegendGroup> = {};
  for (const item of snapshot.catalog) catalogByRewardId[String(item.identity.rewardId)] = item;
  for (const grant of snapshot.grants) grantsByGrantId[String(grant.rewardGrantId)] = grant;
  for (const group of snapshot.legendGroups) legendGroupsByLegendId[String(group.legendId)] = group;
  return Object.freeze({
    ownerUserId: snapshot.ownerUserId,
    catalogByRewardId: freezeRecord(catalogByRewardId),
    grantsByGrantId: freezeRecord(grantsByGrantId),
    legendGroupsByLegendId: freezeRecord(legendGroupsByLegendId),
    dismissedSurfaceKeys: freezeArray(snapshot.dismissedSurfaceKeys),
    claimReceipts: freezeArray(snapshot.claimReceipts),
    auditTrail: freezeArray(snapshot.auditTrail),
    lastUpdatedAtMs: snapshot.lastUpdatedAtMs,
  });
}

export class ChatRewardHooks {
  private readonly config: RewardHookConfig;
  private state: RewardHookState;

  public constructor(ownerUserId: ChatUserId, config: Partial<RewardHookConfig> = {}) {
    this.config = Object.freeze({ ...DEFAULT_REWARD_HOOK_CONFIG, ...config });
    this.state = createEmptyState(ownerUserId, Date.now() as UnixMs);
  }

  public getState(): RewardHookState {
    return this.state;
  }

  public ingestLegend(input: RewardHookLegendInput): RewardHookView {
    if (!ChatLegendPredicates.isChatLegendClass(input.legend.class)) {
      return this.getView(input.mountTarget);
    }

    const nowMs = nowFrom(input.nowMs);
    const catalogItems = buildCatalogItemsFromLegend(input.ownerUserId, input.legend, this.config.policy);
    const grants = deriveRewardGrantsFromLegend(
      {
        ownerUserId: input.ownerUserId,
        legendId: input.legend.legendId,
        legendClass: input.legend.class as any,
        legendScore100: input.legend.score.finalScore100,
        createdAtMs: nowMs,
      },
      this.config.policy,
    );

    const nextCatalogByRewardId = { ...this.state.catalogByRewardId } as Record<string, ChatRewardCatalogItem>;
    const nextGrantsByGrantId = { ...this.state.grantsByGrantId } as Record<string, ChatRewardGrant>;
    const nextLegendGroups = { ...this.state.legendGroupsByLegendId } as Record<string, RewardHookLegendGroup>;

    for (const catalogItem of catalogItems) {
      nextCatalogByRewardId[String(catalogItem.identity.rewardId)] = catalogItem;
    }
    for (const grant of grants) {
      nextGrantsByGrantId[String(grant.rewardGrantId)] = grant;
    }

    nextLegendGroups[String(input.legend.legendId)] = buildLegendGroup(input.legend, grants);

    this.state = Object.freeze({
      ownerUserId: this.state.ownerUserId,
      catalogByRewardId: freezeRecord(nextCatalogByRewardId),
      grantsByGrantId: freezeRecord(nextGrantsByGrantId),
      legendGroupsByLegendId: freezeRecord(nextLegendGroups),
      dismissedSurfaceKeys: this.state.dismissedSurfaceKeys,
      claimReceipts: this.state.claimReceipts,
      auditTrail: appendAuditEntry(
        this.state,
        Object.freeze({
          id: `audit:${String(input.legend.legendId)}:${Number(nowMs)}`,
          rewardGrantId: grants[0]?.rewardGrantId ?? asGrantId(`grant:none:${Number(nowMs)}`),
          rewardId: grants[0]?.rewardId ?? (`reward:none:${Number(nowMs)}` as ChatRewardId),
          eventType: 'LEGEND_INGESTED',
          timestampMs: nowMs,
          metadata: Object.freeze({ legendClass: input.legend.class, grantCount: grants.length }),
        }),
      ),
      lastUpdatedAtMs: nowMs,
    });

    return this.getView(input.mountTarget);
  }

  public claimReward(input: RewardHookClaimInput): RewardHookView {
    const current = this.state.grantsByGrantId[String(input.rewardGrantId)];
    if (!current) {
      return this.getView(this.config.defaultMountTarget);
    }

    if (!ChatRewardPredicates.isRewardGrantClaimable(current, nowFrom(input.claimedAtMs))) {
      return this.getView(this.config.defaultMountTarget);
    }

    const claimedAtMs = nowFrom(input.claimedAtMs);
    const claimed = ChatRewardReducers.claimRewardGrant(current, claimedAtMs);
    const catalog = this.state.catalogByRewardId[String(claimed.rewardId)];

    const nextGrants = {
      ...this.state.grantsByGrantId,
      [String(claimed.rewardGrantId)]: claimed,
    } as Record<string, ChatRewardGrant>;

    const receipt = ChatRewardFactories.createRewardClaimReceipt({
      claimId: `claim:${String(claimed.rewardGrantId)}:${Number(claimedAtMs)}` as never,
      rewardGrantId: claimed.rewardGrantId,
      rewardId: claimed.rewardId,
      ownerUserId: this.state.ownerUserId,
      claimedAtMs,
      statusAfterClaim: claimed.status,
      metadata: Object.freeze({ rewardClass: catalog?.identity.class }),
    });

    this.state = Object.freeze({
      ...this.state,
      grantsByGrantId: freezeRecord(nextGrants),
      claimReceipts: freezeArray([receipt, ...this.state.claimReceipts].slice(0, this.config.maxReceipts)),
      auditTrail: appendAuditEntry(
        this.state,
        Object.freeze({
          id: `audit:${String(claimed.rewardGrantId)}:${Number(claimedAtMs)}`,
          rewardGrantId: claimed.rewardGrantId,
          rewardId: claimed.rewardId,
          eventType: 'CLAIMED',
          timestampMs: claimedAtMs,
          metadata: Object.freeze({ status: claimed.status }),
        }),
      ),
      lastUpdatedAtMs: claimedAtMs,
    });

    return this.getView(this.config.defaultMountTarget);
  }

  public revokeReward(input: RewardHookRevokeInput): RewardHookView {
    const current = this.state.grantsByGrantId[String(input.rewardGrantId)];
    if (!current) {
      return this.getView(this.config.defaultMountTarget);
    }

    const revoked = ChatRewardReducers.revokeRewardGrant(current, nowFrom(input.revokedAtMs), input.reason);
    const nextGrants = {
      ...this.state.grantsByGrantId,
      [String(revoked.rewardGrantId)]: revoked,
    } as Record<string, ChatRewardGrant>;

    this.state = Object.freeze({
      ...this.state,
      grantsByGrantId: freezeRecord(nextGrants),
      auditTrail: appendAuditEntry(
        this.state,
        Object.freeze({
          id: `audit:${String(revoked.rewardGrantId)}:${Number(nowFrom(input.revokedAtMs))}`,
          rewardGrantId: revoked.rewardGrantId,
          rewardId: revoked.rewardId,
          eventType: 'REVOKED',
          timestampMs: nowFrom(input.revokedAtMs),
          metadata: Object.freeze({ reason: input.reason }),
        }),
      ),
      lastUpdatedAtMs: nowFrom(input.revokedAtMs),
    });

    return this.getView(this.config.defaultMountTarget);
  }

  public expireRewards(nowMs: UnixMs = Date.now() as UnixMs): RewardHookView {
    const nextGrants = { ...this.state.grantsByGrantId } as Record<string, ChatRewardGrant>;
    let changed = false;

    for (const grant of Object.values(this.state.grantsByGrantId)) {
      if (grant.status === 'GRANTED' && grant.expiresAtMs !== undefined && Number(nowMs) > Number(grant.expiresAtMs)) {
        nextGrants[String(grant.rewardGrantId)] = ChatRewardFactories.createRewardGrant({
          ...grant,
          status: 'EXPIRED',
        });
        changed = true;
      }
    }

    if (changed) {
      this.state = Object.freeze({
        ...this.state,
        grantsByGrantId: freezeRecord(nextGrants),
        auditTrail: appendAuditEntry(
          this.state,
          Object.freeze({
            id: `audit:expiry:${Number(nowMs)}`,
            rewardGrantId: Object.values(nextGrants)[0]?.rewardGrantId ?? asGrantId(`grant:none:${Number(nowMs)}`),
            rewardId: Object.values(nextGrants)[0]?.rewardId ?? (`reward:none:${Number(nowMs)}` as ChatRewardId),
            eventType: 'EXPIRED',
            timestampMs: nowMs,
            metadata: Object.freeze({ changed }),
          }),
        ),
        lastUpdatedAtMs: nowMs,
      });
    }

    return this.getView(this.config.defaultMountTarget);
  }

  public dismissSurface(surfaceKey: string): RewardHookView {
    const next = [...this.state.dismissedSurfaceKeys, surfaceKey].slice(-this.config.maxDismissedSurfaceKeys);
    this.state = Object.freeze({
      ...this.state,
      dismissedSurfaceKeys: freezeArray(next),
      auditTrail: appendAuditEntry(
        this.state,
        Object.freeze({
          id: `audit:dismiss:${surfaceKey}:${Number(Date.now())}`,
          rewardGrantId: asGrantId(`dismiss:${surfaceKey}`),
          rewardId: (`reward:dismiss:${surfaceKey}` as ChatRewardId),
          eventType: 'DISMISSED',
          timestampMs: Date.now() as UnixMs,
          metadata: Object.freeze({ surfaceKey }),
        }),
      ),
      lastUpdatedAtMs: Date.now() as UnixMs,
    });
    return this.getView(this.config.defaultMountTarget);
  }

  public injectCatalogItems(items: readonly ChatRewardCatalogItem[]): RewardHookView {
    const nextCatalog = { ...this.state.catalogByRewardId } as Record<string, ChatRewardCatalogItem>;
    for (const item of items) {
      nextCatalog[String(item.identity.rewardId)] = item;
    }
    const nowMs = Date.now() as UnixMs;
    this.state = Object.freeze({
      ...this.state,
      catalogByRewardId: freezeRecord(nextCatalog),
      auditTrail: appendAuditEntry(
        this.state,
        Object.freeze({
          id: `audit:catalog:${Number(nowMs)}`,
          rewardGrantId: asGrantId(`catalog:${Number(nowMs)}`),
          rewardId: (`reward:catalog:${Number(nowMs)}` as ChatRewardId),
          eventType: 'CATALOG_INJECTED',
          timestampMs: nowMs,
          metadata: Object.freeze({ itemCount: items.length }),
        }),
      ),
      lastUpdatedAtMs: nowMs,
    });
    return this.getView(this.config.defaultMountTarget);
  }

  public serializeSnapshot(): RewardHookSerializableSnapshot {
    return serializeSnapshot(this.state);
  }

  public hydrateFromSnapshot(snapshot: RewardHookSerializableSnapshot): RewardHookView {
    this.state = hydrateSnapshot(snapshot);
    return this.getView(this.config.defaultMountTarget);
  }

  public listLegendGroups(): readonly RewardHookLegendGroup[] {
    return freezeArray(Object.values(this.state.legendGroupsByLegendId));
  }

  public listCatalogByClass(): Readonly<Record<string, ChatRewardCatalogItem[]>> {
    return groupCatalogByClass(this.state.catalogByRewardId);
  }

  public buildDiagnostics(mountTarget: ChatMountTarget | undefined = this.config.defaultMountTarget): RewardHookDiagnostics {
    return buildDiagnosticsFromView(this.getView(mountTarget));
  }

  public reset(nowMs: UnixMs = Date.now() as UnixMs): RewardHookView {
    this.state = createEmptyState(this.state.ownerUserId, nowMs);
    return this.getView(this.config.defaultMountTarget);
  }

  public getView(mountTarget: ChatMountTarget | undefined = this.config.defaultMountTarget): RewardHookView {
    const notices: RewardHookNotice[] = [];
    const visibleSurfaces: RewardSurfaceDescriptor[] = [];
    const lockerSurfaces: RewardSurfaceDescriptor[] = [];
    const postRunSurfaces: RewardSurfaceDescriptor[] = [];
    const pendingClaims: ChatRewardGrant[] = [];

    for (const grant of Object.values(this.state.grantsByGrantId)) {
      const catalog = this.state.catalogByRewardId[String(grant.rewardId)];
      if (!catalog) {
        continue;
      }

      notices.push(summarizeGrant(grant, catalog));
      const legendId = grant.legendId ? this.state.legendGroupsByLegendId[String(grant.legendId)]?.legendId : undefined;
      const surfaces = buildSurfaceDescriptors(
        legendId
          ? {
              legendId,
              class: this.state.legendGroupsByLegendId[String(legendId)]?.legendClass ?? 'WITNESS_CASCADE',
              tier: 'ASCENDANT',
              severity: 'MAJOR',
              score: { finalScore100: 80 } as any,
            } as ChatLegendEvent
          : ({
              legendId: 'legend:unknown' as ChatLegendId,
              class: 'WITNESS_CASCADE',
              tier: 'ASCENDANT',
              severity: 'MAJOR',
              score: { finalScore100: 80 } as any,
            } as ChatLegendEvent),
        grant,
        catalog,
        mountTarget,
      );

      for (const surface of surfaces) {
        if (this.state.dismissedSurfaceKeys.includes(surface.key)) {
          continue;
        }
        if (surface.slot === 'LOCKER') {
          lockerSurfaces.push(surface);
        } else if (surface.slot === 'POST_RUN') {
          postRunSurfaces.push(surface);
        } else {
          visibleSurfaces.push(surface);
        }
      }

      if (grant.status === 'GRANTED' && ChatRewardPredicates.isRewardGrantClaimable(grant, Date.now() as UnixMs)) {
        pendingClaims.push(grant);
      }
    }

    const sortedVisible = [...visibleSurfaces].sort((a, b) => {
      const left = this.config.surfacePriority[a.slot] ?? 999;
      const right = this.config.surfacePriority[b.slot] ?? 999;
      if (left !== right) return left - right;
      return Number(b.createdAtMs) - Number(a.createdAtMs);
    });

    const rollup = ChatRewardReducers.reduceRewardRollup(
      Object.values(this.state.catalogByRewardId),
      Object.values(this.state.grantsByGrantId),
    );

    return Object.freeze({
      state: this.state,
      rollup,
      notices: freezeArray(notices),
      visibleSurfaces: freezeArray(sortedVisible),
      lockerSurfaces: freezeArray(lockerSurfaces),
      postRunSurfaces: freezeArray(postRunSurfaces),
      pendingClaims: freezeArray(pendingClaims),
    });
  }
}

export function createChatRewardHooks(
  ownerUserId: ChatUserId,
  config: Partial<RewardHookConfig> = {},
): ChatRewardHooks {
  return new ChatRewardHooks(ownerUserId, config);
}

export const CHAT_REWARD_HOOKS_MODULE_NAME = 'PZO_CHAT_REWARD_HOOKS' as const;

export const CHAT_REWARD_HOOKS_MANIFEST = Object.freeze({
  moduleName: CHAT_REWARD_HOOKS_MODULE_NAME,
  version: '1.0.0',
  path: '/pzo-web/src/engines/chat/rewards/ChatRewardHooks.ts',
  authorities: Object.freeze({
    frontendRewardsRoot: '/pzo-web/src/engines/chat/rewards',
    sharedLegendContract: '/shared/contracts/chat/ChatLegend.ts',
    sharedRewardContract: '/shared/contracts/chat/ChatReward.ts',
    frontendPresentationPolicy: '/pzo-web/src/engines/chat/rewards/LegendPresentationPolicy.ts',
  }),
  owns: Object.freeze([
    'frontend reward catalog staging',
    'legend-linked grant derivation',
    'claim / revoke / expire transitions',
    'surface queue assembly',
    'reward rollup generation',
  ] as const),
  dependsOn: Object.freeze([
    './ChatLegendMomentDetector',
    './LegendPresentationPolicy',
    '../../../../../shared/contracts/chat/ChatLegend',
    '../../../../../shared/contracts/chat/ChatReward',
  ] as const),
} as const);

export const ChatRewardHooksModule = Object.freeze({
  moduleName: CHAT_REWARD_HOOKS_MODULE_NAME,
  manifest: CHAT_REWARD_HOOKS_MANIFEST,
  defaults: DEFAULT_REWARD_HOOK_CONFIG,
  createChatRewardHooks,
  ChatRewardHooks,
} as const);
