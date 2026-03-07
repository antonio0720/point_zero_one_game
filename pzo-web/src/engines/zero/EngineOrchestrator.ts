// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — ENGINE 0 ENGINE ORCHESTRATOR
// pzo-web/src/engines/zero/EngineOrchestrator.ts
//
// Repo-aligned orchestrator for the current engine contracts.
//
// Density6 LLC · Point Zero One · Engine 0 · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import { EventBus, sharedEventBus } from '../core/EventBus';
import { EngineRegistry } from './EngineRegistry';
import { RunStateSnapshot } from './RunStateSnapshot';
import {
  EngineId,
  EngineHealth,
  TickTier,
  PressureTier,
  ShieldLayerId as ZeroShieldLayerId,
  type IEngine,
  type CardReader,
  type EngineInitParams,
  type RunLifecycleState,
  type RunOutcome,
  type TickResult,
  type AttackEvent as TickAttackEvent,
  type DamageResult as TickDamageResult,
  type CascadeEffect as TickCascadeEffect,
  type RecoveryResult as TickRecoveryResult,
  type RunStateSnapshotFields,
  type DecisionRecordField,
} from './types';

import { TimeEngine } from '../time/TimeEngine';
import { PressureEngine } from '../pressure/PressureEngine';
import type { PressureReadInput } from '../pressure/types';
import { TensionEngine } from '../tension/TensionEngine';
import { ShieldEngine } from '../shield/ShieldEngine';
import {
  ShieldLayerId as ShieldLayerIdEngine,
  AttackType as ShieldAttackType,
  type AttackEvent as ShieldAttackEvent,
  type DamageResult as ShieldDamageResult,
} from '../shield/types';
import { BattleEngine } from '../battle/BattleEngine';
import {
  EntitlementTier,
  type BotAttackEvent,
  type RunStateForBattle,
} from '../battle/types';
import { CascadeEngine } from '../cascade/CascadeEngine';
import type { CascadeRunState } from '../cascade/types';
import { SovereigntyEngine } from '../sovereignty/SovereigntyEngine';

import { CardEngine } from '../cards/CardEngine';
import { CardEngineAdapter } from '../cards/CardEngineAdapter';
import type { DecisionRecord } from '../cards/types';

import { MechanicsRouter } from '../mechanics/MechanicsRouter';
import { initMechanicsRouter } from '../../data/mechanicsLoader';
import type { MechanicTickResult } from '../mechanics/types';

import { runStore } from '../../store/runStore';

// ─────────────────────────────────────────────────────────────────────────────
// START RUN PARAMS
// ─────────────────────────────────────────────────────────────────────────────

export interface StartRunParams {
  runId: string;
  userId: string;
  seed: string;
  seasonTickBudget: number;
  freedomThreshold: number;
  clientVersion: string;
  engineVersion: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// LIFECYCLE ADAPTER
// The repo's current EngineRegistry still requires IEngine, while the concrete
// engines no longer implement that interface directly.
// ─────────────────────────────────────────────────────────────────────────────

class LifecycleAdapter implements IEngine {
  public readonly engineId: EngineId;
  private readonly onInit: (params: EngineInitParams) => void;
  private readonly onReset: () => void;

  constructor(
    engineId: EngineId,
    onInit: (params: EngineInitParams) => void,
    onReset: () => void,
  ) {
    this.engineId = engineId;
    this.onInit = onInit;
    this.onReset = onReset;
  }

  public init(params: EngineInitParams): void {
    this.onInit(params);
  }

  public reset(): void {
    this.onReset();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ENGINE ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────

export class EngineOrchestrator {
  private readonly eventBus: EventBus;
  private readonly registry: EngineRegistry;

  private readonly timeEngine: TimeEngine;
  private readonly pressureEngine: PressureEngine;
  private readonly tensionEngine: TensionEngine;
  private readonly shieldEngine: ShieldEngine;
  private readonly battleEngine: BattleEngine;
  private readonly cascadeEngine: CascadeEngine;
  private readonly sovereigntyEngine: SovereigntyEngine;

  private readonly cardEngine: CardEngine;
  private readonly cardEngineAdapter: CardEngineAdapter;
  private readonly cardReader: CardReader;

  private readonly mechanicsRouter: MechanicsRouter;

  private pendingDecisions: DecisionRecord[] = [];

  private lifecycleState: RunLifecycleState = 'IDLE';
  private currentRunId: string | null = null;
  private currentUserId: string | null = null;
  private currentSeed: string | null = null;
  private freedomThreshold = 0;
  private startingNetWorth = 0;

  private tickErrorCount = 0;
  private static readonly MAX_TICK_ERRORS = 5;

  // rolling tick stats used by snapshot + cascade input
  private lastTickHaterAttempts = 0;
  private lastTickHaterBlocked = 0;
  private lastTickHaterDamaged = 0;
  private lastTickCascadesTriggered = 0;
  private lastTickCascadesBroken = 0;
  private consecutivePositiveFlowTicks = 0;
  private consecutiveCleanTicks = 0;
  private consecutiveFortifiedTicks = 0;

  constructor() {
    this.eventBus = sharedEventBus;
    this.registry = new EngineRegistry(this.eventBus);

    this.timeEngine = new TimeEngine(this.eventBus);
    this.pressureEngine = new PressureEngine(this.eventBus);
    this.tensionEngine = new TensionEngine(this.eventBus);
    this.shieldEngine = new ShieldEngine(this.eventBus);
    this.battleEngine = new BattleEngine(this.eventBus, this.shieldEngine);
    this.cascadeEngine = new CascadeEngine(this.eventBus, this.shieldEngine);
    this.sovereigntyEngine = new SovereigntyEngine(this.eventBus);

    this.cardEngine = new CardEngine(this.eventBus);
    this.cardEngineAdapter = new CardEngineAdapter(this.cardEngine, this.eventBus);

    this.cardReader = this.buildCardReaderBridge();
    this.mechanicsRouter = new MechanicsRouter(this.eventBus);

    this.timeEngine.setPressureReader(this.pressureEngine);

    this.registerLifecycleEngines();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTOR HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private registerLifecycleEngines(): void {
    const lifecycleEngines: IEngine[] = [
      new LifecycleAdapter(
        EngineId.TIME,
        (params) => {
          this.timeEngine.reset();
          this.timeEngine.setSeasonBudget(params.seasonTickBudget);
        },
        () => this.timeEngine.reset(),
      ),

      new LifecycleAdapter(
        EngineId.PRESSURE,
        () => {
          this.pressureEngine.reset();
        },
        () => this.pressureEngine.reset(),
      ),

      new LifecycleAdapter(
        EngineId.TENSION,
        () => {
          this.tensionEngine.reset();
        },
        () => this.tensionEngine.reset(),
      ),

      new LifecycleAdapter(
        EngineId.SHIELD,
        () => {
          this.shieldEngine.reset();
        },
        () => this.shieldEngine.reset(),
      ),

      new LifecycleAdapter(
        EngineId.BATTLE,
        () => {
          this.battleEngine.reset();
        },
        () => this.battleEngine.reset(),
      ),

      new LifecycleAdapter(
        EngineId.CASCADE,
        () => {
          this.cascadeEngine.reset();
        },
        () => this.cascadeEngine.reset(),
      ),

      new LifecycleAdapter(
        EngineId.SOVEREIGNTY,
        (params) => {
          this.sovereigntyEngine.reset();
          this.sovereigntyEngine.initRun({
            runId: params.runId,
            userId: params.userId,
            seed: params.seed,
            seasonTickBudget: params.seasonTickBudget,
            clientVersion: params.clientVersion,
            engineVersion: params.engineVersion,
          });
        },
        () => this.sovereigntyEngine.reset(),
      ),

      this.cardEngineAdapter,
    ];

    for (const engine of lifecycleEngines) {
      this.registry.register(engine);
    }
  }

  private buildCardReaderBridge(): CardReader {
    const inner = this.cardEngine.getReader() as any;

    return {
      getHandSize: () => inner.getHandSize(),
      getForcedCardCount: () => inner.getForcedCardCount(),
      getActiveThreatCardCount: () => inner.getActiveThreatCardCount(),
      getDecisionWindowsActive: () => inner.getDecisionWindowsActive(),
      getHoldsRemaining: () => inner.getHoldsRemaining(),
      getMissedOpportunityStreak: () => inner.getMissedOpportunityStreak(),
      getLastPlayedCardId: () =>
        inner.getLastPlayedCardId?.() ??
        inner.getLastPlayedCard?.()?.definition?.cardId ??
        null,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RUN LIFECYCLE — START
  // ═══════════════════════════════════════════════════════════════════════════

  public startRun(params: StartRunParams): void {
    if (this.lifecycleState !== 'IDLE') {
      throw new Error(
        `[Orchestrator] startRun() called in state '${this.lifecycleState}'. Call reset() first.`,
      );
    }

    this.lifecycleState = 'STARTING';
    this.currentRunId = params.runId;
    this.currentUserId = params.userId;
    this.currentSeed = params.seed;
    this.freedomThreshold = params.freedomThreshold;
    this.startingNetWorth = runStore.getState().netWorth;
    this.tickErrorCount = 0;
    this.pendingDecisions = [];

    this.lastTickHaterAttempts = 0;
    this.lastTickHaterBlocked = 0;
    this.lastTickHaterDamaged = 0;
    this.lastTickCascadesTriggered = 0;
    this.lastTickCascadesBroken = 0;
    this.consecutivePositiveFlowTicks = 0;
    this.consecutiveCleanTicks = 0;
    this.consecutiveFortifiedTicks = 0;

    this.eventBus.clearQueue();

    const initParams: EngineInitParams = {
      runId: params.runId,
      userId: params.userId,
      seed: params.seed,
      seasonTickBudget: params.seasonTickBudget,
      freedomThreshold: params.freedomThreshold,
      clientVersion: params.clientVersion,
      engineVersion: params.engineVersion,
      cardReader: this.cardReader,
    };

    this.registry.initializeAll(initParams);

    if (!this.registry.allEnginesReady()) {
      const missing = this.registry.getMissingEngines();
      this.lifecycleState = 'IDLE';
      throw new Error(
        `[Orchestrator] Cannot start run — engines not ready: [${missing.join(', ')}].`,
      );
    }

    try {
      this.cardEngineAdapter.startRun();
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.registry.setHealth(EngineId.CARD, EngineHealth.ERROR, error);
      this.lifecycleState = 'IDLE';
      throw new Error(`[Orchestrator] CardEngine.startRun() failed: ${error}`);
    }

    initMechanicsRouter(params.runId, (runId) => this.mechanicsRouter.init(runId));

    this.lifecycleState = 'ACTIVE';

    this.eventBus.emit('RUN_STARTED', {
      runId: params.runId,
      userId: params.userId,
      seed: params.seed,
      tickBudget: params.seasonTickBudget,
    });
    this.eventBus.flush();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RUN LIFECYCLE — END
  // ═══════════════════════════════════════════════════════════════════════════

  public async endRun(outcome: RunOutcome): Promise<void> {
    if (this.lifecycleState !== 'ACTIVE' && this.lifecycleState !== 'TICK_LOCKED') {
      return;
    }

    this.lifecycleState = 'ENDING';

    try {
      this.cardEngineAdapter.endRun();
    } catch (err) {
      console.error('[Orchestrator] CardEngine.endRun() threw (non-fatal):', err);
    }

    const store = runStore.getState();

    this.eventBus.emit('RUN_ENDED', {
      runId: this.currentRunId!,
      outcome,
      finalNetWorth: store.netWorth,
    });

    let identity: any = null;
    try {
      identity = await this.sovereigntyEngine.completeRun({
        outcome,
        finalNetWorth: store.netWorth,
      });
    } catch (err) {
      console.error('[Orchestrator] Sovereignty pipeline error:', err);
    }

    await this.writeRunRecord(identity, outcome);

    this.eventBus.flush();
    this.lifecycleState = 'ENDED';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RUN LIFECYCLE — RESET
  // ═══════════════════════════════════════════════════════════════════════════

  public reset(): void {
    this.registry.resetAll();

    // preserve engine/internal listeners wired at construction
    this.eventBus.clearQueue();

    this.mechanicsRouter.reset();

    this.currentRunId = null;
    this.currentUserId = null;
    this.currentSeed = null;
    this.freedomThreshold = 0;
    this.startingNetWorth = 0;
    this.tickErrorCount = 0;
    this.pendingDecisions = [];

    this.lastTickHaterAttempts = 0;
    this.lastTickHaterBlocked = 0;
    this.lastTickHaterDamaged = 0;
    this.lastTickCascadesTriggered = 0;
    this.lastTickCascadesBroken = 0;
    this.consecutivePositiveFlowTicks = 0;
    this.consecutiveCleanTicks = 0;
    this.consecutiveFortifiedTicks = 0;

    this.lifecycleState = 'IDLE';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXECUTE TICK
  // ═══════════════════════════════════════════════════════════════════════════

  public async executeTick(): Promise<TickResult | null> {
    if (this.lifecycleState !== 'ACTIVE') return null;

    const tickStart = performance.now();
    this.lifecycleState = 'TICK_LOCKED';

    const snapshot = this.buildRunStateSnapshot();
    this.eventBus.setTickContext(snapshot.tickIndex);

    let pressureScore = snapshot.pressureScore;
    let postActionPressure = snapshot.pressureScore;
    let attacksFired: TickAttackEvent[] = [];
    let damageResults: TickDamageResult[] = [];
    let cascadeEffects: TickCascadeEffect[] = [];
    let recoveryResults: TickRecoveryResult[] = [];
    let tickOutcome: RunOutcome | null = null;
    let decisionsThisTick: DecisionRecord[] = [];
    let mechanicsResult: MechanicTickResult | null = null;

    // STEP 1 — Time
    try {
      this.timeEngine.advanceTick({
        tick: snapshot.tickIndex,
        pressureScore: snapshot.pressureScore,
        tickTier: String(snapshot.currentTickTier),
      });
    } catch (err) {
      this.handleStepError(1, EngineId.TIME, err);
    }

    // STEP 1.5 — Cards
    try {
      decisionsThisTick = this.cardEngineAdapter.tick(this.timeEngine.getTickIndex());
      this.pendingDecisions = decisionsThisTick;
    } catch (err) {
      this.handleStepError(1.5, EngineId.CARD, err);
      decisionsThisTick = [];
      this.pendingDecisions = [];
    }

    // STEP 2 — Pressure
    try {
      pressureScore = this.pressureEngine.computeScore(this.buildPressureReadInput());
      postActionPressure = pressureScore;
    } catch (err) {
      this.handleStepError(2, EngineId.PRESSURE, err);
    }

    // STEP 3 — Tension
    try {
      const isNearDeath =
        snapshot.netWorth <= Math.max(1, this.freedomThreshold * 0.25);

      this.tensionEngine.computeTension(
        this.pressureEngine.getCurrentTier(),
        isNearDeath,
        this.timeEngine.getTickIndex(),
        false,
      );
    } catch (err) {
      this.handleStepError(3, EngineId.TENSION, err);
    }

    // STEP 4 — Battle
    let pendingBotAttacks: BotAttackEvent[] = [];
    try {
      this.battleEngine.tickBattle(
        this.buildBattleRunState(snapshot),
        this.timeEngine.getTickIndex(),
      );
      pendingBotAttacks = this.battleEngine.getPendingAttacks();
      this.lastTickHaterAttempts = pendingBotAttacks.length;
    } catch (err) {
      this.handleStepError(4, EngineId.BATTLE, err);
      pendingBotAttacks = [];
      this.lastTickHaterAttempts = 0;
    }

    // STEP 5 — Dispatch Battle attacks into Shield
    try {
      const shieldAttacks = this.expandBotAttacksToShieldAttacks(pendingBotAttacks);
      attacksFired = this.mapBotAttacksToTickAttackEvents(pendingBotAttacks);

      const shieldDamageResults = shieldAttacks.map((attack) =>
        this.shieldEngine.applyAttack(attack),
      );

      damageResults = shieldDamageResults.map((result) =>
        this.mapShieldDamageToTickDamage(result),
      );

      this.lastTickHaterBlocked = shieldDamageResults.filter(
        (r) => r.effectiveDamage <= 0,
      ).length;

      this.lastTickHaterDamaged = shieldDamageResults.filter(
        (r) => r.effectiveDamage > 0,
      ).length;

      this.battleEngine.clearPendingAttacks();
    } catch (err) {
      this.handleStepError(5, EngineId.SHIELD, err);
      attacksFired = [];
      damageResults = [];
      this.lastTickHaterBlocked = 0;
      this.lastTickHaterDamaged = 0;
    }

    // STEP 6 — Shield tick
    try {
      this.shieldEngine.tickShields(this.timeEngine.getTickIndex());
    } catch (err) {
      this.handleStepError(6, EngineId.SHIELD, err);
    }

    // STEP 7 — Cascade
    try {
      this.cascadeEngine.tickCascade(
        this.buildCascadeRunState(snapshot),
        this.timeEngine.getTickIndex(),
      );

      const heatDeltas = this.cascadeEngine.getPendingHeatDeltas();
      const shieldCracks = this.cascadeEngine.getPendingShieldCracks();

      this.lastTickCascadesTriggered = heatDeltas.length + shieldCracks.length;
      this.lastTickCascadesBroken = 0;

      cascadeEffects = [
        ...heatDeltas.map((d, index) => ({
          chainId: d.sourceChainId,
          instanceId: `${d.sourceChainId}:${this.timeEngine.getTickIndex()}:${index}`,
          linkIndex: index,
          effectType: 'HATER_HEAT_DELTA',
          payload: { delta: d.delta, sourceChainId: d.sourceChainId },
          tickFired: d.tickNumber,
        })),
        ...shieldCracks.map((c, index) => ({
          chainId: c.sourceChainId,
          instanceId: `${c.sourceChainId}:${this.timeEngine.getTickIndex()}:crack:${index}`,
          linkIndex: index,
          effectType: 'SHIELD_CRACK',
          payload: {
            targetLayerId: String(c.layerId),
            damageAmount: c.damageAmount,
            sourceChainId: c.sourceChainId,
          },
          tickFired: c.tickNumber,
        })),
      ];

      // synthesize shield attacks for queued cracks
      const crackDamage = shieldCracks.map((crack, index) =>
        this.shieldEngine.applyAttack({
          attackId: `cascade:${crack.sourceChainId}:${crack.tickNumber}:${index}`,
          attackType: ShieldAttackType.HATER_INJECTION,
          rawPower: crack.damageAmount,
          sourceHaterId: String(crack.sourceChainId),
          isCritical: true,
          tickNumber: crack.tickNumber,
        }),
      );

      damageResults.push(
        ...crackDamage.map((result) => this.mapShieldDamageToTickDamage(result)),
      );

      this.cascadeEngine.clearPending();
    } catch (err) {
      this.handleStepError(7, EngineId.CASCADE, err);
      cascadeEffects = [];
      this.lastTickCascadesTriggered = 0;
      this.lastTickCascadesBroken = 0;
    }

    // STEP 8 — Time tier update
    try {
      this.timeEngine.setTierFromPressure(postActionPressure);
    } catch (err) {
      this.handleStepError(8, EngineId.TIME, err);
    }

    // STEP 9 — Sovereignty snapshot
    try {
      this.sovereigntyEngine.snapshotTick(snapshot);
    } catch (err) {
      this.handleStepError(9, EngineId.SOVEREIGNTY, err);
    }

    // STEP 9.5 — Mechanics
    try {
      mechanicsResult = await this.mechanicsRouter.tickRuntime(snapshot);
      void mechanicsResult;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`[Orchestrator] MechanicsRouter fatal error: ${error}`);
      this.eventBus.emit('TICK_STEP_ERROR', {
        step: 9.5,
        engineId: 'mechanics',
        error,
      });
    }

    // WIN / LOSS
    const postStepSnapshot = this.buildRunStateSnapshot();

    this.consecutivePositiveFlowTicks =
      postStepSnapshot.cashflow > 0
        ? this.consecutivePositiveFlowTicks + 1
        : 0;

    this.consecutiveCleanTicks =
      this.lastTickHaterDamaged === 0 && !postStepSnapshot.hasAnyBreachedLayer
        ? this.consecutiveCleanTicks + 1
        : 0;

    this.consecutiveFortifiedTicks =
      this.shieldEngine.isFortified()
        ? this.consecutiveFortifiedTicks + 1
        : 0;

    if (postStepSnapshot.hasCrossedFreedomThreshold) tickOutcome = 'FREEDOM';
    else if (postStepSnapshot.isBankrupt) tickOutcome = 'BANKRUPT';
    else if (postStepSnapshot.isTimedOut) tickOutcome = 'TIMEOUT';

    const tickDurationMs = performance.now() - tickStart;

    this.eventBus.emit('TICK_COMPLETE', {
      tickIndex: snapshot.tickIndex,
      tickDurationMs,
      outcome: tickOutcome,
    });
    this.eventBus.flush();

    if (tickOutcome) {
      this.lifecycleState = 'ACTIVE';
      await this.endRun(tickOutcome);
    } else {
      this.lifecycleState = 'ACTIVE';
      this.tickErrorCount = 0;
    }

    const decisionFields = this.projectDecisionRecords(decisionsThisTick);

    return {
      tickIndex: snapshot.tickIndex,
      pressureScore,
      postActionPressure,
      attacksFired,
      damageResults,
      cascadeEffects,
      recoveryResults,
      decisionsThisTick: decisionFields,
      runOutcome: tickOutcome,
      tickDurationMs,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SNAPSHOT
  // ═══════════════════════════════════════════════════════════════════════════

  private buildRunStateSnapshot(): RunStateSnapshot {
    const store = runStore.getState();
    const shieldL1 = this.shieldEngine.getLayerState(ShieldLayerIdEngine.LIQUIDITY_BUFFER);
    const shieldL2 = this.shieldEngine.getLayerState(ShieldLayerIdEngine.CREDIT_LINE);
    const shieldL3 = this.shieldEngine.getLayerState(ShieldLayerIdEngine.ASSET_FLOOR);
    const shieldL4 = this.shieldEngine.getLayerState(ShieldLayerIdEngine.NETWORK_CORE);
    const cascadeSnapshot = this.cascadeEngine.getSnapshot();
    const decisionsThisTick = this.projectDecisionRecords(this.pendingDecisions);

    const fields: RunStateSnapshotFields = {
      runId: this.currentRunId!,
      userId: this.currentUserId!,
      seed: this.currentSeed!,
      tickIndex: this.timeEngine.getTickIndex(),
      seasonTickBudget: this.timeEngine.getSeasonBudget(),
      ticksRemaining: this.timeEngine.getTicksRemaining(),
      freedomThreshold: this.freedomThreshold,

      netWorth: store.netWorth,
      cashBalance: store.cashBalance,
      monthlyIncome: store.monthlyIncome,
      monthlyExpenses: store.monthlyExpenses,
      cashflow: store.monthlyIncome - store.monthlyExpenses,

      currentTickTier: this.timeEngine.getCurrentTier() as unknown as TickTier,
      currentTickDurationMs: this.timeEngine.getTickDurationMs(),
      activeDecisionWindows: this.cardReader.getDecisionWindowsActive(),
      holdsRemaining: this.cardReader.getHoldsRemaining(),

      pressureScore: this.pressureEngine.getCurrentScore(),
      pressureTier: this.pressureEngine.getCurrentTier() as unknown as PressureTier,
      ticksWithoutIncomeGrowth: Math.max(0, this.pressureEngine.getSnapshot().tickNumber - 1),

      tensionScore: this.tensionEngine.getCurrentScore(),
      anticipationQueueDepth: this.tensionEngine.getQueueLength(),
      threatVisibilityState: String(this.tensionEngine.getVisibilityState()),

      shieldAvgIntegrityPct: this.shieldEngine.getOverallIntegrityPct(),
      shieldL1Integrity: shieldL1.currentIntegrity,
      shieldL2Integrity: shieldL2.currentIntegrity,
      shieldL3Integrity: shieldL3.currentIntegrity,
      shieldL4Integrity: shieldL4.currentIntegrity,
      shieldL1Max: 100,
      shieldL2Max: 80,
      shieldL3Max: 60,
      shieldL4Max: 40,

      haterHeat: store.haterHeat,
      activeBotCount: this.battleEngine.getActiveBotCount(),
      haterAttemptsThisTick: this.lastTickHaterAttempts,
      haterBlockedThisTick: this.lastTickHaterBlocked,
      haterDamagedThisTick: this.lastTickHaterDamaged,
      activeThreatCardCount: this.cardReader.getActiveThreatCardCount(),

      activeCascadeChains:
        cascadeSnapshot.activeNegativeChains.length +
        cascadeSnapshot.activePositiveCascades.length,
      cascadesTriggeredThisTick: this.lastTickCascadesTriggered,
      cascadesBrokenThisTick: this.lastTickCascadesBroken,

      decisionsThisTick,
    };

    return new RunStateSnapshot(fields);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INPUT BUILDERS
  // ═══════════════════════════════════════════════════════════════════════════

  private buildPressureReadInput(): PressureReadInput {
    const store = runStore.getState();
    const cascadeSnapshot = this.cascadeEngine.getSnapshot();

    return {
      monthlyIncome: store.monthlyIncome,
      monthlyExpenses: store.monthlyExpenses,
      cashBalance: store.cashBalance,
      haterHeat: store.haterHeat,
      activeThreatCardCount: this.cardReader.getActiveThreatCardCount(),
      shieldIntegrityPct: this.shieldEngine.getOverallIntegrityPct(),
      ticksWithoutIncomeGrowth: Math.max(0, this.pressureEngine.getSnapshot().tickNumber - 1),
      activeCascadeChainCount: cascadeSnapshot.activeNegativeChains.length,
      netWorth: store.netWorth,
      freedomThreshold: this.freedomThreshold,
    };
  }

  private buildBattleRunState(snapshot: RunStateSnapshot): RunStateForBattle {
    return {
      haterHeat: snapshot.haterHeat,
      netWorth: snapshot.netWorth,
      startingNetWorth: this.startingNetWorth,
      monthlyIncome: snapshot.monthlyIncome,
      activeIncomeStreamCount: snapshot.monthlyIncome > 0 ? 1 : 0,
      investmentCardsInHand: 0,
      cardPatternEntropy: 0,
      sameCardTypeConsecutiveTicks: 0,
      consecutivePositiveGrowthTicks: this.consecutivePositiveFlowTicks,
      freedomThreshold: this.freedomThreshold,
      entitlementTier: EntitlementTier.FREE,
    };
  }

  private buildCascadeRunState(snapshot: RunStateSnapshot): CascadeRunState {
    return {
      netWorth: snapshot.netWorth,
      freedomThreshold: this.freedomThreshold,
      monthlyIncome: snapshot.monthlyIncome,
      monthlyExpenses: snapshot.monthlyExpenses,
      consecutivePositiveFlowTicks: this.consecutivePositiveFlowTicks,
      consecutiveCleanTicks: this.consecutiveCleanTicks,
      consecutiveFortifiedTicks: this.consecutiveFortifiedTicks,
      hasActiveAllianceMember: false,
      haterHeat: snapshot.haterHeat,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAPPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private expandBotAttacksToShieldAttacks(
    pending: BotAttackEvent[],
  ): ShieldAttackEvent[] {
    const expanded: ShieldAttackEvent[] = [];

    for (const attack of pending) {
      expanded.push({
        attackId: attack.attackId,
        attackType: attack.attackType as unknown as ShieldAttackType,
        rawPower: attack.rawPower,
        sourceHaterId: attack.sourceHaterId,
        isCritical: attack.isCritical,
        tickNumber: attack.tickNumber,
      });

      if (attack.secondaryAttackType && attack.secondaryRawPower > 0) {
        expanded.push({
          attackId: `${attack.attackId}:secondary`,
          attackType: attack.secondaryAttackType as unknown as ShieldAttackType,
          rawPower: attack.secondaryRawPower,
          sourceHaterId: attack.sourceHaterId,
          isCritical: attack.isCritical,
          tickNumber: attack.tickNumber,
        });
      }
    }

    return expanded;
  }

  private mapBotAttacksToTickAttackEvents(
    pending: BotAttackEvent[],
  ): TickAttackEvent[] {
    const out: TickAttackEvent[] = [];

    for (const attack of pending) {
      out.push({
        attackId: attack.attackId,
        botId: attack.botId as TickAttackEvent['botId'],
        attackType: attack.attackType as TickAttackEvent['attackType'],
        damageAmount: attack.rawPower,
        targetLayerId: this.mapAttackTypeToTickLayer(attack.attackType),
        timestamp: Date.now(),
      });

      if (attack.secondaryAttackType && attack.secondaryRawPower > 0) {
        out.push({
          attackId: `${attack.attackId}:secondary`,
          botId: attack.botId as TickAttackEvent['botId'],
          attackType: attack.secondaryAttackType as TickAttackEvent['attackType'],
          damageAmount: attack.secondaryRawPower,
          targetLayerId: this.mapAttackTypeToTickLayer(attack.secondaryAttackType),
          timestamp: Date.now(),
        });
      }
    }

    return out;
  }

  private mapShieldDamageToTickDamage(
    result: ShieldDamageResult,
  ): TickDamageResult {
    return {
      attackId: result.attackId,
      layerId: this.mapEngineLayerToTickLayer(result.targetLayerId),
      damageApplied: result.effectiveDamage,
      integrityAfter: result.postHitIntegrity,
      breachOccurred: result.breachOccurred,
      cascadeTriggered: result.cascadeTriggered,
      cascadeEventId: undefined,
    };
  }

  private mapAttackTypeToTickLayer(
    attackType: string,
  ): ZeroShieldLayerId {
    switch (attackType) {
      case 'DEBT_ATTACK':
        return ZeroShieldLayerId.CREDIT_LINE;
      case 'ASSET_STRIP':
      case 'OPPORTUNITY_KILL':
        return ZeroShieldLayerId.ASSET_FLOOR;
      case 'REPUTATION_ATTACK':
      case 'REGULATORY_ATTACK':
        return ZeroShieldLayerId.NETWORK_CORE;
      case 'FINANCIAL_SABOTAGE':
      case 'EXPENSE_INJECTION':
      case 'HATER_INJECTION':
      default:
        return ZeroShieldLayerId.LIQUIDITY_BUFFER;
    }
  }

  private mapEngineLayerToTickLayer(
    layerId: ShieldLayerIdEngine,
  ): ZeroShieldLayerId {
    switch (layerId) {
      case ShieldLayerIdEngine.CREDIT_LINE:
        return ZeroShieldLayerId.CREDIT_LINE;
      case ShieldLayerIdEngine.ASSET_FLOOR:
        return ZeroShieldLayerId.ASSET_FLOOR;
      case ShieldLayerIdEngine.NETWORK_CORE:
        return ZeroShieldLayerId.NETWORK_CORE;
      case ShieldLayerIdEngine.LIQUIDITY_BUFFER:
      default:
        return ZeroShieldLayerId.LIQUIDITY_BUFFER;
    }
  }

  private projectDecisionRecords(records: DecisionRecord[]): DecisionRecordField[] {
    if (records.length === 0) return [];

    return records.map((r) => ({
      cardId: r.cardId,
      decisionWindowMs: r.decisionWindowMs,
      resolvedInMs: r.resolvedInMs,
      wasAutoResolved: r.wasAutoResolved,
      wasOptimalChoice: r.wasOptimalChoice,
      speedScore: r.speedScore,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════════════════

  private handleStepError(step: number, engineId: EngineId, err: unknown): void {
    const error = err instanceof Error ? err.message : String(err);

    console.error(`[Orchestrator] Step ${step} (${engineId}) error: ${error}`);

    this.eventBus.emit('TICK_STEP_ERROR', { step, engineId, error });

    try {
      this.registry.setHealth(engineId, EngineHealth.ERROR, error);
    } catch {
      // no-op
    }

    this.tickErrorCount += 1;

    if (this.tickErrorCount >= EngineOrchestrator.MAX_TICK_ERRORS) {
      console.error(
        `[Orchestrator] MAX_TICK_ERRORS (${EngineOrchestrator.MAX_TICK_ERRORS}) reached — forcing ABANDONED.`,
      );
      this.endRun('ABANDONED').catch((e) =>
        console.error('[Orchestrator] endRun(ABANDONED) threw:', e),
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // READ ACCESS
  // ═══════════════════════════════════════════════════════════════════════════

  public getLifecycleState(): RunLifecycleState {
    return this.lifecycleState;
  }

  public isRunActive(): boolean {
    return this.lifecycleState === 'ACTIVE';
  }

  public getHealthReport(): Record<EngineId, EngineHealth> {
    return this.registry.getHealthReport();
  }

  public getCurrentRunId(): string | null {
    return this.currentRunId;
  }

  public getCardReader(): CardReader {
    return this.cardReader;
  }

  public queueCardPlay(request: Parameters<CardEngineAdapter['queuePlay']>[0]): void {
    this.cardEngineAdapter.queuePlay(request);
  }

  public holdCard(instanceId: string): boolean {
    return this.cardEngineAdapter.holdCard(instanceId);
  }

  public releaseHold(): unknown {
    return this.cardEngineAdapter.releaseHold();
  }

  public getHandSnapshot(): ReturnType<CardEngineAdapter['getHandSnapshot']> {
    return this.cardEngineAdapter.getHandSnapshot();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DB WRITE STUB
  // ═══════════════════════════════════════════════════════════════════════════

  private async writeRunRecord(identity: any, outcome: RunOutcome): Promise<void> {
    void identity;
    void outcome;
  }
}

export const orchestrator = new EngineOrchestrator();