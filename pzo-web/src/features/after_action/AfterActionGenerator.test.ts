//pzo-web/src/features/after_action/AfterActionGenerator.test.ts

import { describe, it, expect } from 'vitest';
import { GameMode, RunPhase } from '../../engines/cards/types';
import type { DecisionRecord } from '../../engines/cards/types';
import {
  AfterActionGenerator,
  FailureMode,
  VerificationState,
  type AfterActionDecisionRecord,
  type AfterActionInput,
} from './AfterActionGenerator';

function makeDecision(
  overrides: Partial<AfterActionDecisionRecord> = {},
): AfterActionDecisionRecord {
  const base: AfterActionDecisionRecord = {
    cardId: 'opp_rental_001',
    instanceId: 'inst_001',
    decisionWindowMs: 4_000,
    resolvedInMs: 1_500,
    wasAutoResolved: false,
    wasOptimalChoice: true,
    speedScore: 0.9,
    timingScore: 0.9,
    choiceScore: 1.0,
    compositeScore: 0.93,
    cordContribution: 0.05,
    tickIndex: 10,
  };

  return {
    ...base,
    ...overrides,
  };
}

function makeInput(
  overrides: Partial<AfterActionInput> = {},
): AfterActionInput {
  return {
    runId: 'run_001',
    gameMode: GameMode.GO_ALONE,
    phase: RunPhase.ESCALATION,
    tickAtFailure: 120,
    verificationState: VerificationState.PENDING,
    cashAtFailure: 500,
    burnAtFailure: 1_500,
    largestHit: 4_200,
    reserveMonths: 0.2,
    debtServiceRatio: 0.2,
    creditLineScore: 65,
    opportunityPassCount: 0,
    missedOpportunityStreak: 0,
    cascadeChainsActive: 0,
    fubarHitsRecent: 0,
    macroShockActive: false,
    forcedLiquidation: false,
    assetMaintenanceOverdue: false,
    recentDeltas: [
      { label: 'Income tick', amount: 900 },
      { label: 'Expense spike', amount: -1_800 },
      { label: 'Forced hit', amount: -4_200 },
    ],
    decisionRecords: [
      makeDecision({ tickIndex: 112, compositeScore: 0.85 }),
      makeDecision({ tickIndex: 117, compositeScore: 0.30, wasAutoResolved: true, cordContribution: -0.15 }),
    ],
    ...overrides,
  };
}

describe('AfterActionGenerator', () => {
  const generator = new AfterActionGenerator();

  it('classifies cashflow collapse and routes to reserve discipline', () => {
    const result = generator.generate(
      makeInput({
        reserveMonths: 0.1,
        burnAtFailure: 2_100,
        cashAtFailure: 300,
      }),
    );

    expect(result.failureMode).toBe(FailureMode.CASHFLOW_COLLAPSE);
    expect(result.training.failureSignature).toBe('No reserves + high burn');
    expect(result.training.scenarioKey).toBe('reserve_discipline');
    expect(result.mediumAction.scenarioKey).toBe('reserve_discipline');
    expect(result.causeOfDeath.deathName).toBe('Cashflow Collapse');
  });

  it('classifies tight credit before generic debt/cashflow failure', () => {
    const result = generator.generate(
      makeInput({
        creditLineScore: 15,
        debtServiceRatio: 0.52,
      }),
    );

    expect(result.failureMode).toBe(FailureMode.CREDIT_FREEZE_SPIRAL);
    expect(result.training.scenarioKey).toBe('tight_credit_gauntlet');
    expect(result.training.failureSignature).toBe('Over-leverage under tight credit');
  });

  it('classifies missed opportunity patterns when pass behavior dominates', () => {
    const result = generator.generate(
      makeInput({
        cashAtFailure: 4_000,
        burnAtFailure: 900,
        creditLineScore: 70,
        debtServiceRatio: 0.15,
        reserveMonths: 2.4,
        opportunityPassCount: 3,
        missedOpportunityStreak: 2,
      }),
    );

    expect(result.failureMode).toBe(FailureMode.MISSED_OPPORTUNITY);
    expect(result.training.scenarioKey).toBe('opportunity_ev_lab');
    expect(result.tinyAction.chipLabel).toBe('Opportunity Selection');
  });

  it('prefers the worst recent decision as the turning point for the practice fork', () => {
    const result = generator.generate(
      makeInput({
        decisionRecords: [
          makeDecision({
            tickIndex: 101,
            compositeScore: 0.88,
            wasAutoResolved: false,
            cordContribution: 0.03,
          }),
          makeDecision({
            tickIndex: 118,
            compositeScore: 0.18,
            wasAutoResolved: true,
            cordContribution: -0.20,
          }),
        ],
      }),
    );

    expect(result.practiceFork.collapseTick).toBe(120);
    expect(result.practiceFork.forkFromTick).toBe(115);
    expect(result.practiceFork.turningPointLine).toContain('Tick 118');
  });

  it('classifies ghost divergence in phantom mode', () => {
    const result = generator.generate(
      makeInput({
        gameMode: GameMode.CHASE_A_LEGEND,
        divergenceGap: 0.22,
        reserveMonths: 1.5,
        burnAtFailure: 800,
        cashAtFailure: 2_500,
      }),
    );

    expect(result.failureMode).toBe(FailureMode.GHOST_DIVERGENCE);
    expect(result.training.scenarioKey).toBe('recovery_line');
    expect(result.mediumAction.scenarioName).toBe('Recovery Line');
  });

  it('classifies trust breakdown in team mode when trust collapses', () => {
    const result = generator.generate(
      makeInput({
        gameMode: GameMode.TEAM_UP,
        trustScore: 22,
        reserveMonths: 1.8,
        burnAtFailure: 1_000,
        cashAtFailure: 1_900,
      }),
    );

    expect(result.failureMode).toBe(FailureMode.TRUST_BREAKDOWN);
    expect(result.training.scenarioKey).toBe('trust_audit');
    expect(result.causeOfDeath.deathName).toBe('Trust Breakdown');
  });
});