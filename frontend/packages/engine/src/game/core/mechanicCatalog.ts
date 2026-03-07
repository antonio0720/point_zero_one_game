// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/core/mechanicCatalog.ts
// Sprint 3: Mechanic Catalog — Engine-Complete
// Density6 LLC · Confidential · All Rights Reserved
// ═══════════════════════════════════════════════════════════════════════════
// Master registry for all N-series patent modules.
// Now wires into all 7 engines: time, pressure, tension, shield,
// battle, cascade, sovereignty — plus mode-specific overlays.
// Runtime state tracks per-mechanic activation heat, confidence,
// and ML signal strength for the alpha-draw reroute system.
// ═══════════════════════════════════════════════════════════════════════════

import MECHANICS_DATA from '../../data/mechanics_core.json';
import ML_DATA        from '../../data/ml_core.json';
import { hashString, weightedPick } from './rng';
import { idNum, clamp }             from './math';
import {
  ML_CONFIDENCE_DECAY_PER_TICK,
  ML_HEAT_DECAY_PER_TICK,
  ML_SIGNAL_DECAY_FACTOR,
} from './constants';
import type { Card, DeckType } from '../../components/CardHand';

// ── Types ─────────────────────────────────────────────────────────────────────

export type MechanicKind = 'core' | 'ml';

export type MechanicFamily =
  | 'replay'    | 'economy'    | 'risk'       | 'market'
  | 'cards'     | 'progression'| 'social'     | 'telemetry'
  | 'pvp'       | 'season'     | 'ai'         | 'anti_cheat'
  | 'narrative' | 'ops'        | 'unknown'
  // Sprint 3: engine families wired to the 7-engine taxonomy
  | 'time'      | 'pressure'   | 'tension'    | 'shield'
  | 'battle'    | 'cascade'    | 'sovereignty';

/** Which engine(s) this mechanic activates within. */
export type EngineAffinity = Array<
  'time' | 'pressure' | 'tension' | 'shield' | 'battle' | 'cascade' | 'sovereignty'
>;

export type MechanicDef = {
  id:            string;
  title:         string;
  kind:          MechanicKind;
  family:        MechanicFamily;
  pairId?:       string;
  weight:        number;
  keywordTags:   string[];
  engineAffinity: EngineAffinity;  // Sprint 3: which engines this mechanic powers
};

export type MechanicRuntimeState = {
  enabled:          boolean;
  activations:      number;
  lastTick:         number;
  heat:             number;    // 0–1: how recently / intensely this mechanic fired
  confidence:       number;    // 0–1: ML confidence score
  signal:           number;    // 0–1: current ML signal strength
  suppressedUntil?: number;   // tick when suppression expires (circuit-breaker)
};

// ── Catalog Builders ──────────────────────────────────────────────────────────

const CORE_TITLES: ReadonlyArray<readonly [string, string]> =
  (MECHANICS_DATA as Array<{ mechanic_id: string; title: string }>)
    .map((m) => [m.mechanic_id, m.title] as const);

const ML_TITLES: ReadonlyArray<readonly [string, string]> =
  (ML_DATA as Array<{ mechanic_id: string; title: string }>)
    .map((m) => [m.mechanic_id, m.title] as const);

export function keywordTagsFromTitle(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);
}

export function inferFamily(id: string, title: string, kind: MechanicKind): MechanicFamily {
  const t = title.toLowerCase();
  if (t.includes('anti-cheat') || t.includes('fraud') || t.includes('abuse') || t.includes('integrity')) return 'anti_cheat';
  if (t.includes('pvp') || t.includes('matchmaking') || t.includes('duel') || t.includes('opponent')) return 'pvp';
  if (t.includes('season') || t.includes('battle pass') || t.includes('dominion') || t.includes('founding era')) return 'season';
  if (t.includes('telemetry') || t.includes('analytics') || t.includes('event bus') || t.includes('observability')) return 'telemetry';
  if (t.includes('narrative') || t.includes('story') || t.includes('codex') || t.includes('lore')) return 'narrative';
  if (t.includes('card') || t.includes('deck') || t.includes('draw') || t.includes('hand') || t.includes('shuffle')) return 'cards';
  if (t.includes('market') || t.includes('price') || t.includes('volatility') || t.includes('scarcity')) return 'market';
  if (t.includes('risk') || t.includes('fubar') || t.includes('loss') || t.includes('crash') || t.includes('bankruptcy')) return 'risk';
  if (t.includes('economy') || t.includes('income') || t.includes('cash') || t.includes('yield') || t.includes('roi')) return 'economy';
  if (t.includes('progression') || t.includes('quest') || t.includes('unlock') || t.includes('achievement')) return 'progression';
  if (t.includes('social') || t.includes('guild') || t.includes('party') || t.includes('friend')) return 'social';
  if (t.includes('replay') || t.includes('deterministic') || t.includes('seed')) return 'replay';
  if (t.includes('ops') || t.includes('orchestrator') || t.includes('router') || t.includes('runtime')) return 'ops';
  // Sprint 3: Engine-specific families
  if (t.includes('pressure') || t.includes('escalation') || t.includes('urgency')) return 'pressure';
  if (t.includes('tension') || t.includes('anticipation') || t.includes('threat queue')) return 'tension';
  if (t.includes('shield') || t.includes('defense') || t.includes('breach')) return 'shield';
  if (t.includes('battle') || t.includes('bot') || t.includes('hater') || t.includes('attack')) return 'battle';
  if (t.includes('cascade') || t.includes('chain') || t.includes('nemesis')) return 'cascade';
  if (t.includes('sovereignty') || t.includes('proof') || t.includes('grade')) return 'sovereignty';
  if (t.includes('time') || t.includes('tick') || t.includes('clock') || t.includes('decision window')) return 'time';

  // Fallback: numeric range assignment
  const n = idNum(id);
  if (kind === 'ml') {
    if (n <= 25) return 'ai';    if (n <= 50) return 'economy'; if (n <= 75) return 'risk';
    if (n <= 100) return 'market'; if (n <= 125) return 'season'; return 'anti_cheat';
  }
  if (n <= 20)  return 'replay';     if (n <= 40)  return 'cards';
  if (n <= 60)  return 'economy';    if (n <= 80)  return 'market';
  if (n <= 100) return 'progression';if (n <= 120) return 'season';
  if (n <= 135) return 'pvp';        return 'telemetry';
}

/** Derive engine affinity from mechanic family. */
function inferEngineAffinity(family: MechanicFamily): EngineAffinity {
  const map: Partial<Record<MechanicFamily, EngineAffinity>> = {
    time:         ['time'],
    pressure:     ['pressure'],
    tension:      ['tension'],
    shield:       ['shield'],
    battle:       ['battle'],
    cascade:      ['cascade'],
    sovereignty:  ['sovereignty'],
    risk:         ['shield', 'cascade'],
    economy:      ['pressure', 'sovereignty'],
    market:       ['pressure', 'tension'],
    cards:        ['time', 'sovereignty'],
    season:       ['sovereignty'],
    pvp:          ['battle', 'cascade'],
    anti_cheat:   ['sovereignty'],
    replay:       ['sovereignty', 'time'],
    telemetry:    ['sovereignty'],
    social:       ['battle', 'sovereignty'],
    narrative:    ['tension'],
    ops:          ['time', 'pressure', 'tension', 'shield', 'battle', 'cascade', 'sovereignty'],
    ai:           ['pressure', 'tension'],
    progression:  ['sovereignty'],
  };
  return map[family] ?? ['sovereignty'];
}

function weightForMechanic(id: string, kind: MechanicKind, family: MechanicFamily): number {
  const n = idNum(id);
  let base = kind === 'ml' ? 0.45 : 0.65;
  if (family === 'economy') base += 0.12;
  if (family === 'risk' || family === 'anti_cheat') base += 0.08;
  if (family === 'season' || family === 'pvp') base += 0.05;
  if (['shield', 'cascade', 'battle'].includes(family)) base += 0.06;
  if (['sovereignty', 'time'].includes(family)) base += 0.04;
  base += (n % 7) * 0.01;
  return Number(clamp(base, 0.01, 0.99).toFixed(2));
}

export function buildCatalog(): MechanicDef[] {
  const core = CORE_TITLES.map(([id, title]) => {
    const family = inferFamily(id, title, 'core');
    return {
      id, title, kind: 'core' as const, family,
      pairId: `${id}a`,
      weight: weightForMechanic(id, 'core', family),
      keywordTags: keywordTagsFromTitle(title),
      engineAffinity: inferEngineAffinity(family),
    };
  });
  const ml = ML_TITLES.map(([id, title]) => {
    const family = inferFamily(id, title, 'ml');
    const pairId = id.endsWith('a') ? id.slice(0, -1) : undefined;
    return {
      id, title, kind: 'ml' as const, family, pairId,
      weight: weightForMechanic(id, 'ml', family),
      keywordTags: keywordTagsFromTitle(title),
      engineAffinity: inferEngineAffinity(family),
    };
  });
  return [...core, ...ml];
}

// ── Runtime State ─────────────────────────────────────────────────────────────

export function initRuntime(catalog: MechanicDef[]): Record<string, MechanicRuntimeState> {
  const out: Record<string, MechanicRuntimeState> = {};
  for (const def of catalog) {
    out[def.id] = {
      enabled:    true,
      activations: 0,
      lastTick:   -1,
      heat:       0,
      confidence: def.kind === 'ml' ? 0.5 : 0.6,
      signal:     0,
    };
  }
  return out;
}

/**
 * Decay all mechanic runtime states by one tick.
 * Called by EngineOrchestrator on every tick step.
 */
export function decayRuntime(
  runtime: Record<string, MechanicRuntimeState>,
): Record<string, MechanicRuntimeState> {
  const next: Record<string, MechanicRuntimeState> = {};
  for (const [id, st] of Object.entries(runtime)) {
    next[id] = {
      ...st,
      heat:       Math.max(0, st.heat - ML_HEAT_DECAY_PER_TICK),
      confidence: Math.max(0.08, Math.min(0.99, st.confidence - ML_CONFIDENCE_DECAY_PER_TICK)),
      signal:     st.signal * ML_SIGNAL_DECAY_FACTOR,
    };
  }
  return next;
}

/**
 * Fire a mechanic activation: bump heat, activations, lastTick.
 * Returns updated state without mutating input.
 */
export function activateMechanic(
  st:   MechanicRuntimeState,
  tick: number,
  signalBoost = 0.15,
): MechanicRuntimeState {
  return {
    ...st,
    activations: st.activations + 1,
    lastTick:    tick,
    heat:        clamp(st.heat + 0.25, 0, 1),
    signal:      clamp(st.signal + signalBoost, 0, 1),
    confidence:  clamp(st.confidence + 0.02, 0, 0.99),
  };
}

/**
 * Suppress a mechanic for N ticks (circuit-breaker pattern).
 * Prevents runaway positive feedback loops in high-heat states.
 */
export function suppressMechanic(
  st:    MechanicRuntimeState,
  until: number,
): MechanicRuntimeState {
  return { ...st, suppressedUntil: until };
}

/**
 * Check if a mechanic can fire this tick.
 * Returns false if suppressed or disabled.
 */
export function canActivate(st: MechanicRuntimeState, currentTick: number): boolean {
  if (!st.enabled) return false;
  if (st.suppressedUntil != null && currentTick < st.suppressedUntil) return false;
  return true;
}

// ── Alpha Draw Rerouting ──────────────────────────────────────────────────────

/**
 * Given current runtime states, select the mechanic most likely to improve
 * the player's position. Used by the ML alpha-draw reroute system.
 *
 * Prefers high-confidence, high-signal mechanics with engineAffinity matching
 * the current dominant pressure source.
 */
export function selectAlphaCandidate(
  catalog:  MechanicDef[],
  runtime:  Record<string, MechanicRuntimeState>,
  tick:     number,
  targetFamily?: MechanicFamily,
): MechanicDef | null {
  const eligible = catalog.filter((def) => {
    const st = runtime[def.id];
    if (!st || !canActivate(st, tick)) return false;
    if (st.heat > 0.8) return false;        // cooling down
    if (targetFamily && def.family !== targetFamily) return false;
    return true;
  });

  if (eligible.length === 0) return null;

  // Score candidates: weight × confidence × (1 + signal)
  const scored = eligible.map((def) => {
    const st    = runtime[def.id];
    const score = def.weight * (st?.confidence ?? 0.5) * (1 + (st?.signal ?? 0));
    return { def, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.def ?? null;
}

// ── Deck Builder ───────────────────────────────────────────────────────────────

const SEED_DECK: Card[] = [
  { id: 'opp-001', name: 'Single Family Rental',  type: 'OPPORTUNITY' as DeckType, subtype: 'Real Estate',  description: 'Cash-flowing rental in emerging market. Passive income monthly.', cost: 25000, leverage: 100000, downPayment: 25000, cashflowMonthly: 400,  roiPct: 19, cashImpact: null, turnsLost: null, value: null,  energyCost: 25000, synergies: [] },
  { id: 'ipa-001', name: 'Dividend Stock Bundle',  type: 'IPA' as DeckType,         subtype: 'Equities',     description: 'High-yield dividend portfolio. Passive income every tick.',       cost: 10000, leverage: null,   downPayment: null,  cashflowMonthly: 120,  roiPct: 14, cashImpact: null, turnsLost: null, value: null,  energyCost: 10000, synergies: [] },
  { id: 'fubar-001', name: 'Market Crash Wave',    type: 'FUBAR' as DeckType,       subtype: 'Macro',        description: 'Systemic shock hits portfolio value.',                           cost: null,  leverage: null,   downPayment: null,  cashflowMonthly: null, roiPct: null, cashImpact: -7500, turnsLost: null, value: null, energyCost: 0,     synergies: [] },
  { id: 'opp-002', name: 'Digital Business',       type: 'OPPORTUNITY' as DeckType, subtype: 'Business',     description: 'SaaS micro-business generating recurring revenue.',               cost: 15000, leverage: null,   downPayment: null,  cashflowMonthly: 800,  roiPct: 64, cashImpact: null, turnsLost: null, value: null,  energyCost: 15000, synergies: [] },
  { id: 'miss-001', name: 'Analysis Paralysis',    type: 'MISSED_OPPORTUNITY' as DeckType, subtype: 'Behavior', description: 'You hesitated. The deal closed without you.',               cost: null,  leverage: null,   downPayment: null,  cashflowMonthly: null, roiPct: null, cashImpact: null, turnsLost: 3,   value: null, energyCost: 0,     synergies: [] },
  { id: 'priv-001', name: 'Inherited Network',     type: 'PRIVILEGED' as DeckType,  subtype: 'Access',       description: 'Off-market deal from a warm intro. Unfair advantage activated.', cost: null,  leverage: null,   downPayment: null,  cashflowMonthly: null, roiPct: null, cashImpact: null, turnsLost: null, value: 20000, energyCost: 0,    synergies: [] },
];

function cardTypeFromFamily(family: MechanicFamily, h: number): DeckType {
  if (family === 'risk' || family === 'anti_cheat' || family === 'cascade') return 'FUBAR' as DeckType;
  if (family === 'battle' || family === 'tension')  return (h % 4 === 0 ? 'FUBAR' : 'MISSED_OPPORTUNITY') as DeckType;
  if (family === 'cards' || family === 'time')      return (h % 4 === 0 ? 'IPA' : 'OPPORTUNITY') as DeckType;
  if (family === 'economy' || family === 'progression') return (h % 3 === 0 ? 'IPA' : 'OPPORTUNITY') as DeckType;
  if (family === 'season' || family === 'pvp' || family === 'sovereignty') return (h % 5 === 0 ? 'PRIVILEGED' : 'OPPORTUNITY') as DeckType;
  if (family === 'market' || family === 'pressure') return (h % 4 === 0 ? 'FUBAR' : 'OPPORTUNITY') as DeckType;
  if (family === 'shield')                          return (h % 5 === 0 ? 'SO' : 'OPPORTUNITY') as DeckType;
  if (['replay', 'telemetry', 'ops', 'narrative'].includes(family)) return (h % 2 === 0 ? 'SO' : 'IPA') as DeckType;
  return (h % 6 === 0 ? 'MISSED_OPPORTUNITY' : 'OPPORTUNITY') as DeckType;
}

function subtypeFromFamily(family: MechanicFamily): string {
  const m: Partial<Record<MechanicFamily, string>> = {
    economy: 'Capital', risk: 'Hazard', market: 'Macro',
    cards: 'Deck Engine', progression: 'Meta', social: 'Network',
    telemetry: 'Observability', pvp: 'Arena', season: 'Dominion',
    ai: 'Inference', anti_cheat: 'Integrity', narrative: 'Lore',
    ops: 'Runtime', replay: 'Determinism', time: 'Clock',
    pressure: 'Pressure', tension: 'Threat', shield: 'Defense',
    battle: 'Combat', cascade: 'Chain', sovereignty: 'Proof',
  };
  return m[family] ?? 'System';
}

export function buildGeneratedDeck(coreCatalog: MechanicDef[]): Card[] {
  const generated = coreCatalog.map((def) => {
    const h          = hashString(def.id + def.title);
    const type       = cardTypeFromFamily(def.family, h);
    const baseCost   = 2_500 + (h % 11) * 750;
    const incomeBoost = 80 + (h % 9) * 40;
    const roiPct     = 8 + (h % 18);
    const isHazard   = type === ('FUBAR' as DeckType);
    const isMissed   = type === ('MISSED_OPPORTUNITY' as DeckType);
    const isPrivilege = type === ('PRIVILEGED' as DeckType);
    const isObstacle = type === ('SO' as DeckType);
    const labelTail  = def.title.replace(/^M\d+[a-z]?\s*[-—:]\s*/i, '');

    // Engine affinity enriches the card synergies array
    const synergies = def.engineAffinity.map((eng) => ({
      comboId: `${def.id}-${eng}`,
      label: eng.toUpperCase(),
      description: `${eng} engine synergy`,
      requiredCardIds: [],
      bonusDescription: `+${eng} effect when played with matching stack`,
    }));

    return {
      id:             `gen-${def.id.toLowerCase()}`,
      name:           `${def.id} • ${labelTail}`,
      type,
      subtype:        subtypeFromFamily(def.family),
      description:    `${def.kind === 'core' ? 'Core mechanic' : 'ML companion'} in ${def.family} family. Engine: ${def.engineAffinity.join(', ')}.`,
      cost:           isHazard || isMissed || isPrivilege || isObstacle ? null : baseCost,
      leverage:       def.family === 'economy' ? baseCost * 3 : null,
      downPayment:    def.family === 'economy' ? Math.round(baseCost * 0.25) : null,
      cashflowMonthly: isHazard || isMissed || isPrivilege || isObstacle ? null : incomeBoost,
      roiPct:         isHazard || isMissed ? null : roiPct,
      cashImpact:     isHazard ? -(1_200 + (h % 7) * 900) : null,
      turnsLost:      isMissed ? 1 + (h % 3) : null,
      value:          isPrivilege ? 2_500 + (h % 9) * 1_750 : def.family === 'season' ? 1_500 + (h % 7) * 900 : null,
      energyCost:     isHazard || isMissed || isPrivilege || isObstacle ? 0 : baseCost,
      synergies,
    } as Card;
  });
  return [...SEED_DECK, ...generated];
}

// ── Hot Mechanic Query (used by pressure engine signal reader) ────────────────

/** Return mechanics sorted by current heat — used to show "hot" systems in UI. */
export function getHotMechanics(
  catalog:  MechanicDef[],
  runtime:  Record<string, MechanicRuntimeState>,
  limit = 5,
): Array<{ def: MechanicDef; state: MechanicRuntimeState }> {
  return catalog
    .map((def) => ({ def, state: runtime[def.id] ?? null }))
    .filter(({ state }) => state !== null && state.heat > 0.1)
    .sort((a, b) => b.state.heat - a.state.heat)
    .slice(0, limit) as Array<{ def: MechanicDef; state: MechanicRuntimeState }>;
}
