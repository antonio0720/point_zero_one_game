// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/empire/empireRuleEngine.ts
// Sprint 5 — Empire (GO ALONE) Rule Orchestrator
//
// Single interface for all Empire-specific game logic.
// Called by empireCardAdapter and EmpireGameScreen.
// Owns: isolation tax accumulator, bleed state, pressure journal,
//       wave/phase tracking, bot activation schedule, CORD score.
//
// SPRINT 5 ADDITIONS:
//   - EmpireRuntimeState: added currentWave, activeBotsCount, lastPhase,
//     phaseTransitions, botAttackCount, botAttackLog, cordScore, lastBleedSeverity
//   - processEmpireTick(): detects wave transitions, emits PHASE_CHANGED,
//     activates bots, evaluates bleed with shouldEvaluateBleed() guard
//   - processEmpireCardPlay(): emits COMEBACK_SURGE and ISOLATION_TAX_HIT events
//   - processEmpireAttackReceived(): handles incoming bot attacks
//   - processEmpireCounterplay(): records counterplay outcomes
//   - computeEmpireCordScore(): weighted CORD using MODE_CORD_WEIGHTS.EMPIRE
//   - getEmpireBotActivationOrder(): returns which bots to activate this wave
//   - buildEmpireCaseFile(): passes new fields to caseFileMapper
//
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import {
  EMPIRE_CONFIG, EMPIRE_EVENT_NAMES, EMPIRE_PHASE_ACCENTS,
  getEmpireWave, getNewBotForWave,
} from './empireConfig';
import type { EmpirePhase, EmpireWaveConfig } from './empireConfig';
import { computeIsolationTax, isolationTaxApplies, getTaxModifierForCard } from './isolationTax';
import {
  evaluateBleedMode, hasExitedBleed, computeBleedAmplifierBonus,
  isComebackSurgeEligible, shouldEvaluateBleed, bleedEventLabel, INITIAL_BLEED_STATE,
} from './bleedMode';
import type { BleedModeState, BleedSeverity } from './bleedMode';
import {
  tagDecision, appendJournalEntry, appendSnapshot, recordCounterplay,
  recordMissedCounterplay, INITIAL_JOURNAL,
} from './pressureJournalEngine';
import type { PressureJournal, DecisionTag } from './pressureJournalEngine';
import { buildCaseFile } from './caseFileMapper';
import type { CaseFileSummary } from './caseFileMapper';
import { MODE_CORD_WEIGHTS } from '../shared/modeHelpers';
import { bleedRecoveryScore } from './bleedMode';

// ─── EventBus interface (thin — avoids circular dependency) ──────────────────

export interface EmpireEventBus {
  emit(event: string, payload: unknown): void;
}

// ─── Bot attack record ────────────────────────────────────────────────────────

export interface BotAttackRecord {
  tick:      number;
  botId:     string;
  botName:   string;
  wave:      number;
  damage:    number;
  survived:  boolean;
  countered: boolean;
}

export interface PhaseTransitionRecord {
  tick:  number;
  from:  EmpirePhase;
  to:    EmpirePhase;
  wave:  number;
  bots:  number;
}

// ─── Empire Runtime State ─────────────────────────────────────────────────────

export interface EmpireRuntimeState {
  bleed:                  BleedModeState;
  journal:                PressureJournal;
  totalIsolationTaxPaid:  number;
  totalSpend:             number;
  lastSnapshotTick:       number;
  /** Active wave number (1–5) */
  currentWave:            number;
  /** Number of bots currently active */
  activeBotsCount:        number;
  /** Last recorded phase (for change detection) */
  lastPhase:              EmpirePhase;
  /** Phase transition history for case file */
  phaseTransitions:       PhaseTransitionRecord[];
  /** Total bot attacks received this run */
  botAttackCount:         number;
  /** Per-bot-attack log (capped at 200) */
  botAttackLog:           BotAttackRecord[];
  /** Per-wave attack counts */
  botAttacksPerWave:      Record<number, number>;
  /** Running CORD score 0–1 (updated each tick) */
  cordScore:              number;
  /** Last bleed severity for event comparison */
  lastBleedSeverity:      BleedSeverity;
  /** Accumulated tax per phase (for case file) */
  taxByPhase:             Record<string, number>;
}

export const INITIAL_EMPIRE_STATE: EmpireRuntimeState = {
  bleed:                 INITIAL_BLEED_STATE,
  journal:               INITIAL_JOURNAL,
  totalIsolationTaxPaid: 0,
  totalSpend:            0,
  lastSnapshotTick:      0,
  currentWave:           1,
  activeBotsCount:       1,
  lastPhase:             'AWAKENING',
  phaseTransitions:      [],
  botAttackCount:        0,
  botAttackLog:          [],
  botAttacksPerWave:     { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  cordScore:             0.5,
  lastBleedSeverity:     'NONE',
  taxByPhase:            { AWAKENING: 0, RESISTANCE: 0, SIEGE: 0, RECKONING: 0, ANNIHILATION: 0 },
};

// ─── Card Play Resolution ─────────────────────────────────────────────────────

export interface EmpireCardInput {
  cardId:            string;
  cardTitle:         string;
  cardType:          string;
  grossSpend:        number;
  baseCashDelta:     number;
  baseIncomeDelta:   number;
  baseNetWorthDelta: number;
  /** Legacy: kept for backward compat — use cardType for modifier lookup */
  taxModifier:       number;
  bleedAmplifier:    boolean;
  decisionLatencyMs: number;
  tick:              number;
  cash:              number;
  income:            number;
  expenses:          number;
  netWorth:          number;
  shields:           number;
  freezeTicks:       number;
  regime:            string;
  /** True if a bot attacked in the last 3 ticks */
  underBotPressure?: boolean;
}

export interface EmpireCardResult {
  cashDelta:           number;
  incomeDelta:         number;
  netWorthDelta:       number;
  xpGained:           number;
  decisionTag:         DecisionTag;
  isolationTaxAmount:  number;
  bleedBonusIncome:    number;
  comebackSurgeActive: boolean;
  updatedState:        EmpireRuntimeState;
}

export function processEmpireCardPlay(
  input:     EmpireCardInput,
  state:     EmpireRuntimeState,
  eventBus?: EmpireEventBus,
): EmpireCardResult {
  const {
    cardId, cardTitle, cardType, grossSpend,
    baseCashDelta, baseIncomeDelta, baseNetWorthDelta,
    bleedAmplifier, decisionLatencyMs,
    tick, cash, income, expenses, netWorth, shields, freezeTicks, regime,
    underBotPressure = false,
  } = input;

  // 1. Isolation tax — use card-type registry for modifier
  let isolationTaxAmount = 0;
  let effectiveCashDelta = baseCashDelta;
  if (isolationTaxApplies(cardType) && grossSpend > 0) {
    const taxModifier = getTaxModifierForCard(cardType);
    const taxResult   = computeIsolationTax(grossSpend, shields, taxModifier, freezeTicks);
    isolationTaxAmount  = taxResult.taxAmount;
    effectiveCashDelta  = baseCashDelta - isolationTaxAmount;

    if (eventBus && isolationTaxAmount > 0) {
      eventBus.emit(EMPIRE_EVENT_NAMES.ISOLATION_TAX_HIT, {
        tick, taxAmount: isolationTaxAmount,
        effectiveRate: taxResult.effectiveRate,
        totalPaid: state.totalIsolationTaxPaid + isolationTaxAmount,
        label: taxResult.label,
      });
    }
  }

  // 2. Bleed mode amplifier
  const cashflow       = income - expenses;
  const bleedBonusIncome = computeBleedAmplifierBonus(
    baseIncomeDelta, state.bleed.active && bleedAmplifier,
  );
  const effectiveIncomeDelta = baseIncomeDelta + bleedBonusIncome;

  // 3. Decision tag
  const decisionTag = tagDecision({
    spend: grossSpend, cash, cashflow, freezeTicks,
    bleedState: state.bleed, decisionLatencyMs, tick,
    underBotPressure,
  });

  // 4. Comeback surge XP
  const comebackSurgeActive = isComebackSurgeEligible(cashflow, state.bleed);
  const xpGained = 5 + (comebackSurgeActive ? EMPIRE_CONFIG.comebackSurgeXpBonus : 0);

  if (eventBus && comebackSurgeActive && bleedBonusIncome > 0) {
    eventBus.emit(EMPIRE_EVENT_NAMES.COMEBACK_SURGE, {
      tick, cardId, cardTitle,
      incomeDelta: effectiveIncomeDelta,
      xpGained,
    });
  }

  // 5. Update journal
  const updatedJournal = appendJournalEntry(state.journal, {
    tick, cardId, cardTitle, cardType, decisionTag, decisionLatencyMs,
    cashAtPlay: cash, incomeAtPlay: income, cashflowAtPlay: cashflow,
    netWorthAtPlay: netWorth, shields, bleedActive: state.bleed.active,
    bleedSeverity: state.bleed.severity,
    cashDelta: effectiveCashDelta, incomeDelta: effectiveIncomeDelta,
    netWorthDelta: baseNetWorthDelta, xpGained, regime,
    underBotPressure,
  });

  // 6. Accumulate tax by current phase
  const currentPhase = getEmpireWave(tick).phase;
  const updatedTaxByPhase = {
    ...state.taxByPhase,
    [currentPhase]: (state.taxByPhase[currentPhase] ?? 0) + isolationTaxAmount,
  };

  const updatedState: EmpireRuntimeState = {
    ...state,
    journal:               updatedJournal,
    totalIsolationTaxPaid: state.totalIsolationTaxPaid + isolationTaxAmount,
    totalSpend:            state.totalSpend + grossSpend,
    taxByPhase:            updatedTaxByPhase,
  };

  return {
    cashDelta: effectiveCashDelta,
    incomeDelta: effectiveIncomeDelta,
    netWorthDelta: baseNetWorthDelta,
    xpGained, decisionTag, isolationTaxAmount, bleedBonusIncome, comebackSurgeActive,
    updatedState,
  };
}

// ─── Tick Update ──────────────────────────────────────────────────────────────

export interface EmpireTickInput {
  tick:     number;
  cash:     number;
  income:   number;
  expenses: number;
  netWorth: number;
  shields:  number;
  regime:   string;
}

export function processEmpireTick(
  input:     EmpireTickInput,
  state:     EmpireRuntimeState,
  eventBus?: EmpireEventBus,
): EmpireRuntimeState {
  const { tick, cash, income, expenses, netWorth, shields, regime } = input;

  // ── Wave / phase change detection ──
  const wave    = getEmpireWave(tick);
  const newWave = wave.wave;
  const newPhase = wave.phase;

  let updatedState = state;

  if (newWave !== state.currentWave) {
    // Wave transition — activate new bot
    const newBotId = getNewBotForWave(newWave);
    const transition: PhaseTransitionRecord = {
      tick, from: state.lastPhase, to: newPhase,
      wave: newWave, bots: wave.botCount,
    };

    if (eventBus) {
      eventBus.emit(EMPIRE_EVENT_NAMES.PHASE_CHANGED, {
        tick, from: state.lastPhase, to: newPhase,
        wave: newWave, bots: wave.botCount,
      });
      if (newBotId) {
        eventBus.emit(EMPIRE_EVENT_NAMES.BOT_ACTIVATED, {
          tick, botId: newBotId, wave: newWave,
          threatLabel: wave.threatLabel,
          accent: EMPIRE_PHASE_ACCENTS[newPhase],
        });
      }
    }

    updatedState = {
      ...updatedState,
      currentWave:   newWave,
      activeBotsCount: wave.botCount,
      lastPhase:     newPhase,
      phaseTransitions: [...state.phaseTransitions, transition],
    };
  }

  // ── Bleed evaluation (once per tick with guard) ──
  let updatedBleed = updatedState.bleed;
  if (shouldEvaluateBleed(updatedState.bleed, tick)) {
    const prevState    = updatedState.bleed;
    updatedBleed       = evaluateBleedMode(cash, income, expenses, prevState, tick);
    const bleedLabel   = bleedEventLabel(updatedBleed, prevState);

    if (eventBus && bleedLabel) {
      if (!prevState.active && updatedBleed.active) {
        eventBus.emit(EMPIRE_EVENT_NAMES.BLEED_ACTIVATED, {
          tick, severity: updatedBleed.severity,
          cash, cashflow: income - expenses,
          activationNo: updatedBleed.reactivationCount + 1,
        });
      } else if (prevState.active && !updatedBleed.active) {
        eventBus.emit(EMPIRE_EVENT_NAMES.BLEED_RESOLVED, {
          tick, bleedDuration: prevState.bleedDurationTicks,
          peakSeverity: prevState.peakSeverity,
        });
      } else if (updatedBleed.severity !== prevState.severity && updatedBleed.active) {
        eventBus.emit(EMPIRE_EVENT_NAMES.BLEED_ESCALATED, {
          tick, from: prevState.severity, to: updatedBleed.severity,
        });
      }
    }
  }

  // ── Snapshot at interval ──
  const shouldSnapshot = tick - updatedState.lastSnapshotTick >= EMPIRE_CONFIG.pressureJournalSnapshotInterval;
  let updatedJournal = updatedState.journal;
  if (shouldSnapshot) {
    updatedJournal = appendSnapshot(updatedState.journal, {
      tick, cash, income, expenses, cashflow: income - expenses,
      netWorth, shields, bleedActive: updatedBleed.active,
      bleedSeverity: updatedBleed.severity, regime,
    });
  }

  // ── CORD score update ──
  const cordScore = computeEmpireCordScore(
    updatedJournal, updatedBleed, tick,
  );

  return {
    ...updatedState,
    bleed:            updatedBleed,
    journal:          updatedJournal,
    lastSnapshotTick: shouldSnapshot ? tick : updatedState.lastSnapshotTick,
    lastBleedSeverity: updatedBleed.severity,
    cordScore,
  };
}

// ─── Bot Attack Received ──────────────────────────────────────────────────────

export interface EmpireAttackInput {
  tick:      number;
  botId:     string;
  botName:   string;
  damage:    number;
  survived:  boolean;
  countered: boolean;
}

/**
 * Record an incoming bot attack.
 * Called by the orchestrator when BattleEngine fires a bot attack event.
 * Updates botAttackLog, botAttackCount, botAttacksPerWave.
 */
export function processEmpireAttackReceived(
  input:     EmpireAttackInput,
  state:     EmpireRuntimeState,
  eventBus?: EmpireEventBus,
): EmpireRuntimeState {
  const { tick, botId, botName, damage, survived, countered } = input;
  const wave = state.currentWave;

  const record: BotAttackRecord = { tick, botId, botName, wave, damage, survived, countered };
  const botAttackLog = [...state.botAttackLog, record].slice(-200);

  const updatedBotAttacksPerWave = {
    ...state.botAttacksPerWave,
    [wave]: (state.botAttacksPerWave[wave] ?? 0) + (survived ? 1 : 0),
  };

  if (eventBus) {
    eventBus.emit(EMPIRE_EVENT_NAMES.BOT_ATTACK_RECEIVED, {
      tick, botId, botName, damage, survived, countered, wave,
    });
  }

  return {
    ...state,
    botAttackCount:    state.botAttackCount + 1,
    botAttackLog,
    botAttacksPerWave: updatedBotAttacksPerWave,
  };
}

// ─── Counterplay ──────────────────────────────────────────────────────────────

/**
 * Record counterplay outcome against an injected card.
 * Updates journal's botResilienceScore.
 */
export function processEmpireCounterplay(
  successful: boolean,
  state:      EmpireRuntimeState,
): EmpireRuntimeState {
  const updatedJournal = successful
    ? recordCounterplay(state.journal)
    : recordMissedCounterplay(state.journal);
  return { ...state, journal: updatedJournal };
}

// ─── CORD Score ───────────────────────────────────────────────────────────────

/**
 * Compute running CORD score for Empire mode.
 * Uses MODE_CORD_WEIGHTS.EMPIRE weights.
 * Called once per tick in processEmpireTick().
 */
export function computeEmpireCordScore(
  journal:    PressureJournal,
  bleedState: BleedModeState,
  totalTicks: number,
): number {
  const weights = MODE_CORD_WEIGHTS.EMPIRE;

  const decisionQuality = journal.aggregateQuality;

  const pressureResilience = bleedRecoveryScore(
    bleedState.totalBleedTicks,
    totalTicks,
    bleedState.reactivationCount,
    bleedState.peakSeverity,
    journal.panicCount,
    journal.totalEntries,
  );

  // Consistency: inverse of score variance
  const scores = journal.entries.map(e => e.qualityScore);
  const mean   = scores.length > 0
    ? scores.reduce((s, v) => s + v, 0) / scores.length
    : 0.5;
  const variance = scores.length > 1
    ? scores.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / scores.length
    : 0.25;
  const consistency = Math.max(0, Math.min(1, 1 - Math.sqrt(variance) * 2));

  const cord = (
    decisionQuality   * weights.decisionQuality    +
    pressureResilience * weights.pressureResilience +
    consistency        * weights.consistency
  );

  return parseFloat(Math.max(0, Math.min(1, cord)).toFixed(3));
}

// ─── Run Complete ─────────────────────────────────────────────────────────────

export function buildEmpireCaseFile(
  runId:         string,
  seed:          number,
  finalTick:     number,
  outcome:       string,
  finalCash:     number,
  finalNetWorth: number,
  finalIncome:   number,
  finalExpenses: number,
  equityHistory: number[],
  state:         EmpireRuntimeState,
): CaseFileSummary {
  // Total bot attacks survived = sum of all waves
  const botAttacksSurvived = Object.values(state.botAttacksPerWave)
    .reduce((s, v) => s + v, 0);

  return buildCaseFile({
    runId, seed, finalTick, outcome,
    finalCash, finalNetWorth, finalIncome, finalExpenses,
    journal:               state.journal,
    finalBleedState:       state.bleed,
    totalIsolationTaxPaid: state.totalIsolationTaxPaid,
    totalSpend:            state.totalSpend,
    equityHistory,
    taxByPhase:            state.taxByPhase,
    botAttacksPerWave:     state.botAttacksPerWave,
    botAttacksSurvived,
    highestWave:           state.currentWave,
  });
}

// ─── Bot activation helpers ───────────────────────────────────────────────────

/**
 * Returns the ordered list of bot IDs that should be active for the given wave.
 * Used by orchestrator to activate/deactivate bots in HaterBotController.
 */
export function getEmpireBotActivationOrder(wave: number): readonly string[] {
  const waveConfig = getEmpireWave(wave * 144); // approximate tick for wave
  return waveConfig.activeBotIds;
}