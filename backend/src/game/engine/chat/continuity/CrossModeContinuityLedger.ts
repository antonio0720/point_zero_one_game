/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT CONTINUITY LEDGER
 * FILE: backend/src/game/engine/chat/continuity/CrossModeContinuityLedger.ts
 * VERSION: 2026.03.19-continuity-upgrade
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Durable backend continuity authority for cross-mode chat carryover.
 *
 * This file exists because frontend continuity can only make the experience
 * feel coherent if backend truth preserves the durable reasons why that
 * coherence should exist. The frontend already owns render restoration,
 * mount-local panel behavior, and visible-shell recovery. This backend ledger
 * owns the durable record of:
 *
 * - which room tensions are still unresolved,
 * - which actors are still attached to the player or room,
 * - which reveals remain pending,
 * - which visible/shadow messages remain continuity-relevant,
 * - which relationship vectors are still hot enough to follow across screens,
 * - which mount transitions actually happened,
 * - and which continuity payload should be considered authoritative when the
 *   next mount asks “what should still feel alive?”
 *
 * Backend ownership law
 * ---------------------
 * - No UI rendering.
 * - No direct socket fanout.
 * - No donor-zone imports from pzo-web.
 * - No mutation of frontend continuity state.
 * - No assumption that a room == a mount surface.
 * - No assumption that every room transition deserves carryover.
 *
 * Design notes
 * ------------
 * The existing backend chat state is room/session/presence/transcript-centric,
 * not mount-centric. That is correct and should remain correct. This ledger is
 * therefore intentionally additive rather than invasive: it projects durable
 * continuity snapshots from authoritative chat state and stores them in a
 * separate backend authority lane.
 */

import type {
  ChatAudienceHeat,
  ChatChannelId,
  ChatMessage,
  ChatMessageAttribution,
  ChatPendingReveal,
  ChatPresenceSnapshot,
  ChatRelationshipState,
  ChatRoomId,
  ChatRoomStageMood,
  ChatRoomState,
  ChatSessionId,
  ChatState,
  ChatTranscriptEntry,
  ChatTypingSnapshot,
  ChatUserId,
  ChatVisibleChannel,
  JsonValue,
  UnixMs,
} from '../types';
import {
  selectAudienceHeat,
  selectRoom,
  selectRoomPresence,
  selectRoomRelationships,
  selectRoomTranscript,
  selectRoomTyping,
  selectVisibleMessages,
} from '../ChatState';

// ============================================================================
// MARK: Mount contracts
// ============================================================================

export const BACKEND_CHAT_CONTINUITY_MOUNT_TARGETS = [
  'BATTLE_HUD',
  'CLUB_UI',
  'EMPIRE_GAME_SCREEN',
  'GAME_BOARD',
  'LEAGUE_UI',
  'LOBBY_SCREEN',
  'PHANTOM_GAME_SCREEN',
  'PREDATOR_GAME_SCREEN',
  'SYNDICATE_GAME_SCREEN',
  'POST_RUN_SUMMARY',
] as const;

export type BackendChatMountTarget = (typeof BACKEND_CHAT_CONTINUITY_MOUNT_TARGETS)[number];
export type BackendChatContinuityTemperature = 'COOL' | 'STEADY' | 'TENSE' | 'PRESSURED' | 'HOSTILE';
export type BackendChatContinuityBand = 'DORMANT' | 'LOW' | 'WARM' | 'HOT' | 'VOLATILE' | 'CRITICAL';
export type BackendChatEscortStyle = 'VISIBLE_ESCORT' | 'SHADOW_ESCORT' | 'SILENT_WATCH' | 'PREDATOR_STALK' | 'NONE';
export type BackendChatTransitionReason =
  | 'MOUNT_CHANGED'
  | 'ROOM_STAGE_CHANGED'
  | 'ROOM_ACTIVITY_SPIKE'
  | 'PLAYER_COLLAPSE'
  | 'PLAYER_COMEBACK'
  | 'ROOM_ESCALATION'
  | 'POST_RUN'
  | 'TRANSPORT_SYNC'
  | 'RECOVERY_MODE'
  | 'UNKNOWN';

export interface BackendChatMountPreset {
  readonly mountTarget: BackendChatMountTarget;
  readonly defaultVisibleChannel: ChatVisibleChannel;
  readonly allowedVisibleChannels: readonly ChatVisibleChannel[];
  readonly defaultCollapsed: boolean;
  readonly allowCollapse: boolean;
  readonly density: 'COMPACT' | 'STANDARD' | 'EXPANDED';
  readonly stageMoodBias: ChatRoomStageMood | 'CEREMONIAL';
  readonly preferredEscortStyle: BackendChatEscortStyle;
  readonly heatSensitivity01: number;
  readonly transcriptPreviewCap: number;
}

export const BACKEND_CHAT_CONTINUITY_MOUNT_PRESETS: Readonly<Record<BackendChatMountTarget, BackendChatMountPreset>> =
  Object.freeze({
    BATTLE_HUD: {
      mountTarget: 'BATTLE_HUD',
      defaultVisibleChannel: 'GLOBAL',
      allowedVisibleChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'],
      defaultCollapsed: false,
      allowCollapse: true,
      density: 'STANDARD',
      stageMoodBias: 'HOSTILE',
      preferredEscortStyle: 'VISIBLE_ESCORT',
      heatSensitivity01: 0.95,
      transcriptPreviewCap: 6,
    },
    CLUB_UI: {
      mountTarget: 'CLUB_UI',
      defaultVisibleChannel: 'GLOBAL',
      allowedVisibleChannels: ['GLOBAL', 'SYNDICATE'],
      defaultCollapsed: true,
      allowCollapse: true,
      density: 'COMPACT',
      stageMoodBias: 'CALM',
      preferredEscortStyle: 'SILENT_WATCH',
      heatSensitivity01: 0.35,
      transcriptPreviewCap: 4,
    },
    EMPIRE_GAME_SCREEN: {
      mountTarget: 'EMPIRE_GAME_SCREEN',
      defaultVisibleChannel: 'SYNDICATE',
      allowedVisibleChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'],
      defaultCollapsed: false,
      allowCollapse: true,
      density: 'STANDARD',
      stageMoodBias: 'TENSE',
      preferredEscortStyle: 'VISIBLE_ESCORT',
      heatSensitivity01: 0.74,
      transcriptPreviewCap: 6,
    },
    GAME_BOARD: {
      mountTarget: 'GAME_BOARD',
      defaultVisibleChannel: 'GLOBAL',
      allowedVisibleChannels: ['GLOBAL', 'SYNDICATE'],
      defaultCollapsed: false,
      allowCollapse: true,
      density: 'STANDARD',
      stageMoodBias: 'TENSE',
      preferredEscortStyle: 'VISIBLE_ESCORT',
      heatSensitivity01: 0.65,
      transcriptPreviewCap: 5,
    },
    LEAGUE_UI: {
      mountTarget: 'LEAGUE_UI',
      defaultVisibleChannel: 'GLOBAL',
      allowedVisibleChannels: ['GLOBAL', 'SYNDICATE'],
      defaultCollapsed: true,
      allowCollapse: true,
      density: 'COMPACT',
      stageMoodBias: 'CEREMONIAL',
      preferredEscortStyle: 'SILENT_WATCH',
      heatSensitivity01: 0.32,
      transcriptPreviewCap: 4,
    },
    LOBBY_SCREEN: {
      mountTarget: 'LOBBY_SCREEN',
      defaultVisibleChannel: 'LOBBY',
      allowedVisibleChannels: ['LOBBY', 'GLOBAL'],
      defaultCollapsed: false,
      allowCollapse: true,
      density: 'STANDARD',
      stageMoodBias: 'CALM',
      preferredEscortStyle: 'SILENT_WATCH',
      heatSensitivity01: 0.25,
      transcriptPreviewCap: 5,
    },
    PHANTOM_GAME_SCREEN: {
      mountTarget: 'PHANTOM_GAME_SCREEN',
      defaultVisibleChannel: 'GLOBAL',
      allowedVisibleChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'],
      defaultCollapsed: false,
      allowCollapse: true,
      density: 'STANDARD',
      stageMoodBias: 'HOSTILE',
      preferredEscortStyle: 'SHADOW_ESCORT',
      heatSensitivity01: 0.82,
      transcriptPreviewCap: 5,
    },
    PREDATOR_GAME_SCREEN: {
      mountTarget: 'PREDATOR_GAME_SCREEN',
      defaultVisibleChannel: 'DEAL_ROOM',
      allowedVisibleChannels: ['GLOBAL', 'DEAL_ROOM'],
      defaultCollapsed: false,
      allowCollapse: true,
      density: 'STANDARD',
      stageMoodBias: 'PREDATORY',
      preferredEscortStyle: 'PREDATOR_STALK',
      heatSensitivity01: 0.9,
      transcriptPreviewCap: 6,
    },
    SYNDICATE_GAME_SCREEN: {
      mountTarget: 'SYNDICATE_GAME_SCREEN',
      defaultVisibleChannel: 'SYNDICATE',
      allowedVisibleChannels: ['SYNDICATE', 'GLOBAL', 'DEAL_ROOM'],
      defaultCollapsed: false,
      allowCollapse: true,
      density: 'EXPANDED',
      stageMoodBias: 'CEREMONIAL',
      preferredEscortStyle: 'VISIBLE_ESCORT',
      heatSensitivity01: 0.68,
      transcriptPreviewCap: 7,
    },
    POST_RUN_SUMMARY: {
      mountTarget: 'POST_RUN_SUMMARY',
      defaultVisibleChannel: 'GLOBAL',
      allowedVisibleChannels: ['GLOBAL', 'SYNDICATE'],
      defaultCollapsed: false,
      allowCollapse: false,
      density: 'EXPANDED',
      stageMoodBias: 'MOURNFUL',
      preferredEscortStyle: 'VISIBLE_ESCORT',
      heatSensitivity01: 0.52,
      transcriptPreviewCap: 10,
    },
  });

// ============================================================================
// MARK: Continuity contracts
// ============================================================================

export interface BackendChatContinuityRelationshipDigest {
  readonly relationshipId: string;
  readonly actorId: string;
  readonly trust01: number;
  readonly fear01: number;
  readonly contempt01: number;
  readonly fascination01: number;
  readonly rivalry01: number;
  readonly rescueDebt01: number;
  readonly intimacy01: number;
  readonly threat01: number;
  readonly helperBias01: number;
  readonly intensity01: number;
  readonly stance: 'ALLY' | 'RIVAL' | 'OBSESSION' | 'WOUNDED' | 'NEUTRAL';
}

export interface BackendChatContinuityActorCue {
  readonly actorId: string;
  readonly displayName: string;
  readonly personaId?: string;
  readonly botId?: string;
  readonly npcRole?: string;
  readonly sourceChannelId: ChatChannelId;
  readonly lastMessageId?: string;
  readonly lastMessageAt: UnixMs;
  readonly lastSeenAt: UnixMs;
  readonly escortScore01: number;
  readonly threat01: number;
  readonly helper01: number;
  readonly intimacy01: number;
  readonly unresolvedMomentum01: number;
  readonly visibleFollow: boolean;
  readonly shadowFollow: boolean;
  readonly preferredEscortStyle: BackendChatEscortStyle;
  readonly relationship?: BackendChatContinuityRelationshipDigest;
  readonly tags: readonly string[];
}

export interface BackendChatContinuityRevealCue {
  readonly revealId: string;
  readonly roomId: ChatRoomId;
  readonly revealAt: UnixMs;
  readonly messageId: string;
  readonly channelId: ChatChannelId;
  readonly summaryLine: string;
  readonly tags: readonly string[];
}

export interface BackendChatContinuityTranscriptCue {
  readonly messageId: string;
  readonly channelId: ChatChannelId;
  readonly plainText: string;
  readonly createdAt: UnixMs;
  readonly actorId: string;
  readonly displayName: string;
  readonly sourceType: string;
  readonly relevance01: number;
  readonly visible: boolean;
  readonly tags: readonly string[];
}

export interface BackendChatContinuityMomentCue {
  readonly momentId: string;
  readonly reason: string;
  readonly channelId: ChatVisibleChannel;
  readonly intensity01: number;
  readonly createdAt: UnixMs;
  readonly carryOverAllowed: boolean;
}

export interface BackendChatContinuityOverlayState {
  readonly preferredChannel: ChatVisibleChannel;
  readonly restoreCollapsed: boolean;
  readonly restorePanelOpen: boolean;
  readonly transcriptWindowTarget: number;
  readonly reason: string;
}

export interface BackendChatRoomContinuitySnapshot {
  readonly continuityId: string;
  readonly capturedAt: UnixMs;
  readonly roomId: ChatRoomId;
  readonly userId: ChatUserId;
  readonly sourceMount: BackendChatMountTarget;
  readonly roomStageMood: ChatRoomStageMood;
  readonly preferredVisibleChannel: ChatVisibleChannel;
  readonly allowedVisibleChannels: readonly ChatVisibleChannel[];
  readonly tensionBand: BackendChatContinuityBand;
  readonly temperature: BackendChatContinuityTemperature;
  readonly pressure01: number;
  readonly urgency01: number;
  readonly heat01: number;
  readonly occupancy: number;
  readonly typingCount: number;
  readonly hasPendingReveals: boolean;
  readonly activeSceneId?: string;
  readonly activeMomentId?: string;
  readonly activeLegendId?: string;
  readonly summaryLine: string;
  readonly shadowSummaryLine: string;
  readonly transcriptPreview: readonly BackendChatContinuityTranscriptCue[];
  readonly carriedActors: readonly BackendChatContinuityActorCue[];
  readonly pendingRevealCues: readonly BackendChatContinuityRevealCue[];
  readonly unresolvedMoments: readonly BackendChatContinuityMomentCue[];
  readonly carriedPersonaIds: readonly string[];
  readonly overlay: BackendChatContinuityOverlayState;
  readonly tags: readonly string[];
}

export interface BackendChatPlayerContinuityState {
  readonly userId: ChatUserId;
  readonly createdAt: UnixMs;
  readonly updatedAt: UnixMs;
  readonly lastMountTarget?: BackendChatMountTarget;
  readonly leadRoomId?: ChatRoomId;
  readonly activeEscortActorId?: string;
  readonly roomSnapshots: Readonly<Record<ChatRoomId, BackendChatRoomContinuitySnapshot>>;
  readonly carriedPersonaIds: readonly string[];
  readonly activeActorIds: readonly string[];
  readonly unresolvedMomentIds: readonly string[];
  readonly carryoverSummary?: Record<string, JsonValue>;
}

export interface BackendChatMountTransitionRecord {
  readonly transitionId: string;
  readonly userId: ChatUserId;
  readonly roomId: ChatRoomId;
  readonly fromMount: BackendChatMountTarget;
  readonly toMount: BackendChatMountTarget;
  readonly reason: BackendChatTransitionReason;
  readonly createdAt: UnixMs;
  readonly preferredVisibleChannel: ChatVisibleChannel;
  readonly summaryLine: string;
  readonly carriedPersonaIds: readonly string[];
  readonly escortActorId?: string;
  readonly unresolvedMomentIds: readonly string[];
  readonly continuityId: string;
}

export interface BackendChatContinuityLedgerSnapshot {
  readonly createdAt: UnixMs;
  readonly updatedAt: UnixMs;
  readonly players: Readonly<Record<ChatUserId, BackendChatPlayerContinuityState>>;
  readonly transitionsByUser: Readonly<Record<ChatUserId, readonly BackendChatMountTransitionRecord[]>>;
}

export interface CaptureRoomContinuityArgs {
  readonly state: Readonly<ChatState>;
  readonly roomId: ChatRoomId;
  readonly userId: ChatUserId;
  readonly sourceMount: BackendChatMountTarget;
  readonly now?: UnixMs;
}

export interface RecordMountTransitionArgs {
  readonly state: Readonly<ChatState>;
  readonly roomId: ChatRoomId;
  readonly userId: ChatUserId;
  readonly fromMount: BackendChatMountTarget;
  readonly toMount: BackendChatMountTarget;
  readonly reason?: BackendChatTransitionReason;
  readonly now?: UnixMs;
}

export interface CrossModeContinuityLedgerConfig {
  readonly maxSnapshotsPerPlayer: number;
  readonly maxTransitionsPerPlayer: number;
  readonly maxTranscriptPreview: number;
  readonly maxCarriedActors: number;
  readonly maxPendingRevealCues: number;
  readonly maxUnresolvedMoments: number;
  readonly staleSnapshotMs: number;
  readonly transcriptRecencyWindowMs: number;
  readonly helperCarryThreshold01: number;
  readonly rivalCarryThreshold01: number;
  readonly reopenThreshold01: number;
}

export const DEFAULT_CROSS_MODE_CONTINUITY_LEDGER_CONFIG: CrossModeContinuityLedgerConfig = Object.freeze({
  maxSnapshotsPerPlayer: 24,
  maxTransitionsPerPlayer: 48,
  maxTranscriptPreview: 8,
  maxCarriedActors: 6,
  maxPendingRevealCues: 6,
  maxUnresolvedMoments: 6,
  staleSnapshotMs: 20 * 60 * 1000,
  transcriptRecencyWindowMs: 9 * 60 * 1000,
  helperCarryThreshold01: 0.42,
  rivalCarryThreshold01: 0.44,
  reopenThreshold01: 0.46,
});

interface PlayerLedgerBucket {
  userId: ChatUserId;
  createdAt: UnixMs;
  updatedAt: UnixMs;
  lastMountTarget?: BackendChatMountTarget;
  leadRoomId?: ChatRoomId;
  activeEscortActorId?: string;
  roomSnapshots: Map<ChatRoomId, BackendChatRoomContinuitySnapshot>;
  transitions: BackendChatMountTransitionRecord[];
  carryoverSummary?: Record<string, JsonValue>;
}

// ============================================================================
// MARK: Utility
// ============================================================================

function nowUnixMs(): UnixMs {
  return Date.now() as UnixMs;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function normalizeMountTarget(value: unknown, fallback: BackendChatMountTarget): BackendChatMountTarget {
  return typeof value === 'string' && (BACKEND_CHAT_CONTINUITY_MOUNT_TARGETS as readonly string[]).includes(value)
    ? (value as BackendChatMountTarget)
    : fallback;
}

function allowedChannelsForMount(target: BackendChatMountTarget): readonly ChatVisibleChannel[] {
  return BACKEND_CHAT_CONTINUITY_MOUNT_PRESETS[target].allowedVisibleChannels;
}

function pickPreferredChannel(
  requested: ChatVisibleChannel | undefined,
  mount: BackendChatMountTarget,
  fallback?: ChatVisibleChannel,
): ChatVisibleChannel {
  const preset = BACKEND_CHAT_CONTINUITY_MOUNT_PRESETS[mount];
  const allowed = preset.allowedVisibleChannels;
  if (requested && allowed.includes(requested)) return requested;
  if (fallback && allowed.includes(fallback)) return fallback;
  return preset.defaultVisibleChannel;
}

function actorFromAttribution(attribution: ChatMessageAttribution): string {
  return attribution.actorId || attribution.displayName || 'unknown';
}

function messageRelevance(entry: ChatTranscriptEntry, room: ChatRoomState, heat01: number, now: UnixMs): number {
  const ageMs = Math.max(0, Number(now) - Number(entry.message.createdAt));
  const agePenalty = clamp01(ageMs / (15 * 60 * 1000));
  const sceneBoost = entry.message.replay.sceneId && entry.message.replay.sceneId === room.activeSceneId ? 0.22 : 0;
  const momentBoost = entry.message.replay.momentId && entry.message.replay.momentId === room.activeMomentId ? 0.18 : 0;
  const visibleBoost = entry.visibility === 'VISIBLE' ? 0.16 : 0.08;
  const legendaryBoost = entry.message.replay.legendId ? 0.12 : 0;
  const tagBoost = entry.message.tags.some((tag) => /RESCUE|BREACH|LEGEND|WORLD_EVENT|COMEBACK|TURNING_POINT/i.test(tag)) ? 0.16 : 0;
  return clamp01(0.7 - (agePenalty * 0.42) + visibleBoost + sceneBoost + momentBoost + legendaryBoost + tagBoost + (heat01 * 0.08));
}

function inferRelationshipDigest(rel: ChatRelationshipState): BackendChatContinuityRelationshipDigest {
  const trust01 = clamp01(Number(rel.trust01));
  const fear01 = clamp01(Number(rel.fear01));
  const contempt01 = clamp01(Number(rel.contempt01));
  const fascination01 = clamp01(Number(rel.fascination01));
  const rivalry01 = clamp01(Number(rel.rivalry01));
  const rescueDebt01 = clamp01(Number(rel.rescueDebt01));
  const intimacy01 = clamp01((trust01 * 0.42) + (fascination01 * 0.14) + (rescueDebt01 * 0.44));
  const threat01 = clamp01((fear01 * 0.32) + (contempt01 * 0.28) + (rivalry01 * 0.40));
  const helperBias01 = clamp01((trust01 * 0.45) + (rescueDebt01 * 0.55));
  const intensity01 = clamp01(Math.max(trust01, fear01, contempt01, fascination01, rivalry01, rescueDebt01));
  const stance = rivalry01 >= 0.72
    ? 'OBSESSION'
    : helperBias01 >= 0.66
      ? 'ALLY'
      : threat01 >= 0.6
        ? 'RIVAL'
        : fear01 >= 0.52
          ? 'WOUNDED'
          : 'NEUTRAL';

  return {
    relationshipId: rel.id,
    actorId: rel.actorId,
    trust01,
    fear01,
    contempt01,
    fascination01,
    rivalry01,
    rescueDebt01,
    intimacy01,
    threat01,
    helperBias01,
    intensity01,
    stance,
  };
}

function escortStyleForCue(
  threat01: number,
  helper01: number,
  mount: BackendChatMountTarget,
  unresolvedMomentum01: number,
): BackendChatEscortStyle {
  const preset = BACKEND_CHAT_CONTINUITY_MOUNT_PRESETS[mount];
  if (mount === 'PREDATOR_GAME_SCREEN' && threat01 >= 0.45) return 'PREDATOR_STALK';
  if (mount === 'PHANTOM_GAME_SCREEN' && threat01 >= helper01) return 'SHADOW_ESCORT';
  if (threat01 >= 0.72 && unresolvedMomentum01 >= 0.4) return 'SHADOW_ESCORT';
  if (helper01 >= 0.56) return preset.preferredEscortStyle === 'SILENT_WATCH' ? 'SILENT_WATCH' : 'VISIBLE_ESCORT';
  return preset.preferredEscortStyle;
}

function temperatureForRoom(room: ChatRoomState, heat01: number, urgency01: number, mount: BackendChatMountTarget): BackendChatContinuityTemperature {
  const mood = room.stageMood;
  if (mount === 'PREDATOR_GAME_SCREEN' || mood === 'PREDATORY' || urgency01 >= 0.88) return 'HOSTILE';
  if (mood === 'HOSTILE' || heat01 >= 0.72 || urgency01 >= 0.7) return 'PRESSURED';
  if (mood === 'TENSE' || heat01 >= 0.5 || urgency01 >= 0.48) return 'TENSE';
  if (mount === 'LOBBY_SCREEN' || mood === 'CALM') return 'COOL';
  return 'STEADY';
}

function tensionBandFrom(pressure01: number, urgency01: number, heat01: number): BackendChatContinuityBand {
  const score = Math.max(pressure01, urgency01, heat01);
  if (score >= 0.92) return 'CRITICAL';
  if (score >= 0.78) return 'VOLATILE';
  if (score >= 0.62) return 'HOT';
  if (score >= 0.44) return 'WARM';
  if (score >= 0.18) return 'LOW';
  return 'DORMANT';
}

function pressureScore(
  room: ChatRoomState,
  heat: ChatAudienceHeat | null,
  typing: readonly ChatTypingSnapshot[],
  pendingReveals: readonly ChatPendingReveal[],
): number {
  const unreadGlobal = Number(room.unreadByChannel.GLOBAL ?? 0);
  const unreadDeal = Number(room.unreadByChannel.DEAL_ROOM ?? 0);
  const unreadLobby = Number(room.unreadByChannel.LOBBY ?? 0);
  const revealWeight = Math.min(0.24, pendingReveals.length * 0.06);
  const typingWeight = Math.min(0.18, typing.length * 0.04);
  const unreadWeight = Math.min(0.22, ((unreadGlobal * 0.03) + (unreadDeal * 0.04) + (unreadLobby * 0.01)));
  const activeMomentWeight = room.activeMomentId ? 0.18 : 0;
  const heatWeight = clamp01(Number(heat?.heat01 ?? 0));
  return clamp01((heatWeight * 0.36) + revealWeight + typingWeight + unreadWeight + activeMomentWeight);
}

function urgencyScore(
  room: ChatRoomState,
  relationships: readonly ChatRelationshipState[],
  pendingReveals: readonly ChatPendingReveal[],
): number {
  const hostileRelationship = relationships.reduce((max, rel) => {
    const digest = inferRelationshipDigest(rel);
    return Math.max(max, digest.threat01, digest.intensity01 * 0.9);
  }, 0);
  const revealUrgency = pendingReveals.reduce((max, reveal) => {
    const delayMs = Math.max(0, Number(reveal.revealAt) - Date.now());
    const closeness01 = clamp01(1 - (delayMs / (30 * 1000)));
    return Math.max(max, closeness01);
  }, 0);
  const sceneWeight = room.activeSceneId ? 0.16 : 0;
  const legendWeight = room.activeLegendId ? 0.12 : 0;
  return clamp01((hostileRelationship * 0.52) + (revealUrgency * 0.2) + sceneWeight + legendWeight);
}

function unresolvedMomentCues(
  room: ChatRoomState,
  transcript: readonly ChatTranscriptEntry[],
  config: CrossModeContinuityLedgerConfig,
): readonly BackendChatContinuityMomentCue[] {
  const cues: BackendChatContinuityMomentCue[] = [];
  if (room.activeMomentId) {
    const roomSceneMessages = transcript.filter((entry) => entry.message.replay.momentId === room.activeMomentId);
    cues.push({
      momentId: room.activeMomentId,
      reason: roomSceneMessages.length > 0 ? 'ACTIVE_MOMENT_TRANSCRIPT_PRESENT' : 'ACTIVE_MOMENT_ROOM_POINTER',
      channelId: room.activeVisibleChannel,
      intensity01: clamp01(0.68 + (roomSceneMessages.length * 0.03)),
      createdAt: roomSceneMessages.at(-1)?.message.createdAt ?? room.lastActivityAt,
      carryOverAllowed: true,
    });
  }

  for (const entry of transcript.slice(-18)) {
    const momentId = entry.message.replay.momentId;
    if (!momentId) continue;
    if (cues.some((cue) => cue.momentId === momentId)) continue;
    const hostile = entry.message.tags.some((tag) => /BREACH|ATTACK|COMEBACK|LEGEND|REVEAL|RESCUE|BOSS/i.test(tag));
    cues.push({
      momentId,
      reason: hostile ? 'RECENT_HIGH_IMPACT_TRANSCRIPT' : 'RECENT_TRANSCRIPT_MOMENT',
      channelId: room.activeVisibleChannel,
      intensity01: hostile ? 0.6 : 0.42,
      createdAt: entry.message.createdAt,
      carryOverAllowed: hostile || entry.visibility === 'VISIBLE',
    });
    if (cues.length >= config.maxUnresolvedMoments) break;
  }

  return cues
    .sort((a, b) => (b.intensity01 - a.intensity01) || (Number(b.createdAt) - Number(a.createdAt)))
    .slice(0, config.maxUnresolvedMoments);
}

function revealCues(
  roomId: ChatRoomId,
  pendingReveals: readonly ChatPendingReveal[],
  config: CrossModeContinuityLedgerConfig,
): readonly BackendChatContinuityRevealCue[] {
  return pendingReveals
    .filter((value) => value.roomId === roomId)
    .map((value, index) => ({
      revealId: `reveal:${value.roomId}:${value.message.id}:${index}`,
      roomId: value.roomId,
      revealAt: value.revealAt,
      messageId: value.message.id,
      channelId: value.message.channelId,
      summaryLine: value.message.plainText.slice(0, 180),
      tags: value.message.tags,
    }))
    .sort((a, b) => Number(a.revealAt) - Number(b.revealAt))
    .slice(0, config.maxPendingRevealCues);
}

function transcriptPreview(
  room: ChatRoomState,
  transcript: readonly ChatTranscriptEntry[],
  heat01: number,
  mount: BackendChatMountTarget,
  now: UnixMs,
  config: CrossModeContinuityLedgerConfig,
): readonly BackendChatContinuityTranscriptCue[] {
  const cap = Math.min(config.maxTranscriptPreview, BACKEND_CHAT_CONTINUITY_MOUNT_PRESETS[mount].transcriptPreviewCap);
  const allowedVisible = new Set(BACKEND_CHAT_CONTINUITY_MOUNT_PRESETS[mount].allowedVisibleChannels);
  return transcript
    .filter((entry) => Number(now) - Number(entry.message.createdAt) <= config.transcriptRecencyWindowMs)
    .filter((entry) => entry.visibility === 'VISIBLE' || entry.visibility === 'SHADOW')
    .filter((entry) => entry.visibility === 'SHADOW' || allowedVisible.has(entry.message.channelId as ChatVisibleChannel))
    .map((entry) => ({
      messageId: entry.message.id,
      channelId: entry.message.channelId,
      plainText: entry.message.plainText,
      createdAt: entry.message.createdAt,
      actorId: actorFromAttribution(entry.message.attribution),
      displayName: entry.message.attribution.displayName,
      sourceType: entry.message.attribution.sourceType,
      relevance01: messageRelevance(entry, room, heat01, now),
      visible: entry.visibility === 'VISIBLE',
      tags: entry.message.tags,
    }))
    .sort((a, b) => (b.relevance01 - a.relevance01) || (Number(b.createdAt) - Number(a.createdAt)))
    .slice(0, cap);
}

function actorCues(
  room: ChatRoomState,
  transcript: readonly ChatTranscriptEntry[],
  presence: readonly ChatPresenceSnapshot[],
  relationships: readonly ChatRelationshipState[],
  mount: BackendChatMountTarget,
  config: CrossModeContinuityLedgerConfig,
): readonly BackendChatContinuityActorCue[] {
  const relationshipByActorId = new Map<string, BackendChatContinuityRelationshipDigest>();
  for (const rel of relationships) {
    relationshipByActorId.set(rel.actorId, inferRelationshipDigest(rel));
  }

  const latestByActor = new Map<string, ChatTranscriptEntry>();
  for (const entry of transcript) {
    const actorId = actorFromAttribution(entry.message.attribution);
    latestByActor.set(actorId, entry);
  }

  const cues: BackendChatContinuityActorCue[] = [];
  for (const [actorId, entry] of latestByActor) {
    const rel = relationshipByActorId.get(actorId);
    const visiblePresenceBonus = presence.some((snapshot) => snapshot.actorLabel === entry.message.attribution.displayName && snapshot.visibleToRoom)
      ? 0.08
      : 0;
    const intimacy01 = rel?.intimacy01 ?? 0;
    const threat01 = rel?.threat01 ?? (entry.message.attribution.npcRole === 'HATER' ? 0.38 : 0.12);
    const helper01 = rel?.helperBias01 ?? (entry.message.attribution.npcRole === 'HELPER' ? 0.42 : 0.08);
    const unresolvedMomentum01 = clamp01(
      (entry.message.replay.momentId ? 0.24 : 0) +
      (entry.message.replay.sceneId ? 0.18 : 0) +
      (entry.message.replay.legendId ? 0.12 : 0) +
      (entry.message.tags.some((tag) => /BREACH|ATTACK|RESCUE|COMEBACK|REVEAL|TURNING_POINT/i.test(tag)) ? 0.2 : 0),
    );
    const escortScore01 = clamp01(
      (intimacy01 * 0.22) +
      (threat01 * 0.22) +
      (helper01 * 0.26) +
      (unresolvedMomentum01 * 0.22) +
      visiblePresenceBonus,
    );

    const visibleFollow = escortScore01 >= Math.min(config.helperCarryThreshold01, config.rivalCarryThreshold01)
      && (helper01 >= config.helperCarryThreshold01 || threat01 >= config.rivalCarryThreshold01 || unresolvedMomentum01 >= 0.44);
    const shadowFollow = !visibleFollow && (threat01 >= 0.26 || unresolvedMomentum01 >= 0.34);
    const preferredEscortStyle = escortStyleForCue(threat01, helper01, mount, unresolvedMomentum01);

    cues.push({
      actorId,
      displayName: entry.message.attribution.displayName,
      personaId: asString(entry.message.metadata.personaId),
      botId: entry.message.attribution.botId ?? undefined,
      npcRole: entry.message.attribution.npcRole ?? undefined,
      sourceChannelId: entry.message.channelId,
      lastMessageId: entry.message.id,
      lastMessageAt: entry.message.createdAt,
      lastSeenAt: entry.message.createdAt,
      escortScore01,
      threat01,
      helper01,
      intimacy01,
      unresolvedMomentum01,
      visibleFollow,
      shadowFollow,
      preferredEscortStyle,
      relationship: rel,
      tags: unique([
        ...(entry.message.tags ?? []),
        visibleFollow ? 'VISIBLE_FOLLOW' : '',
        shadowFollow ? 'SHADOW_FOLLOW' : '',
        rel?.stance ? `REL_${rel.stance}` : '',
      ].filter(Boolean)),
    });
  }

  return cues
    .sort((a, b) => (b.escortScore01 - a.escortScore01) || (Number(b.lastMessageAt) - Number(a.lastMessageAt)))
    .slice(0, config.maxCarriedActors);
}

function composeSummaryLine(args: {
  readonly room: ChatRoomState;
  readonly mount: BackendChatMountTarget;
  readonly cues: readonly BackendChatContinuityActorCue[];
  readonly reveals: readonly BackendChatContinuityRevealCue[];
  readonly moments: readonly BackendChatContinuityMomentCue[];
  readonly temperature: BackendChatContinuityTemperature;
  readonly band: BackendChatContinuityBand;
}): string {
  const escort = args.cues[0]?.displayName ?? 'the room';
  const scene = args.room.activeSceneId ? `scene ${args.room.activeSceneId}` : 'no active scene id';
  const pressure = `${args.temperature}/${args.band}`;
  const revealPhrase = args.reveals.length > 0 ? `${args.reveals.length} reveal${args.reveals.length === 1 ? '' : 's'} pending` : 'no queued reveal';
  const momentPhrase = args.moments.length > 0 ? `${args.moments.length} unresolved moment${args.moments.length === 1 ? '' : 's'}` : 'no unresolved moment';
  return `${args.mount} carryover holds ${escort} near the player; ${scene}; ${pressure}; ${revealPhrase}; ${momentPhrase}.`;
}

function composeShadowSummaryLine(args: {
  readonly cues: readonly BackendChatContinuityActorCue[];
  readonly reveals: readonly BackendChatContinuityRevealCue[];
  readonly room: ChatRoomState;
}): string {
  const shadow = args.cues.filter((cue) => cue.shadowFollow).map((cue) => cue.actorId).slice(0, 3);
  const revealTag = args.reveals.length > 0 ? 'REVEAL_PRESSURE' : 'NO_REVEAL_PRESSURE';
  return unique([
    args.room.activeMomentId ? `ACTIVE_MOMENT:${args.room.activeMomentId}` : '',
    args.room.activeLegendId ? `ACTIVE_LEGEND:${args.room.activeLegendId}` : '',
    shadow.length > 0 ? `SHADOW_FOLLOW:${shadow.join(',')}` : '',
    revealTag,
  ].filter(Boolean)).join(' | ');
}

function overlayState(
  room: ChatRoomState,
  mount: BackendChatMountTarget,
  pressure01: number,
  urgency01: number,
  summaryLine: string,
  config: CrossModeContinuityLedgerConfig,
): BackendChatContinuityOverlayState {
  const preset = BACKEND_CHAT_CONTINUITY_MOUNT_PRESETS[mount];
  const preferredChannel = pickPreferredChannel(room.activeVisibleChannel, mount, preset.defaultVisibleChannel);
  const restoreCollapsed = preset.allowCollapse ? (pressure01 < 0.34 && urgency01 < 0.28 ? preset.defaultCollapsed : false) : false;
  const restorePanelOpen = Math.max(pressure01, urgency01) >= config.reopenThreshold01 || !restoreCollapsed;
  return {
    preferredChannel,
    restoreCollapsed,
    restorePanelOpen,
    transcriptWindowTarget: preset.transcriptPreviewCap,
    reason: `${summaryLine} overlay->${preferredChannel}/${restoreCollapsed ? 'collapsed' : 'expanded'}`,
  };
}

// ============================================================================
// MARK: CrossModeContinuityLedger
// ============================================================================

export class CrossModeContinuityLedger {
  private readonly config: CrossModeContinuityLedgerConfig;
  private readonly players = new Map<ChatUserId, PlayerLedgerBucket>();
  private createdAt: UnixMs = nowUnixMs();
  private updatedAt: UnixMs = this.createdAt;

  public constructor(config: Partial<CrossModeContinuityLedgerConfig> = {}) {
    this.config = Object.freeze({
      ...DEFAULT_CROSS_MODE_CONTINUITY_LEDGER_CONFIG,
      ...config,
    });
  }

  public getConfig(): CrossModeContinuityLedgerConfig {
    return { ...this.config };
  }

  public captureRoomContinuity(args: CaptureRoomContinuityArgs): BackendChatRoomContinuitySnapshot | null {
    const now = args.now ?? nowUnixMs();
    const room = selectRoom(args.state, args.roomId);
    if (!room) return null;

    const mount = normalizeMountTarget(args.sourceMount, 'GAME_BOARD');
    const transcript = selectRoomTranscript(args.state, args.roomId);
    const presence = selectRoomPresence(args.state, args.roomId);
    const typing = selectRoomTyping(args.state, args.roomId);
    const relationships = selectRoomRelationships(args.state, args.roomId).filter((value) => value.userId === args.userId);
    const heat = selectAudienceHeat(args.state, args.roomId);
    const pendingRevealCues = revealCues(args.roomId, args.state.pendingReveals, this.config);
    const pressure01 = pressureScore(room, heat, typing, args.state.pendingReveals.filter((entry) => entry.roomId === args.roomId));
    const urgency01 = urgencyScore(room, relationships, args.state.pendingReveals.filter((entry) => entry.roomId === args.roomId));
    const heat01 = clamp01(Number(heat?.heat01 ?? 0));
    const band = tensionBandFrom(pressure01, urgency01, heat01);
    const temperature = temperatureForRoom(room, heat01, urgency01, mount);
    const preview = transcriptPreview(room, transcript, heat01, mount, now, this.config);
    const cues = actorCues(room, transcript, presence, relationships, mount, this.config);
    const moments = unresolvedMomentCues(room, transcript, this.config);
    const summaryLine = composeSummaryLine({
      room,
      mount,
      cues,
      reveals: pendingRevealCues,
      moments,
      temperature,
      band,
    });
    const shadowSummaryLine = composeShadowSummaryLine({ cues, reveals: pendingRevealCues, room });
    const overlay = overlayState(room, mount, pressure01, urgency01, summaryLine, this.config);
    const carriedPersonaIds = unique(cues.map((cue) => cue.personaId).filter((value): value is string => Boolean(value)));
    const snapshot: BackendChatRoomContinuitySnapshot = {
      continuityId: `continuity:${args.userId}:${args.roomId}:${now}`,
      capturedAt: now,
      roomId: args.roomId,
      userId: args.userId,
      sourceMount: mount,
      roomStageMood: room.stageMood,
      preferredVisibleChannel: overlay.preferredChannel,
      allowedVisibleChannels: allowedChannelsForMount(mount),
      tensionBand: band,
      temperature,
      pressure01,
      urgency01,
      heat01,
      occupancy: presence.filter((value) => value.visibleToRoom).length,
      typingCount: typing.length,
      hasPendingReveals: pendingRevealCues.length > 0,
      activeSceneId: room.activeSceneId ?? undefined,
      activeMomentId: room.activeMomentId ?? undefined,
      activeLegendId: room.activeLegendId ?? undefined,
      summaryLine,
      shadowSummaryLine,
      transcriptPreview: preview,
      carriedActors: cues,
      pendingRevealCues,
      unresolvedMoments: moments,
      carriedPersonaIds,
      overlay,
      tags: unique([
        `MOUNT:${mount}`,
        `STAGE:${room.stageMood}`,
        `TEMP:${temperature}`,
        `BAND:${band}`,
        room.activeSceneId ? 'ACTIVE_SCENE' : '',
        room.activeMomentId ? 'ACTIVE_MOMENT' : '',
        room.activeLegendId ? 'ACTIVE_LEGEND' : '',
        pendingRevealCues.length > 0 ? 'HAS_REVEALS' : '',
        cues.some((cue) => cue.visibleFollow) ? 'VISIBLE_FOLLOWERS' : '',
        cues.some((cue) => cue.shadowFollow) ? 'SHADOW_FOLLOWERS' : '',
      ].filter(Boolean)),
    };

    this.upsertSnapshot(args.userId, snapshot, now);
    return snapshot;
  }

  public recordMountTransition(args: RecordMountTransitionArgs): BackendChatMountTransitionRecord | null {
    const now = args.now ?? nowUnixMs();
    const snapshot = this.captureRoomContinuity({
      state: args.state,
      roomId: args.roomId,
      userId: args.userId,
      sourceMount: args.fromMount,
      now,
    });
    if (!snapshot) return null;

    const record: BackendChatMountTransitionRecord = {
      transitionId: `transition:${args.userId}:${args.roomId}:${now}`,
      userId: args.userId,
      roomId: args.roomId,
      fromMount: args.fromMount,
      toMount: args.toMount,
      reason: args.reason ?? 'UNKNOWN',
      createdAt: now,
      preferredVisibleChannel: pickPreferredChannel(snapshot.preferredVisibleChannel, args.toMount, snapshot.preferredVisibleChannel),
      summaryLine: snapshot.summaryLine,
      carriedPersonaIds: snapshot.carriedPersonaIds,
      escortActorId: snapshot.carriedActors[0]?.actorId,
      unresolvedMomentIds: snapshot.unresolvedMoments.map((value) => value.momentId),
      continuityId: snapshot.continuityId,
    };

    const bucket = this.ensurePlayer(args.userId, now);
    bucket.transitions.unshift(record);
    bucket.transitions = bucket.transitions.slice(0, this.config.maxTransitionsPerPlayer);
    bucket.lastMountTarget = args.toMount;
    bucket.leadRoomId = args.roomId;
    bucket.activeEscortActorId = record.escortActorId;
    bucket.updatedAt = now;
    bucket.carryoverSummary = this.buildCarryoverSummary(bucket, snapshot, record);
    this.updatedAt = now;
    this.prune(now);
    return record;
  }

  public noteFrontendCarryoverSummary(
    userId: ChatUserId,
    roomId: ChatRoomId,
    summary: Readonly<Record<string, JsonValue>>,
    now: UnixMs = nowUnixMs(),
  ): void {
    const bucket = this.ensurePlayer(userId, now);
    const existing = bucket.roomSnapshots.get(roomId);
    if (!existing) {
      bucket.carryoverSummary = { ...summary };
      bucket.updatedAt = now;
      this.updatedAt = now;
      return;
    }

    bucket.roomSnapshots.set(roomId, {
      ...existing,
      summaryLine: asString(summary.summaryLine) ?? existing.summaryLine,
      shadowSummaryLine: asString(summary.shadowSummaryLine) ?? existing.shadowSummaryLine,
      preferredVisibleChannel: asString(summary.preferredVisibleChannel) as ChatVisibleChannel ?? existing.preferredVisibleChannel,
      carriedPersonaIds: Array.isArray(summary.carriedPersonaIds)
        ? unique((summary.carriedPersonaIds as readonly JsonValue[]).map((value) => String(value)))
        : existing.carriedPersonaIds,
      overlay: {
        ...existing.overlay,
        preferredChannel: asString(summary.preferredVisibleChannel) as ChatVisibleChannel ?? existing.overlay.preferredChannel,
      },
    });
    bucket.carryoverSummary = { ...(bucket.carryoverSummary ?? {}), ...summary };
    bucket.updatedAt = now;
    this.updatedAt = now;
  }

  public getPlayerState(userId: ChatUserId): BackendChatPlayerContinuityState | null {
    const bucket = this.players.get(userId);
    if (!bucket) return null;
    return this.snapshotPlayer(bucket);
  }

  public getRoomSnapshot(userId: ChatUserId, roomId: ChatRoomId): BackendChatRoomContinuitySnapshot | null {
    return this.players.get(userId)?.roomSnapshots.get(roomId) ?? null;
  }

  public getTransitions(userId: ChatUserId): readonly BackendChatMountTransitionRecord[] {
    return this.players.get(userId)?.transitions ?? [];
  }

  public getSnapshot(): BackendChatContinuityLedgerSnapshot {
    const players: Record<ChatUserId, BackendChatPlayerContinuityState> = {} as Record<ChatUserId, BackendChatPlayerContinuityState>;
    const transitionsByUser: Record<ChatUserId, readonly BackendChatMountTransitionRecord[]> = {} as Record<ChatUserId, readonly BackendChatMountTransitionRecord[]>;
    for (const [userId, bucket] of this.players) {
      players[userId] = this.snapshotPlayer(bucket);
      transitionsByUser[userId] = [...bucket.transitions];
    }
    return {
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      players,
      transitionsByUser,
    };
  }

  public restore(snapshot: BackendChatContinuityLedgerSnapshot): void {
    this.players.clear();
    this.createdAt = snapshot.createdAt;
    this.updatedAt = snapshot.updatedAt;
    for (const [userId, player] of Object.entries(snapshot.players) as [ChatUserId, BackendChatPlayerContinuityState][]) {
      this.players.set(userId, {
        userId,
        createdAt: player.createdAt,
        updatedAt: player.updatedAt,
        lastMountTarget: player.lastMountTarget,
        leadRoomId: player.leadRoomId,
        activeEscortActorId: player.activeEscortActorId,
        roomSnapshots: new Map(Object.entries(player.roomSnapshots) as [ChatRoomId, BackendChatRoomContinuitySnapshot][]),
        transitions: [...(snapshot.transitionsByUser[userId] ?? [])],
        carryoverSummary: player.carryoverSummary ? { ...player.carryoverSummary } : undefined,
      });
    }
  }

  public prune(now: UnixMs = nowUnixMs()): void {
    for (const [userId, bucket] of this.players) {
      for (const [roomId, snapshot] of bucket.roomSnapshots) {
        if (Number(now) - Number(snapshot.capturedAt) > this.config.staleSnapshotMs) {
          bucket.roomSnapshots.delete(roomId);
        }
      }
      bucket.transitions = bucket.transitions.filter((entry) => Number(now) - Number(entry.createdAt) <= this.config.staleSnapshotMs);
      if (bucket.roomSnapshots.size === 0 && bucket.transitions.length === 0) {
        this.players.delete(userId);
      }
    }
    this.updatedAt = now;
  }

  private ensurePlayer(userId: ChatUserId, now: UnixMs): PlayerLedgerBucket {
    const current = this.players.get(userId);
    if (current) return current;
    const created: PlayerLedgerBucket = {
      userId,
      createdAt: now,
      updatedAt: now,
      roomSnapshots: new Map(),
      transitions: [],
    };
    this.players.set(userId, created);
    return created;
  }

  private upsertSnapshot(userId: ChatUserId, snapshot: BackendChatRoomContinuitySnapshot, now: UnixMs): void {
    const bucket = this.ensurePlayer(userId, now);
    bucket.roomSnapshots.set(snapshot.roomId, snapshot);
    bucket.updatedAt = now;
    bucket.lastMountTarget = snapshot.sourceMount;
    bucket.leadRoomId = snapshot.roomId;
    bucket.activeEscortActorId = snapshot.carriedActors[0]?.actorId;
    bucket.carryoverSummary = this.buildCarryoverSummary(bucket, snapshot);
    if (bucket.roomSnapshots.size > this.config.maxSnapshotsPerPlayer) {
      const stale = [...bucket.roomSnapshots.values()]
        .sort((a, b) => Number(b.capturedAt) - Number(a.capturedAt))
        .slice(this.config.maxSnapshotsPerPlayer);
      for (const item of stale) bucket.roomSnapshots.delete(item.roomId);
    }
    this.updatedAt = now;
  }

  private buildCarryoverSummary(
    bucket: PlayerLedgerBucket,
    snapshot: BackendChatRoomContinuitySnapshot,
    transition?: BackendChatMountTransitionRecord,
  ): Record<string, JsonValue> {
    return {
      continuityId: snapshot.continuityId,
      roomId: snapshot.roomId,
      sourceMount: snapshot.sourceMount,
      preferredVisibleChannel: snapshot.preferredVisibleChannel,
      summaryLine: snapshot.summaryLine,
      shadowSummaryLine: snapshot.shadowSummaryLine,
      tensionBand: snapshot.tensionBand,
      temperature: snapshot.temperature,
      activeSceneId: snapshot.activeSceneId ?? null,
      activeMomentId: snapshot.activeMomentId ?? null,
      activeLegendId: snapshot.activeLegendId ?? null,
      unresolvedMomentIds: snapshot.unresolvedMoments.map((value) => value.momentId),
      carriedPersonaIds: snapshot.carriedPersonaIds,
      carriedActorIds: snapshot.carriedActors.map((value) => value.actorId),
      escortActorId: snapshot.carriedActors[0]?.actorId ?? null,
      leadRoomId: bucket.leadRoomId ?? null,
      lastMountTarget: bucket.lastMountTarget ?? null,
      lastTransitionId: transition?.transitionId ?? null,
      lastTransitionToMount: transition?.toMount ?? null,
      restoreCollapsed: snapshot.overlay.restoreCollapsed,
      restorePanelOpen: snapshot.overlay.restorePanelOpen,
    };
  }

  private snapshotPlayer(bucket: PlayerLedgerBucket): BackendChatPlayerContinuityState {
    const roomSnapshots = Object.fromEntries(bucket.roomSnapshots.entries()) as Readonly<Record<ChatRoomId, BackendChatRoomContinuitySnapshot>>;
    const carriedPersonaIds = unique([...bucket.roomSnapshots.values()].flatMap((value) => value.carriedPersonaIds));
    const activeActorIds = unique([...bucket.roomSnapshots.values()].flatMap((value) => value.carriedActors.map((cue) => cue.actorId)));
    const unresolvedMomentIds = unique([...bucket.roomSnapshots.values()].flatMap((value) => value.unresolvedMoments.map((cue) => cue.momentId)));
    return {
      userId: bucket.userId,
      createdAt: bucket.createdAt,
      updatedAt: bucket.updatedAt,
      lastMountTarget: bucket.lastMountTarget,
      leadRoomId: bucket.leadRoomId,
      activeEscortActorId: bucket.activeEscortActorId,
      roomSnapshots,
      carriedPersonaIds,
      activeActorIds,
      unresolvedMomentIds,
      carryoverSummary: bucket.carryoverSummary ? { ...bucket.carryoverSummary } : undefined,
    };
  }
}

export function createCrossModeContinuityLedger(
  config: Partial<CrossModeContinuityLedgerConfig> = {},
): CrossModeContinuityLedger {
  return new CrossModeContinuityLedger(config);
}
