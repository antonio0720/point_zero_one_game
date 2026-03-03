/**
 * BankruptcyScreen.tsx — Terminal Bankruptcy · Viral Share Optimized
 * Engine: sovereignty/types · RunGrade · battle/types · cascade/types
 * Scale: 20M concurrent · Mobile-first · Syne + IBM Plex Mono
 * Density6 LLC · Point Zero One · Confidential
 */

import React, { useMemo, useState, useCallback, memo } from 'react';
import type { RunGrade } from '../engines/sovereignty/types';
import { OUTCOME_MULTIPLIERS } from '../engines/sovereignty/types';
import type { BotId } from '../engines/battle/types';
import type { CascadeSeverity } from '../engines/cascade/types';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  void:    '#030308',
  card:    '#0C0C1E',
  cardHi:  '#131328',
  border:  'rgba(255,255,255,0.08)',
  borderM: 'rgba(255,255,255,0.18)',
  text:    '#F2F2FF',
  textSub: '#9090B4',
  textMut: '#44445A',
  green:   '#22DD88',
  red:     '#FF4D4D',
  redD:    'rgba(255,77,77,0.10)',
  orange:  '#FF8C00',
  yellow:  '#FFD700',
  indigo:  '#818CF8',
  mono:    "'IBM Plex Mono', 'JetBrains Mono', monospace",
  display: "'Syne', 'Outfit', system-ui, sans-serif",
};

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');*{box-sizing:border-box;}`;

// ─── Types ────────────────────────────────────────────────────────────────────
export type MarketRegime = 'Stable' | 'Expansion' | 'Compression' | 'Panic' | 'Euphoria';

export interface IntelligenceState {
  alpha:               number;
  risk:                number;
  volatility:          number;
  antiCheat:           number;
  personalization:     number;
  rewardFit:           number;
  recommendationPower: number;
  churnRisk:           number;
  momentum:            number;
}

export interface SeasonState {
  xp:               number;
  passTier:         number;
  dominionControl:  number;
  nodePressure:     number;
  winStreak:        number;
  battlePassLevel:  number;
  rewardsPending:   number;
}

export interface BankruptcyScreenProps {
  seed:           number;
  tick:           number;
  regime:         MarketRegime;
  intelligence:   IntelligenceState;
  season:         SeasonState;
  events:         string[];
  equityHistory:  number[];
  sovereigntyScore?: number;
  activeBotIds?:  BotId[];
  cascadeSeverity?: CascadeSeverity;
  onPlayAgain:    () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pct(n: number): string { return `${Math.round(n * 100)}%`; }

function buildAuditHash(seed: number, tick: number): string {
  let h = 2166136261;
  const input = `${seed}:${tick}:bankrupt`;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hex = ((h >>> 0) >>> 0).toString(16).padStart(8, '0');
  return `PZO-${hex.slice(0, 4).toUpperCase()}-${hex.slice(4).toUpperCase()}`;
}

function computeGrade(score: number): RunGrade {
  if (score >= 1.10) return 'A';
  if (score >= 0.80) return 'B';
  if (score >= 0.55) return 'C';
  if (score >= 0.30) return 'D';
  return 'F';
}

const GRADE_CFG: Record<RunGrade, { color: string; label: string; bg: string; border: string }> = {
  A: { color: T.yellow,  label: 'Sovereign',  bg: 'rgba(255,215,0,0.08)',    border: 'rgba(255,215,0,0.28)'    },
  B: { color: '#22D3EE', label: 'Architect',  bg: 'rgba(34,211,238,0.08)',   border: 'rgba(34,211,238,0.25)'   },
  C: { color: T.indigo,  label: 'Builder',    bg: 'rgba(129,140,248,0.08)',  border: 'rgba(129,140,248,0.22)'  },
  D: { color: T.orange,  label: 'Developing', bg: 'rgba(255,140,0,0.07)',    border: 'rgba(255,140,0,0.22)'    },
  F: { color: T.red,     label: 'Liquidated', bg: 'rgba(255,77,77,0.07)',    border: 'rgba(255,77,77,0.22)'    },
};

const REGIME_COLOR: Record<MarketRegime, string> = {
  Stable:      '#22DD88',
  Expansion:   '#818CF8',
  Compression: '#FFD700',
  Panic:       '#FF4D4D',
  Euphoria:    '#22D3EE',
};

// ─── Death Sparkline ──────────────────────────────────────────────────────────
const DeathSparkline = memo(function DeathSparkline({ data }: { data: number[] }) {
  const { points, gradientId } = useMemo(() => {
    const id = `pzo-grad-${Math.random().toString(36).slice(2, 7)}`;
    if (data.length < 2) return { points: '', gradientId: id };
    const w = 560, h = 80;
    const min = Math.min(...data), max = Math.max(...data);
    const range = max - min || 1;
    const pad = 6;
    const pts = data.map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (v - min) / range) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return { points: pts.join(' '), gradientId: id };
  }, [data]);

  if (!points) return null;

  const ptArr   = points.split(' ');
  const lastPt  = ptArr[ptArr.length - 1].split(',');

  // Build area path
  const ptsXY = points.split(' ').map(p => p.split(',').map(Number));
  const areaD = ptsXY.length > 1
    ? `M${ptsXY[0][0]},80 L${ptsXY.map(([x, y]) => `${x},${y}`).join(' L')} L${ptsXY[ptsXY.length - 1][0]},80 Z`
    : '';

  return (
    <svg
      viewBox="0 0 560 80"
      style={{ width: '100%', height: 80, overflow: 'visible' }}
      aria-label="Equity history sparkline"
    >
      <defs>
        <linearGradient id={`${gradientId}-area`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#FF4D4D" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#FF4D4D" stopOpacity="0"    />
        </linearGradient>
      </defs>

      {/* Area fill */}
      {areaD && (
        <path d={areaD} fill={`url(#${gradientId}-area)`} />
      )}

      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke="#FF4D4D"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Flatline extension */}
      <line
        x1={lastPt[0]} y1={lastPt[1]}
        x2="556" y2={lastPt[1]}
        stroke="rgba(255,77,77,0.25)"
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />

      {/* End dot */}
      <circle cx={lastPt[0]} cy={lastPt[1]} r={5} fill="#FF4D4D" />
      <circle cx={lastPt[0]} cy={lastPt[1]} r={9} fill="none" stroke="#FF4D4D" strokeWidth={1} opacity={0.4}
        style={{ animation: 'pzo-dot-ping 1.5s ease-out infinite' }}
      />
    </svg>
  );
});

// ─── Cause Analysis ───────────────────────────────────────────────────────────
function inferCauseOfDeath(
  events:       string[],
  regime:       MarketRegime,
  intelligence: IntelligenceState,
  season:       SeasonState,
  cascadeSev?:  CascadeSeverity,
): { text: string; icon: string }[] {
  const causes: { text: string; icon: string }[] = [];
  const last20 = events.slice(-20);

  if (last20.some(e => /FUBAR hit/i.test(e)))
    causes.push({ icon: '💥', text: 'Unblocked FUBAR events drained cash reserves to zero.' });
  if (last20.some(e => /Recession/i.test(e)))
    causes.push({ icon: '📉', text: 'Recession wave compounded expense obligations over time.' });
  if (last20.some(e => /Unexpected bill/i.test(e)))
    causes.push({ icon: '💸', text: 'Unexpected bills accelerated the final cash burn.' });
  if (season.nodePressure > 10)
    causes.push({ icon: '🔴', text: `Node pressure reached ${season.nodePressure} — systemic fragility was critical.` });
  if (intelligence.risk > 0.7)
    causes.push({ icon: '⚠️', text: `AI risk signal hit ${pct(intelligence.risk)} — portfolio was over-leveraged.` });
  if (regime === 'Panic')
    causes.push({ icon: '🌪️', text: 'Market entered Panic regime at time of collapse.' });
  if (intelligence.momentum < 0.2)
    causes.push({ icon: '📊', text: 'Momentum collapsed — income growth failed to offset expense growth.' });
  if (cascadeSev === 'CATASTROPHIC' || cascadeSev === 'SEVERE')
    causes.push({ icon: '⛓️', text: `Cascade severity reached ${cascadeSev} — chain events overwhelmed defenses.` });

  if (causes.length === 0)
    causes.push({ icon: '🕳️', text: 'Cash decay outpaced income generation. No shields remained to absorb the breach.' });

  return causes;
}

// ─── Stat Tile ────────────────────────────────────────────────────────────────
const StatTile = memo(function StatTile({
  label, value, color,
}: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      background: T.cardHi, border: `1px solid ${T.border}`,
      borderRadius: 12, padding: '14px 16px', textAlign: 'center',
    }}>
      <div style={{
        fontFamily: T.mono, fontSize: 9, color: T.textMut,
        textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: T.mono, fontSize: 15, fontWeight: 800,
        color: color ?? T.text, lineHeight: 1,
      }}>
        {value}
      </div>
    </div>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────
export default memo(function BankruptcyScreen({
  seed, tick, regime, intelligence, season, events, equityHistory,
  sovereigntyScore, activeBotIds, cascadeSeverity, onPlayAgain,
}: BankruptcyScreenProps) {
  const [copied, setCopied] = useState(false);
  const auditHash = useMemo(() => buildAuditHash(seed, tick), [seed, tick]);

  const causes = useMemo(
    () => inferCauseOfDeath(events, regime, intelligence, season, cascadeSeverity),
    [events, regime, intelligence, season, cascadeSeverity],
  );

  // Engine: BANKRUPT multiplier = 0.4
  const bankruptMultiplier = OUTCOME_MULTIPLIERS.BANKRUPT;
  const rawScore   = sovereigntyScore ?? 0;
  const finalScore = rawScore * bankruptMultiplier;
  const grade      = computeGrade(finalScore);
  const gradeCfg   = GRADE_CFG[grade];

  const handleShare = useCallback(async () => {
    const text = [
      '💀 POINT ZERO ONE — BANKRUPTCY',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      `Tick:      ${tick}`,
      `Regime:    ${regime}`,
      `AI Risk:   ${pct(intelligence.risk)}`,
      `Pressure:  ${season.nodePressure}`,
      `Grade:     ${grade} — ${gradeCfg.label}`,
      `Score:     ${finalScore.toFixed(3)}`,
      `Seed:      ${seed}`,
      `Hash:      ${auditHash}`,
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ...causes.map(c => `${c.icon} ${c.text}`),
      '',
      'Play PZO at density6.com',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch { /* ignore */ }
  }, [tick, regime, intelligence, season, grade, gradeCfg, finalScore, seed, auditHash, causes]);

  return (
    <div style={{
      minHeight: '100dvh', background: T.void, color: T.text,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'flex-start', padding: '32px 16px 48px',
      fontFamily: T.display,
      position: 'relative', overflow: 'hidden',
    }}>
      <style>{FONT_IMPORT}</style>
      <style>{`
        @keyframes pzo-dot-ping {
          0%   { opacity: 0.8; transform: scale(1); }
          100% { opacity: 0;   transform: scale(2.4); }
        }
        @keyframes pzo-fade-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pzo-glow-pulse {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 0.8; }
        }
      `}</style>

      {/* ── Background radial glow ── */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(255,77,77,0.08) 0%, transparent 70%)',
        animation: 'pzo-glow-pulse 4s ease-in-out infinite',
      }} />

      <div style={{
        width: '100%', maxWidth: 600,
        display: 'flex', flexDirection: 'column', gap: 20,
        animation: 'pzo-fade-up 0.5s ease-out both',
        position: 'relative', zIndex: 1,
      }}>

        {/* ── Hero ── */}
        <div style={{ textAlign: 'center', paddingTop: 8 }}>
          <div style={{
            fontFamily: T.display, fontSize: 'clamp(52px, 14vw, 80px)',
            fontWeight: 800, color: T.red, lineHeight: 0.9,
            textShadow: '0 0 60px rgba(255,77,77,0.40)',
            letterSpacing: '-0.02em',
          }}>
            BANKRUPT
          </div>
          <div style={{
            fontFamily: T.mono, fontSize: 12, color: T.textSub, marginTop: 14,
            letterSpacing: '0.06em',
          }}>
            Cash hit zero · Tick {tick} · Seed {seed}
          </div>
        </div>

        {/* ── Grade ── */}
        <div style={{
          background: gradeCfg.bg, border: `1px solid ${gradeCfg.border}`,
          borderRadius: 14, padding: '16px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12,
        }}>
          <div>
            <div style={{
              fontFamily: T.mono, fontSize: 9, color: T.textMut,
              textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6,
            }}>
              Final Grade · {OUTCOME_MULTIPLIERS.BANKRUPT}× multiplier
            </div>
            <div style={{
              fontFamily: T.display, fontSize: 32, fontWeight: 800,
              color: gradeCfg.color, lineHeight: 1,
              textShadow: `0 0 20px ${gradeCfg.color}55`,
            }}>
              {grade}
              <span style={{
                fontFamily: T.display, fontSize: 16, fontWeight: 600,
                color: gradeCfg.color, marginLeft: 10, opacity: 0.7,
              }}>
                {gradeCfg.label}
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: T.mono, fontSize: 9, color: T.textMut, marginBottom: 4 }}>
              Sovereignty Score
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 24, fontWeight: 800, color: gradeCfg.color }}>
              {finalScore.toFixed(3)}
            </div>
          </div>
        </div>

        {/* ── Sparkline ── */}
        <div style={{
          background: T.card, border: `1px solid rgba(255,77,77,0.25)`,
          borderRadius: 14, padding: '16px 20px',
        }}>
          <div style={{
            fontFamily: T.mono, fontSize: 9, color: T.textMut,
            textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12,
          }}>
            Equity Flatline
          </div>
          <DeathSparkline data={equityHistory} />
        </div>

        {/* ── Cause of Death ── */}
        <div style={{
          background: T.redD, border: `1px solid rgba(255,77,77,0.30)`,
          borderRadius: 14, padding: '16px 20px',
        }}>
          <div style={{
            fontFamily: T.mono, fontSize: 9, fontWeight: 800,
            color: T.red, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 14,
          }}>
            ☠ Forensic Cause of Death
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {causes.map((c, i) => (
              <div key={i} style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                padding: '10px 12px',
                background: 'rgba(255,77,77,0.06)',
                borderRadius: 8, border: '1px solid rgba(255,77,77,0.12)',
              }}>
                <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.3 }}>{c.icon}</span>
                <span style={{ fontFamily: T.display, fontSize: 13, color: T.textSub, lineHeight: 1.5 }}>
                  {c.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Stats Grid ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 10,
        }}>
          <StatTile label="Regime"        value={regime}                    color={REGIME_COLOR[regime]} />
          <StatTile label="AI Risk"       value={pct(intelligence.risk)}   color={intelligence.risk > 0.7 ? T.red : T.orange} />
          <StatTile label="Node Pressure" value={String(season.nodePressure)} color={season.nodePressure > 10 ? T.red : T.yellow} />
          <StatTile label="Pass Tier"     value={`T${season.passTier}`}    color={T.indigo} />
          {activeBotIds && activeBotIds.length > 0 && (
            <StatTile label="Active Bots" value={String(activeBotIds.length)} color={T.orange} />
          )}
          {cascadeSeverity && (
            <StatTile label="Cascade"     value={cascadeSeverity}          color={cascadeSeverity === 'CATASTROPHIC' ? T.red : T.orange} />
          )}
        </div>

        {/* ── Last Events ── */}
        <div style={{
          background: T.card, border: `1px solid ${T.border}`,
          borderRadius: 14, padding: '16px 20px',
        }}>
          <div style={{
            fontFamily: T.mono, fontSize: 9, color: T.textMut,
            textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12,
          }}>
            Last Events Before Collapse
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {events.slice(-5).reverse().map((ev, i) => (
              <div key={i} style={{
                fontFamily: T.mono, fontSize: 11,
                color: i === 0 ? T.red : T.textSub,
                padding: '6px 10px',
                background: i === 0 ? 'rgba(255,77,77,0.08)' : 'transparent',
                borderRadius: 6,
                borderLeft: i === 0 ? `2px solid ${T.red}` : '2px solid transparent',
              }}>
                {i === 0 && '▶ '}{ev}
              </div>
            ))}
          </div>
        </div>

        {/* ── Audit + Actions ── */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: T.mono, fontSize: 9, color: T.textMut,
              textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6,
            }}>
              Audit Hash · Deterministically Replayable
            </div>
            <div style={{
              fontFamily: T.mono, fontSize: 14, color: T.textSub,
              letterSpacing: '0.12em', fontWeight: 600,
            }}>
              {auditHash}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <button
              onClick={handleShare}
              style={{
                flex: 1, padding: '15px 20px', borderRadius: 12, cursor: 'pointer',
                fontFamily: T.mono, fontSize: 11, fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: '0.10em',
                background: copied ? 'rgba(34,221,136,0.15)' : T.cardHi,
                border: copied
                  ? '1px solid rgba(34,221,136,0.50)'
                  : `1px solid ${T.borderM}`,
                color: copied ? T.green : T.textSub,
                transition: 'all 0.2s',
                minHeight: 52,
              }}
            >
              {copied ? '✓ Copied' : '📋 Share Run'}
            </button>

            <button
              onClick={onPlayAgain}
              style={{
                flex: 2, padding: '15px 20px', borderRadius: 12, cursor: 'pointer',
                fontFamily: T.display, fontSize: 15, fontWeight: 800,
                background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                border: '1px solid rgba(129,140,248,0.50)',
                color: T.text,
                boxShadow: '0 6px 24px rgba(79,70,229,0.35)',
                transition: 'transform 0.15s, box-shadow 0.15s',
                minHeight: 52,
              }}
              onMouseEnter={e => {
                (e.target as HTMLElement).style.transform = 'scale(1.02)';
                (e.target as HTMLElement).style.boxShadow = '0 8px 30px rgba(79,70,229,0.50)';
              }}
              onMouseLeave={e => {
                (e.target as HTMLElement).style.transform = 'scale(1)';
                (e.target as HTMLElement).style.boxShadow = '0 6px 24px rgba(79,70,229,0.35)';
              }}
            >
              ⚡ Try Again
            </button>
          </div>
        </div>

        <div style={{
          fontFamily: T.mono, fontSize: 9, color: T.textMut,
          textAlign: 'center', letterSpacing: '0.08em',
        }}>
          Seed {seed} · Tick {tick} · Multiplier {bankruptMultiplier}× · Point Zero One by Density6
        </div>
      </div>
    </div>
  );
});