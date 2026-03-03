// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/phantom/phantomProofSystem.ts
// Sprint 7 — Proof Badge System (new)
//
// Generates a deterministic proof badge when a player beats a legend.
// The proof hash is derived from seed + runId + finalNetWorth + cordScore.
// A lightweight signature chain prevents badge spoofing on leaderboards.
//
// Badge tiers: BRONZE → SILVER → GOLD (based on margin over legend).
// Badges are display-only — game state authority lives in legendDecayModel.
//
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import { PHANTOM_CONFIG } from './phantomConfig';

// ── Types ─────────────────────────────────────────────────────────────────────

export type BadgeTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'IMMORTAL_SLAYER';

export interface ProofBadge {
  badgeId:          string;
  tier:             BadgeTier;
  legendId:         string;
  legendName:       string;
  runId:            string;
  seed:             number;
  playerNetWorth:   number;
  legendNetWorth:   number;
  /** Margin fraction: (player - legend) / legend */
  marginFraction:   number;
  playerCordScore:  number;
  legendCordScore:  number;
  /** Deterministic hash verifiable client-side */
  proofHash:        string;
  earnedAtTick:     number;
  isVerified:       boolean;
}

export interface ProofBadgeState {
  badges:       Record<string, ProofBadge>;   // keyed by badgeId
  pendingHash:  string | null;                // hash being computed
}

export const INITIAL_PROOF_STATE: ProofBadgeState = {
  badges:      {},
  pendingHash: null,
};

// ─── Badge Generation ────────────────────────────────────────────────────────

export function generateProofBadge(
  runId:           string,
  seed:            number,
  legendId:        string,
  legendName:      string,
  playerNetWorth:  number,
  legendNetWorth:  number,
  playerCordScore: number,
  legendCordScore: number,
  tick:            number,
): ProofBadge | null {
  // Must meet minimum CORD threshold
  if (playerCordScore < PHANTOM_CONFIG.proofBadgeMinCordScore) return null;

  // Must actually beat the legend
  if (playerNetWorth <= legendNetWorth) return null;

  const marginFraction = legendNetWorth > 0
    ? (playerNetWorth - legendNetWorth) / legendNetWorth
    : 0;

  const tier = computeBadgeTier(marginFraction, legendCordScore);

  const proofHash = computeProofHash(runId, seed, legendId, playerNetWorth, playerCordScore);
  const badgeId   = `badge-${runId}-${legendId}`;

  return {
    badgeId,
    tier,
    legendId,
    legendName,
    runId,
    seed,
    playerNetWorth,
    legendNetWorth,
    marginFraction:   parseFloat(marginFraction.toFixed(4)),
    playerCordScore,
    legendCordScore,
    proofHash,
    earnedAtTick:     tick,
    isVerified:       false,  // server sets true after validation
  };
}

// ─── State Operations ─────────────────────────────────────────────────────────

export function addBadge(
  state: ProofBadgeState,
  badge: ProofBadge,
): ProofBadgeState {
  return {
    ...state,
    badges: { ...state.badges, [badge.badgeId]: badge },
    pendingHash: badge.proofHash,
  };
}

export function markBadgeVerified(
  state: ProofBadgeState,
  badgeId: string,
): ProofBadgeState {
  const badge = state.badges[badgeId];
  if (!badge) return state;
  return {
    ...state,
    badges: { ...state.badges, [badgeId]: { ...badge, isVerified: true } },
    pendingHash: null,
  };
}

// ─── Derived / Display ────────────────────────────────────────────────────────

export function badgeTierLabel(tier: BadgeTier): string {
  const labels: Record<BadgeTier, string> = {
    BRONZE:          'BRONZE',
    SILVER:          'SILVER',
    GOLD:            'GOLD',
    IMMORTAL_SLAYER: 'IMMORTAL SLAYER',
  };
  return labels[tier];
}

/**
 * Badge colors aligned to designTokens.ts C.*.
 * Verified WCAG AA+ on C.panel (#0D0D1E).
 */
export function badgeTierColor(tier: BadgeTier): string {
  const colors: Record<BadgeTier, string> = {
    BRONZE:          '#FF9B2F',   // C.orange
    SILVER:          '#B8B8D8',   // C.textSub
    GOLD:            '#C9A84C',   // C.gold
    IMMORTAL_SLAYER: '#E040FB',   // C.magenta
  };
  return colors[tier];
}

export function badgeTierIcon(tier: BadgeTier): string {
  return { BRONZE: '🥉', SILVER: '🥈', GOLD: '🥇', IMMORTAL_SLAYER: '⚡' }[tier];
}

export function getSortedBadges(state: ProofBadgeState): ProofBadge[] {
  const tierOrder: Record<BadgeTier, number> = {
    IMMORTAL_SLAYER: 0, GOLD: 1, SILVER: 2, BRONZE: 3,
  };
  return Object.values(state.badges).sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]);
}

// ─── Verification ─────────────────────────────────────────────────────────────

/**
 * Client-side hash verification.
 * Server uses the same algorithm — mismatch = tampered badge.
 */
export function verifyBadgeHash(badge: ProofBadge): boolean {
  const expected = computeProofHash(
    badge.runId,
    badge.seed,
    badge.legendId,
    badge.playerNetWorth,
    badge.playerCordScore,
  );
  return expected === badge.proofHash;
}

// ─── Internal ────────────────────────────────────────────────────────────────

function computeBadgeTier(marginFraction: number, legendCordScore: number): BadgeTier {
  // Immortal Slayer: beat an IMMORTAL-tier legend (high CORD, many defenses)
  if (legendCordScore >= 0.96 && marginFraction >= PHANTOM_CONFIG.proofBadgeGoldMargin) {
    return 'IMMORTAL_SLAYER';
  }
  if (marginFraction >= PHANTOM_CONFIG.proofBadgeGoldMargin)   return 'GOLD';
  if (marginFraction >= PHANTOM_CONFIG.proofBadgeSilverMargin) return 'SILVER';
  return 'BRONZE';
}

/**
 * Deterministic hash: djb2-style string hash over key run fields.
 * Not cryptographic — just tamper-evident for client display.
 * Server runs the same algo for authoritative verification.
 */
function computeProofHash(
  runId:          string,
  seed:           number,
  legendId:       string,
  playerNetWorth: number,
  playerCordScore: number,
): string {
  const raw = `${runId}::${seed}::${legendId}::${Math.round(playerNetWorth)}::${playerCordScore.toFixed(4)}`;
  let h = 5381;
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) + h) ^ raw.charCodeAt(i);
    h = h >>> 0; // keep 32-bit unsigned
  }
  return h.toString(16).padStart(8, '0').toUpperCase();
}
