//backend/src/game/modes/household_mode.ts

export type HouseholdPhase = 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY';
export type HouseholdRole = 'STEWARD' | 'DEALMAKER' | 'GUARDIAN' | 'STRATEGIST';
export type HouseholdActionType =
  | 'ADVANCE_TICK'
  | 'APPLY_TABLE_EVENT'
  | 'BAIL_OUT'
  | 'SYNDICATE_DEAL'
  | 'TREASURY_LOAN'
  | 'REPAY_LOAN'
  | 'CASCADE_ABSORB'
  | 'DEFECT'
  | 'SABOTAGE_POLICY'
  | 'PROOF_SHARE'
  | 'AID_REQUEST';

export interface HouseholdPlayerState {
  readonly playerId: string;
  readonly displayName: string;
  readonly role: HouseholdRole;
  readonly cash: number;
  readonly income: number;
  readonly liabilities: number;
  readonly netWorth: number;
  readonly pressure: number;
  readonly shields: number;
  readonly trustScore: number;
  readonly aidRequests: number;
  readonly bailoutsGiven: number;
  readonly bailoutsReceived: number;
  readonly syndicatesClosed: number;
  readonly sabotageEvents: number;
  readonly cascadeAbsorptions: number;
  readonly defected: boolean;
  readonly lastProofShareTick: number | null;
}

export interface HouseholdLoan {
  readonly loanId: string;
  readonly borrowerId: string;
  readonly principal: number;
  readonly dueTick: number;
  readonly issuedTick: number;
  readonly repaid: boolean;
}

export interface HouseholdMacroState {
  readonly tick: number;
  readonly phase: HouseholdPhase;
  readonly treasury: number;
  readonly pressure: number;
  readonly hardMode: boolean;
  readonly warAlertActive: boolean;
  readonly rescueWindowOpen: boolean;
  readonly aidWindowOpen: boolean;
  readonly synergyBonusActive: boolean;
  readonly activePolicies: readonly string[];
  readonly eventLog: readonly HouseholdEvent[];
  readonly loans: readonly HouseholdLoan[];
  readonly defectionOccurred: boolean;
}

export interface HouseholdEvent {
  readonly tick: number;
  readonly type: HouseholdActionType | 'SYSTEM';
  readonly actorId: string | null;
  readonly targetId: string | null;
  readonly amount: number | null;
  readonly detail: string;
}

export interface HouseholdModeState {
  readonly runId: string;
  readonly players: readonly HouseholdPlayerState[];
  readonly macro: HouseholdMacroState;
}

export interface AdvanceTickAction {
  readonly type: 'ADVANCE_TICK';
  readonly incomingPressure?: number;
  readonly treasuryDelta?: number;
}

export interface ApplyTableEventAction {
  readonly type: 'APPLY_TABLE_EVENT';
  readonly actorId: string;
  readonly label: string;
  readonly treasuryDelta: number;
  readonly pressureDelta: number;
}

export interface BailOutAction {
  readonly type: 'BAIL_OUT';
  readonly actorId: string;
  readonly targetId: string;
  readonly amount: number;
  readonly stringsAttached: boolean;
}

export interface SyndicateDealAction {
  readonly type: 'SYNDICATE_DEAL';
  readonly actorId: string;
  readonly partnerIds: readonly string[];
  readonly treasuryContribution: number;
  readonly expectedYield: number;
}

export interface TreasuryLoanAction {
  readonly type: 'TREASURY_LOAN';
  readonly actorId: string;
  readonly amount: number;
  readonly dueTickOffset: number;
}

export interface RepayLoanAction {
  readonly type: 'REPAY_LOAN';
  readonly actorId: string;
  readonly loanId: string;
}

export interface CascadeAbsorbAction {
  readonly type: 'CASCADE_ABSORB';
  readonly actorId: string;
  readonly targetId: string;
  readonly shieldCost: number;
  readonly pressureReduction: number;
}

export interface DefectAction {
  readonly type: 'DEFECT';
  readonly actorId: string;
}

export interface SabotagePolicyAction {
  readonly type: 'SABOTAGE_POLICY';
  readonly actorId: string;
  readonly label: string;
  readonly pressureDelta: number;
  readonly treasuryDelta: number;
}

export interface ProofShareAction {
  readonly type: 'PROOF_SHARE';
  readonly actorId: string;
}

export interface AidRequestAction {
  readonly type: 'AID_REQUEST';
  readonly actorId: string;
}

export type HouseholdModeAction =
  | AdvanceTickAction
  | ApplyTableEventAction
  | BailOutAction
  | SyndicateDealAction
  | TreasuryLoanAction
  | RepayLoanAction
  | CascadeAbsorbAction
  | DefectAction
  | SabotagePolicyAction
  | ProofShareAction
  | AidRequestAction;

const PHASE_AT_TICK: readonly [number, HouseholdPhase][] = [
  [0, 'FOUNDATION'],
  [5, 'ESCALATION'],
  [9, 'SOVEREIGNTY'],
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function byPlayerId(
  players: readonly HouseholdPlayerState[],
  playerId: string,
): HouseholdPlayerState {
  const player = players.find((entry) => entry.playerId === playerId);
  if (!player) {
    throw new Error(`Unknown household player: ${playerId}`);
  }
  return player;
}

function replacePlayer(
  players: readonly HouseholdPlayerState[],
  updated: HouseholdPlayerState,
): HouseholdPlayerState[] {
  return players.map((player) =>
    player.playerId === updated.playerId ? updated : player,
  );
}

function nextPhase(tick: number): HouseholdPhase {
  let phase: HouseholdPhase = 'FOUNDATION';
  for (const [threshold, candidate] of PHASE_AT_TICK) {
    if (tick >= threshold) {
      phase = candidate;
    }
  }
  return phase;
}

function roleSynergyActive(players: readonly HouseholdPlayerState[]): boolean {
  const active = players.filter((player) => !player.defected);
  const roles = new Set(active.map((player) => player.role));
  return active.length >= 4 && roles.size === 4;
}

function computeRescueWindow(players: readonly HouseholdPlayerState[]): boolean {
  return players.some((player) => !player.defected && player.pressure >= 80);
}

function computeAidWindow(players: readonly HouseholdPlayerState[]): boolean {
  return players.some((player) => !player.defected && player.aidRequests > 0);
}

function recalcNetWorth(player: HouseholdPlayerState): HouseholdPlayerState {
  const netWorth = player.cash + player.income * 6 - player.liabilities;
  return {
    ...player,
    netWorth,
  };
}

function appendEvent(
  state: HouseholdModeState,
  type: HouseholdEvent['type'],
  actorId: string | null,
  targetId: string | null,
  amount: number | null,
  detail: string,
): HouseholdModeState {
  const event: HouseholdEvent = {
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

function refreshMacro(state: HouseholdModeState): HouseholdModeState {
  const synergyBonusActive = roleSynergyActive(state.players);
  const rescueWindowOpen = computeRescueWindow(state.players);
  const aidWindowOpen = computeAidWindow(state.players);
  const warAlertActive =
    rescueWindowOpen ||
    state.players.some((player) => !player.defected && player.shields <= 10);

  const shieldBonus = synergyBonusActive ? 5 : 0;
  const players = state.players.map((player) =>
    recalcNetWorth({
      ...player,
      shields: clamp(player.shields + shieldBonus, 0, 100),
    }),
  );

  return {
    ...state,
    players,
    macro: {
      ...state.macro,
      synergyBonusActive,
      rescueWindowOpen,
      aidWindowOpen,
      warAlertActive,
      phase: nextPhase(state.macro.tick),
    },
  };
}

function mutatePlayer(
  state: HouseholdModeState,
  playerId: string,
  transform: (player: HouseholdPlayerState) => HouseholdPlayerState,
): HouseholdModeState {
  const player = byPlayerId(state.players, playerId);
  const updated = recalcNetWorth(transform(player));
  return {
    ...state,
    players: replacePlayer(state.players, updated),
  };
}

function applyBailOut(state: HouseholdModeState, action: BailOutAction): HouseholdModeState {
  if (action.actorId === action.targetId) {
    throw new Error('Bailout actor and target must differ.');
  }
  if (action.amount <= 0) {
    throw new Error('Bailout amount must be greater than zero.');
  }

  const actor = byPlayerId(state.players, action.actorId);
  const target = byPlayerId(state.players, action.targetId);

  if (actor.cash < action.amount) {
    throw new Error('Bailout actor has insufficient cash.');
  }

  let nextState = mutatePlayer(state, actor.playerId, (player) => ({
    ...player,
    cash: player.cash - action.amount,
    trustScore: clamp(
      player.trustScore + (action.stringsAttached ? 3 : 8),
      0,
      100,
    ),
    bailoutsGiven: player.bailoutsGiven + 1,
  }));

  nextState = mutatePlayer(nextState, target.playerId, (player) => ({
    ...player,
    cash: player.cash + action.amount,
    pressure: clamp(player.pressure - Math.round(action.amount / 500), 0, 100),
    trustScore: clamp(
      player.trustScore + (action.stringsAttached ? -2 : 5),
      0,
      100,
    ),
    bailoutsReceived: player.bailoutsReceived + 1,
  }));

  return appendEvent(
    refreshMacro(nextState),
    action.type,
    action.actorId,
    action.targetId,
    action.amount,
    action.stringsAttached ? 'bailout_with_strings' : 'bailout_clean',
  );
}

function applySyndicateDeal(
  state: HouseholdModeState,
  action: SyndicateDealAction,
): HouseholdModeState {
  if (action.partnerIds.length === 0) {
    throw new Error('Syndicate deal requires at least one partner.');
  }
  if (action.treasuryContribution <= 0 || action.expectedYield <= 0) {
    throw new Error('Syndicate deal amounts must be greater than zero.');
  }
  if (state.macro.treasury < action.treasuryContribution) {
    throw new Error('Insufficient treasury for syndicate deal.');
  }

  const participants = new Set([action.actorId, ...action.partnerIds]);
  const yieldPerParticipant = Math.floor(action.expectedYield / participants.size);

  let nextState: HouseholdModeState = {
    ...state,
    macro: {
      ...state.macro,
      treasury: state.macro.treasury - action.treasuryContribution + action.expectedYield,
    },
  };

  for (const participantId of participants) {
    nextState = mutatePlayer(nextState, participantId, (player) => ({
      ...player,
      cash: player.cash + yieldPerParticipant,
      income: player.income + Math.max(1, Math.floor(yieldPerParticipant / 20)),
      trustScore: clamp(player.trustScore + 6, 0, 100),
      syndicatesClosed: player.syndicatesClosed + 1,
    }));
  }

  return appendEvent(
    refreshMacro(nextState),
    action.type,
    action.actorId,
    null,
    action.expectedYield,
    `syndicate:${[...participants].join(',')}`,
  );
}

function applyTreasuryLoan(
  state: HouseholdModeState,
  action: TreasuryLoanAction,
): HouseholdModeState {
  if (action.amount <= 0 || action.dueTickOffset < 1) {
    throw new Error('Treasury loan values are invalid.');
  }
  if (state.macro.treasury < action.amount) {
    throw new Error('Insufficient treasury for loan.');
  }

  const loan: HouseholdLoan = {
    loanId: `${action.actorId}:${state.macro.tick}:${state.macro.loans.length + 1}`,
    borrowerId: action.actorId,
    principal: action.amount,
    issuedTick: state.macro.tick,
    dueTick: state.macro.tick + action.dueTickOffset,
    repaid: false,
  };

  let nextState: HouseholdModeState = {
    ...state,
    macro: {
      ...state.macro,
      treasury: state.macro.treasury - action.amount,
      loans: [...state.macro.loans, loan],
    },
  };

  nextState = mutatePlayer(nextState, action.actorId, (player) => ({
    ...player,
    cash: player.cash + action.amount,
    liabilities: player.liabilities + Math.ceil(action.amount * 1.1),
    trustScore: clamp(player.trustScore - 1, 0, 100),
  }));

  return appendEvent(
    refreshMacro(nextState),
    action.type,
    action.actorId,
    null,
    action.amount,
    `loan_due_tick:${loan.dueTick}`,
  );
}

function applyLoanRepayment(
  state: HouseholdModeState,
  action: RepayLoanAction,
): HouseholdModeState {
  const loan = state.macro.loans.find(
    (entry) => entry.loanId === action.loanId && !entry.repaid,
  );
  if (!loan) {
    throw new Error('Loan not found or already repaid.');
  }
  if (loan.borrowerId !== action.actorId) {
    throw new Error('Loan borrower mismatch.');
  }

  const repaymentAmount = Math.ceil(loan.principal * 1.1);
  const borrower = byPlayerId(state.players, action.actorId);
  if (borrower.cash < repaymentAmount) {
    throw new Error('Insufficient cash for loan repayment.');
  }

  let nextState: HouseholdModeState = {
    ...state,
    macro: {
      ...state.macro,
      treasury: state.macro.treasury + repaymentAmount,
      loans: state.macro.loans.map((entry) =>
        entry.loanId === action.loanId ? { ...entry, repaid: true } : entry,
      ),
    },
  };

  nextState = mutatePlayer(nextState, action.actorId, (player) => ({
    ...player,
    cash: player.cash - repaymentAmount,
    liabilities: Math.max(player.liabilities - repaymentAmount, 0),
    trustScore: clamp(player.trustScore + 4, 0, 100),
  }));

  return appendEvent(
    refreshMacro(nextState),
    action.type,
    action.actorId,
    null,
    repaymentAmount,
    `repaid:${action.loanId}`,
  );
}

function applyCascadeAbsorb(
  state: HouseholdModeState,
  action: CascadeAbsorbAction,
): HouseholdModeState {
  if (action.actorId === action.targetId) {
    throw new Error('Cascade absorber and target must differ.');
  }

  let nextState = mutatePlayer(state, action.actorId, (player) => ({
    ...player,
    shields: clamp(player.shields - action.shieldCost, 0, 100),
    pressure: clamp(player.pressure + Math.ceil(action.shieldCost / 4), 0, 100),
    trustScore: clamp(player.trustScore + 10, 0, 100),
    cascadeAbsorptions: player.cascadeAbsorptions + 1,
  }));

  nextState = mutatePlayer(nextState, action.targetId, (player) => ({
    ...player,
    pressure: clamp(player.pressure - action.pressureReduction, 0, 100),
    trustScore: clamp(player.trustScore + 5, 0, 100),
  }));

  return appendEvent(
    refreshMacro(nextState),
    action.type,
    action.actorId,
    action.targetId,
    action.shieldCost,
    `pressure_reduction:${action.pressureReduction}`,
  );
}

function applyDefection(state: HouseholdModeState, action: DefectAction): HouseholdModeState {
  if (state.macro.tick < 8) {
    throw new Error('Defection is not legal before tick 8.');
  }
  if (state.macro.defectionOccurred) {
    throw new Error('Only one defection is allowed per household run.');
  }

  const theft = Math.floor(state.macro.treasury * 0.4);

  let nextState: HouseholdModeState = {
    ...state,
    macro: {
      ...state.macro,
      treasury: state.macro.treasury - theft,
      defectionOccurred: true,
    },
  };

  nextState = mutatePlayer(nextState, action.actorId, (player) => ({
    ...player,
    cash: player.cash + theft,
    trustScore: 0,
    defected: true,
  }));

  for (const player of nextState.players) {
    if (player.playerId === action.actorId) {
      continue;
    }
    nextState = mutatePlayer(nextState, player.playerId, (entry) => ({
      ...entry,
      trustScore: clamp(entry.trustScore - 18, 0, 100),
      pressure: clamp(entry.pressure + 15, 0, 100),
    }));
  }

  return appendEvent(
    refreshMacro(nextState),
    action.type,
    action.actorId,
    null,
    theft,
    'defection_40pct_treasury',
  );
}

function applySabotagePolicy(
  state: HouseholdModeState,
  action: SabotagePolicyAction,
): HouseholdModeState {
  let nextState: HouseholdModeState = {
    ...state,
    macro: {
      ...state.macro,
      treasury: Math.max(state.macro.treasury + action.treasuryDelta, 0),
      pressure: clamp(state.macro.pressure + action.pressureDelta, 0, 100),
      activePolicies: [...state.macro.activePolicies, action.label],
    },
  };

  nextState = mutatePlayer(nextState, action.actorId, (player) => ({
    ...player,
    sabotageEvents: player.sabotageEvents + 1,
    trustScore: clamp(player.trustScore - (state.macro.hardMode ? 18 : 10), 0, 100),
  }));

  return appendEvent(
    refreshMacro(nextState),
    action.type,
    action.actorId,
    null,
    action.treasuryDelta,
    `policy:${action.label}:pressure:${action.pressureDelta}`,
  );
}

function applyProofShare(
  state: HouseholdModeState,
  action: ProofShareAction,
): HouseholdModeState {
  const nextState = mutatePlayer(state, action.actorId, (player) => ({
    ...player,
    trustScore: clamp(player.trustScore + 2, 0, 100),
    lastProofShareTick: state.macro.tick,
  }));

  return appendEvent(
    refreshMacro(nextState),
    action.type,
    action.actorId,
    null,
    null,
    'proof_share',
  );
}

function applyAidRequest(
  state: HouseholdModeState,
  action: AidRequestAction,
): HouseholdModeState {
  const nextState = mutatePlayer(state, action.actorId, (player) => ({
    ...player,
    aidRequests: player.aidRequests + 1,
    pressure: clamp(player.pressure + 2, 0, 100),
  }));

  return appendEvent(
    refreshMacro(nextState),
    action.type,
    action.actorId,
    null,
    null,
    'aid_request',
  );
}

function applyTableEvent(
  state: HouseholdModeState,
  action: ApplyTableEventAction,
): HouseholdModeState {
  let nextState: HouseholdModeState = {
    ...state,
    macro: {
      ...state.macro,
      treasury: Math.max(state.macro.treasury + action.treasuryDelta, 0),
      pressure: clamp(state.macro.pressure + action.pressureDelta, 0, 100),
    },
  };

  nextState = mutatePlayer(nextState, action.actorId, (player) => ({
    ...player,
    trustScore: clamp(player.trustScore + 1, 0, 100),
  }));

  return appendEvent(
    refreshMacro(nextState),
    action.type,
    action.actorId,
    null,
    action.treasuryDelta,
    action.label,
  );
}

function applyTick(state: HouseholdModeState, action: AdvanceTickAction): HouseholdModeState {
  const tick = state.macro.tick + 1;
  const pressureDelta = action.incomingPressure ?? 0;
  const treasuryDelta = action.treasuryDelta ?? 0;
  const loans = state.macro.loans;

  let nextState: HouseholdModeState = {
    ...state,
    macro: {
      ...state.macro,
      tick,
      phase: nextPhase(tick),
      treasury: Math.max(state.macro.treasury + treasuryDelta, 0),
      pressure: clamp(state.macro.pressure + pressureDelta, 0, 100),
      loans,
    },
  };

  for (const loan of loans) {
    if (loan.repaid || loan.dueTick > tick) {
      continue;
    }
    nextState = mutatePlayer(nextState, loan.borrowerId, (player) => ({
      ...player,
      trustScore: clamp(player.trustScore - 8, 0, 100),
      pressure: clamp(player.pressure + 10, 0, 100),
    }));
    nextState = {
      ...nextState,
      macro: {
        ...nextState.macro,
        loans: nextState.macro.loans.map((entry) =>
          entry.loanId === loan.loanId ? { ...entry, repaid: true } : entry,
        ),
      },
    };
    nextState = appendEvent(
      nextState,
      'SYSTEM',
      null,
      loan.borrowerId,
      loan.principal,
      `loan_default:${loan.loanId}`,
    );
  }

  const players = nextState.players.map((player) => {
    const passiveIncome = player.defected ? 0 : player.income;
    const burn = Math.max(1, Math.ceil(player.liabilities / 20));
    return recalcNetWorth({
      ...player,
      cash: Math.max(player.cash + passiveIncome - burn, 0),
      pressure: clamp(
        player.pressure +
          (nextState.macro.pressure >= 70 ? 4 : 1) -
          Math.min(Math.floor(player.shields / 25), 3),
        0,
        100,
      ),
      aidRequests: 0,
    });
  });

  nextState = {
    ...nextState,
    players,
  };

  return refreshMacro(
    appendEvent(nextState, action.type, null, null, treasuryDelta, `pressure:${pressureDelta}`),
  );
}

export class HouseholdModeEngine {
  private state: HouseholdModeState;

  public constructor(initialState: HouseholdModeState) {
    if (initialState.players.length < 2 || initialState.players.length > 4) {
      throw new Error('Household mode supports 2 to 4 players.');
    }
    this.state = refreshMacro(initialState);
  }

  public getState(): HouseholdModeState {
    return this.state;
  }

  public dispatch(action: HouseholdModeAction): HouseholdModeState {
    switch (action.type) {
      case 'ADVANCE_TICK':
        this.state = applyTick(this.state, action);
        return this.state;
      case 'APPLY_TABLE_EVENT':
        this.state = applyTableEvent(this.state, action);
        return this.state;
      case 'BAIL_OUT':
        this.state = applyBailOut(this.state, action);
        return this.state;
      case 'SYNDICATE_DEAL':
        this.state = applySyndicateDeal(this.state, action);
        return this.state;
      case 'TREASURY_LOAN':
        this.state = applyTreasuryLoan(this.state, action);
        return this.state;
      case 'REPAY_LOAN':
        this.state = applyLoanRepayment(this.state, action);
        return this.state;
      case 'CASCADE_ABSORB':
        this.state = applyCascadeAbsorb(this.state, action);
        return this.state;
      case 'DEFECT':
        this.state = applyDefection(this.state, action);
        return this.state;
      case 'SABOTAGE_POLICY':
        this.state = applySabotagePolicy(this.state, action);
        return this.state;
      case 'PROOF_SHARE':
        this.state = applyProofShare(this.state, action);
        return this.state;
      case 'AID_REQUEST':
        this.state = applyAidRequest(this.state, action);
        return this.state;
      default: {
        const exhaustive: never = action;
        return exhaustive;
      }
    }
  }
}

export function createInitialHouseholdModeState(input: {
  readonly runId: string;
  readonly players: ReadonlyArray<{
    readonly playerId: string;
    readonly displayName: string;
    readonly role: HouseholdRole;
    readonly cash: number;
    readonly income: number;
    readonly liabilities: number;
    readonly shields?: number;
  }>;
  readonly treasury: number;
  readonly hardMode?: boolean;
}): HouseholdModeState {
  return {
    runId: input.runId,
    players: input.players.map((player) =>
      recalcNetWorth({
        playerId: player.playerId,
        displayName: player.displayName,
        role: player.role,
        cash: Math.max(player.cash, 0),
        income: Math.max(player.income, 0),
        liabilities: Math.max(player.liabilities, 0),
        netWorth: 0,
        pressure: 0,
        shields: clamp(player.shields ?? 60, 0, 100),
        trustScore: 50,
        aidRequests: 0,
        bailoutsGiven: 0,
        bailoutsReceived: 0,
        syndicatesClosed: 0,
        sabotageEvents: 0,
        cascadeAbsorptions: 0,
        defected: false,
        lastProofShareTick: null,
      }),
    ),
    macro: {
      tick: 0,
      phase: 'FOUNDATION',
      treasury: Math.max(input.treasury, 0),
      pressure: 0,
      hardMode: Boolean(input.hardMode),
      warAlertActive: false,
      rescueWindowOpen: false,
      aidWindowOpen: false,
      synergyBonusActive: false,
      activePolicies: [],
      eventLog: [],
      loans: [],
      defectionOccurred: false,
    },
  };
}