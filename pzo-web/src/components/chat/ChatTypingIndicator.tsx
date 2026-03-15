import React, {
  Fragment,
  memo,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import type {
  ChatTypingIndicatorProps,
  TypingActorRole,
  TypingIndicatorDensity,
  TypingIndicatorLabels,
} from './uiTypes';

/**
 * ==========================================================================
 * POINT ZERO ONE — UNIFIED CHAT TYPING INDICATOR
 * FILE: pzo-web/src/components/chat/ChatTypingIndicator.tsx
 * --------------------------------------------------------------------------
 * Doctrine
 * - UI shell only. This file never owns socket subscriptions, presence truth,
 *   transcript mutation, inference policy, or hater/helper orchestration.
 * - accepts already-resolved typing state from the engine / presence adapters.
 * - presents social-theater and conversational pressure without becoming the
 *   authority on when typing should start, stop, or be suppressed.
 * - built for high-churn updates and large rooms through deterministic packing,
 *   summarization, animation isolation, and low-cost memoization.
 * ==========================================================================
 */

const DEFAULT_LABELS: TypingIndicatorLabels = {
  nobodyTyping: 'Nobody is typing.',
  typing: 'typing',
  andMore: (count) => `and ${count} more`,
  helperTyping: 'support drafting',
  threatTyping: 'threat drafting',
  youTyping: 'You are typing',
  aggregateRoomTyping: (count) => `${count} people are typing`,
  aggregateChannelTyping: (channel, count) => `${count} people are typing in ${channel}`,
  uncertainty: 'thinking',
  lurking: 'lurking',
  thinking: 'thinking',
};

const ROLE_WEIGHT: Record<TypingActorRole, number> = {
  system: 0,
  host: 1,
  moderator: 2,
  helper: 3,
  player: 4,
  npc: 5,
  hater: 6,
  spectator: 7,
};

const ROLE_PILL_CLASS: Record<TypingActorRole, string> = {
  player: 'bg-white/10 text-white/85 border-white/10',
  helper: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/20',
  hater: 'bg-rose-500/15 text-rose-200 border-rose-400/20',
  npc: 'bg-sky-500/15 text-sky-200 border-sky-400/20',
  moderator: 'bg-amber-500/15 text-amber-200 border-amber-400/20',
  host: 'bg-violet-500/15 text-violet-200 border-violet-400/20',
  spectator: 'bg-zinc-500/20 text-zinc-300 border-zinc-400/20',
  system: 'bg-cyan-500/15 text-cyan-200 border-cyan-400/20',
};

const DENSITY_TOKENS = {
  compact: {
    root: 'rounded-xl px-2.5 py-2 gap-2',
    avatar: 'h-7 w-7 text-[10px]',
    actor: 'min-h-[42px] px-2 py-1.5 gap-2 rounded-xl',
    title: 'text-[12px]',
    meta: 'text-[10px]',
    badge: 'text-[9px] px-1.5 py-0.5',
    dots: 'h-5 min-w-[34px] px-1.5',
  },
  comfortable: {
    root: 'rounded-2xl px-3 py-2.5 gap-2.5',
    avatar: 'h-8 w-8 text-[11px]',
    actor: 'min-h-[48px] px-2.5 py-2 gap-2.5 rounded-xl',
    title: 'text-[13px]',
    meta: 'text-[11px]',
    badge: 'text-[10px] px-2 py-0.5',
    dots: 'h-6 min-w-[40px] px-2',
  },
  expanded: {
    root: 'rounded-2xl px-3.5 py-3 gap-3',
    avatar: 'h-9 w-9 text-xs',
    actor: 'min-h-[54px] px-3 py-2.5 gap-3 rounded-2xl',
    title: 'text-[14px]',
    meta: 'text-[11px]',
    badge: 'text-[10px] px-2 py-0.5',
    dots: 'h-7 min-w-[46px] px-2.5',
  },
} as const;

type TypingActor = NonNullable<ChatTypingIndicatorProps['model']['actors']>[number];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function coerceFinite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeWhitespace(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeSearch(value: string | null | undefined): string {
  return normalizeWhitespace(value).toLowerCase();
}

function initialsForName(name: string): string {
  const words = normalizeWhitespace(name)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2);
  if (words.length === 0) return '?';
  return words.map((word) => word[0]?.toUpperCase() ?? '').join('') || '?';
}

function intentLabel(intent: TypingActor['intent'], labels: TypingIndicatorLabels): string {
  switch (intent) {
    case 'supporting':
      return labels.helperTyping;
    case 'threatening':
      return labels.threatTyping;
    case 'lurking':
      return labels.lurking;
    case 'thinking':
      return labels.thinking;
    case 'negotiating':
      return 'negotiating';
    case 'narrating':
      return 'narrating';
    case 'replying':
      return labels.typing;
    case 'reacting':
      return 'reacting';
    case 'none':
    default:
      return labels.uncertainty;
  }
}

function compareActors(left: TypingActor, right: TypingActor): number {
  if (left.isPriority !== right.isPriority) return left.isPriority ? -1 : 1;
  if (left.isSelf !== right.isSelf) return left.isSelf ? -1 : 1;
  if (left.isThreat !== right.isThreat) return left.isThreat ? -1 : 1;
  if (left.isRecommended !== right.isRecommended) return left.isRecommended ? -1 : 1;

  const urgencyOrder = coerceFinite(right.urgency) - coerceFinite(left.urgency);
  if (urgencyOrder !== 0) return urgencyOrder;

  const roleOrder = (ROLE_WEIGHT[left.role] ?? 999) - (ROLE_WEIGHT[right.role] ?? 999);
  if (roleOrder !== 0) return roleOrder;

  const confidenceOrder = coerceFinite(right.confidence) - coerceFinite(left.confidence);
  if (confidenceOrder !== 0) return confidenceOrder;

  const startedOrder = coerceFinite(left.startedAtMs, Infinity) - coerceFinite(right.startedAtMs, Infinity);
  if (startedOrder !== 0) return startedOrder;

  return normalizeWhitespace(left.name).localeCompare(normalizeWhitespace(right.name));
}

function channelMatches(actor: TypingActor, activeChannelKey?: string | null): boolean {
  const target = normalizeSearch(activeChannelKey ?? '');
  if (!target) return true;
  const actorChannel = normalizeSearch(actor.meta?.channelKey || actor.meta?.channelLabel || '');
  if (!actorChannel) return true;
  return actorChannel === target;
}

function buildSortedActors(actors: ChatTypingIndicatorProps['model']['actors'], activeChannelKey?: string | null): TypingActor[] {
  return actors.filter((actor) => channelMatches(actor, activeChannelKey)).sort(compareActors);
}

function relativeDuration(nowMs: number, startedAtMs?: number | null): string | null {
  if (!startedAtMs || !Number.isFinite(startedAtMs)) return null;
  const deltaSec = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
  if (deltaSec < 5) return 'now';
  if (deltaSec < 60) return `${deltaSec}s`;
  const deltaMin = Math.floor(deltaSec / 60);
  if (deltaMin < 60) return `${deltaMin}m`;
  return `${Math.floor(deltaMin / 60)}h`;
}

function useClock(enabled: boolean): number {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    const handle = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(handle);
  }, [enabled]);

  return nowMs;
}

function summarizeActors(
  actors: readonly TypingActor[],
  labels: TypingIndicatorLabels,
  summaryMode: NonNullable<ChatTypingIndicatorProps['summaryMode']>,
  activeChannelKey?: string | null,
): string {
  if (actors.length === 0) return labels.nobodyTyping;

  if (summaryMode === 'aggregate') {
    const channelLabel = actors[0]?.meta?.channelLabel || activeChannelKey || '';
    return channelLabel
      ? labels.aggregateChannelTyping(channelLabel, actors.length)
      : labels.aggregateRoomTyping(actors.length);
  }

  const visibleNames =
    summaryMode === 'first-one'
      ? actors.slice(0, 1).map((actor) => actor.isSelf ? labels.youTyping : actor.name)
      : summaryMode === 'first-two'
        ? actors.slice(0, 2).map((actor) => actor.isSelf ? labels.youTyping : actor.name)
        : actors.slice(0, 3).map((actor) => actor.isSelf ? labels.youTyping : actor.name);

  if (visibleNames.length === 1) return `${visibleNames[0]} ${labels.typing}`;
  if (visibleNames.length === 2) return `${visibleNames[0]} and ${visibleNames[1]} ${labels.typing}`;

  const extra = Math.max(0, actors.length - visibleNames.length);
  return `${visibleNames.join(', ')} ${extra > 0 ? labels.andMore(extra) : ''} ${labels.typing}`.replace(/\s+/g, ' ').trim();
}

function aggregateMeta(actors: readonly TypingActor[]) {
  return actors.reduce(
    (acc, actor) => {
      if (actor.role === 'helper') acc.helpers += 1;
      if (actor.role === 'hater') acc.threats += 1;
      acc.highestConfidence = Math.max(acc.highestConfidence, clamp(coerceFinite(actor.confidence, 0), 0, 1));
      return acc;
    },
    { helpers: 0, threats: 0, highestConfidence: 0 },
  );
}

interface TypingDotsProps {
  density: TypingIndicatorDensity;
  animated: boolean;
  tone?: 'default' | 'helper' | 'threat';
}

const TypingDots = memo(function TypingDots({ density, animated, tone = 'default' }: TypingDotsProps) {
  const densityTokens = DENSITY_TOKENS[density];
  const toneClass =
    tone === 'helper'
      ? 'bg-emerald-400/85'
      : tone === 'threat'
        ? 'bg-rose-400/85'
        : 'bg-white/75';

  return (
    <div className={['inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5', densityTokens.dots].join(' ')}>
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            aria-hidden="true"
            className={[
              'inline-block h-1.5 w-1.5 rounded-full',
              toneClass,
              animated ? 'animate-[chatTypingPulse_1.15s_ease-in-out_infinite]' : '',
            ].join(' ')}
            style={animated ? { animationDelay: `${index * 120}ms` } : undefined}
          />
        ))}
      </div>
    </div>
  );
});

function badgeToneClass(badge: TypingActor['badges'][number] | undefined): string {
  switch (badge?.tone) {
    case 'positive': return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200';
    case 'warning': return 'border-amber-400/20 bg-amber-500/10 text-amber-200';
    case 'danger': return 'border-rose-400/20 bg-rose-500/10 text-rose-200';
    case 'accent': return 'border-cyan-400/20 bg-cyan-500/10 text-cyan-200';
    case 'muted': return 'border-white/10 bg-white/5 text-white/55';
    default: return 'border-white/10 bg-white/5 text-white/70';
  }
}

interface TypingActorVisualProps {
  actor: TypingActor;
  density: TypingIndicatorDensity;
  labels: TypingIndicatorLabels;
  maxBadgesPerActor: number;
  showAvatars: boolean;
  showBadges: boolean;
  showIntentText: boolean;
  showMetaText: boolean;
  showConfidenceBar: boolean;
  animated: boolean;
  nowMs: number;
}

const TypingActorVisual = memo(function TypingActorVisual({
  actor,
  density,
  labels,
  maxBadgesPerActor,
  showAvatars,
  showBadges,
  showIntentText,
  showMetaText,
  showConfidenceBar,
  animated,
  nowMs,
}: TypingActorVisualProps) {
  const densityTokens = DENSITY_TOKENS[density];
  const metaText = useMemo(() => {
    const bits = [
      actor.meta?.channelLabel,
      actor.meta?.pressureLabel,
      actor.meta?.tickLabel,
      actor.meta?.relationshipLabel,
      actor.meta?.voiceprint,
      relativeDuration(nowMs, actor.startedAtMs),
    ]
      .map((item) => normalizeWhitespace(item))
      .filter(Boolean);
    return bits.join(' • ');
  }, [actor, nowMs]);

  return (
    <Fragment>
      {showAvatars ? (
        actor.avatarUrl ? (
          <img alt={actor.name} src={actor.avatarUrl} className={['rounded-full object-cover', densityTokens.avatar].join(' ')} />
        ) : (
          <div
            className={['flex items-center justify-center rounded-full font-semibold text-white', densityTokens.avatar].join(' ')}
            style={{ background: actor.accentColor ?? 'linear-gradient(135deg, rgba(59,130,246,0.6), rgba(16,185,129,0.5))' }}
          >
            {initialsForName(actor.shortName || actor.name)}
          </div>
        )
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className={['truncate font-semibold text-white', densityTokens.title].join(' ')}>
            {actor.isSelf ? labels.youTyping : actor.name}
          </div>

          <span className={['inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium', ROLE_PILL_CLASS[actor.role]].join(' ')}>
            {actor.role}
          </span>

          {actor.isThreat ? (
            <span className="rounded-full border border-rose-400/20 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-200">
              threat
            </span>
          ) : null}
        </div>

        {showIntentText ? (
          <div className={['mt-0.5 truncate text-white/60', densityTokens.meta].join(' ')}>
            {intentLabel(actor.intent, labels)}
          </div>
        ) : null}

        {showMetaText && metaText ? (
          <div className={['mt-0.5 truncate text-white/45', densityTokens.meta].join(' ')}>
            {metaText}
          </div>
        ) : null}

        {showBadges && actor.badges && actor.badges.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {actor.badges.slice(0, maxBadgesPerActor).map((badge) => (
              <span
                key={badge.id}
                className={[
                  'inline-flex items-center rounded-full border font-medium',
                  densityTokens.badge,
                  badgeToneClass(badge),
                ].join(' ')}
              >
                {badge.shortLabel || badge.label}
              </span>
            ))}
          </div>
        ) : null}

        {showConfidenceBar ? (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-cyan-400/70"
              style={{ width: `${Math.round(clamp(coerceFinite(actor.confidence, 0), 0, 1) * 100)}%` }}
            />
          </div>
        ) : null}
      </div>

      <TypingDots
        density={density}
        animated={animated}
        tone={actor.role === 'helper' ? 'helper' : actor.role === 'hater' ? 'threat' : 'default'}
      />
    </Fragment>
  );
});

interface TypingActorRowProps extends TypingActorVisualProps {
  onActorClick?: (actor: TypingActor) => void;
  onActorHover?: (actor: TypingActor | null) => void;
  onOpenProfile?: (actor: TypingActor) => void;
}

const TypingActorRow = memo(function TypingActorRow({
  actor,
  onActorClick,
  onActorHover,
  onOpenProfile,
  ...visualProps
}: TypingActorRowProps) {
  return (
    <button
      type="button"
      className={[
        'group flex w-full items-center border text-left transition',
        DENSITY_TOKENS[visualProps.density].actor,
        actor.role === 'helper'
          ? 'border-emerald-400/12 bg-emerald-500/[0.05] hover:bg-emerald-500/[0.08]'
          : actor.role === 'hater'
            ? 'border-rose-400/12 bg-rose-500/[0.05] hover:bg-rose-500/[0.08]'
            : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]',
      ].join(' ')}
      onClick={() => onActorClick?.(actor)}
      onMouseEnter={() => onActorHover?.(actor)}
      onMouseLeave={() => onActorHover?.(null)}
      onDoubleClick={() => onOpenProfile?.(actor)}
    >
      <TypingActorVisual actor={actor} {...visualProps} />
    </button>
  );
});

function TickerSummary({
  text,
  density,
  animated,
}: {
  text: string;
  density: TypingIndicatorDensity;
  animated: boolean;
}) {
  return (
    <div className={['overflow-hidden rounded-full border border-white/10 bg-white/5', DENSITY_TOKENS[density].dots].join(' ')}>
      <div className={animated ? 'animate-[chatTickerSlide_12s_linear_infinite] whitespace-nowrap px-3 text-[11px] text-white/70' : 'whitespace-nowrap px-3 text-[11px] text-white/70'}>
        {text}
      </div>
    </div>
  );
}

export const ChatTypingIndicator = memo(function ChatTypingIndicator(props: ChatTypingIndicatorProps) {
  const {
    model,
    density = 'comfortable',
    layout = 'inline',
    summaryMode = 'full',
    activeChannelKey = null,
    maxVisibleActors = 4,
    maxBadgesPerActor = 2,
    showAvatars = true,
    showBadges = true,
    showIntentText = true,
    showMetaText = false,
    showConfidenceBar = false,
    showAggregateFallback = true,
    animated = true,
    className,
    ariaLive = 'polite',
    onActorClick,
    onActorHover,
    onOpenProfile,
    renderLeadingSlot,
    renderTrailingSlot,
  } = props;

  const labels = useMemo<TypingIndicatorLabels>(() => ({ ...DEFAULT_LABELS, ...props.labels }), [props.labels]);
  const densityTokens = DENSITY_TOKENS[density];
  const nowMs = useClock(animated);
  const regionId = useId();
  const sortedActors = useMemo(() => buildSortedActors(model.actors ?? [], activeChannelKey), [model.actors, activeChannelKey]);
  const visibleActors = useMemo(() => sortedActors.slice(0, Math.max(1, maxVisibleActors)), [maxVisibleActors, sortedActors]);
  const hiddenCount = Math.max(0, sortedActors.length - visibleActors.length);
  const summaryText = useMemo(() => model.label || summarizeActors(sortedActors, labels, summaryMode, activeChannelKey), [activeChannelKey, labels, sortedActors, summaryMode, model.label]);
  const compactLabel = model.compactLabel || summaryText;
  const meta = useMemo(() => aggregateMeta(sortedActors), [sortedActors]);
  const shouldRenderAggregateOnly = showAggregateFallback && layout === 'pill' && sortedActors.length > maxVisibleActors;
  const regionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!regionRef.current || !animated) return;
    regionRef.current.style.setProperty('--typing-indicator-transition-ms', '180ms');
  }, [animated]);

  if ((model.visible === false) || sortedActors.length === 0) {
    return null;
  }

  return (
    <div
      ref={regionRef}
      id={regionId}
      aria-live={ariaLive}
      className={[
        'w-full border border-white/10 bg-black/25 text-white backdrop-blur-md',
        densityTokens.root,
        className || '',
      ].filter(Boolean).join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {renderLeadingSlot}
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">typing</div>
            {meta.helpers > 0 ? <span className="rounded-full border border-emerald-400/15 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200">{meta.helpers} support</span> : null}
            {meta.threats > 0 ? <span className="rounded-full border border-rose-400/15 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-200">{meta.threats} threat</span> : null}
            {hiddenCount > 0 ? <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/70">+{hiddenCount}</span> : null}
          </div>
          <div className="mt-1 text-sm text-white/78">{summaryText}</div>
          {showConfidenceBar ? (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
              <div className="h-full rounded-full bg-cyan-400/70" style={{ width: `${Math.round(clamp(meta.highestConfidence, 0, 1) * 100)}%` }} />
            </div>
          ) : null}
        </div>
        {renderTrailingSlot}
      </div>

      {shouldRenderAggregateOnly ? (
        <div className="mt-3">
          <TickerSummary text={compactLabel} density={density} animated={animated} />
        </div>
      ) : layout === 'pill' ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {visibleActors.map((actor) => (
            <button
              key={actor.id}
              type="button"
              className={[
                'group flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-left transition',
                actor.role === 'helper'
                  ? 'border-emerald-400/15 bg-emerald-500/10 hover:bg-emerald-500/15'
                  : actor.role === 'hater'
                    ? 'border-rose-400/15 bg-rose-500/10 hover:bg-rose-500/15'
                    : 'border-white/10 bg-white/5 hover:bg-white/[0.08]',
              ].join(' ')}
              onClick={() => onActorClick?.(actor)}
              onMouseEnter={() => onActorHover?.(actor)}
              onMouseLeave={() => onActorHover?.(null)}
              onDoubleClick={() => onOpenProfile?.(actor)}
            >
              {showAvatars ? (
                actor.avatarUrl ? (
                  <img alt={actor.name} src={actor.avatarUrl} className={['rounded-full object-cover', densityTokens.avatar].join(' ')} />
                ) : (
                  <div
                    className={['flex items-center justify-center rounded-full font-semibold text-white', densityTokens.avatar].join(' ')}
                    style={{ background: actor.accentColor ?? 'linear-gradient(135deg, rgba(59,130,246,0.6), rgba(16,185,129,0.5))' }}
                  >
                    {initialsForName(actor.shortName || actor.name)}
                  </div>
                )
              ) : null}
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-white">{actor.isSelf ? labels.youTyping : actor.name}</div>
                <div className="truncate text-[10px] text-white/55">{intentLabel(actor.intent, labels)}</div>
              </div>
              <TypingDots density={density} animated={animated} tone={actor.role === 'helper' ? 'helper' : actor.role === 'hater' ? 'threat' : 'default'} />
            </button>
          ))}
        </div>
      ) : layout === 'ticker' ? (
        <div className="mt-3 flex flex-col gap-2">
          <TickerSummary text={compactLabel} density={density} animated={animated} />
          <div className="grid gap-2">
            {visibleActors.map((actor) => (
              <TypingActorRow
                key={actor.id}
                actor={actor}
                density={density}
                labels={labels}
                maxBadgesPerActor={maxBadgesPerActor}
                showAvatars={showAvatars}
                showBadges={showBadges}
                showIntentText={showIntentText}
                showMetaText={showMetaText}
                showConfidenceBar={showConfidenceBar}
                animated={animated}
                nowMs={nowMs}
                onActorClick={onActorClick}
                onActorHover={onActorHover}
                onOpenProfile={onOpenProfile}
              />
            ))}
          </div>
        </div>
      ) : layout === 'stacked' ? (
        <div className="mt-3 grid gap-2">
          {visibleActors.map((actor) => (
            <TypingActorRow
              key={actor.id}
              actor={actor}
              density={density}
              labels={labels}
              maxBadgesPerActor={maxBadgesPerActor}
              showAvatars={showAvatars}
              showBadges={showBadges}
              showIntentText={showIntentText}
              showMetaText={showMetaText}
              showConfidenceBar={showConfidenceBar}
              animated={animated}
              nowMs={nowMs}
              onActorClick={onActorClick}
              onActorHover={onActorHover}
              onOpenProfile={onOpenProfile}
            />
          ))}
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {visibleActors.map((actor) => (
            <div
              key={actor.id}
              className={[
                'flex items-center border',
                densityTokens.actor,
                actor.role === 'helper'
                  ? 'border-emerald-400/12 bg-emerald-500/[0.05]'
                  : actor.role === 'hater'
                    ? 'border-rose-400/12 bg-rose-500/[0.05]'
                    : 'border-white/10 bg-white/[0.04]',
              ].join(' ')}
            >
              <TypingActorVisual
                actor={actor}
                density={density}
                labels={labels}
                maxBadgesPerActor={maxBadgesPerActor}
                showAvatars={showAvatars}
                showBadges={showBadges}
                showIntentText={showIntentText}
                showMetaText={showMetaText}
                showConfidenceBar={showConfidenceBar}
                animated={animated}
                nowMs={nowMs}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export default ChatTypingIndicator;
