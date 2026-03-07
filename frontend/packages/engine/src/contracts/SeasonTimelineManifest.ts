/**
 * SeasonTimelineManifest — pzo-web/src/contracts/SeasonTimelineManifest.ts
 * Point Zero One · Density6 LLC · Confidential
 *
 * The authoritative contract between the Season clock, Time Engine,
 * and Pressure Engine. All tick-rate transitions, pressure multipliers,
 * decision-window timeouts, and season phase boundaries live here.
 *
 * Architecture:
 *   - Pure data contract — zero runtime side-effects
 *   - Instantiated once at run start from server-delivered JSON
 *   - Consumed by: SeasonClock, TimeEngine, PressureEngine, RunHUD
 *
 * Tick Tier ladder (1 = slowest/calmest → 5 = fastest/max pressure):
 *   Tier 1 — FOUNDATION    3 000 ms/tick  ×1.0 pressure
 *   Tier 2 — MOMENTUM      2 000 ms/tick  ×1.4 pressure
 *   Tier 3 — ACCELERATION  1 500 ms/tick  ×1.9 pressure
 *   Tier 4 — CRISIS        1 000 ms/tick  ×2.6 pressure
 *   Tier 5 — COLLAPSE        700 ms/tick  ×3.5 pressure
 */

// ─── Core Types ───────────────────────────────────────────────────────────────

/** 1 = slowest/safest → 5 = fastest/most dangerous */
export type TickTier = 1 | 2 | 3 | 4 | 5;

/** Named season phase — drives narrative framing and card drop weights */
export type SeasonPhaseName =
  | 'FOUNDATION'
  | 'MOMENTUM'
  | 'ACCELERATION'
  | 'CRISIS'
  | 'COLLAPSE';

/** What happens to a decision window that expires without player action */
export type AutoResolveChoice = 'HOLD' | 'SKIP' | 'PLAY_CHEAPEST';

// ─── Config Interfaces ────────────────────────────────────────────────────────

/**
 * Per-tier timing and pressure configuration.
 * The manifest always carries exactly 5 of these — one per TickTier.
 */
export interface TickTierConfig {
  /** 1–5 */
  tier:                   TickTier;
  /** HUD display label */
  label:                  SeasonPhaseName;
  /** Tick duration in milliseconds */
  durationMs:             number;
  /**
   * Multiplier applied to raw pressure score when this tier is active.
   * 1.0 = no amplification. 3.5 = full COLLAPSE amplification.
   */
  pressureMultiplier:     number;
  /**
   * Fraction of totalTickBudget consumed before this tier activates.
   * Tier 1 = 0.00 (always active at run start).
   */
  activatesAtSeasonPct:   number;
  /** Minimum card hand size enforced while in this tier */
  minHandSize:            number;
  /** Max simultaneously open decision windows */
  maxConcurrentWindows:   number;
  /** Whether Bleed Mode is eligible to activate in this tier */
  bleedModeEligible:      boolean;
}

/**
 * Decision window timing contract per tier.
 * Higher tiers = shorter windows = more pressure.
 */
export interface DecisionWindowConfig {
  tier:                    TickTier;
  /** How long (ms) the window stays open before auto-resolve triggers */
  openDurationMs:          number;
  /** Action taken if the player doesn't resolve before openDurationMs */
  autoResolveChoice:       AutoResolveChoice;
  /** Speed score for resolving in first 50% of the window */
  speedScoreOptimal:       number;
  /** Speed score for resolving before window closes */
  speedScoreOnTime:        number;
  /** Speed score applied when auto-resolved */
  speedScoreAutoResolved:  number;
}

/**
 * A named season phase spanning a range of ticks.
 * Drives card drop weights, event eligibility, and pressure bounds.
 */
export interface SeasonPhase {
  id:                     SeasonPhaseName;
  label:                  string;
  /** Inclusive first tick of this phase */
  startsAtTick:           number;
  /** Inclusive last tick (use Infinity for the terminal phase) */
  endsAtTick:             number;
  /** Minimum pressure score during this phase */
  pressureFloor:          number;
  /** Maximum pressure score during this phase */
  pressureCeiling:        number;
  /**
   * Multiplier on card drop weights.
   * 1.0 = balanced, 2.0 = heavily weighted toward adversarial cards.
   */
  cardDropWeightModifier: number;
  /** The TickTier active during this phase */
  tier:                   TickTier;
}

/**
 * Raw JSON shape for a season timeline.
 * Delivered from server, then parsed via SeasonTimelineManifest.fromJSON().
 */
export interface SeasonTimelineData {
  /** Canonical season ID, e.g. "SEASON_0" */
  seasonId:                       string;
  /** Unix timestamp (ms) — season opens for new runs */
  startTime:                      number;
  /** Unix timestamp (ms) — season closes */
  endTime:                        number;
  /** Total tick budget for a single run */
  totalTickBudget:                number;
  /** Fire SEASON_TIMEOUT_IMMINENT when ticksRemaining ≤ this */
  timeoutWarningAtTicksRemaining: number;
  /** Exactly 5 entries — one per TickTier, order does not matter */
  tickTiers:                      TickTierConfig[];
  /** One per tier, order does not matter */
  decisionWindows:                DecisionWindowConfig[];
  /** At least 1 phase required, ordered by startsAtTick ascending */
  phases:                         SeasonPhase[];
  meta: {
    version:    string;
    releasedAt: number;
    label:      string;
  };
}

// ─── Internal Validation ──────────────────────────────────────────────────────

function assertTiers(tiers: TickTierConfig[]): void {
  if (tiers.length !== 5) {
    throw new Error(
      `[SeasonTimelineManifest] tickTiers must have exactly 5 entries, got ${tiers.length}`,
    );
  }
  for (const t of tiers) {
    if (t.pressureMultiplier <= 0) {
      throw new Error(
        `[SeasonTimelineManifest] Tier ${t.tier}: pressureMultiplier must be > 0`,
      );
    }
    if (t.durationMs <= 0) {
      throw new Error(
        `[SeasonTimelineManifest] Tier ${t.tier}: durationMs must be > 0`,
      );
    }
  }
}

function assertWindows(windows: DecisionWindowConfig[]): void {
  if (windows.length !== 5) {
    throw new Error(
      `[SeasonTimelineManifest] decisionWindows must have exactly 5 entries, got ${windows.length}`,
    );
  }
  for (const w of windows) {
    if (w.openDurationMs <= 0) {
      throw new Error(
        `[SeasonTimelineManifest] DecisionWindow tier ${w.tier}: openDurationMs must be > 0`,
      );
    }
  }
}

function assertPhases(phases: SeasonPhase[]): void {
  if (phases.length === 0) {
    throw new Error('[SeasonTimelineManifest] phases array must not be empty');
  }
}

// ─── Main Class ───────────────────────────────────────────────────────────────

export class SeasonTimelineManifest {
  private readonly data:              SeasonTimelineData;
  private readonly multiplierIndex:   Map<TickTier, number>;
  private readonly tierConfigIndex:   Map<TickTier, TickTierConfig>;
  private readonly windowConfigIndex: Map<TickTier, DecisionWindowConfig>;

  constructor(data: SeasonTimelineData) {
    assertTiers(data.tickTiers);
    assertWindows(data.decisionWindows);
    assertPhases(data.phases);

    if (data.totalTickBudget <= 0) {
      throw new Error('[SeasonTimelineManifest] totalTickBudget must be > 0');
    }
    if (data.endTime <= data.startTime) {
      throw new Error('[SeasonTimelineManifest] endTime must be after startTime');
    }

    this.data = data;

    this.multiplierIndex = new Map(
      data.tickTiers.map(t => [t.tier, t.pressureMultiplier]),
    );
    this.tierConfigIndex = new Map(
      data.tickTiers.map(t => [t.tier, t]),
    );
    this.windowConfigIndex = new Map(
      data.decisionWindows.map(w => [w.tier, w]),
    );
  }

  // ── Pressure ───────────────────────────────────────────────────────────────

  /**
   * Returns pressure multipliers for all 5 tiers, sorted Tier 1 → 5.
   * Index 0 = Tier 1 multiplier, Index 4 = Tier 5 multiplier.
   *
   * Consumed by PressureEngine to scale raw pressure score.
   */
  getPressureMultipliers(): number[] {
    const multipliers = this.extractMultipliers();
    if (multipliers.length === 0) {
      throw new Error(
        '[SeasonTimelineManifest] No pressure multipliers found in season timeline',
      );
    }
    return multipliers;
  }

  private extractMultipliers(): number[] {
    return this.data.tickTiers
      .slice()
      .sort((a, b) => a.tier - b.tier)
      .map(t => t.pressureMultiplier);
  }

  /**
   * Returns the pressure multiplier for a specific tier.
   */
  getPressureMultiplierForTier(tier: TickTier): number {
    const mult = this.multiplierIndex.get(tier);
    if (mult === undefined) {
      throw new Error(
        `[SeasonTimelineManifest] No pressure multiplier for tier ${tier}`,
      );
    }
    return mult;
  }

  // ── Tick Tier ──────────────────────────────────────────────────────────────

  /** Full config for a single tier */
  getTickTierConfig(tier: TickTier): TickTierConfig {
    const config = this.tierConfigIndex.get(tier);
    if (!config) {
      throw new Error(
        `[SeasonTimelineManifest] No tier config found for tier ${tier}`,
      );
    }
    return config;
  }

  /** All 5 tier configs, sorted Tier 1 → 5 */
  getAllTierConfigs(): TickTierConfig[] {
    return [...this.tierConfigIndex.values()].sort((a, b) => a.tier - b.tier);
  }

  /**
   * Which TickTier is active at a given tick within a run.
   * Derived from activatesAtSeasonPct thresholds.
   */
  getTierAtTick(tick: number): TickTier {
    const progress = Math.min(1, tick / this.data.totalTickBudget);
    const sorted   = this.getAllTierConfigs();
    let active: TickTier = 1;
    for (const cfg of sorted) {
      if (progress >= cfg.activatesAtSeasonPct) {
        active = cfg.tier;
      }
    }
    return active;
  }

  /** Tick duration in ms for a given tier */
  getTickDurationMs(tier: TickTier): number {
    return this.getTickTierConfig(tier).durationMs;
  }

  // ── Decision Windows ───────────────────────────────────────────────────────

  /** Decision window config for a given tier */
  getDecisionWindowConfig(tier: TickTier): DecisionWindowConfig {
    const config = this.windowConfigIndex.get(tier);
    if (!config) {
      throw new Error(
        `[SeasonTimelineManifest] No decision window config for tier ${tier}`,
      );
    }
    return config;
  }

  /** All decision window configs, sorted Tier 1 → 5 */
  getAllDecisionWindowConfigs(): DecisionWindowConfig[] {
    return [...this.windowConfigIndex.values()].sort((a, b) => a.tier - b.tier);
  }

  // ── Phase System ───────────────────────────────────────────────────────────

  /**
   * Active SeasonPhase at a given tick.
   * Falls back to last phase if tick exceeds all defined ranges.
   */
  getPhaseAtTick(tick: number): SeasonPhase {
    const sorted = [...this.data.phases].sort(
      (a, b) => a.startsAtTick - b.startsAtTick,
    );
    let active = sorted[0];
    for (const phase of sorted) {
      if (tick >= phase.startsAtTick) {
        active = phase;
      }
    }
    return active;
  }

  /** All phases, sorted startsAtTick ascending */
  getAllPhases(): SeasonPhase[] {
    return [...this.data.phases].sort((a, b) => a.startsAtTick - b.startsAtTick);
  }

  // ── Season Clock ───────────────────────────────────────────────────────────

  get startTime():             number { return this.data.startTime; }
  get endTime():               number { return this.data.endTime; }
  get totalTickBudget():       number { return this.data.totalTickBudget; }
  get timeoutWarningThreshold(): number { return this.data.timeoutWarningAtTicksRemaining; }
  get seasonId():              string { return this.data.seasonId; }

  /**
   * Whether the season is currently open for new runs.
   * Pass a custom nowFn for testing.
   */
  isSeasonActive(nowFn: () => number = Date.now): boolean {
    const now = nowFn();
    return now >= this.data.startTime && now < this.data.endTime;
  }

  /**
   * Season progress 0–1 based on real-world wall-clock time.
   * 0 = just started, 1 = ended.
   */
  getSeasonProgress(nowFn: () => number = Date.now): number {
    const now      = nowFn();
    const elapsed  = now - this.data.startTime;
    const duration = this.data.endTime - this.data.startTime;
    return Math.min(1, Math.max(0, elapsed / duration));
  }

  /**
   * Run-level progress 0–1 based on ticks consumed within a run.
   */
  getRunProgress(ticksElapsed: number): number {
    return Math.min(1, Math.max(0, ticksElapsed / this.data.totalTickBudget));
  }

  /**
   * True when ticksRemaining falls to or below the timeout warning threshold.
   * Triggers SEASON_TIMEOUT_IMMINENT event in the time engine.
   */
  shouldWarnTimeout(ticksRemaining: number): boolean {
    return ticksRemaining <= this.data.timeoutWarningAtTicksRemaining;
  }

  // ── Serialization ──────────────────────────────────────────────────────────

  toJSON(): Readonly<SeasonTimelineData> {
    return Object.freeze({ ...this.data });
  }

  /**
   * Build a manifest from raw JSON (e.g. server payload or localStorage).
   * Throws descriptively on malformed input.
   */
  static fromJSON(raw: unknown): SeasonTimelineManifest {
    if (typeof raw !== 'object' || raw === null) {
      throw new Error(
        '[SeasonTimelineManifest] fromJSON: expected object, got ' + typeof raw,
      );
    }
    return new SeasonTimelineManifest(raw as SeasonTimelineData);
  }
}

// ─── Season 0 Default Manifest ────────────────────────────────────────────────
/**
 * Hardcoded Season 0 manifest used when no server payload is available.
 *
 * Tier activation thresholds (Game Mode Bible v2):
 *   0–20%  → Tier 1  FOUNDATION
 *  20–45%  → Tier 2  MOMENTUM
 *  45–65%  → Tier 3  ACCELERATION
 *  65–85%  → Tier 4  CRISIS
 *  85–100% → Tier 5  COLLAPSE
 */
export const SEASON_0_MANIFEST_DATA: SeasonTimelineData = {
  seasonId:                       'SEASON_0',
  startTime:                      new Date('2026-01-01T00:00:00.000Z').getTime(),
  endTime:                        new Date('2026-12-31T23:59:59.000Z').getTime(),
  totalTickBudget:                1_200,
  timeoutWarningAtTicksRemaining: 120,

  tickTiers: [
    {
      tier: 1, label: 'FOUNDATION',
      durationMs: 3_000, pressureMultiplier: 1.0, activatesAtSeasonPct: 0.00,
      minHandSize: 3, maxConcurrentWindows: 2, bleedModeEligible: false,
    },
    {
      tier: 2, label: 'MOMENTUM',
      durationMs: 2_000, pressureMultiplier: 1.4, activatesAtSeasonPct: 0.20,
      minHandSize: 3, maxConcurrentWindows: 3, bleedModeEligible: false,
    },
    {
      tier: 3, label: 'ACCELERATION',
      durationMs: 1_500, pressureMultiplier: 1.9, activatesAtSeasonPct: 0.45,
      minHandSize: 4, maxConcurrentWindows: 3, bleedModeEligible: true,
    },
    {
      tier: 4, label: 'CRISIS',
      durationMs: 1_000, pressureMultiplier: 2.6, activatesAtSeasonPct: 0.65,
      minHandSize: 4, maxConcurrentWindows: 4, bleedModeEligible: true,
    },
    {
      tier: 5, label: 'COLLAPSE',
      durationMs: 700, pressureMultiplier: 3.5, activatesAtSeasonPct: 0.85,
      minHandSize: 5, maxConcurrentWindows: 5, bleedModeEligible: true,
    },
  ],

  phases: [
    {
      id: 'FOUNDATION', label: 'Foundation',
      startsAtTick: 0,     endsAtTick: 239,
      pressureFloor: 0,    pressureCeiling: 30,
      cardDropWeightModifier: 1.0, tier: 1,
    },
    {
      id: 'MOMENTUM', label: 'Momentum',
      startsAtTick: 240,   endsAtTick: 539,
      pressureFloor: 15,   pressureCeiling: 55,
      cardDropWeightModifier: 1.1, tier: 2,
    },
    {
      id: 'ACCELERATION', label: 'Acceleration',
      startsAtTick: 540,   endsAtTick: 779,
      pressureFloor: 35,   pressureCeiling: 75,
      cardDropWeightModifier: 1.25, tier: 3,
    },
    {
      id: 'CRISIS', label: 'Crisis',
      startsAtTick: 780,   endsAtTick: 1_019,
      pressureFloor: 60,   pressureCeiling: 90,
      cardDropWeightModifier: 1.5, tier: 4,
    },
    {
      id: 'COLLAPSE', label: 'Collapse',
      startsAtTick: 1_020, endsAtTick: Infinity,
      pressureFloor: 80,   pressureCeiling: 100,
      cardDropWeightModifier: 2.0, tier: 5,
    },
  ],

  decisionWindows: [
    {
      tier: 1, openDurationMs: 12_000, autoResolveChoice: 'HOLD',
      speedScoreOptimal: 100, speedScoreOnTime: 70, speedScoreAutoResolved: 25,
    },
    {
      tier: 2, openDurationMs: 9_000,  autoResolveChoice: 'HOLD',
      speedScoreOptimal: 100, speedScoreOnTime: 65, speedScoreAutoResolved: 20,
    },
    {
      tier: 3, openDurationMs: 6_000,  autoResolveChoice: 'SKIP',
      speedScoreOptimal: 100, speedScoreOnTime: 60, speedScoreAutoResolved: 15,
    },
    {
      tier: 4, openDurationMs: 4_000,  autoResolveChoice: 'SKIP',
      speedScoreOptimal: 100, speedScoreOnTime: 50, speedScoreAutoResolved: 10,
    },
    {
      tier: 5, openDurationMs: 2_500,  autoResolveChoice: 'PLAY_CHEAPEST',
      speedScoreOptimal: 100, speedScoreOnTime: 40, speedScoreAutoResolved:  5,
    },
  ],

  meta: {
    version:    '1.0.0',
    releasedAt: new Date('2026-01-01T00:00:00.000Z').getTime(),
    label:      'Season Zero — Origin Run',
  },
};

/** Singleton — import directly when no server manifest is available */
export const defaultManifest = new SeasonTimelineManifest(SEASON_0_MANIFEST_DATA);