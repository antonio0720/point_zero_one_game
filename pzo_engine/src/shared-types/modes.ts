// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/types/modes.ts
// Sprint 8 — Full Rebuild
//
// CHANGES FROM SPRINT 0:
//   ✦ GameMode enum extended with engine-canonical values (GO_ALONE etc.)
//     Legacy union 'EMPIRE'|'PREDATOR'|'SYNDICATE'|'PHANTOM' preserved via
//     LegacyGameMode + LEGACY_TO_CANONICAL_MODE bridge.
//   ✦ ModeCapabilityMatrix: +13 missing fields (spectatorMode, holdSystem,
//     bluffCards, extractionCooldown, rivalryPersistent, syndicateDuel,
//     dynastyChallengeStack, phaseTransitionCards, pressureJournalML,
//     caseFileML, communityHeat, sharedDeckOwnership, cardTagWeightOverrides)
//   ✦ ADD RunPhase enum (FOUNDATION | ESCALATION | SOVEREIGNTY)
//   ✦ ADD ModeDisplayConfig — single source for UI labels / icons / colors
//   ✦ ADD ViralMoment — share-worthy game events
//   ✦ ADD ModeScaleConfig — 20M concurrent player infra constants
//   ✦ Fix LEGACY_MODE_MAP / CANONICAL_TO_LEGACY — complete bidirectional bridge
//
// RULES:
//   ✦ Zero imports — this file imports nothing.
//   ✦ Zero runtime logic — pure TypeScript declarations only.
//   ✦ All consuming engines / components import GameMode from here.
//
// Density6 LLC · Confidential · All Rights Reserved
// ═══════════════════════════════════════════════════════════════════════════

// ── Canonical Mode Enum ───────────────────────────────────────────────────────
/**
 * Canonical four-mode enum aligned with CardEngine GameMode in engines/cards/types.ts.
 * These are the runtime values used everywhere EXCEPT the old core/types.ts legacy RunMode.
 *
 * GO_ALONE       = 'EMPIRE'    — Capital allocation, isolation tax, bleed mode
 * HEAD_TO_HEAD   = 'PREDATOR'  — Battle budget, extraction windows, psyche meter
 * TEAM_UP        = 'SYNDICATE' — Shared treasury, trust score, defection arc
 * CHASE_A_LEGEND = 'PHANTOM'   — Ghost replay, legend decay, dynasty stack
 */
export type GameMode =
  | 'GO_ALONE'        // Empire: solo capital allocation, hold system
  | 'HEAD_TO_HEAD'    // Predator: PvP combat, battle budget, counter window
  | 'TEAM_UP'         // Syndicate: cooperative, trust score, defection arc
  | 'CHASE_A_LEGEND'; // Phantom: ghost cards, divergence scoring, legend decay

/** Legacy mode strings used in OLD engine core/types.ts RunMode. */
export type LegacyRunMode = 'solo' | 'asymmetric-pvp' | 'co-op' | 'ghost';

/**
 * Short-form display alias — used in UI headers and social share strings.
 * Maps 1:1 with GameMode.
 */
export type GameModeAlias = 'EMPIRE' | 'PREDATOR' | 'SYNDICATE' | 'PHANTOM';

/** Maps legacy RunMode → canonical GameMode. */
export const LEGACY_TO_CANONICAL_MODE: Record<LegacyRunMode, GameMode> = {
  'solo':            'GO_ALONE',
  'asymmetric-pvp':  'HEAD_TO_HEAD',
  'co-op':           'TEAM_UP',
  'ghost':           'CHASE_A_LEGEND',
} as const;

/** Maps canonical GameMode → legacy RunMode. */
export const CANONICAL_TO_LEGACY_MODE: Record<GameMode, LegacyRunMode> = {
  'GO_ALONE':        'solo',
  'HEAD_TO_HEAD':    'asymmetric-pvp',
  'TEAM_UP':         'co-op',
  'CHASE_A_LEGEND':  'ghost',
} as const;

/** Maps canonical GameMode → short-form alias (for display and design tokens). */
export const CANONICAL_TO_ALIAS: Record<GameMode, GameModeAlias> = {
  'GO_ALONE':        'EMPIRE',
  'HEAD_TO_HEAD':    'PREDATOR',
  'TEAM_UP':         'SYNDICATE',
  'CHASE_A_LEGEND':  'PHANTOM',
} as const;

/** Maps short-form alias → canonical GameMode. */
export const ALIAS_TO_CANONICAL: Record<GameModeAlias, GameMode> = {
  'EMPIRE':    'GO_ALONE',
  'PREDATOR':  'HEAD_TO_HEAD',
  'SYNDICATE': 'TEAM_UP',
  'PHANTOM':   'CHASE_A_LEGEND',
} as const;

// ── Legacy alias (backward compat) ────────────────────────────────────────────
/** @deprecated Use LEGACY_TO_CANONICAL_MODE */
export const LEGACY_MODE_MAP = LEGACY_TO_CANONICAL_MODE;

/** @deprecated Use CANONICAL_TO_LEGACY_MODE */
export const CANONICAL_TO_LEGACY = CANONICAL_TO_LEGACY_MODE;

// ── Run Phase (Empire / GO_ALONE mode) ────────────────────────────────────────
/**
 * Three-phase architecture governing Empire mode run structure.
 * Phase boundaries are tick-based — set by empireConfig.ts.
 *
 * FOUNDATION  (Phase 1): Bots DORMANT. Build income. No sabotage.
 * ESCALATION  (Phase 2): Bots WATCHING→CIRCLING. Sabotage begins.
 * SOVEREIGNTY (Phase 3): All 5 bots ATTACKING. Tick rate T3→T4.
 */
export type RunPhase = 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY';

export const RUN_PHASE_LABELS: Record<RunPhase, string> = {
  FOUNDATION:  'Foundation',
  ESCALATION:  'Escalation',
  SOVEREIGNTY: 'Sovereignty',
} as const;

/** Tick index at which each phase begins (defaults from empireConfig.ts). */
export const DEFAULT_PHASE_BOUNDARIES: Record<RunPhase, number> = {
  FOUNDATION:  0,
  ESCALATION:  240,   // ~4 min at T1 (1200ms/tick)
  SOVEREIGNTY: 480,   // ~8 min at T1
} as const;

// ── Mode Capability Matrix ────────────────────────────────────────────────────
/**
 * Canonical feature matrix per mode.
 * Engine orchestrator reads this at run start to enable/disable systems.
 * ModeRouter.ts wires the correct engines based on this record.
 *
 * Sprint 8 changes: +13 fields vs Sprint 0.
 */
export interface ModeCapabilityMatrix {
  mode:  GameMode;
  label: string;     // human-readable label for UI

  // ── Empire (GO_ALONE) mechanics ──────────────────────────────────────────
  /** Player bears an Isolation Tax — structural penalty for running solo. */
  isolationTax:        boolean;
  /** Bleed Mode available — all handicaps active, CORD ceiling 1.80, S-grade. */
  bleedMode:           boolean;
  /** Hold System — pause a card's decision timer for deferred play. */
  holdSystem:          boolean;
  /** Pressure Journal — ML narrative commentary panel (every 15 ticks). */
  pressureJournalML:   boolean;
  /** Case File Dossier — ML-generated run autopsy after completion. */
  caseFileML:          boolean;
  /** Phase transition cards — exclusive 5-tick window at each phase boundary. */
  phaseTransitionCards: boolean;

  // ── Predator (HEAD_TO_HEAD) mechanics ────────────────────────────────────
  /** Both players draw from same shuffled-seed opportunity deck. */
  sharedDeckOwnership: boolean;
  /** Battle Budget — second currency (BB) for offensive and defensive actions. */
  battleBudget:        boolean;
  /** Extraction window — 3-tick cooldown offensive actions. */
  extractionCooldown:  boolean;
  /** Counter-play window — 5-second defensive response to incoming extraction. */
  counterplayWindow:   boolean;
  /** Bluff cards — display as threat, execute buff/trap. */
  bluffCards:          boolean;
  /** Psyche Meter — opponent's pressure state visible to attacker. */
  psycheMeter:         boolean;
  /** Rivalry System — permanent cross-match record between two players. */
  rivalryPersistent:   boolean;
  /** Spectator Mode — live match viewable by up to 50 external spectators. */
  spectatorMode:       boolean;

  // ── Syndicate (TEAM_UP) mechanics ─────────────────────────────────────────
  /** Shared Treasury — all income pooled, all expenses drawn from one balance. */
  sharedTreasury:      boolean;
  /** Trust Score — real-time cooperative integrity metric (0–100). */
  trustScore:          boolean;
  /** Role Assignment — 4 roles, each grants exclusive draw bias + active ability. */
  roleAssignment:      boolean;
  /** Defection Sequence — 3-card betrayal arc with real mechanical consequences. */
  defectionSequence:   boolean;
  /** Trust Audit — ML-generated post-run contribution breakdown per player. */
  trustAudit:          boolean;
  /** Syndicate Duel — scheduled 48-hour alliance-vs-alliance matches. */
  syndicateDuel:       boolean;

  // ── Phantom (CHASE_A_LEGEND) mechanics ───────────────────────────────────
  /** Ghost Replay — real verified run replayed tick-by-tick via ReplayIntegrityChecker. */
  ghostReplay:         boolean;
  /** Gap Indicator — real-time CORD delta vs legend path. */
  gapIndicator:        boolean;
  /** Legend Decay — older legends decay over time, easier to beat. */
  legendDecay:         boolean;
  /** Dynasty Challenge Stack — tiered matchmaking against legend tiers. */
  dynastyChallengeStack: boolean;
  /** Community Heat — more challengers = faster legend decay. */
  communityHeat:       boolean;

  // ── Universal (present in all modes) ─────────────────────────────────────
  /**
   * Card tag weight overrides — mode ModeOverlayEngine applies tag-based CORD
   * scoring weight modifications. Always true; weight values differ per mode.
   */
  cardTagWeightOverrides: boolean;
}

export const MODE_CAPABILITIES: Record<GameMode, ModeCapabilityMatrix> = {
  GO_ALONE: {
    mode: 'GO_ALONE', label: 'Go Alone — Isolated Sovereign',
    // Empire
    isolationTax: true, bleedMode: true, holdSystem: true,
    pressureJournalML: true, caseFileML: true, phaseTransitionCards: true,
    // Predator
    sharedDeckOwnership: false, battleBudget: false, extractionCooldown: false,
    counterplayWindow: false, bluffCards: false, psycheMeter: false,
    rivalryPersistent: false, spectatorMode: false,
    // Syndicate
    sharedTreasury: false, trustScore: false, roleAssignment: false,
    defectionSequence: false, trustAudit: false, syndicateDuel: false,
    // Phantom
    ghostReplay: false, gapIndicator: false, legendDecay: false,
    dynastyChallengeStack: false, communityHeat: false,
    // Universal
    cardTagWeightOverrides: true,
  },
  HEAD_TO_HEAD: {
    mode: 'HEAD_TO_HEAD', label: 'Head-to-Head — Tempo Warfare',
    // Empire
    isolationTax: false, bleedMode: false, holdSystem: false,
    pressureJournalML: false, caseFileML: false, phaseTransitionCards: false,
    // Predator
    sharedDeckOwnership: true, battleBudget: true, extractionCooldown: true,
    counterplayWindow: true, bluffCards: true, psycheMeter: true,
    rivalryPersistent: true, spectatorMode: true,
    // Syndicate
    sharedTreasury: false, trustScore: false, roleAssignment: false,
    defectionSequence: false, trustAudit: false, syndicateDuel: false,
    // Phantom
    ghostReplay: false, gapIndicator: false, legendDecay: false,
    dynastyChallengeStack: false, communityHeat: false,
    // Universal
    cardTagWeightOverrides: true,
  },
  TEAM_UP: {
    mode: 'TEAM_UP', label: 'Team Up — Cooperative Contracts',
    // Empire
    isolationTax: false, bleedMode: false, holdSystem: false,
    pressureJournalML: false, caseFileML: false, phaseTransitionCards: false,
    // Predator
    sharedDeckOwnership: false, battleBudget: false, extractionCooldown: false,
    counterplayWindow: false, bluffCards: false, psycheMeter: false,
    rivalryPersistent: false, spectatorMode: false,
    // Syndicate
    sharedTreasury: true, trustScore: true, roleAssignment: true,
    defectionSequence: true, trustAudit: true, syndicateDuel: true,
    // Phantom
    ghostReplay: false, gapIndicator: false, legendDecay: false,
    dynastyChallengeStack: false, communityHeat: false,
    // Universal
    cardTagWeightOverrides: true,
  },
  CHASE_A_LEGEND: {
    mode: 'CHASE_A_LEGEND', label: 'Chase a Legend — Ghost Pressure',
    // Empire
    isolationTax: false, bleedMode: false, holdSystem: false,
    pressureJournalML: false, caseFileML: false, phaseTransitionCards: false,
    // Predator
    sharedDeckOwnership: false, battleBudget: false, extractionCooldown: false,
    counterplayWindow: false, bluffCards: false, psycheMeter: false,
    rivalryPersistent: false, spectatorMode: false,
    // Syndicate
    sharedTreasury: false, trustScore: false, roleAssignment: false,
    defectionSequence: false, trustAudit: false, syndicateDuel: false,
    // Phantom
    ghostReplay: true, gapIndicator: true, legendDecay: true,
    dynastyChallengeStack: true, communityHeat: true,
    // Universal
    cardTagWeightOverrides: true,
  },
} as const;

// ── Mode Display Config ────────────────────────────────────────────────────────
/**
 * Single source of truth for all per-mode UI presentation values.
 * Components should consume this instead of hardcoding mode strings.
 * Colors reference design.ts C.* constants — all WCAG AA+ on C.panel.
 */
export interface ModeDisplayConfig {
  /** Short display name for headers */
  alias:           GameModeAlias;
  /** Full mode label as shown in mode select */
  label:           string;
  /** Mode tagline shown on mode select screen */
  tagline:         string;
  /** Emoji icon for compact contexts (chat, badges) */
  icon:            string;
  /** Primary accent color hex — WCAG AA+ on #0D0D1E */
  accentColor:     string;
  /** Dimmed accent for backgrounds (10% opacity) */
  accentDim:       string;
  /** Border accent (28% opacity) */
  accentBorder:    string;
  /** Mode-specific surface background */
  surface:         string;
  /** Mode-specific subtext color — WCAG AA+ on surface */
  textSub:         string;
  /** Minimum players required */
  minPlayers:      1 | 2 | 4;
  /** Maximum players */
  maxPlayers:      1 | 2 | 4;
}

export const MODE_DISPLAY: Record<GameMode, ModeDisplayConfig> = {
  GO_ALONE: {
    alias:        'EMPIRE',
    label:        'Go Alone',
    tagline:      'The Isolated Sovereign',
    icon:         '🏛️',
    accentColor:  '#C9A84C',   // gold — 5.6:1 on #0D0D1E
    accentDim:    'rgba(201,168,76,0.10)',
    accentBorder: 'rgba(201,168,76,0.28)',
    surface:      '#0D0C02',
    textSub:      '#C8A870',   // 5.2:1 on surface
    minPlayers:   1,
    maxPlayers:   1,
  },
  HEAD_TO_HEAD: {
    alias:        'PREDATOR',
    label:        'Head to Head',
    tagline:      'The Financial Predator',
    icon:         '⚔️',
    accentColor:  '#FF4D4D',   // red — 5.8:1 on #0D0D1E
    accentDim:    'rgba(255,77,77,0.10)',
    accentBorder: 'rgba(255,77,77,0.28)',
    surface:      '#0D0005',
    textSub:      '#C89090',   // 5.4:1 on surface
    minPlayers:   2,
    maxPlayers:   2,
  },
  TEAM_UP: {
    alias:        'SYNDICATE',
    label:        'Team Up',
    tagline:      'The Trust Architect',
    icon:         '🤝',
    accentColor:  '#00C9A7',   // teal — 6.1:1 on #0D0D1E
    accentDim:    'rgba(0,201,167,0.10)',
    accentBorder: 'rgba(0,201,167,0.28)',
    surface:      '#020D0A',
    textSub:      '#8ECEC7',   // 5.8:1 on surface
    minPlayers:   2,
    maxPlayers:   4,
  },
  CHASE_A_LEGEND: {
    alias:        'PHANTOM',
    label:        'Chase a Legend',
    tagline:      'The Ghost Hunter',
    icon:         '👻',
    accentColor:  '#9B7DFF',   // purple — 7.1:1 on #0D0D1E
    accentDim:    'rgba(155,125,255,0.10)',
    accentBorder: 'rgba(155,125,255,0.28)',
    surface:      '#06020E',
    textSub:      '#AB90D0',   // 5.1:1 on surface
    minPlayers:   1,
    maxPlayers:   1,
  },
} as const;

// ── Viral Moment Type ─────────────────────────────────────────────────────────
/**
 * Share-worthy game events — trigger the ViralShareMoment overlay.
 * Used across all 4 mode game screens.
 *
 * MAX_SYNERGY     — TEAM_UP: all 4 roles active + treasury healthy
 * BETRAYAL        — TEAM_UP: defection sequence completed
 * RESCUE_SUCCESS  — TEAM_UP: teammate rescued from CRITICAL state
 * LEGEND_BEATEN   — CHASE_A_LEGEND: player's net worth surpassed legend's
 * FREEDOM         — any mode: FREEDOM outcome achieved
 * BLEED_SURVIVED  — GO_ALONE Bleed Mode: terminal state survived
 * NEMESIS_BROKEN  — any mode: arch-rival bot neutralized permanently
 */
export type ViralMomentType =
  | 'MAX_SYNERGY'
  | 'BETRAYAL'
  | 'RESCUE_SUCCESS'
  | 'LEGEND_BEATEN'
  | 'FREEDOM'
  | 'BLEED_SURVIVED'
  | 'NEMESIS_BROKEN';

export interface ViralMoment {
  type:        ViralMomentType;
  tick:        number;
  headline:    string;
  subline:     string;
  shareText:   string;
  cordBonus:   number;  // CORD bonus awarded for this moment (0 if display only)
}

// ── 20M Concurrent Player Scale Config ────────────────────────────────────────
/**
 * Infrastructure constants for 20M concurrent player capacity.
 * These values are read by the connection manager and shard router.
 * They are NOT game balance values — do not use them in game logic.
 *
 * Derived from target architecture:
 *   - 20M CCU total
 *   - 50K runs per shard group
 *   - 400 shard groups
 *   - Each PREDATOR/TEAM_UP run: 2–4 players
 */
export interface ModeScaleConfig {
  mode:                  GameMode;
  /** Maximum concurrent runs in this mode per shard group. */
  maxRunsPerShardGroup:  number;
  /** Target shard group size (concurrent players). */
  shardGroupSize:        number;
  /** Connection timeout in ms before run is auto-ended with ABANDONED. */
  connectionTimeoutMs:   number;
  /** Tick budget (max ticks before forced timeout regardless of outcome). */
  tickBudget:            number;
  /** Whether this mode requires a dedicated matchmaking queue. */
  requiresMatchmaking:   boolean;
  /** Maximum spectators per run (0 = not supported). */
  maxSpectators:         number;
}

export const MODE_SCALE: Record<GameMode, ModeScaleConfig> = {
  GO_ALONE: {
    mode: 'GO_ALONE',
    maxRunsPerShardGroup: 50_000,
    shardGroupSize:       50_000,
    connectionTimeoutMs:  30_000,
    tickBudget:           900,      // 720 standard + 180 bleed extension
    requiresMatchmaking:  false,
    maxSpectators:        0,
  },
  HEAD_TO_HEAD: {
    mode: 'HEAD_TO_HEAD',
    maxRunsPerShardGroup: 25_000,   // 2 players per run
    shardGroupSize:       50_000,
    connectionTimeoutMs:  15_000,   // tighter — opponent is waiting
    tickBudget:           720,
    requiresMatchmaking:  true,
    maxSpectators:        50,
  },
  TEAM_UP: {
    mode: 'TEAM_UP',
    maxRunsPerShardGroup: 12_500,   // 4 players per run
    shardGroupSize:       50_000,
    connectionTimeoutMs:  20_000,
    tickBudget:           720,
    requiresMatchmaking:  true,
    maxSpectators:        0,
  },
  CHASE_A_LEGEND: {
    mode: 'CHASE_A_LEGEND',
    maxRunsPerShardGroup: 50_000,
    shardGroupSize:       50_000,
    connectionTimeoutMs:  30_000,
    tickBudget:           720,
    requiresMatchmaking:  false,
    maxSpectators:        0,
  },
} as const;
