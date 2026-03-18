/**
 * ============================================================================
 * @pzo/engine/chat — Presentation adapters
 * FILE: frontend/packages/engine/src/chat/adapters.ts
 * ============================================================================
 */

import type {
  ActiveRivalry,
  AlliancePanelState,
  ChatChannel,
  ChannelType,
  DealRoomMessageViewModel,
  DealRoomState,
  MarketMoveAlertPayload,
  OmnipresentChatModel,
  PackageChatMessage,
  PackageChatRoom,
  RivalryPhase,
  ChatWorkspaceTab,
} from './types';

const RIVALRY_PHASES: readonly RivalryPhase[] = [
  'NOTICE_FILED',
  'DUE_DILIGENCE',
  'CAPITAL_BATTLE',
  'LEDGER_CLOSE',
  'CLOSED',
] as const;

export function safeString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (value == null) return fallback;
  return String(value);
}

export function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function safeBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function safeIsoDate(value: unknown, fallback = new Date().toISOString()): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  if (typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return fallback;
}

export function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function coerceRivalryPhase(value: unknown, fallback: RivalryPhase = 'NOTICE_FILED'): RivalryPhase {
  return typeof value === 'string' && RIVALRY_PHASES.includes(value as RivalryPhase)
    ? (value as RivalryPhase)
    : fallback;
}

export function coerceChannelType(value: ChatChannel | string | undefined): ChannelType {
  switch (value) {
    case 'SYNDICATE':
    case 'DEAL_ROOM':
    case 'DIRECT':
    case 'SERVER':
    case 'GLOBAL':
      return value;
    default:
      return 'GLOBAL';
  }
}

export function formatMoney(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${value < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${value < 0 ? '-' : ''}$${(abs / 1_000).toFixed(1)}K`;
  return `${value < 0 ? '-' : ''}$${Math.round(abs).toLocaleString()}`;
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function extractMarketMoveAlertFromMessage(message: PackageChatMessage): MarketMoveAlertPayload | null {
  if (message.marketMoveAlert) return message.marketMoveAlert;

  const raw = readRecord(message as unknown);
  const explicit = readRecord(raw.marketMoveAlert);
  if (Object.keys(explicit).length > 0) {
    const challenger = readRecord(explicit.challenger);
    const defender = readRecord(explicit.defender);
    return {
      rivalryId: safeString(explicit.rivalryId, message.id),
      phase: coerceRivalryPhase(explicit.phase, 'NOTICE_FILED'),
      challenger: {
        syndicateId: safeString(challenger.syndicateId, 'challenger'),
        name: safeString(challenger.name, 'Challenger'),
        banner: safeString(challenger.banner),
        capitalScore: safeNumber(challenger.capitalScore),
      },
      defender: {
        syndicateId: safeString(defender.syndicateId, 'defender'),
        name: safeString(defender.name, 'Defender'),
        banner: safeString(defender.banner),
        capitalScore: safeNumber(defender.capitalScore),
      },
      phaseEndsAt: safeIsoDate(explicit.phaseEndsAt),
      deepLink: safeString(explicit.deepLink, message.id),
      proofHash: safeString(explicit.proofHash) || undefined,
      yieldCaptureAmount:
        explicit.yieldCaptureAmount == null ? undefined : safeNumber(explicit.yieldCaptureAmount),
    };
  }

  const meta = readRecord(message.meta);
  const dealRoomMeta = readRecord(message.dealRoomMeta);
  const looksLikeAlert =
    message.kind === 'MARKET_ALERT' ||
    message.kind === 'DEAL_RECAP' ||
    safeString(message.senderName).toUpperCase().includes('MARKET') ||
    safeString(message.senderRank).toUpperCase().includes('LEDGER');

  if (!looksLikeAlert) return null;

  return {
    rivalryId: safeString(meta.rivalryId, message.id),
    phase: coerceRivalryPhase(meta.phase ?? dealRoomMeta.phase, message.kind === 'DEAL_RECAP' ? 'LEDGER_CLOSE' : 'NOTICE_FILED'),
    challenger: {
      syndicateId: safeString(meta.challengerSyndicateId, 'challenger'),
      name: safeString(meta.challengerName, 'Challenger'),
      banner: safeString(meta.challengerBanner),
      capitalScore: safeNumber(meta.challengerScore),
    },
    defender: {
      syndicateId: safeString(meta.defenderSyndicateId, 'defender'),
      name: safeString(meta.defenderName, 'Defender'),
      banner: safeString(meta.defenderBanner),
      capitalScore: safeNumber(meta.defenderScore),
    },
    phaseEndsAt: safeIsoDate(meta.phaseEndsAt ?? dealRoomMeta.phaseEndsAt ?? message.ts),
    deepLink: safeString(meta.deepLink, message.id),
    proofHash: safeString(message.proofHash ?? meta.proofHash) || undefined,
    yieldCaptureAmount: meta.yieldCaptureAmount == null ? undefined : safeNumber(meta.yieldCaptureAmount),
  };
}

export function toDealRoomMessage(message: PackageChatMessage): DealRoomMessageViewModel {
  const meta = readRecord(message.meta);
  const dealRoomMeta = readRecord(message.dealRoomMeta);
  const phase = coerceRivalryPhase(
    message.bulletinPhase ?? message.phase ?? meta.phase ?? dealRoomMeta.phase,
    'NOTICE_FILED',
  );
  return {
    messageId: message.id,
    senderId: message.senderId,
    senderName: message.senderName,
    body: message.body,
    createdAt: safeIsoDate(message.ts),
    immutable: Boolean((message.immutable ?? (message.senderId === 'SYSTEM')) || message.channel === 'DEAL_ROOM'),
    bulletinType: message.bulletinType,
    phase,
  };
}

export function deriveTabs(model: Pick<OmnipresentChatModel, 'alliance' | 'dealRoom'>): readonly ChatWorkspaceTab[] {
  const tabs: ChatWorkspaceTab[] = [
    { id: 'GLOBAL', label: 'GLOBAL', accent: '#60A5FA' },
    { id: 'SYNDICATE', label: 'SYNDICATE', accent: '#22C55E' },
    { id: 'ROOMS', label: 'ROOMS', accent: '#A78BFA' },
  ];

  if (model.dealRoom) {
    tabs.splice(2, 0, { id: 'DEAL_ROOM', label: 'DEAL ROOM', accent: '#F59E0B' });
  }

  return tabs;
}

export function normalizeAllianceState(input: Partial<AlliancePanelState> | undefined): AlliancePanelState {
  return {
    syndicateName: safeString(input?.syndicateName, 'Syndicate'),
    syndicateBanner: safeString(input?.syndicateBanner),
    partnerRank: (input?.partnerRank ?? 'PARTNER') as AlliancePanelState['partnerRank'],
    memberCount: safeNumber(input?.memberCount, 0),
    treasuryBalance: safeNumber(input?.treasuryBalance, 0),
    liquidityShieldExpiresAt: input?.liquidityShieldExpiresAt ?? null,
    activeRivalry: input?.activeRivalry ?? null,
    canFileNotice: safeBoolean(input?.canFileNotice, false),
  };
}

export function normalizeDealRoomState(input: Partial<DealRoomState> | null | undefined): DealRoomState | null {
  if (!input) return null;
  return {
    rivalryId: safeString(input.rivalryId, 'deal-room'),
    phase: coerceRivalryPhase(input.phase, 'NOTICE_FILED'),
    phaseEndsAt: safeIsoDate(input.phaseEndsAt),
    challengerName: safeString(input.challengerName, 'Challenger'),
    defenderName: safeString(input.defenderName, 'Defender'),
    challengerScore: safeNumber(input.challengerScore),
    defenderScore: safeNumber(input.defenderScore),
    myScore: safeNumber(input.myScore),
    messages: Array.isArray(input.messages) ? input.messages : [],
    isLive: safeBoolean(input.isLive, true),
    proofHash: safeString(input.proofHash) || undefined,
  };
}

export function normalizeRooms(rooms: readonly PackageChatRoom[] | undefined): readonly PackageChatRoom[] {
  return Array.isArray(rooms) ? rooms : [];
}

export function deriveDealRoomFromRivalry(
  rivalry: ActiveRivalry | null | undefined,
  messages: readonly PackageChatMessage[],
): DealRoomState | null {
  if (!rivalry) return null;
  const filtered = messages.filter((message) => message.channel === 'DEAL_ROOM');
  return {
    rivalryId: rivalry.rivalryId,
    phase: rivalry.phase,
    phaseEndsAt: rivalry.phaseEndsAt,
    challengerName: rivalry.challengerName,
    defenderName: rivalry.defenderName,
    challengerScore: rivalry.challengerScore,
    defenderScore: rivalry.defenderScore,
    myScore:
      rivalry.mySyndicateId === rivalry.challengerSyndicateId
        ? rivalry.challengerScore
        : rivalry.defenderScore,
    messages: filtered.map(toDealRoomMessage),
    isLive: rivalry.phase !== 'CLOSED',
    proofHash: extractMarketMoveAlertFromMessage(filtered[filtered.length - 1] as PackageChatMessage)?.proofHash,
  };
}
