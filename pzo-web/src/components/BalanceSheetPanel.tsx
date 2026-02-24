/**
 * PZO UPGRADE — src/components/BalanceSheetPanel.tsx
 * 
 * Real financial pressure display.
 * Shows: cash / reserves / illiquid / obligations / coverage ratio / liquidity stress
 * 
 * This is the "truth layer" that makes the game feel real.
 */

'use client';

import React from 'react';
import type { BalanceSheet, ObligationRecord, PortfolioRecord, MitigationRecord } from '../types/game';
import { liquidityRatio, computeConcentrationScore } from '../types/game';

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function MiniBar({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-zinc-500 text-xs w-20 text-right truncate">{label}</span>
      <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
      </div>
    </div>
  );
}

interface BalanceSheetPanelProps {
  balanceSheet: BalanceSheet;
  obligations: ObligationRecord[];
  portfolio: PortfolioRecord[];
  mitigations: MitigationRecord[];
  income: number;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export default function BalanceSheetPanel({
  balanceSheet,
  obligations,
  portfolio,
  mitigations,
  income,
  isExpanded = false,
  onToggle,
}: BalanceSheetPanelProps) {
  const liqRatio = liquidityRatio(balanceSheet);
  const hhi = computeConcentrationScore(portfolio);
  const totalAssets = balanceSheet.cash + balanceSheet.reserves + balanceSheet.illiquidValue;
  const netWorth = totalAssets;
  const totalObligations = obligations.reduce((s, o) => s + o.amountPerMonth, 0);
  const coverageRatio = income / Math.max(1, totalObligations);

  const liqColor = liqRatio > 0.5 ? 'bg-emerald-500' : liqRatio > 0.25 ? 'bg-yellow-500' : 'bg-red-500';
  const coverageColor = coverageRatio > 1.5 ? 'bg-emerald-500' : coverageRatio > 1.0 ? 'bg-yellow-500' : 'bg-red-500';
  const hhi_color = hhi < 0.35 ? 'bg-emerald-500' : hhi < 0.6 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-800/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-xs">📊 Balance Sheet</span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${liqRatio < 0.3 ? 'bg-red-900/60 text-red-400' : 'bg-zinc-800 text-zinc-400'}`}>
            {(liqRatio * 100).toFixed(0)}% liquid
          </span>
          {coverageRatio < 1.0 && (
            <span className="text-xs bg-red-900/60 text-red-400 px-1.5 py-0.5 rounded font-semibold">⚠️ Underwater</span>
          )}
        </div>
        <span className="text-zinc-500 text-xs">{isExpanded ? '▲' : '▼'}</span>
      </button>

      {/* Always Visible Summary */}
      <div className="px-3 pb-2 grid grid-cols-3 gap-x-4 gap-y-1 border-t border-zinc-800/50">
        <StatCell label="Cash" value={fmt(balanceSheet.cash)} color={balanceSheet.cash < 5000 ? 'text-red-400' : 'text-white'} />
        <StatCell label="Reserves" value={fmt(balanceSheet.reserves)} color="text-blue-300" />
        <StatCell label="Illiquid" value={fmt(balanceSheet.illiquidValue)} color="text-zinc-300" />
        <StatCell label="Net Worth" value={fmt(netWorth)} color="text-white" />
        <StatCell label="Obligations" value={`${fmt(totalObligations)}/mo`} color={totalObligations > income ? 'text-red-400' : 'text-orange-300'} />
        <StatCell label="Coverage" value={`${coverageRatio.toFixed(2)}×`} color={coverageRatio >= 1.5 ? 'text-emerald-400' : coverageRatio >= 1.0 ? 'text-yellow-400' : 'text-red-400'} />
      </div>

      {/* Mini Progress Bars */}
      <div className="px-3 pb-2 space-y-1 border-t border-zinc-800/50 pt-1.5">
        <MiniBar value={liqRatio} label="Liquidity" color={liqColor} />
        <MiniBar value={Math.min(1, coverageRatio / 2)} label="Coverage" color={coverageColor} />
        <MiniBar value={1 - hhi} label="Diversification" color={hhi_color} />
      </div>

      {/* Expanded Detail */}
      {isExpanded && (
        <div className="border-t border-zinc-800 px-3 py-2 space-y-3">

          {/* Obligations List */}
          {obligations.length > 0 && (
            <div>
              <p className="text-zinc-500 text-xs uppercase font-semibold tracking-wide mb-1.5">Obligations</p>
              <div className="space-y-1">
                {obligations.map(o => (
                  <div key={o.id} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400 truncate max-w-[140px]">{o.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-red-400 font-mono">−{fmt(o.amountPerMonth)}/mo</span>
                      <span className="text-zinc-600">{o.ticksRemaining !== null ? `${Math.ceil(o.ticksRemaining / 12)}mo left` : 'permanent'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Portfolio Summary */}
          {portfolio.length > 0 && (
            <div>
              <p className="text-zinc-500 text-xs uppercase font-semibold tracking-wide mb-1.5">Portfolio ({portfolio.length})</p>
              <div className="space-y-1">
                {portfolio.slice(0, 5).map(p => (
                  <div key={p.cardId} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400 truncate max-w-[120px]">{p.cardName}</span>
                    <div className="flex gap-2">
                      <span className="text-zinc-600 capitalize">{p.assetClass}</span>
                      <span className="text-emerald-400 font-mono">+{fmt(p.monthlyIncome)}/mo</span>
                    </div>
                  </div>
                ))}
                {portfolio.length > 5 && (
                  <p className="text-zinc-600 text-xs">+{portfolio.length - 5} more assets</p>
                )}
              </div>
            </div>
          )}

          {/* Mitigations */}
          {mitigations.length > 0 && (
            <div>
              <p className="text-zinc-500 text-xs uppercase font-semibold tracking-wide mb-1.5">Protections</p>
              <div className="flex flex-wrap gap-1.5">
                {mitigations.map(m => (
                  <div key={m.type} className="flex items-center gap-1 bg-blue-900/30 border border-blue-800/50 rounded-full px-2 py-0.5">
                    <span className="text-blue-300 text-xs font-semibold">{m.label}</span>
                    <span className="text-blue-500 text-xs">{fmt(m.remainingAbsorption)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Concentration Warning */}
          {hhi > 0.6 && (
            <div className="bg-orange-900/20 border border-orange-800/40 rounded-lg px-2 py-1.5">
              <p className="text-orange-400 text-xs font-semibold">⚠️ Concentrated Portfolio ({(hhi * 100).toFixed(0)}% HHI)</p>
              <p className="text-orange-500/80 text-xs mt-0.5">Overconcentration amplifies downside in adverse regimes. Diversify across asset classes.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="pt-1.5">
      <p className="text-zinc-500 text-xs uppercase tracking-wide">{label}</p>
      <p className={`font-mono font-bold text-xs ${color}`}>{value}</p>
    </div>
  );
}
