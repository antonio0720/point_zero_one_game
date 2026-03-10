// backend/src/game/modes/head_to_head_mode.ts

import { createHash } from 'node:crypto';
import { CardRegistry } from '../engine/card_registry';
import {
  DeckType,
  GameMode,
  PressureTier,
} from '../engine/card_types';

/**
 * POINT ZERO ONE — HEAD TO HEAD MODE ENGINE
 * backend/src/game/modes/head_to_head_mode.ts
 *
 * Doctrine-aligned backend mode implementation for Predator / financial combat.
 * Key mechanics:
 * - Shared Opportunity deck
 * - Battle Budget economy
 * - 8-second first-refusal window
 * - 12-second shared discard window
 * - 5-second counter-play window
 * - once-per-3-tick extraction cadence
 * - visible threat queue
 * - bleed-through multiplier for critical extractions
 * - CORD-weighted tie breaker
 */

export type HeadToHeadActionType =
  | 'ADVANCE_TICK'
  | 'DRAW_SHARED_OPPORTUNITY'
  | 'CLAIM_SHARED_OPPORTUNITY'
  | 'PASS_SHARED_OPPORTUNITY'
  | 'FIRE_EXTRACTION'
  | 'RESPOND_COUNTER'
  | 'RESOLVE_COUNTER_WINDOW'
  | 'RECORD_BOT_REDIRECT'
  | 'RECORD_FREEDOM'
  | 'ADD_PRIVATE_IPA_CARD';

export type PsycheState =
  | 'CALM'
  | 'TENSE'
  | 'CRACKING'
  | 'BROKEN';

export type HeadToHeadStatus =
  | 'market_dumped'
  | 'cards_locked'
  | 'misinformation_flood'
  | 'forced_fubar_next_tick'
  | 'debt_injected'
  | 'hostile_takeover_debuff'
  | 'next_sabotage_x2_3ticks';

export type CounterCardKey =
  | 'LIQUIDITY_WALL'
  | 'CREDIT_FREEZE'
  | 'EVIDENCE_FILE'
  | 'SIGNAL_CLEAR'
  | 'DEBT_SHIELD'
  | 'SOVEREIGNTY_LOCK'
  | 'FORCED_DRAW_BLOCK';

export type ExtractionType =
  | 'MARKET_DUMP'
  | 'CREDIT_REPORT_PULL'
  | 'REGULATORY_FILING'
  | 'MISINFORMATION_FLOOD'
  | 'DEBT_INJECTION'
  | 'HOSTILE_TAKEOVER'
  | 'LIQUIDATION_NOTICE';

export interface HeadToHeadPlayerState {
  readonly playerId: string;
  readonly displayName: string;
  readonly cash: number;
  readonly income: number;
  readonly expenses: number;
  readonly netWorth: number;
  readonly pressure: number;
  readonly pressureTier: PressureTier;
  readonly shields: number;
  readonly battleBudget: number;
  readonly creditLineScore: number;
  readonly psycheState: PsycheState;
  readonly rivalryHeat: number;
  readonly activeStatuses: readonly HeadToHeadStatus[];
  readonly privateIpaCardIds: readonly string[];
  readonly claimedOpportunityCardIds: readonly string[];
  readonly lastExtractionTick: number | null;
  readonly extractionHits: number;
  readonly extractionMisses: number;
  readonly countersLanded: number;
  readonly countersMissed: number;
  readonly cardsLockedUntilTick: number | null;
  readonly misinformationUntilTick: number | null;
  readonly hostileTakeoverStacks: number;
  readonly debtInjectionStacks: number;
  readonly forcedFubarAtTick: number | null;
  readonly temporaryIncomePenaltyPct: number;
  readonly temporaryIncomePenaltyUntilTick: number | null;
  readonly freedomAtTick: number | null;
  readonly finalCord: number | null;
  readonly averageDecisionSpeedMs: number | null;
  readonly cascadeChainsBroken: number;
  readonly winStreak: number;
}

export interface SharedOpportunityOffer {
  readonly offerId: string;
  readonly cardId: string;
  readonly firstViewerId: string;
  readonly openedAtTick: number;
  readonly openedAtTimestampMs: number;
  readonly exclusiveEndsAtTimestampMs: number;
  readonly discardAtTimestampMs: number;
  readonly passedByPlayerIds: readonly string[];
}

export interface PendingCounterWindow {
  readonly windowId: string;
  readonly attackerId: string;
  readonly targetId: string;
  readonly extractionType: ExtractionType;
  readonly openedAtTick: number;
  readonly openedAtTimestampMs: number;
  readonly deadlineTimestampMs: number;
  readonly counterableBy: CounterCardKey;
  readonly critical: boolean;
  readonly sourceCardId?: string;
  readonly resolved: boolean;
  readonly countered: boolean;
  readonly counterCardKey?: CounterCardKey;
  readonly counteredAtTimestampMs?: number;
}

export interface ThreatQueueEntry {
  readonly tick: number;
  readonly attackerId: string;
  readonly targetId: string;
  readonly extractionType: ExtractionType;
  readonly magnitude: number;
}

export interface HeadToHeadEvent {
  readonly tick: number;
  readonly type: HeadToHeadActionType | 'SYSTEM';
  readonly actorId: string | null;
  readonly targetId: string | null;
  readonly amount: number | null;
  readonly detail: string;
}

export interface HeadToHeadMacroState {
  readonly tick: number;
  readonly sharedClockMs: number;
  readonly sharedOpportunityDeck: readonly string[];
  readonly exhaustedOpportunityDeck: boolean;
  readonly activeOffer: SharedOpportunityOffer | null;
  readonly removedSharedOpportunityCardIds: readonly string[];
  readonly pendingCounterWindow: PendingCounterWindow | null;
  readonly threatQueue: readonly ThreatQueueEntry[];
  readonly eventLog: readonly HeadToHeadEvent[];
  readonly spectatorCount: number;
  readonly firstBloodAttackerId: string | null;
  readonly spectatorPredictionPool: number;
}

export interface HeadToHeadModeState {
  readonly runId: string;
  readonly seed: string;
  readonly players: readonly HeadToHeadPlayerState[];
  readonly macro: HeadToHeadMacroState;
}

export interface AdvanceTickAction {
  readonly type: 'ADVANCE_TICK';
  readonly timestampMs: number;
  readonly sharedClockAdvanceMs?: number;
  readonly pressureDeltaByPlayerId?: Readonly<Record<string, number>>;
}

export interface DrawSharedOpportunityAction {
  readonly type: 'DRAW_SHARED_OPPORTUNITY';
  readonly viewerId: string;
  readonly timestampMs: number;
}

export interface ClaimSharedOpportunityAction {
  readonly type: 'CLAIM_SHARED_OPPORTUNITY';
  readonly playerId: string;
  readonly offerId: string;
  readonly timestampMs: number;
}

export interface PassSharedOpportunityAction {
  readonly type: 'PASS_SHARED_OPPORTUNITY';
  readonly playerId: string;
  readonly offerId: string;
  readonly timestampMs: number;
}

export interface FireExtractionAction {
  readonly type: 'FIRE_EXTRACTION';
  readonly attackerId: string;
  readonly targetId: string;
  readonly extractionType: ExtractionType;
  readonly timestampMs: number;
  readonly critical?: boolean;
  readonly sourceCardId?: string;
}

export interface RespondCounterAction {
  readonly type: 'RESPOND_COUNTER';
  readonly playerId: string;
  readonly windowId: string;
  readonly counterCardKey: CounterCardKey;
  readonly timestampMs: number;
}

export interface ResolveCounterWindowAction {
  readonly type: 'RESOLVE_COUNTER_WINDOW';
  readonly windowId: string;
  readonly timestampMs: number;
}

export interface RecordBotRedirectAction {
  readonly type: 'RECORD_BOT_REDIRECT';
  readonly playerId: string;
  readonly botId: string;
  readonly heat: number;
}

export interface RecordFreedomAction {
  readonly type: 'RECORD_FREEDOM';
  readonly playerId: string;
  readonly cord: number;
  readonly averageDecisionSpeedMs: number;
  readonly cascadeChainsBroken: number;
}

export interface AddPrivateIpaCardAction {
  readonly type: 'ADD_PRIVATE_IPA_CARD';
  readonly playerId: string;
  readonly cardId: string;
}

export type HeadToHeadModeAction =
  | AdvanceTickAction
  | DrawSharedOpportunityAction
  | ClaimSharedOpportunityAction
  | PassSharedOpportunityAction
  | FireExtractionAction
  | RespondCounterAction
  | ResolveCounterWindowAction
  | RecordBotRedirectAction
  | RecordFreedomAction
  | AddPrivateIpaCardAction;

const FIRST_REFUSAL_MS = 8_000;
const SHARED_OPEN_TOTAL_MS = 12_000;
const COUNTER_WINDOW_MS = 5_000;
const MAX_BATTLE_BUDGET = 200;
const EXTRACTION_COOLDOWN_TICKS = 3;
const MAX_THREAT_QUEUE_SIZE = 2;

const EXTRACTION_CATALOG: Readonly<
  Record<
    ExtractionType,
    {
      readonly battleBudgetCost: number;
      readonly counterCardKey: CounterCardKey;
      readonly baseMagnitude: number;
    }
  >
> = {
  MARKET_DUMP: {
    battleBudgetCost: 30,
    counterCardKey: 'LIQUIDITY_WALL',
    baseMagnitude: 0.2,
  },
  CREDIT_REPORT_PULL: {
    battleBudgetCost: 25,
    counterCardKey: 'CREDIT_FREEZE',
    baseMagnitude: 15,
  },
  REGULATORY_FILING: {
    battleBudgetCost: 35,
    counterCardKey: 'EVIDENCE_FILE',
    baseMagnitude: 3,
  },
  MISINFORMATION_FLOOD: {
    battleBudgetCost: 20,
    counterCardKey: 'SIGNAL_CLEAR',
    baseMagnitude: 2,
  },
  DEBT_INJECTION: {
    battleBudgetCost: 40,
    counterCardKey: 'DEBT_SHIELD',
    baseMagnitude: 12,
  },
  HOSTILE_TAKEOVER: {
    battleBudgetCost: 60,
    counterCardKey: 'SOVEREIGNTY_LOCK',
    baseMagnitude: 0.5,
  },
  LIQUIDATION_NOTICE: {
    battleBudgetCost: 45,
    counterCardKey: 'FORCED_DRAW_BLOCK',
    baseMagnitude: 1,
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function stableId(prefix: string, ...parts: ReadonlyArray<string | number>): string {
  return `${prefix}_${createHash('sha256')
    .update(parts.join('|'))
    .digest('hex')
    .slice(0, 16)}`;
}

function pressureTierFromPressure(pressure: number): PressureTier {
  if (pressure >= 90) {
    return PressureTier.T4_COLLAPSE_IMMINENT;
  }
  if (pressure >= 70) {
    return PressureTier.T3_ELEVATED;
  }
  if (pressure >= 45) {
    return PressureTier.T2_STRESSED;
  }
  if (pressure >= 20) {
    return PressureTier.T1_STABLE;
  }
  return PressureTier.T0_SOVEREIGN;
}

function psycheFromPressure(pressure: number): PsycheState {
  if (pressure >= 90) {
    return 'BROKEN';
  }
  if (pressure >= 70) {
    return 'CRACKING';
  }
  if (pressure >= 45) {
    return 'TENSE';
  }
  return 'CALM';
}

function byPlayerId(
  players: readonly HeadToHeadPlayerState[],
  playerId: string,
): HeadToHeadPlayerState {
  const found = players.find((player) => player.playerId === playerId);
  if (!found) {
    throw new Error(`Unknown HEAD_TO_HEAD player '${playerId}'.`);
  }
  return found;
}

function replacePlayer(
  players: readonly HeadToHeadPlayerState[],
  updated: HeadToHeadPlayerState,
): HeadToHeadPlayerState[] {
  return players.map((player) =>
    player.playerId === updated.playerId ? updated : player,
  );
}

function recalcPlayer(player: HeadToHeadPlayerState, tick: number): HeadToHeadPlayerState {
  const lockExpired =
    player.cardsLockedUntilTick !== null && tick > player.cardsLockedUntilTick;
  const misinformationExpired =
    player.misinformationUntilTick !== null && tick > player.misinformationUntilTick;
  const penaltyExpired =
    player.temporaryIncomePenaltyUntilTick !== null &&
    tick > player.temporaryIncomePenaltyUntilTick;

  const temporaryIncomePenaltyPct = penaltyExpired ? 0 : player.temporaryIncomePenaltyPct;
  const effectiveIncome =
    player.income * Math.max(0, 1 - temporaryIncomePenaltyPct);

  const netWorth = round2(player.cash + effectiveIncome * 6 - player.expenses * 4);
  const pressure = clamp(player.pressure, 0, 100);

  return {
    ...player,
    pressure,
    pressureTier: pressureTierFromPressure(pressure),
    psycheState: psycheFromPressure(pressure),
    netWorth,
    cardsLockedUntilTick: lockExpired ? null : player.cardsLockedUntilTick,
    misinformationUntilTick: misinformationExpired ? null : player.misinformationUntilTick,
    activeStatuses: player.activeStatuses.filter((status) => {
      if (status === 'cards_locked') {
        return !lockExpired;
      }
      if (status === 'misinformation_flood') {
        return !misinformationExpired;
      }
      return true;
    }),
    temporaryIncomePenaltyPct,
    temporaryIncomePenaltyUntilTick: penaltyExpired
      ? null
      : player.temporaryIncomePenaltyUntilTick,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function appendEvent(
  state: HeadToHeadModeState,
  type: HeadToHeadEvent['type'],
  actorId: string | null,
  targetId: string | null,
  amount: number | null,
  detail: string,
): HeadToHeadModeState {
  const event: HeadToHeadEvent = {
    tick: state.macro.tick,
    type,
    actorId,
    targetId,
    amount,
    detail,
  };

  return {
    ...state,
    macro: {
      ...state.macro,
      eventLog: [...state.macro.eventLog, event],
    },
  };
}

function mutatePlayer(
  state: HeadToHeadModeState,
  playerId: string,
  transform: (player: HeadToHeadPlayerState) => HeadToHeadPlayerState,
): HeadToHeadModeState {
  const current = byPlayerId(state.players, playerId);
  const updated = recalcPlayer(transform(current), state.macro.tick);

  return {
    ...state,
    players: replacePlayer(state.players, updated),
  };
}

function counterMatches(
  extractionType: ExtractionType,
  counterCardKey: CounterCardKey,
): boolean {
  return EXTRACTION_CATALOG[extractionType].counterCardKey === counterCardKey;
}

function awardBattleBudgetForPressureTier(
  tier: PressureTier,
): number {
  return tier === PressureTier.T3_ELEVATED || tier === PressureTier.T4_COLLAPSE_IMMINENT ? 4 : 2;
}

function computeCordTieBreakerScore(player: HeadToHeadPlayerState): number {
  const shieldsPct = clamp(player.shields / 100, 0, 1);
  const speedScore =
    player.averageDecisionSpeedMs === null
      ? 0
      : 1 / Math.max(1, player.averageDecisionSpeedMs);
  const chainScore = player.cascadeChainsBroken * 0.00001;

  return (player.finalCord ?? 0) + shieldsPct * 0.001 + speedScore + chainScore;
}

function setOrRemoveStatus(
  statuses: readonly HeadToHeadStatus[],
  status: HeadToHeadStatus,
  enabled: boolean,
): HeadToHeadStatus[] {
  const set = new Set(statuses);
  if (enabled) {
    set.add(status);
  } else {
    set.delete(status);
  }
  return [...set];
}

function applyIncomeFlow(player: HeadToHeadPlayerState, tick: number): HeadToHeadPlayerState {
  const penalty =
    player.temporaryIncomePenaltyUntilTick !== null &&
    tick <= player.temporaryIncomePenaltyUntilTick
      ? player.temporaryIncomePenaltyPct
      : 0;

  const realizedIncome = player.income * Math.max(0, 1 - penalty);
  const cash = Math.max(0, player.cash + realizedIncome - player.expenses);

  let debtInjectionStacks = player.debtInjectionStacks;
  let expenses = player.expenses;

  if (player.activeStatuses.includes('debt_injected')) {
    debtInjectionStacks += 1;
    const multiplier =
      debtInjectionStacks >= 3 ? 1.25 : debtInjectionStacks === 2 ? 1.17 : 1.12;
    expenses = round2(player.expenses * multiplier);
  }

  return recalcPlayer(
    {
      ...player,
      cash,
      expenses,
      debtInjectionStacks,
    },
    tick,
  );
}

function normalizeThreatQueue(
  queue: readonly ThreatQueueEntry[],
): ThreatQueueEntry[] {
  return [...queue].slice(-MAX_THREAT_QUEUE_SIZE);
}

function applyExtraction(
  state: HeadToHeadModeState,
  extractionType: ExtractionType,
  attackerId: string,
  targetId: string,
  critical: boolean,
): HeadToHeadModeState {
  const attacker = byPlayerId(state.players, attackerId);
  const target = byPlayerId(state.players, targetId);
  const spec = EXTRACTION_CATALOG[extractionType];
  const bleedMultiplier = critical ? 1.4 : 1;
  let next = state;

  switch (extractionType) {
    case 'MARKET_DUMP': {
      const basePenalty =
        target.psycheState === 'CRACKING' || target.psycheState === 'BROKEN'
          ? 0.3
          : spec.baseMagnitude;

      next = mutatePlayer(next, targetId, (player) =>
        recalcPlayer(
          {
            ...player,
            temporaryIncomePenaltyPct: clamp(basePenalty * bleedMultiplier, 0, 0.9),
            temporaryIncomePenaltyUntilTick:
              next.macro.tick +
              (player.psycheState === 'CRACKING' || player.psycheState === 'BROKEN' ? 3 : 2),
            activeStatuses: setOrRemoveStatus(player.activeStatuses, 'market_dumped', true),
            pressure: clamp(player.pressure + 8, 0, 100),
          },
          next.macro.tick,
        ),
      );
      break;
    }

    case 'CREDIT_REPORT_PULL': {
      next = mutatePlayer(next, targetId, (player) =>
        recalcPlayer(
          {
            ...player,
            creditLineScore: clamp(
              player.creditLineScore - Math.ceil(spec.baseMagnitude * bleedMultiplier),
              0,
              100,
            ),
            expenses:
              player.creditLineScore < 20
                ? round2(player.expenses * 1.08)
                : player.expenses,
            pressure: clamp(player.pressure + 6, 0, 100),
          },
          next.macro.tick,
        ),
      );
      break;
    }

    case 'REGULATORY_FILING': {
      next = mutatePlayer(next, targetId, (player) =>
        recalcPlayer(
          {
            ...player,
            cardsLockedUntilTick: next.macro.tick + 3,
            activeStatuses: setOrRemoveStatus(player.activeStatuses, 'cards_locked', true),
            pressure: clamp(player.pressure + 10, 0, 100),
          },
          next.macro.tick,
        ),
      );
      break;
    }

    case 'MISINFORMATION_FLOOD': {
      next = mutatePlayer(next, targetId, (player) =>
        recalcPlayer(
          {
            ...player,
            misinformationUntilTick: next.macro.tick + 2,
            activeStatuses: setOrRemoveStatus(player.activeStatuses, 'misinformation_flood', true),
            pressure: clamp(player.pressure + 7, 0, 100),
          },
          next.macro.tick,
        ),
      );
      break;
    }

    case 'DEBT_INJECTION': {
      next = mutatePlayer(next, targetId, (player) =>
        recalcPlayer(
          {
            ...player,
            activeStatuses: setOrRemoveStatus(player.activeStatuses, 'debt_injected', true),
            debtInjectionStacks: player.debtInjectionStacks + 1,
            pressure: clamp(player.pressure + 9, 0, 100),
          },
          next.macro.tick,
        ),
      );
      break;
    }

    case 'HOSTILE_TAKEOVER': {
      next = mutatePlayer(next, targetId, (player) =>
        recalcPlayer(
          {
            ...player,
            income: round2(player.income * (1 - 0.5 * bleedMultiplier)),
            hostileTakeoverStacks: player.hostileTakeoverStacks + 1,
            activeStatuses: setOrRemoveStatus(player.activeStatuses, 'hostile_takeover_debuff', true),
            pressure: clamp(player.pressure + 14, 0, 100),
          },
          next.macro.tick,
        ),
      );
      break;
    }

    case 'LIQUIDATION_NOTICE': {
      next = mutatePlayer(next, targetId, (player) =>
        recalcPlayer(
          {
            ...player,
            forcedFubarAtTick: next.macro.tick + 1,
            activeStatuses: setOrRemoveStatus(player.activeStatuses, 'forced_fubar_next_tick', true),
            pressure: clamp(player.pressure + 12, 0, 100),
          },
          next.macro.tick,
        ),
      );
      break;
    }

    default:
      break;
  }

  next = mutatePlayer(next, attackerId, (player) =>
    recalcPlayer(
      {
        ...player,
        extractionHits: player.extractionHits + 1,
        rivalryHeat: clamp(player.rivalryHeat + 6, 0, 100),
        battleBudget: clamp(
          player.battleBudget + 8 + (next.macro.firstBloodAttackerId === null ? 5 : 0),
          0,
          MAX_BATTLE_BUDGET,
        ),
      },
      next.macro.tick,
    ),
  );

  next = mutatePlayer(next, targetId, (player) =>
    recalcPlayer(
      {
        ...player,
        shields:
          extractionType === 'HOSTILE_TAKEOVER'
            ? player.shields
            : clamp(player.shields - Math.ceil(8 * bleedMultiplier), 0, 100),
      },
      next.macro.tick,
    ),
  );

  const targetAfter = byPlayerId(next.players, targetId);
  if (targetAfter.shields <= 0) {
    next = mutatePlayer(next, attackerId, (player) =>
      recalcPlayer(
        {
          ...player,
          battleBudget: clamp(player.battleBudget + 15, 0, MAX_BATTLE_BUDGET),
        },
        next.macro.tick,
      ),
    );
  }

  return {
    ...next,
    macro: {
      ...next.macro,
      firstBloodAttackerId: next.macro.firstBloodAttackerId ?? attackerId,
      threatQueue: normalizeThreatQueue([
        ...next.macro.threatQueue,
        {
          tick: next.macro.tick,
          attackerId,
          targetId,
          extractionType,
          magnitude: spec.baseMagnitude * bleedMultiplier,
        },
      ]),
    },
  };
}

function resolveCounterWindow(
  state: HeadToHeadModeState,
  action: ResolveCounterWindowAction,
): HeadToHeadModeState {
  const window = state.macro.pendingCounterWindow;
  if (!window || window.windowId !== action.windowId) {
    throw new Error(`Unknown counter window '${action.windowId}'.`);
  }
  if (window.resolved) {
    return state;
  }

  let nextState = state;

  if (window.countered) {
    nextState = mutatePlayer(nextState, window.targetId, (player) =>
      recalcPlayer(
        {
          ...player,
          battleBudget: clamp(player.battleBudget + 12, 0, MAX_BATTLE_BUDGET),
          countersLanded: player.countersLanded + 1,
        },
        nextState.macro.tick,
      ),
    );

    nextState = mutatePlayer(nextState, window.attackerId, (player) =>
      recalcPlayer(
        {
          ...player,
          extractionMisses: player.extractionMisses + 1,
          pressure: clamp(player.pressure + 4, 0, 100),
        },
        nextState.macro.tick,
      ),
    );

    nextState = appendEvent(
      nextState,
      'RESOLVE_COUNTER_WINDOW',
      window.targetId,
      window.attackerId,
      null,
      `counter_landed:${window.extractionType}:${window.counterCardKey}`,
    );
  } else {
    nextState = applyExtraction(
      nextState,
      window.extractionType,
      window.attackerId,
      window.targetId,
      window.critical,
    );

    nextState = appendEvent(
      nextState,
      'RESOLVE_COUNTER_WINDOW',
      window.attackerId,
      window.targetId,
      null,
      `extraction_landed:${window.extractionType}:critical=${window.critical}`,
    );
  }

  return {
    ...nextState,
    macro: {
      ...nextState.macro,
      pendingCounterWindow: null,
    },
  };
}

function applyTick(
  state: HeadToHeadModeState,
  action: AdvanceTickAction,
): HeadToHeadModeState {
  let nextState: HeadToHeadModeState = {
    ...state,
    macro: {
      ...state.macro,
      tick: state.macro.tick + 1,
      sharedClockMs: state.macro.sharedClockMs + (action.sharedClockAdvanceMs ?? 1_000),
    },
  };

  const activeWindow = nextState.macro.pendingCounterWindow;
  if (
    activeWindow &&
    !activeWindow.resolved &&
    action.timestampMs >= activeWindow.deadlineTimestampMs
  ) {
    nextState = resolveCounterWindow(nextState, {
      type: 'RESOLVE_COUNTER_WINDOW',
      windowId: activeWindow.windowId,
      timestampMs: action.timestampMs,
    });
  }

  const activeOffer = nextState.macro.activeOffer;
  if (
    activeOffer &&
    action.timestampMs >= activeOffer.discardAtTimestampMs
  ) {
    nextState = appendEvent(
      {
        ...nextState,
        macro: {
          ...nextState.macro,
          activeOffer: null,
          removedSharedOpportunityCardIds: [
            ...nextState.macro.removedSharedOpportunityCardIds,
            activeOffer.cardId,
          ],
        },
      },
      'SYSTEM',
      null,
      null,
      null,
      `shared_offer_discarded:${activeOffer.cardId}`,
    );
  }

  for (const player of nextState.players) {
    const pressureDelta = action.pressureDeltaByPlayerId?.[player.playerId] ?? 0;

    nextState = mutatePlayer(nextState, player.playerId, (entry) => {
      const flowed = applyIncomeFlow(entry, nextState.macro.tick);
      const forcedFubarNow = flowed.forcedFubarAtTick === nextState.macro.tick;

      const nextCash = forcedFubarNow
        ? Math.max(0, flowed.cash - 6000)
        : flowed.cash;

      const nextPressure = forcedFubarNow
        ? clamp(flowed.pressure + pressureDelta + 10, 0, 100)
        : clamp(flowed.pressure + pressureDelta, 0, 100);

      const nextStatuses = forcedFubarNow
        ? setOrRemoveStatus(flowed.activeStatuses, 'forced_fubar_next_tick', false)
        : flowed.activeStatuses;

      return recalcPlayer(
        {
          ...flowed,
          battleBudget: clamp(
            flowed.battleBudget + awardBattleBudgetForPressureTier(flowed.pressureTier),
            0,
            MAX_BATTLE_BUDGET,
          ),
          activeStatuses: nextStatuses,
          cash: nextCash,
          pressure: nextPressure,
          forcedFubarAtTick: forcedFubarNow ? null : flowed.forcedFubarAtTick,
        },
        nextState.macro.tick,
      );
    });
  }

  return appendEvent(
    nextState,
    'ADVANCE_TICK',
    null,
    null,
    null,
    'tick_advanced',
  );
}

function drawSharedOpportunity(
  state: HeadToHeadModeState,
  action: DrawSharedOpportunityAction,
): HeadToHeadModeState {
  if (state.macro.activeOffer) {
    throw new Error('A shared opportunity offer is already active.');
  }

  const remaining = state.macro.sharedOpportunityDeck.filter(
    (cardId) => !state.macro.removedSharedOpportunityCardIds.includes(cardId),
  );

  if (remaining.length === 0) {
    return {
      ...appendEvent(
        state,
        'DRAW_SHARED_OPPORTUNITY',
        action.viewerId,
        null,
        null,
        'shared_opportunity_deck_exhausted',
      ),
      macro: {
        ...state.macro,
        exhaustedOpportunityDeck: true,
      },
    };
  }

  const cardId = remaining[0];
  const offer: SharedOpportunityOffer = {
    offerId: stableId(
      'offer',
      state.runId,
      state.macro.tick,
      cardId,
      action.viewerId,
    ),
    cardId,
    firstViewerId: action.viewerId,
    openedAtTick: state.macro.tick,
    openedAtTimestampMs: action.timestampMs,
    exclusiveEndsAtTimestampMs: action.timestampMs + FIRST_REFUSAL_MS,
    discardAtTimestampMs: action.timestampMs + SHARED_OPEN_TOTAL_MS,
    passedByPlayerIds: [],
  };

  return appendEvent(
    {
      ...state,
      macro: {
        ...state.macro,
        activeOffer: offer,
      },
    },
    'DRAW_SHARED_OPPORTUNITY',
    action.viewerId,
    null,
    null,
    `shared_offer_opened:${cardId}`,
  );
}

function claimSharedOpportunity(
  state: HeadToHeadModeState,
  action: ClaimSharedOpportunityAction,
  registry: CardRegistry,
): HeadToHeadModeState {
  const offer = state.macro.activeOffer;
  if (!offer || offer.offerId !== action.offerId) {
    throw new Error(`Shared opportunity offer '${action.offerId}' is not active.`);
  }

  if (action.timestampMs > offer.discardAtTimestampMs) {
    throw new Error('Shared opportunity offer already expired.');
  }

  if (
    action.playerId !== offer.firstViewerId &&
    action.timestampMs < offer.exclusiveEndsAtTimestampMs
  ) {
    throw new Error('First refusal window is still exclusive.');
  }

  const buyer = byPlayerId(state.players, action.playerId);
  const definition = registry.getOrThrow(offer.cardId);

  if (definition.deckType !== DeckType.OPPORTUNITY) {
    throw new Error(`Card '${definition.cardId}' is not a shared opportunity card.`);
  }

  if (buyer.cash < definition.baseCost) {
    throw new Error(`Player '${action.playerId}' has insufficient cash.`);
  }

  let next = mutatePlayer(state, action.playerId, (player) =>
    recalcPlayer(
      {
        ...player,
        cash: player.cash - definition.baseCost,
        claimedOpportunityCardIds: [...player.claimedOpportunityCardIds, definition.cardId],
        income:
          player.income +
          definition.effects
            .filter((effect) => effect.op === 'income_delta')
            .reduce((sum, effect) => sum + effect.magnitude, 0),
        battleBudget: clamp(player.battleBudget + 6, 0, MAX_BATTLE_BUDGET),
      },
      state.macro.tick,
    ),
  );

  next = appendEvent(
    {
      ...next,
      macro: {
        ...next.macro,
        activeOffer: null,
        removedSharedOpportunityCardIds: [
          ...next.macro.removedSharedOpportunityCardIds,
          definition.cardId,
        ],
      },
    },
    'CLAIM_SHARED_OPPORTUNITY',
    action.playerId,
    null,
    definition.baseCost,
    `claimed_shared_opportunity:${definition.cardId}`,
  );

  return next;
}

function passSharedOpportunity(
  state: HeadToHeadModeState,
  action: PassSharedOpportunityAction,
): HeadToHeadModeState {
  const offer = state.macro.activeOffer;
  if (!offer || offer.offerId !== action.offerId) {
    throw new Error(`Shared opportunity offer '${action.offerId}' is not active.`);
  }

  const updatedOffer: SharedOpportunityOffer = {
    ...offer,
    passedByPlayerIds: [...new Set([...offer.passedByPlayerIds, action.playerId])],
  };

  const bothPassed =
    updatedOffer.passedByPlayerIds.length >= state.players.length;

  const nextState: HeadToHeadModeState = {
    ...state,
    macro: {
      ...state.macro,
      activeOffer: bothPassed ? null : updatedOffer,
      removedSharedOpportunityCardIds: bothPassed
        ? [...state.macro.removedSharedOpportunityCardIds, offer.cardId]
        : state.macro.removedSharedOpportunityCardIds,
    },
  };

  return appendEvent(
    nextState,
    'PASS_SHARED_OPPORTUNITY',
    action.playerId,
    null,
    null,
    bothPassed
      ? `offer_discarded_after_both_passed:${offer.cardId}`
      : `offer_passed:${offer.cardId}`,
  );
}

function fireExtraction(
  state: HeadToHeadModeState,
  action: FireExtractionAction,
): HeadToHeadModeState {
  if (state.macro.pendingCounterWindow) {
    throw new Error('Cannot fire a new extraction while a counter window is active.');
  }
  if (action.attackerId === action.targetId) {
    throw new Error('Attacker and target must differ.');
  }

  const attacker = byPlayerId(state.players, action.attackerId);
  const extraction = EXTRACTION_CATALOG[action.extractionType];

  if (
    attacker.lastExtractionTick !== null &&
    state.macro.tick - attacker.lastExtractionTick < EXTRACTION_COOLDOWN_TICKS
  ) {
    throw new Error('Extraction cooldown has not elapsed.');
  }

  if (attacker.battleBudget < extraction.battleBudgetCost) {
    throw new Error('Insufficient battle budget for extraction.');
  }

  let next = mutatePlayer(state, attacker.playerId, (player) =>
    recalcPlayer(
      {
        ...player,
        battleBudget: clamp(
          player.battleBudget - extraction.battleBudgetCost,
          0,
          MAX_BATTLE_BUDGET,
        ),
        lastExtractionTick: state.macro.tick,
        rivalryHeat: clamp(player.rivalryHeat + 4, 0, 100),
      },
      state.macro.tick,
    ),
  );

  next = mutatePlayer(next, action.targetId, (player) =>
    recalcPlayer(
      {
        ...player,
        pressure: clamp(player.pressure + 4, 0, 100),
      },
      state.macro.tick,
    ),
  );

  const counterWindow: PendingCounterWindow = {
    windowId: stableId(
      'ctr',
      state.runId,
      state.macro.tick,
      action.attackerId,
      action.targetId,
      action.extractionType,
    ),
    attackerId: action.attackerId,
    targetId: action.targetId,
    extractionType: action.extractionType,
    openedAtTick: state.macro.tick,
    openedAtTimestampMs: action.timestampMs,
    deadlineTimestampMs: action.timestampMs + COUNTER_WINDOW_MS,
    counterableBy: extraction.counterCardKey,
    critical: Boolean(action.critical),
    sourceCardId: action.sourceCardId,
    resolved: false,
    countered: false,
  };

  return appendEvent(
    {
      ...next,
      macro: {
        ...next.macro,
        pendingCounterWindow: counterWindow,
      },
    },
    'FIRE_EXTRACTION',
    action.attackerId,
    action.targetId,
    extraction.battleBudgetCost,
    `extraction_opened:${action.extractionType}`,
  );
}

function respondCounter(
  state: HeadToHeadModeState,
  action: RespondCounterAction,
): HeadToHeadModeState {
  const window = state.macro.pendingCounterWindow;
  if (!window || window.windowId !== action.windowId) {
    throw new Error(`Counter window '${action.windowId}' is not active.`);
  }
  if (window.targetId !== action.playerId) {
    throw new Error('Only the target may respond in the counter window.');
  }
  if (!counterMatches(window.extractionType, action.counterCardKey)) {
    throw new Error(`Counter card '${action.counterCardKey}' does not block '${window.extractionType}'.`);
  }
  if (action.timestampMs > window.deadlineTimestampMs) {
    throw new Error('Counter window has already expired.');
  }

  const player = byPlayerId(state.players, action.playerId);
  const counterCost = Math.max(
    8,
    Math.floor(EXTRACTION_CATALOG[window.extractionType].battleBudgetCost * 0.6),
  );

  if (player.battleBudget < counterCost) {
    throw new Error('Insufficient battle budget to counter.');
  }

  const next = mutatePlayer(state, action.playerId, (entry) =>
    recalcPlayer(
      {
        ...entry,
        battleBudget: clamp(entry.battleBudget - counterCost, 0, MAX_BATTLE_BUDGET),
      },
      state.macro.tick,
    ),
  );

  return appendEvent(
    {
      ...next,
      macro: {
        ...next.macro,
        pendingCounterWindow: {
          ...window,
          countered: true,
          resolved: false,
          counterCardKey: action.counterCardKey,
          counteredAtTimestampMs: action.timestampMs,
        },
      },
    },
    'RESPOND_COUNTER',
    action.playerId,
    window.attackerId,
    counterCost,
    `counter_response:${action.counterCardKey}`,
  );
}

function recordBotRedirect(
  state: HeadToHeadModeState,
  action: RecordBotRedirectAction,
): HeadToHeadModeState {
  return appendEvent(
    mutatePlayer(state, action.playerId, (player) =>
      recalcPlayer(
        {
          ...player,
          rivalryHeat: clamp(player.rivalryHeat + Math.ceil(action.heat / 10), 0, 100),
        },
        state.macro.tick,
      ),
    ),
    'RECORD_BOT_REDIRECT',
    action.playerId,
    null,
    action.heat,
    `bot_redirect:${action.botId}`,
  );
}

function addPrivateIpaCard(
  state: HeadToHeadModeState,
  action: AddPrivateIpaCardAction,
  registry: CardRegistry,
): HeadToHeadModeState {
  const definition = registry.getOrThrow(action.cardId);
  if (definition.deckType !== DeckType.IPA) {
    throw new Error(`Card '${action.cardId}' is not an IPA card.`);
  }

  return appendEvent(
    mutatePlayer(state, action.playerId, (player) =>
      recalcPlayer(
        {
          ...player,
          privateIpaCardIds: [...player.privateIpaCardIds, action.cardId],
          income:
            player.income +
            definition.effects
              .filter((effect) => effect.op === 'income_delta')
              .reduce((sum, effect) => sum + effect.magnitude, 0),
        },
        state.macro.tick,
      ),
    ),
    'ADD_PRIVATE_IPA_CARD',
    action.playerId,
    null,
    definition.baseCost,
    `private_ipa_added:${action.cardId}`,
  );
}

function recordFreedom(
  state: HeadToHeadModeState,
  action: RecordFreedomAction,
): HeadToHeadModeState {
  const next = mutatePlayer(state, action.playerId, (player) =>
    recalcPlayer(
      {
        ...player,
        freedomAtTick: state.macro.tick,
        finalCord: action.cord,
        averageDecisionSpeedMs: action.averageDecisionSpeedMs,
        cascadeChainsBroken: action.cascadeChainsBroken,
      },
      state.macro.tick,
    ),
  );

  const finishedPlayers = next.players.filter((player) => player.freedomAtTick !== null);
  let finalNext = next;

  if (finishedPlayers.length === 2) {
    const [first, second] = [...finishedPlayers].sort(
      (left, right) =>
        computeCordTieBreakerScore(right) - computeCordTieBreakerScore(left),
    );

    finalNext = mutatePlayer(finalNext, first.playerId, (player) => ({
      ...player,
      winStreak: player.winStreak + 1,
    }));
    finalNext = mutatePlayer(finalNext, second.playerId, (player) => ({
      ...player,
      winStreak: 0,
    }));

    finalNext = appendEvent(
      finalNext,
      'RECORD_FREEDOM',
      first.playerId,
      second.playerId,
      null,
      `winner_by_tiebreaker:${computeCordTieBreakerScore(first).toFixed(6)}>${computeCordTieBreakerScore(second).toFixed(6)}`,
    );
  }

  return appendEvent(
    finalNext,
    'RECORD_FREEDOM',
    action.playerId,
    null,
    action.cord,
    'freedom_recorded',
  );
}

export class HeadToHeadModeEngine {
  private state: HeadToHeadModeState;
  private readonly registry: CardRegistry;

  public constructor(
    initialState: HeadToHeadModeState,
    registry: CardRegistry = new CardRegistry(),
  ) {
    if (initialState.players.length !== 2) {
      throw new Error('HEAD_TO_HEAD mode requires exactly 2 players.');
    }

    this.registry = registry;
    this.state = {
      ...initialState,
      players: initialState.players.map((player) =>
        recalcPlayer(player, initialState.macro.tick),
      ),
    };
  }

  public getState(): HeadToHeadModeState {
    return this.state;
  }

  public dispatch(action: HeadToHeadModeAction): HeadToHeadModeState {
    switch (action.type) {
      case 'ADVANCE_TICK':
        this.state = applyTick(this.state, action);
        return this.state;

      case 'DRAW_SHARED_OPPORTUNITY':
        this.state = drawSharedOpportunity(this.state, action);
        return this.state;

      case 'CLAIM_SHARED_OPPORTUNITY':
        this.state = claimSharedOpportunity(this.state, action, this.registry);
        return this.state;

      case 'PASS_SHARED_OPPORTUNITY':
        this.state = passSharedOpportunity(this.state, action);
        return this.state;

      case 'FIRE_EXTRACTION':
        this.state = fireExtraction(this.state, action);
        return this.state;

      case 'RESPOND_COUNTER':
        this.state = respondCounter(this.state, action);
        return this.state;

      case 'RESOLVE_COUNTER_WINDOW':
        this.state = resolveCounterWindow(this.state, action);
        return this.state;

      case 'RECORD_BOT_REDIRECT':
        this.state = recordBotRedirect(this.state, action);
        return this.state;

      case 'RECORD_FREEDOM':
        this.state = recordFreedom(this.state, action);
        return this.state;

      case 'ADD_PRIVATE_IPA_CARD':
        this.state = addPrivateIpaCard(this.state, action, this.registry);
        return this.state;

      default: {
        const exhaustive: never = action;
        return exhaustive;
      }
    }
  }
}

export function createInitialHeadToHeadModeState(input: {
  readonly runId: string;
  readonly seed: string;
  readonly players: ReadonlyArray<{
    readonly playerId: string;
    readonly displayName: string;
    readonly cash: number;
    readonly income: number;
    readonly expenses: number;
    readonly shields?: number;
    readonly creditLineScore?: number;
    readonly battleBudget?: number;
  }>;
  readonly spectatorCount?: number;
  readonly registry?: CardRegistry;
  readonly sharedOpportunityDeckSize?: number;
}): HeadToHeadModeState {
  if (input.players.length !== 2) {
    throw new Error('HEAD_TO_HEAD mode requires exactly 2 players.');
  }

  const registry = input.registry ?? new CardRegistry();
  const sharedOpportunityDeck = registry.buildSharedDeck({
    seed: input.seed,
    mode: GameMode.HEAD_TO_HEAD,
    size: input.sharedOpportunityDeckSize ?? 40,
    includeDeckTypes: [DeckType.OPPORTUNITY],
  });

  return {
    runId: input.runId,
    seed: input.seed,
    players: input.players.map((player) => {
      const base: HeadToHeadPlayerState = {
        playerId: player.playerId,
        displayName: player.displayName,
        cash: Math.max(0, player.cash),
        income: Math.max(0, player.income),
        expenses: Math.max(0, player.expenses),
        netWorth: 0,
        pressure: 0,
        pressureTier: PressureTier.T0_SOVEREIGN,
        shields: clamp(player.shields ?? 100, 0, 100),
        battleBudget: clamp(player.battleBudget ?? 0, 0, MAX_BATTLE_BUDGET),
        creditLineScore: clamp(player.creditLineScore ?? 100, 0, 100),
        psycheState: 'CALM',
        rivalryHeat: 0,
        activeStatuses: [],
        privateIpaCardIds: [],
        claimedOpportunityCardIds: [],
        lastExtractionTick: null,
        extractionHits: 0,
        extractionMisses: 0,
        countersLanded: 0,
        countersMissed: 0,
        cardsLockedUntilTick: null,
        misinformationUntilTick: null,
        hostileTakeoverStacks: 0,
        debtInjectionStacks: 0,
        forcedFubarAtTick: null,
        temporaryIncomePenaltyPct: 0,
        temporaryIncomePenaltyUntilTick: null,
        freedomAtTick: null,
        finalCord: null,
        averageDecisionSpeedMs: null,
        cascadeChainsBroken: 0,
        winStreak: 0,
      };

      return recalcPlayer(base, 0);
    }),
    macro: {
      tick: 0,
      sharedClockMs: 0,
      sharedOpportunityDeck,
      exhaustedOpportunityDeck: false,
      activeOffer: null,
      removedSharedOpportunityCardIds: [],
      pendingCounterWindow: null,
      threatQueue: [],
      eventLog: [],
      spectatorCount: clamp(input.spectatorCount ?? 0, 0, 50),
      firstBloodAttackerId: null,
      spectatorPredictionPool: 0,
    },
  };
}