export enum Phase {
  Initial = 'Initial',
  Normal = 'Normal',
  Crisis = 'Crisis'
}

export interface PlayerState {
  cash: number;
  assetsBlgDeal?: BigDealAsset;
  assetsIpa?: IPAAsset;
  monthlyIncome: number;
  monthlyDebtService: number;
  netCashflow: number;
  downpayCredit: number;
  debtServiceCredit: number;
  activeShields: number;
  leverageBlocks: number;
  turnsToSkip: number;
  consecutivePasses: number;
  inflation: number;
  creditTightness: number;
  phase: Phase;
}

export interface BigDealAsset {
  id: string;
  type: 'Stock' | 'Bond';
  quantity: number;
  price: number;
  value: number;
  mlEnabled?: boolean;
  auditHash?: string;
}

export interface IPAAsset {
  id: string;
  type: 'Stock' | 'Bond';
  quantity: number;
  price: number;
  value: number;
  mlEnabled?: boolean;
  auditHash?: string;
}

const validatePlayerState = (playerState: PlayerState): void => {
  if (!('cash' in playerState)) {
    throw new Error('Missing required property "cash"');
  }
  if ('assetsBlgDeal' in playerState && !(playerState.assetsBlgDeal instanceof BigDealAsset)) {
    throw new Error('Invalid type for assetsBlgDeal');
  }
  if ('assetsIpa' in playerState && !(playerState.assetsIpa instanceof IPAAsset)) {
    throw new Error('Invalid type for assetsIpa');
  }
  if (!('monthlyIncome' in playerState) || !Number.isInteger(playerState.monthlyIncome)) {
    throw new Error('Missing required property "monthlyIncome" or invalid value');
  }
  if (!('monthlyDebtService' in playerState) || !Number.isInteger(playerState.monthlyDebtService)) {
    throw new Error('Missing required property "monthlyDebtService" or invalid value');
  }
  if (!('netCashflow' in playerState) || !Number.isInteger(playerState.netCashflow)) {
    throw new Error('Missing required property "netCashflow" or invalid value');
  }
  if (!('downpayCredit' in playerState) || !Number.isInteger(playerState.downpayCredit)) {
    throw new Error('Missing required property "downpayCredit" or invalid value');
  }
  if (!('debtServiceCredit' in playerState) || !Number.isInteger(playerState.debtServiceCredit)) {
    throw new Error('Missing required property "debtServiceCredit" or invalid value');
  }
  if (!('activeShields' in playerState) || !Number.isInteger(playerState.activeShields)) {
    throw new Error('Missing required property "activeShields" or invalid value');
  }
  if (!('leverageBlocks' in playerState) || !Number.isInteger(playerState.leverageBlocks)) {
    throw new Error('Missing required property "leverageBlocks" or invalid value');
  }
  if (!('turnsToSkip' in playerState) || !Number.isInteger(playerState.turnsToSkip)) {
    throw new Error('Missing required property "turnsToSkip" or invalid value');
  }
  if (!('consecutivePasses' in playerState) || !Number.isInteger(playerState.consecutivePasses)) {
    throw new Error('Missing required property "consecutivePasses" or invalid value');
  }
  if (!('inflation' in playerState) || !Number.isInteger(playerState.inflation)) {
    throw new Error('Missing required property "inflation" or invalid value');
  }
  if (!('creditTightness' in playerState) || !Number.isInteger(playerState.creditTightness)) {
    throw new Error('Missing required property "creditTightness" or invalid value');
  }
  if (!('phase' in playerState) || !(playerState.phase instanceof Phase)) {
    throw new Error('Missing required property "phase" or invalid value');
  }
};

export class PlayerStateImpl implements PlayerState {
  cash: number;
  assetsBlgDeal?: BigDealAsset;
  assetsIpa?: IPAAsset;
  monthlyIncome: number;
  monthlyDebtService: number;
  netCashflow: number;
  downpayCredit: number;
  debtServiceCredit: number;
  activeShields: number;
  leverageBlocks: number;
  turnsToSkip: number;
  consecutivePasses: number;
  inflation: number;
  creditTightness: number;
  phase: Phase;

  constructor({
    cash,
    assetsBlgDeal,
    assetsIpa,
    monthlyIncome,
    monthlyDebtService,
    netCashflow,
    downpayCredit,
    debtServiceCredit,
    activeShields,
    leverageBlocks,
    turnsToSkip,
    consecutivePasses,
    inflation,
    creditTightness,
    phase
  }: {
    cash: number;
    assetsBlgDeal?: BigDealAsset;
    assetsIpa?: IPAAsset;
    monthlyIncome: number;
    monthlyDebtService: number;
    netCashflow: number;
    downpayCredit: number;
    debtServiceCredit: number;
    activeShields: number;
    leverageBlocks: number;
    turnsToSkip: number;
    consecutivePasses: number;
    inflation: number;
    creditTightness: number;
    phase: Phase;
  }) {
    this.cash = cash;
    this.assetsBlgDeal = assetsBlgDeal;
    this.assetsIpa = assetsIpa;
    this.monthlyIncome = monthlyIncome;
    this.monthlyDebtService = monthlyDebtService;
    this.netCashflow = netCashflow;
    this.downpayCredit = downpayCredit;
    this.debtServiceCredit = debtServiceCredit;
    this.activeShields = activeShields;
    this.leverageBlocks = leverageBlocks;
    this.turnsToSkip = turnsToSkip;
    this.consecutivePasses = consecutivePasses;
    this.inflation = inflation;
    this.creditTightness = creditTightness;
    this.phase = phase;

    validatePlayerState(this);
  }
}
