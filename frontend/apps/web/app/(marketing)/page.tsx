'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

type RunMode = 'solo' | 'asymmetric-pvp' | 'co-op' | 'ghost';

const T = {
  void: '#030308',
  text: '#F0F0FF',
  textSub: '#B8B8D8',
  textDim: '#6A6A90',
  textMut: '#3A3A58',
  border: 'rgba(255,255,255,0.07)',
  indigo: '#818CF8',
  indigoBrd: 'rgba(99,102,241,0.28)',
  indigoDim: 'rgba(99,102,241,0.10)',
  mono: 'var(--font-dm-mono, "DM Mono", monospace)',
  display: 'var(--font-barlow, "Barlow Condensed", system-ui, sans-serif)',
  body: 'var(--font-dm-sans, "DM Sans", system-ui, sans-serif)',
} as const;

function ParticleField({ accentRgb }: { accentRgb: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const dotsRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; r: number }>>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;

    const resize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      dotsRef.current = Array.from({ length: 55 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.8 + 0.4,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const dots = dotsRef.current;

      for (let i = 0; i < dots.length; i += 1) {
        for (let j = i + 1; j < dots.length; j += 1) {
          const dx = dots[i].x - dots[j].x;
          const dy = dots[i].y - dots[j].y;
          const distance = Math.hypot(dx, dy);

          if (distance < 130) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(${accentRgb},${0.1 * (1 - distance / 130)})`;
            ctx.lineWidth = 0.6;
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

        if (dots[i].x < 0 || dots[i].x > width) dots[i].vx *= -1;
        if (dots[i].y < 0 || dots[i].y > height) dots[i].vy *= -1;
      }

      animRef.current = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [accentRgb]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
}

const MODES = {
  solo: {
    id: 'solo' as RunMode,
    label: 'EMPIRE',
    badge: 'SOLO',
    emoji: '⚡',
    tagline: 'Build income that works while you sleep — or lose everything.',
    accent: '#F5C842',
    accentRgb: '245,200,66',
    bg: 'linear-gradient(135deg, #0A0800 0%, #0E0C00 60%, #080600 100%)',
    desc: 'Most people spend 40 years trading hours for dollars and never break the cycle. EMPIRE gives you 12 minutes to do what most never figure out — build something that pays you whether you show up or not.',
    features: [
      { icon: '💸', text: 'Your money must work for you — automatically' },
      { icon: '🎯', text: 'Every decision has a permanent, irreversible cost' },
      { icon: '🌊', text: "The market doesn't care about you — adapt or collapse" },
      { icon: '🔥', text: 'No safety net. Zero resets. Exactly like real life.' },
    ],
    cta: 'START BUILDING',
    quote: '"Every wealthy person built something that pays them while they sleep."',
  },
  'asymmetric-pvp': {
    id: 'asymmetric-pvp' as RunMode,
    label: 'PREDATOR',
    badge: '1v1',
    emoji: '⚔️',
    tagline: 'Learn to recognize when someone is attacking your money.',
    accent: '#FF4D4D',
    accentRgb: '255,77,77',
    bg: 'linear-gradient(135deg, #0D0000 0%, #120000 60%, #080000 100%)',
    desc: "The market isn't neutral — and neither are the people around you. PREDATOR trains you to smell the attack before it lands, absorb the hit, and keep building while they're still swinging.",
    features: [
      { icon: '⚔️', text: 'See the attack before it lands — react in seconds' },
      { icon: '💣', text: 'Your income stream is a live target at all times' },
      { icon: '🛡️', text: 'Defense is half the game. Master both under fire.' },
      { icon: '📈', text: 'Success attracts resistance — just like real scaling' },
    ],
    cta: 'BECOME UNBREAKABLE',
    quote: `"The wealthy aren't just good at making money. They're impossible to tear down."`,
  },
  'co-op': {
    id: 'co-op' as RunMode,
    label: 'SYNDICATE',
    badge: '2P CO-OP',
    emoji: '🤝',
    tagline: 'Your financial circle determines your financial ceiling.',
    accent: '#00D4B8',
    accentRgb: '0,212,184',
    bg: 'linear-gradient(135deg, #000E0C 0%, #001410 60%, #000908 100%)',
    desc: "Your net worth reflects the 5 people closest to you — whether you like it or not. SYNDICATE makes that literal. You and your partner share one economy. Their blind spots drain your account.",
    features: [
      { icon: '🤝', text: "You're only as strong as who you build with" },
      { icon: '🆘', text: 'Real loyalty gets tested under financial pressure' },
      { icon: '📜', text: 'Negotiate aid contracts like your future depends on it' },
      { icon: '🏆', text: 'Both survive or neither wins — no individual glory' },
    ],
    cta: 'BUILD THE ALLIANCE',
    quote: '"The person you choose to build with will either multiply your wealth — or quietly drain it."',
  },
  ghost: {
    id: 'ghost' as RunMode,
    label: 'PHANTOM',
    badge: 'GHOST RUN',
    emoji: '👻',
    tagline: 'Find out exactly where your thinking falls short.',
    accent: '#A855F7',
    accentRgb: '168,85,247',
    bg: 'linear-gradient(135deg, #08000E 0%, #0B0014 60%, #060009 100%)',
    desc: "There's a version of you that made all the right calls. PHANTOM lets you race a verified champion who played the exact same market — same starting position, same events, same forces working against you.",
    features: [
      { icon: '👻', text: 'Watch how a champion thinks, live — tick by tick' },
      { icon: '🎯', text: 'Same market, same shocks. The only variable is you.' },
      { icon: '📊', text: 'Track your thinking gaps against elite decisions' },
      { icon: '🏅', text: 'Beat a champion and earn a permanent proof badge' },
    ],
    cta: 'FACE YOUR GHOST',
    quote: `"You don't rise to your goals. You fall to the level of your decisions."`,
  },
} as const;

type ModeKey = keyof typeof MODES;

export default function LobbyPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<ModeKey>('solo');
  const [animating, setAnimating] = useState(false);
  const [visible, setVisible] = useState(false);
  const [ctaPulse, setCtaPulse] = useState(false);

  const mode = MODES[selected];

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setVisible(true), 80);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCtaPulse(true);
      window.setTimeout(() => setCtaPulse(false), 700);
    }, 3500);

    return () => window.clearInterval(intervalId);
  }, []);

  const switchMode = useCallback((key: ModeKey) => {
    if (key === selected) return;

    setAnimating(true);

    window.setTimeout(() => {
      setSelected(key);
      setAnimating(false);
    }, 160);
  }, [selected]);

  const handleStart = useCallback((modeId: RunMode) => {
    router.push(`/play?mode=${modeId}`);
  }, [router]);

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
      <ParticleField accentRgb={mode.accentRgb} />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: `radial-gradient(ellipse 70% 55% at 50% 35%, rgba(${mode.accentRgb},0.07) 0%, transparent 70%)`,
          transition: 'background 0.5s ease',
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: 0.018,
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
          backgroundSize: '180px',
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 20,
          zIndex: 30,
        }}
      >
        <Link
          href="/sign-in"
          style={{
            padding: '7px 16px',
            borderRadius: 8,
            background: T.indigoDim,
            border: `1px solid ${T.indigoBrd}`,
            fontFamily: T.mono,
            fontSize: 11,
            fontWeight: 700,
            color: T.indigo,
            letterSpacing: '0.08em',
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          SIGN IN →
        </Link>
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 10,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: 'clamp(24px, 5vw, 48px) clamp(16px, 4vw, 32px)',
          opacity: visible ? 1 : 0,
          transform: visible ? 'none' : 'translateY(18px)',
          transition: 'opacity 0.55s ease, transform 0.55s ease',
        }}
      >
        <header
          style={{
            textAlign: 'center',
            width: '100%',
            maxWidth: 900,
            marginBottom: 'clamp(28px, 5vw, 48px)',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: mode.accent,
              fontFamily: T.mono,
              fontWeight: 600,
              padding: '6px 16px',
              borderRadius: 100,
              border: `1px solid rgba(${mode.accentRgb},0.35)`,
              background: `rgba(${mode.accentRgb},0.08)`,
              marginBottom: 20,
              transition: 'all 0.5s ease',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: mode.accent,
                display: 'inline-block',
              }}
            />
            Master This Game. Master Real Money.
          </div>

          <h1
            style={{
              fontSize: 'clamp(3.2rem, 12vw, 7.5rem)',
              fontWeight: 900,
              lineHeight: 0.92,
              letterSpacing: '-0.04em',
              color: T.text,
              fontFamily: T.display,
              margin: 0,
            }}
          >
            POINT{' '}
            <span
              style={{
                color: mode.accent,
                textShadow: `0 0 60px rgba(${mode.accentRgb},0.6), 0 0 120px rgba(${mode.accentRgb},0.3)`,
                transition: 'all 0.5s ease',
              }}
            >
              ZERO ONE
            </span>
          </h1>

          <p
            style={{
              marginTop: 16,
              color: T.textSub,
              fontSize: 'clamp(11px, 2vw, 13px)',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              fontFamily: T.mono,
            }}
          >
            Most people never figure out why their money disappears. You&apos;re about to.
          </p>
        </header>

        <nav
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 'clamp(20px, 4vw, 36px)',
          }}
        >
          {(Object.values(MODES) as Array<(typeof MODES)[ModeKey]>).map((m) => {
            const active = selected === m.id;

            return (
              <button
                key={m.id}
                type="button"
                onClick={() => switchMode(m.id as ModeKey)}
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  fontFamily: T.mono,
                  color: active ? m.accent : T.textSub,
                  background: active ? `rgba(${m.accentRgb},0.12)` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${active ? `rgba(${m.accentRgb},0.45)` : T.border}`,
                  boxShadow: active
                    ? `0 0 20px rgba(${m.accentRgb},0.25), inset 0 0 16px rgba(${m.accentRgb},0.06)`
                    : 'none',
                  transform: active ? 'scale(1.04)' : 'scale(1)',
                  transition: 'all 0.25s ease',
                  minHeight: 42,
                  minWidth: 90,
                }}
              >
                {m.emoji} {m.badge}
              </button>
            );
          })}
        </nav>

        <div
          style={{
            width: '100%',
            maxWidth: 960,
            borderRadius: 16,
            border: `1px solid rgba(${mode.accentRgb},0.20)`,
            background: `linear-gradient(135deg, rgba(${mode.accentRgb},0.07) 0%, rgba(15,15,32,0.95) 100%)`,
            backdropFilter: 'blur(16px)',
            opacity: animating ? 0 : 1,
            transform: animating ? 'translateY(10px)' : 'none',
            transition: 'opacity 0.18s ease, transform 0.18s ease',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: 2,
              width: '100%',
              background: `linear-gradient(90deg, transparent, ${mode.accent}, rgba(${mode.accentRgb},0.5), transparent)`,
            }}
          />

          <div style={{ padding: 'clamp(20px, 5vw, 40px)' }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 24,
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 28,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontFamily: T.mono,
                    fontWeight: 700,
                    letterSpacing: '0.3em',
                    textTransform: 'uppercase',
                    color: mode.accent,
                    marginBottom: 8,
                  }}
                >
                  {mode.emoji} {mode.badge}
                </div>

                <h2
                  style={{
                    fontSize: 'clamp(2.8rem, 7vw, 4.5rem)',
                    fontWeight: 900,
                    color: T.text,
                    lineHeight: 0.9,
                    letterSpacing: '-0.03em',
                    textShadow: `0 0 40px rgba(${mode.accentRgb},0.35)`,
                    fontFamily: T.display,
                    margin: 0,
                  }}
                >
                  {mode.label}
                </h2>

                <p
                  style={{
                    color: T.textSub,
                    fontSize: 15,
                    marginTop: 10,
                    fontWeight: 500,
                    fontFamily: T.body,
                  }}
                >
                  {mode.tagline}
                </p>
              </div>

              <blockquote
                style={{
                  maxWidth: 280,
                  margin: 0,
                  fontSize: 13,
                  lineHeight: 1.65,
                  color: '#8888AA',
                  fontStyle: 'italic',
                  borderLeft: `2px solid rgba(${mode.accentRgb},0.35)`,
                  paddingLeft: 16,
                  fontFamily: T.body,
                }}
              >
                {mode.quote}
              </blockquote>
            </div>

            <p
              style={{
                fontSize: 'clamp(14px, 2vw, 16px)',
                lineHeight: 1.75,
                color: '#CCCCDD',
                marginBottom: 28,
                maxWidth: 700,
                fontFamily: T.body,
              }}
            >
              {mode.desc}
            </p>

            <div
              style={{
                display: 'grid',
                gap: 10,
                marginBottom: 32,
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              }}
            >
              {mode.features.map((feature) => (
                <div
                  key={feature.text}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 10,
                    border: `1px solid rgba(${mode.accentRgb},0.15)`,
                    background: `rgba(${mode.accentRgb},0.05)`,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      fontSize: 20,
                      lineHeight: 1,
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {feature.icon}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: '#C8C8E0',
                      fontWeight: 500,
                      fontFamily: T.body,
                    }}
                  >
                    {feature.text}
                  </span>
                </div>
              ))}
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <button
                type="button"
                onClick={() => handleStart(mode.id)}
                style={{
                  padding: 'clamp(12px, 2vw, 16px) clamp(28px, 5vw, 52px)',
                  borderRadius: 12,
                  cursor: 'pointer',
                  border: 'none',
                  background: mode.accent,
                  color: '#000000',
                  fontSize: 'clamp(14px, 2vw, 16px)',
                  fontWeight: 900,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  fontFamily: T.display,
                  minHeight: 52,
                  boxShadow: ctaPulse
                    ? `0 0 60px rgba(${mode.accentRgb},0.8), 0 0 120px rgba(${mode.accentRgb},0.4)`
                    : `0 0 24px rgba(${mode.accentRgb},0.35)`,
                  transform: ctaPulse ? 'scale(1.03)' : 'scale(1)',
                  transition: 'box-shadow 0.35s ease, transform 0.2s ease',
                }}
              >
                {mode.cta}
              </button>

              <p
                style={{
                  color: T.textMut,
                  fontSize: 12,
                  fontFamily: T.mono,
                  letterSpacing: '0.05em',
                  lineHeight: 1.5,
                  maxWidth: 260,
                }}
              >
                No saving. No pausing. No excuses.
                <br />
                Just like real money.
              </p>
            </div>
          </div>
        </div>

        <footer
          style={{
            width: '100%',
            maxWidth: 960,
            marginTop: 24,
            borderRadius: 12,
            padding: 'clamp(16px, 3vw, 20px) clamp(20px, 4vw, 40px)',
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(10,10,22,0.7)',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '16px 40px',
          }}
        >
          {([
            ['12 Min', 'To change how you see money'],
            ['4 Modes', 'Each teaches a real wealth principle'],
            ['No Resets', 'Every decision has permanent weight'],
            ['Real Rules', 'Same principles as actual wealth building'],
            ['Elite Proof', 'Beat a champion and earn it forever'],
          ] as [string, string][]).map(([value, label]) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: 'clamp(1.1rem, 3vw, 1.5rem)',
                  fontWeight: 800,
                  color: mode.accent,
                  fontFamily: T.display,
                  letterSpacing: '-0.02em',
                  transition: 'color 0.5s ease',
                }}
              >
                {value}
              </div>
              <div
                style={{
                  color: T.textMut,
                  fontSize: 10,
                  fontFamily: T.mono,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  marginTop: 3,
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </footer>

        <div
          style={{
            marginTop: 24,
            textAlign: 'center',
            fontSize: 10,
            fontFamily: T.mono,
            color: T.textMut,
            letterSpacing: '0.08em',
          }}
        >
          ⚖️ &quot;The 1% is not a destination. It&apos;s an invitation list.&quot;
          <span
            style={{
              display: 'block',
              marginTop: 4,
              fontSize: 9,
              color: '#2a2a40',
            }}
          >
            — STATUS_QUO_ML
          </span>
        </div>
      </div>
    </div>
  );
}