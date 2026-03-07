// pzo-web/src/data/mechanicsLoader.ts
// Auto-generated from mechanics_core.json
// DO NOT EDIT MANUALLY — regenerate with: python3 scripts/build_mechanics.py
//
// ── PHASE 5 MODIFICATIONS ─────────────────────────────────────────────────────
// mechanicsLoader.ts is no longer a passive registry.
// It now exposes active-routing utilities consumed by MechanicsRouter:
//
//   initMechanicsRouter(router)  — registers all active mechanics with the router
//   getActiveMechanicsForTick()  — returns done + in_progress mechanics sorted by
//                                   priority + batch (tick_engine layer only)
//   getCardHandlerMechanics()    — card_handler layer mechanics
//   getActiveMechanicsForLayer() — any layer, filtered to active status
//   mechanicsForExecHook(hook)   — lookup by exec_hook string
//
// The MECHANICS_REGISTRY export and all helper functions remain unchanged.
// All new symbols are ADDITIVE — no existing imports break.
//
// Density6 LLC · Point Zero One · Confidential

export type MechanicLayer =
  | 'tick_engine'
  | 'card_handler'
  | 'ui_component'
  | 'season_runtime'
  | 'api_endpoint'
  | 'backend_service';

export type MechanicStatus = 'done' | 'in_progress' | 'todo';

export interface MechanicRecord {
  task_id: string;          // PZO-M01
  mechanic_id: string;      // M01
  title: string;
  purpose: string;          // human-readable design intent
  family: string;
  kind: 'core' | 'ml';
  layer: MechanicLayer;
  priority: 1 | 2 | 3;
  status: MechanicStatus;
  ml_pair: string;          // m01a
  ml_pair_path: string;     // M01a_seed_integrity_replay_forensics.md
  inputs: string[];
  outputs: string[];
  telemetry_events: string[];
  module_path: string;      // pzo_engine/src/mechanics/{stem}.ts
  exec_hook: string;
  batch: 1 | 2 | 3;
  deps: string[];           // mechanic_ids this depends on
  md_source: string;        // source markdown filename e.g. m01_run_seed_deterministic_replay.md
}

// Loaded at build time — Vite resolves JSON imports natively
import rawMechanics from './mechanics_core.json';

export const MECHANICS_REGISTRY: MechanicRecord[] = rawMechanics as MechanicRecord[];

// ─────────────────────────────────────────────────────────────────────────────
// ORIGINAL HELPERS (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export function getMechanic(id: string): MechanicRecord | undefined {
  return MECHANICS_REGISTRY.find(m => m.mechanic_id === id);
}

export function getMechanicsByLayer(layer: MechanicLayer): MechanicRecord[] {
  return MECHANICS_REGISTRY.filter(m => m.layer === layer);
}

export function getMechanicsByBatch(batch: 1 | 2 | 3): MechanicRecord[] {
  return MECHANICS_REGISTRY.filter(m => m.batch === batch);
}

export function getMechanicsByStatus(status: MechanicStatus): MechanicRecord[] {
  return MECHANICS_REGISTRY.filter(m => m.status === status);
}

export function getMechanicDeps(id: string): MechanicRecord[] {
  const target = getMechanic(id);
  if (!target) return [];
  return target.deps
    .map(depId => getMechanic(depId))
    .filter((m): m is MechanicRecord => m !== undefined);
}

export const TICK_ENGINE_MECHANICS = getMechanicsByLayer('tick_engine');
export const CARD_HANDLER_MECHANICS = getMechanicsByLayer('card_handler');
export const UI_MECHANICS = getMechanicsByLayer('ui_component');

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 5: ROUTER WIRING UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Active status set — mechanics that MechanicsRouter fires.
 * 'todo' mechanics are excluded: not yet implemented.
 */
const ACTIVE_STATUSES: MechanicStatus[] = ['done', 'in_progress'];

/**
 * Sorted priority key: priority * 10 + batch (ascending).
 * Priority 1 batch 1 = 11, Priority 3 batch 3 = 33.
 */
function sortKey(m: MechanicRecord): number {
  return m.priority * 10 + m.batch;
}

/**
 * Returns all active tick_engine mechanics sorted by priority then batch.
 * Consumed by MechanicsRouter.init() to build its tick mechanic list.
 */
export function getActiveTickMechanics(): MechanicRecord[] {
  return MECHANICS_REGISTRY
    .filter(m => m.layer === 'tick_engine' && ACTIVE_STATUSES.includes(m.status))
    .sort((a, b) => sortKey(a) - sortKey(b));
}

/**
 * Returns all active card_handler mechanics sorted by priority then batch.
 * Consumed by MechanicsRouter.init() to build its card handler list.
 */
export function getActiveCardHandlerMechanics(): MechanicRecord[] {
  return MECHANICS_REGISTRY
    .filter(m => m.layer === 'card_handler' && ACTIVE_STATUSES.includes(m.status))
    .sort((a, b) => sortKey(a) - sortKey(b));
}

/**
 * Returns all active mechanics for any given layer, sorted by priority + batch.
 * Used by MechanicsRouter or Phase 6 bridge for layer-specific routing.
 */
export function getActiveMechanicsForLayer(layer: MechanicLayer): MechanicRecord[] {
  return MECHANICS_REGISTRY
    .filter(m => m.layer === layer && ACTIVE_STATUSES.includes(m.status))
    .sort((a, b) => sortKey(a) - sortKey(b));
}

/**
 * Look up a mechanic by its exec_hook string.
 * Used by MechanicsRouter.onCardPlay() for fast card-to-mechanic routing.
 */
export function getMechanicByExecHook(execHook: string): MechanicRecord | undefined {
  return MECHANICS_REGISTRY.find(m => m.exec_hook === execHook);
}

/**
 * Returns all active mechanics across ALL routable layers
 * (tick_engine + card_handler) sorted by priority + batch.
 * Used by MechanicsRouter.init() for store registration.
 */
export function getAllActiveMechanics(): MechanicRecord[] {
  const routableLayers: MechanicLayer[] = ['tick_engine', 'card_handler'];
  return MECHANICS_REGISTRY
    .filter(m => routableLayers.includes(m.layer) && ACTIVE_STATUSES.includes(m.status))
    .sort((a, b) => sortKey(a) - sortKey(b));
}

/**
 * Returns the subset of mechanics whose deps are all active (non-todo).
 * MechanicsRouter uses this to skip mechanics that depend on unimplemented mechanics.
 */
export function getMechanicsWithSatisfiedDeps(): MechanicRecord[] {
  const activeIds = new Set(
    MECHANICS_REGISTRY
      .filter(m => ACTIVE_STATUSES.includes(m.status))
      .map(m => m.mechanic_id),
  );

  return MECHANICS_REGISTRY.filter(m => {
    if (!ACTIVE_STATUSES.includes(m.status)) return false;
    return m.deps.every(depId => activeIds.has(depId));
  });
}

/**
 * Batch 1 priority 1 mechanics — the foundational set.
 * Always attempted by MechanicsRouter regardless of shouldAttemptFire() result.
 */
export const BATCH1_PRIORITY1_MECHANICS: MechanicRecord[] = MECHANICS_REGISTRY.filter(
  m => m.batch === 1 && m.priority === 1 && ACTIVE_STATUSES.includes(m.status),
);

/**
 * Initialize a MechanicsRouter instance with the full active registry.
 *
 * Registers all active routable mechanics in the router's runtime store.
 * Called by EngineOrchestrator.startRun() after cardEngineAdapter.startRun().
 *
 * NOTE: The router's init() method handles all actual registration logic.
 * This function exists as the loader's integration seam — any preprocessing
 * of mechanic metadata before router initialization happens here.
 *
 * @param runId - Current run ID (forwarded to router for logging)
 * @param routerInit - The router's init() function (avoid importing MechanicsRouter
 *                     here to prevent a circular dependency chain)
 */
export function initMechanicsRouter(
  runId: string,
  routerInit: (runId: string) => void,
): void {
  // Validate registry is loaded before init
  if (MECHANICS_REGISTRY.length === 0) {
    console.warn(
      '[mechanicsLoader] initMechanicsRouter: MECHANICS_REGISTRY is empty. ' +
      'Check that mechanics_core.json was generated by build_mechanics.py.',
    );
  }

  const active = getAllActiveMechanics();
  console.info(
    `[mechanicsLoader] initMechanicsRouter — ${active.length} active mechanics ` +
    `(${getActiveTickMechanics().length} tick_engine, ${getActiveCardHandlerMechanics().length} card_handler) ` +
    `of ${MECHANICS_REGISTRY.length} total`,
  );

  routerInit(runId);
}