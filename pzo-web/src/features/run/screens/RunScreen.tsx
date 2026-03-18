/**
 * FILE: RunScreen.tsx
 * Density6 LLC · Point Zero One · Confidential
 * point_zero_one_master/pzo-web/src/features/run/screens/RunScreen.tsx
 * RunScreen — top-level run layout.
 * Wraps everything in MLProvider keyed on runId so all ML engines
 * reset cleanly on each new run.
 *
 * NOTE: useDecisionWindow(cardInstanceId) is per-card — it belongs in
 * CardSlot, not here. DecisionTimerRing wraps each CardSlot individually.
 */

'use client';

import React, { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import '../../../styles/engine-visual-runtime.css';

import { useEngineStore } from '../../../store/engineStore';
import { MLProvider } from '../../../ml/wiring/MLContext';
import GameHUD from '../components/GameHUD';
import CardHand from '../components/CardHand';
import GameBoard from '../../../components/GameBoard';
import { UnifiedChatDock } from '../../../components/chat/UnifiedChatDock';
import {
  createEmptyGameChatContext,
  type GameChatContext,
} from '../../../components/chat/chatTypes';
import { useEngineCSSBridge } from '../styles/useEngineCSSBridge';

const SESSION_RUN_COUNT_KEY = 'pzo.sessionRunCount';
const SESSION_LAST_RUN_ID_KEY = 'pzo.lastRunId';
const SESSION_ACTIVE_MODE_KEY = 'pzo.activeMode';

type VisibleDockTab = 'GLOBAL' | 'SYNDICATE' | 'DEAL_ROOM';

export interface RunScreenProps {
  readonly mode?: string;
  readonly modeStage?: ReactNode;
  readonly gameCtx?: GameChatContext;
  readonly title?: string;
  readonly subtitle?: string;
  readonly chatTitle?: string;
  readonly chatSubtitle?: string;
  readonly className?: string;
}

function readPositiveInt(raw: string | null, fallback: number): number {
  const n = raw ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return i > 0 ? i : fallback;
}

function readMode(explicitMode?: string): string {
  if (explicitMode && explicitMode.trim().length > 0) return explicitMode;
  if (typeof window === 'undefined') return 'solo';
  return (
    window.sessionStorage.getItem(SESSION_ACTIVE_MODE_KEY) ||
    window.localStorage.getItem(SESSION_ACTIVE_MODE_KEY) ||
    'solo'
  );
}

function modeLabel(mode: string): string {
  switch (mode) {
    case 'asymmetric-pvp':
      return 'Predator';
    case 'co-op':
      return 'Syndicate';
    case 'ghost':
      return 'Phantom';
    default:
      return 'Empire';
  }
}

function defaultDockTab(mode: string): VisibleDockTab {
  if (mode === 'co-op') return 'SYNDICATE';
  if (mode === 'asymmetric-pvp') return 'DEAL_ROOM';
  return 'GLOBAL';
}

function metaTone(value: string): string {
  if (value === 'ACTIVE') return 'pzo-run-meta-pill pzo-run-meta-pill--active';
  if (value === 'ENDED' || value === 'FINALIZED') return 'pzo-run-meta-pill pzo-run-meta-pill--warning';
  return 'pzo-run-meta-pill';
}

const RunScreen = memo(function RunScreen({
  mode,
  modeStage,
  gameCtx,
  title,
  subtitle,
  chatTitle = 'COMMAND COMMS',
  chatSubtitle,
  className = '',
}: RunScreenProps) {
  const run = useEngineStore((s: any) => s.run);
  const pressure = useEngineStore((s: any) => s.pressure);
  const battle = useEngineStore((s: any) => s.battle);
  const cascade = useEngineStore((s: any) => s.cascade);
  const sovereignty = useEngineStore((s: any) => s.sovereignty);

  const { mode: bridgedMode, lifecycleState } = useEngineCSSBridge();

  const storeRunId = run?.runId ?? null;
  const resolvedMode = useMemo(() => readMode(mode) || bridgedMode || 'solo', [mode, bridgedMode]);
  const keyRunId = storeRunId ?? 'boot';
  const isActiveRun = lifecycleState === 'ACTIVE' || run?.lifecycleState === 'ACTIVE';

  const [sessionRunCount, setSessionRunCount] = useState<number>(() => {
    if (typeof window === 'undefined') return 1;
    return readPositiveInt(window.sessionStorage.getItem(SESSION_RUN_COUNT_KEY), 1);
  });

  const resolvedGameCtx = useMemo<GameChatContext>(
    () => gameCtx ?? (createEmptyGameChatContext as any)(),
    [gameCtx],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(SESSION_ACTIVE_MODE_KEY, resolvedMode);
  }, [resolvedMode]);

  useEffect(() => {
    if (typeof window === 'undefined' || !storeRunId) return;

    const lastRunId = window.sessionStorage.getItem(SESSION_LAST_RUN_ID_KEY);
    const currentCount = readPositiveInt(window.sessionStorage.getItem(SESSION_RUN_COUNT_KEY), 1);

    if (lastRunId !== storeRunId) {
      const nextCount = lastRunId ? currentCount + 1 : currentCount;
      window.sessionStorage.setItem(SESSION_RUN_COUNT_KEY, String(nextCount));
      window.sessionStorage.setItem(SESSION_LAST_RUN_ID_KEY, storeRunId);
      setSessionRunCount(nextCount);
    }
  }, [storeRunId]);

  const metaPills = useMemo(
    () => [
      {
        key: 'life',
        className: metaTone(String(lifecycleState || run?.lifecycleState || 'IDLE')),
        label: String(lifecycleState || run?.lifecycleState || 'IDLE'),
      },
      {
        key: 'pressure',
        className:
          (pressure?.isCritical ? 'pzo-run-meta-pill pzo-run-meta-pill--danger' : 'pzo-run-meta-pill pzo-run-meta-pill--warning'),
        label: `Pressure ${pressure?.tier ?? 'CALM'}`,
      },
      {
        key: 'battle',
        className:
          ((battle?.activeBotsCount ?? 0) > 0 ? 'pzo-run-meta-pill pzo-run-meta-pill--danger' : 'pzo-run-meta-pill'),
        label: `${battle?.activeBotsCount ?? 0} hostile`,
      },
      {
        key: 'cascade',
        className:
          (((cascade?.activeNegativeChains as any[])?.length ?? cascade?.activeChainCount ?? 0) > 0
            ? 'pzo-run-meta-pill pzo-run-meta-pill--warning'
            : 'pzo-run-meta-pill'),
        label: `Cascade ${((cascade?.activeNegativeChains as any[])?.length ?? cascade?.activeChainCount ?? 0)}`,
      },
      {
        key: 'proof',
        className: 'pzo-run-meta-pill pzo-run-meta-pill--proof',
        label: `Grade ${sovereignty?.grade ?? '—'}`,
      },
    ],
    [battle, cascade, lifecycleState, pressure, run?.lifecycleState, sovereignty],
  );

  const boardTitle = title ?? `${modeLabel(resolvedMode)} Live Surface`;
  const boardSubtitle = subtitle ?? `run ${storeRunId ?? 'boot'} · session ${sessionRunCount}`;
  const dockSubtitle = chatSubtitle ?? `${modeLabel(resolvedMode)} · ${pressure?.tier ?? 'CALM'}`;

  return (
    <MLProvider key={keyRunId} mode={resolvedMode} sessionRunCount={sessionRunCount}>
      <div className={`pzo-run-root ${className}`.trim()} data-run-mode={resolvedMode}>
        <div className="pzo-run-shell">
          <header className="pzo-run-topbar">
            <div>
              <h1 className="pzo-run-topbar__title">{boardTitle}</h1>
              <div className="pzo-run-topbar__sub">{boardSubtitle}</div>
            </div>
            <div className="pzo-run-topbar__meta">
              {metaPills.map((pill) => (
                <span key={pill.key} className={pill.className}>
                  {pill.label}
                </span>
              ))}
            </div>
          </header>

          <GameHUD isActiveRun={isActiveRun} showIntel={true} />

          <div className="pzo-run-main">
            <div className="pzo-run-main__center">
              <GameBoard mode={resolvedMode} title={modeLabel(resolvedMode)} subtitle={boardSubtitle}>
                {modeStage ?? (
                  <div className="pzo-runtime-placeholder">
                    <div>
                      <h2 className="pzo-runtime-placeholder__title">Mode container not mounted</h2>
                      <p className="pzo-runtime-placeholder__body">
                        The run shell, HUD, CSS bridge, board physics, and omnipresent chat lane are live. Mount the
                        resolved mode container here so Zero lifecycle, board surface, and chat stay in one coherent
                        runtime.
                      </p>
                    </div>
                  </div>
                )}
              </GameBoard>
            </div>

            <aside className="pzo-run-main__chat">
              <div className="pzo-run-chat-card">
                <UnifiedChatDock
                  gameCtx={resolvedGameCtx}
                  title={chatTitle}
                  subtitle={dockSubtitle}
                  startCollapsed={false}
                  defaultTab={defaultDockTab(resolvedMode)}
                  enableThreatMeter={true}
                  enableTranscriptDrawer={true}
                  enableHelperPrompt={true}
                  enableRoomMeta={true}
                  enableLawFooter={true}
                  style={{ height: '100%', maxHeight: '100%' }}
                />
              </div>
            </aside>
          </div>

          <div className="pzo-hand-shell">
            <CardHand />
          </div>
        </div>
      </div>
    </MLProvider>
  );
});

export default RunScreen;
