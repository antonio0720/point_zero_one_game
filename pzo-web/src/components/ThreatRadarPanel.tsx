/**
 * ThreatRadarPanel.tsx — PZO Threat Forecast UI
 * Displays active threats, probability bars, and countdown timers.
 * Props-only. No internal state fetching.
 */

import React from 'react';

export type ThreatLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Threat {
  id: string;
  label: string;
  probability: number;   // 0–1
  ticksRemaining: number;
  level: ThreatLevel;
  mitigated: boolean;
}

export interface ThreatRadarPanelProps {
  threats: Threat[];
  tick: number;
  onMitigate?: (id: string) => void;
}

const LEVEL_COLOR: Record<ThreatLevel, string> = {
  LOW:      'bg-emerald-500',
  MEDIUM:   'bg-yellow-400',
  HIGH:     'bg-orange-500',
  CRITICAL: 'bg-red-600',
};

const LEVEL_TEXT: Record<ThreatLevel, string> = {
  LOW:      'text-emerald-400',
  MEDIUM:   'text-yellow-400',
  HIGH:     'text-orange-400',
  CRITICAL: 'text-red-400',
};

export function ThreatRadarPanel({ threats, tick, onMitigate }: ThreatRadarPanelProps) {
  const active = threats.filter(t => !t.mitigated).sort((a, b) => b.probability - a.probability);

  if (active.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <p className="text-zinc-500 text-xs font-mono text-center">NO ACTIVE THREATS</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono text-zinc-400 tracking-widest">THREAT RADAR</span>
        <span className="text-[10px] font-mono text-zinc-600">T+{tick}</span>
      </div>
      {active.map(threat => (
        <div key={threat.id} className="space-y-1">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${LEVEL_TEXT[threat.level]}`}>
              {threat.label}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-zinc-500">
                {threat.ticksRemaining}t
              </span>
              {onMitigate && (
                <button
                  onClick={() => onMitigate(threat.id)}
                  className="text-[10px] px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded"
                >
                  MITIGATE
                </button>
              )}
            </div>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${LEVEL_COLOR[threat.level]}`}
              style={{ width: `${threat.probability * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-zinc-600">
            {Math.round(threat.probability * 100)}% probability
          </span>
        </div>
      ))}
    </div>
  );
}

export default ThreatRadarPanel;