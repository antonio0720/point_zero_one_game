import React, { useState, useEffect, useRef } from 'react';

// Import RunMode from the engine layer — single source of truth
import type { RunMode } from '../engines/core/types';

interface LobbyScreenProps {
  /** Called when player clicks a mode CTA. Receives the selected RunMode. */
  onStart: (mode: RunMode) => void;
}

// ─── Particle Canvas ─────────────────────────────────────────────────────────
function ParticleField({ color }: { color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let W = canvas.width  = window.innerWidth;
    let H = canvas.height = window.innerHeight;

    const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    window.addEventListener('resize', resize);

    const count = 60;
    const dots = Array.from({ length: count }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2 + 0.5,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      // connect nearby dots
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          const dx = dots[i].x - dots[j].x;
          const dy = dots[i].y - dots[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 140) {
            ctx.beginPath();
            ctx.strokeStyle = color.replace('1)', `${0.12 * (1 - dist / 140)})`);
            ctx.lineWidth = 0.5;
            ctx.moveTo(dots[i].x, dots[i].y);
            ctx.lineTo(dots[j].x, dots[j].y);
            ctx.stroke();
          }
        }
      }
      for (const d of dots) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = color.replace('1)', '0.5)');
        ctx.fill();
        d.x += d.vx; d.y += d.vy;
        if (d.x < 0 || d.x > W) d.vx *= -1;
        if (d.y < 0 || d.y > H) d.vy *= -1;
      }
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener('resize', resize); };
  }, [color]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

// ─── Mode definitions ─────────────────────────────────────────────────────────
const MODES = {
  solo: {
    id:        'solo' as RunMode,
    label:     'EMPIRE',
    tagline:   'Build income that works while you sleep — or lose everything.',
    badge:     'GO ALONE',
    accent:    '#FFB800',
    accentRgb: 'rgba(255,184,0,',
    bg:        'from-[#0D0900] via-[#110C00] to-[#0A0700]',
    borderCss: '#FFB80055',
    glow:      'shadow-[0_0_80px_rgba(255,184,0,0.25)]',
    btnBg:     'bg-[#FFB800] hover:bg-[#FFCA40] text-black',
    desc:      'Most people spend 40 years trading hours for dollars and never break the cycle. EMPIRE gives you 12 minutes to do what most people never figure out — build something that pays you whether you show up or not. Every instinct you sharpen here works the same way when real money is on the line.',
    features: [
      { icon: '💸', name: 'Your Money Has to Work For You',       detail: 'The only way to win is making your income outgrow your expenses — automatically. That\'s not a game rule. That\'s the secret the wealthy figured out early.' },
      { icon: '🎯', name: 'Every Decision Has a Permanent Cost',  detail: 'Nothing resets. Every choice shifts your cash flow forward or backward. Master this and you\'ll start reading real financial decisions the same way.' },
      { icon: '🌊', name: 'The Market Doesn\'t Care About You',   detail: 'Calm turns to chaos without warning. The players who win here don\'t fight the market — they learn to move with it. That skill lives in your body after this.' },
      { icon: '🔥', name: 'No Safety Net. Like Real Life.',        detail: 'When your cash hits zero with no protection left, it\'s over. That pressure isn\'t punishment — it\'s the exact feeling that separates people who build wealth from people who almost did.' },
    ],
    cta: 'START BUILDING',
    flavor: '"Every wealthy person built something that pays them while they sleep. This is where you learn how."',
  },
  'asymmetric-pvp': {
    id:        'asymmetric-pvp' as RunMode,
    label:     'PREDATOR',
    tagline:   'Learn to recognize when someone is attacking your money.',
    badge:     'HEAD TO HEAD',
    accent:    '#FF3030',
    accentRgb: 'rgba(255,48,48,',
    bg:        'from-[#0D0000] via-[#120000] to-[#080000]',
    borderCss: '#FF303055',
    glow:      'shadow-[0_0_80px_rgba(255,48,48,0.3)]',
    btnBg:     'bg-[#FF3030] hover:bg-[#FF5555] text-white',
    desc:      'The market isn\'t neutral — and neither are the people around you. Bad partners, bad deals, competitors who want you to fail. PREDATOR puts a live adversary behind your worst financial nightmares and trains you to smell the attack before it lands, absorb the hit, and keep building while they\'re still swinging.',
    features: [
      { icon: '⚔️', name: 'See The Attack Before It Lands',        detail: 'Your opponent fires real financial disruptions at you in real time. You have seconds to read it and counter. That reaction speed? It follows you into every real negotiation you\'ll ever have.' },
      { icon: '💣', name: 'Your Income Stream Is a Target',         detail: 'Frozen revenue. Surprise losses. Collapsed shields. The most dangerous vulnerability in real life — and in this game — is always the income you took for granted.' },
      { icon: '🛡️', name: 'Defense Is Half the Game',              detail: 'Most people only think about making money. The wealthy think about protecting it. PREDATOR forces you to master both at the same time under fire.' },
      { icon: '📈', name: 'Success Attracts Resistance',            detail: 'The longer you survive, the harder the attacks get. That\'s not a difficulty curve — that\'s what scaling a real business actually feels like.' },
    ],
    cta: 'BECOME UNBREAKABLE',
    flavor: '"The wealthy aren\'t just good at making money. They\'re impossible to tear down."',
  },
  'co-op': {
    id:        'co-op' as RunMode,
    label:     'SYNDICATE',
    tagline:   'Your financial circle determines your financial ceiling.',
    badge:     'TEAM UP',
    accent:    '#00E5C8',
    accentRgb: 'rgba(0,229,200,',
    bg:        'from-[#000D0B] via-[#001210] to-[#000908]',
    borderCss: '#00E5C855',
    glow:      'shadow-[0_0_80px_rgba(0,229,200,0.2)]',
    btnBg:     'bg-[#00E5C8] hover:bg-[#33EDD5] text-black',
    desc:      'Your net worth reflects the 5 people closest to you — whether you like it or not. SYNDICATE makes that literal. You and your partner share one economy. Their blind spots drain your account. Your strengths are their lifeline. This is the most honest 12-minute simulation of a real financial partnership you\'ll ever experience.',
    features: [
      { icon: '🤝', name: 'You\'re Only As Strong As Who You Build With', detail: 'One bad decision by your partner hits your income too. This is not a metaphor — it\'s a direct simulation of every business relationship you\'ll ever enter.' },
      { icon: '🆘', name: 'Real Loyalty Gets Tested Under Pressure',      detail: 'When your partner starts burning, you have a narrow window to send capital and pull them back — or protect yourself and let them fall. Some partnerships end right here.' },
      { icon: '📜', name: 'Negotiate Like Your Future Depends On It',     detail: 'Split income, transfer debt, lend protection. The deals you broker mid-run are exactly how real wealth-building partnerships get tested. Learn the skill before real money is on the table.' },
      { icon: '🏆', name: 'Both Survive or Neither Wins',                 detail: 'You only earn rewards if both players make it. There is no individual glory in SYNDICATE. Shared success — or shared failure. Just like the real thing.' },
    ],
    cta: 'BUILD THE ALLIANCE',
    flavor: '"The person you choose to build with will either multiply your wealth — or quietly drain it."',
  },
  ghost: {
    id:        'ghost' as RunMode,
    label:     'PHANTOM',
    tagline:   'Find out exactly where your thinking falls short.',
    badge:     'CHASE A LEGEND',
    accent:    '#B57BFF',
    accentRgb: 'rgba(181,123,255,',
    bg:        'from-[#08000D] via-[#0A0012] to-[#060009]',
    borderCss: '#B57BFF55',
    glow:      'shadow-[0_0_80px_rgba(181,123,255,0.25)]',
    btnBg:     'bg-[#B57BFF] hover:bg-[#C99AFF] text-black',
    desc:      'There\'s a version of you that made all the right calls. PHANTOM lets you race a verified champion who played the exact same market you\'re about to face — same starting position, same events, same forces working against you. Every point of separation in the score is a decision where your thinking diverged from elite thinking. Most players learn more in one PHANTOM run than in ten normal runs.',
    features: [
      { icon: '👻', name: 'Watch How a Champion Thinks, Live',       detail: 'A proven winner\'s run plays beside yours, tick by tick. You see every response they made to the same events you\'re facing right now. Study the pattern.' },
      { icon: '🎯', name: 'The Market Is Identical. The Gap Is You.', detail: 'Same starting cash. Same shocks. Same market forces. The only variable is the quality of your decisions. This mode shows you exactly what those decisions cost.' },
      { icon: '📊', name: 'Track Your Thinking Gaps in Real Time',    detail: 'A live score delta follows you through every major moment. Ahead of the ghost, you\'re thinking like a winner. Behind it, you just found something to fix.' },
      { icon: '🏅', name: 'Beat a Champion and Prove It Forever',     detail: 'Outperform the ghost and earn a permanent, verified proof badge tied to your exact run. Unfakeable. Unbeatable. You either did it or you didn\'t.' },
    ],
    cta: 'FACE YOUR GHOST',
    flavor: '"You don\'t rise to your goals. You fall to the level of your decisions. This mode shows you exactly where that level is."',
  },
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function LobbyScreen({ onStart }: LobbyScreenProps) {
  const [selected,  setSelected]  = useState<RunMode>('solo');
  const [animating, setAnimating] = useState(false);
  const [entered,   setEntered]   = useState(false);
  const [pulse,     setPulse]     = useState(false);

  const mode = MODES[selected];

  useEffect(() => {
    setTimeout(() => setEntered(true), 60);
  }, []);

  // pulse the CTA button periodically
  useEffect(() => {
    const id = setInterval(() => { setPulse(true); setTimeout(() => setPulse(false), 600); }, 4000);
    return () => clearInterval(id);
  }, []);

  const switchMode = (m: RunMode) => {
    if (m === selected) return;
    setAnimating(true);
    setTimeout(() => { setSelected(m); setAnimating(false); }, 180);
  };

  const handleStart = () => onStart(selected);

  return (
    <div
      className={`relative min-h-screen overflow-hidden transition-all duration-500 bg-gradient-to-br ${mode.bg}`}
      style={{ fontFamily: "'DM Mono', 'Courier New', monospace" }}
    >
      {/* Particle layer */}
      <ParticleField color={mode.accentRgb + '1)'} />

      {/* Noise overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '200px 200px',
        }}
      />

      {/* Radial glow behind content */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-700"
        style={{
          background: `radial-gradient(ellipse 60% 50% at 50% 40%, ${mode.accentRgb}0.07) 0%, transparent 70%)`,
        }}
      />

      {/* ── Content ── */}
      <div
        className="relative z-10 min-h-screen flex flex-col items-center justify-between px-4 py-10"
        style={{
          opacity:    entered ? 1 : 0,
          transform:  entered ? 'none' : 'translateY(20px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}
      >
        {/* ── Title Block ── */}
        <header className="text-center w-full max-w-4xl">
          <div
            className="inline-block text-xs tracking-[0.4em] uppercase mb-4 px-3 py-1 rounded-full border"
            style={{ color: mode.accent, borderColor: mode.borderCss, background: mode.accentRgb + '0.08)' }}
          >
            Master This Game. Master Real Money.
          </div>
          <h1
            className="text-[clamp(3rem,10vw,7rem)] font-black leading-none tracking-tighter text-white"
            style={{ letterSpacing: '-0.03em' }}
          >
            POINT{' '}
            <span
              className="transition-all duration-500"
              style={{
                color:      mode.accent,
                textShadow: `0 0 40px ${mode.accentRgb}0.6), 0 0 80px ${mode.accentRgb}0.3)`,
              }}
            >
              ZERO ONE
            </span>
          </h1>
          <p className="mt-3 text-[#888] text-sm tracking-widest uppercase">
            Most people never figure out why their money disappears. You're about to.
          </p>
        </header>

        {/* ── Mode Selector Tabs ── */}
        <nav className="flex flex-wrap justify-center gap-2 mt-8">
          {(Object.values(MODES) as typeof MODES[RunMode][]).map((m) => {
            const isActive = selected === m.id;
            return (
              <button
                key={m.id}
                onClick={() => switchMode(m.id)}
                className="relative px-5 py-2 rounded-lg text-xs tracking-widest uppercase font-bold transition-all duration-300 outline-none"
                style={{
                  color:      isActive ? m.accent : '#666',
                  border:     `1px solid ${isActive ? m.accent : '#333'}`,
                  background: isActive ? m.accentRgb + '0.1)' : 'transparent',
                  boxShadow:  isActive ? `0 0 20px ${m.accentRgb}0.3), inset 0 0 20px ${m.accentRgb}0.05)` : 'none',
                  transform:  isActive ? 'scale(1.05)' : 'scale(1)',
                }}
              >
                {m.badge}
              </button>
            );
          })}
        </nav>

        {/* ── Mode Detail Card ── */}
        <div
          className="w-full max-w-5xl mt-8 rounded-2xl border overflow-hidden transition-all duration-300"
          style={{
            borderColor:  mode.borderCss,
            background:   `linear-gradient(135deg, ${mode.accentRgb}0.05) 0%, rgba(0,0,0,0.4) 100%)`,
            opacity:      animating ? 0 : 1,
            transform:    animating ? 'translateY(8px)' : 'none',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* Top stripe */}
          <div
            className="h-0.5 w-full"
            style={{ background: `linear-gradient(90deg, transparent, ${mode.accent}, transparent)` }}
          />

          <div className="p-8 md:p-10">
            {/* Mode header */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-8">
              <div>
                <div
                  className="text-xs tracking-[0.3em] uppercase mb-2 font-bold"
                  style={{ color: mode.accent }}
                >
                  {mode.badge}
                </div>
                <h2
                  className="text-5xl md:text-6xl font-black text-white leading-none"
                  style={{ textShadow: `0 0 30px ${mode.accentRgb}0.4)` }}
                >
                  {mode.label}
                </h2>
                <p className="text-lg text-[#aaa] mt-1 font-medium">{mode.tagline}</p>
              </div>
              <p
                className="text-sm leading-relaxed text-[#bbb] max-w-xs italic border-l-2 pl-4"
                style={{ borderColor: mode.borderCss }}
              >
                {mode.flavor}
              </p>
            </div>

            {/* Description */}
            <p className="text-[#ddd] text-base md:text-lg leading-relaxed mb-8 max-w-2xl">
              {mode.desc}
            </p>

            {/* Feature grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {mode.features.map((f) => (
                <div
                  key={f.name}
                  className="rounded-xl p-4 border transition-all duration-200 hover:scale-[1.02]"
                  style={{
                    borderColor: mode.borderCss,
                    background:  mode.accentRgb + '0.04)',
                  }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{f.icon}</span>
                    <span
                      className="font-bold text-sm tracking-wide uppercase"
                      style={{ color: mode.accent }}
                    >
                      {f.name}
                    </span>
                  </div>
                  <p className="text-[#999] text-sm leading-relaxed">{f.detail}</p>
                </div>
              ))}
            </div>

            {/* CTA row */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <button
                onClick={handleStart}
                className={`relative px-12 py-4 rounded-2xl font-black text-lg tracking-widest uppercase transition-all duration-200 active:scale-95 ${mode.btnBg}`}
                style={{
                  boxShadow: pulse
                    ? `0 0 60px ${mode.accentRgb}0.8), 0 0 120px ${mode.accentRgb}0.4)`
                    : `0 0 30px ${mode.accentRgb}0.4)`,
                  transition: 'box-shadow 0.3s ease, transform 0.15s ease',
                  transform: pulse ? 'scale(1.03)' : 'scale(1)',
                }}
              >
                {mode.cta}
              </button>
              <div className="text-[#555] text-xs text-center">
                No saving. No pausing. No excuses. Just like real money.
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom stats strip ── */}
        <footer className="w-full max-w-5xl mt-8">
          <div
            className="rounded-xl border px-6 py-4 flex flex-wrap justify-center gap-8"
            style={{ borderColor: '#222', background: 'rgba(0,0,0,0.4)' }}
          >
            {[
              ['12 Min',    'To change how you see money forever'],
              ['No Resets', 'Your decisions have permanent weight'],
              ['Real Rules','Same wealth principles as real life'],
              ['No Excuses','The market is the same for everyone'],
              ['Elite',     'What you become when you master it'],
            ].map(([val, label]) => (
              <div key={label} className="text-center">
                <div
                  className="text-2xl font-black leading-none transition-all duration-500"
                  style={{ color: mode.accent }}
                >
                  {val}
                </div>
                <div className="text-[#555] text-xs tracking-wider uppercase mt-1">{label}</div>
              </div>
            ))}
          </div>
        </footer>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&display=swap');
      `}</style>
    </div>
  );
}
