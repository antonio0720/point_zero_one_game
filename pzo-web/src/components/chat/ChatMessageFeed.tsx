import React, { memo, useEffect, useMemo } from 'react';
import type {
  ChatUiDensity,
  ChatUiEmptyStateViewModel,
  ChatUiFeedRow,
  ChatUiMessageCardViewModel,
  ChatUiVisibleRange,
  FeedRowModel,
  MessageCardActionViewModel,
  MessageFeedCallbacks,
  MessageFeedViewModel,
} from './uiTypes';

/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT MESSAGE FEED
 * FILE: pzo-web/src/components/chat/ChatMessageFeed.tsx
 * VERSION: 3.1.0
 * AUTHOR: OpenAI
 * LICENSE: Internal / Project Use Only
 * ============================================================================
 *
 * Purpose
 * -------
 * Render-only feed primitive for the unified chat shell.
 *
 * This version merges the older richer feed-row support with the newer
 * self-contained renderer so it works cleanly with:
 * - uiTypes.ts
 * - useUnifiedChat.ts
 * - UnifiedChatDock.tsx
 *
 * Design laws
 * -----------
 * - UI only; never derive engine truth here.
 * - Accept normalized feed rows only.
 * - Support both modern MessageFeedViewModel input and direct row arrays.
 * - Render all current row kinds without importing engine-lane helpers.
 * ============================================================================
 */

export type FeedFollowMode = 'AUTO' | 'LOCKED' | 'MANUAL';

export interface ChatMessageFeedProps extends MessageFeedCallbacks {
  model?: MessageFeedViewModel;
  rows?: readonly FeedRowModel[];
  density?: ChatUiDensity;
  className?: string;
  style?: React.CSSProperties;
  followMode?: FeedFollowMode;
  overscan?: number;
  maxRows?: number;
  showJumpToLatest?: boolean;
  cardActions?:
    | readonly MessageCardActionViewModel[]
    | ((model: ChatUiMessageCardViewModel) => readonly MessageCardActionViewModel[]);
}

const TOKENS = Object.freeze({
  panel: '#0B1020',
  surface: '#0F1630',
  surfaceAlt: '#121B39',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',
  text: '#F5F7FF',
  textSub: '#AAB2D3',
  textMute: '#70789C',
  white04: 'rgba(255,255,255,0.04)',
  white06: 'rgba(255,255,255,0.06)',
  indigo: '#818CF8',
  indigoSoft: 'rgba(129,140,248,0.14)',
  cyan: '#22D3EE',
  cyanSoft: 'rgba(34,211,238,0.14)',
  amber: '#FBBF24',
  amberSoft: 'rgba(251,191,36,0.14)',
  rose: '#FB7185',
  roseSoft: 'rgba(251,113,133,0.14)',
  emerald: '#34D399',
  emeraldSoft: 'rgba(52,211,153,0.14)',
  mono: "'IBM Plex Mono', 'JetBrains Mono', monospace",
  display: "'Syne', 'Outfit', system-ui, sans-serif",
});

function densityFont(density: ChatUiDensity | undefined): number {
  switch (density) {
    case 'compact':
      return 13;
    case 'expanded':
      return 15;
    case 'cinematic':
      return 16;
    case 'comfortable':
    default:
      return 14;
  }
}

function isMessageRow(row: ChatUiFeedRow): row is ChatUiMessageCardViewModel {
  return (row as ChatUiMessageCardViewModel).author !== undefined
    && (row as ChatUiMessageCardViewModel).body !== undefined
    && (row as ChatUiMessageCardViewModel).meta !== undefined;
}

function resolveRows(model?: MessageFeedViewModel, rows?: readonly FeedRowModel[], maxRows?: number): readonly FeedRowModel[] {
  const base = model?.flatRows ?? rows ?? [];
  if (typeof maxRows === 'number' && maxRows > 0 && base.length > maxRows) {
    return base.slice(base.length - maxRows);
  }
  return base;
}

function resolveVisibleRange(allRows: readonly FeedRowModel[]): ChatUiVisibleRange {
  if (allRows.length === 0) {
    return { startIndex: 0, endIndex: 0, totalCount: 0 };
  }
  return {
    startIndex: 0,
    endIndex: allRows.length - 1,
    totalCount: allRows.length,
  };
}

function renderChip(label: string, tone: string = 'default'): React.JSX.Element {
  const palette =
    tone === 'danger'
      ? { color: '#FFD7DC', bg: TOKENS.roseSoft, border: 'rgba(251,113,133,0.28)' }
      : tone === 'warning'
        ? { color: '#FFE8B0', bg: TOKENS.amberSoft, border: 'rgba(251,191,36,0.24)' }
        : tone === 'premium'
          ? { color: '#DDE3FF', bg: TOKENS.indigoSoft, border: 'rgba(129,140,248,0.24)' }
          : { color: TOKENS.textSub, bg: TOKENS.white06, border: TOKENS.border };

  return (
    <span
      style={{
        fontSize: 10,
        color: palette.color,
        border: `1px solid ${palette.border}`,
        borderRadius: 999,
        padding: '4px 8px',
        fontFamily: TOKENS.mono,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        background: palette.bg,
      }}
    >
      {label}
    </span>
  );
}

function EmptyStateCard({ model }: { model: ChatUiEmptyStateViewModel }): React.JSX.Element {
  return (
    <div
      style={{
        display: 'grid',
        gap: 10,
        borderRadius: 18,
        border: `1px solid ${TOKENS.border}`,
        background: TOKENS.white04,
        padding: 18,
        color: TOKENS.text,
      }}
    >
      <div style={{ fontFamily: TOKENS.display, fontSize: 16, fontWeight: 800 }}>{model.title}</div>
      <div style={{ color: TOKENS.textSub, lineHeight: 1.65 }}>{model.body}</div>
      {model.hint ? <div style={{ color: TOKENS.textMute, fontSize: 12 }}>{model.hint}</div> : null}
      {model.actions?.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {model.actions.map((action) => (
            <span key={action.id}>{renderChip(action.label, action.tone)}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const DividerRow = memo(function DividerRow({ label }: { label: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 10, minHeight: 42 }}>
      <div style={{ height: 1, background: TOKENS.border }} />
      <div style={{ fontFamily: TOKENS.mono, fontSize: 10, letterSpacing: '0.10em', color: TOKENS.textMute, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ height: 1, background: TOKENS.border }} />
    </div>
  );
});

const UnreadBreak = memo(function UnreadBreak({ label, count }: { label: string; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48 }}>
      <div style={{ flex: 1, height: 1, background: TOKENS.rose }} />
      <div
        style={{
          borderRadius: 999,
          border: `1px solid ${TOKENS.rose}`,
          background: TOKENS.roseSoft,
          color: '#FFD8DE',
          padding: '7px 12px',
          fontFamily: TOKENS.mono,
          fontSize: 10,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
        }}
      >
        {label}{typeof count === 'number' ? ` · ${count}` : ''}
      </div>
      <div style={{ flex: 1, height: 1, background: TOKENS.rose }} />
    </div>
  );
});

const SceneMarker = memo(function SceneMarker({ label, subtitle }: { label: string; subtitle?: string }) {
  return (
    <div style={{ minHeight: 62, display: 'grid', gap: 6, borderRadius: 14, border: `1px solid ${TOKENS.border}`, background: TOKENS.white04, padding: '10px 12px' }}>
      <div style={{ fontFamily: TOKENS.mono, fontSize: 10, letterSpacing: '0.08em', color: TOKENS.indigo, textTransform: 'uppercase' }}>Scene</div>
      <div style={{ color: TOKENS.text, fontWeight: 800, fontFamily: TOKENS.display }}>{label}</div>
      {subtitle ? <div style={{ color: TOKENS.textSub, fontSize: 12 }}>{subtitle}</div> : null}
    </div>
  );
});

const GapMarker = memo(function GapMarker({ label, hiddenCount, onActivate }: { label: string; hiddenCount?: number; onActivate?: () => void }) {
  return (
    <button
      type="button"
      onClick={onActivate}
      style={{
        appearance: 'none',
        width: '100%',
        minHeight: 54,
        borderRadius: 14,
        border: `1px dashed ${TOKENS.borderStrong}`,
        background: TOKENS.white04,
        color: TOKENS.textSub,
        cursor: onActivate ? 'pointer' : 'default',
        fontFamily: TOKENS.mono,
        fontSize: 10,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}
    >
      {label}{typeof hiddenCount === 'number' ? ` · ${hiddenCount}` : ''}
    </button>
  );
});

const TypingCluster = memo(function TypingCluster({ label, actorLabels }: { label: string; actorLabels?: readonly string[] }) {
  return (
    <div style={{ minHeight: 56, display: 'grid', gap: 6, borderRadius: 14, border: `1px solid ${TOKENS.border}`, background: TOKENS.cyanSoft, padding: '10px 12px' }}>
      <div style={{ fontFamily: TOKENS.mono, fontSize: 10, letterSpacing: '0.08em', color: TOKENS.cyan, textTransform: 'uppercase' }}>{label}</div>
      {actorLabels?.length ? <div style={{ color: TOKENS.textSub, fontSize: 12 }}>{actorLabels.join(' · ')}</div> : null}
    </div>
  );
});

const LoadOlderRow = memo(function LoadOlderRow({
  label,
  available,
  pending,
  onLoadOlder,
}: {
  label: string;
  available?: boolean;
  pending?: boolean;
  onLoadOlder?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!available || pending}
      onClick={onLoadOlder}
      style={{
        appearance: 'none',
        width: '100%',
        minHeight: 56,
        borderRadius: 14,
        border: `1px solid ${TOKENS.indigo}`,
        background: TOKENS.indigoSoft,
        color: '#DBE0FF',
        cursor: !available || pending ? 'not-allowed' : 'pointer',
        opacity: !available ? 0.5 : 1,
        fontFamily: TOKENS.mono,
        fontSize: 10,
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
      }}
    >
      {pending ? 'Loading…' : label}
    </button>
  );
});

function MessageCard({
  row,
  density,
  actions,
  onSelectMessage,
  onMessageAction,
  onSelectSender,
  onInspectProof,
  onJumpToCause,
  onActivateQuote,
}: {
  row: ChatUiMessageCardViewModel;
  density?: ChatUiDensity;
  actions: readonly MessageCardActionViewModel[];
} & Pick<
  ChatMessageFeedProps,
  'onSelectMessage' | 'onMessageAction' | 'onSelectSender' | 'onInspectProof' | 'onJumpToCause' | 'onActivateQuote'
>): React.JSX.Element {
  const text = row.body.primary.spans.map((span) => span.text).join('');
  const bodyFont = densityFont(density);

  return (
    <div
      onClick={() => onSelectMessage?.(row.id, row)}
      style={{
        border: '1px solid rgba(255,255,255,0.10)',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 14,
        padding: 12,
        display: 'grid',
        gap: 8,
        cursor: onSelectMessage ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: '#f5f7ff', fontWeight: 700, fontSize: 13 }}>{row.author.displayName}</span>
        {row.author.roleLabel ? <span style={{ color: '#a7b2d4', fontSize: 11 }}>{row.author.roleLabel}</span> : null}
        <span style={{ color: '#7180a8', fontSize: 11 }}>{row.meta.timestamp.displayLabel}</span>
        {row.meta.channel?.channelLabel ? <span style={{ color: '#8ea0ff', fontSize: 11 }}>{row.meta.channel.channelLabel}</span> : null}
      </div>

      <div style={{ color: '#f5f7ff', fontSize: bodyFont, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{text}</div>

      {row.body.quote?.text ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onActivateQuote?.(row.body.quote?.messageId, row);
          }}
          style={{
            appearance: 'none',
            textAlign: 'left',
            border: `1px solid ${TOKENS.border}`,
            background: TOKENS.white04,
            color: TOKENS.textSub,
            borderRadius: 12,
            padding: '10px 12px',
            cursor: 'pointer',
          }}
        >
          {row.body.quote.text}
        </button>
      ) : null}

      {row.body.attachments?.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {row.body.attachments.map((attachment) => (
            <span key={attachment.id}>{renderChip(attachment.label, attachment.tone)}</span>
          ))}
        </div>
      ) : null}

      {(row.meta.chips?.length || actions.length || row.canInspectProof || row.canJumpToCause) ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {row.meta.chips?.map((chip) => (
            <span key={chip.id}>{renderChip(chip.shortLabel || chip.label, chip.tone)}</span>
          ))}

          {row.canInspectProof ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onInspectProof?.(row.meta.proof?.proofId, row);
              }}
              style={{
                appearance: 'none',
                border: '1px solid rgba(255,255,255,0.10)',
                background: 'rgba(255,255,255,0.04)',
                color: '#f5f7ff',
                borderRadius: 10,
                padding: '6px 8px',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Proof
            </button>
          ) : null}

          {row.canJumpToCause ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onJumpToCause?.(row.id, row);
              }}
              style={{
                appearance: 'none',
                border: '1px solid rgba(255,255,255,0.10)',
                background: 'rgba(255,255,255,0.04)',
                color: '#f5f7ff',
                borderRadius: 10,
                padding: '6px 8px',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Cause
            </button>
          ) : null}

          {onSelectSender ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSelectSender(row.author.id, row);
              }}
              style={{
                appearance: 'none',
                border: '1px solid rgba(255,255,255,0.10)',
                background: 'rgba(255,255,255,0.04)',
                color: '#f5f7ff',
                borderRadius: 10,
                padding: '6px 8px',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Sender
            </button>
          ) : null}

          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              disabled={action.disabled}
              onClick={(event) => {
                event.stopPropagation();
                onMessageAction?.(action.id, row.id, row);
              }}
              title={action.tooltip}
              style={{
                appearance: 'none',
                border: '1px solid rgba(255,255,255,0.10)',
                background: action.primary ? TOKENS.indigoSoft : 'rgba(255,255,255,0.04)',
                color: '#f5f7ff',
                borderRadius: 10,
                padding: '6px 8px',
                fontSize: 11,
                cursor: action.disabled ? 'not-allowed' : 'pointer',
                opacity: action.disabled ? 0.5 : 1,
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export const ChatMessageFeed = memo(function ChatMessageFeed({
  model,
  rows,
  density = 'comfortable',
  className,
  style,
  followMode = 'AUTO',
  overscan = 6,
  maxRows,
  showJumpToLatest = true,
  cardActions,
  onVisibleRangeChange,
  onJumpToLatest,
  onLoadOlder,
  onActivateRow,
  onSelectMessage,
  onMessageAction,
  onSelectSender,
  onInspectProof,
  onJumpToCause,
  onActivateQuote,
}: ChatMessageFeedProps): React.JSX.Element {
  const effectiveRows = useMemo(() => resolveRows(model, rows, maxRows), [model, rows, maxRows]);
  const visibleRange = useMemo(() => resolveVisibleRange(effectiveRows), [effectiveRows]);

  useEffect(() => {
    onVisibleRangeChange?.(visibleRange);
  }, [onVisibleRangeChange, visibleRange]);

  const resolveActions = useMemo(() => {
    return (row: ChatUiMessageCardViewModel): readonly MessageCardActionViewModel[] => {
      if (typeof cardActions === 'function') return cardActions(row);
      return cardActions ?? [];
    };
  }, [cardActions]);

  return (
    <div
      className={className}
      data-follow-mode={followMode}
      data-overscan={overscan}
      style={{
        display: 'grid',
        gap: 10,
        width: '100%',
        ...style,
      }}
    >
      {effectiveRows.length === 0 ? (
        <EmptyStateCard
          model={{
            id: 'feed-empty',
            kind: 'quiet_room',
            title: 'No feed rows available',
            body: 'The message feed is waiting for normalized rows from the UI adapter surface.',
            tone: 'neutral',
            accent: 'slate',
          }}
        />
      ) : effectiveRows.map((row) => {
        if (!isMessageRow(row)) {
          switch (row.kind) {
            case 'day_break':
              return <DividerRow key={row.id} label={row.label} />;
            case 'unread_break':
              return <UnreadBreak key={row.id} label={row.label} count={row.unreadCount} />;
            case 'scene_marker':
              return <SceneMarker key={row.id} label={row.label} subtitle={row.subtitle} />;
            case 'gap_marker':
              return <GapMarker key={row.id} label={row.label} hiddenCount={row.hiddenCount} onActivate={() => onActivateRow?.(row.id, row)} />;
            case 'typing_cluster':
              return <TypingCluster key={row.id} label={row.label} actorLabels={row.entities.map((entity) => entity.label)} />;
            case 'load_older':
              return <LoadOlderRow key={row.id} label={row.label} available={row.available} pending={row.pending} onLoadOlder={onLoadOlder} />;
            case 'empty_state':
              return <EmptyStateCard key={row.id} model={row.model} />;
            default:
              return null;
          }
        }

        return (
          <MessageCard
            key={row.id}
            row={row}
            density={density}
            actions={resolveActions(row)}
            onSelectMessage={onSelectMessage}
            onMessageAction={onMessageAction}
            onSelectSender={onSelectSender}
            onInspectProof={onInspectProof}
            onJumpToCause={onJumpToCause}
            onActivateQuote={onActivateQuote}
          />
        );
      })}

      {showJumpToLatest && onJumpToLatest ? (
        <button
          type="button"
          onClick={onJumpToLatest}
          style={{
            appearance: 'none',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.03)',
            color: '#dfe6ff',
            borderRadius: 12,
            padding: '10px 12px',
            cursor: 'pointer',
            justifySelf: 'end',
          }}
        >
          Jump to latest
        </button>
      ) : null}
    </div>
  );
});

export default ChatMessageFeed;
