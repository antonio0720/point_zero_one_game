/*
 * POINT ZERO ONE — BACKEND ENGINE TESTS
 * /backend/src/game/engine/cards/__tests__/types.spec.ts
 *
 * Doctrine:
 * - exported card scoring helpers must be deterministic
 * - weight maps should remain aligned with backend primitive deck taxonomy
 * - mode ranking should reinforce doctrinal play, not random ordering
 */

import { describe, expect, it } from 'vitest';

import { DECK_TYPES } from '../../core/GamePrimitives';
import { CardRegistry } from '../CardRegistry';
import {
  ALL_DECK_TYPES,
  getModeDeckPriority,
  getModeTagWeight,
  scoreCardForMode,
} from '../types';

describe('cards/types', () => {
  const registry = new CardRegistry();

  it('keeps ALL_DECK_TYPES aligned with backend primitive deck taxonomy', () => {
    expect(ALL_DECK_TYPES).toEqual(DECK_TYPES);
  });

  it('returns explicit tag weights and falls back to 1 for unknown tags', () => {
    expect(getModeTagWeight('solo', 'scale')).toBe(2.5);
    expect(getModeTagWeight('coop', 'trust')).toBe(3.0);
    expect(getModeTagWeight('ghost', 'unknown_tag')).toBe(1);
  });

  it('returns deterministic deck priorities by mode', () => {
    expect(getModeDeckPriority('pvp', 'SABOTAGE')).toBeLessThan(
      getModeDeckPriority('pvp', 'PRIVILEGED'),
    );
    expect(getModeDeckPriority('ghost', 'GHOST')).toBeLessThan(
      getModeDeckPriority('ghost', 'DISCIPLINE'),
    );
    expect(getModeDeckPriority('coop', 'TRUST')).toBeLessThan(
      getModeDeckPriority('coop', 'SO'),
    );
  });

  it('scores pvp sabotage doctrine above low-pressure sabotage cards', () => {
    const hostileTakeover = registry.require('HOSTILE_TAKEOVER');
    const chainRumor = registry.require('CHAIN_RUMOR');

    expect(scoreCardForMode(hostileTakeover, 'pvp')).toBeGreaterThan(
      scoreCardForMode(chainRumor, 'pvp'),
    );
  });

  it('scores ghost legend-line cards above lower-order ghost exploitation cards', () => {
    const counterLegend = registry.require('COUNTER_LEGEND_LINE');
    const ghostPass = registry.require('GHOST_PASS_EXPLOIT');

    expect(scoreCardForMode(counterLegend, 'ghost')).toBeGreaterThan(
      scoreCardForMode(ghostPass, 'ghost'),
    );
  });

  it('scores legendary systemic resets above routine privileged growth in solo', () => {
    const override = registry.require('SYSTEMIC_OVERRIDE');
    const networkCall = registry.require('NETWORK_CALL');

    expect(scoreCardForMode(override, 'solo')).toBeGreaterThan(
      scoreCardForMode(networkCall, 'solo'),
    );
  });

  it('penalizes otherwise similar cards with higher base cost', () => {
    const breakPact = registry.require('BREAK_PACT');
    const silentExit = registry.require('SILENT_EXIT');

    expect(scoreCardForMode(breakPact, 'coop')).toBeGreaterThanOrEqual(
      scoreCardForMode(silentExit, 'coop'),
    );
  });
});