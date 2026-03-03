// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — CATALOG ADAPTER
// pzo_engine/src/cards/catalog-adapter.ts
//
// Converts a CatalogCard (JSON format) → CardDefinition (engine format).
// This is the ONLY file that knows about both schemas.
//
// MAPPING LOGIC:
//   JSON deck        → BaseDeckType / ModeDeckType enum
//   JSON subtype     → CardRarity + TimingClass
//   JSON effects[]   → CardBaseEffect (primary + secondary)
//   JSON tags[]      → CardTag[]
//   JSON economics   → base_cost + magnitude (from cashflowMonthly)
//
// OP → CardEffectType MAPPING:
//   CASH_ADD (amount > 0)          → INCOME_BOOST (magnitude = amount/month)
//   CASH_ADD (amount < 0)          → EXPENSE_SPIKE (magnitude = abs(amount))
//   PROMPT_BUY_OR_PASS             → primary INCOME_BOOST (derived from cashflowMonthly)
//   ON_BUY_ADD_ASSET               → collapsed into INCOME_BOOST (carried by PROMPT)
//   PROMPT_BUY_OR_PASS_IPA         → INCOME_BOOST (IPA)
//   ON_BUY_ADD_IPA                 → collapsed into INCOME_BOOST
//   BUFF_ADD (SHIELD)              → SHIELD_REPAIR
//   BUFF_ADD (DOWNPAY_CREDIT)      → CORD_BONUS_FLAT (cost reduction encoded as magnitude)
//   BUFF_ADD (LEVERAGE_BLOCK)      → HATER_HEAT_REDUCE
//   BUFF_ADD (RATE_DISCOUNT)       → EXPENSE_REDUCTION
//   PROMPT_FORCED_SALE             → EXPENSE_SPIKE (magnitude = down payment at 70%)
//   TURNS_SKIP                     → NO_OP (duration = turns blocked)
//   DRAW_OPPORTUNITY_PICK_BEST     → CORD_BONUS_FLAT
//   NEXT_OPPORTUNITY_OPEN_TO_TABLE → CASCADE_ACCELERATE (social pressure)
//
// RULES:
//   ✦ Pure functions only — no side effects.
//   ✦ Any unmapped op gets NO_OP with a console.warn in dev.
//   ✦ base_cost for OPPORTUNITY = economics.downPayment ?? economics.cost * 0.20
//   ✦ base_cost for IPA = economics.setupCost ?? economics.cost
//   ✦ base_cost for FUBAR/SO/MISSED = 0 (player cannot choose not to be hit)
//
// Density6 LLC · Point Zero One · pzo_engine · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  CatalogCard,
  CatalogEffect,
  CatalogDeckType,
} from './catalog-types';

// Import engine types — these mirror pzo-web/src/engines/cards/types.ts exactly.
// pzo_engine uses the same type contract so CardDefinitions are interchangeable.
import {
  BaseDeckType,
  ModeDeckType,
  CardRarity,
  TimingClass,
  CardEffectType,
  CardTag,
  Targeting,
  GameMode,
  type CardDefinition,
  type CardBaseEffect,
} from '../shared-types/card-definition';

// ── ALL MODES SHORTHAND ───────────────────────────────────────────────────────

const ALL_MODES: GameMode[] = [
  GameMode.GO_ALONE,
  GameMode.HEAD_TO_HEAD,
  GameMode.TEAM_UP,
  GameMode.CHASE_A_LEGEND,
];

// ── DECK TYPE MAP ─────────────────────────────────────────────────────────────

const DECK_TYPE_MAP: Record<CatalogDeckType, BaseDeckType | ModeDeckType> = {
  OPPORTUNITY:        BaseDeckType.OPPORTUNITY,
  IPA:                BaseDeckType.IPA,
  FUBAR:              BaseDeckType.FUBAR,
  PRIVILEGED:         BaseDeckType.PRIVILEGED,
  SO:                 BaseDeckType.SO,
  MISSED_OPPORTUNITY: BaseDeckType.FUBAR, // MISSED_OPP treated as FUBAR subtype in engine
};

// ── TAG MAP ───────────────────────────────────────────────────────────────────
// Maps JSON tag strings → CardTag enum values.
// JSON tags that don't map to a CardTag are dropped (engine-irrelevant).

const TAG_MAP: Record<string, CardTag> = {
  HIGH_CASHFLOW:   CardTag.INCOME,
  INCOME_ASSET:    CardTag.INCOME,
  IPA:             CardTag.AUTOMATION,
  BUSINESS:        CardTag.CAPITAL_ALLOC,
  REAL_ESTATE:     CardTag.REAL_WORLD_FINANCE,
  PAPER_ASSET:     CardTag.LEVERAGE,
  BIG_DEAL:        CardTag.LEVERAGE,
  LOW_ENTRY:       CardTag.LIQUIDITY,
  ALL_CASH:        CardTag.LIQUIDITY,
  HIGH_ROI:        CardTag.COMPOUNDING,
  SMALL_DEAL:      CardTag.REAL_WORLD_FINANCE,
  SHIELD:          CardTag.RESILIENCE,
  DOWNPAY_DISCOUNT:CardTag.CAPITAL_ALLOC,
  RATE_DISCOUNT:   CardTag.LIQUIDITY,
  LOAN_DENIAL:     CardTag.RESILIENCE,
  DELAY:           CardTag.TEMPO,
  DOODAD:          CardTag.REAL_WORLD_FINANCE,
  FUBAR:           CardTag.RESILIENCE,
  SO:              CardTag.RESILIENCE,
  CRISIS:          CardTag.RESILIENCE,
  SEIZURE:         CardTag.RESILIENCE,
  INERTIA_TAX:     CardTag.TEMPO,
  REVEAL_OPPORTUNITY: CardTag.TEMPO,
  MACRO_SHIFT:     CardTag.REAL_WORLD_FINANCE,
  MARKET_PULSE:    CardTag.REAL_WORLD_FINANCE,
  NEGATIVE_CASHFLOW: CardTag.INCOME,
  CASH_GRANT:      CardTag.LIQUIDITY,
  EXTRA_DRAW:      CardTag.TEMPO,
  TURNS_LOST:      CardTag.TEMPO,
  FEE:             CardTag.REAL_WORLD_FINANCE,
  MISSED_OPPORTUNITY: CardTag.TEMPO,
  RATE_PENALTY:    CardTag.REAL_WORLD_FINANCE,
};

// ── RARITY ASSIGNMENT ──────────────────────────────────────────────────────────

function assignRarity(card: CatalogCard): CardRarity {
  const { deck, subtype, economics } = card;

  // PRIVILEGED cards are rare by definition
  if (deck === 'PRIVILEGED') {
    if (subtype === 'CASH_GRANT' || economics?.cost === undefined) return CardRarity.UNCOMMON;
    return CardRarity.RARE;
  }

  // OPPORTUNITY: rarity by down payment size
  if (deck === 'OPPORTUNITY' && economics) {
    const dp = economics.downPayment ?? 0;
    if (dp >= 75_000) return CardRarity.RARE;
    if (dp >= 25_000) return CardRarity.UNCOMMON;
    return CardRarity.COMMON;
  }

  // IPA: rarity by ROI
  if (deck === 'IPA' && economics) {
    const roi = economics.roiPct ?? 0;
    if (roi >= 500) return CardRarity.RARE;
    if (roi >= 200) return CardRarity.UNCOMMON;
    return CardRarity.COMMON;
  }

  return CardRarity.COMMON;
}

// ── TIMING CLASS ASSIGNMENT ───────────────────────────────────────────────────

function assignTimingClass(card: CatalogCard): TimingClass {
  switch (card.deck) {
    case 'OPPORTUNITY':
    case 'IPA':
      return TimingClass.STANDARD;
    case 'FUBAR':
    case 'MISSED_OPPORTUNITY':
      return TimingClass.FORCED;
    case 'SO':
      // Loan denial / forced sale → FORCED; fee/delay → REACTIVE
      if (card.subtype === 'FORCED_SALE' || card.subtype === 'LOAN_DENIAL') {
        return TimingClass.FORCED;
      }
      return TimingClass.REACTIVE;
    case 'PRIVILEGED':
      return TimingClass.IMMEDIATE;
    default:
      return TimingClass.STANDARD;
  }
}

// ── DROP WEIGHT ASSIGNMENT ────────────────────────────────────────────────────

function assignDropWeight(card: CatalogCard): number {
  switch (card.deck) {
    case 'OPPORTUNITY': {
      // Weight by ROI — higher ROI = lower drop weight (rarer)
      const roi = card.economics?.roiPct ?? 30;
      if (roi >= 150) return 4;
      if (roi >= 80)  return 8;
      if (roi >= 50)  return 12;
      return 18;
    }
    case 'IPA': {
      const roi = card.economics?.roiPct ?? 100;
      if (roi >= 1000) return 3;
      if (roi >= 500)  return 6;
      return 10;
    }
    case 'FUBAR':         return 20;
    case 'MISSED_OPPORTUNITY': return 12;
    case 'SO':            return 14;
    case 'PRIVILEGED':    return 8;
    default:              return 10;
  }
}

// ── EFFECT MAPPING ────────────────────────────────────────────────────────────

function mapEffects(card: CatalogCard): { primary: CardBaseEffect; secondary?: CardBaseEffect } {
  const effects = card.effects;
  const { economics, deck } = card;

  // ── OPPORTUNITY: PROMPT_BUY_OR_PASS + ON_BUY_ADD_ASSET ──────────────────
  if (deck === 'OPPORTUNITY') {
    const cashflow = economics?.cashflowMonthly ?? 500;
    return {
      primary: {
        effectType: CardEffectType.INCOME_BOOST,
        magnitude:  cashflow,
        duration:   0,
      },
    };
  }

  // ── IPA: PROMPT_BUY_OR_PASS_IPA + ON_BUY_ADD_IPA ────────────────────────
  if (deck === 'IPA') {
    const cashflow = economics?.cashflowMonthly ?? 400;
    return {
      primary: {
        effectType: CardEffectType.INCOME_BOOST,
        magnitude:  cashflow,
        duration:   0,
      },
    };
  }

  // ── Walk the effects array for all other deck types ──────────────────────
  let primaryEffect: CardBaseEffect | null = null;
  let secondaryEffect: CardBaseEffect | undefined = undefined;

  for (const eff of effects) {
    const mapped = mapSingleEffect(eff, card);
    if (!mapped) continue;
    if (!primaryEffect) {
      primaryEffect = mapped.primary;
      secondaryEffect = mapped.secondary;
    }
    // Only take the first meaningful effect pair
    break;
  }

  // Fallback
  if (!primaryEffect) {
    primaryEffect = { effectType: CardEffectType.NO_OP, magnitude: 0 };
  }

  return { primary: primaryEffect, secondary: secondaryEffect };
}

function mapSingleEffect(
  eff:  CatalogEffect,
  card: CatalogCard,
): { primary: CardBaseEffect; secondary?: CardBaseEffect } | null {
  switch (eff.op) {

    case 'CASH_ADD': {
      const amount = eff.amount ?? 0;
      if (amount >= 0) {
        return {
          primary: { effectType: CardEffectType.INCOME_BOOST, magnitude: amount },
        };
      } else {
        return {
          primary: { effectType: CardEffectType.EXPENSE_SPIKE, magnitude: Math.abs(amount) },
        };
      }
    }

    case 'BUFF_ADD': {
      const buff = eff.buff;
      if (!buff) return { primary: { effectType: CardEffectType.NO_OP, magnitude: 0 } };

      switch (buff.type) {
        case 'SHIELD':
          return {
            primary: { effectType: CardEffectType.SHIELD_REPAIR, magnitude: 25 }, // 1 shield layer = 25pts
          };
        case 'DOWNPAY_CREDIT':
          // Encoded as a CORD bonus — makes a subsequent card cheaper
          return {
            primary: { effectType: CardEffectType.CORD_BONUS_FLAT, magnitude: (buff.amount ?? 15_000) / 500_000 },
          };
        case 'LEVERAGE_BLOCK':
          return {
            primary: { effectType: CardEffectType.HATER_HEAT_REDUCE, magnitude: 20 },
          };
        case 'RATE_DISCOUNT':
          return {
            primary: { effectType: CardEffectType.EXPENSE_REDUCTION, magnitude: 200 },
          };
        default:
          return { primary: { effectType: CardEffectType.NO_OP, magnitude: 0 } };
      }
    }

    case 'PROMPT_FORCED_SALE': {
      // Forced sale: player loses asset at 70% value — EXPENSE_SPIKE approximated
      const downPay = card.economics?.downPayment ?? 20_000;
      return {
        primary: {
          effectType: CardEffectType.EXPENSE_SPIKE,
          magnitude:  Math.round(downPay * 0.30), // lose 30% of down payment
        },
      };
    }

    case 'TURNS_SKIP': {
      const count = eff.count ?? 3;
      return {
        primary: {
          effectType: CardEffectType.NO_OP,
          magnitude:  0,
          duration:   count * 12, // count turns * MONTH_TICKS
        },
      };
    }

    case 'DRAW_OPPORTUNITY_PICK_BEST': {
      const drawCount = eff.count ?? 3;
      return {
        primary: {
          effectType: CardEffectType.CORD_BONUS_FLAT,
          magnitude:  drawCount * 0.005, // each extra draw ≈ 0.005 CORD
        },
      };
    }

    case 'NEXT_OPPORTUNITY_OPEN_TO_TABLE': {
      // Social pressure mechanic: accelerates a cascade (urgency signal)
      return {
        primary: {
          effectType: CardEffectType.CASCADE_ACCELERATE,
          magnitude:  1,
        },
      };
    }

    case 'PROMPT_BUY_OR_PASS':
    case 'PROMPT_BUY_OR_PASS_IPA':
    case 'ON_BUY_ADD_ASSET':
    case 'ON_BUY_ADD_IPA':
      // Already handled at deck level above
      return null;

    default:
      if (process.env['NODE_ENV'] !== 'production') {
        console.warn(`[CatalogAdapter] Unmapped effect op: ${eff.op}`);
      }
      return { primary: { effectType: CardEffectType.NO_OP, magnitude: 0 } };
  }
}

// ── BASE COST COMPUTATION ─────────────────────────────────────────────────────

function computeBaseCost(card: CatalogCard): number {
  const { deck, economics, effects } = card;

  if (deck === 'OPPORTUNITY') {
    return economics?.downPayment ?? Math.round((economics?.cost ?? 50_000) * 0.20);
  }

  if (deck === 'IPA') {
    return economics?.setupCost ?? economics?.cost ?? 1_000;
  }

  // FUBAR / MISSED_OPPORTUNITY / SO → 0 (forced, not a choice)
  if (deck === 'FUBAR' || deck === 'MISSED_OPPORTUNITY' || deck === 'SO') {
    return 0;
  }

  // PRIVILEGED: find CASH_ADD or cost embedded in buff
  for (const eff of effects) {
    if (eff.op === 'BUFF_ADD' && eff.buff?.amount) return 0; // free buff
    if (eff.op === 'CASH_ADD' && (eff.amount ?? 0) > 0) return 0; // cash grant = free
  }
  return 0;
}

// ── TAG MAPPING ───────────────────────────────────────────────────────────────

function mapTags(card: CatalogCard): CardTag[] {
  const result = new Set<CardTag>();

  for (const jsonTag of card.tags) {
    const engineTag = TAG_MAP[jsonTag];
    if (engineTag) result.add(engineTag);
  }

  // Always add REAL_WORLD_FINANCE — all cards teach financial principles
  result.add(CardTag.REAL_WORLD_FINANCE);

  return Array.from(result);
}

// ── EDUCATIONAL TAG ────────────────────────────────────────────────────────────

function deriveEducationalTag(card: CatalogCard): string {
  const { deck, subtype, economics } = card;

  if (deck === 'OPPORTUNITY' && economics?.assetKind === 'REAL_ESTATE') {
    return 'passive_income_real_estate';
  }
  if (deck === 'OPPORTUNITY' && economics?.assetKind === 'BUSINESS') {
    return 'business_acquisition_leverage';
  }
  if (deck === 'IPA') return 'income_producing_asset';
  if (deck === 'FUBAR') return 'lifestyle_expense_management';
  if (deck === 'MISSED_OPPORTUNITY') return 'opportunity_cost_inertia';
  if (deck === 'SO') {
    if (subtype === 'LOAN_DENIAL') return 'credit_access_barriers';
    if (subtype === 'FORCED_SALE') return 'liquidity_crisis_management';
    return 'systemic_obstacle_conversion';
  }
  if (deck === 'PRIVILEGED') return 'network_advantage';
  return 'financial_sovereignty';
}

// ── MODES LEGAL ───────────────────────────────────────────────────────────────

function assignModesLegal(card: CatalogCard): GameMode[] {
  // Base deck types (OPPORTUNITY, IPA, FUBAR, SO, PRIVILEGED) are legal in all modes.
  // MISSED_OPPORTUNITY behaves like FUBAR — all modes.
  return ALL_MODES;
}

// ── IS FORCED ──────────────────────────────────────────────────────────────────

function isForced(card: CatalogCard): boolean {
  return (
    card.deck === 'FUBAR' ||
    card.deck === 'MISSED_OPPORTUNITY' ||
    card.deck === 'SO'
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PRIMARY EXPORT: adaptCard
// Converts one CatalogCard → CardDefinition.
// ══════════════════════════════════════════════════════════════════════════════

export function adaptCard(card: CatalogCard): CardDefinition {
  const { primary: primaryEffect, secondary: secondaryEffect } = mapEffects(card);

  if (secondaryEffect) {
    primaryEffect.secondary = secondaryEffect;
  }

  const deckType   = DECK_TYPE_MAP[card.deck] ?? BaseDeckType.FUBAR;
  const rarity     = assignRarity(card);
  const timingClass = assignTimingClass(card);

  return {
    cardId:          card.id,
    name:            card.title,
    deckType,
    rarity,
    timingClass,
    base_cost:       computeBaseCost(card),
    base_effect:     primaryEffect,
    tags:            mapTags(card),
    targeting:       Targeting.SELF,          // all base deck cards are self-targeting
    educational_tag: deriveEducationalTag(card),
    lore:            card.text.slice(0, 120), // first 120 chars as lore
    modes_legal:     assignModesLegal(card),
    is_forced:       isForced(card),
    drop_weight:     assignDropWeight(card),
  };
}

export function adaptCards(cards: CatalogCard[]): CardDefinition[] {
  return cards.map(adaptCard);
}