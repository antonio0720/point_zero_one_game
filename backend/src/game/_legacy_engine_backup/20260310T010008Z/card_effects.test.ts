///Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/game/engine/card_effects.test.ts

import { describe, it, expect } from 'vitest';
import {
  CardEffectOp,
  CardEffectsExecutor,
  CardEffectResolver,
  type CardInHand,
  type CardPlayRequest,
} from './card_effects_executor';

function makeCard(overrides: Partial<CardInHand> = {}): CardInHand {
  return {
    instanceId: 'card_inst_001',
    definition: {
      cardId: 'opp_salary_boost_001',
      name: 'Salary Boost',
      effects: [
        {
          op: CardEffectOp.INCOME_DELTA,
          magnitude: 500,
        },
      ],
    },
    overlay: {
      effectModifier: 1,
      cordWeight: 1,
    },
    ...overrides,
  };
}

function makeRequest(overrides: Partial<CardPlayRequest> = {}): CardPlayRequest {
  return {
    instanceId: 'card_inst_001',
    choiceId: 'choice_primary',
    timestamp: 1_700_000_000_000,
    ...overrides,
  };
}

describe('backend card_effects_executor', () => {
  it('executes a single effect deterministically', () => {
    const executor = new CardEffectsExecutor(new CardEffectResolver());

    const result = executor.executeOne({
      card: makeCard(),
      request: makeRequest(),
      tickIndex: 12,
      isOptimalChoice: true,
    });

    expect(result.cardId).toBe('opp_salary_boost_001');
    expect(result.choiceId).toBe('choice_primary');
    expect(result.appliedAt).toBe(12);
    expect(result.effects).toHaveLength(1);
    expect(result.effects[0].op).toBe(CardEffectOp.INCOME_DELTA);
    expect(result.effects[0].finalMagnitude).toBe(500);
    expect(result.totalCordDelta).toBeCloseTo(0.0025, 6);
    expect(result.isOptimalChoice).toBe(true);
  });

  it('applies overlay effectModifier to magnitudes', () => {
    const executor = new CardEffectsExecutor();

    const result = executor.executeOne({
      card: makeCard({
        overlay: {
          effectModifier: 1.5,
          cordWeight: 1,
        },
      }),
      request: makeRequest(),
      tickIndex: 3,
    });

    expect(result.effects[0].finalMagnitude).toBe(750);
    expect(result.totalCordDelta).toBeCloseTo(0.00375, 6);
  });

  it('aggregates batch execution totals', () => {
    const executor = new CardEffectsExecutor();

    const result = executor.executeMany([
      {
        card: makeCard(),
        request: makeRequest({ choiceId: 'choice_a' }),
        tickIndex: 1,
      },
      {
        card: makeCard({
          instanceId: 'card_inst_002',
          definition: {
            cardId: 'opp_expense_spike_001',
            name: 'Expense Spike',
            effects: [
              {
                op: CardEffectOp.EXPENSE_DELTA,
                magnitude: 300,
              },
            ],
          },
          overlay: {
            effectModifier: 1,
            cordWeight: 1,
          },
        }),
        request: makeRequest({
          instanceId: 'card_inst_002',
          choiceId: 'choice_b',
        }),
        tickIndex: 2,
      },
    ]);

    expect(result.playCount).toBe(2);
    expect(result.results).toHaveLength(2);
    expect(result.results[0].choiceId).toBe('choice_a');
    expect(result.results[1].choiceId).toBe('choice_b');
    expect(result.totalCordDelta).toBeCloseTo(0.0016, 6);
  });

  it('supports no-op cards without exploding', () => {
    const executor = new CardEffectsExecutor();

    const result = executor.executeOne({
      card: makeCard({
        definition: {
          cardId: 'noop_card',
          effects: [
            {
              op: CardEffectOp.NO_OP,
              magnitude: 999,
            },
          ],
        },
      }),
      request: makeRequest(),
      tickIndex: 7,
    });

    expect(result.effects[0].finalMagnitude).toBe(0);
    expect(result.totalCordDelta).toBe(0);
  });
});