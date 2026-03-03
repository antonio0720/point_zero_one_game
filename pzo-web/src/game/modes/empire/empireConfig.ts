// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/empire/empireConfig.ts
// Sprint 5 — Empire (GO ALONE) mode configuration
//
// SPRINT 5 ADDITIONS:
//   - battleBudgetBase, counterplayWindowTicks, maxInjectedCards
//   - isolationTaxFreezeBonus, waveActivationGraceTicks
//   - EMPIRE_BOT_WAVE_REGISTRY — maps wave → active bot IDs
//   - BOT_ACTIVATION_ORDER — ordered bot activation sequence
//   - BLEED_SEVERITY_COLORS/ICONS/LABELS remain here (self-contained in bleedMode too)
//
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import { C } from '../shared/designTokens';
import type { BleedSeverity } from './bleedMode';

// ── Enum import for bot IDs (from battle engine) ──────────────────────────────
// BotId is defined in engines/battle/types.ts.
// We reference as string literals here to avoid circular engine dependency.
// The rule engine validates these at runtime via BotProfileRegistry.
export const EMPIRE_BOT_WAVE_REGISTRY: Readonly<Record<number, readonly string[]>> = Object.freeze({
  1: ['BOT_01'],                                          // Wave 1: The Liquidator
  2: ['BOT_01', 'BOT_02'],                               // Wave 2: + The Bureaucrat
  3: ['BOT_01', 'BOT_02', 'BOT_03'],                    // Wave 3: + The Manipulator
  4: ['BOT_01', 'BOT_02', 'BOT_03', 'BOT_04'],         // Wave 4: + The Crash Prophet
  5: ['BOT_01', 'BOT_02', 'BOT_03', 'BOT_04', 'BOT_05'], // Wave 5: + The Legacy Heir
});

/** Ordered bot IDs by activation sequence */
export const BOT_ACTIVATION_ORDER: Readonly<string[]> = Object.freeze([
  'BOT_01', 'BOT_02', 'BOT_03', 'BOT_04', 'BOT_05',
]);

// ── Empire Config Shape ───────────────────────────────────────────────────────

export interface EmpireConfig {
  // ── Isolation tax ─────────────────────────────────────────────────────────
  /** Base isolation tax rate applied to all solo card purchases (0.0–0.10) */
  isolationTaxBase:               number;
  /** Multiplier floor when shields > 1 — tax is reduced per shield */
  isolationTaxShieldReduction:    number;
  /** Reduce isolation tax when player is frozen (already penalized) */
  isolationTaxFreezeBonus:        number;

  // ── Bleed mode ────────────────────────────────────────────────────────────
  /** Cash threshold below which Bleed Mode activates (% of income) */
  bleedModeActivationRatio:       number;
  /** Income multiplier bonus while in bleed mode + bleedAmplifier card */
  bleedModeAmplifierBonus:        number;
  /** Cash recovery above activation threshold that ends bleed mode */
  bleedModeExitThreshold:         number;
  /** Maximum cashflow for Comeback Surge eligibility (0 = negative cashflow) */
  comebackSurgeCashflowThreshold: number;
  /** XP bonus awarded on comeback surge plays */
  comebackSurgeXpBonus:           number;

  // ── Pressure journal ──────────────────────────────────────────────────────
  /** Ticks between pressure journal snapshots */
  pressureJournalSnapshotInterval: number;
  /** Maximum case file entries stored per run */
  caseFileMaxEntries:              number;

  // ── Battle / counterplay ──────────────────────────────────────────────────
  /** Base battle budget points per tick (mirrors INCOME_TIER_BUDGETS.SURVIVAL) */
  battleBudgetBase:               number;
  /** Ticks the player has to respond to an injected card before consequence fires */
  counterplayWindowTicks:         number;
  /** Max simultaneous injected hostile cards (mirrors BATTLE_CONSTANTS.MAX_INJECTED_CARDS) */
  maxInjectedCards:               number;
  /** Grace ticks after wave transition before newly activated bots start attacking */
  waveActivationGraceTicks:       number;
}

export const EMPIRE_CONFIG: Readonly<EmpireConfig> = Object.freeze({
  // ── Isolation tax ─────────────────────────────────────────────────────────
  isolationTaxBase:                0.03,   // 3% friction on solo purchases
  isolationTaxShieldReduction:     0.01,   // each shield reduces rate by 1%
  isolationTaxFreezeBonus:         0.50,   // tax halved when player is frozen

  // ── Bleed mode ────────────────────────────────────────────────────────────
  bleedModeActivationRatio:        2.0,    // bleed = cash < income * 2
  bleedModeAmplifierBonus:         0.25,   // +25% income on amplifier cards while bleeding
  bleedModeExitThreshold:          5_000,  // $5K above activation → exit bleed
  comebackSurgeCashflowThreshold:  0,      // negative cashflow qualifies for surge
  comebackSurgeXpBonus:            15,

  // ── Pressure journal ──────────────────────────────────────────────────────
  pressureJournalSnapshotInterval: 6,      // snapshot every 6 ticks
  caseFileMaxEntries:              200,

  // ── Battle / counterplay ──────────────────────────────────────────────────
  battleBudgetBase:                2,      // pts/tick at SURVIVAL income tier
  counterplayWindowTicks:          3,      // ticks to respond to injected card
  maxInjectedCards:                3,      // matches BATTLE_CONSTANTS.MAX_INJECTED_CARDS
  waveActivationGraceTicks:        5,      // grace period before new wave bots attack
});

// ── Empire Phase (Wave) System ────────────────────────────────────────────────

export type EmpirePhase = 'AWAKENING' | 'RESISTANCE' | 'SIEGE' | 'RECKONING' | 'ANNIHILATION';

export interface EmpireWaveConfig {
  wave:          number;
  phase:         EmpirePhase;
  startTick:     number;
  endTick:       number;
  botCount:      number;
  penaltyMult:   number;    // multiplier on bot attack penalties
  accent:        string;    // wave color for UI
  /** Bot IDs active this wave — populated from EMPIRE_BOT_WAVE_REGISTRY */
  activeBotIds:  readonly string[];
  /** Theme label for UI event log */
  threatLabel:   string;
}

export const EMPIRE_WAVES: Readonly<EmpireWaveConfig[]> = Object.freeze([
  {
    wave: 1, phase: 'AWAKENING',    startTick: 0,   endTick: 143,
    botCount: 1, penaltyMult: 1.0,  accent: C.gold,
    activeBotIds: EMPIRE_BOT_WAVE_REGISTRY[1],
    threatLabel: 'The Liquidator watches.',
  },
  {
    wave: 2, phase: 'RESISTANCE',   startTick: 144, endTick: 287,
    botCount: 2, penaltyMult: 1.5,  accent: C.orange,
    activeBotIds: EMPIRE_BOT_WAVE_REGISTRY[2],
    threatLabel: 'The Bureaucrat arrives.',
  },
  {
    wave: 3, phase: 'SIEGE',        startTick: 288, endTick: 431,
    botCount: 3, penaltyMult: 2.0,  accent: '#FF6200',
    activeBotIds: EMPIRE_BOT_WAVE_REGISTRY[3],
    threatLabel: 'The Manipulator joins the siege.',
  },
  {
    wave: 4, phase: 'RECKONING',    startTick: 432, endTick: 575,
    botCount: 4, penaltyMult: 2.8,  accent: '#FF3800',
    activeBotIds: EMPIRE_BOT_WAVE_REGISTRY[4],
    threatLabel: 'The Crash Prophet accelerates.',
  },
  {
    wave: 5, phase: 'ANNIHILATION', startTick: 576, endTick: 720,
    botCount: 5, penaltyMult: 4.0,  accent: C.crimson,
    activeBotIds: EMPIRE_BOT_WAVE_REGISTRY[5],
    threatLabel: 'The Legacy Heir joins. All five active.',
  },
]);

export function getEmpirePhase(tick: number): EmpirePhase {
  for (let i = EMPIRE_WAVES.length - 1; i >= 0; i--) {
    if (tick >= EMPIRE_WAVES[i].startTick) return EMPIRE_WAVES[i].phase;
  }
  return 'AWAKENING';
}

export function getEmpireWave(tick: number): EmpireWaveConfig {
  for (let i = EMPIRE_WAVES.length - 1; i >= 0; i--) {
    if (tick >= EMPIRE_WAVES[i].startTick) return EMPIRE_WAVES[i];
  }
  return EMPIRE_WAVES[0];
}

export function getEmpireWaveNumber(tick: number): number {
  return getEmpireWave(tick).wave;
}

/**
 * Returns the bot ID that newly activates at a given wave transition.
 * Wave 1 → BOT_01, Wave 2 → BOT_02, etc.
 * Returns null for wave 1 (no transition, BOT_01 is initial).
 */
export function getNewBotForWave(wave: number): string | null {
  if (wave < 1 || wave > 5) return null;
  return BOT_ACTIVATION_ORDER[wave - 1] ?? null;
}

export const EMPIRE_PHASE_ACCENTS: Readonly<Record<EmpirePhase, string>> = Object.freeze({
  AWAKENING:    C.gold,
  RESISTANCE:   C.orange,
  SIEGE:        '#FF6200',
  RECKONING:    '#FF3800',
  ANNIHILATION: C.crimson,
});

// ── Bleed severity display helpers ────────────────────────────────────────────

export const BLEED_SEVERITY_COLORS: Readonly<Record<BleedSeverity, string>> = Object.freeze({
  NONE:     C.green,
  WATCH:    C.orange,
  CRITICAL: C.red,
  TERMINAL: C.crimson,
});

export const BLEED_SEVERITY_ICONS: Readonly<Record<BleedSeverity, string>> = Object.freeze({
  NONE:     '✓',
  WATCH:    '⚠',
  CRITICAL: '🔴',
  TERMINAL: '💀',
});

export const BLEED_SEVERITY_LABELS: Readonly<Record<BleedSeverity, string>> = Object.freeze({
  NONE:     'STABLE',
  WATCH:    'WATCH',
  CRITICAL: 'CRITICAL',
  TERMINAL: 'TERMINAL',
});

export function bleedSeverityColor(severity: BleedSeverity): string {
  return BLEED_SEVERITY_COLORS[severity];
}

// ── EventBus event name constants for Empire mode ────────────────────────────

export const EMPIRE_EVENT_NAMES = {
  BLEED_ACTIVATED:   'EMPIRE_BLEED_ACTIVATED',
  BLEED_RESOLVED:    'EMPIRE_BLEED_RESOLVED',
  BLEED_ESCALATED:   'EMPIRE_BLEED_ESCALATED',
  COMEBACK_SURGE:    'EMPIRE_COMEBACK_SURGE',
  ISOLATION_TAX_HIT: 'EMPIRE_ISOLATION_TAX_HIT',
  PHASE_CHANGED:     'EMPIRE_PHASE_CHANGED',
  BOT_ACTIVATED:     'EMPIRE_BOT_ACTIVATED',
  BOT_ATTACK_RECEIVED: 'EMPIRE_BOT_ATTACK_RECEIVED',
  CASE_FILE_READY:   'EMPIRE_CASE_FILE_READY',
} as const;