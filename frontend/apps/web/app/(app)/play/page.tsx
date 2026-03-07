'use client';
/**
 * page.tsx — (app)/play — POINT ZERO ONE
 * Canonical lobby + run-bootstrap. LobbyScreen.tsx is now retired.
 *
 * Ported from: pzo-web/src/components/LobbyScreen.tsx
 * Auth-aware · 20M-user ready · Mobile-first
 * Typography: DM Mono / Barlow Condensed / DM Sans (via CSS variables from layout)
 *
 * FILE LOCATION: frontend/apps/web/app/(app)/play/page.tsx
 * Density6 LLC · Confidential
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import GoalTemplatePicker from './GoalTemplatePicker';
import ProfileTemplatePicker from './ProfileTemplatePicker';
import LobbyChatWidget from '../../../components/chat/LobbyChatWidget';
const GoalTemplatePickerAny = GoalTemplatePicker as any;
const ProfileTemplatePickerAny = ProfileTemplatePicker as any;

// ─── Run types (previously imported from ModeRouter) ─────────────────────────

export type RunMode = 'solo' | 'asymmetric-pvp' | 'co-op' | 'ghost';

export interface RunConfig {
  mode:          RunMode;
  userId:        string;
  username:      string;
  seedOverride?: number;
  goalTemplate?: string;
  profileTemplate?: string;
  deckConfig: {
    enabledDeckTypes: string[];
  };
}

export interface RunContext {
  runId:      string;
  mode:       RunMode;
  config:     RunConfig;
  startedAt:  number;
  seed:       number;
}

// ─── Design tokens — zinc/indigo terminal system ──────────────────────────────

const T = {
  void:      '#030308',
  surface:   '#0A0A16',
  card:      '#0F0F20',
  cardHi:    '#151530',
  border:    'rgba(255,255,255,0.07)',
  borderM:   'rgba(255,255,255,0.13)',
  text:      '#F0F0FF',
  textSub:   '#B8B8D8',
  textDim:   '#6A6A90',
  textMut:   '#3A3A58',
  indigo:    '#818CF8',
  indigoBrd: 'rgba(99,102,241,0.28)',
  indigoDim: 'rgba(99,102,241,0.10)',
  mono:      'var(--font-dm-mono, "DM Mono", "JetBrains Mono", monospace)',
  display:   'var(--font-barlow, "Barlow Condensed", "Oswald", Impact, system-ui, sans-serif)',
  body:      'var(--font-dm-sans, "DM Sans", system-ui, sans-serif)',
};

// ─── Mode definitions (ported from LobbyScreen.tsx) ──────────────────────────

const MODES = {
  solo: {
    id:        'solo' as RunMode,
    label:     'EMPIRE',
    badge:     'SOLO',
    tagline:   'Build income that works while you sleep — or lose everything.',
    accent:    '#F5C842',
    accentRgb: '245,200,66',
    bg:        'linear-gradient(135deg, #0A0800 0%, #0E0C00 60%, #080600 100%)',
    emoji:     '⚡',
    desc:      'Most people spend 40 years trading hours for dollars and never break the cycle. EMPIRE gives you 12 minutes to do what most never figure out — build something that pays you whether you show up or not.',
    features: [
      { icon: '💸', text: 'Your money must work for you — automatically' },
      { icon: '🎯', text: 'Every decision has a permanent, irreversible cost' },
      { icon: '🌊', text: "The market doesn't care about you — adapt or collapse" },
      { icon: '🔥', text: 'No safety net. Zero resets. Exactly like real life.' },
    ],
    cta:   'START BUILDING',
    quote: '"Every wealthy person built something that pays them while they sleep."',
  },
  'asymmetric-pvp': {
    id:        'asymmetric-pvp' as RunMode,
    label:     'PREDATOR',
    badge:     '1v1',
    tagline:   'Learn to recognize when someone is attacking your money.',
    accent:    '#FF4D4D',
    accentRgb: '255,77,77',
    bg:        'linear-gradient(135deg, #0D0000 0%, #120000 60%, #080000 100%)',
    emoji:     '⚔️',
    desc:      "The market isn't neutral — and neither are the people around you. PREDATOR trains you to smell the attack before it lands, absorb the hit, and keep building while they're still swinging.",
    features: [
      { icon: '⚔️', text: 'See the attack before it lands — react in seconds' },
      { icon: '💣', text: 'Your income stream is a live target at all times' },
      { icon: '🛡️', text: 'Defense is half the game. Master both under fire.' },
      { icon: '📈', text: 'Success attracts resistance — just like real scaling' },
    ],
    cta:   'BECOME UNBREAKABLE',
    quote: '"The wealthy aren\'t just good at making money. They\'re impossible to tear down."',
  },
  'co-op': {
    id:        'co-op' as RunMode,
    label:     'SYNDICATE',
    badge:     '2P CO-OP',
    tagline:   'Your financial circle determines your financial ceiling.',
    accent:    '#00D4B8',
    accentRgb: '0,212,184',
    bg:        'linear-gradient(135deg, #000E0C 0%, #001410 60%, #000908 100%)',
    emoji:     '🤝',
    desc:      "Your net worth reflects the 5 people closest to you — whether you like it or not. SYNDICATE makes that literal. You and your partner share one economy. Their blind spots drain your account.",
    features: [
      { icon: '🤝', text: "You're only as strong as who you build with" },
      { icon: '🆘', text: 'Real loyalty gets tested under financial pressure' },
      { icon: '📜', text: 'Negotiate aid contracts like your future depends on it' },
      { icon: '🏆', text: 'Both survive or neither wins — no individual glory' },
    ],
    cta:   'BUILD THE ALLIANCE',
    quote: '"The person you choose to build with will either multiply your wealth — or quietly drain it."',
  },
  ghost: {
    id:        'ghost' as RunMode,
    label:     'PHANTOM',
    badge:     'GHOST RUN',
    tagline:   'Find out exactly where your thinking falls short.',
    accent:    '#A855F7',
    accentRgb: '168,85,247',
    bg:        'linear-gradient(135deg, #08000E 0%, #0B0014 60%, #060009 100%)',
    emoji:     '👻',
    desc:      "There's a version of you that made all the right calls. PHANTOM lets you race a verified champion who played the exact same market — same starting position, same events, same forces working against you.",
    features: [
      { icon: '👻', text: 'Watch how a champion thinks, live — tick by tick' },
      { icon: '🎯', text: 'Same market, same shocks. The only variable is you.' },
      { icon: '📊', text: 'Track your thinking gaps against elite decisions' },
      { icon: '🏅', text: 'Beat a champion and earn a permanent proof badge' },
    ],
    cta:   'FACE YOUR GHOST',
    quote: '"You don\'t rise to your goals. You fall to the level of your decisions."',
  },
} as const;

type ModeKey = keyof typeof MODES;

// ─── Run config builder (ported from LobbyScreen.tsx) ────────────────────────

function buildRunConfig(
  modeKey:         ModeKey,
  goalTemplate?:   string | null,
  profileTemplate?: string | null,
): RunConfig {
  return {
    mode:            MODES[modeKey].id,
    userId:          'anonymous',
    username:        'PLAYER_1',
    seedOverride:    undefined,
    goalTemplate:    goalTemplate ?? undefined,
    profileTemplate: profileTemplate ?? undefined,
    deckConfig: {
      enabledDeckTypes: ['OPPORTUNITY', 'IPA', 'FUBAR', 'MISSED_OPPORTUNITY', 'PRIVILEGED', 'SO'],
    },
  };
}

// ─── Local run launcher (replaces ModeRouter.startRunWithCards) ───────────────

async function startRun(mode: RunMode, config: RunConfig): Promise<RunContext> {
  // Deterministic seed: timestamp XOR userId hash (mirrors ModeRouter logic)
  const seed = Date.now() ^ config.username.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const runId = `${mode}-${seed.toString(36)}`;

  // TODO: replace with real ModeRouter.startRunWithCards() call once
  // pzo-web engine is extracted into a shared package under
  // frontend/packages/engine
  return {
    runId,
    mode,
    config,
    startedAt: Date.now(),
    seed,
  };
}

// ─── Particle Field ───────────────────────────────────────────────────────────

function ParticleField({ accentRgb }: { accentRgb: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);
  const dotsRef   = useRef<Array<{ x: number; y: number; vx: number; vy: number; r: number }>>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let W = 0, H = 0;

    const resize = () => {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
      dotsRef.current = Array.from({ length: 55 }, () => ({
        x:  Math.random() * W,
        y:  Math.random() * H,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r:  Math.random() * 1.8 + 0.4,
      }));
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const dots = dotsRef.current;
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x;
          const dy = dots[i].y - dots[j].y;
          const d  = Math.hypot(dx, dy);
          if (d < 130) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(${accentRgb},${0.10 * (1 - d / 130)})`;
            ctx.lineWidth   = 0.6;
            ctx.moveTo(dots[i].x, dots[i].y);
            ctx.lineTo(dots[j].x, dots[j].y);
            ctx.stroke();
          }
        }
        ctx.beginPath();
        ctx.arc(dots[i].x, dots[i].y, dots[i].r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${accentRgb},0.45)`;
        ctx.fill();
        dots[i].x += dots[i].vx;
        dots[i].y += dots[i].vy;
        if (dots[i].x < 0 || dots[i].x > W) dots[i].vx *= -1;
        if (dots[i].y < 0 || dots[i].y > H) dots[i].vy *= -1;
      }
      animRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [accentRgb]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}

// ─── Phase enum ───────────────────────────────────────────────────────────────

type Phase = 'mode-select' | 'configure' | 'launching';

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PlayPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  // Resolve initial mode from URL query param (e.g. /play?mode=co-op)
  const initMode = (): ModeKey => {
    const m = searchParams.get('mode') as ModeKey | null;
    return m && m in MODES ? m : 'solo';
  };

  const [selected,         setSelected]         = useState<ModeKey>(initMode);
  const [phase,            setPhase]            = useState<Phase>('mode-select');
  const [animating,        setAnimating]        = useState(false);
  const [visible,          setVisible]          = useState(false);
  const [ctaPulse,         setCtaPulse]         = useState(false);
  const [launching,        setLaunching]        = useState(false);
  const [launchErr,        setLaunchErr]        = useState<string | null>(null);
  const [goalTemplate,     setGoalTemplate]     = useState<string | null>(null);
  const [profileTemplate,  setProfileTemplate]  = useState<string | null>(null);

  const mode       = MODES[selected];
  const canLaunch  = goalTemplate !== null && profileTemplate !== null;

  // Entrance animation
  useEffect(() => { setTimeout(() => setVisible(true), 80); }, []);

  // CTA pulse
  useEffect(() => {
    const id = setInterval(() => {
      setCtaPulse(true);
      setTimeout(() => setCtaPulse(false), 700);
    }, 3500);
    return () => clearInterval(id);
  }, []);

  // ── Mode switch ──────────────────────────────────────────────────────────────
  const switchMode = useCallback((key: ModeKey) => {
    if (key === selected || phase !== 'mode-select') return;
    setAnimating(true);
    setTimeout(() => { setSelected(key); setAnimating(false); }, 160);
  }, [selected, phase]);

  // ── Advance to configure phase ────────────────────────────────────────────
  const handleConfigure = useCallback(() => {
    setPhase('configure');
  }, []);

  // ── Launch run ────────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    if (launching || !canLaunch) return;
    setLaunching(true);
    setLaunchErr(null);
    setPhase('launching');

    try {
      const config  = buildRunConfig(selected, goalTemplate, profileTemplate);
      const ctx     = await startRun(mode.id, config);

      // Navigate to game session. RunContext stored in sessionStorage for the
      // game page to read — avoids query-string pollution with large payloads.
      sessionStorage.setItem('pzo_run_ctx', JSON.stringify(ctx));
      // Strategy A: game runs inside Next.js via @pzo/engine
      router.push(`/game?runId=${ctx.runId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown launch error';
      console.error('[PlayPage] startRun failed:', err);
      setLaunchErr(message);
      setLaunching(false);
      setPhase('configure');
    }
  }, [launching, canLaunch, selected, goalTemplate, profileTemplate, mode.id, router]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        overflow: 'hidden',
        background: mode.bg,
        fontFamily: T.body,
        transition: 'background 0.5s ease',
      }}
    >
      {/* Particle field */}
      <ParticleField accentRgb={mode.accentRgb} />

      {/* Radial accent glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse 70% 55% at 50% 35%, rgba(${mode.accentRgb},0.07) 0%, transparent 70%)`,
        transition: 'background 0.5s ease',
      }} />

      {/* Film grain */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.018,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: '180px',
      }} />

      {/* ── Content shell ─────────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative', zIndex: 10, minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: 'clamp(24px, 5vw, 48px) clamp(16px, 4vw, 32px)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : 'translateY(18px)',
        transition: 'opacity 0.55s ease, transform 0.55s ease',
      }}>

        {/* ── Header ── */}
        <header style={{
          textAlign: 'center', width: '100%', maxWidth: 900,
          marginBottom: 'clamp(28px, 5vw, 48px)',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase',
            color: mode.accent, fontFamily: T.mono, fontWeight: 600,
            padding: '6px 16px', borderRadius: 100,
            border: `1px solid rgba(${mode.accentRgb},0.35)`,
            background: `rgba(${mode.accentRgb},0.08)`,
            marginBottom: 20, transition: 'all 0.5s ease',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: mode.accent, display: 'inline-block',
            }} />
            Master This Game. Master Real Money.
          </div>

          <h1 style={{
            fontSize: 'clamp(3.2rem, 12vw, 7.5rem)', fontWeight: 900,
            lineHeight: 0.92, letterSpacing: '-0.04em', color: T.text,
            fontFamily: T.display, margin: 0,
          }}>
            POINT{' '}
            <span style={{
              color: mode.accent,
              textShadow: `0 0 60px rgba(${mode.accentRgb},0.6), 0 0 120px rgba(${mode.accentRgb},0.3)`,
              transition: 'all 0.5s ease',
            }}>
              ZERO ONE
            </span>
          </h1>

          <p style={{
            marginTop: 16, color: T.textSub,
            fontSize: 'clamp(11px, 2vw, 13px)',
            letterSpacing: '0.14em', textTransform: 'uppercase',
            fontFamily: T.mono,
          }}>
            Most people never figure out why their money disappears. You&apos;re about to.
          </p>
        </header>

        {/* ═══════════════════════════════════════════════════════════════════════
            PHASE: MODE SELECT
        ═══════════════════════════════════════════════════════════════════════ */}
        {phase === 'mode-select' && (
          <>
            {/* ── Mode Tabs ── */}
            <nav style={{
              display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
              gap: 8, marginBottom: 'clamp(20px, 4vw, 36px)',
            }}>
              {(Object.values(MODES) as typeof MODES[ModeKey][]).map((m) => {
                const active = selected === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => switchMode(m.id as ModeKey)}
                    style={{
                      padding: '10px 20px', borderRadius: 8, cursor: 'pointer',
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.2em',
                      textTransform: 'uppercase', fontFamily: T.mono,
                      color:      active ? m.accent   : T.textSub,
                      background: active ? `rgba(${m.accentRgb},0.12)` : 'rgba(255,255,255,0.03)',
                      border:     `1px solid ${active ? `rgba(${m.accentRgb},0.45)` : T.border}`,
                      boxShadow:  active
                        ? `0 0 20px rgba(${m.accentRgb},0.25), inset 0 0 16px rgba(${m.accentRgb},0.06)`
                        : 'none',
                      transform:  active ? 'scale(1.04)' : 'scale(1)',
                      transition: 'all 0.25s ease',
                      minHeight: 42, minWidth: 90,
                    }}
                  >
                    {m.emoji} {m.badge}
                  </button>
                );
              })}
            </nav>

            {/* ── Mode Card ── */}
            <div style={{
              width: '100%', maxWidth: 960, borderRadius: 16,
              border: `1px solid rgba(${mode.accentRgb},0.20)`,
              background: `linear-gradient(135deg, rgba(${mode.accentRgb},0.07) 0%, rgba(15,15,32,0.95) 100%)`,
              backdropFilter: 'blur(16px)',
              opacity:   animating ? 0 : 1,
              transform: animating ? 'translateY(10px)' : 'none',
              transition: 'opacity 0.18s ease, transform 0.18s ease, border-color 0.5s ease',
              overflow: 'hidden',
            }}>
              {/* accent top bar */}
              <div style={{
                height: 2, width: '100%',
                background: `linear-gradient(90deg, transparent, ${mode.accent}, rgba(${mode.accentRgb},0.5), transparent)`,
              }} />

              <div style={{ padding: 'clamp(20px, 5vw, 40px)' }}>

                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: 24,
                  justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28,
                }}>
                  <div>
                    <div style={{
                      fontSize: 10, fontFamily: T.mono, fontWeight: 700,
                      letterSpacing: '0.3em', textTransform: 'uppercase',
                      color: mode.accent, marginBottom: 8,
                    }}>
                      {mode.emoji} {mode.badge}
                    </div>
                    <h2 style={{
                      fontSize: 'clamp(2.8rem, 7vw, 4.5rem)', fontWeight: 900,
                      color: T.text, lineHeight: 0.9, letterSpacing: '-0.03em',
                      textShadow: `0 0 40px rgba(${mode.accentRgb},0.35)`,
                      fontFamily: T.display, margin: 0,
                    }}>
                      {mode.label}
                    </h2>
                    <p style={{ color: T.textSub, fontSize: 15, marginTop: 10, fontWeight: 500, fontFamily: T.body }}>
                      {mode.tagline}
                    </p>
                  </div>

                  <blockquote style={{
                    maxWidth: 280, margin: 0, fontSize: 13, lineHeight: 1.65,
                    color: '#8888AA', fontStyle: 'italic',
                    borderLeft: `2px solid rgba(${mode.accentRgb},0.35)`,
                    paddingLeft: 16, fontFamily: T.body,
                  }}>
                    {mode.quote}
                  </blockquote>
                </div>

                <p style={{
                  fontSize: 'clamp(14px, 2vw, 16px)', lineHeight: 1.75,
                  color: '#CCCCDD', marginBottom: 28, maxWidth: 700,
                  fontFamily: T.body,
                }}>
                  {mode.desc}
                </p>

                <div style={{
                  display: 'grid', gap: 10, marginBottom: 32,
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                }}>
                  {mode.features.map((f) => (
                    <div
                      key={f.text}
                      style={{
                        padding: '14px 16px', borderRadius: 10,
                        border: `1px solid rgba(${mode.accentRgb},0.15)`,
                        background: `rgba(${mode.accentRgb},0.05)`,
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                      }}
                    >
                      <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{f.icon}</span>
                      <span style={{ fontSize: 13, lineHeight: 1.5, color: '#C8C8E0', fontWeight: 500, fontFamily: T.body }}>
                        {f.text}
                      </span>
                    </div>
                  ))}
                </div>

                {/* ── CTA ── */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
                  <button
                    type="button"
                    onClick={handleConfigure}
                    style={{
                      padding: 'clamp(12px, 2vw, 16px) clamp(28px, 5vw, 52px)',
                      borderRadius: 12, cursor: 'pointer', border: 'none',
                      background: mode.accent, color: '#000000',
                      fontSize: 'clamp(14px, 2vw, 16px)', fontWeight: 900,
                      letterSpacing: '0.12em', textTransform: 'uppercase',
                      fontFamily: T.display, minHeight: 52,
                      boxShadow: ctaPulse
                        ? `0 0 60px rgba(${mode.accentRgb},0.8), 0 0 120px rgba(${mode.accentRgb},0.4)`
                        : `0 0 24px rgba(${mode.accentRgb},0.35)`,
                      transform:  ctaPulse ? 'scale(1.03)' : 'scale(1)',
                      transition: 'box-shadow 0.35s ease, transform 0.2s ease',
                    }}
                  >
                    {mode.cta}
                  </button>

                  <p style={{
                    color: T.textMut, fontSize: 12, fontFamily: T.mono,
                    letterSpacing: '0.05em', lineHeight: 1.5, maxWidth: 260,
                  }}>
                    No saving. No pausing. No excuses.<br />Just like real money.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            PHASE: CONFIGURE (goal + profile pickers)
        ═══════════════════════════════════════════════════════════════════════ */}
        {phase === 'configure' && (
          <div style={{
            width: '100%', maxWidth: 960,
            display: 'flex', flexDirection: 'column', gap: 24,
          }}>
            {/* Back button */}
            <button
              type="button"
              onClick={() => { setPhase('mode-select'); setGoalTemplate(null); setProfileTemplate(null); }}
              style={{
                alignSelf: 'flex-start',
                padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${T.border}`,
                color: T.textDim, fontSize: 11, fontFamily: T.mono,
                letterSpacing: '0.1em', textTransform: 'uppercase',
              }}
            >
              ← Back to modes
            </button>

            {/* Mode pill reminder */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 18px', borderRadius: 10,
              border: `1px solid rgba(${mode.accentRgb},0.25)`,
              background: `rgba(${mode.accentRgb},0.07)`,
              width: 'fit-content',
            }}>
              <span style={{ fontSize: 18 }}>{mode.emoji}</span>
              <div>
                <div style={{ fontSize: 10, fontFamily: T.mono, letterSpacing: '0.2em', color: mode.accent, textTransform: 'uppercase' }}>
                  Selected mode
                </div>
                <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: 20, color: T.text, lineHeight: 1 }}>
                  {mode.label}
                </div>
              </div>
            </div>

            <GoalTemplatePickerAny
              onSelect={setGoalTemplate}
              selected={goalTemplate}
              accentRgb={mode.accentRgb}
              accent={mode.accent}
            />

            <ProfileTemplatePickerAny
              onSelect={setProfileTemplate}
              selected={profileTemplate}
              accentRgb={mode.accentRgb}
              accent={mode.accent}
            />

            {/* Launch row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
              <button
                type="button"
                onClick={handleStart}
                disabled={!canLaunch}
                style={{
                  padding: 'clamp(12px, 2vw, 16px) clamp(28px, 5vw, 52px)',
                  borderRadius: 12,
                  cursor: canLaunch ? 'pointer' : 'not-allowed',
                  border: 'none',
                  background: canLaunch ? mode.accent : 'rgba(255,255,255,0.08)',
                  color: canLaunch ? '#000000' : T.textDim,
                  fontSize: 'clamp(14px, 2vw, 16px)', fontWeight: 900,
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  fontFamily: T.display, minHeight: 52,
                  opacity: canLaunch ? 1 : 0.45,
                  transition: 'all 0.2s ease',
                  boxShadow: canLaunch ? `0 0 24px rgba(${mode.accentRgb},0.35)` : 'none',
                }}
              >
                {launching ? '⏳ LAUNCHING RUN...' : 'CONFIRM & START RUN'}
              </button>

              {!canLaunch && (
                <p style={{ color: T.textDim, fontSize: 11, fontFamily: T.mono, letterSpacing: '0.06em' }}>
                  Select a goal and profile to continue
                </p>
              )}
            </div>

            {launchErr && (
              <div style={{
                padding: '10px 14px', borderRadius: 8,
                background: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.28)',
                fontSize: 11, fontFamily: T.mono, color: '#FF7070',
              }}>
                ⚠ Launch failed: {launchErr}. Check console for details.
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            PHASE: LAUNCHING
        ═══════════════════════════════════════════════════════════════════════ */}
        {phase === 'launching' && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
            marginTop: 60,
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              border: `3px solid rgba(${mode.accentRgb},0.2)`,
              borderTopColor: mode.accent,
              animation: 'spin 0.9s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ fontFamily: T.mono, fontSize: 12, color: mode.accent, letterSpacing: '0.3em' }}>
              INITIALIZING {mode.label}...
            </div>
          </div>
        )}

        {/* ── Stats Strip ── */}
        {phase === 'mode-select' && (
          <footer style={{
            width: '100%', maxWidth: 960, marginTop: 24,
            borderRadius: 12, padding: 'clamp(16px, 3vw, 20px) clamp(20px, 4vw, 40px)',
            border: `1px solid rgba(255,255,255,0.06)`,
            background: 'rgba(10,10,22,0.7)',
            display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px 40px',
          }}>
            {([
              ['12 Min',    'To change how you see money'],
              ['4 Modes',   'Each teaches a real wealth principle'],
              ['No Resets', 'Every decision has permanent weight'],
              ['Real Rules','Same principles as actual wealth building'],
              ['Elite Proof','Beat a champion and earn it forever'],
            ] as [string, string][]).map(([val, label]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: 'clamp(1.1rem, 3vw, 1.5rem)', fontWeight: 800,
                  color: mode.accent, fontFamily: T.display, letterSpacing: '-0.02em',
                  transition: 'color 0.5s ease',
                }}>
                  {val}
                </div>
                <div style={{
                  color: T.textMut, fontSize: 10, fontFamily: T.mono,
                  letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 3,
                }}>
                  {label}
                </div>
              </div>
            ))}
          </footer>
        )}

        <div style={{
          marginTop: 24, textAlign: 'center',
          fontSize: 10, fontFamily: T.mono,
          color: T.textMut, letterSpacing: '0.08em',
        }}>
          ⚖️ &ldquo;The 1% is not a destination. It&apos;s an invitation list.&rdquo;
          <span style={{ display: 'block', marginTop: 4, fontSize: 9, color: '#2a2a40' }}>
            — STATUS_QUO_ML
          </span>
        </div>

      </div>

      {/* ── Sovereign Chat — alive from the moment you log in ─────────────── */}
      <LobbyChatWidget
        selectedMode={selected}
        accent={mode.accent}
        accentRgb={mode.accentRgb}
      />

    </div>
  );
}