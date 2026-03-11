// FILE: backend/src/game/engine/core/__tests__/EngineRuntime.tension.spec.ts

import { describe, expect, it } from 'vitest';

import { EngineRuntime } from '../EngineRuntime';
import { TensionEngine } from '../../tension/TensionEngine';
import {
  THREAT_SEVERITY,
  THREAT_TYPE,
  TENSION_EVENT_NAMES,
} from '../../tension/types';

let threatSequence = 0;

function createHarness(mode: 'solo' | 'pvp' | 'coop' | 'ghost' = 'solo') {
  const tensionEngine = new TensionEngine();
  const runtime = new EngineRuntime();

  runtime.registerEngine(tensionEngine);

  const started = runtime.startRun({
    runId: `run-${mode}-tension`,
    userId: `user-${mode}`,
    seed: `seed-${mode}-tension`,
    mode,
  });

  return { runtime, tensionEngine, started };
}

function buildThreatInput(
  runId: string,
  currentTick: number,
  overrides: Partial<{
    sourceKey: string;
    threatId: string;
    source: string;
    threatType: string;
    threatSeverity: string;
    arrivalTick: number;
    isCascadeTriggered: boolean;
    cascadeTriggerEventId: string | null;
    worstCaseOutcome: string;
    mitigationCardTypes: readonly string[];
    summary: string;
    severityWeight: number;
  }> = {},
) {
  threatSequence += 1;

  return {
    runId,
    sourceKey: overrides.sourceKey ?? `manual-threat-source-${threatSequence}`,
    threatId: overrides.threatId ?? `manual-threat-${threatSequence}`,
    source: overrides.source ?? 'TEST_HARNESS',
    threatType: (overrides.threatType ??
      THREAT_TYPE.DEBT_SPIRAL) as typeof THREAT_TYPE[keyof typeof THREAT_TYPE],
    threatSeverity: (overrides.threatSeverity ??
      THREAT_SEVERITY.SEVERE) as typeof THREAT_SEVERITY[keyof typeof THREAT_SEVERITY],
    currentTick,
    arrivalTick: overrides.arrivalTick ?? currentTick + 1,
    isCascadeTriggered: overrides.isCascadeTriggered ?? false,
    cascadeTriggerEventId: overrides.cascadeTriggerEventId ?? null,
    worstCaseOutcome:
      overrides.worstCaseOutcome ??
      'Projected recurring income collapse if not contained.',
    mitigationCardTypes:
      overrides.mitigationCardTypes ??
      Object.freeze(['REFINANCE', 'INCOME_SHIELD']),
    summary:
      overrides.summary ?? 'Debt spiral scheduled and visible to the player.',
    severityWeight: overrides.severityWeight,
  };
}

describe('EngineRuntime × TensionEngine', () => {
  it('executes the tension step inside runtime ticks and emits tension events', () => {
    const { runtime, tensionEngine } = createHarness('solo');

    const warmup = runtime.tick();
    expect(warmup.snapshot.tick).toBe(1);
    expect(warmup.snapshot.tension.score).toBe(0);

    const entryId = tensionEngine.enqueueThreat(
      buildThreatInput(warmup.snapshot.runId, warmup.snapshot.tick, {
        arrivalTick: warmup.snapshot.tick + 1,
        summary: 'Debt spiral arrives on the next tick.',
      }),
    );

    expect(typeof entryId).toBe('string');
    expect(tensionEngine.getQueueLength()).toBe(1);

    const second = runtime.tick();
    const eventNames = second.events.map((entry) => String(entry.event));

    expect(second.snapshot.tick).toBe(2);
    expect(second.snapshot.tension.score).toBeGreaterThan(0);
    expect(second.snapshot.tension.anticipation).toBe(1);
    expect(second.snapshot.tension.visibleThreats).toHaveLength(1);
    expect(second.snapshot.tension.maxPulseTriggered).toBe(false);

    expect(eventNames).toEqual(
      expect.arrayContaining([
        TENSION_EVENT_NAMES.QUEUE_UPDATED,
        TENSION_EVENT_NAMES.SCORE_UPDATED,
        TENSION_EVENT_NAMES.THREAT_ARRIVED,
        'tick.completed',
      ]),
    );
  });

  it('applies mitigation relief on the next runtime tick after an arrived threat is resolved', () => {
    const { runtime, tensionEngine } = createHarness('solo');

    const warmup = runtime.tick();

    const entryId = tensionEngine.enqueueThreat(
      buildThreatInput(warmup.snapshot.runId, warmup.snapshot.tick, {
        threatType: THREAT_TYPE.SABOTAGE,
        threatSeverity: THREAT_SEVERITY.CRITICAL,
        arrivalTick: warmup.snapshot.tick + 1,
        summary: 'Sabotage window opens next tick.',
        worstCaseOutcome: 'Liquidity channel is wiped if the action window is missed.',
        mitigationCardTypes: Object.freeze(['COUNTER_PLAY', 'LEGAL_DEFENSE']),
      }),
    );

    const arrivedTick = runtime.tick();
    const scoreAtArrival = arrivedTick.snapshot.tension.score;

    expect(scoreAtArrival).toBeGreaterThan(0);
    expect(arrivedTick.snapshot.tension.visibleThreats).toHaveLength(1);

    const mitigated = tensionEngine.mitigateThreat(entryId, arrivedTick.snapshot.tick);
    expect(mitigated).toBe(true);

    const relievedTick = runtime.tick();

    expect(relievedTick.snapshot.tension.score).toBeLessThan(scoreAtArrival);
    expect(relievedTick.snapshot.tension.anticipation).toBe(0);
    expect(relievedTick.snapshot.tension.visibleThreats).toHaveLength(0);
  });

  it('does not let the tension step write battle attacks directly inside EngineRuntime', () => {
    const { runtime, tensionEngine } = createHarness('solo');

    const warmup = runtime.tick();

    tensionEngine.enqueueThreat(
      buildThreatInput(warmup.snapshot.runId, warmup.snapshot.tick, {
        threatType: THREAT_TYPE.REPUTATION_BURN,
        threatSeverity: THREAT_SEVERITY.MODERATE,
        arrivalTick: warmup.snapshot.tick + 1,
        summary: 'Heat-focused threat becomes active next tick.',
        worstCaseOutcome: 'Long-tail brand drag begins if ignored.',
        mitigationCardTypes: Object.freeze(['PR_SHIELD']),
      }),
    );

    const result = runtime.tick();

    expect(result.snapshot.tension.visibleThreats).toHaveLength(1);
    expect(result.snapshot.battle.pendingAttacks).toEqual([]);
    expect(result.snapshot.battle.pendingAttacks).toHaveLength(0);
  });
});