// FILE: pzo-web/src/features/run/components/CardSlot.tsx
//
// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — CardSlot (HUD-MATCHED)
//
// Pure display. No store reads. No timer ring (DecisionTimerRing wraps this).
// Density6 LLC · Point Zero One · Cards Engine · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect } from 'react';
import {
  GameMode,
  TimingClass,
  BaseDeckType,
  ModeDeckType,
  CardRarity,
  type CardInHand,
} from '../../../engines/cards/types';
import { getCardCostLabel, getTrustModifierLabel, getDivergenceLabel } from '../hooks/useCardHand';

// ─────────────────────────────────────────────────────────────────────────────
// STYLE INJECTION (forced badge pulse)
// ─────────────────────────────────────────────────────────────────────────────

const CARD_SLOT_STYLES = `
  @keyframes pzoForcedPulse {
    from { transform: translateZ(0) scale(1); opacity: .75; }
    to   { transform: translateZ(0) scale(1.06); opacity: 1; }
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
// COLOR MAPS
// ─────────────────────────────────────────────────────────────────────────────

const DECK_TYPE_COLORS: Record<string, string> = {
  [BaseDeckType.OPPORTUNITY]:    '#1e40af',
  [BaseDeckType.IPA]:            '#1de9b6',
  [BaseDeckType.FUBAR]:          '#c0392b',
  [BaseDeckType.PRIVILEGED]:     '#7c3aed',
  [BaseDeckType.SO]:             '#c9a84c',
  [BaseDeckType.PHASE_BOUNDARY]: '#0f766e',
  [ModeDeckType.SABOTAGE]:       '#b91c1c',
  [ModeDeckType.COUNTER]:        '#1d4ed8',
  [ModeDeckType.BLUFF]:          '#854d0e',
  [ModeDeckType.AID]:            '#065f46',
  [ModeDeckType.RESCUE]:         '#0369a1',
  [ModeDeckType.TRUST]:          '#4338ca',
  [ModeDeckType.DEFECTION]:      '#1f2937',
  [ModeDeckType.GHOST]:          '#334155',
  [ModeDeckType.DISCIPLINE]:     '#374151',
};

function getDeckColor(card: CardInHand): string {
  return DECK_TYPE_COLORS[card.definition.deckType] ?? '#3a4a60';
}

const TIMING_BADGE_LABELS: Record<TimingClass, string> = {
  [TimingClass.IMMEDIATE]:            'IMM',
  [TimingClass.REACTIVE]:             'REACT',
  [TimingClass.STANDARD]:             'STD',
  [TimingClass.HOLD]:                 'HOLD',
  [TimingClass.COUNTER_WINDOW]:       'CTR',
  [TimingClass.RESCUE_WINDOW]:        'RSC',
  [TimingClass.PHASE_BOUNDARY]:       'PB',
  [TimingClass.FORCED]:               'FORCE',
  [TimingClass.LEGENDARY]:            'LEG',
  [TimingClass.BLUFF]:                'BLUFF',
  [TimingClass.DEFECTION_STEP]:       'DEF',
  [TimingClass.SOVEREIGNTY_DECISION]: 'SOV',
};

const TIMING_BADGE_COLORS: Record<TimingClass, string> = {
  [TimingClass.IMMEDIATE]:            '#1de9b6',
  [TimingClass.REACTIVE]:             '#38bdf8',
  [TimingClass.STANDARD]:             '#3a4a60',
  [TimingClass.HOLD]:                 '#7c3aed',
  [TimingClass.COUNTER_WINDOW]:       '#1d4ed8',
  [TimingClass.RESCUE_WINDOW]:        '#0891b2',
  [TimingClass.PHASE_BOUNDARY]:       '#0f766e',
  [TimingClass.FORCED]:               '#c0392b',
  [TimingClass.LEGENDARY]:            '#c9a84c',
  [TimingClass.BLUFF]:                '#b45309',
  [TimingClass.DEFECTION_STEP]:       '#1f2937',
  [TimingClass.SOVEREIGNTY_DECISION]: '#7c3aed',
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export interface CardSlotProps {
  card: CardInHand;
  gameMode: GameMode;
  isPlayable: boolean;
  isSelected?: boolean;

  trustMultiplier?: number;
  divergenceDelta?: number;

  onPlay: () => void;
  onHold?: () => void;
}

export const CardSlot = React.memo(function CardSlot({
  card,
  gameMode,
  isPlayable,
  isSelected = false,
  trustMultiplier = 1.0,
  divergenceDelta = 0,
  onPlay,
  onHold,
}: CardSlotProps) {
  useEffect(() => {
    injectStylesOnce('pzo-card-slot-styles', CARD_SLOT_STYLES);
  }, []);

  const handleClick = useCallback(() => {
    if (!isPlayable || card.isHeld) return;
    onPlay();
  }, [card.isHeld, isPlayable, onPlay]);

  const handleHold = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onHold) return;
    if (gameMode !== GameMode.GO_ALONE) return;
    if (!isPlayable || card.isHeld) return;
    onHold();
  }, [onHold, gameMode, isPlayable, card.isHeld]);

  const isLegendary = card.definition.rarity === CardRarity.LEGENDARY;
  const isForced    = card.isForced;
  const isHeld      = card.isHeld;

  const deckColor   = getDeckColor(card);
  const timingLabel = TIMING_BADGE_LABELS[card.definition.timingClass];
  const timingColor = TIMING_BADGE_COLORS[card.definition.timingClass];
  const costLabel   = getCardCostLabel(card, gameMode);

  const trustLabel = gameMode === GameMode.TEAM_UP ? getTrustModifierLabel(trustMultiplier) : null;
  const divLabel   = gameMode === GameMode.CHASE_A_LEGEND && divergenceDelta !== 0
    ? getDivergenceLabel(Math.abs(divergenceDelta))
    : null;

  const hasEffect = (card.definition.base_effect?.magnitude ?? 0) > 0;

  let border = '1px solid rgba(26,32,48,0.95)';
  let glow   = '0 10px 22px rgba(0,0,0,0.45)';

  if (isLegendary) { border = '1px solid rgba(201,168,76,0.85)'; glow = '0 0 16px rgba(201,168,76,0.18), 0 10px 22px rgba(0,0,0,0.45)'; }
  if (isForced)    { border = '1px solid rgba(192,57,43,0.95)';  glow = '0 0 18px rgba(192,57,43,0.22), 0 10px 22px rgba(0,0,0,0.45)'; }
  if (isSelected)  { border = '1px solid rgba(56,189,248,0.95)'; glow = '0 0 16px rgba(56,189,248,0.18), 0 10px 22px rgba(0,0,0,0.45)'; }
  if (isHeld)      { border = '1px solid rgba(124,58,237,0.95)'; glow = '0 0 16px rgba(124,58,237,0.18), 0 10px 22px rgba(0,0,0,0.45)'; }

  return (
    <div
      role="button"
      tabIndex={isPlayable && !isHeld ? 0 : -1}
      aria-label={`${card.definition.name} — ${costLabel}`}
      aria-disabled={!isPlayable}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
      style={{
        position: 'relative',
        width: 112,
        height: 160,
        borderRadius: 10,
        border,
        background: `
          radial-gradient(circle at 18% 12%, ${deckColor}3d 0%, transparent 55%),
          linear-gradient(180deg, var(--hud-panel, #0c0f14) 0%, var(--hud-bg, #080a0d) 100%)
        `,
        boxShadow: glow,
        backdropFilter: 'blur(8px)',
        cursor: isPlayable && !isHeld ? 'pointer' : 'default',
        opacity: isHeld ? 0.55 : (isPlayable ? 1.0 : 0.55),
        transition: 'transform 0.15s ease, opacity 0.2s ease, border 0.2s ease',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        padding: 8,
        boxSizing: 'border-box',
        transform: isSelected ? 'translateY(-8px)' : 'none',
        fontFamily: 'var(--font-ui, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif)',
        color: 'var(--hud-text-bright, #c8d8f0)',
        overflow: 'hidden',
      }}
    >
      {/* Deck stripe */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: '0 0 auto 0',
          height: 3,
          background: `linear-gradient(90deg, transparent, ${deckColor}cc, transparent)`,
          opacity: 0.9,
        }}
      />

      {/* Timing badge */}
      <div style={{
        alignSelf: 'flex-start',
        background: `${timingColor}cc`,
        border: `1px solid ${timingColor}66`,
        color: 'var(--hud-text-bright, #c8d8f0)',
        fontSize: 9,
        fontWeight: 700,
        padding: '2px 5px',
        borderRadius: 4,
        letterSpacing: '0.14em',
        fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)',
        textTransform: 'uppercase',
      }}>
        {timingLabel}
      </div>

      {/* Name */}
      <div style={{
        marginTop: 6,
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1.25,
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
      }}>
        {card.definition.name}
      </div>

      <div style={{ flex: 1 }} />

      {/* Effect summary */}
      {hasEffect && (
        <div style={{
          fontSize: 10,
          color: 'var(--hud-text, #8fa0b8)',
          marginBottom: 4,
          fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)',
        }}>
          +{((card.definition.base_effect.magnitude ?? 0) * 100).toFixed(0)}%{' '}
          {(card.definition.base_effect.effectType ?? '')
            .replace(/_/g, ' ')
            .toLowerCase()
            .slice(0, 16)}
        </div>
      )}

      {/* Tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 4 }}>
        {(card.definition.tags ?? []).slice(0, 3).map((tag) => (
          <span key={tag} style={{
            fontSize: 8,
            background: 'rgba(26,32,48,0.65)',
            border: '1px solid rgba(26,32,48,0.95)',
            color: 'var(--hud-text, #8fa0b8)',
            padding: '1px 4px',
            borderRadius: 3,
            fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            {String(tag).slice(0, 10)}
          </span>
        ))}
      </div>

      {/* Cost row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontSize: 11,
          fontWeight: 800,
          color: 'var(--hud-amber, #c9a84c)',
          fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)',
          letterSpacing: '0.06em',
        }}>
          {costLabel}
        </span>

        {trustLabel && (
          <span style={{
            fontSize: 9,
            color: 'var(--hud-teal, #1de9b6)',
            fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)',
            letterSpacing: '0.08em',
          }}>
            {trustLabel}
          </span>
        )}

        {divLabel && (
          <span style={{
            fontSize: 9,
            color: '#fb923c',
            fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)',
            letterSpacing: '0.08em',
          }}>
            {divLabel}
          </span>
        )}

        {gameMode === GameMode.GO_ALONE && !isHeld && isPlayable && onHold && (
          <button
            onClick={handleHold}
            style={{
              background: 'rgba(124,58,237,0.18)',
              border: '1px solid rgba(124,58,237,0.45)',
              borderRadius: 4,
              color: 'rgba(196,181,253,0.95)',
              fontSize: 8,
              padding: '2px 5px',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            HOLD
          </button>
        )}
      </div>

      {/* Forced badge */}
      {isForced && (
        <div style={{
          position: 'absolute',
          top: -6,
          right: -6,
          background: 'rgba(192,57,43,0.95)',
          border: '1px solid rgba(192,57,43,0.95)',
          color: '#fff',
          fontSize: 8,
          fontWeight: 900,
          padding: '2px 5px',
          borderRadius: 4,
          fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          boxShadow: '0 0 10px rgba(192,57,43,0.25)',
          animation: 'pzoForcedPulse 0.7s ease-in-out infinite alternate',
        }}>
          FORCED
        </div>
      )}
    </div>
  );
});

export default CardSlot;