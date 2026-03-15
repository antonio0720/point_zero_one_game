
/**
 * ============================================================================
 * POINT ZERO ONE — COMPONENT CHAT UI CONTRACTS
 * FILE: pzo-web/src/components/chat/uiTypes.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical, presentation-only contract surface for the chat shell that lives in:
 *   /pzo-web/src/components/chat
 *
 * This file intentionally becomes the real UI contract home for:
 * - UnifiedChatDock.tsx
 * - useUnifiedChat.ts
 * - ChatComposer.tsx
 * - ChatMessageFeed.tsx
 * - ChatMessageCard.tsx
 * - ChatChannelTabs.tsx
 * - ChatPresenceStrip.tsx
 * - ChatTypingIndicator.tsx
 * - ChatInvasionBanner.tsx
 * - ChatThreatMeter.tsx
 * - ChatHelperPrompt.tsx
 * - ChatCollapsedPill.tsx
 * - ChatTranscriptDrawer.tsx
 * - ChatRoomHeader.tsx
 * - ChatEmptyState.tsx
 *
 * Design law
 * ----------
 * This file may adapt engine and shared-contract truth for rendering, but it may
 * never become a competing source of simulation authority.
 *
 * Therefore this file:
 * - owns view models,
 * - owns display-only unions,
 * - owns render grouping models,
 * - owns adapter helpers from loose/raw payloads into premium UI contracts,
 * - owns presentation severity / accent / display hint vocabulary,
 * - owns drawer/search/filter models,
 * - owns shell-facing runtime guards.
 *
 * This file does NOT:
 * - own transport truth,
 * - define authoritative transcript truth,
 * - define moderation law,
 * - define channel eligibility law,
 * - define hater/helper/NPC orchestration,
 * - define learning truth,
 * - define battle/pressure/zero/simulation truth.
 *
 * Migration note
 * --------------
 * The engine lane may temporarily re-export this file from:
 *   /pzo-web/src/engines/chat/uiTypes.ts
 * until all call sites are moved.
 * ============================================================================
 */

/* ========================================================================== *
 * Section 1 — Core primitive aliases
 * ========================================================================== */

export type UIString = string;
export type UINumber = number;
export type UIBoolean = boolean;

export type ChatUiId = string;
export type ChatUiTimestamp = number;
export type ChatUiIsoTimestamp = string;

export type ChatUiPlayerId = string;
export type ChatUiRoomId = string;
export type ChatUiChannelId = string;
export type ChatUiMessageId = string;
export type ChatUiPersonaId = string;
export type ChatUiSceneId = string;
export type ChatUiProofId = string;
export type ChatUiSearchResultId = string;
export type ChatUiRunId = string;
export type ChatUiMountId = string;

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = T | null | undefined;
export type Dictionary<T = unknown> = Record<string, T>;
export type UnknownRecord = Record<string, unknown>;

export type LooseArray<T = unknown> = T[] | readonly T[];

/* ========================================================================== *
 * Section 2 — Fundamental UI vocabulary
 * ========================================================================== */

export type ChatUiThemeMode = 'light' | 'dark' | 'system';

export type ChatUiTone =
  | 'neutral'
  | 'calm'
  | 'positive'
  | 'supportive'
  | 'warning'
  | 'danger'
  | 'hostile'
  | 'ghost'
  | 'premium'
  | 'stealth'
  | 'celebratory'
  | 'dramatic';

export type ChatUiDensity =
  | 'compact'
  | 'comfortable'
  | 'expanded'
  | 'cinematic';

export type ChatUiImportance =
  | 'low'
  | 'normal'
  | 'elevated'
  | 'high'
  | 'critical';

export type ChatUiUrgency =
  | 'idle'
  | 'low'
  | 'medium'
  | 'high'
  | 'immediate';

export type ChatUiEmphasis =
  | 'subtle'
  | 'standard'
  | 'strong'
  | 'hero'
  | 'suppressed';

export type ChatUiDisplayIntent =
  | 'default'
  | 'alert'
  | 'proof'
  | 'instruction'
  | 'helper'
  | 'threat'
  | 'system'
  | 'celebration'
  | 'deal'
  | 'spectator';

export type ChatUiAccent =
  | 'slate'
  | 'silver'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'red'
  | 'violet'
  | 'cyan'
  | 'indigo'
  | 'gold'
  | 'obsidian';

export type ChatUiChannelKind =
  | 'global'
  | 'syndicate'
  | 'deal_room'
  | 'lobby'
  | 'system'
  | 'shadow'
  | 'direct'
  | 'spectator'
  | 'unknown';

export type ChatUiSourceKind =
  | 'player'
  | 'self'
  | 'helper'
  | 'hater'
  | 'ambient_npc'
  | 'system'
  | 'moderation'
  | 'server'
  | 'liveops'
  | 'deal_room'
  | 'spectator'
  | 'unknown';

export type ChatUiAuthorDisposition =
  | 'friendly'
  | 'neutral'
  | 'hostile'
  | 'predatory'
  | 'guiding'
  | 'spectator'
  | 'systemic'
  | 'unknown';

export type ChatUiMessageKind =
  | 'text'
  | 'system_notice'
  | 'scene_marker'
  | 'divider'
  | 'proof_event'
  | 'threat_event'
  | 'helper_event'
  | 'invasion_event'
  | 'deal_event'
  | 'presence_event'
  | 'typing_event'
  | 'legend_event'
  | 'reward_event'
  | 'empty_hint'
  | 'unknown';

export type ChatUiFeedRowKind =
  | 'message'
  | 'day_break'
  | 'unread_break'
  | 'typing_cluster'
  | 'scene_marker'
  | 'gap_marker'
  | 'load_older'
  | 'empty_state';

export type ChatUiDrawerSectionKind =
  | 'summary'
  | 'filters'
  | 'results'
  | 'selection'
  | 'proof'
  | 'legend'
  | 'export'
  | 'empty';

export type ChatUiPresenceState =
  | 'online'
  | 'away'
  | 'busy'
  | 'spectating'
  | 'hidden'
  | 'offline'
  | 'reconnecting'
  | 'unknown';

export type ChatUiTypingState =
  | 'not_typing'
  | 'typing'
  | 'paused'
  | 'lurking'
  | 'read_wait'
  | 'weaponized_delay';

export type ChatUiThreatBand =
  | 'quiet'
  | 'elevated'
  | 'pressured'
  | 'hostile'
  | 'critical'
  | 'catastrophic';

export type ChatUiIntegrityBand =
  | 'open'
  | 'guarded'
  | 'verified'
  | 'restricted'
  | 'shadowed'
  | 'sealed';

export type ChatUiProofBand =
  | 'none'
  | 'trace'
  | 'linked'
  | 'verified'
  | 'sealed';

export type ChatUiHelperMode =
  | 'soft'
  | 'standard'
  | 'blunt'
  | 'rescue'
  | 'mentor'
  | 'strategic';

export type ChatUiEmptyStateKind =
  | 'cold_start'
  | 'quiet_room'
  | 'loading'
  | 'filtered_empty'
  | 'channel_locked'
  | 'shadow_only'
  | 'connection_lost'
  | 'post_run_reset'
  | 'error';

export type ChatUiSearchScope =
  | 'current_channel'
  | 'current_room'
  | 'all_visible'
  | 'proof_only'
  | 'legend_only'
  | 'helper_only'
  | 'threat_only';

export type ChatUiSortDirection = 'asc' | 'desc';

/* ========================================================================== *
 * Section 3 — Component-level token models
 * ========================================================================== */

export interface ChatUiTokenPack {
  themeMode: ChatUiThemeMode;
  density: ChatUiDensity;
  rounded: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  shadow: 'none' | 'soft' | 'medium' | 'strong';
  borderStyle: 'flat' | 'subtle' | 'sharp' | 'glow';
  glass: UIBoolean;
  motionScale: 'reduced' | 'standard' | 'expressive';
}

export interface ChatUiToneTokens {
  tone: ChatUiTone;
  accent: ChatUiAccent;
  emphasis: ChatUiEmphasis;
  backgroundClass?: UIString;
  borderClass?: UIString;
  textClass?: UIString;
  mutedTextClass?: UIString;
  badgeClass?: UIString;
  ringClass?: UIString;
}

export interface ChatUiDisplayHints {
  compact: UIBoolean;
  highlighted: UIBoolean;
  selectable: UIBoolean;
  actionable: UIBoolean;
  hoverable: UIBoolean;
  keyboardNavigable: UIBoolean;
  truncateBody: UIBoolean;
  showMetaRail: UIBoolean;
  showTimestamp: UIBoolean;
  showAvatar: UIBoolean;
  showPersonaTag: UIBoolean;
  showProofBadges: UIBoolean;
  showThreatBadges: UIBoolean;
  showLearningBadges: UIBoolean;
}

/* ========================================================================== *
 * Section 4 — Generic badges, chips, pills, and metrics
 * ========================================================================== */

export interface ChatUiMetricDelta {
  direction: 'up' | 'down' | 'flat';
  amount?: UINumber;
  label?: UIString;
}

export interface ChatUiMetric {
  id: ChatUiId;
  label: UIString;
  value: UIString;
  rawValue?: UINumber;
  tone?: ChatUiTone;
  accent?: ChatUiAccent;
  importance?: ChatUiImportance;
  delta?: ChatUiMetricDelta;
  tooltip?: UIString;
}

export interface ChatUiChip {
  id: ChatUiId;
  label: UIString;
  shortLabel?: UIString;
  icon?: UIString;
  tone?: ChatUiTone;
  accent?: ChatUiAccent;
  emphasis?: ChatUiEmphasis;
  importance?: ChatUiImportance;
  active?: UIBoolean;
  disabled?: UIBoolean;
  tooltip?: UIString;
  count?: UINumber;
}

export interface ChatUiPill {
  id: ChatUiId;
  label: UIString;
  value?: UIString;
  icon?: UIString;
  tone?: ChatUiTone;
  accent?: ChatUiAccent;
  clickable?: UIBoolean;
  selected?: UIBoolean;
  tooltip?: UIString;
}

export interface ChatUiBadge {
  id: ChatUiId;
  kind:
    | 'proof'
    | 'threat'
    | 'integrity'
    | 'helper'
    | 'hater'
    | 'system'
    | 'presence'
    | 'legend'
    | 'reward'
    | 'channel'
    | 'custom';
  label: UIString;
  shortLabel?: UIString;
  icon?: UIString;
  tone: ChatUiTone;
  accent: ChatUiAccent;
  importance?: ChatUiImportance;
  tooltip?: UIString;
  emphasis?: ChatUiEmphasis;
}

export interface ChatUiRangeIndicator {
  id: ChatUiId;
  label: UIString;
  current: UINumber;
  min: UINumber;
  max: UINumber;
  band?: ChatUiThreatBand;
  tone?: ChatUiTone;
}

/* ========================================================================== *
 * Section 5 — Author, persona, avatar, and source models
 * ========================================================================== */

export interface ChatUiAvatarModel {
  imageUrl?: UIString;
  initials?: UIString;
  emoji?: UIString;
  accent?: ChatUiAccent;
  ringTone?: ChatUiTone;
  outlined?: UIBoolean;
  presenceDot?: ChatUiPresenceState;
}

export interface ChatUiPersonaSignature {
  personaId?: ChatUiPersonaId;
  voiceprintLabel?: UIString;
  cadenceLabel?: UIString;
  attackStyleLabel?: UIString;
  helperModeLabel?: UIString;
  signatureOpener?: UIString;
}

export interface ChatUiAuthorModel {
  id: ChatUiPlayerId | ChatUiPersonaId | ChatUiId;
  displayName: UIString;
  shortName?: UIString;
  sourceKind: ChatUiSourceKind;
  disposition?: ChatUiAuthorDisposition;
  subtitle?: UIString;
  roleLabel?: UIString;
  factionLabel?: UIString;
  avatar?: ChatUiAvatarModel;
  signature?: ChatUiPersonaSignature;
  presence?: ChatUiPresenceState;
  typingState?: ChatUiTypingState;
  isSelf?: UIBoolean;
  isTrusted?: UIBoolean;
  isMuted?: UIBoolean;
  isHidden?: UIBoolean;
}

/* ========================================================================== *
 * Section 6 — Message metadata rails
 * ========================================================================== */

export interface ChatUiTimestampMeta {
  unixMs?: ChatUiTimestamp;
  iso?: ChatUiIsoTimestamp;
  absoluteLabel?: UIString;
  relativeLabel?: UIString;
  displayLabel: UIString;
  bucketKey?: UIString;
}

export interface ChatUiProofMeta {
  proofId?: ChatUiProofId;
  proofBand: ChatUiProofBand;
  proofHashLabel?: UIString;
  proofChainDepth?: UINumber;
  proofSummary?: UIString;
  causalParents?: UIString[];
  verified: UIBoolean;
}

export interface ChatUiThreatMeta {
  band: ChatUiThreatBand;
  score?: UINumber;
  pressureTier?: UIString;
  tickTier?: UIString;
  attackTypeLabel?: UIString;
  dangerSummary?: UIString;
  imminent?: UIBoolean;
}

export interface ChatUiIntegrityMeta {
  band: ChatUiIntegrityBand;
  visibilityLabel?: UIString;
  moderationLabel?: UIString;
  roomLockLabel?: UIString;
  shadowed?: UIBoolean;
  redacted?: UIBoolean;
  edited?: UIBoolean;
}

export interface ChatUiChannelMeta {
  channelId: ChatUiChannelId;
  channelKind: ChatUiChannelKind;
  channelLabel: UIString;
  roomId?: ChatUiRoomId;
  roomLabel?: UIString;
  mountLabel?: UIString;
  reputationLabel?: UIString;
  audienceHeatLabel?: UIString;
}

export interface ChatUiLearningMeta {
  coldStart?: UIBoolean;
  helperBoost?: UIBoolean;
  engagementLabel?: UIString;
  dropOffRiskLabel?: UIString;
  recommendationLabel?: UIString;
  memoryHit?: UIBoolean;
  memoryAnchorLabel?: UIString;
}

export interface ChatUiMessageMetaRail {
  timestamp: ChatUiTimestampMeta;
  proof?: ChatUiProofMeta;
  threat?: ChatUiThreatMeta;
  integrity?: ChatUiIntegrityMeta;
  channel?: ChatUiChannelMeta;
  learning?: ChatUiLearningMeta;
  chips?: ChatUiChip[];
  badges?: ChatUiBadge[];
}

/* ========================================================================== *
 * Section 7 — Rich message content blocks
 * ========================================================================== */

export interface ChatUiInlineEntity {
  id: ChatUiId;
  kind: 'player' | 'npc' | 'channel' | 'proof' | 'event' | 'card' | 'run' | 'unknown';
  label: UIString;
  value?: UIString;
}

export interface ChatUiTextSpan {
  id: ChatUiId;
  text: UIString;
  bold?: UIBoolean;
  italic?: UIBoolean;
  mono?: UIBoolean;
  strike?: UIBoolean;
  tone?: ChatUiTone;
  accent?: ChatUiAccent;
  entity?: ChatUiInlineEntity;
}

export interface ChatUiTextBlock {
  id: ChatUiId;
  kind: 'body' | 'quote' | 'notice' | 'warning' | 'instruction' | 'caption';
  spans: ChatUiTextSpan[];
  truncated?: UIBoolean;
  lineClamp?: UINumber;
}

export interface ChatUiQuotePreview {
  messageId?: ChatUiMessageId;
  authorLabel?: UIString;
  channelLabel?: UIString;
  text: UIString;
  tone?: ChatUiTone;
  accent?: ChatUiAccent;
}

export interface ChatUiAttachment {
  id: ChatUiId;
  kind: 'proof' | 'image' | 'system_card' | 'deal_offer' | 'legend' | 'reward' | 'unknown';
  label: UIString;
  subtitle?: UIString;
  description?: UIString;
  accent?: ChatUiAccent;
  tone?: ChatUiTone;
  actionable?: UIBoolean;
}

export interface ChatUiReaction {
  id: ChatUiId;
  emoji?: UIString;
  label: UIString;
  count: UINumber;
  selected?: UIBoolean;
}

export interface ChatUiCommandHint {
  id: ChatUiId;
  command: UIString;
  label: UIString;
  description?: UIString;
  tone?: ChatUiTone;
}

export interface ChatUiMessageBodyModel {
  primary: ChatUiTextBlock;
  secondary?: ChatUiTextBlock[];
  quote?: ChatUiQuotePreview;
  attachments?: ChatUiAttachment[];
  reactions?: ChatUiReaction[];
  commandHints?: ChatUiCommandHint[];
}

/* ========================================================================== *
 * Section 8 — Message card and feed row models
 * ========================================================================== */

export interface ChatUiMessageCardViewModel {
  id: ChatUiMessageId;
  sceneId?: ChatUiSceneId;
  runId?: ChatUiRunId;
  kind: ChatUiMessageKind;
  author: ChatUiAuthorModel;
  body: ChatUiMessageBodyModel;
  meta: ChatUiMessageMetaRail;
  tone: ChatUiTone;
  accent: ChatUiAccent;
  emphasis: ChatUiEmphasis;
  displayIntent: ChatUiDisplayIntent;
  displayHints: ChatUiDisplayHints;
  selected?: UIBoolean;
  pinned?: UIBoolean;
  unread?: UIBoolean;
  canReply?: UIBoolean;
  canCopy?: UIBoolean;
  canInspectProof?: UIBoolean;
  canJumpToCause?: UIBoolean;
  canMutePersona?: UIBoolean;
  canEscalateModeration?: UIBoolean;
}

export interface ChatUiDayBreakRow {
  id: ChatUiId;
  kind: 'day_break';
  label: UIString;
  timestamp?: ChatUiTimestampMeta;
}

export interface ChatUiUnreadBreakRow {
  id: ChatUiId;
  kind: 'unread_break';
  label: UIString;
  unreadCount?: UINumber;
}

export interface ChatUiSceneMarkerRow {
  id: ChatUiId;
  kind: 'scene_marker';
  label: UIString;
  subtitle?: UIString;
  tone?: ChatUiTone;
  accent?: ChatUiAccent;
  sceneId?: ChatUiSceneId;
}

export interface ChatUiGapMarkerRow {
  id: ChatUiId;
  kind: 'gap_marker';
  label: UIString;
  hiddenCount?: UINumber;
}

export interface ChatUiTypingEntity {
  id: ChatUiId;
  label: UIString;
  sourceKind: ChatUiSourceKind;
  typingState: ChatUiTypingState;
  accent?: ChatUiAccent;
  roleLabel?: UIString;
}

export interface ChatUiTypingClusterRow {
  id: ChatUiId;
  kind: 'typing_cluster';
  entities: ChatUiTypingEntity[];
  label: UIString;
  tone?: ChatUiTone;
}

export interface ChatUiLoadOlderRow {
  id: ChatUiId;
  kind: 'load_older';
  label: UIString;
  available?: UIBoolean;
  pending?: UIBoolean;
}

export interface ChatUiEmptyFeedRow {
  id: ChatUiId;
  kind: 'empty_state';
  model: ChatUiEmptyStateViewModel;
}

export type ChatUiFeedRow =
  | ChatUiMessageCardViewModel
  | ChatUiDayBreakRow
  | ChatUiUnreadBreakRow
  | ChatUiSceneMarkerRow
  | ChatUiGapMarkerRow
  | ChatUiTypingClusterRow
  | ChatUiLoadOlderRow
  | ChatUiEmptyFeedRow;

export interface ChatUiFeedGroup {
  id: ChatUiId;
  label?: UIString;
  channelId?: ChatUiChannelId;
  roomId?: ChatUiRoomId;
  rows: ChatUiFeedRow[];
  firstTimestamp?: ChatUiTimestamp;
  lastTimestamp?: ChatUiTimestamp;
}

export interface ChatUiVisibleRange {
  startIndex: UINumber;
  endIndex: UINumber;
  totalCount: UINumber;
}

export interface ChatUiFeedViewModel {
  groups: ChatUiFeedGroup[];
  flatRows: ChatUiFeedRow[];
  visibleRange?: ChatUiVisibleRange;
  hasOlder: UIBoolean;
  hasNewer: UIBoolean;
  unreadCount: UINumber;
  newestMessageId?: ChatUiMessageId;
  oldestMessageId?: ChatUiMessageId;
}

/* ========================================================================== *
 * Section 9 — Channel tabs
 * ========================================================================== */

export interface ChatUiChannelTabHeat {
  label?: UIString;
  score?: UINumber;
  tone?: ChatUiTone;
  accent?: ChatUiAccent;
}

export interface ChatUiChannelTabCounts {
  unread?: UINumber;
  unseenMentions?: UINumber;
  participantCount?: UINumber;
  threatCount?: UINumber;
}

export interface ChatUiChannelTabViewModel {
  id: ChatUiChannelId;
  kind: ChatUiChannelKind;
  label: UIString;
  shortLabel?: UIString;
  subtitle?: UIString;
  icon?: UIString;
  tone: ChatUiTone;
  accent: ChatUiAccent;
  active: UIBoolean;
  available: UIBoolean;
  locked?: UIBoolean;
  recommended?: UIBoolean;
  counts?: ChatUiChannelTabCounts;
  heat?: ChatUiChannelTabHeat;
  tooltip?: UIString;
}

export interface ChatUiChannelTabsViewModel {
  tabs: ChatUiChannelTabViewModel[];
  activeChannelId?: ChatUiChannelId;
}

/* ========================================================================== *
 * Section 10 — Presence strip and typing indicator models
 * ========================================================================== */

export interface ChatUiPresenceChipViewModel {
  id: ChatUiId;
  actor: ChatUiAuthorModel;
  label: UIString;
  subtitle?: UIString;
  tone?: ChatUiTone;
  accent?: ChatUiAccent;
  urgent?: UIBoolean;
  tooltip?: UIString;
}

export interface ChatUiPresenceStripViewModel {
  chips: ChatUiPresenceChipViewModel[];
  totalOnline?: UINumber;
  totalTyping?: UINumber;
  totalHostile?: UINumber;
  totalHelper?: UINumber;
  totalSpectators?: UINumber;
}

export interface ChatUiTypingIndicatorViewModel {
  entities: ChatUiTypingEntity[];
  label: UIString;
  compactLabel?: UIString;
  tone: ChatUiTone;
  accent: ChatUiAccent;
  visible: UIBoolean;
}

/* ========================================================================== *
 * Section 11 — Invasion, threat, and helper prompt models
 * ========================================================================== */

export interface ChatUiInvasionAction {
  id: ChatUiId;
  label: UIString;
  icon?: UIString;
  tone?: ChatUiTone;
  accent?: ChatUiAccent;
  available?: UIBoolean;
  destructive?: UIBoolean;
}

export interface ChatUiInvasionBannerViewModel {
  id: ChatUiId;
  active: UIBoolean;
  title: UIString;
  subtitle?: UIString;
  summary?: UIString;
  band: ChatUiThreatBand;
  tone: ChatUiTone;
  accent: ChatUiAccent;
  countdownLabel?: UIString;
  sourceLabel?: UIString;
  targetLabel?: UIString;
  actions?: ChatUiInvasionAction[];
  chips?: ChatUiChip[];
}

export interface ChatUiThreatCardViewModel {
  id: ChatUiId;
  label: UIString;
  value: UIString;
  band: ChatUiThreatBand;
  tone: ChatUiTone;
  accent: ChatUiAccent;
  subtitle?: UIString;
  trend?: ChatUiMetricDelta;
}

export interface ChatUiThreatMeterViewModel {
  band: ChatUiThreatBand;
  label: UIString;
  summary?: UIString;
  cards: ChatUiThreatCardViewModel[];
  dominantThreatLabel?: UIString;
  recommendationLabel?: UIString;
  confidenceLabel?: UIString;
}

export interface ChatUiHelperPromptAction {
  id: ChatUiId;
  label: UIString;
  tone?: ChatUiTone;
  accent?: ChatUiAccent;
  primary?: UIBoolean;
  destructive?: UIBoolean;
}

export interface ChatUiHelperPromptViewModel {
  id: ChatUiId;
  visible: UIBoolean;
  mode: ChatUiHelperMode;
  helperLabel: UIString;
  title: UIString;
  body: UIString;
  summary?: UIString;
  tone: ChatUiTone;
  accent: ChatUiAccent;
  actions?: ChatUiHelperPromptAction[];
  chips?: ChatUiChip[];
  urgency?: ChatUiUrgency;
}

/* ========================================================================== *
 * Section 12 — Collapsed pill, room header, empty state
 * ========================================================================== */

export interface ChatUiCollapsedPillViewModel {
  id: ChatUiId;
  label: UIString;
  shortLabel?: UIString;
  unreadCount?: UINumber;
  threatBand?: ChatUiThreatBand;
  typingCount?: UINumber;
  helperVisible?: UIBoolean;
  invasionActive?: UIBoolean;
  accent: ChatUiAccent;
  tone: ChatUiTone;
  expanded?: UIBoolean;
  tooltip?: UIString;
}

export interface ChatUiRoomHeaderAction {
  id: ChatUiId;
  label: UIString;
  icon?: UIString;
  tone?: ChatUiTone;
  accent?: ChatUiAccent;
  primary?: UIBoolean;
  disabled?: UIBoolean;
}

export interface ChatUiRoomHeaderViewModel {
  roomId?: ChatUiRoomId;
  roomLabel: UIString;
  roomSubtitle?: UIString;
  channelLabel?: UIString;
  channelKind?: ChatUiChannelKind;
  roomTone?: ChatUiTone;
  roomAccent?: ChatUiAccent;
  chips?: ChatUiChip[];
  metrics?: ChatUiMetric[];
  actions?: ChatUiRoomHeaderAction[];
  audienceHeatLabel?: UIString;
  reputationLabel?: UIString;
  integrityLabel?: UIString;
}

export interface ChatUiEmptyStateViewModel {
  id: ChatUiId;
  kind: ChatUiEmptyStateKind;
  title: UIString;
  body: UIString;
  hint?: UIString;
  tone: ChatUiTone;
  accent: ChatUiAccent;
  actions?: ChatUiRoomHeaderAction[];
  chips?: ChatUiChip[];
}

/* ========================================================================== *
 * Section 13 — Transcript drawer models
 * ========================================================================== */

export interface ChatUiDrawerFilter {
  id: ChatUiId;
  label: UIString;
  active: UIBoolean;
  count?: UINumber;
  tone?: ChatUiTone;
  accent?: ChatUiAccent;
}

export interface ChatUiSearchMatchRange {
  start: UINumber;
  end: UINumber;
}

export interface ChatUiTranscriptSearchResultViewModel {
  id: ChatUiSearchResultId;
  messageId: ChatUiMessageId;
  channelId?: ChatUiChannelId;
  channelLabel?: UIString;
  authorLabel?: UIString;
  preview: UIString;
  timestampLabel?: UIString;
  matches?: ChatUiSearchMatchRange[];
  proofLabel?: UIString;
  threatLabel?: UIString;
}

export interface ChatUiTranscriptDrawerSelection {
  messageId?: ChatUiMessageId;
  authorLabel?: UIString;
  text?: UIString;
  timestampLabel?: UIString;
  proofSummary?: UIString;
  threatSummary?: UIString;
  integritySummary?: UIString;
}

export interface ChatUiTranscriptDrawerViewModel {
  open: UIBoolean;
  title: UIString;
  subtitle?: UIString;
  scope: ChatUiSearchScope;
  query: UIString;
  filters: ChatUiDrawerFilter[];
  results: ChatUiTranscriptSearchResultViewModel[];
  selected?: ChatUiTranscriptDrawerSelection;
  summaryMetrics?: ChatUiMetric[];
  exportReady?: UIBoolean;
  canSearch?: UIBoolean;
  canExport?: UIBoolean;
  emptyState?: ChatUiEmptyStateViewModel;
}

/* ========================================================================== *
 * Section 14 — Unified shell view model
 * ========================================================================== */

export interface ChatUiComposerQuickInsert {
  id: ChatUiId;
  label: UIString;
  value: UIString;
  tone?: ChatUiTone;
  accent?: ChatUiAccent;
}

export interface ChatUiComposerReplyTarget {
  messageId: ChatUiMessageId;
  authorLabel?: UIString;
  preview: UIString;
}

export interface ChatUiComposerViewModel {
  draft: UIString;
  placeholder: UIString;
  disabled?: UIBoolean;
  sending?: UIBoolean;
  cooldownLabel?: UIString;
  selectedChannelId?: ChatUiChannelId;
  quickInserts?: ChatUiComposerQuickInsert[];
  replyTarget?: ChatUiComposerReplyTarget;
  hints?: ChatUiCommandHint[];
}

export interface ChatUiShellStatus {
  connected: UIBoolean;
  hydrated: UIBoolean;
  syncing?: UIBoolean;
  degraded?: UIBoolean;
  stale?: UIBoolean;
  errorLabel?: UIString;
}

export interface ChatUiUnifiedShellViewModel {
  mountId?: ChatUiMountId;
  roomHeader: ChatUiRoomHeaderViewModel;
  channelTabs: ChatUiChannelTabsViewModel;
  feed: ChatUiFeedViewModel;
  composer: ChatUiComposerViewModel;
  presence: ChatUiPresenceStripViewModel;
  typing: ChatUiTypingIndicatorViewModel;
  invasion?: ChatUiInvasionBannerViewModel;
  threat: ChatUiThreatMeterViewModel;
  helperPrompt?: ChatUiHelperPromptViewModel;
  collapsedPill: ChatUiCollapsedPillViewModel;
  transcriptDrawer: ChatUiTranscriptDrawerViewModel;
  emptyState?: ChatUiEmptyStateViewModel;
  status: ChatUiShellStatus;
}

/* ========================================================================== *
 * Section 15 — Loose/raw source adapters
 * ========================================================================== */

export interface ChatUiLooseMessageSource extends UnknownRecord {}
export interface ChatUiLooseChannelSource extends UnknownRecord {}
export interface ChatUiLoosePresenceSource extends UnknownRecord {}
export interface ChatUiLooseThreatSource extends UnknownRecord {}
export interface ChatUiLooseHelperSource extends UnknownRecord {}
export interface ChatUiLooseDrawerSource extends UnknownRecord {}

/* ========================================================================== *
 * Section 16 — Defaults
 * ========================================================================== */

export const CHAT_UI_DEFAULT_TOKEN_PACK: Readonly<ChatUiTokenPack> = Object.freeze({
  themeMode: 'system',
  density: 'comfortable',
  rounded: 'xl',
  shadow: 'soft',
  borderStyle: 'subtle',
  glass: false,
  motionScale: 'standard',
});

export const CHAT_UI_DEFAULT_DISPLAY_HINTS: Readonly<ChatUiDisplayHints> = Object.freeze({
  compact: false,
  highlighted: false,
  selectable: false,
  actionable: true,
  hoverable: true,
  keyboardNavigable: true,
  truncateBody: false,
  showMetaRail: true,
  showTimestamp: true,
  showAvatar: true,
  showPersonaTag: true,
  showProofBadges: true,
  showThreatBadges: true,
  showLearningBadges: false,
});

export const CHAT_UI_EMPTY_STATUS: Readonly<ChatUiShellStatus> = Object.freeze({
  connected: true,
  hydrated: true,
  syncing: false,
  degraded: false,
  stale: false,
});

export const CHAT_UI_EMPTY_FEED: Readonly<ChatUiFeedViewModel> = Object.freeze({
  groups: [],
  flatRows: [],
  hasOlder: false,
  hasNewer: false,
  unreadCount: 0,
});

export const CHAT_UI_EMPTY_PRESENCE: Readonly<ChatUiPresenceStripViewModel> = Object.freeze({
  chips: [],
  totalOnline: 0,
  totalTyping: 0,
  totalHostile: 0,
  totalHelper: 0,
  totalSpectators: 0,
});

export const CHAT_UI_EMPTY_TYPING: Readonly<ChatUiTypingIndicatorViewModel> = Object.freeze({
  entities: [],
  label: '',
  compactLabel: '',
  tone: 'neutral',
  accent: 'slate',
  visible: false,
});

export const CHAT_UI_EMPTY_THREAT: Readonly<ChatUiThreatMeterViewModel> = Object.freeze({
  band: 'quiet',
  label: 'Quiet',
  summary: 'No active threat pressure.',
  cards: [],
  dominantThreatLabel: '',
  recommendationLabel: '',
  confidenceLabel: '',
});

/* ========================================================================== *
 * Section 17 — Utility guards and coercers
 * ========================================================================== */

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

export function asString(value: unknown, fallback = ''): UIString {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return fallback;
}

export function asNonEmptyString(value: unknown, fallback = ''): UIString {
  const next = asString(value, fallback).trim();
  return next.length > 0 ? next : fallback;
}

export function asNumber(value: unknown, fallback = 0): UINumber {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function asBoolean(value: unknown, fallback = false): UIBoolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    if (lowered === 'true') return true;
    if (lowered === 'false') return false;
  }
  return fallback;
}

export function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? [...value] as T[] : [];
}

export function toId(prefix: UIString, value: unknown, fallbackSuffix = 'unknown'): ChatUiId {
  const suffix = asNonEmptyString(value, fallbackSuffix)
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, '-');
  return `${prefix}:${suffix}`;
}

export function uniqueById<T extends { id: ChatUiId }>(items: readonly T[]): T[] {
  const seen = new Set<ChatUiId>();
  const result: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

/* ========================================================================== *
 * Section 18 — Normalizers
 * ========================================================================== */

export function normalizeChannelKind(value: unknown): ChatUiChannelKind {
  const next = asNonEmptyString(value).toLowerCase();
  switch (next) {
    case 'global':
    case 'chat_channel_global':
      return 'global';
    case 'syndicate':
    case 'alliance':
      return 'syndicate';
    case 'deal_room':
    case 'dealroom':
    case 'deal-room':
    case 'deal':
      return 'deal_room';
    case 'lobby':
      return 'lobby';
    case 'system':
      return 'system';
    case 'shadow':
      return 'shadow';
    case 'direct':
    case 'dm':
      return 'direct';
    case 'spectator':
      return 'spectator';
    default:
      return 'unknown';
  }
}

export function normalizeSourceKind(value: unknown): ChatUiSourceKind {
  const next = asNonEmptyString(value).toLowerCase();
  switch (next) {
    case 'player':
      return 'player';
    case 'self':
      return 'self';
    case 'helper':
      return 'helper';
    case 'hater':
      return 'hater';
    case 'ambient_npc':
    case 'npc':
    case 'ambient':
      return 'ambient_npc';
    case 'system':
      return 'system';
    case 'moderation':
      return 'moderation';
    case 'server':
      return 'server';
    case 'liveops':
      return 'liveops';
    case 'deal':
    case 'deal_room':
      return 'deal_room';
    case 'spectator':
      return 'spectator';
    default:
      return 'unknown';
  }
}

export function normalizePresenceState(value: unknown): ChatUiPresenceState {
  const next = asNonEmptyString(value).toLowerCase();
  switch (next) {
    case 'online':
      return 'online';
    case 'away':
      return 'away';
    case 'busy':
      return 'busy';
    case 'spectating':
    case 'spectator':
      return 'spectating';
    case 'hidden':
      return 'hidden';
    case 'offline':
      return 'offline';
    case 'reconnecting':
      return 'reconnecting';
    default:
      return 'unknown';
  }
}

export function normalizeTypingState(value: unknown): ChatUiTypingState {
  const next = asNonEmptyString(value).toLowerCase();
  switch (next) {
    case 'typing':
      return 'typing';
    case 'paused':
      return 'paused';
    case 'lurking':
      return 'lurking';
    case 'read_wait':
    case 'readwait':
      return 'read_wait';
    case 'weaponized_delay':
    case 'delay':
      return 'weaponized_delay';
    default:
      return 'not_typing';
  }
}

export function normalizeThreatBand(value: unknown): ChatUiThreatBand {
  const next = asNonEmptyString(value).toLowerCase();
  switch (next) {
    case 'quiet':
      return 'quiet';
    case 'elevated':
      return 'elevated';
    case 'pressured':
    case 'pressure':
      return 'pressured';
    case 'hostile':
      return 'hostile';
    case 'critical':
      return 'critical';
    case 'catastrophic':
      return 'catastrophic';
    default:
      return 'quiet';
  }
}

export function normalizeIntegrityBand(value: unknown): ChatUiIntegrityBand {
  const next = asNonEmptyString(value).toLowerCase();
  switch (next) {
    case 'open':
      return 'open';
    case 'guarded':
      return 'guarded';
    case 'verified':
      return 'verified';
    case 'restricted':
      return 'restricted';
    case 'shadowed':
      return 'shadowed';
    case 'sealed':
      return 'sealed';
    default:
      return 'open';
  }
}

export function normalizeProofBand(value: unknown): ChatUiProofBand {
  const next = asNonEmptyString(value).toLowerCase();
  switch (next) {
    case 'trace':
      return 'trace';
    case 'linked':
      return 'linked';
    case 'verified':
      return 'verified';
    case 'sealed':
      return 'sealed';
    default:
      return 'none';
  }
}

export function normalizeTone(value: unknown): ChatUiTone {
  const next = asNonEmptyString(value).toLowerCase();
  switch (next) {
    case 'calm':
    case 'positive':
    case 'supportive':
    case 'warning':
    case 'danger':
    case 'hostile':
    case 'ghost':
    case 'premium':
    case 'stealth':
    case 'celebratory':
    case 'dramatic':
      return next as ChatUiTone;
    default:
      return 'neutral';
  }
}

export function normalizeAccent(value: unknown): ChatUiAccent {
  const next = asNonEmptyString(value).toLowerCase();
  switch (next) {
    case 'silver':
    case 'emerald':
    case 'amber':
    case 'rose':
    case 'red':
    case 'violet':
    case 'cyan':
    case 'indigo':
    case 'gold':
    case 'obsidian':
      return next as ChatUiAccent;
    default:
      return 'slate';
  }
}

export function normalizeMessageKind(value: unknown): ChatUiMessageKind {
  const next = asNonEmptyString(value).toLowerCase();
  switch (next) {
    case 'text':
    case 'system_notice':
    case 'scene_marker':
    case 'divider':
    case 'proof_event':
    case 'threat_event':
    case 'helper_event':
    case 'invasion_event':
    case 'deal_event':
    case 'presence_event':
    case 'typing_event':
    case 'legend_event':
    case 'reward_event':
    case 'empty_hint':
      return next as ChatUiMessageKind;
    default:
      return 'unknown';
  }
}

/* ========================================================================== *
 * Section 19 — Common builders
 * ========================================================================== */

export function createTimestampMeta(
  raw: unknown,
  fallbackLabel = 'Now',
): ChatUiTimestampMeta {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const date = new Date(raw);
    return {
      unixMs: raw,
      iso: date.toISOString(),
      absoluteLabel: date.toLocaleString(),
      relativeLabel: '',
      displayLabel: date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      bucketKey: `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
    };
  }

  if (typeof raw === 'string' && raw.trim().length > 0) {
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) {
      return createTimestampMeta(parsed, fallbackLabel);
    }
    return {
      iso: raw,
      displayLabel: raw,
      bucketKey: raw,
    };
  }

  return {
    displayLabel: fallbackLabel,
    bucketKey: 'unknown',
  };
}

export function createAuthorModel(raw: unknown, fallbackName = 'Unknown'): ChatUiAuthorModel {
  const source = asRecord(raw);
  const displayName = asNonEmptyString(
    source.displayName ?? source.name ?? source.label ?? source.author,
    fallbackName,
  );
  const sourceKind = normalizeSourceKind(source.sourceKind ?? source.source ?? source.kind);
  const disposition = normalizeAuthorDisposition(source.disposition ?? source.role ?? source.kind);

  return {
    id: asNonEmptyString(source.id ?? source.playerId ?? source.personaId, toId('author', displayName)),
    displayName,
    shortName: asNonEmptyString(source.shortName ?? source.initials, ''),
    sourceKind,
    disposition,
    subtitle: asNonEmptyString(source.subtitle ?? source.roleLabel, ''),
    roleLabel: asNonEmptyString(source.roleLabel ?? source.role, ''),
    factionLabel: asNonEmptyString(source.factionLabel ?? source.faction, ''),
    avatar: createAvatarModel(source.avatar ?? source),
    signature: createPersonaSignature(source.signature ?? source),
    presence: normalizePresenceState(source.presence),
    typingState: normalizeTypingState(source.typingState),
    isSelf: asBoolean(source.isSelf),
    isTrusted: asBoolean(source.isTrusted),
    isMuted: asBoolean(source.isMuted),
    isHidden: asBoolean(source.isHidden),
  };
}

export function normalizeAuthorDisposition(value: unknown): ChatUiAuthorDisposition {
  const next = asNonEmptyString(value).toLowerCase();
  switch (next) {
    case 'friendly':
    case 'neutral':
    case 'hostile':
    case 'predatory':
    case 'guiding':
    case 'spectator':
    case 'systemic':
      return next as ChatUiAuthorDisposition;
    case 'helper':
    case 'mentor':
      return 'guiding';
    case 'hater':
      return 'hostile';
    case 'system':
      return 'systemic';
    default:
      return 'unknown';
  }
}

export function createAvatarModel(raw: unknown): ChatUiAvatarModel {
  const source = asRecord(raw);
  return {
    imageUrl: asNonEmptyString(source.imageUrl ?? source.avatarUrl ?? source.image, ''),
    initials: asNonEmptyString(source.initials, ''),
    emoji: asNonEmptyString(source.emoji, ''),
    accent: normalizeAccent(source.accent),
    ringTone: normalizeTone(source.ringTone ?? source.tone),
    outlined: asBoolean(source.outlined),
    presenceDot: normalizePresenceState(source.presenceDot ?? source.presence),
  };
}

export function createPersonaSignature(raw: unknown): ChatUiPersonaSignature | undefined {
  const source = asRecord(raw);
  const personaId = asNonEmptyString(source.personaId ?? source.id, '');
  const voiceprintLabel = asNonEmptyString(source.voiceprintLabel ?? source.voiceprint, '');
  const cadenceLabel = asNonEmptyString(source.cadenceLabel ?? source.cadence, '');
  const attackStyleLabel = asNonEmptyString(source.attackStyleLabel ?? source.attackStyle, '');
  const helperModeLabel = asNonEmptyString(source.helperModeLabel ?? source.helperMode, '');
  const signatureOpener = asNonEmptyString(source.signatureOpener ?? source.opener, '');

  if (
    !personaId &&
    !voiceprintLabel &&
    !cadenceLabel &&
    !attackStyleLabel &&
    !helperModeLabel &&
    !signatureOpener
  ) {
    return undefined;
  }

  return {
    personaId,
    voiceprintLabel,
    cadenceLabel,
    attackStyleLabel,
    helperModeLabel,
    signatureOpener,
  };
}

export function createProofMeta(raw: unknown): ChatUiProofMeta | undefined {
  const source = asRecord(raw);
  if (Object.keys(source).length === 0) return undefined;

  return {
    proofId: asNonEmptyString(source.proofId ?? source.id, ''),
    proofBand: normalizeProofBand(source.proofBand ?? source.band),
    proofHashLabel: asNonEmptyString(source.proofHashLabel ?? source.hash ?? source.proofHash, ''),
    proofChainDepth: asNumber(source.proofChainDepth ?? source.depth, 0),
    proofSummary: asNonEmptyString(source.proofSummary ?? source.summary, ''),
    causalParents: asArray<string>(source.causalParents ?? source.parents).map((v) => asString(v)).filter(Boolean),
    verified: asBoolean(source.verified, normalizeProofBand(source.proofBand ?? source.band) === 'verified'),
  };
}

export function createThreatMeta(raw: unknown): ChatUiThreatMeta | undefined {
  const source = asRecord(raw);
  if (Object.keys(source).length === 0) return undefined;

  return {
    band: normalizeThreatBand(source.band ?? source.threatBand),
    score: asNumber(source.score ?? source.threatScore, 0),
    pressureTier: asNonEmptyString(source.pressureTier, ''),
    tickTier: asNonEmptyString(source.tickTier, ''),
    attackTypeLabel: asNonEmptyString(source.attackTypeLabel ?? source.attackType, ''),
    dangerSummary: asNonEmptyString(source.dangerSummary ?? source.summary, ''),
    imminent: asBoolean(source.imminent),
  };
}

export function createIntegrityMeta(raw: unknown): ChatUiIntegrityMeta | undefined {
  const source = asRecord(raw);
  if (Object.keys(source).length === 0) return undefined;

  return {
    band: normalizeIntegrityBand(source.band ?? source.integrityBand),
    visibilityLabel: asNonEmptyString(source.visibilityLabel ?? source.visibility, ''),
    moderationLabel: asNonEmptyString(source.moderationLabel ?? source.moderation, ''),
    roomLockLabel: asNonEmptyString(source.roomLockLabel ?? source.roomLock, ''),
    shadowed: asBoolean(source.shadowed),
    redacted: asBoolean(source.redacted),
    edited: asBoolean(source.edited),
  };
}

export function createChannelMeta(raw: unknown): ChatUiChannelMeta | undefined {
  const source = asRecord(raw);
  const channelId = asNonEmptyString(source.channelId ?? source.id, '');
  const channelLabel = asNonEmptyString(source.channelLabel ?? source.label, '');

  if (!channelId && !channelLabel) return undefined;

  return {
    channelId: channelId || toId('channel', channelLabel || 'unknown'),
    channelKind: normalizeChannelKind(source.channelKind ?? source.kind),
    channelLabel: channelLabel || 'Unknown Channel',
    roomId: asNonEmptyString(source.roomId, ''),
    roomLabel: asNonEmptyString(source.roomLabel, ''),
    mountLabel: asNonEmptyString(source.mountLabel, ''),
    reputationLabel: asNonEmptyString(source.reputationLabel, ''),
    audienceHeatLabel: asNonEmptyString(source.audienceHeatLabel, ''),
  };
}

export function createLearningMeta(raw: unknown): ChatUiLearningMeta | undefined {
  const source = asRecord(raw);
  if (Object.keys(source).length === 0) return undefined;

  return {
    coldStart: asBoolean(source.coldStart),
    helperBoost: asBoolean(source.helperBoost),
    engagementLabel: asNonEmptyString(source.engagementLabel, ''),
    dropOffRiskLabel: asNonEmptyString(source.dropOffRiskLabel, ''),
    recommendationLabel: asNonEmptyString(source.recommendationLabel, ''),
    memoryHit: asBoolean(source.memoryHit),
    memoryAnchorLabel: asNonEmptyString(source.memoryAnchorLabel, ''),
  };
}

export function createMessageMetaRail(raw: unknown): ChatUiMessageMetaRail {
  const source = asRecord(raw);
  return {
    timestamp: createTimestampMeta(source.timestamp ?? source.createdAt ?? source.time),
    proof: createProofMeta(source.proof),
    threat: createThreatMeta(source.threat),
    integrity: createIntegrityMeta(source.integrity),
    channel: createChannelMeta(source.channel),
    learning: createLearningMeta(source.learning),
    chips: createChips(asArray(source.chips)),
    badges: createBadges(asArray(source.badges)),
  };
}

export function createTextBlock(
  raw: unknown,
  fallbackText = '',
  kind: ChatUiTextBlock['kind'] = 'body',
): ChatUiTextBlock {
  if (typeof raw === 'string') {
    return {
      id: toId('text', raw.slice(0, 32) || 'body'),
      kind,
      spans: [{ id: toId('span', raw.slice(0, 24) || 'body'), text: raw }],
    };
  }

  const source = asRecord(raw);
  const spansSource = asArray(source.spans);
  const spans = spansSource.length > 0
    ? spansSource.map(createTextSpan)
    : [{ id: toId('span', fallbackText || 'body'), text: asNonEmptyString(source.text, fallbackText) }];

  return {
    id: asNonEmptyString(source.id, toId('text', kind)),
    kind,
    spans,
    truncated: asBoolean(source.truncated),
    lineClamp: asNumber(source.lineClamp, 0) || undefined,
  };
}

export function createTextSpan(raw: unknown): ChatUiTextSpan {
  const source = asRecord(raw);
  const text = asNonEmptyString(source.text, '');
  return {
    id: asNonEmptyString(source.id, toId('span', text || 'segment')),
    text,
    bold: asBoolean(source.bold),
    italic: asBoolean(source.italic),
    mono: asBoolean(source.mono),
    strike: asBoolean(source.strike),
    tone: normalizeTone(source.tone),
    accent: normalizeAccent(source.accent),
    entity: createInlineEntity(source.entity),
  };
}

export function createInlineEntity(raw: unknown): ChatUiInlineEntity | undefined {
  const source = asRecord(raw);
  const label = asNonEmptyString(source.label, '');
  if (!label) return undefined;
  return {
    id: asNonEmptyString(source.id, toId('entity', label)),
    kind: normalizeInlineEntityKind(source.kind),
    label,
    value: asNonEmptyString(source.value, ''),
  };
}

export function normalizeInlineEntityKind(value: unknown): ChatUiInlineEntity['kind'] {
  const next = asNonEmptyString(value).toLowerCase();
  switch (next) {
    case 'player':
    case 'npc':
    case 'channel':
    case 'proof':
    case 'event':
    case 'card':
    case 'run':
      return next as ChatUiInlineEntity['kind'];
    default:
      return 'unknown';
  }
}

export function createBodyModel(raw: unknown): ChatUiMessageBodyModel {
  const source = asRecord(raw);
  const primary = createTextBlock(
    source.primary ?? source.body ?? source.text,
    asNonEmptyString(source.text, ''),
    'body',
  );

  return {
    primary,
    secondary: asArray(source.secondary).map((item) => createTextBlock(item, '', 'caption')),
    quote: createQuotePreview(source.quote),
    attachments: asArray(source.attachments).map(createAttachment),
    reactions: asArray(source.reactions).map(createReaction),
    commandHints: asArray(source.commandHints).map(createCommandHint),
  };
}

export function createQuotePreview(raw: unknown): ChatUiQuotePreview | undefined {
  const source = asRecord(raw);
  const text = asNonEmptyString(source.text ?? source.preview, '');
  if (!text) return undefined;
  return {
    messageId: asNonEmptyString(source.messageId, ''),
    authorLabel: asNonEmptyString(source.authorLabel, ''),
    channelLabel: asNonEmptyString(source.channelLabel, ''),
    text,
    tone: normalizeTone(source.tone),
    accent: normalizeAccent(source.accent),
  };
}

export function createAttachment(raw: unknown): ChatUiAttachment {
  const source = asRecord(raw);
  return {
    id: asNonEmptyString(source.id, toId('attachment', source.label ?? source.kind ?? 'unknown')),
    kind: normalizeAttachmentKind(source.kind),
    label: asNonEmptyString(source.label, 'Attachment'),
    subtitle: asNonEmptyString(source.subtitle, ''),
    description: asNonEmptyString(source.description, ''),
    accent: normalizeAccent(source.accent),
    tone: normalizeTone(source.tone),
    actionable: asBoolean(source.actionable, true),
  };
}

export function normalizeAttachmentKind(value: unknown): ChatUiAttachment['kind'] {
  const next = asNonEmptyString(value).toLowerCase();
  switch (next) {
    case 'proof':
    case 'image':
    case 'system_card':
    case 'deal_offer':
    case 'legend':
    case 'reward':
      return next as ChatUiAttachment['kind'];
    default:
      return 'unknown';
  }
}

export function createReaction(raw: unknown): ChatUiReaction {
  const source = asRecord(raw);
  return {
    id: asNonEmptyString(source.id, toId('reaction', source.label ?? source.emoji ?? 'reaction')),
    emoji: asNonEmptyString(source.emoji, ''),
    label: asNonEmptyString(source.label, ''),
    count: asNumber(source.count, 0),
    selected: asBoolean(source.selected),
  };
}

export function createCommandHint(raw: unknown): ChatUiCommandHint {
  const source = asRecord(raw);
  return {
    id: asNonEmptyString(source.id, toId('command', source.command ?? source.label ?? 'command')),
    command: asNonEmptyString(source.command, ''),
    label: asNonEmptyString(source.label, ''),
    description: asNonEmptyString(source.description, ''),
    tone: normalizeTone(source.tone),
  };
}

export function createMessageCard(raw: unknown): ChatUiMessageCardViewModel {
  const source = asRecord(raw);
  const id = asNonEmptyString(source.id ?? source.messageId, toId('message', source.text ?? source.body ?? 'message'));
  const sourceKind = normalizeSourceKind(source.sourceKind ?? source.source ?? source.authorType);
  const threatSource = asRecord(source.threat);
  const channelSource = asRecord(source.channel);
  const tone = inferMessageTone(sourceKind, normalizeThreatBand(source.threatBand ?? threatSource.band));
  const accent = inferMessageAccent(sourceKind, normalizeChannelKind(source.channelKind ?? channelSource.kind));
  const proof = createProofMeta(source.proof ?? source);
  const threat = createThreatMeta(source.threat ?? source);
  const integrity = createIntegrityMeta(source.integrity ?? source);
  const channel = createChannelMeta(source.channel ?? source);

  return {
    id,
    sceneId: asNonEmptyString(source.sceneId, ''),
    runId: asNonEmptyString(source.runId, ''),
    kind: normalizeMessageKind(source.kind),
    author: createAuthorModel(source.author ?? source, inferAuthorFallbackName(sourceKind)),
    body: createBodyModel(source.body ?? source),
    meta: {
      timestamp: createTimestampMeta(source.timestamp ?? source.createdAt ?? source.time),
      proof,
      threat,
      integrity,
      channel,
      learning: createLearningMeta(source.learning),
      chips: createChips(asArray(source.chips)),
      badges: createBadges(asArray(source.badges)),
    },
    tone,
    accent,
    emphasis: inferMessageEmphasis(source),
    displayIntent: inferDisplayIntent(sourceKind, threat?.band),
    displayHints: {
      ...CHAT_UI_DEFAULT_DISPLAY_HINTS,
      highlighted: asBoolean(source.highlighted),
      selectable: asBoolean(source.selectable),
      truncateBody: asBoolean(source.truncateBody),
      showLearningBadges: asBoolean(source.showLearningBadges),
    },
    selected: asBoolean(source.selected),
    pinned: asBoolean(source.pinned),
    unread: asBoolean(source.unread),
    canReply: asBoolean(source.canReply, sourceKind !== 'system'),
    canCopy: asBoolean(source.canCopy, true),
    canInspectProof: asBoolean(source.canInspectProof, Boolean(proof)),
    canJumpToCause: asBoolean(source.canJumpToCause, Boolean(proof?.causalParents && proof.causalParents.length > 0)),
    canMutePersona: asBoolean(source.canMutePersona, sourceKind === 'helper' || sourceKind === 'hater' || sourceKind === 'ambient_npc'),
    canEscalateModeration: asBoolean(source.canEscalateModeration, sourceKind === 'hater'),
  };
}

export function inferAuthorFallbackName(sourceKind: ChatUiSourceKind): UIString {
  switch (sourceKind) {
    case 'helper':
      return 'Helper';
    case 'hater':
      return 'Hater';
    case 'ambient_npc':
      return 'NPC';
    case 'system':
      return 'System';
    case 'liveops':
      return 'LiveOps';
    case 'deal_room':
      return 'Deal';
    case 'spectator':
      return 'Spectator';
    case 'self':
      return 'You';
    default:
      return 'Player';
  }
}

export function inferMessageTone(
  sourceKind: ChatUiSourceKind,
  threatBand: ChatUiThreatBand,
): ChatUiTone {
  if (sourceKind === 'helper') return 'supportive';
  if (sourceKind === 'hater') return threatBand === 'critical' || threatBand === 'catastrophic' ? 'danger' : 'hostile';
  if (sourceKind === 'system') return 'premium';
  if (sourceKind === 'liveops') return 'dramatic';
  if (sourceKind === 'deal_room') return 'warning';
  if (threatBand === 'critical' || threatBand === 'catastrophic') return 'danger';
  return 'neutral';
}

export function inferMessageAccent(
  sourceKind: ChatUiSourceKind,
  channelKind: ChatUiChannelKind,
): ChatUiAccent {
  if (sourceKind === 'helper') return 'emerald';
  if (sourceKind === 'hater') return 'red';
  if (sourceKind === 'system') return 'indigo';
  if (sourceKind === 'liveops') return 'violet';
  if (channelKind === 'deal_room') return 'amber';
  if (channelKind === 'syndicate') return 'cyan';
  if (channelKind === 'global') return 'silver';
  if (channelKind === 'shadow') return 'obsidian';
  return 'slate';
}

export function inferMessageEmphasis(raw: UnknownRecord): ChatUiEmphasis {
  if (asBoolean(raw.highlighted)) return 'hero';
  if (asBoolean(raw.suppressed) || asBoolean(raw.shadowed)) return 'suppressed';
  if (asBoolean(raw.pinned) || asBoolean(raw.legendary)) return 'strong';
  return 'standard';
}

export function inferDisplayIntent(
  sourceKind: ChatUiSourceKind,
  threatBand?: ChatUiThreatBand,
): ChatUiDisplayIntent {
  if (sourceKind === 'helper') return 'helper';
  if (sourceKind === 'hater') return 'threat';
  if (sourceKind === 'system') return 'system';
  if (sourceKind === 'deal_room') return 'deal';
  if (sourceKind === 'spectator') return 'spectator';
  if (sourceKind === 'liveops') return 'alert';
  if (threatBand && ['hostile', 'critical', 'catastrophic'].includes(threatBand)) return 'threat';
  return 'default';
}

export function createChips(values: readonly unknown[]): ChatUiChip[] {
  return values.map((raw, index) => {
    const source = asRecord(raw);
    return {
      id: asNonEmptyString(source.id, `chip:${index}`),
      label: asNonEmptyString(source.label, 'Chip'),
      shortLabel: asNonEmptyString(source.shortLabel, ''),
      icon: asNonEmptyString(source.icon, ''),
      tone: normalizeTone(source.tone),
      accent: normalizeAccent(source.accent),
      emphasis: asNonEmptyString(source.emphasis, 'standard') as ChatUiEmphasis,
      importance: asNonEmptyString(source.importance, 'normal') as ChatUiImportance,
      active: asBoolean(source.active),
      disabled: asBoolean(source.disabled),
      tooltip: asNonEmptyString(source.tooltip, ''),
      count: asNumber(source.count, 0) || undefined,
    };
  });
}

export function createBadges(values: readonly unknown[]): ChatUiBadge[] {
  return values.map((raw, index) => {
    const source = asRecord(raw);
    return {
      id: asNonEmptyString(source.id, `badge:${index}`),
      kind: normalizeBadgeKind(source.kind),
      label: asNonEmptyString(source.label, 'Badge'),
      shortLabel: asNonEmptyString(source.shortLabel, ''),
      icon: asNonEmptyString(source.icon, ''),
      tone: normalizeTone(source.tone),
      accent: normalizeAccent(source.accent),
      importance: asNonEmptyString(source.importance, 'normal') as ChatUiImportance,
      tooltip: asNonEmptyString(source.tooltip, ''),
      emphasis: asNonEmptyString(source.emphasis, 'standard') as ChatUiEmphasis,
    };
  });
}

export function normalizeBadgeKind(value: unknown): ChatUiBadge['kind'] {
  const next = asNonEmptyString(value).toLowerCase();
  switch (next) {
    case 'proof':
    case 'threat':
    case 'integrity':
    case 'helper':
    case 'hater':
    case 'system':
    case 'presence':
    case 'legend':
    case 'reward':
    case 'channel':
      return next as ChatUiBadge['kind'];
    default:
      return 'custom';
  }
}

/* ========================================================================== *
 * Section 20 — Feed builders
 * ========================================================================== */

export interface BuildFeedOptions {
  channelId?: ChatUiChannelId;
  roomId?: ChatUiRoomId;
  includeDayBreaks?: UIBoolean;
  includeUnreadBreak?: UIBoolean;
  includeTypingCluster?: UIBoolean;
  unreadMessageId?: ChatUiMessageId;
  typingEntities?: ChatUiTypingEntity[];
}

export function buildFeedViewModel(
  rawMessages: readonly unknown[],
  options: BuildFeedOptions = {},
): ChatUiFeedViewModel {
  const messages = rawMessages.map(createMessageCard).filter((msg) => {
    if (!options.channelId) return true;
    return msg.meta.channel?.channelId === options.channelId;
  });

  const sorted = [...messages].sort((a, b) => {
    const aTime = a.meta.timestamp.unixMs ?? 0;
    const bTime = b.meta.timestamp.unixMs ?? 0;
    return aTime - bTime;
  });

  const rows: ChatUiFeedRow[] = [];
  let lastBucketKey = '';

  sorted.forEach((message) => {
    const bucketKey = message.meta.timestamp.bucketKey ?? 'unknown';
    if (options.includeDayBreaks !== false && bucketKey !== lastBucketKey) {
      lastBucketKey = bucketKey;
      rows.push({
        id: `day-break:${bucketKey}`,
        kind: 'day_break',
        label: bucketKey,
        timestamp: message.meta.timestamp,
      });
    }

    if (
      options.includeUnreadBreak !== false &&
      options.unreadMessageId &&
      message.id === options.unreadMessageId
    ) {
      rows.push({
        id: `unread-break:${message.id}`,
        kind: 'unread_break',
        label: 'Unread',
        unreadCount: sorted.filter((entry) => entry.unread).length,
      });
    }

    rows.push(message);
  });

  if (
    options.includeTypingCluster !== false &&
    options.typingEntities &&
    options.typingEntities.length > 0
  ) {
    rows.push({
      id: 'typing-cluster:tail',
      kind: 'typing_cluster',
      entities: [...options.typingEntities],
      label: buildTypingLabel(options.typingEntities),
      tone: 'neutral',
    });
  }

  return {
    groups: [{
      id: `group:${options.channelId ?? 'all'}`,
      label: options.channelId ?? 'All',
      channelId: options.channelId,
      roomId: options.roomId,
      rows,
      firstTimestamp: sorted[0]?.meta.timestamp.unixMs,
      lastTimestamp: sorted[sorted.length - 1]?.meta.timestamp.unixMs,
    }],
    flatRows: rows,
    hasOlder: false,
    hasNewer: false,
    unreadCount: sorted.filter((entry) => entry.unread).length,
    newestMessageId: sorted[sorted.length - 1]?.id,
    oldestMessageId: sorted[0]?.id,
  };
}

export function buildTypingLabel(entities: readonly ChatUiTypingEntity[]): UIString {
  const names = entities.map((entity) => entity.label).filter(Boolean);
  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return `${names[0]}, ${names[1]}, and ${names.length - 2} more are typing…`;
}

/* ========================================================================== *
 * Section 21 — Channel tab builders
 * ========================================================================== */

export interface BuildChannelTabsOptions {
  activeChannelId?: ChatUiChannelId;
  recommendedChannelId?: ChatUiChannelId;
  lockedChannelIds?: readonly ChatUiChannelId[];
  availableChannelIds?: readonly ChatUiChannelId[];
}

export function buildChannelTabsViewModel(
  rawChannels: readonly unknown[],
  options: BuildChannelTabsOptions = {},
): ChatUiChannelTabsViewModel {
  const lockedSet = new Set(options.lockedChannelIds ?? []);
  const availableSet = new Set(options.availableChannelIds ?? []);

  const tabs = rawChannels.map((raw, index) => {
    const source = asRecord(raw);
    const id = asNonEmptyString(source.channelId ?? source.id, `channel:${index}`);
    const kind = normalizeChannelKind(source.channelKind ?? source.kind);
    const label = asNonEmptyString(source.label ?? source.channelLabel, labelForChannelKind(kind));

    return {
      id,
      kind,
      label,
      shortLabel: asNonEmptyString(source.shortLabel, ''),
      subtitle: asNonEmptyString(source.subtitle, ''),
      icon: asNonEmptyString(source.icon, ''),
      tone: inferChannelTone(kind),
      accent: inferChannelAccent(kind),
      active: id === options.activeChannelId,
      available: availableSet.size === 0 ? true : availableSet.has(id),
      locked: lockedSet.has(id),
      recommended: id === options.recommendedChannelId,
      counts: {
        unread: asNumber(source.unread, 0) || undefined,
        unseenMentions: asNumber(source.unseenMentions, 0) || undefined,
        participantCount: asNumber(source.participantCount, 0) || undefined,
        threatCount: asNumber(source.threatCount, 0) || undefined,
      },
      heat: createChannelTabHeat(source.heat ?? source),
      tooltip: asNonEmptyString(source.tooltip, ''),
    } satisfies ChatUiChannelTabViewModel;
  });

  return {
    tabs,
    activeChannelId: options.activeChannelId ?? tabs.find((tab) => tab.active)?.id,
  };
}

export function createChannelTabHeat(raw: unknown): ChatUiChannelTabHeat | undefined {
  const source = asRecord(raw);
  const label = asNonEmptyString(source.label ?? source.heatLabel, '');
  const score = asNumber(source.score ?? source.heatScore, 0);
  if (!label && score <= 0) return undefined;
  return {
    label,
    score: score || undefined,
    tone: normalizeTone(source.tone),
    accent: normalizeAccent(source.accent),
  };
}

export function inferChannelTone(kind: ChatUiChannelKind): ChatUiTone {
  switch (kind) {
    case 'global':
      return 'premium';
    case 'syndicate':
      return 'calm';
    case 'deal_room':
      return 'warning';
    case 'lobby':
      return 'neutral';
    case 'system':
      return 'dramatic';
    case 'shadow':
      return 'ghost';
    case 'spectator':
      return 'stealth';
    default:
      return 'neutral';
  }
}

export function inferChannelAccent(kind: ChatUiChannelKind): ChatUiAccent {
  switch (kind) {
    case 'global':
      return 'silver';
    case 'syndicate':
      return 'cyan';
    case 'deal_room':
      return 'amber';
    case 'system':
      return 'indigo';
    case 'shadow':
      return 'obsidian';
    case 'spectator':
      return 'violet';
    default:
      return 'slate';
  }
}

export function labelForChannelKind(kind: ChatUiChannelKind): UIString {
  switch (kind) {
    case 'global':
      return 'Global';
    case 'syndicate':
      return 'Syndicate';
    case 'deal_room':
      return 'Deal Room';
    case 'lobby':
      return 'Lobby';
    case 'system':
      return 'System';
    case 'shadow':
      return 'Shadow';
    case 'direct':
      return 'Direct';
    case 'spectator':
      return 'Spectator';
    default:
      return 'Unknown';
  }
}

/* ========================================================================== *
 * Section 22 — Presence, typing, invasion, threat builders
 * ========================================================================== */

export function buildPresenceStripViewModel(rawActors: readonly unknown[]): ChatUiPresenceStripViewModel {
  const chips = rawActors.map((raw, index) => {
    const actor = createAuthorModel(raw, `Actor ${index + 1}`);
    return {
      id: actor.id,
      actor,
      label: actor.displayName,
      subtitle: actor.roleLabel || actor.factionLabel || actor.subtitle,
      tone: inferPresenceTone(actor),
      accent: inferPresenceAccent(actor),
      urgent: actor.sourceKind === 'hater' || actor.typingState === 'weaponized_delay',
      tooltip: actor.signature?.voiceprintLabel || actor.signature?.cadenceLabel,
    } satisfies ChatUiPresenceChipViewModel;
  });

  return {
    chips,
    totalOnline: chips.filter((entry) => entry.actor.presence === 'online').length,
    totalTyping: chips.filter((entry) => entry.actor.typingState === 'typing').length,
    totalHostile: chips.filter((entry) => entry.actor.sourceKind === 'hater').length,
    totalHelper: chips.filter((entry) => entry.actor.sourceKind === 'helper').length,
    totalSpectators: chips.filter((entry) => entry.actor.sourceKind === 'spectator').length,
  };
}

export function inferPresenceTone(actor: ChatUiAuthorModel): ChatUiTone {
  if (actor.sourceKind === 'helper') return 'supportive';
  if (actor.sourceKind === 'hater') return 'hostile';
  if (actor.sourceKind === 'system') return 'premium';
  return 'neutral';
}

export function inferPresenceAccent(actor: ChatUiAuthorModel): ChatUiAccent {
  if (actor.sourceKind === 'helper') return 'emerald';
  if (actor.sourceKind === 'hater') return 'red';
  if (actor.sourceKind === 'spectator') return 'violet';
  return 'slate';
}

export function buildTypingIndicatorViewModel(rawActors: readonly unknown[]): ChatUiTypingIndicatorViewModel {
  const entities = rawActors.map((raw, index) => {
    const source = asRecord(raw);
    return {
      id: asNonEmptyString(source.id, `typing:${index}`),
      label: asNonEmptyString(source.label ?? source.displayName ?? source.name, `Actor ${index + 1}`),
      sourceKind: normalizeSourceKind(source.sourceKind ?? source.kind),
      typingState: normalizeTypingState(source.typingState ?? source.state),
      accent: normalizeAccent(source.accent),
      roleLabel: asNonEmptyString(source.roleLabel, ''),
    } satisfies ChatUiTypingEntity;
  }).filter((entry) => entry.typingState !== 'not_typing');

  return {
    entities,
    label: buildTypingLabel(entities),
    compactLabel: entities.length > 0 ? 'Typing…' : '',
    tone: entities.some((entry) => entry.sourceKind === 'hater') ? 'danger' : 'neutral',
    accent: entities.some((entry) => entry.sourceKind === 'hater') ? 'red' : 'slate',
    visible: entities.length > 0,
  };
}

export function buildInvasionBannerViewModel(raw: unknown): ChatUiInvasionBannerViewModel | undefined {
  const source = asRecord(raw);
  if (Object.keys(source).length === 0) return undefined;

  return {
    id: asNonEmptyString(source.id, 'invasion:active'),
    active: asBoolean(source.active, true),
    title: asNonEmptyString(source.title, 'Invasion'),
    subtitle: asNonEmptyString(source.subtitle, ''),
    summary: asNonEmptyString(source.summary, ''),
    band: normalizeThreatBand(source.band ?? source.threatBand),
    tone: normalizeTone(source.tone || 'dramatic'),
    accent: normalizeAccent(source.accent || 'red'),
    countdownLabel: asNonEmptyString(source.countdownLabel, ''),
    sourceLabel: asNonEmptyString(source.sourceLabel, ''),
    targetLabel: asNonEmptyString(source.targetLabel, ''),
    actions: asArray(source.actions).map(createInvasionAction),
    chips: createChips(asArray(source.chips)),
  };
}

export function createInvasionAction(raw: unknown): ChatUiInvasionAction {
  const source = asRecord(raw);
  return {
    id: asNonEmptyString(source.id, toId('invasion-action', source.label ?? 'action')),
    label: asNonEmptyString(source.label, 'Action'),
    icon: asNonEmptyString(source.icon, ''),
    tone: normalizeTone(source.tone),
    accent: normalizeAccent(source.accent),
    available: asBoolean(source.available, true),
    destructive: asBoolean(source.destructive),
  };
}

export function buildThreatMeterViewModel(raw: unknown): ChatUiThreatMeterViewModel {
  const source = asRecord(raw);
  const cards = asArray(source.cards).map(createThreatCard);

  return {
    band: normalizeThreatBand(source.band ?? source.threatBand),
    label: asNonEmptyString(source.label, threatLabelForBand(normalizeThreatBand(source.band ?? source.threatBand))),
    summary: asNonEmptyString(source.summary, ''),
    cards,
    dominantThreatLabel: asNonEmptyString(source.dominantThreatLabel, ''),
    recommendationLabel: asNonEmptyString(source.recommendationLabel, ''),
    confidenceLabel: asNonEmptyString(source.confidenceLabel, ''),
  };
}

export function createThreatCard(raw: unknown, index = 0): ChatUiThreatCardViewModel {
  const source = asRecord(raw);
  return {
    id: asNonEmptyString(source.id, `threat-card:${index}`),
    label: asNonEmptyString(source.label, 'Threat'),
    value: asNonEmptyString(source.value, '0'),
    band: normalizeThreatBand(source.band),
    tone: normalizeTone(source.tone),
    accent: normalizeAccent(source.accent),
    subtitle: asNonEmptyString(source.subtitle, ''),
    trend: createMetricDelta(source.trend),
  };
}

export function threatLabelForBand(band: ChatUiThreatBand): UIString {
  switch (band) {
    case 'quiet':
      return 'Quiet';
    case 'elevated':
      return 'Elevated';
    case 'pressured':
      return 'Pressured';
    case 'hostile':
      return 'Hostile';
    case 'critical':
      return 'Critical';
    case 'catastrophic':
      return 'Catastrophic';
    default:
      return 'Quiet';
  }
}

export function createMetricDelta(raw: unknown): ChatUiMetricDelta | undefined {
  const source = asRecord(raw);
  const direction = asNonEmptyString(source.direction, '');
  if (!direction) return undefined;
  const normalizedDirection =
    direction === 'up' || direction === 'down' || direction === 'flat'
      ? direction
      : 'flat';

  return {
    direction: normalizedDirection,
    amount: asNumber(source.amount, 0) || undefined,
    label: asNonEmptyString(source.label, ''),
  };
}

/* ========================================================================== *
 * Section 23 — Helper prompt, collapsed pill, room header, empty state
 * ========================================================================== */

export function buildHelperPromptViewModel(raw: unknown): ChatUiHelperPromptViewModel | undefined {
  const source = asRecord(raw);
  if (Object.keys(source).length === 0) return undefined;

  return {
    id: asNonEmptyString(source.id, 'helper-prompt'),
    visible: asBoolean(source.visible, true),
    mode: normalizeHelperMode(source.mode),
    helperLabel: asNonEmptyString(source.helperLabel, 'Helper'),
    title: asNonEmptyString(source.title, 'Suggested move'),
    body: asNonEmptyString(source.body, ''),
    summary: asNonEmptyString(source.summary, ''),
    tone: normalizeTone(source.tone || 'supportive'),
    accent: normalizeAccent(source.accent || 'emerald'),
    actions: asArray(source.actions).map(createHelperPromptAction),
    chips: createChips(asArray(source.chips)),
    urgency: normalizeUrgency(source.urgency),
  };
}

export function createHelperPromptAction(raw: unknown): ChatUiHelperPromptAction {
  const source = asRecord(raw);
  return {
    id: asNonEmptyString(source.id, toId('helper-action', source.label ?? 'action')),
    label: asNonEmptyString(source.label, 'Action'),
    tone: normalizeTone(source.tone),
    accent: normalizeAccent(source.accent),
    primary: asBoolean(source.primary),
    destructive: asBoolean(source.destructive),
  };
}

export function normalizeHelperMode(value: unknown): ChatUiHelperMode {
  const next = asNonEmptyString(value).toLowerCase();
  switch (next) {
    case 'soft':
    case 'standard':
    case 'blunt':
    case 'rescue':
    case 'mentor':
    case 'strategic':
      return next as ChatUiHelperMode;
    default:
      return 'standard';
  }
}

export function normalizeUrgency(value: unknown): ChatUiUrgency {
  const next = asNonEmptyString(value).toLowerCase();
  switch (next) {
    case 'low':
    case 'medium':
    case 'high':
    case 'immediate':
      return next as ChatUiUrgency;
    default:
      return 'idle';
  }
}

export function buildCollapsedPillViewModel(raw: unknown): ChatUiCollapsedPillViewModel {
  const source = asRecord(raw);
  return {
    id: asNonEmptyString(source.id, 'chat-collapsed-pill'),
    label: asNonEmptyString(source.label, 'Chat'),
    shortLabel: asNonEmptyString(source.shortLabel, ''),
    unreadCount: asNumber(source.unreadCount, 0) || undefined,
    threatBand: normalizeThreatBand(source.threatBand),
    typingCount: asNumber(source.typingCount, 0) || undefined,
    helperVisible: asBoolean(source.helperVisible),
    invasionActive: asBoolean(source.invasionActive),
    accent: normalizeAccent(source.accent || inferCollapsedAccent(source)),
    tone: normalizeTone(source.tone || inferCollapsedTone(source)),
    expanded: asBoolean(source.expanded),
    tooltip: asNonEmptyString(source.tooltip, ''),
  };
}

export function inferCollapsedAccent(source: UnknownRecord): ChatUiAccent {
  if (asBoolean(source.invasionActive)) return 'red';
  if (asBoolean(source.helperVisible)) return 'emerald';
  if (asNumber(source.unreadCount, 0) > 0) return 'silver';
  return 'slate';
}

export function inferCollapsedTone(source: UnknownRecord): ChatUiTone {
  if (asBoolean(source.invasionActive)) return 'danger';
  if (asBoolean(source.helperVisible)) return 'supportive';
  return 'neutral';
}

export function buildRoomHeaderViewModel(raw: unknown): ChatUiRoomHeaderViewModel {
  const source = asRecord(raw);
  const kind = normalizeChannelKind(source.channelKind ?? source.kind);
  return {
    roomId: asNonEmptyString(source.roomId, ''),
    roomLabel: asNonEmptyString(source.roomLabel ?? source.label, 'Chat Room'),
    roomSubtitle: asNonEmptyString(source.roomSubtitle ?? source.subtitle, ''),
    channelLabel: asNonEmptyString(source.channelLabel, labelForChannelKind(kind)),
    channelKind: kind,
    roomTone: normalizeTone(source.roomTone),
    roomAccent: normalizeAccent(source.roomAccent || inferChannelAccent(kind)),
    chips: createChips(asArray(source.chips)),
    metrics: asArray(source.metrics).map(createMetric),
    actions: asArray(source.actions).map(createHeaderAction),
    audienceHeatLabel: asNonEmptyString(source.audienceHeatLabel, ''),
    reputationLabel: asNonEmptyString(source.reputationLabel, ''),
    integrityLabel: asNonEmptyString(source.integrityLabel, ''),
  };
}

export function createMetric(raw: unknown, index = 0): ChatUiMetric {
  const source = asRecord(raw);
  return {
    id: asNonEmptyString(source.id, `metric:${index}`),
    label: asNonEmptyString(source.label, 'Metric'),
    value: asNonEmptyString(source.value, '0'),
    rawValue: asNumber(source.rawValue, 0) || undefined,
    tone: normalizeTone(source.tone),
    accent: normalizeAccent(source.accent),
    importance: asNonEmptyString(source.importance, 'normal') as ChatUiImportance,
    delta: createMetricDelta(source.delta),
    tooltip: asNonEmptyString(source.tooltip, ''),
  };
}

export function createHeaderAction(raw: unknown): ChatUiRoomHeaderAction {
  const source = asRecord(raw);
  return {
    id: asNonEmptyString(source.id, toId('header-action', source.label ?? 'action')),
    label: asNonEmptyString(source.label, 'Action'),
    icon: asNonEmptyString(source.icon, ''),
    tone: normalizeTone(source.tone),
    accent: normalizeAccent(source.accent),
    primary: asBoolean(source.primary),
    disabled: asBoolean(source.disabled),
  };
}

export function buildEmptyStateViewModel(raw: unknown): ChatUiEmptyStateViewModel {
  const source = asRecord(raw);
  const kind = normalizeEmptyStateKind(source.kind);
  return {
    id: asNonEmptyString(source.id, `empty:${kind}`),
    kind,
    title: asNonEmptyString(source.title, emptyStateTitle(kind)),
    body: asNonEmptyString(source.body, emptyStateBody(kind)),
    hint: asNonEmptyString(source.hint, ''),
    tone: normalizeTone(source.tone || emptyStateTone(kind)),
    accent: normalizeAccent(source.accent || emptyStateAccent(kind)),
    actions: asArray(source.actions).map(createHeaderAction),
    chips: createChips(asArray(source.chips)),
  };
}

export function normalizeEmptyStateKind(value: unknown): ChatUiEmptyStateKind {
  const next = asNonEmptyString(value).toLowerCase();
  switch (next) {
    case 'cold_start':
    case 'quiet_room':
    case 'loading':
    case 'filtered_empty':
    case 'channel_locked':
    case 'shadow_only':
    case 'connection_lost':
    case 'post_run_reset':
    case 'error':
      return next as ChatUiEmptyStateKind;
    default:
      return 'quiet_room';
  }
}

export function emptyStateTitle(kind: ChatUiEmptyStateKind): UIString {
  switch (kind) {
    case 'cold_start':
      return 'No history yet';
    case 'quiet_room':
      return 'Quiet room';
    case 'loading':
      return 'Loading chat';
    case 'filtered_empty':
      return 'Nothing matches';
    case 'channel_locked':
      return 'Channel locked';
    case 'shadow_only':
      return 'Shadow-only state';
    case 'connection_lost':
      return 'Connection lost';
    case 'post_run_reset':
      return 'Run ended';
    case 'error':
      return 'Chat unavailable';
    default:
      return 'Chat';
  }
}

export function emptyStateBody(kind: ChatUiEmptyStateKind): UIString {
  switch (kind) {
    case 'cold_start':
      return 'Open the room and make the first move.';
    case 'quiet_room':
      return 'No one has spoken recently.';
    case 'loading':
      return 'Hydrating transcript and room state.';
    case 'filtered_empty':
      return 'Try widening your filters or search scope.';
    case 'channel_locked':
      return 'This channel is not available in the current state.';
    case 'shadow_only':
      return 'Visible output is currently suppressed.';
    case 'connection_lost':
      return 'Reconnect to restore live chat signals.';
    case 'post_run_reset':
      return 'The last run has ended. Review the transcript or start again.';
    case 'error':
      return 'The shell is up, but the chat surface cannot be rendered cleanly.';
    default:
      return 'Chat is idle.';
  }
}

export function emptyStateTone(kind: ChatUiEmptyStateKind): ChatUiTone {
  switch (kind) {
    case 'channel_locked':
    case 'shadow_only':
      return 'warning';
    case 'connection_lost':
    case 'error':
      return 'danger';
    case 'post_run_reset':
      return 'dramatic';
    default:
      return 'neutral';
  }
}

export function emptyStateAccent(kind: ChatUiEmptyStateKind): ChatUiAccent {
  switch (kind) {
    case 'channel_locked':
      return 'amber';
    case 'shadow_only':
      return 'obsidian';
    case 'connection_lost':
    case 'error':
      return 'red';
    case 'post_run_reset':
      return 'violet';
    default:
      return 'slate';
  }
}

/* ========================================================================== *
 * Section 24 — Transcript drawer builders
 * ========================================================================== */

export function buildTranscriptDrawerViewModel(raw: unknown): ChatUiTranscriptDrawerViewModel {
  const source = asRecord(raw);
  return {
    open: asBoolean(source.open),
    title: asNonEmptyString(source.title, 'Transcript'),
    subtitle: asNonEmptyString(source.subtitle, ''),
    scope: normalizeSearchScope(source.scope),
    query: asNonEmptyString(source.query, ''),
    filters: asArray(source.filters).map(createDrawerFilter),
    results: asArray(source.results).map(createTranscriptSearchResult),
    selected: createDrawerSelection(source.selected),
    summaryMetrics: asArray(source.summaryMetrics).map(createMetric),
    exportReady: asBoolean(source.exportReady),
    canSearch: asBoolean(source.canSearch, true),
    canExport: asBoolean(source.canExport),
    emptyState: source.emptyState ? buildEmptyStateViewModel(source.emptyState) : undefined,
  };
}

export function normalizeSearchScope(value: unknown): ChatUiSearchScope {
  const next = asNonEmptyString(value).toLowerCase();
  switch (next) {
    case 'current_channel':
    case 'current_room':
    case 'all_visible':
    case 'proof_only':
    case 'legend_only':
    case 'helper_only':
    case 'threat_only':
      return next as ChatUiSearchScope;
    default:
      return 'current_channel';
  }
}

export function createDrawerFilter(raw: unknown, index = 0): ChatUiDrawerFilter {
  const source = asRecord(raw);
  return {
    id: asNonEmptyString(source.id, `drawer-filter:${index}`),
    label: asNonEmptyString(source.label, 'Filter'),
    active: asBoolean(source.active),
    count: asNumber(source.count, 0) || undefined,
    tone: normalizeTone(source.tone),
    accent: normalizeAccent(source.accent),
  };
}

export function createTranscriptSearchResult(raw: unknown, index = 0): ChatUiTranscriptSearchResultViewModel {
  const source = asRecord(raw);
  return {
    id: asNonEmptyString(source.id, `search-result:${index}`),
    messageId: asNonEmptyString(source.messageId, ''),
    channelId: asNonEmptyString(source.channelId, ''),
    channelLabel: asNonEmptyString(source.channelLabel, ''),
    authorLabel: asNonEmptyString(source.authorLabel, ''),
    preview: asNonEmptyString(source.preview, ''),
    timestampLabel: asNonEmptyString(source.timestampLabel, ''),
    matches: asArray(source.matches).map(createSearchMatchRange),
    proofLabel: asNonEmptyString(source.proofLabel, ''),
    threatLabel: asNonEmptyString(source.threatLabel, ''),
  };
}

export function createSearchMatchRange(raw: unknown): ChatUiSearchMatchRange {
  const source = asRecord(raw);
  return {
    start: asNumber(source.start, 0),
    end: asNumber(source.end, 0),
  };
}

export function createDrawerSelection(raw: unknown): ChatUiTranscriptDrawerSelection | undefined {
  const source = asRecord(raw);
  if (Object.keys(source).length === 0) return undefined;
  return {
    messageId: asNonEmptyString(source.messageId, ''),
    authorLabel: asNonEmptyString(source.authorLabel, ''),
    text: asNonEmptyString(source.text, ''),
    timestampLabel: asNonEmptyString(source.timestampLabel, ''),
    proofSummary: asNonEmptyString(source.proofSummary, ''),
    threatSummary: asNonEmptyString(source.threatSummary, ''),
    integritySummary: asNonEmptyString(source.integritySummary, ''),
  };
}

/* ========================================================================== *
 * Section 25 — Composer and unified shell builders
 * ========================================================================== */

export function buildComposerViewModel(raw: unknown): ChatUiComposerViewModel {
  const source = asRecord(raw);
  return {
    draft: asNonEmptyString(source.draft, ''),
    placeholder: asNonEmptyString(source.placeholder, 'Write a message…'),
    disabled: asBoolean(source.disabled),
    sending: asBoolean(source.sending),
    cooldownLabel: asNonEmptyString(source.cooldownLabel, ''),
    selectedChannelId: asNonEmptyString(source.selectedChannelId, ''),
    quickInserts: asArray(source.quickInserts).map(createQuickInsert),
    replyTarget: createReplyTarget(source.replyTarget),
    hints: asArray(source.hints).map(createCommandHint),
  };
}

export function createQuickInsert(raw: unknown, index = 0): ChatUiComposerQuickInsert {
  const source = asRecord(raw);
  return {
    id: asNonEmptyString(source.id, `quick-insert:${index}`),
    label: asNonEmptyString(source.label, 'Insert'),
    value: asNonEmptyString(source.value, ''),
    tone: normalizeTone(source.tone),
    accent: normalizeAccent(source.accent),
  };
}

export function createReplyTarget(raw: unknown): ChatUiComposerReplyTarget | undefined {
  const source = asRecord(raw);
  const preview = asNonEmptyString(source.preview, '');
  if (!preview) return undefined;
  return {
    messageId: asNonEmptyString(source.messageId, ''),
    authorLabel: asNonEmptyString(source.authorLabel, ''),
    preview,
  };
}

export function buildUnifiedShellViewModel(raw: unknown): ChatUiUnifiedShellViewModel {
  const source = asRecord(raw);
  const channelTabsSource = asRecord(source.channelTabs);
  const feedSource = asRecord(source.feed);
  const typingSource = asRecord(source.typing);
  const presenceSource = asRecord(source.presence);

  return {
    mountId: asNonEmptyString(source.mountId, ''),
    roomHeader: buildRoomHeaderViewModel(source.roomHeader),
    channelTabs: buildChannelTabsViewModel(asArray(channelTabsSource.tabs ?? source.channelTabs), {
      activeChannelId: asNonEmptyString(channelTabsSource.activeChannelId ?? source.activeChannelId, ''),
    }),
    feed: buildFeedViewModel(asArray(feedSource.messages ?? feedSource.flatRows ?? source.messages), {
      channelId: asNonEmptyString(source.activeChannelId, ''),
      unreadMessageId: asNonEmptyString(source.unreadMessageId, ''),
      typingEntities: buildTypingIndicatorViewModel(asArray(typingSource.entities ?? source.typingActors)).entities,
    }),
    composer: buildComposerViewModel(source.composer),
    presence: buildPresenceStripViewModel(asArray(presenceSource.chips ?? source.presenceActors)),
    typing: buildTypingIndicatorViewModel(asArray(typingSource.entities ?? source.typingActors)),
    invasion: buildInvasionBannerViewModel(source.invasion),
    threat: buildThreatMeterViewModel(source.threat),
    helperPrompt: buildHelperPromptViewModel(source.helperPrompt),
    collapsedPill: buildCollapsedPillViewModel(source.collapsedPill),
    transcriptDrawer: buildTranscriptDrawerViewModel(source.transcriptDrawer),
    emptyState: source.emptyState ? buildEmptyStateViewModel(source.emptyState) : undefined,
    status: buildShellStatus(source.status),
  };
}

export function buildShellStatus(raw: unknown): ChatUiShellStatus {
  const source = asRecord(raw);
  return {
    connected: asBoolean(source.connected, true),
    hydrated: asBoolean(source.hydrated, true),
    syncing: asBoolean(source.syncing),
    degraded: asBoolean(source.degraded),
    stale: asBoolean(source.stale),
    errorLabel: asNonEmptyString(source.errorLabel, ''),
  };
}

/* ========================================================================== *
 * Section 26 — Runtime model guards
 * ========================================================================== */

export function isMessageCardViewModel(value: unknown): value is ChatUiMessageCardViewModel {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && isRecord(value.author)
    && isRecord(value.body)
    && isRecord(value.meta);
}

export function isFeedRow(value: unknown): value is ChatUiFeedRow {
  if (!isRecord(value)) return false;
  const kind = asNonEmptyString(value.kind, '');
  return (
    isMessageCardViewModel(value) ||
    kind === 'day_break' ||
    kind === 'unread_break' ||
    kind === 'typing_cluster' ||
    kind === 'scene_marker' ||
    kind === 'gap_marker' ||
    kind === 'load_older' ||
    kind === 'empty_state'
  );
}

export function isChannelTabViewModel(value: unknown): value is ChatUiChannelTabViewModel {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && typeof value.label === 'string';
}

export function isUnifiedShellViewModel(value: unknown): value is ChatUiUnifiedShellViewModel {
  if (!isRecord(value)) return false;
  return isRecord(value.roomHeader)
    && isRecord(value.channelTabs)
    && isRecord(value.feed)
    && isRecord(value.composer)
    && isRecord(value.presence)
    && isRecord(value.typing)
    && isRecord(value.threat)
    && isRecord(value.collapsedPill)
    && isRecord(value.transcriptDrawer)
    && isRecord(value.status);
}

/* ========================================================================== *
 * Section 27 — Sorting and filtering helpers
 * ========================================================================== */

export interface FeedFilterOptions {
  channelIds?: readonly ChatUiChannelId[];
  sourceKinds?: readonly ChatUiSourceKind[];
  threatBands?: readonly ChatUiThreatBand[];
  unreadOnly?: UIBoolean;
  query?: UIString;
}

export function filterMessageCards(
  messages: readonly ChatUiMessageCardViewModel[],
  options: FeedFilterOptions = {},
): ChatUiMessageCardViewModel[] {
  const channelSet = new Set(options.channelIds ?? []);
  const sourceSet = new Set(options.sourceKinds ?? []);
  const threatSet = new Set(options.threatBands ?? []);
  const query = asNonEmptyString(options.query, '').toLowerCase();

  return messages.filter((message) => {
    if (channelSet.size > 0) {
      const channelId = message.meta.channel?.channelId ?? '';
      if (!channelSet.has(channelId)) return false;
    }

    if (sourceSet.size > 0 && !sourceSet.has(message.author.sourceKind)) {
      return false;
    }

    if (threatSet.size > 0) {
      const band = message.meta.threat?.band ?? 'quiet';
      if (!threatSet.has(band)) return false;
    }

    if (options.unreadOnly && !message.unread) {
      return false;
    }

    if (query) {
      const haystack = [
        message.author.displayName,
        ...message.body.primary.spans.map((span) => span.text),
        message.body.quote?.text ?? '',
      ].join(' ').toLowerCase();

      if (!haystack.includes(query)) return false;
    }

    return true;
  });
}

export function sortMessageCards(
  messages: readonly ChatUiMessageCardViewModel[],
  direction: ChatUiSortDirection = 'asc',
): ChatUiMessageCardViewModel[] {
  const multiplier = direction === 'asc' ? 1 : -1;
  return [...messages].sort((a, b) => {
    const aTime = a.meta.timestamp.unixMs ?? 0;
    const bTime = b.meta.timestamp.unixMs ?? 0;
    return (aTime - bTime) * multiplier;
  });
}

/* ========================================================================== *
 * Section 28 — Search helpers
 * ========================================================================== */

export function searchTranscriptResults(
  messages: readonly ChatUiMessageCardViewModel[],
  query: UIString,
): ChatUiTranscriptSearchResultViewModel[] {
  const normalizedQuery = asNonEmptyString(query, '').toLowerCase().trim();
  if (!normalizedQuery) return [];

  const results: ChatUiTranscriptSearchResultViewModel[] = [];

  messages.forEach((message, index) => {
    const preview = message.body.primary.spans.map((span) => span.text).join('');
    const haystack = `${message.author.displayName} ${preview}`.toLowerCase();
    const matchIndex = haystack.indexOf(normalizedQuery);
    if (matchIndex === -1) return;

    results.push({
      id: `search:${message.id}:${index}`,
      messageId: message.id,
      channelId: message.meta.channel?.channelId,
      channelLabel: message.meta.channel?.channelLabel,
      authorLabel: message.author.displayName,
      preview,
      timestampLabel: message.meta.timestamp.displayLabel,
      matches: [{ start: matchIndex, end: matchIndex + normalizedQuery.length }],
      proofLabel: message.meta.proof?.proofSummary,
      threatLabel: message.meta.threat?.dangerSummary,
    });
  });

  return results;
}

/* ========================================================================== *
 * Section 29 — Summary derivation helpers
 * ========================================================================== */

export function deriveUnreadCount(messages: readonly ChatUiMessageCardViewModel[]): UINumber {
  return messages.filter((message) => message.unread).length;
}

export function deriveDominantThreatBand(messages: readonly ChatUiMessageCardViewModel[]): ChatUiThreatBand {
  const order: ChatUiThreatBand[] = ['quiet', 'elevated', 'pressured', 'hostile', 'critical', 'catastrophic'];
  let bestIndex = 0;
  messages.forEach((message) => {
    const band = message.meta.threat?.band ?? 'quiet';
    const index = order.indexOf(band);
    if (index > bestIndex) bestIndex = index;
  });
  return order[bestIndex];
}

export function deriveActiveHelperVisible(prompt?: Maybe<ChatUiHelperPromptViewModel>): UIBoolean {
  return Boolean(prompt && prompt.visible);
}

export function deriveTypingCount(typing?: Maybe<ChatUiTypingIndicatorViewModel>): UINumber {
  return typing?.entities.length ?? 0;
}

/* ========================================================================== *
 * Section 30 — Export group
 * ========================================================================== */

export interface ChatUiModuleManifest {
  version: UIString;
  owner: UIString;
  contractLayer: UIString;
  presentationOnly: UIBoolean;
  notes: UIString[];
}

export const CHAT_UI_TYPES_MANIFEST: Readonly<ChatUiModuleManifest> = Object.freeze({
  version: '1.0.0',
  owner: 'pzo-web/src/components/chat/uiTypes.ts',
  contractLayer: 'presentation',
  presentationOnly: true,
  notes: [
    'UI-only models live here.',
    'Engine truth must remain in the engine lane.',
    'Shared chat contracts remain canonical for runtime truth.',
    'This file is the sole home for render-shell models during migration.',
  ],
});
