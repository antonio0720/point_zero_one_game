// backend/src/game/engine/card_effects.test.ts

import { describe, it, expect } from 'vitest';
import {
  CardEffectOp,
  CardEffectsExecutor,
  DeckType,
  GameMode,
  TimingClass,
  Targeting,
  CardTag,
  type CardDefinitionSnapshot,
  type CardInHand,
  type CardPlayRequest,
  type ExecutionContext,
} from './card_effects_executor';

function makeCard(
  definitionOverrides: Partial<CardDefinitionSnapshot> = {},
  runtimeOverlay: CardInHand['overlay'] = undefined,
): CardInHand {
  const definition: CardDefinitionSnapshot = {
    cardId: 'opportunity_digital_stream_001',
    name: 'Digital Revenue Stream',
    deckType: DeckType.OPPORTUNITY,
    targeting: Targeting.SELF,
    baseCost: 8_500,
    timingClasses: [TimingClass.PRE, TimingClass.ANY],
    tags: [CardTag.INCOME, CardTag.SCALE, CardTag.MOMENTUM],
    educationalTag: 'build recurring income before volatility expands',
    effects: [
      {
        op: CardEffectOp.INCOME_DELTA,
        magnitude: 1_800,
      },
    ],
    modeLegal: [GameMode.GO_ALONE, GameMode.CHASE_A_LEGEND],
    modeOverlays: {
      [GameMode.GO_ALONE]: {
        costModifier: 0.9,
        effectModifier: 1.1,
        cordWeight: 1.05,
      },
      [GameMode.HEAD_TO_HEAD]: {
        legal: false,
      },
    },
    ...definitionOverrides,
  };

  return {
    instanceId: 'card_inst_001',
    definition,
    overlay: runtimeOverlay,
  };
}

function makeRequest(overrides: Partial<CardPlayRequest> = {}): CardPlayRequest {
  return {
    instanceId: 'card_inst_001',
    choiceId: 'choice_primary',
    timestamp: 1_700_000_000_000,
    timingClass: TimingClass.PRE,
    ...overrides,
  };
}

function makeContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    mode: GameMode.GO_ALONE,
    runSeed: 'seed_alpha',
    tickIndex: 12,
    currentWindow: TimingClass.PRE,
    battleBudget: 100,
    treasury: 1_000,
    trustScore: 70,
    divergenceScore: 0.12,
    availableTargetIds: ['opponent_001', 'ally_001'],
    ...overrides,
  };
}

describe('backend card_effects_executor', () => {
  it('applies GO_ALONE mode overlay deterministically', () => {
    const executor = new CardEffectsExecutor();

    const result = executor.executeOne({
      card: makeCard(),
      request: makeRequest(),
      context: makeContext(),
      isOptimalChoice: true,
    });

    expect(result.cardId).toBe('opportunity_digital_stream_001');
    expect(result.mode).toBe(GameMode.GO_ALONE);
    expect(result.effectiveCost).toBe(7650);
    expect(result.currencyUsed).toBe('cash');
    expect(result.effects).toHaveLength(1);
    expect(result.effects[0].finalMagnitude).toBe(1980);
    expect(result.resourceDelta.cash).toBe(-7650);
    expect(result.resourceDelta.income).toBe(1980);
    expect(result.totalCordDelta).toBeGreaterThan(0);
    expect(result.playId).toContain('play_');
    expect(result.deterministicHash).toHaveLength(64);
  });

  it('routes SABOTAGE cards to battle budget in HEAD_TO_HEAD', () => {
    const executor = new CardEffectsExecutor();

    const card = makeCard(
      {
        cardId: 'sabotage_market_dump_001',
        name: 'Market Dump',
        deckType: DeckType.SABOTAGE,
        targeting: Targeting.OPPONENT,
        baseCost: 30,
        timingClasses: [TimingClass.CTR, TimingClass.POST],
        tags: [CardTag.SABOTAGE, CardTag.TEMPO, CardTag.INCOME],
        effects: [
          {
            op: CardEffectOp.EXPENSE_DELTA,
            magnitude: 300,
          },
        ],
        modeLegal: [GameMode.HEAD_TO_HEAD],
        modeOverlays: {
          [GameMode.HEAD_TO_HEAD]: {
            effectModifier: 1.2,
            targetingOverride: Targeting.OPPONENT,
            cordWeight: 1.15,
          },
        },
      },
      undefined,
    );

    const result = executor.executeOne({
      card,
      request: makeRequest({
        timingClass: TimingClass.CTR,
        targetId: 'opponent_001',
      }),
      context: makeContext({
        mode: GameMode.HEAD_TO_HEAD,
        currentWindow: TimingClass.CTR,
        activeCounterWindow: true,
        battleBudget: 60,
      }),
    });

    expect(result.currencyUsed).toBe('battle_budget');
    expect(result.effectiveCost).toBe(30);
    expect(result.resourceDelta.battleBudget).toBe(-30);
    expect(result.effects[0].finalMagnitude).toBe(360);
    expect(result.effects[0].resolvedTargetId).toBe('opponent_001');
    expect(result.targeting).toBe(Targeting.OPPONENT);
  });

  it('rejects RESCUE timing when rescue window is closed', () => {
    const executor = new CardEffectsExecutor();

    const card = makeCard({
      cardId: 'rescue_stabilize_001',
      name: 'Stabilize Ally',
      deckType: DeckType.RESCUE,
      targeting: Targeting.TEAMMATE,
      baseCost: 120,
      timingClasses: [TimingClass.RES],
      tags: [CardTag.RESILIENCE, CardTag.AID, CardTag.TRUST],
      effects: [
        {
          op: CardEffectOp.SHIELD_DELTA,
          magnitude: 40,
        },
      ],
      modeLegal: [GameMode.TEAM_UP],
    });

    expect(() =>
      executor.executeOne({
        card,
        request: makeRequest({
          timingClass: TimingClass.RES,
          targetId: 'ally_001',
        }),
        context: makeContext({
          mode: GameMode.TEAM_UP,
          currentWindow: TimingClass.RES,
          activeRescueWindow: false,
          treasury: 500,
        }),
      }),
    ).toThrow(/rescue window is not open/i);
  });

  it('scales TRUST and AID effects from trust score in TEAM_UP', () => {
    const executor = new CardEffectsExecutor();

    const card = makeCard({
      cardId: 'aid_bridge_001',
      name: 'Aid Bridge',
      deckType: DeckType.AID,
      targeting: Targeting.TEAMMATE,
      baseCost: 200,
      timingClasses: [TimingClass.AID],
      tags: [CardTag.AID, CardTag.TRUST, CardTag.RESILIENCE],
      effects: [
        {
          op: CardEffectOp.SHIELD_DELTA,
          magnitude: 20,
        },
        {
          op: CardEffectOp.TRUST_DELTA,
          magnitude: 10,
        },
      ],
      modeLegal: [GameMode.TEAM_UP],
      modeOverlays: {
        [GameMode.TEAM_UP]: {
          cordWeight: 1.2,
        },
      },
    });

    const result = executor.executeOne({
      card,
      request: makeRequest({
        timingClass: TimingClass.AID,
        targetId: 'ally_001',
      }),
      context: makeContext({
        mode: GameMode.TEAM_UP,
        currentWindow: TimingClass.AID,
        activeAidWindow: true,
        treasury: 1_000,
        trustScore: 80,
      }),
    });

    expect(result.currencyUsed).toBe('treasury');
    expect(result.resourceDelta.treasury).toBe(-200);
    expect(result.effects[0].finalMagnitude).toBe(16);
    expect(result.effects[1].finalMagnitude).toBe(8);
    expect(result.totalCordDelta).toBeGreaterThan(0);
  });

  it('rewards precision and divergence in CHASE_A_LEGEND', () => {
    const executor = new CardEffectsExecutor();

    const card = makeCard({
      cardId: 'ghost_marker_exploit_001',
      name: 'Marker Exploit',
      deckType: DeckType.GHOST,
      targeting: Targeting.GHOST,
      baseCost: 0,
      timingClasses: [TimingClass.GBM],
      tags: [CardTag.DIVERGENCE, CardTag.PRECISION, CardTag.RESILIENCE],
      effects: [
        {
          op: CardEffectOp.SHIELD_DELTA,
          magnitude: 12,
        },
        {
          op: CardEffectOp.CORD_BONUS_FLAT,
          magnitude: 0.04,
        },
      ],
      modeLegal: [GameMode.CHASE_A_LEGEND],
      modeOverlays: {
        [GameMode.CHASE_A_LEGEND]: {
          cordWeight: 1.3,
        },
      },
    });

    const result = executor.executeOne({
      card,
      request: makeRequest({
        timingClass: TimingClass.GBM,
      }),
      context: makeContext({
        mode: GameMode.CHASE_A_LEGEND,
        currentWindow: TimingClass.GBM,
        activeGhostBenchmarkWindow: true,
        divergenceScore: 0.25,
      }),
      isOptimalChoice: true,
    });

    expect(result.effects[0].finalMagnitude).toBeGreaterThan(12);
    expect(result.effects[1].finalMagnitude).toBeGreaterThanOrEqual(0.04);
    expect(result.totalCordDelta).toBeGreaterThan(0.04);
  });

  it('keeps deterministic hash stable for identical inputs', () => {
    const executor = new CardEffectsExecutor();

    const item = {
      card: makeCard(),
      request: makeRequest(),
      context: makeContext(),
      isOptimalChoice: false,
    };

    const first = executor.executeOne(item);
    const second = executor.executeOne(item);

    expect(first.deterministicHash).toBe(second.deterministicHash);
    expect(first.playId).toBe(second.playId);
  });
});