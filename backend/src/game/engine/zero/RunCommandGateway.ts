// backend/src/game/engine/zero/RunCommandGateway.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/RunCommandGateway.ts
 *
 * Doctrine:
 * - command gateway is the public imperative boundary for Engine 0
 * - it owns start / play / tick / abandon orchestration at the API edge
 * - gameplay mutation stays backend-authoritative through legality checks,
 *   card execution, mode adapters, and shutdown proof sealing
 * - this file does not replace TickExecutor; it composes with it
 */

import { deepFrozenClone } from '../core/Deterministic';
import type { EventBus } from '../core/EventBus';
import type {
  CardInstance,
  EngineEventMap,
  ModeCode,
  Targeting,
} from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import { CardEffectExecutor } from '../cards/CardEffectExecutor';
import { CardLegalityService } from '../cards/CardLegalityService';
import type { ModeActionId, ModeAdapter } from '../modes/ModeContracts';
import type {
  RunBootstrapInput,
  RunBootstrapPipeline,
} from './RunBootstrapPipeline';
import type {
  RunArchiveRecord,
  RunShutdownPipeline,
} from './RunShutdownPipeline';

type RuntimeEventMap = EngineEventMap & Record<string, unknown>;

export interface RunCommandGatewayDependencies {
  readonly bus: EventBus<RuntimeEventMap>;
  readonly bootstrap: RunBootstrapPipeline;
  readonly shutdown: RunShutdownPipeline;
  readonly advanceTick: (snapshot: RunStateSnapshot) => RunStateSnapshot;
  readonly cardLegality: CardLegalityService;
  readonly cardExecutor?: CardEffectExecutor;
  readonly onSnapshotChanged?: (snapshot: RunStateSnapshot) => void;
}

export class RunCommandGateway {
  private readonly bus: EventBus<RuntimeEventMap>;

  private readonly bootstrapPipeline: RunBootstrapPipeline;

  private readonly shutdownPipeline: RunShutdownPipeline;

  private readonly advanceTickImpl: (snapshot: RunStateSnapshot) => RunStateSnapshot;

  private readonly cardLegality: CardLegalityService;

  private readonly cardExecutor: CardEffectExecutor;

  private readonly onSnapshotChanged?: (snapshot: RunStateSnapshot) => void;

  private current: RunStateSnapshot | null = null;

  private activeModeAdapter: ModeAdapter | null = null;

  private lastArchive: RunArchiveRecord | null = null;

  public constructor(dependencies: RunCommandGatewayDependencies) {
    this.bus = dependencies.bus;
    this.bootstrapPipeline = dependencies.bootstrap;
    this.shutdownPipeline = dependencies.shutdown;
    this.advanceTickImpl = dependencies.advanceTick;
    this.cardLegality = dependencies.cardLegality;
    this.cardExecutor = dependencies.cardExecutor ?? new CardEffectExecutor();
    this.onSnapshotChanged = dependencies.onSnapshotChanged;
  }

  public start(input: RunBootstrapInput): RunStateSnapshot {
    if (this.current !== null) {
      throw new Error(
        'RunCommandGateway already owns a run snapshot. Call reset() before starting another run.',
      );
    }

    const bootstrapped = this.bootstrapPipeline.bootstrap(input);
    this.activeModeAdapter = bootstrapped.modeAdapter;
    this.lastArchive = null;

    return this.commit(bootstrapped.snapshot);
  }

  public getSnapshot(): RunStateSnapshot {
    if (this.current === null) {
      throw new Error('No active run. Call start() first.');
    }

    return this.current;
  }

  public maybeGetSnapshot(): RunStateSnapshot | null {
    return this.current;
  }

  public getLastArchive(): RunArchiveRecord | null {
    return this.lastArchive;
  }

  public playCard(
    definitionId: string,
    actorId: string,
    targeting: Targeting = 'SELF',
  ): RunStateSnapshot {
    const current = this.assertPlayable();
    const card = this.cardLegality.mustResolve(current, definitionId, targeting);

    let next = this.cardExecutor.apply(current, card, actorId);
    next = this.decoratePlayedCard(next, card, actorId);

    this.bus.emit(
      'card.played',
      {
        runId: next.runId,
        actorId,
        cardId: card.definitionId,
        tick: next.tick,
        mode: next.mode,
      },
      {
        emittedAtTick: next.tick,
        tags: [
          'engine-zero',
          'run-command-gateway',
          'card-played',
          `mode:${next.mode}`,
          `card:${card.definitionId}`,
        ],
      },
    );

    return this.commit(next);
  }

  public resolveModeAction(
    actionId: ModeActionId,
    payload: Readonly<Record<string, unknown>> = {},
  ): RunStateSnapshot {
    const current = this.assertPlayable();
    const adapter = this.requireModeAdapter();

    if (!adapter.resolveAction) {
      throw new Error(`Mode ${current.mode} does not expose mode actions.`);
    }

    const next = adapter.resolveAction(current, actionId, payload);

    this.bus.emit(
      'mode.action.resolved',
      {
        runId: next.runId,
        mode: next.mode,
        actionId,
        tick: next.tick,
        payload,
      },
      {
        emittedAtTick: next.tick,
        tags: [
          'engine-zero',
          'run-command-gateway',
          'mode-action',
          `mode:${next.mode}`,
          `action:${actionId}`,
        ],
      },
    );

    return this.commit(next);
  }

  public advanceTick(): RunStateSnapshot {
    const current = this.getSnapshot();

    if (current.outcome !== null) {
      return this.finalizeIfNeeded(current);
    }

    const next = this.advanceTickImpl(current);

    if (next.outcome !== null && next.sovereignty.proofHash === null) {
      return this.finalizeAndCommit(next);
    }

    return this.commit(next);
  }

  public tick(count = 1): RunStateSnapshot {
    if (!Number.isFinite(count) || count <= 0) {
      throw new Error(`tick(count) requires a positive finite count. Received ${count}.`);
    }

    let snapshot = this.getSnapshot();
    for (let index = 0; index < count; index += 1) {
      snapshot = this.advanceTick();
      if (snapshot.outcome !== null) {
        break;
      }
    }

    return snapshot;
  }

  public runUntilDone(maxTicks = 500): RunStateSnapshot {
    if (!Number.isFinite(maxTicks) || maxTicks <= 0) {
      throw new Error(
        `runUntilDone(maxTicks) requires a positive finite maxTicks. Received ${maxTicks}.`,
      );
    }

    let snapshot = this.getSnapshot();
    for (let index = 0; index < maxTicks; index += 1) {
      snapshot = this.advanceTick();
      if (snapshot.outcome !== null) {
        return snapshot;
      }
    }

    return snapshot;
  }

  public abandon(reason = 'run.user_abandoned'): RunStateSnapshot {
    const current = this.getSnapshot();
    return this.finalizeAndCommit(current, {
      forceOutcome: 'ABANDONED',
      reason,
      reasonCode: 'USER_ABANDON',
    });
  }

  public reset(): void {
    this.current = null;
    this.activeModeAdapter = null;
    this.lastArchive = null;
  }

  private finalizeIfNeeded(snapshot: RunStateSnapshot): RunStateSnapshot {
    if (snapshot.sovereignty.proofHash !== null) {
      return this.commit(snapshot);
    }

    return this.finalizeAndCommit(snapshot);
  }

  private finalizeAndCommit(
    snapshot: RunStateSnapshot,
    shutdownOverrides: Parameters<RunShutdownPipeline['shutdown']>[0] extends infer T
      ? Omit<Extract<T, object>, 'snapshot'>
      : never = {},
  ): RunStateSnapshot {
    const result = this.shutdownPipeline.shutdown({
      snapshot,
      ...shutdownOverrides,
    });

    this.lastArchive = result.archive;
    return this.commit(result.snapshot);
  }

  private commit(snapshot: RunStateSnapshot): RunStateSnapshot {
    const frozen = deepFrozenClone(snapshot);
    this.current = frozen;

    if (this.onSnapshotChanged) {
      this.onSnapshotChanged(frozen);
    }

    return frozen;
  }

  private assertPlayable(): RunStateSnapshot {
    const snapshot = this.getSnapshot();

    if (snapshot.outcome !== null) {
      throw new Error(
        `Run ${snapshot.runId} is terminal (${snapshot.outcome}). No further play commands are allowed.`,
      );
    }

    return snapshot;
  }

  private requireModeAdapter(): ModeAdapter {
    if (this.activeModeAdapter === null) {
      throw new Error('No active mode adapter. Start a run first.');
    }

    return this.activeModeAdapter;
  }

  private decoratePlayedCard(
    snapshot: RunStateSnapshot,
    card: CardInstance,
    actorId: string,
  ): RunStateSnapshot {
    return {
      ...snapshot,
      cards: {
        ...snapshot.cards,
        lastPlayed: [card.definitionId, ...snapshot.cards.lastPlayed].slice(0, 3),
        discard: [...snapshot.cards.discard, card.definitionId],
        hand: snapshot.cards.hand.filter(
          (entry) => entry.instanceId !== card.instanceId,
        ),
      },
      telemetry: {
        ...snapshot.telemetry,
        decisions: [
          ...snapshot.telemetry.decisions,
          {
            tick: snapshot.tick,
            actorId,
            cardId: card.definitionId,
            latencyMs:
              card.card.decisionTimerOverrideMs ??
              snapshot.timers.currentTickDurationMs,
            timingClass: card.timingClass,
            accepted: true,
          },
        ],
      },
    };
  }
}