/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/cards/CardOverlayResolver.ts
 *
 * Doctrine:
 * - backend owns final card instance materialization
 * - mode overlays must be normalized through backend primitives
 * - weighted tags are metadata, not substitute legality
 * - card instance construction must stay deterministic for replay / proof
 */

import type {
  CardDefinition,
  CardInstance,
  DivergencePotential,
  ModeCode,
  TimingClass,
} from '../core/GamePrimitives';
import {
  createCardInstance,
  resolveModeOverlay,
} from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import { createDeterministicId } from '../core/Deterministic';
import { MODE_TAG_WEIGHTS } from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function toFiniteOrFallback(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    output.push(value);
  }

  return output;
}

function uniqueTimingClasses(values: readonly TimingClass[]): TimingClass[] {
  const seen = new Set<TimingClass>();
  const output: TimingClass[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    output.push(value);
  }

  return output;
}

function countOccurrences(values: readonly string[], target: string): number {
  let count = 0;

  for (const value of values) {
    if (value === target) {
      count += 1;
    }
  }

  return count;
}

function countKnownCardOccurrences(
  snapshot: RunStateSnapshot,
  definitionId: string,
): number {
  let count = 0;

  count += snapshot.cards.hand.filter(
    (card) => card.definitionId === definitionId,
  ).length;

  count += countOccurrences(snapshot.cards.discard, definitionId);
  count += countOccurrences(snapshot.cards.exhaust, definitionId);
  count += countOccurrences(snapshot.cards.drawHistory, definitionId);
  count += countOccurrences(snapshot.cards.lastPlayed, definitionId);

  count += snapshot.cards.ghostMarkers.filter(
    (marker) => marker.cardId === definitionId,
  ).length;

  return count;
}

function buildWeightedTags(
  baseTags: readonly string[],
  mode: ModeCode,
  overlayWeights: Readonly<Record<string, number>>,
): string[] {
  const modeWeights = MODE_TAG_WEIGHTS[mode] as Readonly<Record<string, number>>;
  const mergedWeights: Record<string, number> = {
    ...modeWeights,
    ...overlayWeights,
  };

  const weighted = baseTags.map((tag) => {
    const weight = toFiniteOrFallback(mergedWeights[tag], 1);
    return `${tag}:${round4(weight)}`;
  });

  return uniqueStrings(weighted);
}

function buildTimingClass(
  base: readonly TimingClass[],
  overlayLocks: readonly TimingClass[],
): TimingClass[] {
  return uniqueTimingClasses([...base, ...overlayLocks]);
}

export class CardOverlayResolver {
  public resolve(
    snapshot: RunStateSnapshot,
    card: CardDefinition,
  ): CardInstance {
    const mode = snapshot.mode;
    const overlay = resolveModeOverlay(card, mode);

    const costModifier = clamp(
      toFiniteOrFallback(overlay.costModifier, 1),
      0,
      10,
    );

    const effectModifier = clamp(
      toFiniteOrFallback(overlay.effectModifier, 1),
      0,
      10,
    );

    const timingClass = buildTimingClass(
      card.timingClass,
      overlay.timingLock,
    );

    const weightedTags = buildWeightedTags(
      card.tags,
      mode,
      overlay.tagWeights,
    );

    const occurrenceCount = countKnownCardOccurrences(snapshot, card.id);

    const instanceId = createDeterministicId(
      snapshot.seed,
      'card-instance',
      card.id,
      snapshot.mode,
      snapshot.phase,
      snapshot.tick,
      snapshot.cards.drawPileSize,
      snapshot.cards.drawHistory.length,
      snapshot.cards.hand.length,
      snapshot.cards.discard.length,
      snapshot.cards.exhaust.length,
      snapshot.cards.lastPlayed.length,
      snapshot.battle.sharedOpportunityDeckCursor,
      occurrenceCount,
    );

    return createCardInstance(card, {
      instanceId,
      mode,
      cost: Math.max(0, Math.round(card.baseCost * costModifier)),
      timingClass,
      tags: uniqueStrings([
        ...card.tags,
        ...weightedTags,
        `effect:${round4(effectModifier)}`,
      ]),
      decayTicksRemaining: card.decayTicks ?? null,
      divergencePotential:
        overlay.divergencePotential ?? this.inferDivergence(card, mode),
    });
  }

  private inferDivergence(
    card: CardDefinition,
    mode: ModeCode,
  ): DivergencePotential {
    const explicit = card.baseEffect.divergenceDelta ?? 0;

    if (mode !== 'ghost') {
      if (explicit >= 0.08 || card.rarity === 'LEGENDARY') {
        return 'HIGH';
      }

      if (explicit >= 0.04 || card.rarity === 'RARE') {
        return 'MEDIUM';
      }

      return 'LOW';
    }

    if (
      card.timingClass.includes('GBM') ||
      card.tags.includes('divergence') ||
      explicit >= 0.08
    ) {
      return 'HIGH';
    }

    if (
      card.tags.includes('precision') ||
      card.tags.includes('variance') ||
      explicit > 0
    ) {
      return 'MEDIUM';
    }

    return 'LOW';
  }
}