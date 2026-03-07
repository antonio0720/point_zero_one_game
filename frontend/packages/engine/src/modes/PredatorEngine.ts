// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — PREDATOR ENGINE (ASYMMETRIC PVP)
// pzo-web/src/engines/modes/PredatorEngine.ts
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════
// PREDATOR: One player builds. One player is the Hater.
// The Hater fires financial sabotage cards in real time.
// The Builder gets a narrow counterplay window before each sabotage lands.
// Success trains the Builder to detect and neutralize financial attacks.
//
// PHASE 2 INTEGRATIONS (formerly game/modes/predator/):
//   ✦ ExtractionEngine         — tracks every extraction action fired by Hater
//                                with yield calculations, cooldown enforcement,
//                                and cumulative extraction ledger
//   ✦ BattleBudgetEngine       — Hater's finite action economy; each sabotage
//                                card costs budget; budget regens per tick;
//                                forces Hater to pace attacks strategically
//   ✦ CounterplayWindowEngine  — manages precise timing of the 6-tick counter
//                                window per sabotage; expiry callbacks; window
//                                chaining when multiple sabotages arrive close
//   ✦ PsycheMeter              — both players have a psych track (0–100);
//                                blocked sabotages raise Builder psych, landed
//                                sabotages lower it; Hater psych rises on landings;
//                                psych affects decision-window duration
//   ✦ SharedOpportunityDeck    — a neutral card pool both players draw from;
//                                cards flip opportunistically when specific
//                                financial conditions are met on the board
//   ✦ TempoChainTracker        — tracks consecutive blocked or landed sabotages;
//                                streaks unlock tempo bonuses and tempo reversal
//                                events that swap strategic advantage
//
// Original mechanics (unchanged):
//   ✦ Sabotage Deck + Counterplay Window
//   ✦ Hater Combo System + Battle Phases
//   ✦ Asymmetric Win Condition
//
// COMPATIBILITY NOTES:
//   ✦ All globalEventBus emit/subscribe calls unchanged.
//   ✦ ModeEventBridge translates to zero/EventBus as needed.
// ═══════════════════════════════════════════════════════════════════════════

import type {
  IGameModeEngine, RunMode, RunOutcome, ModeInitConfig,
  RunStateSnapshot, GameModeState, PZOEvent, SabotageCard, SabotageType,
} from '../core/types';
import { SABOTAGE_DECK }     from '../core/types';
import { globalEventBus }    from '../core/EventBus';
import type { LiveRunState } from '../core/RunStateSnapshot';

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACTION ENGINE
// ─────────────────────────────────────────────────────────────────────────────
// Models every income-stripping action the Hater takes.
// Each sabotage that LANDS is logged as an extraction with its yield —
// the actual income/cash removed from the Builder.
//
// ExtractionEngine also drives the Hater's "extraction efficiency" metric:
//   efficiency = totalExtracted / totalFireAttempts (0.0–1.0)
// A Hater with high efficiency has been landing most sabotages unblocked.
// Displayed on the post-run debrief so both players learn from it.
//
// Extraction also has diminishing returns — the more the Hater extracts,
// the harder it becomes to extract more on the same tick (simulates real
// immunity mechanisms a financial defense builds over time).

const EXTRACTION_DIMINISHING_BASE    = 0.92;  // each successive extraction this run decays yield
const EXTRACTION_GLOBAL_COOLDOWN     = 4;     // ticks between any two extractions (prevent spam)
const EXTRACTION_MAX_YIELD_PER_TICK  = 3500;  // hard cap — any single extraction tick

interface ExtractionRecord {
  id:           string;
  sabotageType: SabotageType;
  firedAtTick:  number;
  landedAtTick: number;
  grossYield:   number;    // what the card said it would extract
  netYield:     number;    // after diminishing returns applied
  blocked:      boolean;
}

class ExtractionEngine {
  private records:            ExtractionRecord[] = [];
  private totalExtracted:     number = 0;
  private totalFireAttempts:  number = 0;
  private lastExtractionTick: number = -EXTRACTION_GLOBAL_COOLDOWN;
  private runningYieldDecay:  number = 1.0;  // multiplied by EXTRACTION_DIMINISHING_BASE on each land

  reset(): void {
    this.records            = [];
    this.totalExtracted     = 0;
    this.totalFireAttempts  = 0;
    this.lastExtractionTick = -EXTRACTION_GLOBAL_COOLDOWN;
    this.runningYieldDecay  = 1.0;
  }

  recordFire(sabotageType: SabotageType, tick: number): string {
    this.totalFireAttempts++;
    const id = `ext_${tick}_${Math.random().toString(36).slice(2, 6)}`;
    this.records.push({
      id, sabotageType, firedAtTick: tick, landedAtTick: -1,
      grossYield: 0, netYield: 0, blocked: false,
    });
    return id;
  }

  recordLand(extractionId: string, landedAtTick: number, grossYield: number): number {
    const rec = this.records.find(r => r.id === extractionId);
    if (!rec) return 0;

    // Apply global cooldown — if too recent, zero yield
    if (landedAtTick - this.lastExtractionTick < EXTRACTION_GLOBAL_COOLDOWN) {
      rec.blocked = true;  // suppressed by cooldown, not by player
      return 0;
    }

    const netYield = Math.min(
      EXTRACTION_MAX_YIELD_PER_TICK,
      Math.floor(grossYield * this.runningYieldDecay),
    );

    rec.landedAtTick = landedAtTick;
    rec.grossYield   = grossYield;
    rec.netYield     = netYield;

    this.totalExtracted     += netYield;
    this.runningYieldDecay  *= EXTRACTION_DIMINISHING_BASE;
    this.lastExtractionTick  = landedAtTick;

    return netYield;
  }

  recordBlocked(extractionId: string): void {
    const rec = this.records.find(r => r.id === extractionId);
    if (rec) rec.blocked = true;
    // Blocked extractions reset diminishing return decay slightly
    this.runningYieldDecay = Math.min(1.0, this.runningYieldDecay + 0.04);
  }

  getEfficiency(): number {
    if (this.totalFireAttempts === 0) return 0;
    const landed = this.records.filter(r => r.landedAtTick > 0 && !r.blocked).length;
    return landed / this.totalFireAttempts;
  }

  getTotalExtracted(): number { return this.totalExtracted; }
  getRecords(): ReadonlyArray<ExtractionRecord> { return [...this.records]; }
  getLast(n: number): ExtractionRecord[] { return this.records.slice(-n); }
}

// ─────────────────────────────────────────────────────────────────────────────
// BATTLE BUDGET ENGINE
// ─────────────────────────────────────────────────────────────────────────────
// The Hater has a finite BATTLE BUDGET that depletes when they fire sabotage
// cards. Budget regenerates every tick at REGEN_PER_TICK, but premium sabotage
// cards cost more, forcing the Hater to pace their assault or wait for big plays.
//
// Budget tier thresholds change Hater AI behavior:
//   FLUSH  (≥ 80% max) — Hater is aggressive, chains high-cost cards
//   LOADED (≥ 50% max) — Standard play, normal card selection
//   LEAN   (≥ 25% max) — Conservative, only uses cheap sabotages
//   BROKE  (< 25% max) — Cannot fire any card above cost threshold
//
// The Builder can see the Hater's budget tier (not exact amount) in the HUD,
// allowing them to anticipate quiet periods vs incoming blitzes.

const BATTLE_BUDGET_MAX          = 200;
const BATTLE_BUDGET_REGEN_PER_TICK = 2;   // passive regen
const BATTLE_BUDGET_CARD_COSTS: Partial<Record<SabotageType, number>> = {
  FREEZE_INCOME:   40,
  PHANTOM_EXPENSE: 20,
  CREDIT_LOCK:     35,
  MARKET_RUMOR:    25,
  AUDIT_TRIGGER:   50,
  SHIELD_CORRODE:  30,
  OPPORTUNITY_SNIPE: 45,
  DEBT_INJECTION:  25,
};

type BattleBudgetTier = 'FLUSH' | 'LOADED' | 'LEAN' | 'BROKE';

class BattleBudgetEngine {
  private budget: number = BATTLE_BUDGET_MAX;

  reset(): void {
    this.budget = BATTLE_BUDGET_MAX;
  }

  tick(): void {
    this.budget = Math.min(BATTLE_BUDGET_MAX, this.budget + BATTLE_BUDGET_REGEN_PER_TICK);
  }

  canAfford(type: SabotageType): boolean {
    return this.budget >= (BATTLE_BUDGET_CARD_COSTS[type] ?? 20);
  }

  spend(type: SabotageType): boolean {
    const cost = BATTLE_BUDGET_CARD_COSTS[type] ?? 20;
    if (this.budget < cost) return false;
    this.budget -= cost;
    return true;
  }

  // Builder blocks a sabotage — Hater loses extra budget (wasted investment)
  penaltyForBlocked(type: SabotageType): void {
    const extraPenalty = Math.floor((BATTLE_BUDGET_CARD_COSTS[type] ?? 20) * 0.5);
    this.budget = Math.max(0, this.budget - extraPenalty);
  }

  getBudget(): number { return this.budget; }
  getMax():    number { return BATTLE_BUDGET_MAX; }
  getPct():    number { return this.budget / BATTLE_BUDGET_MAX; }

  getTier(): BattleBudgetTier {
    const pct = this.getPct();
    if (pct >= 0.80) return 'FLUSH';
    if (pct >= 0.50) return 'LOADED';
    if (pct >= 0.25) return 'LEAN';
    return 'BROKE';
  }

  // Returns only card types the Hater can currently afford
  getAffordableCards(deck: SabotageCard[]): SabotageCard[] {
    return deck.filter(c => this.canAfford(c.type));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COUNTERPLAY WINDOW ENGINE
// ─────────────────────────────────────────────────────────────────────────────
// Manages the precise timing and chaining of counterplay windows.
// Each incoming sabotage opens a 6-tick window.
// If a SECOND sabotage arrives while a window is open, it is queued into
// the CHAIN QUEUE and will open its own window when the first resolves.
//
// The Builder can only actively counter the FRONT-OF-QUEUE window at any time.
// Chained windows apply a COMPRESSION PENALTY — each successive chained window
// has its duration reduced by CHAIN_COMPRESSION_TICKS to simulate cognitive load.
//
// Chain length is tracked for TempoChainTracker integration.

const COUNTERPLAY_WINDOW_BASE_TICKS = 6;
const CHAIN_COMPRESSION_TICKS       = 1;   // each chained window is 1 tick shorter
const CHAIN_MINIMUM_TICKS           = 3;   // window cannot compress below 3 ticks
const CHAIN_QUEUE_MAX_SIZE          = 4;   // maximum queued windows

interface CounterWindowEntry {
  sabotageId:  string;
  type:        SabotageType;
  label:       string;
  windowTicks: number;      // ticks remaining for this window
  chainDepth:  number;      // 0 = first, 1 = second, etc.
}

class CounterplayWindowEngine {
  private activeWindow: CounterWindowEntry | null = null;
  private chainQueue:   CounterWindowEntry[]      = [];
  private chainDepth:   number                    = 0;  // how deep into current chain

  // Listeners
  private onWindowOpenCb:   ((entry: CounterWindowEntry) => void) | null = null;
  private onWindowCloseCb:  ((sabotageId: string, blocked: boolean) => void) | null = null;

  reset(): void {
    this.activeWindow = null;
    this.chainQueue   = [];
    this.chainDepth   = 0;
  }

  onWindowOpen(cb: (entry: CounterWindowEntry) => void): void {
    this.onWindowOpenCb = cb;
  }

  onWindowClose(cb: (sabotageId: string, blocked: boolean) => void): void {
    this.onWindowCloseCb = cb;
  }

  enqueue(sabotageId: string, type: SabotageType, label: string): void {
    const depth      = this.chainDepth + this.chainQueue.length;
    const windowTicks = Math.max(
      CHAIN_MINIMUM_TICKS,
      COUNTERPLAY_WINDOW_BASE_TICKS - depth * CHAIN_COMPRESSION_TICKS,
    );
    const entry: CounterWindowEntry = { sabotageId, type, label, windowTicks, chainDepth: depth };

    if (!this.activeWindow) {
      this.activateEntry(entry);
    } else if (this.chainQueue.length < CHAIN_QUEUE_MAX_SIZE) {
      this.chainQueue.push(entry);
    }
    // If queue full: sabotage lands without a window (overwhelming the Builder)
  }

  tick(): { expired: boolean; sabotageId: string | null } {
    if (!this.activeWindow) return { expired: false, sabotageId: null };

    this.activeWindow.windowTicks--;
    if (this.activeWindow.windowTicks <= 0) {
      const sabotageId = this.activeWindow.sabotageId;
      this.onWindowCloseCb?.(sabotageId, false);
      this.activeWindow = null;
      this.advanceChain();
      return { expired: true, sabotageId };
    }
    return { expired: false, sabotageId: null };
  }

  block(sabotageId: string): boolean {
    if (!this.activeWindow || this.activeWindow.sabotageId !== sabotageId) return false;
    this.onWindowCloseCb?.(sabotageId, true);
    this.activeWindow = null;
    this.chainDepth   = 0;  // chain resets on successful block
    this.chainQueue   = []; // clear pending chain — successful defense disperses pressure
    return true;
  }

  getActive(): CounterWindowEntry | null { return this.activeWindow; }
  getQueuedCount(): number { return this.chainQueue.length; }
  isOpen(): boolean { return this.activeWindow !== null; }

  private activateEntry(entry: CounterWindowEntry): void {
    this.activeWindow = entry;
    this.chainDepth   = entry.chainDepth;
    this.onWindowOpenCb?.(entry);
  }

  private advanceChain(): void {
    if (this.chainQueue.length > 0) {
      this.activateEntry(this.chainQueue.shift()!);
    } else {
      this.chainDepth = 0;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PSYCH METER
// ─────────────────────────────────────────────────────────────────────────────
// Both Builder and Hater have a psych track from 0–100.
// Psych directly modifies decision-window duration:
//   • High Builder psych (≥70) → windows 20% longer
//   • Low Builder psych (≤30)  → windows 20% shorter
//   • High Hater psych (≥70)   → AI fires sabotages more frequently
//
// Psych changes are narrative triggers — they emit events read by the HUD
// to show momentum swings to the player. In multiplayer, both psych meters
// are synced so each player sees how their mental game is performing.
//
// Psych naturally drifts back toward NEUTRAL (50) at PASSIVE_DRIFT_PER_TICK.

const PSYCH_NEUTRAL            = 50;
const PSYCH_MAX                = 100;
const PSYCH_MIN                = 0;
const PSYCH_PASSIVE_DRIFT      = 0.3;   // per tick drift toward neutral
const PSYCH_BLOCK_BUILDER_GAIN = 12;    // Builder blocks a sabotage
const PSYCH_LAND_BUILDER_LOSS  = 10;    // Sabotage lands on Builder
const PSYCH_LAND_HATER_GAIN    = 8;     // Sabotage lands (Hater perspective)
const PSYCH_BLOCK_HATER_LOSS   = 15;    // Hater's sabotage blocked

class PsycheMeter {
  private builderPsych: number = PSYCH_NEUTRAL;
  private haterPsych:   number = PSYCH_NEUTRAL;

  reset(): void {
    this.builderPsych = PSYCH_NEUTRAL;
    this.haterPsych   = PSYCH_NEUTRAL;
  }

  tick(): void {
    // Passive drift toward neutral
    this.builderPsych += (PSYCH_NEUTRAL - this.builderPsych) * PSYCH_PASSIVE_DRIFT * 0.02;
    this.haterPsych   += (PSYCH_NEUTRAL - this.haterPsych)   * PSYCH_PASSIVE_DRIFT * 0.02;
  }

  onSabotageBlocked(): void {
    this.builderPsych = Math.min(PSYCH_MAX, this.builderPsych + PSYCH_BLOCK_BUILDER_GAIN);
    this.haterPsych   = Math.max(PSYCH_MIN, this.haterPsych   - PSYCH_BLOCK_HATER_LOSS);
  }

  onSabotageLanded(): void {
    this.builderPsych = Math.max(PSYCH_MIN, this.builderPsych - PSYCH_LAND_BUILDER_LOSS);
    this.haterPsych   = Math.min(PSYCH_MAX, this.haterPsych   + PSYCH_LAND_HATER_GAIN);
  }

  getBuilderPsych(): number { return Math.round(this.builderPsych); }
  getHaterPsych():   number { return Math.round(this.haterPsych); }

  // Decision window duration multiplier for Builder
  getBuilderWindowMult(): number {
    if (this.builderPsych >= 70) return 1.2;
    if (this.builderPsych <= 30) return 0.8;
    return 1.0;
  }

  // AI fire interval modifier for Hater
  getHaterAIIntervalMult(): number {
    if (this.haterPsych >= 70) return 0.80;  // fires more often
    if (this.haterPsych <= 30) return 1.20;  // fires less often (demoralized)
    return 1.0;
  }

  getBuilderMomentumLabel(): string {
    if (this.builderPsych >= 80) return 'LOCKED_IN';
    if (this.builderPsych >= 60) return 'FOCUSED';
    if (this.builderPsych >= 40) return 'NEUTRAL';
    if (this.builderPsych >= 20) return 'RATTLED';
    return 'CRACKING';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED OPPORTUNITY DECK
// ─────────────────────────────────────────────────────────────────────────────
// A neutral pool of 12 OPPORTUNITY cards that sit face-up on the table.
// Either player can claim an opportunity card when the trigger condition fires.
// Trigger conditions are board-state-based (income thresholds, shield state, etc.).
//
// Once claimed, the opportunity is removed from the pool and its effect fires
// immediately. The pool replenishes one card every 60 ticks from the reserve.
//
// This creates a shared contested space — both players watch the same deck
// and race to claim high-value cards when conditions align.

interface OpportunityCard {
  id:              string;
  label:           string;
  description:     string;
  claimableBy:     'builder' | 'hater' | 'either';
  triggerCondition: (snapshot: RunStateSnapshot) => boolean;
  incomeBonus:     number;   // applied to claimer's income
  expenseRelief:   number;   // applied to claimer's expenses
  heatDelta:       number;   // applied to hater heat (negative = reduces heat)
  cooldownTicks:   number;   // after claimed, card returns after this many ticks
}

const SHARED_OPPORTUNITY_CARDS: OpportunityCard[] = [
  {
    id: 'opp_market_dip',
    label: 'Market Dip Buy',
    description: 'Claim when your cashflow is negative — reverse it with a buy-low.',
    claimableBy: 'builder',
    triggerCondition: (s) => s.income < s.expenses,
    incomeBonus: 600, expenseRelief: 0, heatDelta: 0, cooldownTicks: 90,
  },
  {
    id: 'opp_chaos_extract',
    label: 'Chaos Extraction',
    description: 'Claim when Builder shields are below 50% — amplify the damage.',
    claimableBy: 'hater',
    triggerCondition: (s) => (s.shields?.overallIntegrityPct ?? 1.0) < 0.50,
    incomeBonus: 0, expenseRelief: 0, heatDelta: 15, cooldownTicks: 72,
  },
  {
    id: 'opp_network_surge',
    label: 'Network Surge',
    description: 'Claim when income has been positive for 5+ ticks.',
    claimableBy: 'builder',
    triggerCondition: (s) => s.income > s.expenses * 1.2,
    incomeBonus: 800, expenseRelief: 0, heatDelta: -5, cooldownTicks: 60,
  },
  {
    id: 'opp_exploit_gap',
    label: 'Exploit The Gap',
    description: 'Claim when there is no active counterplay window — free hit.',
    claimableBy: 'hater',
    triggerCondition: (_s) => true,  // Always available — but Hater must declare it manually
    incomeBonus: 0, expenseRelief: 0, heatDelta: 20, cooldownTicks: 48,
  },
  {
    id: 'opp_stability_bond',
    label: 'Stability Bond',
    description: 'Claim when all shields above 60% — lock in a stability bonus.',
    claimableBy: 'either',
    triggerCondition: (s) => (s.shields?.overallIntegrityPct ?? 0) > 0.60,
    incomeBonus: 400, expenseRelief: 200, heatDelta: -8, cooldownTicks: 120,
  },
  {
    id: 'opp_distress_signal',
    label: 'Distress Signal',
    description: 'Claim when cash is critically low — emergency capital injection.',
    claimableBy: 'builder',
    triggerCondition: (s) => s.cash < 5000,
    incomeBonus: 0, expenseRelief: 1000, heatDelta: 0, cooldownTicks: 100,
  },
];

interface OpportunitySlot {
  card:          OpportunityCard;
  availableAt:   number;   // tick when this slot becomes available
  claimed:       boolean;
  claimedAtTick: number;
  claimedBy:     'builder' | 'hater' | null;
}

class SharedOpportunityDeck {
  private slots:       OpportunitySlot[] = [];
  private activePool:  OpportunityCard[] = [];

  reset(): void {
    this.slots      = [];
    this.activePool = [...SHARED_OPPORTUNITY_CARDS];
    // Initialize pool with first 4 cards
    for (let i = 0; i < Math.min(4, this.activePool.length); i++) {
      this.slots.push({
        card:          this.activePool[i]!,
        availableAt:   0,
        claimed:       false,
        claimedAtTick: -1,
        claimedBy:     null,
      });
    }
  }

  tick(snapshot: RunStateSnapshot): OpportunityCard[] {
    const triggeredAndUnclaimed: OpportunityCard[] = [];
    for (const slot of this.slots) {
      if (!slot.claimed && snapshot.tick >= slot.availableAt) {
        if (slot.card.triggerCondition(snapshot)) {
          triggeredAndUnclaimed.push(slot.card);
        }
      }
    }
    // Replenish: re-add claimed cards after their cooldown
    for (const slot of this.slots) {
      if (slot.claimed && snapshot.tick >= slot.claimedAtTick + slot.card.cooldownTicks) {
        slot.claimed       = false;
        slot.claimedBy     = null;
        slot.claimedAtTick = -1;
        slot.availableAt   = snapshot.tick;
      }
    }
    return triggeredAndUnclaimed;
  }

  claim(cardId: string, by: 'builder' | 'hater', tick: number): OpportunityCard | null {
    const slot = this.slots.find(s => s.card.id === cardId && !s.claimed);
    if (!slot) return null;
    // Verify claimer role matches
    if (slot.card.claimableBy !== 'either' && slot.card.claimableBy !== by) return null;
    slot.claimed       = true;
    slot.claimedBy     = by;
    slot.claimedAtTick = tick;
    return slot.card;
  }

  getAvailableForRole(role: 'builder' | 'hater', snapshot: RunStateSnapshot): OpportunityCard[] {
    return this.slots
      .filter(s =>
        !s.claimed &&
        snapshot.tick >= s.availableAt &&
        (s.card.claimableBy === 'either' || s.card.claimableBy === role) &&
        s.card.triggerCondition(snapshot),
      )
      .map(s => s.card);
  }

  getPoolSnapshot(): Array<{ card: OpportunityCard; available: boolean; claimedBy: string | null }> {
    return this.slots.map(s => ({
      card:      s.card,
      available: !s.claimed,
      claimedBy: s.claimedBy,
    }));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPO CHAIN TRACKER
// ─────────────────────────────────────────────────────────────────────────────
// Records consecutive successful blocks (Builder streak) and consecutive landed
// sabotages (Hater streak) to identify TEMPO shifts — moments when strategic
// advantage swings from one player to the other.
//
// When a streak reaches a threshold:
//   BUILDER STREAK ≥ 3 → TEMPO REVERSAL: Builder earns a free income boost
//   HATER STREAK ≥ 3   → TEMPO DOMINATION: Hater's next card costs 50% less budget
//
// Tempo events are emitted on the event bus so both the HUD and CardEngine
// can react (the card draw system gives special tempo-bonus cards on reversals).
//
// Streaks are broken whenever the opposing event occurs.

const BUILDER_STREAK_THRESHOLD  = 3;
const HATER_STREAK_THRESHOLD    = 3;
const TEMPO_REVERSAL_BONUS      = 500;    // income bonus on Builder tempo reversal
const TEMPO_DOMINATION_DISCOUNT = 0.50;  // Hater budget cost multiplier on domination

interface TempoEvent {
  type:  'BUILDER_TEMPO_REVERSAL' | 'HATER_TEMPO_DOMINATION';
  tick:  number;
  label: string;
}

class TempoChainTracker {
  private builderStreak:    number = 0;
  private haterStreak:      number = 0;
  private tempoEvents:      TempoEvent[] = [];
  private dominationActive: boolean = false;   // hater budget discount active this tick

  reset(): void {
    this.builderStreak    = 0;
    this.haterStreak      = 0;
    this.tempoEvents      = [];
    this.dominationActive = false;
  }

  onBlock(tick: number): TempoEvent | null {
    this.builderStreak++;
    this.haterStreak    = 0;
    this.dominationActive = false;

    if (this.builderStreak >= BUILDER_STREAK_THRESHOLD) {
      this.builderStreak = 0;   // reset after firing
      const event: TempoEvent = {
        type:  'BUILDER_TEMPO_REVERSAL',
        tick,
        label: `Tempo Reversal! ${BUILDER_STREAK_THRESHOLD} consecutive blocks — income bonus: +$${TEMPO_REVERSAL_BONUS.toLocaleString()}`,
      };
      this.tempoEvents.push(event);
      return event;
    }
    return null;
  }

  onLand(tick: number): TempoEvent | null {
    this.haterStreak++;
    this.builderStreak = 0;

    if (this.haterStreak >= HATER_STREAK_THRESHOLD) {
      this.haterStreak      = 0;
      this.dominationActive = true;  // next sabotage budget cost halved
      const event: TempoEvent = {
        type:  'HATER_TEMPO_DOMINATION',
        tick,
        label: `Tempo Domination! ${HATER_STREAK_THRESHOLD} consecutive landings — next sabotage costs 50% less budget`,
      };
      this.tempoEvents.push(event);
      return event;
    }
    return null;
  }

  consumeDomination(): boolean {
    if (!this.dominationActive) return false;
    this.dominationActive = false;
    return true;
  }

  isDominationActive(): boolean { return this.dominationActive; }
  getBuilderStreak():   number  { return this.builderStreak; }
  getHaterStreak():     number  { return this.haterStreak; }
  getTempoEvents():     ReadonlyArray<TempoEvent> { return [...this.tempoEvents]; }
}

// ─────────────────────────────────────────────────────────────────────────────
// ORIGINAL TYPES (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

interface QueuedSabotage {
  id:            string;
  card:          SabotageCard;
  extractionId:  string;   // Phase 2: linked to ExtractionEngine record
  firedAtTick:   number;
  arrivesAtTick: number;
  blocked:       boolean;
  landed:        boolean;
}

interface ActiveSabotageEffect {
  id:        string;
  type:      SabotageType;
  startTick: number;
  endTick:   number;
  magnitude: number;
  label:     string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export class PredatorEngine implements IGameModeEngine {
  public readonly mode: RunMode = 'asymmetric-pvp';
  public readonly runId: string;

  private liveStateRef:  LiveRunState | null = null;
  private config:        ModeInitConfig | null = null;
  private eventHandlers: Array<() => void> = [];

  // Original state
  private localRole:            'builder' | 'hater' = 'builder';
  private sabotageDeck:         SabotageCard[] = [];
  private sabotageQueue:        QueuedSabotage[] = [];
  private activeEffects:        ActiveSabotageEffect[] = [];
  private cardCooldowns:        Map<string, number> = new Map();
  private haterComboCount:      number = 0;
  private builderNetWorth:      number = 0;
  private builderShieldPct:     number = 1.0;
  private phase: 'early' | 'mid' | 'endgame' = 'early';

  // Phase 2: subsystems
  private extractionEngine:       ExtractionEngine;
  private battleBudgetEngine:     BattleBudgetEngine;
  private counterplayWindowEngine: CounterplayWindowEngine;
  private psycheMeter:            PsycheMeter;
  private sharedOpportunityDeck:  SharedOpportunityDeck;
  private tempoChainTracker:      TempoChainTracker;

  constructor() {
    this.runId = `predator_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.extractionEngine        = new ExtractionEngine();
    this.battleBudgetEngine      = new BattleBudgetEngine();
    this.counterplayWindowEngine = new CounterplayWindowEngine();
    this.psycheMeter             = new PsycheMeter();
    this.sharedOpportunityDeck   = new SharedOpportunityDeck();
    this.tempoChainTracker       = new TempoChainTracker();

    // Wire counterplay window callbacks
    this.counterplayWindowEngine.onWindowOpen((entry) => {
      globalEventBus.emit('SHIELD_DAMAGED', 0, {
        label:       `INCOMING: ${entry.label}`,
        windowTicks: entry.windowTicks,
        chainDepth:  entry.chainDepth,
        sabotageId:  entry.sabotageId,
        message:     `${entry.label} incoming. ${entry.windowTicks} ticks to counter. Chain depth: ${entry.chainDepth}`,
      });
    });

    this.counterplayWindowEngine.onWindowClose((sabotageId, blocked) => {
      if (!blocked) {
        // Window expired — find and apply the sabotage
        const sab = this.sabotageQueue.find(s => s.id === sabotageId);
        if (sab && !sab.landed && !sab.blocked) {
          this.applyLandedSabotage(sab, { tick: this.liveStateRef?.tick ?? 0 } as RunStateSnapshot);
          this.haterComboCount++;
          const tempo = this.tempoChainTracker.onLand(this.liveStateRef?.tick ?? 0);
          this.psycheMeter.onSabotageLanded();
          const netYield = this.extractionEngine.recordLand(
            sab.extractionId, this.liveStateRef?.tick ?? 0, sab.card.magnitude,
          );
          globalEventBus.emit('SABOTAGE_FIRED', this.liveStateRef?.tick ?? 0, {
            sabotageId:  sab.id,
            type:        sab.card.type,
            blocked:     false,
            comboCount:  this.haterComboCount,
            label:       sab.card.label,
            netYield,
          });
          if (tempo) {
            globalEventBus.emit('TEMPO_SHIFT', tempo.tick, { type: tempo.type, label: tempo.label });
          }
        }
      }
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═════════════════════════════════════════════════════════════════════════

  public init(config: ModeInitConfig): void {
    this.config    = config;
    this.localRole = config.localRole ?? 'builder';

    this.sabotageDeck         = [...SABOTAGE_DECK];
    this.sabotageQueue        = [];
    this.activeEffects        = [];
    this.haterComboCount      = 0;
    this.builderNetWorth      = config.startingCash;
    this.builderShieldPct     = 1.0;
    this.phase                = 'early';
    this.cardCooldowns        = new Map();

    // Phase 2: reset subsystems
    this.extractionEngine.reset();
    this.battleBudgetEngine.reset();
    this.counterplayWindowEngine.reset();
    this.psycheMeter.reset();
    this.sharedOpportunityDeck.reset();
    this.tempoChainTracker.reset();

    this.eventHandlers.push(
      globalEventBus.on('SHIELD_LAYER_BREACHED', (e) => this.onShieldBreached(e)),
      globalEventBus.on('CASH_CHANGED',          (e) => this.onCashChanged(e)),
    );

    globalEventBus.emitImmediate('RUN_STARTED', 0, {
      mode:     'asymmetric-pvp',
      label:    'PREDATOR',
      runId:    this.runId,
      role:     this.localRole,
      message: this.localRole === 'builder'
        ? 'Someone wants you to fail. They have a deck designed to destroy you. Build faster than they can sabotage.'
        : 'The Builder is growing. Your job is to collapse their income before they reach FREEDOM.',
    });
  }

  public onTick(snapshot: RunStateSnapshot): void {
    const tick = snapshot.tick;

    // ── 1. Battle phase ────────────────────────────────────────────────────
    if (tick >= 480) this.phase = 'endgame';
    else if (tick >= 240) this.phase = 'mid';

    // ── 2. Phase 2: Regen battle budget ───────────────────────────────────
    this.battleBudgetEngine.tick();

    // ── 3. Phase 2: Tick psych meter ──────────────────────────────────────
    this.psycheMeter.tick();

    // ── 4. Phase 2: Tick counterplay window engine ────────────────────────
    this.counterplayWindowEngine.tick();

    // ── 5. Process incoming sabotages from queue ──────────────────────────
    const arriving = this.sabotageQueue.filter(
      s => s.arrivesAtTick === tick && !s.landed && !s.blocked,
    );
    for (const sab of arriving) {
      this.counterplayWindowEngine.enqueue(sab.id, sab.card.type, sab.card.label);
    }

    // ── 6. Tick active effects ─────────────────────────────────────────────
    this.tickActiveEffects(snapshot);

    // ── 7. Hater AI (if applicable) ────────────────────────────────────────
    if (this.localRole === 'hater' || this.config?.haterPlayerId === 'AI') {
      this.tickHaterAI(snapshot);
    }

    // ── 8. Phase 2: Shared opportunity deck ───────────────────────────────
    const triggeredOpps = this.sharedOpportunityDeck.tick(snapshot);
    if (triggeredOpps.length > 0) {
      globalEventBus.emit('OPPORTUNITY_AVAILABLE', tick, {
        cards:   triggeredOpps.map(c => ({ id: c.id, label: c.label, claimableBy: c.claimableBy })),
        message: `${triggeredOpps.length} opportunity card(s) available. Claim before conditions change.`,
      });
    }

    // ── 9. Sync builder state mirror ──────────────────────────────────────
    this.builderNetWorth  = snapshot.netWorth;
    this.builderShieldPct = snapshot.shields?.overallIntegrityPct ?? 1.0;

    // ── 10. Hater combo decay ─────────────────────────────────────────────
    if (tick % 36 === 0 && this.haterComboCount > 0) {
      this.haterComboCount = Math.max(0, this.haterComboCount - 1);
    }
  }

  public onRunEnd(outcome: RunOutcome): void {
    const builderWon = outcome === 'FREEDOM' || outcome === 'TIMEOUT';
    globalEventBus.emitImmediate('RUN_ENDED', this.liveStateRef?.tick ?? 0, {
      outcome,
      runId:              this.runId,
      builderWon,
      haterComboCount:    this.haterComboCount,
      extractionEfficiency: this.extractionEngine.getEfficiency(),
      totalExtracted:     this.extractionEngine.getTotalExtracted(),
      builderStreak:      this.tempoChainTracker.getBuilderStreak(),
      haterStreak:        this.tempoChainTracker.getHaterStreak(),
      tempoEvents:        this.tempoChainTracker.getTempoEvents(),
      builderFinalPsych:  this.psycheMeter.getBuilderPsych(),
      message: builderWon
        ? 'The Builder survived the sabotage. Unbreakable.'
        : "The Hater's extraction machine won. The Builder's defenses weren't enough.",
    });
    this.eventHandlers.forEach(unsub => unsub());
    this.eventHandlers = [];
  }

  public getState(): GameModeState {
    return {
      mode: 'asymmetric-pvp',
      predator: {
        localRole:              this.localRole,
        builderNetWorth:        this.builderNetWorth,
        haterSabotageAmmo:      this.getAvailableSabotageCount(this.liveStateRef?.tick ?? 0),
        counterplayWindow:      this.counterplayWindowEngine.isOpen(),
        counterplayTicksLeft:   this.counterplayWindowEngine.getActive()?.windowTicks ?? 0,
        counterplayChainQueued: this.counterplayWindowEngine.getQueuedCount(),
        haterComboCount:        this.haterComboCount,
        builderShieldPct:       this.builderShieldPct,
        phase:                  this.phase,
        // Phase 2 state
        battleBudget:           this.battleBudgetEngine.getBudget(),
        battleBudgetTier:       this.battleBudgetEngine.getTier(),
        builderPsych:           this.psycheMeter.getBuilderPsych(),
        haterPsych:             this.psycheMeter.getHaterPsych(),
        builderMomentum:        this.psycheMeter.getBuilderMomentumLabel(),
        builderTempoStreak:     this.tempoChainTracker.getBuilderStreak(),
        haterTempoStreak:       this.tempoChainTracker.getHaterStreak(),
        extractionEfficiency:   this.extractionEngine.getEfficiency(),
        totalExtracted:         this.extractionEngine.getTotalExtracted(),
        lastExtractions:        this.extractionEngine.getLast(3),
        opportunityPool:        this.sharedOpportunityDeck.getPoolSnapshot(),
      },
    };
  }

  public subscribe(handler: (event: PZOEvent) => void): () => void {
    const u1 = globalEventBus.on('SABOTAGE_FIRED',        handler);
    const u2 = globalEventBus.on('SABOTAGE_BLOCKED',      handler);
    const u3 = globalEventBus.on('TEMPO_SHIFT',           handler);
    const u4 = globalEventBus.on('OPPORTUNITY_AVAILABLE', handler);
    return () => { u1(); u2(); u3(); u4(); };
  }

  public setLiveStateRef(ref: LiveRunState): void {
    this.liveStateRef = ref;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PUBLIC API: PLAYER ACTIONS
  // ═════════════════════════════════════════════════════════════════════════

  /** Hater fires a sabotage card. Checks battle budget before queuing. */
  public fireSabotage(cardId: string, currentTick: number): boolean {
    if (this.localRole !== 'hater') return false;
    const card = this.sabotageDeck.find(c => c.id === cardId);
    if (!card) return false;

    const cooldownUntil = this.cardCooldowns.get(cardId) ?? 0;
    if (currentTick < cooldownUntil) return false;

    // Phase 2: check battle budget — apply domination discount if active
    const discount = this.tempoChainTracker.consumeDomination() ? TEMPO_DOMINATION_DISCOUNT : 1.0;
    const canAfford = this.battleBudgetEngine.canAfford(card.type) || discount < 1.0;
    if (!canAfford) return false;

    this.battleBudgetEngine.spend(card.type);

    const extractionId = this.extractionEngine.recordFire(card.type, currentTick);
    const sab: QueuedSabotage = {
      id:            `sab_${Date.now()}`,
      card,
      extractionId,
      firedAtTick:   currentTick,
      arrivesAtTick: currentTick + 6,
      blocked:       false,
      landed:        false,
    };

    this.sabotageQueue.push(sab);
    this.cardCooldowns.set(cardId, currentTick + card.cooldownTicks);

    globalEventBus.emit('SABOTAGE_FIRED', currentTick, {
      sabotageId:  sab.id,
      type:        card.type,
      arrivesAt:   sab.arrivesAtTick,
      label:       card.label,
      budgetLeft:  this.battleBudgetEngine.getBudget(),
      budgetTier:  this.battleBudgetEngine.getTier(),
      message:     `${card.label} incoming. Builder has 6 ticks to respond.`,
    });
    return true;
  }

  /** Builder blocks an incoming sabotage during counterplay window. */
  public blockSabotage(sabotageId: string, currentTick: number): boolean {
    if (this.localRole !== 'builder') return false;
    if (!this.counterplayWindowEngine.isOpen()) return false;

    const sab = this.sabotageQueue.find(s => s.id === sabotageId && !s.landed && !s.blocked);
    if (!sab) return false;

    const blocked = this.counterplayWindowEngine.block(sabotageId);
    if (!blocked) return false;

    sab.blocked = true;
    this.haterComboCount = 0;

    // Phase 2: update all subsystems on block
    this.battleBudgetEngine.penaltyForBlocked(sab.card.type);
    this.extractionEngine.recordBlocked(sab.extractionId);
    this.psycheMeter.onSabotageBlocked();
    const tempo = this.tempoChainTracker.onBlock(currentTick);

    globalEventBus.emit('SABOTAGE_BLOCKED', currentTick, {
      sabotageId,
      type:          sab.card.type,
      label:         sab.card.label,
      builderPsych:  this.psycheMeter.getBuilderPsych(),
      builderStreak: this.tempoChainTracker.getBuilderStreak(),
      message:       'Defense deployed. Sabotage neutralized before impact.',
    });

    if (tempo) {
      // Builder tempo reversal — apply income bonus
      if (this.liveStateRef) {
        this.liveStateRef.income = Math.floor(this.liveStateRef.income + TEMPO_REVERSAL_BONUS);
      }
      globalEventBus.emit('TEMPO_SHIFT', currentTick, {
        type:    tempo.type,
        label:   tempo.label,
        bonus:   TEMPO_REVERSAL_BONUS,
        message: `TEMPO REVERSAL — Builder earns +$${TEMPO_REVERSAL_BONUS.toLocaleString()} income.`,
      });
    }

    return true;
  }

  /** Claim an opportunity card from the shared deck. */
  public claimOpportunity(cardId: string, currentTick: number): boolean {
    const role = this.localRole;
    const card = this.sharedOpportunityDeck.claim(cardId, role, currentTick);
    if (!card) return false;

    const live = this.liveStateRef;
    if (live) {
      live.income   = Math.max(0, live.income   + card.incomeBonus);
      live.expenses = Math.max(0, live.expenses - card.expenseRelief);
      if (card.heatDelta !== 0) {
        live.haterHeat = Math.max(0, Math.min(100, live.haterHeat + card.heatDelta));
      }
    }

    globalEventBus.emit('OPPORTUNITY_CLAIMED', currentTick, {
      cardId,
      label:       card.label,
      claimedBy:   role,
      incomeBonus: card.incomeBonus,
      message:     `${role === 'builder' ? 'Builder' : 'Hater'} claimed: ${card.label}.`,
    });
    return true;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PRIVATE: SABOTAGE APPLICATION
  // ═════════════════════════════════════════════════════════════════════════

  private applyLandedSabotage(sab: QueuedSabotage, snapshot: RunStateSnapshot): void {
    sab.landed = true;
    const live = this.liveStateRef;
    if (!live) return;

    const comboMult = 1 + (this.haterComboCount * 0.25);
    const effect: ActiveSabotageEffect = {
      id:        `eff_${sab.id}`,
      type:      sab.card.type,
      startTick: snapshot.tick,
      endTick:   snapshot.tick + sab.card.durationTicks,
      magnitude: sab.card.magnitude * comboMult,
      label:     sab.card.label,
    };

    switch (sab.card.type) {
      case 'FREEZE_INCOME':
        live.income = 0;
        this.activeEffects.push(effect);
        break;
      case 'PHANTOM_EXPENSE':
        live.expenses += effect.magnitude;
        this.activeEffects.push(effect);
        break;
      case 'CREDIT_LOCK':
        live.shields.layers.L2_CREDIT_LINE.regenActive = false;
        this.activeEffects.push(effect);
        break;
      case 'MARKET_RUMOR':
        live.income = Math.floor(live.income * effect.magnitude);
        this.activeEffects.push(effect);
        break;
      case 'AUDIT_TRIGGER':
        live.cash = Math.max(0, live.cash - effect.magnitude);
        break;
      case 'SHIELD_CORRODE':
        this.activeEffects.push(effect);
        break;
      case 'OPPORTUNITY_SNIPE':
        globalEventBus.emit('INCOME_CHANGED', snapshot.tick, {
          delta: -500, reason: 'Opportunity sniped — income card destroyed',
        });
        break;
      case 'DEBT_INJECTION':
        live.expenses += effect.magnitude;
        break;
    }

    globalEventBus.emit('EXPENSE_CHANGED', snapshot.tick, {
      label: `Sabotage landed: ${sab.card.label}`, magnitude: comboMult,
    });
  }

  private tickActiveEffects(snapshot: RunStateSnapshot): void {
    const live = this.liveStateRef;
    if (!live) return;

    const expired: string[] = [];
    for (const eff of this.activeEffects) {
      if (snapshot.tick > eff.endTick) {
        expired.push(eff.id);
        switch (eff.type) {
          case 'FREEZE_INCOME':
            live.income = snapshot.income + 0;
            break;
          case 'PHANTOM_EXPENSE':
            live.expenses = Math.max(0, live.expenses - eff.magnitude);
            break;
          case 'CREDIT_LOCK':
            live.shields.layers.L2_CREDIT_LINE.regenActive = true;
            break;
          case 'MARKET_RUMOR':
            live.income = Math.floor(live.income / eff.magnitude);
            break;
        }
      } else if (eff.type === 'SHIELD_CORRODE') {
        const weakest = this.findWeakestLayer(live);
        const layer = live.shields.layers[weakest];
        layer.current = Math.max(0, layer.current - 8);
      }
    }
    this.activeEffects = this.activeEffects.filter(e => !expired.includes(e.id));
  }

  private tickHaterAI(snapshot: RunStateSnapshot): void {
    // Phase 2: psych meter modifies Hater fire interval
    const baseInterval = this.phase === 'endgame' ? 16 : this.phase === 'mid' ? 20 : 28;
    const fireInterval = Math.round(baseInterval * this.psycheMeter.getHaterAIIntervalMult());

    if (snapshot.tick % fireInterval !== 0 || snapshot.tick === 0) return;

    // Phase 2: only fire cards the budget can afford
    const affordable = this.battleBudgetEngine.getAffordableCards(
      this.sabotageDeck.filter(c => snapshot.tick >= (this.cardCooldowns.get(c.id) ?? 0)),
    );
    if (affordable.length === 0) return;

    const shieldPct = snapshot.shields?.overallIntegrityPct ?? 1.0;
    let target: SabotageCard;
    if (shieldPct > 0.7) {
      target = affordable.find(c => c.type === 'FREEZE_INCOME') ?? affordable[0]!;
    } else if (shieldPct < 0.3) {
      target = affordable.find(c => c.type === 'AUDIT_TRIGGER') ?? affordable[0]!;
    } else {
      target = affordable[Math.floor(Math.random() * affordable.length)]!;
    }

    // Spend budget (domination discount applied if active)
    const discount = this.tempoChainTracker.consumeDomination() ? TEMPO_DOMINATION_DISCOUNT : 1.0;
    if (discount < 1.0 || this.battleBudgetEngine.spend(target.type)) {
      this.cardCooldowns.set(target.id, snapshot.tick + target.cooldownTicks);
      const extractionId = this.extractionEngine.recordFire(target.type, snapshot.tick);
      const sab: QueuedSabotage = {
        id:            `ai_sab_${snapshot.tick}`,
        card:          target,
        extractionId,
        firedAtTick:   snapshot.tick,
        arrivesAtTick: snapshot.tick + 6,
        blocked:       false,
        landed:        false,
      };
      this.sabotageQueue.push(sab);

      globalEventBus.emit('SABOTAGE_FIRED', snapshot.tick, {
        sabotageId:  sab.id,
        type:        target.type,
        arrivesAt:   sab.arrivesAtTick,
        label:       target.label,
        isAI:        true,
        budgetLeft:  this.battleBudgetEngine.getBudget(),
        message:     `AI Hater fires: ${target.label}. You have 6 ticks.`,
      });
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PRIVATE: HELPERS
  // ═════════════════════════════════════════════════════════════════════════

  private getAvailableSabotageCount(tick: number): number {
    return this.sabotageDeck.filter(c => tick >= (this.cardCooldowns.get(c.id) ?? 0)).length;
  }

  private findWeakestLayer(live: LiveRunState): import('../core/types').ShieldLayerId {
    const order: import('../core/types').ShieldLayerId[] = [
      'L1_LIQUIDITY_BUFFER', 'L2_CREDIT_LINE', 'L3_ASSET_FLOOR', 'L4_NETWORK_CORE',
    ];
    let weakest = order[0]!;
    let weakestPct = live.shields.layers[order[0]!].current / live.shields.layers[order[0]!].max;
    for (const id of order.slice(1)) {
      const pct = live.shields.layers[id].current / live.shields.layers[id].max;
      if (pct < weakestPct) { weakestPct = pct; weakest = id; }
    }
    return weakest;
  }

  private onShieldBreached(_event: PZOEvent): void {
    if (this.liveStateRef) {
      this.liveStateRef.haterHeat = Math.min(100, this.liveStateRef.haterHeat + 8);
    }
  }

  private onCashChanged(event: PZOEvent): void {
    const payload = event.payload as { current: number };
    this.builderNetWorth = payload.current;
  }
}