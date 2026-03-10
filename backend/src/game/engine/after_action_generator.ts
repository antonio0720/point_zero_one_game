// backend/src/game/engine/after_action_generator.ts

/**
 * POINT ZERO ONE — BACKEND AFTER ACTION GENERATOR
 * backend/src/game/engine/after_action_generator.ts
 *
 * Purpose:
 * - Generate a deterministic post-run autopsy package.
 * - Produce "loss is content" outputs: cause-of-death, replay fork, training recommendation,
 *   one tiny action, and one medium action.
 * - Stay backend-safe, dependency-light, and compatible with replay/proof flows.
 */

export enum FailureMode {
  ResourceLoss = 'resource_loss',
  ReplaySuggestion = 'replay_suggestion',
  DebtSpiral = 'debt_spiral',
  DecisionLatency = 'decision_latency',
  ShieldBreach = 'shield_breach',
  CascadeFailure = 'cascade_failure',
  TrustCollapse = 'trust_collapse',
  DivergenceLoss = 'divergence_loss',
}

export enum StrengthMode {
  Tiny = 'tiny',
  Medium = 'medium',
}

export enum RunOutcome {
  FREEDOM = 'FREEDOM',
  TIMEOUT = 'TIMEOUT',
  BANKRUPT = 'BANKRUPT',
  ABANDONED = 'ABANDONED',
}

export enum AfterActionGameMode {
  GO_ALONE = 'GO_ALONE',
  HEAD_TO_HEAD = 'HEAD_TO_HEAD',
  TEAM_UP = 'TEAM_UP',
  CHASE_A_LEGEND = 'CHASE_A_LEGEND',
}

export interface TinyAction {
  /** Stable deterministic identifier. */
  id: string;
  /** Short display title. */
  title: string;
  /** Concrete tactical action. */
  description: string;
  /** Why this is the best immediate move. */
  why: string;
}

export interface MediumAction {
  /** Stable deterministic identifier. */
  id: string;
  /** Short display title. */
  title: string;
  /** Concrete medium-horizon action. */
  description: string;
  /** Scenario or mode the player should replay. */
  recommendedScenario: string;
  /** Why this fixes the detected weakness. */
  why: string;
}

export interface AfterAction {
  /** Stable deterministic identifier. */
  id: string;
  failureMode: FailureMode;
  strengthMode: StrengthMode;
  title: string;
  confidence: number;
  relatedTick?: number;
  replaySuggestion?: string;
  tinyAction?: TinyAction;
  mediumAction?: MediumAction;
  educationalTag?: string;
  whyItMatters: string;
}

export interface DecisionMoment {
  tickIndex: number;
  choiceId: string;
  resolvedInMs: number;
  windowMs: number;
  wasForced: boolean;
  wasOptimalChoice?: boolean;
  note?: string;
}

export interface ShieldBreachMoment {
  tickIndex: number;
  breachedLayer: string;
  damage: number;
  recoveryOptionMissed?: string;
}

export interface BotDamageSummary {
  botId: string;
  displayName: string;
  totalDamage: number;
  peakTick: number;
}

export interface AlternateTimelineFork {
  tickIndex: number;
  title: string;
  currentOutcome: string;
  alternateOutcome: string;
}

export interface RootCause {
  mode: FailureMode;
  title: string;
  confidence: number;
  evidence: string[];
  relatedTicks: number[];
}

export interface CauseOfDeathCard {
  title: string;
  triggerLine: string;
  verification: 'pending' | 'verified' | 'practice-only';
  cash: number;
  burn: number;
  largestHit: number;
}

export interface TrainingRecommendation {
  scenarioId: string;
  title: string;
  reason: string;
  mode: AfterActionGameMode;
}

export interface AfterActionGenerationInput {
  runId: string;
  mode: AfterActionGameMode;
  outcome: RunOutcome;
  causeOfDeath: string;
  finalCash: number;
  burnRate: number;
  largestHit: number;
  tickOfCollapse?: number;
  trustScore?: number;
  divergenceScore?: number;
  decisionMoments: readonly DecisionMoment[];
  shieldBreaches: readonly ShieldBreachMoment[];
  botDamage: readonly BotDamageSummary[];
  alternateTimelines: readonly AlternateTimelineFork[];
  educationalTags?: readonly string[];
}

export interface AfterActionReport {
  runId: string;
  mode: AfterActionGameMode;
  outcome: RunOutcome;
  generatedAtDeterministicKey: string;
  causeOfDeathCard: CauseOfDeathCard;
  rootCauses: readonly RootCause[];
  fastestDecision?: DecisionMoment;
  slowestDecision?: DecisionMoment;
  shieldBreachTimeline: readonly ShieldBreachMoment[];
  topBotThreat?: BotDamageSummary;
  alternateTimelines: readonly AlternateTimelineFork[];
  replaySuggestion: string;
  trainingRecommendation: TrainingRecommendation;
  tinyAction: TinyAction;
  mediumAction: MediumAction;
  actions: readonly AfterAction[];
}

const MAX_CONFIDENCE = 0.98;
const MIN_CONFIDENCE = 0.15;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round3(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function stableId(prefix: string, ...parts: readonly (string | number | undefined)[]): string {
  const base = parts
    .filter((part) => part !== undefined)
    .map((part) => String(part))
    .join('|');

  let hash = 0;
  for (let index = 0; index < base.length; index += 1) {
    hash = ((hash << 5) - hash + base.charCodeAt(index)) | 0;
  }

  return `${prefix}_${Math.abs(hash)}`;
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

export class AfterActionGenerator {
  public generate(input: AfterActionGenerationInput): AfterActionReport {
    const rootCauses = this.rankRootCauses(input);
    const primaryCause = rootCauses[0] ?? this.buildFallbackRootCause(input);

    const fastestDecision = this.pickFastestDecision(input.decisionMoments);
    const slowestDecision = this.pickSlowestDecision(input.decisionMoments);
    const topBotThreat = this.pickTopBotThreat(input.botDamage);

    const replaySuggestion = this.buildReplaySuggestion(input, primaryCause, slowestDecision);
    const trainingRecommendation = this.buildTrainingRecommendation(input, primaryCause);
    const tinyAction = this.buildTinyAction(input, primaryCause, slowestDecision);
    const mediumAction = this.buildMediumAction(input, primaryCause, trainingRecommendation);

    const actions: AfterAction[] = [
      {
        id: stableId('aa', input.runId, primaryCause.mode, 'tiny'),
        failureMode: primaryCause.mode,
        strengthMode: StrengthMode.Tiny,
        title: `${primaryCause.title} — immediate correction`,
        confidence: primaryCause.confidence,
        relatedTick: slowestDecision?.tickIndex ?? input.tickOfCollapse,
        replaySuggestion,
        tinyAction,
        educationalTag: input.educationalTags?.[0],
        whyItMatters: tinyAction.why,
      },
      {
        id: stableId('aa', input.runId, primaryCause.mode, 'medium'),
        failureMode:
          primaryCause.mode === FailureMode.ReplaySuggestion
            ? FailureMode.ResourceLoss
            : primaryCause.mode,
        strengthMode: StrengthMode.Medium,
        title: `${primaryCause.title} — training response`,
        confidence: clamp(primaryCause.confidence - 0.03, MIN_CONFIDENCE, MAX_CONFIDENCE),
        relatedTick: input.tickOfCollapse,
        replaySuggestion,
        mediumAction,
        educationalTag: input.educationalTags?.[1] ?? input.educationalTags?.[0],
        whyItMatters: mediumAction.why,
      },
    ];

    return {
      runId: input.runId,
      mode: input.mode,
      outcome: input.outcome,
      generatedAtDeterministicKey: stableId(
        'aar',
        input.runId,
        input.mode,
        input.outcome,
        input.tickOfCollapse ?? 'na',
      ),
      causeOfDeathCard: {
        title: input.causeOfDeath,
        triggerLine: this.buildCauseTriggerLine(input, primaryCause),
        verification: input.outcome === RunOutcome.ABANDONED ? 'practice-only' : 'pending',
        cash: input.finalCash,
        burn: input.burnRate,
        largestHit: input.largestHit,
      },
      rootCauses,
      fastestDecision,
      slowestDecision,
      shieldBreachTimeline: [...input.shieldBreaches].sort((a, b) => a.tickIndex - b.tickIndex),
      topBotThreat,
      alternateTimelines: [...input.alternateTimelines].sort((a, b) => a.tickIndex - b.tickIndex),
      replaySuggestion,
      trainingRecommendation,
      tinyAction,
      mediumAction,
      actions,
    };
  }

  private rankRootCauses(input: AfterActionGenerationInput): RootCause[] {
    const causes: RootCause[] = [];

    if (input.finalCash < 0 || input.burnRate > Math.max(1, Math.abs(input.finalCash) * 0.2)) {
      causes.push({
        mode:
          input.burnRate > Math.abs(input.finalCash) * 0.4
            ? FailureMode.DebtSpiral
            : FailureMode.ResourceLoss,
        title: input.burnRate > Math.abs(input.finalCash) * 0.4 ? 'Debt spiral' : 'Resource collapse',
        confidence: round3(
          clamp(
            0.52 + Math.abs(input.finalCash) / 25_000 + Math.abs(input.burnRate) / 8_000,
            MIN_CONFIDENCE,
            MAX_CONFIDENCE,
          ),
        ),
        evidence: [
          `Final cash=${input.finalCash}`,
          `Burn rate=${input.burnRate}`,
          `Largest hit=${input.largestHit}`,
        ],
        relatedTicks: this.collectTicks(input),
      });
    }

    const slowestDecision = this.pickSlowestDecision(input.decisionMoments);
    if (slowestDecision && slowestDecision.resolvedInMs > slowestDecision.windowMs * 0.85) {
      causes.push({
        mode: FailureMode.DecisionLatency,
        title: 'Decision latency',
        confidence: round3(
          clamp(
            0.35 + slowestDecision.resolvedInMs / Math.max(1, slowestDecision.windowMs) * 0.4,
            MIN_CONFIDENCE,
            MAX_CONFIDENCE,
          ),
        ),
        evidence: [
          `Slowest decision tick=${slowestDecision.tickIndex}`,
          `Resolved in ${slowestDecision.resolvedInMs}ms of ${slowestDecision.windowMs}ms`,
        ],
        relatedTicks: [slowestDecision.tickIndex],
      });
    }

    if (input.shieldBreaches.length >= 2) {
      const totalShieldDamage = input.shieldBreaches.reduce((sum, breach) => sum + breach.damage, 0);
      causes.push({
        mode: FailureMode.ShieldBreach,
        title: 'Shield breach chain',
        confidence: round3(
          clamp(0.32 + totalShieldDamage / 300 + input.shieldBreaches.length * 0.08, MIN_CONFIDENCE, MAX_CONFIDENCE),
        ),
        evidence: [
          `Breaches=${input.shieldBreaches.length}`,
          `Total shield damage=${totalShieldDamage}`,
        ],
        relatedTicks: input.shieldBreaches.map((breach) => breach.tickIndex),
      });
    }

    if (input.alternateTimelines.length > 0) {
      causes.push({
        mode: FailureMode.ReplaySuggestion,
        title: 'Recoverable fork loss',
        confidence: round3(clamp(0.28 + input.alternateTimelines.length * 0.11, MIN_CONFIDENCE, 0.82)),
        evidence: [`Alternate forks=${input.alternateTimelines.length}`],
        relatedTicks: input.alternateTimelines.map((fork) => fork.tickIndex),
      });
    }

    if (input.mode === AfterActionGameMode.TEAM_UP && (input.trustScore ?? 100) < 45) {
      causes.push({
        mode: FailureMode.TrustCollapse,
        title: 'Trust collapse',
        confidence: round3(clamp(0.45 + (45 - (input.trustScore ?? 45)) / 100, MIN_CONFIDENCE, MAX_CONFIDENCE)),
        evidence: [`Trust score=${input.trustScore ?? 100}`],
        relatedTicks: this.collectTicks(input),
      });
    }

    if (
      input.mode === AfterActionGameMode.CHASE_A_LEGEND &&
      typeof input.divergenceScore === 'number' &&
      input.divergenceScore > 0.18
    ) {
      causes.push({
        mode: FailureMode.DivergenceLoss,
        title: 'Divergence drift',
        confidence: round3(clamp(0.4 + input.divergenceScore, MIN_CONFIDENCE, MAX_CONFIDENCE)),
        evidence: [`Divergence score=${input.divergenceScore}`],
        relatedTicks: this.collectTicks(input),
      });
    }

    if (input.botDamage.length > 0 && input.botDamage.some((bot) => bot.totalDamage > 30)) {
      const topBotThreat = this.pickTopBotThreat(input.botDamage);
      causes.push({
        mode: FailureMode.CascadeFailure,
        title: 'Pressure chain failure',
        confidence: round3(
          clamp(
            0.3 + (topBotThreat?.totalDamage ?? 0) / 120 + input.botDamage.length * 0.03,
            MIN_CONFIDENCE,
            MAX_CONFIDENCE,
          ),
        ),
        evidence: topBotThreat
          ? [`Top bot=${topBotThreat.displayName}`, `Bot damage=${topBotThreat.totalDamage}`]
          : ['Bot pressure registered'],
        relatedTicks: topBotThreat ? [topBotThreat.peakTick] : [],
      });
    }

    return causes.sort((a, b) => b.confidence - a.confidence).slice(0, 4);
  }

  private buildFallbackRootCause(input: AfterActionGenerationInput): RootCause {
    return {
      mode: FailureMode.ResourceLoss,
      title: 'Run breakdown',
      confidence: 0.25,
      evidence: [`Outcome=${input.outcome}`],
      relatedTicks: this.collectTicks(input),
    };
  }

  private buildCauseTriggerLine(input: AfterActionGenerationInput, cause: RootCause): string {
    switch (cause.mode) {
      case FailureMode.DebtSpiral:
        return `Cash failed to outrun burn. ${input.causeOfDeath} sealed the collapse.`;
      case FailureMode.DecisionLatency:
        return `The window stayed open; the answer arrived late. ${input.causeOfDeath} did the rest.`;
      case FailureMode.ShieldBreach:
        return `Breach stacking opened the lane. ${input.causeOfDeath} converted pressure into death.`;
      case FailureMode.TrustCollapse:
        return `Shared systems broke before the treasury could recover. ${input.causeOfDeath} followed.`;
      case FailureMode.DivergenceLoss:
        return `You drifted off the legend line. ${input.causeOfDeath} widened the gap.`;
      case FailureMode.CascadeFailure:
        return `Pressure linked faster than recovery. ${input.causeOfDeath} was the terminal node.`;
      case FailureMode.ReplaySuggestion:
        return `The run was still salvageable. One fork stayed open, and you missed it.`;
      case FailureMode.ResourceLoss:
      default:
        return `Liquidity failed before recovery arrived. ${input.causeOfDeath} was the final receipt.`;
    }
  }

  private buildReplaySuggestion(
    input: AfterActionGenerationInput,
    cause: RootCause,
    slowestDecision?: DecisionMoment,
  ): string {
    const fork = input.alternateTimelines[0];

    if (fork) {
      return `Replay from tick ${fork.tickIndex}: ${fork.title}. Choose the alternate line and compare the new outcome to "${fork.alternateOutcome}".`;
    }

    if (cause.mode === FailureMode.DecisionLatency && slowestDecision) {
      return `Replay tick ${slowestDecision.tickIndex} and force a decision inside 60% of the timer window.`;
    }

    if (cause.mode === FailureMode.TrustCollapse) {
      return 'Replay TEAM_UP with aid-first routing and no defection line for the first crisis cycle.';
    }

    if (cause.mode === FailureMode.DivergenceLoss) {
      return 'Replay CHASE_A_LEGEND with variance suppression and benchmark-window discipline.';
    }

    return `Replay the final stretch before tick ${input.tickOfCollapse ?? 0} and protect cash before chasing upside.`;
  }

  private buildTrainingRecommendation(
    input: AfterActionGenerationInput,
    cause: RootCause,
  ): TrainingRecommendation {
    switch (cause.mode) {
      case FailureMode.DecisionLatency:
        return {
          scenarioId: 'training_speed_window_v1',
          title: 'Speed Window Drill',
          reason: 'Your timer discipline broke before your economy did.',
          mode: input.mode,
        };

      case FailureMode.TrustCollapse:
        return {
          scenarioId: 'training_syndicate_trust_v1',
          title: 'Trust Audit Drill',
          reason: 'TEAM_UP losses need repayment discipline, rescue timing, and lower betrayal exposure.',
          mode: AfterActionGameMode.TEAM_UP,
        };

      case FailureMode.DivergenceLoss:
        return {
          scenarioId: 'training_phantom_benchmark_v1',
          title: 'Legend Benchmark Drill',
          reason: 'Your gap widened because timing precision and variance control drifted.',
          mode: AfterActionGameMode.CHASE_A_LEGEND,
        };

      case FailureMode.ShieldBreach:
      case FailureMode.CascadeFailure:
        return {
          scenarioId: 'training_defense_chain_v1',
          title: 'Defense Chain Drill',
          reason: 'You need shield maintenance before greed windows reopen.',
          mode: input.mode,
        };

      case FailureMode.DebtSpiral:
        return {
          scenarioId: 'training_cashflow_recovery_v1',
          title: 'Cashflow Recovery Drill',
          reason: 'You lost to burn expansion, not lack of opportunity.',
          mode: input.mode,
        };

      case FailureMode.ReplaySuggestion:
      case FailureMode.ResourceLoss:
      default:
        return {
          scenarioId: 'training_foundation_control_v1',
          title: 'Foundation Control Drill',
          reason: 'The next best run starts with stronger liquidity discipline.',
          mode: input.mode,
        };
    }
  }

  private buildTinyAction(
    input: AfterActionGenerationInput,
    cause: RootCause,
    slowestDecision?: DecisionMoment,
  ): TinyAction {
    switch (cause.mode) {
      case FailureMode.DecisionLatency:
        return {
          id: stableId('tiny', input.runId, 'latency'),
          title: 'Shorten the decision lane',
          description: `On your next run, commit every forced choice within ${Math.max(
            500,
            Math.floor((slowestDecision?.windowMs ?? 2_000) * 0.6),
          )}ms.`,
          why: 'Your fastest fix is tempo control, not a new build order.',
        };

      case FailureMode.TrustCollapse:
        return {
          id: stableId('tiny', input.runId, 'trust'),
          title: 'Stop unsecured aid',
          description: 'Do not send another aid transfer without explicit repayment timing or a rescue trigger.',
          why: 'TEAM_UP losses compound when shared risk is treated as free.',
        };

      case FailureMode.DivergenceLoss:
        return {
          id: stableId('tiny', input.runId, 'divergence'),
          title: 'Reduce variance immediately',
          description: 'Prioritize stability lines over hero lines in the next ghost benchmark window.',
          why: 'Phantom is won in fractions. Wild upside usually widens the gap.',
        };

      case FailureMode.ShieldBreach:
      case FailureMode.CascadeFailure:
        return {
          id: stableId('tiny', input.runId, 'breach'),
          title: 'Repair before expanding',
          description: 'Spend the next early resource spike on shield or pressure suppression, not upside.',
          why: 'Expansion without a floor created the opening that killed the run.',
        };

      case FailureMode.DebtSpiral:
        return {
          id: stableId('tiny', input.runId, 'burn'),
          title: 'Freeze burn growth',
          description: 'Refuse any card line that raises burn until your recurring income stabilizes above current expense pressure.',
          why: 'Your immediate problem was survivability, not scale.',
        };

      case FailureMode.ReplaySuggestion:
      case FailureMode.ResourceLoss:
      default:
        return {
          id: stableId('tiny', input.runId, 'cash'),
          title: 'Hold liquidity first',
          description: 'Keep the next safety buffer intact before taking a second upside play.',
          why: 'The run died because recovery capital vanished too early.',
        };
    }
  }

  private buildMediumAction(
    input: AfterActionGenerationInput,
    cause: RootCause,
    trainingRecommendation: TrainingRecommendation,
  ): MediumAction {
    switch (cause.mode) {
      case FailureMode.DecisionLatency:
        return {
          id: stableId('medium', input.runId, 'latency'),
          title: 'Rebuild your timer muscle',
          description: 'Run three consecutive low-variance scenarios where every forced card must be answered before 60% timer decay.',
          recommendedScenario: trainingRecommendation.title,
          why: 'You need repeatable timing control, not one lucky correction.',
        };

      case FailureMode.TrustCollapse:
        return {
          id: stableId('medium', input.runId, 'trust'),
          title: 'Rehearse contract discipline',
          description: 'Replay TEAM_UP with aid, rescue, and treasury decisions logged as explicit obligations.',
          recommendedScenario: trainingRecommendation.title,
          why: 'Trust must become measurable or the team economy will stay exploitable.',
        };

      case FailureMode.DivergenceLoss:
        return {
          id: stableId('medium', input.runId, 'divergence'),
          title: 'Benchmark against the legend line',
          description: 'Train on ghost-marker windows until your decision order is stable before you chase superior divergence.',
          recommendedScenario: trainingRecommendation.title,
          why: 'You only earn the right to deviate after proving you can match.',
        };

      case FailureMode.ShieldBreach:
      case FailureMode.CascadeFailure:
        return {
          id: stableId('medium', input.runId, 'defense'),
          title: 'Install a defense-first opening',
          description: 'Run a dedicated recovery build that treats breaches and chain interrupts as first-class spending priorities.',
          recommendedScenario: trainingRecommendation.title,
          why: 'Your architecture needs a floor before it deserves acceleration.',
        };

      case FailureMode.DebtSpiral:
        return {
          id: stableId('medium', input.runId, 'cashflow'),
          title: 'Train cashflow recovery loops',
          description: 'Practice scenarios where every gain is graded by burn reduction first and upside second.',
          recommendedScenario: trainingRecommendation.title,
          why: 'A healthier foundation fixes more future runs than one bigger swing.',
        };

      case FailureMode.ReplaySuggestion:
      case FailureMode.ResourceLoss:
      default:
        return {
          id: stableId('medium', input.runId, 'foundation'),
          title: 'Rebuild the foundation phase',
          description: 'Drill the opening sequence until your first safety buffer and first productive asset are both secured before volatility spikes.',
          recommendedScenario: trainingRecommendation.title,
          why: 'Your best long fix is a stronger first phase, not a flashier late save.',
        };
    }
  }

  private pickFastestDecision(decisions: readonly DecisionMoment[]): DecisionMoment | undefined {
    return [...decisions].sort((a, b) => a.resolvedInMs - b.resolvedInMs)[0];
  }

  private pickSlowestDecision(decisions: readonly DecisionMoment[]): DecisionMoment | undefined {
    return [...decisions].sort((a, b) => b.resolvedInMs - a.resolvedInMs)[0];
  }

  private pickTopBotThreat(botDamage: readonly BotDamageSummary[]): BotDamageSummary | undefined {
    return [...botDamage].sort((a, b) => b.totalDamage - a.totalDamage)[0];
  }

  private collectTicks(input: AfterActionGenerationInput): number[] {
    const ticks = new Set<number>();

    if (typeof input.tickOfCollapse === 'number') {
      ticks.add(input.tickOfCollapse);
    }

    for (const breach of input.shieldBreaches) {
      ticks.add(breach.tickIndex);
    }

    for (const fork of input.alternateTimelines) {
      ticks.add(fork.tickIndex);
    }

    for (const bot of input.botDamage) {
      ticks.add(bot.peakTick);
    }

    return [...ticks].sort((a, b) => a - b);
  }

  public summarizeDecisionPressure(input: AfterActionGenerationInput): number {
    const pressureRatios = input.decisionMoments.map((moment) =>
      clamp(moment.resolvedInMs / Math.max(1, moment.windowMs), 0, 1),
    );

    return round3(average(pressureRatios));
  }
}