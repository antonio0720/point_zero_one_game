// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE DIGITAL — MODE CONFIGURATION
// pzo_engine/src/config/mode-config.ts
//
// Per-mode tuning parameters consumed by mode engines and TurnEngine.
// All values reference pzo_constants.ts — never re-define numeric literals here.
//
// ── WHAT THIS FILE IS ──────────────────────────────────────────────────────────
// A typed, mode-keyed configuration registry. Mode engines (EmpireEngine,
// PredatorEngine, SyndicateEngine, PhantomEngine) import their config slice
// from here instead of embedding magic numbers inline.
//
// ── IMPORT PATTERN ────────────────────────────────────────────────────────────
//   import { MODE_CONFIGS, type ModeConfig } from '../config/mode-config';
//   const config = MODE_CONFIGS['GO_ALONE'];
//
// Density6 LLC · Point Zero One · Engine Layer · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import {
  // Empire
  BLEED_CASH_THRESHOLD, BLEED_ACTIVATION_MONTHS, BLEED_ESCALATION_TICKS,
  BLEED_TERMINAL_TICKS, BLEED_RESOLUTION_INCOME_MIN,
  ISOLATION_TAX_PCT, ISOLATION_SAFE_CASH,
  // Predator
  PSYCHE_SCORE_MAX, PSYCHE_TILT_THRESHOLD, PSYCHE_DECAY_RATE_COMBAT,
  PSYCHE_DECAY_RATE_IDLE, PSYCHE_RESTORE_ON_COUNTER,
  TILT_CARD_COST_MULT, TILT_COUNTER_WINDOW_MINUS,
  BOT_MAX_SIMULTANEOUS, BOT_COUNTER_INTEL_CHANCE,
  SABOTAGE_MAX_AMMO, SABOTAGE_COUNTER_WINDOW, SABOTAGE_BASE_TICKS,
  BATTLE_BUDGET_MAX, BATTLE_BUDGET_REGEN_PM,
  BATTLE_BUDGET_ATTACK_COST, BATTLE_BUDGET_COUNTER_COST,
  BATTLE_ROUND_TICKS,
  // Syndicate
  TRUST_SCORE_INITIAL, TRUST_DEFECTION_THRESHOLD,
  TRUST_BREACH_PENALTY, TRUST_FULFILL_REWARD, TRUST_DECAY_PM,
  RESCUE_WINDOW_DURATION, RESCUE_WINDOW_INTERVAL, RESCUE_WINDOW_CHANCE,
  // Phantom
  HATER_HEAT_MAX, GHOST_TICK_INTERVAL, LEGEND_DECAY_RATE,
  LEGEND_PRESSURE_GAP_PCT, COMMUNITY_HEAT_BOOST,
  DYNASTY_CHALLENGES_FOR_SOVEREIGN,
  // Shared
  CORD_MODE_BONUS_BLEED_RECOVERY,
  MODE_EMPIRE, MODE_PREDATOR, MODE_SYNDICATE, MODE_PHANTOM,
} from './pzo_constants';

// ── Canonical mode type (engine-layer, Node-safe, no React) ───────────────────
export type CanonicalMode = 'GO_ALONE' | 'HEAD_TO_HEAD' | 'TEAM_UP' | 'CHASE_A_LEGEND';
export type ModeAlias     = 'EMPIRE' | 'PREDATOR' | 'SYNDICATE' | 'PHANTOM';

// ── Base mode config shape ─────────────────────────────────────────────────────
export interface ModeConfig {
  /** Canonical mode string used by EngineOrchestrator and ModeRouter. */
  canonicalMode:  CanonicalMode;
  /** UI-facing alias used by components and lobby. */
  alias:          ModeAlias;
  /** Human display label. */
  label:          string;
  /** One-line description for lobby screen. */
  description:    string;
  /** Mode-specific CORD bonus multiplier applied to final score. */
  cordBonus:      number;
  /** Whether this mode uses the battle/bot system. */
  hasBattleSystem: boolean;
  /** Whether this mode uses bleed mechanics. */
  hasBleedSystem:  boolean;
  /** Whether this mode uses the trust/defection system. */
  hasTrustSystem:  boolean;
  /** Whether this mode uses ghost replay comparison. */
  hasGhostSystem:  boolean;
  /** Mode-specific deck injection types (added to base 6-deck set). */
  modeDecks:       string[];
  /** Mode-specific tuning parameters. */
  params:          ModeParams;
}

// ── Mode-specific parameter shapes ────────────────────────────────────────────
export interface EmpireParams {
  bleedCashThreshold:       number;
  bleedActivationMonths:    number;
  bleedEscalationTicks:     number;
  bleedTerminalTicks:       number;
  bleedResolutionIncomeMin: number;
  isolationTaxPct:          number;
  isolationSafeCash:        number;
}

export interface PredatorParams {
  psycheScoreMax:           number;
  psycheTiltThreshold:      number;
  psycheDecayRateCombat:    number;
  psycheDecayRateIdle:      number;
  psycheRestoreOnCounter:   number;
  tiltCardCostMult:         number;
  tiltCounterWindowMinus:   number;
  botMaxSimultaneous:       number;
  botCounterIntelChance:    number;
  sabotagMaxAmmo:           number;
  sabotageCounterWindow:    number;
  sabotageBaseTicks:        number;
  battleBudgetMax:          number;
  battleBudgetRegenPM:      number;
  battleBudgetAttackCost:   number;
  battleBudgetCounterCost:  number;
  battleRoundTicks:         number;
}

export interface SyndicateParams {
  trustScoreInitial:        number;
  trustDefectionThreshold:  number;
  trustBreachPenalty:       number;
  trustFulfillReward:       number;
  trustDecayPM:             number;
  rescueWindowDuration:     number;
  rescueWindowInterval:     number;
  rescueWindowChance:       number;
}

export interface PhantomParams {
  haterHeatMax:                    number;
  ghostTickInterval:               number;
  legendDecayRate:                 number;
  legendPressureGapPct:            number;
  communityHeatBoost:              number;
  dynastyChallengesForSovereign:   number;
}

export type ModeParams =
  | EmpireParams
  | PredatorParams
  | SyndicateParams
  | PhantomParams;

// ── Empire (GO_ALONE) Config ───────────────────────────────────────────────────
const EMPIRE_CONFIG: ModeConfig = {
  canonicalMode:  MODE_EMPIRE,
  alias:          'EMPIRE',
  label:          'Empire',
  description:    'Build from nothing. Avoid the bleed. Stack income until freedom.',
  cordBonus:      CORD_MODE_BONUS_BLEED_RECOVERY,
  hasBattleSystem: false,
  hasBleedSystem:  true,
  hasTrustSystem:  false,
  hasGhostSystem:  false,
  modeDecks:      [],
  params: {
    bleedCashThreshold:       BLEED_CASH_THRESHOLD,
    bleedActivationMonths:    BLEED_ACTIVATION_MONTHS,
    bleedEscalationTicks:     BLEED_ESCALATION_TICKS,
    bleedTerminalTicks:       BLEED_TERMINAL_TICKS,
    bleedResolutionIncomeMin: BLEED_RESOLUTION_INCOME_MIN,
    isolationTaxPct:          ISOLATION_TAX_PCT,
    isolationSafeCash:        ISOLATION_SAFE_CASH,
  } satisfies EmpireParams,
};

// ── Predator (HEAD_TO_HEAD) Config ────────────────────────────────────────────
const PREDATOR_CONFIG: ModeConfig = {
  canonicalMode:  MODE_PREDATOR,
  alias:          'PREDATOR',
  label:          'Predator',
  description:    'Counter haters. Protect your psyche. Outlast the attack waves.',
  cordBonus:      0,
  hasBattleSystem: true,
  hasBleedSystem:  false,
  hasTrustSystem:  false,
  hasGhostSystem:  false,
  modeDecks:      ['SABOTAGE', 'COUNTER', 'BLUFF'],
  params: {
    psycheScoreMax:           PSYCHE_SCORE_MAX,
    psycheTiltThreshold:      PSYCHE_TILT_THRESHOLD,
    psycheDecayRateCombat:    PSYCHE_DECAY_RATE_COMBAT,
    psycheDecayRateIdle:      PSYCHE_DECAY_RATE_IDLE,
    psycheRestoreOnCounter:   PSYCHE_RESTORE_ON_COUNTER,
    tiltCardCostMult:         TILT_CARD_COST_MULT,
    tiltCounterWindowMinus:   TILT_COUNTER_WINDOW_MINUS,
    botMaxSimultaneous:       BOT_MAX_SIMULTANEOUS,
    botCounterIntelChance:    BOT_COUNTER_INTEL_CHANCE,
    sabotagMaxAmmo:           SABOTAGE_MAX_AMMO,
    sabotageCounterWindow:    SABOTAGE_COUNTER_WINDOW,
    sabotageBaseTicks:        SABOTAGE_BASE_TICKS,
    battleBudgetMax:          BATTLE_BUDGET_MAX,
    battleBudgetRegenPM:      BATTLE_BUDGET_REGEN_PM,
    battleBudgetAttackCost:   BATTLE_BUDGET_ATTACK_COST,
    battleBudgetCounterCost:  BATTLE_BUDGET_COUNTER_COST,
    battleRoundTicks:         BATTLE_ROUND_TICKS,
  } satisfies PredatorParams,
};

// ── Syndicate (TEAM_UP) Config ────────────────────────────────────────────────
const SYNDICATE_CONFIG: ModeConfig = {
  canonicalMode:  MODE_SYNDICATE,
  alias:          'SYNDICATE',
  label:          'Syndicate',
  description:    'Trust your allies or lose them. Defection collapses the treasury.',
  cordBonus:      0,
  hasBattleSystem: false,
  hasBleedSystem:  false,
  hasTrustSystem:  true,
  hasGhostSystem:  false,
  modeDecks:      ['AID', 'RESCUE', 'TRUST', 'DEFECTION'],
  params: {
    trustScoreInitial:        TRUST_SCORE_INITIAL,
    trustDefectionThreshold:  TRUST_DEFECTION_THRESHOLD,
    trustBreachPenalty:       TRUST_BREACH_PENALTY,
    trustFulfillReward:       TRUST_FULFILL_REWARD,
    trustDecayPM:             TRUST_DECAY_PM,
    rescueWindowDuration:     RESCUE_WINDOW_DURATION,
    rescueWindowInterval:     RESCUE_WINDOW_INTERVAL,
    rescueWindowChance:       RESCUE_WINDOW_CHANCE,
  } satisfies SyndicateParams,
};

// ── Phantom (CHASE_A_LEGEND) Config ───────────────────────────────────────────
const PHANTOM_CONFIG: ModeConfig = {
  canonicalMode:  MODE_PHANTOM,
  alias:          'PHANTOM',
  label:          'Phantom',
  description:    'Race your own history. Beat your dynasty. Claim PHANTOM SOVEREIGN.',
  cordBonus:      0,
  hasBattleSystem: false,
  hasBleedSystem:  false,
  hasTrustSystem:  false,
  hasGhostSystem:  true,
  modeDecks:      ['GHOST', 'DISCIPLINE'],
  params: {
    haterHeatMax:                  HATER_HEAT_MAX,
    ghostTickInterval:             GHOST_TICK_INTERVAL,
    legendDecayRate:               LEGEND_DECAY_RATE,
    legendPressureGapPct:          LEGEND_PRESSURE_GAP_PCT,
    communityHeatBoost:            COMMUNITY_HEAT_BOOST,
    dynastyChallengesForSovereign: DYNASTY_CHALLENGES_FOR_SOVEREIGN,
  } satisfies PhantomParams,
};

// ── Master Config Registry ─────────────────────────────────────────────────────
export const MODE_CONFIGS: Record<CanonicalMode, ModeConfig> = {
  [MODE_EMPIRE]:    EMPIRE_CONFIG,
  [MODE_PREDATOR]:  PREDATOR_CONFIG,
  [MODE_SYNDICATE]: SYNDICATE_CONFIG,
  [MODE_PHANTOM]:   PHANTOM_CONFIG,
};

/** Get mode config by canonical mode string. Throws if invalid. */
export function getModeConfig(mode: CanonicalMode): ModeConfig {
  const config = MODE_CONFIGS[mode];
  if (!config) throw new Error(`[mode-config] Unknown canonical mode: ${mode}`);
  return config;
}

/** Get mode config by alias (EMPIRE | PREDATOR | SYNDICATE | PHANTOM). */
export function getModeConfigByAlias(alias: ModeAlias): ModeConfig {
  const entry = Object.values(MODE_CONFIGS).find(c => c.alias === alias);
  if (!entry) throw new Error(`[mode-config] Unknown mode alias: ${alias}`);
  return entry;
}

/** Returns true if mode string is a valid canonical mode. */
export function isCanonicalMode(mode: string): mode is CanonicalMode {
  return mode in MODE_CONFIGS;
}