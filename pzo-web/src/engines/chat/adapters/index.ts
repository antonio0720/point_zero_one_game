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
 * This index now exports three core-now adapters that exist in this session:
 *   - BattleEngineAdapter
 *   - RunStoreAdapter
 *   - MechanicsBridgeAdapter
 *
 * Remaining locked adapters are still intentionally absent from exports until
 * they actually exist in the canonical lane.
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

export {
  RunStoreAdapter,
  createRunStoreAdapter,
  type RunDeltaEventName,
  type RunHealthBand,
  type RunRecommendation,
  type RunRecommendationIntent,
  type RunStoreAdapterCallbacks,
  type RunStoreAdapterConfig,
  type RunStoreAdapterHistoryEntry,
  type RunStoreAdapterOptions,
  type RunStoreAdapterSnapshot,
  type RunStoreLike,
  type RunStoreMirrorSnapshot,
  type RunStoreThresholds,
} from './RunStoreAdapter';

export {
  MechanicsBridgeAdapter,
  createMechanicsBridgeAdapter,
  type MechanicFamily,
  type MechanicRuntimeEntry,
  type MechanicTriggerPayload,
  type MechanicsBridgeAPI,
  type MechanicsBridgeAdapterCallbacks,
  type MechanicsBridgeAdapterConfig,
  type MechanicsBridgeAdapterHistoryEntry,
  type MechanicsBridgeAdapterOptions,
  type MechanicsBridgeAdapterSnapshot,
  type MechanicsBridgeRuntimeSnapshot,
  type MechanicsBridgeThresholds,
  type MechanicsDeltaEventName,
  type MechanicsFamilyNarrativeBand,
  type MechanicsIntelligenceSnapshot,
  type MechanicsRecommendation,
  type MechanicsRecommendationIntent,
  type MechanicsRuntimeStoreLike,
  type MechanicsRuntimeStoreSlice,
  type MechanicsSeasonSnapshot,
} from './MechanicsBridgeAdapter';

export type ChatAdapterKind = 'battle' | 'run-store' | 'mechanics-bridge';

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
  {
    kind: 'run-store',
    file: 'RunStoreAdapter.ts',
    path: 'pzo-web/src/engines/chat/adapters/RunStoreAdapter.ts',
    description: 'Canonical bridge from the frontend run-store mirror into chat pressure, helper, witness, and invasion logic.',
    phase: 'core-now',
  },
  {
    kind: 'mechanics-bridge',
    file: 'MechanicsBridgeAdapter.ts',
    path: 'pzo-web/src/engines/chat/adapters/MechanicsBridgeAdapter.ts',
    description: 'Canonical bridge from mechanics runtime + bridge snapshot lanes into chat timing, social witness, and intelligence-side orchestration.',
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
