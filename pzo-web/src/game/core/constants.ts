// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/core/constants.ts
// Sprint 3: Full-Scale Runtime Constants
// Density6 LLC · Confidential · All Rights Reserved
// ═══════════════════════════════════════════════════════════════════════════
// Single source of truth for ALL game constants.
// Changes here propagate to all 7 engines automatically.
// 20M concurrent player scale: values tuned for server-authoritative runs.
// ═══════════════════════════════════════════════════════════════════════════

// ── Run Lifecycle ──────────────────────────────────────────────────────────────
export const STARTING_CASH      = 28_000;
export const STARTING_INCOME    = 2_100;
export const STARTING_EXPENSES  = 4_800;
export const RUN_TICKS          = 720;
export const MONTH_TICKS        = 12;
export const TICK_MS            = 1000;
export const FREEDOM_THRESHOLD  = 500_000;   // net worth to win FREEDOM outcome

// ── Card Mechanics ─────────────────────────────────────────────────────────────
export const DRAW_TICKS         = 24;
export const MAX_HAND           = 5;
export const MAX_LOG            = 80;
export const MAX_EQUITY_POINTS  = 120;

// ── Deck Drop Weights ──────────────────────────────────────────────────────────
// NOTE: Sprint 2+ ForcedCardQueue overrides these per-mode. Kept as fallback.
export const FATE_TICKS         = 18;
export const FATE_FUBAR_PCT     = 0.42;
export const FATE_MISSED_PCT    = 0.32;
export const FATE_SO_PCT        = 0.21;
// PRIVILEGED = 1 - (FUBAR + MISSED + SO) = 0.05
export const LEGENDARY_DROP_WEIGHT = 1;     // 1-in-100 relative weight for Legendary cards

// ── Sabotage System ────────────────────────────────────────────────────────────
export const SABOTAGE_BASE_TICKS    = 24;
export const SABOTAGE_MAX_AMMO      = 4;    // Predator hater: max simultaneous sabotage slots
export const SABOTAGE_COUNTER_WINDOW = 5;  // ticks builder has to counter a filed sabotage

// ── Shield Economics ───────────────────────────────────────────────────────────
export const SHIELD_BANKRUPTCY_RECOVERY   = 5_000;
export const SHIELD_L4_LOCKOUT_TICKS      = 3;     // ticks hands are locked after L4 breach
export const SHIELD_FORTIFY_THRESHOLD     = 0.95;  // integrity pct to enter FORTIFIED state
export const SHIELD_REGEN_INTERVAL_TICKS  = 1;     // passive regen fires every N ticks

// ── Pressure Engine ────────────────────────────────────────────────────────────
export const PRESSURE_DECAY_RATE          = 0.015;  // per tick when no escalation
export const PRESSURE_ESCALATION_RATE     = 0.04;   // per tick under active threat
export const PRESSURE_CRITICAL_THRESHOLD  = 0.85;
export const PRESSURE_TIER_HYSTERESIS     = 0.03;   // prevents tier flapping at boundary

// ── Tension Engine ─────────────────────────────────────────────────────────────
export const TENSION_QUEUE_MAX            = 8;      // max simultaneous threats in anticipation queue
export const TENSION_PULSE_INTERVAL       = 6;      // anticipation pulse fires every N ticks
export const TENSION_VISIBILITY_FULL_AT   = 0.75;   // score threshold for REVEALED visibility
export const TENSION_DECAY_RATE           = 0.02;

// ── Battle / Bot Engine ────────────────────────────────────────────────────────
export const BOT_MAX_SIMULTANEOUS         = 3;      // max bots in ATTACKING simultaneously
export const BOT_COUNTER_INTEL_CHANCE     = 0.12;   // per tick when TARGETING
export const BOT_IMMUNITY_TICKS_BASE      = 24;     // after NEUTRALIZED
export const HATER_HEAT_DECAY_PER_TICK    = 0.8;    // raw points shed per tick
export const HATER_HEAT_MAX               = 100;

// ── Cascade System ─────────────────────────────────────────────────────────────
export const CASCADE_MAX_CONCURRENT       = 4;      // hard cap on simultaneous chains
export const CASCADE_POSITIVE_SUSTAIN_TICKS = 12;   // ticks positive cascade runs
export const CASCADE_NEMESIS_IMMUNITY     = 48;     // ticks after nemesis broken
export const CASCADE_CATASTROPHIC_LOCKOUT = 3;      // card play lockout during CATASTROPHIC

// ── Sovereignty / Proof Engine ──────────────────────────────────────────────────
export const SOVEREIGNTY_HASH_VERSION     = 'PZO-v3';
export const PROOF_BADGE_MIN_GRADE        = 'B';    // minimum grade for proof badge issuance
export const RUN_GRADE_S_THRESHOLD        = 900;
export const RUN_GRADE_A_THRESHOLD        = 750;
export const RUN_GRADE_B_THRESHOLD        = 600;
export const RUN_GRADE_C_THRESHOLD        = 450;
export const RUN_GRADE_D_THRESHOLD        = 300;

// ── Season / XP ───────────────────────────────────────────────────────────────
export const SEASON_PULSE_TICKS           = 60;
export const XP_PER_MONTH_CASHFLOW_UNIT   = 500;   // $500 monthly cashflow = 1 XP
export const XP_MIN_PER_SETTLEMENT        = 5;
export const DOMINION_MAX                 = 1000;

// ── Mode-Specific ─────────────────────────────────────────────────────────────
export const BATTLE_ROUND_TICKS           = 60;    // Predator: PvP round length
export const GHOST_TICK_INTERVAL          = 75;    // Phantom: ghost replay step interval
export const RESCUE_WINDOW_INTERVAL       = 120;   // Syndicate: ticks between rescue windows
export const RESCUE_WINDOW_DURATION       = 30;    // Syndicate: rescue window length in ticks
export const RESCUE_WINDOW_CHANCE         = 0.25;  // Syndicate: probability of window opening
export const TRUST_DECAY_PER_DEFECTION    = 0.15;  // Syndicate: trust score hit per defection step
export const SYNERGY_BONUS_MAX            = 2.0;   // Syndicate: max co-op multiplier

// ── ML / Alpha Engine ──────────────────────────────────────────────────────────
export const ML_ALPHA_DRAW_REROUTE_THRESHOLD = 0.20;
export const ML_ALPHA_DRAW_REROUTE_CHANCE    = 0.55;
export const ML_CONFIDENCE_DECAY_PER_TICK    = 0.001;
export const ML_HEAT_DECAY_PER_TICK          = 0.012;
export const ML_SIGNAL_DECAY_FACTOR          = 0.93;

// ── PvP / Integrity ────────────────────────────────────────────────────────────
export const MACRO_EVENT_TICKS            = 55;
export const INTEGRITY_CHECK_TICKS        = 45;

// ── Telemetry Flush (20M scale — batched, not per-event) ─────────────────────
export const TELEMETRY_BATCH_SIZE         = 50;    // events per batch flush
export const TELEMETRY_FLUSH_INTERVAL_MS  = 2000;  // max wait before flush

// ── Replay ────────────────────────────────────────────────────────────────────
export const REPLAY_MAX_EVENTS            = 2000;  // truncated if run produces more
export const REPLAY_SNAPSHOT_INTERVAL     = 60;    // full state snapshot every N ticks

// ── UI / Display ──────────────────────────────────────────────────────────────
export const UI_LOG_MAX                   = 80;
export const UI_TRANSITION_MS             = 180;   // standard component transition
export const UI_PRESSURE_PULSE_MS         = 900;   // CRITICAL pressure pulse animation
