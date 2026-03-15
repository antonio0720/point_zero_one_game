import type { ChatChannel, ChatMessage } from './chatTypes';
import type {
  PresenceActorViewModel,
  PresenceStripViewModel,
  TypingActorViewModel,
  TypingClusterViewModel,
} from './uiTypes';

/**
 * ============================================================================
 * POINT ZERO ONE — PRESENCE / TYPING SURFACE BUILDER
 * FILE: pzo-web/src/components/chat/presenceTypingSurfaceBuilder.ts
 * VERSION: 2.0.1
 * AUTHOR: OpenAI
 * LICENSE: Internal / Project Use Only
 * ============================================================================
 *
 * Purpose
 * -------
 * Render-safe adapter for deriving shell-level presence and typing models from
 * the current compatibility-lane chat message stream.
 *
 * Merge doctrine
 * -------------
 * This version intentionally combines the strongest parts of both uploaded
 * variants:
 * - strict-safe loose-field access for migration tolerance,
 * - helper/support detection restored,
 * - richer intent routing,
 * - de-duplicated actor typing signals,
 * - stable actor ordering for deterministic UI rendering.
 * ============================================================================
 */

export interface BuildPresenceTypingArgs {
  messages: readonly ChatMessage[];
  activeChannel: ChatChannel;
  playerName?: string | null;
  playerId?: string | null;
  onlineCount?: number;
  activeMembers?: number;
  typingCount?: number;
  recentPeerNames?: readonly string[];
}

type LooseChatMessage = ChatMessage & {
  id?: string;
  senderId?: string;
  senderName?: string;
  kind?: string;
  proofHash?: string;
  proofTier?: string | null;
  tickLabel?: string | null;
  pressureLabel?: string | null;
};

const ONLINE_WINDOW_MS = 120_000;
const TYPING_WINDOW_MS = 18_000;

function normalizeWhitespace(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function coerceTs(message: ChatMessage): number {
  return typeof message.ts === 'number' && Number.isFinite(message.ts) ? message.ts : Date.now();
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

function isHelperSignal(message: LooseChatMessage): boolean {
  return message.kind === 'HELPER_PROMPT' || /helper|guide|coach|mentor/i.test(message.senderName || '');
}

function isThreatSignal(message: LooseChatMessage): boolean {
  return message.kind === 'BOT_ATTACK' || message.kind === 'BOT_TAUNT';
}

function isSystemSignal(message: LooseChatMessage): boolean {
  return message.kind === 'SYSTEM' || message.kind === 'MARKET_ALERT' || message.kind === 'ACHIEVEMENT';
}

function inferPresenceRole(message: LooseChatMessage): PresenceActorViewModel['role'] {
  if (isSystemSignal(message)) return 'system';
  if (isThreatSignal(message)) return 'hater';
  if (isHelperSignal(message)) return 'helper';
  return 'player';
}

function inferPresenceIntent(message: LooseChatMessage): PresenceActorViewModel['intent'] {
  if (message.kind === 'BOT_ATTACK') return 'attacking';
  if (message.kind === 'DEAL_RECAP') return 'negotiating';
  if (isHelperSignal(message)) return 'supporting';
  return 'reading';
}

function inferTypingRole(message: LooseChatMessage): TypingActorViewModel['role'] {
  if (message.kind === 'BOT_ATTACK' || message.kind === 'BOT_TAUNT') return 'hater';
  if (isHelperSignal(message)) return 'helper';
  if (isSystemSignal(message)) return 'system';
  return 'player';
}

function inferTypingIntent(message: LooseChatMessage): TypingActorViewModel['intent'] {
  if (message.kind === 'BOT_ATTACK') return 'threatening';
  if (message.kind === 'DEAL_RECAP') return 'negotiating';
  if (isHelperSignal(message)) return 'supporting';
  return 'replying';
}

function actorKey(message: LooseChatMessage): string {
  return normalizeWhitespace(message.senderId)
    || normalizeWhitespace(message.senderName)
    || normalizeWhitespace(message.id);
}

function actorPriority(message: LooseChatMessage, role: PresenceActorViewModel['role']): number {
  if (message.senderId === 'player-local') return 1000;
  if (isThreatSignal(message)) return 300;
  if (role === 'helper') return 220;
  if (role === 'system') return 180;
  return 100;
}

function sortPresenceActors(a: PresenceActorViewModel, b: PresenceActorViewModel): number {
  const priorityDelta = (b.priority || 0) - (a.priority || 0);
  if (priorityDelta !== 0) return priorityDelta;
  const activeDelta = (b.lastActiveAtMs || 0) - (a.lastActiveAtMs || 0);
  if (activeDelta !== 0) return activeDelta;
  return (a.name || '').localeCompare(b.name || '');
}

function sortTypingActors(a: TypingActorViewModel, b: TypingActorViewModel): number {
  const priorityDelta = Number(Boolean(b.isPriority)) - Number(Boolean(a.isPriority));
  if (priorityDelta !== 0) return priorityDelta;
  const urgencyDelta = (b.urgency || 0) - (a.urgency || 0);
  if (urgencyDelta !== 0) return urgencyDelta;
  const startedDelta = (b.startedAtMs || 0) - (a.startedAtMs || 0);
  if (startedDelta !== 0) return startedDelta;
  return (a.name || '').localeCompare(b.name || '');
}

export function buildPresenceStripViewModel(args: BuildPresenceTypingArgs): PresenceStripViewModel {
  const now = Date.now();
  const byActor = new Map<string, PresenceActorViewModel>();

  for (const raw of args.messages) {
    const message = raw as LooseChatMessage;
    const key = actorKey(message);
    if (!key) continue;

    const nextTs = coerceTs(message);
    const current = byActor.get(key);
    const role = inferPresenceRole(message);
    const isTyping = message.channel === args.activeChannel && now - nextTs <= TYPING_WINDOW_MS && role !== 'system';

    const candidate: PresenceActorViewModel = {
      id: key,
      name: normalizeWhitespace(message.senderName || 'Unknown'),
      shortName: normalizeWhitespace(message.senderName || 'Unknown'),
      status: now - nextTs < ONLINE_WINDOW_MS ? 'online' : 'idle',
      role,
      entityKind: role === 'player' ? 'human' : role === 'helper' || role === 'hater' ? 'bot' : role === 'system' ? 'system' : 'npc',
      intent: inferPresenceIntent(message),
      isSelf: message.senderId === args.playerId || message.senderId === 'player-local',
      isThreat: isThreatSignal(message),
      isTyping,
      unreadCount: current?.unreadCount || 0,
      priority: actorPriority(message, role),
      activityScore: 1,
      lastSeenAtMs: nextTs,
      lastActiveAtMs: nextTs,
      typingStartedAtMs: isTyping ? nextTs : null,
      badges: [
        ...(message.proofHash ? [{ id: `${message.id}:proof`, label: message.proofHash, shortLabel: 'proof', tone: 'accent' as const }] : []),
        ...(message.tickLabel ? [{ id: `${message.id}:tick`, label: message.tickLabel, shortLabel: 'tick', tone: 'muted' as const }] : []),
        ...(message.pressureLabel ? [{ id: `${message.id}:pressure`, label: message.pressureLabel, shortLabel: 'pressure', tone: 'warning' as const }] : []),
      ],
      meta: {
        channelKey: message.channel,
        channelLabel: compactChannelLabel(message.channel),
        proofHash: message.proofHash || null,
        proofTier: message.proofTier || null,
        tickLabel: message.tickLabel || null,
        pressureLabel: message.pressureLabel || null,
      },
    };

    if (!current || (current.lastActiveAtMs || 0) <= nextTs) {
      byActor.set(key, {
        ...candidate,
        badges: [...(current?.badges || []), ...(candidate.badges || [])].slice(-4),
      });
    }
  }

  const actors = [...byActor.values()];

  for (const peerName of args.recentPeerNames || []) {
    if (!actors.some((actor) => actor.name === peerName)) {
      actors.push({
        id: `peer:${peerName}`,
        name: peerName,
        shortName: peerName,
        status: 'online',
        role: 'player',
        entityKind: 'human',
        intent: 'watching',
        priority: 80,
        lastSeenAtMs: now,
        lastActiveAtMs: now,
        meta: {
          channelKey: args.activeChannel,
          channelLabel: compactChannelLabel(args.activeChannel),
        },
      });
    }
  }

  if (args.playerName) {
    const selfId = args.playerId || 'self';
    const alreadyPresent = actors.some((actor) => actor.id === selfId || actor.isSelf);
    if (!alreadyPresent) {
      actors.unshift({
        id: selfId,
        name: args.playerName,
        shortName: args.playerName,
        status: 'online',
        role: 'player',
        entityKind: 'human',
        intent: 'reading',
        isSelf: true,
        priority: 1000,
        lastSeenAtMs: now,
        lastActiveAtMs: now,
        meta: {
          channelKey: args.activeChannel,
          channelLabel: compactChannelLabel(args.activeChannel),
        },
      });
    }
  }

  actors.sort(sortPresenceActors);

  return {
    actors,
    title: 'Presence',
    summary: {
      online: args.onlineCount ?? actors.filter((actor) => actor.status === 'online' || actor.status === 'busy').length,
      typing: args.typingCount ?? actors.filter((actor) => actor.isTyping).length,
      helpers: actors.filter((actor) => actor.role === 'helper').length,
      haters: actors.filter((actor) => actor.role === 'hater').length,
      spectators: actors.filter((actor) => actor.role === 'spectator').length,
      offline: actors.filter((actor) => actor.status === 'offline').length,
    },
    filterPlaceholder: 'Search names, channels, proof, pressure...',
  };
}

export function buildTypingClusterViewModel(args: BuildPresenceTypingArgs): TypingClusterViewModel {
  const now = Date.now();
  const byActor = new Map<string, TypingActorViewModel>();

  for (const raw of args.messages) {
    const message = raw as LooseChatMessage;
    const ts = coerceTs(message);
    if (now - ts > TYPING_WINDOW_MS) continue;
    if (message.channel !== args.activeChannel) continue;

    const key = actorKey(message) || `typing:${message.id}`;
    const candidate: TypingActorViewModel = {
      id: key,
      name: normalizeWhitespace(message.senderName || 'Unknown'),
      shortName: normalizeWhitespace(message.senderName || 'Unknown'),
      role: inferTypingRole(message),
      intent: inferTypingIntent(message),
      isThreat: isThreatSignal(message),
      isPriority: message.kind === 'BOT_ATTACK' || isHelperSignal(message),
      startedAtMs: ts,
      confidence: 0.65,
      urgency: message.kind === 'BOT_ATTACK' ? 0.95 : isHelperSignal(message) ? 0.7 : 0.45,
      badges: [
        ...(message.pressureLabel ? [{ id: `${message.id}:pressure`, label: message.pressureLabel, shortLabel: 'pressure', tone: 'warning' as const }] : []),
        ...(message.tickLabel ? [{ id: `${message.id}:tick`, label: message.tickLabel, shortLabel: 'tick', tone: 'muted' as const }] : []),
      ],
      meta: {
        channelKey: message.channel,
        channelLabel: compactChannelLabel(message.channel),
        proofTier: message.proofTier || null,
        pressureLabel: message.pressureLabel || null,
        tickLabel: message.tickLabel || null,
      },
    };

    const current = byActor.get(key);
    if (!current || (current.startedAtMs || 0) <= ts) {
      byActor.set(key, candidate);
    }
  }

  const actors = [...byActor.values()].sort(sortTypingActors);

  return {
    actors,
    visible: actors.length > 0,
    label: actors.length > 0 ? `${actors.length} active typing signals` : '',
    compactLabel: actors.length > 0 ? `${actors.length} typing` : '',
  };
}
