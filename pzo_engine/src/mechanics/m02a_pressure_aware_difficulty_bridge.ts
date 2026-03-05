// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo_engine/src/mechanics/m02a_pressure_aware_difficulty_bridge.ts
// Bridge layer for M02A ↔ M02 integration.
// Density6 LLC · Point Zero One · Confidential · All Rights Reserved
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  M02AOutput,
  M02AModelCard,
  M02ATelemetryInput,
  M02ATier,
} from '../ml/m02a_pressure_aware_difficulty_shaping_timer_stress_model';
import {
  M02A_ML_CONSTANTS,
  runM02aMl,
  runM02aMlFallback,
} from '../ml/m02a_pressure_aware_difficulty_shaping_timer_stress_model';
import { RUN_TOTAL_TICKS, clamp } from './mechanicsUtils';
import type { MacroRegime, TickResult } from './types';
import type {
  M02MLOutput,
  M02Output,
} from './m02_12_minute_run_clock_turn_timer';

export interface M02ABridgeRunSnapshot {
  runId: string;
  runSeed: string;
  rulesetVersion: string;
  macroRegime?: MacroRegime | string;
  portfolioSnapshot?: Record<string, unknown>;
  actionTimeline?: Record<string, unknown>[];
  uiInteraction?: Record<string, unknown>;
  socialEvents?: Record<string, unknown>[];
  outcomeEvents?: Record<string, unknown>[];
  ledgerEvents?: Record<string, unknown>[];
  userOptIn?: Record<string, boolean>;
}

export interface M02ABridgeResult {
  telemetryInput: M02ATelemetryInput;
  mlOutput: M02AOutput;
  legacyCompanionOutput: M02MLOutput;
}

export function buildM02aTelemetryInput(
  snapshot: M02ABridgeRunSnapshot,
  m02Output?: M02Output,
): M02ATelemetryInput {
  const tickResult: TickResult | undefined = m02Output?.tickResult;

  return {
    runSeed: String(snapshot.runSeed ?? snapshot.runId ?? ''),
    tickIndex: clamp(Math.floor(Number(tickResult?.tick ?? 0)), 0, RUN_TOTAL_TICKS - 1),
    rulesetVersion: String(snapshot.rulesetVersion ?? M02A_ML_CONSTANTS.RULES_VERSION),
    macroRegime: String(snapshot.macroRegime ?? 'NEUTRAL'),
    portfolioSnapshot: sanitizeRecord(snapshot.portfolioSnapshot),
    actionTimeline: sanitizeArray(snapshot.actionTimeline),
    uiInteraction: sanitizeRecord(snapshot.uiInteraction),
    socialEvents: sanitizeArray(snapshot.socialEvents),
    outcomeEvents: sanitizeArray([
      ...(snapshot.outcomeEvents ?? []),
      ...deriveSyntheticOutcomeEvents(m02Output),
    ]),
    ledgerEvents: sanitizeArray(snapshot.ledgerEvents),
    userOptIn: sanitizeBooleanMap(snapshot.userOptIn),
  };
}

export async function runM02aAfterClockResolve(
  snapshot: M02ABridgeRunSnapshot,
  m02Output: M02Output,
  tier: M02ATier = 'baseline',
  modelCard?: Omit<M02AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M02ABridgeResult> {
  const telemetryInput = buildM02aTelemetryInput(snapshot, m02Output);
  const resolvedModelCard = modelCard ?? buildDefaultModelCard(snapshot.rulesetVersion, tier);

  let mlOutput: M02AOutput;
  try {
    mlOutput = await runM02aMl(telemetryInput, tier, resolvedModelCard);
  } catch {
    mlOutput = runM02aMlFallback(telemetryInput);
  }

  return {
    telemetryInput,
    mlOutput,
    legacyCompanionOutput: toLegacyM02CompanionOutput(mlOutput),
  };
}

export function toLegacyM02CompanionOutput(output: M02AOutput): M02MLOutput {
  return {
    score: output.score,
    topFactors: output.topFactors,
    recommendation: output.recommendation,
    auditHash: output.auditHash,
    confidenceDecay: output.confidenceDecay,
  };
}

export function buildDefaultModelCard(
  rulesetVersion: string,
  tier: M02ATier,
): Omit<M02AModelCard, 'modelId' | 'coreMechanicPair'> {
  return {
    intelligenceSignal: 'personalization',
    modelCategory: 'controller',
    family: 'balance',
    tier,
    modelVersion:
      tier === 'policy_rl'
        ? 'm02a-policy-1.0.0'
        : tier === 'sequence_dl'
          ? 'm02a-sequence-1.0.0'
          : 'm02a-baseline-1.0.0',
    trainCutDate: '2026-03-05',
    featureSchemaHash: M02A_ML_CONSTANTS.SCHEMA_HASH,
    rulesetVersion: String(rulesetVersion ?? M02A_ML_CONSTANTS.RULES_VERSION),
  };
}

function deriveSyntheticOutcomeEvents(m02Output?: M02Output): Record<string, unknown>[] {
  if (!m02Output) return [];
  return [
    {
      type: 'm02_tick_result',
      tick: m02Output.tickResult.tick,
      runPhase: m02Output.tickResult.runPhase,
      timerExpired: m02Output.tickResult.timerExpired,
    },
    ...(m02Output.phaseTransitionEvent
      ? [
          {
            type: 'm02_phase_transition',
            from: m02Output.phaseTransitionEvent.from,
            to: m02Output.phaseTransitionEvent.to,
          },
        ]
      : []),
    ...(m02Output.timerExpiredEvent
      ? [
          {
            type: 'm02_timer_expired',
            tick: m02Output.timerExpiredEvent.tick,
            expired: true,
          },
        ]
      : []),
  ];
}

function sanitizeRecord(value: Record<string, unknown> | undefined): Record<string, unknown> {
  return value && typeof value === 'object' ? { ...value } : {};
}

function sanitizeArray(value: Record<string, unknown>[] | undefined): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map((item) => ({ ...item })) : [];
}

function sanitizeBooleanMap(value: Record<string, boolean> | undefined): Record<string, boolean> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, boolean> = {};
  for (const [key, item] of Object.entries(value)) out[key] = Boolean(item);
  return out;
}
