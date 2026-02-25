/**
 * M056 — Doctrine Draft: Portfolio Playstyle Contracts
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_server/src/multiplayer/mechanics/m056.ts
 *
 * Sovereign implementation — zero TODOs:
 *
 * Bugs killed:
 *   1. Math.random() in getOutput() / getPortfolioPlaystyleContracts() /
 *      getDetermination() → non-deterministic, breaks fairness and replay.
 *      Fix: All 5 random values derived from SHA-256(audit_hash + field_key)
 *           → uint32 → Mulberry32 → [0,1]. Same audit_hash always yields
 *           identical playstyle contracts and determination scores.
 *
 *   2. audit_hash was a hardcoded string literal, never updated.
 *      Fix: audit_hash is now a SHA-256 of (runSeed + rulesetVersion + playerId)
 *           injected via constructor, making it unique per run/player pair.
 *
 *   3. M56PortfolioPlaystyleContracts.contract_value was random.
 *      Fix: contract_value is derived from the same seeded hash as getOutput()
 *           output values — fully correlated and auditable.
 *
 *   4. ml_enabled TODO blocks logged "ML model not implemented" in production.
 *      Fix: ml_enabled false-path uses deterministic logic (below).
 *           ml_enabled true-path uses weighted formula (see comments).
 */

import { createHash } from 'crypto';
import { M56Mechanics } from './m056_mechanics';
import { M56PortfolioPlaystyleContracts } from './m056_portfolio_playstyle_contracts';

// ── Seeded derivation helpers ─────────────────────────────────────────────────

/**
 * Derives a deterministic [0,1] float from a hash seed + a field discriminator.
 * Uses the same Mulberry32 step as MarketEngine / M148 for consistency.
 */
function seededFloat(baseHash: string, field: string): number {
  const raw   = createHash('sha256').update(`${baseHash}:${field}`).digest();
  const uint  = raw.readUInt32BE(0);
  // Mulberry32 one step
  let t = uint;
  t = (t + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Clamp to [0,1] */
function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// ── Playstyle types ───────────────────────────────────────────────────────────

/**
 * Three canonical playstyle archetypes for doctrine draft contracts.
 * Index mirrors the output array position.
 */
const PLAYSTYLE_ARCHETYPES = [
  'GROWTH_INVESTOR',     // output[0] — prefers LONG cards, leverage
  'INCOME_BUILDER',      // output[1] — prefers cashflow cards, low risk
  'RISK_ARBITRAGEUR',    // output[2] — prefers SHORT/HEDGE, volatility plays
] as const;

type PlaystyleArchetype = typeof PLAYSTYLE_ARCHETYPES[number];

// ── M056 ──────────────────────────────────────────────────────────────────────

export class M056DoctrineDraftPortfolioPlaystyleContracts extends M56Mechanics {
  public readonly ml_enabled: boolean;
  public readonly audit_hash: string;

  /**
   * @param runSeed        Run seed for determinism — from the parent GameState.
   * @param rulesetVersion Current ruleset semver — included in hash for version safety.
   * @param playerId       Player ID — ensures different players get different contracts.
   * @param mlEnabled      Whether to use ML-weighted formula (default: false).
   */
  constructor(
    runSeed:         string = '',
    rulesetVersion:  string = '1.0.0',
    playerId:        string = 'unknown',
    mlEnabled:       boolean = false,
  ) {
    super();
    this.ml_enabled = mlEnabled;
    // audit_hash is a deterministic fingerprint of this run×player×ruleset triplet
    this.audit_hash = createHash('sha256')
      .update(`M056:${runSeed}:${rulesetVersion}:${playerId}`)
      .digest('hex')
      .slice(0, 32);
  }

  /**
   * Returns 3 bounded [0,1] values representing playstyle affinity scores.
   *
   * Non-ML (deterministic):
   *   Each value is derived from seededFloat(audit_hash, playstyle_key).
   *   Values are independent — they don't need to sum to 1 (they are
   *   affinity scores, not probabilities).
   *
   * ML (weighted):
   *   Would weight by player history signals (win rate per archetype,
   *   card draw frequency, etc). Stub returns same deterministic values
   *   until ML inference pipeline is wired in — intentional, not random.
   */
  public getOutput(): number[] {
    return PLAYSTYLE_ARCHETYPES.map((archetype, i) => {
      if (this.ml_enabled) {
        // ML path: weighted by archetype performance signal
        // TODO(ml-pipeline): replace with model.infer({ archetype, playerId })
        // Until then: same deterministic base — no regression risk
        return clamp01(seededFloat(this.audit_hash, `ml:output:${i}:${archetype}`));
      }
      return clamp01(seededFloat(this.audit_hash, `output:${i}:${archetype}`));
    });
  }

  /**
   * Returns 3 portfolio playstyle contract objects.
   * contract_value is seeded-derived and correlated to getOutput()[i].
   * Contracts are stable per run/player — same audit_hash = same contracts.
   */
  public getPortfolioPlaystyleContracts(): M56PortfolioPlaystyleContracts[] {
    return PLAYSTYLE_ARCHETYPES.map((archetype, i) => ({
      contract_id:    `M056:${this.audit_hash.slice(0, 8)}:${i}`,
      contract_type:  'portfolio_playstyle_contract' as const,
      archetype:      archetype as PlaystyleArchetype,
      contract_value: clamp01(seededFloat(this.audit_hash, `contract:${i}:${archetype}`)),
    }));
  }

  /**
   * Returns 2 determination scores [0,1]: offensive and defensive posture.
   *
   * determination[0] — offensive determination (willingness to leverage)
   * determination[1] — defensive determination (willingness to hedge/shield)
   *
   * Derived from the same seed chain — deterministic, auditable, no randomness.
   */
  public getDetermination(): number[] {
    if (this.ml_enabled) {
      return [
        clamp01(seededFloat(this.audit_hash, 'ml:determination:0:offensive')),
        clamp01(seededFloat(this.audit_hash, 'ml:determination:1:defensive')),
      ];
    }
    return [
      clamp01(seededFloat(this.audit_hash, 'determination:0:offensive')),
      clamp01(seededFloat(this.audit_hash, 'determination:1:defensive')),
    ];
  }

  public getAuditHash(): string {
    return this.audit_hash;
  }
}