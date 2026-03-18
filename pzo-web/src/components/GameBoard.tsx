/**
 * GameBoard.tsx — Live equity chart + macro state display
 * Rebuilt: Syne + IBM Plex Mono · Inline styles · Mobile-first · High contrast
 * FIX: replaced all .at() calls with bracket indexing for ES2021 lib compatibility
 * Density6 LLC · Confidential
 */

'use client';

import React, { useMemo, type ReactNode } from 'react';
import { useTimeEngine } from '../features/run/hooks/useTimeEngine';
import { usePressureEngine } from '../features/run/hooks/usePressureEngine';
import { useShieldEngine } from '../features/run/hooks/useShieldEngine';
import { useBattleEngine } from '../features/run/hooks/useBattleEngine';
import { useCascadeEngine } from '../features/run/hooks/useCascadeEngine';
import { useSovereigntyEngine } from '../features/run/hooks/useSovereigntyEngine';

type AnyDict = Record<string, unknown>;

export interface GameBoardProps {
  mode?: string;
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
  className?: string;
  children?: ReactNode;
}

function asDict(value: unknown): AnyDict {
  return value && typeof value === 'object' ? (value as AnyDict) : {};
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown, fallback = '—'): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function pct(value: number): string {
  return `${Math.round(clamp01(value) * 100)}%`;
}

function modeClass(mode: string): string {
  switch (mode) {
    case 'asymmetric-pvp':
      return 'predator';
    case 'co-op':
      return 'syndicate';
    case 'ghost':
      return 'phantom';
    default:
      return 'empire';
  }
}

export default function GameBoard({
  mode = 'solo',
  title,
  subtitle,
  footer,
  className = '',
  children,
}: GameBoardProps) {
  const time = asDict(useTimeEngine());
  const pressure = asDict(usePressureEngine());
  const shield = asDict(useShieldEngine());
  const battle = asDict(useBattleEngine());
  const cascade = asDict(useCascadeEngine());
  const sovereignty = asDict(useSovereigntyEngine());

  const boardModel = useMemo(() => {
    const pressureScore = clamp01(num(pressure.score, num(pressure.intensity, 0)) > 1 ? num(pressure.score, 0) / 100 : num(pressure.score, num(pressure.intensity, 0)));
    const shieldScore = clamp01(
      num(shield.overallPct, num(shield.integrity, num(shield.overallIntegrityPct, 0))) > 1
        ? num(shield.overallPct, num(shield.integrity, num(shield.overallIntegrityPct, 0))) / 100
        : num(shield.overallPct, num(shield.integrity, num(shield.overallIntegrityPct, 0))),
    );
    const battleScore = clamp01(num(battle.intensity, num(battle.haterHeat, 0)) > 1 ? num(battle.intensity, num(battle.haterHeat, 0)) / 100 : num(battle.intensity, num(battle.haterHeat, 0)));
    const cascadeScore = clamp01(num(cascade.chainStrength, num(cascade.activeChainCount, 0)) > 1 ? num(cascade.chainStrength, num(cascade.activeChainCount, 0)) / 100 : num(cascade.chainStrength, num(cascade.activeChainCount, 0)));
    const sovereigntyScore = clamp01(num(sovereignty.sovereigntyScore, num(sovereignty.score, 0)) > 1 ? num(sovereignty.sovereigntyScore, num(sovereignty.score, 0)) / 100 : num(sovereignty.sovereigntyScore, num(sovereignty.score, 0)));
    const timeRemaining = clamp01(
      num(time.remainingPct, 0) > 1
        ? num(time.remainingPct, 0) / 100
        : num(time.remainingPct, readTicksRemaining(time) / Math.max(1, readTickBudget(time))),
    );

    const chips = [
      { key: 'time', label: `T${Math.round(num(time.ticksElapsed, num(time.tick, 0)))}`, value: `${Math.round(readTicksRemaining(time))} LEFT` },
      { key: 'pressure', label: str(pressure.tier, 'CALM'), value: pct(pressureScore) },
      { key: 'shield', label: `${Math.round(shieldScore * 100)}%`, value: str(shield.weakestLayerId, 'ALL LAYERS') },
      { key: 'battle', label: `${Math.round(num(battle.activeBotsCount, 0))} LIVE`, value: pct(battleScore) },
      { key: 'cascade', label: `${Math.round(num(cascade.activeChainCount, (Array.isArray(cascade.activeNegativeChains) ? cascade.activeNegativeChains.length : 0)))} CHAINS`, value: pct(cascadeScore) },
      { key: 'proof', label: str(sovereignty.grade, 'PROOF'), value: str(sovereignty.pipelineStatus, 'IDLE') },
    ];

    return {
      pressureScore,
      shieldScore,
      battleScore,
      cascadeScore,
      sovereigntyScore,
      timeRemaining,
      chips,
      lifecycleText: `${str(time.currentTier, str(time.tickTier, 'TIER'))} · ${str(sovereignty.integrityStatus, 'UNVERIFIED')}`,
      footerText:
        str(sovereignty.proofHash, '').slice(0, 12) ||
        `${Math.round(num(cascade.totalLinksDefeated, 0))} links cut · ${Math.round(num(battle.activeBotsCount, 0))} hostile actors`,
    };
  }, [battle, cascade, pressure, shield, sovereignty, time]);

  const stageTitle = title ?? `${labelForMode(mode)} Board`;
  const stageSubtitle = subtitle ?? boardModel.lifecycleText;
  const modeTone = modeClass(mode);
  const slotFlags = buildSlotFlags(boardModel.shieldScore, boardModel.battleScore);

  return (
    <section className={`pzo-board-shell ${className}`.trim()} data-board-mode={modeTone} aria-label="Game board shell">
      <div className="pzo-board-stage">
        <div className="pzo-board-grid" aria-hidden="true">
          {slotFlags.map((flag, index) => (
            <div
              key={`board-slot-${index}`}
              className={[
                'pzo-board-grid__slot',
                flag === 'shield' ? 'pzo-board-grid__slot--shield' : '',
                flag === 'battle' ? 'pzo-board-grid__slot--battle' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
          ))}
        </div>

        <div className="pzo-board-stage__header">
          <div>
            <h2 className="pzo-board-stage__title">{stageTitle}</h2>
            <div className="pzo-board-stage__subtitle">{stageSubtitle}</div>
          </div>
          <div className="pzo-board-stage__chips">
            {boardModel.chips.map((chip) => (
              <div className="pzo-board-stage__chip" key={chip.key}>
                <span>{chip.label}</span>
                <strong>{chip.value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="pzo-board-stage__content">
          <div className="pzo-board-stage__inner">
            {children ? (
              children
            ) : (
              <div className="pzo-board-stage__empty">
                <div className="pzo-board-stage__empty-copy">
                  <h3 className="pzo-board-stage__empty-title">Mode surface not mounted</h3>
                  <p className="pzo-board-stage__empty-body">
                    The board shell is live and reacting to engine physics. Mount the resolved mode container here so the
                    run surface inherits the pressure vignette, shield glow, battle edge, cascade haze, and sovereignty
                    saturation.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="pzo-board-stage__footer">
          <div className="pzo-board-stage__footer-copy">{boardModel.footerText}</div>
          <div className="pzo-board-stage__footer-copy">
            TIME {pct(boardModel.timeRemaining)} · PRESSURE {pct(boardModel.pressureScore)} · SOV {pct(boardModel.sovereigntyScore)}
          </div>
        </div>

        <div className="pzo-mode-aura" aria-hidden="true" />
      </div>
      {footer ?? null}
    </section>
  );
}

function readTickBudget(time: AnyDict): number {
  return Math.max(
    1,
    num(time.seasonTickBudget, num(time.tickBudget, num(time.totalTicks, 100))),
  );
}

function readTicksRemaining(time: AnyDict): number {
  return num(
    time.ticksRemaining,
    num(time.ticksUntilTimeout, Math.max(0, readTickBudget(time) - num(time.ticksElapsed, num(time.tick, 0)))),
  );
}

function labelForMode(mode: string): string {
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

function buildSlotFlags(shieldScore: number, battleScore: number): Array<'neutral' | 'shield' | 'battle'> {
  return Array.from({ length: 12 }, (_, index) => {
    if (battleScore >= 0.7 && [1, 2, 5, 6, 9].includes(index)) return 'battle';
    if (shieldScore >= 0.55 && [0, 3, 4, 7, 8, 11].includes(index)) return 'shield';
    return 'neutral';
  });
}
