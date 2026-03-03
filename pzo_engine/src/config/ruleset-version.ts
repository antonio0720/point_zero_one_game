// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE DIGITAL — RULESET VERSION
// pzo_engine/src/config/ruleset-version.ts
//
// Single source of truth for the ruleset version string that is bound into
// every proof hash. Any change to game logic that affects run outcomes MUST
// increment this version. Proof hashes from prior versions are incompatible
// and will fail integrity verification.
//
// VERSION HISTORY:
//   1.0.0 — Sprint 0: Initial 6-deck system, flat card effects
//   1.2.3 — Sprint 4: Mode engines, CORD scoring, sovereignty pipeline
//   2.0.0 — Sprint 8: Full canonical rewrite — 7-engine orchestrator,
//            4-mode system, bleed/psyche/trust/ghost, real CORD scoring,
//            deterministic RNG, proof-hash alignment with pzo-web layer
//
// ── RULES ─────────────────────────────────────────────────────────────────────
//   ✦ Zero imports.
//   ✦ RULESET_VERSION.semver must match RULESET_SEMVER in pzo_constants.ts.
//   ✦ Update CHANGELOG entry when bumping version.
//
// Density6 LLC · Point Zero One · Engine Layer · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import { RULESET_SEMVER, RULESET_GIT_SHA, RULESET_VERSION_STRING } from './pzo_constants';

// ── Ruleset Version Contract ───────────────────────────────────────────────────
export interface RulesetVersion {
  /** Semver of the current ruleset. Binds into every proof hash. */
  semver:      string;
  /** Optional git sha for deterministic build tracking. */
  gitSha?:     string;
  /** Full version string: '<semver>' or '<semver>+<gitsha>'. */
  versionString: string;
}

/** Canonical ruleset version exported for integrity and persistence layers. */
export const RULESET_VERSION: RulesetVersion = {
  semver:        RULESET_SEMVER,
  gitSha:        RULESET_GIT_SHA || undefined,
  versionString: RULESET_VERSION_STRING,
};

// ── Version Comparison Utility ────────────────────────────────────────────────
/**
 * Returns true if `candidate` semver is compatible with `required` semver.
 * Compatible = same major version. Minor/patch differences are allowed.
 * Different major = breaking change = incompatible proof hashes.
 */
export function isVersionCompatible(candidate: string, required: string): boolean {
  const [cMajor] = candidate.split('.').map(Number);
  const [rMajor] = required.split('.').map(Number);
  return cMajor === rMajor;
}

/**
 * Returns true if the given proof hash was produced under a compatible ruleset.
 * Format: '<semver>|<rest_of_hash>'
 */
export function isProofHashCompatible(proofHash: string, currentVersion: string): boolean {
  const prefix = proofHash.split('|')[0];
  if (!prefix) return false;
  return isVersionCompatible(prefix, currentVersion);
}

// ── Version Changelog ─────────────────────────────────────────────────────────
/**
 * Human-readable changelog for version audits.
 * Append-only — never remove entries.
 */
export const RULESET_CHANGELOG: Array<{ version: string; date: string; summary: string }> = [
  {
    version: '1.0.0',
    date:    '2024-01-01',
    summary: 'Initial 6-deck system. Flat card effects. No mode differentiation.',
  },
  {
    version: '1.2.3',
    date:    '2024-06-01',
    summary: 'Mode engines added. CORD scoring v1. Sovereignty pipeline draft.',
  },
  {
    version: '2.0.0',
    date:    '2025-01-01',
    summary: [
      'Full Sprint 8 canonical rewrite.',
      '7-engine orchestrator (Time/Pressure/Tension/Shield/Battle/Cascade/Sovereignty).',
      '4-mode system: Empire (bleed), Predator (psyche), Syndicate (trust), Phantom (ghost).',
      'Real CORD scoring with sovereignty weights.',
      'Deterministic SeededRandom — Math.random() fully removed.',
      'Proof-hash aligned with pzo-web sovereignty layer.',
      'PlayerState replaces legacy GameState/Portfolio split.',
    ].join(' '),
  },
];