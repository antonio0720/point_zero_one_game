/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT ADAPTER SUITE BARREL
 * FILE: backend/src/game/engine/chat/adapters/index.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend-chat adapter barrel and orchestration surface for the four
 * authoritative upstream translation lanes:
 *
 * - BattleSignalAdapter
 * - RunSignalAdapter
 * - MultiplayerSignalAdapter
 * - EconomySignalAdapter
 *
 * This file is intentionally large because it does more than re-export classes.
 * It is the adapter-suite authority used by backend chat to treat upstream
 * domains as sovereign while still normalizing them into one backend-chat
 * ingress surface.
 *
 * Backend-truth question
 * ----------------------
 *   "How does backend chat ingest battle, run, multiplayer, and economy truth
 *    through one authoritative adapter suite without flattening the original
 *    domain semantics or letting transport/UI become the source of truth?"
 *
 * This file answers that by owning:
 * - the canonical barrel exports for all backend chat adapters,
 * - suite-level construction and configuration law,
 * - domain routing and runtime ingress normalization,
 * - bundle adaptation and mixed-domain batch ingestion,
 * - suite-level dedupe/report aggregation,
 * - diagnostics, readiness, and health reporting,
 * - stable manifest metadata for the adapter subtree,
 * - and a clean entry surface for ChatEventBridge / ChatEngine composition.
 *
 * It does not own:
 * - transcript mutation,
 * - moderation or rate policy,
 * - socket/session transport,
 * - replay persistence,
 * - or final NPC/helper/hater authoring.
 *
 * Design laws
 * -----------
 * - Each upstream engine keeps its own language.
 * - Backend chat consumes truth; it does not re-simulate the source domain.
 * - The adapter suite may unify ingress, but it may not genericize semantics.
 * - Mixed-domain batches must preserve order for replay/debugging.
 * - Adapter health must be inspectable at runtime.
 * - The barrel itself must be useful as a real orchestration module.
 *
 * Canonical tree alignment
 * ------------------------
 * This file belongs under:
 *   backend/src/game/engine/chat/adapters/index.ts
 *
 * and serves the authoritative backend lane described by the locked backend
 * simulation tree under:
 *   /backend/src/game/engine/chat
 *
 * It is intentionally backend-pure:
 * - no socket ownership,
 * - no frontend-only types,
 * - no UI rendering concerns,
 * - no transport-specific mutability.
 * ============================================================================
 */

import {
  asUnixMs,
  type ChatInputEnvelope,
  type ChatRoomId,
  type ChatSignalEnvelope,
  type ChatVisibleChannel,
  type JsonValue,
  type Nullable,
  type UnixMs,
} from '../types';

import {
  BattleSignalAdapter,
  type BattleSignalAdapterArtifact,
  type BattleSignalAdapterContext,
  type BattleSignalAdapterEventName,
  type BattleSignalAdapterOptions,
  type BattleSignalAdapterRejection,
  type BattleSignalAdapterReport,
  type BattleSignalAdapterState,
  type BattleSnapshotCompat,
} from './BattleSignalAdapter';

import {
  RunSignalAdapter,
  type RunSignalAdapterArtifact,
  type RunSignalAdapterContext,
  type RunSignalAdapterEventName,
  type RunSignalAdapterOptions,
  type RunSignalAdapterRejection,
  type RunSignalAdapterReport,
  type RunSignalAdapterState,
  type RunSnapshotCompat,
} from './RunSignalAdapter';

import {
  MultiplayerSignalAdapter,
  type MultiplayerRoomCompat,
  type MultiplayerSignalAdapterAccepted,
  type MultiplayerSignalAdapterContext,
  type MultiplayerSignalAdapterDeduped,
  type MultiplayerSignalAdapterEventName,
  type MultiplayerSignalAdapterOptions,
  type MultiplayerSignalAdapterRejected,
  type MultiplayerSignalAdapterReport,
  type MultiplayerSignalAdapterState,
} from './MultiplayerSignalAdapter';

import {
  EconomySignalAdapter,
  type EconomyDealSnapshotCompat,
  type EconomyOfferPayloadCompat,
  type EconomySignalAdapterAccepted,
  type EconomySignalAdapterContext,
  type EconomySignalAdapterDeduped,
  type EconomySignalAdapterEventName,
  type EconomySignalAdapterOptions,
  type EconomySignalAdapterRejected,
  type EconomySignalAdapterReport,
  type EconomySignalAdapterState,
} from './EconomySignalAdapter';

// ============================================================================
// MARK: Re-export authoritative adapter modules and their key public surfaces
// ============================================================================

export {
  BattleSignalAdapter,
  RunSignalAdapter,
  MultiplayerSignalAdapter,
  EconomySignalAdapter,
};

export type {
  BattleSignalAdapterArtifact,
  BattleSignalAdapterContext,
  BattleSignalAdapterEventName,
  BattleSignalAdapterOptions,
  BattleSignalAdapterRejection,
  BattleSignalAdapterReport,
  BattleSignalAdapterState,
  BattleSnapshotCompat,
  RunSignalAdapterArtifact,
  RunSignalAdapterContext,
  RunSignalAdapterEventName,
  RunSignalAdapterOptions,
  RunSignalAdapterRejection,
  RunSignalAdapterReport,
  RunSignalAdapterState,
  RunSnapshotCompat,
  MultiplayerRoomCompat,
  MultiplayerSignalAdapterAccepted,
  MultiplayerSignalAdapterContext,
  MultiplayerSignalAdapterDeduped,
  MultiplayerSignalAdapterEventName,
  MultiplayerSignalAdapterOptions,
  MultiplayerSignalAdapterRejected,
  MultiplayerSignalAdapterReport,
  MultiplayerSignalAdapterState,
  EconomyDealSnapshotCompat,
  EconomyOfferPayloadCompat,
  EconomySignalAdapterAccepted,
  EconomySignalAdapterContext,
  EconomySignalAdapterDeduped,
  EconomySignalAdapterEventName,
  EconomySignalAdapterOptions,
  EconomySignalAdapterRejected,
  EconomySignalAdapterReport,
  EconomySignalAdapterState,
};

// ============================================================================
// MARK: Suite constants, module descriptors, and manifest surfaces
// ============================================================================

export const BACKEND_CHAT_ADAPTER_SUITE_VERSION = '2026.03.14' as const;
export const BACKEND_CHAT_ADAPTER_SUITE_PUBLIC_API_VERSION = '1.0.0-alpha' as const;

export const BACKEND_CHAT_ADAPTER_DOMAIN_IDS = Object.freeze([
  'BATTLE',
  'RUN',
  'MULTIPLAYER',
  'ECONOMY',
] as const);

export type BackendChatAdapterDomainId =
  (typeof BACKEND_CHAT_ADAPTER_DOMAIN_IDS)[number];

export const BACKEND_CHAT_ADAPTER_TREE_PATHS = Object.freeze({
  root: 'backend/src/game/engine/chat/adapters',
  index: 'backend/src/game/engine/chat/adapters/index.ts',
  battle: 'backend/src/game/engine/chat/adapters/BattleSignalAdapter.ts',
  run: 'backend/src/game/engine/chat/adapters/RunSignalAdapter.ts',
  multiplayer:
    'backend/src/game/engine/chat/adapters/MultiplayerSignalAdapter.ts',
  economy: 'backend/src/game/engine/chat/adapters/EconomySignalAdapter.ts',
} as const);

export interface BackendChatAdapterModuleDescriptor {
  readonly domain: BackendChatAdapterDomainId;
  readonly className: string;
  readonly relativePath: string;
  readonly ownsTruth: false;
  readonly description: string;
}

export const BACKEND_CHAT_ADAPTER_MODULES = Object.freeze<
  readonly BackendChatAdapterModuleDescriptor[]
>([
  {
    domain: 'BATTLE',
    className: 'BattleSignalAdapter',
    relativePath: BACKEND_CHAT_ADAPTER_TREE_PATHS.battle,
    ownsTruth: false,
    description:
      'Translates backend battle authority into backend-chat battle ingress.',
  },
  {
    domain: 'RUN',
    className: 'RunSignalAdapter',
    relativePath: BACKEND_CHAT_ADAPTER_TREE_PATHS.run,
    ownsTruth: false,
    description:
      'Translates run lifecycle/runtime authority into backend-chat run ingress.',
  },
  {
    domain: 'MULTIPLAYER',
    className: 'MultiplayerSignalAdapter',
    relativePath: BACKEND_CHAT_ADAPTER_TREE_PATHS.multiplayer,
    ownsTruth: false,
    description:
      'Translates room/member/party/co-op authority into backend-chat social ingress.',
  },
  {
    domain: 'ECONOMY',
    className: 'EconomySignalAdapter',
    relativePath: BACKEND_CHAT_ADAPTER_TREE_PATHS.economy,
    ownsTruth: false,
    description:
      'Translates deal-room/liquidity/offer authority into backend-chat economy ingress.',
  },
]);

// ============================================================================
// MARK: Suite logger and clock
// ============================================================================

export interface BackendChatAdapterSuiteLogger {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface BackendChatAdapterSuiteClock {
  now(): UnixMs;
}

// ============================================================================
// MARK: Normalized suite contexts, ingress, and bundle contracts
// ============================================================================

export interface BackendChatAdapterContextBase {
  readonly roomId?: ChatRoomId | string | null;
  readonly routeChannel?: ChatVisibleChannel;
  readonly emittedAt?: number;
  readonly source?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface BackendChatBattleIngress {
  readonly domain: 'BATTLE';
  readonly eventName: BattleSignalAdapterEventName;
  readonly payload: unknown;
  readonly context?: BattleSignalAdapterContext;
}

export interface BackendChatRunIngress {
  readonly domain: 'RUN';
  readonly eventName: RunSignalAdapterEventName;
  readonly payload: unknown;
  readonly context?: RunSignalAdapterContext;
}

export interface BackendChatMultiplayerIngress {
  readonly domain: 'MULTIPLAYER';
  readonly eventName: MultiplayerSignalAdapterEventName;
  readonly payload: unknown;
  readonly context?: MultiplayerSignalAdapterContext;
}

export interface BackendChatEconomyIngress {
  readonly domain: 'ECONOMY';
  readonly eventName: EconomySignalAdapterEventName;
  readonly payload: unknown;
  readonly context?: EconomySignalAdapterContext;
}

export type BackendChatAdapterIngress =
  | BackendChatBattleIngress
  | BackendChatRunIngress
  | BackendChatMultiplayerIngress
  | BackendChatEconomyIngress;

export interface BackendChatBattleSnapshotIngress {
  readonly domain: 'BATTLE';
  readonly snapshot: BattleSnapshotCompat;
  readonly context?: BattleSignalAdapterContext;
}

export interface BackendChatRunSnapshotIngress {
  readonly domain: 'RUN';
  readonly snapshot: RunSnapshotCompat;
  readonly context?: RunSignalAdapterContext;
}

export interface BackendChatMultiplayerSnapshotIngress {
  readonly domain: 'MULTIPLAYER';
  readonly snapshot: MultiplayerRoomCompat;
  readonly context?: MultiplayerSignalAdapterContext;
}

export interface BackendChatEconomySnapshotIngress {
  readonly domain: 'ECONOMY';
  readonly snapshot: EconomyDealSnapshotCompat;
  readonly context?: EconomySignalAdapterContext;
}

export type BackendChatAdapterSnapshotIngress =
  | BackendChatBattleSnapshotIngress
  | BackendChatRunSnapshotIngress
  | BackendChatMultiplayerSnapshotIngress
  | BackendChatEconomySnapshotIngress;

export interface BackendChatAdapterSnapshotBundle {
  readonly battle?: BattleSnapshotCompat | null;
  readonly run?: RunSnapshotCompat | null;
  readonly multiplayer?: MultiplayerRoomCompat | null;
  readonly economy?: EconomyDealSnapshotCompat | null;
}

export interface BackendChatAdapterBundleContext {
  readonly battle?: BattleSignalAdapterContext;
  readonly run?: RunSignalAdapterContext;
  readonly multiplayer?: MultiplayerSignalAdapterContext;
  readonly economy?: EconomySignalAdapterContext;
}

// ============================================================================
// MARK: Suite option contracts
// ============================================================================

export interface BackendChatAdapterSuiteOptions {
  readonly defaultRoomId: ChatRoomId | string;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  readonly logger?: BackendChatAdapterSuiteLogger;
  readonly clock?: BackendChatAdapterSuiteClock;
  readonly battle?: Partial<BattleSignalAdapterOptions>;
  readonly run?: Partial<RunSignalAdapterOptions>;
  readonly multiplayer?: Partial<MultiplayerSignalAdapterOptions>;
  readonly economy?: Partial<EconomySignalAdapterOptions>;
}

export interface BackendChatResolvedAdapterSuiteOptions {
  readonly defaultRoomId: ChatRoomId | string;
  readonly defaultVisibleChannel: ChatVisibleChannel;
  readonly battle: BattleSignalAdapterOptions;
  readonly run: RunSignalAdapterOptions;
  readonly multiplayer: MultiplayerSignalAdapterOptions;
  readonly economy: EconomySignalAdapterOptions;
}

// ============================================================================
// MARK: Unified suite accepted / deduped / rejected / state contracts
// ============================================================================

export interface BackendChatUnifiedAcceptedArtifact {
  readonly domain: BackendChatAdapterDomainId;
  readonly eventName: string;
  readonly dedupeKey: string;
  readonly routeChannel: ChatVisibleChannel;
  readonly severity: string;
  readonly narrativeWeight: string;
  readonly emittedAt: UnixMs;
  readonly envelope: ChatInputEnvelope;
  readonly signal: ChatSignalEnvelope;
  readonly diagnostics: Readonly<Record<string, JsonValue>>;
}

export interface BackendChatUnifiedDedupedArtifact {
  readonly domain: BackendChatAdapterDomainId;
  readonly eventName: string;
  readonly dedupeKey: string;
  readonly reason: string;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface BackendChatUnifiedRejectedArtifact {
  readonly domain: BackendChatAdapterDomainId;
  readonly eventName: string;
  readonly reason: string;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface BackendChatAdapterDomainCounters {
  readonly accepted: number;
  readonly deduped: number;
  readonly rejected: number;
}

export interface BackendChatAdapterSuiteState {
  readonly battle: BattleSignalAdapterState;
  readonly run: RunSignalAdapterState;
  readonly multiplayer: MultiplayerSignalAdapterState;
  readonly economy: EconomySignalAdapterState;
  readonly totals: Readonly<Record<BackendChatAdapterDomainId, BackendChatAdapterDomainCounters>>;
}

export interface BackendChatAdapterDomainReport<TAccepted, TDeduped, TRejected> {
  readonly accepted: readonly TAccepted[];
  readonly deduped: readonly TDeduped[];
  readonly rejected: readonly TRejected[];
}

export interface BackendChatAdapterSuiteReport {
  readonly accepted: readonly BackendChatUnifiedAcceptedArtifact[];
  readonly deduped: readonly BackendChatUnifiedDedupedArtifact[];
  readonly rejected: readonly BackendChatUnifiedRejectedArtifact[];
  readonly byDomain: Readonly<{
    battle: BackendChatAdapterDomainReport<
      BattleSignalAdapterArtifact,
      BattleSignalAdapterArtifact,
      BattleSignalAdapterRejection
    >;
    run: BackendChatAdapterDomainReport<
      RunSignalAdapterArtifact,
      RunSignalAdapterArtifact,
      RunSignalAdapterRejection
    >;
    multiplayer: BackendChatAdapterDomainReport<
      MultiplayerSignalAdapterAccepted,
      MultiplayerSignalAdapterDeduped,
      MultiplayerSignalAdapterRejected
    >;
    economy: BackendChatAdapterDomainReport<
      EconomySignalAdapterAccepted,
      EconomySignalAdapterDeduped,
      EconomySignalAdapterRejected
    >;
  }>;
  readonly counters: Readonly<Record<BackendChatAdapterDomainId, BackendChatAdapterDomainCounters>>;
}

export interface BackendChatAdapterHealthReport {
  readonly version: string;
  readonly publicApiVersion: string;
  readonly moduleCount: number;
  readonly totalAccepted: number;
  readonly totalDeduped: number;
  readonly totalRejected: number;
  readonly hottestDomain: BackendChatAdapterDomainId;
  readonly quietestDomain: BackendChatAdapterDomainId;
  readonly domains: Readonly<Record<BackendChatAdapterDomainId, BackendChatAdapterDomainCounters>>;
}

// ============================================================================
// MARK: Suite classifier / route / descriptor contracts
// ============================================================================

export type BackendChatAdapterIngressKind =
  | 'BATTLE_EVENT'
  | 'RUN_EVENT'
  | 'MULTIPLAYER_EVENT'
  | 'ECONOMY_EVENT'
  | 'BATTLE_SNAPSHOT'
  | 'RUN_SNAPSHOT'
  | 'MULTIPLAYER_SNAPSHOT'
  | 'ECONOMY_SNAPSHOT';

export interface BackendChatAdapterIngressDescriptor {
  readonly kind: BackendChatAdapterIngressKind;
  readonly domain: BackendChatAdapterDomainId;
  readonly routeChannel: Nullable<ChatVisibleChannel>;
  readonly roomId: Nullable<ChatRoomId | string>;
  readonly eventName: Nullable<string>;
}

// ============================================================================
// MARK: Default logger and clock
// ============================================================================

const NULL_LOGGER: BackendChatAdapterSuiteLogger = Object.freeze({
  debug() {
    // deliberate no-op
  },
  warn() {
    // deliberate no-op
  },
  error() {
    // deliberate no-op
  },
});

const SYSTEM_CLOCK: BackendChatAdapterSuiteClock = Object.freeze({
  now(): UnixMs {
    return asUnixMs(Date.now());
  },
});

// ============================================================================
// MARK: Helper functions — option resolution
// ============================================================================

function resolveDefaultVisibleChannel(
  value: ChatVisibleChannel | undefined,
): ChatVisibleChannel {
  return value ?? 'GLOBAL';
}

function resolveBattleOptions(
  options: BackendChatAdapterSuiteOptions,
  logger: BackendChatAdapterSuiteLogger,
  clock: BackendChatAdapterSuiteClock,
): BattleSignalAdapterOptions {
  return Object.freeze({
    defaultRoomId: options.defaultRoomId,
    defaultVisibleChannel: options.defaultVisibleChannel,
    logger,
    clock,
    ...(options.battle ?? {}),
  });
}

function resolveRunOptions(
  options: BackendChatAdapterSuiteOptions,
  logger: BackendChatAdapterSuiteLogger,
  clock: BackendChatAdapterSuiteClock,
): RunSignalAdapterOptions {
  return Object.freeze({
    defaultRoomId: options.defaultRoomId,
    defaultVisibleChannel: options.defaultVisibleChannel,
    logger,
    clock,
    ...(options.run ?? {}),
  });
}

function resolveMultiplayerOptions(
  options: BackendChatAdapterSuiteOptions,
  logger: BackendChatAdapterSuiteLogger,
  clock: BackendChatAdapterSuiteClock,
): MultiplayerSignalAdapterOptions {
  return Object.freeze({
    defaultRoomId: options.defaultRoomId,
    defaultVisibleChannel: options.defaultVisibleChannel,
    logger,
    clock,
    ...(options.multiplayer ?? {}),
  });
}

function resolveEconomyOptions(
  options: BackendChatAdapterSuiteOptions,
  logger: BackendChatAdapterSuiteLogger,
  clock: BackendChatAdapterSuiteClock,
): EconomySignalAdapterOptions {
  return Object.freeze({
    defaultRoomId: options.defaultRoomId,
    defaultVisibleChannel: options.defaultVisibleChannel,
    logger,
    clock,
    ...(options.economy ?? {}),
  });
}

export function resolveBackendChatAdapterSuiteOptions(
  options: BackendChatAdapterSuiteOptions,
): BackendChatResolvedAdapterSuiteOptions {
  const logger = options.logger ?? NULL_LOGGER;
  const clock = options.clock ?? SYSTEM_CLOCK;
  const defaultVisibleChannel = resolveDefaultVisibleChannel(
    options.defaultVisibleChannel,
  );

  const resolvedOptions: BackendChatAdapterSuiteOptions = Object.freeze({
    ...options,
    defaultVisibleChannel,
    logger,
    clock,
  });

  return Object.freeze({
    defaultRoomId: options.defaultRoomId,
    defaultVisibleChannel,
    battle: resolveBattleOptions(resolvedOptions, logger, clock),
    run: resolveRunOptions(resolvedOptions, logger, clock),
    multiplayer: resolveMultiplayerOptions(resolvedOptions, logger, clock),
    economy: resolveEconomyOptions(resolvedOptions, logger, clock),
  });
}

export function createDefaultBackendChatAdapterSuiteOptions(
  defaultRoomId: ChatRoomId | string,
  defaultVisibleChannel: ChatVisibleChannel = 'GLOBAL',
): BackendChatResolvedAdapterSuiteOptions {
  return resolveBackendChatAdapterSuiteOptions({
    defaultRoomId,
    defaultVisibleChannel,
  });
}

// ============================================================================
// MARK: Helper functions — report normalization
// ============================================================================

function inferAcceptedUnixMs(envelope: ChatInputEnvelope): UnixMs {
  return envelope.emittedAt;
}

function inferSignalFromEnvelope(envelope: ChatInputEnvelope): ChatSignalEnvelope {
  switch (envelope.kind) {
    case 'BATTLE_SIGNAL':
    case 'RUN_SIGNAL':
    case 'MULTIPLAYER_SIGNAL':
    case 'ECONOMY_SIGNAL':
    case 'LIVEOPS_SIGNAL':
      return envelope.payload;
    default:
      return envelope.payload as unknown as ChatSignalEnvelope;
  }
}

function normalizeBattleAccepted(
  artifact: BattleSignalAdapterArtifact,
): BackendChatUnifiedAcceptedArtifact {
  return Object.freeze({
    domain: 'BATTLE',
    eventName: artifact.eventName,
    dedupeKey: artifact.dedupeKey,
    routeChannel: artifact.routeChannel,
    severity: artifact.severity,
    narrativeWeight: artifact.narrativeWeight,
    emittedAt: inferAcceptedUnixMs(artifact.envelope),
    envelope: artifact.envelope,
    signal: inferSignalFromEnvelope(artifact.envelope),
    diagnostics: artifact.details,
  });
}

function normalizeRunAccepted(
  artifact: RunSignalAdapterArtifact,
): BackendChatUnifiedAcceptedArtifact {
  return Object.freeze({
    domain: 'RUN',
    eventName: artifact.eventName,
    dedupeKey: artifact.dedupeKey,
    routeChannel: artifact.routeChannel,
    severity: artifact.severity,
    narrativeWeight: artifact.narrativeWeight,
    emittedAt: inferAcceptedUnixMs(artifact.envelope),
    envelope: artifact.envelope,
    signal: inferSignalFromEnvelope(artifact.envelope),
    diagnostics: artifact.details,
  });
}

function normalizeMultiplayerAccepted(
  artifact: MultiplayerSignalAdapterAccepted,
): BackendChatUnifiedAcceptedArtifact {
  return Object.freeze({
    domain: 'MULTIPLAYER',
    eventName: artifact.eventName,
    dedupeKey: artifact.dedupeKey,
    routeChannel: artifact.routeChannel,
    severity: artifact.severity,
    narrativeWeight: artifact.narrativeWeight,
    emittedAt: inferAcceptedUnixMs(artifact.envelope),
    envelope: artifact.envelope,
    signal: artifact.signal,
    diagnostics: artifact.diagnostics,
  });
}

function normalizeEconomyAccepted(
  artifact: EconomySignalAdapterAccepted,
): BackendChatUnifiedAcceptedArtifact {
  return Object.freeze({
    domain: 'ECONOMY',
    eventName: artifact.eventName,
    dedupeKey: artifact.dedupeKey,
    routeChannel: artifact.routeChannel,
    severity: artifact.severity,
    narrativeWeight: artifact.narrativeWeight,
    emittedAt: inferAcceptedUnixMs(artifact.envelope),
    envelope: artifact.envelope,
    signal: artifact.signal,
    diagnostics: artifact.diagnostics,
  });
}

function normalizeBattleDeduped(
  artifact: BattleSignalAdapterArtifact,
): BackendChatUnifiedDedupedArtifact {
  return Object.freeze({
    domain: 'BATTLE',
    eventName: artifact.eventName,
    dedupeKey: artifact.dedupeKey,
    reason: 'DEDUPED',
    details: artifact.details,
  });
}

function normalizeRunDeduped(
  artifact: RunSignalAdapterArtifact,
): BackendChatUnifiedDedupedArtifact {
  return Object.freeze({
    domain: 'RUN',
    eventName: artifact.eventName,
    dedupeKey: artifact.dedupeKey,
    reason: 'DEDUPED',
    details: artifact.details,
  });
}

function normalizeMultiplayerDeduped(
  artifact: MultiplayerSignalAdapterDeduped,
): BackendChatUnifiedDedupedArtifact {
  return Object.freeze({
    domain: 'MULTIPLAYER',
    eventName: artifact.eventName,
    dedupeKey: artifact.dedupeKey,
    reason: artifact.reason,
    details: artifact.details,
  });
}

function normalizeEconomyDeduped(
  artifact: EconomySignalAdapterDeduped,
): BackendChatUnifiedDedupedArtifact {
  return Object.freeze({
    domain: 'ECONOMY',
    eventName: artifact.eventName,
    dedupeKey: artifact.dedupeKey,
    reason: artifact.reason,
    details: artifact.details,
  });
}

function normalizeBattleRejected(
  artifact: BattleSignalAdapterRejection,
): BackendChatUnifiedRejectedArtifact {
  return Object.freeze({
    domain: 'BATTLE',
    eventName: artifact.eventName,
    reason: artifact.reason,
    details: artifact.details,
  });
}

function normalizeRunRejected(
  artifact: RunSignalAdapterRejection,
): BackendChatUnifiedRejectedArtifact {
  return Object.freeze({
    domain: 'RUN',
    eventName: artifact.eventName,
    reason: artifact.reason,
    details: artifact.details,
  });
}

function normalizeMultiplayerRejected(
  artifact: MultiplayerSignalAdapterRejected,
): BackendChatUnifiedRejectedArtifact {
  return Object.freeze({
    domain: 'MULTIPLAYER',
    eventName: artifact.eventName,
    reason: artifact.reason,
    details: artifact.details,
  });
}

function normalizeEconomyRejected(
  artifact: EconomySignalAdapterRejected,
): BackendChatUnifiedRejectedArtifact {
  return Object.freeze({
    domain: 'ECONOMY',
    eventName: artifact.eventName,
    reason: artifact.reason,
    details: artifact.details,
  });
}

function emptyDomainCounters(): BackendChatAdapterDomainCounters {
  return Object.freeze({
    accepted: 0,
    deduped: 0,
    rejected: 0,
  });
}

function toCounters(
  accepted: number,
  deduped: number,
  rejected: number,
): BackendChatAdapterDomainCounters {
  return Object.freeze({ accepted, deduped, rejected });
}

function pickHottestDomain(
  counters: Readonly<Record<BackendChatAdapterDomainId, BackendChatAdapterDomainCounters>>,
): BackendChatAdapterDomainId {
  let winner: BackendChatAdapterDomainId = 'BATTLE';
  let highest = -1;
  for (const domain of BACKEND_CHAT_ADAPTER_DOMAIN_IDS) {
    const score =
      counters[domain].accepted + counters[domain].deduped + counters[domain].rejected;
    if (score > highest) {
      highest = score;
      winner = domain;
    }
  }
  return winner;
}

function pickQuietestDomain(
  counters: Readonly<Record<BackendChatAdapterDomainId, BackendChatAdapterDomainCounters>>,
): BackendChatAdapterDomainId {
  let winner: BackendChatAdapterDomainId = 'BATTLE';
  let lowest = Number.POSITIVE_INFINITY;
  for (const domain of BACKEND_CHAT_ADAPTER_DOMAIN_IDS) {
    const score =
      counters[domain].accepted + counters[domain].deduped + counters[domain].rejected;
    if (score < lowest) {
      lowest = score;
      winner = domain;
    }
  }
  return winner;
}

// ============================================================================
// MARK: Helper functions — descriptor / ingress inference
// ============================================================================

export function describeAdapterIngress(
  ingress: BackendChatAdapterIngress | BackendChatAdapterSnapshotIngress,
): BackendChatAdapterIngressDescriptor {
  if ('eventName' in ingress) {
    return Object.freeze({
      kind:
        ingress.domain === 'BATTLE'
          ? 'BATTLE_EVENT'
          : ingress.domain === 'RUN'
            ? 'RUN_EVENT'
            : ingress.domain === 'MULTIPLAYER'
              ? 'MULTIPLAYER_EVENT'
              : 'ECONOMY_EVENT',
      domain: ingress.domain,
      routeChannel: ingress.context?.routeChannel ?? null,
      roomId: ingress.context?.roomId ?? null,
      eventName: String(ingress.eventName),
    });
  }

  return Object.freeze({
    kind:
      ingress.domain === 'BATTLE'
        ? 'BATTLE_SNAPSHOT'
        : ingress.domain === 'RUN'
          ? 'RUN_SNAPSHOT'
          : ingress.domain === 'MULTIPLAYER'
            ? 'MULTIPLAYER_SNAPSHOT'
            : 'ECONOMY_SNAPSHOT',
    domain: ingress.domain,
    routeChannel: ingress.context?.routeChannel ?? null,
    roomId: ingress.context?.roomId ?? null,
    eventName: null,
  });
}

export function getBackendChatAdapterModuleManifest(): readonly BackendChatAdapterModuleDescriptor[] {
  return BACKEND_CHAT_ADAPTER_MODULES;
}

// ============================================================================
// MARK: Suite implementation
// ============================================================================

export class BackendChatAdapterSuite {
  public readonly version = BACKEND_CHAT_ADAPTER_SUITE_VERSION;
  public readonly publicApiVersion =
    BACKEND_CHAT_ADAPTER_SUITE_PUBLIC_API_VERSION;

  public readonly battle: BattleSignalAdapter;
  public readonly run: RunSignalAdapter;
  public readonly multiplayer: MultiplayerSignalAdapter;
  public readonly economy: EconomySignalAdapter;

  private readonly logger: BackendChatAdapterSuiteLogger;
  private readonly clock: BackendChatAdapterSuiteClock;
  private readonly options: BackendChatResolvedAdapterSuiteOptions;

  public constructor(options: BackendChatAdapterSuiteOptions) {
    this.options = resolveBackendChatAdapterSuiteOptions(options);
    this.logger = options.logger ?? NULL_LOGGER;
    this.clock = options.clock ?? SYSTEM_CLOCK;

    this.battle = new BattleSignalAdapter(this.options.battle);
    this.run = new RunSignalAdapter(this.options.run);
    this.multiplayer = new MultiplayerSignalAdapter(this.options.multiplayer);
    this.economy = new EconomySignalAdapter(this.options.economy);
  }

  // -------------------------------------------------------------------------
  // Suite lifecycle and state
  // -------------------------------------------------------------------------

  public reset(): void {
    this.battle.reset();
    this.run.reset();
    this.multiplayer.reset();
    this.economy.reset();
  }

  public getResolvedOptions(): BackendChatResolvedAdapterSuiteOptions {
    return this.options;
  }

  public getState(): BackendChatAdapterSuiteState {
    const battle = this.battle.getState();
    const run = this.run.getState();
    const multiplayer = this.multiplayer.getState();
    const economy = this.economy.getState();

    const totals: Readonly<
      Record<BackendChatAdapterDomainId, BackendChatAdapterDomainCounters>
    > = Object.freeze({
      BATTLE: toCounters(
        battle.acceptedCount,
        battle.dedupedCount,
        battle.rejectedCount,
      ),
      RUN: toCounters(run.acceptedCount, run.dedupedCount, run.rejectedCount),
      MULTIPLAYER: toCounters(
        multiplayer.acceptedCount,
        multiplayer.dedupedCount,
        multiplayer.rejectedCount,
      ),
      ECONOMY: toCounters(
        economy.acceptedCount,
        economy.dedupedCount,
        economy.rejectedCount,
      ),
    });

    return Object.freeze({
      battle,
      run,
      multiplayer,
      economy,
      totals,
    });
  }

  public getHealthReport(): BackendChatAdapterHealthReport {
    const state = this.getState();
    const totals = state.totals;
    const totalAccepted = sumAccepted(totals);
    const totalDeduped = sumDeduped(totals);
    const totalRejected = sumRejected(totals);

    return Object.freeze({
      version: this.version,
      publicApiVersion: this.publicApiVersion,
      moduleCount: BACKEND_CHAT_ADAPTER_MODULES.length,
      totalAccepted,
      totalDeduped,
      totalRejected,
      hottestDomain: pickHottestDomain(totals),
      quietestDomain: pickQuietestDomain(totals),
      domains: totals,
    });
  }

  public getModuleManifest(): readonly BackendChatAdapterModuleDescriptor[] {
    return getBackendChatAdapterModuleManifest();
  }

  // -------------------------------------------------------------------------
  // Strongly typed domain entry points — event adaptation
  // -------------------------------------------------------------------------

  public adaptBattleEvent(
    eventName: BattleSignalAdapterEventName,
    payload: unknown,
    context?: BattleSignalAdapterContext,
  ): BackendChatAdapterSuiteReport {
    return this.fromBattleReport(this.battle.adaptEvent(eventName, payload, context));
  }

  public adaptRunEvent(
    eventName: RunSignalAdapterEventName,
    payload: unknown,
    context?: RunSignalAdapterContext,
  ): BackendChatAdapterSuiteReport {
    return this.fromRunReport(this.run.adaptRuntimeEvent(eventName, payload, context));
  }

  public adaptMultiplayerEvent(
    eventName: MultiplayerSignalAdapterEventName,
    payload: unknown,
    context?: MultiplayerSignalAdapterContext,
  ): BackendChatAdapterSuiteReport {
    return this.fromMultiplayerReport(
      this.multiplayer.adaptEvent(eventName, payload, context),
    );
  }

  public adaptEconomyEvent(
    eventName: EconomySignalAdapterEventName,
    payload: unknown,
    context?: EconomySignalAdapterContext,
  ): BackendChatAdapterSuiteReport {
    return this.fromEconomyReport(this.economy.adaptEvent(eventName, payload, context));
  }

  // -------------------------------------------------------------------------
  // Strongly typed domain entry points — snapshot adaptation
  // -------------------------------------------------------------------------

  public adaptBattleSnapshot(
    snapshot: BattleSnapshotCompat,
    context?: BattleSignalAdapterContext,
  ): BackendChatAdapterSuiteReport {
    return this.fromBattleReport(this.battle.adaptSnapshot(snapshot, context));
  }

  public adaptRunSnapshot(
    snapshot: RunSnapshotCompat,
    context?: RunSignalAdapterContext,
  ): BackendChatAdapterSuiteReport {
    return this.fromRunReport(this.run.adaptSnapshot(snapshot, context));
  }

  public adaptMultiplayerSnapshot(
    snapshot: MultiplayerRoomCompat,
    context?: MultiplayerSignalAdapterContext,
  ): BackendChatAdapterSuiteReport {
    return this.fromMultiplayerReport(
      this.multiplayer.adaptSnapshot(snapshot, context),
    );
  }

  public adaptEconomySnapshot(
    snapshot: EconomyDealSnapshotCompat,
    context?: EconomySignalAdapterContext,
  ): BackendChatAdapterSuiteReport {
    return this.fromEconomyReport(this.economy.adaptSnapshot(snapshot, context));
  }

  // -------------------------------------------------------------------------
  // Dynamic ingress entry points — one mixed-domain suite surface
  // -------------------------------------------------------------------------

  public adaptIngress(
    ingress: BackendChatAdapterIngress | BackendChatAdapterSnapshotIngress,
  ): BackendChatAdapterSuiteReport {
    const descriptor = describeAdapterIngress(ingress);
    this.logger.debug('BackendChatAdapterSuite.adaptIngress', {
      domain: descriptor.domain,
      kind: descriptor.kind,
      routeChannel: descriptor.routeChannel ?? null,
      roomId: normalizeRoomIdString(descriptor.roomId),
      eventName: descriptor.eventName,
    });

    if ('eventName' in ingress) {
      switch (ingress.domain) {
        case 'BATTLE':
          return this.adaptBattleEvent(
            ingress.eventName,
            ingress.payload,
            ingress.context,
          );
        case 'RUN':
          return this.adaptRunEvent(
            ingress.eventName,
            ingress.payload,
            ingress.context,
          );
        case 'MULTIPLAYER':
          return this.adaptMultiplayerEvent(
            ingress.eventName,
            ingress.payload,
            ingress.context,
          );
        case 'ECONOMY':
          return this.adaptEconomyEvent(
            ingress.eventName,
            ingress.payload,
            ingress.context,
          );
      }
    }

    switch (ingress.domain) {
      case 'BATTLE':
        return this.adaptBattleSnapshot(ingress.snapshot, ingress.context);
      case 'RUN':
        return this.adaptRunSnapshot(ingress.snapshot, ingress.context);
      case 'MULTIPLAYER':
        return this.adaptMultiplayerSnapshot(ingress.snapshot, ingress.context);
      case 'ECONOMY':
        return this.adaptEconomySnapshot(ingress.snapshot, ingress.context);
    }
  }

  public adaptIngressBatch(
    ingresses: readonly (BackendChatAdapterIngress | BackendChatAdapterSnapshotIngress)[],
  ): BackendChatAdapterSuiteReport {
    const collected = createEmptyMutableSuiteAccumulator();

    for (const ingress of ingresses) {
      const report = this.adaptIngress(ingress);
      mergeIntoMutableSuiteAccumulator(collected, report);
    }

    return freezeMutableSuiteAccumulator(collected);
  }

  // -------------------------------------------------------------------------
  // Snapshot bundle orchestration
  // -------------------------------------------------------------------------

  public adaptSnapshotBundle(
    bundle: BackendChatAdapterSnapshotBundle,
    context?: BackendChatAdapterBundleContext,
  ): BackendChatAdapterSuiteReport {
    const ingresses: BackendChatAdapterSnapshotIngress[] = [];

    if (bundle.battle) {
      ingresses.push({
        domain: 'BATTLE',
        snapshot: bundle.battle,
        context: context?.battle,
      });
    }
    if (bundle.run) {
      ingresses.push({
        domain: 'RUN',
        snapshot: bundle.run,
        context: context?.run,
      });
    }
    if (bundle.multiplayer) {
      ingresses.push({
        domain: 'MULTIPLAYER',
        snapshot: bundle.multiplayer,
        context: context?.multiplayer,
      });
    }
    if (bundle.economy) {
      ingresses.push({
        domain: 'ECONOMY',
        snapshot: bundle.economy,
        context: context?.economy,
      });
    }

    return this.adaptIngressBatch(ingresses);
  }

  // -------------------------------------------------------------------------
  // Domain-native batch helpers that preserve original adapter semantics
  // -------------------------------------------------------------------------

  public adaptBattleBatch(
    entries: readonly {
      readonly eventName: BattleSignalAdapterEventName;
      readonly payload: unknown;
      readonly context?: BattleSignalAdapterContext;
    }[],
  ): BackendChatAdapterSuiteReport {
    return this.fromBattleReport(this.battle.adaptBatch(entries));
  }

  public adaptRunBatch(
    entries: readonly {
      readonly eventName: RunSignalAdapterEventName;
      readonly payload: unknown;
      readonly context?: RunSignalAdapterContext;
    }[],
  ): BackendChatAdapterSuiteReport {
    const reports = entries.map((entry) =>
      this.run.adaptRuntimeEvent(entry.eventName, entry.payload, entry.context),
    );
    return this.fromRunReports(reports);
  }

  public adaptMultiplayerBatch(
    entries: ReadonlyArray<{
      readonly eventName: MultiplayerSignalAdapterEventName;
      readonly payload: unknown;
      readonly context?: MultiplayerSignalAdapterContext;
    }>,
  ): BackendChatAdapterSuiteReport {
    return this.fromMultiplayerReport(this.multiplayer.adaptMany(entries));
  }

  public adaptEconomyBatch(
    entries: ReadonlyArray<{
      readonly eventName: EconomySignalAdapterEventName;
      readonly payload: unknown;
      readonly context?: EconomySignalAdapterContext;
    }>,
  ): BackendChatAdapterSuiteReport {
    return this.fromEconomyReport(this.economy.adaptMany(entries));
  }

  // -------------------------------------------------------------------------
  // Internal report normalization — battle
  // -------------------------------------------------------------------------

  private fromBattleReport(
    report: BattleSignalAdapterReport,
  ): BackendChatAdapterSuiteReport {
    return Object.freeze({
      accepted: Object.freeze(report.accepted.map(normalizeBattleAccepted)),
      deduped: Object.freeze(report.deduped.map(normalizeBattleDeduped)),
      rejected: Object.freeze(report.rejected.map(normalizeBattleRejected)),
      byDomain: Object.freeze({
        battle: Object.freeze({
          accepted: Object.freeze([...report.accepted]),
          deduped: Object.freeze([...report.deduped]),
          rejected: Object.freeze([...report.rejected]),
        }),
        run: emptyRunDomainReport(),
        multiplayer: emptyMultiplayerDomainReport(),
        economy: emptyEconomyDomainReport(),
      }),
      counters: Object.freeze({
        BATTLE: toCounters(
          report.accepted.length,
          report.deduped.length,
          report.rejected.length,
        ),
        RUN: emptyDomainCounters(),
        MULTIPLAYER: emptyDomainCounters(),
        ECONOMY: emptyDomainCounters(),
      }),
    });
  }

  private fromBattleReports(
    reports: readonly BattleSignalAdapterReport[],
  ): BackendChatAdapterSuiteReport {
    const collected = createEmptyMutableSuiteAccumulator();
    for (const report of reports) {
      mergeIntoMutableSuiteAccumulator(collected, this.fromBattleReport(report));
    }
    return freezeMutableSuiteAccumulator(collected);
  }

  // -------------------------------------------------------------------------
  // Internal report normalization — run
  // -------------------------------------------------------------------------

  private fromRunReport(report: RunSignalAdapterReport): BackendChatAdapterSuiteReport {
    return Object.freeze({
      accepted: Object.freeze(report.accepted.map(normalizeRunAccepted)),
      deduped: Object.freeze(report.deduped.map(normalizeRunDeduped)),
      rejected: Object.freeze(report.rejected.map(normalizeRunRejected)),
      byDomain: Object.freeze({
        battle: emptyBattleDomainReport(),
        run: Object.freeze({
          accepted: Object.freeze([...report.accepted]),
          deduped: Object.freeze([...report.deduped]),
          rejected: Object.freeze([...report.rejected]),
        }),
        multiplayer: emptyMultiplayerDomainReport(),
        economy: emptyEconomyDomainReport(),
      }),
      counters: Object.freeze({
        BATTLE: emptyDomainCounters(),
        RUN: toCounters(
          report.accepted.length,
          report.deduped.length,
          report.rejected.length,
        ),
        MULTIPLAYER: emptyDomainCounters(),
        ECONOMY: emptyDomainCounters(),
      }),
    });
  }

  private fromRunReports(
    reports: readonly RunSignalAdapterReport[],
  ): BackendChatAdapterSuiteReport {
    const collected = createEmptyMutableSuiteAccumulator();
    for (const report of reports) {
      mergeIntoMutableSuiteAccumulator(collected, this.fromRunReport(report));
    }
    return freezeMutableSuiteAccumulator(collected);
  }

  // -------------------------------------------------------------------------
  // Internal report normalization — multiplayer
  // -------------------------------------------------------------------------

  private fromMultiplayerReport(
    report: MultiplayerSignalAdapterReport,
  ): BackendChatAdapterSuiteReport {
    return Object.freeze({
      accepted: Object.freeze(report.accepted.map(normalizeMultiplayerAccepted)),
      deduped: Object.freeze(report.deduped.map(normalizeMultiplayerDeduped)),
      rejected: Object.freeze(report.rejected.map(normalizeMultiplayerRejected)),
      byDomain: Object.freeze({
        battle: emptyBattleDomainReport(),
        run: emptyRunDomainReport(),
        multiplayer: Object.freeze({
          accepted: Object.freeze([...report.accepted]),
          deduped: Object.freeze([...report.deduped]),
          rejected: Object.freeze([...report.rejected]),
        }),
        economy: emptyEconomyDomainReport(),
      }),
      counters: Object.freeze({
        BATTLE: emptyDomainCounters(),
        RUN: emptyDomainCounters(),
        MULTIPLAYER: toCounters(
          report.accepted.length,
          report.deduped.length,
          report.rejected.length,
        ),
        ECONOMY: emptyDomainCounters(),
      }),
    });
  }

  // -------------------------------------------------------------------------
  // Internal report normalization — economy
  // -------------------------------------------------------------------------

  private fromEconomyReport(
    report: EconomySignalAdapterReport,
  ): BackendChatAdapterSuiteReport {
    return Object.freeze({
      accepted: Object.freeze(report.accepted.map(normalizeEconomyAccepted)),
      deduped: Object.freeze(report.deduped.map(normalizeEconomyDeduped)),
      rejected: Object.freeze(report.rejected.map(normalizeEconomyRejected)),
      byDomain: Object.freeze({
        battle: emptyBattleDomainReport(),
        run: emptyRunDomainReport(),
        multiplayer: emptyMultiplayerDomainReport(),
        economy: Object.freeze({
          accepted: Object.freeze([...report.accepted]),
          deduped: Object.freeze([...report.deduped]),
          rejected: Object.freeze([...report.rejected]),
        }),
      }),
      counters: Object.freeze({
        BATTLE: emptyDomainCounters(),
        RUN: emptyDomainCounters(),
        MULTIPLAYER: emptyDomainCounters(),
        ECONOMY: toCounters(
          report.accepted.length,
          report.deduped.length,
          report.rejected.length,
        ),
      }),
    });
  }
}

// ============================================================================
// MARK: Mutable accumulator helpers for mixed-domain report merges
// ============================================================================

interface MutableSuiteAccumulator {
  accepted: BackendChatUnifiedAcceptedArtifact[];
  deduped: BackendChatUnifiedDedupedArtifact[];
  rejected: BackendChatUnifiedRejectedArtifact[];
  byDomain: {
    battle: {
      accepted: BattleSignalAdapterArtifact[];
      deduped: BattleSignalAdapterArtifact[];
      rejected: BattleSignalAdapterRejection[];
    };
    run: {
      accepted: RunSignalAdapterArtifact[];
      deduped: RunSignalAdapterArtifact[];
      rejected: RunSignalAdapterRejection[];
    };
    multiplayer: {
      accepted: MultiplayerSignalAdapterAccepted[];
      deduped: MultiplayerSignalAdapterDeduped[];
      rejected: MultiplayerSignalAdapterRejected[];
    };
    economy: {
      accepted: EconomySignalAdapterAccepted[];
      deduped: EconomySignalAdapterDeduped[];
      rejected: EconomySignalAdapterRejected[];
    };
  };
  counters: Record<BackendChatAdapterDomainId, BackendChatAdapterDomainCounters>;
}

function createEmptyMutableSuiteAccumulator(): MutableSuiteAccumulator {
  return {
    accepted: [],
    deduped: [],
    rejected: [],
    byDomain: {
      battle: { accepted: [], deduped: [], rejected: [] },
      run: { accepted: [], deduped: [], rejected: [] },
      multiplayer: { accepted: [], deduped: [], rejected: [] },
      economy: { accepted: [], deduped: [], rejected: [] },
    },
    counters: {
      BATTLE: { accepted: 0, deduped: 0, rejected: 0 },
      RUN: { accepted: 0, deduped: 0, rejected: 0 },
      MULTIPLAYER: { accepted: 0, deduped: 0, rejected: 0 },
      ECONOMY: { accepted: 0, deduped: 0, rejected: 0 },
    },
  };
}

function mergeIntoMutableSuiteAccumulator(
  target: MutableSuiteAccumulator,
  source: BackendChatAdapterSuiteReport,
): void {
  target.accepted.push(...source.accepted);
  target.deduped.push(...source.deduped);
  target.rejected.push(...source.rejected);

  target.byDomain.battle.accepted.push(...source.byDomain.battle.accepted);
  target.byDomain.battle.deduped.push(...source.byDomain.battle.deduped);
  target.byDomain.battle.rejected.push(...source.byDomain.battle.rejected);

  target.byDomain.run.accepted.push(...source.byDomain.run.accepted);
  target.byDomain.run.deduped.push(...source.byDomain.run.deduped);
  target.byDomain.run.rejected.push(...source.byDomain.run.rejected);

  target.byDomain.multiplayer.accepted.push(
    ...source.byDomain.multiplayer.accepted,
  );
  target.byDomain.multiplayer.deduped.push(
    ...source.byDomain.multiplayer.deduped,
  );
  target.byDomain.multiplayer.rejected.push(
    ...source.byDomain.multiplayer.rejected,
  );

  target.byDomain.economy.accepted.push(...source.byDomain.economy.accepted);
  target.byDomain.economy.deduped.push(...source.byDomain.economy.deduped);
  target.byDomain.economy.rejected.push(...source.byDomain.economy.rejected);

  for (const domain of BACKEND_CHAT_ADAPTER_DOMAIN_IDS) {
    target.counters[domain] = toCounters(
      target.counters[domain].accepted + source.counters[domain].accepted,
      target.counters[domain].deduped + source.counters[domain].deduped,
      target.counters[domain].rejected + source.counters[domain].rejected,
    );
  }
}

function freezeMutableSuiteAccumulator(
  value: MutableSuiteAccumulator,
): BackendChatAdapterSuiteReport {
  return Object.freeze({
    accepted: Object.freeze([...value.accepted]),
    deduped: Object.freeze([...value.deduped]),
    rejected: Object.freeze([...value.rejected]),
    byDomain: Object.freeze({
      battle: Object.freeze({
        accepted: Object.freeze([...value.byDomain.battle.accepted]),
        deduped: Object.freeze([...value.byDomain.battle.deduped]),
        rejected: Object.freeze([...value.byDomain.battle.rejected]),
      }),
      run: Object.freeze({
        accepted: Object.freeze([...value.byDomain.run.accepted]),
        deduped: Object.freeze([...value.byDomain.run.deduped]),
        rejected: Object.freeze([...value.byDomain.run.rejected]),
      }),
      multiplayer: Object.freeze({
        accepted: Object.freeze([...value.byDomain.multiplayer.accepted]),
        deduped: Object.freeze([...value.byDomain.multiplayer.deduped]),
        rejected: Object.freeze([...value.byDomain.multiplayer.rejected]),
      }),
      economy: Object.freeze({
        accepted: Object.freeze([...value.byDomain.economy.accepted]),
        deduped: Object.freeze([...value.byDomain.economy.deduped]),
        rejected: Object.freeze([...value.byDomain.economy.rejected]),
      }),
    }),
    counters: Object.freeze({
      BATTLE: value.counters.BATTLE,
      RUN: value.counters.RUN,
      MULTIPLAYER: value.counters.MULTIPLAYER,
      ECONOMY: value.counters.ECONOMY,
    }),
  });
}

// ============================================================================
// MARK: Empty domain reports for suite normalization
// ============================================================================

function emptyBattleDomainReport(): BackendChatAdapterSuiteReport['byDomain']['battle'] {
  return Object.freeze({
    accepted: Object.freeze([]),
    deduped: Object.freeze([]),
    rejected: Object.freeze([]),
  });
}

function emptyRunDomainReport(): BackendChatAdapterSuiteReport['byDomain']['run'] {
  return Object.freeze({
    accepted: Object.freeze([]),
    deduped: Object.freeze([]),
    rejected: Object.freeze([]),
  });
}

function emptyMultiplayerDomainReport(): BackendChatAdapterSuiteReport['byDomain']['multiplayer'] {
  return Object.freeze({
    accepted: Object.freeze([]),
    deduped: Object.freeze([]),
    rejected: Object.freeze([]),
  });
}

function emptyEconomyDomainReport(): BackendChatAdapterSuiteReport['byDomain']['economy'] {
  return Object.freeze({
    accepted: Object.freeze([]),
    deduped: Object.freeze([]),
    rejected: Object.freeze([]),
  });
}

// ============================================================================
// MARK: Public helper factories and convenience functions
// ============================================================================

export function createBackendChatAdapterSuite(
  options: BackendChatAdapterSuiteOptions,
): BackendChatAdapterSuite {
  return new BackendChatAdapterSuite(options);
}

export function createBackendChatAdapterSuiteFromResolvedOptions(
  options: BackendChatResolvedAdapterSuiteOptions,
): BackendChatAdapterSuite {
  return new BackendChatAdapterSuite({
    defaultRoomId: options.defaultRoomId,
    defaultVisibleChannel: options.defaultVisibleChannel,
    battle: options.battle,
    run: options.run,
    multiplayer: options.multiplayer,
    economy: options.economy,
  });
}

export function createBackendChatAdapterSuiteHealthReport(
  state: BackendChatAdapterSuiteState,
): BackendChatAdapterHealthReport {
  const totals = state.totals;
  return Object.freeze({
    version: BACKEND_CHAT_ADAPTER_SUITE_VERSION,
    publicApiVersion: BACKEND_CHAT_ADAPTER_SUITE_PUBLIC_API_VERSION,
    moduleCount: BACKEND_CHAT_ADAPTER_MODULES.length,
    totalAccepted: sumAccepted(totals),
    totalDeduped: sumDeduped(totals),
    totalRejected: sumRejected(totals),
    hottestDomain: pickHottestDomain(totals),
    quietestDomain: pickQuietestDomain(totals),
    domains: totals,
  });
}

export function mergeBackendChatAdapterSuiteReports(
  reports: readonly BackendChatAdapterSuiteReport[],
): BackendChatAdapterSuiteReport {
  const collected = createEmptyMutableSuiteAccumulator();
  for (const report of reports) {
    mergeIntoMutableSuiteAccumulator(collected, report);
  }
  return freezeMutableSuiteAccumulator(collected);
}

export function sortAcceptedArtifactsByTime(
  artifacts: readonly BackendChatUnifiedAcceptedArtifact[],
): readonly BackendChatUnifiedAcceptedArtifact[] {
  return Object.freeze(
    [...artifacts].sort((left, right) => {
      const dt = left.emittedAt - right.emittedAt;
      if (dt !== 0) {
        return dt;
      }
      return left.dedupeKey.localeCompare(right.dedupeKey);
    }),
  );
}

export function extractAcceptedEnvelopes(
  report: BackendChatAdapterSuiteReport,
): readonly ChatInputEnvelope[] {
  return Object.freeze(report.accepted.map((artifact) => artifact.envelope));
}

export function extractAcceptedSignals(
  report: BackendChatAdapterSuiteReport,
): readonly ChatSignalEnvelope[] {
  return Object.freeze(report.accepted.map((artifact) => artifact.signal));
}

export function extractAcceptedForDomain(
  report: BackendChatAdapterSuiteReport,
  domain: BackendChatAdapterDomainId,
): readonly BackendChatUnifiedAcceptedArtifact[] {
  return Object.freeze(report.accepted.filter((artifact) => artifact.domain === domain));
}

export function extractRejectedForDomain(
  report: BackendChatAdapterSuiteReport,
  domain: BackendChatAdapterDomainId,
): readonly BackendChatUnifiedRejectedArtifact[] {
  return Object.freeze(report.rejected.filter((artifact) => artifact.domain === domain));
}

export function extractDedupedForDomain(
  report: BackendChatAdapterSuiteReport,
  domain: BackendChatAdapterDomainId,
): readonly BackendChatUnifiedDedupedArtifact[] {
  return Object.freeze(report.deduped.filter((artifact) => artifact.domain === domain));
}

export function countAcceptedByRouteChannel(
  report: BackendChatAdapterSuiteReport,
): Readonly<Record<ChatVisibleChannel, number>> {
  const counts: Record<ChatVisibleChannel, number> = {
    GLOBAL: 0,
    SYNDICATE: 0,
    DEAL_ROOM: 0,
    LOBBY: 0,
  };

  for (const artifact of report.accepted) {
    counts[artifact.routeChannel] += 1;
  }

  return Object.freeze(counts);
}

export function toBackendChatAdapterDiagnosticSnapshot(
  suite: BackendChatAdapterSuite,
): Readonly<Record<string, JsonValue>> {
  const state = suite.getState();
  const health = suite.getHealthReport();
  return Object.freeze({
    version: health.version,
    publicApiVersion: health.publicApiVersion,
    hottestDomain: health.hottestDomain,
    quietestDomain: health.quietestDomain,
    totalAccepted: health.totalAccepted,
    totalDeduped: health.totalDeduped,
    totalRejected: health.totalRejected,
    battleAccepted: state.battle.acceptedCount,
    runAccepted: state.run.acceptedCount,
    multiplayerAccepted: state.multiplayer.acceptedCount,
    economyAccepted: state.economy.acceptedCount,
  });
}

// ============================================================================
// MARK: Suite bridge helpers for ChatEventBridge / ChatEngine composition
// ============================================================================

export interface BackendChatAdapterBridgeResult {
  readonly envelopes: readonly ChatInputEnvelope[];
  readonly signals: readonly ChatSignalEnvelope[];
  readonly report: BackendChatAdapterSuiteReport;
  readonly acceptedSorted: readonly BackendChatUnifiedAcceptedArtifact[];
}

export function adaptIngressesForBackendChatBridge(
  suite: BackendChatAdapterSuite,
  ingresses: readonly (BackendChatAdapterIngress | BackendChatAdapterSnapshotIngress)[],
): BackendChatAdapterBridgeResult {
  const report = suite.adaptIngressBatch(ingresses);
  const acceptedSorted = sortAcceptedArtifactsByTime(report.accepted);
  return Object.freeze({
    envelopes: extractAcceptedEnvelopes(report),
    signals: extractAcceptedSignals(report),
    report,
    acceptedSorted,
  });
}

export function adaptSnapshotBundleForBackendChatBridge(
  suite: BackendChatAdapterSuite,
  bundle: BackendChatAdapterSnapshotBundle,
  context?: BackendChatAdapterBundleContext,
): BackendChatAdapterBridgeResult {
  const report = suite.adaptSnapshotBundle(bundle, context);
  const acceptedSorted = sortAcceptedArtifactsByTime(report.accepted);
  return Object.freeze({
    envelopes: extractAcceptedEnvelopes(report),
    signals: extractAcceptedSignals(report),
    report,
    acceptedSorted,
  });
}

// ============================================================================
// MARK: Internal numeric helpers
// ============================================================================

function sumAccepted(
  counters: Readonly<Record<BackendChatAdapterDomainId, BackendChatAdapterDomainCounters>>,
): number {
  let total = 0;
  for (const domain of BACKEND_CHAT_ADAPTER_DOMAIN_IDS) {
    total += counters[domain].accepted;
  }
  return total;
}

function sumDeduped(
  counters: Readonly<Record<BackendChatAdapterDomainId, BackendChatAdapterDomainCounters>>,
): number {
  let total = 0;
  for (const domain of BACKEND_CHAT_ADAPTER_DOMAIN_IDS) {
    total += counters[domain].deduped;
  }
  return total;
}

function sumRejected(
  counters: Readonly<Record<BackendChatAdapterDomainId, BackendChatAdapterDomainCounters>>,
): number {
  let total = 0;
  for (const domain of BACKEND_CHAT_ADAPTER_DOMAIN_IDS) {
    total += counters[domain].rejected;
  }
  return total;
}

function normalizeRoomIdString(value: Nullable<ChatRoomId | string>): Nullable<string> {
  if (value == null) {
    return null;
  }
  return String(value);
}

// ============================================================================
// MARK: Static exported bundle metadata
// ============================================================================

export interface BackendChatAdapterSuiteBundle {
  readonly version: string;
  readonly publicApiVersion: string;
  readonly treePaths: typeof BACKEND_CHAT_ADAPTER_TREE_PATHS;
  readonly modules: readonly BackendChatAdapterModuleDescriptor[];
  readonly classes: Readonly<{
    BattleSignalAdapter: typeof BattleSignalAdapter;
    RunSignalAdapter: typeof RunSignalAdapter;
    MultiplayerSignalAdapter: typeof MultiplayerSignalAdapter;
    EconomySignalAdapter: typeof EconomySignalAdapter;
    BackendChatAdapterSuite: typeof BackendChatAdapterSuite;
  }>;
}

export const BACKEND_CHAT_ADAPTER_SUITE_BUNDLE: BackendChatAdapterSuiteBundle =
  Object.freeze({
    version: BACKEND_CHAT_ADAPTER_SUITE_VERSION,
    publicApiVersion: BACKEND_CHAT_ADAPTER_SUITE_PUBLIC_API_VERSION,
    treePaths: BACKEND_CHAT_ADAPTER_TREE_PATHS,
    modules: BACKEND_CHAT_ADAPTER_MODULES,
    classes: Object.freeze({
      BattleSignalAdapter,
      RunSignalAdapter,
      MultiplayerSignalAdapter,
      EconomySignalAdapter,
      BackendChatAdapterSuite,
    }),
  });

// ============================================================================
// MARK: Final default export
// ============================================================================

export default BACKEND_CHAT_ADAPTER_SUITE_BUNDLE;
