import React, { memo, useCallback, useMemo, type CSSProperties } from 'react';
import type {
  ChatUiAccent,
  ChatUiAttachment,
  ChatUiBadge,
  ChatUiChip,
  ChatUiDensity,
  ChatUiMessageBodyModel,
  ChatUiMessageMetaRail,
  ChatUiTextBlock,
  ChatUiTextSpan,
  ChatUiThreatBand,
  MessageCardActionCallbacks,
  MessageCardActionViewModel,
  MessageCardViewModel,
} from './uiTypes';

/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT MESSAGE CARD
 * FILE: pzo-web/src/components/chat/ChatMessageCard.tsx
 * VERSION: 3.0.0
 * AUTHOR: OpenAI
 * LICENSE: Internal / Project Use Only
 * ============================================================================
 *
 * Render-only message primitive for the thin chat shell.
 *
 * Design laws
 * -----------
 * 1. This component renders a pre-normalized MessageCardViewModel only.
 * 2. It does not infer message kind, threat class, proof authority, channel law,
 *    helper cadence, hater timing, moderation, or replay truth.
 * 3. Every visual distinction must come from the supplied UI model.
 * 4. Any migration-time legacy shape conversion belongs in useUnifiedChat.ts or a
 *    UI adapter surface, never here.
 * 5. The leaf stays rich, information-dense, and premium without becoming a
 *    second engine.
 * ============================================================================
 */

export interface ChatMessageCardProps extends MessageCardActionCallbacks {
  model: MessageCardViewModel;
  density?: ChatUiDensity;
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
  selected?: boolean;
  forceMetaRail?: boolean;
  actions?: readonly MessageCardActionViewModel[];
}

type TonePalette = {
  fg: string;
  muted: string;
  border: string;
  bg: string;
  soft: string;
  badge: string;
  strong: string;
  shadow: string;
};

const TOKENS = Object.freeze({
  void: '#05060B',
  panel: '#0C1020',
  panelHi: '#121933',
  panelLow: '#0A0F1B',
  text: '#F5F7FF',
  textSub: '#AAB2D3',
  textMute: '#6F789F',
  white06: 'rgba(255,255,255,0.06)',
  white08: 'rgba(255,255,255,0.08)',
  white10: 'rgba(255,255,255,0.10)',
  white14: 'rgba(255,255,255,0.14)',
  white18: 'rgba(255,255,255,0.18)',
  black20: 'rgba(0,0,0,0.20)',
  black32: 'rgba(0,0,0,0.32)',
  black48: 'rgba(0,0,0,0.48)',
  shadow: '0 18px 48px rgba(0,0,0,0.34)',
  shadowHot: '0 16px 44px rgba(99,102,241,0.28)',
  mono: "'IBM Plex Mono', 'JetBrains Mono', monospace",
  display: "'Syne', 'Outfit', system-ui, sans-serif",
  radius: 18,
  radiusSm: 12,
});

const ACCENTS: Record<ChatUiAccent, TonePalette> = {
  slate: { fg: '#D2D7E8', muted: '#9BA4C6', border: 'rgba(176,184,208,0.18)', bg: 'rgba(176,184,208,0.08)', soft: 'rgba(176,184,208,0.12)', badge: '#CBD5E1', strong: '#E2E8F0', shadow: 'rgba(148,163,184,0.22)' },
  silver: { fg: '#DDE2F5', muted: '#ACB3D1', border: 'rgba(221,226,245,0.18)', bg: 'rgba(221,226,245,0.07)', soft: 'rgba(221,226,245,0.12)', badge: '#E7EBFF', strong: '#F7F9FF', shadow: 'rgba(221,226,245,0.22)' },
  emerald: { fg: '#64F1A9', muted: '#90D8B0', border: 'rgba(52,211,153,0.26)', bg: 'rgba(52,211,153,0.08)', soft: 'rgba(52,211,153,0.14)', badge: '#34D399', strong: '#A7F3D0', shadow: 'rgba(52,211,153,0.24)' },
  amber: { fg: '#FFC966', muted: '#EAC17A', border: 'rgba(251,191,36,0.26)', bg: 'rgba(251,191,36,0.08)', soft: 'rgba(251,191,36,0.14)', badge: '#FBBF24', strong: '#FDE68A', shadow: 'rgba(251,191,36,0.24)' },
  rose: { fg: '#FF9DB3', muted: '#E6A1B5', border: 'rgba(244,114,182,0.26)', bg: 'rgba(244,114,182,0.08)', soft: 'rgba(244,114,182,0.14)', badge: '#F472B6', strong: '#FBCFE8', shadow: 'rgba(244,114,182,0.24)' },
  red: { fg: '#FF8787', muted: '#F3A1A1', border: 'rgba(248,113,113,0.28)', bg: 'rgba(248,113,113,0.08)', soft: 'rgba(248,113,113,0.14)', badge: '#F87171', strong: '#FECACA', shadow: 'rgba(248,113,113,0.24)' },
  violet: { fg: '#B79BFF', muted: '#C3B1FF', border: 'rgba(168,85,247,0.28)', bg: 'rgba(168,85,247,0.08)', soft: 'rgba(168,85,247,0.14)', badge: '#A855F7', strong: '#E9D5FF', shadow: 'rgba(168,85,247,0.24)' },
  cyan: { fg: '#6DEBFF', muted: '#8AD5E7', border: 'rgba(34,211,238,0.28)', bg: 'rgba(34,211,238,0.08)', soft: 'rgba(34,211,238,0.14)', badge: '#22D3EE', strong: '#A5F3FC', shadow: 'rgba(34,211,238,0.24)' },
  indigo: { fg: '#A4ACFF', muted: '#B9BFFF', border: 'rgba(129,140,248,0.28)', bg: 'rgba(129,140,248,0.08)', soft: 'rgba(129,140,248,0.14)', badge: '#818CF8', strong: '#C7D2FE', shadow: 'rgba(129,140,248,0.28)' },
  gold: { fg: '#FFD76E', muted: '#E8C677', border: 'rgba(250,204,21,0.28)', bg: 'rgba(250,204,21,0.08)', soft: 'rgba(250,204,21,0.14)', badge: '#FACC15', strong: '#FEF08A', shadow: 'rgba(250,204,21,0.24)' },
  obsidian: { fg: '#DFE4FF', muted: '#A8B0D0', border: 'rgba(255,255,255,0.12)', bg: 'rgba(255,255,255,0.04)', soft: 'rgba(255,255,255,0.08)', badge: '#E5E7EB', strong: '#FFFFFF', shadow: 'rgba(255,255,255,0.18)' },
};

const TONES: Record<string, { edge: string; glass: string; text: string; sub: string }> = {
  neutral: { edge: 'rgba(255,255,255,0.10)', glass: 'rgba(255,255,255,0.03)', text: TOKENS.text, sub: TOKENS.textSub },
  calm: { edge: 'rgba(103,201,255,0.20)', glass: 'rgba(103,201,255,0.06)', text: '#D9F2FF', sub: '#A8D8F0' },
  positive: { edge: 'rgba(52,211,153,0.22)', glass: 'rgba(52,211,153,0.07)', text: '#DDFCEC', sub: '#9FDEC2' },
  supportive: { edge: 'rgba(129,140,248,0.24)', glass: 'rgba(129,140,248,0.07)', text: '#E5E8FF', sub: '#BFC8FF' },
  warning: { edge: 'rgba(251,191,36,0.24)', glass: 'rgba(251,191,36,0.08)', text: '#FFF0C5', sub: '#E8CA8A' },
  danger: { edge: 'rgba(248,113,113,0.28)', glass: 'rgba(248,113,113,0.08)', text: '#FFE3E3', sub: '#F2B2B2' },
  hostile: { edge: 'rgba(255,95,109,0.32)', glass: 'rgba(255,95,109,0.10)', text: '#FFE2E7', sub: '#FFAFBB' },
  ghost: { edge: 'rgba(255,255,255,0.07)', glass: 'rgba(255,255,255,0.02)', text: '#D7DCEF', sub: '#8990B3' },
  premium: { edge: 'rgba(250,204,21,0.26)', glass: 'rgba(250,204,21,0.08)', text: '#FFF7D6', sub: '#E6D28C' },
  stealth: { edge: 'rgba(125,211,252,0.14)', glass: 'rgba(125,211,252,0.04)', text: '#D8F2FF', sub: '#95CDE4' },
  celebratory: { edge: 'rgba(244,114,182,0.24)', glass: 'rgba(244,114,182,0.07)', text: '#FFE3F2', sub: '#F7B5D7' },
  dramatic: { edge: 'rgba(168,85,247,0.28)', glass: 'rgba(168,85,247,0.08)', text: '#F0E5FF', sub: '#CCB0F5' },
};

const THREAT_RING: Record<ChatUiThreatBand, string> = {
  quiet: 'rgba(255,255,255,0.08)',
  elevated: 'rgba(103,201,255,0.18)',
  pressured: 'rgba(255,186,82,0.20)',
  hostile: 'rgba(255,95,109,0.24)',
  critical: 'rgba(255,95,109,0.30)',
  catastrophic: 'rgba(255,95,109,0.40)',
};

function pxDensity(density: ChatUiDensity | undefined) {
  switch (density) {
    case 'compact':
      return { pad: 12, body: 13, meta: 10, gap: 8, avatar: 34 };
    case 'expanded':
      return { pad: 18, body: 15, meta: 11, gap: 12, avatar: 42 };
    case 'cinematic':
      return { pad: 20, body: 16, meta: 11, gap: 14, avatar: 46 };
    case 'comfortable':
    default:
      return { pad: 16, body: 14, meta: 10.5, gap: 10, avatar: 38 };
  }
}

function pickAccent(accent?: ChatUiAccent): TonePalette {
  return ACCENTS[accent ?? 'indigo'];
}

function pickTone(tone?: string) {
  return TONES[tone ?? 'neutral'] ?? TONES.neutral;
}

function toneFromBadge(badge: ChatUiBadge | ChatUiChip | ChatUiAttachment | MessageCardActionViewModel): TonePalette {
  return pickAccent((badge as { accent?: ChatUiAccent }).accent);
}

function formatTextSpan(span: ChatUiTextSpan): CSSProperties {
  const base: CSSProperties = {
    fontWeight: span.bold ? 700 : 500,
    fontStyle: span.italic ? 'italic' : 'normal',
    fontFamily: span.mono ? TOKENS.mono : undefined,
    textDecoration: span.strike ? 'line-through' : 'none',
  };

  const accent = pickAccent(span.accent ?? 'obsidian');
  if (span.tone === 'danger' || span.tone === 'hostile') {
    base.color = '#FFB4B4';
  } else if (span.tone === 'warning') {
    base.color = '#FFE2A2';
  } else if (span.tone === 'supportive' || span.tone === 'positive') {
    base.color = '#BCFFD7';
  } else if (span.tone === 'calm' || span.tone === 'stealth') {
    base.color = '#B8EEFF';
  } else if (span.accent) {
    base.color = accent.fg;
  }

  return base;
}

function renderTextBlock(block: ChatUiTextBlock, density: ReturnType<typeof pxDensity>) {
  const tone = block.kind === 'warning'
    ? '#FFE1A2'
    : block.kind === 'notice'
      ? '#D7DFFF'
      : block.kind === 'caption'
        ? TOKENS.textMute
        : TOKENS.text;

  return (
    <div
      key={block.id}
      style={{
        display: 'block',
        color: tone,
        fontSize: block.kind === 'caption' ? density.meta : density.body,
        lineHeight: block.kind === 'caption' ? 1.5 : 1.62,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {block.spans.map((span) => (
        <span key={span.id} style={formatTextSpan(span)}>
          {span.text}
        </span>
      ))}
    </div>
  );
}

function renderMetaRail(meta: ChatUiMessageMetaRail, density: ReturnType<typeof pxDensity>, callbacks: MessageCardActionCallbacks, model: MessageCardViewModel) {
  const chips = [...(meta.chips ?? []), ...(meta.badges ?? []).map((badge) => ({ id: badge.id, label: badge.shortLabel ?? badge.label, accent: badge.accent, tone: badge.tone, tooltip: badge.tooltip }))];
  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Pill label={meta.timestamp.displayLabel} accent={'obsidian'} tone={'ghost'} mono />
        {meta.channel && <Pill label={meta.channel.channelLabel} accent={'indigo'} tone={'calm'} />}
        {meta.threat?.pressureTier && <Pill label={String(meta.threat.pressureTier)} accent={'amber'} tone={'warning'} />}
        {meta.threat?.tickTier && <Pill label={String(meta.threat.tickTier)} accent={'cyan'} tone={'calm'} />}
        {meta.integrity?.roomLockLabel && <Pill label={meta.integrity.roomLockLabel} accent={'gold'} tone={'premium'} />}
        {meta.learning?.engagementLabel && <Pill label={meta.learning.engagementLabel} accent={'violet'} tone={'dramatic'} />}
        {meta.learning?.dropOffRiskLabel && <Pill label={meta.learning.dropOffRiskLabel} accent={'rose'} tone={'warning'} />}
        {chips.map((chip) => (
          <Pill key={chip.id} label={chip.label} accent={chip.accent ?? 'obsidian'} tone={chip.tone ?? 'ghost'} tooltip={chip.tooltip} />
        ))}
      </div>

      {(meta.proof || meta.threat || meta.integrity || meta.learning) && (
        <div
          style={{
            display: 'grid',
            gap: 8,
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          }}
        >
          {meta.proof && (
            <MetaCard
              title={'PROOF'}
              value={meta.proof.proofHashLabel ?? meta.proof.proofSummary ?? (meta.proof.verified ? 'VERIFIED' : 'TRACE')}
              subtitle={meta.proof.proofSummary}
              accent={'gold'}
              tone={meta.proof.verified ? 'premium' : 'warning'}
              onClick={callbacks.onInspectProof ? () => callbacks.onInspectProof?.(meta.proof?.proofId, model) : undefined}
              mono={Boolean(meta.proof.proofHashLabel)}
            />
          )}
          {meta.threat && (
            <MetaCard
              title={'THREAT'}
              value={meta.threat.dangerSummary ?? meta.threat.band.toUpperCase()}
              subtitle={[meta.threat.attackTypeLabel, meta.threat.imminent ? 'IMMINENT' : undefined].filter(Boolean).join(' · ') || undefined}
              accent={meta.threat.band === 'critical' || meta.threat.band === 'catastrophic' ? 'red' : meta.threat.band === 'hostile' ? 'rose' : meta.threat.band === 'pressured' ? 'amber' : 'cyan'}
              tone={meta.threat.band === 'quiet' ? 'ghost' : meta.threat.band === 'elevated' ? 'calm' : meta.threat.band === 'pressured' ? 'warning' : 'danger'}
            />
          )}
          {meta.integrity && (
            <MetaCard
              title={'INTEGRITY'}
              value={meta.integrity.visibilityLabel ?? meta.integrity.band.toUpperCase()}
              subtitle={[meta.integrity.moderationLabel, meta.integrity.redacted ? 'REDACTED' : undefined, meta.integrity.edited ? 'EDITED' : undefined].filter(Boolean).join(' · ') || undefined}
              accent={meta.integrity.band === 'sealed' ? 'gold' : meta.integrity.band === 'shadowed' ? 'violet' : 'silver'}
              tone={meta.integrity.band === 'shadowed' ? 'dramatic' : meta.integrity.band === 'sealed' ? 'premium' : 'ghost'}
            />
          )}
          {meta.learning && (
            <MetaCard
              title={'LEARNING'}
              value={meta.learning.recommendationLabel ?? meta.learning.engagementLabel ?? 'PROFILE LIVE'}
              subtitle={[meta.learning.memoryAnchorLabel, meta.learning.memoryHit ? 'MEMORY HIT' : undefined].filter(Boolean).join(' · ') || undefined}
              accent={meta.learning.memoryHit ? 'violet' : 'indigo'}
              tone={meta.learning.memoryHit ? 'dramatic' : 'supportive'}
            />
          )}
        </div>
      )}
    </div>
  );
}

const Pill = memo(function Pill({
  label,
  accent,
  tone,
  mono,
  tooltip,
}: {
  label: string;
  accent: ChatUiAccent;
  tone: string;
  mono?: boolean;
  tooltip?: string;
}) {
  const palette = pickAccent(accent);
  const tonePack = pickTone(tone);
  return (
    <span
      title={tooltip}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        minHeight: 24,
        padding: '0 9px',
        borderRadius: 999,
        border: `1px solid ${palette.border}`,
        background: tonePack.glass,
        color: palette.fg,
        fontFamily: mono ? TOKENS.mono : TOKENS.display,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </span>
  );
});

const MetaCard = memo(function MetaCard({
  title,
  value,
  subtitle,
  accent,
  tone,
  onClick,
  mono,
}: {
  title: string;
  value: string;
  subtitle?: string;
  accent: ChatUiAccent;
  tone: string;
  onClick?: () => void;
  mono?: boolean;
}) {
  const palette = pickAccent(accent);
  const tonePack = pickTone(tone);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      style={{
        appearance: 'none',
        textAlign: 'left',
        width: '100%',
        cursor: onClick ? 'pointer' : 'default',
        borderRadius: TOKENS.radiusSm,
        border: `1px solid ${palette.border}`,
        background: tonePack.glass,
        padding: '10px 12px',
        color: tonePack.text,
        boxShadow: onClick ? `0 10px 24px ${palette.shadow}` : 'none',
      }}
    >
      <div style={{ fontFamily: TOKENS.mono, fontSize: 10, letterSpacing: '0.10em', color: palette.muted }}>{title}</div>
      <div style={{ marginTop: 5, fontFamily: mono ? TOKENS.mono : TOKENS.display, fontSize: 12.5, color: palette.strong, lineHeight: 1.45 }}>{value}</div>
      {subtitle && <div style={{ marginTop: 4, fontSize: 11, color: tonePack.sub, lineHeight: 1.45 }}>{subtitle}</div>}
    </button>
  );
});

function ActionBar({
  model,
  actions,
  callbacks,
}: {
  model: MessageCardViewModel;
  actions: readonly MessageCardActionViewModel[];
  callbacks: MessageCardActionCallbacks;
}) {
  if (!actions.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
      {actions.map((action) => {
        const palette = toneFromBadge(action);
        const disabled = Boolean(action.disabled);
        return (
          <button
            key={action.id}
            type="button"
            disabled={disabled}
            title={action.tooltip}
            onClick={() => callbacks.onMessageAction?.(action.id, model.id, model)}
            style={{
              appearance: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              borderRadius: 12,
              padding: '9px 12px',
              border: `1px solid ${palette.border}`,
              background: action.primary ? palette.soft : TOKENS.white06,
              color: palette.fg,
              fontFamily: TOKENS.mono,
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              opacity: disabled ? 0.45 : 1,
            }}
          >
            {action.icon ? `${action.icon} ` : ''}{action.label}
          </button>
        );
      })}
    </div>
  );
}

export const ChatMessageCard = memo(function ChatMessageCard({
  model,
  density = 'comfortable',
  compact = false,
  className,
  style,
  selected,
  forceMetaRail,
  actions = [],
  onSelectMessage,
  onMessageAction,
  onSelectSender,
  onInspectProof,
  onJumpToCause,
  onActivateQuote,
}: ChatMessageCardProps) {
  const dims = pxDensity(compact ? 'compact' : density);
  const palette = pickAccent(model.accent);
  const tonePack = pickTone(model.tone);
  const callbacks = useMemo<MessageCardActionCallbacks>(
    () => ({ onSelectMessage, onMessageAction, onSelectSender, onInspectProof, onJumpToCause, onActivateQuote }),
    [onSelectMessage, onMessageAction, onSelectSender, onInspectProof, onJumpToCause, onActivateQuote],
  );

  const threatRing = model.meta.threat ? THREAT_RING[model.meta.threat.band] : TOKENS.white08;
  const clickable = Boolean(onSelectMessage && (model.displayHints.selectable || model.displayHints.hoverable));

  const handleSelect = useCallback(() => {
    onSelectMessage?.(model.id, model);
  }, [onSelectMessage, model]);

  const handleSenderSelect = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onSelectSender?.(String(model.author.id), model);
    },
    [onSelectSender, model],
  );

  const handleJumpToCause = useCallback(() => {
    onJumpToCause?.(model.id, model);
  }, [onJumpToCause, model]);

  const rootStyle: CSSProperties = {
    position: 'relative',
    display: 'grid',
    gap: dims.gap,
    padding: dims.pad,
    borderRadius: TOKENS.radius,
    border: `1px solid ${selected || model.selected ? palette.border : tonePack.edge}`,
    background: `linear-gradient(180deg, ${tonePack.glass} 0%, rgba(10,15,27,0.88) 100%)`,
    boxShadow: selected || model.selected ? TOKENS.shadowHot : TOKENS.shadow,
    cursor: clickable ? 'pointer' : 'default',
    overflow: 'hidden',
    isolation: 'isolate',
    ...style,
  };

  return (
    <article
      className={className}
      style={rootStyle}
      onClick={clickable ? handleSelect : undefined}
      data-message-id={model.id}
      data-message-kind={model.kind}
      data-display-intent={model.displayIntent}
      data-tone={model.tone}
      data-accent={model.accent}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          boxShadow: `inset 3px 0 0 ${palette.fg}, inset 0 0 0 1px ${threatRing}`,
          opacity: model.emphasis === 'hero' ? 1 : 0.88,
        }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: `${dims.avatar}px minmax(0, 1fr)`, gap: dims.gap, alignItems: 'start' }}>
        <div
          style={{
            width: dims.avatar,
            height: dims.avatar,
            borderRadius: 14,
            display: 'grid',
            placeItems: 'center',
            background: palette.soft,
            border: `1px solid ${palette.border}`,
            color: palette.strong,
            fontFamily: TOKENS.display,
            fontWeight: 800,
            fontSize: compact ? 13 : 15,
          }}
        >
          {model.author.avatar?.emoji ?? model.author.avatar?.initials ?? model.author.shortName?.slice(0, 2).toUpperCase() ?? model.author.displayName.slice(0, 2).toUpperCase()}
        </div>

        <div style={{ minWidth: 0, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0, display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleSenderSelect}
                  disabled={!onSelectSender}
                  style={{
                    appearance: 'none',
                    background: 'transparent',
                    border: 0,
                    padding: 0,
                    margin: 0,
                    color: palette.strong,
                    cursor: onSelectSender ? 'pointer' : 'default',
                    fontFamily: TOKENS.display,
                    fontSize: compact ? 13 : 14,
                    fontWeight: 800,
                    letterSpacing: '0.01em',
                    textAlign: 'left',
                  }}
                >
                  {model.author.displayName}
                </button>
                {model.author.roleLabel && <Pill label={model.author.roleLabel} accent={model.accent} tone={model.tone} />}
                {model.author.factionLabel && <Pill label={model.author.factionLabel} accent={'obsidian'} tone={'ghost'} />}
                {model.unread && <Pill label={'UNREAD'} accent={'gold'} tone={'premium'} />}
                {model.pinned && <Pill label={'PINNED'} accent={'violet'} tone={'dramatic'} />}
              </div>
              {(model.author.subtitle || model.author.signature?.voiceprintLabel || model.author.signature?.cadenceLabel) && (
                <div style={{ color: tonePack.sub, fontSize: dims.meta, lineHeight: 1.5, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {model.author.subtitle && <span>{model.author.subtitle}</span>}
                  {model.author.signature?.voiceprintLabel && <span>{model.author.signature.voiceprintLabel}</span>}
                  {model.author.signature?.cadenceLabel && <span>{model.author.signature.cadenceLabel}</span>}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'end' }}>
              {model.meta.badges?.map((badge) => (
                <Pill key={badge.id} label={badge.shortLabel ?? badge.label} accent={badge.accent} tone={badge.tone} tooltip={badge.tooltip} />
              ))}
            </div>
          </div>

          <MessageBody
            density={dims}
            body={model.body}
            model={model}
            onActivateQuote={onActivateQuote}
          />

          {(forceMetaRail || model.displayHints.showMetaRail || model.displayHints.showProofBadges || model.displayHints.showThreatBadges || model.displayHints.showLearningBadges) &&
            renderMetaRail(model.meta, dims, callbacks, model)}

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {model.canJumpToCause && (
                <button type="button" onClick={handleJumpToCause} style={ghostButtonStyle('indigo')}>
                  JUMP TO CAUSE
                </button>
              )}
              {model.canInspectProof && model.meta.proof && (
                <button type="button" onClick={() => onInspectProof?.(model.meta.proof?.proofId, model)} style={ghostButtonStyle('gold')}>
                  INSPECT PROOF
                </button>
              )}
            </div>
            <div style={{ fontFamily: TOKENS.mono, fontSize: dims.meta, letterSpacing: '0.08em', color: TOKENS.textMute }}>
              {model.meta.timestamp.relativeLabel ?? model.meta.timestamp.displayLabel}
            </div>
          </div>

          <ActionBar model={model} actions={actions} callbacks={callbacks} />
        </div>
      </div>
    </article>
  );
});

function MessageBody({
  body,
  density,
  model,
  onActivateQuote,
}: {
  body: ChatUiMessageBodyModel;
  density: ReturnType<typeof pxDensity>;
  model: MessageCardViewModel;
  onActivateQuote?: (quotedMessageId: string | undefined, model: MessageCardViewModel) => void;
}) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {renderTextBlock(body.primary, density)}

      {body.quote && (
        <button
          type="button"
          onClick={() => onActivateQuote?.(body.quote?.messageId, model)}
          style={{
            appearance: 'none',
            border: `1px solid ${TOKENS.white10}`,
            background: TOKENS.white06,
            borderRadius: 14,
            padding: '10px 12px',
            textAlign: 'left',
            cursor: onActivateQuote ? 'pointer' : 'default',
          }}
        >
          <div style={{ fontFamily: TOKENS.mono, fontSize: 10, letterSpacing: '0.08em', color: TOKENS.textMute }}>
            {body.quote.authorLabel ?? 'QUOTE'}{body.quote.channelLabel ? ` · ${body.quote.channelLabel}` : ''}
          </div>
          <div style={{ marginTop: 6, color: TOKENS.textSub, lineHeight: 1.55 }}>{body.quote.text}</div>
        </button>
      )}

      {body.secondary?.map((block) => renderTextBlock(block, density))}

      {body.attachments && body.attachments.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          {body.attachments.map((attachment) => {
            const palette = toneFromBadge(attachment);
            return (
              <div
                key={attachment.id}
                style={{
                  borderRadius: 14,
                  border: `1px solid ${palette.border}`,
                  background: palette.soft,
                  padding: '10px 12px',
                  display: 'grid',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: TOKENS.mono, fontSize: 10, letterSpacing: '0.08em', color: palette.fg }}>
                    {attachment.kind.replace(/_/g, ' ')}
                  </span>
                  {attachment.actionable && <Pill label={'ACTIONABLE'} accent={attachment.accent ?? 'indigo'} tone={attachment.tone ?? 'calm'} />}
                </div>
                <div style={{ color: palette.strong, fontWeight: 700 }}>{attachment.label}</div>
                {attachment.subtitle && <div style={{ color: TOKENS.textSub, fontSize: 12 }}>{attachment.subtitle}</div>}
                {attachment.description && <div style={{ color: TOKENS.textMute, fontSize: 11.5, lineHeight: 1.5 }}>{attachment.description}</div>}
              </div>
            );
          })}
        </div>
      )}

      {body.reactions && body.reactions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {body.reactions.map((reaction) => (
            <div key={reaction.id} style={{ borderRadius: 999, border: `1px solid ${TOKENS.white10}`, background: TOKENS.white06, padding: '6px 10px', color: reaction.selected ? TOKENS.text : TOKENS.textSub, fontSize: 12, display: 'inline-flex', gap: 6 }}>
              <span>{reaction.emoji ?? '•'}</span>
              <span>{reaction.label}</span>
              <span style={{ fontFamily: TOKENS.mono, color: TOKENS.textMute }}>{reaction.count}</span>
            </div>
          ))}
        </div>
      )}

      {body.commandHints && body.commandHints.length > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          {body.commandHints.map((hint) => (
            <div key={hint.id} style={{ display: 'grid', gap: 4, borderRadius: 12, border: `1px dashed ${TOKENS.white14}`, background: TOKENS.white06, padding: '8px 10px' }}>
              <div style={{ fontFamily: TOKENS.mono, fontSize: 10, letterSpacing: '0.08em', color: TOKENS.textSub }}>{hint.command}</div>
              <div style={{ color: TOKENS.text }}>{hint.label}</div>
              {hint.description && <div style={{ color: TOKENS.textMute, fontSize: 11.5 }}>{hint.description}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ghostButtonStyle(accent: ChatUiAccent): CSSProperties {
  const palette = pickAccent(accent);
  return {
    appearance: 'none',
    cursor: 'pointer',
    borderRadius: 12,
    border: `1px solid ${palette.border}`,
    background: palette.soft,
    color: palette.fg,
    padding: '8px 11px',
    fontFamily: TOKENS.mono,
    fontSize: 10,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  };
}

export default ChatMessageCard;
