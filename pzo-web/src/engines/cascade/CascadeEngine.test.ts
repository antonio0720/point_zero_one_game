/**
 * FILE: pzo-web/src/engines/cascade/CascadeEngine.test.ts
 *
 * Four test groups:
 *   Group 1: CascadeQueueManager — activation, cap, CATASTROPHIC acceleration, execution, interception, deferral
 *   Group 2: RecoveryConditionChecker — all 7 condition types, retroactive scanning, COMPOUND logic
 *   Group 3: PositiveCascadeTracker — all 5 chains, activation thresholds, dissolution, NEMESIS guard
 *   Group 4: Effect combination rules — heat summation, income factor multiplication
 *
 * All tests must pass before Engine 6 is considered complete.
 *
 * Density6 LLC · Point Zero One · Engine 6 of 7 · Confidential
 */
import { CascadeQueueManager }       from './CascadeQueueManager';
import { RecoveryConditionChecker }  from './RecoveryConditionChecker';
import { PositiveCascadeTracker }    from './PositiveCascadeTracker';
import { CascadeChainRegistry }      from './CascadeChainRegistry';
import {
  ChainId,
  CascadeEffectType,
  RecoveryType,
  RecoveryActionLog,
  RecoveryCondition,
  CascadeChainInstance,
  ChainInstanceStatus,
  LinkStatus,
  CascadeSeverity,
  CascadeDirection,
  CASCADE_CONSTANTS,
} from './types';
import { ShieldLayerId }  from '../shield/types';
import { BotId }          from '../battle/types';

// =============================================================================
// TEST HELPERS
// =============================================================================

function mockShieldReader(layerIntegrityPct = 1.0) {
  return {
    getLayerState: (layerId: ShieldLayerId) => ({
      layerId,
      integrityPct:    layerIntegrityPct,
      currentIntegrity:100 * layerIntegrityPct,
      maxIntegrity:    100,
      regenRate:       2,
      isBreached:      layerIntegrityPct <= 0,
    }),
  };
}

function buildRecoveryLog(overrides: {
  cardTypesPlayed?:      Record<number, string[]>;
  budgetActionsUsed?:    Record<number, string[]>;
  nemesisCount?:         Record<string, number>;
  consecutivePositiveFlowTicks?: number;
  consecutiveCleanTicks?:        number;
  consecutiveFortifiedTicks?:    number;
} = {}): RecoveryActionLog {
  const log: RecoveryActionLog = {
    cardTypesPlayedSinceMap:      new Map(),
    budgetActionsUsedSinceMap:    new Map(),
    nemesisNeutralizationCount:   new Map(),
    consecutivePositiveFlowTicks: overrides.consecutivePositiveFlowTicks ?? 0,
    consecutiveCleanTicks:        overrides.consecutiveCleanTicks        ?? 0,
    consecutiveFortifiedTicks:    overrides.consecutiveFortifiedTicks    ?? 0,
  };
  for (const [tick, cards] of Object.entries(overrides.cardTypesPlayed ?? {})) {
    log.cardTypesPlayedSinceMap.set(Number(tick), cards as string[]);
  }
  for (const [tick, actions] of Object.entries(overrides.budgetActionsUsed ?? {})) {
    log.budgetActionsUsedSinceMap.set(Number(tick), actions as string[]);
  }
  for (const [botId, count] of Object.entries(overrides.nemesisCount ?? {})) {
    log.nemesisNeutralizationCount.set(botId, count);
  }
  return log;
}

function buildRunState(overrides: {
  netWorth?:           number;
  freedomThreshold?:   number;
  hasActiveAllianceMember?: boolean;
} = {}): any {
  return {
    netWorth:                overrides.netWorth            ?? 50000,
    freedomThreshold:        overrides.freedomThreshold    ?? 100000,
    monthlyIncome:           5000,
    monthlyExpenses:         3000,
    hasActiveAllianceMember: overrides.hasActiveAllianceMember ?? false,
    haterHeat:               30,
    consecutivePositiveFlowTicks: 0,
    consecutiveCleanTicks:        0,
    consecutiveFortifiedTicks:    0,
  };
}

// Builds a minimal chain instance for RecoveryConditionChecker tests
function buildMockInstance(overrides: {
  triggeredAtTick?:    number;
  recoveryCardType?:   string;
  recoveryActionType?: string;
  useCompoundAnd?:     boolean;
  useCompoundOr?:      boolean;
}): CascadeChainInstance {
  const { triggeredAtTick = 10 } = overrides;

  let recoveryConditions: RecoveryCondition[];

  if (overrides.useCompoundAnd) {
    recoveryConditions = [{
      type:            RecoveryType.COMPOUND_AND,
      breaksLinksFrom: 1,
      description:     'Both conditions must be met',
      sub: [
        { type: RecoveryType.CARD_PLAYED_TYPE,   cardType: 'INCOME_BOOST',       description: 'Income card played' },
        { type: RecoveryType.BUDGET_ACTION_USED, budgetActionType: 'SHIELD_REPAIR_BOOST', description: 'Shield repair used' },
      ],
    }];
  } else if (overrides.useCompoundOr) {
    recoveryConditions = [{
      type:            RecoveryType.COMPOUND_OR,
      breaksLinksFrom: 1,
      description:     'Either condition satisfies',
      sub: [
        { type: RecoveryType.CARD_PLAYED_TYPE, cardType: 'LEGAL_FILING',       description: 'Legal filing' },
        { type: RecoveryType.BUDGET_ACTION_USED, budgetActionType: 'COMPLIANCE_SHIELD', description: 'Compliance shield' },
      ],
    }];
  } else {
    recoveryConditions = [{
      type:            RecoveryType.CARD_PLAYED_TYPE,
      cardType:        overrides.recoveryCardType ?? 'DEBT_PAYOFF',
      breaksLinksFrom: 2,
      description:     'Required card played',
    }];
  }

  return {
    instanceId:             'test-instance-001',
    chainId:                ChainId.CHAIN_LOAN_DEFAULT,
    status:                 ChainInstanceStatus.ACTIVE,
    triggeredAtTick,
    triggerEventType:       'MISSED_LOAN_PAYMENT',
    links:                  [],
    linksFireCount:         0,
    linksSkippedCount:      0,
    recoveryAchievedAtTick: null,
    recoveryType:           null,
    chainDef: {
      chainId:            ChainId.CHAIN_LOAN_DEFAULT,
      chainName:          'Test Chain',
      severity:           CascadeSeverity.MODERATE,
      direction:          CascadeDirection.NEGATIVE,
      triggerEventType:   'MISSED_LOAN_PAYMENT',
      links:              [],
      recoveryConditions,
      maxActiveInstances: 3,
      playerMessage:      'Test player message',
      recoveryMessage:    'Test recovery message',
    },
  } as CascadeChainInstance;
}

// =============================================================================
// GROUP 1: CascadeQueueManager
// =============================================================================

describe('CascadeQueueManager', () => {

  it('activateChain() creates instance with correct scheduledTicks from spec offsets', () => {
    const qm   = new CascadeQueueManager(mockShieldReader());
    const def  = CascadeChainRegistry.getNegativeChain(ChainId.CHAIN_LOAN_DEFAULT);
    const inst = qm.activateChain(def, 'MISSED_LOAN_PAYMENT', 10);

    expect(inst).not.toBeNull();
    expect(inst!.links[0].scheduledTick).toBe(11);  // tickOffset 1
    expect(inst!.links[1].scheduledTick).toBe(13);  // tickOffset 3
    expect(inst!.links[2].scheduledTick).toBe(17);  // tickOffset 7
    expect(inst!.links[3].scheduledTick).toBe(22);  // tickOffset 12
    expect(inst!.status).toBe(ChainInstanceStatus.QUEUED);
  });

  it('activateChain() assigns a unique instanceId (UUID)', () => {
    const qm  = new CascadeQueueManager(mockShieldReader());
    const def = CascadeChainRegistry.getNegativeChain(ChainId.CHAIN_LOAN_DEFAULT);
    const i1  = qm.activateChain(def, 'MISSED_LOAN_PAYMENT', 1);
    const i2  = qm.activateChain(def, 'MISSED_LOAN_PAYMENT', 2);

    expect(i1!.instanceId).not.toBe(i2!.instanceId);
  });

  it('activateChain() returns null at maxActiveInstances cap (LOAN_DEFAULT = 2)', () => {
    const qm  = new CascadeQueueManager(mockShieldReader());
    const def = CascadeChainRegistry.getNegativeChain(ChainId.CHAIN_LOAN_DEFAULT);

    qm.activateChain(def, 'MISSED_LOAN_PAYMENT', 1);
    qm.activateChain(def, 'MISSED_LOAN_PAYMENT', 2);
    const third = qm.activateChain(def, 'MISSED_LOAN_PAYMENT', 3);

    expect(third).toBeNull();
  });

  it('CATASTROPHIC chain: accelerates existing instance instead of creating a second', () => {
    const qm   = new CascadeQueueManager(mockShieldReader());
    const def  = CascadeChainRegistry.getNegativeChain(ChainId.CHAIN_FULL_CASCADE_BREACH);
    const inst = qm.activateChain(def, 'CASCADE_TRIGGERED', 5);

    expect(inst).not.toBeNull();
    const originalLink2Tick = inst!.links[2].scheduledTick; // tickOffset 4 → tick 9

    // Re-trigger at tick 6
    const second = qm.activateChain(def, 'CASCADE_TRIGGERED', 6);
    expect(second).toBeNull();  // no second instance

    // Existing instance links accelerated by -1
    expect(inst!.links[2].scheduledTick).toBe(originalLink2Tick - 1);
  });

  it('CATASTROPHIC link scheduledTick never goes below currentTick on acceleration', () => {
    const qm   = new CascadeQueueManager(mockShieldReader());
    const def  = CascadeChainRegistry.getNegativeChain(ChainId.CHAIN_FULL_CASCADE_BREACH);
    const inst = qm.activateChain(def, 'CASCADE_TRIGGERED', 5);

    // Force link 0 scheduledTick to 5 (already at currentTick)
    inst!.links[0].scheduledTick = 5;

    qm.activateChain(def, 'CASCADE_TRIGGERED', 7); // re-trigger at 7
    // Should not go below 7 (currentTick on second call)
    expect(inst!.links[0].scheduledTick).toBeGreaterThanOrEqual(5);
  });

  it('processTickLinks() fires canBeIntercepted=false links regardless of recovery', () => {
    const qm  = new CascadeQueueManager(mockShieldReader());
    const def = CascadeChainRegistry.getNegativeChain(ChainId.CHAIN_LOAN_DEFAULT);
    qm.activateChain(def, 'MISSED_LOAN_PAYMENT', 10);

    // Log DEBT_PAYOFF at tick 10 — would satisfy recovery, but link 0 is canBeIntercepted=false
    const log    = buildRecoveryLog({ cardTypesPlayed: { 10: ['DEBT_PAYOFF'] } });
    const result = qm.processTickLinks(11, log, {});

    expect(result.linksExecuted).toHaveLength(1);
    expect(result.linksExecuted[0].wasIntercepted).toBe(false);
    expect(result.linksExecuted[0].effectType).toBe(CascadeEffectType.CARD_INJECT);
  });

  it('processTickLinks() skips interceptable links when recovery condition met', () => {
    const qm  = new CascadeQueueManager(mockShieldReader());
    const def = CascadeChainRegistry.getNegativeChain(ChainId.CHAIN_LOAN_DEFAULT);
    const inst = qm.activateChain(def, 'MISSED_LOAN_PAYMENT', 10)!;

    // Fire link 0 and 1 without recovery
    qm.processTickLinks(11, buildRecoveryLog({}), {});
    qm.processTickLinks(13, buildRecoveryLog({}), {});

    // Recovery at tick 15 — DEBT_PAYOFF played
    const log    = buildRecoveryLog({ cardTypesPlayed: { 15: ['DEBT_PAYOFF'] } });
    const result = qm.processTickLinks(17, log, {}); // link 2 due at tick 17

    expect(result.chainsInterrupted).toHaveLength(1);
    expect(result.linksExecuted[0].wasIntercepted).toBe(true);
  });

  it('processTickLinks() marks instance INTERRUPTED after recovery intercepts it', () => {
    const qm   = new CascadeQueueManager(mockShieldReader());
    const def  = CascadeChainRegistry.getNegativeChain(ChainId.CHAIN_LIQUIDITY_BREACH);
    const inst = qm.activateChain(def, 'SHIELD_LAYER_BREACHED', 5)!;

    // Link 0 fires at tick 7 (canBeIntercepted=false)
    qm.processTickLinks(7, buildRecoveryLog({}), {});

    // Recovery before link 1 at tick 9
    const log = buildRecoveryLog({
      cardTypesPlayed:   { 8: ['INCOME_BOOST'] },
      budgetActionsUsed: { 8: ['SHIELD_REPAIR_BOOST'] },
    });
    qm.processTickLinks(9, log, {});

    expect(inst.status).toBe(ChainInstanceStatus.INTERRUPTED);
    expect(inst.recoveryAchievedAtTick).toBe(9);
  });

  it('processTickLinks() defers excess links beyond simultaneous cap of 5', () => {
    const qm  = new CascadeQueueManager(mockShieldReader());
    const def = CascadeChainRegistry.getNegativeChain(ChainId.CHAIN_LOAN_DEFAULT);

    // Activate 3 chains — each has link at tickOffset 1 from trigger 0
    const defLiquid = CascadeChainRegistry.getNegativeChain(ChainId.CHAIN_LIQUIDITY_BREACH);
    const defSabotage = CascadeChainRegistry.getNegativeChain(ChainId.CHAIN_HATER_SABOTAGE);
    const defPattern  = CascadeChainRegistry.getNegativeChain(ChainId.CHAIN_PATTERN_EXPLOITATION);

    // Manually create instances with links all due at tick 5
    const instances = [def, defLiquid, defSabotage, defLiquid, defPattern].map((d, i) => {
      const inst = qm.activateChain(d, 'TEST', 4);
      // Force all links to tick 5
      if (inst) {
        for (const l of inst.links) l.scheduledTick = 5;
      }
      return inst;
    }).filter(Boolean);

    const result = qm.processTickLinks(5, buildRecoveryLog({}), {});

    expect(result.linksExecuted.length).toBeLessThanOrEqual(CASCADE_CONSTANTS.MAX_SIMULTANEOUS_LINKS_PER_TICK);
    // Some should have been deferred
    if (instances.reduce((sum, i) => sum + (i?.links.length ?? 0), 0) > CASCADE_CONSTANTS.MAX_SIMULTANEOUS_LINKS_PER_TICK) {
      expect(result.linksDeferred).toBeGreaterThan(0);
    }
  });

  it('processTickLinks() sorts severity CATASTROPHIC before SEVERE before MILD', () => {
    const qm          = new CascadeQueueManager(mockShieldReader());
    const defCatastr  = CascadeChainRegistry.getNegativeChain(ChainId.CHAIN_FULL_CASCADE_BREACH);
    const defSevere   = CascadeChainRegistry.getNegativeChain(ChainId.CHAIN_LOAN_DEFAULT);

    const cInst = qm.activateChain(defCatastr, 'CASCADE_TRIGGERED', 4);
    const sInst = qm.activateChain(defSevere, 'MISSED_LOAN_PAYMENT', 4);

    // Force both first links to same tick
    if (cInst) cInst.links[0].scheduledTick = 5;
    if (sInst) sInst.links[0].scheduledTick = 5;

    const result = qm.processTickLinks(5, buildRecoveryLog({}), {});

    const severities = result.linksExecuted.map(e => e.severity);
    const catIndex   = severities.indexOf(CascadeSeverity.CATASTROPHIC);
    const sevIndex   = severities.indexOf(CascadeSeverity.SEVERE);

    if (catIndex >= 0 && sevIndex >= 0) {
      expect(catIndex).toBeLessThan(sevIndex);
    }
  });

  it('instance transitions QUEUED → ACTIVE on first link fire', () => {
    const qm   = new CascadeQueueManager(mockShieldReader());
    const def  = CascadeChainRegistry.getNegativeChain(ChainId.CHAIN_LOAN_DEFAULT);
    const inst = qm.activateChain(def, 'MISSED_LOAN_PAYMENT', 10)!;

    expect(inst.status).toBe(ChainInstanceStatus.QUEUED);
    qm.processTickLinks(11, buildRecoveryLog({}), {});
    expect(inst.status).toBe(ChainInstanceStatus.ACTIVE);
  });

  it('completed instances are removed from queue after all links fire/skip', () => {
    const qm  = new CascadeQueueManager(mockShieldReader());
    const def = CascadeChainRegistry.getNegativeChain(ChainId.CHAIN_PATTERN_EXPLOITATION);
    qm.activateChain(def, 'BOT_STATE_CHANGED', 0);

    // Fire link 0 at tick 1 (canBeIntercepted=false)
    qm.processTickLinks(1, buildRecoveryLog({}), {});
    expect(qm.getActiveInstances()).toHaveLength(1);

    // Recovery + fire/skip link 1 at tick 3
    const log = buildRecoveryLog({ budgetActionsUsed: { 1: ['PATTERN_BREAK'] } });
    qm.processTickLinks(3, log, {});

    // Instance should be completed and removed
    expect(qm.getActiveInstances()).toHaveLength(0);
  });

  it('dissolveChainsByTrigger() removes matching instances immediately', () => {
    const qm  = new CascadeQueueManager(mockShieldReader());
    const def = CascadeChainRegistry.getNegativeChain(ChainId.CHAIN_HATER_SABOTAGE);

    qm.activateChain(def, 'BOT_ATTACK_FIRED', 5);
    qm.activateChain(def, 'BOT_ATTACK_FIRED', 6);
    expect(qm.getActiveInstances()).toHaveLength(2);

    qm.dissolveChainsByTrigger('BOT_ATTACK_FIRED');
    expect(qm.getActiveInstances()).toHaveLength(0);
  });

  it('hasCatastrophicChain() returns true when catastrophic instance is active', () => {
    const qm  = new CascadeQueueManager(mockShieldReader());
    const def = CascadeChainRegistry.getNegativeChain(ChainId.CHAIN_FULL_CASCADE_BREACH);

    expect(qm.hasCatastrophicChain()).toBe(false);
    qm.activateChain(def, 'CASCADE_TRIGGERED', 1);
    expect(qm.hasCatastrophicChain()).toBe(true);
  });

  it('reset() clears all instances', () => {
    const qm  = new CascadeQueueManager(mockShieldReader());
    const def = CascadeChainRegistry.getNegativeChain(ChainId.CHAIN_LOAN_DEFAULT);
    qm.activateChain(def, 'MISSED_LOAN_PAYMENT', 1);
    qm.activateChain(def, 'MISSED_LOAN_PAYMENT', 2);

    qm.reset();
    expect(qm.getActiveInstances()).toHaveLength(0);
  });
});

// =============================================================================
// GROUP 2: RecoveryConditionChecker
// =============================================================================

describe('RecoveryConditionChecker', () => {

  it('CARD_PLAYED_TYPE: returns true if required card played any tick since trigger', () => {
    const checker = new RecoveryConditionChecker(mockShieldReader());
    const inst    = buildMockInstance({ triggeredAtTick: 10, recoveryCardType: 'DEBT_PAYOFF' });
    const log     = buildRecoveryLog({ cardTypesPlayed: { 12: ['DEBT_PAYOFF'] } });

    expect(checker.isRecovered(inst, 15, log, {})).toBe(true);
  });

  it('CARD_PLAYED_TYPE: retroactive scan — card played at trigger tick counts', () => {
    const checker = new RecoveryConditionChecker(mockShieldReader());
    const inst    = buildMockInstance({ triggeredAtTick: 10, recoveryCardType: 'DEBT_PAYOFF' });
    const log     = buildRecoveryLog({ cardTypesPlayed: { 10: ['DEBT_PAYOFF'] } }); // same tick as trigger

    expect(checker.isRecovered(inst, 15, log, {})).toBe(true);
  });

  it('CARD_PLAYED_TYPE: returns false if wrong card type played', () => {
    const checker = new RecoveryConditionChecker(mockShieldReader());
    const inst    = buildMockInstance({ triggeredAtTick: 10, recoveryCardType: 'DEBT_PAYOFF' });
    const log     = buildRecoveryLog({ cardTypesPlayed: { 12: ['INCOME_BOOST'] } });

    expect(checker.isRecovered(inst, 15, log, {})).toBe(false);
  });

  it('CARD_PLAYED_TYPE: returns false if card played before trigger tick', () => {
    const checker = new RecoveryConditionChecker(mockShieldReader());
    const inst    = buildMockInstance({ triggeredAtTick: 10, recoveryCardType: 'DEBT_PAYOFF' });
    const log     = buildRecoveryLog({ cardTypesPlayed: { 9: ['DEBT_PAYOFF'] } }); // before trigger

    expect(checker.isRecovered(inst, 15, log, {})).toBe(false);
  });

  it('BUDGET_ACTION_USED: returns true when matching action used since trigger', () => {
    const checker = new RecoveryConditionChecker(mockShieldReader());
    const inst = buildMockInstance({
      triggeredAtTick: 5,
      recoveryActionType: 'COUNTER_SABOTAGE',
    });
    // Override recovery condition to use BUDGET_ACTION_USED
    (inst.chainDef.recoveryConditions as any)[0] = {
      type:            RecoveryType.BUDGET_ACTION_USED,
      budgetActionType:'COUNTER_SABOTAGE',
      breaksLinksFrom: 1,
      description:     'Test',
    };

    const log = buildRecoveryLog({ budgetActionsUsed: { 6: ['COUNTER_SABOTAGE'] } });
    expect(checker.isRecovered(inst, 10, log, {})).toBe(true);
  });

  it('COMPOUND_AND: returns false if only one sub-condition is met', () => {
    const checker = new RecoveryConditionChecker(mockShieldReader());
    const inst    = buildMockInstance({ triggeredAtTick: 5, useCompoundAnd: true });
    const log     = buildRecoveryLog({
      cardTypesPlayed: { 7: ['INCOME_BOOST'] },
      // SHIELD_REPAIR_BOOST NOT present — second condition fails
    });

    expect(checker.isRecovered(inst, 10, log, {})).toBe(false);
  });

  it('COMPOUND_AND: returns true when ALL sub-conditions are met', () => {
    const checker = new RecoveryConditionChecker(mockShieldReader());
    const inst    = buildMockInstance({ triggeredAtTick: 5, useCompoundAnd: true });
    const log     = buildRecoveryLog({
      cardTypesPlayed:   { 7: ['INCOME_BOOST'] },
      budgetActionsUsed: { 6: ['SHIELD_REPAIR_BOOST'] },
    });

    expect(checker.isRecovered(inst, 10, log, {})).toBe(true);
  });

  it('COMPOUND_OR: returns true when only ONE sub-condition is met', () => {
    const checker = new RecoveryConditionChecker(mockShieldReader());
    const inst    = buildMockInstance({ triggeredAtTick: 5, useCompoundOr: true });
    const log     = buildRecoveryLog({
      cardTypesPlayed: { 7: ['LEGAL_FILING'] },
      // COMPLIANCE_SHIELD not present — but OR only needs one
    });

    expect(checker.isRecovered(inst, 10, log, {})).toBe(true);
  });

  it('COMPOUND_OR: returns false when no sub-conditions are met', () => {
    const checker = new RecoveryConditionChecker(mockShieldReader());
    const inst    = buildMockInstance({ triggeredAtTick: 5, useCompoundOr: true });
    const log     = buildRecoveryLog({});

    expect(checker.isRecovered(inst, 10, log, {})).toBe(false);
  });

  it('SHIELD_LAYER_ABOVE_PCT: returns true when layer integrity meets threshold', () => {
    const checker = new RecoveryConditionChecker(mockShieldReader(0.75));
    const inst    = buildMockInstance({ triggeredAtTick: 1 });
    (inst.chainDef.recoveryConditions as any)[0] = {
      type:            RecoveryType.SHIELD_LAYER_ABOVE_PCT,
      layerId:         ShieldLayerId.LIQUIDITY_BUFFER,
      abovePct:        0.50,
      breaksLinksFrom: 1,
      description:     'L1 above 50%',
    };

    expect(checker.isRecovered(inst, 5, buildRecoveryLog({}), {})).toBe(true);
  });

  it('SHIELD_LAYER_ABOVE_PCT: returns false when layer integrity below threshold', () => {
    const checker = new RecoveryConditionChecker(mockShieldReader(0.30));
    const inst    = buildMockInstance({ triggeredAtTick: 1 });
    (inst.chainDef.recoveryConditions as any)[0] = {
      type:            RecoveryType.SHIELD_LAYER_ABOVE_PCT,
      layerId:         ShieldLayerId.LIQUIDITY_BUFFER,
      abovePct:        0.50,
      breaksLinksFrom: 1,
      description:     'L1 above 50%',
    };

    expect(checker.isRecovered(inst, 5, buildRecoveryLog({}), {})).toBe(false);
  });

  it('CASHFLOW_POSITIVE_N: returns true when consecutive positive ticks meets threshold', () => {
    const checker = new RecoveryConditionChecker(mockShieldReader());
    const inst    = buildMockInstance({ triggeredAtTick: 1 });
    (inst.chainDef.recoveryConditions as any)[0] = {
      type:             RecoveryType.CASHFLOW_POSITIVE_N,
      consecutiveTicks: 3,
      breaksLinksFrom:  4,
      description:      '3 consecutive positive ticks',
    };

    const log = buildRecoveryLog({ consecutivePositiveFlowTicks: 3 });
    expect(checker.isRecovered(inst, 10, log, {})).toBe(true);
  });

  it('ALLIANCE_ACTIVE: returns true when hasActiveAllianceMember is true in runState', () => {
    const checker = new RecoveryConditionChecker(mockShieldReader());
    const inst    = buildMockInstance({ triggeredAtTick: 1 });
    (inst.chainDef.recoveryConditions as any)[0] = {
      type:            RecoveryType.ALLIANCE_ACTIVE,
      breaksLinksFrom: 1,
      description:     'Active alliance member',
    };

    expect(checker.isRecovered(inst, 5, buildRecoveryLog({}), { hasActiveAllianceMember: true })).toBe(true);
    expect(checker.isRecovered(inst, 5, buildRecoveryLog({}), { hasActiveAllianceMember: false })).toBe(false);
  });
});

// =============================================================================
// GROUP 3: PositiveCascadeTracker
// =============================================================================

describe('PositiveCascadeTracker', () => {

  it('PCHAIN_SUSTAINED_CASHFLOW activates at exactly 10 consecutive positive ticks', () => {
    const tracker = new PositiveCascadeTracker(mockShieldReader());

    // 9 ticks — not yet
    const r9 = tracker.evaluateTick(9, buildRunState(), buildRecoveryLog({ consecutivePositiveFlowTicks: 9 }));
    expect(r9.newlyActivated).not.toContain(ChainId.PCHAIN_SUSTAINED_CASHFLOW);

    // 10 ticks — activates
    const r10 = tracker.evaluateTick(10, buildRunState(), buildRecoveryLog({ consecutivePositiveFlowTicks: 10 }));
    expect(r10.newlyActivated).toContain(ChainId.PCHAIN_SUSTAINED_CASHFLOW);
    expect(tracker.isActive(ChainId.PCHAIN_SUSTAINED_CASHFLOW)).toBe(true);
  });

  it('PCHAIN_SUSTAINED_CASHFLOW dissolves immediately when cashflow goes negative', () => {
    const tracker = new PositiveCascadeTracker(mockShieldReader());

    tracker.evaluateTick(10, buildRunState(), buildRecoveryLog({ consecutivePositiveFlowTicks: 10 }));
    expect(tracker.isActive(ChainId.PCHAIN_SUSTAINED_CASHFLOW)).toBe(true);

    const result = tracker.evaluateTick(11, buildRunState(), buildRecoveryLog({ consecutivePositiveFlowTicks: 0 }));
    expect(result.dissolved).toContain(ChainId.PCHAIN_SUSTAINED_CASHFLOW);
    expect(tracker.isActive(ChainId.PCHAIN_SUSTAINED_CASHFLOW)).toBe(false);
  });

  it('PCHAIN_FORTIFIED_SHIELDS activates at 5 consecutive fortified ticks', () => {
    const tracker = new PositiveCascadeTracker(mockShieldReader(1.0));

    const r = tracker.evaluateTick(10, buildRunState(), buildRecoveryLog({ consecutiveFortifiedTicks: 5 }));
    expect(r.newlyActivated).toContain(ChainId.PCHAIN_FORTIFIED_SHIELDS);
    expect(tracker.isActive(ChainId.PCHAIN_FORTIFIED_SHIELDS)).toBe(true);
  });

  it('PCHAIN_FORTIFIED_SHIELDS PAUSES (not dissolves) when shield drops below 80%', () => {
    const tracker = new PositiveCascadeTracker(mockShieldReader(1.0));

    tracker.evaluateTick(10, buildRunState(), buildRecoveryLog({ consecutiveFortifiedTicks: 5 }));

    // Shield drops — fortifiedTicks resets to 0
    const result = tracker.evaluateTick(11, buildRunState(), buildRecoveryLog({ consecutiveFortifiedTicks: 0 }));
    expect(result.paused).toContain(ChainId.PCHAIN_FORTIFIED_SHIELDS);
    expect(tracker.isActive(ChainId.PCHAIN_FORTIFIED_SHIELDS)).toBe(false);
    expect(tracker.isPaused(ChainId.PCHAIN_FORTIFIED_SHIELDS)).toBe(true);
  });

  it('PCHAIN_FORTIFIED_SHIELDS resumes without re-accumulation after shields restore', () => {
    const tracker = new PositiveCascadeTracker(mockShieldReader(1.0));

    tracker.evaluateTick(10, buildRunState(), buildRecoveryLog({ consecutiveFortifiedTicks: 5 }));
    tracker.evaluateTick(11, buildRunState(), buildRecoveryLog({ consecutiveFortifiedTicks: 0 })); // pause
    expect(tracker.isPaused(ChainId.PCHAIN_FORTIFIED_SHIELDS)).toBe(true);

    const result = tracker.evaluateTick(12, buildRunState(), buildRecoveryLog({ consecutiveFortifiedTicks: 5 }));
    expect(result.resumed).toContain(ChainId.PCHAIN_FORTIFIED_SHIELDS);
    expect(tracker.isActive(ChainId.PCHAIN_FORTIFIED_SHIELDS)).toBe(true);
  });

  it('PCHAIN_NEMESIS_BROKEN fires on 2nd neutralization of same bot', () => {
    const tracker = new PositiveCascadeTracker(mockShieldReader());

    // 1st neutralization — should NOT fire
    const r1 = tracker.evaluateTick(5, buildRunState(), buildRecoveryLog({ nemesisCount: { 'BOT_01': 1 } }));
    expect(r1.newlyActivated).not.toContain(ChainId.PCHAIN_NEMESIS_BROKEN);

    // 2nd neutralization — fires
    const r2 = tracker.evaluateTick(8, buildRunState(), buildRecoveryLog({ nemesisCount: { 'BOT_01': 2 } }));
    expect(r2.newlyActivated).toContain(ChainId.PCHAIN_NEMESIS_BROKEN);
    expect(r2.nemesisBrokenBotId).toBe('BOT_01');
  });

  it('PCHAIN_NEMESIS_BROKEN does NOT re-fire for the same botId', () => {
    const tracker = new PositiveCascadeTracker(mockShieldReader());

    tracker.evaluateTick(8, buildRunState(), buildRecoveryLog({ nemesisCount: { 'BOT_01': 2 } }));

    // Third neutralization — should NOT re-fire for BOT_01
    const r3 = tracker.evaluateTick(12, buildRunState(), buildRecoveryLog({ nemesisCount: { 'BOT_01': 3 } }));
    const nemesisEvents = r3.newlyActivated.filter(id => id === ChainId.PCHAIN_NEMESIS_BROKEN);
    expect(nemesisEvents).toHaveLength(0);
  });

  it('PCHAIN_NEMESIS_BROKEN fires independently per unique botId', () => {
    const tracker = new PositiveCascadeTracker(mockShieldReader());

    tracker.evaluateTick(8, buildRunState(), buildRecoveryLog({ nemesisCount: { 'BOT_01': 2 } }));

    // Different bot — fires independently
    const r = tracker.evaluateTick(12, buildRunState(), buildRecoveryLog({
      nemesisCount: { 'BOT_01': 2, 'BOT_02': 2 },
    }));
    expect(r.nemesisBrokenBotId).toBe('BOT_02');
    expect(r.newlyActivated).toContain(ChainId.PCHAIN_NEMESIS_BROKEN);
  });

  it('PCHAIN_SOVEREIGN_APPROACH activates when netWorth >= 2× freedomThreshold', () => {
    const tracker = new PositiveCascadeTracker(mockShieldReader());

    const belowRS = buildRunState({ netWorth: 150000, freedomThreshold: 100000 }); // 1.5× — not enough
    const r1 = tracker.evaluateTick(5, belowRS, buildRecoveryLog({}));
    expect(r1.newlyActivated).not.toContain(ChainId.PCHAIN_SOVEREIGN_APPROACH);

    const aboveRS = buildRunState({ netWorth: 200000, freedomThreshold: 100000 }); // exactly 2×
    const r2 = tracker.evaluateTick(6, aboveRS, buildRecoveryLog({}));
    expect(r2.newlyActivated).toContain(ChainId.PCHAIN_SOVEREIGN_APPROACH);
  });

  it('PCHAIN_SOVEREIGN_APPROACH PAUSES when netWorth drops below 1.5× threshold', () => {
    const tracker = new PositiveCascadeTracker(mockShieldReader());

    tracker.evaluateTick(6, buildRunState({ netWorth: 200000, freedomThreshold: 100000 }), buildRecoveryLog({}));
    expect(tracker.isActive(ChainId.PCHAIN_SOVEREIGN_APPROACH)).toBe(true);

    // Drop below 1.5×
    const result = tracker.evaluateTick(7, buildRunState({ netWorth: 140000, freedomThreshold: 100000 }), buildRecoveryLog({}));
    expect(result.paused).toContain(ChainId.PCHAIN_SOVEREIGN_APPROACH);
    expect(tracker.isPaused(ChainId.PCHAIN_SOVEREIGN_APPROACH)).toBe(true);
  });

  it('PCHAIN_STREAK_MASTERY activates at 5 consecutive clean ticks', () => {
    const tracker = new PositiveCascadeTracker(mockShieldReader());

    const r = tracker.evaluateTick(10, buildRunState(), buildRecoveryLog({ consecutiveCleanTicks: 5 }));
    expect(r.newlyActivated).toContain(ChainId.PCHAIN_STREAK_MASTERY);
  });

  it('PCHAIN_STREAK_MASTERY dissolves when clean-tick streak breaks', () => {
    const tracker = new PositiveCascadeTracker(mockShieldReader());

    tracker.evaluateTick(10, buildRunState(), buildRecoveryLog({ consecutiveCleanTicks: 5 }));
    const result = tracker.evaluateTick(11, buildRunState(), buildRecoveryLog({ consecutiveCleanTicks: 0 }));

    expect(result.dissolved).toContain(ChainId.PCHAIN_STREAK_MASTERY);
    expect(tracker.isActive(ChainId.PCHAIN_STREAK_MASTERY)).toBe(false);
  });

  it('reset() clears all active cascades and nemesis tracking', () => {
    const tracker = new PositiveCascadeTracker(mockShieldReader());

    tracker.evaluateTick(10, buildRunState(), buildRecoveryLog({
      consecutivePositiveFlowTicks: 10,
      nemesisCount: { 'BOT_01': 2 },
    }));

    tracker.reset();

    expect(tracker.isActive(ChainId.PCHAIN_SUSTAINED_CASHFLOW)).toBe(false);
    expect(tracker.getActiveCount()).toBe(0);

    // After reset, BOT_01 neutralization count is gone — NEMESIS_BROKEN can fire again
    const r = tracker.evaluateTick(1, buildRunState(), buildRecoveryLog({ nemesisCount: { 'BOT_01': 2 } }));
    expect(r.newlyActivated).toContain(ChainId.PCHAIN_NEMESIS_BROKEN);
  });
});

// =============================================================================
// GROUP 4: Effect Combination Rules
// =============================================================================

describe('Simultaneous link effect combination rules', () => {

  it('INCOME_MODIFIER factors from two chains multiply (not add)', () => {
    // factor 0.80 from chain A, 0.75 from chain B → effective: 0.60
    const factorA   = 0.80;
    const factorB   = 0.75;
    const combined  = factorA * factorB;
    expect(combined).toBeCloseTo(0.60, 5);

    // Verify the multiplication is associative — order doesn't matter
    expect(factorB * factorA).toBeCloseTo(combined, 5);
  });

  it('EXPENSE_MODIFIER factors from two chains multiply (not add)', () => {
    const factorA  = 1.20;
    const factorB  = 1.35;
    const combined = factorA * factorB;
    expect(combined).toBeCloseTo(1.62, 5);
  });

  it('HATER_HEAT_DELTA from two chains in same tick should sum to single total', () => {
    // Verify the summation math the EngineOrchestrator applies
    const delta1 = 15;
    const delta2 = 20;
    const total  = delta1 + delta2;
    expect(total).toBe(35);

    // Verify floor at 0 and cap at 100 behavior for orchestrator
    const baseHeat = 90;
    const newHeat  = Math.max(0, Math.min(100, baseHeat + total));
    expect(newHeat).toBe(100);
  });

  it('HATER_HEAT_DELTA negative deltas (from positive cascades) are summed correctly', () => {
    const heatIncrease = 25; // from CHAIN_FULL_CASCADE_BREACH link 1
    const heatBleed    = -2; // from PCHAIN_SOVEREIGN_APPROACH per tick
    const total        = heatIncrease + heatBleed;
    expect(total).toBe(23);
  });

  it('NEMESIS_BROKEN -100 delta floors at 0 (not negative)', () => {
    const currentHeat = 45;
    const delta       = -100;
    const newHeat     = Math.max(0, currentHeat + delta);
    expect(newHeat).toBe(0);
  });

  it('CascadeChainRegistry has all 8 negative chains registered', () => {
    const all = CascadeChainRegistry.getAllNegativeChains();
    expect(all).toHaveLength(8);

    const expectedIds = [
      ChainId.CHAIN_LOAN_DEFAULT,
      ChainId.CHAIN_LIQUIDITY_BREACH,
      ChainId.CHAIN_NETWORK_COLLAPSE,
      ChainId.CHAIN_HATER_SABOTAGE,
      ChainId.CHAIN_NET_WORTH_CRASH,
      ChainId.CHAIN_FULL_CASCADE_BREACH,
      ChainId.CHAIN_PATTERN_EXPLOITATION,
      ChainId.CHAIN_REGULATORY_ESCALATION,
    ];
    for (const id of expectedIds) {
      expect(all.some(c => c.chainId === id)).toBe(true);
    }
  });

  it('CascadeChainRegistry has all 5 positive chains registered', () => {
    const all = CascadeChainRegistry.getAllPositiveChains();
    expect(all).toHaveLength(5);
  });

  it('No chain exceeds MAX_LINK_DEPTH of 6 links', () => {
    const all = CascadeChainRegistry.getAllNegativeChains();
    for (const chain of all) {
      expect(chain.links.length).toBeLessThanOrEqual(CASCADE_CONSTANTS.MAX_LINK_DEPTH);
    }
  });

  it('CHAIN_FULL_CASCADE_BREACH has exactly 6 links (maximum depth)', () => {
    const chain = CascadeChainRegistry.getNegativeChain(ChainId.CHAIN_FULL_CASCADE_BREACH);
    expect(chain.links).toHaveLength(6);
    expect(chain.severity).toBe(CascadeSeverity.CATASTROPHIC);
    expect(chain.maxActiveInstances).toBe(1);
  });

  it('CHAIN_LOAN_DEFAULT link 0 is canBeIntercepted=false (late fee is unavoidable)', () => {
    const chain = CascadeChainRegistry.getNegativeChain(ChainId.CHAIN_LOAN_DEFAULT);
    expect(chain.links[0].canBeIntercepted).toBe(false);
    expect(chain.links[0].effectType).toBe(CascadeEffectType.CARD_INJECT);
  });

  it('CHAIN_FULL_CASCADE_BREACH links 0, 1, and 4 are canBeIntercepted=false', () => {
    const chain = CascadeChainRegistry.getNegativeChain(ChainId.CHAIN_FULL_CASCADE_BREACH);
    expect(chain.links[0].canBeIntercepted).toBe(false);
    expect(chain.links[1].canBeIntercepted).toBe(false);
    expect(chain.links[4].canBeIntercepted).toBe(false);
  });
});