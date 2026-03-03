/**
 * FILE: pzo-web/src/features/run/hooks/useBattleEngine.ts
 * Master battle hook — exposes all battle state to UI components.
 *
 * Derives computed boolean flags from haterHeat so components
 * never need to re-implement threshold logic inline.
 *
 * All data flows from Zustand engineStore → this hook → components.
 * Components should never read engineStore.battle directly.
 */
import { useEngineStore } from '../../../store/engineStore';
import {
  BotId,
  BotState,
  BattleActionType,
  HaterBotRuntimeState,
  InjectedCard,
  BattleBudgetState,
  BattleSnapshot,
} from '../../../engines/battle/types';

// ── Derived state types ───────────────────────────────────────────────────────

export interface BattleHeatState {
  /** hater_heat >= 81 — all 5 bots cycling. This is the rat race at full speed. */
  isTotalSuppression: boolean;
  /** hater_heat 61–80 — up to 4 bots in attacking cycle. Real danger. */
  isExtractionActive: boolean;
  /** hater_heat 41–60 — up to 3 bots targeting. Counter-Intel critical. */
  isTargeted: boolean;
  /** hater_heat 20–40 — up to 2 bots watching. You feel the system watching. */
  isSurveillance: boolean;
  /** hater_heat 0–19 — all bots dormant. Build reserves. Breathe. */
  isClearField: boolean;
}

export interface UseBattleEngineReturn {
  // ── Raw state ──────────────────────────────────────────────────────────────
  snapshot:           BattleSnapshot | null;
  budget:             BattleBudgetState | null;
  haterHeat:          number;
  injectedCards:      InjectedCard[];
  activeBots:         HaterBotRuntimeState[];
  allBots:            HaterBotRuntimeState[];

  // ── Derived bot lists ──────────────────────────────────────────────────────
  attackingBots:      HaterBotRuntimeState[];
  targetingBots:      HaterBotRuntimeState[];
  watchingBots:       HaterBotRuntimeState[];
  neutralizedBots:    HaterBotRuntimeState[];

  // ── Counts ─────────────────────────────────────────────────────────────────
  activeBotCount:     number;
  budgetPtsRemaining: number;
  budgetPtsTotal:     number;

  // ── Heat state flags ───────────────────────────────────────────────────────
  heatState:          BattleHeatState;
  isTotalSuppression: boolean;
  isExtractionActive: boolean;
  isTargeted:         boolean;
  isSurveillance:     boolean;
  isClearField:       boolean;

  // ── Injection state ────────────────────────────────────────────────────────
  hasActiveInjections: boolean;
  injectedCardCount:   number;

  // ── Run state ──────────────────────────────────────────────────────────────
  isRunActive:    boolean;
  tickNumber:     number;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useBattleEngine(): UseBattleEngineReturn {
  const snapshot      = useEngineStore(s => s.battle.snapshot);
  const budget        = useEngineStore(s => s.battle.budget);
  const haterHeat     = useEngineStore(s => s.battle.haterHeat) ?? 0;
  const injectedCards = useEngineStore(s => s.battle.injectedCards) ?? [];
  const activeBots    = useEngineStore(s => s.battle.activeBots) ?? [];
  const isRunActive   = useEngineStore(s => s.battle.isRunActive) ?? false;
  const tickNumber    = useEngineStore(s => s.battle.tickNumber) ?? 0;

  // All bots from snapshot (includes dormant, retreating, neutralized)
  const allBots: HaterBotRuntimeState[] = snapshot
    ? Object.values(snapshot.bots)
    : [];

  // Derived bot lists by state
  const attackingBots   = allBots.filter(b => b.state === BotState.ATTACKING);
  const targetingBots   = allBots.filter(b => b.state === BotState.TARGETING);
  const watchingBots    = allBots.filter(b => b.state === BotState.WATCHING);
  const neutralizedBots = allBots.filter(b => b.state === BotState.NEUTRALIZED);

  // Heat state flags — derived from haterHeat integer
  const isTotalSuppression = haterHeat >= 81;
  const isExtractionActive = haterHeat >= 61 && haterHeat < 81;
  const isTargeted         = haterHeat >= 41 && haterHeat < 61;
  const isSurveillance     = haterHeat >= 20 && haterHeat < 41;
  const isClearField       = haterHeat < 20;

  const heatState: BattleHeatState = {
    isTotalSuppression,
    isExtractionActive,
    isTargeted,
    isSurveillance,
    isClearField,
  };

  return {
    snapshot,
    budget,
    haterHeat,
    injectedCards,
    activeBots,
    allBots,

    attackingBots,
    targetingBots,
    watchingBots,
    neutralizedBots,

    activeBotCount:     activeBots.length,
    budgetPtsRemaining: budget?.remainingPts ?? 0,
    budgetPtsTotal:     budget?.totalPts ?? 0,

    heatState,
    isTotalSuppression,
    isExtractionActive,
    isTargeted,
    isSurveillance,
    isClearField,

    hasActiveInjections: injectedCards.length > 0,
    injectedCardCount:   injectedCards.length,

    isRunActive,
    tickNumber: snapshot?.tickNumber ?? tickNumber,
  };
}

// ── Selector hooks (single-concern, memoized via Zustand) ─────────────────────

/** Returns only the haterHeat integer — for components that only need the gauge. */
export function useHaterHeat(): number {
  return useEngineStore(s => s.battle.haterHeat) ?? 0;
}

/** Returns only the budget state — for the budget display panel. */
export function useBattleBudget(): BattleBudgetState | null {
  return useEngineStore(s => s.battle.budget);
}

/** Returns only injected cards — for the hand display. */
export function useInjectedCards(): InjectedCard[] {
  return useEngineStore(s => s.battle.injectedCards) ?? [];
}

/** Returns only bots in TARGETING or ATTACKING state — for threat display. */
export function useActiveThreatBots(): HaterBotRuntimeState[] {
  return useEngineStore(s => s.battle.activeBots) ?? [];
}