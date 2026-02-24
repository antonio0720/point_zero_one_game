/**
 * CounterplayModal.tsx — Forced Event Counterplay Modal
 * Shows available counterplay options when a forced event hits.
 * Props-only. Zero internal async.
 */

import React, { useState } from 'react';

export type CounterplayAction = {
  id: string;
  label: string;
  description: string;
  cost: number;
  successChance: number;  // 0-1
  emoji: string;
  available: boolean;
};

export interface CounterplayModalProps {
  eventLabel: string;
  eventDescription: string;
  eventEmoji: string;
  ticksToRespond: number;
  actions: CounterplayAction[];
  cash: number;
  onChoose?: (actionId: string) => void;
  onIgnore?: () => void;
}

function fmt(n: number) {
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export function CounterplayModal({
  eventLabel,
  eventDescription,
  eventEmoji,
  ticksToRespond,
  actions,
  cash,
  onChoose,
  onIgnore,
}: CounterplayModalProps) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-950 border border-red-900/60 rounded-xl p-5 w-full max-w-md space-y-4">
        {/* Event header */}
        <div className="flex items-start gap-3">
          <span className="text-3xl">{eventEmoji}</span>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-red-300 tracking-wide">{eventLabel}</h2>
            <p className="text-xs text-zinc-400 mt-0.5">{eventDescription}</p>
          </div>
          <span className="text-[10px] font-mono text-red-600 bg-red-950/40 px-2 py-0.5 rounded">
            {ticksToRespond}t
          </span>
        </div>

        <div className="border-t border-zinc-800" />

        {/* Actions */}
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-zinc-500 tracking-widest">AVAILABLE RESPONSES</p>
          {actions.map(action => {
            const canAfford = cash >= action.cost;
            const isDisabled = !action.available || !canAfford;
            const isSelected = selected === action.id;

            return (
              <button
                key={action.id}
                disabled={isDisabled}
                onClick={() => !isDisabled && setSelected(action.id)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-indigo-950 border-indigo-500'
                    : isDisabled
                    ? 'bg-zinc-900/50 border-zinc-800 opacity-50 cursor-not-allowed'
                    : 'bg-zinc-900 border-zinc-700 hover:border-zinc-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{action.emoji}</span>
                    <span className="text-xs font-semibold text-zinc-200">{action.label}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="text-zinc-500">{fmt(action.cost)}</span>
                    <span className={action.successChance >= 0.7 ? 'text-emerald-400' : 'text-yellow-400'}>
                      {Math.round(action.successChance * 100)}%
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">{action.description}</p>
                {!canAfford && action.available && (
                  <p className="text-[10px] text-red-400 mt-0.5">Insufficient funds</p>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer actions */}
        <div className="flex gap-2">
          {onIgnore && (
            <button
              onClick={onIgnore}
              className="flex-1 py-2 text-xs text-zinc-500 hover:text-zinc-300 bg-zinc-900 hover:bg-zinc-800 rounded border border-zinc-800"
            >
              TAKE THE HIT
            </button>
          )}
          {onChoose && selected && (
            <button
              onClick={() => onChoose(selected)}
              className="flex-1 py-2 text-xs font-bold text-white bg-indigo-700 hover:bg-indigo-600 rounded"
            >
              EXECUTE RESPONSE
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default CounterplayModal;