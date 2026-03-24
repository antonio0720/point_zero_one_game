/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT RUNTIME CONFIG
 * FILE: backend/src/game/engine/chat/ChatRuntimeConfig.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical runtime doctrine for the authoritative backend chat lane.
 *
 * This module answers a backend-truth question that must exist outside the
 * engine façade:
 *
 *   "What is chat allowed to be for this build, room, mount, mode, runtime
 *    posture, safety profile, and operational phase before any event enters the
 *    backend mutation path?"
 *
 * Architectural law
 * -----------------
 * - runtime configuration lives in backend authority, not in the UI shell;
 * - frontend may mirror or hint, but it does not define final chat law;
 * - server transport may read runtime rules, but it does not own them;
 * - reducer mutates state according to an already-decided runtime surface;
 * - moderation, channel, rate, command, proof, replay, learning, invasion,
 *   and NPC orchestration all depend on one merged authoritative config.
 *
 * Why this file is large
 * ----------------------
 * Your backend simulation tree makes ChatRuntimeConfig.ts a real ownership file,
 * not a tiny constant export. It must therefore do all of the following well:
 *
 * 1. define layered override sources,
 * 2. merge defaults without flattening nested policy structure,
 * 3. validate runtime safety and simulation invariants,
 * 4. derive room bootstrap posture from mount + room kind,
 * 5. expose diagnostics and explainability for policy drift,
 * 6. serialize and hydrate runtime state safely,
 * 7. support future extraction into shared/contracts/chat when appropriate,
 * 8. remain fully compilable while the larger tree is still landing.
 *
 * This file is intentionally deep because runtime doctrine is one of the load-
 * bearing centers of the backend chat authority lane.
 * ============================================================================
 */

import {
  BACKEND_CHAT_ENGINE_VERSION,
  CHAT_CHANNEL_DESCRIPTORS,
  CHAT_MOUNT_POLICIES,
  CHAT_ROOM_KINDS,
  CHAT_RUNTIME_DEFAULTS,
  type ChatChannelDescriptor,
  type ChatChannelId,
  type ChatInvasionPolicyConfig,
  type ChatLearningPolicyConfig,
  type ChatModerationPolicyConfig,
  type ChatMountPolicy,
  type ChatProofPolicyConfig,
  type ChatRatePolicyConfig,
  type ChatReplayPolicyConfig,
  type ChatRoomKind,
  type ChatRoomStageMood,
  type ChatRuntimeConfig,
  type ChatShadowChannel,
  type ChatVisibleChannel,
  type JsonValue,
  type UnixMs,
} from './types';

// ============================================================================
// MARK: Ports, options, diagnostics, and layering contracts
// ============================================================================

export interface ChatRuntimeConfigLoggerPort {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface ChatRuntimeBuildFlags {
  readonly allowExperimentalDramaLayer: boolean;
  readonly allowShadowChannels: boolean;
  readonly allowClientHints: boolean;
  readonly allowNegotiationEscalation: boolean;
  readonly allowLiveOpsRaids: boolean;
  readonly strictModeration: boolean;
  readonly lowLatencyReplayMode: boolean;
}

export interface ChatRuntimeSecurityProfile {
  readonly name: 'DEFAULT' | 'SAFE_LOBBY' | 'COMPETITIVE' | 'TOURNAMENT' | 'PRIVATE_REVIEW';
  readonly lockShadowWritesToBackendOnly: boolean;
  readonly disallowClientHints: boolean;
  readonly elevatedModeration: boolean;
  readonly restrictNegotiationExposure: boolean;
  readonly reduceReplayRetention: boolean;
}

export interface ChatRuntimeSourceTag {
  readonly source:
    | 'DEFAULTS'
    | 'BUILD'
    | 'ENVIRONMENT'
    | 'MATCH'
    | 'MODE'
    | 'MOUNT'
    | 'ROOM_KIND'
    | 'LIVEOPS'
    | 'OPERATOR'
    | 'TEST'
    | 'USER_OVERRIDE';
  readonly note: string;
}

export interface ChatRuntimeLayer {
  readonly tag: ChatRuntimeSourceTag;
  readonly config: Partial<ChatRuntimeConfig>;
}

export interface ChatRuntimeMergeTrace {
  readonly tags: readonly ChatRuntimeSourceTag[];
  readonly effectiveVisibleChannels: readonly ChatVisibleChannel[];
  readonly effectiveShadowChannels: readonly ChatShadowChannel[];
  readonly strictModeration: boolean;
  readonly learningEnabled: boolean;
  readonly proofEnabled: boolean;
  readonly invasionEnabled: boolean;
}

export interface ChatRuntimeValidationIssue {
  readonly severity: 'ERROR' | 'WARNING';
  readonly code: string;
  readonly message: string;
  readonly path: string;
}

export interface ChatRuntimeValidationResult {
  readonly ok: boolean;
  readonly issues: readonly ChatRuntimeValidationIssue[];
}

export interface ChatRuntimeDiagnostics {
  readonly version: typeof BACKEND_CHAT_ENGINE_VERSION;
  readonly presetName: ChatRuntimePresetName;
  readonly securityProfile: ChatRuntimeSecurityProfile['name'];
  readonly buildFlags: ChatRuntimeBuildFlags;
  readonly mergeTrace: ChatRuntimeMergeTrace;
  readonly validation: ChatRuntimeValidationResult;
}

export interface ChatRuntimeConfigOptions {
  readonly logger?: ChatRuntimeConfigLoggerPort;
  readonly buildFlags?: Partial<ChatRuntimeBuildFlags>;
  readonly securityProfile?: Partial<ChatRuntimeSecurityProfile>;
  readonly presetName?: ChatRuntimePresetName;
}

export interface ChatRuntimeContext {
  readonly logger: ChatRuntimeConfigLoggerPort;
  readonly buildFlags: ChatRuntimeBuildFlags;
  readonly securityProfile: ChatRuntimeSecurityProfile;
  readonly presetName: ChatRuntimePresetName;
}

export interface ChatRoomBootstrapPolicy {
  readonly roomKind: ChatRoomKind;
  readonly title: string;
  readonly stageMood: ChatRoomStageMood;
  readonly defaultVisibleChannel: ChatVisibleChannel;
  readonly allowedVisibleChannels: readonly ChatVisibleChannel[];
  readonly collapsed: boolean;
  readonly composerPlaceholder: string;
  readonly supportShadowWrites: boolean;
  readonly supportReplay: boolean;
}

export interface ChatMountRuntimeHints {
  readonly mountTarget: ChatMountPolicy['mountTarget'];
  readonly defaultVisibleChannel: ChatVisibleChannel;
  readonly allowedVisibleChannels: readonly ChatVisibleChannel[];
  readonly stageMood: ChatRoomStageMood;
  readonly defaultCollapsed: boolean;
  readonly defaultComposerPlaceholder: string;
}

export interface ChatRuntimeResolvedRoomPolicy {
  readonly runtime: ChatRuntimeConfig;
  readonly bootstrap: ChatRoomBootstrapPolicy;
  readonly diagnostics: ChatRuntimeDiagnostics;
}

export type ChatRuntimePresetName =
  | 'BALANCED'
  | 'SAFE_LOBBY'
  | 'TOURNAMENT'
  | 'CINEMATIC'
  | 'DEBUG_STRICT';

type MutableRuntimePartial = {
  -readonly [K in keyof ChatRuntimeConfig]?: ChatRuntimeConfig[K];
};

// ============================================================================
// MARK: No-op logger and base constants
// ============================================================================

const NOOP_LOGGER: ChatRuntimeConfigLoggerPort = {
  debug: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const DEFAULT_BUILD_FLAGS: Readonly<ChatRuntimeBuildFlags> = Object.freeze({
  allowExperimentalDramaLayer: true,
  allowShadowChannels: true,
  allowClientHints: false,
  allowNegotiationEscalation: true,
  allowLiveOpsRaids: true,
  strictModeration: false,
  lowLatencyReplayMode: false,
});

const DEFAULT_SECURITY_PROFILE: Readonly<ChatRuntimeSecurityProfile> = Object.freeze({
  name: 'DEFAULT',
  lockShadowWritesToBackendOnly: true,
  disallowClientHints: true,
  elevatedModeration: false,
  restrictNegotiationExposure: false,
  reduceReplayRetention: false,
});

// ============================================================================
// MARK: Preset layers
// ============================================================================

const PRESET_BALANCED: Readonly<Partial<ChatRuntimeConfig>> = Object.freeze({
  allowVisibleChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY'] as readonly ChatVisibleChannel[],
  allowShadowChannels: ['SYSTEM_SHADOW', 'NPC_SHADOW', 'RIVALRY_SHADOW', 'RESCUE_SHADOW', 'LIVEOPS_SHADOW'] as readonly ChatShadowChannel[],
  ratePolicy: {
    perSecondBurstLimit: 4,
    perMinuteLimit: 25,
    typingHeartbeatWindowMs: 6_000,
    identicalMessageWindowMs: 30_000,
    identicalMessageMaxCount: 2,
    npcMinimumGapMs: 1_800,
    helperMinimumGapMs: 5_500,
    haterMinimumGapMs: 7_500,
    invasionLockMs: 12_000,
  },
  moderationPolicy: {
    maxCharactersPerMessage: 480,
    maxLinesPerMessage: 8,
    maskBannedLexemes: ['idiot', 'loser', 'trash'],
    rejectBannedLexemes: ['kill yourself', 'dox', 'credit card number'],
    maxConsecutiveEmojiRuns: 8,
    maxSuspiciousUrlCount: 2,
    allowSlashCommands: true,
    rewriteAllCapsThreshold: 0.72,
    shadowModeOnHighRisk: true,
  },
  replayPolicy: {
    enabled: true,
    maxMessagesPerRoom: 4_000,
    maxReplayArtifactsPerRoom: 2_000,
    replayTimeWindowMs: 86_400_000,
  },
  learningPolicy: {
    enabled: true,
    updateOnEveryAcceptedMessage: true,
    coldStartEnabled: true,
    emitInferenceSnapshots: true,
    acceptClientHints: false,
    persistProfiles: true,
  },
  proofPolicy: {
    enabled: true,
    hashAlgorithm: 'FNV1A32' as const,
    linkModerationEdges: true,
    linkReplayEdges: true,
    linkLearningEdges: true,
  },
  invasionPolicy: {
    enabled: true,
    maxActivePerRoom: 1,
    minimumGapMs: 45_000,
    defaultDurationMs: 22_000,
    allowShadowPriming: true,
  },
});

const PRESET_SAFE_LOBBY: Readonly<Partial<ChatRuntimeConfig>> = Object.freeze({
  allowVisibleChannels: ['GLOBAL', 'LOBBY'] as readonly ChatVisibleChannel[],
  allowShadowChannels: ['SYSTEM_SHADOW', 'RESCUE_SHADOW'] as readonly ChatShadowChannel[],
  ratePolicy: {
    perSecondBurstLimit: 3,
    perMinuteLimit: 18,
    typingHeartbeatWindowMs: 6_000,
    identicalMessageWindowMs: 35_000,
    identicalMessageMaxCount: 2,
    npcMinimumGapMs: 2_200,
    helperMinimumGapMs: 4_500,
    haterMinimumGapMs: 11_000,
    invasionLockMs: 25_000,
  },
  moderationPolicy: {
    maxCharactersPerMessage: 320,
    maxLinesPerMessage: 6,
    maskBannedLexemes: ['idiot', 'loser', 'trash', 'stupid', 'pathetic'],
    rejectBannedLexemes: ['kill yourself', 'dox', 'credit card number', 'swat', 'address leak'],
    maxConsecutiveEmojiRuns: 5,
    maxSuspiciousUrlCount: 1,
    allowSlashCommands: true,
    rewriteAllCapsThreshold: 0.62,
    shadowModeOnHighRisk: true,
  },
  replayPolicy: {
    enabled: true,
    maxMessagesPerRoom: 2_000,
    maxReplayArtifactsPerRoom: 1_000,
    replayTimeWindowMs: 43_200_000,
  },
  learningPolicy: {
    enabled: true,
    updateOnEveryAcceptedMessage: true,
    coldStartEnabled: true,
    emitInferenceSnapshots: true,
    acceptClientHints: false,
    persistProfiles: true,
  },
  proofPolicy: {
    enabled: true,
    hashAlgorithm: 'FNV1A32' as const,
    linkModerationEdges: true,
    linkReplayEdges: true,
    linkLearningEdges: true,
  },
  invasionPolicy: {
    enabled: false,
    maxActivePerRoom: 0,
    minimumGapMs: 90_000,
    defaultDurationMs: 16_000,
    allowShadowPriming: false,
  },
});

const PRESET_TOURNAMENT: Readonly<Partial<ChatRuntimeConfig>> = Object.freeze({
  allowVisibleChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'] as readonly ChatVisibleChannel[],
  allowShadowChannels: ['SYSTEM_SHADOW', 'NPC_SHADOW', 'RIVALRY_SHADOW', 'LIVEOPS_SHADOW'] as readonly ChatShadowChannel[],
  ratePolicy: {
    perSecondBurstLimit: 5,
    perMinuteLimit: 20,
    typingHeartbeatWindowMs: 5_000,
    identicalMessageWindowMs: 20_000,
    identicalMessageMaxCount: 1,
    npcMinimumGapMs: 1_200,
    helperMinimumGapMs: 7_500,
    haterMinimumGapMs: 8_500,
    invasionLockMs: 15_000,
  },
  moderationPolicy: {
    maxCharactersPerMessage: 400,
    maxLinesPerMessage: 6,
    maskBannedLexemes: ['idiot', 'loser', 'trash'],
    rejectBannedLexemes: ['kill yourself', 'dox', 'credit card number'],
    maxConsecutiveEmojiRuns: 4,
    maxSuspiciousUrlCount: 0,
    allowSlashCommands: true,
    rewriteAllCapsThreshold: 0.70,
    shadowModeOnHighRisk: true,
  },
  replayPolicy: {
    enabled: true,
    maxMessagesPerRoom: 3_000,
    maxReplayArtifactsPerRoom: 3_000,
    replayTimeWindowMs: 21_600_000,
  },
  learningPolicy: {
    enabled: true,
    updateOnEveryAcceptedMessage: true,
    coldStartEnabled: true,
    emitInferenceSnapshots: true,
    acceptClientHints: false,
    persistProfiles: true,
  },
  proofPolicy: {
    enabled: true,
    hashAlgorithm: 'FNV1A32' as const,
    linkModerationEdges: true,
    linkReplayEdges: true,
    linkLearningEdges: true,
  },
  invasionPolicy: {
    enabled: true,
    maxActivePerRoom: 1,
    minimumGapMs: 50_000,
    defaultDurationMs: 18_000,
    allowShadowPriming: true,
  },
});

const PRESET_CINEMATIC: Readonly<Partial<ChatRuntimeConfig>> = Object.freeze({
  allowVisibleChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY'] as readonly ChatVisibleChannel[],
  allowShadowChannels: ['SYSTEM_SHADOW', 'NPC_SHADOW', 'RIVALRY_SHADOW', 'RESCUE_SHADOW', 'LIVEOPS_SHADOW'] as readonly ChatShadowChannel[],
  ratePolicy: {
    perSecondBurstLimit: 4,
    perMinuteLimit: 22,
    typingHeartbeatWindowMs: 7_500,
    identicalMessageWindowMs: 28_000,
    identicalMessageMaxCount: 2,
    npcMinimumGapMs: 2_400,
    helperMinimumGapMs: 5_800,
    haterMinimumGapMs: 8_900,
    invasionLockMs: 13_000,
  },
  moderationPolicy: {
    maxCharactersPerMessage: 540,
    maxLinesPerMessage: 10,
    maskBannedLexemes: ['idiot', 'loser', 'trash'],
    rejectBannedLexemes: ['kill yourself', 'dox', 'credit card number'],
    maxConsecutiveEmojiRuns: 7,
    maxSuspiciousUrlCount: 2,
    allowSlashCommands: true,
    rewriteAllCapsThreshold: 0.76,
    shadowModeOnHighRisk: true,
  },
  replayPolicy: {
    enabled: true,
    maxMessagesPerRoom: 5_500,
    maxReplayArtifactsPerRoom: 3_500,
    replayTimeWindowMs: 172_800_000,
  },
  learningPolicy: {
    enabled: true,
    updateOnEveryAcceptedMessage: true,
    coldStartEnabled: true,
    emitInferenceSnapshots: true,
    acceptClientHints: false,
    persistProfiles: true,
  },
  proofPolicy: {
    enabled: true,
    hashAlgorithm: 'FNV1A32' as const,
    linkModerationEdges: true,
    linkReplayEdges: true,
    linkLearningEdges: true,
  },
  invasionPolicy: {
    enabled: true,
    maxActivePerRoom: 1,
    minimumGapMs: 40_000,
    defaultDurationMs: 24_000,
    allowShadowPriming: true,
  },
});

const PRESET_DEBUG_STRICT: Readonly<Partial<ChatRuntimeConfig>> = Object.freeze({
  allowVisibleChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY'] as readonly ChatVisibleChannel[],
  allowShadowChannels: ['SYSTEM_SHADOW', 'NPC_SHADOW', 'RIVALRY_SHADOW', 'RESCUE_SHADOW', 'LIVEOPS_SHADOW'] as readonly ChatShadowChannel[],
  ratePolicy: {
    perSecondBurstLimit: 6,
    perMinuteLimit: 40,
    typingHeartbeatWindowMs: 8_000,
    identicalMessageWindowMs: 12_000,
    identicalMessageMaxCount: 3,
    npcMinimumGapMs: 900,
    helperMinimumGapMs: 2_000,
    haterMinimumGapMs: 2_500,
    invasionLockMs: 8_000,
  },
  moderationPolicy: {
    maxCharactersPerMessage: 700,
    maxLinesPerMessage: 14,
    maskBannedLexemes: ['idiot', 'loser', 'trash'],
    rejectBannedLexemes: ['kill yourself', 'dox', 'credit card number'],
    maxConsecutiveEmojiRuns: 12,
    maxSuspiciousUrlCount: 3,
    allowSlashCommands: true,
    rewriteAllCapsThreshold: 0.82,
    shadowModeOnHighRisk: true,
  },
  replayPolicy: {
    enabled: true,
    maxMessagesPerRoom: 7_500,
    maxReplayArtifactsPerRoom: 5_000,
    replayTimeWindowMs: 259_200_000,
  },
  learningPolicy: {
    enabled: true,
    updateOnEveryAcceptedMessage: true,
    coldStartEnabled: true,
    emitInferenceSnapshots: true,
    acceptClientHints: true,
    persistProfiles: false,
  },
  proofPolicy: {
    enabled: true,
    hashAlgorithm: 'FNV1A32' as const,
    linkModerationEdges: true,
    linkReplayEdges: true,
    linkLearningEdges: true,
  },
  invasionPolicy: {
    enabled: true,
    maxActivePerRoom: 2,
    minimumGapMs: 25_000,
    defaultDurationMs: 26_000,
    allowShadowPriming: true,
  },
});

const RUNTIME_PRESETS: Readonly<Record<ChatRuntimePresetName, Readonly<Partial<ChatRuntimeConfig>>>> =
  Object.freeze({
    BALANCED: PRESET_BALANCED,
    SAFE_LOBBY: PRESET_SAFE_LOBBY,
    TOURNAMENT: PRESET_TOURNAMENT,
    CINEMATIC: PRESET_CINEMATIC,
    DEBUG_STRICT: PRESET_DEBUG_STRICT,
  });

// ============================================================================
// MARK: Public builders
// ============================================================================

export function createRuntimeContext(options?: ChatRuntimeConfigOptions): ChatRuntimeContext {
  const buildFlags: ChatRuntimeBuildFlags = Object.freeze({
    ...DEFAULT_BUILD_FLAGS,
    ...(options?.buildFlags ?? {}),
  });

  const securityProfile: ChatRuntimeSecurityProfile = Object.freeze({
    ...DEFAULT_SECURITY_PROFILE,
    ...(options?.securityProfile ?? {}),
  });

  return Object.freeze({
    logger: options?.logger ?? NOOP_LOGGER,
    buildFlags,
    securityProfile,
    presetName: options?.presetName ?? 'BALANCED',
  });
}

export function createDefaultRuntimeConfig(): ChatRuntimeConfig {
  return freezeRuntimeConfig(mergeRuntimeConfigLayers([{ tag: { source: 'DEFAULTS', note: 'Repository defaults.' }, config: CHAT_RUNTIME_DEFAULTS }]));
}

export function resolveRuntimePreset(name: ChatRuntimePresetName): Readonly<Partial<ChatRuntimeConfig>> {
  return RUNTIME_PRESETS[name] ?? RUNTIME_PRESETS.BALANCED;
}

export function mergeRuntimeConfig(
  override?: Partial<ChatRuntimeConfig>,
  options?: ChatRuntimeConfigOptions,
): ChatRuntimeConfig {
  const context = createRuntimeContext(options);
  const layers: ChatRuntimeLayer[] = [
    { tag: { source: 'DEFAULTS', note: 'Base runtime defaults.' }, config: CHAT_RUNTIME_DEFAULTS },
    { tag: { source: 'BUILD', note: `Preset: ${context.presetName}.` }, config: resolveRuntimePreset(context.presetName) },
    { tag: { source: 'ENVIRONMENT', note: `Security profile: ${context.securityProfile.name}.` }, config: createSecurityProfileLayer(context.securityProfile) },
    { tag: { source: 'MODE', note: 'Build flags translated into runtime policy.' }, config: createBuildFlagLayer(context.buildFlags) },
  ];

  if (override) {
    layers.push({ tag: { source: 'USER_OVERRIDE', note: 'Caller-specified runtime override.' }, config: override });
  }

  const merged = mergeRuntimeConfigLayers(layers, context.logger);
  const validation = validateRuntimeConfig(merged);

  if (!validation.ok) {
    context.logger.warn('Runtime config merged with validation issues.', {
      issueCount: validation.issues.length,
      preset: context.presetName,
      profile: context.securityProfile.name,
    });
  }

  return freezeRuntimeConfig(merged);
}

export function mergeRuntimeConfigLayers(
  layers: readonly ChatRuntimeLayer[],
  logger: ChatRuntimeConfigLoggerPort = NOOP_LOGGER,
): ChatRuntimeConfig {
  let current: ChatRuntimeConfig = CHAT_RUNTIME_DEFAULTS;

  for (const layer of layers) {
    logger.debug('Applying chat runtime layer.', {
      source: layer.tag.source,
      note: layer.tag.note,
    });

    current = sanitizeRuntimeConfig({
      ...current,
      ...layer.config,
      allowVisibleChannels: mergeVisibleChannels(current.allowVisibleChannels, layer.config.allowVisibleChannels),
      allowShadowChannels: mergeShadowChannels(current.allowShadowChannels, layer.config.allowShadowChannels),
      ratePolicy: sanitizeRatePolicy({
        ...current.ratePolicy,
        ...(layer.config.ratePolicy ?? {}),
      }),
      moderationPolicy: sanitizeModerationPolicy({
        ...current.moderationPolicy,
        ...(layer.config.moderationPolicy ?? {}),
      }),
      replayPolicy: sanitizeReplayPolicy({
        ...current.replayPolicy,
        ...(layer.config.replayPolicy ?? {}),
      }),
      learningPolicy: sanitizeLearningPolicy({
        ...current.learningPolicy,
        ...(layer.config.learningPolicy ?? {}),
      }),
      proofPolicy: sanitizeProofPolicy({
        ...current.proofPolicy,
        ...(layer.config.proofPolicy ?? {}),
      }),
      invasionPolicy: sanitizeInvasionPolicy({
        ...current.invasionPolicy,
        ...(layer.config.invasionPolicy ?? {}),
      }),
    });
  }

  return sanitizeRuntimeConfig(current);
}

export function freezeRuntimeConfig(config: ChatRuntimeConfig): ChatRuntimeConfig {
  return Object.freeze({
    ...config,
    allowVisibleChannels: Object.freeze([...config.allowVisibleChannels]) as readonly ChatVisibleChannel[],
    allowShadowChannels: Object.freeze([...config.allowShadowChannels]) as readonly ChatShadowChannel[],
    ratePolicy: Object.freeze({ ...config.ratePolicy }),
    moderationPolicy: Object.freeze({
      ...config.moderationPolicy,
      maskBannedLexemes: Object.freeze([...config.moderationPolicy.maskBannedLexemes]),
      rejectBannedLexemes: Object.freeze([...config.moderationPolicy.rejectBannedLexemes]),
    }),
    replayPolicy: Object.freeze({ ...config.replayPolicy }),
    learningPolicy: Object.freeze({ ...config.learningPolicy }),
    proofPolicy: Object.freeze({ ...config.proofPolicy }),
    invasionPolicy: Object.freeze({ ...config.invasionPolicy }),
  });
}

export function validateRuntimeConfig(config: ChatRuntimeConfig): ChatRuntimeValidationResult {
  const issues: ChatRuntimeValidationIssue[] = [];

  validateVisibleChannels(config, issues);
  validateShadowChannels(config, issues);
  validateRatePolicy(config.ratePolicy, issues);
  validateModerationPolicy(config.moderationPolicy, issues);
  validateReplayPolicy(config.replayPolicy, issues);
  validateLearningPolicy(config.learningPolicy, issues);
  validateProofPolicy(config.proofPolicy, issues);
  validateInvasionPolicy(config.invasionPolicy, issues);
  validateCrossPolicyInvariants(config, issues);

  return Object.freeze({
    ok: issues.every((issue) => issue.severity !== 'ERROR'),
    issues: Object.freeze(issues),
  });
}

export function createRuntimeDiagnostics(
  config: ChatRuntimeConfig,
  options?: ChatRuntimeConfigOptions,
  tags: readonly ChatRuntimeSourceTag[] = [{ source: 'DEFAULTS', note: 'Diagnostics generated from effective config.' }],
): ChatRuntimeDiagnostics {
  const context = createRuntimeContext(options);
  const validation = validateRuntimeConfig(config);
  const mergeTrace: ChatRuntimeMergeTrace = Object.freeze({
    tags: Object.freeze([...tags]),
    effectiveVisibleChannels: Object.freeze([...config.allowVisibleChannels]),
    effectiveShadowChannels: Object.freeze([...config.allowShadowChannels]),
    strictModeration: context.buildFlags.strictModeration || context.securityProfile.elevatedModeration,
    learningEnabled: config.learningPolicy.enabled,
    proofEnabled: config.proofPolicy.enabled,
    invasionEnabled: config.invasionPolicy.enabled,
  });

  return Object.freeze({
    version: BACKEND_CHAT_ENGINE_VERSION,
    presetName: context.presetName,
    securityProfile: context.securityProfile.name,
    buildFlags: context.buildFlags,
    mergeTrace,
    validation,
  });
}

export function createMountRuntimeHints(
  mountTarget: ChatMountPolicy['mountTarget'],
): ChatMountRuntimeHints {
  const policy = CHAT_MOUNT_POLICIES[mountTarget];
  return Object.freeze({
    mountTarget: policy.mountTarget,
    defaultVisibleChannel: policy.defaultVisibleChannel,
    allowedVisibleChannels: Object.freeze([...policy.allowedVisibleChannels]),
    stageMood: policy.stageMood,
    defaultCollapsed: policy.defaultCollapsed,
    defaultComposerPlaceholder: policy.defaultComposerPlaceholder,
  });
}

export function createRoomBootstrapPolicy(args: {
  roomKind: ChatRoomKind;
  title: string;
  mountTarget?: ChatMountPolicy['mountTarget'];
  runtime?: ChatRuntimeConfig;
}): ChatRoomBootstrapPolicy {
  const runtime = args.runtime ?? CHAT_RUNTIME_DEFAULTS;
  const mountTarget = args.mountTarget ?? inferMountTargetFromRoomKind(args.roomKind);
  const mount = createMountRuntimeHints(mountTarget);
  const roomChannels = resolveAllowedVisibleChannelsForRoomKind(args.roomKind, runtime.allowVisibleChannels);
  const allowedVisibleChannels = intersectVisibleChannels(roomChannels, mount.allowedVisibleChannels);
  const defaultVisibleChannel = selectDefaultVisibleChannel(args.roomKind, mount.defaultVisibleChannel, allowedVisibleChannels);

  return Object.freeze({
    roomKind: args.roomKind,
    title: args.title,
    stageMood: deriveStageMood(args.roomKind, mount.stageMood),
    defaultVisibleChannel,
    allowedVisibleChannels,
    collapsed: mount.defaultCollapsed,
    composerPlaceholder: deriveComposerPlaceholder(args.roomKind, mount.defaultComposerPlaceholder),
    supportShadowWrites: roomSupportsShadowWrites(defaultVisibleChannel),
    supportReplay: CHAT_CHANNEL_DESCRIPTORS[defaultVisibleChannel].supportsReplay,
  });
}

export function resolveRuntimeForRoom(args: {
  roomKind: ChatRoomKind;
  title: string;
  mountTarget?: ChatMountPolicy['mountTarget'];
  presetName?: ChatRuntimePresetName;
  runtimeOverride?: Partial<ChatRuntimeConfig>;
  options?: ChatRuntimeConfigOptions;
}): ChatRuntimeResolvedRoomPolicy {
  const merged = mergeRuntimeConfig(args.runtimeOverride, {
    ...args.options,
    presetName: args.presetName ?? args.options?.presetName ?? 'BALANCED',
  });

  const bootstrap = createRoomBootstrapPolicy({
    roomKind: args.roomKind,
    title: args.title,
    mountTarget: args.mountTarget,
    runtime: merged,
  });

  const diagnostics = createRuntimeDiagnostics(merged, {
    ...args.options,
    presetName: args.presetName ?? args.options?.presetName ?? 'BALANCED',
  });

  return Object.freeze({
    runtime: merged,
    bootstrap,
    diagnostics,
  });
}

// ============================================================================
// MARK: Serialization helpers
// ============================================================================

export function runtimeConfigToJson(config: ChatRuntimeConfig): Readonly<Record<string, JsonValue>> {
  return Object.freeze({
    version: config.version,
    allowVisibleChannels: [...config.allowVisibleChannels],
    allowShadowChannels: [...config.allowShadowChannels],
    ratePolicy: { ...config.ratePolicy },
    moderationPolicy: {
      ...config.moderationPolicy,
      maskBannedLexemes: [...config.moderationPolicy.maskBannedLexemes],
      rejectBannedLexemes: [...config.moderationPolicy.rejectBannedLexemes],
    },
    replayPolicy: { ...config.replayPolicy },
    learningPolicy: { ...config.learningPolicy },
    proofPolicy: { ...config.proofPolicy },
    invasionPolicy: { ...config.invasionPolicy },
  });
}

export function runtimeConfigFromJson(value: Readonly<Record<string, JsonValue>>): ChatRuntimeConfig {
  return mergeRuntimeConfig({
    version: BACKEND_CHAT_ENGINE_VERSION,
    allowVisibleChannels: decodeVisibleChannels(value.allowVisibleChannels),
    allowShadowChannels: decodeShadowChannels(value.allowShadowChannels),
    ratePolicy: decodeRatePolicy(value.ratePolicy),
    moderationPolicy: decodeModerationPolicy(value.moderationPolicy),
    replayPolicy: decodeReplayPolicy(value.replayPolicy),
    learningPolicy: decodeLearningPolicy(value.learningPolicy),
    proofPolicy: decodeProofPolicy(value.proofPolicy),
    invasionPolicy: decodeInvasionPolicy(value.invasionPolicy),
  });
}

// ============================================================================
// MARK: Diff and explainability helpers
// ============================================================================

export interface ChatRuntimeDiffEntry {
  readonly path: string;
  readonly before: JsonValue;
  readonly after: JsonValue;
}

export function diffRuntimeConfig(
  before: ChatRuntimeConfig,
  after: ChatRuntimeConfig,
): readonly ChatRuntimeDiffEntry[] {
  const diffs: ChatRuntimeDiffEntry[] = [];
  diffValue('allowVisibleChannels', before.allowVisibleChannels as unknown as JsonValue, after.allowVisibleChannels as unknown as JsonValue, diffs);
  diffValue('allowShadowChannels', before.allowShadowChannels as unknown as JsonValue, after.allowShadowChannels as unknown as JsonValue, diffs);
  diffValue('ratePolicy', before.ratePolicy as unknown as JsonValue, after.ratePolicy as unknown as JsonValue, diffs);
  diffValue('moderationPolicy', before.moderationPolicy as unknown as JsonValue, after.moderationPolicy as unknown as JsonValue, diffs);
  diffValue('replayPolicy', before.replayPolicy as unknown as JsonValue, after.replayPolicy as unknown as JsonValue, diffs);
  diffValue('learningPolicy', before.learningPolicy as unknown as JsonValue, after.learningPolicy as unknown as JsonValue, diffs);
  diffValue('proofPolicy', before.proofPolicy as unknown as JsonValue, after.proofPolicy as unknown as JsonValue, diffs);
  diffValue('invasionPolicy', before.invasionPolicy as unknown as JsonValue, after.invasionPolicy as unknown as JsonValue, diffs);
  return Object.freeze(diffs);
}

export function summarizeRuntimeConfig(config: ChatRuntimeConfig): string {
  const visible = config.allowVisibleChannels.join(', ');
  const shadows = config.allowShadowChannels.join(', ');
  return [
    `visible=[${visible}]`,
    `shadow=[${shadows}]`,
    `rate=${config.ratePolicy.perSecondBurstLimit}/${config.ratePolicy.perMinuteLimit}`,
    `moderationChars=${config.moderationPolicy.maxCharactersPerMessage}`,
    `replay=${config.replayPolicy.enabled ? 'on' : 'off'}`,
    `learning=${config.learningPolicy.enabled ? 'on' : 'off'}`,
    `proof=${config.proofPolicy.enabled ? 'on' : 'off'}`,
    `invasion=${config.invasionPolicy.enabled ? 'on' : 'off'}`,
  ].join(' ');
}

// ============================================================================
// MARK: Security/build translation
// ============================================================================

function createSecurityProfileLayer(profile: ChatRuntimeSecurityProfile): Partial<ChatRuntimeConfig> {
  const layer: MutableRuntimePartial = {};

  if (profile.lockShadowWritesToBackendOnly) {
    layer.allowShadowChannels = profile.name === 'SAFE_LOBBY'
      ? ['SYSTEM_SHADOW', 'RESCUE_SHADOW']
      : undefined;
  }

  layer.learningPolicy = {
    ...CHAT_RUNTIME_DEFAULTS.learningPolicy,
    acceptClientHints: profile.disallowClientHints ? false : CHAT_RUNTIME_DEFAULTS.learningPolicy.acceptClientHints,
  };

  layer.moderationPolicy = {
    ...CHAT_RUNTIME_DEFAULTS.moderationPolicy,
    shadowModeOnHighRisk: true,
    rewriteAllCapsThreshold: profile.elevatedModeration ? 0.64 : CHAT_RUNTIME_DEFAULTS.moderationPolicy.rewriteAllCapsThreshold,
    maxSuspiciousUrlCount: profile.elevatedModeration ? 1 : CHAT_RUNTIME_DEFAULTS.moderationPolicy.maxSuspiciousUrlCount,
  };

  if (profile.restrictNegotiationExposure) {
    layer.allowVisibleChannels = ['GLOBAL', 'SYNDICATE', 'LOBBY'] as readonly ChatVisibleChannel[];
  }

  if (profile.reduceReplayRetention) {
    layer.replayPolicy = {
      ...CHAT_RUNTIME_DEFAULTS.replayPolicy,
      replayTimeWindowMs: 21_600_000,
      maxMessagesPerRoom: 1_500,
      maxReplayArtifactsPerRoom: 800,
    };
  }

  if (profile.name === 'PRIVATE_REVIEW') {
    layer.allowVisibleChannels = ['SYNDICATE', 'DEAL_ROOM'] as readonly ChatVisibleChannel[];
    layer.allowShadowChannels = ['SYSTEM_SHADOW', 'NPC_SHADOW', 'RIVALRY_SHADOW', 'RESCUE_SHADOW', 'LIVEOPS_SHADOW'] as readonly ChatShadowChannel[];
    layer.invasionPolicy = {
      ...CHAT_RUNTIME_DEFAULTS.invasionPolicy,
      enabled: false,
      maxActivePerRoom: 0,
      allowShadowPriming: false,
    };
  }

  return layer;
}

function createBuildFlagLayer(flags: ChatRuntimeBuildFlags): Partial<ChatRuntimeConfig> {
  const next: MutableRuntimePartial = {};

  next.learningPolicy = {
    ...CHAT_RUNTIME_DEFAULTS.learningPolicy,
    acceptClientHints: flags.allowClientHints,
  };

  next.replayPolicy = {
    ...CHAT_RUNTIME_DEFAULTS.replayPolicy,
    replayTimeWindowMs: flags.lowLatencyReplayMode
      ? Math.min(CHAT_RUNTIME_DEFAULTS.replayPolicy.replayTimeWindowMs, 21_600_000)
      : CHAT_RUNTIME_DEFAULTS.replayPolicy.replayTimeWindowMs,
  };

  if (!flags.allowShadowChannels) {
    next.allowShadowChannels = [] as readonly ChatShadowChannel[];
  }

  if (!flags.allowNegotiationEscalation) {
    next.allowVisibleChannels = ['GLOBAL', 'SYNDICATE', 'LOBBY'] as readonly ChatVisibleChannel[];
  }

  if (!flags.allowLiveOpsRaids) {
    next.invasionPolicy = {
      ...CHAT_RUNTIME_DEFAULTS.invasionPolicy,
      enabled: false,
      maxActivePerRoom: 0,
      allowShadowPriming: false,
    };
  }

  if (flags.strictModeration) {
    next.moderationPolicy = {
      ...CHAT_RUNTIME_DEFAULTS.moderationPolicy,
      maxCharactersPerMessage: 360,
      maxLinesPerMessage: 6,
      maxConsecutiveEmojiRuns: 4,
      maxSuspiciousUrlCount: 1,
      rewriteAllCapsThreshold: 0.64,
      shadowModeOnHighRisk: true,
    };
  }

  return next;
}

// ============================================================================
// MARK: Sanitizers
// ============================================================================

function sanitizeRuntimeConfig(config: ChatRuntimeConfig): ChatRuntimeConfig {
  return {
    version: BACKEND_CHAT_ENGINE_VERSION,
    allowVisibleChannels: sanitizeVisibleChannels(config.allowVisibleChannels),
    allowShadowChannels: sanitizeShadowChannels(config.allowShadowChannels),
    ratePolicy: sanitizeRatePolicy(config.ratePolicy),
    moderationPolicy: sanitizeModerationPolicy(config.moderationPolicy),
    replayPolicy: sanitizeReplayPolicy(config.replayPolicy),
    learningPolicy: sanitizeLearningPolicy(config.learningPolicy),
    proofPolicy: sanitizeProofPolicy(config.proofPolicy),
    invasionPolicy: sanitizeInvasionPolicy(config.invasionPolicy),
  };
}

function sanitizeVisibleChannels(channels: readonly ChatVisibleChannel[] | undefined): readonly ChatVisibleChannel[] {
  const source = channels ?? CHAT_RUNTIME_DEFAULTS.allowVisibleChannels;
  const seen = new Set<ChatVisibleChannel>();
  const result: ChatVisibleChannel[] = [];

  for (const channel of source) {
    if (!isVisibleChannel(channel)) {
      continue;
    }

    if (!seen.has(channel)) {
      seen.add(channel);
      result.push(channel);
    }
  }

  return result.length > 0
    ? Object.freeze(result)
    : CHAT_RUNTIME_DEFAULTS.allowVisibleChannels;
}

function sanitizeShadowChannels(channels: readonly ChatShadowChannel[] | undefined): readonly ChatShadowChannel[] {
  const source = channels ?? CHAT_RUNTIME_DEFAULTS.allowShadowChannels;
  const seen = new Set<ChatShadowChannel>();
  const result: ChatShadowChannel[] = [];

  for (const channel of source) {
    if (!isShadowChannel(channel)) {
      continue;
    }

    if (!seen.has(channel)) {
      seen.add(channel);
      result.push(channel);
    }
  }

  return Object.freeze(result);
}

function sanitizeRatePolicy(policy: ChatRatePolicyConfig): ChatRatePolicyConfig {
  return {
    perSecondBurstLimit: clampInt(policy.perSecondBurstLimit, 1, 20, CHAT_RUNTIME_DEFAULTS.ratePolicy.perSecondBurstLimit),
    perMinuteLimit: clampInt(policy.perMinuteLimit, 1, 500, CHAT_RUNTIME_DEFAULTS.ratePolicy.perMinuteLimit),
    typingHeartbeatWindowMs: clampInt(policy.typingHeartbeatWindowMs, 1_000, 60_000, CHAT_RUNTIME_DEFAULTS.ratePolicy.typingHeartbeatWindowMs),
    identicalMessageWindowMs: clampInt(policy.identicalMessageWindowMs, 1_000, 300_000, CHAT_RUNTIME_DEFAULTS.ratePolicy.identicalMessageWindowMs),
    identicalMessageMaxCount: clampInt(policy.identicalMessageMaxCount, 1, 10, CHAT_RUNTIME_DEFAULTS.ratePolicy.identicalMessageMaxCount),
    npcMinimumGapMs: clampInt(policy.npcMinimumGapMs, 250, 60_000, CHAT_RUNTIME_DEFAULTS.ratePolicy.npcMinimumGapMs),
    helperMinimumGapMs: clampInt(policy.helperMinimumGapMs, 250, 60_000, CHAT_RUNTIME_DEFAULTS.ratePolicy.helperMinimumGapMs),
    haterMinimumGapMs: clampInt(policy.haterMinimumGapMs, 250, 60_000, CHAT_RUNTIME_DEFAULTS.ratePolicy.haterMinimumGapMs),
    invasionLockMs: clampInt(policy.invasionLockMs, 1_000, 300_000, CHAT_RUNTIME_DEFAULTS.ratePolicy.invasionLockMs),
  };
}

function sanitizeModerationPolicy(policy: ChatModerationPolicyConfig): ChatModerationPolicyConfig {
  return {
    maxCharactersPerMessage: clampInt(policy.maxCharactersPerMessage, 32, 2_000, CHAT_RUNTIME_DEFAULTS.moderationPolicy.maxCharactersPerMessage),
    maxLinesPerMessage: clampInt(policy.maxLinesPerMessage, 1, 40, CHAT_RUNTIME_DEFAULTS.moderationPolicy.maxLinesPerMessage),
    maskBannedLexemes: sanitizeLexemeList(policy.maskBannedLexemes),
    rejectBannedLexemes: sanitizeLexemeList(policy.rejectBannedLexemes),
    maxConsecutiveEmojiRuns: clampInt(policy.maxConsecutiveEmojiRuns, 1, 32, CHAT_RUNTIME_DEFAULTS.moderationPolicy.maxConsecutiveEmojiRuns),
    maxSuspiciousUrlCount: clampInt(policy.maxSuspiciousUrlCount, 0, 10, CHAT_RUNTIME_DEFAULTS.moderationPolicy.maxSuspiciousUrlCount),
    allowSlashCommands: Boolean(policy.allowSlashCommands),
    rewriteAllCapsThreshold: clampNumber(policy.rewriteAllCapsThreshold, 0.1, 0.99, CHAT_RUNTIME_DEFAULTS.moderationPolicy.rewriteAllCapsThreshold),
    shadowModeOnHighRisk: Boolean(policy.shadowModeOnHighRisk),
  };
}

function sanitizeReplayPolicy(policy: ChatReplayPolicyConfig): ChatReplayPolicyConfig {
  return {
    enabled: Boolean(policy.enabled),
    maxMessagesPerRoom: clampInt(policy.maxMessagesPerRoom, 50, 100_000, CHAT_RUNTIME_DEFAULTS.replayPolicy.maxMessagesPerRoom),
    maxReplayArtifactsPerRoom: clampInt(policy.maxReplayArtifactsPerRoom, 10, 100_000, CHAT_RUNTIME_DEFAULTS.replayPolicy.maxReplayArtifactsPerRoom),
    replayTimeWindowMs: clampInt(policy.replayTimeWindowMs, 1_000, 604_800_000, CHAT_RUNTIME_DEFAULTS.replayPolicy.replayTimeWindowMs),
  };
}

function sanitizeLearningPolicy(policy: ChatLearningPolicyConfig): ChatLearningPolicyConfig {
  return {
    enabled: Boolean(policy.enabled),
    updateOnEveryAcceptedMessage: Boolean(policy.updateOnEveryAcceptedMessage),
    coldStartEnabled: Boolean(policy.coldStartEnabled),
    emitInferenceSnapshots: Boolean(policy.emitInferenceSnapshots),
    acceptClientHints: Boolean(policy.acceptClientHints),
    persistProfiles: Boolean(policy.persistProfiles),
  };
}

function sanitizeProofPolicy(policy: ChatProofPolicyConfig): ChatProofPolicyConfig {
  return {
    enabled: Boolean(policy.enabled),
    hashAlgorithm: 'FNV1A32' as const,
    linkModerationEdges: Boolean(policy.linkModerationEdges),
    linkReplayEdges: Boolean(policy.linkReplayEdges),
    linkLearningEdges: Boolean(policy.linkLearningEdges),
  };
}

function sanitizeInvasionPolicy(policy: ChatInvasionPolicyConfig): ChatInvasionPolicyConfig {
  return {
    enabled: Boolean(policy.enabled),
    maxActivePerRoom: clampInt(policy.maxActivePerRoom, 0, 10, CHAT_RUNTIME_DEFAULTS.invasionPolicy.maxActivePerRoom),
    minimumGapMs: clampInt(policy.minimumGapMs, 1_000, 604_800_000, CHAT_RUNTIME_DEFAULTS.invasionPolicy.minimumGapMs),
    defaultDurationMs: clampInt(policy.defaultDurationMs, 500, 300_000, CHAT_RUNTIME_DEFAULTS.invasionPolicy.defaultDurationMs),
    allowShadowPriming: Boolean(policy.allowShadowPriming),
  };
}

// ============================================================================
// MARK: Validators
// ============================================================================

function validateVisibleChannels(config: ChatRuntimeConfig, issues: ChatRuntimeValidationIssue[]): void {
  if (config.allowVisibleChannels.length === 0) {
    issues.push(errorIssue('VISIBLE_CHANNELS_EMPTY', 'At least one visible channel must be enabled.', 'allowVisibleChannels'));
  }

  for (const channel of config.allowVisibleChannels) {
    const descriptor = CHAT_CHANNEL_DESCRIPTORS[channel];
    if (!descriptor.visibleToPlayer) {
      issues.push(errorIssue('VISIBLE_CHANNEL_NOT_VISIBLE', `Channel ${channel} is not a player-visible channel.`, 'allowVisibleChannels'));
    }
    if (!descriptor.supportsComposer) {
      issues.push(warningIssue('VISIBLE_CHANNEL_NO_COMPOSER', `Channel ${channel} does not support composer input.`, 'allowVisibleChannels'));
    }
  }
}

function validateShadowChannels(config: ChatRuntimeConfig, issues: ChatRuntimeValidationIssue[]): void {
  const duplicates = findDuplicates(config.allowShadowChannels);
  if (duplicates.length > 0) {
    issues.push(errorIssue('SHADOW_CHANNEL_DUPLICATES', `Duplicate shadow channels detected: ${duplicates.join(', ')}`, 'allowShadowChannels'));
  }

  for (const channel of config.allowShadowChannels) {
    const descriptor = CHAT_CHANNEL_DESCRIPTORS[channel];
    if (descriptor.visibleToPlayer) {
      issues.push(errorIssue('SHADOW_CHANNEL_VISIBLE', `Shadow channel ${channel} is visible to players.`, 'allowShadowChannels'));
    }
  }
}

function validateRatePolicy(policy: ChatRatePolicyConfig, issues: ChatRuntimeValidationIssue[]): void {
  if (policy.perMinuteLimit < policy.perSecondBurstLimit) {
    issues.push(errorIssue('RATE_MINUTE_LT_SECOND', 'Per-minute rate limit cannot be lower than per-second burst limit.', 'ratePolicy.perMinuteLimit'));
  }

  if (policy.identicalMessageMaxCount < 1) {
    issues.push(errorIssue('RATE_IDENTICAL_MAX_INVALID', 'Identical message max count must be at least 1.', 'ratePolicy.identicalMessageMaxCount'));
  }

  if (policy.helperMinimumGapMs < policy.npcMinimumGapMs) {
    issues.push(warningIssue('RATE_HELPER_GAP_LT_NPC', 'Helper gap is shorter than generic NPC gap; helpers may feel too eager.', 'ratePolicy.helperMinimumGapMs'));
  }
}

function validateModerationPolicy(policy: ChatModerationPolicyConfig, issues: ChatRuntimeValidationIssue[]): void {
  if (policy.maxCharactersPerMessage < 32) {
    issues.push(errorIssue('MOD_MIN_CHARS_INVALID', 'Maximum characters per message is unrealistically low.', 'moderationPolicy.maxCharactersPerMessage'));
  }

  if (policy.maxLinesPerMessage < 1) {
    issues.push(errorIssue('MOD_MIN_LINES_INVALID', 'Maximum lines per message must be at least 1.', 'moderationPolicy.maxLinesPerMessage'));
  }

  if (policy.rewriteAllCapsThreshold <= 0 || policy.rewriteAllCapsThreshold >= 1) {
    issues.push(errorIssue('MOD_CAPS_THRESHOLD_INVALID', 'All-caps threshold must be between 0 and 1.', 'moderationPolicy.rewriteAllCapsThreshold'));
  }
}

function validateReplayPolicy(policy: ChatReplayPolicyConfig, issues: ChatRuntimeValidationIssue[]): void {
  if (policy.enabled && policy.maxMessagesPerRoom < 50) {
    issues.push(warningIssue('REPLAY_ROOM_CAP_LOW', 'Replay is enabled with a very small per-room message cap.', 'replayPolicy.maxMessagesPerRoom'));
  }
}

function validateLearningPolicy(policy: ChatLearningPolicyConfig, issues: ChatRuntimeValidationIssue[]): void {
  if (!policy.enabled && policy.updateOnEveryAcceptedMessage) {
    issues.push(warningIssue('LEARNING_DISABLED_UPDATE_TRUE', 'Learning updates are enabled while learning is globally disabled.', 'learningPolicy.updateOnEveryAcceptedMessage'));
  }

  if (policy.acceptClientHints && !policy.enabled) {
    issues.push(warningIssue('LEARNING_HINTS_WITHOUT_LEARNING', 'Client hints are accepted while learning is disabled.', 'learningPolicy.acceptClientHints'));
  }
}

function validateProofPolicy(policy: ChatProofPolicyConfig, issues: ChatRuntimeValidationIssue[]): void {
  if (!policy.enabled && (policy.linkLearningEdges || policy.linkModerationEdges || policy.linkReplayEdges)) {
    issues.push(warningIssue('PROOF_DISABLED_LINKS_ENABLED', 'Proof links are enabled while proof policy is disabled.', 'proofPolicy'));
  }
}

function validateInvasionPolicy(policy: ChatInvasionPolicyConfig, issues: ChatRuntimeValidationIssue[]): void {
  if (!policy.enabled && policy.maxActivePerRoom > 0) {
    issues.push(warningIssue('INVASION_DISABLED_MAX_ACTIVE', 'Invasion maxActivePerRoom is positive while invasion is disabled.', 'invasionPolicy.maxActivePerRoom'));
  }

  if (policy.enabled && policy.maxActivePerRoom === 0) {
    issues.push(errorIssue('INVASION_ENABLED_ZERO_ACTIVE', 'Invasion is enabled but maxActivePerRoom is zero.', 'invasionPolicy.maxActivePerRoom'));
  }
}

function validateCrossPolicyInvariants(config: ChatRuntimeConfig, issues: ChatRuntimeValidationIssue[]): void {
  if (!config.proofPolicy.enabled && config.replayPolicy.enabled) {
    issues.push(warningIssue('REPLAY_WITHOUT_PROOF', 'Replay is enabled while proof is disabled; auditability will be weaker.', 'replayPolicy'));
  }

  if (!config.learningPolicy.enabled && config.learningPolicy.emitInferenceSnapshots) {
    issues.push(warningIssue('INFERENCE_SNAPSHOTS_WITHOUT_LEARNING', 'Inference snapshots are enabled while learning is disabled.', 'learningPolicy.emitInferenceSnapshots'));
  }

  if (!config.allowVisibleChannels.includes('LOBBY') && CHAT_ROOM_KINDS.includes('LOBBY')) {
    issues.push(warningIssue('LOBBY_CHANNEL_NOT_VISIBLE', 'Lobby rooms may be created while the LOBBY visible channel is disabled.', 'allowVisibleChannels'));
  }

  if (config.allowShadowChannels.length === 0 && config.moderationPolicy.shadowModeOnHighRisk) {
    issues.push(errorIssue('SHADOW_MODE_WITHOUT_SHADOW_CHANNELS', 'High-risk shadow mode is enabled but no shadow channels are available.', 'allowShadowChannels'));
  }
}

// ============================================================================
// MARK: Decode helpers
// ============================================================================

function decodeVisibleChannels(value: JsonValue): readonly ChatVisibleChannel[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return sanitizeVisibleChannels(value.filter(isVisibleChannel));
}

function decodeShadowChannels(value: JsonValue): readonly ChatShadowChannel[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return sanitizeShadowChannels(value.filter(isShadowChannel));
}

function decodeRatePolicy(value: JsonValue): ChatRatePolicyConfig | undefined {
  if (!isJsonRecord(value)) {
    return undefined;
  }
  return sanitizeRatePolicy({
    perSecondBurstLimit: asNumber(value.perSecondBurstLimit, CHAT_RUNTIME_DEFAULTS.ratePolicy.perSecondBurstLimit),
    perMinuteLimit: asNumber(value.perMinuteLimit, CHAT_RUNTIME_DEFAULTS.ratePolicy.perMinuteLimit),
    typingHeartbeatWindowMs: asNumber(value.typingHeartbeatWindowMs, CHAT_RUNTIME_DEFAULTS.ratePolicy.typingHeartbeatWindowMs),
    identicalMessageWindowMs: asNumber(value.identicalMessageWindowMs, CHAT_RUNTIME_DEFAULTS.ratePolicy.identicalMessageWindowMs),
    identicalMessageMaxCount: asNumber(value.identicalMessageMaxCount, CHAT_RUNTIME_DEFAULTS.ratePolicy.identicalMessageMaxCount),
    npcMinimumGapMs: asNumber(value.npcMinimumGapMs, CHAT_RUNTIME_DEFAULTS.ratePolicy.npcMinimumGapMs),
    helperMinimumGapMs: asNumber(value.helperMinimumGapMs, CHAT_RUNTIME_DEFAULTS.ratePolicy.helperMinimumGapMs),
    haterMinimumGapMs: asNumber(value.haterMinimumGapMs, CHAT_RUNTIME_DEFAULTS.ratePolicy.haterMinimumGapMs),
    invasionLockMs: asNumber(value.invasionLockMs, CHAT_RUNTIME_DEFAULTS.ratePolicy.invasionLockMs),
  });
}

function decodeModerationPolicy(value: JsonValue): ChatModerationPolicyConfig | undefined {
  if (!isJsonRecord(value)) {
    return undefined;
  }
  return sanitizeModerationPolicy({
    maxCharactersPerMessage: asNumber(value.maxCharactersPerMessage, CHAT_RUNTIME_DEFAULTS.moderationPolicy.maxCharactersPerMessage),
    maxLinesPerMessage: asNumber(value.maxLinesPerMessage, CHAT_RUNTIME_DEFAULTS.moderationPolicy.maxLinesPerMessage),
    maskBannedLexemes: decodeStringArray(value.maskBannedLexemes, CHAT_RUNTIME_DEFAULTS.moderationPolicy.maskBannedLexemes),
    rejectBannedLexemes: decodeStringArray(value.rejectBannedLexemes, CHAT_RUNTIME_DEFAULTS.moderationPolicy.rejectBannedLexemes),
    maxConsecutiveEmojiRuns: asNumber(value.maxConsecutiveEmojiRuns, CHAT_RUNTIME_DEFAULTS.moderationPolicy.maxConsecutiveEmojiRuns),
    maxSuspiciousUrlCount: asNumber(value.maxSuspiciousUrlCount, CHAT_RUNTIME_DEFAULTS.moderationPolicy.maxSuspiciousUrlCount),
    allowSlashCommands: asBoolean(value.allowSlashCommands, CHAT_RUNTIME_DEFAULTS.moderationPolicy.allowSlashCommands),
    rewriteAllCapsThreshold: asNumber(value.rewriteAllCapsThreshold, CHAT_RUNTIME_DEFAULTS.moderationPolicy.rewriteAllCapsThreshold),
    shadowModeOnHighRisk: asBoolean(value.shadowModeOnHighRisk, CHAT_RUNTIME_DEFAULTS.moderationPolicy.shadowModeOnHighRisk),
  });
}

function decodeReplayPolicy(value: JsonValue): ChatReplayPolicyConfig | undefined {
  if (!isJsonRecord(value)) {
    return undefined;
  }
  return sanitizeReplayPolicy({
    enabled: asBoolean(value.enabled, CHAT_RUNTIME_DEFAULTS.replayPolicy.enabled),
    maxMessagesPerRoom: asNumber(value.maxMessagesPerRoom, CHAT_RUNTIME_DEFAULTS.replayPolicy.maxMessagesPerRoom),
    maxReplayArtifactsPerRoom: asNumber(value.maxReplayArtifactsPerRoom, CHAT_RUNTIME_DEFAULTS.replayPolicy.maxReplayArtifactsPerRoom),
    replayTimeWindowMs: asNumber(value.replayTimeWindowMs, CHAT_RUNTIME_DEFAULTS.replayPolicy.replayTimeWindowMs),
  });
}

function decodeLearningPolicy(value: JsonValue): ChatLearningPolicyConfig | undefined {
  if (!isJsonRecord(value)) {
    return undefined;
  }
  return sanitizeLearningPolicy({
    enabled: asBoolean(value.enabled, CHAT_RUNTIME_DEFAULTS.learningPolicy.enabled),
    updateOnEveryAcceptedMessage: asBoolean(value.updateOnEveryAcceptedMessage, CHAT_RUNTIME_DEFAULTS.learningPolicy.updateOnEveryAcceptedMessage),
    coldStartEnabled: asBoolean(value.coldStartEnabled, CHAT_RUNTIME_DEFAULTS.learningPolicy.coldStartEnabled),
    emitInferenceSnapshots: asBoolean(value.emitInferenceSnapshots, CHAT_RUNTIME_DEFAULTS.learningPolicy.emitInferenceSnapshots),
    acceptClientHints: asBoolean(value.acceptClientHints, CHAT_RUNTIME_DEFAULTS.learningPolicy.acceptClientHints),
    persistProfiles: asBoolean(value.persistProfiles, CHAT_RUNTIME_DEFAULTS.learningPolicy.persistProfiles),
  });
}

function decodeProofPolicy(value: JsonValue): ChatProofPolicyConfig | undefined {
  if (!isJsonRecord(value)) {
    return undefined;
  }
  return sanitizeProofPolicy({
    enabled: asBoolean(value.enabled, CHAT_RUNTIME_DEFAULTS.proofPolicy.enabled),
    hashAlgorithm: 'FNV1A32' as const,
    linkModerationEdges: asBoolean(value.linkModerationEdges, CHAT_RUNTIME_DEFAULTS.proofPolicy.linkModerationEdges),
    linkReplayEdges: asBoolean(value.linkReplayEdges, CHAT_RUNTIME_DEFAULTS.proofPolicy.linkReplayEdges),
    linkLearningEdges: asBoolean(value.linkLearningEdges, CHAT_RUNTIME_DEFAULTS.proofPolicy.linkLearningEdges),
  });
}

function decodeInvasionPolicy(value: JsonValue): ChatInvasionPolicyConfig | undefined {
  if (!isJsonRecord(value)) {
    return undefined;
  }
  return sanitizeInvasionPolicy({
    enabled: asBoolean(value.enabled, CHAT_RUNTIME_DEFAULTS.invasionPolicy.enabled),
    maxActivePerRoom: asNumber(value.maxActivePerRoom, CHAT_RUNTIME_DEFAULTS.invasionPolicy.maxActivePerRoom),
    minimumGapMs: asNumber(value.minimumGapMs, CHAT_RUNTIME_DEFAULTS.invasionPolicy.minimumGapMs),
    defaultDurationMs: asNumber(value.defaultDurationMs, CHAT_RUNTIME_DEFAULTS.invasionPolicy.defaultDurationMs),
    allowShadowPriming: asBoolean(value.allowShadowPriming, CHAT_RUNTIME_DEFAULTS.invasionPolicy.allowShadowPriming),
  });
}

// ============================================================================
// MARK: Room and mount derivation
// ============================================================================

function inferMountTargetFromRoomKind(kind: ChatRoomKind): ChatMountPolicy['mountTarget'] {
  switch (kind) {
    case 'GLOBAL':
      return 'GAME_BOARD';
    case 'SYNDICATE':
      return 'SYNDICATE_GAME_SCREEN';
    case 'DEAL_ROOM':
      return 'EMPIRE_GAME_SCREEN';
    case 'LOBBY':
      return 'LOBBY_SCREEN';
    case 'PRIVATE':
      return 'LEAGUE_UI';
    case 'SYSTEM':
      return 'POST_RUN_SUMMARY';
    default:
      return 'GAME_BOARD';
  }
}

function deriveStageMood(kind: ChatRoomKind, fallback: ChatRoomStageMood): ChatRoomStageMood {
  switch (kind) {
    case 'GLOBAL':
      return fallback === 'CALM' ? 'TENSE' : fallback;
    case 'SYNDICATE':
      return 'TENSE';
    case 'DEAL_ROOM':
      return 'PREDATORY';
    case 'LOBBY':
      return 'CALM';
    case 'PRIVATE':
      return 'CEREMONIAL';
    case 'SYSTEM':
      return 'CEREMONIAL';
    default:
      return fallback;
  }
}

function deriveComposerPlaceholder(kind: ChatRoomKind, fallback: string): string {
  switch (kind) {
    case 'GLOBAL':
      return 'Address the crowd…';
    case 'SYNDICATE':
      return 'Speak to your circle…';
    case 'DEAL_ROOM':
      return 'Make your move…';
    case 'LOBBY':
      return 'Warm up the room…';
    case 'PRIVATE':
      return 'Write with intent…';
    case 'SYSTEM':
      return fallback;
    default:
      return fallback;
  }
}

function resolveAllowedVisibleChannelsForRoomKind(
  kind: ChatRoomKind,
  allowedByRuntime: readonly ChatVisibleChannel[],
): readonly ChatVisibleChannel[] {
  switch (kind) {
    case 'GLOBAL':
      return intersectVisibleChannels(allowedByRuntime, ['GLOBAL', 'SYNDICATE']);
    case 'SYNDICATE':
      return intersectVisibleChannels(allowedByRuntime, ['SYNDICATE', 'GLOBAL']);
    case 'DEAL_ROOM':
      return intersectVisibleChannels(allowedByRuntime, ['DEAL_ROOM', 'SYNDICATE', 'GLOBAL']);
    case 'LOBBY':
      return intersectVisibleChannels(allowedByRuntime, ['LOBBY', 'GLOBAL']);
    case 'PRIVATE':
      return intersectVisibleChannels(allowedByRuntime, ['SYNDICATE', 'DEAL_ROOM']);
    case 'SYSTEM':
      return intersectVisibleChannels(allowedByRuntime, ['GLOBAL']);
    default:
      return allowedByRuntime;
  }
}

function selectDefaultVisibleChannel(
  kind: ChatRoomKind,
  mountDefault: ChatVisibleChannel,
  allowed: readonly ChatVisibleChannel[],
): ChatVisibleChannel {
  if (allowed.includes(mountDefault)) {
    return mountDefault;
  }

  switch (kind) {
    case 'DEAL_ROOM':
      if (allowed.includes('DEAL_ROOM')) {
        return 'DEAL_ROOM';
      }
      break;
    case 'SYNDICATE':
      if (allowed.includes('SYNDICATE')) {
        return 'SYNDICATE';
      }
      break;
    case 'LOBBY':
      if (allowed.includes('LOBBY')) {
        return 'LOBBY';
      }
      break;
    default:
      break;
  }

  return allowed[0] ?? 'GLOBAL';
}

function roomSupportsShadowWrites(channel: ChatVisibleChannel): boolean {
  const descriptor = CHAT_CHANNEL_DESCRIPTORS[channel];
  return descriptor.supportsShadowWrites;
}

// ============================================================================
// MARK: Collection and numeric helpers
// ============================================================================

function mergeVisibleChannels(
  current: readonly ChatVisibleChannel[],
  next?: readonly ChatVisibleChannel[],
): readonly ChatVisibleChannel[] {
  return next ? sanitizeVisibleChannels(next) : current;
}

function mergeShadowChannels(
  current: readonly ChatShadowChannel[],
  next?: readonly ChatShadowChannel[],
): readonly ChatShadowChannel[] {
  return next ? sanitizeShadowChannels(next) : current;
}

function intersectVisibleChannels(
  left: readonly ChatVisibleChannel[],
  right: readonly ChatVisibleChannel[],
): readonly ChatVisibleChannel[] {
  const set = new Set(right);
  const result = left.filter((value) => set.has(value));
  return Object.freeze(result.length > 0 ? result : [left[0] ?? 'GLOBAL']);
}

function sanitizeLexemeList(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      continue;
    }
    if (!seen.has(normalized)) {
      seen.add(normalized);
      next.push(normalized);
    }
  }

  return Object.freeze(next);
}

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function findDuplicates<T extends string>(values: readonly T[]): readonly T[] {
  const seen = new Set<T>();
  const duplicates = new Set<T>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return Object.freeze([...duplicates]);
}

function diffValue(path: string, before: JsonValue, after: JsonValue, diffs: ChatRuntimeDiffEntry[]): void {
  if (isSameJson(before, after)) {
    return;
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    if (before.length !== after.length) {
      diffs.push({ path, before, after });
      return;
    }

    for (let index = 0; index < before.length; index += 1) {
      diffValue(`${path}[${index}]`, before[index] ?? null, after[index] ?? null, diffs);
    }
    return;
  }

  if (isJsonRecord(before) && isJsonRecord(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      diffValue(`${path}.${key}`, before[key] ?? null, after[key] ?? null, diffs);
    }
    return;
  }

  diffs.push({ path, before, after });
}

function isSameJson(left: JsonValue, right: JsonValue): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isVisibleChannel(value: unknown): value is ChatVisibleChannel {
  return value === 'GLOBAL' || value === 'SYNDICATE' || value === 'DEAL_ROOM' || value === 'LOBBY';
}

function isShadowChannel(value: unknown): value is ChatShadowChannel {
  return value === 'SYSTEM_SHADOW'
    || value === 'NPC_SHADOW'
    || value === 'RIVALRY_SHADOW'
    || value === 'RESCUE_SHADOW'
    || value === 'LIVEOPS_SHADOW';
}

function isJsonRecord(value: JsonValue | undefined): value is Readonly<Record<string, JsonValue>> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asNumber(value: JsonValue | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: JsonValue | undefined, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function decodeStringArray(value: JsonValue | undefined, fallback: readonly string[]): readonly string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  return Object.freeze(value.filter((entry): entry is string => typeof entry === 'string'));
}

function errorIssue(code: string, message: string, path: string): ChatRuntimeValidationIssue {
  return Object.freeze({ severity: 'ERROR', code, message, path });
}

function warningIssue(code: string, message: string, path: string): ChatRuntimeValidationIssue {
  return Object.freeze({ severity: 'WARNING', code, message, path });
}

// ============================================================================
// MARK: Descriptor helpers and exports for downstream policies
// ============================================================================

export function getVisibleChannelDescriptors(runtime: ChatRuntimeConfig): readonly ChatChannelDescriptor[] {
  return Object.freeze(runtime.allowVisibleChannels.map((channelId) => CHAT_CHANNEL_DESCRIPTORS[channelId]));
}

export function getShadowChannelDescriptors(runtime: ChatRuntimeConfig): readonly ChatChannelDescriptor[] {
  return Object.freeze(runtime.allowShadowChannels.map((channelId) => CHAT_CHANNEL_DESCRIPTORS[channelId]));
}

export function getChannelDescriptor(channelId: ChatChannelId): ChatChannelDescriptor {
  return CHAT_CHANNEL_DESCRIPTORS[channelId];
}

export function isChannelInRuntime(runtime: ChatRuntimeConfig, channelId: ChatChannelId): boolean {
  return (runtime.allowVisibleChannels as readonly ChatChannelId[]).includes(channelId) ||
         (runtime.allowShadowChannels as readonly ChatChannelId[]).includes(channelId);
}

export function getAllRuntimeChannelIds(runtime: ChatRuntimeConfig): readonly ChatChannelId[] {
  return Object.freeze([
    ...(runtime.allowVisibleChannels as readonly ChatChannelId[]),
    ...(runtime.allowShadowChannels as readonly ChatChannelId[]),
  ]);
}

export type { ChatChannelId };

export function runtimeAllowsVisibleChannel(runtime: ChatRuntimeConfig, channelId: ChatVisibleChannel): boolean {
  return runtime.allowVisibleChannels.includes(channelId);
}

export function runtimeAllowsShadowChannel(runtime: ChatRuntimeConfig, channelId: ChatShadowChannel): boolean {
  return runtime.allowShadowChannels.includes(channelId);
}

export function runtimeAllowsRoomKind(runtime: ChatRuntimeConfig, roomKind: ChatRoomKind): boolean {
  switch (roomKind) {
    case 'GLOBAL':
      return runtime.allowVisibleChannels.includes('GLOBAL');
    case 'SYNDICATE':
      return runtime.allowVisibleChannels.includes('SYNDICATE');
    case 'DEAL_ROOM':
      return runtime.allowVisibleChannels.includes('DEAL_ROOM');
    case 'LOBBY':
      return runtime.allowVisibleChannels.includes('LOBBY');
    case 'PRIVATE':
      return runtime.allowVisibleChannels.includes('SYNDICATE') || runtime.allowVisibleChannels.includes('DEAL_ROOM');
    case 'SYSTEM':
      return true;
    default:
      return false;
  }
}

// ============================================================================
// MARK: Convenience exports for room-specific override generation
// ============================================================================

export function createRoomKindOverride(kind: ChatRoomKind): Partial<ChatRuntimeConfig> {
  switch (kind) {
    case 'GLOBAL':
      return { allowVisibleChannels: ['GLOBAL', 'SYNDICATE'] as readonly ChatVisibleChannel[] };
    case 'SYNDICATE':
      return { allowVisibleChannels: ['SYNDICATE', 'GLOBAL'] as readonly ChatVisibleChannel[] };
    case 'DEAL_ROOM':
      return { allowVisibleChannels: ['DEAL_ROOM', 'SYNDICATE', 'GLOBAL'] as readonly ChatVisibleChannel[] };
    case 'LOBBY':
      return { allowVisibleChannels: ['LOBBY', 'GLOBAL'] as readonly ChatVisibleChannel[], invasionPolicy: { ...CHAT_RUNTIME_DEFAULTS.invasionPolicy, enabled: false, maxActivePerRoom: 0, allowShadowPriming: false } };
    case 'PRIVATE':
      return { allowVisibleChannels: ['SYNDICATE', 'DEAL_ROOM'] as readonly ChatVisibleChannel[], allowShadowChannels: ['SYSTEM_SHADOW', 'NPC_SHADOW', 'RIVALRY_SHADOW'] as readonly ChatShadowChannel[] };
    case 'SYSTEM':
      return { allowVisibleChannels: ['GLOBAL'] as readonly ChatVisibleChannel[], allowShadowChannels: ['SYSTEM_SHADOW', 'NPC_SHADOW', 'LIVEOPS_SHADOW'] as readonly ChatShadowChannel[] };
    default:
      return {};
  }
}

export function createMountOverride(mountTarget: ChatMountPolicy['mountTarget']): Partial<ChatRuntimeConfig> {
  const mount = CHAT_MOUNT_POLICIES[mountTarget];
  return {
    allowVisibleChannels: Object.freeze([...mount.allowedVisibleChannels]) as readonly ChatVisibleChannel[],
  };
}

// ============================================================================
// MARK: Final convenience alias
// ============================================================================

export const DEFAULT_BACKEND_CHAT_RUNTIME: ChatRuntimeConfig = createDefaultRuntimeConfig();

// ============================================================================
// MARK: Runtime config watch bus
// ============================================================================

export type RuntimeConfigWatchEvent =
  | { kind: 'CONFIG_MERGED'; resultKey: string }
  | { kind: 'OVERRIDE_APPLIED'; overrideKey: string };

export type RuntimeConfigWatchCallback = (event: RuntimeConfigWatchEvent) => void;

export class RuntimeConfigWatchBus {
  private readonly subscribers = new Set<RuntimeConfigWatchCallback>();

  subscribe(cb: RuntimeConfigWatchCallback): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  emit(event: RuntimeConfigWatchEvent): void {
    for (const cb of this.subscribers) {
      try { cb(event); } catch { /* isolate */ }
    }
  }

  size(): number { return this.subscribers.size; }
}

// ============================================================================
// MARK: Runtime config fingerprint
// ============================================================================

export interface RuntimeConfigFingerprint {
  readonly allowedRoomKinds: readonly string[];
  readonly allowedVisibleChannels: readonly string[];
  readonly maxMessageLength: number;
  readonly hash: string;
}

export function computeRuntimeConfigFingerprint(config: ChatRuntimeConfig): RuntimeConfigFingerprint {
  const maxMessageLength = config.moderationPolicy.maxCharactersPerMessage;
  const hash = [
    CHAT_ROOM_KINDS.join(','),
    (config.allowVisibleChannels ?? []).join(','),
    maxMessageLength,
  ].join('|');

  return Object.freeze({
    allowedRoomKinds: Object.freeze([...CHAT_ROOM_KINDS]),
    allowedVisibleChannels: Object.freeze([...(config.allowVisibleChannels ?? [])]),
    maxMessageLength,
    hash,
  });
}

// ============================================================================
// MARK: Runtime config diff
// ============================================================================

export interface RuntimeConfigDiff {
  readonly changedKeys: readonly string[];
  readonly addedChannels: readonly string[];
  readonly removedChannels: readonly string[];
  readonly addedRoomKinds: readonly string[];
  readonly removedRoomKinds: readonly string[];
}

export function diffRuntimeConfigs(
  before: ChatRuntimeConfig,
  after: ChatRuntimeConfig,
): RuntimeConfigDiff {
  const beforeChannels = new Set(before.allowVisibleChannels ?? []);
  const afterChannels = new Set(after.allowVisibleChannels ?? []);
  // Room kinds are a fixed registry — diff is always empty
  const addedRoomKinds: string[] = [];
  const removedRoomKinds: string[] = [];

  const addedChannels = [...afterChannels].filter((c) => !beforeChannels.has(c));
  const removedChannels = [...beforeChannels].filter((c) => !afterChannels.has(c));

  const changedKeys: string[] = [];
  if (before.moderationPolicy.maxCharactersPerMessage !== after.moderationPolicy.maxCharactersPerMessage) {
    changedKeys.push('maxMessageLength');
  }
  if (before.ratePolicy.typingHeartbeatWindowMs !== after.ratePolicy.typingHeartbeatWindowMs) {
    changedKeys.push('typingTimeoutMs');
  }
  if (addedChannels.length || removedChannels.length) changedKeys.push('allowVisibleChannels');

  return Object.freeze({
    changedKeys: Object.freeze(changedKeys),
    addedChannels: Object.freeze(addedChannels),
    removedChannels: Object.freeze(removedChannels),
    addedRoomKinds: Object.freeze(addedRoomKinds),
    removedRoomKinds: Object.freeze(removedRoomKinds),
  });
}

// ============================================================================
// MARK: Runtime config validator
// ============================================================================

export interface RuntimeConfigValidationResult {
  readonly valid: boolean;
  readonly violations: readonly string[];
}

export function validateRuntimeConfigStrict(config: ChatRuntimeConfig): RuntimeConfigValidationResult {
  const violations: string[] = [];

  const maxMsgLen = config.moderationPolicy.maxCharactersPerMessage;
  if (maxMsgLen !== undefined && maxMsgLen <= 0) {
    violations.push('maxMessageLength_must_be_positive');
  }
  const typingTimeout = config.ratePolicy.typingHeartbeatWindowMs;
  if (typingTimeout !== undefined && typingTimeout <= 0) {
    violations.push('typingTimeoutMs_must_be_positive');
  }
  if (config.allowVisibleChannels !== undefined && config.allowVisibleChannels.length === 0) {
    violations.push('allowVisibleChannels_must_not_be_empty');
  }

  return Object.freeze({
    valid: violations.length === 0,
    violations: Object.freeze(violations),
  });
}

// ============================================================================
// MARK: Room kind override builder
// ============================================================================

export function buildRoomKindRuntimeOverride(
  roomKind: ChatRoomKind,
  base: ChatRuntimeConfig = DEFAULT_BACKEND_CHAT_RUNTIME,
): ChatRuntimeConfig {
  const kindOverride = createRoomKindOverride(roomKind);
  return mergeRuntimeConfig({ ...base, ...kindOverride });
}

// ============================================================================
// MARK: Config preset library
// ============================================================================

export const RUNTIME_CONFIG_PRESETS = Object.freeze({
  DEFAULT: DEFAULT_BACKEND_CHAT_RUNTIME,
  GLOBAL_ONLY: mergeRuntimeConfig({ allowVisibleChannels: ['GLOBAL'] as ChatVisibleChannel[] }),
  DEAL_ROOM: mergeRuntimeConfig({ allowVisibleChannels: ['DEAL_ROOM', 'GLOBAL'] as ChatVisibleChannel[] }),
  SYNDICATE: mergeRuntimeConfig({ allowVisibleChannels: ['SYNDICATE', 'GLOBAL'] as ChatVisibleChannel[] }),
  LOBBY: mergeRuntimeConfig({ allowVisibleChannels: ['LOBBY', 'GLOBAL'] as ChatVisibleChannel[] }),
  FULL: mergeRuntimeConfig({ allowVisibleChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY'] as ChatVisibleChannel[] }),
} as const);

// ============================================================================
// MARK: Module constants
// ============================================================================

export const CHAT_RUNTIME_CONFIG_MODULE_NAME = 'ChatRuntimeConfig' as const;
export const CHAT_RUNTIME_CONFIG_MODULE_VERSION = '2026.03.14.2' as const;

export const CHAT_RUNTIME_CONFIG_MODULE_LAWS = Object.freeze([
  'Runtime config is always frozen before use.',
  'Channel allow lists are validated against mount policy.',
  'Merge is additive — unknown keys are dropped, not forwarded.',
  'Default config is computed once and exported as DEFAULT_BACKEND_CHAT_RUNTIME.',
  'Preset configs are frozen at module load time.',
]);

export const CHAT_RUNTIME_CONFIG_MODULE_DESCRIPTOR = Object.freeze({
  name: CHAT_RUNTIME_CONFIG_MODULE_NAME,
  version: CHAT_RUNTIME_CONFIG_MODULE_VERSION,
  laws: CHAT_RUNTIME_CONFIG_MODULE_LAWS,
  presets: Object.keys(RUNTIME_CONFIG_PRESETS),
});

export function createRuntimeConfigWatchBus(): RuntimeConfigWatchBus {
  return new RuntimeConfigWatchBus();
}

// ============================================================================
// MARK: Config chain merger (multiple sources)
// ============================================================================

export function mergeRuntimeConfigChain(
  ...configs: Partial<ChatRuntimeConfig>[]
): ChatRuntimeConfig {
  return configs.reduce<ChatRuntimeConfig>(
    (acc, cfg) => mergeRuntimeConfig({ ...acc, ...cfg }),
    createDefaultRuntimeConfig(),
  );
}

// ============================================================================
// MARK: Config audit report
// ============================================================================

export interface RuntimeConfigAuditReport {
  readonly allowedRoomKindCount: number;
  readonly allowedVisibleChannelCount: number;
  readonly shadowChannelCount: number;
  readonly maxMessageLength: number;
  readonly typingTimeoutMs: number;
  readonly validationResult: RuntimeConfigValidationResult;
}

export function buildRuntimeConfigAuditReport(
  config: ChatRuntimeConfig,
): RuntimeConfigAuditReport {
  return Object.freeze({
    allowedRoomKindCount: CHAT_ROOM_KINDS.length,
    allowedVisibleChannelCount: config.allowVisibleChannels?.length ?? 0,
    shadowChannelCount: config.allowShadowChannels?.length ?? 0,
    maxMessageLength: config.moderationPolicy.maxCharactersPerMessage,
    typingTimeoutMs: config.ratePolicy.typingHeartbeatWindowMs,
    validationResult: validateRuntimeConfigStrict(config),
  });
}

// ============================================================================
// MARK: Room-kind config resolver
// ============================================================================

export interface RoomKindConfigResolution {
  readonly roomKind: ChatRoomKind;
  readonly config: ChatRuntimeConfig;
  readonly channelCount: number;
  readonly hasNpcSupport: boolean;
}

export function resolveRoomKindConfig(roomKind: ChatRoomKind): RoomKindConfigResolution {
  const config = buildRoomKindRuntimeOverride(roomKind);
  const channelCount = config.allowVisibleChannels?.length ?? 0;
  const hasNpcSupport = config.invasionPolicy.enabled && (CHAT_ROOM_KINDS as readonly string[]).includes(roomKind);

  return Object.freeze({
    roomKind,
    config,
    channelCount,
    hasNpcSupport,
  });
}

// ============================================================================
// MARK: Config equality checker
// ============================================================================

export function runtimeConfigsAreEqual(a: ChatRuntimeConfig, b: ChatRuntimeConfig): boolean {
  const diff = diffRuntimeConfigs(a, b);
  return diff.changedKeys.length === 0 &&
    diff.addedChannels.length === 0 &&
    diff.removedChannels.length === 0 &&
    diff.addedRoomKinds.length === 0 &&
    diff.removedRoomKinds.length === 0;
}

// ============================================================================
// MARK: Extended module namespace
// ============================================================================

export const ChatRuntimeConfigModuleExtended = Object.freeze({
  createRuntimeConfigWatchBus,
  computeRuntimeConfigFingerprint,
  diffRuntimeConfigs,
  validateRuntimeConfig,
  validateRuntimeConfigStrict,
  buildRoomKindRuntimeOverride,
  mergeRuntimeConfigChain,
  buildRuntimeConfigAuditReport,
  resolveRoomKindConfig,
  runtimeConfigsAreEqual,
  runtimeConfigSummary,
  getEnabledFeaturesFromConfig,
  getAllowedRoomKindList,
  getAllowedChannelList,
  isChannelAllowedByConfig,
  isRoomKindAllowedByConfig,
  configHasChannel,
  getChannelDescriptor,
  isChannelInRuntime,
  getAllRuntimeChannelIds,
  getVisibleChannelDescriptors,
  getShadowChannelDescriptors,
  createRuntimeConfigSnapshotStore,
  getChannelOverridesForSourceType,
  RUNTIME_CONFIG_PRESETS,
  CHAT_RUNTIME_CONFIG_MODULE_DESCRIPTOR,
  CHAT_RUNTIME_CONFIG_MODULE_LAWS,
  DEFAULT_BACKEND_CHAT_RUNTIME,
} as const);

// ============================================================================
// MARK: Config snapshot store
// ============================================================================

export class RuntimeConfigSnapshotStore {
  private readonly snapshots: Array<{ config: ChatRuntimeConfig; recordedAt: UnixMs }> = [];

  record(config: ChatRuntimeConfig, now: UnixMs): void {
    this.snapshots.push(Object.freeze({ config, recordedAt: now }));
  }

  latest(): ChatRuntimeConfig | null {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1]!.config : null;
  }

  history(): readonly { config: ChatRuntimeConfig; recordedAt: UnixMs }[] {
    return this.snapshots;
  }

  count(): number { return this.snapshots.length; }
  reset(): void { this.snapshots.length = 0; }
}

// ============================================================================
// MARK: Source-type channel override
// ============================================================================

export function getChannelOverridesForSourceType(sourceType: string): Partial<ChatRuntimeConfig> {
  const overrides: Record<string, Partial<ChatRuntimeConfig>> = {
    PLAYER: { allowVisibleChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY'] as ChatVisibleChannel[] },
    NPC: { allowVisibleChannels: ['GLOBAL', 'SYNDICATE'] as ChatVisibleChannel[] },
    SYSTEM: { allowVisibleChannels: ['GLOBAL'] as ChatVisibleChannel[] },
    OPERATOR: { allowVisibleChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY'] as ChatVisibleChannel[] },
  };
  return overrides[sourceType] ?? {};
}

// ============================================================================
// MARK: Config equality summary
// ============================================================================

export function runtimeConfigSummary(config: ChatRuntimeConfig): string {
  return [
    `rooms:${CHAT_ROOM_KINDS.join(',')}`,
    `channels:${(config.allowVisibleChannels ?? []).join(',')}`,
    `maxLen:${config.moderationPolicy.maxCharactersPerMessage}`,
    `typing:${config.ratePolicy.typingHeartbeatWindowMs}ms`,
  ].join(' ');
}

export function createRuntimeConfigSnapshotStore(): RuntimeConfigSnapshotStore {
  return new RuntimeConfigSnapshotStore();
}

// ============================================================================
// MARK: Runtime config enabled features report
// ============================================================================

export interface RuntimeConfigEnabledFeatures {
  readonly npcEnabled: boolean;
  readonly replayEnabled: boolean;
  readonly presenceEnabled: boolean;
  readonly typingEnabled: boolean;
  readonly readReceiptsEnabled: boolean;
  readonly shadowWritesEnabled: boolean;
}

export function getEnabledFeaturesFromConfig(
  config: ChatRuntimeConfig,
): RuntimeConfigEnabledFeatures {
  return Object.freeze({
    npcEnabled: config.invasionPolicy.enabled,
    replayEnabled: config.replayPolicy.enabled,
    presenceEnabled: config.learningPolicy.enabled,
    typingEnabled: config.ratePolicy.typingHeartbeatWindowMs > 0,
    readReceiptsEnabled: config.proofPolicy.enabled,
    shadowWritesEnabled: config.allowShadowChannels.length > 0,
  });
}

export const CHAT_RUNTIME_CONFIG_MODULE_VERSION_EXTENDED = '2026.03.14.2' as const;

export function isChannelAllowedByConfig(config: ChatRuntimeConfig, channel: ChatVisibleChannel): boolean {
  return runtimeAllowsVisibleChannel(config, channel);
}

export function isRoomKindAllowedByConfig(config: ChatRuntimeConfig, roomKind: ChatRoomKind): boolean {
  return runtimeAllowsRoomKind(config, roomKind);
}

export function getAllowedChannelList(config: ChatRuntimeConfig): readonly ChatVisibleChannel[] {
  return config.allowVisibleChannels ?? [];
}

export function getAllowedRoomKindList(_config: ChatRuntimeConfig): readonly ChatRoomKind[] {
  return CHAT_ROOM_KINDS;
}

export function configHasChannel(config: ChatRuntimeConfig, channel: ChatVisibleChannel): boolean {
  return (config.allowVisibleChannels ?? []).includes(channel);
}
