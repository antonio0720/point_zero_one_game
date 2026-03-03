// pzo-web/src/data/mlLoader.ts
// Auto-generated from ml_core.json — DO NOT EDIT MANUALLY
// Re-generate: python3 scripts/build_ml_mechanics.py --force

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
  | 'simulated'    // Running as IntelligenceState heuristic
  | 'wiring'       // Being connected to game state
  | 'training'     // Collecting run data
  | 'deployed';    // Live model serving

export type MLFamily =
  | 'integrity' | 'market' | 'social' | 'contract'
  | 'economy' | 'progression' | 'balance' | 'forensics' | 'co_op';

export type MLIntelSignal =
  | 'alpha' | 'risk' | 'volatility' | 'antiCheat'
  | 'personalization' | 'rewardFit' | 'recommendationPower'
  | 'churnRisk' | 'momentum';

export interface MLMechanicRecord {
  task_id:              string;       // PZO-M01A
  mechanic_id:          string;       // M01a (lowercase)
  core_pair:            string;       // M01
  title:                string;
  what_it_adds:         string;       // joined bullet string
  family:               MLFamily;
  kind:                 'ml';
  model_category:       MLModelCategory;
  inference_placement:  MLInferencePlacement;
  intelligence_signal:  MLIntelSignal;
  heuristic_substitute: string;
  training_phase:       1 | 2 | 3;
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

import rawML from './ml_core.json';

// ── IntelligenceState ─────────────────────────────────────────────────────────
export type IntelligenceState = {
  alpha:               number;
  risk:                number;
  volatility:          number;
  antiCheat:           number;
  personalization:     number;
  rewardFit:           number;
  recommendationPower: number;
  churnRisk:           number;
  momentum:            number;
};

export const ML_REGISTRY: MLMechanicRecord[] = rawML as MLMechanicRecord[];

// ── Lookup helpers ────────────────────────────────────────────────────────────
export function getMLMechanic(id: string): MLMechanicRecord | undefined {
  return ML_REGISTRY.find(m => m.mechanic_id === id.toLowerCase() || m.task_id === id.toUpperCase());
}
export function getMLForCore(coreId: string): MLMechanicRecord | undefined {
  return ML_REGISTRY.find(m => m.core_pair === coreId);
}
export function getAllMLForCore(coreId: string): MLMechanicRecord[] {
  return ML_REGISTRY.filter(m => m.core_pair === coreId);
}
export function getMLByCategory(cat: MLModelCategory): MLMechanicRecord[] {
  return ML_REGISTRY.filter(m => m.model_category === cat);
}
export function getMLByStatus(status: MLStatus): MLMechanicRecord[] {
  return ML_REGISTRY.filter(m => m.status === status);
}
export function getMLByIntelSignal(signal: MLIntelSignal): MLMechanicRecord[] {
  return ML_REGISTRY.filter(m => m.intelligence_signal === signal);
}
export function getMLByFamily(family: MLFamily): MLMechanicRecord[] {
  return ML_REGISTRY.filter(m => m.family === family);
}
export function getIntelligenceFeed(field: keyof IntelligenceState): MLMechanicRecord[] {
  return ML_REGISTRY.filter(m => m.intelligence_signal === field);
}

// ── Phase buckets ─────────────────────────────────────────────────────────────
export const ML_PHASE_1 = ML_REGISTRY.filter(m => m.training_phase === 1);  // Build now
export const ML_PHASE_2 = ML_REGISTRY.filter(m => m.training_phase === 2);  // After 100 runs
export const ML_PHASE_3 = ML_REGISTRY.filter(m => m.training_phase === 3);  // After 500 runs

// ── Status buckets ────────────────────────────────────────────────────────────
export const ML_SIMULATED = ML_REGISTRY.filter(m => m.status === 'simulated');
export const ML_WIRING    = ML_REGISTRY.filter(m => m.status === 'wiring');
export const ML_TRAINING  = ML_REGISTRY.filter(m => m.status === 'training');
export const ML_DEPLOYED  = ML_REGISTRY.filter(m => m.status === 'deployed');

// ── Priority buckets ──────────────────────────────────────────────────────────
export const ML_P1 = ML_REGISTRY.filter(m => m.priority === 1);  // Critical path
export const ML_P2 = ML_REGISTRY.filter(m => m.priority === 2);  // Standard
export const ML_P3 = ML_REGISTRY.filter(m => m.priority === 3);  // Nice-to-have

// ── Batch / placement helpers ─────────────────────────────────────────────────
export const ML_REAL_TIME = ML_REGISTRY.filter(m => m.batch === 1);
export const ML_HYBRID    = ML_REGISTRY.filter(m => m.batch === 2);
export const ML_BATCH     = ML_REGISTRY.filter(m => m.batch === 3);
export const ML_ALWAYS_ON = ML_REGISTRY.filter(m =>
  m.guardrails.some(g => g.includes('NEVER disabled'))
);
