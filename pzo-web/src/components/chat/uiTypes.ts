/**
 * ============================================================================
 * POINT ZERO ONE — COMPONENT CHAT UI CONTRACTS
 * FILE: pzo-web/src/components/chat/uiTypes.ts
 * VERSION: 2.2.0
 * AUTHOR: OpenAI
 * LICENSE: Internal / Project Use Only
 * ============================================================================
 */

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
export type ChatUiDensity = 'compact' | 'comfortable' | 'expanded' | 'cinematic';
export type ChatUiImportance = 'low' | 'normal' | 'elevated' | 'high' | 'critical';
export type ChatUiUrgency = 'idle' | 'low' | 'medium' | 'high' | 'immediate';
export type ChatUiEmphasis = 'subtle' | 'standard' | 'strong' | 'hero' | 'suppressed';
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
export type ChatUiThreatBand = 'quiet' | 'elevated' | 'pressured' | 'hostile' | 'critical' | 'catastrophic';
export type ChatUiIntegrityBand = 'open' | 'guarded' | 'verified' | 'restricted' | 'shadowed' | 'sealed';
export type ChatUiProofBand = 'none' | 'trace' | 'linked' | 'verified' | 'sealed';
export type ChatUiHelperMode = 'soft' | 'standard' | 'blunt' | 'rescue' | 'mentor' | 'strategic';
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

export interface ChatUiTokenPack {
  themeMode: ChatUiThemeMode;
  density: ChatUiDensity;
  rounded: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  shadow: 'none' | 'soft' | 'medium' | 'strong';
  borderStyle: 'flat' | 'subtle' | 'sharp' | 'glow';
  glass: UIBoolean;
  motionScale: 'reduced' | 'standard' | 'expressive';
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

export interface ChatUiMetricDelta { direction: 'up' | 'down' | 'flat'; amount?: UINumber; label?: UIString; }
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
  kind: 'proof' | 'threat' | 'integrity' | 'helper' | 'hater' | 'system' | 'presence' | 'legend' | 'reward' | 'channel' | 'custom';
  label: UIString;
  shortLabel?: UIString;
  icon?: UIString;
  tone: ChatUiTone;
  accent: ChatUiAccent;
  importance?: ChatUiImportance;
  tooltip?: UIString;
  emphasis?: ChatUiEmphasis;
}

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

export interface ChatUiInlineEntity { id: ChatUiId; kind: 'player' | 'npc' | 'channel' | 'proof' | 'event' | 'card' | 'run' | 'unknown'; label: UIString; value?: UIString; }
export interface ChatUiTextSpan { id: ChatUiId; text: UIString; bold?: UIBoolean; italic?: UIBoolean; mono?: UIBoolean; strike?: UIBoolean; tone?: ChatUiTone; accent?: ChatUiAccent; entity?: ChatUiInlineEntity; }
export interface ChatUiTextBlock { id: ChatUiId; kind: 'body' | 'quote' | 'notice' | 'warning' | 'instruction' | 'caption'; spans: ChatUiTextSpan[]; truncated?: UIBoolean; lineClamp?: UINumber; }
export interface ChatUiQuotePreview { messageId?: ChatUiMessageId; authorLabel?: UIString; channelLabel?: UIString; text: UIString; tone?: ChatUiTone; accent?: ChatUiAccent; }
export interface ChatUiAttachment { id: ChatUiId; kind: 'proof' | 'image' | 'system_card' | 'deal_offer' | 'legend' | 'reward' | 'unknown'; label: UIString; subtitle?: UIString; description?: UIString; accent?: ChatUiAccent; tone?: ChatUiTone; actionable?: UIBoolean; }
export interface ChatUiReaction { id: ChatUiId; emoji?: UIString; label: UIString; count: UINumber; selected?: UIBoolean; }
export interface ChatUiCommandHint { id: ChatUiId; command: UIString; label: UIString; description?: UIString; tone?: ChatUiTone; }
export interface ChatUiMessageBodyModel {
  primary: ChatUiTextBlock;
  secondary?: ChatUiTextBlock[];
  quote?: ChatUiQuotePreview;
  attachments?: ChatUiAttachment[];
  reactions?: ChatUiReaction[];
  commandHints?: ChatUiCommandHint[];
}

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
export interface ChatUiDayBreakRow { id: ChatUiId; kind: 'day_break'; label: UIString; timestamp?: ChatUiTimestampMeta; }
export interface ChatUiUnreadBreakRow { id: ChatUiId; kind: 'unread_break'; label: UIString; unreadCount?: UINumber; }
export interface ChatUiSceneMarkerRow { id: ChatUiId; kind: 'scene_marker'; label: UIString; subtitle?: UIString; tone?: ChatUiTone; accent?: ChatUiAccent; sceneId?: ChatUiSceneId; }
export interface ChatUiGapMarkerRow { id: ChatUiId; kind: 'gap_marker'; label: UIString; hiddenCount?: UINumber; }
export interface ChatUiTypingEntity { id: ChatUiId; label: UIString; sourceKind: ChatUiSourceKind; typingState: ChatUiTypingState; accent?: ChatUiAccent; roleLabel?: UIString; }
export interface ChatUiTypingClusterRow { id: ChatUiId; kind: 'typing_cluster'; entities: ChatUiTypingEntity[]; label: UIString; tone?: ChatUiTone; }
export interface ChatUiLoadOlderRow { id: ChatUiId; kind: 'load_older'; label: UIString; available?: UIBoolean; pending?: UIBoolean; }
export interface ChatUiEmptyFeedRow { id: ChatUiId; kind: 'empty_state'; model: ChatUiEmptyStateViewModel; }
export type ChatUiFeedRow = ChatUiMessageCardViewModel | ChatUiDayBreakRow | ChatUiUnreadBreakRow | ChatUiSceneMarkerRow | ChatUiGapMarkerRow | ChatUiTypingClusterRow | ChatUiLoadOlderRow | ChatUiEmptyFeedRow;
export interface ChatUiFeedGroup { id: ChatUiId; label?: UIString; channelId?: ChatUiChannelId; roomId?: ChatUiRoomId; rows: ChatUiFeedRow[]; firstTimestamp?: ChatUiTimestamp; lastTimestamp?: ChatUiTimestamp; }
export interface ChatUiVisibleRange { startIndex: UINumber; endIndex: UINumber; totalCount: UINumber; }
export interface ChatUiFeedViewModel { groups: ChatUiFeedGroup[]; flatRows: ChatUiFeedRow[]; visibleRange?: ChatUiVisibleRange; hasOlder: UIBoolean; hasNewer: UIBoolean; unreadCount: UINumber; newestMessageId?: ChatUiMessageId; oldestMessageId?: ChatUiMessageId; }

export interface ChatUiChannelTabHeat { label?: UIString; score?: UINumber; tone?: ChatUiTone; accent?: ChatUiAccent; }
export interface ChatUiChannelTabCounts { unread?: UINumber; unseenMentions?: UINumber; participantCount?: UINumber; threatCount?: UINumber; }
export interface ChatUiChannelTabViewModel { id: ChatUiChannelId; kind: ChatUiChannelKind; label: UIString; shortLabel?: UIString; subtitle?: UIString; icon?: UIString; tone: ChatUiTone; accent: ChatUiAccent; active: UIBoolean; available: UIBoolean; locked?: UIBoolean; recommended?: UIBoolean; counts?: ChatUiChannelTabCounts; heat?: ChatUiChannelTabHeat; tooltip?: UIString; }
export interface ChatUiChannelTabsViewModel { tabs: ChatUiChannelTabViewModel[]; activeChannelId?: ChatUiChannelId; }

export interface ChatUiPresenceChipViewModel { id: ChatUiId; actor: ChatUiAuthorModel; label: UIString; subtitle?: UIString; tone?: ChatUiTone; accent?: ChatUiAccent; urgent?: UIBoolean; tooltip?: UIString; }
export interface ChatUiPresenceStripViewModel { chips: ChatUiPresenceChipViewModel[]; totalOnline?: UINumber; totalTyping?: UINumber; totalHostile?: UINumber; totalHelper?: UINumber; totalSpectators?: UINumber; }
export interface ChatUiTypingIndicatorViewModel { entities: ChatUiTypingEntity[]; label: UIString; compactLabel?: UIString; tone: ChatUiTone; accent: ChatUiAccent; visible: UIBoolean; }

export interface ChatUiInvasionAction { id: ChatUiId; label: UIString; icon?: UIString; tone?: ChatUiTone; accent?: ChatUiAccent; available?: UIBoolean; destructive?: UIBoolean; }
export interface ChatUiInvasionBannerViewModel { id: ChatUiId; active: UIBoolean; title: UIString; subtitle?: UIString; summary?: UIString; band: ChatUiThreatBand; tone: ChatUiTone; accent: ChatUiAccent; countdownLabel?: UIString; sourceLabel?: UIString; targetLabel?: UIString; actions?: ChatUiInvasionAction[]; chips?: ChatUiChip[]; }
export interface ChatUiThreatCardViewModel { id: ChatUiId; label: UIString; value: UIString; band: ChatUiThreatBand; tone: ChatUiTone; accent: ChatUiAccent; subtitle?: UIString; trend?: ChatUiMetricDelta; }
export interface ChatUiThreatMeterViewModel { band: ChatUiThreatBand; label: UIString; summary?: UIString; cards: ChatUiThreatCardViewModel[]; dominantThreatLabel?: UIString; recommendationLabel?: UIString; confidenceLabel?: UIString; }

export interface ChatUiHelperPromptActor { id: ChatUiId; displayName: UIString; roleLabel?: UIString; initials?: UIString; }
export interface ChatUiHelperPromptChannel { id: ChatUiChannelId; label: UIString; openable?: UIBoolean; }
export interface ChatUiHelperPromptPresentation { severity: ChatUiTone; density: ChatUiDensity; intentLabel?: UIString; toneLabel?: UIString; accentHex?: UIString; }
export interface ChatUiHelperPromptEvidence { id: ChatUiId; label: UIString; value: UIString; caption?: UIString; tone?: ChatUiTone; }
export interface ChatUiHelperPromptAction { id: ChatUiId; label: UIString; tone?: ChatUiTone; accent?: ChatUiAccent; primary?: UIBoolean; destructive?: UIBoolean; description?: UIString; hotkeyHint?: UIString; disabled?: UIBoolean; blockedReason?: UIString; }
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
  dismissible?: UIBoolean;
  actor?: ChatUiHelperPromptActor;
  channel?: ChatUiHelperPromptChannel;
  presentation?: ChatUiHelperPromptPresentation;
  metrics?: ChatUiMetric[];
  evidence?: ChatUiHelperPromptEvidence[];
  rescueCritical?: UIBoolean;
  escalated?: UIBoolean;
  sticky?: UIBoolean;
  unreadCountHint?: UINumber;
  footerNote?: UIString;
  provenanceNote?: UIString;
}

export type ChatUiCollapsedPillPresenceMood = 'quiet' | 'watched' | 'active' | 'swarming';
export type ChatUiCollapsedPillActionKind = 'open' | 'toggle' | 'dismiss' | 'channel' | 'cta' | 'secondary';
export interface ChatUiCollapsedPillPresenceSummary { count?: UINumber; activeCount?: UINumber; mood?: ChatUiCollapsedPillPresenceMood; moodLabel?: UIString; label?: UIString; observerLabels?: UIString[]; tooltip?: UIString; }
export interface ChatUiCollapsedPillTypingSummary { count?: UINumber; label?: UIString; actorLabels?: UIString[]; strongestState?: ChatUiTypingState; tooltip?: UIString; }
export interface ChatUiCollapsedPillThreatSummary { band?: ChatUiThreatBand; score01?: UINumber; label?: UIString; helperPressure?: UINumber; haterPressure?: UINumber; crowdHeat?: UINumber; tooltip?: UIString; }
export interface ChatUiCollapsedPillHelperSummary { visible: UIBoolean; label?: UIString; body?: UIString; urgency?: ChatUiUrgency; trustWindowPct?: UINumber; ctaLabel?: UIString; tooltip?: UIString; }
export interface ChatUiCollapsedPillInvasionSummary { active: UIBoolean; label?: UIString; stageLabel?: UIString; aggressorLabel?: UIString; priorityLabel?: UIString; tooltip?: UIString; }
export interface ChatUiCollapsedPillChannelSummary { id: ChatUiId; channelId: ChatUiChannelId; label: UIString; shortLabel?: UIString; kind?: ChatUiChannelKind; icon?: UIString; unreadCount?: UINumber; mentionCount?: UINumber; typingCount?: UINumber; active?: UIBoolean; helperPending?: UIBoolean; haterPending?: UIBoolean; accent?: ChatUiAccent; tone?: ChatUiTone; tooltip?: UIString; disabled?: UIBoolean; }
export interface ChatUiCollapsedPillAction { id: ChatUiId; label: UIString; icon?: UIString; kind?: ChatUiCollapsedPillActionKind; primary?: UIBoolean; channelId?: ChatUiChannelId; tone?: ChatUiTone; accent?: ChatUiAccent; tooltip?: UIString; disabled?: UIBoolean; }
export interface ChatUiCollapsedPillViewModel {
  id: ChatUiId;
  label: UIString;
  shortLabel?: UIString;
  icon?: UIString;
  unreadCount?: UINumber;
  mentionCount?: UINumber;
  threatBand?: ChatUiThreatBand;
  typingCount?: UINumber;
  presenceCount?: UINumber;
  helperVisible?: UIBoolean;
  invasionActive?: UIBoolean;
  accent: ChatUiAccent;
  tone: ChatUiTone;
  expanded?: UIBoolean;
  tooltip?: UIString;
  roomLabel?: UIString;
  roomSubtitle?: UIString;
  channelLabel?: UIString;
  mountLabel?: UIString;
  liveLabel?: UIString;
  connectionLabel?: UIString;
  statusLine?: UIString;
  pinned?: UIBoolean;
  muted?: UIBoolean;
  disabled?: UIBoolean;
  attention?: ChatUiImportance;
  presenceSummary?: ChatUiCollapsedPillPresenceSummary;
  typingSummary?: ChatUiCollapsedPillTypingSummary;
  threatSummary?: ChatUiCollapsedPillThreatSummary;
  helperSummary?: ChatUiCollapsedPillHelperSummary;
  invasionSummary?: ChatUiCollapsedPillInvasionSummary;
  channelSummaries?: ChatUiCollapsedPillChannelSummary[];
  chips?: ChatUiChip[];
  metrics?: ChatUiMetric[];
  statusPills?: ChatUiPill[];
  actions?: ChatUiCollapsedPillAction[];
}

export interface ChatUiRoomHeaderAction { id: ChatUiId; label: UIString; icon?: UIString; tone?: ChatUiTone; accent?: ChatUiAccent; primary?: UIBoolean; disabled?: UIBoolean; }
export interface ChatUiRoomHeaderViewModel { roomId?: ChatUiRoomId; roomLabel: UIString; roomSubtitle?: UIString; channelLabel?: UIString; channelKind?: ChatUiChannelKind; roomTone?: ChatUiTone; roomAccent?: ChatUiAccent; chips?: ChatUiChip[]; metrics?: ChatUiMetric[]; actions?: ChatUiRoomHeaderAction[]; audienceHeatLabel?: UIString; reputationLabel?: UIString; integrityLabel?: UIString; }
export interface ChatUiEmptyStateViewModel { id: ChatUiId; kind: ChatUiEmptyStateKind; title: UIString; body: UIString; hint?: UIString; tone: ChatUiTone; accent: ChatUiAccent; actions?: ChatUiRoomHeaderAction[]; chips?: ChatUiChip[]; }

export interface ChatUiDrawerFilter { id: ChatUiId; label: UIString; active: UIBoolean; count?: UINumber; tone?: ChatUiTone; accent?: ChatUiAccent; }
export interface ChatUiSearchMatchRange { start: UINumber; end: UINumber; }
export interface ChatUiTranscriptSearchResultViewModel { id: ChatUiSearchResultId; messageId: ChatUiMessageId; channelId?: ChatUiChannelId; channelLabel?: UIString; authorLabel?: UIString; preview: UIString; timestampLabel?: UIString; matches?: ChatUiSearchMatchRange[]; proofLabel?: UIString; threatLabel?: UIString; }
export interface ChatUiTranscriptDrawerSelection { messageId?: ChatUiMessageId; authorLabel?: UIString; text?: UIString; timestampLabel?: UIString; proofSummary?: UIString; threatSummary?: UIString; integritySummary?: UIString; }
export interface ChatUiTranscriptDrawerViewModel { open: UIBoolean; title: UIString; subtitle?: UIString; scope: ChatUiSearchScope; query: UIString; filters: ChatUiDrawerFilter[]; results: ChatUiTranscriptSearchResultViewModel[]; selected?: ChatUiTranscriptDrawerSelection; summaryMetrics?: ChatUiMetric[]; exportReady?: UIBoolean; canSearch?: UIBoolean; canExport?: UIBoolean; emptyState?: ChatUiEmptyStateViewModel; }

export interface ChatUiTranscriptDetailCard { id: ChatUiId; label: UIString; title: UIString; subtitle?: UIString; accent?: ChatUiAccent; tone?: ChatUiTone; }
export interface ChatUiTranscriptRowViewModel { id: ChatUiId; messageId: ChatUiMessageId; role: 'player' | 'system'; channelId?: ChatUiChannelId; channelLabel?: UIString; kindId?: UIString; kindLabel?: UIString; actorId?: ChatUiId; actorLabel?: UIString; actorInitials?: UIString; actorRankLabel?: UIString; actorOriginLabel?: UIString; body: UIString; emoji?: UIString; timestamp?: ChatUiTimestamp; timestampLabel?: UIString; relativeTimestampLabel?: UIString; accent?: ChatUiAccent; tone?: ChatUiTone; selected?: UIBoolean; locked?: UIBoolean; proofHashLabel?: UIString; proofSummary?: UIString; pressureTierLabel?: UIString; tickTierLabel?: UIString; runOutcomeLabel?: UIString; searchBlob?: UIString; chips?: ChatUiChip[]; detailCards?: ChatUiTranscriptDetailCard[]; }
export interface ChatUiTranscriptDrawerHeaderViewModel { activeChannelId?: ChatUiChannelId; roomTitle?: UIString; roomSubtitle?: UIString; modeName?: UIString; connected?: UIBoolean; connectionState?: UIString; onlineCount?: UINumber; activeMembers?: UINumber; typingCount?: UINumber; totalUnread?: UINumber; transcriptLocked?: UIBoolean; }
export interface ChatUiTranscriptDrawerFilterStateViewModel { query?: UIString; channelScope?: UIString; kindScope?: UIString; proofOnly?: UIBoolean; lockedOnly?: UIBoolean; newestFirst?: UIBoolean; channelFilters?: ChatUiDrawerFilter[]; kindFilters?: ChatUiDrawerFilter[]; }
export interface ChatUiTranscriptDrawerSurfaceModel { drawer: ChatUiTranscriptDrawerViewModel; header: ChatUiTranscriptDrawerHeaderViewModel; filterState: ChatUiTranscriptDrawerFilterStateViewModel; rows: ChatUiTranscriptRowViewModel[]; }
export interface ChatUiTranscriptDrawerCallbacks { onClose: () => void; onSearchQueryChange?: (value: string) => void; onSelectChannelScope?: (scopeId: string) => void; onSelectKindScope?: (scopeId: string) => void; onToggleProofOnly?: (next: boolean) => void; onToggleLockedOnly?: (next: boolean) => void; onToggleNewestFirst?: (next: boolean) => void; onJumpToMessage?: (messageId: string) => void; onRequestExport?: () => void; onJumpLatest?: () => void; }

export interface ChatUiComposerQuickInsert { id: ChatUiId; label: UIString; value: UIString; tone?: ChatUiTone; accent?: ChatUiAccent; }
export interface ChatUiComposerReplyTarget { messageId: ChatUiMessageId; authorLabel?: UIString; preview: UIString; }
export interface ChatUiComposerViewModel { draft: UIString; placeholder: UIString; disabled?: UIBoolean; sending?: UIBoolean; cooldownLabel?: UIString; selectedChannelId?: ChatUiChannelId; quickInserts?: ChatUiComposerQuickInsert[]; replyTarget?: ChatUiComposerReplyTarget; hints?: ChatUiCommandHint[]; }
export interface ChatUiShellStatus { connected: UIBoolean; hydrated: UIBoolean; syncing?: UIBoolean; degraded?: UIBoolean; stale?: UIBoolean; errorLabel?: UIString; }
export interface ChatUiUnifiedShellViewModel { mountId?: ChatUiMountId; roomHeader: ChatUiRoomHeaderViewModel; channelTabs: ChatUiChannelTabsViewModel; feed: ChatUiFeedViewModel; composer: ChatUiComposerViewModel; presence: ChatUiPresenceStripViewModel; typing: ChatUiTypingIndicatorViewModel; invasion?: ChatUiInvasionBannerViewModel; threat: ChatUiThreatMeterViewModel; helperPrompt?: ChatUiHelperPromptViewModel; collapsedPill: ChatUiCollapsedPillViewModel; transcriptDrawer: ChatUiTranscriptDrawerViewModel; transcriptDrawerSurface?: ChatUiTranscriptDrawerSurfaceModel; emptyState?: ChatUiEmptyStateViewModel; status: ChatUiShellStatus; }

export const CHAT_UI_DEFAULT_TOKEN_PACK: Readonly<ChatUiTokenPack> = Object.freeze({ themeMode: 'system', density: 'comfortable', rounded: 'xl', shadow: 'soft', borderStyle: 'subtle', glass: false, motionScale: 'standard' });
export const CHAT_UI_DEFAULT_DISPLAY_HINTS: Readonly<ChatUiDisplayHints> = Object.freeze({ compact: false, highlighted: false, selectable: false, actionable: true, hoverable: true, keyboardNavigable: true, truncateBody: false, showMetaRail: true, showTimestamp: true, showAvatar: true, showPersonaTag: true, showProofBadges: true, showThreatBadges: true, showLearningBadges: false });
export const CHAT_UI_EMPTY_STATUS: Readonly<ChatUiShellStatus> = Object.freeze({ connected: true, hydrated: true, syncing: false, degraded: false, stale: false, errorLabel: '' });
export const CHAT_UI_EMPTY_FEED: Readonly<ChatUiFeedViewModel> = Object.freeze({ groups: [], flatRows: [], hasOlder: false, hasNewer: false, unreadCount: 0 });
export const CHAT_UI_EMPTY_PRESENCE: Readonly<ChatUiPresenceStripViewModel> = Object.freeze({ chips: [], totalOnline: 0, totalTyping: 0, totalHostile: 0, totalHelper: 0, totalSpectators: 0 });
export const CHAT_UI_EMPTY_TYPING: Readonly<ChatUiTypingIndicatorViewModel> = Object.freeze({ entities: [], label: '', compactLabel: '', tone: 'neutral', accent: 'slate', visible: false });
export const CHAT_UI_EMPTY_THREAT: Readonly<ChatUiThreatMeterViewModel> = Object.freeze({ band: 'quiet', label: 'Quiet', summary: 'No active threat pressure.', cards: [] });
export const CHAT_UI_EMPTY_COLLAPSED_PILL: Readonly<ChatUiCollapsedPillViewModel> = Object.freeze({ id: 'chat-collapsed-pill', label: 'Chat', unreadCount: 0, mentionCount: 0, threatBand: 'quiet', typingCount: 0, presenceCount: 0, helperVisible: false, invasionActive: false, accent: 'slate', tone: 'neutral', expanded: false });

export function isRecord(value: unknown): value is UnknownRecord { return typeof value === 'object' && value !== null && !Array.isArray(value); }
export function asRecord(value: unknown): UnknownRecord { return isRecord(value) ? value : {}; }
export function asString(value: unknown, fallback = ''): UIString { if (typeof value === 'string') return value; if (typeof value === 'number' && Number.isFinite(value)) return String(value); if (typeof value === 'boolean') return value ? 'true' : 'false'; return fallback; }
export function asNonEmptyString(value: unknown, fallback = ''): UIString { const next = asString(value, fallback).trim(); return next.length > 0 ? next : fallback; }
export function asNumber(value: unknown, fallback = 0): UINumber { if (typeof value === 'number' && Number.isFinite(value)) return value; if (typeof value === 'string') { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; } return fallback; }
export function asBoolean(value: unknown, fallback = false): UIBoolean { if (typeof value === 'boolean') return value; if (typeof value === 'string') { const lowered = value.trim().toLowerCase(); if (lowered === 'true') return true; if (lowered === 'false') return false; } return fallback; }
export function asArray<T = unknown>(value: unknown): T[] { return Array.isArray(value) ? ([...value] as T[]) : []; }
export function maybeText(value: unknown): UIString | undefined { const next = asNonEmptyString(value, ''); return next.length > 0 ? next : undefined; }
export function maybeNumber(value: unknown): UINumber | undefined { if (typeof value === 'number' && Number.isFinite(value)) return value; if (typeof value === 'string') { const parsed = Number(value); if (Number.isFinite(parsed)) return parsed; } return undefined; }
export function toId(prefix: UIString, value: unknown, fallbackSuffix = 'unknown'): ChatUiId { const suffix = asNonEmptyString(value, fallbackSuffix).toLowerCase().replace(/[^a-z0-9:_-]+/g, '-'); return `${prefix}:${suffix}`; }

export function normalizeChannelKind(value: unknown): ChatUiChannelKind { const next = asNonEmptyString(value).toLowerCase(); if (next === 'global' || next === 'chat_channel_global') return 'global'; if (next === 'syndicate' || next === 'alliance') return 'syndicate'; if (['deal_room','dealroom','deal-room','deal'].includes(next)) return 'deal_room'; if (next === 'lobby') return 'lobby'; if (next === 'system') return 'system'; if (next === 'shadow') return 'shadow'; if (next === 'direct' || next === 'dm') return 'direct'; if (next === 'spectator') return 'spectator'; return 'unknown'; }
export function normalizeSourceKind(value: unknown): ChatUiSourceKind { const next = asNonEmptyString(value).toLowerCase(); if (next === 'player') return 'player'; if (next === 'self') return 'self'; if (next === 'helper') return 'helper'; if (next === 'hater') return 'hater'; if (['ambient_npc','npc','ambient'].includes(next)) return 'ambient_npc'; if (next === 'system') return 'system'; if (next === 'moderation') return 'moderation'; if (next === 'server') return 'server'; if (next === 'liveops') return 'liveops'; if (['deal','deal_room'].includes(next)) return 'deal_room'; if (next === 'spectator') return 'spectator'; return 'unknown'; }
export function normalizePresenceState(value: unknown): ChatUiPresenceState { const next = asNonEmptyString(value).toLowerCase(); if (next === 'online') return 'online'; if (next === 'away') return 'away'; if (next === 'busy') return 'busy'; if (next === 'spectating' || next === 'spectator') return 'spectating'; if (next === 'hidden') return 'hidden'; if (next === 'offline') return 'offline'; if (next === 'reconnecting') return 'reconnecting'; return 'unknown'; }
export function normalizeTypingState(value: unknown): ChatUiTypingState { const next = asNonEmptyString(value).toLowerCase(); if (next === 'typing') return 'typing'; if (next === 'paused') return 'paused'; if (next === 'lurking') return 'lurking'; if (next === 'read_wait' || next === 'readwait') return 'read_wait'; if (next === 'weaponized_delay' || next === 'delay') return 'weaponized_delay'; return 'not_typing'; }
export function normalizeThreatBand(value: unknown): ChatUiThreatBand { const next = asNonEmptyString(value).toLowerCase(); if (next === 'elevated') return 'elevated'; if (next === 'pressured' || next === 'pressure') return 'pressured'; if (next === 'hostile') return 'hostile'; if (next === 'critical') return 'critical'; if (next === 'catastrophic') return 'catastrophic'; return 'quiet'; }
export function normalizeIntegrityBand(value: unknown): ChatUiIntegrityBand { const next = asNonEmptyString(value).toLowerCase(); if (next === 'guarded') return 'guarded'; if (next === 'verified') return 'verified'; if (next === 'restricted') return 'restricted'; if (next === 'shadowed') return 'shadowed'; if (next === 'sealed') return 'sealed'; return 'open'; }
export function normalizeProofBand(value: unknown): ChatUiProofBand { const next = asNonEmptyString(value).toLowerCase(); if (next === 'trace') return 'trace'; if (next === 'linked') return 'linked'; if (next === 'verified') return 'verified'; if (next === 'sealed') return 'sealed'; return 'none'; }
export function normalizeTone(value: unknown): ChatUiTone { const next = asNonEmptyString(value).toLowerCase(); return (['neutral','calm','positive','supportive','warning','danger','hostile','ghost','premium','stealth','celebratory','dramatic'] as const).includes(next as ChatUiTone) ? (next as ChatUiTone) : 'neutral'; }
export function normalizeAccent(value: unknown): ChatUiAccent { const next = asNonEmptyString(value).toLowerCase(); return (['slate','silver','emerald','amber','rose','red','violet','cyan','indigo','gold','obsidian'] as const).includes(next as ChatUiAccent) ? (next as ChatUiAccent) : 'slate'; }
export function normalizeMessageKind(value: unknown): ChatUiMessageKind { const next = asNonEmptyString(value).toLowerCase(); return (['text','system_notice','scene_marker','divider','proof_event','threat_event','helper_event','invasion_event','deal_event','presence_event','typing_event','legend_event','reward_event','empty_hint'] as const).includes(next as ChatUiMessageKind) ? (next as ChatUiMessageKind) : 'unknown'; }
export function normalizeAuthorDisposition(value: unknown): ChatUiAuthorDisposition { const next = asNonEmptyString(value).toLowerCase(); if (next === 'helper' || next === 'mentor') return 'guiding'; if (next === 'hater') return 'hostile'; if (next === 'system') return 'systemic'; return (['friendly','neutral','hostile','predatory','guiding','spectator','systemic'] as const).includes(next as ChatUiAuthorDisposition) ? (next as ChatUiAuthorDisposition) : 'unknown'; }
export function normalizeImportance(value: unknown): ChatUiImportance { const next = asNonEmptyString(value).toLowerCase(); return (['low','normal','elevated','high','critical'] as const).includes(next as ChatUiImportance) ? (next as ChatUiImportance) : 'normal'; }
export function normalizeEmphasis(value: unknown): ChatUiEmphasis { const next = asNonEmptyString(value).toLowerCase(); return (['subtle','standard','strong','hero','suppressed'] as const).includes(next as ChatUiEmphasis) ? (next as ChatUiEmphasis) : 'standard'; }
export function normalizeDensity(value: unknown): ChatUiDensity { const next = asNonEmptyString(value).toLowerCase(); return (['compact','comfortable','expanded','cinematic'] as const).includes(next as ChatUiDensity) ? (next as ChatUiDensity) : 'comfortable'; }
export function normalizeUrgency(value: unknown): ChatUiUrgency { const next = asNonEmptyString(value).toLowerCase(); return (['idle','low','medium','high','immediate'] as const).includes(next as ChatUiUrgency) ? (next as ChatUiUrgency) : 'idle'; }
export function normalizeDisplayIntent(value: unknown): ChatUiDisplayIntent { const next = asNonEmptyString(value).toLowerCase(); return (['default','alert','proof','instruction','helper','threat','system','celebration','deal','spectator'] as const).includes(next as ChatUiDisplayIntent) ? (next as ChatUiDisplayIntent) : 'default'; }
export function normalizeHelperMode(value: unknown): ChatUiHelperMode { const next = asNonEmptyString(value).toLowerCase(); return (['soft','standard','blunt','rescue','mentor','strategic'] as const).includes(next as ChatUiHelperMode) ? (next as ChatUiHelperMode) : 'standard'; }
export function normalizeEmptyStateKind(value: unknown): ChatUiEmptyStateKind { const next = asNonEmptyString(value).toLowerCase(); return (['cold_start','quiet_room','loading','filtered_empty','channel_locked','shadow_only','connection_lost','post_run_reset','error'] as const).includes(next as ChatUiEmptyStateKind) ? (next as ChatUiEmptyStateKind) : 'quiet_room'; }
export function normalizeSearchScope(value: unknown): ChatUiSearchScope { const next = asNonEmptyString(value).toLowerCase(); return (['current_channel','current_room','all_visible','proof_only','legend_only','helper_only','threat_only'] as const).includes(next as ChatUiSearchScope) ? (next as ChatUiSearchScope) : 'current_channel'; }
export function normalizeCollapsedPresenceMood(value: unknown): ChatUiCollapsedPillPresenceMood { const next = asNonEmptyString(value).toLowerCase(); return (['quiet','watched','active','swarming'] as const).includes(next as ChatUiCollapsedPillPresenceMood) ? (next as ChatUiCollapsedPillPresenceMood) : 'quiet'; }
export function normalizeCollapsedActionKind(value: unknown): ChatUiCollapsedPillActionKind { const next = asNonEmptyString(value).toLowerCase(); return (['open','toggle','dismiss','channel','cta','secondary'] as const).includes(next as ChatUiCollapsedPillActionKind) ? (next as ChatUiCollapsedPillActionKind) : 'open'; }

export function createMetric(raw: unknown, index = 0): ChatUiMetric { const s = asRecord(raw); return { id: asNonEmptyString(s.id, `metric:${index}`), label: asNonEmptyString(s.label, 'Metric'), value: asNonEmptyString(s.value, '0'), rawValue: maybeNumber(s.rawValue), tone: normalizeTone(s.tone), accent: normalizeAccent(s.accent), importance: normalizeImportance(s.importance), delta: isRecord(s.delta) ? { direction: (['up','down','flat'] as const).includes(asNonEmptyString(s.delta.direction) as 'up'|'down'|'flat') ? (asNonEmptyString(s.delta.direction) as 'up'|'down'|'flat') : 'flat', amount: maybeNumber(s.delta.amount), label: maybeText(s.delta.label) } : undefined, tooltip: maybeText(s.tooltip) }; }
export function createPill(raw: unknown, index = 0): ChatUiPill { const s = asRecord(raw); return { id: asNonEmptyString(s.id, `pill:${index}`), label: asNonEmptyString(s.label, 'Pill'), value: maybeText(s.value), icon: maybeText(s.icon), tone: normalizeTone(s.tone), accent: normalizeAccent(s.accent), clickable: asBoolean(s.clickable), selected: asBoolean(s.selected), tooltip: maybeText(s.tooltip) }; }
export function createChips(values: readonly unknown[]): ChatUiChip[] { return values.map((raw, index) => { const s = asRecord(raw); return { id: asNonEmptyString(s.id, `chip:${index}`), label: asNonEmptyString(s.label, 'Chip'), shortLabel: maybeText(s.shortLabel), icon: maybeText(s.icon), tone: normalizeTone(s.tone), accent: normalizeAccent(s.accent), emphasis: normalizeEmphasis(s.emphasis), importance: normalizeImportance(s.importance), active: asBoolean(s.active), disabled: asBoolean(s.disabled), tooltip: maybeText(s.tooltip), count: maybeNumber(s.count) }; }); }
export function createBadges(values: readonly unknown[]): ChatUiBadge[] { return values.map((raw, index) => { const s = asRecord(raw); return { id: asNonEmptyString(s.id, `badge:${index}`), kind: (['proof','threat','integrity','helper','hater','system','presence','legend','reward','channel'] as const).includes(asNonEmptyString(s.kind) as ChatUiBadge['kind']) ? (asNonEmptyString(s.kind) as ChatUiBadge['kind']) : 'custom', label: asNonEmptyString(s.label, 'Badge'), shortLabel: maybeText(s.shortLabel), icon: maybeText(s.icon), tone: normalizeTone(s.tone), accent: normalizeAccent(s.accent), importance: normalizeImportance(s.importance), tooltip: maybeText(s.tooltip), emphasis: normalizeEmphasis(s.emphasis) }; }); }
export function createHeaderAction(raw: unknown): ChatUiRoomHeaderAction { const s = asRecord(raw); return { id: asNonEmptyString(s.id, toId('header-action', s.label ?? 'action')), label: asNonEmptyString(s.label, 'Action'), icon: maybeText(s.icon), tone: normalizeTone(s.tone), accent: normalizeAccent(s.accent), primary: asBoolean(s.primary), disabled: asBoolean(s.disabled) }; }
export function buildEmptyStateViewModel(raw: unknown): ChatUiEmptyStateViewModel { const s = asRecord(raw); const kind = normalizeEmptyStateKind(s.kind); const defaultTitle = { cold_start:'No history yet', quiet_room:'Quiet room', loading:'Loading chat', filtered_empty:'Nothing matches', channel_locked:'Channel locked', shadow_only:'Shadow-only state', connection_lost:'Connection lost', post_run_reset:'Run ended', error:'Chat unavailable' }[kind]; const defaultBody = { cold_start:'Open the room and make the first move.', quiet_room:'No one has spoken recently.', loading:'Hydrating transcript and room state.', filtered_empty:'Try widening your filters or search scope.', channel_locked:'This channel is not available in the current state.', shadow_only:'Visible output is currently suppressed.', connection_lost:'Reconnect to restore live chat signals.', post_run_reset:'The last run has ended. Review the transcript or start again.', error:'The shell is up, but the chat surface cannot be rendered cleanly.' }[kind]; return { id: asNonEmptyString(s.id, `empty:${kind}`), kind, title: asNonEmptyString(s.title, defaultTitle), body: asNonEmptyString(s.body, defaultBody), hint: maybeText(s.hint), tone: normalizeTone(s.tone || (kind === 'error' || kind === 'connection_lost' ? 'danger' : kind === 'post_run_reset' ? 'dramatic' : kind === 'channel_locked' || kind === 'shadow_only' ? 'warning' : 'neutral')), accent: normalizeAccent(s.accent || (kind === 'error' || kind === 'connection_lost' ? 'red' : kind === 'post_run_reset' ? 'violet' : kind === 'channel_locked' ? 'amber' : kind === 'shadow_only' ? 'obsidian' : 'slate')), actions: createArrayHeaderActions(s.actions), chips: createChips(asArray(s.chips)) }; }
function createArrayHeaderActions(value: unknown): ChatUiRoomHeaderAction[] | undefined { const actions = asArray(value).map(createHeaderAction); return actions.length ? actions : undefined; }
export function buildRoomHeaderViewModel(raw: unknown): ChatUiRoomHeaderViewModel { const s = asRecord(raw); const kind = normalizeChannelKind(s.channelKind ?? s.kind); return { roomId: maybeText(s.roomId), roomLabel: asNonEmptyString(s.roomLabel ?? s.label, 'Chat Room'), roomSubtitle: maybeText(s.roomSubtitle ?? s.subtitle), channelLabel: asNonEmptyString(s.channelLabel, ({ global:'Global', syndicate:'Syndicate', deal_room:'Deal Room', lobby:'Lobby', system:'System', shadow:'Shadow', direct:'Direct', spectator:'Spectator', unknown:'Unknown' } as Record<ChatUiChannelKind,string>)[kind]), channelKind: kind, roomTone: normalizeTone(s.roomTone), roomAccent: normalizeAccent(s.roomAccent), chips: createChips(asArray(s.chips)), metrics: asArray(s.metrics).map(createMetric), actions: createArrayHeaderActions(s.actions), audienceHeatLabel: maybeText(s.audienceHeatLabel), reputationLabel: maybeText(s.reputationLabel), integrityLabel: maybeText(s.integrityLabel) }; }
export function buildTypingLabel(entities: readonly ChatUiTypingEntity[]): UIString { const names = entities.map((entity) => entity.label).filter(Boolean); if (names.length === 0) return ''; if (names.length === 1) return `${names[0]} is typing…`; if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`; return `${names[0]}, ${names[1]}, and ${names.length - 2} more are typing…`; }
export function buildThreatMeterViewModel(raw: unknown): ChatUiThreatMeterViewModel { const s = asRecord(raw); const band = normalizeThreatBand(s.band ?? s.threatBand); const cards = asArray(s.cards).map((item, index) => { const r = asRecord(item); return { id: asNonEmptyString(r.id, `threat-card:${index}`), label: asNonEmptyString(r.label, 'Threat'), value: asNonEmptyString(r.value, '0'), band: normalizeThreatBand(r.band), tone: normalizeTone(r.tone), accent: normalizeAccent(r.accent), subtitle: maybeText(r.subtitle), trend: isRecord(r.trend) ? { direction: (['up','down','flat'] as const).includes(asNonEmptyString(r.trend.direction) as 'up'|'down'|'flat') ? (asNonEmptyString(r.trend.direction) as 'up'|'down'|'flat') : 'flat', amount: maybeNumber(r.trend.amount), label: maybeText(r.trend.label) } : undefined } satisfies ChatUiThreatCardViewModel; }); return { band, label: asNonEmptyString(s.label, ({ quiet:'Quiet', elevated:'Elevated', pressured:'Pressured', hostile:'Hostile', critical:'Critical', catastrophic:'Catastrophic' } as Record<ChatUiThreatBand,string>)[band]), summary: maybeText(s.summary), cards, dominantThreatLabel: maybeText(s.dominantThreatLabel), recommendationLabel: maybeText(s.recommendationLabel), confidenceLabel: maybeText(s.confidenceLabel) }; }
export function buildCollapsedPillViewModel(raw: unknown): ChatUiCollapsedPillViewModel { const s = asRecord(raw); return { id: asNonEmptyString(s.id, 'chat-collapsed-pill'), label: asNonEmptyString(s.label, 'Chat'), shortLabel: maybeText(s.shortLabel), icon: maybeText(s.icon), unreadCount: maybeNumber(s.unreadCount), mentionCount: maybeNumber(s.mentionCount), threatBand: normalizeThreatBand(s.threatBand ?? asRecord(s.threatSummary).band), typingCount: maybeNumber(s.typingCount ?? asRecord(s.typingSummary).count), presenceCount: maybeNumber(s.presenceCount ?? asRecord(s.presenceSummary).count), helperVisible: asBoolean(s.helperVisible ?? asRecord(s.helperSummary).visible), invasionActive: asBoolean(s.invasionActive ?? asRecord(s.invasionSummary).active), accent: normalizeAccent(s.accent || (asBoolean(s.invasionActive) ? 'red' : asBoolean(s.helperVisible) ? 'emerald' : asNumber(s.unreadCount, 0) > 0 ? 'silver' : 'slate')), tone: normalizeTone(s.tone || (asBoolean(s.invasionActive) ? 'danger' : asBoolean(s.helperVisible) ? 'supportive' : 'neutral')), expanded: asBoolean(s.expanded), tooltip: maybeText(s.tooltip), roomLabel: maybeText(s.roomLabel), roomSubtitle: maybeText(s.roomSubtitle), channelLabel: maybeText(s.channelLabel), mountLabel: maybeText(s.mountLabel), liveLabel: maybeText(s.liveLabel), connectionLabel: maybeText(s.connectionLabel), statusLine: maybeText(s.statusLine), pinned: asBoolean(s.pinned), muted: asBoolean(s.muted), disabled: asBoolean(s.disabled), attention: normalizeImportance(s.attention), presenceSummary: isRecord(s.presenceSummary) ? { count: maybeNumber(s.presenceSummary.count), activeCount: maybeNumber(s.presenceSummary.activeCount), mood: normalizeCollapsedPresenceMood(s.presenceSummary.mood), moodLabel: maybeText(s.presenceSummary.moodLabel), label: maybeText(s.presenceSummary.label), observerLabels: asArray(s.presenceSummary.observerLabels).map((v) => asNonEmptyString(v)).filter(Boolean), tooltip: maybeText(s.presenceSummary.tooltip) } : undefined, typingSummary: isRecord(s.typingSummary) ? { count: maybeNumber(s.typingSummary.count), label: maybeText(s.typingSummary.label), actorLabels: asArray(s.typingSummary.actorLabels).map((v) => asNonEmptyString(v)).filter(Boolean), strongestState: normalizeTypingState(s.typingSummary.strongestState), tooltip: maybeText(s.typingSummary.tooltip) } : undefined, threatSummary: isRecord(s.threatSummary) ? { band: normalizeThreatBand(s.threatSummary.band), score01: maybeNumber(s.threatSummary.score01), label: maybeText(s.threatSummary.label), helperPressure: maybeNumber(s.threatSummary.helperPressure), haterPressure: maybeNumber(s.threatSummary.haterPressure), crowdHeat: maybeNumber(s.threatSummary.crowdHeat), tooltip: maybeText(s.threatSummary.tooltip) } : undefined, helperSummary: isRecord(s.helperSummary) ? { visible: asBoolean(s.helperSummary.visible), label: maybeText(s.helperSummary.label), body: maybeText(s.helperSummary.body), urgency: normalizeUrgency(s.helperSummary.urgency), trustWindowPct: maybeNumber(s.helperSummary.trustWindowPct), ctaLabel: maybeText(s.helperSummary.ctaLabel), tooltip: maybeText(s.helperSummary.tooltip) } : undefined, invasionSummary: isRecord(s.invasionSummary) ? { active: asBoolean(s.invasionSummary.active), label: maybeText(s.invasionSummary.label), stageLabel: maybeText(s.invasionSummary.stageLabel), aggressorLabel: maybeText(s.invasionSummary.aggressorLabel), priorityLabel: maybeText(s.invasionSummary.priorityLabel), tooltip: maybeText(s.invasionSummary.tooltip) } : undefined, channelSummaries: asArray(s.channelSummaries).map((item, index) => { const r = asRecord(item); return { id: asNonEmptyString(r.id, `collapsed-channel:${index}`), channelId: asNonEmptyString(r.channelId ?? r.id, `channel:${index}`), label: asNonEmptyString(r.label, 'Channel'), shortLabel: maybeText(r.shortLabel), kind: normalizeChannelKind(r.kind), icon: maybeText(r.icon), unreadCount: maybeNumber(r.unreadCount), mentionCount: maybeNumber(r.mentionCount), typingCount: maybeNumber(r.typingCount), active: asBoolean(r.active), helperPending: asBoolean(r.helperPending), haterPending: asBoolean(r.haterPending), accent: normalizeAccent(r.accent), tone: normalizeTone(r.tone), tooltip: maybeText(r.tooltip), disabled: asBoolean(r.disabled) } satisfies ChatUiCollapsedPillChannelSummary; }), chips: createChips(asArray(s.chips)), metrics: asArray(s.metrics).map(createMetric), statusPills: asArray(s.statusPills).map(createPill), actions: asArray(s.actions).map((item, index) => { const r = asRecord(item); return { id: asNonEmptyString(r.id, `collapsed-action:${index}`), label: asNonEmptyString(r.label, 'Action'), icon: maybeText(r.icon), kind: normalizeCollapsedActionKind(r.kind), primary: asBoolean(r.primary), channelId: maybeText(r.channelId), tone: normalizeTone(r.tone), accent: normalizeAccent(r.accent), tooltip: maybeText(r.tooltip), disabled: asBoolean(r.disabled) } satisfies ChatUiCollapsedPillAction; }) };
export function buildTranscriptDrawerViewModel(raw: unknown): ChatUiTranscriptDrawerViewModel { const s = asRecord(raw); return { open: asBoolean(s.open), title: asNonEmptyString(s.title, 'Transcript'), subtitle: maybeText(s.subtitle), scope: normalizeSearchScope(s.scope), query: asNonEmptyString(s.query, ''), filters: asArray(s.filters).map((item, index) => { const r = asRecord(item); return { id: asNonEmptyString(r.id, `drawer-filter:${index}`), label: asNonEmptyString(r.label, 'Filter'), active: asBoolean(r.active), count: maybeNumber(r.count), tone: normalizeTone(r.tone), accent: normalizeAccent(r.accent) } satisfies ChatUiDrawerFilter; }), results: asArray(s.results).map((item, index) => { const r = asRecord(item); return { id: asNonEmptyString(r.id, `search-result:${index}`), messageId: asNonEmptyString(r.messageId, ''), channelId: maybeText(r.channelId), channelLabel: maybeText(r.channelLabel), authorLabel: maybeText(r.authorLabel), preview: asNonEmptyString(r.preview, ''), timestampLabel: maybeText(r.timestampLabel), matches: asArray(r.matches).map((m) => ({ start: asNumber(asRecord(m).start, 0), end: asNumber(asRecord(m).end, 0) })), proofLabel: maybeText(r.proofLabel), threatLabel: maybeText(r.threatLabel) } satisfies ChatUiTranscriptSearchResultViewModel; }), selected: isRecord(s.selected) ? { messageId: maybeText(s.selected.messageId), authorLabel: maybeText(s.selected.authorLabel), text: maybeText(s.selected.text), timestampLabel: maybeText(s.selected.timestampLabel), proofSummary: maybeText(s.selected.proofSummary), threatSummary: maybeText(s.selected.threatSummary), integritySummary: maybeText(s.selected.integritySummary) } : undefined, summaryMetrics: asArray(s.summaryMetrics).map(createMetric), exportReady: asBoolean(s.exportReady), canSearch: asBoolean(s.canSearch, true), canExport: asBoolean(s.canExport), emptyState: isRecord(s.emptyState) ? buildEmptyStateViewModel(s.emptyState) : undefined };
export function deriveCollapsedPillFromShell(shell: Partial<ChatUiUnifiedShellViewModel>): ChatUiCollapsedPillViewModel { return buildCollapsedPillViewModel({ id: shell.collapsedPill?.id, icon: shell.collapsedPill?.icon, label: shell.collapsedPill?.label ?? shell.roomHeader?.roomLabel ?? 'Chat', shortLabel: shell.collapsedPill?.shortLabel ?? shell.roomHeader?.channelLabel, unreadCount: shell.feed?.unreadCount ?? shell.collapsedPill?.unreadCount, mentionCount: shell.collapsedPill?.mentionCount, threatBand: shell.threat?.band ?? shell.collapsedPill?.threatBand, typingCount: shell.typing?.entities.length ?? shell.collapsedPill?.typingCount, presenceCount: shell.presence?.chips.length ?? shell.collapsedPill?.presenceCount, helperVisible: shell.helperPrompt?.visible ?? shell.collapsedPill?.helperVisible, invasionActive: shell.invasion?.active ?? shell.collapsedPill?.invasionActive, accent: shell.collapsedPill?.accent, tone: shell.collapsedPill?.tone, expanded: shell.collapsedPill?.expanded, tooltip: shell.collapsedPill?.tooltip, roomLabel: shell.collapsedPill?.roomLabel ?? shell.roomHeader?.roomLabel, roomSubtitle: shell.collapsedPill?.roomSubtitle ?? shell.roomHeader?.roomSubtitle, channelLabel: shell.collapsedPill?.channelLabel ?? shell.roomHeader?.channelLabel, mountLabel: shell.collapsedPill?.mountLabel ?? shell.mountId, connectionLabel: shell.status?.connected ? 'Connected' : 'Disconnected', threatSummary: shell.collapsedPill?.threatSummary ?? (shell.threat ? { band: shell.threat.band, label: shell.threat.label, tooltip: shell.threat.summary } : undefined), helperSummary: shell.collapsedPill?.helperSummary ?? (shell.helperPrompt ? { visible: shell.helperPrompt.visible, label: shell.helperPrompt.helperLabel, body: shell.helperPrompt.summary ?? shell.helperPrompt.body, urgency: shell.helperPrompt.urgency, ctaLabel: shell.helperPrompt.actions?.find((a) => a.primary)?.label } : undefined), invasionSummary: shell.collapsedPill?.invasionSummary ?? (shell.invasion ? { active: shell.invasion.active, label: shell.invasion.title, stageLabel: shell.invasion.subtitle, priorityLabel: shell.invasion.countdownLabel, tooltip: shell.invasion.summary } : undefined), presenceSummary: shell.collapsedPill?.presenceSummary ?? (shell.presence ? { count: shell.presence.chips.length, activeCount: shell.presence.totalOnline, label: shell.presence.totalOnline ? `${shell.presence.totalOnline} online` : undefined, observerLabels: shell.presence.chips.map((c) => c.label).filter(Boolean).slice(0, 6) } : undefined), typingSummary: shell.collapsedPill?.typingSummary ?? (shell.typing ? { count: shell.typing.entities.length, label: shell.typing.compactLabel ?? shell.typing.label, actorLabels: shell.typing.entities.map((e) => e.label).filter(Boolean), strongestState: shell.typing.entities.some((e) => e.typingState === 'weaponized_delay') ? 'weaponized_delay' : shell.typing.entities.some((e) => e.typingState === 'typing') ? 'typing' : shell.typing.entities[0]?.typingState } : undefined), channelSummaries: shell.collapsedPill?.channelSummaries ?? shell.channelTabs?.tabs.map((tab, index) => ({ id: `collapsed-channel:${index}`, channelId: tab.id, label: tab.label, shortLabel: tab.shortLabel, kind: tab.kind, icon: tab.icon, unreadCount: tab.counts?.unread, mentionCount: tab.counts?.unseenMentions, active: tab.active, helperPending: false, haterPending: (tab.counts?.threatCount ?? 0) > 0, accent: tab.accent, tone: tab.tone, tooltip: tab.tooltip, disabled: tab.available === false || tab.locked === true })), chips: shell.collapsedPill?.chips, metrics: shell.collapsedPill?.metrics, statusPills: shell.collapsedPill?.statusPills, actions: shell.collapsedPill?.actions }); }
export function isUnifiedShellViewModel(value: unknown): value is ChatUiUnifiedShellViewModel { const v = asRecord(value); return isRecord(v.roomHeader) && isRecord(v.channelTabs) && isRecord(v.feed) && isRecord(v.composer) && isRecord(v.presence) && isRecord(v.typing) && isRecord(v.threat) && isRecord(v.collapsedPill) && isRecord(v.transcriptDrawer) && isRecord(v.status); }

export const CHAT_UI_TYPES_MANIFEST = Object.freeze({ version: '2.2.0', owner: 'pzo-web/src/components/chat/uiTypes.ts', contractLayer: 'presentation', presentationOnly: true, notes: ['UI-only models live here.', 'Engine truth must remain in the engine lane.', 'Shared chat contracts remain canonical for runtime truth.', 'Helper prompt compatibility accepts compact and rich prompt payloads.', 'Collapsed pill contracts support rich status summaries, channel rollups, status pills, and shell-derived fallback state.', 'Transcript drawer shell surface models include row detail cards, header state, filter state, and callback contracts.'] });
