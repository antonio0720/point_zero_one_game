/**
 * ============================================================================
 * FILE: shared/contracts/multiplayer/index.ts
 * Point Zero One — Multiplayer Sovereignty Contracts
 * 
 * Single source of truth for all multiplayer types shared between:
 *   pzo_server  ←→  pzo_client  ←→  pzo_engine
 * 
 * Deploy to: shared/contracts/multiplayer/index.ts
 * ============================================================================
 */

// ─── RANK SYSTEM ─────────────────────────────────────────────────────────────

export type AllianceRank = 'R1' | 'R2' | 'R3' | 'R4' | 'R5';

export const RANK_LABELS: Record<AllianceRank, string> = {
  R5: 'Alliance Sovereign',
  R4: 'Alliance Commander',
  R3: 'Alliance Officer',
  R2: 'Alliance Soldier',
  R1: 'Alliance Recruit',
};

export const RANK_NUM: Record<AllianceRank, number> = {
  R1: 1, R2: 2, R3: 3, R4: 4, R5: 5,
};

export const RANK_PERMISSIONS: Record<AllianceRank, string[]> = {
  R5: [
    'DISBAND', 'RENAME', 'DECLARE_WAR', 'SET_TAX', 'PROMOTE_ANY', 'DEMOTE_ANY',
    'ACCESS_VAULT', 'KICK_ANY', 'TRANSFER_LEADERSHIP', 'SET_SETTINGS',
    'ACCEPT_MEMBERS', 'REJECT_MEMBERS', 'MANAGE_SHOP',
    'KICK_R1_R2_R3', 'PROMOTE_R3', 'APPROVE_AID', 'MANAGE_EVENTS',
    'KICK_R1_R2', 'MODERATE_CHAT', 'PIN_MESSAGES',
    'SEND_AID', 'VOTE', 'USE_BOOSTS', 'PARTICIPATE_WAR',
    'CHAT', 'VIEW_ROSTER', 'RECEIVE_AID', 'PARTICIPATE_EVENTS',
  ],
  R4: [
    'ACCEPT_MEMBERS', 'REJECT_MEMBERS', 'PROMOTE_R3', 'DECLARE_WAR_PENDING',
    'MANAGE_SHOP', 'ACCESS_VAULT', 'KICK_R1_R2_R3',
    'APPROVE_AID', 'MANAGE_EVENTS',
    'KICK_R1_R2', 'MODERATE_CHAT', 'PIN_MESSAGES',
    'SEND_AID', 'VOTE', 'USE_BOOSTS', 'PARTICIPATE_WAR',
    'CHAT', 'VIEW_ROSTER', 'RECEIVE_AID', 'PARTICIPATE_EVENTS',
  ],
  R3: [
    'KICK_R1_R2', 'MODERATE_CHAT', 'APPROVE_AID', 'MANAGE_EVENTS', 'PIN_MESSAGES',
    'SEND_AID', 'VOTE', 'USE_BOOSTS', 'PARTICIPATE_WAR',
    'CHAT', 'VIEW_ROSTER', 'RECEIVE_AID', 'PARTICIPATE_EVENTS',
  ],
  R2: [
    'SEND_AID', 'VOTE', 'USE_BOOSTS', 'PARTICIPATE_WAR',
    'CHAT', 'VIEW_ROSTER', 'RECEIVE_AID', 'PARTICIPATE_EVENTS',
  ],
  R1: ['CHAT', 'VIEW_ROSTER', 'RECEIVE_AID', 'PARTICIPATE_EVENTS'],
};

// ─── ALLIANCE ────────────────────────────────────────────────────────────────

export interface AllianceBanner {
  colorPrimary:   string;
  colorSecondary: string;
  iconId:         string;
  frameId?:       string;
}

export interface AllianceSeasonStats {
  seasonId:         string;
  warWins:          number;
  warLosses:        number;
  warTies:          number;
  totalWarPoints:   number;
  vaultContributed: number;
  topPlayerIds:     string[];
}

export interface Alliance {
  id:                   string;
  tag:                  string;
  name:                 string;
  description:          string;
  level:                number;
  xp:                   number;
  capacity:             number;
  memberCount:          number;
  vault:                number;
  isOpen:               boolean;
  requirementMinLevel:  number;
  language:             string;
  createdAt:            string;   // ISO
  r5Id:                 string;
  activeWarId:          string | null;
  banner:               AllianceBanner;
  seasonStats?:         AllianceSeasonStats;
}

export interface AllianceMember {
  userId:           string;
  allianceId:       string;
  rank:             AllianceRank;
  displayName:      string;
  avatarUrl?:       string;
  joinedAt:         string;
  lastActive:       string;
  warPoints:        number;
  totalContributed: number;
  isOnline:         boolean;
}

export interface AllianceApplication {
  id:         string;
  allianceId: string;
  userId:     string;
  userName:   string;
  message:    string;
  appliedAt:  string;
  status:     'PENDING' | 'ACCEPTED' | 'REJECTED';
}

export interface AidRequest {
  id:          string;
  allianceId:  string;
  requesterId: string;
  requesterName: string;
  type:        'COINS' | 'BOOST' | 'SHIELD';
  amount:      number;
  fulfilled:   number;
  target:      number;
  createdAt:   string;
  expiresAt:   string;
}

// ─── CHAT ─────────────────────────────────────────────────────────────────────

export type ChannelType =
  | 'GLOBAL'
  | 'SERVER'
  | 'ALLIANCE'
  | 'ALLIANCE_OFFICER'
  | 'ROOM'
  | 'DM';

export type MessageStatus =
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'UNSENT'
  | 'DELETED_BY_MOD';

export type MessageType =
  | 'TEXT'
  | 'STICKER'
  | 'SYSTEM'
  | 'WAR_ALERT'
  | 'DEAL_INVITE'
  | 'PROOF_SHARE';

export interface MessageReaction {
  emoji:   string;
  count:   number;
  userIds: string[];
}

export interface ChatMessage {
  id:          string;
  channelType: ChannelType;
  channelId:   string;
  senderId:    string;
  senderName:  string;
  senderRank:  string | null;
  senderTitle: string | null;
  type:        MessageType;
  body:        string;
  metadata:    Record<string, unknown> | null;
  status:      MessageStatus;
  sentAt:      string;    // ISO
  editedAt:    string | null;
  unsentAt:    string | null;
  replyToId:   string | null;
  reactions:   MessageReaction[];
  flags:       number;    // bitmask: 1=pinned, 2=highlighted, 4=contains_link
}

export interface ChannelMeta {
  id:               string;
  type:             ChannelType;
  name:             string;
  memberCount:      number;
  slowModeSeconds:  number;
  isLocked:         boolean;
  pinnedMessageId:  string | null;
}

export interface BlockEntry {
  blockerId:  string;
  blockedId:  string;
  blockedName?: string;
  createdAt:  string;
  reason:     string | null;
}

export interface PrivateRoom {
  id:          string;
  name:        string;
  type:        'HOUSEHOLD_TABLE' | 'RIVALRY_ROOM' | 'CUSTOM';
  creatorId:   string;
  maxMembers:  number;
  memberCount: number;
  isInviteOnly: boolean;
  inviteToken: string | null;
  createdAt:   string;
  expiresAt:   string | null;
  isWarRoom:   boolean;
}

// ─── ALLIANCE WAR ─────────────────────────────────────────────────────────────

export type WarStatus =
  | 'DECLARED'
  | 'PREPARATION'
  | 'ACTIVE'
  | 'SETTLEMENT'
  | 'ENDED';

export type WarOutcome = 'ATTACKER' | 'DEFENDER' | 'TIE';

export interface AllianceWar {
  id:              string;
  attackerId:      string;
  attackerTag:     string;
  attackerName:    string;
  defenderId:      string;
  defenderTag:     string;
  defenderName:    string;
  status:          WarStatus;
  declaredAt:      string;
  startsAt:        string;
  endsAt:          string;
  attackerPoints:  number;
  defenderPoints:  number;
  outcome:         WarOutcome | null;
  proofHash:       string | null;
  warRoomId:       string | null;
}

export interface WarBoost {
  id:          string;
  name:        string;
  description: string;
  multiplier:  number;
  cost:        number;   // alliance vault coins
  duration:    number;   // seconds
}

// ─── LEADERBOARD ─────────────────────────────────────────────────────────────

export type LeaderboardType =
  | 'GLOBAL_NET_WORTH'
  | 'GLOBAL_CASHFLOW'
  | 'GLOBAL_WIN_RATE'
  | 'ALLIANCE_WAR_POINTS'
  | 'FRIENDS'
  | 'SERVER';

export interface LeaderboardEntry {
  rank:         number;
  playerId:     string;
  displayName:  string;
  allianceTag:  string | null;
  allianceRank: AllianceRank | null;
  value:        number;      // net_worth / cashflow / war_points depending on board
  delta:        number;      // change since last refresh (+/-)
  isMe:         boolean;
}

// ─── PLAYER SOCIAL ───────────────────────────────────────────────────────────

export type PlayerTitle =
  | 'THE_SOVEREIGN'
  | 'THE_ARCHITECT'
  | 'FUBAR_PROOF'
  | 'THE_CLOSER'
  | 'GHOST_HUNTER'
  | 'VAULT_LORD'
  | 'WAR_GENERAL'
  | 'THE_MENTOR'
  | 'UNTOUCHABLE';

export const TITLE_LABELS: Record<PlayerTitle, string> = {
  THE_SOVEREIGN: '⚡ Sovereign',
  THE_ARCHITECT: '🏗 Architect',
  FUBAR_PROOF:   '🛡 FUBAR-Proof',
  THE_CLOSER:    '🤝 Closer',
  GHOST_HUNTER:  '👻 Ghost Hunter',
  VAULT_LORD:    '🏦 Vault Lord',
  WAR_GENERAL:   '⚔️ War General',
  THE_MENTOR:    '📚 Mentor',
  UNTOUCHABLE:   '💎 Untouchable',
};

export interface PlayerTitleRecord {
  playerId:    string;
  title:       PlayerTitle;
  earnedAt:    string;
  seasonId:    string | null;
  expiresAt:   string | null;
  proofHash:   string;
}

export type FriendStatus = 'PENDING_SENT' | 'PENDING_RECEIVED' | 'ACCEPTED' | 'BLOCKED';

export interface FriendEntry {
  userId:       string;
  displayName:  string;
  avatarUrl?:   string;
  allianceTag?: string;
  isOnline:     boolean;
  lastActive:   string;
  status:       FriendStatus;
}

// ─── PRESENCE ────────────────────────────────────────────────────────────────

export type PresenceStatus = 'ONLINE' | 'AWAY' | 'OFFLINE';

export interface PresenceEntry {
  userId:   string;
  status:   PresenceStatus;
  lastPing: string;
}

// ─── REPORTS / MODERATION ────────────────────────────────────────────────────

export type ReportCategory =
  | 'SPAM'
  | 'HARASSMENT'
  | 'CHEATING'
  | 'EXPLOITATION'
  | 'HATE_SPEECH'
  | 'OTHER';

export interface PlayerReport {
  id:          string;
  reporterId:  string;
  reportedId:  string;
  channelId:   string | null;
  messageId:   string | null;
  category:    ReportCategory;
  description: string;
  status:      'PENDING' | 'REVIEWED' | 'ACTIONED' | 'DISMISSED';
  createdAt:   string;
}

export type BanType = 'CHAT_MUTE' | 'QUARANTINE' | 'ACCOUNT_BAN' | 'DEVICE_BAN';

export interface BanRecord {
  playerId:  string;
  banType:   BanType;
  reason:    string;
  expiresAt: string | null;
  createdAt: string;
}

// ─── IAP ─────────────────────────────────────────────────────────────────────

export interface IAPProduct {
  id:              string;
  name:            string;
  description:     string;
  priceCents:      number;
  coinsGranted:    number;
  contents:        string[];
  targetSegment:   string;
  isLimitedTime:   boolean;
  expiresAt:       string | null;
  badgeLabel?:     string;   // "BEST VALUE", "MOST POPULAR"
}

export const IAP_PRODUCTS: IAPProduct[] = [
  {
    id: 'starter_pack_001', name: 'Starter Pack', description: 'Perfect for new players',
    priceCents: 499, coinsGranted: 5000,
    contents: ['5,000 coins', '3 shields', 'Alliance Sticker Pack'],
    targetSegment: 'New players week 1', isLimitedTime: false, expiresAt: null,
    badgeLabel: 'NEW PLAYER',
  },
  {
    id: 'alliance_pack_001', name: 'Alliance Pack', description: 'Fuel your alliance',
    priceCents: 999, coinsGranted: 15000,
    contents: ['15,000 coins', 'War Boost x2', 'Vault Contribution x5,000'],
    targetSegment: 'Alliance members', isLimitedTime: false, expiresAt: null,
  },
  {
    id: 'war_chest_001', name: 'War Chest', description: 'Go to war fully loaded',
    priceCents: 2499, coinsGranted: 50000,
    contents: ['50,000 coins', 'Full war boost kit', 'Spy Report', 'War Shield x5'],
    targetSegment: 'Whale alliance leaders', isLimitedTime: false, expiresAt: null,
    badgeLabel: 'BEST VALUE',
  },
  {
    id: 'sovereign_pack_001', name: 'Sovereign Pack', description: 'For those who lead',
    priceCents: 9999, coinsGranted: 250000,
    contents: ['250,000 coins', 'R5 Title (1 season)', 'Vault Shield', 'War Boost x3'],
    targetSegment: 'Top-tier whales', isLimitedTime: false, expiresAt: null,
    badgeLabel: 'MOST POWERFUL',
  },
  {
    id: 'season_pass_001', name: 'Season Pass', description: 'Monthly perks, every season',
    priceCents: 999, coinsGranted: 0,
    contents: ['Monthly coins', 'Exclusive stickers', 'Double XP on runs'],
    targetSegment: 'Recurring', isLimitedTime: false, expiresAt: null,
    badgeLabel: 'SUBSCRIBER',
  },
  {
    id: 'alliance_expand_25_50', name: 'Alliance Expansion (25→50)',
    description: 'Grow your alliance to 50 members permanently',
    priceCents: 1499, coinsGranted: 0,
    contents: ['Alliance capacity: 25 → 50 (permanent)'],
    targetSegment: 'Growing alliances', isLimitedTime: false, expiresAt: null,
  },
  {
    id: 'alliance_expand_50_100', name: 'Alliance Expansion (50→100)',
    description: 'Grow your alliance to 100 members permanently',
    priceCents: 2499, coinsGranted: 0,
    contents: ['Alliance capacity: 50 → 100 (permanent)'],
    targetSegment: 'Large alliances', isLimitedTime: false, expiresAt: null,
  },
];

// ─── WEBSOCKET EVENTS ────────────────────────────────────────────────────────

// Server → Client
export type ServerEvent =
  | { type: 'MESSAGE';                data: ChatMessage }
  | { type: 'MESSAGE_UNSENT';         data: { messageId: string; senderId: string; channelId: string } }
  | { type: 'MESSAGE_DELETED_BY_MOD'; data: { messageId: string; channelId: string } }
  | { type: 'MESSAGE_PINNED';         data: { messageId: string; channelId: string; pinnedBy: string } }
  | { type: 'REACTION_UPDATE';        data: { messageId: string; reactions: MessageReaction[] } }
  | { type: 'CHANNEL_LOCKED';         data: { channelId: string } }
  | { type: 'CHANNEL_UNLOCKED';       data: { channelId: string } }
  | { type: 'PRESENCE_UPDATE';        data: PresenceEntry }
  | { type: 'PLAYER_JOINED_ALLIANCE'; data: { userId: string; allianceId: string; rank: AllianceRank } }
  | { type: 'PLAYER_LEFT_ALLIANCE';   data: { userId: string; allianceId: string; wasKicked: boolean } }
  | { type: 'RANK_PROMOTED';          data: { userId: string; allianceId: string; from: AllianceRank; to: AllianceRank } }
  | { type: 'RANK_DEMOTED';           data: { userId: string; allianceId: string; from: AllianceRank; to: AllianceRank } }
  | { type: 'ALLIANCE_WAR_DECLARED';  data: { warId: string; attackerId: string; defenderId: string } }
  | { type: 'ALLIANCE_WAR_STARTED';   data: { warId: string; startsAt: string } }
  | { type: 'ALLIANCE_WAR_ENDED';     data: { warId: string; outcome: WarOutcome; proofHash: string } }
  | { type: 'ALLIANCE_WAR_REMINDER';  data: { warId: string; minutesRemaining: number } }
  | { type: 'PLAYER_TITLE_EARNED';    data: { userId: string; title: PlayerTitle } }
  | { type: 'ALLIANCE_LEVEL_UP';      data: { allianceId: string; newLevel: number } }
  | { type: 'AID_REQUESTED';          data: AidRequest }
  | { type: 'AID_FULFILLED';          data: { aidId: string; fulfilled: number; total: number } }
  | { type: 'ROOM_CREATED';           data: PrivateRoom }
  | { type: 'ROOM_MEMBER_JOINED';     data: { roomId: string; userId: string; displayName: string } }
  | { type: 'ROOM_MEMBER_LEFT';       data: { roomId: string; userId: string } }
  | { type: 'ERROR';                  data: { code: string; message: string } };

// Client → Server
export type ClientEvent =
  | { type: 'SUBSCRIBE';   data: { channelId: string } }
  | { type: 'UNSUBSCRIBE'; data: { channelId: string } }
  | { type: 'PING';        data: { timestamp: number } }
  | { type: 'TYPING';      data: { channelId: string } };

// ─── MULTIPLAYER EVENTS (internal event bus) ─────────────────────────────────

export type MultiplayerEvent =
  | { type: 'ALLIANCE_WAR_DECLARED';       warId: string; attackerId: string; defenderId: string }
  | { type: 'ALLIANCE_WAR_STARTED';        warId: string }
  | { type: 'ALLIANCE_WAR_PHASE_CHANGED';  warId: string; newPhase: WarStatus }
  | { type: 'ALLIANCE_WAR_ENDED';          warId: string; outcome: WarOutcome; proofHash: string }
  | { type: 'PLAYER_JOINED_ALLIANCE';      userId: string; allianceId: string; rank: AllianceRank }
  | { type: 'PLAYER_LEFT_ALLIANCE';        userId: string; allianceId: string; wasKicked: boolean }
  | { type: 'RANK_PROMOTED';              userId: string; allianceId: string; from: AllianceRank; to: AllianceRank }
  | { type: 'RANK_DEMOTED';              userId: string; allianceId: string; from: AllianceRank; to: AllianceRank }
  | { type: 'MESSAGE_SENT';              message: ChatMessage }
  | { type: 'MESSAGE_UNSENT';            messageId: string; senderId: string; channelId: string }
  | { type: 'PLAYER_REPORTED';           report: PlayerReport }
  | { type: 'PLAYER_BLOCKED';            blockerId: string; blockedId: string }
  | { type: 'LEADERBOARD_UPDATED';       board: LeaderboardType; entries: LeaderboardEntry[] }
  | { type: 'PLAYER_TITLE_EARNED';       userId: string; title: PlayerTitle }
  | { type: 'ALLIANCE_LEVEL_UP';         allianceId: string; newLevel: number }
  | { type: 'ROOM_CREATED';              room: PrivateRoom }
  | { type: 'AID_REQUESTED';             request: AidRequest }
  | { type: 'ALLIANCE_DISBANDED';        allianceId: string; disbandedBy: string };

// ─── API RESPONSE WRAPPERS ───────────────────────────────────────────────────

export interface ApiOk<T> {
  ok:   true;
  data: T;
}

export interface ApiError {
  ok:      false;
  error:   string;
  message: string;
}

export type ApiResult<T> = ApiOk<T> | ApiError;

export function apiOk<T>(data: T): ApiOk<T> {
  return { ok: true, data };
}

export function apiError(error: string, message: string): ApiError {
  return { ok: false, error, message };
}
