// FILE: pzo-web/src/features/run/components/GameHUD.tsx
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

/**
 * FILE: GameHUD.tsx
 * POINT ZERO ONE — SOVEREIGN COMMAND INTERFACE
 *
 * Production HUD for active run state.
 * Single-pass model derivation; panel rendering is fed from normalized view-state.
 */

type Dict = Record<string, unknown>;

type IntelBar = {
  id: string;
  label: string;
  value: number;
  color: string;
  warn?: boolean;
};

type ShieldLayerView = {
  id: string;
  label: string;
  integrityPct: number;
  breached: boolean;
  critical: boolean;
  low: boolean;
};

type HUDModel = {
  topStrip: Array<{
    label: string;
    value: string;
    sub: string;
    color: string;
  }>;
  timeRemaining: number;
  timeTier: string;
  phaseTicks: string;
  ticksRemaining: number;
  holdsRemaining: number;
  decisionWindows: number;
  timeoutDanger: boolean;

  pressureScore: number;
  pressureTier: string;
  pressureSignals: string[];
  pressureEscalating: boolean;
  pressureDecaying: boolean;
  criticalPressure: boolean;
  pressureTicksToCalm: number;
  pressureStagnation: number;
  pressurePostActionScore: number;

  tensionScore: number;
  tensionUrgency: string;
  tensionQueueLength: number;
  tensionArrived: number;
  tensionQueued: number;
  tensionExpired: number;
  tensionPulseTicksActive: number;
  tensionPulseActive: boolean;
  tensionVisibilityState: string;

  shieldOverallPct: number;
  shieldOverallPct100: number;
  shieldWeakestLayerId: string;
  shieldFortified: boolean;
  shieldBreachCascade: boolean;
  shieldAnyLow: boolean;
  shieldCascadeCount: number;
  shieldLayers: ShieldLayerView[];

  battleActors: number;
  battleScore: number;
  battleInjectedCards: number;
  battleAttackBot: string;
  battleAttackType: string;
  battleTargetLayer: string;
  battleTransition: string;

  cascadeNegativeCount: number;
  cascadePositiveCount: number;
  cascadeLinksCut: number;
  cascadeLatestStarted: string;
  cascadeLatestBroken: string;
  cascadeLatestPositive: string;
  cascadeNemesisBreaks: number;
  cascadeScore: number;

  sovereigntyGrade: string;
  sovereigntyScore: number;
  sovereigntyIntegrityStatus: string;
  sovereigntyPipelineStatus: string;
  sovereigntyProofHash: string;
  sovereigntyProofHashShort: string;
  sovereigntyRewardLabel: string;
  sovereigntyVerified: boolean;
  sovereigntyTampered: boolean;
  sovereigntyPipelineRunning: boolean;

  intelBars: IntelBar[];
  intelMomentum: number;

  alertMessage: string | null;
  alertRight: string | null;

  bottomStats: Array<{
    key: string;
    value: string;
    help: string;
    bar: number;
    color: string;
  }>;
};

export interface GameHUDProps {
  readonly isActiveRun?: boolean;
  readonly showIntel?: boolean;
  readonly className?: string;
}

const STYLE_ID = 'pzo-game-hud-styles-v3';

const HUD_STYLES = `
  .pzo-hud-root{
    --hud-bg:#07090d;
    --hud-panel:rgba(12,15,20,0.96);
    --hud-panel-hi:rgba(18,22,30,0.98);
    --hud-panel-soft:rgba(14,18,24,0.88);
    --hud-border:#18202d;
    --hud-border-hi:#243041;
    --hud-amber:#c9a84c;
    --hud-amber-soft:rgba(201,168,76,0.14);
    --hud-amber-glow:rgba(201,168,76,0.24);
    --hud-teal:#1de9b6;
    --hud-blue:#4ea5ff;
    --hud-purple:#a78bfa;
    --hud-orange:#f59e0b;
    --hud-crimson:#dc2626;
    --hud-crimson-soft:rgba(220,38,38,0.16);
    --hud-green:#4ade80;
    --hud-text:#93a4bd;
    --hud-text-hi:#d8e4f4;
    --hud-text-dim:#536176;
    --hud-shadow:0 18px 48px rgba(0,0,0,0.38);
    --font-ui:var(--font-ui, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
    --font-mono:var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace);

    position:relative;
    isolation:isolate;
    color:var(--hud-text-hi);
    font-family:var(--font-ui);
    user-select:none;
  }

  .pzo-hud-root *{ box-sizing:border-box; }

  .pzo-hud-shell{
    display:grid;
    grid-template-columns:190px minmax(0,1fr) 210px;
    gap:8px;
    padding:8px;
    border:1px solid var(--hud-border-hi);
    background:
      radial-gradient(circle at top left, rgba(201,168,76,0.07), transparent 32%),
      radial-gradient(circle at bottom right, rgba(78,165,255,0.05), transparent 28%),
      linear-gradient(180deg, rgba(255,255,255,0.015), rgba(255,255,255,0)),
      var(--hud-bg);
    box-shadow:var(--hud-shadow);
    overflow:hidden;
    position:relative;
  }

  .pzo-hud-shell::before{
    content:'';
    position:absolute;
    inset:0;
    background:repeating-linear-gradient(
      180deg,
      transparent 0,
      transparent 2px,
      rgba(255,255,255,0.012) 2px,
      rgba(255,255,255,0.012) 4px
    );
    pointer-events:none;
    mix-blend-mode:screen;
    z-index:0;
  }

  .pzo-col,
  .pzo-center-stack{
    position:relative;
    z-index:1;
    display:flex;
    flex-direction:column;
    gap:8px;
    min-width:0;
  }

  .pzo-panel{
    position:relative;
    min-width:0;
    overflow:hidden;
    padding:10px;
    border-radius:6px;
    border:1px solid var(--hud-border);
    background:linear-gradient(180deg, var(--hud-panel-hi), var(--hud-panel));
    clip-path:polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
  }

  .pzo-panel::after{
    content:'';
    position:absolute;
    inset:0;
    border:1px solid rgba(255,255,255,0.02);
    pointer-events:none;
    clip-path:inherit;
  }

  .pzo-panel--warning{
    border-color:rgba(245,158,11,0.42);
    box-shadow:inset 0 0 22px rgba(245,158,11,0.08), 0 0 0 1px rgba(245,158,11,0.08);
  }

  .pzo-panel--critical{
    border-color:rgba(220,38,38,0.56);
    box-shadow:inset 0 0 28px rgba(220,38,38,0.12), 0 0 16px rgba(220,38,38,0.18);
    animation:pzoCritPulse 1s ease-in-out infinite alternate;
  }

  .pzo-panel--fortified{
    border-color:rgba(29,233,182,0.42);
    box-shadow:inset 0 0 26px rgba(29,233,182,0.08), 0 0 0 1px rgba(29,233,182,0.06);
  }

  .pzo-section-label{
    display:flex;
    align-items:center;
    gap:8px;
    margin-bottom:8px;
    color:var(--hud-amber);
    font-family:var(--font-mono);
    font-size:10px;
    letter-spacing:.18em;
    line-height:1;
    text-transform:uppercase;
    white-space:nowrap;
  }

  .pzo-section-label::after{
    content:'';
    flex:1;
    height:1px;
    background:linear-gradient(90deg, rgba(201,168,76,0.35), transparent);
  }

  .pzo-top-strip{
    grid-column:1 / -1;
    position:relative;
    z-index:1;
    display:grid;
    grid-template-columns:repeat(6, minmax(0,1fr));
    gap:6px;
  }

  .pzo-chip{
    display:flex;
    flex-direction:column;
    gap:3px;
    min-width:0;
    padding:8px 10px;
    border-radius:5px;
    border:1px solid var(--hud-border);
    background:linear-gradient(180deg, rgba(14,18,24,0.95), rgba(10,13,18,0.95));
  }

  .pzo-chip__label,
  .pzo-chip__sub,
  .pzo-bar-label,
  .pzo-bar-value,
  .pzo-meta,
  .pzo-meta-value,
  .pzo-shield-id,
  .pzo-shield-pct,
  .pzo-mini-table th,
  .pzo-mini-table td,
  .pzo-queue-caption,
  .pzo-kv,
  .pzo-kv-value,
  .pzo-stat-key,
  .pzo-stat-help,
  .pzo-pill,
  .pzo-pressure-tier,
  .pzo-pressure-sub{
    font-family:var(--font-mono);
  }

  .pzo-chip__label{
    color:var(--hud-text-dim);
    font-size:8px;
    letter-spacing:.14em;
    text-transform:uppercase;
    overflow:hidden;
    text-overflow:ellipsis;
  }

  .pzo-chip__value{
    color:var(--hud-text-hi);
    font-family:var(--font-mono);
    font-size:15px;
    font-weight:700;
    line-height:1;
    overflow:hidden;
    text-overflow:ellipsis;
  }

  .pzo-chip__sub{
    color:var(--hud-text);
    font-size:9px;
    letter-spacing:.08em;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }

  .pzo-pressure-wrap{
    display:flex;
    flex-direction:column;
    align-items:center;
    gap:4px;
  }

  .pzo-pressure-tier{
    font-size:11px;
    letter-spacing:.16em;
    text-align:center;
  }

  .pzo-pressure-sub{
    color:var(--hud-text);
    font-size:9px;
    text-align:center;
  }

  .pzo-pills{
    display:flex;
    align-items:center;
    justify-content:center;
    gap:6px;
    flex-wrap:wrap;
  }

  .pzo-pill{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    min-height:20px;
    padding:2px 6px;
    border-radius:999px;
    border:1px solid currentColor;
    font-size:9px;
    letter-spacing:.13em;
    text-transform:uppercase;
    white-space:nowrap;
  }

  .pzo-intel-bars{
    display:flex;
    flex-direction:column;
    gap:6px;
  }

  .pzo-bar-row{
    display:grid;
    grid-template-columns:60px minmax(0,1fr) 36px;
    gap:6px;
    align-items:center;
  }

  .pzo-bar-label{
    color:var(--hud-text);
    font-size:9px;
    letter-spacing:.11em;
  }

  .pzo-bar-value{
    text-align:right;
    color:var(--hud-text-hi);
    font-size:9px;
  }

  .pzo-bar-track,
  .pzo-stat-track{
    position:relative;
    overflow:hidden;
    background:#0f151d;
    border:1px solid var(--hud-border);
  }

  .pzo-bar-track{
    height:7px;
    border-radius:2px;
  }

  .pzo-bar-fill,
  .pzo-stat-fill{
    position:absolute;
    inset:0 auto 0 0;
    height:100%;
    transition:width 180ms ease-out;
  }

  .pzo-bar-fill::after{
    content:'';
    position:absolute;
    top:0;
    right:0;
    width:2px;
    height:100%;
    background:rgba(255,255,255,0.72);
  }

  .pzo-meta-row{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:8px;
    padding-top:6px;
    margin-top:4px;
    border-top:1px solid var(--hud-border);
  }

  .pzo-meta{
    color:var(--hud-text);
    font-size:9px;
    letter-spacing:.10em;
  }

  .pzo-meta-value{
    color:var(--hud-text-hi);
    font-size:14px;
    font-weight:700;
    letter-spacing:.04em;
  }

  .pzo-shield-layers,
  .pzo-battle-stack,
  .pzo-cascade-stack{
    display:flex;
    flex-direction:column;
    gap:6px;
  }

  .pzo-shield-row{
    display:grid;
    grid-template-columns:24px minmax(0,1fr) 38px;
    gap:6px;
    align-items:center;
  }

  .pzo-shield-id{
    color:var(--hud-text-dim);
    font-size:9px;
    letter-spacing:.10em;
  }

  .pzo-shield-segments{
    display:flex;
    gap:2px;
    height:8px;
  }

  .pzo-shield-segment{
    flex:1;
    border-radius:2px;
    background:#10161f;
    transition:background 160ms ease-out, box-shadow 160ms ease-out;
  }

  .pzo-shield-pct{
    text-align:right;
    font-size:9px;
  }

  .pzo-tension-panel{
    display:flex;
    flex-direction:column;
    gap:6px;
    min-height:148px;
  }

  .pzo-tension-score{
    font-family:var(--font-mono);
    font-size:22px;
    font-weight:700;
    line-height:1;
    text-align:center;
  }

  .pzo-threat-badge{
    padding:3px 6px;
    border-radius:4px;
    text-align:center;
    font-family:var(--font-mono);
    font-size:9px;
    letter-spacing:.16em;
    text-transform:uppercase;
  }

  .pzo-queue-grid{
    display:grid;
    grid-template-columns:repeat(12, minmax(0,1fr));
    gap:4px;
  }

  .pzo-queue-pip{
    height:9px;
    border-radius:2px;
    background:#10161f;
    transition:background 160ms ease-out, box-shadow 160ms ease-out, transform 160ms ease-out;
  }

  .pzo-queue-caption{
    display:flex;
    justify-content:space-between;
    gap:8px;
    color:var(--hud-text);
    font-size:9px;
    letter-spacing:.08em;
  }

  .pzo-sv-wrap{
    display:grid;
    grid-template-columns:72px minmax(0,1fr);
    gap:8px;
    align-items:center;
  }

  .pzo-grade-hex{
    width:64px;
    height:64px;
    display:flex;
    align-items:center;
    justify-content:center;
    clip-path:polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%);
    font-family:var(--font-mono);
    font-size:26px;
    font-weight:700;
  }

  .pzo-sv-side{
    min-width:0;
    display:flex;
    flex-direction:column;
    gap:4px;
  }

  .pzo-kv{
    color:var(--hud-text-dim);
    font-size:9px;
    letter-spacing:.14em;
    text-transform:uppercase;
  }

  .pzo-kv-value{
    color:var(--hud-text-hi);
    font-size:12px;
    letter-spacing:.08em;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }

  .pzo-mini-table{
    width:100%;
    border-collapse:collapse;
  }

  .pzo-mini-table th,
  .pzo-mini-table td{
    padding:4px 0;
    text-align:left;
    border-bottom:1px solid rgba(255,255,255,0.04);
    color:var(--hud-text);
    font-size:9px;
  }

  .pzo-mini-table th{
    color:var(--hud-text-dim);
    letter-spacing:.12em;
    font-weight:400;
    text-transform:uppercase;
  }

  .pzo-alert{
    grid-column:1 / -1;
    display:flex;
    align-items:center;
    gap:10px;
    min-height:38px;
    padding:8px 12px;
    border-radius:5px;
    border:1px solid rgba(220,38,38,0.46);
    background:linear-gradient(90deg, rgba(220,38,38,0.14), rgba(220,38,38,0.05));
    color:#fecaca;
    font-family:var(--font-mono);
    letter-spacing:.12em;
    text-transform:uppercase;
    animation:pzoCritPulse .9s ease-in-out infinite alternate;
  }

  .pzo-alert__right{
    margin-left:auto;
  }

  .pzo-bottom-row{
    grid-column:1 / -1;
    display:grid;
    grid-template-columns:repeat(9, minmax(0,1fr));
    gap:6px;
  }

  .pzo-stat{
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    gap:3px;
    min-width:0;
    min-height:58px;
    padding:8px;
    border:1px solid var(--hud-border);
    border-radius:5px;
    background:linear-gradient(180deg, rgba(14,18,24,0.95), rgba(10,13,18,0.95));
  }

  .pzo-stat-key{
    color:var(--hud-text-dim);
    font-size:9px;
    letter-spacing:.14em;
    text-transform:uppercase;
  }

  .pzo-stat-val{
    font-family:var(--font-mono);
    font-size:16px;
    font-weight:700;
    line-height:1;
  }

  .pzo-stat-help{
    color:var(--hud-text);
    font-size:9px;
    letter-spacing:.08em;
    text-align:center;
  }

  .pzo-stat-track{
    width:100%;
    height:3px;
    border-radius:999px;
  }

  @keyframes pzoCritPulse{
    from{ opacity:.72; }
    to{ opacity:1; }
  }

  @media (max-width: 1180px){
    .pzo-hud-shell{
      grid-template-columns:minmax(0,1fr);
    }

    .pzo-top-strip{
      grid-template-columns:repeat(3, minmax(0,1fr));
    }

    .pzo-bottom-row{
      grid-template-columns:repeat(4, minmax(0,1fr));
    }
  }

  @media (max-width: 760px){
    .pzo-top-strip{
      grid-template-columns:repeat(2, minmax(0,1fr));
    }

    .pzo-bottom-row{
      grid-template-columns:repeat(2, minmax(0,1fr));
    }

    .pzo-sv-wrap{
      grid-template-columns:1fr;
      justify-items:center;
    }
  }

  @media (prefers-reduced-motion: reduce){
    .pzo-panel--critical,
    .pzo-alert{
      animation:none !important;
    }

    .pzo-bar-fill,
    .pzo-stat-fill,
    .pzo-shield-segment,
    .pzo-queue-pip{
      transition:none !important;
    }
  }
`;

const TIER_COLORS: Record<string, string> = {
  CALM: '#4ade80',
  STEADY: '#4ade80',
  BUILDING: '#c9a84c',
  ELEVATED: '#f97316',
  HIGH: '#ef4444',
  CRITICAL: '#ff0000',
  URGENT: '#dc2626',
};

const GRADE_COLORS: Record<string, string> = {
  S: '#fbbf24',
  A: '#4ade80',
  B: '#c9a84c',
  C: '#38bdf8',
  D: '#f97316',
  F: '#dc2626',
};

function injectStylesOnce(id: string, css: string): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(id)) return;

  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
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

function normalizePercentLike(value: number): number {
  return Math.abs(value) > 1 ? clamp01(value / 100) : clamp01(value);
}

function pct(value: number): string {
  return `${Math.round(clamp01(value) * 100)}%`;
}

function fmtWhole(value: number): string {
  return Math.round(value).toString();
}

function fmtSignedOne(value: number): string {
  const normalized = Math.abs(value) > 1 ? value : value * 100;
  return `${normalized >= 0 ? '+' : ''}${normalized.toFixed(1)}`;
}

function normalizeByCap(value: number, cap: number): number {
  return clamp01(cap <= 0 ? 0 : value / cap);
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

  if (map[id]) return map[id];
  return id.slice(0, 3).toUpperCase();
}

function colorForPressure(score: number): string {
  if (score >= 0.8) return 'var(--hud-crimson)';
  if (score >= 0.55) return 'var(--hud-orange)';
  return 'var(--hud-amber)';
}

function colorForShield(score: number): string {
  if (score <= 0.25) return 'var(--hud-crimson)';
  if (score <= 0.55) return 'var(--hud-orange)';
  return 'var(--hud-teal)';
}

function colorForTension(score: number): string {
  if (score >= 0.75) return 'var(--hud-crimson)';
  if (score >= 0.4) return 'var(--hud-orange)';
  return 'var(--hud-teal)';
}

function colorForSovereignty(grade: string): string {
  if (grade === 'S' || grade === 'A') return 'var(--hud-amber)';
  if (grade === 'B') return 'var(--hud-green)';
  if (grade === 'C') return 'var(--hud-blue)';
  if (grade === 'D') return 'var(--hud-orange)';
  if (grade === 'F') return 'var(--hud-crimson)';
  return 'var(--hud-text)';
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleRad),
    y: centerY + radius * Math.sin(angleRad),
  };
}

function describeArc(
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return ['M', start.x, start.y, 'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(
    ' ',
  );
}

function buildHudModel(args: {
  time: Dict;
  pressure: Dict;
  tension: Dict;
  shield: Dict;
  battle: Dict;
  cascade: Dict;
  sovereignty: Dict;
  intel: Dict;
}): HUDModel {
  const { time, pressure, tension, shield, battle, cascade, sovereignty, intel } = args;

  const seasonBudget = Math.max(
    1,
    num(time.seasonTickBudget, num(time.totalTicks, 100)),
  );
  const ticksRemaining = num(time.ticksRemaining, num(time.ticksUntilTimeout, 0));
  const ticksElapsed = num(time.ticksElapsed, num(time.tick, 0));
  const timeRemaining = clamp01(
    normalizePercentLike(
      num(time.remainingPct, 0) ||
        (ticksRemaining > 0 ? (ticksRemaining / seasonBudget) * 100 : 0),
    ),
  );
  const timeTier = str(time.currentTier, str(time.tickTier, 'TIER'));
  const holdsRemaining = num(time.holdsRemaining, 0);
  const decisionWindows = Array.isArray(time.activeDecisionWindows)
    ? time.activeDecisionWindows.length
    : num(time.decisionWindowCount, 0);
  const timeoutDanger = bool(time.seasonTimeoutImminent, ticksRemaining <= 5);

  const pressureScore = clamp01(
    normalizePercentLike(num(pressure.score, num(pressure.intensity, 0))),
  );
  const pressureTier = str(
    pressure.tier,
    pressureScore >= 0.8 ? 'CRITICAL' : pressureScore >= 0.55 ? 'BUILDING' : 'CALM',
  );
  const pressureSignals = Array.isArray(pressure.triggerSignals)
    ? pressure.triggerSignals
        .filter((value): value is string => typeof value === 'string')
        .slice(0, 3)
    : [];
  const pressureEscalating = bool(pressure.isEscalating, false);
  const pressureDecaying = bool(pressure.isDecaying, false);
  const criticalPressure = bool(pressure.isCritical, pressureScore >= 0.8);
  const pressureTicksToCalm = num(pressure.ticksToCalm, num(pressure.ticksUntilCalm, 0));
  const pressureStagnation = num(pressure.stagnationCount, 0);
  const pressurePostActionScore = clamp01(
    normalizePercentLike(num(pressure.postActionScore, pressureScore)),
  );

  const tensionScore = clamp01(
    normalizePercentLike(num(tension.score, num(tension.intensity, 0))),
  );
  const tensionQueueLength = num(tension.queueLength, 0);
  const tensionArrived = num(tension.arrivedCount, 0);
  const tensionQueued = num(tension.queuedCount, 0);
  const tensionExpired = num(tension.expiredCount, 0);
  const tensionPulseTicksActive = num(tension.pulseTicksActive, 0);
  const tensionPulseActive = bool(tension.isPulseActive, false);
  const tensionVisibilityState = str(tension.visibilityState, 'SHADOWED');
  const tensionUrgency = str(
    tension.threatUrgency,
    tensionScore >= 0.75 ? 'URGENT' : tensionScore >= 0.4 ? 'BUILDING' : 'STEADY',
  );

  const shieldLayersRaw = asDict(shield.layers);
  const shieldLayers: ShieldLayerView[] = Object.entries(shieldLayersRaw).map(([id, rawLayer]) => {
    const layer = asDict(rawLayer);
    const integrityPct = clamp01(
      normalizePercentLike(num(layer.integrityPct, num(layer.integrity, 1))),
    );
    const breached = bool(layer.isBreached, bool(layer.breached, false));
    const critical = bool(layer.isCriticalWarning, breached || integrityPct <= 0.2);
    const low = bool(layer.isLowWarning, integrityPct <= 0.45);

    return {
      id,
      label: shieldLabel(id),
      integrityPct,
      breached,
      critical,
      low,
    };
  });

  const shieldOverallPct = clamp01(
    normalizePercentLike(
      num(shield.overallPct, num(shield.overallIntegrityPct, 0)),
    ),
  );
  const shieldOverallPct100 = Math.round(
    num(shield.overallPct100, shieldOverallPct * 100),
  );
  const shieldWeakestLayerId = str(shield.weakestLayerId, 'ALL');
  const shieldFortified = bool(shield.isFortified, false);
  const shieldBreachCascade = bool(shield.isInBreachCascade, false);
  const shieldAnyLow = bool(shield.isAnyLow, shieldOverallPct <= 0.35);
  const shieldCascadeCount = num(shield.cascadeCount, 0);

  const battleActors = num(battle.activeBotsCount, 0);
  const battleScore = clamp01(
    Math.max(
      normalizePercentLike(num(battle.haterHeat, num(battle.intensity, 0))),
      normalizeByCap(battleActors, 6),
    ),
  );
  const battleInjectedCards = Array.isArray(battle.injectedCards) ? battle.injectedCards.length : 0;
  const battleLastAttack = asDict(battle.lastAttackFired);
  const battleLastStateChange = asDict(battle.lastStateChange);
  const battleAttackBot = str(battleLastAttack.botId, '—');
  const battleAttackType = str(
    battleLastAttack.attackType,
    battleActors > 0 ? 'LIVE' : 'QUIET',
  );
  const battleTargetLayer = str(battleLastAttack.targetLayer, '—');
  const battleTransition = `${str(battleLastStateChange.from, '—')}→${str(
    battleLastStateChange.to,
    '—',
  )}`;

  const cascadeNegativeCount = Array.isArray(cascade.activeNegativeChains)
    ? cascade.activeNegativeChains.length
    : num(cascade.activeChainCount, 0);
  const cascadePositiveCount = Array.isArray(cascade.activePositiveCascades)
    ? cascade.activePositiveCascades.length
    : num(cascade.positiveCascadeCount, 0);
  const cascadeLinksCut = num(cascade.totalLinksDefeated, 0);
  const cascadeLatestStarted = str(
    asDict(cascade.latestChainStarted).chainId,
    str(asDict(cascade.latestChainStarted).chainName, '—'),
  );
  const cascadeLatestBroken = str(asDict(cascade.latestChainBroken).chainId, '—');
  const cascadeLatestPositive = str(
    asDict(cascade.latestPositiveActivated).cascadeName,
    str(asDict(cascade.latestPositiveActivated).chainName, '—'),
  );
  const cascadeNemesisBreaks = Array.isArray(cascade.nemesisBrokenEvents)
    ? cascade.nemesisBrokenEvents.length
    : 0;
  const cascadeScore = clamp01(
    Math.max(
      normalizeByCap(cascadeNegativeCount + cascadePositiveCount, 8),
      normalizeByCap(cascadeLinksCut, 12),
    ),
  );

  const sovereigntyGrade = str(sovereignty.grade, '—');
  const sovereigntyScore = clamp01(
    normalizePercentLike(num(sovereignty.sovereigntyScore, num(sovereignty.score, 0))),
  );
  const sovereigntyIntegrityStatus = str(sovereignty.integrityStatus, 'UNVERIFIED');
  const sovereigntyPipelineStatus = str(sovereignty.pipelineStatus, 'IDLE');
  const sovereigntyProofHash = str(sovereignty.proofHash, '—');
  const sovereigntyProofHashShort =
    sovereigntyProofHash === '—' ? '—' : sovereigntyProofHash.slice(0, 12);
  const sovereigntyReward = asDict(sovereignty.reward);
  const sovereigntyRewardLabel = str(
    sovereigntyReward.label,
    str(sovereigntyReward.rewardType, '—'),
  );
  const sovereigntyVerified = bool(
    sovereignty.isVerified,
    sovereigntyIntegrityStatus === 'VERIFIED',
  );
  const sovereigntyTampered = bool(
    sovereignty.isTampered,
    sovereigntyIntegrityStatus === 'TAMPERED',
  );
  const sovereigntyPipelineRunning = bool(
    sovereignty.isPipelineRunning,
    sovereigntyPipelineStatus === 'RUNNING',
  );

  const intelBars: IntelBar[] = [
    {
      id: 'alpha',
      label: 'ALPHA',
      value: clamp01(num(intel.alpha, 0)),
      color: '#4ade80',
    },
    {
      id: 'risk',
      label: 'RISK',
      value: clamp01(num(intel.risk, 0)),
      color: '#dc2626',
      warn: num(intel.risk, 0) > 0.7,
    },
    {
      id: 'vol',
      label: 'VOL',
      value: clamp01(num(intel.volatility, 0)),
      color: '#38bdf8',
    },
    {
      id: 'tilt',
      label: 'TILT',
      value: clamp01(num(intel.tiltRisk, 0)),
      color: '#f59e0b',
      warn: num(intel.tiltRisk, 0) > 0.5,
    },
    {
      id: 'runway',
      label: 'RUNWAY',
      value: clamp01(1 - num(intel.bankruptcyRisk60, 0)),
      color: '#a78bfa',
      warn: num(intel.bankruptcyRisk60, 0) > 0.6,
    },
  ];

  const intelMomentum = num(intel.momentum, 0);

  let alertMessage: string | null = null;
  let alertRight: string | null = null;

  if (shieldBreachCascade) {
    alertMessage = 'BREACH CASCADE ACTIVE — SHIELDS COMPROMISED';
    alertRight = `CASCADE ×${shieldCascadeCount || cascadeNegativeCount}`;
  } else if (criticalPressure) {
    alertMessage = 'CRITICAL PRESSURE — SYSTEM SATURATION RISING';
    alertRight = pressureTier;
  } else if (battleActors > 0) {
    alertMessage = 'BATTLE CONTACT — HATER BOTS ACTIVE';
    alertRight = `${battleActors} LIVE`;
  } else if (timeoutDanger) {
    alertMessage = 'SEASON CLOCK LOW — RUN TIMEOUT IMMINENT';
    alertRight = `${ticksRemaining} LEFT`;
  } else if (cascadeNegativeCount > 0) {
    alertMessage = 'CASCADE CHAINS LIVE — LINK FAILURE RISK';
    alertRight = `${cascadeNegativeCount} OPEN`;
  }

  const topStrip = [
    {
      label: 'CLOCK',
      value: `T${fmtWhole(ticksElapsed)}`,
      sub: `${ticksRemaining} LEFT · ${timeTier}`,
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
      value: `${battleActors} BOT${battleActors === 1 ? '' : 'S'}`,
      sub: `HEAT ${fmtWhole(battleScore * 100)} · ${battleAttackType}`,
      color: battleActors > 0 ? '#dc2626' : '#4ade80',
    },
    {
      label: 'CASCADE',
      value: `${cascadeNegativeCount}/${cascadePositiveCount}`,
      sub: `${cascadeLinksCut} LINKS CUT`,
      color: cascadeNegativeCount > 0 ? '#a78bfa' : '#38bdf8',
    },
    {
      label: 'PROOF',
      value: sovereigntyPipelineStatus,
      sub: `${sovereigntyIntegrityStatus} · ${sovereigntyProofHashShort}`,
      color:
        sovereigntyPipelineStatus === 'FAILED'
          ? '#dc2626'
          : sovereigntyPipelineStatus === 'COMPLETE'
            ? '#4ade80'
            : '#c9a84c',
    },
  ];

  const bottomStats = [
    {
      key: 'ALPHA',
      value: fmtSignedOne(num(intel.alpha, 0)),
      help: 'EDGE',
      bar: clamp01(num(intel.alpha, 0)),
      color: '#4ade80',
    },
    {
      key: 'VOL',
      value: fmtWhole(num(intel.volatility, 0) * 100),
      help: 'MARKET',
      bar: clamp01(num(intel.volatility, 0)),
      color: '#38bdf8',
    },
    {
      key: 'PRESS',
      value: fmtWhole(pressureScore * 100),
      help: pressureTier,
      bar: pressureScore,
      color: TIER_COLORS[pressureTier] ?? '#93a4bd',
    },
    {
      key: 'TENSION',
      value: fmtWhole(tensionScore * 100),
      help: tensionVisibilityState,
      bar: tensionScore,
      color: colorForTension(tensionScore),
    },
    {
      key: 'SHIELD',
      value: fmtWhole(shieldOverallPct100),
      help: shieldWeakestLayerId,
      bar: shieldOverallPct,
      color: colorForShield(shieldOverallPct),
    },
    {
      key: 'BATTLE',
      value: fmtWhole(battleActors),
      help: 'ACTIVE',
      bar: battleScore,
      color: '#dc2626',
    },
    {
      key: 'CASCADE',
      value: fmtWhole(cascadeLinksCut),
      help: 'LINKS CUT',
      bar: cascadeScore,
      color: '#a78bfa',
    },
    {
      key: 'TIME',
      value: fmtWhole(timeRemaining * 100),
      help: `${ticksRemaining} LEFT`,
      bar: timeRemaining,
      color: '#c9a84c',
    },
    {
      key: 'SV',
      value: sovereigntyGrade !== '—' ? sovereigntyGrade : fmtWhole(sovereigntyScore * 100),
      help: sovereigntyPipelineStatus,
      bar: sovereigntyScore,
      color: GRADE_COLORS[sovereigntyGrade] ?? '#93a4bd',
    },
  ];

  return {
    topStrip,
    timeRemaining,
    timeTier,
    phaseTicks: `${fmtWhole(ticksElapsed)}/${fmtWhole(seasonBudget)}`,
    ticksRemaining,
    holdsRemaining,
    decisionWindows,
    timeoutDanger,

    pressureScore,
    pressureTier,
    pressureSignals,
    pressureEscalating,
    pressureDecaying,
    criticalPressure,
    pressureTicksToCalm,
    pressureStagnation,
    pressurePostActionScore,

    tensionScore,
    tensionUrgency,
    tensionQueueLength,
    tensionArrived,
    tensionQueued,
    tensionExpired,
    tensionPulseTicksActive,
    tensionPulseActive,
    tensionVisibilityState,

    shieldOverallPct,
    shieldOverallPct100,
    shieldWeakestLayerId,
    shieldFortified,
    shieldBreachCascade,
    shieldAnyLow,
    shieldCascadeCount,
    shieldLayers,

    battleActors,
    battleScore,
    battleInjectedCards,
    battleAttackBot,
    battleAttackType,
    battleTargetLayer,
    battleTransition,

    cascadeNegativeCount,
    cascadePositiveCount,
    cascadeLinksCut,
    cascadeLatestStarted,
    cascadeLatestBroken,
    cascadeLatestPositive,
    cascadeNemesisBreaks,
    cascadeScore,

    sovereigntyGrade,
    sovereigntyScore,
    sovereigntyIntegrityStatus,
    sovereigntyPipelineStatus,
    sovereigntyProofHash,
    sovereigntyProofHashShort,
    sovereigntyRewardLabel,
    sovereigntyVerified,
    sovereigntyTampered,
    sovereigntyPipelineRunning,

    intelBars,
    intelMomentum,

    alertMessage,
    alertRight,

    bottomStats,
  };
}

function TopStrip({ items }: { items: HUDModel['topStrip'] }) {
  return (
    <div className="pzo-top-strip" aria-label="Run status strip">
      {items.map((item) => (
        <div className="pzo-chip" key={item.label}>
          <span className="pzo-chip__label">{item.label}</span>
          <span className="pzo-chip__value" style={{ color: item.color }}>
            {item.value}
          </span>
          <span className="pzo-chip__sub">{item.sub}</span>
        </div>
      ))}
    </div>
  );
}

function PressureArcCard({
  score,
  tier,
  signals,
  escalating,
  decaying,
  critical,
  ticksToCalm,
  postActionScore,
  stagnationCount,
}: {
  score: number;
  tier: string;
  signals: string[];
  escalating: boolean;
  decaying: boolean;
  critical: boolean;
  ticksToCalm: number;
  postActionScore: number;
  stagnationCount: number;
}) {
  const radius = 52;
  const startAngle = 14;
  const endAngle = 346;
  const activeEndAngle = startAngle + (endAngle - startAngle) * clamp01(score);
  const color = TIER_COLORS[tier] ?? colorForPressure(score);

  return (
    <div className="pzo-pressure-wrap">
      <svg width="136" height="136" viewBox="0 0 136 136" aria-label="Pressure gauge">
        <path
          d={describeArc(68, 68, radius, startAngle, endAngle)}
          fill="none"
          stroke="#10161f"
          strokeWidth="10"
        />
        <path
          d={describeArc(68, 68, radius, startAngle, activeEndAngle)}
          fill="none"
          stroke={color}
          strokeWidth="10"
          style={{
            filter: critical
              ? `drop-shadow(0 0 8px ${color}) drop-shadow(0 0 2px #fff)`
              : `drop-shadow(0 0 5px ${color})`,
          }}
        />
        <text
          x="68"
          y="61"
          textAnchor="middle"
          fill={color}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700 }}
        >
          {Math.round(score * 100)}
        </text>
        <text
          x="68"
          y="78"
          textAnchor="middle"
          fill="var(--hud-text-dim)"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}
        >
          PRESSURE
        </text>
        {escalating ? (
          <text
            x="92"
            y="58"
            fill="#ef4444"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700 }}
          >
            ▲
          </text>
        ) : null}
        {!escalating && decaying ? (
          <text
            x="92"
            y="58"
            fill="#4ade80"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700 }}
          >
            ▼
          </text>
        ) : null}
      </svg>

      <div className="pzo-pressure-tier" style={{ color }}>
        {tier}
      </div>
      <div className="pzo-pressure-sub">
        {ticksToCalm}T TO CALM · POST {Math.round(postActionScore * 100)}
      </div>
      <div className="pzo-pressure-sub">STAGNATION {stagnationCount}</div>

      <div className="pzo-pills" aria-label="Pressure signal summary">
        {signals.length > 0 ? (
          signals.map((signal) => (
            <span
              className="pzo-pill"
              key={signal}
              style={{ color, background: `${color}18` }}
            >
              {signal}
            </span>
          ))
        ) : (
          <span className="pzo-pressure-sub">NO ACTIVE TRIGGERS</span>
        )}
      </div>
    </div>
  );
}

function IntelBars({
  bars,
  momentum,
}: {
  bars: IntelBar[];
  momentum: number;
}) {
  return (
    <div className="pzo-intel-bars">
      {bars.map((bar) => (
        <div className="pzo-bar-row" key={bar.id}>
          <span className="pzo-bar-label">{bar.label}</span>
          <div className="pzo-bar-track">
            <div
              className="pzo-bar-fill"
              role="progressbar"
              aria-label={bar.label}
              aria-valuenow={Math.round(bar.value * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{
                width: pct(bar.value),
                background: bar.warn
                  ? 'linear-gradient(90deg, #7f1d1d, #dc2626)'
                  : `linear-gradient(90deg, ${bar.color}90, ${bar.color})`,
                boxShadow: bar.warn
                  ? '0 0 6px rgba(220,38,38,.55)'
                  : `0 0 5px ${bar.color}55`,
              }}
            />
          </div>
          <span className="pzo-bar-value">{Math.round(bar.value * 100)}</span>
        </div>
      ))}

      <div className="pzo-meta-row">
        <span className="pzo-meta">MOMENTUM</span>
        <span
          className="pzo-meta-value"
          style={{
            color:
              momentum > 0.05
                ? '#4ade80'
                : momentum < -0.05
                  ? '#dc2626'
                  : '#d8e4f4',
          }}
        >
          {fmtSignedOne(momentum)}
        </span>
      </div>
    </div>
  );
}

function ShieldPanel({
  overallPct,
  overallPct100,
  weakestLayerId,
  fortified,
  breachCascade,
  anyLow,
  cascadeCount,
  layers,
}: {
  overallPct: number;
  overallPct100: number;
  weakestLayerId: string;
  fortified: boolean;
  breachCascade: boolean;
  anyLow: boolean;
  cascadeCount: number;
  layers: ShieldLayerView[];
}) {
  return (
    <div className="pzo-shield-layers">
      {layers.length === 0 ? <div className="pzo-meta">NO SHIELD SNAPSHOT</div> : null}

      {layers.map((layer) => {
        const filled = Math.round(layer.integrityPct * 8);
        const color = layer.breached
          ? '#5f0f0f'
          : layer.critical
            ? '#dc2626'
            : layer.low
              ? '#f59e0b'
              : '#1de9b6';

        return (
          <div className="pzo-shield-row" key={layer.id}>
            <span className="pzo-shield-id">{layer.label}</span>
            <div className="pzo-shield-segments">
              {Array.from({ length: 8 }, (_, index) => (
                <div
                  className="pzo-shield-segment"
                  key={`${layer.id}-${index}`}
                  style={{
                    background: index < filled ? color : '#10161f',
                    boxShadow:
                      index < filled && !layer.breached ? `0 0 4px ${color}55` : 'none',
                  }}
                />
              ))}
            </div>
            <span className="pzo-shield-pct" style={{ color }}>
              {Math.round(layer.integrityPct * 100)}%
            </span>
          </div>
        );
      })}

      <div className="pzo-meta-row">
        <span className="pzo-meta">
          OVERALL {weakestLayerId !== 'ALL' ? `· WEAK ${shieldLabel(weakestLayerId)}` : ''}
        </span>
        <span
          className="pzo-meta-value"
          style={{ color: colorForShield(overallPct) }}
        >
          {overallPct100}%
        </span>
      </div>

      <div className="pzo-pills">
        {fortified ? (
          <span
            className="pzo-pill"
            style={{ color: '#1de9b6', background: 'rgba(29,233,182,.10)' }}
          >
            FORTIFIED
          </span>
        ) : null}

        {anyLow && !breachCascade ? (
          <span
            className="pzo-pill"
            style={{ color: '#f59e0b', background: 'rgba(245,158,11,.10)' }}
          >
            LOW INTEGRITY
          </span>
        ) : null}

        {breachCascade ? (
          <span
            className="pzo-pill"
            style={{ color: '#dc2626', background: 'rgba(220,38,38,.12)' }}
          >
            CASCADE ×{cascadeCount}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function TensionPanel({
  score,
  urgency,
  queueLength,
  arrived,
  queued,
  expired,
  pulseTicksActive,
  pulseActive,
  visibilityState,
}: {
  score: number;
  urgency: string;
  queueLength: number;
  arrived: number;
  queued: number;
  expired: number;
  pulseTicksActive: number;
  pulseActive: boolean;
  visibilityState: string;
}) {
  const urgencyColor =
    urgency === 'URGENT' ? '#dc2626' : urgency === 'BUILDING' ? '#f59e0b' : '#1de9b6';
  const totalPips = Math.max(queueLength, 12);

  return (
    <div className="pzo-tension-panel">
      <div
        className="pzo-tension-score"
        style={{
          color: colorForTension(score),
          textShadow: pulseActive ? `0 0 12px ${colorForTension(score)}` : 'none',
        }}
      >
        {Math.round(score * 100)}
      </div>

      <div
        className="pzo-threat-badge"
        style={{
          color: urgencyColor,
          border: `1px solid ${urgencyColor}`,
          background:
            urgency === 'URGENT'
              ? 'rgba(220,38,38,.14)'
              : urgency === 'BUILDING'
                ? 'rgba(245,158,11,.10)'
                : 'rgba(29,233,182,.08)',
        }}
      >
        {urgency}
      </div>

      <div className="pzo-queue-grid">
        {Array.from({ length: totalPips }, (_, index) => {
          const background =
            index < arrived
              ? '#dc2626'
              : index < arrived + queued
                ? '#f59e0b'
                : '#10161f';

          return (
            <div
              className="pzo-queue-pip"
              key={`queue-${index}`}
              style={{
                background,
                boxShadow: index < arrived ? '0 0 4px rgba(220,38,38,.6)' : 'none',
                transform: pulseActive && index === 0 ? 'scale(1.05)' : 'none',
              }}
            />
          );
        })}
      </div>

      <div className="pzo-queue-caption">
        <span>{arrived} ARRIVED</span>
        <span>{queued} QUEUED</span>
        <span>{expired} EXPIRED</span>
      </div>

      <div className="pzo-meta-row">
        <span className="pzo-meta">VIS {visibilityState}</span>
        <span className="pzo-meta-value" style={{ color: pulseActive ? '#dc2626' : '#d8e4f4' }}>
          {pulseActive ? `PULSE ×${pulseTicksActive}` : 'STEADY'}
        </span>
      </div>
    </div>
  );
}

function BattlePanel({
  actors,
  score,
  injectedCards,
  attackBot,
  attackType,
  targetLayer,
  transition,
}: {
  actors: number;
  score: number;
  injectedCards: number;
  attackBot: string;
  attackType: string;
  targetLayer: string;
  transition: string;
}) {
  return (
    <div className="pzo-battle-stack">
      <div className="pzo-bar-row">
        <span className="pzo-bar-label">HEAT</span>
        <div className="pzo-bar-track">
          <div
            className="pzo-bar-fill"
            style={{
              width: pct(score),
              background: 'linear-gradient(90deg, rgba(220,38,38,.65), #dc2626)',
              boxShadow: '0 0 6px rgba(220,38,38,.45)',
            }}
          />
        </div>
        <span className="pzo-bar-value">{Math.round(score * 100)}</span>
      </div>

      <table className="pzo-mini-table" aria-label="Battle engine status">
        <tbody>
          <tr>
            <th scope="row">ACTIVE</th>
            <td style={{ color: actors > 0 ? '#fecaca' : '#d8e4f4' }}>{actors}</td>
          </tr>
          <tr>
            <th scope="row">INJECT</th>
            <td>{injectedCards}</td>
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
        <span
          className="pzo-meta-value"
          style={{ color: actors > 0 ? '#dc2626' : '#d8e4f4' }}
        >
          {attackBot}
        </span>
      </div>
    </div>
  );
}

function CascadePanel({
  negativeCount,
  positiveCount,
  linksCut,
  latestStarted,
  latestBroken,
  latestPositive,
  nemesisBreaks,
}: {
  negativeCount: number;
  positiveCount: number;
  linksCut: number;
  latestStarted: string;
  latestBroken: string;
  latestPositive: string;
  nemesisBreaks: number;
}) {
  return (
    <div className="pzo-cascade-stack">
      <table className="pzo-mini-table" aria-label="Cascade engine status">
        <tbody>
          <tr>
            <th scope="row">NEG</th>
            <td style={{ color: negativeCount > 0 ? '#e9d5ff' : '#d8e4f4' }}>{negativeCount}</td>
          </tr>
          <tr>
            <th scope="row">POS</th>
            <td style={{ color: positiveCount > 0 ? '#bfdbfe' : '#d8e4f4' }}>{positiveCount}</td>
          </tr>
          <tr>
            <th scope="row">CUT</th>
            <td>{linksCut}</td>
          </tr>
          <tr>
            <th scope="row">START</th>
            <td>{latestStarted}</td>
          </tr>
          <tr>
            <th scope="row">BROKE</th>
            <td>{latestBroken}</td>
          </tr>
          <tr>
            <th scope="row">POSITIVE</th>
            <td>{latestPositive}</td>
          </tr>
        </tbody>
      </table>

      <div className="pzo-meta-row">
        <span className="pzo-meta">NEMESIS BREAKS</span>
        <span
          className="pzo-meta-value"
          style={{ color: nemesisBreaks > 0 ? '#fbbf24' : '#d8e4f4' }}
        >
          {nemesisBreaks}
        </span>
      </div>
    </div>
  );
}

function SovereigntyPanel({
  grade,
  score,
  integrityStatus,
  pipelineStatus,
  proofHashShort,
  rewardLabel,
  verified,
  tampered,
  pipelineRunning,
}: {
  grade: string;
  score: number;
  integrityStatus: string;
  pipelineStatus: string;
  proofHashShort: string;
  rewardLabel: string;
  verified: boolean;
  tampered: boolean;
  pipelineRunning: boolean;
}) {
  const gradeColor = GRADE_COLORS[grade] ?? '#93a4bd';
  const integrityColor = tampered ? '#dc2626' : verified ? '#1de9b6' : '#93a4bd';

  return (
    <div className="pzo-sv-wrap">
      <div className="pzo-grade-hex" style={{ color: gradeColor, background: `${gradeColor}20` }}>
        {grade}
      </div>

      <div className="pzo-sv-side">
        <div className="pzo-kv">SOVEREIGNTY</div>
        <div className="pzo-kv-value" style={{ color: colorForSovereignty(grade) }}>
          {Math.round(score * 100)}%
        </div>
        <div className="pzo-kv-value" style={{ color: integrityColor }}>
          {integrityStatus}
        </div>
        <div className="pzo-kv-value">PIPE {pipelineStatus}</div>
        <div className="pzo-kv-value">REWARD {rewardLabel}</div>
        <div className="pzo-kv-value">HASH {proofHashShort}</div>
        {pipelineRunning ? (
          <div
            className="pzo-pill"
            style={{ color: '#f59e0b', background: 'rgba(245,158,11,.10)', width: 'fit-content' }}
          >
            SCORING
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AlertRow({
  message,
  right,
}: {
  message: string | null;
  right: string | null;
}) {
  if (!message) return null;

  return (
    <div className="pzo-alert" role="alert" aria-live="assertive">
      <span>⚠</span>
      <span>{message}</span>
      <span className="pzo-alert__right">{right}</span>
    </div>
  );
}

function BottomStats({
  items,
}: {
  items: HUDModel['bottomStats'];
}) {
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
            <div
              className="pzo-stat-fill"
              style={{ width: pct(item.bar), background: item.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function GameHUD({
  isActiveRun = true,
  showIntel = true,
  className = '',
}: GameHUDProps) {
  const timeRaw = useTimeEngine();
  const pressureRaw = usePressureEngine();
  const tensionRaw = useTensionEngine();
  const shieldRaw = useShieldEngine();
  const battleRaw = useBattleEngine();
  const cascadeRaw = useCascadeEngine();
  const sovereigntyRaw = useSovereigntyEngine();
  const intelRaw = useIntel();

  useEffect(() => {
    injectStylesOnce(STYLE_ID, HUD_STYLES);
  }, []);

  const model = useMemo(
    () =>
      buildHudModel({
        time: asDict(timeRaw),
        pressure: asDict(pressureRaw),
        tension: asDict(tensionRaw),
        shield: asDict(shieldRaw),
        battle: asDict(battleRaw),
        cascade: asDict(cascadeRaw),
        sovereignty: asDict(sovereigntyRaw),
        intel: asDict(intelRaw as unknown),
      }),
    [
      battleRaw,
      cascadeRaw,
      intelRaw,
      pressureRaw,
      shieldRaw,
      sovereigntyRaw,
      tensionRaw,
      timeRaw,
    ],
  );

  if (!isActiveRun) return null;

  const pressurePanelClass = [
    'pzo-panel',
    model.criticalPressure ? 'pzo-panel--critical' : '',
    !model.criticalPressure && model.pressureScore >= 0.55 ? 'pzo-panel--warning' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const shieldPanelClass = [
    'pzo-panel',
    model.shieldFortified ? 'pzo-panel--fortified' : '',
    model.shieldBreachCascade ? 'pzo-panel--critical' : '',
    !model.shieldBreachCascade && model.shieldAnyLow ? 'pzo-panel--warning' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const rootClassName = ['pzo-hud-root', className].filter(Boolean).join(' ');

  return (
    <section className={rootClassName} data-pzo-surface="game-hud">
      <div className="pzo-hud-shell">
        <TopStrip items={model.topStrip} />

        <div className="pzo-col">
          <div className={pressurePanelClass}>
            <div className="pzo-section-label">Pressure</div>
            <PressureArcCard
              score={model.pressureScore}
              tier={model.pressureTier}
              signals={model.pressureSignals}
              escalating={model.pressureEscalating}
              decaying={model.pressureDecaying}
              critical={model.criticalPressure}
              ticksToCalm={model.pressureTicksToCalm}
              postActionScore={model.pressurePostActionScore}
              stagnationCount={model.pressureStagnation}
            />
          </div>

          <div className="pzo-panel">
            <div className="pzo-section-label">Battle Engine</div>
            <BattlePanel
              actors={model.battleActors}
              score={model.battleScore}
              injectedCards={model.battleInjectedCards}
              attackBot={model.battleAttackBot}
              attackType={model.battleAttackType}
              targetLayer={model.battleTargetLayer}
              transition={model.battleTransition}
            />
          </div>
        </div>

        <div className="pzo-center-stack">
          {showIntel ? (
            <div className="pzo-panel">
              <div className="pzo-section-label">ML Intel</div>
              <IntelBars bars={model.intelBars} momentum={model.intelMomentum} />
            </div>
          ) : null}

          <div className="pzo-panel">
            <div className="pzo-section-label">Tension Queue</div>
            <TensionPanel
              score={model.tensionScore}
              urgency={model.tensionUrgency}
              queueLength={model.tensionQueueLength}
              arrived={model.tensionArrived}
              queued={model.tensionQueued}
              expired={model.tensionExpired}
              pulseTicksActive={model.tensionPulseTicksActive}
              pulseActive={model.tensionPulseActive}
              visibilityState={model.tensionVisibilityState}
            />
          </div>

          <div className="pzo-panel">
            <div className="pzo-section-label">Cascade Engine</div>
            <CascadePanel
              negativeCount={model.cascadeNegativeCount}
              positiveCount={model.cascadePositiveCount}
              linksCut={model.cascadeLinksCut}
              latestStarted={model.cascadeLatestStarted}
              latestBroken={model.cascadeLatestBroken}
              latestPositive={model.cascadeLatestPositive}
              nemesisBreaks={model.cascadeNemesisBreaks}
            />
          </div>
        </div>

        <div className="pzo-col">
          <div className={shieldPanelClass}>
            <div className="pzo-section-label">Shield Engine</div>
            <ShieldPanel
              overallPct={model.shieldOverallPct}
              overallPct100={model.shieldOverallPct100}
              weakestLayerId={model.shieldWeakestLayerId}
              fortified={model.shieldFortified}
              breachCascade={model.shieldBreachCascade}
              anyLow={model.shieldAnyLow}
              cascadeCount={model.shieldCascadeCount}
              layers={model.shieldLayers}
            />
          </div>

          <div className="pzo-panel">
            <div className="pzo-section-label">Sovereignty</div>
            <SovereigntyPanel
              grade={model.sovereigntyGrade}
              score={model.sovereigntyScore}
              integrityStatus={model.sovereigntyIntegrityStatus}
              pipelineStatus={model.sovereigntyPipelineStatus}
              proofHashShort={model.sovereigntyProofHashShort}
              rewardLabel={model.sovereigntyRewardLabel}
              verified={model.sovereigntyVerified}
              tampered={model.sovereigntyTampered}
              pipelineRunning={model.sovereigntyPipelineRunning}
            />
          </div>
        </div>

        <AlertRow message={model.alertMessage} right={model.alertRight} />
        <BottomStats items={model.bottomStats} />
      </div>

      <PressureSignalTooltip />
    </section>
  );
}