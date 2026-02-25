/**
 * SyndicateGameScreen.tsx — CO-OP mode game screen
 * Theme: Teal / Alliance. Partner panel. Synergy engine. Rescue windows.
 * You and your partner share one economy. Both survive or neither wins.
 */

import React, { useState } from 'react';
import GameBoard from './GameBoard';
import type { MarketRegime, IntelligenceState } from './GameBoard';
import { RescueWindowBanner } from './RescueWindowBanner';
import { AidContractComposer } from './AidContractComposer';
import type { AidContract } from './AidContractComposer';
import ShieldIcons from './ShieldIcons';
import MomentFlash from './MomentFlash';
import type { GameModeState } from '../engines/core/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(n);
  if (v >= 1_000_000) return `${sign}$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `${sign}$${(v / 1_000).toFixed(1)}K`;
  return `${sign}$${Math.round(v).toLocaleString()}`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SynergyBar({ synergyBonus, combinedNetWorth }: { synergyBonus: number; combinedNetWorth: number }) {
  // synergyBonus: 0.0–2.0 where 1.0 = no bonus, 2.0 = +100% (max)
  const synergyScore = Math.max(0, Math.min(200, (synergyBonus - 1.0) * 200));
  const pct          = synergyScore / 2;  // 0-100 for display
  const bonusPct     = Math.max(0, (synergyBonus - 1.0) * 100);

  const color = synergyScore >= 150 ? '#00E5C8'
    : synergyScore >= 80  ? '#00BBAA'
    : synergyScore >= 40  ? '#FF8800'
    : '#FF4444';

  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: '#000D0B', borderColor: '#00E5C833' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#00E5C8] text-xs font-bold tracking-widest uppercase">Synergy Engine</span>
        <span className="text-xs font-mono text-[#888]">Combined NW: {fmt(combinedNetWorth)}</span>
      </div>

      {/* Big score */}
      <div className="flex items-baseline gap-2 mb-3">
        <span
          className="text-5xl font-black"
          style={{ color, textShadow: synergyScore >= 150 ? `0 0 30px ${color}66` : 'none' }}
        >
          {Math.round(synergyScore)}
        </span>
        <span className="text-[#666] text-sm">/ 200</span>
        {bonusPct > 0 && (
          <span
            className="ml-2 text-lg font-black"
            style={{ color: '#00E5C8' }}
          >
            +{Math.round(bonusPct)}% INCOME
          </span>
        )}
      </div>

      {/* Bar */}
      <div className="h-4 bg-[#001510] rounded-full overflow-hidden mb-2 relative">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, #006655, ${color})`,
            boxShadow: synergyScore > 100 ? `0 0 16px ${color}55` : 'none',
          }}
        />
        {/* Bonus threshold at 100 */}
        <div
          className="absolute top-0 h-full w-px bg-[#00E5C844]"
          style={{ left: '50%' }}
        />
      </div>

      <div className="flex justify-between text-[9px] text-[#444] font-mono">
        <span>FRICTION</span>
        <span>NEUTRAL</span>
        <span className="text-[#00E5C8]">MAX SYNERGY +30%</span>
      </div>

      <div className="mt-2 text-[10px] text-center"
        style={{ color: synergyScore >= 100 ? '#00E5C8' : '#666' }}
      >
        {synergyScore >= 150 ? '🔥 APEX SYNERGY — Maximum income amplification active'
          : synergyScore >= 80 ? '📈 Strong alliance — synergy bonus building'
          : synergyScore >= 40 ? '⚠️ Moderate friction — coordinate decisions'
          : '❌ Alliance strain — one of you is bleeding'}
      </div>
    </div>
  );
}

function PartnerPanel({
  label,
  cash,
  income,
  expenses,
  netWorth,
  shieldPct,
  inDistress,
  isLocal,
}: {
  label: string;
  cash?: number;
  income: number;
  expenses: number;
  netWorth: number;
  shieldPct: number;
  inDistress: boolean;
  isLocal: boolean;
}) {
  const cashflow  = income - expenses;
  const accent    = isLocal ? '#00E5C8' : '#7BFFE8';
  const distColor = '#FF4444';

  return (
    <div
      className="rounded-xl border p-4 relative overflow-hidden"
      style={{
        background: inDistress ? '#1a000022' : '#000D0B',
        borderColor: inDistress ? distColor + '66' : accent + '33',
      }}
    >
      {inDistress && (
        <div
          className="absolute inset-0 pointer-events-none animate-pulse rounded-xl"
          style={{ border: `2px solid ${distColor}55`, background: `${distColor}08` }}
        />
      )}

      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-2 h-2 rounded-full"
          style={{ background: inDistress ? distColor : accent, boxShadow: `0 0 8px ${inDistress ? distColor : accent}` }}
        />
        <span className="text-xs font-black tracking-widest uppercase" style={{ color: inDistress ? distColor : accent }}>
          {label}
        </span>
        {inDistress && (
          <span className="ml-auto text-[10px] font-black text-[#FF4444] animate-pulse">🚨 DISTRESS</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {cash !== undefined && (
          <div className="bg-[#00110E] border border-[#00221A] rounded p-2">
            <div className="text-[#666] uppercase tracking-wide text-[9px]">Cash</div>
            <div className="font-mono font-bold" style={{ color: cash < 3000 ? '#FF4444' : '#ddd' }}>{fmt(cash)}</div>
          </div>
        )}
        <div className="bg-[#00110E] border border-[#00221A] rounded p-2">
          <div className="text-[#666] uppercase tracking-wide text-[9px]">Net Worth</div>
          <div className="font-mono font-bold text-white">{fmt(netWorth)}</div>
        </div>
        <div className="bg-[#00110E] border border-[#00221A] rounded p-2">
          <div className="text-[#666] uppercase tracking-wide text-[9px]">Cashflow</div>
          <div className="font-mono font-bold" style={{ color: cashflow >= 0 ? '#00E5C8' : '#FF4444' }}>
            {cashflow >= 0 ? '+' : ''}{fmt(cashflow)}/mo
          </div>
        </div>
        <div className="bg-[#00110E] border border-[#00221A] rounded p-2">
          <div className="text-[#666] uppercase tracking-wide text-[9px]">Shields</div>
          <div className="h-2 bg-[#001510] rounded-full mt-1 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${shieldPct * 100}%`,
                background: shieldPct > 0.5 ? '#00E5C8' : shieldPct > 0.25 ? '#FF8800' : '#FF2222',
              }}
            />
          </div>
          <div className="text-[9px] font-mono mt-0.5" style={{ color: accent }}>
            {Math.round(shieldPct * 100)}%
          </div>
        </div>
      </div>
    </div>
  );
}

function AidContractList({ contracts }: { contracts: Array<{ id: string; type: string; status: string; terms: { amount: number } }> }) {
  if (contracts.length === 0) return null;

  return (
    <div className="rounded-xl border p-4" style={{ background: '#000D0B', borderColor: '#00E5C822' }}>
      <div className="text-[#00E5C8] text-xs font-bold tracking-widest uppercase mb-3">Active Aid Contracts</div>
      <div className="space-y-2">
        {contracts.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between px-3 py-2 rounded-lg border text-xs"
            style={{ borderColor: '#00E5C822', background: '#00E5C808' }}
          >
            <span className="font-bold text-[#00E5C8]">{c.type.replace('_', ' ')}</span>
            <span className="font-mono text-[#888]">{fmt(c.terms.amount)}</span>
            <span
              className="px-2 py-0.5 rounded text-[9px] font-bold"
              style={{
                color: c.status === 'ACTIVE' ? '#00E5C8' : '#888',
                background: c.status === 'ACTIVE' ? '#00E5C811' : '#11111111',
                border: `1px solid ${c.status === 'ACTIVE' ? '#00E5C822' : '#222'}`,
              }}
            >
              {c.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface AllianceMember {
  id: string;
  displayName: string;
  netWorth: number;
}

export interface RescueWindowState {
  rescueeDisplayName: string;
  rescueeNetWorth: number;
  ticksRemaining: number;
  allianceName: string;
  contributionRequired: number;
  totalContributed: number;
}

export interface SyndicateGameScreenProps {
  cash: number;
  income: number;
  expenses: number;
  netWorth: number;
  shields: number;
  shieldConsuming: boolean;
  tick: number;
  totalTicks: number;
  freezeTicks: number;
  regime: MarketRegime;
  intelligence: IntelligenceState;
  equityHistory: number[];
  events: string[];
  modeState: GameModeState | null;
  rescueWindow: RescueWindowState | null;
  allianceMembers: AllianceMember[];
  onAidSubmit: (contract: AidContract) => void;
  onRescueContribute: () => void;
  onRescueDismiss: () => void;
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function SyndicateGameScreen({
  cash, income, expenses, netWorth, shields, shieldConsuming,
  tick, totalTicks, freezeTicks, regime, intelligence, equityHistory,
  events, modeState, rescueWindow, allianceMembers,
  onAidSubmit, onRescueContribute, onRescueDismiss,
}: SyndicateGameScreenProps) {
  const [showAid, setShowAid] = useState(false);

  const syndicate = modeState?.syndicate;

  const partnerIncome    = syndicate?.partnerIncome    ?? 2100;
  const partnerExpenses  = income * 0.9;  // approximation when no engine data
  const partnerNetWorth  = syndicate?.partnerNetWorth  ?? netWorth * 0.85;
  const partnerShieldPct = syndicate?.partnerShieldPct ?? 0.75;
  const partnerDistress  = syndicate?.partnerInDistress ?? false;
  const rescueOpen       = syndicate?.rescueWindowOpen ?? !!rescueWindow;
  const rescueTicks      = syndicate?.rescueWindowTicksLeft ?? rescueWindow?.ticksRemaining ?? 0;
  const synergyBonus     = syndicate?.synergyBonus ?? 1.0;
  const combinedNW       = syndicate?.combinedNetWorth ?? (netWorth + partnerNetWorth);
  const aidContracts     = syndicate?.activeAidContracts ?? [];
  const shieldPct        = shields / 4;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(135deg, #000D0B 0%, #001210 50%, #000908 100%)' }}
    >
      {/* ── Mode Banner ─────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-4 px-6 py-3 border-b"
        style={{ borderColor: '#00E5C822', background: '#000D0B88' }}
      >
        <div
          className="px-3 py-1 rounded text-xs font-black tracking-widest"
          style={{ background: '#00E5C822', border: '1px solid #00E5C844', color: '#00E5C8' }}
        >
          🤝 SYNDICATE
        </div>
        <span className="text-[#888] text-xs">Both survive or neither wins. Your ceiling is their floor.</span>
        <div className="ml-auto flex items-center gap-4 text-xs font-mono">
          {(rescueOpen || !!rescueWindow) && (
            <span className="text-[#FF8800] font-bold animate-pulse">🚨 RESCUE ACTIVE</span>
          )}
          <span style={{ color: '#00E5C8' }}>T{tick}/{totalTicks}</span>
        </div>
      </div>

      {/* ── Synergy Bar (full width, dominant) ──────────────────────── */}
      <div className="px-4 pt-4">
        <SynergyBar synergyBonus={synergyBonus} combinedNetWorth={combinedNW} />
      </div>

      {/* ── Main Content ────────────────────────────────────────────── */}
      <div className="flex-1 p-4 space-y-4">

        {/* Partner panels side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PartnerPanel
            label="YOUR EMPIRE"
            cash={cash}
            income={income}
            expenses={expenses}
            netWorth={netWorth}
            shieldPct={shieldPct}
            inDistress={cash < 3000 || (income / Math.max(1, expenses)) < 0.8}
            isLocal={true}
          />
          <PartnerPanel
            label="PARTNER"
            income={partnerIncome}
            expenses={partnerExpenses}
            netWorth={partnerNetWorth}
            shieldPct={partnerShieldPct}
            inDistress={partnerDistress}
            isLocal={false}
          />
        </div>

        {/* Aid contracts */}
        <AidContractList contracts={aidContracts as any[]} />

        {/* Aid composer toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAid((v) => !v)}
            className="px-4 py-2 rounded-lg text-xs font-bold tracking-widest uppercase transition-all"
            style={{
              background: showAid ? '#00E5C822' : '#00221A',
              border: '1px solid #00E5C844',
              color: '#00E5C8',
            }}
          >
            {showAid ? '✕ CLOSE AID COMPOSER' : '📤 SEND ALLIANCE AID'}
          </button>
        </div>

        {showAid && (
          <AidContractComposer
            allianceMembers={allianceMembers}
            senderCash={cash}
            maxAidPct={0.25}
            onSubmit={(c) => { onAidSubmit(c); setShowAid(false); }}
            onCancel={() => setShowAid(false)}
          />
        )}

        {/* GameBoard */}
        <GameBoard
          equityHistory={equityHistory}
          cash={cash}
          netWorth={netWorth}
          income={income}
          expenses={expenses}
          regime={regime}
          intelligence={intelligence}
          tick={tick}
          totalTicks={totalTicks}
          freezeTicks={freezeTicks}
        />
      </div>

      {/* ── Rescue Window Banner ─────────────────────────────────────── */}
      {rescueWindow && (
        <div className="fixed bottom-4 left-4 w-80 z-50">
          <RescueWindowBanner
            rescueeDisplayName={rescueWindow.rescueeDisplayName}
            rescueeNetWorth={rescueWindow.rescueeNetWorth}
            ticksRemaining={rescueWindow.ticksRemaining}
            allianceName={rescueWindow.allianceName}
            contributionRequired={rescueWindow.contributionRequired}
            totalContributed={rescueWindow.totalContributed}
            onContribute={onRescueContribute}
            onDismiss={onRescueDismiss}
          />
        </div>
      )}

      {/* ── Moment Flash ────────────────────────────────────────────── */}
      <div className="fixed bottom-4 right-4 w-80 z-50 pointer-events-none">
        <MomentFlash events={events} tick={tick} maxVisible={3} />
      </div>
    </div>
  );
}
