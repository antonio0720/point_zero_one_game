//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/cards/ForcedCardQueue.ts

// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — FORCED CARD QUEUE
// pzo-web/src/engines/cards/ForcedCardQueue.ts
//
// Manages the injection pipeline for threat cards arriving from TensionEngine
// and BattleEngine. Listens for THREAT_ARRIVED and BOT_ATTACK_FIRED EventBus
// events, materializes the corresponding CardDefinition into a CardInHand,
// assigns its decision window, and tracks mandatory resolution.
//
// FORCED CARD DOCTRINE:
//   - Forced cards CANNOT be discarded. Player must pick the least-bad option.
//   - They block all non-forced plays until resolved (TimingValidator gate).
//   - FUBAR cards are the primary forced type from the fate deck.
//   - Threat cards from TensionEngine map to specific FUBAR card IDs.
//   - Bot attack cards from BattleEngine map to damage-type card IDs.
//   - Forced cards receive a shorter, stricter decision window than STANDARD.
//
// INJECTION PIPELINE:
//   1. Event arrives (THREAT_ARRIVED / BOT_ATTACK_FIRED / CASCADE_LINK_FIRED)
//   2. ForcedCardQueue resolves cardId from sourceEventId or fallback map
//   3. ModeOverlayEngine.applyOverlay() materializes the CardInHand
//   4. HandManager.injectCard() places it in hand
//   5. DecisionWindowManager.openWindow() starts the forced timer
//   6. ForcedCardEntry logged in entries map for tracking
//
// RULES:
//   ✦ ForcedCardQueue subscribes to EventBus directly at init.
//   ✦ CardEngine processes pendingInjections once per tick (Step 2 of tick seq).
//   ✦ A run can have at most MAX_CONCURRENT_FORCED forced cards at once.
//     If queue is full, excess cards are stacked and injected next tick.
//   ✦ ForcedCardQueue never emits EventBus events — CardUXBridge owns that.
//
// Density6 LLC · Point Zero One · Cards Engine · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import {
  ForcedCardSource,
  type CardDefinition,
  type CardInHand,
  type ForcedCardEntry,
} from './types';
import type { EventBus } from '../zero/EventBus';
import type { ModeOverlayEngine } from './ModeOverlayEngine';
import { getCardDefinition } from './CardRegistry';
import { v4 as uuidv4 } from 'uuid';

// ── MAX CONCURRENT FORCED CARDS ────────────────────────────────────────────────
// Prevents impossible "resolve 5 forced cards at once" situations.
const MAX_CONCURRENT_FORCED = 3;

// ── THREAT → CARD MAPPING ──────────────────────────────────────────────────────
// Maps TensionEngine threat types to CardRegistry cardIds.
// The threat type is embedded in the THREAT_ARRIVED payload's threatType field.

const THREAT_TO_CARD_MAP: Record<string, string> = {
  'MARKET_CRASH':         'fubar_market_crash_001',
  'EXPENSE_SPIKE':        'fubar_expense_spike_002',
  'REGULATORY_HIT':       'fubar_regulatory_hit_003',
  'MISSED_OPPORTUNITY':   'opp_missed_window_005',
  // Fallback for unmapped threat types
  DEFAULT:                'fubar_expense_spike_002',
};

// ── BOT ATTACK → CARD MAPPING ─────────────────────────────────────────────────
// Maps BattleEngine attack types to forced damage card IDs.
// These cards represent the mechanical consequence of a bot attack landing.

const ATTACK_TO_CARD_MAP: Record<string, string> = {
  'FINANCIAL_SABOTAGE':  'fubar_expense_spike_002',
  'EXPENSE_INJECTION':   'fubar_expense_spike_002',
  'DEBT_ATTACK':         'fubar_market_crash_001',
  'ASSET_STRIP':         'fubar_market_crash_001',
  'REPUTATION_ATTACK':   'fubar_regulatory_hit_003',
  'REGULATORY_ATTACK':   'fubar_regulatory_hit_003',
  'HATER_INJECTION':     'fubar_expense_spike_002',
  'OPPORTUNITY_KILL':    'opp_missed_window_005',
  DEFAULT:               'fubar_expense_spike_002',
};

// ── CASCADE → CARD MAPPING ────────────────────────────────────────────────────
const CASCADE_TO_CARD_MAP: Record<string, string> = {
  DEFAULT: 'fubar_expense_spike_002',
};

// ── PENDING INJECTION ─────────────────────────────────────────────────────────

export interface PendingInjection {
  readonly entryId:       string;
  readonly cardId:        string;
  readonly source:        ForcedCardSource;
  readonly sourceEventId: string;
  readonly injectedAtTick: number;
  readonly autoResolveChoice: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORCED CARD QUEUE
// ═══════════════════════════════════════════════════════════════════════════════

export class ForcedCardQueue {
  // ── State ───────────────────────────────────────────────────────────────────
  private entries:            Map<string, ForcedCardEntry> = new Map(); // entryId
  private pendingInjections:  PendingInjection[]           = [];
  private overflow:           PendingInjection[]           = [];       // held if hand is at max
  private activeForcedCount:  number                       = 0;

  // ── Deps ────────────────────────────────────────────────────────────────────
  private readonly eventBus:     EventBus;
  private readonly overlayEngine: ModeOverlayEngine;

  // ── Unsubscribe handles ─────────────────────────────────────────────────────
  private unsubThreat:   (() => void) | null = null;
  private unsubAttack:   (() => void) | null = null;
  private unsubCascade:  (() => void) | null = null;

  constructor(eventBus: EventBus, overlayEngine: ModeOverlayEngine) {
    this.eventBus     = eventBus;
    this.overlayEngine = overlayEngine;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION — subscribe to trigger events
  // ═══════════════════════════════════════════════════════════════════════════

  public init(): void {
    // Subscribe to TensionEngine threats
    this.unsubThreat = this.eventBus.on<any>('THREAT_ARRIVED' as any, (event) => {
      const payload = event.payload;
      const cardId = THREAT_TO_CARD_MAP[payload.threatType] ?? THREAT_TO_CARD_MAP.DEFAULT;
      this.enqueue(cardId, ForcedCardSource.TENSION_ENGINE, payload.threatId, 0);
    });

    // Subscribe to BattleEngine bot attacks
    this.unsubAttack = this.eventBus.on<any>('BOT_ATTACK_FIRED' as any, (event) => {
      const payload = event.payload;
      const cardId = ATTACK_TO_CARD_MAP[payload.attackType] ?? ATTACK_TO_CARD_MAP.DEFAULT;
      this.enqueue(cardId, ForcedCardSource.BATTLE_ENGINE, payload.attackId, 0);
    });

    // Subscribe to CascadeEngine link fires
    this.unsubCascade = this.eventBus.on<any>('CASCADE_LINK_FIRED' as any, (event) => {
      const payload = event.payload;
      const cardId = CASCADE_TO_CARD_MAP[payload.effectType] ?? CASCADE_TO_CARD_MAP.DEFAULT;
      this.enqueue(cardId, ForcedCardSource.CASCADE_ENGINE, payload.instanceId, 0);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENQUEUE — register a forced card for injection this tick
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Register a forced card injection. Enqueued immediately.
   * If MAX_CONCURRENT_FORCED is reached, card goes to overflow for next tick.
   *
   * @param cardId          - The CardRegistry card to materialize
   * @param source          - Which engine triggered this
   * @param sourceEventId   - The specific event ID (threatId / attackId)
   * @param tickIndex       - Current tick at time of enqueueing
   */
  public enqueue(
    cardId:         string,
    source:         ForcedCardSource,
    sourceEventId:  string,
    tickIndex:      number,
  ): string {
    const entryId = uuidv4();

    const injection: PendingInjection = {
      entryId,
      cardId,
      source,
      sourceEventId,
      injectedAtTick:    tickIndex,
      autoResolveChoice: 'AUTO_WORST',  // forced cards auto-resolve at max damage
    };

    if (this.activeForcedCount < MAX_CONCURRENT_FORCED) {
      this.pendingInjections.push(injection);
      this.activeForcedCount++;
    } else {
      // Overflow — inject next tick when active count drops
      this.overflow.push(injection);
    }

    return entryId;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROCESS TICK — called by CardEngine at tick Step 2
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Materialize all pending injections into CardInHand instances.
   * Returns injections ready for HandManager.injectCard() and
   * DecisionWindowManager.openWindow() in CardEngine.
   *
   * Also promotes overflow entries if room exists.
   *
   * @param tickIndex   - Current game tick
   * @returns           Array of materialized { card, entry } pairs
   */
  public processTick(tickIndex: number): Array<{ card: CardInHand; entry: ForcedCardEntry }> {
    const results: Array<{ card: CardInHand; entry: ForcedCardEntry }> = [];

    for (const injection of this.pendingInjections) {
      const card = this.materializeCard(injection, tickIndex);
      if (!card) continue;

      const entry: ForcedCardEntry = {
        entryId:        injection.entryId,
        cardId:         injection.cardId,
        sourceEngine:   injection.source,
        sourceEventId:  injection.sourceEventId,
        injectedAtTick: tickIndex,
        resolvedByTick: null,
        isResolved:     false,
      };

      this.entries.set(injection.entryId, entry);
      results.push({ card, entry });
    }

    this.pendingInjections = [];

    // Promote overflow entries up to the concurrent limit
    while (this.overflow.length > 0 && this.activeForcedCount < MAX_CONCURRENT_FORCED) {
      const next = this.overflow.shift()!;
      this.pendingInjections.push({ ...next, injectedAtTick: tickIndex });
      this.activeForcedCount++;
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RESOLVE — mark a forced card as resolved
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Mark a ForcedCardEntry as resolved. Decrements active count.
   * Called by CardEngine after the player resolves the forced card.
   *
   * @param entryId      - ForcedCardEntry.entryId
   * @param tickIndex    - Current tick
   */
  public resolve(entryId: string, tickIndex: number): boolean {
    const entry = this.entries.get(entryId);
    if (!entry || entry.isResolved) return false;

    // Mutation via cast — ForcedCardEntry is logically mutable post-creation
    (entry as any).isResolved    = true;
    (entry as any).resolvedByTick = tickIndex;

    this.activeForcedCount = Math.max(0, this.activeForcedCount - 1);
    return true;
  }

  /**
   * Resolve by card instanceId — convenience for CardEngine tick resolution.
   * Looks up the entry by matching injectedAtTick ← not reliable; use entryId where possible.
   */
  public resolveByCardId(cardId: string, tickIndex: number): boolean {
    for (const [entryId, entry] of this.entries) {
      if (entry.cardId === cardId && !entry.isResolved) {
        return this.resolve(entryId, tickIndex);
      }
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCESSORS
  // ═══════════════════════════════════════════════════════════════════════════

  public getActiveCount(): number {
    return this.activeForcedCount;
  }

  public getPendingCount(): number {
    return this.pendingInjections.length + this.overflow.length;
  }

  public getEntry(entryId: string): ForcedCardEntry | null {
    return this.entries.get(entryId) ?? null;
  }

  public getAllEntries(): ForcedCardEntry[] {
    return Array.from(this.entries.values());
  }

  public getUnresolvedEntries(): ForcedCardEntry[] {
    return Array.from(this.entries.values()).filter(e => !e.isResolved);
  }

  public hasOverflow(): boolean {
    return this.overflow.length > 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEARDOWN
  // ═══════════════════════════════════════════════════════════════════════════

  public destroy(): void {
    this.unsubThreat?.();
    this.unsubAttack?.();
    this.unsubCascade?.();
    this.unsubThreat  = null;
    this.unsubAttack  = null;
    this.unsubCascade = null;
  }

  public reset(): void {
    this.entries.clear();
    this.pendingInjections = [];
    this.overflow          = [];
    this.activeForcedCount = 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: MATERIALIZE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Resolve a cardId from CardRegistry and apply ModeOverlay to get a CardInHand.
   * Returns null if card is unknown or illegal in current mode.
   */
  private materializeCard(
    injection: PendingInjection,
    tickIndex: number,
  ): CardInHand | null {
    let def: CardDefinition;
    try {
      def = getCardDefinition(injection.cardId);
    } catch {
      console.error(`[ForcedCardQueue] Unknown cardId in injection: '${injection.cardId}'. Skipping.`);
      return null;
    }

    // Apply mode overlay — forced cards bypass the legal check in overlay
    // (they are always injected regardless of mode legality — engine-dictated)
    const card = this.overlayEngine.applyOverlay(def, tickIndex);
    if (!card) {
      // Mode rejected the card — use a raw bypass for forced cards
      // This handles edge cases where a FUBAR card might be mis-tagged as illegal
      const rawCard: CardInHand = {
        instanceId:       uuidv4() as string,
        definition:       def,
        overlay:          this.overlayEngine.mergeOverlay(def),
        drawnAtTick:      tickIndex,
        isForced:         true,
        isHeld:           false,
        isLegendary:      false,
        effectiveCost:    0,  // forced cards cost 0 — damage is automatic
        decisionWindowId: null,
      };
      return rawCard;
    }

    // Ensure isForced is true regardless of card definition
    return { ...card, isForced: true };
  }
}