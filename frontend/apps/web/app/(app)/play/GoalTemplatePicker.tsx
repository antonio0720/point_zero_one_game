/**
 * GoalTemplatePicker.tsx — POINT ZERO ONE
 * Goal template selection card grid.
 * Design-system aligned: zinc/indigo terminal tokens.
 *
 * FILE LOCATION: frontend/apps/web/app/(app)/play/GoalTemplatePicker.tsx
 * Density6 LLC · Confidential
 */

'use client';

import { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type GoalTemplatePickerProps = {
  onSelect:    (value: string) => void;
  selected?:   string | null;
  accent?:     string;
  accentRgb?:  string;
};

// ─── Goal definitions ─────────────────────────────────────────────────────────

const GOAL_TEMPLATES = [
  {
    id:       'Debt Escape',
    icon:     '🔗',
    label:    'DEBT ESCAPE',
    tagline:  'Break the chain.',
    desc:     'Your debt is a drain on every future decision. This run teaches you to cut it faster than the interest compounds.',
    stat:     'Avg payoff in 4.2 turns',
    color:    '#FF4D4D',
    colorRgb: '255,77,77',
  },
  {
    id:       'First 100K',
    icon:     '🎯',
    label:    'FIRST 100K',
    tagline:  'The hardest money you\'ll ever make.',
    desc:     'The first $100K is a mental game. Build the habits, compress the timeline, and learn why most people never get here.',
    stat:     'Median completion: 7 turns',
    color:    '#F5C842',
    colorRgb: '245,200,66',
  },
  {
    id:       'Cashflow Builder',
    icon:     '🌊',
    label:    'CASHFLOW BUILDER',
    tagline:  'Money that works while you sleep.',
    desc:     'Stop chasing income. Build the systems that generate it. Every card you play in this run teaches you a cashflow principle.',
    stat:     'Passive income target: $5K/mo',
    color:    '#00D4B8',
    colorRgb: '0,212,184',
  },
] as const;

type GoalId = typeof GOAL_TEMPLATES[number]['id'];

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  text:    '#F0F0FF',
  textSub: '#B8B8D8',
  textDim: '#6A6A90',
  textMut: '#3A3A58',
  border:  'rgba(255,255,255,0.07)',
  mono:    'var(--font-dm-mono, "DM Mono", monospace)',
  display: 'var(--font-barlow, "Barlow Condensed", Impact, system-ui, sans-serif)',
  body:    'var(--font-dm-sans, "DM Sans", system-ui, sans-serif)',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function GoalTemplatePicker({
  onSelect,
  selected  = null,
  accent    = '#818CF8',
  accentRgb = '129,140,248',
}: GoalTemplatePickerProps) {
  const [hovered, setHovered] = useState<GoalId | null>(null);

  return (
    <section>
      {/* Section header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 10, fontFamily: T.mono, fontWeight: 700,
          letterSpacing: '0.3em', textTransform: 'uppercase',
          color: accent, marginBottom: 6,
        }}>
          Step 1 of 2
        </div>
        <h2 style={{
          fontFamily: T.display, fontWeight: 900, fontSize: 'clamp(1.6rem, 4vw, 2.2rem)',
          color: T.text, margin: 0, lineHeight: 1,
        }}>
          SELECT YOUR GOAL
        </h2>
        <p style={{ color: T.textDim, fontSize: 13, fontFamily: T.mono, marginTop: 8, letterSpacing: '0.04em' }}>
          This sets the pressure system for your entire run.
        </p>
      </div>

      {/* Card grid */}
      <div style={{
        display: 'grid', gap: 12,
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      }}>
        {GOAL_TEMPLATES.map((goal) => {
          const isSelected = selected === goal.id;
          const isHovered  = hovered  === goal.id;
          const active     = isSelected || isHovered;

          return (
            <button
              key={goal.id}
              type="button"
              onClick={() => onSelect(goal.id)}
              onMouseEnter={() => setHovered(goal.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                textAlign: 'left', cursor: 'pointer', padding: 0,
                borderRadius: 12, overflow: 'hidden',
                border: `1px solid ${isSelected
                  ? `rgba(${goal.colorRgb},0.55)`
                  : active
                    ? `rgba(${goal.colorRgb},0.30)`
                    : 'rgba(255,255,255,0.07)'}`,
                background: isSelected
                  ? `linear-gradient(135deg, rgba(${goal.colorRgb},0.12) 0%, rgba(15,15,32,0.95) 100%)`
                  : active
                    ? `rgba(${goal.colorRgb},0.05)`
                    : 'rgba(15,15,32,0.8)',
                boxShadow: isSelected
                  ? `0 0 28px rgba(${goal.colorRgb},0.25), inset 0 0 16px rgba(${goal.colorRgb},0.06)`
                  : 'none',
                transform:  active ? 'translateY(-2px)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Accent top bar */}
              <div style={{
                height: 2,
                background: isSelected
                  ? `linear-gradient(90deg, transparent, ${goal.color}, rgba(${goal.colorRgb},0.5), transparent)`
                  : 'transparent',
                transition: 'background 0.2s ease',
              }} />

              <div style={{ padding: '18px 20px' }}>
                {/* Icon + label row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 24, lineHeight: 1 }}>{goal.icon}</span>
                  <div>
                    <div style={{
                      fontSize: 10, fontFamily: T.mono, fontWeight: 700,
                      letterSpacing: '0.25em', textTransform: 'uppercase',
                      color: isSelected ? goal.color : T.textDim,
                      transition: 'color 0.2s ease',
                    }}>
                      {goal.label}
                    </div>
                    <div style={{
                      fontFamily: T.display, fontWeight: 800,
                      fontSize: 18, color: T.text, lineHeight: 1.1,
                    }}>
                      {goal.tagline}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p style={{
                  fontSize: 12, lineHeight: 1.65, color: T.textSub,
                  fontFamily: T.body, margin: '0 0 12px',
                }}>
                  {goal.desc}
                </p>

                {/* Stat chip */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px', borderRadius: 100,
                  background: `rgba(${goal.colorRgb},0.08)`,
                  border: `1px solid rgba(${goal.colorRgb},0.20)`,
                  fontSize: 10, fontFamily: T.mono, color: goal.color,
                  letterSpacing: '0.05em',
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: goal.color, display: 'inline-block' }} />
                  {goal.stat}
                </div>

                {/* Selected indicator */}
                {isSelected && (
                  <div style={{
                    marginTop: 12,
                    fontSize: 10, fontFamily: T.mono, color: goal.color,
                    letterSpacing: '0.2em', textTransform: 'uppercase',
                    fontWeight: 700,
                  }}>
                    ✓ SELECTED
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}