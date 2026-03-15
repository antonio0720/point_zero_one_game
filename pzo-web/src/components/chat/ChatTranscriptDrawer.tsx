/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT TRANSCRIPT DRAWER
 * FILE: pzo-web/src/components/chat/ChatTranscriptDrawer.tsx
 * ============================================================================
 *
 * Purpose
 * -------
 * Render-only transcript drawer for the unified chat shell.
 *
 * This rewrite intentionally severs the drawer from the legacy compatibility
 * lane (`./chatTypes`) and makes the component consume only normalized UI-shell
 * models from `./uiTypes`.
 *
 * The drawer remains responsible for presentation-layer behavior only:
 * - dense transcript rendering
 * - viewport virtualization
 * - search input UX
 * - local filter interaction state seeded from a normalized shell model
 * - jump callbacks back into the parent shell
 * - rich, legible rendering of proof / lock / pressure / tick / shield /
 *   cascade metadata already prepared by the upstream adapter
 *
 * The drawer does NOT own:
 * - transcript truth
 * - socket state
 * - moderation law
 * - learning updates
 * - NPC cadence
 * - battle, pressure, shield, or zero-engine authority
 *
 * Architectural posture
 * ---------------------
 * End-state shell contract:
 * - `uiTypes.ts` defines the drawer surface model and callback bundle
 * - `useUnifiedChat.ts` or a dedicated adapter hands the drawer already-
 *   normalized rows, filter seeds, metrics, and result previews
 * - this component stays render-first and interaction-light
 *
 * Performance posture
 * -------------------
 * - variable-height virtual window driven by estimated row heights
 * - binary-search visible start index lookup
 * - overscan for aggressive chat flushes
 * - controlled body-scroll locking while open
 * - keyboard affordances for search, home/end navigation, and close
 *
 * Design doctrine
 * ---------------
 * - inline style system matching the current chat shell
 * - no Tailwind
 * - mobile-first and drawer-safe
 * - strong metadata legibility for proof, pressure, tick, shield, cascade, bot
 * - future-safe for extraction into the canonical `components/chat` shell
 * ============================================================================
 */

import React, {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ChatRoomHeader, type ChatRoomConnectionState } from './ChatRoomHeader';
import type {
  ChatUiAccent,
  ChatUiChip,
  ChatUiDrawerFilter,
  ChatUiMetric,
  ChatUiTone,
  ChatUiTranscriptDetailCard,
  ChatUiTranscriptDrawerCallbacks,
  ChatUiTranscriptDrawerSurfaceModel,
  ChatUiTranscriptRowViewModel,
} from './uiTypes';

const T = {
  void: '#030308',
  card: '#0C0C1E',
  cardHi: '#131328',
  cardEl: '#191934',
  border: 'rgba(255,255,255,0.08)',
  borderM: 'rgba(255,255,255,0.16)',
  borderS: 'rgba(255,255,255,0.05)',
  text: '#F2F2FF',
  textSub: '#9090B4',
  textMut: '#505074',
  green: '#22DD88',
  red: '#FF4D4D',
  orange: '#FF8C00',
  yellow: '#FFD700',
  indigo: '#818CF8',
  teal: '#22D3EE',
  purple: '#A855F7',
  rose: '#FB7185',
  silver: '#C6CAD6',
  obsidian: '#0B0B14',
  mono: "'IBM Plex Mono', 'JetBrains Mono', monospace",
  display: "'Syne', 'Outfit', system-ui, sans-serif",
  shadow: '0 14px 34px rgba(0,0,0,0.34)',
} as const;

const DEFAULT_ITEM_ESTIMATE = 118;
const OVERSCAN_ROWS = 10;
const QUICK_RESULT_LIMIT = 6;
const PLAYER_CHANNELS = ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'] as const;

type CanonicalChannelId = (typeof PLAYER_CHANNELS)[number];
type TranscriptScope = string;

type NormalizedFilterToggle = {
  id: string;
  label: string;
  active: boolean;
  accent?: ChatUiAccent;
  tone?: ChatUiTone;
};

type IndexedTranscriptRow = {
  row: ChatUiTranscriptRowViewModel;
  searchBlob: string;
  channelScope: string;
  kindScope: string;
  estimatedHeight: number;
};

type DrawerMetricPack = {
  visible: number;
  total: number;
  proof: number;
  locked: number;
  player: number;
  system: number;
  detailed: number;
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function fmtCompactCount(value: number | undefined): string {
  const safe = Number.isFinite(value) ? Math.max(0, Number(value)) : 0;
  if (safe >= 1_000_000) return `${(safe / 1_000_000).toFixed(1)}M`;
  if (safe >= 1_000) return `${(safe / 1_000).toFixed(1)}K`;
  return `${Math.floor(safe)}`;
}

function accentHex(accent: ChatUiAccent | undefined, fallback = T.textSub): string {
  switch (accent) {
    case 'emerald':
      return T.green;
    case 'amber':
    case 'gold':
      return T.yellow;
    case 'red':
    case 'rose':
      return accent === 'rose' ? T.rose : T.red;
    case 'violet':
      return T.purple;
    case 'cyan':
      return T.teal;
    case 'indigo':
      return T.indigo;
    case 'silver':
      return T.silver;
    case 'obsidian':
      return T.obsidian;
    case 'slate':
      return T.textSub;
    default:
      return fallback;
  }
}

function toneAccent(tone: ChatUiTone | undefined, fallback = T.textSub): string {
  switch (tone) {
    case 'positive':
      return T.green;
    case 'supportive':
      return T.teal;
    case 'warning':
      return T.orange;
    case 'danger':
    case 'hostile':
      return T.red;
    case 'cinematic':
      return T.purple;
    case 'ghost':
      return T.textMut;
    case 'calm':
      return T.indigo;
    default:
      return fallback;
  }
}

function initials(label: string | undefined): string {
  return (label ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
}

function canonicalChannel(value: string | undefined): CanonicalChannelId {
  if (value === 'SYNDICATE' || value === 'DEAL_ROOM') return value;
  return 'GLOBAL';
}

function buildScopeLabelMap(filters: readonly ChatUiDrawerFilter[] | undefined): Record<string, ChatUiDrawerFilter> {
  const map: Record<string, ChatUiDrawerFilter> = {};
  for (const filter of filters ?? []) {
    map[filter.id] = filter;
  }
  return map;
}

function metricChipStyle(accent: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    minHeight: 28,
    padding: '0 10px',
    borderRadius: 999,
    border: `1px solid ${accent}28`,
    background: `${accent}10`,
    whiteSpace: 'nowrap',
  };
}

function interactiveButtonStyle(active: boolean, accent: string): CSSProperties {
  return {
    minHeight: 32,
    padding: '0 10px',
    borderRadius: 10,
    border: `1px solid ${active ? `${accent}35` : 'rgba(255,255,255,0.08)'}`,
    background: active ? `${accent}16` : 'rgba(255,255,255,0.02)',
    color: active ? accent : T.textSub,
    cursor: 'pointer',
    fontFamily: T.mono,
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    transition:
      'transform 120ms ease, background 120ms ease, border-color 120ms ease, color 120ms ease',
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  };
}

function chipStyle(accent: string, subtle = false): CSSProperties {
  return {
    fontFamily: T.mono,
    fontSize: 8,
    letterSpacing: '0.08em',
    color: subtle ? T.textSub : accent,
    textTransform: 'uppercase',
    background: subtle ? 'rgba(255,255,255,0.04)' : `${accent}10`,
    border: `1px solid ${subtle ? 'rgba(255,255,255,0.09)' : `${accent}24`}`,
    borderRadius: 999,
    padding: '3px 7px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  };
}

function detailCardAccent(card: ChatUiTranscriptDetailCard | undefined): string {
  return accentHex(card?.accent, toneAccent(card?.tone, T.textSub));
}

function rowAccent(row: ChatUiTranscriptRowViewModel): string {
  return accentHex(row.accent, row.role === 'player' ? T.indigo : toneAccent(row.tone, T.textSub));
}

function rowChannelScope(row: ChatUiTranscriptRowViewModel): string {
  return asString(row.channelId, 'GLOBAL').toUpperCase();
}

function rowKindScope(row: ChatUiTranscriptRowViewModel): string {
  return normalizeText(row.kindId || row.kindLabel || 'unknown').toUpperCase() || 'UNKNOWN';
}

function rowSearchBlob(row: ChatUiTranscriptRowViewModel): string {
  const chips = (row.chips ?? []).map(chip => [chip.label, chip.shortLabel, chip.icon].filter(Boolean).join(' ')).join(' ');
  const cards = (row.detailCards ?? [])
    .map(card => [card.label, card.title, card.subtitle].filter(Boolean).join(' '))
    .join(' ');

  return normalizeText(
    [
      row.id,
      row.messageId,
      row.channelId,
      row.channelLabel,
      row.kindId,
      row.kindLabel,
      row.actorLabel,
      row.actorRankLabel,
      row.actorOriginLabel,
      row.body,
      row.emoji,
      row.proofHashLabel,
      row.proofSummary,
      row.pressureTierLabel,
      row.tickTierLabel,
      row.runOutcomeLabel,
      row.searchBlob,
      chips,
      cards,
    ]
      .filter(Boolean)
      .join(' '),
  );
}

function estimateRowHeight(row: ChatUiTranscriptRowViewModel): number {
  const base = row.role === 'player' ? 104 : 132;
  const bodyExtra = Math.ceil(Math.max(0, (row.body?.length ?? 0) - 90) / 60) * 16;
  const chipsExtra = Math.ceil((row.chips?.length ?? 0) / 3) * 24;
  const cardsExtra = (row.detailCards?.length ?? 0) * 72;
  const proofExtra = row.proofHashLabel || row.proofSummary ? 12 : 0;
  const selectedExtra = row.selected ? 8 : 0;
  return Math.max(88, Math.min(440, base + bodyExtra + chipsExtra + cardsExtra + proofExtra + selectedExtra));
}

function buildPrefixSums(values: readonly number[]): number[] {
  const prefix = new Array(values.length + 1).fill(0);
  for (let index = 0; index < values.length; index += 1) {
    prefix[index + 1] = prefix[index] + values[index];
  }
  return prefix;
}

function lowerBound(prefix: readonly number[], target: number): number {
  let left = 0;
  let right = prefix.length - 1;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (prefix[mid] <= target) left = mid + 1;
    else right = mid;
  }

  return Math.max(0, left - 1);
}

function computeDrawerMetricPack(rows: readonly ChatUiTranscriptRowViewModel[], visibleRows: readonly ChatUiTranscriptRowViewModel[]): DrawerMetricPack {
  const total = rows.length;
  const visible = visibleRows.length;
  const proof = rows.filter(row => Boolean(row.proofHashLabel || row.proofSummary)).length;
  const locked = rows.filter(row => row.locked).length;
  const player = rows.filter(row => row.role === 'player').length;
  const system = rows.filter(row => row.role !== 'player').length;
  const detailed = rows.filter(row => (row.detailCards?.length ?? 0) > 0).length;
  return { visible, total, proof, locked, player, system, detailed };
}

function filterAccent(filter: ChatUiDrawerFilter): string {
  return accentHex(filter.accent, toneAccent(filter.tone, T.indigo));
}

function highlightQuery(text: string | undefined, query: string): ReactNode {
  const content = text ?? '';
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return content;

  const safeNeedle = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = new RegExp(`(${safeNeedle})`, 'ig');
  const parts = content.split(matcher);

  if (parts.length <= 1) return content;

  return parts.map((part, index) => {
    if (part.toLowerCase() === normalizedQuery.toLowerCase()) {
      return (
        <mark
          key={`${part}-${index}`}
          style={{
            background: 'rgba(255,215,0,0.18)',
            color: T.text,
            borderRadius: 4,
            padding: '0 2px',
          }}
        >
          {part}
        </mark>
      );
    }

    return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
  });
}

function buildFilterToggles(model: ChatUiTranscriptDrawerSurfaceModel): NormalizedFilterToggle[] {
  return [
    {
      id: 'proof_only',
      label: 'Proof only',
      active: asBoolean(model.filterState.proofOnly),
      accent: 'gold',
      tone: 'warning',
    },
    {
      id: 'locked_only',
      label: 'Locked only',
      active: asBoolean(model.filterState.lockedOnly),
      accent: 'gold',
      tone: 'warning',
    },
    {
      id: 'newest_first',
      label: asBoolean(model.filterState.newestFirst) ? 'Newest' : 'Chrono',
      active: asBoolean(model.filterState.newestFirst),
      accent: 'indigo',
      tone: 'calm',
    },
  ];
}

function selectedMessageId(model: ChatUiTranscriptDrawerSurfaceModel): string | null {
  return asString(
    model.drawer.selected?.messageId
      ?? model.rows.find(row => row.selected)?.messageId
      ?? model.rows.find(row => row.selected)?.id,
    '',
  ) || null;
}

function channelFilterFallback(model: ChatUiTranscriptDrawerSurfaceModel): ChatUiDrawerFilter[] {
  if ((model.filterState.channelFilters?.length ?? 0) > 0) return model.filterState.channelFilters;

  const present = new Set(model.rows.map(row => rowChannelScope(row)));
  const ordered = ['ALL', ...PLAYER_CHANNELS];

  return ordered
    .filter(scope => scope === 'ALL' || present.has(scope))
    .map(scope => ({
      id: scope,
      label: scope === 'ALL' ? 'All channels' : scope.replace('_', ' '),
      active: scope === asString(model.filterState.channelScope, model.header.activeChannelId ?? 'GLOBAL'),
      count: scope === 'ALL' ? model.rows.length : model.rows.filter(row => rowChannelScope(row) === scope).length,
      accent: scope === 'GLOBAL' ? 'indigo' : scope === 'SYNDICATE' ? 'cyan' : scope === 'DEAL_ROOM' ? 'gold' : 'silver',
      tone: scope === 'ALL' ? 'neutral' : 'calm',
    }));
}

function kindFilterFallback(model: ChatUiTranscriptDrawerSurfaceModel): ChatUiDrawerFilter[] {
  if ((model.filterState.kindFilters?.length ?? 0) > 0) return model.filterState.kindFilters;

  const counts = new Map<string, number>();
  for (const row of model.rows) {
    const scope = rowKindScope(row);
    counts.set(scope, (counts.get(scope) ?? 0) + 1);
  }

  const keys = ['ALL', ...Array.from(counts.keys()).sort((a, b) => a.localeCompare(b))];

  return keys.map(scope => ({
    id: scope,
    label: scope === 'ALL' ? 'All kinds' : scope.replaceAll('_', ' '),
    active: scope === asString(model.filterState.kindScope, 'ALL'),
    count: scope === 'ALL' ? model.rows.length : counts.get(scope) ?? 0,
    accent:
      scope === 'PLAYER'
        ? 'emerald'
        : scope === 'BOT_ATTACK' || scope === 'BOT_TAUNT'
          ? 'red'
          : scope === 'SHIELD_EVENT'
            ? 'cyan'
            : scope === 'DEAL_RECAP'
              ? 'gold'
              : scope === 'CASCADE_ALERT'
                ? 'violet'
                : 'silver',
    tone:
      scope === 'BOT_ATTACK'
        ? 'hostile'
        : scope === 'BOT_TAUNT'
          ? 'danger'
          : scope === 'PLAYER'
            ? 'positive'
            : scope === 'DEAL_RECAP'
              ? 'warning'
              : 'neutral',
  }));
}

function renderSummaryMetric(metric: ChatUiMetric): ReactNode {
  const accent = accentHex(metric.accent, toneAccent(metric.tone, T.textSub));

  return (
    <div key={metric.id} style={metricChipStyle(accent)}>
      <span
        style={{
          fontFamily: T.mono,
          fontSize: 8,
          letterSpacing: '0.10em',
          color: accent,
          textTransform: 'uppercase',
          fontWeight: 800,
        }}
      >
        {metric.label}
      </span>
      <span
        style={{
          fontFamily: T.mono,
          fontSize: 10,
          color: T.text,
          fontWeight: 700,
        }}
      >
        {metric.value}
      </span>
    </div>
  );
}

const TranscriptDetailCards = memo(function TranscriptDetailCards({
  cards,
}: {
  cards: readonly ChatUiTranscriptDetailCard[];
}) {
  if (cards.length === 0) return null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 6,
        marginTop: 8,
      }}
    >
      {cards.map(card => {
        const accent = detailCardAccent(card);

        return (
          <div
            key={card.id}
            style={{
              borderRadius: 10,
              border: `1px solid ${T.border}`,
              background: 'rgba(255,255,255,0.03)',
              padding: '8px 9px',
            }}
          >
            <div
              style={{
                fontFamily: T.mono,
                fontSize: 8,
                letterSpacing: '0.10em',
                color: accent,
                textTransform: 'uppercase',
                fontWeight: 800,
                marginBottom: 5,
              }}
            >
              {card.label}
            </div>
            <div style={{ fontFamily: T.display, fontSize: 11, color: T.text }}>
              {card.title}
            </div>
            {card.subtitle ? (
              <div style={{ fontFamily: T.mono, fontSize: 8, color: T.textMut, marginTop: 3 }}>
                {card.subtitle}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
});

const TranscriptChips = memo(function TranscriptChips({
  row,
}: {
  row: ChatUiTranscriptRowViewModel;
}) {
  const accent = rowAccent(row);
  const chips: ChatUiChip[] = [...(row.chips ?? [])];

  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      {row.kindLabel || row.kindId ? (
        <span style={chipStyle(accent)}>{row.kindLabel ?? row.kindId}</span>
      ) : null}

      {row.pressureTierLabel ? (
        <span style={chipStyle(T.orange)}>{row.pressureTierLabel}</span>
      ) : null}

      {row.tickTierLabel ? (
        <span style={chipStyle(T.indigo)}>{row.tickTierLabel}</span>
      ) : null}

      {row.runOutcomeLabel ? (
        <span style={chipStyle(T.teal)}>{row.runOutcomeLabel}</span>
      ) : null}

      {row.locked ? (
        <span style={chipStyle(T.yellow)}>🔒 Locked</span>
      ) : null}

      {row.proofHashLabel ? (
        <span style={chipStyle(T.yellow)}>{row.proofHashLabel}</span>
      ) : null}

      {chips.map(chip => {
        const chipAccent = accentHex(chip.accent, toneAccent(chip.tone, T.textSub));
        return (
          <span key={chip.id} style={chipStyle(chipAccent, !chip.accent && !chip.tone)}>
            {chip.icon ? <span>{chip.icon}</span> : null}
            <span>{chip.shortLabel ?? chip.label}</span>
          </span>
        );
      })}
    </div>
  );
});

const TranscriptSystemCard = memo(function TranscriptSystemCard({
  row,
  selected,
  onJump,
  query,
}: {
  row: ChatUiTranscriptRowViewModel;
  selected: boolean;
  onJump?: (messageId: string) => void;
  query: string;
}) {
  const accent = rowAccent(row);
  const messageId = row.messageId || row.id;

  return (
    <button
      type="button"
      onClick={() => onJump?.(messageId)}
      style={{
        width: '100%',
        textAlign: 'left',
        display: 'flex',
        gap: 12,
        padding: '12px 12px 12px 10px',
        borderRadius: 12,
        border: `1px solid ${selected ? `${accent}50` : `${accent}22`}`,
        background: selected
          ? `${accent}18`
          : 'linear-gradient(180deg, rgba(25,25,52,0.96) 0%, rgba(12,12,30,0.96) 100%)',
        borderLeft: `3px solid ${accent}`,
        cursor: onJump ? 'pointer' : 'default',
        transition:
          'transform 120ms ease, border-color 120ms ease, background 120ms ease, box-shadow 120ms ease',
        boxShadow: selected ? `0 0 0 1px ${accent}18, 0 12px 26px rgba(0,0,0,0.30)` : 'none',
      }}
    >
      <div
        style={{
          width: 24,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          fontSize: 15,
          lineHeight: 1.4,
          paddingTop: 1,
        }}
      >
        {row.emoji ?? '🛰️'}
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontFamily: T.mono,
              fontSize: 8,
              letterSpacing: '0.10em',
              color: accent,
              textTransform: 'uppercase',
              fontWeight: 800,
            }}
          >
            {row.channelLabel ?? row.channelId ?? 'CHANNEL'}
          </span>

          <span
            style={{
              fontFamily: T.mono,
              fontSize: 8,
              letterSpacing: '0.10em',
              color: T.textMut,
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            {row.kindLabel ?? row.kindId ?? 'SYSTEM EVENT'}
          </span>

          {(row.timestampLabel || row.relativeTimestampLabel) ? (
            <span
              style={{
                fontFamily: T.mono,
                fontSize: 8,
                color: T.textMut,
              }}
            >
              {[row.timestampLabel, row.relativeTimestampLabel].filter(Boolean).join(' • ')}
            </span>
          ) : null}
        </div>

        <div
          style={{
            fontFamily: T.display,
            fontSize: 12,
            fontWeight: 700,
            lineHeight: 1.55,
            color: T.text,
            marginBottom: 8,
            wordBreak: 'break-word',
          }}
        >
          {highlightQuery(row.body, query)}
        </div>

        <TranscriptChips row={row} />
        <TranscriptDetailCards cards={row.detailCards ?? []} />
      </div>
    </button>
  );
});

const TranscriptPlayerCard = memo(function TranscriptPlayerCard({
  row,
  selected,
  onJump,
  query,
}: {
  row: ChatUiTranscriptRowViewModel;
  selected: boolean;
  onJump?: (messageId: string) => void;
  query: string;
}) {
  const messageId = row.messageId || row.id;
  const isLocal = normalizeText(row.actorOriginLabel).includes('local');
  const accent = rowAccent(row);
  const rankColor = accentHex(row.accent, row.actorRankLabel ? T.yellow : T.textSub);

  return (
    <button
      type="button"
      onClick={() => onJump?.(messageId)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '11px 10px',
        borderRadius: 12,
        textAlign: 'left',
        border: `1px solid ${selected ? `${accent}40` : T.border}`,
        background: selected
          ? `${accent}14`
          : 'linear-gradient(180deg, rgba(12,12,30,0.96) 0%, rgba(25,25,52,0.96) 100%)',
        cursor: onJump ? 'pointer' : 'default',
        boxShadow: selected ? `0 0 0 1px ${accent}14, 0 12px 26px rgba(0,0,0,0.28)` : 'none',
        transition:
          'transform 120ms ease, border-color 120ms ease, background 120ms ease, box-shadow 120ms ease',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: isLocal ? 'rgba(129,140,248,0.18)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${isLocal ? 'rgba(129,140,248,0.30)' : T.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: T.mono,
          fontSize: 9,
          fontWeight: 800,
          color: isLocal ? T.indigo : T.textSub,
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        {row.actorInitials || initials(row.actorLabel)}
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
            marginBottom: 5,
          }}
        >
          <span
            style={{
              fontFamily: T.mono,
              fontSize: 10,
              fontWeight: 800,
              color: isLocal ? T.green : T.text,
            }}
          >
            {row.actorLabel ?? 'Player'}
          </span>

          {row.actorRankLabel ? (
            <span
              style={{
                fontFamily: T.mono,
                fontSize: 8,
                color: rankColor,
                fontWeight: 700,
              }}
            >
              {row.actorRankLabel}
            </span>
          ) : null}

          {row.channelLabel || row.channelId ? (
            <span style={{ fontFamily: T.mono, fontSize: 8, color: T.textMut }}>
              {row.channelLabel ?? row.channelId}
            </span>
          ) : null}

          {(row.timestampLabel || row.relativeTimestampLabel) ? (
            <span style={{ fontFamily: T.mono, fontSize: 8, color: T.textMut }}>
              {[row.timestampLabel, row.relativeTimestampLabel].filter(Boolean).join(' • ')}
            </span>
          ) : null}
        </div>

        <div
          style={{
            fontFamily: T.display,
            fontSize: 12,
            lineHeight: 1.55,
            color: T.text,
            wordBreak: 'break-word',
            marginBottom: 8,
          }}
        >
          {highlightQuery(row.body, query)}
        </div>

        <TranscriptChips row={row} />
        <TranscriptDetailCards cards={row.detailCards ?? []} />
      </div>
    </button>
  );
});

const TranscriptRow = memo(function TranscriptRow({
  row,
  selected,
  onJump,
  query,
}: {
  row: ChatUiTranscriptRowViewModel;
  selected: boolean;
  onJump?: (messageId: string) => void;
  query: string;
}) {
  if (row.role === 'player') {
    return <TranscriptPlayerCard row={row} selected={selected} onJump={onJump} query={query} />;
  }

  return <TranscriptSystemCard row={row} selected={selected} onJump={onJump} query={query} />;
});

const TranscriptQuickResults = memo(function TranscriptQuickResults({
  query,
  results,
  onJump,
}: {
  query: string;
  results: readonly ChatUiTranscriptDrawerSurfaceModel['drawer']['results'];
  onJump?: (messageId: string) => void;
}) {
  if (!query.trim() || results.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '10px 12px',
        borderRadius: 12,
        border: `1px solid ${T.border}`,
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: T.mono,
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            color: T.indigo,
          }}
        >
          Quick jump results
        </span>
        <span style={{ fontFamily: T.mono, fontSize: 9, color: T.textMut }}>
          {fmtCompactCount(results.length)} matches
        </span>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        {results.slice(0, QUICK_RESULT_LIMIT).map(result => (
          <button
            key={result.id}
            type="button"
            onClick={() => onJump?.(result.messageId)}
            style={{
              width: '100%',
              textAlign: 'left',
              borderRadius: 10,
              border: `1px solid ${T.border}`,
              background: 'rgba(255,255,255,0.025)',
              padding: '8px 9px',
              cursor: 'pointer',
              display: 'grid',
              gap: 4,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {result.channelLabel ? (
                <span style={{ fontFamily: T.mono, fontSize: 8, color: T.indigo }}>
                  {result.channelLabel}
                </span>
              ) : null}
              {result.authorLabel ? (
                <span style={{ fontFamily: T.mono, fontSize: 8, color: T.textSub }}>
                  {result.authorLabel}
                </span>
              ) : null}
              {result.timestampLabel ? (
                <span style={{ fontFamily: T.mono, fontSize: 8, color: T.textMut }}>
                  {result.timestampLabel}
                </span>
              ) : null}
            </div>
            <div style={{ fontFamily: T.display, fontSize: 11, lineHeight: 1.45, color: T.text }}>
              {highlightQuery(result.preview, query)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
});

const TranscriptSelectionInspector = memo(function TranscriptSelectionInspector({
  model,
}: {
  model: ChatUiTranscriptDrawerSurfaceModel;
}) {
  const selected = model.drawer.selected;
  if (!selected) return null;

  return (
    <div
      style={{
        display: 'grid',
        gap: 6,
        padding: '10px 12px',
        borderRadius: 12,
        border: `1px solid ${T.border}`,
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <div
        style={{
          fontFamily: T.mono,
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: T.teal,
        }}
      >
        Selected moment
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {selected.authorLabel ? (
          <span style={{ fontFamily: T.mono, fontSize: 8, color: T.textSub }}>
            {selected.authorLabel}
          </span>
        ) : null}
        {selected.timestampLabel ? (
          <span style={{ fontFamily: T.mono, fontSize: 8, color: T.textMut }}>
            {selected.timestampLabel}
          </span>
        ) : null}
      </div>

      {selected.text ? (
        <div style={{ fontFamily: T.display, fontSize: 11, lineHeight: 1.5, color: T.text }}>
          {selected.text}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {selected.proofSummary ? <span style={chipStyle(T.yellow)}>{selected.proofSummary}</span> : null}
        {selected.threatSummary ? <span style={chipStyle(T.red)}>{selected.threatSummary}</span> : null}
        {selected.integritySummary ? <span style={chipStyle(T.teal)}>{selected.integritySummary}</span> : null}
      </div>
    </div>
  );
});

export const ChatTranscriptDrawer = memo(function ChatTranscriptDrawer({
  model,
  callbacks,
}: {
  model: ChatUiTranscriptDrawerSurfaceModel;
  callbacks: ChatUiTranscriptDrawerCallbacks;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const [internalSearch, setInternalSearch] = useState(model.filterState.query ?? model.drawer.query ?? '');
  const [channelScope, setChannelScope] = useState<TranscriptScope>(
    model.filterState.channelScope ?? model.header.activeChannelId ?? 'GLOBAL',
  );
  const [kindScope, setKindScope] = useState<TranscriptScope>(model.filterState.kindScope ?? 'ALL');
  const [proofOnly, setProofOnly] = useState<boolean>(asBoolean(model.filterState.proofOnly));
  const [lockedOnly, setLockedOnly] = useState<boolean>(asBoolean(model.filterState.lockedOnly));
  const [newestFirst, setNewestFirst] = useState<boolean>(asBoolean(model.filterState.newestFirst));
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(640);

  const open = asBoolean(model.drawer.open);
  const effectiveSearch = model.filterState.query ?? model.drawer.query ?? internalSearch;
  const activeSelectedMessageId = selectedMessageId(model);

  const onClose = callbacks.onClose;
  const onJump = callbacks.onJumpToMessage;
  const onExport = callbacks.onRequestExport;
  const onJumpLatest = callbacks.onJumpLatest;

  const channelFilters = useMemo(() => channelFilterFallback(model), [model]);
  const kindFilters = useMemo(() => kindFilterFallback(model), [model]);
  const channelFilterMap = useMemo(() => buildScopeLabelMap(channelFilters), [channelFilters]);
  const kindFilterMap = useMemo(() => buildScopeLabelMap(kindFilters), [kindFilters]);
  const toggleFilters = useMemo(() => buildFilterToggles(model), [model]);

  const setSearch = useCallback(
    (value: string) => {
      if (model.filterState.query === undefined) {
        setInternalSearch(value);
      }
      callbacks.onSearchQueryChange?.(value);
    },
    [callbacks, model.filterState.query],
  );

  useEffect(() => {
    setChannelScope(model.filterState.channelScope ?? model.header.activeChannelId ?? 'GLOBAL');
  }, [model.filterState.channelScope, model.header.activeChannelId]);

  useEffect(() => {
    setKindScope(model.filterState.kindScope ?? 'ALL');
  }, [model.filterState.kindScope]);

  useEffect(() => {
    setProofOnly(asBoolean(model.filterState.proofOnly));
  }, [model.filterState.proofOnly]);

  useEffect(() => {
    setLockedOnly(asBoolean(model.filterState.lockedOnly));
  }, [model.filterState.lockedOnly]);

  useEffect(() => {
    setNewestFirst(asBoolean(model.filterState.newestFirst));
  }, [model.filterState.newestFirst]);

  useEffect(() => {
    if (model.filterState.query !== undefined || model.drawer.query !== undefined) {
      setInternalSearch(model.filterState.query ?? model.drawer.query ?? '');
    }
  }, [model.filterState.query, model.drawer.query]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }

      if (event.key === 'End') {
        event.preventDefault();
        const node = containerRef.current;
        if (!node) return;
        node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
        return;
      }

      if (event.key === 'Home') {
        event.preventDefault();
        const node = containerRef.current;
        if (!node) return;
        node.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  useLayoutEffect(() => {
    if (!open) return;
    const node = containerRef.current;
    if (!node) return;

    const syncViewport = () => {
      setViewportHeight(node.clientHeight);
      setScrollTop(node.scrollTop);
    };

    syncViewport();

    const onScroll = () => setScrollTop(node.scrollTop);
    node.addEventListener('scroll', onScroll, { passive: true });

    const observer = new ResizeObserver(syncViewport);
    observer.observe(node);

    return () => {
      node.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      searchRef.current?.focus();
      searchRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  const indexedRows = useMemo<IndexedTranscriptRow[]>(() => {
    return [...model.rows].map(row => ({
      row,
      searchBlob: rowSearchBlob(row),
      channelScope: rowChannelScope(row),
      kindScope: rowKindScope(row),
      estimatedHeight: estimateRowHeight(row),
    }));
  }, [model.rows]);

  const filteredRows = useMemo(() => {
    const search = normalizeText(effectiveSearch);

    const next = indexedRows.filter(({ row, searchBlob, channelScope: rowChannel, kindScope: rowKind }) => {
      if (channelScope !== 'ALL' && rowChannel !== channelScope) return false;
      if (kindScope !== 'ALL' && rowKind !== kindScope) return false;
      if (proofOnly && !row.proofHashLabel && !row.proofSummary) return false;
      if (lockedOnly && !row.locked) return false;
      if (search && !searchBlob.includes(search)) return false;
      return true;
    });

    next.sort((a, b) => {
      const left = a.row.timestamp ?? 0;
      const right = b.row.timestamp ?? 0;
      return newestFirst ? right - left : left - right;
    });

    return next;
  }, [indexedRows, effectiveSearch, channelScope, kindScope, proofOnly, lockedOnly, newestFirst]);

  const selectedIndex = useMemo(() => {
    if (!activeSelectedMessageId) return -1;
    return filteredRows.findIndex(entry => (entry.row.messageId || entry.row.id) === activeSelectedMessageId);
  }, [filteredRows, activeSelectedMessageId]);

  const heights = useMemo(() => filteredRows.map(entry => entry.estimatedHeight), [filteredRows]);
  const prefixSums = useMemo(() => buildPrefixSums(heights), [heights]);
  const totalVirtualHeight = prefixSums[prefixSums.length - 1] ?? 0;

  useEffect(() => {
    if (!open) return;
    if (selectedIndex < 0) return;
    const node = containerRef.current;
    if (!node) return;

    const targetTop = prefixSums[selectedIndex] ?? 0;
    const desired = Math.max(0, targetTop - node.clientHeight * 0.35);
    node.scrollTo({ top: desired, behavior: 'smooth' });
  }, [open, selectedIndex, prefixSums]);

  const visibleStart = Math.max(0, lowerBound(prefixSums, scrollTop) - OVERSCAN_ROWS);
  const cutoffBottom = scrollTop + viewportHeight;
  const visibleEnd = Math.min(
    filteredRows.length,
    lowerBound(prefixSums, cutoffBottom) + OVERSCAN_ROWS + 1,
  );

  const topSpacer = prefixSums[visibleStart] ?? 0;
  const bottomSpacer = Math.max(0, totalVirtualHeight - (prefixSums[visibleEnd] ?? totalVirtualHeight));
  const visibleSlice = filteredRows.slice(visibleStart, visibleEnd);

  const fallbackMetrics = useMemo(() => {
    const pack = computeDrawerMetricPack(
      model.rows,
      filteredRows.map(entry => entry.row),
    );

    const selectedChannelLabel = channelFilterMap[channelScope]?.label ?? channelScope;
    return [
      {
        id: 'visible',
        label: `Visible ${selectedChannelLabel !== 'All channels' ? selectedChannelLabel : ''}`.trim(),
        value: fmtCompactCount(pack.visible),
        rawValue: pack.visible,
        tone: 'calm' as const,
        accent: 'indigo' as const,
      },
      {
        id: 'proof',
        label: 'Proof',
        value: fmtCompactCount(pack.proof),
        rawValue: pack.proof,
        tone: 'warning' as const,
        accent: 'gold' as const,
      },
      {
        id: 'player',
        label: 'Player',
        value: fmtCompactCount(pack.player),
        rawValue: pack.player,
        tone: 'positive' as const,
        accent: 'emerald' as const,
      },
      {
        id: 'locked',
        label: 'Locked',
        value: fmtCompactCount(pack.locked),
        rawValue: pack.locked,
        tone: 'warning' as const,
        accent: 'gold' as const,
      },
      {
        id: 'detailed',
        label: 'Meta-rich',
        value: fmtCompactCount(pack.detailed),
        rawValue: pack.detailed,
        tone: 'supportive' as const,
        accent: 'cyan' as const,
      },
      {
        id: 'total',
        label: 'Total buffer',
        value: fmtCompactCount(pack.total),
        rawValue: pack.total,
        tone: 'neutral' as const,
        accent: 'silver' as const,
      },
    ] satisfies ChatUiMetric[];
  }, [model.rows, filteredRows, channelFilterMap, channelScope]);

  const summaryMetrics = model.drawer.summaryMetrics && model.drawer.summaryMetrics.length > 0
    ? model.drawer.summaryMetrics
    : fallbackMetrics;

  const quickResults = useMemo(() => {
    if (!effectiveSearch.trim()) return [];
    return model.drawer.results.filter(result =>
      filteredRows.some(entry => (entry.row.messageId || entry.row.id) === result.messageId),
    );
  }, [effectiveSearch, model.drawer.results, filteredRows]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Chat transcript drawer"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 75,
        display: 'flex',
        justifyContent: 'flex-end',
        background: 'rgba(0,0,0,0.58)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'relative',
          width: 'min(100vw, 580px)',
          height: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(180deg, rgba(3,3,8,0.995) 0%, rgba(12,12,30,0.99) 100%)',
          borderLeft: `1px solid ${T.borderM}`,
          boxShadow: '-20px 0 60px rgba(0,0,0,0.62)',
          overflow: 'hidden',
        }}
        onClick={event => event.stopPropagation()}
      >
        <ChatRoomHeader
          channel={canonicalChannel(channelScope === 'ALL' ? asString(model.header.activeChannelId, 'GLOBAL') : channelScope)}
          variant="drawer"
          connected={model.header.connected}
          connectionState={model.header.connectionState as ChatRoomConnectionState | undefined}
          roomTitle={model.header.roomTitle ?? model.drawer.title}
          roomSubtitle={
            model.header.roomSubtitle
            ?? model.drawer.subtitle
            ?? 'Searchable, proof-aware, filterable replay lane for the current frontend transcript window.'
          }
          modeName={model.header.modeName}
          onlineCount={model.header.onlineCount}
          activeMembers={model.header.activeMembers}
          typingCount={model.header.typingCount}
          totalUnread={model.header.totalUnread}
          transcriptLocked={asBoolean(model.header.transcriptLocked) || channelScope === 'DEAL_ROOM'}
          showTranscriptAction={false}
          showPinAction={false}
          showJumpLatestAction={true}
          showMinimizeAction={true}
          onJumpLatest={() => {
            if (onJumpLatest) {
              onJumpLatest();
              return;
            }

            const node = containerRef.current;
            if (!node) return;
            node.scrollTo({ top: newestFirst ? 0 : node.scrollHeight, behavior: 'smooth' });
          }}
          onMinimize={onClose}
          rightSlot={
            (model.drawer.canExport || model.drawer.exportReady || onExport) ? (
              <button
                type="button"
                onClick={() => onExport?.()}
                style={{
                  minHeight: 34,
                  padding: '0 11px',
                  borderRadius: 10,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  border: `1px solid rgba(255,255,255,0.08)`,
                  background: 'rgba(255,255,255,0.03)',
                  color: T.textSub,
                  cursor: onExport ? 'pointer' : 'not-allowed',
                  fontFamily: T.mono,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  opacity: onExport ? 1 : 0.6,
                }}
                title="Request transcript export"
                disabled={!onExport}
              >
                ⤴︎ Export
              </button>
            ) : null
          }
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: '12px 14px',
            borderBottom: `1px solid ${T.border}`,
            background: 'rgba(19,19,40,0.55)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <div style={{ position: 'relative', minWidth: 0 }}>
              <input
                ref={searchRef}
                value={effectiveSearch}
                onChange={event => setSearch(event.target.value)}
                placeholder={model.drawer.canSearch === false ? 'Transcript search disabled' : 'Search body, sender, proof hash, shield layer, cascade id, rescue markers...'}
                spellCheck={false}
                disabled={model.drawer.canSearch === false}
                style={{
                  width: '100%',
                  minHeight: 42,
                  padding: '0 42px 0 14px',
                  borderRadius: 12,
                  border: `1px solid ${T.borderM}`,
                  background: 'rgba(12,12,30,0.94)',
                  color: T.text,
                  outline: 'none',
                  fontFamily: T.display,
                  fontSize: 12,
                  opacity: model.drawer.canSearch === false ? 0.65 : 1,
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: T.textMut,
                  fontSize: 14,
                }}
              >
                ⌕
              </span>
            </div>

            <button
              type="button"
              onClick={() => setNewestFirst(current => !current)}
              style={interactiveButtonStyle(newestFirst, T.indigo)}
              title="Toggle newest-first ordering"
            >
              {newestFirst ? '↓' : '↑'} {newestFirst ? 'Newest' : 'Chrono'}
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {channelFilters.map(filter => {
              const active = channelScope === filter.id;
              const accent = filterAccent(filter);
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => {
                    setChannelScope(filter.id);
                    callbacks.onSelectChannelScope?.(filter.id);
                  }}
                  style={interactiveButtonStyle(active, accent)}
                >
                  <span>{filter.label}</span>
                  {typeof filter.count === 'number' ? <span>{fmtCompactCount(filter.count)}</span> : null}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {kindFilters.map(filter => {
              const active = kindScope === filter.id;
              const accent = filterAccent(filter);
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => {
                    setKindScope(filter.id);
                    callbacks.onSelectKindScope?.(filter.id);
                  }}
                  style={interactiveButtonStyle(active, accent)}
                >
                  <span>{filter.label}</span>
                  {typeof filter.count === 'number' ? <span>{fmtCompactCount(filter.count)}</span> : null}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {toggleFilters.map(toggle => {
              const accent = accentHex(toggle.accent, toneAccent(toggle.tone, T.indigo));
              return (
                <button
                  key={toggle.id}
                  type="button"
                  onClick={() => {
                    if (toggle.id === 'proof_only') {
                      const next = !proofOnly;
                      setProofOnly(next);
                      callbacks.onToggleProofOnly?.(next);
                      return;
                    }

                    if (toggle.id === 'locked_only') {
                      const next = !lockedOnly;
                      setLockedOnly(next);
                      callbacks.onToggleLockedOnly?.(next);
                      return;
                    }

                    const next = !newestFirst;
                    setNewestFirst(next);
                    callbacks.onToggleNewestFirst?.(next);
                  }}
                  style={interactiveButtonStyle(toggle.active, accent)}
                >
                  <span>{toggle.id === 'proof_only' ? '🔒' : toggle.id === 'locked_only' ? '📜' : toggle.active ? '↓' : '↑'}</span>
                  <span>{toggle.label}</span>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {summaryMetrics.map(renderSummaryMetric)}
          </div>

          <TranscriptQuickResults query={effectiveSearch} results={quickResults} onJump={onJump} />
          <TranscriptSelectionInspector model={model} />
        </div>

        <div
          ref={containerRef}
          className="pzo-chat-transcript-scroll"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 14px 20px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.10) transparent',
          }}
        >
          {filteredRows.length === 0 ? (
            <div
              style={{
                minHeight: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 12,
                color: T.textMut,
                textAlign: 'center',
                padding: '20px',
              }}
            >
              <span style={{ fontSize: 28 }}>∅</span>
              <div
                style={{
                  fontFamily: T.mono,
                  fontSize: 10,
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                }}
              >
                {model.drawer.emptyState?.title ?? 'No transcript entries match this filter stack'}
              </div>
              <div
                style={{
                  fontFamily: T.display,
                  fontSize: 12,
                  lineHeight: 1.5,
                  maxWidth: 340,
                  color: T.textSub,
                }}
              >
                {model.drawer.emptyState?.description
                  ?? 'Clear search terms, widen the channel scope, or remove proof / lock gating to bring transcript entries back into view.'}
              </div>
            </div>
          ) : (
            <div style={{ minHeight: '100%', position: 'relative', height: totalVirtualHeight || '100%' }}>
              {topSpacer > 0 ? <div style={{ height: topSpacer }} /> : null}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {visibleSlice.map(({ row }, localIndex) => {
                  const absoluteIndex = visibleStart + localIndex;
                  const messageId = row.messageId || row.id;
                  return (
                    <TranscriptRow
                      key={messageId}
                      row={row}
                      selected={absoluteIndex === selectedIndex || row.selected === true}
                      onJump={onJump}
                      query={effectiveSearch}
                    />
                  );
                })}
              </div>

              {bottomSpacer > 0 ? <div style={{ height: bottomSpacer }} /> : null}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            borderTop: `1px solid ${T.border}`,
            background: 'rgba(12,12,30,0.92)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
            <div
              style={{
                fontFamily: T.display,
                fontSize: 11,
                lineHeight: 1.45,
                color: T.textSub,
                minWidth: 0,
              }}
            >
              Transcript drawer stays render-only. Message truth, replay permanence, moderation, and learning updates remain outside this file.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontFamily: T.mono, fontSize: 8, color: T.textMut }}>
                visible slice {fmtCompactCount(visibleSlice.length)} / {fmtCompactCount(filteredRows.length)}
              </span>
              <span style={{ fontFamily: T.mono, fontSize: 8, color: T.textMut }}>
                virtual height {fmtCompactCount(totalVirtualHeight)}px
              </span>
              {activeSelectedMessageId ? (
                <span style={{ fontFamily: T.mono, fontSize: 8, color: T.textMut }}>
                  selected {activeSelectedMessageId}
                </span>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              minHeight: 36,
              padding: '0 12px',
              borderRadius: 10,
              border: `1px solid ${T.borderM}`,
              background: 'rgba(255,255,255,0.03)',
              color: T.textSub,
              cursor: 'pointer',
              fontFamily: T.mono,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
});

export default ChatTranscriptDrawer;
