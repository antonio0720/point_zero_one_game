/**
 * ReplayTimeline.tsx — PZO Replay Forensics Timeline
 * Scrubable timeline of a completed run. Props-only.
 */

import React, { useState, useCallback } from 'react';

export interface ReplayEvent {
  tick: number;
  kind: 'CARD_PLAYED' | 'FATE' | 'BANKRUPTCY_NEAR' | 'REGIME_CHANGE' | 'MILESTONE';
  label: string;
  netWorthAtTick: number;
  emoji?: string;
}

export interface ReplayTimelineProps {
  events: ReplayEvent[];
  totalTicks: number;
  finalNetWorth: number;
  seed: number;
  onScrub?: (tick: number) => void;
}

const KIND_COLOR: Record<ReplayEvent['kind'], string> = {
  CARD_PLAYED:     'bg-emerald-500',
  FATE:            'bg-red-500',
  BANKRUPTCY_NEAR: 'bg-orange-600',
  REGIME_CHANGE:   'bg-indigo-500',
  MILESTONE:       'bg-yellow-400',
};

function fmt(n: number) {
  if (n < 0) return `-$${Math.abs(n) >= 1000 ? (Math.abs(n) / 1000).toFixed(0) + 'K' : Math.abs(n)}`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export function ReplayTimeline({
  events,
  totalTicks,
  finalNetWorth,
  seed,
  onScrub,
}: ReplayTimelineProps) {
  const [activeTick, setActiveTick] = useState<number | null>(null);

  const handleClick = useCallback((tick: number) => {
    setActiveTick(tick);
    onScrub?.(tick);
  }, [onScrub]);

  const activeEvent = activeTick !== null
    ? events.find(e => e.tick === activeTick) ?? null
    : null;

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-zinc-400 tracking-widest">REPLAY FORENSICS</span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-zinc-600">SEED {seed}</span>
          <span className={`text-xs font-bold ${finalNetWorth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmt(finalNetWorth)}
          </span>
        </div>
      </div>

      {/* Timeline bar */}
      <div className="relative h-8 bg-zinc-900 rounded overflow-hidden">
        {events.map(event => (
          <button
            key={`${event.tick}-${event.kind}`}
            className={`absolute top-0 h-full w-1 hover:w-2 transition-all cursor-pointer ${KIND_COLOR[event.kind]} opacity-80 hover:opacity-100`}
            style={{ left: `${(event.tick / totalTicks) * 100}%` }}
            onClick={() => handleClick(event.tick)}
            title={event.label}
          />
        ))}
        {activeTick !== null && (
          <div
            className="absolute top-0 h-full w-0.5 bg-white/70"
            style={{ left: `${(activeTick / totalTicks) * 100}%` }}
          />
        )}
      </div>

      {/* Event detail */}
      {activeEvent ? (
        <div className="bg-zinc-900 rounded p-2 space-y-1">
          <div className="flex items-center gap-2">
            {activeEvent.emoji && <span>{activeEvent.emoji}</span>}
            <span className="text-xs text-zinc-200">{activeEvent.label}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-zinc-500">T+{activeEvent.tick}</span>
            <span className="text-[10px] font-mono text-zinc-400">{fmt(activeEvent.netWorthAtTick)}</span>
          </div>
        </div>
      ) : (
        <p className="text-[10px] font-mono text-zinc-600 text-center">CLICK TIMELINE TO INSPECT EVENT</p>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap">
        {Object.entries(KIND_COLOR).map(([kind, color]) => (
          <div key={kind} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-sm ${color}`} />
            <span className="text-[9px] font-mono text-zinc-600">
              {kind.replace('_', ' ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ReplayTimeline;