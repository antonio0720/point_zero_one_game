/**
 * FILE: pzo-web/src/engines/battle/BattleUXBridge.ts
 *
 * The ONLY outbound EventBus channel for the Battle Engine.
 * All EventBus.emit() calls for battle events are consolidated here.
 * Zero calculation logic — pure emit wrapping only.
 *
 * CANONICAL BUS: zero/EventBus. Imports EventBus from '../zero/EventBus' only.
 * NEVER imports from core/EventBus or uses PZOEventChannel enum.
 *
 * Payload fields match EngineEventPayloadMap exactly.
 * eventType, tickIndex, timestamp are in the EngineEvent ENVELOPE — not the payload.
 *
 * Density6 LLC · Point Zero One · Engine 5 of 7 · Confidential
 */
import type {
  BotId,
  BotState,
  BotAttackEvent,
  BattleAction,
  BattleSnapshot,
} from './types';
import { BATTLE_CONSTANTS } from './types';
import type { EventBus } from '../zero/EventBus';

export class BattleUXBridge {
  constructor(private readonly eventBus: EventBus) {}

  // ── Bot state change — BOT_STATE_CHANGED ──────────────────────────────────

  /**
   * Fires when a bot transitions lifecycle states (DORMANT → WATCHING → etc).
   * Payload: { botId, from, to } — matches EngineEventPayloadMap['BOT_STATE_CHANGED'].
   */
  public emitBotStateChanged(
    botId: BotId,
    from:  BotState,
    to:    BotState,
  ): void {
    this.eventBus.emit('BOT_STATE_CHANGED', { botId, from, to });
  }

  // ── Attack fired — BOT_ATTACK_FIRED ──────────────────────────────────────

  /**
   * Fires when a bot executes an attack against the player.
   * Payload: { botId, attackType, targetLayer } — matches EngineEventPayloadMap['BOT_ATTACK_FIRED'].
   */
  public emitBotAttackFired(
    botId:       BotId,
    attackEvent: BotAttackEvent,
  ): void {
    this.eventBus.emit('BOT_ATTACK_FIRED', {
      botId,
      attackType:  attackEvent.attackType,
      targetLayer: attackEvent.targetLayerId,
    });
  }

  // ── Neutralized — BOT_NEUTRALIZED ────────────────────────────────────────

  /**
   * Fires when a player action neutralizes a bot for N ticks.
   * Payload: { botId, immunityTicks } — matches EngineEventPayloadMap['BOT_NEUTRALIZED'].
   */
  public emitBotNeutralized(botId: BotId): void {
    this.eventBus.emit('BOT_NEUTRALIZED', {
      botId,
      immunityTicks: BATTLE_CONSTANTS.NEUTRALIZED_TICKS,
    });
  }

  // ── Counter intel — COUNTER_INTEL_AVAILABLE ───────────────────────────────

  /**
   * Fires when FORENSICS_PASS reveals optimal counter strategy for a bot.
   * Payload: { botId, attackProfile, tier } — matches EngineEventPayloadMap['COUNTER_INTEL_AVAILABLE'].
   */
  public emitCounterIntelAvailable(
    botId:         BotId,
    attackProfile: object,
    tier:          string,
  ): void {
    this.eventBus.emit('COUNTER_INTEL_AVAILABLE', { botId, attackProfile, tier });
  }

  // ── Budget update — BATTLE_BUDGET_UPDATED ────────────────────────────────

  /**
   * Fires when battle budget is spent or refreshed.
   * Payload: { remaining, spent, tickBudget } — matches EngineEventPayloadMap['BATTLE_BUDGET_UPDATED'].
   */
  public emitBudgetUpdated(
    remaining:   number,
    spent:       number,
    tickBudget:  number,
  ): void {
    this.eventBus.emit('BATTLE_BUDGET_UPDATED', { remaining, spent, tickBudget });
  }

  // ── Budget action — BUDGET_ACTION_EXECUTED ───────────────────────────────

  /**
   * Fires after a player spends budget on a specific action.
   * Payload: { action, remainingBudget } — matches EngineEventPayloadMap['BUDGET_ACTION_EXECUTED'].
   */
  public emitBudgetActionExecuted(
    action:          BattleAction,
    remainingBudget: number,
  ): void {
    this.eventBus.emit('BUDGET_ACTION_EXECUTED', { action, remainingBudget });
  }

  // ── Syndicate duel — SYNDICATE_DUEL_RESULT ───────────────────────────────

  /**
   * Fires at TEAM_UP mode duel resolution.
   * Payload: { duelId, winnerId, loserId, reward }.
   */
  public emitSyndicateDuelResult(
    duelId:   string,
    winnerId: string,
    loserId:  string,
    reward:   object,
  ): void {
    this.eventBus.emit('SYNDICATE_DUEL_RESULT', { duelId, winnerId, loserId, reward });
  }

  // ── Snapshot — BATTLE_SNAPSHOT_UPDATED ───────────────────────────────────

  /**
   * Primary per-tick emit. Fires every tick after all bot processing.
   * Payload: { snapshot } — opaque to zero/types.ts, typed in battle/types.ts.
   */
  public emitSnapshotUpdated(snapshot: BattleSnapshot): void {
    this.eventBus.emit('BATTLE_SNAPSHOT_UPDATED', { snapshot });
  }
}