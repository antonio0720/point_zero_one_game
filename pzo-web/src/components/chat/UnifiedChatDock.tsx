/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT DOCK
 * FILE: pzo-web/src/components/chat/UnifiedChatDock.tsx
 * VERSION: 2026.03.17-aligned
 * ============================================================================
 *
 * Purpose
 * -------
 * Presentation-lane unified chat dock aligned to the actual public exports of
 * pzo-web/src/engines/chat and to the current useUnifiedChat surface.
 *
 * Architecture
 * ------------
 * - consumes useUnifiedChat for UI shell state
 * - may reflect run-hook telemetry for threat framing
 * - does not become a second engine
 * - does not import private engine internals
 * ============================================================================
 */

import React, {
  memo,
  useMemo,
  useRef,
  useEffect,
  useCallback,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

import {
  CHAT_ENGINE_PUBLIC_MANIFEST,
  CHAT_ENGINE_RUNTIME_LAWS,
  ChatMounts,
  type ChatMountPreset,
  type ChatMountTarget,
} from '../../engines/chat';

import type { ChatMessage, GameChatContext, SabotageEvent } from './chatTypes';
import useUnifiedChat from './useUnifiedChat';
import ChatMessageFeed from './ChatMessageFeed';
import ChatChannelTabs from './ChatChannelTabs';

import { useTimeEngine } from '../../features/run/hooks/useTimeEngine';
import { usePressureEngine } from '../../features/run/hooks/usePressureEngine';
import { useShieldEngine } from '../../features/run/hooks/useShieldEngine';
import { useBattleEngine } from '../../features/run/hooks/useBattleEngine';
import { useCascadeEngine } from '../../features/run/hooks/useCascadeEngine';

type VisibleChannelId = 'GLOBAL' | 'SYNDICATE' | 'DEAL_ROOM';

type UnifiedMessageKind =
  | 'PLAYER'
  | 'SYSTEM'
  | 'MARKET_ALERT'
  | 'ACHIEVEMENT'
  | 'BOT_TAUNT'
  | 'BOT_ATTACK'
  | 'SHIELD_EVENT'
  | 'CASCADE_ALERT'
  | 'DEAL_RECAP';

type UnifiedChatMessage = Partial<ChatMessage> & {
  id?: string;
  channel?: VisibleChannelId | string;
  kind?: UnifiedMessageKind | string;
  senderId?: string;
  senderName?: string;
  senderRank?: string;
  ts?: number;
  body?: string;
  immutable?: boolean;
  emoji?: string;
  proofHash?: string;
  pressureTier?: string;
  tickTier?: string;
  botSource?: {
    botState?: string;
    attackType?: string;
    confidence?: number;
  };
  metadata?: Record<string, unknown>;
};

interface UnifiedPresenceMember {
  id: string;
  name: string;
  role: 'PLAYER' | 'HELPER' | 'HATER' | 'SYSTEM' | 'NPC';
  online: boolean;
  typing: boolean;
  mood: 'calm' | 'alert' | 'heated' | 'predatory' | 'rescue';
}

interface UnifiedDockThreatModel {
  score01: number;
  band: 'QUIET' | 'LOW' | 'ELEVATED' | 'HIGH' | 'SEVERE';
  attackCount: number;
  tauntCount: number;
  shieldMentions: number;
  rescueNeeded: boolean;
  pressureTier: string;
  timeoutDanger: boolean;
  battleHeatPct: number;
  summary: string;
}

interface UnifiedHelperPromptModel {
  visible: boolean;
  title: string;
  body: string;
  tone: 'calm' | 'blunt' | 'urgent' | 'strategic';
  ctaLabel: string;
}

interface EngineTelemetryModel {
  score01: number;
  pressureTier: string;
  pressureCritical: boolean;
  timeoutDanger: boolean;
  battleHeatPct: number;
  battleHot: boolean;
  shieldIntegrityPct: number;
  shieldCritical: boolean;
  cascadeHot: boolean;
  summary: string;
}

interface ResolvedMountTarget {
  id: ChatMountTarget;
  label: string;
}

interface ResolvedMountPresetModel {
  id: ChatMountTarget;
  label: string;
  compact: boolean;
  composerRows: number;
  zIndex: number;
  showPresenceStrip: boolean;
  showThreatMeter: boolean;
  showTranscriptDrawer: boolean;
  enableHelperPrompts: boolean;
  allowCollapse: boolean;
  defaultCollapsed: boolean;
  allowedVisibleChannels: readonly string[];
}

export interface UnifiedChatDockProps {
  gameCtx: GameChatContext;
  onSabotage?: (event: SabotageEvent) => void;
  accessToken?: string | null;
  mountTarget?: ChatMountTarget | string;
  mountPreset?: ChatMountPreset | ChatMountTarget | string | null;
  title?: string;
  subtitle?: string;
  startCollapsed?: boolean;
  defaultTab?: VisibleChannelId;
  enableThreatMeter?: boolean;
  enableTranscriptDrawer?: boolean;
  enableHelperPrompt?: boolean;
  enableRoomMeta?: boolean;
  enableLawFooter?: boolean;
  className?: string;
  style?: CSSProperties;
}

const TOKENS = Object.freeze({
  panelGlass: 'rgba(10, 14, 28, 0.88)',
  panel: '#0B0D18',
  border: 'rgba(255,255,255,0.08)',
  borderMedium: 'rgba(255,255,255,0.14)',
  text: '#F5F7FF',
  textSubtle: '#A7B2D4',
  textMuted: '#7180A8',
  green: '#20D98E',
  red: '#FF5353',
  orange: '#FF9A3D',
  yellow: '#FFD75E',
  cyan: '#38DDF8',
  indigo: '#8B93FF',
  purple: '#C183FF',
  teal: '#3EE6CC',
  shadowHeavy: '0 24px 80px rgba(0,0,0,0.48)',
  radiusSm: 12,
  radiusMd: 16,
  radiusXl: 26,
  mono: "'IBM Plex Mono', 'JetBrains Mono', monospace",
  display: "'Syne', 'Outfit', system-ui, sans-serif",
  sans: "'Inter', 'Outfit', system-ui, sans-serif",
} as const);

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');`;

const CHANNEL_META = Object.freeze({
  GLOBAL: Object.freeze({
    label: 'Global',
    icon: '◎',
    description: 'Theatrical crowd lane. Fast, visible, witness-heavy.',
    accent: TOKENS.indigo,
  }),
  SYNDICATE: Object.freeze({
    label: 'Syndicate',
    icon: '◈',
    description: 'Tactical intimacy, trust, and quiet command.',
    accent: TOKENS.teal,
  }),
  DEAL_ROOM: Object.freeze({
    label: 'Deal Room',
    icon: '◇',
    description: 'Predatory negotiation lane. Transcript-sensitive.',
    accent: TOKENS.yellow,
  }),
} as const);

const MOUNT_TARGET_LABELS: Record<ChatMountTarget, string> = {
  BATTLE_HUD: 'Battle HUD',
  CLUB_UI: 'Club UI',
  EMPIRE_GAME_SCREEN: 'Empire Screen',
  GAME_BOARD: 'Game Board',
  LEAGUE_UI: 'League UI',
  LOBBY_SCREEN: 'Lobby Screen',
  PHANTOM_GAME_SCREEN: 'Phantom Screen',
  PREDATOR_GAME_SCREEN: 'Predator Screen',
  SYNDICATE_GAME_SCREEN: 'Syndicate Screen',
  POST_RUN_SUMMARY: 'Post-Run Summary',
};

const LEGACY_TARGET_ALIASES: Record<string, ChatMountTarget> = {
  BATTLEHUD: 'BATTLE_HUD',
  BATTLE_HUD: 'BATTLE_HUD',
  CLUBUI: 'CLUB_UI',
  CLUB_UI: 'CLUB_UI',
  EMPIREGAMESCREEN: 'EMPIRE_GAME_SCREEN',
  EMPIRE_GAME_SCREEN: 'EMPIRE_GAME_SCREEN',
  GAMEBOARD: 'GAME_BOARD',
  GAME_BOARD: 'GAME_BOARD',
  LEAGUEUI: 'LEAGUE_UI',
  LEAGUE_UI: 'LEAGUE_UI',
  LOBBYSCREEN: 'LOBBY_SCREEN',
  LOBBY_SCREEN: 'LOBBY_SCREEN',
  PHANTOMGAMESCREEN: 'PHANTOM_GAME_SCREEN',
  PHANTOM_GAME_SCREEN: 'PHANTOM_GAME_SCREEN',
  PREDATORGAMESCREEN: 'PREDATOR_GAME_SCREEN',
  PREDATOR_GAME_SCREEN: 'PREDATOR_GAME_SCREEN',
  SYNDICATEGAMESCREEN: 'SYNDICATE_GAME_SCREEN',
  SYNDICATE_GAME_SCREEN: 'SYNDICATE_GAME_SCREEN',
  POSTRUNSUMMARY: 'POST_RUN_SUMMARY',
  POST_RUN_SUMMARY: 'POST_RUN_SUMMARY',
};

const THREAT_BANDS = Object.freeze([
  Object.freeze({ max: 0.18, label: 'QUIET' as const, color: TOKENS.textMuted }),
  Object.freeze({ max: 0.35, label: 'LOW' as const, color: TOKENS.teal }),
  Object.freeze({ max: 0.58, label: 'ELEVATED' as const, color: TOKENS.yellow }),
  Object.freeze({ max: 0.78, label: 'HIGH' as const, color: TOKENS.orange }),
  Object.freeze({ max: 1.01, label: 'SEVERE' as const, color: TOKENS.red }),
]);

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function asVisibleChannel(
  value: unknown,
  fallback: VisibleChannelId = 'GLOBAL',
): VisibleChannelId {
  return value === 'GLOBAL' || value === 'SYNDICATE' || value === 'DEAL_ROOM'
    ? value
    : fallback;
}

function normalizeMessages(messages: readonly ChatMessage[]): UnifiedChatMessage[] {
  return messages.map((value, index) => {
    const candidate = value as UnifiedChatMessage;
    return {
      ...candidate,
      id:
        candidate.id ??
        `msg-${index}-${candidate.senderId ?? 'unknown'}-${candidate.ts ?? index}`,
      channel: asVisibleChannel(candidate.channel, 'GLOBAL'),
      kind: candidate.kind ?? 'PLAYER',
      senderId: candidate.senderId ?? 'unknown',
      senderName: candidate.senderName ?? 'Unknown',
      ts: candidate.ts ?? Date.now(),
      body: candidate.body ?? '',
      metadata: candidate.metadata ?? {},
    };
  });
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

function filterTranscriptRows(
  query: string,
  rows: readonly UnifiedChatMessage[],
): UnifiedChatMessage[] {
  const q = normalizeSearch(query);
  if (!q) return [...rows];

  return rows.filter((row) => {
    const haystack = [
      row.senderName,
      row.senderId,
      row.senderRank,
      row.body,
      row.kind,
      row.proofHash,
      row.pressureTier,
      row.tickTier,
      row.botSource?.botState,
      row.botSource?.attackType,
      JSON.stringify(row.metadata ?? {}),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(q);
  });
}

function createPresenceModel(
  messages: readonly UnifiedChatMessage[],
  channel: VisibleChannelId,
): UnifiedPresenceMember[] {
  const recent = messages
    .filter((message) => asVisibleChannel(message.channel, 'GLOBAL') === channel)
    .slice(-18);
  const map = new Map<string, UnifiedPresenceMember>();

  for (const message of recent) {
    const senderId = message.senderId ?? `sender:${message.senderName ?? 'unknown'}`;
    if (map.has(senderId)) continue;

    const kind = message.kind ?? 'PLAYER';
    map.set(senderId, {
      id: senderId,
      name: message.senderName ?? 'Unknown',
      role:
        kind === 'SYSTEM'
          ? 'SYSTEM'
          : kind === 'BOT_ATTACK' || kind === 'BOT_TAUNT'
            ? 'HATER'
            : message.senderId === 'player-local'
              ? 'PLAYER'
              : 'NPC',
      online: true,
      typing: false,
      mood:
        kind === 'BOT_ATTACK'
          ? 'predatory'
          : kind === 'BOT_TAUNT'
            ? 'heated'
            : kind === 'SHIELD_EVENT'
              ? 'alert'
              : 'calm',
    });
  }

  const values = Array.from(map.values()).slice(0, 6);
  if (values.length === 0) {
    return [
      {
        id: 'system-observer',
        name: channel === 'DEAL_ROOM' ? 'Deal Ledger' : 'Observer Mesh',
        role: 'SYSTEM',
        online: true,
        typing: false,
        mood: channel === 'DEAL_ROOM' ? 'predatory' : 'calm',
      },
    ];
  }

  return values;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function readNumber(source: unknown, ...keys: string[]): number {
  const record = readRecord(source);
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return 0;
}

function readBoolean(source: unknown, ...keys: string[]): boolean {
  const record = readRecord(source);
  for (const key of keys) {
    if (typeof record[key] === 'boolean') return Boolean(record[key]);
  }
  return false;
}

function readString(source: unknown, ...keys: string[]): string {
  const record = readRecord(source);
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return '';
}

function readArrayLength(source: unknown, ...keys: string[]): number {
  const record = readRecord(source);
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value.length;
  }
  return 0;
}

function normalizeMountTarget(
  value: unknown,
  fallback: ChatMountTarget = 'BATTLE_HUD',
): ChatMountTarget {
  if (typeof value !== 'string' || value.trim().length === 0) return fallback;

  const normalized = value.trim().replace(/[\s-]+/g, '_').toUpperCase();
  const direct = LEGACY_TARGET_ALIASES[normalized];
  if (direct) return direct;

  const targets = ChatMounts.targets as readonly ChatMountTarget[];
  return targets.includes(normalized as ChatMountTarget)
    ? (normalized as ChatMountTarget)
    : fallback;
}

function resolveMountTarget(value: unknown): ResolvedMountTarget {
  const id = normalizeMountTarget(value);
  return {
    id,
    label: MOUNT_TARGET_LABELS[id] ?? id,
  };
}

function lookupMountPreset(target: ChatMountTarget): ChatMountPreset | null {
  const presets = ChatMounts.presets as Readonly<Record<ChatMountTarget, ChatMountPreset>>;
  return presets[target] ?? null;
}

function resolveMountPresetModel(
  target: ChatMountTarget,
  presetInput?: ChatMountPreset | ChatMountTarget | string | null,
): ResolvedMountPresetModel {
  const explicitPreset =
    typeof presetInput === 'object' && presetInput && 'mountTarget' in presetInput
      ? (presetInput as ChatMountPreset)
      : null;

  const presetTarget =
    explicitPreset?.mountTarget ??
    (typeof presetInput === 'string' ? normalizeMountTarget(presetInput, target) : target);

  const preset = explicitPreset ?? lookupMountPreset(presetTarget) ?? lookupMountPreset(target);

  const density = preset?.density ?? 'STANDARD';
  const compact = density === 'COMPACT';
  const composerRows = compact ? 2 : density === 'EXPANDED' ? 4 : 3;

  return {
    id: preset?.mountTarget ?? target,
    label: MOUNT_TARGET_LABELS[preset?.mountTarget ?? target] ?? (preset?.mountTarget ?? target),
    compact,
    composerRows,
    zIndex:
      target === 'BATTLE_HUD' || target === 'GAME_BOARD'
        ? 80
        : target === 'POST_RUN_SUMMARY'
          ? 60
          : 70,
    showPresenceStrip: preset?.showPresenceStrip ?? true,
    showThreatMeter: preset?.showThreatMeter ?? true,
    showTranscriptDrawer: preset?.showTranscriptDrawer ?? true,
    enableHelperPrompts: true,
    allowCollapse: preset?.allowCollapse ?? true,
    defaultCollapsed: preset?.defaultCollapsed ?? false,
    allowedVisibleChannels: preset?.allowedVisibleChannels ?? ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'],
  };
}

function createEngineTelemetry(
  pressure: unknown,
  shield: unknown,
  battle: unknown,
  cascade: unknown,
  time: unknown,
): EngineTelemetryModel {
  const pressureScore = clamp01(readNumber(pressure, 'score'));
  const pressureTier = readString(pressure, 'tier', 'currentTier') || 'CALM';
  const pressureCritical =
    readBoolean(pressure, 'isCritical', 'isHigh') ||
    pressureTier === 'CRITICAL' ||
    pressureTier === 'HIGH';

  const rawBattleHeat =
    readNumber(battle, 'haterHeatPct') > 0
      ? readNumber(battle, 'haterHeatPct') / 100
      : (() => {
          const heat = readNumber(battle, 'haterHeat');
          return heat > 1 ? heat / 100 : heat;
        })();

  const battleHeat01 = clamp01(rawBattleHeat);
  const activeBotCount = Math.max(
    readNumber(battle, 'activeBotCount'),
    readNumber(battle, 'activeBotsCount'),
  );
  const attackingBots = readArrayLength(battle, 'attackingBots');
  const targetingBots = readArrayLength(battle, 'targetingBots');
  const battleHot =
    activeBotCount > 0 ||
    attackingBots > 0 ||
    targetingBots > 0 ||
    battleHeat01 >= 0.58;

  const shieldIntegrity01 = clamp01(
    readNumber(shield, 'overallPct') ||
      readNumber(shield, 'overallIntegrityPct') ||
      (readNumber(shield, 'overallPct100') > 0
        ? readNumber(shield, 'overallPct100') / 100
        : 0),
  );
  const shieldCritical =
    readBoolean(shield, 'isInBreachCascade', 'isAnyCritical', 'isAnyBreached') ||
    shieldIntegrity01 <= 0.33;

  const queueDepth = readNumber(cascade, 'queueDepth');
  const cascadeHot =
    readBoolean(cascade, 'hasCatastrophicChain', 'isInSpiral', 'isCatastrophicSpiral') ||
    queueDepth >= 2;

  const timeoutDanger =
    readBoolean(time, 'seasonTimeoutImminent', 'isFinalFiveTicks', 'isFinalTick') ||
    readNumber(time, 'ticksUntilTimeout') <= 5;

  const score01 = clamp01(
    pressureScore * 0.26 +
      battleHeat01 * 0.24 +
      (1 - shieldIntegrity01) * 0.22 +
      (cascadeHot ? 0.18 : clamp01(queueDepth / 4) * 0.18) +
      (timeoutDanger ? 0.10 : 0),
  );

  const summaryParts = [
    pressureCritical ? `pressure ${pressureTier.toLowerCase()}` : null,
    battleHot ? `${activeBotCount || Math.max(attackingBots, targetingBots)} bots active` : null,
    shieldCritical ? `shield ${Math.round(shieldIntegrity01 * 100)}%` : null,
    cascadeHot ? `cascade ×${queueDepth || 1}` : null,
    timeoutDanger ? `${Math.max(0, Math.round(readNumber(time, 'ticksUntilTimeout')))}t left` : null,
  ].filter(Boolean);

  return {
    score01,
    pressureTier,
    pressureCritical,
    timeoutDanger,
    battleHeatPct: Math.round(battleHeat01 * 100),
    battleHot,
    shieldIntegrityPct: Math.round(shieldIntegrity01 * 100),
    shieldCritical,
    cascadeHot,
    summary: summaryParts.length > 0 ? summaryParts.join(' · ') : 'stable board',
  };
}

function computeThreatModel(
  messages: readonly UnifiedChatMessage[],
  telemetry: EngineTelemetryModel,
): UnifiedDockThreatModel {
  let attackCount = 0;
  let tauntCount = 0;
  let shieldMentions = 0;
  let transcriptWeight = 0;

  for (const message of messages) {
    const kind = message.kind ?? 'PLAYER';
    if (kind === 'BOT_ATTACK') {
      attackCount += 1;
      transcriptWeight += 0.22;
    } else if (kind === 'BOT_TAUNT') {
      tauntCount += 1;
      transcriptWeight += 0.12;
    } else if (kind === 'CASCADE_ALERT') {
      transcriptWeight += 0.16;
    }

    if (
      (message.body ?? '').toLowerCase().includes('shield') ||
      kind === 'SHIELD_EVENT'
    ) {
      shieldMentions += 1;
      transcriptWeight += 0.06;
    }
  }

  const score01 = clamp01(Math.max(transcriptWeight, telemetry.score01));
  const band =
    THREAT_BANDS.find((entry) => score01 <= entry.max)?.label ?? 'SEVERE';

  return {
    score01,
    band,
    attackCount,
    tauntCount,
    shieldMentions,
    rescueNeeded:
      score01 >= 0.58 ||
      shieldMentions >= 2 ||
      telemetry.shieldCritical ||
      telemetry.timeoutDanger,
    pressureTier: telemetry.pressureTier,
    timeoutDanger: telemetry.timeoutDanger,
    battleHeatPct: telemetry.battleHeatPct,
    summary: telemetry.summary,
  };
}

function createHelperPromptModel(
  channel: VisibleChannelId,
  threat: UnifiedDockThreatModel,
): UnifiedHelperPromptModel {
  if (threat.score01 < 0.38) {
    return {
      visible: false,
      title: '',
      body: '',
      tone: 'calm',
      ctaLabel: '',
    };
  }

  if (channel === 'DEAL_ROOM') {
    return {
      visible: true,
      title: 'Deal-room guardrail',
      body:
        'Transcript is hot. Counter slowly, do not over-explain, and let the room chase your pace.',
      tone: threat.score01 > 0.7 ? 'urgent' : 'strategic',
      ctaLabel: 'Show a clean counter',
    };
  }

  if (threat.rescueNeeded) {
    return {
      visible: true,
      title: 'Rescue window open',
      body:
        'Pressure is rising. Narrow your next move, preserve shield, and avoid feeding the crowd with panic.',
      tone: threat.score01 > 0.72 ? 'urgent' : 'blunt',
      ctaLabel: 'Give me one-card recovery',
    };
  }

  return {
    visible: true,
    title: 'Stay deliberate',
    body:
      'You do not need more volume. You need the right lane, the right timing, and one disciplined reply.',
    tone: 'strategic',
    ctaLabel: 'Suggest my next response',
  };
}

function badgeStyle(color: string, bg: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 9px',
    borderRadius: 999,
    color,
    background: bg,
    border: `1px solid ${color}22`,
    fontFamily: TOKENS.mono,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  };
}

const Badge = memo(function Badge({
  label,
  color,
  bg,
}: {
  label: string;
  color: string;
  bg: string;
}) {
  return <span style={badgeStyle(color, bg)}>{label}</span>;
});

const ThreatMeter = memo(function ThreatMeter({
  threat,
}: {
  threat: UnifiedDockThreatModel;
}) {
  const bandColor =
    THREAT_BANDS.find((entry) => entry.label === threat.band)?.color ??
    TOKENS.textSubtle;

  return (
    <div
      style={{
        border: `1px solid ${TOKENS.border}`,
        borderRadius: TOKENS.radiusMd,
        padding: 14,
        display: 'grid',
        gap: 10,
        background: 'rgba(255,255,255,0.03)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div style={{ display: 'grid', gap: 3 }}>
          <div
            style={{
              color: TOKENS.textSubtle,
              fontFamily: TOKENS.mono,
              fontSize: 11,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}
          >
            Threat meter
          </div>
          <div
            style={{
              color: TOKENS.text,
              fontFamily: TOKENS.display,
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            {threat.band}
          </div>
        </div>
        <Badge
          label={`${Math.round(threat.score01 * 100)}%`}
          color={bandColor}
          bg={`${bandColor}14`}
        />
      </div>

      <div
        style={{
          height: 10,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.05)',
          overflow: 'hidden',
          border: `1px solid ${TOKENS.border}`,
        }}
      >
        <div
          style={{
            width: `${Math.max(4, Math.round(threat.score01 * 100))}%`,
            height: '100%',
            borderRadius: 999,
            background: bandColor,
            transition: 'width 180ms ease-out',
          }}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 8,
        }}
      >
        <Badge
          label={`attacks ${threat.attackCount}`}
          color={TOKENS.red}
          bg="rgba(255,83,83,0.08)"
        />
        <Badge
          label={`taunts ${threat.tauntCount}`}
          color={TOKENS.orange}
          bg="rgba(255,154,61,0.08)"
        />
        <Badge
          label={`shield ${threat.shieldMentions}`}
          color={TOKENS.cyan}
          bg="rgba(56,221,248,0.08)"
        />
      </div>

      <div
        style={{
          color: TOKENS.textMuted,
          fontFamily: TOKENS.mono,
          fontSize: 10,
          letterSpacing: 0.35,
          textTransform: 'uppercase',
        }}
      >
        {threat.summary}
      </div>
    </div>
  );
});

const PresenceStrip = memo(function PresenceStrip({
  members,
}: {
  members: readonly UnifiedPresenceMember[];
}) {
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
      {members.map((member) => {
        const color =
          member.role === 'HATER'
            ? TOKENS.red
            : member.role === 'HELPER'
              ? TOKENS.teal
              : member.role === 'SYSTEM'
                ? TOKENS.indigo
                : TOKENS.textSubtle;

        return (
          <div
            key={member.id}
            style={{
              minWidth: 104,
              padding: '10px 11px',
              display: 'grid',
              gap: 6,
              border: `1px solid ${TOKENS.border}`,
              borderRadius: TOKENS.radiusMd,
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  background: `${color}18`,
                  border: `1px solid ${color}35`,
                  color,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: TOKENS.mono,
                  fontWeight: 700,
                  fontSize: 11,
                }}
              >
                {(member.name || '??')
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase() ?? '')
                  .join('')}
              </div>

              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    color: TOKENS.text,
                    fontFamily: TOKENS.sans,
                    fontSize: 12,
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {member.name}
                </div>
                <div
                  style={{
                    color,
                    fontFamily: TOKENS.mono,
                    fontSize: 10,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                  }}
                >
                  {member.role}
                </div>
              </div>
            </div>

            <div
              style={{
                color: member.typing ? TOKENS.text : TOKENS.textMuted,
                fontFamily: TOKENS.mono,
                fontSize: 10,
                letterSpacing: 0.3,
                textTransform: 'uppercase',
              }}
            >
              {member.typing ? 'typing…' : member.mood}
            </div>
          </div>
        );
      })}
    </div>
  );
});

const TypingIndicator = memo(function TypingIndicator({
  model,
}: {
  model: {
    actors: Array<{ id: string; name: string; role?: string; isThreat?: boolean }>;
    visible?: boolean;
    label?: string;
    compactLabel?: string;
  };
}) {
  if (!model.visible || model.actors.length === 0) return null;

  const lead = model.actors[0];
  const toneColor = lead?.isThreat
    ? TOKENS.red
    : lead?.role === 'helper'
      ? TOKENS.teal
      : TOKENS.textSubtle;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        color: TOKENS.textMuted,
        fontFamily: TOKENS.mono,
        fontSize: 11,
        letterSpacing: 0.35,
        textTransform: 'uppercase',
      }}
    >
      <span style={{ color: toneColor }}>
        {model.compactLabel ?? model.label ?? 'typing'}
      </span>
      <span style={{ display: 'inline-flex', gap: 5 }}>
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: 999,
            background: toneColor,
          }}
        />
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: 999,
            background: TOKENS.textSubtle,
          }}
        />
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: 999,
            background: TOKENS.textMuted,
          }}
        />
      </span>
    </div>
  );
});

const HelperPrompt = memo(function HelperPrompt({
  model,
  onAction,
}: {
  model: UnifiedHelperPromptModel;
  onAction: () => void;
}) {
  if (!model.visible) return null;

  const color =
    model.tone === 'urgent'
      ? TOKENS.red
      : model.tone === 'blunt'
        ? TOKENS.orange
        : model.tone === 'strategic'
          ? TOKENS.indigo
          : TOKENS.teal;

  return (
    <div
      style={{
        borderRadius: TOKENS.radiusMd,
        border: `1px solid ${color}33`,
        background: `${color}12`,
        padding: '14px 15px',
        display: 'grid',
        gap: 10,
      }}
    >
      <div
        style={{
          color,
          fontFamily: TOKENS.mono,
          fontSize: 11,
          letterSpacing: 0.45,
          textTransform: 'uppercase',
        }}
      >
        helper intervention
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <div
          style={{
            color: TOKENS.text,
            fontFamily: TOKENS.display,
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          {model.title}
        </div>
        <div
          style={{
            color: TOKENS.textSubtle,
            fontFamily: TOKENS.sans,
            fontSize: 13,
            lineHeight: 1.55,
          }}
        >
          {model.body}
        </div>
      </div>

      <button
        type="button"
        onClick={onAction}
        style={{
          appearance: 'none',
          border: `1px solid ${color}44`,
          background: `${color}18`,
          color: TOKENS.text,
          borderRadius: TOKENS.radiusSm,
          padding: '10px 12px',
          cursor: 'pointer',
          fontFamily: TOKENS.mono,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          justifySelf: 'start',
        }}
      >
        {model.ctaLabel}
      </button>
    </div>
  );
});

const TranscriptDrawer = memo(function TranscriptDrawer({
  open,
  query,
  onQueryChange,
  rows,
  onClose,
}: {
  open: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  rows: readonly UnifiedChatMessage[];
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 3,
        background: 'rgba(5,5,10,0.84)',
        backdropFilter: 'blur(10px)',
        display: 'grid',
        gridTemplateRows: 'auto auto minmax(0, 1fr)',
        gap: 12,
        padding: 16,
        borderRadius: TOKENS.radiusXl,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'grid', gap: 4 }}>
          <div
            style={{
              color: TOKENS.text,
              fontFamily: TOKENS.display,
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            Transcript drawer
          </div>
          <div
            style={{
              color: TOKENS.textSubtle,
              fontFamily: TOKENS.sans,
              fontSize: 12,
            }}
          >
            Search the visible transcript without handing authority back to the screen.
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            appearance: 'none',
            border: `1px solid ${TOKENS.borderMedium}`,
            background: 'rgba(255,255,255,0.04)',
            color: TOKENS.text,
            borderRadius: TOKENS.radiusSm,
            padding: '10px 12px',
            cursor: 'pointer',
            fontFamily: TOKENS.mono,
            fontSize: 11,
            letterSpacing: 0.45,
            textTransform: 'uppercase',
          }}
        >
          close
        </button>
      </div>

      <input
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search sender, hash, rank, message, pressure, or tick…"
        style={{
          appearance: 'none',
          outline: 'none',
          border: `1px solid ${TOKENS.borderMedium}`,
          background: 'rgba(255,255,255,0.04)',
          color: TOKENS.text,
          borderRadius: TOKENS.radiusSm,
          padding: '12px 13px',
          fontFamily: TOKENS.sans,
          fontSize: 13,
        }}
      />

      <div
        style={{
          overflowY: 'auto',
          display: 'grid',
          gap: 10,
          paddingRight: 4,
        }}
      >
        {rows.length === 0 ? (
          <div style={{ color: TOKENS.textSubtle }}>No matching transcript rows.</div>
        ) : (
          rows.map((message) => (
            <div
              key={`drawer-${message.id}`}
              style={{
                border: `1px solid ${TOKENS.border}`,
                borderRadius: TOKENS.radiusMd,
                padding: 12,
                background: 'rgba(255,255,255,0.03)',
                display: 'grid',
                gap: 6,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 10,
                  alignItems: 'center',
                }}
              >
                <div style={{ color: TOKENS.text, fontWeight: 700 }}>
                  {message.senderName}
                </div>
                <div
                  style={{
                    color: TOKENS.textMuted,
                    fontFamily: TOKENS.mono,
                    fontSize: 10,
                    letterSpacing: 0.3,
                    textTransform: 'uppercase',
                  }}
                >
                  {message.kind ?? 'PLAYER'}
                </div>
              </div>
              <div
                style={{
                  color: TOKENS.textSubtle,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {message.body}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
});

const Composer = memo(function Composer({
  channel,
  draft,
  onDraftChange,
  onSend,
  onKeyDown,
  disabled,
  rows,
}: {
  channel: VisibleChannelId;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  disabled: boolean;
  rows: number;
}) {
  const placeholder =
    channel === 'DEAL_ROOM'
      ? 'Deal Room — transcript integrity enforced…'
      : channel === 'SYNDICATE'
        ? 'Syndicate lane — stay tactical…'
        : 'Global lane — be witnessed…';

  return (
    <div
      style={{
        border: `1px solid ${TOKENS.border}`,
        borderRadius: TOKENS.radiusMd,
        padding: 12,
        display: 'grid',
        gap: 10,
        background: 'rgba(255,255,255,0.03)',
      }}
    >
      <textarea
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={onKeyDown}
        rows={rows}
        placeholder={placeholder}
        style={{
          appearance: 'none',
          resize: 'vertical',
          outline: 'none',
          border: `1px solid ${TOKENS.border}`,
          background: 'rgba(255,255,255,0.03)',
          color: TOKENS.text,
          borderRadius: TOKENS.radiusSm,
          padding: 12,
          fontFamily: TOKENS.sans,
          fontSize: 14,
          lineHeight: 1.5,
          minHeight: rows * 22 + 18,
        }}
      />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
          alignItems: 'center',
        }}
      >
        <div
          style={{
            color: TOKENS.textMuted,
            fontFamily: TOKENS.mono,
            fontSize: 10,
            letterSpacing: 0.45,
            textTransform: 'uppercase',
          }}
        >
          Shift+Enter newline · Enter send
        </div>

        <button
          type="button"
          onClick={onSend}
          disabled={disabled}
          style={{
            appearance: 'none',
            border: `1px solid ${disabled ? TOKENS.border : TOKENS.indigo}44`,
            background: disabled
              ? 'rgba(255,255,255,0.04)'
              : 'rgba(139,147,255,0.16)',
            color: disabled ? TOKENS.textMuted : TOKENS.text,
            borderRadius: TOKENS.radiusSm,
            padding: '10px 14px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontFamily: TOKENS.mono,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.45,
            textTransform: 'uppercase',
          }}
        >
          send
        </button>
      </div>
    </div>
  );
});

const CollapsedPill = memo(function CollapsedPill({
  unread,
  title,
  subtitle,
  onOpen,
}: {
  unread: number;
  title: string;
  subtitle: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        appearance: 'none',
        position: 'fixed',
        right: 18,
        bottom: 18,
        zIndex: 120,
        border: `1px solid ${unread > 0 ? TOKENS.indigo : TOKENS.borderMedium}`,
        background: TOKENS.panelGlass,
        color: TOKENS.text,
        borderRadius: 999,
        padding: '12px 14px',
        boxShadow: TOKENS.shadowHeavy,
        display: 'grid',
        gap: 4,
        cursor: 'pointer',
        minWidth: 210,
        backdropFilter: 'blur(14px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(139,147,255,0.18)',
            color: TOKENS.indigo,
            fontFamily: TOKENS.mono,
            fontWeight: 700,
            fontSize: 12,
          }}
        >
          ◎
        </span>
        <span
          style={{
            fontFamily: TOKENS.display,
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          {title}
        </span>
        {unread > 0 ? (
          <span
            style={{
              marginLeft: 'auto',
              minWidth: 22,
              height: 22,
              borderRadius: 999,
              background: TOKENS.indigo,
              color: TOKENS.panel,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: TOKENS.mono,
              fontWeight: 700,
              fontSize: 11,
              padding: '0 6px',
            }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </div>
      <div
        style={{
          color: TOKENS.textSubtle,
          textAlign: 'left',
          fontFamily: TOKENS.sans,
          fontSize: 12,
        }}
      >
        {subtitle}
      </div>
    </button>
  );
});

function buildLawFooterLines(): string[] {
  return [
    CHAT_ENGINE_RUNTIME_LAWS[0],
    CHAT_ENGINE_RUNTIME_LAWS[1],
    'one dock, many mounts, zero per-screen chat brains',
    'component lane owns shell posture, not transcript authority',
  ];
}

// ─── New helpers (patch 2026.03.17) ──────────────────────────────────────────

function getLastItem<T>(items: readonly T[]): T | null {
  return items.length > 0 ? items[items.length - 1] ?? null : null;
}

function getHelperPromptTone(
  prompt: Record<string, unknown>,
): UnifiedHelperPromptModel['tone'] {
  const rawTone = prompt['tone'];
  if (
    rawTone === 'calm' ||
    rawTone === 'blunt' ||
    rawTone === 'urgent' ||
    rawTone === 'strategic'
  ) {
    return rawTone;
  }

  const severity = prompt['severity'];
  if (severity === 'CRITICAL') return 'urgent';
  if (severity === 'WARNING') return 'blunt';
  return 'strategic';
}

function getHelperPromptCta(prompt: Record<string, unknown>): string {
  return typeof prompt['ctaLabel'] === 'string' && prompt['ctaLabel'].trim().length > 0
    ? prompt['ctaLabel']
    : 'assist';
}

const NOOP = () => undefined;
const NOOP_STRING = (_value: string) => undefined;
const NOOP_NULLABLE_STRING = (_value: string | null) => undefined;

// ─── UnifiedChatDock ─────────────────────────────────────────────────────────

export const UnifiedChatDock = memo(function UnifiedChatDock({
  gameCtx,
  onSabotage,
  accessToken = null,
  mountTarget = 'BATTLE_HUD',
  mountPreset = null,
  title = 'PZO Unified Chat',
  subtitle = 'One dock. Many mounts. Zero per-screen chat brains.',
  startCollapsed = false,
  defaultTab = 'GLOBAL',
  enableThreatMeter = true,
  enableTranscriptDrawer = true,
  enableHelperPrompt = true,
  enableRoomMeta = true,
  enableLawFooter = false,
  className,
  style,
}: UnifiedChatDockProps) {
  const bootstrapTarget = useMemo(
    () => resolveMountTarget(mountTarget),
    [mountTarget],
  );

  const bootstrapPreset = useMemo(
    () => resolveMountPresetModel(bootstrapTarget.id, mountPreset),
    [bootstrapTarget.id, mountPreset],
  );

  const pressure = usePressureEngine();
  const shield = useShieldEngine();
  const battle = useBattleEngine();
  const cascade = useCascadeEngine();
  const time = useTimeEngine();

  const ui = useUnifiedChat(gameCtx, accessToken, onSabotage);

  const openChat = ui.openChat ?? NOOP;
  const closeChat = ui.closeChat ?? NOOP;
  const collapseChat = ui.collapse ?? NOOP;
  const expandChat = ui.expand ?? NOOP;
  const sendDraft = ui.sendDraft ?? NOOP;
  const setDraft = ui.setDraft ?? NOOP_STRING;
  const quickReply = ui.quickReply ?? NOOP_STRING;
  const openTranscript = ui.openTranscript ?? NOOP;
  const closeTranscript = ui.closeTranscript ?? NOOP;
  const toggleTranscript = ui.toggleTranscript ?? NOOP;
  const setTranscriptSearchQuery = ui.setTranscriptSearchQuery ?? NOOP_STRING;
  const selectTranscriptMessage = ui.selectTranscriptMessage ?? NOOP_NULLABLE_STRING;
  const jumpToLatest = ui.jumpToLatest ?? NOOP;
  const setActiveChannel = ui.setActiveChannel ?? ui.switchTab;

  const transcriptState = ui.transcript ?? {
    open: false,
    searchQuery: '',
    selectedMessageId: null,
    newestFirst: false,
  };

  const composerState = ui.composer ?? {
    activeDraft: '',
    charCount: 0,
    maxChars: 1200,
    canSend: false,
    isNearLimit: false,
    placeholder: 'Type a message…',
  };

  const typingIndicatorModel = ui.typingIndicatorModel ?? {
    actors: [],
    visible: false,
    label: '',
    compactLabel: '',
  };

  const messageFeedActionsByMessageId = ui.messageFeedActionsByMessageId ?? {};

  const shellMode =
    typeof ui.shellMode === 'string' && ui.shellMode.trim().length > 0
      ? ui.shellMode
      : 'DOCK';

  const mountState = ui.mountState ?? {
    mountTarget: bootstrapTarget.id,
    modeScope: String(gameCtx.modeScope ?? 'GLOBAL'),
    storageNamespace: 'pzo_chat',
  };

  const runtimeBundleRecord = readRecord(ui.runtimeBundle);
  const runtimeLaws = Array.isArray(runtimeBundleRecord['laws'])
    ? runtimeBundleRecord['laws'].filter(
        (value): value is string => typeof value === 'string',
      )
    : [];

  const visibleChannels = useMemo(() => {
    const normalized = bootstrapPreset.allowedVisibleChannels
      .map((channel) => asVisibleChannel(channel, 'GLOBAL'))
      .filter(
        (channel, index, array) => array.indexOf(channel) === index,
      ) as VisibleChannelId[];

    return normalized.length > 0
      ? normalized
      : (['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'] as VisibleChannelId[]);
  }, [bootstrapPreset.allowedVisibleChannels]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const styleRef = useRef<HTMLStyleElement | null>(null);
  const stickToBottomRef = useRef(true);

  const activeTab = asVisibleChannel(ui.activeChannel, defaultTab);

  const normalizedMessages = useMemo(
    () => normalizeMessages((ui.allMessages ?? []) as ChatMessage[]),
    [ui.allMessages],
  );

  const transcriptMessages = useMemo(
    () => normalizeMessages((ui.visibleMessages ?? []) as ChatMessage[]),
    [ui.visibleMessages],
  );

  const telemetry = useMemo(
    () => createEngineTelemetry(pressure, shield, battle, cascade, time),
    [pressure, shield, battle, cascade, time],
  );

  const threat = useMemo(
    () => computeThreatModel(transcriptMessages, telemetry),
    [transcriptMessages, telemetry],
  );

  const filteredTranscriptRows = useMemo(
    () => filterTranscriptRows(transcriptState.searchQuery, transcriptMessages),
    [transcriptState.searchQuery, transcriptMessages],
  );

  const presence = useMemo(() => {
    const actors = ui.presenceStripModel?.actors ?? [];
    if (actors.length > 0) {
      return actors.map((actor) => ({
        id: actor.id,
        name: actor.name,
        role:
          actor.role === 'helper'
            ? 'HELPER'
            : actor.role === 'hater'
              ? 'HATER'
              : actor.role === 'system'
                ? 'SYSTEM'
                : actor.role === 'npc'
                  ? 'NPC'
                  : 'PLAYER',
        online: actor.status === 'online' || actor.status === 'busy',
        typing: Boolean(actor.isTyping),
        mood: actor.isThreat
          ? 'predatory'
          : actor.role === 'helper'
            ? 'rescue'
            : actor.intent === 'watching'
              ? 'alert'
              : 'calm',
      })) as UnifiedPresenceMember[];
    }

    return createPresenceModel(normalizedMessages, activeTab);
  }, [activeTab, normalizedMessages, ui.presenceStripModel]);

  const helperPrompt = useMemo(() => {
    if (ui.helperPrompt) {
      const promptRecord = ui.helperPrompt as unknown as Record<string, unknown>;

      return {
        visible: true,
        title: ui.helperPrompt.title,
        body: ui.helperPrompt.body,
        tone: getHelperPromptTone(promptRecord),
        ctaLabel: getHelperPromptCta(promptRecord),
      } satisfies UnifiedHelperPromptModel;
    }

    return createHelperPromptModel(activeTab, threat);
  }, [ui.helperPrompt, activeTab, threat]);

  const unread = ui.unread ?? {};
  const totalUnread = ui.totalUnread ?? 0;
  const connected = ui.connected ?? false;
  const shellOpen = ui.chatOpen && !(ui.collapsed ?? false);
  const effectiveUnread = Number(unread[activeTab] ?? 0) || 0;

  useEffect(() => {
    if (styleRef.current) return;

    const node = document.createElement('style');
    node.setAttribute('data-pzo-unified-chat-dock', 'true');
    node.textContent = `${FONT_IMPORT}`;
    document.head.appendChild(node);
    styleRef.current = node;

    return () => {
      node.remove();
      styleRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!shellOpen) return;

    const scroller = scrollRef.current;
    if (!scroller || !stickToBottomRef.current) return;

    scroller.scrollTo({
      top: scroller.scrollHeight,
      behavior: 'smooth',
    });
  }, [
    shellOpen,
    activeTab,
    ui.messageFeedModel?.flatRows.length ?? transcriptMessages.length,
  ]);

  useEffect(() => {
    if (!shellOpen) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      if (transcriptState.open) {
        closeTranscript();
        return;
      }

      if (bootstrapPreset.allowCollapse) {
        collapseChat();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [
    shellOpen,
    transcriptState.open,
    closeTranscript,
    collapseChat,
    bootstrapPreset.allowCollapse,
  ]);

  const handleToggleOpen = useCallback(() => {
    if (!ui.chatOpen) {
      openChat();
      expandChat();
      return;
    }

    if (ui.collapsed) {
      expandChat();
      return;
    }

    if (bootstrapPreset.allowCollapse) {
      collapseChat();
    }
  }, [
    ui.chatOpen,
    ui.collapsed,
    openChat,
    expandChat,
    collapseChat,
    bootstrapPreset.allowCollapse,
  ]);

  const handleSend = useCallback(() => {
    if (ui.sendDraft) {
      sendDraft();
      return;
    }

    const draft = composerState.activeDraft.trim();
    if (!draft) return;

    ui.sendMessage(draft);
  }, [ui.sendDraft, ui.sendMessage, sendDraft, composerState.activeDraft]);

  const handleComposerKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleHelperAction = useCallback(() => {
    if (composerState.activeDraft.trim()) return;

    const prompt =
      helperPrompt.tone === 'urgent'
        ? 'Need one-line rescue now.'
        : helperPrompt.tone === 'strategic'
          ? 'Give me the best tactical reply.'
          : helperPrompt.tone === 'blunt'
            ? 'What is the sharpest next move?'
            : 'What is the safest next message?';

    quickReply(prompt);
  }, [composerState.activeDraft, helperPrompt.tone, quickReply]);

  const handleScroll = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;

    const distanceFromBottom =
      node.scrollHeight - node.scrollTop - node.clientHeight;

    stickToBottomRef.current = distanceFromBottom < 80;
  }, []);

  const shellTitle = enableRoomMeta ? title : CHANNEL_META[activeTab].label;
  const shellSubtitle = enableRoomMeta
    ? subtitle
    : CHANNEL_META[activeTab].description;

  if (!shellOpen) {
    return (
      <CollapsedPill
        unread={totalUnread}
        title={shellTitle}
        subtitle={telemetry.summary || shellSubtitle}
        onOpen={handleToggleOpen}
      />
    );
  }

  return (
    <div
      className={className}
      data-pzo-chat-dock="true"
      data-chat-target={bootstrapTarget.id}
      data-chat-preset={bootstrapPreset.id}
      data-chat-channel={activeTab}
      data-chat-threat={threat.band.toLowerCase()}
      style={{
        position: 'relative',
        width: 'min(100%, 520px)',
        display: 'grid',
        gap: 12,
        padding: 14,
        borderRadius: TOKENS.radiusXl,
        background: TOKENS.panelGlass,
        border: `1px solid ${TOKENS.borderMedium}`,
        boxShadow: TOKENS.shadowHeavy,
        backdropFilter: 'blur(18px)',
        overflow: 'hidden',
        zIndex: bootstrapPreset.zIndex,
        ...style,
      }}
    >
      <TranscriptDrawer
        open={
          enableTranscriptDrawer &&
          bootstrapPreset.showTranscriptDrawer &&
          transcriptState.open
        }
        query={transcriptState.searchQuery}
        onQueryChange={setTranscriptSearchQuery}
        rows={filteredTranscriptRows}
        onClose={closeTranscript}
      />

      <div style={{ display: 'grid', gap: 10 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'start',
            gap: 12,
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'grid', gap: 5 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                fontFamily: TOKENS.display,
                color: TOKENS.text,
                fontWeight: 700,
                fontSize: 22,
              }}
            >
              <span style={{ color: CHANNEL_META[activeTab].accent, fontSize: 20 }}>
                {CHANNEL_META[activeTab].icon}
              </span>
              <span>{shellTitle}</span>
            </div>

            <div
              style={{
                color: TOKENS.textSubtle,
                fontFamily: TOKENS.sans,
                fontSize: 13,
                lineHeight: 1.5,
                maxWidth: 620,
              }}
            >
              {shellSubtitle}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
            <Badge
              label={connected ? 'connected' : 'offline'}
              color={connected ? TOKENS.green : TOKENS.orange}
              bg={connected ? 'rgba(32,217,142,0.08)' : 'rgba(255,154,61,0.08)'}
            />
            <Badge
              label={bootstrapPreset.label}
              color={TOKENS.indigo}
              bg="rgba(139,147,255,0.08)"
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Badge
            label={CHANNEL_META[activeTab].label}
            color={CHANNEL_META[activeTab].accent}
            bg={`${CHANNEL_META[activeTab].accent}12`}
          />
          <Badge
            label={CHAT_ENGINE_PUBLIC_MANIFEST.moduleName}
            color={TOKENS.textSubtle}
            bg="rgba(255,255,255,0.05)"
          />
          <Badge
            label={`pressure ${String(telemetry.pressureTier || 'CALM').toLowerCase()}`}
            color={telemetry.pressureCritical ? TOKENS.orange : TOKENS.textSubtle}
            bg={
              telemetry.pressureCritical
                ? 'rgba(255,154,61,0.10)'
                : 'rgba(255,255,255,0.05)'
            }
          />
          <Badge
            label={`shield ${telemetry.shieldIntegrityPct}%`}
            color={telemetry.shieldCritical ? TOKENS.red : TOKENS.cyan}
            bg={
              telemetry.shieldCritical
                ? 'rgba(255,83,83,0.10)'
                : 'rgba(56,221,248,0.10)'
            }
          />
        </div>
      </div>

      {ui.channelTabs ? (
        <ChatChannelTabs
          {...ui.channelTabs}
          className="pzo-chat-dock__channel-tabs"
        />
      ) : (
        <div
          className="pzo-chat-dock__channel-tabs"
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
        >
          {visibleChannels.map((channel) => {
            const active = channel === activeTab;
            const count = Number(unread[channel] ?? 0) || 0;
            const meta = CHANNEL_META[channel];

            return (
              <button
                key={channel}
                type="button"
                onClick={() => setActiveChannel(channel)}
                style={{
                  appearance: 'none',
                  border: `1px solid ${
                    active ? `${meta.accent}55` : TOKENS.borderMedium
                  }`,
                  background: active
                    ? `${meta.accent}18`
                    : 'rgba(255,255,255,0.04)',
                  color: TOKENS.text,
                  borderRadius: TOKENS.radiusSm,
                  padding: '10px 12px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontFamily: TOKENS.mono,
                  fontSize: 11,
                  letterSpacing: 0.35,
                  textTransform: 'uppercase',
                }}
              >
                <span style={{ color: meta.accent }}>{meta.icon}</span>
                <span>{meta.label}</span>
                {count > 0 ? (
                  <span
                    style={{
                      minWidth: 18,
                      height: 18,
                      borderRadius: 999,
                      background: meta.accent,
                      color: TOKENS.panel,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 5px',
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {bootstrapPreset.showPresenceStrip ? (
        <PresenceStrip members={presence} />
      ) : null}

      <TypingIndicator model={typingIndicatorModel} />

      {bootstrapPreset.showThreatMeter && enableThreatMeter ? (
        <ThreatMeter threat={threat} />
      ) : null}

      {enableHelperPrompt &&
      bootstrapPreset.enableHelperPrompts &&
      helperPrompt.visible ? (
        <HelperPrompt model={helperPrompt} onAction={handleHelperAction} />
      ) : null}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          border: `1px solid ${TOKENS.border}`,
          borderRadius: TOKENS.radiusMd,
          position: 'relative',
          minHeight: bootstrapPreset.compact ? 280 : 360,
          maxHeight: bootstrapPreset.compact ? 360 : 460,
          overflowY: 'auto',
          padding: 14,
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        {ui.messageFeedModel ? (
          <ChatMessageFeed
            model={ui.messageFeedModel}
            density={bootstrapPreset.compact ? 'compact' : 'comfortable'}
            onJumpToLatest={jumpToLatest}
            onLoadOlder={() => {
              openTranscript();
            }}
            onVisibleRangeChange={() => {
              // reserved telemetry lane
            }}
            onSelectMessage={(messageId) => {
              selectTranscriptMessage(messageId);
            }}
            onMessageAction={(actionId, messageId) => {
              if (actionId === 'reply') {
                selectTranscriptMessage(messageId);
                return;
              }

              if (actionId === 'counter') {
                setDraft('/counter ');
                selectTranscriptMessage(messageId);
                return;
              }

              if (actionId === 'inspect_proof') {
                openTranscript();
                selectTranscriptMessage(messageId);
              }
            }}
            cardActions={(message) =>
              messageFeedActionsByMessageId[message.id] ?? []
            }
          />
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {filteredTranscriptRows.map((message) => (
              <div
                key={message.id}
                style={{
                  border: `1px solid ${TOKENS.border}`,
                  borderRadius: TOKENS.radiusMd,
                  padding: 12,
                  background: 'rgba(255,255,255,0.03)',
                  display: 'grid',
                  gap: 6,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 10,
                    alignItems: 'center',
                  }}
                >
                  <div style={{ color: TOKENS.text, fontWeight: 700 }}>
                    {message.senderName}
                  </div>
                  <div
                    style={{
                      color: TOKENS.textMuted,
                      fontFamily: TOKENS.mono,
                      fontSize: 10,
                      letterSpacing: 0.3,
                      textTransform: 'uppercase',
                    }}
                  >
                    {message.kind ?? 'PLAYER'}
                  </div>
                </div>

                <div
                  style={{
                    color: TOKENS.textSubtle,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {message.body}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Composer
        channel={activeTab}
        draft={composerState.activeDraft}
        onDraftChange={setDraft}
        onSend={handleSend}
        onKeyDown={handleComposerKeyDown}
        disabled={!composerState.canSend}
        rows={Math.max(2, bootstrapPreset.composerRows)}
      />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Badge
            label={`target ${bootstrapTarget.label}`}
            color={TOKENS.textSubtle}
            bg="rgba(255,255,255,0.05)"
          />
          <Badge
            label={`channel ${CHANNEL_META[activeTab].label}`}
            color={CHANNEL_META[activeTab].accent}
            bg={`${CHANNEL_META[activeTab].accent}12`}
          />
          <Badge
            label={`unread ${effectiveUnread}`}
            color={totalUnread > 0 ? TOKENS.indigo : TOKENS.textMuted}
            bg={
              totalUnread > 0
                ? 'rgba(139,147,255,0.10)'
                : 'rgba(255,255,255,0.04)'
            }
          />
          <Badge
            label={`shell ${shellMode.toLowerCase()}`}
            color={TOKENS.cyan}
            bg="rgba(56,221,248,0.10)"
          />
          {telemetry.timeoutDanger ? (
            <Badge
              label={`${Math.max(0, Math.round(readNumber(time, 'ticksUntilTimeout')))}t left`}
              color={TOKENS.orange}
              bg="rgba(255,154,61,0.10)"
            />
          ) : null}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {enableTranscriptDrawer && bootstrapPreset.showTranscriptDrawer ? (
            <button
              type="button"
              onClick={toggleTranscript}
              style={{
                appearance: 'none',
                border: `1px solid ${TOKENS.borderMedium}`,
                background: 'rgba(255,255,255,0.04)',
                color: TOKENS.text,
                borderRadius: TOKENS.radiusSm,
                padding: '10px 12px',
                cursor: 'pointer',
                fontFamily: TOKENS.mono,
                fontSize: 11,
                letterSpacing: 0.45,
                textTransform: 'uppercase',
              }}
            >
              {transcriptState.open ? 'hide transcript' : 'transcript'}
            </button>
          ) : null}

          {bootstrapPreset.allowCollapse ? (
            <button
              type="button"
              onClick={handleToggleOpen}
              style={{
                appearance: 'none',
                border: `1px solid ${TOKENS.borderMedium}`,
                background: 'rgba(255,255,255,0.04)',
                color: TOKENS.text,
                borderRadius: TOKENS.radiusSm,
                padding: '10px 12px',
                cursor: 'pointer',
                fontFamily: TOKENS.mono,
                fontSize: 11,
                letterSpacing: 0.45,
                textTransform: 'uppercase',
              }}
            >
              {ui.collapsed ? 'expand' : 'collapse'}
            </button>
          ) : null}
        </div>
      </div>

      {enableLawFooter ? (
        <div style={{ display: 'grid', gap: 5, paddingTop: 2 }}>
          {Array.from(
            new Set([
              ...buildLawFooterLines(),
              ...runtimeLaws,
              `mount ${String(mountState.mountTarget).toLowerCase()}`,
              `scope ${String(mountState.modeScope).toLowerCase()}`,
            ]),
          ).map((line) => (
            <div
              key={line}
              style={{
                color: TOKENS.textMuted,
                fontFamily: TOKENS.mono,
                fontSize: 10,
                letterSpacing: 0.35,
                textTransform: 'uppercase',
              }}
            >
              {line}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
});

export default UnifiedChatDock;