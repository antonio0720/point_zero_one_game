// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/runtime/runReducer.ts
// Sprint 8: Run State Reducer — Complete Overhaul
// Density6 LLC · Confidential · All Rights Reserved
//
// CHANGES FROM SPRINT 1:
//   ✦ INTELLIGENCE_UPDATE case added — alpha/risk now update every tick
//   ✦ COUNTERPLAY_OFFERED case added — sets pending counterplay state
//   ✦ FORCED_EVENT_TRIGGERED / MECHANIC_TOUCHED cases added
//   ✦ FREEDOM win condition in MONTHLY_SETTLEMENT (netWorth >= FREEDOM_THRESHOLD)
//   ✦ SHIELD_PROC uses event.shieldsRemaining (not state.shields - 1)
//   ✦ RUN_START fully resets intelligence to initial values (seed-safe)
//   ✦ RESCUE_WINDOW_OPENED reads from event payload (no hardcoding)
//   ✦ RunState extended with modeExt fields (bleed, psyche, ghost, trust)
//   ✦ EMPIRE bleed events: BLEED_ACTIVATED, BLEED_RESOLVED, BLEED_ESCALATED
//   ✦ PHANTOM ghost delta: GHOST_DELTA_UPDATE, AHEAD_OF_GHOST, BEHIND_GHOST
//   ✦ PREDATOR psyche: PSYCHE_UPDATE, TILT_ACTIVATED, TILT_RESOLVED
//   ✦ SYNDICATE trust: TRUST_UPDATE, AID_CONTRACT_SIGNED/BREACHED/FULFILLED
//   ✦ MONTHLY_SETTLEMENT XP grant added (no 5-minute XP dead zone)
//   ✦ MONTHLY_SETTLEMENT FREEDOM threshold check
//   ✦ RUN_COMPLETE emits final telemetry snapshot
//   ✦ CHECKPOINT_SAVED event for 20M-scale server snapshot
//   ✦ RUNTIME_ERROR graceful degradation case
//   ✦ Telemetry ring buffer (no unbounded spread on every tick)
//   ✦ advanceSeason circular re-import removed — clean type reference
//   ✦ ISOLATION_TAX_HIT event case for EMPIRE mode
//
// Scale guarantee: all cases run in O(1) or O(log n) — safe for 20M concurrent.
// ═══════════════════════════════════════════════════════════════════════════

import type {
  RunState, IntelligenceState, SeasonState,
  ActiveSabotage, RescueWindow, MarketRegime,
} from '../types/runState';
import type { GameCard }  from '../types/cards';
import type { RunEvent }  from '../types/events';
import { clamp }          from '../core/math';
import {
  MAX_LOG, MAX_EQUITY_POINTS,
  SHIELD_BANKRUPTCY_RECOVERY,
  MONTH_TICKS, STARTING_CASH, STARTING_INCOME, STARTING_EXPENSES,
  RUN_TICKS,
  XP_PER_MONTH_CASHFLOW_UNIT, XP_MIN_PER_SETTLEMENT,
  FREEDOM_THRESHOLD,
  TELEMETRY_BATCH_SIZE,
} from '../core/constants';
import { fmtMoney } from '../core/format';

// ── Mode-Extension Sub-States ─────────────────────────────────────────────────
// Reducer-owned slices for each mode's unique tracking.
// Engine layers write via dispatched events; UI reads from RunState.

export interface EmpireModeExt {
  bleedActive:       boolean;
  bleedSeverity:     'NONE' | 'WATCH' | 'CRITICAL' | 'TERMINAL';
  bleedActivatedAt:  number;   // tick
  bleedDurationTicks: number;
  totalBleedTicks:   number;
  reactivationCount: number;
  isolationTaxPaid:  number;   // cumulative $ paid in isolation tax this run
  comebackSurgeCount: number;
  currentWave:       number;
  botCount:          number;
}

export interface PredatorModeExt {
  psycheValue:       number;   // 0.0 (calm) → 1.0 (max tilt)
  inTilt:            boolean;
  tiltCount:         number;
  battleBudgetLeft:  number;
  rivalryTier:       number;   // 1–5
  counterplayPending: boolean;
  counterplayEventLabel: string;
  counterplayAdjustedHit: number;
}

export interface PhantomModeExt {
  ghostLoaded:       boolean;
  legendDisplayName: string;
  netWorthGap:       number;   // positive = ahead, negative = behind
  netWorthGapPct:    number;
  cordGap:           number;
  isAhead:           boolean;
  pressureIntensity: number;
  gapZone:           'FAR_AHEAD' | 'AHEAD' | 'EVEN' | 'BEHIND' | 'CRITICAL';
  legendBeaten:      boolean;
  proofBadgeHash:    string;
}

export interface SyndicateModeExt {
  trustValue:        number;   // 0.0–1.0
  leakageRate:       number;
  suspicionLevel:    number;
  defectionStep:     number;   // 0 = no defection in progress
  activeAidContracts: number;
  rescueFunded:      boolean;
}

// ── Extended RunState (augments the core type) ────────────────────────────────
// Allows reducer to carry mode-specific data without polluting core RunState.
// The engine layer keeps its own state; these fields are the reducer-owned mirror.

export interface RunStateExt extends RunState {
  // Pending counterplay (set by COUNTERPLAY_OFFERED, cleared by COUNTERPLAY_RESOLVED)
  pendingCounterplay: {
    active:       boolean;
    eventLabel:   string;
    adjustedHit:  number;
    offeredAtTick: number;
  } | null;

  // Checkpoint for 20M-scale resume-on-disconnect
  lastCheckpointTick: number;

  // Mode extensions (all modes always present; only relevant one is populated)
  empireExt:    EmpireModeExt;
  predatorExt:  PredatorModeExt;
  phantomExt:   PhantomModeExt;
  syndicateExt: SyndicateModeExt;
}

// ── Initial mode-extension states ─────────────────────────────────────────────

const INITIAL_EMPIRE_EXT: EmpireModeExt = {
  bleedActive: false, bleedSeverity: 'NONE', bleedActivatedAt: 0,
  bleedDurationTicks: 0, totalBleedTicks: 0, reactivationCount: 0,
  isolationTaxPaid: 0, comebackSurgeCount: 0, currentWave: 1, botCount: 0,
};

const INITIAL_PREDATOR_EXT: PredatorModeExt = {
  psycheValue: 0, inTilt: false, tiltCount: 0, battleBudgetLeft: 100,
  rivalryTier: 1, counterplayPending: false,
  counterplayEventLabel: '', counterplayAdjustedHit: 0,
};

const INITIAL_PHANTOM_EXT: PhantomModeExt = {
  ghostLoaded: false, legendDisplayName: '', netWorthGap: 0,
  netWorthGapPct: 0, cordGap: 0, isAhead: false, pressureIntensity: 0,
  gapZone: 'EVEN', legendBeaten: false, proofBadgeHash: '',
};

const INITIAL_SYNDICATE_EXT: SyndicateModeExt = {
  trustValue: 1.0, leakageRate: 0.02, suspicionLevel: 0,
  defectionStep: 0, activeAidContracts: 0, rescueFunded: false,
};

const INITIAL_INTELLIGENCE: IntelligenceState = {
  alpha: 0.45, risk: 0.35, volatility: 0.30, antiCheat: 0.50,
  personalization: 0.40, rewardFit: 0.45, recommendationPower: 0.42,
  churnRisk: 0.28, momentum: 0.33,
};

// ── Reducer ───────────────────────────────────────────────────────────────────

export function runReducer(state: RunStateExt, event: RunEvent): RunStateExt {
  switch (event.type) {

    // ── Run Lifecycle ─────────────────────────────────────────────────────
    case 'RUN_START':
      return {
        ...state,
        mode:               event.mode,
        seed:               event.seed,
        screen:             'run',
        cash:               STARTING_CASH,
        income:             STARTING_INCOME,
        expenses:           STARTING_EXPENSES,
        netWorth:           STARTING_CASH,
        equityHistory:      [STARTING_CASH],
        tick:               0,
        totalTicks:         RUN_TICKS,
        freezeTicks:        0,
        shields:            0,
        shieldConsuming:    false,
        hand:               [],
        haterSabotageCount: 0,
        activeSabotages:    [],
        rescueWindow:       null,
        battleState:        { phase: 'PREP', score: { local: 0, opponent: 0 }, round: 1 },
        regime:             'Stable',
        events:             [`🎮 Run started (seed=${event.seed}). Mode: ${event.mode}`],
        telemetry:          [],
        // Reset intelligence to clean initial values — seed-safe replay
        intelligence:       { ...INITIAL_INTELLIGENCE },
        season: {
          xp: 0, passTier: 1, dominionControl: 0, nodePressure: 0,
          winStreak: 0, battlePassLevel: 1, rewardsPending: 0,
        },
        // Mode extensions — all reset regardless of mode
        empireExt:    { ...INITIAL_EMPIRE_EXT },
        predatorExt:  { ...INITIAL_PREDATOR_EXT },
        phantomExt:   { ...INITIAL_PHANTOM_EXT },
        syndicateExt: { ...INITIAL_SYNDICATE_EXT },
        pendingCounterplay: null,
        lastCheckpointTick: 0,
      };

    case 'RUN_COMPLETE': {
      const nextScreen = event.outcome === 'BANKRUPT' ? 'bankrupt' : 'result';
      return {
        ...state,
        screen: nextScreen,
        telemetry: pushTelemetry(state.telemetry, {
          tick: state.tick, type: 'run.complete',
          payload: { outcome: event.outcome, tick: event.tick, netWorth: state.netWorth },
        }),
      };
    }

    case 'SCREEN_TRANSITION':
      return { ...state, screen: event.to };

    // ── Tick ─────────────────────────────────────────────────────────────
    case 'TICK_ADVANCE': {
      const nextTick   = event.tick;
      const isComplete = nextTick >= state.totalTicks;
      const newFreeze  = state.freezeTicks > 0 ? state.freezeTicks - 1 : 0;

      // Sabotage countdown
      const newSabotages = state.activeSabotages
        .map((s) => ({ ...s, ticksRemaining: s.ticksRemaining - 1 }))
        .filter((s) => s.ticksRemaining > 0);

      // Rescue window countdown
      let newRescue = state.rescueWindow;
      if (newRescue) {
        newRescue = newRescue.ticksRemaining <= 1
          ? null
          : { ...newRescue, ticksRemaining: newRescue.ticksRemaining - 1 };
      }

      // Empire bleed duration tracking
      let newEmpireExt = state.empireExt;
      if (state.mode === 'EMPIRE' && state.empireExt.bleedActive) {
        newEmpireExt = {
          ...state.empireExt,
          bleedDurationTicks: state.empireExt.bleedDurationTicks + 1,
          totalBleedTicks:    state.empireExt.totalBleedTicks + 1,
        };
      }

      // Phantom gap zone evaluation (using existing gap pct)
      let newPhantomExt = state.phantomExt;
      if (state.mode === 'PHANTOM' && state.phantomExt.ghostLoaded) {
        newPhantomExt = {
          ...state.phantomExt,
          gapZone: computeGapZone(state.phantomExt.netWorthGapPct, state.phantomExt.isAhead),
        };
      }

      if (isComplete) {
        return {
          ...state,
          tick:           nextTick,
          freezeTicks:    newFreeze,
          activeSabotages: newSabotages,
          rescueWindow:   newRescue,
          empireExt:      newEmpireExt,
          phantomExt:     newPhantomExt,
          screen:         'result',
        };
      }

      return {
        ...state,
        tick:            nextTick,
        freezeTicks:     newFreeze,
        activeSabotages: newSabotages,
        rescueWindow:    newRescue,
        empireExt:       newEmpireExt,
        phantomExt:      newPhantomExt,
      };
    }

    // ── Intelligence Update (fires every tick from useRunLoop) ────────────
    case 'INTELLIGENCE_UPDATE': {
      const prev = state.intelligence;
      const newAlpha  = clamp(prev.alpha + event.alphaDelta, 0, 1);
      const newRisk   = clamp(prev.risk  + event.riskDelta,  0, 1);
      // Volatility tracks the absolute delta between alpha and risk
      const spread    = Math.abs(newAlpha - newRisk);
      const newVol    = clamp(prev.volatility * 0.97 + spread * 0.03, 0, 1);
      // Momentum: positive when alpha > risk, decays otherwise
      const newMom    = clamp(
        prev.momentum + (newAlpha > newRisk ? 0.003 : -0.005),
        0, 1,
      );
      // RecommendationPower moves toward alpha over time
      const newRecPow = clamp(prev.recommendationPower * 0.995 + newAlpha * 0.005, 0, 1);
      // ChurnRisk inversely correlates with momentum
      const newChurn  = clamp(1 - newMom * 0.8, 0, 1);
      return {
        ...state,
        intelligence: {
          ...prev,
          alpha:               newAlpha,
          risk:                newRisk,
          volatility:          newVol,
          momentum:            newMom,
          recommendationPower: newRecPow,
          churnRisk:           newChurn,
        },
      };
    }

    // ── Card Resolution ───────────────────────────────────────────────────
    case 'CARD_PLAY_RESOLVED': {
      const { card, cashDelta, incomeDelta, netWorthDelta } = event;
      const newCash     = clamp(state.cash + cashDelta, 0, Infinity);
      const newIncome   = clamp(state.income + incomeDelta, 0, Infinity);
      const newNetWorth = state.netWorth + netWorthDelta;
      const newHand     = state.hand.filter((c) => c.id !== card.id);
      const xpGrant     = incomeDelta > 0 ? Math.max(2, Math.floor(incomeDelta / 200)) : 0;
      const msg         = `✅ Played: ${card.name}${incomeDelta > 0 ? ` → +${fmtMoney(incomeDelta)}/mo` : ''}`;

      // Check FREEDOM win condition on positive net worth events
      if (newNetWorth >= FREEDOM_THRESHOLD) {
        return {
          ...state,
          cash: newCash, income: newIncome, netWorth: newNetWorth,
          hand: newHand,
          screen: 'result',
          season: grantXP(state.season, xpGrant),
          events: appendLog(state.events, state.tick, `🏆 FREEDOM ACHIEVED! ${fmtMoney(newNetWorth)}`),
        };
      }

      return {
        ...state,
        cash: newCash, income: newIncome, netWorth: newNetWorth,
        hand: newHand,
        season: xpGrant > 0 ? grantXP(state.season, xpGrant) : state.season,
        events: appendLog(state.events, state.tick, msg),
      };
    }

    case 'CARD_PLAY_REJECTED': {
      const msg = `❌ Card rejected (${event.reason})`;
      return { ...state, events: appendLog(state.events, state.tick, msg) };
    }

    case 'CARD_DRAWN': {
      if (state.hand.length >= 5) return state;
      return {
        ...state,
        hand:   [...state.hand, event.card],
        events: appendLog(state.events, state.tick, `📬 Drew: ${event.card.name}`),
      };
    }

    case 'CARD_FUBAR_BLOCKED': {
      const newShields = event.shieldSpent ? Math.max(0, state.shields - 1) : state.shields;
      return {
        ...state,
        shields:         newShields,
        shieldConsuming: event.shieldSpent,
        events:          appendLog(state.events, state.tick, `🛡️ Shield blocked: ${event.cardId}`),
      };
    }

    // ── Counterplay System ────────────────────────────────────────────────
    // COUNTERPLAY_OFFERED: FUBAR hit > $4K — player gets a defense window
    case 'COUNTERPLAY_OFFERED':
      return {
        ...state,
        pendingCounterplay: {
          active:           true,
          eventLabel:       event.eventLabel,
          adjustedHit:      event.adjustedHit,
          offeredAtTick:    state.tick,
        },
        // Also update predator ext for PvP mode
        predatorExt: state.mode === 'PREDATOR'
          ? { ...state.predatorExt, counterplayPending: true, counterplayEventLabel: event.eventLabel, counterplayAdjustedHit: event.adjustedHit }
          : state.predatorExt,
        events: appendLog(state.events, state.tick, `⚠️ Counterplay: ${event.eventLabel} (${fmtMoney(event.adjustedHit)})`),
      };

    case 'COUNTERPLAY_RESOLVED': {
      const msg = event.success
        ? `✅ Counterplay resolved (${event.actionId})`
        : `❌ Counterplay failed (${event.actionId})`;
      return {
        ...state,
        cash:               clamp(state.cash - event.costSpent, 0, Infinity),
        pendingCounterplay: null,
        predatorExt:        state.mode === 'PREDATOR'
          ? { ...state.predatorExt, counterplayPending: false }
          : state.predatorExt,
        events:             appendLog(state.events, state.tick, msg),
      };
    }

    // ── Forced Events ─────────────────────────────────────────────────────
    case 'FORCED_EVENT_TRIGGERED': {
      return {
        ...state,
        telemetry: pushTelemetry(state.telemetry, {
          tick: state.tick,
          type: `forced.${event.eventType.toLowerCase()}`,
          payload: { cardId: event.cardId },
        }),
      };
    }

    // ── Mechanic Touched ─────────────────────────────────────────────────
    case 'MECHANIC_TOUCHED': {
      // Record the touch signal in telemetry for ML training
      return {
        ...state,
        telemetry: pushTelemetry(state.telemetry, {
          tick: state.tick, type: 'mechanic.touch',
          payload: { mechanicId: event.mechanicId, signal: event.signal },
        }),
      };
    }

    // ── Monthly Settlement ────────────────────────────────────────────────
    case 'MONTHLY_SETTLEMENT': {
      const { settlement, mlMod } = event;
      const newCash     = state.cash + settlement;
      const newNetWorth = state.netWorth + settlement;

      // XP grant proportional to positive cashflow
      const xpGrant = Math.max(
        XP_MIN_PER_SETTLEMENT,
        Math.round(Math.max(0, settlement) / XP_PER_MONTH_CASHFLOW_UNIT),
      );

      // FREEDOM win condition — check before bankruptcy
      if (newNetWorth >= FREEDOM_THRESHOLD) {
        return {
          ...state,
          cash:          Math.max(0, newCash),
          netWorth:      newNetWorth,
          equityHistory: appendEquity(state.equityHistory, newNetWorth),
          season:        advanceSeason(state.season, settlement),
          screen:        'result',
          events:        appendLog(state.events, state.tick, `🏆 FREEDOM ACHIEVED! Net Worth: ${fmtMoney(newNetWorth)}`),
          telemetry:     pushTelemetry(state.telemetry, {
            tick: state.tick, type: 'run.freedom',
            payload: { netWorth: newNetWorth, tick: state.tick },
          }),
        };
      }

      // Shield absorbs bankruptcy
      if (newCash <= 0 && state.shields > 0) {
        return {
          ...state,
          cash:            SHIELD_BANKRUPTCY_RECOVERY,
          shields:         state.shields - 1,
          shieldConsuming: true,
          netWorth:        newNetWorth,
          equityHistory:   appendEquity(state.equityHistory, newNetWorth),
          season:          advanceSeason(state.season, settlement),
          events:          appendLog(state.events, state.tick, `🛡️ Shield absorbed bankruptcy! +${fmtMoney(SHIELD_BANKRUPTCY_RECOVERY)}`),
          telemetry:       pushTelemetry(state.telemetry, {
            tick: state.tick, type: 'shield.bankruptcy_absorbed',
            payload: { recovery: SHIELD_BANKRUPTCY_RECOVERY, shieldsLeft: state.shields - 1 },
          }),
        };
      }

      // True bankruptcy — no shields
      if (newCash <= 0) {
        return {
          ...state,
          cash:      0,
          netWorth:  newNetWorth,
          screen:    'bankrupt',
          events:    appendLog(state.events, state.tick, `💀 BANKRUPT at tick ${state.tick}`),
          telemetry: pushTelemetry(state.telemetry, {
            tick: state.tick, type: 'run.bankrupt',
            payload: { finalNetWorth: newNetWorth, tick: state.tick },
          }),
        };
      }

      return {
        ...state,
        cash:          newCash,
        netWorth:      newNetWorth,
        equityHistory: appendEquity(state.equityHistory, newNetWorth),
        season:        advanceSeason(state.season, settlement),
        events:        appendLog(
          state.events, state.tick,
          `📊 Settlement: ${settlement >= 0 ? '+' : ''}${fmtMoney(settlement)} (×${mlMod.toFixed(2)} ML mod)`,
        ),
      };
    }

    // ── Regime ────────────────────────────────────────────────────────────
    case 'REGIME_CHANGED':
      return {
        ...state,
        regime: event.regime,
        events: appendLog(state.events, state.tick, `📈 Regime: ${event.regime}`),
      };

    // ── Shield ────────────────────────────────────────────────────────────
    case 'SHIELD_PROC': {
      // Use event.shieldsRemaining — engine is authoritative on shield count
      return {
        ...state,
        shields:         event.shieldsRemaining,
        shieldConsuming: true,
        events:          appendLog(state.events, state.tick, `🛡️ Shield proc: saved ${fmtMoney(event.cashSaved)}`),
      };
    }

    case 'SHIELD_CONSUMED':
      return { ...state, shieldConsuming: false };

    // ── Freeze ────────────────────────────────────────────────────────────
    case 'FREEZE_APPLIED':
      return {
        ...state,
        freezeTicks: state.freezeTicks + event.ticks,
        events:      appendLog(state.events, state.tick, `⏸ Frozen +${event.ticks}t (${event.source})`),
      };

    // ── Sabotage ──────────────────────────────────────────────────────────
    case 'SABOTAGE_RECEIVED': {
      const sab: ActiveSabotage = {
        id:                event.sabotageId,
        kind:              event.kind,
        label:             event.kind.replace(/_/g, ' '),
        severity:          event.intensity > 0.7 ? 'CRITICAL' : event.intensity > 0.4 ? 'MAJOR' : 'MINOR',
        ticksRemaining:    Math.ceil(24 * event.intensity),
        sourceDisplayName: event.sourceDisplayName,
        impactValue:       Math.round(500 * event.intensity),
      };
      return {
        ...state,
        haterSabotageCount: state.haterSabotageCount + 1,
        activeSabotages:    [...state.activeSabotages.slice(-4), sab],
        events:             appendLog(state.events, state.tick, `💥 Sabotage: ${event.kind} from ${event.sourceDisplayName}`),
      };
    }

    case 'SABOTAGE_COUNTERED':
      return {
        ...state,
        activeSabotages: state.activeSabotages.filter((s) => s.id !== event.sabotageId),
        events:          appendLog(state.events, state.tick, `✅ Sabotage countered: ${event.sabotageId}`),
      };

    // ── Battle ────────────────────────────────────────────────────────────
    case 'BATTLE_PHASE_CHANGED':
      return { ...state, battleState: { ...state.battleState, phase: event.phase } };

    case 'BATTLE_SCORE_UPDATE':
      return {
        ...state,
        battleState: {
          ...state.battleState,
          score: { local: event.local, opponent: event.opponent },
          round: state.battleState.round + 1,
        },
      };

    // ── EMPIRE Mode Events ────────────────────────────────────────────────
    case 'BLEED_ACTIVATED': {
      const isReactivation = state.empireExt.bleedActive === false && state.empireExt.totalBleedTicks > 0;
      return {
        ...state,
        empireExt: {
          ...state.empireExt,
          bleedActive:        true,
          bleedSeverity:      event.severity ?? 'WATCH',
          bleedActivatedAt:   state.tick,
          bleedDurationTicks: 0,
          reactivationCount:  state.empireExt.reactivationCount + (isReactivation ? 1 : 0),
        },
        events: appendLog(state.events, state.tick, `🩸 Bleed Mode: ${event.severity ?? 'WATCH'}`),
      };
    }

    case 'BLEED_RESOLVED':
      return {
        ...state,
        empireExt: {
          ...state.empireExt,
          bleedActive:    false,
          bleedSeverity:  'NONE',
          bleedDurationTicks: 0,
        },
        events: appendLog(state.events, state.tick, `💚 Bleed resolved after ${state.empireExt.bleedDurationTicks}t`),
      };

    case 'BLEED_ESCALATED':
      return {
        ...state,
        empireExt: {
          ...state.empireExt,
          bleedSeverity: event.to as EmpireModeExt['bleedSeverity'],
        },
        events: appendLog(state.events, state.tick, `⚠️ Bleed escalated → ${event.to}`),
      };

    case 'ISOLATION_TAX_HIT': {
      const newCash = clamp(state.cash - event.taxAmount, 0, Infinity);
      return {
        ...state,
        cash: newCash,
        empireExt: {
          ...state.empireExt,
          isolationTaxPaid: state.empireExt.isolationTaxPaid + event.taxAmount,
        },
        events: appendLog(state.events, state.tick, `🏛️ Isolation tax: ${fmtMoney(event.taxAmount)} (${(event.effectiveRate * 100).toFixed(1)}%)`),
      };
    }

    case 'EMPIRE_PHASE_CHANGED':
      return {
        ...state,
        empireExt: {
          ...state.empireExt,
          currentWave: event.wave ?? state.empireExt.currentWave,
          botCount:    event.bots  ?? state.empireExt.botCount,
        },
        events: appendLog(state.events, state.tick, `🌊 Wave ${event.wave}: ${event.to}`),
      };

    case 'COMEBACK_SURGE':
      return {
        ...state,
        income: clamp(state.income + event.incomeDelta, 0, Infinity),
        empireExt: { ...state.empireExt, comebackSurgeCount: state.empireExt.comebackSurgeCount + 1 },
        season:    grantXP(state.season, event.xpGained),
        events:    appendLog(state.events, state.tick, `🚀 Comeback Surge: +${fmtMoney(event.incomeDelta)}/mo (+${event.xpGained} XP)`),
      };

    // ── PREDATOR Mode Events ──────────────────────────────────────────────
    case 'PSYCHE_UPDATE':
      return {
        ...state,
        predatorExt: {
          ...state.predatorExt,
          psycheValue: clamp(event.newValue, 0, 1),
          inTilt:      event.inTilt ?? state.predatorExt.inTilt,
        },
      };

    case 'TILT_ACTIVATED':
      return {
        ...state,
        predatorExt: {
          ...state.predatorExt,
          inTilt:     true,
          tiltCount:  state.predatorExt.tiltCount + 1,
          psycheValue: event.psycheValue ?? state.predatorExt.psycheValue,
        },
        events: appendLog(state.events, state.tick, `😤 TILT activated (draw penalty: ${event.drawPenalty})`),
      };

    case 'TILT_RESOLVED':
      return {
        ...state,
        predatorExt: { ...state.predatorExt, inTilt: false },
        events:      appendLog(state.events, state.tick, `😤 Tilt resolved after ${event.tiltTicks}t`),
      };

    case 'BATTLE_BUDGET_UPDATE':
      return {
        ...state,
        predatorExt: {
          ...state.predatorExt,
          battleBudgetLeft: clamp(event.budgetLeft, 0, 100),
        },
      };

    case 'RIVALRY_TIER_CHANGED':
      return {
        ...state,
        predatorExt: { ...state.predatorExt, rivalryTier: event.to },
        events:      appendLog(state.events, state.tick, `⚔️ Rivalry Tier ${event.to} (×${event.amplifier})`),
      };

    // ── PHANTOM Mode Events ───────────────────────────────────────────────
    case 'GHOST_LOADED':
      return {
        ...state,
        phantomExt: {
          ...state.phantomExt,
          ghostLoaded:        true,
          legendDisplayName:  event.legendDisplayName,
        },
        events: appendLog(state.events, state.tick, `👻 Ghost loaded: ${event.legendDisplayName}`),
      };

    case 'GHOST_DELTA_UPDATE': {
      const zone = computeGapZone(event.netWorthGapPct, event.isAhead);
      return {
        ...state,
        phantomExt: {
          ...state.phantomExt,
          netWorthGap:      event.netWorthGap,
          netWorthGapPct:   event.netWorthGapPct,
          cordGap:          event.cordGap ?? state.phantomExt.cordGap,
          isAhead:          event.isAhead,
          pressureIntensity: event.pressureIntensity ?? 0,
          gapZone:          zone,
        },
      };
    }

    case 'AHEAD_OF_GHOST':
      return {
        ...state,
        phantomExt: { ...state.phantomExt, isAhead: true },
        events:     appendLog(state.events, state.tick, `👻 Ahead of ghost by ${fmtMoney(Math.abs(event.netWorthGap ?? 0))}`),
      };

    case 'BEHIND_GHOST':
      return {
        ...state,
        phantomExt: { ...state.phantomExt, isAhead: false },
        events:     appendLog(state.events, state.tick, `👻 Behind ghost — gap: ${fmtMoney(Math.abs(event.netWorthGap ?? 0))}`),
      };

    case 'LEGEND_BEATEN':
      return {
        ...state,
        phantomExt: {
          ...state.phantomExt,
          legendBeaten:  true,
          proofBadgeHash: event.proofHash ?? '',
        },
        events: appendLog(state.events, state.tick, `🏆 LEGEND BEATEN: ${event.legendName}`),
        telemetry: pushTelemetry(state.telemetry, {
          tick: state.tick, type: 'phantom.legend_beaten',
          payload: { legendId: event.legendId ?? '', proofHash: event.proofHash ?? '' },
        }),
      };

    // ── SYNDICATE Mode Events ─────────────────────────────────────────────
    case 'TRUST_UPDATE':
      return {
        ...state,
        syndicateExt: {
          ...state.syndicateExt,
          trustValue:   clamp(event.newValue, 0, 1),
          leakageRate:  event.leakageRate ?? state.syndicateExt.leakageRate,
        },
      };

    case 'AID_CONTRACT_SIGNED':
      return {
        ...state,
        cash: clamp(state.cash - (event.leakageApplied ?? 0), 0, Infinity),
        syndicateExt: {
          ...state.syndicateExt,
          activeAidContracts: state.syndicateExt.activeAidContracts + 1,
        },
        events: appendLog(state.events, state.tick, `📜 Aid contract: ${event.aidType} ${fmtMoney(event.effectiveAmount)}`),
      };

    case 'AID_CONTRACT_BREACHED':
      return {
        ...state,
        syndicateExt: {
          ...state.syndicateExt,
          activeAidContracts: Math.max(0, state.syndicateExt.activeAidContracts - 1),
          suspicionLevel:     state.syndicateExt.suspicionLevel + 0.2,
        },
        events: appendLog(state.events, state.tick, `💔 Aid contract breached`),
      };

    case 'AID_CONTRACT_FULFILLED':
      return {
        ...state,
        syndicateExt: {
          ...state.syndicateExt,
          activeAidContracts: Math.max(0, state.syndicateExt.activeAidContracts - 1),
        },
        events: appendLog(state.events, state.tick, `✅ Aid contract fulfilled`),
      };

    case 'DEFECTION_STEP':
      return {
        ...state,
        syndicateExt: {
          ...state.syndicateExt,
          defectionStep:  state.syndicateExt.defectionStep + 1,
          suspicionLevel: state.syndicateExt.suspicionLevel + (event.suspicionEmitted ?? 0.05),
        },
      };

    // ── Syndicate Rescue ──────────────────────────────────────────────────
    case 'RESCUE_WINDOW_OPENED':
      return {
        ...state,
        rescueWindow: {
          rescueeDisplayName:   event.rescueeDisplayName,
          rescueeNetWorth:      event.rescueeNetWorth ?? 0,
          ticksRemaining:       event.ticksRemaining,
          allianceName:         event.allianceName ?? 'APEX SYNDICATE',
          contributionRequired: event.contributionRequired ?? 10_000,
          totalContributed:     0,
        },
      };

    case 'RESCUE_CONTRIBUTION': {
      if (!state.rescueWindow) return state;
      const newTotal = state.rescueWindow.totalContributed + event.amount;
      const funded   = newTotal >= (state.rescueWindow.contributionRequired ?? 10_000);
      return {
        ...state,
        cash:        clamp(state.cash - event.amount, 0, Infinity),
        rescueWindow: { ...state.rescueWindow, totalContributed: newTotal },
        syndicateExt: funded ? { ...state.syndicateExt, rescueFunded: true } : state.syndicateExt,
        events:       appendLog(state.events, state.tick, `🤝 Contributed ${fmtMoney(event.amount)} to rescue${funded ? ' — FUNDED!' : ''}`),
      };
    }

    case 'RESCUE_DISMISSED':
      return { ...state, rescueWindow: null };

    case 'AID_SUBMITTED':
      return {
        ...state,
        cash: event.aidType === 'CASH' ? clamp(state.cash - event.amount, 0, Infinity) : state.cash,
        events: appendLog(state.events, state.tick, `📤 Aid sent: ${event.aidType} ${fmtMoney(event.amount)}`),
      };

    // ── Season ────────────────────────────────────────────────────────────
    case 'SEASON_PULSE': {
      const next = advanceSeason(state.season, event.xpGained * XP_PER_MONTH_CASHFLOW_UNIT);
      return { ...state, season: next };
    }

    // ── Checkpoint (20M-scale resume-on-disconnect) ───────────────────────
    case 'CHECKPOINT_SAVED':
      return { ...state, lastCheckpointTick: state.tick };

    // ── Telemetry ─────────────────────────────────────────────────────────
    case 'TELEMETRY_EMIT':
      return {
        ...state,
        telemetry: pushTelemetry(state.telemetry, {
          tick:    state.tick,
          type:    event.telemetryType,
          payload: event.payload,
        }),
      };

    // ── Error Recovery ────────────────────────────────────────────────────
    case 'RUNTIME_ERROR':
      return {
        ...state,
        events: appendLog(state.events, state.tick, `⚠️ Runtime error: ${event.errorCode ?? 'UNKNOWN'} — ${event.message ?? ''}`),
        telemetry: pushTelemetry(state.telemetry, {
          tick: state.tick, type: 'runtime.error',
          payload: { errorCode: event.errorCode ?? 'UNKNOWN', message: event.message ?? '' },
        }),
      };

    default:
      return state;
  }
}

// ── Private Helpers ────────────────────────────────────────────────────────────

/** Append to event log ring buffer — cap at MAX_LOG entries. */
function appendLog(events: string[], tick: number, msg: string): string[] {
  const next = events.length >= MAX_LOG
    ? events.slice(events.length - MAX_LOG + 1)
    : events;
  return [...next, `[T${tick}] ${msg}`];
}

/** Append to equity history ring buffer — cap at MAX_EQUITY_POINTS entries. */
function appendEquity(history: number[], value: number): number[] {
  const next = history.length >= MAX_EQUITY_POINTS
    ? history.slice(history.length - MAX_EQUITY_POINTS + 1)
    : history;
  return [...next, value];
}

/** Push to telemetry ring buffer — cap at TELEMETRY_BATCH_SIZE × 6 entries. */
function pushTelemetry(
  telemetry: RunState['telemetry'],
  entry: { tick: number; type: string; payload: Record<string, number | string | boolean | null> },
): RunState['telemetry'] {
  const cap = TELEMETRY_BATCH_SIZE * 6;
  const next = telemetry.length >= cap ? telemetry.slice(telemetry.length - cap + 1) : telemetry;
  return [...next, entry];
}

/**
 * Advance season state for a settlement of a given magnitude.
 * Called by MONTHLY_SETTLEMENT and SEASON_PULSE.
 * Pure function — no imports needed; SeasonState fully typed above.
 */
function advanceSeason(season: SeasonState, settlementOrXpBase: number): SeasonState {
  const xpGain = Math.max(
    XP_MIN_PER_SETTLEMENT,
    Math.round(Math.max(0, settlementOrXpBase) / XP_PER_MONTH_CASHFLOW_UNIT),
  );
  const next: SeasonState = {
    ...season,
    xp:              season.xp + xpGain,
    dominionControl: clamp(season.dominionControl + (settlementOrXpBase > 0 ? 1 : -1), 0, 9999),
    nodePressure:    clamp(season.nodePressure + (settlementOrXpBase < 0 ? 2 : -1), 0, 9999),
    rewardsPending:  season.rewardsPending + (settlementOrXpBase > 0 ? 1 : 0),
    winStreak:       settlementOrXpBase > 0 ? season.winStreak + 1 : 0,
  };
  next.passTier        = Math.max(1, Math.floor(next.xp / 100) + 1);
  next.battlePassLevel = next.passTier;
  return next;
}

/** Flat XP grant without full season advance logic. Used for card plays. */
function grantXP(season: SeasonState, xp: number): SeasonState {
  const next = { ...season, xp: season.xp + xp };
  next.passTier        = Math.max(1, Math.floor(next.xp / 100) + 1);
  next.battlePassLevel = next.passTier;
  return next;
}

/** Compute Phantom ghost gap zone from gap percentage and direction. */
function computeGapZone(
  gapPct: number,
  isAhead: boolean,
): PhantomModeExt['gapZone'] {
  const absGap = Math.abs(gapPct);
  if (isAhead) {
    if (absGap > 30) return 'FAR_AHEAD';
    return 'AHEAD';
  }
  if (absGap > 30) return 'CRITICAL';
  if (absGap > 10) return 'BEHIND';
  return 'EVEN';
}
