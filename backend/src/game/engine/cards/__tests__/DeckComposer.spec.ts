/*
 * POINT ZERO ONE — BACKEND ENGINE TESTS
 * /backend/src/game/engine/cards/__tests__/DeckComposer.spec.ts
 *
 * Doctrine:
 * - deck composition must be deterministic
 * - mode output must respect backend legality and doctrine ordering
 * - buckets and limited deck slices must remain stable under replay
 */

import { describe, expect, it } from 'vitest';

import type { DeckType } from '../../core/GamePrimitives';
import { CardRegistry } from '../CardRegistry';
import { DeckComposer } from '../DeckComposer';

describe('DeckComposer', () => {
  const registry = new CardRegistry();
  const composer = new DeckComposer(registry);

  function deckTypesFor(ids: readonly string[]): DeckType[] {
    return ids.map((id) => registry.require(id).deckType);
  }

  it('returns only solo-legal cards for solo mode', () => {
    const soloDeck = composer.byMode('solo');

    expect(soloDeck).toContain('MOMENTUM_PIVOT');
    expect(soloDeck).toContain('FORTIFY_ORDER');
    expect(soloDeck).toContain('VARIANCE_LOCK');

    expect(soloDeck).not.toContain('CHAIN_RUMOR');
    expect(soloDeck).not.toContain('BREAK_PACT');
    expect(soloDeck).not.toContain('MARKER_EXPLOIT');
  });

  it('orders pvp output by doctrine, placing sabotage cards at the front', () => {
    const pvpDeck = composer.byMode('pvp');
    const leadingDeckTypes = deckTypesFor(pvpDeck.slice(0, 4));

    expect(leadingDeckTypes).toEqual([
      'SABOTAGE',
      'SABOTAGE',
      'SABOTAGE',
      'SABOTAGE',
    ]);

    expect(pvpDeck.slice(0, 4)).toEqual([
      'HOSTILE_TAKEOVER',
      'REGULATORY_FILING',
      'MEDIA_BLITZ',
      'CHAIN_RUMOR',
    ]);
  });

  it('orders coop output with trust doctrine ahead of privileged economy cards', () => {
    const coopDeck = composer.byMode('coop');

    expect(coopDeck.slice(0, 3)).toEqual([
      'ASSET_SEIZURE',
      'BREAK_PACT',
      'SILENT_EXIT',
    ]);

    expect(deckTypesFor(coopDeck.slice(0, 3))).toEqual([
      'TRUST',
      'TRUST',
      'TRUST',
    ]);
  });

  it('returns ghost buckets in deterministic score order', () => {
    const buckets = composer.byModeBuckets('ghost');

    expect(buckets.GHOST).toEqual([
      'COUNTER_LEGEND_LINE',
      'MARKER_EXPLOIT',
      'GHOST_PASS_EXPLOIT',
    ]);

    expect(buckets.SABOTAGE).toEqual([]);
    expect(buckets.TRUST).toEqual([]);
  });

  it('returns full definitions in the same order as byMode ids', () => {
    const ids = composer.byMode('ghost');
    const definitions = composer.byModeDefinitions('ghost');

    expect(definitions.map((card) => card.id)).toEqual(ids);
  });

  it('creates deterministic limited decks by slicing the ranked mode deck', () => {
    const limited = composer.composeLimitedDeck('ghost', 2);
    const full = composer.byMode('ghost');

    expect(limited).toEqual(full.slice(0, 2));
    expect(limited).toEqual(['COUNTER_LEGEND_LINE', 'MARKER_EXPLOIT']);
  });

  it('contains() reflects mode legality for specific cards', () => {
    expect(composer.contains('pvp', 'CHAIN_RUMOR')).toBe(true);
    expect(composer.contains('solo', 'CHAIN_RUMOR')).toBe(false);
    expect(composer.contains('ghost', 'MARKER_EXPLOIT')).toBe(true);
    expect(composer.contains('coop', 'MARKER_EXPLOIT')).toBe(false);
  });
});