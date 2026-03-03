//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/cards/CardRegistry.ts

// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — CARD REGISTRY
// pzo-web/src/engines/cards/CardRegistry.ts
//
// Master read-only catalog of every card definition in the game.
// Pure data — zero logic. Seeded lookup map by cardId.
// DeckBuilder reads this. ModeOverlayEngine reads this. Nothing writes to this.
//
// RULES:
//   ✦ All entries are CardDefinition — immutable, frozen at module load.
//   ✦ No runtime logic — no conditionals, no calculations, no class instances.
//   ✦ cardId must be globally unique across all deck types.
//   ✦ drop_weight 0–100; LEGENDARY cards always use LEGENDARY_DROP_WEIGHT (1).
//   ✦ modes_legal must reference CARD_LEGALITY_MATRIX for consistency.
//
// Density6 LLC · Point Zero One · Cards Engine · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import {
  BaseDeckType,
  ModeDeckType,
  type DeckType,
  CardRarity,
  TimingClass,
  CardEffectType,
  CardTag,
  Targeting,
  GameMode,
  DefectionStep,
  LegendMarkerType,
  type CardDefinition,
  LEGENDARY_DROP_WEIGHT,
} from './types';

// ── REGISTRY BUILDER HELPER ────────────────────────────────────────────────────

const ALL_MODES: GameMode[] = [
  GameMode.GO_ALONE,
  GameMode.HEAD_TO_HEAD,
  GameMode.TEAM_UP,
  GameMode.CHASE_A_LEGEND,
];

// ── OPPORTUNITY CARDS ──────────────────────────────────────────────────────────

const OPPORTUNITY_CARDS: CardDefinition[] = [
  {
    cardId:        'opp_rental_001',
    name:          'Rental Property',
    deckType:      BaseDeckType.OPPORTUNITY,
    rarity:        CardRarity.COMMON,
    timingClass:   TimingClass.STANDARD,
    base_cost:     8_000,
    base_effect:   { effectType: CardEffectType.INCOME_BOOST, magnitude: 1_200, duration: 0 },
    tags:          [CardTag.INCOME, CardTag.COMPOUNDING, CardTag.REAL_WORLD_FINANCE],
    targeting:     Targeting.SELF,
    educational_tag: 'passive_income_real_estate',
    lore:          'Every brick is a vote against trading your time for money.',
    modes_legal:   ALL_MODES,
    is_forced:     false,
    drop_weight:   18,
  },
  {
    cardId:        'opp_business_acq_002',
    name:          'Business Acquisition',
    deckType:      BaseDeckType.OPPORTUNITY,
    rarity:        CardRarity.UNCOMMON,
    timingClass:   TimingClass.STANDARD,
    base_cost:     25_000,
    base_effect:   { effectType: CardEffectType.INCOME_BOOST, magnitude: 4_500, duration: 0 },
    tags:          [CardTag.INCOME, CardTag.LEVERAGE, CardTag.CAPITAL_ALLOC, CardTag.REAL_WORLD_FINANCE],
    targeting:     Targeting.SELF,
    educational_tag: 'business_acquisition_leverage',
    lore:          'You didn\'t buy a business. You bought a machine that prints money.',
    modes_legal:   ALL_MODES,
    is_forced:     false,
    drop_weight:   10,
  },
  {
    cardId:        'opp_digital_asset_003',
    name:          'Digital Asset Position',
    deckType:      BaseDeckType.OPPORTUNITY,
    rarity:        CardRarity.UNCOMMON,
    timingClass:   TimingClass.IMMEDIATE,
    base_cost:     5_000,
    base_effect:   { effectType: CardEffectType.INCOME_BOOST, magnitude: 800, duration: 3 },
    tags:          [CardTag.TEMPO, CardTag.INCOME, CardTag.REAL_WORLD_FINANCE],
    targeting:     Targeting.SELF,
    educational_tag: 'digital_asset_diversification',
    lore:          'Asymmetric bets belong in asymmetric positions.',
    modes_legal:   ALL_MODES,
    is_forced:     false,
    drop_weight:   12,
  },
  {
    cardId:        'opp_equity_position_004',
    name:          'Equity Position',
    deckType:      BaseDeckType.OPPORTUNITY,
    rarity:        CardRarity.RARE,
    timingClass:   TimingClass.STANDARD,
    base_cost:     15_000,
    base_effect:   {
      effectType: CardEffectType.INCOME_BOOST, magnitude: 2_200, duration: 0,
      secondary:  { effectType: CardEffectType.CORD_BONUS_FLAT, magnitude: 0.03, duration: 0 },
    },
    tags:          [CardTag.COMPOUNDING, CardTag.CAPITAL_ALLOC, CardTag.REAL_WORLD_FINANCE],
    targeting:     Targeting.SELF,
    educational_tag: 'equity_ownership_compound_growth',
    lore:          'Ownership compounds. Wages don\'t.',
    modes_legal:   ALL_MODES,
    is_forced:     false,
    drop_weight:   8,
  },
  {
    cardId:        'opp_missed_window_005',
    name:          'Missed Window',
    deckType:      BaseDeckType.OPPORTUNITY,
    rarity:        CardRarity.COMMON,
    timingClass:   TimingClass.REACTIVE,
    base_cost:     0,
    base_effect:   { effectType: CardEffectType.CORD_BONUS_FLAT, magnitude: -0.02, duration: 0 },
    tags:          [CardTag.TEMPO],
    targeting:     Targeting.SELF,
    educational_tag: 'opportunity_cost',
    lore:          'The cost you never see is the one that compounds forever.',
    modes_legal:   ALL_MODES,
    is_forced:     true,   // Injected by fate deck on missed opportunity streak
    drop_weight:   0,      // Never drawn — always engine-injected
  },
];

// ── IPA CARDS (Income-Producing Assets) ───────────────────────────────────────

const IPA_CARDS: CardDefinition[] = [
  {
    cardId:        'ipa_digital_product_001',
    name:          'Digital Product',
    deckType:      BaseDeckType.IPA,
    rarity:        CardRarity.COMMON,
    timingClass:   TimingClass.STANDARD,
    base_cost:     2_500,
    base_effect:   { effectType: CardEffectType.INCOME_BOOST, magnitude: 400, duration: 0 },
    tags:          [CardTag.INCOME, CardTag.AUTOMATION, CardTag.COMPOUNDING, CardTag.REAL_WORLD_FINANCE],
    targeting:     Targeting.SELF,
    educational_tag: 'digital_product_passive_income',
    lore:          'Build it once. Sell it a thousand times while you sleep.',
    modes_legal:   ALL_MODES,
    is_forced:     false,
    drop_weight:   20,
  },
  {
    cardId:        'ipa_royalty_stream_002',
    name:          'Royalty Stream',
    deckType:      BaseDeckType.IPA,
    rarity:        CardRarity.UNCOMMON,
    timingClass:   TimingClass.STANDARD,
    base_cost:     6_000,
    base_effect:   { effectType: CardEffectType.INCOME_BOOST, magnitude: 900, duration: 0 },
    tags:          [CardTag.INCOME, CardTag.COMPOUNDING, CardTag.REAL_WORLD_FINANCE],
    targeting:     Targeting.SELF,
    educational_tag: 'intellectual_property_royalties',
    lore:          'Intellectual property works overtime so you don\'t have to.',
    modes_legal:   ALL_MODES,
    is_forced:     false,
    drop_weight:   14,
  },
  {
    cardId:        'ipa_dividend_portfolio_003',
    name:          'Dividend Portfolio',
    deckType:      BaseDeckType.IPA,
    rarity:        CardRarity.RARE,
    timingClass:   TimingClass.STANDARD,
    base_cost:     12_000,
    base_effect:   { effectType: CardEffectType.INCOME_BOOST, magnitude: 1_800, duration: 0 },
    tags:          [CardTag.INCOME, CardTag.COMPOUNDING, CardTag.LIQUIDITY, CardTag.REAL_WORLD_FINANCE],
    targeting:     Targeting.SELF,
    educational_tag: 'dividend_investing_cashflow',
    lore:          'The market opens every day. Your dividends do not care.',
    modes_legal:   ALL_MODES,
    is_forced:     false,
    drop_weight:   9,
  },
  {
    cardId:        'ipa_saas_revenue_004',
    name:          'SaaS Revenue',
    deckType:      BaseDeckType.IPA,
    rarity:        CardRarity.EPIC,
    timingClass:   TimingClass.STANDARD,
    base_cost:     20_000,
    base_effect:   {
      effectType: CardEffectType.INCOME_BOOST, magnitude: 3_500, duration: 0,
      secondary:  { effectType: CardEffectType.HATER_HEAT_REDUCE, magnitude: 5, duration: 0 },
    },
    tags:          [CardTag.INCOME, CardTag.AUTOMATION, CardTag.COMPOUNDING, CardTag.REAL_WORLD_FINANCE],
    targeting:     Targeting.SELF,
    educational_tag: 'saas_recurring_revenue_model',
    lore:          'Predictable revenue is the only kind worth building on.',
    modes_legal:   ALL_MODES,
    is_forced:     false,
    drop_weight:   5,
  },
];

// ── FUBAR CARDS (Market Reality) ──────────────────────────────────────────────

const FUBAR_CARDS: CardDefinition[] = [
  {
    cardId:        'fubar_market_crash_001',
    name:          'Market Crash',
    deckType:      BaseDeckType.FUBAR,
    rarity:        CardRarity.RARE,
    timingClass:   TimingClass.FORCED,
    base_cost:     0,
    base_effect:   {
      effectType: CardEffectType.INCOME_REDUCTION, magnitude: 0.3, duration: 2,
      secondary:  { effectType: CardEffectType.HATER_HEAT_SPIKE, magnitude: 15, duration: 0 },
    },
    tags:          [CardTag.REAL_WORLD_FINANCE],
    targeting:     Targeting.SELF,
    educational_tag: 'market_volatility_resilience',
    lore:          'The market always recovers. The question is whether you survive long enough.',
    modes_legal:   ALL_MODES,
    is_forced:     true,
    drop_weight:   0,  // engine-injected only
  },
  {
    cardId:        'fubar_expense_spike_002',
    name:          'Unexpected Expense',
    deckType:      BaseDeckType.FUBAR,
    rarity:        CardRarity.COMMON,
    timingClass:   TimingClass.FORCED,
    base_cost:     0,
    base_effect:   { effectType: CardEffectType.EXPENSE_SPIKE, magnitude: 3_000, duration: 1 },
    tags:          [CardTag.REAL_WORLD_FINANCE],
    targeting:     Targeting.SELF,
    educational_tag: 'emergency_fund_importance',
    lore:          'Murphy\'s Law has a billing department.',
    modes_legal:   ALL_MODES,
    is_forced:     true,
    drop_weight:   0,
  },
  {
    cardId:        'fubar_regulatory_hit_003',
    name:          'Regulatory Audit',
    deckType:      BaseDeckType.FUBAR,
    rarity:        CardRarity.UNCOMMON,
    timingClass:   TimingClass.FORCED,
    base_cost:     0,
    base_effect:   {
      effectType: CardEffectType.EXPENSE_SPIKE, magnitude: 5_000, duration: 0,
      secondary:  { effectType: CardEffectType.HATER_HEAT_SPIKE, magnitude: 10, duration: 0 },
    },
    tags:          [CardTag.REAL_WORLD_FINANCE],
    targeting:     Targeting.SELF,
    educational_tag: 'regulatory_compliance_risk',
    lore:          'The government always wants its cut. Schedule it.',
    modes_legal:   ALL_MODES,
    is_forced:     true,
    drop_weight:   0,
  },
];

// ── PRIVILEGED CARDS ──────────────────────────────────────────────────────────

const PRIVILEGED_CARDS: CardDefinition[] = [
  {
    cardId:        'priv_network_call_001',
    name:          'Network Call',
    deckType:      BaseDeckType.PRIVILEGED,
    rarity:        CardRarity.RARE,
    timingClass:   TimingClass.IMMEDIATE,
    base_cost:     0,
    base_effect:   {
      effectType: CardEffectType.HATER_HEAT_REDUCE, magnitude: 20, duration: 0,
      secondary:  { effectType: CardEffectType.BOT_NEUTRALIZE, magnitude: 3, duration: 0 },
    },
    tags:          [CardTag.PRIVILEGED_TAG, CardTag.RESILIENCE, CardTag.REAL_WORLD_FINANCE],
    targeting:     Targeting.SELF,
    educational_tag: 'network_value_social_capital',
    lore:          'One call from the right person changes the entire game.',
    modes_legal:   ALL_MODES,
    is_forced:     false,
    drop_weight:   7,
  },
  {
    cardId:        'priv_insider_advantage_002',
    name:          'Insider Advantage',
    deckType:      BaseDeckType.PRIVILEGED,
    rarity:        CardRarity.EPIC,
    timingClass:   TimingClass.STANDARD,
    base_cost:     10_000,
    base_effect:   {
      effectType: CardEffectType.INCOME_BOOST, magnitude: 5_000, duration: 0,
      secondary:  { effectType: CardEffectType.HATER_HEAT_SPIKE, magnitude: 25, duration: 0 },
    },
    tags:          [CardTag.PRIVILEGED_TAG, CardTag.LEVERAGE, CardTag.CAPITAL_ALLOC],
    targeting:     Targeting.SELF,
    educational_tag: 'information_asymmetry',
    lore:          'Information is the only currency that compounds without inflation.',
    modes_legal:   ALL_MODES,
    is_forced:     false,
    drop_weight:   4,
  },
];

// ── SO CARDS (Systemic Obstacle Conversion) ───────────────────────────────────

const SO_CARDS: CardDefinition[] = [
  {
    cardId:        'so_convert_cash_001',
    name:          'Convert: Pay Through',
    deckType:      BaseDeckType.SO,
    rarity:        CardRarity.COMMON,
    timingClass:   TimingClass.REACTIVE,
    base_cost:     4_000,
    base_effect:   { effectType: CardEffectType.SHIELD_REPAIR, magnitude: 15, duration: 0 },
    tags:          [CardTag.LIQUIDITY, CardTag.RESILIENCE],
    targeting:     Targeting.ENGINE,
    educational_tag: 'obstacle_conversion_cash',
    lore:          'Cash solves most problems. The rest require creativity.',
    modes_legal:   ALL_MODES,
    is_forced:     false,
    drop_weight:   15,
  },
  {
    cardId:        'so_convert_time_002',
    name:          'Convert: Time Freeze',
    deckType:      BaseDeckType.SO,
    rarity:        CardRarity.UNCOMMON,
    timingClass:   TimingClass.REACTIVE,
    base_cost:     0,
    base_effect:   {
      effectType: CardEffectType.EXPENSE_REDUCTION, magnitude: 0.2, duration: 2,
      secondary:  { effectType: CardEffectType.CORD_BONUS_FLAT, magnitude: 0.01, duration: 0 },
    },
    tags:          [CardTag.TEMPO, CardTag.RESILIENCE],
    targeting:     Targeting.SELF,
    educational_tag: 'time_as_capital',
    lore:          'Time is the only resource that cannot be replenished. Spend it deliberately.',
    modes_legal:   ALL_MODES,
    is_forced:     false,
    drop_weight:   12,
  },
  {
    cardId:        'so_absorb_cord_003',
    name:          'Convert: Absorb & Learn',
    deckType:      BaseDeckType.SO,
    rarity:        CardRarity.COMMON,
    timingClass:   TimingClass.REACTIVE,
    base_cost:     0,
    base_effect:   { effectType: CardEffectType.CORD_BONUS_FLAT, magnitude: 0.02, duration: 0 },
    tags:          [CardTag.RESILIENCE, CardTag.REAL_WORLD_FINANCE],
    targeting:     Targeting.SELF,
    educational_tag: 'adversity_as_education',
    lore:          'Every hit you survive teaches you something the textbook never could.',
    modes_legal:   ALL_MODES,
    is_forced:     false,
    drop_weight:   14,
  },
];

// ── PHASE BOUNDARY CARDS (Empire / GO_ALONE only) ─────────────────────────────

const PHASE_BOUNDARY_CARDS: CardDefinition[] = [
  {
    cardId:        'phase_foundation_exit_001',
    name:          'Foundation Complete',
    deckType:      BaseDeckType.PHASE_BOUNDARY,
    rarity:        CardRarity.RARE,
    timingClass:   TimingClass.PHASE_BOUNDARY,
    base_cost:     0,
    base_effect:   {
      effectType: CardEffectType.INCOME_BOOST, magnitude: 2_000, duration: 0,
      secondary:  { effectType: CardEffectType.CORD_BONUS_FLAT, magnitude: 0.05, duration: 0 },
    },
    tags:          [CardTag.CAPITAL_ALLOC, CardTag.INCOME],
    targeting:     Targeting.SELF,
    educational_tag: 'financial_foundation_milestone',
    lore:          'Phase One complete. The foundation holds. Now build above it.',
    modes_legal:   [GameMode.GO_ALONE],
    is_forced:     false,
    drop_weight:   0,  // engine-injected at phase transition only
  },
  {
    cardId:        'phase_escalation_exit_002',
    name:          'Escalation Protocol',
    deckType:      BaseDeckType.PHASE_BOUNDARY,
    rarity:        CardRarity.EPIC,
    timingClass:   TimingClass.PHASE_BOUNDARY,
    base_cost:     0,
    base_effect:   {
      effectType: CardEffectType.HATER_HEAT_REDUCE, magnitude: 30, duration: 0,
      secondary:  { effectType: CardEffectType.SHIELD_REPAIR, magnitude: 25, duration: 0 },
    },
    tags:          [CardTag.RESILIENCE, CardTag.LIQUIDITY],
    targeting:     Targeting.SELF,
    educational_tag: 'scaling_under_pressure',
    lore:          'Phase Two rewrites the threat model. Adapt or be consumed.',
    modes_legal:   [GameMode.GO_ALONE],
    is_forced:     false,
    drop_weight:   0,
  },
  {
    cardId:        'phase_sovereignty_decision_003',
    name:          'Sovereignty Decision',
    deckType:      BaseDeckType.PHASE_BOUNDARY,
    rarity:        CardRarity.LEGENDARY,
    timingClass:   TimingClass.SOVEREIGNTY_DECISION,
    base_cost:     0,
    base_effect:   { effectType: CardEffectType.CORD_BONUS_FLAT, magnitude: 0.15, duration: 0 },
    tags:          [CardTag.CAPITAL_ALLOC, CardTag.LEVERAGE, CardTag.LEGENDARY_TAG],
    targeting:     Targeting.SELF,
    educational_tag: 'high_stakes_decision_making',
    lore:          'One decision. Two paths. The engine will remember which you chose.',
    modes_legal:   [GameMode.GO_ALONE],
    is_forced:     false,
    drop_weight:   0,  // appears exactly once at minute 11:30
  },
];

// ── SABOTAGE CARDS (HEAD_TO_HEAD only) ────────────────────────────────────────

const SABOTAGE_CARDS: CardDefinition[] = [
  {
    cardId:        'sab_expense_injection_001',
    name:          'Expense Injection',
    deckType:      ModeDeckType.SABOTAGE,
    rarity:        CardRarity.COMMON,
    timingClass:   TimingClass.STANDARD,
    base_cost:     15,  // Battle Budget cost
    base_effect:   { effectType: CardEffectType.EXTRACTION_FIRE, magnitude: 2_500, duration: 0 },
    tags:          [CardTag.SABOTAGE, CardTag.TEMPO, CardTag.COMBAT],
    targeting:     Targeting.OPPONENT,
    educational_tag: 'competitive_disruption',
    lore:          'Their expense line just became your weapon.',
    modes_legal:   [GameMode.HEAD_TO_HEAD],
    is_forced:     false,
    drop_weight:   20,
  },
  {
    cardId:        'sab_income_freeze_002',
    name:          'Income Freeze',
    deckType:      ModeDeckType.SABOTAGE,
    rarity:        CardRarity.UNCOMMON,
    timingClass:   TimingClass.STANDARD,
    base_cost:     25,  // BB cost
    base_effect:   { effectType: CardEffectType.EXTRACTION_FIRE, magnitude: 0.4, duration: 2 },
    tags:          [CardTag.SABOTAGE, CardTag.COMBAT, CardTag.LEVERAGE],
    targeting:     Targeting.OPPONENT,
    educational_tag: 'income_disruption_strategy',
    lore:          'Freeze their income. Watch their empire crumble from the foundation.',
    modes_legal:   [GameMode.HEAD_TO_HEAD],
    is_forced:     false,
    drop_weight:   14,
  },
  {
    cardId:        'sab_shield_crack_003',
    name:          'Shield Crack',
    deckType:      ModeDeckType.SABOTAGE,
    rarity:        CardRarity.RARE,
    timingClass:   TimingClass.STANDARD,
    base_cost:     40,  // BB cost
    base_effect:   { effectType: CardEffectType.EXTRACTION_FIRE, magnitude: 30, duration: 0 },
    tags:          [CardTag.SABOTAGE, CardTag.COMBAT],
    targeting:     Targeting.OPPONENT,
    educational_tag: 'defensive_vulnerability',
    lore:          'Every fortress has a weak point. Find it. Hit it first.',
    modes_legal:   [GameMode.HEAD_TO_HEAD],
    is_forced:     false,
    drop_weight:   8,
  },
];

// ── COUNTER CARDS (HEAD_TO_HEAD only) ─────────────────────────────────────────

const COUNTER_CARDS: CardDefinition[] = [
  {
    cardId:        'counter_absorb_001',
    name:          'Absorb',
    deckType:      ModeDeckType.COUNTER,
    rarity:        CardRarity.COMMON,
    timingClass:   TimingClass.COUNTER_WINDOW,
    base_cost:     8,   // BB cost
    base_effect:   { effectType: CardEffectType.EXTRACTION_BLOCK, magnitude: 0.5, duration: 0 },
    tags:          [CardTag.COUNTER, CardTag.RESILIENCE, CardTag.COMBAT],
    targeting:     Targeting.SELF,
    educational_tag: 'risk_mitigation',
    lore:          'Half the hit is still the half you survived.',
    modes_legal:   [GameMode.HEAD_TO_HEAD],
    is_forced:     false,
    drop_weight:   22,
  },
  {
    cardId:        'counter_full_block_002',
    name:          'Full Block',
    deckType:      ModeDeckType.COUNTER,
    rarity:        CardRarity.RARE,
    timingClass:   TimingClass.COUNTER_WINDOW,
    base_cost:     20,  // BB cost
    base_effect:   { effectType: CardEffectType.EXTRACTION_BLOCK, magnitude: 1.0, duration: 0 },
    tags:          [CardTag.COUNTER, CardTag.RESILIENCE, CardTag.COMBAT],
    targeting:     Targeting.SELF,
    educational_tag: 'complete_risk_elimination',
    lore:          'Zero damage. Full message delivered.',
    modes_legal:   [GameMode.HEAD_TO_HEAD],
    is_forced:     false,
    drop_weight:   10,
  },
];

// ── BLUFF CARDS (HEAD_TO_HEAD only) ───────────────────────────────────────────

const BLUFF_CARDS: CardDefinition[] = [
  {
    cardId:        'bluff_false_threat_001',
    name:          'False Flag',
    deckType:      ModeDeckType.BLUFF,
    rarity:        CardRarity.UNCOMMON,
    timingClass:   TimingClass.BLUFF,
    base_cost:     10,  // BB cost
    base_effect:   {
      effectType: CardEffectType.BLUFF_DISPLAY, magnitude: 0, duration: 0,
      secondary:  { effectType: CardEffectType.INCOME_BOOST, magnitude: 800, duration: 0 },
    },
    tags:          [CardTag.SABOTAGE, CardTag.TEMPO, CardTag.COMBAT],
    targeting:     Targeting.OPPONENT,  // displays to opponent — effect hits self
    educational_tag: 'misdirection_strategy',
    lore:          'They spent their counter window on a phantom. You built with theirs.',
    modes_legal:   [GameMode.HEAD_TO_HEAD],
    is_forced:     false,
    drop_weight:   12,
  },
];

// ── AID CARDS (TEAM_UP only) ──────────────────────────────────────────────────

const AID_CARDS: CardDefinition[] = [
  {
    cardId:        'aid_cash_transfer_001',
    name:          'Emergency Transfer',
    deckType:      ModeDeckType.AID,
    rarity:        CardRarity.COMMON,
    timingClass:   TimingClass.IMMEDIATE,
    base_cost:     0,
    base_effect:   { effectType: CardEffectType.TREASURY_INJECT, magnitude: 5_000, duration: 0 },
    tags:          [CardTag.COOPERATIVE, CardTag.TRUST, CardTag.LIQUIDITY],
    targeting:     Targeting.TEAMMATE,
    educational_tag: 'cooperative_resource_sharing',
    lore:          'The strongest alliances are built on real commitments.',
    modes_legal:   [GameMode.TEAM_UP],
    is_forced:     false,
    drop_weight:   18,
  },
  {
    cardId:        'aid_income_loan_002',
    name:          'Income Loan',
    deckType:      ModeDeckType.AID,
    rarity:        CardRarity.UNCOMMON,
    timingClass:   TimingClass.STANDARD,
    base_cost:     0,
    base_effect:   { effectType: CardEffectType.INCOME_BOOST, magnitude: 1_500, duration: 3 },
    tags:          [CardTag.COOPERATIVE, CardTag.INCOME, CardTag.TRUST],
    targeting:     Targeting.TEAMMATE,
    educational_tag: 'structured_lending',
    lore:          'Terms first. Friendship second. Both stronger for it.',
    modes_legal:   [GameMode.TEAM_UP],
    is_forced:     false,
    drop_weight:   12,
  },
];

// ── RESCUE CARDS (TEAM_UP only) ───────────────────────────────────────────────

const RESCUE_CARDS: CardDefinition[] = [
  {
    cardId:        'rescue_shield_restore_001',
    name:          'Emergency Shield Restore',
    deckType:      ModeDeckType.RESCUE,
    rarity:        CardRarity.RARE,
    timingClass:   TimingClass.RESCUE_WINDOW,
    base_cost:     0,
    base_effect:   { effectType: CardEffectType.SHIELD_REPAIR, magnitude: 40, duration: 0 },
    tags:          [CardTag.COOPERATIVE, CardTag.RESILIENCE, CardTag.TRUST],
    targeting:     Targeting.TEAMMATE,
    educational_tag: 'crisis_intervention',
    lore:          'The faster you arrive, the more of them you save.',
    modes_legal:   [GameMode.TEAM_UP],
    is_forced:     false,
    drop_weight:   10,
  },
  {
    cardId:        'rescue_pressure_absorb_002',
    name:          'Pressure Absorption',
    deckType:      ModeDeckType.RESCUE,
    rarity:        CardRarity.EPIC,
    timingClass:   TimingClass.RESCUE_WINDOW,
    base_cost:     0,
    base_effect:   {
      effectType: CardEffectType.HATER_HEAT_REDUCE, magnitude: 25, duration: 0,
      secondary:  { effectType: CardEffectType.TRUST_SCORE_BOOST, magnitude: 8, duration: 0 },
    },
    tags:          [CardTag.COOPERATIVE, CardTag.TRUST, CardTag.RESILIENCE],
    targeting:     Targeting.TEAMMATE,
    educational_tag: 'network_support_systems',
    lore:          'You took the hit. That\'s the kind of partner people fight for.',
    modes_legal:   [GameMode.TEAM_UP],
    is_forced:     false,
    drop_weight:   6,
  },
];

// ── TRUST CARDS (TEAM_UP only) ────────────────────────────────────────────────

const TRUST_CARDS: CardDefinition[] = [
  {
    cardId:        'trust_signal_001',
    name:          'Trust Signal',
    deckType:      ModeDeckType.TRUST,
    rarity:        CardRarity.COMMON,
    timingClass:   TimingClass.IMMEDIATE,
    base_cost:     0,
    base_effect:   { effectType: CardEffectType.TRUST_SCORE_BOOST, magnitude: 10, duration: 0 },
    tags:          [CardTag.TRUST, CardTag.COOPERATIVE],
    targeting:     Targeting.TEAM_ALL,
    educational_tag: 'trust_building_investment',
    lore:          'Trust compounds. Plant it early.',
    modes_legal:   [GameMode.TEAM_UP],
    is_forced:     false,
    drop_weight:   16,
  },
];

// ── DEFECTION CARDS (TEAM_UP only) ────────────────────────────────────────────

const DEFECTION_CARDS: CardDefinition[] = [
  {
    cardId:        'def_break_pact_001',
    name:          'Break Pact',
    deckType:      ModeDeckType.DEFECTION,
    rarity:        CardRarity.EPIC,
    timingClass:   TimingClass.DEFECTION_STEP,
    base_cost:     0,
    base_effect:   { effectType: CardEffectType.TRUST_SCORE_DRAIN, magnitude: 20, duration: 0 },
    tags:          [CardTag.SABOTAGE],
    targeting:     Targeting.SELF,
    educational_tag: 'alliance_dissolution',
    lore:          'Step one of three. There is no going back from here.',
    modes_legal:   [GameMode.TEAM_UP],
    is_forced:     false,
    drop_weight:   2,
  },
  {
    cardId:        'def_silent_exit_002',
    name:          'Silent Exit',
    deckType:      ModeDeckType.DEFECTION,
    rarity:        CardRarity.EPIC,
    timingClass:   TimingClass.DEFECTION_STEP,
    base_cost:     0,
    base_effect:   { effectType: CardEffectType.TRUST_SCORE_DRAIN, magnitude: 30, duration: 0 },
    tags:          [CardTag.SABOTAGE],
    targeting:     Targeting.SELF,
    educational_tag: 'covert_asset_positioning',
    lore:          'Step two. They may see it now. It\'s too late either way.',
    modes_legal:   [GameMode.TEAM_UP],
    is_forced:     false,
    drop_weight:   2,
  },
  {
    cardId:        'def_asset_seizure_003',
    name:          'Asset Seizure',
    deckType:      ModeDeckType.DEFECTION,
    rarity:        CardRarity.LEGENDARY,
    timingClass:   TimingClass.DEFECTION_STEP,
    base_cost:     0,
    base_effect:   {
      effectType: CardEffectType.TREASURY_DRAIN, magnitude: 0.4, duration: 0,
      secondary:  { effectType: CardEffectType.CORD_BONUS_FLAT, magnitude: -LEGENDARY_DROP_WEIGHT * 0.15, duration: 0 },
    },
    tags:          [CardTag.SABOTAGE, CardTag.LEVERAGE],
    targeting:     Targeting.TEAM_ALL,
    educational_tag: 'defection_consequences',
    lore:          'Step three. The betrayal is complete. The CORD penalty is permanent.',
    modes_legal:   [GameMode.TEAM_UP],
    is_forced:     false,
    drop_weight:   1,
  },
];

// ── GHOST CARDS (CHASE_A_LEGEND only) ─────────────────────────────────────────

const GHOST_CARDS: CardDefinition[] = [
  {
    cardId:        'ghost_gold_read_001',
    name:          'Gold Marker Read',
    deckType:      ModeDeckType.GHOST,
    rarity:        CardRarity.RARE,
    timingClass:   TimingClass.IMMEDIATE,
    base_cost:     0,
    base_effect:   { effectType: CardEffectType.DIVERGENCE_REDUCE, magnitude: 0.08, duration: 0 },
    tags:          [CardTag.PRECISION, CardTag.DETERMINISTIC],
    targeting:     Targeting.GHOST_REF,
    educational_tag: 'pattern_recognition',
    lore:          'The gold markers show where they were strongest. Become stronger there.',
    modes_legal:   [GameMode.CHASE_A_LEGEND],
    is_forced:     false,
    drop_weight:   12,
  },
  {
    cardId:        'ghost_red_exploit_002',
    name:          'Red Marker Exploit',
    deckType:      ModeDeckType.GHOST,
    rarity:        CardRarity.EPIC,
    timingClass:   TimingClass.IMMEDIATE,
    base_cost:     0,
    base_effect:   {
      effectType: CardEffectType.DIVERGENCE_REDUCE, magnitude: 0.12, duration: 0,
      secondary:  { effectType: CardEffectType.CORD_BONUS_FLAT, magnitude: 0.04, duration: 0 },
    },
    tags:          [CardTag.PRECISION, CardTag.TEMPO],
    targeting:     Targeting.GHOST_REF,
    educational_tag: 'competitive_gap_exploitation',
    lore:          'The red markers show where they cracked. Don\'t crack there.',
    modes_legal:   [GameMode.CHASE_A_LEGEND],
    is_forced:     false,
    drop_weight:   7,
  },
];

// ── DISCIPLINE CARDS (CHASE_A_LEGEND only) ────────────────────────────────────

const DISCIPLINE_CARDS: CardDefinition[] = [
  {
    cardId:        'disc_variance_lock_001',
    name:          'Variance Lock',
    deckType:      ModeDeckType.DISCIPLINE,
    rarity:        CardRarity.UNCOMMON,
    timingClass:   TimingClass.IMMEDIATE,
    base_cost:     0,
    base_effect:   { effectType: CardEffectType.VARIANCE_LOCK, magnitude: 3, duration: 3 },
    tags:          [CardTag.VARIANCE_RED, CardTag.DETERMINISTIC, CardTag.PRECISION],
    targeting:     Targeting.SELF,
    educational_tag: 'variance_reduction_strategy',
    lore:          'Chaos is the enemy of comparison. Remove it systematically.',
    modes_legal:   [GameMode.CHASE_A_LEGEND],
    is_forced:     false,
    drop_weight:   18,
  },
  {
    cardId:        'disc_timing_calibrate_002',
    name:          'Timing Calibration',
    deckType:      ModeDeckType.DISCIPLINE,
    rarity:        CardRarity.RARE,
    timingClass:   TimingClass.IMMEDIATE,
    base_cost:     0,
    base_effect:   {
      effectType: CardEffectType.VARIANCE_LOCK, magnitude: 2, duration: 2,
      secondary:  { effectType: CardEffectType.DIVERGENCE_REDUCE, magnitude: 0.04, duration: 0 },
    },
    tags:          [CardTag.VARIANCE_RED, CardTag.PRECISION, CardTag.TEMPO],
    targeting:     Targeting.SELF,
    educational_tag: 'decision_timing_optimization',
    lore:          'They didn\'t play better cards. They played the same cards at the right moment.',
    modes_legal:   [GameMode.CHASE_A_LEGEND],
    is_forced:     false,
    drop_weight:   10,
  },
];

// ── LEGENDARY CARDS (All modes, 1% drop rate) ─────────────────────────────────

const LEGENDARY_CARDS: CardDefinition[] = [
  {
    cardId:        'leg_sovereign_strike_001',
    name:          'Sovereign Strike',
    deckType:      BaseDeckType.PRIVILEGED,
    rarity:        CardRarity.LEGENDARY,
    timingClass:   TimingClass.LEGENDARY,
    base_cost:     0,
    base_effect:   {
      effectType: CardEffectType.BOT_NEUTRALIZE, magnitude: 5, duration: 0,
      secondary:  { effectType: CardEffectType.CORD_BONUS_FLAT, magnitude: 0.10, duration: 0 },
    },
    tags:          [CardTag.LEGENDARY_TAG, CardTag.COMBAT, CardTag.RESILIENCE],
    targeting:     Targeting.SELF,
    educational_tag: 'decisive_high_leverage_action',
    lore:          'Cannot be blocked by any hater bot. This is what sovereignty looks like.',
    modes_legal:   ALL_MODES,
    is_forced:     false,
    drop_weight:   LEGENDARY_DROP_WEIGHT,
  },
  {
    cardId:        'leg_freedom_engine_002',
    name:          'Freedom Engine',
    deckType:      BaseDeckType.IPA,
    rarity:        CardRarity.LEGENDARY,
    timingClass:   TimingClass.LEGENDARY,
    base_cost:     0,
    base_effect:   {
      effectType: CardEffectType.INCOME_BOOST, magnitude: 10_000, duration: 0,
      secondary:  { effectType: CardEffectType.HATER_HEAT_REDUCE, magnitude: 40, duration: 0 },
    },
    tags:          [CardTag.LEGENDARY_TAG, CardTag.INCOME, CardTag.COMPOUNDING, CardTag.AUTOMATION],
    targeting:     Targeting.SELF,
    educational_tag: 'financial_independence_mechanics',
    lore:          'This is the run-defining moment. Play it correctly and the story changes.',
    modes_legal:   ALL_MODES,
    is_forced:     false,
    drop_weight:   LEGENDARY_DROP_WEIGHT,
  },
];

// ── PROOF-BADGE CONDITION CARDS (CHASE_A_LEGEND) ──────────────────────────────

const PROOF_BADGE_CARDS: CardDefinition[] = [
  {
    cardId:        'badge_ghost_hunter_001',
    name:          'Ghost Hunter',
    deckType:      ModeDeckType.GHOST,
    rarity:        CardRarity.EPIC,
    timingClass:   TimingClass.IMMEDIATE,
    base_cost:     0,
    base_effect:   { effectType: CardEffectType.PROOF_BADGE_UNLOCK, magnitude: 1, duration: 0 },
    tags:          [CardTag.PRECISION, CardTag.DETERMINISTIC],
    targeting:     Targeting.GHOST_REF,
    educational_tag: 'excellence_documentation',
    lore:          'Beat the ghost at its own game. The proof card will say so permanently.',
    modes_legal:   [GameMode.CHASE_A_LEGEND],
    is_forced:     false,
    drop_weight:   4,
  },
];

// ── MASTER REGISTRY ────────────────────────────────────────────────────────────

const ALL_CARD_DEFINITIONS: CardDefinition[] = [
  ...OPPORTUNITY_CARDS,
  ...IPA_CARDS,
  ...FUBAR_CARDS,
  ...PRIVILEGED_CARDS,
  ...SO_CARDS,
  ...PHASE_BOUNDARY_CARDS,
  ...SABOTAGE_CARDS,
  ...COUNTER_CARDS,
  ...BLUFF_CARDS,
  ...AID_CARDS,
  ...RESCUE_CARDS,
  ...TRUST_CARDS,
  ...DEFECTION_CARDS,
  ...GHOST_CARDS,
  ...DISCIPLINE_CARDS,
  ...LEGENDARY_CARDS,
  ...PROOF_BADGE_CARDS,
];

// Freeze all definitions at module load — no mutation ever
const FROZEN_DEFINITIONS = ALL_CARD_DEFINITIONS.map(d => Object.freeze({ ...d }));

/**
 * O(1) lookup map by cardId. Populated once at module load.
 * Import this — never iterate FROZEN_DEFINITIONS directly in hot paths.
 */
export const CARD_REGISTRY: ReadonlyMap<string, CardDefinition> = new Map(
  FROZEN_DEFINITIONS.map(d => [d.cardId, d])
);

/**
 * All card definitions indexed by DeckType.
 * Used by DeckBuilder to construct mode-appropriate draw stacks.
 */
export const CARDS_BY_DECK_TYPE: ReadonlyMap<string, CardDefinition[]> = new Map(
  Object.values({ ...BaseDeckType, ...ModeDeckType }).map(deckType => [
    deckType,
    FROZEN_DEFINITIONS.filter(d => d.deckType === deckType),
  ])
);

/**
 * Retrieve a card definition by cardId.
 * @throws if cardId not found — no silent null returns.
 */
export function getCardDefinition(cardId: string): CardDefinition {
  const def = CARD_REGISTRY.get(cardId);
  if (!def) {
    throw new Error(`[CardRegistry] Unknown cardId: '${cardId}'. Card not in registry.`);
  }
  return def;
}

/**
 * All droppable (non-engine-injected) cards for a given deck type.
 * drop_weight > 0 only.
 */
export function getDrawableCards(deckType: DeckType): CardDefinition[] {
  return (CARDS_BY_DECK_TYPE.get(deckType) ?? []).filter(d => d.drop_weight > 0);
}

/**
 * All engine-injected cards (drop_weight === 0, is_forced === true).
 */
export function getInjectedCards(): CardDefinition[] {
  return FROZEN_DEFINITIONS.filter(d => d.drop_weight === 0 && d.is_forced);
}

export { ALL_CARD_DEFINITIONS };