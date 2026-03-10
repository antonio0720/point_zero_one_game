/**
 * backend/src/game/engine/engine_determinism.test.ts
 *
 * Determinism harness for backend replay/runtime surfaces.
 *
 * Guarantees:
 * - same input + same seed => byte-identical replay output
 * - same input + different seed => different replay output
 * - finalizeRun and replayRun agree on hash and snapshot
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createDeterministicRng } from './deterministic_rng';
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

interface DeterminismOutput {
  readonly replayBytes: Buffer;
  readonly replayHash: string;
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

function generateEffects(
  rng: ReturnType<typeof createDeterministicRng>,
): readonly DecisionEffect[] {
  const targets: ReadonlyArray<DecisionEffect['target']> = [
    'cash',
    'income',
    'expenses',
    'shield',
    'heat',
    'trust',
    'divergence',
    'cords',
  ];

  const effectCount = 1 + rng.nextInt(3);
  const effects: DecisionEffect[] = [];

  for (let i = 0; i < effectCount; i += 1) {
    const target = targets[rng.nextInt(targets.length)];
    const sign = rng.nextBoolean() ? 1 : -1;
    const isMonetary =
      target === 'cash' || target === 'income' || target === 'expenses';

    const magnitudeBase = isMonetary
      ? 25 + rng.nextInt(400)
      : 1 + rng.nextInt(8);

    effects.push({
      target,
      delta: roundTo2(sign * magnitudeBase),
    });
  }

  return effects;
}

function generateInputData(seed: number): DeterminismInput {
  const rng = createDeterministicRng(seed);

  const initialLedger: Ledger = {
    cash: roundTo2(1000 + rng.next() * 2000),
    income: roundTo2(100 + rng.next() * 500),
    expenses: roundTo2(50 + rng.next() * 350),
    shield: roundTo2(rng.next() * 10),
    heat: roundTo2(rng.next() * 5),
    trust: roundTo2(40 + rng.next() * 20),
    divergence: roundTo2(rng.next() * 3),
    cords: roundTo2(rng.next() * 2),
    turn: 0,
  };

  const turnCount = 8 + rng.nextInt(8);
  const turns: SubmitTurnDecisionRequest[] = [];

  for (let turnIndex = 0; turnIndex < turnCount; turnIndex += 1) {
    turns.push({
      turnIndex,
      choiceId: `choice_${rng.nextInt(5)}`,
      sourceCardInstanceId: `card_${turnIndex}_${rng.nextInt(1000)}`,
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
): Promise<DeterminismOutput> {
  const runId = await createRun(seed, inputData.initialLedger);

  for (const turn of inputData.turns) {
    await submitTurnDecision(runId, turn);
  }

  const finalized = await finalizeRun(runId);
  const replayed = await replayRun(runId);

  expect(replayed.replayHash).toBe(finalized.replayHash);
  expect(replayed.snapshot).toEqual(finalized.snapshot);
  expect(finalized.snapshot.finalized).toBe(true);
  expect(finalized.snapshot.turnCount).toBe(inputData.turns.length);

  return {
    replayBytes: Buffer.from(finalized.replayBytesBase64, 'base64'),
    replayHash: finalized.replayHash,
  };
}

async function runGameWithSeed(
  inputData: DeterminismInput,
  seed: number,
): Promise<[DeterminismOutput, DeterminismOutput]> {
  __resetEngineStateForTests();
  const firstOutput = await runSingleDeterministicFlow(inputData, seed);

  __resetEngineStateForTests();
  const secondOutput = await runSingleDeterministicFlow(inputData, seed);

  return [firstOutput, secondOutput];
}

describe.sequential('Engine Determinism Test', () => {
  beforeEach(() => {
    __resetEngineStateForTests();
  });

  const requestedSeedCount = Number.parseInt(
    process.env.PZO_DETERMINISM_SEED_COUNT ?? '128',
    10,
  );
  const seedCount =
    Number.isFinite(requestedSeedCount) && requestedSeedCount > 0
      ? requestedSeedCount
      : 128;

  const seeds = Array.from({ length: seedCount }, (_, i) => i);

  for (const seed of seeds) {
    it(`should produce identical output for seed ${seed}`, async () => {
      const inputData = generateInputData(seed);
      const [firstOutput, secondOutput] = await runGameWithSeed(
        inputData,
        seed * 2 + 17,
      );

      expect(firstOutput.replayHash).toBe(secondOutput.replayHash);
      expect(firstOutput.replayBytes.equals(secondOutput.replayBytes)).toBe(true);
    });
  }

  it('should produce different replay bytes for the same input when the seed changes', async () => {
    const inputData = generateInputData(11);

    __resetEngineStateForTests();
    const firstOutput = await runSingleDeterministicFlow(inputData, 101);

    __resetEngineStateForTests();
    const secondOutput = await runSingleDeterministicFlow(inputData, 102);

    expect(firstOutput.replayHash).not.toBe(secondOutput.replayHash);
    expect(firstOutput.replayBytes.equals(secondOutput.replayBytes)).toBe(false);
  });
});