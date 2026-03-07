/**
 * Commerce Governance — Experiment Engine
 * backend/src/api-gateway/commerce_governance/experiment_engine.ts
 *
 * Enforces: forbidden variables blocked, control/holdout minimums,
 * max concurrent experiments, guardrail auto-kill, experiment isolation.
 *
 * Density6 LLC · Point Zero One · Confidential
 */

import {
  Experiment, ExperimentStatus, AllowedExperimentVariable,
  GuardrailMetric, PolicyRules,
} from './types';

const FORBIDDEN_VARIABLES = new Set<string>([
  'WIN_PROBABILITY', 'CARD_DRAW_ODDS', 'DAMAGE_MULTIPLIER',
  'SHIELD_STRENGTH', 'PRESSURE_SCORING', 'CORD_FORMULA',
  'SEED_SELECTION', 'MATCHMAKING_BIAS',
]);

const ALLOWED_VARIABLES = new Set<string>([
  'PRICE', 'OFFER_TIMING', 'BUNDLE_COMPOSITION',
  'DISCOUNT_PCT', 'UI_PLACEMENT', 'COPY_VARIANT',
]);

export interface ExperimentValidationResult {
  valid: boolean;
  violations: Array<{ code: string; message: string; severity: 'BLOCK' | 'WARN' }>;
}

/**
 * Validate an experiment definition against governance rules.
 */
export function validateExperiment(
  experiment: Partial<Experiment>,
  rules: PolicyRules,
  activeExperimentCount: number,
): ExperimentValidationResult {
  const violations: ExperimentValidationResult['violations'] = [];

  // ── HARD BLOCK: Forbidden variable ──────────────────────────────────────
  const variable = experiment.variable ?? '';
  if (FORBIDDEN_VARIABLES.has(variable)) {
    violations.push({
      code: 'FORBIDDEN_VARIABLE',
      message: `Variable '${variable}' is permanently forbidden. Experiments cannot modify game outcomes.`,
      severity: 'BLOCK',
    });
  }

  // ── HARD BLOCK: Unknown variable ────────────────────────────────────────
  if (!ALLOWED_VARIABLES.has(variable) && !FORBIDDEN_VARIABLES.has(variable)) {
    violations.push({
      code: 'UNKNOWN_VARIABLE',
      message: `Variable '${variable}' is not in the allowed experiment variable list.`,
      severity: 'BLOCK',
    });
  }

  // ── HARD BLOCK: Control group too small ─────────────────────────────────
  const controlPct = experiment.controlPct ?? 0;
  if (controlPct < rules.minControlGroupPct) {
    violations.push({
      code: 'CONTROL_GROUP_TOO_SMALL',
      message: `Control group ${controlPct}% is below minimum ${rules.minControlGroupPct}%.`,
      severity: 'BLOCK',
    });
  }

  // ── HARD BLOCK: Holdout group too small ─────────────────────────────────
  const holdoutPct = experiment.holdoutPct ?? 0;
  if (holdoutPct < rules.minHoldoutGroupPct) {
    violations.push({
      code: 'HOLDOUT_GROUP_TOO_SMALL',
      message: `Holdout group ${holdoutPct}% is below minimum ${rules.minHoldoutGroupPct}%.`,
      severity: 'BLOCK',
    });
  }

  // ── HARD BLOCK: Group percentages don't sum to 100 ──────────────────────
  const treatmentPct = experiment.treatmentPct ?? 0;
  const totalPct = controlPct + treatmentPct + holdoutPct;
  if (Math.abs(totalPct - 100) > 0.01) {
    violations.push({
      code: 'GROUP_PERCENTAGES_INVALID',
      message: `Control (${controlPct}%) + Treatment (${treatmentPct}%) + Holdout (${holdoutPct}%) = ${totalPct}%, must equal 100%.`,
      severity: 'BLOCK',
    });
  }

  // ── HARD BLOCK: Max concurrent experiments ──────────────────────────────
  if (activeExperimentCount >= rules.maxConcurrentExperiments) {
    violations.push({
      code: 'MAX_CONCURRENT_EXPERIMENTS',
      message: `${activeExperimentCount} experiments already running (max: ${rules.maxConcurrentExperiments}). Conclude or kill one first.`,
      severity: 'BLOCK',
    });
  }

  // ── HARD BLOCK: No guardrail metrics ────────────────────────────────────
  const guardrails = experiment.guardrailMetrics ?? [];
  if (guardrails.length === 0) {
    violations.push({
      code: 'NO_GUARDRAILS',
      message: 'Every experiment must have at least one guardrail metric for auto-kill protection.',
      severity: 'BLOCK',
    });
  }

  // ── HARD BLOCK: Missing primary metric ──────────────────────────────────
  if (!experiment.primaryMetric || experiment.primaryMetric.trim().length === 0) {
    violations.push({
      code: 'NO_PRIMARY_METRIC',
      message: 'A primary success metric is required.',
      severity: 'BLOCK',
    });
  }

  // ── WARN: High discount in DISCOUNT_PCT experiment ──────────────────────
  if (variable === 'DISCOUNT_PCT') {
    violations.push({
      code: 'DISCOUNT_EXPERIMENT_WARNING',
      message: 'Discount experiments are capped at the policy maxDiscountPct. Verify treatment values comply.',
      severity: 'WARN',
    });
  }

  return {
    valid: violations.filter(v => v.severity === 'BLOCK').length === 0,
    violations,
  };
}

/**
 * Check guardrail metrics against current values.
 * Returns the first breached guardrail, or null if all clear.
 */
export function checkGuardrails(
  guardrails: GuardrailMetric[],
  currentValues: Record<string, number>,
): GuardrailMetric | null {
  for (const g of guardrails) {
    const current = currentValues[g.metricName];
    if (current === undefined) continue;

    if (g.direction === 'ABOVE' && current > g.threshold) return g;
    if (g.direction === 'BELOW' && current < g.threshold) return g;
  }
  return null;
}

/**
 * Determine which experiment group a player falls into.
 * Uses stable hashing so assignments are deterministic.
 */
export function assignExperimentGroup(
  playerId: string,
  experimentId: string,
  controlPct: number,
  treatmentPct: number,
): 'CONTROL' | 'TREATMENT' | 'HOLDOUT' {
  // FNV-1a hash for deterministic, fast assignment
  let hash = 2166136261;
  const input = `${playerId}:${experimentId}`;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const bucket = Math.abs(hash) % 100;

  if (bucket < controlPct) return 'CONTROL';
  if (bucket < controlPct + treatmentPct) return 'TREATMENT';
  return 'HOLDOUT';
}