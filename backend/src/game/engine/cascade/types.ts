/*
 * POINT ZERO ONE — BACKEND CASCADE TYPES
 * /backend/src/game/engine/cascade/types.ts
 *
 * Doctrine:
 * - backend owns authoritative cascade truth
 * - cascade chains must be deterministic, replay-safe, and mode-aware
 * - recovery logic must be explicit, inspectable, and testable
 * - positive cascades are earned state, not cosmetic bonuses
 */

import type { EffectPayload, ModeCode, PressureTier } from '../core/GamePrimitives';

export type CascadeTemplateId =
  | 'LIQUIDITY_SPIRAL'
  | 'CREDIT_FREEZE'
  | 'INCOME_SHOCK'
  | 'NETWORK_LOCKDOWN'
  | 'COMEBACK_SURGE'
  | 'MOMENTUM_ENGINE';

export type CascadeSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type RecoveryCondition =
  | { readonly kind: 'CARD_TAG_ANY'; readonly tags: readonly string[] }
  | { readonly kind: 'LAST_PLAYED_TAG_ANY'; readonly tags: readonly string[] }
  | { readonly kind: 'CASH_MIN'; readonly amount: number }
  | { readonly kind: 'WEAKEST_SHIELD_RATIO_MIN'; readonly ratio: number }
  | { readonly kind: 'ALL_SHIELDS_RATIO_MIN'; readonly ratio: number }
  | { readonly kind: 'TRUST_ANY_MIN'; readonly score: number }
  | { readonly kind: 'HEAT_MAX'; readonly amount: number }
  | { readonly kind: 'PRESSURE_NOT_ABOVE'; readonly tier: PressureTier };

export interface CascadeTemplate {
  readonly templateId: CascadeTemplateId;
  readonly label: string;
  readonly positive: boolean;
  readonly severity: CascadeSeverity;

  /**
   * Used to dedupe semantically identical triggers across repeated event bursts.
   */
  readonly dedupeKey: string;

  /**
   * Max simultaneously-active instances of this template.
   */
  readonly maxConcurrent: number;

  /**
   * Max times this template may be started from the same trigger family in a run.
   */
  readonly maxTriggersPerRun: number;

  /**
   * Relative schedule offsets from the activation tick.
   * Must match the length/order of `effects`.
   */
  readonly baseOffsets: readonly number[];

  /**
   * Per-link effects, already aligned to `baseOffsets`.
   */
  readonly effects: readonly EffectPayload[];

  /**
   * Legacy compatibility surface retained because chain instances in
   * GamePrimitives currently store `recoveryTags`.
   */
  readonly recoveryTags: readonly string[];

  /**
   * Structured authoritative recovery logic.
   */
  readonly recovery: readonly RecoveryCondition[];

  /**
   * Positive values accelerate the chain in a mode.
   */
  readonly modeOffsetModifier?: Partial<Record<ModeCode, number>>;

  /**
   * Scales numeric effects by pressure tier.
   */
  readonly pressureScalar?: Partial<Record<PressureTier, number>>;

  readonly notes?: readonly string[];
}