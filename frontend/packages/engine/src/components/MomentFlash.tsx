/**
 * MomentFlash.tsx — Toasts notable run moments from App.tsx event log
 *
 * Props contract (from App.tsx):
 *   events      string[]            — the events[] state (log feed)
 *   tick        number              — current tick (triggers re-eval)
 *   maxVisible  number?             — max toasts visible at once (default 3)
 *   className   string?
 *
 * Logic: scans last N events for pattern-matched "moments" and surfaces them
 * as auto-fading toast cards. Pure props → UI, no phantom hooks/stores.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Moment {
  id: string;
  message: string;
  icon: string;
  color: string;         // tailwind text color
  bgColor: string;       // tailwind bg color
  borderColor: string;
  autoFadeMs: number;
}

export interface MomentFlashProps {
  events: string[];
  tick: number;
  maxVisible?: number;
  className?: string;
}

// ─── Moment detection patterns ────────────────────────────────────────────────

const PATTERNS: Array<{
  match: RegExp;
  icon: string;
  color: string;
  bg: string;
  border: string;
  fadeMs: number;
}> = [
  { match: /FREEDOM UNLOCKED|passive income exceeds/i,
    icon: '🏆', color: 'text-yellow-300', bg: 'bg-yellow-950', border: 'border-yellow-600', fadeMs: 8000 },
  { match: /shield absorbed bankruptcy/i,
    icon: '🛡️', color: 'text-yellow-300', bg: 'bg-yellow-950', border: 'border-yellow-600', fadeMs: 4500 },
  { match: /ML rerouted draw/i,
    icon: '🧠', color: 'text-cyan-300',   bg: 'bg-cyan-950',   border: 'border-cyan-600',   fadeMs: 3500 },
  { match: /shield blocked/i,
    icon: '🛡️', color: 'text-yellow-300', bg: 'bg-yellow-950', border: 'border-yellow-500', fadeMs: 3000 },
  { match: /FUBAR hit/i,
    icon: '💥', color: 'text-red-300',    bg: 'bg-red-950',    border: 'border-red-600',    fadeMs: 3500 },
  { match: /Bull run|Market rally/i,
    icon: '📈', color: 'text-emerald-300',bg: 'bg-emerald-950',border: 'border-emerald-600',fadeMs: 3500 },
  { match: /Recession hits/i,
    icon: '📉', color: 'text-orange-300', bg: 'bg-orange-950', border: 'border-orange-600', fadeMs: 3500 },
  { match: /Unexpected bill/i,
    icon: '🔥', color: 'text-red-300',    bg: 'bg-red-950',    border: 'border-red-700',    fadeMs: 3000 },
  { match: /Integrity sweep grants shield/i,
    icon: '🛡️', color: 'text-indigo-300', bg: 'bg-indigo-950', border: 'border-indigo-600', fadeMs: 3500 },
  { match: /Deck engine bonus draw/i,
    icon: '🃏', color: 'text-purple-300', bg: 'bg-purple-950', border: 'border-purple-600', fadeMs: 3000 },
  { match: /Privilege activated/i,
    icon: '⭐', color: 'text-yellow-300', bg: 'bg-yellow-950', border: 'border-yellow-500', fadeMs: 3500 },
];

// ─── Flash Toast ──────────────────────────────────────────────────────────────

function FlashToast({
  moment,
  onDismiss,
}: {
  moment: Moment;
  onDismiss: (id: string) => void;
}) {
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    fadeRef.current = setTimeout(() => setVisible(false), moment.autoFadeMs - 300);
    const removeTimer = setTimeout(() => onDismiss(moment.id), moment.autoFadeMs);
    return () => {
      if (fadeRef.current) clearTimeout(fadeRef.current);
      clearTimeout(removeTimer);
    };
  }, [moment.id, moment.autoFadeMs, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`
        relative flex items-center gap-2 px-3 py-2.5 rounded-lg border
        shadow-lg backdrop-blur-sm text-sm font-semibold
        transition-all duration-300
        ${moment.bgColor} ${moment.borderColor} ${moment.color}
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none'}
      `}
    >
      <span className="text-base flex-shrink-0">{moment.icon}</span>
      <span className="leading-snug">{moment.message}</span>
      <button
        onClick={() => onDismiss(moment.id)}
        className="ml-auto text-xs opacity-40 hover:opacity-80 transition-opacity flex-shrink-0"
        aria-label="Dismiss"
      >
        ✕
      </button>

      {/* Auto-fade progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-lg overflow-hidden">
        <div
          className="h-full bg-white/20 origin-left"
          style={{ animation: `pzo-shrink-x ${moment.autoFadeMs}ms linear forwards` }}
        />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MomentFlash({
  events,
  tick,
  maxVisible = 3,
  className = '',
}: MomentFlashProps) {
  const [moments, setMoments] = useState<Moment[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const prevTickRef = useRef(-1);

  useEffect(() => {
    // Only process new events since last tick to avoid re-firing
    if (tick === prevTickRef.current) return;
    prevTickRef.current = tick;

    // Scan the most-recent event only (App.tsx appends newest last)
    const latestEvent = events[events.length - 1];
    if (!latestEvent) return;

    // Already seen this exact event string?
    if (seenRef.current.has(latestEvent)) return;
    seenRef.current.add(latestEvent);

    for (const p of PATTERNS) {
      if (p.match.test(latestEvent)) {
        const id = `moment-${tick}-${Date.now()}`;
        const newMoment: Moment = {
          id,
          message: latestEvent.replace(/^\[T\d+\]\s*/, ''), // strip [T123] prefix
          icon: p.icon,
          color: p.color,
          bgColor: p.bg,
          borderColor: p.border,
          autoFadeMs: p.fadeMs,
        };
        setMoments((prev) => [...prev.slice(-(maxVisible - 1)), newMoment]);
        break; // one match per event
      }
    }
  }, [events, tick, maxVisible]);

  const dismiss = useCallback((id: string) => {
    setMoments((prev) => prev.filter((m) => m.id !== id));
  }, []);

  if (moments.length === 0) return null;

  return (
    <>
      {/* Inject keyframe once */}
      <style>{`
        @keyframes pzo-shrink-x {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
      `}</style>

      <div
        className={`flex flex-col gap-2 ${className}`}
        data-testid="moment-flash"
      >
        {moments.slice(-maxVisible).map((m) => (
          <FlashToast key={m.id} moment={m} onDismiss={dismiss} />
        ))}
      </div>
    </>
  );
}
