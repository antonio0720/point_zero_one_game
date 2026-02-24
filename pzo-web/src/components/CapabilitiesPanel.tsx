/**
 * PZO UPGRADE — src/components/CapabilitiesPanel.tsx
 * 
 * Shows player's capability stats (knowledge assets) and active objectives.
 * Each capability provides mechanical benefits explained in-line.
 */

'use client';

import React from 'react';
import type { CapabilityState, ReputationState, ObjectiveId, GameStateSnapshot } from '../types/game';
import { OBJECTIVE_CONFIGS } from '../types/game';

const CAPABILITY_LABELS: Record<keyof CapabilityState, { label: string; icon: string; benefit: string }> = {
  underwriting:  { label: 'Underwriting',   icon: '📋', benefit: '−4%/lvl FUBAR prob' },
  negotiation:   { label: 'Negotiation',    icon: '🤝', benefit: '+2%/lvl deal returns' },
  bookkeeping:   { label: 'Bookkeeping',    icon: '📒', benefit: 'Reveals hidden costs early' },
  marketing:     { label: 'Marketing',      icon: '📣', benefit: '+3%/lvl digital CF' },
  compliance:    { label: 'Compliance',     icon: '⚖️', benefit: '−5%/lvl legal/fraud damage' },
  analytics:     { label: 'Analytics',      icon: '📊', benefit: '+10%/lvl ML card power' },
  systems:       { label: 'Systems',        icon: '⚙️', benefit: '−4%/lvl obligation burden' },
};

const REPUTATION_COLORS: Record<ReputationState['tier'], string> = {
  Unknown:     'text-zinc-500',
  Emerging:    'text-blue-400',
  Established: 'text-indigo-400',
  Respected:   'text-purple-400',
  Sovereign:   'text-yellow-400',
};

interface CapabilitiesPanelProps {
  capabilities: CapabilityState;
  reputation: ReputationState;
  objectives: ObjectiveId[];
  gameStateSnapshot: GameStateSnapshot;
  isExpanded?: boolean;
  onToggle?: () => void;
}

function CapabilityBar({ statKey, value }: { statKey: keyof CapabilityState; value: number }) {
  const meta = CAPABILITY_LABELS[statKey];
  const fillPct = (value / 10) * 100;
  const color = value >= 7 ? 'bg-purple-500' : value >= 4 ? 'bg-indigo-500' : 'bg-zinc-600';

  return (
    <div className="flex items-center gap-2 group">
      <span className="text-sm w-5 text-center">{meta.icon}</span>
      <div className="flex-1">
        <div className="flex justify-between mb-0.5">
          <span className="text-zinc-400 text-xs">{meta.label}</span>
          <span className="text-zinc-500 text-xs font-mono">{value}/10</span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${fillPct}%` }} />
        </div>
      </div>
      {/* Tooltip on hover */}
      <div className="relative">
        <span className="text-zinc-700 group-hover:text-zinc-400 text-xs cursor-help transition-colors">?</span>
        <div className="absolute right-0 bottom-full mb-1 w-40 bg-zinc-800 border border-zinc-600 rounded-lg px-2 py-1.5 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
          <p className="text-xs text-zinc-300">{meta.benefit}</p>
        </div>
      </div>
    </div>
  );
}

function ObjectiveBadge({ id, snapshot }: { id: ObjectiveId; snapshot: GameStateSnapshot }) {
  const config = OBJECTIVE_CONFIGS[id];
  const completed = config.checkFn(snapshot);

  return (
    <div className={`flex items-center gap-2 rounded-xl px-2 py-1.5 border transition-all ${
      completed
        ? 'bg-emerald-900/30 border-emerald-700/60'
        : 'bg-zinc-800/60 border-zinc-700/60'
    }`}>
      <span className="text-sm">{completed ? '✅' : '🎯'}</span>
      <div className="flex-1">
        <p className={`text-xs font-semibold ${completed ? 'text-emerald-300' : 'text-zinc-300'}`}>
          {config.label}
        </p>
        <p className="text-zinc-500 text-xs leading-tight">{config.description}</p>
      </div>
      {completed && (
        <span className="text-xs bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">
          +{config.bonusXp} XP
        </span>
      )}
    </div>
  );
}

export default function CapabilitiesPanel({
  capabilities,
  reputation,
  objectives,
  gameStateSnapshot,
  isExpanded = false,
  onToggle,
}: CapabilitiesPanelProps) {
  const repColor = REPUTATION_COLORS[reputation.tier];
  const totalCaps = Object.values(capabilities).reduce((s: number, v) => s + (v as number), 0);
  const completedObjectives = objectives.filter(id => OBJECTIVE_CONFIGS[id].checkFn(gameStateSnapshot));

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-800/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-xs">⚙️ Capabilities & Objectives</span>
          <span className={`text-xs font-bold ${repColor}`}>{reputation.tier}</span>
          <span className="text-zinc-600 text-xs">{reputation.score} rep</span>
          <span className="text-zinc-600 text-xs">•</span>
          <span className="text-zinc-500 text-xs">{completedObjectives.length}/{objectives.length} objectives</span>
        </div>
        <span className="text-zinc-500 text-xs">{isExpanded ? '▲' : '▼'}</span>
      </button>

      {/* Collapsed: Quick capability summary */}
      {!isExpanded && (
        <div className="px-3 pb-2 border-t border-zinc-800/50">
          <div className="flex gap-3 flex-wrap pt-1.5">
            {(Object.entries(capabilities) as [keyof CapabilityState, number][])
              .filter(([, v]) => v > 0)
              .map(([k, v]) => (
                <span key={k} className="text-xs">
                  {CAPABILITY_LABELS[k].icon} <span className="text-zinc-400">{v}</span>
                </span>
              ))}
            {totalCaps === 0 && (
              <span className="text-zinc-600 text-xs">No capabilities yet — play LEARN zone cards</span>
            )}
          </div>
        </div>
      )}

      {/* Expanded */}
      {isExpanded && (
        <div className="border-t border-zinc-800 px-3 py-3 space-y-4">
          {/* Capabilities */}
          <div>
            <p className="text-zinc-500 text-xs uppercase font-semibold tracking-wide mb-2">Capability Stats</p>
            <div className="space-y-2">
              {(Object.entries(capabilities) as [keyof CapabilityState, number][]).map(([k, v]) => (
                <CapabilityBar key={k} statKey={k} value={v} />
              ))}
            </div>
          </div>

          {/* Reputation */}
          <div>
            <p className="text-zinc-500 text-xs uppercase font-semibold tracking-wide mb-2">Reputation</p>
            <div className="bg-zinc-800 rounded-xl px-3 py-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className={`font-black text-sm ${repColor}`}>{reputation.tier}</span>
                <span className="text-zinc-400 text-xs font-mono">{reputation.score}/1000</span>
              </div>
              <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-600 to-purple-500 rounded-full transition-all"
                  style={{ width: `${(reputation.score / 1000) * 100}%` }}
                />
              </div>
              {reputation.recentEvents.length > 0 && (
                <p className="text-zinc-600 text-xs mt-1.5 truncate">{reputation.recentEvents[0]}</p>
              )}
              <p className="text-zinc-600 text-xs mt-0.5">Sovereign tier: +5% CF premium on all plays</p>
            </div>
          </div>

          {/* Objectives */}
          {objectives.length > 0 && (
            <div>
              <p className="text-zinc-500 text-xs uppercase font-semibold tracking-wide mb-2">
                Run Objectives ({completedObjectives.length}/{objectives.length})
              </p>
              <div className="space-y-1.5">
                {objectives.map(id => (
                  <ObjectiveBadge key={id} id={id} snapshot={gameStateSnapshot} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
