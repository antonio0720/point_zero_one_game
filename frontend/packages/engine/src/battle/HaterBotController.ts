/**
 * FILE: pzo-web/src/engines/battle/HaterBotController.ts
 * Manages the lifecycle of all 5 bot state machines.
 * Called once per tick by BattleEngine.tickBattle().
 *
 * Returns BotTickResult: { stateChanges, pendingAttacks }
 * BattleEngine dispatches attacks and emits events from this result.
 *
 * Strict boundary: receives RunStateForBattle as a value argument.
 * Never reads from DB. Never emits to EventBus.
 */
import { v4 as uuidv4 } from 'uuid';
import {
  BotId,
  BotState,
  BotProfile,
  HaterBotRuntimeState,
  BotAttackEvent,
  RunStateForBattle,
  BATTLE_CONSTANTS,
} from './types';
import { BotProfileRegistry } from './BotProfileRegistry';
import type { ShieldReader } from '../shield/types';
import { ShieldLayerId } from '../shield/types';

export interface BotTickResult {
  stateChanges: Array<{ botId: BotId; from: BotState; to: BotState }>;
  pendingAttacks: BotAttackEvent[];
}

export class HaterBotController {
  private bots = new Map<BotId, HaterBotRuntimeState>();

  constructor() {
    for (const profile of BotProfileRegistry.getAllProfiles()) {
      this.bots.set(profile.id, this.initBot(profile));
    }
  }

  // ── Bot Initialization ────────────────────────────────────────────────────

  private initBot(profile: BotProfile): HaterBotRuntimeState {
    return {
      profileId: profile.id,
      profile,
      state: BotState.DORMANT,
      stateEnteredAtTick: 0,
      retreatTicksRemaining: 0,
      neutralizedTicksRemaining: 0,
      preloadedArrivalTick: null,
      preloadedAttackPower: null,
      damageReductionPct: 0,
      damageReductionTicksRemaining: 0,
      attacksThisRun: 0,
      lastStateBeforeNeutralized: BotState.DORMANT,
    };
  }

  // ── Main Tick ─────────────────────────────────────────────────────────────

  public tickAllBots(
    rss: RunStateForBattle,
    shieldReader: ShieldReader,
    currentTick: number
  ): BotTickResult {
    const stateChanges: Array<{ botId: BotId; from: BotState; to: BotState }> = [];
    const pendingAttacks: BotAttackEvent[] = [];

    for (const bot of this.bots.values()) {
      const result = this.tickBot(bot, rss, shieldReader, currentTick);
      if (result.stateChange) stateChanges.push(result.stateChange);
      if (result.attack)      pendingAttacks.push(result.attack);
    }

    return { stateChanges, pendingAttacks };
  }

  private tickBot(
    bot: HaterBotRuntimeState,
    rss: RunStateForBattle,
    sr: ShieldReader,
    tick: number
  ): {
    stateChange: { botId: BotId; from: BotState; to: BotState } | null;
    attack: BotAttackEvent | null;
  } {
    // Decay damage reduction each tick before state evaluation
    if (bot.damageReductionTicksRemaining > 0) {
      bot.damageReductionTicksRemaining--;
      if (bot.damageReductionTicksRemaining <= 0) {
        bot.damageReductionPct = 0;
      }
    }

    let sc: { botId: BotId; from: BotState; to: BotState } | null = null;
    let atk: BotAttackEvent | null = null;

    switch (bot.state) {

      // ── DORMANT ──────────────────────────────────────────────────────────
      case BotState.DORMANT: {
        if (
          rss.haterHeat >= bot.profile.watchingHeatThreshold &&
          this.meetsEscalationCondition(bot.profileId, rss, sr)
        ) {
          sc = this.transition(bot, BotState.WATCHING, tick);
        }
        break;
      }

      // ── WATCHING ─────────────────────────────────────────────────────────
      case BotState.WATCHING: {
        // Drop back to DORMANT if heat falls below watching threshold
        if (rss.haterHeat < bot.profile.watchingHeatThreshold) {
          sc = this.transition(bot, BotState.DORMANT, tick);
          break;
        }
        // Advance to TARGETING on heat OR specific targeting condition
        if (
          rss.haterHeat >= bot.profile.targetingHeatThreshold ||
          this.meetsTargetingCondition(bot.profileId, rss, sr)
        ) {
          bot.preloadedAttackPower = this.rollPower(
            bot.profile.attackPowerMin,
            bot.profile.attackPowerMax
          );
          // 2–3 tick arrival window
          bot.preloadedArrivalTick = tick + 2 + Math.floor(Math.random() * 2);
          sc = this.transition(bot, BotState.TARGETING, tick);
        }
        break;
      }

      // ── TARGETING ────────────────────────────────────────────────────────
      case BotState.TARGETING: {
        const heatThresholdMet  = rss.haterHeat >= bot.profile.attackingHeatThreshold;
        const arrivalTickMet    = bot.preloadedArrivalTick !== null && tick >= bot.preloadedArrivalTick;

        if (heatThresholdMet || arrivalTickMet) {
          atk = this.buildAttack(bot, tick);
          bot.attacksThisRun++;
          // Transition to ATTACKING — will immediately resolve to RETREATING
          // in the same tick via the ATTACKING case below.
          sc = this.transition(bot, BotState.ATTACKING, tick);

          // ATTACKING is a transient state — resolve to RETREATING immediately.
          // This means a bot NEVER persists in ATTACKING across ticks.
          bot.retreatTicksRemaining = bot.profile.retreatTicks;
          bot.preloadedArrivalTick  = null;
          bot.preloadedAttackPower  = null;
          this.transition(bot, BotState.RETREATING, tick);
          // Note: sc still holds the TARGETING→ATTACKING transition for event emission.
          // BattleEngine emits both the attack fired event and the subsequent retreat
          // using pendingAttacks + the stateChange record.
        }
        break;
      }

      // ── ATTACKING ────────────────────────────────────────────────────────
      // This case is only reached if somehow the bot was left in ATTACKING state
      // from a prior tick (should not happen under correct usage — guard included).
      case BotState.ATTACKING: {
        bot.retreatTicksRemaining = bot.profile.retreatTicks;
        bot.preloadedArrivalTick  = null;
        bot.preloadedAttackPower  = null;
        sc = this.transition(bot, BotState.RETREATING, tick);
        break;
      }

      // ── RETREATING ───────────────────────────────────────────────────────
      case BotState.RETREATING: {
        bot.retreatTicksRemaining = Math.max(0, bot.retreatTicksRemaining - 1);
        if (bot.retreatTicksRemaining <= 0) {
          const next =
            rss.haterHeat >= bot.profile.watchingHeatThreshold
              ? BotState.WATCHING
              : BotState.DORMANT;
          sc = this.transition(bot, next, tick);
        }
        break;
      }

      // ── NEUTRALIZED ──────────────────────────────────────────────────────
      case BotState.NEUTRALIZED: {
        bot.neutralizedTicksRemaining = Math.max(0, bot.neutralizedTicksRemaining - 1);
        if (bot.neutralizedTicksRemaining <= 0) {
          sc = this.transition(bot, bot.lastStateBeforeNeutralized, tick);
        }
        break;
      }
    }

    return { stateChange: sc, attack: atk };
  }

  // ── External Actions ──────────────────────────────────────────────────────

  /**
   * Neutralize via COUNTER_EVIDENCE_FILE budget action.
   * Valid targets: WATCHING, TARGETING, ATTACKING.
   * Invalid targets (DORMANT, RETREATING, NEUTRALIZED) return false — no state change.
   */
  public neutralize(botId: BotId, tick: number): boolean {
    const bot = this.bots.get(botId);
    if (!bot) return false;
    if (
      bot.state === BotState.DORMANT     ||
      bot.state === BotState.RETREATING  ||
      bot.state === BotState.NEUTRALIZED
    ) return false;

    bot.lastStateBeforeNeutralized    = bot.state;
    bot.neutralizedTicksRemaining     = BATTLE_CONSTANTS.NEUTRALIZED_TICKS;
    bot.preloadedArrivalTick          = null;   // cancel any preloaded attack
    bot.preloadedAttackPower          = null;
    this.transition(bot, BotState.NEUTRALIZED, tick);
    return true;
  }

  /**
   * Apply 30% damage reduction for 2 ticks via COUNTER_SABOTAGE budget action.
   * Valid for bots in TARGETING or ATTACKING state (BattleEngine validates this).
   */
  public applyCounterSabotage(botId: BotId): boolean {
    const bot = this.bots.get(botId);
    if (!bot) return false;
    bot.damageReductionPct             = BATTLE_CONSTANTS.COUNTER_SABOTAGE_REDUCTION;
    bot.damageReductionTicksRemaining  = BATTLE_CONSTANTS.COUNTER_SABOTAGE_DURATION_TICKS;
    return true;
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  public getAllBots(): Map<BotId, HaterBotRuntimeState> {
    return new Map(this.bots);
  }

  public getBot(id: BotId): HaterBotRuntimeState | undefined {
    return this.bots.get(id);
  }

  /** Returns bots currently in TARGETING or ATTACKING state. */
  public getActiveBots(): HaterBotRuntimeState[] {
    return [...this.bots.values()].filter(
      b => b.state === BotState.TARGETING || b.state === BotState.ATTACKING
    );
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  public reset(): void {
    for (const profile of BotProfileRegistry.getAllProfiles()) {
      this.bots.set(profile.id, this.initBot(profile));
    }
  }

  // ── Internal Helpers ──────────────────────────────────────────────────────

  private transition(
    bot: HaterBotRuntimeState,
    to: BotState,
    tick: number
  ): { botId: BotId; from: BotState; to: BotState } {
    const from  = bot.state;
    bot.state   = to;
    bot.stateEnteredAtTick = tick;
    return { botId: bot.profileId, from, to };
  }

  private buildAttack(bot: HaterBotRuntimeState, tick: number): BotAttackEvent {
    const basePower = bot.preloadedAttackPower
      ?? this.rollPower(bot.profile.attackPowerMin, bot.profile.attackPowerMax);

    const rawPower = Math.round(basePower * (1 - bot.damageReductionPct));

    const secondaryRawPower =
      bot.profile.secondaryPowerMax > 0
        ? Math.round(
            this.rollPower(bot.profile.secondaryPowerMin, bot.profile.secondaryPowerMax) *
            (1 - bot.damageReductionPct)
          )
        : 0;

    // Critical hit: bot spent 2+ ticks in TARGETING before firing
    const ticksInTargeting = tick - bot.stateEnteredAtTick;
    const isCritical =
      ticksInTargeting >= BATTLE_CONSTANTS.CRIT_TARGETING_TICKS_THRESHOLD;

    return {
      attackId:             uuidv4(),
      botId:                bot.profileId,
      attackType:           bot.profile.primaryAttackType,
      secondaryAttackType:  bot.profile.secondaryAttackType,
      rawPower,
      secondaryRawPower,
      isCritical,
      tickNumber:           tick,
      sourceHaterId:        bot.profileId,
    };
  }

  private rollPower(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // ── Per-Bot Escalation Conditions (DORMANT → WATCHING) ───────────────────

  private meetsEscalationCondition(
    id: BotId,
    rss: RunStateForBattle,
    _sr: ShieldReader
  ): boolean {
    switch (id) {
      case BotId.BOT_01_LIQUIDATOR:
        // Targets players who have grown: net worth >= 2× starting baseline
        return rss.netWorth >= rss.startingNetWorth * 2;

      case BotId.BOT_02_BUREAUCRAT:
        // Punishes complexity: 3+ distinct active income streams
        return rss.activeIncomeStreamCount >= 3;

      case BotId.BOT_03_MANIPULATOR:
        // Monitors play patterns: entropy below 0.4 (predictable)
        return rss.cardPatternEntropy < 0.4;

      case BotId.BOT_04_CRASH_PROPHET:
        // High-value runs only: income > $10k AND hater_heat already > 60
        return rss.monthlyIncome > 10_000 && rss.haterHeat > 60;

      case BotId.BOT_05_LEGACY_HEIR:
        // Late-game only: net worth > 5× freedom threshold
        return rss.netWorth >= rss.freedomThreshold * 5;

      default:
        return true;
    }
  }

  // ── Per-Bot Targeting Conditions (WATCHING → TARGETING) ──────────────────

  private meetsTargetingCondition(
    id: BotId,
    rss: RunStateForBattle,
    sr: ShieldReader
  ): boolean {
    switch (id) {
      case BotId.BOT_01_LIQUIDATOR:
        // Preys on weakened asset positions OR growth momentum (investment cards in hand)
        return (
          sr.getLayerState(ShieldLayerId.ASSET_FLOOR).integrityPct < 0.70 ||
          rss.investmentCardsInHand >= 2
        );

      case BotId.BOT_02_BUREAUCRAT:
        // Pattern detection: same card type played 3+ consecutive ticks
        return rss.sameCardTypeConsecutiveTicks >= 3;

      case BotId.BOT_03_MANIPULATOR:
        // Maximum exploit window: entropy below 0.3 (highly predictable)
        return rss.cardPatternEntropy < 0.3;

      case BotId.BOT_04_CRASH_PROPHET:
        // Hunts thin liquidity exclusively
        return sr.getLayerState(ShieldLayerId.LIQUIDITY_BUFFER).integrityPct < 0.80;

      case BotId.BOT_05_LEGACY_HEIR:
        // Targets sustained momentum: 4+ consecutive positive growth ticks
        return rss.consecutivePositiveGrowthTicks >= 4;

      default:
        return false;
    }
  }
}