// backend/src/game/modes/team_up_mode.ts

import { createHash } from 'node:crypto';
import { CardRegistry } from '../engine/card_registry';
import { GameMode, PressureTier } from '../engine/card_types';

/**
 * POINT ZERO ONE — TEAM UP MODE ENGINE
 * backend/src/game/modes/team_up_mode.ts
 *
 * Doctrine-aligned backend mode implementation for Syndicate / trust architecture.
 * Key mechanics:
 * - shared treasury
 * - 4 role synergy bonus
 * - trust score bands with leakage / access / combo multipliers
 * - aid and rescue windows
 * - treasury loan rules
 * - cascade absorption
 * - defection sequence and 40% treasury split
 * - team chat / proof share / war alerts
 */

export type TeamUpRole =
  | 'INCOME_BUILDER'
  | 'SHIELD_ARCHITECT'
  | 'OPPORTUNITY_HUNTER'
  | 'COUNTER_INTEL';

export type TeamUpActionType =
  | 'ADVANCE_TICK'
  | 'AID_REQUEST'
  | 'PLAY_AID'
  | 'PLAY_RESCUE'
  | 'REQUEST_TREASURY_LOAN'
  | 'CASCADE_ABSORB'
  | 'SEND_DEAL_INVITE'
  | 'RESPOND_DEAL_INVITE'
  | 'PROOF_SHARE'
  | 'PLAY_DEFECTION_STEP'
  | 'COMMIT_DEFECTION';

export type TeamUpDefectionStep =
  | 'NONE'
  | 'BREAK_PACT'
  | 'SILENT_EXIT'
  | 'ASSET_SEIZURE'
  | 'DEFECTED';

export type TeamUpChatReaction = '👑' | '💰' | '🔥' | '💀' | '✅' | '❌';

export type TeamUpAidType =
  | 'LIQUIDITY_BRIDGE'
  | 'SHIELD_LOAN'
  | 'EXPANSION_LEASE';

export type TeamUpRescueType =
  | 'EMERGENCY_CAPITAL'
  | 'CASCADE_BREAK'
  | 'TIME_DEBT_PAID'
  | 'COORDINATED_REFINANCE';

export type TeamUpStatus =
  | 'aid_requested'
  | 'critical_pressure'
  | 'loan_default_risk'
  | 'defection_risk'
  | 'rescued_recently'
  | 'loyalty_bonus'
  | 'proof_shared'
  | 'defected';

export interface TeamUpPlayerState {
  readonly playerId: string;
  readonly displayName: string;
  readonly role: TeamUpRole;
  readonly cash: number;
  readonly income: number;
  readonly expenses: number;
  readonly liabilities: number;
  readonly netWorth: number;
  readonly pressure: number;
  readonly pressureTier: PressureTier;
  readonly shields: number;
  readonly trustScore: number;
  readonly activeStatuses: readonly TeamUpStatus[];
  readonly aidRequests: number;
  readonly aidGivenCount: number;
  readonly aidReceivedCount: number;
  readonly rescueGivenCount: number;
  readonly rescueReceivedCount: number;
  readonly cascadeAbsorptions: number;
  readonly loansTaken: number;
  readonly outstandingLoanIds: readonly string[];
  readonly loyaltyHelpReceived: number;
  readonly proofShares: number;
  readonly hiddenIntentScore: number;
  readonly defectionStep: TeamUpDefectionStep;
  readonly defected: boolean;
  readonly defectionCount: number;
  readonly freedomThresholdMultiplier: number;
  readonly cordFlatModifier: number;
  readonly sovereigntyScoreFlat: number;
  readonly riskSignalRaised: boolean;
  readonly consecutiveLoanCrisisTicks: number;
  readonly handCardIds: readonly string[];
}

export interface TeamUpLoan {
  readonly loanId: string;
  readonly borrowerId: string;
  readonly principal: number;
  readonly outstandingBalance: number;
  readonly issuedTick: number;
  readonly remainingIncomeTicks: number;
  readonly repaid: boolean;
  readonly defaulted: boolean;
}

export interface DealInvite {
  readonly inviteId: string;
  readonly actorId: string;
  readonly targetId: string;
  readonly cardId: string;
  readonly costSharePercent: number;
  readonly accepted: boolean | null;
  readonly createdTick: number;
}

export interface TeamUpChatMessage {
  readonly messageId: string;
  readonly tick: number;
  readonly actorId: string | null;
  readonly kind: 'SYSTEM' | 'TEAM' | 'PROOF_SHARE' | 'WAR_ALERT' | 'DEAL_RECAP';
  readonly body: string;
  readonly reactions: readonly TeamUpChatReaction[];
}

export interface TeamUpEvent {
  readonly tick: number;
  readonly type: TeamUpActionType | 'SYSTEM';
  readonly actorId: string | null;
  readonly targetId: string | null;
  readonly amount: number | null;
  readonly detail: string;
}

export interface TeamUpMacroState {
  readonly tick: number;
  readonly treasury: number;
  readonly rescueWindowOpen: boolean;
  readonly aidWindowOpen: boolean;
  readonly warAlertActive: boolean;
  readonly roleSynergyActive: boolean;
  readonly betrayalSurvivorBonusActive: boolean;
  readonly betrayalSurvivorCordMultiplier: number;
  readonly teamCordBonusMultiplier: number;
  readonly eventLog: readonly TeamUpEvent[];
  readonly loans: readonly TeamUpLoan[];
  readonly dealInvites: readonly DealInvite[];
  readonly chat: readonly TeamUpChatMessage[];
  readonly firstCascadeAutoAbsorbed: boolean;
  readonly syndicateDuelEligible: boolean;
}

export interface TeamUpModeState {
  readonly runId: string;
  readonly seed: string;
  readonly players: readonly TeamUpPlayerState[];
  readonly macro: TeamUpMacroState;
}

export interface AdvanceTickAction {
  readonly type: 'ADVANCE_TICK';
  readonly timestampMs?: number;
  readonly treasuryDelta?: number;
  readonly pressureDeltaByPlayerId?: Readonly<Record<string, number>>;
}

export interface AidRequestAction {
  readonly type: 'AID_REQUEST';
  readonly actorId: string;
  readonly reason: string;
}

export interface PlayAidAction {
  readonly type: 'PLAY_AID';
  readonly actorId: string;
  readonly targetId: string;
  readonly aidType: TeamUpAidType;
  readonly amount?: number;
}

export interface PlayRescueAction {
  readonly type: 'PLAY_RESCUE';
  readonly actorId: string;
  readonly targetId: string;
  readonly rescueType: TeamUpRescueType;
  readonly responseDelayMs: number;
}

export interface RequestTreasuryLoanAction {
  readonly type: 'REQUEST_TREASURY_LOAN';
  readonly actorId: string;
}

export interface CascadeAbsorbAction {
  readonly type: 'CASCADE_ABSORB';
  readonly actorId: string;
  readonly severity: number;
}

export interface SendDealInviteAction {
  readonly type: 'SEND_DEAL_INVITE';
  readonly actorId: string;
  readonly targetId: string;
  readonly cardId: string;
  readonly costSharePercent: number;
}

export interface RespondDealInviteAction {
  readonly type: 'RESPOND_DEAL_INVITE';
  readonly actorId: string;
  readonly inviteId: string;
  readonly accept: boolean;
}

export interface ProofShareAction {
  readonly type: 'PROOF_SHARE';
  readonly actorId: string;
}

export interface PlayDefectionStepAction {
  readonly type: 'PLAY_DEFECTION_STEP';
  readonly actorId: string;
  readonly step: Exclude<TeamUpDefectionStep, 'NONE' | 'DEFECTED'>;
}

export interface CommitDefectionAction {
  readonly type: 'COMMIT_DEFECTION';
  readonly actorId: string;
}

export type TeamUpModeAction =
  | AdvanceTickAction
  | AidRequestAction
  | PlayAidAction
  | PlayRescueAction
  | RequestTreasuryLoanAction
  | CascadeAbsorbAction
  | SendDealInviteAction
  | RespondDealInviteAction
  | ProofShareAction
  | PlayDefectionStepAction
  | CommitDefectionAction;

const MIN_LOAN_AMOUNT = 2000;
const MAX_LOAN_AMOUNT = 15000;
const LOAN_TREASURY_PCT = 0.15;
const LOAN_REPAYMENT_MULTIPLIER = 1.1;
const LOAN_REPAYMENT_TICKS = 5;
const MAX_LOANS_PER_PLAYER = 2;
const CRITICAL_PRESSURE = 80;
const ROLE_SYNERGY_TREASURY_BONUS = 8000;
const ROLE_SYNERGY_SHIELD_MULTIPLIER = 1.1;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
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

function byPlayerId(
  players: readonly TeamUpPlayerState[],
  playerId: string,
): TeamUpPlayerState {
  const found = players.find((player) => player.playerId === playerId);
  if (!found) {
    throw new Error(`Unknown TEAM_UP player '${playerId}'.`);
  }
  return found;
}

function replacePlayer(
  players: readonly TeamUpPlayerState[],
  updated: TeamUpPlayerState,
): TeamUpPlayerState[] {
  return players.map((player) =>
    player.playerId === updated.playerId ? updated : player,
  );
}

function addStatus(
  statuses: readonly TeamUpStatus[],
  status: TeamUpStatus,
): TeamUpStatus[] {
  return [...new Set([...statuses, status])];
}

function removeStatus(
  statuses: readonly TeamUpStatus[],
  status: TeamUpStatus,
): TeamUpStatus[] {
  return statuses.filter((entry) => entry !== status);
}

function trustBand(
  trustScore: number,
): {
  readonly aidEfficiency: number;
  readonly treasuryLoanPct: number;
  readonly comboMultiplier: number;
  readonly defectionSignal: boolean;
  readonly loanAccessDenied: boolean;
} {
  if (trustScore >= 90) {
    return {
      aidEfficiency: 1,
      treasuryLoanPct: 0.2,
      comboMultiplier: 1.25,
      defectionSignal: false,
      loanAccessDenied: false,
    };
  }
  if (trustScore >= 70) {
    return {
      aidEfficiency: 0.95,
      treasuryLoanPct: 0.15,
      comboMultiplier: 1.12,
      defectionSignal: false,
      loanAccessDenied: false,
    };
  }
  if (trustScore >= 50) {
    return {
      aidEfficiency: 0.88,
      treasuryLoanPct: 0.1,
      comboMultiplier: 1,
      defectionSignal: false,
      loanAccessDenied: false,
    };
  }
  if (trustScore >= 30) {
    return {
      aidEfficiency: 0.75,
      treasuryLoanPct: 0.05,
      comboMultiplier: 0.9,
      defectionSignal: true,
      loanAccessDenied: false,
    };
  }

  return {
    aidEfficiency: 0.6,
    treasuryLoanPct: 0,
    comboMultiplier: 0.75,
    defectionSignal: true,
    loanAccessDenied: true,
  };
}

function recalcPlayer(player: TeamUpPlayerState): TeamUpPlayerState {
  const netWorth = round2(player.cash + player.income * 6 - player.liabilities);
  const pressure = clamp(player.pressure, 0, 100);

  let activeStatuses = [...player.activeStatuses];

  if (pressure >= CRITICAL_PRESSURE) {
    activeStatuses = addStatus(activeStatuses, 'critical_pressure');
  } else {
    activeStatuses = removeStatus(activeStatuses, 'critical_pressure');
  }

  if (trustBand(player.trustScore).defectionSignal) {
    activeStatuses = addStatus(activeStatuses, 'defection_risk');
  } else {
    activeStatuses = removeStatus(activeStatuses, 'defection_risk');
  }

  return {
    ...player,
    netWorth,
    pressure,
    pressureTier: pressureTierFromPressure(pressure),
    activeStatuses,
    riskSignalRaised: trustBand(player.trustScore).defectionSignal,
  };
}

function appendEvent(
  state: TeamUpModeState,
  type: TeamUpEvent['type'],
  actorId: string | null,
  targetId: string | null,
  amount: number | null,
  detail: string,
): TeamUpModeState {
  const event: TeamUpEvent = {
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

function appendChat(
  state: TeamUpModeState,
  actorId: string | null,
  kind: TeamUpChatMessage['kind'],
  body: string,
): TeamUpModeState {
  const message: TeamUpChatMessage = {
    messageId: stableId('chat', state.runId, state.macro.tick, kind, body),
    tick: state.macro.tick,
    actorId,
    kind,
    body,
    reactions: [],
  };

  return {
    ...state,
    macro: {
      ...state.macro,
      chat: [...state.macro.chat, message],
    },
  };
}

function mutatePlayer(
  state: TeamUpModeState,
  playerId: string,
  transform: (player: TeamUpPlayerState) => TeamUpPlayerState,
): TeamUpModeState {
  const current = byPlayerId(state.players, playerId);
  const updated = recalcPlayer(transform(current));

  return {
    ...state,
    players: replacePlayer(state.players, updated),
  };
}

function allRolesPresent(players: readonly TeamUpPlayerState[]): boolean {
  const activeRoles = new Set(
    players.filter((player) => !player.defected).map((player) => player.role),
  );

  return (
    activeRoles.has('INCOME_BUILDER') &&
    activeRoles.has('SHIELD_ARCHITECT') &&
    activeRoles.has('OPPORTUNITY_HUNTER') &&
    activeRoles.has('COUNTER_INTEL')
  );
}

function refreshMacro(state: TeamUpModeState): TeamUpModeState {
  const rescueWindowOpen = state.players.some(
    (player) => !player.defected && player.pressure >= CRITICAL_PRESSURE,
  );
  const aidWindowOpen = state.players.some(
    (player) => !player.defected && player.aidRequests > 0,
  );
  const warAlertActive = rescueWindowOpen;
  const roleSynergyActive = allRolesPresent(state.players);

  let nextState: TeamUpModeState = {
    ...state,
    macro: {
      ...state.macro,
      rescueWindowOpen,
      aidWindowOpen,
      warAlertActive,
      roleSynergyActive,
    },
  };

  if (warAlertActive) {
    const critical = nextState.players
      .filter((player) => player.pressure >= CRITICAL_PRESSURE && !player.defected)
      .map((player) => `${player.displayName}[${player.pressure}]`)
      .join(', ');

    nextState = appendChat(
      nextState,
      null,
      'WAR_ALERT',
      `WAR ALERT — CRITICAL pressure detected: ${critical}`,
    );
  }

  return nextState;
}

function applyTick(
  state: TeamUpModeState,
  action: AdvanceTickAction,
): TeamUpModeState {
  let next: TeamUpModeState = {
    ...state,
    macro: {
      ...state.macro,
      tick: state.macro.tick + 1,
      treasury: Math.max(0, state.macro.treasury + (action.treasuryDelta ?? 0)),
    },
  };

  next = {
    ...next,
    players: next.players.map((player) => {
      const pressureDelta = action.pressureDeltaByPlayerId?.[player.playerId] ?? 0;
      const band = trustBand(player.trustScore);
      const cash = Math.max(0, player.cash + player.income - player.expenses);
      const pressure = clamp(
        player.pressure +
          pressureDelta +
          (next.macro.roleSynergyActive ? -1 : 1) +
          (player.defected ? 5 : 0),
        0,
        100,
      );

      let updated: TeamUpPlayerState = {
        ...player,
        cash,
        pressure,
        aidRequests: 0,
        activeStatuses: removeStatus(player.activeStatuses, 'aid_requested'),
      };

      const ratio = updated.expenses <= 0 ? 99 : updated.income / updated.expenses;
      updated = {
        ...updated,
        consecutiveLoanCrisisTicks:
          ratio < 0.5 ? updated.consecutiveLoanCrisisTicks + 1 : 0,
      };

      if (updated.defected) {
        updated = {
          ...updated,
          pressure: clamp(updated.pressure + 6, 0, 100),
        };
      }

      if (updated.loyaltyHelpReceived > 0) {
        updated = {
          ...updated,
          loyaltyHelpReceived: Math.max(0, updated.loyaltyHelpReceived - 1),
          activeStatuses:
            updated.loyaltyHelpReceived > 1
              ? addStatus(updated.activeStatuses, 'loyalty_bonus')
              : removeStatus(updated.activeStatuses, 'loyalty_bonus'),
        };
      }

      if (band.defectionSignal) {
        updated = {
          ...updated,
          activeStatuses: addStatus(updated.activeStatuses, 'defection_risk'),
        };
      }

      return recalcPlayer(updated);
    }),
  };

  const updatedLoans: TeamUpLoan[] = [];
  for (const loan of next.macro.loans) {
    if (loan.repaid || loan.defaulted) {
      updatedLoans.push(loan);
      continue;
    }

    const borrower = byPlayerId(next.players, loan.borrowerId);
    if (borrower.defected) {
      updatedLoans.push({
        ...loan,
        defaulted: true,
      });

      next = mutatePlayer(next, borrower.playerId, (player) => ({
        ...player,
        cordFlatModifier: player.cordFlatModifier - Math.min(0.15, loan.outstandingBalance / 100_000),
        activeStatuses: addStatus(player.activeStatuses, 'loan_default_risk'),
      }));

      continue;
    }

    if (loan.remainingIncomeTicks <= 0 || loan.outstandingBalance <= 0) {
      updatedLoans.push({
        ...loan,
        repaid: true,
        outstandingBalance: 0,
        remainingIncomeTicks: 0,
      });
      continue;
    }

    const repayment = round2(loan.principal * LOAN_REPAYMENT_MULTIPLIER / LOAN_REPAYMENT_TICKS);
    const paid = Math.min(repayment, loan.outstandingBalance, borrower.cash);

    next = mutatePlayer(next, borrower.playerId, (player) => ({
      ...player,
      cash: Math.max(0, player.cash - paid),
      liabilities: Math.max(0, player.liabilities - paid),
      trustScore: clamp(player.trustScore + 2, 0, 100),
    }));

    next = {
      ...next,
      macro: {
        ...next.macro,
        treasury: next.macro.treasury + paid,
      },
    };

    updatedLoans.push({
      ...loan,
      outstandingBalance: round2(Math.max(0, loan.outstandingBalance - paid)),
      remainingIncomeTicks: loan.remainingIncomeTicks - 1,
      repaid: loan.remainingIncomeTicks - 1 <= 0 || loan.outstandingBalance - paid <= 0,
    });
  }

  next = {
    ...next,
    macro: {
      ...next.macro,
      loans: updatedLoans,
    },
  };

  return appendEvent(
    refreshMacro(next),
    'ADVANCE_TICK',
    null,
    null,
    action.treasuryDelta ?? 0,
    'tick_advanced',
  );
}

function playAid(
  state: TeamUpModeState,
  action: PlayAidAction,
): TeamUpModeState {
  if (action.actorId === action.targetId) {
    throw new Error('Aid actor and target must differ.');
  }

  const actor = byPlayerId(state.players, action.actorId);
  const target = byPlayerId(state.players, action.targetId);
  if (actor.defected || target.defected) {
    throw new Error('Defected players cannot participate in aid.');
  }

  const actorBand = trustBand(actor.trustScore);
  const targetBand = trustBand(target.trustScore);

  let next = state;

  switch (action.aidType) {
    case 'LIQUIDITY_BRIDGE': {
      const requestedAmount = clamp(action.amount ?? 10000, 5000, 15000);
      const transferred = round2(requestedAmount * actorBand.aidEfficiency);
      if (actor.cash < requestedAmount) {
        throw new Error('Insufficient actor cash for Liquidity Bridge.');
      }

      next = mutatePlayer(next, actor.playerId, (player) => ({
        ...player,
        cash: player.cash - requestedAmount,
        aidGivenCount: player.aidGivenCount + 1,
        trustScore: clamp(player.trustScore + 5, 0, 100),
      }));

      next = mutatePlayer(next, target.playerId, (player) => ({
        ...player,
        cash: player.cash + transferred,
        aidReceivedCount: player.aidReceivedCount + 1,
        loyaltyHelpReceived: player.loyaltyHelpReceived + 3,
        trustScore: clamp(player.trustScore + 3, 0, 100),
        activeStatuses: addStatus(removeStatus(player.activeStatuses, 'aid_requested'), 'loyalty_bonus'),
      }));

      next = appendChat(
        next,
        actor.playerId,
        'TEAM',
        `${actor.displayName} issued LIQUIDITY BRIDGE to ${target.displayName} for $${transferred.toFixed(2)}.`,
      );
      break;
    }

    case 'SHIELD_LOAN': {
      if (actor.shields < 15) {
        throw new Error('Insufficient shield to issue Shield Loan.');
      }

      next = mutatePlayer(next, actor.playerId, (player) => ({
        ...player,
        shields: clamp(player.shields - 15, 0, 110),
        aidGivenCount: player.aidGivenCount + 1,
        trustScore: clamp(player.trustScore + 8, 0, 100),
      }));

      next = mutatePlayer(next, target.playerId, (player) => ({
        ...player,
        shields: clamp(player.shields + 15, 0, 110),
        aidReceivedCount: player.aidReceivedCount + 1,
        loyaltyHelpReceived: player.loyaltyHelpReceived + 4,
        trustScore: clamp(player.trustScore + 4, 0, 100),
      }));

      next = appendChat(
        next,
        actor.playerId,
        'TEAM',
        `${actor.displayName} issued SHIELD LOAN to ${target.displayName}.`,
      );
      break;
    }

    case 'EXPANSION_LEASE': {
      const combo = target.activeStatuses.includes('loyalty_bonus');
      const comboMultiplier = combo ? targetBand.comboMultiplier : 1;
      const gain = round2((combo ? 2800 : 1200) * comboMultiplier);

      if (actor.cash < 4000) {
        throw new Error('Insufficient actor cash for Expansion Lease.');
      }

      next = mutatePlayer(next, actor.playerId, (player) => ({
        ...player,
        cash: player.cash - 4000,
        income: player.income + gain,
        aidGivenCount: player.aidGivenCount + 1,
      }));

      next = mutatePlayer(next, target.playerId, (player) => ({
        ...player,
        income: player.income + gain,
        aidReceivedCount: player.aidReceivedCount + 1,
        trustScore: clamp(player.trustScore + 2, 0, 100),
      }));

      next = appendChat(
        next,
        actor.playerId,
        'TEAM',
        `${actor.displayName} activated EXPANSION LEASE with ${target.displayName}${combo ? ' (combo)' : ''}.`,
      );
      break;
    }

    default: {
      const exhaustive: never = action.aidType;
      return exhaustive;
    }
  }

  return appendEvent(
    refreshMacro(next),
    'PLAY_AID',
    action.actorId,
    action.targetId,
    action.amount ?? null,
    `aid:${action.aidType}`,
  );
}

function playRescue(
  state: TeamUpModeState,
  action: PlayRescueAction,
): TeamUpModeState {
  if (!state.macro.rescueWindowOpen) {
    throw new Error('Rescue window is not open.');
  }

  const actor = byPlayerId(state.players, action.actorId);
  const target = byPlayerId(state.players, action.targetId);
  if (actor.defected || target.defected) {
    throw new Error('Defected players cannot participate in rescue.');
  }

  const speedMultiplier =
    action.responseDelayMs < 3000
      ? 1
      : action.responseDelayMs > 6000
      ? 0.6
      : 0.8;

  let next = state;

  switch (action.rescueType) {
    case 'EMERGENCY_CAPITAL': {
      const amount = round2(12000 * speedMultiplier);
      if (next.macro.treasury < amount) {
        throw new Error('Insufficient treasury for emergency capital.');
      }

      next = {
        ...next,
        macro: {
          ...next.macro,
          treasury: next.macro.treasury - amount,
        },
      };

      next = mutatePlayer(next, target.playerId, (player) => ({
        ...player,
        cash: player.cash + amount,
        shields: clamp(player.shields + 12 * speedMultiplier, 0, 110),
        pressure: clamp(player.pressure - 20 * speedMultiplier, 0, 100),
        rescueReceivedCount: player.rescueReceivedCount + 1,
        activeStatuses: addStatus(player.activeStatuses, 'rescued_recently'),
      }));

      next = mutatePlayer(next, actor.playerId, (player) => ({
        ...player,
        rescueGivenCount: player.rescueGivenCount + 1,
        trustScore: clamp(player.trustScore + 4, 0, 100),
      }));
      break;
    }

    case 'CASCADE_BREAK': {
      next = mutatePlayer(next, actor.playerId, (player) => ({
        ...player,
        rescueGivenCount: player.rescueGivenCount + 1,
        trustScore: clamp(player.trustScore + 3, 0, 100),
      }));

      next = mutatePlayer(next, target.playerId, (player) => ({
        ...player,
        pressure: clamp(player.pressure - 15 * speedMultiplier, 0, 100),
        shields: clamp(player.shields + 8 * speedMultiplier, 0, 110),
      }));
      break;
    }

    case 'TIME_DEBT_PAID': {
      next = mutatePlayer(next, actor.playerId, (player) => ({
        ...player,
        rescueGivenCount: player.rescueGivenCount + 1,
        trustScore: clamp(player.trustScore + 5, 0, 100),
      }));

      next = {
        ...next,
        macro: {
          ...next.macro,
          teamCordBonusMultiplier: round2(next.macro.teamCordBonusMultiplier + 0.05),
        },
      };
      break;
    }

    case 'COORDINATED_REFINANCE': {
      next = mutatePlayer(next, target.playerId, (player) => ({
        ...player,
        expenses: round2(player.expenses * (1 - 0.18 * speedMultiplier)),
        pressure: clamp(player.pressure - 18 * speedMultiplier, 0, 100),
        rescueReceivedCount: player.rescueReceivedCount + 1,
      }));

      next = mutatePlayer(next, actor.playerId, (player) => ({
        ...player,
        rescueGivenCount: player.rescueGivenCount + 1,
        trustScore: clamp(player.trustScore + 4, 0, 100),
      }));
      break;
    }

    default: {
      const exhaustive: never = action.rescueType;
      return exhaustive;
    }
  }

  next = appendChat(
    next,
    action.actorId,
    'TEAM',
    `${actor.displayName} rescued ${target.displayName} with ${action.rescueType}.`,
  );

  return appendEvent(
    refreshMacro(next),
    'PLAY_RESCUE',
    action.actorId,
    action.targetId,
    action.responseDelayMs,
    `rescue:${action.rescueType}`,
  );
}

function requestTreasuryLoan(
  state: TeamUpModeState,
  action: RequestTreasuryLoanAction,
): TeamUpModeState {
  const borrower = byPlayerId(state.players, action.actorId);
  const band = trustBand(borrower.trustScore);

  if (borrower.defected) {
    throw new Error('Defected player cannot request treasury loan.');
  }
  if (borrower.loansTaken >= MAX_LOANS_PER_PLAYER) {
    throw new Error('Loan limit reached for this run.');
  }
  if (borrower.consecutiveLoanCrisisTicks < 3) {
    throw new Error('Loan trigger not met — ratio must remain below 0.5 for 3 consecutive ticks.');
  }
  if (band.loanAccessDenied) {
    throw new Error('Loan access denied at current trust band.');
  }

  const capByTrust = round2(state.macro.treasury * band.treasuryLoanPct);
  const amount = clamp(
    round2(state.macro.treasury * LOAN_TREASURY_PCT),
    MIN_LOAN_AMOUNT,
    Math.min(MAX_LOAN_AMOUNT, capByTrust),
  );

  if (amount <= 0 || state.macro.treasury < amount) {
    throw new Error('Insufficient treasury for loan.');
  }

  const loan: TeamUpLoan = {
    loanId: stableId('loan', state.runId, state.macro.tick, borrower.playerId, borrower.loansTaken + 1),
    borrowerId: borrower.playerId,
    principal: amount,
    outstandingBalance: round2(amount * LOAN_REPAYMENT_MULTIPLIER),
    issuedTick: state.macro.tick,
    remainingIncomeTicks: LOAN_REPAYMENT_TICKS,
    repaid: false,
    defaulted: false,
  };

  let next: TeamUpModeState = {
    ...state,
    macro: {
      ...state.macro,
      treasury: state.macro.treasury - amount,
      loans: [...state.macro.loans, loan],
    },
  };

  next = mutatePlayer(next, borrower.playerId, (player) => ({
    ...player,
    cash: player.cash + amount,
    liabilities: round2(player.liabilities + amount * LOAN_REPAYMENT_MULTIPLIER),
    trustScore: clamp(player.trustScore - 1, 0, 100),
    loansTaken: player.loansTaken + 1,
    outstandingLoanIds: [...player.outstandingLoanIds, loan.loanId],
  }));

  next = appendChat(
    next,
    null,
    'SYSTEM',
    `${borrower.displayName} received Treasury Loan: $${amount.toFixed(2)}.`,
  );

  return appendEvent(
    refreshMacro(next),
    'REQUEST_TREASURY_LOAN',
    borrower.playerId,
    null,
    amount,
    `loan:${loan.loanId}`,
  );
}

function cascadeAbsorb(
  state: TeamUpModeState,
  action: CascadeAbsorbAction,
): TeamUpModeState {
  const absorber = byPlayerId(state.players, action.actorId);
  if (absorber.defected) {
    throw new Error('Defected player cannot absorb cascade.');
  }

  let next = mutatePlayer(state, absorber.playerId, (player) => ({
    ...player,
    pressure: clamp(player.pressure + action.severity, 0, 100),
    shields: clamp(player.shields - action.severity, 0, 110),
    cascadeAbsorptions: player.cascadeAbsorptions + 1,
    sovereigntyScoreFlat: round2(player.sovereigntyScoreFlat + 0.05),
    trustScore: clamp(player.trustScore + 5, 0, 100),
  }));

  if (absorber.cascadeAbsorptions + 1 >= 3) {
    next = mutatePlayer(next, absorber.playerId, (player) => ({
      ...player,
      cordFlatModifier: round2(player.cordFlatModifier + 0.35),
    }));
  }

  next = appendChat(
    next,
    null,
    'SYSTEM',
    `SHIELD BEARER — ${absorber.displayName} absorbed the cascade.`,
  );

  return appendEvent(
    refreshMacro(next),
    'CASCADE_ABSORB',
    absorber.playerId,
    null,
    action.severity,
    'cascade_absorbed_for_team',
  );
}

function sendDealInvite(
  state: TeamUpModeState,
  action: SendDealInviteAction,
  registry: CardRegistry,
): TeamUpModeState {
  const actor = byPlayerId(state.players, action.actorId);
  const target = byPlayerId(state.players, action.targetId);

  if (actor.defected || target.defected) {
    throw new Error('Defected players cannot use deal invites.');
  }

  registry.getOrThrow(action.cardId);

  const invite: DealInvite = {
    inviteId: stableId('invite', state.runId, state.macro.tick, action.actorId, action.targetId, action.cardId),
    actorId: action.actorId,
    targetId: action.targetId,
    cardId: action.cardId,
    costSharePercent: clamp(action.costSharePercent, 0, 100),
    accepted: null,
    createdTick: state.macro.tick,
  };

  let next: TeamUpModeState = {
    ...state,
    macro: {
      ...state.macro,
      dealInvites: [...state.macro.dealInvites, invite],
    },
  };

  next = appendChat(
    next,
    action.actorId,
    'TEAM',
    `${actor.displayName} sent DEAL INVITE (${action.cardId}) to ${target.displayName}.`,
  );

  return appendEvent(
    next,
    'SEND_DEAL_INVITE',
    action.actorId,
    action.targetId,
    invite.costSharePercent,
    `deal_invite:${action.cardId}`,
  );
}

function respondDealInvite(
  state: TeamUpModeState,
  action: RespondDealInviteAction,
  registry: CardRegistry,
): TeamUpModeState {
  const invite = state.macro.dealInvites.find((entry) => entry.inviteId === action.inviteId);
  if (!invite) {
    throw new Error(`Deal invite '${action.inviteId}' not found.`);
  }
  if (invite.targetId !== action.actorId) {
    throw new Error('Only invite target may respond.');
  }
  if (invite.accepted !== null) {
    throw new Error('Invite already resolved.');
  }

  const definition = registry.getOrThrow(invite.cardId);
  let next: TeamUpModeState = {
    ...state,
    macro: {
      ...state.macro,
      dealInvites: state.macro.dealInvites.map((entry) =>
        entry.inviteId === action.inviteId ? { ...entry, accepted: action.accept } : entry,
      ),
    },
  };

  if (action.accept) {
    const sharedCost = round2(definition.baseCost * (invite.costSharePercent / 100));
    next = mutatePlayer(next, invite.actorId, (player) => ({
      ...player,
      cash: Math.max(0, player.cash - (definition.baseCost - sharedCost)),
      handCardIds: player.handCardIds.filter((cardId) => cardId !== invite.cardId),
    }));
    next = mutatePlayer(next, invite.targetId, (player) => ({
      ...player,
      cash: Math.max(0, player.cash - sharedCost),
      handCardIds: [...player.handCardIds, invite.cardId],
      trustScore: clamp(player.trustScore + 2, 0, 100),
    }));
  }

  next = appendChat(
    next,
    action.actorId,
    'DEAL_RECAP',
    `${action.accept ? 'Accepted' : 'Declined'} DEAL INVITE ${invite.cardId}.`,
  );

  return appendEvent(
    next,
    'RESPOND_DEAL_INVITE',
    action.actorId,
    invite.actorId,
    action.accept ? definition.baseCost : null,
    `deal_invite_${action.accept ? 'accepted' : 'declined'}:${invite.cardId}`,
  );
}

function proofShare(
  state: TeamUpModeState,
  action: ProofShareAction,
): TeamUpModeState {
  const actor = byPlayerId(state.players, action.actorId);

  const proofHash = createHash('sha256')
    .update(
      [
        state.seed,
        state.macro.tick,
        state.macro.treasury,
        actor.playerId,
        actor.cash,
        actor.income,
        actor.expenses,
        actor.shields,
      ].join('|'),
    )
    .digest('hex');

  let next = mutatePlayer(state, actor.playerId, (player) => ({
    ...player,
    proofShares: player.proofShares + 1,
    activeStatuses: addStatus(player.activeStatuses, 'proof_shared'),
    trustScore: clamp(player.trustScore + 1, 0, 100),
  }));

  next = appendChat(
    next,
    action.actorId,
    'PROOF_SHARE',
    `PROOF SHARE — treasury=${state.macro.treasury.toFixed(2)}, shields=${actor.shields}, income=${actor.income.toFixed(2)}, expenses=${actor.expenses.toFixed(2)}, proof_hash=${proofHash.slice(0, 16)}...`,
  );

  return appendEvent(
    next,
    'PROOF_SHARE',
    action.actorId,
    null,
    null,
    `proof_hash:${proofHash}`,
  );
}

function playDefectionStep(
  state: TeamUpModeState,
  action: PlayDefectionStepAction,
): TeamUpModeState {
  const actor = byPlayerId(state.players, action.actorId);

  if (state.macro.tick < 8) {
    throw new Error('Defection sequence is not legal before tick 8.');
  }
  if (actor.defected) {
    throw new Error('Player already defected.');
  }

  const expectedStep: TeamUpDefectionStep =
    actor.defectionStep === 'NONE'
      ? 'BREAK_PACT'
      : actor.defectionStep === 'BREAK_PACT'
      ? 'SILENT_EXIT'
      : actor.defectionStep === 'SILENT_EXIT'
      ? 'ASSET_SEIZURE'
      : 'ASSET_SEIZURE';

  if (action.step !== expectedStep) {
    throw new Error(`Expected defection step '${expectedStep}', received '${action.step}'.`);
  }

  let next = mutatePlayer(state, actor.playerId, (player) => ({
    ...player,
    defectionStep: action.step,
    hiddenIntentScore: clamp(player.hiddenIntentScore + 0.2, 0, 1),
    trustScore: clamp(player.trustScore - 8, 0, 100),
  }));

  next = appendChat(
    next,
    null,
    'SYSTEM',
    `${actor.displayName} has advanced defection sequence: ${action.step}.`,
  );

  return appendEvent(
    refreshMacro(next),
    'PLAY_DEFECTION_STEP',
    action.actorId,
    null,
    null,
    `defection_step:${action.step}`,
  );
}

function commitDefection(
  state: TeamUpModeState,
  action: CommitDefectionAction,
): TeamUpModeState {
  const actor = byPlayerId(state.players, action.actorId);

  if (state.macro.tick < 8) {
    throw new Error('Defection is not legal before tick 8.');
  }
  if (actor.defectionStep !== 'ASSET_SEIZURE') {
    throw new Error('Defection sequence incomplete.');
  }

  const stolen = round2(state.macro.treasury * 0.4);
  let next: TeamUpModeState = {
    ...state,
    macro: {
      ...state.macro,
      treasury: round2(state.macro.treasury - stolen),
      betrayalSurvivorBonusActive: true,
      betrayalSurvivorCordMultiplier: 1.6,
    },
  };

  next = mutatePlayer(next, actor.playerId, (player) => ({
    ...player,
    cash: player.cash + stolen,
    defected: true,
    defectionStep: 'DEFECTED',
    defectionCount: player.defectionCount + 1,
    freedomThresholdMultiplier: 0.7,
    cordFlatModifier: round2(player.cordFlatModifier - 0.15),
    activeStatuses: addStatus(player.activeStatuses, 'defected'),
  }));

  for (const player of next.players) {
    if (player.playerId === actor.playerId) {
      continue;
    }
    next = mutatePlayer(next, player.playerId, (entry) => ({
      ...entry,
      trustScore: clamp(entry.trustScore - 18, 0, 100),
      pressure: clamp(entry.pressure + 15, 0, 100),
      cordFlatModifier: round2(entry.cordFlatModifier + 0.6),
    }));
  }

  next = appendChat(
    next,
    null,
    'SYSTEM',
    `${actor.displayName} DEFECTED — treasury reduced to 60%, betrayal survivor bonus now active.`,
  );

  return appendEvent(
    refreshMacro(next),
    'COMMIT_DEFECTION',
    action.actorId,
    null,
    stolen,
    'defection_committed',
  );
}

export class TeamUpModeEngine {
  private state: TeamUpModeState;
  private readonly registry: CardRegistry;

  public constructor(
    initialState: TeamUpModeState,
    registry: CardRegistry = new CardRegistry(),
  ) {
    if (initialState.players.length < 2 || initialState.players.length > 4) {
      throw new Error('TEAM_UP mode supports 2 to 4 players.');
    }

    this.registry = registry;
    this.state = refreshMacro({
      ...initialState,
      players: initialState.players.map((player) => recalcPlayer(player)),
    });
  }

  public getState(): TeamUpModeState {
    return this.state;
  }

  public dispatch(action: TeamUpModeAction): TeamUpModeState {
    switch (action.type) {
      case 'ADVANCE_TICK':
        this.state = applyTick(this.state, action);
        return this.state;

      case 'AID_REQUEST':
        this.state = appendEvent(
          appendChat(
            mutatePlayer(this.state, action.actorId, (player) => ({
              ...player,
              aidRequests: player.aidRequests + 1,
              activeStatuses: addStatus(player.activeStatuses, 'aid_requested'),
            })),
            action.actorId,
            'TEAM',
            `${byPlayerId(this.state.players, action.actorId).displayName} requested aid: ${action.reason}`,
          ),
          'AID_REQUEST',
          action.actorId,
          null,
          null,
          action.reason,
        );
        this.state = refreshMacro(this.state);
        return this.state;

      case 'PLAY_AID':
        this.state = playAid(this.state, action);
        return this.state;

      case 'PLAY_RESCUE':
        this.state = playRescue(this.state, action);
        return this.state;

      case 'REQUEST_TREASURY_LOAN':
        this.state = requestTreasuryLoan(this.state, action);
        return this.state;

      case 'CASCADE_ABSORB':
        this.state = cascadeAbsorb(this.state, action);
        return this.state;

      case 'SEND_DEAL_INVITE':
        this.state = sendDealInvite(this.state, action, this.registry);
        return this.state;

      case 'RESPOND_DEAL_INVITE':
        this.state = respondDealInvite(this.state, action, this.registry);
        return this.state;

      case 'PROOF_SHARE':
        this.state = proofShare(this.state, action);
        return this.state;

      case 'PLAY_DEFECTION_STEP':
        this.state = playDefectionStep(this.state, action);
        return this.state;

      case 'COMMIT_DEFECTION':
        this.state = commitDefection(this.state, action);
        return this.state;

      default: {
        const exhaustive: never = action;
        return exhaustive;
      }
    }
  }
}

export function createInitialTeamUpModeState(input: {
  readonly runId: string;
  readonly seed: string;
  readonly treasury: number;
  readonly players: ReadonlyArray<{
    readonly playerId: string;
    readonly displayName: string;
    readonly role: TeamUpRole;
    readonly cash: number;
    readonly income: number;
    readonly expenses: number;
    readonly liabilities: number;
    readonly shields?: number;
    readonly trustScore?: number;
    readonly handCardIds?: readonly string[];
  }>;
}): TeamUpModeState {
  if (input.players.length < 2 || input.players.length > 4) {
    throw new Error('TEAM_UP mode supports 2 to 4 players.');
  }

  const roleSynergyActive = (() => {
    const roles = new Set(input.players.map((player) => player.role));
    return (
      roles.has('INCOME_BUILDER') &&
      roles.has('SHIELD_ARCHITECT') &&
      roles.has('OPPORTUNITY_HUNTER') &&
      roles.has('COUNTER_INTEL')
    );
  })();

  const treasury = Math.max(
    0,
    input.treasury + (roleSynergyActive ? ROLE_SYNERGY_TREASURY_BONUS : 0),
  );

  const base: TeamUpModeState = {
    runId: input.runId,
    seed: input.seed,
    players: input.players.map((player) =>
      recalcPlayer({
        playerId: player.playerId,
        displayName: player.displayName,
        role: player.role,
        cash: Math.max(0, player.cash),
        income: Math.max(0, player.income),
        expenses: Math.max(0, player.expenses),
        liabilities: Math.max(0, player.liabilities),
        netWorth: 0,
        pressure: 0,
        pressureTier: PressureTier.T0_SOVEREIGN,
        shields: clamp(
          (player.shields ?? 100) *
            (roleSynergyActive ? ROLE_SYNERGY_SHIELD_MULTIPLIER : 1),
          0,
          110,
        ),
        trustScore: clamp(player.trustScore ?? 50, 0, 100),
        activeStatuses: [],
        aidRequests: 0,
        aidGivenCount: 0,
        aidReceivedCount: 0,
        rescueGivenCount: 0,
        rescueReceivedCount: 0,
        cascadeAbsorptions: 0,
        loansTaken: 0,
        outstandingLoanIds: [],
        loyaltyHelpReceived: 0,
        proofShares: 0,
        hiddenIntentScore: 0,
        defectionStep: 'NONE',
        defected: false,
        defectionCount: 0,
        freedomThresholdMultiplier: 1,
        cordFlatModifier: 0,
        sovereigntyScoreFlat: 0,
        riskSignalRaised: false,
        consecutiveLoanCrisisTicks: 0,
        handCardIds: [...(player.handCardIds ?? [])],
      }),
    ),
    macro: {
      tick: 0,
      treasury,
      rescueWindowOpen: false,
      aidWindowOpen: false,
      warAlertActive: false,
      roleSynergyActive,
      betrayalSurvivorBonusActive: false,
      betrayalSurvivorCordMultiplier: 1,
      teamCordBonusMultiplier: 1,
      eventLog: [],
      loans: [],
      dealInvites: [],
      chat: [],
      firstCascadeAutoAbsorbed: roleSynergyActive,
      syndicateDuelEligible: input.players.length === 4,
    },
  };

  return refreshMacro(
    appendChat(
      base,
      null,
      'SYSTEM',
      roleSynergyActive
        ? 'FULL SYNERGY active at run start.'
        : 'TEAM_UP run initialized.',
    ),
  );
}