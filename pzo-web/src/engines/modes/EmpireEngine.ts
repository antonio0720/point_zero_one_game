// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — EMPIRE ENGINE (SOLO MODE)
// pzo-web/src/engines/modes/EmpireEngine.ts
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════
// EMPIRE: You against the 5 adversarial systems that extract from you in
// real life — the Liquidator, Bureaucrat, Manipulator, Crash Prophet,
// and Legacy Heir. Build passive income past expenses before they break you.
//
// Unique mechanics:
//   • Pressure Wave System — difficulty escalates in 5 waves across the run
//   • Momentum Engine — sustained positive cashflow unlocks positive cascades
//   • Counter-Evidence Budget — per-tick resource to neutralize bots
//   • Critical Hit Risk — bots that wait 2+ ticks in TARGETING bypass shields

import type {
  IGameModeEngine, RunMode, RunOutcome, ModeInitConfig,
  RunStateSnapshot, GameModeState, PZOEvent, CascadeChainInstance,
  CascadeChainId, BotId,
} from '../core/types';
import { BOT_PROFILES }             from '../core/types';
import { globalEventBus }           from '../core/EventBus';
import type { LiveRunState }        from '../core/RunStateSnapshot';

// ── Wave definitions: 5 escalating threat waves ───────────────────────────────

interface WaveConfig {
  wave:            number;
  tickStart:       number;   // wave begins at this tick
  haterHeatTarget: number;   // hater_heat is driven toward this value during wave
  incomePenalty:   number;   // flat income drain applied when entering wave
  label:           string;
  botActivations:  number;   // how many bots activate during this wave
}

const EMPIRE_WAVES: WaveConfig[] = [
  { wave: 1, tickStart:   0, haterHeatTarget:  15, incomePenalty:    0, label: 'Building Phase',    botActivations: 1 },
  { wave: 2, tickStart: 144, haterHeatTarget:  35, incomePenalty:  200, label: 'Extraction Begins', botActivations: 2 },
  { wave: 3, tickStart: 288, haterHeatTarget:  55, incomePenalty:  400, label: 'Systemic Pressure',  botActivations: 3 },
  { wave: 4, tickStart: 432, haterHeatTarget:  75, incomePenalty:  700, label: 'Open Season',        botActivations: 4 },
  { wave: 5, tickStart: 576, haterHeatTarget:  95, incomePenalty: 1100, label: 'Total War',          botActivations: 5 },
];

// ── Positive cascade thresholds ───────────────────────────────────────────────

const MOMENTUM_THRESHOLD      = 60;   // momentum score needed to unlock positive cascades
const MOMENTUM_GAIN_PER_TICK  = 2;    // gained when income > expenses
const MOMENTUM_DECAY_PER_TICK = 3;    // lost when income < expenses

// ── Counter-Evidence Budget ───────────────────────────────────────────────────

const COUNTER_EVIDENCE_BUDGET_PER_TICK = 5;    // pts available each tick
const BOT_NEUTRALIZE_COST              = 15;   // pts to spend neutralizing a TARGETING bot

// ── Engine ────────────────────────────────────────────────────────────────────

export class EmpireEngine implements IGameModeEngine {
  public readonly mode: RunMode = 'solo';
  public readonly runId: string;

  private liveStateRef: LiveRunState | null = null;
  private config:       ModeInitConfig | null = null;

  private currentWave:         number = 1;
  private momentumScore:       number = 0;
  private counterBudgetLeft:   number = 0;
  private cascadeInstances:    CascadeChainInstance[] = [];
  private eventHandlers:       Array<() => void> = [];
  private stateChangeListeners: Array<(event: PZOEvent) => void> = [];

  // Empire-specific state
  private activeBotCount:    number = 0;
  private highestBotThreat:  string = 'None';
  private nextThreatTick:    number | null = null;

  constructor() {
    this.runId = `empire_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  public init(config: ModeInitConfig): void {
    this.config       = config;
    this.currentWave  = 1;
    this.momentumScore = 0;
    this.counterBudgetLeft = COUNTER_EVIDENCE_BUDGET_PER_TICK;
    this.cascadeInstances  = [];
    this.activeBotCount    = 0;
    this.highestBotThreat  = 'None';
    this.nextThreatTick    = null;

    // Subscribe to events from other engines
    this.eventHandlers.push(
      globalEventBus.on('BOT_ATTACK_FIRED', (e) => this.onBotAttack(e)),
      globalEventBus.on('SHIELD_L4_BREACH', (e) => this.onL4Breach(e)),
      globalEventBus.on('PRESSURE_TIER_CHANGED', (e) => this.onPressureChanged(e)),
    );

    globalEventBus.emitImmediate('RUN_STARTED', 0, {
      mode: 'solo',
      label: 'EMPIRE',
      runId: this.runId,
      message: 'The financial extraction machine is watching you. Build faster than they take.',
    });
  }

  public onTick(snapshot: RunStateSnapshot): void {
    const tick = snapshot.tick;

    // ── 1. Counter-evidence budget refresh ─────────────────────────────
    this.counterBudgetLeft = COUNTER_EVIDENCE_BUDGET_PER_TICK;

    // ── 2. Wave progression ─────────────────────────────────────────────
    const targetWave = [...EMPIRE_WAVES].reverse().find(w => tick >= w.tickStart) ?? EMPIRE_WAVES[0];
    if (targetWave.wave !== this.currentWave) {
      this.enterWave(targetWave, snapshot);
    }

    // ── 3. Hater heat escalation toward wave target ─────────────────────
    if (this.liveStateRef) {
      const targetHeat = targetWave.haterHeatTarget;
      if (this.liveStateRef.haterHeat < targetHeat) {
        this.liveStateRef.haterHeat = Math.min(targetHeat,
          this.liveStateRef.haterHeat + (tick % 12 === 0 ? 3 : 1)
        );
        globalEventBus.emit('HATER_HEAT_CHANGED', tick, {
          prev: snapshot.haterHeat, current: this.liveStateRef.haterHeat,
        });
      }
    }

    // ── 4. Momentum engine ──────────────────────────────────────────────
    if (snapshot.income > snapshot.expenses) {
      this.momentumScore = Math.min(100, this.momentumScore + MOMENTUM_GAIN_PER_TICK);
    } else {
      this.momentumScore = Math.max(0, this.momentumScore - MOMENTUM_DECAY_PER_TICK);
    }

    // Positive cascade unlock at MOMENTUM_THRESHOLD
    if (this.momentumScore >= MOMENTUM_THRESHOLD && tick % 48 === 0) {
      this.triggerPositiveCascade(snapshot);
    }

    // ── 5. Update bot threat summary ────────────────────────────────────
    this.updateBotThreatSummary(snapshot);

    // ── 6. Fortune events (random financial reality checks) ─────────────
    if (tick % 60 === 0 && tick > 0) {
      this.fireFortuneEvent(snapshot);
    }
  }

  public onRunEnd(outcome: RunOutcome): void {
    const sovereigntyScore = this.computeSovereigntyScore(outcome);
    const grade = this.computeGrade(sovereigntyScore);

    globalEventBus.emitImmediate('RUN_GRADED', this.liveStateRef?.tick ?? 0, {
      outcome, sovereigntyScore, grade, runId: this.runId,
      label: outcome === 'FREEDOM'
        ? 'Empire built. The machine runs without you.'
        : outcome === 'BANKRUPT'
        ? 'The extraction machine won this round. Study the replay.'
        : 'Time ran out. The empire was unfinished.',
    });

    // Cleanup subscribers
    this.eventHandlers.forEach(unsub => unsub());
    this.eventHandlers = [];
  }

  public getState(): GameModeState {
    return {
      mode: 'solo',
      empire: {
        currentWave:       this.currentWave,
        haterHeat:         this.liveStateRef?.haterHeat ?? 0,
        activeBotCount:    this.activeBotCount,
        highestBotThreat:  this.highestBotThreat,
        nextThreatTick:    this.nextThreatTick,
        cascadeChainCount: this.cascadeInstances.filter(c => c.state === 'ACTIVE').length,
        momentumScore:     this.momentumScore,
      },
    };
  }

  public subscribe(handler: (event: PZOEvent) => void): () => void {
    this.stateChangeListeners.push(handler);
    return () => {
      this.stateChangeListeners = this.stateChangeListeners.filter(h => h !== handler);
    };
  }

  /** Allows Orchestrator to inject the live state reference for direct writes. */
  public setLiveStateRef(ref: LiveRunState): void {
    this.liveStateRef = ref;
  }

  // ── Private: Wave entry ───────────────────────────────────────────────────

  private enterWave(wave: WaveConfig, snapshot: RunStateSnapshot): void {
    const prevWave = this.currentWave;
    this.currentWave = wave.wave;

    if (this.liveStateRef && wave.incomePenalty > 0) {
      this.liveStateRef.income = Math.max(0, this.liveStateRef.income - wave.incomePenalty);
    }

    globalEventBus.emit('INCOME_CHANGED', snapshot.tick, {
      delta: -wave.incomePenalty,
      reason: `Wave ${wave.wave} extraction: ${wave.label}`,
    });

    globalEventBus.emit('PRESSURE_SCORE_UPDATE', snapshot.tick, {
      waveEntry: true, wave: wave.wave, prevWave,
      message: `${wave.label} — ${wave.botActivations} adversaries escalating.`,
    });
  }

  // ── Private: Positive cascade trigger ────────────────────────────────────

  private triggerPositiveCascade(snapshot: RunStateSnapshot): void {
    const instance: CascadeChainInstance = {
      id:          `pos_cascade_${snapshot.tick}`,
      chainId:     'CHAIN_08_POSITIVE_MOMENTUM' as CascadeChainId,
      triggerTick: snapshot.tick,
      severity:    'LOW',
      state:       'ACTIVE',
      links: [
        { tickOffset: 6,  effectType: 'INCOME_BOOST',   magnitude: 300, label: 'Momentum dividend: income stream strengthened' },
        { tickOffset: 12, effectType: 'EXPENSE_RELIEF',  magnitude: 150, label: 'Operational efficiency: expense reduced' },
        { tickOffset: 24, effectType: 'INCOME_BOOST',   magnitude: 500, label: 'Compounding advantage: second dividend fires' },
      ],
    };
    this.cascadeInstances.push(instance);
    if (this.liveStateRef) this.liveStateRef.activeCascades.push(instance);

    globalEventBus.emit('CASCADE_TRIGGERED', snapshot.tick, {
      chainId: instance.chainId, severity: 'LOW',
      label: 'Momentum cascade unlocked — sustained cashflow is paying off.',
    });
  }

  // ── Private: Fortune events ───────────────────────────────────────────────

  private fireFortuneEvent(snapshot: RunStateSnapshot): void {
    const events = [
      { label: 'Hidden Fee Discovered',   incomeD: 0,    expenseD: 600,  msg: 'A quarterly fee you forgot about hits the ledger.' },
      { label: 'Network Opportunity',     incomeD: 400,  expenseD: 0,    msg: 'A contact sends passive deal flow your way.' },
      { label: 'Market Rate Increase',    incomeD: 200,  expenseD: 0,    msg: 'Market conditions improve your income stream rate.' },
      { label: 'Maintenance Event',       incomeD: 0,    expenseD: 800,  msg: 'Infrastructure requires unexpected maintenance spend.' },
      { label: 'Referral Bonus',          incomeD: 350,  expenseD: 0,    msg: 'A satisfied client sends two more your way.' },
      { label: 'Insurance Premium Hike',  incomeD: 0,    expenseD: 450,  msg: 'Annual policy renewal comes in 20% higher.' },
    ];

    // Seeded selection — deterministic per tick + seed
    const rng = this.mulberry32(snapshot.seed + snapshot.tick);
    const ev  = events[Math.floor(rng() * events.length)];

    if (this.liveStateRef) {
      this.liveStateRef.income   = Math.max(0, this.liveStateRef.income   + ev.incomeD);
      this.liveStateRef.expenses = Math.max(0, this.liveStateRef.expenses + ev.expenseD);
    }

    globalEventBus.emit('INCOME_CHANGED', snapshot.tick, {
      delta: ev.incomeD - ev.expenseD, reason: ev.label, message: ev.msg,
    });
  }

  // ── Private: Bot threat summary ───────────────────────────────────────────

  private updateBotThreatSummary(snapshot: RunStateSnapshot): void {
    const active = Object.entries(snapshot.botStates)
      .filter(([, s]) => s.state !== 'DORMANT' && s.state !== 'RETREATING');

    this.activeBotCount = active.length;

    const attacking = active.find(([, s]) => s.state === 'ATTACKING' || s.state === 'TARGETING');
    if (attacking) {
      const botId = attacking[0] as BotId;
      this.highestBotThreat = BOT_PROFILES[botId]?.name ?? 'Unknown';
    } else if (active.length > 0) {
      const botId = active[0][0] as BotId;
      this.highestBotThreat = BOT_PROFILES[botId]?.name ?? 'Unknown';
    } else {
      this.highestBotThreat = 'None';
    }

    // Find soonest preloaded attack
    const soonest = Object.values(snapshot.botStates)
      .filter(s => s.preloadedArrival !== null)
      .sort((a, b) => (a.preloadedArrival ?? 9999) - (b.preloadedArrival ?? 9999))[0];
    this.nextThreatTick = soonest?.preloadedArrival ?? null;
  }

  // ── Private: Event handlers ───────────────────────────────────────────────

  private onBotAttack(event: PZOEvent): void {
    // Increase hater heat on successful attacks
    if (this.liveStateRef) {
      this.liveStateRef.haterHeat = Math.min(100, this.liveStateRef.haterHeat + 5);
    }
  }

  private onL4Breach(_event: PZOEvent): void {
    // Trigger TOTAL SYSTEMIC CASCADE on L4 breach
    if (!this.liveStateRef) return;
    const instance: CascadeChainInstance = {
      id:          `chain06_${Date.now()}`,
      chainId:     'CHAIN_06_TOTAL_SYSTEMIC' as CascadeChainId,
      triggerTick: this.liveStateRef.tick,
      severity:    'CATASTROPHIC',
      state:       'ACTIVE',
      links: [
        { tickOffset: 1,  effectType: 'INCOME_DRAIN',   magnitude: 1200, label: 'Network core collapse: income stream severed' },
        { tickOffset: 3,  effectType: 'EXPENSE_SURGE',  magnitude: 2000, label: 'Emergency capital call: mandatory spend' },
        { tickOffset: 6,  effectType: 'HEAT_DELTA',     magnitude: 15,   label: 'Adversaries smell blood: heat escalates' },
        { tickOffset: 12, effectType: 'INCOME_DRAIN',   magnitude: 800,  label: 'Reputation damage: income streams weakening' },
        { tickOffset: 18, effectType: 'EXPENSE_SURGE',  magnitude: 1500, label: 'Compounding obligations: debt demands arrive' },
      ],
    };
    this.cascadeInstances.push(instance);
    this.liveStateRef.activeCascades.push(instance);

    globalEventBus.emit('CASCADE_TRIGGERED', this.liveStateRef.tick, {
      chainId: 'CHAIN_06_TOTAL_SYSTEMIC', severity: 'CATASTROPHIC',
      label: 'Network Core breached. Total systemic cascade in motion.',
    });
  }

  private onPressureChanged(event: PZOEvent): void {
    const payload = event.payload as { current: string };
    if (payload.current === 'CRITICAL' && this.liveStateRef) {
      this.liveStateRef.haterHeat = Math.min(100, this.liveStateRef.haterHeat + 10);
    }
  }

  // ── Private: Sovereignty scoring ─────────────────────────────────────────

  private computeSovereigntyScore(outcome: RunOutcome): number {
    const live = this.liveStateRef;
    if (!live) return 0;

    const OUTCOME_MULT: Record<RunOutcome, number> = {
      FREEDOM: 1.0, TIMEOUT: 0.7, BANKRUPT: 0.3, ABANDONED: 0.0,
    };

    const cashflowScore   = Math.min(300, Math.max(0, (live.income - live.expenses) / 10));
    const shieldScore     = live.shields.layers.L4_NETWORK_CORE.current / 200 * 200;
    const momentumBonus   = this.momentumScore * 2;
    const waveBonus       = this.currentWave * 50;
    const heatPenalty     = live.haterHeat * -0.5;

    const raw = (cashflowScore + shieldScore + momentumBonus + waveBonus + heatPenalty) * OUTCOME_MULT[outcome];
    return Math.max(0, Math.round(raw));
  }

  private computeGrade(score: number): string {
    if (score >= 900) return 'S';
    if (score >= 750) return 'A';
    if (score >= 600) return 'B';
    if (score >= 450) return 'C';
    if (score >= 300) return 'D';
    return 'F';
  }

  // ── Private: seeded RNG ───────────────────────────────────────────────────

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
