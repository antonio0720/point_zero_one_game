// backend/src/game/engine/zero/RunBootstrapPipeline.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/RunBootstrapPipeline.ts
 *
 * Doctrine:
 * - bootstrap owns authoritative run start, not tick execution
 * - backend core remains the source of truth for initial snapshot shape
 * - mode configuration is applied exactly once before the first tick
 * - engine registry resets volatile runtime state without re-registering engines
 * - event bus queue/history are cleared without destroying long-lived listeners
 * - opening hand / deck data are validated against the canonical card registry
 */

import {
  checksumSnapshot,
  createDeterministicId,
  deepFrozenClone,
} from '../core/Deterministic';
import type { EventBus, EventEnvelope } from '../core/EventBus';
import { EngineRegistry } from '../core/EngineRegistry';
import type { EngineEventMap } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import {
  createInitialRunState,
  type RunFactoryInput,
} from '../core/RunStateFactory';
import { CardRegistry } from '../cards/CardRegistry';
import { DEFAULT_MODE_REGISTRY, ModeRegistry } from '../modes/ModeRegistry';
import type {
  ModeAdapter,
  ModeConfigureOptions,
} from '../modes/ModeContracts';

type RuntimeEventMap = EngineEventMap & Record<string, unknown>;

export interface RunBootstrapInput
  extends Omit<RunFactoryInput, 'runId' | 'seed'> {
  readonly runId?: string;
  readonly seed?: string;
  readonly modeOptions?: ModeConfigureOptions;
  readonly preserveBusListeners?: boolean;
  readonly preserveBusAnyListeners?: boolean;
}

export interface RunBootstrapResult {
  readonly snapshot: RunStateSnapshot;
  readonly modeAdapter: ModeAdapter;
  readonly openingChecksum: string;
  readonly startedEvent: EventEnvelope<'run.started', EngineEventMap['run.started']>;
}

export interface RunBootstrapPipelineDependencies {
  readonly bus: EventBus<RuntimeEventMap>;
  readonly registry: EngineRegistry;
  readonly modeRegistry?: ModeRegistry;
  readonly cardRegistry?: CardRegistry;
  readonly now?: () => number;
}

interface NormalizedBootstrapInput {
  readonly factoryInput: RunFactoryInput;
  readonly modeOptions?: ModeConfigureOptions;
  readonly preserveBusListeners: boolean;
  readonly preserveBusAnyListeners: boolean;
}

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export class RunBootstrapPipeline {
  private readonly bus: EventBus<RuntimeEventMap>;

  private readonly registry: EngineRegistry;

  private readonly modeRegistry: ModeRegistry;

  private readonly cardRegistry: CardRegistry;

  private readonly now: () => number;

  public constructor(dependencies: RunBootstrapPipelineDependencies) {
    this.bus = dependencies.bus;
    this.registry = dependencies.registry;
    this.modeRegistry = dependencies.modeRegistry ?? DEFAULT_MODE_REGISTRY;
    this.cardRegistry = dependencies.cardRegistry ?? new CardRegistry();
    this.now = dependencies.now ?? (() => Date.now());
  }

  public bootstrap(input: RunBootstrapInput): RunBootstrapResult {
    const normalized = this.normalizeInput(input);

    this.registry.reset();
    this.bus.clear({
      clearQueue: true,
      clearHistory: true,
      clearListeners: normalized.preserveBusListeners !== true ? true : false,
      clearAnyListeners:
        normalized.preserveBusAnyListeners !== true ? true : false,
    });

    let snapshot = createInitialRunState(normalized.factoryInput);
    const modeAdapter = this.modeRegistry.mustGet(snapshot.mode);

    snapshot = modeAdapter.configure(snapshot, normalized.modeOptions);
    snapshot = this.assertCanonicalIdentity(snapshot, normalized.factoryInput);
    this.assertOpeningCards(snapshot);

    const frozen = deepFrozenClone(snapshot);
    const openingChecksum = checksumSnapshot({
      runId: frozen.runId,
      seed: frozen.seed,
      mode: frozen.mode,
      tick: frozen.tick,
      phase: frozen.phase,
      economy: frozen.economy,
      pressure: frozen.pressure,
      tension: frozen.tension,
      shield: frozen.shield,
      battle: {
        ...frozen.battle,
        pendingAttacks: frozen.battle.pendingAttacks.map(
          (attack) => attack.attackId,
        ),
      },
      cards: {
        hand: frozen.cards.hand.map((card) => card.definitionId),
        discard: frozen.cards.discard,
        exhaust: frozen.cards.exhaust,
        drawPileSize: frozen.cards.drawPileSize,
      },
      modeState: frozen.modeState,
      timers: frozen.timers,
      tags: frozen.tags,
    });

    const startedEvent = this.bus.emit(
      'run.started',
      {
        runId: frozen.runId,
        mode: frozen.mode,
        seed: frozen.seed,
      },
      {
        emittedAtTick: frozen.tick,
        tags: freezeArray([
          'engine-zero',
          'run-bootstrap',
          `mode:${frozen.mode}`,
          `run:${frozen.runId}`,
        ]),
      },
    );

    return {
      snapshot: frozen,
      modeAdapter,
      openingChecksum,
      startedEvent,
    };
  }

  private normalizeInput(input: RunBootstrapInput): NormalizedBootstrapInput {
    const nowMs = this.now();
    const providedSeed = normalizeOptionalText(input.seed);
    const seed =
      providedSeed ??
      createDeterministicId(
        String(input.userId).trim(),
        String(input.mode).trim(),
        nowMs,
      );

    const providedRunId = normalizeOptionalText(input.runId);
    const runId = providedRunId ?? createDeterministicId(seed, 'run');

    return {
      factoryInput: {
        ...input,
        runId,
        seed,
      },
      modeOptions: input.modeOptions,
      preserveBusListeners: input.preserveBusListeners ?? true,
      preserveBusAnyListeners: input.preserveBusAnyListeners ?? true,
    };
  }

  private assertCanonicalIdentity(
    snapshot: RunStateSnapshot,
    input: RunFactoryInput,
  ): RunStateSnapshot {
    if (snapshot.runId !== input.runId) {
      throw new Error(
        `Run bootstrap produced a mismatched runId. Expected ${input.runId}, received ${snapshot.runId}.`,
      );
    }

    if (snapshot.userId !== input.userId) {
      throw new Error(
        `Run bootstrap produced a mismatched userId. Expected ${input.userId}, received ${snapshot.userId}.`,
      );
    }

    if (snapshot.seed !== input.seed) {
      throw new Error(
        `Run bootstrap produced a mismatched seed. Expected ${input.seed}, received ${snapshot.seed}.`,
      );
    }

    if (snapshot.mode !== input.mode) {
      throw new Error(
        `Run bootstrap produced a mismatched mode. Expected ${input.mode}, received ${snapshot.mode}.`,
      );
    }

    return snapshot;
  }

  private assertOpeningCards(snapshot: RunStateSnapshot): void {
    for (const instance of snapshot.cards.hand) {
      const definition = this.cardRegistry.require(instance.definitionId);

      if (definition.id !== instance.definitionId) {
        throw new Error(
          `Opening hand card definition mismatch for ${instance.instanceId}.`,
        );
      }

      if (instance.overlayAppliedForMode !== snapshot.mode) {
        throw new Error(
          `Opening hand card ${instance.definitionId} was overlaid for ${instance.overlayAppliedForMode} during ${snapshot.mode}.`,
        );
      }

      if (instance.card.id !== instance.definitionId) {
        throw new Error(
          `Opening hand card ${instance.instanceId} carries a mismatched embedded definition.`,
        );
      }
    }

    if (snapshot.tick !== 0) {
      throw new Error(
        `Run bootstrap must begin at tick 0. Received tick ${snapshot.tick}.`,
      );
    }

    if (snapshot.outcome !== null) {
      throw new Error(
        `Run bootstrap cannot start in a terminal state. Received outcome ${snapshot.outcome}.`,
      );
    }
  }
}