// FILE: pzo-web/src/features/run/components/CardHand.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useEngineStore } from '../../../store/engineStore';
import {
  GameMode,
  TimingClass,
  type CardInHand,
  type CardPlayRequest,
} from '../../../engines/cards/types';
import {
  useCardHand,
  getCardCostLabel,
  getTrustModifierLabel,
  getDivergenceLabel,
} from '../hooks/useCardHand';
import { useAllDecisionWindows } from '../hooks/useDecisionWindow';
import { DecisionTimerRing } from './DecisionTimerRing';
import { CardSlot } from './CardSlot';

/**
 * POINT ZERO ONE — CARD HAND
 * Production-ready run-hand surface aligned to HUD language and engine timing.
 *
 * Key guarantees:
 * - Pure CardSlot display contract (`onPlay(): void`)
 * - DecisionTimerRing owns timing visuals
 * - Empire hold-slot support with long-press + keyboard hold
 * - Drag-to-play + click-to-play + keyboard play
 * - Forced-card prioritization
 * - Robust long-press suppression so hold does not accidentally trigger play
 * - Store-safe mode extras without runtime require hacks
 */

const STYLE_ID = 'pzo-card-hand-styles-v3';

const HAND_STYLES = `
  .pzo-hand-root{
    --hud-bg:#080a0d;
    --hud-panel:#0c0f14;
    --hud-panel-soft:rgba(12,15,20,0.92);
    --hud-border:#1a2030;
    --hud-border-soft:rgba(26,32,48,0.95);
    --hud-amber:#c9a84c;
    --hud-amber-soft:rgba(201,168,76,0.10);
    --hud-amber-glow:rgba(201,168,76,0.16);
    --hud-crimson:#c0392b;
    --hud-crimson-soft:rgba(192,57,43,0.10);
    --hud-crimson-glow:rgba(192,57,43,0.20);
    --hud-teal:#1de9b6;
    --hud-purple:#7c3aed;
    --hud-muted:#3a4a60;
    --hud-text:#8fa0b8;
    --hud-text-bright:#c8d8f0;
    --font-ui:var(--font-ui, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
    --font-mono:var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace);

    position:relative;
    display:flex;
    flex-direction:column;
    gap:10px;
    width:100%;
    padding:8px 8px 12px;
    user-select:none;
    isolation:isolate;
  }

  .pzo-hand-ribbon{
    display:flex;
    align-items:center;
    justify-content:center;
    flex-wrap:wrap;
    gap:8px;
    min-height:32px;
  }

  .pzo-hand-chip{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    min-height:28px;
    padding:6px 10px;
    border-radius:8px;
    background:linear-gradient(180deg, rgba(12,15,20,0.96), rgba(8,10,13,0.92));
    border:1px solid var(--hud-border-soft);
    color:var(--hud-text-bright);
    font-family:var(--font-mono);
    font-size:10px;
    letter-spacing:.14em;
    text-transform:uppercase;
    box-shadow:0 10px 22px rgba(0,0,0,.38);
    white-space:nowrap;
  }

  .pzo-hand-chip--amber{
    color:var(--hud-amber);
    border-color:rgba(201,168,76,0.55);
    background:linear-gradient(180deg, rgba(201,168,76,0.10), rgba(12,15,20,0.94));
    box-shadow:0 0 14px var(--hud-amber-glow), 0 10px 22px rgba(0,0,0,.38);
  }

  .pzo-hand-chip--teal{
    color:var(--hud-teal);
    border-color:rgba(29,233,182,0.35);
  }

  .pzo-hand-chip--danger{
    color:var(--hud-crimson);
    border-color:rgba(192,57,43,0.62);
    background:linear-gradient(180deg, rgba(192,57,43,0.12), rgba(12,15,20,0.94));
    box-shadow:0 0 16px var(--hud-crimson-glow), 0 10px 22px rgba(0,0,0,.38);
  }

  .pzo-hand-workspace{
    display:flex;
    align-items:flex-end;
    justify-content:center;
    gap:12px;
    min-width:0;
  }

  .pzo-hand{
    position:relative;
    display:flex;
    align-items:flex-end;
    justify-content:center;
    min-width:0;
    width:max-content;
    max-width:100%;
    padding:10px 10px 12px;
    border-radius:12px;
    background:
      radial-gradient(circle at top center, rgba(201,168,76,0.05), transparent 42%),
      linear-gradient(180deg, rgba(12,15,20,0.96), rgba(8,10,13,0.92));
    border:1px solid var(--hud-border-soft);
    box-shadow:0 14px 30px rgba(0,0,0,.44);
    overflow:visible;
  }

  .pzo-hand__slot{
    position:relative;
    outline:none;
    filter:drop-shadow(0 12px 18px rgba(0,0,0,.42));
    will-change:transform;
  }

  .pzo-hand__slot--hovered{
    filter:drop-shadow(0 18px 26px rgba(0,0,0,.56));
  }

  .pzo-hand__slot--dragging{
    opacity:.88;
    filter:drop-shadow(0 18px 28px rgba(0,0,0,.56)) saturate(1.05);
  }

  .pzo-hand__slot--unplayable{
    opacity:.56;
    filter:saturate(.72) brightness(.92);
  }

  .pzo-hand__slot--forced{
    filter:drop-shadow(0 0 14px rgba(201,168,76,.14)) drop-shadow(0 12px 18px rgba(0,0,0,.42));
  }

  .pzo-hand__empty{
    padding:12px 16px;
    color:var(--hud-text);
    font-family:var(--font-mono);
    font-size:10px;
    letter-spacing:.18em;
    text-transform:uppercase;
    white-space:nowrap;
  }

  .pzo-hold-slot{
    position:relative;
    width:112px;
    min-width:112px;
    height:160px;
    border-radius:12px;
    background:
      radial-gradient(circle at top center, rgba(124,58,237,0.08), transparent 44%),
      linear-gradient(180deg, rgba(12,15,20,0.96), rgba(8,10,13,0.92));
    border:1px solid var(--hud-border-soft);
    box-shadow:0 14px 28px rgba(0,0,0,.42);
    display:flex;
    align-items:center;
    justify-content:center;
    overflow:hidden;
  }

  .pzo-hold-slot--occupied{
    border-color:rgba(124,58,237,.62);
    box-shadow:0 0 16px rgba(124,58,237,.16), 0 14px 28px rgba(0,0,0,.42);
    cursor:pointer;
  }

  .pzo-hold-slot__label{
    color:var(--hud-muted);
    font-family:var(--font-mono);
    font-size:11px;
    letter-spacing:.22em;
    text-transform:uppercase;
  }

  .pzo-hold-slot__hint{
    position:absolute;
    left:8px;
    right:8px;
    bottom:8px;
    text-align:center;
    color:rgba(196,181,253,0.96);
    font-family:var(--font-mono);
    font-size:9px;
    letter-spacing:.12em;
    text-transform:uppercase;
  }

  .pzo-chain-indicator{
    position:absolute;
    right:8px;
    bottom:8px;
    display:flex;
    gap:4px;
  }

  .pzo-chain-indicator__dot{
    width:6px;
    height:6px;
    border-radius:2px;
    background:var(--hud-teal);
    box-shadow:0 0 10px rgba(29,233,182,.25);
    animation:pzoChainPulse 1.05s ease-in-out infinite alternate;
  }

  .pzo-chain-indicator__dot:nth-child(2){ animation-delay:.1s; opacity:.85; }
  .pzo-chain-indicator__dot:nth-child(3){ animation-delay:.2s; opacity:.7; }

  .pzo-drop-zone{
    position:fixed;
    left:50%;
    bottom:16px;
    transform:translateX(-50%);
    z-index:64;
    min-width:140px;
    padding:10px 18px;
    border-radius:10px;
    background:rgba(12,15,20,.94);
    border:1px solid var(--hud-border-soft);
    color:var(--hud-amber);
    font-family:var(--font-mono);
    font-size:10px;
    letter-spacing:.2em;
    text-transform:uppercase;
    text-align:center;
    box-shadow:0 12px 26px rgba(0,0,0,.54);
    opacity:0;
    pointer-events:none;
    transition:opacity .16s ease, transform .16s ease, box-shadow .16s ease, border-color .16s ease;
  }

  .pzo-drop-zone--active{
    opacity:1;
    pointer-events:auto;
  }

  .pzo-drop-zone--highlight{
    transform:translateX(-50%) translateY(-2px) scale(1.02);
    border-color:rgba(201,168,76,.72);
    box-shadow:0 0 18px var(--hud-amber-glow), 0 12px 26px rgba(0,0,0,.54);
  }

  .pzo-bb-gauge,
  .pzo-trust-badge,
  .pzo-divergence-bar{
    display:flex;
    align-items:center;
    gap:8px;
    padding:6px 10px;
    border-radius:8px;
    background:rgba(12,15,20,.94);
    border:1px solid var(--hud-border-soft);
    box-shadow:0 10px 22px rgba(0,0,0,.40);
    font-family:var(--font-mono);
  }

  .pzo-bb-gauge__label,
  .pzo-trust-badge__label,
  .pzo-divergence-bar__label{
    color:var(--hud-text);
    font-size:9px;
    letter-spacing:.16em;
    text-transform:uppercase;
    white-space:nowrap;
  }

  .pzo-bb-gauge__label{ color:var(--hud-amber); }

  .pzo-bb-gauge__track,
  .pzo-divergence-bar__track{
    width:120px;
    height:6px;
    overflow:hidden;
    border-radius:2px;
    background:rgba(17,24,32,.95);
    border:1px solid var(--hud-border-soft);
  }

  .pzo-bb-gauge__fill,
  .pzo-divergence-bar__fill{
    height:100%;
    transition:width .18s ease;
  }

  .pzo-bb-gauge__fill{
    background:linear-gradient(90deg, rgba(201,168,76,.56), rgba(201,168,76,1));
  }

  .pzo-bb-gauge__value,
  .pzo-trust-badge__score{
    color:var(--hud-text-bright);
    font-size:11px;
    font-weight:800;
    letter-spacing:.08em;
    white-space:nowrap;
  }

  .pzo-bb-gauge__counter{
    color:var(--hud-crimson);
    font-size:9px;
    letter-spacing:.18em;
    text-transform:uppercase;
    animation:pzoBannerPulse .58s ease-in-out infinite alternate;
  }

  .pzo-bb-gauge--active{
    border-color:rgba(192,57,43,.62);
    box-shadow:0 0 16px var(--hud-crimson-glow), 0 10px 22px rgba(0,0,0,.40);
  }

  .pzo-trust-badge__label{ color:var(--hud-teal); }

  .pzo-trust-badge__mod{
    font-size:9px;
    letter-spacing:.12em;
    white-space:nowrap;
  }

  .pzo-trust-badge__mod--pos{ color:var(--hud-teal); }
  .pzo-trust-badge__mod--neg{ color:var(--hud-crimson); }

  .pzo-trust-badge__flag{
    color:var(--hud-crimson);
    font-size:9px;
    letter-spacing:.18em;
    text-transform:uppercase;
    animation:pzoBannerPulse .58s ease-in-out infinite alternate;
  }

  .pzo-trust-badge--active{
    border-color:rgba(192,57,43,.62);
    box-shadow:0 0 16px var(--hud-crimson-glow), 0 10px 22px rgba(0,0,0,.40);
  }

  .pzo-divergence-bar{
    flex-direction:column;
    align-items:flex-start;
    gap:6px;
  }

  .pzo-divergence-bar__label{
    margin:0;
    line-height:1;
  }

  .pzo-streak-indicator,
  .pzo-phase-boundary-banner{
    padding:6px 10px;
    border-radius:8px;
    font-family:var(--font-mono);
    font-size:9px;
    letter-spacing:.18em;
    text-transform:uppercase;
    white-space:nowrap;
  }

  .pzo-phase-boundary-banner{
    color:var(--hud-amber);
    background:var(--hud-amber-soft);
    border:1px solid rgba(201,168,76,.56);
    box-shadow:0 0 14px var(--hud-amber-glow);
    animation:pzoBannerPulse .86s ease-in-out infinite alternate;
  }

  .pzo-streak-indicator{
    color:var(--hud-crimson);
    background:var(--hud-crimson-soft);
    border:1px solid rgba(192,57,43,.62);
    box-shadow:0 0 16px var(--hud-crimson-glow);
    animation:pzoBannerPulse .68s ease-in-out infinite alternate;
  }

  .pzo-hand-footer{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:12px;
    min-height:20px;
    padding:0 4px;
  }

  .pzo-hand-footer__copy{
    color:var(--hud-text);
    font-family:var(--font-mono);
    font-size:9px;
    letter-spacing:.12em;
    text-transform:uppercase;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }

  @keyframes pzoChainPulse{
    from { transform:translateZ(0) scale(1); opacity:.65; }
    to   { transform:translateZ(0) scale(1.12); opacity:1; }
  }

  @keyframes pzoBannerPulse{
    from { opacity:.74; }
    to   { opacity:1; }
  }

  @media (max-width: 900px){
    .pzo-hand-workspace{
      flex-direction:column;
      align-items:center;
    }

    .pzo-bb-gauge__track,
    .pzo-divergence-bar__track{
      width:96px;
    }
  }

  @media (prefers-reduced-motion: reduce){
    .pzo-chain-indicator__dot,
    .pzo-phase-boundary-banner,
    .pzo-streak-indicator,
    .pzo-bb-gauge__counter,
    .pzo-trust-badge__flag{
      animation:none !important;
    }

    .pzo-hand__slot,
    .pzo-drop-zone,
    .pzo-bb-gauge__fill,
    .pzo-divergence-bar__fill{
      transition:none !important;
    }
  }
`;

const FAN_SPREAD_DEG = 18;
const FAN_LIFT_PX = 14;
const FAN_OVERLAP_PX = 54;
const LONG_PRESS_MS = 500;

type EngineStoreShape = {
  card?: {
    battleBudgetMax?: number;
    counterWindowOpen?: boolean;
    rescueWindowOpen?: boolean;
  };
  run?: {
    cash?: number;
  };
  time?: {
    tick?: number;
    ticksElapsed?: number;
  };
};

type LongPressState = {
  timer: ReturnType<typeof setTimeout> | null;
  cardId: string | null;
  fired: boolean;
};

export interface CardHandProps {
  className?: string;
  onCardHover?: (cardId: string | null) => void;
}

function injectStylesOnce(id: string, css: string): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(id)) return;

  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function modeClass(mode: GameMode): string {
  switch (mode) {
    case GameMode.GO_ALONE:
      return 'pzo-hand--empire';
    case GameMode.HEAD_TO_HEAD:
      return 'pzo-hand--predator';
    case GameMode.TEAM_UP:
      return 'pzo-hand--syndicate';
    case GameMode.CHASE_A_LEGEND:
      return 'pzo-hand--phantom';
    default:
      return '';
  }
}

function slotTransform(index: number, total: number, hovered: boolean): React.CSSProperties {
  if (total <= 0) return {};

  const step = total > 1 ? FAN_SPREAD_DEG / (total - 1) : 0;
  const rotation = total > 1 ? -FAN_SPREAD_DEG / 2 + step * index : 0;

  const midpoint = (total - 1) / 2;
  const distance = Math.abs(index - midpoint) / Math.max(1, midpoint || 1);
  const lift = FAN_LIFT_PX * (1 - distance * distance);

  if (hovered) {
    return {
      transform: 'translateY(-22px) scale(1.055)',
      transition: 'transform 180ms cubic-bezier(0.34,1.56,0.64,1)',
      zIndex: 30,
    };
  }

  return {
    transform: `rotate(${rotation}deg) translateY(${-lift}px)`,
    transformOrigin: 'center bottom',
    transition: 'transform 180ms cubic-bezier(0.34,1.56,0.64,1)',
  };
}

function isPlayableCard(card: CardInHand, hasForcedPending: boolean): boolean {
  if (card.isHeld) return false;
  if (card.isForced) return true;

  if (
    card.definition.timingClass === TimingClass.LEGENDARY ||
    card.definition.timingClass === TimingClass.IMMEDIATE
  ) {
    return true;
  }

  if (hasForcedPending) return false;
  return true;
}

function currencyCompact(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

function HoldSlotPanel({
  holdSlot,
  chainSynergyActive,
  onRelease,
}: {
  holdSlot: ReturnType<typeof useCardHand>['holdSlot'];
  chainSynergyActive: boolean;
  onRelease: () => void;
}) {
  return (
    <div
      className={`pzo-hold-slot ${holdSlot ? 'pzo-hold-slot--occupied' : ''}`}
      onClick={holdSlot ? onRelease : undefined}
      onKeyDown={
        holdSlot
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onRelease();
              }
            }
          : undefined
      }
      title={holdSlot ? 'Release held card' : 'Empire hold slot'}
      aria-label={
        holdSlot
          ? `Hold slot: ${holdSlot.card.definition.name}. Press Enter or Space to release.`
          : 'Empty hold slot'
      }
      role={holdSlot ? 'button' : 'presentation'}
      tabIndex={holdSlot ? 0 : -1}
    >
      {holdSlot ? (
        <>
          <CardSlot
            card={holdSlot.card}
            gameMode={GameMode.GO_ALONE}
            isPlayable={false}
            onPlay={() => undefined}
          />
          <span className="pzo-hold-slot__hint">release hold</span>
        </>
      ) : (
        <span className="pzo-hold-slot__label">HOLD</span>
      )}

      {chainSynergyActive ? (
        <div className="pzo-chain-indicator" aria-label="IPA chain synergy active">
          <div className="pzo-chain-indicator__dot" />
          <div className="pzo-chain-indicator__dot" />
          <div className="pzo-chain-indicator__dot" />
        </div>
      ) : null}
    </div>
  );
}

function BattleBudgetGauge({
  budget,
  max,
  counterWindowOpen,
}: {
  budget: number;
  max: number;
  counterWindowOpen: boolean;
}) {
  const pct = max > 0 ? clamp(Math.round((budget / max) * 100), 0, 100) : 0;

  return (
    <div
      className={`pzo-bb-gauge ${counterWindowOpen ? 'pzo-bb-gauge--active' : ''}`}
      aria-label={`Battle budget ${budget} of ${max}`}
    >
      <span className="pzo-bb-gauge__label">BB</span>
      <div className="pzo-bb-gauge__track" aria-hidden="true">
        <div className="pzo-bb-gauge__fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="pzo-bb-gauge__value">{budget}</span>
      {counterWindowOpen ? (
        <span className="pzo-bb-gauge__counter" aria-live="assertive">
          COUNTER WINDOW
        </span>
      ) : null}
    </div>
  );
}

function TrustBadge({
  score,
  multiplier,
  rescueWindowOpen,
}: {
  score: number;
  multiplier: number;
  rescueWindowOpen: boolean;
}) {
  return (
    <div
      className={`pzo-trust-badge ${rescueWindowOpen ? 'pzo-trust-badge--active' : ''}`}
      aria-label={`Trust score ${score}`}
    >
      <span className="pzo-trust-badge__label">TRUST</span>
      <span className="pzo-trust-badge__score">{score}</span>
      {multiplier !== 1 ? (
        <span
          className={`pzo-trust-badge__mod ${
            multiplier > 1 ? 'pzo-trust-badge__mod--pos' : 'pzo-trust-badge__mod--neg'
          }`}
        >
          {getTrustModifierLabel(multiplier)}
        </span>
      ) : null}
      {rescueWindowOpen ? (
        <span className="pzo-trust-badge__flag" aria-live="assertive">
          RESCUE
        </span>
      ) : null}
    </div>
  );
}

function DivergenceBar({
  currentGap,
}: {
  currentGap: number;
}) {
  const pct = clamp(Math.round(currentGap * 100), 0, 100);
  const width = Math.max(2, pct);
  const color = pct < 20 ? '#1de9b6' : pct < 50 ? '#7c3aed' : '#c0392b';

  return (
    <div className="pzo-divergence-bar" aria-label={`Divergence ${pct} percent behind legend`}>
      <div className="pzo-divergence-bar__label">{getDivergenceLabel(currentGap)}</div>
      <div className="pzo-divergence-bar__track" aria-hidden="true">
        <div
          className="pzo-divergence-bar__fill"
          style={{ width: `${width}%`, background: color }}
        />
      </div>
    </div>
  );
}

function MissedStreakBadge({ streak }: { streak: number }) {
  if (streak < 2) return null;
  return (
    <div className="pzo-streak-indicator" role="alert" aria-live="polite">
      {streak}× MISS
    </div>
  );
}

function ModeRibbon({
  gameMode,
  battleBudget,
  battleBudgetMax,
  counterWindowOpen,
  trustScore,
  trustMultiplier,
  rescueWindowOpen,
  currentGap,
  phaseBoundaryOpen,
  currentPhase,
  missedStreak,
  currentTick,
  playerCash,
  handSize,
  isReplenishing,
}: {
  gameMode: GameMode;
  battleBudget: number;
  battleBudgetMax: number;
  counterWindowOpen: boolean;
  trustScore: number;
  trustMultiplier: number;
  rescueWindowOpen: boolean;
  currentGap: number;
  phaseBoundaryOpen: boolean;
  currentPhase: string;
  missedStreak: number;
  currentTick: number;
  playerCash: number;
  handSize: number;
  isReplenishing: boolean;
}) {
  return (
    <div className="pzo-hand-ribbon">
      <MissedStreakBadge streak={missedStreak} />

      {gameMode === GameMode.GO_ALONE && phaseBoundaryOpen ? (
        <div className="pzo-phase-boundary-banner" role="alert" aria-live="assertive">
          {currentPhase} WINDOW OPEN
        </div>
      ) : null}

      {gameMode === GameMode.HEAD_TO_HEAD ? (
        <BattleBudgetGauge
          budget={battleBudget}
          max={battleBudgetMax}
          counterWindowOpen={counterWindowOpen}
        />
      ) : null}

      {gameMode === GameMode.TEAM_UP ? (
        <TrustBadge
          score={trustScore}
          multiplier={trustMultiplier}
          rescueWindowOpen={rescueWindowOpen}
        />
      ) : null}

      {gameMode === GameMode.CHASE_A_LEGEND ? (
        <DivergenceBar currentGap={currentGap} />
      ) : null}

      <span className="pzo-hand-chip pzo-hand-chip--teal">Cash {currencyCompact(playerCash)}</span>
      <span className="pzo-hand-chip">Hand {handSize}</span>
      <span className="pzo-hand-chip">Tick {Math.round(currentTick)}</span>

      {isReplenishing ? (
        <span className="pzo-hand-chip pzo-hand-chip--amber">Drawing…</span>
      ) : null}
    </div>
  );
}

export default function CardHand({
  className = '',
  onCardHover,
}: CardHandProps) {
  const {
    hand,
    holdSlot,
    handSize,
    hasForcedPending,
    gameMode,
    battleBudget,
    trustScore,
    trustMultiplier,
    divergenceScore: _divergenceScore,
    currentGap,
    chainSynergyActive,
    phaseBoundaryOpen,
    currentPhase,
    missedStreak,
    isReplenishing,
    draggedCard,
    isDragging,
    dispatchPlay,
    dispatchHold,
    dispatchRelease,
    onDragStart,
    onDragEnd,
  } = useCardHand();

  const battleBudgetMax = useEngineStore(
    (state: EngineStoreShape) => state.card?.battleBudgetMax ?? 200,
  );
  const counterWindowOpen = useEngineStore(
    (state: EngineStoreShape) => state.card?.counterWindowOpen ?? false,
  );
  const rescueWindowOpen = useEngineStore(
    (state: EngineStoreShape) => state.card?.rescueWindowOpen ?? false,
  );
  const currentTick = useEngineStore(
    (state: EngineStoreShape) => state.time?.tick ?? state.time?.ticksElapsed ?? 0,
  );
  const playerCash = useEngineStore(
    (state: EngineStoreShape) => state.run?.cash ?? 0,
  );

  useEffect(() => {
    injectStylesOnce(STYLE_ID, HAND_STYLES);
  }, []);

  const instanceIds = useMemo(() => hand.map((card) => card.instanceId), [hand]);
  const decisionWindows = useAllDecisionWindows(instanceIds) as Record<string, unknown>;

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [dropHighlight, setDropHighlight] = useState(false);

  const longPressRef = useRef<LongPressState>({
    timer: null,
    cardId: null,
    fired: false,
  });

  const orderedHand = useMemo(() => {
    const forced = hand.filter((card) => card.isForced && !card.isHeld);
    const regular = hand.filter((card) => !card.isForced && !card.isHeld);
    return [...forced, ...regular];
  }, [hand]);

  const cancelLongPressTimer = useCallback(() => {
    if (longPressRef.current.timer) {
      clearTimeout(longPressRef.current.timer);
      longPressRef.current.timer = null;
    }
  }, []);

  const resetLongPress = useCallback(() => {
    cancelLongPressTimer();
    longPressRef.current.cardId = null;
    longPressRef.current.fired = false;
  }, [cancelLongPressTimer]);

  useEffect(() => {
    return () => resetLongPress();
  }, [resetLongPress]);

  const handlePlay = useCallback(
    (card: CardInHand) => {
      const request: CardPlayRequest = {
        instanceId: card.instanceId,
        choiceId: 'default',
        timestamp: Date.now(),
      };
      dispatchPlay(request);
    },
    [dispatchPlay],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent, card: CardInHand) => {
      if (event.button !== 0) return;
      if (gameMode !== GameMode.GO_ALONE) return;
      if (card.isHeld) return;

      resetLongPress();

      longPressRef.current.cardId = card.instanceId;
      longPressRef.current.fired = false;
      longPressRef.current.timer = setTimeout(() => {
        longPressRef.current.fired = true;
        dispatchHold(card.instanceId);
      }, LONG_PRESS_MS);
    },
    [dispatchHold, gameMode, resetLongPress],
  );

  const handlePointerUp = useCallback(() => {
    cancelLongPressTimer();
  }, [cancelLongPressTimer]);

  const handleCardClick = useCallback(
    (card: CardInHand, playable: boolean) => {
      const suppressClick =
        longPressRef.current.fired && longPressRef.current.cardId === card.instanceId;

      resetLongPress();

      if (suppressClick || !playable) return;
      handlePlay(card);
    },
    [handlePlay, resetLongPress],
  );

  const handleDragStart = useCallback(
    (card: CardInHand, event: React.DragEvent) => {
      resetLongPress();
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('cardInstanceId', card.instanceId);
      onDragStart(card);
      setDropActive(true);
    },
    [onDragStart, resetLongPress],
  );

  const handleDragEnd = useCallback(() => {
    resetLongPress();
    onDragEnd();
    setDropActive(false);
    setDropHighlight(false);
  }, [onDragEnd, resetLongPress]);

  const handleDropZoneDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDropHighlight(true);
  }, []);

  const handleDropZoneDragLeave = useCallback(() => {
    setDropHighlight(false);
  }, []);

  const handleDropZoneDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const instanceId = event.dataTransfer.getData('cardInstanceId');
      const card = hand.find((entry) => entry.instanceId === instanceId);

      if (card && isPlayableCard(card, hasForcedPending)) {
        handlePlay(card);
      }

      setDropActive(false);
      setDropHighlight(false);
      onDragEnd();
    },
    [hand, hasForcedPending, handlePlay, onDragEnd],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, card: CardInHand, playable: boolean) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (playable) handlePlay(card);
        return;
      }

      if (
        (event.key === 'h' || event.key === 'H') &&
        gameMode === GameMode.GO_ALONE &&
        !card.isHeld
      ) {
        event.preventDefault();
        dispatchHold(card.instanceId);
      }
    },
    [dispatchHold, gameMode, handlePlay],
  );

  const rootClassName = ['pzo-hand-root', className].filter(Boolean).join(' ');
  const handClassName = [
    'pzo-hand',
    modeClass(gameMode),
    isDragging ? 'pzo-hand--dragging' : '',
    hasForcedPending ? 'pzo-hand--has-forced' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const footerLeft = phaseBoundaryOpen
    ? `${currentPhase} boundary active`
    : hasForcedPending
      ? 'forced timing priority in effect'
      : 'timing discipline wins';

  const footerRight =
    gameMode === GameMode.HEAD_TO_HEAD
      ? `${battleBudget}/${battleBudgetMax} BB`
      : gameMode === GameMode.TEAM_UP
        ? `trust ${trustScore}`
        : gameMode === GameMode.CHASE_A_LEGEND
          ? getDivergenceLabel(currentGap)
          : `tick ${Math.round(currentTick)}`;

  return (
    <div className={rootClassName}>
      <ModeRibbon
        gameMode={gameMode}
        battleBudget={battleBudget}
        battleBudgetMax={battleBudgetMax}
        counterWindowOpen={counterWindowOpen}
        trustScore={trustScore}
        trustMultiplier={trustMultiplier}
        rescueWindowOpen={rescueWindowOpen}
        currentGap={currentGap}
        phaseBoundaryOpen={phaseBoundaryOpen}
        currentPhase={currentPhase}
        missedStreak={missedStreak}
        currentTick={currentTick}
        playerCash={playerCash}
        handSize={handSize}
        isReplenishing={isReplenishing}
      />

      <div className="pzo-hand-workspace">
        {gameMode === GameMode.GO_ALONE ? (
          <HoldSlotPanel
            holdSlot={holdSlot}
            chainSynergyActive={chainSynergyActive}
            onRelease={dispatchRelease}
          />
        ) : null}

        <div
          className={handClassName}
          role="list"
          aria-label={`Card hand with ${handSize} card${handSize === 1 ? '' : 's'}`}
        >
          {orderedHand.length === 0 ? (
            <div className="pzo-hand__empty" aria-live="polite">
              {isReplenishing ? 'Drawing…' : 'No cards in hand'}
            </div>
          ) : (
            orderedHand.map((card, index) => {
              const playable = isPlayableCard(card, hasForcedPending);
              const hovered = hoveredIdx === index;
              const dragging = draggedCard?.instanceId === card.instanceId;
              const forced = card.isForced;
              const windowInfo = decisionWindows?.[card.instanceId] ?? null;

              const slotClassName = [
                'pzo-hand__slot',
                hovered ? 'pzo-hand__slot--hovered' : '',
                dragging ? 'pzo-hand__slot--dragging' : '',
                !playable ? 'pzo-hand__slot--unplayable' : '',
                forced ? 'pzo-hand__slot--forced' : '',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <div
                  key={card.instanceId}
                  className={slotClassName}
                  style={{
                    ...slotTransform(index, orderedHand.length, hovered),
                    zIndex: hovered ? 30 : forced ? 20 : 10 + index,
                    marginLeft: index === 0 ? 0 : -FAN_OVERLAP_PX,
                  }}
                  role="listitem"
                  draggable={playable}
                  onDragStart={(event) => handleDragStart(card, event)}
                  onDragEnd={handleDragEnd}
                  onMouseEnter={() => {
                    setHoveredIdx(index);
                    onCardHover?.(card.instanceId);
                  }}
                  onMouseLeave={() => {
                    setHoveredIdx(null);
                    onCardHover?.(null);
                  }}
                  onPointerDown={(event) => handlePointerDown(event, card)}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={resetLongPress}
                  onClick={() => handleCardClick(card, playable)}
                  onKeyDown={(event) => handleKeyDown(event, card, playable)}
                  tabIndex={playable ? 0 : -1}
                  aria-disabled={!playable}
                  aria-label={`${card.definition.name} — ${getCardCostLabel(
                    card,
                    gameMode,
                  )} — ${card.definition.timingClass}${
                    forced ? ' — forced priority' : ''
                  }`}
                >
                  <DecisionTimerRing
                    {...(windowInfo
                      ? { info: windowInfo, cardInstanceId: card.instanceId }
                      : { cardInstanceId: card.instanceId })}
                    showCountdown={hovered}
                  >
                    <CardSlot
                      card={card}
                      gameMode={gameMode}
                      isPlayable={playable}
                      onPlay={() => {
                        if (playable) handlePlay(card);
                      }}
                      onHold={
                        gameMode === GameMode.GO_ALONE
                          ? () => dispatchHold(card.instanceId)
                          : undefined
                      }
                      trustMultiplier={trustMultiplier}
                      divergenceDelta={0}
                    />
                  </DecisionTimerRing>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="pzo-hand-footer">
        <div className="pzo-hand-footer__copy">{footerLeft}</div>
        <div className="pzo-hand-footer__copy">{footerRight}</div>
      </div>

      <div
        className={[
          'pzo-drop-zone',
          dropActive ? 'pzo-drop-zone--active' : '',
          dropHighlight ? 'pzo-drop-zone--highlight' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onDragOver={handleDropZoneDragOver}
        onDragLeave={handleDropZoneDragLeave}
        onDrop={handleDropZoneDrop}
        aria-hidden={!dropActive}
        aria-label="Drop zone. Drag a card here to play it."
      >
        DROP TO PLAY
      </div>
    </div>
  );
}