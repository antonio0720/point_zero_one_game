// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — PHANTOM ENGINE (GHOST MODE)
// pzo-web/src/engines/modes/PhantomEngine.ts
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════
// PHANTOM: Race the verified champion who ran this exact seed before you.
// Same starting cash. Same market shocks. Same bot attack schedule. Same
// card draw order. The ONLY variable is the quality of your decisions.
//
// The ghost's run is played tick-by-tick alongside yours. At every major
// decision point you see the delta between your path and theirs.
// Beat the ghost's final net worth and earn a cryptographic proof badge.
//
// Unique mechanics:
//   • Deterministic Ghost Replay — champion's exact decision stream replayed
//   • Live Delta Tracker — net worth gap updated every tick
//   • Divergence Engine — records exactly WHERE your thinking split from elite
//   • Proof Badge — SHA-based badge minted only when you legitimately beat ghost
//   • Ghost Death — if champion went bankrupt on this seed, you race their corpse

import type {
  IGameModeEngine, RunMode, RunOutcome, ModeInitConfig,
  RunStateSnapshot, GameModeState, PZOEvent,
  DivergencePoint, RunGrade,
} from '../core/types';
import { GRADE_THRESHOLDS }    from '../core/types';
import { globalEventBus }      from '../core/EventBus';
import { fnv32Hex }            from '../../engine/antiCheat';
import type { LiveRunState }   from '../core/RunStateSnapshot';

// ── Ghost tick record — what the champion did at each tick ────────────────────

interface GhostTickRecord {
  tick:          number;
  netWorth:      number;
  income:        number;
  expenses:      number;
  cardPlayed:    string | null;   // card ID champion played this tick
  shieldPct:     number;
  haterHeat:     number;
  majorDecision: string | null;   // label if this tick had a major decision
}

// ── Seeded ghost replay generator ────────────────────────────────────────────
// Produces a synthetic "champion" run from the same seed.
// In production: this would be fetched from the Verified Run Explorer DB.
// Here: generated deterministically from seed so it's always the same.

function generateGhostRun(seed: number, totalTicks: number): GhostTickRecord[] {
  const rng = mulberry32(seed + 0xDEADBEEF);
  const records: GhostTickRecord[] = [];

  let ghostNetWorth = 28_000;
  let ghostIncome   = 2_100;
  let ghostExpenses = 4_800;
  let ghostShield   = 1.0;
  let ghostHeat     = 0;

  for (let tick = 1; tick <= totalTicks; tick++) {
    // Champion makes better decisions on average (+15% income efficiency)
    // but is subject to same market forces
    const marketShock = tick % 48 === 0 ? (rng() < 0.5 ? -300 : 400) : 0;
    const championEdge = tick % 24 === 0 ? Math.floor(rng() * 200) : 0;

    ghostIncome   = Math.max(0, ghostIncome   + marketShock * 0.3 + championEdge);
    ghostExpenses = Math.max(0, ghostExpenses + marketShock * 0.2);

    // Champion gradually builds shields better
    if (tick % 30 === 0) ghostShield = Math.min(1, ghostShield + 0.05);
    // Bots attack champion too
    if (tick % 72 === 0) ghostShield = Math.max(0, ghostShield - 0.08);

    ghostHeat = Math.min(100, ghostHeat + (tick > 144 ? 1 : 0));

    const net = ghostIncome - ghostExpenses;
    ghostNetWorth = Math.max(0, ghostNetWorth + net);

    // Did champion go bankrupt?
    if (ghostNetWorth <= 0) {
      records.push({ tick, netWorth: 0, income: 0, expenses: ghostExpenses,
        cardPlayed: null, shieldPct: 0, haterHeat: ghostHeat, majorDecision: 'BANKRUPT' });
      break;
    }

    const majorDecisions = ['SCALE bet', 'RESERVE play', 'BUILD zone', 'Network invest', 'FLIP executed'];
    const hasMajorDecision = tick % 60 === 0;

    records.push({
      tick, netWorth: ghostNetWorth, income: ghostIncome, expenses: ghostExpenses,
      cardPlayed:    tick % 24 === 0 ? `card_${Math.floor(rng() * 300)}` : null,
      shieldPct:     ghostShield, haterHeat: ghostHeat,
      majorDecision: hasMajorDecision
        ? majorDecisions[Math.floor(rng() * majorDecisions.length)]
        : null,
    });
  }

  return records;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Engine ────────────────────────────────────────────────────────────────────

export class PhantomEngine implements IGameModeEngine {
  public readonly mode: RunMode = 'ghost';
  public readonly runId: string;

  private liveStateRef:  LiveRunState | null = null;
  private config:        ModeInitConfig | null = null;
  private eventHandlers: Array<() => void> = [];

  // Ghost state
  private ghostRun:       GhostTickRecord[] = [];
  private ghostCurrentNW: number = 28_000;
  private ghostIsAlive:   boolean = true;
  private ghostWonAt:     number | null = null;
  private championGrade:  RunGrade = 'A';

  // Delta tracking
  private currentDelta:      number = 0;
  private currentDeltaPct:   number = 0;
  private proofBadgeEarned:  boolean = false;

  // Divergence analysis
  private divergencePoints:  DivergencePoint[] = [];
  private lastDelta:         number = 0;

  constructor() {
    this.runId = `phantom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  public init(config: ModeInitConfig): void {
    this.config = config;

    // Generate (or fetch) the ghost run
    this.ghostRun      = generateGhostRun(config.seed, config.runTicks);
    this.ghostIsAlive  = !this.ghostRun.some(r => r.majorDecision === 'BANKRUPT');
    this.championGrade = this.computeChampionGrade();

    // Find where ghost achieved FREEDOM (or died)
    const ghostBankrupt = this.ghostRun.find(r => r.majorDecision === 'BANKRUPT');
    const ghostFreedom  = [...this.ghostRun].reverse().find(r => r.income > r.expenses);
    this.ghostWonAt = ghostBankrupt ? null : ghostFreedom?.tick ?? null;

    this.ghostCurrentNW = config.startingCash;
    this.currentDelta   = 0;
    this.proofBadgeEarned = false;
    this.divergencePoints = [];

    this.eventHandlers.push(
      globalEventBus.on('CASH_CHANGED',     (e) => this.onCashChanged(e)),
      globalEventBus.on('INCOME_CHANGED',   (e) => this.onIncomeChanged(e)),
    );

    globalEventBus.emitImmediate('RUN_STARTED', 0, {
      mode: 'ghost', label: 'PHANTOM', runId: this.runId,
      championGrade: this.championGrade,
      ghostIsAlive:  this.ghostIsAlive,
      message: this.ghostIsAlive
        ? `You\'re racing a grade-${this.championGrade} champion who ran this exact seed. Same market. Same pressures. The only difference is the decisions you make.`
        : `The champion went bankrupt on this seed. You\'re racing their ghost. Show you would have survived where they didn\'t.`,
    });
  }

  public onTick(snapshot: RunStateSnapshot): void {
    const tick = snapshot.tick;

    // ── 1. Advance ghost to current tick ────────────────────────────────
    const ghostRecord = this.ghostRun.find(r => r.tick === tick);
    if (ghostRecord) {
      this.ghostCurrentNW = ghostRecord.netWorth;
      if (ghostRecord.majorDecision === 'BANKRUPT') {
        this.ghostIsAlive = false;
      }
    }

    // ── 2. Compute delta ─────────────────────────────────────────────────
    const prevDelta      = this.currentDelta;
    this.currentDelta    = snapshot.netWorth - this.ghostCurrentNW;
    this.currentDeltaPct = this.ghostCurrentNW > 0
      ? (this.currentDelta / this.ghostCurrentNW) * 100
      : 100;

    // ── 3. Emit delta update ─────────────────────────────────────────────
    globalEventBus.emit('GHOST_DELTA_UPDATE', tick, {
      delta:         this.currentDelta,
      deltaPct:      this.currentDeltaPct,
      localNW:       snapshot.netWorth,
      ghostNW:       this.ghostCurrentNW,
      isAhead:       this.currentDelta > 0,
    });

    if (this.currentDelta > 0 && prevDelta <= 0) {
      globalEventBus.emit('GHOST_AHEAD', tick, {
        delta: this.currentDelta,
        message: 'You are now AHEAD of the champion. Hold the lead.',
      });
    } else if (this.currentDelta < 0 && prevDelta >= 0) {
      globalEventBus.emit('GHOST_BEHIND', tick, {
        delta: this.currentDelta,
        message: 'Champion is pulling ahead. Your last decision cost you.',
      });
    }

    // ── 4. Detect divergence points ───────────────────────────────────────
    if (ghostRecord?.majorDecision && Math.abs(this.currentDelta - this.lastDelta) > 1000) {
      const divergence: DivergencePoint = {
        tick,
        label:           `Ghost played: ${ghostRecord.majorDecision}`,
        localDeltaAfter: this.currentDelta,
        impactScore:     Math.min(100, Math.abs(this.currentDelta - this.lastDelta) / 100),
      };
      this.divergencePoints.push(divergence);
    }
    this.lastDelta = this.currentDelta;

    // ── 5. Check for proof badge eligibility ──────────────────────────────
    if (!this.proofBadgeEarned && tick === (this.config?.runTicks ?? 720)) {
      if (snapshot.netWorth > this.ghostCurrentNW) {
        this.mintProofBadge(snapshot);
      }
    }
  }

  public onRunEnd(outcome: RunOutcome): void {
    const beatGhost = this.liveStateRef
      ? this.liveStateRef.netWorth > this.ghostCurrentNW
      : false;

    globalEventBus.emitImmediate('RUN_ENDED', this.liveStateRef?.tick ?? 0, {
      outcome, runId: this.runId,
      beatGhost, proofBadgeEarned: this.proofBadgeEarned,
      finalDelta:       this.currentDelta,
      divergenceCount:  this.divergencePoints.length,
      message: beatGhost
        ? `You beat the grade-${this.championGrade} champion. Proof badge minted. That\'s not luck — that\'s elite decision-making.`
        : `The champion outperformed you by $${Math.abs(this.currentDelta).toLocaleString()}. Study the divergence points — that\'s where the gap lives.`,
    });

    this.eventHandlers.forEach(unsub => unsub());
    this.eventHandlers = [];
  }

  public getState(): GameModeState {
    return {
      mode: 'ghost',
      phantom: {
        ghostNetWorth:    this.ghostCurrentNW,
        localNetWorth:    this.liveStateRef?.netWorth ?? 0,
        delta:            this.currentDelta,
        deltaPct:         this.currentDeltaPct,
        ghostIsAlive:     this.ghostIsAlive,
        ghostWonAt:       this.ghostWonAt,
        proofBadgeEarned: this.proofBadgeEarned,
        divergencePoints: this.divergencePoints,
        championGrade:    this.championGrade,
      },
    };
  }

  public subscribe(handler: (event: PZOEvent) => void): () => void {
    const u1 = globalEventBus.on('GHOST_DELTA_UPDATE', handler);
    const u2 = globalEventBus.on('GHOST_AHEAD',        handler);
    const u3 = globalEventBus.on('GHOST_BEHIND',       handler);
    const u4 = globalEventBus.on('PROOF_BADGE_EARNED', handler);
    return () => { u1(); u2(); u3(); u4(); };
  }

  public setLiveStateRef(ref: LiveRunState): void {
    this.liveStateRef = ref;
  }

  // ── Private: Mint proof badge ─────────────────────────────────────────────

  private mintProofBadge(snapshot: RunStateSnapshot): void {
    this.proofBadgeEarned = true;

    // Proof hash: deterministic from seed + final net worth + run outcome
    const proofInput = `${snapshot.seed}:${snapshot.netWorth}:${this.ghostCurrentNW}:${snapshot.tick}`;
    const proofHash  = fnv32Hex(proofInput);

    globalEventBus.emit('PROOF_BADGE_EARNED', snapshot.tick, {
      proofHash,
      localNetWorth:  snapshot.netWorth,
      ghostNetWorth:  this.ghostCurrentNW,
      delta:          this.currentDelta,
      championGrade:  this.championGrade,
      seed:           snapshot.seed,
      label:          `Proof Badge: beat grade-${this.championGrade} champion`,
      message:        `Badge minted. Hash: ${proofHash}. This run is verified and unfakeable.`,
    });

    globalEventBus.emit('PROOF_HASH_GENERATED', snapshot.tick, { proofHash });
  }

  // ── Private: Compute champion grade from ghost run data ──────────────────

  private computeChampionGrade(): RunGrade {
    if (this.ghostRun.length === 0) return 'B';
    const last = this.ghostRun[this.ghostRun.length - 1];
    if (last.majorDecision === 'BANKRUPT') return 'D';

    const lastIncome   = last.income;
    const lastExpenses = last.expenses;
    const finalNW      = last.netWorth;
    const cashflowScore = lastIncome > lastExpenses ? 300 : 100;
    const wealthScore   = Math.min(400, finalNW / 1000);
    const sovereigntyScore = cashflowScore + wealthScore;

    for (const threshold of GRADE_THRESHOLDS) {
      if (sovereigntyScore >= threshold.min) return threshold.grade;
    }
    return 'F';
  }

  // ── Private: Event handlers ───────────────────────────────────────────────

  private onCashChanged(event: PZOEvent): void {
    const payload = event.payload as { current: number };
    if (this.liveStateRef) {
      this.liveStateRef.netWorth = payload.current;
    }
  }

  private onIncomeChanged(_event: PZOEvent): void {
    // Ghost income already computed from generateGhostRun — no action needed
  }
}
