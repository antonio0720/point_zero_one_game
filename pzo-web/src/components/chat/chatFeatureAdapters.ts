/**
 * ============================================================================
 * POINT ZERO ONE — CHAT FEATURE ADAPTERS
 * FILE: pzo-web/src/components/chat/chatFeatureAdapters.ts
 * ============================================================================
 *
 * Shared adapter helpers for the four absorbed pzo_client chat UI surfaces.
 * Presentation only. No transport ownership, no engine ownership.
 * ============================================================================
 */

import type { ChatChannel, ChatMessage } from './chatTypes';

export type RivalryPhase =
  | 'NOTICE_FILED'
  | 'DUE_DILIGENCE'
  | 'CAPITAL_BATTLE'
  | 'LEDGER_CLOSE'
  | 'CLOSED';

export type ChannelType = 'GLOBAL' | 'SERVER' | 'SYNDICATE' | 'DEAL_ROOM' | 'DIRECT';

export interface MarketMoveAlertPayload {
  readonly rivalryId: string;
  readonly phase: RivalryPhase;
  readonly challenger: {
    readonly syndicateId: string;
    readonly name: string;
    readonly banner: string;
    readonly capitalScore: number;
  };
  readonly defender: {
    readonly syndicateId: string;
    readonly name: string;
    readonly banner: string;
    readonly capitalScore: number;
  };
  readonly phaseEndsAt: string;
  readonly deepLink: string;
  readonly proofHash?: string;
  readonly yieldCaptureAmount?: number;
}

export interface DealRoomMessageViewModel {
  readonly messageId: string;
  readonly senderId: string | 'SYSTEM';
  readonly senderName?: string;
  readonly body: string;
  readonly createdAt: string;
  readonly immutable: boolean;
  readonly bulletinType?: 'MARKET_PHASE_BULLETIN' | 'SETTLEMENT_HASH_CARD';
  readonly phase?: RivalryPhase;
}

const RIVALRY_PHASES: readonly RivalryPhase[] = [
  'NOTICE_FILED',
  'DUE_DILIGENCE',
  'CAPITAL_BATTLE',
  'LEDGER_CLOSE',
  'CLOSED',
] as const;

export function coerceRivalryPhase(value: unknown, fallback: RivalryPhase = 'NOTICE_FILED'): RivalryPhase {
  return typeof value === 'string' && RIVALRY_PHASES.includes(value as RivalryPhase)
    ? (value as RivalryPhase)
    : fallback;
}

export function coerceChannelType(channel: ChatChannel | string | undefined): ChannelType {
  switch (channel) {
    case 'SYNDICATE':
      return 'SYNDICATE';
    case 'DEAL_ROOM':
      return 'DEAL_ROOM';
    case 'GLOBAL':
      return 'GLOBAL';
    default:
      return 'GLOBAL';
  }
}

export function safeIsoDate(value: unknown, fallback = new Date().toISOString()): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  if (typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return fallback;
}

export function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function safeString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value == null) {
    return fallback;
  }
  return String(value);
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function extractMarketMoveAlertFromMessage(message: ChatMessage): MarketMoveAlertPayload | null {
  const raw = readRecord(message as unknown);
  const explicit = readRecord(raw.marketMoveAlert);

  if (Object.keys(explicit).length > 0) {
    const challenger = readRecord(explicit.challenger);
    const defender = readRecord(explicit.defender);

    return {
      rivalryId: safeString(explicit.rivalryId, safeString(message.id)),
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
      deepLink: safeString(explicit.deepLink, safeString(message.id)),
      proofHash: safeString(explicit.proofHash) || undefined,
      yieldCaptureAmount:
        explicit.yieldCaptureAmount == null ? undefined : safeNumber(explicit.yieldCaptureAmount),
    };
  }

  const meta = readRecord(raw.meta);
  const proof = readRecord(raw.proof);
  const dealRoomMeta = readRecord(raw.dealRoomMeta);

  const looksLikeMarketAlert =
    message.kind === 'MARKET_ALERT' ||
    message.kind === 'DEAL_RECAP' ||
    safeString(message.senderName).toUpperCase().includes('MARKET') ||
    safeString(message.senderRank).toUpperCase().includes('LEDGER');

  if (!looksLikeMarketAlert) {
    return null;
  }

  const yieldCaptureRaw = meta.yieldCaptureAmount;

  return {
    rivalryId: safeString(meta.rivalryId, safeString(message.id)),
    phase: coerceRivalryPhase(
      meta.phase ?? dealRoomMeta.phase,
      message.kind === 'DEAL_RECAP' ? 'LEDGER_CLOSE' : 'NOTICE_FILED',
    ),
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
    deepLink: safeString(meta.deepLink, safeString(message.id)),
    proofHash: safeString(message.proofHash ?? proof.proofHash) || undefined,
    yieldCaptureAmount:
      yieldCaptureRaw == null ? undefined : safeNumber(yieldCaptureRaw),
  };
}

export function toDealRoomMessage(message: ChatMessage): DealRoomMessageViewModel {
  const raw = readRecord(message as unknown);
  const meta = readRecord(raw.meta);
  const dealRoomMeta = readRecord(raw.dealRoomMeta);

  const phase = coerceRivalryPhase(
    raw.bulletinPhase ?? raw.phase ?? meta.phase ?? dealRoomMeta.phase,
    'NOTICE_FILED',
  );

  const body = safeString(message.body);
  const isSettlementHash =
    safeString(message.kind).toUpperCase() === 'DEAL_RECAP' &&
    (body.toUpperCase().includes('HASH') || Boolean(message.proofHash));

  const isBulletin =
    raw.bulletinType === 'MARKET_PHASE_BULLETIN' ||
    safeString(message.senderName).toUpperCase().includes('BULLETIN') ||
    safeString(message.senderRank).toUpperCase().includes('BULLETIN');

  return {
    messageId: safeString(message.id),
    senderId: safeString(message.senderId, 'SYSTEM') as string | 'SYSTEM',
    senderName: safeString(message.senderName) || undefined,
    body,
    createdAt: safeIsoDate(message.ts),
    immutable: Boolean(message.immutable ?? true),
    bulletinType: isSettlementHash
      ? 'SETTLEMENT_HASH_CARD'
      : isBulletin
        ? 'MARKET_PHASE_BULLETIN'
        : undefined,
    phase,
  };
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(parsed);
}
