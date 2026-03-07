/**
 * @pzo/engine — Barrel Export
 * Point Zero One Engine Package
 */

// ── Orchestrator (singleton) ──────────────────────────────────────────────
export { orchestrator } from './zero/EngineOrchestrator';
export { sharedEventBus } from './zero/EventBus';

// ── Mode Router ───────────────────────────────────────────────────────────
export { ModeRouter } from './modes/ModeRouter';
export type { RunContext, RunConfig } from './modes/ModeRouter';

// ── Types ─────────────────────────────────────────────────────────────────
export type { RunMode, IGameModeEngine } from './core/types';
export type {
  RunLifecycleState, RunOutcome, TickTier, PressureTier, BotId,
} from './zero/types';

// ── Store ─────────────────────────────────────────────────────────────────
export { useEngineStore } from './store/engineStore';
export { useRunStore } from './store/runStore';

// ── Hooks ─────────────────────────────────────────────────────────────────
export { useGameLoop } from './hooks/useGameLoop';

// ── Game Screens ──────────────────────────────────────────────────────────
export { default as EmpireGameScreen } from './screens/EmpireGameScreen';
export { default as PredatorGameScreen } from './screens/PredatorGameScreen';
export { default as SyndicateGameScreen } from './screens/SyndicateGameScreen';
export { default as PhantomGameScreen } from './screens/PhantomGameScreen';

// ── Format Utils ──────────────────────────────────────────────────────────
export {
  fmtMoney, fmtHash, fmtRunId, fmtGrade, fmtBotName,
  fmtChainId, fmtTickTier, fmtSovereigntyScore,
  TICK_TIER_LABELS,
} from './game/core/format';
