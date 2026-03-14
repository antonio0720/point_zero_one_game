import React, {
  Fragment,
  memo,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

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

export type ChatTypingActorRole =
  | 'player'
  | 'helper'
  | 'hater'
  | 'npc'
  | 'spectator'
  | 'system'
  | 'moderator'
  | 'host';

export type ChatTypingActorIntent =
  | 'replying'
  | 'lurking'
  | 'threatening'
  | 'supporting'
  | 'negotiating'
  | 'narrating'
  | 'thinking'
  | 'reacting'
  | 'none';

export type ChatTypingDensity = 'compact' | 'comfortable' | 'expanded';

export type ChatTypingLayout = 'inline' | 'stacked' | 'pill' | 'ticker';

export type ChatTypingSummaryMode =
  | 'full'
  | 'first-two'
  | 'first-one'
  | 'aggregate'
  | 'channel-first';

export interface ChatTypingBadge {
  id: string;
  label: string;
  shortLabel?: string;
  tone?: 'default' | 'positive' | 'warning' | 'danger' | 'accent' | 'muted';
}

export interface ChatTypingActorMeta {
  channelKey?: string | null;
  channelLabel?: string | null;
  roomId?: string | null;
  roomLabel?: string | null;
  modeLabel?: string | null;
  proofTier?: string | null;
  pressureLabel?: string | null;
  tickLabel?: string | null;
  note?: string | null;
  hoverSummary?: string | null;
  voiceprint?: string | null;
  relationshipLabel?: string | null;
  urgencyLabel?: string | null;
}

export interface ChatTypingActor {
  id: string;
  name: string;
  shortName?: string | null;
  avatarUrl?: string | null;
  accentColor?: string | null;
  role: ChatTypingActorRole;
  intent?: ChatTypingActorIntent;
  isSelf?: boolean;
  isPriority?: boolean;
  isThreat?: boolean;
  isRecommended?: boolean;
  startedAtMs?: number | null;
  expectedStopAtMs?: number | null;
  confidence?: number | null;
  urgency?: number | null;
  badges?: ChatTypingBadge[];
  meta?: ChatTypingActorMeta;
}

export interface ChatTypingIndicatorLabels {
  nobodyTyping: string;
  typing: string;
  andMore: (count: number) => string;
  helperTyping: string;
  threatTyping: string;
  youTyping: string;
  aggregateRoomTyping: (count: number) => string;
  aggregateChannelTyping: (channel: string, count: number) => string;
  uncertainty: string;
  lurking: string;
  thinking: string;
}

export interface ChatTypingIndicatorProps {
  actors: ChatTypingActor[];
  density?: ChatTypingDensity;
  layout?: ChatTypingLayout;
  summaryMode?: ChatTypingSummaryMode;
  activeChannelKey?: string | null;
  maxVisibleActors?: number;
  maxBadgesPerActor?: number;
  showAvatars?: boolean;
  showBadges?: boolean;
  showIntentText?: boolean;
  showMetaText?: boolean;
  showConfidenceBar?: boolean;
  showAggregateFallback?: boolean;
  animated?: boolean;
  className?: string;
  ariaLive?: 'off' | 'polite' | 'assertive';
  labels?: Partial<ChatTypingIndicatorLabels>;
  onActorClick?: (actor: ChatTypingActor) => void;
  onActorHover?: (actor: ChatTypingActor | null) => void;
  onOpenProfile?: (actor: ChatTypingActor) => void;
  renderLeadingSlot?: React.ReactNode;
  renderTrailingSlot?: React.ReactNode;
}

const DEFAULT_LABELS: ChatTypingIndicatorLabels = {
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

const ROLE_WEIGHT: Record<ChatTypingActorRole, number> = {
  system: 0,
  host: 1,
  moderator: 2,
  helper: 3,
  player: 4,
  npc: 5,
  hater: 6,
  spectator: 7,
};

const ROLE_PILL_CLASS: Record<ChatTypingActorRole, string> = {
  player: 'bg-white/10 text-white/85 border-white/10',
  helper: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/20',
  hater: 'bg-rose-500/15 text-rose-200 border-rose-400/20',
  npc: 'bg-sky-500/15 text-sky-200 border-sky-400/20',
  spectator: 'bg-zinc-500/20 text-zinc-300 border-zinc-400/20',
  system: 'bg-cyan-500/15 text-cyan-200 border-cyan-400/20',
  moderator: 'bg-amber-500/15 text-amber-200 border-amber-400/20',
  host: 'bg-violet-500/15 text-violet-200 border-violet-400/20',
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

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function initialsForName(name: string): string {
  const words = normalizeWhitespace(name)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2);
  if (words.length === 0) {
    return '?';
  }
  return words.map((word) => word[0]?.toUpperCase() ?? '').join('') || '?';
}

function roleLabel(role: ChatTypingActorRole): string {
  switch (role) {
    case 'helper':
      return 'Helper';
    case 'hater':
      return 'Threat';
    case 'npc':
      return 'NPC';
    case 'spectator':
      return 'Spectator';
    case 'system':
      return 'System';
    case 'moderator':
      return 'Moderator';
    case 'host':
      return 'Host';
    case 'player':
    default:
      return 'Player';
  }
}

function intentLabel(intent: ChatTypingActorIntent | undefined, labels: ChatTypingIndicatorLabels): string {
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

function compareActors(left: ChatTypingActor, right: ChatTypingActor): number {
  if (left.isPriority !== right.isPriority) {
    return left.isPriority ? -1 : 1;
  }

  if (left.isSelf !== right.isSelf) {
    return left.isSelf ? -1 : 1;
  }

  if (left.isThreat !== right.isThreat) {
    return left.isThreat ? -1 : 1;
  }

  if (left.isRecommended !== right.isRecommended) {
    return left.isRecommended ? -1 : 1;
  }

  const urgencyOrder = coerceFinite(right.urgency) - coerceFinite(left.urgency);
  if (urgencyOrder !== 0) {
    return urgencyOrder;
  }

  const roleOrder = (ROLE_WEIGHT[left.role] ?? 999) - (ROLE_WEIGHT[right.role] ?? 999);
  if (roleOrder !== 0) {
    return roleOrder;
  }

  const confidenceOrder = coerceFinite(right.confidence) - coerceFinite(left.confidence);
  if (confidenceOrder !== 0) {
    return confidenceOrder;
  }

  const startedOrder = coerceFinite(left.startedAtMs, Infinity) - coerceFinite(right.startedAtMs, Infinity);
  if (startedOrder !== 0) {
    return startedOrder;
  }

  return normalizeWhitespace(left.name).localeCompare(normalizeWhitespace(right.name));
}

function channelMatches(actor: ChatTypingActor, activeChannelKey?: string | null): boolean {
  const target = normalizeSearch(activeChannelKey ?? '');
  if (!target) {
    return true;
  }

  const actorChannel = normalizeSearch(actor.meta?.channelKey || actor.meta?.channelLabel || '');
  if (!actorChannel) {
    return true;
  }

  return actorChannel === target;
}

function buildSortedActors(actors: ChatTypingActor[], activeChannelKey?: string | null): ChatTypingActor[] {
  return actors.filter((actor) => channelMatches(actor, activeChannelKey)).sort(compareActors);
}

function relativeDuration(nowMs: number, startedAtMs?: number | null): string | null {
  if (!startedAtMs || !Number.isFinite(startedAtMs)) {
    return null;
  }

  const deltaSec = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
  if (deltaSec < 5) {
    return 'now';
  }
  if (deltaSec < 60) {
    return `${deltaSec}s`;
  }

  const deltaMin = Math.floor(deltaSec / 60);
  if (deltaMin < 60) {
    return `${deltaMin}m`;
  }

  const deltaHr = Math.floor(deltaMin / 60);
  return `${deltaHr}h`;
}

function useClock(enabled: boolean): number {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handle = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(handle);
  }, [enabled]);

  return nowMs;
}

interface TypingDotsProps {
  density: ChatTypingDensity;
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

interface TypingActorVisualProps {
  actor: ChatTypingActor;
  density: ChatTypingDensity;
  labels: ChatTypingIndicatorLabels;
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
  const visibleBadges = safeArray(actor.badges).slice(0, maxBadgesPerActor);
  const overflowBadges = Math.max(0, safeArray(actor.badges).length - visibleBadges.length);
  const durationText = relativeDuration(nowMs, actor.startedAtMs);
  const intentText = intentLabel(actor.intent, labels);
  const channelText = normalizeWhitespace(actor.meta?.channelLabel || actor.meta?.channelKey || '');
  const metaText = [channelText, actor.meta?.pressureLabel || '', actor.meta?.tickLabel || '']
    .map((segment) => normalizeWhitespace(segment))
    .filter(Boolean)
    .join(' • ');
  const confidence = clamp(coerceFinite(actor.confidence, 0.5), 0, 1);

  const dotTone: 'default' | 'helper' | 'threat' = actor.role === 'helper' ? 'helper' : actor.role === 'hater' ? 'threat' : 'default';

  return (
    <div className="flex min-w-0 items-center gap-3">
      {showAvatars ? (
        <div className="relative shrink-0">
          {actor.avatarUrl ? (
            <img
              alt={actor.name}
              src={actor.avatarUrl}
              className={['rounded-full object-cover ring-2', densityTokens.avatar, actor.role === 'helper' ? 'ring-emerald-400/45' : actor.role === 'hater' ? 'ring-rose-400/45' : 'ring-white/10'].join(' ')}
            />
          ) : (
            <div
              className={[
                'flex items-center justify-center rounded-full font-semibold text-white ring-2',
                densityTokens.avatar,
                actor.role === 'helper' ? 'ring-emerald-400/45' : actor.role === 'hater' ? 'ring-rose-400/45' : 'ring-white/10',
              ].join(' ')}
              style={{ background: actor.accentColor ?? 'linear-gradient(135deg, rgba(16,185,129,0.55), rgba(59,130,246,0.55))' }}
            >
              {initialsForName(actor.shortName || actor.name)}
            </div>
          )}
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className={['truncate font-semibold text-white', densityTokens.title].join(' ')}>{actor.isSelf ? labels.youTyping : actor.name}</span>
          <span className={['shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium', ROLE_PILL_CLASS[actor.role]].join(' ')}>
            {roleLabel(actor.role)}
          </span>
          {actor.isThreat ? <span className="shrink-0 rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-medium text-rose-200">threat</span> : null}
          {actor.isRecommended ? <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-200">assist</span> : null}
        </div>

        <div className={['mt-0.5 flex min-w-0 items-center gap-1.5 text-white/55', densityTokens.meta].join(' ')}>
          {showIntentText ? <span className="truncate">{intentText}</span> : null}
          {durationText ? <span className="truncate">• {durationText}</span> : null}
          {actor.meta?.urgencyLabel ? <span className="truncate">• {actor.meta.urgencyLabel}</span> : null}
        </div>

        {showMetaText && metaText ? <div className={['mt-0.5 truncate text-white/40', densityTokens.meta].join(' ')}>{metaText}</div> : null}

        {showConfidenceBar ? (
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/8">
            <div
              className={actor.role === 'helper' ? 'h-full rounded-full bg-emerald-400/70' : actor.role === 'hater' ? 'h-full rounded-full bg-rose-400/70' : 'h-full rounded-full bg-cyan-400/70'}
              style={{ width: `${Math.round(confidence * 100)}%` }}
            />
          </div>
        ) : null}

        {showBadges && (visibleBadges.length > 0 || overflowBadges > 0) ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {visibleBadges.map((badge) => (
              <span key={badge.id} className={['rounded-full border border-white/10 bg-white/5 font-medium text-white/75', densityTokens.badge].join(' ')}>
                {badge.shortLabel || badge.label}
              </span>
            ))}
            {overflowBadges > 0 ? (
              <span className={['rounded-full border border-white/10 bg-white/5 font-medium text-white/60', densityTokens.badge].join(' ')}>
                +{overflowBadges}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <TypingDots density={density} animated={animated} tone={dotTone} />
    </div>
  );
});

interface TypingActorRowProps extends TypingActorVisualProps {
  onActorClick?: (actor: ChatTypingActor) => void;
  onActorHover?: (actor: ChatTypingActor | null) => void;
  onOpenProfile?: (actor: ChatTypingActor) => void;
}

const TypingActorRow = memo(function TypingActorRow({
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
  onActorClick,
  onActorHover,
  onOpenProfile,
}: TypingActorRowProps) {
  const densityTokens = DENSITY_TOKENS[density];

  return (
    <button
      type="button"
      title={normalizeWhitespace(actor.meta?.hoverSummary || actor.meta?.note || '') || undefined}
      className={[
        'flex w-full items-center border text-left transition',
        densityTokens.actor,
        actor.isThreat
          ? 'border-rose-400/12 bg-rose-500/[0.055] hover:bg-rose-500/[0.08]'
          : actor.isRecommended
            ? 'border-emerald-400/12 bg-emerald-500/[0.055] hover:bg-emerald-500/[0.08]'
            : 'border-white/10 bg-white/[0.045] hover:bg-white/[0.07]',
      ].join(' ')}
      onClick={() => onActorClick?.(actor)}
      onMouseEnter={() => onActorHover?.(actor)}
      onMouseLeave={() => onActorHover?.(null)}
      onDoubleClick={() => onOpenProfile?.(actor)}
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
    </button>
  );
});

function summarizeActors(
  actors: ChatTypingActor[],
  labels: ChatTypingIndicatorLabels,
  mode: ChatTypingSummaryMode,
  activeChannelKey?: string | null,
): string {
  if (actors.length === 0) {
    return labels.nobodyTyping;
  }

  const names = actors.map((actor) => (actor.isSelf ? labels.youTyping : actor.name));

  if (mode === 'aggregate') {
    const channel = normalizeWhitespace(activeChannelKey || actors[0]?.meta?.channelLabel || actors[0]?.meta?.channelKey || '');
    return channel ? labels.aggregateChannelTyping(channel, actors.length) : labels.aggregateRoomTyping(actors.length);
  }

  if (mode === 'first-one') {
    if (actors.length === 1) {
      return `${names[0]} ${labels.typing}`;
    }
    return `${names[0]} ${labels.typing}, ${labels.andMore(actors.length - 1)}`;
  }

  if (mode === 'first-two') {
    if (actors.length === 1) {
      return `${names[0]} ${labels.typing}`;
    }
    if (actors.length === 2) {
      return `${names[0]} and ${names[1]} ${labels.typing}`;
    }
    return `${names[0]}, ${names[1]}, ${labels.andMore(actors.length - 2)}`;
  }

  if (mode === 'channel-first') {
    const firstChannel = normalizeWhitespace(actors[0]?.meta?.channelLabel || actors[0]?.meta?.channelKey || '');
    if (firstChannel) {
      return `${firstChannel} • ${labels.aggregateRoomTyping(actors.length)}`;
    }
  }

  if (actors.length === 1) {
    return `${names[0]} ${labels.typing}`;
  }
  if (actors.length === 2) {
    return `${names[0]} and ${names[1]} ${labels.typing}`;
  }

  return `${names[0]}, ${names[1]}, ${labels.andMore(actors.length - 2)}`;
}

function aggregateMeta(actors: ChatTypingActor[]) {
  let helpers = 0;
  let threats = 0;
  let selfTyping = false;
  let highestUrgency = 0;
  let highestConfidence = 0;

  for (const actor of actors) {
    if (actor.role === 'helper') {
      helpers += 1;
    }
    if (actor.role === 'hater') {
      threats += 1;
    }
    if (actor.isSelf) {
      selfTyping = true;
    }
    highestUrgency = Math.max(highestUrgency, coerceFinite(actor.urgency, 0));
    highestConfidence = Math.max(highestConfidence, coerceFinite(actor.confidence, 0));
  }

  return {
    helpers,
    threats,
    selfTyping,
    highestUrgency,
    highestConfidence,
  };
}

const TickerSummary = memo(function TickerSummary({
  text,
  density,
  animated,
}: {
  text: string;
  density: ChatTypingDensity;
  animated: boolean;
}) {
  const densityTokens = DENSITY_TOKENS[density];

  return (
    <div className={['flex min-w-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5', densityTokens.title].join(' ')}>
      <TypingDots density={density} animated={animated} />
      <div className="min-w-0 truncate text-white/80">{text}</div>
    </div>
  );
});

export const ChatTypingIndicator = memo(function ChatTypingIndicator(props: ChatTypingIndicatorProps) {
  const {
    actors,
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

  const labels = useMemo<ChatTypingIndicatorLabels>(() => ({ ...DEFAULT_LABELS, ...props.labels }), [props.labels]);
  const densityTokens = DENSITY_TOKENS[density];
  const nowMs = useClock(animated);
  const regionId = useId();
  const sortedActors = useMemo(() => buildSortedActors(actors, activeChannelKey), [actors, activeChannelKey]);
  const visibleActors = useMemo(() => sortedActors.slice(0, Math.max(1, maxVisibleActors)), [maxVisibleActors, sortedActors]);
  const hiddenCount = Math.max(0, sortedActors.length - visibleActors.length);
  const summaryText = useMemo(() => summarizeActors(sortedActors, labels, summaryMode, activeChannelKey), [activeChannelKey, labels, sortedActors, summaryMode]);
  const meta = useMemo(() => aggregateMeta(sortedActors), [sortedActors]);
  const shouldRenderAggregateOnly = showAggregateFallback && layout === 'pill' && sortedActors.length > maxVisibleActors;
  const regionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!regionRef.current || !animated) {
      return;
    }
    regionRef.current.style.setProperty('--typing-indicator-transition-ms', '180ms');
  }, [animated]);

  if (sortedActors.length === 0) {
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
      ]
        .filter(Boolean)
        .join(' ')}
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
          <TickerSummary text={summaryText} density={density} animated={animated} />
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
          <TickerSummary text={summaryText} density={density} animated={animated} />
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
            <div key={actor.id} className={['flex items-center border', densityTokens.actor, actor.role === 'helper' ? 'border-emerald-400/12 bg-emerald-500/[0.05]' : actor.role === 'hater' ? 'border-rose-400/12 bg-rose-500/[0.05]' : 'border-white/10 bg-white/[0.04]'].join(' ')}>
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
