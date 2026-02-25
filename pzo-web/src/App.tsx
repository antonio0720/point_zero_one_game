///Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/App.tsx

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import LobbyScreen from './components/LobbyScreen';
import { useGameMode } from './hooks/useGameMode';
// ─── Data Registry (300 mechanics from pzo-web/src/data/) ─────────────────
import MECHANICS_DATA from './data/mechanics_core.json';
import ML_DATA        from './data/ml_core.json';

import CardHand, { Card, DeckType } from './components/CardHand';
import GameBoard from './components/GameBoard';
import ShieldIcons from './components/ShieldIcons';
import MomentFlash from './components/MomentFlash';
import ProofCard from './components/ProofCard';
import BankruptcyScreen from './components/BankruptcyScreen';
import { MechanicsBridgeProvider } from './context/MechanicsBridgeContext';
import { MechanicsVerticalSlice } from './mechanics/vertical_slice';
import MechanicsBridgeDevPanel from './components/MechanicsBridgeDevPanel';
import { ChatPanel } from './components/chat/ChatPanel';
import { AuthGate }                from './components/auth/AuthGate';
import { useAuth }                 from './hooks/useAuth';
import type { SabotageEvent, SabotageCardType } from './components/chat/useChatEngine';

// ─── P17 New Components ───────────────────────────────────────────────────────
import { ThreatRadarPanel }     from './components/ThreatRadarPanel';
import type { Threat }          from './components/ThreatRadarPanel';
import { BattleHUD }            from './components/BattleHUD';
import type { BattleParticipant, BattlePhase } from './components/BattleHUD';
import { CounterplayModal }     from './components/CounterplayModal';
import type { CounterplayAction } from './components/CounterplayModal';
import { SabotageImpactPanel }  from './components/SabotageImpactPanel';
import type { ActiveSabotage, SabotageKind } from './components/SabotageImpactPanel';
import { RescueWindowBanner }   from './components/RescueWindowBanner';
import { AidContractComposer }  from './components/AidContractComposer';
import type { AidContract }     from './components/AidContractComposer';
import { ReplayTimeline }       from './components/ReplayTimeline';
import type { ReplayEvent }     from './components/ReplayTimeline';

// ─── Mode Game Screens ────────────────────────────────────────────────────────
import EmpireGameScreen    from './components/EmpireGameScreen';
import PredatorGameScreen  from './components/PredatorGameScreen';
import SyndicateGameScreen from './components/SyndicateGameScreen';
import PhantomGameScreen   from './components/PhantomGameScreen';

const STARTING_CASH     = 28_000;
const STARTING_INCOME   = 2_100;
const STARTING_EXPENSES = 4_800;
const RUN_TICKS         = 720;
const FATE_TICKS        = 18;
const FATE_FUBAR_PCT    = 0.42;
const FATE_MISSED_PCT   = 0.32;
const FATE_SO_PCT       = 0.21;

const TICK_MS           = 1000;
const MONTH_TICKS       = 12;
const DRAW_TICKS        = 24;
const MAX_HAND          = 5;
const MAX_LOG           = 80;
const MAX_EQUITY_POINTS = 120;
const SABOTAGE_BASE_TICKS = 24;

type Screen = 'landing' | 'run' | 'result' | 'bankrupt';
type MechanicKind = 'core' | 'ml';
type MechanicFamily =
  | 'replay' | 'economy' | 'risk' | 'market' | 'cards' | 'progression'
  | 'social' | 'telemetry' | 'pvp' | 'season' | 'ai' | 'anti_cheat'
  | 'narrative' | 'ops' | 'unknown';

type MarketRegime = 'Stable' | 'Expansion' | 'Compression' | 'Panic' | 'Euphoria';
type RunMode = 'solo' | 'asymmetric-pvp' | 'co-op' | 'ghost';
type MechanicsFilter = 'all' | 'core' | 'ml';

type MechanicDef = {
  id: string; title: string; kind: MechanicKind; family: MechanicFamily;
  pairId?: string; weight: number; keywordTags: string[];
};

type MechanicRuntimeState = {
  enabled: boolean; activations: number; lastTick: number;
  heat: number; confidence: number; signal: number;
};

type IntelligenceState = {
  alpha: number; risk: number; volatility: number; antiCheat: number;
  personalization: number; rewardFit: number; recommendationPower: number;
  churnRisk: number; momentum: number;
};

type SeasonState = {
  xp: number; passTier: number; dominionControl: number; nodePressure: number;
  winStreak: number; battlePassLevel: number; rewardsPending: number;
};

type TelemetryEnvelopeV2 = {
  tick: number; type: string; payload: Record<string, number | string | boolean | null>;
};

type MacroEvent = { id: string; label: string; apply: () => void };

type PendingCounterplay = {
  eventLabel: string; eventDescription: string; eventEmoji: string;
  ticksToRespond: number; actions: CounterplayAction[];
  onChoose: (actionId: string) => void; onIgnore: () => void;
};

type RescueWindow = {
  rescueeDisplayName: string; rescueeNetWorth: number; ticksRemaining: number;
  allianceName: string; contributionRequired: number; totalContributed: number;
};

// ─── Core/ML titles ──────────────────────────────────────────────────────────
const CORE_MECHANIC_TITLES: ReadonlyArray<readonly [string, string]> =
  (MECHANICS_DATA as Array<{ mechanic_id: string; title: string }>).map(
    (m) => [m.mechanic_id, m.title] as const,
  );
const ML_MECHANIC_TITLES: ReadonlyArray<readonly [string, string]> =
  (ML_DATA as Array<{ mechanic_id: string; title: string }>).map(
    (m) => [m.mechanic_id, m.title] as const,
  );

// ─── Pure functions ───────────────────────────────────────────────────────────
function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) { h ^= input.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function rng() {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function randomSeed(): number {
  try { const arr = new Uint32Array(1); window.crypto.getRandomValues(arr); return arr[0] || Math.floor(Math.random() * 2 ** 32); }
  catch { return Math.floor(Math.random() * 2 ** 32); }
}

function fmtMoney(n: number) {
  const sign = n < 0 ? '-' : ''; const v = Math.abs(n);
  if (v >= 1_000_000_000) return `${sign}$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1_000_000) return `${sign}$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1_000) return `${sign}$${(v / 1e3).toFixed(1)}K`;
  return `${sign}$${Math.round(v).toLocaleString()}`;
}

function fmtPct01(n: number) { return `${Math.round(n * 100)}%`; }
function idNum(id: string) { const m = id.match(/M(\d+)/i); return m ? Number(m[1]) : 0; }

function keywordTagsFromTitle(title: string): string[] {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 8);
}

function inferFamily(id: string, title: string, kind: MechanicKind): MechanicFamily {
  const t = title.toLowerCase();
  if (t.includes('anti-cheat') || t.includes('fraud') || t.includes('abuse') || t.includes('integrity')) return 'anti_cheat';
  if (t.includes('pvp') || t.includes('matchmaking') || t.includes('duel') || t.includes('opponent')) return 'pvp';
  if (t.includes('season') || t.includes('battle pass') || t.includes('dominion') || t.includes('node') || t.includes('founding era')) return 'season';
  if (t.includes('telemetry') || t.includes('analytics') || t.includes('event bus') || t.includes('observability') || t.includes('verifiable')) return 'telemetry';
  if (t.includes('narrative') || t.includes('story') || t.includes('codex') || t.includes('lore')) return 'narrative';
  if (t.includes('card') || t.includes('deck') || t.includes('draw') || t.includes('hand') || t.includes('shuffle')) return 'cards';
  if (t.includes('market') || t.includes('price') || t.includes('volatility') || t.includes('scarcity') || t.includes('counterparty')) return 'market';
  if (t.includes('risk') || t.includes('fubar') || t.includes('loss') || t.includes('crash') || t.includes('bankruptcy') || t.includes('collapse')) return 'risk';
  if (t.includes('economy') || t.includes('income') || t.includes('cash') || t.includes('yield') || t.includes('roi') || t.includes('monetiz') || t.includes('pricing')) return 'economy';
  if (t.includes('quest') || t.includes('progress') || t.includes('unlock') || t.includes('achievement') || t.includes('tutorial')) return 'progression';
  if (t.includes('social') || t.includes('guild') || t.includes('party') || t.includes('friend') || t.includes('spectator')) return 'social';
  if (t.includes('replay') || t.includes('deterministic') || t.includes('seed')) return 'replay';
  if (t.includes('ops') || t.includes('orchestrator') || t.includes('router') || t.includes('runtime')) return 'ops';
  const n = idNum(id);
  if (kind === 'ml') {
    if (n <= 25) return 'ai'; if (n <= 50) return 'economy'; if (n <= 75) return 'risk';
    if (n <= 100) return 'market'; if (n <= 125) return 'season'; return 'anti_cheat';
  }
  if (n <= 20) return 'replay'; if (n <= 40) return 'cards'; if (n <= 60) return 'economy';
  if (n <= 80) return 'market'; if (n <= 100) return 'progression';
  if (n <= 120) return 'season'; if (n <= 135) return 'pvp'; return 'telemetry';
}

function weightForMechanic(id: string, kind: MechanicKind, family: MechanicFamily): number {
  const n = idNum(id);
  let base = kind === 'ml' ? 0.45 : 0.65;
  if (family === 'economy') base += 0.12;
  if (family === 'risk' || family === 'anti_cheat') base += 0.08;
  if (family === 'season' || family === 'pvp') base += 0.05;
  base += (n % 7) * 0.01;
  return Number(base.toFixed(2));
}

function buildCatalog(): MechanicDef[] {
  const core = CORE_MECHANIC_TITLES.map(([id, title]) => { const family = inferFamily(id, title, 'core'); return { id, title, kind: 'core' as const, family, pairId: `${id}a`, weight: weightForMechanic(id, 'core', family), keywordTags: keywordTagsFromTitle(title) }; });
  const ml = ML_MECHANIC_TITLES.map(([id, title]) => { const family = inferFamily(id, title, 'ml'); const pairId = id.endsWith('a') ? id.slice(0, -1) : undefined; return { id, title, kind: 'ml' as const, family, pairId, weight: weightForMechanic(id, 'ml', family), keywordTags: keywordTagsFromTitle(title) }; });
  return [...core, ...ml];
}

function initRuntime(catalog: MechanicDef[]): Record<string, MechanicRuntimeState> {
  const out: Record<string, MechanicRuntimeState> = {};
  for (const def of catalog) out[def.id] = { enabled: true, activations: 0, lastTick: -1, heat: 0, confidence: def.kind === 'ml' ? 0.5 : 0.6, signal: 0 };
  return out;
}

function decayRuntime(runtime: Record<string, MechanicRuntimeState>) {
  const next: Record<string, MechanicRuntimeState> = {};
  for (const [id, st] of Object.entries(runtime)) next[id] = { ...st, heat: Math.max(0, st.heat - 0.012), confidence: clamp(st.confidence - 0.001, 0.08, 0.99), signal: st.signal * 0.93 };
  return next;
}

// ─── Deck data ────────────────────────────────────────────────────────────────
const SEED_DECK: Card[] = [
  { id: 'opp-001', name: 'Single Family Rental', type: 'OPPORTUNITY' as DeckType, subtype: 'Real Estate', description: 'Cash-flowing rental property in emerging market.', cost: 25000, leverage: 100000, downPayment: 25000, cashflowMonthly: 400, roiPct: 19, cashImpact: null, turnsLost: null, value: null, energyCost: 25000, synergies: [] },
  { id: 'ipa-001', name: 'Dividend Stock Bundle', type: 'IPA' as DeckType, subtype: 'Equities', description: 'High-yield dividend portfolio. Passive income every tick.', cost: 10000, leverage: null, downPayment: null, cashflowMonthly: 120, roiPct: 14, cashImpact: null, turnsLost: null, value: null, energyCost: 10000, synergies: [] },
  { id: 'fubar-001', name: 'Market Crash Wave', type: 'FUBAR' as DeckType, subtype: 'Macro', description: 'Systemic shock hits portfolio value.', cost: null, leverage: null, downPayment: null, cashflowMonthly: null, roiPct: null, cashImpact: -7500, turnsLost: null, value: null, energyCost: 0, synergies: [] },
  { id: 'opp-002', name: 'Digital Business', type: 'OPPORTUNITY' as DeckType, subtype: 'Business', description: 'SaaS micro-business generating recurring revenue.', cost: 15000, leverage: null, downPayment: null, cashflowMonthly: 800, roiPct: 64, cashImpact: null, turnsLost: null, value: null, energyCost: 15000, synergies: [] },
  { id: 'miss-001', name: 'Analysis Paralysis', type: 'MISSED_OPPORTUNITY' as DeckType, subtype: 'Behavior', description: 'You hesitated. The deal closed without you.', cost: null, leverage: null, downPayment: null, cashflowMonthly: null, roiPct: null, cashImpact: null, turnsLost: 3, value: null, energyCost: 0, synergies: [] },
  { id: 'priv-001', name: 'Inherited Network', type: 'PRIVILEGED' as DeckType, subtype: 'Access', description: 'Off-market deal from a warm intro. Unfair advantage activated.', cost: null, leverage: null, downPayment: null, cashflowMonthly: null, roiPct: null, cashImpact: null, turnsLost: null, value: 20000, energyCost: 0, synergies: [] },
];

function generatedCardTypeFromFamily(family: MechanicFamily, h: number): DeckType {
  if (family === 'risk' || family === 'anti_cheat') return 'FUBAR' as DeckType;
  if (family === 'cards') return (h % 4 === 0 ? 'IPA' : 'OPPORTUNITY') as DeckType;
  if (family === 'economy' || family === 'progression') return (h % 3 === 0 ? 'IPA' : 'OPPORTUNITY') as DeckType;
  if (family === 'season' || family === 'social' || family === 'pvp') return (h % 5 === 0 ? 'PRIVILEGED' : 'OPPORTUNITY') as DeckType;
  if (family === 'market') return (h % 4 === 0 ? 'FUBAR' : 'OPPORTUNITY') as DeckType;
  if (family === 'replay' || family === 'telemetry' || family === 'ops' || family === 'narrative') return (h % 2 === 0 ? 'SO' : 'IPA') as DeckType;
  return (h % 6 === 0 ? 'MISSED_OPPORTUNITY' : 'OPPORTUNITY') as DeckType;
}

function subtypeFromFamily(family: MechanicFamily): string {
  const m: Partial<Record<MechanicFamily, string>> = { economy: 'Capital', risk: 'Hazard', market: 'Macro', cards: 'Deck Engine', progression: 'Meta', social: 'Network', telemetry: 'Observability', pvp: 'Arena', season: 'Dominion', ai: 'Inference', anti_cheat: 'Integrity', narrative: 'Lore', ops: 'Runtime', replay: 'Determinism' };
  return m[family] ?? 'System';
}

function buildGeneratedDeck(coreCatalog: MechanicDef[]): Card[] {
  const generated = coreCatalog.map((def) => {
    const h = hashString(def.id + def.title);
    const type = generatedCardTypeFromFamily(def.family, h);
    const baseCost = 2_500 + (h % 11) * 750, incomeBoost = 80 + (h % 9) * 40, roiPct = 8 + (h % 18);
    const isHazard = type === ('FUBAR' as DeckType), isMissed = type === ('MISSED_OPPORTUNITY' as DeckType);
    const isPrivilege = type === ('PRIVILEGED' as DeckType), isObstacle = type === ('SO' as DeckType);
    const labelTail = def.title.replace(/^M\d+[a-z]?\s*[-—:]\s*/i, '');
    return {
      id: `gen-${def.id.toLowerCase()}`, name: `${def.id} • ${labelTail}`, type, subtype: subtypeFromFamily(def.family),
      description: `${def.kind === 'core' ? 'Core mechanic' : 'ML companion'} wired into runtime registry (${def.family}).`,
      cost: isHazard || isMissed || isPrivilege || isObstacle ? null : baseCost,
      leverage: def.family === 'economy' ? baseCost * 3 : null,
      downPayment: def.family === 'economy' ? Math.round(baseCost * 0.25) : null,
      cashflowMonthly: isHazard || isMissed || isPrivilege || isObstacle ? null : incomeBoost,
      roiPct: isHazard || isMissed ? null : roiPct,
      cashImpact: isHazard ? -(1_200 + (h % 7) * 900) : null,
      turnsLost: isMissed ? 1 + (h % 3) : null,
      value: isPrivilege ? 2_500 + (h % 9) * 1_750 : def.family === 'season' ? 1_500 + (h % 7) * 900 : null,
      energyCost: isHazard || isMissed || isPrivilege || isObstacle ? 0 : baseCost, synergies: [],
    } as Card;
  });
  return [...SEED_DECK, ...generated];
}

function drawRandomCards(pool: Card[], n: number, rng: () => number): Card[] {
  const out: Card[] = [];
  for (let i = 0; i < n; i++) { const c = pool[Math.floor(rng() * pool.length)]; if (!c) continue; out.push({ ...c, id: `${c.id}-${Math.floor(rng() * 1e9).toString(36)}` }); }
  return out;
}

// ─── Threat builder ───────────────────────────────────────────────────────────
function buildThreats(regime: MarketRegime, intel: IntelligenceState, cash: number, freezeTicks: number): Threat[] {
  const t: Threat[] = [];
  if (intel.risk > 0.55) t.push({ id: 'threat-risk', label: 'LEVERAGE OVEREXPOSURE', probability: clamp(intel.risk, 0, 1), ticksRemaining: 18, level: intel.risk > 0.75 ? 'CRITICAL' : 'HIGH', mitigated: false });
  if (regime === 'Panic' || regime === 'Compression') t.push({ id: 'threat-regime', label: regime === 'Panic' ? 'MARKET PANIC' : 'CREDIT COMPRESSION', probability: clamp(0.5 + intel.volatility * 0.4, 0, 1), ticksRemaining: 24, level: regime === 'Panic' ? 'CRITICAL' : 'HIGH', mitigated: false });
  if (cash < 8_000) t.push({ id: 'threat-liquidity', label: 'LIQUIDITY CRISIS', probability: clamp(1 - (cash / 8_000), 0, 1), ticksRemaining: 12, level: cash < 3_000 ? 'CRITICAL' : 'HIGH', mitigated: false });
  if (freezeTicks > 3) t.push({ id: 'threat-freeze', label: 'ACTION PARALYSIS', probability: 0.70, ticksRemaining: freezeTicks, level: 'MEDIUM', mitigated: false });
  if (intel.churnRisk > 0.60) t.push({ id: 'threat-churn', label: 'RUN ABANDONMENT RISK', probability: clamp(intel.churnRisk, 0, 1), ticksRemaining: 36, level: 'MEDIUM', mitigated: false });
  return t;
}

// ─── Replay event builder ─────────────────────────────────────────────────────
function buildReplayEvents(telemetry: TelemetryEnvelopeV2[]): ReplayEvent[] {
  const kindMap: Record<string, ReplayEvent['kind']> = {
    'cards.play': 'CARD_PLAYED', 'fate.fubar_hit': 'FATE', 'fate.missed': 'FATE',
    'fate.privilege': 'MILESTONE', 'macro.event': 'REGIME_CHANGE',
    'economy.monthly_settlement': 'CARD_PLAYED', 'shield.proc': 'CARD_PLAYED',
  };
  const emojiMap: Record<string, string> = {
    'cards.play': '💳', 'fate.fubar_hit': '💀', 'fate.missed': '😬',
    'fate.privilege': '⭐', 'macro.event': '📉', 'shield.proc': '🛡️',
  };
  return telemetry.filter((ev) => kindMap[ev.type]).map((ev) => ({
    tick: ev.tick, kind: kindMap[ev.type] as ReplayEvent['kind'],
    label: `${ev.type.replace('.', ' ').toUpperCase()} T+${ev.tick}`,
    netWorthAtTick: Number(ev.payload.netWorth ?? 0), emoji: emojiMap[ev.type],
  }));
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────
function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const w = 200, h = 48, min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  return <svg width={w} height={h} className="overflow-visible"><polyline points={pts} fill="none" stroke={data[data.length - 1] >= data[0] ? '#10b981' : '#ef4444'} strokeWidth={1.5} /></svg>;
}

function Metric({ label, value, success = false, danger = false }: { label: string; value: string; success?: boolean; danger?: boolean }) {
  return (
    <div className="flex flex-col min-w-[72px]">
      <span className="text-zinc-500 uppercase tracking-wide">{label}</span>
      <span className={`font-mono font-bold ${danger ? 'text-red-400' : success ? 'text-emerald-400' : 'text-white'}`}>{value}</span>
    </div>
  );
}

function HUD(props: { cash: number; income: number; expenses: number; tick: number; shields: number; netWorth: number; equityHistory: number[]; regime: MarketRegime; intelligence: IntelligenceState; season: SeasonState; runMode: RunMode; activeMechanics: number; telemetryCount: number; freezeTicks: number; haterSabotages: number }) {
  const { cash, income, expenses, tick, shields, netWorth, equityHistory, regime, intelligence, season, runMode, activeMechanics, telemetryCount, freezeTicks, haterSabotages } = props;
  const cashflow = income - expenses, pct = Math.round((tick / RUN_TICKS) * 100);
  return (
    <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-2 flex items-center gap-4 flex-wrap text-xs">
      <Metric label="Cash" value={fmtMoney(cash)} danger={cash < 5000} />
      <Metric label="Net Worth" value={fmtMoney(netWorth)} />
      <Metric label="Cashflow/mo" value={`${cashflow >= 0 ? '+' : ''}${fmtMoney(cashflow)}`} success={cashflow >= 0} danger={cashflow < 0} />
      <Metric label="Income/mo" value={fmtMoney(income)} success />
      <Metric label="Expenses/mo" value={fmtMoney(expenses)} danger />
      <Metric label="Regime" value={regime} />
      <Metric label="Mode" value={runMode} />
      <Metric label="AI Alpha" value={fmtPct01(intelligence.alpha)} />
      <Metric label="Risk" value={fmtPct01(intelligence.risk)} />
      <Metric label="Pass" value={`T${season.passTier}`} />
      <Metric label="Dominion" value={`${season.dominionControl}`} />
      <Metric label="Mechs" value={`${activeMechanics}/300`} />
      <Metric label="Events" value={`${telemetryCount}`} />
      <Metric label="Freeze" value={freezeTicks > 0 ? `${freezeTicks}t` : '—'} />
      <Metric label="Sabotaged" value={`${haterSabotages}x`} danger={haterSabotages > 0} />
      <div className="flex flex-col">
        <span className="text-zinc-500 uppercase tracking-wide">Shields</span>
        <span className="text-yellow-400 font-mono">{Array(shields).fill('🛡️').join(' ') || '—'}</span>
      </div>
      <div className="flex flex-col flex-1 min-w-[220px]">
        <div className="flex justify-between mb-0.5">
          <span className="text-zinc-500 uppercase tracking-wide">Run Progress</span>
          <span className="text-zinc-400">{pct}%</span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full"><div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
      </div>
      <Sparkline data={equityHistory} />
    </div>
  );
}

function LogFeed({ events }: { events: string[] }) {
  return (
    <div className="bg-zinc-950 border-t border-zinc-800 h-32 overflow-y-auto px-4 py-2">
      {[...events].reverse().map((e, i) => <p key={i} className={`text-xs font-mono ${i === 0 ? 'text-white' : 'text-zinc-500'}`}>{e}</p>)}
    </div>
  );
}

function ResultScreen({ cash, netWorth, income, expenses, season, intelligence, onRestart }: { cash: number; netWorth: number; income: number; expenses: number; season: SeasonState; intelligence: IntelligenceState; onRestart: () => void }) {
  const cashflow = income - expenses, won = cashflow > 0 && netWorth > 100_000;
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 text-white p-8 gap-6">
      <div className={`text-5xl font-black tracking-tight ${won ? 'text-emerald-400' : 'text-red-400'}`}>{won ? '🏆 FREEDOM UNLOCKED' : '💀 WIPE'}</div>
      <p className="text-zinc-400 text-lg">{won ? 'Passive income exceeds expenses. You are free.' : 'You ran out of time or capital.'}</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center max-w-4xl w-full">
        {[['Final Cash', fmtMoney(cash), cash > 0 ? 'text-emerald-400' : 'text-red-400'], ['Net Worth', fmtMoney(netWorth), 'text-white'], ['Monthly Income', fmtMoney(income), 'text-emerald-400'], ['Cashflow', `${cashflow >= 0 ? '+' : ''}${fmtMoney(cashflow)}`, cashflow >= 0 ? 'text-emerald-400' : 'text-red-400'], ['Battle Pass Tier', `T${season.passTier}`, 'text-indigo-300'], ['AI Alpha', fmtPct01(intelligence.alpha), 'text-cyan-300']].map(([label, val, color]) => (
          <div key={label as string} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">{label}</p>
            <p className={`font-mono font-bold text-xl ${color}`}>{val}</p>
          </div>
        ))}
      </div>
      <button onClick={onRestart} className="mt-4 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-lg transition-colors">Play Again</button>
    </div>
  );
}

function MechanicsPanel({ catalog, runtime, filter, setFilter, search, setSearch, selectedId, setSelectedId }: { catalog: MechanicDef[]; runtime: Record<string, MechanicRuntimeState>; filter: MechanicsFilter; setFilter: (f: MechanicsFilter) => void; search: string; setSearch: (v: string) => void; selectedId: string | null; setSelectedId: (v: string | null) => void }) {
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter((m) => { if (filter !== 'all' && m.kind !== filter) return false; if (!q) return true; return m.id.toLowerCase().includes(q) || m.title.toLowerCase().includes(q) || m.family.includes(q) || m.keywordTags.some((k) => k.includes(q)); });
  }, [catalog, filter, search]);
  const selected = selectedId ? catalog.find((c) => c.id === selectedId) : rows[0];
  const sr = selected ? runtime[selected.id] : undefined;
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-3 border-b border-zinc-800 flex flex-wrap gap-2 items-center">
          <div className="font-bold text-sm">Mechanics Registry (300)</div>
          <div className="ml-auto flex gap-2">{(['all', 'core', 'ml'] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={`px-2 py-1 rounded text-xs border ${filter === f ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-300'}`}>{f.toUpperCase()}</button>)}</div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search MID / title / family..." className="w-full mt-2 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 outline-none" />
        </div>
        <div className="max-h-[320px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-zinc-950 text-zinc-400"><tr><th className="text-left p-2">ID</th><th className="text-left p-2">Title</th><th className="text-left p-2">Family</th><th className="text-left p-2">Type</th><th className="text-right p-2">Act</th><th className="text-right p-2">Heat</th></tr></thead>
            <tbody>
              {rows.slice(0, 300).map((m) => { const r = runtime[m.id]; const active = (r?.lastTick ?? -1) >= 0; return (
                <tr key={m.id} onClick={() => setSelectedId(m.id)} className={`border-t border-zinc-800 cursor-pointer ${selectedId === m.id ? 'bg-zinc-800/70' : 'hover:bg-zinc-800/40'}`}>
                  <td className="p-2 font-mono text-zinc-200">{m.id}</td><td className="p-2 text-zinc-300">{m.title}</td>
                  <td className="p-2"><span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">{m.family}</span></td>
                  <td className="p-2"><span className={`px-1.5 py-0.5 rounded ${m.kind === 'core' ? 'bg-indigo-900/50 text-indigo-300' : 'bg-cyan-900/50 text-cyan-300'}`}>{m.kind.toUpperCase()}</span></td>
                  <td className="p-2 text-right font-mono text-zinc-300">{r?.activations ?? 0}</td>
                  <td className={`p-2 text-right font-mono ${active ? 'text-emerald-300' : 'text-zinc-500'}`}>{(r?.heat ?? 0).toFixed(2)}</td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="text-sm font-bold mb-3">Mechanic Inspector</div>
        {!selected ? <div className="text-zinc-500 text-sm">Select a mechanic.</div> : (
          <div className="space-y-3 text-xs">
            <div><div className="text-zinc-500 uppercase">ID</div><div className="font-mono text-zinc-100">{selected.id}</div></div>
            <div><div className="text-zinc-500 uppercase">Title</div><div className="text-zinc-100">{selected.title}</div></div>
            <div className="grid grid-cols-2 gap-3">
              <div><div className="text-zinc-500 uppercase">Kind</div><div className="text-zinc-100">{selected.kind}</div></div>
              <div><div className="text-zinc-500 uppercase">Family</div><div className="text-zinc-100">{selected.family}</div></div>
              <div><div className="text-zinc-500 uppercase">Pair</div><div className="font-mono text-zinc-100">{selected.pairId || '—'}</div></div>
              <div><div className="text-zinc-500 uppercase">Weight</div><div className="font-mono text-zinc-100">{selected.weight.toFixed(2)}</div></div>
            </div>
            <div><div className="text-zinc-500 uppercase">Keywords</div><div className="flex flex-wrap gap-1 mt-1">{selected.keywordTags.map((k) => <span key={k} className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">{k}</span>)}</div></div>
            <div className="border-t border-zinc-800 pt-3">
              <div className="text-zinc-500 uppercase mb-2">Runtime State</div>
              <div className="grid grid-cols-2 gap-2 font-mono">
                <div className="bg-zinc-950 rounded p-2">enabled: {String(sr?.enabled ?? false)}</div>
                <div className="bg-zinc-950 rounded p-2">act: {sr?.activations ?? 0}</div>
                <div className="bg-zinc-950 rounded p-2">lastTick: {sr?.lastTick ?? -1}</div>
                <div className="bg-zinc-950 rounded p-2">heat: {(sr?.heat ?? 0).toFixed(3)}</div>
                <div className="bg-zinc-950 rounded p-2">conf: {(sr?.confidence ?? 0).toFixed(3)}</div>
                <div className="bg-zinc-950 rounded p-2">signal: {(sr?.signal ?? 0).toFixed(3)}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  // ── Engine Layer Bridge ───────────────────────────────────────────────
  // useGameMode wires LobbyScreen selections to the sovereign engine stack.
  // modeState is available here for passing down to game screens.
  const gameModeHook = useGameMode();

  const catalog = useMemo(() => buildCatalog(), []);
  const coreCatalog = useMemo(() => catalog.filter((m) => m.kind === 'core'), [catalog]);
  const mlCatalog   = useMemo(() => catalog.filter((m) => m.kind === 'ml'),   [catalog]);
  const deckPool    = useMemo(() => buildGeneratedDeck(coreCatalog), [coreCatalog]);
  const validMechanicIds = useMemo(() => new Set(catalog.map((m) => m.id)), [catalog]);

  const rngRef  = useRef<() => number>(() => Math.random());
  const seedRef = useRef<number>(0);

  // ── Core ──────────────────────────────────────────────────────────────
  const [screen,     setScreen]     = useState<Screen>('landing');
  const [cash,       setCash]       = useState(STARTING_CASH);
  const [income,     setIncome]     = useState(STARTING_INCOME);
  const [expenses,   setExpenses]   = useState(STARTING_EXPENSES);
  const [netWorth,   setNetWorth]   = useState(STARTING_CASH);
  const [shields,    setShields]    = useState(0);
  const [shieldConsuming, setShieldConsuming] = useState(false);
  const [tick,       setTick]       = useState(0);
  const [hand,       setHand]       = useState<Card[]>([]);
  const [events,     setEvents]     = useState<string[]>([]);
  const [equityHistory, setEquityHistory] = useState<number[]>([STARTING_CASH]);
  const [freezeTicks, setFreezeTicks] = useState(0);
  const [haterSabotageCount, setHaterSabotageCount] = useState(0);
  const auth = useAuth();

  // ── Config ────────────────────────────────────────────────────────────
  const [runMode,  setRunMode]  = useState<RunMode>('solo');
  const [regime,   setRegime]   = useState<MarketRegime>('Stable');

  // ── Mechanics ─────────────────────────────────────────────────────────
  const [mechanicsFilter,    setMechanicsFilter]    = useState<MechanicsFilter>('all');
  const [mechanicsSearch,    setMechanicsSearch]    = useState('');
  const [selectedMechanicId, setSelectedMechanicId] = useState<string | null>('M01');
  const [runtime,    setRuntime]    = useState<Record<string, MechanicRuntimeState>>(() => initRuntime(catalog));
  const [telemetry,  setTelemetry]  = useState<TelemetryEnvelopeV2[]>([]);

  // ── ML / Season ───────────────────────────────────────────────────────
  const [intelligence, setIntelligence] = useState<IntelligenceState>({ alpha: 0.45, risk: 0.35, volatility: 0.30, antiCheat: 0.50, personalization: 0.40, rewardFit: 0.45, recommendationPower: 0.42, churnRisk: 0.28, momentum: 0.33 });
  const [season,       setSeason]       = useState<SeasonState>({ xp: 0, passTier: 1, dominionControl: 0, nodePressure: 0, winStreak: 0, battlePassLevel: 1, rewardsPending: 0 });

  // ── P17 new component state ───────────────────────────────────────────
  const threats = useMemo(() => buildThreats(regime, intelligence, cash, freezeTicks), [regime, intelligence, cash, freezeTicks]);

  const [activeSabotages,   setActiveSabotages]   = useState<ActiveSabotage[]>([]);
  const [pendingCounterplay, setPendingCounterplay] = useState<PendingCounterplay | null>(null);

  const [battlePhase, setBattlePhase] = useState<BattlePhase>('PREP');
  const [battleScore, setBattleScore] = useState({ local: 0, opponent: 0 });
  const [battleRound, setBattleRound] = useState(1);

  const [showAidComposer, setShowAidComposer] = useState(false);
  const [rescueWindow,    setRescueWindow]    = useState<RescueWindow | null>(null);

  const allianceMembers = useMemo(() => [
    { id: 'ally-1', displayName: 'CIPHER_9', netWorth: Math.round(netWorth * 0.6) },
    { id: 'ally-2', displayName: 'APEX_7',   netWorth: Math.round(netWorth * 0.4) },
    { id: 'ally-3', displayName: 'ZERO_X',   netWorth: Math.round(netWorth * 0.8) },
  ], [netWorth]);

  const battleParticipants: BattleParticipant[] = useMemo(() => [
    { id: 'local', displayName: auth.user?.username ?? 'SOVEREIGN', netWorth, haterHeat: haterSabotageCount, isLocal: true },
    { id: 'ghost', displayName: 'RIVAL_BOT', netWorth: Math.round(netWorth * (0.7 + intelligence.risk * 0.4)), haterHeat: 0, isLocal: false },
  ], [auth.user, netWorth, haterSabotageCount, intelligence.risk]);

  const replayEvents = useMemo(() => buildReplayEvents(telemetry), [telemetry]);

  // ── Helpers ────────────────────────────────────────────────────────────
  const log = useCallback((msg: string) => {
    setEvents((prev) => [...prev.slice(-(MAX_LOG - 1)), `[T${tick}] ${msg}`]);
  }, [tick]);

  const emitTelemetry = useCallback((type: string, payload: TelemetryEnvelopeV2['payload']) => {
    setTelemetry((prev) => [...prev.slice(-299), { tick, type, payload }]);
  }, [tick]);

  const touchMechanic = useCallback((id: string, signal = 0.12) => {
    setRuntime((prev) => { const current = prev[id]; if (!current) return prev; return { ...prev, [id]: { ...current, activations: current.activations + 1, lastTick: tick, heat: clamp(current.heat + 0.12 + signal * 0.25, 0, 5), confidence: clamp(current.confidence + 0.01 + signal * 0.05, 0.08, 0.99), signal: clamp(current.signal + signal, -3, 3) } }; });
  }, [tick]);

  const touchFamily = useCallback((family: MechanicFamily, baseSignal = 0.10) => {
    const corePick = coreCatalog.find((m) => m.family === family);
    const mlPick = mlCatalog.find((m) => m.family === family) || mlCatalog[idNum(corePick?.id || 'M01') - 1] || mlCatalog[0];
    if (corePick) touchMechanic(corePick.id, baseSignal);
    if (mlPick) touchMechanic(mlPick.id, baseSignal + 0.04);
  }, [coreCatalog, mlCatalog, touchMechanic]);

  // ── Sabotage expiry ────────────────────────────────────────────────────
  useEffect(() => {
    if (activeSabotages.length === 0) return;
    setActiveSabotages((prev) => prev.map((s) => ({ ...s, ticksRemaining: s.ticksRemaining - 1 })).filter((s) => s.ticksRemaining > 0));
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Battle lifecycle ───────────────────────────────────────────────────
  useEffect(() => {
    if (runMode !== 'asymmetric-pvp' || screen !== 'run') return;
    if (tick > 0 && tick % 60 === 0) {
      setBattlePhase('ACTIVE');
      const delta = intelligence.alpha > intelligence.risk ? 1 : -1;
      setBattleScore((s) => ({ local: s.local + (delta > 0 ? 1 : 0), opponent: s.opponent + (delta < 0 ? 1 : 0) }));
      setBattleRound((r) => r + 1);
      touchFamily('pvp', 0.18);
      emitTelemetry('pvp.round', { round: battleRound, localScore: battleScore.local, opponentScore: battleScore.opponent });
    }
  }, [tick, runMode, screen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Rescue window pulse ────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'run' || runMode === 'solo') return;
    if (tick > 0 && tick % 120 === 0 && !rescueWindow && rngRef.current() < 0.25) {
      setRescueWindow({ rescueeDisplayName: 'CIPHER_9', rescueeNetWorth: Math.round(netWorth * 0.3), ticksRemaining: 30, allianceName: 'APEX SYNDICATE', contributionRequired: 10000, totalContributed: Math.round(cash * 0.05) });
    }
    if (rescueWindow) {
      setRescueWindow((rw) => rw ? { ...rw, ticksRemaining: rw.ticksRemaining - 1 } : null);
      if (rescueWindow.ticksRemaining <= 1) setRescueWindow(null);
    }
  }, [tick, screen, runMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sabotage handler ───────────────────────────────────────────────────
  const handleSabotage = useCallback((event: SabotageEvent) => {
    setHaterSabotageCount((n) => n + 1);
    const { cardType, intensity } = event;
    const kindMap: Partial<Record<SabotageCardType, SabotageKind>> = { EMERGENCY_EXPENSE: 'INCOME_DRAIN', INCOME_SEIZURE: 'INCOME_DRAIN', DEBT_SPIRAL: 'INCOME_DRAIN', INSPECTION_NOTICE: 'CARD_BLOCK', MARKET_CORRECTION: 'INCOME_DRAIN', TAX_AUDIT: 'CARD_BLOCK', LAYOFF_EVENT: 'INCOME_DRAIN', RENT_HIKE: 'INCOME_DRAIN', CREDIT_DOWNGRADE: 'INCOME_DRAIN', SYSTEM_GLITCH: 'CARD_BLOCK' };
    setActiveSabotages((prev) => [...prev.slice(-4), { id: `sab-${tick}-${cardType}`, kind: kindMap[cardType as SabotageCardType] ?? 'INCOME_DRAIN', label: (cardType as string).replace(/_/g, ' '), severity: intensity > 0.7 ? 'CRITICAL' : intensity > 0.4 ? 'MAJOR' : 'MINOR', ticksRemaining: Math.ceil(SABOTAGE_BASE_TICKS * intensity), sourceDisplayName: event.haterName, impactValue: Math.round(500 * intensity) }]);
    switch (cardType as SabotageCardType) {
      case 'EMERGENCY_EXPENSE': { const hit = Math.round(2_500 * intensity); setCash((c) => Math.max(0, c - hit)); log(`💥 ${event.haterName}: EMERGENCY EXPENSE — -$${hit.toLocaleString()}`); touchFamily('risk', 0.30); break; }
      case 'INCOME_SEIZURE': { const cuts = Math.ceil(3 * intensity); setFreezeTicks((f) => f + cuts); setIncome((i) => Math.max(500, Math.round(i * (1 - 0.15 * intensity)))); log(`💥 ${event.haterName}: INCOME SEIZURE — income cut, ${cuts} tick freeze`); break; }
      case 'DEBT_SPIRAL': { const s = Math.round(800 * intensity); setExpenses((e) => e + s); log(`💥 ${event.haterName}: DEBT SPIRAL — +$${s}/mo`); touchFamily('risk', 0.28); break; }
      case 'INSPECTION_NOTICE': { setFreezeTicks((f) => f + Math.ceil(4 * intensity)); log(`💥 ${event.haterName}: INSPECTION NOTICE`); break; }
      case 'MARKET_CORRECTION': { const haircut = Math.round(0.12 * intensity); setNetWorth((nw) => Math.round(nw * (1 - haircut))); log(`💥 ${event.haterName}: MARKET CORRECTION — net worth -${Math.round(haircut * 100)}%`); touchFamily('market', 0.30); break; }
      case 'TAX_AUDIT': { const drain = Math.round(3_500 * intensity); const freeze = Math.ceil(2 * intensity); setCash((c) => Math.max(0, c - drain)); setFreezeTicks((f) => f + freeze); log(`💥 ${event.haterName}: TAX AUDIT — -$${drain.toLocaleString()} + ${freeze} tick freeze`); break; }
      case 'LAYOFF_EVENT': { const duration = Math.ceil(5 * intensity); setFreezeTicks((f) => f + duration); setIncome((i) => Math.max(0, Math.round(i * 0.3))); log(`💥 ${event.haterName}: LAYOFF EVENT — income gutted for ~${duration} ticks`); break; }
      case 'RENT_HIKE': { const hike = Math.round(600 * intensity); setExpenses((e) => e + hike); log(`💥 ${event.haterName}: RENT HIKE — +$${hike}/mo`); break; }
      case 'CREDIT_DOWNGRADE': { setExpenses((e) => e + Math.round(400 * intensity)); log(`💥 ${event.haterName}: CREDIT DOWNGRADE`); break; }
      case 'SYSTEM_GLITCH': { setFreezeTicks((f) => f + 3); log(`💥 ${event.haterName}: SYSTEM GLITCH`); break; }
    }
  }, [log, touchFamily, tick]);

  // ── Counterplay resolution ─────────────────────────────────────────────
  const handleCounterplayChoose = useCallback((actionId: string) => {
    if (!pendingCounterplay) return;
    const action = pendingCounterplay.actions.find((a) => a.id === actionId);
    if (!action) return;
    setCash((c) => Math.max(0, c - action.cost));
    const success = Math.random() < action.successChance;
    log(success ? `✅ Counterplay resolved: ${action.label}` : `❌ Counterplay failed: ${action.label}`);
    emitTelemetry(success ? 'counterplay.success' : 'counterplay.fail', { actionId, cost: action.cost });
    if (success) touchFamily('risk', -0.15);
    setPendingCounterplay(null);
  }, [pendingCounterplay, log, emitTelemetry, touchFamily]);

  // ── Aid submission ─────────────────────────────────────────────────────
  const handleAidSubmit = useCallback((contract: AidContract) => {
    if (contract.aidType === 'CASH') setCash((c) => Math.max(0, c - contract.amount));
    log(`📤 Aid sent to ${contract.recipientId}: ${contract.aidType}${contract.aidType === 'CASH' ? ' ' + fmtMoney(contract.amount) : ''}`);
    emitTelemetry('alliance.aid_sent', { recipientId: contract.recipientId, aidType: contract.aidType, amount: contract.amount });
    touchFamily('social', 0.20);
    setShowAidComposer(false);
  }, [log, emitTelemetry, touchFamily]);

  const activeMechanics = useMemo(() => Object.values(runtime).filter((r) => r.enabled).length, [runtime]);

  useEffect(() => {
    setSeason((prev) => { const tier = Math.max(1, Math.floor(prev.xp / 100) + 1); if (tier === prev.passTier && tier === prev.battlePassLevel) return prev; return { ...prev, passTier: tier, battlePassLevel: tier }; });
  }, [season.xp]);

  // ── Tick engine ────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'run') return;
    if (tick >= RUN_TICKS) { setScreen('result'); return; }

    const timer = setTimeout(() => {
      setTick((t) => t + 1);
      setRuntime((prev) => decayRuntime(prev));

      setIntelligence((prev) => {
        const cashflow = income - expenses;
        return {
          alpha:               clamp(prev.alpha + (cashflow > 0 ? 0.004 : -0.003) + (season.winStreak > 0 ? 0.002 : 0) + (regime === 'Expansion' ? 0.002 : regime === 'Panic' ? -0.004 : 0), 0.05, 0.99),
          risk:                clamp(prev.risk + (cash < 10_000 ? 0.006 : -0.002) + (regime === 'Panic' ? 0.005 : 0) - (shields > 0 ? 0.002 : 0), 0.02, 0.99),
          volatility:          clamp(prev.volatility + (regime === 'Compression' ? 0.004 : regime === 'Euphoria' ? 0.005 : -0.001), 0.05, 0.99),
          antiCheat:           clamp(prev.antiCheat + 0.001 - (runMode === 'asymmetric-pvp' ? 0.0005 : 0), 0.10, 0.99),
          personalization:     clamp(prev.personalization + 0.002, 0.10, 0.99),
          rewardFit:           clamp(prev.rewardFit + (season.xp > 0 ? 0.002 : 0.001), 0.10, 0.99),
          recommendationPower: clamp(prev.recommendationPower + 0.002, 0.10, 0.99),
          churnRisk:           clamp(prev.churnRisk + (cashflow < 0 ? 0.004 : -0.003) + (freezeTicks > 0 ? 0.002 : 0), 0.02, 0.99),
          momentum:            clamp(prev.momentum + (cashflow > 0 ? 0.005 : -0.004), 0.02, 0.99),
        };
      });

      const pulseA = coreCatalog[tick % coreCatalog.length];
      const pulseB = mlCatalog[tick % mlCatalog.length];
      if (pulseA) touchMechanic(pulseA.id, 0.05);
      if (pulseB) touchMechanic(pulseB.id, 0.07);

      if (tick % 10 === 0) { emitTelemetry('runtime.pulse', { activeMechanics, cash, income, expenses, netWorth, alpha: Number(intelligence.alpha.toFixed(3)), risk: Number(intelligence.risk.toFixed(3)) }); touchFamily('telemetry', 0.08); }

      if (freezeTicks > 0) setFreezeTicks((v) => Math.max(0, v - 1));

      if (tick % MONTH_TICKS === 0) {
        const cashflow = income - expenses;
        const mlMod = 1 + (intelligence.alpha - intelligence.risk) * 0.04;
        const settlement = Math.round(cashflow * mlMod);
        setCash((c) => {
          const next = c + settlement;
          if (next <= 0 && shields === 0) { setScreen('bankrupt'); return 0; }
          if (next <= 0 && shields > 0) { setShields((s) => s - 1); setShieldConsuming(true); setTimeout(() => setShieldConsuming(false), 400); log('🛡️ Shield absorbed bankruptcy!'); emitTelemetry('shield.proc', { cashBefore: c, settlement, shields }); touchFamily('risk', 0.20); return 5000; }
          return next;
        });
        setNetWorth((nw) => nw + settlement);
        setEquityHistory((h) => [...h.slice(-(MAX_EQUITY_POINTS - 1)), netWorth + settlement]);
        setSeason((prev) => ({ ...prev, xp: prev.xp + Math.max(5, Math.round(Math.max(0, settlement) / 500)), dominionControl: clamp(prev.dominionControl + (settlement > 0 ? 1 : -1), 0, 9999), nodePressure: clamp(prev.nodePressure + (settlement < 0 ? 2 : -1), 0, 9999), rewardsPending: prev.rewardsPending + (settlement > 0 ? 1 : 0), winStreak: settlement > 0 ? prev.winStreak + 1 : 0 }));
        emitTelemetry('economy.monthly_settlement', { settlement, cashflow, mlMod: Number(mlMod.toFixed(3)), cash, income, expenses, netWorth });
        touchFamily('economy', 0.18); touchFamily('ai', 0.14);
      }

      // FATE DECK
      if (tick % FATE_TICKS === 0 && tick > 0) {
        const r = rngRef.current();
        const fateType: DeckType = r < FATE_FUBAR_PCT ? 'FUBAR' : r < FATE_FUBAR_PCT + FATE_MISSED_PCT ? 'MISSED_OPPORTUNITY' : r < FATE_FUBAR_PCT + FATE_MISSED_PCT + FATE_SO_PCT ? 'SO' : 'PRIVILEGED';
        const fatePool = deckPool.filter((c) => c.type === (fateType as unknown as DeckType));
        if (fatePool.length > 0) {
          const fateCard = fatePool[Math.floor(rngRef.current() * fatePool.length)];
          const fateHit = fateCard.cashImpact ?? -2_000;
          const riskScale = 1.5 + intelligence.risk * 0.6 + intelligence.volatility * 0.4;
          const adjustedHit = Math.round(fateHit * riskScale);
          const offerCounterplay = fateCard.type === ('FUBAR' as DeckType) && Math.abs(adjustedHit) > 4_000 && shields === 0;

          if (offerCounterplay) {
            const counterActions: CounterplayAction[] = [
              { id: 'hedge', label: 'Hedge Position', description: 'Deploy capital buffer to absorb shock.', cost: Math.round(Math.abs(adjustedHit) * 0.3), successChance: 0.75, emoji: '🛡️', available: cash >= Math.round(Math.abs(adjustedHit) * 0.3) },
              { id: 'liquidate', label: 'Emergency Liquidation', description: 'Sell assets — absorbs 50% of hit.', cost: Math.round(Math.abs(adjustedHit) * 0.15), successChance: 0.90, emoji: '💰', available: cash >= Math.round(Math.abs(adjustedHit) * 0.15) },
              { id: 'ignore', label: 'Take the Full Hit', description: 'Accept reality.', cost: 0, successChance: 0.0, emoji: '💀', available: true },
            ];
            setPendingCounterplay({
              eventLabel: fateCard.name, eventDescription: `Systemic shock incoming: ${fmtMoney(adjustedHit)}.`, eventEmoji: '⚠️', ticksToRespond: 8, actions: counterActions,
              onChoose: handleCounterplayChoose,
              onIgnore: () => { setCash((c) => Math.max(0, c + adjustedHit)); log(`💥 FATE (uncontested): ${fateCard.name} → ${fmtMoney(adjustedHit)}`); emitTelemetry('fate.fubar_hit', { cardId: fateCard.id, hit: adjustedHit }); touchFamily('risk', 0.25); setPendingCounterplay(null); },
            });
          } else if (fateCard.type === ('FUBAR' as DeckType)) {
            if (shields > 0) { setShields((s) => s - 1); log(`🛡️ Shield blocked: ${fateCard.name}`); emitTelemetry('fate.fubar_blocked', { cardId: fateCard.id, shields }); }
            else { setCash((c) => Math.max(0, c + adjustedHit)); setSeason((prev) => ({ ...prev, nodePressure: prev.nodePressure + 3, winStreak: 0 })); log(`💥 FATE: ${fateCard.name} → ${fmtMoney(adjustedHit)}`); emitTelemetry('fate.fubar_hit', { cardId: fateCard.id, hit: adjustedHit, riskScale: Number(riskScale.toFixed(2)) }); touchFamily('risk', 0.25); }
          } else if (fateCard.type === ('MISSED_OPPORTUNITY' as DeckType)) {
            const lost = Math.max(2, (fateCard.turnsLost ?? 1) + Math.floor(rngRef.current() * 3));
            setFreezeTicks((f) => f + lost); setSeason((prev) => ({ ...prev, nodePressure: prev.nodePressure + 2, winStreak: 0 }));
            log(`😬 FATE: ${fateCard.name} — freeze ${lost}t`); emitTelemetry('fate.missed', { cardId: fateCard.id, turnsLost: lost });
          } else if (fateCard.type === ('SO' as DeckType)) {
            const expenseHit = Math.round(200 + rngRef.current() * 500);
            setExpenses((e) => e + expenseHit); setSeason((prev) => ({ ...prev, nodePressure: prev.nodePressure + 1 }));
            log(`🚧 FATE: ${fateCard.name} — +${fmtMoney(expenseHit)}/mo`); emitTelemetry('fate.obstacle', { cardId: fateCard.id, expenseHit });
          } else {
            const v = fateCard.value ?? 0; setNetWorth((nw) => nw + v);
            setSeason((prev) => ({ ...prev, xp: prev.xp + 20, rewardsPending: prev.rewardsPending + 1 }));
            log(`⭐ FATE (RARE): ${fateCard.name} — +${fmtMoney(v)}`); emitTelemetry('fate.privilege', { cardId: fateCard.id, value: v });
          }
        }
      }

      // Draw
      if (tick % DRAW_TICKS === 0 && hand.length < MAX_HAND && freezeTicks === 0) {
        const pool = deckPool.filter((c) => c.type === 'OPPORTUNITY' || c.type === 'IPA');
        let drawn = drawRandomCards(pool, 1, rngRef.current)[0];
        if (drawn && drawn.type === ('FUBAR' as DeckType) && (intelligence.recommendationPower - intelligence.risk) > 0.20 && rngRef.current() < 0.55) {
          const r = drawRandomCards(deckPool.filter((c) => c.type !== ('FUBAR' as DeckType)), 1, rngRef.current)[0];
          if (r) { drawn = r; touchFamily('ai', 0.15); log(`🧠 ML rerouted draw → ${drawn.name}`); }
        }
        if (drawn) { setHand((h) => [...h, drawn]); log(`📬 Drew: ${drawn.name}`); emitTelemetry('cards.draw', { cardId: drawn.id, cardType: drawn.type, handSize: hand.length + 1 }); touchFamily('cards', 0.16); }
      }

      // Macro events
      if (tick % 55 === 0 && tick > 0) {
        const macroEvents: MacroEvent[] = [
          { id: 'bull',      label: '📈 Bull run! Income assets +10%',   apply: () => { setIncome((i) => Math.round(i * 1.1));    setRegime('Expansion');   touchFamily('market', 0.22); } },
          { id: 'recession', label: '📉 Recession hits. Expenses +12%',  apply: () => { setExpenses((e) => Math.round(e * 1.12)); setRegime('Compression'); touchFamily('risk', 0.24); } },
          { id: 'rally',     label: '💹 Market rally. Net worth +8%',    apply: () => { setNetWorth((nw) => Math.round(nw * 1.08)); setRegime('Euphoria');  touchFamily('market', 0.20); } },
          { id: 'bill',      label: '🔥 Unexpected bill. -$2,000 cash.', apply: () => { setCash((c) => c - 2000);                  setRegime('Panic');      touchFamily('risk', 0.22); } },
          { id: 'integrity', label: '🛡️ Integrity sweep grants shield.', apply: () => { setShields((s) => s + 1);                 setRegime('Stable');     touchFamily('anti_cheat', 0.25); } },
        ];
        const ev = macroEvents[Math.floor(rngRef.current() * macroEvents.length)];
        ev.apply(); log(ev.label); emitTelemetry('macro.event', { id: ev.id, label: ev.label, regime });
      }

      // Season pulse
      if (tick % 60 === 0 && tick > 0) {
        setSeason((prev) => ({ ...prev, xp: prev.xp + 12, dominionControl: prev.dominionControl + 1, nodePressure: clamp(prev.nodePressure + (prev.dominionControl % 3 === 0 ? 1 : -1), 0, 9999) }));
        touchFamily('season', 0.18); emitTelemetry('season.pulse', { xp: season.xp, tier: season.passTier, dominion: season.dominionControl });
      }

      // PvP ghost
      if (tick % 75 === 0 && tick > 0 && runMode !== 'solo') {
        const delta = Math.round((intelligence.alpha - intelligence.risk) * 12);
        setSeason((prev) => ({ ...prev, winStreak: Math.max(0, prev.winStreak + (delta >= 0 ? 1 : -1)) }));
        touchFamily('pvp', 0.17); emitTelemetry('pvp.ghost_tick', { mode: runMode, edgeDelta: delta });
      }

      // Anti-cheat
      if (tick % 45 === 0) { touchFamily('anti_cheat', 0.12); emitTelemetry('integrity.heartbeat', { antiCheat: Number(intelligence.antiCheat.toFixed(3)) }); }
    }, TICK_MS);
    return () => clearTimeout(timer);
  }, [screen, tick, income, expenses, netWorth, shields, hand.length, deckPool, cash, season, regime, intelligence, runMode, freezeTicks, activeMechanics, coreCatalog, mlCatalog, log, emitTelemetry, touchMechanic, touchFamily]);

  // ── Card play ──────────────────────────────────────────────────────────
  const handlePlayCard = useCallback((cardId: string) => {
    const card = hand.find((c) => c.id === cardId);
    if (!card) return;
    if ((card.type === 'OPPORTUNITY' || card.type === 'IPA') && cash < (card.energyCost ?? 0)) { log(`❌ Can't afford ${card.name}`); emitTelemetry('cards.play_rejected', { cardId: card.id, reason: 'insufficient_cash', cash }); touchFamily('economy', 0.10); return; }
    setHand((h) => h.filter((c) => c.id !== cardId));
    const derivedIdMatch = card.id.match(/gen-(m\d+[a-z]?)/i);
    const mechId = derivedIdMatch ? derivedIdMatch[1].toUpperCase() : null;
    const mech = mechId ? catalog.find((m) => m.id.toLowerCase() === mechId.toLowerCase()) : undefined;

    if (card.type === 'OPPORTUNITY' || card.type === 'IPA') {
      const spend = card.energyCost ?? 0; setCash((c) => c - spend);
      if (card.cashflowMonthly != null) setIncome((i) => i + card.cashflowMonthly!);
      if (card.value != null) setNetWorth((nw) => nw + card.value!);
      if (mech?.family === 'season') { setSeason((prev) => ({ ...prev, xp: prev.xp + 15, dominionControl: prev.dominionControl + 2, rewardsPending: prev.rewardsPending + 1 })); }
      else if (mech?.family === 'progression') { setSeason((prev) => ({ ...prev, xp: prev.xp + 10 })); }
      else if (mech?.family === 'social') { setShields((s) => s + 1); }
      else if (mech?.family === 'pvp') { setSeason((prev) => ({ ...prev, winStreak: prev.winStreak + 1, xp: prev.xp + 8 })); }
      else if (mech?.family === 'cards') { const b = drawRandomCards(deckPool.filter((c) => c.id !== card.id), 1, rngRef.current)[0]; if (b) { setHand((h) => h.length < MAX_HAND ? [...h, b] : h); log(`🃏 Bonus draw → ${b.name}`); } }
      else if (mech?.family === 'replay' || mech?.family === 'telemetry' || mech?.family === 'ops') emitTelemetry('system.card_play', { cardId: card.id, family: mech.family, incomeBoost: card.cashflowMonthly ?? 0 });
      if (mechId) touchMechanic(mechId, 0.22); if (mech?.pairId) touchMechanic(mech.pairId, 0.18); touchFamily(mech?.family ?? 'economy', 0.16);
      log(`✅ Played: ${card.name}${card.cashflowMonthly ? ` → +${fmtMoney(card.cashflowMonthly)}/mo` : ''}`);
      emitTelemetry('cards.play', { cardId: card.id, cardType: card.type, cost: spend, cashflowMonthly: card.cashflowMonthly ?? 0, family: mech?.family ?? 'unknown' });
      setSeason((prev) => ({ ...prev, xp: prev.xp + 5 }));
    } else if (card.type === 'FUBAR') {
      if (shields > 0) { setShields((s) => s - 1); log(`🛡️ Shield blocked: ${card.name}`); emitTelemetry('cards.fubar_blocked', { cardId: card.id, shieldCount: shields }); }
      else { const riskScale = 2.0 + intelligence.risk * 0.8 + intelligence.volatility * 0.5; const adjustedHit = Math.round((card.cashImpact ?? -1500) * riskScale); setCash((c) => Math.max(0, c + adjustedHit)); setSeason((prev) => ({ ...prev, nodePressure: prev.nodePressure + 2, winStreak: 0 })); log(`💥 FUBAR hit: ${card.name} → ${fmtMoney(adjustedHit)}`); emitTelemetry('cards.fubar_hit', { cardId: card.id, cashImpact: adjustedHit, riskScale: Number(riskScale.toFixed(3)) }); }
      if (mechId) touchMechanic(mechId, 0.25); if (mech?.pairId) touchMechanic(mech.pairId, 0.22); touchFamily('risk', 0.20);
    } else if (card.type === 'PRIVILEGED') {
      const v = card.value ?? 0; setNetWorth((nw) => nw + v); setSeason((prev) => ({ ...prev, xp: prev.xp + 10, dominionControl: prev.dominionControl + 3, rewardsPending: prev.rewardsPending + 1 }));
      log(`⭐ Privilege: ${card.name} → +${fmtMoney(v)}`); emitTelemetry('cards.privileged', { cardId: card.id, value: v });
      if (mechId) touchMechanic(mechId, 0.20); if (mech?.pairId) touchMechanic(mech.pairId, 0.20); touchFamily(mech?.family ?? 'season', 0.18);
    } else if (card.type === 'MISSED_OPPORTUNITY') {
      const lost = card.turnsLost ?? 1; setFreezeTicks((f) => Math.max(f, lost)); setSeason((prev) => ({ ...prev, nodePressure: prev.nodePressure + 1, winStreak: 0 }));
      log(`😬 Missed: ${card.name} — freeze ${lost}t`); emitTelemetry('cards.missed', { cardId: card.id, turnsLost: lost });
      if (mechId) touchMechanic(mechId, 0.16); if (mech?.pairId) touchMechanic(mech.pairId, 0.16); touchFamily('progression', 0.12);
    } else if (card.type === 'SO') {
      const roll = rngRef.current();
      if (roll < 0.34) { setShields((s) => s + 1); log(`🚧 Obstacle → +1 shield`); }
      else if (roll < 0.67) { setSeason((prev) => ({ ...prev, xp: prev.xp + 7 })); log(`🚧 Obstacle → +XP`); }
      else { setCash((c) => c + 1000); log(`🚧 Obstacle → +$1K`); }
      emitTelemetry('cards.obstacle', { cardId: card.id });
      if (mechId) touchMechanic(mechId, 0.14); if (mech?.pairId) touchMechanic(mech.pairId, 0.14); touchFamily(mech?.family ?? 'ops', 0.12);
    }
  }, [hand, cash, shields, catalog, deckPool, intelligence, log, emitTelemetry, touchMechanic, touchFamily]);

  const bridgeSnapshot = useMemo(() => ({ tick, cash, regime, intelligence: { alpha: intelligence.alpha, risk: intelligence.risk, volatility: intelligence.volatility, momentum: intelligence.momentum, churnRisk: intelligence.churnRisk, recommendationPower: intelligence.recommendationPower }, season: { xp: season.xp, passTier: season.passTier, dominionControl: season.dominionControl, winStreak: season.winStreak } }), [tick, cash, regime, intelligence, season]);

  const topMechanics = useMemo(() => [...catalog].sort((a, b) => (runtime[b.id]?.activations ?? 0) - (runtime[a.id]?.activations ?? 0)).slice(0, 5), [catalog, runtime]);

  // ── Chat context — passed to ChatPanel so useChatEngine can react to game state ──
  const gameCtx = useMemo(() => ({
    tick, cash, regime, netWorth, income, expenses, events,
  }), [tick, cash, regime, netWorth, income, expenses, events]);

  // access token may not exist on AuthUser; cast to any to safely read if present
  const userAccessToken: string | null = (auth.user as any)?.accessToken ?? null;

  const startRun = useCallback(() => {
    const seed = randomSeed(); seedRef.current = seed; rngRef.current = mulberry32(seed);
    setCash(STARTING_CASH); setIncome(STARTING_INCOME); setExpenses(STARTING_EXPENSES);
    setHaterSabotageCount(0); setNetWorth(STARTING_CASH); setShields(0); setTick(0); setFreezeTicks(0);
    setActiveSabotages([]); setPendingCounterplay(null); setBattlePhase('PREP');
    setBattleScore({ local: 0, opponent: 0 }); setBattleRound(1); setShowAidComposer(false); setRescueWindow(null);
    setRuntime(initRuntime(catalog)); setTelemetry([]);
    setIntelligence({ alpha: 0.45, risk: 0.35, volatility: 0.30, antiCheat: 0.50, personalization: 0.40, rewardFit: 0.45, recommendationPower: 0.42, churnRisk: 0.28, momentum: 0.33 });
    setSeason({ xp: 0, passTier: 1, dominionControl: 0, nodePressure: 0, winStreak: 0, battlePassLevel: 1, rewardsPending: 0 });
    setRegime('Stable'); setHand(drawRandomCards(deckPool, 4, rngRef.current));
    setEvents([`🎮 Run started (seed=${seed}). 300 mechanics + 150 ML companions online.`]);
    setEquityHistory([STARTING_CASH]); setSelectedMechanicId('M01'); setScreen('run');
  }, [catalog, deckPool]);

  // ── Run — shared handlers (MUST be above all conditional returns — React Rules of Hooks) ──
  const handleMitigate = useCallback((id: string) => {
    if (cash >= 2_000) { setCash((c) => c - 2_000); log(`🛡️ Threat mitigated (${id}) — -$2K`); emitTelemetry('threat.mitigated', { threatId: id, cost: 2000 }); touchFamily('anti_cheat', 0.18); }
    else log(`❌ Cannot mitigate ${id} — insufficient cash`);
  }, [cash, setCash, log, emitTelemetry, touchFamily]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRescueContribute = useCallback(() => {
    if (!rescueWindow) return;
    const contrib = Math.min(cash * 0.1, rescueWindow.contributionRequired - rescueWindow.totalContributed);
    const rounded = Math.round(contrib);
    setCash((c) => Math.max(0, c - rounded));
    setRescueWindow((rw) => rw ? { ...rw, totalContributed: rw.totalContributed + rounded } : null);
    log(`🤝 Contributed ${fmtMoney(rounded)} to rescue`);
    emitTelemetry('alliance.rescue_contribution', { amount: rounded });
    touchFamily('social', 0.20);
  }, [cash, rescueWindow, setCash, setRescueWindow, log, emitTelemetry, touchFamily]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSabotageCounterplay = useCallback((id: string) => {
    const sab = activeSabotages.find((s) => s.id === id);
    if (!sab) return;
    setPendingCounterplay({
      eventLabel: sab.label, eventDescription: `Active sabotage from ${sab.sourceDisplayName}.`, eventEmoji: '💣', ticksToRespond: 6,
      actions: [
        { id: 'counter-legal',  label: 'Legal Countermeasure', description: 'File a formal challenge.',   cost: 5_000, successChance: 0.80, emoji: '⚖️', available: cash >= 5_000 },
        { id: 'counter-shield', label: 'Shield Deploy',        description: 'Burn a shield to nullify.', cost: 0,     successChance: shields > 0 ? 1.0 : 0.0, emoji: '🛡️', available: shields > 0 },
      ],
      onChoose: (actionId: string) => {
        setActiveSabotages((prev) => prev.filter((s) => s.id !== id));
        if (actionId === 'counter-shield' && shields > 0) setShields((s) => s - 1);
        else if (actionId === 'counter-legal') setCash((c) => Math.max(0, c - 5_000));
        log(`✅ Sabotage countered: ${sab.label}`);
        emitTelemetry('sabotage.countered', { sabotageId: id, actionId });
        touchFamily('anti_cheat', 0.22);
        setPendingCounterplay(null);
      },
      onIgnore: () => setPendingCounterplay(null),
    });
  }, [activeSabotages, cash, shields, log, emitTelemetry, touchFamily]); // eslint-disable-line react-hooks/exhaustive-deps

  const commonEvents = useMemo(() => events.slice(-30), [events]);

  // ── Auth gate ──────────────────────────────────────────────────────────
  if (!auth.isAuthed && !auth.loading && import.meta.env.VITE_DEV_BYPASS !== 'true') return <AuthGate auth={auth} onAuth={() => {}} />;
  if (auth.loading) return <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center"><div className="text-zinc-500 text-sm font-mono animate-pulse">LOADING SYSTEM...</div></div>;

  // ── Landing ────────────────────────────────────────────────────────────
  if (screen === 'landing') {
    return (
      <LobbyScreen
        onStart={(mode) => {
          setRunMode(mode);
          startRun();
          // Also wire to engine layer — mode engines now run in parallel
          // with existing tick loop during transition period
          gameModeHook.startRun(mode).catch(console.error);
        }}
      />
    );
  }

  // ── Bankrupt ───────────────────────────────────────────────────────────
  if (screen === 'bankrupt') {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col gap-6 overflow-auto p-4">
        <BankruptcyScreen seed={seedRef.current} tick={tick} regime={regime} intelligence={intelligence} season={season} events={events} equityHistory={equityHistory} onPlayAgain={() => setScreen('landing')} />
        {replayEvents.length > 0 && <div className="max-w-3xl mx-auto w-full"><ReplayTimeline events={replayEvents} totalTicks={RUN_TICKS} finalNetWorth={netWorth} seed={seedRef.current} onScrub={(t) => emitTelemetry('replay.scrub', { tick: t })} /></div>}
      </div>
    );
  }

  // ── Result ─────────────────────────────────────────────────────────────
  if (screen === 'result') {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col gap-6 items-center justify-start p-6 overflow-auto">
        <ResultScreen cash={cash} netWorth={netWorth} income={income} expenses={expenses} season={season} intelligence={intelligence} onRestart={() => setScreen('landing')} />
        <div className="w-full max-w-xl"><ProofCard seed={seedRef.current} tick={tick} totalTicks={RUN_TICKS} cash={cash} netWorth={netWorth} income={income} expenses={expenses} intelligence={intelligence} season={season} regime={regime} topEvents={events} /></div>
        {replayEvents.length > 0 && <div className="w-full max-w-3xl"><ReplayTimeline events={replayEvents} totalTicks={RUN_TICKS} finalNetWorth={netWorth} seed={seedRef.current} onScrub={(t) => emitTelemetry('replay.scrub', { tick: t })} /></div>}
      </div>
    );
  }

  // ── Run ────────────────────────────────────────────────────────────────
  return (
    <>
      <MechanicsBridgeProvider validIds={validMechanicIds} runtime={runtime} onTouchMechanic={touchMechanic} onTouchFamily={touchFamily} snapshot={bridgeSnapshot}>
      {runMode === 'solo' && (
        <EmpireGameScreen
          cash={cash} income={income} expenses={expenses} netWorth={netWorth}
          shields={shields} shieldConsuming={shieldConsuming}
          tick={tick} totalTicks={RUN_TICKS} freezeTicks={freezeTicks}
          regime={regime} intelligence={intelligence} equityHistory={equityHistory}
          hand={hand} onPlayCard={handlePlayCard}
          threats={threats} onMitigate={handleMitigate}
          events={commonEvents} modeState={gameModeHook.modeState}
        />
      )}
      {runMode === 'asymmetric-pvp' && (
        <PredatorGameScreen
          cash={cash} income={income} expenses={expenses} netWorth={netWorth}
          shields={shields} shieldConsuming={shieldConsuming}
          tick={tick} totalTicks={RUN_TICKS} freezeTicks={freezeTicks}
          regime={regime} intelligence={intelligence} equityHistory={equityHistory}
          events={commonEvents} modeState={gameModeHook.modeState}
          battlePhase={battlePhase} battleParticipants={battleParticipants}
          battleScore={battleScore} battleRound={battleRound}
          activeSabotages={activeSabotages}
          pendingCounterplay={pendingCounterplay}
          onForfeit={() => { log('🏳️ Match forfeited.'); setScreen('result'); }}
          onCounterplay={handleSabotageCounterplay}
        />
      )}
      {runMode === 'co-op' && (
        <SyndicateGameScreen
          cash={cash} income={income} expenses={expenses} netWorth={netWorth}
          shields={shields} shieldConsuming={shieldConsuming}
          tick={tick} totalTicks={RUN_TICKS} freezeTicks={freezeTicks}
          regime={regime} intelligence={intelligence} equityHistory={equityHistory}
          events={commonEvents} modeState={gameModeHook.modeState}
          rescueWindow={rescueWindow}
          allianceMembers={allianceMembers}
          onAidSubmit={handleAidSubmit}
          onRescueContribute={handleRescueContribute}
          onRescueDismiss={() => setRescueWindow(null)}
        />
      )}
      {runMode === 'ghost' && (
        <PhantomGameScreen
          cash={cash} income={income} expenses={expenses} netWorth={netWorth}
          shields={shields}
          tick={tick} totalTicks={RUN_TICKS} freezeTicks={freezeTicks}
          regime={regime} intelligence={intelligence} equityHistory={equityHistory}
          events={commonEvents} replayEvents={replayEvents}
          modeState={gameModeHook.modeState} seed={seedRef.current}
        />
      )}
    </MechanicsBridgeProvider>
      {/* ── ChatPanel — fixed overlay, present on all 4 game modes ── */}
      <ChatPanel
        gameCtx={gameCtx}
        onSabotage={handleSabotage}
        accessToken={userAccessToken}
      />
    </>
  );
}