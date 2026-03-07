// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/types/index.ts
// Sprint 8 — Barrel Export
//
// Single import entry point for all game type contracts.
// Export order = dependency order (no file can circularly depend on later exports).
//
// IMPORT PATTERN (consumers):
//   import type { GameMode, RunPhase }    from '../types';
//   import type { RunState, BattleState } from '../types';
//   import type { CardInHand, DeckType }  from '../types';
//   import type { CordScore, RunGrade }   from '../types';
//   import type { RunEvent, EngineEventName } from '../types';
//   import { C, FONTS, FS, BP, TOUCH_TARGET } from '../types';
//
// NOTE: design.ts is the only runtime export (constants + functions).
// All others are type-only — tree-shaken in production builds.
//
// Density6 LLC · Confidential · All Rights Reserved
// ═══════════════════════════════════════════════════════════════════════════

// ── 1. Design tokens (no deps — purely additive) ──────────────────────────────
export {
  C, FONTS, FONT_IMPORT, FS, BP, TOUCH_TARGET, KEYFRAMES,
  MODE_COLORS, PRESSURE_COLORS, TICK_COLORS, GRADE_COLORS,
  CORD_TIER_COLORS, OUTCOME_COLORS, SHIELD_LAYER_COLORS,
  BOT_COLORS, BLEED_SEVERITY_COLORS, THREAT_SEVERITY_COLORS,
  responsiveClamp, hexToRgba, modeAccent, modeSurface,
} from './design';
export type { DesignColor, GameModeAlias } from './design';

// ── 2. Battle phase types (no deps) ───────────────────────────────────────────
export type {
  BattlePhase, ExtractionActionType, SabotageKind,
  CounterplayResult, RivalryTier,
  BattleRoundResult, SpectatorFeedEntry,
} from './battlePhase';
export {
  BATTLE_PHASE_LABELS, BATTLE_PHASE_COLORS,
  EXTRACTION_ACTION_LABELS, EXTRACTION_BB_COSTS,
  COUNTERPLAY_RESULT_LABELS,
  RIVALRY_TIER_LABELS, RIVALRY_TIER_MATCH_THRESHOLDS, RIVALRY_TIER_COLORS,
} from './battlePhase';

// ── 3. Mode types (no deps) ────────────────────────────────────────────────────
export type {
  GameMode, LegacyRunMode, GameModeAlias as ModeAlias,
  RunPhase, ModeCapabilityMatrix, ModeDisplayConfig,
  ModeScaleConfig, ViralMoment, ViralMomentType,
} from './modes';
export {
  LEGACY_TO_CANONICAL_MODE, CANONICAL_TO_LEGACY_MODE,
  CANONICAL_TO_ALIAS, ALIAS_TO_CANONICAL,
  LEGACY_MODE_MAP, CANONICAL_TO_LEGACY,
  RUN_PHASE_LABELS, DEFAULT_PHASE_BOUNDARIES,
  MODE_CAPABILITIES, MODE_DISPLAY, MODE_SCALE,
} from './modes';

// ── 4. CORD / Sovereignty types (no deps) ─────────────────────────────────────
export type {
  RunOutcome, RunGrade, ExtendedGrade, BadgeTier,
  IntegrityStatus, ArtifactFormat,
  CordTier, CordScore, CordModeContext,
  DecisionRecord, TickSnapshot,
  VerifiedRunRecord, LeaderboardEntry,
} from './cord';
export {
  CORD_TIER_THRESHOLDS,
  CORD_TIER_COLORS as CORD_TIER_DISPLAY_COLORS,
  SOVEREIGNTY_WEIGHTS, OUTCOME_MULTIPLIERS,
  GRADE_THRESHOLDS, BLEED_MODE_GRADE_THRESHOLDS,
  GRADE_LABELS, GRADE_COLORS as GRADE_DISPLAY_COLORS,
  GRADE_TO_BADGE_TIER,
} from './cord';

// ── 5. Card types (no deps) ────────────────────────────────────────────────────
export type {
  GameMode as CardGameMode,  // type alias — same value, used in card engine
  DeckType, BaseDeckType as BaseCardType, ModeDeckType as ModeCardType,
  TimingClass, CardTag, Targeting, CardRarity,
  LegendMarkerType, DefectionStep, RunPhase as CardRunPhase,
  ForcedCardSource,
  CardDefinition, CardBaseEffect, ModeOverlay,
  CardInHand, ModeCardMetadata, CardValuationContext,
  CardVisibilityScope, CardVisibility,
  AidCardTerms, GhostCardRequirement, PhaseBoundaryWindow,
  GameCard,   // @deprecated — use CardInHand
  CardEventName, CardEventPayloadMap,
} from './cards';
export {
  BaseDeckType, ModeDeckType, TimingClass as TimingClassEnum,
  CardTag as CardTagEnum, Targeting as TargetingEnum,
  CardRarity as CardRarityEnum,
  LegendMarkerType as LegendMarkerTypeEnum,
  DefectionStep as DefectionStepEnum,
  ForcedCardSource as ForcedCardSourceEnum,
  CARD_LEGALITY_MATRIX, DECK_TYPE_MANUALLY_PLAYABLE,
  TIMING_CLASS_WINDOW_MS, DEFAULT_MODE_OVERLAYS,
} from './cards';

// ── 6. Run state types (depends on: modes, cards, battlePhase) ─────────────────
export type {
  RunScreen, MarketRegime, TelemetryEnvelopeV2,
  IntelligenceState, SeasonState,
  ActiveSabotage, RescueWindow,
  ShieldLayerSummary, PsycheMeterSummary, RivalryStateSummary,
  BattleState, RunState,
} from './runState';
export type {
  BattlePhase as BattlePhaseEnum,    // type-only re-export — required for isolatedModules
} from './runState';
export {
  STARTING_CASH, STARTING_INCOME, STARTING_EXPENSES, RUN_TICKS,
  FREEDOM_THRESHOLD, BLEED_CASH_THRESHOLD, BATTLE_BUDGET_MAX,
  TRUST_SCORE_INITIAL, HATER_HEAT_MAX,
  createInitialRunState,
} from './runState';

// ── 7. Event types (depends on: all above) ─────────────────────────────────────
export type {
  RunEvent, EngineId, EngineEventName,
  ModeEventName, ModeEventPayloadMap,
  ForcedEventType,
} from './events';
// RunOutcome re-exported from cord.ts (canonical) — not from events.ts
