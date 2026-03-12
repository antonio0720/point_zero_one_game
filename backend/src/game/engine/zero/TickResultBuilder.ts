// backend/src/game/engine/zero/TickResultBuilder.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/TickResultBuilder.ts
 *
 * Doctrine:
 * - the tick result is the immutable orchestration artifact for one backend tick
 * - it must summarize what happened without becoming the source of truth
 * - the snapshot remains authoritative; this object is the replay/diagnostic
 *   product handed to tests, operators, and higher orchestration layers
 */

import { deepFrozenClone } from '../core/Deterministic';
import type { EngineHealth, EngineSignal } from '../core/EngineContracts';
import type { EventEnvelope } from '../core/EventBus';
import type {
  AttackEvent,
  CascadeChainInstance,
  EngineEventMap,
  PressureTier,
  RunOutcome,
  ShieldLayerId,
} from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type { TickTraceRecord } from '../core/TickTraceRecorder';

type RuntimeEventMap = EngineEventMap & Record<string, unknown>;

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

export interface TickBattleSummary {
  readonly activeBots: number;
  readonly pendingAttacks: number;
  readonly injectedAttacks: readonly AttackEvent[];
}

export interface TickShieldSummary {
  readonly weakestLayer: ShieldLayerId | null;
  readonly breachedLayers: readonly ShieldLayerId[];
  readonly aggregateIntegrity: number;
}

export interface TickCascadeSummary {
  readonly activeChains: number;
  readonly brokenChains: number;
  readonly completedChains: number;
  readonly positiveChains: number;
  readonly chainIds: readonly string[];
}

export interface TickPressureSummary {
  readonly tier: PressureTier;
  readonly score: number;
  readonly band: RunStateSnapshot['pressure']['band'];
  readonly contributors: readonly string[];
}

export interface TickIntegritySummary {
  readonly integrityStatus: RunStateSnapshot['sovereignty']['integrityStatus'];
  readonly proofHash: string | null;
  readonly warnings: readonly string[];
  readonly forkHints: readonly string[];
}

export interface TickExecutionResult {
  readonly runId: string;
  readonly tick: number;
  readonly phase: RunStateSnapshot['phase'];
  readonly mode: RunStateSnapshot['mode'];
  readonly outcome: RunOutcome | null;
  readonly checksum: string | null;
  readonly tickSeal: string | null;
  readonly tickDurationMs: number;
  readonly snapshot: RunStateSnapshot;
  readonly signals: readonly EngineSignal[];
  readonly emittedEvents: readonly EventEnvelope<
    keyof RuntimeEventMap,
    RuntimeEventMap[keyof RuntimeEventMap]
  >[];
  readonly traces: readonly TickTraceRecord[];
  readonly engineHealth: readonly EngineHealth[];
  readonly battle: TickBattleSummary;
  readonly shield: TickShieldSummary;
  readonly cascade: TickCascadeSummary;
  readonly pressure: TickPressureSummary;
  readonly integrity: TickIntegritySummary;
}

export interface TickResultBuilderInput {
  readonly snapshot: RunStateSnapshot;
  readonly tickDurationMs: number;
  readonly signals?: readonly EngineSignal[];
  readonly emittedEvents?: readonly EventEnvelope<
    keyof RuntimeEventMap,
    RuntimeEventMap[keyof RuntimeEventMap]
  >[];
  readonly traces?: readonly TickTraceRecord[];
  readonly engineHealth?: readonly EngineHealth[];
  readonly tickSeal?: string | null;
}

export class TickResultBuilder {
  public build(input: TickResultBuilderInput): TickExecutionResult {
    const snapshot = deepFrozenClone(input.snapshot);
    const signals = freezeArray(input.signals ?? []);
    const emittedEvents = freezeArray(input.emittedEvents ?? []);
    const traces = freezeArray(input.traces ?? []);
    const engineHealth = freezeArray(input.engineHealth ?? []);

    return Object.freeze({
      runId: snapshot.runId,
      tick: snapshot.tick,
      phase: snapshot.phase,
      mode: snapshot.mode,
      outcome: snapshot.outcome,
      checksum: snapshot.telemetry.lastTickChecksum,
      tickSeal: input.tickSeal ?? null,
      tickDurationMs: input.tickDurationMs,
      snapshot,
      signals,
      emittedEvents,
      traces,
      engineHealth,
      battle: this.buildBattleSummary(snapshot),
      shield: this.buildShieldSummary(snapshot),
      cascade: this.buildCascadeSummary(snapshot),
      pressure: this.buildPressureSummary(snapshot),
      integrity: this.buildIntegritySummary(snapshot),
    });
  }

  private buildBattleSummary(snapshot: RunStateSnapshot): TickBattleSummary {
    return Object.freeze({
      activeBots: snapshot.battle.bots.filter(
        (bot) => bot.state === 'WATCHING' || bot.state === 'TARGETING' || bot.state === 'ATTACKING',
      ).length,
      pendingAttacks: snapshot.battle.pendingAttacks.length,
      injectedAttacks: freezeArray(snapshot.battle.pendingAttacks),
    });
  }

  private buildShieldSummary(snapshot: RunStateSnapshot): TickShieldSummary {
    const entries = Object.entries(snapshot.shield.layers) as Array<
      [ShieldLayerId, (typeof snapshot.shield.layers)[ShieldLayerId]]
    >;

    const breachedLayers = entries
      .filter(([, layer]) => layer.integrity <= 0)
      .map(([layerId]) => layerId);

    let weakestLayer: ShieldLayerId | null = null;
    let weakestIntegrity = Number.POSITIVE_INFINITY;
    let aggregateIntegrity = 0;

    for (const [layerId, layer] of entries) {
      aggregateIntegrity += layer.integrity;

      if (layer.integrity < weakestIntegrity) {
        weakestIntegrity = layer.integrity;
        weakestLayer = layerId;
      }
    }

    return Object.freeze({
      weakestLayer,
      breachedLayers: freezeArray(breachedLayers),
      aggregateIntegrity,
    });
  }

  private buildCascadeSummary(snapshot: RunStateSnapshot): TickCascadeSummary {
    const activeChains = snapshot.cascade.activeChains.filter(
      (chain) => chain.status === 'ACTIVE',
    );
    const brokenChains = snapshot.cascade.activeChains.filter(
      (chain) => chain.status === 'BROKEN',
    );
    const completedChains = snapshot.cascade.activeChains.filter(
      (chain) => chain.status === 'COMPLETED',
    );
    const positiveChains = snapshot.cascade.activeChains.filter(
      (chain) => chain.positive === true,
    );

    return Object.freeze({
      activeChains: activeChains.length,
      brokenChains: brokenChains.length,
      completedChains: completedChains.length,
      positiveChains: positiveChains.length,
      chainIds: freezeArray(
        snapshot.cascade.activeChains.map((chain: CascadeChainInstance) => chain.chainId),
      ),
    });
  }

  private buildPressureSummary(snapshot: RunStateSnapshot): TickPressureSummary {
    return Object.freeze({
      tier: snapshot.pressure.tier,
      score: snapshot.pressure.score,
      band: snapshot.pressure.band,
      contributors: freezeArray(snapshot.pressure.contributors),
    });
  }

  private buildIntegritySummary(snapshot: RunStateSnapshot): TickIntegritySummary {
    return Object.freeze({
      integrityStatus: snapshot.sovereignty.integrityStatus,
      proofHash: snapshot.sovereignty.proofHash,
      warnings: freezeArray(snapshot.telemetry.warnings),
      forkHints: freezeArray(snapshot.telemetry.forkHints),
    });
  }
}