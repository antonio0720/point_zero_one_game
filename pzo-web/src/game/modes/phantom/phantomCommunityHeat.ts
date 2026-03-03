// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/phantom/phantomCommunityHeat.ts
// Sprint 7 — Community Heat Engine (new)
//
// Tracks how many players are concurrently running a given seed.
// Heat multiplier drives: legend decay acceleration, CORD bonus at peak,
// Gap Indicator intensity scaling, spectator pressure on dynasty stack.
//
// At 20M concurrent players a popular seed can be EXTREMELY hot.
// Heat is a server-pushed value — the engine only processes it locally.
//
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import { PHANTOM_CONFIG } from './phantomConfig';

// ── Types ─────────────────────────────────────────────────────────────────────

export type HeatTier =
  | 'COLD'       // 0–coldThreshold players
  | 'WARMING'    // coldThreshold–10% of hotThreshold
  | 'HOT'        // 10–50% of hotThreshold
  | 'VIRAL'      // 50–100% of hotThreshold
  | 'LEGENDARY'; // at or above hotThreshold

export interface CommunityHeatState {
  seed:              number;
  activePlayers:     number;
  heatMultiplier:    number;   // 1.0 baseline → PHANTOM_CONFIG.communityHeatMaxMultiplier
  tier:              HeatTier;
  /** CORD bonus percentage displayed in UI (0–100) */
  cordBonusPct:      number;
  lastRefreshTick:   number;
  /** How many players are currently spectating the active dynasty challenge */
  dynastySpectators: number;
}

export function createHeatState(seed: number): CommunityHeatState {
  return {
    seed,
    activePlayers:     0,
    heatMultiplier:    1.0,
    tier:              'COLD',
    cordBonusPct:      0,
    lastRefreshTick:   0,
    dynastySpectators: 0,
  };
}

// ─── Update (server push) ─────────────────────────────────────────────────────

/**
 * Apply a server-pushed heat update.
 * Call when the server broadcasts player-count for this seed.
 */
export function applyHeatUpdate(
  state: CommunityHeatState,
  activePlayers: number,
  dynastySpectators: number,
  currentTick: number,
): CommunityHeatState {
  const multiplier  = computeHeatMultiplier(activePlayers);
  const tier        = computeHeatTier(activePlayers);
  const cordBonusPct = Math.round((multiplier - 1.0) /
    (PHANTOM_CONFIG.communityHeatMaxMultiplier - 1.0) * 100);

  return {
    ...state,
    activePlayers,
    heatMultiplier:   parseFloat(multiplier.toFixed(3)),
    tier,
    cordBonusPct:     Math.min(100, Math.max(0, cordBonusPct)),
    lastRefreshTick:  currentTick,
    dynastySpectators,
  };
}

// ─── Derived ──────────────────────────────────────────────────────────────────

export function heatTierLabel(tier: HeatTier): string {
  const labels: Record<HeatTier, string> = {
    COLD:      'COLD',
    WARMING:   'WARMING',
    HOT:       'HOT',
    VIRAL:     'VIRAL',
    LEGENDARY: 'LEGENDARY',
  };
  return labels[tier];
}

/**
 * Heat tier badge colors — aligned to designTokens.ts C.*.
 * All verified WCAG AA+ on C.panel (#0D0D1E).
 */
export function heatTierColor(tier: HeatTier): string {
  const colors: Record<HeatTier, string> = {
    COLD:      '#6A6A90',   // C.textDim
    WARMING:   '#4A9EFF',   // C.blue
    HOT:       '#FF9B2F',   // C.orange
    VIRAL:     '#FF4D4D',   // C.red
    LEGENDARY: '#E040FB',   // C.magenta
  };
  return colors[tier];
}

export function formatActivePlayers(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000)     return `${(count / 1_000).toFixed(1)}K`;
  return `${count}`;
}

export function shouldRefreshHeat(state: CommunityHeatState, currentTick: number): boolean {
  return (currentTick - state.lastRefreshTick) >= PHANTOM_CONFIG.communityHeatRefreshIntervalTicks;
}

// ─── Internal ────────────────────────────────────────────────────────────────

function computeHeatMultiplier(activePlayers: number): number {
  const cold = PHANTOM_CONFIG.communityHeatColdThreshold;
  const hot  = PHANTOM_CONFIG.communityHeatHotThreshold;
  const max  = PHANTOM_CONFIG.communityHeatMaxMultiplier;

  if (activePlayers <= cold) return 1.0;
  if (activePlayers >= hot)  return max;

  const t = (activePlayers - cold) / (hot - cold);
  // Smooth curve: ease-in-out
  const eased = t * t * (3 - 2 * t);
  return 1.0 + eased * (max - 1.0);
}

function computeHeatTier(activePlayers: number): HeatTier {
  const hot = PHANTOM_CONFIG.communityHeatHotThreshold;
  if (activePlayers >= hot)          return 'LEGENDARY';
  if (activePlayers >= hot * 0.50)   return 'VIRAL';
  if (activePlayers >= hot * 0.10)   return 'HOT';
  if (activePlayers >= PHANTOM_CONFIG.communityHeatColdThreshold) return 'WARMING';
  return 'COLD';
}
