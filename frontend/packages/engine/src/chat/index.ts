/**
 * @pzo/engine/chat — Barrel export
 * point_zero_one_master/frontend/packages/engine/src/chat/index.ts
 *
 * Public surface for package-level chat contracts, adapters, and runtime helpers.
 * UI components are exported from:
 *   frontend/packages/engine/src/components/chat/index.ts
 */

export type {
  ActiveRivalry,
  AlliancePanelState,
  ChannelType,
  ChatChannel,
  ChatRoomId,
  ChatWorkspaceTab,
  DealRoomMessageViewModel,
  DealRoomState,
  MarketMoveAlertPayload,
  OmnipresentChatActions,
  OmnipresentChatModel,
  PackageChatMessage,
  PackageChatRoom,
  PartnerRank,
  RivalryPhase,
  RoomMember,
  RoomType,
} from './types';

export {
  coerceChannelType,
  coerceRivalryPhase,
  deriveDealRoomFromRivalry,
  deriveTabs,
  extractMarketMoveAlertFromMessage,
  formatMoney,
  formatTimestamp,
  normalizeAllianceState,
  normalizeDealRoomState,
  normalizeRooms,
  readRecord,
  safeBoolean,
  safeIsoDate,
  safeNumber,
  safeString,
  toDealRoomMessage,
} from './adapters';

export type { PackageChatRuntimeInput } from './runtime';

export {
  buildOmnipresentChatModel,
  filterMessagesForChannel,
} from './runtime';