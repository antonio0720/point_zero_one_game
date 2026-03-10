import type {
  FrontendModeCode,
  FrontendRunMode,
  PressureTier,
  SoloPhase,
  TeamRole,
  TimingClass,
} from '../contracts';

export const MODE_TO_CODE: Record<FrontendRunMode, FrontendModeCode> = {
  solo: 'empire',
  'asymmetric-pvp': 'predator',
  'co-op': 'syndicate',
  ghost: 'phantom',
};

export const MODE_TO_SCREEN: Record<FrontendRunMode, string> = {
  solo: 'EmpireGameScreen',
  'asymmetric-pvp': 'PredatorGameScreen',
  'co-op': 'SyndicateGameScreen',
  ghost: 'PhantomGameScreen',
};

export const MODE_TO_LABEL: Record<FrontendRunMode, string> = {
  solo: 'EMPIRE',
  'asymmetric-pvp': 'PREDATOR',
  'co-op': 'SYNDICATE',
  ghost: 'PHANTOM',
};

export const PRESSURE_TICK_MS: Record<PressureTier, number> = {
  T0: 2_000,
  T1: 4_000,
  T2: 6_000,
  T3: 8_500,
  T4: 12_000,
};

export const SOLO_PHASE_WINDOWS: Array<{ phase: SoloPhase; startMs: number; endMs: number }> = [
  { phase: 'FOUNDATION', startMs: 0, endMs: 4 * 60_000 },
  { phase: 'ESCALATION', startMs: 4 * 60_000, endMs: 8 * 60_000 },
  { phase: 'SOVEREIGNTY', startMs: 8 * 60_000, endMs: 12 * 60_000 },
];

export const TIMING_WINDOW_DESCRIPTIONS: Record<TimingClass, string> = {
  PRE: 'Before the engine tick resolves.',
  POST: 'After the tick resolves.',
  FATE: 'Immediately after a FATE event fires.',
  CTR: 'Only during an incoming extraction action.',
  RES: 'Only when a teammate hits critical pressure.',
  AID: 'Only when a teammate explicitly requests aid.',
  GBM: 'Within 3 ticks of a Legend Marker.',
  CAS: 'During an active cascade chain before the next link fires.',
  PHZ: 'At a solo-mode phase boundary.',
  PSK: 'When pressure crosses into a higher tier.',
  END: 'At the end of a run.',
  ANY: 'No restriction.',
};

export const TAG_WEIGHTS: Record<FrontendModeCode, Record<string, number>> = {
  empire: {
    liquidity: 2.0,
    income: 2.2,
    resilience: 1.8,
    scale: 2.5,
    tempo: 1.0,
    sabotage: 0.0,
    counter: 0.0,
    heat: 0.6,
    trust: 0.0,
    aid: 0.0,
    precision: 1.2,
    divergence: 0.0,
    variance: 1.0,
    cascade: 1.8,
    momentum: 2.0,
  },
  predator: {
    liquidity: 0.8,
    income: 0.6,
    resilience: 1.0,
    scale: 0.5,
    tempo: 2.4,
    sabotage: 2.8,
    counter: 2.2,
    heat: 1.5,
    trust: 0.0,
    aid: 0.0,
    precision: 0.8,
    divergence: 0.0,
    variance: 1.4,
    cascade: 1.2,
    momentum: 1.5,
  },
  syndicate: {
    liquidity: 1.5,
    income: 1.8,
    resilience: 2.0,
    scale: 1.3,
    tempo: 1.0,
    sabotage: 0.2,
    counter: 0.5,
    heat: 0.8,
    trust: 3.0,
    aid: 2.5,
    precision: 1.0,
    divergence: 0.0,
    variance: 0.4,
    cascade: 1.6,
    momentum: 1.2,
  },
  phantom: {
    liquidity: 1.2,
    income: 1.0,
    resilience: 1.4,
    scale: 0.9,
    tempo: 1.8,
    sabotage: 0.0,
    counter: 0.0,
    heat: 1.0,
    trust: 0.0,
    aid: 0.0,
    precision: 2.6,
    divergence: 3.0,
    variance: 0.3,
    cascade: 1.5,
    momentum: 1.0,
  },
};

export const MODE_LEGAL_DECKS: Record<FrontendRunMode, string[]> = {
  solo: ['OPPORTUNITY', 'IPA', 'FUBAR', 'MISSED_OPPORTUNITY', 'PRIVILEGED', 'SO', 'DISCIPLINE'],
  'asymmetric-pvp': ['OPPORTUNITY', 'IPA', 'FUBAR', 'MISSED_OPPORTUNITY', 'PRIVILEGED', 'SO', 'SABOTAGE', 'COUNTER', 'BLUFF'],
  'co-op': ['OPPORTUNITY', 'IPA', 'FUBAR', 'MISSED_OPPORTUNITY', 'PRIVILEGED', 'SO', 'AID', 'RESCUE', 'TRUST'],
  ghost: ['OPPORTUNITY', 'IPA', 'FUBAR', 'MISSED_OPPORTUNITY', 'PRIVILEGED', 'SO', 'DISCIPLINE', 'GHOST'],
};

export const MODE_HAND_LIMITS: Record<FrontendRunMode, number> = {
  solo: 5,
  'asymmetric-pvp': 6,
  'co-op': 5,
  ghost: 4,
};

export const TEAM_ROLES: TeamRole[] = [
  'INCOME_BUILDER',
  'SHIELD_ARCHITECT',
  'DEBT_SURGEON',
  'INTEL_BROKER',
];

export const GHOST_DECAY_MILESTONES = [
  { label: '72h', hours: 72, severity: 0.4, attack: 'EMERGENCY_EXPENSE' },
  { label: '1w', hours: 24 * 7, severity: 0.5, attack: 'INCOME_SEIZURE' },
  { label: '2w', hours: 24 * 14, severity: 0.6, attack: 'DEBT_SPIRAL' },
  { label: '1m', hours: 24 * 30, severity: 0.7, attack: 'MARKET_CORRECTION' },
  { label: '3m', hours: 24 * 90, severity: 0.8, attack: 'TAX_AUDIT' },
  { label: '6m+', hours: 24 * 180, severity: 1.0, attack: 'SYSTEM_GLITCH' },
] as const;

export const SOLO_HOLD_RULES = {
  freeHolds: 1,
  bonusMomentumThreshold: 0.7,
  noHoldBonusPct: 0.25,
} as const;

export const PREDATOR_RULES = {
  battleBudgetCap: 200,
  counterWindowMs: 5_000,
  firstRefusalMs: 8_000,
  sabotageCooldownTicks: 3,
} as const;

export const SYNDICATE_RULES = {
  treasuryFreedomMultiplier: 1.8,
  treasuryCriticalFloor: 3_000,
  defectionWithdrawalPct: 0.4,
  roleSynergyShieldBonus: 0.15,
} as const;

export const PHANTOM_RULES = {
  benchmarkWindowTicks: 3,
  dynastyBonusPct: 1.0,
  challengerBonusPct: 0.2,
  legendGapPct: 0.75,
} as const;
