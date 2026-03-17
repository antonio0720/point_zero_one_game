/**
 * FILE: GameHUD.tsx — SOVEREIGN COMMAND INTERFACE
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/features/run/components/GameHUD.tsx
 * Density6 LLC · Point Zero One · Confidential
 *
 * Production HUD for the live run surface.
 *
 * Direct engine coverage:
 *   - Engine 1: Time
 *   - Engine 2: Pressure
 *   - Engine 3: Tension
 *   - Engine 4: Shield
 *   - Engine 5: Battle
 *   - Engine 6: Cascade
 *   - Engine 7: Sovereignty
 *   - ML Intel overlay
 *
 * Design language:
 *   Military terminal + sovereign financial war-room.
 *   Dark glass. Amber command. Teal integrity. Crimson threat.
 */
'use client';

import React, { useEffect, useMemo } from 'react';
import { useIntel } from '../../../ml/wiring/MLContext';
import { useTimeEngine } from '../hooks/useTimeEngine';
import { usePressureEngine } from '../hooks/usePressureEngine';
import { useTensionEngine } from '../hooks/useTensionEngine';
import { useShieldEngine } from '../hooks/useShieldEngine';
import { useBattleEngine } from '../hooks/useBattleEngine';
import { useCascadeEngine } from '../hooks/useCascadeEngine';
import { useSovereigntyEngine } from '../hooks/useSovereigntyEngine';
import PressureSignalTooltip from './PressureSignalTooltip';

interface GameHUDProps {
  readonly isActiveRun?: boolean;
  readonly showIntel?: boolean;
}

type Dict = Record<string, unknown>;

const HUD_STYLE_ID = 'pzo-game-hud-styles';

const HUD_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&display=swap');

  .pzo-hud-root {
    --hud-bg: #07090d;
    --hud-panel: rgba(12, 15, 20, 0.96);
    --hud-panel-hi: rgba(18, 22, 30, 0.98);
    --hud-panel-soft: rgba(14, 18, 24, 0.84);
    --hud-border: #18202d;
    --hud-border-hi: #243041;
    --hud-amber: #c9a84c;
    --hud-amber-soft: rgba(201, 168, 76, 0.14);
    --hud-amber-glow: rgba(201, 168, 76, 0.24);
    --hud-teal: #1de9b6;
    --hud-teal-soft: rgba(29, 233, 182, 0.12);
    --hud-blue: #4ea5ff;
    --hud-purple: #a78bfa;
    --hud-orange: #f59e0b;
    --hud-crimson: #dc2626;
    --hud-crimson-soft: rgba(220, 38, 38, 0.16);
    --hud-green: #4ade80;
    --hud-text: #93a4bd;
    --hud-text-hi: #d8e4f4;
    --hud-text-dim: #536176;
    --hud-shadow: 0 18px 48px rgba(0, 0, 0, 0.38);
    --font-ui: 'Rajdhani', system-ui, sans-serif;
    --font-mono: 'Share Tech Mono', ui-monospace, monospace;
    color: var(--hud-text-hi);
    font-family: var(--font-ui);
    user-select: none;
    position: relative;
    isolation: isolate;
  }

  .pzo-hud-root * { box-sizing: border-box; }

  .pzo-hud-shell {
    display: grid;
    grid-template-columns: 190px minmax(0, 1fr) 210px;
    gap: 8px;
    padding: 8px;
    border: 1px solid var(--hud-border-hi);
    background:
      radial-gradient(circle at top left, rgba(201, 168, 76, 0.07), transparent 32%),
      radial-gradient(circle at bottom right, rgba(78, 165, 255, 0.05), transparent 28%),
      linear-gradient(180deg, rgba(255,255,255,0.015), rgba(255,255,255,0)),
      var(--hud-bg);
    box-shadow: var(--hud-shadow);
    position: relative;
    overflow: hidden;
  }

  .pzo-hud-shell::before {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      180deg,
      transparent 0,
      transparent 2px,
      rgba(255,255,255,0.012) 2px,
      rgba(255,255,255,0.012) 4px
    );
    pointer-events: none;
    z-index: 0;
    mix-blend-mode: screen;
  }

  .pzo-col,
  .pzo-center-stack {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  .pzo-panel {
    position: relative;
    background: linear-gradient(180deg, var(--hud-panel-hi), var(--hud-panel));
    border: 1px solid var(--hud-border);
    border-radius: 6px;
    padding: 10px;
    min-width: 0;
    overflow: hidden;
    clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
  }

  .pzo-panel::after {
    content: '';
    position: absolute;
    inset: 0;
    border: 1px solid rgba(255,255,255,0.02);
    pointer-events: none;
    clip-path: inherit;
  }

  .pzo-panel--warning {
    border-color: rgba(245, 158, 11, 0.42);
    box-shadow: inset 0 0 22px rgba(245, 158, 11, 0.08), 0 0 0 1px rgba(245, 158, 11, 0.08);
  }

  .pzo-panel--critical {
    border-color: rgba(220, 38, 38, 0.56);
    box-shadow: inset 0 0 28px rgba(220, 38, 38, 0.12), 0 0 16px rgba(220, 38, 38, 0.18);
    animation: pzoCritPulse 1s ease-in-out infinite alternate;
  }

  .pzo-panel--fortified {
    border-color: rgba(29, 233, 182, 0.42);
    box-shadow: inset 0 0 26px rgba(29, 233, 182, 0.08), 0 0 0 1px rgba(29, 233, 182, 0.06);
  }

  .pzo-section-label {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    color: var(--hud-amber);
    font-family: var(--font-mono);
    font-size: 10px;
    line-height: 1;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .pzo-section-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, rgba(201, 168, 76, 0.35), transparent);
  }

  .pzo-top-strip {
    grid-column: 1 / -1;
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 6px;
  }

  .pzo-chip {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
    padding: 8px 10px;
    background: linear-gradient(180deg, rgba(14,18,24,0.95), rgba(10,13,18,0.95));
    border: 1px solid var(--hud-border);
    border-radius: 5px;
  }

  .pzo-chip__label {
    font-family: var(--font-mono);
    font-size: 8px;
    color: var(--hud-text-dim);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pzo-chip__value {
    font-family: var(--font-mono);
    font-size: 15px;
    font-weight: 700;
    line-height: 1;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pzo-chip__sub {
    font-family: var(--font-mono);
    font-size: 9px;
    color: var(--hud-text);
    letter-spacing: 0.08em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pzo-pressure-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .pzo-pressure-tier,
  .pzo-pressure-sub {
    text-align: center;
    font-family: var(--font-mono);
  }

  .pzo-pressure-tier {
    font-size: 11px;
    letter-spacing: 0.16em;
  }

  .pzo-pressure-sub {
    font-size: 9px;
    color: var(--hud-text);
  }

  .pzo-intel-bars { display: flex; flex-direction: column; gap: 6px; }
  .pzo-bar-row { display: grid; grid-template-columns: 60px minmax(0, 1fr) 34px; align-items: center; gap: 6px; }
  .pzo-bar-label,
  .pzo-bar-value,
  .pzo-bar-note,
  .pzo-meta,
  .pzo-pill,
  .pzo-shield-id,
  .pzo-shield-pct,
  .pzo-mini-table,
  .pzo-mini-table td,
  .pzo-mini-table th,
  .pzo-queue-caption,
  .pzo-kv,
  .pzo-kv-value,
  .pzo-stat-key,
  .pzo-stat-val,
  .pzo-stat-help {
    font-family: var(--font-mono);
  }

  .pzo-bar-label,
  .pzo-bar-value,
  .pzo-meta,
  .pzo-shield-id,
  .pzo-shield-pct,
  .pzo-queue-caption,
  .pzo-kv,
  .pzo-kv-value,
  .pzo-stat-key,
  .pzo-stat-help {
    font-size: 9px;
  }

  .pzo-bar-label { color: var(--hud-text); letter-spacing: 0.11em; }
  .pzo-bar-value { text-align: right; color: var(--hud-text-hi); }
  .pzo-bar-track {
    position: relative;
    height: 7px;
    border: 1px solid var(--hud-border);
    background: #0f151d;
    overflow: hidden;
    border-radius: 2px;
  }

  .pzo-bar-fill {
    position: absolute;
    inset: 0 auto 0 0;
    height: 100%;
    transition: width 180ms ease-out;
  }

  .pzo-bar-fill::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 2px;
    height: 100%;
    background: rgba(255,255,255,0.72);
  }

  .pzo-meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-top: 6px;
    margin-top: 4px;
    border-top: 1px solid var(--hud-border);
  }

  .pzo-meta { color: var(--hud-text); letter-spacing: 0.1em; }
  .pzo-meta-value {
    font-family: var(--font-mono);
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .pzo-shield-layers,
  .pzo-battle-stack,
  .pzo-cascade-stack { display: flex; flex-direction: column; gap: 6px; }

  .pzo-shield-row {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr) 38px;
    align-items: center;
    gap: 6px;
  }

  .pzo-shield-id { color: var(--hud-text-dim); letter-spacing: 0.1em; }
  .pzo-shield-segments { display: flex; gap: 2px; height: 8px; }
  .pzo-shield-segment {
    flex: 1;
    border-radius: 2px;
    transition: background 160ms ease-out, box-shadow 160ms ease-out;
    background: #10161f;
  }
  .pzo-shield-pct { text-align: right; }
  .pzo-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 20px;
    padding: 2px 6px;
    border-radius: 999px;
    border: 1px solid currentColor;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .pzo-pills { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

  .pzo-tension-panel {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-height: 148px;
  }

  .pzo-tension-score {
    font-family: var(--font-mono);
    font-size: 22px;
    font-weight: 700;
    line-height: 1;
    text-align: center;
  }

  .pzo-threat-badge {
    padding: 3px 6px;
    border-radius: 4px;
    text-align: center;
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .pzo-queue-grid {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 4px;
  }

  .pzo-queue-pip {
    height: 9px;
    border-radius: 2px;
    background: #10161f;
    transition: background 160ms ease-out, box-shadow 160ms ease-out, transform 160ms ease-out;
  }

  .pzo-queue-caption {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    color: var(--hud-text);
    letter-spacing: 0.08em;
  }

  .pzo-sv-wrap {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr);
    gap: 8px;
    align-items: center;
  }

  .pzo-grade-hex {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    clip-path: polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%);
    font-family: var(--font-mono);
    font-size: 26px;
    font-weight: 700;
  }

  .pzo-sv-side {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .pzo-kv {
    color: var(--hud-text-dim);
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .pzo-kv-value {
    color: var(--hud-text-hi);
    font-size: 12px;
    letter-spacing: 0.08em;
  }

  .pzo-mini-table {
    width: 100%;
    border-collapse: collapse;
  }

  .pzo-mini-table th,
  .pzo-mini-table td {
    padding: 4px 0;
    font-size: 9px;
    text-align: left;
    color: var(--hud-text);
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }

  .pzo-mini-table th {
    color: var(--hud-text-dim);
    letter-spacing: 0.12em;
    font-weight: 400;
    text-transform: uppercase;
  }

  .pzo-alert {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 38px;
    padding: 8px 12px;
    border: 1px solid rgba(220, 38, 38, 0.46);
    background: linear-gradient(90deg, rgba(220, 38, 38, 0.14), rgba(220, 38, 38, 0.05));
    border-radius: 5px;
    font-family: var(--font-mono);
    color: #fecaca;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    animation: pzoCritPulse 0.9s ease-in-out infinite alternate;
  }

  .pzo-alert__right { margin-left: auto; }

  .pzo-bottom-row {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: repeat(8, minmax(0, 1fr));
    gap: 6px;
  }

  .pzo-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-width: 0;
    min-height: 58px;
    padding: 8px;
    border: 1px solid var(--hud-border);
    border-radius: 5px;
    background: linear-gradient(180deg, rgba(14,18,24,0.95), rgba(10,13,18,0.95));
  }

  .pzo-stat-key {
    color: var(--hud-text-dim);
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .pzo-stat-val {
    font-size: 16px;
    font-weight: 700;
    line-height: 1;
  }

  .pzo-stat-help {
    color: var(--hud-text);
    letter-spacing: 0.08em;
    text-align: center;
  }

  .pzo-stat-track {
    width: 100%;
    height: 3px;
    border-radius: 999px;
    background: #111820;
    overflow: hidden;
  }

  .pzo-stat-fill {
    height: 100%;
    transition: width 180ms ease-out;
  }

  @keyframes pzoCritPulse {
    from { opacity: 0.72; }
    to   { opacity: 1; }
  }

  @media (max-width: 1180px) {
    .pzo-hud-shell {
      grid-template-columns: minmax(0, 1fr);
    }

    .pzo-top-strip {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .pzo-bottom-row {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  @media (max-width: 760px) {
    .pzo-top-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .pzo-bottom-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .pzo-sv-wrap { grid-template-columns: 1fr; justify-items: center; }
  }

  @media (prefers-reduced-motion: reduce) {
    .pzo-panel--critical,
    .pzo-alert { animation: none !important; }
    .pzo-bar-fill,
    .pzo-stat-fill,
    .pzo-shield-segment,
    .pzo-queue-pip { transition: none !important; }
  }
`;

function injectStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(HUD_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = HUD_STYLE_ID;
  style.textContent = HUD_STYLES;
  document.head.appendChild(style);
}

function asDict(value: unknown): Dict {
  return value && typeof value === 'object' ? (value as Dict) : {};
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown, fallback = '—'): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function pct(value: number): string {
  return `${Math.round(clamp01(value) * 100)}%`;
}

function fmtRatio(value: number, digits = 1): string {
  return (clamp01(value) * 100).toFixed(digits);
}

function fmtWhole(value: number): string {
  return Math.round(value).toString();
}

function colorByBand(value: number, bands: { high: string; mid: string; low: string }): string {
  if (value >= 0.7) return bands.high;
  if (value >= 0.4) return bands.mid;
  return bands.low;
}

function shieldLabel(id: string): string {
  const map: Record<string, string> = {
    LIQUIDITY_BUFFER: 'LIQ',
    CREDIT_LINE: 'CRD',
    ASSET_FLOOR: 'AST',
    NETWORK_CORE: 'NET',
    L1: 'L1',
    L2: 'L2',
    L3: 'L3',
    L4: 'L4',
  };
  return map[id] ?? id.slice(0, 3).toUpperCase();
}

const TIER_COLORS: Record<string, string> = {
  CALM: '#4ade80',
  BUILDING: '#c9a84c',
  ELEVATED: '#f97316',
  HIGH: '#ef4444',
  CRITICAL: '#ff0000',
};

const GRADE_COLORS: Record<string, string> = {
  S: '#fbbf24',
  A: '#4ade80',
  B: '#c9a84c',
  C: '#38bdf8',
  D: '#f97316',
  F: '#dc2626',
};

function TopStrip(): React.JSX.Element {
  const time = asDict(useTimeEngine());
  const pressure = asDict(usePressureEngine());
  const battle = asDict(useBattleEngine());
  const cascade = asDict(useCascadeEngine());
  const sovereignty = asDict(useSovereigntyEngine());

  const tickTier = str(time.currentTier ?? time.tickTier, '—');
  const ticksRemaining = num(time.ticksRemaining ?? time.ticksUntilTimeout, 0);
  const holdsRemaining = num(time.holdsRemaining, 0);
  const decisionWindows = Array.isArray(time.activeDecisionWindows)
    ? time.activeDecisionWindows.length
    : num(time.decisionWindowCount, 0);

  const pressureTier = str(pressure.tier, '—');
  const pressureScore = num(pressure.score, 0);

  const activeBots = num(battle.activeBotsCount, 0);
  const haterHeat = num(battle.haterHeat, 0);
  const lastAttack = asDict(battle.lastAttackFired);
  const attackType = str(lastAttack.attackType, activeBots > 0 ? 'LIVE' : 'QUIET');

  const negativeChains = Array.isArray(cascade.activeNegativeChains)
    ? cascade.activeNegativeChains.length
    : num(cascade.activeChainCount, 0);
  const positiveCascades = Array.isArray(cascade.activePositiveCascades)
    ? cascade.activePositiveCascades.length
    : num(cascade.positiveCascadeCount, 0);
  const totalLinksDefeated = num(cascade.totalLinksDefeated, 0);

  const pipelineStatus = str(sovereignty.pipelineStatus, 'IDLE');
  const integrityStatus = str(sovereignty.integrityStatus, 'UNVERIFIED');
  const proofHash = str(sovereignty.proofHash, '—');
  const proofShort = proofHash === '—' ? '—' : proofHash.slice(0, 10);

  const chips = [
    {
      label: 'CLOCK',
      value: `T${fmtWhole(num(time.ticksElapsed, 0))}`,
      sub: `${ticksRemaining} LEFT · ${tickTier}`,
      color: '#c9a84c',
    },
    {
      label: 'DECISION',
      value: fmtWhole(decisionWindows),
      sub: `${holdsRemaining} HOLDS`,
      color: decisionWindows > 0 ? '#f59e0b' : '#93a4bd',
    },
    {
      label: 'PRESSURE',
      value: pressureTier,
      sub: `${fmtWhole(pressureScore * 100)} SCORE`,
      color: TIER_COLORS[pressureTier] ?? '#93a4bd',
    },
    {
      label: 'BATTLE',
      value: `${activeBots} BOT${activeBots === 1 ? '' : 'S'}`,
      sub: `HEAT ${fmtWhole(haterHeat * 100)} · ${attackType}`,
      color: activeBots > 0 ? '#dc2626' : '#4ade80',
    },
    {
      label: 'CASCADE',
      value: `${negativeChains}/${positiveCascades}`,
      sub: `${totalLinksDefeated} LINKS CUT`,
      color: negativeChains > 0 ? '#a78bfa' : '#38bdf8',
    },
    {
      label: 'PROOF',
      value: pipelineStatus,
      sub: `${integrityStatus} · ${proofShort}`,
      color:
        pipelineStatus === 'FAILED'
          ? '#dc2626'
          : pipelineStatus === 'COMPLETE'
            ? '#4ade80'
            : '#c9a84c',
    },
  ] as const;

  return (
    <div className="pzo-top-strip" aria-label="Run status strip">
      {chips.map((chip) => (
        <div className="pzo-chip" key={chip.label}>
          <span className="pzo-chip__label">{chip.label}</span>
          <span className="pzo-chip__value" style={{ color: chip.color }}>
            {chip.value}
          </span>
          <span className="pzo-chip__sub">{chip.sub}</span>
        </div>
      ))}
    </div>
  );
}

function PressureArc(): React.JSX.Element {
  const pressure = asDict(usePressureEngine());
  const score = clamp01(num(pressure.score, 0));
  const tier = str(pressure.tier, 'CALM');
  const isEscalating = bool(pressure.isEscalating, false);
  const isDecaying = bool(pressure.isDecaying, false);
  const isCritical = bool(pressure.isCritical, false);
  const ticksToCalm = num(pressure.ticksToCalm ?? pressure.ticksUntilCalm, 0);
  const stagnationCount = num(pressure.stagnationCount, 0);
  const postActionScore = num(pressure.postActionScore, score);
  const triggerSignals = Array.isArray(pressure.triggerSignals) ? pressure.triggerSignals : [];

  const radius = 52;
  const cx = 68;
  const cy = 68;
  const strokeWidth = 10;
  const gapDeg = 28;
  const sweepDeg = 360 - gapDeg;
  const startDeg = gapDeg / 2;
  const fillDeg = sweepDeg * score;

  const color = TIER_COLORS[tier] ?? '#93a4bd';

  const toXY = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  };

  const trackStart = toXY(startDeg);
  const trackEnd = toXY(startDeg + sweepDeg);
  const fillStart = toXY(startDeg);
  const fillEnd = toXY(startDeg + fillDeg);
  const largeArc = fillDeg > 180 ? 1 : 0;

  const trackPath = `M ${trackStart.x} ${trackStart.y} A ${radius} ${radius} 0 1 1 ${trackEnd.x} ${trackEnd.y}`;
  const fillPath =
    score > 0.01
      ? `M ${fillStart.x} ${fillStart.y} A ${radius} ${radius} 0 ${largeArc} 1 ${fillEnd.x} ${fillEnd.y}`
      : null;

  return (
    <div className="pzo-pressure-wrap">
      <svg width="136" height="136" viewBox="0 0 136 136" aria-label="Pressure gauge">
        {[0, 25, 50, 75, 100].map((value) => {
          const degree = startDeg + (sweepDeg * value) / 100;
          const p1 = toXY(degree);
          const outer = radius + 7;
          const rad = ((degree - 90) * Math.PI) / 180;
          const p2 = { x: cx + outer * Math.cos(rad), y: cy + outer * Math.sin(rad) };
          return (
            <line
              key={value}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke="#1e2734"
              strokeWidth={value === 0 || value === 100 ? 2 : 1}
            />
          );
        })}

        <path d={trackPath} fill="none" stroke="#10161f" strokeWidth={strokeWidth} strokeLinecap="butt" />

        {fillPath && (
          <path
            d={fillPath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
            style={{
              filter: isCritical
                ? `drop-shadow(0 0 8px ${color}) drop-shadow(0 0 2px #fff)`
                : `drop-shadow(0 0 5px ${color})`,
              transition: 'all 180ms ease-out',
            }}
          />
        )}

        <text
          x={cx}
          y={cy - 7}
          textAnchor="middle"
          fill={color}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700 }}
        >
          {fmtWhole(score * 100)}
        </text>
        <text
          x={cx}
          y={cy + 11}
          textAnchor="middle"
          fill="#536176"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}
        >
          PRESSURE
        </text>

        {isEscalating && (
          <text
            x={cx + 22}
            y={cy - 4}
            fill="#ef4444"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700 }}
          >
            ▲
          </text>
        )}
        {isDecaying && !isEscalating && (
          <text
            x={cx + 22}
            y={cy - 4}
            fill="#4ade80"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700 }}
          >
            ▼
          </text>
        )}
      </svg>

      <div className="pzo-pressure-tier" style={{ color }}>
        {tier}
      </div>
      <div className="pzo-pressure-sub">{ticksToCalm}T TO CALM · POST {fmtWhole(postActionScore * 100)}</div>
      <div className="pzo-pressure-sub">STAGNATION {stagnationCount}</div>
      <div className="pzo-pills" aria-label="Pressure signal summary">
        {triggerSignals.slice(0, 3).map((signal) => (
          <span className="pzo-pill" key={signal} style={{ color, background: `${color}18` }}>
            {signal}
          </span>
        ))}
      </div>
    </div>
  );
}

function IntelBars(): React.JSX.Element {
  const intel = useIntel();

  const bars = [
    { key: 'alpha', label: 'ALPHA', value: clamp01(num(intel.alpha, 0)), color: '#4ade80', warn: false },
    { key: 'risk', label: 'RISK', value: clamp01(num(intel.risk, 0)), color: '#f59e0b', warn: num(intel.risk, 0) > 0.7 },
    { key: 'vol', label: 'VOL', value: clamp01(num(intel.volatility, 0)), color: '#38bdf8', warn: false },
    { key: 'tilt', label: 'TILT', value: clamp01(num(intel.tiltRisk, 0)), color: '#fb923c', warn: num(intel.tiltRisk, 0) > 0.5 },
    {
      key: 'runway',
      label: 'RUNWAY',
      value: clamp01(1 - num(intel.bankruptcyRisk60, 0)),
      color: '#dc2626',
      warn: num(intel.bankruptcyRisk60, 0) > 0.6,
    },
  ] as const;

  const momentum = num(intel.momentum, 0);

  return (
    <div className="pzo-intel-bars">
      {bars.map((bar) => (
        <div className="pzo-bar-row" key={bar.key}>
          <span className="pzo-bar-label">{bar.label}</span>
          <div className="pzo-bar-track">
            <div
              className="pzo-bar-fill"
              style={{
                width: pct(bar.value),
                background: bar.warn
                  ? 'linear-gradient(90deg, #7f1d1d, #dc2626)'
                  : `linear-gradient(90deg, ${bar.color}90, ${bar.color})`,
                boxShadow: bar.warn ? '0 0 6px rgba(220,38,38,.55)' : `0 0 5px ${bar.color}55`,
              }}
              role="progressbar"
              aria-valuenow={Math.round(bar.value * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={bar.label}
            />
          </div>
          <span className="pzo-bar-value" style={{ color: bar.warn ? '#fecaca' : '#d8e4f4' }}>
            {fmtWhole(bar.value * 100)}
          </span>
        </div>
      ))}

      <div className="pzo-meta-row">
        <span className="pzo-meta">MOMENTUM</span>
        <span
          className="pzo-meta-value"
          style={{
            color: momentum > 0.05 ? '#4ade80' : momentum < -0.05 ? '#dc2626' : '#d8e4f4',
            textShadow:
              momentum > 0.05
                ? '0 0 8px rgba(74, 222, 128, 0.55)'
                : momentum < -0.05
                  ? '0 0 8px rgba(220, 38, 38, 0.55)'
                  : 'none',
          }}
        >
          {momentum >= 0 ? '+' : ''}
          {(momentum * 100).toFixed(1)}
        </span>
      </div>
    </div>
  );
}

function ShieldPanel(): React.JSX.Element {
  const shield = asDict(useShieldEngine());
  const layers = useMemo(() => {
    const raw = asDict(shield.layers);
    return Object.entries(raw);
  }, [shield]);

  const overallPct = clamp01(num(shield.overallPct, num(shield.overallIntegrityPct, 0)));
  const overallPct100 = num(shield.overallPct100, overallPct * 100);
  const isFortified = bool(shield.isFortified, false);
  const isInBreachCascade = bool(shield.isInBreachCascade, false);
  const isAnyLow = bool(shield.isAnyLow, overallPct <= 0.35);
  const cascadeCount = num(shield.cascadeCount, 0);
  const weakestLayerId = str(shield.weakestLayerId, '—');

  const overallColor = colorByBand(overallPct, {
    high: '#dc2626',
    mid: '#f59e0b',
    low: '#4ade80',
  });

  return (
    <div className="pzo-shield-layers">
      {layers.length === 0 && <div className="pzo-meta">NO SHIELD SNAPSHOT</div>}

      {layers.map(([id, rawLayer]) => {
        const layer = asDict(rawLayer);
        const integrityPct = clamp01(num(layer.integrityPct, 1));
        const breached = bool(layer.isBreached ?? layer.breached, false);
        const critical = bool(layer.isCriticalWarning, breached || integrityPct <= 0.2);
        const low = bool(layer.isLowWarning, integrityPct <= 0.45);
        const filled = Math.round(integrityPct * 8);
        const color = breached ? '#5f0f0f' : critical ? '#dc2626' : low ? '#f59e0b' : '#1de9b6';

        return (
          <div className="pzo-shield-row" key={id}>
            <span className="pzo-shield-id">{shieldLabel(id)}</span>
            <div className="pzo-shield-segments">
              {Array.from({ length: 8 }, (_, index) => (
                <div
                  className="pzo-shield-segment"
                  key={`${id}-${index}`}
                  style={{
                    background: index < filled ? color : '#10161f',
                    boxShadow: index < filled && !breached ? `0 0 4px ${color}55` : 'none',
                  }}
                />
              ))}
            </div>
            <span className="pzo-shield-pct" style={{ color }}>
              {fmtWhole(integrityPct * 100)}%
            </span>
          </div>
        );
      })}

      <div className="pzo-meta-row">
        <span className="pzo-meta">OVERALL {weakestLayerId !== '—' ? `· WEAK ${shieldLabel(weakestLayerId)}` : ''}</span>
        <span className="pzo-meta-value" style={{ color: overallColor }}>
          {fmtWhole(overallPct100)}%
        </span>
      </div>

      <div className="pzo-pills">
        {isFortified && (
          <span className="pzo-pill" style={{ color: '#1de9b6', background: 'rgba(29,233,182,.10)' }}>
            FORTIFIED
          </span>
        )}
        {isAnyLow && !isInBreachCascade && (
          <span className="pzo-pill" style={{ color: '#f59e0b', background: 'rgba(245,158,11,.10)' }}>
            LOW INTEGRITY
          </span>
        )}
        {isInBreachCascade && (
          <span className="pzo-pill" style={{ color: '#dc2626', background: 'rgba(220,38,38,.12)' }}>
            CASCADE ×{cascadeCount}
          </span>
        )}
      </div>
    </div>
  );
}

function TensionPanel(): React.JSX.Element {
  const tension = asDict(useTensionEngine());

  const score = clamp01(num(tension.score, 0));
  const queueLength = num(tension.queueLength, 0);
  const arrivedCount = num(tension.arrivedCount, 0);
  const queuedCount = num(tension.queuedCount, 0);
  const expiredCount = num(tension.expiredCount, 0);
  const pulseTicksActive = num(tension.pulseTicksActive, 0);
  const isPulseActive = bool(tension.isPulseActive, false);
  const visibilityState = str(tension.visibilityState, 'SHADOWED');
  const threatUrgency = str(
    tension.threatUrgency,
    score >= 0.75 ? 'URGENT' : score >= 0.4 ? 'BUILDING' : 'STABLE',
  );

  const urgencyColor =
    threatUrgency === 'URGENT' ? '#dc2626' : threatUrgency === 'BUILDING' ? '#f59e0b' : '#1de9b6';
  const scoreColor = colorByBand(score, { high: '#dc2626', mid: '#f59e0b', low: '#1de9b6' });
  const totalPips = Math.max(queueLength, 12);

  return (
    <div className="pzo-tension-panel">
      <div
        className="pzo-tension-score"
        style={{
          color: scoreColor,
          textShadow: isPulseActive ? `0 0 12px ${scoreColor}` : 'none',
        }}
      >
        {fmtRatio(score)}
      </div>

      <div
        className="pzo-threat-badge"
        style={{
          color: urgencyColor,
          border: `1px solid ${urgencyColor}`,
          background:
            threatUrgency === 'URGENT'
              ? 'rgba(220,38,38,.14)'
              : threatUrgency === 'BUILDING'
                ? 'rgba(245,158,11,.10)'
                : 'rgba(29,233,182,.08)',
        }}
      >
        {threatUrgency}
      </div>

      <div className="pzo-queue-grid">
        {Array.from({ length: totalPips }, (_, index) => {
          const background =
            index < arrivedCount ? '#dc2626' : index < arrivedCount + queuedCount ? '#f59e0b' : '#10161f';
          return (
            <div
              className="pzo-queue-pip"
              key={`pip-${index}`}
              style={{
                background,
                boxShadow: index < arrivedCount ? '0 0 4px rgba(220,38,38,.6)' : 'none',
                transform: isPulseActive && index === 0 ? 'scale(1.05)' : 'none',
              }}
            />
          );
        })}
      </div>

      <div className="pzo-queue-caption">
        <span>{arrivedCount} ARRIVED</span>
        <span>{queuedCount} QUEUED</span>
        <span>{expiredCount} EXPIRED</span>
      </div>

      <div className="pzo-meta-row">
        <span className="pzo-meta">VIS {visibilityState}</span>
        <span className="pzo-meta-value" style={{ color: isPulseActive ? '#dc2626' : '#d8e4f4' }}>
          {isPulseActive ? `PULSE ×${pulseTicksActive}` : 'STEADY'}
        </span>
      </div>
    </div>
  );
}

function BattlePanel(): React.JSX.Element {
  const battle = asDict(useBattleEngine());

  const activeBotsCount = num(battle.activeBotsCount, 0);
  const haterHeat = clamp01(num(battle.haterHeat, 0));
  const injectedCards = Array.isArray(battle.injectedCards) ? battle.injectedCards : [];
  const activeBots = Array.isArray(battle.activeBots) ? battle.activeBots : [];
  const lastAttack = asDict(battle.lastAttackFired);
  const lastStateChange = asDict(battle.lastStateChange);

  const attackBot = str(lastAttack.botId, '—');
  const attackType = str(lastAttack.attackType, '—');
  const targetLayer = str(lastAttack.targetLayer, '—');
  const transition = `${str(lastStateChange.from, '—')}→${str(lastStateChange.to, '—')}`;

  return (
    <div className="pzo-battle-stack">
      <div className="pzo-bar-row">
        <span className="pzo-bar-label">HEAT</span>
        <div className="pzo-bar-track">
          <div
            className="pzo-bar-fill"
            style={{
              width: pct(haterHeat),
              background: 'linear-gradient(90deg, rgba(220,38,38,.65), #dc2626)',
              boxShadow: '0 0 6px rgba(220,38,38,.45)',
            }}
          />
        </div>
        <span className="pzo-bar-value">{fmtWhole(haterHeat * 100)}</span>
      </div>

      <table className="pzo-mini-table" aria-label="Battle engine status">
        <tbody>
          <tr>
            <th scope="row">ACTIVE</th>
            <td style={{ color: activeBotsCount > 0 ? '#fecaca' : '#d8e4f4' }}>{activeBotsCount}</td>
          </tr>
          <tr>
            <th scope="row">INJECT</th>
            <td>{injectedCards.length}</td>
          </tr>
          <tr>
            <th scope="row">ATTACK</th>
            <td>{attackType}</td>
          </tr>
          <tr>
            <th scope="row">TARGET</th>
            <td>{targetLayer}</td>
          </tr>
          <tr>
            <th scope="row">STATE</th>
            <td>{transition}</td>
          </tr>
        </tbody>
      </table>

      <div className="pzo-meta-row">
        <span className="pzo-meta">LATEST BOT</span>
        <span className="pzo-meta-value" style={{ color: activeBots.length > 0 ? '#dc2626' : '#d8e4f4' }}>
          {attackBot}
        </span>
      </div>
    </div>
  );
}

function CascadePanel(): React.JSX.Element {
  const cascade = asDict(useCascadeEngine());

  const activeNegativeChains = Array.isArray(cascade.activeNegativeChains) ? cascade.activeNegativeChains : [];
  const activePositiveCascades = Array.isArray(cascade.activePositiveCascades) ? cascade.activePositiveCascades : [];
  const totalLinksDefeated = num(cascade.totalLinksDefeated, 0);
  const latestStarted = asDict(cascade.latestChainStarted);
  const latestBroken = asDict(cascade.latestChainBroken);
  const latestPositive = asDict(cascade.latestPositiveActivated);
  const nemesisBrokenEvents = Array.isArray(cascade.nemesisBrokenEvents) ? cascade.nemesisBrokenEvents : [];

  return (
    <div className="pzo-cascade-stack">
      <table className="pzo-mini-table" aria-label="Cascade engine status">
        <tbody>
          <tr>
            <th scope="row">NEG</th>
            <td style={{ color: activeNegativeChains.length > 0 ? '#e9d5ff' : '#d8e4f4' }}>
              {activeNegativeChains.length}
            </td>
          </tr>
          <tr>
            <th scope="row">POS</th>
            <td style={{ color: activePositiveCascades.length > 0 ? '#bfdbfe' : '#d8e4f4' }}>
              {activePositiveCascades.length}
            </td>
          </tr>
          <tr>
            <th scope="row">CUT</th>
            <td>{totalLinksDefeated}</td>
          </tr>
          <tr>
            <th scope="row">START</th>
            <td>{str(latestStarted.chainId ?? latestStarted.chainName, '—')}</td>
          </tr>
          <tr>
            <th scope="row">BROKE</th>
            <td>{str(latestBroken.chainId, '—')}</td>
          </tr>
          <tr>
            <th scope="row">POSITIVE</th>
            <td>{str(latestPositive.cascadeName ?? latestPositive.chainName, '—')}</td>
          </tr>
        </tbody>
      </table>

      <div className="pzo-meta-row">
        <span className="pzo-meta">NEMESIS BREAKS</span>
        <span className="pzo-meta-value" style={{ color: nemesisBrokenEvents.length > 0 ? '#fbbf24' : '#d8e4f4' }}>
          {nemesisBrokenEvents.length}
        </span>
      </div>
    </div>
  );
}

function SovereigntyPanel(): React.JSX.Element {
  const sovereignty = asDict(useSovereigntyEngine());

  const grade = str(sovereignty.grade, '—');
  const color = grade !== '—' ? GRADE_COLORS[grade] ?? '#93a4bd' : '#93a4bd';
  const score = num(sovereignty.sovereigntyScore, 0);
  const integrityStatus = str(sovereignty.integrityStatus, 'UNVERIFIED');
  const pipelineStatus = str(sovereignty.pipelineStatus, 'IDLE');
  const proofHash = str(sovereignty.proofHash, '—');
  const reward = asDict(sovereignty.reward);
  const rewardLabel = str(reward.label ?? reward.rewardType, '—');
  const isVerified = bool(sovereignty.isVerified, integrityStatus === 'VERIFIED');
  const isTampered = bool(sovereignty.isTampered, integrityStatus === 'TAMPERED');
  const isPipelineRunning = bool(sovereignty.isPipelineRunning, pipelineStatus === 'RUNNING');

  const integrityColor = isTampered ? '#dc2626' : isVerified ? '#1de9b6' : '#93a4bd';
  const proofShort = proofHash === '—' ? '—' : proofHash.slice(0, 12);

  return (
    <div className="pzo-sv-wrap">
      <div className="pzo-grade-hex" style={{ color, background: `${color}20` }}>
        {grade}
      </div>

      <div className="pzo-sv-side">
        <div className="pzo-kv">SOVEREIGNTY</div>
        <div className="pzo-kv-value" style={{ color }}>
          {score > 0 ? (score * 100).toFixed(1) : '—'}
        </div>
        <div className="pzo-kv-value" style={{ color: integrityColor }}>
          {integrityStatus}
        </div>
        <div className="pzo-kv-value">PIPE {pipelineStatus}</div>
        <div className="pzo-kv-value">REWARD {rewardLabel}</div>
        <div className="pzo-kv-value">HASH {proofShort}</div>
        {isPipelineRunning && (
          <div className="pzo-pill" style={{ color: '#f59e0b', background: 'rgba(245,158,11,.10)', width: 'fit-content' }}>
            SCORING
          </div>
        )}
      </div>
    </div>
  );
}

function AlertRow(): React.JSX.Element | null {
  const pressure = asDict(usePressureEngine());
  const shield = asDict(useShieldEngine());
  const cascade = asDict(useCascadeEngine());
  const battle = asDict(useBattleEngine());
  const time = asDict(useTimeEngine());

  const criticalPressure = bool(pressure.isCritical, false);
  const breachCascade = bool(shield.isInBreachCascade, false);
  const chainCount = Array.isArray(cascade.activeNegativeChains) ? cascade.activeNegativeChains.length : num(cascade.activeChainCount, 0);
  const activeBots = num(battle.activeBotsCount, 0);
  const timeoutImminent = bool(time.seasonTimeoutImminent, num(time.ticksRemaining ?? time.ticksUntilTimeout, 999) <= 5);

  if (!criticalPressure && !breachCascade && chainCount <= 0 && activeBots <= 0 && !timeoutImminent) {
    return null;
  }

  let message = 'RUN INSTABILITY DETECTED';
  let right = 'STABILIZE';

  if (breachCascade) {
    message = 'BREACH CASCADE ACTIVE — SHIELDS COMPROMISED';
    right = `CASCADE ×${num(shield.cascadeCount, chainCount)}`;
  } else if (criticalPressure) {
    message = 'CRITICAL PRESSURE — SYSTEM SATURATION RISING';
    right = str(pressure.tier, 'CRITICAL');
  } else if (activeBots > 0) {
    message = 'BATTLE CONTACT — HATER BOTS ACTIVE';
    right = `${activeBots} LIVE`;
  } else if (timeoutImminent) {
    message = 'SEASON CLOCK LOW — RUN TIMEOUT IMMINENT';
    right = `${num(time.ticksRemaining ?? time.ticksUntilTimeout, 0)} LEFT`;
  } else if (chainCount > 0) {
    message = 'CASCADE CHAINS LIVE — LINK FAILURE RISK';
    right = `${chainCount} OPEN`;
  }

  return (
    <div className="pzo-alert" role="alert" aria-live="assertive">
      <span>⚠</span>
      <span>{message}</span>
      <span className="pzo-alert__right">{right}</span>
    </div>
  );
}

function BottomStats(): React.JSX.Element {
  const intel = useIntel();
  const time = asDict(useTimeEngine());
  const pressure = asDict(usePressureEngine());
  const tension = asDict(useTensionEngine());
  const shield = asDict(useShieldEngine());
  const battle = asDict(useBattleEngine());
  const cascade = asDict(useCascadeEngine());
  const sovereignty = asDict(useSovereigntyEngine());

  const timeRemaining = clamp01(
    num(time.seasonTickBudget, 0) > 0
      ? num(time.ticksRemaining, 0) / Math.max(1, num(time.seasonTickBudget, 0))
      : 0,
  );

  const items = [
    {
      key: 'ALPHA',
      value: `+${fmtRatio(num(intel.alpha, 0))}`,
      help: 'EDGE',
      bar: clamp01(num(intel.alpha, 0)),
      color: '#4ade80',
    },
    {
      key: 'VOL',
      value: fmtRatio(num(intel.volatility, 0)),
      help: 'MARKET',
      bar: clamp01(num(intel.volatility, 0)),
      color: '#38bdf8',
    },
    {
      key: 'PRESS',
      value: fmtWhole(num(pressure.score, 0) * 100),
      help: str(pressure.tier, '—'),
      bar: clamp01(num(pressure.score, 0)),
      color: TIER_COLORS[str(pressure.tier, 'CALM')] ?? '#93a4bd',
    },
    {
      key: 'TENSION',
      value: fmtWhole(num(tension.score, 0) * 100),
      help: str(tension.visibilityState, '—'),
      bar: clamp01(num(tension.score, 0)),
      color: colorByBand(clamp01(num(tension.score, 0)), { high: '#dc2626', mid: '#f59e0b', low: '#1de9b6' }),
    },
    {
      key: 'SHIELD',
      value: fmtWhole(num(shield.overallPct100, num(shield.overallPct, 0) * 100)),
      help: str(shield.weakestLayerId, 'STABLE'),
      bar: clamp01(num(shield.overallPct, num(shield.overallIntegrityPct, 0))),
      color: '#1de9b6',
    },
    {
      key: 'BATTLE',
      value: fmtWhole(num(battle.activeBotsCount, 0)),
      help: 'ACTIVE',
      bar: clamp01(num(battle.haterHeat, 0)),
      color: '#dc2626',
    },
    {
      key: 'CASCADE',
      value: fmtWhole(num(cascade.totalLinksDefeated, 0)),
      help: 'LINKS CUT',
      bar: clamp01(Math.min(1, num(cascade.totalLinksDefeated, 0) / 10)),
      color: '#a78bfa',
    },
    {
      key: 'TIME',
      value: fmtWhole(timeRemaining * 100),
      help: `${num(time.ticksRemaining, 0)} LEFT`,
      bar: timeRemaining,
      color: '#c9a84c',
    },
    {
      key: 'SV',
      value: sovereignty.grade ? str(sovereignty.grade, '—') : fmtWhole(num(sovereignty.sovereigntyScore, 0) * 100),
      help: str(sovereignty.pipelineStatus, 'IDLE'),
      bar: clamp01(num(sovereignty.sovereigntyScore, 0)),
      color: sovereignty.grade ? GRADE_COLORS[str(sovereignty.grade, 'C')] ?? '#93a4bd' : '#93a4bd',
    },
  ];

  return (
    <div className="pzo-bottom-row" aria-label="Run metrics strip">
      {items.map((item) => (
        <div className="pzo-stat" key={item.key}>
          <span className="pzo-stat-key">{item.key}</span>
          <span className="pzo-stat-val" style={{ color: item.color }}>
            {item.value}
          </span>
          <span className="pzo-stat-help">{item.help}</span>
          <div className="pzo-stat-track">
            <div className="pzo-stat-fill" style={{ width: pct(item.bar), background: item.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function GameHUD({ isActiveRun = true, showIntel = true }: GameHUDProps) {
  const tension = asDict(useTensionEngine());
  const shield = asDict(useShieldEngine());

  useEffect(() => {
    injectStyles();
  }, []);

  if (!isActiveRun) return null;

  const threatUrgency = str(
    tension.threatUrgency,
    num(tension.score, 0) >= 0.75 ? 'URGENT' : num(tension.score, 0) >= 0.4 ? 'BUILDING' : 'STABLE',
  );

  const pressurePanelClass = [
    'pzo-panel',
    threatUrgency === 'URGENT' ? 'pzo-panel--critical' : '',
    threatUrgency === 'BUILDING' ? 'pzo-panel--warning' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const shieldPanelClass = [
    'pzo-panel',
    bool(shield.isFortified, false) ? 'pzo-panel--fortified' : '',
    bool(shield.isInBreachCascade, false) ? 'pzo-panel--critical' : '',
    bool(shield.isAnyLow, false) && !bool(shield.isInBreachCascade, false) ? 'pzo-panel--warning' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="pzo-hud-root" data-pzo-surface="game-hud">
      <div className="pzo-hud-shell">
        <TopStrip />

        <div className="pzo-col">
          <div className={pressurePanelClass}>
            <div className="pzo-section-label">Pressure</div>
            <PressureArc />
          </div>

          <div className="pzo-panel">
            <div className="pzo-section-label">Battle Engine</div>
            <BattlePanel />
          </div>
        </div>

        <div className="pzo-center-stack">
          {showIntel && (
            <div className="pzo-panel">
              <div className="pzo-section-label">ML Intel</div>
              <IntelBars />
            </div>
          )}

          <div className="pzo-panel">
            <div className="pzo-section-label">Tension Queue</div>
            <TensionPanel />
          </div>

          <div className="pzo-panel">
            <div className="pzo-section-label">Cascade Engine</div>
            <CascadePanel />
          </div>
        </div>

        <div className="pzo-col">
          <div className={shieldPanelClass}>
            <div className="pzo-section-label">Shield Engine</div>
            <ShieldPanel />
          </div>

          <div className="pzo-panel">
            <div className="pzo-section-label">Sovereignty</div>
            <SovereigntyPanel />
          </div>
        </div>

        <AlertRow />
        <BottomStats />
      </div>

      <PressureSignalTooltip />
    </div>
  );
}
