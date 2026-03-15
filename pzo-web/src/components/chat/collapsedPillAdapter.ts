/**
 * ============================================================================
 * POINT ZERO ONE — COLLAPSED PILL UI ADAPTER
 * FILE: pzo-web/src/components/chat/collapsedPillAdapter.ts
 * VERSION: 1.1.0
 * AUTHOR: OpenAI
 * LICENSE: Internal / Project Use Only
 * ============================================================================
 *
 * Purpose
 * -------
 * Dedicated presentation adapter that maps `useUnifiedChat()` output into the
 * normalized `ChatUiCollapsedPillViewModel` consumed by `ChatCollapsedPill.tsx`.
 *
 * Why this file exists
 * --------------------
 * The component should stay render-only. The hook already owns shell-facing UI
 * state such as:
 * - collapsed / open posture
 * - total unread
 * - threat posture
 * - helper prompt visibility
 * - presence preview
 * - active / available channels
 *
 * This adapter creates the seam between the hook and the presentation model.
 * It computes a rich collapsed-pill payload but still defers final shape
 * normalization to `buildCollapsedPillViewModel()` in `uiTypes.ts`.
 * ============================================================================
 */

import type {
  ChatUiAccent,
  ChatUiChip,
  ChatUiCollapsedPillAction,
  ChatUiCollapsedPillPresenceSummary,
  ChatUiCollapsedPillThreatSummary,
  ChatUiCollapsedPillViewModel,
  ChatUiMetric,
  ChatUiPill,
  ChatUiThreatBand,
  ChatUiTone,
} from './uiTypes';
import {
  buildCollapsedPillViewModel,
  normalizeAccent,
  normalizeTone,
  normalizeThreatBand,
  toId,
} from './uiTypes';
import type {
  UnifiedChatChannelSummary,
  UnifiedChatConnectionState,
  UnifiedChatHelperPrompt,
  UnifiedChatThreatSummary,
  UseUnifiedChatResult,
} from './useUnifiedChat';

export interface CollapsedPillAdapterThreatOverride {
  readonly label?: string;
  readonly band?: ChatUiThreatBand;
  readonly score01?: number;
  readonly helperPressure?: number;
  readonly haterPressure?: number;
  readonly crowdHeat?: number;
  readonly tooltip?: string;
}

export interface CollapsedPillAdapterInvasionOverride {
  readonly active: boolean;
  readonly label?: string;
  readonly stageLabel?: string;
  readonly aggressorLabel?: string;
  readonly priorityLabel?: string;
  readonly tooltip?: string;
}

export interface CollapsedPillAdapterOptions {
  readonly id?: string;
  readonly label?: string;
  readonly shortLabel?: string;
  readonly roomLabel?: string;
  readonly roomSubtitle?: string;
  readonly channelLabel?: string;
  readonly liveLabel?: string;
  readonly connectionLabel?: string;
  readonly mountLabel?: string;
  readonly tooltip?: string;
  readonly pinned?: boolean;
  readonly muted?: boolean;
  readonly attention?: 'low' | 'normal' | 'elevated' | 'high' | 'critical';
  readonly presenceNamesLimit?: number;
  readonly channelLimit?: number;
  readonly actionLimit?: number;
  readonly chipLimit?: number;
  readonly metricLimit?: number;
  readonly statusPillLimit?: number;
  readonly accentOverride?: ChatUiAccent;
  readonly toneOverride?: ChatUiTone;
  readonly threatOverride?: CollapsedPillAdapterThreatOverride;
  readonly invasionOverride?: CollapsedPillAdapterInvasionOverride;
  readonly actions?: readonly ChatUiCollapsedPillAction[];
  readonly chips?: readonly ChatUiChip[];
  readonly metrics?: readonly ChatUiMetric[];
  readonly statusPills?: readonly ChatUiPill[];
}

function cap<T>(items: readonly T[] | undefined, limit: number | undefined): readonly T[] | undefined {
  if (!items || items.length === 0) return undefined;
  if (!Number.isFinite(limit) || (limit as number) <= 0) return items;
  return items.slice(0, limit as number);
}

function clamp01(value: number | undefined): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(1, value as number));
}

function mapConnectionTone(connection: UnifiedChatConnectionState): ChatUiTone {
  switch (connection) {
    case 'DISCONNECTED':
      return 'danger';
    case 'DEGRADED':
      return 'warning';
    case 'CONNECTING':
      return 'ghost';
    case 'CONNECTED':
    default:
      return 'neutral';
  }
}

function mapConnectionAccent(connection: UnifiedChatConnectionState): ChatUiAccent {
  switch (connection) {
    case 'DISCONNECTED':
      return 'red';
    case 'DEGRADED':
      return 'amber';
    case 'CONNECTING':
      return 'slate';
    case 'CONNECTED':
    default:
      return 'silver';
  }
}

function mapThreatBand(threat: UnifiedChatThreatSummary): ChatUiThreatBand {
  switch (threat.tier) {
    case 'CRITICAL':
      return 'critical';
    case 'HIGH':
      return 'hostile';
    case 'WATCH':
      return 'elevated';
    case 'CALM':
    default:
      return 'quiet';
  }
}

function deriveAccent(
  result: UseUnifiedChatResult,
  options: CollapsedPillAdapterOptions,
  threatBand: ChatUiThreatBand,
): ChatUiAccent {
  if (options.accentOverride) return normalizeAccent(options.accentOverride);
  if (options.invasionOverride?.active) return 'red';
  if (result.helperPrompt) return 'emerald';
  if (threatBand === 'critical' || threatBand === 'catastrophic') return 'red';
  if (threatBand === 'hostile' || threatBand === 'pressured') return 'amber';
  if ((result.totalUnread ?? 0) > 0) return 'silver';
  return mapConnectionAccent(result.connectionState);
}

function deriveTone(
  result: UseUnifiedChatResult,
  options: CollapsedPillAdapterOptions,
  threatBand: ChatUiThreatBand,
): ChatUiTone {
  if (options.toneOverride) return normalizeTone(options.toneOverride);
  if (options.invasionOverride?.active) return 'danger';
  if (threatBand === 'critical' || threatBand === 'catastrophic') return 'danger';
  if (threatBand === 'hostile' || threatBand === 'pressured') return 'warning';
  if (result.helperPrompt) return 'supportive';
  return mapConnectionTone(result.connectionState);
}

function buildThreatSummary(
  result: UseUnifiedChatResult,
  options: CollapsedPillAdapterOptions,
): ChatUiCollapsedPillThreatSummary {
  const override = options.threatOverride;
  const band = normalizeThreatBand(override?.band ?? mapThreatBand(result.threat));
  const score01 =
    typeof override?.score01 === 'number'
      ? clamp01(override.score01)
      : clamp01(Math.max(0, Math.min(1, result.threat.score / 100)));

  return {
    band,
    score01,
    label: override?.label ?? result.threat.label,
    helperPressure: override?.helperPressure,
    haterPressure: override?.haterPressure,
    crowdHeat: override?.crowdHeat,
    tooltip:
      override?.tooltip ??
      (result.threat.reasons.length > 0
        ? result.threat.reasons.join(' • ')
        : `Threat posture ${result.threat.tier.toLowerCase()}`),
  };
}

function buildPresenceSummary(
  result: UseUnifiedChatResult,
  options: CollapsedPillAdapterOptions,
): ChatUiCollapsedPillPresenceSummary {
  const preview = result.presence;
  const visible = Math.max(0, preview.onlineCount ?? 0);
  const typing = Math.max(0, preview.typingCount ?? 0);
  const recentNames = preview.recentPeerNames.slice(0, options.presenceNamesLimit ?? 4);

  let mood: ChatUiCollapsedPillPresenceSummary['mood'] = 'quiet';
  if (visible >= 8 || typing >= 3) mood = 'swarming';
  else if (visible >= 4 || typing >= 2) mood = 'active';
  else if (visible >= 1 || typing >= 1) mood = 'watched';

  return {
    count: visible,
    activeCount: Math.max(0, preview.activeMembers ?? 0),
    mood,
    moodLabel:
      mood === 'swarming' ? 'Swarming' : mood === 'active' ? 'Active' : mood === 'watched' ? 'Watched' : 'Quiet',
    label: visible > 0 ? `${visible} visible • ${Math.max(0, preview.activeMembers ?? 0)} active` : 'Quiet room',
    observerLabels: recentNames.length > 0 ? recentNames : undefined,
    tooltip: recentNames.length > 0 ? `Recent peers: ${recentNames.join(', ')}` : 'No visible peer activity',
  };
}

function buildTypingSummary(result: UseUnifiedChatResult) {
  const count = Math.max(0, result.presence.typingCount ?? 0);
  if (count <= 0) {
    return {
      count: 0,
      label: undefined,
      actorLabels: undefined,
      tooltip: undefined,
    };
  }

  const actors = result.presence.recentPeerNames.slice(0, 3);

  return {
    count,
    label: count === 1 ? '1 typing' : `${count} typing`,
    actorLabels: actors.length > 0 ? actors : undefined,
    tooltip: actors.length > 0 ? `Likely active: ${actors.join(', ')}` : `${count} active typing signal${count === 1 ? '' : 's'}`,
  };
}

function buildHelperSummary(helper: UnifiedChatHelperPrompt | null | undefined) {
  if (!helper) {
    return {
      visible: false,
      label: undefined,
      body: undefined,
      urgency: 'idle' as const,
      trustWindowPct: undefined,
      tooltip: undefined,
      ctaLabel: undefined,
    };
  }

  const urgency =
    helper.severity === 'CRITICAL'
      ? 'immediate'
      : helper.severity === 'WARNING'
        ? 'high'
        : helper.severity === 'GUIDE'
          ? 'medium'
          : 'low';

  return {
    visible: true,
    label: helper.title,
    body: helper.body,
    urgency,
    trustWindowPct: helper.severity === 'CRITICAL' ? 1 : helper.severity === 'WARNING' ? 0.72 : 0.48,
    tooltip: helper.body,
    ctaLabel: helper.ctaLabel,
  };
}

function buildInvasionSummary(options: CollapsedPillAdapterOptions) {
  const invasion = options.invasionOverride;
  if (!invasion?.active) {
    return {
      active: false,
      label: undefined,
      stageLabel: undefined,
      aggressorLabel: undefined,
      priorityLabel: undefined,
      tooltip: undefined,
    };
  }

  return {
    active: true,
    label: invasion.label ?? 'Invasion active',
    stageLabel: invasion.stageLabel,
    aggressorLabel: invasion.aggressorLabel,
    priorityLabel: invasion.priorityLabel,
    tooltip: invasion.tooltip,
  };
}

function channelKind(channel: UnifiedChatChannelSummary['channel']) {
  switch (channel) {
    case 'GLOBAL':
      return 'global';
    case 'SYNDICATE':
      return 'syndicate';
    case 'DEAL_ROOM':
      return 'deal_room';
    default:
      return 'unknown';
  }
}

function channelAccent(channel: UnifiedChatChannelSummary['channel']): ChatUiAccent {
  switch (channel) {
    case 'GLOBAL':
      return 'indigo';
    case 'SYNDICATE':
      return 'cyan';
    case 'DEAL_ROOM':
      return 'amber';
    default:
      return 'slate';
  }
}

function channelIcon(channel: UnifiedChatChannelSummary['channel']): string {
  switch (channel) {
    case 'GLOBAL':
      return '◉';
    case 'SYNDICATE':
      return '◎';
    case 'DEAL_ROOM':
      return '¤';
    default:
      return '•';
  }
}

function buildChannelSummary(
  summary: UnifiedChatChannelSummary,
  result: UseUnifiedChatResult,
) {
  return {
    id: toId('collapsed-channel', summary.channel),
    channelId: summary.channel,
    label: summary.label,
    shortLabel: summary.label,
    kind: channelKind(summary.channel),
    icon: channelIcon(summary.channel),
    unreadCount: summary.unread,
    mentionCount: 0,
    typingCount: result.activeChannel === summary.channel ? result.presence.typingCount : 0,
    active: result.activeChannel === summary.channel,
    helperPending: Boolean(result.helperPrompt && result.activeChannel === summary.channel),
    haterPending: summary.hasThreatActivity,
    accent: channelAccent(summary.channel),
    tone: summary.hasThreatActivity ? 'warning' : 'neutral',
    tooltip:
      summary.latestPreview && summary.latestPreview.length > 0 ? `${summary.label}: ${summary.latestPreview}` : summary.label,
    disabled: false,
  };
}

function buildStatusPills(
  result: UseUnifiedChatResult,
  options: CollapsedPillAdapterOptions,
): readonly ChatUiPill[] {
  const pills: ChatUiPill[] = [
    {
      id: 'collapsed-pill:channel',
      label: result.activeSummary.label,
      icon: channelIcon(result.activeChannel),
      accent: channelAccent(result.activeChannel),
      tone: 'neutral',
      selected: true,
    },
    {
      id: 'collapsed-pill:connection',
      label: result.connectionState,
      icon: result.connected ? '●' : '○',
      accent: mapConnectionAccent(result.connectionState),
      tone: mapConnectionTone(result.connectionState),
      selected: result.connected,
    },
  ];

  if (options.mountLabel || result.mountState?.mountTarget) {
    pills.push({
      id: 'collapsed-pill:mount',
      label: options.mountLabel ?? result.mountState.mountTarget,
      icon: '⌂',
      accent: 'slate',
      tone: 'ghost',
    });
  }

  if (result.transcript.open) {
    pills.push({
      id: 'collapsed-pill:transcript',
      label: 'Transcript',
      icon: '≡',
      accent: 'silver',
      tone: 'neutral',
      selected: true,
    });
  }

  return cap(options.statusPills ?? pills, options.statusPillLimit) ?? (options.statusPills ?? pills);
}

function buildDefaultChips(result: UseUnifiedChatResult): readonly ChatUiChip[] {
  const chips: ChatUiChip[] = [];

  if (result.helperPrompt) {
    chips.push({
      id: 'collapsed-chip:helper',
      label: 'Helper staged',
      shortLabel: 'Helper',
      icon: '✦',
      accent: 'emerald',
      tone: 'supportive',
      active: true,
      tooltip: result.helperPrompt.title,
    });
  }

  if (result.threat.tier === 'HIGH' || result.threat.tier === 'CRITICAL') {
    chips.push({
      id: 'collapsed-chip:threat',
      label: result.threat.tier === 'CRITICAL' ? 'Critical posture' : 'High posture',
      shortLabel: result.threat.tier === 'CRITICAL' ? 'Critical' : 'High',
      icon: '▲',
      accent: result.threat.tier === 'CRITICAL' ? 'red' : 'amber',
      tone: result.threat.tier === 'CRITICAL' ? 'danger' : 'warning',
      active: true,
      tooltip: result.threat.reasons.join(' • '),
    });
  }

  if (result.presence.typingCount > 0) {
    chips.push({
      id: 'collapsed-chip:typing',
      label: result.presence.typingCount === 1 ? '1 typing' : `${result.presence.typingCount} typing`,
      shortLabel: 'Typing',
      icon: '…',
      accent: 'cyan',
      tone: 'neutral',
      active: true,
    });
  }

  return chips;
}

function buildDefaultMetrics(result: UseUnifiedChatResult): readonly ChatUiMetric[] {
  return [
    {
      id: 'collapsed-metric:unread',
      label: 'Unread',
      value: String(result.totalUnread),
      rawValue: result.totalUnread,
      accent: result.totalUnread > 0 ? 'silver' : 'slate',
      tone: 'neutral',
      importance: result.totalUnread > 0 ? 'elevated' : 'low',
    },
    {
      id: 'collapsed-metric:threat',
      label: 'Threat',
      value: `${Math.max(0, Math.round(result.threat.score))}`,
      rawValue: result.threat.score,
      accent: result.threat.tier === 'CRITICAL' ? 'red' : result.threat.tier === 'HIGH' ? 'amber' : 'slate',
      tone: result.threat.tier === 'CRITICAL' ? 'danger' : result.threat.tier === 'HIGH' ? 'warning' : 'neutral',
      importance: result.threat.tier === 'CRITICAL' ? 'critical' : result.threat.tier === 'HIGH' ? 'high' : 'normal',
    },
    {
      id: 'collapsed-metric:online',
      label: 'Visible',
      value: String(result.presence.onlineCount),
      rawValue: result.presence.onlineCount,
      accent: 'cyan',
      tone: 'neutral',
      importance: result.presence.onlineCount > 0 ? 'normal' : 'low',
    },
  ];
}

function buildDefaultActions(
  result: UseUnifiedChatResult,
  options: CollapsedPillAdapterOptions,
): readonly ChatUiCollapsedPillAction[] {
  const actions: ChatUiCollapsedPillAction[] = [
    {
      id: 'collapsed-action:toggle',
      label: result.collapsed ? 'Expand' : 'Collapse',
      icon: result.collapsed ? '↗' : '↘',
      kind: 'toggle',
      primary: false,
      accent: 'silver',
      tone: 'neutral',
    },
  ];

  if (result.helperPrompt?.ctaLabel) {
    actions.push({
      id: 'collapsed-action:helper',
      label: result.helperPrompt.ctaLabel,
      icon: '✦',
      kind: 'cta',
      primary: true,
      accent: 'emerald',
      tone: 'supportive',
      tooltip: result.helperPrompt.body,
    });
  }

  if (options.invasionOverride?.active) {
    actions.push({
      id: 'collapsed-action:invasion',
      label: 'Open live threat',
      icon: '⚠',
      kind: 'cta',
      primary: true,
      accent: 'red',
      tone: 'danger',
      tooltip: options.invasionOverride.tooltip,
    });
  }

  return cap(options.actions ?? actions, options.actionLimit) ?? (options.actions ?? actions);
}

export function buildCollapsedPillViewModelFromUnifiedChat(
  result: UseUnifiedChatResult,
  options: CollapsedPillAdapterOptions = {},
): ChatUiCollapsedPillViewModel {
  const threatSummary = buildThreatSummary(result, options);
  const helperSummary = buildHelperSummary(result.helperPrompt);
  const presenceSummary = buildPresenceSummary(result, options);
  const typingSummary = buildTypingSummary(result);
  const invasionSummary = buildInvasionSummary(options);
  const accent = deriveAccent(result, options, threatSummary.band ?? 'quiet');
  const tone = deriveTone(result, options, threatSummary.band ?? 'quiet');
  const connectionLabel = options.connectionLabel ?? result.connectionState;

  const channelSummaries = result.channels.map((summary) => buildChannelSummary(summary, result));

  return buildCollapsedPillViewModel({
    id: options.id ?? 'chat-collapsed-pill',
    icon: channelIcon(result.activeChannel),
    label: options.label ?? result.activeSummary.label,
    shortLabel: options.shortLabel ?? result.activeSummary.label,
    unreadCount: result.totalUnread,
    mentionCount: 0,
    threatBand: threatSummary.band,
    typingCount: typingSummary.count,
    presenceCount: result.presence.onlineCount,
    helperVisible: helperSummary.visible,
    invasionActive: invasionSummary.active,
    accent,
    tone,
    expanded: !result.collapsed,
    tooltip: options.tooltip ?? result.activeSummary.latestPreview,
    roomLabel: options.roomLabel ?? result.activeSummary.label,
    roomSubtitle: options.roomSubtitle ?? result.activeSummary.latestPreview,
    channelLabel: options.channelLabel ?? result.activeSummary.label,
    mountLabel: options.mountLabel ?? result.mountState?.mountTarget,
    liveLabel: options.liveLabel,
    connectionLabel,
    statusLine: [
      result.totalUnread > 0 ? `${result.totalUnread} unread` : 'No unread',
      threatSummary.label,
      presenceSummary.label,
    ]
      .filter(Boolean)
      .join(' • '),
    pinned: Boolean(options.pinned ?? result.isPinned),
    muted: Boolean(options.muted),
    disabled: false,
    attention:
      options.attention ??
      (invasionSummary.active
        ? 'critical'
        : result.threat.tier === 'CRITICAL'
          ? 'critical'
          : result.helperPrompt
            ? 'high'
            : 'normal'),
    presenceSummary,
    typingSummary,
    threatSummary,
    helperSummary,
    invasionSummary,
    channelSummaries: cap(channelSummaries, options.channelLimit) ?? channelSummaries,
    chips: cap(options.chips ?? buildDefaultChips(result), options.chipLimit),
    metrics: cap(options.metrics ?? buildDefaultMetrics(result), options.metricLimit),
    statusPills: buildStatusPills(result, options),
    actions: buildDefaultActions(result, options),
  });
}

export default buildCollapsedPillViewModelFromUnifiedChat;
