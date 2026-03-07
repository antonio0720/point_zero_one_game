/**
 * FILE: pzo-web/src/engines/battle/SyndicateWarEngine.ts
 * Real-time 48-hour duel cycle — social financial rivalry layer.
 *
 * Operates entirely independently of the run tick sequence.
 * Does NOT interact with ShieldEngine, TensionEngine, or PressureEngine.
 *
 * Duels use financial combat vocabulary throughout:
 *   - No "war", "enemy", "army" — these are financial rivalries, sovereignty challenges
 *   - Winning = "Breaking Free" / "Sovereignty Achieved"
 *   - Losing = "Suppressed" / "Returned to the System"
 *
 * Three challenges per duel (best-of-three), run at 0h, 16h, 32h from declaration.
 * All duel events logged to Verified Run Explorer — permanent, immutable record.
 */
import { v4 as uuidv4 } from 'uuid';
import {
  SyndicateDuel,
  DuelState,
  ChallengeType,
  Syndicate,
  SyndicateMember,
  BATTLE_CONSTANTS,
} from './types';
import type { EventBus } from '../core/EventBus';

// ── Challenge Config ──────────────────────────────────────────────────────────

interface ChallengeConfig {
  type: ChallengeType;
  offsetMs: number;
  displayName: string;
  financialEducationLayer: string;
}

const CHALLENGE_SEQUENCE: ChallengeConfig[] = [
  {
    type:        ChallengeType.COLLECTIVE_SOVEREIGNTY,
    offsetMs:    BATTLE_CONSTANTS.DUEL_CHALLENGE_OFFSETS_MS[0],
    displayName: 'Collective Sovereignty',
    financialEducationLayer:
      'Demonstrates how collective wealth accumulation compounds vs. individual isolation.',
  },
  {
    type:        ChallengeType.EXTRACTION_RESISTANCE,
    offsetMs:    BATTLE_CONSTANTS.DUEL_CHALLENGE_OFFSETS_MS[1],
    displayName: 'Extraction Resistance',
    financialEducationLayer:
      'Teaches that collective financial defense changes risk tolerance and strategic options.',
  },
  {
    type:        ChallengeType.GROWTH_SPRINT,
    offsetMs:    BATTLE_CONSTANTS.DUEL_CHALLENGE_OFFSETS_MS[2],
    displayName: 'Growth Sprint',
    financialEducationLayer:
      'Demonstrates scalable income strategies. Members learn from alliance partners with higher growth rates.',
  },
];

// ── Duel Outcome ──────────────────────────────────────────────────────────────

export interface DuelOutcome {
  duelId: string;
  winnerSyndicateId: string;
  loserSyndicateId: string;
  challengerScore: number;
  defenderScore: number;
  resolvedAt: number;
  verifiedRunExplorerRef: string;  // Permanent immutable log reference
}

// ── Challenge Score ───────────────────────────────────────────────────────────

export interface ChallengeResult {
  challengeIndex: 1 | 2 | 3;
  challengeType: ChallengeType;
  challengerScore: number;
  defenderScore: number;
  winnerId: string;
}

// ── SyndicateWarEngine ────────────────────────────────────────────────────────

export class SyndicateWarEngine {
  private activeDuels = new Map<string, SyndicateDuel>();
  private duelOutcomes: DuelOutcome[] = [];
  private challengeResults = new Map<string, ChallengeResult[]>();

  constructor(private readonly eventBus: EventBus) {}

  // ── Duel Lifecycle ────────────────────────────────────────────────────────

  /**
   * Declare a duel from challengerSyndicate against defenderSyndicate.
   * Costs SYNDICATE_DUEL_COST_PTS from the challenger's syndicate points.
   * Returns null if either syndicate is ineligible.
   */
  public declareDuel(
    challengerSyndicate: Syndicate,
    defenderSyndicate: Syndicate,
    now: number = Date.now()
  ): SyndicateDuel | null {
    // Validation: challenger cannot already be in an active duel
    if (challengerSyndicate.activeDuelId !== null) {
      console.warn(
        `[SyndicateWarEngine] Challenger ${challengerSyndicate.syndicateId} already in active duel.`
      );
      return null;
    }

    // Validation: defender cannot already be in an active duel
    if (defenderSyndicate.activeDuelId !== null) {
      console.warn(
        `[SyndicateWarEngine] Defender ${defenderSyndicate.syndicateId} already in active duel.`
      );
      return null;
    }

    // Validation: challenger must have sufficient syndicate points
    if (challengerSyndicate.syndicatePoints < BATTLE_CONSTANTS.SYNDICATE_DUEL_COST_PTS) {
      console.warn(
        `[SyndicateWarEngine] Challenger has insufficient syndicate points. ` +
        `Required: ${BATTLE_CONSTANTS.SYNDICATE_DUEL_COST_PTS}, ` +
        `Available: ${challengerSyndicate.syndicatePoints}`
      );
      return null;
    }

    // Validation: both syndicates need minimum active members
    const challengerActiveCount = challengerSyndicate.members.filter(m => m.isActive).length;
    const defenderActiveCount   = defenderSyndicate.members.filter(m => m.isActive).length;

    if (challengerActiveCount < BATTLE_CONSTANTS.SYNDICATE_MIN_ACTIVE_MEMBERS) {
      console.warn(
        `[SyndicateWarEngine] Challenger needs ${BATTLE_CONSTANTS.SYNDICATE_MIN_ACTIVE_MEMBERS} active members.`
      );
      return null;
    }
    if (defenderActiveCount < BATTLE_CONSTANTS.SYNDICATE_MIN_ACTIVE_MEMBERS) {
      console.warn(
        `[SyndicateWarEngine] Defender needs ${BATTLE_CONSTANTS.SYNDICATE_MIN_ACTIVE_MEMBERS} active members.`
      );
      return null;
    }

    // Deduct declaration cost
    challengerSyndicate.syndicatePoints -= BATTLE_CONSTANTS.SYNDICATE_DUEL_COST_PTS;

    const duel: SyndicateDuel = {
      duelId:                uuidv4(),
      challengerSyndicateId: challengerSyndicate.syndicateId,
      defenderSyndicateId:   defenderSyndicate.syndicateId,
      declaredAt:            now,
      endsAt:                now + BATTLE_CONSTANTS.SYNDICATE_DUEL_DURATION_MS,
      state:                 DuelState.ACTIVE,
      challengerScore:       0,
      defenderScore:         0,
      currentChallenge:      1,
      winnerSyndicateId:     null,
    };

    this.activeDuels.set(duel.duelId, duel);
    this.challengeResults.set(duel.duelId, []);

    // Update both syndicates' activeDuelId (caller responsibility to persist)
    challengerSyndicate.activeDuelId = duel.duelId;
    defenderSyndicate.activeDuelId   = duel.duelId;

    this.eventBus.emit('SYNDICATE_DUEL_DECLARED', {
      eventType:   'SYNDICATE_DUEL_DECLARED',
      duel,
      timestamp:   now,
    });

    return duel;
  }

  /**
   * Resolve a single challenge within a duel.
   * Called at the appropriate challenge offset (0h, 16h, 32h from declaration).
   */
  public resolveChallenge(
    duelId: string,
    challengerMembers: SyndicateMember[],
    defenderMembers: SyndicateMember[],
    now: number = Date.now()
  ): ChallengeResult | null {
    const duel = this.activeDuels.get(duelId);
    if (!duel || duel.state !== DuelState.ACTIVE) return null;

    const challengeIndex = duel.currentChallenge;
    const config = CHALLENGE_SEQUENCE[challengeIndex - 1];
    if (!config) return null;

    const { challengerScore, defenderScore } = this.scoreChallengeType(
      config.type,
      challengerMembers,
      defenderMembers
    );

    const winnerId =
      challengerScore >= defenderScore
        ? duel.challengerSyndicateId
        : duel.defenderSyndicateId;

    const result: ChallengeResult = {
      challengeIndex,
      challengeType:   config.type,
      challengerScore,
      defenderScore,
      winnerId,
    };

    // Track challenge wins on the duel
    if (winnerId === duel.challengerSyndicateId) {
      duel.challengerScore++;
    } else {
      duel.defenderScore++;
    }

    const results = this.challengeResults.get(duelId) ?? [];
    results.push(result);
    this.challengeResults.set(duelId, results);

    // Check if duel is decided (best-of-three: 2 wins)
    const duelDecided =
      duel.challengerScore >= 2 || duel.defenderScore >= 2;

    if (duelDecided || challengeIndex === 3) {
      this.resolveDuel(duel, now);
    } else {
      duel.currentChallenge = (challengeIndex + 1) as 1 | 2 | 3;
    }

    return result;
  }

  /**
   * Cancel a duel before it resolves (e.g. both parties inactive, admin action).
   */
  public cancelDuel(duelId: string): boolean {
    const duel = this.activeDuels.get(duelId);
    if (!duel || duel.state !== DuelState.ACTIVE) return false;
    duel.state = DuelState.CANCELLED;
    this.activeDuels.delete(duelId);
    this.eventBus.emit('SYNDICATE_DUEL_CANCELLED', {
      eventType: 'SYNDICATE_DUEL_CANCELLED',
      duelId,
      timestamp:  Date.now(),
    });
    return true;
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  public getActiveDuel(duelId: string): SyndicateDuel | undefined {
    return this.activeDuels.get(duelId);
  }

  public getDuelOutcomes(): DuelOutcome[] {
    return [...this.duelOutcomes];
  }

  public getChallengeResults(duelId: string): ChallengeResult[] {
    return this.challengeResults.get(duelId) ?? [];
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private resolveDuel(duel: SyndicateDuel, now: number): void {
    duel.state = DuelState.RESOLVED;

    const winnerId =
      duel.challengerScore >= duel.defenderScore
        ? duel.challengerSyndicateId
        : duel.defenderSyndicateId;
    const loserId =
      winnerId === duel.challengerSyndicateId
        ? duel.defenderSyndicateId
        : duel.challengerSyndicateId;

    duel.winnerSyndicateId = winnerId;

    const outcome: DuelOutcome = {
      duelId:                   duel.duelId,
      winnerSyndicateId:        winnerId,
      loserSyndicateId:         loserId,
      challengerScore:          duel.challengerScore,
      defenderScore:            duel.defenderScore,
      resolvedAt:               now,
      verifiedRunExplorerRef:   `VRE-DUEL-${duel.duelId}`,
    };

    this.duelOutcomes.push(outcome);
    this.activeDuels.delete(duel.duelId);

    this.eventBus.emit('SYNDICATE_DUEL_RESOLVED', {
      eventType: 'SYNDICATE_DUEL_RESOLVED',
      outcome,
      timestamp:  now,
    });
  }

  /**
   * Score a single challenge between two groups of syndicate members.
   * BANKRUPT members contribute 0 (hasCascadeBreach = true disqualifies their score).
   */
  private scoreChallengeType(
    type: ChallengeType,
    challengerMembers: SyndicateMember[],
    defenderMembers: SyndicateMember[]
  ): { challengerScore: number; defenderScore: number } {
    switch (type) {

      case ChallengeType.COLLECTIVE_SOVEREIGNTY: {
        // Top 5 active members by net worth
        const topChallengers = this.topN(challengerMembers, 5, m => m.netWorth);
        const topDefenders   = this.topN(defenderMembers,   5, m => m.netWorth);
        return {
          challengerScore: topChallengers.reduce((s, m) => s + m.netWorth, 0),
          defenderScore:   topDefenders.reduce((s, m)   => s + m.netWorth, 0),
        };
      }

      case ChallengeType.EXTRACTION_RESISTANCE: {
        // Members who survived adversarial extraction without a cascade breach
        const challengerSurvivors = challengerMembers
          .filter(m => m.isActive && !m.hasCascadeBreach)
          .reduce((s, m) => s + m.extractionEventsSurvived, 0);
        const defenderSurvivors = defenderMembers
          .filter(m => m.isActive && !m.hasCascadeBreach)
          .reduce((s, m) => s + m.extractionEventsSurvived, 0);
        return {
          challengerScore: challengerSurvivors,
          defenderScore:   defenderSurvivors,
        };
      }

      case ChallengeType.GROWTH_SPRINT: {
        // Average income growth rate across all active members during the window
        const activeChallengers = challengerMembers.filter(m => m.isActive);
        const activeDefenders   = defenderMembers.filter(m => m.isActive);
        const challengerAvg =
          activeChallengers.length > 0
            ? activeChallengers.reduce((s, m) => s + m.incomeGrowthRate, 0) /
              activeChallengers.length
            : 0;
        const defenderAvg =
          activeDefenders.length > 0
            ? activeDefenders.reduce((s, m) => s + m.incomeGrowthRate, 0) /
              activeDefenders.length
            : 0;
        return {
          challengerScore: Math.round(challengerAvg * 1000),  // scaled for precision
          defenderScore:   Math.round(defenderAvg * 1000),
        };
      }

      default:
        return { challengerScore: 0, defenderScore: 0 };
    }
  }

  private topN(
    members: SyndicateMember[],
    n: number,
    scoreFn: (m: SyndicateMember) => number
  ): SyndicateMember[] {
    return members
      .filter(m => m.isActive)
      .sort((a, b) => scoreFn(b) - scoreFn(a))
      .slice(0, n);
  }
}