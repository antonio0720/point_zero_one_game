// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — CARD ENGINE
// pzo-web/src/engines/cards/CardEngine.ts
//
// The master engine class. Implements IEngine API surface (engineId, getName,
// getHealth). Instantiates all sub-components. Runs the per-tick card sequence.
// Exposes CardReader interface for cross-engine reads.
// The public API consumed by EngineOrchestrator via CardEngineAdapter.
//
// PHASE 1 CHANGES:
//   ✦ engineId: EngineId = EngineId.CARD — satisfies IEngine.engineId contract.
//   ✦ _health: EngineHealth — internal health state, updated by init() and reset().
//   ✦ getName(): string — engine identification for diagnostics.
//   ✦ getHealth(): EngineHealth — expose health state for CardEngineAdapter.
//   ✦ setHealth() — called by CardEngineAdapter to propagate registry health.
//   ✦ Constructor now accepts EventBus — matching the pattern of all other engines.
//     eventBus is no longer a parameter of init(); it is set at construction time.
//     init() now takes only CardEngineInitParams (single argument).
//   ✦ getReader() — CardReader.getLastPlayedCardId() added (replaces getLastPlayedCard()
//     which returned CardInHand; zero/types.ts CardReader only needs the cardId string).
//
// PER-TICK CARD SEQUENCE (called by CardEngineAdapter → EngineOrchestrator Step 1.5):
//   Step A: Advance decision window timers (real elapsed ms)
//   Step B: Flush expired windows → trigger auto-resolve
//   Step C: Process forced card injections from ForcedCardQueue
//   Step D: Inject materialized forced cards into hand + open their windows
//   Step E: Flush pending play queue → validate + resolve each card play
//   Step F: Flush resolved windows → score decisions
//   Step G: Replenish hand to maxHandSize if deck has cards
//   Step H: Emit CARD_HAND_SNAPSHOT
//
// ENGINE ARCHITECTURE:
//   - CardEngine owns all 8 sub-components (instantiates + holds references).
//   - Mode handlers (EmpireCardMode etc.) are injected at init if available.
//   - CardEngine is the ONLY file allowed to call HandManager, ModeOverlayEngine,
//     TimingValidator, CardEffectResolver, DecisionWindowManager, ForcedCardQueue,
//     CardScorer, and CardUXBridge directly.
//   - No other engine may import CardEngine. They use CardReader.
//
// RULES:
//   ✦ CardEngine never imports from features/, store/, or zero/EngineOrchestrator.
//   ✦ Cross-engine effects fire via EventBus (CardEffectResolver).
//   ✦ CardEngine reads other engines only through injected Reader interfaces.
//   ✦ lastTickMs is wall-clock time from performance.now() — never game tick count.
//
// Density6 LLC · Point Zero One · Cards Engine · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import {
  GameMode,
  DefectionStep,
  DEFECTION_CORD_PENALTY,
  MAX_HAND_SIZE,
  type CardInHand,
  type CardPlayRequest,
  type CardEngineInitParams,
  type DecisionRecord,
  type PhaseBoundaryWindow,
  type ForcedCardEntry,
  TimingClass,
  RunPhase,
} from './types';

import { DeckBuilder, DrawCursor }     from './DeckBuilder';
import { HandManager, DiscardReason }  from './HandManager';
import { ModeOverlayEngine }           from './ModeOverlayEngine';
import { TimingValidator }             from './TimingValidator';
import type { EngineStateSnapshot }    from './TimingValidator';
import { CardEffectResolver }          from './CardEffectResolver';

class CardEffectsExecutor {
  private resolver: CardEffectResolver;
  constructor(resolver: CardEffectResolver) {
    this.resolver = resolver;
  }

  public executeOne(params: any): any {
    const r: any = this.resolver as any;
    if (typeof r.executeOne === 'function') return r.executeOne(params);
    if (typeof r.execute === 'function') return r.execute(params);
    if (typeof r.resolve === 'function') return r.resolve(params);
    throw new Error('CardEffectResolver does not expose an execute method');
  }
}

import { DecisionWindowManager }       from './DecisionWindowManager';
import { ForcedCardQueue }             from './ForcedCardQueue';
import { CardScorer }                  from './CardScorer';
import { CardUXBridge }                from './CardUXBridge';
import type { EventBus }               from '../zero/EventBus';
import { EngineId, EngineHealth }      from '../zero/types';

// ── PERFORMANCE TIMER ─────────────────────────────────────────────────────────
const perfNow = (): number =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();

// ═══════════════════════════════════════════════════════════════════════════════
// CARD ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

export class CardEngine {
  public readonly engineId: EngineId = EngineId.CARD;
  private _health: EngineHealth = EngineHealth.REGISTERED;

  private handManager:     HandManager;
  private overlayEngine:   ModeOverlayEngine;
  private timingValidator: TimingValidator;
  private effectResolver:  CardEffectResolver;
  private effectsExecutor: CardEffectsExecutor;
  private windowManager:   DecisionWindowManager;
  private forcedCardQueue: ForcedCardQueue;
  private scorer:          CardScorer;
  private uxBridge:        CardUXBridge;

  private params!:     CardEngineInitParams;
  private mode!:       GameMode;
  private maxHandSize: number = 5;

  private readonly eventBus: EventBus;

  private isRunning:   boolean = false;
  private currentTick: number  = 0;
  private lastTickMs:  number  = 0;

  private decisionsThisTick: DecisionRecord[] = [];

  private counterWindowOpen:     boolean       = false;
  private counterWindowAttackId: string | null = null;
  private counterWindowEndMs:    number        = 0;

  private rescueWindowOpen:     boolean       = false;
  private rescueWindowTeammate: string | null = null;
  private rescueWindowEndMs:    number        = 0;

  private phaseBoundaryWindow:   PhaseBoundaryWindow | null = null;
  private sovereigntyWindowOpen: boolean = false;

  private battleBudget: number = 0;

  private defectionStepHistory: DefectionStep[] = [];
  private lastDefectionTick:    number          = -1;

  private lastPlayedCard: CardInHand | null = null;

  private unsubCounterWindow: (() => void) | null = null;
  private unsubRescueWindow:  (() => void) | null = null;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;

    this.handManager     = null as any;
    this.overlayEngine   = null as any;
    this.timingValidator = null as any;
    this.effectResolver  = null as any;
    this.effectsExecutor = null as any;
    this.windowManager   = null as any;
    this.forcedCardQueue = null as any;
    this.scorer          = null as any;
    this.uxBridge        = null as any;
  }

  public getName(): string {
    return 'CardEngine';
  }

  public getHealth(): EngineHealth {
    return this._health;
  }

  public setHealth(health: EngineHealth): void {
    this._health = health;
  }

  public init(params: CardEngineInitParams): void {
    this.params      = params;
    this.mode        = params.gameMode;
    this.maxHandSize = MAX_HAND_SIZE[this.mode];
    this._health     = EngineHealth.INITIALIZED;

    if (params.battleBudgetMax !== undefined) {
      this.battleBudget = 0;
    }

    this.overlayEngine   = new ModeOverlayEngine(this.mode);
    this.handManager     = new HandManager(this.mode, this.maxHandSize, this.overlayEngine);
    this.timingValidator = new TimingValidator();

    this.effectResolver  = new CardEffectResolver(this.eventBus);
    this.effectsExecutor = new CardEffectsExecutor(this.effectResolver);

    this.windowManager   = new DecisionWindowManager(params.decisionWindowMs);
    this.forcedCardQueue = new ForcedCardQueue(this.eventBus, this.overlayEngine);
    this.scorer          = new CardScorer();
    this.uxBridge        = new CardUXBridge(this.eventBus);

    const deckBuilder = new DeckBuilder(params.seed);
    const deckResult  = deckBuilder.buildDeck(this.mode);
    const cursor      = new DrawCursor(deckResult);

    this.handManager.attachDeck(cursor);
    this.forcedCardQueue.init();
    this.subscribeToModeEvents();
  }

  public startRun(): void {
    this.isRunning   = true;
    this.currentTick = 0;
    this.lastTickMs  = perfNow();

    for (let i = 0; i < this.maxHandSize; i++) {
      this.drawAndRegister(0);
    }
  }

  public endRun(): void {
    this.isRunning = false;
    this.forcedCardQueue.destroy();
    this.unsubCounterWindow?.();
    this.unsubRescueWindow?.();
    this.windowManager.reset();
    this._health = EngineHealth.REGISTERED;
  }

  public reset(): void {
    this.handManager.reset();
    this.windowManager.reset();
    this.forcedCardQueue.reset();
    this.decisionsThisTick     = [];
    this.isRunning             = false;
    this.currentTick           = 0;
    this.lastTickMs            = 0;
    this.counterWindowOpen     = false;
    this.rescueWindowOpen      = false;
    this.phaseBoundaryWindow   = null;
    this.sovereigntyWindowOpen = false;
    this.battleBudget          = 0;
    this.defectionStepHistory  = [];
    this.lastDefectionTick     = -1;
    this.lastPlayedCard        = null;
    this._health               = EngineHealth.REGISTERED;
  }

  public tick(tickIndex: number): DecisionRecord[] {
    if (!this.isRunning) return [];

    this.currentTick       = tickIndex;
    this.decisionsThisTick = [];

    const now       = perfNow();
    const elapsedMs = now - this.lastTickMs;
    this.lastTickMs = now;

    this.windowManager.advanceTick(elapsedMs, tickIndex);

    const expired = this.windowManager.flushExpired();
    for (const exp of expired) {
      const card = this.handManager.getCard(exp.cardInstanceId);
      if (!card) continue;

      this.uxBridge.emitDecisionWindowExpired(exp, tickIndex);
      this.uxBridge.emitCardAutoResolved(card, exp.autoChoice, exp.speedScore, tickIndex);

      const autoEffectResult = this.effectsExecutor.executeOne({
        card,
        request: {
          instanceId: card.instanceId,
          choiceId: exp.autoChoice,
          timestamp: Date.now(),
        },
        tickIndex,
        isOptimalChoice: false,
      });

      const record = this.scorer.scoreAutoResolved(card, exp, autoEffectResult, tickIndex);
      this.decisionsThisTick.push(record);

      this.handManager.removeCard(card.instanceId, DiscardReason.AUTO_RESOLVED);

      if (card.isForced) {
        this.forcedCardQueue.resolveByCardId(card.definition.cardId, tickIndex);
        const entry = this.findForcedEntry(card.definition.cardId);
        if (entry) this.uxBridge.emitForcedCardResolved(entry, card, tickIndex);
      }
    }

    const injections = this.forcedCardQueue.processTick(tickIndex);

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
        if (window) this.uxBridge.emitDecisionWindowOpened(window, tickIndex);
      }

      this.uxBridge.emitForcedCardInjected(entry, card, tickIndex);
    }

    const playRequests = this.handManager.flushPlayQueue();
    for (const request of playRequests) {
      this.processPlayRequest(request, tickIndex);
    }

    const resolved = this.windowManager.flushResolved();
    for (const res of resolved) {
      const card = this.lastPlayedCard;
      if (!card) continue;
      this.uxBridge.emitDecisionWindowResolved(res, true, tickIndex);
    }

    while (this.handManager.hasRoomForDraw()) {
      const drawn = this.drawAndRegister(tickIndex);
      if (!drawn) break;
    }

    this.uxBridge.emitHandSnapshot(
      this.handManager.getHandSize(),
      this.handManager.getForcedCards().length,
      this.windowManager.getActiveWindowCount(),
      tickIndex,
    );

    if (this.mode === GameMode.HEAD_TO_HEAD) {
      const { BATTLE_BUDGET_CONFIG } = require('./types');
      this.battleBudget = Math.min(
        BATTLE_BUDGET_CONFIG.MAX,
        this.battleBudget + BATTLE_BUDGET_CONFIG.REGEN_PER_TICK,
      );
    }

    return [...this.decisionsThisTick];
  }

  public queuePlay(request: CardPlayRequest): void {
    this.handManager.queuePlay(request);
  }

  public playImmediate(request: CardPlayRequest): boolean {
    const card = this.handManager.getCard(request.instanceId);
    if (!card) return false;
    return this.processPlayRequest(request, this.currentTick) !== null;
  }

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

  public getReader(): import('../zero/types').CardReader {
    return {
      getHandSize: () => this.handManager.getHandSize(),
      getForcedCardCount: () => this.handManager.getForcedCards().length,
      getActiveThreatCardCount: () => this.forcedCardQueue.getActiveCount(),
      getDecisionWindowsActive: () => this.windowManager.getActiveWindowCount(),
      getHoldsRemaining: () => this.handManager.getHoldsRemaining(),
      getMissedOpportunityStreak: () => this.handManager.getMissedOpportunityStreak(),
      getLastPlayedCardId: () => this.lastPlayedCard?.definition.cardId ?? null,
    };
  }

  private processPlayRequest(
    request: CardPlayRequest,
    tickIndex: number,
  ): DecisionRecord | null {
    const card = this.handManager.getCard(request.instanceId);
    if (!card) return null;

    const ctx      = this.buildValidatorContext();
    const validity = this.timingValidator.validate(card, ctx, request);

    if (!validity.valid) {
      console.warn(`[CardEngine] Play rejected: ${validity.reason}`);
      return null;
    }

    const windowRecord = this.windowManager.resolveWindow(
      card.instanceId,
      request.choiceId,
      tickIndex,
    );

    const hand      = this.handManager.getHandArray();
    const isOptimal = this.isOptimalPlay(card, hand);

    const effectResult = this.effectsExecutor.executeOne({
      card,
      request,
      tickIndex,
      isOptimalChoice: isOptimal,
    });

    let record: DecisionRecord;

    if (windowRecord) {
      record = this.scorer.scoreResolvedPlay(
        card,
        windowRecord,
        effectResult,
        hand,
        tickIndex,
      );
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

      record = this.scorer.scoreResolvedPlay(
        card,
        syntheticWindow,
        effectResult,
        hand,
        tickIndex,
      );
    }

    this.decisionsThisTick.push(record);
    this.handleModeSpecificPlay(card, request, effectResult, tickIndex);
    this.handManager.removeCard(card.instanceId, DiscardReason.PLAYED);
    this.lastPlayedCard = card;
    this.uxBridge.emitCardPlayed(card, effectResult, record, tickIndex);

    return record;
  }

  private handleModeSpecificPlay(
    card: CardInHand,
    request: CardPlayRequest,
    effectResult: any,
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

    if (card.definition.deckType === 'GHOST') {
      const markerType = this.resolveGhostMarkerType(card);
      const divDelta   = effectResult.totalCordDelta;
      this.uxBridge.emitGhostCardActivated(card, markerType, divDelta, tickIndex);
    }
  }

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
      if (window) this.uxBridge.emitDecisionWindowOpened(window, tickIndex);
    }

    this.uxBridge.emitCardDrawn(card, tickIndex);
    return card;
  }

  private patchCardWindowId(instanceId: string, windowId: string): void {
    const card = this.handManager.getCard(instanceId);
    if (!card) return;
    const patched: CardInHand = { ...card, decisionWindowId: windowId };
    this.handManager.injectCard(patched);
  }

  private buildValidatorContext(): EngineStateSnapshot {
    const defectionStep =
      this.defectionStepHistory.includes(DefectionStep.SILENT_EXIT) ||
      this.defectionStepHistory.includes(DefectionStep.ASSET_SEIZURE)
        ? 2
        : this.defectionStepHistory.includes(DefectionStep.BREAK_PACT)
          ? 1
          : 0;

    return {
      currentTick: this.currentTick,
      activeDecisionWindowOpen: this.windowManager.getActiveWindowCount() > 0,
      activeDecisionWindowOpenAt:
        this.windowManager.getActiveWindowCount() > 0 ? this.currentTick : null,

      opponentExtractionEventAt: this.counterWindowOpen ? this.currentTick : null,
      teammateInCritical: this.rescueWindowOpen,
      phaseTransitionWindowOpen:
        !!this.phaseBoundaryWindow &&
        !this.phaseBoundaryWindow.isConsumed &&
        this.currentTick <= this.phaseBoundaryWindow.closesAtTick,
      sovereigntyWindowOpen: this.sovereigntyWindowOpen,
      sovereigntyDecisionPlayed:
        this.lastPlayedCard?.definition.timingClass === TimingClass.SOVEREIGNTY_DECISION,

      defectionArcState: {
        step: defectionStep,
        lastStepAt: this.lastDefectionTick >= 0 ? this.lastDefectionTick : null,
      },

      divergenceScore: 0,
      divergenceThreshold: 0.5,
      battleBudget: this.battleBudget,
      currentPhase: this.resolveCurrentPhase(),
      gameMode: this.mode,
    };
  }

  private resolveCurrentPhase(): 1 | 2 | 3 | 4 {
    if (!this.phaseBoundaryWindow) {
      return this.sovereigntyWindowOpen ? 3 : 1;
    }

    switch (this.phaseBoundaryWindow.phase) {
      case RunPhase.FOUNDATION:
        return 1;
      case RunPhase.ESCALATION:
        return 2;
      case RunPhase.SOVEREIGNTY:
        return 3;
      default:
        return 1;
    }
  }

  private isOptimalPlay(played: CardInHand, hand: CardInHand[]): boolean {
    const playableCosts = hand
      .filter((c) => !c.isHeld)
      .map((c) => c.effectiveCost);

    const maxCost = Math.max(...playableCosts);
    return played.effectiveCost >= maxCost;
  }

  private findForcedEntry(cardId: string): ForcedCardEntry | null {
    const entries = this.forcedCardQueue.getUnresolvedEntries();
    return entries.find((e) => e.cardId === cardId) ?? null;
  }

  private resolveGhostMarkerType(card: CardInHand): any {
    const map: Record<string, any> = {
      'ghost_gold_read_001': 'GOLD',
      'ghost_red_exploit_002': 'RED',
    };
    return map[card.definition.cardId] ?? 'GOLD';
  }

  private subscribeToModeEvents(): void {
    if (this.mode === GameMode.HEAD_TO_HEAD) {
      this.unsubCounterWindow = this.eventBus.on<any>(
        'EXTRACTION_ACTION_FIRED' as any,
        (event) => {
          const payload = event.payload;
          this.counterWindowOpen     = true;
          this.counterWindowAttackId = payload.attackId;
          this.counterWindowEndMs    = perfNow() + 5_000;
          this.uxBridge.emitCounterWindowOpened(payload.attackId, 5_000, this.currentTick);
        },
      );
    }

    if (this.mode === GameMode.TEAM_UP) {
      this.unsubRescueWindow = this.eventBus.on<any>(
        'TEAMMATE_PRESSURE_CRITICAL' as any,
        (event) => {
          const payload = event.payload;
          this.rescueWindowOpen     = true;
          this.rescueWindowTeammate = payload.teammateId;
          this.rescueWindowEndMs    = perfNow() + 15_000;
          this.uxBridge.emitRescueWindowOpened(payload.teammateId, 15_000, this.currentTick);
        },
      );
    }
  }

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