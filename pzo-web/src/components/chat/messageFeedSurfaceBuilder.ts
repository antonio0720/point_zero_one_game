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
import { CHAT_UI_DEFAULT_DISPLAY_HINTS } from './uiTypes';
import type { ChatChannel, ChatMessage, ChatThreatSnapshot, GameChatContext } from './chatTypes';

/**
 * ============================================================================
 * POINT ZERO ONE — MESSAGE FEED SURFACE BUILDER
 * FILE: pzo-web/src/components/chat/messageFeedSurfaceBuilder.ts
 * VERSION: 1.1.0
 * AUTHOR: OpenAI
 * LICENSE: Internal / Project Use Only
 * ============================================================================
 *
 * Migration adapter that normalizes legacy ChatMessage[] into thin-shell feed
 * and card view models. This merged version keeps the richer metadata/chip/
 * attachment shaping from the older builder while staying aligned with the
 * current uiTypes.ts, useUnifiedChat.ts, and UnifiedChatDock.tsx contracts.
 * ============================================================================
 */

export interface BuildMessageFeedSurfaceParams {
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
  actionsByMessageId: Record<string, readonly MessageCardActionViewModel[]>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return fallback;
}

function maybeString(value: unknown): string | undefined {
  const next = asString(value, '').trim();
  return next.length > 0 ? next : undefined;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function isTruthy<T>(value: T | null | undefined | false): value is T {
  return Boolean(value);
}

function channelKind(channel: ChatChannel) {
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

function channelLabel(channel: ChatChannel): string {
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

function messageKind(message: ChatMessage): ChatUiMessageKind {
  switch (message.kind) {
    case 'SYSTEM':
      return 'system_notice';
    case 'BOT_TAUNT':
    case 'BOT_ATTACK':
    case 'MARKET_ALERT':
      return 'threat_event';
    case 'SHIELD_EVENT':
    case 'CASCADE_ALERT':
      return 'proof_event';
    case 'DEAL_RECAP':
      return 'deal_event';
    case 'ACHIEVEMENT':
      return 'legend_event';
    default:
      return 'text';
  }
}

function sourceKind(message: ChatMessage, currentUserId?: string): ChatUiSourceKind {
  const raw = asRecord(message as unknown);
  const senderId = asString(raw.senderId, '');
  if (currentUserId && senderId === currentUserId) return 'self';
  if (senderId === 'player-local' || senderId === 'self') return 'self';
  if (message.kind === 'SYSTEM') return 'system';
  if (message.kind === 'BOT_TAUNT' || message.kind === 'BOT_ATTACK') return 'hater';
  if (message.kind === 'DEAL_RECAP') return 'deal_room';
  return 'player';
}

function authorDisposition(message: ChatMessage): ChatUiAuthorDisposition {
  if (message.kind === 'BOT_TAUNT' || message.kind === 'BOT_ATTACK') return 'hostile';
  if (message.kind === 'SYSTEM') return 'systemic';
  if (message.channel === 'DEAL_ROOM') return 'predatory';
  return 'neutral';
}

function accentForMessage(message: ChatMessage): ChatUiAccent {
  if (message.kind === 'BOT_ATTACK') return 'red';
  if (message.kind === 'BOT_TAUNT') return 'rose';
  if (message.kind === 'SHIELD_EVENT') return 'cyan';
  if (message.kind === 'CASCADE_ALERT') return 'violet';
  if (message.kind === 'DEAL_RECAP' || message.channel === 'DEAL_ROOM') return 'gold';
  if (message.kind === 'ACHIEVEMENT') return 'emerald';
  if (message.kind === 'SYSTEM') return 'indigo';
  if (message.channel === 'SYNDICATE') return 'cyan';
  if (message.channel === 'GLOBAL') return 'silver';
  return 'slate';
}

function toneForMessage(message: ChatMessage) {
  if (message.kind === 'BOT_ATTACK') return 'danger' as const;
  if (message.kind === 'BOT_TAUNT') return 'hostile' as const;
  if (message.kind === 'CASCADE_ALERT' || message.kind === 'MARKET_ALERT' || message.kind === 'SHIELD_EVENT') return 'warning' as const;
  if (message.kind === 'DEAL_RECAP') return 'premium' as const;
  if (message.kind === 'ACHIEVEMENT') return 'celebratory' as const;
  if (message.kind === 'SYSTEM') return 'supportive' as const;
  return message.senderId === 'self' || message.senderId === 'player-local' ? 'neutral' as const : 'calm' as const;
}

function emphasisForMessage(message: ChatMessage): ChatUiEmphasis {
  if (message.kind === 'BOT_ATTACK') return 'hero';
  if (message.kind === 'CASCADE_ALERT' || message.kind === 'SHIELD_EVENT' || message.kind === 'DEAL_RECAP') return 'strong';
  return 'subtle';
}

function displayIntent(message: ChatMessage): ChatUiDisplayIntent {
  if (message.kind === 'SYSTEM') return 'system';
  if (message.kind === 'BOT_TAUNT' || message.kind === 'BOT_ATTACK' || message.kind === 'MARKET_ALERT') return 'threat';
  if (message.kind === 'SHIELD_EVENT' || message.kind === 'CASCADE_ALERT') return 'alert';
  if (message.kind === 'DEAL_RECAP' || message.channel === 'DEAL_ROOM') return 'deal';
  if (message.kind === 'ACHIEVEMENT') return 'celebration';
  return 'default';
}

function threatBandForMessage(message: ChatMessage, threatSnapshot?: ChatThreatSnapshot | null): ChatUiThreatBand | undefined {
  if (message.kind === 'BOT_ATTACK') return 'critical';
  if (message.kind === 'BOT_TAUNT') return 'hostile';
  if (message.kind === 'CASCADE_ALERT') return 'pressured';
  if (message.kind === 'SHIELD_EVENT') return 'elevated';
  if (threatSnapshot?.band === 'SEVERE') return 'critical';
  if (threatSnapshot?.band === 'HIGH') return 'hostile';
  if (threatSnapshot?.band === 'ELEVATED') return 'pressured';
  return undefined;
}

function proofBandForMessage(message: ChatMessage): ChatUiProofBand {
  const raw = asRecord(message as unknown);
  if (raw.immutable === true || raw.proofVerified === true) return 'verified';
  if (maybeString(raw.proofHash)) return 'linked';
  return 'none';
}

function integrityBandForMessage(message: ChatMessage, transcriptLocked?: boolean): ChatUiIntegrityBand {
  const raw = asRecord(message as unknown);
  const moderationState = asString(raw.moderationState, '');
  if (moderationState === 'SHADOWED') return 'shadowed';
  if (moderationState === 'FILTERED') return 'guarded';
  if (transcriptLocked || raw.immutable === true) return 'sealed';
  return 'open';
}

function timestampMeta(ts: number) {
  const date = new Date(ts || Date.now());
  return {
    unixMs: ts,
    iso: ts ? date.toISOString() : undefined,
    absoluteLabel: ts ? date.toLocaleString() : undefined,
    relativeLabel: ts ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
    displayLabel: ts ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
    bucketKey: date.toDateString(),
  };
}

function splitBodyToBlocks(messageId: string, body: string): ChatUiTextBlock[] {
  const lines = String(body || '').split(/\n+/).filter(Boolean);
  if (lines.length === 0) {
    return [{
      id: `${messageId}:body:0`,
      kind: 'body',
      spans: [{ id: `${messageId}:span:0`, text: '' } satisfies ChatUiTextSpan],
    }];
  }

  return lines.map((line, index) => ({
    id: `${messageId}:body:${index}`,
    kind: index === 0 ? 'body' : 'caption',
    spans: [{ id: `${messageId}:span:${index}`, text: line } satisfies ChatUiTextSpan],
  }));
}

function buildAttachments(message: ChatMessage): ChatUiAttachment[] | undefined {
  const raw = asRecord(message as unknown);
  const attachments: ChatUiAttachment[] = [];

  const legendMeta = asRecord(raw.legendMeta);
  if (maybeString(legendMeta.title)) {
    attachments.push({
      id: `${message.id}:attachment:legend`,
      kind: 'legend',
      label: asString(legendMeta.title),
      subtitle: maybeString(legendMeta.subtitle),
      description: maybeString(legendMeta.description),
      accent: 'emerald',
      tone: 'celebratory',
      actionable: true,
    });
  }

  const negotiationState = asRecord(raw.negotiationState);
  if (maybeString(negotiationState.offerLabel)) {
    attachments.push({
      id: `${message.id}:attachment:offer`,
      kind: 'deal_offer',
      label: asString(negotiationState.offerLabel),
      subtitle: maybeString(negotiationState.counterpartyLabel),
      description: maybeString(negotiationState.postureLabel),
      accent: 'gold',
      tone: 'premium',
      actionable: true,
    });
  }

  const replayMeta = asRecord(raw.replayMeta);
  if (maybeString(replayMeta.windowLabel)) {
    attachments.push({
      id: `${message.id}:attachment:replay`,
      kind: 'system_card',
      label: asString(replayMeta.windowLabel),
      subtitle: maybeString(replayMeta.anchorLabel),
      description: maybeString(replayMeta.summary),
      accent: 'indigo',
      tone: 'supportive',
      actionable: true,
    });
  }

  return attachments.length > 0 ? attachments : undefined;
}

function buildChips(message: ChatMessage): ChatUiChip[] | undefined {
  const raw = asRecord(message as unknown);
  const chips: ChatUiChip[] = [];

  if (maybeString(raw.pressureTier)) {
    chips.push({ id: `${message.id}:chip:pressure`, label: asString(raw.pressureTier), shortLabel: asString(raw.pressureTier), accent: 'amber', tone: 'warning', active: true });
  }
  if (maybeString(raw.tickTier)) {
    chips.push({ id: `${message.id}:chip:tick`, label: asString(raw.tickTier), shortLabel: asString(raw.tickTier), accent: 'cyan', tone: 'calm', active: true });
  }
  const render = asRecord(raw.render);
  const badgeText = Array.isArray(render.badgeText) ? render.badgeText : [];
  badgeText.forEach((value, index) => {
    const label = maybeString(value);
    if (label) {
      chips.push({ id: `${message.id}:chip:render:${index}`, label, shortLabel: label, accent: 'obsidian', tone: 'ghost', active: true });
    }
  });

  const relationshipState = asRecord(raw.relationshipState);
  if (maybeString(relationshipState.rivalryLabel)) {
    chips.push({ id: `${message.id}:chip:rivalry`, label: asString(relationshipState.rivalryLabel), shortLabel: asString(relationshipState.rivalryLabel), accent: 'rose', tone: 'dramatic', active: true });
  }

  return chips.length > 0 ? chips : undefined;
}

function buildBadges(message: ChatMessage): ChatUiBadge[] | undefined {
  const badges: ChatUiBadge[] = [];
  if (message.kind === 'BOT_ATTACK') badges.push({ id: `${message.id}:badge:attack`, kind: 'threat', label: 'ATTACK', tone: 'danger', accent: 'red' });
  if (message.kind === 'BOT_TAUNT') badges.push({ id: `${message.id}:badge:taunt`, kind: 'hater', label: 'TAUNT', tone: 'hostile', accent: 'rose' });
  if (message.kind === 'SYSTEM') badges.push({ id: `${message.id}:badge:system`, kind: 'system', label: 'SYSTEM', tone: 'supportive', accent: 'indigo' });
  if (message.channel === 'DEAL_ROOM') badges.push({ id: `${message.id}:badge:deal`, kind: 'channel', label: 'DEAL ROOM', tone: 'premium', accent: 'gold' });
  return badges.length > 0 ? badges : undefined;
}

function buildProofMeta(message: ChatMessage): ChatUiProofMeta | undefined {
  const raw = asRecord(message as unknown);
  const proofHash = maybeString(raw.proofHash);
  const proofMeta = asRecord(raw.proofMeta);
  if (!proofHash && Object.keys(proofMeta).length === 0 && raw.immutable !== true) return undefined;

  return {
    proofId: message.id,
    proofBand: proofBandForMessage(message),
    proofHashLabel: proofHash ? `#${proofHash.slice(0, 16)}` : undefined,
    proofChainDepth: asNumber(proofMeta.chainDepth, 0) || undefined,
    proofSummary: maybeString(proofMeta.summary),
    causalParents: Array.isArray(proofMeta.causalParents)
      ? proofMeta.causalParents.map((value) => asString(value)).filter(Boolean)
      : undefined,
    verified: raw.immutable === true || proofMeta.verified === true,
  };
}

function buildThreatMeta(message: ChatMessage, threatSnapshot?: ChatThreatSnapshot | null): ChatUiThreatMeta | undefined {
  const raw = asRecord(message as unknown);
  const band = threatBandForMessage(message, threatSnapshot);
  if (!band && !maybeString(raw.pressureTier) && !maybeString(raw.tickTier)) return undefined;

  return {
    band: band ?? 'quiet',
    score: undefined,
    pressureTier: maybeString(raw.pressureTier),
    tickTier: maybeString(raw.tickTier),
    attackTypeLabel: maybeString(asRecord(raw.botSource).attackType),
    dangerSummary: message.kind.replace(/_/g, ' '),
    imminent: message.kind === 'BOT_ATTACK',
  };
}

function buildIntegrityMeta(message: ChatMessage, transcriptLocked?: boolean): ChatUiIntegrityMeta {
  const raw = asRecord(message as unknown);
  const band = integrityBandForMessage(message, transcriptLocked);
  return {
    band,
    visibilityLabel: band === 'sealed' ? 'TRANSCRIPT LOCKED' : band === 'shadowed' ? 'SHADOWED' : 'VISIBLE',
    moderationLabel: maybeString(raw.moderationDecision ?? raw.moderationState),
    roomLockLabel: transcriptLocked || raw.immutable === true ? 'LOCKED' : undefined,
    shadowed: band === 'shadowed',
    redacted: raw.moderationState === 'REDACTED',
    edited: raw.moderationState === 'EDITED',
  };
}

function buildAuthor(message: ChatMessage, currentUserId?: string): ChatUiAuthorModel {
  const raw = asRecord(message as unknown);
  const senderName = asString(raw.senderName, 'Unknown');
  const accent = accentForMessage(message);
  return {
    id: asString(raw.senderId, 'unknown'),
    displayName: senderName,
    shortName: senderName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase(),
    sourceKind: sourceKind(message, currentUserId),
    disposition: authorDisposition(message),
    subtitle: maybeString(raw.senderRank ?? raw.senderRole),
    roleLabel: maybeString(raw.senderRole ?? raw.senderRank),
    factionLabel: message.channel === 'SYNDICATE' ? 'Syndicate' : message.channel === 'DEAL_ROOM' ? 'Deal Room' : undefined,
    avatar: {
      initials: senderName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase(),
      emoji: maybeString(raw.emoji),
      accent,
      presenceDot: raw.deliveryState === 'FAILED' ? 'offline' : 'online',
    },
    signature: {
      personaId: asString(raw.senderId, 'unknown'),
      voiceprintLabel: maybeString(asRecord(raw.botSource).botState),
      cadenceLabel: maybeString(asRecord(raw.render).surfaceClass),
      attackStyleLabel: maybeString(asRecord(raw.botSource).attackType),
    },
    isSelf: currentUserId ? asString(raw.senderId, '') === currentUserId : asString(raw.senderId, '') === 'player-local',
  };
}

function buildBody(message: ChatMessage): ChatUiMessageBodyModel {
  const blocks = splitBodyToBlocks(message.id, message.body || '');
  const raw = asRecord(message as unknown);
  const quote = asRecord(raw.quote);
  return {
    primary: blocks[0],
    secondary: blocks.length > 1 ? blocks.slice(1) : undefined,
    quote: maybeString(quote.text)
      ? {
          messageId: maybeString(quote.messageId),
          authorLabel: maybeString(quote.authorLabel),
          channelLabel: maybeString(quote.channelLabel),
          text: asString(quote.text),
          tone: 'neutral',
          accent: 'slate',
        }
      : undefined,
    attachments: buildAttachments(message),
    commandHints: message.channel === 'DEAL_ROOM'
      ? [{ id: `${message.id}:hint:counter`, command: '/counter', label: 'Counter from the deal room lane', description: 'Respond without leaving the negotiation surface.', tone: 'premium' }]
      : undefined,
  };
}

function buildDisplayHints(message: ChatMessage): ChatUiDisplayHints {
  const raw = asRecord(message as unknown);
  const render = asRecord(raw.render);
  return {
    ...CHAT_UI_DEFAULT_DISPLAY_HINTS,
    compact: false,
    highlighted: Boolean(render.highlighted),
    selectable: true,
    actionable: true,
    hoverable: true,
    keyboardNavigable: true,
    truncateBody: false,
    showMetaRail: true,
    showTimestamp: true,
    showAvatar: true,
    showPersonaTag: true,
    showProofBadges: Boolean(maybeString(raw.proofHash) || raw.proofMeta),
    showThreatBadges: Boolean(maybeString(raw.pressureTier) || maybeString(raw.tickTier) || message.kind === 'BOT_TAUNT' || message.kind === 'BOT_ATTACK'),
    showLearningBadges: Boolean(raw.learningProfile || (Array.isArray(raw.memoryAnchors) && raw.memoryAnchors.length > 0)),
  };
}

export function buildMessageCardViewModelFromLegacy(
  message: ChatMessage,
  options: Pick<BuildMessageFeedSurfaceParams, 'currentUserId' | 'transcriptLocked' | 'threatSnapshot'>,
): ChatUiMessageCardViewModel {
  const raw = asRecord(message as unknown);
  const accent = accentForMessage(message);
  const tone = toneForMessage(message);

  return {
    id: message.id,
    sceneId: maybeString(asRecord(raw.scenePlan).sceneId),
    runId: maybeString(raw.runId),
    kind: messageKind(message),
    author: buildAuthor(message, options.currentUserId),
    body: buildBody(message),
    meta: {
      timestamp: timestampMeta(asNumber(raw.ts, 0)),
      proof: buildProofMeta(message),
      threat: buildThreatMeta(message, options.threatSnapshot),
      integrity: buildIntegrityMeta(message, options.transcriptLocked),
      channel: {
        channelId: message.channel,
        channelKind: channelKind(message.channel),
        channelLabel: channelLabel(message.channel),
        mountLabel: maybeString(asRecord(raw.compatibility).derivedFromFrameKind),
        reputationLabel: maybeString(asRecord(raw.reputationState).label),
      },
      learning: raw.learningProfile || (Array.isArray(raw.memoryAnchors) && raw.memoryAnchors.length > 0)
        ? {
            coldStart: Boolean(asRecord(raw.learningProfile).coldStart),
            helperBoost: Boolean(asRecord(raw.learningProfile).helperBoost),
            engagementLabel: maybeString(asRecord(raw.learningProfile).engagementLabel),
            dropOffRiskLabel: maybeString(asRecord(raw.learningProfile).dropOffRiskLabel),
            recommendationLabel: maybeString(asRecord(raw.learningProfile).recommendationLabel),
            memoryHit: Array.isArray(raw.memoryAnchors) && raw.memoryAnchors.length > 0,
            memoryAnchorLabel: Array.isArray(raw.memoryAnchors)
              ? maybeString(asRecord(raw.memoryAnchors[0]).label)
              : undefined,
          }
        : undefined,
      chips: buildChips(message),
      badges: buildBadges(message),
    },
    tone,
    accent,
    emphasis: emphasisForMessage(message),
    displayIntent: displayIntent(message),
    displayHints: buildDisplayHints(message),
    selected: false,
    pinned: Boolean(asRecord(raw.render).pinned),
    unread: Boolean(asRecord(raw.analytics).unreadAtArrival),
    canReply: message.channel !== 'GLOBAL' || message.kind !== 'SYSTEM',
    canCopy: true,
    canInspectProof: Boolean(maybeString(raw.proofHash) || raw.proofMeta),
    canJumpToCause: Boolean(asRecord(raw.proofMeta).causalParents || asRecord(raw.replayMeta).windowLabel),
    canMutePersona: asString(raw.senderId, '') !== (options.currentUserId ?? 'player-local'),
    canEscalateModeration: asString(raw.moderationState, '') !== 'APPROVED',
  };
}

function defaultActionsForMessage(message: ChatMessage, card: ChatUiMessageCardViewModel, transcriptLocked?: boolean): readonly MessageCardActionViewModel[] {
  const actions: MessageCardActionViewModel[] = [];
  if (card.canReply) actions.push({ id: 'reply', label: 'Reply', icon: '↩', tone: 'supportive', accent: 'indigo', primary: true, disabled: transcriptLocked && message.kind === 'DEAL_RECAP' });
  if (message.channel === 'DEAL_ROOM') actions.push({ id: 'counter', label: 'Counter', icon: '⚖', tone: 'premium', accent: 'gold', disabled: transcriptLocked && message.kind === 'DEAL_RECAP' });
  if (card.canInspectProof) actions.push({ id: 'inspect_proof', label: 'Proof', icon: '⛭', tone: 'premium', accent: 'gold' });
  if (card.canMutePersona) actions.push({ id: 'mute_persona', label: 'Mute persona', icon: '∅', tone: 'ghost', accent: 'obsidian' });
  return actions;
}

function buildDayBreakRow(timestamp: number): ChatUiFeedRow {
  const date = new Date(timestamp || Date.now());
  return {
    id: `day:${date.toDateString()}`,
    kind: 'day_break',
    label: date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    timestamp: timestampMeta(timestamp),
  };
}

function buildUnreadBreakRow(count: number): ChatUiFeedRow {
  return {
    id: `unread:${count}`,
    kind: 'unread_break',
    label: 'Unread boundary',
    unreadCount: count,
  };
}

export function buildMessageFeedSurfaceModel(
  params: BuildMessageFeedSurfaceParams,
): BuildMessageFeedSurfaceResult {
  const scoped = params.messages.filter((message) => message.channel === params.activeChannel);
  const sorted = [...scoped].sort((a, b) => (params.newestFirst ? b.ts - a.ts : a.ts - b.ts));

  const flatRows: ChatUiFeedRow[] = [];
  const actionsByMessageId: Record<string, readonly MessageCardActionViewModel[]> = {};
  let lastDayKey: string | null = null;

  sorted.forEach((message, index) => {
    const dayKey = new Date(message.ts || Date.now()).toDateString();
    if (dayKey !== lastDayKey) {
      flatRows.push(buildDayBreakRow(message.ts));
      lastDayKey = dayKey;
    }

    if (!params.newestFirst && params.unreadCount && index === Math.max(0, sorted.length - params.unreadCount)) {
      flatRows.push(buildUnreadBreakRow(params.unreadCount));
    }

    const card = buildMessageCardViewModelFromLegacy(message, params);
    flatRows.push(card);
    actionsByMessageId[message.id] = defaultActionsForMessage(message, card, params.transcriptLocked);
  });

  if (params.hasOlder) {
    flatRows.unshift({
      id: 'load-older-row',
      kind: 'load_older',
      label: 'Load older transcript window',
      available: true,
      pending: false,
    });
  }

  if (!flatRows.some((row) => row.kind !== 'load_older')) {
    flatRows.push({
      id: 'empty-state',
      kind: 'empty_state',
      model: {
        id: 'empty-feed',
        kind: 'quiet_room',
        title: 'No transcript activity',
        body: 'This channel is quiet. The normalized feed is ready once message traffic enters the shell.',
        tone: 'neutral',
        accent: 'slate',
      },
    });
  }

  return {
    feed: {
      groups: [
        {
          id: `group:${params.activeChannel}`,
          channelId: params.activeChannel,
          rows: flatRows,
        },
      ],
      flatRows,
      hasOlder: Boolean(params.hasOlder),
      hasNewer: Boolean(params.hasNewer),
      unreadCount: params.unreadCount ?? 0,
      newestMessageId: sorted[sorted.length - 1]?.id,
      oldestMessageId: sorted[0]?.id,
      visibleRange: flatRows.length
        ? {
            startIndex: 0,
            endIndex: flatRows.length - 1,
            totalCount: flatRows.length,
          }
        : undefined,
    },
    actionsByMessageId,
  };
}
