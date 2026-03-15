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
  ChatInvasionBannerProps,
  InvasionBannerActionViewModel,
  InvasionBannerSeverity,
  InvasionWitnessViewModel,
} from './uiTypes';

/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT INVASION BANNER
 * FILE: pzo-web/src/components/chat/ChatInvasionBanner.tsx
 * ============================================================================
 *
 * Render-only invasion banner for the unified chat dock.
 *
 * This file is intentionally UI-only.
 * - zero socket ownership
 * - zero store writes
 * - zero transcript authority
 * - zero orchestration / invasion-planning authority
 * - zero learning-policy decisions
 *
 * It accepts already-computed invasion / breach / raid state from the shell and
 * renders that state with cinematic urgency, compactness, and cheap mount cost.
 * ============================================================================
 */

const SEVERITY_RING: Record<InvasionBannerSeverity, string> = {
  quiet: 'from-cyan-400/15 via-sky-400/10 to-transparent border-cyan-400/20',
  low: 'from-sky-400/18 via-indigo-400/10 to-transparent border-sky-400/25',
  elevated: 'from-amber-400/18 via-orange-400/10 to-transparent border-amber-400/30',
  high: 'from-orange-500/20 via-rose-500/14 to-transparent border-orange-400/35',
  severe: 'from-rose-500/25 via-red-500/16 to-transparent border-rose-400/40',
};

const SEVERITY_BAR: Record<InvasionBannerSeverity, string> = {
  quiet: 'from-cyan-300 via-sky-300 to-cyan-400',
  low: 'from-sky-300 via-indigo-300 to-sky-400',
  elevated: 'from-amber-300 via-orange-300 to-amber-400',
  high: 'from-orange-300 via-rose-300 to-orange-500',
  severe: 'from-rose-300 via-red-300 to-rose-500',
};

const DENSITY_CLASS = {
  compact: {
    root: 'rounded-2xl px-3 py-2.5',
    title: 'text-[13px]',
    body: 'text-[11px]',
    stat: 'text-[10px]',
    countdown: 'text-[18px]',
    action: 'px-2.5 py-1.5 text-[11px]',
    witness: 'px-2 py-1 text-[10px]',
  },
  comfortable: {
    root: 'rounded-[22px] px-3.5 py-3',
    title: 'text-[14px]',
    body: 'text-[12px]',
    stat: 'text-[11px]',
    countdown: 'text-[20px]',
    action: 'px-3 py-1.5 text-[12px]',
    witness: 'px-2.5 py-1 text-[10px]',
  },
  cinematic: {
    root: 'rounded-[24px] px-4 py-3.5',
    title: 'text-[15px]',
    body: 'text-[12px]',
    stat: 'text-[11px]',
    countdown: 'text-[22px]',
    action: 'px-3.5 py-1.5 text-[12px]',
    witness: 'px-2.5 py-1 text-[10px]',
  },
} as const;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function normalizeWhitespace(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function formatCountdown(secondsRemaining: number | null | undefined): string {
  if (typeof secondsRemaining !== 'number' || !Number.isFinite(secondsRemaining)) {
    return '—';
  }

  const safe = Math.max(0, Math.floor(secondsRemaining));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function actionToneClass(action: InvasionBannerActionViewModel): string {
  switch (action.tone) {
    case 'primary':
      return 'bg-white text-[#07111F] border-white/70 hover:bg-white/90';
    case 'danger':
      return 'bg-rose-500/16 text-rose-100 border-rose-400/30 hover:bg-rose-500/22';
    case 'warning':
      return 'bg-amber-500/16 text-amber-100 border-amber-400/30 hover:bg-amber-500/22';
    case 'success':
      return 'bg-emerald-500/16 text-emerald-100 border-emerald-400/30 hover:bg-emerald-500/22';
    case 'muted':
    default:
      return 'bg-white/6 text-white/82 border-white/10 hover:bg-white/10';
  }
}

function witnessToneClass(witness: InvasionWitnessViewModel): string {
  switch (witness.role) {
    case 'helper':
      return 'bg-emerald-500/12 border-emerald-400/20 text-emerald-100';
    case 'hater':
      return 'bg-rose-500/12 border-rose-400/20 text-rose-100';
    case 'crowd':
      return 'bg-indigo-500/12 border-indigo-400/20 text-indigo-100';
    case 'system':
      return 'bg-cyan-500/12 border-cyan-400/20 text-cyan-100';
    case 'leader':
      return 'bg-amber-500/12 border-amber-400/20 text-amber-100';
    default:
      return 'bg-white/8 border-white/10 text-white/82';
  }
}

function useReducedMotionPreference(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setPrefersReducedMotion(mediaQuery.matches);
    onChange();

    mediaQuery.addEventListener?.('change', onChange);
    return () => mediaQuery.removeEventListener?.('change', onChange);
  }, []);

  return prefersReducedMotion;
}

function WitnessChip({
  witness,
  density,
}: {
  witness: InvasionWitnessViewModel;
  density: keyof typeof DENSITY_CLASS;
}): JSX.Element {
  return (
    <div
      className={[
        'inline-flex items-center gap-1.5 rounded-full border backdrop-blur-sm',
        DENSITY_CLASS[density].witness,
        witnessToneClass(witness),
      ].join(' ')}
      title={witness.hint || witness.label}
    >
      {witness.icon ? <span aria-hidden="true">{witness.icon}</span> : null}
      <span className="font-medium tracking-[0.02em]">{witness.label}</span>
      {typeof witness.count === 'number' && witness.count > 1 ? (
        <span className="opacity-75">×{witness.count}</span>
      ) : null}
    </div>
  );
}

function ActionButton({
  action,
  density,
}: {
  action: InvasionBannerActionViewModel;
  density: keyof typeof DENSITY_CLASS;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={action.onPress}
      disabled={action.disabled}
      className={[
        'inline-flex min-h-[36px] items-center justify-center rounded-xl border font-semibold tracking-[0.02em] transition-colors',
        DENSITY_CLASS[density].action,
        actionToneClass(action),
        action.disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
      ].join(' ')}
      title={action.hint || action.label}
      aria-label={action.ariaLabel || action.label}
    >
      {action.icon ? <span className="mr-1.5">{action.icon}</span> : null}
      {action.label}
    </button>
  );
}

function BaseChatInvasionBanner({
  model,
  className,
  style,
  activeChannelKey,
  onDismiss,
  onFocusThread,
  onOpenTranscript,
}: ChatInvasionBannerProps): JSX.Element | null {
  const reducedMotion = useReducedMotionPreference();
  const headingId = useId();
  const bannerRef = useRef<HTMLDivElement | null>(null);

  const density = model.density ?? 'comfortable';
  const toneClasses = SEVERITY_RING[model.severity];
  const progress = clamp01(model.progress01);
  const visibleActions = useMemo(
    () => model.actions.filter((action) => !action.hidden),
    [model.actions],
  );

  useEffect(() => {
    if (!model.autoFocus) return;
    bannerRef.current?.focus();
  }, [model.autoFocus]);

  if (!model.visible) return null;

  return (
    <section
      ref={bannerRef}
      tabIndex={-1}
      aria-labelledby={headingId}
      data-channel={activeChannelKey ?? model.channelKey ?? 'GLOBAL'}
      data-invasion-phase={model.phase}
      data-invasion-severity={model.severity}
      className={[
        'relative isolate overflow-hidden border bg-[rgba(9,13,28,0.88)] text-white shadow-[0_18px_64px_rgba(0,0,0,0.34)] backdrop-blur-xl',
        DENSITY_CLASS[density].root,
        toneClasses,
        className ?? '',
      ].join(' ')}
      style={style}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br opacity-100" aria-hidden="true" />
      <div
        aria-hidden="true"
        className={[
          'absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r',
          SEVERITY_BAR[model.severity],
          reducedMotion ? '' : 'animate-pulse',
        ].join(' ')}
        style={{ transformOrigin: 'left center', transform: `scaleX(${Math.max(progress, 0.08)})` }}
      />

      <div className="relative z-[1] flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/78">
                {model.phaseLabel || model.phase}
              </span>
              {model.channelLabel ? (
                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-white/68">
                  {model.channelLabel}
                </span>
              ) : null}
              {model.ruleLabel ? (
                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-white/62">
                  {model.ruleLabel}
                </span>
              ) : null}
            </div>

            <h3 id={headingId} className={[DENSITY_CLASS[density].title, 'font-black leading-tight tracking-[0.01em] text-white'].join(' ')}>
              {normalizeWhitespace(model.title) || 'Invasion event'}
            </h3>

            {model.body ? (
              <p className={[DENSITY_CLASS[density].body, 'mt-1 max-w-[72ch] leading-relaxed text-white/74'].join(' ')}>
                {model.body}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <div className={[DENSITY_CLASS[density].countdown, 'font-black tabular-nums tracking-[0.04em] text-white'].join(' ')}>
              {formatCountdown(model.secondsRemaining)}
            </div>
            <div className={[DENSITY_CLASS[density].stat, 'uppercase tracking-[0.14em] text-white/56'].join(' ')}>
              {model.countdownLabel || 'window'}
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {model.metrics.map((metric) => (
            <div
              key={metric.id}
              className="rounded-2xl border border-white/8 bg-black/18 px-3 py-2.5"
              title={metric.hint || metric.label}
            >
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/48">{metric.label}</div>
              <div className="mt-1 text-[15px] font-bold text-white">{metric.value}</div>
              {metric.subvalue ? <div className="mt-0.5 text-[11px] text-white/56">{metric.subvalue}</div> : null}
            </div>
          ))}
        </div>

        {model.witnesses.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {model.witnesses.map((witness) => (
              <WitnessChip key={witness.id} witness={witness} density={density} />
            ))}
          </div>
        ) : null}

        {model.recommendation ? (
          <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/48">Recommendation</div>
            <div className="mt-1 text-[12px] font-medium leading-relaxed text-white/82">{model.recommendation}</div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2.5">
          {visibleActions.map((action) => (
            <ActionButton key={action.id} action={action} density={density} />
          ))}

          {onFocusThread ? (
            <button
              type="button"
              onClick={onFocusThread}
              className="inline-flex min-h-[36px] items-center justify-center rounded-xl border border-white/10 bg-white/6 px-3 py-1.5 text-[12px] font-semibold text-white/82 transition-colors hover:bg-white/10"
            >
              Focus thread
            </button>
          ) : null}

          {onOpenTranscript ? (
            <button
              type="button"
              onClick={onOpenTranscript}
              className="inline-flex min-h-[36px] items-center justify-center rounded-xl border border-white/10 bg-white/6 px-3 py-1.5 text-[12px] font-semibold text-white/82 transition-colors hover:bg-white/10"
            >
              Transcript
            </button>
          ) : null}

          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className="ml-auto inline-flex min-h-[36px] items-center justify-center rounded-xl border border-white/10 bg-transparent px-3 py-1.5 text-[12px] font-semibold text-white/62 transition-colors hover:bg-white/8 hover:text-white/82"
            >
              Dismiss
            </button>
          ) : null}
        </div>

        {model.footerNote ? (
          <div className="text-[10px] uppercase tracking-[0.14em] text-white/42">{model.footerNote}</div>
        ) : null}
      </div>
    </section>
  );
}

const ChatInvasionBanner = memo(BaseChatInvasionBanner);

ChatInvasionBanner.displayName = 'ChatInvasionBanner';

export default ChatInvasionBanner;
