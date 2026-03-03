/**
 * index.ts
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_engine/src/index.ts
 *
 * POINT ZERO ONE — pzo_engine PUBLIC API
 * Density6 LLC · Confidential · Do not distribute
 *
 * Single import entry point for all pzo_engine consumers:
 *   pzo-server, test suites, replay tools, leaderboard API.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * LAYER STRUCTURE — import from here, never from sub-modules directly
 *
 *   Section 1  — Action contract (ledger / signing)
 *   Section 2  — Config (constants, ruleset version, mode config)
 *   Section 3  — Core type system (GameMode, RunOutcome, cards, ticks…)
 *   Section 4  — Engine — TurnEngine + RunSession factory
 *   Section 5  — Engine — Player state
 *   Section 6  — Engine — Draw system (deck, six-deck mix)
 *   Section 7  — Engine — Market + Macro + Portfolio + Solvency
 *   Section 8  — Engine — Moment Forge
 *   Section 9  — Cards layer (catalog, adapter)
 *   Section 10 — Integrity layer (proof hash, replay validator, signed actions)
 *   Section 11 — Persistence layer (run store, types)
 *   Section 12 — API layer types (HTTP transport contracts)
 *   Section 13 — Demo layer (DemoOrchestrator, DemoAI)
 *   Section 14 — Deprecated shims (marked, kept for migration compat)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ACTIONTYPE DISAMBIGUATION
 *
 *   `LedgerActionType` (from './action') — what the player DID in the game world.
 *    Used for signing, ledger records, and replay.
 *
 *   `ActionType` (from './engine/turn-engine') — how TurnEngine resolves a turn.
 *    Used internally by TurnEngine.resolveCard() and TurnContext.
 *    Consumers of pzo_engine should import this as `TurnActionType`.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * BREAKING CHANGES FROM SPRINT 0 index.ts
 *   ✦ `GameEngine` REMOVED — game-engine.ts deleted; replaced by TurnEngine
 *   ✦ `EventBus` REMOVED — superseded by TurnEvent + ledger pipeline
 *   ✦ `buildStarterDeck` RENAMED → `buildStartingDeck` (deck.ts)
 *   ✦ `createPortfolio` REMOVED — PortfolioEngine is class-only, no factory
 *   ✦ `export * from './engine/types'` REMOVED — was silently re-exporting
 *      40+ deprecated shims without labeling them. All types now exported
 *      explicitly with @deprecated tags where applicable.
 *
 * Density6 LLC · Point Zero One · Engine Layer · Confidential
 */

// =============================================================================
// SECTION 1 — ACTION CONTRACT (ledger / signing)
// =============================================================================

export type {
  LedgerActionType,
  Action,
  ActionPayload,
  ActionPayloadPrimitive,
  ActionValidationError,
  // Typed payload shapes
  CardPlayPayload,
  CardDrawPayload,
  RunStartPayload,
  RunEndPayload,
  PvpRoundPayload,
  TrustPayload,
  GhostDeltaPayload,
} from './action';

export {
  UNIVERSAL_ACTION_TYPES,
  MODE_EXCLUSIVE_ACTION_TYPES,
  createAction,
  buildActionId,
  validateAction,
} from './action';

// =============================================================================
// SECTION 2 — CONFIG
// =============================================================================

export {
  // ── Constants ──────────────────────────────────────────────
  RULESET_SEMVER,
  RULESET_GIT_SHA,
  RULESET_VERSION_STRING,
  STARTING_CASH,
  STARTING_INCOME,
  STARTING_EXPENSES,
  RUN_TICKS,
  FREEDOM_THRESHOLD,
  BLEED_CASH_THRESHOLD,
  BATTLE_BUDGET_MAX,
  TRUST_SCORE_INITIAL,
  HATER_HEAT_MAX,
} from './config/pzo_constants';

export {
  RULESET_VERSION,
  RULESET_CHANGELOG,
  isVersionCompatible,
  isProofHashCompatible,
} from './config/ruleset-version';

export type { RulesetVersion } from './config/ruleset-version';

export {
  getModeConfig,
  MODE_EMPIRE_CONFIG,
  MODE_PREDATOR_CONFIG,
  MODE_SYNDICATE_CONFIG,
  MODE_PHANTOM_CONFIG,
} from './config/mode-config';

export type { ModeConfig } from './config/mode-config';

// =============================================================================
// SECTION 3 — CORE TYPE SYSTEM
// =============================================================================

// ── Game mode + primitives ────────────────────────────────────────────────────
export type {
  GameMode,
  GameModeAlias,
  CardId,
  RunId,
  PlayerId,
  TickId,
  DeckType,
  RunOutcome,
  RunPhase,
  CordTier,
  RunGrade,
  ExtendedGrade,
  BadgeTier,
  IntegrityStatus,
  MarketRegime,
  EngineEvent,
  EngineListener,
} from './engine/types';

export {
  BaseDeckType,
  ModeDeckType,
  CardRarity,
  TimingClass,
  CANONICAL_TO_ALIAS,
  ALIAS_TO_CANONICAL,
  SOVEREIGNTY_WEIGHTS,
  OUTCOME_MULTIPLIERS,
  GRADE_THRESHOLDS,
} from './engine/types';

// ── Card types ────────────────────────────────────────────────────────────────
export type {
  CardBaseEffect,
  CardDefinition,
  CardInHand,
  DecisionRecord,
  TickSnapshot,
  CordScore,
} from './engine/types';

// =============================================================================
// SECTION 4 — TURN ENGINE + RUN SESSION
// =============================================================================

export { TurnEngine, createRunSession } from './engine/turn-engine';

export type {
  TurnContext,
  TurnEvent,
  TurnResult,
  TurnPhase,
  ValidationError,
  RunSession,
  /**
   * TurnActionType — imported from turn-engine as a named alias to avoid
   * collision with LedgerActionType from ./action.
   *
   * These are different types:
   *   TurnActionType   = PURCHASE | PASS | SELL | COUNTER | DEFECT | ...
   *   LedgerActionType = CARD_PLAY | MECHANIC_TOUCH | AID_SUBMIT | ...
   */
  ActionType as TurnActionType,
} from './engine/turn-engine';

// =============================================================================
// SECTION 5 — PLAYER STATE
// =============================================================================

export {
  MacroPhase,
  RunPhase,        // enum — server side only; use type RunPhase from engine/types for pure type usage
  createInitialPlayerState,
  applyCashDelta,
  recalcCashflow,
  deriveRunPhase,
  expireBuffs,
  validatePlayerState,
} from './engine/player-state';

export type {
  PlayerState,
  OwnedAsset,
  ActiveBuff,
} from './engine/player-state';

// =============================================================================
// SECTION 6 — DRAW SYSTEM
// =============================================================================

export {
  CARD_REGISTRY,
  BASE_DECK_WEIGHTS,
  buildStartingDeck,
  toCardInHand,
  DrawEngine,
} from './engine/deck';

export {
  DrawMixEngine,
  maybeInjectForcedCard,
} from './engine/six-deck';

export type { DrawMixResult } from './engine/six-deck';

// =============================================================================
// SECTION 7 — MARKET / MACRO / PORTFOLIO / SOLVENCY
// =============================================================================

export { SeededRandom, MarketEngine } from './engine/market-engine';
export type { AssetConfig }           from './engine/market-engine';

export { MacroEngine }                from './engine/macro-engine';
export type { MacroEngineConfig, MacroResult } from './engine/macro-engine';

export { PortfolioEngine }            from './engine/portfolio-engine';
export type { AcquisitionResult, DispositionResult } from './engine/portfolio-engine';

export { SolvencyEngine }             from './engine/wipe-checker';
export type { WipeEvent }             from './engine/wipe-checker';

// =============================================================================
// SECTION 8 — MOMENT FORGE
// =============================================================================

export {
  MomentForge,
  MOMENT_FORGE_RULES as MF_RULES,
  classifyMoment,
  momentAuditHash,
  momentLabel,
} from './engine/moment-forge';

// =============================================================================
// SECTION 9 — CARDS LAYER
// =============================================================================

export {
  getCardDefinition,
  getDrawableCards,
  getCardsByDeck,
  getAllCards,
  getCatalogStats,
  reloadCatalog,
  adaptCard,
  adaptCards,
} from './cards';

export type {
  CatalogCard,
  CatalogDeckType,
  CatalogEconomics,
  CatalogEffect,
  CatalogBuff,
  CatalogAsset,
  CatalogIpa,
  PzoCatalog,
  PzoDecks,
  PzoIds,
} from './cards';

// =============================================================================
// SECTION 10 — INTEGRITY LAYER
// =============================================================================

// ── Types (zero runtime) ─────────────────────────────────────────────────────
export type {
  IntegrityCheckResult,
  ProofHashInput,
  ProofHashResult,
  ProofHashVersion,
  RunAccumulatorStats,
  SovereigntyScore,
  SovereigntyScoreComponents,
  RunSignature,
  RunIdentity,
  GradeReward,
  ProofArtifact,
} from './integrity';

export {
  PROOF_HASH_VERSION,
  GRADE_TO_BADGE_TIER,
} from './integrity';

// ── Hash primitives ───────────────────────────────────────────────────────────
export { HashFunction } from './integrity';

// ── Proof hash (Step 2 of sovereignty pipeline) ───────────────────────────────
export {
  generateProofHash,
  verifyProofHash,
  computeTickStreamChecksum,
  buildTickHashInput,
  crc32hex,
  computeRunFingerprint,
  ProofHashError,
  DEMO_HASH_PREFIX,
} from './integrity';

// ── Replay integrity (Step 1 of sovereignty pipeline) ────────────────────────
export {
  ReplayIntegrityChecker,
  verifyRunIntegrity,
} from './integrity';

// ── Ruleset version utilities ─────────────────────────────────────────────────
export {
  currentRulesetVersion,
  isCurrentHashVersion,
  isLegacyHashVersion,
  assertRulesetVersionBound,
  MODE_VERSION_GATES,
  isModeEligibleForVersion,
} from './integrity';

// ── Signed actions ────────────────────────────────────────────────────────────
export { SignedAction, createSignedAction } from './integrity';

// =============================================================================
// SECTION 11 — PERSISTENCE LAYER
// =============================================================================

export {
  // Aliased to prevent collision with engine/types exports of the same name.
  // These are identical values — the alias documents the import origin.
  SOVEREIGNTY_WEIGHTS as PERSISTENCE_SOVEREIGNTY_WEIGHTS,
  OUTCOME_MULTIPLIERS as PERSISTENCE_OUTCOME_MULTIPLIERS,
  GRADE_THRESHOLDS    as PERSISTENCE_GRADE_THRESHOLDS,
} from './persistence/types';

export type {
  RunOutcome      as PersistenceRunOutcome,
  RunGrade        as PersistenceRunGrade,
  IntegrityStatus as PersistenceIntegrityStatus,
  ArtifactFormat,
  BadgeTier       as PersistenceBadgeTier,
  DecisionRecord  as PersistenceDecisionRecord,
  TickSnapshot    as PersistenceTickSnapshot,
  RunAccumulatorStats as PersistenceRunAccumulatorStats,
  RunIdentity,
  SovereigntyScore    as PersistenceSovereigntyScore,
  RunSignature        as PersistenceRunSignature,
} from './persistence/types';

export { RunStore, createRunStore } from './persistence/run-store';
export type { LeaderboardOptions }  from './persistence/run-store';

// =============================================================================
// SECTION 12 — API LAYER TYPES (HTTP transport contracts)
// =============================================================================

export type {
  ApiSuccess,
  ApiError,
  ApiResponse,
  ApiErrorCode,
  SubmitRunRequest,
  SubmitRunResponse,
  GetRunResponse,
  LeaderboardQuery,
  LeaderboardEntry,
  LeaderboardResponse,
  ReplayVerificationResponse,
  ProofArtifactResponse,
  CatalogStatsResponse,
  HealthResponse,
  UserRunsResponse,
} from './api/types';

// =============================================================================
// SECTION 13 — DEMO LAYER
// =============================================================================

export { DemoOrchestrator } from './demo/DemoOrchestrator';
export { DemoAI }           from './demo/DemoAI';
export { DemoNarrator }     from './demo/DemoNarrator';
export {
  DEMO_CONFIG,
  DEMO_TICK_BUDGET,
  DEMO_SEED,
} from './demo/demo-config';

// =============================================================================
// SECTION 14 — DEPRECATED SHIMS
// Will be removed at v3.0.0. Replace before the next major version cut.
// =============================================================================

/**
 * @deprecated Use `CardInHand + CardDefinition` from engine/types.
 * Scheduled for removal at v3.0.0.
 */
export { CardType } from './engine/types';

/**
 * @deprecated Use `RunPhase` enum from engine/player-state.
 * Scheduled for removal at v3.0.0.
 */
export { RunPhaseEnum } from './engine/types';