// pzo-web/src/engines/cards/ModeOverlayEngine.ts
// POINT ZERO ONE — MODE OVERLAY ENGINE v2 (Phase 3 Complete)
// Full per-mode tag weight tables per Card Logic Bible · Density6 LLC · Confidential
//
// TAG WEIGHT TABLES (Card Logic Bible spec):
//   Empire (GO_ALONE):          income×2.2  resilience×1.8  tempo×1.2  leverage×1.5
//   Predator (HEAD_TO_HEAD):    tempo×2.4   income×0.6      combat×2.0  sabotage×1.8
//   Syndicate (TEAM_UP):        trust×2.5   cooperative×2.0 income×1.3  resilience×1.5
//   Phantom (CHASE_A_LEGEND):   precision×2.8 divergence×2.2 variance_red×2.0 deterministic×1.8

import {
  GameMode, CardTag, TimingClass, CardRarity,
  DEFAULT_MODE_OVERLAYS,
  type CardDefinition, type CardInHand, type ModeOverlay,
} from './types';
import { v4 as uuidv4 } from 'uuid';

// ── MODE TAG WEIGHT TABLES ────────────────────────────────────────────────────
// These are the canonical per-mode tag weight multipliers from the Card Logic Bible.
// ModeOverlay.tag_weights is populated from these at construction time.
// Card-specific overrides MERGE (add) on top via CARD_MODE_OVERRIDES below.

const MODE_TAG_WEIGHTS: Record<GameMode, Partial<Record<CardTag, number>>> = {
  [GameMode.GO_ALONE]: {
    // Empire: income-first, resilience second, leverage third
    [CardTag.INCOME]:         2.2,
    [CardTag.RESILIENCE]:     1.8,
    [CardTag.LEVERAGE]:       1.5,
    [CardTag.CAPITAL_ALLOC]:  1.6,
    [CardTag.COMPOUNDING]:    1.7,
    [CardTag.AUTOMATION]:     1.4,
    [CardTag.TEMPO]:          1.2,
    [CardTag.LIQUIDITY]:      1.3,
    [CardTag.REAL_WORLD_FINANCE]: 1.5,
    // Non-empire mechanics are down-weighted
    [CardTag.COMBAT]:         0.5,
    [CardTag.SABOTAGE]:       0.3,
    [CardTag.TRUST]:          0.8,
    [CardTag.COOPERATIVE]:    0.7,
    [CardTag.PRECISION]:      1.0,
    [CardTag.DETERMINISTIC]:  1.1,
    [CardTag.VARIANCE_RED]:   1.0,
  },
  [GameMode.HEAD_TO_HEAD]: {
    // Predator: tempo weapons, combat dominance — income severely deprioritized
    [CardTag.TEMPO]:          2.4,
    [CardTag.COMBAT]:         2.0,
    [CardTag.SABOTAGE]:       1.8,
    [CardTag.COUNTER]:        1.7,
    [CardTag.LEVERAGE]:       1.4,
    [CardTag.INCOME]:         0.6,
    [CardTag.COMPOUNDING]:    0.5,
    [CardTag.RESILIENCE]:     1.2,
    [CardTag.CAPITAL_ALLOC]:  0.8,
    [CardTag.AUTOMATION]:     0.7,
    [CardTag.LIQUIDITY]:      1.0,
    [CardTag.REAL_WORLD_FINANCE]: 0.6,
    [CardTag.TRUST]:          0.4,
    [CardTag.COOPERATIVE]:    0.3,
    [CardTag.PRECISION]:      1.1,
    [CardTag.DETERMINISTIC]:  1.0,
    [CardTag.VARIANCE_RED]:   0.9,
  },
  [GameMode.TEAM_UP]: {
    // Syndicate: trust and coordination apex; combat is counter-productive
    [CardTag.TRUST]:          2.5,
    [CardTag.COOPERATIVE]:    2.0,
    [CardTag.INCOME]:         1.3,
    [CardTag.RESILIENCE]:     1.5,
    [CardTag.LIQUIDITY]:      1.4,
    [CardTag.LEVERAGE]:       1.2,
    [CardTag.CAPITAL_ALLOC]:  1.1,
    [CardTag.COMPOUNDING]:    1.3,
    [CardTag.AUTOMATION]:     1.0,
    [CardTag.TEMPO]:          0.9,
    [CardTag.REAL_WORLD_FINANCE]: 1.2,
    [CardTag.COMBAT]:         0.4,
    [CardTag.SABOTAGE]:       0.2,
    [CardTag.PRECISION]:      1.0,
    [CardTag.DETERMINISTIC]:  1.0,
    [CardTag.VARIANCE_RED]:   1.0,
  },
  [GameMode.CHASE_A_LEGEND]: {
    // Phantom: precision execution is everything; combat useless, trust irrelevant
    [CardTag.PRECISION]:      2.8,
    [CardTag.DIVERGENCE]:     2.2,  // divergence-reduce cards weighted highest
    [CardTag.VARIANCE_RED]:   2.0,
    [CardTag.DETERMINISTIC]:  1.8,
    [CardTag.TEMPO]:          1.4,
    [CardTag.INCOME]:         0.9,
    [CardTag.COMPOUNDING]:    1.0,
    [CardTag.RESILIENCE]:     1.1,
    [CardTag.CAPITAL_ALLOC]:  0.9,
    [CardTag.LEVERAGE]:       0.8,
    [CardTag.AUTOMATION]:     0.8,
    [CardTag.LIQUIDITY]:      0.9,
    [CardTag.REAL_WORLD_FINANCE]: 0.8,
    [CardTag.COMBAT]:         0.3,
    [CardTag.SABOTAGE]:       0.2,
    [CardTag.TRUST]:          0.5,
    [CardTag.COOPERATIVE]:    0.4,
  },
};

// ── PER-CARD MODE OVERRIDES ───────────────────────────────────────────────────
// Card-specific ModeOverlay fragments merged on top of mode defaults.
// Only cards that deviate from mode defaults need entries here.
// tag_weights here are ADDITIVE to mode defaults (not replacements).
// timing_lock is UNION (cannot remove mode-level locks).

type CardModeOverrideMap = Record<string, Partial<Record<GameMode, Partial<ModeOverlay>>>>;

const CARD_MODE_OVERRIDES: CardModeOverrideMap = {

  // ── NETWORK CALL — cross-mode reference card ─────────────────────────────
  'priv_network_call_001': {
    [GameMode.GO_ALONE]: {
      effect_modifier: 1.3,
      tag_weights: { [CardTag.RESILIENCE]: 2.0 },
    },
    [GameMode.HEAD_TO_HEAD]: {
      targeting_override: null,
      effect_modifier: 0.8,
      timing_lock: [TimingClass.STANDARD],
    },
    [GameMode.TEAM_UP]: {
      effect_modifier: 1.5,
      tag_weights: { [CardTag.TRUST]: 1.5 },
    },
    [GameMode.CHASE_A_LEGEND]: {
      effect_modifier: 1.0,
    },
  },

  // ── INSIDER ADVANTAGE — information advantage scales with mode context ────
  'priv_insider_advantage_002': {
    [GameMode.HEAD_TO_HEAD]: {
      cost_modifier: 0.7,
      tag_weights: { [CardTag.TEMPO]: 2.0 },
    },
    [GameMode.TEAM_UP]: {
      legal: false,  // individual information advantage is illegal in Syndicate
    },
  },

  // ── BOARD SEAT — coordination bonus in TEAM_UP ───────────────────────────
  'priv_board_seat_003': {
    [GameMode.TEAM_UP]: {
      effect_modifier: 1.4,
      tag_weights: { [CardTag.TRUST]: 1.8 },
    },
    [GameMode.HEAD_TO_HEAD]: {
      effect_modifier: 0.75,
    },
  },

  // ── ASSET SEIZURE — Defection finale; sabotage weight maxes in TEAM_UP ───
  'def_asset_seizure_003': {
    [GameMode.TEAM_UP]: {
      effect_modifier: 1.0,
      tag_weights: { [CardTag.SABOTAGE]: 3.0 },
    },
  },

  // ── SOVEREIGN STRIKE — combat mode amplifies; precision mode reduces ──────
  'leg_sovereign_strike_001': {
    [GameMode.HEAD_TO_HEAD]: {
      effect_modifier: 1.5,
      tag_weights: { [CardTag.COMBAT]: 3.0 },
    },
    [GameMode.CHASE_A_LEGEND]: {
      effect_modifier: 0.8,
    },
    [GameMode.TEAM_UP]: {
      effect_modifier: 1.2,
      tag_weights: { [CardTag.TRUST]: 1.0 },
    },
  },

  // ── FREEDOM ENGINE — full amplification only in Empire ───────────────────
  'leg_freedom_engine_002': {
    [GameMode.GO_ALONE]: {
      effect_modifier: 1.6,
      tag_weights: { [CardTag.INCOME]: 2.5 },
    },
    [GameMode.HEAD_TO_HEAD]: {
      effect_modifier: 0.7,
    },
    [GameMode.TEAM_UP]: {
      effect_modifier: 1.3,
      tag_weights: { [CardTag.TRUST]: 1.2 },
    },
  },

  // ── INCOME LOAN — repayment dynamics in Syndicate ────────────────────────
  'aid_income_loan_002': {
    [GameMode.TEAM_UP]: {
      effect_modifier: 1.0,
      tag_weights: { [CardTag.TRUST]: 2.5 },
    },
  },

  // ── GHOST CARDS — Phantom precision stack ────────────────────────────────
  'ghost_gold_read_001': {
    [GameMode.CHASE_A_LEGEND]: {
      effect_modifier: 1.0,
      tag_weights: {
        [CardTag.PRECISION]:     2.5,
        [CardTag.DETERMINISTIC]: 2.0,
      },
    },
  },
  'ghost_red_exploit_002': {
    [GameMode.CHASE_A_LEGEND]: {
      effect_modifier: 1.2,
      tag_weights: {
        [CardTag.PRECISION]: 2.8,
        [CardTag.TEMPO]:     1.5,
      },
    },
  },
  'ghost_gold_pattern_003': {
    [GameMode.CHASE_A_LEGEND]: {
      effect_modifier: 1.3,
      tag_weights: {
        [CardTag.PRECISION]:  2.6,
        [CardTag.VARIANCE_RED]: 2.2,
      },
    },
  },
  'ghost_red_gap_005': {
    [GameMode.CHASE_A_LEGEND]: {
      effect_modifier: 1.4,
      tag_weights: {
        [CardTag.PRECISION]:  3.0,
        [CardTag.TEMPO]:      2.0,
      },
    },
  },

  // ── GAP_EXPLOIT cards — divergence closure bonus in Phantom ──────────────
  'gap_decision_edge_003': {
    [GameMode.CHASE_A_LEGEND]: {
      effect_modifier: 1.5,
      tag_weights: {
        [CardTag.PRECISION]:     3.0,
        [CardTag.DETERMINISTIC]: 2.5,
      },
    },
  },
  'gap_legendary_gap_004': {
    [GameMode.CHASE_A_LEGEND]: {
      effect_modifier: 2.0,
      tag_weights: {
        [CardTag.PRECISION]:  3.5,
        [CardTag.DIVERGENCE]: 3.0,
      },
    },
  },

  // ── SABOTAGE CARDS — tempo amp in Predator ───────────────────────────────
  'sab_tempo_spike_006': {
    [GameMode.HEAD_TO_HEAD]: {
      cost_modifier: 0.8,
      tag_weights: { [CardTag.TEMPO]: 3.0 },
    },
  },
  'sab_cascade_trigger_007': {
    [GameMode.HEAD_TO_HEAD]: {
      effect_modifier: 1.3,
      tag_weights: { [CardTag.COMBAT]: 2.5 },
    },
  },
  'sab_sovereign_spike_010': {
    [GameMode.HEAD_TO_HEAD]: {
      effect_modifier: 1.5,
      tag_weights: {
        [CardTag.SABOTAGE]: 3.5,
        [CardTag.COMBAT]:   3.0,
      },
    },
  },

  // ── COUNTER REFLECT — aggressive counter is a tempo weapon ───────────────
  'counter_reflect_003': {
    [GameMode.HEAD_TO_HEAD]: {
      effect_modifier: 1.4,
      tag_weights: {
        [CardTag.COUNTER]: 2.5,
        [CardTag.TEMPO]:   2.0,
      },
    },
  },

  // ── BLUFF CARDS — only valid in HEAD_TO_HEAD; enforced by TimingValidator ─
  'bluff_phantom_strike_003': {
    [GameMode.HEAD_TO_HEAD]: {
      effect_modifier: 1.2,
      tag_weights: { [CardTag.TEMPO]: 2.8 },
    },
  },

  // ── TRUST CARDS — Syndicate compounding ──────────────────────────────────
  'trust_sovereign_pact_006': {
    [GameMode.TEAM_UP]: {
      effect_modifier: 1.6,
      tag_weights: {
        [CardTag.TRUST]:       3.0,
        [CardTag.COOPERATIVE]: 2.5,
      },
    },
  },

  // ── RESCUE FULL EXTRACTION — critical window bonus ───────────────────────
  'rescue_full_extraction_005': {
    [GameMode.TEAM_UP]: {
      effect_modifier: 1.8,
      tag_weights: {
        [CardTag.TRUST]:       3.0,
        [CardTag.COOPERATIVE]: 2.8,
        [CardTag.RESILIENCE]:  2.0,
      },
    },
  },

  // ── PHASE BOUNDARY CARDS — Empire only; always max CORD weight ───────────
  'phase_sovereignty_decision_003': {
    [GameMode.GO_ALONE]: {
      effect_modifier: 2.0,
      cord_weight: 2.0,
      tag_weights: {
        [CardTag.CAPITAL_ALLOC]: 3.0,
        [CardTag.LEVERAGE]:      2.5,
      },
    },
  },
  'phase_expansion_bridge_004': {
    [GameMode.GO_ALONE]: {
      effect_modifier: 1.6,
      tag_weights: {
        [CardTag.INCOME]:    2.8,
        [CardTag.LEVERAGE]:  2.2,
      },
    },
  },

  // ── DYNASTY / PROOF BADGE — legacy compounding in Phantom ────────────────
  'dyn_sovereign_legacy_005': {
    [GameMode.CHASE_A_LEGEND]: {
      effect_modifier: 2.0,
      cord_weight: 2.5,
      tag_weights: {
        [CardTag.PRECISION]:     3.5,
        [CardTag.DETERMINISTIC]: 3.0,
      },
    },
  },
  'badge_dynasty_architect_003': {
    [GameMode.CHASE_A_LEGEND]: {
      effect_modifier: 3.0,
      cord_weight: 3.0,
      tag_weights: {
        [CardTag.PRECISION]:     4.0,
        [CardTag.DETERMINISTIC]: 3.5,
      },
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MODE OVERLAY ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

export class ModeOverlayEngine {
  private readonly mode: GameMode;
  private readonly defaultOverlay: ModeOverlay;
  private readonly modeTagWeights: Partial<Record<CardTag, number>>;

  constructor(mode: GameMode) {
    this.mode = mode;
    this.defaultOverlay = DEFAULT_MODE_OVERLAYS[mode];
    this.modeTagWeights = MODE_TAG_WEIGHTS[mode] ?? {};
  }

  // ── PUBLIC API ────────────────────────────────────────────────────────────

  /**
   * Apply the mode overlay to a CardDefinition and produce a CardInHand.
   * Called by HandManager at draw time.
   * Returns null if the card is illegal in this mode.
   */
  public applyOverlay(def: CardDefinition, drawnAtTick: number): CardInHand | null {
    const merged = this.mergeOverlay(def);
    if (!merged.legal) return null;

    const effectiveCost = Math.max(0, Math.floor(def.base_cost * merged.cost_modifier));

    const card: CardInHand = {
      instanceId:       uuidv4(),
      definition:       def,
      overlay:          merged,
      drawnAtTick,
      isForced:         def.is_forced,
      isHeld:           false,
      isLegendary:      def.rarity === CardRarity.LEGENDARY,
      effectiveCost,
      decisionWindowId: null,
    };

    return card;
  }

  /**
   * Build the complete merged ModeOverlay for a card.
   *
   * Merge order (lowest → highest priority):
   *   1. DEFAULT_MODE_OVERLAYS[mode]           (base fallback from types.ts)
   *   2. MODE_TAG_WEIGHTS[mode]                (Card Logic Bible tag tables)
   *   3. CARD_MODE_OVERRIDES[cardId][mode]     (card-specific deviation)
   *
   * tag_weights: fully additive — card overrides ADD to mode weights, never replace.
   * timing_lock: union — card cannot remove mode-level locks.
   * legal: card override wins, then mode default.
   * targeting_override: card override checked for `undefined` (absent) vs `null` (explicit null).
   */
  public mergeOverlay(def: CardDefinition): ModeOverlay {
    const base         = this.defaultOverlay;
    const cardOverride = CARD_MODE_OVERRIDES[def.cardId]?.[this.mode] ?? {};

    // tag_weights: mode table → card override ADDS on top
    const mergedTagWeights: Partial<Record<CardTag, number>> = {
      ...base.tag_weights,
      ...this.modeTagWeights,   // apply Card Logic Bible mode table
    };
    // card-specific overrides are additive
    if (cardOverride.tag_weights) {
      for (const [tag, weight] of Object.entries(cardOverride.tag_weights)) {
        const existing = mergedTagWeights[tag as CardTag] ?? 1.0;
        mergedTagWeights[tag as CardTag] = existing + (weight - 1.0); // additive delta from base 1.0
      }
    }

    // timing_lock: union
    const mergedTimingLock: TimingClass[] = Array.from(new Set([
      ...base.timing_lock,
      ...(cardOverride.timing_lock ?? []),
    ]));

    return {
      cost_modifier:      cardOverride.cost_modifier      ?? base.cost_modifier,
      effect_modifier:    cardOverride.effect_modifier    ?? base.effect_modifier,
      tag_weights:        mergedTagWeights,
      timing_lock:        mergedTimingLock,
      legal:              cardOverride.legal              ?? base.legal,
      targeting_override: cardOverride.targeting_override !== undefined
        ? cardOverride.targeting_override
        : base.targeting_override,
      cord_weight:        cardOverride.cord_weight        ?? base.cord_weight,
    };
  }

  /**
   * Fast legality check without producing a CardInHand.
   * Used by DeckBuilder pre-filter and validation paths.
   */
  public isLegalInMode(def: CardDefinition): boolean {
    const cardOverride = CARD_MODE_OVERRIDES[def.cardId]?.[this.mode] ?? {};
    return cardOverride.legal ?? this.defaultOverlay.legal;
  }

  /**
   * Effective cost in this mode — without constructing a CardInHand.
   */
  public getEffectiveCost(def: CardDefinition): number {
    const cardOverride = CARD_MODE_OVERRIDES[def.cardId]?.[this.mode] ?? {};
    const modifier     = cardOverride.cost_modifier ?? this.defaultOverlay.cost_modifier;
    return Math.max(0, Math.floor(def.base_cost * modifier));
  }

  /**
   * Tag weight for a specific tag — used by CardScorer for CORD computation.
   */
  public getTagWeight(def: CardDefinition, tag: CardTag): number {
    const merged = this.mergeOverlay(def);
    return merged.tag_weights[tag] ?? 1.0;
  }

  /**
   * Full mode tag weight table — used by CardScorer to build CORD profiles.
   * Returns the mode-level defaults before card-specific overrides.
   */
  public getModeTagWeights(): Partial<Record<CardTag, number>> {
    return { ...this.modeTagWeights };
  }

  public get currentMode(): GameMode {
    return this.mode;
  }
}