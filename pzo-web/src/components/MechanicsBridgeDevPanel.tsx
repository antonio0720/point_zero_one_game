/// <reference types="vite/client" />
/**
 * MechanicsBridgeDevPanel.tsx — Sprint 3C Smoke Harness
 *
 * Dev-only panel. Renders null in production.
 * Shows: last 20 bridge calls, accepted/rejected counts,
 * manual trigger by mechanic ID or family.
 *
 * Mount inside <MechanicsBridgeProvider> in the run screen (dev only).
 */

import React, { useState, useEffect, useRef } from 'react';
import { useMechanicsBridge } from '../context/MechanicsBridgeContext';
import type { MechanicFamily } from '../context/MechanicsBridgeContext';

const DEV = import.meta.env.DEV;

const FAMILIES: MechanicFamily[] = [
  'economy', 'risk', 'cards', 'progression', 'season',
  'market', 'pvp', 'social', 'ai', 'anti_cheat', 'telemetry', 'ops',
];

export default function MechanicsBridgeDevPanel() {
  if (!DEV) return null;

  const bridge = useMechanicsBridge();
  const [open, setOpen] = useState(false);
  const [mechInput, setMechInput] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [accepted, setAccepted] = useState(0);
  const [rejected, setRejected] = useState(0);
  const prevTickRef = useRef(bridge.snap.tick);

  // Track tick changes and emit to log
  useEffect(() => {
    if (bridge.snap.tick !== prevTickRef.current) {
      prevTickRef.current = bridge.snap.tick;
    }
  }, [bridge.snap.tick]);

  function fireById() {
    const id = mechInput.trim().toUpperCase();
    if (!id) return;
    try {
      bridge.touchMechanic(id, { signal: 0.20, reason: 'manual trigger from smoke panel' });
      setLog((l) => [`✅ ${id} fired`, ...l.slice(0, 19)]);
      setAccepted((n) => n + 1);
    } catch {
      setLog((l) => [`❌ ${id} rejected`, ...l.slice(0, 19)]);
      setRejected((n) => n + 1);
    }
    setMechInput('');
  }

  function fireFamily(family: MechanicFamily) {
    bridge.touchFamily(family, { signal: 0.15, reason: 'manual trigger from smoke panel' });
    setLog((l) => [`🏷️  family:${family} fired`, ...l.slice(0, 19)]);
    setAccepted((n) => n + 1);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-50 px-3 py-1.5 rounded-lg text-xs font-mono
                   bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white
                   hover:border-indigo-600 transition-all"
        title="Open Mechanics Bridge Dev Panel"
      >
        🔧 bridge
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-4 left-4 z-50 w-80 bg-zinc-950 border border-zinc-700
                 rounded-xl shadow-xl overflow-hidden text-xs font-mono"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800">
        <span className="text-zinc-300 font-bold">🔧 Mechanics Bridge</span>
        <div className="flex items-center gap-2">
          <span className="text-emerald-400">✅ {accepted}</span>
          <span className="text-red-400">❌ {rejected}</span>
          <button
            onClick={() => setOpen(false)}
            className="text-zinc-500 hover:text-zinc-300 ml-1"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Snapshot */}
      <div className="px-3 py-2 border-b border-zinc-800 text-zinc-500 grid grid-cols-2 gap-x-3 gap-y-0.5">
        <span>tick: <span className="text-zinc-300">{bridge.snap.tick}</span></span>
        <span>cash: <span className="text-zinc-300">${bridge.snap.cash.toLocaleString()}</span></span>
        <span>α: <span className="text-indigo-300">{(bridge.snap.intelligence.alpha * 100).toFixed(0)}%</span></span>
        <span>risk: <span className="text-red-300">{(bridge.snap.intelligence.risk * 100).toFixed(0)}%</span></span>
        <span>regime: <span className="text-zinc-300">{bridge.snap.regime}</span></span>
        <span>tier: <span className="text-purple-300">T{bridge.snap.season.passTier}</span></span>
      </div>

      {/* Manual trigger by ID */}
      <div className="px-3 py-2 border-b border-zinc-800 flex gap-2">
        <input
          value={mechInput}
          onChange={(e) => setMechInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fireById()}
          placeholder="M01, M42, M75..."
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1
                     text-zinc-200 outline-none text-xs placeholder:text-zinc-600"
        />
        <button
          onClick={fireById}
          className="px-2 py-1 rounded bg-indigo-700 hover:bg-indigo-600 text-white text-xs"
        >
          Fire
        </button>
      </div>

      {/* Family triggers */}
      <div className="px-3 py-2 border-b border-zinc-800 flex flex-wrap gap-1">
        {FAMILIES.map((f) => (
          <button
            key={f}
            onClick={() => fireFamily(f)}
            className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700
                       text-zinc-400 hover:text-white border border-zinc-700 text-xs"
          >
            {f}
          </button>
        ))}
      </div>

      {/* Activity log */}
      <div className="px-3 py-2 max-h-32 overflow-y-auto space-y-0.5">
        {log.length === 0 && (
          <p className="text-zinc-600">No activity yet. Fire a mechanic above.</p>
        )}
        {log.map((entry, i) => (
          <p key={i} className={i === 0 ? 'text-zinc-200' : 'text-zinc-600'}>{entry}</p>
        ))}
      </div>
    </div>
  );
}
