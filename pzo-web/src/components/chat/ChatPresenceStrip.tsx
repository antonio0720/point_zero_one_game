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

export type ChatPresenceStatus =
  | 'online'
  | 'idle'
  | 'busy'
  | 'dnd'
  | 'offline'
  | 'hidden'
  | 'spectating'
  | 'queueing'
  | 'matching'
  | 'disconnected';

export type ChatPresenceRole =
  | 'player'
  | 'helper'
  | 'hater'
  | 'npc'
  | 'moderator'
  | 'host'
  | 'spectator'
  | 'system';

export type ChatPresenceEntityKind =
  | 'human'
  | 'bot'
  | 'npc'
  | 'system'
  | 'hybrid';

export type ChatPresenceDevice =
  | 'desktop'
  | 'mobile'
  | 'tablet'
  | 'console'
  | 'server'
  | 'unknown';

export type ChatPresenceIntent =
  | 'reading'
  | 'typing'
  | 'lurking'
  | 'watching'
  | 'negotiating'
  | 'attacking'
  | 'supporting'
  | 'queued'
  | 'idle'
  | 'none';

export type ChatPresenceDensity = 'compact' | 'comfortable' | 'expanded';

export type ChatPresenceSortMode =
  | 'priority'
  | 'status'
  | 'name'
  | 'recent'
  | 'role'
  | 'channel';

export type ChatPresenceGroupMode =
  | 'none'
  | 'role'
  | 'status'
  | 'channel'
  | 'team';

export type ChatPresenceStripMode =
  | 'lobby'
  | 'battle'
  | 'dealRoom'
  | 'global'
  | 'syndicate'
  | 'compactDock'
  | 'overlay';

export interface ChatPresenceBadge {
  id: string;
  label: string;
  tone?: 'default' | 'positive' | 'warning' | 'danger' | 'accent' | 'muted';
  shortLabel?: string;
}

export interface ChatPresenceMeta {
  teamId?: string | null;
  teamName?: string | null;
  teamShortName?: string | null;
  factionId?: string | null;
  factionName?: string | null;
  factionColorToken?: string | null;
  roomId?: string | null;
  roomName?: string | null;
  channelId?: string | null;
  channelKey?: string | null;
  channelLabel?: string | null;
  modeId?: string | null;
  modeLabel?: string | null;
  proofTier?: string | null;
  proofHash?: string | null;
  tickLabel?: string | null;
  pressureLabel?: string | null;
  reputationLabel?: string | null;
  relationshipLabel?: string | null;
  hoverSummary?: string | null;
  signature?: string | null;
  note?: string | null;
}

export interface ChatPresenceRecord {
  id: string;
  name: string;
  shortName?: string | null;
  avatarUrl?: string | null;
  accentColor?: string | null;
  status: ChatPresenceStatus;
  role: ChatPresenceRole;
  entityKind?: ChatPresenceEntityKind;
  device?: ChatPresenceDevice;
  intent?: ChatPresenceIntent;
  isSelf?: boolean;
  isPinned?: boolean;
  isMuted?: boolean;
  isSelected?: boolean;
  isTyping?: boolean;
  isHighlighted?: boolean;
  isThreat?: boolean;
  isHelperRecommended?: boolean;
  isShadow?: boolean;
  unreadCount?: number;
  priority?: number;
  presenceScore?: number;
  activityScore?: number;
  relationshipScore?: number;
  joinedAtMs?: number | null;
  lastSeenAtMs?: number | null;
  lastActiveAtMs?: number | null;
  typingStartedAtMs?: number | null;
  badges?: ChatPresenceBadge[];
  meta?: ChatPresenceMeta;
}

export interface ChatPresenceGroup {
  id: string;
  label: string;
  shortLabel?: string;
  items: ChatPresenceRecord[];
  tone?: 'default' | 'positive' | 'warning' | 'danger' | 'accent' | 'muted';
}

export interface ChatPresenceStripLabels {
  title: string;
  selfLabel: string;
  helperLabel: string;
  haterLabel: string;
  spectatorLabel: string;
  offlineLabel: string;
  emptyLabel: string;
  hiddenCountLabel: (count: number) => string;
  unreadLabel: (count: number) => string;
  typingLabel: string;
  activeNowLabel: string;
  recentlySeenLabel: string;
  riskLabel: string;
  supportLabel: string;
  showMoreLabel: string;
  showLessLabel: string;
}

export interface ChatPresenceStripProps {
  items: ChatPresenceRecord[];
  density?: ChatPresenceDensity;
  mode?: ChatPresenceStripMode;
  sortMode?: ChatPresenceSortMode;
  groupMode?: ChatPresenceGroupMode;
  maxVisible?: number;
  maxBadgesPerItem?: number;
  selectedId?: string | null;
  activeChannelKey?: string | null;
  stickySelf?: boolean;
  showOffline?: boolean;
  showHidden?: boolean;
  showSearch?: boolean;
  showCounters?: boolean;
  showGroupHeaders?: boolean;
  showRolePills?: boolean;
  showBadges?: boolean;
  showAvatarRing?: boolean;
  showIntentText?: boolean;
  showMetaLine?: boolean;
  showTimestamp?: boolean;
  compactOverflow?: boolean;
  keyboardNavigation?: boolean;
  animated?: boolean;
  className?: string;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  labels?: Partial<ChatPresenceStripLabels>;
  filterText?: string;
  onFilterTextChange?: (value: string) => void;
  onSelect?: (item: ChatPresenceRecord) => void;
  onHover?: (item: ChatPresenceRecord | null) => void;
  onFocusItem?: (item: ChatPresenceRecord) => void;
  onOpenProfile?: (item: ChatPresenceRecord) => void;
  onOpenWhisper?: (item: ChatPresenceRecord) => void;
  onOpenContextMenu?: (item: ChatPresenceRecord, anchor: HTMLElement | null) => void;
  onClearSelection?: () => void;
  renderLeadingSlot?: React.ReactNode;
  renderTrailingSlot?: React.ReactNode;
}

const DEFAULT_LABELS: ChatPresenceStripLabels = {
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

const ROLE_PRIORITY: Record<ChatPresenceRole, number> = {
  system: 0,
  host: 1,
  moderator: 2,
  helper: 3,
  player: 4,
  npc: 5,
  hater: 6,
  spectator: 7,
};

const STATUS_PRIORITY: Record<ChatPresenceStatus, number> = {
  online: 0,
  busy: 1,
  typing: 1 as never,
  queueing: 2,
  matching: 3,
  spectating: 4,
  idle: 5,
  dnd: 6,
  disconnected: 7,
  hidden: 8,
  offline: 9,
};

const STATUS_RING_CLASS: Record<ChatPresenceStatus, string> = {
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

const STATUS_DOT_CLASS: Record<ChatPresenceStatus, string> = {
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

const ROLE_PILL_CLASS: Record<ChatPresenceRole, string> = {
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

function compareNumbersDescending(a: number, b: number): number {
  return b - a;
}

function compareNumbersAscending(a: number, b: number): number {
  return a - b;
}

function compareNullableNumbersDescending(a?: number | null, b?: number | null): number {
  return compareNumbersDescending(coerceFinite(a, -Infinity), coerceFinite(b, -Infinity));
}

function compareNullableNumbersAscending(a?: number | null, b?: number | null): number {
  return compareNumbersAscending(coerceFinite(a, Infinity), coerceFinite(b, Infinity));
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

  if (words.length === 0) {
    return '?';
  }

  const joined = words.map((word) => word[0]?.toUpperCase() ?? '').join('');
  return joined || '?';
}

function statusLabel(status: ChatPresenceStatus): string {
  switch (status) {
    case 'online':
      return 'Online';
    case 'idle':
      return 'Idle';
    case 'busy':
      return 'Busy';
    case 'dnd':
      return 'Do not disturb';
    case 'offline':
      return 'Offline';
    case 'hidden':
      return 'Hidden';
    case 'spectating':
      return 'Spectating';
    case 'queueing':
      return 'Queueing';
    case 'matching':
      return 'Matching';
    case 'disconnected':
      return 'Disconnected';
    default:
      return 'Unknown';
  }
}

function roleLabel(role: ChatPresenceRole, labels: ChatPresenceStripLabels): string {
  switch (role) {
    case 'helper':
      return labels.helperLabel;
    case 'hater':
      return labels.haterLabel;
    case 'spectator':
      return labels.spectatorLabel;
    case 'player':
      return 'Player';
    case 'npc':
      return 'NPC';
    case 'moderator':
      return 'Moderator';
    case 'host':
      return 'Host';
    case 'system':
      return 'System';
    default:
      return 'Member';
  }
}

function relativeTime(nowMs: number, timestampMs?: number | null): string | null {
  if (!timestampMs || !Number.isFinite(timestampMs)) {
    return null;
  }

  const deltaMs = nowMs - timestampMs;
  if (deltaMs < 0) {
    return 'just now';
  }

  const deltaSec = Math.floor(deltaMs / 1000);
  if (deltaSec < 5) {
    return 'just now';
  }
  if (deltaSec < 60) {
    return `${deltaSec}s ago`;
  }

  const deltaMin = Math.floor(deltaSec / 60);
  if (deltaMin < 60) {
    return `${deltaMin}m ago`;
  }

  const deltaHr = Math.floor(deltaMin / 60);
  if (deltaHr < 24) {
    return `${deltaHr}h ago`;
  }

  const deltaDay = Math.floor(deltaHr / 24);
  return `${deltaDay}d ago`;
}

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function hasUnread(item: ChatPresenceRecord): boolean {
  return coerceFinite(item.unreadCount, 0) > 0;
}

function isActiveStatus(status: ChatPresenceStatus): boolean {
  return status === 'online' || status === 'busy' || status === 'queueing' || status === 'matching';
}

function isVisibleStatus(status: ChatPresenceStatus, showOffline: boolean, showHidden: boolean): boolean {
  if (status === 'offline') {
    return showOffline;
  }

  if (status === 'hidden') {
    return showHidden;
  }

  return true;
}

function presencePriority(item: ChatPresenceRecord): number {
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

function searchHaystack(item: ChatPresenceRecord): string {
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
    meta?.channelKey,
    meta?.modeLabel,
    meta?.proofTier,
    meta?.pressureLabel,
    meta?.tickLabel,
    meta?.reputationLabel,
    meta?.relationshipLabel,
    meta?.hoverSummary,
    meta?.note,
  ]
    .map((segment) => normalizeSearch(segment ?? ''))
    .filter(Boolean)
    .join(' ');
}

function sortPresenceItems(items: ChatPresenceRecord[], sortMode: ChatPresenceSortMode): ChatPresenceRecord[] {
  const next = [...items];

  next.sort((left, right) => {
    if (left.isPinned !== right.isPinned) {
      return left.isPinned ? -1 : 1;
    }

    if (left.isSelf !== right.isSelf) {
      return left.isSelf ? -1 : 1;
    }

    switch (sortMode) {
      case 'name': {
        return normalizeWhitespace(left.name).localeCompare(normalizeWhitespace(right.name));
      }
      case 'status': {
        const statusOrder = compareNumbersAscending(
          STATUS_PRIORITY[left.status] ?? 999,
          STATUS_PRIORITY[right.status] ?? 999,
        );
        if (statusOrder !== 0) {
          return statusOrder;
        }
        break;
      }
      case 'role': {
        const roleOrder = compareNumbersAscending(
          ROLE_PRIORITY[left.role] ?? 999,
          ROLE_PRIORITY[right.role] ?? 999,
        );
        if (roleOrder !== 0) {
          return roleOrder;
        }
        break;
      }
      case 'recent': {
        const recencyOrder = compareNullableNumbersDescending(left.lastActiveAtMs, right.lastActiveAtMs);
        if (recencyOrder !== 0) {
          return recencyOrder;
        }
        break;
      }
      case 'channel': {
        const leftChannel = normalizeWhitespace(left.meta?.channelLabel || left.meta?.channelKey || '');
        const rightChannel = normalizeWhitespace(right.meta?.channelLabel || right.meta?.channelKey || '');
        const channelOrder = leftChannel.localeCompare(rightChannel);
        if (channelOrder !== 0) {
          return channelOrder;
        }
        break;
      }
      case 'priority':
      default: {
        const priorityOrder = compareNumbersDescending(presencePriority(left), presencePriority(right));
        if (priorityOrder !== 0) {
          return priorityOrder;
        }
      }
    }

    const statusFallback = compareNumbersAscending(
      STATUS_PRIORITY[left.status] ?? 999,
      STATUS_PRIORITY[right.status] ?? 999,
    );
    if (statusFallback !== 0) {
      return statusFallback;
    }

    const roleFallback = compareNumbersAscending(ROLE_PRIORITY[left.role] ?? 999, ROLE_PRIORITY[right.role] ?? 999);
    if (roleFallback !== 0) {
      return roleFallback;
    }

    const scoreFallback = compareNumbersDescending(coerceFinite(left.presenceScore), coerceFinite(right.presenceScore));
    if (scoreFallback !== 0) {
      return scoreFallback;
    }

    return normalizeWhitespace(left.name).localeCompare(normalizeWhitespace(right.name));
  });

  return next;
}

function groupPresenceItems(items: ChatPresenceRecord[], groupMode: ChatPresenceGroupMode): ChatPresenceGroup[] {
  if (groupMode === 'none') {
    return [
      {
        id: 'all',
        label: 'All',
        items,
      },
    ];
  }

  const buckets = new Map<string, ChatPresenceGroup>();

  for (const item of items) {
    let key = 'ungrouped';
    let label = 'Ungrouped';
    let shortLabel = 'Other';

    if (groupMode === 'role') {
      key = item.role;
      label = item.role.charAt(0).toUpperCase() + item.role.slice(1);
      shortLabel = label;
    } else if (groupMode === 'status') {
      key = item.status;
      label = statusLabel(item.status);
      shortLabel = label;
    } else if (groupMode === 'channel') {
      key = normalizeWhitespace(item.meta?.channelKey || item.meta?.channelLabel || 'ungrouped') || 'ungrouped';
      label = normalizeWhitespace(item.meta?.channelLabel || item.meta?.channelKey || 'Unrouted');
      shortLabel = label;
    } else if (groupMode === 'team') {
      key = normalizeWhitespace(item.meta?.teamId || item.meta?.teamName || 'ungrouped') || 'ungrouped';
      label = normalizeWhitespace(item.meta?.teamName || item.meta?.teamShortName || 'No Team');
      shortLabel = normalizeWhitespace(item.meta?.teamShortName || item.meta?.teamName || 'No Team');
    }

    const existing = buckets.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      buckets.set(key, {
        id: key,
        label,
        shortLabel,
        items: [item],
      });
    }
  }

  return [...buckets.values()].sort((left, right) => left.label.localeCompare(right.label));
}

function buildDefaultFilterText(props: ChatPresenceStripProps): string {
  return normalizeWhitespace(props.filterText ?? '');
}

function useControllableFilter(props: ChatPresenceStripProps): [string, (value: string) => void] {
  const [internal, setInternal] = useState<string>(() => buildDefaultFilterText(props));
  const controlled = props.filterText;
  const value = typeof controlled === 'string' ? controlled : internal;

  useEffect(() => {
    if (typeof controlled === 'string') {
      return;
    }
    setInternal(buildDefaultFilterText(props));
  }, [props.filterText]);

  const setValue = useCallback(
    (nextValue: string) => {
      if (typeof controlled !== 'string') {
        setInternal(nextValue);
      }
      props.onFilterTextChange?.(nextValue);
    },
    [controlled, props],
  );

  return [value, setValue];
}

function useNowTick(showTimestamp: boolean): number {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!showTimestamp) {
      return;
    }
    const handle = window.setInterval(() => {
      setNowMs(Date.now());
    }, 15_000);

    return () => window.clearInterval(handle);
  }, [showTimestamp]);

  return nowMs;
}

interface PresenceChipVisualProps {
  item: ChatPresenceRecord;
  density: ChatPresenceDensity;
  labels: ChatPresenceStripLabels;
  maxBadgesPerItem: number;
  showBadges: boolean;
  showRolePills: boolean;
  showAvatarRing: boolean;
  showIntentText: boolean;
  showMetaLine: boolean;
  showTimestamp: boolean;
  nowMs: number;
}

const PresenceChipVisual = memo(function PresenceChipVisual({
  item,
  density,
  labels,
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
  const isMuted = item.isMuted;
  const intentText = normalizeWhitespace(item.intent || '') || 'none';
  const relativeSeen = relativeTime(nowMs, item.lastActiveAtMs ?? item.lastSeenAtMs ?? null);
  const visibleBadges = safeArray(item.badges).slice(0, maxBadgesPerItem);
  const remainingBadgeCount = Math.max(0, safeArray(item.badges).length - visibleBadges.length);
  const unread = coerceFinite(item.unreadCount, 0);
  const metaText = [
    item.meta?.channelLabel || item.meta?.channelKey || '',
    item.meta?.pressureLabel || '',
    item.meta?.tickLabel || '',
  ]
    .map((segment) => normalizeWhitespace(segment))
    .filter(Boolean)
    .join(' • ');

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="relative shrink-0">
        {item.avatarUrl ? (
          <img
            alt={item.name}
            src={item.avatarUrl}
            className={[
              'rounded-full object-cover',
              densityTokens.avatar,
              showAvatarRing ? `ring-2 ${STATUS_RING_CLASS[item.status]}` : '',
              isMuted ? 'opacity-60 grayscale' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />
        ) : (
          <div
            className={[
              'flex items-center justify-center rounded-full font-semibold text-white shadow-inner',
              densityTokens.avatar,
              showAvatarRing ? `ring-2 ${STATUS_RING_CLASS[item.status]}` : '',
              isMuted ? 'opacity-60' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ background: item.accentColor ?? 'linear-gradient(135deg, rgba(34,197,94,0.55), rgba(59,130,246,0.55))' }}
          >
            {initialsForName(item.shortName || item.name)}
          </div>
        )}
        <span
          aria-hidden="true"
          className={[
            'absolute -bottom-0.5 -right-0.5 block h-3 w-3 rounded-full border border-black/80 shadow',
            STATUS_DOT_CLASS[item.status],
          ].join(' ')}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className={['truncate font-semibold text-white', densityTokens.title].join(' ')}>{item.isSelf ? labels.selfLabel : item.name}</span>
          {item.isTyping ? (
            <span className="shrink-0 rounded-full bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-medium text-cyan-200">{labels.typingLabel}</span>
          ) : null}
          {showRolePills ? (
            <span className={['shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium', ROLE_PILL_CLASS[item.role]].join(' ')}>
              {roleLabel(item.role, labels)}
            </span>
          ) : null}
          {unread > 0 ? (
            <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-black">{unread}</span>
          ) : null}
        </div>

        <div className={['mt-0.5 flex min-w-0 items-center gap-1.5 text-white/55', densityTokens.meta].join(' ')}>
          <span className="truncate">{statusLabel(item.status)}</span>
          {showIntentText && item.intent && intentText !== 'none' ? <span className="truncate">• {intentText}</span> : null}
          {showTimestamp && relativeSeen ? <span className="truncate">• {relativeSeen}</span> : null}
        </div>

        {showMetaLine && metaText ? <div className={['mt-0.5 truncate text-white/40', densityTokens.meta].join(' ')}>{metaText}</div> : null}

        {showBadges && (visibleBadges.length > 0 || remainingBadgeCount > 0) ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {visibleBadges.map((badge) => (
              <span
                key={badge.id}
                className={[
                  'rounded-full border border-white/10 bg-white/5 font-medium text-white/75',
                  densityTokens.badge,
                ].join(' ')}
              >
                {badge.shortLabel || badge.label}
              </span>
            ))}
            {remainingBadgeCount > 0 ? (
              <span className={['rounded-full border border-white/10 bg-white/5 font-medium text-white/60', densityTokens.badge].join(' ')}>
                +{remainingBadgeCount}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
});

interface PresenceChipProps extends PresenceChipVisualProps {
  isFocused: boolean;
  onSelect?: (item: ChatPresenceRecord) => void;
  onHover?: (item: ChatPresenceRecord | null) => void;
  onFocusItem?: (item: ChatPresenceRecord) => void;
  onOpenProfile?: (item: ChatPresenceRecord) => void;
  onOpenWhisper?: (item: ChatPresenceRecord) => void;
  onOpenContextMenu?: (item: ChatPresenceRecord, anchor: HTMLElement | null) => void;
}

const PresenceChip = memo(function PresenceChip({
  item,
  density,
  labels,
  maxBadgesPerItem,
  showBadges,
  showRolePills,
  showAvatarRing,
  showIntentText,
  showMetaLine,
  showTimestamp,
  nowMs,
  isFocused,
  onSelect,
  onHover,
  onFocusItem,
  onOpenProfile,
  onOpenWhisper,
  onOpenContextMenu,
}: PresenceChipProps) {
  const densityTokens = DENSITY_MAP[density];
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (isFocused) {
      buttonRef.current?.focus();
    }
  }, [isFocused]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect?.(item);
      }

      if (event.key.toLowerCase() === 'p') {
        event.preventDefault();
        onOpenProfile?.(item);
      }

      if (event.key.toLowerCase() === 'w') {
        event.preventDefault();
        onOpenWhisper?.(item);
      }
    },
    [item, onOpenProfile, onOpenWhisper, onSelect],
  );

  const ariaDescription = [
    item.isSelf ? labels.selfLabel : item.name,
    statusLabel(item.status),
    roleLabel(item.role, labels),
    item.intent && item.intent !== 'none' ? item.intent : '',
    hasUnread(item) ? labels.unreadLabel(coerceFinite(item.unreadCount, 0)) : '',
  ]
    .map((segment) => normalizeWhitespace(segment))
    .filter(Boolean)
    .join(', ');

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={ariaDescription}
      title={normalizeWhitespace(item.meta?.hoverSummary || item.meta?.note || '') || undefined}
      className={[
        'group relative flex shrink-0 items-center rounded-2xl border text-left transition',
        densityTokens.chip,
        item.isSelected
          ? 'border-cyan-400/35 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.18)]'
          : 'border-white/10 bg-white/[0.045] hover:border-white/15 hover:bg-white/[0.07]',
        item.isThreat ? 'shadow-[inset_0_0_0_1px_rgba(244,63,94,0.12)]' : '',
        item.isHelperRecommended ? 'shadow-[inset_0_0_0_1px_rgba(16,185,129,0.12)]' : '',
        isFocused ? 'outline-none ring-2 ring-cyan-400/45 ring-offset-0' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onSelect?.(item)}
      onFocus={() => onFocusItem?.(item)}
      onMouseEnter={() => onHover?.(item)}
      onMouseLeave={() => onHover?.(null)}
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenContextMenu?.(item, event.currentTarget);
      }}
      onKeyDown={handleKeyDown}
    >
      <PresenceChipVisual
        item={item}
        density={density}
        labels={labels}
        maxBadgesPerItem={maxBadgesPerItem}
        showBadges={showBadges}
        showRolePills={showRolePills}
        showAvatarRing={showAvatarRing}
        showIntentText={showIntentText}
        showMetaLine={showMetaLine}
        showTimestamp={showTimestamp}
        nowMs={nowMs}
      />
    </button>
  );
});

interface PresenceGroupSectionProps {
  group: ChatPresenceGroup;
  density: ChatPresenceDensity;
  labels: ChatPresenceStripLabels;
  maxBadgesPerItem: number;
  showBadges: boolean;
  showRolePills: boolean;
  showAvatarRing: boolean;
  showIntentText: boolean;
  showMetaLine: boolean;
  showTimestamp: boolean;
  showGroupHeaders: boolean;
  nowMs: number;
  focusedId: string | null;
  onSelect?: (item: ChatPresenceRecord) => void;
  onHover?: (item: ChatPresenceRecord | null) => void;
  onFocusItem?: (item: ChatPresenceRecord) => void;
  onOpenProfile?: (item: ChatPresenceRecord) => void;
  onOpenWhisper?: (item: ChatPresenceRecord) => void;
  onOpenContextMenu?: (item: ChatPresenceRecord, anchor: HTMLElement | null) => void;
}

const PresenceGroupSection = memo(function PresenceGroupSection({
  group,
  density,
  labels,
  maxBadgesPerItem,
  showBadges,
  showRolePills,
  showAvatarRing,
  showIntentText,
  showMetaLine,
  showTimestamp,
  showGroupHeaders,
  nowMs,
  focusedId,
  onSelect,
  onHover,
  onFocusItem,
  onOpenProfile,
  onOpenWhisper,
  onOpenContextMenu,
}: PresenceGroupSectionProps) {
  return (
    <div className="min-w-0">
      {showGroupHeaders ? (
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <div className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">{group.label}</div>
          <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-white/55">
            {group.items.length}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {group.items.map((item) => (
          <PresenceChip
            key={item.id}
            item={item}
            density={density}
            labels={labels}
            maxBadgesPerItem={maxBadgesPerItem}
            showBadges={showBadges}
            showRolePills={showRolePills}
            showAvatarRing={showAvatarRing}
            showIntentText={showIntentText}
            showMetaLine={showMetaLine}
            showTimestamp={showTimestamp}
            nowMs={nowMs}
            isFocused={focusedId === item.id}
            onSelect={onSelect}
            onHover={onHover}
            onFocusItem={onFocusItem}
            onOpenProfile={onOpenProfile}
            onOpenWhisper={onOpenWhisper}
            onOpenContextMenu={onOpenContextMenu}
          />
        ))}
      </div>
    </div>
  );
});

function filterPresenceItems(
  items: ChatPresenceRecord[],
  filterText: string,
  activeChannelKey: string | null | undefined,
  showOffline: boolean,
  showHidden: boolean,
): ChatPresenceRecord[] {
  const normalizedFilter = normalizeSearch(filterText);
  const normalizedChannel = normalizeSearch(activeChannelKey ?? '');

  return items.filter((item) => {
    if (!isVisibleStatus(item.status, showOffline, showHidden)) {
      return false;
    }

    if (normalizedChannel) {
      const itemChannel = normalizeSearch(item.meta?.channelKey || item.meta?.channelLabel || '');
      if (item.role !== 'system' && item.role !== 'moderator' && itemChannel && itemChannel !== normalizedChannel) {
        return false;
      }
    }

    if (!normalizedFilter) {
      return true;
    }

    return searchHaystack(item).includes(normalizedFilter);
  });
}

function buildSummary(items: ChatPresenceRecord[]): {
  total: number;
  online: number;
  typing: number;
  helpers: number;
  haters: number;
  unread: number;
} {
  let online = 0;
  let typing = 0;
  let helpers = 0;
  let haters = 0;
  let unread = 0;

  for (const item of items) {
    if (isActiveStatus(item.status) || item.status === 'spectating') {
      online += 1;
    }
    if (item.isTyping) {
      typing += 1;
    }
    if (item.role === 'helper') {
      helpers += 1;
    }
    if (item.role === 'hater') {
      haters += 1;
    }
    unread += clamp(coerceFinite(item.unreadCount, 0), 0, 999);
  }

  return {
    total: items.length,
    online,
    typing,
    helpers,
    haters,
    unread,
  };
}

function useRovingFocus(enabled: boolean, visibleItems: ChatPresenceRecord[], selectedId?: string | null) {
  const [focusedId, setFocusedId] = useState<string | null>(selectedId ?? visibleItems[0]?.id ?? null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (selectedId && visibleItems.some((item) => item.id === selectedId)) {
      setFocusedId(selectedId);
      return;
    }

    if (focusedId && visibleItems.some((item) => item.id === focusedId)) {
      return;
    }

    setFocusedId(visibleItems[0]?.id ?? null);
  }, [enabled, focusedId, selectedId, visibleItems]);

  const move = useCallback(
    (delta: number) => {
      if (!enabled || visibleItems.length === 0) {
        return;
      }
      const index = visibleItems.findIndex((item) => item.id === focusedId);
      const startIndex = index === -1 ? 0 : index;
      const nextIndex = (startIndex + delta + visibleItems.length) % visibleItems.length;
      setFocusedId(visibleItems[nextIndex]?.id ?? null);
    },
    [enabled, focusedId, visibleItems],
  );

  return {
    focusedId,
    setFocusedId,
    move,
  };
}

export const ChatPresenceStrip = memo(function ChatPresenceStrip(props: ChatPresenceStripProps) {
  const {
    items,
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

  const labels = useMemo<ChatPresenceStripLabels>(() => ({ ...DEFAULT_LABELS, ...props.labels }), [props.labels]);
  const [filterText, setFilterText] = useControllableFilter(props);
  const nowMs = useNowTick(showTimestamp);
  const densityTokens = DENSITY_MAP[density];
  const searchId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState<boolean>(false);

  const filtered = useMemo(() => {
    const visible = filterPresenceItems(items, filterText, activeChannelKey, showOffline, showHidden);
    const sorted = sortPresenceItems(visible, sortMode);

    if (!stickySelf) {
      return sorted;
    }

    const self = sorted.find((item) => item.isSelf);
    if (!self) {
      return sorted;
    }

    return [self, ...sorted.filter((item) => item.id !== self.id)];
  }, [activeChannelKey, filterText, items, showHidden, showOffline, sortMode, stickySelf]);

  const displayed = useMemo(() => {
    if (expanded || !compactOverflow || filtered.length <= maxVisible) {
      return filtered;
    }
    return filtered.slice(0, maxVisible);
  }, [compactOverflow, expanded, filtered, maxVisible]);

  const hiddenCount = Math.max(0, filtered.length - displayed.length);
  const summary = useMemo(() => buildSummary(filtered), [filtered]);
  const groups = useMemo(() => groupPresenceItems(displayed, groupMode), [displayed, groupMode]);
  const focusModel = useRovingFocus(keyboardNavigation, displayed, selectedId);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!keyboardNavigation) {
        return;
      }

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
        default:
          break;
      }
    },
    [focusModel, keyboardNavigation, onClearSelection],
  );

  useLayoutEffect(() => {
    if (!rootRef.current || !animated) {
      return;
    }
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
      ]
        .filter(Boolean)
        .join(' ')}
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
              <label htmlFor={searchId} className="sr-only">
                Search presence
              </label>
              <input
                id={searchId}
                type="text"
                value={filterText}
                onChange={(event) => setFilterText(event.target.value)}
                placeholder="Search names, channels, proof, pressure..."
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
