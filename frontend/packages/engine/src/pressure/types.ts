/**
 * FILE: pzo-web/src/engines/pressure/types.ts
 * All types, enums, constants, and interfaces for the Pressure Engine.
 * Imported by PressureEngine, all sub-files, engineStore, and PressureReader consumers.
 */

// ── Tier Enum ─────────────────────────────────────────────────────────────
export enum PressureTier {
  CALM     = 'CALM',
  BUILDING = 'BUILDING',
  ELEVATED = 'ELEVATED',
  HIGH     = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// ── Score Boundaries (inclusive lower, exclusive upper) ───────────────────
export const PRESSURE_TIER_BOUNDS: Record<PressureTier, [number, number]> = {
  [PressureTier.CALM]:     [0.00, 0.21],
  [PressureTier.BUILDING]: [0.21, 0.41],
  [PressureTier.ELEVATED]: [0.41, 0.61],
  [PressureTier.HIGH]:     [0.61, 0.81],
  [PressureTier.CRITICAL]: [0.81, 1.01],
};

// ── Visual config per tier ────────────────────────────────────────────────
export interface PressureTierConfig {
  tier: PressureTier;
  minScore: number;
  maxScore: number;
  label: string;
  colorHex: string;
  audioIntensity: number;
  allowsHaterInjection: boolean;
  passiveShieldDrain: boolean;
}

export const PRESSURE_TIER_CONFIGS: Record<PressureTier, PressureTierConfig> = {
  [PressureTier.CALM]: {
    tier: PressureTier.CALM, minScore: 0.00, maxScore: 0.21,
    label: 'CALM', colorHex: '#C9A84C', audioIntensity: 0.0,
    allowsHaterInjection: false, passiveShieldDrain: false,
  },
  [PressureTier.BUILDING]: {
    tier: PressureTier.BUILDING, minScore: 0.21, maxScore: 0.41,
    label: 'BUILDING', colorHex: '#C9A84C', audioIntensity: 0.15,
    allowsHaterInjection: false, passiveShieldDrain: false,
  },
  [PressureTier.ELEVATED]: {
    tier: PressureTier.ELEVATED, minScore: 0.41, maxScore: 0.61,
    label: 'ELEVATED', colorHex: '#B97D27', audioIntensity: 0.40,
    allowsHaterInjection: false, passiveShieldDrain: false,
  },
  [PressureTier.HIGH]: {
    tier: PressureTier.HIGH, minScore: 0.61, maxScore: 0.81,
    label: 'HIGH', colorHex: '#B92B27', audioIntensity: 0.70,
    allowsHaterInjection: false, passiveShieldDrain: true,
  },
  [PressureTier.CRITICAL]: {
    tier: PressureTier.CRITICAL, minScore: 0.81, maxScore: 1.01,
    label: 'CRITICAL', colorHex: '#FF0000', audioIntensity: 1.0,
    allowsHaterInjection: true, passiveShieldDrain: true,
  },
};

// ── Signal Weights ────────────────────────────────────────────────────────
export interface PressureSignalWeights {
  cashflowNegative:    number; // expenses > income: 0.25
  lowCashBalance:      number; // balance < 1 month expenses: 0.20
  haterHeatHigh:       number; // hater_heat > 50: 0.15
  activeThreatCards:   number; // per card: +0.04, max 0.15
  lowShieldIntegrity:  number; // shield < 40%: 0.12
  stagnationTax:       number; // consec. ticks without income growth: 0.08
  activeCascadeChains: number; // each active chain: +0.05, max 0.10
  prosperityBonus:     number; // net worth > 2x freedom threshold: 0.20
  fullSecurityBonus:   number; // full shield + no threats: 0.15
}

export const DEFAULT_SIGNAL_WEIGHTS: PressureSignalWeights = {
  cashflowNegative:    0.25,
  lowCashBalance:      0.20,
  haterHeatHigh:       0.15,
  activeThreatCards:   0.15,
  lowShieldIntegrity:  0.12,
  stagnationTax:       0.08,
  activeCascadeChains: 0.10,
  prosperityBonus:     0.20,
  fullSecurityBonus:   0.15,
};

/**
 * Priority order for tie-breaking dominant signal detection.
 * First entry in list wins when two positive signals have equal contribution.
 */
export const DOMINANT_SIGNAL_PRIORITY: (keyof PressureSignalWeights)[] = [
  'cashflowNegative',
  'lowCashBalance',
  'haterHeatHigh',
  'activeThreatCards',
  'lowShieldIntegrity',
  'stagnationTax',
  'activeCascadeChains',
];

// ── Trend Detection Mode ──────────────────────────────────────────────────
export enum TrendMode {
  /** Each consecutive tick in window must be strictly greater than the previous. */
  STRICT = 'STRICT',
  /** Net delta across window must be positive. Tolerates flat ticks. */
  SLOPE  = 'SLOPE',
}

// ── Pressure Tuning Parameters ────────────────────────────────────────────
export interface PressureTuning {
  trendWindow:     number;    // number of ticks in trend window. Default: 3
  trendMode:       TrendMode; // escalation/decay detection algorithm. Default: STRICT
  threatCardSlope: number;    // score contribution per threat card. Default: 0.04
}

export const PRESSURE_TUNING_DEFAULTS: PressureTuning = {
  trendWindow:     3,
  trendMode:       TrendMode.STRICT,
  threatCardSlope: 0.04,
};

// ── Runtime Input Snapshot ────────────────────────────────────────────────
export interface PressureReadInput {
  readonly monthlyIncome:            number; // current run income / month
  readonly monthlyExpenses:          number; // current run expenses / month
  readonly cashBalance:              number; // liquid cash on hand
  readonly haterHeat:                number; // from DB: users.hater_heat (0–100)
  readonly activeThreatCardCount:    number; // unmitigated threat cards in play
  readonly shieldIntegrityPct:       number; // 0.0–1.0 (ShieldEngine read)
  readonly ticksWithoutIncomeGrowth: number; // consecutive stagnant ticks
  readonly activeCascadeChainCount:  number; // CascadeEngine active chains
  readonly netWorth:                 number; // current net worth calculation
  readonly freedomThreshold:         number; // target net worth to win
}

// ── Output Snapshot ───────────────────────────────────────────────────────
export interface PressureSnapshot {
  readonly score:               number;                              // 0.0–1.0 clipped
  readonly rawScore:            number;                              // pre-clip, pre-decay score
  readonly tier:                PressureTier;
  readonly previousTier:        PressureTier | null;
  readonly tierChangedThisTick: boolean;
  readonly scoreHistory:        readonly number[];                   // last 20 ticks
  readonly isEscalating:        boolean;                            // trending up
  readonly isDecaying:          boolean;                            // trending down
  readonly dominantSignal:      keyof PressureSignalWeights | null; // highest contributor
  readonly signalBreakdown:     Readonly<Record<keyof PressureSignalWeights, number>>;
  readonly tickNumber:          number;
  readonly timestamp:           number;
}

// ── PressureReader — interface TimeEngine uses ────────────────────────────
export interface PressureReader {
  getCurrentTier():  PressureTier;
  getCurrentScore(): number;
  getScoreHistory(): readonly number[];
  isEscalating():    boolean;
  getSnapshot():     PressureSnapshot;
}

// ── Minimal EventBus interface (avoids hard dependency on core/EventBus) ──
export interface IEventBus {
  emit(event: string, payload?: unknown): void;
}

// ── Event Payload Types ───────────────────────────────────────────────────
export interface PressureTierChangedEvent {
  eventType:   'PRESSURE_TIER_CHANGED';
  from:        PressureTier;
  to:          PressureTier;
  score:       number;
  tickNumber:  number;
  timestamp:   number;
  isEscalating: boolean;
}

export interface PressureScoreUpdatedEvent {
  eventType:       'PRESSURE_SCORE_UPDATED';
  score:           number;
  tier:            PressureTier;
  tickNumber:      number;
  timestamp:       number;
  signalBreakdown: Record<string, number>;
}

export interface PressureCriticalEnteredEvent {
  eventType:  'PRESSURE_CRITICAL_ENTERED';
  score:      number;
  tickNumber: number;
  timestamp:  number;
}

export type PressureEvent =
  | PressureTierChangedEvent
  | PressureScoreUpdatedEvent
  | PressureCriticalEnteredEvent;
