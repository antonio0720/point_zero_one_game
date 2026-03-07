/**
 * FILE: pzo-web/src/engines/cascade/CascadeChainRegistry.ts
 * All negative + positive cascade chain definitions.
 *
 * STATIC ONLY — pure frozen data.
 * May import: types.ts, ShieldLayerId, BotId, InjectionType.
 * Must NEVER import: any engine class, any runtime module.
 *
 * All 8 negative chains and 5 positive chains are defined here in full.
 * Every field in CascadeChainDefinition is populated for every chain.
 *
 * Density6 LLC · Point Zero One · Engine 6 of 7 · Confidential
 */
import {
  ChainId,
  CascadeChainDefinition,
  PositiveCascadeDefinition,
  CascadeSeverity,
  CascadeDirection,
  CascadeEffectType,
  RecoveryType,
  PositiveCascadeType,
} from './types';
import { ShieldLayerId } from '../shield/types';
import { BotId, InjectionType } from '../battle/types';

// =============================================================================
// NEGATIVE CHAIN DEFINITIONS
// =============================================================================

// ── CHAIN_01 — LOAN DEFAULT SPIRAL ────────────────────────────────────────────

const CHAIN_LOAN_DEFAULT: CascadeChainDefinition = Object.freeze({
  chainId:           ChainId.CHAIN_LOAN_DEFAULT,
  chainName:         'Loan Default Spiral',
  severity:          CascadeSeverity.SEVERE,
  direction:         CascadeDirection.NEGATIVE,
  triggerEventType:  'MISSED_LOAN_PAYMENT',
  maxActiveInstances: 2,
  playerMessage:     'A missed payment has started a debt spiral. Address it before your credit infrastructure collapses.',
  recoveryMessage:   'Debt addressed. Credit integrity preserved. Interest rate hike avoided.',
  links: Object.freeze([
    {
      linkIndex:        0,
      tickOffset:       1,
      effectType:       CascadeEffectType.CARD_INJECT,
      payload:          { cardType: 'LATE_FEE_NOTICE', injectionType: InjectionType.REGULATORY_HOLD, timerTicks: 2 },
      canBeIntercepted: false,
      isVisible:        true,
      linkDescription:  'Late fee notice injected. This consequence is immediate and unavoidable.',
    },
    {
      linkIndex:        1,
      tickOffset:       3,
      effectType:       CascadeEffectType.STAT_MODIFIER,
      payload:          { statKey: 'creditScore', value: -15, durationTicks: 8 },
      canBeIntercepted: true,
      isVisible:        true,
      linkDescription:  'Credit score drops 15 points for 8 ticks. CREDIT_LINE layer regen rate halved.',
    },
    {
      linkIndex:        2,
      tickOffset:       7,
      effectType:       CascadeEffectType.SHIELD_CRACK,
      payload:          { targetLayerId: ShieldLayerId.CREDIT_LINE, damageAmount: 20 },
      canBeIntercepted: true,
      isVisible:        true,
      linkDescription:  'L2 CREDIT_LINE takes 20pts direct damage. Lenders are adjusting your terms.',
    },
    {
      linkIndex:        3,
      tickOffset:       12,
      effectType:       CascadeEffectType.EXPENSE_MODIFIER,
      payload:          { factor: 1.12, durationTicks: 10 },
      canBeIntercepted: true,
      isVisible:        false,
      linkDescription:  'Interest rate hike. Expenses +12% for 10 ticks. This was avoidable.',
    },
  ]),
  recoveryConditions: Object.freeze([
    {
      type:            RecoveryType.CARD_PLAYED_TYPE,
      cardType:        'DEBT_PAYOFF',
      breaksLinksFrom: 2,
      description:     'DEBT_PAYOFF card played before Tick+7. Intercepts Links 2 and 3. Links 0 and 1 are unavoidable.',
    },
  ]),
});

// ── CHAIN_02 — LIQUIDITY BREACH SPIRAL ────────────────────────────────────────

const CHAIN_LIQUIDITY_BREACH: CascadeChainDefinition = Object.freeze({
  chainId:           ChainId.CHAIN_LIQUIDITY_BREACH,
  chainName:         'Liquidity Breach Spiral',
  severity:          CascadeSeverity.MODERATE,
  direction:         CascadeDirection.NEGATIVE,
  triggerEventType:  'SHIELD_LAYER_BREACHED',
  maxActiveInstances: 3,
  playerMessage:     'Your emergency reserves are gone. The machine punishes those without a safety net.',
  recoveryMessage:   'Liquidity restored before crisis deepened. Systemic pressure held off.',
  links: Object.freeze([
    {
      linkIndex:        0,
      tickOffset:       2,
      effectType:       CascadeEffectType.INCOME_MODIFIER,
      payload:          { factor: 0.80, durationTicks: 3 },
      canBeIntercepted: false,
      isVisible:        true,
      linkDescription:  'Income -20% for 3 ticks. No safety net means no negotiating power.',
    },
    {
      linkIndex:        1,
      tickOffset:       4,
      effectType:       CascadeEffectType.EXPENSE_MODIFIER,
      payload:          { factor: 1.20, durationTicks: 2 },
      canBeIntercepted: true,
      isVisible:        true,
      linkDescription:  'Expenses spike +20% for 2 ticks. Emergencies cost more without reserves.',
    },
    {
      linkIndex:        2,
      tickOffset:       8,
      effectType:       CascadeEffectType.HATER_HEAT_DELTA,
      payload:          { delta: 15 },
      canBeIntercepted: true,
      isVisible:        false,
      linkDescription:  'Hater heat +15. Adversarial systems have identified the weakness.',
    },
  ]),
  recoveryConditions: Object.freeze([
    {
      type:            RecoveryType.COMPOUND_AND,
      breaksLinksFrom: 1,
      description:     'Income card AND SHIELD_REPAIR_BOOST both used before Tick+4.',
      sub: [
        { type: RecoveryType.CARD_PLAYED_TYPE,   cardType: 'INCOME_BOOST',       description: 'Any income card played' },
        { type: RecoveryType.BUDGET_ACTION_USED, budgetActionType: 'SHIELD_REPAIR_BOOST', description: 'Shield repair budget action used' },
      ],
    },
  ]),
});

// ── CHAIN_03 — NETWORK COLLAPSE SEQUENCE ──────────────────────────────────────

const CHAIN_NETWORK_COLLAPSE: CascadeChainDefinition = Object.freeze({
  chainId:           ChainId.CHAIN_NETWORK_COLLAPSE,
  chainName:         'Network Collapse Sequence',
  severity:          CascadeSeverity.SEVERE,
  direction:         CascadeDirection.NEGATIVE,
  triggerEventType:  'SHIELD_LAYER_BREACHED',
  maxActiveInstances: 1,
  playerMessage:     'Your network has been broken. Relationships are the hardest thing to rebuild. The machine knows this.',
  recoveryMessage:   'Alliance secured. Network rebuilt. Further collapse prevented.',
  links: Object.freeze([
    {
      linkIndex:        0,
      tickOffset:       3,
      effectType:       CascadeEffectType.CARD_LOCK,
      payload:          { cardType: 'MOST_USED_INCOME_TYPE', lockType: 'SUPPRESSION', durationTicks: 3 },
      canBeIntercepted: false,
      isVisible:        true,
      linkDescription:  'Most-played income type suppressed for 3 ticks. Your primary revenue stream is frozen.',
    },
    {
      linkIndex:        1,
      tickOffset:       6,
      effectType:       CascadeEffectType.MOMENTUM_LOCK,
      payload:          { targetChainId: ChainId.PCHAIN_FORTIFIED_SHIELDS, durationTicks: 4 },
      canBeIntercepted: true,
      isVisible:        true,
      linkDescription:  'Fortified Shields positive cascade suspended for 4 ticks. Opportunity window locked.',
    },
    {
      linkIndex:        2,
      tickOffset:       10,
      effectType:       CascadeEffectType.SHIELD_CRACK,
      payload:          { targetLayerId: ShieldLayerId.NETWORK_CORE, damageAmount: 25 },
      canBeIntercepted: true,
      isVisible:        true,
      linkDescription:  'L4 NETWORK_CORE takes 25pts compounding damage. Network degradation accelerates.',
    },
  ]),
  recoveryConditions: Object.freeze([
    {
      type:            RecoveryType.CARD_PLAYED_TYPE,
      cardType:        'ALLIANCE',
      breaksLinksFrom: 1,
      description:     'ALLIANCE card played within 3 ticks of trigger. Breaks Links 1 and 2. Link 0 is unavoidable.',
    },
  ]),
});

// ── CHAIN_04 — SUCCESSFUL EXTRACTION COMPOUND ─────────────────────────────────

const CHAIN_HATER_SABOTAGE: CascadeChainDefinition = Object.freeze({
  chainId:           ChainId.CHAIN_HATER_SABOTAGE,
  chainName:         'Successful Extraction Compound',
  severity:          CascadeSeverity.MODERATE,
  direction:         CascadeDirection.NEGATIVE,
  triggerEventType:  'BOT_ATTACK_FIRED',
  maxActiveInstances: 3,
  playerMessage:     'The extraction landed. Now the machine compounds the advantage it just gained.',
  recoveryMessage:   'Counter-pressure applied. Compounding extraction interrupted.',
  links: Object.freeze([
    {
      linkIndex:        0,
      tickOffset:       1,
      effectType:       CascadeEffectType.STAT_MODIFIER,
      payload:          { statKey: 'topAssetIncomeContribution', value: -0.30, durationTicks: 4 },
      canBeIntercepted: false,
      isVisible:        true,
      linkDescription:  'Highest-value asset devalued — income contribution reduced 30% for 4 ticks.',
    },
    {
      linkIndex:        1,
      tickOffset:       3,
      effectType:       CascadeEffectType.HATER_HEAT_DELTA,
      payload:          { delta: 20 },
      canBeIntercepted: true,
      isVisible:        true,
      linkDescription:  'Hater heat +20. Machine compounds its positional advantage.',
    },
    {
      linkIndex:        2,
      tickOffset:       5,
      effectType:       CascadeEffectType.BOT_ACTIVATE,
      payload:          { botId: BotId.BOT_02_BUREAUCRAT },
      canBeIntercepted: true,
      isVisible:        false,
      linkDescription:  'Second adversarial system activated. Reinforcement sent after successful extraction.',
    },
  ]),
  recoveryConditions: Object.freeze([
    {
      type:            RecoveryType.BUDGET_ACTION_USED,
      budgetActionType:'COUNTER_SABOTAGE',
      breaksLinksFrom: 1,
      description:     'COUNTER_SABOTAGE budget action used within 2 ticks of trigger. Breaks Links 1 and 2.',
    },
  ]),
});

// ── CHAIN_05 — NET WORTH COLLAPSE SPIRAL ──────────────────────────────────────

const CHAIN_NET_WORTH_CRASH: CascadeChainDefinition = Object.freeze({
  chainId:           ChainId.CHAIN_NET_WORTH_CRASH,
  chainName:         'Net Worth Collapse Spiral',
  severity:          CascadeSeverity.SEVERE,
  direction:         CascadeDirection.NEGATIVE,
  triggerEventType:  'NET_WORTH_DELTA',
  maxActiveInstances: 2,
  playerMessage:     'More than 30% of your net worth was lost in one tick. The machine can take everything. This is a warning.',
  recoveryMessage:   'Recovery position established. Collective financial anchor held.',
  links: Object.freeze([
    {
      linkIndex:        0,
      tickOffset:       2,
      effectType:       CascadeEffectType.CARD_INJECT,
      payload:          { cardType: 'MORALE_COLLAPSE', injectionType: InjectionType.FORCED_SALE, timerTicks: 3 },
      canBeIntercepted: false,
      isVisible:        true,
      linkDescription:  'MORALE_COLLAPSE injected. If unmitigated before expiry: income -40% for 3 ticks fires automatically.',
    },
    {
      linkIndex:        1,
      tickOffset:       5,
      effectType:       CascadeEffectType.STAT_MODIFIER,
      payload:          { statKey: 'pressurePhantomInput', value: 0.25, durationTicks: 3 },
      canBeIntercepted: true,
      isVisible:        true,
      linkDescription:  'PressureEngine receives phantom +0.25 signal for 3 ticks. Pressure score inflated artificially.',
    },
    {
      linkIndex:        2,
      tickOffset:       8,
      effectType:       CascadeEffectType.SHIELD_CRACK,
      payload:          { targetLayerId: ShieldLayerId.LIQUIDITY_BUFFER, damageAmount: 15 },
      canBeIntercepted: true,
      isVisible:        false,
      linkDescription:  'L1 LIQUIDITY_BUFFER -15pts AND L2 CREDIT_LINE -10pts. Dual-layer passive erosion.',
    },
  ]),
  recoveryConditions: Object.freeze([
    {
      type:            RecoveryType.COMPOUND_AND,
      breaksLinksFrom: 1,
      description:     'Recovery card played AND active syndicate ally — both before Tick+5.',
      sub: [
        {
          type: RecoveryType.COMPOUND_OR,
          description: 'INCOME_BOOST, PORTFOLIO_BUILD, or INVESTMENT card played',
          sub: [
            { type: RecoveryType.CARD_PLAYED_TYPE, cardType: 'INCOME_BOOST',     description: 'INCOME_BOOST played' },
            { type: RecoveryType.CARD_PLAYED_TYPE, cardType: 'PORTFOLIO_BUILD',  description: 'PORTFOLIO_BUILD played' },
            { type: RecoveryType.CARD_PLAYED_TYPE, cardType: 'INVESTMENT',       description: 'INVESTMENT played' },
          ],
        },
        { type: RecoveryType.ALLIANCE_ACTIVE, description: 'Active syndicate ally with positive cashflow' },
      ],
    },
  ]),
});

// ── CHAIN_06 — TOTAL SYSTEMIC CASCADE (CATASTROPHIC) ──────────────────────────

const CHAIN_FULL_CASCADE_BREACH: CascadeChainDefinition = Object.freeze({
  chainId:           ChainId.CHAIN_FULL_CASCADE_BREACH,
  chainName:         'Total Systemic Cascade',
  severity:          CascadeSeverity.CATASTROPHIC,
  direction:         CascadeDirection.NEGATIVE,
  triggerEventType:  'CASCADE_TRIGGERED',
  maxActiveInstances: 1,
  playerMessage:     'The network core has collapsed. Every systemic force is now active simultaneously. This is total suppression.',
  recoveryMessage:   'Recovery achieved. Further escalation intercepted.',
  links: Object.freeze([
    {
      linkIndex:        0,
      tickOffset:       0,
      effectType:       CascadeEffectType.EXPENSE_MODIFIER,
      payload:          { factor: 1.40, durationTicks: 5 },
      canBeIntercepted: false,
      isVisible:        true,
      linkDescription:  'Global expenses +40% for 5 ticks. Fires instantly alongside ShieldEngine cascade. Unavoidable.',
    },
    {
      linkIndex:        1,
      tickOffset:       2,
      effectType:       CascadeEffectType.HATER_HEAT_DELTA,
      payload:          { delta: 25 },
      canBeIntercepted: false,
      isVisible:        true,
      linkDescription:  'Hater heat +25 (stacked on ShieldEngine +20). Total surge: +45. Unavoidable.',
    },
    {
      linkIndex:        2,
      tickOffset:       4,
      effectType:       CascadeEffectType.CARD_LOCK,
      payload:          { cardType: 'ALL_INCOME', lockType: 'SUPPRESSION', durationTicks: 2 },
      canBeIntercepted: true,
      isVisible:        true,
      linkDescription:  'ALL income card types suppressed 2 ticks. Income frozen. Broken by ALLIANCE before Tick+4.',
    },
    {
      linkIndex:        3,
      tickOffset:       6,
      effectType:       CascadeEffectType.INCOME_MODIFIER,
      payload:          { factor: 0.50, durationTicks: 4 },
      canBeIntercepted: true,
      isVisible:        false,
      linkDescription:  'Income halved for 4 ticks. Market confidence in player position gone.',
    },
    {
      linkIndex:        4,
      tickOffset:       9,
      effectType:       CascadeEffectType.BOT_ACTIVATE,
      payload:          { botId: BotId.BOT_04_CRASH_PROPHET },
      canBeIntercepted: false,
      isVisible:        false,
      linkDescription:  'THE CRASH PROPHET activates. Systemic shock enables the macro adversary. Unavoidable.',
    },
    {
      linkIndex:        5,
      tickOffset:       14,
      effectType:       CascadeEffectType.STAT_MODIFIER,
      payload:          { statKey: 'freedomThreshold', value: 1.15, durationTicks: 6 },
      canBeIntercepted: true,
      isVisible:        false,
      linkDescription:  'Freedom threshold raised 15% for 6 ticks. The goal moves when the player is down.',
    },
  ]),
  recoveryConditions: Object.freeze([
    {
      type:            RecoveryType.CARD_PLAYED_TYPE,
      cardType:        'ALLIANCE',
      breaksLinksFrom: 2,
      description:     'ALLIANCE card played before Tick+4. Breaks Links 2 and 3 only.',
    },
    {
      type:            RecoveryType.CASHFLOW_POSITIVE_N,
      consecutiveTicks:3,
      breaksLinksFrom: 4,
      description:     'Positive cashflow 3 consecutive ticks after Link 3 fires. Breaks Links 4 and 5.',
    },
  ]),
});

// ── CHAIN_07 — PATTERN EXPLOITATION ───────────────────────────────────────────

const CHAIN_PATTERN_EXPLOITATION: CascadeChainDefinition = Object.freeze({
  chainId:           ChainId.CHAIN_PATTERN_EXPLOITATION,
  chainName:         'Pattern Exploitation Sequence',
  severity:          CascadeSeverity.MILD,
  direction:         CascadeDirection.NEGATIVE,
  triggerEventType:  'BOT_STATE_CHANGED',
  maxActiveInstances: 3,
  playerMessage:     'Your pattern was studied and used against you. Predictability is a vulnerability in every financial market.',
  recoveryMessage:   'Pattern broken. Exploitation disrupted. Entropy recovery rate restored.',
  links: Object.freeze([
    {
      linkIndex:        0,
      tickOffset:       1,
      effectType:       CascadeEffectType.CARD_INJECT,
      payload:          { cardType: 'MARKET_INVERSION_SIGNAL', injectionType: InjectionType.INVERSION_CURSE, timerTicks: 2 },
      canBeIntercepted: false,
      isVisible:        true,
      linkDescription:  'MARKET_INVERSION_SIGNAL injected. Already landed — cannot be avoided.',
    },
    {
      linkIndex:        1,
      tickOffset:       3,
      effectType:       CascadeEffectType.STAT_MODIFIER,
      payload:          { statKey: 'cardPatternEntropyRecoveryRate', value: -0.50, durationTicks: 4 },
      canBeIntercepted: true,
      isVisible:        true,
      linkDescription:  'Entropy recovery halved for 4 ticks. Harder to break the exploited pattern.',
    },
  ]),
  recoveryConditions: Object.freeze([
    {
      type:            RecoveryType.COMPOUND_OR,
      breaksLinksFrom: 1,
      description:     'PATTERN_BREAK or COUNTER_NARRATIVE used within 2 ticks.',
      sub: [
        { type: RecoveryType.BUDGET_ACTION_USED, budgetActionType: 'PATTERN_BREAK',     description: 'PATTERN_BREAK action used' },
        { type: RecoveryType.BUDGET_ACTION_USED, budgetActionType: 'COUNTER_NARRATIVE', description: 'COUNTER_NARRATIVE action used' },
      ],
    },
  ]),
});

// ── CHAIN_08 — REGULATORY ESCALATION ──────────────────────────────────────────

const CHAIN_REGULATORY_ESCALATION: CascadeChainDefinition = Object.freeze({
  chainId:           ChainId.CHAIN_REGULATORY_ESCALATION,
  chainName:         'Regulatory Escalation Sequence',
  severity:          CascadeSeverity.MODERATE,
  direction:         CascadeDirection.NEGATIVE,
  triggerEventType:  'INJECTED_CARD_EXPIRED',
  maxActiveInstances: 2,
  playerMessage:     'The compliance hold was ignored. The bureaucratic system interprets silence as admission.',
  recoveryMessage:   'Compliance addressed. Regulatory escalation halted.',
  links: Object.freeze([
    {
      linkIndex:        0,
      tickOffset:       2,
      effectType:       CascadeEffectType.CARD_LOCK,
      payload:          { cardType: 'PREVIOUSLY_HELD_INCOME_TYPE', lockType: 'SUPPRESSION', durationTicks: 4 },
      canBeIntercepted: false,
      isVisible:        true,
      linkDescription:  'Escalation of original hold — 4 ticks instead of 2. Previously-held income type suppressed.',
    },
    {
      linkIndex:        1,
      tickOffset:       5,
      effectType:       CascadeEffectType.HATER_HEAT_DELTA,
      payload:          { delta: 10 },
      canBeIntercepted: true,
      isVisible:        true,
      linkDescription:  'Hater heat +10. Compliance failure now visible to all adversarial systems.',
    },
    {
      linkIndex:        2,
      tickOffset:       9,
      effectType:       CascadeEffectType.SHIELD_CRACK,
      payload:          { targetLayerId: ShieldLayerId.NETWORK_CORE, damageAmount: 15 },
      canBeIntercepted: true,
      isVisible:        false,
      linkDescription:  'L4 NETWORK_CORE -15pts. Reputation damage from unaddressed regulatory failure.',
    },
  ]),
  recoveryConditions: Object.freeze([
    {
      type:            RecoveryType.COMPOUND_OR,
      breaksLinksFrom: 1,
      description:     'LEGAL_FILING card OR COMPLIANCE_SHIELD action — either before Tick+5.',
      sub: [
        { type: RecoveryType.CARD_PLAYED_TYPE,   cardType: 'LEGAL_FILING',       description: 'LEGAL_FILING card played' },
        { type: RecoveryType.BUDGET_ACTION_USED, budgetActionType: 'COMPLIANCE_SHIELD', description: 'COMPLIANCE_SHIELD action used' },
      ],
    },
  ]),
});

// =============================================================================
// POSITIVE CHAIN DEFINITIONS
// =============================================================================

const POSITIVE_CHAINS: PositiveCascadeDefinition[] = Object.freeze([
  Object.freeze({
    chainId:   ChainId.PCHAIN_SUSTAINED_CASHFLOW,
    chainName: 'Cashflow Momentum State',
    type:      PositiveCascadeType.SUSTAINED_STATE,
    activationConditionDescription:
      'Positive cashflow (income > expenses) for 10+ consecutive ticks.',
    unlockMessage:
      'MOMENTUM STATE ACTIVE — 10 ticks of positive cashflow. The machine is compounding in your favor now.',
    dissolutionMessage:
      'Cashflow broken. Momentum lost. Sustain positive flow to rebuild the streak.',
  }),
  Object.freeze({
    chainId:   ChainId.PCHAIN_FORTIFIED_SHIELDS,
    chainName: 'Fortified Position — Opportunity Window',
    type:      PositiveCascadeType.SUSTAINED_STATE,
    activationConditionDescription:
      'All four shield layers at ≥80% integrity for 5 consecutive ticks.',
    unlockMessage:
      'FORTIFIED — All shields holding above 80%. Opportunity window is open.',
    dissolutionMessage:
      'Shield position weakened. Opportunity window paused. Restore all layers to 80%+ to reopen.',
  }),
  Object.freeze({
    chainId:   ChainId.PCHAIN_NEMESIS_BROKEN,
    chainName: 'Nemesis Broken Event',
    type:      PositiveCascadeType.ONE_TIME_EVENT,
    activationConditionDescription:
      'The same bot neutralized via COUNTER_EVIDENCE_FILE exactly twice in this run.',
    unlockMessage:
      'NEMESIS BROKEN — The adversary has been dismantled twice. That bot will not return easily.',
    dissolutionMessage: '',
  }),
  Object.freeze({
    chainId:   ChainId.PCHAIN_SOVEREIGN_APPROACH,
    chainName: 'Sovereignty Threshold Approach',
    type:      PositiveCascadeType.ONE_TIME_EVENT,
    activationConditionDescription:
      'Net worth crosses 2× personal freedom threshold.',
    unlockMessage:
      'SOVEREIGN APPROACH — The threshold is within reach. The system can feel it. New instruments are now available.',
    dissolutionMessage:
      'Position weakened. Sovereign mode paused. Recover above 2× threshold to resume.',
  }),
  Object.freeze({
    chainId:   ChainId.PCHAIN_STREAK_MASTERY,
    chainName: 'Strategic Mastery Streak',
    type:      PositiveCascadeType.SUSTAINED_STATE,
    activationConditionDescription:
      '5 consecutive clean ticks: positive cashflow + at least one bot retreating/neutralized + zero active negative chains.',
    unlockMessage:
      'MASTERY STREAK — 5 clean ticks. Advanced card combinations are now available. You are outperforming the system.',
    dissolutionMessage:
      'Streak broken. Clean-tick conditions not met.',
  }),
]) as PositiveCascadeDefinition[];

// =============================================================================
// REGISTRY
// =============================================================================

const ALL_NEGATIVE_CHAINS: CascadeChainDefinition[] = [
  CHAIN_LOAN_DEFAULT,
  CHAIN_LIQUIDITY_BREACH,
  CHAIN_NETWORK_COLLAPSE,
  CHAIN_HATER_SABOTAGE,
  CHAIN_NET_WORTH_CRASH,
  CHAIN_FULL_CASCADE_BREACH,
  CHAIN_PATTERN_EXPLOITATION,
  CHAIN_REGULATORY_ESCALATION,
];

export const CascadeChainRegistry = {
  getNegativeChain(id: ChainId): CascadeChainDefinition {
    const c = ALL_NEGATIVE_CHAINS.find(c => c.chainId === id);
    if (!c) throw new Error(`[CascadeChainRegistry] No chain registered for ChainId: ${id}`);
    return c;
  },

  getPositiveChain(id: ChainId): PositiveCascadeDefinition {
    const c = POSITIVE_CHAINS.find(c => c.chainId === id);
    if (!c) throw new Error(`[CascadeChainRegistry] No positive chain registered for ChainId: ${id}`);
    return c;
  },

  getAllNegativeChains(): CascadeChainDefinition[] {
    return [...ALL_NEGATIVE_CHAINS];
  },

  getAllPositiveChains(): PositiveCascadeDefinition[] {
    return [...POSITIVE_CHAINS];
  },

  /** Returns all negative chain definitions that match the given trigger event type. */
  getChainsByTriggerEvent(eventType: string): CascadeChainDefinition[] {
    return ALL_NEGATIVE_CHAINS.filter(c => c.triggerEventType === eventType);
  },

  hasNegativeChain(id: ChainId): boolean {
    return ALL_NEGATIVE_CHAINS.some(c => c.chainId === id);
  },
} as const;