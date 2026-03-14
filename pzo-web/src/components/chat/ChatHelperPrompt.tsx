import React, { memo, useId, useMemo } from 'react';
import type {
  ChatChannelId,
  ChatInterruptPriority,
  ChatMomentType,
  ChatScenePlan,
  ChatVisibleChannel,
} from './types';
import { CHAT_ENGINE_AUTHORITIES } from './types';

/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT ENGINE
 * FILE: pzo-web/src/engines/chat/ChatHelperPrompt.tsx
 * ============================================================================
 *
 * Purpose
 * -------
 * Thin, presentation-only helper intervention surface for the unified chat lane.
 *
 * This file is intentionally UI-only:
 * - no socket ownership
 * - no moderation ownership
 * - no transcript writes
 * - no event bridge decisions
 * - no ML/DL inference authority
 * - no direct store mutation
 *
 * It renders a helper prompt that can be mounted by UnifiedChatDock.tsx or any
 * future shell that reads authoritative state from ChatEngine.ts / selectors.
 *
 * Why this file exists in the engine lane right now
 * -----------------------------------------------
 * The long-term target is a thin render shell under /pzo-web/src/components/chat,
 * but the current repo already contains an active canonical lane in
 * /pzo-web/src/engines/chat, including UnifiedChatDock.tsx. This component is
 * written to match that current repo reality while still honoring the rule that
 * the render surface must not become the brain.
 *
 * Design laws
 * -----------
 * - Render truth; do not invent gameplay authority.
 * - Helper prompts must feel timely, not spammy.
 * - Rescue prompts must preserve tension without becoming manipulative noise.
 * - A helper prompt is allowed to stage urgency, but never to hide provenance.
 * - The component must be compilable before deeper engine/runtime files land.
 * - No business logic here that belongs in ChatHelperResponsePlanner.ts,
 *   ChatLearningBridge.ts, or backend intervention policy modules.
 *
 * Repo grounding
 * --------------
 * - Current legacy chat UI lives in pzo-web/src/components/chat/ChatPanel.tsx.
 * - Current canonical frontend chat lane already exists at pzo-web/src/engines/chat.
 * - Mount policy and channel doctrine are defined in ./types.
 * - Long-term authorities remain:
 *   /shared/contracts/chat
 *   /pzo-web/src/engines/chat
 *   /pzo-web/src/components/chat
 *   /backend/src/game/engine/chat
 *   /pzo-server/src/chat
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

// ============================================================================
// MARK: Local design tokens
// ============================================================================

const TOKENS = {
  void: '#030308',
  card: '#0C0C1E',
  cardHi: '#131328',
  cardEl: '#191934',
  border: 'rgba(255,255,255,0.08)',
  borderM: 'rgba(255,255,255,0.16)',
  borderH: 'rgba(255,255,255,0.24)',
  text: '#F2F2FF',
  textSub: '#9090B4',
  textMut: '#505074',
  green: '#22DD88',
  red: '#FF4D4D',
  orange: '#FF8C00',
  yellow: '#FFD700',
  indigo: '#818CF8',
  teal: '#22D3EE',
  purple: '#A855F7',
  cyan: '#7DD3FC',
  white: '#FFFFFF',
  mono: "'IBM Plex Mono', 'JetBrains Mono', monospace",
  display: "'Syne', 'Outfit', system-ui, sans-serif",
} as const;

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');`;

// ============================================================================
// MARK: Public local prop contracts
// ============================================================================

export type ChatHelperPromptTone =
  | 'CALM'
  | 'DIRECT'
  | 'URGENT'
  | 'SURGICAL'
  | 'REASSURING'
  | 'CEREMONIAL';

export type ChatHelperPromptIntent =
  | 'RESCUE'
  | 'COUNTERPLAY'
  | 'RECOVER_COMPOSURE'
  | 'NEGOTIATE'
  | 'ESCAPE_PRESSURE'
  | 'HOLD_POSITION'
  | 'REFOCUS'
  | 'POST_RUN_DEBRIEF';

export type ChatHelperPromptDensity = 'COMPACT' | 'STANDARD' | 'EXPANDED';

export interface ChatHelperActionDescriptor {
  readonly actionId: string;
  readonly label: string;
  readonly shortLabel?: string;
  readonly description?: string;
  readonly emphasis?: 'PRIMARY' | 'SECONDARY' | 'GHOST' | 'DANGER';
  readonly hotkeyHint?: string;
  readonly disabled?: boolean;
  readonly blockedReason?: string;
  readonly channelGuard?: ChatVisibleChannel[];
  readonly optimisticPreview?: string;
}

export interface ChatHelperEvidenceLine {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly polarity?: 'NEUTRAL' | 'POSITIVE' | 'NEGATIVE' | 'WARNING';
}

export interface ChatHelperPromptModel {
  readonly promptId: string;
  readonly helperId: string;
  readonly helperName: string;
  readonly helperRole?: string;
  readonly helperAvatarText?: string;
  readonly helperColor?: string;
  readonly helperAccent?: string;
  readonly visibleChannel: ChatVisibleChannel;
  readonly sourceChannel?: ChatChannelId;
  readonly scenePlan?: Pick<ChatScenePlan, 'sceneId' | 'momentId' | 'momentType'>;
  readonly momentType?: ChatMomentType;
  readonly interruptPriority?: ChatInterruptPriority;
  readonly tone: ChatHelperPromptTone;
  readonly intent: ChatHelperPromptIntent;
  readonly density?: ChatHelperPromptDensity;
  readonly title: string;
  readonly body: string;
  readonly tacticalSummary?: string;
  readonly confidenceLabel?: string;
  readonly confidenceScore?: number;
  readonly urgencyScore?: number;
  readonly trustScore?: number;
  readonly intimidationScore?: number;
  readonly reliefPotential?: number;
  readonly expectedStabilization?: number;
  readonly responseWindowLabel?: string;
  readonly responseWindowMs?: number;
  readonly cooldownLabel?: string;
  readonly queuePosition?: number;
  readonly isSticky?: boolean;
  readonly isDismissible?: boolean;
  readonly isEscalated?: boolean;
  readonly isRescueCritical?: boolean;
  readonly showTrustMeter?: boolean;
  readonly showEvidence?: boolean;
  readonly evidence?: readonly ChatHelperEvidenceLine[];
  readonly actions: readonly ChatHelperActionDescriptor[];
  readonly footerNote?: string;
  readonly provenanceNote?: string;
  readonly authorityNote?: string;
}

export interface ChatHelperPromptProps {
  readonly prompt: ChatHelperPromptModel | null | undefined;
  readonly activeChannel: ChatVisibleChannel;
  readonly mountChannel?: ChatVisibleChannel;
  readonly unreadCount?: number;
  readonly isCollapsed?: boolean;
  readonly compactMode?: boolean;
  readonly showChannelBadge?: boolean;
  readonly showAuthorityLine?: boolean;
  readonly showSceneLine?: boolean;
  readonly className?: string;
  readonly style?: React.CSSProperties;
  readonly onDismiss?: (promptId: string) => void;
  readonly onSelectAction?: (promptId: string, actionId: string) => void;
  readonly onOpenChannel?: (channel: ChatVisibleChannel) => void;
}

// ============================================================================
// MARK: Derived labels / visual policy
// ============================================================================

const TONE_LABEL: Record<ChatHelperPromptTone, string> = {
  CALM: 'Calm assist',
  DIRECT: 'Direct assist',
  URGENT: 'Urgent assist',
  SURGICAL: 'Surgical assist',
  REASSURING: 'Reassuring assist',
  CEREMONIAL: 'Ceremonial assist',
};

const INTENT_LABEL: Record<ChatHelperPromptIntent, string> = {
  RESCUE: 'Rescue line',
  COUNTERPLAY: 'Counterplay line',
  RECOVER_COMPOSURE: 'Composure recovery',
  NEGOTIATE: 'Negotiation support',
  ESCAPE_PRESSURE: 'Pressure escape',
  HOLD_POSITION: 'Hold position',
  REFOCUS: 'Refocus line',
  POST_RUN_DEBRIEF: 'Post-run read',
};

function clamp01(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  if ((value as number) <= 0) return 0;
  if ((value as number) >= 1) return 1;
  return value as number;
}

function percentageLabel(value: number | undefined): string {
  return `${Math.round(clamp01(value) * 100)}%`;
}

function meterTone(
  value: number | undefined,
): { bar: string; glow: string; text: string } {
  const v = clamp01(value);
  if (v >= 0.8) {
    return {
      bar: TOKENS.green,
      glow: 'rgba(34,221,136,0.28)',
      text: TOKENS.green,
    };
  }
  if (v >= 0.55) {
    return {
      bar: TOKENS.yellow,
      glow: 'rgba(255,215,0,0.22)',
      text: TOKENS.yellow,
    };
  }
  if (v >= 0.3) {
    return {
      bar: TOKENS.orange,
      glow: 'rgba(255,140,0,0.22)',
      text: TOKENS.orange,
    };
  }
  return {
    bar: TOKENS.red,
    glow: 'rgba(255,77,77,0.25)',
    text: TOKENS.red,
  };
}

function priorityTone(
  priority: ChatInterruptPriority | undefined,
): { badge: string; border: string; text: string } {
  switch (priority) {
    case 'ABSOLUTE':
      return {
        badge: 'rgba(255,77,77,0.16)',
        border: 'rgba(255,77,77,0.34)',
        text: TOKENS.red,
      };
    case 'CRITICAL':
      return {
        badge: 'rgba(255,140,0,0.16)',
        border: 'rgba(255,140,0,0.32)',
        text: TOKENS.orange,
      };
    case 'HIGH':
      return {
        badge: 'rgba(255,215,0,0.13)',
        border: 'rgba(255,215,0,0.28)',
        text: TOKENS.yellow,
      };
    case 'NORMAL':
      return {
        badge: 'rgba(129,140,248,0.12)',
        border: 'rgba(129,140,248,0.24)',
        text: TOKENS.indigo,
      };
    case 'LOW':
    default:
      return {
        badge: 'rgba(144,144,180,0.10)',
        border: 'rgba(144,144,180,0.18)',
        text: TOKENS.textSub,
      };
  }
}

function channelTone(channel: ChatVisibleChannel): {
  label: string;
  border: string;
  accent: string;
  bg: string;
} {
  switch (channel) {
    case 'DEAL_ROOM':
      return {
        label: 'Deal Room',
        border: 'rgba(255,140,0,0.30)',
        accent: TOKENS.orange,
        bg: 'rgba(255,140,0,0.08)',
      };
    case 'SYNDICATE':
      return {
        label: 'Syndicate',
        border: 'rgba(34,211,238,0.24)',
        accent: TOKENS.teal,
        bg: 'rgba(34,211,238,0.08)',
      };
    case 'LOBBY':
      return {
        label: 'Lobby',
        border: 'rgba(168,85,247,0.24)',
        accent: TOKENS.purple,
        bg: 'rgba(168,85,247,0.08)',
      };
    case 'GLOBAL':
    default:
      return {
        label: 'Global',
        border: 'rgba(129,140,248,0.26)',
        accent: TOKENS.indigo,
        bg: 'rgba(129,140,248,0.09)',
      };
  }
}

function intentAccent(intent: ChatHelperPromptIntent): string {
  switch (intent) {
    case 'RESCUE':
      return TOKENS.green;
    case 'COUNTERPLAY':
      return TOKENS.indigo;
    case 'NEGOTIATE':
      return TOKENS.orange;
    case 'ESCAPE_PRESSURE':
      return TOKENS.red;
    case 'HOLD_POSITION':
      return TOKENS.teal;
    case 'REFOCUS':
      return TOKENS.cyan;
    case 'POST_RUN_DEBRIEF':
      return TOKENS.purple;
    case 'RECOVER_COMPOSURE':
    default:
      return TOKENS.yellow;
  }
}

function makeAvatarText(name: string, fallback = 'HP'): string {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function formatWindowLabel(label: string | undefined, ms: number | undefined): string | null {
  if (label && label.trim()) return label.trim();
  if (!Number.isFinite(ms)) return null;
  const seconds = Math.max(0, Math.round((ms as number) / 1000));
  if (seconds < 60) return `${seconds}s response window`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m response window`;
}

function actionEmphasisStyle(
  emphasis: ChatHelperActionDescriptor['emphasis'],
): React.CSSProperties {
  switch (emphasis) {
    case 'PRIMARY':
      return {
        background: `linear-gradient(135deg, ${TOKENS.indigo}, ${TOKENS.purple})`,
        color: TOKENS.white,
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 10px 24px rgba(129,140,248,0.22)',
      };
    case 'DANGER':
      return {
        background: 'rgba(255,77,77,0.12)',
        color: TOKENS.red,
        border: '1px solid rgba(255,77,77,0.24)',
        boxShadow: '0 10px 22px rgba(255,77,77,0.10)',
      };
    case 'GHOST':
      return {
        background: 'transparent',
        color: TOKENS.textSub,
        border: `1px solid ${TOKENS.border}`,
      };
    case 'SECONDARY':
    default:
      return {
        background: 'rgba(255,255,255,0.04)',
        color: TOKENS.text,
        border: `1px solid ${TOKENS.borderM}`,
      };
  }
}

// ============================================================================
// MARK: Small render helpers
// ============================================================================

interface MeterRowProps {
  readonly label: string;
  readonly value: number | undefined;
  readonly valueLabel?: string;
}

const MeterRow = memo(function MeterRow({ label, value, valueLabel }: MeterRowProps) {
  const v = clamp01(value);
  const tone = meterTone(value);

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span
          style={{
            color: TOKENS.textSub,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontFamily: TOKENS.mono,
          }}
        >
          {label}
        </span>
        <span
          style={{
            color: tone.text,
            fontSize: 11,
            fontWeight: 700,
            fontFamily: TOKENS.mono,
          }}
        >
          {valueLabel ?? percentageLabel(v)}
        </span>
      </div>
      <div
        aria-hidden="true"
        style={{
          position: 'relative',
          height: 8,
          borderRadius: 999,
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.05)',
          border: `1px solid ${TOKENS.border}`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: `${Math.max(4, v * 100)}%`,
            borderRadius: 999,
            background: `linear-gradient(90deg, ${tone.bar}, ${tone.bar})`,
            boxShadow: `0 0 14px ${tone.glow}`,
            transition: 'width 180ms ease',
          }}
        />
      </div>
    </div>
  );
});

interface EvidenceRowProps {
  readonly item: ChatHelperEvidenceLine;
}

const EvidenceRow = memo(function EvidenceRow({ item }: EvidenceRowProps) {
  const polarityColor =
    item.polarity === 'POSITIVE'
      ? TOKENS.green
      : item.polarity === 'NEGATIVE'
        ? TOKENS.red
        : item.polarity === 'WARNING'
          ? TOKENS.orange
          : TOKENS.text;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 12,
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${TOKENS.border}`,
      }}
    >
      <span
        style={{
          color: TOKENS.textSub,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {item.label}
      </span>
      <span
        style={{
          color: polarityColor,
          fontSize: 12,
          fontWeight: 700,
          fontFamily: TOKENS.mono,
          whiteSpace: 'nowrap',
        }}
      >
        {item.value}
      </span>
    </div>
  );
});

// ============================================================================
// MARK: Component
// ============================================================================

function ChatHelperPromptComponent({
  prompt,
  activeChannel,
  mountChannel,
  unreadCount = 0,
  isCollapsed = false,
  compactMode = false,
  showChannelBadge = true,
  showAuthorityLine = true,
  showSceneLine = true,
  className,
  style,
  onDismiss,
  onSelectAction,
  onOpenChannel,
}: ChatHelperPromptProps): React.JSX.Element | null {
  const panelId = useId();

  const derived = useMemo(() => {
    if (!prompt) return null;

    const channelVisual = channelTone(prompt.visibleChannel);
    const priorityVisual = priorityTone(prompt.interruptPriority);
    const confidenceValue = prompt.confidenceScore;
    const urgencyValue = prompt.urgencyScore;
    const trustValue = prompt.trustScore;
    const avatarText = prompt.helperAvatarText || makeAvatarText(prompt.helperName);
    const intentColor = prompt.helperAccent || prompt.helperColor || intentAccent(prompt.intent);
    const responseWindow = formatWindowLabel(prompt.responseWindowLabel, prompt.responseWindowMs);
    const density = prompt.density ?? (compactMode ? 'COMPACT' : 'STANDARD');
    const visibleActions = prompt.actions.filter((action) => {
      if (!action.channelGuard || action.channelGuard.length === 0) return true;
      return action.channelGuard.includes(prompt.visibleChannel);
    });

    return {
      channelVisual,
      priorityVisual,
      confidenceValue,
      urgencyValue,
      trustValue,
      avatarText,
      intentColor,
      responseWindow,
      density,
      visibleActions,
    };
  }, [prompt, compactMode]);

  if (!prompt || !derived) return null;
  if (isCollapsed) return null;

  const channelMismatch = activeChannel !== prompt.visibleChannel;
  const mountMismatch = mountChannel && mountChannel !== prompt.visibleChannel;
  const densityIsCompact = derived.density === 'COMPACT';
  const densityIsExpanded = derived.density === 'EXPANDED';
  const canDismiss = prompt.isDismissible !== false;

  return (
    <section
      aria-labelledby={`${panelId}-title`}
      aria-describedby={`${panelId}-body`}
      className={className}
      style={{
        position: 'relative',
        display: 'grid',
        gap: densityIsCompact ? 12 : 14,
        padding: densityIsCompact ? 12 : 14,
        borderRadius: 18,
        background: `linear-gradient(180deg, ${TOKENS.cardHi}, ${TOKENS.card})`,
        border: `1px solid ${prompt.isRescueCritical ? 'rgba(255,77,77,0.25)' : TOKENS.borderM}`,
        boxShadow: prompt.isRescueCritical
          ? '0 18px 38px rgba(255,77,77,0.12), 0 0 0 1px rgba(255,77,77,0.08) inset'
          : '0 18px 38px rgba(0,0,0,0.34), 0 0 0 1px rgba(255,255,255,0.03) inset',
        overflow: 'hidden',
        ...style,
      }}
      data-authority-root={CHAT_ENGINE_AUTHORITIES.frontendEngineRoot}
      data-visible-channel={prompt.visibleChannel}
      data-helper-prompt-id={prompt.promptId}
    >
      <style>{FONT_IMPORT}</style>
      <style>{`
        @keyframes pzo-helper-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(129,140,248,0.00); }
          50% { box-shadow: 0 0 0 8px rgba(129,140,248,0.08); }
        }

        @keyframes pzo-helper-scan {
          0% { transform: translateX(-120%); opacity: 0; }
          30% { opacity: 0.8; }
          100% { transform: translateX(120%); opacity: 0; }
        }
      `}</style>

      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          insetInline: 0,
          top: 0,
          height: 3,
          background: `linear-gradient(90deg, ${derived.intentColor}, ${derived.channelVisual.accent}, ${TOKENS.white})`,
          opacity: 0.92,
        }}
      />

      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: -10,
          left: -40,
          width: 140,
          height: 140,
          borderRadius: '50%',
          background: `${derived.intentColor}10`,
          filter: 'blur(20px)',
          pointerEvents: 'none',
        }}
      />

      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          insetInline: 0,
          top: 0,
          bottom: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 56,
            background:
              'linear-gradient(90deg, rgba(255,255,255,0.00), rgba(255,255,255,0.05), rgba(255,255,255,0.00))',
            transform: 'translateX(-120%)',
            animation: prompt.isEscalated ? 'pzo-helper-scan 2.8s linear infinite' : 'none',
          }}
        />
      </div>

      <header
        style={{
          display: 'grid',
          gap: 12,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto minmax(0, 1fr) auto',
            gap: 12,
            alignItems: 'start',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: densityIsCompact ? 38 : 44,
              height: densityIsCompact ? 38 : 44,
              borderRadius: 14,
              display: 'grid',
              placeItems: 'center',
              fontFamily: TOKENS.display,
              fontWeight: 800,
              fontSize: densityIsCompact ? 12 : 13,
              color: TOKENS.white,
              background: `linear-gradient(135deg, ${derived.intentColor}, ${derived.channelVisual.accent})`,
              boxShadow: '0 12px 26px rgba(0,0,0,0.28)',
              animation: prompt.isEscalated ? 'pzo-helper-glow 1.8s ease-in-out infinite' : 'none',
            }}
          >
            {derived.avatarText}
          </div>

          <div style={{ display: 'grid', gap: 7, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span
                style={{
                  color: TOKENS.text,
                  fontFamily: TOKENS.display,
                  fontSize: densityIsCompact ? 15 : 16,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  minWidth: 0,
                }}
              >
                {prompt.helperName}
              </span>

              {prompt.helperRole ? (
                <span
                  style={{
                    color: TOKENS.textSub,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    fontFamily: TOKENS.mono,
                  }}
                >
                  {prompt.helperRole}
                </span>
              ) : null}

              <span
                style={{
                  color: derived.priorityVisual.text,
                  background: derived.priorityVisual.badge,
                  border: `1px solid ${derived.priorityVisual.border}`,
                  borderRadius: 999,
                  padding: '4px 8px',
                  fontSize: 10,
                  fontWeight: 800,
                  fontFamily: TOKENS.mono,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {prompt.interruptPriority ?? 'NORMAL'}
              </span>

              <span
                style={{
                  color: derived.intentColor,
                  background: `${derived.intentColor}14`,
                  border: `1px solid ${derived.intentColor}2A`,
                  borderRadius: 999,
                  padding: '4px 8px',
                  fontSize: 10,
                  fontWeight: 800,
                  fontFamily: TOKENS.mono,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {INTENT_LABEL[prompt.intent]}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span
                style={{
                  color: TOKENS.textSub,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontFamily: TOKENS.mono,
                }}
              >
                {TONE_LABEL[prompt.tone]}
              </span>

              {showChannelBadge ? (
                <button
                  type="button"
                  onClick={() => onOpenChannel?.(prompt.visibleChannel)}
                  style={{
                    appearance: 'none',
                    border: `1px solid ${derived.channelVisual.border}`,
                    background: derived.channelVisual.bg,
                    color: derived.channelVisual.accent,
                    borderRadius: 999,
                    padding: '4px 8px',
                    cursor: onOpenChannel ? 'pointer' : 'default',
                    fontSize: 10,
                    fontWeight: 800,
                    fontFamily: TOKENS.mono,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  {derived.channelVisual.label}
                </button>
              ) : null}

              {derived.responseWindow ? (
                <span
                  style={{
                    color: TOKENS.orange,
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: TOKENS.mono,
                  }}
                >
                  {derived.responseWindow}
                </span>
              ) : null}
            </div>
          </div>

          {canDismiss ? (
            <button
              type="button"
              aria-label="Dismiss helper prompt"
              onClick={() => onDismiss?.(prompt.promptId)}
              style={{
                appearance: 'none',
                width: 30,
                height: 30,
                borderRadius: 10,
                border: `1px solid ${TOKENS.border}`,
                background: 'rgba(255,255,255,0.03)',
                color: TOKENS.textSub,
                cursor: 'pointer',
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          ) : null}
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          <h3
            id={`${panelId}-title`}
            style={{
              margin: 0,
              color: TOKENS.text,
              fontFamily: TOKENS.display,
              fontSize: densityIsCompact ? 17 : densityIsExpanded ? 21 : 19,
              lineHeight: 1.1,
              fontWeight: 800,
              letterSpacing: '-0.025em',
            }}
          >
            {prompt.title}
          </h3>
          <p
            id={`${panelId}-body`}
            style={{
              margin: 0,
              color: TOKENS.textSub,
              fontSize: densityIsCompact ? 12.5 : 13.5,
              lineHeight: 1.55,
              fontWeight: 500,
            }}
          >
            {prompt.body}
          </p>
          {prompt.tacticalSummary ? (
            <div
              style={{
                display: 'grid',
                gap: 4,
                padding: '11px 12px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${TOKENS.border}`,
              }}
            >
              <span
                style={{
                  color: TOKENS.textMut,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontFamily: TOKENS.mono,
                }}
              >
                Tactical summary
              </span>
              <span
                style={{
                  color: TOKENS.text,
                  fontSize: 12.5,
                  lineHeight: 1.45,
                  fontWeight: 600,
                }}
              >
                {prompt.tacticalSummary}
              </span>
            </div>
          ) : null}
        </div>
      </header>

      <div style={{ display: 'grid', gap: 12, position: 'relative', zIndex: 1 }}>
        <MeterRow
          label={prompt.confidenceLabel ?? 'Confidence'}
          value={derived.confidenceValue}
          valueLabel={percentageLabel(derived.confidenceValue)}
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: densityIsCompact ? '1fr' : 'repeat(2, minmax(0, 1fr))',
            gap: 12,
          }}
        >
          <MeterRow label="Urgency" value={derived.urgencyValue} />
          {prompt.showTrustMeter !== false ? (
            <MeterRow label="Trust window" value={derived.trustValue} />
          ) : null}
        </div>

        {(Number.isFinite(prompt.reliefPotential) || Number.isFinite(prompt.expectedStabilization)) && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 10,
            }}
          >
            {Number.isFinite(prompt.reliefPotential) ? (
              <div
                style={{
                  display: 'grid',
                  gap: 4,
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: 'rgba(34,221,136,0.06)',
                  border: '1px solid rgba(34,221,136,0.14)',
                }}
              >
                <span
                  style={{
                    color: TOKENS.textMut,
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    fontFamily: TOKENS.mono,
                  }}
                >
                  Relief potential
                </span>
                <span
                  style={{
                    color: TOKENS.green,
                    fontSize: 15,
                    fontWeight: 800,
                    fontFamily: TOKENS.display,
                  }}
                >
                  {percentageLabel(prompt.reliefPotential)}
                </span>
              </div>
            ) : null}

            {Number.isFinite(prompt.expectedStabilization) ? (
              <div
                style={{
                  display: 'grid',
                  gap: 4,
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: 'rgba(129,140,248,0.06)',
                  border: '1px solid rgba(129,140,248,0.14)',
                }}
              >
                <span
                  style={{
                    color: TOKENS.textMut,
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    fontFamily: TOKENS.mono,
                  }}
                >
                  Stabilization
                </span>
                <span
                  style={{
                    color: TOKENS.indigo,
                    fontSize: 15,
                    fontWeight: 800,
                    fontFamily: TOKENS.display,
                  }}
                >
                  {percentageLabel(prompt.expectedStabilization)}
                </span>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {prompt.showEvidence !== false && prompt.evidence && prompt.evidence.length > 0 ? (
        <div style={{ display: 'grid', gap: 8, position: 'relative', zIndex: 1 }}>
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
                color: TOKENS.textMut,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontFamily: TOKENS.mono,
              }}
            >
              Why this prompt fired
            </span>
            {typeof prompt.queuePosition === 'number' ? (
              <span
                style={{
                  color: TOKENS.textSub,
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: TOKENS.mono,
                }}
              >
                Queue #{prompt.queuePosition}
              </span>
            ) : null}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {prompt.evidence.map((item) => (
              <EvidenceRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 10, position: 'relative', zIndex: 1 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              color: TOKENS.textMut,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontFamily: TOKENS.mono,
            }}
          >
            Recommended actions
          </span>
          {prompt.cooldownLabel ? (
            <span
              style={{
                color: TOKENS.textSub,
                fontSize: 10,
                fontWeight: 700,
                fontFamily: TOKENS.mono,
              }}
            >
              {prompt.cooldownLabel}
            </span>
          ) : null}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: densityIsCompact ? '1fr' : 'repeat(auto-fit, minmax(144px, 1fr))',
            gap: 10,
          }}
        >
          {derived.visibleActions.map((action) => {
            const disabled = Boolean(action.disabled);
            const mismatch = channelMismatch || Boolean(mountMismatch);
            const clickDisabled = disabled || mismatch;

            return (
              <button
                key={action.actionId}
                type="button"
                disabled={clickDisabled}
                onClick={() => {
                  if (clickDisabled) return;
                  onSelectAction?.(prompt.promptId, action.actionId);
                }}
                title={action.blockedReason || action.description || action.label}
                style={{
                  appearance: 'none',
                  width: '100%',
                  minHeight: densityIsCompact ? 50 : 58,
                  borderRadius: 14,
                  padding: densityIsCompact ? '10px 12px' : '12px 13px',
                  cursor: clickDisabled ? 'not-allowed' : 'pointer',
                  opacity: clickDisabled ? 0.48 : 1,
                  display: 'grid',
                  gap: 5,
                  textAlign: 'left',
                  transition: 'transform 120ms ease, box-shadow 160ms ease',
                  ...actionEmphasisStyle(action.emphasis),
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
                  <span
                    style={{
                      fontSize: densityIsCompact ? 12.5 : 13,
                      fontWeight: 800,
                      fontFamily: TOKENS.display,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {action.shortLabel || action.label}
                  </span>
                  {action.hotkeyHint ? (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        fontFamily: TOKENS.mono,
                        opacity: 0.88,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {action.hotkeyHint}
                    </span>
                  ) : null}
                </div>
                {action.description ? (
                  <span
                    style={{
                      fontSize: 11.5,
                      lineHeight: 1.35,
                      opacity: 0.92,
                    }}
                  >
                    {action.description}
                  </span>
                ) : null}
                {action.optimisticPreview ? (
                  <span
                    style={{
                      fontSize: 10,
                      lineHeight: 1.35,
                      fontFamily: TOKENS.mono,
                      opacity: 0.82,
                    }}
                  >
                    {action.optimisticPreview}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <footer
        style={{
          display: 'grid',
          gap: 6,
          position: 'relative',
          zIndex: 1,
          paddingTop: 4,
        }}
      >
        {channelMismatch ? (
          <div
            style={{
              padding: '9px 11px',
              borderRadius: 12,
              background: 'rgba(255,140,0,0.08)',
              border: '1px solid rgba(255,140,0,0.18)',
              color: TOKENS.orange,
              fontSize: 11.5,
              lineHeight: 1.45,
              fontWeight: 700,
            }}
          >
            Helper prompt is staged for {derived.channelVisual.label}. Open that lane to act without cross-channel drift.
          </div>
        ) : null}

        {showSceneLine && prompt.scenePlan ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 8,
              color: TOKENS.textMut,
              fontSize: 10,
              fontWeight: 700,
              fontFamily: TOKENS.mono,
              letterSpacing: '0.04em',
            }}
          >
            <span>Scene {prompt.scenePlan.sceneId}</span>
            <span>•</span>
            <span>{prompt.scenePlan.momentType ?? prompt.momentType ?? 'HELPER_RESCUE'}</span>
            <span>•</span>
            <span>{prompt.scenePlan.momentId}</span>
          </div>
        ) : null}

        {prompt.footerNote ? (
          <div
            style={{
              color: TOKENS.textSub,
              fontSize: 11.5,
              lineHeight: 1.45,
              fontWeight: 600,
            }}
          >
            {prompt.footerNote}
          </div>
        ) : null}

        {(showAuthorityLine || prompt.provenanceNote || prompt.authorityNote) && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 8,
              color: TOKENS.textMut,
              fontSize: 10,
              fontWeight: 700,
              fontFamily: TOKENS.mono,
              letterSpacing: '0.04em',
            }}
          >
            {showAuthorityLine ? <span>Render shell only</span> : null}
            {showAuthorityLine ? <span>•</span> : null}
            {showAuthorityLine ? <span>{CHAT_ENGINE_AUTHORITIES.frontendEngineRoot}</span> : null}
            {prompt.authorityNote ? <span>•</span> : null}
            {prompt.authorityNote ? <span>{prompt.authorityNote}</span> : null}
            {prompt.provenanceNote ? <span>•</span> : null}
            {prompt.provenanceNote ? <span>{prompt.provenanceNote}</span> : null}
            {unreadCount > 0 ? <span>•</span> : null}
            {unreadCount > 0 ? <span>{unreadCount} unread in room</span> : null}
          </div>
        )}
      </footer>
    </section>
  );
}

export const ChatHelperPrompt = memo(ChatHelperPromptComponent);
export default ChatHelperPrompt;
