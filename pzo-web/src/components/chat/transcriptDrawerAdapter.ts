import type {
  ChatUiAccent,
  ChatUiChip,
  ChatUiDrawerFilter,
  ChatUiMetric,
  ChatUiTone,
  ChatUiTranscriptDetailCard,
  ChatUiTranscriptDrawerCallbacks,
  ChatUiTranscriptDrawerFilterStateViewModel,
  ChatUiTranscriptDrawerHeaderViewModel,
  ChatUiTranscriptDrawerSurfaceModel,
  ChatUiTranscriptDrawerViewModel,
  ChatUiTranscriptRowViewModel,
} from './uiTypes';
import { buildEmptyStateViewModel } from './uiTypes';
import type { ChatChannel, ChatMessage, GameChatContext } from './chatTypes';

export type TranscriptDrawerKindScope = 'ALL' | string;
export type TranscriptDrawerChannelScope = ChatChannel | 'ALL';

export interface BuildTranscriptDrawerSurfaceParams {
  open: boolean;
  messages: readonly ChatMessage[];
  activeChannel: ChatChannel;
  roomTitle?: string;
  roomSubtitle?: string;
  modeName?: string;
  context?: GameChatContext;
  connected?: boolean;
  connectionState?: string;
  onlineCount?: number;
  activeMembers?: number;
  typingCount?: number;
  totalUnread?: number;
  selectedMessageId?: string | null;
  transcriptLocked?: boolean;
  searchQuery?: string;
  newestFirst?: boolean;
  proofOnly?: boolean;
  lockedOnly?: boolean;
  channelScope?: TranscriptDrawerChannelScope;
  kindScope?: TranscriptDrawerKindScope;
}

export interface CreateTranscriptDrawerCallbacksParams {
  onClose: () => void;
  onSearchQueryChange?: (value: string) => void;
  onSelectChannelScope?: (scopeId: string) => void;
  onSelectKindScope?: (scopeId: string) => void;
  onToggleProofOnly?: (next: boolean) => void;
  onToggleLockedOnly?: (next: boolean) => void;
  onToggleNewestFirst?: (next: boolean) => void;
  onJumpToMessage?: (messageId: string) => void;
  onRequestExport?: () => void;
  onJumpLatest?: () => void;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
}

function maybeString(value: unknown): string | undefined {
  const next = asString(value).trim();
  return next.length > 0 ? next : undefined;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function channelLabel(channel: string): string {
  if (channel === 'GLOBAL') return 'Global';
  if (channel === 'SYNDICATE') return 'Syndicate';
  if (channel === 'DEAL_ROOM') return 'Deal Room';
  return channel;
}

function toneForMessage(kind: string): ChatUiTone {
  if (kind === 'BOT_ATTACK' || kind === 'CASCADE_ALERT') return 'danger';
  if (kind === 'BOT_TAUNT') return 'hostile';
  if (kind === 'MARKET_ALERT' || kind === 'DEAL') return 'warning';
  if (kind === 'SYSTEM' || kind === 'SYSTEM_NOTICE') return 'premium';
  return 'neutral';
}

function accentForMessage(kind: string, channel: string): ChatUiAccent {
  if (kind === 'BOT_ATTACK' || kind === 'CASCADE_ALERT') return 'red';
  if (kind === 'BOT_TAUNT') return 'amber';
  if (channel === 'DEAL_ROOM') return 'amber';
  if (channel === 'SYNDICATE') return 'cyan';
  if (channel === 'GLOBAL') return 'silver';
  return 'slate';
}

function kindLabel(kind: string): string {
  return kind
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function initialsOf(name: string): string | undefined {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return undefined;
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
}

function createDetailCards(message: ChatMessage): ChatUiTranscriptDetailCard[] | undefined {
  const r = asRecord(message as unknown);
  const cards: ChatUiTranscriptDetailCard[] = [];

  const proofHash = maybeString(r.proofHash);
  if (proofHash) {
    cards.push({
      id: `${message.id}:proof`,
      label: 'Proof',
      title: proofHash,
      subtitle: maybeString(r.proofSummary),
      accent: 'indigo',
      tone: 'premium',
    });
  }

  const pressureTier = maybeString(r.pressureTier);
  if (pressureTier) {
    cards.push({
      id: `${message.id}:pressure`,
      label: 'Pressure',
      title: pressureTier,
      subtitle: maybeString(r.tickTier),
      accent: 'amber',
      tone: 'warning',
    });
  }

  const runOutcome = maybeString(r.runOutcomeLabel ?? r.runOutcome);
  if (runOutcome) {
    cards.push({
      id: `${message.id}:outcome`,
      label: 'Outcome',
      title: runOutcome,
      accent: 'violet',
      tone: 'dramatic',
    });
  }

  return cards.length > 0 ? cards : undefined;
}

function createChips(message: ChatMessage): ChatUiChip[] | undefined {
  const r = asRecord(message as unknown);
  const chips: ChatUiChip[] = [];
  if (maybeString(r.proofHash)) {
    chips.push({ id: `${message.id}:chip:proof`, label: 'Proof', shortLabel: 'Proof', accent: 'indigo', tone: 'premium', active: true });
  }
  if (r.immutable === true) {
    chips.push({ id: `${message.id}:chip:locked`, label: 'Locked', shortLabel: 'Locked', accent: 'obsidian', tone: 'ghost', active: true });
  }
  if (maybeString(r.pressureTier)) {
    chips.push({ id: `${message.id}:chip:pressure`, label: asString(r.pressureTier), shortLabel: asString(r.pressureTier), accent: 'amber', tone: 'warning', active: true });
  }
  return chips.length > 0 ? chips : undefined;
}

function createRow(message: ChatMessage, selectedMessageId?: string | null): ChatUiTranscriptRowViewModel {
  const r = asRecord(message as unknown);
  const senderName = asString((message as unknown as { senderName?: string }).senderName ?? r.senderName, 'Unknown');
  const senderId = asString((message as unknown as { senderId?: string }).senderId ?? r.senderId, 'unknown');
  const body = asString((message as unknown as { body?: string }).body ?? r.body, '');
  const channel = asString((message as unknown as { channel?: string }).channel ?? r.channel, 'GLOBAL');
  const kind = asString((message as unknown as { kind?: string }).kind ?? r.kind, 'SYSTEM');
  const timestamp = asNumber((message as unknown as { ts?: number }).ts ?? r.ts, 0);
  const role: 'player' | 'system' = kind === 'PLAYER' ? 'player' : 'system';

  return {
    id: `row:${message.id}`,
    messageId: message.id,
    role,
    channelId: channel,
    channelLabel: channelLabel(channel),
    kindId: kind,
    kindLabel: kindLabel(kind),
    actorId: senderId,
    actorLabel: senderName,
    actorInitials: initialsOf(senderName),
    actorRankLabel: maybeString(r.senderRank),
    actorOriginLabel: maybeString(r.senderOriginLabel ?? r.origin),
    body,
    emoji: role === 'player' ? '💬' : '⚙️',
    timestamp,
    timestampLabel: timestamp > 0 ? new Date(timestamp).toLocaleString() : undefined,
    relativeTimestampLabel: undefined,
    accent: accentForMessage(kind, channel),
    tone: toneForMessage(kind),
    selected: selectedMessageId === message.id,
    locked: r.immutable === true,
    proofHashLabel: maybeString(r.proofHash),
    proofSummary: maybeString(r.proofSummary),
    pressureTierLabel: maybeString(r.pressureTier),
    tickTierLabel: maybeString(r.tickTier),
    runOutcomeLabel: maybeString(r.runOutcomeLabel ?? r.runOutcome),
    searchBlob: [senderName, body, asString(r.proofHash), asString(r.pressureTier), asString(r.tickTier), kind].join(' '),
    chips: createChips(message),
    detailCards: createDetailCards(message),
  };
}

function filterRows(
  rows: readonly ChatUiTranscriptRowViewModel[],
  params: BuildTranscriptDrawerSurfaceParams,
): ChatUiTranscriptRowViewModel[] {
  const query = (params.searchQuery ?? '').trim().toLowerCase();

  return rows.filter((row) => {
    if ((params.channelScope ?? 'ALL') !== 'ALL' && row.channelId !== params.channelScope) {
      return false;
    }
    if ((params.kindScope ?? 'ALL') !== 'ALL' && row.kindId !== params.kindScope) {
      return false;
    }
    if (params.proofOnly && !row.proofHashLabel) {
      return false;
    }
    if (params.lockedOnly && !row.locked) {
      return false;
    }
    if (query.length > 0) {
      const haystack = `${row.actorLabel ?? ''} ${row.body} ${row.searchBlob ?? ''}`.toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  });
}

function sortRows(rows: readonly ChatUiTranscriptRowViewModel[], newestFirst: boolean): ChatUiTranscriptRowViewModel[] {
  return [...rows].sort((a, b) => {
    const delta = (a.timestamp ?? 0) - (b.timestamp ?? 0);
    return newestFirst ? -delta : delta;
  });
}

function buildChannelFilters(
  rows: readonly ChatUiTranscriptRowViewModel[],
  scope: TranscriptDrawerChannelScope,
): ChatUiDrawerFilter[] {
  const ids = ['ALL', 'GLOBAL', 'SYNDICATE', 'DEAL_ROOM'] as const;
  return ids.map((id) => ({
    id,
    label: id === 'ALL' ? 'All Channels' : channelLabel(id),
    active: scope === id,
    count: id === 'ALL' ? rows.length : rows.filter((row) => row.channelId === id).length,
    tone: id === 'ALL' ? 'neutral' : 'premium',
    accent: id === 'ALL' ? 'slate' : id === 'GLOBAL' ? 'silver' : id === 'SYNDICATE' ? 'cyan' : 'amber',
  }));
}

function buildKindFilters(
  rows: readonly ChatUiTranscriptRowViewModel[],
  scope: TranscriptDrawerKindScope,
): ChatUiDrawerFilter[] {
  const kinds = ['ALL', ...Array.from(new Set(rows.map((row) => row.kindId).filter(Boolean) as string[]))];
  return kinds.map((kind) => ({
    id: kind,
    label: kind === 'ALL' ? 'All Kinds' : kindLabel(kind),
    active: scope === kind,
    count: kind === 'ALL' ? rows.length : rows.filter((row) => row.kindId === kind).length,
    tone: kind === 'ALL' ? 'neutral' : 'calm',
    accent: kind === 'ALL' ? 'slate' : 'silver',
  }));
}

function buildSummaryMetrics(rows: readonly ChatUiTranscriptRowViewModel[]): ChatUiMetric[] {
  const proofCount = rows.filter((row) => Boolean(row.proofHashLabel)).length;
  const lockedCount = rows.filter((row) => Boolean(row.locked)).length;
  const playerCount = rows.filter((row) => row.role === 'player').length;
  return [
    { id: 'metric:rows', label: 'Rows', value: String(rows.length), accent: 'silver', tone: 'premium' },
    { id: 'metric:proof', label: 'Proof', value: String(proofCount), accent: 'indigo', tone: 'premium' },
    { id: 'metric:locked', label: 'Locked', value: String(lockedCount), accent: 'obsidian', tone: 'ghost' },
    { id: 'metric:players', label: 'Player', value: String(playerCount), accent: 'emerald', tone: 'supportive' },
  ];
}

function buildHeader(params: BuildTranscriptDrawerSurfaceParams): ChatUiTranscriptDrawerHeaderViewModel {
  return {
    activeChannelId: params.activeChannel,
    roomTitle: params.roomTitle ?? 'Transcript',
    roomSubtitle: params.roomSubtitle,
    modeName: params.modeName,
    connected: params.connected ?? true,
    connectionState: params.connectionState ?? 'CONNECTED',
    onlineCount: params.onlineCount ?? 0,
    activeMembers: params.activeMembers ?? 0,
    typingCount: params.typingCount ?? 0,
    totalUnread: params.totalUnread ?? 0,
    transcriptLocked: params.transcriptLocked ?? false,
  };
}

function buildFilterState(
  rows: readonly ChatUiTranscriptRowViewModel[],
  params: BuildTranscriptDrawerSurfaceParams,
): ChatUiTranscriptDrawerFilterStateViewModel {
  return {
    query: params.searchQuery ?? '',
    channelScope: params.channelScope ?? params.activeChannel,
    kindScope: params.kindScope ?? 'ALL',
    proofOnly: params.proofOnly ?? false,
    lockedOnly: params.lockedOnly ?? false,
    newestFirst: params.newestFirst ?? false,
    channelFilters: buildChannelFilters(rows, params.channelScope ?? params.activeChannel),
    kindFilters: buildKindFilters(rows, params.kindScope ?? 'ALL'),
  };
}

function buildDrawer(
  rows: readonly ChatUiTranscriptRowViewModel[],
  params: BuildTranscriptDrawerSurfaceParams,
): ChatUiTranscriptDrawerViewModel {
  const selected = params.selectedMessageId
    ? rows.find((row) => row.messageId === params.selectedMessageId)
    : undefined;

  const emptyState = rows.length === 0
    ? buildEmptyStateViewModel({
        kind: (params.searchQuery ?? '').trim().length > 0 ? 'filtered_empty' : 'quiet_room',
        title: (params.searchQuery ?? '').trim().length > 0 ? 'No transcript matches' : 'No transcript rows',
        body: (params.searchQuery ?? '').trim().length > 0
          ? 'Try widening your search or scope.'
          : 'There are no visible transcript rows for the current scope.',
      })
    : undefined;

  return {
    open: params.open,
    title: params.roomTitle ?? 'Transcript',
    subtitle: params.roomSubtitle,
    scope: params.channelScope && params.channelScope !== 'ALL' ? 'current_channel' : 'all_visible',
    query: params.searchQuery ?? '',
    filters: [
      { id: 'proofOnly', label: 'Proof Only', active: params.proofOnly ?? false, tone: 'premium', accent: 'indigo' },
      { id: 'lockedOnly', label: 'Locked Only', active: params.lockedOnly ?? false, tone: 'ghost', accent: 'obsidian' },
      { id: 'newestFirst', label: 'Newest First', active: params.newestFirst ?? false, tone: 'dramatic', accent: 'violet' },
    ],
    results: rows.map((row, index) => ({
      id: `result:${row.messageId}:${index}`,
      messageId: row.messageId,
      channelId: row.channelId,
      channelLabel: row.channelLabel,
      authorLabel: row.actorLabel,
      preview: row.body,
      timestampLabel: row.timestampLabel,
      matches: undefined,
      proofLabel: row.proofSummary,
      threatLabel: row.pressureTierLabel,
    })),
    selected: selected
      ? {
          messageId: selected.messageId,
          authorLabel: selected.actorLabel,
          text: selected.body,
          timestampLabel: selected.timestampLabel,
          proofSummary: selected.proofSummary,
          threatSummary: selected.pressureTierLabel,
          integritySummary: selected.locked ? 'Locked transcript row' : undefined,
        }
      : undefined,
    summaryMetrics: buildSummaryMetrics(rows),
    exportReady: rows.length > 0,
    canSearch: true,
    canExport: rows.length > 0,
    emptyState,
  };
}

export function buildTranscriptDrawerSurfaceModel(
  params: BuildTranscriptDrawerSurfaceParams,
): ChatUiTranscriptDrawerSurfaceModel {
  const baseRows = params.messages.map((message) => createRow(message, params.selectedMessageId));
  const filteredRows = sortRows(filterRows(baseRows, params), params.newestFirst ?? false);

  return {
    drawer: buildDrawer(filteredRows, params),
    header: buildHeader(params),
    filterState: buildFilterState(baseRows, params),
    rows: filteredRows,
  };
}

export function createTranscriptDrawerCallbacks(
  params: CreateTranscriptDrawerCallbacksParams,
): ChatUiTranscriptDrawerCallbacks {
  return {
    onClose: params.onClose,
    onSearchQueryChange: params.onSearchQueryChange,
    onSelectChannelScope: params.onSelectChannelScope,
    onSelectKindScope: params.onSelectKindScope,
    onToggleProofOnly: params.onToggleProofOnly,
    onToggleLockedOnly: params.onToggleLockedOnly,
    onToggleNewestFirst: params.onToggleNewestFirst,
    onJumpToMessage: params.onJumpToMessage,
    onRequestExport: params.onRequestExport,
    onJumpLatest: params.onJumpLatest,
  };
}
