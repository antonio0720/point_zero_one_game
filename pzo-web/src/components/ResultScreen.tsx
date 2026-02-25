// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/components/ResultScreen.tsx
// Sprint 1: ResultScreen extracted from App.tsx
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react';
import { fmtMoney, fmtPct01 } from '../game/core/format';
import type { SeasonState, IntelligenceState } from '../game/types/runState';

interface ResultScreenProps {
  cash: number;
  netWorth: number;
  income: number;
  expenses: number;
  season: SeasonState;
  intelligence: IntelligenceState;
  onRestart: () => void;
}

export function ResultScreen({ cash, netWorth, income, expenses, season, intelligence, onRestart }: ResultScreenProps) {
  const cashflow = income - expenses;
  const won = cashflow > 0 && netWorth > 100_000;

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 text-white p-8 gap-6">
      <div className={`text-5xl font-black tracking-tight ${won ? 'text-emerald-400' : 'text-red-400'}`}>
        {won ? '🏆 FREEDOM UNLOCKED' : '💀 WIPE'}
      </div>
      <p className="text-zinc-400 text-lg">
        {won ? 'Passive income exceeds expenses. You are free.' : 'You ran out of time or capital.'}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center max-w-4xl w-full">
        {([
          ['Final Cash',      fmtMoney(cash),          cash > 0 ? 'text-emerald-400' : 'text-red-400'],
          ['Net Worth',       fmtMoney(netWorth),       'text-white'],
          ['Monthly Income',  fmtMoney(income),         'text-emerald-400'],
          ['Cashflow',        `${cashflow >= 0 ? '+' : ''}${fmtMoney(cashflow)}`, cashflow >= 0 ? 'text-emerald-400' : 'text-red-400'],
          ['Battle Pass',     `T${season.passTier}`,    'text-indigo-300'],
          ['AI Alpha',        fmtPct01(intelligence.alpha), 'text-cyan-300'],
        ] as [string, string, string][]).map(([label, val, color]) => (
          <div key={label} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">{label}</p>
            <p className={`font-mono font-bold text-xl ${color}`}>{val}</p>
          </div>
        ))}
      </div>
      <button
        onClick={onRestart}
        className="mt-4 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-lg transition-colors"
      >
        Play Again
      </button>
    </div>
  );
}
