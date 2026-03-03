// ============================================================
// POINT ZERO ONE DIGITAL — Solvency Engine (Wipe Checker)
// Sprint 8 / Phase 1 Upgrade
//
// Determines when a player is bankrupt and initiates the
// bankruptcy event with forensic fields for replay verification.
//
// CHANGES FROM SPRINT 0:
//   - Fixed: global browser crypto reference -> proper Node import
//   - Removed ML stub branch (dead code)
//   - Integrated with PlayerState (not raw cash/netWorth params)
//   - Emits structured WipeEvent instead of console.log
//   - Added cascade wipe detection (5-tick rolling negative window)
//
// Deploy to: pzo_engine/src/engine/wipe-checker.ts
// ============================================================

import { createHash } from 'crypto';
import type { PlayerState } from './player-state';

export interface WipeEvent {
  type:           'BANKRUPTCY' | 'BLEED_TERMINAL' | 'CASCADE_WIPE';
  cause:          string;
  tick:           number;
  cashAtWipe:     number;
  netWorthAtWipe: number;
  debtShortfall:  number;
  auditHash:      string;
}

const WIPE_THRESHOLDS = {
  CRITICAL_CASH:   0,
  CRITICAL_NW:     -100_000,
  FORCED_SALE_PCT: 0.70,
} as const;

export class SolvencyEngine {
  private wipeEmitted:       boolean = false;
  private negativeTickCount: number  = 0;

  check(state: PlayerState, tick: number): WipeEvent | null {
    if (this.wipeEmitted) return null;

    const forcedSaleValue = this._estimateForcedSaleValue(state);
    const effectiveNW     = state.cash + forcedSaleValue;

    if (state.cash < 0) {
      this.negativeTickCount++;
    } else {
      this.negativeTickCount = 0;
    }

    if (
      state.cash <= WIPE_THRESHOLDS.CRITICAL_CASH &&
      effectiveNW <= WIPE_THRESHOLDS.CRITICAL_NW
    ) {
      return this._emitWipe('BANKRUPTCY', 'Cash exhausted and net worth irrecoverable', state, tick, effectiveNW);
    }

    if (this.negativeTickCount >= 5 && state.cash <= WIPE_THRESHOLDS.CRITICAL_CASH) {
      return this._emitWipe('CASCADE_WIPE', 'Sustained negative cash — cascade failure', state, tick, effectiveNW);
    }

    if (state.bleedSeverity === 'TERMINAL' && state.cash <= WIPE_THRESHOLDS.CRITICAL_CASH) {
      return this._emitWipe('BLEED_TERMINAL', 'Bleed Mode terminal + zero cash', state, tick, effectiveNW);
    }

    return null;
  }

  private _estimateForcedSaleValue(state: PlayerState): number {
    return state.ownedAssets.reduce((sum, asset) => {
      const saleValue = asset.exitMin * WIPE_THRESHOLDS.FORCED_SALE_PCT;
      return sum + Math.max(0, saleValue - asset.currentDebt);
    }, 0);
  }

  private _emitWipe(
    type:        WipeEvent['type'],
    cause:       string,
    state:       PlayerState,
    tick:        number,
    effectiveNW: number,
  ): WipeEvent {
    this.wipeEmitted = true;
    const debtShortfall = Math.max(0, -effectiveNW);
    const auditHash     = createHash('sha256')
      .update(`${type}|${tick}|${state.cash}|${effectiveNW}|${state.playerId}`)
      .digest('hex');
    return { type, cause, tick, cashAtWipe: state.cash, netWorthAtWipe: effectiveNW, debtShortfall, auditHash };
  }

  reset(): void {
    this.wipeEmitted       = false;
    this.negativeTickCount = 0;
  }
}