/**
 * Canonical four-mode enum aligned with CardEngine GameMode in engines/cards/types.ts.
 * These are the runtime values used everywhere EXCEPT the old core/types.ts legacy RunMode.
 *
 * GO_ALONE       = 'EMPIRE'    — Capital allocation, isolation tax, bleed mode
 * HEAD_TO_HEAD   = 'PREDATOR'  — Battle budget, extraction windows, psyche meter
 * TEAM_UP        = 'SYNDICATE' — Shared treasury, trust score, defection arc
 * CHASE_A_LEGEND = 'PHANTOM'   — Ghost replay, legend decay, dynasty stack
 */
export type GameMode = 'GO_ALONE' | 'HEAD_TO_HEAD' | 'TEAM_UP' | 'CHASE_A_LEGEND';
/** Legacy mode strings used in OLD engine core/types.ts RunMode. */
export type LegacyRunMode = 'solo' | 'asymmetric-pvp' | 'co-op' | 'ghost';
/**
 * Short-form display alias — used in UI headers and social share strings.
 * Maps 1:1 with GameMode.
 */
export type GameModeAlias = 'EMPIRE' | 'PREDATOR' | 'SYNDICATE' | 'PHANTOM';
/** Maps legacy RunMode → canonical GameMode. */
export declare const LEGACY_TO_CANONICAL_MODE: Record<LegacyRunMode, GameMode>;
/** Maps canonical GameMode → legacy RunMode. */
export declare const CANONICAL_TO_LEGACY_MODE: Record<GameMode, LegacyRunMode>;
/** Maps canonical GameMode → short-form alias (for display and design tokens). */
export declare const CANONICAL_TO_ALIAS: Record<GameMode, GameModeAlias>;
/** Maps short-form alias → canonical GameMode. */
export declare const ALIAS_TO_CANONICAL: Record<GameModeAlias, GameMode>;
/** @deprecated Use LEGACY_TO_CANONICAL_MODE */
export declare const LEGACY_MODE_MAP: Record<LegacyRunMode, GameMode>;
/** @deprecated Use CANONICAL_TO_LEGACY_MODE */
export declare const CANONICAL_TO_LEGACY: Record<GameMode, LegacyRunMode>;
/**
 * Three-phase architecture governing Empire mode run structure.
 * Phase boundaries are tick-based — set by empireConfig.ts.
 *
 * FOUNDATION  (Phase 1): Bots DORMANT. Build income. No sabotage.
 * ESCALATION  (Phase 2): Bots WATCHING→CIRCLING. Sabotage begins.
 * SOVEREIGNTY (Phase 3): All 5 bots ATTACKING. Tick rate T3→T4.
 */
export type RunPhase = 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY';
export declare const RUN_PHASE_LABELS: Record<RunPhase, string>;
/** Tick index at which each phase begins (defaults from empireConfig.ts). */
export declare const DEFAULT_PHASE_BOUNDARIES: Record<RunPhase, number>;
/**
 * Canonical feature matrix per mode.
 * Engine orchestrator reads this at run start to enable/disable systems.
 * ModeRouter.ts wires the correct engines based on this record.
 *
 * Sprint 8 changes: +13 fields vs Sprint 0.
 */
export interface ModeCapabilityMatrix {
    mode: GameMode;
    label: string;
    /** Player bears an Isolation Tax — structural penalty for running solo. */
    isolationTax: boolean;
    /** Bleed Mode available — all handicaps active, CORD ceiling 1.80, S-grade. */
    bleedMode: boolean;
    /** Hold System — pause a card's decision timer for deferred play. */
    holdSystem: boolean;
    /** Pressure Journal — ML narrative commentary panel (every 15 ticks). */
    pressureJournalML: boolean;
    /** Case File Dossier — ML-generated run autopsy after completion. */
    caseFileML: boolean;
    /** Phase transition cards — exclusive 5-tick window at each phase boundary. */
    phaseTransitionCards: boolean;
    /** Both players draw from same shuffled-seed opportunity deck. */
    sharedDeckOwnership: boolean;
    /** Battle Budget — second currency (BB) for offensive and defensive actions. */
    battleBudget: boolean;
    /** Extraction window — 3-tick cooldown offensive actions. */
    extractionCooldown: boolean;
    /** Counter-play window — 5-second defensive response to incoming extraction. */
    counterplayWindow: boolean;
    /** Bluff cards — display as threat, execute buff/trap. */
    bluffCards: boolean;
    /** Psyche Meter — opponent's pressure state visible to attacker. */
    psycheMeter: boolean;
    /** Rivalry System — permanent cross-match record between two players. */
    rivalryPersistent: boolean;
    /** Spectator Mode — live match viewable by up to 50 external spectators. */
    spectatorMode: boolean;
    /** Shared Treasury — all income pooled, all expenses drawn from one balance. */
    sharedTreasury: boolean;
    /** Trust Score — real-time cooperative integrity metric (0–100). */
    trustScore: boolean;
    /** Role Assignment — 4 roles, each grants exclusive draw bias + active ability. */
    roleAssignment: boolean;
    /** Defection Sequence — 3-card betrayal arc with real mechanical consequences. */
    defectionSequence: boolean;
    /** Trust Audit — ML-generated post-run contribution breakdown per player. */
    trustAudit: boolean;
    /** Syndicate Duel — scheduled 48-hour alliance-vs-alliance matches. */
    syndicateDuel: boolean;
    /** Ghost Replay — real verified run replayed tick-by-tick via ReplayIntegrityChecker. */
    ghostReplay: boolean;
    /** Gap Indicator — real-time CORD delta vs legend path. */
    gapIndicator: boolean;
    /** Legend Decay — older legends decay over time, easier to beat. */
    legendDecay: boolean;
    /** Dynasty Challenge Stack — tiered matchmaking against legend tiers. */
    dynastyChallengeStack: boolean;
    /** Community Heat — more challengers = faster legend decay. */
    communityHeat: boolean;
    /**
     * Card tag weight overrides — mode ModeOverlayEngine applies tag-based CORD
     * scoring weight modifications. Always true; weight values differ per mode.
     */
    cardTagWeightOverrides: boolean;
}
export declare const MODE_CAPABILITIES: Record<GameMode, ModeCapabilityMatrix>;
/**
 * Single source of truth for all per-mode UI presentation values.
 * Components should consume this instead of hardcoding mode strings.
 * Colors reference design.ts C.* constants — all WCAG AA+ on C.panel.
 */
export interface ModeDisplayConfig {
    /** Short display name for headers */
    alias: GameModeAlias;
    /** Full mode label as shown in mode select */
    label: string;
    /** Mode tagline shown on mode select screen */
    tagline: string;
    /** Emoji icon for compact contexts (chat, badges) */
    icon: string;
    /** Primary accent color hex — WCAG AA+ on #0D0D1E */
    accentColor: string;
    /** Dimmed accent for backgrounds (10% opacity) */
    accentDim: string;
    /** Border accent (28% opacity) */
    accentBorder: string;
    /** Mode-specific surface background */
    surface: string;
    /** Mode-specific subtext color — WCAG AA+ on surface */
    textSub: string;
    /** Minimum players required */
    minPlayers: 1 | 2 | 4;
    /** Maximum players */
    maxPlayers: 1 | 2 | 4;
}
export declare const MODE_DISPLAY: Record<GameMode, ModeDisplayConfig>;
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
export type ViralMomentType = 'MAX_SYNERGY' | 'BETRAYAL' | 'RESCUE_SUCCESS' | 'LEGEND_BEATEN' | 'FREEDOM' | 'BLEED_SURVIVED' | 'NEMESIS_BROKEN';
export interface ViralMoment {
    type: ViralMomentType;
    tick: number;
    headline: string;
    subline: string;
    shareText: string;
    cordBonus: number;
}
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
    mode: GameMode;
    /** Maximum concurrent runs in this mode per shard group. */
    maxRunsPerShardGroup: number;
    /** Target shard group size (concurrent players). */
    shardGroupSize: number;
    /** Connection timeout in ms before run is auto-ended with ABANDONED. */
    connectionTimeoutMs: number;
    /** Tick budget (max ticks before forced timeout regardless of outcome). */
    tickBudget: number;
    /** Whether this mode requires a dedicated matchmaking queue. */
    requiresMatchmaking: boolean;
    /** Maximum spectators per run (0 = not supported). */
    maxSpectators: number;
}
export declare const MODE_SCALE: Record<GameMode, ModeScaleConfig>;
//# sourceMappingURL=modes.d.ts.map