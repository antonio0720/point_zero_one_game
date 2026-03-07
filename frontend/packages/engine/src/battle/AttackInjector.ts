// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/battle/AttackInjector.ts

/**
 * FILE: pzo-web/src/engines/battle/AttackInjector.ts
 * Manages hostile injected cards in the player's hand.
 *
 * Every adversarial action produces a visible named card with a countdown.
 * The player always knows what is happening — financial education through legibility.
 *
 * Rules:
 *   - MAX 3 active injected cards simultaneously
 *   - 4th injection displaces the OLDEST card — expiry consequence fires immediately
 *   - Injected cards cannot be discarded by normal discard actions
 *   - HATER_HEAT_SURGE (timerTicks=0) is PERSISTENT — never auto-expires
 *   - Mitigation removes the card cleanly — NO expiry event fired
 */
import { v4 as uuidv4 } from 'uuid';
import {
  InjectedCard,
  InjectionType,
  BotId,
  BATTLE_CONSTANTS,
  CardInjectedEvent,
  InjectedCardExpiredEvent,
} from './types';
import type { EventBus } from '../zero/EventBus';

// ── Injection Configuration ───────────────────────────────────────────────────

const INJECTION_CONFIG: Record<InjectionType, { cardName: string; timerTicks: number }> = {
  [InjectionType.FORCED_SALE]: { cardName: 'DISTRESSED SALE NOTICE', timerTicks: 2 },
  [InjectionType.REGULATORY_HOLD]: { cardName: 'COMPLIANCE HOLD ORDER', timerTicks: 3 },
  [InjectionType.INVERSION_CURSE]: { cardName: 'MARKET INVERSION SIGNAL', timerTicks: 2 },
  [InjectionType.EXPENSE_SPIKE]: { cardName: 'SYSTEMIC EXPENSE SHOCK', timerTicks: 1 },
  [InjectionType.DILUTION_NOTICE]: { cardName: 'STRUCTURAL DILUTION NOTICE', timerTicks: 2 },
  // timerTicks: 0 = PERSISTENT — skipped by tickInjections() countdown
  [InjectionType.HATER_HEAT_SURGE]: { cardName: 'HEAT SURGE WARNING', timerTicks: 0 },
};

// ── Channel Type Bridge ───────────────────────────────────────────────────────
// Engine 0 EventBus.emit(channel, payload) is typed to EngineEventName.
// Battle event channels may not yet be included in that union.
// We derive the channel type from the EventBus signature and cast locally.

type EventChannel = Parameters<EventBus['emit']>[0];

const CH_CARD_INJECTED: EventChannel = ('CARD_INJECTED' as unknown) as EventChannel;
const CH_INJECTED_CARD_EXPIRED: EventChannel =
  ('INJECTED_CARD_EXPIRED' as unknown) as EventChannel;

// ── AttackInjector ────────────────────────────────────────────────────────────

export class AttackInjector {
  private activeCards: InjectedCard[] = [];

  constructor(private readonly eventBus: EventBus) {}

  /**
   * Inject a hostile card into the player's hand.
   *
   * If at the 3-card cap, the oldest active card is displaced:
   *   - Its expiry consequence fires immediately (INJECTED_CARD_EXPIRED event)
   *   - It is removed before the new card is added
   *
   * Emits CARD_INJECTED after the card is added.
   */
  public inject(type: InjectionType, sourceBotId: BotId, tick: number): InjectedCard {
    const cfg = INJECTION_CONFIG[type];

    const card: InjectedCard = {
      injectionId: uuidv4(),
      injectionType: type,
      sourceBotId,
      cardName: cfg.cardName,
      timerTicks: cfg.timerTicks,
      ticksRemaining: cfg.timerTicks,
      isMitigated: false,
      isExpired: false,
      injectedAtTick: tick,
    };

    // Displace oldest card if at cap — expiry consequence fires immediately
    if (this.activeCards.length >= BATTLE_CONSTANTS.MAX_INJECTED_CARDS) {
      const displaced = this.activeCards.shift()!;
      displaced.isExpired = true;
      this.emitExpired(displaced.injectionId, displaced.injectionType, tick);
    }

    this.activeCards.push(card);
    this.emitInjected(card, tick);
    return card;
  }

  /**
   * Tick down all active injected card countdowns.
   * Returns the list of cards that expired this tick.
   *
   * HATER_HEAT_SURGE (timerTicks === 0) is PERSISTENT — never decremented here.
   */
  public tickInjections(tick: number): InjectedCard[] {
    const expired: InjectedCard[] = [];

    for (const card of this.activeCards) {
      if (card.isMitigated || card.isExpired) continue;

      // Skip persistent cards (timerTicks === 0)
      if (card.timerTicks === 0) continue;

      card.ticksRemaining = Math.max(0, card.ticksRemaining - 1);

      if (card.ticksRemaining <= 0) {
        card.isExpired = true;
        expired.push(card);
        this.emitExpired(card.injectionId, card.injectionType, tick);
      }
    }

    // Prune expired cards from active list
    this.activeCards = this.activeCards.filter((c) => !c.isExpired);

    return expired;
  }

  /**
   * Mitigate an injected card by its ID.
   * Removes the card cleanly — does NOT fire an expiry event.
   * Returns true if the card was found and mitigated.
   */
  public mitigateCard(injectionId: string): boolean {
    const card = this.activeCards.find((c) => c.injectionId === injectionId);
    if (!card || card.isMitigated || card.isExpired) return false;

    card.isMitigated = true;
    this.activeCards = this.activeCards.filter((c) => c.injectionId !== injectionId);
    return true;
  }

  /**
   * Mitigate the active HATER_HEAT_SURGE card, if present.
   * Used when HATER_DISTRACTION budget action resolves the surge.
   */
  public mitigateHeatSurge(): boolean {
    const surge = this.activeCards.find(
      (c) => c.injectionType === InjectionType.HATER_HEAT_SURGE && !c.isMitigated
    );
    if (!surge) return false;
    return this.mitigateCard(surge.injectionId);
  }

  /** Returns whether a HATER_HEAT_SURGE card is currently active. */
  public hasActiveHeatSurge(): boolean {
    return this.activeCards.some(
      (c) => c.injectionType === InjectionType.HATER_HEAT_SURGE && !c.isMitigated
    );
  }

  public getActiveCards(): InjectedCard[] {
    return [...this.activeCards];
  }

  public getActiveCardCount(): number {
    return this.activeCards.length;
  }

  public reset(): void {
    this.activeCards = [];
  }

  // ── Private Emitters ──────────────────────────────────────────────────────

  private emitInjected(card: InjectedCard, tick: number): void {
    const e: CardInjectedEvent = {
      eventType: 'CARD_INJECTED',
      injectedCard: card,
      tickNumber: tick,
      timestamp: Date.now(),
    };
    this.eventBus.emit(CH_CARD_INJECTED, e);
  }

  private emitExpired(injectionId: string, injectionType: InjectionType, tick: number): void {
    const e: InjectedCardExpiredEvent = {
      eventType: 'INJECTED_CARD_EXPIRED',
      injectionId,
      injectionType,
      tickNumber: tick,
      timestamp: Date.now(),
    };
    this.eventBus.emit(CH_INJECTED_CARD_EXPIRED, e);
  }
}