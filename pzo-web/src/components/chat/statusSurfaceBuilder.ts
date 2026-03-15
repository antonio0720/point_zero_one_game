import type { ChatChannel, ChatMessage, GameChatContext } from './chatTypes';
import type {
  EmptyStateViewModel,
  InvasionBannerViewModel,
  RoomHeaderViewModel,
  ThreatMeterViewModel,
} from './uiTypes';

/**
 * ============================================================================
 * POINT ZERO ONE — STATUS SURFACE BUILDER
 * FILE: pzo-web/src/components/chat/statusSurfaceBuilder.ts
 * ============================================================================
 *
 * UI adapter only.
 *
 * This file converts current compatibility-lane chat state into normalized
 * render models for:
 * - ChatInvasionBanner.tsx
 * - ChatThreatMeter.tsx
 * - ChatRoomHeader.tsx
 * - ChatEmptyState.tsx
 *
 * It does not become the authority for multiplayer, battle, moderation,
 * orchestration, or learning truth. It only packages already-available shell
 * signals into stable, memo-friendly view models.
 * ============================================================================
 */

export interface BuildStatusSurfaceArgs {
  gameCtx: GameChatContext;
  messages: readonly ChatMessage[];
  visibleMessages: readonly ChatMessage[];
  activeChannel: ChatChannel;
  searchQuery?: string | null;
  isCollapsed?: boolean;
  isConnected?: boolean;
  isTransportReady?: boolean;
  unreadCount?: number;
  onlineCount?: number;
  activeMembers?: number;
  typingCount?: number;
  helperPromptVisible?: boolean;
  transcriptLocked?: boolean;
  selectedMessageId?: string | null;
  openTranscript?: () => void;
  dismissInvasion?: () => void;
  focusThread?: () => void;
  switchChannel?: (channel: ChatChannel) => void;
  clearSearch?: () => void;
  composeFirstMessage?: () => void;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function normalizeWhitespace(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function compactChannelLabel(channel: ChatChannel): string {
  switch (channel) {
    case 'GLOBAL':
      return 'Global';
    case 'SYNDICATE':
      return 'Syndicate';
    case 'DEAL_ROOM':
      return 'Deal Room';
    default:
      return channel;
  }
}

function countKinds(messages: readonly ChatMessage[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const message of messages) {
    const key = message.kind || 'PLAYER';
    result[key] = (result[key] || 0) + 1;
  }
  return result;
}

function inferThreatDimensions(messages: readonly ChatMessage[]): {
  hostility: number;
  pressure: number;
  crowdHeat: number;
  confidenceSwing: number;
  rescueReadiness: number;
  volatility: number;
  shame: number;
  integrity: number;
} {
  const counts = countKinds(messages);
  const total = Math.max(1, messages.length);

  const hostility = clamp01(((counts.BOT_ATTACK || 0) * 0.26 + (counts.BOT_TAUNT || 0) * 0.14) / Math.max(1, total * 0.18));
  const pressure = clamp01(((counts.CASCADE_ALERT || 0) * 0.18 + (counts.SHIELD_EVENT || 0) * 0.12 + (counts.MARKET_ALERT || 0) * 0.08) / Math.max(1, total * 0.2));
  const crowdHeat = clamp01(((counts.BOT_TAUNT || 0) * 0.1 + (counts.ACHIEVEMENT || 0) * 0.08 + (counts.SYSTEM || 0) * 0.04) / Math.max(1, total * 0.16));
  const confidenceSwing = clamp01(Math.abs((counts.ACHIEVEMENT || 0) - (counts.BOT_ATTACK || 0)) / Math.max(1, total * 0.25));
  const rescueReadiness = clamp01(((counts.HELPER_PROMPT || 0) * 0.24 + (counts.SHIELD_EVENT || 0) * 0.08) / Math.max(1, total * 0.16));
  const volatility = clamp01((hostility * 0.34) + (pressure * 0.28) + (crowdHeat * 0.22) + ((counts.DEAL_RECAP || 0) / Math.max(1, total * 0.2)));
  const shame = clamp01(((counts.BOT_TAUNT || 0) * 0.18 + (counts.DEAL_RECAP || 0) * 0.05) / Math.max(1, total * 0.18));
  const integrity = clamp01(messages.filter((message) => Boolean(message.proofHash || message.proofTier)).length / Math.max(1, total * 0.6));

  return { hostility, pressure, crowdHeat, confidenceSwing, rescueReadiness, volatility, shame, integrity };
}

function inferSeverity(score01: number): ThreatMeterViewModel['severity'] {
  if (score01 >= 0.82) return 'severe';
  if (score01 >= 0.64) return 'high';
  if (score01 >= 0.42) return 'elevated';
  if (score01 >= 0.2) return 'low';
  return 'quiet';
}

function inferInvasionPhase(messages: readonly ChatMessage[]): InvasionBannerViewModel['phase'] {
  const counts = countKinds(messages);
  if ((counts.BOT_ATTACK || 0) >= 2) return 'active';
  if ((counts.BOT_ATTACK || 0) >= 1) return 'breach';
  if ((counts.BOT_TAUNT || 0) >= 1) return 'inbound';
  if ((counts.CASCADE_ALERT || 0) >= 1 || (counts.SHIELD_EVENT || 0) >= 1) return 'arming';
  return 'cooldown';
}

function mostRecent(messages: readonly ChatMessage[]): ChatMessage | null {
  if (messages.length === 0) return null;
  let winner: ChatMessage = messages[0];
  for (const message of messages) {
    const currentTs = typeof winner.ts === 'number' ? winner.ts : 0;
    const candidateTs = typeof message.ts === 'number' ? message.ts : 0;
    if (candidateTs >= currentTs) {
      winner = message;
    }
  }
  return winner;
}

function recentByKind(messages: readonly ChatMessage[], kinds: readonly string[]): ChatMessage[] {
  return messages.filter((message) => kinds.includes(message.kind || 'PLAYER')).slice(-6);
}

export function buildThreatMeterViewModel(args: BuildStatusSurfaceArgs): ThreatMeterViewModel {
  const dimensions = inferThreatDimensions(args.visibleMessages.length ? args.visibleMessages : args.messages);
  const aggregate = clamp01(
    (dimensions.hostility * 0.26) +
      (dimensions.pressure * 0.22) +
      (dimensions.crowdHeat * 0.14) +
      (dimensions.volatility * 0.18) +
      (dimensions.shame * 0.1) +
      ((1 - dimensions.integrity) * 0.1),
  );

  const severity = inferSeverity(aggregate);

  return {
    visible: true,
    aggregateScore01: aggregate,
    aggregateScoreLabel: `${Math.round(aggregate * 100)}%`,
    severity,
    severityLabel: severity.toUpperCase(),
    summary:
      severity === 'severe'
        ? 'Hostility and pressure are converging. Treat the lane as contested and keep rescue / proof response options close.'
        : severity === 'high'
          ? 'Threat is elevated. Crowd heat and pressure can still push this lane into a breach state quickly.'
          : severity === 'elevated'
            ? 'Signal density is climbing. Watch taunts, shield chatter, and reputation drift.'
            : severity === 'low'
              ? 'Lane is active but controlled. Use the quiet window to reinforce posture and transcript integrity.'
              : 'Lane is quiet. This is the best time to establish position before pressure returns.',
    bandNarrative:
      args.activeChannel === 'DEAL_ROOM'
        ? 'Deal Room should read as predatory, transcript-sensitive, and integrity-aware.'
        : args.activeChannel === 'SYNDICATE'
          ? 'Syndicate should stay intimate, tactical, and less theatrical than Global.'
          : 'Global should feel public, witness-heavy, and theatrically reactive.',
    deltaLabel: `${args.unreadCount || 0} unread`,
    channelKey: args.activeChannel,
    channelLabel: compactChannelLabel(args.activeChannel),
    density: args.isCollapsed ? 'compact' : 'comfortable',
    dimensions: [
      {
        id: 'hostility',
        label: 'Hostility',
        value01: dimensions.hostility,
        valueLabel: `${Math.round(dimensions.hostility * 100)}%`,
        subvalue: `${recentByKind(args.visibleMessages, ['BOT_ATTACK', 'BOT_TAUNT']).length} hostile events`,
        sparkline: [Math.max(0, dimensions.hostility - 0.18), Math.max(0, dimensions.hostility - 0.1), dimensions.hostility],
      },
      {
        id: 'pressure',
        label: 'Pressure',
        value01: dimensions.pressure,
        valueLabel: `${Math.round(dimensions.pressure * 100)}%`,
        subvalue: `${recentByKind(args.visibleMessages, ['SHIELD_EVENT', 'CASCADE_ALERT']).length} risk cues`,
        sparkline: [Math.max(0, dimensions.pressure - 0.14), dimensions.pressure * 0.9, dimensions.pressure],
      },
      {
        id: 'crowdHeat',
        label: 'Crowd heat',
        value01: dimensions.crowdHeat,
        valueLabel: `${Math.round(dimensions.crowdHeat * 100)}%`,
        subvalue: args.activeChannel === 'GLOBAL' ? 'witness pressure' : 'room mood',
        sparkline: [Math.max(0, dimensions.crowdHeat - 0.1), dimensions.crowdHeat * 0.94, dimensions.crowdHeat],
      },
      {
        id: 'confidenceSwing',
        label: 'Confidence swing',
        value01: dimensions.confidenceSwing,
        valueLabel: `${Math.round(dimensions.confidenceSwing * 100)}%`,
        subvalue: 'momentum volatility',
        sparkline: [Math.max(0, dimensions.confidenceSwing - 0.07), dimensions.confidenceSwing * 0.9, dimensions.confidenceSwing],
      },
      {
        id: 'rescueReadiness',
        label: 'Rescue readiness',
        value01: dimensions.rescueReadiness,
        valueLabel: `${Math.round(dimensions.rescueReadiness * 100)}%`,
        subvalue: args.helperPromptVisible ? 'helper prompt live' : 'no active prompt',
        sparkline: [Math.max(0, dimensions.rescueReadiness - 0.12), dimensions.rescueReadiness * 0.9, dimensions.rescueReadiness],
      },
      {
        id: 'volatility',
        label: 'Volatility',
        value01: dimensions.volatility,
        valueLabel: `${Math.round(dimensions.volatility * 100)}%`,
        subvalue: 'scene instability',
        sparkline: [Math.max(0, dimensions.volatility - 0.09), dimensions.volatility * 0.94, dimensions.volatility],
      },
      {
        id: 'shame',
        label: 'Audience shame',
        value01: dimensions.shame,
        valueLabel: `${Math.round(dimensions.shame * 100)}%`,
        subvalue: 'social exposure',
        sparkline: [Math.max(0, dimensions.shame - 0.06), dimensions.shame * 0.95, dimensions.shame],
      },
      {
        id: 'integrity',
        label: 'Integrity',
        value01: dimensions.integrity,
        valueLabel: `${Math.round(dimensions.integrity * 100)}%`,
        subvalue: args.transcriptLocked ? 'drawer locked' : 'transcript mutable',
        sparkline: [Math.max(0, dimensions.integrity - 0.04), dimensions.integrity * 0.98, dimensions.integrity],
      },
    ],
    recommendations: [
      {
        id: 'rec-1',
        label: 'Shell posture',
        body:
          aggregate >= 0.64
            ? 'Keep helper affordances visible and bias toward transcript / proof access.'
            : 'Preserve signal clarity; do not over-escalate the shell while the lane is still recoverable.',
        tone: aggregate >= 0.64 ? 'warning' : 'neutral',
      },
      {
        id: 'rec-2',
        label: args.activeChannel === 'DEAL_ROOM' ? 'Deal pressure' : 'Channel discipline',
        body:
          args.activeChannel === 'DEAL_ROOM'
            ? 'Deal Room should foreground integrity, recap pressure, and predatory seriousness.'
            : args.activeChannel === 'SYNDICATE'
              ? 'Reduce theatrical noise and keep trust / tactical context easy to scan.'
              : 'Preserve crowd-heated witness cues without letting the shell become the decision brain.',
        tone: args.activeChannel === 'DEAL_ROOM' ? 'warning' : 'neutral',
      },
      {
        id: 'rec-3',
        label: 'Rescue lane',
        body: dimensions.rescueReadiness >= 0.5 ? 'Support timing is viable now.' : 'Do not force helper interventions too early.',
        tone: dimensions.rescueReadiness >= 0.5 ? 'positive' : 'neutral',
      },
    ],
  };
}

export function buildInvasionBannerViewModel(args: BuildStatusSurfaceArgs): InvasionBannerViewModel {
  const messages = args.visibleMessages.length ? args.visibleMessages : args.messages;
  const phase = inferInvasionPhase(messages);
  const threat = buildThreatMeterViewModel(args);
  const recentAttackers = recentByKind(messages, ['BOT_ATTACK', 'BOT_TAUNT']);
  const latest = mostRecent(messages);
  const active = phase !== 'cooldown' && (threat.aggregateScore01 >= 0.3 || recentAttackers.length > 0);

  return {
    visible: active,
    severity: threat.severity,
    phase,
    title:
      phase === 'active'
        ? 'Invasion sequence active'
        : phase === 'breach'
          ? 'Breach posture detected'
          : phase === 'inbound'
            ? 'Threat inbound'
            : phase === 'arming'
              ? 'Pressure window arming'
              : 'Threat cooling down',
    body:
      latest?.body && normalizeWhitespace(latest.body)
        ? normalizeWhitespace(latest.body)
        : args.activeChannel === 'DEAL_ROOM'
          ? 'The room is taking on predatory pressure. Keep proof-bearing recap and exit lanes nearby.'
          : 'Attack pressure is building around the channel. Keep rescue, transcript, and lane-switch affordances close.',
    recommendation:
      threat.aggregateScore01 >= 0.64
        ? 'Stay in the shell long enough to read the lane, then either reinforce or relocate with intent.'
        : 'Hold posture and let the shell remain legible. Do not let the component layer overreact for the engine.',
    phaseLabel: phase.toUpperCase(),
    channelKey: args.activeChannel,
    channelLabel: compactChannelLabel(args.activeChannel),
    ruleLabel: args.activeChannel === 'DEAL_ROOM' ? 'Integrity-sensitive' : 'Witness-sensitive',
    countdownLabel: active ? 'window' : 'cooldown',
    secondsRemaining: active ? 18 + (recentAttackers.length * 9) : 0,
    progress01: clamp01(threat.aggregateScore01),
    density: args.isCollapsed ? 'compact' : threat.aggregateScore01 >= 0.7 ? 'cinematic' : 'comfortable',
    autoFocus: active && Boolean(args.selectedMessageId),
    footerNote: args.activeChannel === 'DEAL_ROOM' ? 'Deal Room must stay serious.' : 'Shell renders state only. Engine decides truth.',
    metrics: [
      {
        id: 'aggro',
        label: 'Aggro',
        value: `${recentAttackers.length}`,
        subvalue: 'recent hostile events',
      },
      {
        id: 'watchers',
        label: 'Witnesses',
        value: `${args.onlineCount || args.activeMembers || 0}`,
        subvalue: 'active in lane',
      },
      {
        id: 'typing',
        label: 'Typing',
        value: `${args.typingCount || 0}`,
        subvalue: 'live responders',
      },
      {
        id: 'integrity',
        label: 'Integrity',
        value: args.transcriptLocked ? 'Locked' : 'Open',
        subvalue: args.activeChannel === 'DEAL_ROOM' ? 'deal transcript state' : 'drawer state',
      },
    ],
    witnesses: [
      ...(args.helperPromptVisible ? [{ id: 'helper', label: 'Helper ready', role: 'helper' as const, icon: '✦' }] : []),
      ...(recentAttackers.length ? [{ id: 'hater', label: 'Hostile presence', role: 'hater' as const, icon: '⚠', count: recentAttackers.length }] : []),
      ...(args.onlineCount ? [{ id: 'crowd', label: 'Watching', role: 'crowd' as const, icon: '◎', count: args.onlineCount }] : []),
      ...(args.transcriptLocked ? [{ id: 'system', label: 'Integrity lock', role: 'system' as const, icon: '⌘' }] : []),
    ],
    actions: [
      {
        id: 'action-transcript',
        label: 'Open transcript',
        tone: args.transcriptLocked ? 'warning' : 'muted',
        icon: '☰',
        onPress: args.openTranscript,
      },
      {
        id: 'action-focus',
        label: 'Focus thread',
        tone: threat.aggregateScore01 >= 0.64 ? 'primary' : 'muted',
        icon: '◉',
        onPress: args.focusThread,
      },
      {
        id: 'action-dismiss',
        label: 'Dismiss',
        tone: 'muted',
        icon: '×',
        onPress: args.dismissInvasion,
      },
    ],
  };
}

export function buildRoomHeaderViewModel(args: BuildStatusSurfaceArgs): RoomHeaderViewModel {
  const threat = buildThreatMeterViewModel(args);
  const totalVisible = args.visibleMessages.length;
  const proofCount = args.visibleMessages.filter((message) => Boolean(message.proofHash || message.proofTier)).length;

  return {
    title:
      args.activeChannel === 'DEAL_ROOM'
        ? 'Deal Room'
        : args.activeChannel === 'SYNDICATE'
          ? 'Syndicate Channel'
          : 'Global Channel',
    subtitle:
      args.activeChannel === 'DEAL_ROOM'
        ? 'Predatory negotiation lane. Serious, recap-aware, integrity-sensitive.'
        : args.activeChannel === 'SYNDICATE'
          ? 'Private tactical lane. Trust, posture, and controlled pressure.'
          : 'Public witness lane. Fast, reactive, and theatrically social.',
    icon: args.activeChannel === 'DEAL_ROOM' ? '◇' : args.activeChannel === 'SYNDICATE' ? '◈' : '◎',
    channelKey: args.activeChannel,
    modeLabel: normalizeWhitespace((args.gameCtx as Record<string, unknown>).modeName as string | undefined) || 'Mode active',
    postureLabel: threat.severity.toUpperCase(),
    integrityLabel: args.transcriptLocked ? 'Transcript locked' : 'Transcript open',
    presenceLabel: `${args.onlineCount || args.activeMembers || 0} present`,
    memberCountLabel: `${args.visibleMessages.length} visible lines`,
    badges: [
      { id: 'badge-severity', label: threat.severity.toUpperCase(), tone: threat.severity === 'severe' || threat.severity === 'high' ? 'danger' : threat.severity === 'elevated' ? 'warning' : 'accent' },
      ...(args.activeChannel === 'DEAL_ROOM' ? [{ id: 'badge-proof', label: `${proofCount} proof`, tone: 'warning' as const, placement: 'right' as const }] : []),
      ...(args.unreadCount ? [{ id: 'badge-unread', label: `${args.unreadCount} unread`, tone: 'neutral' as const, placement: 'right' as const }] : []),
    ],
    actions: [
      {
        id: 'header-open-transcript',
        label: 'Transcript',
        tone: args.transcriptLocked ? 'warning' : 'neutral',
        priority: 'primary',
        icon: '☰',
        onPress: args.openTranscript,
      },
      {
        id: 'header-compose',
        label: 'First message',
        tone: totalVisible === 0 ? 'positive' : 'neutral',
        priority: 'primary',
        icon: '✎',
        onPress: args.composeFirstMessage,
      },
      {
        id: 'header-global',
        label: 'Global',
        tone: args.activeChannel === 'GLOBAL' ? 'accent' : 'muted',
        priority: 'secondary',
        onPress: args.switchChannel ? () => args.switchChannel?.('GLOBAL') : undefined,
      },
      {
        id: 'header-syndicate',
        label: 'Syndicate',
        tone: args.activeChannel === 'SYNDICATE' ? 'accent' : 'muted',
        priority: 'secondary',
        onPress: args.switchChannel ? () => args.switchChannel?.('SYNDICATE') : undefined,
      },
      {
        id: 'header-deal-room',
        label: 'Deal Room',
        tone: args.activeChannel === 'DEAL_ROOM' ? 'warning' : 'muted',
        priority: 'secondary',
        onPress: args.switchChannel ? () => args.switchChannel?.('DEAL_ROOM') : undefined,
      },
    ],
    summaryMetrics: [
      { id: 'metric-lines', label: 'Visible lines', value: `${totalVisible}`, subvalue: 'in current channel' },
      { id: 'metric-online', label: 'Presence', value: `${args.onlineCount || args.activeMembers || 0}`, subvalue: 'live actors' },
      { id: 'metric-typing', label: 'Typing', value: `${args.typingCount || 0}`, subvalue: 'current responders' },
      { id: 'metric-proof', label: 'Integrity', value: `${proofCount}`, subvalue: 'proof-bearing lines' },
    ],
  };
}

export function buildEmptyStateViewModel(args: BuildStatusSurfaceArgs): EmptyStateViewModel {
  const threat = buildThreatMeterViewModel(args);
  const hasSearch = Boolean(normalizeWhitespace(args.searchQuery));

  if (!args.isConnected || args.isTransportReady === false) {
    return {
      visible: true,
      scenario: 'disconnected',
      title: 'Chat transport is not fully attached',
      body: 'The shell is mounted, but the transport lane has not fully rejoined. Keep the shell readable and offer fast recovery, not fake certainty.',
      channelKey: args.activeChannel,
      channelLabel: compactChannelLabel(args.activeChannel),
      postureLabel: 'Recovery',
      heroMetric: { label: 'State', value: 'Offline', subvalue: 'transport pending' },
      hints: [
        { id: 'hint-1', label: 'Transport', body: 'Do not pretend transcript truth exists until the engine confirms it.' },
        { id: 'hint-2', label: 'UX rule', body: 'Components render posture only. Reconnection remains outside this lane.' },
      ],
      actions: [
        { id: 'action-open-transcript', label: 'Transcript', tone: 'muted', onPress: args.openTranscript },
      ],
      footerNote: 'Disconnected is a real shell state, not a generic placeholder.',
    };
  }

  if (args.isCollapsed) {
    return {
      visible: true,
      scenario: 'collapsed',
      title: 'Chat is minimized but alive',
      body: 'The shell is collapsed. Presence, threat, and channel identity should still feel active without forcing full expansion.',
      channelKey: args.activeChannel,
      channelLabel: compactChannelLabel(args.activeChannel),
      postureLabel: threat.severity.toUpperCase(),
      heroMetric: { label: 'Unread', value: `${args.unreadCount || 0}`, subvalue: 'hidden behind shell' },
      hints: [{ id: 'hint-collapsed', label: 'Signal', body: 'Use the minimized surface to preserve continuity, not authority.' }],
      actions: [],
      footerNote: 'Collapsed state should still feel intentional.',
    };
  }

  if (hasSearch && args.visibleMessages.length === 0) {
    return {
      visible: true,
      scenario: 'searchZero',
      title: 'No transcript rows match the current filters',
      body: 'Search and filter state produced zero visible rows. Keep the channel identity legible and give the user a clean way back.',
      channelKey: args.activeChannel,
      channelLabel: compactChannelLabel(args.activeChannel),
      postureLabel: 'Filtered',
      heroMetric: { label: 'Query', value: normalizeWhitespace(args.searchQuery), subvalue: 'returned zero rows' },
      hints: [
        { id: 'hint-search', label: 'Search', body: 'Do not ask the component to parse transcript truth; use prepared rows only.' },
        { id: 'hint-restore', label: 'Recovery', body: 'Offer a direct clear-search affordance.' },
      ],
      actions: [
        { id: 'action-clear-search', label: 'Clear search', tone: 'primary', onPress: args.clearSearch },
        { id: 'action-open-transcript', label: 'Transcript', tone: 'muted', onPress: args.openTranscript },
      ],
      footerNote: 'Zero results is a shell posture, not an engine failure.',
    };
  }

  if (args.activeChannel === 'DEAL_ROOM' && args.visibleMessages.length === 0) {
    return {
      visible: true,
      scenario: 'transcriptPending',
      title: 'Deal Room is waiting for the first recap-worthy line',
      body: 'This lane should feel serious even before the first proof-bearing recap lands. Preserve integrity cues and predatory calm.',
      channelKey: args.activeChannel,
      channelLabel: 'Deal Room',
      postureLabel: 'Predatory calm',
      heroMetric: { label: 'Proof', value: '0', subvalue: 'recap-bearing lines' },
      hints: [
        { id: 'hint-proof', label: 'Integrity', body: 'Do not cheapen Deal Room into a casual tab. It should feel deliberate.' },
        { id: 'hint-first-line', label: 'Start', body: 'First line should be framed as consequential, not disposable.' },
      ],
      actions: [
        { id: 'action-first-message', label: 'Open composer', tone: 'primary', onPress: args.composeFirstMessage },
      ],
      footerNote: 'Deal Room must preserve seriousness even while empty.',
    };
  }

  if (threat.aggregateScore01 >= 0.5 && args.visibleMessages.length === 0) {
    return {
      visible: true,
      scenario: 'pressurePrompt',
      title: 'The lane is quiet, but pressure is not gone',
      body: 'Threat posture suggests the next message may matter more than the empty shell implies. Keep support and transcript pathways visible.',
      channelKey: args.activeChannel,
      channelLabel: compactChannelLabel(args.activeChannel),
      postureLabel: threat.severity.toUpperCase(),
      heroMetric: { label: 'Threat', value: `${Math.round(threat.aggregateScore01 * 100)}%`, subvalue: 'live shell estimate' },
      hints: [
        { id: 'hint-pressure-1', label: 'Shell rule', body: 'Empty does not mean safe.' },
        { id: 'hint-pressure-2', label: 'Rescue', body: args.helperPromptVisible ? 'Helper lane is available.' : 'Do not force rescue too early.' },
      ],
      actions: [
        { id: 'action-open-transcript', label: 'Transcript', tone: 'warning', onPress: args.openTranscript },
        { id: 'action-compose', label: 'Compose', tone: 'muted', onPress: args.composeFirstMessage },
      ],
      footerNote: 'Threat-aware empty state should still feel intentional.',
    };
  }

  return {
    visible: args.visibleMessages.length === 0,
    scenario: 'coldOpen',
    title: 'This lane has not spoken yet',
    body:
      args.activeChannel === 'GLOBAL'
        ? 'Global should still feel public and witness-heavy even before the first line appears.'
        : args.activeChannel === 'SYNDICATE'
          ? 'Syndicate should still feel intimate and tactical even while quiet.'
          : 'Deal Room should still feel sharp and consequential even while waiting.',
    channelKey: args.activeChannel,
    channelLabel: compactChannelLabel(args.activeChannel),
    postureLabel: 'Ready',
    heroMetric: { label: 'Unread', value: `${args.unreadCount || 0}`, subvalue: 'currently hidden' },
    hints: [
      { id: 'hint-cold-1', label: 'Doctrine', body: 'Empty state should carry channel identity, not generic filler.' },
      { id: 'hint-cold-2', label: 'Authority', body: 'Shell renders. Engine and transport still own truth.' },
    ],
    actions: [
      { id: 'action-compose', label: 'Open composer', tone: 'primary', onPress: args.composeFirstMessage },
      { id: 'action-open-transcript', label: 'Transcript', tone: 'muted', onPress: args.openTranscript },
    ],
    footerNote: 'Cold-open state should still feel authored.',
  };
}
