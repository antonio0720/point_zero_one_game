/**
 * ==========================================================================
 * POINT ZERO ONE — FRONTEND CHAT ENGINE ADAPTERS INDEX
 * FILE: pzo-web/src/engines/chat/adapters/index.ts
 * ==========================================================================
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

export {
  ModeAdapter,
  createModeAdapter,
  type BaseCardLike,
  type CORDProjection,
  type EngineSnapshotLike,
  type EventFeedItem,
  type FrontendModeCatalogEntry,
  type FrontendModeCode,
  type FrontendModeDirectorLike,
  type FrontendModeState,
  type FrontendRunMode,
  type GapDirection,
  type LegendMarker,
  type MetricBar,
  type ModeAdapterCallbacks,
  type ModeAdapterConfig,
  type ModeAdapterContext,
  type ModeAdapterHistoryEntry,
  type ModeAdapterModeDescriptor,
  type ModeAdapterNarrativeBand,
  type ModeAdapterOptions,
  type ModeAdapterRecommendation,
  type ModeAdapterRecommendationIntent,
  type ModeAdapterScreenFamily,
  type ModeAdapterSnapshot,
  type ModeAdapterSurfaceId,
  type ModeAdapterTransitionReason,
  type ModeOutcome,
  type ModeRouterLike,
  type PhantomProjection,
  type PredatorProjection,
  type PressureTier,
  type PsycheState,
  type SoloPhase,
  type SoloProjection,
  type SyndicateProjection,
  type TeamPlayerState,
  type TrustBand,
} from './ModeAdapter';

export type ChatAdapterKind = 'battle' | 'run-store' | 'mechanics-bridge' | 'mode';

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
  {
    kind: 'mode',
    file: 'ModeAdapter.ts',
    path: 'pzo-web/src/engines/chat/adapters/ModeAdapter.ts',
    description: 'Canonical bridge from frontend mode director / mode router / mode surfaces into the unified chat engine spine.',
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
