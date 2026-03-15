import React, { memo, useMemo } from 'react';

import type { ChatEmptyStateProps, EmptyStateActionViewModel, EmptyStateScenario } from './uiTypes';

/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT EMPTY STATE
 * FILE: pzo-web/src/components/chat/ChatEmptyState.tsx
 * ============================================================================
 *
 * High-context empty-state renderer for the unified chat shell.
 *
 * Presentation doctrine:
 * - receives prepared display data only
 * - no battle imports
 * - no EventBus subscriptions
 * - no runtime policy writes
 * - no transcript truth inference
 * ============================================================================
 */

const SCENARIO_TOKEN: Record<EmptyStateScenario, { ring: string; label: string }> = {
  coldOpen: { ring: 'from-cyan-400/16 via-sky-400/8 to-transparent border-cyan-400/18', label: 'Cold open' },
  disconnected: { ring: 'from-rose-500/18 via-red-500/10 to-transparent border-rose-400/24', label: 'Disconnected' },
  channelQuiet: { ring: 'from-sky-400/16 via-indigo-400/8 to-transparent border-sky-400/18', label: 'Quiet lane' },
  searchZero: { ring: 'from-amber-400/16 via-orange-400/8 to-transparent border-amber-400/22', label: 'No results' },
  transcriptPending: { ring: 'from-violet-400/16 via-indigo-400/8 to-transparent border-violet-400/22', label: 'Awaiting record' },
  pressurePrompt: { ring: 'from-orange-500/18 via-rose-500/10 to-transparent border-orange-400/24', label: 'Pressure posture' },
  collapsed: { ring: 'from-white/10 via-white/4 to-transparent border-white/10', label: 'Collapsed' },
};

function actionToneClass(action: EmptyStateActionViewModel): string {
  switch (action.tone) {
    case 'primary':
      return 'border-white/70 bg-white text-[#08111F]';
    case 'danger':
      return 'border-rose-400/22 bg-rose-500/10 text-rose-100';
    case 'warning':
      return 'border-amber-400/22 bg-amber-500/10 text-amber-100';
    case 'positive':
      return 'border-emerald-400/22 bg-emerald-500/10 text-emerald-100';
    case 'muted':
    default:
      return 'border-white/10 bg-white/6 text-white/82';
  }
}

function EmptyAction({ action }: { action: EmptyStateActionViewModel }): JSX.Element {
  return (
    <button
      type="button"
      onClick={action.onPress}
      disabled={action.disabled}
      className={[
        'inline-flex min-h-[36px] items-center justify-center rounded-xl border px-3 py-1.5 text-[12px] font-semibold tracking-[0.02em]',
        actionToneClass(action),
        action.disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer transition-colors hover:bg-white/10',
      ].join(' ')}
      title={action.hint || action.label}
    >
      {action.icon ? <span className="mr-1.5">{action.icon}</span> : null}
      {action.label}
    </button>
  );
}

function BaseChatEmptyState({
  model,
  className,
  style,
  activeChannelKey,
}: ChatEmptyStateProps): JSX.Element | null {
  const token = SCENARIO_TOKEN[model.scenario];
  const visibleActions = useMemo(() => model.actions.filter((action) => !action.hidden), [model.actions]);

  if (!model.visible) return null;

  return (
    <section
      data-channel={activeChannelKey ?? model.channelKey ?? 'GLOBAL'}
      data-empty-scenario={model.scenario}
      className={[
        'relative overflow-hidden rounded-[24px] border bg-[rgba(8,12,24,0.9)] px-4 py-4 text-white shadow-[0_18px_54px_rgba(0,0,0,0.22)] backdrop-blur-xl',
        token.ring,
        className ?? '',
      ].join(' ')}
      style={style}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br" aria-hidden="true" />

      <div className="relative z-[1] flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/78">
                {token.label}
              </span>
              {model.channelLabel ? (
                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-white/62">
                  {model.channelLabel}
                </span>
              ) : null}
              {model.postureLabel ? (
                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-white/62">
                  {model.postureLabel}
                </span>
              ) : null}
            </div>

            <h3 className="mt-2 text-[16px] font-black tracking-[0.01em] text-white">{model.title}</h3>
            <p className="mt-1 max-w-[62ch] text-[12px] leading-relaxed text-white/68">{model.body}</p>
          </div>

          {model.heroMetric ? (
            <div className="rounded-2xl border border-white/8 bg-black/18 px-3 py-2.5 text-right">
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/46">{model.heroMetric.label}</div>
              <div className="mt-1 text-[16px] font-black text-white">{model.heroMetric.value}</div>
              {model.heroMetric.subvalue ? <div className="mt-0.5 text-[11px] text-white/56">{model.heroMetric.subvalue}</div> : null}
            </div>
          ) : null}
        </div>

        {model.hints.length > 0 ? (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {model.hints.map((hint) => (
              <div key={hint.id} className="rounded-2xl border border-white/8 bg-black/18 px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/46">{hint.label}</div>
                <div className="mt-1 text-[12px] font-semibold text-white/84">{hint.body}</div>
              </div>
            ))}
          </div>
        ) : null}

        {visibleActions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {visibleActions.map((action) => (
              <EmptyAction key={action.id} action={action} />
            ))}
          </div>
        ) : null}

        {model.footerNote ? <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">{model.footerNote}</div> : null}
      </div>
    </section>
  );
}

const ChatEmptyState = memo(BaseChatEmptyState);

ChatEmptyState.displayName = 'ChatEmptyState';

export default ChatEmptyState;
