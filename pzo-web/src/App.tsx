/**
 * ============================================================================
 * POINT ZERO ONE — ROOT APPLICATION
 * FILE: pzo-web/src/App.tsx
 * SPRINT: Engine 0 runtime shell · auth gate · lobby router · HUD + chat mount
 * ============================================================================
 *
 * Intent
 * - Keep AUTH → LOBBY → GAME flow intact.
 * - Stop App.tsx from acting like the local debug dashboard.
 * - Use the real Engine 0 runtime surfaces already in-repo:
 *   - ZeroFacade / EngineOrchestrator
 *   - Zustand engineStore / runStore
 *   - RunHUD / GameHUD
 *   - UnifiedChatDock
 *   - existing mode-specific game screens
 *
 * Notes
 * - ZeroFacade.bind() already performs authoritative one-time store wiring via
 *   ZeroBindings. We intentionally do NOT call wireAllEngineHandlers() here to
 *   avoid duplicate EventBus subscriptions.
 * - LobbyScreen already launches the run through ModeRouter.startRunWithCards().
 *   App only receives the launched context, binds the runtime shell, and routes.
 * - External Next.js bridge (?from=nextjs&mode=...) remains supported.
 *
 * Density6 LLC · Point Zero One · Confidential
 * ============================================================================
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useAuth } from './hooks/useAuth';
import { AuthGate } from './components/auth/AuthGate';
import LobbyScreen from './components/LobbyScreen';

import RunHUD from './features/run/components/RunHUD';
import { UnifiedChatDock } from './components/chat/UnifiedChatDock';
import {
  createEmptyGameChatContext,
  type GameChatContext,
} from './components/chat/chatTypes';

import EmpireGameScreen from './components/EmpireGameScreen';
import PredatorGameScreen from './components/PredatorGameScreen';
import SyndicateGameScreen from './components/SyndicateGameScreen';
import PhantomGameScreen from './components/PhantomGameScreen';

import { useEngineStore } from './store/engineStore';
import { useRunStore } from './store/runStore';

import { ZeroFacade } from './engines/zero/ZeroFacade';
import { orchestrator } from './engines/zero/EngineOrchestrator';
import { createDefaultConfig, ModeRouter } from './engines/modes/ModeRouter';

import type { RunMode } from './engines/core/types';
import type { RunOutcome } from './engines/zero/types';
import { fmtRunId } from './game/core/format';

// ─────────────────────────────────────────────────────────────────────────────
// Screen state
// ─────────────────────────────────────────────────────────────────────────────

type AppScreen = 'AUTH' | 'LOBBY' | 'GAME';

// ─────────────────────────────────────────────────────────────────────────────
// Theme tokens
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  void: '#05050A',
  surface: 'rgba(7, 9, 16, 0.84)',
  surfaceStrong: 'rgba(8, 10, 18, 0.94)',
  panel: 'rgba(12, 15, 24, 0.92)',
  border: 'rgba(255,255,255,0.10)',
  borderStrong: 'rgba(255,255,255,0.18)',
  text: '#F4F7FF',
  textSub: '#A7B3CF',
  textDim: '#697692',
  gold: '#C9A84C',
  green: '#2EE89A',
  orange: '#FF9B2F',
  red: '#FF4D4D',
  indigo: '#818CF8',
  teal: '#2DDBF5',
  mono: "'DM Mono', 'JetBrains Mono', 'Fira Code', monospace",
  display: "'Barlow Condensed', 'Oswald', system-ui, sans-serif",
  body: "'DM Sans', 'Nunito', system-ui, sans-serif",
} as const;

const BASE_DECK_TYPES = [
  'OPPORTUNITY',
  'IPA',
  'FUBAR',
  'MISSED_OPPORTUNITY',
  'PRIVILEGED',
  'SO',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isRunMode(value: unknown): value is RunMode {
  return (
    value === 'solo' ||
    value === 'asymmetric-pvp' ||
    value === 'co-op' ||
    value === 'ghost'
  );
}

function coerceRunMode(value: unknown): RunMode | null {
  return isRunMode(value) ? value : null;
}

function deriveRunModeFromContext(ctx: any): RunMode {
  const ctorName = String(ctx?.modeEngine?.constructor?.name ?? '');
  if (ctorName.includes('Predator')) return 'asymmetric-pvp';
  if (ctorName.includes('Syndicate')) return 'co-op';
  if (ctorName.includes('Phantom')) return 'ghost';
  if (ctorName.includes('Empire')) return 'solo';

  const cardMode = String(ctx?.cardEngine?.getMode?.() ?? '');
  if (cardMode === 'HEAD_TO_HEAD') return 'asymmetric-pvp';
  if (cardMode === 'TEAM_UP') return 'co-op';
  if (cardMode === 'CHASE_A_LEGEND') return 'ghost';
  return 'solo';
}

function buildExternalRunConfig(
  mode: RunMode,
  user?: { id?: string; username?: string | null },
  seedOverride?: string | null,
) {
  const base = createDefaultConfig(mode);

  return {
    ...base,
    mode,
    userId: user?.id ?? 'player_01',
    username: user?.username ?? 'PLAYER_1',
    seedOverride: seedOverride ?? undefined,
    deckConfig: {
      enabledDeckTypes: [...BASE_DECK_TYPES],
    },
  } as any;
}

function deriveRegime(params: {
  pressureTier?: string | null;
  tensionScore?: number;
  haterHeat?: number;
  shieldPct?: number;
  cashflow?: number;
}): string {
  const pressureTier = String(params.pressureTier ?? 'CALM');
  const tensionScore = Number(params.tensionScore ?? 0);
  const haterHeat = Number(params.haterHeat ?? 0);
  const shieldPct = Number(params.shieldPct ?? 100);
  const cashflow = Number(params.cashflow ?? 0);

  if (
    pressureTier === 'CRITICAL' ||
    tensionScore >= 0.82 ||
    haterHeat >= 0.78 ||
    shieldPct <= 25
  ) {
    return 'PANIC';
  }

  if (
    pressureTier === 'HIGH' ||
    tensionScore >= 0.6 ||
    haterHeat >= 0.55 ||
    cashflow < 0
  ) {
    return 'COMPRESSION';
  }

  if (cashflow > 0 && shieldPct >= 60) {
    return 'EXPANSION';
  }

  return 'STABLE';
}

function buildRuntimeEvents(params: {
  lifecycleState: string;
  pressureTier?: string | null;
  tickTier?: string | null;
  timeoutImminent?: boolean;
  activeBotsCount?: number;
  activeNegativeChains?: number;
  decisionWindows?: number;
  isBreachCascade?: boolean;
  grade?: string | null;
}): string[] {
  const events: string[] = [];

  events.push(`Lifecycle:${params.lifecycleState}`);
  if (params.pressureTier) events.push(`Pressure:${params.pressureTier}`);
  if (params.tickTier) events.push(`Tick:${params.tickTier}`);
  if (params.timeoutImminent) events.push('Timeout imminent');
  if ((params.activeBotsCount ?? 0) > 0) events.push(`Bots:${params.activeBotsCount}`);
  if ((params.activeNegativeChains ?? 0) > 0) {
    events.push(`Cascade chains:${params.activeNegativeChains}`);
  }
  if ((params.decisionWindows ?? 0) > 0) {
    events.push(`Decision windows:${params.decisionWindows}`);
  }
  if (params.isBreachCascade) events.push('Shield breach cascade');
  if (params.grade) events.push(`Grade:${params.grade}`);

  return events;
}

function modeLabel(mode: RunMode | null): string {
  switch (mode) {
    case 'solo':
      return 'EMPIRE';
    case 'asymmetric-pvp':
      return 'PREDATOR';
    case 'co-op':
      return 'SYNDICATE';
    case 'ghost':
      return 'PHANTOM';
    default:
      return 'UNBOUND';
  }
}

function LaunchOverlay({ label }: { label: string }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        background:
          'radial-gradient(circle at 20% 20%, rgba(129,140,248,0.10), transparent 28%), radial-gradient(circle at 80% 80%, rgba(201,168,76,0.08), transparent 28%), #05050A',
        color: C.text,
        fontFamily: C.body,
      }}
    >
      <div
        style={{
          width: 'min(560px, calc(100vw - 32px))',
          borderRadius: 18,
          border: `1px solid ${C.border}`,
          background: C.surfaceStrong,
          padding: '26px 24px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
        }}
      >
        <div
          style={{
            fontFamily: C.display,
            fontSize: 30,
            fontWeight: 800,
            letterSpacing: '0.08em',
            color: C.gold,
          }}
        >
          POINT ZERO ONE
        </div>
        <div
          style={{
            marginTop: 8,
            fontFamily: C.mono,
            fontSize: 12,
            color: C.textSub,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
          }}
        >
          Launching runtime
        </div>
        <div
          style={{
            marginTop: 18,
            padding: '12px 14px',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${C.border}`,
            fontFamily: C.mono,
            fontSize: 12,
            color: C.textSub,
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

function StatusPill({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        borderRadius: 999,
        background: `${color}14`,
        border: `1px solid ${color}3A`,
        color,
        fontFamily: C.mono,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 12px ${color}`,
        }}
      />
      {label}
    </span>
  );
}

function CommandButton({
  label,
  onClick,
  tone = 'default',
}: {
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger' | 'success';
}) {
  const color =
    tone === 'danger' ? C.red : tone === 'success' ? C.green : C.textSub;

  return (
    <button
      onClick={onClick}
      style={{
        padding: '9px 12px',
        borderRadius: 10,
        background: `${color}12`,
        border: `1px solid ${color}30`,
        color,
        cursor: 'pointer',
        fontFamily: C.mono,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        backdropFilter: 'blur(12px)',
      }}
    >
      {label}
    </button>
  );
}

function UserBadge({
  username,
  displayName,
}: {
  username: string;
  displayName: string;
}) {
  const initial = (displayName || username).charAt(0).toUpperCase();

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 12px 7px 8px',
        borderRadius: 999,
        border: `1px solid ${C.border}`,
        background: C.surface,
        backdropFilter: 'blur(14px)',
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          color: '#FFFFFF',
          fontFamily: C.mono,
          fontSize: 11,
          fontWeight: 800,
        }}
      >
        {initial}
      </div>
      <div>
        <div
          style={{
            color: C.text,
            fontFamily: C.mono,
            fontSize: 11,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          {displayName}
        </div>
        <div
          style={{
            color: C.textDim,
            fontFamily: C.mono,
            fontSize: 9,
            marginTop: 2,
            lineHeight: 1,
          }}
        >
          @{username}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Runtime shell
// ─────────────────────────────────────────────────────────────────────────────

function GameRuntimeShell({
  mode,
  zero,
  user,
  isExternalLaunch,
  onBackToLobby,
  onLogout,
  onEndRun,
}: {
  mode: RunMode;
  zero: ZeroFacade;
  user?: {
    id?: string;
    username: string;
    displayName?: string | null;
  } | null;
  isExternalLaunch: boolean;
  onBackToLobby: () => void;
  onLogout: () => void;
  onEndRun: (outcome: RunOutcome) => void;
}) {
  const run = useEngineStore((state) => state.run);
  const time = useEngineStore((state) => state.time);
  const pressure = useEngineStore((state) => state.pressure);
  const tension = useEngineStore((state) => state.tension);
  const shield = useEngineStore((state) => state.shield);
  const battle = useEngineStore((state) => state.battle);
  const cascade = useEngineStore((state) => state.cascade);
  const sovereignty = useEngineStore((state) => state.sovereignty);

  const netWorth = useRunStore((state) => state.netWorth);
  const cashBalance = useRunStore((state) => state.cashBalance);
  const monthlyIncome = useRunStore((state) => state.monthlyIncome);
  const monthlyExpenses = useRunStore((state) => state.monthlyExpenses);
  const cashflow = useRunStore((state) => state.cashflow);
  const haterHeat = useRunStore((state) => state.haterHeat);

  const lifecycleState = run.lifecycleState ?? 'IDLE';
  const isRunActive =
    lifecycleState === 'ACTIVE' ||
    lifecycleState === 'STARTING' ||
    lifecycleState === 'TICK_LOCKED';

  const runtimeStatus = useMemo(() => zero.getRuntimeStatus(), [
    zero,
    lifecycleState,
    run.lastTickIndex,
    pressure.tier,
    tension.score,
    shield.overallIntegrityPct,
    sovereignty.grade,
  ]);

  const regime = useMemo(
    () =>
      deriveRegime({
        pressureTier: pressure.tier,
        tensionScore: tension.score,
        haterHeat,
        shieldPct: shield.overallIntegrityPct,
        cashflow,
      }),
    [pressure.tier, tension.score, haterHeat, shield.overallIntegrityPct, cashflow],
  );

  const gameCtx: GameChatContext = useMemo(
    () =>
      createEmptyGameChatContext({
        tick: run.lastTickIndex ?? time.ticksElapsed ?? 0,
        cash: cashBalance,
        netWorth,
        income: monthlyIncome,
        expenses: monthlyExpenses,
        regime,
        events: buildRuntimeEvents({
          lifecycleState,
          pressureTier: pressure.tier,
          tickTier: time.currentTier,
          timeoutImminent: time.seasonTimeoutImminent,
          activeBotsCount: battle.activeBotsCount,
          activeNegativeChains: cascade.activeNegativeChains.length,
          decisionWindows: time.activeDecisionWindows.length,
          isBreachCascade: shield.isInBreachCascade,
          grade: sovereignty.grade,
        }),
        pressureTier: pressure.tier ?? undefined,
        tickTier: time.currentTier ?? undefined,
        haterHeat,
        runOutcome: run.outcome ?? undefined,
        roomId: run.runId ?? undefined,
        sessionId: run.seed ?? undefined,
        playerId: user?.id ?? run.userId ?? undefined,
        playerName: user?.displayName ?? user?.username ?? run.userId ?? 'PLAYER',
        activeChannel: mode === 'co-op' ? 'SYNDICATE' : 'GLOBAL',
        connectionState: isRunActive ? 'CONNECTED' : 'DEGRADED',
      }),
    [
      battle.activeBotsCount,
      cashBalance,
      cascade.activeNegativeChains.length,
      haterHeat,
      isRunActive,
      lifecycleState,
      mode,
      monthlyExpenses,
      monthlyIncome,
      netWorth,
      pressure.tier,
      regime,
      run.lastTickIndex,
      run.outcome,
      run.runId,
      run.seed,
      run.userId,
      shield.isInBreachCascade,
      sovereignty.grade,
      time.activeDecisionWindows.length,
      time.currentTier,
      time.seasonTimeoutImminent,
      time.ticksElapsed,
      user?.displayName,
      user?.id,
      user?.username,
    ],
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    root.style.setProperty('--pzo-engine-pressure', `${Math.max(0, Math.min(1, pressure.score))}`);
    root.style.setProperty('--pzo-engine-tension', `${Math.max(0, Math.min(1, tension.score))}`);
    root.style.setProperty('--pzo-engine-shield', `${Math.max(0, Math.min(1, shield.overallIntegrityPct / 100))}`);
    root.style.setProperty('--pzo-engine-heat', `${Math.max(0, Math.min(1, haterHeat))}`);
    root.style.setProperty('--pzo-engine-cascade', `${Math.max(0, Math.min(1, cascade.activeNegativeChains.length / 5))}`);
    root.style.setProperty('--pzo-engine-time', `${Math.max(0, Math.min(1, time.ticksRemaining / Math.max(1, time.seasonTickBudget || 1)))}`);
  }, [
    pressure.score,
    tension.score,
    shield.overallIntegrityPct,
    haterHeat,
    cascade.activeNegativeChains.length,
    time.ticksRemaining,
    time.seasonTickBudget,
  ]);

  const modeScreen = useMemo(() => {
    switch (mode) {
      case 'solo':
        return <EmpireGameScreen onCardCounterplay={undefined} onIgnoreCard={undefined} />;
      case 'asymmetric-pvp':
        return <PredatorGameScreen {...({} as any)} />;
      case 'co-op':
        return <SyndicateGameScreen {...({} as any)} />;
      case 'ghost':
        return <PhantomGameScreen {...({} as any)} />;
      default:
        return <EmpireGameScreen onCardCounterplay={undefined} onIgnoreCard={undefined} />;
    }
  }, [mode]);

  return (
    <div
      style={{
        minHeight: '100dvh',
        position: 'relative',
        overflow: 'hidden',
        background:
          'radial-gradient(circle at 16% 18%, rgba(201,168,76,0.08), transparent 22%), radial-gradient(circle at 82% 18%, rgba(129,140,248,0.10), transparent 20%), radial-gradient(circle at 80% 84%, rgba(45,219,245,0.08), transparent 24%), #05050A',
        fontFamily: C.body,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=DM+Mono:wght@400;500;700&family=DM+Sans:wght@400;500;700&display=swap');

        :root {
          --pzo-engine-pressure: 0;
          --pzo-engine-tension: 0;
          --pzo-engine-shield: 1;
          --pzo-engine-heat: 0;
          --pzo-engine-cascade: 0;
          --pzo-engine-time: 1;
        }

        * { box-sizing: border-box; }

        .pzo-shell-overlay {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 20;
        }

        .pzo-shell-vignette {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at center, transparent 38%, rgba(0,0,0, calc(var(--pzo-engine-pressure) * 0.26)) 100%),
            radial-gradient(circle at center, transparent 50%, rgba(255, 77, 77, calc(var(--pzo-engine-heat) * 0.10)) 100%);
          pointer-events: none;
        }

        .pzo-command-rail,
        .pzo-chat-wrap,
        .pzo-hud-wrap {
          pointer-events: auto;
        }

        .pzo-command-rail {
          position: fixed;
          top: 14px;
          left: 14px;
          right: 14px;
          z-index: 30;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .pzo-hud-wrap {
          position: fixed;
          top: 78px;
          left: 14px;
          right: min(344px, 28vw);
          z-index: 28;
        }

        .pzo-chat-wrap {
          position: fixed;
          top: 78px;
          right: 14px;
          bottom: 14px;
          width: min(340px, calc(100vw - 28px));
          z-index: 29;
        }

        .pzo-runtime-header {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px 14px;
          border-radius: 16px;
          border: 1px solid ${C.border};
          background: ${C.surfaceStrong};
          backdrop-filter: blur(16px);
          box-shadow: 0 18px 50px rgba(0,0,0,0.35);
        }

        .pzo-runtime-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
        }

        .pzo-runtime-title {
          margin: 0;
          font-family: ${C.display};
          font-size: clamp(24px, 4vw, 34px);
          font-weight: 900;
          line-height: 0.95;
          color: ${C.gold};
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .pzo-runtime-subtitle {
          margin: 0;
          color: ${C.textDim};
          font-family: ${C.mono};
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .pzo-runtime-meta {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        @media (max-width: 1100px) {
          .pzo-chat-wrap {
            width: min(320px, calc(100vw - 28px));
          }

          .pzo-hud-wrap {
            right: min(320px, 34vw);
          }
        }

        @media (max-width: 860px) {
          .pzo-command-rail {
            position: sticky;
            top: 0;
            z-index: 30;
            padding-top: 14px;
          }

          .pzo-hud-wrap {
            position: relative;
            top: auto;
            left: auto;
            right: auto;
            margin: 14px;
          }

          .pzo-chat-wrap {
            position: relative;
            top: auto;
            right: auto;
            bottom: auto;
            width: auto;
            margin: 0 14px 14px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation: none !important;
            transition: none !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>

      <div>{modeScreen}</div>

      <div className="pzo-shell-overlay">
        <div className="pzo-shell-vignette" />
      </div>

      <div className="pzo-command-rail">
        <div className="pzo-runtime-header">
          <h1 className="pzo-runtime-title">POINT ZERO ONE</h1>
          <p className="pzo-runtime-subtitle">
            Density6 · Engine 0 runtime shell · {modeLabel(mode)}
          </p>
          <div className="pzo-runtime-meta">
            <StatusPill
              label={lifecycleState}
              color={
                lifecycleState === 'ACTIVE'
                  ? C.green
                  : lifecycleState === 'ENDED'
                    ? C.orange
                    : C.textSub
              }
            />
            {pressure.tier ? (
              <StatusPill
                label={`Pressure ${pressure.tier}`}
                color={pressure.isCritical ? C.red : C.gold}
              />
            ) : null}
            {time.seasonTimeoutImminent ? (
              <StatusPill label="Timeout imminent" color={C.orange} />
            ) : null}
            {(cascade.activeNegativeChains?.length ?? 0) > 0 ? (
              <StatusPill
                label={`Cascade ${(cascade.activeNegativeChains?.length ?? 0)}`}
                color={C.red}
              />
            ) : null}
            {sovereignty.grade ? (
              <StatusPill
                label={`Grade ${sovereignty.grade}`}
                color={['S', 'A'].includes(String(sovereignty.grade)) ? C.gold : C.textSub}
              />
            ) : null}
          </div>
          <div
            style={{
              color: C.textSub,
              fontFamily: C.mono,
              fontSize: 10,
              letterSpacing: '0.08em',
            }}
          >
            RUN {run.runId ? fmtRunId(run.runId) : 'UNINITIALIZED'} · HEALTH {runtimeStatus.lifecycleState}
          </div>
        </div>

        <div className="pzo-runtime-actions">
          {user ? (
            <UserBadge
              username={user.username}
              displayName={user.displayName ?? user.username}
            />
          ) : null}
          {!isExternalLaunch ? (
            <CommandButton label="Lobby" onClick={onBackToLobby} />
          ) : (
            <CommandButton
              label="Return"
              onClick={onBackToLobby}
            />
          )}
          <CommandButton label="Freedom" tone="success" onClick={() => onEndRun('FREEDOM')} />
          <CommandButton label="Bankrupt" tone="danger" onClick={() => onEndRun('BANKRUPT')} />
          <CommandButton label="Abandon" tone="danger" onClick={() => onEndRun('ABANDONED')} />
          {user ? <CommandButton label="Sign out" onClick={onLogout} /> : null}
        </div>
      </div>

      <div className="pzo-hud-wrap">
        <RunHUD
          isActiveRun={lifecycleState !== 'IDLE'}
          showIntel={true}
          style={{
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 18px 50px rgba(0,0,0,0.32)',
          }}
        />
      </div>

      <aside className="pzo-chat-wrap">
        <UnifiedChatDock
          gameCtx={gameCtx}
          title="COMMAND COMMS"
          subtitle={`${modeLabel(mode)} · ${regime}`}
          startCollapsed={false}
          enableThreatMeter={true}
          enableTranscriptDrawer={true}
          enableHelperPrompt={true}
          enableRoomMeta={true}
          enableLawFooter={true}
          defaultTab={mode === 'co-op' ? 'SYNDICATE' : 'GLOBAL'}
          style={{
            height: '100%',
            maxHeight: '100%',
          }}
        />
      </aside>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  const auth = useAuth();

  const externalLaunchRef = useRef<boolean>(
    typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('from') === 'nextjs',
  );

  const zeroRef = useRef<ZeroFacade | null>(null);
  if (!zeroRef.current) {
    zeroRef.current = new ZeroFacade(orchestrator);
  }

  const zero = zeroRef.current;

  const [screen, setScreen] = useState<AppScreen>(
    externalLaunchRef.current ? 'GAME' : 'AUTH',
  );
  const [runMode, setRunMode] = useState<RunMode | null>(null);
  const [externalBootError, setExternalBootError] = useState<string | null>(null);

  const activeRunContextRef = useRef<any | null>(null);

  const destroyRunContext = useCallback(() => {
    try {
      activeRunContextRef.current?.teardown?.();
    } catch (error) {
      console.warn('[App] teardown() failed:', error);
    } finally {
      activeRunContextRef.current = null;
    }
  }, []);

  const resetRuntime = useCallback(
    (clearMode = true) => {
      destroyRunContext();

      try {
        zero.reset({ rebindAfterReset: true });
      } catch (error) {
        console.warn('[App] zero.reset() failed:', error);
      }

      try {
        useEngineStore.getState().resetAllSlices?.();
      } catch (error) {
        console.warn('[App] engineStore resetAllSlices() failed:', error);
      }

      try {
        useRunStore.getState().reset?.();
      } catch (error) {
        console.warn('[App] runStore reset() failed:', error);
      }

      if (clearMode) {
        setRunMode(null);
      }
    },
    [destroyRunContext, zero],
  );

  useEffect(() => {
    if (runMode) {
      zero.bind({
        mode: runMode,
        wireStoreHandlers: true,
        wireRunMirror: true,
        registerDefaultChannels: true,
      });
    } else {
      zero.bind({
        wireStoreHandlers: true,
        wireRunMirror: true,
        registerDefaultChannels: true,
      });
    }
  }, [runMode, zero]);

  useEffect(() => {
    if (externalLaunchRef.current) return;

    if (auth.user && screen === 'AUTH') {
      setScreen('LOBBY');
      return;
    }

    if (!auth.user && !auth.loading && screen !== 'AUTH') {
      setScreen('AUTH');
    }
  }, [auth.loading, auth.user, screen]);

  const handleAuthSuccess = useCallback(() => {
    setScreen('LOBBY');
  }, []);

  const handleLobbyLaunch = useCallback(
    (ctx: any) => {
      const mode = deriveRunModeFromContext(ctx);
      destroyRunContext();
      activeRunContextRef.current = ctx;
      setRunMode(mode);
      setScreen('GAME');
      setExternalBootError(null);
    },
    [destroyRunContext],
  );

  const handleLegacyStart = useCallback((mode: RunMode) => {
    setRunMode(mode);
    setScreen('GAME');
    setExternalBootError(null);
  }, []);

  const handleBackToLobby = useCallback(() => {
    if (externalLaunchRef.current) {
      try {
        if (window.opener) {
          window.opener.postMessage({ type: 'PZO_BACK_TO_LOBBY' }, '*');
        }
      } catch {
        // no-op
      }

      resetRuntime();
      window.location.href = '/play';
      return;
    }

    resetRuntime();
    setScreen(auth.user ? 'LOBBY' : 'AUTH');
  }, [auth.user, resetRuntime]);

  const handleLogout = useCallback(async () => {
    resetRuntime();
    try {
      await auth.logout();
    } finally {
      setScreen('AUTH');
    }
  }, [auth, resetRuntime]);

  const handleEndRun = useCallback(
    async (outcome: RunOutcome) => {
      try {
        await zero.endRun(outcome);
      } catch (error) {
        console.error('[App] endRun failed:', error);
      } finally {
        destroyRunContext();
      }
    },
    [destroyRunContext, zero],
  );

  useEffect(() => {
    if (!externalLaunchRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const mode = coerceRunMode(params.get('mode'));

    if (!mode) {
      setExternalBootError('External launch requested without a valid mode.');
      return;
    }

    let cancelled = false;

    const boot = async () => {
      try {
        setExternalBootError(null);
        resetRuntime(false);

        const ctx = await ModeRouter.startRunWithCards(
          mode,
          buildExternalRunConfig(mode, auth.user ?? undefined, params.get('seed')),
          auth.user?.id ?? 'player_01',
        );

        if (cancelled) {
          try {
            ctx?.teardown?.();
          } catch {
            // no-op
          }
          return;
        }

        activeRunContextRef.current = ctx;
        setRunMode(mode);
        setScreen('GAME');
      } catch (error) {
        console.error('[App] external launch failed:', error);
        setExternalBootError(
          error instanceof Error
            ? error.message
            : 'External launch failed.',
        );
      }
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, [auth.user, resetRuntime]);

  useEffect(() => {
    return () => {
      destroyRunContext();
    };
  }, [destroyRunContext]);

  if (auth.loading && !externalLaunchRef.current && screen !== 'GAME') {
    return <LaunchOverlay label="Checking session and preparing auth gate…" />;
  }

  if (screen === 'AUTH' || (!auth.user && !auth.loading && !externalLaunchRef.current)) {
    return <AuthGate onAuth={handleAuthSuccess} auth={auth} />;
  }

  if (screen === 'LOBBY') {
    return (
      <LobbyScreen
        onStartWithContext={handleLobbyLaunch}
        onStart={handleLegacyStart}
        onLogout={handleLogout}
        user={auth.user ? {
          userId: auth.user.id,
          username: auth.user.username,
          displayName: auth.user.displayName ?? auth.user.username,
        } : undefined}
      />
    );
  }

  if (!runMode) {
    return (
      <LaunchOverlay
        label={
          externalBootError
            ? `Runtime boot error: ${externalBootError}`
            : 'Preparing mode runtime, binding Engine 0, and mounting HUD + chat…'
        }
      />
    );
  }

  return (
    <GameRuntimeShell
      mode={runMode}
      zero={zero}
      user={auth.user ? {
        id: auth.user.id,
        username: auth.user.username,
        displayName: auth.user.displayName ?? auth.user.username,
      } : null}
      isExternalLaunch={externalLaunchRef.current}
      onBackToLobby={handleBackToLobby}
      onLogout={handleLogout}
      onEndRun={handleEndRun}
    />
  );
};

export default App;
