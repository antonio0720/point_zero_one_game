// FILE: pzo-web/src/features/run/components/DecisionTimerRing.tsx
//
// NOTE: If you expected additional files beyond the ones included in this reply and they expired from upload,
// re-upload them so I can update them too.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — DECISION TIMER RING (HUD-MATCHED)
//
// SVG countdown ring wrapping each card slot.
// View can be driven either by:
//   (A) precomputed DecisionWindowInfo via useAllDecisionWindows (preferred for hand-wide rAF), OR
//   (B) direct hook call useDecisionWindow(cardInstanceId) (fallback).
//
// Density6 LLC · Point Zero One · Cards Engine · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';
import { useDecisionWindow, formatCountdown } from '../hooks/useDecisionWindow';
import type { DecisionWindowInfo } from '../hooks/useDecisionWindow';

// ─────────────────────────────────────────────────────────────────────────────
// STYLE INJECTION (HUD matched)
// ─────────────────────────────────────────────────────────────────────────────

const DECISION_RING_STYLES = `
  .pzo-timer-ring-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .pzo-timer-ring__svg {
    transform: translate(-50%, -50%) rotate(-90deg);
    transform-origin: center;
  }

  .pzo-timer-ring--pulsing .pzo-timer-ring__svg {
    animation: pzoRingPulse 0.65s ease-in-out infinite alternate;
  }

  .pzo-timer-ring--flashing .pzo-timer-ring__flash-overlay {
    animation: pzoRingFlash 0.35s ease-in-out infinite alternate;
  }

  .pzo-timer-ring__countdown {
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace);
    letter-spacing: .12em;
    text-transform: uppercase;
  }

  @keyframes pzoRingPulse {
    from { transform: translate(-50%, -50%) rotate(-90deg) scale(1); }
    to   { transform: translate(-50%, -50%) rotate(-90deg) scale(1.06); }
  }

  @keyframes pzoRingFlash {
    from { opacity: 0.15; }
    to   { opacity: 0.65; }
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
// GEOMETRY
// ─────────────────────────────────────────────────────────────────────────────

const SIZE          = 88;
const STROKE        = 3.5;
const CX            = SIZE / 2;
const CY            = SIZE / 2;
const RADIUS        = CX - STROKE / 2 - 1;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// ─────────────────────────────────────────────────────────────────────────────
// COLOR STOPS (HUD matched)
// ─────────────────────────────────────────────────────────────────────────────

const C_TEAL   = '#1de9b6';
const C_AMBER  = '#c9a84c';
const C_ORANGE = '#f97316';
const C_RED    = '#c0392b';
const C_GOLD   = '#f5c542'; // paused / hold

// ─────────────────────────────────────────────────────────────────────────────
// THRESHOLDS
// ─────────────────────────────────────────────────────────────────────────────

const AMBER_AT  = 0.50;
const ORANGE_AT = 0.70;
const RED_AT    = 0.80;
const FLASH_MS  = 1_400;

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

type BaseProps = {
  children: React.ReactNode;
  className?: string;
  onAutoResolveEnd?: () => void;
  showCountdown?: boolean;
};

export type DecisionTimerRingProps =
  | (BaseProps & { cardInstanceId: string; info?: never })
  | (BaseProps & { info: DecisionWindowInfo; cardInstanceId?: string });

export const DecisionTimerRing: React.FC<DecisionTimerRingProps> = (props) => {
  useEffect(() => {
    injectStylesOnce('pzo-decision-ring-styles', DECISION_RING_STYLES);
  }, []);

  if ('info' in props) {
    if (!props.info) {
      // If info is undefined, render nothing or a fallback
      return <div className={`pzo-timer-ring-wrapper ${props.className ?? ''}`}>{props.children}</div>;
    }
    return (
      <DecisionTimerRingView
        info={props.info}
        cardInstanceId={props.cardInstanceId}
        className={props.className}
        onAutoResolveEnd={props.onAutoResolveEnd}
        showCountdown={props.showCountdown}
      >
        {props.children}
      </DecisionTimerRingView>
    );
  }

  return (
    <DecisionTimerRingConnected
      cardInstanceId={props.cardInstanceId}
      className={props.className}
      onAutoResolveEnd={props.onAutoResolveEnd}
      showCountdown={props.showCountdown}
    >
      {props.children}
    </DecisionTimerRingConnected>
  );
};

const DecisionTimerRingConnected: React.FC<
  Omit<DecisionTimerRingProps, 'info'> & { cardInstanceId: string }
> = ({ cardInstanceId, children, className, onAutoResolveEnd, showCountdown }) => {
  const info = useDecisionWindow(cardInstanceId);
  return (
    <DecisionTimerRingView
      info={info}
      cardInstanceId={cardInstanceId}
      className={className}
      onAutoResolveEnd={onAutoResolveEnd}
      showCountdown={showCountdown}
    >
      {children}
    </DecisionTimerRingView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// VIEW
// ─────────────────────────────────────────────────────────────────────────────

const DecisionTimerRingView: React.FC<
  {
    info: DecisionWindowInfo;
    cardInstanceId?: string;
    className?: string;
    onAutoResolveEnd?: () => void;
    showCountdown?: boolean;
    children: React.ReactNode;
  }
> = ({ info, cardInstanceId, children, className = '', onAutoResolveEnd, showCountdown = false }) => {
  const [flashActive, setFlashActive] = useState(false);
  const [flashDone, setFlashDone] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevExpiredRef = useRef(false);

  useEffect(() => {
    if (info.isExpired && !prevExpiredRef.current && !flashDone) {
      prevExpiredRef.current = true;
      setFlashActive(true);

      flashTimerRef.current = setTimeout(() => {
        setFlashActive(false);
        setFlashDone(true);
        onAutoResolveEnd?.();
      }, FLASH_MS);
    }
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, [info.isExpired, flashDone, onAutoResolveEnd]);

  // IMMEDIATE / LEGENDARY: no window
  if (!info.hasWindow) {
    return <div className={`pzo-timer-ring-wrapper ${className}`}>{children}</div>;
  }

  // After flash completes: ring removed
  if (flashDone) {
    return <div className={`pzo-timer-ring-wrapper ${className}`}>{children}</div>;
  }

  // Resolved (played): ring disappears instantly
  if (info.isResolved && !info.isExpired) {
    return <div className={`pzo-timer-ring-wrapper ${className}`}>{children}</div>;
  }

  const fraction   = info.fraction; // 1.0 → 0.0
  const clamped    = Math.max(0, Math.min(1, fraction));
  const dashOffset = CIRCUMFERENCE * (1 - clamped);

  const arcAngle = clamped * 2 * Math.PI - Math.PI / 2;
  const tipX     = CX + RADIUS * Math.cos(arcAngle);
  const tipY     = CY + RADIUS * Math.sin(arcAngle);

  let ringColor: string;
  if (info.isPaused) {
    ringColor = C_GOLD;
  } else if (flashActive) {
    ringColor = C_RED;
  } else if (info.progress < AMBER_AT) {
    ringColor = lerpHex(C_TEAL, C_AMBER, info.progress / AMBER_AT);
  } else if (info.progress < ORANGE_AT) {
    ringColor = lerpHex(C_AMBER, C_ORANGE, (info.progress - AMBER_AT) / (ORANGE_AT - AMBER_AT));
  } else {
    ringColor = lerpHex(C_ORANGE, C_RED, Math.min(1, (info.progress - ORANGE_AT) / (1 - ORANGE_AT)));
  }

  const glowColor   = info.isRedZone || flashActive ? C_RED : ringColor;
  const glowRadius  = info.isRedZone ? 5 : info.isYellowZone ? 3 : 2;
  const glowOpacity = info.isRedZone ? 0.80 : 0.50;
  const dropShadow  = `drop-shadow(0 0 ${glowRadius}px rgba(${hexToRgbStr(glowColor)},${glowOpacity}))`;

  const wrapperClasses = [
    'pzo-timer-ring-wrapper',
    className,
    info.isRedZone && !flashActive ? 'pzo-timer-ring--pulsing' : '',
    flashActive ? 'pzo-timer-ring--flashing' : '',
    info.isPaused ? 'pzo-timer-ring--paused' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={wrapperClasses}
      role="timer"
      aria-label={
        cardInstanceId
          ? `Decision timer (${cardInstanceId}): ${formatCountdown(info.remainingMs)} remaining`
          : `Decision timer: ${formatCountdown(info.remainingMs)} remaining`
      }
      aria-live="off"
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <svg
        className="pzo-timer-ring__svg"
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          pointerEvents: 'none',
          zIndex: 10,
          filter: dropShadow,
        }}
        aria-hidden="true"
      >
        <circle
          cx={CX}
          cy={CY}
          r={RADIUS}
          fill="none"
          stroke="rgba(26,32,48,0.75)"
          strokeWidth={STROKE}
        />

        <circle
          className="pzo-timer-ring__arc"
          cx={CX}
          cy={CY}
          r={RADIUS}
          fill="none"
          stroke={ringColor}
          strokeWidth={STROKE}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{
            transition: flashActive ? 'none' : 'stroke-dashoffset 0.07s linear, stroke 0.15s ease',
          }}
        />

        {clamped > 0.015 && !info.isExpired && (
          <circle
            className="pzo-timer-ring__tip"
            cx={tipX}
            cy={tipY}
            r={STROKE * 0.85}
            fill={ringColor}
            style={{ transition: flashActive ? 'none' : 'fill 0.15s ease' }}
          />
        )}
      </svg>

      {flashActive && (
        <div
          className="pzo-timer-ring__flash-overlay"
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 10,
            background: 'rgba(192,57,43,0.28)',
            pointerEvents: 'none',
            zIndex: 9,
          }}
        />
      )}

      {showCountdown && info.hasWindow && (
        <div
          className="pzo-timer-ring__countdown"
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: -16,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 9,
            fontWeight: 700,
            color: ringColor,
            whiteSpace: 'nowrap',
            zIndex: 11,
            transition: 'color 0.15s ease',
          }}
        >
          {formatCountdown(info.remainingMs)}
        </div>
      )}

      <div className="pzo-timer-ring__card-content" style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
};

export default DecisionTimerRing;

// ─────────────────────────────────────────────────────────────────────────────
// COLOR HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : [255, 255, 255];
}

function hexToRgbStr(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return `${r},${g},${b}`;
}

function lerpHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const tc = Math.max(0, Math.min(1, t));
  return `rgb(${Math.round(ar + (br - ar) * tc)},${Math.round(ag + (bg - ag) * tc)},${Math.round(ab + (bb - ab) * tc)})`;
}