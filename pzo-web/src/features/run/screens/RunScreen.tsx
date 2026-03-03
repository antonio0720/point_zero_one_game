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
import React, { memo }  from 'react';
import { useRunState }  from '../../../hooks/useRunState';
import { MLProvider }   from '../../../ml/wiring/MLContext';
import RunHUD           from '../components/RunHUD';

const RunScreen = memo(() => {
  const runState = useRunState();
  const runId = runState.runId; // Use the correct property name for run ID in your RunStateSlices
  const mode = runState.mode;
  const season = runState.season;
  const screen = runState.screen;

  // MLProvider keyed on runId — resets all ML engines on each new run.
  // sessionRunCount drives sessionMomentum in PlayerModelEngine.
  return (
    <MLProvider
      key={runId}
      mode={mode}
      sessionRunCount={season?.runCount ?? 1}
    >
      <div className="run-screen">
        <RunHUD
          isActiveRun={screen === 'run'}
          showIntel
        />
      </div>
    </MLProvider>
  );
});

RunScreen.displayName = 'RunScreen';
export default RunScreen;