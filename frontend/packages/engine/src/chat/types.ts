/**
 * ============================================================================
 * @pzo/engine/chat/types.ts
 * FILE: frontend/packages/engine/src/chat/types.ts
 * ----------------------------------------------------------------------------
 * Canonical package chat contracts for omnipresent runtime, pzo-web adoption,
 * and platform-shell cutover.
 *
 * Design:
 * - Preserve the stronger package surface from the promoted package lane
 * - Preserve runtime contracts needed by omnipresent chat orchestration
 * - Keep chat package contracts UI-safe and transport-agnostic
 * - Retain shell migration compatibility by supporting both SERVER and
 *   SPECTATOR channels during cutover
 * ============================================================================
 */

export type RivalryPhase =
  | 'NOTICE_FILED'
  | 'DUE_DILIGENCE'
  | 'CAPITAL_BATTLE'
  | 'LEDGER_CLOSE'
  | 'CLOSED';

export type ChatChannel =
  | 'GLOBAL'
  | 'SERVER'
  | 'SYNDICATE'
  | 'DEAL_ROOM'
  | 'DIRECT'
  | 'SPECTATOR';

export type ChannelType = ChatChannel;
export type ChatPanelView = ChatChannel | 'ROOMS';
export type ChatRoomId = string;

export type PartnerRank =
  | 'ASSOCIATE'
  | 'JUNIOR_PARTNER'
  | 'PARTNER'
  | 'SENIOR_PARTNER'
  | 'MANAGING_PARTNER';

export type RoomType = 'HOUSEHOLD_TABLE' | 'RIVALRY_ROOM' | 'CUSTOM';

export type MessageKind =
  | 'PLAYER'
  | 'SYSTEM'
  | 'MARKET_ALERT'
  | 'ACHIEVEMENT'
  | 'BOT_TAUNT'
  | 'BOT_ATTACK'
  | 'SHIELD_EVENT'
  | 'CASCADE_ALERT'
  | 'DEAL_RECAP'
  | 'HELPER_TIP'
  | 'PLAYER_RESPONSE'
  | 'RIVALRY_BULLETIN'
  | 'RIVALRY_MOVE'
  | (string & {});

export type DealRoomBulletinType =
  | 'MARKET_PHASE_BULLETIN'
  | 'SETTLEMENT_HASH_CARD';

export interface MarketMoveAlertPayload {
  readonly rivalryId: string;
  readonly phase: RivalryPhase;
  readonly challenger: {
    readonly syndicateId: string;
    readonly name: string;
    readonly banner: string;
    readonly capitalScore: number;
  };
  readonly defender: {
    readonly syndicateId: string;
    readonly name: string;
    readonly banner: string;
    readonly capitalScore: number;
  };
  readonly phaseEndsAt: string;
  readonly deepLink?: string;
  readonly proofHash?: string;
  readonly yieldCaptureAmount?: number;
}

export interface PackageChatMessage {
  readonly id: string;
  readonly channel: ChatChannel;
  readonly roomId?: ChatRoomId | null;
  readonly kind: MessageKind;
  readonly senderId: string | 'SYSTEM';
  readonly senderName?: string;
  readonly senderRank?: string;
  readonly body: string;
  readonly ts: number;
  readonly createdAt?: string;
  readonly immutable?: boolean;
  readonly recipientId?: string;
  readonly emoji?: string;
  readonly proofHash?: string;
  readonly meta?: Record<string, unknown>;
  readonly marketMoveAlert?: MarketMoveAlertPayload;
  readonly bulletinType?: DealRoomBulletinType;
  readonly bulletinPhase?: RivalryPhase;
  readonly phase?: RivalryPhase;
  readonly dealRoomMeta?: Record<string, unknown>;
  readonly wasAdapted?: boolean;
  readonly sentimentSignal?: string;
}

export interface RoomMember {
  readonly userId: string;
  readonly displayName: string;
  readonly isOwner: boolean;
  readonly isOnline: boolean;
  readonly joinedAt: string;
}

export type PackageChatRoomMember = RoomMember;

export interface PackageChatRoom {
  readonly id: ChatRoomId;
  readonly name: string;
  readonly type: RoomType;
  readonly creatorId: string;
  readonly maxMembers: number;
  readonly memberCount: number;
  readonly isInviteOnly: boolean;
  readonly inviteToken: string | null;
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly isWarRoom: boolean;
  readonly members?: readonly RoomMember[];
}

export interface ActiveRivalry {
  readonly rivalryId: string;
  readonly phase: RivalryPhase;
  readonly phaseEndsAt: string;
  readonly challengerSyndicateId: string;
  readonly defenderSyndicateId: string;
  readonly challengerName: string;
  readonly defenderName: string;
  readonly challengerBanner: string;
  readonly defenderBanner: string;
  readonly challengerScore: number;
  readonly defenderScore: number;
  readonly mySyndicateId: string;
  readonly dealRoomChannel?: ChatChannel;
}

export interface AlliancePanelState {
  readonly syndicateName: string;
  readonly syndicateBanner: string;
  readonly partnerRank: PartnerRank;
  readonly memberCount: number;
  readonly treasuryBalance: number;
  readonly liquidityShieldExpiresAt?: string | null;
  readonly activeRivalry?: ActiveRivalry | null;
  readonly canFileNotice: boolean;
}

export interface DealRoomMessageViewModel {
  readonly messageId: string;
  readonly senderId: string | 'SYSTEM';
  readonly senderName?: string;
  readonly body: string;
  readonly createdAt: string;
  readonly immutable: boolean;
  readonly bulletinType?: DealRoomBulletinType;
  readonly phase?: RivalryPhase;
}

export interface DealRoomState {
  readonly rivalryId: string;
  readonly phase: RivalryPhase;
  readonly phaseEndsAt: string;
  readonly challengerName: string;
  readonly defenderName: string;
  readonly challengerScore: number;
  readonly defenderScore: number;
  readonly myScore: number;
  readonly messages: readonly DealRoomMessageViewModel[];
  readonly isLive: boolean;
  readonly proofHash?: string;
}

export interface ChatWorkspaceTab {
  readonly id: ChatPanelView;
  readonly label: string;
  readonly accent: string;
}

export interface OmnipresentChatContext {
  readonly runId?: string | null;
  readonly mode?: string | null;
  readonly tick?: number;
  readonly lifecycleState?: string | null;
  readonly pressureTier?: string | null;
  readonly pressureScore?: number;
  readonly haterHeat?: number;
  readonly activeBotsCount?: number;
  readonly weakestLayerId?: string | null;
  readonly shieldIntegrityPct?: number;
  readonly breachCascade?: boolean;
  readonly negativeCascadeCount?: number;
  readonly positiveCascadeCount?: number;
  readonly sovereigntyGrade?: string | null;
  readonly proofHash?: string | null;
  readonly pipelineStatus?: string | null;
  readonly netWorth?: number;
  readonly cash?: number;
  readonly income?: number;
  readonly expenses?: number;
  readonly regime?: string | null;
  readonly title?: string | null;
  readonly subtitle?: string | null;
  readonly [key: string]: unknown;
}

export interface LearningProfileSnapshot {
  readonly dominantTone: 'CALM' | 'QUESTION' | 'ANGRY' | 'FLEX' | 'TROLL' | 'UNKNOWN';
  readonly messagesSent: number;
  readonly recentPressureMentions: number;
  readonly recentMoneyMentions: number;
  readonly recentBotMentions: number;
}

export interface PackageChatRuntimeOptions {
  readonly currentUserId: string;
  readonly displayName?: string;
  readonly mode?: string;
  readonly isLobby?: boolean;
  readonly defaultOpen?: boolean;
  readonly defaultPanel?: ChatPanelView;
  readonly title?: string;
  readonly subtitle?: string;
  readonly initialMessages?: readonly PackageChatMessage[];
  readonly initialRooms?: readonly PackageChatRoom[];
  readonly initialAlliance?: Partial<AlliancePanelState>;
  readonly initialRivalry?: ActiveRivalry | null;
  readonly initialContext?: Partial<OmnipresentChatContext>;
  readonly maxMessages?: number;
  readonly onSendRemote?: (message: PackageChatMessage) => void | Promise<void>;
}

export type GameEventType =
  | 'RUN_STARTED'
  | 'RUN_ENDED'
  | 'PRESSURE_TIER_CHANGED'
  | 'BOT_ATTACK'
  | 'SHIELD_BREACH'
  | 'CASCADE_TRIGGERED'
  | 'SOVEREIGNTY_GRADE_CHANGED'
  | 'PIPELINE_STATUS_CHANGED'
  | 'RIVALRY_PHASE_CHANGED'
  | 'MARKET_ALERT'
  | 'SYSTEM';

export interface OmnipresentChatModel {
  readonly currentUserId: string;
  readonly activeChannel: ChatPanelView;
  readonly visibleChannel: ChatChannel;
  readonly visibleMessages: readonly PackageChatMessage[];
  readonly rooms: readonly PackageChatRoom[];
  readonly alliance: AlliancePanelState;
  readonly dealRoom: DealRoomState | null;
  readonly tabs: readonly ChatWorkspaceTab[];
  readonly title: string;
  readonly subtitle: string;
}

export interface OmnipresentChatActions {
  readonly onChannelChange?: (channel: ChatPanelView) => void;
  readonly onSendMessage?: (channel: ChatChannel, body: string) => void;
  readonly onAlertClick?: (rivalryId: string) => void;
  readonly onFileNotice?: () => void;
  readonly onEnterDealRoom?: (rivalryId: string) => void;
  readonly onCreateRoom?: (
    name: string,
    type: RoomType,
    maxMembers: number,
    inviteOnly: boolean,
  ) => Promise<string>;
  readonly onJoinRoom?: (roomId: string, inviteToken?: string) => Promise<void>;
  readonly onLeaveRoom?: (roomId: string) => Promise<void>;
  readonly onSelectRoom?: (roomId: string) => void;
}

export interface OmnipresentChatRuntimeApi {
  readonly currentUserId: string;
  readonly isOpen: boolean;
  readonly activePanel: ChatPanelView;
  readonly visibleChannel: ChatChannel;
  readonly messages: readonly PackageChatMessage[];
  readonly allMessages: readonly PackageChatMessage[];
  readonly unread: Record<ChatChannel, number>;
  readonly totalUnread: number;
  readonly availableChannels: readonly ChatChannel[];
  readonly rooms: readonly PackageChatRoom[];
  readonly activeRoomId: string | null;
  readonly alliance: AlliancePanelState;
  readonly activeRivalry: ActiveRivalry | null;
  readonly dealRoom: DealRoomState | null;
  readonly context: OmnipresentChatContext;
  readonly learningProfile: LearningProfileSnapshot;
  readonly model: OmnipresentChatModel;
  readonly tabs: readonly ChatWorkspaceTab[];
  readonly toggleOpen: () => void;
  readonly setOpen: (next: boolean) => void;
  readonly switchPanel: (panel: ChatPanelView) => void;
  readonly sendMessage: (body: string, channel?: ChatChannel) => Promise<void>;
  readonly injectMessages: (messages: readonly PackageChatMessage[]) => void;
  readonly processGameEvent: (type: GameEventType, payload?: Record<string, unknown>) => void;
  readonly updateContext: (next: Partial<OmnipresentChatContext>) => void;
  readonly createRoom: (
    name: string,
    type: RoomType,
    maxMembers: number,
    inviteOnly: boolean,
  ) => Promise<string>;
  readonly joinRoom: (roomId: string, inviteToken?: string) => Promise<void>;
  readonly leaveRoom: (roomId: string) => Promise<void>;
  readonly selectRoom: (roomId: string) => void;
  readonly setRivalry: (rivalry: ActiveRivalry | null) => void;
}