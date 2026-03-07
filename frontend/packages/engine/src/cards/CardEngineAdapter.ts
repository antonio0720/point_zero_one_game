// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — CARD ENGINE ADAPTER
// pzo-web/src/engines/cards/CardEngineAdapter.ts
//
// Thin adapter that implements IEngine (zero/types.ts) and wraps CardEngine.
// Allows CardEngine to be registered in EngineRegistry alongside the other 7
// engines despite having a different init() signature.
//
// WHY THIS EXISTS:
//   EngineRegistry.initializeAll() calls engine.init(params: EngineInitParams)
//   on every registered engine. CardEngine.init() requires CardEngineInitParams
//   which includes gameMode, decisionWindowMs, battleBudgetMax, and other
//   card-layer configuration that EngineInitParams does not carry.
//
//   CardEngineAdapter bridges this gap:
//     (a) Implements IEngine.init(params: EngineInitParams) — what the registry expects.
//     (b) Reads the current GameMode from ModeRouter.
//     (c) Merges EngineInitParams fields (seed, userId, runId) with card-specific
//         defaults and the resolved GameMode into a full CardEngineInitParams.
//     (d) Calls cardEngine.init(mergedParams) with the complete params.
//
// DELEGATION CONTRACT:
//   Every public method on CardEngineAdapter delegates to the inner CardEngine.
//   CardEngineAdapter contains NO game logic. It only translates and delegates.
//   The Orchestrator holds a typed reference to CardEngineAdapter so it can call
//   tick(), getReader(), queuePlay(), etc. without casting.
//
// USAGE:
//   EngineOrchestrator constructor:
//     this.cardEngine        = new CardEngine(this.eventBus);
//     this.cardEngineAdapter = new CardEngineAdapter(this.cardEngine, this.eventBus);
//     this.registry.register(this.cardEngineAdapter);
//
// GAMEMODE RESOLUTION:
//   ModeRouter.getInstance().getActiveMode() is called during init() — at the
//   moment the run starts — to get the GameMode the player selected.
//   If ModeRouter returns null (no mode selected, test context, etc.), the adapter
//   defaults to GameMode.GO_ALONE (Empire mode) and logs a warning.
//
// DECISION WINDOW DEFAULT:
//   DEFAULT_DECISION_WINDOW_MS = 30_000 (30 seconds). This is the outer bound
//   for all standard cards. TimingClass-specific overrides are handled inside
//   DecisionWindowManager per the Card Logic Bible timing table.
//   Override via params.cardDecisionWindowMs if the run config carries it.
//
// RULES:
//   ✦ No game logic here — translate and delegate only.
//   ✦ Never import from store/ or features/.
//   ✦ ModeRouter is the single source of truth for GameMode at run start.
//   ✦ CardEngineAdapter does not cache ModeRouter's result — it reads it once
//     during init() and stores it in the params passed to CardEngine.
//
// Density6 LLC · Point Zero One · Cards Engine · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import type { IEngine, EngineInitParams, EngineHealth, CardReader } from '../zero/types';
import { EngineId }                         from '../zero/types';
import type { EventBus }                    from '../zero/EventBus';
import { CardEngine }                       from './CardEngine';
import {
  GameMode,
  type CardEngineInitParams,
  type CardPlayRequest,
  type CardInHand,
  type DecisionRecord,
} from './types';
import { ModeRouter }                       from '../modes/ModeRouter';

// ── DECISION WINDOW DEFAULT ───────────────────────────────────────────────────

/**
 * Default decision window duration in milliseconds.
 * Applied to all standard cards unless the run config provides an override.
 * TimingClass-specific windows (COUNTER_WINDOW = 5s, RESCUE_WINDOW = 15s)
 * are handled inside DecisionWindowManager — this is the outer default only.
 */
const DEFAULT_DECISION_WINDOW_MS = 30_000; // 30 seconds

// ═══════════════════════════════════════════════════════════════════════════════
// CARD ENGINE ADAPTER
// ═══════════════════════════════════════════════════════════════════════════════

export class CardEngineAdapter implements IEngine {

  // ── IEngine contract ────────────────────────────────────────────────────────
  public readonly engineId: EngineId = EngineId.CARD;

  // ── Inner engine + bus ──────────────────────────────────────────────────────
  private readonly inner:    CardEngine;
  private readonly eventBus: EventBus;

  // ── Resolved params (stored for diagnostics after init) ─────────────────────
  private resolvedGameMode: GameMode | null = null;

  constructor(inner: CardEngine, eventBus: EventBus) {
    this.inner    = inner;
    this.eventBus = eventBus;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IENGINE: init
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Implements IEngine.init(params: EngineInitParams).
   *
   * Translates EngineInitParams → CardEngineInitParams:
   *   1. Reads GameMode from ModeRouter (single source of truth for mode).
   *   2. Merges shared fields (seed, userId, runId) from EngineInitParams.
   *   3. Applies card-layer defaults (decisionWindowMs, battleBudgetMax).
   *   4. Delegates to CardEngine.init(mergedParams).
   *
   * Called by EngineRegistry.initializeAll() — same as all other engines.
   */
  public init(params: EngineInitParams): void {
    // ── Step 1: Resolve GameMode from ModeRouter ──────────────────────────────
    // ModeRouter.getInstance() returns the singleton. getActiveMode() returns
    // the GameMode the player selected in LobbyScreen (set before startRun()).
    // Falls back to GO_ALONE (Empire) if no mode is active — guards against
    // test contexts or mis-ordered initialization.
    
    const resolvedMode: GameMode = ModeRouter.getActiveMode() ?? GameMode.GO_ALONE;

    if (!ModeRouter.getActiveMode()) {
      console.warn(
        `[CardEngineAdapter] ModeRouter returned null for active mode. ` +
        `Defaulting to GO_ALONE (Empire). Ensure ModeRouter.setMode() is called ` +
        `before EngineOrchestrator.startRun().`,
      );
    }

    this.resolvedGameMode = resolvedMode;

    // ── Step 2: Build CardEngineInitParams ────────────────────────────────────
    // Merges EngineInitParams fields (runId, userId, seed) with card-layer config.
    // battleBudgetMax is only relevant for HEAD_TO_HEAD (Predator) mode.
    // decisionWindowMs can be overridden via params.cardDecisionWindowMs if the
    // run config carries it (Phase 2+). For now, apply the default.
    const cardParams: CardEngineInitParams = {
      // ── Shared fields from EngineInitParams ──────────────────────────────
      runId:  params.runId,
      userId: params.userId,
      seed:   params.seed,

      // ── Card-layer specific ───────────────────────────────────────────────
      gameMode:          resolvedMode,
      decisionWindowMs:  DEFAULT_DECISION_WINDOW_MS,

      // ── Mode-conditional fields ───────────────────────────────────────────
      // Predator mode: give bots a battle budget pool to spend on attacks.
      // All other modes: undefined (CardEngine skips battle budget init).
      battleBudgetMax: resolvedMode === GameMode.HEAD_TO_HEAD
        ? PREDATOR_BATTLE_BUDGET_MAX
        : undefined,

      // ── Syndicate mode: teammate user IDs for rescue/aid wiring ─────────
      // Phase 2: populated from run config when Syndicate is implemented.
      // For now, defaults to empty — ForcedCardQueue handles null teammate gracefully.
      teammateUserIds: resolvedMode === GameMode.TEAM_UP
        ? (params as any).teammateUserIds ?? []
        : undefined,

      // ── Phantom mode: legend target definition ───────────────────────────
      // Phase 2: populated from legend selection at lobby. Defaults to null.
      legendTargetId: resolvedMode === GameMode.CHASE_A_LEGEND
        ? (params as any).legendTargetId ?? null
        : undefined,
    };

    // ── Step 3: Delegate to CardEngine.init() ────────────────────────────────
    this.inner.init(cardParams);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IENGINE: reset
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Implements IEngine.reset().
   * Returns CardEngine to REGISTERED state. Called between runs.
   */
  public reset(): void {
    this.inner.reset();
    this.resolvedGameMode = null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE DELEGATION (non-IEngine — called directly by EngineOrchestrator)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Fill initial hand and start the card engine run loop.
   * Called by EngineOrchestrator.startRun() after initializeAll() succeeds.
   */
  public startRun(): void {
    this.inner.startRun();
  }

  /**
   * Tear down ForcedCardQueue subscriptions and window state at run end.
   * Called by EngineOrchestrator.endRun() before emitting RUN_ENDED.
   */
  public endRun(): void {
    this.inner.endRun();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PER-TICK DELEGATION (called by EngineOrchestrator at Step 1.5)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Execute the full card engine tick sequence.
   *
   * Called by EngineOrchestrator at Step 1.5 of executeTick():
   *   After TimeEngine.advanceTick(snapshot) — tick is now advanced.
   *   Before PressureEngine.computeScore(snapshot) — card effects can affect pressure.
   *
   * @param tickIndex - Current game tick (from snapshot.tickIndex)
   * @returns         DecisionRecord[] from this tick — threaded by Orchestrator
   *                  into TickResult.decisionsThisTick and pendingDecisions.
   */
  public tick(tickIndex: number): DecisionRecord[] {
    return this.inner.tick(tickIndex);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CARD READER DELEGATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Returns the stable CardReader interface from the inner CardEngine.
   * Called once by EngineOrchestrator at construction to get the reader reference.
   * The same object is reused throughout the run lifecycle.
   */
  public getReader(): CardReader {
    return this.inner.getReader();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PLAYER INPUT DELEGATION (called by EngineOrchestrator public API)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Queue a card play request from the player.
   * Executed during the next tick's Step E (HandManager.flushPlayQueue()).
   */
  public queuePlay(request: CardPlayRequest): void {
    this.inner.queuePlay(request);
  }

  /**
   * Immediately attempt to play a card (bypasses tick queue).
   * Used for REACTIVE and COUNTER_WINDOW cards requiring immediate processing.
   */
  public playImmediate(request: CardPlayRequest): boolean {
    return this.inner.playImmediate(request);
  }

  /**
   * Hold a card (Empire/GO_ALONE mode only).
   * No-ops and returns false in all other modes.
   */
  public holdCard(instanceId: string): boolean {
    return this.inner.holdCard(instanceId);
  }

  /**
   * Release the held card slot (Empire/GO_ALONE mode only).
   * Returns the released card or null if no hold slot is active.
   */
  public releaseHold(): CardInHand | null {
    return this.inner.releaseHold();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // READ-ONLY ACCESSORS (delegation for diagnostics and UI)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get the current hand for UI rendering.
   * Returns CardInHand[] — the full card objects in the player's hand.
   */
  public getHandSnapshot(): CardInHand[] {
    return this.inner.getHandSnapshot();
  }

  /**
   * Current battle budget (Predator/HEAD_TO_HEAD mode only).
   * 0 in all other modes.
   */
  public getBattleBudget(): number {
    return this.inner.getBattleBudget();
  }

  /**
   * Number of cards remaining in the draw deck.
   * Used by HUD and game-over detection.
   */
  public getDeckRemaining(): number {
    return this.inner.getDeckRemaining();
  }

  /**
   * The defection step history for this run (Syndicate/TEAM_UP mode only).
   */
  public getDefectionHistory(): import('./types').DefectionStep[] {
    return this.inner.getDefectionHistory();
  }

  /**
   * Engine health — mirrored from the inner CardEngine.
   * The adapter itself does not track health; CardEngine._health is the source.
   */
  public getHealth(): EngineHealth {
    return this.inner.getHealth();
  }

  /**
   * The GameMode resolved during init() — available for diagnostics after startRun().
   * Null before init() is called.
   */
  public getResolvedGameMode(): GameMode | null {
    return this.resolvedGameMode;
  }
}

// ── MODE-SPECIFIC CONSTANTS ───────────────────────────────────────────────────

/**
 * Battle budget pool for Predator (HEAD_TO_HEAD) mode.
 * Bots spend from this pool when executing attacks. Player earns budget per tick.
 * Value derived from Game Mode Bible v2 Predator configuration.
 */
const PREDATOR_BATTLE_BUDGET_MAX = 100;