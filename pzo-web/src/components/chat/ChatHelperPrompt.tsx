/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT RENDER SHELL
 * FILE: pzo-web/src/components/chat/ChatHelperPrompt.tsx
 * VERSION: 2.0.0
 * AUTHOR: OpenAI
 * LICENSE: Internal / Project Use Only
 * ============================================================================
 *
 * Purpose
 * -------
 * Presentation-only helper prompt surface for the unified chat dock.
 *
 * This component is intentionally thin:
 * - no engine imports
 * - no store imports
 * - no policy imports
 * - no socket ownership
 * - no helper decision logic
 * - no moment planning
 * - no priority computation
 * - no runtime authority
 *
 * It accepts a fully materialized HelperPromptViewModel from uiTypes and renders
 * it without mutating game truth.
 *
 * Long-term authorities remain:
 * - /shared/contracts/chat
 * - /pzo-web/src/engines/chat
 * - /pzo-web/src/components/chat
 * - /backend/src/game/engine/chat
 * - /pzo-server/src/chat
 * ============================================================================
 */

import React, { memo, useId } from 'react';

import type { ChatVisibleChannel } from '../../../../shared/contracts/chat/ChatChannels';
import type {
  HelperPromptActionViewModel,
  HelperPromptBadgeViewModel,
  HelperPromptEvidenceViewModel,
  HelperPromptMetricViewModel,
  HelperPromptViewModel,
} from './uiTypes';

// ============================================================================
// MARK: Design tokens
// ============================================================================

const TOKENS = Object.freeze({
  void: '#04050A',
  panel: '#0B1020',
  panelElevated: '#11182B',
  panelRaised: '#18233A',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',
  borderActive: 'rgba(129,140,248,0.34)',
  text: '#EEF2FF',
  textSoft: '#B7C0DB',
  textMuted: '#7F8AA8',
  textFaint: '#58627C',
  white: '#FFFFFF',
  black: '#000000',
  indigo: '#818CF8',
  cyan: '#22D3EE',
  violet: '#A78BFA',
  emerald: '#34D399',
  amber: '#FBBF24',
  orange: '#FB923C',
  red: '#F87171',
  rose: '#FB7185',
  blue: '#60A5FA',
  slate: '#94A3B8',
  shadowLg: '0 28px 64px rgba(0,0,0,0.40)',
  shadowMd: '0 14px 30px rgba(0,0,0,0.28)',
  shadowSm: '0 8px 18px rgba(0,0,0,0.16)',
  radiusXl: 22,
  radiusLg: 18,
  radiusMd: 14,
  radiusSm: 12,
  fontBody: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontMono: "'IBM Plex Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
}) as const;

const SURFACE_GRADIENT =
  'linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.015) 100%)';

// ============================================================================
// MARK: Public props
// ============================================================================

export interface ChatHelperPromptProps {
  readonly prompt: HelperPromptViewModel | null | undefined;
  readonly activeChannel?: ChatVisibleChannel;
  readonly className?: string;
  readonly style?: React.CSSProperties;
  readonly onDismiss?: (prompt: HelperPromptViewModel) => void;
  readonly onAction?: (actionId: string, prompt: HelperPromptViewModel) => void;
  readonly onOpenChannel?: (
    channel: ChatVisibleChannel,
    prompt: HelperPromptViewModel,
  ) => void;
}

// ============================================================================
// MARK: Pure display helpers
// ============================================================================

function notBlank(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function initialsFromName(value: string | undefined, fallback = 'HP'): string {
  if (!notBlank(value)) return fallback;
  const tokens = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (tokens.length === 0) return fallback;
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return `${tokens[0][0] ?? ''}${tokens[1][0] ?? ''}`.toUpperCase();
}

function resolveAccent(prompt: HelperPromptViewModel): string {
  if (notBlank(prompt.presentation.accentHex)) return prompt.presentation.accentHex.trim();

  switch (prompt.presentation.severity) {
    case 'positive':
      return TOKENS.emerald;
    case 'warning':
      return TOKENS.amber;
    case 'danger':
      return TOKENS.red;
    case 'dramatic':
      return TOKENS.violet;
    case 'neutral':
    default:
      return TOKENS.indigo;
  }
}

function resolveDensity(prompt: HelperPromptViewModel): 'compact' | 'standard' | 'expanded' {
  return prompt.presentation.density ?? 'standard';
}

function toneColor(tone: HelperPromptBadgeViewModel['tone']): string {
  switch (tone) {
    case 'positive':
      return TOKENS.emerald;
    case 'warning':
      return TOKENS.amber;
    case 'danger':
      return TOKENS.red;
    case 'dramatic':
      return TOKENS.violet;
    case 'neutral':
    default:
      return TOKENS.slate;
  }
}

function toneBackground(tone: HelperPromptBadgeViewModel['tone']): string {
  switch (tone) {
    case 'positive':
      return 'rgba(52,211,153,0.12)';
    case 'warning':
      return 'rgba(251,191,36,0.12)';
    case 'danger':
      return 'rgba(248,113,113,0.12)';
    case 'dramatic':
      return 'rgba(167,139,250,0.12)';
    case 'neutral':
    default:
      return 'rgba(148,163,184,0.12)';
  }
}

function toneBorder(tone: HelperPromptBadgeViewModel['tone']): string {
  switch (tone) {
    case 'positive':
      return 'rgba(52,211,153,0.25)';
    case 'warning':
      return 'rgba(251,191,36,0.25)';
    case 'danger':
      return 'rgba(248,113,113,0.25)';
    case 'dramatic':
      return 'rgba(167,139,250,0.25)';
    case 'neutral':
    default:
      return 'rgba(148,163,184,0.18)';
  }
}

function actionStyles(
  action: HelperPromptActionViewModel,
  accent: string,
): React.CSSProperties {
  const variant = action.variant ?? 'secondary';

  switch (variant) {
    case 'primary':
      return {
        background: `linear-gradient(135deg, ${accent}, rgba(255,255,255,0.16))`,
        color: TOKENS.white,
        border: '1px solid rgba(255,255,255,0.10)',
        boxShadow: `0 10px 26px color-mix(in srgb, ${accent} 28%, transparent)`,
      };
    case 'danger':
      return {
        background: 'rgba(248,113,113,0.12)',
        color: TOKENS.red,
        border: '1px solid rgba(248,113,113,0.22)',
      };
    case 'ghost':
      return {
        background: 'transparent',
        color: TOKENS.textSoft,
        border: `1px solid ${TOKENS.border}`,
      };
    case 'secondary':
    default:
      return {
        background: 'rgba(255,255,255,0.04)',
        color: TOKENS.text,
        border: `1px solid ${TOKENS.borderStrong}`,
      };
  }
}

function clampPercent(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  if ((value as number) < 0) return 0;
  if ((value as number) > 100) return 100;
  return value as number;
}

function resolveMetricFill(metric: HelperPromptMetricViewModel): string {
  if (notBlank(metric.colorHex)) return metric.colorHex.trim();
  switch (metric.tone) {
    case 'positive':
      return TOKENS.emerald;
    case 'warning':
      return TOKENS.amber;
    case 'danger':
      return TOKENS.red;
    case 'dramatic':
      return TOKENS.violet;
    case 'neutral':
    default:
      return TOKENS.indigo;
  }
}

function resolveEvidenceColor(evidence: HelperPromptEvidenceViewModel): string {
  switch (evidence.tone) {
    case 'positive':
      return TOKENS.emerald;
    case 'warning':
      return TOKENS.amber;
    case 'danger':
      return TOKENS.red;
    case 'dramatic':
      return TOKENS.violet;
    case 'neutral':
    default:
      return TOKENS.text;
  }
}

function channelMismatchLabel(
  promptChannel: ChatVisibleChannel | undefined,
  activeChannel: ChatVisibleChannel | undefined,
): string | null {
  if (!promptChannel || !activeChannel) return null;
  if (promptChannel === activeChannel) return null;
  return `Viewing ${activeChannel.replaceAll('_', ' ')} while assist targets ${promptChannel.replaceAll('_', ' ')}.`;
}

// ============================================================================
// MARK: Presentational subcomponents
// ============================================================================

interface BadgeProps {
  readonly badge: HelperPromptBadgeViewModel;
  readonly accentOverride?: string;
}

const Badge = memo(function Badge({ badge, accentOverride }: BadgeProps): React.JSX.Element {
  const color = accentOverride ?? toneColor(badge.tone);

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        borderRadius: 999,
        padding: '6px 10px',
        border: `1px solid ${toneBorder(badge.tone)}`,
        background: toneBackground(badge.tone),
        color,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
      title={badge.description}
    >
      {notBlank(badge.leadingDotColorHex) ? (
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: badge.leadingDotColorHex,
            boxShadow: `0 0 0 4px color-mix(in srgb, ${badge.leadingDotColorHex} 16%, transparent)`,
          }}
        />
      ) : null}
      <span>{badge.label}</span>
    </span>
  );
});

interface MetricRowProps {
  readonly metric: HelperPromptMetricViewModel;
}

const MetricRow = memo(function MetricRow({ metric }: MetricRowProps): React.JSX.Element {
  const percent = clampPercent(metric.percentValue);
  const fill = resolveMetricFill(metric);

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: TOKENS.textSoft,
          }}
        >
          {metric.label}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: fill,
            fontFamily: TOKENS.fontMono,
          }}
        >
          {notBlank(metric.displayValue) ? metric.displayValue : `${Math.round(percent)}%`}
        </span>
      </div>
      <div
        aria-hidden="true"
        style={{
          position: 'relative',
          overflow: 'hidden',
          height: 9,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.06)',
          border: `1px solid ${TOKENS.border}`,
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: '100%',
            borderRadius: 999,
            background: fill,
            boxShadow: `0 0 18px color-mix(in srgb, ${fill} 30%, transparent)`,
          }}
        />
      </div>
      {notBlank(metric.caption) ? (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            lineHeight: 1.55,
            color: TOKENS.textMuted,
          }}
        >
          {metric.caption}
        </p>
      ) : null}
    </div>
  );
});

interface EvidenceRowProps {
  readonly evidence: HelperPromptEvidenceViewModel;
}

const EvidenceRow = memo(function EvidenceRow({ evidence }: EvidenceRowProps): React.JSX.Element {
  const valueColor = resolveEvidenceColor(evidence);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: 12,
        alignItems: 'start',
        padding: '12px 14px',
        borderRadius: TOKENS.radiusSm,
        border: `1px solid ${TOKENS.border}`,
        background: 'rgba(255,255,255,0.03)',
      }}
    >
      <div style={{ display: 'grid', gap: 4 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: TOKENS.textSoft,
            letterSpacing: '0.01em',
          }}
        >
          {evidence.label}
        </span>
        {notBlank(evidence.caption) ? (
          <span
            style={{
              fontSize: 12,
              lineHeight: 1.55,
              color: TOKENS.textMuted,
            }}
          >
            {evidence.caption}
          </span>
        ) : null}
      </div>
      <span
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: valueColor,
          fontFamily: TOKENS.fontMono,
          whiteSpace: 'nowrap',
        }}
      >
        {evidence.value}
      </span>
    </div>
  );
});

interface ActionButtonProps {
  readonly action: HelperPromptActionViewModel;
  readonly accent: string;
  readonly onPress?: (actionId: string) => void;
}

const ActionButton = memo(function ActionButton({
  action,
  accent,
  onPress,
}: ActionButtonProps): React.JSX.Element {
  const disabled = Boolean(action.disabled);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (!disabled) onPress?.(action.id);
      }}
      title={action.blockedReason || action.description}
      style={{
        appearance: 'none',
        display: 'grid',
        gap: 6,
        width: '100%',
        textAlign: 'left',
        padding: '14px 14px 13px',
        borderRadius: TOKENS.radiusMd,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.56 : 1,
        transition: 'transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease',
        ...actionStyles(action, accent),
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.25 }}>{action.label}</span>
        {notBlank(action.hotkeyHint) ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: action.variant === 'primary' ? 'rgba(255,255,255,0.88)' : TOKENS.textMuted,
              fontFamily: TOKENS.fontMono,
              whiteSpace: 'nowrap',
            }}
          >
            {action.hotkeyHint}
          </span>
        ) : null}
      </div>

      {notBlank(action.description) ? (
        <span
          style={{
            fontSize: 12,
            lineHeight: 1.5,
            color: action.variant === 'primary' ? 'rgba(255,255,255,0.86)' : TOKENS.textSoft,
          }}
        >
          {action.description}
        </span>
      ) : null}

      {disabled && notBlank(action.blockedReason) ? (
        <span
          style={{
            fontSize: 11,
            lineHeight: 1.45,
            color: TOKENS.textMuted,
          }}
        >
          {action.blockedReason}
        </span>
      ) : null}
    </button>
  );
});

// ============================================================================
// MARK: Component
// ============================================================================

function ChatHelperPromptComponent({
  prompt,
  activeChannel,
  className,
  style,
  onDismiss,
  onAction,
  onOpenChannel,
}: ChatHelperPromptProps): React.JSX.Element | null {
  const titleId = useId();
  const bodyId = useId();

  if (!prompt || !prompt.visible) return null;

  const density = resolveDensity(prompt);
  const accent = resolveAccent(prompt);
  const isCompact = density === 'compact';
  const isExpanded = density === 'expanded';
  const channelNote = channelMismatchLabel(prompt.channel?.id, activeChannel);
  const actorInitials = notBlank(prompt.actor.initials)
    ? prompt.actor.initials.trim().slice(0, 3).toUpperCase()
    : initialsFromName(prompt.actor.displayName);

  return (
    <aside
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        display: 'grid',
        gap: isCompact ? 14 : 18,
        padding: isCompact ? 16 : isExpanded ? 22 : 18,
        borderRadius: TOKENS.radiusXl,
        border: `1px solid ${TOKENS.borderStrong}`,
        background: `${SURFACE_GRADIENT}, ${TOKENS.panel}`,
        boxShadow: TOKENS.shadowLg,
        color: TOKENS.text,
        fontFamily: TOKENS.fontBody,
        ...style,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: `radial-gradient(circle at top right, color-mix(in srgb, ${accent} 26%, transparent) 0%, transparent 42%)`,
          opacity: 0.95,
        }}
      />

      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: '0 auto 0 0',
          width: 4,
          background: accent,
          boxShadow: `0 0 24px color-mix(in srgb, ${accent} 45%, transparent)`,
        }}
      />

      <header
        style={{
          position: 'relative',
          display: 'grid',
          gap: 14,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div
              aria-hidden="true"
              style={{
                width: isCompact ? 42 : 48,
                height: isCompact ? 42 : 48,
                borderRadius: 999,
                display: 'grid',
                placeItems: 'center',
                background: `linear-gradient(135deg, ${accent}, rgba(255,255,255,0.14))`,
                color: TOKENS.white,
                boxShadow: TOKENS.shadowMd,
                fontSize: 13,
                fontWeight: 900,
                letterSpacing: '0.08em',
              }}
            >
              {actorInitials}
            </div>

            <div style={{ display: 'grid', gap: 3, minWidth: 0 }}>
              {notBlank(prompt.copy.eyebrow) ? (
                <span
                  style={{
                    fontSize: 11,
                    lineHeight: 1,
                    letterSpacing: '0.09em',
                    textTransform: 'uppercase',
                    fontWeight: 800,
                    color: TOKENS.textMuted,
                  }}
                >
                  {prompt.copy.eyebrow}
                </span>
              ) : null}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    fontSize: isCompact ? 14 : 15,
                    fontWeight: 900,
                    lineHeight: 1.15,
                    color: TOKENS.text,
                  }}
                >
                  {prompt.actor.displayName}
                </span>

                {notBlank(prompt.actor.roleLabel) ? (
                  <span
                    style={{
                      fontSize: 12,
                      color: TOKENS.textMuted,
                      lineHeight: 1.2,
                    }}
                  >
                    {prompt.actor.roleLabel}
                  </span>
                ) : null}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                {notBlank(prompt.presentation.intentLabel) ? (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: accent,
                    }}
                  >
                    {prompt.presentation.intentLabel}
                  </span>
                ) : null}

                {notBlank(prompt.presentation.toneLabel) ? (
                  <span
                    style={{
                      fontSize: 12,
                      color: TOKENS.textMuted,
                    }}
                  >
                    {prompt.presentation.toneLabel}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {prompt.dismissible ? (
            <button
              type="button"
              aria-label="Dismiss helper prompt"
              onClick={() => onDismiss?.(prompt)}
              style={{
                appearance: 'none',
                width: 34,
                height: 34,
                borderRadius: 999,
                border: `1px solid ${TOKENS.border}`,
                background: 'rgba(255,255,255,0.03)',
                color: TOKENS.textSoft,
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                fontSize: 16,
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              ×
            </button>
          ) : null}
        </div>

        {(prompt.channel || prompt.badges.length > 0 || prompt.state.rescueCritical || prompt.state.escalated) ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            {prompt.channel ? (
              <button
                type="button"
                onClick={() => {
                  if (prompt.channel?.openable) onOpenChannel?.(prompt.channel.id, prompt);
                }}
                disabled={!prompt.channel.openable}
                style={{
                  appearance: 'none',
                  borderRadius: 999,
                  padding: '6px 10px',
                  border: `1px solid color-mix(in srgb, ${accent} 32%, rgba(255,255,255,0.10))`,
                  background: `color-mix(in srgb, ${accent} 12%, transparent)`,
                  color: accent,
                  cursor: prompt.channel.openable ? 'pointer' : 'default',
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                }}
              >
                {prompt.channel.label}
              </button>
            ) : null}

            {prompt.state.rescueCritical ? (
              <Badge badge={{ label: 'Critical rescue', tone: 'danger' }} accentOverride={TOKENS.red} />
            ) : null}

            {prompt.state.escalated ? (
              <Badge badge={{ label: 'Escalated', tone: 'warning' }} accentOverride={TOKENS.amber} />
            ) : null}

            {prompt.badges.map((badge) => (
              <Badge key={badge.id} badge={badge} />
            ))}
          </div>
        ) : null}
      </header>

      <section
        style={{
          position: 'relative',
          display: 'grid',
          gap: isCompact ? 10 : 12,
        }}
      >
        <div style={{ display: 'grid', gap: 8 }}>
          <h3
            id={titleId}
            style={{
              margin: 0,
              fontSize: isCompact ? 18 : isExpanded ? 22 : 20,
              fontWeight: 900,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              color: TOKENS.text,
            }}
          >
            {prompt.copy.title}
          </h3>

          <p
            id={bodyId}
            style={{
              margin: 0,
              fontSize: isCompact ? 13 : 14,
              lineHeight: 1.68,
              color: TOKENS.textSoft,
            }}
          >
            {prompt.copy.body}
          </p>
        </div>

        {notBlank(prompt.copy.tacticalSummary) ? (
          <div
            style={{
              padding: isCompact ? '12px 13px' : '13px 14px',
              borderRadius: TOKENS.radiusMd,
              border: `1px solid ${TOKENS.border}`,
              background: 'rgba(255,255,255,0.03)',
              display: 'grid',
              gap: 6,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: TOKENS.textMuted,
              }}
            >
              Tactical summary
            </span>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                lineHeight: 1.62,
                color: TOKENS.text,
              }}
            >
              {prompt.copy.tacticalSummary}
            </p>
          </div>
        ) : null}

        {(notBlank(prompt.copy.responseWindowLabel) ||
          notBlank(prompt.copy.cooldownLabel) ||
          notBlank(prompt.copy.sceneLabel) ||
          notBlank(prompt.copy.authorityLabel) ||
          channelNote) ? (
          <div
            style={{
              display: 'grid',
              gap: 8,
            }}
          >
            {notBlank(prompt.copy.sceneLabel) ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: TOKENS.textMuted,
                  }}
                >
                  Scene
                </span>
                <span style={{ fontSize: 12, color: TOKENS.textSoft }}>{prompt.copy.sceneLabel}</span>
              </div>
            ) : null}

            {notBlank(prompt.copy.authorityLabel) ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: TOKENS.textMuted,
                  }}
                >
                  Authority
                </span>
                <span style={{ fontSize: 12, color: TOKENS.textSoft }}>{prompt.copy.authorityLabel}</span>
              </div>
            ) : null}

            {(notBlank(prompt.copy.responseWindowLabel) || notBlank(prompt.copy.cooldownLabel)) ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                {notBlank(prompt.copy.responseWindowLabel) ? (
                  <Badge
                    badge={{
                      id: `${prompt.id}:response-window`,
                      label: prompt.copy.responseWindowLabel,
                      tone: 'neutral',
                    }}
                    accentOverride={accent}
                  />
                ) : null}
                {notBlank(prompt.copy.cooldownLabel) ? (
                  <Badge
                    badge={{
                      id: `${prompt.id}:cooldown`,
                      label: prompt.copy.cooldownLabel,
                      tone: 'neutral',
                    }}
                  />
                ) : null}
              </div>
            ) : null}

            {channelNote ? (
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  lineHeight: 1.55,
                  color: TOKENS.textMuted,
                }}
              >
                {channelNote}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      {prompt.metrics.length > 0 ? (
        <section
          style={{
            position: 'relative',
            display: 'grid',
            gap: 12,
            padding: isCompact ? '14px 14px 13px' : '16px',
            borderRadius: TOKENS.radiusLg,
            border: `1px solid ${TOKENS.border}`,
            background: `${SURFACE_GRADIENT}, ${TOKENS.panelElevated}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: TOKENS.textMuted,
              }}
            >
              Stabilization read
            </span>
            {typeof prompt.state.unreadCountHint === 'number' && prompt.state.unreadCountHint > 0 ? (
              <span
                style={{
                  fontSize: 11,
                  color: TOKENS.textMuted,
                  fontFamily: TOKENS.fontMono,
                }}
              >
                +{prompt.state.unreadCountHint} unread
              </span>
            ) : null}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isCompact ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            {prompt.metrics.map((metric) => (
              <MetricRow key={metric.id} metric={metric} />
            ))}
          </div>
        </section>
      ) : null}

      {prompt.evidence.length > 0 ? (
        <section
          style={{
            position: 'relative',
            display: 'grid',
            gap: 10,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: TOKENS.textMuted,
            }}
          >
            Evidence
          </span>

          <div style={{ display: 'grid', gap: 10 }}>
            {prompt.evidence.map((item) => (
              <EvidenceRow key={item.id} evidence={item} />
            ))}
          </div>
        </section>
      ) : null}

      {prompt.actions.length > 0 ? (
        <section
          style={{
            position: 'relative',
            display: 'grid',
            gap: 10,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: TOKENS.textMuted,
            }}
          >
            Available actions
          </span>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isCompact ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 10,
            }}
          >
            {prompt.actions.map((action) => (
              <ActionButton
                key={action.id}
                action={action}
                accent={accent}
                onPress={(actionId) => onAction?.(actionId, prompt)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {(notBlank(prompt.copy.footerNote) || notBlank(prompt.copy.provenanceNote)) ? (
        <footer
          style={{
            position: 'relative',
            display: 'grid',
            gap: 8,
            paddingTop: 2,
          }}
        >
          {notBlank(prompt.copy.footerNote) ? (
            <p
              style={{
                margin: 0,
                fontSize: 12,
                lineHeight: 1.55,
                color: TOKENS.textSoft,
              }}
            >
              {prompt.copy.footerNote}
            </p>
          ) : null}

          {notBlank(prompt.copy.provenanceNote) ? (
            <p
              style={{
                margin: 0,
                fontSize: 11,
                lineHeight: 1.55,
                color: TOKENS.textMuted,
                fontFamily: TOKENS.fontMono,
              }}
            >
              {prompt.copy.provenanceNote}
            </p>
          ) : null}
        </footer>
      ) : null}
    </aside>
  );
}

const ChatHelperPrompt = memo(ChatHelperPromptComponent);

export default ChatHelperPrompt;
