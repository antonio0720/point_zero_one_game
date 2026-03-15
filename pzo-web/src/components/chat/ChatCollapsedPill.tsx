/**
 * ============================================================================
 * POINT ZERO ONE — THIN CHAT RENDER SHELL
 * FILE: pzo-web/src/components/chat/ChatCollapsedPill.tsx
 * VERSION: 3.1.0
 * AUTHOR: OpenAI
 * LICENSE: Internal / Project Use Only
 * ============================================================================
 *
 * Purpose
 * -------
 * Presentation-only collapsed launcher for the unified chat shell.
 *
 * This component consumes only normalized UI contracts from `./uiTypes`.
 * It does not read engine contracts, transport state, mount presets, or repo
 * authority bundles directly. Everything rendered here must already be mapped
 * upstream into `ChatUiCollapsedPillViewModel`.
 *
 * Design law
 * ----------
 * - render only
 * - no engine ownership
 * - no policy ownership
 * - no mount preset authority
 * - no threat / helper / invasion derivation beyond safe display formatting
 * - no transcript truth inference
 *
 * Upstream ownership
 * ------------------
 * The authoritative derivation path should be:
 * - `useUnifiedChat.ts`
 * - `collapsedPillAdapter.ts`
 * - or a presentation-safe adapter over the canonical engine lane
 *
 * This component should remain:
 * - compact
 * - readable under pressure
 * - keyboard accessible
 * - visually informative while minimized
 * ============================================================================
 */

import React, { memo, useId, useMemo } from 'react';
import type {
  ChatUiAccent,
  ChatUiChip,
  ChatUiCollapsedPillAction,
  ChatUiCollapsedPillChannelSummary,
  ChatUiCollapsedPillHelperSummary,
  ChatUiCollapsedPillInvasionSummary,
  ChatUiCollapsedPillPresenceSummary,
  ChatUiCollapsedPillThreatSummary,
  ChatUiCollapsedPillTypingSummary,
  ChatUiCollapsedPillViewModel,
  ChatUiMetric,
  ChatUiPill,
  ChatUiThreatBand,
  ChatUiTone,
} from './uiTypes';

const TOKENS = {
  void: '#030308',
  card: '#0C0C1E',
  cardHi: '#131328',
  cardRaised: '#181833',
  cardSoft: '#101024',
  border: 'rgba(255,255,255,0.08)',
  borderMedium: 'rgba(255,255,255,0.16)',
  borderStrong: 'rgba(255,255,255,0.24)',
  text: '#F2F2FF',
  textSoft: '#C8C8E6',
  textSubtle: '#9090B4',
  textMuted: '#5C5C82',
  emerald: '#22DD88',
  amber: '#F6C453',
  orange: '#FF8C00',
  red: '#FF4D4D',
  rose: '#FF6B81',
  violet: '#A855F7',
  cyan: '#22D3EE',
  indigo: '#818CF8',
  gold: '#E7C15A',
  silver: '#B6C0D4',
  slate: '#738096',
  obsidian: '#1C1C2B',
  successBg: 'rgba(34,221,136,0.12)',
  warningBg: 'rgba(246,196,83,0.12)',
  dangerBg: 'rgba(255,77,77,0.12)',
  hostileBg: 'rgba(255,140,0,0.12)',
  indigoBg: 'rgba(129,140,248,0.12)',
  cyanBg: 'rgba(34,211,238,0.12)',
  violetBg: 'rgba(168,85,247,0.12)',
  chipBg: 'rgba(255,255,255,0.05)',
  chipBgStrong: 'rgba(255,255,255,0.08)',
  white: '#FFFFFF',
  mono: "'IBM Plex Mono', 'JetBrains Mono', monospace",
  display: "'Syne', 'Outfit', system-ui, sans-serif",
} as const;

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');`;

const MAX_CHANNEL_BUTTONS = 3;
const MAX_STATUS_PILLS = 4;
const MAX_CHIPS = 4;
const MAX_METRICS = 3;
const MAX_ACTIONS = 3;

export interface ChatCollapsedPillProps {
  readonly model: ChatUiCollapsedPillViewModel;
  readonly className?: string;
  readonly style?: React.CSSProperties;
  readonly disabled?: boolean;
  readonly fixedPosition?: boolean;
  readonly anchor?: 'bottom-right' | 'bottom-left' | 'inline';
  readonly onOpen?: (model: ChatUiCollapsedPillViewModel) => void;
  readonly onToggleExpanded?: (nextExpanded: boolean, model: ChatUiCollapsedPillViewModel) => void;
  readonly onDismiss?: (model: ChatUiCollapsedPillViewModel) => void;
  readonly onSelectChannel?: (
    channel: ChatUiCollapsedPillChannelSummary,
    model: ChatUiCollapsedPillViewModel,
  ) => void;
  readonly onAction?: (action: ChatUiCollapsedPillAction, model: ChatUiCollapsedPillViewModel) => void;
}

interface AccentVisual {
  readonly text: string;
  readonly border: string;
  readonly bg: string;
}

interface ToneVisual {
  readonly label: string;
  readonly glow: string;
}

interface ThreatVisual {
  readonly accent: string;
  readonly bg: string;
  readonly border: string;
  readonly text: string;
  readonly icon: string;
}

function clamp(value: number | undefined, min = 0, max = 1): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value as number));
}

function countLabel(count: number | undefined, singular: string, plural = `${singular}s`): string {
  const safe = Math.max(0, Math.floor(count ?? 0));
  return `${safe} ${safe === 1 ? singular : plural}`;
}

function compactNumber(value: number | undefined): string {
  const safe = Math.max(0, Math.floor(value ?? 0));
  if (safe > 99) return '99+';
  return String(safe);
}

function toneVisual(tone: ChatUiTone | undefined): ToneVisual {
  switch (tone) {
    case 'danger':
      return {
        label: 'danger',
        glow: '0 0 0 1px rgba(255,77,77,0.08) inset, 0 12px 28px rgba(255,77,77,0.12)',
      };
    case 'hostile':
      return {
        label: 'hostile',
        glow: '0 0 0 1px rgba(255,140,0,0.08) inset, 0 12px 28px rgba(255,140,0,0.12)',
      };
    case 'supportive':
      return {
        label: 'supportive',
        glow: '0 0 0 1px rgba(34,221,136,0.08) inset, 0 12px 28px rgba(34,221,136,0.12)',
      };
    case 'warning':
      return {
        label: 'warning',
        glow: '0 0 0 1px rgba(246,196,83,0.08) inset, 0 12px 28px rgba(246,196,83,0.12)',
      };
    case 'premium':
      return {
        label: 'premium',
        glow: '0 0 0 1px rgba(231,193,90,0.08) inset, 0 12px 28px rgba(231,193,90,0.12)',
      };
    case 'celebratory':
      return {
        label: 'celebratory',
        glow: '0 0 0 1px rgba(168,85,247,0.08) inset, 0 12px 28px rgba(168,85,247,0.12)',
      };
    case 'dramatic':
      return {
        label: 'dramatic',
        glow: '0 0 0 1px rgba(129,140,248,0.08) inset, 0 12px 28px rgba(129,140,248,0.12)',
      };
    case 'calm':
    case 'positive':
      return {
        label: 'calm',
        glow: '0 0 0 1px rgba(34,221,136,0.08) inset, 0 12px 28px rgba(34,221,136,0.08)',
      };
    case 'ghost':
    case 'stealth':
      return {
        label: 'stealth',
        glow: '0 0 0 1px rgba(115,128,150,0.08) inset, 0 12px 28px rgba(0,0,0,0.24)',
      };
    case 'neutral':
    default:
      return {
        label: 'neutral',
        glow: '0 0 0 1px rgba(255,255,255,0.04) inset, 0 12px 28px rgba(0,0,0,0.30)',
      };
  }
}

function accentVisual(accent: ChatUiAccent | undefined): AccentVisual {
  switch (accent) {
    case 'emerald':
      return { text: TOKENS.emerald, border: 'rgba(34,221,136,0.26)', bg: TOKENS.successBg };
    case 'amber':
      return { text: TOKENS.amber, border: 'rgba(246,196,83,0.26)', bg: TOKENS.warningBg };
    case 'red':
      return { text: TOKENS.red, border: 'rgba(255,77,77,0.26)', bg: TOKENS.dangerBg };
    case 'rose':
      return { text: TOKENS.rose, border: 'rgba(255,107,129,0.26)', bg: 'rgba(255,107,129,0.12)' };
    case 'violet':
      return { text: TOKENS.violet, border: 'rgba(168,85,247,0.26)', bg: TOKENS.violetBg };
    case 'cyan':
      return { text: TOKENS.cyan, border: 'rgba(34,211,238,0.26)', bg: TOKENS.cyanBg };
    case 'indigo':
      return { text: TOKENS.indigo, border: 'rgba(129,140,248,0.26)', bg: TOKENS.indigoBg };
    case 'gold':
      return { text: TOKENS.gold, border: 'rgba(231,193,90,0.26)', bg: 'rgba(231,193,90,0.12)' };
    case 'silver':
      return { text: TOKENS.silver, border: 'rgba(182,192,212,0.22)', bg: 'rgba(182,192,212,0.10)' };
    case 'obsidian':
      return { text: TOKENS.textSoft, border: 'rgba(28,28,43,0.56)', bg: 'rgba(28,28,43,0.56)' };
    case 'slate':
    default:
      return { text: TOKENS.slate, border: 'rgba(115,128,150,0.22)', bg: 'rgba(115,128,150,0.10)' };
  }
}

function threatVisual(band: ChatUiThreatBand | undefined): ThreatVisual {
  switch (band) {
    case 'catastrophic':
      return {
        accent: TOKENS.red,
        bg: 'rgba(255,77,77,0.18)',
        border: 'rgba(255,77,77,0.34)',
        text: 'Catastrophic threat',
        icon: '⛧',
      };
    case 'critical':
      return {
        accent: TOKENS.red,
        bg: TOKENS.dangerBg,
        border: 'rgba(255,77,77,0.28)',
        text: 'Critical threat',
        icon: '▲',
      };
    case 'hostile':
      return {
        accent: TOKENS.orange,
        bg: TOKENS.hostileBg,
        border: 'rgba(255,140,0,0.28)',
        text: 'Hostile pressure',
        icon: '◈',
      };
    case 'pressured':
      return {
        accent: TOKENS.amber,
        bg: TOKENS.warningBg,
        border: 'rgba(246,196,83,0.24)',
        text: 'Pressured room',
        icon: '◆',
      };
    case 'elevated':
      return {
        accent: TOKENS.gold,
        bg: 'rgba(231,193,90,0.10)',
        border: 'rgba(231,193,90,0.22)',
        text: 'Elevated signal',
        icon: '△',
      };
    case 'quiet':
    default:
      return {
        accent: TOKENS.emerald,
        bg: TOKENS.successBg,
        border: 'rgba(34,221,136,0.22)',
        text: 'Quiet posture',
        icon: '•',
      };
  }
}

function presenceMoodLabel(summary: ChatUiCollapsedPillPresenceSummary | undefined): string {
  const label = summary?.moodLabel?.trim();
  if (label) return label;
  switch (summary?.mood) {
    case 'swarming':
      return 'Swarming';
    case 'active':
      return 'Active';
    case 'watched':
      return 'Watched';
    case 'quiet':
    default:
      return 'Quiet';
  }
}

function anchorStyle(
  fixedPosition: boolean | undefined,
  anchor: ChatCollapsedPillProps['anchor'],
): React.CSSProperties {
  if (!fixedPosition) return {};

  switch (anchor) {
    case 'bottom-left':
      return {
        position: 'fixed',
        left: 16,
        bottom: 16,
        zIndex: 60,
      };
    case 'inline':
      return {};
    case 'bottom-right':
    default:
      return {
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 60,
      };
  }
}

function readableUnread(model: ChatUiCollapsedPillViewModel): string {
  const mentions = Math.max(0, Math.floor(model.mentionCount ?? 0));
  const unread = Math.max(0, Math.floor(model.unreadCount ?? 0));

  if (mentions > 0) return mentions > 99 ? '99+ mentions' : `${mentions} mention${mentions === 1 ? '' : 's'}`;
  if (unread <= 0) return 'No unread';
  return unread > 99 ? '99+ unread' : `${unread} unread`;
}

function readableTyping(summary: ChatUiCollapsedPillTypingSummary | undefined): string | undefined {
  if (!summary) return undefined;
  if (summary.label?.trim()) return summary.label;

  const count = Math.max(0, Math.floor(summary.count ?? 0));
  if (count <= 0) return undefined;
  return countLabel(count, 'typing');
}

function readablePresence(summary: ChatUiCollapsedPillPresenceSummary | undefined): string | undefined {
  if (!summary) return undefined;
  if (summary.label?.trim()) return summary.label;

  const count = Math.max(0, Math.floor(summary.count ?? 0));
  if (count <= 0) return undefined;
  return `${presenceMoodLabel(summary)} • ${countLabel(count, 'visible')}`;
}

function readableHelper(summary: ChatUiCollapsedPillHelperSummary | undefined): string | undefined {
  if (!summary || !summary.visible) return undefined;
  if (summary.label?.trim()) return summary.label;
  return 'Helper pending';
}

function readableInvasion(summary: ChatUiCollapsedPillInvasionSummary | undefined): string | undefined {
  if (!summary || !summary.active) return undefined;
  return summary.label?.trim() || 'Invasion active';
}

function readableThreat(
  summary: ChatUiCollapsedPillThreatSummary | undefined,
  fallbackBand: ChatUiThreatBand | undefined,
): string {
  if (summary?.label?.trim()) return summary.label;
  return threatVisual(summary?.band ?? fallbackBand).text;
}

function rootAriaLabel(model: ChatUiCollapsedPillViewModel): string {
  const parts = [
    `Open chat. ${readableUnread(model)}.`,
    readableThreat(model.threatSummary, model.threatBand),
    readableTyping(model.typingSummary),
    readablePresence(model.presenceSummary),
    readableHelper(model.helperSummary),
    readableInvasion(model.invasionSummary),
  ].filter(Boolean);

  return parts.join(' ');
}

function capArray<T>(items: readonly T[] | undefined, max: number): readonly T[] {
  if (!items || items.length === 0) return [];
  return items.slice(0, max);
}

function actionable(action: ChatUiCollapsedPillAction | undefined): boolean {
  return Boolean(action && !action.disabled);
}

function renderChip(chip: ChatUiChip): React.JSX.Element {
  const accent = accentVisual(chip.accent);
  const isActive = Boolean(chip.active);

  return (
    <span
      key={chip.id}
      title={chip.tooltip}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        minHeight: 24,
        padding: '0 8px',
        borderRadius: 999,
        border: `1px solid ${isActive ? accent.border : TOKENS.border}`,
        background: isActive ? accent.bg : TOKENS.chipBg,
        color: isActive ? accent.text : TOKENS.textSubtle,
        fontFamily: TOKENS.mono,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.05em',
        whiteSpace: 'nowrap',
      }}
    >
      {chip.icon ? <span aria-hidden="true">{chip.icon}</span> : null}
      <span>{chip.shortLabel || chip.label}</span>
      {typeof chip.count === 'number' && chip.count > 0 ? <span>{compactNumber(chip.count)}</span> : null}
    </span>
  );
}

function renderMetric(metric: ChatUiMetric): React.JSX.Element {
  const accent = accentVisual(metric.accent);

  return (
    <div
      key={metric.id}
      title={metric.tooltip}
      style={{
        display: 'grid',
        gap: 3,
        minWidth: 0,
        padding: '8px 9px',
        borderRadius: 12,
        border: `1px solid ${metric.importance === 'critical' ? accent.border : TOKENS.border}`,
        background: metric.importance === 'critical' ? accent.bg : TOKENS.chipBg,
      }}
    >
      <span
        style={{
          color: TOKENS.textMuted,
          fontFamily: TOKENS.mono,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {metric.label}
      </span>
      <span
        style={{
          color: accent.text,
          fontFamily: TOKENS.display,
          fontSize: 13,
          fontWeight: 800,
          lineHeight: 1,
        }}
      >
        {metric.value}
      </span>
    </div>
  );
}

function renderPill(pill: ChatUiPill): React.JSX.Element {
  const accent = accentVisual(pill.accent);

  return (
    <span
      key={pill.id}
      title={pill.tooltip}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        minHeight: 26,
        padding: '0 9px',
        borderRadius: 999,
        border: `1px solid ${pill.selected ? accent.border : TOKENS.border}`,
        background: pill.selected ? accent.bg : TOKENS.chipBg,
        color: pill.selected ? accent.text : TOKENS.textSubtle,
        fontFamily: TOKENS.mono,
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '0.06em',
      }}
    >
      {pill.icon ? <span aria-hidden="true">{pill.icon}</span> : null}
      <span>{pill.label}</span>
      {pill.value ? <span>{pill.value}</span> : null}
    </span>
  );
}

function renderChannelButton(
  summary: ChatUiCollapsedPillChannelSummary,
  model: ChatUiCollapsedPillViewModel,
  onSelectChannel: ChatCollapsedPillProps['onSelectChannel'],
): React.JSX.Element {
  const accent = accentVisual(summary.accent ?? model.accent);
  const unread = Math.max(0, Math.floor(summary.unreadCount ?? 0));
  const mentionCount = Math.max(0, Math.floor(summary.mentionCount ?? 0));
  const badgeValue = mentionCount > 0 ? compactNumber(mentionCount) : unread > 0 ? compactNumber(unread) : undefined;

  return (
    <button
      key={summary.id}
      type="button"
      disabled={summary.disabled}
      title={summary.tooltip}
      onClick={(event) => {
        event.stopPropagation();
        if (!onSelectChannel || summary.disabled) return;
        onSelectChannel(summary, model);
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        minHeight: 28,
        minWidth: 0,
        padding: '0 10px',
        borderRadius: 999,
        border: `1px solid ${summary.active ? accent.border : TOKENS.border}`,
        background: summary.active ? accent.bg : TOKENS.chipBg,
        color: summary.active ? accent.text : TOKENS.textSubtle,
        cursor: summary.disabled ? 'not-allowed' : onSelectChannel ? 'pointer' : 'default',
        opacity: summary.disabled ? 0.48 : 1,
      }}
      aria-pressed={summary.active}
    >
      {summary.icon ? <span aria-hidden="true">{summary.icon}</span> : null}
      <span
        style={{
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: TOKENS.mono,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.05em',
        }}
      >
        {summary.shortLabel || summary.label}
      </span>
      {badgeValue ? (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 18,
            height: 18,
            padding: '0 5px',
            borderRadius: 999,
            background: mentionCount > 0 ? TOKENS.dangerBg : TOKENS.cardRaised,
            border: `1px solid ${mentionCount > 0 ? 'rgba(255,77,77,0.22)' : TOKENS.border}`,
            color: mentionCount > 0 ? TOKENS.red : TOKENS.textSoft,
            fontFamily: TOKENS.mono,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.03em',
          }}
        >
          {badgeValue}
        </span>
      ) : null}
    </button>
  );
}

function renderAction(
  action: ChatUiCollapsedPillAction,
  model: ChatUiCollapsedPillViewModel,
  onAction: ChatCollapsedPillProps['onAction'],
  onDismiss: ChatCollapsedPillProps['onDismiss'],
  onToggleExpanded: ChatCollapsedPillProps['onToggleExpanded'],
): React.JSX.Element {
  const accent = accentVisual(action.accent ?? model.accent);
  const clickable = actionable(action);

  return (
    <button
      key={action.id}
      type="button"
      disabled={!clickable}
      title={action.tooltip}
      onClick={(event) => {
        event.stopPropagation();
        if (!clickable) return;

        if (action.kind === 'dismiss') {
          onDismiss?.(model);
          return;
        }

        if (action.kind === 'toggle') {
          onToggleExpanded?.(!Boolean(model.expanded), model);
          return;
        }

        onAction?.(action, model);
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minHeight: 30,
        padding: '0 11px',
        borderRadius: 10,
        border: `1px solid ${action.primary ? accent.border : TOKENS.border}`,
        background: action.primary ? accent.bg : TOKENS.cardSoft,
        color: action.primary ? accent.text : TOKENS.textSoft,
        fontFamily: TOKENS.mono,
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '0.05em',
        cursor: clickable ? 'pointer' : 'not-allowed',
        opacity: clickable ? 1 : 0.48,
      }}
    >
      {action.icon ? <span aria-hidden="true">{action.icon}</span> : null}
      <span>{action.label}</span>
    </button>
  );
}

function ChatCollapsedPillComponent({
  model,
  className,
  style,
  disabled = false,
  fixedPosition = false,
  anchor = 'bottom-right',
  onOpen,
  onToggleExpanded,
  onDismiss,
  onSelectChannel,
  onAction,
}: ChatCollapsedPillProps): React.JSX.Element {
  const pillId = useId();
  const componentDisabled = disabled || Boolean(model.disabled);

  const derived = useMemo(() => {
    const accent = accentVisual(model.accent);
    const tone = toneVisual(model.tone);
    const threat = threatVisual(model.threatSummary?.band ?? model.threatBand);
    const unread = Math.max(0, Math.floor(model.unreadCount ?? 0));
    const mentions = Math.max(0, Math.floor(model.mentionCount ?? 0));
    const typingText = readableTyping(model.typingSummary);
    const presenceText = readablePresence(model.presenceSummary);
    const helperText = readableHelper(model.helperSummary);
    const invasionText = readableInvasion(model.invasionSummary);
    const statusPills = capArray(model.statusPills, MAX_STATUS_PILLS);
    const chips = capArray(model.chips, MAX_CHIPS);
    const metrics = capArray(model.metrics, MAX_METRICS);
    const actions = capArray(model.actions, MAX_ACTIONS);
    const channels = capArray(model.channelSummaries, MAX_CHANNEL_BUTTONS);
    const headline = model.roomLabel || model.label;
    const subline =
      model.statusLine ||
      [model.channelLabel || model.shortLabel, readableUnread(model), presenceText].filter(Boolean).join(' • ');

    const attentionFlash =
      model.attention === 'critical' ||
      model.invasionActive ||
      (model.helperSummary?.visible && model.helperSummary.urgency === 'immediate') ||
      mentions > 0;

    const pressureRatio = clamp(model.threatSummary?.score01 ?? undefined, 0, 1);

    return {
      accent,
      tone,
      threat,
      unread,
      mentions,
      typingText,
      presenceText,
      helperText,
      invasionText,
      statusPills,
      chips,
      metrics,
      actions,
      channels,
      headline,
      subline,
      attentionFlash,
      pressureRatio,
    };
  }, [model]);

  const sectionStyle: React.CSSProperties = {
    display: 'grid',
    gap: 8,
    minWidth: 252,
    maxWidth: 340,
    padding: 0,
    ...anchorStyle(fixedPosition, anchor),
    ...style,
  };

  const shellStyle: React.CSSProperties = {
    display: 'grid',
    gap: 8,
    padding: 10,
    borderRadius: 18,
    border: `1px solid ${derived.threat.border}`,
    background: `linear-gradient(180deg, ${TOKENS.cardHi}, ${TOKENS.card})`,
    boxShadow: derived.tone.glow,
    overflow: 'hidden',
    backdropFilter: 'blur(10px)',
  };

  const openButtonStyle: React.CSSProperties = {
    display: 'grid',
    gap: 8,
    padding: 0,
    margin: 0,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: TOKENS.text,
    cursor: componentDisabled ? 'not-allowed' : 'pointer',
    textAlign: 'left',
    opacity: componentDisabled ? 0.56 : 1,
  };

  return (
    <section
      aria-labelledby={`${pillId}-title`}
      className={className}
      data-component="chat-collapsed-pill"
      data-accent={model.accent}
      data-tone={model.tone}
      data-threat-band={model.threatSummary?.band ?? model.threatBand ?? 'quiet'}
      data-expanded={model.expanded ? 'true' : 'false'}
      style={sectionStyle}
    >
      <style>{FONT_IMPORT}</style>
      <style>{`
        @keyframes pzo-collapsed-pill-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,77,77,0.00); }
          50% { box-shadow: 0 0 0 8px rgba(255,77,77,0.08); }
        }
        @keyframes pzo-collapsed-pill-scan {
          0% { transform: translateX(-120%); opacity: 0.0; }
          45% { opacity: 0.55; }
          100% { transform: translateX(160%); opacity: 0.0; }
        }
      `}</style>

      <div style={shellStyle}>
        <button
          type="button"
          disabled={componentDisabled}
          onClick={() => onOpen?.(model)}
          aria-label={rootAriaLabel(model)}
          title={model.tooltip}
          style={openButtonStyle}
        >
          <div
            style={{
              position: 'relative',
              display: 'grid',
              gap: 8,
              minWidth: 0,
              padding: 0,
            }}
          >
            {derived.attentionFlash ? (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: -10,
                  borderRadius: 24,
                  animation: 'pzo-collapsed-pill-pulse 1.9s ease-in-out infinite',
                  pointerEvents: 'none',
                }}
              />
            ) : null}

            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                overflow: 'hidden',
                borderRadius: 14,
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: 56,
                  background:
                    'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.10), rgba(255,255,255,0))',
                  animation: derived.attentionFlash ? 'pzo-collapsed-pill-scan 2.8s linear infinite' : 'none',
                }}
              />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 10,
                alignItems: 'start',
                minWidth: 0,
              }}
            >
              <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 30,
                      height: 30,
                      borderRadius: 10,
                      border: `1px solid ${derived.accent.border}`,
                      background: derived.accent.bg,
                      color: derived.accent.text,
                      fontFamily: TOKENS.display,
                      fontSize: 15,
                      fontWeight: 800,
                      flex: '0 0 auto',
                    }}
                  >
                    {model.icon || '◉'}
                  </span>

                  <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                    <span
                      id={`${pillId}-title`}
                      style={{
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: TOKENS.text,
                        fontFamily: TOKENS.display,
                        fontSize: 15,
                        fontWeight: 800,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {derived.headline}
                    </span>
                    <span
                      style={{
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: TOKENS.textSubtle,
                        fontFamily: TOKENS.mono,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {derived.subline}
                    </span>
                  </div>
                </div>

                {model.roomSubtitle ? (
                  <div
                    style={{
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: TOKENS.textMuted,
                      fontFamily: TOKENS.display,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {model.roomSubtitle}
                  </div>
                ) : null}
              </div>

              <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
                <span
                  title={readableUnread(model)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 28,
                    height: 28,
                    padding: '0 8px',
                    borderRadius: 999,
                    border: `1px solid ${
                      derived.mentions > 0
                        ? 'rgba(255,77,77,0.24)'
                        : derived.unread > 0
                          ? derived.accent.border
                          : TOKENS.border
                    }`,
                    background:
                      derived.mentions > 0 ? TOKENS.dangerBg : derived.unread > 0 ? derived.accent.bg : TOKENS.cardRaised,
                    color: derived.mentions > 0 ? TOKENS.red : derived.unread > 0 ? derived.accent.text : TOKENS.textSubtle,
                    fontFamily: TOKENS.mono,
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '0.03em',
                  }}
                >
                  {compactNumber(derived.mentions > 0 ? derived.mentions : derived.unread)}
                </span>

                {(model.liveLabel || model.connectionLabel || model.muted) ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      minHeight: 22,
                      padding: '0 8px',
                      borderRadius: 999,
                      border: `1px solid ${TOKENS.border}`,
                      background: TOKENS.chipBg,
                      color: TOKENS.textMuted,
                      fontFamily: TOKENS.mono,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                    }}
                  >
                    {model.liveLabel ? <span>{model.liveLabel}</span> : null}
                    {model.connectionLabel ? <span>{model.connectionLabel}</span> : null}
                    {model.muted ? <span>Muted</span> : null}
                  </span>
                ) : null}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <div
                style={{
                  display: 'grid',
                  gap: 6,
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                }}
              >
                <div
                  title={model.threatSummary?.tooltip}
                  style={{
                    display: 'grid',
                    gap: 3,
                    minWidth: 0,
                    padding: '8px 9px',
                    borderRadius: 12,
                    border: `1px solid ${derived.threat.border}`,
                    background: derived.threat.bg,
                  }}
                >
                  <span
                    style={{
                      color: derived.threat.accent,
                      fontFamily: TOKENS.mono,
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {derived.threat.icon} {readableThreat(model.threatSummary, model.threatBand)}
                  </span>
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'relative',
                      height: 6,
                      borderRadius: 999,
                      background: 'rgba(255,255,255,0.08)',
                      overflow: 'hidden',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: `${Math.round(derived.pressureRatio * 100)}%`,
                        background: `linear-gradient(90deg, ${derived.threat.accent}, ${derived.threat.accent})`,
                        borderRadius: 999,
                      }}
                    />
                  </div>
                </div>

                <div
                  title={model.presenceSummary?.tooltip}
                  style={{
                    display: 'grid',
                    gap: 3,
                    minWidth: 0,
                    padding: '8px 9px',
                    borderRadius: 12,
                    border: `1px solid ${TOKENS.border}`,
                    background: TOKENS.chipBg,
                  }}
                >
                  <span
                    style={{
                      color: derived.accent.text,
                      fontFamily: TOKENS.mono,
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {derived.presenceText || 'Presence quiet'}
                  </span>
                  <span
                    style={{
                      color: TOKENS.textSubtle,
                      fontFamily: TOKENS.display,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {presenceMoodLabel(model.presenceSummary)}
                  </span>
                </div>
              </div>

              {(derived.typingText || derived.helperText || derived.invasionText) ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {derived.typingText
                    ? renderPill({
                        id: `${model.id}:typing`,
                        label: derived.typingText,
                        icon: '…',
                        accent: 'cyan',
                        tone: 'neutral',
                      })
                    : null}
                  {derived.helperText
                    ? renderPill({
                        id: `${model.id}:helper`,
                        label: derived.helperText,
                        icon: '✦',
                        accent: 'emerald',
                        tone: 'supportive',
                        selected: true,
                      })
                    : null}
                  {derived.invasionText
                    ? renderPill({
                        id: `${model.id}:invasion`,
                        label: derived.invasionText,
                        icon: '⚠',
                        accent: 'red',
                        tone: 'danger',
                        selected: true,
                      })
                    : null}
                </div>
              ) : null}
            </div>
          </div>
        </button>

        {derived.channels.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {derived.channels.map((summary) => renderChannelButton(summary, model, onSelectChannel))}
          </div>
        ) : null}

        {derived.statusPills.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {derived.statusPills.map(renderPill)}
          </div>
        ) : null}

        {derived.chips.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{derived.chips.map(renderChip)}</div>
        ) : null}

        {derived.metrics.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gap: 6,
              gridTemplateColumns: `repeat(${Math.min(derived.metrics.length, 3)}, minmax(0, 1fr))`,
            }}
          >
            {derived.metrics.map(renderMetric)}
          </div>
        ) : null}

        {derived.actions.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {derived.actions.map((action) =>
              renderAction(action, model, onAction, onDismiss, onToggleExpanded),
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export const ChatCollapsedPill = memo(ChatCollapsedPillComponent);
export default ChatCollapsedPill;
