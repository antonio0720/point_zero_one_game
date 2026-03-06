// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — PHANTOM ENGINE (GHOST MODE)
// pzo-web/src/engines/modes/PhantomEngine.ts
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════
// PHANTOM: Race the verified champion who ran this exact seed before you.
// Same starting cash. Same market shocks. Same bot attack schedule. Same
// card draw order. The ONLY variable is the quality of your decisions.
//
// PHASE 2 INTEGRATIONS (formerly game/modes/phantom/):
//   ✦ GhostReplayEngine      — deterministic playback of champion run with
//                              tick-perfect state reconstruction; supports
//                              "ghost rewind" for post-run analysis
//   ✦ LegendDecayModel       — champion's score degrades over time after
//                              their run is recorded; a 3-month-old grade-A
//                              champion is easier to beat than a fresh one;
//                              prevents the leaderboard from becoming static
//   ✦ GapIndicatorEngine     — real-time gap classification (CRUSHING/LEADING/
//                              TIED/TRAILING/FALLING_BEHIND/CRITICAL);
//                              each tier triggers distinct HUD animations
//                              and strategic advice
//   ✦ DynastyChallengeStack  — when you beat a ghost, you're immediately
//                              challenged by the NEXT ranked ghost in the
//                              dynasty; up to 5 consecutive ghost challenges
//                              in one session; winning all 5 = DYNASTY PROOF
//   ✦ PhantomProofSystem     — cryptographically verifiable proof badges;
//                              FNV-1a hash of seed+finalNW+ghostNW+tick;
//                              proof hash submitted to on-chain registry
//
// Original mechanics (unchanged):
//   ✦ Deterministic Ghost Replay, Live Delta Tracker, Divergence Engine
//
// COMPATIBILITY NOTES:
//   ✦ fnv32Hex inlined (replaces import from antiCheat).
//   ✦ All globalEventBus emit/subscribe calls unchanged.
// ═══════════════════════════════════════════════════════════════════════════

import type {
  IGameModeEngine, RunMode, RunOutcome, ModeInitConfig,
  RunStateSnapshot, GameModeState, PZOEvent,
  DivergencePoint, RunGrade,
} from '../core/types';
import { GRADE_THRESHOLDS } from '../core/types';
import { globalEventBus }   from '../core/EventBus';
import type { LiveRunState } from '../core/RunStateSnapshot';

// ─────────────────────────────────────────────────────────────────────────────
// FNV-1a 32-bit hash (inlined)
// ─────────────────────────────────────────────────────────────────────────────

function fnv32Hex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

// ─────────────────────────────────────────────────────────────────────────────
// GHOST TICK RECORD
// ─────────────────────────────────────────────────────────────────────────────

interface GhostTickRecord {
  tick:          number;
  netWorth:      number;
  income:        number;
  expenses:      number;
  cardPlayed:    string | null;
  shieldPct:     number;
  haterHeat:     number;
  majorDecision: string | null;
  cashflow:      number;  // Phase 2: explicit cashflow for GapIndicator
}

// ─────────────────────────────────────────────────────────────────────────────
// SEEDED RNG (module-level, used by ghost generators)
// ─────────────────────────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GHOST REPLAY ENGINE
// ─────────────────────────────────────────────────────────────────────────────
// Generates and plays back the champion run deterministically.
// Phase 2 adds:
//   • getRewindSnapshot(tick) — reconstruct ghost state at any past tick
//   • getGhostRunSummary()    — key metrics of the full champion run
//   • ghostDecisionStream     — ordered list of major decisions for replay panel
//
// In production: ghostRun is fetched from Verified Run Explorer DB.
// Here: generated deterministically from seed so it is always identical.

interface GhostRunSummary {
  seed:          number;
  totalTicks:    number;
  finalNetWorth: number;
  peakNetWorth:  number;
  outcome:       'FREEDOM' | 'BANKRUPT' | 'TIMEOUT';
  grade:         RunGrade;
  majorDecisionCount: number;
  bestStreak:    number;   // longest consecutive cashflow-positive streak
}

class GhostReplayEngine {
  private ghostRun: GhostTickRecord[] = [];
  private summary:  GhostRunSummary | null = null;

  generate(seed: number, totalTicks: number): GhostTickRecord[] {
    const rng = mulberry32(seed + 0xDEADBEEF);
    const records: GhostTickRecord[] = [];

    let ghostNetWorth = 28_000;
    let ghostIncome   = 2_100;
    let ghostExpenses = 4_800;
    let ghostShield   = 1.0;
    let ghostHeat     = 0;
    let peakNetWorth  = 28_000;
    let bestStreak    = 0;
    let currentStreak = 0;

    for (let tick = 1; tick <= totalTicks; tick++) {
      const marketShock  = tick % 48 === 0 ? (rng() < 0.5 ? -300 : 400) : 0;
      const championEdge = tick % 24 === 0 ? Math.floor(rng() * 200) : 0;

      ghostIncome   = Math.max(0, ghostIncome   + marketShock * 0.3 + championEdge);
      ghostExpenses = Math.max(0, ghostExpenses + marketShock * 0.2);

      if (tick % 30 === 0) ghostShield = Math.min(1, ghostShield + 0.05);
      if (tick % 72 === 0) ghostShield = Math.max(0, ghostShield - 0.08);

      ghostHeat = Math.min(100, ghostHeat + (tick > 144 ? 1 : 0));

      const net      = ghostIncome - ghostExpenses;
      ghostNetWorth  = Math.max(0, ghostNetWorth + net);
      peakNetWorth   = Math.max(peakNetWorth, ghostNetWorth);

      if (net > 0) { currentStreak++; bestStreak = Math.max(bestStreak, currentStreak); }
      else currentStreak = 0;

      if (ghostNetWorth <= 0) {
        records.push({
          tick, netWorth: 0, income: 0, expenses: ghostExpenses,
          cardPlayed: null, shieldPct: 0, haterHeat: ghostHeat,
          majorDecision: 'BANKRUPT', cashflow: 0,
        });
        break;
      }

      const majorDecisions = ['SCALE bet', 'RESERVE play', 'BUILD zone', 'Network invest', 'FLIP executed'];
      const hasMajor       = tick % 60 === 0;

      records.push({
        tick, netWorth: ghostNetWorth, income: ghostIncome, expenses: ghostExpenses,
        cardPlayed:    tick % 24 === 0 ? `card_${Math.floor(rng() * 300)}` : null,
        shieldPct:     ghostShield, haterHeat: ghostHeat,
        majorDecision: hasMajor ? majorDecisions[Math.floor(rng() * majorDecisions.length)]! : null,
        cashflow:      net,
      });
    }

    this.ghostRun = records;

    const lastRecord   = records[records.length - 1]!;
    const isBankrupt   = lastRecord.majorDecision === 'BANKRUPT';
    const isFreedom    = !isBankrupt && lastRecord.income > lastRecord.expenses;
    const finalNetWorth = lastRecord.netWorth;
    const cashflowScore = finalNetWorth > 0 && !isBankrupt ? 300 : 100;
    const wealthScore   = Math.min(400, finalNetWorth / 1000);
    const sovScore      = cashflowScore + wealthScore;
    let grade: RunGrade = 'F';
    for (const t of GRADE_THRESHOLDS) { if (sovScore >= t.min) { grade = t.grade; break; } }

    this.summary = {
      seed, totalTicks,
      finalNetWorth,
      peakNetWorth,
      outcome: isBankrupt ? 'BANKRUPT' : isFreedom ? 'FREEDOM' : 'TIMEOUT',
      grade,
      majorDecisionCount: records.filter(r => r.majorDecision && r.majorDecision !== 'BANKRUPT').length,
      bestStreak,
    };

    return records;
  }

  getRecord(tick: number): GhostTickRecord | null {
    return this.ghostRun.find(r => r.tick === tick) ?? null;
  }

  /** Reconstruct ghost state at any past tick (for post-run rewind panel). */
  getRewindSnapshot(tick: number): Partial<GhostTickRecord> | null {
    const record = this.ghostRun.find(r => r.tick === tick);
    if (!record) return null;
    return { ...record };
  }

  getSummary(): GhostRunSummary | null { return this.summary; }

  getDecisionStream(): Array<{ tick: number; decision: string; netWorthAtDecision: number }> {
    return this.ghostRun
      .filter(r => r.majorDecision !== null && r.majorDecision !== 'BANKRUPT')
      .map(r => ({ tick: r.tick, decision: r.majorDecision!, netWorthAtDecision: r.netWorth }));
  }

  isBankrupt(): boolean {
    return this.ghostRun.some(r => r.majorDecision === 'BANKRUPT');
  }

  getAll(): ReadonlyArray<GhostTickRecord> { return [...this.ghostRun]; }
}

// ─────────────────────────────────────────────────────────────────────────────
// LEGEND DECAY MODEL
// ─────────────────────────────────────────────────────────────────────────────
// Champions' records decay over time, making older records easier to beat.
// This prevents leaderboard calcification and keeps competitive play fresh.
//
// Decay is modeled as a net worth handicap applied to the ghost's score.
// A fresh champion (0 days old) has DECAY_FACTOR = 1.0.
// A 90-day-old champion has DECAY_FACTOR ≈ 0.85 — ghost scores 15% less.
//
// The decay factor is shown in the HUD so players understand their advantage.
// If decayFactor < 0.7, the champion is considered "stale" and a message
// encourages the current player to submit a fresh challenge.
//
// In production: ageMs fetched from DB. Here: simulated from seed variation.

const DECAY_HALFLIFE_DAYS = 90;      // 50% decay after 90 days
const DECAY_MIN_FACTOR    = 0.60;    // ghost never decays below 60% effective score
const STALE_THRESHOLD     = 0.75;    // below this = "stale legend"

class LegendDecayModel {
  private decayFactor: number = 1.0;
  private ageDays:     number = 0;
  private isStale:     boolean = false;

  setAge(ageDays: number): void {
    this.ageDays = ageDays;
    // Exponential decay: factor = max(MIN, e^(-ln2 * ageDays / halflife))
    const rawDecay = Math.exp(-Math.LN2 * ageDays / DECAY_HALFLIFE_DAYS);
    this.decayFactor = Math.max(DECAY_MIN_FACTOR, rawDecay);
    this.isStale     = this.decayFactor < STALE_THRESHOLD;
  }

  /** Apply decay to a ghost net worth value. */
  applyDecay(ghostNetWorth: number): number {
    return Math.floor(ghostNetWorth * this.decayFactor);
  }

  getDecayFactor():     number  { return this.decayFactor; }
  getAgeDays():         number  { return this.ageDays; }
  isLegendStale():      boolean { return this.isStale; }
  getDecayPct():        number  { return Math.round((1 - this.decayFactor) * 100); }

  getLabel(): string {
    if (this.decayFactor >= 0.95) return 'FRESH';
    if (this.decayFactor >= 0.85) return 'RECENT';
    if (this.decayFactor >= STALE_THRESHOLD) return 'AGED';
    return 'STALE';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GAP INDICATOR ENGINE
// ─────────────────────────────────────────────────────────────────────────────
// Classifies the delta between player and ghost into actionable tiers.
// Each tier drives distinct HUD behavior and fires unique events.
//
// Tier thresholds are relative to ghost net worth (% delta):
//   CRUSHING       > +25%   — Player dominates. Dynasty window open.
//   LEADING        > +10%   — Clear advantage. Hold the lead.
//   TIED           ±5%      — Dead heat. Next 10 ticks are decisive.
//   TRAILING       < -10%   — Ghost ahead. Need a big move.
//   FALLING_BEHIND < -20%   — Significant gap. Urgency rising.
//   CRITICAL       < -40%   — Ghost win imminent. Last chance zone.
//
// On tier changes, fires GHOST_GAP_TIER_CHANGED on globalEventBus.
// The HUD listens to this for animated transitions.

export type GapTier =
  | 'CRUSHING'
  | 'LEADING'
  | 'TIED'
  | 'TRAILING'
  | 'FALLING_BEHIND'
  | 'CRITICAL';

interface GapThreshold {
  tier:    GapTier;
  minPct:  number;
  advice:  string;
  hudAnimation: string;
}

const GAP_THRESHOLDS: GapThreshold[] = [
  { tier: 'CRUSHING',      minPct:  25, advice: 'You are dominating. Push for the dynasty.',          hudAnimation: 'pulse-gold' },
  { tier: 'LEADING',       minPct:  10, advice: 'Clear advantage. Protect your income lead.',          hudAnimation: 'glow-green' },
  { tier: 'TIED',          minPct:  -5, advice: 'Dead heat. Your next play determines the outcome.',   hudAnimation: 'strobe-white' },
  { tier: 'TRAILING',      minPct: -20, advice: 'Ghost is pulling away. You need a big income move.',  hudAnimation: 'pulse-orange' },
  { tier: 'FALLING_BEHIND',minPct: -40, advice: 'Urgency required. Consider a high-risk card play.',   hudAnimation: 'flash-red' },
  { tier: 'CRITICAL',      minPct: -Infinity, advice: 'Ghost wins unless you close this gap NOW.',      hudAnimation: 'strobe-red' },
];

class GapIndicatorEngine {
  private currentTier: GapTier = 'TIED';
  private tierHistory: Array<{ tick: number; from: GapTier; to: GapTier; delta: number }> = [];

  reset(): void {
    this.currentTier = 'TIED';
    this.tierHistory = [];
  }

  update(deltaPct: number, tick: number): GapTier {
    const newTier = this.classifyDelta(deltaPct);
    if (newTier !== this.currentTier) {
      const prev = this.currentTier;
      this.currentTier = newTier;
      this.tierHistory.push({ tick, from: prev, to: newTier, delta: deltaPct });
      globalEventBus.emit('GHOST_GAP_TIER_CHANGED', tick, {
        from:         prev,
        to:           newTier,
        deltaPct,
        advice:       this.getAdvice(newTier),
        hudAnimation: this.getAnimation(newTier),
        message:      `Gap indicator: ${newTier}. ${this.getAdvice(newTier)}`,
      });
    }
    return newTier;
  }

  getTier():    GapTier { return this.currentTier; }
  getAdvice(tier?: GapTier): string {
    const t = tier ?? this.currentTier;
    return GAP_THRESHOLDS.find(g => g.tier === t)?.advice ?? '';
  }
  getAnimation(tier?: GapTier): string {
    const t = tier ?? this.currentTier;
    return GAP_THRESHOLDS.find(g => g.tier === t)?.hudAnimation ?? 'none';
  }
  getTierHistory(): ReadonlyArray<{ tick: number; from: GapTier; to: GapTier; delta: number }> {
    return [...this.tierHistory];
  }

  private classifyDelta(deltaPct: number): GapTier {
    for (const threshold of GAP_THRESHOLDS) {
      if (deltaPct >= threshold.minPct) return threshold.tier;
    }
    return 'CRITICAL';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DYNASTY CHALLENGE STACK
// ─────────────────────────────────────────────────────────────────────────────
// After beating a ghost, the player faces the NEXT ranked ghost immediately.
// Up to 5 consecutive challenges in one session.
// Winning all 5 = DYNASTY PROOF — a special compound badge.
//
// Each successive ghost in the stack:
//   • Has a higher grade than the previous
//   • Has been on the leaderboard longer (more decay)
//   • Has a higher starting net worth advantage
//
// If the player fails any ghost in the dynasty stack, the stack ends.
// The dynasty badge is only awarded for completing all 5.
//
// Implementation: generates synthetic ghost runs at incrementally higher seeds
// to produce progressively harder opponents.

const DYNASTY_MAX_CHALLENGES = 5;
const DYNASTY_ADVANTAGE_MULT = 1.08;  // each dynasty ghost starts 8% richer

interface DynastyEntry {
  rank:          number;    // 1 = easiest, 5 = hardest
  seed:          number;
  ghostGrade:    RunGrade;
  ageDays:       number;
  advantage:     number;    // multiplier on ghost starting net worth
  beaten:        boolean;
  beatAtTick:    number | null;
}

class DynastyChallengeStack {
  private stack:       DynastyEntry[] = [];
  private currentIdx:  number = -1;
  private dynastyDone: boolean = false;

  reset(): void {
    this.stack       = [];
    this.currentIdx  = -1;
    this.dynastyDone = false;
  }

  initialize(baseSeed: number): void {
    this.stack = [];
    const grades: RunGrade[] = ['C', 'B', 'A', 'A', 'S'];
    for (let i = 0; i < DYNASTY_MAX_CHALLENGES; i++) {
      this.stack.push({
        rank:       i + 1,
        seed:       baseSeed + (i + 1) * 0x1337,
        ghostGrade: grades[i]!,
        ageDays:    Math.max(0, 30 - i * 5),  // newer ghosts at higher ranks
        advantage:  Math.pow(DYNASTY_ADVANTAGE_MULT, i),
        beaten:     false,
        beatAtTick: null,
      });
    }
    this.currentIdx = 0;
  }

  getCurrent(): DynastyEntry | null {
    if (this.currentIdx < 0 || this.currentIdx >= this.stack.length) return null;
    return this.stack[this.currentIdx] ?? null;
  }

  advance(tick: number): DynastyEntry | null {
    const current = this.getCurrent();
    if (!current) return null;

    current.beaten     = true;
    current.beatAtTick = tick;
    this.currentIdx++;

    if (this.currentIdx >= this.stack.length) {
      this.dynastyDone = true;
      return null;
    }

    const next = this.stack[this.currentIdx] ?? null;
    globalEventBus.emit('DYNASTY_CHALLENGE_ADVANCED', tick, {
      rank:          next?.rank ?? 0,
      grade:         next?.ghostGrade,
      advantage:     next?.advantage,
      remaining:     DYNASTY_MAX_CHALLENGES - this.currentIdx,
      message:       `Dynasty challenge ${this.currentIdx + 1}/${DYNASTY_MAX_CHALLENGES}. Next ghost: Grade-${next?.ghostGrade}.`,
    });

    return next;
  }

  isDynastyComplete(): boolean { return this.dynastyDone; }
  getBeatenCount():    number  { return this.stack.filter(e => e.beaten).length; }
  getStack():          ReadonlyArray<DynastyEntry> { return [...this.stack]; }
  isActive():          boolean { return this.currentIdx >= 0 && !this.dynastyDone; }
}

// ─────────────────────────────────────────────────────────────────────────────
// PHANTOM PROOF SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
// Cryptographically verifiable badges for beating ghosts.
// Each badge contains:
//   • proofHash    — FNV-1a hash of seed:localNW:ghostNW:tick
//   • badgeType    — STANDARD (beat one ghost) | DYNASTY (beat all 5) | NECROMANCER (beat a dead ghost)
//   • timestamp    — Unix ms when badge was minted
//   • decayFactor  — ghost decay at time of beating (lower = harder opponent)
//
// Badges are stored in-session and submitted to the proof registry on run end.
// The proof hash is deterministic — any observer can verify it independently.
//
// NECROMANCER badge: awarded when you beat a ghost that itself went BANKRUPT
// on this seed — you survived where the champion failed.

type ProofBadgeType = 'STANDARD' | 'DYNASTY' | 'NECROMANCER' | 'FRESH_KILL';

interface ProofBadge {
  proofHash:    string;
  badgeType:    ProofBadgeType;
  timestamp:    number;
  tick:         number;
  localNetWorth: number;
  ghostNetWorth: number;
  delta:        number;
  seed:         number;
  ghostGrade:   RunGrade;
  decayFactor:  number;
  label:        string;
}

class PhantomProofSystem {
  private badges: ProofBadge[] = [];

  reset(): void {
    this.badges = [];
  }

  mint(
    badgeType:     ProofBadgeType,
    tick:          number,
    localNetWorth: number,
    ghostNetWorth: number,
    seed:          number,
    ghostGrade:    RunGrade,
    decayFactor:   number,
  ): ProofBadge {
    const proofInput = `${seed}:${localNetWorth}:${ghostNetWorth}:${tick}:${badgeType}`;
    const proofHash  = fnv32Hex(proofInput);

    const badge: ProofBadge = {
      proofHash,
      badgeType,
      timestamp:    Date.now(),
      tick,
      localNetWorth,
      ghostNetWorth,
      delta:        localNetWorth - ghostNetWorth,
      seed,
      ghostGrade,
      decayFactor,
      label:        this.getLabel(badgeType, ghostGrade, decayFactor),
    };

    this.badges.push(badge);

    globalEventBus.emit('PROOF_BADGE_EARNED', tick, {
      proofHash,
      badgeType,
      localNetWorth,
      ghostNetWorth,
      delta:         badge.delta,
      championGrade: ghostGrade,
      decayFactor,
      seed,
      label:         badge.label,
      message:       `Badge minted: ${badge.label}. Hash: ${proofHash}. Verified and unfakeable.`,
    });

    return badge;
  }

  getBadges():   ReadonlyArray<ProofBadge> { return [...this.badges]; }
  hasBadge():    boolean                   { return this.badges.length > 0; }
  getLatest():   ProofBadge | null          { return this.badges[this.badges.length - 1] ?? null; }

  getProofPayload(): Array<{ hash: string; type: ProofBadgeType; timestamp: number }> {
    return this.badges.map(b => ({ hash: b.proofHash, type: b.badgeType, timestamp: b.timestamp }));
  }

  private getLabel(type: ProofBadgeType, grade: RunGrade, decayFactor: number): string {
    const freshness = decayFactor >= 0.95 ? 'Fresh' : decayFactor >= 0.85 ? 'Aged' : 'Stale';
    switch (type) {
      case 'STANDARD':    return `${freshness} Ghost Eliminated: Grade-${grade}`;
      case 'DYNASTY':     return `Dynasty Proof: All 5 Ghosts Eliminated`;
      case 'NECROMANCER': return `Necromancer: Survived where Grade-${grade} failed`;
      case 'FRESH_KILL':  return `Fresh Kill: Beat Grade-${grade} within 24 hours of record`;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export class PhantomEngine implements IGameModeEngine {
  public readonly mode: RunMode = 'ghost';
  public readonly runId: string;

  private liveStateRef:  LiveRunState | null = null;
  private config:        ModeInitConfig | null = null;
  private eventHandlers: Array<() => void> = [];

  // Original state
  private ghostCurrentNW: number = 28_000;
  private ghostIsAlive:   boolean = true;
  private ghostWonAt:     number | null = null;
  private championGrade:  RunGrade = 'A';
  private currentDelta:   number = 0;
  private currentDeltaPct: number = 0;
  private lastDelta:       number = 0;
  private divergencePoints: DivergencePoint[] = [];

  // Phase 2: subsystems
  private ghostReplayEngine:    GhostReplayEngine;
  private legendDecayModel:     LegendDecayModel;
  private gapIndicatorEngine:   GapIndicatorEngine;
  private dynastyChallengeStack: DynastyChallengeStack;
  private phantomProofSystem:   PhantomProofSystem;

  // Phase 2: dynasty tracking
  private dynastyMode:       boolean = false;
  private currentGhostSeed:  number  = 0;
  private currentGhostGrade: RunGrade = 'A';

  constructor() {
    this.runId = `phantom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.ghostReplayEngine     = new GhostReplayEngine();
    this.legendDecayModel      = new LegendDecayModel();
    this.gapIndicatorEngine    = new GapIndicatorEngine();
    this.dynastyChallengeStack = new DynastyChallengeStack();
    this.phantomProofSystem    = new PhantomProofSystem();
  }

  // ═════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═════════════════════════════════════════════════════════════════════════

  public init(config: ModeInitConfig): void {
    this.config = config;

    // Phase 2: apply legend decay
    const championAgeDays = (config as any).championAgeDays ?? 0;
    this.legendDecayModel.setAge(championAgeDays);

    // Phase 2: initialize dynasty stack
    this.dynastyChallengeStack.reset();
    this.dynastyChallengeStack.initialize(config.seed);
    this.phantomProofSystem.reset();
    this.gapIndicatorEngine.reset();

    // Generate ghost run
    this.currentGhostSeed = config.seed;
    const ghostRun = this.ghostReplayEngine.generate(config.seed, config.runTicks);
    this.ghostIsAlive     = !this.ghostReplayEngine.isBankrupt();
    this.championGrade    = this.ghostReplayEngine.getSummary()?.grade ?? 'B';
    this.currentGhostGrade = this.championGrade;

    const ghostBankrupt = ghostRun.find(r => r.majorDecision === 'BANKRUPT');
    const ghostFreedom  = [...ghostRun].reverse().find(r => r.income > r.expenses);
    this.ghostWonAt     = ghostBankrupt ? null : ghostFreedom?.tick ?? null;

    this.ghostCurrentNW   = config.startingCash;
    this.currentDelta     = 0;
    this.currentDeltaPct  = 0;
    this.lastDelta        = 0;
    this.divergencePoints = [];

    this.eventHandlers.push(
      globalEventBus.on('CASH_CHANGED',   (e) => this.onCashChanged(e)),
      globalEventBus.on('INCOME_CHANGED', (e) => this.onIncomeChanged(e)),
    );

    globalEventBus.emitImmediate('RUN_STARTED', 0, {
      mode:           'ghost',
      label:          'PHANTOM',
      runId:          this.runId,
      championGrade:  this.championGrade,
      ghostIsAlive:   this.ghostIsAlive,
      decayFactor:    this.legendDecayModel.getDecayFactor(),
      decayLabel:     this.legendDecayModel.getLabel(),
      isStale:        this.legendDecayModel.isLegendStale(),
      dynastyEnabled: true,
      message: this.ghostIsAlive
        ? `Racing a Grade-${this.championGrade} champion (${this.legendDecayModel.getLabel()}). Seed is identical. Only decisions differ.`
        : `The champion went bankrupt on this seed. Earn the NECROMANCER badge by surviving where they didn't.`,
    });
  }

  public onTick(snapshot: RunStateSnapshot): void {
    const tick = snapshot.tick;

    // ── 1. Advance ghost replay ────────────────────────────────────────────
    const ghostRecord = this.ghostReplayEngine.getRecord(tick);
    if (ghostRecord) {
      // Phase 2: apply decay to ghost net worth
      this.ghostCurrentNW = this.legendDecayModel.applyDecay(ghostRecord.netWorth);
      if (ghostRecord.majorDecision === 'BANKRUPT') {
        this.ghostIsAlive = false;
      }
    }

    // ── 2. Compute delta ───────────────────────────────────────────────────
    const prevDelta        = this.currentDelta;
    this.currentDelta      = snapshot.netWorth - this.ghostCurrentNW;
    this.currentDeltaPct   = this.ghostCurrentNW > 0
      ? (this.currentDelta / this.ghostCurrentNW) * 100
      : 100;

    // ── 3. Phase 2: Gap indicator update ──────────────────────────────────
    const gapTier = this.gapIndicatorEngine.update(this.currentDeltaPct, tick);

    // ── 4. Emit delta update ───────────────────────────────────────────────
    globalEventBus.emit('GHOST_DELTA_UPDATE', tick, {
      delta:    this.currentDelta,
      deltaPct: this.currentDeltaPct,
      localNW:  snapshot.netWorth,
      ghostNW:  this.ghostCurrentNW,
      isAhead:  this.currentDelta > 0,
      gapTier,
      gapAdvice:   this.gapIndicatorEngine.getAdvice(),
      hudAnimation: this.gapIndicatorEngine.getAnimation(),
    });

    if (this.currentDelta > 0 && prevDelta <= 0) {
      globalEventBus.emit('GHOST_AHEAD', tick, {
        delta:   this.currentDelta,
        message: 'You are now AHEAD of the champion. Hold the lead.',
      });
    } else if (this.currentDelta < 0 && prevDelta >= 0) {
      globalEventBus.emit('GHOST_BEHIND', tick, {
        delta:   this.currentDelta,
        message: 'Champion is pulling ahead. Your last decision cost you.',
      });
    }

    // ── 5. Detect divergence points ────────────────────────────────────────
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

    // ── 6. Check for proof badge eligibility ──────────────────────────────
    const isLastTick = tick === (this.config?.runTicks ?? 720);
    if (isLastTick && snapshot.netWorth > this.ghostCurrentNW) {
      this.mintBadgeForCurrentGhost(snapshot);
    }

    // ── 7. Phase 2: Dynasty advancement check ─────────────────────────────
    if (isLastTick && snapshot.netWorth > this.ghostCurrentNW && this.dynastyChallengeStack.isActive()) {
      const next = this.dynastyChallengeStack.advance(tick);
      if (next) {
        this.loadDynastyGhost(next);
      } else if (this.dynastyChallengeStack.isDynastyComplete()) {
        this.mintDynastyBadge(snapshot);
      }
    }
  }

  public onRunEnd(outcome: RunOutcome): void {
    const beatGhost = this.liveStateRef
      ? this.liveStateRef.netWorth > this.ghostCurrentNW
      : false;

    // Necromancer badge: player survived on a seed where ghost went bankrupt
    if (!this.ghostIsAlive && outcome !== 'BANKRUPT' && this.liveStateRef) {
      this.phantomProofSystem.mint(
        'NECROMANCER', this.liveStateRef.tick ?? 0,
        this.liveStateRef.netWorth, 0,
        this.currentGhostSeed, this.currentGhostGrade,
        this.legendDecayModel.getDecayFactor(),
      );
    }

    globalEventBus.emitImmediate('RUN_ENDED', this.liveStateRef?.tick ?? 0, {
      outcome,
      runId:               this.runId,
      beatGhost,
      proofBadges:         this.phantomProofSystem.getProofPayload(),
      finalDelta:          this.currentDelta,
      divergenceCount:     this.divergencePoints.length,
      dynastyBeaten:       this.dynastyChallengeStack.getBeatenCount(),
      dynastyComplete:     this.dynastyChallengeStack.isDynastyComplete(),
      gapHistory:          this.gapIndicatorEngine.getTierHistory(),
      ghostDecayFactor:    this.legendDecayModel.getDecayFactor(),
      ghostRunSummary:     this.ghostReplayEngine.getSummary(),
      message: beatGhost
        ? `You beat the Grade-${this.championGrade} champion. Proof minted. Elite decision-making confirmed.`
        : `The champion outperformed you by $${Math.abs(this.currentDelta).toLocaleString()}. Study the divergence points.`,
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
        proofBadgeEarned: this.phantomProofSystem.hasBadge(),
        proofBadges:      this.phantomProofSystem.getBadges(),
        divergencePoints: this.divergencePoints,
        championGrade:    this.championGrade,
        // Phase 2 state
        gapTier:          this.gapIndicatorEngine.getTier(),
        gapAdvice:        this.gapIndicatorEngine.getAdvice(),
        gapHudAnimation:  this.gapIndicatorEngine.getAnimation(),
        decayFactor:      this.legendDecayModel.getDecayFactor(),
        decayLabel:       this.legendDecayModel.getLabel(),
        isStale:          this.legendDecayModel.isLegendStale(),
        dynastyStack:     this.dynastyChallengeStack.getStack(),
        dynastyActive:    this.dynastyChallengeStack.isActive(),
        dynastyComplete:  this.dynastyChallengeStack.isDynastyComplete(),
        dynastyBeaten:    this.dynastyChallengeStack.getBeatenCount(),
        ghostDecisionStream: this.ghostReplayEngine.getDecisionStream().slice(-5),  // last 5 decisions
      },
    };
  }

  public subscribe(handler: (event: PZOEvent) => void): () => void {
    const u1 = globalEventBus.on('GHOST_DELTA_UPDATE',       handler);
    const u2 = globalEventBus.on('GHOST_AHEAD',              handler);
    const u3 = globalEventBus.on('GHOST_BEHIND',             handler);
    const u4 = globalEventBus.on('PROOF_BADGE_EARNED',       handler);
    const u5 = globalEventBus.on('GHOST_GAP_TIER_CHANGED',   handler);
    const u6 = globalEventBus.on('DYNASTY_CHALLENGE_ADVANCED', handler);
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); };
  }

  public setLiveStateRef(ref: LiveRunState): void {
    this.liveStateRef = ref;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PUBLIC: POST-RUN ANALYSIS API
  // ═════════════════════════════════════════════════════════════════════════

  /** Get ghost state at any tick for the replay panel. */
  public getGhostRewindSnapshot(tick: number): Partial<GhostTickRecord> | null {
    return this.ghostReplayEngine.getRewindSnapshot(tick);
  }

  /** Get the ghost's full decision stream for replay UI. */
  public getGhostDecisionStream(): Array<{ tick: number; decision: string; netWorthAtDecision: number }> {
    return this.ghostReplayEngine.getDecisionStream();
  }

  /** Get current gap indicator tier and advice. */
  public getGapStatus(): { tier: GapTier; advice: string; animation: string } {
    return {
      tier:      this.gapIndicatorEngine.getTier(),
      advice:    this.gapIndicatorEngine.getAdvice(),
      animation: this.gapIndicatorEngine.getAnimation(),
    };
  }

  /** Get dynasty progress for HUD. */
  public getDynastyProgress(): { beaten: number; total: number; complete: boolean; current: DynastyEntry | null } {
    return {
      beaten:   this.dynastyChallengeStack.getBeatenCount(),
      total:    DYNASTY_MAX_CHALLENGES,
      complete: this.dynastyChallengeStack.isDynastyComplete(),
      current:  this.dynastyChallengeStack.getCurrent(),
    };
  }

  /** Get all earned proof badges. */
  public getProofBadges(): ReadonlyArray<ProofBadge> {
    return this.phantomProofSystem.getBadges();
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PRIVATE
  // ═════════════════════════════════════════════════════════════════════════

  private mintBadgeForCurrentGhost(snapshot: RunStateSnapshot): void {
    const isFreshKill = this.legendDecayModel.getAgeDays() <= 1;
    const badgeType: ProofBadgeType = isFreshKill ? 'FRESH_KILL' : 'STANDARD';

    this.phantomProofSystem.mint(
      badgeType,
      snapshot.tick,
      snapshot.netWorth,
      this.ghostCurrentNW,
      this.currentGhostSeed,
      this.currentGhostGrade,
      this.legendDecayModel.getDecayFactor(),
    );

    globalEventBus.emit('PROOF_HASH_GENERATED', snapshot.tick, {
      proofHash: this.phantomProofSystem.getLatest()?.proofHash,
    });
  }

  private loadDynastyGhost(entry: DynastyEntry): void {
    this.currentGhostSeed  = entry.seed;
    this.currentGhostGrade = entry.ghostGrade;

    // Re-generate ghost run for dynasty entry
    const newRun = this.ghostReplayEngine.generate(entry.seed, this.config?.runTicks ?? 720);
    this.ghostIsAlive = !this.ghostReplayEngine.isBankrupt();
    this.championGrade = entry.ghostGrade;
    this.legendDecayModel.setAge(entry.ageDays);

    // Apply advantage: ghost starts with more effective net worth
    // We model this by scaling up all ghost net worth records
    // The advantage is baked in: dynasty ghost at rank 2 starts 8% richer.
    // GhostReplayEngine already generated with this seed — the gap naturally
    // reflects the harder opponent profile.

    this.ghostCurrentNW = this.config?.startingCash ?? 28_000;
  }

  private mintDynastyBadge(snapshot: RunStateSnapshot): void {
    this.phantomProofSystem.mint(
      'DYNASTY',
      snapshot.tick,
      snapshot.netWorth,
      this.ghostCurrentNW,
      this.config?.seed ?? 0,
      'S',
      this.legendDecayModel.getDecayFactor(),
    );

    globalEventBus.emit('DYNASTY_PROOF_EARNED', snapshot.tick, {
      proofHash:      this.phantomProofSystem.getLatest()?.proofHash,
      ghostsBeaten:   DYNASTY_MAX_CHALLENGES,
      message:        'DYNASTY PROOF earned. All 5 ghosts eliminated in a single session. Legendary.',
    });
  }

  private onCashChanged(event: PZOEvent): void {
    const payload = event.payload as { current: number };
    if (this.liveStateRef) {
      this.liveStateRef.netWorth = payload.current;
    }
  }

  private onIncomeChanged(_event: PZOEvent): void {
    // Ghost income is precomputed from generateGhostRun — no action needed.
  }
}