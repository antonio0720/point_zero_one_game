/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT DOCK
 * FILE: pzo-web/src/components/chat/UnifiedChatDock.tsx
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
  CHAT_ENGINE_FEATURE_LAWS,
  resolveChatMountPreset,
  resolveChatMountTarget,
  type ChatMountPresetId,
  type ChatMountTargetId,
} from '../../engines/chat';

import type { ChatMessage, GameChatContext, SabotageEvent } from './chatTypes';
import { useUnifiedChat } from './useUnifiedChat';
import ChatMessageFeed from './ChatMessageFeed';


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

interface UnifiedChatMessage extends ChatMessage {
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
}

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
}

interface UnifiedHelperPromptModel {
  visible: boolean;
  title: string;
  body: string;
  tone: 'calm' | 'blunt' | 'urgent' | 'strategic';
  ctaLabel: string;
}

export interface UnifiedChatDockProps {
  gameCtx: GameChatContext;
  onSabotage?: (event: SabotageEvent) => void;
  accessToken?: string | null;
  mountTarget?: ChatMountTargetId;
  mountPreset?: ChatMountPresetId;
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
  GLOBAL: Object.freeze({ label: 'Global', icon: '◎', description: 'Theatrical crowd lane. Fast, visible, witness-heavy.', accent: TOKENS.indigo }),
  SYNDICATE: Object.freeze({ label: 'Syndicate', icon: '◈', description: 'Tactical intimacy, trust, and quiet command.', accent: TOKENS.teal }),
  DEAL_ROOM: Object.freeze({ label: 'Deal Room', icon: '◇', description: 'Predatory negotiation lane. Transcript-sensitive.', accent: TOKENS.yellow }),
} as const);

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

function asVisibleChannel(value: unknown, fallback: VisibleChannelId = 'GLOBAL'): VisibleChannelId {
  return value === 'GLOBAL' || value === 'SYNDICATE' || value === 'DEAL_ROOM' ? value : fallback;
}

function normalizeMessages(messages: readonly ChatMessage[]): UnifiedChatMessage[] {
  return messages.map((value, index) => {
    const candidate = value as UnifiedChatMessage;
    return {
      ...candidate,
      id: candidate.id ?? `msg-${index}-${candidate.senderId ?? 'unknown'}-${candidate.ts ?? index}`,
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

function createPresenceModel(messages: readonly UnifiedChatMessage[], channel: VisibleChannelId): UnifiedPresenceMember[] {
  const recent = messages.filter((message) => asVisibleChannel(message.channel, 'GLOBAL') === channel).slice(-18);
  const map = new Map<string, UnifiedPresenceMember>();

  for (const message of recent) {
    const senderId = message.senderId ?? `sender:${message.senderName ?? 'unknown'}`;
    if (map.has(senderId)) continue;
    const kind = message.kind ?? 'PLAYER';
    map.set(senderId, {
      id: senderId,
      name: message.senderName ?? 'Unknown',
      role: kind === 'SYSTEM' ? 'SYSTEM' : kind.startsWith('BOT_') ? 'HATER' : message.senderId === 'player-local' ? 'PLAYER' : 'NPC',
      online: true,
      typing: false,
      mood: kind === 'BOT_ATTACK' ? 'predatory' : kind === 'BOT_TAUNT' ? 'heated' : kind === 'SHIELD_EVENT' ? 'alert' : 'calm',
    });
  }

  const values = Array.from(map.values()).slice(0, 6);
  if (values.length === 0) {
    return [{ id: 'system-observer', name: channel === 'DEAL_ROOM' ? 'Deal Ledger' : 'Observer Mesh', role: 'SYSTEM', online: true, typing: false, mood: channel === 'DEAL_ROOM' ? 'predatory' : 'calm' }];
  }
  return values;
}

function computeThreatModel(messages: readonly UnifiedChatMessage[]): UnifiedDockThreatModel {
  let attackCount = 0;
  let tauntCount = 0;
  let shieldMentions = 0;
  let severeWeight = 0;

  for (const message of messages) {
    const kind = message.kind ?? 'PLAYER';
    if (kind === 'BOT_ATTACK') {
      attackCount += 1;
      severeWeight += 0.22;
    } else if (kind === 'BOT_TAUNT') {
      tauntCount += 1;
      severeWeight += 0.12;
    } else if (kind === 'CASCADE_ALERT') {
      severeWeight += 0.16;
    }

    if ((message.body ?? '').toLowerCase().includes('shield') || kind === 'SHIELD_EVENT') {
      shieldMentions += 1;
      severeWeight += 0.06;
    }
  }

  const score01 = clamp01(severeWeight);
  const band = THREAT_BANDS.find((entry) => score01 <= entry.max)?.label ?? 'SEVERE';
  return { score01, band, attackCount, tauntCount, shieldMentions, rescueNeeded: score01 >= 0.58 || shieldMentions >= 2 };
}

function createHelperPromptModel(channel: VisibleChannelId, threat: UnifiedDockThreatModel): UnifiedHelperPromptModel {
  if (threat.score01 < 0.38) return { visible: false, title: '', body: '', tone: 'calm', ctaLabel: '' };
  if (channel === 'DEAL_ROOM') {
    return { visible: true, title: 'Deal-room guardrail', body: 'Transcript is hot. Counter slowly, do not over-explain, and let the room chase your pace.', tone: threat.score01 > 0.7 ? 'urgent' : 'strategic', ctaLabel: 'Show a clean counter' };
  }
  if (threat.rescueNeeded) {
    return { visible: true, title: 'Rescue window open', body: 'Pressure is rising. Narrow your next move, preserve shield, and avoid feeding the crowd with panic.', tone: threat.score01 > 0.72 ? 'urgent' : 'blunt', ctaLabel: 'Give me one-card recovery' };
  }
  return { visible: true, title: 'Stay deliberate', body: 'You do not need more volume. You need the right lane, the right timing, and one disciplined reply.', tone: 'strategic', ctaLabel: 'Suggest my next response' };
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

const Badge = memo(function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <span style={badgeStyle(color, bg)}>{label}</span>;
});

const ChannelTabButton = memo(function ChannelTabButton({ channel, active, unread, onClick }: { channel: VisibleChannelId; active: boolean; unread: number; onClick: () => void }) {
  const meta = CHANNEL_META[channel];
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        appearance: 'none',
        border: `1px solid ${active ? meta.accent : TOKENS.border}`,
        background: active ? `${meta.accent}18` : 'rgba(255,255,255,0.02)',
        color: active ? TOKENS.text : TOKENS.textSubtle,
        padding: '10px 12px',
        borderRadius: TOKENS.radiusSm,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
        minHeight: 42,
        fontFamily: TOKENS.mono,
        fontSize: 12,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
      }}
      aria-pressed={active}
    >
      <span style={{ color: meta.accent, fontSize: 16 }}>{meta.icon}</span>
      <span>{meta.label}</span>
      {unread > 0 ? (
        <span style={{ marginLeft: 'auto', minWidth: 18, height: 18, borderRadius: 999, background: active ? meta.accent : TOKENS.panel, color: active ? TOKENS.panel : TOKENS.text, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, padding: '0 5px' }}>
          {unread > 99 ? '99+' : unread}
        </span>
      ) : null}
    </button>
  );
});

const ThreatMeter = memo(function ThreatMeter({ threat }: { threat: UnifiedDockThreatModel }) {
  const bandColor = THREAT_BANDS.find((entry) => entry.label === threat.band)?.color ?? TOKENS.textSubtle;
  return (
    <div style={{ border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusMd, padding: 14, display: 'grid', gap: 10, background: 'rgba(255,255,255,0.03)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'grid', gap: 3 }}>
          <div style={{ color: TOKENS.textSubtle, fontFamily: TOKENS.mono, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' }}>Threat meter</div>
          <div style={{ color: TOKENS.text, fontFamily: TOKENS.display, fontSize: 18, fontWeight: 700 }}>{threat.band}</div>
        </div>
        <Badge label={`${Math.round(threat.score01 * 100)}%`} color={bandColor} bg={`${bandColor}14`} />
      </div>
      <div style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.05)', overflow: 'hidden', border: `1px solid ${TOKENS.border}` }}>
        <div style={{ width: `${Math.max(4, Math.round(threat.score01 * 100))}%`, height: '100%', borderRadius: 999, background: bandColor, transition: 'width 180ms ease-out' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        <Badge label={`attacks ${threat.attackCount}`} color={TOKENS.red} bg='rgba(255,83,83,0.08)' />
        <Badge label={`taunts ${threat.tauntCount}`} color={TOKENS.orange} bg='rgba(255,154,61,0.08)' />
        <Badge label={`shield ${threat.shieldMentions}`} color={TOKENS.cyan} bg='rgba(56,221,248,0.08)' />
      </div>
    </div>
  );
});

const PresenceStrip = memo(function PresenceStrip({ members }: { members: readonly UnifiedPresenceMember[] }) {
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
      {members.map((member) => {
        const color = member.role === 'HATER' ? TOKENS.red : member.role === 'HELPER' ? TOKENS.teal : member.role === 'SYSTEM' ? TOKENS.indigo : TOKENS.textSubtle;
        return (
          <div key={member.id} style={{ minWidth: 104, padding: '10px 11px', display: 'grid', gap: 6, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusMd, background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 999, background: `${color}18`, border: `1px solid ${color}35`, color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: TOKENS.mono, fontWeight: 700, fontSize: 11 }}>
                {(member.name || '??').split(/\s+/).filter(Boolean).slice(0,2).map((p) => p[0]?.toUpperCase() ?? '').join('')}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: TOKENS.text, fontFamily: TOKENS.sans, fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name}</div>
                <div style={{ color, fontFamily: TOKENS.mono, fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase' }}>{member.role}</div>
              </div>
            </div>
            <div style={{ color: member.typing ? TOKENS.text : TOKENS.textMuted, fontFamily: TOKENS.mono, fontSize: 10, letterSpacing: 0.3, textTransform: 'uppercase' }}>{member.typing ? 'typing…' : member.mood}</div>
          </div>
        );
      })}
    </div>
  );
});

const HelperPrompt = memo(function HelperPrompt({ model, onAction }: { model: UnifiedHelperPromptModel; onAction: () => void }) {
  if (!model.visible) return null;
  const color = model.tone === 'urgent' ? TOKENS.red : model.tone === 'blunt' ? TOKENS.orange : model.tone === 'strategic' ? TOKENS.indigo : TOKENS.teal;
  return (
    <div style={{ borderRadius: TOKENS.radiusMd, border: `1px solid ${color}33`, background: `${color}12`, padding: '14px 15px', display: 'grid', gap: 10 }}>
      <div style={{ color, fontFamily: TOKENS.mono, fontSize: 11, letterSpacing: 0.45, textTransform: 'uppercase' }}>helper intervention</div>
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ color: TOKENS.text, fontFamily: TOKENS.display, fontWeight: 700, fontSize: 16 }}>{model.title}</div>
        <div style={{ color: TOKENS.textSubtle, fontFamily: TOKENS.sans, fontSize: 13, lineHeight: 1.55 }}>{model.body}</div>
      </div>
      <button type="button" onClick={onAction} style={{ appearance: 'none', border: `1px solid ${color}44`, background: `${color}18`, color: TOKENS.text, borderRadius: TOKENS.radiusSm, padding: '10px 12px', cursor: 'pointer', fontFamily: TOKENS.mono, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', justifySelf: 'start' }}>
        {model.ctaLabel}
      </button>
    </div>
  );
});

const TranscriptDrawer = memo(function TranscriptDrawer({ open, query, onQueryChange, rows, onClose }: { open: boolean; query: string; onQueryChange: (value: string) => void; rows: readonly UnifiedChatMessage[]; onClose: () => void }) {
  if (!open) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 3, background: 'rgba(5,5,10,0.84)', backdropFilter: 'blur(10px)', display: 'grid', gridTemplateRows: 'auto auto minmax(0, 1fr)', gap: 12, padding: 16, borderRadius: TOKENS.radiusXl }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <div style={{ color: TOKENS.text, fontFamily: TOKENS.display, fontSize: 18, fontWeight: 700 }}>Transcript drawer</div>
          <div style={{ color: TOKENS.textSubtle, fontFamily: TOKENS.sans, fontSize: 12 }}>Search the visible transcript without handing authority back to the screen.</div>
        </div>
        <button type="button" onClick={onClose} style={{ appearance: 'none', border: `1px solid ${TOKENS.borderMedium}`, background: 'rgba(255,255,255,0.04)', color: TOKENS.text, borderRadius: TOKENS.radiusSm, padding: '10px 12px', cursor: 'pointer', fontFamily: TOKENS.mono, fontSize: 11, letterSpacing: 0.45, textTransform: 'uppercase' }}>close</button>
      </div>
      <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder='Search sender, hash, rank, message, pressure, or tick…' style={{ appearance: 'none', outline: 'none', border: `1px solid ${TOKENS.borderMedium}`, background: 'rgba(255,255,255,0.04)', color: TOKENS.text, borderRadius: TOKENS.radiusSm, padding: '12px 13px', fontFamily: TOKENS.sans, fontSize: 13 }} />
      <div style={{ overflowY: 'auto', display: 'grid', gap: 10, paddingRight: 4 }}>
        {rows.length === 0 ? <div style={{ color: TOKENS.textSubtle }}>No matching transcript rows.</div> : rows.map((message) => <div key={`drawer-${message.id}`} style={{ border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusMd, padding: 12, background: 'rgba(255,255,255,0.03)', display: 'grid', gap: 6 }}><div style={{ color: TOKENS.text, fontWeight: 700 }}>{message.senderName}</div><div style={{ color: TOKENS.textSubtle, whiteSpace: 'pre-wrap' }}>{message.body}</div></div>)}
      </div>
    </div>
  );
});

const Composer = memo(function Composer({ channel, draft, onDraftChange, onSend, onKeyDown, disabled, rows }: { channel: VisibleChannelId; draft: string; onDraftChange: (value: string) => void; onSend: () => void; onKeyDown?: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void; disabled: boolean; rows: number }) {
  const placeholder = channel === 'DEAL_ROOM' ? 'Deal Room — transcript integrity enforced…' : channel === 'SYNDICATE' ? 'Syndicate lane — stay tactical…' : 'Global lane — be witnessed…';
  return (
    <div style={{ border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusMd, padding: 12, display: 'grid', gap: 10, background: 'rgba(255,255,255,0.03)' }}>
      <textarea value={draft} onChange={(event) => onDraftChange(event.target.value)} onKeyDown={onKeyDown} rows={rows} placeholder={placeholder} style={{ appearance: 'none', resize: 'vertical', outline: 'none', border: `1px solid ${TOKENS.border}`, background: 'rgba(255,255,255,0.03)', color: TOKENS.text, borderRadius: TOKENS.radiusSm, padding: 12, fontFamily: TOKENS.sans, fontSize: 14, lineHeight: 1.5, minHeight: rows * 22 + 18 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <div style={{ color: TOKENS.textMuted, fontFamily: TOKENS.mono, fontSize: 10, letterSpacing: 0.45, textTransform: 'uppercase' }}>Shift+Enter newline · Enter send</div>
        <button type="button" onClick={onSend} disabled={disabled} style={{ appearance: 'none', border: `1px solid ${disabled ? TOKENS.border : TOKENS.indigo}44`, background: disabled ? 'rgba(255,255,255,0.04)' : 'rgba(139,147,255,0.16)', color: disabled ? TOKENS.textMuted : TOKENS.text, borderRadius: TOKENS.radiusSm, padding: '10px 14px', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: TOKENS.mono, fontSize: 11, fontWeight: 700, letterSpacing: 0.45, textTransform: 'uppercase' }}>send</button>
      </div>
    </div>
  );
});

const CollapsedPill = memo(function CollapsedPill({ unread, title, subtitle, onOpen }: { unread: number; title: string; subtitle: string; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} style={{ appearance: 'none', position: 'fixed', right: 18, bottom: 18, zIndex: 120, border: `1px solid ${unread > 0 ? TOKENS.indigo : TOKENS.borderMedium}`, background: TOKENS.panelGlass, color: TOKENS.text, borderRadius: 999, padding: '12px 14px', boxShadow: TOKENS.shadowHeavy, display: 'grid', gap: 4, cursor: 'pointer', minWidth: 210, backdropFilter: 'blur(14px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 28, height: 28, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(139,147,255,0.18)', color: TOKENS.indigo, fontFamily: TOKENS.mono, fontWeight: 700, fontSize: 12 }}>◎</span>
        <span style={{ fontFamily: TOKENS.display, fontWeight: 700, fontSize: 16 }}>{title}</span>
        {unread > 0 ? <span style={{ marginLeft: 'auto', minWidth: 22, height: 22, borderRadius: 999, background: TOKENS.indigo, color: TOKENS.panel, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: TOKENS.mono, fontWeight: 700, fontSize: 11, padding: '0 6px' }}>{unread > 99 ? '99+' : unread}</span> : null}
      </div>
      <div style={{ color: TOKENS.textSubtle, textAlign: 'left', fontFamily: TOKENS.sans, fontSize: 12 }}>{subtitle}</div>
    </button>
  );
});

function buildLawFooterLines(): string[] {
  return [CHAT_ENGINE_RUNTIME_LAWS[0], CHAT_ENGINE_RUNTIME_LAWS[1], CHAT_ENGINE_FEATURE_LAWS[0], CHAT_ENGINE_FEATURE_LAWS[1]];
}

export const UnifiedChatDock = memo(function UnifiedChatDock({
  gameCtx,
  onSabotage,
  accessToken = null,
  mountTarget = 'BattleHUD',
  mountPreset,
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
  const bootstrapPreset = resolveChatMountPreset(mountTarget, mountPreset);
  const bootstrapTarget = resolveChatMountTarget(mountTarget);

  const ui = useUnifiedChat({
    ctx: gameCtx,
    accessToken,
    onSabotage,
    shellMode: 'DOCK',
    initialChannel: defaultTab,
    initialOpen: true,
    initialCollapsed: startCollapsed,
    initialTranscriptOpen: false,
    initialTranscriptSearch: '',
    persistUiState: true,
    persistDrafts: true,
    storageNamespace: `dock:${mountTarget}`,
  });

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const styleRef = useRef<HTMLStyleElement | null>(null);
  const activeTab = asVisibleChannel(ui.activeChannel, defaultTab);

  const normalizedMessages = useMemo(() => normalizeMessages((ui.allMessages ?? []) as ChatMessage[]), [ui.allMessages]);
  const transcriptMessages = useMemo(() => normalizeMessages((ui.visibleMessages ?? []) as ChatMessage[]), [ui.visibleMessages]);
  const threat = useMemo(() => computeThreatModel(transcriptMessages), [transcriptMessages]);
  const presence = useMemo(() => createPresenceModel(normalizedMessages, activeTab), [normalizedMessages, activeTab]);
  const helperPrompt = useMemo(() => {
    if (ui.helperPrompt) {
      return {
        visible: true,
        title: ui.helperPrompt.title,
        body: ui.helperPrompt.body,
        tone: ui.helperPrompt.severity === 'CRITICAL' ? 'urgent' : ui.helperPrompt.severity === 'WARNING' ? 'blunt' : 'strategic',
        ctaLabel: ui.helperPrompt.ctaLabel ?? 'assist',
      } satisfies UnifiedHelperPromptModel;
    }
    return createHelperPromptModel(activeTab, threat);
  }, [ui.helperPrompt, activeTab, threat]);

  const unread = ui.unread ?? {};
  const totalUnread = ui.totalUnread ?? 0;
  const connected = ui.connected ?? false;
  const shellOpen = ui.chatOpen && !ui.collapsed;
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
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [shellOpen, ui.messageFeedModel.flatRows.length, activeTab, ui.messageFeedModel.flatRows]);

  const handleSwitchTab = useCallback((tab: VisibleChannelId) => { ui.setActiveChannel(tab); }, [ui]);
  const handleToggleOpen = useCallback(() => {
    if (!ui.chatOpen) {
      ui.openChat();
      ui.expand();
      return;
    }
    if (ui.collapsed) {
      ui.expand();
      return;
    }
    ui.collapse();
  }, [ui]);
  const handleSend = useCallback(() => { ui.sendDraft(); }, [ui]);
  const handleComposerKeyDown = useCallback((event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }, [handleSend]);
  const handleHelperAction = useCallback(() => {
    if (ui.composer.activeDraft.trim()) return;
    const prompt = helperPrompt.tone === 'urgent' ? 'Need one-line rescue now.' : helperPrompt.tone === 'strategic' ? 'Give me the best tactical reply.' : helperPrompt.tone === 'blunt' ? 'What is the sharpest next move?' : 'What is the safest next message?';
    ui.quickReply(prompt);
  }, [helperPrompt.tone, ui]);

  const shellTitle = enableRoomMeta ? title : CHANNEL_META[activeTab].label;
  const shellSubtitle = enableRoomMeta ? subtitle : CHANNEL_META[activeTab].description;

  if (!shellOpen) {
    return <CollapsedPill unread={totalUnread} title={shellTitle} subtitle={shellSubtitle} onOpen={handleToggleOpen} />;
  }

  return (
    <div className={className} style={{ position: 'relative', width: 'min(100%, 520px)', display: 'grid', gap: 12, padding: 14, borderRadius: TOKENS.radiusXl, background: TOKENS.panelGlass, border: `1px solid ${TOKENS.borderMedium}`, boxShadow: TOKENS.shadowHeavy, backdropFilter: 'blur(18px)', overflow: 'hidden', zIndex: bootstrapPreset.zIndex, ...style }}>
      <TranscriptDrawer open={enableTranscriptDrawer && ui.transcript.open} query={ui.transcript.searchQuery} onQueryChange={ui.setTranscriptSearchQuery} rows={transcriptMessages} onClose={ui.closeTranscript} />

      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'start', gap: 12, justifyContent: 'space-between' }}>
          <div style={{ display: 'grid', gap: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontFamily: TOKENS.display, color: TOKENS.text, fontWeight: 700, fontSize: 22 }}>
              <span style={{ color: CHANNEL_META[activeTab].accent, fontSize: 20 }}>{CHANNEL_META[activeTab].icon}</span>
              <span>{shellTitle}</span>
            </div>
            <div style={{ color: TOKENS.textSubtle, fontFamily: TOKENS.sans, fontSize: 13, lineHeight: 1.5, maxWidth: 620 }}>{shellSubtitle}</div>
          </div>
          <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
            <Badge label={connected ? 'connected' : 'offline'} color={connected ? TOKENS.green : TOKENS.orange} bg={connected ? 'rgba(32,217,142,0.08)' : 'rgba(255,154,61,0.08)'} />
            <Badge label={bootstrapPreset.label} color={TOKENS.indigo} bg='rgba(139,147,255,0.08)' />
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Badge label={CHANNEL_META[activeTab].label} color={CHANNEL_META[activeTab].accent} bg={`${CHANNEL_META[activeTab].accent}12`} />
          <Badge label={CHAT_ENGINE_PUBLIC_MANIFEST.moduleName} color={TOKENS.textSubtle} bg='rgba(255,255,255,0.05)' />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        {(['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'] as const).map((channel) => (
          <ChannelTabButton key={channel} channel={channel} active={activeTab === channel} unread={Number(unread[channel] ?? 0)} onClick={() => handleSwitchTab(channel)} />
        ))}
      </div>

      {bootstrapPreset.showPresenceStrip ? <PresenceStrip members={presence} /> : null}
      {bootstrapPreset.showThreatMeter && enableThreatMeter ? <ThreatMeter threat={threat} /> : null}
      {enableHelperPrompt && bootstrapPreset.enableHelperPrompts && helperPrompt.visible ? <HelperPrompt model={helperPrompt} onAction={handleHelperAction} /> : null}

      <div ref={scrollRef} style={{ border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusMd, position: 'relative', minHeight: bootstrapPreset.compact ? 280 : 360, maxHeight: bootstrapPreset.compact ? 360 : 460, overflowY: 'auto', padding: 14, background: 'rgba(255,255,255,0.02)' }}>
        <ChatMessageFeed
          model={ui.messageFeedModel}
          density={bootstrapPreset.compact ? 'compact' : 'comfortable'}
          onJumpToLatest={ui.jumpToLatest}
          onLoadOlder={() => {
            ui.openTranscript();
          }}
          onVisibleRangeChange={() => {
            // telemetry reserved
          }}
          onSelectMessage={(messageId) => {
            ui.selectTranscriptMessage(messageId);
          }}
          onMessageAction={(actionId, messageId) => {
            if (actionId === 'reply') {
              ui.selectTranscriptMessage(messageId);
              return;
            }
            if (actionId === 'counter') {
              ui.setDraft('/counter ');
              ui.selectTranscriptMessage(messageId);
              return;
            }
            if (actionId === 'inspect_proof') {
              ui.openTranscript();
              ui.selectTranscriptMessage(messageId);
            }
          }}
          cardActions={(message) => ui.messageFeedActionsByMessageId[message.id] ?? []}
        />
      </div>

      <Composer channel={activeTab} draft={ui.composer.activeDraft} onDraftChange={ui.setDraft} onSend={handleSend} onKeyDown={handleComposerKeyDown} disabled={!ui.composer.canSend} rows={Math.max(2, bootstrapPreset.composerRows)} />

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Badge label={`target ${bootstrapTarget.label}`} color={TOKENS.textSubtle} bg='rgba(255,255,255,0.05)' />
          <Badge label={`channel ${CHANNEL_META[activeTab].label}`} color={CHANNEL_META[activeTab].accent} bg={`${CHANNEL_META[activeTab].accent}12`} />
          <Badge label={`unread ${effectiveUnread}`} color={totalUnread > 0 ? TOKENS.indigo : TOKENS.textMuted} bg={totalUnread > 0 ? 'rgba(139,147,255,0.10)' : 'rgba(255,255,255,0.04)'} />
          <Badge label={`shell ${ui.shellMode.toLowerCase()}`} color={TOKENS.cyan} bg='rgba(56,221,248,0.10)' />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {enableTranscriptDrawer && bootstrapPreset.showTranscriptDrawer ? (
            <button type="button" onClick={ui.toggleTranscript} style={{ appearance: 'none', border: `1px solid ${TOKENS.borderMedium}`, background: 'rgba(255,255,255,0.04)', color: TOKENS.text, borderRadius: TOKENS.radiusSm, padding: '10px 12px', cursor: 'pointer', fontFamily: TOKENS.mono, fontSize: 11, letterSpacing: 0.45, textTransform: 'uppercase' }}>
              {ui.transcript.open ? 'hide transcript' : 'transcript'}
            </button>
          ) : null}
          <button type="button" onClick={handleToggleOpen} style={{ appearance: 'none', border: `1px solid ${TOKENS.borderMedium}`, background: 'rgba(255,255,255,0.04)', color: TOKENS.text, borderRadius: TOKENS.radiusSm, padding: '10px 12px', cursor: 'pointer', fontFamily: TOKENS.mono, fontSize: 11, letterSpacing: 0.45, textTransform: 'uppercase' }}>
            {ui.collapsed ? 'expand' : 'collapse'}
          </button>
        </div>
      </div>

      {enableLawFooter ? (
        <div style={{ display: 'grid', gap: 5, paddingTop: 2 }}>
          {Array.from(new Set([...buildLawFooterLines(), ...ui.runtimeBundle.laws, `mount ${ui.mountState.mountTarget.toLowerCase()}`, `scope ${ui.mountState.modeScope.toLowerCase()}`])).map((line) => (
            <div key={line} style={{ color: TOKENS.textMuted, fontFamily: TOKENS.mono, fontSize: 10, letterSpacing: 0.35, textTransform: 'uppercase' }}>{line}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
});

export default UnifiedChatDock;
