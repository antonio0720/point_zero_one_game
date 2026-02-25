// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — ENGINE ORCHESTRATOR
// pzo-web/src/engines/core/EngineOrchestrator.ts
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════
// The conductor. Sequences the 13-step tick loop. Wires all mode engines.
// Does NOT play any instrument. It makes sure every instrument plays at
// the right moment, in the right order, with the right inputs.
//
// CARDINAL LAW: The Orchestrator is the ONLY code that calls engine methods.
// React hooks, stores, and components NEVER call engine methods directly.

import type {
  RunMode,
  RunOutcome,
  ModeInitConfig,
  TickTier,
  PressureTier,
  IGameModeEngine,
  GameModeState,
  PZOEvent,
  BotId,
  ShieldLayerId,
} from './types';
import { TICK_DURATION_MS, BOT_PROFILES } from './types';
import { globalEventBus }   from './EventBus';
import {
  buildSnapshot,
  createInitialLiveState,
  type LiveRunState,
} from './RunStateSnapshot';

// ── Engine step result (per-step error boundary) ──────────────────────────────

interface StepResult {
  step:    number;
  success: boolean;
  error?:  Error;
  durationMs: number;
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

export class EngineOrchestrator {
  private liveState:    LiveRunState | null = null;
  private modeEngine:   IGameModeEngine | null = null;
  private tickTimer:    ReturnType<typeof setTimeout> | null = null;
  private stepLog:      StepResult[] = [];
  private runActive:    boolean = false;
  private totalTicks:   number = 720;
  private holdsLeft:    number = 1;      // 1 hold action per run (freezes timer 5s)

  // ── Pressure signal weights (9 signals) ──────────────────────────────────
  private readonly PRESSURE_WEIGHTS = {
    cashflowRatio:     0.25,  // income / expenses
    liquidityPct:      0.20,  // cash / (cash + expenses * 3)
    haterHeat:         0.18,  // hater_heat / 100
    shieldIntegrity:   0.15,  // 1 - overallIntegrityPct (lower shield = higher pressure)
    cascadeCount:      0.10,  // active cascade chains / 3
    netWorthMomentum:  0.07,  // negative = pressure up
    activeBotCount:    0.05,  // bots in TARGETING or ATTACKING
  };

  constructor(private readonly runTicks = 720) {
    this.totalTicks = runTicks;
  }

  // ── Run lifecycle ─────────────────────────────────────────────────────────

  public async startRun(config: ModeInitConfig, engine: IGameModeEngine): Promise<void> {
    if (this.runActive) {
      console.warn('[Orchestrator] startRun() called while run is already active.');
      return;
    }

    this.modeEngine  = engine;
    this.liveState   = createInitialLiveState({
      seed:             config.seed,
      startingCash:     config.startingCash,
      startingIncome:   config.startingIncome,
      startingExpenses: config.startingExpenses,
      runMode:          engine.mode,
    });
    this.liveState.lifecycle = 'STARTING';
    this.holdsLeft   = 1;
    this.stepLog     = [];
    this.runActive   = true;

    // Initialize mode engine
    engine.init(config);

    this.liveState.lifecycle = 'ACTIVE';
    globalEventBus.emitImmediate('RUN_STARTED', 0, { mode: engine.mode, seed: config.seed });

    // Kick off the tick loop
    this.scheduleNextTick();
  }

  public endRun(outcome: RunOutcome): void {
    if (!this.runActive) return;
    this.runActive = false;
    if (this.tickTimer) clearTimeout(this.tickTimer);

    if (this.liveState) this.liveState.lifecycle = 'ENDING';
    this.modeEngine?.onRunEnd(outcome);
    if (this.liveState) this.liveState.lifecycle = 'ENDED';

    globalEventBus.emitImmediate('RUN_ENDED', this.liveState?.tick ?? 0, { outcome });
  }

  public pauseRun(): void {
    if (this.tickTimer) { clearTimeout(this.tickTimer); this.tickTimer = null; }
  }

  public resumeRun(): void {
    if (this.runActive && !this.tickTimer) this.scheduleNextTick();
  }

  /** Spend the 1 hold action to freeze the timer for 5 seconds. */
  public spendHold(): boolean {
    if (this.holdsLeft <= 0) return false;
    this.holdsLeft--;
    this.pauseRun();
    setTimeout(() => { if (this.runActive) this.resumeRun(); }, 5000);
    return true;
  }

  public getHoldsRemaining(): number { return this.holdsLeft; }

  public getModeState(): GameModeState | null {
    return this.modeEngine?.getState() ?? null;
  }

  public getLiveState(): LiveRunState | null {
    return this.liveState;
  }

  public isRunActive(): boolean { return this.runActive; }

  // ── The 13-step tick sequence ─────────────────────────────────────────────

  private async executeTick(): Promise<void> {
    if (!this.liveState || !this.modeEngine) return;

    this.liveState.lifecycle = 'TICK_LOCKED';
    const tickStart = performance.now();

    // ── Step 0: Assemble frozen snapshot ─────────────────────────────────
    const snapshot = buildSnapshot(this.liveState);

    // ── Step 1: Advance tick counter ──────────────────────────────────────
    this.execStep(1, () => {
      this.liveState!.tick += 1;
      globalEventBus.emit('TICK_START', snapshot.tick, { tick: this.liveState!.tick });
    });

    // ── Step 2: Apply income & expenses ───────────────────────────────────
    this.execStep(2, () => {
      const net = snapshot.income - snapshot.expenses;
      this.liveState!.cash     = Math.max(0, snapshot.cash + net);
      this.liveState!.netWorth = this.liveState!.cash;
      globalEventBus.emit('CASH_CHANGED', snapshot.tick, {
        prev: snapshot.cash, current: this.liveState!.cash, delta: net,
      });
    });

    // ── Step 3: Shield passive regen ─────────────────────────────────────
    this.execStep(3, () => {
      const REGEN = { L1_LIQUIDITY_BUFFER: 2, L2_CREDIT_LINE: 2, L3_ASSET_FLOOR: 1, L4_NETWORK_CORE: 1 };
      for (const [id, layer] of Object.entries(this.liveState!.shields.layers)) {
        if (layer.regenActive && layer.current < layer.max) {
          layer.current = Math.min(layer.max, layer.current + (REGEN as Record<string,number>)[id]);
        }
      }
    });

    // ── Step 4: Bot state machine transitions ─────────────────────────────
    this.execStep(4, () => {
      this.tickBotStateMachines(snapshot);
    });

    // ── Step 5: Mode engine tick (mode-specific logic) ────────────────────
    this.execStep(5, () => {
      this.modeEngine!.onTick(snapshot);
    });

    // ── Step 6: Pressure score recalculation ─────────────────────────────
    this.execStep(6, () => {
      const newScore = this.computePressureScore(snapshot);
      const prevTier = snapshot.pressureTier;
      this.liveState!.pressureScore = newScore;
      const newTier = this.scoreToPressureTier(newScore);
      if (newTier !== prevTier) {
        globalEventBus.emit('PRESSURE_TIER_CHANGED', snapshot.tick, { prev: prevTier, current: newTier });
      }
      globalEventBus.emit('PRESSURE_SCORE_UPDATE', snapshot.tick, { score: newScore, tier: newTier });
    });

    // ── Step 7: Tick tier recalculation ───────────────────────────────────
    this.execStep(7, () => {
      this.liveState!.tickTier = this.pressureTierToTickTier(
        this.scoreToPressureTier(this.liveState!.pressureScore)
      );
    });

    // ── Step 8: Process active cascade chain links ────────────────────────
    this.execStep(8, () => {
      this.processCascadeLinks(snapshot);
    });

    // ── Step 9: Apply active sabotage/modifiers ───────────────────────────
    this.execStep(9, () => {
      // Handled inside mode engine — it writes to liveState directly.
      // Orchestrator only fires the event to inform subscribers.
    });

    // ── Step 10: Win/loss condition check ─────────────────────────────────
    this.execStep(10, () => {
      const s = this.liveState!;
      if (s.tick >= this.totalTicks) {
        const outcome: RunOutcome = s.income > s.expenses ? 'FREEDOM' : 'TIMEOUT';
        this.endRun(outcome);
        return;
      }
      if (s.cash <= 0) {
        this.endRun('BANKRUPT');
        return;
      }
    });

    // ── Step 11: Sovereignty snapshot record ──────────────────────────────
    this.execStep(11, () => {
      // SovereigntyEngine snapshotTick() — passively records run state for proof hash.
      // Not yet fully implemented; wire when SovereigntyEngine is built.
    });

    // ── Step 12: Emit tick end signal ─────────────────────────────────────
    this.execStep(12, () => {
      const tickMs = performance.now() - tickStart;
      globalEventBus.emit('TICK_END', this.liveState!.tick, {
        tick: this.liveState!.tick,
        durationMs: tickMs,
        stepErrors: this.stepLog.filter(s => !s.success).length,
      });
    });

    // ── Step 13: FLUSH EventBus — all deferred events fire here ──────────
    globalEventBus.flush();

    this.liveState.lifecycle = 'ACTIVE';

    // Schedule next tick if run still active
    if (this.runActive) this.scheduleNextTick();
  }

  // ── Tick scheduler ────────────────────────────────────────────────────────

  private scheduleNextTick(): void {
    const tier = this.liveState?.tickTier ?? 'T1';
    const durationMs = TICK_DURATION_MS[tier];
    this.tickTimer = setTimeout(() => this.executeTick(), durationMs);
  }

  // ── Step executor with error boundary ────────────────────────────────────

  private execStep(step: number, fn: () => void): void {
    const start = performance.now();
    try {
      fn();
      this.stepLog.push({ step, success: true, durationMs: performance.now() - start });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error(`[Orchestrator] Step ${step} failed:`, error.message);
      this.stepLog.push({ step, success: false, error, durationMs: performance.now() - start });
      // Non-fatal: tick sequence continues. Only BANKRUPT/FREEDOM halt the run.
    }
  }

  // ── Pressure score calculation (9 signals) ────────────────────────────────

  private computePressureScore(snap: typeof buildSnapshot extends (...args: never[]) => infer R ? R : never): number {
    const { cash, income, expenses, haterHeat, shields, activeCascades, botStates } = snap;

    const cashflowRatio    = income > 0 ? Math.min(1, expenses / income) : 1.0;
    const liquidityPct     = 1 - Math.min(1, cash / Math.max(1, expenses * 3));
    const heatSignal       = haterHeat / 100;
    const shieldSignal     = 1 - shields.overallIntegrityPct;
    const cascadeSignal    = Math.min(1, activeCascades.length / 3);
    const botSignal        = Math.min(1,
      Object.values(botStates).filter(b =>
        b.state === 'TARGETING' || b.state === 'ATTACKING'
      ).length / 3
    );

    const raw =
      cashflowRatio    * this.PRESSURE_WEIGHTS.cashflowRatio +
      liquidityPct     * this.PRESSURE_WEIGHTS.liquidityPct +
      heatSignal       * this.PRESSURE_WEIGHTS.haterHeat +
      shieldSignal     * this.PRESSURE_WEIGHTS.shieldIntegrity +
      cascadeSignal    * this.PRESSURE_WEIGHTS.cascadeCount +
      botSignal        * this.PRESSURE_WEIGHTS.activeBotCount;

    // Max decay 0.05/tick — no single-tick recovery from high pressure
    const prevScore = this.liveState!.pressureScore;
    if (raw < prevScore) {
      return Math.max(raw, prevScore - 0.05);
    }
    return Math.min(1.0, raw);
  }

  private scoreToPressureTier(score: number): PressureTier {
    if (score >= 0.85) return 'CRITICAL';
    if (score >= 0.65) return 'HIGH';
    if (score >= 0.45) return 'ELEVATED';
    if (score >= 0.20) return 'BUILDING';
    return 'CALM';
  }

  private pressureTierToTickTier(tier: PressureTier): TickTier {
    const map: Record<PressureTier, TickTier> = {
      CALM:     'T0',
      BUILDING: 'T1',
      ELEVATED: 'T2',
      HIGH:     'T3',
      CRITICAL: 'T4',
    };
    return map[tier];
  }

  // ── Bot FSM ───────────────────────────────────────────────────────────────

  private tickBotStateMachines(snap: ReturnType<typeof buildSnapshot>): void {
    const { haterHeat, tick, shields } = snap;
    const live = this.liveState!;

    for (const [botId, runtime] of Object.entries(live.botStates) as [BotId, typeof live.botStates[BotId]][]) {
      const id      = botId as typeof runtime['id'];
      const profile = this.getBotProfile(id);
      if (!profile) continue;

      runtime.ticksInState++;
      const prevState = runtime.state;

      switch (runtime.state) {
        case 'DORMANT':
          if (haterHeat >= profile.escalationHeat) {
            runtime.state = 'WATCHING';
          }
          break;

        case 'WATCHING':
          if (haterHeat >= profile.targetingHeat || shields.overallIntegrityPct < 0.5) {
            runtime.state            = 'TARGETING';
            runtime.preloadedArrival = tick + 6 + Math.floor(Math.random() * 8);
          } else if (haterHeat < profile.escalationHeat - 5) {
            runtime.state = 'DORMANT';
          }
          break;

        case 'TARGETING':
          runtime.isCritical = runtime.ticksInState >= 2;
          if (haterHeat >= profile.attackingHeat ||
              (runtime.preloadedArrival !== null && tick >= runtime.preloadedArrival)) {
            this.fireAttack(id, runtime, snap);
            runtime.state = 'ATTACKING';
          }
          break;

        case 'ATTACKING':
          // Immediately retreat after firing
          runtime.state         = 'RETREATING';
          runtime.lastAttackTick = tick;
          break;

        case 'RETREATING':
          if (runtime.ticksInState >= 5) {
            runtime.state = haterHeat >= profile.escalationHeat ? 'WATCHING' : 'DORMANT';
          }
          break;

        case 'NEUTRALIZED':
          if (runtime.ticksInState >= 3) {
            runtime.state = 'WATCHING';
          }
          break;
      }

      if (runtime.state !== prevState) {
        runtime.ticksInState = 0;
        globalEventBus.emit('BOT_STATE_CHANGED', tick, {
          botId: id, prev: prevState, current: runtime.state,
        });
      }
    }
  }

  private fireAttack(
    botId: BotId,
    runtime: { isCritical: boolean },
    snap: ReturnType<typeof buildSnapshot>,
  ): void {
    const live    = this.liveState!;
    const damage  = 200 + Math.floor(Math.random() * 300);
    const event = {
      id:          `atk_${Date.now()}`,
      sourceBot:   botId,
      damage,
      isCritical:  runtime.isCritical,
      arrivalTick: snap.tick,
      label:       `Financial extraction: ${damage} damage`,
    };

    // Apply damage to weakest shield (simplified routing)
    const weakestLayer = this.findWeakestLayer(snap);
    const layer = live.shields.layers[weakestLayer];
    const actualDamage = Math.min(layer.current, event.isCritical ? damage : damage * 0.7);
    layer.current = Math.max(0, layer.current - actualDamage);
    layer.regenActive = false;

    if (layer.current === 0 && !layer.breached) {
      layer.breached   = true;
      layer.lastBreach = snap.tick;
      globalEventBus.emit(
        weakestLayer === 'L4_NETWORK_CORE' ? 'SHIELD_L4_BREACH' : 'SHIELD_LAYER_BREACHED',
        snap.tick, { layer: weakestLayer }
      );

      if (weakestLayer === 'L4_NETWORK_CORE') {
        live.shields.l4BreachCount++;
        live.haterHeat = 100;
        // Crack all other layers to 20%
        for (const [lid, l] of Object.entries(live.shields.layers)) {
          if (lid !== 'L4_NETWORK_CORE') {
            l.current = Math.floor(l.max * 0.2);
          }
        }
      }
    }

    globalEventBus.emit('BOT_ATTACK_FIRED', snap.tick, { ...event, damage: actualDamage, targetLayer: weakestLayer });
  }

  private findWeakestLayer(snap: ReturnType<typeof buildSnapshot>): import('./types').ShieldLayerId {
    const order: import('./types').ShieldLayerId[] = [
      'L1_LIQUIDITY_BUFFER', 'L2_CREDIT_LINE', 'L3_ASSET_FLOOR', 'L4_NETWORK_CORE',
    ];
    let weakest = order[0];
    let weakestPct = snap.shields.layers[order[0]].current / snap.shields.layers[order[0]].max;
    for (const id of order.slice(1)) {
      const pct = snap.shields.layers[id].current / snap.shields.layers[id].max;
      if (pct < weakestPct) { weakestPct = pct; weakest = id; }
    }
    return weakest;
  }

  private getBotProfile(id: BotId) {
    return BOT_PROFILES[id] ?? null;
  }

  // ── Cascade chain processing ──────────────────────────────────────────────

  private processCascadeLinks(snap: ReturnType<typeof buildSnapshot>): void {
    const live = this.liveState!;
    for (const chain of live.activeCascades) {
      if (chain.state !== 'ACTIVE') continue;
      for (const link of chain.links) {
        const fireTick = chain.triggerTick + link.tickOffset;
        if (snap.tick !== fireTick) continue;
        this.applyCascadeLink(link, snap.tick);
        globalEventBus.emit('CASCADE_LINK_FIRED', snap.tick, {
          chainId: chain.chainId, linkOffset: link.tickOffset, label: link.label,
        });
      }
    }
    // Prune completed chains
    live.activeCascades = live.activeCascades.filter(c => c.state === 'ACTIVE' || c.state === 'PENDING');
  }

  private applyCascadeLink(link: import('./types').CascadeLink, _tick: number): void {
    const live = this.liveState!;
    switch (link.effectType) {
      case 'INCOME_DRAIN':
        live.income = Math.max(0, live.income - link.magnitude);
        break;
      case 'EXPENSE_SURGE':
        live.expenses += link.magnitude;
        break;
      case 'HEAT_DELTA':
        live.haterHeat = Math.min(100, Math.max(0, live.haterHeat + link.magnitude));
        break;
      case 'SHIELD_DAMAGE': {
        const weakest = this.findWeakestLayer(buildSnapshot(live));
        live.shields.layers[weakest].current = Math.max(
          0, live.shields.layers[weakest].current - link.magnitude
        );
        break;
      }
      case 'INCOME_BOOST':
        live.income += link.magnitude;
        break;
      case 'EXPENSE_RELIEF':
        live.expenses = Math.max(0, live.expenses - link.magnitude);
        break;
    }
  }
}

// ── Singleton Orchestrator ────────────────────────────────────────────────────
export const orchestrator = new EngineOrchestrator(720);
