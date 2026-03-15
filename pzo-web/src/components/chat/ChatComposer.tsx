// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/components/chat/ChatComposer.tsx

/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT COMPOSER
 * FILE: pzo-web/src/components/chat/ChatComposer.tsx
 * ============================================================================
 *
 * Render-only composer primitive for the unified chat shell.
 *
 * This file stays in the UI lane.
 * It does not own sockets, ML/DL truth, hater behavior, battle authority,
 * transcript enforcement, or server transport. It consumes those results through
 * props and turns them into a premium tactical input surface.
 *
 * Design goals:
 * - channel-aware without becoming channel authority
 * - pressure-aware without mutating engine state
 * - helper-aware without making rescue decisions
 * - proof-aware without claiming transcript ownership
 * - keyboard-fast, mobile-safe, render-only, and migration-friendly
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import React, {
  memo,
  useMemo,
  useRef,
  useEffect,
  useState,
  useCallback,
  type CSSProperties,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';

import * as SharedChat from '../../../../shared/contracts/chat';
import type {
  ChatComposerProps,
  ChatComposerSubmitPayload,
  ComposerDiagnosticLine,
  ComposerHintLine,
  ComposerModePreset,
  ComposerNetworkState,
  ComposerQuickAccent,
  ComposerQuickInsert,
  ComposerReplyPreview,
  ComposerSubmitState,
  ComposerThreatBand,
  ComposerTone,
} from './uiTypes';

type ChatChannel = SharedChat.ChatChannelsModule.ChatVisibleChannel;

export type {
  ChatComposerProps,
  ChatComposerSubmitPayload,
  ComposerDiagnosticLine,
  ComposerHintLine,
  ComposerModePreset,
  ComposerNetworkState,
  ComposerQuickAccent,
  ComposerQuickInsert,
  ComposerReplyPreview,
  ComposerSubmitState,
  ComposerThreatBand,
  ComposerTone,
} from './uiTypes';

type ChannelPresentation = {
  label: string;
  emoji: string;
  accent: string;
  placeholder: string;
  sendLabel: string;
  helperCopy: string;
  proofCopy: string;
  threatCopy: Record<ComposerThreatBand, string>;
};

type MeterBand = 'SAFE' | 'NEAR' | 'LIMIT' | 'OVER';

type AccentPalette = {
  text: string;
  bg: string;
  border: string;
};

const T = {
  void: '#04040A',
  panel: '#0B0B18',
  card: '#111124',
  cardHi: '#16162E',
  border: 'rgba(255,255,255,0.09)',
  borderHi: 'rgba(255,255,255,0.18)',
  text: '#F4F4FF',
  textSub: '#A6A6C8',
  textMute: '#666689',
  success: '#27DE8B',
  successSoft: 'rgba(39,222,139,0.16)',
  warning: '#FFBA52',
  warningSoft: 'rgba(255,186,82,0.16)',
  danger: '#FF5F6D',
  dangerSoft: 'rgba(255,95,109,0.18)',
  info: '#67C9FF',
  infoSoft: 'rgba(103,201,255,0.16)',
  indigo: '#8A8EFF',
  indigoSoft: 'rgba(138,142,255,0.16)',
  teal: '#25D3EE',
  tealSoft: 'rgba(37,211,238,0.16)',
  green: '#34D399',
  yellow: '#FACC15',
  orange: '#FB923C',
  shadow: '0 12px 36px rgba(0,0,0,0.34)',
  mono: "'IBM Plex Mono', 'JetBrains Mono', monospace",
  display: "'Syne', 'Outfit', system-ui, sans-serif",
};

const CHANNELS: Record<ChatChannel, ChannelPresentation> = {
  GLOBAL: {
    label: 'GLOBAL',
    emoji: '🌐',
    accent: T.indigo,
    placeholder: 'Message global...',
    sendLabel: 'Transmit',
    helperCopy: 'Signal a helper without leaving the channel.',
    proofCopy: 'Global chat is visible, fast, and socially volatile.',
    threatCopy: {
      QUIET: 'Global is quiet.',
      LOW: 'A few eyes are on the feed.',
      ELEVATED: 'Global attention is rising.',
      HIGH: 'Crowd heat is building.',
      SEVERE: 'Global is fully watching.',
    },
  },
  SYNDICATE: {
    label: 'SYNDICATE',
    emoji: '🜁',
    accent: T.green,
    placeholder: 'Message your syndicate...',
    sendLabel: 'Commit',
    helperCopy: 'Signal partner support or tactical advice.',
    proofCopy: 'Syndicate chat is tactical, intimate, and alliance-sensitive.',
    threatCopy: {
      QUIET: 'Syndicate room is calm.',
      LOW: 'Partner awareness is active.',
      ELEVATED: 'Signals are tightening.',
      HIGH: 'Coordination pressure is up.',
      SEVERE: 'This room is running hot.',
    },
  },
  DEAL_ROOM: {
    label: 'DEAL ROOM',
    emoji: '⚖️',
    accent: T.yellow,
    placeholder: 'Deal Room — transcript recorded...',
    sendLabel: 'Record',
    helperCopy: 'Request a clean exit or leverage read.',
    proofCopy: 'Transcript integrity enforced — every line can become a receipt.',
    threatCopy: {
      QUIET: 'Deal room pressure is low.',
      LOW: 'Negotiation tone is measured.',
      ELEVATED: 'The room is testing leverage.',
      HIGH: 'Pressure tactics are active.',
      SEVERE: 'Everything here is predatory.',
    },
  },
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function formatCooldown(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  if (safe < 1000) return `${safe}ms`;
  const sec = Math.ceil(safe / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem ? `${min}m ${rem}s` : `${min}m`;
}

function meterBand(length: number, limit: number): MeterBand {
  if (length > limit) return 'OVER';
  if (length >= Math.floor(limit * 0.95)) return 'LIMIT';
  if (length >= Math.floor(limit * 0.8)) return 'NEAR';
  return 'SAFE';
}

function accentPalette(accent: ComposerQuickAccent): AccentPalette {
  switch (accent) {
    case 'success':
      return { text: T.success, bg: T.successSoft, border: 'rgba(39,222,139,0.35)' };
    case 'warning':
      return { text: T.warning, bg: T.warningSoft, border: 'rgba(255,186,82,0.35)' };
    case 'danger':
      return { text: T.danger, bg: T.dangerSoft, border: 'rgba(255,95,109,0.35)' };
    case 'info':
      return { text: T.info, bg: T.infoSoft, border: 'rgba(103,201,255,0.35)' };
    default:
      return { text: T.indigo, bg: T.indigoSoft, border: 'rgba(138,142,255,0.35)' };
  }
}

function tonePalette(tone: ComposerTone): AccentPalette {
  switch (tone) {
    case 'success':
      return accentPalette('success');
    case 'warning':
      return accentPalette('warning');
    case 'danger':
      return accentPalette('danger');
    case 'info':
      return accentPalette('info');
    default:
      return accentPalette('default');
  }
}

function networkLabel(state: ComposerNetworkState): string {
  switch (state) {
    case 'ONLINE':
      return 'ONLINE';
    case 'CONNECTING':
      return 'SYNCING';
    case 'DEGRADED':
      return 'DEGRADED';
    case 'OFFLINE':
    default:
      return 'OFFLINE';
  }
}

function submitLabel(state: ComposerSubmitState, channel: ChatChannel): string {
  const p = CHANNELS[channel];
  switch (state) {
    case 'SENDING':
      return 'Sending...';
    case 'BLOCKED':
      return 'Blocked';
    case 'COOLDOWN':
      return 'Cooling';
    default:
      return p.sendLabel;
  }
}

function isBlocked(state: ComposerSubmitState, disabled: boolean, locked: boolean, empty: boolean, overLimit: boolean): boolean {
  if (disabled || locked || empty || overLimit) return true;
  return state === 'BLOCKED' || state === 'SENDING' || state === 'COOLDOWN';
}

function defaultQuickInserts(channel: ChatChannel): ComposerQuickInsert[] {
  if (channel === 'DEAL_ROOM') {
    return [
      { id: 'firm-offer', label: 'Firm Offer', value: 'Final offer. Timestamping this position now.', emoji: '🧾', accent: 'warning' },
      { id: 'counter', label: 'Counter', value: 'Counterpoint: risk, timing, and valuation do not support that price.', emoji: '⚖️', accent: 'default' },
      { id: 'need-time', label: 'Need Time', value: 'Reviewing terms. Hold this line.', emoji: '⏳', accent: 'info' },
      { id: 'walk', label: 'Walk', value: 'No deal. Logging this outcome and exiting the room.', emoji: '🚪', accent: 'danger', destructive: true },
    ];
  }
  if (channel === 'SYNDICATE') {
    return [
      { id: 'need-cover', label: 'Need Cover', value: 'Need cover. Pressure window is tightening.', emoji: '🛡️', accent: 'success', helper: true },
      { id: 'hold-line', label: 'Hold Line', value: 'Hold the line. No panic.', emoji: '🜁', accent: 'info' },
      { id: 'stack-income', label: 'Stack Income', value: 'Stack income first. Delay vanity plays.', emoji: '💸', accent: 'default' },
      { id: 'risk-rising', label: 'Risk Rising', value: 'Risk is rising. Reroute before the next tick.', emoji: '📈', accent: 'warning' },
    ];
  }
  return [
    { id: 'watching', label: 'Watching', value: 'Watching this window closely.', emoji: '👁️', accent: 'info' },
    { id: 'shield-up', label: 'Shield Up', value: 'Shield up before you push.', emoji: '🛡️', accent: 'success' },
    { id: 'heat', label: 'Heat', value: 'Crowd heat is climbing fast.', emoji: '🔥', accent: 'warning' },
    { id: 'receipt', label: 'Receipt', value: 'That line is going to age badly. Keeping the receipt.', emoji: '🧾', accent: 'danger' },
  ];
}

function defaultHints(channel: ChatChannel, threatBand: ComposerThreatBand, networkState: ComposerNetworkState, transcriptImmutable: boolean): ComposerHintLine[] {
  const p = CHANNELS[channel];
  return [
    { id: 'threat', tone: threatBand === 'HIGH' || threatBand === 'SEVERE' ? 'warning' : 'info', text: p.threatCopy[threatBand], visible: true },
    {
      id: 'network',
      tone: networkState === 'ONLINE' ? 'success' : networkState === 'DEGRADED' ? 'warning' : networkState === 'CONNECTING' ? 'info' : 'danger',
      text: networkState === 'ONLINE'
        ? 'Network stable.'
        : networkState === 'DEGRADED'
          ? 'Transport degraded — send path may retry.'
          : networkState === 'CONNECTING'
            ? 'Re-establishing transport.'
            : 'Offline draft mode active.',
      visible: true,
    },
    {
      id: 'proof',
      tone: transcriptImmutable ? 'warning' : 'neutral',
      text: transcriptImmutable ? p.proofCopy : channel === 'DEAL_ROOM'
        ? 'This room is usually immutable. Confirm transcript policy before sending.'
        : 'Fast channel. Pressure outruns perfect phrasing.',
      visible: true,
    },
  ];
}

function defaultDiagnostics(
  channel: ChatChannel,
  networkState: ComposerNetworkState,
  submitState: ComposerSubmitState,
  length: number,
  maxLength: number,
  helperAvailable: boolean,
): ComposerDiagnosticLine[] {
  return [
    { id: 'diag-channel', label: 'CHAN', value: channel, tone: 'info', visible: true },
    { id: 'diag-network', label: 'NET', value: networkLabel(networkState), tone: networkState === 'ONLINE' ? 'success' : networkState === 'DEGRADED' ? 'warning' : networkState === 'CONNECTING' ? 'info' : 'danger', visible: true },
    { id: 'diag-submit', label: 'SEND', value: submitState, tone: submitState === 'READY' ? 'success' : submitState === 'SENDING' ? 'info' : submitState === 'COOLDOWN' ? 'warning' : submitState === 'BLOCKED' ? 'danger' : 'neutral', visible: true },
    { id: 'diag-length', label: 'LEN', value: `${length}/${maxLength}`, tone: length > maxLength ? 'danger' : length >= maxLength * 0.8 ? 'warning' : 'neutral', visible: true },
    { id: 'diag-helper', label: 'HELP', value: helperAvailable ? 'READY' : 'OFF', tone: helperAvailable ? 'success' : 'neutral', visible: true },
  ];
}

function rootStyle(compact: boolean, style?: CSSProperties): CSSProperties {
  return {
    width: '100%',
    borderRadius: compact ? 16 : 20,
    border: `1px solid ${T.border}`,
    background: 'linear-gradient(180deg, rgba(17,17,36,0.98) 0%, rgba(9,9,20,0.98) 100%)',
    boxShadow: T.shadow,
    padding: compact ? 12 : 14,
    display: 'flex',
    flexDirection: 'column',
    gap: compact ? 10 : 12,
    backdropFilter: 'blur(14px)',
    ...style,
  };
}

function textareaStyle(focused: boolean, locked: boolean, overLimit: boolean, compact: boolean): CSSProperties {
  return {
    width: '100%',
    resize: 'none',
    borderRadius: compact ? 14 : 16,
    border: `1px solid ${overLimit ? `${T.danger}88` : focused ? 'rgba(138,142,255,0.45)' : T.border}`,
    background: locked ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.025)',
    color: locked ? T.textMute : T.text,
    outline: 'none',
    padding: compact ? '12px 14px' : '14px 16px',
    fontFamily: T.display,
    fontSize: 13,
    lineHeight: 1.6,
    minHeight: compact ? 46 : 50,
    transition: 'border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease',
    boxShadow: focused ? '0 0 0 3px rgba(138,142,255,0.10)' : 'none',
  };
}

function useAutosizeTextArea(ref: React.RefObject<HTMLTextAreaElement | null>, value: string, minRows: number, maxRows: number): void {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const computed = window.getComputedStyle(node);
    const lineHeight = parseFloat(computed.lineHeight || '20');
    const padding = parseFloat(computed.paddingTop || '0') + parseFloat(computed.paddingBottom || '0');
    const minHeight = Math.max(40, Math.ceil(lineHeight * minRows + padding));
    const maxHeight = Math.max(minHeight, Math.ceil(lineHeight * maxRows + padding));
    node.style.height = `${minHeight}px`;
    const next = clamp(node.scrollHeight, minHeight, maxHeight);
    node.style.height = `${next}px`;
    node.style.overflowY = node.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [ref, value, minRows, maxRows]);
}

const SurfaceLabel = memo(function SurfaceLabel({ channel, threatBand, transcriptImmutable }: { channel: ChatChannel; threatBand: ComposerThreatBand; transcriptImmutable: boolean; }) {
  const p = CHANNELS[channel];
  const threatColor = threatBand === 'SEVERE' ? T.danger : threatBand === 'HIGH' ? T.orange : threatBand === 'ELEVATED' ? T.warning : threatBand === 'LOW' ? T.info : T.textSub;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border}`, fontSize: 16 }}>
        {p.emoji}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: T.display, fontWeight: 800, fontSize: 12, letterSpacing: '0.14em', color: p.accent }}>{p.label}</span>
          <span style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.10em', color: threatColor }}>{threatBand}</span>
          {transcriptImmutable && <span style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.10em', color: T.yellow }}>IMMUTABLE</span>}
        </div>
        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textMute, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.proofCopy}</div>
      </div>
    </div>
  );
});

const StatusPill = memo(function StatusPill({ label, color, icon }: { label: string; color: string; icon: string; }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 10px', borderRadius: 999, border: `1px solid ${color}33`, background: `${color}14`, fontFamily: T.mono, fontSize: 10, letterSpacing: '0.10em', color }}>
      <span aria-hidden="true">{icon}</span>
      {label}
    </div>
  );
});

const ReplyCard = memo(function ReplyCard({ preview, onCancel }: { preview: ComposerReplyPreview | null; onCancel?: () => void; }) {
  if (!preview) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, borderRadius: 14, border: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.03)', padding: 12 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.10em', color: T.info, marginBottom: 6 }}>REPLY TARGET</div>
        <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 12, color: T.text, marginBottom: 4 }}>{preview.senderName}</div>
        <div style={{ fontFamily: T.display, fontSize: 12, lineHeight: 1.5, color: T.textSub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{preview.body}</div>
      </div>
      {onCancel && (
        <button type="button" onClick={onCancel} style={{ appearance: 'none', border: `1px solid ${T.border}`, background: 'transparent', color: T.textSub, fontFamily: T.mono, fontSize: 10, letterSpacing: '0.10em', padding: '8px 10px', borderRadius: 10, cursor: 'pointer', flexShrink: 0 }}>
          CLEAR
        </button>
      )}
    </div>
  );
});

const QuickInsertChip = memo(function QuickInsertChip({ chip, onInsert }: { chip: ComposerQuickInsert; onInsert: (chip: ComposerQuickInsert) => void; }) {
  const palette = accentPalette(chip.accent ?? 'default');
  return (
    <button
      type="button"
      disabled={chip.disabled}
      title={chip.reason}
      onClick={() => onInsert(chip)}
      style={{ appearance: 'none', border: `1px solid ${palette.border}`, background: palette.bg, color: chip.disabled ? T.textMute : palette.text, fontFamily: T.mono, fontSize: 10, letterSpacing: '0.10em', borderRadius: 999, padding: '9px 12px', display: 'inline-flex', alignItems: 'center', gap: 8, cursor: chip.disabled ? 'not-allowed' : 'pointer', opacity: chip.disabled ? 0.55 : 1, whiteSpace: 'nowrap' }}
    >
      {chip.emoji && <span aria-hidden="true">{chip.emoji}</span>}
      <span>{chip.label}</span>
    </button>
  );
});

const HintLineRow = memo(function HintLineRow({ line }: { line: ComposerHintLine; }) {
  if (!line.visible) return null;
  const palette = tonePalette(line.tone);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 18, fontFamily: T.mono, fontSize: 10, letterSpacing: '0.06em', color: palette.text }}>
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: palette.text, display: 'inline-block', flexShrink: 0 }} />
      <span>{line.text}</span>
    </div>
  );
});

const DiagnosticPill = memo(function DiagnosticPill({ line }: { line: ComposerDiagnosticLine; }) {
  if (!line.visible) return null;
  const palette = tonePalette(line.tone ?? 'neutral');
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 28, padding: '0 10px', borderRadius: 999, border: `1px solid ${palette.border}`, background: palette.bg, fontFamily: T.mono, fontSize: 10, letterSpacing: '0.08em', color: palette.text }}>
      <span>{line.label}</span>
      <span style={{ opacity: 0.75 }}>·</span>
      <span>{line.value}</span>
    </div>
  );
});

const CharacterMeter = memo(function CharacterMeter({ length, limit, visible }: { length: number; limit: number; visible: boolean; }) {
  if (!visible) return null;
  const band = meterBand(length, limit);
  const remaining = limit - length;
  const pct = clamp(length / Math.max(1, limit), 0, 1);
  const color = band === 'OVER' ? T.danger : band === 'LIMIT' ? T.orange : band === 'NEAR' ? T.warning : T.info;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 140, justifyContent: 'flex-end' }}>
      <div aria-hidden="true" style={{ width: 84, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, pct * 100)}%`, height: '100%', background: color, boxShadow: `0 0 12px ${color}66` }} />
      </div>
      <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.10em', color, minWidth: 52, textAlign: 'right' }}>{remaining >= 0 ? `${remaining}` : `+${Math.abs(remaining)}`}</div>
    </div>
  );
});

const KeyHintBlock = memo(function KeyHintBlock({ allowShiftEnter }: { allowShiftEnter: boolean; }) {
  return (
    <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.08em', color: T.textMute, textAlign: 'right' }}>
      ENTER SENDS · {allowShiftEnter ? 'SHIFT+ENTER NEW LINE' : 'ENTER LOCKED TO SEND'} · CMD/CTRL+H HELPER
    </div>
  );
});

function helperButtonStyle(enabled: boolean): CSSProperties {
  return {
    appearance: 'none',
    border: `1px solid ${enabled ? `${T.green}33` : T.border}`,
    background: enabled ? `${T.green}14` : 'rgba(255,255,255,0.03)',
    color: enabled ? T.green : T.textMute,
    borderRadius: 14,
    padding: '10px 10px',
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontFamily: T.mono,
    fontSize: 10,
    letterSpacing: '0.08em',
    minHeight: 44,
    opacity: enabled ? 1 : 0.65,
  };
}

function sendButtonStyle(enabled: boolean, tone: string, compact: boolean): CSSProperties {
  return {
    appearance: 'none',
    border: `1px solid ${enabled ? `${tone}44` : T.border}`,
    background: enabled ? `${tone}18` : 'rgba(255,255,255,0.03)',
    color: enabled ? tone : T.textMute,
    borderRadius: 14,
    padding: '10px 10px',
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontFamily: T.display,
    fontWeight: 800,
    fontSize: 12,
    letterSpacing: '0.06em',
    minHeight: compact ? 54 : 60,
    opacity: enabled ? 1 : 0.65,
    boxShadow: enabled ? `0 8px 20px ${tone}18` : 'none',
  };
}

export const ChatComposer = memo(function ChatComposer({
  channel,
  value,
  onChange,
  onSubmit,
  onTypingStateChange,
  onFocus,
  onBlur,
  onCycleChannel,
  onRequestHelper,
  onCancelReply,
  onToggleExpandedTools,
  onEscalateThreatPanel,
  onOpenCommands,
  onOpenTranscriptPolicy,
  onInsertQuickText,
  placeholder,
  disabled = false,
  locked = false,
  connected = true,
  networkState = connected ? 'ONLINE' : 'OFFLINE',
  submitState = 'READY',
  sendCooldownMs = 0,
  threatBand = 'LOW',
  helperAvailable = false,
  helperLabel = 'Request Helper',
  transcriptImmutable = false,
  maxLength = 280,
  minRows = 1,
  maxRows = 6,
  dangerCopy,
  showDangerCopy = true,
  modePreset = null,
  quickInserts,
  hintLines,
  diagnosticLines,
  replyPreview = null,
  autoFocus = false,
  allowShiftEnter = true,
  allowQuickInsertBar = true,
  allowHelperShortcut = true,
  showCharacterMeter = true,
  showProofNotice = true,
  showDiagnostics = true,
  showToolsByDefault = true,
  forceCompact = false,
  footerLeftSlot,
  footerRightSlot,
  statusRightSlot,
  className,
  style,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(false);
  const previousDraftRef = useRef('');

  const [focused, setFocused] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(showToolsByDefault);
  const [usedQuickInsertIds, setUsedQuickInsertIds] = useState<string[]>([]);
  const [lastSubmittedAt, setLastSubmittedAt] = useState<number | null>(null);

  const normalizedValue = safeString(value);
  const compact = forceCompact;
  const p = CHANNELS[channel];
  const resolvedPlaceholder = placeholder || p.placeholder;
  const quicks = useMemo(() => (quickInserts && quickInserts.length > 0 ? quickInserts : defaultQuickInserts(channel)).filter((item) => !item.visibleIn || item.visibleIn.includes(channel)), [channel, quickInserts]);
  const hints = useMemo(() => (hintLines && hintLines.length > 0 ? hintLines : defaultHints(channel, threatBand, networkState, transcriptImmutable)), [channel, hintLines, threatBand, networkState, transcriptImmutable]);
  const diagnostics = useMemo(() => (diagnosticLines && diagnosticLines.length > 0 ? diagnosticLines : defaultDiagnostics(channel, networkState, submitState, normalizedValue.length, maxLength, helperAvailable)), [channel, diagnosticLines, networkState, submitState, normalizedValue.length, maxLength, helperAvailable]);
  const trimmed = collapseWhitespace(normalizedValue);
  const empty = trimmed.length === 0;
  const overLimit = normalizedValue.length > maxLength;
  const blocked = isBlocked(submitState, disabled, locked, empty, overLimit);
  const helperEnabled = helperAvailable && !disabled && !locked;
  const showDanger = showDangerCopy && !!dangerCopy && (threatBand === 'HIGH' || threatBand === 'SEVERE' || channel === 'DEAL_ROOM');
  const cooldownVisible = submitState === 'COOLDOWN' && sendCooldownMs > 0;
  const characterBand = meterBand(normalizedValue.length, maxLength);
  const sendTone = blocked ? T.textMute : submitState === 'SENDING' ? T.info : submitState === 'COOLDOWN' ? T.warning : channel === 'DEAL_ROOM' ? T.yellow : channel === 'SYNDICATE' ? T.green : T.indigo;

  useAutosizeTextArea(textareaRef, normalizedValue, minRows, maxRows);

  useEffect(() => {
    if (!autoFocus || !textareaRef.current) return;
    textareaRef.current.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      previousDraftRef.current = normalizedValue;
      return;
    }
    if (!onTypingStateChange) return;
    const previous = collapseWhitespace(previousDraftRef.current);
    previousDraftRef.current = normalizedValue;
    if (typingTimerRef.current !== null) {
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    if (trimmed.length > 0 && trimmed !== previous) {
      onTypingStateChange(true);
      typingTimerRef.current = window.setTimeout(() => {
        onTypingStateChange(false);
        typingTimerRef.current = null;
      }, 1400);
    } else if (trimmed.length === 0) {
      onTypingStateChange(false);
    }
    return () => {
      if (typingTimerRef.current !== null) {
        window.clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    };
  }, [normalizedValue, trimmed, onTypingStateChange]);

  const setTools = useCallback((next: boolean) => {
    setToolsOpen(next);
    onToggleExpandedTools?.(next);
  }, [onToggleExpandedTools]);

  const insertQuick = useCallback((chip: ComposerQuickInsert) => {
    if (chip.disabled || disabled || locked) return;
    const next = normalizedValue.trim().length === 0 ? chip.value : `${normalizedValue.replace(/\s+$/g, '')} ${chip.value}`;
    onChange(next);
    onInsertQuickText?.(chip);
    setUsedQuickInsertIds((prev) => (prev.includes(chip.id) ? prev : [...prev, chip.id]));
    textareaRef.current?.focus();
  }, [disabled, locked, normalizedValue, onChange, onInsertQuickText]);

  const submit = useCallback(() => {
    const body = collapseWhitespace(normalizedValue);
    if (isBlocked(submitState, disabled, locked, body.length === 0, body.length > maxLength)) return;
    onSubmit({ body, channel, usedQuickInsertIds, replyToId: replyPreview?.id });
    setLastSubmittedAt(Date.now());
    setUsedQuickInsertIds([]);
  }, [normalizedValue, submitState, disabled, locked, maxLength, onSubmit, channel, usedQuickInsertIds, replyPreview]);

  const handleChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  }, [onChange]);

  const handleFocus = useCallback((_event: FocusEvent<HTMLTextAreaElement>) => {
    setFocused(true);
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback((_event: FocusEvent<HTMLTextAreaElement>) => {
    setFocused(false);
    onBlur?.();
  }, [onBlur]);

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'enter') {
      event.preventDefault();
      submit();
      return;
    }
    if (event.key === 'Enter' && !allowShiftEnter) {
      event.preventDefault();
      submit();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      setTools(!toolsOpen);
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
      event.preventDefault();
      onCycleChannel?.();
      return;
    }
    if (allowHelperShortcut && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'h') {
      event.preventDefault();
      if (helperEnabled) onRequestHelper?.();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      onOpenTranscriptPolicy?.();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === '/') {
      event.preventDefault();
      onOpenCommands?.();
      return;
    }
  }, [allowShiftEnter, allowHelperShortcut, submit, setTools, toolsOpen, onCycleChannel, helperEnabled, onRequestHelper, onOpenTranscriptPolicy, onOpenCommands]);

  return (
    <div className={className} style={rootStyle(compact, style)} data-channel={channel} data-threat-band={threatBand} data-submit-state={submitState}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <SurfaceLabel channel={channel} threatBand={threatBand} transcriptImmutable={transcriptImmutable} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', marginLeft: 'auto' }}>
          <StatusPill label={networkLabel(networkState)} color={networkState === 'ONLINE' ? T.success : networkState === 'DEGRADED' ? T.warning : networkState === 'CONNECTING' ? T.info : T.danger} icon={networkState === 'ONLINE' ? '●' : networkState === 'DEGRADED' ? '◐' : networkState === 'CONNECTING' ? '◌' : '○'} />
          <StatusPill label={threatBand} color={threatBand === 'SEVERE' ? T.danger : threatBand === 'HIGH' ? T.orange : threatBand === 'ELEVATED' ? T.warning : threatBand === 'LOW' ? T.info : T.textSub} icon="⚠" />
          {modePreset && <StatusPill label={modePreset.label} color={modePreset.accent} icon="◈" />}
          {statusRightSlot}
        </div>
      </div>

      <ReplyCard preview={replyPreview} onCancel={onCancelReply} />

      {showDanger && (
        <div style={{ borderRadius: 14, border: `1px solid ${T.danger}30`, background: T.dangerSoft, padding: '10px 12px', fontFamily: T.display, fontSize: 12, lineHeight: 1.55, color: T.danger }}>
          {dangerCopy}
        </div>
      )}

      {allowQuickInsertBar && toolsOpen && quicks.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {quicks.map((chip) => (
            <QuickInsertChip key={chip.id} chip={chip} onInsert={insertQuick} />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <textarea
            ref={textareaRef}
            value={normalizedValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={resolvedPlaceholder}
            disabled={disabled || locked}
            maxLength={maxLength * 2}
            style={textareaStyle(focused, locked, overLimit, compact)}
            spellCheck={false}
            autoCapitalize="sentences"
            autoCorrect="off"
          />
        </div>

        <div style={{ width: compact ? 78 : 92, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <button type="button" disabled={!helperEnabled} title={helperEnabled ? p.helperCopy : 'Helper line not available in this state.'} onClick={onRequestHelper} style={helperButtonStyle(helperEnabled)}>
            {helperLabel}
          </button>
          <button type="button" disabled={blocked} onClick={submit} style={sendButtonStyle(!blocked, sendTone, compact)}>
            {submitLabel(submitState, channel)}
          </button>
        </div>
      </div>

      {showProofNotice && (
        <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'minmax(0, 1fr) auto', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {hints.map((hint) => (
              <HintLineRow key={hint.id} line={hint} />
            ))}
          </div>
          <CharacterMeter length={normalizedValue.length} limit={maxLength} visible={showCharacterMeter} />
        </div>
      )}

      {showDiagnostics && diagnostics.some((line) => line.visible !== false) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {diagnostics.map((line) => (
            <DiagnosticPill key={line.id} line={line} />
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'minmax(0, 1fr) auto', gap: 12, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          {footerLeftSlot}
          <button type="button" onClick={() => setTools(!toolsOpen)} style={{ appearance: 'none', border: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.03)', color: T.textSub, borderRadius: 999, height: 30, padding: '0 12px', cursor: 'pointer', fontFamily: T.mono, fontSize: 10, letterSpacing: '0.10em' }}>
            {toolsOpen ? 'TOOLS OPEN' : 'TOOLS CLOSED'}
          </button>
          {onCycleChannel && (
            <button type="button" onClick={onCycleChannel} style={{ appearance: 'none', border: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.03)', color: T.textSub, borderRadius: 999, height: 30, padding: '0 12px', cursor: 'pointer', fontFamily: T.mono, fontSize: 10, letterSpacing: '0.10em' }}>
              NEXT CHANNEL
            </button>
          )}
          {onEscalateThreatPanel && (
            <button type="button" onClick={onEscalateThreatPanel} style={{ appearance: 'none', border: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.03)', color: T.textSub, borderRadius: 999, height: 30, padding: '0 12px', cursor: 'pointer', fontFamily: T.mono, fontSize: 10, letterSpacing: '0.10em' }}>
              THREAT PANEL
            </button>
          )}
          {onOpenCommands && (
            <button type="button" onClick={onOpenCommands} style={{ appearance: 'none', border: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.03)', color: T.textSub, borderRadius: 999, height: 30, padding: '0 12px', cursor: 'pointer', fontFamily: T.mono, fontSize: 10, letterSpacing: '0.10em' }}>
              COMMANDS
            </button>
          )}
          {onOpenTranscriptPolicy && (
            <button type="button" onClick={onOpenTranscriptPolicy} style={{ appearance: 'none', border: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.03)', color: T.textSub, borderRadius: 999, height: 30, padding: '0 12px', cursor: 'pointer', fontFamily: T.mono, fontSize: 10, letterSpacing: '0.10em' }}>
              POLICY
            </button>
          )}
          {cooldownVisible && <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.10em', color: T.warning }}>COOLDOWN {formatCooldown(sendCooldownMs)}</div>}
          {lastSubmittedAt && <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.10em', color: T.textMute }}>LAST SEND {new Date(lastSubmittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
          <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.10em', color: characterBand === 'OVER' ? T.danger : characterBand === 'LIMIT' ? T.orange : characterBand === 'NEAR' ? T.warning : T.textMute }}>{normalizedValue.length}/{maxLength}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: compact ? 'flex-start' : 'flex-end', flexWrap: 'wrap' }}>
          {footerRightSlot}
          <KeyHintBlock allowShiftEnter={allowShiftEnter} />
        </div>
      </div>
    </div>
  );
});

export default ChatComposer;
