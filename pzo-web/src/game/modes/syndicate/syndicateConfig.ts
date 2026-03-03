// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/syndicate/syndicateConfig.ts
// Sprint 5 — Syndicate (TEAM UP) Mode Configuration — SOVEREIGN EDITION
// Density6 LLC · Confidential
//
// CHANGE LOG (vs prior):
//   • Role names aligned to Game Mode Bible: INCOME_BUILDER | SHIELD_ARCHITECT |
//     OPPORTUNITY_HUNTER | COUNTER_INTEL (replaces old ARCHITECT/ACCELERATOR/GUARDIAN/CONNECTOR)
//   • defectionMinTick corrected to 8 (bible spec: after tick 8)
//   • defectionTreasurySeizurePct corrected to 0.40 (bible: 40%, was 60%)
//   • Added ACTIVE_ABILITY per role (once-per-run)
//   • Added Role Synergy Bonus config (all 4 roles active → shield + treasury bonus)
//   • Added CORD multiplier constants for TEAM UP mode
//   • Added treasury constants: hard cap, critical threshold, freedom multiplier
//   • Added 20M-player scaling constants
//   • Added DEFECTION_COUNTDOWN_MS (bible: 3-second visible countdown)
// ═══════════════════════════════════════════════════════════════════════════

// ─── Role Type ────────────────────────────────────────────────────────────────

/**
 * Bible-canonical role names for TEAM UP mode.
 * Each role is exclusive — no two players share a role per run.
 */
export type SyndicateRole =
  | 'INCOME_BUILDER'     // was ARCHITECT — income + IPA specialist
  | 'SHIELD_ARCHITECT'   // was GUARDIAN  — shield repair + rescue
  | 'OPPORTUNITY_HUNTER' // was ACCELERATOR — opportunity card tempo
  | 'COUNTER_INTEL';     // was CONNECTOR  — trust + intelligence ops

/** Once-per-run active ability codes per role */
export type RoleActiveAbility =
  | 'DOUBLE_TAP'     // INCOME_BUILDER: double one income source for 2 ticks
  | 'FORTRESS_MODE'  // SHIELD_ARCHITECT: all shields +20pts instantly, 3 ticks
  | 'FIRST_LOOK'     // OPPORTUNITY_HUNTER: see 3 face-up cards, pick 1
  | 'SIGNAL_JAM';    // COUNTER_INTEL: suppress all hater bot attacks for 4 ticks

// ─── Config Interfaces ────────────────────────────────────────────────────────

export interface SyndicateConfig {
  /** Maximum trust score (floor = 0) */
  trustMax: number;
  /** Trust score on run start */
  trustInitial: number;
  /** Trust leakage base rate (per tick passive decay) */
  trustPassiveDecay: number;
  /** Trust leakage penalty per negative-trust-impact card play */
  trustNegativeImpactMult: number;
  /** Trust gain per positive-trust-impact card play */
  trustPositiveGain: number;
  /** Income leakage rate at minimum trust (0.35 = 35% income lost) */
  maxTrustLeakageRate: number;
  /** COUNTER_INTEL role global leakage reduction */
  counterIntelLeakageReduction: number;
  /** Defection requires 3 steps: BREAK_PACT → SILENT_EXIT → ASSET_SEIZURE */
  defectionSteps: number;
  /** Minimum tick before defection is permitted (bible: after tick 8) */
  defectionMinTick: number;
  /** Defector takes this % of shared treasury (bible: 40%) */
  defectionTreasurySeizurePct: number;
  /** Visible countdown (ms) team sees before defection executes */
  defectionCountdownMs: number;
  /** Flat CORD penalty applied to defector's final score */
  defectionCordPenalty: number;
  /** CORD bonus for Betrayal Survivor (remaining team wins after defection) */
  betrayalSurvivorCordBonus: number;
  /** Ticks between rescue window opportunities */
  rescueWindowInterval: number;
  /** Rescue window open duration in ticks */
  rescueWindowDuration: number;
  /** Rescue window open duration in milliseconds (for SyndicateCardMode) */
  rescueWindowDurationMs: number;
  /** Minimum rescue effectiveness at window expiry */
  rescueEffectivenessMin: number;
  /** Maximum rescue effectiveness at window open */
  rescueEffectivenessMax: number;
  /** Maximum alliance size */
  maxAllianceSize: number;
  /** Shared treasury fee rate on withdrawals */
  treasuryFeeRate: number;
  /** Treasury balance below which CRITICAL_TREASURY state activates */
  criticalTreasuryThreshold: number;
  /** Team FREEDOM threshold = solo threshold × this multiplier */
  freedomThresholdMultiplier: number;
  /** Maximum treasury balance (whale-abuse prevention) */
  treasuryHardCap: number;
  /** Treasury bonus when all 4 roles present at run start */
  roleSynergyTreasuryBonus: number;
  /** Shield integrity bonus (%) when all 4 roles present */
  roleSynergyShieldBonus: number;
  /** CORD bonus for Full Synergy achievement (all 4 roles → FREEDOM) */
  fullSynergyCordBonus: number;
  /** CORD bonus for Syndicate Champion (highest CORD in alliance) */
  syndicateChampionCordBonus: number;
  /** CORD bonus for Cascade Absorber (absorb 3+ chains for team) */
  cascadeAbsorberCordBonus: number;
  /** Max ledger entries kept in memory (performance at scale) */
  ledgerMaxEntries: number;
}

export const SYNDICATE_CONFIG: SyndicateConfig = {
  // Trust
  trustMax:                       1.0,
  trustInitial:                   0.7,
  trustPassiveDecay:              0.002,
  trustNegativeImpactMult:        0.08,
  trustPositiveGain:              0.05,
  maxTrustLeakageRate:            0.35,
  counterIntelLeakageReduction:   0.15,  // COUNTER_INTEL role: -15% leakage globally

  // Defection (bible-aligned)
  defectionSteps:                 3,
  defectionMinTick:               8,     // FIXED: was 120, bible says after tick 8
  defectionTreasurySeizurePct:    0.40,  // FIXED: was 0.60, bible says 40%
  defectionCountdownMs:           3000,  // NEW: 3-second visible countdown
  defectionCordPenalty:           0.15,  // flat CORD deduction for defector
  betrayalSurvivorCordBonus:      0.60,  // +60% CORD for surviving team

  // Rescue windows
  rescueWindowInterval:           120,
  rescueWindowDuration:           30,    // in ticks
  rescueWindowDurationMs:         15_000, // 15s — aligns with SyndicateCardMode
  rescueEffectivenessMin:         0.4,
  rescueEffectivenessMax:         1.0,

  // Alliance
  maxAllianceSize:                4,

  // Treasury
  treasuryFeeRate:                0.02,
  criticalTreasuryThreshold:      3_000,   // $3K triggers shield regen halving
  freedomThresholdMultiplier:     1.8,     // team freedom = solo × 1.8
  treasuryHardCap:                10_000_000, // $10M cap

  // Role Synergy Bonus (all 4 roles active at run start)
  roleSynergyTreasuryBonus:       8_000,   // +$8K treasury bonus
  roleSynergyShieldBonus:         0.10,    // shields start at 110% integrity
  fullSynergyCordBonus:           0.45,    // +45% CORD
  syndicateChampionCordBonus:     0.25,    // +25% CORD
  cascadeAbsorberCordBonus:       0.35,    // +35% CORD

  // Scale
  ledgerMaxEntries:               50,      // keep last 50 (was 100) — 20M player scale
};

// ─── Role Configs ─────────────────────────────────────────────────────────────

export interface RoleConfig {
  label: string;
  description: string;
  drawBonus: string;
  cardAmplifier: number;
  trustModifier: number;
  activeAbility: RoleActiveAbility;
  activeAbilityLabel: string;
  activeAbilityDescription: string;
  activeAbilityDurationTicks: number;
  /** Card draw bias tags injected into DeckBuilder */
  drawBiasTags: Record<string, number>;   // tag → multiplier
}

export const ROLE_CONFIGS: Record<SyndicateRole, RoleConfig> = {

  INCOME_BUILDER: {
    label:                    'Income Builder',
    description:              'Long-term income specialist. Treasury income regen +15% passively.',
    drawBonus:                '+40% IPA cards, -20% FUBAR',
    cardAmplifier:            1.10,
    trustModifier:            1.05,
    activeAbility:            'DOUBLE_TAP',
    activeAbilityLabel:       'DOUBLE TAP',
    activeAbilityDescription: 'Double one income source for 2 full ticks. Stacks with Shield Synergy.',
    activeAbilityDurationTicks: 2,
    drawBiasTags:             { IPA: 1.4, FUBAR: 0.8 },
  },

  SHIELD_ARCHITECT: {
    label:                    'Shield Architect',
    description:              'Shield repair + rescue specialist. L1/L2 regen at 3pts/tick instead of 2.',
    drawBonus:                '+35% Privileged deck, +20% repair cards',
    cardAmplifier:            1.05,
    trustModifier:            1.10,
    activeAbility:            'FORTRESS_MODE',
    activeAbilityLabel:       'FORTRESS MODE',
    activeAbilityDescription: 'All shield layers gain +20pts instantly. Lasts 3 ticks. Costs no BB.',
    activeAbilityDurationTicks: 3,
    drawBiasTags:             { PRIVILEGED: 1.35, REPAIR: 1.2 },
  },

  OPPORTUNITY_HUNTER: {
    label:                    'Opportunity Hunter',
    description:              'Tempo engine. See next 2 Opportunity cards before they appear.',
    drawBonus:                '+50% Opportunity cards, -15% FUBAR',
    cardAmplifier:            1.08,
    trustModifier:            0.98,
    activeAbility:            'FIRST_LOOK',
    activeAbilityLabel:       'FIRST LOOK',
    activeAbilityDescription: 'See 3 cards face-up and choose 1 before the tick resolves. Others discarded.',
    activeAbilityDurationTicks: 1,
    drawBiasTags:             { OPPORTUNITY: 1.5, FUBAR: 0.85 },
  },

  COUNTER_INTEL: {
    label:                    'Counter-Intel',
    description:              'Trust amplifier + threat suppressor. AID leakage -15% globally.',
    drawBonus:                '+40% SO defense cards, +20% Privileged. All threats arrive TELEGRAPHED.',
    cardAmplifier:            1.0,
    trustModifier:            1.15,
    activeAbility:            'SIGNAL_JAM',
    activeAbilityLabel:       'SIGNAL JAM',
    activeAbilityDescription: 'Suppress all incoming hater bot attacks for 4 ticks. Bots do not gain heat.',
    activeAbilityDurationTicks: 4,
    drawBiasTags:             { SO: 1.4, PRIVILEGED: 1.2 },
  },
};

// ─── CORD Multiplier Constants ────────────────────────────────────────────────

/** All CORD bonuses exclusive to TEAM UP mode */
export const SYNDICATE_CORD_BONUSES = {
  BETRAYAL_SURVIVOR:    0.60,  // team wins after defection
  FULL_SYNERGY:         0.45,  // all 4 roles → FREEDOM
  CASCADE_ABSORBER:     0.35,  // absorb 3+ cascade chains for team
  SYNDICATE_CHAMPION:   0.25,  // highest CORD in alliance
  DEFECTOR_PENALTY:    -0.15,  // flat penalty for defecting player
} as const;

// ─── 20M Player Scaling Constants ─────────────────────────────────────────────

/**
 * Server-side processing budget constants.
 * These govern what per-tick computations are safe at 20M concurrent players.
 */
export const SCALE_CONFIG = {
  /** Max tick computations per alliance per second */
  tickBudgetMs:           2,
  /** Alliance state snapshot interval (don't emit every tick) */
  stateEmitIntervalTicks: 3,
  /** Leaderboard update batch size */
  leaderboardBatchSize:   1_000,
  /** Trust audit lazy-write delay (ms) */
  auditWriteDelayMs:      500,
  /** Maximum open rescue windows per server shard */
  maxRescueWindowsPerShard: 50_000,
} as const;

// ─── Utility ──────────────────────────────────────────────────────────────────

/** Convert trust 0.0–1.0 float to 0–100 int (for SyndicateCardMode compatibility) */
export function trustToCardScale(trust01: number): number {
  return Math.round(Math.max(0, Math.min(100, trust01 * 100)));
}

/** Convert trust 0–100 int to 0.0–1.0 float (from SyndicateCardMode to engine) */
export function trustFromCardScale(trust0100: number): number {
  return parseFloat(Math.max(0, Math.min(1, trust0100 / 100)).toFixed(3));
}

/** Returns true if all 4 roles are present in the takenRoles array */
export function hasAllRoles(takenRoles: SyndicateRole[]): boolean {
  const all: SyndicateRole[] = ['INCOME_BUILDER', 'SHIELD_ARCHITECT', 'OPPORTUNITY_HUNTER', 'COUNTER_INTEL'];
  return all.every(r => takenRoles.includes(r));
}