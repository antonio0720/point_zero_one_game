
/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT ENGINE CHANNEL POLICY
 * FILE: pzo-web/src/engines/chat/ChatChannelPolicy.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical frontend channel authority for the unified chat engine.
 *
 * This file exists because the current repo still keeps channel ownership spread
 * across UI hook state, donor routers, and implicit assumptions inside message
 * factories. That is enough for a prototype, but not enough for a first-class
 * chat engine where channel selection itself is part of the run:
 *   - GLOBAL is spectacle.
 *   - SYNDICATE is coordination.
 *   - DEAL_ROOM is predatory negotiation with proof-bearing gravity.
 *   - LOBBY is the pre/post-run social foyer.
 *
 * This controller centralizes:
 *   - channel visibility,
 *   - channel access,
 *   - send-route shaping,
 *   - mode-aware fallback,
 *   - moderation locks,
 *   - privacy-aware reroutes,
 *   - invasion suitability,
 *   - and tab rendering policy.
 *
 * Preserved repo truths
 * ---------------------
 * - Current pzo-web chat contracts already distinguish GLOBAL, SYNDICATE, and
 *   DEAL_ROOM as separate behavioral spaces.
 * - The donor chat brain under frontend/apps/web/components/chat already treats
 *   routing and privacy as real logic, not presentation trivia.
 * - Your mount policy is explicit: one dock, multiple surfaces, zero per-screen
 *   chat brains.
 * - Deal Room messages can be immutable / proof-bearing, which means channel
 *   policy must coordinate with privacy policy and transcript policy rather than
 *   pretending channel selection is a simple UI tab index.
 *
 * Design laws
 * -----------
 * - UI renders tabs; policy decides whether they should exist, be writable, or
 *   escalate.
 * - Channel access is a gameplay decision, not a CSS decision.
 * - GLOBAL is the least trusted channel.
 * - SYNDICATE requires relationship context.
 * - DEAL_ROOM requires negotiation context or proof context.
 * - LOBBY should exist as a foyer and decompression lane before and after runs.
 * - Channel fallback must be deterministic.
 * - Privacy and moderation can override preference.
 * - Invasions may escalate across channels, but only through policy.
 *
 * Migration note
 * --------------
 * This file intentionally keeps local compatibility contracts until the final
 * shared contracts lane is established under /shared/contracts/chat.
 *
 * Density6 LLC · Point Zero One · Production-first architecture
 * ============================================================================
 */

import {
  type ChatChannel,
  type ChatInvasionEvent,
  type ChatMessage,
  type ChatModerationEvent,
  type ChatTransportState,
} from './ChatSocketClient';

import {
  type ChatPresenceAudienceMood,
} from './ChatPresenceController';

import {
  ChatPrivacyPolicy,
  type ChatPrivacyDecision,
  type ChatPrivacyAction,
  type ChatPrivacyFinding,
} from './ChatPrivacyPolicy';

export type ChatChannelArchetype =
  | 'SPECTACLE'
  | 'TACTICAL_TRUST'
  | 'NEGOTIATION'
  | 'FOYER';

export type ChatChannelIntent =
  | 'mount'
  | 'read'
  | 'write'
  | 'notify'
  | 'export'
  | 'presence'
  | 'replay'
  | 'invasion'
  | 'bootstrap';

export type ChatChannelReadMode =
  | 'OPEN'
  | 'VISIBLE_LOCKED'
  | 'HIDDEN'
  | 'TRANSCRIPT_ONLY';

export type ChatChannelWriteMode =
  | 'OPEN'
  | 'RATE_LIMITED'
  | 'READ_ONLY'
  | 'LOCKED';

export type ChatChannelVisibilityMode =
  | 'PRIMARY'
  | 'SECONDARY'
  | 'COLLAPSED'
  | 'HIDDEN';

export type ChatChannelNotificationMode =
  | 'FULL'
  | 'TACTICAL'
  | 'QUIET'
  | 'CRITICAL_ONLY'
  | 'OFF';

export type ChatChannelDeliveryIntent =
  | 'broad_cast'
  | 'tactical_signal'
  | 'negotiation_proof'
  | 'foyer_ambient';

export type ChatChannelBannerTone =
  | 'NEUTRAL'
  | 'TACTICAL'
  | 'PREDATORY'
  | 'THEATRICAL'
  | 'SAFE';

export type ChatChannelAccessReason =
  | 'allowed'
  | 'requires_syndicate'
  | 'requires_deal_context'
  | 'mode_hidden'
  | 'moderation_lock'
  | 'transport_degraded'
  | 'privacy_reroute'
  | 'privacy_block'
  | 'not_mounted_here'
  | 'post_run_only'
  | 'pre_run_only'
  | 'invasion_escalation'
  | 'fallback'
  | 'transcript_only'
  | 'manual_override'
  | 'uninitialized';

export type ChatChannelEscalationReason =
  | 'high_pressure'
  | 'critical_pressure'
  | 'negotiation_window'
  | 'syndicate_coordination'
  | 'invasion'
  | 'post_run_debrief'
  | 'privacy_sensitive'
  | 'proof_required'
  | 'moderation';

export type ChatChannelPolicyViolationCode =
  | 'GLOBAL_SENSITIVE_BLOCK'
  | 'GLOBAL_PROOF_HASH_BLOCK'
  | 'SYNDICATE_MEMBERSHIP_REQUIRED'
  | 'DEALROOM_CONTEXT_REQUIRED'
  | 'LOBBY_PHASE_MISMATCH'
  | 'CHANNEL_MODERATION_LOCKED'
  | 'TRANSPORT_READ_ONLY';

export interface ChatModeSnapshot {
  modeId?: string;
  modeFamily?: string;
  screenId?: string;
  runId?: string;
  roomId?: string;
  dealId?: string;
  syndicateId?: string;
  gamePhase?: string;
  isMounted?: boolean;
  isPreRun?: boolean;
  isInRun?: boolean;
  isPostRun?: boolean;
  isMultiplayer?: boolean;
  isNegotiationWindow?: boolean;
  isDealVisible?: boolean;
  isSyndicateVisible?: boolean;
  isLobbyVisible?: boolean;
  allowGlobal?: boolean;
  allowSyndicate?: boolean;
  allowDealRoom?: boolean;
  allowLobby?: boolean;
  pressureTier?: string;
  tickTier?: string;
  runOutcome?: string;
  haterHeat?: number;
  negotiationUrgency?: number;
  metadata?: Record<string, unknown>;
}

export interface ChatChannelCapabilitySet {
  channel: ChatChannel;
  archetype: ChatChannelArchetype;
  readMode: ChatChannelReadMode;
  writeMode: ChatChannelWriteMode;
  visibilityMode: ChatChannelVisibilityMode;
  notificationMode: ChatChannelNotificationMode;
  deliveryIntent: ChatChannelDeliveryIntent;
  audienceMood: ChatPresenceAudienceMood;
  bannerTone: ChatChannelBannerTone;
  reason: ChatChannelAccessReason;
  allowed: boolean;
  mounted: boolean;
  visible: boolean;
  writable: boolean;
  readable: boolean;
  requiresDealId: boolean;
  requiresSyndicateId: boolean;
  prefersCollapsedByDefault: boolean;
  prefersAutoFocusOnEscalation: boolean;
  supportsInvasion: boolean;
  supportsAmbientNpc: boolean;
  supportsProofRecords: boolean;
  suppressBrowserNoise: boolean;
  fallbackChannel: ChatChannel;
  lockCode?: ChatChannelPolicyViolationCode;
  metadata?: Record<string, unknown>;
}

export interface ChatChannelEvaluationInput {
  channel: ChatChannel;
  intent: ChatChannelIntent;
  draftBody?: string;
  message?: ChatMessage;
  privacyDecision?: ChatPrivacyDecision;
  allowFallback?: boolean;
  preferredFallback?: ChatChannel;
  metadata?: Record<string, unknown>;
}

export interface ChatChannelEvaluation {
  channel: ChatChannel;
  intent: ChatChannelIntent;
  allowed: boolean;
  reason: ChatChannelAccessReason;
  readMode: ChatChannelReadMode;
  writeMode: ChatChannelWriteMode;
  visibilityMode: ChatChannelVisibilityMode;
  notificationMode: ChatChannelNotificationMode;
  fallbackChannel: ChatChannel;
  rerouteChannel?: ChatChannel;
  deliveryIntent: ChatChannelDeliveryIntent;
  bannerTone: ChatChannelBannerTone;
  privacyAction?: ChatPrivacyAction;
  privacyFindings?: ChatPrivacyFinding[];
  lockCode?: ChatChannelPolicyViolationCode;
  metadata?: Record<string, unknown>;
}

export interface ChatOutgoingRouteDecision {
  preferredChannel: ChatChannel;
  resolvedChannel: ChatChannel;
  allowed: boolean;
  reason: ChatChannelAccessReason;
  rerouted: boolean;
  shouldWarn: boolean;
  warningTitle?: string;
  warningBody?: string;
  privacyDecision?: ChatPrivacyDecision;
  evaluation: ChatChannelEvaluation;
}

export interface ChatInvasionRouteDecision {
  resolvedChannel: ChatChannel;
  allowed: boolean;
  reason: ChatChannelAccessReason;
  deliveryIntent: ChatChannelDeliveryIntent;
  audienceMood: ChatPresenceAudienceMood;
  bannerTone: ChatChannelBannerTone;
  escalateActiveTab: boolean;
  evaluation: ChatChannelEvaluation;
}

export interface ChatChannelTabView {
  channel: ChatChannel;
  label: string;
  shortLabel: string;
  icon: string;
  visible: boolean;
  mounted: boolean;
  active: boolean;
  visibilityMode: ChatChannelVisibilityMode;
  readMode: ChatChannelReadMode;
  writeMode: ChatChannelWriteMode;
  notificationMode: ChatChannelNotificationMode;
  audienceMood: ChatPresenceAudienceMood;
  bannerTone: ChatChannelBannerTone;
  heat: number;
  unreadHint: boolean;
  lockCode?: ChatChannelPolicyViolationCode;
  reason: ChatChannelAccessReason;
}

export interface ChatChannelPolicySnapshot {
  activeChannel: ChatChannel;
  transportState: ChatTransportState;
  mode: ChatModeSnapshot;
  capabilities: Record<ChatChannel, ChatChannelCapabilitySet>;
  visibleTabs: ChatChannelTabView[];
  escalationHints: ChatChannelEscalationReason[];
  lastEvaluationAt: number | null;
  lastPolicyMutationAt: number | null;
}

export interface ChatChannelPolicyCallbacks {
  onActiveChannelChanged?: (
    next: ChatChannel,
    previous: ChatChannel,
    reason: ChatChannelAccessReason,
  ) => void;
  onSnapshotChanged?: (snapshot: ChatChannelPolicySnapshot) => void;
  onRouteDecision?: (decision: ChatOutgoingRouteDecision) => void;
  onPolicyWarning?: (message: string, context?: Record<string, unknown>) => void;
  onPolicyError?: (error: Error, context?: Record<string, unknown>) => void;
}

export interface ChatChannelPolicyConfig {
  allowLobbyInRun?: boolean;
  allowDealRoomTranscriptOnlyWithoutDealId?: boolean;
  allowSyndicateReadOnlyWithoutMembership?: boolean;
  globalBrowserNoiseCutoffHeat?: number;
  tacticalEscalationHeatThreshold?: number;
  negotiationEscalationUrgencyThreshold?: number;
  pressureEscalationFloor?: string;
  preferDealRoomForProofHashes?: boolean;
  preferSyndicateForSensitiveButNonDealContent?: boolean;
  collapseInactiveChannelsAfterMs?: number;
  hiddenChannelHeatRetentionMs?: number;
  log?: (message: string, context?: Record<string, unknown>) => void;
  warn?: (message: string, context?: Record<string, unknown>) => void;
  error?: (message: string, context?: Record<string, unknown>) => void;
}

export interface ChatChannelPolicyOptions {
  privacyPolicy: ChatPrivacyPolicy;
  initialChannel?: ChatChannel;
  initialMode?: Partial<ChatModeSnapshot>;
  callbacks?: ChatChannelPolicyCallbacks;
  config?: ChatChannelPolicyConfig;
}

interface InternalChannelState {
  capability: ChatChannelCapabilitySet;
  lastInboundAt: number | null;
  lastOutboundAt: number | null;
  lastInvasionAt: number | null;
  lastEscalatedAt: number | null;
  activityHeat: number;
  unreadHint: boolean;
  revision: number;
}

const CHANNELS: ChatChannel[] = ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY'];

const CHANNEL_LABELS: Record<ChatChannel, { label: string; short: string; icon: string }> = {
  GLOBAL: { label: 'Global', short: 'Global', icon: '🌐' },
  SYNDICATE: { label: 'Syndicate', short: 'Syn', icon: '🤝' },
  DEAL_ROOM: { label: 'Deal Room', short: 'Deals', icon: '💼' },
  LOBBY: { label: 'Lobby', short: 'Lobby', icon: '🛋️' },
};

const DEFAULT_MODE: Required<
  Omit<ChatModeSnapshot, 'metadata'>
> = {
  modeId: 'unknown',
  modeFamily: 'unknown',
  screenId: 'unknown',
  runId: '',
  roomId: '',
  dealId: '',
  syndicateId: '',
  gamePhase: 'unknown',
  isMounted: true,
  isPreRun: true,
  isInRun: false,
  isPostRun: false,
  isMultiplayer: false,
  isNegotiationWindow: false,
  isDealVisible: false,
  isSyndicateVisible: true,
  isLobbyVisible: true,
  allowGlobal: true,
  allowSyndicate: true,
  allowDealRoom: false,
  allowLobby: true,
  pressureTier: 'BUILDING',
  tickTier: 'STABLE',
  runOutcome: '',
  haterHeat: 0,
  negotiationUrgency: 0,
};

const DEFAULT_CONFIG: Required<
  Omit<ChatChannelPolicyConfig, 'log' | 'warn' | 'error'>
> = {
  allowLobbyInRun: false,
  allowDealRoomTranscriptOnlyWithoutDealId: true,
  allowSyndicateReadOnlyWithoutMembership: false,
  globalBrowserNoiseCutoffHeat: 55,
  tacticalEscalationHeatThreshold: 65,
  negotiationEscalationUrgencyThreshold: 60,
  pressureEscalationFloor: 'HIGH',
  preferDealRoomForProofHashes: true,
  preferSyndicateForSensitiveButNonDealContent: true,
  collapseInactiveChannelsAfterMs: 180_000,
  hiddenChannelHeatRetentionMs: 420_000,
};

const CHANNEL_BASELINES: Record<ChatChannel, Omit<ChatChannelCapabilitySet, 'reason' | 'allowed' | 'mounted' | 'visible' | 'writable' | 'readable' | 'fallbackChannel' | 'lockCode'>> = {
  GLOBAL: {
    channel: 'GLOBAL',
    archetype: 'SPECTACLE',
    readMode: 'OPEN',
    writeMode: 'OPEN',
    visibilityMode: 'PRIMARY',
    notificationMode: 'FULL',
    deliveryIntent: 'broad_cast',
    audienceMood: 'SWARMING',
    bannerTone: 'THEATRICAL',
    requiresDealId: false,
    requiresSyndicateId: false,
    prefersCollapsedByDefault: false,
    prefersAutoFocusOnEscalation: true,
    supportsInvasion: true,
    supportsAmbientNpc: true,
    supportsProofRecords: false,
    suppressBrowserNoise: false,
  },
  SYNDICATE: {
    channel: 'SYNDICATE',
    archetype: 'TACTICAL_TRUST',
    readMode: 'OPEN',
    writeMode: 'OPEN',
    visibilityMode: 'SECONDARY',
    notificationMode: 'TACTICAL',
    deliveryIntent: 'tactical_signal',
    audienceMood: 'INTIMATE',
    bannerTone: 'TACTICAL',
    requiresDealId: false,
    requiresSyndicateId: true,
    prefersCollapsedByDefault: false,
    prefersAutoFocusOnEscalation: true,
    supportsInvasion: true,
    supportsAmbientNpc: true,
    supportsProofRecords: false,
    suppressBrowserNoise: true,
  },
  DEAL_ROOM: {
    channel: 'DEAL_ROOM',
    archetype: 'NEGOTIATION',
    readMode: 'TRANSCRIPT_ONLY',
    writeMode: 'LOCKED',
    visibilityMode: 'COLLAPSED',
    notificationMode: 'QUIET',
    deliveryIntent: 'negotiation_proof',
    audienceMood: 'PREDATORY',
    bannerTone: 'PREDATORY',
    requiresDealId: true,
    requiresSyndicateId: false,
    prefersCollapsedByDefault: true,
    prefersAutoFocusOnEscalation: true,
    supportsInvasion: true,
    supportsAmbientNpc: false,
    supportsProofRecords: true,
    suppressBrowserNoise: true,
  },
  LOBBY: {
    channel: 'LOBBY',
    archetype: 'FOYER',
    readMode: 'OPEN',
    writeMode: 'OPEN',
    visibilityMode: 'SECONDARY',
    notificationMode: 'QUIET',
    deliveryIntent: 'foyer_ambient',
    audienceMood: 'CALM',
    bannerTone: 'SAFE',
    requiresDealId: false,
    requiresSyndicateId: false,
    prefersCollapsedByDefault: true,
    prefersAutoFocusOnEscalation: false,
    supportsInvasion: false,
    supportsAmbientNpc: true,
    supportsProofRecords: false,
    suppressBrowserNoise: true,
  },
};

function now(): number {
  return Date.now();
}

function clamp(value: number, minValue: number, maxValue: number): number {
  return Math.min(maxValue, Math.max(minValue, value));
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function createError(message: string, cause?: unknown): Error {
  const error = new Error(message);
  if (cause !== undefined) {
    try {
      (error as Error & { cause?: unknown }).cause = cause;
    } catch {
      // ignore cause assignment failures
    }
  }
  return error;
}

function pressureRank(tier?: string): number {
  switch ((tier ?? '').toUpperCase()) {
    case 'CRITICAL': return 5;
    case 'HIGH': return 4;
    case 'ELEVATED': return 3;
    case 'BUILDING': return 2;
    case 'CALM': return 1;
    default: return 0;
  }
}

function computeHeatDecay(lastAt: number | null, retentionMs: number): number {
  if (!lastAt) return 0;
  const age = now() - lastAt;
  if (age <= 0) return 1;
  if (age >= retentionMs) return 0;
  return 1 - age / retentionMs;
}

function defaultFallback(channel: ChatChannel): ChatChannel {
  switch (channel) {
    case 'GLOBAL': return 'LOBBY';
    case 'SYNDICATE': return 'GLOBAL';
    case 'DEAL_ROOM': return 'SYNDICATE';
    case 'LOBBY': return 'GLOBAL';
    default: return 'GLOBAL';
  }
}

function cloneModeSnapshot(mode: ChatModeSnapshot): ChatModeSnapshot {
  return {
    ...mode,
    metadata: mode.metadata ? { ...mode.metadata } : undefined,
  };
}

function cloneCapability(capability: ChatChannelCapabilitySet): ChatChannelCapabilitySet {
  return {
    ...capability,
    metadata: capability.metadata ? { ...capability.metadata } : undefined,
  };
}

function pickBannerTone(channel: ChatChannel, mood: ChatPresenceAudienceMood): ChatChannelBannerTone {
  if (channel === 'DEAL_ROOM' || mood === 'PREDATORY') return 'PREDATORY';
  if (channel === 'SYNDICATE' || mood === 'INTIMATE') return 'TACTICAL';
  if (channel === 'GLOBAL' || mood === 'SWARMING') return 'THEATRICAL';
  return 'SAFE';
}

function computeVisibilityMode(
  channel: ChatChannel,
  mode: ChatModeSnapshot,
  heat: number,
  prefersCollapsed: boolean,
  lastInboundAt: number | null,
  config: typeof DEFAULT_CONFIG,
): ChatChannelVisibilityMode {
  const decayedRecent = computeHeatDecay(lastInboundAt, config.hiddenChannelHeatRetentionMs);
  const boostedHeat = Math.max(heat, decayedRecent * 100);

  if (channel === 'GLOBAL') return 'PRIMARY';
  if (channel === 'SYNDICATE') {
    if (mode.isInRun && boostedHeat >= 70) return 'PRIMARY';
    return 'SECONDARY';
  }
  if (channel === 'DEAL_ROOM') {
    if (mode.isNegotiationWindow || mode.isDealVisible || boostedHeat >= 75) return 'SECONDARY';
    return prefersCollapsed ? 'COLLAPSED' : 'SECONDARY';
  }
  if (channel === 'LOBBY') {
    if (mode.isPreRun || mode.isPostRun) return 'SECONDARY';
    if (mode.isInRun) return prefersCollapsed ? 'COLLAPSED' : 'SECONDARY';
  }
  return 'SECONDARY';
}

function inferEscalationHints(mode: ChatModeSnapshot): ChatChannelEscalationReason[] {
  const hints = new Set<ChatChannelEscalationReason>();
  if (pressureRank(mode.pressureTier) >= pressureRank('HIGH')) hints.add('high_pressure');
  if (pressureRank(mode.pressureTier) >= pressureRank('CRITICAL')) hints.add('critical_pressure');
  if ((mode.negotiationUrgency ?? 0) >= 60 || mode.isNegotiationWindow) hints.add('negotiation_window');
  if ((mode.haterHeat ?? 0) >= 70 && mode.syndicateId) hints.add('syndicate_coordination');
  if (mode.isPostRun) hints.add('post_run_debrief');
  return [...hints.values()];
}

function hasProofHash(message?: ChatMessage): boolean {
  return Boolean(message?.proofHash && normalizeText(message.proofHash).length > 0);
}

function containsDealRecap(message?: ChatMessage): boolean {
  return message?.kind === 'DEAL_ROOM';
}

export class ChatChannelPolicy {
  private readonly privacyPolicy: ChatPrivacyPolicy;
  private readonly callbacks: ChatChannelPolicyCallbacks;
  private readonly config: ChatChannelPolicyConfig & typeof DEFAULT_CONFIG;
  private readonly log?: (message: string, context?: Record<string, unknown>) => void;
  private readonly warn?: (message: string, context?: Record<string, unknown>) => void;
  private readonly error?: (message: string, context?: Record<string, unknown>) => void;

  private readonly states = new Map<ChatChannel, InternalChannelState>();
  private readonly moderationLocks = new Map<ChatChannel, ChatModerationEvent>();

  private activeChannel: ChatChannel;
  private transportState: ChatTransportState = 'DISCONNECTED';
  private mode: ChatModeSnapshot;
  private lastEvaluationAt: number | null = null;
  private lastPolicyMutationAt: number | null = null;
  private destroyed = false;

  public constructor(options: ChatChannelPolicyOptions) {
    this.privacyPolicy = options.privacyPolicy;
    this.callbacks = options.callbacks ?? {};
    this.config = {
      ...DEFAULT_CONFIG,
      ...(options.config ?? {}),
    };
    this.log = options.config?.log;
    this.warn = options.config?.warn;
    this.error = options.config?.error;

    this.mode = {
      ...DEFAULT_MODE,
      ...(options.initialMode ?? {}),
      metadata: options.initialMode?.metadata ? { ...options.initialMode.metadata } : undefined,
    };

    this.activeChannel = options.initialChannel ?? this.chooseBootChannel();

    for (const channel of CHANNELS) {
      this.states.set(channel, {
        capability: this.createCapability(channel),
        lastInboundAt: null,
        lastOutboundAt: null,
        lastInvasionAt: null,
        lastEscalatedAt: null,
        activityHeat: 0,
        unreadHint: false,
        revision: 0,
      });
    }

    this.recomputeAll('manual_override');
  }

  // ---------------------------------------------------------------------------
  // Public lifecycle
  // ---------------------------------------------------------------------------

  public destroy(): void {
    this.destroyed = true;
    this.states.clear();
    this.moderationLocks.clear();
  }

  public getSnapshot(): ChatChannelPolicySnapshot {
    this.assertNotDestroyed('getSnapshot');

    const capabilities = {} as Record<ChatChannel, ChatChannelCapabilitySet>;
    for (const channel of CHANNELS) {
      capabilities[channel] = cloneCapability(this.requireState(channel).capability);
    }

    return {
      activeChannel: this.activeChannel,
      transportState: this.transportState,
      mode: cloneModeSnapshot(this.mode),
      capabilities,
      visibleTabs: this.getVisibleTabs(),
      escalationHints: inferEscalationHints(this.mode),
      lastEvaluationAt: this.lastEvaluationAt,
      lastPolicyMutationAt: this.lastPolicyMutationAt,
    };
  }

  // ---------------------------------------------------------------------------
  // Public state entrypoints
  // ---------------------------------------------------------------------------

  public updateModeSnapshot(next: Partial<ChatModeSnapshot>): void {
    this.assertNotDestroyed('updateModeSnapshot');

    this.mode = {
      ...this.mode,
      ...next,
      metadata: next.metadata
        ? { ...(this.mode.metadata ?? {}), ...next.metadata }
        : this.mode.metadata ? { ...this.mode.metadata } : undefined,
    };

    this.recomputeAll('manual_override');
  }

  public setTransportState(next: ChatTransportState): void {
    this.assertNotDestroyed('setTransportState');

    if (this.transportState === next) return;
    this.transportState = next;
    this.recomputeAll(next === 'CONNECTED' ? 'allowed' : 'transport_degraded');
  }

  public setActiveChannel(
    channel: ChatChannel,
    reason: ChatChannelAccessReason = 'manual_override',
  ): ChatChannel {
    this.assertNotDestroyed('setActiveChannel');

    const evaluation = this.evaluateChannel({ channel, intent: 'read', allowFallback: true });
    const resolved = evaluation.allowed ? channel : (evaluation.rerouteChannel ?? evaluation.fallbackChannel);
    const previous = this.activeChannel;

    this.activeChannel = resolved;
    this.requireState(resolved).unreadHint = false;
    this.lastPolicyMutationAt = now();
    this.emitSnapshot();

    if (resolved !== previous) {
      this.callbacks.onActiveChannelChanged?.(resolved, previous, reason);
    }

    return resolved;
  }

  public noteModeration(event: ChatModerationEvent): void {
    this.assertNotDestroyed('noteModeration');

    if (!event.channel) return;

    switch (event.code) {
      case 'CHANNEL_LOCKED':
        this.moderationLocks.set(event.channel, event);
        break;
      case 'CHANNEL_UNLOCKED':
        this.moderationLocks.delete(event.channel);
        break;
      default:
        if (event.code === 'MUTED') {
          this.moderationLocks.set(event.channel, event);
        }
        if (event.code === 'UNMUTED') {
          this.moderationLocks.delete(event.channel);
        }
        break;
    }

    this.recomputeAll('moderation_lock');
  }

  public noteInboundMessage(message: ChatMessage): void {
    this.assertNotDestroyed('noteInboundMessage');

    const state = this.requireState(message.channel);
    state.lastInboundAt = message.ts || now();
    state.activityHeat = clamp(state.activityHeat + this.deriveMessageHeat(message), 0, 100);
    if (message.channel !== this.activeChannel) {
      state.unreadHint = true;
    }

    if (hasProofHash(message) || containsDealRecap(message)) {
      this.requireState('DEAL_ROOM').activityHeat = clamp(
        this.requireState('DEAL_ROOM').activityHeat + 14,
        0,
        100,
      );
    }

    this.recomputeAll('allowed');
  }

  public noteOutboundMessage(message: ChatMessage): void {
    this.assertNotDestroyed('noteOutboundMessage');

    const state = this.requireState(message.channel);
    state.lastOutboundAt = message.ts || now();
    state.activityHeat = clamp(state.activityHeat + 6, 0, 100);
    state.unreadHint = false;
    this.recomputeAll('allowed');
  }

  public noteInvasion(event: ChatInvasionEvent): void {
    this.assertNotDestroyed('noteInvasion');

    const state = this.requireState(event.channel);
    state.lastInvasionAt = event.ts || now();
    state.lastEscalatedAt = now();
    state.activityHeat = clamp(
      state.activityHeat + this.deriveInvasionHeat(event),
      0,
      100,
    );
    state.unreadHint = event.channel !== this.activeChannel;
    this.recomputeAll('invasion_escalation');
  }

  public noteReplayHydrated(channel: ChatChannel, messageCount: number): void {
    this.assertNotDestroyed('noteReplayHydrated');

    const state = this.requireState(channel);
    state.activityHeat = clamp(state.activityHeat + Math.min(18, messageCount / 3), 0, 100);
    this.recomputeAll('allowed');
  }

  public markChannelSeen(channel: ChatChannel): void {
    this.assertNotDestroyed('markChannelSeen');
    this.requireState(channel).unreadHint = false;
    this.emitSnapshot();
  }

  // ---------------------------------------------------------------------------
  // Public evaluation surface
  // ---------------------------------------------------------------------------

  public evaluateChannel(input: ChatChannelEvaluationInput): ChatChannelEvaluation {
    this.assertNotDestroyed('evaluateChannel');

    const capability = this.requireState(input.channel).capability;
    const privacyDecision = input.privacyDecision
      ?? (input.draftBody !== undefined
        ? this.privacyPolicy.inspectOutboundDraft({
            channel: input.channel,
            body: input.draftBody,
            actorClass: 'PLAYER',
          })
        : undefined);

    const evaluation = this.buildEvaluation(capability, input, privacyDecision);
    this.lastEvaluationAt = now();
    return evaluation;
  }

  public evaluateOutgoingDraft(input: {
    preferredChannel: ChatChannel;
    body: string;
    metadata?: Record<string, unknown>;
  }): ChatOutgoingRouteDecision {
    this.assertNotDestroyed('evaluateOutgoingDraft');

    const normalizedBody = normalizeText(input.body);
    const privacyDecision = this.privacyPolicy.inspectOutboundDraft({
      channel: input.preferredChannel,
      body: normalizedBody,
      actorClass: 'PLAYER',
          });

    const direct = this.evaluateChannel({
      channel: input.preferredChannel,
      intent: 'write',
      draftBody: normalizedBody,
      privacyDecision,
      allowFallback: true,
      metadata: input.metadata,
    });

    const resolvedChannel = direct.rerouteChannel ?? direct.fallbackChannel;
    const allowed = direct.allowed || Boolean(direct.rerouteChannel && resolvedChannel);

    const shouldWarn =
      !direct.allowed ||
      Boolean(direct.rerouteChannel) ||
      privacyDecision.action === 'WARN' ||
      privacyDecision.action === 'REDACT';

    const decision: ChatOutgoingRouteDecision = {
      preferredChannel: input.preferredChannel,
      resolvedChannel: allowed ? resolvedChannel : input.preferredChannel,
      allowed,
      reason: direct.reason,
      rerouted: Boolean(direct.rerouteChannel && direct.rerouteChannel !== input.preferredChannel),
      shouldWarn,
      warningTitle: shouldWarn ? this.buildWarningTitle(direct, privacyDecision) : undefined,
      warningBody: shouldWarn ? this.buildWarningBody(direct, privacyDecision) : undefined,
      privacyDecision,
      evaluation: direct,
    };

    this.callbacks.onRouteDecision?.(decision);
    return decision;
  }

  public evaluateInvasionRoute(input: {
    preferredChannels?: ChatChannel[];
    severity?: ChatInvasionEvent['severity'];
    metadata?: Record<string, unknown>;
  }): ChatInvasionRouteDecision {
    this.assertNotDestroyed('evaluateInvasionRoute');

    const order = input.preferredChannels && input.preferredChannels.length > 0
      ? dedupeChannels(input.preferredChannels)
      : this.rankInvasionChannels(input.severity);

    let chosen = this.evaluateChannel({
      channel: order[0],
      intent: 'invasion',
      allowFallback: true,
      metadata: input.metadata,
    });

    for (const channel of order) {
      const candidate = this.evaluateChannel({
        channel,
        intent: 'invasion',
        allowFallback: true,
        metadata: input.metadata,
      });
      if (candidate.allowed) {
        chosen = candidate;
        break;
      }
      if (!chosen.allowed && candidate.visibilityMode !== 'HIDDEN') {
        chosen = candidate;
      }
    }

    const capability = this.requireState(chosen.channel).capability;
    return {
      resolvedChannel: chosen.allowed
        ? chosen.channel
        : (chosen.rerouteChannel ?? chosen.fallbackChannel),
      allowed: chosen.allowed || Boolean(chosen.rerouteChannel),
      reason: chosen.reason,
      deliveryIntent: chosen.deliveryIntent,
      audienceMood: capability.audienceMood,
      bannerTone: chosen.bannerTone,
      escalateActiveTab: capability.prefersAutoFocusOnEscalation,
      evaluation: chosen,
    };
  }

  public chooseBootChannel(preferred?: ChatChannel): ChatChannel {
    const candidates = dedupeChannels([
      preferred,
      this.mode.isPreRun ? 'LOBBY' : undefined,
      this.mode.isNegotiationWindow ? 'DEAL_ROOM' : undefined,
      this.mode.syndicateId ? 'SYNDICATE' : undefined,
      'GLOBAL',
      'LOBBY',
      'SYNDICATE',
      'DEAL_ROOM',
    ].filter(Boolean) as ChatChannel[]);

    for (const channel of candidates) {
      const evaluation = this.evaluateChannel({ channel, intent: 'bootstrap', allowFallback: true });
      if (evaluation.allowed) return channel;
    }

    return 'GLOBAL';
  }

  public getVisibleTabs(): ChatChannelTabView[] {
    this.assertNotDestroyed('getVisibleTabs');

    const tabs: ChatChannelTabView[] = [];
    for (const channel of CHANNELS) {
      const state = this.requireState(channel);
      const meta = CHANNEL_LABELS[channel];
      const cap = state.capability;
      const hidden = cap.visibilityMode === 'HIDDEN' || !cap.visible;
      if (hidden) continue;

      tabs.push({
        channel,
        label: meta.label,
        shortLabel: meta.short,
        icon: meta.icon,
        visible: cap.visible,
        mounted: cap.mounted,
        active: channel === this.activeChannel,
        visibilityMode: cap.visibilityMode,
        readMode: cap.readMode,
        writeMode: cap.writeMode,
        notificationMode: cap.notificationMode,
        audienceMood: cap.audienceMood,
        bannerTone: cap.bannerTone,
        heat: Math.round(state.activityHeat),
        unreadHint: state.unreadHint,
        lockCode: cap.lockCode,
        reason: cap.reason,
      });
    }

    tabs.sort((a, b) => compareTabPriority(a, b));
    return tabs;
  }

  // ---------------------------------------------------------------------------
  // Private recompute / evaluation
  // ---------------------------------------------------------------------------

  private recomputeAll(reason: ChatChannelAccessReason): void {
    for (const channel of CHANNELS) {
      const state = this.requireState(channel);
      state.capability = this.createCapability(channel);
      state.revision += 1;
    }

    const activeEval = this.evaluateChannel({
      channel: this.activeChannel,
      intent: 'read',
      allowFallback: true,
    });

    if (!activeEval.allowed) {
      this.activeChannel = activeEval.rerouteChannel ?? activeEval.fallbackChannel;
    }

    this.lastPolicyMutationAt = now();
    this.emitSnapshot();

    if (reason !== 'allowed' && reason !== 'manual_override') {
      this.log?.('ChatChannelPolicy recomputed.', {
        reason,
        activeChannel: this.activeChannel,
      });
    }
  }

  private createCapability(channel: ChatChannel): ChatChannelCapabilitySet {
    const base = CHANNEL_BASELINES[channel];
    const state = this.states.get(channel);
    const lastInboundAt = state?.lastInboundAt ?? null;
    const heat = this.deriveChannelHeat(channel);
    const moderationLock = this.moderationLocks.get(channel);

    let reason: ChatChannelAccessReason = 'allowed';
    let readMode = base.readMode;
    let writeMode = base.writeMode;
    let visibilityMode = computeVisibilityMode(
      channel,
      this.mode,
      heat,
      base.prefersCollapsedByDefault,
      lastInboundAt,
      DEFAULT_CONFIG,
    );
    let notificationMode = base.notificationMode;
    let mounted = Boolean(this.mode.isMounted);
    let supportsAmbientNpc = base.supportsAmbientNpc;
    let allowed = true;
    let lockCode: ChatChannelPolicyViolationCode | undefined;

    if (!mounted) {
      allowed = false;
      reason = 'not_mounted_here';
      visibilityMode = 'HIDDEN';
      readMode = 'HIDDEN';
      writeMode = 'LOCKED';
      notificationMode = 'OFF';
    }

    if (moderationLock) {
      allowed = false;
      reason = 'moderation_lock';
      writeMode = 'LOCKED';
      lockCode = 'CHANNEL_MODERATION_LOCKED';
    }

    if (this.transportState === 'DISCONNECTED' || this.transportState === 'DEGRADED') {
      if (channel === 'DEAL_ROOM' || channel === 'SYNDICATE') {
        if (writeMode === 'OPEN') writeMode = 'READ_ONLY';
        if (allowed && reason === 'allowed') reason = 'transport_degraded';
        if (!moderationLock) lockCode = 'TRANSPORT_READ_ONLY';
      }
    }

    switch (channel) {
      case 'GLOBAL': {
        if (this.mode.allowGlobal === false) {
          allowed = false;
          reason = 'mode_hidden';
          readMode = 'HIDDEN';
          writeMode = 'LOCKED';
          visibilityMode = 'HIDDEN';
        }
        if (heat >= this.config.globalBrowserNoiseCutoffHeat) {
          notificationMode = 'TACTICAL';
        }
        break;
      }

      case 'SYNDICATE': {
        const hasSyndicate = Boolean(normalizeText(this.mode.syndicateId ?? '').length > 0);
        const visibleByMode = this.mode.allowSyndicate !== false && this.mode.isSyndicateVisible !== false;

        if (!visibleByMode) {
          allowed = false;
          reason = 'mode_hidden';
          readMode = 'HIDDEN';
          writeMode = 'LOCKED';
          visibilityMode = 'HIDDEN';
        } else if (!hasSyndicate) {
          allowed = false;
          reason = 'requires_syndicate';
          lockCode = 'SYNDICATE_MEMBERSHIP_REQUIRED';
          if (this.config.allowSyndicateReadOnlyWithoutMembership) {
            readMode = 'VISIBLE_LOCKED';
            writeMode = 'LOCKED';
            visibilityMode = 'COLLAPSED';
          } else {
            readMode = 'HIDDEN';
            writeMode = 'LOCKED';
            visibilityMode = 'HIDDEN';
          }
        } else {
          readMode = 'OPEN';
          writeMode = 'OPEN';
          visibilityMode = visibilityMode === 'COLLAPSED' ? 'SECONDARY' : visibilityMode;
        }
        break;
      }

      case 'DEAL_ROOM': {
        const hasDealId = Boolean(normalizeText(this.mode.dealId ?? '').length > 0);
        const visibleByMode = this.mode.allowDealRoom === true || this.mode.isDealVisible === true || hasDealId || this.mode.isNegotiationWindow === true;

        if (!visibleByMode) {
          allowed = false;
          reason = 'mode_hidden';
          readMode = 'HIDDEN';
          writeMode = 'LOCKED';
          visibilityMode = 'HIDDEN';
        } else if (!hasDealId) {
          allowed = false;
          reason = 'requires_deal_context';
          lockCode = 'DEALROOM_CONTEXT_REQUIRED';
          if (this.config.allowDealRoomTranscriptOnlyWithoutDealId) {
            readMode = 'TRANSCRIPT_ONLY';
            writeMode = 'LOCKED';
            visibilityMode = 'COLLAPSED';
          } else {
            readMode = 'HIDDEN';
            writeMode = 'LOCKED';
            visibilityMode = 'HIDDEN';
          }
        } else {
          readMode = 'OPEN';
          writeMode = 'OPEN';
          visibilityMode = visibilityMode === 'HIDDEN' ? 'COLLAPSED' : visibilityMode;
        }
        notificationMode = this.mode.isNegotiationWindow ? 'TACTICAL' : 'QUIET';
        supportsAmbientNpc = false;
        break;
      }

      case 'LOBBY': {
        const visibleByMode = this.mode.allowLobby !== false && this.mode.isLobbyVisible !== false;
        const allowInRun = this.config.allowLobbyInRun;
        if (!visibleByMode) {
          allowed = false;
          reason = 'mode_hidden';
          readMode = 'HIDDEN';
          writeMode = 'LOCKED';
          visibilityMode = 'HIDDEN';
        } else if (this.mode.isInRun && !allowInRun) {
          allowed = false;
          reason = 'post_run_only';
          readMode = 'VISIBLE_LOCKED';
          writeMode = 'LOCKED';
          visibilityMode = 'COLLAPSED';
          lockCode = 'LOBBY_PHASE_MISMATCH';
        } else {
          readMode = 'OPEN';
          writeMode = 'OPEN';
        }
        break;
      }
    }

    const visible = visibilityMode !== 'HIDDEN' && readMode !== 'HIDDEN';
    const readable = readMode === 'OPEN' || readMode === 'VISIBLE_LOCKED' || readMode === 'TRANSCRIPT_ONLY';
    const writable = writeMode === 'OPEN' || writeMode === 'RATE_LIMITED';

    return {
      ...base,
      readMode,
      writeMode,
      visibilityMode,
      notificationMode,
      audienceMood: this.deriveAudienceMood(channel),
      bannerTone: pickBannerTone(channel, this.deriveAudienceMood(channel)),
      reason,
      allowed,
      mounted,
      visible,
      writable,
      readable,
      supportsAmbientNpc,
      fallbackChannel: defaultFallback(channel),
      lockCode,
      metadata: {
        heat,
        lastInboundAt,
        lastOutboundAt: state?.lastOutboundAt ?? null,
        lastInvasionAt: state?.lastInvasionAt ?? null,
      },
    };
  }

  private buildEvaluation(
    capability: ChatChannelCapabilitySet,
    input: ChatChannelEvaluationInput,
    privacyDecision?: ChatPrivacyDecision,
  ): ChatChannelEvaluation {
    let allowed = capability.allowed;
    let reason = capability.reason;
    let rerouteChannel: ChatChannel | undefined;
    let lockCode = capability.lockCode;

    if (input.intent === 'write') {
      if (!capability.writable) {
        allowed = false;
        reason = capability.reason === 'allowed' ? 'fallback' : capability.reason;
      }

      if (privacyDecision) {
        const reroute = this.resolvePrivacyReroute(input.channel, privacyDecision, input.message);
        if (privacyDecision.action === 'BLOCK' && !reroute) {
          allowed = false;
          reason = 'privacy_block';
          lockCode = this.privacyLockCode(input.channel, privacyDecision);
        } else if (reroute && reroute !== input.channel) {
          rerouteChannel = reroute;
          allowed = false;
          reason = 'privacy_reroute';
        }
      }
    }

    if (input.intent === 'notify' && capability.notificationMode === 'OFF') {
      allowed = false;
      reason = capability.reason === 'allowed' ? 'mode_hidden' : capability.reason;
    }

    if (input.intent === 'invasion' && !capability.supportsInvasion) {
      allowed = false;
      reason = capability.reason === 'allowed' ? 'fallback' : capability.reason;
    }

    if (input.intent === 'export' && capability.channel === 'GLOBAL' && hasProofHash(input.message)) {
      allowed = false;
      reason = 'privacy_reroute';
      rerouteChannel = 'DEAL_ROOM';
      lockCode = 'GLOBAL_PROOF_HASH_BLOCK';
    }

    if (input.message && containsDealRecap(input.message) && capability.channel !== 'DEAL_ROOM') {
      allowed = false;
      reason = 'privacy_reroute';
      rerouteChannel = 'DEAL_ROOM';
      lockCode = 'GLOBAL_PROOF_HASH_BLOCK';
    }

    return {
      channel: capability.channel,
      intent: input.intent,
      allowed,
      reason,
      readMode: capability.readMode,
      writeMode: capability.writeMode,
      visibilityMode: capability.visibilityMode,
      notificationMode: capability.notificationMode,
      fallbackChannel: capability.fallbackChannel,
      rerouteChannel,
      deliveryIntent: capability.deliveryIntent,
      bannerTone: capability.bannerTone,
      privacyAction: privacyDecision?.action,
      privacyFindings: privacyDecision?.findings,
      lockCode,
      metadata: input.metadata,
    };
  }

  private resolvePrivacyReroute(
    channel: ChatChannel,
    decision: ChatPrivacyDecision,
    message?: ChatMessage,
  ): ChatChannel | undefined {
    if (decision.action === 'ALLOW') return undefined;

    const hasProof = decision.findings.some((finding) => finding.kind === 'PROOF_HASH') || hasProofHash(message);
    const hasTransaction = decision.findings.some((finding) =>
      finding.kind === 'BANK_ACCOUNT' ||
      finding.kind === 'CREDIT_CARD' ||
      finding.kind === 'ROUTING_NUMBER' ||
      finding.kind === 'TAX_IDENTIFIER' ||
      finding.kind === 'ADDRESS',
    );

    if ((hasProof || hasTransaction) && this.config.preferDealRoomForProofHashes) {
      const dealEval = this.evaluateChannel({
        channel: 'DEAL_ROOM',
        intent: 'write',
        allowFallback: false,
      });
      if (dealEval.allowed || dealEval.readMode === 'TRANSCRIPT_ONLY') return 'DEAL_ROOM';
    }

    if (
      this.config.preferSyndicateForSensitiveButNonDealContent &&
      channel === 'GLOBAL' &&
      decision.findings.length > 0
    ) {
      const synEval = this.evaluateChannel({ channel: 'SYNDICATE', intent: 'write', allowFallback: false });
      if (synEval.allowed) return 'SYNDICATE';
    }

    return undefined;
  }

  private privacyLockCode(
    channel: ChatChannel,
    decision: ChatPrivacyDecision,
  ): ChatChannelPolicyViolationCode | undefined {
    const hasProof = decision.findings.some((finding) => finding.kind === 'PROOF_HASH');
    if (channel === 'GLOBAL' && hasProof) return 'GLOBAL_PROOF_HASH_BLOCK';
    if (channel === 'GLOBAL') return 'GLOBAL_SENSITIVE_BLOCK';
    if (channel === 'SYNDICATE') return 'SYNDICATE_MEMBERSHIP_REQUIRED';
    if (channel === 'DEAL_ROOM') return 'DEALROOM_CONTEXT_REQUIRED';
    return undefined;
  }

  private buildWarningTitle(
    evaluation: ChatChannelEvaluation,
    privacyDecision: ChatPrivacyDecision,
  ): string {
    if (evaluation.reason === 'privacy_block') return 'Channel blocked';
    if (evaluation.reason === 'privacy_reroute') return 'Channel reroute suggested';
    if (evaluation.reason === 'requires_deal_context') return 'Deal Room locked';
    if (evaluation.reason === 'requires_syndicate') return 'Syndicate required';
    if (privacyDecision.action === 'WARN') return 'Sensitive content detected';
    return 'Channel policy notice';
  }

  private buildWarningBody(
    evaluation: ChatChannelEvaluation,
    privacyDecision: ChatPrivacyDecision,
  ): string {
    if (evaluation.reason === 'privacy_block') {
      return 'This message includes sensitive or proof-bearing content that should not leave through the selected channel.';
    }
    if (evaluation.reason === 'privacy_reroute' && evaluation.rerouteChannel) {
      return `This draft belongs in ${humanChannel(evaluation.rerouteChannel)} based on privacy and proof policy.`;
    }
    if (evaluation.reason === 'requires_deal_context') {
      return 'Deal Room is only writable when a negotiation context or proof-bearing deal context exists.';
    }
    if (evaluation.reason === 'requires_syndicate') {
      return 'Syndicate chat is only writable for players currently inside a syndicate context.';
    }
    if (privacyDecision.action === 'WARN') {
      return 'Review this message before sending. The selected channel may be too broad for its content.';
    }
    return 'Channel access changed due to current mode, transport state, or policy.';
  }

  private deriveChannelHeat(channel: ChatChannel): number {
    const state = this.states.get(channel);
    if (!state) return 0;

    const inbound = computeHeatDecay(state.lastInboundAt, this.config.hiddenChannelHeatRetentionMs) * 42;
    const outbound = computeHeatDecay(state.lastOutboundAt, this.config.hiddenChannelHeatRetentionMs) * 18;
    const invasion = computeHeatDecay(state.lastInvasionAt, this.config.hiddenChannelHeatRetentionMs) * 55;
    const retained = state.activityHeat * 0.62;
    const pressureBoost = channel === 'GLOBAL'
      ? Math.max(0, pressureRank(this.mode.pressureTier) - 2) * 8
      : channel === 'SYNDICATE'
        ? clamp((this.mode.haterHeat ?? 0) / 8, 0, 12)
        : channel === 'DEAL_ROOM'
          ? clamp((this.mode.negotiationUrgency ?? 0) / 7, 0, 16)
          : this.mode.isPreRun || this.mode.isPostRun ? 10 : 0;

    return clamp(inbound + outbound + invasion + retained + pressureBoost, 0, 100);
  }

  private deriveAudienceMood(channel: ChatChannel): ChatPresenceAudienceMood {
    if (channel === 'DEAL_ROOM') return 'PREDATORY';
    if (channel === 'SYNDICATE') return 'INTIMATE';
    if (channel === 'LOBBY') {
      if (this.mode.isPostRun) return 'WATCHFUL';
      return 'CALM';
    }

    if (pressureRank(this.mode.pressureTier) >= pressureRank('HIGH')) return 'TENSE';
    return 'SWARMING';
  }

  private deriveMessageHeat(message: ChatMessage): number {
    let score = 8;
    if (message.kind === 'BOT_ATTACK') score += 16;
    if (message.kind === 'MARKET_ALERT') score += 10;
    if (message.kind === 'SHIELD_EVENT') score += 11;
    if (message.kind === 'CASCADE_ALERT') score += 14;
    if (message.kind === 'DEAL_ROOM') score += 18;
    if (message.kind === 'SYSTEM') score += 4;
    if (message.immutable) score += 6;
    if (hasProofHash(message)) score += 8;
    if ((message.pressureTier ?? '').toUpperCase() === 'CRITICAL') score += 10;
    if ((message.tickTier ?? '').toUpperCase() === 'CRISIS') score += 6;
    return clamp(score, 1, 28);
  }

  private deriveInvasionHeat(event: ChatInvasionEvent): number {
    switch (event.severity) {
      case 'CRITICAL': return 28;
      case 'HIGH': return 22;
      case 'MEDIUM': return 16;
      default: return 10;
    }
  }

  private rankInvasionChannels(severity?: ChatInvasionEvent['severity']): ChatChannel[] {
    if (severity === 'CRITICAL') {
      return ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY'];
    }
    if (this.mode.isNegotiationWindow || (this.mode.negotiationUrgency ?? 0) >= this.config.negotiationEscalationUrgencyThreshold) {
      return ['DEAL_ROOM', 'SYNDICATE', 'GLOBAL', 'LOBBY'];
    }
    if ((this.mode.haterHeat ?? 0) >= this.config.tacticalEscalationHeatThreshold && this.mode.syndicateId) {
      return ['SYNDICATE', 'GLOBAL', 'DEAL_ROOM', 'LOBBY'];
    }
    return ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY'];
  }

  private requireState(channel: ChatChannel): InternalChannelState {
    const state = this.states.get(channel);
    if (!state) throw createError(`Unknown channel: ${channel}`);
    return state;
  }

  private emitSnapshot(): void {
    this.callbacks.onSnapshotChanged?.(this.getSnapshot());
  }

  private assertNotDestroyed(operation: string): void {
    if (this.destroyed) {
      throw createError(`ChatChannelPolicy.${operation} called after destroy().`);
    }
  }
}

function dedupeChannels(channels: ChatChannel[]): ChatChannel[] {
  const out: ChatChannel[] = [];
  const seen = new Set<ChatChannel>();
  for (const channel of channels) {
    if (seen.has(channel)) continue;
    seen.add(channel);
    out.push(channel);
  }
  return out;
}

function compareTabPriority(a: ChatChannelTabView, b: ChatChannelTabView): number {
  const weight = (tab: ChatChannelTabView): number => {
    let score = 0;
    if (tab.active) score += 1000;
    if (tab.visibilityMode === 'PRIMARY') score += 500;
    if (tab.unreadHint) score += 120;
    score += Math.round(tab.heat);
    switch (tab.channel) {
      case 'GLOBAL': score += 50; break;
      case 'SYNDICATE': score += 40; break;
      case 'DEAL_ROOM': score += 30; break;
      case 'LOBBY': score += 20; break;
    }
    return score;
  };

  return weight(b) - weight(a);
}

function humanChannel(channel: ChatChannel): string {
  switch (channel) {
    case 'GLOBAL': return 'Global';
    case 'SYNDICATE': return 'Syndicate';
    case 'DEAL_ROOM': return 'Deal Room';
    case 'LOBBY': return 'Lobby';
    default: return channel;
  }
}

export function createChatChannelPolicy(
  options: ChatChannelPolicyOptions,
): ChatChannelPolicy {
  return new ChatChannelPolicy(options);
}
