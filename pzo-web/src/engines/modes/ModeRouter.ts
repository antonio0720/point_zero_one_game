// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — MODE ROUTER
// pzo-web/src/engines/modes/ModeRouter.ts
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════
// The factory. Given a RunMode, produces the correct IGameModeEngine.
// This is the ONLY place where mode engine classes are imported.
// The Orchestrator and hooks import from here, never from individual engines.
//
// USAGE:
//   const engine = ModeRouter.create('solo');
//   await orchestrator.startRun(config, engine);

import type { RunMode, IGameModeEngine, ModeInitConfig } from '../core/types';
import { orchestrator }       from '../core/EngineOrchestrator';
import { EmpireEngine }       from './EmpireEngine';
import { PredatorEngine }     from './PredatorEngine';
import { SyndicateEngine }    from './SyndicateEngine';
import { PhantomEngine }      from './PhantomEngine';
import type { LiveRunState }  from '../core/RunStateSnapshot';

// ── Mode metadata (used by LobbyScreen and UI) ───────────────────────────────

export interface ModeMetadata {
  mode:        RunMode;
  engineLabel: string;    // Internal engine name
  uiLabel:     string;    // Name shown to user (EMPIRE, PREDATOR, etc.)
  description: string;    // Short description
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
    minPlayers:  1,  // 1 = vs AI hater; 2 = vs human
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

// ── Mode Router ───────────────────────────────────────────────────────────────

export class ModeRouter {
  /**
   * Creates and returns the correct mode engine for the given RunMode.
   * Does NOT start the run — call orchestrator.startRun(config, engine).
   */
  static create(mode: RunMode): IGameModeEngine {
    switch (mode) {
      case 'solo':             return new EmpireEngine();
      case 'asymmetric-pvp':  return new PredatorEngine();
      case 'co-op':           return new SyndicateEngine();
      case 'ghost':           return new PhantomEngine();
      default: {
        console.error(`[ModeRouter] Unknown mode: ${mode}. Falling back to EmpireEngine.`);
        return new EmpireEngine();
      }
    }
  }

  /**
   * Creates the engine, wires the liveStateRef, and starts the run.
   * This is the single entry point from LobbyScreen / useGameMode hook.
   */
  static async startRun(
    mode:   RunMode,
    config: ModeInitConfig,
  ): Promise<IGameModeEngine> {
    const engine = ModeRouter.create(mode);

    // Wire live state ref for engines that need direct write access
    // (EmpireEngine, PredatorEngine, SyndicateEngine, PhantomEngine all implement setLiveStateRef)
    await orchestrator.startRun(config, engine);

    // Inject live state ref after startRun creates it
    const liveState = orchestrator.getLiveState();
    if (liveState) {
      wireLiveStateRef(engine, liveState);
    }

    return engine;
  }

  /** Returns metadata for a mode without creating an engine instance. */
  static getMetadata(mode: RunMode): ModeMetadata {
    return MODE_METADATA[mode];
  }

  /** Returns all available modes in lobby order. */
  static getAllModes(): ModeMetadata[] {
    return [
      MODE_METADATA['solo'],
      MODE_METADATA['asymmetric-pvp'],
      MODE_METADATA['co-op'],
      MODE_METADATA['ghost'],
    ];
  }
}

// ── Wire live state ref (internal) ───────────────────────────────────────────

function wireLiveStateRef(engine: IGameModeEngine, liveState: LiveRunState): void {
  // Each mode engine optionally implements setLiveStateRef for direct writes
  const e = engine as IGameModeEngine & { setLiveStateRef?: (ref: LiveRunState) => void };
  if (typeof e.setLiveStateRef === 'function') {
    e.setLiveStateRef(liveState);
  }
}

// ── Default run config factory ────────────────────────────────────────────────

/**
 * Creates a default ModeInitConfig for a given mode.
 * Override specific fields before passing to ModeRouter.startRun().
 */
export function createDefaultConfig(mode: RunMode, seed?: number): ModeInitConfig {
  const resolvedSeed = seed ?? (Date.now() ^ Math.floor(Math.random() * 0xFFFFFF));
  return {
    seed:             resolvedSeed,
    startingCash:     28_000,
    startingIncome:   2_100,
    startingExpenses: 4_800,
    runTicks:         720,
    // Mode-specific defaults
    localRole:        mode === 'asymmetric-pvp' ? 'builder' : undefined,
    haterPlayerId:    mode === 'asymmetric-pvp' ? 'AI'      : undefined,
    ghostChampionRunId: mode === 'ghost' ? `champion_seed_${resolvedSeed}` : undefined,
  };
}
