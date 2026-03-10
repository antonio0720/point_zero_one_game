// backend/src/game/engine/card_effects.integration.test.ts

import { describe, expect, it } from 'vitest';
import { CardRegistry } from './card_registry';
import { TimingValidator } from './timing_validator';
import { CardEffectsExecutor } from './card_effects_executor';
import {
  GameMode,
  TimingClass,
  type ExecutionContext,
  type CardPlayRequest,
} from './card_types';
import {
  ChaseALegendModeEngine,
  createInitialChaseALegendModeState,
  type LegendBaseline,
} from '../modes/chase_a_legend_mode';

function asExecutorContext(context: ExecutionContext): import('./card_effects_executor').ExecutionContext {
  return context as unknown as import('./card_effects_executor').ExecutionContext;
}

function asExecutorRequest(request: CardPlayRequest): import('./card_effects_executor').CardPlayRequest {
  return request as unknown as import('./card_effects_executor').CardPlayRequest;
}

function asExecutorCard(card: import('./card_types').CardInHand): import('./card_effects_executor').CardInHand {
  return card as unknown as import('./card_effects_executor').CardInHand;
}

describe('backend card effects integration', () => {
  it('draws, validates, and executes a GO_ALONE opportunity card end-to-end', () => {
    const registry = new CardRegistry();
    const validator = new TimingValidator();
    const executor = new CardEffectsExecutor();

    const context: ExecutionContext = {
      mode: GameMode.GO_ALONE,
      runSeed: 'seed_go_alone_alpha',
      tickIndex: 4,
      currentWindow: TimingClass.PRE,
      currentPhase: 'FOUNDATION',
      currentPressureTier: 'T1_STABLE',
      battleBudget: 0,
      treasury: 0,
      trustScore: 50,
      divergenceScore: 0,
      availableTargetIds: [],
    };

    const card = registry.instantiateCard(
      'opp_digital_revenue_stream_001',
      GameMode.GO_ALONE,
      4,
      context,
    );
    expect(card).not.toBeNull();

    const request: CardPlayRequest = {
      instanceId: card!.instanceId,
      choiceId: 'choice_primary',
      timestamp: 1_700_000_000_000,
      timingClass: TimingClass.PRE,
    };

    const validation = validator.validate(card!, request, context);
    expect(validation.valid).toBe(true);
    expect(validation.rejectionCode).toBeNull();

    const result = executor.executeOne({
      card: asExecutorCard(card!),
      request: asExecutorRequest(request),
      context: asExecutorContext(context),
      isOptimalChoice: true,
    });

    expect(result.cardId).toBe('opp_digital_revenue_stream_001');
    expect(result.mode).toBe('GO_ALONE');
    expect(result.effectiveCost).toBeGreaterThan(0);
    expect(result.resourceDelta.cash).toBeLessThan(0);
    expect(result.resourceDelta.income).toBeGreaterThan(0);
    expect(result.totalCordDelta).toBeGreaterThan(0);
    expect(result.educationalTag).toBe('cashflow > paper gains');
  });

  it('validates and executes TEAM_UP aid flow with treasury-backed routing', () => {
    const registry = new CardRegistry();
    const validator = new TimingValidator();
    const executor = new CardEffectsExecutor();

    const context: ExecutionContext = {
      mode: GameMode.TEAM_UP,
      runSeed: 'seed_team_up_alpha',
      tickIndex: 9,
      currentWindow: TimingClass.AID,
      activeAidWindow: true,
      treasury: 50_000,
      trustScore: 82,
      availableTargetIds: ['ally_001'],
    };

    const card = registry.instantiateCard(
      'aid_liquidity_bridge_001',
      GameMode.TEAM_UP,
      9,
      context,
    );
    expect(card).not.toBeNull();

    const request: CardPlayRequest = {
      instanceId: card!.instanceId,
      choiceId: 'aid_choice',
      timestamp: 1_700_000_000_100,
      timingClass: TimingClass.AID,
      targetId: 'ally_001',
    };

    const validation = validator.validate(card!, request, context);
    expect(validation.valid).toBe(true);
    expect(validation.effectiveTargeting).toBe('TEAMMATE');

    const result = executor.executeOne({
      card: asExecutorCard(card!),
      request: asExecutorRequest(request),
      context: asExecutorContext(context),
      isOptimalChoice: true,
    });

    expect(result.mode).toBe('TEAM_UP');
    expect(result.currencyUsed).toBe('treasury');
    expect(result.resourceDelta.treasury).toBeLessThanOrEqual(0);
    expect(result.effects.some((effect) => effect.op === 'cash_delta')).toBe(true);
    expect(result.effects.some((effect) => effect.op === 'trust_delta')).toBe(true);
    expect(result.totalCordDelta).toBeGreaterThan(0);
  });

  it('executes CHASE_A_LEGEND ghost pass and writes replay audit with superior decision notation', () => {
    const registry = new CardRegistry();
    const validator = new TimingValidator();
    const executor = new CardEffectsExecutor();

    const legend: LegendBaseline = {
      legendId: 'legend_001',
      label: 'Season 7 Legend',
      sourceMode: GameMode.GO_ALONE,
      seasonId: 's7',
      outcome: 'FREEDOM',
      integrityStatus: 'VERIFIED',
      proofHash: 'abc123legendproof',
      originalHeat: 10,
      finalCord: 1.25,
      setAtEpochMs: 1_699_000_000_000,
      totalCommunityRunsSinceLegend: 25_000,
      challengeCount: 400,
      beatCount: 12,
      averageClosingGap: 0.04,
      challengers: [
        { challengerId: 'c1', cord: 1.21, proofHash: 'c1proof' },
        { challengerId: 'c2', cord: 1.22, proofHash: 'c2proof' },
        { challengerId: 'c3', cord: 1.24, proofHash: 'c3proof' },
      ],
      markers: [
        {
          markerId: 'm_red_5',
          tick: 5,
          color: 'RED',
          legendCardId: 'opp_distressed_asset_acquisition_001',
          legendOutcomeNote: 'Legend passed here',
          legendCordImpact: 0.01,
          legendIncomeDelta: 1100,
        },
      ],
      tickSnapshots: [
        { tick: 0, cord: 0 },
        { tick: 4, cord: 0.2, lastPlayedCardId: 'disc_precision_hold_001' },
        { tick: 5, cord: 0.24, lastPlayedCardId: 'opp_distressed_asset_acquisition_001' },
        { tick: 10, cord: 0.6, lastPlayedCardId: 'ghost_pass_exploit_001' },
        { tick: 20, cord: 1.25, lastPlayedCardId: 'leg_sovereign_leverage_001' },
      ],
    };

    const chase = new ChaseALegendModeEngine(
      createInitialChaseALegendModeState({
        runId: 'run_phantom_001',
        seed: 'seed_phantom_alpha',
        currentTimeMs: 1_700_000_000_000,
        legend,
        player: {
          playerId: 'player_001',
          displayName: 'Antonio',
          cash: 50_000,
          income: 4_000,
          expenses: 2_500,
          shields: 100,
        },
      }),
      registry,
    );

    chase.dispatch({
      type: 'ADVANCE_TICK',
      timestampMs: 1_700_000_000_000,
    });
    chase.dispatch({
      type: 'ADVANCE_TICK',
      timestampMs: 1_700_000_001_000,
    });
    chase.dispatch({
      type: 'ADVANCE_TICK',
      timestampMs: 1_700_000_002_000,
    });
    chase.dispatch({
      type: 'ADVANCE_TICK',
      timestampMs: 1_700_000_003_000,
    });
    chase.dispatch({
      type: 'ADVANCE_TICK',
      timestampMs: 1_700_000_004_000,
    });

    const context: ExecutionContext = {
      mode: GameMode.CHASE_A_LEGEND,
      runSeed: 'seed_phantom_alpha',
      tickIndex: 5,
      currentWindow: TimingClass.GBM,
      activeGhostBenchmarkWindow: true,
      divergenceScore: 0.25,
      availableTargetIds: [],
      battleBudget: 0,
      treasury: 0,
      trustScore: 50,
    };

    const card = registry.instantiateCard(
      'ghost_pass_exploit_001',
      GameMode.CHASE_A_LEGEND,
      5,
      context,
    );
    expect(card).not.toBeNull();

    const request: CardPlayRequest = {
      instanceId: card!.instanceId,
      choiceId: 'ghost_pass_choice',
      timestamp: 1_700_000_005_000,
      timingClass: TimingClass.GBM,
    };

    const validation = validator.validate(card!, request, context);
    expect(validation.valid).toBe(true);

    const result = executor.executeOne({
      card: asExecutorCard(card!),
      request: asExecutorRequest(request),
      context: asExecutorContext(context),
      isOptimalChoice: true,
    });

    chase.dispatch({
      type: 'RECORD_PLAYER_CARD_PLAY',
      tick: 5,
      cardId: 'ghost_pass_exploit_001',
      totalCordDelta: result.totalCordDelta,
      generatedIncomeDelta: 1800,
      usedGhostVision: true,
      outperformedLegendChoice: true,
      replayProofHashFragment: result.deterministicHash.slice(0, 12),
    });

    chase.dispatch({
      type: 'RECORD_FREEDOM',
      proofHash: 'playerproofhash',
      integrityVerified: true,
      finalCord: 1.27,
      outcome: 'FREEDOM',
      challengersBeaten: 1,
    });

    const state = chase.getState();

    expect(state.player.superiorDecisionNotations).toBe(1);
    expect(state.player.replayAudit).toHaveLength(1);
    expect(state.player.replayAudit[0].matchedMarkerColor).toBe('RED');
    expect(state.player.replayAudit[0].gapArrow === '↑' || state.player.replayAudit[0].gapArrow === '↑↑').toBe(true);
    expect(state.player.finalTier === 'CHALLENGER' || state.player.finalTier === 'NEW_LEGEND').toBe(true);
    expect(state.macro.activeGhostWindows.length).toBeGreaterThan(0);
  });
});