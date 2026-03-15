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
 * ============================================================================
 * POINT ZERO ONE — MESSAGE FEED SURFACE BUILDER
 * FILE: pzo-web/src/components/chat/messageFeedSurfaceBuilder.ts
 * VERSION: 1.1.0
 * AUTHOR: OpenAI
 * LICENSE: Internal / Project Use Only
 * ============================================================================
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
    case 'GLOBAL':
      return 'global' as const;
    case 'SYNDICATE':
      return 'syndicate' as const;
    case 'DEAL_ROOM':
      return 'deal_room' as const;
    default:
      return 'unknown' as const;
  }
}

function toMessageKind(message: ChatMessage): ChatUiMessageKind {
  switch (message.kind) {
    case 'SYSTEM':
      return 'system_notice';
    case 'BOT_TAUNT':
    case 'BOT_ATTACK':
    case 'SHIELD_EVENT':
    case 'CASCADE_ALERT':
      return 'threat_event';
    case 'DEAL_RECAP':
      return 'deal_event';
    case 'ACHIEVEMENT':
      return 'legend_event';
    default:
      return 'text';
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
  if ((message as unknown as { proofMeta?: { verified?: boolean } }).proofMeta?.verified || (message as unknown as { immutable?: boolean }).immutable) return 'verified';
  if ((message as unknown as { proofHash?: string }).proofHash) return 'linked';
  return 'none';
}

function integrityBandFromMessage(message: ChatMessage, transcriptLocked?: boolean): ChatUiIntegrityBand {
  const moderationState = (message as unknown as { moderationState?: string }).moderationState;
  if (moderationState === 'SHADOWED') return 'shadowed';
  if (transcriptLocked || (message as unknown as { immutable?: boolean }).immutable) return 'sealed';
  if (moderationState === 'FILTERED') return 'guarded';
  return 'open';
}

function buildProofMeta(message: ChatMessage): ChatUiProofMeta | undefined {
  const proofHash = (message as unknown as { proofHash?: string }).proofHash;
  const proofMeta = (message as unknown as { proofMeta?: { chainDepth?: number; summary?: string; causalParents?: string[]; verified?: boolean } }).proofMeta;
  const immutable = (message as unknown as { immutable?: boolean }).immutable;
  if (!proofHash && !proofMeta && !immutable) return undefined;
  return {
    proofId: message.id,
    proofBand: proofBandFromMessage(message),
    proofHashLabel: proofHash ? `#${proofHash.slice(0, 16)}` : undefined,
    proofChainDepth: proofMeta?.chainDepth,
    proofSummary: proofMeta?.summary,
    causalParents: proofMeta?.causalParents,
    verified: Boolean(proofMeta?.verified || immutable),
  };
}

function buildThreatMeta(message: ChatMessage): ChatUiThreatMeta | undefined {
  const pressureTier = (message as unknown as { pressureTier?: string }).pressureTier;
  const tickTier = (message as unknown as { tickTier?: string }).tickTier;
  if (!pressureTier && !tickTier && !['BOT_TAUNT', 'BOT_ATTACK', 'CASCADE_ALERT', 'SHIELD_EVENT'].includes(message.kind)) return undefined;
  return {
    band: threatBandFromMessage(message),
    pressureTier,
    tickTier,
    attackTypeLabel: (message as unknown as { botSource?: string }).botSource,
    dangerSummary: message.kind.replace(/_/g, ' '),
    imminent: message.kind === 'BOT_ATTACK',
  };
}

function buildIntegrityMeta(message: ChatMessage, transcriptLocked?: boolean): ChatUiIntegrityMeta {
  const band = integrityBandFromMessage(message, transcriptLocked);
  const moderationState = (message as unknown as { moderationState?: string }).moderationState;
  const moderationDecision = (message as unknown as { moderationDecision?: string }).moderationDecision;
  return {
    band,
    visibilityLabel: band === 'sealed' ? 'TRANSCRIPT LOCKED' : band === 'shadowed' ? 'SHADOWED' : 'VISIBLE',
    moderationLabel: moderationDecision ?? moderationState,
    roomLockLabel: transcriptLocked || (message as unknown as { immutable?: boolean }).immutable ? 'LOCKED' : undefined,
    shadowed: band === 'shadowed',
    redacted: moderationState === 'REDACTED',
    edited: moderationState === 'EDITED',
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
  const legendMeta = (message as unknown as { legendMeta?: { title?: string; subtitle?: string; description?: string } }).legendMeta;
  const negotiationState = (message as unknown as { negotiationState?: { offerLabel?: string; counterpartyLabel?: string; postureLabel?: string } }).negotiationState;
  const replayMeta = (message as unknown as { replayMeta?: { windowLabel?: string; anchorLabel?: string; summary?: string } }).replayMeta;
  const attachments: ChatUiAttachment[] = [];
  if (legendMeta?.title) {
    attachments.push({ id: `${message.id}-legend`, kind: 'legend', label: legendMeta.title, subtitle: legendMeta.subtitle, description: legendMeta.description, accent: 'emerald', tone: 'celebratory', actionable: true });
  }
  if (negotiationState?.offerLabel) {
    attachments.push({ id: `${message.id}-offer`, kind: 'deal_offer', label: negotiationState.offerLabel, subtitle: negotiationState.counterpartyLabel, description: negotiationState.postureLabel, accent: 'gold', tone: 'premium', actionable: true });
  }
  if (replayMeta?.windowLabel) {
    attachments.push({ id: `${message.id}-replay`, kind: 'system_card', label: replayMeta.windowLabel, subtitle: replayMeta.anchorLabel, description: replayMeta.summary, accent: 'indigo', tone: 'supportive', actionable: true });
  }
  return attachments.length ? attachments : undefined;
}

function buildChips(message: ChatMessage): ChatUiChip[] {
  const render = (message as unknown as { render?: { badgeText?: string[] } }).render;
  const relationshipState = (message as unknown as { relationshipState?: { rivalryLabel?: string } }).relationshipState;
  const pressureTier = (message as unknown as { pressureTier?: string }).pressureTier;
  const tickTier = (message as unknown as { tickTier?: string }).tickTier;
  const chips: ChatUiChip[] = [];
  if (pressureTier) chips.push({ id: `${message.id}-pressure`, label: String(pressureTier), accent: 'amber', tone: 'warning' });
  if (tickTier) chips.push({ id: `${message.id}-tick`, label: String(tickTier), accent: 'cyan', tone: 'calm' });
  if (render?.badgeText?.length) {
    render.badgeText.forEach((value, index) => chips.push({ id: `${message.id}-render-${index}`, label: value, accent: 'obsidian', tone: 'ghost' }));
  }
  if (relationshipState?.rivalryLabel) chips.push({ id: `${message.id}-rivalry`, label: relationshipState.rivalryLabel, accent: 'rose', tone: 'dramatic' });
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
  const senderName = (message as unknown as { senderName?: string }).senderName ?? 'Unknown';
  const senderRole = (message as unknown as { senderRole?: string }).senderRole;
  const senderRank = (message as unknown as { senderRank?: string }).senderRank;
  const emoji = (message as unknown as { emoji?: string }).emoji;
  const deliveryState = (message as unknown as { deliveryState?: string }).deliveryState;
  const render = (message as unknown as { render?: { highlighted?: boolean; pinned?: boolean } }).render;
  const proofHash = (message as unknown as { proofHash?: string }).proofHash;
  const proofMeta = (message as unknown as { proofMeta?: unknown }).proofMeta;
  const learningProfile = (message as unknown as { learningProfile?: { coldStart?: boolean; helperBoost?: boolean; engagementLabel?: string; dropOffRiskLabel?: string; recommendationLabel?: string } }).learningProfile;
  const memoryAnchors = (message as unknown as { memoryAnchors?: Array<{ label?: string }> }).memoryAnchors;
  const analytics = (message as unknown as { analytics?: { unreadAtArrival?: boolean } }).analytics;
  const scenePlan = (message as unknown as { scenePlan?: { sceneId?: string } }).scenePlan;
  const compatibility = (message as unknown as { compatibility?: { derivedFromFrameKind?: string } }).compatibility;
  const reputationState = (message as unknown as { reputationState?: { label?: string } }).reputationState;

  const author: ChatUiAuthorModel = {
    id: message.senderId,
    displayName: senderName,
    shortName: senderName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase(),
    sourceKind: toSourceKind(message),
    disposition: toDisposition(message),
    subtitle: senderRank ?? senderRole,
    roleLabel: senderRole,
    factionLabel: message.channel === 'SYNDICATE' ? 'Syndicate' : message.channel === 'DEAL_ROOM' ? 'Deal Room' : undefined,
    avatar: {
      initials: senderName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase(),
      emoji,
      accent,
      presenceDot: deliveryState === 'FAILED' ? 'offline' : 'online',
    },
    signature: {
      personaId: message.senderId,
      voiceprintLabel: (message as unknown as { botSource?: string }).botSource,
      cadenceLabel: (message as unknown as { render?: { surfaceClass?: string } }).render?.surfaceClass,
      attackStyleLabel: (message as unknown as { botSource?: string }).botSource,
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
    highlighted: Boolean(render?.highlighted),
    selectable: true,
    actionable: true,
    hoverable: true,
    keyboardNavigable: true,
    truncateBody: false,
    showMetaRail: true,
    showTimestamp: true,
    showAvatar: true,
    showPersonaTag: true,
    showProofBadges: Boolean(proofHash || proofMeta),
    showThreatBadges: Boolean((message as unknown as { pressureTier?: string }).pressureTier || (message as unknown as { tickTier?: string }).tickTier || message.kind === 'BOT_TAUNT' || message.kind === 'BOT_ATTACK'),
    showLearningBadges: Boolean(learningProfile || memoryAnchors?.length),
  };

  return {
    id: message.id,
    sceneId: scenePlan?.sceneId,
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
        mountLabel: compatibility?.derivedFromFrameKind,
        reputationLabel: reputationState?.label,
      },
      learning: learningProfile || memoryAnchors?.length ? {
        coldStart: Boolean(learningProfile?.coldStart),
        helperBoost: Boolean(learningProfile?.helperBoost),
        engagementLabel: learningProfile?.engagementLabel,
        dropOffRiskLabel: learningProfile?.dropOffRiskLabel,
        recommendationLabel: learningProfile?.recommendationLabel,
        memoryHit: Boolean(memoryAnchors?.length),
        memoryAnchorLabel: memoryAnchors?.[0]?.label,
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
    pinned: Boolean(render?.pinned),
    unread: Boolean(analytics?.unreadAtArrival),
    canReply: message.channel !== 'GLOBAL' || message.kind !== 'SYSTEM',
    canCopy: true,
    canInspectProof: Boolean(proofHash || proofMeta),
    canJumpToCause: Boolean((message as unknown as { proofMeta?: { causalParents?: string[] } }).proofMeta?.causalParents?.length || (message as unknown as { replayMeta?: { windowLabel?: string } }).replayMeta?.windowLabel),
    canMutePersona: message.senderId !== options.currentUserId,
    canEscalateModeration: (message as unknown as { moderationState?: string }).moderationState !== 'APPROVED',
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

export function buildMessageFeedSurfaceModel(options: BuildMessageFeedSurfaceOptions): BuildMessageFeedSurfaceResult {
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
    flatRows.push({ id: 'empty-state', kind: 'empty_state', model: { id: 'empty-state-model', kind: 'quiet_room', title: 'No transcript activity', body: 'This channel is quiet. The normalized feed is ready once message traffic enters the shell.', tone: 'neutral', accent: 'slate' } });
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
