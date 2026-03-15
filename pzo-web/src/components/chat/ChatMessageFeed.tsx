import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type UIEvent,
} from 'react';
import type {
  ChatUiDensity,
  ChatUiEmptyStateViewModel,
  ChatUiFeedRow,
  ChatUiMessageCardViewModel,
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
 * Render-only feed primitive for the thin chat shell.
 * This file consumes normalized rows only.
 * ============================================================================
 */

export type FeedFollowMode = 'AUTO' | 'LOCKED' | 'MANUAL';

export interface ChatMessageFeedProps extends MessageFeedCallbacks {
  model?: MessageFeedViewModel;
  rows?: readonly ChatUiFeedRow[];
  density?: ChatUiDensity;
  className?: string;
  style?: CSSProperties;
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
  shadow: '0 18px 56px rgba(0,0,0,0.34)',
  mono: "'IBM Plex Mono', 'JetBrains Mono', monospace",
  display: "'Syne', 'Outfit', system-ui, sans-serif",
});

function densityPack(density: ChatUiDensity | undefined) {
  switch (density) {
    case 'compact':
      return { pad: 10, rowGap: 8 };
    case 'expanded':
      return { pad: 18, rowGap: 12 };
    case 'cinematic':
      return { pad: 20, rowGap: 14 };
    case 'comfortable':
    default:
      return { pad: 14, rowGap: 10 };
  }
}

function estimateRowHeight(row: ChatUiFeedRow, density: ChatUiDensity | undefined): number {
  const base = density === 'compact' ? 66 : density === 'cinematic' ? 96 : 82;
  switch (row.kind) {
    case 'day_break':
      return 42;
    case 'unread_break':
      return 48;
    case 'scene_marker':
      return 62;
    case 'gap_marker':
      return 54;
    case 'typing_cluster':
      return 56;
    case 'load_older':
      return 56;
    case 'empty_state':
      return 180;
    default: {
      const card = row as ChatUiMessageCardViewModel;
      const bodyLength = card.body.primary.spans.map((span) => span.text).join('').length || 24;
      const bodyLines = Math.max(1, Math.ceil(bodyLength / (density === 'compact' ? 60 : 52)));
      const quoteBonus = card.body.quote ? 56 : 0;
      const attachmentBonus = (card.body.attachments?.length ?? 0) * 44;
      const secondaryBonus = (card.body.secondary?.length ?? 0) * 28;
      const reactionBonus = card.body.reactions?.length ? 28 : 0;
      const hintBonus = card.body.commandHints?.length ? 36 : 0;
      const metaBonus = card.displayHints.showMetaRail ? 98 : 34;
      const actionBonus = card.canJumpToCause || card.canInspectProof || card.canReply ? 34 : 0;
      return base + bodyLines * 20 + quoteBonus + attachmentBonus + secondaryBonus + reactionBonus + hintBonus + metaBonus + actionBonus;
    }
  }
}

function buildPrefix(rows: readonly ChatUiFeedRow[], density: ChatUiDensity | undefined, measured: Record<string, number>) {
  const prefix = new Array(rows.length + 1).fill(0);
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    prefix[index + 1] = prefix[index] + (measured[row.id] ?? estimateRowHeight(row, density));
  }
  return prefix;
}

function lowerBound(prefix: readonly number[], target: number) {
  let lo = 0;
  let hi = prefix.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (prefix[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return Math.max(0, lo - 1);
}

function EmptyStateCard({ model }: { model: ChatUiEmptyStateViewModel }) {
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {model.icon ? <div style={{ fontSize: 22 }}>{model.icon}</div> : null}
        <div style={{ fontFamily: TOKENS.display, fontSize: 16, fontWeight: 800 }}>{model.title}</div>
      </div>
      <div style={{ color: TOKENS.textSub, lineHeight: 1.65 }}>{model.body}</div>
      {model.hint ? <div style={{ color: TOKENS.textMute, fontSize: 12 }}>{model.hint}</div> : null}
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
      <div style={{ borderRadius: 999, border: `1px solid ${TOKENS.rose}`, background: TOKENS.roseSoft, color: '#FFD8DE', padding: '7px 12px', fontFamily: TOKENS.mono, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase' }}>
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

const LoadOlderRow = memo(function LoadOlderRow({ label, available, pending, onLoadOlder }: { label: string; available?: boolean; pending?: boolean; onLoadOlder?: () => void }) {
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

const MessageCard = memo(function MessageCard({
  model,
  actions,
  onSelectMessage,
  onMessageAction,
  onSelectSender,
  onInspectProof,
  onJumpToCause,
  onActivateQuote,
}: {
  model: ChatUiMessageCardViewModel;
  actions: readonly MessageCardActionViewModel[];
  onSelectMessage?: (messageId: string) => void;
  onMessageAction?: (actionId: string, messageId: string) => void;
  onSelectSender?: (senderId: string) => void;
  onInspectProof?: (messageId: string) => void;
  onJumpToCause?: (messageId: string) => void;
  onActivateQuote?: (messageId: string) => void;
}) {
  const bodyText = model.body.primary.spans.map((span) => span.text).join('');
  return (
    <div
      style={{
        display: 'grid',
        gap: 10,
        padding: 14,
        borderRadius: 16,
        border: `1px solid ${TOKENS.border}`,
        background: TOKENS.white04,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'start', gap: 10 }}>
        <button
          type="button"
          onClick={() => onSelectSender?.(String(model.author.id))}
          style={{
            appearance: 'none',
            width: 34,
            height: 34,
            borderRadius: 999,
            border: `1px solid ${TOKENS.border}`,
            background: TOKENS.white06,
            color: TOKENS.text,
            fontFamily: TOKENS.mono,
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          {model.author.avatar?.emoji ?? model.author.avatar?.initials ?? model.author.shortName ?? '??'}
        </button>
        <div style={{ minWidth: 0, flex: 1, display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => onSelectMessage?.(model.id)}
              style={{
                appearance: 'none',
                padding: 0,
                border: 0,
                background: 'transparent',
                color: TOKENS.text,
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {model.author.displayName}
            </button>
            {model.author.roleLabel ? <span style={{ color: TOKENS.textSub, fontSize: 12 }}>{model.author.roleLabel}</span> : null}
            <span style={{ color: TOKENS.textMute, fontFamily: TOKENS.mono, fontSize: 10, textTransform: 'uppercase' }}>{model.meta.timestamp.displayLabel}</span>
          </div>
          <div style={{ color: TOKENS.text, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{bodyText}</div>
          {model.body.quote ? (
            <button
              type="button"
              onClick={() => model.body.quote?.messageId && onActivateQuote?.(model.body.quote.messageId)}
              style={{
                appearance: 'none',
                padding: 10,
                borderRadius: 12,
                border: `1px solid ${TOKENS.border}`,
                background: TOKENS.white06,
                textAlign: 'left',
                color: TOKENS.textSub,
                cursor: model.body.quote.messageId ? 'pointer' : 'default',
              }}
            >
              {model.body.quote.text}
            </button>
          ) : null}
          {model.meta.chips?.length ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {model.meta.chips.map((chip) => (
                <span key={chip.id} style={{ borderRadius: 999, padding: '6px 9px', background: TOKENS.white06, border: `1px solid ${TOKENS.border}`, color: TOKENS.textSub, fontFamily: TOKENS.mono, fontSize: 10, textTransform: 'uppercase' }}>
                  {chip.label}
                </span>
              ))}
            </div>
          ) : null}
          {(actions.length > 0 || model.canInspectProof || model.canJumpToCause) ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  disabled={action.disabled}
                  onClick={() => onMessageAction?.(action.id, model.id)}
                  style={{
                    appearance: 'none',
                    borderRadius: 999,
                    padding: '7px 10px',
                    border: `1px solid ${TOKENS.border}`,
                    background: TOKENS.white06,
                    color: TOKENS.text,
                    cursor: action.disabled ? 'not-allowed' : 'pointer',
                    fontFamily: TOKENS.mono,
                    fontSize: 10,
                    textTransform: 'uppercase',
                    opacity: action.disabled ? 0.5 : 1,
                  }}
                >
                  {action.label}
                </button>
              ))}
              {model.canInspectProof ? (
                <button type="button" onClick={() => onInspectProof?.(model.id)} style={{ appearance: 'none', borderRadius: 999, padding: '7px 10px', border: `1px solid ${TOKENS.indigo}`, background: TOKENS.indigoSoft, color: TOKENS.text, cursor: 'pointer', fontFamily: TOKENS.mono, fontSize: 10, textTransform: 'uppercase' }}>Proof</button>
              ) : null}
              {model.canJumpToCause ? (
                <button type="button" onClick={() => onJumpToCause?.(model.id)} style={{ appearance: 'none', borderRadius: 999, padding: '7px 10px', border: `1px solid ${TOKENS.cyan}`, background: TOKENS.cyanSoft, color: TOKENS.text, cursor: 'pointer', fontFamily: TOKENS.mono, fontSize: 10, textTransform: 'uppercase' }}>Cause</button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
});

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
}: ChatMessageFeedProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [viewportHeight, setViewportHeight] = useState(420);
  const [scrollTop, setScrollTop] = useState(0);
  const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>({});
  const [userScrolledAway, setUserScrolledAway] = useState(false);

  const densityInfo = densityPack(density);
  const rawRows = useMemo(() => model?.flatRows ?? rows ?? [], [model, rows]);
  const effectiveRows = useMemo(
    () => (typeof maxRows === 'number' && rawRows.length > maxRows ? rawRows.slice(rawRows.length - maxRows) : rawRows),
    [rawRows, maxRows],
  );

  const prefix = useMemo(() => buildPrefix(effectiveRows, density, measuredHeights), [effectiveRows, density, measuredHeights]);
  const totalHeight = prefix[prefix.length - 1] ?? 0;

  const startIndex = useMemo(() => Math.max(0, lowerBound(prefix, scrollTop) - overscan), [prefix, scrollTop, overscan]);
  const endIndex = useMemo(() => Math.min(effectiveRows.length - 1, lowerBound(prefix, scrollTop + viewportHeight) + overscan), [effectiveRows.length, overscan, prefix, scrollTop, viewportHeight]);
  const visibleRows = useMemo(() => effectiveRows.slice(startIndex, endIndex + 1), [effectiveRows, startIndex, endIndex]);
  const topSpacer = prefix[startIndex] ?? 0;
  const bottomSpacer = Math.max(0, totalHeight - (prefix[endIndex + 1] ?? totalHeight));

  useEffect(() => {
    onVisibleRangeChange?.({ startIndex, endIndex, totalCount: effectiveRows.length });
  }, [startIndex, endIndex, effectiveRows.length, onVisibleRangeChange]);

  useLayoutEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const update = () => setViewportHeight(node.clientHeight || 420);
    update();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(node);
    return () => observer?.disconnect();
  }, []);

  useEffect(() => {
    if (followMode === 'MANUAL') return;
    if (userScrolledAway && followMode !== 'LOCKED') return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [effectiveRows.length, followMode, userScrolledAway]);

  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const node = event.currentTarget;
    const nextGap = node.scrollHeight - node.scrollTop - node.clientHeight;
    setScrollTop(node.scrollTop);
    setUserScrolledAway(nextGap > 72);
  }, []);

  const measureRow = useCallback((id: string, node: HTMLDivElement | null) => {
    if (!node) return;
    const nextHeight = Math.ceil(node.getBoundingClientRect().height);
    setMeasuredHeights((current) => (current[id] === nextHeight ? current : { ...current, [id]: nextHeight }));
  }, []);

  const jumpToLatest = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    setUserScrolledAway(false);
    onJumpToLatest?.();
  }, [onJumpToLatest]);

  const resolveCardActions = useCallback(
    (message: ChatUiMessageCardViewModel) => {
      if (typeof cardActions === 'function') return cardActions(message);
      return cardActions ?? [];
    },
    [cardActions],
  );

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 0,
        borderRadius: 20,
        border: `1px solid ${TOKENS.border}`,
        background: `linear-gradient(180deg, ${TOKENS.panel} 0%, ${TOKENS.surface} 100%)`,
        boxShadow: TOKENS.shadow,
        overflow: 'hidden',
        ...style,
      }}
    >
      <div ref={scrollerRef} onScroll={handleScroll} style={{ position: 'relative', height: '100%', overflowY: 'auto', padding: densityInfo.pad }}>
        <div style={{ height: topSpacer }} />
        <div style={{ display: 'grid', gap: densityInfo.rowGap }}>
          {visibleRows.length === 0 ? (
            <EmptyStateCard model={{ id: 'empty', kind: 'quiet_room', title: 'No feed rows available', body: 'The message feed is waiting for normalized rows from the UI adapter surface.', tone: 'neutral', accent: 'slate' }} />
          ) : visibleRows.map((row) => {
            switch (row.kind) {
              case 'day_break':
                return <div key={row.id} ref={(node) => measureRow(row.id, node)}><DividerRow label={row.label} /></div>;
              case 'unread_break':
                return <div key={row.id} ref={(node) => measureRow(row.id, node)}><UnreadBreak label={row.label} count={row.unreadCount} /></div>;
              case 'scene_marker':
                return <div key={row.id} ref={(node) => measureRow(row.id, node)}><SceneMarker label={row.label} subtitle={row.subtitle} /></div>;
              case 'gap_marker':
                return <div key={row.id} ref={(node) => measureRow(row.id, node)}><GapMarker label={row.label} hiddenCount={row.hiddenCount} onActivate={() => onActivateRow?.(row.id, row)} /></div>;
              case 'typing_cluster':
                return <div key={row.id} ref={(node) => measureRow(row.id, node)}><TypingCluster label={row.label} actorLabels={row.entities.map((entity) => entity.label)} /></div>;
              case 'load_older':
                return <div key={row.id} ref={(node) => measureRow(row.id, node)}><LoadOlderRow label={row.label} available={row.available} pending={row.pending} onLoadOlder={onLoadOlder} /></div>;
              case 'empty_state':
                return <div key={row.id} ref={(node) => measureRow(row.id, node)}><EmptyStateCard model={row.model} /></div>;
              default:
                return (
                  <div key={row.id} ref={(node) => measureRow(row.id, node)}>
                    <MessageCard
                      model={row}
                      actions={resolveCardActions(row)}
                      onSelectMessage={onSelectMessage}
                      onMessageAction={onMessageAction}
                      onSelectSender={onSelectSender}
                      onInspectProof={onInspectProof}
                      onJumpToCause={onJumpToCause}
                      onActivateQuote={onActivateQuote}
                    />
                  </div>
                );
            }
          })}
        </div>
        <div style={{ height: bottomSpacer }} />
        <div ref={bottomRef} />
      </div>

      {showJumpToLatest && userScrolledAway ? (
        <button
          type="button"
          onClick={jumpToLatest}
          style={{
            position: 'absolute',
            right: 14,
            bottom: 14,
            appearance: 'none',
            borderRadius: 999,
            border: `1px solid ${TOKENS.indigo}`,
            background: TOKENS.indigoSoft,
            color: '#E0E4FF',
            padding: '10px 14px',
            cursor: 'pointer',
            fontFamily: TOKENS.mono,
            fontSize: 10,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            boxShadow: '0 12px 24px rgba(0,0,0,0.28)',
          }}
        >
          Jump to latest
        </button>
      ) : null}
    </div>
  );
});

export default ChatMessageFeed;
