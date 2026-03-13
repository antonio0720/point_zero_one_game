// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/index.ts

/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT ENGINE PUBLIC BARREL
 * FILE: pzo-web/src/engines/chat/index.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Stable import surface for the new frontend chat engine lane.
 *
 * This file intentionally exports only what can compile today:
 * - the deep contract surface from ./types
 * - grouped public metadata about the canonical lane
 *
 * It does NOT yet export future runtime modules like ChatEngine.ts,
 * ChatReducer.ts, ChatSelectors.ts, or ChatSocketClient.ts because those
 * files are not part of this batch and the barrel must remain compile-safe.
 *
 * Once the next files land, this barrel becomes the single import surface for:
 *   /pzo-web/src/engines/chat
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import {
  CHAT_ALL_CHANNELS,
  CHAT_ENGINE_AUTHORITIES,
  CHAT_ENGINE_CONSTANTS,
  CHAT_ENGINE_EVENT_NAMES,
  CHAT_ENGINE_PUBLIC_API_VERSION,
  CHAT_ENGINE_VERSION,
  CHAT_MESSAGE_KINDS,
  CHAT_MOUNT_PRESETS,
  CHAT_MOUNT_TARGETS,
  CHAT_SHADOW_CHANNELS,
  CHAT_TYPES_NAMESPACE,
  CHAT_VISIBLE_CHANNELS,
  channelFamilyOf,
  isAnyChatChannel,
  isLegendCandidateMessage,
  isReplayEligibleMessage,
  isShadowChatChannel,
  isVisibleChatChannel,
  supportsComposerForChannel,
} from './types';

import * as ChatTypes from './types';

export * from './types';
export { ChatTypes };

export const CHAT_ENGINE_MODULE_NAME = 'PZO_UNIFIED_CHAT_ENGINE' as const;

export const CHAT_ENGINE_PUBLIC_MANIFEST = Object.freeze({
  moduleName: CHAT_ENGINE_MODULE_NAME,
  version: CHAT_ENGINE_VERSION,
  publicApiVersion: CHAT_ENGINE_PUBLIC_API_VERSION,
  authorities: CHAT_ENGINE_AUTHORITIES,
  roots: Object.freeze({
    frontendEngine: CHAT_ENGINE_AUTHORITIES.frontendEngineRoot,
    frontendUi: CHAT_ENGINE_AUTHORITIES.frontendUiRoot,
    backendEngine: CHAT_ENGINE_AUTHORITIES.backendEngineRoot,
    serverTransport: CHAT_ENGINE_AUTHORITIES.serverTransportRoot,
    sharedContracts: CHAT_ENGINE_AUTHORITIES.sharedContractsRoot,
    sharedLearning: CHAT_ENGINE_AUTHORITIES.sharedLearningRoot,
  }),
  channels: Object.freeze({
    visible: CHAT_VISIBLE_CHANNELS,
    shadow: CHAT_SHADOW_CHANNELS,
    all: CHAT_ALL_CHANNELS,
  }),
  messageKinds: CHAT_MESSAGE_KINDS,
  eventNames: CHAT_ENGINE_EVENT_NAMES,
  mountTargets: CHAT_MOUNT_TARGETS,
  constants: CHAT_ENGINE_CONSTANTS,
} as const);

export const CHAT_ENGINE_PHASE_ZERO_EXPORTS = Object.freeze({
  providedNow: Object.freeze(['index.ts', 'types.ts'] as const),
  expectedNext: Object.freeze(
    [
      'ChatEngine.ts',
      'ChatState.ts',
      'ChatReducer.ts',
      'ChatSelectors.ts',
      'ChatMountRegistry.ts',
      'ChatEventBridge.ts',
      'ChatSocketClient.ts',
      'ChatPresenceController.ts',
      'ChatTypingController.ts',
      'ChatNotificationController.ts',
      'ChatTranscriptBuffer.ts',
      'ChatRuntimeConfig.ts',
      'adapters/BattleEngineAdapter.ts',
      'adapters/RunStoreAdapter.ts',
      'adapters/MechanicsBridgeAdapter.ts',
      'adapters/ModeAdapter.ts',
    ] as const,
  ),
} as const);

export const CHAT_ENGINE_INTELLIGENCE_SURFACES = Object.freeze({
  frontend: CHAT_ENGINE_AUTHORITIES.frontendLearningRoot,
  backend: CHAT_ENGINE_AUTHORITIES.backendLearningRoot,
  shared: CHAT_ENGINE_AUTHORITIES.sharedLearningRoot,
} as const);

export const CHAT_ENGINE_RUNTIME_LAWS = Object.freeze([
  'Frontend render stays thin.',
  'Frontend engine owns responsiveness, not transcript truth.',
  'Backend owns transcript integrity, policy, replay, and profile updates.',
  'Server transport routes; it does not author scenes.',
  'Shadow channels are valid first-class state lanes.',
  'Silence is a mechanic.',
  'Every major collapse needs a witness.',
  'Every major comeback needs a witness.',
] as const);

export const CHAT_ENGINE_NAMESPACE = Object.freeze({
  manifest: CHAT_ENGINE_PUBLIC_MANIFEST,
  exports: CHAT_ENGINE_PHASE_ZERO_EXPORTS,
  intelligence: CHAT_ENGINE_INTELLIGENCE_SURFACES,
  types: CHAT_TYPES_NAMESPACE,
} as const);

/**
 * Small compile-safe helpers that downstream callers can use immediately,
 * without waiting for ChatEngine.ts or ChatSelectors.ts.
 */

export const ChatChannelGuards = Object.freeze({
  isVisible: isVisibleChatChannel,
  isShadow: isShadowChatChannel,
  isAny: isAnyChatChannel,
  familyOf: channelFamilyOf,
  supportsComposer: supportsComposerForChannel,
} as const);

export const ChatMessageGuards = Object.freeze({
  isReplayEligible: isReplayEligibleMessage,
  isLegendCandidate: isLegendCandidateMessage,
} as const);

export const ChatMounts = Object.freeze({
  targets: CHAT_MOUNT_TARGETS,
  presets: CHAT_MOUNT_PRESETS,
} as const);

export type ChatEngineNamespace = typeof CHAT_ENGINE_NAMESPACE;
export type ChatEngineManifest = typeof CHAT_ENGINE_PUBLIC_MANIFEST;
export type ChatEnginePhaseZeroExports = typeof CHAT_ENGINE_PHASE_ZERO_EXPORTS;