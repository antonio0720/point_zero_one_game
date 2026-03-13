/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT ENGINE RUNTIME CONFIG
 * FILE: pzo-web/src/engines/chat/ChatRuntimeConfig.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical runtime configuration authority for the unified frontend chat lane.
 *
 * This file exists because the chat engine is no longer a single hook-sized
 * concern. The lane now has multiple real authorities:
 *   - ChatSocketClient.ts
 *   - ChatPresenceController.ts
 *   - ChatTypingController.ts
 *   - ChatNotificationController.ts
 *   - ChatTranscriptBuffer.ts
 *   - ChatPrivacyPolicy.ts
 *   - ChatChannelPolicy.ts
 *   - ChatInvasionDirector.ts
 *   - ChatNpcDirector.ts
 *
 * Once the chat brain is split across these files, a repo-faithful runtime
 * configuration layer becomes necessary so that:
 *   1. screens stop inventing their own chat behavior,
 *   2. channel policy stays aligned with mode policy,
 *   3. presence / typing / notification cadence stays coherent,
 *   4. invasion and NPC orchestration share the same runtime assumptions,
 *   5. transport + transcript limits stay explicit,
 *   6. low-bandwidth / offline / replay-heavy modes can be tuned centrally.
 *
 * Preserved repo truths
 * ---------------------
 * - Chat is an engine lane, not a UI-only toy.
 * - The client owns responsiveness and staging, not ultimate transcript truth.
 * - GLOBAL, SYNDICATE, DEAL_ROOM, and LOBBY are behaviorally distinct.
 * - Presence, typing, notifications, privacy, and invasions are gameplay-facing.
 * - Mounts happen across many surfaces, so per-screen ad-hoc configs are a
 *   drift vector.
 *
 * Design laws
 * -----------
 * - Configuration must be deterministic.
 * - Screen presets must be explicit and merge-safe.
 * - Mode overlays must preserve behavioral intent.
 * - Deep merge behavior must be stable and typed.
 * - No controller should need to guess its runtime defaults.
 * - Local-first and server-authoritative doctrine must both be visible in the
 *   config surface.
 *
 * Migration note
 * --------------
 * This file intentionally works with the local compatibility contracts created
 * in this session. Once /shared/contracts/chat and pzo-web/src/engines/chat/
 * types.ts are canonicalized, this file should remain the default-value and
 * preset authority while the imported types shift to shared contracts.
 *
 * Density6 LLC · Point Zero One · Production-first architecture
 * ============================================================================
 */

import {
  type ChatChannel,
  type ChatSocketRuntimeConfig,
} from './ChatSocketClient';

import {
  type ChatPresenceControllerConfig,
} from './ChatPresenceController';

import {
  type ChatTypingControllerConfig,
} from './ChatTypingController';

import {
  type ChatNotificationControllerConfig,
} from './ChatNotificationController';

import {
  type ChatTranscriptBufferConfig,
} from './ChatTranscriptBuffer';

import {
  type ChatPrivacyPolicyConfig,
} from './ChatPrivacyPolicy';

import {
  type ChatChannelPolicyConfig,
  type ChatModeSnapshot,
} from './ChatChannelPolicy';

import {
  type ChatInvasionDirectorConfig,
  type ChatInvasionRuntimeState,
} from './ChatInvasionDirector';

export type ChatRuntimeEnvironment =
  | 'development'
  | 'staging'
  | 'production'
  | 'test'
  | 'offline';

export type ChatRuntimeScaleProfile =
  | 'LOCAL_DEV'
  | 'SOLO_RUN'
  | 'SMALL_ROOM'
  | 'MATCHED_ROOM'
  | 'MEGA_ROOM'
  | 'DEGRADED_NETWORK';

export type ChatRuntimePresetName =
  | 'DEFAULT'
  | 'BATTLEHUD'
  | 'LOBBY'
  | 'EMPIRE'
  | 'LEAGUE'
  | 'CLUB'
  | 'PREDATOR'
  | 'PHANTOM'
  | 'SYNDICATE'
  | 'DEALROOM_NEGOTIATION'
  | 'POSTRUN'
  | 'OFFLINE_SAFE'
  | 'LOW_BANDWIDTH'
  | 'REPLAY_FORENSIC';

export type ChatRuntimeImportance =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';

export type ChatRuntimeModeFamily =
  | 'UNKNOWN'
  | 'LOBBY'
  | 'RUN'
  | 'BATTLE'
  | 'SYNDICATE'
  | 'DEAL'
  | 'POSTRUN'
  | 'REPLAY';

export interface ChatRuntimeControllerToggles {
  socket: boolean;
  presence: boolean;
  typing: boolean;
  notification: boolean;
  transcript: boolean;
  privacy: boolean;
  channelPolicy: boolean;
  invasion: boolean;
  npc: boolean;
}

export interface ChatRuntimeAttentionPolicy {
  allowBrowser: boolean;
  allowSounds: boolean;
  allowTitleBadge: boolean;
  activeChannelBannerSeverityFloor: 'INFO' | 'TACTICAL' | 'WARN' | 'CRITICAL';
  browserSeverityFloor: 'INFO' | 'TACTICAL' | 'WARN' | 'CRITICAL';
  soundSeverityFloor: 'INFO' | 'TACTICAL' | 'WARN' | 'CRITICAL';
}

export interface ChatRuntimeTranscriptPolicy {
  optimisticTimeoutMs: number;
  maxWindowPerChannel: number;
  replayMergeLimit: number;
  proofRetentionFloor: number;
  keepFailedMessages: boolean;
}

export interface ChatRuntimeTransportPolicy {
  heartbeatIntervalMs: number;
  heartbeatTimeoutMs: number;
  ackTimeoutMs: number;
  replayRequestTimeoutMs: number;
  maxReconnectAttempts: number;
  reconnectBaseDelayMs: number;
  reconnectMaxDelayMs: number;
  outboundQueueLimit: number;
}

export interface ChatRuntimeNpcDirectorConfig {
  maxActivePlans?: number;
  ambientCadenceBaseMs?: number;
  ambientCadenceJitterMs?: number;
  helperCooldownMs?: number;
  haterCooldownMs?: number;
  ambientCooldownMs?: number;
  directReplyWindowMs?: number;
  idleHelperThresholdMs?: number;
  lowSignalAmbientThresholdMs?: number;
  helperInterventionDelayMs?: number;
  haterEscalationDelayMs?: number;
  allowAmbientNpc?: boolean;
  allowHelpers?: boolean;
  allowHaters?: boolean;
  allowCrowdEcho?: boolean;
  allowTypingTheater?: boolean;
  allowPresenceTheater?: boolean;
  allowNotificationMirror?: boolean;
  allowTranscriptMirror?: boolean;
  allowSocketMirror?: boolean;
  allowInvasionEscalation?: boolean;
  historyLimit?: number;
  dedupWindowMs?: number;
  log?: (message: string, context?: Record<string, unknown>) => void;
  warn?: (message: string, context?: Record<string, unknown>) => void;
  error?: (message: string, context?: Record<string, unknown>) => void;
}

export interface ChatRuntimeMeta {
  preset: ChatRuntimePresetName;
  environment: ChatRuntimeEnvironment;
  scaleProfile: ChatRuntimeScaleProfile;
  modeFamily: ChatRuntimeModeFamily;
  version: string;
  createdAt: string;
  notes?: string[];
  tags?: string[];
}

export interface ChatRuntimeConfig {
  meta: ChatRuntimeMeta;
  controllers: ChatRuntimeControllerToggles;
  attention: ChatRuntimeAttentionPolicy;
  transcriptPolicy: ChatRuntimeTranscriptPolicy;
  transportPolicy: ChatRuntimeTransportPolicy;
  socket: ChatSocketRuntimeConfig;
  presence: ChatPresenceControllerConfig;
  typing: ChatTypingControllerConfig;
  notification: ChatNotificationControllerConfig;
  transcript: ChatTranscriptBufferConfig;
  privacy: ChatPrivacyPolicyConfig;
  channelPolicy: ChatChannelPolicyConfig;
  invasion: ChatInvasionDirectorConfig;
  npcDirector: ChatRuntimeNpcDirectorConfig;
  mode: Partial<ChatModeSnapshot>;
  invasionRuntime: Partial<ChatInvasionRuntimeState>;
}

export interface ChatRuntimeControllerBundle {
  socket: ChatSocketRuntimeConfig;
  presence: ChatPresenceControllerConfig;
  typing: ChatTypingControllerConfig;
  notification: ChatNotificationControllerConfig;
  transcript: ChatTranscriptBufferConfig;
  privacy: ChatPrivacyPolicyConfig;
  channelPolicy: ChatChannelPolicyConfig;
  invasion: ChatInvasionDirectorConfig;
  npcDirector: ChatRuntimeNpcDirectorConfig;
}

export interface ChatRuntimePreset {
  name: ChatRuntimePresetName;
  importance: ChatRuntimeImportance;
  summary: string;
  config: DeepPartial<ChatRuntimeConfig>;
}

export interface ChatRuntimeSummary {
  preset: ChatRuntimePresetName;
  environment: ChatRuntimeEnvironment;
  scaleProfile: ChatRuntimeScaleProfile;
  modeFamily: ChatRuntimeModeFamily;
  activeControllers: string[];
  socketEndpoint: string;
  globalVisibility: string;
  syndicateEnabled: boolean;
  dealRoomEnabled: boolean;
  invasionEnabled: boolean;
  ambientNpcEnabled: boolean;
  createdAt: string;
}

export type Primitive = string | number | boolean | bigint | symbol | null | undefined;

export type DeepPartial<T> =
  T extends Primitive ? T
    : T extends Array<infer U> ? Array<DeepPartial<U>>
    : T extends Map<infer K, infer V> ? Map<DeepPartial<K>, DeepPartial<V>>
    : T extends Set<infer U> ? Set<DeepPartial<U>>
    : T extends (...args: any[]) => any ? T
    : T | { [K in keyof T]?: DeepPartial<T[K]> };

const CHANNELS: ChatChannel[] = ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY'];

const VERSION = '1.0.0';

const DEFAULT_CONTROLLER_TOGGLES: ChatRuntimeControllerToggles = {
  socket: true,
  presence: true,
  typing: true,
  notification: true,
  transcript: true,
  privacy: true,
  channelPolicy: true,
  invasion: true,
  npc: true,
};

const DEFAULT_ATTENTION_POLICY: ChatRuntimeAttentionPolicy = {
  allowBrowser: true,
  allowSounds: true,
  allowTitleBadge: true,
  activeChannelBannerSeverityFloor: 'CRITICAL',
  browserSeverityFloor: 'WARN',
  soundSeverityFloor: 'TACTICAL',
};

const DEFAULT_TRANSCRIPT_POLICY: ChatRuntimeTranscriptPolicy = {
  optimisticTimeoutMs: 15_000,
  maxWindowPerChannel: 500,
  replayMergeLimit: 300,
  proofRetentionFloor: 50,
  keepFailedMessages: true,
};

const DEFAULT_TRANSPORT_POLICY: ChatRuntimeTransportPolicy = {
  heartbeatIntervalMs: 10_000,
  heartbeatTimeoutMs: 25_000,
  ackTimeoutMs: 8_000,
  replayRequestTimeoutMs: 8_000,
  maxReconnectAttempts: 10,
  reconnectBaseDelayMs: 1_000,
  reconnectMaxDelayMs: 15_000,
  outboundQueueLimit: 500,
};

const DEFAULT_SOCKET_CONFIG: ChatSocketRuntimeConfig = {
  endpoint: '/socket.io',
  namespace: '',
  transports: ['websocket', 'polling'],
  autoConnect: true,
  heartbeatIntervalMs: DEFAULT_TRANSPORT_POLICY.heartbeatIntervalMs,
  heartbeatTimeoutMs: DEFAULT_TRANSPORT_POLICY.heartbeatTimeoutMs,
  ackTimeoutMs: DEFAULT_TRANSPORT_POLICY.ackTimeoutMs,
  replayRequestTimeoutMs: DEFAULT_TRANSPORT_POLICY.replayRequestTimeoutMs,
  maxReconnectAttempts: DEFAULT_TRANSPORT_POLICY.maxReconnectAttempts,
  reconnectBaseDelayMs: DEFAULT_TRANSPORT_POLICY.reconnectBaseDelayMs,
  reconnectMaxDelayMs: DEFAULT_TRANSPORT_POLICY.reconnectMaxDelayMs,
  dedupWindowMs: 7_500,
  dedupCacheSize: 1_024,
  outboundQueueLimit: DEFAULT_TRANSPORT_POLICY.outboundQueueLimit,
  metricsFlushIntervalMs: 15_000,
  idlePresenceHeartbeatMs: 20_000,
  activePresenceHeartbeatMs: 8_000,
  typingDebounceMs: 350,
  typingMaxWindowMs: 6_000,
};

const DEFAULT_PRESENCE_CONFIG: ChatPresenceControllerConfig = {
  idleAfterMs: 20_000,
  awayAfterMs: 90_000,
  remoteOfflineAfterMs: 120_000,
  typingTtlMs: 6_000,
  stripParticipantLimit: 12,
  unreadResetOnOpen: true,
  emitLocalPresenceImmediately: true,
  allowNpcPresenceTheater: true,
};

const DEFAULT_TYPING_CONFIG: ChatTypingControllerConfig = {
  allowTypingWhenHidden: false,
  allowTypingWhenBlurred: false,
  emitFocusKeepalive: true,
  startOnPasteOverChars: 16,
  minimumMeaningfulDeltaChars: 1,
  maxDuplicateHashesPerChannel: 24,
  staleComposerDestroyAfterMs: 1_800_000,
  theaterRandomSeed: 101,
  globalPolicy: {
    minCharsToStart: 1,
    debounceStartMs: 180,
    refreshPulseMs: 1_500,
    idleStopMs: 4_800,
    cooldownMs: 1_000,
    maxContinuousMs: 14_000,
  },
  syndicatePolicy: {
    minCharsToStart: 2,
    debounceStartMs: 260,
    refreshPulseMs: 1_800,
    idleStopMs: 5_400,
    cooldownMs: 900,
    maxContinuousMs: 16_000,
  },
  dealRoomPolicy: {
    minCharsToStart: 2,
    debounceStartMs: 420,
    refreshPulseMs: 2_200,
    idleStopMs: 5_800,
    cooldownMs: 1_400,
    maxContinuousMs: 12_000,
  },
  lobbyPolicy: {
    minCharsToStart: 1,
    debounceStartMs: 220,
    refreshPulseMs: 1_600,
    idleStopMs: 5_000,
    cooldownMs: 800,
    maxContinuousMs: 14_500,
  },
};

const DEFAULT_NOTIFICATION_CONFIG: ChatNotificationControllerConfig = {
  recentLimit: 120,
  browserMaxPerMinute: 6,
  browserAutoCloseMs: 8_000,
  bannerMaxVisible: 3,
  activeChannelBannerSeverityFloor: DEFAULT_ATTENTION_POLICY.activeChannelBannerSeverityFloor,
  browserSeverityFloor: DEFAULT_ATTENTION_POLICY.browserSeverityFloor,
  soundSeverityFloor: DEFAULT_ATTENTION_POLICY.soundSeverityFloor,
  allowBrowserNotifications: DEFAULT_ATTENTION_POLICY.allowBrowser,
  allowTitleBadge: DEFAULT_ATTENTION_POLICY.allowTitleBadge,
  allowSounds: DEFAULT_ATTENTION_POLICY.allowSounds,
  baseTitle: 'Point Zero One',
  dedupWindowMs: 6_000,
  idleUnreadCollapseMs: 120_000,
};

const DEFAULT_TRANSCRIPT_CONFIG: ChatTranscriptBufferConfig = {
  maxWindowPerChannel: DEFAULT_TRANSCRIPT_POLICY.maxWindowPerChannel,
  maxDrawerSearchScan: 2_500,
  replayMergeLimit: DEFAULT_TRANSCRIPT_POLICY.replayMergeLimit,
  optimisticTimeoutMs: DEFAULT_TRANSCRIPT_POLICY.optimisticTimeoutMs,
  dedupWindowMs: 100,
  dedupCacheLimit: 2_000,
  proofRetentionFloor: DEFAULT_TRANSCRIPT_POLICY.proofRetentionFloor,
  keepFailedMessages: DEFAULT_TRANSCRIPT_POLICY.keepFailedMessages,
  pruneTombstonesAfterMs: 120_000,
  preserveSystemReceipts: true,
  allowImmutableRebodyOnlyIfProofMatches: true,
};

const DEFAULT_PRIVACY_CONFIG: ChatPrivacyPolicyConfig = {
  allowGlobalUrls: false,
  allowDealRoomUrls: true,
  allowDealRoomProofHashes: true,
  allowDealRoomPartialBankingIdentifiers: false,
  allowSyndicatePartialIdentifiers: false,
  allowMaskedNotifications: true,
  blockRawAddressesInGlobal: true,
  blockSelfDoxxingInGlobal: true,
  treatUnknownSecretsAsWarn: true,
  preserveSystemBodiesForStorage: true,
  maxMaskedPreviewLength: 160,
};

const DEFAULT_CHANNEL_POLICY_CONFIG: ChatChannelPolicyConfig = {
  allowLobbyInRun: false,
  allowDealRoomTranscriptOnlyWithoutDealId: true,
  allowSyndicateReadOnlyWithoutMembership: false,
  globalBrowserNoiseCutoffHeat: 55,
  tacticalEscalationHeatThreshold: 65,
  negotiationEscalationUrgencyThreshold: 60,
  pressureEscalationFloor: 'HIGH',
  preferDealRoomForProofHashes: true,
  preferSyndicateForSensitiveButNonDealContent: true,
  collapseInactiveChannelsAfterMs: 180_000,
  hiddenChannelHeatRetentionMs: 420_000,
};

const DEFAULT_INVASION_CONFIG: ChatInvasionDirectorConfig = {
  maxActiveInvasions: 2,
  invasionLifetimeMs: 30_000,
  sceneStepBaseDelayMs: 850,
  sceneStepJitterMs: 550,
  archetypeCooldownMs: 12_000,
  channelCooldownMs: 6_000,
  helperInterventionDelayMs: 1_900,
  allowCrowdBeat: true,
  allowHelperBeat: true,
  allowPresenceTheater: true,
  allowTypingTheater: true,
  allowSocketMirror: true,
  allowNotificationMirror: true,
  allowTranscriptMirror: true,
  historyLimit: 120,
  dedupWindowMs: 2_500,
};

const DEFAULT_NPC_DIRECTOR_CONFIG: ChatRuntimeNpcDirectorConfig = {
  maxActivePlans: 6,
  ambientCadenceBaseMs: 5_800,
  ambientCadenceJitterMs: 2_300,
  helperCooldownMs: 7_500,
  haterCooldownMs: 6_000,
  ambientCooldownMs: 4_500,
  directReplyWindowMs: 12_000,
  idleHelperThresholdMs: 18_000,
  lowSignalAmbientThresholdMs: 12_000,
  helperInterventionDelayMs: 1_500,
  haterEscalationDelayMs: 1_200,
  allowAmbientNpc: true,
  allowHelpers: true,
  allowHaters: true,
  allowCrowdEcho: true,
  allowTypingTheater: true,
  allowPresenceTheater: true,
  allowNotificationMirror: true,
  allowTranscriptMirror: true,
  allowSocketMirror: true,
  allowInvasionEscalation: true,
  historyLimit: 180,
  dedupWindowMs: 1_200,
};

const DEFAULT_MODE_OVERLAY: Partial<ChatModeSnapshot> = {
  modeId: 'chat_default',
  modeFamily: 'unknown',
  screenId: 'unknown',
  isMounted: true,
  isPreRun: true,
  isInRun: false,
  isPostRun: false,
  isMultiplayer: false,
  isNegotiationWindow: false,
  isDealVisible: false,
  isSyndicateVisible: true,
  isLobbyVisible: true,
  allowGlobal: true,
  allowSyndicate: true,
  allowDealRoom: false,
  allowLobby: true,
  pressureTier: 'BUILDING',
  tickTier: 'STABLE',
  haterHeat: 0,
  negotiationUrgency: 0,
};

const DEFAULT_INVASION_RUNTIME: Partial<ChatInvasionRuntimeState> = {
  modeId: 'chat_default',
  screenId: 'unknown',
  pressureTier: 'BUILDING',
  tickTier: 'STABLE',
  haterHeat: 0,
  isNegotiationWindow: false,
  isPreRun: true,
  isPostRun: false,
};

export const DEFAULT_CHAT_RUNTIME_CONFIG: ChatRuntimeConfig = deepFreeze({
  meta: {
    preset: 'DEFAULT',
    environment: 'production',
    scaleProfile: 'SOLO_RUN',
    modeFamily: 'UNKNOWN',
    version: VERSION,
    createdAt: nowIso(),
    notes: [
      'Canonical frontend chat runtime baseline.',
      'Preserves local-first responsiveness while keeping server authority doctrine visible.',
    ],
    tags: ['frontend', 'chat', 'runtime', 'default'],
  },
  controllers: { ...DEFAULT_CONTROLLER_TOGGLES },
  attention: { ...DEFAULT_ATTENTION_POLICY },
  transcriptPolicy: { ...DEFAULT_TRANSCRIPT_POLICY },
  transportPolicy: { ...DEFAULT_TRANSPORT_POLICY },
  socket: clone(DEFAULT_SOCKET_CONFIG),
  presence: clone(DEFAULT_PRESENCE_CONFIG),
  typing: clone(DEFAULT_TYPING_CONFIG),
  notification: clone(DEFAULT_NOTIFICATION_CONFIG),
  transcript: clone(DEFAULT_TRANSCRIPT_CONFIG),
  privacy: clone(DEFAULT_PRIVACY_CONFIG),
  channelPolicy: clone(DEFAULT_CHANNEL_POLICY_CONFIG),
  invasion: clone(DEFAULT_INVASION_CONFIG),
  npcDirector: clone(DEFAULT_NPC_DIRECTOR_CONFIG),
  mode: clone(DEFAULT_MODE_OVERLAY),
  invasionRuntime: clone(DEFAULT_INVASION_RUNTIME),
});

const PRESET_DEFAULT: ChatRuntimePreset = {
  name: 'DEFAULT',
  importance: 'CRITICAL',
  summary: 'Baseline unified chat runtime for canonical engine wiring.',
  config: {},
};

const PRESET_BATTLEHUD: ChatRuntimePreset = {
  name: 'BATTLEHUD',
  importance: 'CRITICAL',
  summary: 'High-pressure run HUD with faster typing theater and invasion intensity.',
  config: {
    meta: {
      preset: 'BATTLEHUD',
      scaleProfile: 'MATCHED_ROOM',
      modeFamily: 'BATTLE',
      tags: ['battle', 'hud', 'pressure'],
    },
    mode: {
      modeFamily: 'battle',
      screenId: 'BattleHUD',
      isPreRun: false,
      isInRun: true,
      allowDealRoom: false,
      allowLobby: false,
      pressureTier: 'HIGH',
      tickTier: 'BUILDING',
      haterHeat: 45,
    },
    invasionRuntime: {
      screenId: 'BattleHUD',
      isPreRun: false,
      pressureTier: 'HIGH',
      haterHeat: 45,
    },
    typing: {
      globalPolicy: {
        debounceStartMs: 140,
        refreshPulseMs: 1_250,
        idleStopMs: 4_000,
      },
    },
    invasion: {
      maxActiveInvasions: 3,
      archetypeCooldownMs: 8_500,
      helperInterventionDelayMs: 1_400,
    },
    npcDirector: {
      ambientCadenceBaseMs: 4_800,
      haterCooldownMs: 5_000,
      helperCooldownMs: 6_500,
    },
    channelPolicy: {
      allowLobbyInRun: false,
      tacticalEscalationHeatThreshold: 58,
    },
  },
};

const PRESET_LOBBY: ChatRuntimePreset = {
  name: 'LOBBY',
  importance: 'HIGH',
  summary: 'Pre-run and queue-space social foyer with lighter pressure and richer ambient chatter.',
  config: {
    meta: {
      preset: 'LOBBY',
      scaleProfile: 'SMALL_ROOM',
      modeFamily: 'LOBBY',
      tags: ['lobby', 'foyer', 'ambient'],
    },
    mode: {
      modeFamily: 'lobby',
      screenId: 'LobbyScreen',
      isPreRun: true,
      isInRun: false,
      isPostRun: false,
      allowGlobal: true,
      allowSyndicate: true,
      allowLobby: true,
      allowDealRoom: false,
      isLobbyVisible: true,
      haterHeat: 8,
    },
    invasionRuntime: {
      screenId: 'LobbyScreen',
      isPreRun: true,
      haterHeat: 8,
    },
    notification: {
      browserSeverityFloor: 'CRITICAL',
      activeChannelBannerSeverityFloor: 'WARN',
    },
    invasion: {
      maxActiveInvasions: 1,
      allowCrowdBeat: true,
      allowHelperBeat: false,
      archetypeCooldownMs: 18_000,
    },
    npcDirector: {
      ambientCadenceBaseMs: 4_200,
      ambientCadenceJitterMs: 1_800,
      allowAmbientNpc: true,
      allowHaters: true,
      allowHelpers: true,
      helperCooldownMs: 6_000,
      haterCooldownMs: 9_500,
    },
  },
};

const PRESET_EMPIRE: ChatRuntimePreset = {
  name: 'EMPIRE',
  importance: 'HIGH',
  summary: 'Empire screen with strategic ambient messaging and lighter invasion volume.',
  config: {
    meta: {
      preset: 'EMPIRE',
      scaleProfile: 'SOLO_RUN',
      modeFamily: 'RUN',
      tags: ['empire', 'strategy'],
    },
    mode: {
      modeFamily: 'run',
      screenId: 'EmpireGameScreen',
      isPreRun: false,
      isInRun: true,
      allowLobby: false,
      allowDealRoom: false,
      haterHeat: 25,
    },
    invasionRuntime: {
      screenId: 'EmpireGameScreen',
      isPreRun: false,
      haterHeat: 25,
    },
    invasion: {
      maxActiveInvasions: 2,
      channelCooldownMs: 7_500,
    },
    npcDirector: {
      ambientCadenceBaseMs: 5_400,
      helperCooldownMs: 8_400,
      haterCooldownMs: 6_900,
    },
  },
};

const PRESET_LEAGUE: ChatRuntimePreset = {
  name: 'LEAGUE',
  importance: 'HIGH',
  summary: 'League surface with spectator pressure and higher global theater.',
  config: {
    meta: {
      preset: 'LEAGUE',
      scaleProfile: 'MATCHED_ROOM',
      modeFamily: 'RUN',
      tags: ['league', 'spectator', 'global'],
    },
    mode: {
      modeFamily: 'run',
      screenId: 'LeagueUI',
      isPreRun: false,
      isInRun: true,
      allowGlobal: true,
      allowSyndicate: true,
      allowLobby: false,
      haterHeat: 38,
    },
    notification: {
      browserSeverityFloor: 'WARN',
      soundSeverityFloor: 'TACTICAL',
    },
    invasion: {
      maxActiveInvasions: 3,
      allowCrowdBeat: true,
      archetypeCooldownMs: 10_000,
    },
    npcDirector: {
      allowCrowdEcho: true,
      ambientCadenceBaseMs: 4_900,
      directReplyWindowMs: 10_500,
    },
  },
};

const PRESET_CLUB: ChatRuntimePreset = {
  name: 'CLUB',
  importance: 'MEDIUM',
  summary: 'Club/social surface with active foyer behavior and softer helper cadence.',
  config: {
    meta: {
      preset: 'CLUB',
      scaleProfile: 'SMALL_ROOM',
      modeFamily: 'LOBBY',
      tags: ['club', 'social', 'community'],
    },
    mode: {
      modeFamily: 'lobby',
      screenId: 'ClubUI',
      isPreRun: true,
      isInRun: false,
      allowLobby: true,
      allowGlobal: true,
      haterHeat: 12,
    },
    npcDirector: {
      ambientCadenceBaseMs: 3_900,
      ambientCadenceJitterMs: 1_400,
      helperCooldownMs: 5_000,
      haterCooldownMs: 10_000,
    },
    invasion: {
      maxActiveInvasions: 1,
      allowHelperBeat: false,
      allowCrowdBeat: true,
    },
  },
};

const PRESET_PREDATOR: ChatRuntimePreset = {
  name: 'PREDATOR',
  importance: 'CRITICAL',
  summary: 'Predator screen with aggressive hater posture and strong deal-room suppression.',
  config: {
    meta: {
      preset: 'PREDATOR',
      scaleProfile: 'MATCHED_ROOM',
      modeFamily: 'BATTLE',
      tags: ['predator', 'aggressive', 'hater'],
    },
    mode: {
      modeFamily: 'battle',
      screenId: 'PredatorGameScreen',
      isPreRun: false,
      isInRun: true,
      allowLobby: false,
      allowDealRoom: false,
      pressureTier: 'HIGH',
      tickTier: 'CRISIS',
      haterHeat: 70,
    },
    invasionRuntime: {
      screenId: 'PredatorGameScreen',
      pressureTier: 'HIGH',
      tickTier: 'CRISIS',
      haterHeat: 70,
    },
    invasion: {
      maxActiveInvasions: 3,
      archetypeCooldownMs: 7_200,
      helperInterventionDelayMs: 2_200,
    },
    npcDirector: {
      allowHaters: true,
      allowHelpers: true,
      haterCooldownMs: 4_400,
      helperCooldownMs: 8_800,
      ambientCadenceBaseMs: 6_200,
    },
  },
};

const PRESET_PHANTOM: ChatRuntimePreset = {
  name: 'PHANTOM',
  importance: 'HIGH',
  summary: 'Phantom surface with quieter presence theater and stealthier ambients.',
  config: {
    meta: {
      preset: 'PHANTOM',
      scaleProfile: 'MATCHED_ROOM',
      modeFamily: 'RUN',
      tags: ['phantom', 'stealth', 'quiet'],
    },
    mode: {
      modeFamily: 'run',
      screenId: 'PhantomGameScreen',
      isPreRun: false,
      isInRun: true,
      haterHeat: 28,
    },
    typing: {
      globalPolicy: {
        debounceStartMs: 240,
        refreshPulseMs: 1_900,
      },
      dealRoomPolicy: {
        debounceStartMs: 520,
        refreshPulseMs: 2_400,
      },
    },
    npcDirector: {
      ambientCadenceBaseMs: 6_900,
      ambientCadenceJitterMs: 2_900,
      allowCrowdEcho: false,
    },
    invasion: {
      maxActiveInvasions: 2,
      allowCrowdBeat: false,
    },
  },
};

const PRESET_SYNDICATE: ChatRuntimePreset = {
  name: 'SYNDICATE',
  importance: 'CRITICAL',
  summary: 'Syndicate screen with intimate trust routing and tactical helper priority.',
  config: {
    meta: {
      preset: 'SYNDICATE',
      scaleProfile: 'SMALL_ROOM',
      modeFamily: 'SYNDICATE',
      tags: ['syndicate', 'trust', 'tactical'],
    },
    mode: {
      modeFamily: 'syndicate',
      screenId: 'SyndicateGameScreen',
      isPreRun: false,
      isInRun: true,
      allowGlobal: true,
      allowSyndicate: true,
      allowLobby: false,
      isSyndicateVisible: true,
      haterHeat: 22,
    },
    channelPolicy: {
      allowSyndicateReadOnlyWithoutMembership: false,
      tacticalEscalationHeatThreshold: 52,
    },
    npcDirector: {
      helperCooldownMs: 5_500,
      haterCooldownMs: 9_500,
      allowHelpers: true,
      allowCrowdEcho: false,
      directReplyWindowMs: 14_000,
    },
    invasion: {
      maxActiveInvasions: 2,
      allowCrowdBeat: false,
      allowHelperBeat: true,
      channelCooldownMs: 7_000,
    },
  },
};

const PRESET_DEALROOM_NEGOTIATION: ChatRuntimePreset = {
  name: 'DEALROOM_NEGOTIATION',
  importance: 'CRITICAL',
  summary: 'Deal Room negotiation preset with predatory quiet, proof gravity, and reroute discipline.',
  config: {
    meta: {
      preset: 'DEALROOM_NEGOTIATION',
      scaleProfile: 'SMALL_ROOM',
      modeFamily: 'DEAL',
      tags: ['dealroom', 'negotiation', 'proof'],
    },
    mode: {
      modeFamily: 'deal',
      screenId: 'DealRoom',
      isPreRun: false,
      isInRun: true,
      isNegotiationWindow: true,
      isDealVisible: true,
      allowDealRoom: true,
      allowLobby: false,
      negotiationUrgency: 62,
      haterHeat: 34,
    },
    invasionRuntime: {
      screenId: 'DealRoom',
      isNegotiationWindow: true,
      dealId: 'active',
      haterHeat: 34,
    },
    privacy: {
      allowDealRoomUrls: true,
      allowDealRoomProofHashes: true,
      allowDealRoomPartialBankingIdentifiers: true,
      allowSyndicatePartialIdentifiers: true,
    },
    channelPolicy: {
      preferDealRoomForProofHashes: true,
      negotiationEscalationUrgencyThreshold: 48,
    },
    typing: {
      dealRoomPolicy: {
        debounceStartMs: 480,
        refreshPulseMs: 2_300,
        idleStopMs: 5_900,
        cooldownMs: 1_500,
      },
    },
    invasion: {
      maxActiveInvasions: 2,
      allowCrowdBeat: false,
      allowHelperBeat: true,
      helperInterventionDelayMs: 2_100,
    },
    npcDirector: {
      allowAmbientNpc: false,
      allowHelpers: true,
      allowHaters: true,
      allowCrowdEcho: false,
      haterEscalationDelayMs: 900,
      helperInterventionDelayMs: 1_900,
    },
  },
};

const PRESET_POSTRUN: ChatRuntimePreset = {
  name: 'POSTRUN',
  importance: 'HIGH',
  summary: 'Post-run decompression and witness lane with lighter transport urgency and stronger transcript retention.',
  config: {
    meta: {
      preset: 'POSTRUN',
      scaleProfile: 'SOLO_RUN',
      modeFamily: 'POSTRUN',
      tags: ['postrun', 'debrief', 'witness'],
    },
    mode: {
      modeFamily: 'postrun',
      screenId: 'PostRun',
      isPreRun: false,
      isInRun: false,
      isPostRun: true,
      allowLobby: true,
      allowDealRoom: false,
      haterHeat: 15,
    },
    invasionRuntime: {
      screenId: 'PostRun',
      isPostRun: true,
      isPreRun: false,
      haterHeat: 15,
    },
    transcript: {
      maxDrawerSearchScan: 5_000,
      proofRetentionFloor: 90,
    },
    invasion: {
      maxActiveInvasions: 1,
      allowCrowdBeat: true,
      allowHelperBeat: true,
      archetypeCooldownMs: 20_000,
    },
    npcDirector: {
      ambientCadenceBaseMs: 4_700,
      allowHelpers: true,
      allowHaters: true,
      allowCrowdEcho: true,
      directReplyWindowMs: 18_000,
    },
  },
};

const PRESET_OFFLINE_SAFE: ChatRuntimePreset = {
  name: 'OFFLINE_SAFE',
  importance: 'HIGH',
  summary: 'Offline-tolerant preset for local development or temporary transport degradation.',
  config: {
    meta: {
      preset: 'OFFLINE_SAFE',
      environment: 'offline',
      scaleProfile: 'DEGRADED_NETWORK',
      modeFamily: 'UNKNOWN',
      tags: ['offline', 'safe', 'local'],
    },
    attention: {
      allowBrowser: false,
      allowSounds: false,
      allowTitleBadge: true,
      activeChannelBannerSeverityFloor: 'WARN',
      browserSeverityFloor: 'CRITICAL',
      soundSeverityFloor: 'CRITICAL',
    },
    socket: {
      autoConnect: false,
      maxReconnectAttempts: 2,
      reconnectBaseDelayMs: 1_500,
      reconnectMaxDelayMs: 3_000,
      metricsFlushIntervalMs: 60_000,
    },
    notification: {
      allowBrowserNotifications: false,
      allowSounds: false,
      browserMaxPerMinute: 0,
    },
    invasion: {
      allowSocketMirror: false,
      allowNotificationMirror: true,
    },
    npcDirector: {
      allowSocketMirror: false,
      allowNotificationMirror: false,
    },
  },
};

const PRESET_LOW_BANDWIDTH: ChatRuntimePreset = {
  name: 'LOW_BANDWIDTH',
  importance: 'HIGH',
  summary: 'Reduced network and browser attention footprint while preserving critical chat behavior.',
  config: {
    meta: {
      preset: 'LOW_BANDWIDTH',
      scaleProfile: 'DEGRADED_NETWORK',
      modeFamily: 'UNKNOWN',
      tags: ['low-bandwidth', 'degraded'],
    },
    socket: {
      heartbeatIntervalMs: 15_000,
      heartbeatTimeoutMs: 35_000,
      metricsFlushIntervalMs: 45_000,
      dedupCacheSize: 768,
    },
    presence: {
      remoteOfflineAfterMs: 180_000,
      stripParticipantLimit: 8,
    },
    notification: {
      browserMaxPerMinute: 2,
      bannerMaxVisible: 2,
    },
    transcript: {
      maxWindowPerChannel: 320,
      maxDrawerSearchScan: 1_500,
    },
    invasion: {
      allowTypingTheater: false,
      allowPresenceTheater: true,
      sceneStepBaseDelayMs: 950,
    },
    npcDirector: {
      allowTypingTheater: false,
      allowPresenceTheater: true,
      ambientCadenceBaseMs: 6_700,
      ambientCadenceJitterMs: 2_700,
    },
  },
};

const PRESET_REPLAY_FORENSIC: ChatRuntimePreset = {
  name: 'REPLAY_FORENSIC',
  importance: 'MEDIUM',
  summary: 'Replay- and transcript-heavy analysis preset for drawer, search, and proof review.',
  config: {
    meta: {
      preset: 'REPLAY_FORENSIC',
      scaleProfile: 'LOCAL_DEV',
      modeFamily: 'REPLAY',
      tags: ['replay', 'forensic', 'proof'],
    },
    mode: {
      modeFamily: 'replay',
      screenId: 'ReplayViewer',
      isPreRun: false,
      isInRun: false,
      isPostRun: true,
      allowLobby: true,
      allowGlobal: true,
      allowSyndicate: true,
      allowDealRoom: true,
    },
    transcript: {
      maxWindowPerChannel: 900,
      maxDrawerSearchScan: 12_000,
      replayMergeLimit: 900,
      proofRetentionFloor: 140,
    },
    notification: {
      allowBrowserNotifications: false,
      allowSounds: false,
      allowTitleBadge: false,
    },
    invasion: {
      maxActiveInvasions: 0,
      allowCrowdBeat: false,
      allowHelperBeat: false,
      allowPresenceTheater: false,
      allowTypingTheater: false,
      allowNotificationMirror: false,
    },
    npcDirector: {
      allowAmbientNpc: false,
      allowHelpers: false,
      allowHaters: false,
      allowCrowdEcho: false,
      allowTypingTheater: false,
      allowPresenceTheater: false,
      allowNotificationMirror: false,
    },
  },
};

export const CHAT_RUNTIME_PRESETS: Record<ChatRuntimePresetName, ChatRuntimePreset> = {
  DEFAULT: PRESET_DEFAULT,
  BATTLEHUD: PRESET_BATTLEHUD,
  LOBBY: PRESET_LOBBY,
  EMPIRE: PRESET_EMPIRE,
  LEAGUE: PRESET_LEAGUE,
  CLUB: PRESET_CLUB,
  PREDATOR: PRESET_PREDATOR,
  PHANTOM: PRESET_PHANTOM,
  SYNDICATE: PRESET_SYNDICATE,
  DEALROOM_NEGOTIATION: PRESET_DEALROOM_NEGOTIATION,
  POSTRUN: PRESET_POSTRUN,
  OFFLINE_SAFE: PRESET_OFFLINE_SAFE,
  LOW_BANDWIDTH: PRESET_LOW_BANDWIDTH,
  REPLAY_FORENSIC: PRESET_REPLAY_FORENSIC,
};

export const CHAT_SCREEN_PRESET_MAP: Record<string, ChatRuntimePresetName> = {
  BattleHUD: 'BATTLEHUD',
  LobbyScreen: 'LOBBY',
  EmpireGameScreen: 'EMPIRE',
  LeagueUI: 'LEAGUE',
  ClubUI: 'CLUB',
  PredatorGameScreen: 'PREDATOR',
  PhantomGameScreen: 'PHANTOM',
  SyndicateGameScreen: 'SYNDICATE',
  DealRoom: 'DEALROOM_NEGOTIATION',
  PostRun: 'POSTRUN',
  ReplayViewer: 'REPLAY_FORENSIC',
};

export const CHAT_MODE_FAMILY_PRESET_MAP: Record<string, ChatRuntimePresetName> = {
  lobby: 'LOBBY',
  battle: 'BATTLEHUD',
  run: 'EMPIRE',
  syndicate: 'SYNDICATE',
  deal: 'DEALROOM_NEGOTIATION',
  postrun: 'POSTRUN',
  replay: 'REPLAY_FORENSIC',
};

function nowIso(): string {
  return new Date().toISOString();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function clone<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => clone(item)) as T;
  }
  if (value instanceof Map) {
    return new Map(
      [...value.entries()].map(([key, entry]) => [clone(key), clone(entry)]),
    ) as T;
  }
  if (value instanceof Set) {
    return new Set([...value.values()].map((entry) => clone(entry))) as T;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = clone(entry as never);
    }
    return out as T;
  }
  return value;
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const item of value) deepFreeze(item);
    return Object.freeze(value);
  }
  if (isPlainObject(value)) {
    for (const entry of Object.values(value)) {
      deepFreeze(entry as never);
    }
    return Object.freeze(value);
  }
  return value;
}

function mergeArrays<T>(base: T[] | undefined, patch: T[] | undefined): T[] | undefined {
  if (!patch) return base ? [...base] : undefined;
  return [...patch];
}

function deepMerge<T>(base: T, patch?: DeepPartial<T>): T {
  if (patch === undefined) return clone(base);
  if (Array.isArray(base) && Array.isArray(patch)) {
    return [...patch] as T;
  }
  if (isPlainObject(base) && isPlainObject(patch)) {
    const out: Record<string, unknown> = {};
    const patchRecord = patch as Record<string, unknown>;
    const keys = new Set([...Object.keys(base), ...Object.keys(patchRecord)]);
    for (const key of keys) {
      const baseValue = (base as Record<string, unknown>)[key];
      const patchValue = patchRecord[key];
      if (patchValue === undefined) {
        out[key] = clone(baseValue);
        continue;
      }
      if (Array.isArray(baseValue) && Array.isArray(patchValue)) {
        out[key] = [...patchValue];
        continue;
      }
      if (isPlainObject(baseValue) && isPlainObject(patchValue)) {
        out[key] = deepMerge(baseValue, patchValue as never);
        continue;
      }
      out[key] = clone(patchValue as never);
    }
    return out as T;
  }
  return clone(patch as T);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function ensureChannels(): ChatChannel[] {
  return [...CHANNELS];
}

function sanitizeMeta(meta: ChatRuntimeMeta): ChatRuntimeMeta {
  return {
    ...meta,
    version: meta.version || VERSION,
    createdAt: meta.createdAt || nowIso(),
    notes: meta.notes ? [...meta.notes] : undefined,
    tags: meta.tags ? [...meta.tags] : undefined,
  };
}

function inferModeFamily(mode: Partial<ChatModeSnapshot>): ChatRuntimeModeFamily {
  const family = String(mode.modeFamily ?? '').toLowerCase();
  if (family === 'lobby') return 'LOBBY';
  if (family === 'battle') return 'BATTLE';
  if (family === 'run') return 'RUN';
  if (family === 'syndicate') return 'SYNDICATE';
  if (family === 'deal') return 'DEAL';
  if (family === 'postrun') return 'POSTRUN';
  if (family === 'replay') return 'REPLAY';
  return 'UNKNOWN';
}

function inferPresetByMode(mode: Partial<ChatModeSnapshot>): ChatRuntimePresetName {
  const screenId = String(mode.screenId ?? '');
  if (screenId && CHAT_SCREEN_PRESET_MAP[screenId]) {
    return CHAT_SCREEN_PRESET_MAP[screenId];
  }
  const family = String(mode.modeFamily ?? '').toLowerCase();
  if (family && CHAT_MODE_FAMILY_PRESET_MAP[family]) {
    return CHAT_MODE_FAMILY_PRESET_MAP[family];
  }
  if (mode.isNegotiationWindow || mode.allowDealRoom) return 'DEALROOM_NEGOTIATION';
  if (mode.isPostRun) return 'POSTRUN';
  if (mode.isPreRun && !mode.isInRun) return 'LOBBY';
  return 'DEFAULT';
}

function normalizeEnvironment(value?: ChatRuntimeEnvironment): ChatRuntimeEnvironment {
  switch (value) {
    case 'development':
    case 'staging':
    case 'production':
    case 'test':
    case 'offline':
      return value;
    default:
      return 'production';
  }
}

function normalizeScaleProfile(value?: ChatRuntimeScaleProfile): ChatRuntimeScaleProfile {
  switch (value) {
    case 'LOCAL_DEV':
    case 'SOLO_RUN':
    case 'SMALL_ROOM':
    case 'MATCHED_ROOM':
    case 'MEGA_ROOM':
    case 'DEGRADED_NETWORK':
      return value;
    default:
      return 'SOLO_RUN';
  }
}

function deriveAttentionPolicy(config: ChatRuntimeConfig): ChatRuntimeAttentionPolicy {
  return {
    allowBrowser: Boolean(config.notification.allowBrowserNotifications),
    allowSounds: Boolean(config.notification.allowSounds),
    allowTitleBadge: Boolean(config.notification.allowTitleBadge),
    activeChannelBannerSeverityFloor:
      config.notification.activeChannelBannerSeverityFloor ?? 'CRITICAL',
    browserSeverityFloor: config.notification.browserSeverityFloor ?? 'WARN',
    soundSeverityFloor: config.notification.soundSeverityFloor ?? 'TACTICAL',
  };
}

function deriveTranscriptPolicy(config: ChatRuntimeConfig): ChatRuntimeTranscriptPolicy {
  return {
    optimisticTimeoutMs: config.transcript.optimisticTimeoutMs ?? DEFAULT_TRANSCRIPT_POLICY.optimisticTimeoutMs,
    maxWindowPerChannel: config.transcript.maxWindowPerChannel ?? DEFAULT_TRANSCRIPT_POLICY.maxWindowPerChannel,
    replayMergeLimit: config.transcript.replayMergeLimit ?? DEFAULT_TRANSCRIPT_POLICY.replayMergeLimit,
    proofRetentionFloor: config.transcript.proofRetentionFloor ?? DEFAULT_TRANSCRIPT_POLICY.proofRetentionFloor,
    keepFailedMessages: config.transcript.keepFailedMessages ?? DEFAULT_TRANSCRIPT_POLICY.keepFailedMessages,
  };
}

function deriveTransportPolicy(config: ChatRuntimeConfig): ChatRuntimeTransportPolicy {
  return {
    heartbeatIntervalMs: config.socket.heartbeatIntervalMs ?? DEFAULT_TRANSPORT_POLICY.heartbeatIntervalMs,
    heartbeatTimeoutMs: config.socket.heartbeatTimeoutMs ?? DEFAULT_TRANSPORT_POLICY.heartbeatTimeoutMs,
    ackTimeoutMs: config.socket.ackTimeoutMs ?? DEFAULT_TRANSPORT_POLICY.ackTimeoutMs,
    replayRequestTimeoutMs: config.socket.replayRequestTimeoutMs ?? DEFAULT_TRANSPORT_POLICY.replayRequestTimeoutMs,
    maxReconnectAttempts: config.socket.maxReconnectAttempts ?? DEFAULT_TRANSPORT_POLICY.maxReconnectAttempts,
    reconnectBaseDelayMs: config.socket.reconnectBaseDelayMs ?? DEFAULT_TRANSPORT_POLICY.reconnectBaseDelayMs,
    reconnectMaxDelayMs: config.socket.reconnectMaxDelayMs ?? DEFAULT_TRANSPORT_POLICY.reconnectMaxDelayMs,
    outboundQueueLimit: config.socket.outboundQueueLimit ?? DEFAULT_TRANSPORT_POLICY.outboundQueueLimit,
  };
}

function applyDerivedPolicies(config: ChatRuntimeConfig): ChatRuntimeConfig {
  const next = clone(config);
  next.attention = deriveAttentionPolicy(next);
  next.transcriptPolicy = deriveTranscriptPolicy(next);
  next.transportPolicy = deriveTransportPolicy(next);
  return next;
}

export function createChatRuntimeConfig(
  input?: DeepPartial<ChatRuntimeConfig>,
): ChatRuntimeConfig {
  const merged = deepMerge(DEFAULT_CHAT_RUNTIME_CONFIG, input ?? {});
  merged.meta = sanitizeMeta({
    ...merged.meta,
    preset: merged.meta?.preset ?? inferPresetByMode((merged.mode ?? {}) as Partial<ChatModeSnapshot>),
    environment: normalizeEnvironment(merged.meta?.environment),
    scaleProfile: normalizeScaleProfile(merged.meta?.scaleProfile),
    modeFamily: merged.meta?.modeFamily ?? inferModeFamily((merged.mode ?? {}) as Partial<ChatModeSnapshot>),
    version: merged.meta?.version ?? VERSION,
    createdAt: merged.meta?.createdAt ?? nowIso(),
  });

  return applyDerivedPolicies(merged as ChatRuntimeConfig);
}

export function createChatRuntimeFromPreset(
  presetName: ChatRuntimePresetName,
  overrides?: DeepPartial<ChatRuntimeConfig>,
): ChatRuntimeConfig {
  const preset = CHAT_RUNTIME_PRESETS[presetName] ?? CHAT_RUNTIME_PRESETS.DEFAULT;
  const base = createChatRuntimeConfig(preset.config);
  const withOverrides = createChatRuntimeConfig(deepMerge(base, overrides ?? {}));
  withOverrides.meta.preset = presetName;
  if (!withOverrides.meta.tags?.includes(presetName.toLowerCase())) {
    withOverrides.meta.tags = [...(withOverrides.meta.tags ?? []), presetName.toLowerCase()];
  }
  return applyDerivedPolicies(withOverrides);
}

export function createChatRuntimeFromMode(
  mode: Partial<ChatModeSnapshot>,
  overrides?: DeepPartial<ChatRuntimeConfig>,
): ChatRuntimeConfig {
  const presetName = inferPresetByMode(mode);
  const presetConfig = createChatRuntimeFromPreset(presetName, overrides);
  return createChatRuntimeConfig({
    ...presetConfig,
    mode: deepMerge(presetConfig.mode, mode),
    invasionRuntime: {
      ...presetConfig.invasionRuntime,
      modeId: mode.modeId ?? presetConfig.invasionRuntime.modeId,
      screenId: mode.screenId ?? presetConfig.invasionRuntime.screenId,
      pressureTier: mode.pressureTier ?? presetConfig.invasionRuntime.pressureTier,
      tickTier: mode.tickTier ?? presetConfig.invasionRuntime.tickTier,
      haterHeat: mode.haterHeat ?? presetConfig.invasionRuntime.haterHeat,
      isNegotiationWindow:
        mode.isNegotiationWindow ?? presetConfig.invasionRuntime.isNegotiationWindow,
      isPreRun: mode.isPreRun ?? presetConfig.invasionRuntime.isPreRun,
      isPostRun: mode.isPostRun ?? presetConfig.invasionRuntime.isPostRun,
    },
    meta: {
      ...presetConfig.meta,
      preset: presetName,
      modeFamily: inferModeFamily(mode),
    },
  });
}

export function mergeChatRuntimeConfig(
  base: ChatRuntimeConfig,
  patch?: DeepPartial<ChatRuntimeConfig>,
): ChatRuntimeConfig {
  return createChatRuntimeConfig(deepMerge(base, patch ?? {}));
}

export function freezeChatRuntimeConfig(config: ChatRuntimeConfig): Readonly<ChatRuntimeConfig> {
  return deepFreeze(clone(config));
}

export function getChatRuntimeControllerBundle(
  config: ChatRuntimeConfig,
): ChatRuntimeControllerBundle {
  return {
    socket: clone(config.socket),
    presence: clone(config.presence),
    typing: clone(config.typing),
    notification: clone(config.notification),
    transcript: clone(config.transcript),
    privacy: clone(config.privacy),
    channelPolicy: clone(config.channelPolicy),
    invasion: clone(config.invasion),
    npcDirector: clone(config.npcDirector),
  };
}

export function summarizeChatRuntimeConfig(config: ChatRuntimeConfig): ChatRuntimeSummary {
  const activeControllers = Object.entries(config.controllers)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => key)
    .sort();

  return {
    preset: config.meta.preset,
    environment: config.meta.environment,
    scaleProfile: config.meta.scaleProfile,
    modeFamily: config.meta.modeFamily,
    activeControllers,
    socketEndpoint: config.socket.endpoint,
    globalVisibility: config.mode.allowGlobal ? 'enabled' : 'disabled',
    syndicateEnabled: Boolean(config.mode.allowSyndicate),
    dealRoomEnabled: Boolean(config.mode.allowDealRoom),
    invasionEnabled: Boolean(config.controllers.invasion),
    ambientNpcEnabled: Boolean(config.npcDirector.allowAmbientNpc),
    createdAt: config.meta.createdAt,
  };
}

export function buildLowBandwidthOverlay(): DeepPartial<ChatRuntimeConfig> {
  return clone(PRESET_LOW_BANDWIDTH.config);
}

export function buildOfflineOverlay(): DeepPartial<ChatRuntimeConfig> {
  return clone(PRESET_OFFLINE_SAFE.config);
}

export function buildReplayOverlay(): DeepPartial<ChatRuntimeConfig> {
  return clone(PRESET_REPLAY_FORENSIC.config);
}

export function withModeMetadata(
  config: ChatRuntimeConfig,
  mode: Partial<ChatModeSnapshot>,
): ChatRuntimeConfig {
  return createChatRuntimeConfig({
    ...config,
    mode: { ...config.mode, ...mode },
    invasionRuntime: {
      ...config.invasionRuntime,
      modeId: mode.modeId ?? config.invasionRuntime.modeId,
      screenId: mode.screenId ?? config.invasionRuntime.screenId,
      runId: mode.runId ?? config.invasionRuntime.runId,
      roomId: mode.roomId ?? config.invasionRuntime.roomId,
      dealId: mode.dealId ?? config.invasionRuntime.dealId,
      syndicateId: mode.syndicateId ?? config.invasionRuntime.syndicateId,
      pressureTier: mode.pressureTier ?? config.invasionRuntime.pressureTier,
      tickTier: mode.tickTier ?? config.invasionRuntime.tickTier,
      haterHeat: mode.haterHeat ?? config.invasionRuntime.haterHeat,
      isNegotiationWindow:
        mode.isNegotiationWindow ?? config.invasionRuntime.isNegotiationWindow,
      isPreRun: mode.isPreRun ?? config.invasionRuntime.isPreRun,
      isPostRun: mode.isPostRun ?? config.invasionRuntime.isPostRun,
      metadata: {
        ...(config.invasionRuntime.metadata ?? {}),
        screenId: mode.screenId,
        modeFamily: mode.modeFamily,
      },
    },
    meta: {
      ...config.meta,
      modeFamily: inferModeFamily(mode),
    },
  });
}

export function withSocketEndpoint(
  config: ChatRuntimeConfig,
  endpoint: string,
): ChatRuntimeConfig {
  return createChatRuntimeConfig({
    ...config,
    socket: {
      ...config.socket,
      endpoint,
    },
  });
}

export function withEnvironment(
  config: ChatRuntimeConfig,
  environment: ChatRuntimeEnvironment,
): ChatRuntimeConfig {
  const normalized = normalizeEnvironment(environment);
  const overlay = normalized === 'offline'
    ? buildOfflineOverlay()
    : normalized === 'test'
      ? buildReplayOverlay()
      : {};

  return createChatRuntimeConfig(deepMerge(config, {
    meta: {
      ...config.meta,
      environment: normalized,
    },
    ...(overlay as DeepPartial<ChatRuntimeConfig>),
  }));
}

export function withScaleProfile(
  config: ChatRuntimeConfig,
  scaleProfile: ChatRuntimeScaleProfile,
): ChatRuntimeConfig {
  const normalized = normalizeScaleProfile(scaleProfile);

  const overlay: DeepPartial<ChatRuntimeConfig> = {};

  switch (normalized) {
    case 'LOCAL_DEV':
      overlay.socket = {
        autoConnect: false,
        maxReconnectAttempts: 2,
      };
      overlay.notification = {
        allowBrowserNotifications: false,
        allowSounds: false,
      };
      break;
    case 'SOLO_RUN':
      overlay.socket = {
        outboundQueueLimit: 400,
      };
      overlay.presence = {
        stripParticipantLimit: 8,
      };
      break;
    case 'SMALL_ROOM':
      overlay.socket = {
        outboundQueueLimit: 450,
      };
      overlay.presence = {
        stripParticipantLimit: 10,
      };
      break;
    case 'MATCHED_ROOM':
      overlay.socket = {
        outboundQueueLimit: 520,
      };
      overlay.presence = {
        stripParticipantLimit: 12,
      };
      break;
    case 'MEGA_ROOM':
      overlay.socket = {
        outboundQueueLimit: 700,
        dedupCacheSize: 2_048,
      };
      overlay.presence = {
        stripParticipantLimit: 14,
        remoteOfflineAfterMs: 150_000,
      };
      overlay.notification = {
        browserMaxPerMinute: 3,
      };
      break;
    case 'DEGRADED_NETWORK':
      return createChatRuntimeConfig(deepMerge(config, {
        meta: { ...config.meta, scaleProfile: normalized },
        ...(buildLowBandwidthOverlay() as DeepPartial<ChatRuntimeConfig>),
      }));
    default:
      break;
  }

  return createChatRuntimeConfig(deepMerge(config, {
    meta: {
      ...config.meta,
      scaleProfile: normalized,
    },
    ...overlay,
  }));
}

export function setControllerEnabled(
  config: ChatRuntimeConfig,
  controller: keyof ChatRuntimeControllerToggles,
  enabled: boolean,
): ChatRuntimeConfig {
  return createChatRuntimeConfig({
    ...config,
    controllers: {
      ...config.controllers,
      [controller]: enabled,
    },
  });
}

export function enableReplayHeavyMode(config: ChatRuntimeConfig): ChatRuntimeConfig {
  return createChatRuntimeConfig(deepMerge(config, buildReplayOverlay()));
}

export function enableLowBandwidthMode(config: ChatRuntimeConfig): ChatRuntimeConfig {
  return createChatRuntimeConfig(deepMerge(config, buildLowBandwidthOverlay()));
}

export function enableOfflineSafeMode(config: ChatRuntimeConfig): ChatRuntimeConfig {
  return createChatRuntimeConfig(deepMerge(config, buildOfflineOverlay()));
}

export function hasControllerEnabled(
  config: ChatRuntimeConfig,
  controller: keyof ChatRuntimeControllerToggles,
): boolean {
  return Boolean(config.controllers[controller]);
}

export function getRecommendedPresetForScreen(
  screenId: string,
): ChatRuntimePresetName {
  return CHAT_SCREEN_PRESET_MAP[screenId] ?? 'DEFAULT';
}

export function getRecommendedPresetForMode(
  mode: Partial<ChatModeSnapshot>,
): ChatRuntimePresetName {
  return inferPresetByMode(mode);
}

export function listChatRuntimePresets(): ChatRuntimePreset[] {
  return Object.values(CHAT_RUNTIME_PRESETS).map((preset) => ({
    name: preset.name,
    importance: preset.importance,
    summary: preset.summary,
    config: clone(preset.config),
  }));
}

export function sanitizeSocketEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim();
  if (!trimmed) return DEFAULT_SOCKET_CONFIG.endpoint;
  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) return trimmed;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;
  return `/${trimmed.replace(/^\/+/, '')}`;
}

export function isDealRoomRuntime(config: ChatRuntimeConfig): boolean {
  return Boolean(config.mode.allowDealRoom || config.mode.isNegotiationWindow);
}

export function isSyndicateRuntime(config: ChatRuntimeConfig): boolean {
  return Boolean(config.mode.allowSyndicate && config.mode.isSyndicateVisible);
}

export function isLobbyRuntime(config: ChatRuntimeConfig): boolean {
  return Boolean(config.mode.allowLobby && config.mode.isLobbyVisible);
}

export function shouldAllowAmbientNpc(config: ChatRuntimeConfig): boolean {
  return Boolean(config.controllers.npc && config.npcDirector.allowAmbientNpc);
}

export function shouldAllowInvasionTyping(config: ChatRuntimeConfig): boolean {
  return Boolean(config.controllers.invasion && config.invasion.allowTypingTheater);
}

export function shouldAllowNpcTyping(config: ChatRuntimeConfig): boolean {
  return Boolean(config.controllers.npc && config.npcDirector.allowTypingTheater);
}

export function getChannelStartupOrder(config: ChatRuntimeConfig): ChatChannel[] {
  const order: ChatChannel[] = [];

  if (config.mode.allowGlobal) order.push('GLOBAL');
  if (config.mode.allowSyndicate) order.push('SYNDICATE');
  if (config.mode.allowDealRoom) order.push('DEAL_ROOM');
  if (config.mode.allowLobby) order.push('LOBBY');

  if (order.length === 0) return ensureChannels();
  return dedupeChannels(order);
}

export function getPreferredAmbientChannel(config: ChatRuntimeConfig): ChatChannel {
  if (config.mode.allowLobby && config.mode.isPreRun) return 'LOBBY';
  if (config.mode.allowSyndicate && config.mode.isSyndicateVisible) return 'SYNDICATE';
  if (config.mode.allowGlobal) return 'GLOBAL';
  if (config.mode.allowDealRoom) return 'DEAL_ROOM';
  return 'GLOBAL';
}

export function getPreferredTacticalChannel(config: ChatRuntimeConfig): ChatChannel {
  if (config.mode.allowSyndicate && config.mode.isSyndicateVisible) return 'SYNDICATE';
  if (config.mode.allowDealRoom && config.mode.isNegotiationWindow) return 'DEAL_ROOM';
  return 'GLOBAL';
}

export function getPreferredPredatoryChannel(config: ChatRuntimeConfig): ChatChannel {
  if (config.mode.allowDealRoom && config.mode.isNegotiationWindow) return 'DEAL_ROOM';
  if (config.mode.allowGlobal) return 'GLOBAL';
  return 'SYNDICATE';
}

export function ensureRuntimePolicyBounds(config: ChatRuntimeConfig): ChatRuntimeConfig {
  const next = clone(config);

  next.socket.maxReconnectAttempts = clamp(next.socket.maxReconnectAttempts ?? 10, 0, 120);
  next.socket.outboundQueueLimit = clamp(next.socket.outboundQueueLimit ?? 500, 50, 10_000);
  next.socket.ackTimeoutMs = clamp(next.socket.ackTimeoutMs ?? 8_000, 500, 120_000);
  next.presence.stripParticipantLimit = clamp(next.presence.stripParticipantLimit ?? 12, 1, 30);
  next.notification.browserMaxPerMinute = clamp(next.notification.browserMaxPerMinute ?? 6, 0, 120);
  next.transcript.maxWindowPerChannel = clamp(next.transcript.maxWindowPerChannel ?? 500, 50, 5_000);
  next.transcript.proofRetentionFloor = clamp(next.transcript.proofRetentionFloor ?? 50, 0, next.transcript.maxWindowPerChannel ?? 500);
  next.invasion.maxActiveInvasions = clamp(next.invasion.maxActiveInvasions ?? 2, 0, 12);
  next.npcDirector.maxActivePlans = clamp(next.npcDirector.maxActivePlans ?? 6, 0, 30);

  return createChatRuntimeConfig(next);
}

export function attachRuntimeNotes(
  config: ChatRuntimeConfig,
  notes: string[],
): ChatRuntimeConfig {
  const mergedNotes = dedupeStrings([...(config.meta.notes ?? []), ...notes]);
  return createChatRuntimeConfig({
    ...config,
    meta: {
      ...config.meta,
      notes: mergedNotes,
    },
  });
}

export function attachRuntimeTags(
  config: ChatRuntimeConfig,
  tags: string[],
): ChatRuntimeConfig {
  const mergedTags = dedupeStrings([...(config.meta.tags ?? []), ...tags]);
  return createChatRuntimeConfig({
    ...config,
    meta: {
      ...config.meta,
      tags: mergedTags,
    },
  });
}

export function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean).map((entry) => entry.trim()).filter(Boolean))];
}

function dedupeChannels(values: ChatChannel[]): ChatChannel[] {
  return [...new Set(values)];
}

export function stableRuntimeHash(config: ChatRuntimeConfig): string {
  const canonical = stableStringify({
    meta: {
      ...config.meta,
      createdAt: '__normalized__',
    },
    controllers: config.controllers,
    attention: config.attention,
    transcriptPolicy: config.transcriptPolicy,
    transportPolicy: config.transportPolicy,
    socket: config.socket,
    presence: config.presence,
    typing: config.typing,
    notification: config.notification,
    transcript: config.transcript,
    privacy: config.privacy,
    channelPolicy: config.channelPolicy,
    invasion: config.invasion,
    npcDirector: config.npcDirector,
    mode: config.mode,
    invasionRuntime: config.invasionRuntime,
  });

  let hash = 0;
  for (let index = 0; index < canonical.length; index += 1) {
    hash = ((hash << 5) - hash) + canonical.charCodeAt(index);
    hash |= 0;
  }
  return `chatrt_${Math.abs(hash).toString(36)}`;
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`).join(',')}}`;
}

export function createDebugRuntimePreset(): ChatRuntimeConfig {
  return attachRuntimeTags(
    attachRuntimeNotes(
      createChatRuntimeConfig({
        meta: {
          environment: 'development',
          scaleProfile: 'LOCAL_DEV',
        },
        socket: {
          autoConnect: false,
          metricsFlushIntervalMs: 5_000,
        },
        notification: {
          allowBrowserNotifications: false,
        },
        invasion: {
          allowNotificationMirror: false,
        },
      }),
      ['Debug-friendly runtime with reduced transport side effects.'],
    ),
    ['debug', 'developer'],
  );
}

export function createProductionBattleRuntime(
  screenId: string = 'BattleHUD',
): ChatRuntimeConfig {
  return withModeMetadata(
    createChatRuntimeFromPreset('BATTLEHUD'),
    {
      screenId,
      modeFamily: 'battle',
      isPreRun: false,
      isInRun: true,
      allowLobby: false,
    },
  );
}

export function createNegotiationRuntime(
  dealId: string,
  urgency: number = 60,
): ChatRuntimeConfig {
  return withModeMetadata(
    createChatRuntimeFromPreset('DEALROOM_NEGOTIATION'),
    {
      dealId,
      modeFamily: 'deal',
      isNegotiationWindow: true,
      allowDealRoom: true,
      negotiationUrgency: urgency,
    },
  );
}

export function createSyndicateRuntime(
  syndicateId: string,
): ChatRuntimeConfig {
  return withModeMetadata(
    createChatRuntimeFromPreset('SYNDICATE'),
    {
      syndicateId,
      modeFamily: 'syndicate',
      isSyndicateVisible: true,
      allowSyndicate: true,
    },
  );
}

export function createPostRunRuntime(
  outcome: string,
): ChatRuntimeConfig {
  return withModeMetadata(
    createChatRuntimeFromPreset('POSTRUN'),
    {
      runOutcome: outcome,
      isPostRun: true,
      isInRun: false,
      isPreRun: false,
    },
  );
}

export function normalizeChatRuntimeConfig(
  input: ChatRuntimeConfig,
): ChatRuntimeConfig {
  return ensureRuntimePolicyBounds(createChatRuntimeConfig(input));
}

export function validateChatRuntimeConfig(config: ChatRuntimeConfig): string[] {
  const issues: string[] = [];

  if (!config.socket.endpoint) {
    issues.push('socket.endpoint is required');
  }
  if ((config.mode.allowDealRoom || config.mode.isNegotiationWindow) && !config.channelPolicy.preferDealRoomForProofHashes) {
    issues.push('Deal Room runtime should prefer proof hashes in Deal Room policy');
  }
  if (!config.controllers.privacy && config.controllers.channelPolicy) {
    issues.push('channelPolicy should not be enabled while privacy is disabled');
  }
  if (!config.controllers.transcript && (config.controllers.invasion || config.controllers.npc)) {
    issues.push('invasion/npc controllers expect transcript support for local staging');
  }
  if ((config.invasion.maxActiveInvasions ?? 0) === 0 && config.controllers.invasion) {
    issues.push('invasion controller enabled but maxActiveInvasions is zero');
  }
  if ((config.npcDirector.maxActivePlans ?? 0) === 0 && config.controllers.npc) {
    issues.push('npc controller enabled but maxActivePlans is zero');
  }
  if ((config.notification.browserMaxPerMinute ?? 0) === 0 && config.notification.allowBrowserNotifications) {
    issues.push('browser notifications enabled but browserMaxPerMinute is zero');
  }
  if ((config.transcript.maxWindowPerChannel ?? 0) < (config.transcript.proofRetentionFloor ?? 0)) {
    issues.push('transcript.proofRetentionFloor cannot exceed maxWindowPerChannel');
  }

  return issues;
}

export function assertValidChatRuntimeConfig(config: ChatRuntimeConfig): void {
  const issues = validateChatRuntimeConfig(config);
  if (issues.length === 0) return;
  throw new Error(`Invalid chat runtime config: ${issues.join('; ')}`);
}

