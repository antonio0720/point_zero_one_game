// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — DEMO ORCHESTRATOR
// pzo_engine/src/demo/DemoOrchestrator.ts
//
// Lightweight run driver for the demo environment.
// Wires directly to the game logic layer (game/runtime/runReducer + game/types)
// WITHOUT importing React hooks or the Zustand engine store.
//
// This is the correct demo architecture:
//   - Real type contracts from game/types (no mock types)
//   - Real runReducer for state transitions (same reducer as production)
//   - Real constants from game/core/constants
//   - Real sovereignty/CORD calculation from game/sovereignty
//   - No React, no Zustand, no browser APIs — pure TypeScript Node.js runner
//
// WHY NOT use engines/zero/EngineOrchestrator directly?
//   The real Orchestrator imports from ../../store/runStore (Zustand),
//   which imports React hooks. That breaks in Node.js.
//   The DemoOrchestrator simulates the same 13-step tick sequence
//   using the public-facing event contracts the Orchestrator emits.
//
// RELATIONSHIP TO PRODUCTION:
//   DemoOrchestrator is NOT a replacement for EngineOrchestrator.
//   It is a Node.js-compatible harness that exercises the same game contracts.
//   Production: React → useRunLoop → dispatch(RunEvent) → runReducer
//   Demo:       DemoOrchestrator.tick() → buildEvents() → runReducer directly
//
// Density6 LLC · Point Zero One · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import type { GameMode }     from '../../../pzo-web/src/game/types/modes';
import type { RunState }     from '../../../pzo-web/src/game/types/runState';
import type { RunEvent }     from '../../../pzo-web/src/game/types/events';
import type { CardInHand }   from '../../../pzo-web/src/game/types/cards';
import type { RunOutcome }   from '../../../pzo-web/src/game/types/cord';
import {
  createInitialRunState,
  STARTING_CASH, STARTING_INCOME, STARTING_EXPENSES,
  FREEDOM_THRESHOLD,
} from '../../../pzo-web/src/game/types/runState';
import { seededRng }         from '../../../pzo-web/src/game/core/rng';
import { clamp }             from '../../../pzo-web/src/game/core/math';
import { computeCordScore }  from '../../../pzo-web/src/game/sovereignty/cordCalculator';
import { buildProofHash }    from '../../../pzo-web/src/game/sovereignty/proofHash';
import {
  DEMO_TICK_BUDGET,
  DEMO_FREEDOM_THRESHOLD,
  DEMO_SEEDS,
  DEMO_REPORT_EVERY,
  DEMO_CLIENT_VERSION,
  DEMO_ENGINE_VERSION,
  DEMO_PLAYER_ID,
  TUTORIAL_BEATS_GLOBAL,
  TUTORIAL_BEATS_BY_MODE,
  type TutorialBeat,
} from './demo-config';
import {
  MONTH_TICKS,
  DRAW_TICKS,
  MAX_HAND,
  PRESSURE_CRITICAL_THRESHOLD,
  FREEDOM_THRESHOLD as PROD_FREEDOM_THRESHOLD,
} from '../../../pzo-web/src/game/core/constants';

// ─── Extended RunState for demo-specific ext fields ─────────────────────────────
// Production runState has modeExt fields added by Sprint 8.
// Here we extend with demo-only tracking that doesn't pollute production types.
export interface DemoRunState extends RunState {
  // Demo counters
  _cardsPlayed:    number;
  _cardsDrawn:     number;
  _crisisCount:    number;
  _shieldBreaches: number;
  _settlementCount: number;
  // Derived pressure score (0–1, computed by demo orchestrator)
  _pressureScore:  number;
  // Energy system
  _energy:         number;
  _maxEnergy:      number;
  // Current hand (managed here, not in base RunState)
  _hand:           CardInHand[];
}

// ─── Demo Run Result ───────────────────────────────────────────────────────────
export interface DemoRunResult {
  finalState:    DemoRunState;
  outcome:       RunOutcome;
  cordScore:     number;
  cordTier:      string;
  grade:         string;
  proofHash:     string;
  totalXP:       number;
  ticksRun:      number;
  cardsPlayed:   number;
  beatsTriggered: TutorialBeat[];
}

// ─── DEMO ORCHESTRATOR ────────────────────────────────────────────────────────
export class DemoOrchestrator {

  private readonly mode:    GameMode;
  private readonly seed:    string;
  private readonly rng:     () => number;

  // Import runReducer lazily to avoid circular dep issues
  private reducer!: (state: RunState, event: RunEvent) => RunState;

  // Beat tracking
  private firedBeats:    Set<number> = new Set();
  private pendingBeats:  TutorialBeat[] = [];
  private allBeats:      TutorialBeat[] = [];
  private triggeredBeats: TutorialBeat[] = [];

  // Deck simulation (simplified but typed correctly)
  private deck: CardInHand[] = [];

  constructor(mode: GameMode) {
    this.mode = mode;
    this.seed = DEMO_SEEDS[mode];
    this.rng  = seededRng(this.seed);
  }

  // ── Initialize run ──────────────────────────────────────────────────────────
  async init(): Promise<void> {
    // Dynamic import so this module stays Node-safe
    const { runReducer } = await import('../../../pzo-web/src/game/runtime/runReducer');
    this.reducer = runReducer;

    // Build beat schedule
    this.allBeats = [
      ...TUTORIAL_BEATS_GLOBAL,
      ...TUTORIAL_BEATS_BY_MODE[this.mode],
    ].sort((a, b) => a.tick - b.tick);

    // Initialize demo card deck
    this.deck = this.buildDemoDeck();
  }

  // ── Build initial state ─────────────────────────────────────────────────────
  buildInitialState(): DemoRunState {
    const base = createInitialRunState(this.mode);

    const state: DemoRunState = {
      ...base,
      // Override freedom threshold to demo value
      _cardsPlayed:     0,
      _cardsDrawn:      0,
      _crisisCount:     0,
      _shieldBreaches:  0,
      _settlementCount: 0,
      _pressureScore:   0,
      _energy:          3,
      _maxEnergy:       5,
      _hand:            [],
    };

    return state;
  }

  // ── Single tick execution ────────────────────────────────────────────────────
  /**
   * executeTick() — processes one tick.
   * Returns updated state + any beats that fired this tick.
   */
  tick(state: DemoRunState, tick: number): {
    state:  DemoRunState;
    beats:  TutorialBeat[];
    events: string[];
  } {
    const beats:  TutorialBeat[] = [];
    const events: string[] = [];
    let   s = { ...state };

    // ── Step 1: Check tutorial beats ─────────────────────────────────────────
    for (const beat of this.allBeats) {
      if (beat.tick === tick && !this.firedBeats.has(beat.tick)) {
        this.firedBeats.add(beat.tick);
        beats.push(beat);
        this.triggeredBeats.push(beat);
      }
    }

    // ── Step 2: Update pressure (simplified simulation) ───────────────────────
    const cashRatio     = s.cash / STARTING_CASH;
    const incomeRatio   = s.income / s.expenses;
    const rawPressure   = clamp(1 - (cashRatio * 0.4 + incomeRatio * 0.3 + 0.3), 0, 1);
    s._pressureScore    = rawPressure;

    // ── Step 3: Monthly settlement ────────────────────────────────────────────
    if (tick > 0 && tick % MONTH_TICKS === 0) {
      const net = s.income - s.expenses;
      s = this.reducer(s, {
        type:    'MONTHLY_SETTLEMENT',
        tick,
        income:  s.income,
        expenses: s.expenses,
        net,
      } as RunEvent) as DemoRunState;
      s._settlementCount++;
      events.push(`SETTLEMENT(net=${net > 0 ? '+' : ''}${net})`);
    }

    // ── Step 4: Card draw ─────────────────────────────────────────────────────
    if (tick % DRAW_TICKS === 0 && s._hand.length < MAX_HAND) {
      const drawn = this.drawCards(MAX_HAND - s._hand.length);
      s._hand      = [...s._hand, ...drawn];
      s._cardsDrawn += drawn.length;
    }

    // ── Step 5: Energy regen ──────────────────────────────────────────────────
    s._energy = Math.min(s._maxEnergy, s._energy + 1);

    // ── Step 6: Pressure crisis check ─────────────────────────────────────────
    if (s._pressureScore >= PRESSURE_CRITICAL_THRESHOLD) {
      s._crisisCount++;
      events.push(`PRESSURE_CRISIS(${(s._pressureScore * 100).toFixed(1)}%)`);
    }

    // ── Step 7: Win/loss check ────────────────────────────────────────────────
    if (s.netWorth >= DEMO_FREEDOM_THRESHOLD) {
      s = this.reducer(s, { type: 'RUN_COMPLETE', tick, outcome: 'FREEDOM' } as RunEvent) as DemoRunState;
      events.push('FREEDOM_ACHIEVED');
    } else if (s.cash <= 0) {
      s = this.reducer(s, { type: 'RUN_COMPLETE', tick, outcome: 'BANKRUPT' } as RunEvent) as DemoRunState;
      events.push('BANKRUPT');
    }

    return { state: s, beats, events };
  }

  // ── Play a card ──────────────────────────────────────────────────────────────
  playCard(state: DemoRunState, card: CardInHand, tick: number): DemoRunState {
    if (state._energy < card.cost) return state;

    let s = { ...state };
    s._energy     = s._energy - card.cost;
    s._hand       = s._hand.filter(c => c.id !== card.id);
    s._cardsPlayed++;

    // Apply card effect to run state via reducer
    s = this.reducer(s, {
      type:   'CARD_PLAYED',
      tick,
      cardId: card.id,
      card:   card.name,
      effect: card.baseEffect,
      // Card income effect
      incomeBoost: (card.baseEffect as any)?.incomeDelta ?? 0,
      cashBoost:   (card.baseEffect as any)?.cashDelta   ?? 0,
    } as unknown as RunEvent) as DemoRunState;

    return s;
  }

  // ── Draw cards ───────────────────────────────────────────────────────────────
  drawCards(count: number): CardInHand[] {
    const drawn: CardInHand[] = [];
    for (let i = 0; i < count; i++) {
      if (this.deck.length === 0) this.deck = this.buildDemoDeck();
      const idx  = Math.floor(this.rng() * this.deck.length);
      const card = this.deck.splice(idx, 1)[0];
      drawn.push(card);
    }
    return drawn;
  }

  // ── Finalize run ─────────────────────────────────────────────────────────────
  finalize(state: DemoRunState, tick: number): DemoRunResult {
    const outcome: RunOutcome = state.phase === 'FREEDOM'   ? 'FREEDOM'
                              : state.phase === 'BANKRUPT'  ? 'BANKRUPT'
                              : 'TIMEOUT';

    const cordScore = computeCordScore({
      outcome,
      ticksRun:         tick,
      totalTicks:       DEMO_TICK_BUDGET,
      cashflow:         state.income - state.expenses,
      netWorth:         state.netWorth,
      crisisCount:      state._crisisCount,
      shieldBreaches:   state._shieldBreaches,
      cardsPlayed:      state._cardsPlayed,
      freedomThreshold: DEMO_FREEDOM_THRESHOLD,
      mode:             this.mode,
    });

    const grade    = this.computeGrade(cordScore);
    const cordTier = this.computeCordTier(cordScore);

    const proofHash = buildProofHash({
      runId:      `DEMO-${this.mode}-${this.seed}`,
      userId:     DEMO_PLAYER_ID,
      seed:       this.seed,
      tick,
      cordScore,
      outcome,
      mode:       this.mode,
    });

    const totalXP = Math.floor(cordScore * 10 + state._settlementCount * 50 + state._cardsPlayed * 5);

    return {
      finalState:     state,
      outcome,
      cordScore,
      cordTier,
      grade,
      proofHash,
      totalXP,
      ticksRun:       tick,
      cardsPlayed:    state._cardsPlayed,
      beatsTriggered: this.triggeredBeats,
    };
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  private computeGrade(cord: number): string {
    if (cord >= 950) return 'S+';
    if (cord >= 900) return 'S';
    if (cord >= 800) return 'A+';
    if (cord >= 700) return 'A';
    if (cord >= 600) return 'B+';
    if (cord >= 500) return 'B';
    if (cord >= 400) return 'C';
    return 'D';
  }

  private computeCordTier(cord: number): string {
    if (cord >= 950) return 'SOVEREIGN';
    if (cord >= 800) return 'APEX';
    if (cord >= 600) return 'ASCENDANT';
    if (cord >= 400) return 'CONTENDER';
    return 'NOVICE';
  }

  /**
   * buildDemoDeck() — constructs a typed demo card deck per mode.
   * Cards have real CardInHand shapes but simplified baseEffects.
   * In production, DeckBuilder.ts handles this with full rng + policies.
   */
  private buildDemoDeck(): CardInHand[] {
    // Shared base cards (all modes)
    const base: CardInHand[] = [
      this.makeCard('LONG_001',   'Income Stream',      'LONG',     1, { incomeDelta: 150 }),
      this.makeCard('LONG_002',   'Equity Position',    'LONG',     2, { incomeDelta: 320 }),
      this.makeCard('MACRO_001',  'Market Hedge',       'MACRO',    2, { incomeDelta: 200, cashDelta: 500 }),
      this.makeCard('MACRO_002',  'Sector Rotation',    'MACRO',    3, { incomeDelta: 450 }),
      this.makeCard('HEDGE_001',  'Risk Reduction',     'HEDGE',    1, { cashDelta: 1200 }),
      this.makeCard('HEDGE_002',  'Stop Loss Protocol', 'HEDGE',    2, { cashDelta: 2500 }),
      this.makeCard('RECOVERY_1', 'Cashflow Recovery',  'RECOVERY', 2, { incomeDelta: 600, cashDelta: 1000 }),
    ];

    // Mode-specific cards
    const modeCards: Record<GameMode, CardInHand[]> = {
      EMPIRE: [
        this.makeCard('EMPIRE_001', 'Comeback Surge',    'COMEBACK', 3, { incomeDelta: 1200, cashDelta: 3000 }),
        this.makeCard('EMPIRE_002', 'Empire Expansion',  'LONG',     2, { incomeDelta: 500 }),
        this.makeCard('EMPIRE_003', 'Isolation Shield',  'HEDGE',    1, { cashDelta: 800 }),
      ],
      PREDATOR: [
        this.makeCard('PRED_001',   'Counterplay Strike', 'COUNTER',  2, { cashDelta: 2000 }),
        this.makeCard('PRED_002',   'Short Attack',       'SHORT',    2, { cashDelta: 1500 }),
        this.makeCard('PRED_003',   'Psyche Stabilizer',  'RECOVERY', 1, { incomeDelta: 100 }),
      ],
      SYNDICATE: [
        this.makeCard('SYN_001',    'Aid Contract',       'AID',      2, { incomeDelta: 400, cashDelta: 500 }),
        this.makeCard('SYN_002',    'Trust Builder',      'LONG',     1, { incomeDelta: 200 }),
        this.makeCard('SYN_003',    'Treasury Infusion',  'MACRO',    3, { cashDelta: 4000 }),
      ],
      PHANTOM: [
        this.makeCard('PH_001',     'Ghost Burst',        'MACRO',    2, { incomeDelta: 350, cashDelta: 1000 }),
        this.makeCard('PH_002',     'Legend Surge',       'LONG',     2, { incomeDelta: 600 }),
        this.makeCard('PH_003',     'Dynasty Card',       'MACRO',    3, { incomeDelta: 900 }),
      ],
    };

    return [...base, ...modeCards[this.mode]];
  }

  private makeCard(
    id:       string,
    name:     string,
    cardType: string,
    cost:     number,
    effect:   { incomeDelta?: number; cashDelta?: number },
  ): CardInHand {
    return {
      id,
      name,
      cardType:    cardType as any,
      deckType:    cardType as any,
      cost,
      leverage:    effect.incomeDelta ?? effect.cashDelta ?? 0,
      baseEffect:  effect as any,
      modeOverlay: null,
      timingClass: 'TACTICAL' as any,
      rarity:      'COMMON' as any,
      tags:        [] as any,
      targeting:   'SELF' as any,
      visibilityScope: 'SELF' as any,
    } as CardInHand;
  }
}