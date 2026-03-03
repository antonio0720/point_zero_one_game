// ============================================================
// POINT ZERO ONE DIGITAL — Portfolio / Financial State Engine
// Sprint 8 / Phase 1 Upgrade
//
// Renamed purpose: this engine manages a player's full financial
// picture — cash, assets, liabilities, net worth — rather than
// the old trading position model (which doesn't match PZO gameplay).
//
// The old Position / open-position / P&L system has been removed.
// PortfolioEngine now tracks OwnedAssets, applies card economics,
// computes net worth, and handles forced-sale mechanics.
//
// Deploy to: pzo_engine/src/engine/portfolio-engine.ts
// ============================================================

import { createHash }  from 'crypto';
import type { PlayerState, OwnedAsset } from './player-state';
import { applyCashDelta, recalcCashflow } from './player-state';

// ─── ACQUISITION RESULT ───────────────────────────────────────
export interface AcquisitionResult {
  success:     boolean;
  reason?:     'INSUFFICIENT_CASH' | 'LEVERAGE_BLOCKED' | 'CREDIT_TOO_TIGHT';
  state:       PlayerState;
  asset?:      OwnedAsset;
  auditHash:   string;
}

// ─── DISPOSITION RESULT ───────────────────────────────────────
export interface DispositionResult {
  success:     boolean;
  reason?:     'ASSET_NOT_FOUND';
  state:       PlayerState;
  proceeds:    number;
  gain:        number;   // proceeds - originalCost
  auditHash:   string;
}

// ─── PORTFOLIO ENGINE ─────────────────────────────────────────
export class PortfolioEngine {

  /**
   * Acquire an asset (player plays OPPORTUNITY or IPA card).
   * Validates cash. Deducts cost. Adds OwnedAsset. Recomputes net worth.
   */
  acquire(
    state:       PlayerState,
    assetData:   Omit<OwnedAsset, 'auditHash'>,
    tick:        number,
  ): AcquisitionResult {
    const auditHash = this._assetHash(assetData, tick);

    if (assetData.originalCost > state.cash) {
      return { success: false, reason: 'INSUFFICIENT_CASH', state, auditHash };
    }
    if (state.leverageBlocks > 0 && assetData.currentDebt > 0) {
      return { success: false, reason: 'LEVERAGE_BLOCKED', state, auditHash };
    }

    const asset: OwnedAsset = { ...assetData, auditHash };
    let next = applyCashDelta(state, -assetData.originalCost);
    next = {
      ...next,
      ownedAssets: [...next.ownedAssets, asset],
    };
    next = recalcCashflow(next);

    return { success: true, state: next, asset, auditHash };
  }

  /**
   * Dispose of an asset (sell / liquidate).
   * Computes proceeds at current market value (midpoint of exit range).
   */
  dispose(
    state:   PlayerState,
    assetId: string,
    tick:    number,
    forced = false, // forced sale = 70% of min exit value
  ): DispositionResult {
    const assetIdx = state.ownedAssets.findIndex(a => a.assetId === assetId);
    const auditHash = createHash('sha256')
      .update(`${assetId}|${tick}|${forced}`)
      .digest('hex').slice(0, 16);

    if (assetIdx === -1) {
      return { success: false, reason: 'ASSET_NOT_FOUND', state, proceeds: 0, gain: 0, auditHash };
    }

    const asset    = state.ownedAssets[assetIdx];
    const midpoint = (asset.exitMin + asset.exitMax) / 2;
    const proceeds = forced
      ? asset.exitMin * 0.70   // forced sale haircut
      : midpoint - asset.currentDebt;

    const gain       = proceeds - asset.originalCost;
    const remaining  = state.ownedAssets.filter(a => a.assetId !== assetId);
    let next         = applyCashDelta(state, Math.max(0, proceeds));
    next             = { ...next, ownedAssets: remaining };
    next             = recalcCashflow(next);

    return { success: true, state: next, proceeds, gain, auditHash };
  }

  /**
   * Apply monthly cashflow tick.
   * Called by TurnEngine every ~60 ticks (one in-game month).
   * Returns updated state with cash adjusted for net cashflow.
   */
  applyMonthlyCashflow(state: PlayerState): PlayerState {
    // Net cashflow can be negative (debt servicing exceeds income)
    return applyCashDelta(state, state.netCashflow);
  }

  /**
   * Compute full net worth snapshot.
   * NetWorth = cash + Σ(asset midpoint exit) - Σ(debts)
   */
  computeNetWorth(state: PlayerState): number {
    const assetValue = state.ownedAssets.reduce(
      (sum, a) => sum + (a.exitMin + a.exitMax) / 2,
      0,
    );
    const totalDebt = state.ownedAssets.reduce(
      (sum, a) => sum + a.currentDebt,
      0,
    );
    return state.cash + assetValue - totalDebt;
  }

  /**
   * Apply inflation erosion to cash (not assets — assets are inflation-hedged).
   * Called by MacroEngine each tick when inflation is active.
   */
  applyInflationErosion(state: PlayerState, erosionRate: number): PlayerState {
    if (erosionRate <= 0) return state;
    const erosion = state.cash * erosionRate;
    return applyCashDelta(state, -erosion);
  }

  /**
   * Bankruptcy check — returns true if player is bankrupt.
   * Bankrupt = cash ≤ 0 AND net worth ≤ 0.
   */
  isBankrupt(state: PlayerState): boolean {
    if (state.cash > 0) return false;
    return this.computeNetWorth(state) <= 0;
  }

  /**
   * Forced liquidation — sell all assets at 70% exit min.
   * Called when SolvencyEngine triggers bankruptcy event.
   */
  forceFullLiquidation(state: PlayerState, tick: number): PlayerState {
    let current = state;
    for (const asset of [...state.ownedAssets]) {
      const result = this.dispose(current, asset.assetId, tick, true);
      current = result.state;
    }
    return current;
  }

  // ─── PRIVATE ────────────────────────────────────────────────
  private _assetHash(asset: Omit<OwnedAsset, 'auditHash'>, tick: number): string {
    const payload = `${asset.assetId}|${asset.cardId}|${asset.originalCost}|${tick}`;
    return createHash('sha256').update(payload).digest('hex').slice(0, 16);
  }
}