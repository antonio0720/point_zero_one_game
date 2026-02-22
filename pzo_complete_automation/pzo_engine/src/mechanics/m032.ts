/**
 * M32 — Liquidity Ladder (Tiered Cash Conversion Strategy)
 * PZO_T00146 | Phase: PZO_P01_ENGINE_UPGRADE
 * File: pzo_engine/src/mechanics/m032.ts
 */

export interface LiquidityTier {
  tier: number;           // 0 = most liquid, 4 = least liquid
  label: string;
  conversionRate: number; // multiplier on face value (0–1)
  penaltyBP: number;      // basis points penalty for forced conversion
  lockTurns: number;      // minimum hold turns before conversion allowed
}

export interface LiquidityLadderState {
  playerId: string;
  holdings: Array<{
    assetId: string;
    tier: number;
    faceValue: number;
    lockedUntilTurn: number;
  }>;
  totalLiquidValue: number;
  liquidityScore: number;  // 0–100
}

export const LIQUIDITY_TIERS: LiquidityTier[] = [
  { tier: 0, label: 'Cash',          conversionRate: 1.00, penaltyBP:   0, lockTurns: 0 },
  { tier: 1, label: 'T-Bill',        conversionRate: 0.98, penaltyBP:  25, lockTurns: 1 },
  { tier: 2, label: 'Bond',          conversionRate: 0.93, penaltyBP:  75, lockTurns: 2 },
  { tier: 3, label: 'Equity',        conversionRate: 0.85, penaltyBP: 150, lockTurns: 3 },
  { tier: 4, label: 'Hard Asset',    conversionRate: 0.70, penaltyBP: 300, lockTurns: 5 },
];

export function computeLiquidityScore(state: LiquidityLadderState, currentTurn: number): number {
  if (state.holdings.length === 0) return 100;
  let weighted = 0;
  let total = 0;
  for (const h of state.holdings) {
    const tier = LIQUIDITY_TIERS[h.tier] ?? LIQUIDITY_TIERS[4];
    const isLocked = currentTurn < h.lockedUntilTurn;
    const effectiveRate = isLocked ? tier.conversionRate * 0.5 : tier.conversionRate;
    weighted += effectiveRate * h.faceValue;
    total += h.faceValue;
  }
  return total === 0 ? 100 : Math.round((weighted / total) * 100);
}

export interface ConversionResult {
  ok: boolean;
  cashReceived: number;
  penaltyPaid: number;
  reason?: string;
}

export function convertAssetToLiquidity(
  state: LiquidityLadderState,
  assetId: string,
  currentTurn: number,
  forced = false
): ConversionResult {
  const idx = state.holdings.findIndex(h => h.assetId === assetId);
  if (idx === -1) return { ok: false, cashReceived: 0, penaltyPaid: 0, reason: 'asset_not_found' };

  const holding = state.holdings[idx];
  const tier = LIQUIDITY_TIERS[holding.tier] ?? LIQUIDITY_TIERS[4];

  if (!forced && currentTurn < holding.lockedUntilTurn) {
    return {
      ok: false,
      cashReceived: 0,
      penaltyPaid: 0,
      reason: `locked_until_turn_${holding.lockedUntilTurn}`,
    };
  }

  const locked = currentTurn < holding.lockedUntilTurn;
  const rate = locked ? tier.conversionRate * 0.5 : tier.conversionRate;
  const penalty = forced && locked
    ? Math.round(holding.faceValue * (tier.penaltyBP / 10000) * 2)
    : Math.round(holding.faceValue * (tier.penaltyBP / 10000));
  const cashReceived = Math.round(holding.faceValue * rate) - penalty;

  state.holdings.splice(idx, 1);
  state.totalLiquidValue = Math.max(0, state.totalLiquidValue - holding.faceValue + cashReceived);
  state.liquidityScore = computeLiquidityScore(state, currentTurn);

  return { ok: true, cashReceived, penaltyPaid: penalty };
}

export function addHolding(
  state: LiquidityLadderState,
  assetId: string,
  tier: number,
  faceValue: number,
  currentTurn: number
): void {
  const t = LIQUIDITY_TIERS[tier] ?? LIQUIDITY_TIERS[4];
  state.holdings.push({
    assetId,
    tier,
    faceValue,
    lockedUntilTurn: currentTurn + t.lockTurns,
  });
  state.totalLiquidValue += faceValue;
  state.liquidityScore = computeLiquidityScore(state, currentTurn);
}

export function getLiquidityWarnings(state: LiquidityLadderState, currentTurn: number): string[] {
  const warnings: string[] = [];
  const score = computeLiquidityScore(state, currentTurn);
  if (score < 30) warnings.push('CRITICAL: Liquidity below 30 — forced liquidation risk');
  if (score < 50) warnings.push('WARNING: Liquidity below 50 — limit new illiquid positions');
  const illiquid = state.holdings.filter(h => h.tier >= 3).length;
  const total = state.holdings.length;
  if (total > 0 && illiquid / total > 0.6) {
    warnings.push('WARNING: >60% of holdings in tier 3+ — ladder imbalanced');
  }
  return warnings;
}
