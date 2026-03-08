// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — CARD ENGINE
// frontend/packages/engine/src/cards/CardEngine.ts
//
// The master engine class. Implements IEngine API surface (engineId, getName,
// getHealth). Instantiates all sub-components. Runs the per-tick card sequence.
// Exposes CardReader interface for cross-engine reads.
// The public API consumed by EngineOrchestrator via CardEngineAdapter.
//
// Density6 LLC · Point Zero One · Cards Engine · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import {
  GameMode,
  DefectionStep,
  DEFECTION_CORD_PENALTY,
  MAX_HAND_SIZE,
  BATTLE_BUDGET_CONFIG,
  type CardInHand,
  type CardPlayRequest,
  type CardEngineInitParams,
  type CardReader,
  type DecisionRecord,
  type PhaseBoundaryWindow,
  type ForcedCardEntry,
  type CardEffectResult,
  TimingClass,
} from './types';

import { DeckBuilder, DrawCursor } from './DeckBuilder';
import { HandManager, DiscardReason } from './HandManager';
import { ModeOverlayEngine } from './ModeOverlayEngine';
import { TimingValidator, type EngineStateSnapshot } from './TimingValidator';
import { CardEffectResolver } from './CardEffectResolver';
import { DecisionWindowManager } from './DecisionWindowManager';
import { ForcedCardQueue } from './ForcedCardQueue';
import { CardScorer } from './CardScorer';
import { CardUXBridge } from './CardUXBridge';
import type { EventBus } from '../zero/EventBus';
import { EngineId, EngineHealth } from '../zero/types';

// ── PERFORMANCE TIMER ─────────────────────────────────────────────────────────
const perfNow = (): number =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();

// ═══════════════════════════════════════════════════════════════════════════════
// CARD ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

export class CardEngine {
  // ── IEngine API surface ────────────────────────────────────────────────────
  public readonly engineId: EngineId = EngineId.CARD;
  private _health: EngineHealth = EngineHealth.REGISTERED;

  // ── Sub-components ────────────────────────────────────────────────────────
  private handManager: HandManager;
  private overlayEngine: ModeOverlayEngine;
  private timingValidator: TimingValidator;
  private effectResolver: CardEffectResolver;
  private windowManager: DecisionWindowManager;
  private forcedCardQueue: ForcedCardQueue;
  private scorer: CardScorer;
  private uxBridge: CardUXBridge;

  // ── Config ────────────────────────────────────────────────────────────────
  private params!: CardEngineInitParams;
  private mode!: GameMode;
  private maxHandSize = 5;
  private readonly eventBus: EventBus;

  // ── Run state ─────────────────────────────────────────────────────────────
  private isRunning = false;
  private currentTick = 0;
  private lastTickMs = 0;

  // ── Decision records accumulated this tick ────────────────────────────────
  private decisionsThisTick: DecisionRecord[] = [];

  // ── Timing / mode-window context ──────────────────────────────────────────
  private counterWindowOpen = false;
  private counterWindowAttackId: string | null = null;
  private counterWindowEndMs = 0;
  private counterWindowOpenedTick: number | null = null;

  private rescueWindowOpen = false;
  private rescueWindowTeammate: string | null = null;
  private rescueWindowEndMs = 0;
  private rescueWindowOpenedTick: number | null = null;

  private phaseBoundaryWindow: PhaseBoundaryWindow | null = null;
  private sovereigntyWindowOpen = false;
  private sovereigntyDecisionPlayed = false;

  // ── Predator: Battle Budget ───────────────────────────────────────────────
  private battleBudget = 0;

  // ── Syndicate: Defection tracking ────────────────────────────────────────
  private defectionStepHistory: DefectionStep[] = [];
  private lastDefectionTick = -1;

  // ── Last played card ref (CardReader) ─────────────────────────────────────
  private lastPlayedCard: CardInHand | null = null;

  // ── Unsubscribe handles ───────────────────────────────────────────────────
  private unsubCounterWindow: (() => void) | null = null;
  private unsubRescueWindow: (() => void) | null = null;

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTOR
  // ═══════════════════════════════════════════════════════════════════════════

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;

    this.handManager = null as any;
    this.overlayEngine = null as any;
    this.timingValidator = null as any;
    this.effectResolver = null as any;
    this.windowManager = null as any;
    this.forcedCardQueue = null as any;
    this.scorer = null as any;
    this.uxBridge = null as any;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IENGINE API SURFACE
  // ═══════════════════════════════════════════════════════════════════════════

  public getName(): string {
    return 'CardEngine';
  }

  public getHealth(): EngineHealth {
    return this._health;
  }

  public setHealth(health: EngineHealth): void {
    this._health = health;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  public init(params: CardEngineInitParams): void {
    this.params = params;
    this.mode = params.gameMode;
    this.maxHandSize = MAX_HAND_SIZE[this.mode];
    this._health = EngineHealth.INITIALIZED;
    this.sovereigntyDecisionPlayed = false;

    if (params.battleBudgetMax !== undefined) {
      this.battleBudget = 0;
    }

    this.overlayEngine = new ModeOverlayEngine(this.mode);
    this.handManager = new HandManager(this.mode, this.maxHandSize, this.overlayEngine);
    this.timingValidator = new TimingValidator();
    this.effectResolver = new CardEffectResolver(this.eventBus);
    this.windowManager = new DecisionWindowManager(params.decisionWindowMs);
    this.forcedCardQueue = new ForcedCardQueue(this.eventBus, this.overlayEngine);
    this.scorer = new CardScorer();
    this.uxBridge = new CardUXBridge(this.eventBus);

    const deckBuilder = new DeckBuilder(params.seed);
    const deckResult = deckBuilder.buildDeck(this.mode);
    const cursor = new DrawCursor(deckResult);
    this.handManager.attachDeck(cursor);

    this.forcedCardQueue.init();
    this.subscribeToModeEvents();
  }

  public startRun(): void {
    this.isRunning = true;
    this.currentTick = 0;
    this.lastTickMs = perfNow();

    for (let i = 0; i < this.maxHandSize; i += 1) {
      this.drawAndRegister(0);
    }
  }

  public endRun(): void {
    this.isRunning = false;

    try { this.forcedCardQueue?.destroy?.(); } catch {}
    try { this.unsubCounterWindow?.(); } catch {}
    try { this.unsubRescueWindow?.(); } catch {}
    try { this.windowManager?.reset?.(); } catch {}

    this.unsubCounterWindow = null;
    this.unsubRescueWindow = null;

    this.clearCounterWindow();
    this.clearRescueWindow();
    this.phaseBoundaryWindow = null;
    this.sovereigntyWindowOpen = false;
    this.sovereigntyDecisionPlayed = false;

    this._health = EngineHealth.REGISTERED;
  }

  public reset(): void {
    try { this.handManager?.reset?.(); } catch {}
    try { this.windowManager?.reset?.(); } catch {}
    try { this.forcedCardQueue?.reset?.(); } catch {}

    try { this.unsubCounterWindow?.(); } catch {}
    try { this.unsubRescueWindow?.(); } catch {}

    this.unsubCounterWindow = null;
    this.unsubRescueWindow = null;

    this.decisionsThisTick = [];
    this.isRunning = false;
    this.currentTick = 0;
    this.lastTickMs = 0;

    this.clearCounterWindow();
    this.clearRescueWindow();
    this.phaseBoundaryWindow = null;
    this.sovereigntyWindowOpen = false;
    this.sovereigntyDecisionPlayed = false;

    this.battleBudget = 0;
    this.defectionStepHistory = [];
    this.lastDefectionTick = -1;
    this.lastPlayedCard = null;

    this._health = EngineHealth.REGISTERED;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PER-TICK SEQUENCE
  // ═══════════════════════════════════════════════════════════════════════════

  public tick(tickIndex: number): DecisionRecord[] {
    if (!this.isRunning) return [];

    this.currentTick = tickIndex;
    this.decisionsThisTick = [];

    const now = perfNow();
    const elapsedMs = now - this.lastTickMs;
    this.lastTickMs = now;

    // Expire ephemeral mode windows first so validator state is accurate.
    this.expireEphemeralModeWindows(now, tickIndex);

    // Step A: advance decision window timers
    this.windowManager.advanceTick(elapsedMs, tickIndex);

    // Step B: flush expired windows → auto-resolve
    const expired = this.windowManager.flushExpired();
    for (const exp of expired) {
      const card = this.handManager.getCard(exp.cardInstanceId);
      if (!card) continue;

      this.uxBridge.emitDecisionWindowExpired(exp, tickIndex);
      this.uxBridge.emitCardAutoResolved(card, exp.autoChoice, exp.speedScore, tickIndex);

      const autoEffectResult = this.effectResolver.resolve(
        card,
        {
          instanceId: card.instanceId,
          choiceId: exp.autoChoice,
          timestamp: Date.now(),
        } as CardPlayRequest,
        tickIndex,
        false,
      );

      const record = this.scorer.scoreAutoResolved(card, exp, autoEffectResult, tickIndex);
      this.decisionsThisTick.push(record);

      this.handManager.removeCard(card.instanceId, DiscardReason.AUTO_RESOLVED);

      if (card.isForced) {
        this.forcedCardQueue.resolveByCardId(card.definition.cardId, tickIndex);
        const entry = this.findForcedEntry(card.definition.cardId);
        if (entry) {
          this.uxBridge.emitForcedCardResolved(entry, card, tickIndex);
        }
      }
    }

    // Step C: process forced card injections
    const injections = this.forcedCardQueue.processTick(tickIndex);

    // Step D: inject forced cards into hand + open windows
    for (const { card, entry } of injections) {
      this.handManager.injectCard(card);

      const windowResult = this.windowManager.openWindow(
        card,
        tickIndex,
        'AUTO_WORST',
        undefined,
      );

      if (!windowResult.skipped) {
        this.patchCardWindowId(card.instanceId, windowResult.windowId);
        const window = this.windowManager.getWindowById(windowResult.windowId);
        if (window) {
          this.uxBridge.emitDecisionWindowOpened(window, tickIndex);
        }
      }

      this.uxBridge.emitForcedCardInjected(entry, card, tickIndex);
    }

    // Step E: flush play queue → validate + resolve
    const playRequests = this.handManager.flushPlayQueue();
    for (const request of playRequests) {
      this.processPlayRequest(request, tickIndex);
    }

    // Step F: flush resolved windows → emit resolution event
    const resolved = this.windowManager.flushResolved();
    for (const res of resolved) {
      const card = this.lastPlayedCard;
      if (!card) continue;
      this.uxBridge.emitDecisionWindowResolved(res, true, tickIndex);
    }

    // Step G: replenish hand
    while (this.handManager.hasRoomForDraw()) {
      const drawn = this.drawAndRegister(tickIndex);
      if (!drawn) break;
    }

    // Step H: snapshot
    this.uxBridge.emitHandSnapshot(
      this.handManager.getHandSize(),
      this.handManager.getForcedCards().length,
      this.windowManager.getActiveWindowCount(),
      tickIndex,
    );

    // Predator: regen battle budget
    if (this.mode === GameMode.HEAD_TO_HEAD) {
      this.battleBudget = Math.min(
        BATTLE_BUDGET_CONFIG.MAX,
        this.battleBudget + BATTLE_BUDGET_CONFIG.REGEN_PER_TICK,
      );
    }

    return [...this.decisionsThisTick];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PLAY A CARD
  // ═══════════════════════════════════════════════════════════════════════════

  public queuePlay(request: CardPlayRequest): void {
    this.handManager.queuePlay(request);
  }

  public playImmediate(request: CardPlayRequest): boolean {
    const card = this.handManager.getCard(request.instanceId);
    if (!card) return false;
    return this.processPlayRequest(request, this.currentTick) !== null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HOLD SYSTEM (Empire only)
  // ═══════════════════════════════════════════════════════════════════════════

  public holdCard(instanceId: string): boolean {
    if (this.mode !== GameMode.GO_ALONE) return false;

    const card = this.handManager.getCard(instanceId);
    if (!card) return false;

    const remainingMs = this.windowManager.getRemainingMs(instanceId);
    const held = this.handManager.holdCard(instanceId, remainingMs, this.currentTick);

    if (held) {
      this.windowManager.pauseWindow(instanceId);
      this.uxBridge.emitCardHeld(card, remainingMs, this.currentTick);
    }

    return held;
  }

  public releaseHold(): CardInHand | null {
    const slot = this.handManager.releaseHold();
    if (!slot) return null;

    this.windowManager.resumeWindow(slot.card.instanceId);
    this.uxBridge.emitCardUnheld(slot.card, this.currentTick);
    return slot.card;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CARD READER INTERFACE
  // ═══════════════════════════════════════════════════════════════════════════

  public getReader(): CardReader {
    return {
      getHandSize: () => this.handManager.getHandSize(),
      getForcedCardCount: () => this.handManager.getForcedCards().length,
      getActiveThreatCardCount: () => this.forcedCardQueue.getActiveCount(),
      getDecisionWindowsActive: () => this.windowManager.getActiveWindowCount(),
      getHoldsRemaining: () => this.handManager.getHoldsRemaining(),
      getMissedOpportunityStreak: () => this.handManager.getMissedOpportunityStreak(),
      getLastPlayedCard: () => this.lastPlayedCard,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: PROCESS PLAY REQUEST
  // ═══════════════════════════════════════════════════════════════════════════

  private processPlayRequest(
    request: CardPlayRequest,
    tickIndex: number,
  ): DecisionRecord | null {
    const card = this.handManager.getCard(request.instanceId);
    if (!card) return null;

    const ctx = this.buildValidatorContext();
    const validity = this.timingValidator.validate(card, ctx, request as any);

    if (!validity.valid) {
      console.warn(`[CardEngine] Play rejected: ${validity.reason}`);
      return null;
    }

    const windowRecord = this.windowManager.resolveWindow(
      card.instanceId,
      request.choiceId,
      tickIndex,
    );

    const hand = this.handManager.getHandArray();
    const isOptimal = this.isOptimalPlay(card, hand);

    const effectResult = this.effectResolver.resolve(card, request, tickIndex, isOptimal);

    let record: DecisionRecord;
    if (windowRecord) {
      record = this.scorer.scoreResolvedPlay(card, windowRecord, effectResult, hand, tickIndex);
    } else {
      const syntheticWindow = {
        windowId: '',
        cardInstanceId: card.instanceId,
        cardId: card.definition.cardId,
        choiceId: request.choiceId,
        openedAtMs: request.timestamp,
        resolvedAtMs: request.timestamp,
        resolvedInMs: 0,
        durationMs: 0,
        speedScore: 1.0,
        resolvedAtTick: tickIndex,
      };
      record = this.scorer.scoreResolvedPlay(card, syntheticWindow, effectResult, hand, tickIndex);
    }

    this.decisionsThisTick.push(record);

    this.handleModeSpecificPlay(card, request, effectResult, tickIndex);

    this.handManager.removeCard(card.instanceId, DiscardReason.PLAYED);
    this.lastPlayedCard = card;

    this.uxBridge.emitCardPlayed(card, effectResult, record, tickIndex);

    return record;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: MODE-SPECIFIC PLAY HOOKS
  // ═══════════════════════════════════════════════════════════════════════════

  private handleModeSpecificPlay(
    card: CardInHand,
    request: CardPlayRequest,
    effectResult: CardEffectResult,
    tickIndex: number,
  ): void {
    if (card.definition.timingClass === TimingClass.DEFECTION_STEP) {
      const cardId = card.definition.cardId;
      let step: DefectionStep | null = null;

      if (cardId === 'def_break_pact_001') step = DefectionStep.BREAK_PACT;
      if (cardId === 'def_silent_exit_002') step = DefectionStep.SILENT_EXIT;
      if (cardId === 'def_asset_seizure_003') step = DefectionStep.ASSET_SEIZURE;

      if (step) {
        this.defectionStepHistory.push(step);
        this.lastDefectionTick = tickIndex;
        this.uxBridge.emitDefectionStepPlayed(step, this.params.userId, tickIndex);

        if (step === DefectionStep.ASSET_SEIZURE) {
          this.uxBridge.emitDefectionCompleted(
            this.params.userId,
            DEFECTION_CORD_PENALTY,
            tickIndex,
          );
        }
      }
    }

    if (card.definition.timingClass === TimingClass.BLUFF) {
      const displayedAs = request.choiceId ?? card.definition.cardId;
      this.uxBridge.emitBluffCardDisplayed(card, displayedAs, tickIndex);
    }

    if (
      card.definition.timingClass === TimingClass.COUNTER_WINDOW &&
      this.counterWindowOpen &&
      this.counterWindowAttackId
    ) {
      this.uxBridge.emitCounterWindowClosed(this.counterWindowAttackId, true, tickIndex);
      this.clearCounterWindow();
    }

    if (
      card.definition.timingClass === TimingClass.RESCUE_WINDOW &&
      this.rescueWindowOpen &&
      this.rescueWindowTeammate
    ) {
      this.uxBridge.emitRescueWindowClosed(
        this.rescueWindowTeammate,
        true,
        1,
        tickIndex,
      );
      this.clearRescueWindow();
    }

    if (card.definition.timingClass === TimingClass.SOVEREIGNTY_DECISION) {
      this.sovereigntyDecisionPlayed = true;
      this.sovereigntyWindowOpen = false;
    }

    if (card.definition.deckType === 'GHOST') {
      const markerType = this.resolveGhostMarkerType(card);
      const divDelta = effectResult.totalCordDelta;
      this.uxBridge.emitGhostCardActivated(card, markerType, divDelta, tickIndex);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: DRAW + REGISTER WINDOW
  // ═══════════════════════════════════════════════════════════════════════════

  private drawAndRegister(tickIndex: number): CardInHand | null {
    const result = this.handManager.draw(tickIndex);
    if (!result.drawn) return null;

    const card = result.drawn;

    const windowResult = this.windowManager.openWindow(
      card,
      tickIndex,
      'AUTO_WORST',
    );

    if (!windowResult.skipped) {
      this.patchCardWindowId(card.instanceId, windowResult.windowId);
      const window = this.windowManager.getWindowById(windowResult.windowId);
      if (window) {
        this.uxBridge.emitDecisionWindowOpened(window, tickIndex);
      }
    }

    this.uxBridge.emitCardDrawn(card, tickIndex);
    return card;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private patchCardWindowId(instanceId: string, windowId: string): void {
    const card = this.handManager.getCard(instanceId);
    if (!card) return;

    const patched: CardInHand = { ...card, decisionWindowId: windowId };
    this.handManager.injectCard(patched);
  }

  private buildValidatorContext(): EngineStateSnapshot {
    const hasActiveDecisionWindow = this.windowManager.getActiveWindowCount() > 0;

    return {
      currentTick: this.currentTick,
      activeDecisionWindowOpen: hasActiveDecisionWindow,
      activeDecisionWindowOpenAt: hasActiveDecisionWindow ? this.currentTick : null,
      opponentExtractionEventAt: this.counterWindowOpen
        ? (this.counterWindowOpenedTick ?? this.currentTick)
        : null,
      teammateInCritical: this.rescueWindowOpen,
      phaseTransitionWindowOpen: this.isPhaseTransitionWindowOpen(),
      sovereigntyWindowOpen: this.sovereigntyWindowOpen,
      sovereigntyDecisionPlayed: this.sovereigntyDecisionPlayed,
      defectionArcState: {
        step: this.getDefectionArcStep(),
        lastStepAt: this.lastDefectionTick >= 0 ? this.lastDefectionTick : null,
      },
      divergenceScore: 0,
      divergenceThreshold: this.getDivergenceThreshold(),
      battleBudget: this.battleBudget,
      currentPhase: this.resolveCurrentPhaseOrdinal(),
      gameMode: this.mode,
    };
  }

  private isOptimalPlay(played: CardInHand, hand: CardInHand[]): boolean {
    const playableCosts = hand
      .filter((c) => !c.isHeld)
      .map((c) => c.effectiveCost);

    if (playableCosts.length === 0) {
      return true;
    }

    const maxCost = Math.max(...playableCosts);
    return played.effectiveCost >= maxCost;
  }

  private findForcedEntry(cardId: string): ForcedCardEntry | null {
    const entries = this.forcedCardQueue.getUnresolvedEntries();
    return entries.find((entry) => entry.cardId === cardId) ?? null;
  }

  private resolveGhostMarkerType(card: CardInHand): any {
    const map: Record<string, any> = {
      ghost_gold_read_001: 'GOLD',
      ghost_red_exploit_002: 'RED',
    };

    return map[card.definition.cardId] ?? 'GOLD';
  }

  private subscribeToModeEvents(): void {
    if (this.mode === GameMode.HEAD_TO_HEAD) {
      this.unsubCounterWindow = this.eventBus.on<any>(
        'EXTRACTION_ACTION_FIRED' as any,
        (event) => {
          const payload = event.payload;
          this.counterWindowOpen = true;
          this.counterWindowAttackId = payload.attackId;
          this.counterWindowOpenedTick = this.currentTick;
          this.counterWindowEndMs = perfNow() + 5_000;
          this.uxBridge.emitCounterWindowOpened(payload.attackId, 5_000, this.currentTick);
        },
      );
    }

    if (this.mode === GameMode.TEAM_UP) {
      this.unsubRescueWindow = this.eventBus.on<any>(
        'TEAMMATE_PRESSURE_CRITICAL' as any,
        (event) => {
          const payload = event.payload;
          this.rescueWindowOpen = true;
          this.rescueWindowTeammate = payload.teammateId;
          this.rescueWindowOpenedTick = this.currentTick;
          this.rescueWindowEndMs = perfNow() + 15_000;
          this.uxBridge.emitRescueWindowOpened(payload.teammateId, 15_000, this.currentTick);
        },
      );
    }
  }

  private expireEphemeralModeWindows(now: number, tickIndex: number): void {
    if (this.counterWindowOpen && this.counterWindowEndMs > 0 && now >= this.counterWindowEndMs) {
      const attackId = this.counterWindowAttackId;
      this.clearCounterWindow();

      if (attackId) {
        this.uxBridge.emitCounterWindowClosed(attackId, false, tickIndex);
      }
    }

    if (this.rescueWindowOpen && this.rescueWindowEndMs > 0 && now >= this.rescueWindowEndMs) {
      const teammateId = this.rescueWindowTeammate;
      this.clearRescueWindow();

      if (teammateId) {
        this.uxBridge.emitRescueWindowClosed(teammateId, false, 0, tickIndex);
      }
    }
  }

  private clearCounterWindow(): void {
    this.counterWindowOpen = false;
    this.counterWindowAttackId = null;
    this.counterWindowEndMs = 0;
    this.counterWindowOpenedTick = null;
  }

  private clearRescueWindow(): void {
    this.rescueWindowOpen = false;
    this.rescueWindowTeammate = null;
    this.rescueWindowEndMs = 0;
    this.rescueWindowOpenedTick = null;
  }

  private isPhaseTransitionWindowOpen(): boolean {
    if (!this.phaseBoundaryWindow) {
      return false;
    }

    return (
      !this.phaseBoundaryWindow.isConsumed &&
      this.currentTick <= this.phaseBoundaryWindow.closesAtTick
    );
  }

  private getDefectionArcStep(): 0 | 1 | 2 {
    if (this.defectionStepHistory.indexOf(DefectionStep.SILENT_EXIT) !== -1) {
      return 2;
    }

    if (this.defectionStepHistory.indexOf(DefectionStep.BREAK_PACT) !== -1) {
      return 1;
    }

    return 0;
  }

  private resolveCurrentPhaseOrdinal(): 1 | 2 | 3 | 4 {
    const totalTicks = Math.max(1, this.params?.seasonTickBudget ?? 1);
    const phaseOneEnd = Math.max(1, Math.floor(totalTicks / 3));
    const phaseTwoEnd = Math.max(phaseOneEnd + 1, Math.floor((totalTicks * 2) / 3));

    if (this.currentTick < phaseOneEnd) return 1;
    if (this.currentTick < phaseTwoEnd) return 2;
    if (this.currentTick < totalTicks) return 3;
    return 4;
  }

  private getDivergenceThreshold(): number {
    // Fail-closed until Phantom divergence state is wired into CardEngine.
    if (this.mode !== GameMode.CHASE_A_LEGEND) {
      return 0;
    }

    return 1;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCESSORS
  // ═══════════════════════════════════════════════════════════════════════════

  public getHandSnapshot(): CardInHand[] {
    return this.handManager.getHandArray();
  }

  public getBattleBudget(): number {
    return this.battleBudget;
  }

  public getDeckRemaining(): number {
    return this.handManager.getDeckRemaining();
  }

  public getDefectionHistory(): DefectionStep[] {
    return [...this.defectionStepHistory];
  }
}