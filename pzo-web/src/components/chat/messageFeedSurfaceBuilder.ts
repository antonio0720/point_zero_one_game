import type {
  ChatChannel,
  ChatMessage,
  ChatThreatSnapshot,
  GameChatContext,
} from './chatTypes';
import type {
  ChatUiAccent,
  ChatUiAttachment,
  ChatUiAuthorDisposition,
  ChatUiAuthorModel,
  ChatUiBadge,
  ChatUiChip,
  ChatUiDensity,
  ChatUiDisplayHints,
  ChatUiDisplayIntent,
  ChatUiEmphasis,
  ChatUiFeedRow,
  ChatUiFeedViewModel,
  ChatUiIntegrityBand,
  ChatUiIntegrityMeta,
  ChatUiMessageBodyModel,
  ChatUiMessageCardViewModel,
  ChatUiMessageKind,
  ChatUiProofBand,
  ChatUiProofMeta,
  ChatUiSourceKind,
  ChatUiTextBlock,
  ChatUiTextSpan,
  ChatUiThreatBand,
  ChatUiThreatMeta,
  MessageCardActionViewModel,
} from './uiTypes';

/**
 * ==========================================================================
 * POINT ZERO ONE — MESSAGE FEED SURFACE BUILDER
 * FILE: pzo-web/src/components/chat/messageFeedSurfaceBuilder.ts
 * VERSION: 1.0.0
 * AUTHOR: OpenAI
 * LICENSE: Internal / Project Use Only
 * ==========================================================================
 *
 * Migration adapter that normalizes legacy ChatMessage[] into thin-shell feed
 * and card view models. This file may read the compatibility lane during
 * migration, but the resulting output is the only shape allowed into
 * ChatMessageFeed.tsx and ChatMessageCard.tsx.
 * ==========================================================================
 */

export interface BuildMessageFeedSurfaceOptions {
  activeChannel: ChatChannel;
  messages: readonly ChatMessage[];
  unreadCount?: number;
  currentUserId?: string;
  newestFirst?: boolean;
  density?: ChatUiDensity;
  transcriptLocked?: boolean;
  hasOlder?: boolean;
  hasNewer?: boolean;
  ctx?: GameChatContext;
  threatSnapshot?: ChatThreatSnapshot | null;
}

export interface BuildMessageFeedSurfaceResult {
  feed: ChatUiFeedViewModel;
  actionsByMessageId: Record<string, MessageCardActionViewModel[]>;
}

function toChannelKind(channel: ChatChannel) {
  switch (channel) {
    case 'GLOBAL': return 'global' as const;
    case 'SYNDICATE': return 'syndicate' as const;
    case 'DEAL_ROOM': return 'deal_room' as const;
    default: return 'unknown' as const;
  }
}

function toMessageKind(message: ChatMessage): ChatUiMessageKind {
  switch (message.kind) {
    case 'SYSTEM': return 'system_notice';
    case 'BOT_TAUNT':
    case 'BOT_ATTACK': return 'threat_event';
    case 'SHIELD_EVENT':
    case 'CASCADE_ALERT': return 'threat_event';
    case 'DEAL_RECAP': return 'deal_event';
    case 'ACHIEVEMENT': return 'legend_event';
    default: return 'text';
  }
}

function toDisplayIntent(message: ChatMessage): ChatUiDisplayIntent {
  if (message.kind === 'SYSTEM') return 'system';
  if (message.kind === 'BOT_TAUNT' || message.kind === 'BOT_ATTACK') return 'threat';
  if (message.kind === 'SHIELD_EVENT' || message.kind === 'CASCADE_ALERT') return 'alert';
  if (message.kind === 'DEAL_RECAP' || message.channel === 'DEAL_ROOM') return 'deal';
  if (message.kind === 'ACHIEVEMENT') return 'celebration';
  return 'default';
}

function toAccent(message: ChatMessage): ChatUiAccent {
  if (message.kind === 'BOT_TAUNT' || message.kind === 'BOT_ATTACK') return 'red';
  if (message.kind === 'SHIELD_EVENT') return 'cyan';
  if (message.kind === 'CASCADE_ALERT') return 'violet';
  if (message.kind === 'DEAL_RECAP' || message.channel === 'DEAL_ROOM') return 'gold';
  if (message.kind === 'ACHIEVEMENT') return 'emerald';
  if (message.kind === 'SYSTEM') return 'indigo';
  if (message.senderId === 'self') return 'silver';
  return message.channel === 'SYNDICATE' ? 'indigo' : 'obsidian';
}

function toTone(message: ChatMessage) {
  if (message.kind === 'BOT_TAUNT' || message.kind === 'BOT_ATTACK') return 'hostile' as const;
  if (message.kind === 'SHIELD_EVENT' || message.kind === 'CASCADE_ALERT') return 'warning' as const;
  if (message.kind === 'DEAL_RECAP') return 'premium' as const;
  if (message.kind === 'ACHIEVEMENT') return 'celebratory' as const;
  if (message.kind === 'SYSTEM') return 'supportive' as const;
  return message.senderId === 'self' ? 'neutral' as const : 'calm' as const;
}

function toEmphasis(message: ChatMessage): ChatUiEmphasis {
  if (message.kind === 'BOT_ATTACK') return 'hero';
  if (message.kind === 'CASCADE_ALERT' || message.kind === 'SHIELD_EVENT') return 'strong';
  if (message.kind === 'SYSTEM') return 'standard';
  return 'subtle';
}

function toSourceKind(message: ChatMessage): ChatUiSourceKind {
  if (message.senderId === 'self') return 'self';
  if (message.kind === 'SYSTEM') return 'system';
  if (message.kind === 'BOT_TAUNT' || message.kind === 'BOT_ATTACK') return 'hater';
  if (message.kind === 'DEAL_RECAP') return 'deal_room';
  return 'player';
}

function toDisposition(message: ChatMessage): ChatUiAuthorDisposition {
  if (message.kind === 'BOT_TAUNT' || message.kind === 'BOT_ATTACK') return 'hostile';
  if (message.kind === 'SYSTEM') return 'systemic';
  if (message.channel === 'DEAL_ROOM') return 'predatory';
  if (message.senderId === 'self') return 'friendly';
  return 'neutral';
}

function timestampMeta(ts: number) {
  const date = new Date(ts || Date.now());
  return {
    unixMs: ts,
    iso: date.toISOString(),
    absoluteLabel: date.toLocaleString(),
    relativeLabel: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    displayLabel: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    bucketKey: date.toDateString(),
  };
}

function threatBandFromMessage(message: ChatMessage): ChatUiThreatBand {
  if (message.kind === 'BOT_ATTACK') return 'critical';
  if (message.kind === 'BOT_TAUNT') return 'hostile';
  if (message.kind === 'CASCADE_ALERT') return 'pressured';
  if (message.kind === 'SHIELD_EVENT') return 'elevated';
  return 'quiet';
}

function proofBandFromMessage(message: ChatMessage): ChatUiProofBand {
  if (message.proofMeta?.verified || message.immutable) return 'verified';
  if (message.proofHash) return 'linked';
  return 'none';
}

function integrityBandFromMessage(message: ChatMessage, transcriptLocked?: boolean): ChatUiIntegrityBand {
  if (message.moderationState === 'SHADOWED') return 'shadowed';
  if (transcriptLocked || message.immutable) return 'sealed';
  if (message.moderationState === 'FILTERED') return 'guarded';
  return 'open';
}

function buildProofMeta(message: ChatMessage): ChatUiProofMeta | undefined {
  if (!message.proofHash && !message.proofMeta && !message.immutable) return undefined;
  return {
    proofId: message.id,
    proofBand: proofBandFromMessage(message),
    proofHashLabel: message.proofHash ? `#${message.proofHash.slice(0, 16)}` : undefined,
    proofChainDepth: message.proofMeta?.chainDepth,
    proofSummary: message.proofMeta?.summary,
    causalParents: message.proofMeta?.causalParents,
    verified: Boolean(message.proofMeta?.verified || message.immutable),
  };
}

function buildThreatMeta(message: ChatMessage): ChatUiThreatMeta | undefined {
  if (!message.pressureTier && !message.tickTier && message.kind !== 'BOT_TAUNT' && message.kind !== 'BOT_ATTACK' && message.kind !== 'CASCADE_ALERT' && message.kind !== 'SHIELD_EVENT') {
    return undefined;
  }
  return {
    band: threatBandFromMessage(message),
    pressureTier: message.pressureTier,
    tickTier: message.tickTier,
    attackTypeLabel: message.botSource,
    dangerSummary: message.kind.replace(/_/g, ' '),
    imminent: message.kind === 'BOT_ATTACK',
  };
}

function buildIntegrityMeta(message: ChatMessage, transcriptLocked?: boolean): ChatUiIntegrityMeta {
  const band = integrityBandFromMessage(message, transcriptLocked);
  return {
    band,
    visibilityLabel: band === 'sealed' ? 'TRANSCRIPT LOCKED' : band === 'shadowed' ? 'SHADOWED' : 'VISIBLE',
    moderationLabel: message.moderationDecision ?? message.moderationState,
    roomLockLabel: transcriptLocked || message.immutable ? 'LOCKED' : undefined,
    shadowed: band === 'shadowed',
    redacted: message.moderationState === 'REDACTED',
    edited: message.moderationState === 'EDITED',
  };
}

function splitBody(body: string): ChatUiTextBlock[] {
  return String(body || '')
    .split(/\n+/)
    .filter(Boolean)
    .map((line, index) => ({
      id: `block-${index}`,
      kind: index === 0 ? 'body' : 'caption',
      spans: [{ id: `span-${index}`, text: line } satisfies ChatUiTextSpan],
    }));
}

function buildAttachments(message: ChatMessage): ChatUiAttachment[] | undefined {
  const attachments: ChatUiAttachment[] = [];
  if (message.legendMeta?.title) {
    attachments.push({ id: `${message.id}-legend`, kind: 'legend', label: message.legendMeta.title, subtitle: message.legendMeta.subtitle, description: message.legendMeta.description, accent: 'emerald', tone: 'celebratory', actionable: true });
  }
  if (message.negotiationState?.offerLabel) {
    attachments.push({ id: `${message.id}-offer`, kind: 'deal_offer', label: message.negotiationState.offerLabel, subtitle: message.negotiationState.counterpartyLabel, description: message.negotiationState.postureLabel, accent: 'gold', tone: 'premium', actionable: true });
  }
  if (message.replayMeta?.windowLabel) {
    attachments.push({ id: `${message.id}-replay`, kind: 'system_card', label: message.replayMeta.windowLabel, subtitle: message.replayMeta.anchorLabel, description: message.replayMeta.summary, accent: 'indigo', tone: 'supportive', actionable: true });
  }
  return attachments.length ? attachments : undefined;
}

function buildChips(message: ChatMessage): ChatUiChip[] {
  const chips: ChatUiChip[] = [];
  if (message.pressureTier) chips.push({ id: `${message.id}-pressure`, label: String(message.pressureTier), accent: 'amber', tone: 'warning' });
  if (message.tickTier) chips.push({ id: `${message.id}-tick`, label: String(message.tickTier), accent: 'cyan', tone: 'calm' });
  if (message.render?.badgeText?.length) {
    message.render.badgeText.forEach((value, index) => chips.push({ id: `${message.id}-render-${index}`, label: value, accent: 'obsidian', tone: 'ghost' }));
  }
  if (message.relationshipState?.rivalryLabel) chips.push({ id: `${message.id}-rivalry`, label: message.relationshipState.rivalryLabel, accent: 'rose', tone: 'dramatic' });
  return chips;
}

function buildBadges(message: ChatMessage): ChatUiBadge[] {
  const badges: ChatUiBadge[] = [];
  if (message.kind === 'BOT_ATTACK') badges.push({ id: `${message.id}-attack`, kind: 'threat', label: 'ATTACK', tone: 'danger', accent: 'red' });
  if (message.kind === 'BOT_TAUNT') badges.push({ id: `${message.id}-taunt`, kind: 'hater', label: 'TAUNT', tone: 'hostile', accent: 'rose' });
  if (message.kind === 'SYSTEM') badges.push({ id: `${message.id}-system`, kind: 'system', label: 'SYSTEM', tone: 'supportive', accent: 'indigo' });
  if (message.channel === 'DEAL_ROOM') badges.push({ id: `${message.id}-deal`, kind: 'channel', label: 'DEAL ROOM', tone: 'premium', accent: 'gold' });
  return badges;
}

export function buildMessageCardViewModelFromLegacy(
  message: ChatMessage,
  options: Pick<BuildMessageFeedSurfaceOptions, 'currentUserId' | 'transcriptLocked'>,
): ChatUiMessageCardViewModel {
  const blocks = splitBody(message.body);
  const primary = blocks[0] ?? { id: `${message.id}-body`, kind: 'body', spans: [{ id: `${message.id}-body-span`, text: message.body || '' }] };
  const secondary = blocks.slice(1);
  const accent = toAccent(message);
  const tone = toTone(message);

  const author: ChatUiAuthorModel = {
    id: message.senderId,
    displayName: message.senderName,
    shortName: message.senderName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase(),
    sourceKind: toSourceKind(message),
    disposition: toDisposition(message),
    subtitle: message.senderRank ?? message.senderRole,
    roleLabel: message.senderRole,
    factionLabel: message.channel === 'SYNDICATE' ? 'Syndicate' : message.channel === 'DEAL_ROOM' ? 'Deal Room' : undefined,
    avatar: {
      initials: message.senderName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase(),
      emoji: message.emoji,
      accent,
      presenceDot: message.deliveryState === 'FAILED' ? 'offline' : 'online',
    },
    signature: {
      personaId: message.senderId,
      voiceprintLabel: message.botSource ? String(message.botSource) : undefined,
      cadenceLabel: message.render?.surfaceClass,
      attackStyleLabel: message.botSource,
    },
    isSelf: message.senderId === options.currentUserId,
  };

  const body: ChatUiMessageBodyModel = {
    primary,
    secondary: secondary.length ? secondary : undefined,
    attachments: buildAttachments(message),
    commandHints: message.channel === 'DEAL_ROOM'
      ? [{ id: `${message.id}-counter`, command: '/counter', label: 'Counter from the deal room lane', description: 'Respond without leaving the negotiation surface.', tone: 'premium' }]
      : undefined,
  };

  const displayHints: ChatUiDisplayHints = {
    compact: false,
    highlighted: Boolean(message.render?.highlighted),
    selectable: true,
    actionable: true,
    hoverable: true,
    keyboardNavigable: true,
    truncateBody: false,
    showMetaRail: true,
    showTimestamp: true,
    showAvatar: true,
    showPersonaTag: true,
    showProofBadges: Boolean(message.proofHash || message.proofMeta),
    showThreatBadges: Boolean(message.pressureTier || message.tickTier || message.kind === 'BOT_TAUNT' || message.kind === 'BOT_ATTACK'),
    showLearningBadges: Boolean(message.learningProfile || message.memoryAnchors?.length),
  };

  return {
    id: message.id,
    sceneId: message.scenePlan?.sceneId,
    kind: toMessageKind(message),
    author,
    body,
    meta: {
      timestamp: timestampMeta(message.ts),
      proof: buildProofMeta(message),
      threat: buildThreatMeta(message),
      integrity: buildIntegrityMeta(message, options.transcriptLocked),
      channel: {
        channelId: message.channel,
        channelKind: toChannelKind(message.channel),
        channelLabel: message.channel.replace(/_/g, ' '),
        mountLabel: message.compatibility?.derivedFromFrameKind,
        reputationLabel: message.reputationState?.label,
      },
      learning: message.learningProfile || message.memoryAnchors?.length ? {
        coldStart: Boolean(message.learningProfile?.coldStart),
        helperBoost: Boolean(message.learningProfile?.helperBoost),
        engagementLabel: message.learningProfile?.engagementLabel,
        dropOffRiskLabel: message.learningProfile?.dropOffRiskLabel,
        recommendationLabel: message.learningProfile?.recommendationLabel,
        memoryHit: Boolean(message.memoryAnchors?.length),
        memoryAnchorLabel: message.memoryAnchors?.[0]?.label,
      } : undefined,
      chips: buildChips(message),
      badges: buildBadges(message),
    },
    tone,
    accent,
    emphasis: toEmphasis(message),
    displayIntent: toDisplayIntent(message),
    displayHints,
    selected: false,
    pinned: Boolean(message.render?.pinned),
    unread: Boolean(message.analytics?.unreadAtArrival),
    canReply: message.channel !== 'GLOBAL' || message.kind !== 'SYSTEM',
    canCopy: true,
    canInspectProof: Boolean(message.proofHash || message.proofMeta),
    canJumpToCause: Boolean(message.proofMeta?.causalParents?.length || message.replayMeta?.windowLabel),
    canMutePersona: message.senderId !== options.currentUserId,
    canEscalateModeration: message.moderationState !== 'APPROVED',
  };
}

function buildDayBreakRow(timestamp: number): ChatUiFeedRow {
  const date = new Date(timestamp || Date.now());
  return {
    id: `day-${date.toDateString()}`,
    kind: 'day_break',
    label: date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    timestamp: timestampMeta(timestamp),
  };
}

function buildUnreadBreakRow(count: number): ChatUiFeedRow {
  return {
    id: `unread-${count}`,
    kind: 'unread_break',
    label: 'Unread boundary',
    unreadCount: count,
  };
}

function defaultActionsForMessage(message: ChatMessage, card: ChatUiMessageCardViewModel): MessageCardActionViewModel[] {
  const actions: MessageCardActionViewModel[] = [];
  if (card.canReply) actions.push({ id: 'reply', label: 'Reply', icon: '↩', tone: 'supportive', accent: 'indigo', primary: true });
  if (card.canInspectProof) actions.push({ id: 'inspect_proof', label: 'Proof', icon: '⛭', tone: 'premium', accent: 'gold' });
  if (message.channel === 'DEAL_ROOM') actions.push({ id: 'counter', label: 'Counter', icon: '⚖', tone: 'premium', accent: 'gold' });
  if (card.canMutePersona) actions.push({ id: 'mute_persona', label: 'Mute persona', icon: '∅', tone: 'ghost', accent: 'obsidian' });
  return actions;
}

export function buildMessageFeedSurfaceModel(
  options: BuildMessageFeedSurfaceOptions,
): BuildMessageFeedSurfaceResult {
  const sorted = [...options.messages].sort((a, b) => options.newestFirst ? b.ts - a.ts : a.ts - b.ts);
  const flatRows: ChatUiFeedRow[] = [];
  const actionsByMessageId: Record<string, MessageCardActionViewModel[]> = {};
  let lastDayKey: string | null = null;

  sorted.forEach((message, index) => {
    const dayKey = new Date(message.ts || Date.now()).toDateString();
    if (dayKey !== lastDayKey) {
      flatRows.push(buildDayBreakRow(message.ts));
      lastDayKey = dayKey;
    }

    if (!options.newestFirst && options.unreadCount && index === Math.max(0, sorted.length - options.unreadCount)) {
      flatRows.push(buildUnreadBreakRow(options.unreadCount));
    }

    const card = buildMessageCardViewModelFromLegacy(message, options);
    flatRows.push(card);
    actionsByMessageId[message.id] = defaultActionsForMessage(message, card);
  });

  if (options.hasOlder) {
    flatRows.unshift({ id: 'load-older-row', kind: 'load_older', label: 'Load older transcript window', available: true, pending: false });
  }

  if (!flatRows.some((row) => row.kind !== 'load_older')) {
    flatRows.push({ id: 'empty-state', kind: 'empty_state', model: { kind: 'quiet_room', title: 'No transcript activity', body: 'This channel is quiet. The normalized feed is ready once message traffic enters the shell.' } });
  }

  return {
    feed: {
      groups: [{ id: `group-${options.activeChannel}`, channelId: options.activeChannel, rows: flatRows }],
      flatRows,
      hasOlder: Boolean(options.hasOlder),
      hasNewer: Boolean(options.hasNewer),
      unreadCount: options.unreadCount ?? 0,
      newestMessageId: sorted[sorted.length - 1]?.id,
      oldestMessageId: sorted[0]?.id,
    },
    actionsByMessageId,
  };
}
