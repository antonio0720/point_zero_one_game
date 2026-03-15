import React, { memo, useMemo } from 'react';

import type {
  ChatThreatMeterProps,
  ThreatMeterDimensionViewModel,
  ThreatMeterRecommendationViewModel,
  ThreatMeterSeverity,
} from './uiTypes';

/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT THREAT METER
 * FILE: pzo-web/src/components/chat/ChatThreatMeter.tsx
 * ============================================================================
 *
 * Render-only tactical threat meter for the unified chat shell.
 *
 * Architectural doctrine:
 * - receives already-computed values from the frontend chat engine
 * - never computes truth for hostility / shame / rescue / volatility itself
 * - never touches sockets, transcript buffers, learning profiles, or store law
 * - stays cheap under high message cadence and high-frequency threat updates
 * ============================================================================
 */

const BAND_TOKEN: Record<ThreatMeterSeverity, { rail: string; glow: string; text: string }> = {
  quiet: {
    rail: 'from-cyan-300 via-sky-300 to-cyan-400',
    glow: 'shadow-[0_0_0_1px_rgba(34,211,238,0.18),0_10px_30px_rgba(14,165,233,0.08)]',
    text: 'text-cyan-100',
  },
  low: {
    rail: 'from-sky-300 via-indigo-300 to-sky-400',
    glow: 'shadow-[0_0_0_1px_rgba(96,165,250,0.18),0_10px_30px_rgba(99,102,241,0.08)]',
    text: 'text-sky-100',
  },
  elevated: {
    rail: 'from-amber-300 via-orange-300 to-amber-400',
    glow: 'shadow-[0_0_0_1px_rgba(251,191,36,0.18),0_10px_30px_rgba(245,158,11,0.08)]',
    text: 'text-amber-100',
  },
  high: {
    rail: 'from-orange-300 via-rose-300 to-orange-500',
    glow: 'shadow-[0_0_0_1px_rgba(249,115,22,0.18),0_10px_30px_rgba(244,63,94,0.08)]',
    text: 'text-orange-100',
  },
  severe: {
    rail: 'from-rose-300 via-red-300 to-rose-500',
    glow: 'shadow-[0_0_0_1px_rgba(244,63,94,0.22),0_10px_30px_rgba(239,68,68,0.10)]',
    text: 'text-rose-100',
  },
};

const DENSITY_CLASS = {
  compact: {
    root: 'rounded-2xl p-3 gap-3',
    value: 'text-[22px]',
    label: 'text-[10px]',
    body: 'text-[11px]',
    dimTitle: 'text-[10px]',
    dimValue: 'text-[13px]',
    spark: 'h-7',
  },
  comfortable: {
    root: 'rounded-[22px] p-3.5 gap-3.5',
    value: 'text-[24px]',
    label: 'text-[10px]',
    body: 'text-[11px]',
    dimTitle: 'text-[10px]',
    dimValue: 'text-[14px]',
    spark: 'h-8',
  },
  cinematic: {
    root: 'rounded-[24px] p-4 gap-4',
    value: 'text-[26px]',
    label: 'text-[10px]',
    body: 'text-[12px]',
    dimTitle: 'text-[10px]',
    dimValue: 'text-[14px]',
    spark: 'h-9',
  },
} as const;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function formatPercent(value01: number): string {
  return `${Math.round(clamp01(value01) * 100)}%`;
}

function dimensionTone(value01: number): string {
  if (value01 >= 0.82) return 'text-rose-100';
  if (value01 >= 0.6) return 'text-orange-100';
  if (value01 >= 0.4) return 'text-amber-100';
  if (value01 >= 0.2) return 'text-sky-100';
  return 'text-white/82';
}

function railToken(value01: number): string {
  if (value01 >= 0.82) return 'from-rose-300 via-red-300 to-rose-500';
  if (value01 >= 0.6) return 'from-orange-300 via-rose-300 to-orange-500';
  if (value01 >= 0.4) return 'from-amber-300 via-orange-300 to-amber-400';
  if (value01 >= 0.2) return 'from-sky-300 via-indigo-300 to-sky-400';
  return 'from-cyan-300 via-sky-300 to-cyan-400';
}

function RecommendationRail({
  item,
}: {
  item: ThreatMeterRecommendationViewModel;
}): JSX.Element {
  const toneClass =
    item.tone === 'danger'
      ? 'border-rose-400/22 bg-rose-500/10 text-rose-100'
      : item.tone === 'warning'
        ? 'border-amber-400/22 bg-amber-500/10 text-amber-100'
        : item.tone === 'positive'
          ? 'border-emerald-400/22 bg-emerald-500/10 text-emerald-100'
          : 'border-white/10 bg-white/6 text-white/82';

  return (
    <div className={['rounded-2xl border px-3 py-2.5', toneClass].join(' ')} title={item.hint || item.body}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] opacity-70">{item.label}</div>
          <div className="mt-1 text-[12px] font-semibold leading-relaxed">{item.body}</div>
        </div>
        {item.scoreLabel ? <div className="text-[11px] font-bold opacity-80">{item.scoreLabel}</div> : null}
      </div>
    </div>
  );
}

function DimensionCard({
  dimension,
  density,
}: {
  dimension: ThreatMeterDimensionViewModel;
  density: keyof typeof DENSITY_CLASS;
}): JSX.Element {
  const value = clamp01(dimension.value01);
  const sparkValues = dimension.sparkline?.length ? dimension.sparkline : [value];

  return (
    <div className="rounded-2xl border border-white/8 bg-black/18 px-3 py-2.5">
      <div className={[DENSITY_CLASS[density].dimTitle, 'uppercase tracking-[0.16em] text-white/48'].join(' ')}>
        {dimension.label}
      </div>
      <div className={[DENSITY_CLASS[density].dimValue, 'mt-1 font-bold', dimensionTone(value)].join(' ')}>
        {dimension.valueLabel || formatPercent(value)}
      </div>
      {dimension.subvalue ? <div className="mt-0.5 text-[11px] text-white/56">{dimension.subvalue}</div> : null}
      <div className={[DENSITY_CLASS[density].spark, 'mt-2 flex items-end gap-1'].join(' ')} aria-hidden="true">
        {sparkValues.slice(-12).map((entry, index) => {
          const bar = clamp01(entry);
          return (
            <div
              key={`${dimension.id}:${index}`}
              className={['min-w-0 flex-1 rounded-full bg-gradient-to-t', railToken(bar)].join(' ')}
              style={{ height: `${Math.max(12, Math.round(bar * 100))}%`, opacity: 0.34 + bar * 0.66 }}
            />
          );
        })}
      </div>
    </div>
  );
}

function BaseChatThreatMeter({
  model,
  className,
  style,
  activeChannelKey,
}: ChatThreatMeterProps): JSX.Element | null {
  const density = model.density ?? 'comfortable';
  const bandToken = BAND_TOKEN[model.severity];
  const primary = clamp01(model.aggregateScore01);

  const dimensions = useMemo(() => model.dimensions.slice(0, 8), [model.dimensions]);
  const recommendations = useMemo(() => model.recommendations.slice(0, 3), [model.recommendations]);

  if (!model.visible) return null;

  return (
    <section
      data-channel={activeChannelKey ?? model.channelKey ?? 'GLOBAL'}
      data-threat-severity={model.severity}
      className={[
        'overflow-hidden border border-white/8 bg-[rgba(9,13,28,0.88)] text-white backdrop-blur-xl',
        DENSITY_CLASS[density].root,
        bandToken.glow,
        className ?? '',
      ].join(' ')}
      style={style}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/78">
              Threat
            </span>
            {model.channelLabel ? (
              <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-white/62">
                {model.channelLabel}
              </span>
            ) : null}
          </div>
          <div className={[DENSITY_CLASS[density].value, 'mt-2 font-black tracking-[0.02em]', bandToken.text].join(' ')}>
            {model.aggregateScoreLabel || formatPercent(primary)}
          </div>
          <div className={[DENSITY_CLASS[density].body, 'mt-1 max-w-[58ch] leading-relaxed text-white/72'].join(' ')}>
            {model.summary}
          </div>
        </div>

        <div className="min-w-[168px] flex-1 max-w-[280px]">
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-white/48">
            <span>{model.severityLabel || model.severity}</span>
            <span>{model.deltaLabel || 'live'}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full border border-white/8 bg-white/6">
            <div
              className={['h-full rounded-full bg-gradient-to-r', bandToken.rail].join(' ')}
              style={{ width: `${Math.max(8, Math.round(primary * 100))}%` }}
            />
          </div>
          {model.bandNarrative ? <div className="mt-2 text-[11px] text-white/56">{model.bandNarrative}</div> : null}
        </div>
      </div>

      <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        {dimensions.map((dimension) => (
          <DimensionCard key={dimension.id} dimension={dimension} density={density} />
        ))}
      </div>

      {recommendations.length > 0 ? (
        <div className="grid gap-2 xl:grid-cols-3">
          {recommendations.map((item) => (
            <RecommendationRail key={item.id} item={item} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

const ChatThreatMeter = memo(BaseChatThreatMeter);

ChatThreatMeter.displayName = 'ChatThreatMeter';

export default ChatThreatMeter;
