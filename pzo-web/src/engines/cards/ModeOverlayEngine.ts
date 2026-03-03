//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/cards/ModeOverlayEngine.ts

// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — MODE OVERLAY ENGINE
// pzo-web/src/engines/cards/ModeOverlayEngine.ts
//
// Applies the ModeOverlay to every card at draw time.
// The base CardDefinition NEVER changes. Only the runtime CardInHand reflects
// the overlay — cost, effect magnitude, tag weights, timing locks, targeting.
//
// This is the central intelligence layer of the card system.
// The same card in four modes produces four completely different runtime instances.
//
// RULES:
//   ✦ Base CardDefinition is never mutated. All changes go to CardInHand fields.
//   ✦ ModeOverlay is merged: card-specific overrides take priority over mode defaults.
//   ✦ legal: false → card never enters hand. DeckBuilder pre-filters, but
//     ModeOverlayEngine is the final enforcement gate.
//   ✦ tag_weights are merged (card-specific ADDS TO mode defaults, doesn't replace).
//   ✦ timing_lock is UNION of mode-level locks and card-level locks.
//   ✦ effectiveCost = base_cost * cost_modifier, floored at 0.
//
// Density6 LLC · Point Zero One · Cards Engine · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import {
  GameMode,
  CardTag,
  TimingClass,
  CardRarity,
  DEFAULT_MODE_OVERLAYS,
  type CardDefinition,
  type CardInHand,
  type ModeOverlay,
} from './types';
import { v4 as uuidv4 } from 'uuid';

// ── PER-CARD MODE OVERRIDES ────────────────────────────────────────────────────
// Card-specific ModeOverlay fragments that are merged on top of the mode default.
// Only cards that behave differently from the mode default need entries here.
// Format: { cardId: { [GameMode]: Partial<ModeOverlay> } }

type CardModeOverrideMap = Record<string, Partial<Record<GameMode, Partial<ModeOverlay>>>>;

const CARD_MODE_OVERRIDES: CardModeOverrideMap = {

  // NETWORK CALL — cross-mode example from Card Logic Bible
  'priv_network_call_001': {
    [GameMode.GO_ALONE]: {
      effect_modifier: 1.3,                    // +30% effect in Empire
      tag_weights: { [CardTag.RESILIENCE]: 2.0 },
    },
    [GameMode.HEAD_TO_HEAD]: {
      targeting_override: null,                // stays self-targeted in Predator
      effect_modifier: 0.8,                    // weaker — less useful in combat
      timing_lock: [TimingClass.STANDARD],     // forced into IMMEDIATE only
    },
    [GameMode.TEAM_UP]: {
      effect_modifier: 1.5,                    // +50% — cooperation amplifies network
      tag_weights: { [CardTag.TRUST]: 1.5 },
    },
    [GameMode.CHASE_A_LEGEND]: {
      effect_modifier: 1.0,                    // no bonus — precision mode doesn't amplify social
    },
  },

  // INSIDER ADVANTAGE — heavy heat in all modes, scales differently per mode
  'priv_insider_advantage_002': {
    [GameMode.HEAD_TO_HEAD]: {
      cost_modifier: 0.7,    // cheaper in Predator — information is your weapon
      tag_weights: { [CardTag.TEMPO]: 2.0 },
    },
    [GameMode.TEAM_UP]: {
      legal: false,          // insider advantage is individual — illegal in Syndicate
    },
  },

  // ASSET SEIZURE — Defection finale. Larger drain in longer alliances.
  'def_asset_seizure_003': {
    [GameMode.TEAM_UP]: {
      effect_modifier: 1.0,  // base — trust score context applied at runtime
      tag_weights: { [CardTag.SABOTAGE]: 3.0 }, // highest sabotage weight in game
    },
  },

  // SOVEREIGN STRIKE — Legendary. Cannot be blocked. Full effect in all modes.
  'leg_sovereign_strike_001': {
    [GameMode.HEAD_TO_HEAD]: {
      effect_modifier: 1.5,  // +50% — combat mode amplifies it
      tag_weights: { [CardTag.COMBAT]: 3.0 },
    },
    [GameMode.CHASE_A_LEGEND]: {
      effect_modifier: 0.8,  // slightly weaker — precision mode doesn't need a hammer
    },
  },

  // INCOME LOAN — AID card. Repayment terms affect Syndicate-only.
  'aid_income_loan_002': {
    [GameMode.TEAM_UP]: {
      effect_modifier: 1.0,
      tag_weights: { [CardTag.TRUST]: 2.5 },
    },
  },

  // GHOST CARDS — require Legend Markers — only fully legal with ghost data
  'ghost_gold_read_001': {
    [GameMode.CHASE_A_LEGEND]: {
      effect_modifier: 1.0,
      tag_weights: {
        [CardTag.PRECISION]:   2.5,
        [CardTag.DETERMINISTIC]: 2.0,
      },
    },
  },
  'ghost_red_exploit_002': {
    [GameMode.CHASE_A_LEGEND]: {
      effect_modifier: 1.2,
      tag_weights: {
        [CardTag.PRECISION]:   2.8,
        [CardTag.TEMPO]:       1.5,
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

  constructor(mode: GameMode) {
    this.mode = mode;
    this.defaultOverlay = DEFAULT_MODE_OVERLAYS[mode];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Apply the mode overlay to a CardDefinition and produce a CardInHand.
   * Called by HandManager at draw time — before the card is shown to the player.
   *
   * @param def        - Immutable base card definition
   * @param drawnAtTick - Which tick the card was drawn
   * @returns          CardInHand with overlay applied, or null if card is illegal in this mode
   */
  public applyOverlay(def: CardDefinition, drawnAtTick: number): CardInHand | null {
    const merged = this.mergeOverlay(def);

    // Final legality gate — illegal cards are rejected here regardless of DeckBuilder
    if (!merged.legal) return null;

    const effectiveCost = Math.max(0, Math.floor(def.base_cost * merged.cost_modifier));

    const card: CardInHand = {
      instanceId:        uuidv4(),
      definition:        def,
      overlay:           merged,
      drawnAtTick,
      isForced:          def.is_forced,
      isHeld:            false,
      isLegendary:       def.rarity === CardRarity.LEGENDARY,
      effectiveCost,
      decisionWindowId:  null,
    };

    return card;
  }

  /**
   * Build the complete merged ModeOverlay for a card.
   * Merge order: mode default → card-specific mode override.
   * Tag weights: additive merge (card-specific adds to mode default, doesn't replace).
   * timing_lock: union of mode-level and card-specific locks.
   */
  public mergeOverlay(def: CardDefinition): ModeOverlay {
    const base = this.defaultOverlay;
    const cardOverride = CARD_MODE_OVERRIDES[def.cardId]?.[this.mode] ?? {};

    // Merge tag_weights: start with mode default, then apply card-specific additions
    const mergedTagWeights: Partial<Record<CardTag, number>> = {
      ...base.tag_weights,
      ...cardOverride.tag_weights,
    };

    // Merge timing_lock: union (card cannot remove mode-level locks)
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
   * Check legality only — faster than full applyOverlay() for validation paths.
   */
  public isLegalInMode(def: CardDefinition): boolean {
    const cardOverride = CARD_MODE_OVERRIDES[def.cardId]?.[this.mode] ?? {};
    return cardOverride.legal ?? this.defaultOverlay.legal;
  }

  /**
   * Get the effective cost of a card in this mode without creating a CardInHand.
   */
  public getEffectiveCost(def: CardDefinition): number {
    const cardOverride = CARD_MODE_OVERRIDES[def.cardId]?.[this.mode] ?? {};
    const modifier = cardOverride.cost_modifier ?? this.defaultOverlay.cost_modifier;
    return Math.max(0, Math.floor(def.base_cost * modifier));
  }

  /**
   * Get tag weight for a specific tag in this mode for a card.
   * Used by CardScorer to compute CORD contribution.
   */
  public getTagWeight(def: CardDefinition, tag: CardTag): number {
    const merged = this.mergeOverlay(def);
    return merged.tag_weights[tag] ?? 1.0;
  }

  public get currentMode(): GameMode {
    return this.mode;
  }
}