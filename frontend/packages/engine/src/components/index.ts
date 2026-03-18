/**
 * @pzo/engine — Barrel Export
 * Point Zero One Engine Package
 *
 * Promotion update:
 * - Adds canonical chat package exports promoted from pzo-web runtime/UI.
 * - Does not require pzo-web import flips yet.
 */

// ── Orchestrator (singleton) ──────────────────────────────────────────────
export { orchestrator } from './zero/EngineOrchestrator';
export { sharedEventBus } from './zero/EventBus';
export { bootstrapEngine } from './bootstrap';

// ── Mode Router ───────────────────────────────────────────────────────────
export { ModeRouter } from './modes/ModeRouter';
export type { RunContext, RunConfig } from './modes/ModeRouter';

// ── Types ─────────────────────────────────────────────────────────────────
export type { RunMode, IGameModeEngine } from './core/types';
export type {
  RunLifecycleState,
  RunOutcome,
  TickTier,
  PressureTier,
  BotId,
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

// ── Chat package promotion ────────────────────────────────────────────────
export * from './chat';
export * from './components/chat';

// ── Format Utils ──────────────────────────────────────────────────────────
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
