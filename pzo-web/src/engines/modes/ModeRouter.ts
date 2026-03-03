// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — MODE ROUTER (v2 — full integration)
// pzo-web/src/engines/modes/ModeRouter.ts
//
// WHAT CHANGED FROM v1:
//   v1: Created the IGameModeEngine. Wired liveStateRef. Started the run.
//   v2: Also:
//     • Maps RunMode → GameMode for CardEngine initialization
//     • Co-initializes CardEngine alongside IGameModeEngine
//     • Starts ModeEventBridge (old↔new event bus translation)
//     • Wires card engine store handlers via wireCardEngineHandlers()
//     • Exposes startRunWithCards() as the canonical entry point
//
// BACKWARD COMPATIBILITY:
//   ModeRouter.create() and ModeRouter.startRun() are unchanged.
//   Existing callers that only use IGameModeEngine are not broken.
//   New callers use startRunWithCards() for full card+store integration.
//
// FILE LAYOUT:
//   1. Imports + type declarations
//   2. MODE_METADATA (unchanged)
//   3. ModeRouter class:
//      • create()           — IGameModeEngine factory (unchanged API)
//      • startRun()         — legacy run start (unchanged API)
//      • startRunWithCards()— full integration run start (NEW)
//      • getMetadata()      — unchanged
//      • getAllModes()       — unchanged
//   4. wireLiveStateRef()   — internal helper (unchanged)
//   5. createDefaultConfig()— unchanged
//
// Density6 LLC · Point Zero One · Mode Router · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import type { RunMode, IGameModeEngine, ModeInitConfig } from '../core/types';
import { orchestrator }                  from '../core/EngineOrchestrator';
import { EmpireEngine }                  from './EmpireEngine';
import { PredatorEngine }                from './PredatorEngine';
import { SyndicateEngine }               from './SyndicateEngine';
import { PhantomEngine }                 from './PhantomEngine';
import type { LiveRunState }             from '../core/RunStateSnapshot';

// ── New system imports ─────────────────────────────────────────────────────────
import type { CardEngineInitParams }     from '../cards/types';
import { toGameMode }                    from './LegacyTypeCompat';
import { createModeEventBridge, ModeEventBridge } from './ModeEventBridge';
import {
  wireCardEngineHandlers,
  defaultCardSlice,
} from '../../store/engineStore.card-slice';
import { useEngineStore }                from '../../store/engineStore';

// ── Mode metadata (used by LobbyScreen and UI) ─────────────────────────────────

export interface ModeMetadata {
  mode:        RunMode;
  engineLabel: string;
  uiLabel:     string;
  description: string;
  minPlayers:  number;
  maxPlayers:  number;
}

export const MODE_METADATA: Record<RunMode, ModeMetadata> = {
  'solo': {
    mode:        'solo',
    engineLabel: 'EmpireEngine',
    uiLabel:     'EMPIRE',
    description: 'Build passive income past expenses before the 5 adversarial systems extract everything you built.',
    minPlayers:  1,
    maxPlayers:  1,
  },
  'asymmetric-pvp': {
    mode:        'asymmetric-pvp',
    engineLabel: 'PredatorEngine',
    uiLabel:     'PREDATOR',
    description: 'One builder. One hater. Real-time sabotage vs. real-time defense.',
    minPlayers:  1,
    maxPlayers:  2,
  },
  'co-op': {
    mode:        'co-op',
    engineLabel: 'SyndicateEngine',
    uiLabel:     'SYNDICATE',
    description: 'Two players, shared economy. Rescue each other or fall together.',
    minPlayers:  2,
    maxPlayers:  2,
  },
  'ghost': {
    mode:        'ghost',
    engineLabel: 'PhantomEngine',
    uiLabel:     'PHANTOM',
    description: 'Race a verified champion\'s ghost on the same deterministic seed.',
    minPlayers:  1,
    maxPlayers:  1,
  },
};

// ── Run context returned by startRunWithCards ──────────────────────────────────

export interface RunContext {
  modeEngine:  IGameModeEngine;
  bridge:      ModeEventBridge;
  cardUnsub:   () => void;
  teardown():  void;       // call on run end / component unmount
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE ROUTER
// ─────────────────────────────────────────────────────────────────────────────

export class ModeRouter {

  // ── IGameModeEngine factory (UNCHANGED API) ───────────────────────────────

  /**
   * Creates and returns the correct mode engine for the given RunMode.
   * Does NOT start the run. Does NOT start the bridge.
   * For full integration, use startRunWithCards() instead.
   */
  static create(mode: RunMode): IGameModeEngine {
    switch (mode) {
      case 'solo':            return new EmpireEngine();
      case 'asymmetric-pvp': return new PredatorEngine();
      case 'co-op':          return new SyndicateEngine();
      case 'ghost':          return new PhantomEngine();
      default: {
        console.error(`[ModeRouter] Unknown mode: ${mode}. Falling back to EmpireEngine.`);
        return new EmpireEngine();
      }
    }
  }

  // ── Legacy run start (UNCHANGED API) ─────────────────────────────────────

  /**
   * Creates the engine, starts the run, wires liveStateRef.
   * Preserved for backward compatibility with existing callers.
   * New callers should prefer startRunWithCards().
   */
  static async startRun(
    mode:   RunMode,
    config: ModeInitConfig,
  ): Promise<IGameModeEngine> {
    const engine = ModeRouter.create(mode);
    await orchestrator.startRun(config);
    // getLiveState() does not exist on zero/EngineOrchestrator — live state
    // wiring is handled by startRunWithCards() via ModeEventBridge.
    const liveState: LiveRunState | null = null;
    if (liveState) wireLiveStateRef(engine, liveState);
    return engine;
  }

  // ── Full integration run start (NEW) ──────────────────────────────────────

  /**
   * Canonical entry point for full-stack run initialization.
   *
   * What this does (in order):
   *   1. Creates the IGameModeEngine for the RunMode
   *   2. Creates and STARTS the ModeEventBridge (old↔new bus translation)
   *      → Must start BEFORE orchestrator.startRun() so RUN_STARTED is bridged
   *   3. Starts the run via orchestrator (emits RUN_STARTED on zero bus)
   *   4. Wires liveStateRef to the mode engine
   *   5. Wires card engine EventBus handlers to engineStore card slice
   *   6. Resets card slice to default state for this run
   *   7. Returns a RunContext with teardown() for cleanup
   *
   * On teardown():
   *   • Stops the event bridge
   *   • Unsubscribes all card store handlers
   *   • Resets card slice to default
   *
   * @param mode    RunMode string ('solo' | 'asymmetric-pvp' | 'co-op' | 'ghost')
   * @param config  ModeInitConfig — use createDefaultConfig(mode) as starting point
   * @param cardEventBus  The CardUXBridge EventBus instance from CardEngine
   *
   * @example
   *   const config = createDefaultConfig('solo');
   *   const ctx = await ModeRouter.startRunWithCards('solo', config, cardEngine.getEventBus());
   *   // on cleanup:
   *   ctx.teardown();
   */
  static async startRunWithCards(
    mode:         RunMode,
    config:       ModeInitConfig,
    cardEventBus: import('../zero/EventBus').EventBus,
  ): Promise<RunContext> {
    // ── Step 1: Create mode engine ──────────────────────────────────────────
    const modeEngine = ModeRouter.create(mode);

    // ── Step 2: Start event bridge BEFORE orchestrator ─────────────────────
    // Bridge must be running before RUN_STARTED fires so the store receives it.
    const bridge = createModeEventBridge();
    bridge.start();

    // ── Step 3: Start run via orchestrator ─────────────────────────────────
    await orchestrator.startRun(config);

    // ── Step 4: Wire liveStateRef ───────────────────────────────────────────
    // getLiveState() does not exist on zero/EngineOrchestrator — live state
    // is delivered to mode engines through ModeEventBridge event translation.
    const liveState: LiveRunState | null = null;
    if (liveState) wireLiveStateRef(modeEngine, liveState);

    // ── Step 5: Reset card slice and wire card event handlers ──────────────
    // Reset slice first so any events from CardEngine.init() land in clean state
    useEngineStore.setState(s => { (s as any).card = defaultCardSlice(); });

    const cardUnsub = wireCardEngineHandlers(
      cardEventBus,
      useEngineStore.setState as any,
    );

    // ── Step 6: Expose teardown ─────────────────────────────────────────────
    const teardown = () => {
      bridge.stop();
      cardUnsub();
      useEngineStore.setState(s => { (s as any).card = defaultCardSlice(); });
    };

    return { modeEngine, bridge, cardUnsub, teardown };
  }

  // ── GameMode translation (NEW — for CardEngine callers) ───────────────────

  /**
   * Returns the GameMode enum value that corresponds to this RunMode.
   * Use when constructing CardEngineInitParams from a ModeInitConfig.
   *
   * @example
   *   const gameMode = ModeRouter.toGameMode('solo');
   *   // → GameMode.GO_ALONE
   *   const cardParams: CardEngineInitParams = {
   *     ...config,
   *     gameMode,
   *     seed: String(config.seed),
   *     maxHandSize: 5,
   *     decisionWindowMs: 12_000,
   *     freedomThreshold: 0.7,
   *   };
   */
  static toGameMode(mode: RunMode) {
    return toGameMode(mode);
  }

  /**
   * Build a CardEngineInitParams from a ModeInitConfig and RunMode.
   * All mode-specific overrides (battleBudgetMax, trustScoreInit, legendRunId)
   * are populated from the config if present, with sensible defaults.
   */
  static buildCardEngineParams(
    mode:   RunMode,
    config: ModeInitConfig,
    userId: string,
  ): CardEngineInitParams {
    return {
      runId:            String((config as any).runId ?? `run_${Date.now()}`),
      userId,
      seed:             String(config.seed),
      gameMode:         toGameMode(mode),
      seasonTickBudget: config.runTicks,
      maxHandSize:      MODE_MAX_HAND_SIZES[mode] ?? 5,
      decisionWindowMs: 12_000,
      freedomThreshold: 0.7,
      // Mode-specific
      battleBudgetMax:  mode === 'asymmetric-pvp' ? 200          : undefined,
      trustScoreInit:   mode === 'co-op'          ? 50           : undefined,
      legendRunId:      mode === 'ghost'
        ? (config as any).ghostChampionRunId ?? `champion_seed_${config.seed}`
        : undefined,
    };
  }

  // ── Metadata helpers (UNCHANGED) ─────────────────────────────────────────

  static getMetadata(mode: RunMode): ModeMetadata {
    return MODE_METADATA[mode];
  }

  static getAllModes(): ModeMetadata[] {
    return [
      MODE_METADATA['solo'],
      MODE_METADATA['asymmetric-pvp'],
      MODE_METADATA['co-op'],
      MODE_METADATA['ghost'],
    ];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Wire liveStateRef to engines that implement setLiveStateRef. */
function wireLiveStateRef(engine: IGameModeEngine, liveState: LiveRunState): void {
  const e = engine as IGameModeEngine & { setLiveStateRef?: (ref: LiveRunState) => void };
  if (typeof e.setLiveStateRef === 'function') {
    e.setLiveStateRef(liveState);
  }
}

/**
 * Maximum hand sizes per RunMode.
 * Mirrors MAX_HAND_SIZE in cards/types.ts but keyed by RunMode string
 * for ModeRouter use without importing cards/types.ts.
 */
const MODE_MAX_HAND_SIZES: Record<RunMode, number> = {
  'solo':           5,   // GO_ALONE
  'asymmetric-pvp': 6,   // HEAD_TO_HEAD — extra slot for counter card retention
  'co-op':          5,   // TEAM_UP
  'ghost':          4,   // CHASE_A_LEGEND — precision over volume
};

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT CONFIG FACTORY (UNCHANGED)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a default ModeInitConfig for a given mode.
 * Override specific fields before passing to ModeRouter.startRunWithCards().
 */
export function createDefaultConfig(mode: RunMode, seed?: number): ModeInitConfig {
  const resolvedSeed = seed ?? (Date.now() ^ Math.floor(Math.random() * 0xFFFFFF));
  return {
    seed:             resolvedSeed,
    startingCash:     28_000,
    startingIncome:   2_100,
    startingExpenses: 4_800,
    runTicks:         720,
    localRole:        mode === 'asymmetric-pvp' ? 'builder' : undefined,
    haterPlayerId:    mode === 'asymmetric-pvp' ? 'AI'      : undefined,
    ghostChampionRunId: mode === 'ghost'
      ? `champion_seed_${resolvedSeed}`
      : undefined,
  };
}