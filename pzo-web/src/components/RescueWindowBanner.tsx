/**
 * RescueWindowBanner.tsx — Alliance Rescue Window Banner
 * Shows when rescue window is open for an alliance member.
 * Props-only.
 */

import React from 'react';

export interface RescueWindowBannerProps {
  rescueeDisplayName: string;
  rescueeNetWorth: number;
  ticksRemaining: number;
  allianceName: string;
  contributionRequired: number;
  totalContributed: number;
  onContribute?: () => void;
  onDismiss?: () => void;
}

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export function RescueWindowBanner({
  rescueeDisplayName,
  rescueeNetWorth,
  ticksRemaining,
  allianceName,
  contributionRequired,
  totalContributed,
  onContribute,
  onDismiss,
}: RescueWindowBannerProps) {
  const progress = Math.min(totalContributed / contributionRequired, 1);
  const isFullyFunded = totalContributed >= contributionRequired;

  return (
    <div className="bg-amber-950/40 border border-amber-700/60 rounded-lg p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 text-sm">🚨</span>
          <span className="text-xs font-bold text-amber-300 tracking-wide">RESCUE WINDOW OPEN</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-amber-600">{ticksRemaining}t remaining</span>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-[10px] text-zinc-500 hover:text-zinc-300"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Rescuee info */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-white">{rescueeDisplayName}</p>
          <p className="text-[10px] text-zinc-400">{allianceName} · {fmt(rescueeNetWorth)} net worth</p>
        </div>
        {isFullyFunded && (
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded">
            FUNDED ✓
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isFullyFunded ? 'bg-emerald-500' : 'bg-amber-500'}`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] font-mono text-zinc-500">
          <span>{fmt(totalContributed)} raised</span>
          <span>{fmt(contributionRequired)} target</span>
        </div>
      </div>

      {/* Action */}
      {onContribute && !isFullyFunded && (
        <button
          onClick={onContribute}
          className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 text-black text-xs font-bold rounded transition-colors"
        >
          CONTRIBUTE TO RESCUE
        </button>
      )}
    </div>
  );
}

export default RescueWindowBanner;