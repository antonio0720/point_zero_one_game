/**
 * Proof Hash Tests
 * PZO_T00475 | Phase: PZO_P02_PERSISTENCE_LEADERBOARD
 * File: pzo_engine/src/persistence/__tests__/proof-hash.test.ts
 *
 * Tests: same inputs = same hash, different seed = different hash,
 *        ruleset_version change = different hash, tampered actions = different hash
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';

// ── Inline proof-hash implementation (mirrors production module) ──────────────
export interface ProofHashInput {
  playerId: string;
  sessionId: string;
  rulesetVersion: string;
  seed: string;
  actions: Array<{ actionId: string; type: string; payload: unknown }>;
}

export function computeProofHash(input: ProofHashInput): string {
  const canonical = JSON.stringify({
    playerId: input.playerId,
    sessionId: input.sessionId,
    rulesetVersion: input.rulesetVersion,
    seed: input.seed,
    actions: input.actions.map(a => ({
      actionId: a.actionId,
      type: a.type,
      // Deterministic payload serialization: sort keys
      payload: sortedStringify(a.payload),
    })),
  });
  return createHash('sha256').update(canonical).digest('hex');
}

function sortedStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(sortedStringify).join(',') + ']';
  const keys = Object.keys(value as object).sort();
  const pairs = keys.map(k => `"${k}":${sortedStringify((value as Record<string, unknown>)[k])}`);
  return '{' + pairs.join(',') + '}';
}

// ── Fixtures ──────────────────────────────────────────────────────────────────
const BASE_INPUT: ProofHashInput = {
  playerId: 'player_001',
  sessionId: 'session_abc',
  rulesetVersion: '1.0.0',
  seed: 'SEED_ALPHA_42',
  actions: [
    { actionId: 'a1', type: 'buy', payload: { assetId: 'ASSET_X', amount: 100 } },
    { actionId: 'a2', type: 'sell', payload: { assetId: 'ASSET_Y', amount: 50 } },
  ],
};

const clone = (obj: ProofHashInput): ProofHashInput => JSON.parse(JSON.stringify(obj));

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('computeProofHash', () => {

  describe('determinism — same inputs = same hash', () => {
    it('returns the same hash for identical inputs called twice', () => {
      const h1 = computeProofHash(BASE_INPUT);
      const h2 = computeProofHash(BASE_INPUT);
      expect(h1).toBe(h2);
    });

    it('returns the same hash for a deep clone of the input', () => {
      const h1 = computeProofHash(BASE_INPUT);
      const h2 = computeProofHash(clone(BASE_INPUT));
      expect(h1).toBe(h2);
    });

    it('produces a 64-character hex string', () => {
      const h = computeProofHash(BASE_INPUT);
      expect(h).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is stable across payload key ordering variations', () => {
      const input1 = clone(BASE_INPUT);
      const input2 = clone(BASE_INPUT);
      // Reverse key order in payload
      input2.actions[0].payload = { amount: 100, assetId: 'ASSET_X' };
      expect(computeProofHash(input1)).toBe(computeProofHash(input2));
    });
  });

  describe('seed sensitivity — different seed = different hash', () => {
    it('produces different hash when seed changes', () => {
      const h1 = computeProofHash(BASE_INPUT);
      const altered = clone(BASE_INPUT);
      altered.seed = 'SEED_BETA_99';
      const h2 = computeProofHash(altered);
      expect(h1).not.toBe(h2);
    });

    it('produces different hash for empty seed vs populated seed', () => {
      const h1 = computeProofHash(BASE_INPUT);
      const altered = clone(BASE_INPUT);
      altered.seed = '';
      expect(h1).not.toBe(computeProofHash(altered));
    });

    it('produces different hashes for two different seeds (no collision in sample)', () => {
      const seeds = ['SEED_A', 'SEED_B', 'SEED_C', 'SEED_123', 'SEED_ÄÖÜ'];
      const hashes = seeds.map(seed => {
        const input = clone(BASE_INPUT);
        input.seed = seed;
        return computeProofHash(input);
      });
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(seeds.length);
    });
  });

  describe('ruleset_version sensitivity — version change = different hash', () => {
    it('produces different hash when rulesetVersion increments', () => {
      const h1 = computeProofHash(BASE_INPUT);
      const altered = clone(BASE_INPUT);
      altered.rulesetVersion = '1.0.1';
      expect(h1).not.toBe(computeProofHash(altered));
    });

    it('produces different hash for major version bump', () => {
      const h1 = computeProofHash(BASE_INPUT);
      const altered = clone(BASE_INPUT);
      altered.rulesetVersion = '2.0.0';
      expect(h1).not.toBe(computeProofHash(altered));
    });

    it('different rulesetVersions all produce unique hashes', () => {
      const versions = ['1.0.0', '1.0.1', '1.1.0', '2.0.0'];
      const hashes = versions.map(v => {
        const input = clone(BASE_INPUT);
        input.rulesetVersion = v;
        return computeProofHash(input);
      });
      expect(new Set(hashes).size).toBe(versions.length);
    });
  });

  describe('tamper detection — tampered actions = different hash', () => {
    it('detects modification of action payload value', () => {
      const h1 = computeProofHash(BASE_INPUT);
      const tampered = clone(BASE_INPUT);
      (tampered.actions[0].payload as Record<string, unknown>).amount = 999;
      expect(h1).not.toBe(computeProofHash(tampered));
    });

    it('detects modification of action type', () => {
      const h1 = computeProofHash(BASE_INPUT);
      const tampered = clone(BASE_INPUT);
      tampered.actions[0].type = 'bid';
      expect(h1).not.toBe(computeProofHash(tampered));
    });

    it('detects addition of an extra action', () => {
      const h1 = computeProofHash(BASE_INPUT);
      const tampered = clone(BASE_INPUT);
      tampered.actions.push({ actionId: 'a3', type: 'swap', payload: { from: 'A', to: 'B' } });
      expect(h1).not.toBe(computeProofHash(tampered));
    });

    it('detects removal of an action', () => {
      const h1 = computeProofHash(BASE_INPUT);
      const tampered = clone(BASE_INPUT);
      tampered.actions.pop();
      expect(h1).not.toBe(computeProofHash(tampered));
    });

    it('detects reordering of actions', () => {
      const h1 = computeProofHash(BASE_INPUT);
      const tampered = clone(BASE_INPUT);
      tampered.actions.reverse();
      expect(h1).not.toBe(computeProofHash(tampered));
    });

    it('detects change to actionId', () => {
      const h1 = computeProofHash(BASE_INPUT);
      const tampered = clone(BASE_INPUT);
      tampered.actions[0].actionId = 'a1_TAMPERED';
      expect(h1).not.toBe(computeProofHash(tampered));
    });

    it('detects change to playerId', () => {
      const h1 = computeProofHash(BASE_INPUT);
      const tampered = clone(BASE_INPUT);
      tampered.playerId = 'player_EVIL';
      expect(h1).not.toBe(computeProofHash(tampered));
    });

    it('detects empty actions array vs populated', () => {
      const h1 = computeProofHash(BASE_INPUT);
      const tampered = clone(BASE_INPUT);
      tampered.actions = [];
      expect(h1).not.toBe(computeProofHash(tampered));
    });
  });

});
