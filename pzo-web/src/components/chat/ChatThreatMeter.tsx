
/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT UI SHELL
 * FILE: pzo-web/src/components/chat/ChatThreatMeter.tsx
 * ============================================================================
 *
 * Purpose
 * -------
 * Render-only threat meter for the unified chat dock.
 *
 * This file is designed to visualize the chat-side pressure envelope around the
 * player without taking ownership of the runtime. It receives already-computed
 * values from the frontend chat engine and renders:
 *
 * - aggregate threat score
 * - hostility / pressure / crowd heat / confidence swing
 * - rescue readiness / suppression / volatility / audience shame
 * - trend and delta cards
 * - tactical recommendation rails
 * - mode-aware presets
 * - cinematic and compact display variants
 * - optional historical sparkline-like bars using props only
 *
 * Architectural Rule
 * ------------------
 * This belongs in:
 *   /pzo-web/src/components/chat
 *
 * It does not belong in:
 *   /pzo-web/src/engines/chat
 *
 * because the chat engine owns calculation, orchestration, event flow,
 * transcript-linked meaning, and learning logic. The component layer renders.
 *
 * Repo Fit
 * --------
 * The surrounding repo already contains props-first tactical readout panels such
 * as ThreatRadarPanel.tsx and other mode surfaces. This component follows the
 * same direction while raising the fidelity expected by the new unified chat
 * shell.
 * ============================================================================
 */

import React, { memo, useId, useMemo } from 'react';

export type ThreatMeterVariant =
  | 'compact'
  | 'standard'
  | 'detailed'
  | 'cinematic'
  | 'minimal'
  | 'inline';

export type ThreatTone =
  | 'neutral'
  | 'warning'
  | 'danger'
  | 'critical'
  | 'rescue'
  | 'legend'
  | 'shadow';

export type ThreatModeKey =
  | 'lobby'
  | 'battle'
  | 'empire'
  | 'league'
  | 'syndicate'
  | 'deal-room'
  | 'phantom'
  | 'predator'
  | 'global'
  | 'unknown';

export type ThreatRecommendationStance =
  | 'hold'
  | 'counter'
  | 'mute'
  | 'hide'
  | 'stabilize'
  | 'pivot'
  | 'rescue'
  | 'bait'
  | 'watch'
  | 'push';

export interface ThreatHistoryPoint {
  id: string;
  label?: string | null;
  value: number;
  tone?: ThreatTone;
}

export interface ThreatBreakdownSlice {
  id: string;
  label: string;
  value: number;
  max?: number;
  weight?: number | null;
  delta?: number | null;
  tone?: ThreatTone;
  detail?: string | null;
  emphasis?: boolean;
}

export interface ThreatTrendMetric {
  id: string;
  label: string;
  value: number;
  max?: number;
  delta?: number | null;
  display?: string | null;
  hint?: string | null;
  tone?: ThreatTone;
}

export interface ThreatAdviceItem {
  id: string;
  label: string;
  stance: ThreatRecommendationStance;
  confidence: number;
  detail?: string | null;
  isPrimary?: boolean;
  hotkey?: string | null;
  badge?: string | null;
}

export interface ThreatWitnessBand {
  id: string;
  label: string;
  count: number;
  hostilityPct?: number | null;
  embarrassmentPct?: number | null;
  pressurePct?: number | null;
  tone?: ThreatTone;
}

export interface ThreatMeterModel {
  threatPct: number;
  hostilityPct?: number | null;
  pressurePct?: number | null;
  disruptionPct?: number | null;
  confidencePct?: number | null;
  rescuePct?: number | null;
  crowdHeatPct?: number | null;
  embarrassmentPct?: number | null;
  volatilityPct?: number | null;
  suppressionPct?: number | null;
  exposurePct?: number | null;
  attachmentPct?: number | null;
  trustPct?: number | null;
  stageLabel?: string | null;
  mode?: ThreatModeKey;
  tone?: ThreatTone;
  threatLabel?: string | null;
  detail?: string | null;
  deltaPct?: number | null;
  witnessCount?: number | null;
  unreadCount?: number | null;
  activeChannels?: number | null;
  hostileActors?: number | null;
  helperActors?: number | null;
  shadowBacked?: boolean;
  liveOpsAmplified?: boolean;
  rescueEligible?: boolean;
  history?: ThreatHistoryPoint[];
  slices?: ThreatBreakdownSlice[];
  trendMetrics?: ThreatTrendMetric[];
  advice?: ThreatAdviceItem[];
  witnessBands?: ThreatWitnessBand[];
}

export interface ChatThreatMeterProps {
  model: ThreatMeterModel | null | undefined;
  variant?: ThreatMeterVariant;
  className?: string;
  style?: React.CSSProperties;
  showHeader?: boolean;
  showLabel?: boolean;
  showDelta?: boolean;
  showHistory?: boolean;
  showBreakdown?: boolean;
  showTrendGrid?: boolean;
  showAdvice?: boolean;
  showWitnessBands?: boolean;
  showFootnotes?: boolean;
  showCounts?: boolean;
  showSummaryRail?: boolean;
  maxHistoryPoints?: number;
  maxSlices?: number;
  maxAdvice?: number;
  maxWitnessBands?: number;
  onAdviceClick?: (item: ThreatAdviceItem, model: ThreatMeterModel) => void;
  onSliceClick?: (slice: ThreatBreakdownSlice, model: ThreatMeterModel) => void;
  onWitnessBandClick?: (band: ThreatWitnessBand, model: ThreatMeterModel) => void;
  emptyStateLabel?: string;
  ['data-testid']?: string;
}

type ToneTokens = {
  border: string;
  bg: string;
  bgSoft: string;
  text: string;
  textSoft: string;
  rail: string;
  fill: string;
  badge: string;
  glow: string;
  surface: string;
};

const TONE_TOKENS: Record<ThreatTone, ToneTokens> = {
  neutral: {
    border: 'border-slate-700/80',
    bg: 'bg-slate-950/95',
    bgSoft: 'bg-slate-900/70',
    text: 'text-slate-100',
    textSoft: 'text-slate-300',
    rail: 'bg-slate-800/80',
    fill: 'bg-slate-300',
    badge: 'bg-slate-800/80 text-slate-200 border-slate-700/80',
    glow: 'shadow-[0_0_0_1px_rgba(148,163,184,0.16),0_16px_40px_rgba(2,6,23,0.45)]',
    surface: 'bg-slate-900/60',
  },
  warning: {
    border: 'border-amber-500/45',
    bg: 'bg-zinc-950/95',
    bgSoft: 'bg-amber-950/35',
    text: 'text-amber-50',
    textSoft: 'text-amber-200',
    rail: 'bg-amber-950/55',
    fill: 'bg-amber-400',
    badge: 'bg-amber-500/15 text-amber-100 border-amber-400/35',
    glow: 'shadow-[0_0_0_1px_rgba(245,158,11,0.18),0_18px_48px_rgba(120,53,15,0.3)]',
    surface: 'bg-amber-950/18',
  },
  danger: {
    border: 'border-orange-500/45',
    bg: 'bg-zinc-950/95',
    bgSoft: 'bg-orange-950/35',
    text: 'text-orange-50',
    textSoft: 'text-orange-200',
    rail: 'bg-orange-950/55',
    fill: 'bg-orange-400',
    badge: 'bg-orange-500/15 text-orange-100 border-orange-400/35',
    glow: 'shadow-[0_0_0_1px_rgba(249,115,22,0.18),0_18px_48px_rgba(124,45,18,0.3)]',
    surface: 'bg-orange-950/18',
  },
  critical: {
    border: 'border-red-500/52',
    bg: 'bg-zinc-950/95',
    bgSoft: 'bg-red-950/38',
    text: 'text-red-50',
    textSoft: 'text-red-200',
    rail: 'bg-red-950/55',
    fill: 'bg-red-500',
    badge: 'bg-red-500/15 text-red-100 border-red-400/38',
    glow: 'shadow-[0_0_0_1px_rgba(239,68,68,0.22),0_22px_58px_rgba(127,29,29,0.34)]',
    surface: 'bg-red-950/18',
  },
  rescue: {
    border: 'border-emerald-500/45',
    bg: 'bg-zinc-950/95',
    bgSoft: 'bg-emerald-950/35',
    text: 'text-emerald-50',
    textSoft: 'text-emerald-200',
    rail: 'bg-emerald-950/55',
    fill: 'bg-emerald-400',
    badge: 'bg-emerald-500/15 text-emerald-100 border-emerald-400/35',
    glow: 'shadow-[0_0_0_1px_rgba(16,185,129,0.18),0_18px_48px_rgba(6,95,70,0.3)]',
    surface: 'bg-emerald-950/18',
  },
  legend: {
    border: 'border-fuchsia-500/42',
    bg: 'bg-zinc-950/95',
    bgSoft: 'bg-fuchsia-950/35',
    text: 'text-fuchsia-50',
    textSoft: 'text-fuchsia-200',
    rail: 'bg-fuchsia-950/55',
    fill: 'bg-fuchsia-400',
    badge: 'bg-fuchsia-500/15 text-fuchsia-100 border-fuchsia-400/35',
    glow: 'shadow-[0_0_0_1px_rgba(217,70,239,0.18),0_18px_48px_rgba(112,26,117,0.3)]',
    surface: 'bg-fuchsia-950/18',
  },
  shadow: {
    border: 'border-violet-500/40',
    bg: 'bg-zinc-950/95',
    bgSoft: 'bg-violet-950/35',
    text: 'text-violet-50',
    textSoft: 'text-violet-200',
    rail: 'bg-violet-950/55',
    fill: 'bg-violet-400',
    badge: 'bg-violet-500/15 text-violet-100 border-violet-400/35',
    glow: 'shadow-[0_0_0_1px_rgba(139,92,246,0.18),0_18px_48px_rgba(76,29,149,0.3)]',
    surface: 'bg-violet-950/18',
  },
};

const VARIANT_TOKENS: Record<
  ThreatMeterVariant,
  {
    root: string;
    heading: string;
    summaryValue: string;
    summaryLabel: string;
    sectionGap: string;
    breakdownCols: string;
    trendCols: string;
    railHeight: string;
    adviceSize: string;
  }
> = {
  minimal: {
    root: 'rounded-xl p-3',
    heading: 'text-sm font-semibold tracking-tight',
    summaryValue: 'text-2xl font-semibold tracking-tight',
    summaryLabel: 'text-[11px]',
    sectionGap: 'gap-3',
    breakdownCols: 'grid-cols-1',
    trendCols: 'grid-cols-2',
    railHeight: 'h-2',
    adviceSize: 'px-2.5 py-1.5 text-[11px]',
  },
  inline: {
    root: 'rounded-xl p-3',
    heading: 'text-sm font-semibold tracking-tight',
    summaryValue: 'text-xl font-semibold tracking-tight',
    summaryLabel: 'text-[11px]',
    sectionGap: 'gap-2.5',
    breakdownCols: 'grid-cols-1',
    trendCols: 'grid-cols-2',
    railHeight: 'h-2',
    adviceSize: 'px-2.5 py-1.5 text-[11px]',
  },
  compact: {
    root: 'rounded-2xl p-3.5',
    heading: 'text-base font-semibold tracking-tight',
    summaryValue: 'text-3xl font-semibold tracking-tight',
    summaryLabel: 'text-xs',
    sectionGap: 'gap-3',
    breakdownCols: 'grid-cols-1 md:grid-cols-2',
    trendCols: 'grid-cols-2 md:grid-cols-4',
    railHeight: 'h-2.5',
    adviceSize: 'px-2.5 py-1.5 text-xs',
  },
  standard: {
    root: 'rounded-2xl p-4',
    heading: 'text-lg font-semibold tracking-tight',
    summaryValue: 'text-4xl font-semibold tracking-tight',
    summaryLabel: 'text-sm',
    sectionGap: 'gap-3.5',
    breakdownCols: 'grid-cols-1 md:grid-cols-2',
    trendCols: 'grid-cols-2 md:grid-cols-4',
    railHeight: 'h-3',
    adviceSize: 'px-3 py-2 text-sm',
  },
  detailed: {
    root: 'rounded-[1.3rem] p-5',
    heading: 'text-xl font-semibold tracking-tight',
    summaryValue: 'text-5xl font-semibold tracking-tight',
    summaryLabel: 'text-sm',
    sectionGap: 'gap-4',
    breakdownCols: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
    trendCols: 'grid-cols-2 md:grid-cols-4',
    railHeight: 'h-3',
    adviceSize: 'px-3 py-2 text-sm',
  },
  cinematic: {
    root: 'rounded-[1.4rem] p-5',
    heading: 'text-xl font-semibold tracking-tight',
    summaryValue: 'text-5xl font-semibold tracking-tight',
    summaryLabel: 'text-sm',
    sectionGap: 'gap-4',
    breakdownCols: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
    trendCols: 'grid-cols-2 md:grid-cols-4',
    railHeight: 'h-3',
    adviceSize: 'px-3.5 py-2.5 text-sm',
  },
};

const MODE_LABEL: Record<ThreatModeKey, string> = {
  lobby: 'Lobby',
  battle: 'Battle',
  empire: 'Empire',
  league: 'League',
  syndicate: 'Syndicate',
  'deal-room': 'Deal Room',
  phantom: 'Phantom',
  predator: 'Predator',
  global: 'Global',
  unknown: 'Unknown',
};

const STANCE_LABEL: Record<ThreatRecommendationStance, string> = {
  hold: 'Hold',
  counter: 'Counter',
  mute: 'Mute Crowd',
  hide: 'Hide Surface',
  stabilize: 'Stabilize',
  pivot: 'Pivot',
  rescue: 'Request Rescue',
  bait: 'Bait',
  watch: 'Watch',
  push: 'Push',
};

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

function clampPct(value: number | null | undefined): number {
  if (!Number.isFinite(value)) return 0;
  const n = Number(value);
  return n > 1 ? Math.max(0, Math.min(100, Math.round(n))) : Math.max(0, Math.min(100, Math.round(n * 100)));
}

function signedPct(value: number | null | undefined): string {
  if (!Number.isFinite(value)) return '—';
  const n = clampPct(value);
  return `${Number(value) > 0 ? '+' : ''}${n}%`;
}

function countLabel(value: number | null | undefined): string {
  if (!Number.isFinite(value)) return '—';
  const n = Number(value);
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `${Math.round(n)}`;
}

function inferTone(model: ThreatMeterModel): ThreatTone {
  if (model.tone) return model.tone;
  if (model.rescueEligible && clampPct(model.rescuePct) >= 55 && clampPct(model.threatPct) >= 60) {
    return 'rescue';
  }
  if (model.liveOpsAmplified && clampPct(model.threatPct) >= 80) {
    return 'legend';
  }
  if (model.shadowBacked && clampPct(model.exposurePct) < 35 && clampPct(model.threatPct) >= 45) {
    return 'shadow';
  }
  if (clampPct(model.threatPct) >= 85) return 'critical';
  if (clampPct(model.threatPct) >= 65) return 'danger';
  if (clampPct(model.threatPct) >= 40) return 'warning';
  return 'neutral';
}

function threatWord(pct: number): string {
  if (pct >= 90) return 'Catastrophic';
  if (pct >= 80) return 'Break State';
  if (pct >= 70) return 'Critical';
  if (pct >= 60) return 'Severe';
  if (pct >= 50) return 'Escalating';
  if (pct >= 35) return 'Elevated';
  if (pct >= 20) return 'Watch';
  return 'Stable';
}

function railFillClass(tone: ThreatTone): string {
  return TONE_TOKENS[tone].fill;
}

function sectionSurface(tone: ThreatTone): string {
  return TONE_TOKENS[tone].surface;
}

function adviceTone(stance: ThreatRecommendationStance): ThreatTone {
  switch (stance) {
    case 'rescue':
      return 'rescue';
    case 'counter':
    case 'push':
    case 'bait':
      return 'danger';
    case 'mute':
    case 'hide':
      return 'shadow';
    case 'stabilize':
    case 'hold':
      return 'warning';
    case 'pivot':
    case 'watch':
    default:
      return 'neutral';
  }
}

function percentOrFallback(value: number | null | undefined): string {
  return Number.isFinite(value) ? `${clampPct(value)}%` : '—';
}

const HeaderPill = memo(function HeaderPill({
  label,
  tone,
}: {
  label: string;
  tone: ThreatTone;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium',
        TONE_TOKENS[tone].badge,
      )}
    >
      {label}
    </span>
  );
});

const Rail = memo(function Rail({
  value,
  tone,
  heightClass,
}: {
  value: number | null | undefined;
  tone: ThreatTone;
  heightClass: string;
}) {
  const pct = clampPct(value);
  return (
    <div className={cx('overflow-hidden rounded-full', TONE_TOKENS[tone].rail, heightClass)}>
      <div
        className={cx('h-full rounded-full transition-[width] duration-300', railFillClass(tone))}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
});

const EmptyMeter = memo(function EmptyMeter({
  label,
  variant,
  className,
}: {
  label: string;
  variant: ThreatMeterVariant;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'border border-dashed border-slate-800 bg-slate-950/70 text-slate-400',
        VARIANT_TOKENS[variant].root,
        className,
      )}
    >
      <div className="text-sm">{label}</div>
    </div>
  );
});

const SummaryCounter = memo(function SummaryCounter({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail?: string | null;
  tone: ThreatTone;
}) {
  return (
    <div className={cx('rounded-2xl border p-3', TONE_TOKENS[tone].badge)}>
      <div className="text-[10px] uppercase tracking-[0.16em] opacity-80">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
      {detail ? <div className="mt-1 text-[11px] opacity-80">{detail}</div> : null}
    </div>
  );
});

const TrendCard = memo(function TrendCard({
  metric,
  fallbackTone,
  railHeight,
}: {
  metric: ThreatTrendMetric;
  fallbackTone: ThreatTone;
  railHeight: string;
}) {
  const tone = metric.tone ?? fallbackTone;
  const max = Number.isFinite(metric.max) && Number(metric.max) > 0 ? Number(metric.max) : 100;
  const pct = Math.max(0, Math.min(100, Math.round((metric.value / max) * 100)));

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[11px] uppercase tracking-[0.16em] text-slate-500">
            {metric.label}
          </div>
          {metric.hint ? (
            <div className="mt-1 text-[11px] leading-5 text-slate-400">{metric.hint}</div>
          ) : null}
        </div>
        <div className={cx('text-sm font-semibold', TONE_TOKENS[tone].text)}>
          {metric.display ?? `${pct}%`}
        </div>
      </div>
      <Rail value={pct} tone={tone} heightClass={railHeight} />
      <div className="mt-2 text-[11px] text-slate-400">Δ {signedPct(metric.delta)}</div>
    </div>
  );
});

const SliceCard = memo(function SliceCard({
  slice,
  model,
  fallbackTone,
  onSliceClick,
  railHeight,
}: {
  slice: ThreatBreakdownSlice;
  model: ThreatMeterModel;
  fallbackTone: ThreatTone;
  onSliceClick?: (slice: ThreatBreakdownSlice, model: ThreatMeterModel) => void;
  railHeight: string;
}) {
  const tone = slice.tone ?? fallbackTone;
  const max = Number.isFinite(slice.max) && Number(slice.max) > 0 ? Number(slice.max) : 100;
  const pct = Math.max(0, Math.min(100, Math.round((slice.value / max) * 100)));

  return (
    <button
      type="button"
      onClick={() => onSliceClick?.(slice, model)}
      className={cx(
        'w-full rounded-2xl border border-slate-800 bg-slate-950/55 p-3 text-left transition hover:border-slate-700 hover:bg-slate-900/70',
        slice.emphasis && 'ring-1 ring-white/10',
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[11px] uppercase tracking-[0.16em] text-slate-500">
            {slice.label}
          </div>
          {slice.detail ? (
            <div className="mt-1 text-[11px] leading-5 text-slate-400">{slice.detail}</div>
          ) : null}
        </div>
        <div className="text-right">
          <div className={cx('text-sm font-semibold', TONE_TOKENS[tone].text)}>{pct}%</div>
          <div className="text-[11px] text-slate-400">Δ {signedPct(slice.delta)}</div>
        </div>
      </div>
      <Rail value={pct} tone={tone} heightClass={railHeight} />
      {Number.isFinite(slice.weight) ? (
        <div className="mt-2 text-[11px] text-slate-400">weight {percentOrFallback(slice.weight)}</div>
      ) : null}
    </button>
  );
});

const AdviceChip = memo(function AdviceChip({
  item,
  model,
  onAdviceClick,
  sizeClass,
}: {
  item: ThreatAdviceItem;
  model: ThreatMeterModel;
  onAdviceClick?: (item: ThreatAdviceItem, model: ThreatMeterModel) => void;
  sizeClass: string;
}) {
  const tone = adviceTone(item.stance);
  return (
    <button
      type="button"
      onClick={() => onAdviceClick?.(item, model)}
      className={cx(
        'inline-flex items-center gap-2 rounded-xl border font-medium transition hover:brightness-110',
        TONE_TOKENS[tone].badge,
        sizeClass,
        item.isPrimary && 'ring-1 ring-white/10',
      )}
    >
      <span>{item.label}</span>
      <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px]">{clampPct(item.confidence)}%</span>
      {item.badge ? <span className="rounded-md bg-black/10 px-1.5 py-0.5 text-[10px]">{item.badge}</span> : null}
      {item.hotkey ? <span className="rounded-md bg-black/10 px-1.5 py-0.5 text-[10px]">{item.hotkey}</span> : null}
    </button>
  );
});

const WitnessBandRow = memo(function WitnessBandRow({
  band,
  model,
  fallbackTone,
  onWitnessBandClick,
}: {
  band: ThreatWitnessBand;
  model: ThreatMeterModel;
  fallbackTone: ThreatTone;
  onWitnessBandClick?: (band: ThreatWitnessBand, model: ThreatMeterModel) => void;
}) {
  const tone = band.tone ?? fallbackTone;
  return (
    <button
      type="button"
      onClick={() => onWitnessBandClick?.(band, model)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/55 px-3 py-2 text-left transition hover:border-slate-700 hover:bg-slate-900/70"
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-slate-100">{band.label}</div>
        <div className="truncate text-[11px] text-slate-400">
          hostility {percentOrFallback(band.hostilityPct)} • shame {percentOrFallback(band.embarrassmentPct)}
        </div>
      </div>
      <div className="min-w-[110px]">
        <div className={cx('mb-1 text-right text-[11px] font-medium', TONE_TOKENS[tone].text)}>
          {countLabel(band.count)} witnesses
        </div>
        <Rail value={band.pressurePct ?? band.hostilityPct} tone={tone} heightClass="h-2" />
      </div>
    </button>
  );
});

const HistorySpark = memo(function HistorySpark({
  points,
  tone,
}: {
  points: ThreatHistoryPoint[];
  tone: ThreatTone;
}) {
  if (points.length === 0) return null;
  const max = Math.max(...points.map(point => Math.max(1, clampPct(point.value))));
  return (
    <div className="flex h-20 items-end gap-1.5">
      {points.map(point => {
        const pct = clampPct(point.value);
        const height = Math.max(8, Math.round((pct / Math.max(1, max)) * 100));
        const pointTone = point.tone ?? tone;
        return (
          <div key={point.id} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <div
              className={cx(
                'w-full rounded-t-md transition-opacity group-hover:opacity-90',
                railFillClass(pointTone),
              )}
              style={{ height: `${height}%` }}
              title={`${point.label ?? point.id}: ${pct}%`}
            />
            <div className="w-full truncate text-center text-[10px] text-slate-500">
              {point.label ?? ''}
            </div>
          </div>
        );
      })}
    </div>
  );
});

function deriveSummary(model: ThreatMeterModel): string {
  if (model.detail) return model.detail;
  const threat = clampPct(model.threatPct);
  if (threat >= 85) {
    return 'Chat pressure has crossed into a collapse-risk envelope. Counterplay must be deliberate and immediate.';
  }
  if (threat >= 70) {
    return 'The hostile scene is now steering perception more than the player. Tactical correction is still possible.';
  }
  if (threat >= 50) {
    return 'Pressure is no longer ambient. Witness attention and hostile amplification are starting to compound.';
  }
  if (threat >= 30) {
    return 'Signals are elevated, but the player still controls tempo if action remains precise.';
  }
  return 'The chat surface is stable. Remain watchful and keep narrative momentum on your side.';
}

function ThreatMeterInner({
  model,
  variant = 'standard',
  className,
  style,
  showHeader = true,
  showLabel = true,
  showDelta = true,
  showHistory = true,
  showBreakdown = true,
  showTrendGrid = true,
  showAdvice = true,
  showWitnessBands = true,
  showFootnotes = true,
  showCounts = true,
  showSummaryRail = true,
  maxHistoryPoints = 18,
  maxSlices = 9,
  maxAdvice = 5,
  maxWitnessBands = 4,
  onAdviceClick,
  onSliceClick,
  onWitnessBandClick,
  emptyStateLabel = 'No chat threat telemetry available.',
  ['data-testid']: dataTestId,
}: ChatThreatMeterProps) {
  const regionId = useId();

  if (!model) {
    return <EmptyMeter label={emptyStateLabel} variant={variant} className={className} />;
  }

  const tone = inferTone(model);
  const tokens = TONE_TOKENS[tone];
  const vt = VARIANT_TOKENS[variant];
  const threatPct = clampPct(model.threatPct);
  const visibleHistory = (model.history ?? []).slice(-Math.max(0, maxHistoryPoints));
  const visibleSlices = (model.slices ?? []).slice(0, Math.max(0, maxSlices));
  const visibleAdvice = (model.advice ?? []).slice(0, Math.max(0, maxAdvice));
  const visibleBands = (model.witnessBands ?? []).slice(0, Math.max(0, maxWitnessBands));
  const summary = deriveSummary(model);

  const statCounters = useMemo(
    () => [
      {
        id: 'witnesses',
        label: 'Witnesses',
        value: countLabel(model.witnessCount),
        detail: showCounts ? `${countLabel(model.unreadCount)} unread` : null,
      },
      {
        id: 'channels',
        label: 'Active Channels',
        value: countLabel(model.activeChannels),
        detail: `${countLabel(model.hostileActors)} hostile / ${countLabel(model.helperActors)} helper`,
      },
      {
        id: 'stance',
        label: 'Mode',
        value: MODE_LABEL[model.mode ?? 'unknown'],
        detail: model.stageLabel ?? model.threatLabel ?? threatWord(threatPct),
      },
      {
        id: 'rescue',
        label: 'Rescue',
        value: percentOrFallback(model.rescuePct),
        detail: model.rescueEligible ? 'eligible' : 'not primed',
      },
    ],
    [
      model.activeChannels,
      model.helperActors,
      model.hostileActors,
      model.mode,
      model.rescueEligible,
      model.rescuePct,
      model.stageLabel,
      model.threatLabel,
      model.unreadCount,
      model.witnessCount,
      showCounts,
      threatPct,
    ],
  );

  return (
    <section
      data-testid={dataTestId}
      aria-labelledby={`${regionId}-title`}
      className={cx(
        'relative overflow-hidden border',
        tokens.border,
        tokens.bg,
        tokens.glow,
        vt.root,
        className,
      )}
      style={style}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className={cx('absolute inset-x-0 top-0 h-24 blur-3xl', tokens.bgSoft)} />
      </div>

      <div className={cx('relative flex flex-col', vt.sectionGap)}>
        {showHeader ? (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <HeaderPill label={model.stageLabel ?? threatWord(threatPct)} tone={tone} />
                <HeaderPill label={MODE_LABEL[model.mode ?? 'unknown']} tone={tone} />
                {model.shadowBacked ? <HeaderPill label="Shadow" tone="shadow" /> : null}
                {model.liveOpsAmplified ? <HeaderPill label="LiveOps" tone="legend" /> : null}
                {model.rescueEligible ? <HeaderPill label="Rescue Eligible" tone="rescue" /> : null}
              </div>

              <h3 id={`${regionId}-title`} className={cx(vt.heading, tokens.text)}>
                Chat Threat Meter
              </h3>
              <p className={cx('mt-2 max-w-4xl text-sm leading-6', tokens.textSoft)}>
                {summary}
              </p>
            </div>

            <div className="min-w-[220px] rounded-[1.25rem] border border-slate-800 bg-slate-950/55 p-4">
              {showLabel ? (
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  {model.threatLabel ?? 'Aggregate Threat'}
                </div>
              ) : null}
              <div className={cx('mt-1', vt.summaryValue, tokens.text)}>{threatPct}%</div>
              <div className={cx('mt-1', vt.summaryLabel, tokens.textSoft)}>
                {threatWord(threatPct)}
                {showDelta && Number.isFinite(model.deltaPct) ? (
                  <span className="ml-2">Δ {signedPct(model.deltaPct)}</span>
                ) : null}
              </div>
              {showSummaryRail ? (
                <div className="mt-3">
                  <Rail value={threatPct} tone={tone} heightClass={vt.railHeight} />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryCounter
            label="Hostility"
            value={percentOrFallback(model.hostilityPct)}
            detail="direct antagonism"
            tone={tone}
          />
          <SummaryCounter
            label="Pressure"
            value={percentOrFallback(model.pressurePct)}
            detail="decision compression"
            tone={tone}
          />
          <SummaryCounter
            label="Crowd Heat"
            value={percentOrFallback(model.crowdHeatPct)}
            detail="witness amplification"
            tone={tone}
          />
          <SummaryCounter
            label="Confidence"
            value={percentOrFallback(model.confidencePct)}
            detail="player posture"
            tone={tone}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <MicroRailCard label="Disruption" value={model.disruptionPct} tone={tone} railHeight={vt.railHeight} />
          <MicroRailCard label="Embarrassment" value={model.embarrassmentPct} tone={tone} railHeight={vt.railHeight} />
          <MicroRailCard label="Volatility" value={model.volatilityPct} tone={tone} railHeight={vt.railHeight} />
          <MicroRailCard label="Suppression" value={model.suppressionPct} tone={tone} railHeight={vt.railHeight} />
          <MicroRailCard label="Exposure" value={model.exposurePct} tone={tone} railHeight={vt.railHeight} />
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {statCounters.map(counter => (
            <SummaryCounter
              key={counter.id}
              label={counter.label}
              value={counter.value}
              detail={counter.detail}
              tone={tone}
            />
          ))}
        </div>

        {showHistory && visibleHistory.length > 0 ? (
          <div className={cx('rounded-2xl border border-slate-800 p-3', sectionSurface(tone))}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                Threat Memory
              </div>
              <div className="text-[11px] text-slate-400">{visibleHistory.length} samples</div>
            </div>
            <HistorySpark points={visibleHistory} tone={tone} />
          </div>
        ) : null}

        {showTrendGrid && model.trendMetrics && model.trendMetrics.length > 0 ? (
          <div className={cx('grid gap-3', vt.trendCols)}>
            {model.trendMetrics.map(metric => (
              <TrendCard
                key={metric.id}
                metric={metric}
                fallbackTone={tone}
                railHeight={vt.railHeight}
              />
            ))}
          </div>
        ) : null}

        {showBreakdown && visibleSlices.length > 0 ? (
          <div className={cx('grid gap-3', vt.breakdownCols)}>
            {visibleSlices.map(slice => (
              <SliceCard
                key={slice.id}
                slice={slice}
                model={model}
                fallbackTone={tone}
                onSliceClick={onSliceClick}
                railHeight={vt.railHeight}
              />
            ))}
          </div>
        ) : null}

        {showAdvice && visibleAdvice.length > 0 ? (
          <div className={cx('rounded-2xl border border-slate-800 p-3', sectionSurface(tone))}>
            <div className="mb-3 text-[11px] uppercase tracking-[0.2em] text-slate-500">
              Tactical Advice
            </div>
            <div className="flex flex-wrap gap-2">
              {visibleAdvice.map(item => (
                <AdviceChip
                  key={item.id}
                  item={item}
                  model={model}
                  onAdviceClick={onAdviceClick}
                  sizeClass={vt.adviceSize}
                />
              ))}
            </div>
          </div>
        ) : null}

        {showWitnessBands && visibleBands.length > 0 ? (
          <div className={cx('rounded-2xl border border-slate-800 p-3', sectionSurface(tone))}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                Audience Bands
              </div>
              <div className="text-[11px] text-slate-400">{visibleBands.length} tracked bands</div>
            </div>
            <div className="grid gap-2">
              {visibleBands.map(band => (
                <WitnessBandRow
                  key={band.id}
                  band={band}
                  model={model}
                  fallbackTone={tone}
                  onWitnessBandClick={onWitnessBandClick}
                />
              ))}
            </div>
          </div>
        ) : null}

        {showFootnotes ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-3 text-[11px] leading-6 text-slate-400">
            <div>
              Threat is a render-time summary of the chat engine’s already-computed perception envelope.
              This component does not calculate transcript truth, moderation outcomes, invasion timing, or
              learning updates.
            </div>
            <div className="mt-2">
              The display is strongest when fed by the unified chat engine’s pressure, hostility, witness,
              rescue, and continuity signals rather than ad hoc local heuristics.
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

const MicroRailCard = memo(function MicroRailCard({
  label,
  value,
  tone,
  railHeight,
}: {
  label: string;
  value: number | null | undefined;
  tone: ThreatTone;
  railHeight: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</div>
        <div className={cx('text-sm font-semibold', TONE_TOKENS[tone].text)}>
          {percentOrFallback(value)}
        </div>
      </div>
      <Rail value={value} tone={tone} heightClass={railHeight} />
    </div>
  );
});

export const ChatThreatMeter = memo(ThreatMeterInner);

export default ChatThreatMeter;
