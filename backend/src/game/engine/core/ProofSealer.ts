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
 *
 * Surface summary:
 *   § 1  — Exported interfaces and types
 *   § 2  — Internal scoring constants and surface definitions
 *   § 3  — ProofSealer (sealTick, sealRun, hash primitives)
 *   § 4  — CordScoreAnalyzer (per-run CORD score computation)
 *   § 5  — ProofBadgeEngine (badge derivation with full decision tree)
 *   § 6  — RunSealComparator (compare two sealed runs)
 *   § 7  — ReplayIntegrityVerifier (tick-stream replay checking)
 *   § 8  — ProofSealerMLExtractor (DL feature vectors from seal results)
 *   § 9  — ProofLedger (rolling history of proof hashes)
 *   § 10 — ProofSealerRollingStats (per-session health analytics)
 *   § 11 — Health grading and module constants
 *   § 12 — ProofSealerFacade (single entrypoint wiring all surfaces)
 */

import type { IntegrityStatus, ModeCode } from './GamePrimitives';
import type { RunStateSnapshot } from './RunStateSnapshot';
import {
  checksumSnapshot,
  deepFrozenClone,
  sha256,
  stableStringify,
} from './Deterministic';

// ============================================================================
// § 1 — Exported interfaces and types
// ============================================================================

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

/** CORD (Contribution Over Reference Data) score breakdown. */
export interface CordScoreBreakdown {
  readonly runId: string;
  readonly mode: ModeCode;
  readonly cordScore: number;
  readonly economyContribution: number;
  readonly shieldContribution: number;
  readonly cascadeContribution: number;
  readonly survivalContribution: number;
  readonly modeContribution: number;
  readonly integrityContribution: number;
  readonly outcomeContribution: number;
  readonly grade: VerifiedGrade;
  readonly percentileEstimate: number;
}

/** A single sealed run comparison record. */
export interface RunSealComparison {
  readonly runIdA: string;
  readonly runIdB: string;
  readonly scoreA: number;
  readonly scoreB: number;
  readonly winnerRunId: string | null;
  readonly scoreDelta: number;
  readonly gradeA: VerifiedGrade;
  readonly gradeB: VerifiedGrade;
  readonly integrityA: IntegrityStatus;
  readonly integrityB: IntegrityStatus;
  readonly componentDeltas: SealScoreComponents;
}

/** Result of replaying a sequence of tick checksums for integrity. */
export interface ReplayIntegrityResult {
  readonly runId: string;
  readonly tickCount: number;
  readonly verifiedTicks: number;
  readonly failedTicks: number;
  readonly duplicateCount: number;
  readonly checksumChainValid: boolean;
  readonly streamChecksum: string;
  readonly failureReasons: readonly string[];
  readonly integrityStatus: IntegrityStatus;
}

/** ML feature vector derived from a seal result. */
export interface ProofSealMLVector {
  readonly runId: string;
  readonly tick: number;
  readonly mode: ModeCode;
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly featureCount: number;
  readonly modelVersion: string;
}

/** An entry in the proof ledger. */
export interface ProofLedgerEntry {
  readonly runId: string;
  readonly proofHash: string;
  readonly integrityStatus: IntegrityStatus;
  readonly grade: VerifiedGrade;
  readonly finalScore: number;
  readonly mode: ModeCode;
  readonly tick: number;
  readonly outcome: RunStateSnapshot['outcome'];
  readonly sealedAtMs: number;
}

/** Rolling tick stats for health grading. */
export interface ProofSealerTickStats {
  readonly tick: number;
  readonly sealCount: number;
  readonly quarantineCount: number;
  readonly unverifiedCount: number;
  readonly verifiedCount: number;
  readonly avgFinalScore: number;
  readonly latencyMs: number;
}

/** Health summary for the proof sealer. */
export interface ProofSealerHealthSummary {
  readonly grade: ProofSealerHealthGrade;
  readonly totalSeals: number;
  readonly verifiedRatio: number;
  readonly quarantineRatio: number;
  readonly avgFinalScore: number;
  readonly avgLatencyMs: number;
  readonly warningFlags: readonly string[];
}

export type ProofSealerHealthGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

// ============================================================================
// § 2 — Internal scoring constants
// ============================================================================

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

/** CORD score weight distribution — must sum to 1.0. */
const CORD_WEIGHTS = Object.freeze({
  economy: 0.22,
  shield: 0.18,
  battle: 0.18,
  cascade: 0.14,
  pressure: 0.14,
  survival: 0.14,
} as const);

/** Percentile score approximation buckets (score → percentile). */
const PERCENTILE_BUCKETS: ReadonlyArray<{ readonly score: number; readonly pct: number }> = [
  { score: 1.4, pct: 99 },
  { score: 1.2, pct: 95 },
  { score: 1.0, pct: 85 },
  { score: 0.85, pct: 75 },
  { score: 0.70, pct: 60 },
  { score: 0.55, pct: 45 },
  { score: 0.40, pct: 30 },
  { score: 0.25, pct: 15 },
  { score: 0.10, pct: 5 },
  { score: 0, pct: 1 },
];

const PROOF_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  'economy_progress_01', 'shield_integrity_01', 'battle_defense_01',
  'cascade_control_01', 'pressure_discipline_01', 'survival_ratio_01',
  'mode_difficulty_bonus', 'outcome_multiplier', 'integrity_multiplier',
  'raw_score', 'final_score',
  'mode_solo', 'mode_pvp', 'mode_coop', 'mode_ghost',
  'outcome_freedom', 'outcome_timeout', 'outcome_bankrupt', 'outcome_abandoned', 'outcome_null',
  'integrity_verified', 'integrity_unverified', 'integrity_quarantined', 'integrity_pending',
  'tick_01', 'upward_crossings_01', 'survived_high_pressure_01',
  'breach_count_01', 'completed_chains_01', 'broken_chains_01',
  'decision_count_01', 'checksum_count_01', 'cord_score',
]);

export const PROOF_SEALER_ML_FEATURE_COUNT = PROOF_ML_FEATURE_LABELS.length as number;

const ML_MODEL_VERSION = '3.1.0' as const;

// ============================================================================
// § 3 — ProofSealer
// ============================================================================

/**
 * Authoritative backend proof sealer.
 *
 * Seals each tick into a deterministic checksum chain and produces
 * the final proof hash + integrity assessment + score breakdown on run end.
 *
 * All proofs are:
 * - Deterministic across identical inputs
 * - Mode-aware (difficulty bonus, ghost legend gap, coop solidarity)
 * - Integrity-gated (QUARANTINED runs receive 0.35× score multiplier)
 * - Signed by tickStreamChecksum + outcome + netWorth + userId
 */
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
        integrityStatus: this.computeInterimIntegrityStatus(snapshot, tickChecksums, tickChecksum),
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
    const tickChecksums = this.appendTickChecksum(snapshot.sovereignty.tickChecksums, tickChecksum);
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
    const nextGapClosingRate = this.computeGapClosingRate(snapshot, nextGapVsLegend);

    const proofBadges = this.deriveProofBadges(
      snapshot,
      integrity.status,
      score.grade,
      nextGapVsLegend,
      score,
    );

    const cordScore = this.computeCordScoreFromComponents(score.components, integrity.status, outcome);

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
        cordScore,
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
      [seed, tickStreamChecksum, outcome, finalNetWorth.toFixed(2), userId].join('|'),
    );
  }

  /** Compute the CORD score from score components and integrity. */
  private computeCordScoreFromComponents(
    components: SealScoreComponents,
    integrityStatus: IntegrityStatus,
    outcome: RunStateSnapshot['outcome'],
  ): number {
    const base =
      components.economyProgress * CORD_WEIGHTS.economy +
      components.shieldIntegrity * CORD_WEIGHTS.shield +
      components.battleDefense * CORD_WEIGHTS.battle +
      components.cascadeControl * CORD_WEIGHTS.cascade +
      components.pressureDiscipline * CORD_WEIGHTS.pressure +
      components.survivalRatio * CORD_WEIGHTS.survival;

    const intMult = INTEGRITY_MULTIPLIERS[integrityStatus];
    const outMult = outcome === null ? 0.6 : OUTCOME_MULTIPLIERS[outcome];

    return this.round(this.clamp(base * intMult * outMult, 0, 1.5));
  }

  private computeEventDigest(eventFrames: readonly unknown[]): string {
    if (eventFrames.length === 0) return sha256('');
    return sha256(eventFrames.map((frame) => stableStringify(frame)).join('|'));
  }

  private toTickSealSurface(snapshot: RunStateSnapshot, eventDigest: string): TickSealSurface {
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
        phaseBoundaryWindowsRemaining: snapshot.modeState.phaseBoundaryWindowsRemaining,
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
        activeDecisionWindowIds: Object.keys(snapshot.timers.activeDecisionWindows).sort(),
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

  private appendTickChecksum(existing: readonly string[], tickChecksum: string): string[] {
    const next =
      existing.length > 0 && existing[existing.length - 1] === tickChecksum
        ? [...existing]
        : [...existing, tickChecksum];

    if (next.length <= MAX_TICK_CHECKSUM_HISTORY) return next;
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
    return this.assessIntegrity(snapshot, tickChecksums, currentTickChecksum).status;
  }

  public assessIntegrity(
    snapshot: RunStateSnapshot,
    tickChecksums: readonly string[],
    currentTickChecksum: string,
  ): IntegrityAssessment {
    const reasons: string[] = [];

    if (this.hasNumericAnomalies(snapshot)) {
      reasons.push('Non-finite numeric surface detected in run snapshot.');
    }

    if (snapshot.tick < 0) reasons.push('Negative tick index detected.');

    if (tickChecksums.length === 0) {
      reasons.push('No tick checksums available.');
      return { status: snapshot.outcome === null ? 'PENDING' : 'UNVERIFIED', reasons };
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

    const expectedBudgetMs = snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs;
    const allowedElapsedCeiling = expectedBudgetMs + snapshot.timers.currentTickDurationMs * 2;
    if (snapshot.timers.elapsedMs > allowedElapsedCeiling) {
      reasons.push(`Elapsed time ${snapshot.timers.elapsedMs} exceeded seal ceiling ${allowedElapsedCeiling}.`);
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
      return { status: reasons.length === 0 ? 'PENDING' : 'UNVERIFIED', reasons };
    }

    if (
      reasons.some((reason) =>
        reason.includes('Non-finite') ||
        reason.includes('diverges') ||
        reason.includes('overshot'),
      ) ||
      duplicateCount > Math.max(1, Math.floor(tickChecksums.length * 0.20))
    ) {
      return { status: 'QUARANTINED', reasons };
    }

    if (reasons.length > 0) return { status: 'UNVERIFIED', reasons };
    return { status: 'VERIFIED', reasons };
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
      ...snapshot.shield.layers.flatMap((layer) => [layer.current, layer.max, layer.regenPerTick]),
      ...snapshot.battle.bots.flatMap((bot) => [bot.heat, bot.attacksLanded, bot.attacksBlocked, bot.lastAttackTick ?? 0]),
      ...snapshot.battle.pendingAttacks.flatMap((attack) => [attack.magnitude, attack.createdAtTick]),
      ...snapshot.tension.visibleThreats.flatMap((threat) => [threat.etaTicks, threat.severity]),
    ];
    return numericSurface.some((value) => !Number.isFinite(value));
  }

  public computeScore(snapshot: RunStateSnapshot, integrityStatus: IntegrityStatus): SealScoreBreakdown {
    const economyProgress = this.clamp(
      snapshot.economy.netWorth / Math.max(1, snapshot.economy.freedomTarget),
      0, 1.25,
    );

    const shieldIntegrity =
      snapshot.shield.layers.length === 0
        ? 0
        : snapshot.shield.layers.reduce((sum, layer) => {
            const ratio = layer.max <= 0 ? 0 : layer.current / layer.max;
            return sum + this.clamp(ratio, 0, 1);
          }, 0) / snapshot.shield.layers.length;

    const defenseDenominator =
      snapshot.shield.blockedThisRun + snapshot.shield.damagedThisRun + snapshot.shield.breachesThisRun;
    const battleDefense =
      defenseDenominator <= 0 ? 1 : this.clamp(snapshot.shield.blockedThisRun / defenseDenominator, 0, 1);

    const cascadeDenominator = snapshot.cascade.completedChains + snapshot.cascade.brokenChains;
    const cascadeControl =
      cascadeDenominator <= 0 ? 1 : this.clamp(snapshot.cascade.completedChains / cascadeDenominator, 0, 1);

    const pressureDiscipline = this.clamp(1 - snapshot.pressure.score / 100, 0, 1);

    const survivalBudget = snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs;
    const survivalRatio = this.clamp(
      (snapshot.timers.elapsedMs + snapshot.timers.currentTickDurationMs) / Math.max(1, survivalBudget),
      0, 1,
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
    const finalScore = this.round(this.clamp(rawScore * outcomeMultiplier * integrityMultiplier, 0, 1.5));

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
      if (score >= threshold.min) return threshold.grade;
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

    if (snapshot.outcome !== null) badges.add(`OUTCOME_${snapshot.outcome}`);

    if (score.components.battleDefense >= 0.85 && snapshot.shield.breachesThisRun === 0) {
      badges.add('UNBROKEN_SHIELD');
    }

    if (score.components.cascadeControl >= 0.80) badges.add('CHAIN_MASTER');
    if (snapshot.pressure.survivedHighPressureTicks >= 10) badges.add('UNDER_FIRE');

    if (snapshot.modeState.sharedTreasury && snapshot.modeState.sharedTreasuryBalance > 0) {
      badges.add('SYNDICATE_SOLVENT');
    }

    if (snapshot.modeState.legendMarkersEnabled) {
      badges.add('LEGEND_TRACKING_ACTIVE');
      if (nextGapVsLegend <= 0) badges.add('LEGEND_CAUGHT');
    }

    if (snapshot.modeState.counterIntelTier >= 4 && integrityStatus === 'VERIFIED') {
      badges.add('COUNTER_INTEL_LOCK');
    }

    // Mode-specific badges
    if (snapshot.mode === 'pvp' && snapshot.battle.firstBloodClaimed) badges.add('FIRST_BLOOD');
    if (snapshot.mode === 'coop') {
      const noDefection = Object.values(snapshot.modeState.defectionStepByPlayer).every((v) => v === 0);
      if (noDefection) badges.add('ZERO_DEFECTION');
    }

    if (snapshot.mode === 'ghost' && score.components.economyProgress >= 0.90) {
      badges.add('PHANTOM_PARITY');
    }

    // Economy mastery
    if (score.components.economyProgress >= 1.10) badges.add('ECONOMY_MASTERY');
    if (snapshot.economy.opportunitiesPurchased >= 10) badges.add('OPPORTUNITY_HUNTER');

    // Sovereignty
    if (snapshot.phase === 'SOVEREIGNTY') badges.add('SOVEREIGNTY_REACHED');

    return [...badges].sort();
  }

  private computeGapVsLegend(snapshot: RunStateSnapshot, finalScore: number): number {
    if (!snapshot.modeState.legendMarkersEnabled) return snapshot.sovereignty.gapVsLegend;
    const baseline =
      snapshot.sovereignty.gapVsLegend > 0
        ? snapshot.sovereignty.gapVsLegend
        : snapshot.cards.ghostMarkers.length * 0.10;
    return this.round(Math.max(0, baseline - finalScore));
  }

  private computeGapClosingRate(snapshot: RunStateSnapshot, nextGapVsLegend: number): number {
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

// ============================================================================
// § 4 — CordScoreAnalyzer
// ============================================================================

/**
 * Produces a full CORD score breakdown for a sealed run.
 * CORD = Contribution Over Reference Data.
 * Used by sovereignty scoring, leaderboards, and legend tracking.
 */
export class CordScoreAnalyzer {
  private readonly sealer: ProofSealer;

  public constructor(sealer?: ProofSealer) {
    this.sealer = sealer ?? new ProofSealer();
  }

  public analyze(sealResult: RunSealResult): CordScoreBreakdown {
    const snapshot = sealResult.snapshot;
    const components = sealResult.score.components;

    const economyContribution = components.economyProgress * CORD_WEIGHTS.economy;
    const shieldContribution = components.shieldIntegrity * CORD_WEIGHTS.shield;
    const cascadeContribution = components.cascadeControl * CORD_WEIGHTS.cascade;
    const survivalContribution = components.survivalRatio * CORD_WEIGHTS.survival;
    const modeContribution = components.modeDifficultyBonus;

    const integrityFactor = INTEGRITY_MULTIPLIERS[sealResult.integrityStatus];
    const outcomeFactor =
      snapshot.outcome === null ? 0.6 : OUTCOME_MULTIPLIERS[snapshot.outcome];

    const integrityContribution = sealResult.score.rawScore * (integrityFactor - 1);
    const outcomeContribution = sealResult.score.rawScore * (outcomeFactor - 1);

    const cordScore = this.clamp(sealResult.score.finalScore, 0, 1.5);
    const percentileEstimate = this.estimatePercentile(cordScore);

    return {
      runId: snapshot.runId,
      mode: snapshot.mode,
      cordScore: Number(cordScore.toFixed(6)),
      economyContribution: Number(economyContribution.toFixed(6)),
      shieldContribution: Number(shieldContribution.toFixed(6)),
      cascadeContribution: Number(cascadeContribution.toFixed(6)),
      survivalContribution: Number(survivalContribution.toFixed(6)),
      modeContribution: Number(modeContribution.toFixed(6)),
      integrityContribution: Number(integrityContribution.toFixed(6)),
      outcomeContribution: Number(outcomeContribution.toFixed(6)),
      grade: sealResult.score.grade,
      percentileEstimate,
    };
  }

  /** Compute a live (mid-run) CORD estimate from a snapshot. */
  public estimateLive(snapshot: RunStateSnapshot): number {
    const integrityStatus = snapshot.sovereignty.integrityStatus;
    const score = this.sealer.computeScore(snapshot, integrityStatus);
    return this.clamp(score.finalScore, 0, 1.5);
  }

  private estimatePercentile(cordScore: number): number {
    for (const bucket of PERCENTILE_BUCKETS) {
      if (cordScore >= bucket.score) return bucket.pct;
    }
    return 1;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}

// ============================================================================
// § 5 — ProofBadgeEngine
// ============================================================================

/**
 * Produces a detailed badge projection with contextual decision logic.
 * Extends the base badge derivation in ProofSealer with per-badge explanations.
 */
export class ProofBadgeEngine {
  public buildDetailedProjection(
    snapshot: RunStateSnapshot,
    integrityStatus: IntegrityStatus,
    scoreBreakdown: SealScoreBreakdown,
  ): {
    readonly achieved: ReadonlyArray<{ badge: string; reason: string }>;
    readonly blocked: ReadonlyArray<{ badge: string; reason: string }>;
    readonly inProgress: ReadonlyArray<{ badge: string; reason: string; progressPct: number }>;
  } {
    const achieved: Array<{ badge: string; reason: string }> = [];
    const blocked: Array<{ badge: string; reason: string }> = [];
    const inProgress: Array<{ badge: string; reason: string; progressPct: number }> = [];

    // UNBROKEN_SHIELD
    if (snapshot.shield.breachesThisRun === 0 && scoreBreakdown.components.battleDefense >= 0.85) {
      achieved.push({ badge: 'UNBROKEN_SHIELD', reason: 'No shield breaches and defense ≥85%.' });
    } else if (snapshot.shield.breachesThisRun === 0) {
      inProgress.push({
        badge: 'UNBROKEN_SHIELD',
        reason: 'Shield intact but defense needs improvement.',
        progressPct: Math.round(scoreBreakdown.components.battleDefense * 100),
      });
    } else {
      blocked.push({ badge: 'UNBROKEN_SHIELD', reason: `Shield breached ${snapshot.shield.breachesThisRun} time(s).` });
    }

    // CHAIN_MASTER
    if (scoreBreakdown.components.cascadeControl >= 0.80) {
      achieved.push({ badge: 'CHAIN_MASTER', reason: 'Cascade control ratio ≥80%.' });
    } else if (snapshot.cascade.completedChains > 0) {
      inProgress.push({
        badge: 'CHAIN_MASTER',
        reason: 'Chains completing but ratio below 80%.',
        progressPct: Math.round(scoreBreakdown.components.cascadeControl * 100),
      });
    } else {
      blocked.push({ badge: 'CHAIN_MASTER', reason: 'No cascade chains completed.' });
    }

    // UNDER_FIRE
    if (snapshot.pressure.survivedHighPressureTicks >= 10) {
      achieved.push({ badge: 'UNDER_FIRE', reason: `Survived ${snapshot.pressure.survivedHighPressureTicks} high-pressure ticks.` });
    } else {
      inProgress.push({
        badge: 'UNDER_FIRE',
        reason: 'Surviving high pressure ticks — need 10 total.',
        progressPct: Math.round((snapshot.pressure.survivedHighPressureTicks / 10) * 100),
      });
    }

    // INTEGRITY badges
    if (integrityStatus === 'VERIFIED') {
      achieved.push({ badge: 'INTEGRITY_VERIFIED', reason: 'Run passed all integrity checks.' });
    } else if (integrityStatus === 'QUARANTINED') {
      blocked.push({ badge: 'INTEGRITY_VERIFIED', reason: 'Run is quarantined — integrity failure.' });
    } else {
      inProgress.push({
        badge: 'INTEGRITY_VERIFIED',
        reason: 'Integrity pending — run still in progress.',
        progressPct: integrityStatus === 'PENDING' ? 50 : 25,
      });
    }

    // ECONOMY_MASTERY
    const economyProgress = snapshot.economy.netWorth / Math.max(1, snapshot.economy.freedomTarget);
    if (scoreBreakdown.components.economyProgress >= 1.10) {
      achieved.push({ badge: 'ECONOMY_MASTERY', reason: 'Net worth exceeded freedom target by 10%+.' });
    } else {
      inProgress.push({
        badge: 'ECONOMY_MASTERY',
        reason: `Economy at ${(economyProgress * 100).toFixed(1)}% of freedom target.`,
        progressPct: Math.round(Math.min(100, economyProgress * 100)),
      });
    }

    // COUNTER_INTEL_LOCK
    if (snapshot.modeState.counterIntelTier >= 4 && integrityStatus === 'VERIFIED') {
      achieved.push({ badge: 'COUNTER_INTEL_LOCK', reason: 'Counter-intel tier 4 + verified integrity.' });
    } else if (snapshot.modeState.counterIntelTier >= 3) {
      inProgress.push({
        badge: 'COUNTER_INTEL_LOCK',
        reason: `Counter-intel at tier ${snapshot.modeState.counterIntelTier}. Need 4 + VERIFIED.`,
        progressPct: Math.round((snapshot.modeState.counterIntelTier / 4) * 100),
      });
    } else {
      blocked.push({ badge: 'COUNTER_INTEL_LOCK', reason: `Counter-intel tier ${snapshot.modeState.counterIntelTier} — needs 4.` });
    }

    // Mode-specific
    if (snapshot.mode === 'pvp') {
      if (snapshot.battle.firstBloodClaimed) {
        achieved.push({ badge: 'FIRST_BLOOD', reason: 'First attack landed this run.' });
      } else {
        blocked.push({ badge: 'FIRST_BLOOD', reason: 'No attack landed yet.' });
      }
    }

    if (snapshot.mode === 'coop') {
      const allLoyal = Object.values(snapshot.modeState.defectionStepByPlayer).every((v) => v === 0);
      if (allLoyal) {
        achieved.push({ badge: 'ZERO_DEFECTION', reason: 'No defection events in coop run.' });
      } else {
        blocked.push({ badge: 'ZERO_DEFECTION', reason: 'Defection events present.' });
      }
    }

    return Object.freeze({ achieved, blocked, inProgress });
  }
}

// ============================================================================
// § 6 — RunSealComparator
// ============================================================================

/**
 * Compares two sealed run results for leaderboard and legend tracking.
 */
export class RunSealComparator {
  public compare(resultA: RunSealResult, resultB: RunSealResult): RunSealComparison {
    const scoreA = resultA.score.finalScore;
    const scoreB = resultB.score.finalScore;
    const delta = scoreA - scoreB;

    const winner =
      Math.abs(delta) < 0.001 ? null
      : delta > 0 ? resultA.snapshot.runId
      : resultB.snapshot.runId;

    const componentDeltas: SealScoreComponents = {
      economyProgress: Number((resultA.score.components.economyProgress - resultB.score.components.economyProgress).toFixed(6)),
      shieldIntegrity: Number((resultA.score.components.shieldIntegrity - resultB.score.components.shieldIntegrity).toFixed(6)),
      battleDefense: Number((resultA.score.components.battleDefense - resultB.score.components.battleDefense).toFixed(6)),
      cascadeControl: Number((resultA.score.components.cascadeControl - resultB.score.components.cascadeControl).toFixed(6)),
      pressureDiscipline: Number((resultA.score.components.pressureDiscipline - resultB.score.components.pressureDiscipline).toFixed(6)),
      survivalRatio: Number((resultA.score.components.survivalRatio - resultB.score.components.survivalRatio).toFixed(6)),
      modeDifficultyBonus: Number((resultA.score.components.modeDifficultyBonus - resultB.score.components.modeDifficultyBonus).toFixed(6)),
    };

    return {
      runIdA: resultA.snapshot.runId,
      runIdB: resultB.snapshot.runId,
      scoreA,
      scoreB,
      winnerRunId: winner,
      scoreDelta: Number(delta.toFixed(6)),
      gradeA: resultA.score.grade,
      gradeB: resultB.score.grade,
      integrityA: resultA.integrityStatus,
      integrityB: resultB.integrityStatus,
      componentDeltas,
    };
  }

  /** Rank an array of sealed runs by final score (descending). */
  public rank(results: readonly RunSealResult[]): readonly RunSealResult[] {
    return [...results].sort((a, b) => b.score.finalScore - a.score.finalScore);
  }

  /** Check if resultA is a personal best vs a previous best score. */
  public isPersonalBest(resultA: RunSealResult, previousBestScore: number): boolean {
    return resultA.score.finalScore > previousBestScore;
  }
}

// ============================================================================
// § 7 — ReplayIntegrityVerifier
// ============================================================================

/**
 * Verifies a sequence of tick checksums for replay integrity.
 *
 * In production, this is called after a run completes to confirm that
 * the tick stream was not tampered with between client and backend.
 */
export class ReplayIntegrityVerifier {
  private readonly sealer: ProofSealer;

  public constructor(sealer?: ProofSealer) {
    this.sealer = sealer ?? new ProofSealer();
  }

  public verify(
    runId: string,
    tickChecksums: readonly string[],
    expectedStreamChecksum: string,
  ): ReplayIntegrityResult {
    const failureReasons: string[] = [];

    if (tickChecksums.length === 0) {
      return {
        runId,
        tickCount: 0,
        verifiedTicks: 0,
        failedTicks: 0,
        duplicateCount: 0,
        checksumChainValid: false,
        streamChecksum: '',
        failureReasons: ['No tick checksums provided.'],
        integrityStatus: 'UNVERIFIED',
      };
    }

    const seen = new Set<string>();
    let duplicateCount = 0;
    let verifiedTicks = 0;
    let failedTicks = 0;

    for (const checksum of tickChecksums) {
      if (typeof checksum !== 'string' || checksum.length === 0) {
        failedTicks++;
        failureReasons.push('Empty or invalid checksum in stream.');
        continue;
      }
      if (seen.has(checksum)) {
        duplicateCount++;
      }
      seen.add(checksum);
      verifiedTicks++;
    }

    const computedStreamChecksum = this.sealer.computeTickStreamChecksum(tickChecksums);
    const checksumChainValid = computedStreamChecksum === expectedStreamChecksum;

    if (!checksumChainValid) {
      failureReasons.push(
        `Stream checksum mismatch. Expected: ${expectedStreamChecksum}, computed: ${computedStreamChecksum}.`,
      );
    }

    if (duplicateCount > Math.max(1, Math.floor(tickChecksums.length * 0.20))) {
      failureReasons.push(`Excessive duplicate checksums: ${duplicateCount} out of ${tickChecksums.length}.`);
    }

    const integrityStatus: IntegrityStatus =
      failureReasons.length === 0 ? 'VERIFIED'
      : failureReasons.some((r) => r.includes('mismatch')) ? 'QUARANTINED'
      : 'UNVERIFIED';

    return {
      runId,
      tickCount: tickChecksums.length,
      verifiedTicks,
      failedTicks,
      duplicateCount,
      checksumChainValid,
      streamChecksum: computedStreamChecksum,
      failureReasons: Object.freeze(failureReasons),
      integrityStatus,
    };
  }

  /** Cross-verify two streams from different sources (server + client). */
  public crossVerify(
    runId: string,
    serverChecksums: readonly string[],
    clientChecksums: readonly string[],
  ): { readonly match: boolean; readonly divergenceAtTick: number | null; readonly reasons: readonly string[] } {
    const reasons: string[] = [];
    let divergenceAtTick: number | null = null;

    const minLen = Math.min(serverChecksums.length, clientChecksums.length);
    for (let i = 0; i < minLen; i++) {
      if (serverChecksums[i] !== clientChecksums[i]) {
        divergenceAtTick = i;
        reasons.push(`Checksum divergence at tick ${i}. Server: ${serverChecksums[i]}, Client: ${clientChecksums[i]}.`);
        break;
      }
    }

    if (serverChecksums.length !== clientChecksums.length) {
      reasons.push(`Length mismatch. Server: ${serverChecksums.length}, Client: ${clientChecksums.length}.`);
    }

    void runId; // captured for future audit log integration
    return Object.freeze({ match: reasons.length === 0, divergenceAtTick, reasons });
  }
}

// ============================================================================
// § 8 — ProofSealerMLExtractor
// ============================================================================

/**
 * Extracts DL feature vectors from seal results for ML model ingestion.
 */
export class ProofSealerMLExtractor {
  public extractFromResult(result: RunSealResult): ProofSealMLVector {
    const snapshot = result.snapshot;
    const components = result.score.components;
    const modes: ModeCode[] = ['solo', 'pvp', 'coop', 'ghost'];
    const outcomes = ['FREEDOM', 'TIMEOUT', 'BANKRUPT', 'ABANDONED'];

    const features: number[] = [
      // Score components (7 features)
      components.economyProgress,
      components.shieldIntegrity,
      components.battleDefense,
      components.cascadeControl,
      components.pressureDiscipline,
      components.survivalRatio,
      components.modeDifficultyBonus,
      // Score scalars (4 features)
      result.score.outcomeMultiplier,
      result.score.integrityMultiplier,
      Math.min(1.5, result.score.rawScore),
      Math.min(1.5, result.score.finalScore),
      // Mode one-hot (4 features)
      ...modes.map((m) => snapshot.mode === m ? 1 : 0),
      // Outcome one-hot (5 features: 4 + null)
      ...outcomes.map((o) => snapshot.outcome === o ? 1 : 0),
      snapshot.outcome === null ? 1 : 0,
      // Integrity one-hot (4 features)
      result.integrityStatus === 'VERIFIED' ? 1 : 0,
      result.integrityStatus === 'UNVERIFIED' ? 1 : 0,
      result.integrityStatus === 'QUARANTINED' ? 1 : 0,
      result.integrityStatus === 'PENDING' ? 1 : 0,
      // Snapshot context (6 features)
      Math.min(1, snapshot.tick / 200),
      Math.min(1, snapshot.pressure.upwardCrossings / 20),
      Math.min(1, snapshot.pressure.survivedHighPressureTicks / 50),
      Math.min(1, snapshot.shield.breachesThisRun / 10),
      Math.min(1, snapshot.cascade.completedChains / 20),
      Math.min(1, snapshot.cascade.brokenChains / 10),
      // Telemetry (3 features)
      Math.min(1, snapshot.telemetry.decisions.length / 100),
      Math.min(1, snapshot.sovereignty.tickChecksums.length / 200),
      snapshot.sovereignty.cordScore,
    ];

    return {
      runId: snapshot.runId,
      tick: snapshot.tick,
      mode: snapshot.mode,
      features: Object.freeze(features),
      labels: PROOF_ML_FEATURE_LABELS,
      featureCount: features.length,
      modelVersion: ML_MODEL_VERSION,
    };
  }

  /** Extract a lighter feature vector from a mid-run snapshot. */
  public extractFromSnapshot(snapshot: RunStateSnapshot): ProofSealMLVector {
    const sealer = new ProofSealer();
    const integrityStatus = snapshot.sovereignty.integrityStatus;
    const score = sealer.computeScore(snapshot, integrityStatus);
    const dummyResult: RunSealResult = {
      snapshot,
      tickChecksum: snapshot.sovereignty.tickChecksums.at(-1) ?? '',
      eventDigest: '',
      tickStreamChecksum: '',
      proofHash: snapshot.sovereignty.proofHash ?? '',
      integrityStatus,
      integrityReasons: [],
      score,
    };
    return this.extractFromResult(dummyResult);
  }
}

// ============================================================================
// § 9 — ProofLedger
// ============================================================================

export const PROOF_LEDGER_CAPACITY: number = 512;

/**
 * Rolling history of proof hashes and seal outcomes.
 * Used for trend analysis, fraud detection, and legend gap tracking.
 */
export class ProofLedger {
  private readonly capacity: number;
  private readonly entries: ProofLedgerEntry[] = [];

  public constructor(capacity = PROOF_LEDGER_CAPACITY) {
    this.capacity = capacity;
  }

  public record(result: RunSealResult): ProofLedgerEntry {
    const entry: ProofLedgerEntry = {
      runId: result.snapshot.runId,
      proofHash: result.proofHash,
      integrityStatus: result.integrityStatus,
      grade: result.score.grade,
      finalScore: result.score.finalScore,
      mode: result.snapshot.mode,
      tick: result.snapshot.tick,
      outcome: result.snapshot.outcome,
      sealedAtMs: Date.now(),
    };

    this.entries.push(entry);
    if (this.entries.length > this.capacity) {
      this.entries.splice(0, this.entries.length - this.capacity);
    }

    return entry;
  }

  public findByRunId(runId: string): ProofLedgerEntry | null {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (this.entries[i].runId === runId) return this.entries[i];
    }
    return null;
  }

  public getByMode(mode: ModeCode): readonly ProofLedgerEntry[] {
    return this.entries.filter((e) => e.mode === mode);
  }

  public getTopScores(mode: ModeCode, limit = 10): readonly ProofLedgerEntry[] {
    return this.getByMode(mode)
      .slice()
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, limit);
  }

  public getAverageScore(mode?: ModeCode): number {
    const filtered = mode ? this.getByMode(mode) : this.entries;
    if (filtered.length === 0) return 0;
    return filtered.reduce((s, e) => s + e.finalScore, 0) / filtered.length;
  }

  public getVerifiedRatio(): number {
    if (this.entries.length === 0) return 0;
    const verified = this.entries.filter((e) => e.integrityStatus === 'VERIFIED').length;
    return verified / this.entries.length;
  }

  public getQuarantineRatio(): number {
    if (this.entries.length === 0) return 0;
    const quarantined = this.entries.filter((e) => e.integrityStatus === 'QUARANTINED').length;
    return quarantined / this.entries.length;
  }

  public snapshot(): readonly ProofLedgerEntry[] {
    return Object.freeze([...this.entries]);
  }

  get entryCount(): number { return this.entries.length; }

  public reset(): void {
    this.entries.length = 0;
  }
}

// ============================================================================
// § 10 — ProofSealerRollingStats
// ============================================================================

export interface ProofSealerRollingEntry {
  readonly tick: number;
  readonly sealType: 'tick' | 'run';
  readonly integrityStatus: IntegrityStatus;
  readonly finalScore: number;
  readonly latencyMs: number;
  readonly capturedAtMs: number;
}

export const PROOF_SEALER_ROLLING_CAPACITY: number = 512;

/**
 * Rolling analytics tracker for the proof sealer.
 */
export class ProofSealerRollingStats {
  private readonly capacity: number;
  private readonly entries: ProofSealerRollingEntry[] = [];
  private _totalSeals = 0;
  private _totalLatencyMs = 0;
  private _quarantineCount = 0;
  private _verifiedCount = 0;
  private _unverifiedCount = 0;
  private _totalFinalScore = 0;

  public constructor(capacity = PROOF_SEALER_ROLLING_CAPACITY) {
    this.capacity = capacity;
  }

  public record(entry: Omit<ProofSealerRollingEntry, 'capturedAtMs'>): void {
    const full: ProofSealerRollingEntry = { ...entry, capturedAtMs: Date.now() };
    this.entries.push(full);
    if (this.entries.length > this.capacity) {
      this.entries.splice(0, this.entries.length - this.capacity);
    }
    this._totalSeals++;
    this._totalLatencyMs += entry.latencyMs;
    this._totalFinalScore += entry.finalScore;
    if (entry.integrityStatus === 'QUARANTINED') this._quarantineCount++;
    else if (entry.integrityStatus === 'VERIFIED') this._verifiedCount++;
    else this._unverifiedCount++;
  }

  public buildHealthSummary(): ProofSealerHealthSummary {
    const grade = gradeProofSealerHealth(this);
    const verifiedRatio = this._totalSeals === 0 ? 0 : this._verifiedCount / this._totalSeals;
    const quarantineRatio = this._totalSeals === 0 ? 0 : this._quarantineCount / this._totalSeals;
    const avgScore = this._totalSeals === 0 ? 0 : this._totalFinalScore / this._totalSeals;
    const avgLatency = this._totalSeals === 0 ? 0 : this._totalLatencyMs / this._totalSeals;

    const warnings: string[] = [];
    if (quarantineRatio > 0.05) warnings.push('High quarantine rate — review integrity checks.');
    if (avgLatency > 10) warnings.push('Proof sealing latency exceeding 10ms.');
    if (avgScore < 0.3 && this._totalSeals > 10) warnings.push('Low average score across runs.');

    return {
      grade,
      totalSeals: this._totalSeals,
      verifiedRatio: Number(verifiedRatio.toFixed(4)),
      quarantineRatio: Number(quarantineRatio.toFixed(4)),
      avgFinalScore: Number(avgScore.toFixed(4)),
      avgLatencyMs: Number(avgLatency.toFixed(3)),
      warningFlags: Object.freeze(warnings),
    };
  }

  public buildTickStats(tick: number, latencyMs: number): ProofSealerTickStats {
    const recent = this.entries.filter((e) => e.tick >= tick - 1);
    return {
      tick,
      sealCount: recent.length,
      quarantineCount: recent.filter((e) => e.integrityStatus === 'QUARANTINED').length,
      unverifiedCount: recent.filter((e) => e.integrityStatus === 'UNVERIFIED').length,
      verifiedCount: recent.filter((e) => e.integrityStatus === 'VERIFIED').length,
      avgFinalScore: recent.length > 0
        ? recent.reduce((s, e) => s + e.finalScore, 0) / recent.length
        : 0,
      latencyMs,
    };
  }

  get totalSeals(): number { return this._totalSeals; }
  get verifiedCount(): number { return this._verifiedCount; }
  get quarantineCount(): number { return this._quarantineCount; }

  public reset(): void {
    this.entries.length = 0;
    this._totalSeals = 0;
    this._totalLatencyMs = 0;
    this._quarantineCount = 0;
    this._verifiedCount = 0;
    this._unverifiedCount = 0;
    this._totalFinalScore = 0;
  }

  public snapshot(): readonly ProofSealerRollingEntry[] {
    return Object.freeze([...this.entries]);
  }
}

// ============================================================================
// § 11 — Health grading and module constants
// ============================================================================

export function gradeProofSealerHealth(
  stats: ProofSealerRollingStats,
): ProofSealerHealthGrade {
  if (stats.totalSeals === 0) return 'A';

  const quarantineRatio = stats.quarantineCount / stats.totalSeals;
  const verifiedRatio = stats.verifiedCount / stats.totalSeals;

  if (quarantineRatio <= 0.01 && verifiedRatio >= 0.95) return 'S';
  if (quarantineRatio <= 0.03 && verifiedRatio >= 0.85) return 'A';
  if (quarantineRatio <= 0.06 && verifiedRatio >= 0.70) return 'B';
  if (quarantineRatio <= 0.12 && verifiedRatio >= 0.50) return 'C';
  if (quarantineRatio <= 0.25) return 'D';
  return 'F';
}

export function buildProofSealerHealthSummary(
  stats: ProofSealerRollingStats,
): ProofSealerHealthSummary {
  return stats.buildHealthSummary();
}

export const PROOF_SEALER_MODULE_VERSION = '3.1.0' as const;
export const PROOF_SEALER_MODULE_READY = true as const;
export const PROOF_SEALER_ROLLING_CAPACITY_EXPORT = PROOF_SEALER_ROLLING_CAPACITY;
export const PROOF_SEALER_COMPLETE = true as const;

// ============================================================================
// § 12 — ProofSealerFacade
// ============================================================================

export interface ProofSealerFacadeOptions {
  readonly rollingCapacity?: number;
  readonly ledgerCapacity?: number;
}

/**
 * Single-entrypoint wiring of all proof sealing surfaces.
 *
 * Usage:
 *   const facade = new ProofSealerFacade();
 *   const tickResult = facade.sealer.sealTick(snapshot, events);
 *   const runResult  = facade.sealer.sealRun(finalSnapshot, events);
 *   const cord       = facade.cordAnalyzer.analyze(runResult);
 *   const mlVector   = facade.mlExtractor.extractFromResult(runResult);
 *   const badge      = facade.badgeEngine.buildDetailedProjection(snapshot, status, score);
 */
export class ProofSealerFacade {
  public readonly sealer: ProofSealer;
  public readonly cordAnalyzer: CordScoreAnalyzer;
  public readonly badgeEngine: ProofBadgeEngine;
  public readonly comparator: RunSealComparator;
  public readonly replayVerifier: ReplayIntegrityVerifier;
  public readonly mlExtractor: ProofSealerMLExtractor;
  public readonly ledger: ProofLedger;
  public readonly rollingStats: ProofSealerRollingStats;

  public constructor(options: ProofSealerFacadeOptions = {}) {
    this.sealer = new ProofSealer();
    this.cordAnalyzer = new CordScoreAnalyzer(this.sealer);
    this.badgeEngine = new ProofBadgeEngine();
    this.comparator = new RunSealComparator();
    this.replayVerifier = new ReplayIntegrityVerifier(this.sealer);
    this.mlExtractor = new ProofSealerMLExtractor();
    this.ledger = new ProofLedger(options.ledgerCapacity ?? PROOF_LEDGER_CAPACITY);
    this.rollingStats = new ProofSealerRollingStats(
      options.rollingCapacity ?? PROOF_SEALER_ROLLING_CAPACITY,
    );
  }

  /**
   * Seal a single tick and record analytics.
   */
  public sealTick(
    snapshot: RunStateSnapshot,
    eventFrames: readonly unknown[] = [],
  ): TickSealResult {
    const startMs = Date.now();
    const result = this.sealer.sealTick(snapshot, eventFrames);
    this.rollingStats.record({
      tick: snapshot.tick,
      sealType: 'tick',
      integrityStatus: result.snapshot.sovereignty.integrityStatus,
      finalScore: result.snapshot.sovereignty.sovereigntyScore,
      latencyMs: Date.now() - startMs,
    });
    return result;
  }

  /**
   * Seal the final run and register in ledger + analytics.
   */
  public sealRun(
    snapshot: RunStateSnapshot,
    eventFrames: readonly unknown[] = [],
  ): {
    readonly sealResult: RunSealResult;
    readonly cordBreakdown: CordScoreBreakdown;
    readonly mlVector: ProofSealMLVector;
    readonly ledgerEntry: ProofLedgerEntry;
  } {
    const startMs = Date.now();
    const sealResult = this.sealer.sealRun(snapshot, eventFrames);
    const latencyMs = Date.now() - startMs;

    this.rollingStats.record({
      tick: snapshot.tick,
      sealType: 'run',
      integrityStatus: sealResult.integrityStatus,
      finalScore: sealResult.score.finalScore,
      latencyMs,
    });

    const cordBreakdown = this.cordAnalyzer.analyze(sealResult);
    const mlVector = this.mlExtractor.extractFromResult(sealResult);
    const ledgerEntry = this.ledger.record(sealResult);

    return Object.freeze({ sealResult, cordBreakdown, mlVector, ledgerEntry });
  }

  /** Health summary for this sealer instance. */
  public getHealthSummary(): ProofSealerHealthSummary {
    return this.rollingStats.buildHealthSummary();
  }
}

export function createProofSealerFacade(
  options?: ProofSealerFacadeOptions,
): ProofSealerFacade {
  return new ProofSealerFacade(options);
}
