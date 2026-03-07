/**
 * ProfileTemplatePicker.tsx — POINT ZERO ONE
 * Player profile archetype selection.
 * Design-system aligned: zinc/indigo terminal tokens.
 *
 * FILE LOCATION: frontend/apps/web/app/(app)/play/ProfileTemplatePicker.tsx
 * Density6 LLC · Confidential
 */

'use client';

import { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ProfileTemplatePickerProps = {
  onSelect:    (value: string) => void;
  selected?:   string | null;
  accent?:     string;
  accentRgb?:  string;
};

// ─── Profile definitions ──────────────────────────────────────────────────────

const PROFILE_TEMPLATES = [
  {
    id:       'Solo Builder',
    icon:     '🏗️',
    label:    'SOLO BUILDER',
    tagline:  'Self-made or nothing.',
    desc:     'You rely on no one. Your decisions have no margin for error — but when you win, you own every inch of it.',
    strengths: ['High risk tolerance', 'Full income control', 'No coordination tax'],
    weakness:  'No bailout events',
    color:    '#F5C842',
    colorRgb: '245,200,66',
  },
  {
    id:       'Corporate Climber',
    icon:     '📊',
    label:    'CORPORATE CLIMBER',
    tagline:  'The system is the ladder.',
    desc:     'You know how to work inside structures. Leverage, access, and positioning are your weapons. The ceiling is real — but so are the shortcuts.',
    strengths: ['Salary shield events', 'Network bonus cards', 'Promotion multipliers'],
    weakness:  'Layoff vulnerability',
    color:    '#818CF8',
    colorRgb: '129,140,248',
  },
  {
    id:       'Creative Operator',
    icon:     '🎨',
    label:    'CREATIVE OPERATOR',
    tagline:  'Turn craft into capital.',
    desc:     'You monetize what others call a hobby. Volatile income, asymmetric upside. One card can 10× everything — or wipe the board.',
    strengths: ['IP royalty events', 'Viral upside multipliers', 'Low barrier to entry'],
    weakness:  'High income variance',
    color:    '#00D4B8',
    colorRgb: '0,212,184',
  },
] as const;

type ProfileId = typeof PROFILE_TEMPLATES[number]['id'];

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

export default function ProfileTemplatePicker({
  onSelect,
  selected  = null,
  accent    = '#818CF8',
  accentRgb = '129,140,248',
}: ProfileTemplatePickerProps) {
  const [hovered, setHovered] = useState<ProfileId | null>(null);

  return (
    <section>
      {/* Section header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 10, fontFamily: T.mono, fontWeight: 700,
          letterSpacing: '0.3em', textTransform: 'uppercase',
          color: accent, marginBottom: 6,
        }}>
          Step 2 of 2
        </div>
        <h2 style={{
          fontFamily: T.display, fontWeight: 900, fontSize: 'clamp(1.6rem, 4vw, 2.2rem)',
          color: T.text, margin: 0, lineHeight: 1,
        }}>
          SELECT YOUR ARCHETYPE
        </h2>
        <p style={{ color: T.textDim, fontSize: 13, fontFamily: T.mono, marginTop: 8, letterSpacing: '0.04em' }}>
          This seeds your starting deck and income event weights.
        </p>
      </div>

      {/* Card grid */}
      <div style={{
        display: 'grid', gap: 12,
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      }}>
        {PROFILE_TEMPLATES.map((profile) => {
          const isSelected = selected === profile.id;
          const isHovered  = hovered  === profile.id;
          const active     = isSelected || isHovered;

          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => onSelect(profile.id)}
              onMouseEnter={() => setHovered(profile.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                textAlign: 'left', cursor: 'pointer', padding: 0,
                borderRadius: 12, overflow: 'hidden',
                border: `1px solid ${isSelected
                  ? `rgba(${profile.colorRgb},0.55)`
                  : active
                    ? `rgba(${profile.colorRgb},0.30)`
                    : 'rgba(255,255,255,0.07)'}`,
                background: isSelected
                  ? `linear-gradient(135deg, rgba(${profile.colorRgb},0.12) 0%, rgba(15,15,32,0.95) 100%)`
                  : active
                    ? `rgba(${profile.colorRgb},0.05)`
                    : 'rgba(15,15,32,0.8)',
                boxShadow: isSelected
                  ? `0 0 28px rgba(${profile.colorRgb},0.25), inset 0 0 16px rgba(${profile.colorRgb},0.06)`
                  : 'none',
                transform:  active ? 'translateY(-2px)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Accent top bar */}
              <div style={{
                height: 2,
                background: isSelected
                  ? `linear-gradient(90deg, transparent, ${profile.color}, rgba(${profile.colorRgb},0.5), transparent)`
                  : 'transparent',
                transition: 'background 0.2s ease',
              }} />

              <div style={{ padding: '18px 20px' }}>
                {/* Icon + label row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 24, lineHeight: 1 }}>{profile.icon}</span>
                  <div>
                    <div style={{
                      fontSize: 10, fontFamily: T.mono, fontWeight: 700,
                      letterSpacing: '0.25em', textTransform: 'uppercase',
                      color: isSelected ? profile.color : T.textDim,
                      transition: 'color 0.2s ease',
                    }}>
                      {profile.label}
                    </div>
                    <div style={{
                      fontFamily: T.display, fontWeight: 800,
                      fontSize: 18, color: T.text, lineHeight: 1.1,
                    }}>
                      {profile.tagline}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p style={{
                  fontSize: 12, lineHeight: 1.65, color: T.textSub,
                  fontFamily: T.body, margin: '0 0 12px',
                }}>
                  {profile.desc}
                </p>

                {/* Strengths */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {profile.strengths.map((s) => (
                    <span
                      key={s}
                      style={{
                        padding: '3px 8px', borderRadius: 100,
                        background: `rgba(${profile.colorRgb},0.08)`,
                        border: `1px solid rgba(${profile.colorRgb},0.18)`,
                        fontSize: 10, fontFamily: T.mono,
                        color: profile.color, letterSpacing: '0.04em',
                      }}
                    >
                      + {s}
                    </span>
                  ))}
                </div>

                {/* Weakness */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '3px 8px', borderRadius: 100,
                  background: 'rgba(255,77,77,0.06)',
                  border: '1px solid rgba(255,77,77,0.18)',
                  fontSize: 10, fontFamily: T.mono,
                  color: '#FF7070', letterSpacing: '0.04em',
                }}>
                  − {profile.weakness}
                </div>

                {/* Selected indicator */}
                {isSelected && (
                  <div style={{
                    marginTop: 12,
                    fontSize: 10, fontFamily: T.mono, color: profile.color,
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