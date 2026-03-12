// backend/src/game/engine/zero/RunShutdownPipeline.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/RunShutdownPipeline.ts
 *
 * Doctrine:
 * - shutdown owns terminal reconciliation, not tick sequencing
 * - terminal outcome authority flows through RuntimeOutcomeResolver
 * - mode finalization executes before proof sealing so mode-native score
 *   consequences are included in sovereignty proof
 * - sovereignty finalization remains owned by SovereigntyEngine
 * - archive output is deterministic, replay-safe, and storage-ready
 */

import {
  checksumParts,
  checksumSnapshot,
  cloneJson,
  computeTickSeal,
  deepFrozenClone,
  deepFreeze,
} from '../core/Deterministic';
import type { EventBus, EventEnvelope } from '../core/EventBus';
import type { EngineEventMap } from '../core/GamePrimitives';
import type {
  OutcomeReasonCode,
  RunStateSnapshot,
} from '../core/RunStateSnapshot';
import { RuntimeOutcomeResolver } from '../core/RuntimeOutcomeResolver';
import { DEFAULT_MODE_REGISTRY, ModeRegistry } from '../modes/ModeRegistry';
import { SovereigntyEngine } from '../sovereignty/SovereigntyEngine';

type RuntimeEventMap = EngineEventMap & Record<string, unknown>;

type Mutable<T> =
  T extends readonly (infer U)[]
    ? Mutable<U>[]
    : T extends object
      ? { -readonly [K in keyof T]: Mutable<T[K]> }
      : T;

export interface RunShutdownInput {
  readonly snapshot: RunStateSnapshot;
  readonly nowMs?: number;
  readonly flushEvents?: boolean;
  readonly forceOutcome?: NonNullable<RunStateSnapshot['outcome']>;
  readonly reason?: string;
  readonly reasonCode?: OutcomeReasonCode | null;
}

export interface FlushedEventDigest {
  readonly sequence: number;
  readonly event: string;
  readonly emittedAtTick?: number;
  readonly tags?: readonly string[];
  readonly checksum: string;
}

export interface RunArchiveRecord {
  readonly runId: string;
  readonly userId: string;
  readonly seed: string;
  readonly mode: RunStateSnapshot['mode'];
  readonly tick: number;
  readonly phase: RunStateSnapshot['phase'];
  readonly outcome: NonNullable<RunStateSnapshot['outcome']>;
  readonly finalNetWorth: number;
  readonly proofHash: string | null;
  readonly integrityStatus: RunStateSnapshot['sovereignty']['integrityStatus'];
  readonly sovereigntyScore: number;
  readonly verifiedGrade: string | null;
  readonly stateChecksum: string;
  readonly shutdownSeal: string;
  readonly finalizedAtMs: number;
  readonly drainedEvents: readonly FlushedEventDigest[];
  readonly auditFlags: readonly string[];
  readonly tags: readonly string[];
}

export interface RunShutdownResult {
  readonly snapshot: RunStateSnapshot;
  readonly archive: RunArchiveRecord;
  readonly drained: readonly EventEnvelope<
    keyof RuntimeEventMap,
    RuntimeEventMap[keyof RuntimeEventMap]
  >[];
  readonly didFinalizeProof: boolean;
}

export interface RunShutdownPipelineDependencies {
  readonly bus: EventBus<RuntimeEventMap>;
  readonly sovereignty: SovereigntyEngine;
  readonly modeRegistry?: ModeRegistry;
  readonly now?: () => number;
}

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

export class RunShutdownPipeline {
  private readonly bus: EventBus<RuntimeEventMap>;

  private readonly sovereignty: SovereigntyEngine;

  private readonly modeRegistry: ModeRegistry;

  private readonly now: () => number;

  private readonly outcomeResolver = new RuntimeOutcomeResolver();

  public constructor(dependencies: RunShutdownPipelineDependencies) {
    this.bus = dependencies.bus;
    this.sovereignty = dependencies.sovereignty;
    this.modeRegistry = dependencies.modeRegistry ?? DEFAULT_MODE_REGISTRY;
    this.now = dependencies.now ?? (() => Date.now());
  }

  public shutdown(input: RunShutdownInput): RunShutdownResult {
    const finalizedAtMs = input.nowMs ?? this.now();

    let snapshot =
      input.forceOutcome !== undefined
        ? this.forceOutcome(
            input.snapshot,
            input.forceOutcome,
            input.reason ?? 'run.shutdown_forced',
            input.reasonCode ?? 'UNKNOWN',
          )
        : this.outcomeResolver.apply(input.snapshot);

    if (snapshot.outcome === null) {
      snapshot = this.forceOutcome(
        snapshot,
        'ABANDONED',
        input.reason ?? 'run.shutdown_without_terminal_outcome',
        input.reasonCode ?? 'UNKNOWN',
      );
    }

    const adapter = this.modeRegistry.mustGet(snapshot.mode);
    if (adapter.finalize) {
      snapshot = adapter.finalize(snapshot);
    }

    const proofWasMissing = snapshot.sovereignty.proofHash === null;
    if (proofWasMissing) {
      snapshot = this.sovereignty.finalizeRun(snapshot, this.bus, finalizedAtMs);
      this.emitPostProofEvents(snapshot);
    }

    const frozen = deepFrozenClone(snapshot);
    const drained =
      input.flushEvents === false
        ? freezeArray<
            EventEnvelope<keyof RuntimeEventMap, RuntimeEventMap[keyof RuntimeEventMap]>
          >([])
        : freezeArray(this.bus.flush());

    const archive = this.buildArchive(frozen, drained, finalizedAtMs);

    return {
      snapshot: frozen,
      archive,
      drained,
      didFinalizeProof: proofWasMissing,
    };
  }

  private emitPostProofEvents(snapshot: RunStateSnapshot): void {
    if (snapshot.sovereignty.integrityStatus === 'QUARANTINED') {
      this.bus.emit(
        'integrity.quarantined',
        {
          runId: snapshot.runId,
          tick: snapshot.tick,
          reasons:
            snapshot.sovereignty.auditFlags.length > 0
              ? [...snapshot.sovereignty.auditFlags]
              : [...snapshot.telemetry.warnings],
        },
        {
          emittedAtTick: snapshot.tick,
          tags: freezeArray([
            'engine-zero',
            'run-shutdown',
            'integrity-quarantined',
          ]),
        },
      );
    }

    if (snapshot.outcome !== null && snapshot.sovereignty.proofHash !== null) {
      this.bus.emit(
        'proof.sealed',
        {
          runId: snapshot.runId,
          proofHash: snapshot.sovereignty.proofHash,
          integrityStatus: snapshot.sovereignty.integrityStatus,
          grade: snapshot.sovereignty.verifiedGrade ?? 'F',
          outcome: snapshot.outcome,
        },
        {
          emittedAtTick: snapshot.tick,
          tags: freezeArray([
            'engine-zero',
            'run-shutdown',
            'proof-sealed',
            `outcome:${snapshot.outcome.toLowerCase()}`,
          ]),
        },
      );
    }
  }

  private buildArchive(
    snapshot: RunStateSnapshot,
    drained: readonly EventEnvelope<
      keyof RuntimeEventMap,
      RuntimeEventMap[keyof RuntimeEventMap]
    >[],
    finalizedAtMs: number,
  ): RunArchiveRecord {
    const stateChecksum = checksumSnapshot(snapshot);
    const eventDigests = freezeArray(
      drained.map((entry) => ({
        sequence: entry.sequence,
        event: String(entry.event),
        emittedAtTick: entry.emittedAtTick,
        tags: entry.tags === undefined ? undefined : freezeArray(entry.tags),
        checksum: checksumParts(
          entry.sequence,
          entry.event,
          entry.emittedAtTick ?? null,
          entry.tags ?? [],
          entry.payload,
        ),
      })),
    );

    const shutdownSeal = computeTickSeal({
      runId: snapshot.runId,
      tick: snapshot.tick,
      step: 'RUN_SHUTDOWN',
      stateChecksum,
      eventChecksums: eventDigests.map((entry) => entry.checksum),
    });

    return Object.freeze({
      runId: snapshot.runId,
      userId: snapshot.userId,
      seed: snapshot.seed,
      mode: snapshot.mode,
      tick: snapshot.tick,
      phase: snapshot.phase,
      outcome: snapshot.outcome ?? 'ABANDONED',
      finalNetWorth: snapshot.economy.netWorth,
      proofHash: snapshot.sovereignty.proofHash,
      integrityStatus: snapshot.sovereignty.integrityStatus,
      sovereigntyScore: snapshot.sovereignty.sovereigntyScore,
      verifiedGrade: snapshot.sovereignty.verifiedGrade,
      stateChecksum,
      shutdownSeal,
      finalizedAtMs,
      drainedEvents: eventDigests,
      auditFlags: freezeArray(snapshot.sovereignty.auditFlags),
      tags: freezeArray(snapshot.tags),
    });
  }

  private forceOutcome(
    snapshot: RunStateSnapshot,
    outcome: NonNullable<RunStateSnapshot['outcome']>,
    reason: string,
    reasonCode: OutcomeReasonCode,
  ): RunStateSnapshot {
    const next = cloneJson(snapshot) as Mutable<RunStateSnapshot>;
    next.outcome = outcome;
    next.telemetry.outcomeReason = reason;
    next.telemetry.outcomeReasonCode = reasonCode;

    return deepFreeze(next) as RunStateSnapshot;
  }
}