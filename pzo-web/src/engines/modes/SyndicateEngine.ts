// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — SYNDICATE ENGINE (CO-OP)
// pzo-web/src/engines/modes/SyndicateEngine.ts
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════
// SYNDICATE: Two players, one shared financial reality. Income, shields,
// and consequences flow between players. When your partner enters distress,
// you have 12 ticks to save them — or lose them. Both must survive to win.
//
// Unique mechanics:
//   • Shared Economic Events — market events hit both players simultaneously
//   • Rescue Windows — 12-tick window to bail out a distressed partner
//   • Aid Contract System — negotiate income sharing, debt transfers, shield loans
//   • Synergy Bonus — sustained mutual cashflow unlocks compounding multiplier
//   • Joint Win Condition — BOTH must have income > expenses at tick 720

import type {
  IGameModeEngine, RunMode, RunOutcome, ModeInitConfig,
  RunStateSnapshot, GameModeState, PZOEvent, AidContractRecord,
} from '../core/types';
import { globalEventBus }       from '../core/EventBus';
import type { LiveRunState }    from '../core/RunStateSnapshot';

// ── Shared economic event ─────────────────────────────────────────────────────

interface SharedEvent {
  label:      string;
  incomeD:    number;   // applied to BOTH players
  expenseD:   number;   // applied to BOTH players
  message:    string;
}

const SHARED_EVENTS: SharedEvent[] = [
  { label: 'Market Correction',     incomeD: -300, expenseD:  200, message: 'Market correction hits both income streams.' },
  { label: 'Sector Opportunity',    incomeD:  500, expenseD:    0, message: 'A rising tide: both incomes get a sector lift.' },
  { label: 'Regulatory Change',     incomeD:    0, expenseD:  800, message: 'New compliance requirements hit the whole syndicate.' },
  { label: 'Network Effect',        incomeD:  400, expenseD:    0, message: 'Your combined network delivers shared deal flow.' },
  { label: 'Inflation Spike',       incomeD:    0, expenseD:  600, message: 'Costs rise for everyone. The syndicate feels it.' },
  { label: 'Liquidity Crunch',      incomeD: -200, expenseD:  400, message: 'Credit markets tighten. Both positions squeezed.' },
  { label: 'Referral Chain',        incomeD:  350, expenseD:    0, message: 'Your partnership reputation drives incoming deals.' },
  { label: 'Joint Audit Trigger',   incomeD:    0, expenseD: 1200, message: 'The syndicate structure triggers a compliance review.' },
];

// ── Distress thresholds ───────────────────────────────────────────────────────

const DISTRESS_CASH_THRESHOLD   = 3000;  // below this cash = distress
const DISTRESS_INCOME_THRESHOLD = 0.8;   // income/expenses below this = distress
const RESCUE_WINDOW_TICKS       = 12;
const SYNERGY_GAIN_PER_TICK     = 1.5;
const SYNERGY_DECAY_PER_TICK    = 2.0;
const SYNERGY_MAX               = 200.0; // 2.0x multiplier at max

// ── Engine ────────────────────────────────────────────────────────────────────

export class SyndicateEngine implements IGameModeEngine {
  public readonly mode: RunMode = 'co-op';
  public readonly runId: string;

  private liveStateRef:  LiveRunState | null = null;
  private config:        ModeInitConfig | null = null;
  private eventHandlers: Array<() => void> = [];

  // Partner state (in production: received via WebSocket from partner's session)
  private partnerCash:       number = 28000;
  private partnerIncome:     number = 2100;
  private partnerExpenses:   number = 4800;
  private partnerNetWorth:   number = 28000;
  private partnerShieldPct:  number = 1.0;
  private partnerInDistress: boolean = false;
  private partnerLastDistressTick: number = -1;

  // Rescue system
  private rescueWindowOpen:      boolean = false;
  private rescueWindowTicksLeft: number = 0;
  private rescuedThisRun:        number = 0;

  // Aid contracts
  private activeAidContracts: AidContractRecord[] = [];
  private contractIdCounter:  number = 0;

  // Synergy
  private synergyScore: number = 0;

  constructor() {
    this.runId = `syndicate_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  public init(config: ModeInitConfig): void {
    this.config = config;

    // In production: connect to multiplayer session, sync partner state
    // For now: initialize partner with mirrored starting state
    this.partnerCash       = config.startingCash;
    this.partnerIncome     = config.startingIncome;
    this.partnerExpenses   = config.startingExpenses;
    this.partnerNetWorth   = config.startingCash;
    this.partnerShieldPct  = 1.0;
    this.partnerInDistress = false;
    this.synergyScore      = 0;
    this.activeAidContracts = [];
    this.rescueWindowOpen   = false;

    this.eventHandlers.push(
      globalEventBus.on('CASH_CHANGED',          (e) => this.onCashChanged(e)),
      globalEventBus.on('INCOME_CHANGED',         (e) => this.onIncomeChanged(e)),
      globalEventBus.on('SHIELD_LAYER_BREACHED',  (e) => this.onShieldBreached(e)),
    );

    globalEventBus.emitImmediate('RUN_STARTED', 0, {
      mode: 'co-op', label: 'SYNDICATE', runId: this.runId,
      message: 'The syndicate is live. Your financial fate is linked. Build together or fall together.',
    });
  }

  public onTick(snapshot: RunStateSnapshot): void {
    const tick = snapshot.tick;

    // ── 1. Simulate partner economy (server-side in production) ────────
    this.simulatePartnerTick(snapshot);

    // ── 2. Shared market events ─────────────────────────────────────────
    if (tick % 48 === 0 && tick > 0) {
      this.fireSharedEvent(snapshot);
    }

    // ── 3. Check partner distress ────────────────────────────────────────
    this.checkPartnerDistress(snapshot);

    // ── 4. Tick rescue window ────────────────────────────────────────────
    if (this.rescueWindowOpen) {
      this.rescueWindowTicksLeft--;
      if (this.rescueWindowTicksLeft <= 0) {
        this.closeRescueWindow(snapshot, 'EXPIRED');
      }
    }

    // ── 5. Process active aid contracts ──────────────────────────────────
    this.processAidContracts(snapshot);

    // ── 6. Update synergy score ──────────────────────────────────────────
    const bothPositive =
      snapshot.income > snapshot.expenses &&
      this.partnerIncome > this.partnerExpenses;

    if (bothPositive) {
      this.synergyScore = Math.min(SYNERGY_MAX, this.synergyScore + SYNERGY_GAIN_PER_TICK);
    } else {
      this.synergyScore = Math.max(0, this.synergyScore - SYNERGY_DECAY_PER_TICK);
    }

    // Apply synergy bonus to income when above threshold
    if (this.synergyScore >= 50 && this.liveStateRef) {
      const synergyMult   = 1 + (this.synergyScore / SYNERGY_MAX) * 0.3; // up to +30%
      this.liveStateRef.income = Math.floor(snapshot.income * synergyMult);
    }
  }

  public onRunEnd(outcome: RunOutcome): void {
    const bothSurvived = outcome === 'FREEDOM' || outcome === 'TIMEOUT';

    globalEventBus.emitImmediate('RUN_ENDED', this.liveStateRef?.tick ?? 0, {
      outcome, runId: this.runId,
      bothSurvived,
      rescuedCount:   this.rescuedThisRun,
      synergyPeak:    this.synergyScore,
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
        rescueWindowOpen:      this.rescueWindowOpen,
        rescueWindowTicksLeft: this.rescueWindowTicksLeft,
        activeAidContracts:    this.activeAidContracts,
        synergyBonus:          1 + (this.synergyScore / SYNERGY_MAX) * 0.3,
        combinedNetWorth:      (this.liveStateRef?.netWorth ?? 0) + this.partnerNetWorth,
      },
    };
  }

  public subscribe(handler: (event: PZOEvent) => void): () => void {
    const u1 = globalEventBus.on('PARTNER_DISTRESS',      handler);
    const u2 = globalEventBus.on('RESCUE_WINDOW_OPENED',  handler);
    const u3 = globalEventBus.on('RESCUE_WINDOW_EXPIRED', handler);
    const u4 = globalEventBus.on('AID_CONTRACT_SIGNED',   handler);
    return () => { u1(); u2(); u3(); u4(); };
  }

  public setLiveStateRef(ref: LiveRunState): void {
    this.liveStateRef = ref;
  }

  // ── Public: Send emergency capital to partner ────────────────────────────

  public sendRescueCapital(amount: number, tick: number): boolean {
    const live = this.liveStateRef;
    if (!live) return false;
    if (!this.rescueWindowOpen) return false;
    if (live.cash < amount) return false;

    live.cash         -= amount;
    this.partnerCash  += amount;
    this.partnerNetWorth += amount;
    this.rescuedThisRun++;

    this.closeRescueWindow({ tick } as RunStateSnapshot, 'RESCUED');

    globalEventBus.emit('RESCUE_WINDOW_OPENED', tick, {
      action:   'CAPITAL_SENT', amount,
      label:    'Emergency capital deployed. Partner pulled back from distress.',
      message:  `You sent $${amount.toLocaleString()} to your partner. Syndicate integrity maintained.`,
    });
    return true;
  }

  // ── Public: Propose an aid contract ─────────────────────────────────────

  public proposeAidContract(
    type:          AidContractRecord['type'],
    amount:        number,
    durationTicks: number | null,
    tick:          number,
  ): AidContractRecord {
    const contract: AidContractRecord = {
      id:            `contract_${++this.contractIdCounter}`,
      type,
      initiatorRole: 'local',
      terms:         { amount, durationTicks, interestRate: 0 },
      signedAtTick:  tick,
      expiresAtTick: durationTicks !== null ? tick + durationTicks : null,
      status:        'ACTIVE',
    };

    this.activeAidContracts.push(contract);

    globalEventBus.emit('AID_CONTRACT_SIGNED', tick, {
      contractId:  contract.id, type, amount,
      label:       `Aid Contract: ${type}`,
      message:     `${type} contract signed. $${amount.toLocaleString()}/run allocated.`,
    });
    return contract;
  }

  // ── Private: Simulate partner tick ──────────────────────────────────────

  private simulatePartnerTick(snapshot: RunStateSnapshot): void {
    // In production: partner state pushed from server. Here: autonomous simulation.
    const net = this.partnerIncome - this.partnerExpenses;
    this.partnerCash     = Math.max(0, this.partnerCash + net);
    this.partnerNetWorth = this.partnerCash;

    // Partner shield slowly decays under bot pressure
    if (snapshot.haterHeat > 50) {
      this.partnerShieldPct = Math.max(0, this.partnerShieldPct - 0.005);
    } else {
      this.partnerShieldPct = Math.min(1, this.partnerShieldPct + 0.002);
    }
  }

  // ── Private: Shared market event ────────────────────────────────────────

  private fireSharedEvent(snapshot: RunStateSnapshot): void {
    const live = this.liveStateRef;
    if (!live) return;

    const rng = this.mulberry32(snapshot.seed + snapshot.tick + 77);
    const ev  = SHARED_EVENTS[Math.floor(rng() * SHARED_EVENTS.length)];

    // Apply to both players
    live.income   = Math.max(0, live.income   + ev.incomeD);
    live.expenses = Math.max(0, live.expenses + ev.expenseD);
    this.partnerIncome   = Math.max(0, this.partnerIncome   + ev.incomeD);
    this.partnerExpenses = Math.max(0, this.partnerExpenses + ev.expenseD);

    globalEventBus.emit('INCOME_CHANGED', snapshot.tick, {
      label:   ev.label, message: ev.message, delta: ev.incomeD - ev.expenseD,
      isSyndicate: true,
    });
  }

  // ── Private: Check and open rescue window ───────────────────────────────

  private checkPartnerDistress(snapshot: RunStateSnapshot): void {
    const wasDistressed = this.partnerInDistress;
    const cashDistress  = this.partnerCash < DISTRESS_CASH_THRESHOLD;
    const flowDistress  = this.partnerIncome / Math.max(1, this.partnerExpenses) < DISTRESS_INCOME_THRESHOLD;
    this.partnerInDistress = cashDistress || flowDistress;

    if (this.partnerInDistress && !wasDistressed && !this.rescueWindowOpen) {
      this.openRescueWindow(snapshot);
    }

    if (!this.partnerInDistress && wasDistressed) {
      globalEventBus.emit('PARTNER_DISTRESS', snapshot.tick, {
        distressed: false, label: 'Partner stabilized',
      });
    }
  }

  private openRescueWindow(snapshot: RunStateSnapshot): void {
    this.rescueWindowOpen      = true;
    this.rescueWindowTicksLeft = RESCUE_WINDOW_TICKS;
    this.partnerLastDistressTick = snapshot.tick;

    globalEventBus.emit('PARTNER_DISTRESS',     snapshot.tick, { distressed: true, label: 'Partner in distress' });
    globalEventBus.emit('RESCUE_WINDOW_OPENED', snapshot.tick, {
      ticksRemaining: RESCUE_WINDOW_TICKS,
      partnerCash:    this.partnerCash,
      message:        `Your partner is in distress. You have ${RESCUE_WINDOW_TICKS} ticks to send capital before you lose them.`,
    });
  }

  private closeRescueWindow(snapshot: Partial<RunStateSnapshot>, reason: 'RESCUED' | 'EXPIRED'): void {
    this.rescueWindowOpen = false;

    if (reason === 'EXPIRED') {
      // Partner falls if not rescued — reduce their income severely
      this.partnerIncome   = Math.floor(this.partnerIncome * 0.4);
      this.partnerNetWorth *= 0.6;

      globalEventBus.emit('RESCUE_WINDOW_EXPIRED', snapshot.tick ?? 0, {
        label:   'Rescue window expired — partner income severely damaged',
        message: 'The window closed. Your partner\'s income stream has collapsed. The syndicate is weaker.',
      });
    }
  }

  // ── Private: Process aid contract effects per tick ────────────────────────

  private processAidContracts(snapshot: RunStateSnapshot): void {
    const live = this.liveStateRef;
    if (!live) return;

    for (const contract of this.activeAidContracts) {
      if (contract.status !== 'ACTIVE') continue;

      if (contract.expiresAtTick !== null && snapshot.tick >= contract.expiresAtTick) {
        contract.status = 'COMPLETED';
        continue;
      }

      // Apply per-tick effect
      switch (contract.type) {
        case 'INCOME_SHARE':
          // Transfer per-tick income share from local to partner
          live.income        = Math.max(0, live.income - contract.terms.amount / 60);
          this.partnerIncome += contract.terms.amount / 60;
          break;
        case 'SHIELD_LEND':
          // Boost partner shield from local shield pool
          this.partnerShieldPct = Math.min(1, this.partnerShieldPct + 0.01);
          break;
        case 'EMERGENCY_CAPITAL':
          // One-time transfer — mark completed immediately
          if (live.cash >= contract.terms.amount) {
            live.cash           -= contract.terms.amount;
            this.partnerCash    += contract.terms.amount;
            this.partnerNetWorth += contract.terms.amount;
          }
          contract.status = 'COMPLETED';
          break;
      }
    }

    // Prune completed
    this.activeAidContracts = this.activeAidContracts.filter(c => c.status === 'ACTIVE');
  }

  // ── Private: Event handlers ───────────────────────────────────────────────

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
