// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — CORE ENGINE TYPES
// pzo-web/src/engines/core/types.ts
// Density6 LLC · Confidential · All Rights Reserved
// ═══════════════════════════════════════════════════════════════════════════
// Zero runtime logic. Pure TypeScript declarations.
// Every engine imports from here. Nothing else is cross-boundary.

// ── RUN LIFECYCLE ────────────────────────────────────────────────────────────

/** All possible outcomes when a run ends. Drives sovereignty_score multiplier. */
export type RunOutcome = 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT' | 'ABANDONED';

/** Run lifecycle state. Orchestrator is the sole writer. */
export type RunLifecycleState =
  | 'IDLE'
  | 'STARTING'
  | 'ACTIVE'
  | 'TICK_LOCKED'
  | 'ENDING'
  | 'ENDED';

/** The four playable modes. Each activates a distinct mode engine. */
export type RunMode = 'solo' | 'asymmetric-pvp' | 'co-op' | 'ghost';

// ── TICK & PRESSURE TIERS ────────────────────────────────────────────────────

/**
 * Five tick rate categories. T0 = sovereign speed (winning).
 * T4 = collapse speed (time accelerates against you).
 */
export type TickTier = 'T0' | 'T1' | 'T2' | 'T3' | 'T4';

/** Tick duration in milliseconds per tier. Crisis compresses time. */
export const TICK_DURATION_MS: Record<TickTier, number> = {
  T0: 1800, // Sovereign — you're winning
  T1: 1200, // Stable — normal pace
  T2: 900,  // Compressed — pressure building
  T3: 600,  // Crisis — ticks accelerating
  T4: 350,  // Collapse imminent — chaos speed
};

/** Decision window duration in seconds per tier (forced-fate card countdowns). */
export const DECISION_WINDOW_S: Record<TickTier, number> = {
  T0: 12,
  T1: 8,
  T2: 5,
  T3: 3,
  T4: 1.5,
};

/** Five pressure tiers from PressureEngine. Drives tick tier selection. */
export type PressureTier = 'CALM' | 'BUILDING' | 'ELEVATED' | 'HIGH' | 'CRITICAL';

/** Pressure score thresholds — tier transitions fire when score crosses these. */
export const PRESSURE_TIER_THRESHOLDS: Record<PressureTier, number> = {
  CALM:     0.0,
  BUILDING: 0.2,
  ELEVATED: 0.45,
  HIGH:     0.65,
  CRITICAL: 0.85,
};

// ── SHIELD ARCHITECTURE ───────────────────────────────────────────────────────

/**
 * Four financial protection layers. L1=outermost (cheapest to lose).
 * L4=innermost (breach triggers cascade + hater_heat max).
 */
export type ShieldLayerId =
  | 'L1_LIQUIDITY_BUFFER'
  | 'L2_CREDIT_LINE'
  | 'L3_ASSET_FLOOR'
  | 'L4_NETWORK_CORE';

/** Shield layer max integrity values. */
export const SHIELD_MAX_INTEGRITY: Record<ShieldLayerId, number> = {
  L1_LIQUIDITY_BUFFER: 100,
  L2_CREDIT_LINE:      120,
  L3_ASSET_FLOOR:      150,
  L4_NETWORK_CORE:     200,
};

/** Passive regen per tick per layer. Player does nothing, shields slowly heal. */
export const SHIELD_REGEN_PER_TICK: Record<ShieldLayerId, number> = {
  L1_LIQUIDITY_BUFFER: 2,
  L2_CREDIT_LINE:      2,
  L3_ASSET_FLOOR:      1,
  L4_NETWORK_CORE:     1,
};

export interface ShieldLayer {
  id:          ShieldLayerId;
  label:       string;           // human-readable name shown in UI
  current:     number;           // current integrity (0–max)
  max:         number;           // max integrity from SHIELD_MAX_INTEGRITY
  breached:    boolean;          // true when current === 0
  lastBreach:  number | null;    // tick when last breached
  regenActive: boolean;          // false while under attack this tick
}

export interface ShieldState {
  layers:             Record<ShieldLayerId, ShieldLayer>;
  overallIntegrityPct: number;   // weighted average 0.0–1.0, read by PressureEngine
  l4BreachCount:      number;    // number of times NETWORK_CORE has breached this run
}

// ── ADVERSARY / HATER BOT SYSTEM ─────────────────────────────────────────────

/** Five adversary identities. Each is a systemic financial force, not a character. */
export type BotId =
  | 'BOT_01_LIQUIDATOR'
  | 'BOT_02_BUREAUCRAT'
  | 'BOT_03_MANIPULATOR'
  | 'BOT_04_CRASH_PROPHET'
  | 'BOT_05_LEGACY_HEIR';

/** Bot FSM states. Multiple bots can be in ATTACKING simultaneously at high heat. */
export type BotState =
  | 'DORMANT'
  | 'WATCHING'
  | 'TARGETING'
  | 'ATTACKING'
  | 'RETREATING'
  | 'NEUTRALIZED';

export interface BotProfile {
  id:              BotId;
  name:            string;        // e.g. "The Liquidator"
  archetype:       string;        // one-line financial threat description
  escalationHeat:  number;        // hater_heat required for DORMANT→WATCHING
  targetingHeat:   number;        // hater_heat for WATCHING→TARGETING
  attackingHeat:   number;        // hater_heat for TARGETING→ATTACKING
  primaryAttack:   AttackType;
  secondaryAttack: AttackType;
  dialogue: {
    activate:     string;         // message shown when bot wakes up
    targeting:    string;         // message shown when bot locks on
    attack:       string;         // message shown when attack fires
    retreat:      string;         // message shown when bot retreats
    neutralized:  string;         // message shown when player counters
  };
}

export interface BotRuntimeState {
  id:               BotId;
  state:            BotState;
  ticksInState:     number;       // how many ticks in current state
  preloadedArrival: number | null; // tick when attack will fire (set when TARGETING)
  isCritical:       boolean;       // true if spent 2+ ticks TARGETING (bypasses deflection)
  lastAttackTick:   number | null;
}

// ── ATTACK SYSTEM ─────────────────────────────────────────────────────────────

/** Attack types that can arrive from bots or cascade chains. */
export type AttackType =
  | 'FINANCIAL_SABOTAGE'
  | 'EXPENSE_INJECTION'
  | 'DEBT_ATTACK'
  | 'ASSET_STRIP'
  | 'REPUTATION_ATTACK'
  | 'REGULATORY_ATTACK'
  | 'HATER_INJECTION'
  | 'OPPORTUNITY_KILL';

export interface AttackEvent {
  id:           string;          // UUID
  sourceBot:    BotId;
  attackType:   AttackType;
  damage:       number;          // raw damage before shield processing
  isCritical:   boolean;         // critical = bypasses all shield deflection
  targetLayer:  ShieldLayerId;   // resolved by AttackRouter
  arrivalTick:  number;
  label:        string;          // financial combat vocabulary description
}

// ── CASCADE CHAIN SYSTEM ──────────────────────────────────────────────────────

export type CascadeChainId =
  | 'CHAIN_01_LOAN_DEFAULT'
  | 'CHAIN_02_LIQUIDITY_BREACH'
  | 'CHAIN_03_NETWORK_COLLAPSE'
  | 'CHAIN_04_EXTRACTION_COMPOUND'
  | 'CHAIN_05_NET_WORTH_COLLAPSE'
  | 'CHAIN_06_TOTAL_SYSTEMIC'
  | 'CHAIN_07_PATTERN_EXPLOITATION'
  | 'CHAIN_08_POSITIVE_MOMENTUM';

export type CascadeChainState = 'PENDING' | 'ACTIVE' | 'INTERCEPTED' | 'COMPLETED' | 'DISSOLVED';

export interface CascadeLink {
  tickOffset:  number;   // fires at triggerTick + tickOffset
  effectType:  'INCOME_DRAIN' | 'EXPENSE_SURGE' | 'HEAT_DELTA' | 'SHIELD_DAMAGE' | 'CARD_INJECT' | 'INCOME_BOOST' | 'EXPENSE_RELIEF';
  magnitude:   number;   // effect strength
  label:       string;   // financial combat vocabulary description
}

export interface CascadeChainInstance {
  id:          string;   // UUID
  chainId:     CascadeChainId;
  triggerTick: number;
  links:       CascadeLink[];
  state:       CascadeChainState;
  severity:    'LOW' | 'MEDIUM' | 'HIGH' | 'CATASTROPHIC';
}

// ── RUN STATE SNAPSHOT ────────────────────────────────────────────────────────

/**
 * Complete read-only snapshot of run state at the START of each tick.
 * Assembled by Orchestrator at Step 0. All engines read from this — never from live state.
 * Guarantees determinism: same snapshot + same seed = same output.
 */
export interface RunStateSnapshot {
  readonly tick:             number;
  readonly cash:             number;
  readonly income:           number;
  readonly expenses:         number;
  readonly netWorth:         number;
  readonly shields:          ShieldState;
  readonly haterHeat:        number;       // 0–100, drives bot escalation
  readonly botStates:        Readonly<Record<BotId, BotRuntimeState>>;
  readonly pressureScore:    number;       // 0.0–1.0
  readonly pressureTier:     PressureTier;
  readonly tickTier:         TickTier;
  readonly activeCascades:   CascadeChainInstance[];
  readonly runMode:          RunMode;
  readonly seed:             number;
  readonly lifecycleState:   RunLifecycleState;
}

// ── EVENT BUS CONTRACT ────────────────────────────────────────────────────────

/** All event types the EventBus can carry. Engines emit; engines subscribe. */
export type PZOEventType =
  // Lifecycle
  | 'RUN_STARTED'
  | 'RUN_ENDED'
  | 'TICK_START'
  | 'TICK_END'
  // Pressure
  | 'PRESSURE_TIER_CHANGED'
  | 'PRESSURE_SCORE_UPDATE'
  // Shields
  | 'SHIELD_DAMAGED'
  | 'SHIELD_LAYER_BREACHED'
  | 'SHIELD_L4_BREACH'
  | 'SHIELD_REPAIRED'
  // Battle
  | 'BOT_STATE_CHANGED'
  | 'BOT_ATTACK_FIRED'
  | 'BOT_NEUTRALIZED'
  | 'HATER_HEAT_CHANGED'
  // Cascade
  | 'CASCADE_TRIGGERED'
  | 'CASCADE_LINK_FIRED'
  | 'CASCADE_INTERCEPTED'
  | 'CASCADE_COMPLETED'
  // Finances
  | 'INCOME_CHANGED'
  | 'EXPENSE_CHANGED'
  | 'CASH_CHANGED'
  | 'NET_WORTH_CHANGED'
  // Mode-specific
  | 'SABOTAGE_FIRED'          // asymmetric-pvp: hater player fires sabotage
  | 'SABOTAGE_BLOCKED'        // asymmetric-pvp: builder blocks sabotage
  | 'PARTNER_DISTRESS'        // co-op: partner entered distress state
  | 'RESCUE_WINDOW_OPENED'    // co-op: rescue window available
  | 'RESCUE_WINDOW_EXPIRED'   // co-op: rescue window missed
  | 'AID_CONTRACT_SIGNED'     // co-op: players signed an aid deal
  | 'GHOST_DELTA_UPDATE'      // ghost: delta vs champion run updated
  | 'GHOST_AHEAD'             // ghost: player is ahead of champion
  | 'GHOST_BEHIND'            // ghost: player is behind champion
  | 'PROOF_BADGE_EARNED'      // ghost: player beat the champion ghost
  // Sovereignty
  | 'PROOF_HASH_GENERATED'
  | 'RUN_GRADED'
  | 'PROOF_EXPORT_READY';

export interface PZOEvent<T = unknown> {
  type:    PZOEventType;
  tick:    number;
  payload: T;
}

// ── SOVEREIGNTY / PROOF ───────────────────────────────────────────────────────

export type RunGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export const OUTCOME_MULTIPLIERS: Record<RunOutcome, number> = {
  FREEDOM:   1.0,
  TIMEOUT:   0.7,
  BANKRUPT:  0.3,
  ABANDONED: 0.0,
};

export const GRADE_THRESHOLDS: Array<{ min: number; grade: RunGrade }> = [
  { min: 900, grade: 'S' },
  { min: 750, grade: 'A' },
  { min: 600, grade: 'B' },
  { min: 450, grade: 'C' },
  { min: 300, grade: 'D' },
  { min: 0,   grade: 'F' },
];

// ── MODE-LEVEL ENGINE INTERFACE ───────────────────────────────────────────────

/** Interface every mode engine must implement. Orchestrator calls these methods. */
export interface IGameModeEngine {
  readonly mode:     RunMode;
  readonly runId:    string;

  /** Initialize mode engine with starting config. Called once before first tick. */
  init(config: ModeInitConfig): void;

  /** Called at Step 5 of every tick sequence (after shields, before cascade). */
  onTick(snapshot: RunStateSnapshot): void;

  /** Called when the run ends to compute final mode-specific state. */
  onRunEnd(outcome: RunOutcome): void;

  /** Returns current mode state for Zustand store. */
  getState(): GameModeState;

  /** Subscribe to internal mode events (UI layer uses this). */
  subscribe(handler: (event: PZOEvent) => void): () => void;
}

// ── MODE INIT CONFIG ──────────────────────────────────────────────────────────

export interface ModeInitConfig {
  seed:          number;
  startingCash:  number;
  startingIncome: number;
  startingExpenses: number;
  runTicks:      number;     // total ticks in run (default 720)
  // Mode-specific overrides
  ghostChampionRunId?: string;   // ghost mode: champion run to race
  partnerPlayerId?:    string;   // co-op: partner identity
  haterPlayerId?:      string;   // asymmetric-pvp: who is the hater
  localRole?:          'builder' | 'hater'; // asymmetric-pvp: local player role
}

// ── GAME MODE STATE (what UI reads) ──────────────────────────────────────────

export interface GameModeState {
  mode:          RunMode;
  /** Solo / Empire */
  empire?: {
    currentWave:       number;    // 1–5 difficulty waves
    haterHeat:         number;    // 0–100
    activeBotCount:    number;
    highestBotThreat:  string;    // name of most dangerous active bot
    nextThreatTick:    number | null;
    cascadeChainCount: number;
    momentumScore:     number;    // positive cascade momentum 0–100
  };
  /** Asymmetric PvP / Predator */
  predator?: {
    localRole:         'builder' | 'hater';
    builderNetWorth:   number;
    haterSabotageAmmo: number;    // sabotage cards available
    counterplayWindow: boolean;   // builder has open counterplay window
    counterplayTicksLeft: number;
    haterComboCount:   number;    // consecutive unblocked sabotages
    builderShieldPct:  number;
    phase:             'early' | 'mid' | 'endgame'; // battle phase
  };
  /** Co-op / Syndicate */
  syndicate?: {
    partnerCash:         number;
    partnerIncome:       number;
    partnerNetWorth:     number;
    partnerShieldPct:    number;
    partnerInDistress:   boolean;
    rescueWindowOpen:    boolean;
    rescueWindowTicksLeft: number;
    activeAidContracts:  AidContractRecord[];
    synergyBonus:        number;  // 0.0–2.0 multiplier from shared success ticks
    combinedNetWorth:    number;
  };
  /** Ghost / Phantom */
  phantom?: {
    ghostNetWorth:       number;   // champion's net worth at current tick
    localNetWorth:       number;
    delta:               number;   // local - ghost (positive = ahead)
    deltaPct:            number;   // percentage ahead/behind
    ghostIsAlive:        boolean;  // false if ghost went bankrupt on this seed
    ghostWonAt:          number | null; // tick ghost achieved FREEDOM
    proofBadgeEarned:    boolean;
    divergencePoints:    DivergencePoint[]; // key moments where paths split
    championGrade:       RunGrade;
  };
}

// ── CO-OP AID CONTRACTS ───────────────────────────────────────────────────────

export interface AidContractRecord {
  id:              string;
  type:            'INCOME_SHARE' | 'DEBT_TRANSFER' | 'SHIELD_LEND' | 'EMERGENCY_CAPITAL';
  initiatorRole:   'local' | 'partner';
  terms: {
    amount:        number;
    durationTicks: number | null; // null = permanent for this run
    interestRate:  number;        // 0.0 = gift, >0 = loan
  };
  signedAtTick:    number;
  expiresAtTick:   number | null;
  status:          'ACTIVE' | 'COMPLETED' | 'DEFAULTED';
}

// ── GHOST DIVERGENCE ──────────────────────────────────────────────────────────

export interface DivergencePoint {
  tick:            number;
  label:           string;         // "Player chose SCALE, Ghost chose BUILD"
  localDeltaAfter: number;         // net worth delta after this divergence
  impactScore:     number;         // 0–100, how much this decision mattered
}

// ── SABOTAGE SYSTEM (asymmetric-pvp) ─────────────────────────────────────────

export type SabotageType =
  | 'FREEZE_INCOME'           // income → 0 for N ticks
  | 'PHANTOM_EXPENSE'         // fake recurring expense injected
  | 'CREDIT_LOCK'             // L2 shield disabled for N ticks
  | 'MARKET_RUMOR'            // income multiplied by 0.5 for N ticks
  | 'AUDIT_TRIGGER'           // large immediate expense
  | 'SHIELD_CORRODE'          // drains target shield layer slowly
  | 'OPPORTUNITY_SNIPE'       // destroys top income card in hand
  | 'DEBT_INJECTION';         // adds obligation record permanently

export interface SabotageCard {
  id:          string;
  type:        SabotageType;
  cooldownTicks: number;    // hater must wait this many ticks before using again
  label:       string;      // financial combat vocabulary label
  description: string;      // what this sabotage does in plain language
  magnitude:   number;      // base damage/effect strength
  durationTicks: number;    // how long the effect lasts (0 = instant)
}

/** The full sabotage deck available to the hater player. */
export const SABOTAGE_DECK: SabotageCard[] = [
  {
    id: 'SAB_01', type: 'FREEZE_INCOME', cooldownTicks: 36,
    label: 'Income Freeze', magnitude: 1.0, durationTicks: 6,
    description: 'All income streams stop. Builder earns zero for 6 ticks.',
  },
  {
    id: 'SAB_02', type: 'PHANTOM_EXPENSE', cooldownTicks: 24,
    label: 'Ghost Invoice', magnitude: 800, durationTicks: 12,
    description: 'A fake obligation drains $800/month for 12 ticks.',
  },
  {
    id: 'SAB_03', type: 'CREDIT_LOCK', cooldownTicks: 48,
    label: 'Credit Freeze', magnitude: 1.0, durationTicks: 8,
    description: 'L2 Credit Line shield disabled — cannot absorb attacks.',
  },
  {
    id: 'SAB_04', type: 'MARKET_RUMOR', cooldownTicks: 30,
    label: 'Market Rumor', magnitude: 0.5, durationTicks: 10,
    description: 'Income at half efficiency while the rumor spreads.',
  },
  {
    id: 'SAB_05', type: 'AUDIT_TRIGGER', cooldownTicks: 60,
    label: 'Regulatory Hit', magnitude: 4500, durationTicks: 0,
    description: 'Immediate $4,500 compliance expense. Cannot be shielded.',
  },
  {
    id: 'SAB_06', type: 'SHIELD_CORRODE', cooldownTicks: 18,
    label: 'Shield Erosion', magnitude: 8, durationTicks: 15,
    description: 'Drains 8 pts/tick from weakest shield layer for 15 ticks.',
  },
  {
    id: 'SAB_07', type: 'OPPORTUNITY_SNIPE', cooldownTicks: 42,
    label: 'Opportunity Kill', magnitude: 1.0, durationTicks: 0,
    description: 'Destroys top card in builder\'s hand. Gone permanently.',
  },
  {
    id: 'SAB_08', type: 'DEBT_INJECTION', cooldownTicks: 72,
    label: 'Debt Plant', magnitude: 1200, durationTicks: 0,
    description: 'Permanent $1,200/month obligation added to builder\'s ledger.',
  },
];

// ── BOT PROFILE REGISTRY ──────────────────────────────────────────────────────

export const BOT_PROFILES: Record<BotId, BotProfile> = {
  BOT_01_LIQUIDATOR: {
    id: 'BOT_01_LIQUIDATOR',
    name: 'The Liquidator',
    archetype: 'Forces asset sales at the worst possible time. Preys on overleveraged positions.',
    escalationHeat: 20, targetingHeat: 41, attackingHeat: 61,
    primaryAttack: 'ASSET_STRIP', secondaryAttack: 'DEBT_ATTACK',
    dialogue: {
      activate:    'The Liquidator has noticed your position.',
      targeting:   'Your leverage ratio is… unfortunate. Preparing forced sale.',
      attack:      'Margin call. Liquidate now or lose everything.',
      retreat:     'You survived. For now.',
      neutralized: 'Evidence filed. The Liquidator backs down.',
    },
  },
  BOT_02_BUREAUCRAT: {
    id: 'BOT_02_BUREAUCRAT',
    name: 'The Bureaucrat',
    archetype: 'Red tape, compliance costs, and regulatory pressure designed to stall your growth.',
    escalationHeat: 25, targetingHeat: 45, attackingHeat: 65,
    primaryAttack: 'REGULATORY_ATTACK', secondaryAttack: 'EXPENSE_INJECTION',
    dialogue: {
      activate:    'The Bureaucrat has found some paperwork issues.',
      targeting:   'Your compliance record is under review.',
      attack:      'Audit initiated. Full operational review required.',
      retreat:     'Filing noted. We will be in touch.',
      neutralized: 'Counter-evidence submitted. Audit closed.',
    },
  },
  BOT_03_MANIPULATOR: {
    id: 'BOT_03_MANIPULATOR',
    name: 'The Manipulator',
    archetype: 'Manufactures fear in the market. Spreads rumors that collapse your income streams.',
    escalationHeat: 15, targetingHeat: 35, attackingHeat: 55,
    primaryAttack: 'REPUTATION_ATTACK', secondaryAttack: 'FINANCIAL_SABOTAGE',
    dialogue: {
      activate:    'The Manipulator is watching your network.',
      targeting:   'Word is spreading about your instability.',
      attack:      'The narrative has shifted. Market confidence collapsing.',
      retreat:     'The story has served its purpose.',
      neutralized: 'Your reputation held. The Manipulator retreats.',
    },
  },
  BOT_04_CRASH_PROPHET: {
    id: 'BOT_04_CRASH_PROPHET',
    name: 'The Crash Prophet',
    archetype: 'Exploits fear cycles. Profits when you sell in panic. Manufactured collapses.',
    escalationHeat: 30, targetingHeat: 50, attackingHeat: 70,
    primaryAttack: 'HATER_INJECTION', secondaryAttack: 'OPPORTUNITY_KILL',
    dialogue: {
      activate:    'The Crash Prophet is seeding the market with fear.',
      targeting:   'Panic is spreading. Your assets look dangerous.',
      attack:      'Manufactured collapse. Everything is falling at once.',
      retreat:     'The panic cycle has run its course.',
      neutralized: 'You didn\'t flinch. The Prophet retreats.',
    },
  },
  BOT_05_LEGACY_HEIR: {
    id: 'BOT_05_LEGACY_HEIR',
    name: 'The Legacy Heir',
    archetype: 'Old money protecting its position. Monopolizes the opportunities your income needs.',
    escalationHeat: 35, targetingHeat: 55, attackingHeat: 75,
    primaryAttack: 'OPPORTUNITY_KILL', secondaryAttack: 'REPUTATION_ATTACK',
    dialogue: {
      activate:    'The Legacy Heir has noticed a new competitor.',
      targeting:   'Your best opportunities are being acquired.',
      attack:      'The market has been closed to your income class.',
      retreat:     'This isn\'t worth the Heir\'s time. Yet.',
      neutralized: 'You played at their level. The Heir steps back.',
    },
  },
};
