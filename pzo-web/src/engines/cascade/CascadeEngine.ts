/**
 * FILE: pzo-web/src/engines/cascade/CascadeEngine.ts
 *
 * Public orchestrator for Engine 6. Called at Step 7 of the tick sequence.
 * Constructor wires all EventBus listeners for trigger detection and recovery logging.
 *
 * Public API:
 *   tickCascade(runState, tick)   → evaluates positive cascades, fires due links, emits all events
 *   getSnapshot()                 → current CascadeSnapshot (read by EngineOrchestrator)
 *   getPendingHeatDeltas()        → batched hater_heat writes for EngineOrchestrator to apply
 *   getPendingShieldCracks()      → shield damage to apply via shieldEngine.applyDirectDamage()
 *   clearPending()                → called by EngineOrchestrator after consuming both pending arrays
 *   isPositiveCascadeActive(id)   → query for EngineOrchestrator cascade signal injection
 *   reset()                       → full state clear for RUN_STARTED
 *
 * Dependency rules:
 *   ✦ Imports all 5 sibling files + types.ts + ShieldReader interface + EventBus interface
 *   ✦ Must NEVER import: ShieldEngine class, BattleEngine class, TensionEngine, PressureEngine
 *   ✦ Never writes to DB directly — queues hater_heat via pendingHeatDeltas
 *   ✦ Never calls shieldEngine.applyDamage() — queues via pendingShieldCracks
 *   ✦ All EventBus.emit() calls go through CascadeUXBridge exclusively
 *
 * Density6 LLC · Point Zero One · Engine 6 of 7 · Confidential
 */
import {
  ChainId,
  CascadeEffectType,
  CascadeRunState,
  CascadeSnapshot,
  RecoveryActionLog,
  CascadeSeverity,
  CascadeDirection,
  CASCADE_CONSTANTS,
} from './types';
import { CascadeChainRegistry }     from './CascadeChainRegistry';
import { CascadeQueueManager }       from './CascadeQueueManager';
import { PositiveCascadeTracker }    from './PositiveCascadeTracker';
import { CascadeUXBridge }           from './CascadeUXBridge';
import type { ShieldReader }         from '../shield/types';
import { ShieldLayerId }             from '../shield/types';
import type { EventBus }             from '../core/EventBus';
import { BotId }                     from '../battle/types';

// ── Pending Output Types ───────────────────────────────────────────────────────

export interface ShieldCrackPending {
  layerId:      ShieldLayerId;
  damageAmount: number;
  sourceChainId:ChainId;
  tickNumber:   number;
}

export interface HeatDeltaPending {
  delta:         number;
  sourceChainId: ChainId;
  tickNumber:    number;
}

// ── CascadeEngine ─────────────────────────────────────────────────────────────

export class CascadeEngine {
  private readonly queueManager:     CascadeQueueManager;
  private readonly positiveTracker:  PositiveCascadeTracker;
  private readonly uxBridge:         CascadeUXBridge;

  private recoveryLog:          RecoveryActionLog;
  private pendingHeatDeltas:    HeatDeltaPending[]   = [];
  private pendingShieldCracks:  ShieldCrackPending[] = [];

  private totalLinksDefeated:   number = 0;
  private totalLinksScheduled:  number = 0;
  private lastSnapshot:         CascadeSnapshot | null = null;
  private tickNumber:           number = 0;

  constructor(
    private readonly eventBus:     EventBus,
    private readonly shieldReader: ShieldReader
  ) {
    this.queueManager    = new CascadeQueueManager(shieldReader);
    this.positiveTracker = new PositiveCascadeTracker(shieldReader);
    this.uxBridge        = new CascadeUXBridge(eventBus);
    this.recoveryLog     = this.buildEmptyLog();
    this.wireEventListeners();
  }

  // ── EventBus Wiring ────────────────────────────────────────────────────────

  private wireEventListeners(): void {

    // ── Negative chain triggers ──────────────────────────────────────────────

    // CHAIN_FULL_CASCADE_BREACH — L4 total collapse
    this.eventBus.on('CASCADE_TRIGGERED', (e: any) => {
      this.activateChain(ChainId.CHAIN_FULL_CASCADE_BREACH, 'CASCADE_TRIGGERED', e.tickNumber ?? this.tickNumber);
    });

    // CHAIN_LIQUIDITY_BREACH (L1) and CHAIN_NETWORK_COLLAPSE (L4 without full cascade)
    this.eventBus.on('SHIELD_LAYER_BREACHED', (e: any) => {
      const tick = e.tickNumber ?? this.tickNumber;
      if (e.layerId === ShieldLayerId.LIQUIDITY_BUFFER) {
        this.activateChain(ChainId.CHAIN_LIQUIDITY_BREACH, 'SHIELD_LAYER_BREACHED', tick);
      }
      if (e.layerId === ShieldLayerId.NETWORK_CORE && !e.cascadeTriggered) {
        this.activateChain(ChainId.CHAIN_NETWORK_COLLAPSE, 'SHIELD_LAYER_BREACHED', tick);
      }
    });

    // CHAIN_HATER_SABOTAGE — bot attack caused a shield breach
    this.eventBus.on('BOT_ATTACK_FIRED', (e: any) => {
      if (e.attackEvent?.breachOccurred === true || e.breachOccurred === true) {
        this.activateChain(ChainId.CHAIN_HATER_SABOTAGE, 'BOT_ATTACK_FIRED', e.tickNumber ?? this.tickNumber);
      }
    });

    // CHAIN_PATTERN_EXPLOITATION — BOT_03 transitions to ATTACKING
    this.eventBus.on('BOT_STATE_CHANGED', (e: any) => {
      if (
        (e.botId === BotId.BOT_03_MANIPULATOR || e.botId === 'BOT_03') &&
        e.to === 'ATTACKING'
      ) {
        this.activateChain(ChainId.CHAIN_PATTERN_EXPLOITATION, 'BOT_STATE_CHANGED', e.tickNumber ?? this.tickNumber);
      }
    });

    // CHAIN_REGULATORY_ESCALATION — REGULATORY_HOLD card expired unmitigated
    this.eventBus.on('INJECTED_CARD_EXPIRED', (e: any) => {
      if (e.injectionType === 'REGULATORY_HOLD') {
        this.activateChain(ChainId.CHAIN_REGULATORY_ESCALATION, 'INJECTED_CARD_EXPIRED', e.tickNumber ?? this.tickNumber);
      }
    });

    // CHAIN_NET_WORTH_CRASH — >30% net worth lost in a single tick
    this.eventBus.on('NET_WORTH_DELTA', (e: any) => {
      if (typeof e.deltaPct === 'number' && e.deltaPct < -0.30) {
        this.activateChain(ChainId.CHAIN_NET_WORTH_CRASH, 'NET_WORTH_DELTA', e.tickNumber ?? this.tickNumber);
      }
    });

    // CHAIN_LOAN_DEFAULT — debt card expired unmitigated
    this.eventBus.on('MISSED_LOAN_PAYMENT', (e: any) => {
      this.activateChain(ChainId.CHAIN_LOAN_DEFAULT, 'MISSED_LOAN_PAYMENT', e.tickNumber ?? this.tickNumber);
    });

    // ── Recovery log updates ─────────────────────────────────────────────────

    // Log card plays for CARD_PLAYED_TYPE recovery condition scanning
    this.eventBus.on('CARD_PLAYED', (e: any) => {
      const tick = e.tickNumber ?? this.tickNumber;
      const existing = this.recoveryLog.cardTypesPlayedSinceMap.get(tick) ?? [];
      existing.push(e.cardType);
      this.recoveryLog.cardTypesPlayedSinceMap.set(tick, existing);
    });

    // Log budget actions for BUDGET_ACTION_USED recovery condition scanning
    this.eventBus.on('BUDGET_ACTION_EXECUTED', (e: any) => {
      const tick = e.tickNumber ?? this.tickNumber;
      const actionType = e.action?.actionType ?? e.actionType;
      if (!actionType) return;
      const existing = this.recoveryLog.budgetActionsUsedSinceMap.get(tick) ?? [];
      existing.push(actionType);
      this.recoveryLog.budgetActionsUsedSinceMap.set(tick, existing);
    });

    // Log bot neutralizations for NEMESIS_BROKEN tracking
    this.eventBus.on('BOT_NEUTRALIZED', (e: any) => {
      const botId   = e.botId;
      const current = this.recoveryLog.nemesisNeutralizationCount.get(botId) ?? 0;
      this.recoveryLog.nemesisNeutralizationCount.set(botId, current + 1);
    });

    // Apply MOMENTUM_LOCK effect from fired links to PositiveCascadeTracker
    this.eventBus.on('CASCADE_MOMENTUM_LOCK', (e: any) => {
      this.positiveTracker.applyMomentumLock(
        e.targetChainId,
        e.tickNumber ?? this.tickNumber,
        e.durationTicks
      );
    });
  }

  // ── Main Tick (Step 7) ─────────────────────────────────────────────────────

  /**
   * Core tick method. Called by EngineOrchestrator at Step 7.
   * Positive cascade evaluation ALWAYS precedes negative link execution.
   */
  public tickCascade(runState: CascadeRunState, tick: number): void {
    this.tickNumber          = tick;
    this.pendingHeatDeltas   = [];
    this.pendingShieldCracks = [];

    // Sync consecutive counters from EngineOrchestrator-provided runState
    this.recoveryLog.consecutivePositiveFlowTicks = runState.consecutivePositiveFlowTicks ?? 0;
    this.recoveryLog.consecutiveCleanTicks        = runState.consecutiveCleanTicks        ?? 0;
    this.recoveryLog.consecutiveFortifiedTicks    = runState.consecutiveFortifiedTicks    ?? 0;

    // ── Step 1: Positive cascade evaluation ─────────────────────────────────
    const posResult = this.positiveTracker.evaluateTick(tick, runState, this.recoveryLog);

    for (const id of posResult.newlyActivated) {
      if (id === ChainId.PCHAIN_NEMESIS_BROKEN && posResult.nemesisBrokenBotId) {
        this.handleNemesisBroken(posResult.nemesisBrokenBotId as BotId, tick);
      } else {
        this.applyPositiveCascadeEffects(id, tick);
        const def = CascadeChainRegistry.getAllPositiveChains().find(c => c.chainId === id);
        this.uxBridge.emitPositiveActivated(
          id,
          def?.chainName ?? id,
          this.describePositiveEffect(id),
          tick
        );
      }
    }

    for (const id of posResult.dissolved) {
      const def = CascadeChainRegistry.getAllPositiveChains().find(c => c.chainId === id);
      this.uxBridge.emitPositiveDissolved(id, def?.dissolutionMessage ?? 'Sustaining condition no longer met.', tick);
    }

    for (const id of posResult.paused) {
      const def = CascadeChainRegistry.getAllPositiveChains().find(c => c.chainId === id);
      this.uxBridge.emitPositivePaused(id, def?.dissolutionMessage ?? 'Condition temporarily broken.', tick);
    }

    for (const id of posResult.resumed) {
      this.uxBridge.emitPositiveResumed(id, tick);
    }

    // Apply per-tick effects from STILL-ACTIVE positive cascades
    for (const id of posResult.stillActive) {
      this.applyPositiveCascadeEffects(id, tick);
    }

    // ── Steps 2–8: Process due negative links ────────────────────────────────
    const execResult = this.queueManager.processTickLinks(tick, this.recoveryLog, runState);

    // Emit chain-broken events for newly interrupted chains
    for (const interrupted of execResult.chainsInterrupted) {
      this.uxBridge.emitChainBroken(
        interrupted.chainId as ChainId,
        interrupted.instanceId,
        interrupted.brokenAtLinkIndex,
        interrupted.recoveryMessage,
        tick
      );
      this.totalLinksDefeated++;
    }

    // Apply effects and emit events for each executed link
    for (const exec of execResult.linksExecuted) {
      if (exec.wasIntercepted) {
        this.totalLinksDefeated++;
        continue; // chain-broken event already emitted above
      }

      // Apply the link's game state effect
      this.applyLinkEffect(exec.effectType, { ...exec.payload, sourceChainId: exec.chainId as ChainId }, tick);

      // Emit the link fired event
      this.uxBridge.emitLinkFired(
        exec.chainId as ChainId,
        exec.instanceId,
        exec.linkIndex,
        exec.effectType,
        exec.payload,
        exec.linkDescription,
        tick,
        tick
      );
    }

    // Emit chain completed events
    for (const completed of execResult.chainsCompleted) {
      this.uxBridge.emitChainCompleted(
        completed.chainId as ChainId,
        completed.instanceId,
        completed.linksFireCount,
        completed.linksSkippedCount,
        tick
      );
    }

    // ── Step 9: Emit snapshot ────────────────────────────────────────────────
    const snapshot        = this.buildSnapshot(tick);
    this.lastSnapshot     = snapshot;
    this.uxBridge.emitSnapshotUpdated(snapshot, tick);
  }

  // ── Effect Application ─────────────────────────────────────────────────────

  /**
   * Routes each CascadeEffectType to its outbound channel.
   * CascadeEngine never mutates engine state directly.
   * HATER_HEAT_DELTA → pendingHeatDeltas (batched, one DB write from EngineOrchestrator)
   * SHIELD_CRACK     → pendingShieldCracks (applied via shieldEngine.applyDirectDamage)
   * Everything else  → EventBus emit (consumed by FinancialEngine, CardEngine, etc.)
   */
  private applyLinkEffect(effectType: CascadeEffectType, payload: any, tick: number): void {
    switch (effectType) {

      case CascadeEffectType.HATER_HEAT_DELTA:
        this.pendingHeatDeltas.push({
          delta:         payload.delta,
          sourceChainId: payload.sourceChainId,
          tickNumber:    tick,
        });
        this.uxBridge.emitHeatWriteQueued(payload.delta, payload.sourceChainId, tick);
        break;

      case CascadeEffectType.SHIELD_CRACK:
        // Queue for EngineOrchestrator to dispatch to shieldEngine.applyDirectDamage()
        this.pendingShieldCracks.push({
          layerId:       payload.targetLayerId,
          damageAmount:  payload.damageAmount,
          sourceChainId: payload.sourceChainId,
          tickNumber:    tick,
        });
        break;

      case CascadeEffectType.INCOME_MODIFIER:
        this.eventBus.emit('INCOME_MODIFIER_APPLIED', {
          factor:        payload.factor,
          durationTicks: payload.durationTicks,
          sourceChainId: payload.sourceChainId,
          tickNumber:    tick,
          timestamp:     Date.now(),
        });
        break;

      case CascadeEffectType.EXPENSE_MODIFIER:
        this.eventBus.emit('EXPENSE_MODIFIER_APPLIED', {
          factor:        payload.factor,
          durationTicks: payload.durationTicks,
          sourceChainId: payload.sourceChainId,
          tickNumber:    tick,
          timestamp:     Date.now(),
        });
        break;

      case CascadeEffectType.CARD_INJECT:
        this.eventBus.emit('CASCADE_CARD_INJECT', {
          cardType:      payload.cardType,
          injectionType: payload.injectionType,
          timerTicks:    payload.timerTicks,
          sourceChainId: payload.sourceChainId,
          tickNumber:    tick,
          timestamp:     Date.now(),
        });
        break;

      case CascadeEffectType.CARD_LOCK:
        this.eventBus.emit('CASCADE_CARD_LOCK', {
          cardType:      payload.cardType,
          lockType:      payload.lockType,
          durationTicks: payload.durationTicks,
          sourceChainId: payload.sourceChainId,
          tickNumber:    tick,
          timestamp:     Date.now(),
        });
        break;

      case CascadeEffectType.BOT_ACTIVATE:
        this.eventBus.emit('CASCADE_BOT_ACTIVATE', {
          botId:         payload.botId,
          sourceChainId: payload.sourceChainId,
          tickNumber:    tick,
          timestamp:     Date.now(),
        });
        break;

      case CascadeEffectType.OPPORTUNITY_UNLOCK:
        this.eventBus.emit('CASCADE_OPPORTUNITY_UNLOCK', {
          opportunityType: payload.opportunityType,
          cardType:        payload.cardType,
          sourceChainId:   payload.sourceChainId,
          tickNumber:      tick,
          timestamp:       Date.now(),
        });
        break;

      case CascadeEffectType.STAT_MODIFIER:
        this.eventBus.emit('CASCADE_STAT_MODIFIER', {
          statKey:       payload.statKey,
          value:         payload.value,
          durationTicks: payload.durationTicks,
          sourceChainId: payload.sourceChainId,
          tickNumber:    tick,
          timestamp:     Date.now(),
        });
        break;

      case CascadeEffectType.MOMENTUM_LOCK:
        // Emit so PositiveCascadeTracker (via its EventBus subscription) can apply the lock
        this.eventBus.emit('CASCADE_MOMENTUM_LOCK', {
          targetChainId: payload.targetChainId,
          durationTicks: payload.durationTicks,
          sourceChainId: payload.sourceChainId,
          tickNumber:    tick,
          timestamp:     Date.now(),
        });
        break;
    }
  }

  /**
   * Applies per-tick passive effects from active positive cascades.
   * Called for both newly-activated and still-active positive cascades each tick.
   */
  private applyPositiveCascadeEffects(id: ChainId, tick: number): void {
    switch (id) {
      case ChainId.PCHAIN_SUSTAINED_CASHFLOW:
        // +15% passive income boost this tick
        this.eventBus.emit('INCOME_MODIFIER_APPLIED', {
          factor:        1 + CASCADE_CONSTANTS.PCHAIN_CASHFLOW_INCOME_BONUS,
          durationTicks: 1,
          sourceChainId: id,
          tickNumber:    tick,
          timestamp:     Date.now(),
        });
        // Opportunity card every PCHAIN_CASHFLOW_CARD_INTERVAL ticks
        const cashflowTicks = this.positiveTracker.getTicksActive(id);
        if (cashflowTicks > 0 && cashflowTicks % CASCADE_CONSTANTS.PCHAIN_CASHFLOW_CARD_INTERVAL === 0) {
          this.eventBus.emit('CASCADE_OPPORTUNITY_UNLOCK', {
            opportunityType: 'CASHFLOW_MOMENTUM_REWARD',
            cardType:        'MOMENTUM_MULTIPLIER',
            sourceChainId:   id,
            tickNumber:      tick,
            timestamp:       Date.now(),
          });
        }
        break;

      case ChainId.PCHAIN_FORTIFIED_SHIELDS:
        // Opportunity card every PCHAIN_FORTIFIED_INTERVAL_TICKS ticks
        const fortifiedTicks = this.positiveTracker.getTicksActive(id);
        if (fortifiedTicks > 0 && fortifiedTicks % CASCADE_CONSTANTS.PCHAIN_FORTIFIED_INTERVAL_TICKS === 0) {
          this.eventBus.emit('CASCADE_OPPORTUNITY_UNLOCK', {
            opportunityType: 'FORTIFIED_OPPORTUNITY',
            cardType:        'RARE_OPPORTUNITY',
            sourceChainId:   id,
            tickNumber:      tick,
            timestamp:       Date.now(),
          });
        }
        break;

      case ChainId.PCHAIN_SOVEREIGN_APPROACH:
        // Growth cap +10% and -2 heat bleed per tick
        this.eventBus.emit('CASCADE_STAT_MODIFIER', {
          statKey:       'incomeGrowthCap',
          value:         0.10,
          durationTicks: 1,
          sourceChainId: id,
          tickNumber:    tick,
          timestamp:     Date.now(),
        });
        this.pendingHeatDeltas.push({
          delta:         -2,
          sourceChainId: id,
          tickNumber:    tick,
        });
        break;

      // PCHAIN_STREAK_MASTERY and PCHAIN_NEMESIS_BROKEN have no per-tick passive effects
      // Their effects are structural (card combos, bot immunization) handled elsewhere
      default:
        break;
    }
  }

  /**
   * Handles NEMESIS_BROKEN one-time event.
   * Resets hater_heat, dissolves bot-related chains, grants bot immunity, emits NEMESIS_BROKEN.
   */
  private handleNemesisBroken(botId: BotId, tick: number): void {
    // Reset hater_heat to 0 via pendingHeatDeltas (-100 floored at 0 by EngineOrchestrator)
    this.pendingHeatDeltas.push({
      delta:         -100,
      sourceChainId: ChainId.PCHAIN_NEMESIS_BROKEN,
      tickNumber:    tick,
    });

    // Dissolve all active chains triggered by that bot's attack/state events
    this.queueManager.dissolveChainsByTrigger('BOT_ATTACK_FIRED');
    this.queueManager.dissolveChainsByTrigger('BOT_STATE_CHANGED');

    // Emit NEMESIS_BROKEN — HaterBotController listens to raise watchingHeatThreshold
    this.uxBridge.emitNemesisBroken(botId, CASCADE_CONSTANTS.NEMESIS_IMMUNITY_TICKS, tick);

    // Emit positive activation for UI display
    this.uxBridge.emitPositiveActivated(
      ChainId.PCHAIN_NEMESIS_BROKEN,
      'Nemesis Broken Event',
      `${botId} dismantled twice. hater_heat reset. Bot chains dissolved. ${CASCADE_CONSTANTS.NEMESIS_IMMUNITY_TICKS}-tick primary attack immunity granted.`,
      tick
    );
  }

  private describePositiveEffect(id: ChainId): string {
    const descriptions: Partial<Record<ChainId, string>> = {
      [ChainId.PCHAIN_SUSTAINED_CASHFLOW]:
        `+${CASCADE_CONSTANTS.PCHAIN_CASHFLOW_INCOME_BONUS * 100}% passive income boost. Opportunity card every ${CASCADE_CONSTANTS.PCHAIN_CASHFLOW_CARD_INTERVAL} ticks. Tension -${Math.abs(CASCADE_CONSTANTS.PCHAIN_CASHFLOW_TENSION_DELTA * 100)}%/tick.`,
      [ChainId.PCHAIN_FORTIFIED_SHIELDS]:
        `Opportunity window open. Rare card every ${CASCADE_CONSTANTS.PCHAIN_FORTIFIED_INTERVAL_TICKS} ticks while all shields hold ≥80%.`,
      [ChainId.PCHAIN_STREAK_MASTERY]:
        'Advanced card combination bonuses unlocked. INCOME_BOOST+ALLIANCE, INVESTMENT+CREDIT_BUILD, PATTERN_BREAK+INCOME_REINFORCE combos now available.',
      [ChainId.PCHAIN_SOVEREIGN_APPROACH]:
        'Sovereign card set unlocked. Income growth cap +10%/tick. hater_heat -2/tick. System is losing its hold.',
      [ChainId.PCHAIN_NEMESIS_BROKEN]:
        `hater_heat reset to 0. All bot-triggered chains dissolved. ${CASCADE_CONSTANTS.NEMESIS_IMMUNITY_TICKS}-tick attack immunity granted.`,
    };
    return descriptions[id] ?? '';
  }

  // ── Chain Activation ───────────────────────────────────────────────────────

  private activateChain(chainId: ChainId, triggerEvent: string, tick: number): void {
    let def;
    try {
      def = CascadeChainRegistry.getNegativeChain(chainId);
    } catch {
      return; // Chain not yet registered — skip silently
    }

    const instance = this.queueManager.activateChain(def, triggerEvent, tick);

    if (!instance) {
      // Cap hit — emit analytics event
      const activeCount = this.queueManager.getActiveInstances()
        .filter(i => i.chainId === chainId).length;
      this.uxBridge.emitTriggerCapped(chainId, activeCount, tick);
      return;
    }

    this.totalLinksScheduled += def.links.length;
    const firstLinkTick = tick + (def.links[0]?.tickOffset ?? 1);

    this.uxBridge.emitChainStarted(
      chainId,
      instance.instanceId,
      def.severity,
      def.direction,
      firstLinkTick,
      def.playerMessage,
      tick
    );
  }

  // ── Public Accessors for EngineOrchestrator ────────────────────────────────

  /**
   * Returns all batched hater_heat deltas accumulated this tick.
   * EngineOrchestrator sums these into one DB write, floored at 0, capped at 100.
   */
  public getPendingHeatDeltas(): HeatDeltaPending[] {
    return [...this.pendingHeatDeltas];
  }

  /**
   * Returns all shield cracks queued this tick.
   * EngineOrchestrator dispatches each to shieldEngine.applyDirectDamage().
   */
  public getPendingShieldCracks(): ShieldCrackPending[] {
    return [...this.pendingShieldCracks];
  }

  /** Called by EngineOrchestrator AFTER consuming both pending arrays. */
  public clearPending(): void {
    this.pendingHeatDeltas   = [];
    this.pendingShieldCracks = [];
  }

  public getSnapshot(): CascadeSnapshot {
    return this.lastSnapshot ?? this.buildSnapshot(this.tickNumber);
  }

  public isPositiveCascadeActive(id: ChainId): boolean {
    return this.positiveTracker.isActive(id);
  }

  // ── Snapshot Builder ───────────────────────────────────────────────────────

  private buildSnapshot(tick: number): CascadeSnapshot {
    const activeNegative = this.queueManager.getActiveInstances();
    const activePositive = this.positiveTracker.getActiveCascades();

    return {
      activeNegativeChains:   activeNegative,
      activePositiveCascades: activePositive,
      queueDepth:             activeNegative.length,
      highestActiveSeverity:  this.queueManager.getHighestSeverity(),
      hasCatastrophicChain:   this.queueManager.hasCatastrophicChain(),
      positiveCount:          activePositive.length,
      totalLinksScheduled:    this.totalLinksScheduled,
      totalLinksDefeated:     this.totalLinksDefeated,
      tickNumber:             tick,
      timestamp:              Date.now(),
    };
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  private buildEmptyLog(): RecoveryActionLog {
    return {
      cardTypesPlayedSinceMap:      new Map(),
      budgetActionsUsedSinceMap:    new Map(),
      nemesisNeutralizationCount:   new Map(),
      consecutivePositiveFlowTicks: 0,
      consecutiveCleanTicks:        0,
      consecutiveFortifiedTicks:    0,
    };
  }

  public reset(): void {
    this.queueManager.reset();
    this.positiveTracker.reset();
    this.recoveryLog          = this.buildEmptyLog();
    this.pendingHeatDeltas    = [];
    this.pendingShieldCracks  = [];
    this.totalLinksDefeated   = 0;
    this.totalLinksScheduled  = 0;
    this.lastSnapshot         = null;
    this.tickNumber           = 0;
  }
}