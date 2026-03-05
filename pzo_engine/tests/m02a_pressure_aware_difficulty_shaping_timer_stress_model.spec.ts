import { describe, expect, it } from 'vitest';

import {
  M02A_ML_CONSTANTS,
  resetM02aRuntime,
  runM02aMl,
  runM02aMlFallback,
  type M02ATelemetryInput,
} from '../src/ml/m02a_pressure_aware_difficulty_shaping_timer_stress_model';
import {
  buildDefaultModelCard,
  buildM02aTelemetryInput,
  runM02aAfterClockResolve,
} from '../src/mechanics/m02a_pressure_aware_difficulty_bridge';

const baseInput: M02ATelemetryInput = {
  runSeed: 'seed-alpha',
  tickIndex: 88,
  rulesetVersion: 'rules-v1',
  macroRegime: 'CRISIS',
  portfolioSnapshot: {
    assets: [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }],
    debts: [{ id: 'd1' }, { id: 'd2' }],
    pendingChoices: 3,
  },
  actionTimeline: [
    { type: 'menu_inspect', atMs: 1000, decisionMs: 900 },
    { type: 'auction_confirm', atMs: 2600, decisionMs: 2200 },
    { type: 'cancel', atMs: 6100, decisionMs: 4700 },
    { type: 'timeout_warning', atMs: 9900, decisionMs: 5600 },
  ],
  uiInteraction: {
    latencyMs: [180, 420, 880, 1050],
    jitterMs: [22, 80, 150],
  },
  socialEvents: [],
  outcomeEvents: [{ type: 'late_penalty' }, { type: 'loss' }],
  ledgerEvents: [{ type: 'wipe_warning' }],
  userOptIn: { balance_nudges: true },
};

describe('M02A timer stress model', () => {
  it('is deterministic for the same input and model card', async () => {
    resetM02aRuntime();
    const modelCard = buildDefaultModelCard('rules-v1', 'baseline');

    const a = await runM02aMl(baseInput, 'baseline', modelCard);
    resetM02aRuntime();
    const b = await runM02aMl(baseInput, 'baseline', modelCard);

    expect(a.auditHash).toBe(b.auditHash);
    expect(a.stressScore).toBe(b.stressScore);
    expect(a.difficultyEnvelopeDelta).toBe(b.difficultyEnvelopeDelta);
  });

  it('locks nudges off in competitive mode', async () => {
    resetM02aRuntime();
    const modelCard = buildDefaultModelCard('rules-v1', 'policy_rl');

    const output = await runM02aMl(
      {
        ...baseInput,
        userOptIn: { competitive_mode: true, balance_nudges: true },
      },
      'policy_rl',
      modelCard,
    );

    expect(output.lockOffApplied).toBe(true);
    expect(output.difficultyEnvelopeDelta).toBe(0);
  });

  it('flags high lag and keeps fallback valid', async () => {
    resetM02aRuntime();
    const fallback = runM02aMlFallback({
      ...baseInput,
      uiInteraction: { latencyMs: [1200, 1600, 2000], pingMs: [900, 1100] },
    });

    expect(fallback.lagFlag).toBe(true);
    expect(fallback.auditHash).toHaveLength(64);
    expect(fallback.score).toBe(0.5);
  });

  it('bridges M02 output into legacy companion shape', async () => {
    resetM02aRuntime();

    const telemetryInput = buildM02aTelemetryInput(
      {
        runId: 'run-1',
        runSeed: 'seed-alpha',
        rulesetVersion: 'rules-v1',
        macroRegime: 'BEAR',
        portfolioSnapshot: baseInput.portfolioSnapshot,
        actionTimeline: baseInput.actionTimeline,
        uiInteraction: baseInput.uiInteraction,
        socialEvents: [],
        outcomeEvents: baseInput.outcomeEvents,
        ledgerEvents: baseInput.ledgerEvents,
        userOptIn: { balance_nudges: true },
      },
      {
        tickResult: { tick: 91, runPhase: 'LATE', timerExpired: false },
        phaseTransitionEvent: null,
        timerExpiredEvent: null,
      },
    );

    expect(telemetryInput.tickIndex).toBe(91);

    const bridged = await runM02aAfterClockResolve(
      {
        runId: 'run-1',
        runSeed: 'seed-alpha',
        rulesetVersion: 'rules-v1',
        macroRegime: 'BEAR',
        portfolioSnapshot: baseInput.portfolioSnapshot,
        actionTimeline: baseInput.actionTimeline,
        uiInteraction: baseInput.uiInteraction,
        socialEvents: [],
        outcomeEvents: baseInput.outcomeEvents,
        ledgerEvents: baseInput.ledgerEvents,
        userOptIn: { balance_nudges: true },
      },
      {
        tickResult: { tick: 91, runPhase: 'LATE', timerExpired: false },
        phaseTransitionEvent: null,
        timerExpiredEvent: null,
      },
      'sequence_dl',
      {
        ...buildDefaultModelCard('rules-v1', 'sequence_dl'),
        featureSchemaHash: M02A_ML_CONSTANTS.SCHEMA_HASH,
      },
    );

    expect(bridged.mlOutput.auditHash).toHaveLength(64);
    expect(bridged.legacyCompanionOutput.auditHash).toBe(bridged.mlOutput.auditHash);
  });
});
