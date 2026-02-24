/**
 * PZO UPGRADE — src/components/DistressRecovery.tsx
 * 
 * Surfaces when isInDistressNow === true.
 * Player picks one recovery action — each has real tradeoffs.
 * Creates the "hate it enough to win" emotional arc.
 */

'use client';

import React from 'react';
import type { RecoveryAction, RecoveryActionId } from '../engine/resolver';

interface DistressRecoveryProps {
  actions: RecoveryAction[];
  coverageRatio: number;
  liquidityPct: number;
  onSelectAction: (action: RecoveryAction) => void;
  onDismiss: () => void;
}

function fmtMoney(n: number): string {
  const s = n < 0 ? '-' : n > 0 ? '+' : '';
  const v = Math.abs(n);
  if (v >= 1_000_000) return `${s}$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1_000) return `${s}$${(v / 1e3).toFixed(0)}K`;
  return `${s}$${v.toLocaleString()}`;
}

const ACTION_ICONS: Record<RecoveryActionId, string> = {
  RESTRUCTURE:          '🔄',
  SELL_ASSET:           '💸',
  EMERGENCY_PARTNER:    '🤝',
  SIDE_HUSTLE_SPRINT:   '⚡',
  AUSTERITY:            '🔒',
};

function SeverityBar({ value, label }: { value: number; label: string }) {
  const color = value > 0.7 ? 'bg-emerald-500' : value > 0.4 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <span className="text-zinc-400 text-xs w-24 text-right">{label}</span>
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(100, value * 100)}%` }} />
      </div>
      <span className="text-xs font-mono text-zinc-300 w-10">{(value * 100).toFixed(0)}%</span>
    </div>
  );
}

export default function DistressRecovery({
  actions,
  coverageRatio,
  liquidityPct,
  onSelectAction,
  onDismiss,
}: DistressRecoveryProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-red-800/60 rounded-2xl p-6 w-full max-w-lg shadow-2xl shadow-red-950/40">

        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="text-3xl">🚨</div>
          <div>
            <h2 className="text-red-400 font-black text-lg tracking-tight">Financial Distress</h2>
            <p className="text-zinc-400 text-sm">Your system is at risk. Choose a recovery path. Every option has a price.</p>
          </div>
        </div>

        {/* Severity Meters */}
        <div className="bg-zinc-800/60 rounded-xl p-3 mb-4 space-y-2">
          <p className="text-zinc-400 text-xs uppercase font-semibold tracking-wide mb-2">Current Vitals</p>
          <SeverityBar value={Math.min(1, coverageRatio)} label="Coverage Ratio" />
          <SeverityBar value={liquidityPct} label="Liquidity" />
        </div>

        {/* Recovery Actions */}
        <div className="space-y-2 mb-4">
          {actions.map(action => {
            const icon = ACTION_ICONS[action.id] ?? '⚙️';
            const netCashflowChange = action.cashflowDelta;
            return (
              <button
                key={action.id}
                onClick={() => onSelectAction(action)}
                className="w-full text-left bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700 hover:border-zinc-500 rounded-xl p-3 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl mt-0.5">{icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-white font-bold text-sm group-hover:text-indigo-300 transition-colors">
                        {action.label}
                      </span>
                      <div className="flex gap-2 text-xs font-mono">
                        {action.cashDelta !== 0 && (
                          <span className={action.cashDelta > 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {fmtMoney(action.cashDelta)} cash
                          </span>
                        )}
                        {netCashflowChange !== 0 && (
                          <span className={netCashflowChange > 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {fmtMoney(netCashflowChange)}/mo
                          </span>
                        )}
                        {action.reputationDelta !== 0 && (
                          <span className={action.reputationDelta > 0 ? 'text-blue-400' : 'text-orange-400'}>
                            {action.reputationDelta > 0 ? '+' : ''}{action.reputationDelta} rep
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-zinc-400 text-xs leading-tight mb-1">{action.description}</p>
                    <p className="text-orange-400/80 text-xs">⚠️ {action.tradeoff}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Dismiss (gamble on recovery without action) */}
        <button
          onClick={onDismiss}
          className="w-full py-2 rounded-xl border border-zinc-700 text-zinc-500 text-sm hover:text-zinc-300 hover:border-zinc-500 transition-colors"
        >
          Ignore (gamble on natural recovery)
        </button>

        <p className="text-zinc-600 text-xs text-center mt-3">
          Bankruptcy triggered if cash + reserves reach $0
        </p>
      </div>
    </div>
  );
}
