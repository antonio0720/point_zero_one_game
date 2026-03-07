'use client';

import { useEffect, useRef } from 'react';
import {
  orchestrator,
  EmpireGameScreen,
  PredatorGameScreen,
  SyndicateGameScreen,
  PhantomGameScreen,
} from '@pzo/engine';
import type { RunMode } from '@pzo/engine';

interface RunContext {
  runId: string;
  mode: RunMode | string;
  config: Record<string, any>;
  startedAt: number;
  seed: number;
}

interface GameShellProps {
  runContext: RunContext;
  onRunEnd: (outcome: string) => void;
  onBackToLobby: () => void;
}

export default function GameShell({ runContext, onRunEnd, onBackToLobby }: GameShellProps) {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    void orchestrator.startRun({
      runId:            runContext.runId,
      userId:           (runContext.config as any)?.userId ?? 'player_01',
      seed:             String(runContext.seed),
      seasonTickBudget: (runContext.config as any)?.seasonTickBudget ?? 720,
      freedomThreshold: (runContext.config as any)?.freedomThreshold ?? 500_000,
      clientVersion:    '4.0.0',
      engineVersion:    '4.0.0',
    } as any);

    return () => {
      try { orchestrator.endRun('ABANDONED' as any); }
      catch (e) { console.error('[GameShell] endRun error:', e); }
    };
  }, [runContext]);

  switch (runContext.mode) {
    case 'solo':           return <EmpireGameScreen />;
    case 'asymmetric-pvp': return <PredatorGameScreen />;
    case 'co-op':          return <SyndicateGameScreen />;
    case 'ghost':          return <PhantomGameScreen />;
    default:               return <EmpireGameScreen />;
  }
}
