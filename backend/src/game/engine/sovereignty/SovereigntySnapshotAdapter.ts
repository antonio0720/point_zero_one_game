/* ========================================================================
 * POINT ZERO ONE — BACKEND SOVEREIGNTY SNAPSHOT ADAPTER
 * /backend/src/game/engine/sovereignty/SovereigntySnapshotAdapter.ts
 *
 * Doctrine:
 * - convert raw authoritative backend snapshots into sovereignty-native
 *   tick records and run summaries without mutating source state
 * - missing "this tick" deltas are derived by diffing sequential snapshots
 * - all derived values are deterministic and serialization-safe
 * ====================================================================== */

import {
  checksumSnapshot,
  computeProofHash,
  computeTickSeal,
  createDeterministicId,
} from '../core/Deterministic';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import { CORD_WEIGHTS, OUTCOME_MULTIPLIER } from './types';
import {
  badgeTierForGrade,
  DEFAULT_SOVEREIGNTY_CLIENT_VERSION,
  DEFAULT_SOVEREIGNTY_ENGINE_VERSION,
  normalizeGrade,
  normalizeIntegrityStatus,
  SOVEREIGNTY_CONTRACT_VERSION,
  type SovereigntyAdapterContext,
  type SovereigntyDecisionSample,
  type SovereigntyGrade,
  type SovereigntyRunSummary,
  type SovereigntyScoreBreakdown,
  type SovereigntyTickRecord,
} from './contracts';

type NumericMapLike =
  | Readonly<Record<string, number>>
  | ReadonlyMap<string, number>
  | null
  | undefined;

export class SovereigntySnapshotAdapter {
  public toDecisionSamples(
    snapshot: RunStateSnapshot,
    tick: number = snapshot.tick,
  ): readonly SovereigntyDecisionSample[] {
    const tickDurationMs = Math.max(1, snapshot.timers.currentTickDurationMs);

    return snapshot.telemetry.decisions
      .filter((decision) => decision.tick === tick)
      .map((decision) => ({
        tick: decision.tick,
        actorId: decision.actorId,
        cardId: decision.cardId,
        latencyMs: decision.latencyMs,
        accepted: decision.accepted,
        timingClass: [...decision.timingClass],
        normalizedSpeedScore: Number(
          Math.max(0, 1 - decision.latencyMs / tickDurationMs).toFixed(4),
        ),
      }));
  }

  public toTickRecord(
    snapshot: RunStateSnapshot,
    previousSnapshot: RunStateSnapshot | null = null,
    capturedAtMs: number = Date.now(),
  ): SovereigntyTickRecord {
    const decisionSamples = this.toDecisionSamples(snapshot);
    const acceptedDecisionsThisTick = decisionSamples.filter(
      (decision) => decision.accepted,
    ).length;

    const shieldAvgIntegrityPct = this.computeAverageShieldIntegrity(snapshot);
    const shieldWeakestIntegrityPct = this.computeWeakestShieldIntegrity(snapshot);

    const haterAttemptsThisTick = this.computeHaterAttemptsThisTick(
      snapshot,
      previousSnapshot,
    );
    const haterBlockedThisTick = this.computeBlockedThisTick(
      snapshot,
      previousSnapshot,
    );
    const haterDamagedThisTick = this.computeDamagedThisTick(
      snapshot,
      previousSnapshot,
    );
    const cascadesBrokenThisTick = this.computeBrokenCascadesThisTick(
      snapshot,
      previousSnapshot,
    );
    const cascadesTriggeredThisTick = this.computeTriggeredCascadesThisTick(
      snapshot,
      previousSnapshot,
      cascadesBrokenThisTick,
    );

    const stateChecksum = this.computeStateChecksum(snapshot);
    const tickChecksum =
      snapshot.telemetry.lastTickChecksum ??
      snapshot.sovereignty.tickChecksums[snapshot.sovereignty.tickChecksums.length - 1] ??
      computeTickSeal({
        runId: snapshot.runId,
        tick: snapshot.tick,
        step: snapshot.phase,
        stateChecksum,
        eventChecksums: decisionSamples.map((decision) =>
          checksumSnapshot({
            actorId: decision.actorId,
            cardId: decision.cardId,
            latencyMs: decision.latencyMs,
            accepted: decision.accepted,
          }),
        ),
      });

    return {
      contractVersion: SOVEREIGNTY_CONTRACT_VERSION,
      recordId: createDeterministicId('sov-tick-record', snapshot.runId, snapshot.tick),
      runId: snapshot.runId,
      userId: snapshot.userId,
      seed: snapshot.seed,
      mode: snapshot.mode,
      phase: snapshot.phase,
      outcome: snapshot.outcome,
      tickIndex: snapshot.tick,
      pressureScore: Number(snapshot.pressure.score.toFixed(4)),
      pressureTier: snapshot.pressure.tier,
      pressureBand: snapshot.pressure.band,
      shieldAvgIntegrityPct,
      shieldWeakestIntegrityPct,
      netWorth: Number(snapshot.economy.netWorth.toFixed(2)),
      haterHeat: Number(snapshot.economy.haterHeat.toFixed(4)),
      activeCascadeChains: snapshot.cascade.activeChains.length,
      haterAttemptsThisTick,
      haterBlockedThisTick,
      haterDamagedThisTick,
      cascadesTriggeredThisTick,
      cascadesBrokenThisTick,
      decisionsThisTick: decisionSamples.length,
      acceptedDecisionsThisTick,
      decisionSamples,
      pendingThreats: snapshot.battle.pendingAttacks.length,
      proofHash: snapshot.sovereignty.proofHash,
      tickChecksum,
      stateChecksum,
      tickStreamPosition: snapshot.tick,
      capturedAtMs,
    };
  }

  public toTickRecords(
    snapshots: readonly RunStateSnapshot[],
    capturedAtMs: number = Date.now(),
  ): readonly SovereigntyTickRecord[] {
    return snapshots.map((snapshot, index) =>
      this.toTickRecord(
        snapshot,
        index > 0 ? snapshots[index - 1] ?? null : null,
        capturedAtMs,
      ),
    );
  }

  public toRunSummary(
    finalSnapshot: RunStateSnapshot,
    history: readonly RunStateSnapshot[] | readonly SovereigntyTickRecord[] = [],
    context: SovereigntyAdapterContext = {},
  ): SovereigntyRunSummary {
    const tickRecords = this.resolveTickRecords(finalSnapshot, history, context);
    const completedAtMs = context.completedAtMs ?? Date.now();
    const startedAtMs = context.startedAtMs ?? Math.max(0, completedAtMs - finalSnapshot.timers.elapsedMs);

    const shieldIntegralSum = Number(
      tickRecords.reduce((sum, tick) => sum + tick.shieldAvgIntegrityPct, 0).toFixed(6),
    );
    const shieldSampleCount = tickRecords.length;
    const shieldAverageIntegrityPct =
      shieldSampleCount === 0
        ? this.computeAverageShieldIntegrity(finalSnapshot)
        : Number((shieldIntegralSum / shieldSampleCount).toFixed(6));

    const totalHaterAttempts = tickRecords.reduce(
      (sum, tick) => sum + tick.haterAttemptsThisTick,
      0,
    );
    const totalHaterBlocked = tickRecords.reduce(
      (sum, tick) => sum + tick.haterBlockedThisTick,
      0,
    );
    const totalHaterDamaged = tickRecords.reduce(
      (sum, tick) => sum + tick.haterDamagedThisTick,
      0,
    );
    const haterBlockRate = Number(
      (
        totalHaterBlocked /
        Math.max(1, totalHaterBlocked + totalHaterDamaged)
      ).toFixed(6),
    );

    const totalCascadeChainsTriggered = tickRecords.reduce(
      (sum, tick) => sum + tick.cascadesTriggeredThisTick,
      0,
    );
    const totalCascadeChainsBroken = tickRecords.reduce(
      (sum, tick) => sum + tick.cascadesBrokenThisTick,
      0,
    );
    const cascadeBreakRate = Number(
      (
        totalCascadeChainsBroken /
        Math.max(1, totalCascadeChainsTriggered)
      ).toFixed(6),
    );

    const flattenedDecisions = tickRecords.flatMap((tick) => tick.decisionSamples);
    const decisionCount = flattenedDecisions.length;
    const acceptedDecisionCount = flattenedDecisions.filter((decision) => decision.accepted).length;
    const averageDecisionLatencyMs =
      decisionCount === 0
        ? 0
        : Number(
            (
              flattenedDecisions.reduce((sum, decision) => sum + decision.latencyMs, 0) /
              decisionCount
            ).toFixed(2),
          );

    const decisionSpeedScore =
      decisionCount === 0
        ? 0
        : Number(
            (
              flattenedDecisions.reduce(
                (sum, decision) => sum + decision.normalizedSpeedScore,
                0,
              ) / decisionCount
            ).toFixed(6),
          );

    const scoreBreakdown = this.computeScoreBreakdown(
      finalSnapshot,
      shieldAverageIntegrityPct,
      haterBlockRate,
      cascadeBreakRate,
      decisionSpeedScore,
    );

    const tickStreamChecksum = checksumSnapshot(
      tickRecords.map((tick) => ({
        tickIndex: tick.tickIndex,
        stateChecksum: tick.stateChecksum,
        tickChecksum: tick.tickChecksum,
        haterAttemptsThisTick: tick.haterAttemptsThisTick,
        haterBlockedThisTick: tick.haterBlockedThisTick,
        haterDamagedThisTick: tick.haterDamagedThisTick,
        cascadesTriggeredThisTick: tick.cascadesTriggeredThisTick,
        cascadesBrokenThisTick: tick.cascadesBrokenThisTick,
        decisionsThisTick: tick.decisionsThisTick,
      })),
    );

    const proofHash =
      finalSnapshot.sovereignty.proofHash ??
      computeProofHash({
        seed: finalSnapshot.seed,
        tickStreamChecksum,
        outcome: finalSnapshot.outcome ?? 'ABANDONED',
        finalNetWorth: finalSnapshot.economy.netWorth,
        userId: finalSnapshot.userId,
      });

    const verifiedGrade = normalizeGrade(
      finalSnapshot.sovereignty.verifiedGrade ?? scoreBreakdown.computedGrade,
    );

    return {
      contractVersion: SOVEREIGNTY_CONTRACT_VERSION,
      runId: finalSnapshot.runId,
      userId: finalSnapshot.userId,
      seed: finalSnapshot.seed,
      mode: finalSnapshot.mode,
      outcome: finalSnapshot.outcome,
      tags: [
        ...finalSnapshot.tags,
        ...(context.extraTags ?? []),
      ],
      startedAtMs,
      completedAtMs,
      durationMs: Math.max(0, completedAtMs - startedAtMs),
      clientVersion: context.clientVersion ?? DEFAULT_SOVEREIGNTY_CLIENT_VERSION,
      engineVersion: context.engineVersion ?? DEFAULT_SOVEREIGNTY_ENGINE_VERSION,
      ticksSurvived: finalSnapshot.tick,
      seasonTickBudget:
        context.seasonTickBudget ??
        Math.max(
          finalSnapshot.tick,
          Math.floor(
            finalSnapshot.timers.seasonBudgetMs /
              Math.max(1, finalSnapshot.timers.currentTickDurationMs),
          ),
        ),
      finalNetWorth: Number(finalSnapshot.economy.netWorth.toFixed(2)),
      haterHeatAtEnd: Number(finalSnapshot.economy.haterHeat.toFixed(4)),
      shieldIntegralSum,
      shieldSampleCount,
      shieldAverageIntegrityPct,
      totalHaterAttempts,
      totalHaterBlocked,
      totalHaterDamaged,
      haterBlockRate,
      totalCascadeChainsTriggered,
      totalCascadeChainsBroken,
      cascadeBreakRate,
      activeCascadeChainsAtEnd: finalSnapshot.cascade.activeChains.length,
      decisionCount,
      acceptedDecisionCount,
      averageDecisionLatencyMs,
      decisionSpeedScore,
      pressureScoreAtEnd: Number(finalSnapshot.pressure.score.toFixed(6)),
      maxPressureScoreSeen: Number(finalSnapshot.pressure.maxScoreSeen.toFixed(6)),
      highPressureTicksSurvived: finalSnapshot.pressure.survivedHighPressureTicks,
      tickStreamChecksum,
      proofHash,
      integrityStatus: normalizeIntegrityStatus(finalSnapshot.sovereignty.integrityStatus),
      sovereigntyScore: Number(
        (
          finalSnapshot.sovereignty.sovereigntyScore > 0
            ? finalSnapshot.sovereignty.sovereigntyScore
            : scoreBreakdown.finalScore
        ).toFixed(6),
      ),
      verifiedGrade,
      badgeTier: badgeTierForGrade(verifiedGrade),
      proofBadges: [...finalSnapshot.sovereignty.proofBadges],
      gapVsLegend: Number(finalSnapshot.sovereignty.gapVsLegend.toFixed(6)),
      gapClosingRate: Number(finalSnapshot.sovereignty.gapClosingRate.toFixed(6)),
      cordScore: Number(
        (
          finalSnapshot.sovereignty.cordScore > 0
            ? finalSnapshot.sovereignty.cordScore
            : scoreBreakdown.finalScore
        ).toFixed(6),
      ),
      auditFlags: [...finalSnapshot.sovereignty.auditFlags],
      scoreBreakdown,
    };
  }

  private resolveTickRecords(
    finalSnapshot: RunStateSnapshot,
    history: readonly RunStateSnapshot[] | readonly SovereigntyTickRecord[],
    context: SovereigntyAdapterContext,
  ): readonly SovereigntyTickRecord[] {
    if (history.length === 0) {
      return [
        this.toTickRecord(finalSnapshot, null, context.completedAtMs ?? Date.now()),
      ];
    }

    const first = history[0];
    if (this.isTickRecord(first)) {
      return history as readonly SovereigntyTickRecord[];
    }

    return this.toTickRecords(
      history as readonly RunStateSnapshot[],
      context.completedAtMs ?? Date.now(),
    );
  }

  private computeScoreBreakdown(
    snapshot: RunStateSnapshot,
    shieldAverageIntegrityPct: number,
    haterBlockRate: number,
    cascadeBreakRate: number,
    decisionSpeedScore: number,
  ): SovereigntyScoreBreakdown {
    const pressureSurvivalScore = Number(
      (
        snapshot.pressure.survivedHighPressureTicks / Math.max(1, snapshot.tick)
      ).toFixed(6),
    );

    const weightedDecisionSpeed = Number(
      (decisionSpeedScore * CORD_WEIGHTS.decision_speed_score).toFixed(6),
    );
    const weightedShieldsMaintained = Number(
      (shieldAverageIntegrityPct * CORD_WEIGHTS.shields_maintained_pct).toFixed(6),
    );
    const weightedHaterBlocks = Number(
      (haterBlockRate * CORD_WEIGHTS.hater_sabotages_blocked).toFixed(6),
    );
    const weightedCascadeBreaks = Number(
      (cascadeBreakRate * CORD_WEIGHTS.cascade_chains_broken).toFixed(6),
    );
    const weightedPressureSurvival = Number(
      (pressureSurvivalScore * CORD_WEIGHTS.pressure_survived_score).toFixed(6),
    );

    const rawScore = Number(
      (
        weightedDecisionSpeed +
        weightedShieldsMaintained +
        weightedHaterBlocks +
        weightedCascadeBreaks +
        weightedPressureSurvival
      ).toFixed(6),
    );

    const outcomeKey = (snapshot.outcome ?? 'ABANDONED') as keyof typeof OUTCOME_MULTIPLIER;
    const outcomeMultiplier =
      OUTCOME_MULTIPLIER[outcomeKey] ?? OUTCOME_MULTIPLIER.ABANDONED;

    const finalScore = Number((rawScore * outcomeMultiplier).toFixed(6));
    const computedGrade = this.gradeForScore(finalScore);

    return {
      decisionSpeedScore,
      shieldsMaintainedPct: shieldAverageIntegrityPct,
      haterBlockRate,
      cascadeBreakRate,
      pressureSurvivalScore,
      weightedDecisionSpeed,
      weightedShieldsMaintained,
      weightedHaterBlocks,
      weightedCascadeBreaks,
      weightedPressureSurvival,
      rawScore,
      outcomeMultiplier,
      finalScore,
      computedGrade,
    };
  }

  private gradeForScore(score: number): SovereigntyGrade {
    if (score >= 1.5) {
      return 'S';
    }
    if (score >= 1.2) {
      return 'A';
    }
    if (score >= 0.9) {
      return 'B';
    }
    if (score >= 0.6) {
      return 'C';
    }
    if (score >= 0.3) {
      return 'D';
    }
    return 'F';
  }

  private computeStateChecksum(snapshot: RunStateSnapshot): string {
    return checksumSnapshot({
      runId: snapshot.runId,
      tick: snapshot.tick,
      phase: snapshot.phase,
      outcome: snapshot.outcome,
      economy: snapshot.economy,
      pressure: snapshot.pressure,
      tension: snapshot.tension,
      shield: snapshot.shield,
      battle: {
        bots: snapshot.battle.bots,
        pendingAttacks: snapshot.battle.pendingAttacks,
        extractionCooldownTicks: snapshot.battle.extractionCooldownTicks,
        firstBloodClaimed: snapshot.battle.firstBloodClaimed,
        neutralizedBotIds: snapshot.battle.neutralizedBotIds,
      },
      cascade: {
        activeChains: snapshot.cascade.activeChains,
        positiveTrackers: snapshot.cascade.positiveTrackers,
        brokenChains: snapshot.cascade.brokenChains,
        completedChains: snapshot.cascade.completedChains,
        repeatedTriggerCounts: snapshot.cascade.repeatedTriggerCounts,
        lastResolvedTick: snapshot.cascade.lastResolvedTick,
      },
      cards: snapshot.cards,
      modeState: snapshot.modeState,
      timers: snapshot.timers,
      telemetry: snapshot.telemetry,
      sovereignty: {
        integrityStatus: snapshot.sovereignty.integrityStatus,
        sovereigntyScore: snapshot.sovereignty.sovereigntyScore,
        verifiedGrade: snapshot.sovereignty.verifiedGrade,
        proofBadges: snapshot.sovereignty.proofBadges,
        gapVsLegend: snapshot.sovereignty.gapVsLegend,
        gapClosingRate: snapshot.sovereignty.gapClosingRate,
        cordScore: snapshot.sovereignty.cordScore,
        auditFlags: snapshot.sovereignty.auditFlags,
        lastVerifiedTick: snapshot.sovereignty.lastVerifiedTick,
      },
    });
  }

  private computeAverageShieldIntegrity(snapshot: RunStateSnapshot): number {
    if (snapshot.shield.layers.length === 0) {
      return 0;
    }

    const average =
      snapshot.shield.layers.reduce(
        (sum, layer) => sum + this.resolveShieldRatio(layer.current, layer.max, layer.integrityRatio),
        0,
      ) / snapshot.shield.layers.length;

    return Number(average.toFixed(6));
  }

  private computeWeakestShieldIntegrity(snapshot: RunStateSnapshot): number {
    if (snapshot.shield.layers.length === 0) {
      return 0;
    }

    const weakest = snapshot.shield.layers.reduce((min, layer) => {
      const ratio = this.resolveShieldRatio(layer.current, layer.max, layer.integrityRatio);
      return Math.min(min, ratio);
    }, Number.POSITIVE_INFINITY);

    return Number((Number.isFinite(weakest) ? weakest : 0).toFixed(6));
  }

  private resolveShieldRatio(
    current: number,
    max: number,
    fallback: number,
  ): number {
    if (Number.isFinite(fallback) && fallback >= 0) {
      return Number(fallback);
    }
    return Number((current / Math.max(1, max)).toFixed(6));
  }

  private computeHaterAttemptsThisTick(
    snapshot: RunStateSnapshot,
    previousSnapshot: RunStateSnapshot | null,
  ): number {
    const pendingAttacks = snapshot.battle.pendingAttacks.length;
    const botAttackEvents = snapshot.battle.bots.filter(
      (bot) => bot.lastAttackTick === snapshot.tick,
    ).length;

    const blockedDeltaFromBots =
      this.sumBotField(snapshot, 'attacksBlocked') -
      this.sumBotField(previousSnapshot, 'attacksBlocked');

    const landedDeltaFromBots =
      this.sumBotField(snapshot, 'attacksLanded') -
      this.sumBotField(previousSnapshot, 'attacksLanded');

    return Math.max(
      0,
      pendingAttacks,
      botAttackEvents,
      blockedDeltaFromBots + landedDeltaFromBots,
    );
  }

  private computeBlockedThisTick(
    snapshot: RunStateSnapshot,
    previousSnapshot: RunStateSnapshot | null,
  ): number {
    const shieldDelta =
      snapshot.shield.blockedThisRun -
      (previousSnapshot?.shield.blockedThisRun ?? 0);

    const botDelta =
      this.sumBotField(snapshot, 'attacksBlocked') -
      this.sumBotField(previousSnapshot, 'attacksBlocked');

    return Math.max(0, shieldDelta, botDelta);
  }

  private computeDamagedThisTick(
    snapshot: RunStateSnapshot,
    previousSnapshot: RunStateSnapshot | null,
  ): number {
    const shieldDelta =
      snapshot.shield.damagedThisRun -
      (previousSnapshot?.shield.damagedThisRun ?? 0);

    const botDelta =
      this.sumBotField(snapshot, 'attacksLanded') -
      this.sumBotField(previousSnapshot, 'attacksLanded');

    return Math.max(0, shieldDelta, botDelta);
  }

  private computeBrokenCascadesThisTick(
    snapshot: RunStateSnapshot,
    previousSnapshot: RunStateSnapshot | null,
  ): number {
    return Math.max(
      0,
      snapshot.cascade.brokenChains - (previousSnapshot?.cascade.brokenChains ?? 0),
    );
  }

  private computeTriggeredCascadesThisTick(
    snapshot: RunStateSnapshot,
    previousSnapshot: RunStateSnapshot | null,
    brokenThisTick: number,
  ): number {
    const repeatedCountsDelta =
      this.sumNumericMap(snapshot.cascade.repeatedTriggerCounts) -
      this.sumNumericMap(previousSnapshot?.cascade.repeatedTriggerCounts);

    const activeDelta =
      snapshot.cascade.activeChains.length -
      (previousSnapshot?.cascade.activeChains.length ?? 0);

    const completedDelta =
      snapshot.cascade.completedChains -
      (previousSnapshot?.cascade.completedChains ?? 0);

    return Math.max(0, repeatedCountsDelta, activeDelta, brokenThisTick, completedDelta);
  }

  private sumBotField(
    snapshot: RunStateSnapshot | null | undefined,
    field: 'attacksBlocked' | 'attacksLanded',
  ): number {
    if (!snapshot) {
      return 0;
    }
    return snapshot.battle.bots.reduce((sum, bot) => sum + bot[field], 0);
  }

  private sumNumericMap(value: NumericMapLike): number {
    if (value === null || value === undefined) {
      return 0;
    }

    if (value instanceof Map) {
      let total = 0;
      for (const numeric of value.values()) {
        total += Number(numeric ?? 0);
      }
      return total;
    }

    return Object.values(value).reduce((sum, numeric) => sum + Number(numeric ?? 0), 0);
  }

  private isTickRecord(value: unknown): value is SovereigntyTickRecord {
    if (value === null || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Partial<SovereigntyTickRecord>;
    return (
      candidate.contractVersion === SOVEREIGNTY_CONTRACT_VERSION &&
      typeof candidate.recordId === 'string' &&
      typeof candidate.tickIndex === 'number'
    );
  }
}