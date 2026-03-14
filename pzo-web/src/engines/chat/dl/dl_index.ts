
// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/intelligence/dl/index.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT DL PUBLIC BARREL
 * FILE: pzo-web/src/engines/chat/intelligence/dl/index.ts
 * ============================================================================
 */

export * from './MessageEmbeddingClient';
export * from './DialogueIntentEncoder';
export * from './ConversationStateEncoder';
export * from './ResponseRankerClient';
export * from './SequenceMemoryClient';

import {
  CHAT_MESSAGE_EMBEDDING_CLIENT_MANIFEST,
  MessageEmbeddingClient,
  createMessageEmbeddingClient,
} from './MessageEmbeddingClient';

import {
  CHAT_DIALOGUE_INTENT_ENCODER_MANIFEST,
  DialogueIntentEncoder,
  createDialogueIntentEncoder,
} from './DialogueIntentEncoder';

import {
  CHAT_CONVERSATION_STATE_ENCODER_MANIFEST,
  ConversationStateEncoder,
  createConversationStateEncoder,
} from './ConversationStateEncoder';

import {
  CHAT_RESPONSE_RANKER_CLIENT_MANIFEST,
  ResponseRankerClient,
  createResponseRankerClient,
} from './ResponseRankerClient';

import {
  CHAT_SEQUENCE_MEMORY_CLIENT_MANIFEST,
  SequenceMemoryClient,
  createSequenceMemoryClient,
} from './SequenceMemoryClient';

export const CHAT_DL_MODULE_NAME =
  'PZO_FRONTEND_CHAT_DL' as const;

export const CHAT_DL_PUBLIC_MANIFEST = Object.freeze({
  moduleName: CHAT_DL_MODULE_NAME,
  embedding: CHAT_MESSAGE_EMBEDDING_CLIENT_MANIFEST,
  intent: CHAT_DIALOGUE_INTENT_ENCODER_MANIFEST,
  conversationState: CHAT_CONVERSATION_STATE_ENCODER_MANIFEST,
  responseRanker: CHAT_RESPONSE_RANKER_CLIENT_MANIFEST,
  sequenceMemory: CHAT_SEQUENCE_MEMORY_CLIENT_MANIFEST,
} as const);

export const ChatDL = Object.freeze({
  MessageEmbeddingClient,
  createMessageEmbeddingClient,
  DialogueIntentEncoder,
  createDialogueIntentEncoder,
  ConversationStateEncoder,
  createConversationStateEncoder,
  ResponseRankerClient,
  createResponseRankerClient,
  SequenceMemoryClient,
  createSequenceMemoryClient,
  manifest: CHAT_DL_PUBLIC_MANIFEST,
} as const);
