/**
 * T00475 — proof-hash.test.ts
 * Proof hash tests:
 *   - same inputs = same hash
 *   - different seed = different hash
 *   - ruleset_version change = different hash
 *   - tampered actions = different hash
 *
 * Deploy to: pzo_engine/src/persistence/__tests__/proof-hash.test.ts
 */

import { createHash } from 'crypto';

// ─── Proof Hash Implementation (mirrors engine) ───────────────────────────────
// This mirrors whatever the real engine uses. If your engine exports this,
// import it here instead of duplicating.

interface RunAction {
  tick: number;
  type: string;
  payload: Record<string, unknown>;
  signature?: string;
}

interface ProofHashInput {
  runSeed: string;
  rulesetVersion: string;
  actions: RunAction[];
  finalStateHash: string;
}

function computeProofHash(input: ProofHashInput): string {
  // Deterministic: serialize in canonical order
  const canonical = {
    runSeed: input.runSeed,
    rulesetVersion: input.rulesetVersion,
    actionCount: input.actions.length,
    actionsHash: createHash('sha256')
      .update(JSON.stringify(input.actions.map(a => ({
        tick: a.tick,
        type: a.type,
        payload: a.payload,
        // signature deliberately excluded from action hash (it's outer)
      }))))
      .digest('hex'),
    finalStateHash: input.finalStateHash,
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

// ─── Test Fixtures ────────────────────────────────────────────────────────────

const BASE_SEED = 'pzo_test_seed_abc123';
const BASE_RULESET = '1.3.0';

const BASE_ACTIONS: RunAction[] = [
  { tick: 1, type: 'CARD_DRAW', payload: { deckType: 'OPPORTUNITY', cardId: 'pzo_opportunity_001' } },
  { tick: 2, type: 'ASSET_PURCHASE', payload: { cardId: 'pzo_opportunity_001', cost: 40000, downPayment: 10000 } },
  { tick: 5, type: 'CASHFLOW_TICK', payload: { amount: 1700 } },
  { tick: 8, type: 'MARKET_FLIP', payload: { assetId: 'asset_001', proceeds: 55000, heat: 0.45 } },
];

const BASE_FINAL_STATE_HASH = 'abc123def456';

const BASE_INPUT: ProofHashInput = {
  runSeed: BASE_SEED,
  rulesetVersion: BASE_RULESET,
  actions: BASE_ACTIONS,
  finalStateHash: BASE_FINAL_STATE_HASH,
};

// ─── Minimal test runner ──────────────────────────────────────────────────────

type TestResult = { name: string; passed: boolean; error?: string };
const results: TestResult[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    results.push({ name, passed: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    results.push({ name, passed: false, error: msg });
  }
}

function expect(value: unknown) {
  return {
    toBe(expected: unknown) {
      if (value !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`);
    },
    toEqual(expected: unknown) {
      if (JSON.stringify(value) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`);
      }
    },
    not: {
      toBe(unexpected: unknown) {
        if (value === unexpected) throw new Error(`Expected value to NOT be ${JSON.stringify(unexpected)}`);
      },
    },
    toHaveLength(len: number) {
      if ((value as unknown[]).length !== len) throw new Error(`Expected length ${len}, got ${(value as unknown[]).length}`);
    },
    toMatch(pattern: RegExp) {
      if (!pattern.test(String(value))) throw new Error(`Expected ${String(value)} to match ${pattern}`);
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

// ── Group 1: Determinism ──────────────────────────────────────────────────────

test('same inputs produce the same hash', () => {
  const hash1 = computeProofHash(BASE_INPUT);
  const hash2 = computeProofHash(BASE_INPUT);
  expect(hash1).toBe(hash2);
});

test('same inputs produce same hash across separate calls (idempotency)', () => {
  const results = Array.from({ length: 5 }, () => computeProofHash(BASE_INPUT));
  const unique = new Set(results);
  expect(unique.size).toBe(1);
});

test('hash is a 64-char hex string (SHA-256)', () => {
  const hash = computeProofHash(BASE_INPUT);
  expect(hash).toMatch(/^[a-f0-9]{64}$/);
});

test('action order matters: reversed actions produce a different hash', () => {
  const reversed: ProofHashInput = {
    ...BASE_INPUT,
    actions: [...BASE_ACTIONS].reverse(),
  };
  expect(computeProofHash(BASE_INPUT)).not.toBe(computeProofHash(reversed));
});

// ── Group 2: Seed Sensitivity ─────────────────────────────────────────────────

test('different run seed produces a different hash', () => {
  const differentSeed: ProofHashInput = { ...BASE_INPUT, runSeed: 'pzo_test_seed_DIFFERENT' };
  expect(computeProofHash(BASE_INPUT)).not.toBe(computeProofHash(differentSeed));
});

test('empty seed produces a different hash than non-empty seed', () => {
  const emptySeed: ProofHashInput = { ...BASE_INPUT, runSeed: '' };
  expect(computeProofHash(BASE_INPUT)).not.toBe(computeProofHash(emptySeed));
});

test('seed differing by one character produces a different hash', () => {
  const almostSame: ProofHashInput = {
    ...BASE_INPUT,
    runSeed: BASE_SEED.slice(0, -1) + 'X',
  };
  expect(computeProofHash(BASE_INPUT)).not.toBe(computeProofHash(almostSame));
});

// ── Group 3: Ruleset Version Sensitivity ─────────────────────────────────────

test('different ruleset_version produces a different hash', () => {
  const newRuleset: ProofHashInput = { ...BASE_INPUT, rulesetVersion: '1.4.0' };
  expect(computeProofHash(BASE_INPUT)).not.toBe(computeProofHash(newRuleset));
});

test('minor ruleset version bump changes hash', () => {
  const v1: ProofHashInput = { ...BASE_INPUT, rulesetVersion: '1.3.0' };
  const v2: ProofHashInput = { ...BASE_INPUT, rulesetVersion: '1.3.1' };
  expect(computeProofHash(v1)).not.toBe(computeProofHash(v2));
});

test('major ruleset version bump changes hash', () => {
  const v1: ProofHashInput = { ...BASE_INPUT, rulesetVersion: '1.3.0' };
  const v2: ProofHashInput = { ...BASE_INPUT, rulesetVersion: '2.0.0' };
  expect(computeProofHash(v1)).not.toBe(computeProofHash(v2));
});

// ── Group 4: Action Tampering ─────────────────────────────────────────────────

test('tampered action tick changes the hash', () => {
  const tampered: ProofHashInput = {
    ...BASE_INPUT,
    actions: BASE_ACTIONS.map((a, i) => i === 0 ? { ...a, tick: 999 } : a),
  };
  expect(computeProofHash(BASE_INPUT)).not.toBe(computeProofHash(tampered));
});

test('tampered action type changes the hash', () => {
  const tampered: ProofHashInput = {
    ...BASE_INPUT,
    actions: BASE_ACTIONS.map((a, i) => i === 1 ? { ...a, type: 'EXPLOIT_PURCHASE' } : a),
  };
  expect(computeProofHash(BASE_INPUT)).not.toBe(computeProofHash(tampered));
});

test('tampered action payload changes the hash', () => {
  const tampered: ProofHashInput = {
    ...BASE_INPUT,
    actions: BASE_ACTIONS.map((a, i) =>
      i === 1 ? { ...a, payload: { ...a.payload, cost: 1 } } : a,
    ),
  };
  expect(computeProofHash(BASE_INPUT)).not.toBe(computeProofHash(tampered));
});

test('injected extra action changes the hash', () => {
  const injected: ProofHashInput = {
    ...BASE_INPUT,
    actions: [
      ...BASE_ACTIONS,
      { tick: 99, type: 'FAKE_CASHFLOW', payload: { amount: 9_999_999 } },
    ],
  };
  expect(computeProofHash(BASE_INPUT)).not.toBe(computeProofHash(injected));
});

test('removed action changes the hash', () => {
  const removed: ProofHashInput = {
    ...BASE_INPUT,
    actions: BASE_ACTIONS.slice(0, -1),
  };
  expect(computeProofHash(BASE_INPUT)).not.toBe(computeProofHash(removed));
});

test('empty actions produce a different hash than non-empty actions', () => {
  const empty: ProofHashInput = { ...BASE_INPUT, actions: [] };
  expect(computeProofHash(BASE_INPUT)).not.toBe(computeProofHash(empty));
});

// ── Group 5: Final State Hash Sensitivity ────────────────────────────────────

test('different finalStateHash changes the proof hash', () => {
  const different: ProofHashInput = { ...BASE_INPUT, finalStateHash: 'totally_different_state' };
  expect(computeProofHash(BASE_INPUT)).not.toBe(computeProofHash(different));
});

// ── Group 6: Combined Mutation ────────────────────────────────────────────────

test('changing only one field always changes the hash (property-based spot check)', () => {
  const fields: Array<Partial<ProofHashInput>> = [
    { runSeed: 'altered_seed' },
    { rulesetVersion: '9.9.9' },
    { finalStateHash: 'altered_state' },
  ];
  const baseHash = computeProofHash(BASE_INPUT);
  for (const mutation of fields) {
    const mutated: ProofHashInput = { ...BASE_INPUT, ...mutation };
    expect(computeProofHash(mutated)).not.toBe(baseHash);
  }
});

// ─── Report ───────────────────────────────────────────────────────────────────

function report(): void {
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n══════════════════════════════════════════════');
  console.log(' PROOF HASH TEST REPORT — M46/M48 Compliance');
  console.log('══════════════════════════════════════════════');

  for (const r of results) {
    const mark = r.passed ? '✅' : '❌';
    console.log(`${mark}  ${r.name}`);
    if (!r.passed && r.error) console.log(`     → ${r.error}`);
  }

  console.log('──────────────────────────────────────────────');
  console.log(`Passed: ${passed} / ${results.length}  |  Failed: ${failed}`);

  if (failed > 0) process.exit(1);
}

report();
