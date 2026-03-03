// pzo-web/src/data/mechanicsLoader.ts
// Auto-generated from mechanics_core.json
// DO NOT EDIT MANUALLY — regenerate with: python3 scripts/build_mechanics.py

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