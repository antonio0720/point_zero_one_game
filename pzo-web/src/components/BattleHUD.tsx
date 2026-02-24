/**
 * BattleHUD.tsx — PZO Battle Mode HUD
 * Real-time battle state display. Props-only.
 */

import React from 'react';

export type BattlePhase = 'PREP' | 'ACTIVE' | 'RESOLUTION' | 'ENDED';

export interface BattleParticipant {
  id: string;
  displayName: string;
  netWorth: number;
  haterHeat: number;
  isLocal: boolean;
}

export interface BattleHUDProps {
  phase: BattlePhase;
  participants: BattleParticipant[];
  ticksRemaining: number;
  roundNumber: number;
  totalRounds: number;
  localScore: number;
  opponentScore: number;
  onForfeit?: () => void;
}

const PHASE_COLOR: Record<BattlePhase, string> = {
  PREP:       'text-zinc-400',
  ACTIVE:     'text-emerald-400',
  RESOLUTION: 'text-yellow-400',
  ENDED:      'text-red-400',
};

const PHASE_LABEL: Record<BattlePhase, string> = {
  PREP:       'PREP PHASE',
  ACTIVE:     'BATTLE ACTIVE',
  RESOLUTION: 'RESOLVING',
  ENDED:      'BATTLE ENDED',
};

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export function BattleHUD({
  phase,
  participants,
  ticksRemaining,
  roundNumber,
  totalRounds,
  localScore,
  opponentScore,
  onForfeit,
}: BattleHUDProps) {
  const local    = participants.find(p => p.isLocal);
  const opponent = participants.find(p => !p.isLocal);

  return (
    <div className="bg-zinc-950 border border-zinc-700 rounded-lg p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-mono font-bold tracking-widest ${PHASE_COLOR[phase]}`}>
          {PHASE_LABEL[phase]}
        </span>
        <span className="text-[10px] font-mono text-zinc-500">
          R{roundNumber}/{totalRounds} · {ticksRemaining}t
        </span>
      </div>

      {/* Score bar */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-emerald-400 tabular-nums w-8 text-right">
          {localScore}
        </span>
        <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{
              width: `${(localScore / Math.max(localScore + opponentScore, 1)) * 100}%`,
            }}
          />
          <div className="flex-1 h-full bg-red-600" />
        </div>
        <span className="text-sm font-bold text-red-400 tabular-nums w-8">
          {opponentScore}
        </span>
      </div>

      {/* Participants */}
      <div className="grid grid-cols-2 gap-2">
        {local && (
          <div className="bg-emerald-950/30 border border-emerald-900/40 rounded p-2">
            <p className="text-[10px] font-mono text-emerald-400 truncate">{local.displayName}</p>
            <p className="text-xs font-bold text-white">{fmt(local.netWorth)}</p>
            <p className="text-[10px] text-zinc-500">Heat: {local.haterHeat}</p>
          </div>
        )}
        {opponent && (
          <div className="bg-red-950/30 border border-red-900/40 rounded p-2">
            <p className="text-[10px] font-mono text-red-400 truncate">{opponent.displayName}</p>
            <p className="text-xs font-bold text-white">{fmt(opponent.netWorth)}</p>
            <p className="text-[10px] text-zinc-500">Heat: {opponent.haterHeat}</p>
          </div>
        )}
      </div>

      {/* Forfeit */}
      {onForfeit && phase === 'ACTIVE' && (
        <button
          onClick={onForfeit}
          className="w-full text-[10px] font-mono py-1 bg-zinc-900 hover:bg-red-950 text-zinc-500 hover:text-red-400 border border-zinc-800 hover:border-red-900 rounded transition-colors"
        >
          FORFEIT MATCH
        </button>
      )}
    </div>
  );
}

export default BattleHUD;