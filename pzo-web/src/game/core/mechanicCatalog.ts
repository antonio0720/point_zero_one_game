// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/core/mechanicCatalog.ts
// Sprint 1: Mechanic Catalog — extracted from App.tsx
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import MECHANICS_DATA from '../../data/mechanics_core.json';
import ML_DATA        from '../../data/ml_core.json';
import { hashString } from './rng';
import { idNum }      from './math';
import type { Card, DeckType } from '../../components/CardHand';

// ── Types ─────────────────────────────────────────────────────────────────────
export type MechanicKind   = 'core' | 'ml';
export type MechanicFamily =
  | 'replay' | 'economy' | 'risk' | 'market' | 'cards' | 'progression'
  | 'social' | 'telemetry' | 'pvp' | 'season' | 'ai' | 'anti_cheat'
  | 'narrative' | 'ops' | 'unknown';

export type MechanicDef = {
  id: string; title: string; kind: MechanicKind; family: MechanicFamily;
  pairId?: string; weight: number; keywordTags: string[];
};

export type MechanicRuntimeState = {
  enabled: boolean; activations: number; lastTick: number;
  heat: number; confidence: number; signal: number;
};

// ── Catalog Builders ──────────────────────────────────────────────────────────
const CORE_TITLES: ReadonlyArray<readonly [string, string]> =
  (MECHANICS_DATA as Array<{ mechanic_id: string; title: string }>)
    .map((m) => [m.mechanic_id, m.title] as const);

const ML_TITLES: ReadonlyArray<readonly [string, string]> =
  (ML_DATA as Array<{ mechanic_id: string; title: string }>)
    .map((m) => [m.mechanic_id, m.title] as const);

export function keywordTagsFromTitle(title: string): string[] {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 8);
}

export function inferFamily(id: string, title: string, kind: MechanicKind): MechanicFamily {
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

export function buildCatalog(): MechanicDef[] {
  const core = CORE_TITLES.map(([id, title]) => {
    const family = inferFamily(id, title, 'core');
    return { id, title, kind: 'core' as const, family, pairId: `${id}a`, weight: weightForMechanic(id, 'core', family), keywordTags: keywordTagsFromTitle(title) };
  });
  const ml = ML_TITLES.map(([id, title]) => {
    const family = inferFamily(id, title, 'ml');
    const pairId = id.endsWith('a') ? id.slice(0, -1) : undefined;
    return { id, title, kind: 'ml' as const, family, pairId, weight: weightForMechanic(id, 'ml', family), keywordTags: keywordTagsFromTitle(title) };
  });
  return [...core, ...ml];
}

export function initRuntime(catalog: MechanicDef[]): Record<string, MechanicRuntimeState> {
  const out: Record<string, MechanicRuntimeState> = {};
  for (const def of catalog) {
    out[def.id] = { enabled: true, activations: 0, lastTick: -1, heat: 0, confidence: def.kind === 'ml' ? 0.5 : 0.6, signal: 0 };
  }
  return out;
}

export function decayRuntime(runtime: Record<string, MechanicRuntimeState>): Record<string, MechanicRuntimeState> {
  const next: Record<string, MechanicRuntimeState> = {};
  for (const [id, st] of Object.entries(runtime)) {
    next[id] = { ...st, heat: Math.max(0, st.heat - 0.012), confidence: Math.max(0.08, Math.min(0.99, st.confidence - 0.001)), signal: st.signal * 0.93 };
  }
  return next;
}

// ── Deck Builder ──────────────────────────────────────────────────────────────
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

export function buildGeneratedDeck(coreCatalog: MechanicDef[]): Card[] {
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
