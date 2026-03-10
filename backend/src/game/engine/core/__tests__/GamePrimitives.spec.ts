//backend/src/game/engine/core/__tests__/GamePrimitives.spec.ts

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MODE_OVERLAY,
  getShieldLayerLabel,
  isDeckType,
  isIntegrityStatus,
  isModeCode,
  isPressureTier,
  isRunOutcome,
  isRunPhase,
  isShieldLayerId,
  isTimingClass,
  isVerifiedGrade,
  isVisibilityLevel,
  mergeEffectPayload,
  normalizeModeOverlay,
  resolveModeOverlay,
  createCardInstance,
  type CardDefinition,
  type EffectPayload,
  type ModeOverlay,
} from '../GamePrimitives';

describe('GamePrimitives', () => {
  describe('type guards', () => {
    it('recognizes valid primitive runtime values', () => {
      expect(isModeCode('solo')).toBe(true);
      expect(isPressureTier('T4')).toBe(true);
      expect(isRunPhase('ESCALATION')).toBe(true);
      expect(isRunOutcome('FREEDOM')).toBe(true);
      expect(isShieldLayerId('L4')).toBe(true);
      expect(isTimingClass('CTR')).toBe(true);
      expect(isDeckType('COUNTER')).toBe(true);
      expect(isVisibilityLevel('EXPOSED')).toBe(true);
      expect(isIntegrityStatus('VERIFIED')).toBe(true);
      expect(isVerifiedGrade('A')).toBe(true);
    });

    it('rejects invalid primitive runtime values', () => {
      expect(isModeCode('ranked')).toBe(false);
      expect(isPressureTier('T5')).toBe(false);
      expect(isRunPhase('OPENING')).toBe(false);
      expect(isRunOutcome('WIN')).toBe(false);
      expect(isShieldLayerId('L5')).toBe(false);
      expect(isTimingClass('MID')).toBe(false);
      expect(isDeckType('ATTACK')).toBe(false);
      expect(isVisibilityLevel('FULL')).toBe(false);
      expect(isIntegrityStatus('SIGNED')).toBe(false);
      expect(isVerifiedGrade('S')).toBe(false);
    });
  });

  describe('normalizeModeOverlay', () => {
    it('returns the canonical defaults when no overlay is provided', () => {
      const normalized = normalizeModeOverlay();

      expect(normalized).toEqual<ModeOverlay>({
        costModifier: DEFAULT_MODE_OVERLAY.costModifier,
        effectModifier: DEFAULT_MODE_OVERLAY.effectModifier,
        tagWeights: {},
        timingLock: [],
        legal: true,
        targetingOverride: undefined,
        divergencePotential: undefined,
      });
    });

    it('fills missing fields while preserving explicit overlay values', () => {
      const normalized = normalizeModeOverlay({
        costModifier: 0.85,
        tagWeights: {
          discipline: 2,
          trust: 1,
        },
        timingLock: ['PRE', 'CTR'],
        legal: false,
        targetingOverride: 'TEAMMATE',
        divergencePotential: 'HIGH',
      });

      expect(normalized).toEqual<ModeOverlay>({
        costModifier: 0.85,
        effectModifier: 1,
        tagWeights: {
          discipline: 2,
          trust: 1,
        },
        timingLock: ['PRE', 'CTR'],
        legal: false,
        targetingOverride: 'TEAMMATE',
        divergencePotential: 'HIGH',
      });
    });
  });

  describe('resolveModeOverlay and createCardInstance', () => {
    const definition: CardDefinition = {
      id: 'CARD_001',
      name: 'Trust Injection',
      deckType: 'TRUST',
      baseCost: 10,
      baseEffect: {
        cashDelta: 5,
        trustDelta: 2,
      },
      tags: ['trust', 'aid'],
      timingClass: ['PRE', 'AID'],
      rarity: 'RARE',
      autoResolve: false,
      counterability: 'SOFT',
      targeting: 'TEAM',
      decisionTimerOverrideMs: 8_000,
      decayTicks: 3,
      modeLegal: ['coop', 'solo'],
      modeOverlay: {
        coop: {
          costModifier: 0.5,
          effectModifier: 1.25,
          timingLock: ['AID'],
          legal: true,
          targetingOverride: 'TEAMMATE',
          divergencePotential: 'MEDIUM',
        },
      },
      educationalTag: 'collaboration',
    };

    it('resolves the requested mode overlay and falls back to defaults when missing', () => {
      expect(resolveModeOverlay(definition, 'coop')).toEqual({
        costModifier: 0.5,
        effectModifier: 1.25,
        tagWeights: {},
        timingLock: ['AID'],
        legal: true,
        targetingOverride: 'TEAMMATE',
        divergencePotential: 'MEDIUM',
      });

      expect(resolveModeOverlay(definition, 'solo')).toEqual({
        costModifier: 1,
        effectModifier: 1,
        tagWeights: {},
        timingLock: [],
        legal: true,
        targetingOverride: undefined,
        divergencePotential: undefined,
      });
    });

    it('creates a card instance with overlay-adjusted defaults for the selected mode', () => {
      const instance = createCardInstance(definition, {
        instanceId: 'INSTANCE_001',
        mode: 'coop',
      });

      expect(instance).toEqual({
        instanceId: 'INSTANCE_001',
        definitionId: 'CARD_001',
        card: definition,
        cost: 5,
        targeting: 'TEAMMATE',
        timingClass: ['PRE', 'AID'],
        tags: ['trust', 'aid'],
        overlayAppliedForMode: 'coop',
        decayTicksRemaining: 3,
        divergencePotential: 'MEDIUM',
      });
    });

    it('allows runtime overrides while still preserving deterministic instance shape', () => {
      const instance = createCardInstance(definition, {
        instanceId: 'INSTANCE_002',
        mode: 'solo',
        cost: 7,
        targeting: 'SELF',
        timingClass: ['PRE'],
        tags: ['custom', 'trust'],
        decayTicksRemaining: 9,
        divergencePotential: 'HIGH',
      });

      expect(instance).toEqual({
        instanceId: 'INSTANCE_002',
        definitionId: 'CARD_001',
        card: definition,
        cost: 7,
        targeting: 'SELF',
        timingClass: ['PRE'],
        tags: ['trust', 'aid', 'custom'],
        overlayAppliedForMode: 'solo',
        decayTicksRemaining: 9,
        divergencePotential: 'HIGH',
      });
    });
  });

  describe('mergeEffectPayload', () => {
    it('adds numeric deltas, preserves latest nullable selections, and de-duplicates arrays', () => {
      const base: EffectPayload = {
        cashDelta: 10,
        debtDelta: 2,
        incomeDelta: 4,
        expenseDelta: 1,
        shieldDelta: 3,
        heatDelta: 1,
        trustDelta: 2,
        treasuryDelta: 5,
        battleBudgetDelta: 1,
        holdChargeDelta: 1,
        counterIntelDelta: 0,
        timeDeltaMs: 500,
        divergenceDelta: 1,
        cascadeTag: 'base-chain',
        injectCards: ['CARD_A', 'CARD_B'],
        exhaustCards: ['CARD_X'],
        grantBadges: ['BADGE_ALPHA'],
        namedActionId: 'ACTION_BASE',
      };

      const delta: EffectPayload = {
        cashDelta: -3,
        debtDelta: 1,
        incomeDelta: 6,
        expenseDelta: 2,
        shieldDelta: -1,
        heatDelta: 4,
        trustDelta: -1,
        treasuryDelta: 3,
        battleBudgetDelta: 2,
        holdChargeDelta: -1,
        counterIntelDelta: 2,
        timeDeltaMs: 250,
        divergenceDelta: 3,
        cascadeTag: 'delta-chain',
        injectCards: ['CARD_B', 'CARD_C'],
        exhaustCards: ['CARD_Y', 'CARD_X'],
        grantBadges: ['BADGE_BETA', 'BADGE_ALPHA'],
        namedActionId: 'ACTION_DELTA',
      };

      expect(mergeEffectPayload(base, delta)).toEqual({
        cashDelta: 7,
        debtDelta: 3,
        incomeDelta: 10,
        expenseDelta: 3,
        shieldDelta: 2,
        heatDelta: 5,
        trustDelta: 1,
        treasuryDelta: 8,
        battleBudgetDelta: 3,
        holdChargeDelta: 0,
        counterIntelDelta: 2,
        timeDeltaMs: 750,
        divergenceDelta: 4,
        cascadeTag: 'delta-chain',
        injectCards: ['CARD_A', 'CARD_B', 'CARD_C'],
        exhaustCards: ['CARD_X', 'CARD_Y'],
        grantBadges: ['BADGE_ALPHA', 'BADGE_BETA'],
        namedActionId: 'ACTION_DELTA',
      });
    });

    it('works safely when both inputs are sparse', () => {
      expect(mergeEffectPayload({}, {})).toEqual({
        cashDelta: 0,
        debtDelta: 0,
        incomeDelta: 0,
        expenseDelta: 0,
        shieldDelta: 0,
        heatDelta: 0,
        trustDelta: 0,
        treasuryDelta: 0,
        battleBudgetDelta: 0,
        holdChargeDelta: 0,
        counterIntelDelta: 0,
        timeDeltaMs: 0,
        divergenceDelta: 0,
        cascadeTag: null,
        injectCards: [],
        exhaustCards: [],
        grantBadges: [],
        namedActionId: null,
      });
    });
  });

  describe('shield label mapping', () => {
    it('maps layer ids to their canonical labels', () => {
      expect(getShieldLayerLabel('L1')).toBe('CASH_RESERVE');
      expect(getShieldLayerLabel('L2')).toBe('CREDIT_LINE');
      expect(getShieldLayerLabel('L3')).toBe('INCOME_BASE');
      expect(getShieldLayerLabel('L4')).toBe('NETWORK_CORE');
    });
  });
});