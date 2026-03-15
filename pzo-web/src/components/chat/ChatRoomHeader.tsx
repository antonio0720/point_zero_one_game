import React, { memo, useMemo } from 'react';

import type {
  ChatRoomHeaderProps,
  RoomHeaderActionViewModel,
  RoomHeaderBadgeViewModel,
} from './uiTypes';

/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT ROOM HEADER
 * FILE: pzo-web/src/components/chat/ChatRoomHeader.tsx
 * ============================================================================
 *
 * Presentation-first command/header surface for the unified dock.
 *
 * This file intentionally owns no engine truth.
 * - no socket ownership
 * - no store writes
 * - no channel eligibility calculation
 * - no runtime policy mutation
 * - no learning logic
 *
 * It renders already-normalized room/header state supplied by useUnifiedChat.
 * ============================================================================
 */

const TONE_CLASS = {
  neutral: 'border-white/10 bg-white/6 text-white/82',
  accent: 'border-sky-400/22 bg-sky-500/10 text-sky-100',
  positive: 'border-emerald-400/22 bg-emerald-500/10 text-emerald-100',
  warning: 'border-amber-400/22 bg-amber-500/10 text-amber-100',
  danger: 'border-rose-400/22 bg-rose-500/10 text-rose-100',
  muted: 'border-white/8 bg-black/18 text-white/60',
} as const;

function Badge({ badge }: { badge: RoomHeaderBadgeViewModel }): JSX.Element {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]',
        TONE_CLASS[badge.tone ?? 'neutral'],
      ].join(' ')}
      title={badge.hint || badge.label}
    >
      {badge.icon ? <span aria-hidden="true">{badge.icon}</span> : null}
      {badge.label}
    </span>
  );
}

function ActionButton({ action }: { action: RoomHeaderActionViewModel }): JSX.Element {
  return (
    <button
      type="button"
      onClick={action.onPress}
      disabled={action.disabled}
      className={[
        'inline-flex min-h-[36px] items-center justify-center rounded-xl border px-3 py-1.5 text-[12px] font-semibold tracking-[0.02em] transition-colors',
        TONE_CLASS[action.tone ?? 'neutral'],
        action.disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:bg-white/10',
      ].join(' ')}
      title={action.hint || action.label}
      aria-label={action.ariaLabel || action.label}
    >
      {action.icon ? <span className="mr-1.5">{action.icon}</span> : null}
      {action.label}
      {typeof action.count === 'number' && action.count > 0 ? (
        <span className="ml-1.5 rounded-full bg-black/20 px-1.5 py-0.5 text-[10px]">{action.count}</span>
      ) : null}
    </button>
  );
}

function BaseChatRoomHeader({
  model,
  className,
  style,
  activeChannelKey,
}: ChatRoomHeaderProps): JSX.Element {
  const leftBadges = useMemo(() => model.badges.filter((badge) => badge.placement !== 'right'), [model.badges]);
  const rightBadges = useMemo(() => model.badges.filter((badge) => badge.placement === 'right'), [model.badges]);
  const primaryActions = useMemo(() => model.actions.filter((action) => action.priority !== 'secondary'), [model.actions]);
  const secondaryActions = useMemo(() => model.actions.filter((action) => action.priority === 'secondary'), [model.actions]);

  return (
    <header
      data-channel={activeChannelKey ?? model.channelKey ?? 'GLOBAL'}
      className={[
        'overflow-hidden rounded-[24px] border border-white/8 bg-[rgba(8,12,24,0.92)] px-4 py-3 text-white shadow-[0_18px_54px_rgba(0,0,0,0.28)] backdrop-blur-xl',
        className ?? '',
      ].join(' ')}
      style={style}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {model.icon ? <span className="text-[14px] leading-none">{model.icon}</span> : null}
            <h2 className="truncate text-[15px] font-black tracking-[0.01em] text-white">{model.title}</h2>
            {leftBadges.map((badge) => (
              <Badge key={badge.id} badge={badge} />
            ))}
          </div>

          {model.subtitle ? (
            <p className="mt-1 max-w-[72ch] text-[12px] leading-relaxed text-white/66">{model.subtitle}</p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/54">
            {model.memberCountLabel ? <span>{model.memberCountLabel}</span> : null}
            {model.modeLabel ? <span>• {model.modeLabel}</span> : null}
            {model.integrityLabel ? <span>• {model.integrityLabel}</span> : null}
            {model.postureLabel ? <span>• {model.postureLabel}</span> : null}
            {model.presenceLabel ? <span>• {model.presenceLabel}</span> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {rightBadges.map((badge) => (
            <Badge key={badge.id} badge={badge} />
          ))}
        </div>
      </div>

      {model.summaryMetrics.length > 0 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {model.summaryMetrics.map((metric) => (
            <div
              key={metric.id}
              className="rounded-2xl border border-white/8 bg-black/18 px-3 py-2.5"
              title={metric.hint || metric.label}
            >
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/46">{metric.label}</div>
              <div className="mt-1 text-[14px] font-bold text-white">{metric.value}</div>
              {metric.subvalue ? <div className="mt-0.5 text-[11px] text-white/56">{metric.subvalue}</div> : null}
            </div>
          ))}
        </div>
      ) : null}

      {(primaryActions.length > 0 || secondaryActions.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {primaryActions.map((action) => (
            <ActionButton key={action.id} action={action} />
          ))}
          {secondaryActions.length > 0 ? <div className="mx-1 h-6 w-px bg-white/8" aria-hidden="true" /> : null}
          {secondaryActions.map((action) => (
            <ActionButton key={action.id} action={action} />
          ))}
        </div>
      )}
    </header>
  );
}

const ChatRoomHeader = memo(BaseChatRoomHeader);

ChatRoomHeader.displayName = 'ChatRoomHeader';

export default ChatRoomHeader;
