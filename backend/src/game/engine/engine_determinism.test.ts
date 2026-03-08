///Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/game/engine/engine_determinism.test.ts

import { beforeEach, describe, expect, it } from 'vitest';
import {
  __resetEngineStateForTests,
  createRun,
  finalizeRun,
  replayRun,
  submitTurnDecision,
  type DecisionEffect,
  type Ledger,
  type SubmitTurnDecisionRequest,
} from './index';

interface DeterminismInput {
  readonly initialLedger: Ledger;
  readonly turns: readonly SubmitTurnDecisionRequest[];
}

function normalizeSeed(seed: number): number {
  const value = Math.abs(Math.trunc(seed)) >>> 0;
  return value === 0 ? 0x9e3779b9 : value;
}

function createMulberry32(seed: number): () => number {
  let state = normalizeSeed(seed);

  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

function generateEffects(rng: () => number): readonly DecisionEffect[] {
  const targets: DecisionEffect['target'][] = [
    'cash',
    'income',
    'expenses',
    'shield',
    'heat',
    'trust',
    'divergence',
    'cords',
  ];

  const effectCount = 1 + Math.floor(rng() * 3);
  const effects: DecisionEffect[] = [];

  for (let i = 0; i < effectCount; i += 1) {
    const target = targets[Math.floor(rng() * targets.length)];
    const sign = rng() > 0.5 ? 1 : -1;
    const magnitudeBase =
      target === 'cash' || target === 'income' || target === 'expenses'
        ? 25 + Math.floor(rng() * 400)
        : 1 + Math.floor(rng() * 8);

    effects.push({
      target,
      delta: roundTo2(sign * magnitudeBase),
    });
  }

  return effects;
}

function generateInputData(seed: number): DeterminismInput {
  const rng = createMulberry32(seed);

  const initialLedger: Ledger = {
    cash: roundTo2(1000 + rng() * 2000),
    income: roundTo2(100 + rng() * 500),
    expenses: roundTo2(50 + rng() * 350),
    shield: roundTo2(rng() * 10),
    heat: roundTo2(rng() * 5),
    trust: roundTo2(40 + rng() * 20),
    divergence: roundTo2(rng() * 3),
    cords: roundTo2(rng() * 2),
    turn: 0,
  };

  const turnCount = 8 + Math.floor(rng() * 8);
  const turns: SubmitTurnDecisionRequest[] = [];

  for (let turnIndex = 0; turnIndex < turnCount; turnIndex += 1) {
    turns.push({
      turnIndex,
      choiceId: `choice_${Math.floor(rng() * 5)}`,
      sourceCardInstanceId: `card_${turnIndex}_${Math.floor(rng() * 1000)}`,
      effects: generateEffects(rng),
    });
  }

  return {
    initialLedger,
    turns,
  };
}

async function runSingleDeterministicFlow(
  inputData: DeterminismInput,
  seed: number,
): Promise<Buffer> {
  const runId = await createRun(seed, inputData.initialLedger);

  for (const turn of inputData.turns) {
    await submitTurnDecision(runId, turn);
  }

  const finalized = await finalizeRun(runId);
  const replayed = await replayRun(runId);

  expect(replayed.replayHash).toBe(finalized.replayHash);
  expect(replayed.snapshot).toEqual(finalized.snapshot);

  return Buffer.from(finalized.replayBytesBase64, 'base64');
}

async function runGameWithSeed(
  inputData: DeterminismInput,
  seed: number,
): Promise<[Buffer, Buffer]> {
  __resetEngineStateForTests();
  const firstOutput = await runSingleDeterministicFlow(inputData, seed);

  __resetEngineStateForTests();
  const secondOutput = await runSingleDeterministicFlow(inputData, seed);

  return [firstOutput, secondOutput];
}

describe('Engine Determinism Test', () => {
  beforeEach(() => {
    __resetEngineStateForTests();
  });

  const seedCount = Number(process.env.PZO_DETERMINISM_SEED_COUNT ?? 128);
  const seeds = Array.from({ length: seedCount }, (_, i) => i);

  for (const seed of seeds) {
    it(`should produce identical output for seed ${seed}`, async () => {
      const inputData = generateInputData(seed);
      const [firstOutput, secondOutput] = await runGameWithSeed(
        inputData,
        seed * 2 + 17,
      );

      expect(firstOutput.equals(secondOutput)).toBe(true);
    });
  }

  it('should produce different replay bytes for different seeds under the same harness', async () => {
    const firstInput = generateInputData(11);
    const secondInput = generateInputData(12);

    __resetEngineStateForTests();
    const firstOutput = await runSingleDeterministicFlow(firstInput, 101);

    __resetEngineStateForTests();
    const secondOutput = await runSingleDeterministicFlow(secondInput, 102);

    expect(firstOutput.equals(secondOutput)).toBe(false);
  });
});