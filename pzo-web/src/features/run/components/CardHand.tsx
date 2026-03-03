// FILE: pzo-web/src/features/run/components/CardHand.tsx
//
// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — CARD HAND (HUD-MATCHED)
//
// Updated to match GameHUD visual language + fixed interface mismatches:
//   - CardSlot is now pure display: onPlay(): void (no CardPlayRequest construction inside)
//   - DecisionTimerRing wraps CardSlot and can consume precomputed window info
//   - Removed broken CardSlot timer ring overlay usage
//
// Density6 LLC · Point Zero One · Cards Engine · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';

import { useCardHand, getCardCostLabel, getTrustModifierLabel, getDivergenceLabel } from '../hooks/useCardHand';
import { useAllDecisionWindows } from '../hooks/useDecisionWindow';
import { DecisionTimerRing } from './DecisionTimerRing';
import { CardSlot } from './CardSlot';

import {
  GameMode,
  TimingClass,
  type CardInHand,
  type CardPlayRequest,
} from '../../../engines/cards/types';

// ─────────────────────────────────────────────────────────────────────────────
// HUD-MATCHED STYLES (scoped)
// ─────────────────────────────────────────────────────────────────────────────

const CARD_HAND_STYLES = `
  .pzo-hand-root{
    --hud-bg:           var(--hud-bg, #080a0d);
    --hud-panel:        var(--hud-panel, #0c0f14);
    --hud-border:       var(--hud-border, #1a2030);
    --hud-amber:        var(--hud-amber, #c9a84c);
    --hud-amber-dim:    var(--hud-amber-dim, #7a5f1f);
    --hud-amber-glow:   var(--hud-amber-glow, rgba(201,168,76,0.15));
    --hud-crimson:      var(--hud-crimson, #c0392b);
    --hud-crimson-glow: var(--hud-crimson-glow, rgba(192,57,43,0.2));
    --hud-teal:         var(--hud-teal, #1de9b6);
    --hud-muted:        var(--hud-muted, #3a4a60);
    --hud-text:         var(--hud-text, #8fa0b8);
    --hud-text-bright:  var(--hud-text-bright, #c8d8f0);
    --font-mono:        var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace);
    --font-ui:          var(--font-ui, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif);

    position: relative;
    padding: 6px 8px 10px;
    user-select: none;
  }

  .pzo-hand-hud{
    display:flex;
    align-items:center;
    justify-content:center;
    gap:10px;
    margin-bottom:8px;
    min-height: 30px;
  }

  .pzo-hand{
    display:flex;
    align-items:flex-end;
    justify-content:center;
    position: relative;
    padding: 8px 6px;
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(12,15,20,0.92), rgba(8,10,13,0.88));
    border: 1px solid rgba(26,32,48,0.95);
    box-shadow: 0 10px 26px rgba(0,0,0,0.45);
    overflow: visible;
  }

  .pzo-hand__slot{
    position: relative;
    filter: drop-shadow(0 12px 18px rgba(0,0,0,0.45));
    outline: none;
  }

  .pzo-hand__slot--hovered{
    filter: drop-shadow(0 18px 24px rgba(0,0,0,0.55));
  }

  .pzo-hand__slot--unplayable{
    opacity: .55;
    filter: saturate(.7) brightness(.9);
  }

  .pzo-hand__slot--dragging{
    opacity: .85;
    filter: drop-shadow(0 18px 24px rgba(0,0,0,0.55)) saturate(1.1);
  }

  .pzo-hand__empty{
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: .16em;
    color: var(--hud-text);
    text-transform: uppercase;
    padding: 10px 12px;
  }

  .pzo-drop-zone{
    position: fixed;
    left: 50%;
    bottom: 16px;
    transform: translateX(-50%);
    padding: 8px 18px;
    border-radius: 8px;
    background: rgba(12,15,20,0.92);
    border: 1px solid rgba(26,32,48,0.95);
    color: var(--hud-amber);
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: .22em;
    text-transform: uppercase;
    box-shadow: 0 12px 26px rgba(0,0,0,0.55);
    opacity: 0;
    pointer-events: none;
    transition: opacity .15s ease, transform .15s ease, box-shadow .15s ease, border-color .15s ease;
    z-index: 50;
  }
  .pzo-drop-zone--active{
    opacity: 1;
    pointer-events: auto;
  }
  .pzo-drop-zone--highlight{
    border-color: var(--hud-amber);
    box-shadow: 0 0 18px var(--hud-amber-glow), 0 12px 26px rgba(0,0,0,0.55);
    transform: translateX(-50%) translateY(-2px) scale(1.02);
  }

  .pzo-hold-slot{
    width: 112px;
    height: 160px;
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(12,15,20,0.92), rgba(8,10,13,0.88));
    border: 1px solid rgba(26,32,48,0.95);
    box-shadow: 0 10px 26px rgba(0,0,0,0.45);
    display:flex;
    align-items:center;
    justify-content:center;
    position: relative;
    overflow:hidden;
    cursor: default;
  }
  .pzo-hold-slot--occupied{
    cursor: pointer;
    border-color: rgba(124,58,237,0.65);
    box-shadow: 0 0 18px rgba(124,58,237,0.18), 0 10px 26px rgba(0,0,0,0.45);
  }
  .pzo-hold-slot__label{
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: .22em;
    color: var(--hud-muted);
    text-transform: uppercase;
  }
  .pzo-hold-slot__release-hint{
    position:absolute;
    left: 8px;
    bottom: 8px;
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: .14em;
    color: rgba(196,181,253,0.95);
    text-transform: uppercase;
  }

  .pzo-chain-indicator{
    position:absolute;
    right: 8px;
    bottom: 8px;
    display:flex;
    gap:4px;
  }
  .pzo-chain-indicator__dot{
    width: 6px;
    height: 6px;
    border-radius: 2px;
    background: var(--hud-teal);
    box-shadow: 0 0 10px rgba(29,233,182,0.25);
    animation: pzoChainPulse 1.1s ease-in-out infinite alternate;
  }
  .pzo-chain-indicator__dot:nth-child(2){ animation-delay: .12s; opacity: .85; }
  .pzo-chain-indicator__dot:nth-child(3){ animation-delay: .24s; opacity: .7; }

  @keyframes pzoChainPulse{
    from { transform: translateZ(0) scale(1); opacity: .65; }
    to   { transform: translateZ(0) scale(1.12); opacity: 1; }
  }

  .pzo-phase-boundary-banner{
    padding: 6px 10px;
    border-radius: 8px;
    background: rgba(201,168,76,0.10);
    border: 1px solid rgba(201,168,76,0.55);
    color: var(--hud-amber);
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: .18em;
    text-transform: uppercase;
    box-shadow: 0 0 14px var(--hud-amber-glow);
    animation: pzoBannerPulse .85s ease-in-out infinite alternate;
  }

  @keyframes pzoBannerPulse{
    from { opacity: .75; }
    to { opacity: 1; }
  }

  .pzo-streak-indicator{
    padding: 6px 10px;
    border-radius: 8px;
    background: rgba(192,57,43,0.10);
    border: 1px solid rgba(192,57,43,0.65);
    color: var(--hud-crimson);
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: .18em;
    text-transform: uppercase;
    box-shadow: 0 0 16px var(--hud-crimson-glow);
    animation: pzoBannerPulse .65s ease-in-out infinite alternate;
  }

  .pzo-bb-gauge, .pzo-trust-badge, .pzo-divergence-bar{
    padding: 6px 10px;
    border-radius: 8px;
    background: rgba(12,15,20,0.92);
    border: 1px solid rgba(26,32,48,0.95);
    box-shadow: 0 10px 22px rgba(0,0,0,0.45);
  }

  .pzo-bb-gauge{
    display:flex;
    align-items:center;
    gap:8px;
    font-family: var(--font-mono);
    color: var(--hud-text-bright);
  }
  .pzo-bb-gauge__label{
    font-size: 10px;
    letter-spacing:.22em;
    color: var(--hud-amber);
  }
  .pzo-bb-gauge__track{
    width: 120px;
    height: 6px;
    background: rgba(17,24,32,0.95);
    border: 1px solid rgba(26,32,48,0.95);
    border-radius: 2px;
    overflow:hidden;
  }
  .pzo-bb-gauge__fill{
    height: 100%;
    background: linear-gradient(90deg, rgba(201,168,76,0.55), rgba(201,168,76,1));
    transition: width .18s ease;
  }
  .pzo-bb-gauge__value{
    font-size: 10px;
    letter-spacing:.14em;
    color: var(--hud-text);
  }
  .pzo-bb-gauge__counter-flash{
    margin-left: 10px;
    font-size: 9px;
    letter-spacing:.18em;
    color: var(--hud-crimson);
    text-transform: uppercase;
    animation: pzoBannerPulse .55s ease-in-out infinite alternate;
  }
  .pzo-bb-gauge--counter-active{
    border-color: rgba(192,57,43,0.65);
    box-shadow: 0 0 18px var(--hud-crimson-glow), 0 10px 22px rgba(0,0,0,0.45);
  }

  .pzo-trust-badge{
    display:flex;
    align-items:center;
    gap:8px;
    font-family: var(--font-mono);
    color: var(--hud-text-bright);
  }
  .pzo-trust-badge__label{
    font-size: 9px;
    letter-spacing:.22em;
    color: var(--hud-teal);
    text-transform: uppercase;
  }
  .pzo-trust-badge__score{
    font-size: 12px;
    font-weight: 900;
    letter-spacing:.08em;
  }
  .pzo-trust-badge__mod{
    font-size: 9px;
    letter-spacing:.14em;
    opacity: .9;
  }
  .pzo-trust-badge__mod--pos{ color: var(--hud-teal); }
  .pzo-trust-badge__mod--neg{ color: var(--hud-crimson); }
  .pzo-trust-badge__rescue-flag{
    margin-left: 8px;
    font-size: 9px;
    letter-spacing:.18em;
    color: var(--hud-crimson);
    text-transform: uppercase;
    animation: pzoBannerPulse .55s ease-in-out infinite alternate;
  }
  .pzo-trust-badge--rescue{
    border-color: rgba(192,57,43,0.65);
    box-shadow: 0 0 18px var(--hud-crimson-glow), 0 10px 22px rgba(0,0,0,0.45);
  }

  .pzo-divergence-bar{
    font-family: var(--font-mono);
    color: var(--hud-text-bright);
  }
  .pzo-divergence-bar__label{
    font-size: 9px;
    letter-spacing:.16em;
    text-transform: uppercase;
    color: var(--hud-text);
    margin-bottom: 4px;
  }
  .pzo-divergence-bar__track{
    height: 6px;
    background: rgba(17,24,32,0.95);
    border: 1px solid rgba(26,32,48,0.95);
    border-radius: 2px;
    overflow:hidden;
  }
  .pzo-divergence-bar__fill{
    height: 100%;
    transition: width .18s ease;
    box-shadow: 0 0 10px rgba(0,0,0,0.25);
  }
`;

function injectStylesOnce(id: string, css: string) {
  if (typeof document === 'undefined') return;
  if (document.getElementById(id)) return;
  const el = document.createElement('style');
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}

// ─────────────────────────────────────────────────────────────────────────────
// FAN LAYOUT CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const FAN_SPREAD_DEG = 18;
const FAN_LIFT_PX    = 14;
const FAN_OVERLAP_PX = 54;

const LONG_PRESS_MS  = 500;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function slotTransform(index: number, total: number, isHovered: boolean): React.CSSProperties {
  if (total === 0) return {};
  const step   = total > 1 ? FAN_SPREAD_DEG / (total - 1) : 0;
  const rotDeg = total > 1 ? -FAN_SPREAD_DEG / 2 + step * index : 0;

  const midIdx = (total - 1) / 2;
  const dist   = Math.abs(index - midIdx) / Math.max(1, (total - 1) / 2);
  const liftPx = FAN_LIFT_PX * (1 - dist * dist);

  if (isHovered) {
    return {
      transform:  `translateY(-22px) scale(1.06)`,
      zIndex:     20,
      transition: 'transform 0.20s cubic-bezier(0.34,1.56,0.64,1)',
    };
  }

  return {
    transform:       `rotate(${rotDeg}deg) translateY(${-liftPx}px)`,
    transformOrigin: 'center bottom',
    transition:      'transform 0.22s cubic-bezier(0.34,1.56,0.64,1), z-index 0s',
  };
}

function modeClass(mode: GameMode): string {
  const map: Record<GameMode, string> = {
    [GameMode.GO_ALONE]:       'pzo-hand--empire',
    [GameMode.HEAD_TO_HEAD]:   'pzo-hand--predator',
    [GameMode.TEAM_UP]:        'pzo-hand--syndicate',
    [GameMode.CHASE_A_LEGEND]: 'pzo-hand--phantom',
  };
  return map[mode] ?? '';
}

// ─────────────────────────────────────────────────────────────────────────────
// HOLD SLOT (Empire only)
// ─────────────────────────────────────────────────────────────────────────────

interface HoldSlotPanelProps {
  holdSlot: ReturnType<typeof useCardHand>['holdSlot'];
  onRelease: () => void;
  chainSynergyActive: boolean;
}

const HoldSlotPanel: React.FC<HoldSlotPanelProps> = ({ holdSlot, onRelease, chainSynergyActive }) => (
  <div
    className={`pzo-hold-slot ${holdSlot ? 'pzo-hold-slot--occupied' : ''}`}
    onClick={holdSlot ? onRelease : undefined}
    title={holdSlot ? 'Click to release held card' : 'Hold slot — Empire'}
    aria-label={holdSlot ? `Hold slot: ${holdSlot.card.definition.name} — click to release` : 'Empty hold slot'}
    role={holdSlot ? 'button' : 'presentation'}
    tabIndex={holdSlot ? 0 : -1}
  >
    {holdSlot ? (
      <>
        <CardSlot
          card={holdSlot.card}
          gameMode={GameMode.GO_ALONE}
          isPlayable={false}
          onPlay={() => {}}
        />
        <span className="pzo-hold-slot__release-hint">↑ release</span>
      </>
    ) : (
      <span className="pzo-hold-slot__label">HOLD</span>
    )}

    {chainSynergyActive && (
      <div className="pzo-chain-indicator" aria-label="IPA chain synergy active">
        <div className="pzo-chain-indicator__dot" />
        <div className="pzo-chain-indicator__dot" />
        <div className="pzo-chain-indicator__dot" />
      </div>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// BATTLE BUDGET GAUGE (Predator)
// ─────────────────────────────────────────────────────────────────────────────

const BattleBudgetGauge: React.FC<{
  budget: number;
  max: number;
  counterWindowOpen: boolean;
}> = ({ budget, max, counterWindowOpen }) => {
  const pct = max > 0 ? Math.round((budget / max) * 100) : 0;
  return (
    <div
      className={`pzo-bb-gauge ${counterWindowOpen ? 'pzo-bb-gauge--counter-active' : ''}`}
      aria-label={`Battle Budget: ${budget} / ${max}`}
    >
      <div className="pzo-bb-gauge__label">BB</div>
      <div className="pzo-bb-gauge__track">
        <div className="pzo-bb-gauge__fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="pzo-bb-gauge__value">{budget}</div>
      {counterWindowOpen && (
        <div className="pzo-bb-gauge__counter-flash" aria-live="assertive">
          COUNTER WINDOW
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TRUST SCORE BADGE (Syndicate)
// ─────────────────────────────────────────────────────────────────────────────

const TrustBadge: React.FC<{
  score: number;
  multiplier: number;
  rescueWindowOpen: boolean;
}> = ({ score, multiplier, rescueWindowOpen }) => (
  <div
    className={`pzo-trust-badge ${rescueWindowOpen ? 'pzo-trust-badge--rescue' : ''}`}
    aria-label={`Trust Score: ${score}`}
  >
    <span className="pzo-trust-badge__label">TRUST</span>
    <span className="pzo-trust-badge__score">{score}</span>
    {multiplier !== 1.0 && (
      <span className={`pzo-trust-badge__mod ${multiplier > 1 ? 'pzo-trust-badge__mod--pos' : 'pzo-trust-badge__mod--neg'}`}>
        {getTrustModifierLabel(multiplier)}
      </span>
    )}
    {rescueWindowOpen && (
      <span className="pzo-trust-badge__rescue-flag" aria-live="assertive">⚠ RESCUE</span>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// DIVERGENCE BAR (Phantom)
// ─────────────────────────────────────────────────────────────────────────────

const DivergenceBar: React.FC<{ currentGap: number; score: number }> = ({ currentGap }) => {
  const pct    = Math.round(currentGap * 100);
  const barPct = Math.max(2, Math.min(100, pct));
  const color  = pct < 20 ? '#1de9b6' : pct < 50 ? '#7c3aed' : '#c0392b';

  return (
    <div className="pzo-divergence-bar" aria-label={`Divergence: ${pct}% behind legend`}>
      <div className="pzo-divergence-bar__label">{getDivergenceLabel(currentGap)}</div>
      <div className="pzo-divergence-bar__track">
        <div className="pzo-divergence-bar__fill" style={{ width: `${barPct}%`, background: color }} />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MISSED STREAK INDICATOR
// ─────────────────────────────────────────────────────────────────────────────

const MissedStreakBadge: React.FC<{ streak: number }> = ({ streak }) => {
  if (streak < 2) return null;
  return (
    <div className="pzo-streak-indicator" role="alert" aria-live="polite">
      {streak}× MISS
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

export interface CardHandProps {
  className?: string;
}

export const CardHand: React.FC<CardHandProps> = ({ className = '' }) => {
  const {
    hand,
    holdSlot,
    handSize,
    hasForcedPending,
    gameMode,
    battleBudget,
    trustScore,
    trustMultiplier,
    divergenceScore,
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

  useEffect(() => {
    injectStylesOnce('pzo-card-hand-styles', CARD_HAND_STYLES);
  }, []);

  const { battleBudgetMax, counterWindowOpen, rescueWindowOpen } = useModeExtras(gameMode);

  // Single rAF window snapshot (preferred)
  const instanceIds = useMemo(() => hand.map((c) => c.instanceId), [hand]);
  const windowInfos = useAllDecisionWindows(instanceIds);

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const [dropActive, setDropActive] = useState(false);
  const [dropHighlight, setDropHighlight] = useState(false);

  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const orderedHand = useMemo(() => {
    const forced  = hand.filter((c) => c.isForced);
    const regular = hand.filter((c) => !c.isForced && !c.isHeld);
    return [...forced, ...regular];
  }, [hand]);

  const handlePlay = useCallback((card: CardInHand) => {
    if (card.isHeld) return;
    const request: CardPlayRequest = {
      instanceId: card.instanceId,
      choiceId: 'default',
      timestamp: Date.now(),
    };
    dispatchPlay(request);
  }, [dispatchPlay]);

  const handleHoldLongPress = useCallback((card: CardInHand) => {
    if (gameMode !== GameMode.GO_ALONE) return;
    longPressRef.current = setTimeout(() => {
      dispatchHold(card.instanceId);
    }, LONG_PRESS_MS);
  }, [gameMode, dispatchHold]);

  const cancelLongPress = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }, []);

  const handleDragStart = useCallback((card: CardInHand, e: React.DragEvent) => {
    e.dataTransfer.setData('cardInstanceId', card.instanceId);
    onDragStart(card);
    setDropActive(true);
  }, [onDragStart]);

  const handleDragEnd = useCallback(() => {
    onDragEnd();
    setDropActive(false);
    setDropHighlight(false);
  }, [onDragEnd]);

  const handleDropZoneDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDropHighlight(true);
  }, []);

  const handleDropZoneDragLeave = useCallback(() => {
    setDropHighlight(false);
  }, []);

  const handleDropZoneDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const instanceId = e.dataTransfer.getData('cardInstanceId');
    const card = hand.find((c) => c.instanceId === instanceId);
    if (card) handlePlay(card);
    setDropActive(false);
    setDropHighlight(false);
    onDragEnd();
  }, [hand, handlePlay, onDragEnd]);

  useEffect(() => {
    return () => {
      if (longPressRef.current) clearTimeout(longPressRef.current);
    };
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, card: CardInHand) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handlePlay(card);
    }
  }, [handlePlay]);

  const handClasses = [
    'pzo-hand',
    modeClass(gameMode),
    className,
    hasForcedPending ? 'pzo-hand--has-forced' : '',
    isDragging ? 'pzo-hand--dragging' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="pzo-hand-root">
      <div className="pzo-hand-hud">
        <MissedStreakBadge streak={missedStreak} />

        {gameMode === GameMode.GO_ALONE && phaseBoundaryOpen && (
          <div className="pzo-phase-boundary-banner" role="alert" aria-live="assertive">
            {currentPhase} — PHASE WINDOW OPEN
          </div>
        )}

        {gameMode === GameMode.HEAD_TO_HEAD && (
          <BattleBudgetGauge
            budget={battleBudget}
            max={battleBudgetMax}
            counterWindowOpen={counterWindowOpen}
          />
        )}

        {gameMode === GameMode.TEAM_UP && (
          <TrustBadge
            score={trustScore}
            multiplier={trustMultiplier}
            rescueWindowOpen={rescueWindowOpen}
          />
        )}

        {gameMode === GameMode.CHASE_A_LEGEND && (
          <DivergenceBar currentGap={currentGap} score={divergenceScore} />
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 12 }}>
        {gameMode === GameMode.GO_ALONE && (
          <HoldSlotPanel
            holdSlot={holdSlot}
            onRelease={dispatchRelease}
            chainSynergyActive={chainSynergyActive}
          />
        )}

        <div
          className={handClasses}
          role="list"
          aria-label={`Card hand — ${handSize} card${handSize !== 1 ? 's' : ''}`}
        >
          {orderedHand.map((card, idx) => {
            const isPlayable = !hasForcedPending || card.isForced || card.definition.timingClass === TimingClass.LEGENDARY;
            const isHovered  = hoveredIdx === idx;
            const windowInfo = windowInfos[card.instanceId] ?? null;
            const isDraggingThis = draggedCard?.instanceId === card.instanceId;

            const slotClasses = [
              'pzo-hand__slot',
              isHovered ? 'pzo-hand__slot--hovered' : '',
              isDraggingThis ? 'pzo-hand__slot--dragging' : '',
              !isPlayable ? 'pzo-hand__slot--unplayable' : '',
            ].filter(Boolean).join(' ');

            return (
              <div
                key={card.instanceId}
                className={slotClasses}
                style={{
                  ...slotTransform(idx, orderedHand.length, isHovered),
                  zIndex: isHovered ? 20 : hasForcedPending && card.isForced ? 15 : 10 + idx,
                  marginLeft: idx === 0 ? 0 : -FAN_OVERLAP_PX,
                }}
                role="listitem"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onPointerDown={() => handleHoldLongPress(card)}
                onPointerUp={cancelLongPress}
                onPointerCancel={cancelLongPress}
                draggable={isPlayable}
                onDragStart={(e) => handleDragStart(card, e)}
                onDragEnd={handleDragEnd}
                onClick={() => isPlayable && handlePlay(card)}
                onKeyDown={(e) => isPlayable && handleKeyDown(e, card)}
                tabIndex={isPlayable ? 0 : -1}
                aria-label={`${card.definition.name} — ${getCardCostLabel(card, gameMode)} — ${card.definition.timingClass}`}
                aria-disabled={!isPlayable}
              >
                <DecisionTimerRing
                  {...(windowInfo
                    ? { info: windowInfo, cardInstanceId: card.instanceId as string }
                    : { cardInstanceId: card.instanceId as string })}
                  showCountdown={isHovered}
                >
                  <CardSlot
                    card={card}
                    gameMode={gameMode}
                    isPlayable={isPlayable}
                    onPlay={() => isPlayable && handlePlay(card)}
                    onHold={gameMode === GameMode.GO_ALONE ? () => dispatchHold(card.instanceId) : undefined}
                    trustMultiplier={trustMultiplier}
                    divergenceDelta={0}
                  />
                </DecisionTimerRing>
              </div>
            );
          })}

          {orderedHand.length === 0 && (
            <div className="pzo-hand__empty" aria-live="polite">
              {isReplenishing ? 'Drawing…' : 'No cards in hand'}
            </div>
          )}
        </div>
      </div>

      <div
        className={[
          'pzo-drop-zone',
          dropActive ? 'pzo-drop-zone--active' : '',
          dropHighlight ? 'pzo-drop-zone--highlight' : '',
        ].filter(Boolean).join(' ')}
        onDragOver={handleDropZoneDragOver}
        onDragLeave={handleDropZoneDragLeave}
        onDrop={handleDropZoneDrop}
        aria-label="Drop zone — drag a card here to play it"
        aria-hidden={!dropActive}
      >
        PLAY
      </div>
    </div>
  );
};

export default CardHand;

// ─────────────────────────────────────────────────────────────────────────────
// useModeExtras — reads mode-specific store values unavailable in useCardHand
// ─────────────────────────────────────────────────────────────────────────────

function useModeExtras(gameMode: GameMode): {
  battleBudgetMax: number;
  counterWindowOpen: boolean;
  rescueWindowOpen: boolean;
} {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useEngineStore } = require('../../../store/engineStore');

  const battleBudgetMax   = useEngineStore((s: any) => s.card?.battleBudgetMax ?? 200);
  const counterWindowOpen = useEngineStore((s: any) => s.card?.counterWindowOpen ?? false);
  const rescueWindowOpen  = useEngineStore((s: any) => s.card?.rescueWindowOpen ?? false);

  return { battleBudgetMax, counterWindowOpen, rescueWindowOpen };
}