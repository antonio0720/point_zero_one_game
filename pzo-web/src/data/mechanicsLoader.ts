// pzo-web/src/data/mechanicsLoader.ts
// Auto-generated from mechanics_core.ndjson
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
  task_id: string;          // PZO-M001
  mechanic_id: string;      // M01
  title: string;
  purpose: string;
  family: string;
  kind: 'core' | 'ml';
  layer: MechanicLayer;
  priority: 1 | 2 | 3;
  status: MechanicStatus;
  ml_pair: string;          // M01a
  inputs: string[];         // ['state.cash', 'state.tick']
  outputs: string[];        // ['state.hand', 'telemetry.envelope']
  telemetry_events: string[];
  module_path: string;
  exec_hook: string;
  batch: 1 | 2 | 3;
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

export const TICK_ENGINE_MECHANICS = getMechanicsByLayer('tick_engine');
export const CARD_HANDLER_MECHANICS = getMechanicsByLayer('card_handler');
export const UI_MECHANICS = getMechanicsByLayer('ui_component');
