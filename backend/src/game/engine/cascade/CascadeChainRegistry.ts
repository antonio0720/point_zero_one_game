/*
 * POINT ZERO ONE — BACKEND CASCADE REGISTRY
 * /backend/src/game/engine/cascade/CascadeChainRegistry.ts
 *
 * Doctrine:
 * - every cascade template is explicit and deterministic
 * - backend keeps severity, recovery, and pacing rules centralized
 * - templates should align to shield-layer semantics and mode doctrine
 */

import type { ShieldLayerId } from '../core/GamePrimitives';
import type { CascadeTemplate, CascadeTemplateId } from './types';

export class CascadeChainRegistry {
  private readonly templates: Readonly<Record<CascadeTemplateId, CascadeTemplate>> = {
    LIQUIDITY_SPIRAL: {
      templateId: 'LIQUIDITY_SPIRAL',
      label: 'Liquidity Spiral',
      positive: false,
      severity: 'HIGH',
      dedupeKey: 'shield:L1',
      maxConcurrent: 2,
      maxTriggersPerRun: 4,
      baseOffsets: [1, 3, 5],
      effects: [
        { cashDelta: -450, heatDelta: 1, cascadeTag: 'liquidity' },
        { cashDelta: -950, heatDelta: 2, cascadeTag: 'liquidity' },
        { cashDelta: -1600, heatDelta: 3, shieldDelta: -2, cascadeTag: 'liquidity' },
      ],
      recoveryTags: ['liquidity', 'resilience', 'aid'],
      recovery: [
        { kind: 'CARD_TAG_ANY', tags: ['liquidity', 'resilience', 'aid'] },
        { kind: 'CASH_MIN', amount: 2500 },
      ],
      modeOffsetModifier: {
        ghost: 1,
      },
      pressureScalar: {
        T0: 0.9,
        T1: 1.0,
        T2: 1.1,
        T3: 1.2,
        T4: 1.35,
      },
      notes: ['Targets cash reserve weakness first.', 'Accelerates under ghost pressure.'],
    },

    CREDIT_FREEZE: {
      templateId: 'CREDIT_FREEZE',
      label: 'Credit Freeze',
      positive: false,
      severity: 'HIGH',
      dedupeKey: 'shield:L2',
      maxConcurrent: 2,
      maxTriggersPerRun: 3,
      baseOffsets: [2, 4],
      effects: [
        { shieldDelta: -4, heatDelta: 1, cascadeTag: 'credit' },
        { shieldDelta: -6, heatDelta: 2, cascadeTag: 'compliance' },
      ],
      recoveryTags: ['credit', 'compliance', 'evidence'],
      recovery: [
        { kind: 'CARD_TAG_ANY', tags: ['credit', 'compliance', 'evidence'] },
        { kind: 'WEAKEST_SHIELD_RATIO_MIN', ratio: 0.55 },
      ],
      modeOffsetModifier: {
        pvp: 1,
      },
      pressureScalar: {
        T0: 0.9,
        T1: 1.0,
        T2: 1.1,
        T3: 1.25,
        T4: 1.4,
      },
      notes: ['Designed to stress the credit-line layer.', 'Punishes repeated L2 breaches.'],
    },

    INCOME_SHOCK: {
      templateId: 'INCOME_SHOCK',
      label: 'Income Shock',
      positive: false,
      severity: 'CRITICAL',
      dedupeKey: 'shield:L3',
      maxConcurrent: 2,
      maxTriggersPerRun: 3,
      baseOffsets: [1, 2, 4],
      effects: [
        { incomeDelta: -90, cashDelta: -300, cascadeTag: 'income' },
        { incomeDelta: -120, cashDelta: -500, cascadeTag: 'income' },
        { incomeDelta: -160, cashDelta: -750, heatDelta: 1, cascadeTag: 'aid' },
      ],
      recoveryTags: ['income', 'aid', 'rescue'],
      recovery: [
        { kind: 'CARD_TAG_ANY', tags: ['income', 'aid', 'rescue'] },
        { kind: 'CASH_MIN', amount: 3000 },
        { kind: 'PRESSURE_NOT_ABOVE', tier: 'T2' },
      ],
      modeOffsetModifier: {
        solo: 0,
        coop: -1,
        pvp: 1,
        ghost: 1,
      },
      pressureScalar: {
        T0: 0.85,
        T1: 1.0,
        T2: 1.15,
        T3: 1.3,
        T4: 1.45,
      },
      notes: ['Most dangerous to long-run economy stability.', 'Gets meaner in PvP and Ghost runs.'],
    },

    NETWORK_LOCKDOWN: {
      templateId: 'NETWORK_LOCKDOWN',
      label: 'Network Lockdown',
      positive: false,
      severity: 'CRITICAL',
      dedupeKey: 'shield:L4',
      maxConcurrent: 1,
      maxTriggersPerRun: 2,
      baseOffsets: [2, 5],
      effects: [
        { shieldDelta: -5, heatDelta: 2, cascadeTag: 'network' },
        { shieldDelta: -7, heatDelta: 2, cashDelta: -250, cascadeTag: 'trust' },
      ],
      recoveryTags: ['network', 'trust', 'signal_clear'],
      recovery: [
        { kind: 'CARD_TAG_ANY', tags: ['network', 'trust', 'signal_clear'] },
        { kind: 'TRUST_ANY_MIN', score: 80 },
        { kind: 'ALL_SHIELDS_RATIO_MIN', ratio: 0.45 },
      ],
      modeOffsetModifier: {
        coop: -1,
        ghost: 1,
      },
      pressureScalar: {
        T0: 1.0,
        T1: 1.05,
        T2: 1.15,
        T3: 1.3,
        T4: 1.5,
      },
      notes: ['Represents systemic L4 compromise.', 'Co-op trust can blunt it earlier.'],
    },

    COMEBACK_SURGE: {
      templateId: 'COMEBACK_SURGE',
      label: 'Comeback Surge',
      positive: true,
      severity: 'MEDIUM',
      dedupeKey: 'positive:comeback',
      maxConcurrent: 1,
      maxTriggersPerRun: 1,
      baseOffsets: [0, 1, 2],
      effects: [
        { shieldDelta: 2, cashDelta: 150, cascadeTag: 'recovery' },
        { shieldDelta: 2, cashDelta: 200, heatDelta: -1, cascadeTag: 'recovery' },
        { shieldDelta: 3, cashDelta: 300, heatDelta: -1, cascadeTag: 'recovery' },
      ],
      recoveryTags: [],
      recovery: [],
      modeOffsetModifier: {
        solo: 0,
        pvp: 0,
        coop: 0,
        ghost: 0,
      },
      pressureScalar: {
        T0: 1.0,
        T1: 1.0,
        T2: 1.0,
        T3: 1.1,
        T4: 1.15,
      },
      notes: ['High-pressure rebound reward.', 'One-time unlock per run in current backend shape.'],
    },

    MOMENTUM_ENGINE: {
      templateId: 'MOMENTUM_ENGINE',
      label: 'Momentum Engine',
      positive: true,
      severity: 'LOW',
      dedupeKey: 'positive:momentum',
      maxConcurrent: 1,
      maxTriggersPerRun: 1,
      baseOffsets: [0, 2, 4],
      effects: [
        { incomeDelta: 60, cashDelta: 100, cascadeTag: 'momentum' },
        { incomeDelta: 75, cashDelta: 150, heatDelta: -1, cascadeTag: 'momentum' },
        { incomeDelta: 90, cashDelta: 200, heatDelta: -1, cascadeTag: 'momentum' },
      ],
      recoveryTags: [],
      recovery: [],
      modeOffsetModifier: {
        coop: 0,
        solo: 0,
        pvp: 0,
        ghost: 0,
      },
      pressureScalar: {
        T0: 1.0,
        T1: 1.0,
        T2: 1.0,
        T3: 1.0,
        T4: 1.0,
      },
      notes: ['Stable positive flywheel.', 'Best unlocked from clean fundamentals, not panic.'],
    },
  };

  public get(templateId: string): CascadeTemplate {
    const template = this.templates[templateId as CascadeTemplateId];
    if (!template) {
      throw new Error(`Unknown cascade template: ${templateId}`);
    }
    return template;
  }

  public forLayer(layerId: ShieldLayerId): CascadeTemplateId {
    switch (layerId) {
      case 'L1':
        return 'LIQUIDITY_SPIRAL';
      case 'L2':
        return 'CREDIT_FREEZE';
      case 'L3':
        return 'INCOME_SHOCK';
      case 'L4':
        return 'NETWORK_LOCKDOWN';
      default:
        throw new Error(`Unsupported shield layer for cascade mapping: ${String(layerId)}`);
    }
  }

  public listPositiveTemplateIds(): readonly CascadeTemplateId[] {
    return (Object.values(this.templates) as CascadeTemplate[]).filter((template) => template.positive).map((template) => template.templateId);
  }
}