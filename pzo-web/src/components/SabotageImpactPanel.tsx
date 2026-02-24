/**
 * SabotageImpactPanel.tsx — Active Sabotage Impact Display
 * Shows current sabotage effects on the player.
 */

import React from 'react';

export type SabotageKind =
  | 'INCOME_DRAIN'
  | 'CARD_BLOCK'
  | 'INTEL_BLACKOUT'
  | 'FORCED_SELL'
  | 'HATER_BOOST';

export interface ActiveSabotage {
  id: string;
  kind: SabotageKind;
  label: string;
  severity: 'MINOR' | 'MAJOR' | 'CRITICAL';
  ticksRemaining: number;
  sourceDisplayName: string;
  impactValue?: number;  // dollar amount or percentage
}

export interface SabotageImpactPanelProps {
  activeSabotages: ActiveSabotage[];
  tick: number;
  onCounterplay?: (id: string) => void;
}

const KIND_EMOJI: Record<SabotageKind, string> = {
  INCOME_DRAIN:  '🩸',
  CARD_BLOCK:    '🚫',
  INTEL_BLACKOUT:'👁',
  FORCED_SELL:   '💣',
  HATER_BOOST:   '🔥',
};

const SEVERITY_STYLE: Record<ActiveSabotage['severity'], string> = {
  MINOR:    'border-yellow-900/40 bg-yellow-950/20',
  MAJOR:    'border-orange-800/50 bg-orange-950/20',
  CRITICAL: 'border-red-800/60 bg-red-950/30',
};

const SEVERITY_TEXT: Record<ActiveSabotage['severity'], string> = {
  MINOR:    'text-yellow-400',
  MAJOR:    'text-orange-400',
  CRITICAL: 'text-red-400',
};

export function SabotageImpactPanel({ activeSabotages, tick, onCounterplay }: SabotageImpactPanelProps) {
  if (activeSabotages.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-red-500 tracking-widest animate-pulse">
          ⚠ UNDER ATTACK
        </span>
        <span className="text-[10px] font-mono text-zinc-600">T+{tick}</span>
      </div>
      {activeSabotages.map(sab => (
        <div
          key={sab.id}
          className={`border rounded-lg p-2.5 space-y-1 ${SEVERITY_STYLE[sab.severity]}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{KIND_EMOJI[sab.kind]}</span>
              <span className={`text-xs font-semibold ${SEVERITY_TEXT[sab.severity]}`}>
                {sab.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-zinc-500">{sab.ticksRemaining}t</span>
              {onCounterplay && (
                <button
                  onClick={() => onCounterplay(sab.id)}
                  className="text-[9px] px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded"
                >
                  COUNTER
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500">from: {sab.sourceDisplayName}</span>
            {sab.impactValue !== undefined && (
              <span className="text-[10px] font-mono text-red-400">
                -{sab.impactValue >= 1000 ? `$${(sab.impactValue / 1000).toFixed(0)}K` : `$${sab.impactValue}`}/t
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default SabotageImpactPanel;