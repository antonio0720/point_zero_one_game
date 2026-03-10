/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/cards/CardEffectCompiler.ts
 *
 * Doctrine:
 * - backend is the authoritative effect compiler
 * - overlay-adjusted effect magnitude must be preserved into execution
 * - compilation must be deterministic for the same card instance
 * - no UI-only assumptions are allowed in compiled operations
 */

import type { CardInstance } from '../core/GamePrimitives';

type NumericOperationKind =
  | 'cash'
  | 'income'
  | 'shield'
  | 'heat'
  | 'trust'
  | 'time'
  | 'divergence';

export type CompiledOperation =
  | {
      readonly kind: NumericOperationKind;
      readonly magnitude: number;
    }
  | {
      readonly kind: 'inject';
      readonly magnitude: readonly string[];
    }
  | {
      readonly kind: 'cascadeTag';
      readonly magnitude: string;
    };

const EFFECT_MULTIPLIER_PREFIX = 'effect:';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function parseEffectModifier(tags: readonly string[]): number {
  for (let index = tags.length - 1; index >= 0; index -= 1) {
    const tag = tags[index];
    if (!tag.startsWith(EFFECT_MULTIPLIER_PREFIX)) {
      continue;
    }

    const parsed = Number(tag.slice(EFFECT_MULTIPLIER_PREFIX.length));
    if (!Number.isFinite(parsed)) {
      return 1;
    }

    return clamp(parsed, 0, 10);
  }

  return 1;
}

function scaleMagnitude(
  kind: NumericOperationKind,
  value: number,
  multiplier: number,
): number {
  const scaled = value * multiplier;

  if (kind === 'divergence') {
    return round4(scaled);
  }

  if (kind === 'time') {
    return Math.round(scaled);
  }

  return Math.round(scaled);
}

function pushNumericOperation(
  operations: CompiledOperation[],
  kind: NumericOperationKind,
  value: number | undefined,
  multiplier: number,
): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) {
    return;
  }

  const scaled = scaleMagnitude(kind, value, multiplier);
  if (scaled === 0) {
    return;
  }

  operations.push({
    kind,
    magnitude: scaled,
  });
}

function normalizeInjectedCards(value: readonly string[] | undefined): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [];
  }

  const normalized: string[] = [];

  for (const entry of value) {
    const next = String(entry).trim();
    if (next.length === 0) {
      continue;
    }

    normalized.push(next);
  }

  return normalized;
}

export class CardEffectCompiler {
  public compile(card: CardInstance): CompiledOperation[] {
    const effect = card.card.baseEffect;
    const effectModifier = parseEffectModifier(card.tags);
    const operations: CompiledOperation[] = [];

    pushNumericOperation(operations, 'cash', effect.cashDelta, effectModifier);
    pushNumericOperation(
      operations,
      'income',
      effect.incomeDelta,
      effectModifier,
    );
    pushNumericOperation(
      operations,
      'shield',
      effect.shieldDelta,
      effectModifier,
    );
    pushNumericOperation(operations, 'heat', effect.heatDelta, effectModifier);
    pushNumericOperation(
      operations,
      'trust',
      effect.trustDelta,
      effectModifier,
    );
    pushNumericOperation(
      operations,
      'time',
      effect.timeDeltaMs,
      effectModifier,
    );
    pushNumericOperation(
      operations,
      'divergence',
      effect.divergenceDelta,
      effectModifier,
    );

    if (
      typeof effect.cascadeTag === 'string' &&
      effect.cascadeTag.trim().length > 0
    ) {
      operations.push({
        kind: 'cascadeTag',
        magnitude: effect.cascadeTag.trim(),
      });
    }

    const injectedCards = normalizeInjectedCards(effect.injectCards);
    if (injectedCards.length > 0) {
      operations.push({
        kind: 'inject',
        magnitude: injectedCards,
      });
    }

    return operations;
  }
}