/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/RunLifecycleCoordinator.ts
 *
 * Purpose:
 * - thin lifecycle facade over EngineOrchestrator
 * - keep external callers out of direct engine wiring
 * - expose deterministic run start / play / action / tick / drain operations
 */

import type { ModeCode, Targeting } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type { ModeActionId, ModeConfigureOptions } from '../modes/ModeContracts';
import {
  EngineOrchestrator,
  type ModeActionInput,
  type OrchestratorLifecycle,
  type PlayCardInput,
  type StartRunInput,
  type TickExecutionSummary,
} from './EngineOrchestrator';

export interface CoordinatorStartInput {
  readonly userId: string;
  readonly mode: ModeCode;
  readonly seed?: string;
  readonly runId?: string;
  readonly communityHeatModifier?: number;
  readonly tags?: readonly string[];
  readonly modeOptions?: ModeConfigureOptions;
  readonly forceProofFinalizeOnTerminal?: boolean;
}

export interface CoordinatorTickOptions {
  readonly count?: number;
  readonly stopOnTerminal?: boolean;
}

export interface CoordinatorRunUntilDoneOptions {
  readonly maxTicks?: number;
}

export class RunLifecycleCoordinator {
  private readonly orchestrator: EngineOrchestrator;

  public constructor(orchestrator?: EngineOrchestrator) {
    this.orchestrator = orchestrator ?? new EngineOrchestrator();
  }

  public start(
    inputOrUserId: CoordinatorStartInput | string,
    modeArg?: ModeCode,
    seedArg?: string,
  ): RunStateSnapshot {
    const input = this.normalizeStartInput(inputOrUserId, modeArg, seedArg);
    return this.orchestrator.startRun(input);
  }

  public play(
    definitionIdOrInput: string | PlayCardInput,
    actorIdArg?: string,
    targetingArg: Targeting = 'SELF',
  ): RunStateSnapshot {
    return this.orchestrator.playCard(
      definitionIdOrInput as string | PlayCardInput,
      actorIdArg,
      targetingArg,
    );
  }

  public action(
    actionIdOrInput: ModeActionId | ModeActionInput,
    payload?: Readonly<Record<string, unknown>>,
  ): RunStateSnapshot {
    if (typeof actionIdOrInput === 'string') {
      return this.orchestrator.dispatchModeAction({
        actionId: actionIdOrInput,
        payload,
      });
    }

    return this.orchestrator.dispatchModeAction(actionIdOrInput);
  }

  public tick(options: CoordinatorTickOptions = {}): RunStateSnapshot {
    const count = options.count ?? 1;
    const stopOnTerminal = options.stopOnTerminal ?? true;

    let snapshot = this.orchestrator.getSnapshot();

    for (let index = 0; index < count; index += 1) {
      snapshot = this.orchestrator.advanceTick();
      if (stopOnTerminal && snapshot.outcome !== null) {
        return snapshot;
      }
    }

    return snapshot;
  }

  public runUntilDone(
    options: CoordinatorRunUntilDoneOptions = {},
  ): RunStateSnapshot {
    const maxTicks = options.maxTicks ?? 500;
    return this.orchestrator.runUntilDone(maxTicks);
  }

  public getSnapshot(): RunStateSnapshot {
    return this.orchestrator.getSnapshot();
  }

  public getLifecycle(): OrchestratorLifecycle {
    return this.orchestrator.getLifecycle();
  }

  public getLastFlushCount(): number {
    return this.orchestrator.getLastFlush().length;
  }

  public getQueuedEventCount(): number {
    return this.orchestrator.getQueuedEventCount();
  }

  public getTickHistory(): readonly TickExecutionSummary[] {
    return this.orchestrator.getTickHistory();
  }

  public reset(): void {
    this.orchestrator.reset();
  }

  private normalizeStartInput(
    inputOrUserId: CoordinatorStartInput | string,
    modeArg?: ModeCode,
    seedArg?: string,
  ): StartRunInput {
    if (typeof inputOrUserId !== 'string') {
      return {
        userId: inputOrUserId.userId,
        mode: inputOrUserId.mode,
        seed: inputOrUserId.seed,
        runId: inputOrUserId.runId,
        communityHeatModifier: inputOrUserId.communityHeatModifier,
        tags: inputOrUserId.tags,
        modeOptions: inputOrUserId.modeOptions,
        forceProofFinalizeOnTerminal: inputOrUserId.forceProofFinalizeOnTerminal,
      };
    }

    if (!modeArg) {
      throw new Error('mode is required when start() is called with a userId string.');
    }

    return {
      userId: inputOrUserId,
      mode: modeArg,
      seed: seedArg,
    };
  }
}