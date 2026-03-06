// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — RUN STORE
// pzo-web/src/store/runStore.ts
//
// SOURCE OF TRUTH for all financial state consumed by EngineOrchestrator.
//
// ORCHESTRATOR CONTRACT — fields read every tick in buildRunStateSnapshot():
//   netWorth           · cashBalance       · monthlyIncome
//   monthlyExpenses    · haterHeat         · activeThreatCardCount
//
// WRITE SOURCES:
//   Financial fields → pzo-server WebSocket events via runStoreActions.applyServerEvent()
//   haterHeat         → BattleEngine writes via setHaterHeat() action
//   activeThreatCardCount → CardEngine writes via setActiveThreatCount() action
//
// READ CONTRACT (EngineOrchestrator usage):
//   const store = runStore.getState();
//   store.netWorth / store.cashBalance / store.monthlyIncome / etc.
//
// ARCHITECTURE:
//   ✦ Named export `runStore` (NOT `useRunStore`) — consumed by non-React engine code.
//   ✦ `useRunStore` hook re-exported for React components.
//   ✦ immer + subscribeWithSelector + devtools middleware stack.
//   ✦ No engine logic lives here — pure state and setters.
//
// Density6 LLC · Point Zero One · Run Store · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import { create }                          from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer }                           from 'zustand/middleware/immer';

// =============================================================================
// SECTION 1 — STATE SHAPE
// =============================================================================

export interface RunStoreState {
  // ── Initialization flag ────────────────────────────────────────────────────
  isInitialized: boolean;

  // ── Financial state — READ by EngineOrchestrator every tick ───────────────
  /** Current net worth in dollars. Freedom threshold check runs against this. */
  netWorth:          number;
  /** Liquid cash available — used in pressure signal computation. */
  cashBalance:       number;
  /** Monthly income (recurring). Used for cashflow calculation in snapshot. */
  monthlyIncome:     number;
  /** Monthly expenses (recurring). Used for cashflow = income - expenses. */
  monthlyExpenses:   number;
  /** Derived: cashBalance of current month's pro-rated position. */
  cashflow:          number;

  // ── Battle state — READ by EngineOrchestrator every tick ─────────────────
  /** Hater heat level [0.0–1.0]. Drives BattleEngine bot spawn probability. */
  haterHeat:             number;
  /** Count of threat cards currently active in the player's hand. */
  activeThreatCardCount: number;

  // ── Run metadata ──────────────────────────────────────────────────────────
  runId:      string | null;
  userId:     string | null;
  seed:       string | null;
  lastUpdated: number | null;
}

export interface CardReaderRuntimeSnapshot {
  activeThreatCardCount: number;
  haterHeat?: number;
}

export interface EngineStoreMirrorSnapshot {
  isInitialized:        boolean;
  netWorth:             number;
  cashBalance:          number;
  monthlyIncome:        number;
  monthlyExpenses:      number;
  cashflow:             number;
  haterHeat:            number;
  activeThreatCardCount:number;
  runId:                string | null;
  userId:               string | null;
  seed:                 string | null;
  lastUpdated:          number | null;
}

// =============================================================================
// SECTION 2 — ACTIONS
// =============================================================================

export interface RunStoreActions {
  // ── Lifecycle ──────────────────────────────────────────────────────────────
  initialize: (runId: string, userId: string, seed: string) => void;
  reset:      () => void;

  // ── Financial setters — called by server event handlers ───────────────────
  setNetWorth:         (v: number) => void;
  setCashBalance:      (v: number) => void;
  setMonthlyIncome:    (v: number) => void;
  setMonthlyExpenses:  (v: number) => void;

  /**
   * Apply a batch financial update from a server WebSocket event.
   * Preferred over individual setters to keep updates atomic.
   */
  applyFinancialUpdate: (update: Partial<Pick<
    RunStoreState,
    'netWorth' | 'cashBalance' | 'monthlyIncome' | 'monthlyExpenses'
  >>) => void;

  // ── Battle state setters — called by BattleEngine / CardEngine ────────────
  setHaterHeat:           (v: number) => void;
  setActiveThreatCount:   (v: number) => void;
  incrementThreatCount:   () => void;
  decrementThreatCount:   () => void;

  // ── Integration writers — atomic bridge paths from CardEngine / Orchestrator ──
  applyCombatRuntime:        (update: Partial<Pick<RunStoreState, 'haterHeat' | 'activeThreatCardCount'>>) => void;
  writeCardReaderSnapshot:   (snapshot: CardReaderRuntimeSnapshot) => void;
  writeOrchestratorSnapshot: (snapshot: Partial<EngineStoreMirrorSnapshot>) => void;
}

export type RunStoreSlice = RunStoreState & RunStoreActions;

// =============================================================================
// SECTION 3 — INITIAL STATE
// =============================================================================

const INITIAL_STATE: RunStoreState = {
  isInitialized:       false,
  netWorth:            0,
  cashBalance:         0,
  monthlyIncome:       0,
  monthlyExpenses:     0,
  cashflow:            0,
  haterHeat:           0,
  activeThreatCardCount: 0,
  runId:               null,
  userId:              null,
  seed:                null,
  lastUpdated:         null,
};

// =============================================================================
// SECTION 4 — STORE CREATION
// =============================================================================

/**
 * Non-React-bound store reference — used by EngineOrchestrator and engine code.
 *
 * Usage:
 *   import { runStore } from '../../store/runStore';
 *   const state = runStore.getState();
 *   const { netWorth, cashBalance, haterHeat } = state;
 */
export const runStore = create<RunStoreSlice>()(
  devtools(
    subscribeWithSelector(
      immer((set) => ({
        ...INITIAL_STATE,

        // ── Lifecycle ───────────────────────────────────────────────────────
        initialize: (runId, userId, seed) => set((state) => {
          state.isInitialized = true;
          state.runId         = runId;
          state.userId        = userId;
          state.seed          = seed;
          state.lastUpdated   = Date.now();
        }),

        reset: () => set(() => ({ ...INITIAL_STATE })),

        // ── Individual financial setters ────────────────────────────────────
        setNetWorth: (v) => set((state) => {
          state.netWorth    = v;
          state.lastUpdated = Date.now();
        }),

        setCashBalance: (v) => set((state) => {
          state.cashBalance = v;
          state.lastUpdated = Date.now();
        }),

        setMonthlyIncome: (v) => set((state) => {
          state.monthlyIncome = v;
          state.cashflow      = v - state.monthlyExpenses;
          state.lastUpdated   = Date.now();
        }),

        setMonthlyExpenses: (v) => set((state) => {
          state.monthlyExpenses = v;
          state.cashflow        = state.monthlyIncome - v;
          state.lastUpdated     = Date.now();
        }),

        // ── Batch financial update (preferred for WebSocket events) ─────────
        applyFinancialUpdate: (update) => set((state) => {
          if (update.netWorth        !== undefined) state.netWorth        = update.netWorth;
          if (update.cashBalance     !== undefined) state.cashBalance     = update.cashBalance;
          if (update.monthlyIncome   !== undefined) state.monthlyIncome   = update.monthlyIncome;
          if (update.monthlyExpenses !== undefined) state.monthlyExpenses = update.monthlyExpenses;
          // Recompute derived cashflow atomically
          state.cashflow    = state.monthlyIncome - state.monthlyExpenses;
          state.lastUpdated = Date.now();
        }),

        // ── Battle state setters ────────────────────────────────────────────
        setHaterHeat: (v) => set((state) => {
          // Clamp to [0.0, 1.0] — haterHeat is a normalized intensity value
          state.haterHeat   = Math.max(0, Math.min(1, v));
          state.lastUpdated = Date.now();
        }),

        setActiveThreatCount: (v) => set((state) => {
          state.activeThreatCardCount = Math.max(0, v);
          state.lastUpdated           = Date.now();
        }),

        incrementThreatCount: () => set((state) => {
          state.activeThreatCardCount += 1;
          state.lastUpdated            = Date.now();
        }),

        decrementThreatCount: () => set((state) => {
          state.activeThreatCardCount = Math.max(0, state.activeThreatCardCount - 1);
          state.lastUpdated           = Date.now();
        }),

        applyCombatRuntime: (update) => set((state) => {
          if (update.haterHeat !== undefined) {
            state.haterHeat = Math.max(0, Math.min(1, update.haterHeat));
          }
          if (update.activeThreatCardCount !== undefined) {
            state.activeThreatCardCount = Math.max(0, update.activeThreatCardCount);
          }
          state.lastUpdated = Date.now();
        }),

        writeCardReaderSnapshot: (snapshot) => set((state) => {
          state.activeThreatCardCount = Math.max(0, snapshot.activeThreatCardCount);
          if (snapshot.haterHeat !== undefined) {
            state.haterHeat = Math.max(0, Math.min(1, snapshot.haterHeat));
          }
          state.lastUpdated = Date.now();
        }),

        writeOrchestratorSnapshot: (snapshot) => set((state) => {
          if (snapshot.isInitialized        !== undefined) state.isInitialized        = snapshot.isInitialized;
          if (snapshot.netWorth             !== undefined) state.netWorth             = snapshot.netWorth;
          if (snapshot.cashBalance          !== undefined) state.cashBalance          = snapshot.cashBalance;
          if (snapshot.monthlyIncome        !== undefined) state.monthlyIncome        = snapshot.monthlyIncome;
          if (snapshot.monthlyExpenses      !== undefined) state.monthlyExpenses      = snapshot.monthlyExpenses;
          if (snapshot.haterHeat            !== undefined) state.haterHeat            = Math.max(0, Math.min(1, snapshot.haterHeat));
          if (snapshot.activeThreatCardCount!== undefined) state.activeThreatCardCount = Math.max(0, snapshot.activeThreatCardCount);
          if (snapshot.runId                !== undefined) state.runId                = snapshot.runId;
          if (snapshot.userId               !== undefined) state.userId               = snapshot.userId;
          if (snapshot.seed                 !== undefined) state.seed                 = snapshot.seed;
          if (snapshot.lastUpdated          !== undefined) state.lastUpdated          = snapshot.lastUpdated;
          state.cashflow = state.monthlyIncome - state.monthlyExpenses;
          if (snapshot.lastUpdated === undefined) state.lastUpdated = Date.now();
        }),
      }))
    ),
    { name: 'runStore' }
  )
);

// =============================================================================
// SECTION 5 — REACT HOOK ALIAS
// =============================================================================

/**
 * React hook for component subscriptions.
 * Identical store — aliased for conventional hook naming in components.
 *
 * Usage in components:
 *   const netWorth = useRunStore(s => s.netWorth);
 */
export const useRunStore = runStore;

// =============================================================================
// SECTION 6 — SELECTORS
// =============================================================================

export const selectNetWorth            = (s: RunStoreSlice) => s.netWorth;
export const selectCashBalance         = (s: RunStoreSlice) => s.cashBalance;
export const selectMonthlyIncome       = (s: RunStoreSlice) => s.monthlyIncome;
export const selectMonthlyExpenses     = (s: RunStoreSlice) => s.monthlyExpenses;
export const selectCashflow            = (s: RunStoreSlice) => s.cashflow;
export const selectHaterHeat           = (s: RunStoreSlice) => s.haterHeat;
export const selectActiveThreatCount   = (s: RunStoreSlice) => s.activeThreatCardCount;
export const selectRunId               = (s: RunStoreSlice) => s.runId;
export const selectIsInitialized       = (s: RunStoreSlice) => s.isInitialized;

/** Snapshot of all orchestrator-consumed fields — for optimized subscriptions. */
export const selectOrchestratorSnapshot = (s: RunStoreSlice) => ({
  netWorth:             s.netWorth,
  cashBalance:          s.cashBalance,
  monthlyIncome:        s.monthlyIncome,
  monthlyExpenses:      s.monthlyExpenses,
  cashflow:             s.cashflow,
  haterHeat:            s.haterHeat,
  activeThreatCardCount: s.activeThreatCardCount,
});

export const selectEngineStoreMirrorSnapshot = (s: RunStoreSlice): EngineStoreMirrorSnapshot => ({
  isInitialized:         s.isInitialized,
  netWorth:              s.netWorth,
  cashBalance:           s.cashBalance,
  monthlyIncome:         s.monthlyIncome,
  monthlyExpenses:       s.monthlyExpenses,
  cashflow:              s.cashflow,
  haterHeat:             s.haterHeat,
  activeThreatCardCount: s.activeThreatCardCount,
  runId:                 s.runId,
  userId:                s.userId,
  seed:                  s.seed,
  lastUpdated:           s.lastUpdated,
});

export function readEngineStoreMirrorSnapshot(): EngineStoreMirrorSnapshot {
  return selectEngineStoreMirrorSnapshot(runStore.getState());
}

export function writeRunStoreFromCardReader(
  reader: { getActiveThreatCardCount(): number },
  opts?: { haterHeat?: number },
): void {
  runStore.getState().writeCardReaderSnapshot({
    activeThreatCardCount: reader.getActiveThreatCardCount(),
    haterHeat:             opts?.haterHeat,
  });
}

export function writeRunStoreFromOrchestratorSnapshot(
  snapshot: Partial<EngineStoreMirrorSnapshot>,
): void {
  runStore.getState().writeOrchestratorSnapshot(snapshot);
}

// =============================================================================
// SECTION 7 — TELEMETRY SYSTEM
//
// Tracks state velocity, financial health signals, and anomaly detection
// across every runStore write. Emits structured TelemetryEvent objects to
// a flush-able queue. Wire runStoreTelemetry.flush() to your analytics
// transport (Segment, PostHog, pzo-server /telemetry) on RUN_ENDED.
//
// SIGNAL TYPES:
//   FINANCIAL_DRIFT   — netWorth delta per update exceeds ±10% threshold
//   CASHFLOW_NEGATIVE — monthlyIncome < monthlyExpenses
//   CASHFLOW_RESTORED — cashflow returns to positive after negative period
//   HEAT_SPIKE        — haterHeat rises by ≥0.15 in a single update
//   HEAT_CRITICAL     — haterHeat crosses 0.80 (high bot spawn probability)
//   HEAT_CLEARED      — haterHeat drops below 0.30 after critical
//   THREAT_SURGE      — activeThreatCardCount increases by ≥2 in a single tick
//   THREAT_CLEARED    — activeThreatCardCount reaches 0
//   WEALTH_MILESTONE  — netWorth crosses a tracked threshold (10k, 50k, 100k…)
// =============================================================================

export type TelemetrySignal =
  | 'FINANCIAL_DRIFT'
  | 'CASHFLOW_NEGATIVE'
  | 'CASHFLOW_RESTORED'
  | 'HEAT_SPIKE'
  | 'HEAT_CRITICAL'
  | 'HEAT_CLEARED'
  | 'THREAT_SURGE'
  | 'THREAT_CLEARED'
  | 'WEALTH_MILESTONE';

export interface TelemetryEvent {
  signal:    TelemetrySignal;
  runId:     string | null;
  timestamp: number;
  payload:   Record<string, number | string | boolean | null>;
}

// ─────────────────────────────────────────────────────────────────────────────
// TELEMETRY ENGINE
// ─────────────────────────────────────────────────────────────────────────────

class RunStoreTelemetry {
  private queue: TelemetryEvent[] = [];

  // ── Previous-state tracking for delta / velocity computation ───────────────
  private prevNetWorth:           number  = 0;
  private prevCashflow:           number  = 0;
  private prevHaterHeat:          number  = 0;
  private prevThreatCount:        number  = 0;
  private cashflowWasNegative:    boolean = false;
  private heatWasCritical:        boolean = false;

  // ── Wealth milestone ladder — crossed thresholds are removed ───────────────
  private readonly WEALTH_MILESTONES = [
    10_000, 25_000, 50_000, 100_000, 250_000,
    500_000, 1_000_000, 5_000_000, 10_000_000,
  ];
  private remainingMilestones: number[] = [...this.WEALTH_MILESTONES];

  // ── Thresholds ─────────────────────────────────────────────────────────────
  private static readonly DRIFT_RATIO        = 0.10; // 10% netWorth change per update
  private static readonly HEAT_SPIKE_DELTA   = 0.15;
  private static readonly HEAT_CRITICAL_LINE = 0.80;
  private static readonly HEAT_CLEAR_LINE    = 0.30;
  private static readonly THREAT_SURGE_DELTA = 2;

  // ─────────────────────────────────────────────────────────────────────────
  // EMIT
  // ─────────────────────────────────────────────────────────────────────────

  private emit(
    signal:  TelemetrySignal,
    runId:   string | null,
    payload: Record<string, number | string | boolean | null>,
  ): void {
    this.queue.push({ signal, runId, timestamp: Date.now(), payload });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // OBSERVE — called on every runStore state write
  // ─────────────────────────────────────────────────────────────────────────

  observe(state: RunStoreState): void {
    const {
      runId, netWorth, cashflow,
      haterHeat, activeThreatCardCount,
    } = state;

    // ── FINANCIAL_DRIFT ─────────────────────────────────────────────────────
    if (this.prevNetWorth !== 0) {
      const driftRatio = Math.abs(netWorth - this.prevNetWorth) / Math.abs(this.prevNetWorth);
      if (driftRatio >= RunStoreTelemetry.DRIFT_RATIO) {
        this.emit('FINANCIAL_DRIFT', runId, {
          prevNetWorth: this.prevNetWorth,
          nextNetWorth: netWorth,
          driftPct:     Math.round(driftRatio * 10000) / 100, // 2 decimal places
          direction:    netWorth > this.prevNetWorth ? 'UP' : 'DOWN',
        });
      }
    }

    // ── CASHFLOW signals ────────────────────────────────────────────────────
    const cashflowIsNegative = cashflow < 0;
    if (cashflowIsNegative && !this.cashflowWasNegative) {
      this.emit('CASHFLOW_NEGATIVE', runId, {
        cashflow,
        monthlyIncome:   state.monthlyIncome,
        monthlyExpenses: state.monthlyExpenses,
        deficit:         Math.abs(cashflow),
      });
    } else if (!cashflowIsNegative && this.cashflowWasNegative) {
      this.emit('CASHFLOW_RESTORED', runId, {
        cashflow,
        prevCashflow:    this.prevCashflow,
        monthlyIncome:   state.monthlyIncome,
        monthlyExpenses: state.monthlyExpenses,
      });
    }

    // ── HEAT signals ────────────────────────────────────────────────────────
    const heatDelta       = haterHeat - this.prevHaterHeat;
    const heatIsHigh      = haterHeat >= RunStoreTelemetry.HEAT_CRITICAL_LINE;
    const heatIsClear     = haterHeat <  RunStoreTelemetry.HEAT_CLEAR_LINE;

    if (heatDelta >= RunStoreTelemetry.HEAT_SPIKE_DELTA) {
      this.emit('HEAT_SPIKE', runId, {
        prevHeat:  Math.round(this.prevHaterHeat * 1000) / 1000,
        nextHeat:  Math.round(haterHeat * 1000) / 1000,
        delta:     Math.round(heatDelta * 1000) / 1000,
      });
    }

    if (heatIsHigh && !this.heatWasCritical) {
      this.emit('HEAT_CRITICAL', runId, {
        haterHeat: Math.round(haterHeat * 1000) / 1000,
        activeThreatCardCount,
      });
    }

    if (heatIsClear && this.heatWasCritical) {
      this.emit('HEAT_CLEARED', runId, {
        haterHeat:     Math.round(haterHeat * 1000) / 1000,
        prevPeakHeat:  Math.round(this.prevHaterHeat * 1000) / 1000,
      });
    }

    // ── THREAT signals ──────────────────────────────────────────────────────
    const threatDelta = activeThreatCardCount - this.prevThreatCount;

    if (threatDelta >= RunStoreTelemetry.THREAT_SURGE_DELTA) {
      this.emit('THREAT_SURGE', runId, {
        prevCount: this.prevThreatCount,
        nextCount: activeThreatCardCount,
        surge:     threatDelta,
      });
    }

    if (activeThreatCardCount === 0 && this.prevThreatCount > 0) {
      this.emit('THREAT_CLEARED', runId, {
        prevCount: this.prevThreatCount,
      });
    }

    // ── WEALTH_MILESTONE ────────────────────────────────────────────────────
    const crossed = this.remainingMilestones.filter(
      m => this.prevNetWorth < m && netWorth >= m
    );
    for (const milestone of crossed) {
      this.emit('WEALTH_MILESTONE', runId, {
        milestone,
        netWorth,
        exactCrossing: milestone === netWorth,
      });
      this.remainingMilestones = this.remainingMilestones.filter(m => m !== milestone);
    }

    // ── Advance previous-state snapshot ─────────────────────────────────────
    this.prevNetWorth        = netWorth;
    this.prevCashflow        = cashflow;
    this.prevHaterHeat       = haterHeat;
    this.prevThreatCount     = activeThreatCardCount;
    this.cashflowWasNegative = cashflowIsNegative;
    this.heatWasCritical     = heatIsHigh;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FLUSH — drain queue and deliver to transport
  // Call on RUN_ENDED to ship the full run's telemetry batch.
  // ─────────────────────────────────────────────────────────────────────────

  flush(
    transport: (events: TelemetryEvent[]) => void = defaultTransport,
  ): void {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0); // drain atomically
    transport(batch);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RESET — call on RUN_STARTED to clear inter-run state
  // ─────────────────────────────────────────────────────────────────────────

  reset(): void {
    this.queue                = [];
    this.prevNetWorth         = 0;
    this.prevCashflow         = 0;
    this.prevHaterHeat        = 0;
    this.prevThreatCount      = 0;
    this.cashflowWasNegative  = false;
    this.heatWasCritical      = false;
    this.remainingMilestones  = [...this.WEALTH_MILESTONES];
  }

  /** Read-only view of queued events for debugging / test assertions. */
  peek(): readonly TelemetryEvent[] {
    return this.queue;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT TRANSPORT — structured console in dev, wires to analytics in prod.
// Replace by passing a custom transport to runStoreTelemetry.flush(myTransport).
// ─────────────────────────────────────────────────────────────────────────────

function defaultTransport(events: TelemetryEvent[]): void {
  if (process.env.NODE_ENV === 'production') {
    // Production: POST batch to pzo-server /telemetry/run-store
    // Intentionally fire-and-forget — telemetry never blocks the game loop.
    fetch('/api/telemetry/run-store', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ events }),
    }).catch((err) =>
      console.warn('[runStore.telemetry] transport error:', err)
    );
  } else {
    // Development: grouped console output, one line per signal
    console.groupCollapsed(
      `[runStore.telemetry] ${events.length} event(s) — runId: ${events[0]?.runId ?? 'none'}`
    );
    for (const evt of events) {
      console.debug(
        `  %-25s  %s`,
        evt.signal,
        JSON.stringify(evt.payload),
      );
    }
    console.groupEnd();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON EXPORT — wire in ModeRouter or EngineOrchestrator bridge:
//
//   import { runStoreTelemetry } from './runStore';
//
//   // On RUN_STARTED:
//   runStoreTelemetry.reset();
//
//   // On RUN_ENDED:
//   runStoreTelemetry.flush();
//   // or with a custom transport:
//   runStoreTelemetry.flush(myAnalyticsTransport);
// ─────────────────────────────────────────────────────────────────────────────

export const runStoreTelemetry = new RunStoreTelemetry();

// ─────────────────────────────────────────────────────────────────────────────
// STORE SUBSCRIPTIONS — attach observers to the live store
// ─────────────────────────────────────────────────────────────────────────────

if (typeof window !== 'undefined') {

  // Primary observer: fires on any financial or battle state change.
  // subscribeWithSelector diffs only the selected fields — no spurious fires.
  runStore.subscribe(
    (state) => ({
      netWorth:             state.netWorth,
      cashflow:             state.cashflow,
      monthlyIncome:        state.monthlyIncome,
      monthlyExpenses:      state.monthlyExpenses,
      haterHeat:            state.haterHeat,
      activeThreatCardCount: state.activeThreatCardCount,
      runId:                state.runId,
      lastUpdated:          state.lastUpdated,
    }),
    (_next, _prev) => {
      // Observe full state (not just delta) so telemetry has access to all fields
      runStoreTelemetry.observe(runStore.getState());
    },
    {
      // Shallow equality on the selected object — only fires when values change
      equalityFn: (a, b) =>
        a.netWorth             === b.netWorth             &&
        a.cashflow             === b.cashflow             &&
        a.haterHeat            === b.haterHeat            &&
        a.activeThreatCardCount === b.activeThreatCardCount &&
        a.lastUpdated          === b.lastUpdated,
    }
  );

  // Lifecycle observer: auto-reset telemetry on run start, auto-flush on run end.
  runStore.subscribe(
    (state) => ({ runId: state.runId, isInitialized: state.isInitialized }),
    (next, prev) => {
      // New run started — runId changed from null to a value
      if (!prev.runId && next.runId) {
        runStoreTelemetry.reset();
      }
    },
    {
      equalityFn: (a, b) => a.runId === b.runId && a.isInitialized === b.isInitialized,
    }
  );
}