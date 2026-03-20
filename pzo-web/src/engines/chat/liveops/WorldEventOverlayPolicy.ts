/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT LIVEOPS WORLD EVENT OVERLAY POLICY
 * FILE: pzo-web/src/engines/chat/liveops/WorldEventOverlayPolicy.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Pure projection policy that converts liveops runtime state into mount-safe
 * overlay models for chat-adjacent UI surfaces.
 *
 * This file does not own transcript truth, world-event scheduling, or replay
 * persistence. It owns presentation policy only:
 * - which event deserves the top overlay right now,
 * - how much detail should be shown,
 * - which surfaces should light up,
 * - when pressure should stay shadow-only,
 * - and how severe world pressure should be framed for the player.
 *
 * Design laws
 * -----------
 * 1. Projection logic must be pure and deterministic.
 * 2. Overlay selection must be stable under equal-priority ties.
 * 3. Public overlays and shadow overlays are related but never conflated.
 * 4. High drama should be visible fast, but not every event deserves a banner.
 * 5. Helper-blackout and whisper-only events must preserve intentional silence.
 * 6. Overlay outputs are mount-safe read models, not transport envelopes.
 * 7. Repo authority stays with shared contracts + engine runtime layers.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import type {
  ChatBridgeChannel,
  ChatBridgeMountTarget,
  ChatBridgeRuntimeSnapshot,
  ChatBridgeSeverity,
} from '../ChatEventBridge';
import type { ChatChannelId } from '../../../../../shared/contracts/chat/ChatChannels';
import type { ChatLiveOpsSummary } from '../../../../../shared/contracts/chat/ChatLiveOps';
import type {
  ChatWorldEventAnnouncementMode,
  ChatWorldEventPressureBand,
  ChatWorldEventVisibilityMode,
} from '../../../../../shared/contracts/chat/ChatWorldEvent';
import { CHAT_WORLD_EVENT_REGISTRY_MANIFEST } from '../../../../../shared/contracts/chat/ChatWorldEvent';
import type {
  SeasonalChatEventDirectorSnapshot,
  SeasonalChatEventRuntimeState,
} from './SeasonalChatEventDirector';

export type LiveOpsOverlayTone =
  | 'CEREMONIAL'
  | 'ALARM'
  | 'PREDATORY'
  | 'WHISPER'
  | 'DEBATE'
  | 'SURGE'
  | 'SUPPRESSED';

export interface ChatWorldEventOverlayCard {
  readonly overlayId: string;
  readonly eventId: string;
  readonly headline: string;
  readonly body: string;
  readonly detailLines: readonly string[];
  readonly severity: ChatBridgeSeverity;
  readonly tone: LiveOpsOverlayTone;
  readonly visibilityMode: ChatWorldEventVisibilityMode;
  readonly pressureBand: ChatWorldEventPressureBand;
  readonly announcementMode: ChatWorldEventAnnouncementMode;
  readonly mounts: readonly ChatBridgeMountTarget[];
  readonly visibleChannels: readonly ChatChannelId[];
  readonly shadowChannels: readonly ChatChannelId[];
  readonly sticky: boolean;
  readonly dismissible: boolean;
  readonly shouldPulse: boolean;
  readonly helperSuppressed: boolean;
  readonly whisperOnly: boolean;
  readonly crowdHeatScore: number;
  readonly priorityScore: number;
  readonly activatedAt: number;
  readonly deactivatesAt: number;
}

export interface ChatWorldEventOverlayStack {
  readonly primary: ChatWorldEventOverlayCard | null;
  readonly secondary: readonly ChatWorldEventOverlayCard[];
  readonly shadow: readonly ChatWorldEventOverlayCard[];
  readonly quietWorld: boolean;
  readonly helperBlackoutActive: boolean;
}

export interface WorldEventOverlayPolicyOptions {
  readonly maxSecondaryCards?: number;
  readonly maxShadowCards?: number;
  readonly showWarmupCards?: boolean;
  readonly preferCeremonialForLegendCharge?: boolean;
}

const DEFAULT_OPTIONS: Required<WorldEventOverlayPolicyOptions> = {
  maxSecondaryCards: 3,
  maxShadowCards: 3,
  showWarmupCards: true,
  preferCeremonialForLegendCharge: true,
};

function clamp01(value: number): number {
  if (Number.isNaN(value) || value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

function normalizeSeverity(priority: number): ChatBridgeSeverity {
  if (priority >= 0.85) {
    return 'CRITICAL';
  }
  if (priority >= 0.55) {
    return 'WARNING';
  }
  if (priority <= 0.20) {
    return 'SUCCESS';
  }
  return 'INFO';
}

function deriveTone(event: SeasonalChatEventRuntimeState): LiveOpsOverlayTone {
  switch (event.preview.kind) {
    case 'HELPER_BLACKOUT':
      return 'SUPPRESSED';
    case 'WHISPER_ONLY':
      return 'WHISPER';
    case 'FACTION_DEBATE':
      return 'DEBATE';
    case 'COORDINATED_HATER_RAID':
    case 'PREDATOR_SWEEP':
    case 'LOW_SHIELD_HUNT':
      return 'PREDATORY';
    case 'LEGEND_SPOTLIGHT':
      return 'CEREMONIAL';
    default:
      return event.visiblePriority >= 0.72 ? 'ALARM' : 'SURGE';
  }
}

function deriveMountTargets(event: SeasonalChatEventRuntimeState, runtime: ChatBridgeRuntimeSnapshot): readonly ChatBridgeMountTarget[] {
  const mounts = new Set<ChatBridgeMountTarget>();

  mounts.add('PRIMARY_DOCK');

  if (event.visiblePriority >= 0.82) {
    mounts.add('MOMENT_FLASH');
  }
  if (event.preview.kind === 'LOW_SHIELD_HUNT' || event.preview.kind === 'COORDINATED_HATER_RAID') {
    mounts.add('THREAT_RADAR_PANEL');
  }
  if (event.preview.kind === 'HELPER_BLACKOUT' && (runtime.cashflow ?? 0) < 0) {
    mounts.add('RESCUE_WINDOW_BANNER');
  }
  if (event.preview.kind === 'FACTION_DEBATE') {
    mounts.add('COUNTERPLAY_MODAL');
  }
  if (event.preview.kind === 'LEGEND_SPOTLIGHT') {
    mounts.add('PROOF_CARD_V2');
  }

  return [...mounts];
}

function shouldBeSticky(event: SeasonalChatEventRuntimeState): boolean {
  return event.visiblePriority >= 0.88
    || event.preview.kind === 'LOW_SHIELD_HUNT'
    || event.preview.kind === 'HELPER_BLACKOUT'
    || event.preview.kind === 'COORDINATED_HATER_RAID';
}

function buildOverlayCard(
  event: SeasonalChatEventRuntimeState,
  runtime: ChatBridgeRuntimeSnapshot,
): ChatWorldEventOverlayCard {
  const mounts = deriveMountTargets(event, runtime);
  const tone = deriveTone(event);

  return {
    overlayId: `overlay:${event.eventId}:${event.activatedAt}`,
    eventId: event.eventId,
    headline: event.preview.headline,
    body: event.summary.summaryLine,
    detailLines: event.summary.keyEffects,
    severity: normalizeSeverity(event.visiblePriority),
    tone,
    visibilityMode: event.preview.visibilityMode,
    pressureBand: event.preview.pressureBand,
    announcementMode: event.preview.announcementMode,
    mounts,
    visibleChannels: event.targeting.visibleChannels,
    shadowChannels: event.targeting.shadowChannels,
    sticky: shouldBeSticky(event),
    dismissible: event.visiblePriority < 0.9 && tone !== 'SUPPRESSED',
    shouldPulse: event.visiblePriority >= 0.75 && tone !== 'WHISPER',
    helperSuppressed: event.helperSuppressionScore >= 0.5,
    whisperOnly: event.preview.visibilityMode === 'SHADOW_ONLY' || event.preview.kind === 'WHISPER_ONLY',
    crowdHeatScore: event.crowdHeatScore,
    priorityScore: clamp01((event.visiblePriority * 0.75) + (event.shadowPriority * 0.25)),
    activatedAt: event.activatedAt,
    deactivatesAt: event.deactivatesAt,
  };
}

function sortCards(left: ChatWorldEventOverlayCard, right: ChatWorldEventOverlayCard): number {
  return (right.priorityScore - left.priorityScore)
    || (Number(right.sticky) - Number(left.sticky))
    || (right.activatedAt - left.activatedAt);
}

export function buildWorldEventOverlayStack(
  snapshot: SeasonalChatEventDirectorSnapshot,
  options: WorldEventOverlayPolicyOptions = {},
): ChatWorldEventOverlayStack {
  const resolved = { ...DEFAULT_OPTIONS, ...options };

  const cards = snapshot.activeEvents
    .filter((event) => resolved.showWarmupCards || event.lifecycle !== 'WARMUP')
    .map((event) => buildOverlayCard(event, snapshot.runtime))
    .sort(sortCards);

  const shadowCards = cards
    .filter((card) => card.visibilityMode === 'SHADOW_ONLY' || card.whisperOnly)
    .slice(0, resolved.maxShadowCards);

  const publicCards = cards.filter((card) => !shadowCards.includes(card));

  return {
    primary: publicCards[0] ?? null,
    secondary: publicCards.slice(1, resolved.maxSecondaryCards + 1),
    shadow: shadowCards,
    quietWorld: publicCards.length === 0 && shadowCards.length === 0,
    helperBlackoutActive: cards.some((card) => card.helperSuppressed),
  };
}

export function selectPrimaryWorldEventOverlay(
  snapshot: SeasonalChatEventDirectorSnapshot,
  options: WorldEventOverlayPolicyOptions = {},
): ChatWorldEventOverlayCard | null {
  return buildWorldEventOverlayStack(snapshot, options).primary;
}

export function collectOverlayMountTargets(stack: ChatWorldEventOverlayStack): readonly ChatBridgeMountTarget[] {
  const mounts = new Set<ChatBridgeMountTarget>();
  const allCards = [stack.primary, ...stack.secondary, ...stack.shadow].filter(Boolean) as ChatWorldEventOverlayCard[];
  for (const card of allCards) {
    for (const mount of card.mounts) {
      mounts.add(mount);
    }
  }
  return [...mounts];
}

export function projectOverlaySeverityForChannel(
  stack: ChatWorldEventOverlayStack,
  channel: ChatBridgeChannel,
): ChatBridgeSeverity {
  const cards = [stack.primary, ...stack.secondary, ...stack.shadow].filter(Boolean) as ChatWorldEventOverlayCard[];
  const matching = cards.filter((card) => card.visibleChannels.includes(channel) || card.shadowChannels.includes(channel));
  if (matching.length === 0) {
    return 'INFO';
  }
  return matching.sort(sortCards)[0].severity;
}

export function shouldRenderOverlayOnMount(
  stack: ChatWorldEventOverlayStack,
  mount: ChatBridgeMountTarget,
): boolean {
  const cards = [stack.primary, ...stack.secondary, ...stack.shadow].filter(Boolean) as ChatWorldEventOverlayCard[];
  return cards.some((card) => card.mounts.includes(mount));
}

export function buildOverlayHeadline(summary: ChatLiveOpsSummary, stack: ChatWorldEventOverlayStack): string {
  if (stack.primary) {
    return stack.primary.headline;
  }
  if (summary.activeWorldEventCount > 0) {
    return `${summary.activeWorldEventCount} live world events active`;
  }
  return 'World pressure stable';
}

export function buildOverlaySubline(summary: ChatLiveOpsSummary, stack: ChatWorldEventOverlayStack): string {
  if (stack.primary) {
    return stack.primary.body;
  }
  if (summary.activeSeasonId) {
    return `Season ${summary.activeSeasonId} is active.`;
  }
  return 'No liveops surge currently targeted at this mount.';
}

export function buildChannelVisibilityMap(stack: ChatWorldEventOverlayStack): Readonly<Record<ChatChannelId, number>> {
  const map = new Map<ChatChannelId, number>();
  const cards = [stack.primary, ...stack.secondary, ...stack.shadow].filter(Boolean) as ChatWorldEventOverlayCard[];
  for (const card of cards) {
    for (const channel of card.visibleChannels) {
      map.set(channel, Math.max(map.get(channel) ?? 0, card.priorityScore));
    }
    for (const channel of card.shadowChannels) {
      map.set(channel, Math.max(map.get(channel) ?? 0, card.priorityScore * 0.75));
    }
  }
  return Object.freeze(Object.fromEntries(map.entries()) as Record<ChatChannelId, number>);
}

export function describeWorldEventKindForUi(kind: SeasonalChatEventRuntimeState['preview']['kind']): string {
  const definition = CHAT_WORLD_EVENT_REGISTRY_MANIFEST.canonicalKinds.find((entry: string) => entry === kind);
  if (!definition) {
    return 'Custom world event';
  }
  return definition
    .toLowerCase()
    .split('_')
    .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
