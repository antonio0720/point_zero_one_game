/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT ENGINE ADAPTERS INDEX
 * FILE: pzo-web/src/engines/chat/adapters/index.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Single canonical export surface for chat-engine adapters.
 *
 * Current phase
 * -------------
 * This index intentionally exports the first real adapter only:
 *   - BattleEngineAdapter
 *
 * Future adapters named in the locked plan are not exported yet because they do
 * not exist yet in this session and this file is kept compile-clean rather than
 * pretending a wider surface is already shipping.
 *
 * Density6 LLC · Point Zero One · Production-first architecture
 * ============================================================================
 */

export {
  BattleEngineAdapter,
  createBattleEngineAdapter,
  type BattleAdapterHistoryEntry,
  type BattleAttackEvent,
  type BattleAttackType,
  type BattleBotId,
  type BattleBotProfile,
  type BattleBotRuntimeState,
  type BattleBotState,
  type BattleBudgetAction,
  type BattleBudgetState,
  type BattleCounterIntelPayload,
  type BattleEngineAdapterCallbacks,
  type BattleEngineAdapterConfig,
  type BattleEngineAdapterOptions,
  type BattleEngineAdapterSnapshot,
  type BattleEventBusLike,
  type BattleEventEnvelope,
  type BattleEventName,
  type BattleInjectedCard,
  type BattleNarrativeWeight,
  type BattleNeutralizedPayload,
  type BattleRecommendation,
  type BattleSnapshot,
  type BattleSyndicateDuel,
  type BattleSyndicateDuelResultPayload,
  type BattleThreatBand,
} from './BattleEngineAdapter';

export type ChatAdapterKind = 'battle';

export interface ChatAdapterDescriptor {
  readonly kind: ChatAdapterKind;
  readonly file: string;
  readonly path: string;
  readonly description: string;
  readonly phase: 'core-now' | 'phase-2' | 'phase-3' | 'wow-only';
}

export const CHAT_ADAPTER_DESCRIPTORS: readonly ChatAdapterDescriptor[] = Object.freeze([
  {
    kind: 'battle',
    file: 'BattleEngineAdapter.ts',
    path: 'pzo-web/src/engines/chat/adapters/BattleEngineAdapter.ts',
    description: 'Canonical bridge from the frontend battle donor lane into the unified chat engine spine.',
    phase: 'core-now',
  },
]);

export function listChatAdapterDescriptors(): ChatAdapterDescriptor[] {
  return CHAT_ADAPTER_DESCRIPTORS.map((entry) => ({ ...entry }));
}

export function getChatAdapterDescriptor(kind: ChatAdapterKind): ChatAdapterDescriptor {
  const found = CHAT_ADAPTER_DESCRIPTORS.find((entry) => entry.kind === kind);
  if (!found) {
    throw new Error(`[chat/adapters] No adapter descriptor registered for kind: ${kind}`);
  }
  return { ...found };
}
