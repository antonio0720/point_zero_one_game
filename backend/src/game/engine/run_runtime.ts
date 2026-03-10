/**
 * POINT ZERO ONE — IN-MEMORY RUN RUNTIME
 * backend/src/game/engine/run_runtime.ts
 *
 * Deterministic run lifecycle surface for replay tests and backend orchestration.
 *
 * Why this file exists:
 * - engine_determinism.test.ts imports createRun/finalizeRun/replayRun/submitTurnDecision
 * - the current public barrel does not provide a concrete runtime for those calls
 * - broken run orchestrator/finalizer files are excluded from build
 *
 * This runtime is intentionally:
 * - deterministic
 * - side-effect free
 * - in-memory
 * - test-friendly
 * - replay-engine backed
 */

import { normalizeSeed } from './deterministic_rng';
import {
  ReplayEngine,
  createDefaultLedger,
  sha256Hex,
  stableStringify,
  type DecisionEffect,
  type Ledger,
  type ReplaySnapshot,
  type RunCreatedEvent,
  type RunEvent,
  type RunFinalizedEvent,
  type TurnSubmittedEvent,
} from './replay_engine';

export type { DecisionEffect, Ledger, ReplaySnapshot };

export interface SubmitTurnDecisionRequest {
  readonly turnIndex: number;
  readonly choiceId: string;
  readonly sourceCardInstanceId?: string;
  readonly effects: readonly DecisionEffect[];
}

export interface RunReplayResult {
  readonly runId: string;
  readonly replayHash: string;
  readonly replayBytesBase64: string;
  readonly snapshot: ReplaySnapshot;
}

interface RunRecord {
  readonly runId: string;
  readonly seed: number;
  readonly createdAt: number;
  readonly initialLedger: Ledger;
  readonly eventLog: readonly RunEvent[];
  readonly decisionCount: number;
  readonly finalized: boolean;
}

const runStore = new Map<string, RunRecord>();
let runSequence = 0;

function buildRunId(seed: number, initialLedger: Ledger, sequence: number): string {
  const digest = sha256Hex(
    stableStringify({
      type: 'RUN',
      seed,
      sequence,
      initialLedger,
    }),
  );

  return `run_${digest.slice(0, 24)}`;
}

function buildDecisionId(
  runId: string,
  request: SubmitTurnDecisionRequest,
  decisionOrdinal: number,
): string {
  const digest = sha256Hex(
    stableStringify({
      type: 'DECISION',
      runId,
      decisionOrdinal,
      turnIndex: request.turnIndex,
      choiceId: request.choiceId,
      sourceCardInstanceId: request.sourceCardInstanceId ?? null,
      effects: request.effects,
    }),
  );

  return `decision_${digest.slice(0, 24)}`;
}

function getRunRecord(runId: string): RunRecord {
  const record = runStore.get(runId);

  if (!record) {
    throw new Error(`Unknown runId: ${runId}`);
  }

  return record;
}

function setRunRecord(record: RunRecord): void {
  runStore.set(record.runId, record);
}

function buildReplayResult(record: RunRecord): RunReplayResult {
  const replayEngine = new ReplayEngine(record.seed, record.eventLog);
  const replayBytes = replayEngine.toReplayBytes();

  return {
    runId: record.runId,
    replayHash: replayEngine.getReplayHash(),
    replayBytesBase64: replayBytes.toString('base64'),
    snapshot: replayEngine.replayAll(),
  };
}

function validateEffects(effects: readonly DecisionEffect[]): void {
  if (!Array.isArray(effects)) {
    throw new Error('effects must be an array.');
  }

  for (let i = 0; i < effects.length; i += 1) {
    const effect = effects[i];

    if (!effect || typeof effect !== 'object') {
      throw new Error(`effects[${i}] must be an object.`);
    }

    if (!Number.isFinite(effect.delta)) {
      throw new Error(`effects[${i}].delta must be a finite number.`);
    }

    switch (effect.target) {
      case 'cash':
      case 'income':
      case 'expenses':
      case 'shield':
      case 'heat':
      case 'trust':
      case 'divergence':
      case 'cords':
        break;
      default:
        throw new Error(`effects[${i}].target is invalid: ${String(effect.target)}`);
    }
  }
}

export function __resetEngineStateForTests(): void {
  runStore.clear();
  runSequence = 0;
}

export async function createRun(
  seed: number,
  initialLedger: Ledger,
): Promise<string> {
  const normalizedSeed = normalizeSeed(seed);
  const ledger = createDefaultLedger(initialLedger);
  const sequence = runSequence;
  const runId = buildRunId(normalizedSeed, ledger, sequence);
  const createdAt = sequence * 1000 + normalizedSeed;

  const createdEvent: RunCreatedEvent = {
    type: 'RUN_CREATED',
    runId,
    seed: normalizedSeed,
    createdAt,
    ledger,
  };

  const record: RunRecord = {
    runId,
    seed: normalizedSeed,
    createdAt,
    initialLedger: ledger,
    eventLog: [createdEvent],
    decisionCount: 0,
    finalized: false,
  };

  setRunRecord(record);
  runSequence += 1;

  return runId;
}

export async function submitTurnDecision(
  runId: string,
  request: SubmitTurnDecisionRequest,
): Promise<void> {
  const record = getRunRecord(runId);

  if (record.finalized) {
    throw new Error(`Run ${runId} is already finalized.`);
  }

  if (!Number.isInteger(request.turnIndex) || request.turnIndex < 0) {
    throw new Error(`turnIndex must be a non-negative integer. Received: ${String(request.turnIndex)}`);
  }

  if (request.turnIndex !== record.decisionCount) {
    throw new Error(
      `Out-of-order turn submission for run ${runId}. Expected turnIndex ${record.decisionCount}, received ${request.turnIndex}.`,
    );
  }

  if (typeof request.choiceId !== 'string' || request.choiceId.trim().length === 0) {
    throw new Error('choiceId must be a non-empty string.');
  }

  if (
    request.sourceCardInstanceId !== undefined &&
    (typeof request.sourceCardInstanceId !== 'string' ||
      request.sourceCardInstanceId.trim().length === 0)
  ) {
    throw new Error('sourceCardInstanceId, when provided, must be a non-empty string.');
  }

  validateEffects(request.effects);

  const decisionId = buildDecisionId(runId, request, record.decisionCount);
  const submittedAt = record.createdAt + record.decisionCount + 1;

  const baseEvent: Omit<TurnSubmittedEvent, 'sourceCardInstanceId'> = {
    type: 'TURN_SUBMITTED',
    runId,
    turnIndex: request.turnIndex,
    decisionId,
    choiceId: request.choiceId,
    submittedAt,
    effects: [...request.effects],
  };

  const turnEvent: TurnSubmittedEvent =
    request.sourceCardInstanceId === undefined
      ? baseEvent
      : {
          ...baseEvent,
          sourceCardInstanceId: request.sourceCardInstanceId,
        };

  setRunRecord({
    ...record,
    eventLog: [...record.eventLog, turnEvent],
    decisionCount: record.decisionCount + 1,
  });
}

export async function finalizeRun(runId: string): Promise<RunReplayResult> {
  const record = getRunRecord(runId);

  if (!record.finalized) {
    const finalizedAt = record.createdAt + record.decisionCount + 1;

    const finalizedEvent: RunFinalizedEvent = {
      type: 'RUN_FINALIZED',
      runId,
      finalizedAt,
    };

    const updatedRecord: RunRecord = {
      ...record,
      finalized: true,
      eventLog: [...record.eventLog, finalizedEvent],
    };

    setRunRecord(updatedRecord);
    return buildReplayResult(updatedRecord);
  }

  return buildReplayResult(record);
}

export async function replayRun(runId: string): Promise<RunReplayResult> {
  return buildReplayResult(getRunRecord(runId));
}