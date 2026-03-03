/**
 * FILE: RunScreen.tsx
 * Density6 LLC · Point Zero One · Confidential
 *
 * RunScreen — top-level run layout.
 * Wraps everything in MLProvider keyed on runId so all ML engines
 * reset cleanly on each new run.
 *
 * NOTE: useDecisionWindow(cardInstanceId) is per-card — it belongs in
 * CardSlot, not here. DecisionTimerRing wraps each CardSlot individually.
 */

'use client';

import React, { memo, useEffect, useMemo, useState } from 'react';

import { useEngineStore } from '../../../store/engineStore';
import { MLProvider } from '../../../ml/wiring/MLContext';
import RunHUD from '../components/RunHUD';

const SESSION_RUN_COUNT_KEY = 'pzo.sessionRunCount';
const SESSION_LAST_RUN_ID_KEY = 'pzo.lastRunId';
const SESSION_ACTIVE_MODE_KEY = 'pzo.activeMode';

function readPositiveInt(raw: string | null, fallback: number): number {
  const n = raw ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return i > 0 ? i : fallback;
}

const RunScreen = memo(() => {
  // Engine 0 lifecycle runId (drives MLProvider reset)
  const storeRunId = useEngineStore((s) => s.run.runId);
  const lifecycleState = useEngineStore((s) => s.run.lifecycleState);

  const keyRunId = storeRunId ?? 'boot';
  const isActiveRun = lifecycleState === 'ACTIVE';

  // Session-scoped run count (drives ML sessionMomentum in PlayerModelEngine)
  const [sessionRunCount, setSessionRunCount] = useState<number>(() => {
    if (typeof window === 'undefined') return 1;
    return readPositiveInt(window.sessionStorage.getItem(SESSION_RUN_COUNT_KEY), 1);
  });

  // Mode is used by MLProvider to decide whether bot logic is active.
  // Source of truth should be the app's mode router; if not wired yet, we fall back safely.
  const mode = useMemo<string>(() => {
    if (typeof window === 'undefined') return 'STANDARD';
    return (
      window.sessionStorage.getItem(SESSION_ACTIVE_MODE_KEY) ||
      window.localStorage.getItem(SESSION_ACTIVE_MODE_KEY) ||
      'STANDARD'
    );
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Only bump when a real runId appears/changes.
    if (!storeRunId) return;

    const lastRunId = window.sessionStorage.getItem(SESSION_LAST_RUN_ID_KEY);
    const currentCount = readPositiveInt(window.sessionStorage.getItem(SESSION_RUN_COUNT_KEY), 1);

    if (lastRunId !== storeRunId) {
      const nextCount = lastRunId ? currentCount + 1 : currentCount; // first run remains 1
      window.sessionStorage.setItem(SESSION_RUN_COUNT_KEY, String(nextCount));
      window.sessionStorage.setItem(SESSION_LAST_RUN_ID_KEY, storeRunId);
      setSessionRunCount(nextCount);
    }
  }, [storeRunId]);

  return (
    <MLProvider key={keyRunId} mode={mode} sessionRunCount={sessionRunCount}>
      <div className="run-screen">
        <RunHUD isActiveRun={isActiveRun} showIntel />
      </div>
    </MLProvider>
  );
});

RunScreen.displayName = 'RunScreen';

export default RunScreen;