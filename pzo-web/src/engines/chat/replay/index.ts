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
 * This barrel intentionally exports the replay-working-set authority now and
 * leaves the serializer lane as an explicit next export so migration order stays
 * deterministic:
 * - `ChatReplayBuffer.ts` lands first as the canonical replay session / slice /
 *   recap owner.
 * - `ChatReplaySerializer.ts` can land next without forcing UI or engine code to
 *   import serializer concerns early.
 *
 * Design laws
 * -----------
 * - Replays remain a first-class engine lane, not a UI helper.
 * - Transcript truth stays in `../ChatTranscriptBuffer.ts`.
 * - Replay orchestration stays in this folder.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

export * from './ChatReplayBuffer';

export const CHAT_REPLAY_MODULE_NAME = 'PZO_CHAT_REPLAY' as const;

export const CHAT_REPLAY_PUBLIC_MANIFEST = Object.freeze({
  moduleName: CHAT_REPLAY_MODULE_NAME,
  providedNow: Object.freeze([
    'index.ts',
    'ChatReplayBuffer.ts',
  ] as const),
  expectedNext: Object.freeze([
    'ChatReplaySerializer.ts',
  ] as const),
  root: '/pzo-web/src/engines/chat/replay',
} as const);
