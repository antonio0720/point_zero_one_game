import { createHash, randomUUID } from 'node:crypto';

export type ForkIntent = 'practice' | 'recovery' | 'optimization' | 'consistency';
export type ForkRiskTier = 'low' | 'medium' | 'high';
export type ForkFocus =
  | 'cashflow'
  | 'debt'
  | 'timer'
  | 'shield'
  | 'opportunity'
  | 'discipline'
  | 'volatility';

export interface ForkMetrics {
  cash?: number;
  debt?: number;
  timerFailures?: number;
  missedPayments?: number;
  shieldBreaks?: number;
  opportunityMisses?: number;
  overextensionEvents?: number;
  panicSells?: number;
  confidence?: number;
}

export interface ForkableRunSnapshot {
  runId: string;
  playerId: string;
  seasonId?: string;
  tick?: number;
  seed: string;
  stage?: string;
  environment?: string;
  ladderEligible?: boolean;
  proofEligible?: boolean;
  causeOfDeath?: string | null;
  fatalSignals?: string[];
  cardsSeen?: string[];
  cardsPlayed?: string[];
  metrics?: ForkMetrics;
  metadata?: Record<string, unknown>;
}

export interface ForkConstraintProfile {
  maxForks?: number;
  disableRiskyForks?: boolean;
  preferredIntent?: ForkIntent;
  preferredFocuses?: ForkFocus[];
}

export interface ForkMutation {
  field: string;
  operation: 'set' | 'increment' | 'decrement' | 'append';
  value: unknown;
  reason: string;
}

export interface ForkBlueprint {
  forkId: string;
  parentRunId: string;
  playerId: string;
  seed: string;
  intent: ForkIntent;
  focus: ForkFocus[];
  name: string;
  rationale: string;
  practiceOnly: boolean;
  proofEligible: boolean;
  ladderEligible: boolean;
  shareSafe: boolean;
  riskTier: ForkRiskTier;
  score: number;
  mutations: ForkMutation[];
  telemetryTags: string[];
  createdAt: string;
  receiptHash: string;
}

export interface ForkReceipt {
  forkId: string;
  parentRunId: string;
  createdAt: string;
  practiceOnly: boolean;
  score: number;
  summary: string;
  receiptHash: string;
}

const DEFAULT_MAX_FORKS = 4;

function nowIso(): string {
  return new Date().toISOString();
}

function numberOrZero(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stableHash(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function buildForkSeed(parentSeed: string, label: string): string {
  return stableHash(`${parentSeed}:${label}`).slice(0, 16);
}

function normalizeFocuses(value: ForkFocus[] | undefined): ForkFocus[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<ForkFocus>();
  const output: ForkFocus[] = [];
  for (const item of value) {
    if (!seen.has(item)) {
      seen.add(item);
      output.push(item);
    }
  }
  return output;
}

export class ForkCreator {
  public createForks(
    snapshot: ForkableRunSnapshot,
    constraints: ForkConstraintProfile = {},
  ): ForkBlueprint[] {
    const metrics = snapshot.metrics ?? {};
    const maxForks = Math.max(1, constraints.maxForks ?? DEFAULT_MAX_FORKS);
    const preferredFocuses = new Set(normalizeFocuses(constraints.preferredFocuses));

    const candidates: ForkBlueprint[] = [
      this.buildRecoveryFork(snapshot, metrics),
      this.buildTimerFork(snapshot, metrics),
      this.buildDebtFork(snapshot, metrics),
      this.buildOptimizationFork(snapshot, metrics),
      this.buildDisciplineFork(snapshot, metrics),
    ]
      .filter((fork) => (constraints.disableRiskyForks ? fork.riskTier !== 'high' : true))
      .map((fork) => ({
        ...fork,
        score: this.scoreFork(fork, constraints.preferredIntent, preferredFocuses),
      }))
      .sort((left, right) => right.score - left.score);

    return candidates.slice(0, maxForks);
  }

  public pickBestFork(
    snapshot: ForkableRunSnapshot,
    constraints: ForkConstraintProfile = {},
  ): ForkBlueprint | null {
    return this.createForks(snapshot, { ...constraints, maxForks: 1 })[0] ?? null;
  }

  public buildReceipt(fork: ForkBlueprint): ForkReceipt {
    return {
      forkId: fork.forkId,
      parentRunId: fork.parentRunId,
      createdAt: fork.createdAt,
      practiceOnly: fork.practiceOnly,
      score: fork.score,
      summary: `${fork.name}: ${fork.rationale}`,
      receiptHash: fork.receiptHash,
    };
  }

  private buildRecoveryFork(
    snapshot: ForkableRunSnapshot,
    metrics: ForkMetrics,
  ): ForkBlueprint {
    const focus: ForkFocus[] = ['cashflow', 'shield'];
    const mutations: ForkMutation[] = [
      {
        field: 'run.mode',
        operation: 'set',
        value: 'practice',
        reason: 'All loss-derived forks must remain practice-only and non-ladder.',
      },
      {
        field: 'economy.startingCashDelta',
        operation: 'increment',
        value: 250,
        reason: 'Give the player enough room to correct the earliest liquidity mistake.',
      },
      {
        field: 'shield.startingChargesDelta',
        operation: 'increment',
        value: 1,
        reason: 'Reduce immediate re-death from a single early miss.',
      },
    ];

    return this.createBlueprint(snapshot, {
      intent: 'recovery',
      focus,
      name: 'Recovery Fork',
      rationale:
        'Stabilizes the next run around cash buffer and survivability before asking for better execution.',
      riskTier: 'low',
      mutations,
      telemetryTags: ['loss_is_content', 'fork', 'recovery', 'practice_only'],
    });
  }

  private buildTimerFork(
    snapshot: ForkableRunSnapshot,
    metrics: ForkMetrics,
  ): ForkBlueprint {
    const timerFailures = numberOrZero(metrics.timerFailures);
    const missedPayments = numberOrZero(metrics.missedPayments);
    const extraDecisionTime = Math.min(12, Math.max(3, timerFailures * 2 + missedPayments));

    return this.createBlueprint(snapshot, {
      intent: 'consistency',
      focus: ['timer', 'discipline'],
      name: 'Execution Fork',
      rationale:
        'Buys decision-room around timer pressure so the player can convert understanding into clean execution.',
      riskTier: timerFailures >= 4 ? 'low' : 'medium',
      mutations: [
        {
          field: 'decisionWindow.secondsDelta',
          operation: 'increment',
          value: extraDecisionTime,
          reason: 'Extend decision windows after timer-based losses.',
        },
        {
          field: 'run.openingScript',
          operation: 'set',
          value: 'stabilize_before_expand',
          reason: 'Force a calmer opener before aggressive actions become available.',
        },
      ],
      telemetryTags: ['loss_is_content', 'fork', 'execution', 'timer'],
    });
  }

  private buildDebtFork(
    snapshot: ForkableRunSnapshot,
    metrics: ForkMetrics,
  ): ForkBlueprint {
    const debt = numberOrZero(metrics.debt);
    const missedPayments = numberOrZero(metrics.missedPayments);
    const debtRelief = Math.min(500, Math.max(100, Math.round((debt + missedPayments * 75) * 0.12)));

    return this.createBlueprint(snapshot, {
      intent: 'recovery',
      focus: ['debt', 'cashflow'],
      name: 'Debt Reset Fork',
      rationale:
        'Reduces compounding debt pressure and pushes the player toward a cashflow-first repair line.',
      riskTier: debt > 4000 ? 'low' : 'medium',
      mutations: [
        {
          field: 'economy.startingDebtDelta',
          operation: 'decrement',
          value: debtRelief,
          reason: 'Trim enough debt to make the lesson recoverable without erasing consequences.',
        },
        {
          field: 'coach.recommendedLane',
          operation: 'set',
          value: 'pay_down_before_speculate',
          reason: 'Bias the branch toward repayment and solvency recovery.',
        },
      ],
      telemetryTags: ['loss_is_content', 'fork', 'debt', 'solvency'],
    });
  }

  private buildOptimizationFork(
    snapshot: ForkableRunSnapshot,
    metrics: ForkMetrics,
  ): ForkBlueprint {
    const misses = numberOrZero(metrics.opportunityMisses);
    const confidence = numberOrZero(metrics.confidence);

    return this.createBlueprint(snapshot, {
      intent: 'optimization',
      focus: ['opportunity', 'cashflow'],
      name: 'Opportunity Fork',
      rationale:
        'Keeps risk intact but improves signal density so the player can capitalize on missed upside.',
      riskTier: confidence >= 70 ? 'high' : 'medium',
      mutations: [
        {
          field: 'opportunity.spawnRateDelta',
          operation: 'increment',
          value: Math.min(3, Math.max(1, misses)),
          reason: 'Re-surface one or two missed opportunities in the next branch.',
        },
        {
          field: 'telemetry.expectedBehavior',
          operation: 'append',
          value: 'capitalize_when_edge_is_clear',
          reason: 'Preserve a measurable expectation for the new fork.',
        },
      ],
      telemetryTags: ['loss_is_content', 'fork', 'optimization', 'opportunity'],
    });
  }

  private buildDisciplineFork(
    snapshot: ForkableRunSnapshot,
    metrics: ForkMetrics,
  ): ForkBlueprint {
    const overextensionEvents = numberOrZero(metrics.overextensionEvents);
    const panicSells = numberOrZero(metrics.panicSells);

    return this.createBlueprint(snapshot, {
      intent: 'practice',
      focus: ['discipline', 'volatility'],
      name: 'Discipline Fork',
      rationale:
        'Constrains the branch so the player can rehearse cleaner behavior without exploit leakage.',
      riskTier: 'low',
      mutations: [
        {
          field: 'market.volatilityCap',
          operation: 'set',
          value: Math.max(0.75, 1 - Math.min(0.2, overextensionEvents * 0.03)),
          reason: 'Slightly damp volatility for discipline practice loops.',
        },
        {
          field: 'behavior.guards.maxImpulseActions',
          operation: 'set',
          value: Math.max(1, 4 - panicSells),
          reason: 'Reduce spammy action volume after impulsive exits.',
        },
      ],
      telemetryTags: ['loss_is_content', 'fork', 'discipline', 'volatility'],
    });
  }

  private createBlueprint(
    snapshot: ForkableRunSnapshot,
    config: {
      intent: ForkIntent;
      focus: ForkFocus[];
      name: string;
      rationale: string;
      riskTier: ForkRiskTier;
      mutations: ForkMutation[];
      telemetryTags: string[];
    },
  ): ForkBlueprint {
    const createdAt = nowIso();
    const seed = buildForkSeed(snapshot.seed, config.name);
    const base = {
      forkId: `fork_${randomUUID()}`,
      parentRunId: snapshot.runId,
      playerId: snapshot.playerId,
      seed,
      intent: config.intent,
      focus: config.focus,
      name: config.name,
      rationale: config.rationale,
      practiceOnly: true,
      proofEligible: false,
      ladderEligible: false,
      shareSafe: true,
      riskTier: config.riskTier,
      score: 0,
      mutations: config.mutations,
      telemetryTags: config.telemetryTags,
      createdAt,
    };

    return {
      ...base,
      receiptHash: stableHash(JSON.stringify(base)),
    };
  }

  private scoreFork(
    fork: ForkBlueprint,
    preferredIntent: ForkIntent | undefined,
    preferredFocuses: Set<ForkFocus>,
  ): number {
    let score = 100;

    if (fork.intent === preferredIntent) {
      score += 18;
    }

    for (const focus of fork.focus) {
      if (preferredFocuses.has(focus)) {
        score += 9;
      }
    }

    if (fork.riskTier === 'low') {
      score += 12;
    } else if (fork.riskTier === 'medium') {
      score += 5;
    }

    if (!fork.practiceOnly || fork.proofEligible || fork.ladderEligible) {
      score -= 1000;
    }

    return score;
  }
}

export default ForkCreator;
