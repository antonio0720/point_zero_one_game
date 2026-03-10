/*
 * POINT ZERO ONE — BACKEND ENGINE 15X GENERATOR
 * Generated at: 2026-03-10T01:00:08.825776+00:00
 *
 * Doctrine:
 * - backend becomes the authoritative simulation surface
 * - seven engines remain distinct
 * - mode-native rules are enforced at runtime
 * - cards are backend-validated, not UI-trusted
 * - proof / integrity / CORD remain backend-owned
 */

import type { RunStateSnapshot } from '../core/RunStateSnapshot';

export class PressureSignalCollector {
  public collect(snapshot: RunStateSnapshot): number {
    const cashStress = snapshot.economy.cash <= 0 ? 35 : snapshot.economy.cash < 3000 ? 24 : snapshot.economy.cash < 10000 ? 12 : 0;
    const cashflowDelta = snapshot.economy.expensesPerTick - snapshot.economy.incomePerTick;
    const cashflowStress = cashflowDelta > 0 ? Math.min(20, Math.ceil(cashflowDelta / 250)) : 0;
    const averageShieldPct = snapshot.shield.layers.reduce((sum, layer) => sum + layer.current / layer.max, 0) / snapshot.shield.layers.length;
    const shieldStress = Math.round((1 - averageShieldPct) * 25);
    const attackStress = Math.min(20, snapshot.battle.pendingAttacks.length * 4);
    const cascadeStress = Math.min(20, snapshot.cascade.activeChains.length * 6);
    const phaseStress = snapshot.phase === 'SOVEREIGNTY' ? 10 : snapshot.phase === 'ESCALATION' ? 4 : 0;
    const soloIsolationTax = snapshot.mode === 'solo' && snapshot.economy.opportunitiesPurchased === 0 && snapshot.tick > 10 ? 4 : 0;
    const ghostHeat = snapshot.mode === 'ghost' ? Math.min(15, Math.floor(snapshot.modeState.communityHeatModifier / 15)) : 0;
    return Math.max(0, Math.min(100, cashStress + cashflowStress + shieldStress + attackStress + cascadeStress + phaseStress + soloIsolationTax + ghostHeat));
  }
}
