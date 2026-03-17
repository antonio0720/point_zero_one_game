/**
 * FILE: GameHUD.tsx — SOVEREIGN COMMAND INTERFACE
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/features/run/components/GameHUD.tsx
 * Density6 LLC · Point Zero One · Confidential
 *
 * Fully upgraded HUD integrating all 7 engines:
 *   Pressure · Tension · Shield · Sovereignty · ML Intel · Cascade · Time
 *
 * Aesthetic: Military-grade trading terminal — black glass, amber command,
 *            crimson threat — F-22 cockpit meets Bloomberg Terminal.
 */

import React, { useEffect } from 'react';
import { useIntel }             from '../../../ml/wiring/MLContext';
import { usePressureEngine }    from '../hooks/usePressureEngine';
import { useTensionEngine }     from '../hooks/useTensionEngine';
import { useShieldEngine }      from '../hooks/useShieldEngine';
import { useSovereigntyEngine } from '../hooks/useSovereigntyEngine';
import PressureSignalTooltip    from './PressureSignalTooltip';

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL STYLES  (injected once into <head>)
// ─────────────────────────────────────────────────────────────────────────────

const HUD_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@400;500;600;700&display=swap');

  .pzo-hud-root {
    --hud-bg:           #080a0d;
    --hud-panel:        #0c0f14;
    --hud-border:       #1a2030;
    --hud-amber:        #c9a84c;
    --hud-amber-dim:    #7a5f1f;
    --hud-amber-glow:   rgba(201,168,76,0.15);
    --hud-crimson:      #c0392b;
    --hud-crimson-glow: rgba(192,57,43,0.2);
    --hud-teal:         #1de9b6;
    --hud-muted:        #3a4a60;
    --hud-text:         #8fa0b8;
    --hud-text-bright:  #c8d8f0;
    --font-mono:        'Share Tech Mono', monospace;
    --font-ui:          'Rajdhani', sans-serif;
    font-family:        var(--font-ui);
    color:              var(--hud-text-bright);
    user-select:        none;
    animation:          hudMount 0.4s ease-out both;
  }

  /* ── Layout ───────────────────────────────────── */
  .pzo-hud-grid {
    display: grid;
    grid-template-columns: 180px 1fr 180px;
    grid-template-rows: auto auto;
    gap: 6px;
    padding: 6px;
    background: var(--hud-bg);
    border-top: 1px solid var(--hud-border);
    position: relative;
    overflow: hidden;
  }

  /* scanline overlay */
  .pzo-hud-grid::before {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      0deg, transparent, transparent 2px,
      rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px
    );
    pointer-events: none;
    z-index: 0;
  }

  /* ── Panel ────────────────────────────────────── */
  .pzo-panel {
    background: var(--hud-panel);
    border: 1px solid var(--hud-border);
    border-radius: 3px;
    padding: 8px;
    position: relative;
    z-index: 1;
    clip-path: polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px));
  }
  .pzo-panel--warning  { border-color: var(--hud-amber);   box-shadow: 0 0 12px var(--hud-amber-glow),  inset 0 0 20px var(--hud-amber-glow);  }
  .pzo-panel--critical { border-color: var(--hud-crimson); box-shadow: 0 0 16px var(--hud-crimson-glow),inset 0 0 24px var(--hud-crimson-glow); animation: critPulse .8s ease-in-out infinite alternate; }
  .pzo-panel--fortified{ border-color: var(--hud-teal);    box-shadow: 0 0 12px rgba(29,233,182,.15); }

  /* ── Section label ────────────────────────────── */
  .pzo-label {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: .2em;
    color: var(--hud-amber);
    text-transform: uppercase;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .pzo-label::after { content:''; flex:1; height:1px; background:linear-gradient(to right,var(--hud-amber-dim),transparent); }

  /* ── Pressure arc ─────────────────────────────── */
  .pzo-pressure-wrap { display:flex; flex-direction:column; align-items:center; gap:4px; }
  .pzo-pressure-tier { font-family:var(--font-mono); font-size:11px; letter-spacing:.15em; text-align:center; }
  .pzo-pressure-ticks{ font-family:var(--font-mono); font-size:9px; color:var(--hud-text); text-align:center; }

  /* ── Intel bars ───────────────────────────────── */
  .pzo-intel-bars { display:flex; flex-direction:column; gap:5px; }
  .pzo-bar-row    { display:grid; grid-template-columns:58px 1fr 30px; align-items:center; gap:5px; }
  .pzo-bar-lbl    { font-family:var(--font-mono); font-size:9px; color:var(--hud-text); letter-spacing:.1em; }
  .pzo-bar-track  { height:6px; background:#111820; border:1px solid var(--hud-border); border-radius:1px; overflow:hidden; }
  .pzo-bar-fill   { height:100%; border-radius:1px; transition:width .6s cubic-bezier(.4,0,.2,1); position:relative; }
  .pzo-bar-fill::after { content:''; position:absolute; top:0; right:0; width:2px; height:100%; background:rgba(255,255,255,.6); border-radius:1px; }
  .pzo-bar-val    { font-family:var(--font-mono); font-size:9px; text-align:right; }
  .pzo-momentum-row { display:flex; justify-content:space-between; align-items:center; margin-top:2px; padding-top:5px; border-top:1px solid var(--hud-border); }
  .pzo-momentum-val { font-family:var(--font-mono); font-size:13px; font-weight:700; letter-spacing:.05em; }

  /* ── Shield ───────────────────────────────────── */
  .pzo-shield-layers  { display:flex; flex-direction:column; gap:5px; }
  .pzo-shield-row     { display:grid; grid-template-columns:20px 1fr 36px; align-items:center; gap:5px; }
  .pzo-shield-id      { font-family:var(--font-mono); font-size:9px; color:var(--hud-muted); }
  .pzo-shield-seg-track { display:flex; gap:2px; height:8px; }
  .pzo-shield-seg     { flex:1; border-radius:1px; transition:background .4s ease,box-shadow .4s ease; }
  .pzo-shield-pct     { font-family:var(--font-mono); font-size:9px; text-align:right; }
  .pzo-shield-footer  { display:flex; justify-content:space-between; align-items:center; margin-top:4px; padding-top:5px; border-top:1px solid var(--hud-border); }
  .pzo-shield-overall-val { font-family:var(--font-mono); font-size:18px; font-weight:700; }
  .pzo-fortified-badge{ font-family:var(--font-mono); font-size:8px; letter-spacing:.15em; color:var(--hud-teal); border:1px solid var(--hud-teal); padding:1px 5px; border-radius:2px; animation:fortGlow 1.5s ease-in-out infinite alternate; }

  /* ── Tension ──────────────────────────────────── */
  .pzo-tension-score { font-family:var(--font-mono); font-size:20px; font-weight:700; text-align:center; margin-bottom:4px; }
  .pzo-threat-badge  { font-family:var(--font-mono); font-size:9px; letter-spacing:.15em; text-align:center; padding:2px 0; border-radius:2px; margin-bottom:6px; }
  .pzo-queue-pips    { display:flex; gap:3px; flex-wrap:wrap; }
  .pzo-queue-pip     { width:8px; height:8px; border-radius:1px; transition:all .3s ease; }
  .pzo-tension-footer{ display:flex; justify-content:space-between; margin-top:auto; }
  .pzo-tension-meta  { font-family:var(--font-mono); font-size:9px; color:var(--hud-text); }
  .pzo-pulse-badge   { font-family:var(--font-mono); font-size:9px; color:var(--hud-crimson); letter-spacing:.1em; animation:critPulse .6s ease-in-out infinite alternate; }

  /* ── Sovereignty ──────────────────────────────── */
  .pzo-sv-wrap   { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; height:100%; }
  .pzo-grade-hex { width:52px; height:52px; display:flex; align-items:center; justify-content:center; font-size:24px; font-weight:700; font-family:var(--font-mono); clip-path:polygon(50% 0%,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%); transition:all .6s ease; }
  .pzo-grade-lbl { font-family:var(--font-mono); font-size:8px; letter-spacing:.2em; color:var(--hud-text); text-align:center; }
  .pzo-sv-score  { font-family:var(--font-mono); font-size:13px; font-weight:700; text-align:center; }
  .pzo-integrity { font-family:var(--font-mono); font-size:8px; letter-spacing:.12em; text-align:center; }
  .pzo-scoring   { font-family:var(--font-mono); font-size:8px; color:#f59e0b; letter-spacing:.15em; animation:critPulse .8s ease-in-out infinite alternate; }

  /* ── Cascade alert ────────────────────────────── */
  .pzo-cascade-alert { grid-column:1/-1; display:flex; align-items:center; gap:10px; padding:6px 12px; background:rgba(192,57,43,.12); border:1px solid var(--hud-crimson); border-radius:2px; animation:critPulse .6s ease-in-out infinite alternate; }
  .pzo-cascade-icon  { font-size:14px; animation:spin 1s linear infinite; }
  .pzo-cascade-text  { font-family:var(--font-mono); font-size:10px; letter-spacing:.15em; color:var(--hud-crimson); text-transform:uppercase; }
  .pzo-cascade-count { margin-left:auto; font-family:var(--font-mono); font-size:10px; color:var(--hud-crimson); }

  /* ── Bottom stat strip ────────────────────────── */
  .pzo-bottom-row  { grid-column:1/-1; display:grid; grid-template-columns:repeat(6,1fr); gap:4px; }
  .pzo-stat-cell   { background:var(--hud-panel); border:1px solid var(--hud-border); border-radius:2px; padding:5px 8px; display:flex; flex-direction:column; align-items:center; gap:2px; clip-path:polygon(0 0,calc(100% - 5px) 0,100% 5px,100% 100%,0 100%); }
  .pzo-stat-key    { font-family:var(--font-mono); font-size:8px; letter-spacing:.15em; color:var(--hud-text); text-transform:uppercase; }
  .pzo-stat-val    { font-family:var(--font-mono); font-size:15px; font-weight:700; line-height:1; }
  .pzo-stat-bar    { width:100%; height:2px; background:var(--hud-border); border-radius:1px; overflow:hidden; margin-top:2px; }
  .pzo-stat-bar-fill { height:100%; border-radius:1px; transition:width .5s ease; }

  /* ── Keyframes ────────────────────────────────── */
  @keyframes critPulse  { from{opacity:.7} to{opacity:1} }
  @keyframes fortGlow   { from{box-shadow:0 0 4px rgba(29,233,182,.3)} to{box-shadow:0 0 10px rgba(29,233,182,.7)} }
  @keyframes spin       { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes hudMount   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
`;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById('pzo-hud-styles')) return;
  const el = document.createElement('style');
  el.id = 'pzo-hud-styles';
  el.textContent = HUD_STYLES;
  document.head.appendChild(el);
}

const pct = (v: number) => `${Math.round(Math.min(1, Math.max(0, v)) * 100)}%`;
const fmt = (v: number, d = 1) => (v * 100).toFixed(d);

// ─────────────────────────────────────────────────────────────────────────────
// PRESSURE ARC — SVG radial gauge
// ─────────────────────────────────────────────────────────────────────────────

const TIER_COLOR: Record<string, string> = {
  CALM:     '#4ade80',
  BUILDING: '#c9a84c',
  ELEVATED: '#f97316',
  HIGH:     '#ef4444',
  CRITICAL: '#ff0000',
};

const PressureArc: React.FC = () => {
  const { score, tier, isEscalating, isDecaying, ticksToCalm, isCritical } = usePressureEngine();

  const R  = 52;
  const cx = 68;
  const cy = 68;
  const SW = 10;
  const GAP_DEG   = 30;
  const TOTAL_DEG = 360 - GAP_DEG;

  const color      = TIER_COLOR[tier] ?? '#ccc';
  const fillAngle  = TOTAL_DEG * Math.min(Math.max(score, 0), 1);
  const startDeg   = GAP_DEG / 2;

  const toXY = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + R * Math.cos(rad), y: cy + R * Math.sin(rad) };
  };

  const trackS = toXY(startDeg);
  const trackE = toXY(startDeg + TOTAL_DEG);
  const fillS  = toXY(startDeg);
  const fillE  = toXY(startDeg + fillAngle);
  const largeArc = fillAngle > 180 ? 1 : 0;

  const trackPath = `M ${trackS.x} ${trackS.y} A ${R} ${R} 0 1 1 ${trackE.x} ${trackE.y}`;
  const fillPath  = score > 0.01
    ? `M ${fillS.x} ${fillS.y} A ${R} ${R} 0 ${largeArc} 1 ${fillE.x} ${fillE.y}`
    : null;

  const glowFilter = isCritical
    ? `drop-shadow(0 0 8px ${color}) drop-shadow(0 0 3px #fff)`
    : `drop-shadow(0 0 4px ${color})`;

  return (
    <div className="pzo-pressure-wrap">
      <svg width={136} height={136} viewBox="0 0 136 136" overflow="visible">
        {/* Graduation ticks */}
        {[0, 25, 50, 75, 100].map((t) => {
          const a   = startDeg + (TOTAL_DEG * t) / 100;
          const p1  = toXY(a);
          const rOut = R + 7;
          const rad = ((a - 90) * Math.PI) / 180;
          const p2  = { x: cx + rOut * Math.cos(rad), y: cy + rOut * Math.sin(rad) };
          return (
            <line key={t} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke="#1a2030" strokeWidth={t === 0 || t === 100 ? 2 : 1} />
          );
        })}

        {/* Track */}
        <path d={trackPath} fill="none" stroke="#111820" strokeWidth={SW} strokeLinecap="butt" />

        {/* Fill */}
        {fillPath && (
          <path d={fillPath} fill="none" stroke={color} strokeWidth={SW}
            strokeLinecap="butt"
            style={{ filter: glowFilter, transition: 'all 1s linear' }} />
        )}

        {/* Score */}
        <text x={cx} y={cy - 6} textAnchor="middle" fill={color}
          style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:22, fontWeight:700 }}>
          {Math.round(score * 100)}
        </text>
        <text x={cx} y={cy + 11} textAnchor="middle" fill="#3a4a60"
          style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9 }}>
          PRESSURE
        </text>

        {/* Direction arrows */}
        {isEscalating && (
          <text x={cx + 22} y={cy - 4} fill="#ef4444"
            style={{ fontFamily:'monospace', fontSize:14, fontWeight:700 }}>▲</text>
        )}
        {isDecaying && (
          <text x={cx + 22} y={cy - 4} fill="#4ade80"
            style={{ fontFamily:'monospace', fontSize:14, fontWeight:700 }}>▼</text>
        )}
      </svg>

      <div className="pzo-pressure-tier" style={{ color }}>{tier}</div>
      {tier !== 'CALM' && (
        <div className="pzo-pressure-ticks">{ticksToCalm}t TO CALM</div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// INTEL BARS
// ─────────────────────────────────────────────────────────────────────────────

const IntelBars: React.FC = () => {
  const intel = useIntel();

  const bars = [
    { key:'alpha',  label:'ALPHA',  value:intel.alpha,               color:'#4ade80', warn:false },
    { key:'risk',   label:'RISK',   value:intel.risk,                color:'#f59e0b', warn:intel.risk > 0.7 },
    { key:'vol',    label:'VOL',    value:intel.volatility,          color:'#38bdf8', warn:false },
    { key:'tilt',   label:'TILT',   value:intel.tiltRisk,            color:'#fb923c', warn:intel.tiltRisk > 0.5 },
    { key:'runway', label:'RUNWAY', value:1 - intel.bankruptcyRisk60,color:'#c0392b', warn:intel.bankruptcyRisk60 > 0.6 },
  ] as const;

  return (
    <div className="pzo-intel-bars">
      {bars.map((b) => (
        <div key={b.key} className="pzo-bar-row">
          <span className="pzo-bar-lbl">{b.label}</span>
          <div className="pzo-bar-track">
            <div
              className="pzo-bar-fill"
              style={{
                width: pct(b.value),
                background: b.warn
                  ? 'linear-gradient(90deg,#7f1d1d,#c0392b)'
                  : `linear-gradient(90deg,${b.color}88,${b.color})`,
                boxShadow: b.warn ? '0 0 6px #c0392b' : `0 0 4px ${b.color}55`,
              }}
              role="progressbar"
              aria-valuenow={Math.round(b.value * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={b.label}
            />
          </div>
          <span className="pzo-bar-val"
            style={{ color: b.warn ? 'var(--hud-crimson)' : 'var(--hud-text)' }}>
            {Math.round(b.value * 100)}
          </span>
        </div>
      ))}

      <div className="pzo-momentum-row">
        <span className="pzo-bar-lbl">MOMENTUM</span>
        <span className="pzo-momentum-val"
          style={{
            color: intel.momentum > 0.05  ? '#4ade80'
                 : intel.momentum < -0.05 ? 'var(--hud-crimson)'
                 : 'var(--hud-text)',
            textShadow: intel.momentum > 0.05  ? '0 0 8px #4ade80'
                      : intel.momentum < -0.05 ? '0 0 8px #c0392b'
                      : 'none',
          }}>
          {intel.momentum >= 0 ? '+' : ''}{(intel.momentum * 100).toFixed(1)}
        </span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SHIELD PANEL
// ─────────────────────────────────────────────────────────────────────────────

const SHIELD_LABELS: Record<string, string> = {
  LIQUIDITY_BUFFER: 'LIQ',
  CREDIT_LINE:      'CRD',
  ASSET_FLOOR:      'AST',
  NETWORK_CORE:     'NET',
};

const ShieldPanel: React.FC = () => {
  const shield  = useShieldEngine();
  const layers  = shield.layers ? Object.entries(shield.layers) : [];
  const overall = shield.overallPct ?? 0;

  const overallColor = overall > 0.7 ? '#4ade80' : overall > 0.4 ? '#f59e0b' : 'var(--hud-crimson)';

  return (
    <div className="pzo-shield-layers">
      {layers.map(([id, layer]) => {
        const hp     = (layer as any).integrityPct ?? 1;
        const segs   = 8;
        const filled = Math.round(hp * segs);
        const color  = layer.isCriticalWarning ? 'var(--hud-crimson)'
                     : layer.isLowWarning      ? '#f59e0b'
                     : layer.isBreached        ? '#450a0a'
                     : 'var(--hud-teal)';
        return (
          <div key={id} className="pzo-shield-row">
            <span className="pzo-shield-id">{SHIELD_LABELS[id] ?? id.slice(0, 3)}</span>
            <div className="pzo-shield-seg-track">
              {Array.from({ length: segs }, (_, i) => (
                <div key={i} className="pzo-shield-seg" style={{
                  background: i < filled ? color : '#111820',
                  boxShadow:  i < filled && !layer.isBreached ? `0 0 3px ${color}88` : 'none',
                }} />
              ))}
            </div>
            <span className="pzo-shield-pct" style={{ color }}>
              {Math.round(hp * 100)}%
            </span>
          </div>
        );
      })}

      <div className="pzo-shield-footer">
        <span className="pzo-label" style={{ marginBottom: 0 }}>INTEGRITY</span>
        <span className="pzo-shield-overall-val" style={{ color: overallColor }}>
          {shield.overallPct100}%
        </span>
        {shield.isFortified && (
          <span className="pzo-fortified-badge">FORTIFIED</span>
        )}
      </div>

      {shield.isInBreachCascade && (
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.15em',
          color: 'var(--hud-crimson)', textAlign: 'center',
          animation: 'critPulse .5s ease-in-out infinite alternate',
        }}>
          ⚡ CASCADE ×{shield.cascadeCount}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TENSION PANEL
// ─────────────────────────────────────────────────────────────────────────────

const TensionPanel: React.FC = () => {
  const tension = useTensionEngine();

  const urgencyColor = tension.threatUrgency === 'URGENT'   ? 'var(--hud-crimson)'
                     : tension.threatUrgency === 'BUILDING' ? '#f59e0b'
                     : 'var(--hud-teal)';
  const urgencyBg    = tension.threatUrgency === 'URGENT'   ? 'rgba(192,57,43,.15)'
                     : tension.threatUrgency === 'BUILDING' ? 'rgba(245,158,11,.1)'
                     : 'rgba(29,233,182,.08)';

  const scoreColor = tension.score > 0.7 ? 'var(--hud-crimson)'
                   : tension.score > 0.4 ? '#f59e0b'
                   : 'var(--hud-teal)';

  const pipColor = (i: number) =>
    i < tension.arrivedCount                            ? 'var(--hud-crimson)'
    : i < tension.arrivedCount + tension.queuedCount   ? '#f59e0b'
    : '#1a2030';

  const totalPips = Math.max(tension.queueLength, 12);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6, height:'100%' }}>
      <div className="pzo-tension-score"
        style={{ color: scoreColor, textShadow: tension.isPulseActive ? '0 0 12px currentColor' : 'none' }}>
        {fmt(tension.score)}
      </div>

      <div className="pzo-threat-badge"
        style={{ color: urgencyColor, background: urgencyBg, border: `1px solid ${urgencyColor}` }}>
        {tension.threatUrgency}
      </div>

      <div className="pzo-queue-pips">
        {Array.from({ length: totalPips }, (_, i) => (
          <div key={i} className="pzo-queue-pip" style={{
            background: pipColor(i),
            boxShadow: i < tension.arrivedCount ? '0 0 4px var(--hud-crimson)' : 'none',
          }} />
        ))}
      </div>

      <div className="pzo-tension-footer" style={{ marginTop: 'auto' }}>
        <span className="pzo-tension-meta">
          {tension.arrivedCount}↓ {tension.queuedCount}⏳ {tension.expiredCount}✗
        </span>
        {tension.isPulseActive && (
          <span className="pzo-pulse-badge">PULSE ×{tension.pulseTicksActive}</span>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SOVEREIGNTY PANEL
// ─────────────────────────────────────────────────────────────────────────────

const GRADE_COLORS: Record<string, string> = {
  A: '#4ade80', B: '#c9a84c', C: '#38bdf8', D: '#f97316', F: '#c0392b',
};

const SovereigntyPanel: React.FC = () => {
  const sv    = useSovereigntyEngine();
  const grade = sv.grade ?? '—';
  const color = sv.grade ? (GRADE_COLORS[sv.grade] ?? '#8fa0b8') : '#8fa0b8';
  const score = sv.sovereigntyScore != null ? (sv.sovereigntyScore * 100).toFixed(1) : '—';

  return (
    <div className="pzo-sv-wrap">
      <div className="pzo-grade-hex" style={{ background:`${color}22`, color }}>
        {grade}
      </div>
      <div className="pzo-grade-lbl">SOVEREIGNTY</div>
      <div className="pzo-sv-score" style={{ color }}>{score}</div>
      <div className="pzo-integrity" style={{
        color: sv.isVerified ? 'var(--hud-teal)' : sv.isTampered ? 'var(--hud-crimson)' : 'var(--hud-text)',
      }}>
        {sv.integrityStatus ?? 'UNVERIFIED'}
      </div>
      {sv.isPipelineRunning && <div className="pzo-scoring">SCORING…</div>}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// BOTTOM STAT STRIP
// ─────────────────────────────────────────────────────────────────────────────

const BottomStats: React.FC = () => {
  const intel   = useIntel();
  const tension = useTensionEngine();
  const sv      = useSovereigntyEngine();

  const stats = [
    { key:'ALPHA',   val:`+${fmt(intel.alpha)}`,         bar:intel.alpha,              color:'#4ade80' },
    { key:'VOL',     val:fmt(intel.volatility),           bar:intel.volatility,         color:'#38bdf8' },
    { key:'TILT',    val:fmt(intel.tiltRisk),             bar:intel.tiltRisk,           color:intel.tiltRisk > 0.5 ? 'var(--hud-crimson)' : '#f97316' },
    { key:'TENSION', val:fmt(tension.score),              bar:tension.score,            color:tension.score > 0.6 ? 'var(--hud-crimson)' : '#f59e0b' },
    { key:'TICK',    val:`T${tension.currentTick}`,       bar:null,                     color:'#c9a84c' },
    { key:'SV',      val:sv.sovereigntyScore != null ? (sv.sovereigntyScore * 100).toFixed(0) : '—',
                     bar:sv.sovereigntyScore ?? 0,        color: sv.grade ? (GRADE_COLORS[sv.grade] ?? '#8fa0b8') : '#8fa0b8' },
  ];

  return (
    <div className="pzo-bottom-row">
      {stats.map((s) => (
        <div key={s.key} className="pzo-stat-cell">
          <span className="pzo-stat-key">{s.key}</span>
          <span className="pzo-stat-val" style={{ color: s.color }}>{s.val}</span>
          {s.bar !== null && (
            <div className="pzo-stat-bar">
              <div className="pzo-stat-bar-fill" style={{ width:pct(s.bar), background:s.color }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CASCADE ALERT BANNER
// ─────────────────────────────────────────────────────────────────────────────

const CascadeAlert: React.FC = () => {
  const shield = useShieldEngine();
  if (!shield.isInBreachCascade) return null;
  return (
    <div className="pzo-cascade-alert" role="alert" aria-live="assertive">
      <span className="pzo-cascade-icon">⚡</span>
      <span className="pzo-cascade-text">BREACH CASCADE ACTIVE — SHIELDS COMPROMISED</span>
      <span className="pzo-cascade-count">×{shield.cascadeCount}</span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// GAME HUD — ROOT
// ─────────────────────────────────────────────────────────────────────────────

interface GameHUDProps {
  readonly isActiveRun?:  boolean;
  readonly showIntel?:    boolean;
}

const GameHUD: React.FC<GameHUDProps> = ({
  isActiveRun,
  showIntel = true,
}) => {
  
  const shield  = useShieldEngine();
  const tension = useTensionEngine();

  useEffect(() => { injectStyles(); }, []);

  if (!isActiveRun) return null;

  const pressureClass = [
    'pzo-panel',
    tension.threatUrgency === 'URGENT' ? 'pzo-panel--critical' : '',
  ].filter(Boolean).join(' ');

  const shieldClass = [
    'pzo-panel',
    shield.isFortified                               ? 'pzo-panel--fortified' : '',
    shield.isInBreachCascade                         ? 'pzo-panel--critical'  : '',
    shield.isAnyLow && !shield.isInBreachCascade     ? 'pzo-panel--warning'  : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="pzo-hud-root">
      <div className="pzo-hud-grid">

        {/* LEFT — Pressure arc */}
        <div className={pressureClass}>
          <div className="pzo-label">PRESSURE</div>
          <PressureArc />
        </div>

        {/* CENTER — Intel bars + Tension queue */}
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {showIntel && (
            <div className="pzo-panel">
              <div className="pzo-label">ML INTEL</div>
              <IntelBars />
            </div>
          )}
          <div className="pzo-panel" style={{ flex: 1 }}>
            <div className="pzo-label">TENSION QUEUE</div>
            <TensionPanel />
          </div>
        </div>

        {/* RIGHT — Shield + Sovereignty */}
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <div className={shieldClass}>
            <div className="pzo-label">SHIELDS</div>
            <ShieldPanel />
          </div>
          <div className="pzo-panel" style={{ flex: 1 }}>
            <SovereigntyPanel />
          </div>
        </div>

        {/* FULL-WIDTH — Cascade alert (conditional) */}
        <CascadeAlert />

        {/* FULL-WIDTH — Bottom stat strip */}
        <BottomStats />

      </div>

      {/* Pressure signal tooltip — hook-driven, no props */}
      <PressureSignalTooltip />
    </div>
  );
};

export default GameHUD;