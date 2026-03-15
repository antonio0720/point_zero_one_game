/**
 * ============================================================================
 * POINT ZERO ONE — CHAT COMPOSER SURFACE BUILDER
 * FILE: pzo-web/src/components/chat/composerSurfaceBuilder.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Normalize runtime chat shell state into the public UI-facing ChatComposer
 * surface model consumed by ChatComposer.tsx.
 *
 * This file belongs in the component lane because it performs UI-shape
 * normalization, not engine truth, transport, moderation, or ML/DL authority.
 * ============================================================================
 */

import * as SharedChat from '../../../../shared/contracts/chat';
import type {
  ChatComposerCallbacks,
  ChatComposerSurfaceModel,
  ChatComposerViewModel,
  ComposerDiagnosticLine,
  ComposerHintLine,
  ComposerModePreset,
  ComposerNetworkState,
  ComposerQuickInsert,
  ComposerReplyPreview,
  ComposerSubmitState,
  ComposerThreatBand,
} from './uiTypes';

export type ComposerChannel = SharedChat.ChatChannelsModule.ChatVisibleChannel;

export type ComposerConnectionState =
  | 'CONNECTED'
  | 'CONNECTING'
  | 'DEGRADED'
  | 'DISCONNECTED';

export interface ComposerThreatState {
  level: number;
  label?: string;
}

export interface ComposerHelperPromptState {
  ctaLabel?: string;
  suggestedReply?: string;
}

export interface ComposerPresenceState {
  onlineCount: number;
  typingCount: number;
}

export interface ComposerMessageLike {
  id: string;
  channel: ComposerChannel;
  senderName?: string;
  senderId?: string;
  body?: string;
  locked?: boolean;
  proofHash?: string;
}

export interface ComposerChannelMeta {
  label: string;
  canCompose: boolean;
  placeholder: string;
}

export interface ComposerSurfaceBuilderInput {
  channel: ComposerChannel;
  draft: string;
  maxLength: number;
  connected: boolean;
  connectionState: ComposerConnectionState;
  channelMeta: Record<ComposerChannel, ComposerChannelMeta>;
  threat: ComposerThreatState;
  transcriptLocked: boolean;
  shellMode: string;
  helperPrompt: ComposerHelperPromptState | null;
  selectedMessageId: string | null;
  messages: ComposerMessageLike[];
  presence: ComposerPresenceState;
  totalUnread: number;
  callbacks: ChatComposerCallbacks;
}

function toThreatBand(level: number): ComposerThreatBand {
  if (level >= 90) return 'SEVERE';
  if (level >= 70) return 'HIGH';
  if (level >= 45) return 'ELEVATED';
  if (level >= 20) return 'LOW';
  return 'QUIET';
}

function toNetworkState(state: ComposerConnectionState): ComposerNetworkState {
  switch (state) {
    case 'CONNECTED':
      return 'ONLINE';
    case 'CONNECTING':
      return 'CONNECTING';
    case 'DEGRADED':
      return 'DEGRADED';
    case 'DISCONNECTED':
    default:
      return 'OFFLINE';
  }
}

function toSubmitState(
  connected: boolean,
  trimmedDraft: string,
  overLimit: boolean,
): ComposerSubmitState {
  if (!connected) return 'BLOCKED';
  if (trimmedDraft.length === 0) return 'IDLE';
  if (overLimit) return 'BLOCKED';
  return 'READY';
}

function buildQuickInserts(channel: ComposerChannel): ComposerQuickInsert[] {
  if (channel === 'DEAL_ROOM') {
    return [
      {
        id: 'deal:counter',
        label: 'Counter',
        value: 'Counterpoint: risk, timing, and valuation do not support that price.',
        accent: 'warning',
      },
      {
        id: 'deal:hold',
        label: 'Hold',
        value: 'Reviewing terms. Hold this line.',
        accent: 'info',
      },
      {
        id: 'deal:walk',
        label: 'Walk',
        value: 'No deal. Logging this outcome and exiting the room.',
        accent: 'danger',
        destructive: true,
      },
    ];
  }

  if (channel === 'SYNDICATE') {
    return [
      {
        id: 'syn:cover',
        label: 'Need Cover',
        value: 'Need cover. Pressure window is tightening.',
        accent: 'success',
        helper: true,
      },
      {
        id: 'syn:hold',
        label: 'Hold Line',
        value: 'Hold the line. No panic.',
        accent: 'info',
      },
      {
        id: 'syn:risk',
        label: 'Risk Rising',
        value: 'Risk is rising. Reroute before the next tick.',
        accent: 'warning',
      },
    ];
  }

  return [
    {
      id: 'global:watch',
      label: 'Watching',
      value: 'Watching this window closely.',
      accent: 'info',
    },
    {
      id: 'global:shield',
      label: 'Shield Up',
      value: 'Shield up before you push.',
      accent: 'success',
    },
    {
      id: 'global:receipt',
      label: 'Receipt',
      value: 'That line is going to age badly. Keeping the receipt.',
      accent: 'danger',
    },
  ];
}

function buildHintLines(
  channel: ComposerChannel,
  threatBand: ComposerThreatBand,
  networkState: ComposerNetworkState,
  transcriptImmutable: boolean,
  threatLabel?: string,
): ComposerHintLine[] {
  return [
    {
      id: 'threat',
      tone: threatBand === 'HIGH' || threatBand === 'SEVERE' ? 'warning' : 'info',
      text: threatLabel || `Threat band: ${threatBand}`,
      visible: true,
    },
    {
      id: 'network',
      tone:
        networkState === 'ONLINE'
          ? 'success'
          : networkState === 'DEGRADED'
            ? 'warning'
            : networkState === 'CONNECTING'
              ? 'info'
              : 'danger',
      text:
        networkState === 'ONLINE'
          ? 'Network stable.'
          : networkState === 'DEGRADED'
            ? 'Transport degraded — send path may retry.'
            : networkState === 'CONNECTING'
              ? 'Re-establishing transport.'
              : 'Offline draft mode active.',
      visible: true,
    },
    {
      id: 'proof',
      tone: transcriptImmutable ? 'warning' : 'neutral',
      text:
        channel === 'DEAL_ROOM'
          ? 'Transcript integrity enforced — every line can become a receipt.'
          : transcriptImmutable
            ? 'This transcript is in a protected state.'
            : 'Fast channel. Policy still applies.',
      visible: true,
    },
  ];
}

function buildDiagnostics(
  charCount: number,
  maxLength: number,
  channelLabel: string,
  onlineCount: number,
  typingCount: number,
  totalUnread: number,
): ComposerDiagnosticLine[] {
  const overLimit = charCount > maxLength;
  const nearLimit = charCount >= Math.floor(maxLength * 0.85);

  return [
    {
      id: 'diag:chars',
      label: 'Chars',
      value: `${charCount}/${maxLength}`,
      tone: overLimit ? 'danger' : nearLimit ? 'warning' : 'neutral',
      visible: true,
    },
    {
      id: 'diag:channel',
      label: 'Channel',
      value: channelLabel,
      tone: 'info',
      visible: true,
    },
    {
      id: 'diag:presence',
      label: 'Presence',
      value: `${onlineCount} online / ${typingCount} typing`,
      tone: 'neutral',
      visible: true,
    },
    {
      id: 'diag:unread',
      label: 'Unread',
      value: String(totalUnread),
      tone: totalUnread > 0 ? 'warning' : 'neutral',
      visible: true,
    },
  ];
}

function buildReplyPreview(
  selectedMessageId: string | null,
  messages: ComposerMessageLike[],
): ComposerReplyPreview | null {
  if (!selectedMessageId) return null;

  const message = messages.find((entry) => entry.id === selectedMessageId);
  if (!message) return null;

  return {
    id: message.id,
    senderName: message.senderName || message.senderId || 'Unknown',
    body: message.body || '',
    channel: message.channel,
    immutable: Boolean(message.locked || message.proofHash),
  };
}

function buildModePreset(channel: ComposerChannel, shellMode: string): ComposerModePreset {
  return {
    id: shellMode.toLowerCase(),
    label: shellMode,
    accent:
      channel === 'DEAL_ROOM'
        ? '#FACC15'
        : channel === 'SYNDICATE'
          ? '#34D399'
          : '#8A8EFF',
    description:
      channel === 'DEAL_ROOM'
        ? 'Recorded negotiation lane.'
        : channel === 'SYNDICATE'
          ? 'Alliance coordination lane.'
          : 'Public pressure lane.',
  };
}

export function buildChatComposerSurfaceModel(
  input: ComposerSurfaceBuilderInput,
): ChatComposerSurfaceModel {
  const {
    channel,
    draft,
    maxLength,
    connected,
    connectionState,
    channelMeta,
    threat,
    transcriptLocked,
    shellMode,
    helperPrompt,
    selectedMessageId,
    messages,
    presence,
    totalUnread,
    callbacks,
  } = input;

  const trimmed = draft.trim();
  const charCount = draft.length;
  const overLimit = charCount > maxLength;
  const threatBand = toThreatBand(threat.level);
  const networkState = toNetworkState(connectionState);
  const submitState = toSubmitState(connected, trimmed, overLimit);
  const transcriptImmutable = transcriptLocked || channel === 'DEAL_ROOM';

  const view: ChatComposerViewModel = {
    channel,
    draft,
    placeholder: channelMeta[channel].placeholder,
    disabled: !channelMeta[channel].canCompose,
    locked: transcriptImmutable && channel === 'DEAL_ROOM',
    connected,
    networkState,
    submitState,
    sendCooldownMs: 0,
    threatBand,
    helperAvailable: helperPrompt !== null,
    helperLabel: helperPrompt?.ctaLabel || 'Helper',
    transcriptImmutable,
    maxLength,
    minRows: 3,
    maxRows: 8,
    dangerCopy:
      threat.level >= 70
        ? 'High-pressure lane. Every line will be read aggressively.'
        : undefined,
    showDangerCopy: threat.level >= 70,
    modePreset: buildModePreset(channel, shellMode),
    quickInserts: buildQuickInserts(channel),
    hintLines: buildHintLines(
      channel,
      threatBand,
      networkState,
      transcriptImmutable,
      threat.label,
    ),
    diagnosticLines: buildDiagnostics(
      charCount,
      maxLength,
      channelMeta[channel].label,
      presence.onlineCount,
      presence.typingCount,
      totalUnread,
    ),
    replyPreview: buildReplyPreview(selectedMessageId, messages),
    autoFocus: false,
    allowShiftEnter: true,
    allowQuickInsertBar: true,
    allowHelperShortcut: true,
    showCharacterMeter: true,
    showProofNotice: true,
    showDiagnostics: true,
    showToolsByDefault: false,
    forceCompact: false,
  };

  return {
    view,
    callbacks,
  };
}
