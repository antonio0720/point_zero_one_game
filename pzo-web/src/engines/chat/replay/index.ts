// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/replay/index.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT REPLAY BARREL
 * FILE: pzo-web/src/engines/chat/replay/index.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Stable public surface for the frontend chat replay lane.
 *
 * This barrel now exports both replay orchestration and deterministic
 * serialization. That matches the intended lane split in the unified chat
 * architecture:
 * - `ChatReplayBuffer.ts` owns session / slice / recap orchestration.
 * - `ChatReplaySerializer.ts` owns deterministic export, hashing, file payloads,
 *   serializer-ready normalization, and replay download artifacts.
 *
 * Design laws
 * -----------
 * - Replays remain a first-class engine lane, not a UI helper.
 * - Transcript truth stays in `../ChatTranscriptBuffer.ts`.
 * - Replay orchestration and replay serialization both stay in this folder.
 * - This barrel exposes the full lane without pushing serializer internals into
 *   unrelated engine modules unless they opt in.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

export * from './ChatReplayBuffer';
export * from './ChatReplaySerializer';

export const CHAT_REPLAY_MODULE_NAME = 'PZO_CHAT_REPLAY' as const;

export const CHAT_REPLAY_PUBLIC_MANIFEST = Object.freeze({
  moduleName: CHAT_REPLAY_MODULE_NAME,
  providedNow: Object.freeze([
    'index.ts',
    'ChatReplayBuffer.ts',
    'ChatReplaySerializer.ts',
  ] as const),
  root: '/pzo-web/src/engines/chat/replay',
  authorities: Object.freeze({
    replayWorkingSet: '/pzo-web/src/engines/chat/replay/ChatReplayBuffer.ts',
    replaySerialization: '/pzo-web/src/engines/chat/replay/ChatReplaySerializer.ts',
    transcriptTruth: '/pzo-web/src/engines/chat/ChatTranscriptBuffer.ts',
    contractSurface: '/pzo-web/src/engines/chat/types.ts',
  } as const),
  owns: Object.freeze([
    'replay session state',
    'slice assembly',
    'proof extraction',
    'legend extraction',
    'moment anchors',
    'post-run recap shaping',
    'deterministic serialization',
    'download artifact generation',
    'serializer-ready replay export',
  ] as const),
} as const);
