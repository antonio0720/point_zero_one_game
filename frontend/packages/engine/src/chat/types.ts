/**
 * ============================================================================
 * @pzo/engine/chat — Canonical package chat contracts
 * FILE: frontend/packages/engine/src/chat/types.ts
 * ============================================================================
 *
 * Promotion lane:
 * - These contracts are promoted from the live pzo-web chat surface.
 * - They do not own transport, socket lifecycle, or reducer authority.
 * - They exist so package consumers can render omnipresent chat UI without
 *   reaching back into app-local component contracts.
 * ============================================================================
 */

export type RivalryPhase =
  | 'NOTICE_FILED'
  | 'DUE_DILIGENCE'
  | 'CAPITAL_BATTLE'
  | 'LEDGER_CLOSE'
  | 'CLOSED';

export type ChatChannel = 'GLOBAL' | 'SERVER' | 'SYNDICATE' | 'DEAL_ROOM' | 'DIRECT';
export type ChannelType = ChatChannel;
export type ChatRoomId = string;

export type PartnerRank =
  | 'ASSOCIATE'
  | 'JUNIOR_PARTNER'
  | 'PARTNER'
  | 'SENIOR_PARTNER'
  | 'MANAGING_PARTNER';

export type RoomType = 'HOUSEHOLD_TABLE' | 'RIVALRY_ROOM' | 'CUSTOM';

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
  readonly deepLink: string;
  readonly proofHash?: string;
  readonly yieldCaptureAmount?: number;
}

export interface PackageChatMessage {
  readonly id: string;
  readonly channel: ChatChannel;
  readonly roomId?: ChatRoomId | null;
  readonly kind?: string;
  readonly senderId: string | 'SYSTEM';
  readonly senderName?: string;
  readonly senderRank?: string;
  readonly body: string;
  readonly ts: number;
  readonly immutable?: boolean;
  readonly proofHash?: string;
  readonly meta?: Record<string, unknown>;
  readonly marketMoveAlert?: MarketMoveAlertPayload;
  readonly bulletinType?: 'MARKET_PHASE_BULLETIN' | 'SETTLEMENT_HASH_CARD';
  readonly bulletinPhase?: RivalryPhase;
  readonly phase?: RivalryPhase;
  readonly dealRoomMeta?: Record<string, unknown>;
}

export interface RoomMember {
  readonly userId: string;
  readonly displayName: string;
  readonly isOwner: boolean;
  readonly isOnline: boolean;
  readonly joinedAt: string;
}

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
  readonly dealRoomChannel?: ChatChannel | 'DEAL_ROOM';
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
  readonly bulletinType?: 'MARKET_PHASE_BULLETIN' | 'SETTLEMENT_HASH_CARD';
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
  readonly id: ChatChannel | 'ROOMS';
  readonly label: string;
  readonly accent: string;
}

export interface OmnipresentChatModel {
  readonly currentUserId: string;
  readonly activeChannel: ChatChannel | 'ROOMS';
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
  readonly onChannelChange?: (channel: ChatChannel | 'ROOMS') => void;
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
