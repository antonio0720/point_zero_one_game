/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/ProofSealer.ts
 *
 * Doctrine:
 * - backend owns proof, integrity, and end-of-run sealing
 * - tick sealing must be deterministic and side-effect free
 * - final proof hash must be derived from stable canonical inputs
 * - integrity failures do not destroy the run record; they quarantine it
 * - scoring must stay backend-owned and mode-aware
 */

import type { IntegrityStatus, ModeCode } from './GamePrimitives';
import type { RunStateSnapshot } from './RunStateSnapshot';
import {
  checksumSnapshot,
  deepFrozenClone,
  sha256,
  stableStringify,
} from './Deterministic';

export type VerifiedGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface SealScoreComponents {
  readonly economyProgress: number;
  readonly shieldIntegrity: number;
  readonly battleDefense: number;
  readonly cascadeControl: number;
  readonly pressureDiscipline: number;
  readonly survivalRatio: number;
  readonly modeDifficultyBonus: number;
}

export interface SealScoreBreakdown {
  readonly components: SealScoreComponents;
  readonly rawScore: number;
  readonly outcomeMultiplier: number;
  readonly integrityMultiplier: number;
  readonly finalScore: number;
  readonly grade: VerifiedGrade;
}

export interface TickSealResult {
  readonly snapshot: RunStateSnapshot;
  readonly tickChecksum: string;
  readonly eventDigest: string;
  readonly tickStreamChecksum: string;
}

export interface RunSealResult {
  readonly snapshot: RunStateSnapshot;
  readonly tickChecksum: string;
  readonly eventDigest: string;
  readonly tickStreamChecksum: string;
  readonly proofHash: string;
  readonly integrityStatus: IntegrityStatus;
  readonly integrityReasons: readonly string[];
  readonly score: SealScoreBreakdown;
}

interface IntegrityAssessment {
  readonly status: IntegrityStatus;
  readonly reasons: readonly string[];
}

interface TickSealSurface {
  readonly runId: string;
  readonly userId: string;
  readonly seed: string;
  readonly mode: ModeCode;
  readonly tick: number;
  readonly phase: RunStateSnapshot['phase'];
  readonly outcome: RunStateSnapshot['outcome'];
  readonly economy: {
    readonly cash: number;
    readonly debt: number;
    readonly incomePerTick: number;
    readonly expensesPerTick: number;
    readonly netWorth: number;
    readonly freedomTarget: number;
    readonly haterHeat: number;
    readonly opportunitiesPurchased: number;
    readonly privilegePlays: number;
  };
  readonly pressure: {
    readonly score: number;
    readonly tier: RunStateSnapshot['pressure']['tier'];
    readonly previousTier: RunStateSnapshot['pressure']['previousTier'];
    readonly upwardCrossings: number;
    readonly survivedHighPressureTicks: number;
  };
  readonly tension: {
    readonly score: number;
    readonly anticipation: number;
    readonly maxPulseTriggered: boolean;
    readonly visibleThreats: ReadonlyArray<{
      readonly threatId: string;
      readonly source: string;
      readonly etaTicks: number;
      readonly severity: number;
      readonly visibleAs: string;
      readonly summary: string;
    }>;
  };
  readonly shield: {
    readonly weakestLayerId: RunStateSnapshot['shield']['weakestLayerId'];
    readonly blockedThisRun: number;
    readonly damagedThisRun: number;
    readonly breachesThisRun: number;
    readonly repairQueueDepth: number;
    readonly layers: ReadonlyArray<{
      readonly layerId: string;
      readonly label: string;
      readonly current: number;
      readonly max: number;
      readonly regenPerTick: number;
    }>;
  };
  readonly battle: {
    readonly battleBudget: number;
    readonly battleBudgetCap: number;
    readonly extractionCooldownTicks: number;
    readonly firstBloodClaimed: boolean;
    readonly sharedOpportunityDeckCursor: number;
    readonly rivalryHeatCarry: number;
    readonly bots: ReadonlyArray<{
      readonly botId: string;
      readonly label: string;
      readonly state: string;
      readonly heat: number;
      readonly lastAttackTick: number | null;
      readonly attacksLanded: number;
      readonly attacksBlocked: number;
      readonly neutralized: boolean;
    }>;
    readonly pendingAttacks: ReadonlyArray<{
      readonly attackId: string;
      readonly source: string;
      readonly targetEntity: string;
      readonly targetLayer: string;
      readonly category: string;
      readonly magnitude: number;
      readonly createdAtTick: number;
      readonly notes: readonly string[];
    }>;
  };
  readonly cascade: {
    readonly brokenChains: number;
    readonly completedChains: number;
    readonly positiveTrackers: readonly string[];
    readonly repeatedTriggerCounts: Record<string, number>;
    readonly activeChains: ReadonlyArray<{
      readonly chainId: string;
      readonly templateId: string;
      readonly trigger: string;
      readonly positive: boolean;
      readonly status: string;
      readonly createdAtTick: number;
      readonly recoveryTags: readonly string[];
      readonly links: ReadonlyArray<{
        readonly linkId: string;
        readonly scheduledTick: number;
        readonly summary: string;
        readonly effect: unknown;
      }>;
    }>;
  };
  readonly cards: {
    readonly hand: ReadonlyArray<{
      readonly instanceId: string;
      readonly definitionId: string;
      readonly cost: number;
      readonly targeting: string;
      readonly timingClass: readonly string[];
      readonly tags: readonly string[];
      readonly decayTicksRemaining: number | null;
    }>;
    readonly discard: readonly string[];
    readonly exhaust: readonly string[];
    readonly drawHistory: readonly string[];
    readonly lastPlayed: readonly string[];
    readonly ghostMarkers: ReadonlyArray<{
      readonly markerId: string;
      readonly tick: number;
      readonly kind: string;
      readonly cardId: string | null;
      readonly summary: string;
    }>;
  };
  readonly modeState: {
    readonly holdEnabled: boolean;
    readonly loadoutEnabled: boolean;
    readonly sharedTreasury: boolean;
    readonly sharedTreasuryBalance: number;
    readonly trustScores: Record<string, number>;
    readonly roleAssignments: Record<string, string>;
    readonly defectionStepByPlayer: Record<string, number>;
    readonly legendMarkersEnabled: boolean;
    readonly communityHeatModifier: number;
    readonly sharedOpportunityDeck: boolean;
    readonly counterIntelTier: number;
    readonly spectatorLimit: number;
    readonly phaseBoundaryWindowsRemaining: number;
    readonly bleedMode: boolean;
    readonly handicapIds: readonly string[];
    readonly advantageId: string | null;
    readonly disabledBots: readonly string[];
  };
  readonly timers: {
    readonly seasonBudgetMs: number;
    readonly extensionBudgetMs: number;
    readonly elapsedMs: number;
    readonly currentTickDurationMs: number;
    readonly holdCharges: number;
    readonly activeDecisionWindowIds: readonly string[];
    readonly frozenWindowIds: readonly string[];
  };
  readonly telemetry: {
    readonly decisionCount: number;
    readonly outcomeReason: string | null;
    readonly forkHints: readonly string[];
    readonly priorLastTickChecksum: string | null;
  };
  readonly eventDigest: string;
}

const OUTCOME_MULTIPLIERS: Record<
  Exclude<RunStateSnapshot['outcome'], null>,
  number
> = {
  FREEDOM: 1.5,
  TIMEOUT: 0.8,
  BANKRUPT: 0.4,
  ABANDONED: 0.0,
};

const INTEGRITY_MULTIPLIERS: Record<IntegrityStatus, number> = {
  VERIFIED: 1.0,
  UNVERIFIED: 0.82,
  QUARANTINED: 0.35,
  PENDING: 0.60,
};

const MODE_DIFFICULTY_BONUS: Record<ModeCode, number> = {
  solo: 0.00,
  pvp: 0.03,
  coop: 0.05,
  ghost: 0.04,
};

const GRADE_THRESHOLDS: ReadonlyArray<{
  readonly grade: VerifiedGrade;
  readonly min: number;
}> = [
  { grade: 'A', min: 1.10 },
  { grade: 'B', min: 0.80 },
  { grade: 'C', min: 0.55 },
  { grade: 'D', min: 0.30 },
  { grade: 'F', min: 0.00 },
];

const MAX_TICK_CHECKSUM_HISTORY = 4096;

export class ProofSealer {
  public sealTick(
    snapshot: RunStateSnapshot,
    eventFrames: readonly unknown[] = [],
  ): TickSealResult {
    const eventDigest = this.computeEventDigest(eventFrames);
    const tickChecksum = this.computeTickChecksum(snapshot, eventDigest);
    const tickChecksums = this.appendTickChecksum(
      snapshot.sovereignty.tickChecksums,
      tickChecksum,
    );

    const nextSnapshot = deepFrozenClone<RunStateSnapshot>({
      ...snapshot,
      sovereignty: {
        ...snapshot.sovereignty,
        tickChecksums,
        integrityStatus: this.computeInterimIntegrityStatus(
          snapshot,
          tickChecksums,
          tickChecksum,
        ),
      },
      telemetry: {
        ...snapshot.telemetry,
        lastTickChecksum: tickChecksum,
      },
    });

    return {
      snapshot: nextSnapshot,
      tickChecksum,
      eventDigest,
      tickStreamChecksum: this.computeTickStreamChecksum(tickChecksums),
    };
  }

  public sealRun(
    snapshot: RunStateSnapshot,
    eventFrames: readonly unknown[] = [],
  ): RunSealResult {
    const eventDigest = this.computeEventDigest(eventFrames);
    const tickChecksum = this.computeTickChecksum(snapshot, eventDigest);
    const tickChecksums = this.appendTickChecksum(
      snapshot.sovereignty.tickChecksums,
      tickChecksum,
    );
    const tickStreamChecksum = this.computeTickStreamChecksum(tickChecksums);

    const integrity = this.assessIntegrity(snapshot, tickChecksums, tickChecksum);
    const score = this.computeScore(snapshot, integrity.status);

    const outcome = snapshot.outcome ?? 'ABANDONED';
    const proofHash = this.computeProofHash(
      snapshot.seed,
      tickStreamChecksum,
      outcome,
      snapshot.economy.netWorth,
      snapshot.userId,
    );

    const nextGapVsLegend = this.computeGapVsLegend(snapshot, score.finalScore);
    const nextGapClosingRate = this.computeGapClosingRate(
      snapshot,
      nextGapVsLegend,
    );

    const proofBadges = this.deriveProofBadges(
      snapshot,
      integrity.status,
      score.grade,
      nextGapVsLegend,
      score,
    );

    const nextSnapshot = deepFrozenClone<RunStateSnapshot>({
      ...snapshot,
      sovereignty: {
        ...snapshot.sovereignty,
        tickChecksums,
        proofHash,
        integrityStatus: integrity.status,
        sovereigntyScore: score.finalScore,
        verifiedGrade: score.grade,
        proofBadges,
        gapVsLegend: nextGapVsLegend,
        gapClosingRate: nextGapClosingRate,
      },
      telemetry: {
        ...snapshot.telemetry,
        lastTickChecksum: tickChecksum,
      },
    });

    return {
      snapshot: nextSnapshot,
      tickChecksum,
      eventDigest,
      tickStreamChecksum,
      proofHash,
      integrityStatus: integrity.status,
      integrityReasons: integrity.reasons,
      score,
    };
  }

  public computeTickChecksum(
    snapshot: RunStateSnapshot,
    eventDigest: string = '',
  ): string {
    return checksumSnapshot(this.toTickSealSurface(snapshot, eventDigest));
  }

  public computeTickStreamChecksum(tickChecksums: readonly string[]): string {
    return sha256([...tickChecksums].join('|'));
  }

  public computeProofHash(
    seed: string,
    tickStreamChecksum: string,
    outcome: Exclude<RunStateSnapshot['outcome'], null>,
    finalNetWorth: number,
    userId: string,
  ): string {
    return sha256(
      [
        seed,
        tickStreamChecksum,
        outcome,
        finalNetWorth.toFixed(2),
        userId,
      ].join('|'),
    );
  }

  private computeEventDigest(eventFrames: readonly unknown[]): string {
    if (eventFrames.length === 0) {
      return sha256('');
    }

    return sha256(
      eventFrames.map((frame) => stableStringify(frame)).join('|'),
    );
  }

  private toTickSealSurface(
    snapshot: RunStateSnapshot,
    eventDigest: string,
  ): TickSealSurface {
    return {
      runId: snapshot.runId,
      userId: snapshot.userId,
      seed: snapshot.seed,
      mode: snapshot.mode,
      tick: snapshot.tick,
      phase: snapshot.phase,
      outcome: snapshot.outcome,
      economy: {
        cash: snapshot.economy.cash,
        debt: snapshot.economy.debt,
        incomePerTick: snapshot.economy.incomePerTick,
        expensesPerTick: snapshot.economy.expensesPerTick,
        netWorth: snapshot.economy.netWorth,
        freedomTarget: snapshot.economy.freedomTarget,
        haterHeat: snapshot.economy.haterHeat,
        opportunitiesPurchased: snapshot.economy.opportunitiesPurchased,
        privilegePlays: snapshot.economy.privilegePlays,
      },
      pressure: {
        score: snapshot.pressure.score,
        tier: snapshot.pressure.tier,
        previousTier: snapshot.pressure.previousTier,
        upwardCrossings: snapshot.pressure.upwardCrossings,
        survivedHighPressureTicks: snapshot.pressure.survivedHighPressureTicks,
      },
      tension: {
        score: snapshot.tension.score,
        anticipation: snapshot.tension.anticipation,
        maxPulseTriggered: snapshot.tension.maxPulseTriggered,
        visibleThreats: snapshot.tension.visibleThreats.map((threat) => ({
          threatId: threat.threatId,
          source: threat.source,
          etaTicks: threat.etaTicks,
          severity: threat.severity,
          visibleAs: threat.visibleAs,
          summary: threat.summary,
        })),
      },
      shield: {
        weakestLayerId: snapshot.shield.weakestLayerId,
        blockedThisRun: snapshot.shield.blockedThisRun,
        damagedThisRun: snapshot.shield.damagedThisRun,
        breachesThisRun: snapshot.shield.breachesThisRun,
        repairQueueDepth: snapshot.shield.repairQueueDepth,
        layers: snapshot.shield.layers.map((layer) => ({
          layerId: layer.layerId,
          label: layer.label,
          current: layer.current,
          max: layer.max,
          regenPerTick: layer.regenPerTick,
        })),
      },
      battle: {
        battleBudget: snapshot.battle.battleBudget,
        battleBudgetCap: snapshot.battle.battleBudgetCap,
        extractionCooldownTicks: snapshot.battle.extractionCooldownTicks,
        firstBloodClaimed: snapshot.battle.firstBloodClaimed,
        sharedOpportunityDeckCursor: snapshot.battle.sharedOpportunityDeckCursor,
        rivalryHeatCarry: snapshot.battle.rivalryHeatCarry,
        bots: snapshot.battle.bots.map((bot) => ({
          botId: bot.botId,
          label: bot.label,
          state: bot.state,
          heat: bot.heat,
          lastAttackTick: bot.lastAttackTick,
          attacksLanded: bot.attacksLanded,
          attacksBlocked: bot.attacksBlocked,
          neutralized: bot.neutralized,
        })),
        pendingAttacks: snapshot.battle.pendingAttacks.map((attack) => ({
          attackId: attack.attackId,
          source: attack.source,
          targetEntity: attack.targetEntity,
          targetLayer: attack.targetLayer,
          category: attack.category,
          magnitude: attack.magnitude,
          createdAtTick: attack.createdAtTick,
          notes: [...attack.notes],
        })),
      },
      cascade: {
        brokenChains: snapshot.cascade.brokenChains,
        completedChains: snapshot.cascade.completedChains,
        positiveTrackers: [...snapshot.cascade.positiveTrackers],
        repeatedTriggerCounts: { ...snapshot.cascade.repeatedTriggerCounts },
        activeChains: snapshot.cascade.activeChains.map((chain) => ({
          chainId: chain.chainId,
          templateId: chain.templateId,
          trigger: chain.trigger,
          positive: chain.positive,
          status: chain.status,
          createdAtTick: chain.createdAtTick,
          recoveryTags: [...chain.recoveryTags],
          links: chain.links.map((link) => ({
            linkId: link.linkId,
            scheduledTick: link.scheduledTick,
            summary: link.summary,
            effect: link.effect,
          })),
        })),
      },
      cards: {
        hand: snapshot.cards.hand.map((card) => ({
          instanceId: card.instanceId,
          definitionId: card.definitionId,
          cost: card.cost,
          targeting: card.targeting,
          timingClass: [...card.timingClass],
          tags: [...card.tags],
          decayTicksRemaining: card.decayTicksRemaining,
        })),
        discard: [...snapshot.cards.discard],
        exhaust: [...snapshot.cards.exhaust],
        drawHistory: [...snapshot.cards.drawHistory],
        lastPlayed: [...snapshot.cards.lastPlayed],
        ghostMarkers: snapshot.cards.ghostMarkers.map((marker) => ({
          markerId: marker.markerId,
          tick: marker.tick,
          kind: marker.kind,
          cardId: marker.cardId,
          summary: marker.summary,
        })),
      },
      modeState: {
        holdEnabled: snapshot.modeState.holdEnabled,
        loadoutEnabled: snapshot.modeState.loadoutEnabled,
        sharedTreasury: snapshot.modeState.sharedTreasury,
        sharedTreasuryBalance: snapshot.modeState.sharedTreasuryBalance,
        trustScores: { ...snapshot.modeState.trustScores },
        roleAssignments: { ...snapshot.modeState.roleAssignments },
        defectionStepByPlayer: { ...snapshot.modeState.defectionStepByPlayer },
        legendMarkersEnabled: snapshot.modeState.legendMarkersEnabled,
        communityHeatModifier: snapshot.modeState.communityHeatModifier,
        sharedOpportunityDeck: snapshot.modeState.sharedOpportunityDeck,
        counterIntelTier: snapshot.modeState.counterIntelTier,
        spectatorLimit: snapshot.modeState.spectatorLimit,
        phaseBoundaryWindowsRemaining:
          snapshot.modeState.phaseBoundaryWindowsRemaining,
        bleedMode: snapshot.modeState.bleedMode,
        handicapIds: [...snapshot.modeState.handicapIds],
        advantageId: snapshot.modeState.advantageId,
        disabledBots: [...snapshot.modeState.disabledBots],
      },
      timers: {
        seasonBudgetMs: snapshot.timers.seasonBudgetMs,
        extensionBudgetMs: snapshot.timers.extensionBudgetMs,
        elapsedMs: snapshot.timers.elapsedMs,
        currentTickDurationMs: snapshot.timers.currentTickDurationMs,
        holdCharges: snapshot.timers.holdCharges,
        activeDecisionWindowIds: Object.keys(snapshot.timers.activeDecisionWindows)
          .sort(),
        frozenWindowIds: [...snapshot.timers.frozenWindowIds].sort(),
      },
      telemetry: {
        decisionCount: snapshot.telemetry.decisions.length,
        outcomeReason: snapshot.telemetry.outcomeReason,
        forkHints: [...snapshot.telemetry.forkHints].sort(),
        priorLastTickChecksum: snapshot.telemetry.lastTickChecksum,
      },
      eventDigest,
    };
  }

  private appendTickChecksum(
    existing: readonly string[],
    tickChecksum: string,
  ): string[] {
    const next =
      existing.length > 0 && existing[existing.length - 1] === tickChecksum
        ? [...existing]
        : [...existing, tickChecksum];

    if (next.length <= MAX_TICK_CHECKSUM_HISTORY) {
      return next;
    }

    return next.slice(next.length - MAX_TICK_CHECKSUM_HISTORY);
  }

  private computeInterimIntegrityStatus(
    snapshot: RunStateSnapshot,
    tickChecksums: readonly string[],
    currentTickChecksum: string,
  ): IntegrityStatus {
    if (snapshot.outcome === null) {
      return this.hasNumericAnomalies(snapshot) ? 'QUARANTINED' : 'PENDING';
    }

    return this.assessIntegrity(snapshot, tickChecksums, currentTickChecksum)
      .status;
  }

  private assessIntegrity(
    snapshot: RunStateSnapshot,
    tickChecksums: readonly string[],
    currentTickChecksum: string,
  ): IntegrityAssessment {
    const reasons: string[] = [];

    if (this.hasNumericAnomalies(snapshot)) {
      reasons.push('Non-finite numeric surface detected in run snapshot.');
    }

    if (snapshot.tick < 0) {
      reasons.push('Negative tick index detected.');
    }

    if (tickChecksums.length === 0) {
      reasons.push('No tick checksums available.');
      return {
        status: snapshot.outcome === null ? 'PENDING' : 'UNVERIFIED',
        reasons,
      };
    }

    const duplicateCount = tickChecksums.length - new Set(tickChecksums).size;
    if (duplicateCount > 0) {
      reasons.push(`Duplicate tick checksum count=${duplicateCount}.`);
    }

    if (
      snapshot.telemetry.lastTickChecksum !== null &&
      snapshot.telemetry.lastTickChecksum !== currentTickChecksum
    ) {
      reasons.push('Telemetry lastTickChecksum diverges from recomputed seal.');
    }

    const expectedBudgetMs =
      snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs;
    const allowedElapsedCeiling =
      expectedBudgetMs + snapshot.timers.currentTickDurationMs * 2;
    if (snapshot.timers.elapsedMs > allowedElapsedCeiling) {
      reasons.push(
        `Elapsed time ${snapshot.timers.elapsedMs} exceeded seal ceiling ${allowedElapsedCeiling}.`,
      );
    }

    const expectedCount = Math.max(1, snapshot.tick + 1);
    if (tickChecksums.length > expectedCount + 1) {
      reasons.push(
        `Tick checksum history overshot expected count. expected<=${expectedCount + 1}, actual=${tickChecksums.length}.`,
      );
    }

    if (tickChecksums.length < Math.max(1, Math.floor(expectedCount * 0.60))) {
      reasons.push(
        `Tick checksum history too sparse for final proof. expected≈${expectedCount}, actual=${tickChecksums.length}.`,
      );
    }

    if (snapshot.outcome === null) {
      reasons.push('Run outcome is still pending.');
      return {
        status: reasons.length === 0 ? 'PENDING' : 'UNVERIFIED',
        reasons,
      };
    }

    if (
      reasons.some((reason) =>
        reason.includes('Non-finite') ||
        reason.includes('diverges') ||
        reason.includes('overshot'),
      ) ||
      duplicateCount > Math.max(1, Math.floor(tickChecksums.length * 0.20))
    ) {
      return {
        status: 'QUARANTINED',
        reasons,
      };
    }

    if (reasons.length > 0) {
      return {
        status: 'UNVERIFIED',
        reasons,
      };
    }

    return {
      status: 'VERIFIED',
      reasons,
    };
  }

  private hasNumericAnomalies(snapshot: RunStateSnapshot): boolean {
    const numericSurface: number[] = [
      snapshot.tick,
      snapshot.economy.cash,
      snapshot.economy.debt,
      snapshot.economy.incomePerTick,
      snapshot.economy.expensesPerTick,
      snapshot.economy.netWorth,
      snapshot.economy.freedomTarget,
      snapshot.economy.haterHeat,
      snapshot.pressure.score,
      snapshot.pressure.upwardCrossings,
      snapshot.pressure.survivedHighPressureTicks,
      snapshot.tension.score,
      snapshot.tension.anticipation,
      snapshot.shield.blockedThisRun,
      snapshot.shield.damagedThisRun,
      snapshot.shield.breachesThisRun,
      snapshot.shield.repairQueueDepth,
      snapshot.battle.battleBudget,
      snapshot.battle.battleBudgetCap,
      snapshot.battle.extractionCooldownTicks,
      snapshot.battle.sharedOpportunityDeckCursor,
      snapshot.battle.rivalryHeatCarry,
      snapshot.cascade.brokenChains,
      snapshot.cascade.completedChains,
      snapshot.sovereignty.sovereigntyScore,
      snapshot.sovereignty.gapVsLegend,
      snapshot.sovereignty.gapClosingRate,
      snapshot.timers.seasonBudgetMs,
      snapshot.timers.extensionBudgetMs,
      snapshot.timers.elapsedMs,
      snapshot.timers.currentTickDurationMs,
      snapshot.timers.holdCharges,
      ...snapshot.shield.layers.flatMap((layer) => [
        layer.current,
        layer.max,
        layer.regenPerTick,
      ]),
      ...snapshot.battle.bots.flatMap((bot) => [
        bot.heat,
        bot.attacksLanded,
        bot.attacksBlocked,
        bot.lastAttackTick ?? 0,
      ]),
      ...snapshot.battle.pendingAttacks.flatMap((attack) => [
        attack.magnitude,
        attack.createdAtTick,
      ]),
      ...snapshot.tension.visibleThreats.flatMap((threat) => [
        threat.etaTicks,
        threat.severity,
      ]),
    ];

    return numericSurface.some((value) => !Number.isFinite(value));
  }

  private computeScore(
    snapshot: RunStateSnapshot,
    integrityStatus: IntegrityStatus,
  ): SealScoreBreakdown {
    const economyProgress = this.clamp(
      snapshot.economy.netWorth /
        Math.max(1, snapshot.economy.freedomTarget),
      0,
      1.25,
    );

    const shieldIntegrity =
      snapshot.shield.layers.length === 0
        ? 0
        : snapshot.shield.layers.reduce((sum, layer) => {
            const ratio = layer.max <= 0 ? 0 : layer.current / layer.max;
            return sum + this.clamp(ratio, 0, 1);
          }, 0) / snapshot.shield.layers.length;

    const defenseDenominator =
      snapshot.shield.blockedThisRun +
      snapshot.shield.damagedThisRun +
      snapshot.shield.breachesThisRun;
    const battleDefense =
      defenseDenominator <= 0
        ? 1
        : this.clamp(
            snapshot.shield.blockedThisRun / defenseDenominator,
            0,
            1,
          );

    const cascadeDenominator =
      snapshot.cascade.completedChains + snapshot.cascade.brokenChains;
    const cascadeControl =
      cascadeDenominator <= 0
        ? 1
        : this.clamp(
            snapshot.cascade.completedChains / cascadeDenominator,
            0,
            1,
          );

    const pressureDiscipline = this.clamp(
      1 - snapshot.pressure.score / 100,
      0,
      1,
    );

    const survivalBudget =
      snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs;
    const survivalRatio = this.clamp(
      (snapshot.timers.elapsedMs + snapshot.timers.currentTickDurationMs) /
        Math.max(1, survivalBudget),
      0,
      1,
    );

    const modeDifficultyBonus = MODE_DIFFICULTY_BONUS[snapshot.mode];

    const components: SealScoreComponents = {
      economyProgress: this.round(economyProgress),
      shieldIntegrity: this.round(shieldIntegrity),
      battleDefense: this.round(battleDefense),
      cascadeControl: this.round(cascadeControl),
      pressureDiscipline: this.round(pressureDiscipline),
      survivalRatio: this.round(survivalRatio),
      modeDifficultyBonus: this.round(modeDifficultyBonus),
    };

    const rawScore = this.round(
      economyProgress * 0.22 +
        shieldIntegrity * 0.18 +
        battleDefense * 0.18 +
        cascadeControl * 0.14 +
        pressureDiscipline * 0.14 +
        survivalRatio * 0.14 +
        modeDifficultyBonus,
    );

    const outcomeMultiplier =
      snapshot.outcome === null ? 0.60 : OUTCOME_MULTIPLIERS[snapshot.outcome];

    const integrityMultiplier = INTEGRITY_MULTIPLIERS[integrityStatus];

    const finalScore = this.round(
      this.clamp(rawScore * outcomeMultiplier * integrityMultiplier, 0, 1.5),
    );

    return {
      components,
      rawScore,
      outcomeMultiplier,
      integrityMultiplier,
      finalScore,
      grade: this.gradeForScore(finalScore),
    };
  }

  private gradeForScore(score: number): VerifiedGrade {
    for (const threshold of GRADE_THRESHOLDS) {
      if (score >= threshold.min) {
        return threshold.grade;
      }
    }

    return 'F';
  }

  private deriveProofBadges(
    snapshot: RunStateSnapshot,
    integrityStatus: IntegrityStatus,
    grade: VerifiedGrade,
    nextGapVsLegend: number,
    score: SealScoreBreakdown,
  ): string[] {
    const badges = new Set<string>(snapshot.sovereignty.proofBadges);

    badges.add(`MODE_${snapshot.mode.toUpperCase()}`);
    badges.add(`GRADE_${grade}`);
    badges.add(`INTEGRITY_${integrityStatus}`);

    if (snapshot.outcome !== null) {
      badges.add(`OUTCOME_${snapshot.outcome}`);
    }

    if (
      score.components.battleDefense >= 0.85 &&
      snapshot.shield.breachesThisRun === 0
    ) {
      badges.add('UNBROKEN_SHIELD');
    }

    if (score.components.cascadeControl >= 0.80) {
      badges.add('CHAIN_MASTER');
    }

    if (snapshot.pressure.survivedHighPressureTicks >= 10) {
      badges.add('UNDER_FIRE');
    }

    if (
      snapshot.modeState.sharedTreasury &&
      snapshot.modeState.sharedTreasuryBalance > 0
    ) {
      badges.add('SYNDICATE_SOLVENT');
    }

    if (snapshot.modeState.legendMarkersEnabled) {
      badges.add('LEGEND_TRACKING_ACTIVE');
      if (nextGapVsLegend <= 0) {
        badges.add('LEGEND_CAUGHT');
      }
    }

    if (
      snapshot.modeState.counterIntelTier >= 4 &&
      integrityStatus === 'VERIFIED'
    ) {
      badges.add('COUNTER_INTEL_LOCK');
    }

    return [...badges].sort();
  }

  private computeGapVsLegend(
    snapshot: RunStateSnapshot,
    finalScore: number,
  ): number {
    if (!snapshot.modeState.legendMarkersEnabled) {
      return snapshot.sovereignty.gapVsLegend;
    }

    const baseline =
      snapshot.sovereignty.gapVsLegend > 0
        ? snapshot.sovereignty.gapVsLegend
        : snapshot.cards.ghostMarkers.length * 0.10;

    return this.round(Math.max(0, baseline - finalScore));
  }

  private computeGapClosingRate(
    snapshot: RunStateSnapshot,
    nextGapVsLegend: number,
  ): number {
    if (!snapshot.modeState.legendMarkersEnabled || snapshot.tick <= 0) {
      return snapshot.sovereignty.gapClosingRate;
    }

    const gapDelta = snapshot.sovereignty.gapVsLegend - nextGapVsLegend;
    return this.round(gapDelta / Math.max(1, snapshot.tick));
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private round(value: number): number {
    return Number(value.toFixed(6));
  }
}