// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE DIGITAL — ENGINE CONSTANTS
// pzo_engine/src/config/pzo_constants.ts
// Sprint 8 · Ruleset 2.0.0 · Sovereign Edition
//
// ── AUTHORITY CHAIN ───────────────────────────────────────────────────────────
//   1. PZO_Game_Mode_Bible_v2  ← overrides everything when values conflict
//   2. PZO_Card_Logic_Bible    ← card schema, timing, deck weights
//   3. game/core/constants.ts  ← pzo-web canonical layer (aligned to bibles)
//   4. engines/sovereignty/types.ts ← CORD formula weights
//
// Every value was verified against the bibles line-by-line.
// Discrepancies from earlier stubs are annotated inline.
//
// ── RULES ─────────────────────────────────────────────────────────────────────
//   ✦ Zero imports. Pure constants only.
//   ✦ Zero runtime logic.
//   ✦ Any change that affects run outcomes → increment RULESET_SEMVER.
//
// ── IMPORT PATTERN ────────────────────────────────────────────────────────────
//   import { STARTING_CASH, FREEDOM_THRESHOLD } from '../config/pzo_constants';
//
// Density6 LLC · Point Zero One · Engine Layer · Confidential
// ═══════════════════════════════════════════════════════════════════════════════


// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — RULESET VERSIONING
// ══════════════════════════════════════════════════════════════════════════════

export const RULESET_SEMVER           = '2.0.0';
export const RULESET_GIT_SHA: string  = process.env['GIT_SHA'] ?? '';
export const PROOF_HASH_ALGORITHM     = 'sha256';
export const SOVEREIGNTY_HASH_VERSION = 'PZO-v3';
export const RULESET_VERSION_STRING   =
  RULESET_GIT_SHA ? `${RULESET_SEMVER}+${RULESET_GIT_SHA}` : RULESET_SEMVER;


// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — RUN LIFECYCLE
// Source: Game Mode Bible §0 + game/core/constants.ts
// ══════════════════════════════════════════════════════════════════════════════

export const STARTING_CASH            = 28_000;
export const STARTING_INCOME          = 2_100;
export const STARTING_EXPENSES        = 4_800;
export const TICKS_PER_RUN            = 720;
export const RUN_TICKS                = TICKS_PER_RUN;   // alias
export const MONTH_TICKS              = 12;
export const TICK_MS                  = 1_000;
export const FREEDOM_THRESHOLD        = 500_000;

export const BANKRUPTCY_CASH_FLOOR    = 0;
export const BANKRUPTCY_NW_FLOOR      = -100_000;
export const FORCED_SALE_PCT          = 0.70;
export const FORCED_SALE_DISCOUNT     = FORCED_SALE_PCT;  // legacy alias
export const BANKRUPTCY_THRESHOLD_10PCT = 0.9;            // @deprecated test compat
export const BANKRUPTCY_THRESHOLD_20PCT = 0.8;            // @deprecated test compat
export const CASCADE_WIPE_TICKS       = 5;


// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — CARD ENGINE
// Source: PZO_Card_Logic_Bible + game/core/constants.ts
// ══════════════════════════════════════════════════════════════════════════════

export const DRAW_TICKS               = 24;
export const MAX_HAND                 = 5;
export const MAX_LOG                  = 80;
export const MAX_EQUITY_POINTS        = 120;
export const PHASE_BOUNDARY_TICKS     = 60;

// Card Logic Bible: timing class window durations
export const DECISION_WINDOW_MS       = 5_000;  // standard forced card window
export const COUNTER_WINDOW_MS        = 5_000;  // CTR timing class (same per bible)
export const RESCUE_WINDOW_MS         = 8_000;  // RES timing class — longer window

export const PROOF_BADGE_MIN_GRADE    = 'B';    // minimum grade for proof badge


// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — 6-DECK FATE SYSTEM
// Source: PZO_Card_Logic_Bible §Deck Types + game/core/constants.ts
// ══════════════════════════════════════════════════════════════════════════════

export const FATE_TICKS               = 18;
export const FATE_FUBAR_PCT           = 0.42;
export const FATE_MISSED_PCT          = 0.32;
export const FATE_SO_PCT              = 0.21;
export const FATE_PRIVILEGED_PCT      = 0.05;   // 1 - (0.42 + 0.32 + 0.21)
export const LEGENDARY_DROP_WEIGHT    = 1;       // 1-in-100 relative weight

export const REPLAY_MAX_EVENTS        = 2_000;
export const REPLAY_SNAPSHOT_INTERVAL = 60;


// ══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — CORD SCORING WEIGHTS
// !! SOURCE = Game Mode Bible §Base CORD Formula (Universal) — AUTHORITATIVE !!
//
// Earlier engine stubs had: decision_speed=0.15, shields=0.25 — WRONG.
// Bible says: decision_speed=0.25, shields=0.20 — corrected here.
// ══════════════════════════════════════════════════════════════════════════════

export const WEIGHT_DECISION_SPEED    = 0.25;  // How fast forced cards resolved under pressure
export const WEIGHT_SHIELDS_MAINTAINED = 0.20; // Avg shield integrity, 4 layers, all ticks
export const WEIGHT_HATER_BLOCKS      = 0.20;  // Attacks fully absorbed without breach
export const WEIGHT_CASCADE_BREAKS    = 0.20;  // Chains intercepted before next link fires
export const WEIGHT_PRESSURE_SURVIVED = 0.15;  // Ticks in HIGH/CRITICAL without BANKRUPT
// Sum = 1.00 ✓


// ══════════════════════════════════════════════════════════════════════════════
// SECTION 6 — OUTCOME MULTIPLIERS
// Source: Game Mode Bible §Outcome Multipliers
// ══════════════════════════════════════════════════════════════════════════════

export const OUTCOME_MULT_FREEDOM     = 1.50;
export const OUTCOME_MULT_TIMEOUT     = 0.80;
export const OUTCOME_MULT_BANKRUPT    = 0.40;
export const OUTCOME_MULT_ABANDONED   = 0.00;


// ══════════════════════════════════════════════════════════════════════════════
// SECTION 7 — GRADE SCALE
// Source: Game Mode Bible §Grade Scale
// !! Earlier stubs had A_MIN=1.10. Bible says 1.20. Corrected. !!
// ══════════════════════════════════════════════════════════════════════════════

export const GRADE_A_MIN              = 1.20;  // bible: "1.20 – 1.50"
export const GRADE_B_MIN              = 0.90;  // bible: "0.90 – 1.19"
export const GRADE_C_MIN              = 0.60;  // bible: "0.60 – 0.89"
export const GRADE_D_MIN              = 0.30;  // bible: "0.30 – 0.59"
// < 0.30 → F

// Bleed Mode S-grade: +80% ceiling lift = 1.50 → 1.80
export const GRADE_S_MIN_BLEED        = 1.50;
export const GRADE_S_MAX_BLEED        = 1.80;


// ══════════════════════════════════════════════════════════════════════════════
// SECTION 8 — CORD TIER THRESHOLDS
// Source: engines/sovereignty/types.ts
// ══════════════════════════════════════════════════════════════════════════════

export const CORD_TIER_SOVEREIGN      = 0.90;
export const CORD_TIER_PLATINUM       = 0.75;
export const CORD_TIER_GOLD           = 0.60;
export const CORD_TIER_SILVER         = 0.45;
export const CORD_TIER_BRONZE         = 0.30;
// < 0.30 → UNRANKED


// ══════════════════════════════════════════════════════════════════════════════
// SECTION 9 — PRESSURE ENGINE
// Source: Game Mode Bible §Pressure Tier + game/core/constants.ts
// ══════════════════════════════════════════════════════════════════════════════

// Tick durations per tier (ms) — bible canonical
export const PRESSURE_TICK_T0_MS      = 2_000;   // SOVEREIGN
export const PRESSURE_TICK_T1_MS      = 4_000;   // STABLE
export const PRESSURE_TICK_T2_MS      = 6_000;   // STRESSED
export const PRESSURE_TICK_T3_MS      = 8_500;   // ELEVATED
export const PRESSURE_TICK_T4_MS      = 12_000;  // COLLAPSE_IMMINENT

// CORD multipliers per pressure tier
export const PRESSURE_CORD_MULT_T0    = 1.0;
export const PRESSURE_CORD_MULT_T1    = 1.0;
export const PRESSURE_CORD_MULT_T2    = 1.2;
export const PRESSURE_CORD_MULT_T3    = 1.5;
export const PRESSURE_CORD_MULT_T4    = 2.0;

export const PRESSURE_DECAY_RATE      = 0.015;
export const PRESSURE_ESCALATION_RATE = 0.04;
export const PRESSURE_CRITICAL_THRESHOLD = 0.85;
export const PRESSURE_TIER_HYSTERESIS = 0.03;
export const PRESSURE_MAX             = 1.0;


// ══════════════════════════════════════════════════════════════════════════════
// SECTION 10 — TENSION ENGINE
// ══════════════════════════════════════════════════════════════════════════════

export const TENSION_QUEUE_MAX         = 8;
export const TENSION_PULSE_INTERVAL    = 6;
export const TENSION_VISIBILITY_FULL_AT = 0.75;
export const TENSION_DECAY_RATE        = 0.02;


// ══════════════════════════════════════════════════════════════════════════════
// SECTION 11 — SHIELD ENGINE (4-LAYER DEFENSE)
// ══════════════════════════════════════════════════════════════════════════════

export const SHIELD_LAYER_COUNT         = 4;
export const SHIELD_BANKRUPTCY_RECOVERY = 5_000;
export const SHIELD_L4_LOCKOUT_TICKS    = 3;
export const SHIELD_FORTIFY_THRESHOLD   = 0.95;
export const SHIELD_REGEN_INTERVAL_TICKS = 1;
export const SHIELD_REPAIR_BASE_COST    = 2_000;
export const SHIELD_REPAIR_LAYER_MULT   = 1.5;


// ══════════════════════════════════════════════════════════════════════════════
// SECTION 12 — BATTLE ENGINE (HATER BOTS + SABOTAGE)
// Source: Game Mode Bible §5 Hater Bots + game/core/constants.ts
// ══════════════════════════════════════════════════════════════════════════════

export const BOT_MAX_SIMULTANEOUS       = 3;
export const BOT_COUNTER_INTEL_CHANCE   = 0.12;
export const BOT_IMMUNITY_TICKS_BASE    = 24;
export const HATER_HEAT_MAX             = 100;
export const HATER_HEAT_DECAY_PER_TICK  = 0.8;

export const SABOTAGE_BASE_TICKS        = 24;
export const SABOTAGE_MAX_AMMO          = 4;
export const SABOTAGE_COUNTER_WINDOW    = 5;

export const EMPIRE_BOT_COUNT           = 5;   // GO ALONE: 5 bots, wave sequence
export const EMPIRE_BOT_WAVE_COUNT      = 5;


// ══════════════════════════════════════════════════════════════════════════════
// SECTION 13 — CASCADE ENGINE
// ══════════════════════════════════════════════════════════════════════════════

export const CASCADE_MAX_CONCURRENT         = 4;
export const CASCADE_POSITIVE_SUSTAIN_TICKS = 12;
export const CASCADE_NEMESIS_IMMUNITY       = 48;
export const CASCADE_CATASTROPHIC_LOCKOUT   = 3;
export const CASCADE_MAX_CHAIN_LENGTH       = 8;
export const CASCADE_CHAIN_WINDOW           = 3;
export const CASCADE_RECOVERY_CHECK_TICKS   = 5;


// ══════════════════════════════════════════════════════════════════════════════
// SECTION 14 — EMPIRE MODE (GO ALONE)
// Source: Game Mode Bible §MODE 1 + game/modes/empire/empireConfig.ts
// ══════════════════════════════════════════════════════════════════════════════

export const BLEED_CASH_THRESHOLD           = 12_000;
export const BLEED_ACTIVATION_MONTHS        = 3;
export const BLEED_ESCALATION_TICKS         = 60;
export const BLEED_TERMINAL_TICKS           = 120;
export const BLEED_RESOLUTION_INCOME_MIN    = 500;
export const BLEED_RUN_CORD_CEILING_LIFT    = 0.80;  // bible: "+80% CORD ceiling lift"

export const ISOLATION_TAX_PCT              = 0.08;
export const ISOLATION_SAFE_CASH            = 50_000;

export const COMEBACK_SURGE_CASH_THRESHOLD  = 2_000;  // bible: "sub-$2K"
export const COMEBACK_SURGE_MIN_TICKS       = 15;     // bible: "15+ ticks"
export const PRESSURE_JOURNAL_INTERVAL      = 24;


// ══════════════════════════════════════════════════════════════════════════════
// SECTION 15 — PREDATOR MODE (HEAD TO HEAD)
// Source: Game Mode Bible §MODE 2 + game/modes/predator/predatorConfig.ts
// ══════════════════════════════════════════════════════════════════════════════

export const BATTLE_BUDGET_MAX              = 500;
export const BATTLE_BUDGET_REGEN_PM         = 50;
export const BATTLE_BUDGET_ATTACK_COST      = 75;
export const BATTLE_BUDGET_COUNTER_COST     = 25;
export const BATTLE_ROUND_TICKS             = 60;

export const PSYCHE_SCORE_MAX               = 100;
export const PSYCHE_TILT_THRESHOLD          = 20;
export const PSYCHE_DECAY_RATE_COMBAT       = 0.5;
export const PSYCHE_DECAY_RATE_IDLE         = 0.1;
export const PSYCHE_RESTORE_ON_COUNTER      = 15;
export const TILT_CARD_COST_MULT            = 1.25;
export const TILT_COUNTER_WINDOW_MINUS      = 2;


// ══════════════════════════════════════════════════════════════════════════════
// SECTION 16 — SYNDICATE MODE (TEAM UP)
// Source: Game Mode Bible §MODE 3 + game/modes/syndicate/syndicateConfig.ts
// !! Bible corrected: defectionMinTick=8, treasury seizure=40% !!
// ══════════════════════════════════════════════════════════════════════════════

export const TRUST_SCORE_INITIAL            = 0.70;
export const TRUST_DEFECTION_THRESHOLD      = 0.30;
export const TRUST_TREASURY_SEIZURE_PCT     = 0.40;  // bible: 40%
export const TRUST_BREACH_PENALTY           = 0.40;
export const TRUST_FULFILL_REWARD           = 0.15;
export const TRUST_DECAY_PER_DEFECTION      = 0.15;
export const DEFECTION_MIN_TICK             = 8;      // bible: "after tick 8"
export const DEFECTION_COUNTDOWN_MS         = 3_000;  // bible: "3-second visible countdown"
export const SYNERGY_BONUS_MAX              = 2.0;
export const RESCUE_WINDOW_INTERVAL         = 120;
export const RESCUE_WINDOW_DURATION         = 30;
export const RESCUE_WINDOW_CHANCE           = 0.25;


// ══════════════════════════════════════════════════════════════════════════════
// SECTION 17 — PHANTOM MODE (CHASE A LEGEND)
// Source: Game Mode Bible §MODE 4 + game/modes/phantom/phantomConfig.ts
// ══════════════════════════════════════════════════════════════════════════════

export const GHOST_TICK_INTERVAL            = 75;
export const LEGEND_DECAY_RATE              = 0.003;
export const DYNASTY_CHALLENGER_COUNT       = 3;
export const DYNASTY_CORD_BONUS             = 1.00;  // bible: "+100% CORD"
export const GHOST_SLAYER_GAP_MIN           = 0.15;  // bible: ">15%"
export const GHOST_SLAYER_CORD_BONUS        = 0.20;  // bible: "+20% CORD"
export const LEGEND_GAP_THRESHOLD           = 0.20;  // bible: ">20%"
export const LEGEND_GAP_CORD_BONUS          = 0.75;  // bible: "+75% CORD"
export const LEGEND_PRESSURE_GAP_PCT        = 0.30;
export const COMMUNITY_HEAT_BOOST           = 25;


// ══════════════════════════════════════════════════════════════════════════════
// SECTION 18 — MODE-EXCLUSIVE CORD BONUSES
// Source: PZO_Game_Mode_Bible_v2 §Mode-Exclusive CORD Multipliers
// All additive after outcome multiplier.
// ══════════════════════════════════════════════════════════════════════════════

// GO ALONE
export const CORD_BONUS_CLUTCH              = 0.40;
export const CORD_BONUS_NO_HOLD             = 0.25;
export const CORD_BONUS_SOVEREIGN_SWEEP     = 0.30;
export const CORD_BONUS_COLD_START          = 0.45;
export const CORD_BONUS_EXTERMINATOR        = 0.50;
export const CORD_BONUS_BLEED_RUN           = 0.80;

// HEAD TO HEAD
export const CORD_BONUS_FIRST_BLOOD         = 0.15;
export const CORD_BONUS_ECONOMIC_ANNIHILATION = 0.40;
export const CORD_BONUS_PERFECT_COUNTER     = 0.35;

// TEAM UP
export const CORD_BONUS_BETRAYAL_SURVIVOR   = 0.60;
export const CORD_BONUS_FULL_SYNERGY        = 0.45;
export const CORD_BONUS_CASCADE_ABSORBER    = 0.35;
export const CORD_BONUS_SYNDICATE_CHAMPION  = 0.25;

// CHASE A LEGEND
export const CORD_BONUS_GHOST_SLAYER        = 0.20;
export const CORD_BONUS_LEGEND_GAP          = 0.75;
export const CORD_BONUS_DYNASTY             = 1.00;
export const CORD_BONUS_IRON_GHOST          = 0.55;


// ══════════════════════════════════════════════════════════════════════════════
// SECTION 19 — SEASON / XP + MACRO
// Source: game/core/constants.ts
// ══════════════════════════════════════════════════════════════════════════════

export const XP_PER_MONTH_CASHFLOW_UNIT     = 500;   // $500 cashflow = 1 XP
export const XP_MIN_PER_SETTLEMENT          = 5;
export const DOMINION_MAX                   = 1_000;
export const SEASON_PULSE_TICKS             = 60;
export const MACRO_EVENT_TICKS              = 55;
export const INTEGRITY_CHECK_TICKS          = 45;


// ══════════════════════════════════════════════════════════════════════════════
// SECTION 20 — ML / ALPHA ENGINE (CLIENT-ONLY FEATURES)
// ══════════════════════════════════════════════════════════════════════════════

export const ML_ENABLED                     = false;  // always false in pzo_engine
export const ML_ALPHA_DRAW_REROUTE_THRESHOLD = 0.20;
export const ML_ALPHA_DRAW_REROUTE_CHANCE   = 0.55;
export const ML_CONFIDENCE_DECAY_PER_TICK   = 0.001;
export const ML_HEAT_DECAY_PER_TICK         = 0.012;
export const ML_SIGNAL_DECAY_FACTOR         = 0.93;
export const ML_OUTPUT_BOUNDS_MIN           = 0;
export const ML_OUTPUT_BOUNDS_MAX           = 1;
export const AUDIT_HASH                     = 'pzo_engine_audit_v2';


// ══════════════════════════════════════════════════════════════════════════════
// SECTION 21 — TELEMETRY (20M-PLAYER SCALE)
// ══════════════════════════════════════════════════════════════════════════════

export const TELEMETRY_BATCH_SIZE           = 50;
export const TELEMETRY_FLUSH_INTERVAL_MS    = 2_000;


// ══════════════════════════════════════════════════════════════════════════════
// SECTION 22 — CANONICAL MODE STRINGS
// ══════════════════════════════════════════════════════════════════════════════

export const MODE_EMPIRE    = 'GO_ALONE'       as const;
export const MODE_PREDATOR  = 'HEAD_TO_HEAD'   as const;
export const MODE_SYNDICATE = 'TEAM_UP'        as const;
export const MODE_PHANTOM   = 'CHASE_A_LEGEND' as const;
export const ALL_CANONICAL_MODES = [
  MODE_EMPIRE, MODE_PREDATOR, MODE_SYNDICATE, MODE_PHANTOM,
] as const;
export const ALL_ALIAS_MODES = [
  'EMPIRE', 'PREDATOR', 'SYNDICATE', 'PHANTOM',
] as const;


// ══════════════════════════════════════════════════════════════════════════════
// SECTION 23 — PERSISTENCE + SERVER
// ══════════════════════════════════════════════════════════════════════════════

export const MAX_RUNS_PER_PLAYER            = 500;
export const LEADERBOARD_MAX_RESULTS        = 100;
export const DB_PATH_DEFAULT                = './data/pzo_runs.sqlite';
export const API_PORT_DEFAULT               = 3001;
export const ENGINE_MAX_CONCURRENT_RUNS     = 50_000;
export const RUN_IDLE_TIMEOUT_MS            = 300_000;
export const DETERMINISTIC_SEED             = 42;  // demo/test only — never production