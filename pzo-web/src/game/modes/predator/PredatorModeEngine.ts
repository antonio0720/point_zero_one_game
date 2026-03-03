// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/predator/PredatorModeEngine.ts
// Sprint 7 — Predator Mode Engine (new — master orchestrator)
//
// Single entry point for all Predator mode state.
// Called once per tick by the run loop (useRunLoop.ts).
//
// TICK SEQUENCE:
//   1. tickTempoChain() — expire stale chains
//   2. pruneExpiredCounterplayWindows() — auto-resolve timeouts
//   3. expireClaimWindows() — shared deck GC
//   4. decayPsyche() — passive psyche decay (both players)
//   5. Every battleRoundTicks: resetBBRound()
//   6. Every communityHeat interval: emit heat update
//   7. Publish PredatorRunState → PredatorGameScreen
//
// Output: PredatorRunState — consumed by PredatorGameScreen + BattleHUD.
//
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import { PREDATOR_CONFIG } from './predatorConfig';

import {
  type BattleBudgetState,
  INITIAL_BB_STATE,
  generateBB,
  spendBB,
  resetBBRound,
  canFireExtraction,
  isTempoChainActive,
  getTempoChainMultiplier,
  bbStateLabel,
  type BBGenerationInput,
  type BBSpendReason,
} from './battleBudgetEngine';

import {
  type ExtractionAction,
  type ExtractionType,
  type CounterplayAction,
  type CooldownRegistry,
  type ActiveExtractionTracker,
  INITIAL_COOLDOWN_REGISTRY,
  INITIAL_ACTIVE_TRACKER,
  buildExtractionAction,
  resolveExtraction,
  isExtractionOnCooldown,
  applyCooldown,
  canFireNewExtraction,
  trackExtractionFired,
  trackExtractionResolved,
  getCooldownTicksRemaining,
  getExtractionBBCost,
  type ExtractionParams,
} from './extractionEngine';

import {
  type CounterplayWindow,
  buildCounterplayWindow,
  resolveCounterplayWindow,
  expireCounterplayWindow,
  isWindowExpired,
  getCounterplayPsycheRelief,
  type CounterplayContext,
} from './counterplayWindowEngine';

import {
  type PsycheMeterState,
  INITIAL_PSYCHE_STATE,
  chargePsyche,
  decayPsyche,
  relievePsyche,
  psycheZone,
  psycheLabel,
  psycheZoneColor,
  tiltDrawPenalty,
} from './psycheMeter';

import {
  type RivalryState,
  INITIAL_RIVALRY_STATE,
  registerMatchResult,
  recordExtractionLanded,
  recordCounterplayBeat,
  pruneStaleRivalries,
  getRivalryAmplifier,
  isRivalryActive,
  rivalryTierScore,
} from './rivalryModel';

import {
  type SharedDeckState,
  INITIAL_SHARED_DECK,
  claimCard,
  expireClaimWindows,
  shouldGenerateCard,
  scheduleNextCardArrival,
  getUrgentCards,
  getTopDenyValueCard,
} from './sharedOpportunityDeck';

import {
  type TempoChainState,
  INITIAL_TEMPO_STATE,
  tickTempoChain,
  registerCardPlay,
  resetTempoChainRound,
  chainLabel,
  chainLabelColor,
} from './tempoChainTracker';

import {
  type PredatorCordBreakdown,
  computePredatorCord,
  cordScoreGrade,
  cordGradeColor,
} from './predatorCordCalculator';

import {
  emitExtractionFired,
  emitExtractionResolved,
  emitCounterplayOpened,
  emitCounterplayResolved,
  emitTiltActivated,
  emitTiltResolved,
  emitBBDepleted,
  emitBBRoundReset,
  emitRivalryTierChanged,
  emitTempoChainStarted,
  emitTempoChainBroke,
  emitDeckClaimed,
  emitDeckExpired,
} from './predatorEventBridge';

// ── Shared Run State ──────────────────────────────────────────────────────────

export interface PlayerPredatorState {
  bb:      BattleBudgetState;
  psyche:  PsycheMeterState;
  tempo:   TempoChainState;
}

export interface PredatorRunState {
  // Per-player state (local = this client, opponent = remote)
  local:    PlayerPredatorState;
  opponent: PlayerPredatorState;

  // Shared state
  rivalry:      RivalryState;
  sharedDeck:   SharedDeckState;
  cooldowns:    CooldownRegistry;
  activeTracker: ActiveExtractionTracker;

  // Active combat windows
  openWindows:  CounterplayWindow[];   // windows that are still PENDING response
  resolvedWindows: CounterplayWindow[]; // last 10 resolved (for log display)

  // Derived / display
  currentPhase: 'EARLY' | 'MID' | 'ENDGAME';
  cordSnapshot: PredatorCordBreakdown | null;

  // Run counters
  extractionsFired:     number;
  extractionsLanded:    number;
  counterplayWindows:   number;
  counterplayActed:     number;
  counterplayOptimal:   number;
  totalTicks:           number;
}

function makeInitialPlayerState(): PlayerPredatorState {
  return {
    bb:     INITIAL_BB_STATE,
    psyche: INITIAL_PSYCHE_STATE,
    tempo:  INITIAL_TEMPO_STATE,
  };
}

export function createPredatorRunState(): PredatorRunState {
  return {
    local:    makeInitialPlayerState(),
    opponent: makeInitialPlayerState(),
    rivalry:      INITIAL_RIVALRY_STATE,
    sharedDeck:   INITIAL_SHARED_DECK,
    cooldowns:    INITIAL_COOLDOWN_REGISTRY,
    activeTracker: INITIAL_ACTIVE_TRACKER,
    openWindows:  [],
    resolvedWindows: [],
    currentPhase: 'EARLY',
    cordSnapshot: null,
    extractionsFired:  0,
    extractionsLanded: 0,
    counterplayWindows: 0,
    counterplayActed:   0,
    counterplayOptimal: 0,
    totalTicks: 0,
  };
}

// ── Tick ──────────────────────────────────────────────────────────────────────

export interface PredatorTickInput {
  tick:               number;
  localCash:          number;
  localIncome:        number;
  localNetWorth:      number;
  opponentCash:       number;
  opponentIncome:     number;
  opponentShields:    number;
  totalGameTicks:     number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBus = { emit: (channel: string, payload: object) => void };

export function onPredatorTick(
  state: PredatorRunState,
  input: PredatorTickInput,
  bus:   AnyBus,
): PredatorRunState {
  const { tick, totalGameTicks } = input;
  let { local, opponent, rivalry, sharedDeck, cooldowns, activeTracker,
        openWindows, resolvedWindows, extractionsFired, extractionsLanded,
        counterplayWindows, counterplayActed, counterplayOptimal } = state;

  // ── Phase ──────────────────────────────────────────────────────────────────
  const progress = tick / Math.max(1, totalGameTicks);
  const currentPhase: PredatorRunState['currentPhase'] =
    progress >= 0.75 ? 'ENDGAME' : progress >= 0.35 ? 'MID' : 'EARLY';

  // ── 1. Tempo chain tick (both players) ────────────────────────────────────
  const localTempo    = tickTempoChain(local.tempo,    tick);
  const opponentTempo = tickTempoChain(opponent.tempo, tick);
  local    = { ...local,    tempo: localTempo };
  opponent = { ...opponent, tempo: opponentTempo };

  // ── 2. Psyche passive decay ───────────────────────────────────────────────
  const prevLocalInTilt = local.psyche.inTilt;
  const localPsyche     = decayPsyche(local.psyche, tick);
  if (prevLocalInTilt && !localPsyche.inTilt) {
    emitTiltResolved(bus, localPsyche.tiltTicks, tick);
  }
  local = { ...local, psyche: localPsyche };

  // ── 3. Auto-expire counterplay windows ───────────────────────────────────
  const nowExpired: CounterplayWindow[] = [];
  const stillOpen:  CounterplayWindow[] = [];

  for (const w of openWindows) {
    if (isWindowExpired(w, tick)) {
      const expired = expireCounterplayWindow(w, tick);
      // Timeout = extraction LANDED — apply psyche hit to defender
      const psycheAfterTimeout = chargePsyche('EXTRACTION_LANDED', local.psyche, tick, w.extraction.actualImpact?.psycheHit ?? 0.15);
      local = { ...local, psyche: psycheAfterTimeout };
      nowExpired.push(expired);
      extractionsLanded += 1;
    } else {
      stillOpen.push(w);
    }
  }

  openWindows     = stillOpen;
  resolvedWindows = [...nowExpired, ...resolvedWindows].slice(-10);

  // ── 4. Shared deck expiry ─────────────────────────────────────────────────
  const { updatedState: deckAfterExpiry, expiredCards } = expireClaimWindows(sharedDeck, tick);
  sharedDeck = deckAfterExpiry;
  if (expiredCards.length) {
    emitDeckExpired(bus, expiredCards, tick);
  }

  // ── 5. Battle round reset ─────────────────────────────────────────────────
  if (tick > 0 && tick % PREDATOR_CONFIG.battleRoundTicks === 0) {
    const prevBBRound = local.bb.roundGenerated;
    local    = { ...local,    bb: resetBBRound(local.bb),    tempo: resetTempoChainRound(local.tempo) };
    opponent = { ...opponent, bb: resetBBRound(opponent.bb), tempo: resetTempoChainRound(opponent.tempo) };
    emitBBRoundReset(bus, { ...local.bb, roundGenerated: prevBBRound }, tick);
  }

  // ── 6. Rivalry stale prune (every 500 ticks) ──────────────────────────────
  if (tick % 500 === 0) {
    rivalry = pruneStaleRivalries(rivalry, tick);
  }

  return {
    ...state,
    local,
    opponent,
    rivalry,
    sharedDeck,
    cooldowns,
    activeTracker,
    openWindows,
    resolvedWindows,
    currentPhase,
    extractionsFired,
    extractionsLanded,
    counterplayWindows,
    counterplayActed,
    counterplayOptimal,
    totalTicks: tick,
  };
}

// ── Player Actions ────────────────────────────────────────────────────────────

/** Called when local player plays a card */
export function onCardPlayed(
  state:         PredatorRunState,
  cardEnergyCost: number,
  cashflowMonthly: number,
  haterHeat:     number,
  currentTick:   number,
  bus:           AnyBus,
): PredatorRunState {
  let { local } = state;

  // Register card play in tempo chain
  const baseBB = Math.round(
    cardEnergyCost * PREDATOR_CONFIG.bbGenerationRate + cashflowMonthly * 0.5,
  );
  const chainResult = registerCardPlay(local.tempo, currentTick, baseBB);

  if (chainResult.chainStarted && chainResult.chainDepth > 1) {
    emitTempoChainStarted(bus, chainResult.chainDepth, chainResult.bbMultiplier, currentTick);
  }
  if (chainResult.chainBroke) {
    emitTempoChainBroke(bus, state.local.tempo.peakDepth, currentTick);
  }

  // Generate BB through budget engine
  const bbInput: BBGenerationInput = {
    cardEnergyCost,
    cashflowMonthly,
    currentTick,
    haterHeat,
  };
  const bbResult = generateBB(bbInput, { ...local.bb, tempoChain: chainResult.updatedState.depth > 1
    ? { depth: chainResult.updatedState.depth, lastPlayTick: currentTick, roundChainBonus: chainResult.bbBonus }
    : local.bb.tempoChain,
  });

  local = {
    ...local,
    bb:    bbResult.updatedState,
    tempo: chainResult.updatedState,
  };

  if (local.bb.bbDebt > 0) {
    emitBBDepleted(bus, local.bb, currentTick);
  }

  return { ...state, local };
}

/** Called when local player fires an extraction */
export function onFireExtraction(
  state:       PredatorRunState,
  type:        ExtractionType,
  localId:     string,
  opponentId:  string,
  currentTick: number,
  params:      ExtractionParams,
  bus:         AnyBus,
): PredatorRunState | { error: string } {
  const { local, cooldowns, activeTracker } = state;

  // Guards
  if (isExtractionOnCooldown(cooldowns, type, currentTick)) {
    const remaining = getCooldownTicksRemaining(cooldowns, type, currentTick);
    return { error: `${type} on cooldown — ${remaining} ticks remaining` };
  }
  if (!canFireNewExtraction(activeTracker)) {
    return { error: `Max concurrent extractions (${PREDATOR_CONFIG.maxConcurrentExtractions}) reached` };
  }
  const bbCost = getExtractionBBCost(type);
  if (!canFireExtraction(local.bb, bbCost)) {
    return { error: `Insufficient BB (need ${bbCost}, have ${local.bb.current})` };
  }

  // Build action
  const action = buildExtractionAction(type, localId, opponentId, currentTick, params);

  // Spend BB
  const bbResult = spendBB(bbCost, 'EXTRACTION_FIRE', local.bb);
  if (!bbResult.success) return { error: 'BB spend failed' };

  // Build counterplay window
  const cpCtx: CounterplayContext = {
    defenderCash:    params.opponentCash,
    defenderShields: params.opponentShields,
    defenderBB:      state.opponent.bb.current,
    defenderIncome:  params.opponentIncome,
    psycheValue:     state.opponent.psyche.value,
    attackerId:      localId,
  };
  const cpWindow = buildCounterplayWindow(action, currentTick, cpCtx);

  emitExtractionFired(bus, action, currentTick);
  emitCounterplayOpened(bus, cpWindow, currentTick);

  return {
    ...state,
    local:          { ...local, bb: bbResult.updatedState },
    cooldowns:      applyCooldown(cooldowns, type, currentTick),
    activeTracker:  trackExtractionFired(activeTracker, action.id),
    openWindows:    [...state.openWindows, cpWindow],
    extractionsFired: state.extractionsFired + 1,
  };
}

/** Called when the defender responds to a counterplay window */
export function onCounterplayChosen(
  state:      PredatorRunState,
  windowId:   string,
  action:     CounterplayAction,
  currentTick: number,
  bus:        AnyBus,
): PredatorRunState {
  const windowIdx = state.openWindows.findIndex(w => w.id === windowId);
  if (windowIdx === -1) return state;

  const window = state.openWindows[windowIdx];
  const resolved = resolveCounterplayWindow(window, action, currentTick, window.extraction.rawCashImpact);

  // Apply psyche relief for successful counterplay
  const relief = getCounterplayPsycheRelief(resolved);
  let localPsyche = state.local.psyche;
  if (relief > 0) {
    const prevInTilt = localPsyche.inTilt;
    localPsyche = relievePsyche(localPsyche, relief);
    if (prevInTilt && !localPsyche.inTilt) {
      emitTiltResolved(bus, localPsyche.tiltTicks, currentTick);
    }
  }

  // Resolve extraction impact
  const { resolved: resolvedExtraction, defenderImpact, attackerBlowback } =
    resolveExtraction(window.extraction, action, currentTick);

  // Apply psyche charge to defender on impact
  let defenderPsyche = state.local.psyche;
  if (defenderImpact.psycheHit > 0) {
    const wasInTilt = defenderPsyche.inTilt;
    defenderPsyche = chargePsyche('EXTRACTION_LANDED', defenderPsyche, currentTick, defenderImpact.psycheHit);
    if (!wasInTilt && defenderPsyche.inTilt) {
      emitTiltActivated(bus, defenderPsyche, currentTick);
    }
  }

  // BB reward for attacker
  let localBB = state.local.bb;
  if (defenderImpact.attackerBBReward !== 0) {
    if (defenderImpact.attackerBBReward > 0) {
      const genResult = generateBB(
        { cardEnergyCost: 0, cashflowMonthly: 0, currentTick, haterHeat: 0 },
        localBB,
      );
      localBB = { ...genResult.updatedState, current: localBB.current + defenderImpact.attackerBBReward };
    }
  }

  // Counterplay metrics
  const counterplayActed   = action !== 'NONE' ? state.counterplayActed + 1 : state.counterplayActed;
  const wasOptimal         = isOptimalCounterplay(action, window.extraction.type, state.local.psyche.inTilt);
  const counterplayOptimal = wasOptimal ? state.counterplayOptimal + 1 : state.counterplayOptimal;
  const extractionsLanded  = resolved.wasSuccessful ? state.extractionsLanded : state.extractionsLanded + 1;

  // Rivalry record
  let rivalry = state.rivalry;
  if (resolved.wasSuccessful) {
    rivalry = recordCounterplayBeat(rivalry, window.extraction.attackerId);
  } else {
    rivalry = recordExtractionLanded(rivalry, window.extraction.attackerId);
  }

  emitExtractionResolved(bus, resolvedExtraction, defenderImpact, attackerBlowback, currentTick);
  emitCounterplayResolved(bus, resolved, action, relief, currentTick);

  const remaining = state.openWindows.filter((_, i) => i !== windowIdx);
  const resolvedWindows = [resolved, ...state.resolvedWindows].slice(-10);

  return {
    ...state,
    local:          { ...state.local, psyche: defenderPsyche, bb: localBB },
    openWindows:    remaining,
    resolvedWindows,
    rivalry,
    counterplayActed,
    counterplayOptimal,
    extractionsLanded,
    counterplayWindows: state.counterplayWindows + 1,
  };
}

// ── Snapshot CORD ─────────────────────────────────────────────────────────────

export function snapshotCord(
  state:          PredatorRunState,
  cashflow:       number,
  targetCashflow: number,
  netWorth:       number,
  startingNetWorth: number,
): PredatorRunState {
  const cord = computePredatorCord({
    extractionsFired:        state.extractionsFired,
    extractionsLanded:       state.extractionsLanded,
    extractionTypeDiversity: 0.6, // TODO: compute from history
    counterplayWindows:      state.counterplayWindows,
    counterplayActed:        state.counterplayActed,
    counterplayOptimal:      state.counterplayOptimal,
    rivalry:                 state.rivalry,
    psyche:                  state.local.psyche,
    totalTicks:              state.totalTicks,
    cashflow,
    targetCashflow,
    netWorth,
    startingNetWorth,
    bb:                      state.local.bb,
  });

  return { ...state, cordSnapshot: cord };
}

// ── Internal ──────────────────────────────────────────────────────────────────

function isOptimalCounterplay(
  action:       CounterplayAction,
  type:         ExtractionType,
  isTilted:     boolean,
): boolean {
  if (isTilted) return action === 'DAMPEN'; // only dampen available while tilted
  if (type === 'SHIELD_CRACK') return action === 'BLOCK' || action === 'ABSORB';
  if (type === 'DEBT_SPIKE')   return action === 'BLOCK';
  if (type === 'CASH_SIPHON')  return action === 'REFLECT' || action === 'BLOCK';
  return action !== 'NONE';
}

// ── Re-exports for PredatorGameScreen ─────────────────────────────────────────

export {
  psycheLabel,
  psycheZoneColor,
  psycheZone,
  tiltDrawPenalty,
  chainLabel,
  chainLabelColor,
  isTempoChainActive,
  getTempoChainMultiplier,
  bbStateLabel,
  getRivalryAmplifier,
  isRivalryActive,
  cordScoreGrade,
  cordGradeColor,
  getUrgentCards,
  getTopDenyValueCard,
};