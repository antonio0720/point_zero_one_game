/*
 * POINT ZERO ONE — BACKEND ENGINE 15X GENERATOR
 * Generated at: 2026-03-10T01:00:08.825776+00:00
 *
 * Doctrine:
 * - backend becomes the authoritative simulation surface
 * - seven engines remain distinct
 * - mode-native rules are enforced at runtime
 * - cards are backend-validated, not UI-trusted
 * - proof / integrity / CORD remain backend-owned
 */

export type TickStep =
  | 'STEP_01_PREPARE'
  | 'STEP_02_TIME'
  | 'STEP_03_PRESSURE'
  | 'STEP_04_TENSION'
  | 'STEP_05_BATTLE'
  | 'STEP_06_SHIELD'
  | 'STEP_07_CASCADE'
  | 'STEP_08_MODE_POST'
  | 'STEP_09_TELEMETRY'
  | 'STEP_10_SOVEREIGNTY_SNAPSHOT'
  | 'STEP_11_OUTCOME_GATE'
  | 'STEP_12_EVENT_SEAL'
  | 'STEP_13_FLUSH';

export const TICK_SEQUENCE: TickStep[] = [
  'STEP_01_PREPARE',
  'STEP_02_TIME',
  'STEP_03_PRESSURE',
  'STEP_04_TENSION',
  'STEP_05_BATTLE',
  'STEP_06_SHIELD',
  'STEP_07_CASCADE',
  'STEP_08_MODE_POST',
  'STEP_09_TELEMETRY',
  'STEP_10_SOVEREIGNTY_SNAPSHOT',
  'STEP_11_OUTCOME_GATE',
  'STEP_12_EVENT_SEAL',
  'STEP_13_FLUSH',
];
