/// <reference types="vite/client" />
/**
 * mechanics/index.tsx — Sprint 3B Vertical Slice
 * 
 * 10 mechanics stubs rebuilt against the live MechanicsBridge.
 * 2 per priority family: economy, risk, cards, progression, season.
 * 
 * Each mechanic is a React component that:
 *   1. Calls useMechanicsBridge() — the ONLY allowed dependency
 *   2. Fires touchMechanic / touchFamily on relevant game events
 *   3. Reads snap for display / conditional logic
 *   4. Renders a minimal visual indicator (visible in dev, hideable in prod)
 * 
 * These are NOT UI-heavy components. They are behavior nodes.
 * UI is in App.tsx. These push signals into the runtime.
 */

import React, { useEffect, useRef } from 'react';
import { useMechanicsBridge } from '../context/MechanicsBridgeContext';
import type { MechanicFamily } from '../context/MechanicsBridgeContext';

const DEV = import.meta.env.DEV;

// ─── Shared: Dev-only mechanic badge ─────────────────────────────────────────

function MechanicBadge({
  id, family, activations, active,
}: {
  id: string; family: MechanicFamily; activations?: number; active: boolean;
}) {
  if (!DEV) return null;
  return (
    <div
      title={`${id} · family:${family} · activations:${activations ?? 0}`}
      className={`
        inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono
        border transition-all duration-300
        ${active
          ? 'bg-emerald-950 border-emerald-700 text-emerald-300'
          : 'bg-zinc-900 border-zinc-700 text-zinc-500'}
      `}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
      {id}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FAMILY: ECONOMY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * M05 — Monthly Cashflow Settlement Amplifier
 * Economy family. Fires when cashflow is positive and momentum is high.
 * Represents the ML companion detecting favorable cashflow velocity.
 */
export function M05CashflowAmplifier() {
  const bridge = useMechanicsBridge();
  const lastTickRef = useRef(-1);
  const { snap } = bridge;
  const cashflow_positive = snap.intelligence.alpha > snap.intelligence.risk;
  const active = bridge.isMechanicActive('M05');

  useEffect(() => {
    if (snap.tick === lastTickRef.current) return;
    if (snap.tick % 12 !== 0) return; // monthly cadence
    lastTickRef.current = snap.tick;

    if (cashflow_positive && snap.intelligence.momentum > 0.4) {
      bridge.touchMechanic('M05', {
        signal: 0.18 + snap.intelligence.momentum * 0.12,
        reason: 'monthly cashflow settlement — momentum high',
      });
      bridge.touchFamily('economy', { signal: 0.14 });
    }
  }, [snap.tick, cashflow_positive, snap.intelligence.momentum, bridge]);

  return (
    <MechanicBadge
      id="M05" family="economy" active={active}
      activations={undefined}
    />
  );
}

/**
 * M08 — Expense Erosion Detector
 * Economy family. Monitors when expenses are outpacing income.
 * Fires a risk signal when churn risk climbs above threshold.
 */
export function M08ExpenseErosionDetector() {
  const bridge = useMechanicsBridge();
  const lastTickRef = useRef(-1);
  const { snap } = bridge;
  const under_pressure = snap.intelligence.churnRisk > 0.55;
  const active = bridge.isMechanicActive('M08');

  useEffect(() => {
    if (snap.tick === lastTickRef.current) return;
    if (snap.tick % 6 !== 0) return; // every 6 ticks
    lastTickRef.current = snap.tick;

    if (under_pressure) {
      bridge.touchMechanic('M08', {
        signal: 0.15 + snap.intelligence.churnRisk * 0.10,
        reason: 'expense erosion — churn risk elevated',
      });
      // Co-fire risk family to compound ML signal
      bridge.touchFamily('risk', { signal: 0.12 });
      bridge.debugLog('M08', `churnRisk=${snap.intelligence.churnRisk.toFixed(3)}`);
    }
  }, [snap.tick, under_pressure, snap.intelligence.churnRisk, bridge]);

  return (
    <MechanicBadge
      id="M08" family="economy" active={active}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FAMILY: RISK
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * M15 — Volatility Spike Detector
 * Risk family. Fires when volatility crosses 0.6 — signals market turbulence.
 * Pairs with ML companion M15a which adjusts draw probabilities.
 */
export function M15VolatilitySpikeDetector() {
  const bridge = useMechanicsBridge();
  const lastTickRef = useRef(-1);
  const spiked = useRef(false);
  const { snap } = bridge;
  const volatile = snap.intelligence.volatility > 0.60;
  const active = bridge.isMechanicActive('M15');

  useEffect(() => {
    if (snap.tick === lastTickRef.current) return;
    lastTickRef.current = snap.tick;

    // Leading edge only — fire once per volatility spike, not every tick
    if (volatile && !spiked.current) {
      spiked.current = true;
      bridge.touchMechanic('M15', {
        signal: snap.intelligence.volatility * 0.25,
        reason: 'volatility spike threshold crossed',
      });
      bridge.touchFamily('risk', { signal: 0.20 });
      bridge.debugLog('M15', `volatility spike: ${snap.intelligence.volatility.toFixed(3)}`);
    } else if (!volatile) {
      spiked.current = false; // reset for next spike
    }
  }, [snap.tick, volatile, snap.intelligence.volatility, bridge]);

  return <MechanicBadge id="M15" family="risk" active={active} />;
}

/**
 * M19 — Low-Cash Pressure Signal
 * Risk family. Activates under cash stress — amplifies risk ML layer.
 * Game rules: below $10K cash the run is in danger territory.
 */
export function M19LowCashPressure() {
  const bridge = useMechanicsBridge();
  const lastTickRef = useRef(-1);
  const { snap } = bridge;
  const danger = snap.cash < 10_000;
  const critical = snap.cash < 3_000;
  const active = bridge.isMechanicActive('M19');

  useEffect(() => {
    if (snap.tick === lastTickRef.current) return;
    if (snap.tick % 8 !== 0) return;
    lastTickRef.current = snap.tick;

    if (critical) {
      bridge.touchMechanic('M19', {
        signal: 0.35,
        reason: 'cash critical — below $3K',
      });
      bridge.touchFamily('risk', { signal: 0.28 });
    } else if (danger) {
      bridge.touchMechanic('M19', {
        signal: 0.18,
        reason: 'cash low — below $10K',
      });
      bridge.touchFamily('risk', { signal: 0.14 });
    }
  }, [snap.tick, danger, critical, snap.cash, bridge]);

  return <MechanicBadge id="M19" family="risk" active={active} />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FAMILY: CARDS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * M28 — Recommendation Engine Booster
 * Cards family. When recommendationPower is high, boosts the card draw quality signal.
 * This is the ML companion working — better cards surface when AI learns preferences.
 */
export function M28RecommendationBooster() {
  const bridge = useMechanicsBridge();
  const lastTickRef = useRef(-1);
  const { snap } = bridge;
  const boosted = snap.intelligence.recommendationPower > 0.60;
  const active = bridge.isMechanicActive('M28');

  useEffect(() => {
    if (snap.tick === lastTickRef.current) return;
    if (snap.tick % 24 !== 0) return; // draw cadence
    lastTickRef.current = snap.tick;

    if (boosted) {
      bridge.touchMechanic('M28', {
        signal: snap.intelligence.recommendationPower * 0.20,
        reason: 'recommendation power high — boosting card quality signal',
      });
      bridge.touchFamily('cards', { signal: 0.16 });
      bridge.touchFamily('ai', { signal: 0.10 });
    }
  }, [snap.tick, boosted, snap.intelligence.recommendationPower, bridge]);

  return <MechanicBadge id="M28" family="cards" active={active} />;
}

/**
 * M33 — Deck Entropy Balancer
 * Cards family. Detects when the run has had too many FUBARs / missed opportunities
 * and fires a rebalancing signal. Pairs with ML draw reroute in App.tsx.
 */
export function M33DeckEntropyBalancer() {
  const bridge = useMechanicsBridge();
  const lastTickRef = useRef(-1);
  const { snap } = bridge;
  // High churn + low alpha = entropy accumulation
  const entropy_high = snap.intelligence.churnRisk > 0.50 && snap.intelligence.alpha < 0.45;
  const active = bridge.isMechanicActive('M33');

  useEffect(() => {
    if (snap.tick === lastTickRef.current) return;
    if (snap.tick % 30 !== 0) return;
    lastTickRef.current = snap.tick;

    if (entropy_high) {
      bridge.touchMechanic('M33', {
        signal: 0.20,
        reason: 'deck entropy high — rebalance signal',
      });
      bridge.touchFamily('cards', { signal: 0.18 });
      bridge.touchFamily('ai', { signal: 0.12 });
      bridge.debugLog('M33', `entropy detected: churn=${snap.intelligence.churnRisk.toFixed(2)} alpha=${snap.intelligence.alpha.toFixed(2)}`);
    }
  }, [snap.tick, entropy_high, snap.intelligence, bridge]);

  return <MechanicBadge id="M33" family="cards" active={active} />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FAMILY: PROGRESSION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * M48 — XP Velocity Tracker
 * Progression family. Fires when XP is accumulating at high velocity (win streak).
 * Represents the game rewarding consistent positive cashflow decisions.
 */
export function M48XPVelocityTracker() {
  const bridge = useMechanicsBridge();
  const lastTickRef = useRef(-1);
  const { snap } = bridge;
  const streak_hot = snap.season.winStreak >= 3;
  const active = bridge.isMechanicActive('M48');

  useEffect(() => {
    if (snap.tick === lastTickRef.current) return;
    if (snap.tick % 60 !== 0) return; // season pulse cadence
    lastTickRef.current = snap.tick;

    if (streak_hot) {
      bridge.touchMechanic('M48', {
        signal: 0.15 + Math.min(snap.season.winStreak * 0.02, 0.20),
        reason: `win streak hot — streak=${snap.season.winStreak}`,
      });
      bridge.touchFamily('progression', { signal: 0.16 });
    }
  }, [snap.tick, streak_hot, snap.season.winStreak, bridge]);

  return <MechanicBadge id="M48" family="progression" active={active} />;
}

/**
 * M52 — Pass Tier Unlock Event
 * Progression family. Fires when the player crosses a pass tier threshold.
 * Represents unlock events — new mechanics become available at tier milestones.
 */
export function M52PassTierUnlock() {
  const bridge = useMechanicsBridge();
  const prevTierRef = useRef(1);
  const { snap } = bridge;
  const active = bridge.isMechanicActive('M52');

  useEffect(() => {
    const current = snap.season.passTier;
    if (current > prevTierRef.current) {
      bridge.touchMechanic('M52', {
        signal: 0.25,
        reason: `pass tier unlock: T${prevTierRef.current} → T${current}`,
      });
      bridge.touchFamily('progression', { signal: 0.22 });
      bridge.touchFamily('season', { signal: 0.18 });
      bridge.debugLog('M52', `tier unlocked: T${current}`);
      prevTierRef.current = current;
    }
  }, [snap.season.passTier, bridge]);

  return <MechanicBadge id="M52" family="progression" active={active} />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FAMILY: SEASON
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * M75 — Dominion Surge Detector
 * Season family. Fires when dominionControl crosses tier thresholds (10, 25, 50, 100).
 * Represents territory control milestones — PvP and co-op relevance.
 */
export function M75DominionSurge() {
  const bridge = useMechanicsBridge();
  const lastDominionRef = useRef(0);
  const { snap } = bridge;
  const THRESHOLDS = [10, 25, 50, 100, 250, 500];
  const active = bridge.isMechanicActive('M75');

  useEffect(() => {
    const current = snap.season.dominionControl;
    const prev = lastDominionRef.current;

    const crossed = THRESHOLDS.find((t) => prev < t && current >= t);
    if (crossed !== undefined) {
      bridge.touchMechanic('M75', {
        signal: 0.28,
        reason: `dominion surge: ${prev} → ${current} (crossed ${crossed})`,
      });
      bridge.touchFamily('season', { signal: 0.24 });
      bridge.touchFamily('pvp', { signal: 0.16 });
      bridge.debugLog('M75', `dominion threshold crossed: ${crossed}`);
    }
    lastDominionRef.current = current;
  }, [snap.season.dominionControl, bridge]);

  return <MechanicBadge id="M75" family="season" active={active} />;
}

/**
 * M79 — Node Pressure Relief
 * Season family. Fires when nodePressure drops significantly — relief event.
 * High pressure → danger; drop in pressure → recovery momentum.
 */
export function M79NodePressureRelief() {
  const bridge = useMechanicsBridge();
  const lastTickRef = useRef(-1);
  const prevPressureRef = useRef(0);
  const { snap } = bridge;
  // nodePressure isn't in the snapshot — use churnRisk as proxy
  // (nodePressure drives churnRisk in App.tsx tick engine)
  const relief = snap.intelligence.churnRisk < 0.30 && prevPressureRef.current > 0.50;
  const active = bridge.isMechanicActive('M79');

  useEffect(() => {
    if (snap.tick === lastTickRef.current) return;
    if (snap.tick % 15 !== 0) return;
    lastTickRef.current = snap.tick;

    if (relief) {
      bridge.touchMechanic('M79', {
        signal: 0.20,
        reason: 'node pressure relief — churn risk dropped',
      });
      bridge.touchFamily('season', { signal: 0.18 });
      bridge.touchFamily('progression', { signal: 0.12 });
    }
    prevPressureRef.current = snap.intelligence.churnRisk;
  }, [snap.tick, relief, snap.intelligence.churnRisk, bridge]);

  return <MechanicBadge id="M79" family="season" active={active} />;
}

// ─── Composite: MechanicsVerticalSlice ────────────────────────────────────────
// Mount this once in the run screen to activate all 10 mechanics.
// In production, set DEV=false and badges disappear automatically.

export function MechanicsVerticalSlice() {
  return (
    <div
      className={`${DEV ? 'flex flex-wrap gap-1 px-4 py-1 bg-zinc-950/80 border-b border-zinc-800' : 'hidden'}`}
      aria-hidden
      data-testid="mechanics-vertical-slice"
    >
      {DEV && (
        <span className="text-zinc-600 text-xs font-mono mr-2">mechanics bridge:</span>
      )}
      <M05CashflowAmplifier />
      <M08ExpenseErosionDetector />
      <M15VolatilitySpikeDetector />
      <M19LowCashPressure />
      <M28RecommendationBooster />
      <M33DeckEntropyBalancer />
      <M48XPVelocityTracker />
      <M52PassTierUnlock />
      <M75DominionSurge />
      <M79NodePressureRelief />
    </div>
  );
}
