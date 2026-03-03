/**
 * action.ts
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_engine/src/action.ts
 *
 * POINT ZERO ONE — CANONICAL ACTION CONTRACT
 * Density6 LLC · Confidential · Do not distribute
 *
 * This file defines the ledger action contract — the shape of every game
 * decision that flows through SignedAction, gets HMAC-signed, and is written
 * to the run's action ledger for integrity verification and replay.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DISAMBIGUATION — TWO ActionType DEFINITIONS IN pzo_engine
 *
 *   src/action.ts          → LedgerActionType  (this file)
 *     What did the player DO in the game world?
 *     Used by: SignedAction, action ledger, proof hash, replay engine.
 *     Values: CARD_PLAY, MECHANIC_TOUCH, FATE_RESOLVE, ...
 *
 *   src/engine/turn-engine.ts → TurnActionType (engine execution)
 *     How should the turn engine resolve the card decision?
 *     Used by: TurnEngine.resolveCard(), TurnContext, TurnResult.
 *     Values: PURCHASE, PASS, SELL, COUNTER, DEFECT, GHOST_MIRROR, ...
 *
 * Always import `LedgerActionType` from this file.
 * Always import `ActionType` (turn-engine variant) from './engine/turn-engine'.
 * The two types are intentionally separate — conflating them collapses
 * the distinction between game logic and audit trail.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * MODE COVERAGE:
 *   GO_ALONE (Empire)        — CARD_PLAY, MECHANIC_TOUCH, HOLD_ACTIVATE,
 *                              HOLD_RELEASE, FATE_RESOLVE, BLEED_THRESHOLD_HIT
 *   HEAD_TO_HEAD (Predator)  — SABOTAGE_APPLY, SABOTAGE_COUNTER, PVP_ROUND,
 *                              COUNTERPLAY_CHOOSE, EXTRACTION_ATTEMPT,
 *                              BLUFF_PLAY, BLUFF_REVEAL
 *   TEAM_UP (Syndicate)      — AID_SUBMIT, RESCUE_CONTRIBUTE, THREAT_MITIGATE,
 *                              DEFECTION_INITIATE, DEFECTION_STEP_RESOLVED,
 *                              TRUST_VOTE, ROLE_ACTIVATE
 *   CHASE_A_LEGEND (Phantom) — GHOST_MARKER_CAPTURED, GHOST_DELTA_SNAPSHOT,
 *                              LEGEND_SURPASSED
 *   All modes                — CARD_DRAW, RUN_START, RUN_END, SEASON_PULSE,
 *                              PHASE_TRANSITION, SYSTEM
 */

import type { GameMode } from './engine/types';

// ── Ledger Action Type ────────────────────────────────────────────────────────

/**
 * `LedgerActionType` — every distinct player or system event that can be
 * signed, stored, and replayed.
 *
 * Organized into groups to clarify mode ownership.
 * Values are STRING LITERALS — safe across serialization and JSON roundtrip.
 *
 * Do not alias this as `ActionType` inside this file — the name is reserved
 * for TurnEngine's execution variant. Consumers should import this explicitly:
 *   import type { LedgerActionType } from '../action';
 */
export type LedgerActionType =
  // ── Universal (all 4 modes) ────────────────────────────────────
  | 'CARD_DRAW'              // Engine draws a card for the player
  | 'CARD_PLAY'              // Player plays a card from hand
  | 'RUN_START'              // Run initialization event (seed committed)
  | 'RUN_END'                // Run termination — any outcome
  | 'SEASON_PULSE'           // Recurring economic macro pulse event
  | 'PHASE_TRANSITION'       // Run phase boundary crossed (FOUNDATION→ESCALATION→SOVEREIGNTY)
  | 'MECHANIC_TOUCH'         // Player interacted with a passive mechanic
  | 'FATE_RESOLVE'           // Forced-fate card auto-resolved or manually resolved
  | 'SYSTEM'                 // Internal engine bookkeeping (not player-initiated)

  // ── Empire / GO_ALONE ──────────────────────────────────────────
  | 'HOLD_ACTIVATE'          // Player placed a card in the Hold System
  | 'HOLD_RELEASE'           // Player released a held card for deferred play
  | 'BLEED_THRESHOLD_HIT'    // Player's cash crossed the bleed mode threshold

  // ── Predator / HEAD_TO_HEAD ────────────────────────────────────
  | 'SABOTAGE_APPLY'         // Attacker resolved a sabotage card against opponent
  | 'SABOTAGE_COUNTER'       // Defender countered a sabotage card
  | 'PVP_ROUND'              // Full PvP round resolved (attack + optional counter)
  | 'COUNTERPLAY_CHOOSE'     // Defender chose a counter-play response
  | 'EXTRACTION_ATTEMPT'     // Attacker opened an extraction window
  | 'BLUFF_PLAY'             // Player committed a bluff card (type hidden)
  | 'BLUFF_REVEAL'           // Bluff resolved — buff or trap revealed

  // ── Syndicate / TEAM_UP ────────────────────────────────────────
  | 'AID_SUBMIT'             // Player submitted an aid card to teammate
  | 'RESCUE_CONTRIBUTE'      // Player contributed to a rescue window
  | 'THREAT_MITIGATE'        // Player resolved a shared threat card
  | 'DEFECTION_INITIATE'     // Player started the 3-card defection sequence
  | 'DEFECTION_STEP_RESOLVED'// One step of the defection arc completed
  | 'TRUST_VOTE'             // Player voted on a trust audit resolution
  | 'ROLE_ACTIVATE'          // Player activated their Syndicate role ability

  // ── Phantom / CHASE_A_LEGEND ───────────────────────────────────
  | 'GHOST_MARKER_CAPTURED'  // Player's path captured a legend ghost marker
  | 'GHOST_DELTA_SNAPSHOT'   // CORD delta between player and legend recorded
  | 'LEGEND_SURPASSED';      // Player's net worth exceeded the legend's at same tick

// ── Payload Types ─────────────────────────────────────────────────────────────

/**
 * Base payload — all action payloads extend this shape.
 * Keys are strings; values are JSON-serializable primitives only.
 * No nested objects — keeps canonical JSON deterministic and diff-friendly.
 */
export type ActionPayloadPrimitive = string | number | boolean | null;
export type ActionPayload = Record<string, ActionPayloadPrimitive>;

/**
 * Typed payload shapes for high-frequency action types.
 * Use these in call sites to catch payload schema drift at compile time.
 *
 * For action types not listed here, fall back to `ActionPayload`.
 */
export interface CardPlayPayload extends ActionPayload {
  cardId:         string;
  instanceId:     string;
  deckType:       string;
  base_cost:      number;
  turnDecisionMs: number;   // ms between card presentation and player choice
  wasAutoResolved:boolean;
}

export interface CardDrawPayload extends ActionPayload {
  cardId:   string;
  deckType: string;
  drawPile: number;   // remaining draw pile size after draw
}

export interface RunStartPayload extends ActionPayload {
  runId:          string;
  seed:           string;    // hex string representation of numeric seed
  gameMode:       string;
  rulesetVersion: string;
  isDemoRun:      boolean;
}

export interface RunEndPayload extends ActionPayload {
  outcome:        string;    // RunOutcome
  finalNetWorth:  number;
  ticksSurvived:  number;
  grade:          string;    // RunGrade
  proofHash:      string;
}

export interface PvpRoundPayload extends ActionPayload {
  attackerId:     string;
  defenderId:     string;
  sabotageCardId: string;
  counterCardId:  string | null;
  battleBudgetNet:number;    // net BB delta for attacker after round
  resolved:       boolean;
}

export interface TrustPayload extends ActionPayload {
  trustDelta:   number;
  trustAfter:   number;
  roleId:       string | null;
}

export interface GhostDeltaPayload extends ActionPayload {
  legendUserId:  string;
  playerNetWorth:number;
  legendNetWorth:number;
  delta:         number;   // player - legend (positive = ahead)
  tickIndex:     number;
}

// ── Action Interface ──────────────────────────────────────────────────────────

/**
 * `Action` — the canonical signed ledger record for every game event.
 *
 * Every Action is:
 *   - Deterministic: id is constructed from runId + tick + type + sequence
 *   - Mode-contextualized: gameMode field binds the action to its game context
 *   - Version-bound: rulesetVersion ensures proof hashes don't cross rulesets
 *   - HMAC-signed: passes through SignedAction before being appended to ledger
 *
 * Immutable after construction — never mutate a signed action.
 */
export interface Action {
  /**
   * Unique, deterministic action identifier.
   * Recommended format: `${runId}:${tickIndex}:${type}:${sequenceWithinTick}`
   * Example: `run_abc123:042:CARD_PLAY:0`
   */
  readonly id: string;

  /** Ledger action classification — determines which fields of payload are expected. */
  readonly type: LedgerActionType;

  /** Game tick at which this action occurred. Monotonically increasing within a run. */
  readonly tick: number;

  /**
   * Sequence index within the tick (for multiple actions on the same tick).
   * Starts at 0. Required for deterministic ordering in replay.
   */
  readonly sequence: number;

  /** Player or system entity originating the action. 'SYSTEM' for engine-driven events. */
  readonly playerId: string;

  /**
   * The run this action belongs to. Required for cross-referencing the
   * proof hash and for multi-player mode replay matching.
   */
  readonly runId: string;

  /**
   * Canonical game mode at the time of the action.
   * Binds the action to its mode context for mode-aware replay verification.
   */
  readonly gameMode: GameMode;

  /**
   * Ruleset semver at the time of the action.
   * Proof hash verification will reject actions whose rulesetVersion
   * does not match the current engine's ruleset.
   */
  readonly rulesetVersion: string;

  /** ISO 8601 timestamp — use `new Date().toISOString()`. */
  readonly timestamp: string;

  /**
   * Typed payload specific to this action type.
   * All values must be JSON-serializable primitives.
   * No nested objects — flat structure ensures canonical JSON is stable.
   */
  readonly payload: ActionPayload;
}

// ── Mode-to-Action Groupings ──────────────────────────────────────────────────

/**
 * Actions legal in every mode.
 * Use this to validate that an action is mode-agnostic before signing.
 */
export const UNIVERSAL_ACTION_TYPES = new Set<LedgerActionType>([
  'CARD_DRAW',
  'CARD_PLAY',
  'RUN_START',
  'RUN_END',
  'SEASON_PULSE',
  'PHASE_TRANSITION',
  'MECHANIC_TOUCH',
  'FATE_RESOLVE',
  'SYSTEM',
] as const);

/**
 * Actions exclusive to each mode.
 * Cross-mode actions in the ledger are flagged by replay-validator.ts.
 */
export const MODE_EXCLUSIVE_ACTION_TYPES: Record<GameMode, ReadonlySet<LedgerActionType>> = {
  GO_ALONE: new Set<LedgerActionType>([
    'HOLD_ACTIVATE',
    'HOLD_RELEASE',
    'BLEED_THRESHOLD_HIT',
  ]),
  HEAD_TO_HEAD: new Set<LedgerActionType>([
    'SABOTAGE_APPLY',
    'SABOTAGE_COUNTER',
    'PVP_ROUND',
    'COUNTERPLAY_CHOOSE',
    'EXTRACTION_ATTEMPT',
    'BLUFF_PLAY',
    'BLUFF_REVEAL',
  ]),
  TEAM_UP: new Set<LedgerActionType>([
    'AID_SUBMIT',
    'RESCUE_CONTRIBUTE',
    'THREAT_MITIGATE',
    'DEFECTION_INITIATE',
    'DEFECTION_STEP_RESOLVED',
    'TRUST_VOTE',
    'ROLE_ACTIVATE',
  ]),
  CHASE_A_LEGEND: new Set<LedgerActionType>([
    'GHOST_MARKER_CAPTURED',
    'GHOST_DELTA_SNAPSHOT',
    'LEGEND_SURPASSED',
  ]),
} as const;

// ── Factories ─────────────────────────────────────────────────────────────────

/**
 * Build a fully typed `Action` with required fields.
 *
 * `sequence` defaults to 0. Pass a non-zero value when multiple actions
 * occur on the same tick (e.g. a CARD_PLAY followed by a MECHANIC_TOUCH
 * on tick 42 → sequences 0 and 1).
 *
 * `timestamp` defaults to `new Date().toISOString()`.
 * Override for deterministic testing or replay.
 */
export function createAction(
  params: Omit<Action, 'timestamp' | 'sequence'> & {
    timestamp?: string;
    sequence?:  number;
  },
): Action {
  return {
    sequence:  0,
    timestamp: new Date().toISOString(),
    ...params,
  };
}

/**
 * Build the deterministic action ID string.
 * Always call this instead of constructing the string inline
 * so the format stays consistent across the codebase.
 *
 * Format: `${runId}:${tickIndex.toString().padStart(4, '0')}:${type}:${sequence}`
 * Example: `run_abc123:0042:CARD_PLAY:0`
 */
export function buildActionId(
  runId:     string,
  tick:      number,
  type:      LedgerActionType,
  sequence = 0,
): string {
  return `${runId}:${tick.toString().padStart(4, '0')}:${type}:${sequence}`;
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface ActionValidationError {
  field:   string;
  message: string;
}

/**
 * Validate that an action is structurally well-formed and mode-consistent.
 * Does NOT verify the HMAC signature — that is SignedAction's responsibility.
 *
 * Returns an empty array if valid; an array of errors if not.
 * Blocking errors only — warns are not surfaced here.
 */
export function validateAction(action: Action): ActionValidationError[] {
  const errors: ActionValidationError[] = [];

  if (!action.id?.trim()) {
    errors.push({ field: 'id', message: 'Action id is required' });
  }
  if (!action.runId?.trim()) {
    errors.push({ field: 'runId', message: 'runId is required' });
  }
  if (!action.playerId?.trim()) {
    errors.push({ field: 'playerId', message: 'playerId is required' });
  }
  if (!action.rulesetVersion?.trim()) {
    errors.push({ field: 'rulesetVersion', message: 'rulesetVersion is required for integrity binding' });
  }
  if (action.tick < 0) {
    errors.push({ field: 'tick', message: `tick must be ≥ 0, got ${action.tick}` });
  }
  if (action.sequence < 0) {
    errors.push({ field: 'sequence', message: `sequence must be ≥ 0, got ${action.sequence}` });
  }

  // Mode-action consistency check
  const modeExclusive = MODE_EXCLUSIVE_ACTION_TYPES[action.gameMode];
  // Check that no other mode's exclusive actions appear in this mode
  for (const [mode, exclusiveSet] of Object.entries(MODE_EXCLUSIVE_ACTION_TYPES) as [GameMode, Set<LedgerActionType>][]) {
    if (mode !== action.gameMode && exclusiveSet.has(action.type)) {
      errors.push({
        field:   'type',
        message: `Action type '${action.type}' is exclusive to mode '${mode}' — not valid in '${action.gameMode}'`,
      });
    }
  }

  // Payload primitive check
  for (const [key, val] of Object.entries(action.payload)) {
    const t = typeof val;
    if (val !== null && t !== 'string' && t !== 'number' && t !== 'boolean') {
      errors.push({
        field:   `payload.${key}`,
        message: `Payload values must be primitives (string | number | boolean | null), got '${t}'`,
      });
    }
  }

  return errors;
}