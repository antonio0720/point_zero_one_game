/**
 * ============================================================================
 * @pzo/engine/chat — Omnipresent package runtime model builder
 * FILE: frontend/packages/engine/src/chat/runtime.ts
 * ============================================================================
 */

import {
  deriveDealRoomFromRivalry,
  deriveTabs,
  normalizeAllianceState,
  normalizeDealRoomState,
  normalizeRooms,
} from './adapters';
import type {
  ActiveRivalry,
  AlliancePanelState,
  ChatChannel,
  DealRoomState,
  OmnipresentChatModel,
  PackageChatMessage,
  PackageChatRoom,
} from './types';

export interface PackageChatRuntimeInput {
  readonly currentUserId: string;
  readonly activeChannel?: ChatChannel | 'ROOMS';
  readonly visibleChannel?: ChatChannel;
  readonly messages?: readonly PackageChatMessage[];
  readonly rooms?: readonly PackageChatRoom[];
  readonly alliance?: Partial<AlliancePanelState>;
  readonly rivalry?: ActiveRivalry | null;
  readonly dealRoom?: Partial<DealRoomState> | null;
  readonly title?: string;
  readonly subtitle?: string;
}

function resolveVisibleChannel(activeChannel: ChatChannel | 'ROOMS' | undefined, visibleChannel: ChatChannel | undefined): ChatChannel {
  if (visibleChannel) return visibleChannel;
  if (!activeChannel || activeChannel === 'ROOMS') return 'GLOBAL';
  return activeChannel;
}

export function filterMessagesForChannel(
  messages: readonly PackageChatMessage[],
  channel: ChatChannel,
): readonly PackageChatMessage[] {
  return messages.filter((message) => message.channel === channel);
}

export function buildOmnipresentChatModel(input: PackageChatRuntimeInput): OmnipresentChatModel {
  const activeChannel = input.activeChannel ?? 'GLOBAL';
  const visibleChannel = resolveVisibleChannel(activeChannel, input.visibleChannel);
  const allMessages = Array.isArray(input.messages) ? input.messages : [];
  const alliance = normalizeAllianceState({ ...input.alliance, activeRivalry: input.rivalry ?? input.alliance?.activeRivalry ?? null });
  const derivedDealRoom = deriveDealRoomFromRivalry(input.rivalry ?? alliance.activeRivalry, allMessages);
  const dealRoom = normalizeDealRoomState(input.dealRoom ?? derivedDealRoom);
  const tabs = deriveTabs({ alliance, dealRoom });

  return {
    currentUserId: input.currentUserId,
    activeChannel,
    visibleChannel,
    visibleMessages: filterMessagesForChannel(allMessages, visibleChannel),
    rooms: normalizeRooms(input.rooms),
    alliance,
    dealRoom,
    tabs,
    title: input.title ?? 'COMMAND COMMS',
    subtitle: input.subtitle ?? 'OMNIPRESENT CHAT',
  };
}
