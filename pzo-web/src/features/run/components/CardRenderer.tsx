// FILE: pzo-web/src/features/run/components/CardRenderer.tsx
//
// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — CardRenderer (HUD-MATCHED)
//
// This file previously contained an invalid styled-components stub with a self-import.
// Replaced with a safe, dependency-free renderer usable anywhere.
//
// Density6 LLC · Point Zero One · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';

export interface CardRendererProps {
  /** Optional raw card-like object; if present, renderer will attempt to read common fields. */
  card?: any;

  title?: string;
  subtitle?: string;

  lines?: string[];

  /** Accent color for stripe/border. */
  accent?: string;

  /** State flags */
  forced?: boolean;
  legendary?: boolean;
  disabled?: boolean;

  /** Right-side footer text */
  footerRight?: string;
  /** Left-side footer text */
  footerLeft?: string;

  /** Click handler */
  onClick?: () => void;

  className?: string;
}

export const CardRenderer: React.FC<CardRendererProps> = ({
  card,
  title,
  subtitle,
  lines = [],
  accent,
  forced = false,
  legendary = false,
  disabled = false,
  footerLeft,
  footerRight,
  onClick,
  className = '',
}) => {
  const resolvedTitle =
    title ??
    card?.definition?.name ??
    card?.name ??
    'CARD';

  const resolvedSubtitle =
    subtitle ??
    card?.definition?.timingClass ??
    card?.timingClass ??
    '';

  const resolvedAccent =
    accent ??
    (legendary ? 'var(--hud-amber, #c9a84c)' : forced ? 'var(--hud-crimson, #c0392b)' : 'var(--hud-teal, #1de9b6)');

  const safeLines: string[] =
    lines.length > 0
      ? lines
      : Array.isArray(card?.definition?.tags)
        ? (card.definition.tags as any[]).slice(0, 3).map((t: any) => String(t))
        : [];

  const border = legendary
    ? '1px solid rgba(201,168,76,0.85)'
    : forced
      ? '1px solid rgba(192,57,43,0.95)'
      : `1px solid rgba(26,32,48,0.95)`;

  const glow = legendary
    ? '0 0 16px rgba(201,168,76,0.18), 0 10px 22px rgba(0,0,0,0.45)'
    : forced
      ? '0 0 18px rgba(192,57,43,0.22), 0 10px 22px rgba(0,0,0,0.45)'
      : '0 10px 22px rgba(0,0,0,0.45)';

  return (
    <div
      className={className}
      role={onClick ? 'button' : 'presentation'}
      tabIndex={onClick && !disabled ? 0 : -1}
      onClick={disabled ? undefined : onClick}
      onKeyDown={(e) => {
        if (!onClick || disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        width: 220,
        borderRadius: 12,
        border,
        background: `
          radial-gradient(circle at 18% 12%, ${String(resolvedAccent).includes('var(') ? 'rgba(29,233,182,0.20)' : `${resolvedAccent}33`} 0%, transparent 55%),
          linear-gradient(180deg, var(--hud-panel, #0c0f14) 0%, var(--hud-bg, #080a0d) 100%)
        `,
        boxShadow: glow,
        padding: 12,
        color: 'var(--hud-text-bright, #c8d8f0)',
        opacity: disabled ? 0.55 : 1,
        cursor: onClick && !disabled ? 'pointer' : 'default',
        userSelect: 'none',
        fontFamily: 'var(--font-ui, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: '0 0 auto 0',
          height: 4,
          background: `linear-gradient(90deg, transparent, ${resolvedAccent}, transparent)`,
          opacity: 0.9,
        }}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontFamily:
              'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)',
            letterSpacing: '.10em',
            textTransform: 'uppercase',
            fontSize: 11,
            fontWeight: 900,
          }}
        >
          {resolvedTitle}
        </div>
        {resolvedSubtitle && (
          <div
            style={{
              fontFamily:
                'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)',
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              fontSize: 9,
              color: 'var(--hud-text, #8fa0b8)',
            }}
          >
            {String(resolvedSubtitle)}
          </div>
        )}
      </div>

      {safeLines.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {safeLines.slice(0, 6).map((l: string, i: number) => (
            <div
              key={i}
              style={{
                fontFamily:
                  'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)',
                fontSize: 10,
                letterSpacing: '.08em',
                color: 'var(--hud-text, #8fa0b8)',
                textTransform: 'uppercase',
                borderLeft: `2px solid ${resolvedAccent}`,
                paddingLeft: 8,
                opacity: 0.95,
              }}
            >
              {l}
            </div>
          ))}
        </div>
      )}

      {(footerLeft || footerRight) && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 8,
            borderTop: '1px solid rgba(26,32,48,0.95)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              fontFamily:
                'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)',
              fontSize: 9,
              letterSpacing: '.16em',
              color: 'var(--hud-text, #8fa0b8)',
              textTransform: 'uppercase',
            }}
          >
            {footerLeft ?? ''}
          </div>
          <div
            style={{
              fontFamily:
                'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)',
              fontSize: 9,
              letterSpacing: '.16em',
              color: resolvedAccent,
              textTransform: 'uppercase',
            }}
          >
            {footerRight ?? ''}
          </div>
        </div>
      )}

      {forced && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            fontFamily:
              'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)',
            fontSize: 9,
            letterSpacing: '.18em',
            textTransform: 'uppercase',
            color: 'var(--hud-crimson, #c0392b)',
            background: 'rgba(192,57,43,0.10)',
            border: '1px solid rgba(192,57,43,0.55)',
            padding: '2px 6px',
            borderRadius: 8,
          }}
        >
          FORCED
        </div>
      )}
    </div>
  );
};

export default CardRenderer;