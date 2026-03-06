// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — SYNDICATE ENGINE (CO-OP)
// pzo-web/src/engines/modes/SyndicateEngine.ts
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════
// SYNDICATE: Two players, one shared financial reality. Income, shields,
// and consequences flow between players. When your partner enters distress,
// you have 12 ticks to save them — or lose them. Both must survive to win.
//
// PHASE 2 INTEGRATIONS (formerly game/modes/syndicate/):
//   ✦ TrustScoreEngine         — bilateral trust score (0–100) that evolves
//                                based on aid actions, timely rescues, and
//                                defection events; unlocks higher-tier aid
//                                contracts at high trust; imposes coordination
//                                penalties at low trust
//   ✦ AidContractEngine        — formal contract system (INCOME_SHARE,
//                                SHIELD_LEND, EMERGENCY_CAPITAL, DEBT_TRANSFER);
//                                each contract has binding terms, auto-expiry,
//                                and breach detection
//   ✦ RescueWindowEngine       — precise timing management for the 12-tick rescue
//                                window; urgency escalation; partial rescue system
//   ✦ DefectionSequenceEngine  — tracks illegal defection plays (BREAK_PACT,
//                                SILENT_EXIT, ASSET_SEIZURE); enforces DEFECTION_CORD
//                                penalty and co-op disqualification logic
//   ✦ SharedTreasuryEngine     — optional shared pool that both players deposit
//                                into; earns a compound synergy yield; accessible
//                                for joint emergencies with mutual consent
//   ✦ RoleAssignmentEngine     — assigns LEAD (income focus) vs ANCHOR (shield focus)
//                                roles at run start; roles invert every 240 ticks;
//                                each role has distinct modifiers and card weights
//
// Original mechanics (unchanged):
//   ✦ Shared Economic Events, Synergy Bonus, Joint Win Condition
//
// COMPATIBILITY NOTES:
//   ✦ All globalEventBus emit/subscribe calls unchanged.
//   ✦ ModeEventBridge translates to zero/EventBus as needed.
// ═══════════════════════════════════════════════════════════════════════════

import type {
  IGameModeEngine, RunMode, RunOutcome, ModeInitConfig,
  RunStateSnapshot, GameModeState, PZOEvent, AidContractRecord,
} from '../core/types';
import { globalEventBus }    from '../core/EventBus';
import type { LiveRunState } from '../core/RunStateSnapshot';

// ─────────────────────────────────────────────────────────────────────────────
// TRUST SCORE ENGINE
// ─────────────────────────────────────────────────────────────────────────────
// Bilateral trust score (0–100). Both players share a single trust rating.
// Starts at TRUST_INITIAL. Rises on cooperative actions, falls on defection.
//
// Trust gating for aid contracts:
//   ≥ 70 — INCOME_SHARE, SHIELD_LEND, EMERGENCY_CAPITAL, DEBT_TRANSFER
//   ≥ 40 — INCOME_SHARE, EMERGENCY_CAPITAL only
//   ≥ 20 — EMERGENCY_CAPITAL only (basic lifeline)
//   <  20 — No aid contracts available (trust breakdown)
//
// Trust also modifies synergy bonus rate and rescue window duration.

const TRUST_INITIAL         = 50;
const TRUST_MAX             = 100;
const TRUST_MIN             = 0;
const TRUST_RESCUE_GAIN     = 20;  // successful rescue
const TRUST_AID_CONTRACT_GAIN = 5; // each active aid contract per-tick drip
const TRUST_DEFECTION_LOSS  = 40;  // defection cord activated
const TRUST_RESCUE_FAIL_LOSS = 15; // rescue window expired unresponded
const TRUST_PASSIVE_DECAY    = 0.05; // per tick when no cooperative action

type TrustTier = 'BONDED' | 'ALIGNED' | 'NEUTRAL' | 'STRAINED' | 'BROKEN';
type AidContractType = AidContractRecord['type'];

class TrustScoreEngine {
  private score: number = TRUST_INITIAL;
  private history: Array<{ tick: number; delta: number; reason: string }> = [];

  reset(): void {
    this.score   = TRUST_INITIAL;
    this.history = [];
  }

  tick(hasActiveContracts: boolean): void {
    // Passive decay when no cooperative action
    if (!hasActiveContracts) {
      this.score = Math.max(TRUST_MIN, this.score - TRUST_PASSIVE_DECAY);
    }
    // Contracts drip trust gain
    if (hasActiveContracts) {
      this.score = Math.min(TRUST_MAX, this.score + TRUST_AID_CONTRACT_GAIN * 0.1);
    }
  }

  add(delta: number, reason: string, tick: number): void {
    const prev  = this.score;
    this.score  = Math.max(TRUST_MIN, Math.min(TRUST_MAX, this.score + delta));
    this.history.push({ tick, delta: this.score - prev, reason });
  }

  getScore():    number     { return Math.round(this.score); }
  getScoreRaw(): number     { return this.score; }

  getTier(): TrustTier {
    if (this.score >= 80) return 'BONDED';
    if (this.score >= 60) return 'ALIGNED';
    if (this.score >= 40) return 'NEUTRAL';
    if (this.score >= 20) return 'STRAINED';
    return 'BROKEN';
  }

  getAvailableContractTypes(): AidContractType[] {
    if (this.score >= 70) return ['INCOME_SHARE', 'SHIELD_LEND', 'EMERGENCY_CAPITAL', 'DEBT_TRANSFER' as any];
    if (this.score >= 40) return ['INCOME_SHARE', 'EMERGENCY_CAPITAL'];
    if (this.score >= 20) return ['EMERGENCY_CAPITAL'];
    return [];
  }

  getSynergyMultiplier(): number {
    // Trust amplifies synergy bonus
    return 1.0 + (this.score / TRUST_MAX) * 0.25;
  }

  getRescueWindowBonus(): number {
    // High trust gives longer rescue windows (+4 ticks at max)
    return Math.floor((this.score / TRUST_MAX) * 4);
  }

  getHistory(): ReadonlyArray<{ tick: number; delta: number; reason: string }> {
    return [...this.history];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AID CONTRACT ENGINE
// ─────────────────────────────────────────────────────────────────────────────
// Manages the full lifecycle of aid contracts between partners.
// Contracts have binding terms enforced per-tick.
// Breach detection: if a player's cash drops below the amount required to
// service an INCOME_SHARE contract for 3 consecutive ticks, the contract
// is marked BREACHED and trust is penalized.
//
// Contract types:
//   INCOME_SHARE    — Local transfers a fixed amount per tick to partner
//   SHIELD_LEND     — Local donates 1% shield regen per tick to partner
//   EMERGENCY_CAPITAL — One-time cash transfer (fires immediately)
//   DEBT_TRANSFER   — Local absorbs partner's expense surplus (advanced)

const CONTRACT_BREACH_TICKS      = 3;     // consecutive inability to service before breach
const CONTRACT_BREACH_TRUST_LOSS = 12;    // trust penalty on breach
const CONTRACT_MAX_SIMULTANEOUS  = 3;     // max active contracts

interface ManagedAidContract extends AidContractRecord {
  unableToServiceTicks: number;   // consecutive ticks player couldn't service
  breached:             boolean;
}

class AidContractEngine {
  private contracts:     ManagedAidContract[] = [];
  private contractCounter: number = 0;

  reset(): void {
    this.contracts      = [];
    this.contractCounter = 0;
  }

  canCreateContract(): boolean {
    return this.contracts.filter(c => c.status === 'ACTIVE').length < CONTRACT_MAX_SIMULTANEOUS;
  }

  createContract(
    type:          AidContractType,
    amount:        number,
    durationTicks: number | null,
    tick:          number,
    trustScore:    number,
  ): ManagedAidContract | null {
    if (!this.canCreateContract()) return null;

    const contract: ManagedAidContract = {
      id:            `contract_${++this.contractCounter}`,
      type,
      initiatorRole: 'local',
      terms:         { amount, durationTicks, interestRate: 0 },
      signedAtTick:  tick,
      expiresAtTick: durationTicks !== null ? tick + durationTicks : null,
      status:        'ACTIVE',
      unableToServiceTicks: 0,
      breached:      false,
    };

    this.contracts.push(contract);
    return contract;
  }

  processContracts(
    live:          LiveRunState,
    partnerRef:    { income: number; expenses: number; cash: number; shieldPct: number },
    tick:          number,
    onBreach:      (contract: ManagedAidContract) => void,
  ): void {
    for (const contract of this.contracts) {
      if (contract.status !== 'ACTIVE') continue;

      // Check expiry
      if (contract.expiresAtTick !== null && tick >= contract.expiresAtTick) {
        contract.status = 'COMPLETED';
        continue;
      }

      // Attempt to service
      const serviceable = this.serviceContract(contract, live, partnerRef);
      if (!serviceable) {
        contract.unableToServiceTicks++;
        if (contract.unableToServiceTicks >= CONTRACT_BREACH_TICKS) {
          contract.breached = true;
          contract.status   = 'BREACHED' as any;
          onBreach(contract);
        }
      } else {
        contract.unableToServiceTicks = 0;
      }
    }

    // Prune completed/breached
    this.contracts = this.contracts.filter(c => c.status === 'ACTIVE');
  }

  private serviceContract(
    contract:   ManagedAidContract,
    live:       LiveRunState,
    partnerRef: { income: number; expenses: number; cash: number; shieldPct: number },
  ): boolean {
    const amountPerTick = contract.terms.amount / 60;

    switch (contract.type) {
      case 'INCOME_SHARE': {
        if (live.income < amountPerTick) return false;
        live.income         = Math.max(0, live.income - amountPerTick);
        partnerRef.income  += amountPerTick;
        return true;
      }
      case 'SHIELD_LEND': {
        // Donate 1% shield regen to partner — no cash cost but self penalty
        partnerRef.shieldPct = Math.min(1, partnerRef.shieldPct + 0.01);
        return true;
      }
      case 'EMERGENCY_CAPITAL': {
        if (live.cash < contract.terms.amount) return false;
        live.cash           -= contract.terms.amount;
        partnerRef.cash     += contract.terms.amount;
        contract.status      = 'COMPLETED';
        return true;
      }
      case 'DEBT_TRANSFER' as any: {
        // Absorb partner's expense surplus
        const partnerSurplus = Math.max(0, partnerRef.expenses - partnerRef.income);
        const absorbable     = Math.min(partnerSurplus * 0.3, contract.terms.amount / 60);
        if (live.cash < absorbable) return false;
        live.expenses       += absorbable;
        partnerRef.expenses  = Math.max(0, partnerRef.expenses - absorbable);
        return true;
      }
      default:
        return true;
    }
  }

  getActiveContracts(): ManagedAidContract[] {
    return this.contracts.filter(c => c.status === 'ACTIVE');
  }

  getAllContracts(): ReadonlyArray<ManagedAidContract> {
    return [...this.contracts];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RESCUE WINDOW ENGINE
// ─────────────────────────────────────────────────────────────────────────────
// Manages the rescue window timing with urgency escalation.
// As the window ticks down, urgency increases and emits are more frequent.
// Partial rescues are supported — sending less than the recommended amount
// temporarily stabilizes the partner but the window remains open.
//
// Window duration = BASE_TICKS + trust.getRescueWindowBonus()
// At URGENCY_THRESHOLD ticks remaining, fires RESCUE_CRITICAL event.
// At 0 ticks, fires RESCUE_EXPIRED and applies severe partner penalties.

const RESCUE_BASE_TICKS       = 12;
const RESCUE_CRITICAL_TICK    = 4;   // "last chance" event fires at this many ticks left
const RESCUE_PARTIAL_THRESHOLD = 0.5;  // sending ≥ 50% of need = partial rescue
const RESCUE_CASH_COST_SCALE   = 0.1;  // recommended rescue = 10% of local cash

type RescueState = 'IDLE' | 'OPEN' | 'CRITICAL' | 'COMPLETED' | 'EXPIRED';

class RescueWindowEngine {
  private state:         RescueState  = 'IDLE';
  private ticksRemaining: number      = 0;
  private partnerCashNeed: number     = 0;
  private partialRescued:  boolean    = false;
  private rescueCount:     number     = 0;

  reset(): void {
    this.state          = 'IDLE';
    this.ticksRemaining = 0;
    this.partnerCashNeed = 0;
    this.partialRescued = false;
    this.rescueCount    = 0;
  }

  openWindow(partnerCash: number, trustBonusTicks: number, tick: number): void {
    if (this.state === 'OPEN' || this.state === 'CRITICAL') return;
    this.state           = 'OPEN';
    this.ticksRemaining  = RESCUE_BASE_TICKS + trustBonusTicks;
    this.partnerCashNeed = Math.max(2000, partnerCash * 0.3);  // need 30% of partner cash
    this.partialRescued  = false;

    globalEventBus.emit('RESCUE_WINDOW_OPENED', tick, {
      ticksRemaining:  this.ticksRemaining,
      partnerCashNeed: this.partnerCashNeed,
      message:         `Partner in distress. Send at least $${this.partnerCashNeed.toLocaleString()} within ${this.ticksRemaining} ticks.`,
    });
  }

  tick(currentTick: number): 'NONE' | 'CRITICAL' | 'EXPIRED' {
    if (this.state !== 'OPEN' && this.state !== 'CRITICAL') return 'NONE';

    this.ticksRemaining--;

    if (this.ticksRemaining === RESCUE_CRITICAL_TICK && this.state === 'OPEN') {
      this.state = 'CRITICAL';
      globalEventBus.emit('RESCUE_WINDOW_CRITICAL', currentTick, {
        ticksRemaining: this.ticksRemaining,
        message:        `LAST CHANCE: ${RESCUE_CRITICAL_TICK} ticks to save your partner.`,
      });
      return 'CRITICAL';
    }

    if (this.ticksRemaining <= 0) {
      this.state = 'EXPIRED';
      globalEventBus.emit('RESCUE_WINDOW_EXPIRED', currentTick, {
        partialRescued: this.partialRescued,
        message:        this.partialRescued
          ? 'Partial rescue was not enough. Partner income stream has collapsed.'
          : 'No rescue sent. Partner income stream has collapsed.',
      });
      return 'EXPIRED';
    }

    return 'NONE';
  }

  applyRescue(amount: number, partnerCashNeed: number, tick: number): boolean {
    if (this.state !== 'OPEN' && this.state !== 'CRITICAL') return false;

    const pct = amount / partnerCashNeed;
    if (pct >= RESCUE_PARTIAL_THRESHOLD && pct < 1.0) {
      this.partialRescued = true;
      this.ticksRemaining = Math.min(this.ticksRemaining + 4, RESCUE_BASE_TICKS);
      globalEventBus.emit('RESCUE_WINDOW_OPENED', tick, {
        action:          'PARTIAL',
        amount,
        ticksExtended:   4,
        message:         `Partial rescue: $${amount.toLocaleString()} sent. Window extended 4 ticks.`,
      });
      return true;
    } else if (pct >= 1.0) {
      this.state = 'COMPLETED';
      this.rescueCount++;
      globalEventBus.emit('RESCUE_WINDOW_OPENED', tick, {
        action:  'FULL',
        amount,
        message: `Full rescue: $${amount.toLocaleString()} sent. Partner stabilized.`,
      });
      return true;
    }
    return false;
  }

  isOpen():           boolean    { return this.state === 'OPEN' || this.state === 'CRITICAL'; }
  getState():         RescueState { return this.state; }
  getTicksRemaining(): number    { return this.ticksRemaining; }
  getRescueCount():   number     { return this.rescueCount; }
  getCashNeed():      number     { return this.partnerCashNeed; }
  closeIfDone():      void       { if (this.state === 'COMPLETED' || this.state === 'EXPIRED') this.state = 'IDLE'; }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFECTION SEQUENCE ENGINE
// ─────────────────────────────────────────────────────────────────────────────
// In co-op, "defection" is a betrayal — one player can break the syndicate
// for personal gain. There are 3 defection cards:
//   BREAK_PACT    — terminates all aid contracts immediately; trust falls to 0
//   SILENT_EXIT   — player removes their income from the syndicate silently;
//                   partner doesn't know until next shared event fires
//   ASSET_SEIZURE — player captures partner's most recent income deposit
//                   from the shared treasury
//
// Playing all 3 in sequence = DEFECTION_CORD activation:
//   • Hater heat +30 for the defector
//   • Partner gets a full trust refund (to 70) + income shield +20%
//   • Defector loses SOVEREIGNTY grade — cannot earn above grade D
//
// Partial defection (1–2 cards) applies proportional trust penalties.
// The defection sequence resets if 120 ticks pass without continuing.

const DEFECTION_CORD_HEAT_PENALTY   = 30;
const DEFECTION_CORD_TRUST_PENALTY  = 0;    // trust already zeroed by BREAK_PACT
const DEFECTION_RESET_TICKS         = 120;
const DEFECTION_CORD_INCOME_SHIELD  = 0.20; // partner income shield pct

type DefectionCardType = 'BREAK_PACT' | 'SILENT_EXIT' | 'ASSET_SEIZURE';

interface DefectionEvent {
  type:   DefectionCardType;
  tick:   number;
  effect: string;
}

class DefectionSequenceEngine {
  private events:      DefectionEvent[] = [];
  private cordActive:  boolean          = false;
  private lastEventTick: number         = -1;
  private gradeCapApplied: boolean      = false;

  reset(): void {
    this.events        = [];
    this.cordActive    = false;
    this.lastEventTick = -1;
    this.gradeCapApplied = false;
  }

  recordDefection(
    type:      DefectionCardType,
    tick:      number,
    live:      LiveRunState | null,
    onCord:    () => void,
  ): void {
    // Reset sequence if too long since last step
    if (this.lastEventTick > 0 && tick - this.lastEventTick > DEFECTION_RESET_TICKS) {
      this.events = [];
    }

    this.events.push({ type, tick, effect: this.getEffect(type) });
    this.lastEventTick = tick;

    // Apply immediate effect per card type
    if (live) {
      switch (type) {
        case 'BREAK_PACT':
          // Trust collapse handled by TrustScoreEngine.add(-100)
          break;
        case 'SILENT_EXIT':
          // Income removed from syndicate pool — handled in SharedTreasuryEngine
          break;
        case 'ASSET_SEIZURE':
          // Partner treasury deposit seized — handled in SharedTreasuryEngine
          if (live) live.haterHeat = Math.min(100, live.haterHeat + 8);
          break;
      }
    }

    // Check for DEFECTION_CORD (all 3 types played)
    const playedTypes = new Set(this.events.map(e => e.type));
    if (playedTypes.has('BREAK_PACT') && playedTypes.has('SILENT_EXIT') && playedTypes.has('ASSET_SEIZURE')) {
      this.cordActive      = true;
      this.gradeCapApplied = true;
      if (live) live.haterHeat = Math.min(100, live.haterHeat + DEFECTION_CORD_HEAT_PENALTY);

      globalEventBus.emit('DEFECTION_CORD_ACTIVATED', tick, {
        steps:   this.events.map(e => e.type),
        message: 'DEFECTION_CORD activated. The syndicate is dissolved. Your sovereignty grade is capped at D.',
      });

      onCord();
    }
  }

  isCordActive():       boolean { return this.cordActive; }
  isGradeCapped():      boolean { return this.gradeCapApplied; }
  getDefectionCount():  number  { return this.events.length; }
  getEvents():          ReadonlyArray<DefectionEvent> { return [...this.events]; }

  private getEffect(type: DefectionCardType): string {
    const effects: Record<DefectionCardType, string> = {
      BREAK_PACT:    'All aid contracts terminated. Trust zeroed.',
      SILENT_EXIT:   'Income silently removed from syndicate. Partner unaware.',
      ASSET_SEIZURE: 'Partner treasury deposit seized.',
    };
    return effects[type];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED TREASURY ENGINE
// ─────────────────────────────────────────────────────────────────────────────
// An opt-in shared pool that both players deposit into at a fixed % per tick.
// The treasury earns compound yield at TREASURY_YIELD_RATE per tick.
// Both players can draw from it with mutual consent (simulated here as
// an automatic draw when EITHER player's cashflow goes negative).
//
// Treasury balance is visible to both players in the HUD.
// It represents the syndicate's "war chest" for emergencies.

const TREASURY_DEPOSIT_PCT  = 0.02;    // each player deposits 2% of income per tick
const TREASURY_YIELD_RATE   = 0.001;   // 0.1% compound per tick when both positive cashflow
const TREASURY_EMERGENCY_THRESHOLD = 3000;  // emergency draw when player cash < this
const TREASURY_MAX_EMERGENCY_DRAW  = 5000;  // max single emergency draw

class SharedTreasuryEngine {
  private balance:     number  = 0;
  private totalDeposited: number = 0;
  private totalDrawn:  number  = 0;
  private isActive:    boolean = false;  // only active when both players opt in

  reset(): void {
    this.balance       = 0;
    this.totalDeposited = 0;
    this.totalDrawn    = 0;
    this.isActive      = false;
  }

  activate(): void {
    this.isActive = true;
  }

  tick(
    localIncome:   number,
    partnerIncome: number,
    localCashflow:  number,
    partnerCashflow: number,
  ): void {
    if (!this.isActive) return;

    // Deposits from both players
    const localDeposit   = Math.floor(localIncome   * TREASURY_DEPOSIT_PCT);
    const partnerDeposit = Math.floor(partnerIncome * TREASURY_DEPOSIT_PCT);
    this.balance         += localDeposit + partnerDeposit;
    this.totalDeposited  += localDeposit + partnerDeposit;

    // Compound yield when both cashflows positive
    if (localCashflow > 0 && partnerCashflow > 0) {
      this.balance = Math.floor(this.balance * (1 + TREASURY_YIELD_RATE));
    }
  }

  requestEmergencyDraw(playerCash: number, tick: number): number {
    if (!this.isActive || this.balance <= 0) return 0;
    if (playerCash >= TREASURY_EMERGENCY_THRESHOLD) return 0;

    const drawAmount = Math.min(TREASURY_MAX_EMERGENCY_DRAW, Math.floor(this.balance * 0.5));
    if (drawAmount <= 0) return 0;

    this.balance    -= drawAmount;
    this.totalDrawn += drawAmount;

    globalEventBus.emit('TREASURY_EMERGENCY_DRAW', tick, {
      amount:         drawAmount,
      remainingBalance: this.balance,
      message:        `Emergency treasury draw: $${drawAmount.toLocaleString()}. Remaining: $${this.balance.toLocaleString()}`,
    });

    return drawAmount;
  }

  seizeDeposit(amount: number): number {
    const seized = Math.min(amount, this.balance);
    this.balance  = Math.max(0, this.balance - seized);
    return seized;
  }

  getBalance():       number  { return this.balance; }
  getTotalDeposited(): number { return this.totalDeposited; }
  getTotalDrawn():    number  { return this.totalDrawn; }
  isActivated():      boolean { return this.isActive; }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLE ASSIGNMENT ENGINE
// ─────────────────────────────────────────────────────────────────────────────
// Assigns LEAD vs ANCHOR roles at run start. Roles determine focus and modifiers.
//
// LEAD   — income-focused: income +10%, decision windows +15%,
//          primary responsibility for the syndicate's revenue
// ANCHOR — shield-focused: shield regen +15%, expense reduction +8%,
//          primary responsibility for the syndicate's defense
//
// Roles INVERT every ROLE_INVERSION_TICKS ticks — players must adapt
// their card selection strategy as their role changes. The inversion event
// is broadcast so both players see it and adjust.
//
// Role also affects which Aid Contract types earn trust:
//   LEAD role playing INCOME_SHARE = trust gain
//   ANCHOR role playing SHIELD_LEND = trust gain

const ROLE_INVERSION_TICKS = 240;

export type SyndicateRole = 'LEAD' | 'ANCHOR';

interface RoleModifiers {
  incomeMultiplier:   number;
  expenseMultiplier:  number;
  shieldRegenBonus:   number;    // additive pct
  windowDurationMult: number;
}

const ROLE_MODIFIERS: Record<SyndicateRole, RoleModifiers> = {
  LEAD: {
    incomeMultiplier:   1.10,
    expenseMultiplier:  1.00,
    shieldRegenBonus:   0.00,
    windowDurationMult: 1.15,
  },
  ANCHOR: {
    incomeMultiplier:   1.00,
    expenseMultiplier:  0.92,
    shieldRegenBonus:   0.15,
    windowDurationMult: 1.00,
  },
};

class RoleAssignmentEngine {
  private localRole:   SyndicateRole = 'LEAD';
  private partnerRole: SyndicateRole = 'ANCHOR';
  private inversionCount: number = 0;
  private lastInversionTick: number = 0;

  reset(localRole?: SyndicateRole): void {
    this.localRole     = localRole ?? 'LEAD';
    this.partnerRole   = this.localRole === 'LEAD' ? 'ANCHOR' : 'LEAD';
    this.inversionCount = 0;
    this.lastInversionTick = 0;
  }

  tick(tick: number): boolean {
    if (tick > 0 && tick % ROLE_INVERSION_TICKS === 0) {
      // Invert roles
      const prev          = this.localRole;
      this.localRole      = this.localRole === 'LEAD' ? 'ANCHOR' : 'LEAD';
      this.partnerRole    = this.partnerRole === 'LEAD' ? 'ANCHOR' : 'LEAD';
      this.inversionCount++;
      this.lastInversionTick = tick;

      globalEventBus.emit('SYNDICATE_ROLE_INVERTED', tick, {
        previousLocalRole: prev,
        newLocalRole:      this.localRole,
        inversionCount:    this.inversionCount,
        message:           `Role inversion! You are now the ${this.localRole}. Adapt your card strategy.`,
      });
      return true;
    }
    return false;
  }

  applyModifiers(live: LiveRunState): void {
    const mods = ROLE_MODIFIERS[this.localRole];
    // Apply income multiplier (difference from 1.0 only, to avoid compounding each tick)
    const incomeBonus = Math.floor(live.income * (mods.incomeMultiplier - 1.0));
    live.income = Math.max(0, live.income + incomeBonus);

    if (mods.expenseMultiplier < 1.0) {
      const expenseReduction = Math.floor(live.expenses * (1.0 - mods.expenseMultiplier));
      live.expenses = Math.max(0, live.expenses - expenseReduction);
    }
  }

  getLocalRole():   SyndicateRole { return this.localRole; }
  getPartnerRole(): SyndicateRole { return this.partnerRole; }
  getModifiers():   RoleModifiers { return ROLE_MODIFIERS[this.localRole]; }
  getInversionCount(): number { return this.inversionCount; }

  // Trust-earning check: does this aid type match the role that earns trust?
  doesContractEarnTrust(type: AidContractType): boolean {
    if (this.localRole === 'LEAD'   && type === 'INCOME_SHARE') return true;
    if (this.localRole === 'ANCHOR' && (type === 'SHIELD_LEND' || type === 'EMERGENCY_CAPITAL')) return true;
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED EVENTS (unchanged from v1)
// ─────────────────────────────────────────────────────────────────────────────

interface SharedEvent {
  label:    string;
  incomeD:  number;
  expenseD: number;
  message:  string;
}

const SHARED_EVENTS: SharedEvent[] = [
  { label: 'Market Correction',  incomeD: -300, expenseD:  200, message: 'Market correction hits both income streams.' },
  { label: 'Sector Opportunity', incomeD:  500, expenseD:    0, message: 'A rising tide: both incomes get a sector lift.' },
  { label: 'Regulatory Change',  incomeD:    0, expenseD:  800, message: 'New compliance requirements hit the whole syndicate.' },
  { label: 'Network Effect',     incomeD:  400, expenseD:    0, message: 'Your combined network delivers shared deal flow.' },
  { label: 'Inflation Spike',    incomeD:    0, expenseD:  600, message: 'Costs rise for everyone. The syndicate feels it.' },
  { label: 'Liquidity Crunch',   incomeD: -200, expenseD:  400, message: 'Credit markets tighten. Both positions squeezed.' },
  { label: 'Referral Chain',     incomeD:  350, expenseD:    0, message: 'Your partnership reputation drives incoming deals.' },
  { label: 'Joint Audit Trigger',incomeD:    0, expenseD: 1200, message: 'The syndicate structure triggers a compliance review.' },
];

const DISTRESS_CASH_THRESHOLD   = 3000;
const DISTRESS_INCOME_THRESHOLD = 0.8;
const SYNERGY_GAIN_PER_TICK     = 1.5;
const SYNERGY_DECAY_PER_TICK    = 2.0;
const SYNERGY_MAX               = 200.0;

// ─────────────────────────────────────────────────────────────────────────────
// ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export class SyndicateEngine implements IGameModeEngine {
  public readonly mode: RunMode = 'co-op';
  public readonly runId: string;

  private liveStateRef:  LiveRunState | null = null;
  private config:        ModeInitConfig | null = null;
  private eventHandlers: Array<() => void> = [];

  // Original partner mirror state
  private partnerCash:        number = 28000;
  private partnerIncome:      number = 2100;
  private partnerExpenses:    number = 4800;
  private partnerNetWorth:    number = 28000;
  private partnerShieldPct:   number = 1.0;
  private partnerInDistress:  boolean = false;
  private synergyScore:       number = 0;

  // Phase 2: subsystems
  private trustScoreEngine:       TrustScoreEngine;
  private aidContractEngine:      AidContractEngine;
  private rescueWindowEngine:     RescueWindowEngine;
  private defectionSequenceEngine: DefectionSequenceEngine;
  private sharedTreasuryEngine:   SharedTreasuryEngine;
  private roleAssignmentEngine:   RoleAssignmentEngine;

  constructor() {
    this.runId = `syndicate_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.trustScoreEngine        = new TrustScoreEngine();
    this.aidContractEngine       = new AidContractEngine();
    this.rescueWindowEngine      = new RescueWindowEngine();
    this.defectionSequenceEngine = new DefectionSequenceEngine();
    this.sharedTreasuryEngine    = new SharedTreasuryEngine();
    this.roleAssignmentEngine    = new RoleAssignmentEngine();
  }

  // ═════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═════════════════════════════════════════════════════════════════════════

  public init(config: ModeInitConfig): void {
    this.config = config;

    this.partnerCash       = config.startingCash;
    this.partnerIncome     = config.startingIncome;
    this.partnerExpenses   = config.startingExpenses;
    this.partnerNetWorth   = config.startingCash;
    this.partnerShieldPct  = 1.0;
    this.partnerInDistress = false;
    this.synergyScore      = 0;

    // Phase 2: init subsystems
    const initialRole = (config as any).syndicateRole ?? 'LEAD';
    this.trustScoreEngine.reset();
    this.aidContractEngine.reset();
    this.rescueWindowEngine.reset();
    this.defectionSequenceEngine.reset();
    this.sharedTreasuryEngine.reset();
    this.roleAssignmentEngine.reset(initialRole);

    // Activate treasury if opted in (default true in co-op)
    if ((config as any).enableSharedTreasury !== false) {
      this.sharedTreasuryEngine.activate();
    }

    this.eventHandlers.push(
      globalEventBus.on('CASH_CHANGED',         (e) => this.onCashChanged(e)),
      globalEventBus.on('INCOME_CHANGED',        (e) => this.onIncomeChanged(e)),
      globalEventBus.on('SHIELD_LAYER_BREACHED', (e) => this.onShieldBreached(e)),
    );

    globalEventBus.emitImmediate('RUN_STARTED', 0, {
      mode:         'co-op',
      label:        'SYNDICATE',
      runId:        this.runId,
      localRole:    this.roleAssignmentEngine.getLocalRole(),
      partnerRole:  this.roleAssignmentEngine.getPartnerRole(),
      trustScore:   this.trustScoreEngine.getScore(),
      message:      'The syndicate is live. Your financial fate is linked. Build together or fall together.',
    });
  }

  public onTick(snapshot: RunStateSnapshot): void {
    const tick = snapshot.tick;

    // ── 1. Simulate partner economy ────────────────────────────────────────
    this.simulatePartnerTick(snapshot);

    // ── 2. Phase 2: Role assignment tick (inversion check) ────────────────
    const roleInverted = this.roleAssignmentEngine.tick(tick);
    if (roleInverted && this.liveStateRef) {
      // Apply new role modifiers immediately
      this.roleAssignmentEngine.applyModifiers(this.liveStateRef);
    }

    // ── 3. Phase 2: Shared treasury tick ──────────────────────────────────
    this.sharedTreasuryEngine.tick(
      snapshot.income,
      this.partnerIncome,
      snapshot.income - snapshot.expenses,
      this.partnerIncome - this.partnerExpenses,
    );

    // Emergency treasury draw if player cash critical
    if (snapshot.cash < DISTRESS_CASH_THRESHOLD && this.liveStateRef) {
      const drawn = this.sharedTreasuryEngine.requestEmergencyDraw(snapshot.cash, tick);
      if (drawn > 0) this.liveStateRef.cash += drawn;
    }

    // ── 4. Shared market events ─────────────────────────────────────────────
    if (tick % 48 === 0 && tick > 0) {
      this.fireSharedEvent(snapshot);
    }

    // ── 5. Check partner distress ────────────────────────────────────────────
    this.checkPartnerDistress(snapshot);

    // ── 6. Phase 2: Rescue window tick ────────────────────────────────────
    if (this.rescueWindowEngine.isOpen()) {
      const result = this.rescueWindowEngine.tick(tick);
      if (result === 'EXPIRED') {
        this.trustScoreEngine.add(-TRUST_RESCUE_FAIL_LOSS, 'Rescue window expired', tick);
        this.closeRescueWindow(snapshot, 'EXPIRED');
        this.rescueWindowEngine.closeIfDone();
      }
    }

    // ── 7. Phase 2: Aid contract engine tick ─────────────────────────────
    const partnerRef = {
      income:   this.partnerIncome,
      expenses: this.partnerExpenses,
      cash:     this.partnerCash,
      shieldPct: this.partnerShieldPct,
    };
    if (this.liveStateRef) {
      this.aidContractEngine.processContracts(
        this.liveStateRef,
        partnerRef,
        tick,
        (contract) => {
          this.trustScoreEngine.add(-CONTRACT_BREACH_TRUST_LOSS, `Contract breached: ${contract.type}`, tick);
          globalEventBus.emit('AID_CONTRACT_SIGNED', tick, {
            contractId: contract.id,
            type:       contract.type,
            status:     'BREACHED',
            message:    `Aid contract breached: ${contract.type}. Trust penalized.`,
          });
        },
      );
      this.partnerIncome   = partnerRef.income;
      this.partnerExpenses = partnerRef.expenses;
      this.partnerCash     = partnerRef.cash;
      this.partnerShieldPct = partnerRef.shieldPct;
    }

    // ── 8. Phase 2: Trust score tick ─────────────────────────────────────
    const hasActive = this.aidContractEngine.getActiveContracts().length > 0;
    this.trustScoreEngine.tick(hasActive);

    // ── 9. Synergy score ─────────────────────────────────────────────────
    const bothPositive =
      snapshot.income > snapshot.expenses &&
      this.partnerIncome > this.partnerExpenses;

    if (bothPositive) {
      // Phase 2: trust amplifies synergy gain
      const trustMult = this.trustScoreEngine.getSynergyMultiplier();
      this.synergyScore = Math.min(SYNERGY_MAX, this.synergyScore + SYNERGY_GAIN_PER_TICK * trustMult);
    } else {
      this.synergyScore = Math.max(0, this.synergyScore - SYNERGY_DECAY_PER_TICK);
    }

    if (this.synergyScore >= 50 && this.liveStateRef) {
      const synergyMult    = 1 + (this.synergyScore / SYNERGY_MAX) * 0.3;
      this.liveStateRef.income = Math.floor(snapshot.income * synergyMult);
    }
  }

  public onRunEnd(outcome: RunOutcome): void {
    const bothSurvived = outcome === 'FREEDOM' || outcome === 'TIMEOUT';
    globalEventBus.emitImmediate('RUN_ENDED', this.liveStateRef?.tick ?? 0, {
      outcome,
      runId:               this.runId,
      bothSurvived,
      rescuedCount:        this.rescueWindowEngine.getRescueCount(),
      synergyPeak:         this.synergyScore,
      finalTrustScore:     this.trustScoreEngine.getScore(),
      trustTier:           this.trustScoreEngine.getTier(),
      defectionCordFired:  this.defectionSequenceEngine.isCordActive(),
      roleInversions:      this.roleAssignmentEngine.getInversionCount(),
      treasuryBalance:     this.sharedTreasuryEngine.getBalance(),
      message: bothSurvived
        ? 'The syndicate survived. Your combined net worth is proof of what aligned effort builds.'
        : 'The syndicate fell. One broken link can unravel everything you built together.',
    });
    this.eventHandlers.forEach(unsub => unsub());
    this.eventHandlers = [];
  }

  public getState(): GameModeState {
    return {
      mode: 'co-op',
      syndicate: {
        partnerCash:           this.partnerCash,
        partnerIncome:         this.partnerIncome,
        partnerNetWorth:       this.partnerNetWorth,
        partnerShieldPct:      this.partnerShieldPct,
        partnerInDistress:     this.partnerInDistress,
        rescueWindowOpen:      this.rescueWindowEngine.isOpen(),
        rescueWindowTicksLeft: this.rescueWindowEngine.getTicksRemaining(),
        rescueState:           this.rescueWindowEngine.getState(),
        activeAidContracts:    this.aidContractEngine.getActiveContracts(),
        synergyBonus:          1 + (this.synergyScore / SYNERGY_MAX) * 0.3,
        combinedNetWorth:      (this.liveStateRef?.netWorth ?? 0) + this.partnerNetWorth,
        // Phase 2 state
        trustScore:            this.trustScoreEngine.getScore(),
        trustTier:             this.trustScoreEngine.getTier(),
        availableContractTypes: this.trustScoreEngine.getAvailableContractTypes(),
        localRole:             this.roleAssignmentEngine.getLocalRole(),
        partnerRole:           this.roleAssignmentEngine.getPartnerRole(),
        roleInversions:        this.roleAssignmentEngine.getInversionCount(),
        treasuryBalance:       this.sharedTreasuryEngine.getBalance(),
        defectionCount:        this.defectionSequenceEngine.getDefectionCount(),
        defectionCordActive:   this.defectionSequenceEngine.isCordActive(),
        gradeCapped:           this.defectionSequenceEngine.isGradeCapped(),
      },
    };
  }

  public subscribe(handler: (event: PZOEvent) => void): () => void {
    const u1 = globalEventBus.on('PARTNER_DISTRESS',         handler);
    const u2 = globalEventBus.on('RESCUE_WINDOW_OPENED',     handler);
    const u3 = globalEventBus.on('RESCUE_WINDOW_EXPIRED',    handler);
    const u4 = globalEventBus.on('RESCUE_WINDOW_CRITICAL',   handler);
    const u5 = globalEventBus.on('AID_CONTRACT_SIGNED',      handler);
    const u6 = globalEventBus.on('SYNDICATE_ROLE_INVERTED',  handler);
    const u7 = globalEventBus.on('DEFECTION_CORD_ACTIVATED', handler);
    const u8 = globalEventBus.on('TREASURY_EMERGENCY_DRAW',  handler);
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); };
  }

  public setLiveStateRef(ref: LiveRunState): void {
    this.liveStateRef = ref;
    // Apply initial role modifiers
    this.roleAssignmentEngine.applyModifiers(ref);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PUBLIC API: PLAYER ACTIONS
  // ═════════════════════════════════════════════════════════════════════════

  /** Send emergency rescue capital to partner. */
  public sendRescueCapital(amount: number, tick: number): boolean {
    const live = this.liveStateRef;
    if (!live || live.cash < amount) return false;

    const rescued = this.rescueWindowEngine.applyRescue(amount, this.rescueWindowEngine.getCashNeed(), tick);
    if (!rescued) return false;

    live.cash            -= amount;
    this.partnerCash     += amount;
    this.partnerNetWorth += amount;

    this.trustScoreEngine.add(TRUST_RESCUE_GAIN, 'Rescue capital sent', tick);

    if (this.rescueWindowEngine.getState() === 'COMPLETED') {
      this.rescueWindowEngine.closeIfDone();
    }
    return true;
  }

  /** Propose and create an aid contract (subject to trust gating). */
  public proposeAidContract(
    type:          AidContractType,
    amount:        number,
    durationTicks: number | null,
    tick:          number,
  ): AidContractRecord | null {
    const available = this.trustScoreEngine.getAvailableContractTypes();
    if (!available.includes(type as any)) return null;

    const contract = this.aidContractEngine.createContract(
      type, amount, durationTicks, tick, this.trustScoreEngine.getScore(),
    );
    if (!contract) return null;

    // Trust bonus if role-appropriate contract
    if (this.roleAssignmentEngine.doesContractEarnTrust(type)) {
      this.trustScoreEngine.add(TRUST_AID_CONTRACT_GAIN, `Role-appropriate contract: ${type}`, tick);
    }

    globalEventBus.emit('AID_CONTRACT_SIGNED', tick, {
      contractId:  contract.id,
      type,
      amount,
      trustScore:  this.trustScoreEngine.getScore(),
      label:       `Aid Contract: ${type}`,
      message:     `${type} contract signed. $${amount.toLocaleString()} allocated.`,
    });

    return contract;
  }

  /** Play a defection card — applies trust penalties and potentially activates DEFECTION_CORD. */
  public playDefectionCard(type: 'BREAK_PACT' | 'SILENT_EXIT' | 'ASSET_SEIZURE', tick: number): void {
    const live = this.liveStateRef;

    if (type === 'BREAK_PACT') {
      this.trustScoreEngine.add(-TRUST_DEFECTION_LOSS, 'BREAK_PACT played', tick);
      // Terminate all active contracts
      for (const contract of this.aidContractEngine.getActiveContracts()) {
        (contract as any).status = 'CANCELLED';
      }
    }

    if (type === 'ASSET_SEIZURE') {
      const seized = this.sharedTreasuryEngine.seizeDeposit(5000);
      if (live) live.cash += seized;
    }

    this.defectionSequenceEngine.recordDefection(type, tick, live, () => {
      // DEFECTION_CORD fired — partner gets trust + income shield bonus
      this.partnerIncome = Math.floor(this.partnerIncome * (1 + DEFECTION_CORD_INCOME_SHIELD));
      globalEventBus.emit('PARTNER_DISTRESS', tick, {
        distressed: false,
        isDefectionRecovery: true,
        partnerIncomeShield: DEFECTION_CORD_INCOME_SHIELD,
        message:    'Partner gains defection recovery shield. Your grade is capped at D.',
      });
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PRIVATE
  // ═════════════════════════════════════════════════════════════════════════

  private simulatePartnerTick(snapshot: RunStateSnapshot): void {
    const net = this.partnerIncome - this.partnerExpenses;
    this.partnerCash     = Math.max(0, this.partnerCash + net);
    this.partnerNetWorth = this.partnerCash;

    if (snapshot.haterHeat > 50) {
      this.partnerShieldPct = Math.max(0, this.partnerShieldPct - 0.005);
    } else {
      this.partnerShieldPct = Math.min(1, this.partnerShieldPct + 0.002);
    }
  }

  private fireSharedEvent(snapshot: RunStateSnapshot): void {
    const live = this.liveStateRef;
    if (!live) return;

    const rng = this.mulberry32(snapshot.seed + snapshot.tick + 77);
    const ev  = SHARED_EVENTS[Math.floor(rng() * SHARED_EVENTS.length)]!;

    live.income          = Math.max(0, live.income   + ev.incomeD);
    live.expenses        = Math.max(0, live.expenses + ev.expenseD);
    this.partnerIncome   = Math.max(0, this.partnerIncome   + ev.incomeD);
    this.partnerExpenses = Math.max(0, this.partnerExpenses + ev.expenseD);

    globalEventBus.emit('INCOME_CHANGED', snapshot.tick, {
      label: ev.label, message: ev.message,
      delta: ev.incomeD - ev.expenseD, isSyndicate: true,
    });
  }

  private checkPartnerDistress(snapshot: RunStateSnapshot): void {
    const wasDistressed  = this.partnerInDistress;
    const cashDistress   = this.partnerCash < DISTRESS_CASH_THRESHOLD;
    const flowDistress   = this.partnerIncome / Math.max(1, this.partnerExpenses) < DISTRESS_INCOME_THRESHOLD;
    this.partnerInDistress = cashDistress || flowDistress;

    if (this.partnerInDistress && !wasDistressed && !this.rescueWindowEngine.isOpen()) {
      this.openRescueWindow(snapshot);
    }

    if (!this.partnerInDistress && wasDistressed) {
      globalEventBus.emit('PARTNER_DISTRESS', snapshot.tick, {
        distressed: false, label: 'Partner stabilized',
      });
    }
  }

  private openRescueWindow(snapshot: RunStateSnapshot): void {
    const trustBonus = this.trustScoreEngine.getRescueWindowBonus();
    this.rescueWindowEngine.openWindow(this.partnerCash, trustBonus, snapshot.tick);
    globalEventBus.emit('PARTNER_DISTRESS', snapshot.tick, {
      distressed: true, label: 'Partner in distress',
      trustScore: this.trustScoreEngine.getScore(),
    });
  }

  private closeRescueWindow(snapshot: Partial<RunStateSnapshot>, reason: 'RESCUED' | 'EXPIRED'): void {
    if (reason === 'EXPIRED') {
      this.partnerIncome   = Math.floor(this.partnerIncome * 0.4);
      this.partnerNetWorth *= 0.6;
    }
  }

  private onCashChanged(event: PZOEvent): void {
    const payload = event.payload as { current: number };
    if (payload.current < DISTRESS_CASH_THRESHOLD && this.liveStateRef) {
      globalEventBus.emit('PARTNER_DISTRESS', this.liveStateRef.tick, {
        distressed: true, isLocal: true, cash: payload.current,
        label: 'You are approaching distress. Partner may rescue you.',
      });
    }
  }

  private onIncomeChanged(event: PZOEvent): void {
    if ((event.payload as { isSyndicate?: boolean }).isSyndicate) return;
    const delta = (event.payload as { delta?: number }).delta ?? 0;
    const spill = delta * 0.15;
    this.partnerIncome = Math.max(0, this.partnerIncome + spill);
  }

  private onShieldBreached(_event: PZOEvent): void {
    this.partnerShieldPct = Math.max(0, this.partnerShieldPct - 0.05);
  }

  private mulberry32(seed: number): () => number {
    let t = seed >>> 0;
    return () => {
      t += 0x6D2B79F5;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
}