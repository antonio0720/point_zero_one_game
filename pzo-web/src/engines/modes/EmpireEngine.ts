// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — EMPIRE ENGINE (SOLO MODE)
// pzo-web/src/engines/modes/EmpireEngine.ts
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════
// EMPIRE: You against the 5 adversarial systems that extract from you in
// real life — the Liquidator, Bureaucrat, Manipulator, Crash Prophet,
// and Legacy Heir. Build passive income past expenses before they break you.
//
// PHASE 2 INTEGRATIONS (formerly game/modes/empire/):
//   ✦ BleedMode          — sustained bot pressure causes income to bleed per tick
//                          until player takes a repair action (plays a RESILIENCE card)
//   ✦ IsolationTax       — per-tick penalty when shields are low AND bots are attacking;
//                          simulates the compounding cost of being under siege
//   ✦ PressureJournalEngine — chronological log of pressure events; drives sovereignty
//                          scoring and the post-run replay panel
//   ✦ CaseFileMapper     — tracks each bot's attack history (fired, blocked, damage);
//                          fuels the counter-evidence system and bot-specific card effects
//   ✦ Pre-run Loadout    — player selects BUILDER / DEFENDER / BALANCED before starting;
//                          modifies starting income, shields, and counter-evidence budget
//
// Original mechanics (unchanged):
//   ✦ Pressure Wave System  — 5 escalating threat waves
//   ✦ Momentum Engine       — sustained cashflow unlocks positive cascades
//   ✦ Counter-Evidence Budget — per-tick resource to neutralize bots
//   ✦ Fortune Events        — seeded random financial reality checks
//
// COMPATIBILITY NOTES (v2):
//   ✦ All globalEventBus emit/subscribe calls unchanged.
//     ModeEventBridge translates them to zero/EventBus as needed.
//   ✦ CascadeChainId string literals kept as-is; bridge maps them.
//   ✦ shield layer string keys (L4_NETWORK_CORE) kept as-is in LiveRunState.
// ═══════════════════════════════════════════════════════════════════════════

import type {
  IGameModeEngine, RunMode, RunOutcome, ModeInitConfig,
  RunStateSnapshot, GameModeState, PZOEvent, CascadeChainInstance,
  CascadeChainId, BotId,
} from '../core/types';
import { BOT_PROFILES }   from '../core/types';
import { globalEventBus } from '../core/EventBus';
import type { LiveRunState } from '../core/RunStateSnapshot';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

// ── Pressure waves ────────────────────────────────────────────────────────────

interface WaveConfig {
  wave:            number;
  tickStart:       number;
  haterHeatTarget: number;
  incomePenalty:   number;
  label:           string;
  botActivations:  number;
}

const EMPIRE_WAVES: WaveConfig[] = [
  { wave: 1, tickStart:   0, haterHeatTarget:  15, incomePenalty:    0, label: 'Building Phase',    botActivations: 1 },
  { wave: 2, tickStart: 144, haterHeatTarget:  35, incomePenalty:  200, label: 'Extraction Begins', botActivations: 2 },
  { wave: 3, tickStart: 288, haterHeatTarget:  55, incomePenalty:  400, label: 'Systemic Pressure',  botActivations: 3 },
  { wave: 4, tickStart: 432, haterHeatTarget:  75, incomePenalty:  700, label: 'Open Season',        botActivations: 4 },
  { wave: 5, tickStart: 576, haterHeatTarget:  95, incomePenalty: 1100, label: 'Total War',          botActivations: 5 },
];

// ── Momentum ──────────────────────────────────────────────────────────────────

const MOMENTUM_THRESHOLD      = 60;
const MOMENTUM_GAIN_PER_TICK  = 2;
const MOMENTUM_DECAY_PER_TICK = 3;

// ── Counter-Evidence Budget ───────────────────────────────────────────────────

const COUNTER_EVIDENCE_BUDGET_PER_TICK = 5;
const BOT_NEUTRALIZE_COST              = 15;

// ─────────────────────────────────────────────────────────────────────────────
// BLEED MODE
// ─────────────────────────────────────────────────────────────────────────────
// When a bot has been in TARGETING or ATTACKING for 3+ consecutive ticks
// without being neutralized, the player enters "bleed state" — income bleeds
// at BLEED_RATE_PER_TICK until they play a RESILIENCE card or the bot retreats.
//
// Rationale: models the compounding cost of ignoring a financial threat. In
// real life, not responding to a squeeze compounds the damage; this system
// makes that mechanic visceral. The bleed is not permanent — it is reversed
// when the triggering condition is removed.

const BLEED_THRESHOLD_TICKS = 3;       // ticks of unresolved attack before bleed starts
const BLEED_RATE_PER_TICK   = 0.012;   // 1.2% income decay per tick while bleeding
const BLEED_MIN_INCOME      = 500;     // income cannot bleed below this floor

interface BleedState {
  isActive:          boolean;
  triggerBotId:      BotId | null;
  attackTicksStruck: number;         // consecutive ticks bot has been targeting/attacking
  totalBleedTicks:   number;         // ticks the player has been in bleed state this run
  bleedRateApplied:  number;         // cumulative income bled (for sovereignty scoring)
}

// ─────────────────────────────────────────────────────────────────────────────
// ISOLATION TAX
// ─────────────────────────────────────────────────────────────────────────────
// When ALL of the following are true simultaneously:
//   • shieldAvgIntegrityPct < ISOLATION_SHIELD_THRESHOLD
//   • activeBotCount >= ISOLATION_BOT_THRESHOLD
//   • cashflow is negative
// The player pays an ISOLATION_TAX_PER_TICK expense surcharge.
// This represents the real-world "isolation trap" — when you're under attack,
// defensive spending mounts, cutting off options that would let you recover.
//
// The tax is removed immediately when any condition resolves.

const ISOLATION_SHIELD_THRESHOLD = 0.40;  // below 40% average shield integrity
const ISOLATION_BOT_THRESHOLD    = 2;     // at least 2 active bots
const ISOLATION_TAX_PER_TICK     = 180;   // additional expense per tick while isolated
const ISOLATION_MAX_DURATION     = 48;    // auto-remove after 48 ticks (prevents infinite trap)

interface IsolationState {
  isActive:      boolean;
  startTick:     number;
  durTicks:      number;
  totalTaxPaid:  number;  // cumulative tax applied this run
}

// ─────────────────────────────────────────────────────────────────────────────
// PRESSURE JOURNAL ENGINE
// ─────────────────────────────────────────────────────────────────────────────
// Every meaningful pressure event is logged with tick, type, and magnitude.
// The journal drives:
//   • Post-run replay panel (all decision points visible)
//   • Sovereignty scoring bonus (clean runs with few CRITICAL events score higher)
//   • The "Pressure Analyst" proof badge (earn it by surviving 3+ CRITICAL events)
//
// Journal is capped at JOURNAL_MAX_ENTRIES to prevent memory growth on long runs.

const JOURNAL_MAX_ENTRIES = 150;

type PressureEventType =
  | 'WAVE_ENTRY'
  | 'BOT_ATTACK'
  | 'L4_BREACH'
  | 'BLEED_STARTED'
  | 'BLEED_ENDED'
  | 'ISOLATION_STARTED'
  | 'ISOLATION_ENDED'
  | 'MOMENTUM_CASCADE'
  | 'FORTUNE_EVENT'
  | 'PRESSURE_CRITICAL'
  | 'BOT_NEUTRALIZED_CE'; // neutralized via counter-evidence budget

interface PressureJournalEntry {
  tick:      number;
  type:      PressureEventType;
  label:     string;
  magnitude: number;   // severity proxy — used in sovereignty scoring
  botId?:    BotId;
}

// ─────────────────────────────────────────────────────────────────────────────
// CASE FILE MAPPER
// ─────────────────────────────────────────────────────────────────────────────
// Maintains per-bot case files tracking:
//   • Total attacks fired by this bot
//   • Total attacks blocked by the player
//   • Total damage dealt (integrity lost across all layers)
//   • Tick of most recent attack
//   • Whether the player has "profiled" this bot (≥3 attacks seen → profiled)
//
// CaseFiles are used by:
//   • Counter-Evidence Budget system (spending CE pts is more effective on profiled bots)
//   • Tension Engine (profiled bots have higher tension score decay when attacked)
//   • UI "Intel Panel" (Phase 4) to show bot-specific weakness cards
//
// The case file for each bot persists for the entire run — it is the player's
// growing dossier on the adversary.

interface BotCaseFile {
  botId:           BotId;
  attacksFired:    number;
  attacksBlocked:  number;
  totalDamage:     number;
  lastAttackTick:  number;
  profiled:        boolean;   // true when attacksFired >= 3
  knownAttackType: string | null;  // most common attack type observed
}

const PROFILE_THRESHOLD = 3;  // attacks needed to profile a bot

// ─────────────────────────────────────────────────────────────────────────────
// PRE-RUN LOADOUT
// ─────────────────────────────────────────────────────────────────────────────
// Player picks one of three loadouts before the run starts.
// Loadout modifies starting parameters only — no ongoing bonuses.
// The loadout is stored in the engine and exposed via getState() for UI rendering.
//
// BUILDER   — Bets everything on income: +25% starting income, -20% starting shields
// DEFENDER  — Fortress first: +25% starting shields, -15% starting income
// BALANCED  — Standard configuration. No modifications.
//
// Default is BALANCED if not specified in ModeInitConfig.

export type EmpireLoadout = 'BUILDER' | 'DEFENDER' | 'BALANCED';

interface LoadoutConfig {
  incomeMultiplier:  number;   // 1.0 = no change
  shieldMultiplier:  number;   // 1.0 = no change
  counterBudgetBonus: number;  // flat bonus added to CE budget per tick
  label:             string;
  description:       string;
}

const EMPIRE_LOADOUTS: Record<EmpireLoadout, LoadoutConfig> = {
  BUILDER: {
    incomeMultiplier:   1.25,
    shieldMultiplier:   0.80,
    counterBudgetBonus: 0,
    label:              'Builder',
    description:        'Income first. Your income streams start stronger but your shields start weaker. Bet on speed.',
  },
  DEFENDER: {
    incomeMultiplier:   0.85,
    shieldMultiplier:   1.25,
    counterBudgetBonus: 2,
    label:              'Defender',
    description:        'Fortress first. Stronger shields and more counter-evidence per tick. Slower to reach FREEDOM.',
  },
  BALANCED: {
    incomeMultiplier:   1.0,
    shieldMultiplier:   1.0,
    counterBudgetBonus: 0,
    label:              'Balanced',
    description:        'Standard configuration. No structural advantages. Pure execution.',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export class EmpireEngine implements IGameModeEngine {
  public readonly mode: RunMode = 'solo';
  public readonly runId: string;

  private liveStateRef:  LiveRunState | null = null;
  private config:        ModeInitConfig | null = null;

  // ── Original state ─────────────────────────────────────────────────────────
  private currentWave:         number = 1;
  private momentumScore:       number = 0;
  private counterBudgetLeft:   number = 0;
  private cascadeInstances:    CascadeChainInstance[] = [];
  private eventHandlers:       Array<() => void> = [];
  private stateChangeListeners: Array<(event: PZOEvent) => void> = [];
  private activeBotCount:      number = 0;
  private highestBotThreat:    string = 'None';
  private nextThreatTick:      number | null = null;

  // ── Phase 2: BleedMode ─────────────────────────────────────────────────────
  private bleed: BleedState = {
    isActive:          false,
    triggerBotId:      null,
    attackTicksStruck: 0,
    totalBleedTicks:   0,
    bleedRateApplied:  0,
  };

  // ── Phase 2: IsolationTax ─────────────────────────────────────────────────
  private isolation: IsolationState = {
    isActive:    false,
    startTick:   0,
    durTicks:    0,
    totalTaxPaid: 0,
  };

  // ── Phase 2: PressureJournalEngine ───────────────────────────────────────
  private journal: PressureJournalEntry[] = [];

  // ── Phase 2: CaseFileMapper ──────────────────────────────────────────────
  private caseFiles: Map<BotId, BotCaseFile> = new Map();

  // ── Phase 2: Pre-run Loadout ─────────────────────────────────────────────
  private loadout: EmpireLoadout = 'BALANCED';

  constructor() {
    this.runId = `empire_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  public init(config: ModeInitConfig): void {
    this.config = config;

    // ── Resolve loadout (from config extension or default BALANCED) ─────────
    this.loadout = (config as any).empireLoadout ?? 'BALANCED';
    const loadoutCfg = EMPIRE_LOADOUTS[this.loadout];

    // ── Apply loadout modifiers to config (income + shield multipliers) ──────
    // Modifiers are applied here and flushed to liveStateRef when it is injected.
    // They are stored as pending multipliers until setLiveStateRef() is called.
    this._pendingIncomeMultiplier = loadoutCfg.incomeMultiplier;
    this._pendingShieldMultiplier = loadoutCfg.shieldMultiplier;

    // ── Reset core state ────────────────────────────────────────────────────
    this.currentWave  = 1;
    this.momentumScore = 0;
    this.counterBudgetLeft = COUNTER_EVIDENCE_BUDGET_PER_TICK + loadoutCfg.counterBudgetBonus;
    this.cascadeInstances  = [];
    this.activeBotCount    = 0;
    this.highestBotThreat  = 'None';
    this.nextThreatTick    = null;

    // ── Reset Phase 2 state ─────────────────────────────────────────────────
    this.bleed = {
      isActive: false, triggerBotId: null,
      attackTicksStruck: 0, totalBleedTicks: 0, bleedRateApplied: 0,
    };
    this.isolation = { isActive: false, startTick: 0, durTicks: 0, totalTaxPaid: 0 };
    this.journal = [];
    this.caseFiles = new Map();

    // Pre-populate case files for all 5 bots
    const BOT_IDS: BotId[] = ['BOT_01', 'BOT_02', 'BOT_03', 'BOT_04', 'BOT_05'];
    for (const botId of BOT_IDS) {
      this.caseFiles.set(botId, {
        botId, attacksFired: 0, attacksBlocked: 0,
        totalDamage: 0, lastAttackTick: -1, profiled: false, knownAttackType: null,
      });
    }

    // ── Subscribe to events ─────────────────────────────────────────────────
    this.eventHandlers.push(
      globalEventBus.on('BOT_ATTACK_FIRED',      (e: PZOEvent) => this.onBotAttack(e)),
      globalEventBus.on('SHIELD_L4_BREACH',      (e: PZOEvent) => this.onL4Breach(e)),
      globalEventBus.on('PRESSURE_TIER_CHANGED', (e: PZOEvent) => this.onPressureChanged(e)),
      globalEventBus.on('SHIELD_LAYER_DAMAGED',  (e: PZOEvent) => this.onShieldDamaged(e)),
      globalEventBus.on('BOT_NEUTRALIZED',       (e: PZOEvent) => this.onBotNeutralized(e)),
    );

    globalEventBus.emitImmediate('RUN_STARTED', 0, {
      mode: 'solo', label: 'EMPIRE', runId: this.runId,
      loadout: this.loadout,
      loadoutLabel: loadoutCfg.label,
      message: `Loadout: ${loadoutCfg.label} — ${loadoutCfg.description}`,
    });

    this.journalEntry(0, 'WAVE_ENTRY', 'Building Phase begins', 0);
  }

  public onTick(snapshot: RunStateSnapshot): void {
    const tick = snapshot.tick;

    // ── 1. Counter-evidence budget refresh ──────────────────────────────────
    const loadoutCfg = EMPIRE_LOADOUTS[this.loadout];
    this.counterBudgetLeft = COUNTER_EVIDENCE_BUDGET_PER_TICK + loadoutCfg.counterBudgetBonus;

    // ── 2. Wave progression ─────────────────────────────────────────────────
    const targetWave = [...EMPIRE_WAVES].reverse().find(w => tick >= w.tickStart) ?? EMPIRE_WAVES[0]!;
    if (targetWave.wave !== this.currentWave) {
      this.enterWave(targetWave, snapshot);
    }

    // ── 3. Hater heat escalation ────────────────────────────────────────────
    if (this.liveStateRef) {
      const targetHeat = targetWave.haterHeatTarget;
      if (this.liveStateRef.haterHeat < targetHeat) {
        this.liveStateRef.haterHeat = Math.min(
          targetHeat,
          this.liveStateRef.haterHeat + (tick % 12 === 0 ? 3 : 1),
        );
        globalEventBus.emit('HATER_HEAT_CHANGED', tick, {
          prev: snapshot.haterHeat, current: this.liveStateRef.haterHeat,
        });
      }
    }

    // ── 4. Momentum engine ──────────────────────────────────────────────────
    if (snapshot.income > snapshot.expenses) {
      this.momentumScore = Math.min(100, this.momentumScore + MOMENTUM_GAIN_PER_TICK);
    } else {
      this.momentumScore = Math.max(0, this.momentumScore - MOMENTUM_DECAY_PER_TICK);
    }
    if (this.momentumScore >= MOMENTUM_THRESHOLD && tick % 48 === 0) {
      this.triggerPositiveCascade(snapshot);
    }

    // ── 5. Phase 2: BleedMode tick ──────────────────────────────────────────
    this.tickBleedMode(snapshot);

    // ── 6. Phase 2: IsolationTax tick ───────────────────────────────────────
    this.tickIsolationTax(snapshot);

    // ── 7. Update bot threat summary ────────────────────────────────────────
    this.updateBotThreatSummary(snapshot);

    // ── 8. Fortune events ───────────────────────────────────────────────────
    if (tick % 60 === 0 && tick > 0) {
      this.fireFortuneEvent(snapshot);
    }

    // ── 9. Phase 2: Auto-neutralize targeting bots with CE budget ───────────
    this.autoNeutralizeWithCE(snapshot);
  }

  public onRunEnd(outcome: RunOutcome): void {
    const sovereigntyScore = this.computeSovereigntyScore(outcome);
    const grade = this.computeGrade(sovereigntyScore);

    globalEventBus.emitImmediate('RUN_GRADED', this.liveStateRef?.tick ?? 0, {
      outcome, sovereigntyScore, grade, runId: this.runId,
      loadout:               this.loadout,
      totalBleedTicks:       this.bleed.totalBleedTicks,
      totalIsolationTax:     this.isolation.totalTaxPaid,
      journalEntryCount:     this.journal.length,
      profiledBotCount:      [...this.caseFiles.values()].filter(f => f.profiled).length,
      label: outcome === 'FREEDOM'
        ? 'Empire built. The machine runs without you.'
        : outcome === 'BANKRUPT'
        ? 'The extraction machine won this round. Study the replay.'
        : 'Time ran out. The empire was unfinished.',
    });

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
        // Phase 2 state exposed for UI
        loadout:           this.loadout,
        bleedActive:       this.bleed.isActive,
        isolationActive:   this.isolation.isActive,
        isolationTaxPaid:  this.isolation.totalTaxPaid,
        counterBudgetLeft: this.counterBudgetLeft,
        journalEntries:    this.getRecentJournalEntries(10),
        caseFiles:         [...this.caseFiles.values()],
      },
    };
  }

  public subscribe(handler: (event: PZOEvent) => void): () => void {
    this.stateChangeListeners.push(handler);
    return () => {
      this.stateChangeListeners = this.stateChangeListeners.filter(h => h !== handler);
    };
  }

  public setLiveStateRef(ref: LiveRunState): void {
    this.liveStateRef = ref;
    // Apply loadout multipliers now that we have the live state reference
    if (this._pendingIncomeMultiplier !== 1.0) {
      ref.income = Math.floor(ref.income * this._pendingIncomeMultiplier);
    }
    if (this._pendingShieldMultiplier !== 1.0) {
      for (const layerId of Object.keys(ref.shields.layers) as any[]) {
        const layer = ref.shields.layers[layerId];
        layer.current = Math.floor(layer.current * this._pendingShieldMultiplier);
      }
    }
    this._pendingIncomeMultiplier = 1.0;
    this._pendingShieldMultiplier = 1.0;
  }

  // Pending loadout multipliers (applied when liveStateRef is injected)
  private _pendingIncomeMultiplier: number = 1.0;
  private _pendingShieldMultiplier: number = 1.0;

  // ── Public: Loadout selection (called by LobbyScreen before init()) ────────

  /**
   * Set the empire loadout. Must be called before init() or will be overridden.
   * LobbyScreen calls this when the player selects their pre-run loadout.
   */
  public setLoadout(loadout: EmpireLoadout): void {
    this.loadout = loadout;
  }

  /**
   * Get available loadout options for LobbyScreen rendering.
   */
  public static getLoadoutOptions(): Array<{ loadout: EmpireLoadout; label: string; description: string }> {
    return (Object.keys(EMPIRE_LOADOUTS) as EmpireLoadout[]).map(k => ({
      loadout:     k,
      label:       EMPIRE_LOADOUTS[k]!.label,
      description: EMPIRE_LOADOUTS[k]!.description,
    }));
  }

  // ── Public: Counter-evidence spending ─────────────────────────────────────

  /**
   * Spend counter-evidence budget to neutralize a targeting bot.
   * Returns true if successful (budget available, bot is targeting/attacking).
   */
  public spendCounterEvidence(botId: BotId, currentTick: number): boolean {
    if (this.counterBudgetLeft < BOT_NEUTRALIZE_COST) return false;

    const caseFile = this.caseFiles.get(botId);
    const isProfiled = caseFile?.profiled ?? false;

    // Profiled bots cost 20% less to neutralize
    const cost = isProfiled
      ? Math.floor(BOT_NEUTRALIZE_COST * 0.8)
      : BOT_NEUTRALIZE_COST;

    if (this.counterBudgetLeft < cost) return false;

    this.counterBudgetLeft -= cost;

    globalEventBus.emit('BOT_NEUTRALIZED', currentTick, {
      botId, viaCounterEvidence: true, cost,
      isProfiled, immunityTicks: isProfiled ? 36 : 24,
    });

    this.journalEntry(currentTick, 'BOT_NEUTRALIZED_CE', `CE spent: neutralized ${botId}`, cost);
    return true;
  }

  // ── Public: Journal access ─────────────────────────────────────────────────

  public getPressureJournal(): ReadonlyArray<PressureJournalEntry> {
    return [...this.journal];
  }

  /**
   * Get a specific bot's case file.
   * Returns null if botId not found (should not happen after init()).
   */
  public getBotCaseFile(botId: BotId): Readonly<BotCaseFile> | null {
    return this.caseFiles.get(botId) ?? null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: BLEED MODE
  // ═══════════════════════════════════════════════════════════════════════════

  private tickBleedMode(snapshot: RunStateSnapshot): void {
    const tick = snapshot.tick;
    const live = this.liveStateRef;

    // Check if any bot has been continuously attacking/targeting this tick
    const attackingBots = Object.entries(snapshot.botStates ?? {})
      .filter(([, s]) => s.state === 'ATTACKING' || s.state === 'TARGETING');

    if (attackingBots.length > 0) {
      this.bleed.attackTicksStruck++;
    } else {
      // No active attack — decay the streak
      this.bleed.attackTicksStruck = Math.max(0, this.bleed.attackTicksStruck - 1);
    }

    // Activate bleed when threshold exceeded
    if (!this.bleed.isActive && this.bleed.attackTicksStruck >= BLEED_THRESHOLD_TICKS) {
      this.bleed.isActive     = true;
      this.bleed.triggerBotId = (attackingBots[0]?.[0] as BotId) ?? null;
      globalEventBus.emit('INCOME_CHANGED', tick, {
        delta:  0, reason: 'Bleed state activated',
        message: `Sustained attack from ${this.bleed.triggerBotId ?? 'bots'} — income is bleeding. Play a RESILIENCE card to stop it.`,
      });
      this.journalEntry(tick, 'BLEED_STARTED', `Bleed triggered by ${this.bleed.triggerBotId ?? 'unknown'}`, this.bleed.attackTicksStruck);
    }

    // Deactivate bleed when attacks clear
    if (this.bleed.isActive && attackingBots.length === 0 && this.bleed.attackTicksStruck === 0) {
      this.bleed.isActive = false;
      this.bleed.triggerBotId = null;
      globalEventBus.emit('INCOME_CHANGED', tick, {
        delta: 0, reason: 'Bleed state deactivated',
        message: 'Attack pressure released. Income bleed has stopped.',
      });
      this.journalEntry(tick, 'BLEED_ENDED', 'Bleed resolved', this.bleed.totalBleedTicks);
    }

    // Apply bleed while active
    if (this.bleed.isActive && live) {
      const bleedAmount = Math.floor(live.income * BLEED_RATE_PER_TICK);
      const newIncome   = Math.max(BLEED_MIN_INCOME, live.income - bleedAmount);
      const actualBleed = live.income - newIncome;

      live.income             = newIncome;
      this.bleed.totalBleedTicks++;
      this.bleed.bleedRateApplied += actualBleed;

      if (tick % 12 === 0) {  // emit every 12 ticks to avoid flooding the bus
        globalEventBus.emit('INCOME_CHANGED', tick, {
          delta: -actualBleed, reason: 'Bleed state: sustained attack draining income',
        });
      }
    }
  }

  /**
   * Called by CardEffectResolver when a RESILIENCE card resolves.
   * Immediately ends bleed state regardless of current attack situation.
   */
  public resolveBleed(): void {
    if (!this.bleed.isActive) return;
    this.bleed.isActive = false;
    this.bleed.attackTicksStruck = 0;
    this.bleed.triggerBotId = null;
    const tick = this.liveStateRef?.tick ?? 0;
    globalEventBus.emit('INCOME_CHANGED', tick, {
      delta: 0, reason: 'RESILIENCE card played — bleed resolved',
      message: 'Income bleed stopped. Resilience restored.',
    });
    this.journalEntry(tick, 'BLEED_ENDED', 'Bleed resolved via RESILIENCE card', 0);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: ISOLATION TAX
  // ═══════════════════════════════════════════════════════════════════════════

  private tickIsolationTax(snapshot: RunStateSnapshot): void {
    const tick = snapshot.tick;
    const live = this.liveStateRef;

    const shieldPct   = snapshot.shields?.overallIntegrityPct ?? 1.0;
    const botCount    = this.activeBotCount;
    const cashflowNeg = snapshot.income < snapshot.expenses;

    const isolationCondition =
      shieldPct < ISOLATION_SHIELD_THRESHOLD &&
      botCount  >= ISOLATION_BOT_THRESHOLD   &&
      cashflowNeg;

    if (!this.isolation.isActive && isolationCondition) {
      // Enter isolation
      this.isolation.isActive  = true;
      this.isolation.startTick = tick;
      this.isolation.durTicks  = 0;
      globalEventBus.emit('EXPENSE_CHANGED', tick, {
        delta:   ISOLATION_TAX_PER_TICK,
        reason:  'Isolation Tax activated',
        message: 'Low shields + active bots + negative cashflow = isolation trap. Expense surcharge applied.',
      });
      this.journalEntry(tick, 'ISOLATION_STARTED', 'Isolation trap activated', ISOLATION_TAX_PER_TICK);
    }

    if (this.isolation.isActive) {
      this.isolation.durTicks++;

      // Apply per-tick tax
      if (live) {
        live.expenses += ISOLATION_TAX_PER_TICK;
        this.isolation.totalTaxPaid += ISOLATION_TAX_PER_TICK;
      }

      // Remove isolation when conditions clear OR max duration reached
      const conditionCleared = !isolationCondition;
      const maxed = this.isolation.durTicks >= ISOLATION_MAX_DURATION;

      if (conditionCleared || maxed) {
        // Remove the ongoing expense addition
        if (live) {
          live.expenses = Math.max(0, live.expenses - ISOLATION_TAX_PER_TICK);
        }
        this.isolation.isActive = false;
        globalEventBus.emit('EXPENSE_CHANGED', tick, {
          delta:   -ISOLATION_TAX_PER_TICK,
          reason:  'Isolation Tax deactivated',
          message: maxed
            ? 'Isolation tax auto-removed (max duration). Rebuild shields to prevent re-entry.'
            : 'Isolation trap cleared. Shields recovered or bots retreated.',
        });
        this.journalEntry(tick, 'ISOLATION_ENDED',
          maxed ? 'Isolation auto-removed (max duration)' : 'Isolation cleared',
          this.isolation.totalTaxPaid,
        );
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: AUTO CE NEUTRALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  private autoNeutralizeWithCE(snapshot: RunStateSnapshot): void {
    // If the player has CE budget and a bot has been attacking for 4+ ticks,
    // automatically spend CE to neutralize it. This is the "passive" CE use —
    // the player can also manually call spendCounterEvidence().
    const bot = Object.entries(snapshot.botStates ?? {}).find(
      ([, s]) => s.state === 'ATTACKING' && (s.ticksInState ?? 0) >= 4,
    );
    if (!bot || this.counterBudgetLeft < BOT_NEUTRALIZE_COST) return;

    this.spendCounterEvidence(bot[0] as BotId, snapshot.tick);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: PRESSURE JOURNAL HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private journalEntry(
    tick:      number,
    type:      PressureEventType,
    label:     string,
    magnitude: number,
    botId?:    BotId,
  ): void {
    if (this.journal.length >= JOURNAL_MAX_ENTRIES) {
      this.journal.shift(); // evict oldest
    }
    this.journal.push({ tick, type, label, magnitude, botId });
  }

  private getRecentJournalEntries(n: number): PressureJournalEntry[] {
    return this.journal.slice(-n);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: CASE FILE MAPPER HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private recordBotAttack(botId: BotId, tick: number, attackType: string, damage: number): void {
    const file = this.caseFiles.get(botId);
    if (!file) return;
    file.attacksFired++;
    file.lastAttackTick = tick;
    file.totalDamage   += damage;

    // Update known attack type (track most common via simple last-seen)
    file.knownAttackType = attackType;

    // Profile when threshold hit
    if (!file.profiled && file.attacksFired >= PROFILE_THRESHOLD) {
      file.profiled = true;
      globalEventBus.emit('COUNTER_INTEL_AVAILABLE', tick, {
        botId,
        attackProfile: { knownType: file.knownAttackType, totalDamage: file.totalDamage },
        tier: 'PROFILED',
        message: `Bot profiled: ${botId}. Counter-evidence costs 20% less against this adversary.`,
      });
    }
  }

  private recordBotBlocked(botId: BotId): void {
    const file = this.caseFiles.get(botId);
    if (file) file.attacksBlocked++;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ORIGINAL PRIVATE METHODS (unchanged logic, Phase 2 instrumentation added)
  // ═══════════════════════════════════════════════════════════════════════════

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

    this.journalEntry(snapshot.tick, 'WAVE_ENTRY',
      `Wave ${wave.wave}: ${wave.label}`, wave.botActivations);
  }

  private triggerPositiveCascade(snapshot: RunStateSnapshot): void {
    const instance: CascadeChainInstance = {
      id:          `pos_cascade_${snapshot.tick}`,
      chainId:     'CHAIN_08_POSITIVE_MOMENTUM' as CascadeChainId,
      triggerTick: snapshot.tick,
      severity:    'LOW',
      state:       'ACTIVE',
      links: [
        { tickOffset: 6,  effectType: 'INCOME_BOOST',  magnitude: 300, label: 'Momentum dividend: income stream strengthened' },
        { tickOffset: 12, effectType: 'EXPENSE_RELIEF', magnitude: 150, label: 'Operational efficiency: expense reduced' },
        { tickOffset: 24, effectType: 'INCOME_BOOST',  magnitude: 500, label: 'Compounding advantage: second dividend fires' },
      ],
    };
    this.cascadeInstances.push(instance);
    if (this.liveStateRef) this.liveStateRef.activeCascades.push(instance);

    globalEventBus.emit('CASCADE_TRIGGERED', snapshot.tick, {
      chainId: instance.chainId, severity: 'LOW',
      label: 'Momentum cascade unlocked — sustained cashflow is paying off.',
    });
    this.journalEntry(snapshot.tick, 'MOMENTUM_CASCADE', 'Positive cascade triggered', this.momentumScore);
  }

  private fireFortuneEvent(snapshot: RunStateSnapshot): void {
    const events = [
      { label: 'Hidden Fee Discovered',  incomeD: 0,    expenseD: 600,  msg: 'A quarterly fee you forgot about hits the ledger.' },
      { label: 'Network Opportunity',    incomeD: 400,  expenseD: 0,    msg: 'A contact sends passive deal flow your way.' },
      { label: 'Market Rate Increase',   incomeD: 200,  expenseD: 0,    msg: 'Market conditions improve your income stream rate.' },
      { label: 'Maintenance Event',      incomeD: 0,    expenseD: 800,  msg: 'Infrastructure requires unexpected maintenance spend.' },
      { label: 'Referral Bonus',         incomeD: 350,  expenseD: 0,    msg: 'A satisfied client sends two more your way.' },
      { label: 'Insurance Premium Hike', incomeD: 0,    expenseD: 450,  msg: 'Annual policy renewal comes in 20% higher.' },
    ];
    const rng = this.mulberry32(snapshot.seed + snapshot.tick);
    const ev  = events[Math.floor(rng() * events.length)]!;

    if (this.liveStateRef) {
      this.liveStateRef.income   = Math.max(0, this.liveStateRef.income   + ev.incomeD);
      this.liveStateRef.expenses = Math.max(0, this.liveStateRef.expenses + ev.expenseD);
    }
    globalEventBus.emit('INCOME_CHANGED', snapshot.tick, {
      delta: ev.incomeD - ev.expenseD, reason: ev.label, message: ev.msg,
    });
    this.journalEntry(snapshot.tick, 'FORTUNE_EVENT', ev.label, Math.abs(ev.incomeD - ev.expenseD));
  }

  private updateBotThreatSummary(snapshot: RunStateSnapshot): void {
    const active = Object.entries(snapshot.botStates ?? {})
      .filter(([, s]) => s.state !== 'DORMANT' && s.state !== 'RETREATING');
    this.activeBotCount = active.length;

    const attacking = active.find(([, s]) => s.state === 'ATTACKING' || s.state === 'TARGETING');
    if (attacking) {
      const botId = attacking[0] as BotId;
      this.highestBotThreat = BOT_PROFILES[botId]?.name ?? 'Unknown';
    } else if (active.length > 0) {
      const botId = active[0]![0] as BotId;
      this.highestBotThreat = BOT_PROFILES[botId]?.name ?? 'Unknown';
    } else {
      this.highestBotThreat = 'None';
    }

    const soonest = Object.values(snapshot.botStates ?? {})
      .filter(s => s.preloadedArrival !== null)
      .sort((a, b) => (a.preloadedArrival ?? 9999) - (b.preloadedArrival ?? 9999))[0];
    this.nextThreatTick = soonest?.preloadedArrival ?? null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EVENT HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  private onBotAttack(event: PZOEvent): void {
    if (this.liveStateRef) {
      this.liveStateRef.haterHeat = Math.min(100, this.liveStateRef.haterHeat + 5);
    }
    // Phase 2: record in case file
    const p = event.payload as { botId?: BotId; attackType?: string; damage?: number };
    if (p.botId) {
      this.recordBotAttack(p.botId, event.tick, p.attackType ?? 'UNKNOWN', p.damage ?? 0);
      this.journalEntry(event.tick, 'BOT_ATTACK', `${p.botId} fired ${p.attackType ?? '?'}`, p.damage ?? 0, p.botId);
    }
  }

  private onL4Breach(_event: PZOEvent): void {
    if (!this.liveStateRef) return;
    const instance: CascadeChainInstance = {
      id:          `chain06_${Date.now()}`,
      chainId:     'CHAIN_06_TOTAL_SYSTEMIC' as CascadeChainId,
      triggerTick: this.liveStateRef.tick,
      severity:    'CATASTROPHIC',
      state:       'ACTIVE',
      links: [
        { tickOffset: 1,  effectType: 'INCOME_DRAIN',  magnitude: 1200, label: 'Network core collapse: income stream severed' },
        { tickOffset: 3,  effectType: 'EXPENSE_SURGE', magnitude: 2000, label: 'Emergency capital call: mandatory spend' },
        { tickOffset: 6,  effectType: 'HEAT_DELTA',    magnitude: 15,   label: 'Adversaries smell blood: heat escalates' },
        { tickOffset: 12, effectType: 'INCOME_DRAIN',  magnitude: 800,  label: 'Reputation damage: income streams weakening' },
        { tickOffset: 18, effectType: 'EXPENSE_SURGE', magnitude: 1500, label: 'Compounding obligations: debt demands arrive' },
      ],
    };
    this.cascadeInstances.push(instance);
    this.liveStateRef.activeCascades.push(instance);
    globalEventBus.emit('CASCADE_TRIGGERED', this.liveStateRef.tick, {
      chainId: 'CHAIN_06_TOTAL_SYSTEMIC', severity: 'CATASTROPHIC',
      label: 'Network Core breached. Total systemic cascade in motion.',
    });
    this.journalEntry(this.liveStateRef.tick, 'L4_BREACH', 'L4 NETWORK_CORE breached', 1200);
  }

  private onPressureChanged(event: PZOEvent): void {
    const payload = event.payload as { current: string };
    if (payload.current === 'CRITICAL' && this.liveStateRef) {
      this.liveStateRef.haterHeat = Math.min(100, this.liveStateRef.haterHeat + 10);
      this.journalEntry(event.tick, 'PRESSURE_CRITICAL', 'Pressure reached CRITICAL', 100);
    }
  }

  private onShieldDamaged(event: PZOEvent): void {
    // Phase 2: update case file damage tracking
    const p = event.payload as { attackId?: string; damage?: number; botId?: BotId };
    if (p.botId) {
      const file = this.caseFiles.get(p.botId);
      if (file) file.totalDamage += p.damage ?? 0;
    }
  }

  private onBotNeutralized(event: PZOEvent): void {
    const p = event.payload as { botId?: BotId };
    if (p.botId) this.recordBotBlocked(p.botId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SOVEREIGNTY SCORING
  // ─────────────────────────────────────────────────────────────────────────

  private computeSovereigntyScore(outcome: RunOutcome): number {
    const live = this.liveStateRef;
    if (!live) return 0;

    const OUTCOME_MULT: Record<RunOutcome, number> = {
      FREEDOM: 1.0, TIMEOUT: 0.7, BANKRUPT: 0.3, ABANDONED: 0.0,
    };

    const cashflowScore  = Math.min(300, Math.max(0, (live.income - live.expenses) / 10));
    const shieldScore    = live.shields.layers.L4_NETWORK_CORE.current / 200 * 200;
    const momentumBonus  = this.momentumScore * 2;
    const waveBonus      = this.currentWave * 50;
    const heatPenalty    = live.haterHeat * -0.5;

    // Phase 2 bonuses
    const profileBonus   = [...this.caseFiles.values()].filter(f => f.profiled).length * 30;
    const bleedPenalty   = this.bleed.totalBleedTicks * -2;
    const isolationPenalty = Math.floor(this.isolation.totalTaxPaid / 100) * -1;
    const cleanRunBonus  = this.journal.filter(e => e.type === 'PRESSURE_CRITICAL').length === 0 ? 100 : 0;

    const raw = (
      cashflowScore + shieldScore + momentumBonus + waveBonus + heatPenalty +
      profileBonus + bleedPenalty + isolationPenalty + cleanRunBonus
    ) * OUTCOME_MULT[outcome];

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