// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — MODE ROUTER (v3 — Phase 2 canonical)
// pzo-web/src/engines/modes/ModeRouter.ts
//
// WHAT CHANGED FROM v2:
//   v2: startRun() kept for backward compatibility. startRunWithCards() added.
//   v3: startRun() REMOVED. startRunWithCards() is the ONLY entry point.
//       CardEngine is auto-constructed with correct GameMode params.
//       EmpireEngine loadout selection wired to config.empireLoadout.
//       Dynasty mode initialization wired for PhantomEngine.
//       Syndicate role initialization wired for SyndicateEngine.
//
// DESIGN CONTRACT:
//   ModeRouter.startRunWithCards() is the single integration point.
//   All callers (LobbyScreen, test harness, useGameLoop) go through it.
//   No component imports CardEngine directly — ModeRouter owns CardEngine lifecycle.
//   RunContext.teardown() must be called on component unmount / run end.
//
// FILE LAYOUT:
//   1. Imports
//   2. MODE_METADATA (unchanged)
//   3. ModeRouter.startRunWithCards()  — only public entry point
//   4. ModeRouter.create()             — IGameModeEngine factory (internal use)
//   5. ModeRouter helpers (metadata, config, toGameMode)
//   6. Internal: wireLiveStateRef, MODE_MAX_HAND_SIZES
//   7. createDefaultConfig() — exported config factory
//
// Density6 LLC · Point Zero One · Mode Router · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import type { RunMode, IGameModeEngine, ModeInitConfig }    from '../core/types';
import { orchestrator }                                      from '../zero/EngineOrchestrator';
import { EmpireEngine }                                      from './EmpireEngine';
import type { EmpireLoadout }                                from './EmpireEngine';
import { PredatorEngine }                                    from './PredatorEngine';
import { SyndicateEngine }                                   from './SyndicateEngine';
import type { SyndicateRole }                                from './SyndicateEngine';
import { PhantomEngine }                                     from './PhantomEngine';
import type { LiveRunState }                                 from '../core/RunStateSnapshot';
import { CardEngine }                                        from '../cards/CardEngine';
import type { CardEngineInitParams }                         from '../cards/types';
import { GameMode }                                          from '../cards/types';
import { toGameMode }                                        from './LegacyTypeCompat';
import { createModeEventBridge, type ModeEventBridge }       from './ModeEventBridge';
import {
  wireCardEngineHandlers,
  defaultCardSlice,
}                                                            from '../store/engineStore.card-slice';
import { useEngineStore }                                    from '../store/engineStore';
import type { EventBus }                                     from '../zero/EventBus';

// ─────────────────────────────────────────────────────────────────────────────
// MODE METADATA
// ─────────────────────────────────────────────────────────────────────────────

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
    description: "Race a verified champion's ghost on the same deterministic seed.",
    minPlayers:  1,
    maxPlayers:  1,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// RUN CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

/** Full context returned by startRunWithCards(). Call teardown() on run end or unmount. */
export interface RunContext {
  modeEngine:  IGameModeEngine;
  cardEngine:  CardEngine;
  bridge:      ModeEventBridge;
  cardUnsub:   () => void;
  teardown():  void;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE ROUTER
// ─────────────────────────────────────────────────────────────────────────────

export class ModeRouter {
  // ── Singleton CardEngine reference (one per run) ──────────────────────────
  private static _activeCardEngine: CardEngine | null = null;
  private static _activeBridge:     ModeEventBridge | null = null;

  /**
   * Returns the currently active CardEngine, if a run is in progress.
   * Used by CardHand component and useCardEngine hook to access the engine
   * without needing the full RunContext.
   */
  static getActiveCardEngine(): CardEngine | null {
    return ModeRouter._activeCardEngine;
  }

  /**
   * Returns the currently active CardEngine's EventBus.
   * Null if no run is active.
   */
  static getActiveCardEventBus(): EventBus | null {
    return ModeRouter._activeCardEngine?.getEventBus() ?? null;
  }

  /**
   * Returns the currently active GameMode from the running CardEngine.
   * Used by CardEngineAdapter.init() to resolve GameMode without tight coupling.
   */
  static getActiveMode(): GameMode | null {
    return ModeRouter._activeCardEngine?.getMode() ?? null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CANONICAL ENTRY POINT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * startRunWithCards() — the ONLY way to start a PZO run.
   *
   * Execution order (order is critical — DO NOT reorder):
   *
   *   1.  Create IGameModeEngine for the RunMode
   *   2.  Apply Phase 2 config extensions to the mode engine
   *   3.  Create CardEngine + auto-construct CardEngineInitParams
   *   4.  Create + START ModeEventBridge (before orchestrator — catches RUN_STARTED)
   *   5.  Call modeEngine.init(config) — mode engine subscribes to events
   *   6.  Reset card store slice to clean state
   *   7.  Wire card EventBus handlers to engineStore.card slice
   *   8.  Call orchestrator.startRun(config) — fires RUN_STARTED on zero/EventBus
   *   9.  Wire liveStateRef to mode engine (if available from orchestrator)
   *   10. Store CardEngine reference on class for getActiveCardEngine()
   *   11. Return RunContext with teardown()
   *
   * On teardown() (called by useGameLoop or LobbyScreen on unmount / run end):
   *   • Stops the event bridge
   *   • Unsubscribes all card store handlers
   *   • Resets card slice to default
   *   • Clears static CardEngine reference
   *
   * @param mode     RunMode string
   * @param config   ModeInitConfig — use createDefaultConfig(mode) as base
   * @param userId   Player's user ID for CardEngine record keeping
   *
   * @example
   *   const config = createDefaultConfig('solo');
   *   config.empireLoadout = 'BUILDER';
   *   const ctx = await ModeRouter.startRunWithCards('solo', config, 'user_abc123');
   *   // On cleanup:
   *   ctx.teardown();
   */
  static async startRunWithCards(
    mode:   RunMode,
    config: ModeInitConfig,
    userId: string = 'local_player',
  ): Promise<RunContext> {
    // ── Step 1: Create mode engine ──────────────────────────────────────────
    const modeEngine = ModeRouter.create(mode, config);

    // ── Step 2: Apply Phase 2 config extensions ─────────────────────────────
    ModeRouter.applyModeExtensions(modeEngine, mode, config);

    // ── Step 3: Auto-construct CardEngine with correct GameMode params ───────
    const cardParams = ModeRouter.buildCardEngineParams(mode, config, userId);
    const cardEngine = new CardEngine();

    // CardEngine.init() wires the eventBus — must happen before orchestrator
    cardEngine.init(cardParams);
    ModeRouter._activeCardEngine = cardEngine;

    // ── Step 4: Create + start ModeEventBridge BEFORE orchestrator ──────────
    const bridge = createModeEventBridge();
    bridge.start();
    ModeRouter._activeBridge = bridge;

    // ── Step 5: Init mode engine (subscribes to events before RUN_STARTED) ──
    modeEngine.init(config);

    // ── Step 6: Reset card store slice ──────────────────────────────────────
    useEngineStore.setState(s => { (s as any).card = defaultCardSlice(); });

    // ── Step 7: Wire card EventBus → engineStore ─────────────────────────────
    const cardUnsub = wireCardEngineHandlers(
      cardEngine.getEventBus(),
      useEngineStore.setState as any,
    );

    // ── Step 8: Start run via orchestrator (fires RUN_STARTED on zero/EventBus)
    await orchestrator.startRun(config);

    // ── Step 9: Wire liveStateRef ────────────────────────────────────────────
    // Orchestrator exposes liveState if available (implementation may vary).
    // wireLiveStateRef() safely handles engines that don't implement setLiveStateRef.
    const liveState = (orchestrator as any).getLiveState?.() ?? null;
    if (liveState) {
      wireLiveStateRef(modeEngine, liveState);
    }

    // ── Step 11: Build and return RunContext ─────────────────────────────────
    const teardown = (): void => {
      bridge.stop();
      cardUnsub();
      useEngineStore.setState(s => { (s as any).card = defaultCardSlice(); });
      ModeRouter._activeCardEngine = null;
      ModeRouter._activeBridge     = null;
    };

    return { modeEngine, cardEngine, bridge, cardUnsub, teardown };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INTERNAL: ENGINE FACTORY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Creates and returns the correct mode engine for the given RunMode.
   * Internal — callers should use startRunWithCards().
   * Config is passed for Empire loadout pre-selection and Phantom dynasty init.
   */
  private static create(mode: RunMode, config?: ModeInitConfig): IGameModeEngine {
    switch (mode) {
      case 'solo': {
        const engine = new EmpireEngine();
        // Pre-select loadout from config before init() is called
        if (config && (config as any).empireLoadout) {
          engine.setLoadout((config as any).empireLoadout as EmpireLoadout);
        }
        return engine;
      }
      case 'asymmetric-pvp':
        return new PredatorEngine();
      case 'co-op':
        return new SyndicateEngine();
      case 'ghost':
        return new PhantomEngine();
      default: {
        console.error(`[ModeRouter] Unknown mode: ${mode}. Falling back to EmpireEngine.`);
        return new EmpireEngine();
      }
    }
  }

  /**
   * Apply Phase 2 config extensions to the engine after construction but before init().
   * Extensions are mode-specific and read from config fields added in createDefaultConfig().
   */
  private static applyModeExtensions(
    engine: IGameModeEngine,
    mode:   RunMode,
    config: ModeInitConfig,
  ): void {
    const cfg = config as any;

    if (mode === 'solo' && engine instanceof EmpireEngine) {
      if (cfg.empireLoadout) {
        engine.setLoadout(cfg.empireLoadout as EmpireLoadout);
      }
    }

    // SyndicateEngine: role is applied inside init() via config.syndicateRole.
    // PhantomEngine: dynasty stack and decay are applied inside init() via
    //   config.championAgeDays and config.seed.
    // PredatorEngine: role/AI config are applied inside init() via config.localRole.
    // All extensions above are no-ops if the engine type doesn't match.
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CARD ENGINE PARAMS FACTORY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Build a fully-populated CardEngineInitParams from a ModeInitConfig.
   * Auto-selects GameMode, maxHandSize, and all mode-specific overrides.
   * This is the canonical factory — no caller should construct CardEngineInitParams directly.
   */
  static buildCardEngineParams(
    mode:   RunMode,
    config: ModeInitConfig,
    userId: string,
  ): CardEngineInitParams {
    const gameMode  = toGameMode(mode);
    const cfg       = config as any;

    return {
      runId:            cfg.runId ?? `run_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userId,
      seed:             String(config.seed),
      gameMode,
      seasonTickBudget: config.runTicks,
      maxHandSize:      MODE_MAX_HAND_SIZES[mode],
      decisionWindowMs: MODE_DECISION_WINDOW_MS[mode],
      freedomThreshold: 0.7,

      // HEAD_TO_HEAD (Predator) — battle budget system
      battleBudgetMax: gameMode === GameMode.HEAD_TO_HEAD
        ? (cfg.battleBudgetMax ?? 200)
        : undefined,

      // TEAM_UP (Syndicate) — starting trust score
      trustScoreInit: gameMode === GameMode.TEAM_UP
        ? (cfg.trustScoreInit ?? 50)
        : undefined,

      // CHASE_A_LEGEND (Phantom) — champion run reference
      legendRunId: gameMode === GameMode.CHASE_A_LEGEND
        ? (cfg.ghostChampionRunId ?? `champion_seed_${config.seed}`)
        : undefined,
    };
  }

  /**
   * GameMode translation for external callers.
   * Prefer ModeRouter.buildCardEngineParams() over calling this directly.
   */
  static toGameMode(mode: RunMode): GameMode {
    return toGameMode(mode);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // METADATA HELPERS (unchanged from v2)
  // ═══════════════════════════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════════════════════════
  // EMPIRE LOADOUT HELPER (Phase 2 convenience for LobbyScreen)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Returns available Empire loadout options for LobbyScreen rendering.
   * Wraps EmpireEngine.getLoadoutOptions() for convenience.
   */
  static getEmpireLoadoutOptions(): ReturnType<typeof EmpireEngine.getLoadoutOptions> {
    return EmpireEngine.getLoadoutOptions();
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
 * Mirrors MAX_HAND_SIZE in cards/types.ts but keyed by RunMode for ModeRouter use.
 */
const MODE_MAX_HAND_SIZES: Record<RunMode, number> = {
  'solo':           5,   // GO_ALONE — standard play
  'asymmetric-pvp': 6,   // HEAD_TO_HEAD — extra slot for counter card retention
  'co-op':          5,   // TEAM_UP — mirror of solo
  'ghost':          4,   // CHASE_A_LEGEND — precision over volume
};

/**
 * Decision window durations per RunMode (ms).
 * Tuned so each mode feels appropriately urgent.
 *   Empire:   30s  — slow and deliberate
 *   Predator: 12s  — fast, reactive
 *   Syndicate: 20s — co-op allows slightly more time
 *   Phantom:  18s  — ghost challenges should feel timed
 */
const MODE_DECISION_WINDOW_MS: Record<RunMode, number> = {
  'solo':           30_000,
  'asymmetric-pvp': 12_000,
  'co-op':          20_000,
  'ghost':          18_000,
};

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT CONFIG FACTORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a fully-populated ModeInitConfig for a given mode.
 * All Phase 2 extension fields are populated with sensible defaults.
 * Override fields before passing to ModeRouter.startRunWithCards().
 *
 * @example
 *   const config = createDefaultConfig('solo');
 *   config.empireLoadout     = 'BUILDER';   // Phase 2 Empire extension
 *   config.empireLoadout     = 'BALANCED';  // default
 *
 *   const config = createDefaultConfig('co-op');
 *   config.syndicateRole     = 'ANCHOR';    // Phase 2 Syndicate extension
 *   config.enableSharedTreasury = true;     // default
 *
 *   const config = createDefaultConfig('ghost');
 *   config.championAgeDays   = 30;          // Phase 2 Phantom extension (legend decay)
 *   config.ghostChampionRunId = 'verified_123'; // production: fetched from DB
 */
export function createDefaultConfig(mode: RunMode, seed?: number): ModeInitConfig {
  const resolvedSeed = seed ?? (Date.now() ^ Math.floor(Math.random() * 0xFFFFFF));

  const base: ModeInitConfig & Record<string, unknown> = {
    seed:             resolvedSeed,
    startingCash:     28_000,
    startingIncome:   2_100,
    startingExpenses: 4_800,
    runTicks:         720,
    localRole:        mode === 'asymmetric-pvp' ? 'builder'   : undefined,
    haterPlayerId:    mode === 'asymmetric-pvp' ? 'AI'        : undefined,
    ghostChampionRunId: mode === 'ghost'
      ? `champion_seed_${resolvedSeed}`
      : undefined,

    // ── Phase 2 extensions ─────────────────────────────────────────────────
    // Empire
    empireLoadout: mode === 'solo' ? 'BALANCED' as EmpireLoadout : undefined,

    // Syndicate
    syndicateRole:        mode === 'co-op' ? 'LEAD' as SyndicateRole : undefined,
    enableSharedTreasury: mode === 'co-op' ? true                    : undefined,
    trustScoreInit:       mode === 'co-op' ? 50                      : undefined,

    // Phantom
    championAgeDays:  mode === 'ghost' ? 0 : undefined,  // 0 = fresh champion
    battleBudgetMax:  mode === 'asymmetric-pvp' ? 200 : undefined,
  };

  // Strip undefined values to keep config clean
  return Object.fromEntries(
    Object.entries(base).filter(([, v]) => v !== undefined),
  ) as ModeInitConfig;
}