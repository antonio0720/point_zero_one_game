/**
 * POINT ZERO ONE — GAME ENGINE BOUNDARY
 * /backend/src/game/engine/index.ts
 *
 * Deterministic in-memory run boundary for backend orchestration, replay,
 * tests, verification, and future persistence integration.
 */

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
  type Seed,
  type TurnSubmittedEvent,
} from './replay_engine';

export type { DecisionEffect, Ledger, ReplaySnapshot, RunEvent, Seed } from './replay_engine';

export interface CreateRunRequest {
  readonly seed: Seed;
  readonly ledger?: Partial<Ledger>;
}

export interface SubmitTurnDecisionRequest {
  readonly turnIndex: number;
  readonly choiceId: string;
  readonly effects: readonly DecisionEffect[];
  readonly sourceCardInstanceId?: string;
  readonly decisionId?: string;
  readonly submittedAt?: number;
}

export interface FinalizeRunRequest {
  readonly runId: string;
}

export interface ReplayRunResponse {
  readonly runId: string;
  readonly seed: Seed;
  readonly finalizedAt: number;
  readonly eventCount: number;
  readonly turnCount: number;
  readonly ledger: Ledger;
  readonly replayHash: string;
  readonly replayBytesBase64: string;
  readonly events: readonly RunEvent[];
  readonly snapshot: ReplaySnapshot;
}

interface StoredRun {
  readonly runId: string;
  readonly seed: Seed;
  readonly createdAt: number;
  events: RunEvent[];
}

const runStore = new Map<string, StoredRun>();
const BASE_TIMESTAMP_MS = 1_700_000_000_000;

function deterministicTimestamp(seed: number, offset: number): number {
  return BASE_TIMESTAMP_MS + Math.abs(Math.trunc(seed)) * 1000 + offset;
}

function createRunId(seed: Seed, ledger: Ledger): string {
  const material = stableStringify({ seed, ledger });
  return `run_${sha256Hex(material).slice(0, 24)}`;
}

function createDecisionId(
  runId: string,
  turnIndex: number,
  choiceId: string,
  effects: readonly DecisionEffect[],
): string {
  const material = stableStringify({
    runId,
    turnIndex,
    choiceId,
    effects,
  });

  return `decision_${sha256Hex(material).slice(0, 20)}`;
}

function getStoredRunOrThrow(runId: string): StoredRun {
  const stored = runStore.get(runId);

  if (!stored) {
    throw new Error(`Run not found: ${runId}`);
  }

  return stored;
}

function buildReplayEngine(stored: StoredRun): ReplayEngine {
  return new ReplayEngine(stored.seed, stored.events);
}

function getTurnCount(events: readonly RunEvent[]): number {
  return events.filter((event) => event.type === 'TURN_SUBMITTED').length;
}

function isFinalized(events: readonly RunEvent[]): boolean {
  return events.some((event) => event.type === 'RUN_FINALIZED');
}

export async function createRun(
  seed: Seed,
  ledger: Ledger,
): Promise<string>;
export async function createRun(request: CreateRunRequest): Promise<string>;
export async function createRun(
  seedOrRequest: Seed | CreateRunRequest,
  maybeLedger?: Ledger,
): Promise<string> {
  const seed =
    typeof seedOrRequest === 'number' ? seedOrRequest : seedOrRequest.seed;

  const ledger =
    typeof seedOrRequest === 'number'
      ? createDefaultLedger(maybeLedger ?? {})
      : createDefaultLedger(seedOrRequest.ledger ?? {});

  const createdAt = deterministicTimestamp(seed, 0);
  const baseRunId = createRunId(seed, ledger);

  let runId = baseRunId;
  let suffix = 1;

  while (runStore.has(runId)) {
    suffix += 1;
    runId = `${baseRunId}_${suffix}`;
  }

  const createdEvent: RunCreatedEvent = {
    type: 'RUN_CREATED',
    runId,
    seed,
    createdAt,
    ledger,
  };

  runStore.set(runId, {
    runId,
    seed,
    createdAt,
    events: [createdEvent],
  });

  return runId;
}

export async function submitTurnDecision(
  runId: string,
  request: SubmitTurnDecisionRequest,
): Promise<void> {
  const stored = getStoredRunOrThrow(runId);

  if (isFinalized(stored.events)) {
    throw new Error(`Cannot submit turn decision to finalized run: ${runId}`);
  }

  const expectedTurnIndex = getTurnCount(stored.events);

  if (request.turnIndex !== expectedTurnIndex) {
    throw new Error(
      `Non-deterministic turn submission. Expected turn ${expectedTurnIndex}, received ${request.turnIndex}.`,
    );
  }

  const submittedAt =
    request.submittedAt ??
    deterministicTimestamp(stored.seed, request.turnIndex + 1);

  const decisionId =
    request.decisionId ??
    createDecisionId(runId, request.turnIndex, request.choiceId, request.effects);

  const event: TurnSubmittedEvent = {
    type: 'TURN_SUBMITTED',
    runId,
    turnIndex: request.turnIndex,
    decisionId,
    choiceId: request.choiceId,
    submittedAt,
    sourceCardInstanceId: request.sourceCardInstanceId,
    effects: request.effects.map((effect) => ({
      target: effect.target,
      delta: effect.delta,
    })),
  };

  stored.events = [...stored.events, event];
}

export async function finalizeRun(runId: string): Promise<ReplayRunResponse> {
  const stored = getStoredRunOrThrow(runId);

  if (!isFinalized(stored.events)) {
    const finalizedAt = deterministicTimestamp(
      stored.seed,
      10_000 + getTurnCount(stored.events),
    );

    const finalEvent: RunFinalizedEvent = {
      type: 'RUN_FINALIZED',
      runId,
      finalizedAt,
    };

    stored.events = [...stored.events, finalEvent];
  }

  const replay = buildReplayEngine(stored);
  const snapshot = replay.replayAll();
  const replayBytes = replay.toReplayBytes();
  const finalizedEvent = stored.events.find(
    (event): event is RunFinalizedEvent => event.type === 'RUN_FINALIZED',
  );

  if (!finalizedEvent) {
    throw new Error(`Run finalized event missing for run: ${runId}`);
  }

  return {
    runId,
    seed: stored.seed,
    finalizedAt: finalizedEvent.finalizedAt,
    eventCount: stored.events.length,
    turnCount: snapshot.turnCount,
    ledger: snapshot.ledger,
    replayHash: replay.getReplayHash(),
    replayBytesBase64: replayBytes.toString('base64'),
    events: [...stored.events],
    snapshot,
  };
}

export async function replayRun(runId: string): Promise<ReplayRunResponse> {
  const stored = getStoredRunOrThrow(runId);
  const replay = buildReplayEngine(stored);
  const snapshot = replay.replayAll();
  const replayBytes = replay.toReplayBytes();

  const finalizedAt = isFinalized(stored.events)
    ? (
        stored.events.find(
          (event): event is RunFinalizedEvent => event.type === 'RUN_FINALIZED',
        ) as RunFinalizedEvent
      ).finalizedAt
    : deterministicTimestamp(stored.seed, 10_000 + getTurnCount(stored.events));

  return {
    runId,
    seed: stored.seed,
    finalizedAt,
    eventCount: stored.events.length,
    turnCount: snapshot.turnCount,
    ledger: snapshot.ledger,
    replayHash: replay.getReplayHash(),
    replayBytesBase64: replayBytes.toString('base64'),
    events: [...stored.events],
    snapshot,
  };
}

export async function getRunEvents(runId: string): Promise<readonly RunEvent[]> {
  return [...getStoredRunOrThrow(runId).events];
}

export function __resetEngineStateForTests(): void {
  runStore.clear();
}