/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT ENGINE
 * FILE: pzo-web/src/engines/chat/channels/index.ts
 * ============================================================================
 *
 * Canonical export surface for chat channel policy modules.
 *
 * This file stays intentionally thin. Channel-specific policy files own the
 * actual logic. The index only provides one stable import surface for the rest
 * of the chat engine.
 */

export {
  GlobalChannelPolicy,
  globalChannelPolicy,
  GLOBAL_ALLOW_MATRIX,
  GLOBAL_AVAILABLE_MODES,
  GLOBAL_HATER_MESSAGE_KINDS,
  GLOBAL_MODE_FAMILY_MAP,
  GLOBAL_MODE_PROFILES,
  GLOBAL_PLAYER_MESSAGE_KINDS,
  GLOBAL_SUPPORT_MESSAGE_KINDS,
  GLOBAL_SURFACE_PROFILES,
  GLOBAL_SUPPORTED_MOUNT_SURFACES,
  GLOBAL_SYSTEM_MESSAGE_KINDS,
  buildGlobalChannelSnapshot,
  clamp,
  clamp01,
  coercePressureTier,
  createGlobalHaterMessage,
  createGlobalHelperMessage,
  createGlobalPlayerMessage,
  createGlobalSystemMessage,
  deriveAudienceHeatBand,
  deriveCrowdMood,
  evaluateGlobalComposerCapability,
  evaluateGlobalInjectResult,
  evaluateGlobalLayout,
  hashBody,
  surfaceProfile,
  modeProfile,
} from './GlobalChannelPolicy';

export type {
  GlobalActorRef,
  GlobalAudienceHeatBand,
  GlobalAudienceState,
  GlobalChannelHealth,
  GlobalChannelId,
  GlobalChannelSnapshot,
  GlobalComposerCapability,
  GlobalCrowdMood,
  GlobalFeatureLayout,
  GlobalGameplayState,
  GlobalInjectDecision,
  GlobalInjectResult,
  GlobalMessageEnvelope,
  GlobalMessageKind,
  GlobalModeFamily,
  GlobalModeProfile,
  GlobalMountSurface,
  GlobalNotificationHint,
  GlobalPolicyInput,
  GlobalPolicyReason,
  GlobalRatePolicy,
  GlobalRateState,
  GlobalRecommendation,
  GlobalRunMode,
  GlobalSeverity,
  GlobalSpeakerClass,
  GlobalSurfaceContext,
  GlobalSurfaceProfile,
  GlobalTickTier,
  GlobalVisibilityBand,
} from './GlobalChannelPolicy';
