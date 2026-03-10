//backend/src/game/engine/shield/__tests__/AttackRouter.spec.ts

import { describe, expect, it } from 'vitest';

import type {
  AttackCategory,
  AttackEvent,
  ShieldLayerId,
} from '../../core/GamePrimitives';
import type { ShieldLayerState } from '../../core/RunStateSnapshot';
import { AttackRouter } from '../AttackRouter';
import { buildShieldLayerState } from '../types';

function createAttack(
  attackId: string,
  options: {
    readonly category?: AttackCategory;
    readonly targetLayer?: ShieldLayerId | 'DIRECT';
    readonly magnitude?: number;
    readonly createdAtTick?: number;
    readonly notes?: readonly string[];
  } = {},
): AttackEvent {
  return {
    attackId,
    source: 'SYSTEM',
    targetEntity: 'SELF',
    targetLayer: options.targetLayer ?? 'DIRECT',
    category: options.category ?? 'DRAIN',
    magnitude: options.magnitude ?? 10,
    createdAtTick: options.createdAtTick ?? 1,
    notes: [...(options.notes ?? [])],
  };
}

function createLayers(
  overrides: Partial<
    Record<
      ShieldLayerId,
      {
        readonly current: number;
        readonly lastDamagedTick?: number | null;
        readonly lastRecoveredTick?: number | null;
      }
    >
  > = {},
): readonly ShieldLayerState[] {
  return [
    buildShieldLayerState(
      'L1',
      overrides.L1?.current ?? 100,
      overrides.L1?.lastDamagedTick ?? null,
      overrides.L1?.lastRecoveredTick ?? null,
    ),
    buildShieldLayerState(
      'L2',
      overrides.L2?.current ?? 80,
      overrides.L2?.lastDamagedTick ?? null,
      overrides.L2?.lastRecoveredTick ?? null,
    ),
    buildShieldLayerState(
      'L3',
      overrides.L3?.current ?? 60,
      overrides.L3?.lastDamagedTick ?? null,
      overrides.L3?.lastRecoveredTick ?? null,
    ),
    buildShieldLayerState(
      'L4',
      overrides.L4?.current ?? 40,
      overrides.L4?.lastDamagedTick ?? null,
      overrides.L4?.lastRecoveredTick ?? null,
    ),
  ];
}

describe('AttackRouter', () => {
  it('orders attacks by priority, then critical semantics, then createdAtTick, then magnitude', () => {
    const router = new AttackRouter();

    const ordered = router.order([
      createAttack('drain-late-big', {
        category: 'DRAIN',
        createdAtTick: 4,
        magnitude: 99,
      }),
      createAttack('debt-mid', {
        category: 'DEBT',
        createdAtTick: 3,
        magnitude: 30,
      }),
      createAttack('drain-critical', {
        category: 'DRAIN',
        createdAtTick: 9,
        magnitude: 1,
        notes: ['critical'],
      }),
      createAttack('breach-first', {
        category: 'BREACH',
        createdAtTick: 10,
        magnitude: 5,
      }),
      createAttack('drain-early-small', {
        category: 'DRAIN',
        createdAtTick: 2,
        magnitude: 1,
      }),
    ]);

    expect(ordered.map((attack) => attack.attackId)).toEqual([
      'breach-first',
      'debt-mid',
      'drain-critical',
      'drain-early-small',
      'drain-late-big',
    ]);
  });

  it('maps financial sabotage semantics to L1 with L2 fallback', () => {
    const router = new AttackRouter();

    const routed = router.resolve(
      createAttack('attack-financial-sabotage', {
        category: 'DRAIN',
        targetLayer: 'DIRECT',
        notes: ['financial-sabotage'],
      }),
      createLayers(),
    );

    expect(routed.doctrineType).toBe('FINANCIAL_SABOTAGE');
    expect(routed.targetLayer).toBe('L1');
    expect(routed.fallbackLayer).toBe('L2');
  });

  it('respects an explicit target-layer hint when doctrine tags do not override it', () => {
    const router = new AttackRouter();

    const routed = router.resolve(
      createAttack('attack-target-hint', {
        category: 'DRAIN',
        targetLayer: 'L3',
        notes: [],
      }),
      createLayers(),
    );

    expect(routed.targetLayer).toBe('L3');
    expect(routed.fallbackLayer).toBe('L4');
  });

  it('routes hater injection to the weakest layer and breaks ties toward the inner layer', () => {
    const router = new AttackRouter();

    const routed = router.resolve(
      createAttack('attack-hater-injection', {
        category: 'HEAT',
        targetLayer: 'DIRECT',
        notes: ['hater-injection'],
      }),
      createLayers({
        L1: { current: 40 },
        L4: { current: 16 },
      }),
    );

    expect(routed.doctrineType).toBe('HATER_INJECTION');
    expect(routed.targetLayer).toBe('L4');
    expect(routed.fallbackLayer).toBe('L1');
  });

  it('uses fallback when the primary target is already breached', () => {
    const router = new AttackRouter();

    const effective = router.resolveEffectiveTarget(
      {
        targetLayer: 'L1',
        fallbackLayer: 'L2',
      },
      createLayers({
        L1: { current: 0, lastDamagedTick: 7 },
      }),
    );

    expect(effective).toBe('L2');
  });

  it('finds the innermost non-breached layer when primary and fallback are both gone', () => {
    const router = new AttackRouter();

    const effective = router.resolveEffectiveTarget(
      {
        targetLayer: 'L1',
        fallbackLayer: 'L2',
      },
      createLayers({
        L1: { current: 0, lastDamagedTick: 3 },
        L2: { current: 0, lastDamagedTick: 3 },
        L4: { current: 0, lastDamagedTick: 3 },
      }),
    );

    expect(effective).toBe('L3');
  });

  it('returns L4 when every layer is already breached', () => {
    const router = new AttackRouter();

    const effective = router.resolveEffectiveTarget(
      {
        targetLayer: 'L1',
        fallbackLayer: 'L2',
      },
      createLayers({
        L1: { current: 0, lastDamagedTick: 1 },
        L2: { current: 0, lastDamagedTick: 1 },
        L3: { current: 0, lastDamagedTick: 1 },
        L4: { current: 0, lastDamagedTick: 1 },
      }),
    );

    expect(effective).toBe('L4');
  });
});