import React, {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type {
  ChatPresenceStripProps,
  PresenceActorBadgeViewModel,
  PresenceActorRole,
  PresenceActorStatus,
  PresenceGroupViewModel,
  PresenceStripDensity,
  PresenceStripLabels,
} from './uiTypes';

/**
 * ==========================================================================
 * POINT ZERO ONE — UNIFIED CHAT PRESENCE STRIP
 * FILE: pzo-web/src/components/chat/ChatPresenceStrip.tsx
 * --------------------------------------------------------------------------
 * Doctrine
 * - render-only shell component; no socket ownership, no engine mutations,
 *   no learning-policy decisions, and no battle authority.
 * - accepts already-derived presence state from the chat engine / adapters.
 * - optimized for large membership lists through deterministic filtering,
 *   stable sorting, bounded rendering, and low-churn memoization.
 * - preserves room/channel semantics, hater/helper/player/system distinction,
 *   and the social-theater layer the chat runtime emits.
 * - designed to scale to heavy concurrent presence churn without becoming
 *   the place where truth is computed.
 * ==========================================================================
 */

const DEFAULT_LABELS: PresenceStripLabels = {
  title: 'Presence',
  selfLabel: 'You',
  helperLabel: 'Helper',
  haterLabel: 'Threat',
  spectatorLabel: 'Watching',
  offlineLabel: 'Offline',
  emptyLabel: 'Nobody is here yet.',
  hiddenCountLabel: (count) => `+${count} more`,
  unreadLabel: (count) => `${count} unread`,
  typingLabel: 'typing',
  activeNowLabel: 'active now',
  recentlySeenLabel: 'seen recently',
  riskLabel: 'risk',
  supportLabel: 'support',
  showMoreLabel: 'Show more',
  showLessLabel: 'Show less',
};

const ROLE_PRIORITY: Record<PresenceActorRole, number> = {
  system: 0,
  host: 1,
  moderator: 2,
  helper: 3,
  player: 4,
  npc: 5,
  hater: 6,
  spectator: 7,
};

const STATUS_PRIORITY: Record<PresenceActorStatus, number> = {
  online: 0,
  busy: 1,
  queueing: 2,
  matching: 3,
  spectating: 4,
  idle: 5,
  dnd: 6,
  disconnected: 7,
  hidden: 8,
  offline: 9,
};

const STATUS_RING_CLASS: Record<PresenceActorStatus, string> = {
  online: 'ring-emerald-400/70',
  idle: 'ring-amber-300/70',
  busy: 'ring-orange-400/70',
  dnd: 'ring-rose-500/70',
  offline: 'ring-white/10',
  hidden: 'ring-white/10',
  spectating: 'ring-sky-400/70',
  queueing: 'ring-violet-400/70',
  matching: 'ring-cyan-400/70',
  disconnected: 'ring-zinc-500/60',
};

const STATUS_DOT_CLASS: Record<PresenceActorStatus, string> = {
  online: 'bg-emerald-400',
  idle: 'bg-amber-300',
  busy: 'bg-orange-400',
  dnd: 'bg-rose-500',
  offline: 'bg-white/20',
  hidden: 'bg-white/15',
  spectating: 'bg-sky-400',
  queueing: 'bg-violet-400',
  matching: 'bg-cyan-400',
  disconnected: 'bg-zinc-500',
};

const ROLE_PILL_CLASS: Record<PresenceActorRole, string> = {
  player: 'bg-white/10 text-white/85 border-white/10',
  helper: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/20',
  hater: 'bg-rose-500/15 text-rose-200 border-rose-400/20',
  npc: 'bg-sky-500/15 text-sky-200 border-sky-400/20',
  moderator: 'bg-amber-500/15 text-amber-200 border-amber-400/20',
  host: 'bg-violet-500/15 text-violet-200 border-violet-400/20',
  spectator: 'bg-zinc-500/20 text-zinc-300 border-zinc-400/20',
  system: 'bg-cyan-500/15 text-cyan-200 border-cyan-400/20',
};

const DENSITY_MAP = {
  compact: {
    root: 'gap-2 rounded-xl p-2',
    chip: 'h-11 min-w-[170px] px-2.5 py-1.5',
    avatar: 'h-8 w-8 text-[11px]',
    title: 'text-[12px]',
    meta: 'text-[10px]',
    badge: 'text-[9px] px-1.5 py-0.5',
  },
  comfortable: {
    root: 'gap-2.5 rounded-2xl p-3',
    chip: 'h-13 min-w-[208px] px-3 py-2',
    avatar: 'h-9 w-9 text-xs',
    title: 'text-[13px]',
    meta: 'text-[11px]',
    badge: 'text-[10px] px-2 py-0.5',
  },
  expanded: {
    root: 'gap-3 rounded-2xl p-3.5',
    chip: 'h-15 min-w-[228px] px-3.5 py-2.5',
    avatar: 'h-10 w-10 text-sm',
    title: 'text-[14px]',
    meta: 'text-[11px]',
    badge: 'text-[10px] px-2 py-0.5',
  },
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function coerceFinite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function compareNullableNumbersDescending(a?: number | null, b?: number | null): number {
  return coerceFinite(b, -Infinity) - coerceFinite(a, -Infinity);
}

function compareNullableNumbersAscending(a?: number | null, b?: number | null): number {
  return coerceFinite(a, Infinity) - coerceFinite(b, Infinity);
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
  const joined = words.map((word) => word[0]?.toUpperCase() ?? '').join('');
  return joined || '?';
}

function statusLabel(status: PresenceActorStatus): string {
  switch (status) {
    case 'online': return 'Online';
    case 'idle': return 'Idle';
    case 'busy': return 'Busy';
    case 'dnd': return 'Do not disturb';
    case 'offline': return 'Offline';
    case 'hidden': return 'Hidden';
    case 'spectating': return 'Spectating';
    case 'queueing': return 'Queueing';
    case 'matching': return 'Matching';
    case 'disconnected': return 'Disconnected';
    default: return 'Unknown';
  }
}

function roleLabel(role: PresenceActorRole, labels: PresenceStripLabels): string {
  switch (role) {
    case 'helper': return labels.helperLabel;
    case 'hater': return labels.haterLabel;
    case 'spectator': return labels.spectatorLabel;
    case 'player': return 'Player';
    case 'npc': return 'NPC';
    case 'moderator': return 'Moderator';
    case 'host': return 'Host';
    case 'system': return 'System';
    default: return 'Member';
  }
}

function relativeTime(nowMs: number, timestampMs?: number | null): string | null {
  if (!timestampMs || !Number.isFinite(timestampMs)) return null;
  const deltaMs = nowMs - timestampMs;
  if (deltaMs < 0) return 'just now';
  const deltaSec = Math.floor(deltaMs / 1000);
  if (deltaSec < 5) return 'just now';
  if (deltaSec < 60) return `${deltaSec}s ago`;
  const deltaMin = Math.floor(deltaSec / 60);
  if (deltaMin < 60) return `${deltaMin}m ago`;
  const deltaHr = Math.floor(deltaMin / 60);
  if (deltaHr < 24) return `${deltaHr}h ago`;
  return `${Math.floor(deltaHr / 24)}d ago`;
}

function hasUnread(item: ChatPresenceStripProps['model']['actors'][number]): boolean {
  return coerceFinite(item.unreadCount, 0) > 0;
}

function isActiveStatus(status: PresenceActorStatus): boolean {
  return status === 'online' || status === 'busy' || status === 'queueing' || status === 'matching';
}

function isVisibleStatus(status: PresenceActorStatus, showOffline: boolean, showHidden: boolean): boolean {
  if (status === 'offline') return showOffline;
  if (status === 'hidden') return showHidden;
  return true;
}

function presencePriority(item: ChatPresenceStripProps['model']['actors'][number]): number {
  const base = coerceFinite(item.priority, 0);
  const selfBoost = item.isSelf ? 1200 : 0;
  const selectedBoost = item.isSelected ? 600 : 0;
  const typingBoost = item.isTyping ? 400 : 0;
  const helperBoost = item.role === 'helper' && item.isHelperRecommended ? 350 : 0;
  const threatBoost = item.role === 'hater' && item.isThreat ? 300 : 0;
  const unreadBoost = clamp(coerceFinite(item.unreadCount, 0), 0, 99) * 3;
  const activityBoost = clamp(coerceFinite(item.activityScore, 0), -100, 100);
  return base + selfBoost + selectedBoost + typingBoost + helperBoost + threatBoost + unreadBoost + activityBoost;
}

function searchHaystack(item: ChatPresenceStripProps['model']['actors'][number]): string {
  const meta = item.meta;
  return [
    item.id,
    item.name,
    item.shortName,
    item.role,
    item.status,
    item.intent,
    meta?.teamName,
    meta?.teamShortName,
    meta?.factionName,
    meta?.roomName,
    meta?.channelLabel,
    meta?.modeLabel,
    meta?.proofTier,
    meta?.proofHash,
    meta?.tickLabel,
    meta?.pressureLabel,
    meta?.reputationLabel,
    meta?.relationshipLabel,
    meta?.hoverSummary,
    meta?.signature,
    meta?.note,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function filterPresenceItems(
  items: ChatPresenceStripProps['model']['actors'],
  filterText: string,
  activeChannelKey: string | null,
  showOffline: boolean,
  showHidden: boolean,
): ChatPresenceStripProps['model']['actors'] {
  const normalizedFilter = normalizeSearch(filterText);
  const channelFilter = normalizeSearch(activeChannelKey);

  return items.filter((item) => {
    if (!isVisibleStatus(item.status, showOffline, showHidden)) return false;
    if (channelFilter) {
      const itemChannel = normalizeSearch(item.meta?.channelKey || item.meta?.channelLabel || '');
      if (itemChannel && itemChannel !== channelFilter) return false;
    }
    if (!normalizedFilter) return true;
    return searchHaystack(item).includes(normalizedFilter);
  });
}

function sortPresenceItems(
  items: ChatPresenceStripProps['model']['actors'],
  sortMode: NonNullable<ChatPresenceStripProps['sortMode']>,
): ChatPresenceStripProps['model']['actors'] {
  const copy = [...items];
  copy.sort((left, right) => {
    switch (sortMode) {
      case 'name':
        return normalizeWhitespace(left.name).localeCompare(normalizeWhitespace(right.name));
      case 'status': {
        const statusOrder = (STATUS_PRIORITY[left.status] ?? 999) - (STATUS_PRIORITY[right.status] ?? 999);
        if (statusOrder !== 0) return statusOrder;
        return compareNullableNumbersDescending(left.lastActiveAtMs, right.lastActiveAtMs);
      }
      case 'recent':
        return compareNullableNumbersDescending(left.lastActiveAtMs, right.lastActiveAtMs);
      case 'role': {
        const roleOrder = (ROLE_PRIORITY[left.role] ?? 999) - (ROLE_PRIORITY[right.role] ?? 999);
        if (roleOrder !== 0) return roleOrder;
        return normalizeWhitespace(left.name).localeCompare(normalizeWhitespace(right.name));
      }
      case 'channel':
        return normalizeWhitespace(left.meta?.channelLabel || left.meta?.channelKey || '').localeCompare(
          normalizeWhitespace(right.meta?.channelLabel || right.meta?.channelKey || ''),
        );
      case 'priority':
      default: {
        const priorityOrder = presencePriority(right) - presencePriority(left);
        if (priorityOrder !== 0) return priorityOrder;
        const activeOrder = compareNullableNumbersDescending(left.lastActiveAtMs, right.lastActiveAtMs);
        if (activeOrder !== 0) return activeOrder;
        return normalizeWhitespace(left.name).localeCompare(normalizeWhitespace(right.name));
      }
    }
  });
  return copy;
}

function buildSummary(items: ChatPresenceStripProps['model']['actors']) {
  return {
    online: items.filter((item) => isActiveStatus(item.status)).length,
    typing: items.filter((item) => item.isTyping).length,
    helpers: items.filter((item) => item.role === 'helper').length,
    haters: items.filter((item) => item.role === 'hater').length,
    spectators: items.filter((item) => item.role === 'spectator').length,
    offline: items.filter((item) => item.status === 'offline').length,
  };
}

function groupPresenceItems(
  items: ChatPresenceStripProps['model']['actors'],
  groupMode: NonNullable<ChatPresenceStripProps['groupMode']>,
): PresenceGroupViewModel[] {
  if (groupMode === 'none') {
    return [{ id: 'all', label: 'All', items }];
  }

  const buckets = new Map<string, PresenceGroupViewModel>();
  for (const item of items) {
    const key =
      groupMode === 'role'
        ? item.role
        : groupMode === 'status'
          ? item.status
          : groupMode === 'channel'
            ? item.meta?.channelKey || item.meta?.channelLabel || 'unknown'
            : item.meta?.teamId || item.meta?.teamName || 'ungrouped';

    const label =
      groupMode === 'role'
        ? item.role
        : groupMode === 'status'
          ? statusLabel(item.status)
          : groupMode === 'channel'
            ? item.meta?.channelLabel || item.meta?.channelKey || 'Unknown'
            : item.meta?.teamName || item.meta?.teamShortName || 'Ungrouped';

    const existing = buckets.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      buckets.set(key, { id: key, label, items: [item] });
    }
  }

  const groups = [...buckets.values()];
  groups.sort((left, right) => normalizeWhitespace(left.label).localeCompare(normalizeWhitespace(right.label)));
  return groups;
}

function buildDefaultFilterText(props: ChatPresenceStripProps): string {
  return props.filterText ?? '';
}

function useControllableFilter(props: ChatPresenceStripProps): [string, (value: string) => void] {
  const [internal, setInternal] = useState<string>(() => buildDefaultFilterText(props));
  const controlled = typeof props.filterText === 'string';
  const value = controlled ? props.filterText! : internal;
  const setValue = useCallback(
    (next: string) => {
      if (!controlled) setInternal(next);
      props.onFilterTextChange?.(next);
    },
    [controlled, props],
  );

  useEffect(() => {
    if (controlled) setInternal(props.filterText ?? '');
  }, [controlled, props.filterText]);

  return [value, setValue];
}

function useNowTick(enabled: boolean): number {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    const handle = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(handle);
  }, [enabled]);

  return nowMs;
}

function useRovingFocus(
  enabled: boolean,
  items: ChatPresenceStripProps['model']['actors'],
  selectedId: string | null,
) {
  const [focusedId, setFocusedId] = useState<string | null>(selectedId);

  useEffect(() => {
    if (selectedId) setFocusedId(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!enabled) return;
    if (!focusedId && items.length > 0) setFocusedId(items[0].id);
    if (focusedId && !items.some((item) => item.id === focusedId)) {
      setFocusedId(items[0]?.id ?? null);
    }
  }, [enabled, focusedId, items]);

  const move = useCallback(
    (step: number) => {
      if (!enabled || items.length === 0) return;
      const currentIndex = Math.max(0, items.findIndex((item) => item.id === focusedId));
      const nextIndex = clamp(currentIndex + step, 0, items.length - 1);
      setFocusedId(items[nextIndex]?.id ?? null);
    },
    [enabled, focusedId, items],
  );

  return { focusedId, setFocusedId, move };
}

interface PresenceChipVisualProps {
  item: ChatPresenceStripProps['model']['actors'][number];
  labels: PresenceStripLabels;
  density: PresenceStripDensity;
  maxBadgesPerItem: number;
  showBadges: boolean;
  showRolePills: boolean;
  showAvatarRing: boolean;
  showIntentText: boolean;
  showMetaLine: boolean;
  showTimestamp: boolean;
  nowMs: number;
}

function badgeToneClass(badge: PresenceActorBadgeViewModel | undefined): string {
  switch (badge?.tone) {
    case 'positive': return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200';
    case 'warning': return 'border-amber-400/20 bg-amber-500/10 text-amber-200';
    case 'danger': return 'border-rose-400/20 bg-rose-500/10 text-rose-200';
    case 'accent': return 'border-cyan-400/20 bg-cyan-500/10 text-cyan-200';
    case 'muted': return 'border-white/10 bg-white/5 text-white/55';
    default: return 'border-white/10 bg-white/5 text-white/70';
  }
}

const PresenceChipVisual = memo(function PresenceChipVisual({
  item,
  labels,
  density,
  maxBadgesPerItem,
  showBadges,
  showRolePills,
  showAvatarRing,
  showIntentText,
  showMetaLine,
  showTimestamp,
  nowMs,
}: PresenceChipVisualProps) {
  const densityTokens = DENSITY_MAP[density];
  const metaLine = useMemo(() => {
    const parts = [
      item.meta?.channelLabel,
      item.meta?.proofTier,
      item.meta?.pressureLabel,
      item.meta?.tickLabel,
      item.meta?.reputationLabel,
    ]
      .map((part) => normalizeWhitespace(part))
      .filter(Boolean);

    if (showIntentText && item.intent && item.intent !== 'none') {
      parts.unshift(item.intent);
    }

    if (showTimestamp) {
      const ts = relativeTime(nowMs, item.lastActiveAtMs ?? item.lastSeenAtMs);
      if (ts) parts.push(ts);
    }

    return parts.join(' • ');
  }, [item, nowMs, showIntentText, showTimestamp]);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="relative shrink-0">
        {item.avatarUrl ? (
          <img
            alt={item.name}
            src={item.avatarUrl}
            className={[
              'rounded-full object-cover',
              densityTokens.avatar,
              showAvatarRing ? `ring-2 ${STATUS_RING_CLASS[item.status]}` : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />
        ) : (
          <div
            className={[
              'flex items-center justify-center rounded-full font-semibold text-white',
              densityTokens.avatar,
              showAvatarRing ? `ring-2 ${STATUS_RING_CLASS[item.status]}` : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ background: item.accentColor ?? 'linear-gradient(135deg, rgba(59,130,246,0.65), rgba(16,185,129,0.55))' }}
          >
            {initialsForName(item.shortName || item.name)}
          </div>
        )}
        <span className={['absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-black/70', STATUS_DOT_CLASS[item.status]].join(' ')} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className={['truncate font-semibold text-white', densityTokens.title].join(' ')}>
            {item.isSelf ? labels.selfLabel : item.name}
          </div>

          {showRolePills ? (
            <span className={['inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium', ROLE_PILL_CLASS[item.role]].join(' ')}>
              {roleLabel(item.role, labels)}
            </span>
          ) : null}

          {item.isTyping ? (
            <span className="inline-flex items-center rounded-full border border-cyan-400/15 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-200">
              {labels.typingLabel}
            </span>
          ) : null}

          {hasUnread(item) ? (
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/70">
              {labels.unreadLabel(coerceFinite(item.unreadCount, 0))}
            </span>
          ) : null}
        </div>

        {showMetaLine && metaLine ? (
          <div className={['mt-0.5 truncate text-white/50', densityTokens.meta].join(' ')}>
            {metaLine}
          </div>
        ) : null}

        {showBadges && item.badges && item.badges.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {item.badges.slice(0, maxBadgesPerItem).map((badge) => (
              <span
                key={badge.id}
                className={[
                  'inline-flex items-center rounded-full border font-medium',
                  densityTokens.badge,
                  badgeToneClass(badge),
                ].join(' ')}
                title={badge.label}
              >
                {badge.shortLabel || badge.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
});

interface PresenceChipProps extends PresenceChipVisualProps {
  focused: boolean;
  onSelect?: (item: ChatPresenceStripProps['model']['actors'][number]) => void;
  onHover?: (item: ChatPresenceStripProps['model']['actors'][number] | null) => void;
  onFocusItem?: (item: ChatPresenceStripProps['model']['actors'][number]) => void;
  onOpenProfile?: (item: ChatPresenceStripProps['model']['actors'][number]) => void;
  onOpenWhisper?: (item: ChatPresenceStripProps['model']['actors'][number]) => void;
  onOpenContextMenu?: (item: ChatPresenceStripProps['model']['actors'][number], anchor: HTMLElement | null) => void;
}

const PresenceChip = memo(function PresenceChip({
  item,
  focused,
  onSelect,
  onHover,
  onFocusItem,
  onOpenProfile,
  onOpenWhisper,
  onOpenContextMenu,
  ...visualProps
}: PresenceChipProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (focused) {
      buttonRef.current?.focus({ preventScroll: true });
    }
  }, [focused]);

  return (
    <button
      ref={buttonRef}
      type="button"
      className={[
        'group flex w-full items-center rounded-2xl border text-left transition',
        DENSITY_MAP[visualProps.density].chip,
        item.isSelected
          ? 'border-cyan-400/25 bg-cyan-500/[0.08]'
          : item.isThreat
            ? 'border-rose-400/12 bg-rose-500/[0.04] hover:bg-rose-500/[0.07]'
            : item.role === 'helper'
              ? 'border-emerald-400/12 bg-emerald-500/[0.04] hover:bg-emerald-500/[0.07]'
              : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]',
        focused ? 'outline outline-2 outline-cyan-400/30' : '',
      ].join(' ')}
      onClick={() => onSelect?.(item)}
      onMouseEnter={() => onHover?.(item)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onFocusItem?.(item)}
      onDoubleClick={() => onOpenProfile?.(item)}
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenContextMenu?.(item, event.currentTarget);
      }}
    >
      <PresenceChipVisual item={item} {...visualProps} />
      <div className="ml-2 flex shrink-0 items-center gap-1.5">
        {onOpenWhisper ? (
          <span
            className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/55 transition group-hover:text-white/80"
            onClick={(event) => {
              event.stopPropagation();
              onOpenWhisper(item);
            }}
          >
            DM
          </span>
        ) : null}
      </div>
    </button>
  );
});

interface PresenceGroupSectionProps extends Omit<PresenceChipVisualProps, 'item'> {
  group: PresenceGroupViewModel;
  focusedId: string | null;
  showGroupHeaders: boolean;
  onSelect?: (item: ChatPresenceStripProps['model']['actors'][number]) => void;
  onHover?: (item: ChatPresenceStripProps['model']['actors'][number] | null) => void;
  onFocusItem?: (item: ChatPresenceStripProps['model']['actors'][number]) => void;
  onOpenProfile?: (item: ChatPresenceStripProps['model']['actors'][number]) => void;
  onOpenWhisper?: (item: ChatPresenceStripProps['model']['actors'][number]) => void;
  onOpenContextMenu?: (item: ChatPresenceStripProps['model']['actors'][number], anchor: HTMLElement | null) => void;
}

const PresenceGroupSection = memo(function PresenceGroupSection({
  group,
  focusedId,
  showGroupHeaders,
  ...chipProps
}: PresenceGroupSectionProps) {
  return (
    <section className="space-y-2">
      {showGroupHeaders ? (
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">{group.label}</div>
          <div className="h-px flex-1 bg-white/8" />
        </div>
      ) : null}
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {group.items.map((item) => (
          <PresenceChip
            key={item.id}
            item={item}
            focused={focusedId === item.id}
            {...chipProps}
          />
        ))}
      </div>
    </section>
  );
});

export const ChatPresenceStrip = memo(function ChatPresenceStrip(props: ChatPresenceStripProps) {
  const {
    model,
    density = 'comfortable',
    mode = 'overlay',
    sortMode = 'priority',
    groupMode = 'none',
    maxVisible = 18,
    maxBadgesPerItem = 3,
    selectedId = null,
    activeChannelKey = null,
    stickySelf = true,
    showOffline = false,
    showHidden = false,
    showSearch = false,
    showCounters = true,
    showGroupHeaders = true,
    showRolePills = true,
    showBadges = true,
    showAvatarRing = true,
    showIntentText = true,
    showMetaLine = true,
    showTimestamp = true,
    compactOverflow = true,
    keyboardNavigation = true,
    animated = true,
    className,
    emptyStateTitle,
    emptyStateDescription,
    onSelect,
    onHover,
    onFocusItem,
    onOpenProfile,
    onOpenWhisper,
    onOpenContextMenu,
    onClearSelection,
    renderLeadingSlot,
    renderTrailingSlot,
  } = props;

  const items = model.actors ?? [];
  const labels = useMemo<PresenceStripLabels>(() => ({ ...DEFAULT_LABELS, ...props.labels, title: props.labels?.title ?? model.title ?? DEFAULT_LABELS.title }), [props.labels, model.title]);
  const [filterText, setFilterText] = useControllableFilter(props);
  const nowMs = useNowTick(showTimestamp);
  const densityTokens = DENSITY_MAP[density];
  const searchId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState<boolean>(false);

  const filtered = useMemo(() => {
    const visible = filterPresenceItems(items, filterText, activeChannelKey, showOffline, showHidden);
    const sorted = sortPresenceItems(visible, sortMode);
    if (!stickySelf) return sorted;
    const self = sorted.find((item) => item.isSelf);
    if (!self) return sorted;
    return [self, ...sorted.filter((item) => item.id !== self.id)];
  }, [activeChannelKey, filterText, items, showHidden, showOffline, sortMode, stickySelf]);

  const displayed = useMemo(() => {
    if (expanded || !compactOverflow || filtered.length <= maxVisible) return filtered;
    return filtered.slice(0, maxVisible);
  }, [compactOverflow, expanded, filtered, maxVisible]);

  const hiddenCount = Math.max(0, filtered.length - displayed.length);
  const summary = useMemo(() => model.summary ?? buildSummary(filtered), [filtered, model.summary]);
  const groups = useMemo(() => model.groups?.length ? model.groups : groupPresenceItems(displayed, groupMode), [displayed, groupMode, model.groups]);
  const focusModel = useRovingFocus(keyboardNavigation, displayed, selectedId);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!keyboardNavigation) return;
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault();
          focusModel.move(1);
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault();
          focusModel.move(-1);
          break;
        case 'Escape':
          onClearSelection?.();
          break;
      }
    },
    [focusModel, keyboardNavigation, onClearSelection],
  );

  useLayoutEffect(() => {
    if (!rootRef.current || !animated) return;
    rootRef.current.style.setProperty('--presence-strip-transition-ms', '180ms');
  }, [animated]);

  return (
    <div
      ref={rootRef}
      className={[
        'w-full border border-white/10 bg-black/30 text-white backdrop-blur-xl',
        densityTokens.root,
        className || '',
        mode === 'battle' ? 'shadow-[0_0_0_1px_rgba(244,63,94,0.08),0_16px_42px_rgba(0,0,0,0.32)]' : '',
        mode === 'dealRoom' ? 'shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_16px_42px_rgba(0,0,0,0.28)]' : '',
      ].filter(Boolean).join(' ')}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/55">{labels.title}</div>
            {showCounters ? (
              <Fragment>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/70">
                  {summary.online} {labels.activeNowLabel}
                </span>
                {summary.typing > 0 ? (
                  <span className="rounded-full border border-cyan-400/15 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-200">
                    {summary.typing} {labels.typingLabel}
                  </span>
                ) : null}
                {summary.helpers > 0 ? (
                  <span className="rounded-full border border-emerald-400/15 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
                    {summary.helpers} {labels.supportLabel}
                  </span>
                ) : null}
                {summary.haters > 0 ? (
                  <span className="rounded-full border border-rose-400/15 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-200">
                    {summary.haters} {labels.riskLabel}
                  </span>
                ) : null}
              </Fragment>
            ) : null}
          </div>

          {showSearch ? (
            <div className="mt-3 max-w-sm">
              <label htmlFor={searchId} className="sr-only">Search presence</label>
              <input
                id={searchId}
                type="text"
                value={filterText}
                onChange={(event) => setFilterText(event.target.value)}
                placeholder={model.filterPlaceholder || 'Search names, channels, proof, pressure...'}
                className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-400/25 focus:bg-white/[0.08]"
              />
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {renderLeadingSlot}
          {hiddenCount > 0 && compactOverflow ? (
            <button
              type="button"
              className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-white/75 transition hover:bg-white/[0.08]"
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? labels.showLessLabel : labels.hiddenCountLabel(hiddenCount)}
            </button>
          ) : null}
          {renderTrailingSlot}
        </div>
      </div>

      <div className="mt-3">
        {displayed.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-5">
            <div className="text-sm font-semibold text-white/80">{emptyStateTitle || labels.emptyLabel}</div>
            {emptyStateDescription ? <div className="mt-1 text-sm text-white/45">{emptyStateDescription}</div> : null}
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <PresenceGroupSection
                key={group.id}
                group={group}
                density={density}
                labels={labels}
                maxBadgesPerItem={maxBadgesPerItem}
                showBadges={showBadges}
                showRolePills={showRolePills}
                showAvatarRing={showAvatarRing}
                showIntentText={showIntentText}
                showMetaLine={showMetaLine}
                showTimestamp={showTimestamp}
                showGroupHeaders={groupMode !== 'none' && showGroupHeaders}
                nowMs={nowMs}
                focusedId={focusModel.focusedId}
                onSelect={onSelect}
                onHover={onHover}
                onFocusItem={(item) => {
                  focusModel.setFocusedId(item.id);
                  onFocusItem?.(item);
                }}
                onOpenProfile={onOpenProfile}
                onOpenWhisper={onOpenWhisper}
                onOpenContextMenu={onOpenContextMenu}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default ChatPresenceStrip;
