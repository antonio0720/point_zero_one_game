/**
 * @pzo/engine — Barrel Export
 * Point Zero One Engine Package
 */

export { orchestrator } from './zero/EngineOrchestrator';
export { sharedEventBus } from './zero/EventBus';
export { bootstrapEngine } from './bootstrap';

export { ModeRouter } from './modes/ModeRouter';
export type { RunContext, RunConfig } from './modes/ModeRouter';

export type { RunMode, IGameModeEngine } from './core/types';
export type { RunLifecycleState, RunOutcome, TickTier, PressureTier, BotId } from './zero/types';

export { useEngineStore } from './store/engineStore';
export { useRunStore } from './store/runStore';

export { useGameLoop } from './hooks/useGameLoop';

export { default as EmpireGameScreen } from './screens/EmpireGameScreen';
export { default as PredatorGameScreen } from './screens/PredatorGameScreen';
export { default as SyndicateGameScreen } from './screens/SyndicateGameScreen';
export { default as PhantomGameScreen } from './screens/PhantomGameScreen';

export {
  fmtMoney,
  fmtHash,
  fmtRunId,
  fmtGrade,
  fmtBotName,
  fmtChainId,
  fmtTickTier,
  fmtSovereigntyScore,
  TICK_TIER_LABELS,
} from './game/core/format';

export * from './chat';
export * from './components/chat';
