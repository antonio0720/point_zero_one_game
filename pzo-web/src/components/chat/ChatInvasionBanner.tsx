
/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT UI SHELL
 * FILE: pzo-web/src/components/chat/ChatInvasionBanner.tsx
 * ============================================================================
 *
 * Purpose
 * -------
 * Render-only invasion banner for the unified chat dock.
 *
 * This file is intentionally UI-only. It does not own socket lifecycles,
 * transcript truth, orchestration authority, or learning-policy decisions.
 * It accepts already-computed state from the frontend chat engine and renders:
 *
 * - active invasion / raid / breach / pressure scenes
 * - escalating countdown windows
 * - attacker / helper / crowd witness summaries
 * - tactical urgency bars and threat slices
 * - mode-aware visual treatments
 * - compact, expanded, cinematic, and embedded variants
 * - action affordances passed in from parents
 * - accessibility, keyboard, and reduced-motion behavior
 *
 * Architectural Position
 * ----------------------
 * The repo direction places chat rendering under:
 *   /pzo-web/src/components/chat
 *
 * while chat runtime authority lives under:
 *   /pzo-web/src/engines/chat
 *
 * This file follows that rule. It consumes props from the engine and does not
 * silently recreate engine logic inside the presentation layer.
 *
 * Design Doctrine
 * ---------------
 * 1. Render-only.
 * 2. Zero direct store ownership.
 * 3. Zero direct socket ownership.
 * 4. Zero direct battle-engine ownership.
 * 5. Prop-driven, mode-aware, highly legible.
 * 6. Fast to mount, easy to memoize, tolerant of partial data.
 * 7. Supports the “chat as emotional operating system” direction without
 *    becoming a second runtime brain.
 * ============================================================================
 */

import React, {
  Fragment,
  memo,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

export type ChatBannerVariant =
  | 'compact'
  | 'standard'
  | 'cinematic'
  | 'embedded'
  | 'minimal';

export type ChatBannerTone =
  | 'neutral'
  | 'warning'
  | 'danger'
  | 'critical'
  | 'rescue'
  | 'legend'
  | 'shadow';

export type ChatModeKey =
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

export type ChatInvasionStage =
  | 'queued'
  | 'telegraph'
  | 'assembling'
  | 'breach'
  | 'surge'
  | 'counter-window'
  | 'suppressed'
  | 'repelled'
  | 'aftermath';

export type ChatInvasionSeverity =
  | 'trace'
  | 'low'
  | 'elevated'
  | 'high'
  | 'severe'
  | 'catastrophic';

export type ChatInvasionOrigin =
  | 'hater'
  | 'npc'
  | 'crowd'
  | 'syndicate'
  | 'market'
  | 'liveops'
  | 'system'
  | 'unknown';

export type ChatInvasionActionIntent =
  | 'open-chat'
  | 'focus-channel'
  | 'counter'
  | 'shield'
  | 'mute-crowd'
  | 'request-help'
  | 'dismiss'
  | 'expand'
  | 'collapse'
  | 'view-proof'
  | 'custom';

export interface ChatInvasionActorChip {
  id: string;
  name: string;
  role:
    | 'attacker'
    | 'helper'
    | 'witness'
    | 'target'
    | 'commander'
    | 'crowd'
    | 'system';
  accentLabel?: string;
  heat?: number | null;
  confidence?: number | null;
  iconText?: string | null;
  isTyping?: boolean;
  isSpeaking?: boolean;
  isSuppressed?: boolean;
  isHighlighted?: boolean;
  colorHint?: string | null;
}

export interface ChatInvasionChannelImpact {
  channelId: string;
  label: string;
  trafficDelta?: number | null;
  hostilityDelta?: number | null;
  witnessCount?: number | null;
  lockState?: 'open' | 'slow' | 'restricted' | 'muted' | 'frozen';
  isPrimary?: boolean;
}

export interface ChatInvasionCountdown {
  label: string;
  remainingMs: number;
  totalMs: number;
  startedAtMs?: number | null;
  expiresAtMs?: number | null;
  pulseAtPct?: number | null;
}

export interface ChatInvasionMetric {
  id: string;
  label: string;
  value: number;
  max?: number;
  tone?: ChatBannerTone;
  display?: string;
  hint?: string;
}

export interface ChatInvasionAction {
  id: string;
  label: string;
  intent: ChatInvasionActionIntent;
  priority?: 'primary' | 'secondary' | 'tertiary';
  disabled?: boolean;
  destructive?: boolean;
  requiresConfirm?: boolean;
  hotkey?: string | null;
  badge?: string | null;
  ariaLabel?: string;
}

export interface ChatInvasionNarrativeLine {
  id: string;
  speaker?: string | null;
  text: string;
  emphasis?: 'none' | 'low' | 'medium' | 'high';
  kind?: 'system' | 'threat' | 'helper' | 'crowd' | 'intel' | 'memory';
}

export interface ChatInvasionScene {
  invasionId: string;
  title: string;
  subtitle?: string | null;
  summary?: string | null;
  stage: ChatInvasionStage;
  severity: ChatInvasionSeverity;
  tone?: ChatBannerTone;
  origin?: ChatInvasionOrigin;
  mode?: ChatModeKey;
  active?: boolean;
  acknowledged?: boolean;
  canDismiss?: boolean;
  canExpand?: boolean;
  canCollapse?: boolean;
  isShadowBacked?: boolean;
  isLiveOps?: boolean;
  isRescueEligible?: boolean;
  pressurePct?: number | null;
  hostilityPct?: number | null;
  disruptionPct?: number | null;
  rescuePct?: number | null;
  confidencePct?: number | null;
  crowdHeatPct?: number | null;
  escalationScore?: number | null;
  confidenceScore?: number | null;
  priorityScore?: number | null;
  proofLabel?: string | null;
  proofHash?: string | null;
  sourceLabel?: string | null;
  witnessCount?: number | null;
  unreadCount?: number | null;
  modeLabel?: string | null;
  locationLabel?: string | null;
  countdown?: ChatInvasionCountdown | null;
  actions?: ChatInvasionAction[];
  metrics?: ChatInvasionMetric[];
  actors?: ChatInvasionActorChip[];
  channelImpacts?: ChatInvasionChannelImpact[];
  lines?: ChatInvasionNarrativeLine[];
  tags?: string[];
  startedAtMs?: number | null;
  updatedAtMs?: number | null;
  endedAtMs?: number | null;
}

export interface ChatInvasionBannerProps {
  invasion: ChatInvasionScene | null | undefined;
  variant?: ChatBannerVariant;
  className?: string;
  style?: React.CSSProperties;
  nowMs?: number;
  reducedMotion?: boolean;
  elevated?: boolean;
  bordered?: boolean;
  translucent?: boolean;
  showModeBadge?: boolean;
  showProof?: boolean;
  showActors?: boolean;
  showChannelImpact?: boolean;
  showNarrative?: boolean;
  showMetrics?: boolean;
  showActions?: boolean;
  showDismiss?: boolean;
  showCountdown?: boolean;
  showPulseRail?: boolean;
  collapsibleNarrative?: boolean;
  defaultNarrativeExpanded?: boolean;
  maxVisibleActors?: number;
  maxVisibleMetrics?: number;
  maxVisibleNarrativeLines?: number;
  maxVisibleChannelImpacts?: number;
  onAction?: (action: ChatInvasionAction, invasion: ChatInvasionScene) => void;
  onDismiss?: (invasion: ChatInvasionScene) => void;
  onExpand?: (invasion: ChatInvasionScene) => void;
  onCollapse?: (invasion: ChatInvasionScene) => void;
  onProofClick?: (invasion: ChatInvasionScene) => void;
  onActorClick?: (actor: ChatInvasionActorChip, invasion: ChatInvasionScene) => void;
  onChannelClick?: (
    impact: ChatInvasionChannelImpact,
    invasion: ChatInvasionScene,
  ) => void;
  emptyStateLabel?: string;
  ['data-testid']?: string;
}

type ToneTokens = {
  border: string;
  bg: string;
  bgSoft: string;
  text: string;
  textSoft: string;
  badge: string;
  glow: string;
  rail: string;
  fill: string;
  surface: string;
};

const TONE_TOKENS: Record<ChatBannerTone, ToneTokens> = {
  neutral: {
    border: 'border-slate-700/80',
    bg: 'bg-slate-950/95',
    bgSoft: 'bg-slate-900/70',
    text: 'text-slate-100',
    textSoft: 'text-slate-300',
    badge: 'bg-slate-800 text-slate-200 border-slate-700/80',
    glow: 'shadow-[0_0_0_1px_rgba(148,163,184,0.15),0_16px_40px_rgba(2,6,23,0.45)]',
    rail: 'bg-slate-800/80',
    fill: 'bg-slate-400',
    surface: 'bg-slate-900/75',
  },
  warning: {
    border: 'border-amber-500/45',
    bg: 'bg-zinc-950/95',
    bgSoft: 'bg-amber-950/35',
    text: 'text-amber-50',
    textSoft: 'text-amber-200',
    badge: 'bg-amber-500/15 text-amber-100 border-amber-400/35',
    glow: 'shadow-[0_0_0_1px_rgba(245,158,11,0.18),0_18px_48px_rgba(120,53,15,0.28)]',
    rail: 'bg-amber-950/50',
    fill: 'bg-amber-400',
    surface: 'bg-amber-950/20',
  },
  danger: {
    border: 'border-orange-500/45',
    bg: 'bg-zinc-950/95',
    bgSoft: 'bg-orange-950/35',
    text: 'text-orange-50',
    textSoft: 'text-orange-200',
    badge: 'bg-orange-500/15 text-orange-100 border-orange-400/35',
    glow: 'shadow-[0_0_0_1px_rgba(249,115,22,0.18),0_18px_48px_rgba(124,45,18,0.3)]',
    rail: 'bg-orange-950/50',
    fill: 'bg-orange-400',
    surface: 'bg-orange-950/20',
  },
  critical: {
    border: 'border-red-500/55',
    bg: 'bg-zinc-950/95',
    bgSoft: 'bg-red-950/40',
    text: 'text-red-50',
    textSoft: 'text-red-200',
    badge: 'bg-red-500/15 text-red-100 border-red-400/40',
    glow: 'shadow-[0_0_0_1px_rgba(239,68,68,0.22),0_22px_58px_rgba(127,29,29,0.34)]',
    rail: 'bg-red-950/55',
    fill: 'bg-red-500',
    surface: 'bg-red-950/22',
  },
  rescue: {
    border: 'border-emerald-500/45',
    bg: 'bg-zinc-950/95',
    bgSoft: 'bg-emerald-950/35',
    text: 'text-emerald-50',
    textSoft: 'text-emerald-200',
    badge: 'bg-emerald-500/15 text-emerald-100 border-emerald-400/35',
    glow: 'shadow-[0_0_0_1px_rgba(16,185,129,0.18),0_18px_48px_rgba(6,95,70,0.3)]',
    rail: 'bg-emerald-950/55',
    fill: 'bg-emerald-400',
    surface: 'bg-emerald-950/20',
  },
  legend: {
    border: 'border-fuchsia-500/45',
    bg: 'bg-zinc-950/95',
    bgSoft: 'bg-fuchsia-950/35',
    text: 'text-fuchsia-50',
    textSoft: 'text-fuchsia-200',
    badge: 'bg-fuchsia-500/15 text-fuchsia-100 border-fuchsia-400/35',
    glow: 'shadow-[0_0_0_1px_rgba(217,70,239,0.18),0_18px_48px_rgba(112,26,117,0.3)]',
    rail: 'bg-fuchsia-950/55',
    fill: 'bg-fuchsia-400',
    surface: 'bg-fuchsia-950/20',
  },
  shadow: {
    border: 'border-violet-500/38',
    bg: 'bg-zinc-950/95',
    bgSoft: 'bg-violet-950/35',
    text: 'text-violet-50',
    textSoft: 'text-violet-200',
    badge: 'bg-violet-500/15 text-violet-100 border-violet-400/35',
    glow: 'shadow-[0_0_0_1px_rgba(139,92,246,0.18),0_18px_48px_rgba(76,29,149,0.3)]',
    rail: 'bg-violet-950/55',
    fill: 'bg-violet-400',
    surface: 'bg-violet-950/20',
  },
};

const VARIANT_TOKENS: Record<
  ChatBannerVariant,
  {
    root: string;
    title: string;
    subtitle: string;
    compactGap: string;
    lineClampSummary: string;
    actionSize: string;
    badgeSize: string;
    metricCols: string;
  }
> = {
  minimal: {
    root: 'rounded-xl p-3 gap-2',
    title: 'text-sm font-semibold tracking-tight',
    subtitle: 'text-[11px]',
    compactGap: 'gap-2',
    lineClampSummary: 'line-clamp-2',
    actionSize: 'px-2.5 py-1.5 text-[11px]',
    badgeSize: 'text-[10px] px-2 py-1',
    metricCols: 'grid-cols-2',
  },
  compact: {
    root: 'rounded-2xl p-3.5 gap-3',
    title: 'text-base font-semibold tracking-tight',
    subtitle: 'text-xs',
    compactGap: 'gap-2.5',
    lineClampSummary: 'line-clamp-2',
    actionSize: 'px-2.5 py-1.5 text-xs',
    badgeSize: 'text-[10px] px-2 py-1',
    metricCols: 'grid-cols-2',
  },
  standard: {
    root: 'rounded-2xl p-4 gap-3.5',
    title: 'text-lg font-semibold tracking-tight',
    subtitle: 'text-sm',
    compactGap: 'gap-3',
    lineClampSummary: 'line-clamp-3',
    actionSize: 'px-3 py-2 text-sm',
    badgeSize: 'text-[11px] px-2.5 py-1',
    metricCols: 'grid-cols-2 md:grid-cols-4',
  },
  embedded: {
    root: 'rounded-2xl p-4 gap-3',
    title: 'text-base font-semibold tracking-tight',
    subtitle: 'text-xs',
    compactGap: 'gap-2.5',
    lineClampSummary: 'line-clamp-3',
    actionSize: 'px-3 py-2 text-sm',
    badgeSize: 'text-[10px] px-2 py-1',
    metricCols: 'grid-cols-2 md:grid-cols-3',
  },
  cinematic: {
    root: 'rounded-[1.4rem] p-5 gap-4',
    title: 'text-xl font-semibold tracking-tight',
    subtitle: 'text-sm',
    compactGap: 'gap-3.5',
    lineClampSummary: 'line-clamp-4',
    actionSize: 'px-3.5 py-2.5 text-sm',
    badgeSize: 'text-xs px-2.5 py-1',
    metricCols: 'grid-cols-2 md:grid-cols-4',
  },
};

const STAGE_LABEL: Record<ChatInvasionStage, string> = {
  queued: 'Queued',
  telegraph: 'Telegraph',
  assembling: 'Assembling',
  breach: 'Breach',
  surge: 'Surge',
  'counter-window': 'Counter Window',
  suppressed: 'Suppressed',
  repelled: 'Repelled',
  aftermath: 'Aftermath',
};

const SEVERITY_LABEL: Record<ChatInvasionSeverity, string> = {
  trace: 'Trace',
  low: 'Low',
  elevated: 'Elevated',
  high: 'High',
  severe: 'Severe',
  catastrophic: 'Catastrophic',
};

const ORIGIN_LABEL: Record<ChatInvasionOrigin, string> = {
  hater: 'Hater',
  npc: 'NPC',
  crowd: 'Crowd',
  syndicate: 'Syndicate',
  market: 'Market',
  liveops: 'LiveOps',
  system: 'System',
  unknown: 'Unknown',
};

const MODE_LABEL: Record<ChatModeKey, string> = {
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

function clamp01(value: number | null | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, Number(value)));
}

function asPct(value: number | null | undefined): number {
  if (!Number.isFinite(value)) return 0;
  const n = Number(value);
  return n > 1 ? Math.max(0, Math.min(100, n)) : Math.round(clamp01(n) * 100);
}

function resolveTone(invasion: ChatInvasionScene): ChatBannerTone {
  if (invasion.tone) return invasion.tone;
  if (invasion.isRescueEligible && invasion.stage !== 'repelled') return 'rescue';
  switch (invasion.severity) {
    case 'trace':
      return invasion.isShadowBacked ? 'shadow' : 'neutral';
    case 'low':
      return 'warning';
    case 'elevated':
      return 'warning';
    case 'high':
      return 'danger';
    case 'severe':
      return 'critical';
    case 'catastrophic':
      return invasion.isLiveOps ? 'legend' : 'critical';
    default:
      return 'neutral';
  }
}

function formatCount(value: number | null | undefined, fallback = '—'): string {
  if (!Number.isFinite(value)) return fallback;
  const n = Number(value);
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `${Math.round(n)}`;
}

function formatPct(value: number | null | undefined, fallback = '—'): string {
  if (!Number.isFinite(value)) return fallback;
  return `${asPct(value)}%`;
}

function formatSignedPct(value: number | null | undefined, fallback = '—'): string {
  if (!Number.isFinite(value)) return fallback;
  const pct = asPct(value);
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

function formatClock(ms: number | null | undefined): string {
  if (!Number.isFinite(ms)) return '00:00';
  const safe = Math.max(0, Math.floor(Number(ms)));
  const totalSeconds = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remMinutes = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(remMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

function chipTone(role: ChatInvasionActorChip['role']): string {
  switch (role) {
    case 'attacker':
      return 'border-red-500/35 bg-red-500/10 text-red-100';
    case 'helper':
      return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100';
    case 'witness':
      return 'border-sky-500/35 bg-sky-500/10 text-sky-100';
    case 'target':
      return 'border-amber-500/35 bg-amber-500/10 text-amber-100';
    case 'commander':
      return 'border-fuchsia-500/35 bg-fuchsia-500/10 text-fuchsia-100';
    case 'crowd':
      return 'border-violet-500/35 bg-violet-500/10 text-violet-100';
    case 'system':
    default:
      return 'border-slate-600/80 bg-slate-800/70 text-slate-100';
  }
}

function lockLabel(lockState: ChatInvasionChannelImpact['lockState']): string {
  switch (lockState) {
    case 'open':
      return 'Open';
    case 'slow':
      return 'Slow';
    case 'restricted':
      return 'Restricted';
    case 'muted':
      return 'Muted';
    case 'frozen':
      return 'Frozen';
    default:
      return 'Unknown';
  }
}

function percentBarTone(tone: ChatBannerTone): string {
  return TONE_TOKENS[tone].fill;
}

function inferDominantMessage(invasion: ChatInvasionScene): string {
  if (invasion.summary) return invasion.summary;
  switch (invasion.stage) {
    case 'queued':
      return 'A hostile chat event has been queued but has not yet broken surface.';
    case 'telegraph':
      return 'The scene is broadcasting warning signatures. The player still has time to reposition.';
    case 'assembling':
      return 'Hostile voices are gathering, witness traffic is building, and pressure is starting to cohere.';
    case 'breach':
      return 'The invasion has broken through. Attention is fragmented and the crowd has a clear line of sight.';
    case 'surge':
      return 'Hostility is compounding faster than normal. This is the moment where theatrics can become collapse.';
    case 'counter-window':
      return 'The hostile scene is still active, but a narrow counter window has opened.';
    case 'suppressed':
      return 'The scene is suppressed for now, but not yet fully resolved.';
    case 'repelled':
      return 'The active invasion was repelled. The audience will remember who held the line.';
    case 'aftermath':
      return 'The attack wave is over, but memory, reputation, and narrative residue remain.';
    default:
      return 'Active invasion state.';
  }
}

function computeProgress(countdown: ChatInvasionCountdown | null | undefined): number {
  if (!countdown || !Number.isFinite(countdown.totalMs) || countdown.totalMs <= 0) {
    return 0;
  }
  const remaining = Math.max(0, countdown.remainingMs);
  const total = Math.max(1, countdown.totalMs);
  return Math.max(0, Math.min(100, Math.round(((total - remaining) / total) * 100)));
}

function useLiveCountdown(
  countdown: ChatInvasionCountdown | null | undefined,
  nowMs?: number,
): number {
  const [tickNow, setTickNow] = useState<number>(nowMs ?? Date.now());

  useEffect(() => {
    if (typeof nowMs === 'number') {
      setTickNow(nowMs);
      return;
    }
    if (!countdown || countdown.remainingMs <= 0) return;

    const timer = window.setInterval(() => {
      setTickNow(Date.now());
    }, 250);

    return () => window.clearInterval(timer);
  }, [countdown, nowMs]);

  const computed = useMemo(() => {
    if (!countdown) return 0;
    if (typeof nowMs === 'number') return Math.max(0, countdown.remainingMs);
    if (Number.isFinite(countdown.expiresAtMs)) {
      return Math.max(0, Number(countdown.expiresAtMs) - tickNow);
    }
    return Math.max(0, countdown.remainingMs);
  }, [countdown, nowMs, tickNow]);

  return computed;
}

const SectionLabel = memo(function SectionLabel({
  children,
  right,
  tone,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
  tone: ChatBannerTone;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className={cx('text-[11px] uppercase tracking-[0.2em]', TONE_TOKENS[tone].textSoft)}>
        {children}
      </div>
      {right ? <div className="text-[11px] text-slate-400">{right}</div> : null}
    </div>
  );
});

const MiniPill = memo(function MiniPill({
  label,
  tone,
  variant,
}: {
  label: string;
  tone: ChatBannerTone;
  variant: ChatBannerVariant;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border font-medium',
        TONE_TOKENS[tone].badge,
        VARIANT_TOKENS[variant].badgeSize,
      )}
    >
      {label}
    </span>
  );
});

const Rail = memo(function Rail({
  value,
  tone,
  className,
}: {
  value: number | null | undefined;
  tone: ChatBannerTone;
  className?: string;
}) {
  const safe = Math.max(0, Math.min(100, Number.isFinite(value) ? Number(value) : 0));
  return (
    <div className={cx('h-2 overflow-hidden rounded-full', TONE_TOKENS[tone].rail, className)}>
      <div
        className={cx('h-full rounded-full transition-[width] duration-300', percentBarTone(tone))}
        style={{ width: `${safe}%` }}
      />
    </div>
  );
});

const ActionButton = memo(function ActionButton({
  action,
  invasion,
  onAction,
  variant,
}: {
  action: ChatInvasionAction;
  invasion: ChatInvasionScene;
  onAction?: (action: ChatInvasionAction, invasion: ChatInvasionScene) => void;
  variant: ChatBannerVariant;
}) {
  const base =
    action.priority === 'primary'
      ? 'border-white/10 bg-white text-slate-900 hover:bg-white/90'
      : action.destructive
        ? 'border-red-500/35 bg-red-500/12 text-red-100 hover:bg-red-500/18'
        : 'border-slate-700/80 bg-slate-900/70 text-slate-100 hover:bg-slate-800/80';

  return (
    <button
      type="button"
      aria-label={action.ariaLabel ?? action.label}
      disabled={action.disabled}
      onClick={() => onAction?.(action, invasion)}
      className={cx(
        'inline-flex items-center gap-2 rounded-xl border font-medium transition disabled:cursor-not-allowed disabled:opacity-45',
        base,
        VARIANT_TOKENS[variant].actionSize,
      )}
    >
      <span>{action.label}</span>
      {action.badge ? (
        <span className="rounded-full bg-black/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
          {action.badge}
        </span>
      ) : null}
      {action.hotkey ? (
        <span className="rounded-md border border-black/10 bg-black/10 px-1.5 py-0.5 text-[10px]">
          {action.hotkey}
        </span>
      ) : null}
    </button>
  );
});

const ActorChip = memo(function ActorChip({
  actor,
  invasion,
  onActorClick,
}: {
  actor: ChatInvasionActorChip;
  invasion: ChatInvasionScene;
  onActorClick?: (actor: ChatInvasionActorChip, invasion: ChatInvasionScene) => void;
}) {
  const icon =
    actor.iconText ||
    (actor.role === 'attacker'
      ? '⚠'
      : actor.role === 'helper'
        ? '✦'
        : actor.role === 'commander'
          ? '◆'
          : actor.role === 'crowd'
            ? '◉'
            : actor.role === 'system'
              ? '■'
              : '•');

  return (
    <button
      type="button"
      onClick={() => onActorClick?.(actor, invasion)}
      className={cx(
        'inline-flex min-w-0 items-center gap-2 rounded-full border px-2.5 py-1.5 text-left transition hover:brightness-110',
        chipTone(actor.role),
        actor.isHighlighted && 'ring-1 ring-white/20',
      )}
    >
      <span className="text-xs">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold">{actor.name}</span>
        <span className="block truncate text-[10px] opacity-80">
          {actor.accentLabel ?? actor.role}
          {actor.isTyping ? ' • typing' : ''}
          {actor.isSpeaking ? ' • live' : ''}
          {actor.isSuppressed ? ' • suppressed' : ''}
        </span>
      </span>
    </button>
  );
});

const ChannelImpactRow = memo(function ChannelImpactRow({
  impact,
  invasion,
  onChannelClick,
}: {
  impact: ChatInvasionChannelImpact;
  invasion: ChatInvasionScene;
  onChannelClick?: (
    impact: ChatInvasionChannelImpact,
    invasion: ChatInvasionScene,
  ) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChannelClick?.(impact, invasion)}
      className={cx(
        'flex w-full items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/55 px-3 py-2 text-left transition hover:border-slate-700 hover:bg-slate-900/70',
        impact.isPrimary && 'ring-1 ring-white/10',
      )}
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-slate-100">{impact.label}</div>
        <div className="truncate text-[11px] text-slate-400">
          {lockLabel(impact.lockState)} • traffic {formatSignedPct(impact.trafficDelta)}
          {' • '}hostility {formatSignedPct(impact.hostilityDelta)}
        </div>
      </div>
      <div className="text-right text-[11px] text-slate-300">
        <div>{formatCount(impact.witnessCount)} witnesses</div>
        {impact.isPrimary ? <div className="text-slate-400">primary</div> : null}
      </div>
    </button>
  );
});

const NarrativeLine = memo(function NarrativeLine({
  line,
}: {
  line: ChatInvasionNarrativeLine;
}) {
  const tone =
    line.kind === 'threat'
      ? 'text-red-100'
      : line.kind === 'helper'
        ? 'text-emerald-100'
        : line.kind === 'crowd'
          ? 'text-violet-100'
          : line.kind === 'intel'
            ? 'text-sky-100'
            : line.kind === 'memory'
              ? 'text-fuchsia-100'
              : 'text-slate-100';

  const emphasis =
    line.emphasis === 'high'
      ? 'font-semibold'
      : line.emphasis === 'medium'
        ? 'font-medium'
        : 'font-normal';

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2.5">
      <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
        <span>{line.speaker ?? line.kind ?? 'system'}</span>
      </div>
      <p className={cx('text-sm leading-6', tone, emphasis)}>{line.text}</p>
    </div>
  );
});

const MetricCard = memo(function MetricCard({
  metric,
  fallbackTone,
}: {
  metric: ChatInvasionMetric;
  fallbackTone: ChatBannerTone;
}) {
  const tone = metric.tone ?? fallbackTone;
  const safeMax = Number.isFinite(metric.max) && Number(metric.max) > 0 ? Number(metric.max) : 100;
  const percent = Math.max(0, Math.min(100, Math.round((metric.value / safeMax) * 100)));

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-xs uppercase tracking-[0.16em] text-slate-500">
            {metric.label}
          </div>
          {metric.hint ? (
            <div className="mt-1 text-[11px] leading-5 text-slate-400">{metric.hint}</div>
          ) : null}
        </div>
        <div className={cx('text-sm font-semibold', TONE_TOKENS[tone].text)}>
          {metric.display ?? formatPct(percent)}
        </div>
      </div>
      <Rail value={percent} tone={tone} />
    </div>
  );
});

const EmptyBanner = memo(function EmptyBanner({
  label,
  variant,
  className,
}: {
  label: string;
  variant: ChatBannerVariant;
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
      <div className="text-sm">No active chat invasion.</div>
    </div>
  );
});

function InvasionBannerInner({
  invasion,
  variant = 'standard',
  className,
  style,
  nowMs,
  reducedMotion = false,
  elevated = true,
  bordered = true,
  translucent = true,
  showModeBadge = true,
  showProof = true,
  showActors = true,
  showChannelImpact = true,
  showNarrative = true,
  showMetrics = true,
  showActions = true,
  showDismiss = true,
  showCountdown = true,
  showPulseRail = true,
  collapsibleNarrative = true,
  defaultNarrativeExpanded = false,
  maxVisibleActors = 6,
  maxVisibleMetrics = 8,
  maxVisibleNarrativeLines = 4,
  maxVisibleChannelImpacts = 4,
  onAction,
  onDismiss,
  onExpand,
  onCollapse,
  onProofClick,
  onActorClick,
  onChannelClick,
  emptyStateLabel = 'No active invasion.',
  ['data-testid']: dataTestId,
}: ChatInvasionBannerProps) {
  const regionId = useId();
  const tone = invasion ? resolveTone(invasion) : 'neutral';
  const tokens = TONE_TOKENS[tone];
  const variantTokens = VARIANT_TOKENS[variant];
  const [narrativeExpanded, setNarrativeExpanded] = useState(defaultNarrativeExpanded);
  const countdownRemaining = useLiveCountdown(invasion?.countdown, nowMs);
  const countdownProgress = computeProgress(
    invasion?.countdown ? { ...invasion.countdown, remainingMs: countdownRemaining } : null,
  );
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    setNarrativeExpanded(defaultNarrativeExpanded);
  }, [invasion?.invasionId, defaultNarrativeExpanded]);

  const visibleActors = useMemo(
    () => (invasion?.actors ?? []).slice(0, Math.max(0, maxVisibleActors)),
    [invasion?.actors, maxVisibleActors],
  );
  const hiddenActors = Math.max(0, (invasion?.actors?.length ?? 0) - visibleActors.length);

  const visibleMetrics = useMemo(
    () => (invasion?.metrics ?? []).slice(0, Math.max(0, maxVisibleMetrics)),
    [invasion?.metrics, maxVisibleMetrics],
  );
  const visibleChannelImpacts = useMemo(
    () => (invasion?.channelImpacts ?? []).slice(0, Math.max(0, maxVisibleChannelImpacts)),
    [invasion?.channelImpacts, maxVisibleChannelImpacts],
  );
  const hiddenChannelImpacts = Math.max(
    0,
    (invasion?.channelImpacts?.length ?? 0) - visibleChannelImpacts.length,
  );

  const allNarrative = invasion?.lines ?? [];
  const narrativeLines = useMemo(() => {
    if (narrativeExpanded || !collapsibleNarrative) return allNarrative;
    return allNarrative.slice(0, Math.max(0, maxVisibleNarrativeLines));
  }, [allNarrative, collapsibleNarrative, maxVisibleNarrativeLines, narrativeExpanded]);

  if (!invasion) {
    return <EmptyBanner label={emptyStateLabel} variant={variant} className={className} />;
  }

  const summary = inferDominantMessage(invasion);
  const stageLabel = STAGE_LABEL[invasion.stage];
  const severityLabel = SEVERITY_LABEL[invasion.severity];
  const originLabel = ORIGIN_LABEL[invasion.origin ?? 'unknown'];
  const modeLabel = invasion.modeLabel || MODE_LABEL[invasion.mode ?? 'unknown'];

  return (
    <section
      data-testid={dataTestId}
      aria-labelledby={`${regionId}-title`}
      aria-live={invasion.stage === 'breach' || invasion.stage === 'surge' ? 'polite' : 'off'}
      className={cx(
        'relative overflow-hidden',
        translucent ? tokens.bg : 'bg-zinc-950',
        bordered && 'border',
        bordered && tokens.border,
        elevated && tokens.glow,
        variantTokens.root,
        className,
      )}
      style={style}
    >
      <div
        className={cx(
          'pointer-events-none absolute inset-0 opacity-80',
          reducedMotion ? '' : 'transition-opacity duration-500',
        )}
      >
        <div className={cx('absolute inset-x-0 top-0 h-20 blur-3xl', tokens.bgSoft)} />
      </div>

      <div className="relative flex flex-col gap-3">
        <div className={cx('flex items-start justify-between', variantTokens.compactGap)}>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <MiniPill label={stageLabel} tone={tone} variant={variant} />
              <MiniPill label={severityLabel} tone={tone} variant={variant} />
              <MiniPill label={originLabel} tone={tone} variant={variant} />
              {showModeBadge ? <MiniPill label={modeLabel} tone={tone} variant={variant} /> : null}
              {invasion.isLiveOps ? <MiniPill label="LiveOps" tone="legend" variant={variant} /> : null}
              {invasion.isShadowBacked ? <MiniPill label="Shadow" tone="shadow" variant={variant} /> : null}
              {invasion.isRescueEligible ? (
                <MiniPill label="Rescue Eligible" tone="rescue" variant={variant} />
              ) : null}
            </div>

            <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
              <div className="min-w-0 flex-1">
                <h3 id={`${regionId}-title`} className={cx(variantTokens.title, tokens.text)}>
                  {invasion.title}
                </h3>
                {invasion.subtitle ? (
                  <div className={cx('mt-1 leading-6', variantTokens.subtitle, tokens.textSoft)}>
                    {invasion.subtitle}
                  </div>
                ) : null}
              </div>

              <div className="grid min-w-[180px] grid-cols-2 gap-2 text-right">
                <StatPill label="Witnesses" value={formatCount(invasion.witnessCount)} tone={tone} />
                <StatPill label="Unread" value={formatCount(invasion.unreadCount)} tone={tone} />
                <StatPill
                  label="Priority"
                  value={formatPct(invasion.priorityScore)}
                  tone={tone}
                />
                <StatPill
                  label="Escalation"
                  value={formatPct(invasion.escalationScore)}
                  tone={tone}
                />
              </div>
            </div>

            <p className={cx('mt-3 max-w-4xl text-sm leading-6', tokens.textSoft, variantTokens.lineClampSummary)}>
              {summary}
            </p>
          </div>

          <div className="ml-3 flex shrink-0 flex-col items-end gap-2">
            {showProof && invasion.proofHash ? (
              <button
                type="button"
                onClick={() => onProofClick?.(invasion)}
                className="rounded-xl border border-slate-700/80 bg-slate-950/65 px-3 py-2 text-right transition hover:border-slate-600 hover:bg-slate-900/80"
              >
                <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Proof</div>
                <div className="max-w-[180px] truncate text-xs font-medium text-slate-100">
                  {invasion.proofLabel ?? invasion.proofHash}
                </div>
              </button>
            ) : null}

            {showDismiss && invasion.canDismiss ? (
              <button
                type="button"
                onClick={() => onDismiss?.(invasion)}
                className="rounded-xl border border-slate-700/80 bg-slate-950/60 px-3 py-2 text-xs text-slate-200 transition hover:bg-slate-900/80"
              >
                Dismiss
              </button>
            ) : null}
          </div>
        </div>

        {showCountdown && invasion.countdown ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-3">
            <SectionLabel
              tone={tone}
              right={
                <span className="font-medium text-slate-300">
                  {formatClock(countdownRemaining)}
                </span>
              }
            >
              {invasion.countdown.label}
            </SectionLabel>
            <div className="mt-2 flex items-center gap-3">
              <div className="min-w-[5rem] text-lg font-semibold tracking-tight text-slate-100">
                {formatClock(countdownRemaining)}
              </div>
              <div className="flex-1">
                <Rail value={countdownProgress} tone={tone} className="h-2.5" />
              </div>
              <div className="text-xs text-slate-400">{countdownProgress}% elapsed</div>
            </div>
          </div>
        ) : null}

        {showPulseRail ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <PulseTile label="Pressure" value={invasion.pressurePct} tone={tone} />
            <PulseTile label="Hostility" value={invasion.hostilityPct} tone={tone} />
            <PulseTile label="Disruption" value={invasion.disruptionPct} tone={tone} />
            <PulseTile label="Crowd Heat" value={invasion.crowdHeatPct} tone={tone} />
            <PulseTile label="Rescue" value={invasion.rescuePct} tone={tone} />
          </div>
        ) : null}

        {showActors && visibleActors.length > 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-3">
            <SectionLabel tone={tone} right={hiddenActors > 0 ? `+${hiddenActors} more` : null}>
              Active Voices
            </SectionLabel>
            <div className="mt-3 flex flex-wrap gap-2">
              {visibleActors.map(actor => (
                <ActorChip
                  key={actor.id}
                  actor={actor}
                  invasion={invasion}
                  onActorClick={onActorClick}
                />
              ))}
            </div>
          </div>
        ) : null}

        {showMetrics && visibleMetrics.length > 0 ? (
          <div className={cx('grid gap-3', variantTokens.metricCols)}>
            {visibleMetrics.map(metric => (
              <MetricCard key={metric.id} metric={metric} fallbackTone={tone} />
            ))}
          </div>
        ) : null}

        {showChannelImpact && visibleChannelImpacts.length > 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-3">
            <SectionLabel
              tone={tone}
              right={hiddenChannelImpacts > 0 ? `+${hiddenChannelImpacts} more` : null}
            >
              Channel Impact
            </SectionLabel>
            <div className="mt-3 grid gap-2">
              {visibleChannelImpacts.map(impact => (
                <ChannelImpactRow
                  key={impact.channelId}
                  impact={impact}
                  invasion={invasion}
                  onChannelClick={onChannelClick}
                />
              ))}
            </div>
          </div>
        ) : null}

        {showNarrative && narrativeLines.length > 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-3">
            <SectionLabel tone={tone}>Scene</SectionLabel>
            <div className="mt-3 grid gap-2">
              {narrativeLines.map(line => (
                <NarrativeLine key={line.id} line={line} />
              ))}
            </div>
            {collapsibleNarrative && allNarrative.length > maxVisibleNarrativeLines ? (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => {
                    const next = !narrativeExpanded;
                    setNarrativeExpanded(next);
                    if (next) onExpand?.(invasion);
                    else onCollapse?.(invasion);
                  }}
                  className="rounded-xl border border-slate-700/80 bg-slate-900/70 px-3 py-2 text-xs text-slate-200 transition hover:bg-slate-800/80"
                >
                  {narrativeExpanded ? 'Collapse scene' : `Expand scene (${allNarrative.length})`}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {showActions && invasion.actions && invasion.actions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {invasion.actions.map(action => (
              <ActionButton
                key={action.id}
                action={action}
                invasion={invasion}
                onAction={onAction}
                variant={variant}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

const StatPill = memo(function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: ChatBannerTone;
}) {
  return (
    <div className={cx('rounded-xl border px-3 py-2', TONE_TOKENS[tone].badge)}>
      <div className="text-[10px] uppercase tracking-[0.16em] opacity-80">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
});

const PulseTile = memo(function PulseTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | null | undefined;
  tone: ChatBannerTone;
}) {
  const pct = asPct(value);
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</div>
        <div className={cx('text-sm font-semibold', TONE_TOKENS[tone].text)}>{pct}%</div>
      </div>
      <Rail value={pct} tone={tone} />
    </div>
  );
});

export const ChatInvasionBanner = memo(InvasionBannerInner);

export default ChatInvasionBanner;
