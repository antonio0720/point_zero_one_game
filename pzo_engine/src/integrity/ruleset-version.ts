/**
 * ruleset-version.ts
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_engine/src/integrity/ruleset-version.ts
 *
 * POINT ZERO ONE — INTEGRITY LAYER RULESET VERSION
 * Density6 LLC · Confidential · Do not distribute
 *
 * Re-exports the canonical ruleset version from the config layer and adds
 * integrity-specific utilities: proof hash compatibility checking, version
 * validation, and per-mode version gates.
 *
 * Source of truth for semver: pzo_engine/src/config/ruleset-version.ts
 * This file MUST NOT redefine or hardcode version strings independently.
 *
 * What changed from the previous integrity/ruleset-version.ts:
 *   ✦ Removed hardcoded `semver: '1.0.0'` — was already stale at Sprint 4.
 *   ✦ Removed ML_MODEL stub — ML state is not part of the ruleset version
 *     contract. ML config lives in its own module; including it here would
 *     break proof hashes across ML flag changes (unrelated to ruleset).
 *   ✦ Added `currentRulesetVersion()` — single-call accessor for the
 *     integrity pipeline; avoids import ambiguity across engine boundary.
 *   ✦ Added `isProofHashVersionCompatible()` — checks the PZO-v* prefix
 *     in the hash version string, not the semver.
 *   ✦ Added `assertRulesetVersionBound()` — throws at startup if the
 *     integrity layer and config layer semvers have diverged.
 */

export {
  RULESET_VERSION,
  isVersionCompatible,
  isProofHashCompatible,
  RULESET_CHANGELOG,
} from '../config/ruleset-version';
export type { RulesetVersion } from '../config/ruleset-version';

import { RULESET_VERSION } from '../config/ruleset-version';
import { PROOF_HASH_VERSION } from './integrity-types';

// ── Current version accessor ──────────────────────────────────────────────────

/**
 * Returns the semver string bound into proof hashes for the current deployment.
 * Call this instead of importing RULESET_VERSION.semver directly — it gives
 * the integrity layer a single stable call site to trace in audits.
 */
export function currentRulesetVersion(): string {
  return RULESET_VERSION.semver;
}

// ── Proof hash algorithm version compatibility ────────────────────────────────

/**
 * Returns true if the hash version string is the current algorithm version.
 * The hash version (e.g. 'PZO-v3') is separate from the ruleset semver —
 * it tracks which field set and field order was used to build the hash payload.
 *
 * Different major ruleset versions may share the same hash algorithm version
 * if only gameplay logic changed and the proof payload schema did not.
 */
export function isCurrentHashVersion(hashVersion: string): boolean {
  return hashVersion === PROOF_HASH_VERSION;
}

/**
 * Returns true if `hashVersion` is a known legacy version this engine can
 * still verify (for backward-compatible leaderboard queries).
 * Expand this list as versions are retired but not yet purged from DB.
 */
export function isLegacyHashVersion(hashVersion: string): boolean {
  const KNOWN_LEGACY = new Set(['PZO-v1', 'PZO-v2']);
  return KNOWN_LEGACY.has(hashVersion);
}

// ── Startup assertion ─────────────────────────────────────────────────────────

/**
 * Assert that the integrity layer and the config layer agree on the current
 * ruleset semver. Throws if they have diverged — this would indicate that
 * `pzo_constants.ts` was updated but the engine restart has not propagated.
 *
 * Call once at server startup in api/server.ts before accepting any requests.
 */
export function assertRulesetVersionBound(expectedSemver: string): void {
  const actual = RULESET_VERSION.semver;
  if (actual !== expectedSemver) {
    throw new Error(
      `[INTEGRITY] Ruleset version mismatch. ` +
      `Expected: ${expectedSemver}, ` +
      `Config layer reports: ${actual}. ` +
      `Restart the server after updating pzo_constants.ts.`,
    );
  }
}

// ── Mode version gates ────────────────────────────────────────────────────────

/**
 * Minimum ruleset semver required for each game mode to be eligible
 * for sovereignty pipeline processing and leaderboard submission.
 *
 * Runs from earlier versions that predate a mode's introduction are
 * recorded but excluded from live leaderboards and proof hash verification.
 */
export const MODE_VERSION_GATES: Record<string, string> = {
  GO_ALONE:       '1.0.0',
  HEAD_TO_HEAD:   '1.2.3',
  TEAM_UP:        '2.0.0',
  CHASE_A_LEGEND: '2.0.0',
} as const;

/**
 * Returns true if a run recorded under `rulesetVersion` is eligible for
 * sovereignty processing in `mode`.
 */
export function isModeEligibleForVersion(mode: string, rulesetVersion: string): boolean {
  const gate = MODE_VERSION_GATES[mode];
  if (!gate) return false;
  return semverGte(rulesetVersion, gate);
}

// ── Private: minimal semver gte ───────────────────────────────────────────────

function semverGte(a: string, b: string): boolean {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const av = aParts[i] ?? 0;
    const bv = bParts[i] ?? 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return true; // equal
}