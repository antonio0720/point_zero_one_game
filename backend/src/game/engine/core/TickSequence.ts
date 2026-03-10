/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/TickSequence.ts
 *
 * Doctrine:
 * - tick order is law
 * - engine order must be explicit, validated, and queryable
 * - orchestration, engine execution, telemetry, and sealing are separate phases
 * - any accidental reordering should fail loudly at module load
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

export type TickStepPhase =
  | 'ORCHESTRATION'
  | 'ENGINE'
  | 'MODE'
  | 'OBSERVABILITY'
  | 'FINALIZATION';

export type TickStepOwner =
  | 'system'
  | 'time'
  | 'pressure'
  | 'tension'
  | 'battle'
  | 'shield'
  | 'cascade'
  | 'mode'
  | 'telemetry'
  | 'sovereignty';

export interface TickStepDescriptor {
  readonly step: TickStep;
  readonly ordinal: number;
  readonly phase: TickStepPhase;
  readonly owner: TickStepOwner;
  readonly mutatesState: boolean;
  readonly description: string;
}

export const TICK_SEQUENCE: readonly TickStep[] = Object.freeze([
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
]);

export const ENGINE_EXECUTION_STEPS: readonly TickStep[] = Object.freeze([
  'STEP_02_TIME',
  'STEP_03_PRESSURE',
  'STEP_04_TENSION',
  'STEP_05_BATTLE',
  'STEP_06_SHIELD',
  'STEP_07_CASCADE',
]);

export const TICK_STEP_DESCRIPTORS: Readonly<
  Record<TickStep, TickStepDescriptor>
> = Object.freeze({
  STEP_01_PREPARE: {
    step: 'STEP_01_PREPARE',
    ordinal: 1,
    phase: 'ORCHESTRATION',
    owner: 'system',
    mutatesState: true,
    description:
      'Freeze inputs, normalize transient state, and establish trace context.',
  },

  STEP_02_TIME: {
    step: 'STEP_02_TIME',
    ordinal: 2,
    phase: 'ENGINE',
    owner: 'time',
    mutatesState: true,
    description:
      'Advance authoritative time budget, cadence, and active decision windows.',
  },

  STEP_03_PRESSURE: {
    step: 'STEP_03_PRESSURE',
    ordinal: 3,
    phase: 'ENGINE',
    owner: 'pressure',
    mutatesState: true,
    description:
      'Recompute pressure score, cadence tier, crossings, and escalation state.',
  },

  STEP_04_TENSION: {
    step: 'STEP_04_TENSION',
    ordinal: 4,
    phase: 'ENGINE',
    owner: 'tension',
    mutatesState: true,
    description:
      'Refresh anticipation, visible threat envelopes, and pulse conditions.',
  },

  STEP_05_BATTLE: {
    step: 'STEP_05_BATTLE',
    ordinal: 5,
    phase: 'ENGINE',
    owner: 'battle',
    mutatesState: true,
    description:
      'Resolve hostile bot posture, injected attacks, and extraction pressure.',
  },

  STEP_06_SHIELD: {
    step: 'STEP_06_SHIELD',
    ordinal: 6,
    phase: 'ENGINE',
    owner: 'shield',
    mutatesState: true,
    description:
      'Apply damage, regen, breach accounting, and weakest-layer recomputation.',
  },

  STEP_07_CASCADE: {
    step: 'STEP_07_CASCADE',
    ordinal: 7,
    phase: 'ENGINE',
    owner: 'cascade',
    mutatesState: true,
    description:
      'Progress positive and negative chains, spawn follow-on links, and mark breaks/completions.',
  },

  STEP_08_MODE_POST: {
    step: 'STEP_08_MODE_POST',
    ordinal: 8,
    phase: 'MODE',
    owner: 'mode',
    mutatesState: true,
    description:
      'Apply mode-native reconciliation after core engine execution.',
  },

  STEP_09_TELEMETRY: {
    step: 'STEP_09_TELEMETRY',
    ordinal: 9,
    phase: 'OBSERVABILITY',
    owner: 'telemetry',
    mutatesState: true,
    description:
      'Materialize decision telemetry, audit hints, and event-facing summaries.',
  },

  STEP_10_SOVEREIGNTY_SNAPSHOT: {
    step: 'STEP_10_SOVEREIGNTY_SNAPSHOT',
    ordinal: 10,
    phase: 'OBSERVABILITY',
    owner: 'sovereignty',
    mutatesState: true,
    description:
      'Compute deterministic checksums, integrity status, and proof-facing snapshot data.',
  },

  STEP_11_OUTCOME_GATE: {
    step: 'STEP_11_OUTCOME_GATE',
    ordinal: 11,
    phase: 'FINALIZATION',
    owner: 'system',
    mutatesState: true,
    description:
      'Evaluate terminal conditions, freedom targets, timeout, bankruptcy, and quarantine exits.',
  },

  STEP_12_EVENT_SEAL: {
    step: 'STEP_12_EVENT_SEAL',
    ordinal: 12,
    phase: 'FINALIZATION',
    owner: 'system',
    mutatesState: true,
    description:
      'Seal tick outputs into canonical event order for proof and replay stability.',
  },

  STEP_13_FLUSH: {
    step: 'STEP_13_FLUSH',
    ordinal: 13,
    phase: 'FINALIZATION',
    owner: 'system',
    mutatesState: true,
    description:
      'Flush pending buffers and finalize the tick boundary for the next cycle.',
  },
});

const TICK_INDEX_BY_STEP: Readonly<Record<TickStep, number>> = Object.freeze(
  TICK_SEQUENCE.reduce<Record<TickStep, number>>((accumulator, step, index) => {
    accumulator[step] = index;
    return accumulator;
  }, {} as Record<TickStep, number>),
);

export function isTickStep(value: string): value is TickStep {
  return Object.prototype.hasOwnProperty.call(TICK_INDEX_BY_STEP, value);
}

export function getTickStepIndex(step: TickStep): number {
  return TICK_INDEX_BY_STEP[step];
}

export function getTickStepDescriptor(step: TickStep): TickStepDescriptor {
  return TICK_STEP_DESCRIPTORS[step];
}

export function getNextTickStep(step: TickStep): TickStep | null {
  const nextIndex = getTickStepIndex(step) + 1;
  return nextIndex < TICK_SEQUENCE.length ? TICK_SEQUENCE[nextIndex] : null;
}

export function getPreviousTickStep(step: TickStep): TickStep | null {
  const previousIndex = getTickStepIndex(step) - 1;
  return previousIndex >= 0 ? TICK_SEQUENCE[previousIndex] : null;
}

export function isEngineExecutionStep(step: TickStep): boolean {
  return ENGINE_EXECUTION_STEPS.includes(step);
}

export function assertValidTickSequence(
  sequence: readonly TickStep[] = TICK_SEQUENCE,
): void {
  if (sequence.length !== TICK_SEQUENCE.length) {
    throw new Error(
      `Invalid tick sequence length. Expected ${TICK_SEQUENCE.length}, received ${sequence.length}.`,
    );
  }

  const seen = new Set<TickStep>();

  for (let index = 0; index < sequence.length; index += 1) {
    const step = sequence[index];
    const expected = TICK_SEQUENCE[index];

    if (step !== expected) {
      throw new Error(
        `Tick sequence mismatch at index ${index}. Expected ${expected}, received ${step}.`,
      );
    }

    if (seen.has(step)) {
      throw new Error(`Duplicate tick step detected: ${step}`);
    }

    seen.add(step);

    const descriptor = TICK_STEP_DESCRIPTORS[step];
    if (!descriptor) {
      throw new Error(`Missing tick descriptor for step: ${step}`);
    }

    if (descriptor.ordinal !== index + 1) {
      throw new Error(
        `Descriptor ordinal mismatch for ${step}. Expected ${index + 1}, received ${descriptor.ordinal}.`,
      );
    }
  }

  if (sequence[0] !== 'STEP_01_PREPARE') {
    throw new Error('Tick sequence must begin with STEP_01_PREPARE.');
  }

  if (sequence[sequence.length - 1] !== 'STEP_13_FLUSH') {
    throw new Error('Tick sequence must end with STEP_13_FLUSH.');
  }
}

assertValidTickSequence();