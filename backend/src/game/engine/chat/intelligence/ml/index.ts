/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT INTELLIGENCE ML BARREL
 * FILE: backend/src/game/engine/chat/intelligence/ml/index.ts
 * VERSION: 2026.03.21-backend-chat-intelligence-ml-index.v3
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 */

export {
  CHAT_ATTACHMENT_MODEL_DEFAULTS,
  CHAT_ATTACHMENT_MODEL_MODULE_NAME,
  CHAT_ATTACHMENT_MODEL_RUNTIME_LAWS,
  CHAT_ATTACHMENT_MODEL_VERSION,
  AttachmentModel,
  assessAttachment,
  createAttachmentModel,
} from './AttachmentModel';

export type {
  AttachmentAffinityCandidate,
  AttachmentAssessment,
  AttachmentModelApi,
  AttachmentModelInput,
  AttachmentModelOptions,
  AttachmentNarrativeState,
} from './AttachmentModel';

export {
  CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS,
  CHAT_PRESSURE_AFFECT_MODEL_MODULE_NAME,
  CHAT_PRESSURE_AFFECT_MODEL_VERSION,
  createPressureAffectModel,
} from './PressureAffectModel';

export type {
  PressureAffectModelApi,
  PressureAffectModelInput,
  PressureAffectResult,
} from './PressureAffectModel';

export {
  CHAT_EMOTION_MODEL_DEFAULTS,
  CHAT_EMOTION_MODEL_MODULE_NAME,
  CHAT_EMOTION_MODEL_RUNTIME_LAWS,
  CHAT_EMOTION_MODEL_VERSION,
  EmotionModel,
  createEmotionModel,
  evaluateEmotionModel,
  summarizeEmotionModel,
} from './EmotionModel';

export type {
  EmotionModelApi,
  EmotionModelInput,
  EmotionModelOptions,
  EmotionModelRecommendation,
  EmotionModelResult,
} from './EmotionModel';

export const CHAT_INTELLIGENCE_ML_INDEX_VERSION =
  '2026.03.21-backend-chat-intelligence-ml-index.v3' as const;

export const CHAT_INTELLIGENCE_ML_SURFACE = Object.freeze({
  version: CHAT_INTELLIGENCE_ML_INDEX_VERSION,
  exports: Object.freeze([
    'AttachmentModel',
    'createAttachmentModel',
    'assessAttachment',
    'CHAT_ATTACHMENT_MODEL_MODULE_NAME',
    'CHAT_ATTACHMENT_MODEL_VERSION',
    'CHAT_ATTACHMENT_MODEL_DEFAULTS',
    'CHAT_ATTACHMENT_MODEL_RUNTIME_LAWS',
    'createPressureAffectModel',
    'CHAT_PRESSURE_AFFECT_MODEL_MODULE_NAME',
    'CHAT_PRESSURE_AFFECT_MODEL_VERSION',
    'CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS',
    'EmotionModel',
    'createEmotionModel',
    'evaluateEmotionModel',
    'summarizeEmotionModel',
    'CHAT_EMOTION_MODEL_MODULE_NAME',
    'CHAT_EMOTION_MODEL_VERSION',
    'CHAT_EMOTION_MODEL_DEFAULTS',
    'CHAT_EMOTION_MODEL_RUNTIME_LAWS',
  ] as const),
});