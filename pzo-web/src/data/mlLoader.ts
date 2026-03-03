// pzo-web/src/data/mlLoader.ts
// Auto-generated from ml_core.ndjson
// DO NOT EDIT MANUALLY — regenerate with: python3 scripts/build_ml.py

export type MLModelCategory =
  | 'classifier'
  | 'predictor'
  | 'recommender'
  | 'rl_policy'
  | 'anomaly_detector'
  | 'generator'
  | 'controller'
  | 'embedding_model';

export type MLInferencePlacement = 'client' | 'server' | 'both';

export type MLStatus =
  | 'simulated'   // Running as IntelligenceState heuristic right now
  | 'wiring'      // Being connected to game state
  | 'training'    // Collecting run data
  | 'deployed';   // Live model serving

export interface MLMechanicRecord {
  task_id:              string;       // PZO-ML001
  mechanic_id:          string;       // M01a
  core_pair:            string;       // M01 — the core mechanic this powers
  title:                string;
  what_it_adds:         string;
  family:               string;
  kind:                 'ml';
  model_category:       MLModelCategory;
  inference_placement:  MLInferencePlacement;
  intelligence_signal:  string;       // which IntelligenceState field this writes
  heuristic_substitute: string;       // current App.tsx substitute expression
  training_phase:       1 | 2 | 3;   // 1=now, 2=after 100 runs, 3=after 500 runs
  status:               MLStatus;
  priority:             1 | 2 | 3;
  inputs:               string[];
  outputs:              string[];
  telemetry_events:     string[];
  guardrails:           string[];
  model_options:        { baseline: string; sequence: string; policy: string };
  module_path:          string;
  exec_hook:            string;
  runtime_call:         string;
  batch:                1 | 2 | 3;
}

import rawML from './ml_mechanics_core.json';

// ─── IntelligenceState (mirrored from App.tsx) ───────────────────────────────
export type IntelligenceState = {
  alpha: number;
  risk: number;
  volatility: number;
  antiCheat: number;
  personalization: number;
  rewardFit: number;
  recommendationPower: number;
  churnRisk: number;
  momentum: number;
};



export const ML_REGISTRY: MLMechanicRecord[] = (rawML as any[]).map((raw) => ({
  task_id: raw.task_id,
  mechanic_id: raw.mechanic_id ?? raw.ml_id ?? '', // fallback if mechanic_id missing
  core_pair: raw.core_pair ?? raw.core_id ?? '',
  title: raw.title ?? raw.model_name ?? '',
  what_it_adds: Array.isArray(raw.what_it_adds) ? raw.what_it_adds.join(', ') : (raw.what_it_adds ?? ''),
  family: raw.family ?? '',
  kind: 'ml',
  model_category: raw.model_category ?? 'classifier',
  inference_placement: raw.inference_placement ?? (Array.isArray(raw.placement) ? (raw.placement[0] as MLInferencePlacement) : 'server'),
  intelligence_signal: raw.intelligence_signal ?? '',
  heuristic_substitute: raw.heuristic_substitute ?? '',
  training_phase: raw.training_phase ?? 1,
  status: raw.status ?? 'simulated',
  priority: raw.priority ?? 1,
  inputs: raw.inputs ?? [],
  outputs: raw.outputs ?? raw.primary_outputs ?? [],
  telemetry_events: raw.telemetry_events ?? [],
  guardrails: raw.guardrails ?? [],
  model_options: raw.model_options ?? { baseline: '', sequence: '', policy: '' },
  module_path: raw.module_path ?? '',
  exec_hook: raw.exec_hook ?? '',
  runtime_call: raw.runtime_call ?? '',
  batch: raw.batch ?? 1,
}));

export function getMLMechanic(id: string): MLMechanicRecord | undefined {
  return ML_REGISTRY.find(m => m.mechanic_id === id);
}

export function getMLForCore(coreId: string): MLMechanicRecord | undefined {
  return ML_REGISTRY.find(m => m.core_pair === coreId);
}

export function getMLByCategory(cat: MLModelCategory): MLMechanicRecord[] {
  return ML_REGISTRY.filter(m => m.model_category === cat);
}

export function getMLByStatus(status: MLStatus): MLMechanicRecord[] {
  return ML_REGISTRY.filter(m => m.status === status);
}

export function getMLByIntelSignal(signal: string): MLMechanicRecord[] {
  return ML_REGISTRY.filter(m => m.intelligence_signal === signal);
}

// Get all ML mechanics that feed a specific IntelligenceState field
export function getIntelligenceFeed(field: keyof IntelligenceState): MLMechanicRecord[] {
  return ML_REGISTRY.filter(m => m.intelligence_signal === field);
}

// Phase 1 mechanics — build these first (heuristics → real models)
export const ML_PHASE_1 = ML_REGISTRY.filter(m => m.training_phase === 1);
export const ML_PHASE_2 = ML_REGISTRY.filter(m => m.training_phase === 2);
export const ML_PHASE_3 = ML_REGISTRY.filter(m => m.training_phase === 3);

// Currently active as heuristics in App.tsx IntelligenceState
export const ML_SIMULATED = ML_REGISTRY.filter(m => m.status === 'simulated');
