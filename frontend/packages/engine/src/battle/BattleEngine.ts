// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/battle/BattleEngine.ts

/**
 * FILE: pzo-web/src/engines/battle/BattleEngine.ts
 * Public API. Orchestrates all Battle Engine sub-components.
 *
 * Called by EngineOrchestrator:
 *   tickBattle(rss, tick)        — Step 4 of tick sequence
 *   getPendingAttacks()          — Step 5 — attacks dispatched to ShieldEngine
 *   clearPendingAttacks()        — Step 5 — cleanup after dispatch
 *   executeBudgetAction(...)     — when player spends battle budget pts
 *
 * Strict boundary rules:
 *   ✦ Never queries DB directly — reads haterHeat from RunStateForBattle parameter only
 *   ✦ Never resolves financial consequences — creates attacks; ShieldEngine/CascadeEngine resolve them
 *   ✦ Never imports ShieldEngine class, TensionEngine class, PressureEngine, or CascadeEngine
 *   ✦ Uses Engine 0 EventBus (../zero/EventBus) — single canonical bus instance across engines
 */
import {
  BotId,
  BotState,
  BattleActionType,
  BattleAction,
  BattleSnapshot,
  RunStateForBattle,
  InjectionType,
  BotAttackEvent,
  AttackType,
} from './types';
import { HaterBotController } from './HaterBotController';
import { BattleBudgetManager } from './BattleBudgetManager';
import { AttackInjector } from './AttackInjector';
import { BattleUXBridge } from './BattleUXBridge';
import type { ShieldReader } from '../shield/types';
import { ShieldLayerId } from '../shield/types';
import type { EventBus } from '../zero/EventBus';
import { EngineId, type EngineInitParams } from '../zero/types';

// ── Attack type → Injection type map ─────────────────────────────────────────
const ATTACK_TO_INJECTION: Partial<Record<AttackType, InjectionType>> = {
  [AttackType.ASSET_STRIP]: InjectionType.FORCED_SALE,
  [AttackType.REGULATORY_ATTACK]: InjectionType.REGULATORY_HOLD,
  [AttackType.FINANCIAL_SABOTAGE]: InjectionType.INVERSION_CURSE,
  [AttackType.EXPENSE_INJECTION]: InjectionType.EXPENSE_SPIKE,
  [AttackType.OPPORTUNITY_KILL]: InjectionType.DILUTION_NOTICE,
};

// ── BattleEngine ──────────────────────────────────────────────────────────────

export class BattleEngine {
  public readonly engineId: EngineId = EngineId.BATTLE;

  private shieldReader: any = null;
  private tensionReader: any = null;
  public setShieldReader(reader: any): void { this.shieldReader = reader; }
  public setTensionReader(reader: any): void { this.tensionReader = reader; }
  private botController: HaterBotController;
  private budgetManager: BattleBudgetManager;
  private injector: AttackInjector;
  private uxBridge: BattleUXBridge;
  private pendingAttacks: BotAttackEvent[] = [];
  private lastSnapshot: BattleSnapshot | null = null;
  private tickNumber: number = 0;

  constructor(
    private readonly eventBus: EventBus,
    private readonly shieldReader: ShieldReader // passed by EngineOrchestrator
  ) {
    this.botController = new HaterBotController();
    this.budgetManager = new BattleBudgetManager();
    this.injector = new AttackInjector(eventBus);
    this.uxBridge = new BattleUXBridge(eventBus);
  }

  // ── Tick Step 4 — Bot Processing ──────────────────────────────────────────

  /**
   * Main tick entry point. Called by EngineOrchestrator at Step 4.
   *
   * Sequence inside tickBattle():
   *   1. Reset battle budget to income-tier allocation
   *   2. Tick all 5 bot state machines
   *   3. Emit state change events via BattleUXBridge
   *   4. Register pending attacks + inject hand cards for each attack type
   *   5. Tick injection countdowns — fire expiry events for expired cards
   *   6. Build and emit BattleSnapshot
   */
  public tickBattle(rss: RunStateForBattle, tick: number): void {
    this.tickNumber = tick;

    // 1. Reset battle budget for this tick
    this.budgetManager.resetForTick(rss.monthlyIncome, tick);

    // 2. Tick all bot state machines
    const result = this.botController.tickAllBots(rss, this.shieldReader, tick);

    // 3. Emit state change events
    for (const sc of result.stateChanges) {
      // BattleUXBridge.emitBotStateChanged(botId, from, to)
      this.uxBridge.emitBotStateChanged(sc.botId, sc.from, sc.to);
      if (sc.to === BotState.NEUTRALIZED) {
        // BattleUXBridge.emitBotNeutralized(botId)
        this.uxBridge.emitBotNeutralized(sc.botId);
      }
    }

    // 4. Register pending attacks — dispatched to ShieldEngine at Step 5
    this.pendingAttacks = result.pendingAttacks;

    for (const atk of this.pendingAttacks) {
      // BattleUXBridge.emitBotAttackFired(botId, attackEvent)
      this.uxBridge.emitBotAttackFired(atk.botId, atk);

      // Inject a corresponding hand card for the primary attack type
      const injType = ATTACK_TO_INJECTION[atk.attackType];
      if (injType) {
        this.injector.inject(injType, atk.botId, tick);
      }

      // BOT_03 (THE MANIPULATOR) fires a secondary REPUTATION_ATTACK simultaneously.
      // The primary (FINANCIAL_SABOTAGE → INVERSION_CURSE) is already injected above.
      // The secondary hit is handled by EngineOrchestrator dispatching both attack events.
    }

    // 5. Tick injection countdowns — expiry events fire inside tickInjections()
    this.injector.tickInjections(tick);

    // 6. Build and emit snapshot
    const snapshot = this.buildSnapshot(rss, tick);
    this.lastSnapshot = snapshot;

    // BattleUXBridge.emitSnapshotUpdated(snapshot)
    this.uxBridge.emitSnapshotUpdated(snapshot);
  }

  // ── Step 5 — Attack Dispatch (called by EngineOrchestrator) ──────────────

  /** Returns pending bot attacks for ShieldEngine to process at Step 5. */
  public getPendingAttacks(): BotAttackEvent[] {
    return [...this.pendingAttacks];
  }

  /** Called by EngineOrchestrator after all attacks have been dispatched to ShieldEngine. */
  public clearPendingAttacks(): void {
    this.pendingAttacks = [];
  }

  // ── Budget Actions (player-driven) ────────────────────────────────────────

  /**
   * Execute a player-initiated budget action.
   *
   * COUNTER_EVIDENCE_FILE is the ONLY action that transitions bot state.
   * All other actions (SHIELD_REPAIR_BOOST, THREAT_DELAY, etc.) are routed
   * by EngineOrchestrator reading the returned BattleAction type.
   *
   * Returns BattleAction on success; null on failure (invalid target or insufficient pts).
   * Pts are NEVER deducted on failure.
   */
  public executeBudgetAction(
    actionType: BattleActionType,
    targetBotId: BotId | null,
    targetLayerId: ShieldLayerId | null
  ): BattleAction | null {
    // ── Target Validation for COUNTER_EVIDENCE_FILE ────────────────────────
    // Must target a bot in WATCHING, TARGETING, or ATTACKING state.
    // DORMANT, RETREATING, and NEUTRALIZED bots are invalid targets — pts NOT spent.
    if (actionType === BattleActionType.COUNTER_EVIDENCE_FILE) {
      if (!targetBotId) return null;

      const bot = this.botController.getBot(targetBotId);
      if (!bot) return null;

      const INVALID_STATES = [BotState.DORMANT, BotState.RETREATING, BotState.NEUTRALIZED];
      if (INVALID_STATES.includes(bot.state)) return null;
    }

    // ── Target Validation for COUNTER_SABOTAGE ────────────────────────────
    // Must target a bot in TARGETING or ATTACKING state to be meaningful.
    // (Not enforced as a hard block — allow it but warn if wasted on passive bot)
    if (actionType === BattleActionType.COUNTER_SABOTAGE && targetBotId) {
      const bot = this.botController.getBot(targetBotId);
      if (bot && bot.state !== BotState.TARGETING && bot.state !== BotState.ATTACKING) {
        console.warn(
          `[BattleEngine] COUNTER_SABOTAGE applied to bot ${targetBotId} in state ${bot.state} — pts spent but damage reduction will not activate before bot retreats.`
        );
      }
    }

    // ── Attempt Budget Deduction ──────────────────────────────────────────
    const action = this.budgetManager.executeAction(
      actionType,
      targetBotId,
      targetLayerId,
      this.tickNumber
    );

    if (!action) return null; // Insufficient pts — nothing was spent

    // ── Apply Action Effects ──────────────────────────────────────────────
    switch (actionType) {
      case BattleActionType.COUNTER_EVIDENCE_FILE:
        // Transitions bot to NEUTRALIZED — cancels preloaded attack
        if (targetBotId) {
          this.botController.neutralize(targetBotId, this.tickNumber);
        }
        break;

      case BattleActionType.COUNTER_SABOTAGE:
        // Applies 30% damage reduction for 2 ticks
        if (targetBotId) {
          this.botController.applyCounterSabotage(targetBotId);
        }
        break;

      case BattleActionType.HATER_DISTRACTION:
        // hater_heat delta is queued as a DB write — takes effect next tick via RunStateSnapshot.
        // Also mitigates any active HATER_HEAT_SURGE card.
        this.injector.mitigateHeatSurge();
        // EngineOrchestrator queues the -3 hater_heat DB write from the returned BattleAction.
        break;

      // SHIELD_REPAIR_BOOST, THREAT_DELAY, DECOY_CARD, INCOME_REINFORCE, ALLIANCE_SIGNAL:
      // EngineOrchestrator reads the BattleAction.actionType and routes to the
      // appropriate engine or system. BattleEngine does not handle these directly.
      default:
        break;
    }

    // BattleUXBridge.emitBudgetActionExecuted(action, remainingBudget)
    this.uxBridge.emitBudgetActionExecuted(action, this.budgetManager.getRemainingPts());

    return action;
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  public getSnapshot(): BattleSnapshot {
    return this.lastSnapshot ?? this.buildSnapshot({} as RunStateForBattle, this.tickNumber);
  }

  public getActiveBotCount(): number {
    return this.botController.getActiveBots().length;
  }

  public canAfford(action: BattleActionType): boolean {
    return this.budgetManager.canAfford(action);
  }

  public getRemainingBudget(): number {
    return this.budgetManager.getRemainingPts();
  }

  public hasActiveHeatSurge(): boolean {
    return this.injector.hasActiveHeatSurge();
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  /**
   * Full reset — called on run start/end.
   * Clears all bot states, injected cards, pending attacks, and snapshot.
   */
  public init(params: EngineInitParams): void {
    this.reset();
  }


  public reset(): void {
    this.botController.reset();
    this.injector.reset();
    this.budgetManager.resetForTick(0, 0);
    this.pendingAttacks = [];
    this.lastSnapshot = null;
    this.tickNumber = 0;
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private buildSnapshot(rss: RunStateForBattle, tick: number): BattleSnapshot {
    const bots = Object.fromEntries(this.botController.getAllBots()) as Record<BotId, any>;

    return {
      bots,
      budget: this.budgetManager.getSnapshot(),
      activeBotsCount: this.botController.getActiveBots().length,
      injectedCards: this.injector.getActiveCards(),
      haterHeat: rss.haterHeat ?? 0,
      activeDuel: null, // SyndicateWarEngine provides this separately
      tickNumber: tick,
      timestamp: Date.now(),
    };
  }
}