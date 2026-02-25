import React, { useState, useEffect, useRef } from 'react';

type RunMode = 'solo' | 'asymmetric-pvp' | 'co-op' | 'ghost';

interface LobbyScreenProps {
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
    tagline:   'You vs. The Market',
    badge:     'SOLO RUN',
    accent:    '#FFB800',
    accentRgb: 'rgba(255,184,0,',
    bg:        'from-[#0D0900] via-[#110C00] to-[#0A0700]',
    borderCss: '#FFB80055',
    glow:      'shadow-[0_0_80px_rgba(255,184,0,0.25)]',
    btnBg:     'bg-[#FFB800] hover:bg-[#FFCA40] text-black',
    desc:      'Build a passive income empire before your burn rate kills you. 12 minutes. 720 ticks. One shot.',
    features: [
      { icon: '💸', name: 'Income vs. Burn',  detail: 'Push passive income past monthly expenses before the clock runs out' },
      { icon: '🎴', name: '300-Card Engine',   detail: 'Every decision pulls from a living deck of market forces, risks, and power moves' },
      { icon: '📈', name: 'Market Regimes',    detail: 'Stable, Expansion, Panic, Euphoria — the market shifts beneath you without warning' },
      { icon: '💀', name: 'Permadeath',        detail: 'Hit zero with no shields and it\'s over. No second chances. No pausing.' },
    ],
    cta: 'LAUNCH EMPIRE',
    flavor: '"Build the machine that runs without you — or go bankrupt trying."',
  },
  'asymmetric-pvp': {
    id:        'asymmetric-pvp' as RunMode,
    label:     'PREDATOR',
    tagline:   'Hunt. Sabotage. Collapse.',
    badge:     'ASYMMETRIC PVP',
    accent:    '#FF3030',
    accentRgb: 'rgba(255,48,48,',
    bg:        'from-[#0D0000] via-[#120000] to-[#080000]',
    borderCss: '#FF303055',
    glow:      'shadow-[0_0_80px_rgba(255,48,48,0.3)]',
    btnBg:     'bg-[#FF3030] hover:bg-[#FF5555] text-white',
    desc:      'One player builds. One player is the Hater. Deploy sabotage cards to detonate their income streams in real time.',
    features: [
      { icon: '🗡️',  name: 'Asymmetric Roles',  detail: 'Builder races to profits; Hater deploys sabotage cards every 24 ticks to wreck their run' },
      { icon: '💣',  name: 'Sabotage Deck',      detail: 'Freeze income, trigger fake taxes, corrupt shields — 40+ sabotage mechanics live in rotation' },
      { icon: '🛡️',  name: 'Counterplay Window', detail: 'Builders get a 6-tick window to detect and block incoming attacks before impact' },
      { icon: '⚡',  name: 'Pulse Lanes',        detail: 'Ghost pulse attacks land every 75 ticks with escalating damage the longer the Builder survives' },
    ],
    cta: 'ENTER THE WAR',
    flavor: '"The market has enemies. In this mode, one of them is sitting across from you."',
  },
  'co-op': {
    id:        'co-op' as RunMode,
    label:     'SYNDICATE',
    tagline:   'Build Together. Fall Together.',
    badge:     'CO-OP',
    accent:    '#00E5C8',
    accentRgb: 'rgba(0,229,200,',
    bg:        'from-[#000D0B] via-[#001210] to-[#000908]',
    borderCss: '#00E5C855',
    glow:      'shadow-[0_0_80px_rgba(0,229,200,0.2)]',
    btnBg:     'bg-[#00E5C8] hover:bg-[#33EDD5] text-black',
    desc:      'Two players, one shared clock. Pool income streams, share shields, and bail each other out before bankruptcy takes you both.',
    features: [
      { icon: '🤝',  name: 'Shared Economy',     detail: 'Income and expense events affect both players — one bad trade can bankrupt the whole syndicate' },
      { icon: '🆘',  name: 'Rescue Windows',      detail: 'When your partner enters distress, you have a 12-tick window to send emergency capital or lose them' },
      { icon: '📜',  name: 'Aid Contracts',       detail: 'Negotiate real-time income sharing, debt transfers, and shield lending mid-run' },
      { icon: '🏆',  name: 'Syndicate XP',        detail: 'Season dominion points are doubled but only awarded if both players survive the full 720 ticks' },
    ],
    cta: 'FORM SYNDICATE',
    flavor: '"Two incomes. Two risk profiles. One bankruptcy screen."',
  },
  ghost: {
    id:        'ghost' as RunMode,
    label:     'PHANTOM',
    tagline:   'Race the Ghost of a Champion',
    badge:     'GHOST MODE',
    accent:    '#B57BFF',
    accentRgb: 'rgba(181,123,255,',
    bg:        'from-[#08000D] via-[#0A0012] to-[#060009]',
    borderCss: '#B57BFF55',
    glow:      'shadow-[0_0_80px_rgba(181,123,255,0.25)]',
    btnBg:     'bg-[#B57BFF] hover:bg-[#C99AFF] text-black',
    desc:      'Your decisions run in parallel with a ghost replay of a verified champion run. Same seed. Same market. Different choices.',
    features: [
      { icon: '👻',  name: 'Ghost Replay',        detail: 'A verified champion\'s run is mirrored on your board — you see their net worth at every tick' },
      { icon: '🔑',  name: 'Deterministic Seeds', detail: 'Same market sequence. Same card draw order. The only variable is you.' },
      { icon: '📊',  name: 'Live Delta Tracker',  detail: 'At every decision point, see exactly how far ahead or behind the ghost your net worth is' },
      { icon: '🏅',  name: 'Proof Badge',         detail: 'Beat the ghost and earn a cryptographic proof badge tied to your run seed — impossible to fake' },
    ],
    cta: 'CHASE THE GHOST',
    flavor: '"The champion already ran this exact market. Let\'s see if you do better."',
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
            Financial Roguelike · 300 Mechanics · 12 Minutes
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
            Make your passive income outlast your expenses — or go bankrupt trying
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
                720 ticks · seeded deterministic run · permadeath enabled
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
              ['300', 'Live Mechanics'],
              ['150', 'ML/AI Companions'],
              ['12', 'Minute Runs'],
              ['4', 'Market Regimes'],
              ['∞', 'Unique Seeds'],
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
