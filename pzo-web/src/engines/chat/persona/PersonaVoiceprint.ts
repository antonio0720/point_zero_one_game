/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT PERSONA VOICEPRINT RUNTIME
 * FILE: pzo-web/src/engines/chat/persona/PersonaVoiceprint.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Frontend runtime adapter that turns shared NPC persona / cadence law into a
 * deterministic presentation model for:
 * - message composition hints
 * - signature opener / closer selection
 * - punctuation and sentence-shape enforcement
 * - relationship-aware tone adjustment
 * - audience-heat / reputation-aware public-private pressure tuning
 * - message-fit auditing against authored NPC voiceprints
 * - continuity-friendly persona carryover between scenes and mounts
 *
 * Design laws
 * -----------
 * 1. Shared contracts stay the long-term authority for who an NPC is.
 * 2. Backend remains authority for what enters truth.
 * 3. Frontend may project authored identity for staging, previews, typing,
 *    animation, tone-shaping, and UI hinting.
 * 4. Runtime adapters must preserve donor vocabulary rather than flattening the
 *    experience into generic "bot style" logic.
 * 5. A voiceprint is not only text styling. It also governs pacing pressure,
 *    interruption appetite, witness appetite, callback appetite, and privacy.
 * 6. Public channels and shadow channels should feel different even before the
 *    user reads the line.
 *
 * Scope
 * -----
 * This file does not choose canonical lines. It scores and shapes persona
 * presentation from the lawful surfaces already owned by:
 * - /shared/contracts/chat/ChatNpc.ts
 * - /shared/contracts/chat/persona-evolution.ts
 * - /pzo-web/src/engines/chat/types.ts
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import type {
  ChatAudienceHeat,
  ChatChannelMood,
  ChatEngineState,
  ChatMessage,
  ChatPersonaVoiceprint as FrontendChatPersonaVoiceprint,
  ChatRelationshipState,
  ChatReputationState,
  ChatVisibleChannel,
} from '../types';

import {
  getNpcDescriptor,
  type ChatAnyNpcDescriptor,
  type ChatKnownNpcKey,
  type ChatNpcCadenceProfile,
  type ChatNpcVoiceprint,
} from '../../../../../shared/contracts/chat/ChatNpc';

import {
  resolvePersonaStage,
  type ChatPersonaEvolutionProfile,
  type ChatPersonaSplitMode,
  type ChatPersonaStageId,
  type ChatPersonaTemperament,
  type ChatPersonaTransformBias,
} from '../../../../../shared/contracts/chat/persona-evolution';

// ============================================================================
// MARK: Local runtime types
// ============================================================================

export type PersonaRenderMode =
  | 'MESSAGE_RENDER'
  | 'TYPING_PREVIEW'
  | 'COMPOSER_PROJECTION'
  | 'SCENE_STAGING'
  | 'SIGNATURE_ONLY'
  | 'READ_RECEIPT_ECHO';

export type PersonaHeatBand =
  | 'ICE'
  | 'COOL'
  | 'ACTIVE'
  | 'HOT'
  | 'SWARMING';

export type PersonaWitnessBand =
  | 'PRIVATE'
  | 'LIMITED'
  | 'PUBLIC'
  | 'ARENA'
  | 'MYTHIC';

export type PersonaPressureMode =
  | 'NONE'
  | 'HUNT'
  | 'RIDICULE'
  | 'SCRUTINY'
  | 'CEREMONY'
  | 'RESCUE'
  | 'WHISPER';

export interface PersonaLexiconWeight {
  readonly tag: string;
  readonly weight01: number;
  readonly reasons: readonly string[];
}

export interface PersonaSentencePolicy {
  readonly minimumSentences: number;
  readonly preferredSentences: number;
  readonly maximumSentences: number;
  readonly sentenceLengthShape: 'SHORT' | 'BALANCED' | 'LONG';
  readonly fragmentTolerance01: number;
  readonly clauseDensity01: number;
  readonly openerWeight01: number;
  readonly closerWeight01: number;
}

export interface PersonaPunctuationPolicy {
  readonly style: ChatNpcVoiceprint['punctuationStyle'];
  readonly periodWeight01: number;
  readonly commaWeight01: number;
  readonly ellipsisWeight01: number;
  readonly dashWeight01: number;
  readonly exclamationWeight01: number;
  readonly questionWeight01: number;
  readonly colonWeight01: number;
  readonly semicolonWeight01: number;
  readonly uppercaseTolerance01: number;
  readonly lowercasePreference01: number;
}

export interface PersonaSignaturePacket {
  readonly opener?: string;
  readonly closer?: string;
  readonly openerSelectedFrom: readonly string[];
  readonly closerSelectedFrom: readonly string[];
  readonly openerConfidence01: number;
  readonly closerConfidence01: number;
}

export interface PersonaProjectionContext {
  readonly channelId: ChatVisibleChannel;
  readonly renderMode: PersonaRenderMode;
  readonly now: number;
  readonly playerId?: string | null;
  readonly messageBody?: string;
  readonly sceneId?: string;
  readonly momentId?: string;
  readonly allowOpeners?: boolean;
  readonly allowClosers?: boolean;
  readonly preferShortForm?: boolean;
  readonly preferLongForm?: boolean;
  readonly forcePrivateBias?: boolean;
  readonly forcePublicBias?: boolean;
  readonly preferredLexiconTags?: readonly string[];
  readonly excludedLexiconTags?: readonly string[];
}

export interface PersonaVoiceprintProjection {
  readonly npcKey: ChatKnownNpcKey;
  readonly npcId: string;
  readonly personaId: string;
  readonly displayName: string;
  readonly renderMode: PersonaRenderMode;
  readonly channelId: ChatVisibleChannel;
  readonly heatBand: PersonaHeatBand;
  readonly witnessBand: PersonaWitnessBand;
  readonly pressureMode: PersonaPressureMode;
  readonly stage: ChatPersonaStageId;
  readonly splitMode: ChatPersonaSplitMode;
  readonly temperament: ChatPersonaTemperament;
  readonly transformBiases: readonly ChatPersonaTransformBias[];
  readonly voiceprint: ChatNpcVoiceprint;
  readonly cadence: ChatNpcCadenceProfile;
  readonly frontendVoiceprint: FrontendChatPersonaVoiceprint;
  readonly punctuation: PersonaPunctuationPolicy;
  readonly sentencePolicy: PersonaSentencePolicy;
  readonly signature: PersonaSignaturePacket;
  readonly lexiconWeights: readonly PersonaLexiconWeight[];
  readonly publicPressureBias01: number;
  readonly privatePressureBias01: number;
  readonly callbackAggression01: number;
  readonly playerSpecificity01: number;
  readonly seasonalAbsorption01: number;
  readonly intimacyEscalation01: number;
  readonly prophecyCadence01: number;
  readonly relationshipPressure01: number;
  readonly ridiculePressure01: number;
  readonly scrutinyPressure01: number;
  readonly mercyPressure01: number;
  readonly confidenceShock01: number;
  readonly notes: readonly string[];
}

export interface PersonaMessageVoiceFit {
  readonly npcKey: ChatKnownNpcKey;
  readonly score01: number;
  readonly openerMatch01: number;
  readonly closerMatch01: number;
  readonly punctuationMatch01: number;
  readonly sentenceShapeMatch01: number;
  readonly lexiconMatch01: number;
  readonly temperatureMatch01: number;
  readonly lowercaseMatch01: number;
  readonly reasons: readonly string[];
}

export interface PersonaVoiceprintDiagnostics {
  readonly cacheEntries: number;
  readonly lastProjectionKeys: readonly string[];
  readonly lastFitKeys: readonly string[];
}

interface PersonaProjectionCacheEntry {
  readonly cacheKey: string;
  readonly projection: PersonaVoiceprintProjection;
  readonly createdAt: number;
}

interface PersonaFitCacheEntry {
  readonly cacheKey: string;
  readonly fit: PersonaMessageVoiceFit;
  readonly createdAt: number;
}

// ============================================================================
// MARK: Constants
// ============================================================================

const PERSONA_PROJECTION_CACHE_LIMIT = 512;
const PERSONA_FIT_CACHE_LIMIT = 512;

const DEFAULT_PLAYER_ID = 'player:self';

const HEAT_BAND_THRESHOLDS = Object.freeze({
  ICE: 14,
  COOL: 34,
  ACTIVE: 58,
  HOT: 78,
});

const WITNESS_BAND_THRESHOLDS = Object.freeze({
  PRIVATE: 10,
  LIMITED: 28,
  PUBLIC: 56,
  ARENA: 80,
});

const CHANNEL_PRIVATE_BIAS = Object.freeze<Record<ChatVisibleChannel, number>>({
  GLOBAL: 0.02,
  SYNDICATE: 0.26,
  DEAL_ROOM: 0.38,
  LOBBY: 0.08,
});

const CHANNEL_PUBLIC_BIAS = Object.freeze<Record<ChatVisibleChannel, number>>({
  GLOBAL: 0.44,
  SYNDICATE: 0.10,
  DEAL_ROOM: 0.06,
  LOBBY: 0.24,
});

const CHANNEL_PRESSURE_MODE = Object.freeze<Record<ChatVisibleChannel, PersonaPressureMode>>({
  GLOBAL: 'RIDICULE',
  SYNDICATE: 'WHISPER',
  DEAL_ROOM: 'SCRUTINY',
  LOBBY: 'CEREMONY',
});

const MOOD_TO_PRESSURE_MODE: Readonly<Record<string, PersonaPressureMode>> = Object.freeze({
  CALM: 'NONE',
  SUSPICIOUS: 'SCRUTINY',
  HOSTILE: 'HUNT',
  ECSTATIC: 'CEREMONY',
  PREDATORY: 'SCRUTINY',
  MOURNFUL: 'RESCUE',
});

const PUNCTUATION_WEIGHT_PRESETS = Object.freeze<
  Record<ChatNpcVoiceprint['punctuationStyle'], Omit<PersonaPunctuationPolicy, 'style'>>
>({
  SPARSE: {
    periodWeight01: 0.22,
    commaWeight01: 0.10,
    ellipsisWeight01: 0.05,
    dashWeight01: 0.03,
    exclamationWeight01: 0.03,
    questionWeight01: 0.08,
    colonWeight01: 0.02,
    semicolonWeight01: 0.01,
    uppercaseTolerance01: 0.08,
    lowercasePreference01: 0.34,
  },
  SHARP: {
    periodWeight01: 0.34,
    commaWeight01: 0.14,
    ellipsisWeight01: 0.02,
    dashWeight01: 0.14,
    exclamationWeight01: 0.07,
    questionWeight01: 0.08,
    colonWeight01: 0.04,
    semicolonWeight01: 0.01,
    uppercaseTolerance01: 0.16,
    lowercasePreference01: 0.08,
  },
  ELLIPTICAL: {
    periodWeight01: 0.10,
    commaWeight01: 0.12,
    ellipsisWeight01: 0.34,
    dashWeight01: 0.06,
    exclamationWeight01: 0.03,
    questionWeight01: 0.09,
    colonWeight01: 0.01,
    semicolonWeight01: 0.01,
    uppercaseTolerance01: 0.10,
    lowercasePreference01: 0.38,
  },
  FORMAL: {
    periodWeight01: 0.32,
    commaWeight01: 0.28,
    ellipsisWeight01: 0.01,
    dashWeight01: 0.03,
    exclamationWeight01: 0.01,
    questionWeight01: 0.05,
    colonWeight01: 0.12,
    semicolonWeight01: 0.08,
    uppercaseTolerance01: 0.04,
    lowercasePreference01: 0.01,
  },
  LOUD: {
    periodWeight01: 0.16,
    commaWeight01: 0.08,
    ellipsisWeight01: 0.01,
    dashWeight01: 0.08,
    exclamationWeight01: 0.36,
    questionWeight01: 0.12,
    colonWeight01: 0.02,
    semicolonWeight01: 0.01,
    uppercaseTolerance01: 0.52,
    lowercasePreference01: 0.00,
  },
});

const SENTENCE_POLICY_PRESETS = Object.freeze<
  Record<ChatNpcVoiceprint['averageSentenceLength'], PersonaSentencePolicy>
>({
  SHORT: {
    minimumSentences: 1,
    preferredSentences: 1,
    maximumSentences: 3,
    sentenceLengthShape: 'SHORT',
    fragmentTolerance01: 0.48,
    clauseDensity01: 0.20,
    openerWeight01: 0.62,
    closerWeight01: 0.46,
  },
  MEDIUM: {
    minimumSentences: 1,
    preferredSentences: 2,
    maximumSentences: 4,
    sentenceLengthShape: 'BALANCED',
    fragmentTolerance01: 0.28,
    clauseDensity01: 0.44,
    openerWeight01: 0.48,
    closerWeight01: 0.42,
  },
  LONG: {
    minimumSentences: 2,
    preferredSentences: 3,
    maximumSentences: 5,
    sentenceLengthShape: 'LONG',
    fragmentTolerance01: 0.12,
    clauseDensity01: 0.72,
    openerWeight01: 0.26,
    closerWeight01: 0.38,
  },
});

const TEMPERAMENT_TO_TEMPERATURE: Readonly<Record<ChatPersonaTemperament, FrontendChatPersonaVoiceprint['emotionalTemperature']>> = Object.freeze({
  COLD: 'ICE',
  CALCULATED: 'CONTROLLED',
  PREDATORY: 'COLD',
  SARDONIC: 'CONTROLLED',
  CEREMONIAL: 'WARM',
  HUNTING: 'VOLCANIC',
  ADMIRING: 'WARM',
});

const TRANSFORM_BIAS_NOTES: Readonly<Record<ChatPersonaTransformBias, string>> = Object.freeze({
  SHORTER_COLDER: 'Bias shortens and cools delivery.',
  LONGER_CEREMONIAL: 'Bias increases ceremony and authored witness cadence.',
  MORE_DIRECT: 'Bias strips hedging and leans into directness.',
  MORE_MOCKING: 'Bias raises ridicule appetite.',
  MORE_INTIMATE: 'Bias increases private relationship specificity.',
  MORE_PUBLIC: 'Bias increases witness-facing pressure.',
  MORE_POST_EVENT: 'Bias weights aftermath and witness callbacks.',
  MORE_PRE_EVENT: 'Bias weights pre-event telegraph posture.',
  PRESSURE_REWRITE: 'Bias routes through pressure language.',
  CALLBACK_REWRITE: 'Bias routes through callback appetite.',
  PERSONAL_HISTORY_REWRITE: 'Bias routes through remembered history.',
});

const LEXICON_SYNONYM_WEIGHTS = Object.freeze<Record<string, readonly string[]>>({
  distress: ['pressure', 'panic', 'bleed', 'collapse'],
  liquidity: ['liquidity', 'cash', 'burn', 'float'],
  exposure: ['exposed', 'visible', 'open', 'naked'],
  forms: ['forms', 'paperwork', 'filing', 'process'],
  compliance: ['compliance', 'policy', 'approval', 'review'],
  processing: ['processing', 'queue', 'delay', 'hold'],
  control: ['control', 'grip', 'leverage', 'steer'],
  leverage: ['leverage', 'pressure', 'angle', 'advantage'],
  doubt: ['doubt', 'hesitation', 'uncertainty', 'second-guess'],
  macro: ['macro', 'cycle', 'market', 'regime'],
  volatility: ['volatility', 'swing', 'whiplash', 'spike'],
  correction: ['correction', 'flush', 'drawdown', 'reversal'],
  status: ['status', 'class', 'inheritance', 'pedigree'],
  inheritance: ['inheritance', 'legacy', 'birthright', 'dynasty'],
  dynasty: ['dynasty', 'legacy', 'lineage', 'family'],
  guidance: ['guide', 'steady', 'anchor', 'discipline'],
  discipline: ['discipline', 'control', 'hold', 'plan'],
  anchor: ['anchor', 'breath', 'center', 'ground'],
  signal: ['signal', 'edge', 'read', 'pattern'],
  intel: ['intel', 'tip', 'window', 'line'],
  endurance: ['endure', 'survive', 'keep moving', 'still here'],
  recovery: ['recover', 'rebuild', 'reset', 'regain'],
  competitive: ['prove', 'again', 'edge', 'beat'],
  lore: ['history', 'record', 'archive', 'remember'],
  speed: ['fast', 'movement', 'rush', 'burst'],
  whisper: ['quiet', 'private', 'keep it close', 'whisper'],
  offer: ['offer', 'counter', 'price', 'terms'],
  ledger: ['ledger', 'record', 'logged', 'book'],
  rumor: ['rumor', 'heard', 'buzz', 'speculation'],
  witness: ['witness', 'seen', 'marked', 'remembered'],
  public: ['public', 'room', 'all saw', 'crowd'],
  memory: ['memory', 'last time', 'remember', 'again'],
});

// ============================================================================
// MARK: Generic utilities
// ============================================================================

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Number(value.toFixed(6));
}

function clamp100(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 100) return 100;
  return Number(value.toFixed(3));
}

function average(values: readonly number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function tokenizeLower(body?: string): readonly string[] {
  if (!body) return [];
  return body
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function countMatches(tokens: readonly string[], candidates: readonly string[]): number {
  if (!tokens.length || !candidates.length) return 0;
  const tokenSet = new Set(tokens);
  let matches = 0;
  for (const candidate of candidates) {
    if (tokenSet.has(candidate.toLowerCase())) matches += 1;
  }
  return matches;
}

function sentenceCount(body?: string): number {
  if (!body) return 0;
  return body
    .split(/(?<=[.!?])\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean).length;
}

function averageWordsPerSentence(body?: string): number {
  const sentences = sentenceCount(body);
  if (!body || sentences <= 0) return 0;
  const words = tokenizeLower(body).length;
  return words / sentences;
}

function lowercaseRatio(body?: string): number {
  if (!body) return 0;
  const letters = body.replace(/[^A-Za-z]/g, '');
  if (!letters.length) return 0;
  const lower = letters.replace(/[^a-z]/g, '').length;
  return lower / letters.length;
}

function punctuationRatio(body: string | undefined, token: string): number {
  if (!body || body.length <= 0) return 0;
  const count = (body.match(new RegExp(`\\${token}`, 'g')) ?? []).length;
  return count / Math.max(1, body.length);
}

function formatHeatBand(heat: ChatAudienceHeat): PersonaHeatBand {
  if (heat.heat <= HEAT_BAND_THRESHOLDS.ICE) return 'ICE';
  if (heat.heat <= HEAT_BAND_THRESHOLDS.COOL) return 'COOL';
  if (heat.heat <= HEAT_BAND_THRESHOLDS.ACTIVE) return 'ACTIVE';
  if (heat.heat <= HEAT_BAND_THRESHOLDS.HOT) return 'HOT';
  return 'SWARMING';
}

function deriveWitnessBand(heat: ChatAudienceHeat, mood: ChatChannelMood): PersonaWitnessBand {
  const witnessScore = clamp100(
    heat.hype * 0.25 +
      heat.scrutiny * 0.30 +
      heat.ridicule * 0.20 +
      heat.volatility * 0.15 +
      (mood.mood === 'ECSTATIC' ? 18 : 0) +
      (mood.mood === 'HOSTILE' ? 12 : 0) +
      (mood.mood === 'MOURNFUL' ? 10 : 0),
  );
  if (witnessScore <= WITNESS_BAND_THRESHOLDS.PRIVATE) return 'PRIVATE';
  if (witnessScore <= WITNESS_BAND_THRESHOLDS.LIMITED) return 'LIMITED';
  if (witnessScore <= WITNESS_BAND_THRESHOLDS.PUBLIC) return 'PUBLIC';
  if (witnessScore <= WITNESS_BAND_THRESHOLDS.ARENA) return 'ARENA';
  return 'MYTHIC';
}

function resolvePressureMode(
  channelId: ChatVisibleChannel,
  mood: ChatChannelMood,
  heat: ChatAudienceHeat,
): PersonaPressureMode {
  if (mood.mood === 'HOSTILE' && heat.ridicule >= 64) return 'RIDICULE';
  if (mood.mood === 'HOSTILE' && heat.scrutiny >= 55) return 'HUNT';
  if (mood.mood === 'PREDATORY') return 'SCRUTINY';
  if (mood.mood === 'MOURNFUL') return 'RESCUE';
  if (mood.mood === 'SUSPICIOUS') return 'WHISPER';
  if (mood.mood === 'ECSTATIC' && heat.hype >= 60) return 'CEREMONY';
  return CHANNEL_PRESSURE_MODE[channelId];
}

function getChannelHeat(state: ChatEngineState, channelId: ChatVisibleChannel): ChatAudienceHeat {
  return state.audienceHeat[channelId];
}

function getChannelMood(state: ChatEngineState, channelId: ChatVisibleChannel): ChatChannelMood {
  return state.channelMoodByChannel[channelId];
}

function getRelationshipForDescriptor(
  state: ChatEngineState,
  descriptor: ChatAnyNpcDescriptor,
): ChatRelationshipState | undefined {
  return (
    state.relationshipsByCounterpartId[descriptor.npcId] ??
    state.relationshipsByCounterpartId[descriptor.personaId] ??
    state.relationshipsByCounterpartId[descriptor.displayName]
  );
}

function buildEvolutionProfile(
  state: ChatEngineState,
  descriptor: ChatAnyNpcDescriptor,
  channelId: ChatVisibleChannel,
): ChatPersonaEvolutionProfile {
  const relationship = getRelationshipForDescriptor(state, descriptor);
  const messages = state.messagesByChannel[channelId].filter(
    (message) => message.senderId === descriptor.npcId || message.senderName === descriptor.displayName,
  );
  const meaningfulEvents =
    messages.length +
    (relationship?.callbacksAvailable.length ?? 0) +
    (relationship ? 4 : 0) +
    (state.continuity.carriedPersonaIds.includes(descriptor.personaId) ? 12 : 0);
  const careerRuns =
    state.continuity.unresolvedMomentIds.length +
    (state.continuity.carriedPersonaIds.includes(descriptor.personaId) ? 8 : 0) +
    Math.round((messages.length + (relationship ? 6 : 0)) / 3);

  const stage = resolvePersonaStage(careerRuns, meaningfulEvents);

  const publicPressureBias01 = clamp01(
    CHANNEL_PUBLIC_BIAS[channelId] +
      ((state.audienceHeat[channelId].scrutiny + state.audienceHeat[channelId].ridicule) / 200) * 0.45 +
      (state.audienceHeat[channelId].hype / 100) * 0.12,
  );

  const privatePressureBias01 = clamp01(
    CHANNEL_PRIVATE_BIAS[channelId] +
      ((relationship?.vector.familiarity ?? 0) / 100) * 0.28 +
      ((relationship?.vector.trust ?? 0) / 100) * 0.16 +
      (channelId === 'DEAL_ROOM' ? 0.12 : 0),
  );

  const callbackAggression01 = clamp01(
    ((relationship?.vector.rivalryIntensity ?? 0) / 100) * 0.48 +
      ((relationship?.vector.contempt ?? 0) / 100) * 0.32 +
      ((relationship?.callbacksAvailable.length ?? 0) / 12) * 0.20,
  );

  const playerSpecificity01 = clamp01(
    ((relationship?.vector.familiarity ?? 0) / 100) * 0.55 +
      ((relationship?.vector.fascination ?? 0) / 100) * 0.22 +
      (state.continuity.carriedPersonaIds.includes(descriptor.personaId) ? 0.18 : 0),
  );

  const seasonalAbsorption01 = clamp01(
    (state.liveOps.activeWorldEvents.length / 4) * 0.45 +
      (state.liveOps.boostedCrowdChannels.includes(channelId) ? 0.20 : 0) +
      (state.liveOps.helperBlackoutActive ? 0.08 : 0),
  );

  const intimacyEscalation01 = clamp01(
    ((relationship?.vector.trust ?? 0) / 100) * 0.32 +
      ((relationship?.vector.rescueDebt ?? 0) / 100) * 0.18 +
      ((relationship?.vector.familiarity ?? 0) / 100) * 0.22,
  );

  const prophecyCadence01 = clamp01(
    (descriptor.sceneRoles.includes('CLOSER') ? 0.18 : 0) +
      (descriptor.sceneRoles.includes('CROWD_WITNESS') ? 0.16 : 0) +
      (state.audienceHeat[channelId].volatility / 100) * 0.24 +
      (stage === 'MYTHIC' ? 0.20 : stage === 'RIVALRIC' ? 0.10 : 0),
  );

  const splitMode: ChatPersonaSplitMode =
    privatePressureBias01 - publicPressureBias01 >= 0.14
      ? 'PRIVATE'
      : publicPressureBias01 - privatePressureBias01 >= 0.14
        ? 'PUBLIC'
        : 'BALANCED';

  const temperament: ChatPersonaTemperament = resolveTemperament(
    descriptor,
    state.reputation,
    relationship,
    state.audienceHeat[channelId],
  );

  const activeTransformBiases = deriveTransformBiases({
    descriptor,
    channelId,
    stage,
    splitMode,
    relationship,
    heat: state.audienceHeat[channelId],
    mood: state.channelMoodByChannel[channelId],
  });

  return {
    playerId: DEFAULT_PLAYER_ID,
    botId: descriptor.npcId,
    stage,
    splitMode,
    temperament,
    vector: {
      toneHardening01: clamp01(
        ((relationship?.vector.contempt ?? 0) / 100) * 0.28 +
          ((relationship?.vector.fear ?? 0) / 100) * 0.14 +
          (state.audienceHeat[channelId].ridicule / 100) * 0.18,
      ),
      vocabularyWidening01: clamp01(
        (messages.length / 20) * 0.24 +
          (stage === 'PERSONAL' ? 0.10 : stage === 'RIVALRIC' ? 0.20 : stage === 'MYTHIC' ? 0.28 : 0) +
          seasonalAbsorption01 * 0.18,
      ),
      callbackAggression01,
      patienceShift01: clamp01(
        (descriptor.voiceprint.interruptionStyle === 'PATIENT' ? 0.48 : 0.22) +
          (state.currentSilence ? 0.12 : 0) +
          (state.pendingReveals.length > 0 ? 0.08 : 0),
      ),
      publicPressureBias01,
      privatePressureBias01,
      playerSpecificity01,
      seasonalAbsorption01,
      intimacyEscalation01,
      prophecyCadence01,
    },
    activeTransformBiases,
    careerRuns,
    meaningfulEvents,
    collapseWitnessCount: Math.round((state.reputation.humiliationRisk / 100) * 20),
    comebackWitnessCount: Math.round((state.reputation.comebackRespect / 100) * 20),
    callbackUsageCount: relationship?.callbacksAvailable.length ?? 0,
    lastEvolvedAt: state.lastAuthoritativeSyncAt ?? Date.now(),
    lastMeaningfulEventAt: state.lastAuthoritativeSyncAt,
    lastSeasonId: state.liveOps.activeWorldEvents[0]?.eventId ?? null,
    eventTail: [],
  };
}

function resolveTemperament(
  descriptor: ChatAnyNpcDescriptor,
  reputation: ChatReputationState,
  relationship: ChatRelationshipState | undefined,
  heat: ChatAudienceHeat,
): ChatPersonaTemperament {
  const trust = (relationship?.vector.trust ?? 0) / 100;
  const contempt = (relationship?.vector.contempt ?? 0) / 100;
  const rivalry = (relationship?.vector.rivalryIntensity ?? 0) / 100;
  const fascination = (relationship?.vector.fascination ?? 0) / 100;
  const ridicule = heat.ridicule / 100;
  const hype = heat.hype / 100;
  const respect = reputation.comebackRespect / 100;

  if ('haterArchetype' in descriptor) {
    if (rivalry >= 0.75 || ridicule >= 0.72) return 'HUNTING';
    if (contempt >= 0.68) return 'PREDATORY';
    if (fascination >= 0.56 && respect >= 0.44) return 'ADMIRING';
    return descriptor.voiceprint.punctuationStyle === 'FORMAL' ? 'CALCULATED' : 'SARDONIC';
  }

  if ('helperArchetype' in descriptor) {
    if (trust >= 0.64 && hype <= 0.30) return 'ADMIRING';
    if (heat.scrutiny >= 60 || rivalry >= 0.48) return 'CALCULATED';
    return 'CEREMONIAL';
  }

  if (hype >= 0.74) return 'CEREMONIAL';
  if (heat.scrutiny >= 70) return 'CALCULATED';
  return descriptor.voiceprint.prefersLowercase ? 'SARDONIC' : 'CALCULATED';
}

function deriveTransformBiases(input: {
  descriptor: ChatAnyNpcDescriptor;
  channelId: ChatVisibleChannel;
  stage: ChatPersonaStageId;
  splitMode: ChatPersonaSplitMode;
  relationship: ChatRelationshipState | undefined;
  heat: ChatAudienceHeat;
  mood: ChatChannelMood;
}): readonly ChatPersonaTransformBias[] {
  const biases = new Set<ChatPersonaTransformBias>();

  if (input.descriptor.voiceprint.averageSentenceLength === 'SHORT') {
    biases.add('SHORTER_COLDER');
  }

  if (input.descriptor.voiceprint.averageSentenceLength === 'LONG' || input.stage === 'MYTHIC') {
    biases.add('LONGER_CEREMONIAL');
  }

  if (input.descriptor.voiceprint.interruptionStyle === 'CUTTING') {
    biases.add('MORE_DIRECT');
  }

  if ('haterArchetype' in input.descriptor || input.heat.ridicule >= 58) {
    biases.add('MORE_MOCKING');
  }

  if (input.splitMode === 'PRIVATE') {
    biases.add('MORE_INTIMATE');
  }

  if (input.splitMode === 'PUBLIC' || input.channelId === 'GLOBAL') {
    biases.add('MORE_PUBLIC');
  }

  if (input.heat.scrutiny >= 56 || input.mood.mood === 'PREDATORY') {
    biases.add('PRESSURE_REWRITE');
  }

  if ((input.relationship?.callbacksAvailable.length ?? 0) > 0) {
    biases.add('CALLBACK_REWRITE');
    biases.add('PERSONAL_HISTORY_REWRITE');
  }

  if (input.mood.mood === 'MOURNFUL' || input.stage === 'RIVALRIC') {
    biases.add('MORE_POST_EVENT');
  } else {
    biases.add('MORE_PRE_EVENT');
  }

  return Array.from(biases.values());
}

function projectFrontendVoiceprint(
  descriptor: ChatAnyNpcDescriptor,
  evolution: ChatPersonaEvolutionProfile,
): FrontendChatPersonaVoiceprint {
  return {
    personaId: descriptor.personaId,
    punctuationStyle: descriptor.voiceprint.punctuationStyle === 'LOUD' ? 'SHARP' : descriptor.voiceprint.punctuationStyle,
    averageSentenceLength: descriptor.voiceprint.averageSentenceLength,
    emotionalTemperature: TEMPERAMENT_TO_TEMPERATURE[evolution.temperament],
    delayProfileMs: descriptor.voiceprint.delayProfileMs,
    interruptionStyle:
      descriptor.voiceprint.interruptionStyle === 'SURGE'
        ? 'CUTTING'
        : descriptor.voiceprint.interruptionStyle,
    signatureOpeners: descriptor.voiceprint.signatureOpeners,
    signatureClosers: descriptor.voiceprint.signatureClosers,
    lexiconTags: descriptor.voiceprint.lexiconTags,
    prefersLowercase: descriptor.voiceprint.prefersLowercase,
    prefersSparseEmoji: descriptor.voiceprint.prefersSparseEmoji,
  };
}

function projectPunctuationPolicy(
  voiceprint: ChatNpcVoiceprint,
  evolution: ChatPersonaEvolutionProfile,
  pressureMode: PersonaPressureMode,
): PersonaPunctuationPolicy {
  const preset = PUNCTUATION_WEIGHT_PRESETS[voiceprint.punctuationStyle];
  const aggressive =
    evolution.vector.callbackAggression01 * 0.22 +
    (pressureMode === 'RIDICULE' ? 0.10 : 0) +
    (pressureMode === 'HUNT' ? 0.08 : 0);
  const ceremonial =
    (pressureMode === 'CEREMONY' ? 0.10 : 0) +
    (evolution.vector.prophecyCadence01 * 0.06);

  return {
    style: voiceprint.punctuationStyle,
    periodWeight01: clamp01(preset.periodWeight01 + ceremonial * 0.12),
    commaWeight01: clamp01(preset.commaWeight01 + ceremonial * 0.10),
    ellipsisWeight01: clamp01(preset.ellipsisWeight01 + (pressureMode === 'WHISPER' ? 0.08 : 0)),
    dashWeight01: clamp01(preset.dashWeight01 + aggressive * 0.12),
    exclamationWeight01: clamp01(preset.exclamationWeight01 + aggressive * 0.08),
    questionWeight01: clamp01(preset.questionWeight01 + (pressureMode === 'SCRUTINY' ? 0.06 : 0)),
    colonWeight01: clamp01(preset.colonWeight01 + ceremonial * 0.06),
    semicolonWeight01: clamp01(preset.semicolonWeight01 + ceremonial * 0.05),
    uppercaseTolerance01: clamp01(preset.uppercaseTolerance01 + aggressive * 0.10),
    lowercasePreference01: clamp01(preset.lowercasePreference01 + (voiceprint.prefersLowercase ? 0.12 : 0)),
  };
}

function projectSentencePolicy(
  voiceprint: ChatNpcVoiceprint,
  context: PersonaProjectionContext,
  evolution: ChatPersonaEvolutionProfile,
  witnessBand: PersonaWitnessBand,
  pressureMode: PersonaPressureMode,
): PersonaSentencePolicy {
  const preset = SENTENCE_POLICY_PRESETS[voiceprint.averageSentenceLength];
  let minimum = preset.minimumSentences;
  let preferred = preset.preferredSentences;
  let maximum = preset.maximumSentences;
  let clauseDensity = preset.clauseDensity01;

  if (context.preferShortForm) {
    minimum = Math.max(1, minimum - 1);
    preferred = Math.max(1, preferred - 1);
    maximum = Math.max(preferred, maximum - 1);
  }

  if (context.preferLongForm || witnessBand === 'MYTHIC') {
    preferred += 1;
    maximum += 1;
    clauseDensity = clamp01(clauseDensity + 0.10);
  }

  if (pressureMode === 'RIDICULE' || pressureMode === 'HUNT') {
    preferred = Math.max(1, preferred - 1);
    maximum = Math.max(preferred, maximum - 1);
    clauseDensity = clamp01(clauseDensity - 0.08);
  }

  if (pressureMode === 'CEREMONY' || evolution.vector.prophecyCadence01 >= 0.44) {
    preferred += 1;
    maximum += 1;
    clauseDensity = clamp01(clauseDensity + 0.08);
  }

  return {
    minimumSentences: minimum,
    preferredSentences: preferred,
    maximumSentences: maximum,
    sentenceLengthShape: preset.sentenceLengthShape,
    fragmentTolerance01: clamp01(
      preset.fragmentTolerance01 +
        (pressureMode === 'RIDICULE' ? 0.06 : 0) -
        (pressureMode === 'CEREMONY' ? 0.04 : 0),
    ),
    clauseDensity01: clauseDensity,
    openerWeight01: clamp01(
      preset.openerWeight01 +
        (context.allowOpeners === false ? -0.60 : 0) +
        (witnessBand === 'ARENA' || witnessBand === 'MYTHIC' ? 0.08 : 0),
    ),
    closerWeight01: clamp01(
      preset.closerWeight01 +
        (context.allowClosers === false ? -0.60 : 0) +
        (evolution.vector.playerSpecificity01 * 0.08),
    ),
  };
}

function projectLexiconWeights(
  descriptor: ChatAnyNpcDescriptor,
  evolution: ChatPersonaEvolutionProfile,
  relationship: ChatRelationshipState | undefined,
  heat: ChatAudienceHeat,
  context: PersonaProjectionContext,
): readonly PersonaLexiconWeight[] {
  const preferred = new Set((context.preferredLexiconTags ?? []).map((value) => value.toLowerCase()));
  const excluded = new Set((context.excludedLexiconTags ?? []).map((value) => value.toLowerCase()));
  const results: PersonaLexiconWeight[] = [];

  for (const tag of descriptor.voiceprint.lexiconTags) {
    const tagLower = tag.toLowerCase();
    if (excluded.has(tagLower)) continue;

    const reasons: string[] = ['Base voiceprint lexicon tag.'];
    let weight = 0.28;

    if (preferred.has(tagLower)) {
      weight += 0.16;
      reasons.push('Requested by projection context.');
    }

    if ((relationship?.callbacksAvailable.length ?? 0) > 0) {
      weight += 0.06;
      reasons.push('Relationship carries callback ammunition.');
    }

    if (heat.scrutiny >= 60 && ['forms', 'compliance', 'processing', 'offer', 'ledger'].includes(tagLower)) {
      weight += 0.08;
      reasons.push('Current room scrutiny elevates formal lexicon.');
    }

    if (heat.ridicule >= 60 && ['distress', 'exposure', 'status', 'rumor'].includes(tagLower)) {
      weight += 0.08;
      reasons.push('Current room ridicule elevates exposed-status lexicon.');
    }

    if (evolution.vector.playerSpecificity01 >= 0.40) {
      weight += 0.05;
      reasons.push('High player specificity rewards signature vocabulary reuse.');
    }

    results.push({
      tag,
      weight01: clamp01(weight),
      reasons,
    });
  }

  return results.sort((left, right) => right.weight01 - left.weight01);
}

function selectSignaturePacket(
  descriptor: ChatAnyNpcDescriptor,
  sentencePolicy: PersonaSentencePolicy,
  relationship: ChatRelationshipState | undefined,
  pressureMode: PersonaPressureMode,
  context: PersonaProjectionContext,
): PersonaSignaturePacket {
  const openerPool = descriptor.voiceprint.signatureOpeners;
  const closerPool = descriptor.voiceprint.signatureClosers;

  const openerConfidence = clamp01(
    sentencePolicy.openerWeight01 +
      ((relationship?.vector.familiarity ?? 0) / 100) * 0.06 +
      (pressureMode === 'CEREMONY' ? 0.08 : 0),
  );

  const closerConfidence = clamp01(
    sentencePolicy.closerWeight01 +
      ((relationship?.vector.trust ?? 0) / 100) * 0.08 +
      (pressureMode === 'RIDICULE' ? 0.04 : 0),
  );

  const opener =
    context.allowOpeners === false || openerConfidence < 0.24 || openerPool.length === 0
      ? undefined
      : chooseStableString(openerPool, `${descriptor.npcId}:${context.channelId}:opener:${pressureMode}`);

  const closer =
    context.allowClosers === false || closerConfidence < 0.22 || closerPool.length === 0
      ? undefined
      : chooseStableString(closerPool, `${descriptor.npcId}:${context.channelId}:closer:${pressureMode}`);

  return {
    opener,
    closer,
    openerSelectedFrom: openerPool,
    closerSelectedFrom: closerPool,
    openerConfidence01: openerConfidence,
    closerConfidence01: closerConfidence,
  };
}

function chooseStableString(pool: readonly string[], key: string): string | undefined {
  if (!pool.length) return undefined;
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return pool[hash % pool.length];
}

function buildProjectionNotes(input: {
  descriptor: ChatAnyNpcDescriptor;
  context: PersonaProjectionContext;
  heat: ChatAudienceHeat;
  mood: ChatChannelMood;
  relationship: ChatRelationshipState | undefined;
  evolution: ChatPersonaEvolutionProfile;
  pressureMode: PersonaPressureMode;
  witnessBand: PersonaWitnessBand;
}): readonly string[] {
  const notes: string[] = [];
  notes.push(`Channel ${input.context.channelId} mood is ${input.mood.mood}.`);
  notes.push(`Heat band ${formatHeatBand(input.heat)} with ridicule ${input.heat.ridicule} / scrutiny ${input.heat.scrutiny}.`);
  notes.push(`Witness band resolved to ${input.witnessBand}.`);
  notes.push(`Pressure mode resolved to ${input.pressureMode}.`);
  notes.push(`Evolution stage ${input.evolution.stage} with split ${input.evolution.splitMode}.`);
  notes.push(`Temperament ${input.evolution.temperament}.`);

  for (const bias of input.evolution.activeTransformBiases) {
    notes.push(TRANSFORM_BIAS_NOTES[bias]);
  }

  if (input.relationship) {
    notes.push(
      `Relationship intensity — rivalry ${input.relationship.vector.rivalryIntensity}, trust ${input.relationship.vector.trust}, familiarity ${input.relationship.vector.familiarity}.`,
    );
    if (input.relationship.callbacksAvailable.length) {
      notes.push(`Relationship exposes ${input.relationship.callbacksAvailable.length} callback anchors.`);
    }
  } else {
    notes.push('No hydrated relationship state; using cold-path persona defaults.');
  }

  if (input.context.preferShortForm) notes.push('Projection context requested short-form output.');
  if (input.context.preferLongForm) notes.push('Projection context requested long-form output.');
  if (input.context.forcePrivateBias) notes.push('Projection context forces private bias.');
  if (input.context.forcePublicBias) notes.push('Projection context forces public bias.');

  return notes;
}

function composeProjection(
  state: ChatEngineState,
  descriptor: ChatAnyNpcDescriptor,
  context: PersonaProjectionContext,
): PersonaVoiceprintProjection {
  const heat = getChannelHeat(state, context.channelId);
  const mood = getChannelMood(state, context.channelId);
  const relationship = getRelationshipForDescriptor(state, descriptor);
  const evolution = buildEvolutionProfile(state, descriptor, context.channelId);
  const witnessBand = deriveWitnessBand(heat, mood);
  const pressureMode = resolvePressureMode(context.channelId, mood, heat);
  const frontendVoiceprint = projectFrontendVoiceprint(descriptor, evolution);
  const punctuation = projectPunctuationPolicy(descriptor.voiceprint, evolution, pressureMode);
  const sentencePolicy = projectSentencePolicy(
    descriptor.voiceprint,
    context,
    evolution,
    witnessBand,
    pressureMode,
  );
  const signature = selectSignaturePacket(
    descriptor,
    sentencePolicy,
    relationship,
    pressureMode,
    context,
  );
  const lexiconWeights = projectLexiconWeights(
    descriptor,
    evolution,
    relationship,
    heat,
    context,
  );

  const publicPressureBias01 = clamp01(
    evolution.vector.publicPressureBias01 +
      (context.forcePublicBias ? 0.24 : 0) -
      (context.forcePrivateBias ? 0.24 : 0),
  );

  const privatePressureBias01 = clamp01(
    evolution.vector.privatePressureBias01 +
      (context.forcePrivateBias ? 0.24 : 0) -
      (context.forcePublicBias ? 0.24 : 0),
  );

  const relationshipPressure01 = clamp01(
    average([
      (relationship?.vector.rivalryIntensity ?? 0) / 100,
      (relationship?.vector.contempt ?? 0) / 100,
      (relationship?.vector.fascination ?? 0) / 100,
    ]),
  );

  const ridiculePressure01 = clamp01(heat.ridicule / 100);
  const scrutinyPressure01 = clamp01(heat.scrutiny / 100);
  const mercyPressure01 = clamp01(
    ((relationship?.vector.rescueDebt ?? 0) / 100) * 0.28 +
      (mood.mood === 'MOURNFUL' ? 0.42 : 0) +
      ('helperArchetype' in descriptor ? 0.18 : 0),
  );

  const confidenceShock01 = clamp01(
    (state.reputation.publicAura / 100) * 0.18 +
      (state.reputation.comebackRespect / 100) * 0.24 -
      (state.reputation.humiliationRisk / 100) * 0.16,
  );

  return {
    npcKey: descriptor.npcKey,
    npcId: descriptor.npcId,
    personaId: descriptor.personaId,
    displayName: descriptor.displayName,
    renderMode: context.renderMode,
    channelId: context.channelId,
    heatBand: formatHeatBand(heat),
    witnessBand,
    pressureMode,
    stage: evolution.stage,
    splitMode: evolution.splitMode,
    temperament: evolution.temperament,
    transformBiases: evolution.activeTransformBiases,
    voiceprint: descriptor.voiceprint,
    cadence: descriptor.cadence,
    frontendVoiceprint,
    punctuation,
    sentencePolicy,
    signature,
    lexiconWeights,
    publicPressureBias01,
    privatePressureBias01,
    callbackAggression01: evolution.vector.callbackAggression01,
    playerSpecificity01: evolution.vector.playerSpecificity01,
    seasonalAbsorption01: evolution.vector.seasonalAbsorption01,
    intimacyEscalation01: evolution.vector.intimacyEscalation01,
    prophecyCadence01: evolution.vector.prophecyCadence01,
    relationshipPressure01,
    ridiculePressure01,
    scrutinyPressure01,
    mercyPressure01,
    confidenceShock01,
    notes: buildProjectionNotes({
      descriptor,
      context,
      heat,
      mood,
      relationship,
      evolution,
      pressureMode,
      witnessBand,
    }),
  };
}

function getMessageChannel(message: ChatMessage, fallback: ChatVisibleChannel): ChatVisibleChannel {
  return message.channel ?? fallback;
}

function fitPunctuation(messageBody: string, policy: PersonaPunctuationPolicy): number {
  const period = punctuationRatio(messageBody, '.');
  const comma = punctuationRatio(messageBody, ',');
  const exclam = punctuationRatio(messageBody, '!');
  const question = punctuationRatio(messageBody, '?');
  const dash = punctuationRatio(messageBody, '-');
  const ellipsis = messageBody.includes('...') ? 1 : 0;
  const uppercase = (() => {
    const letters = messageBody.replace(/[^A-Za-z]/g, '');
    if (!letters.length) return 0;
    return letters.replace(/[^A-Z]/g, '').length / letters.length;
  })();

  const subscores = [
    1 - Math.min(1, Math.abs(period - policy.periodWeight01)),
    1 - Math.min(1, Math.abs(comma - policy.commaWeight01)),
    1 - Math.min(1, Math.abs(exclam - policy.exclamationWeight01)),
    1 - Math.min(1, Math.abs(question - policy.questionWeight01)),
    1 - Math.min(1, Math.abs(dash - policy.dashWeight01)),
    1 - Math.min(1, Math.abs(ellipsis - policy.ellipsisWeight01)),
    1 - Math.min(1, Math.abs(uppercase - policy.uppercaseTolerance01)),
  ];
  return clamp01(average(subscores));
}

function fitSentenceShape(messageBody: string, policy: PersonaSentencePolicy): number {
  const sentences = sentenceCount(messageBody);
  const avgWords = averageWordsPerSentence(messageBody);
  const preferredWords =
    policy.sentenceLengthShape === 'SHORT'
      ? 5
      : policy.sentenceLengthShape === 'BALANCED'
        ? 11
        : 20;

  const sentenceScore = 1 - Math.min(1, Math.abs(sentences - policy.preferredSentences) / Math.max(1, policy.maximumSentences));
  const wordScore = 1 - Math.min(1, Math.abs(avgWords - preferredWords) / Math.max(1, preferredWords));
  return clamp01(average([sentenceScore, wordScore]));
}

function fitLexicon(messageBody: string, projection: PersonaVoiceprintProjection): number {
  const tokens = tokenizeLower(messageBody);
  if (!tokens.length) return 0;
  const weights = projection.lexiconWeights;
  if (!weights.length) return 0.5;

  let numerator = 0;
  let denominator = 0;

  for (const entry of weights) {
    const synonyms = LEXICON_SYNONYM_WEIGHTS[entry.tag.toLowerCase()] ?? [entry.tag.toLowerCase()];
    const matches = countMatches(tokens, synonyms);
    numerator += Math.min(1, matches) * entry.weight01;
    denominator += entry.weight01;
  }

  if (denominator <= 0) return 0;
  return clamp01(numerator / denominator);
}

function fitTemperature(messageBody: string, projection: PersonaVoiceprintProjection): number {
  const lower = messageBody.toLowerCase();
  const heatSignals = [
    ['!', 'VOLCANIC'],
    ['come on', 'VOLCANIC'],
    ['prove it', 'VOLCANIC'],
    ['breathe', 'WARM'],
    ['stay disciplined', 'CONTROLLED'],
    ['for the record', 'COLD'],
    ['history remembers', 'WARM'],
  ] as const;

  let hits = 0;
  let matched = 0;
  for (const [signal, band] of heatSignals) {
    if (lower.includes(signal)) {
      hits += 1;
      if (projection.frontendVoiceprint.emotionalTemperature === band) matched += 1;
    }
  }
  if (!hits) return 0.5;
  return clamp01(matched / hits);
}

function fitSignature(messageBody: string, packet: PersonaSignaturePacket): { opener: number; closer: number } {
  const normalized = messageBody.trim();
  const opener = packet.opener
    ? normalized.toLowerCase().startsWith(packet.opener.toLowerCase())
      ? 1
      : 0
    : 0.5;
  const closer = packet.closer
    ? normalized.toLowerCase().endsWith(packet.closer.toLowerCase())
      ? 1
      : 0
    : 0.5;
  return { opener, closer };
}

export function resolvePersonaVoiceprintProjection(
  state: ChatEngineState,
  npcKey: ChatKnownNpcKey,
  context: PersonaProjectionContext,
): PersonaVoiceprintProjection {
  return composeProjection(state, getNpcDescriptor(npcKey), context);
}

export function resolvePersonaVoiceprintProjectionForDescriptor(
  state: ChatEngineState,
  descriptor: ChatAnyNpcDescriptor,
  context: PersonaProjectionContext,
): PersonaVoiceprintProjection {
  return composeProjection(state, descriptor, context);
}

export function fitMessageToPersonaVoiceprint(
  projection: PersonaVoiceprintProjection,
  messageBody: string,
): PersonaMessageVoiceFit {
  const signature = fitSignature(messageBody, projection.signature);
  const punctuation = fitPunctuation(messageBody, projection.punctuation);
  const sentenceShape = fitSentenceShape(messageBody, projection.sentencePolicy);
  const lexicon = fitLexicon(messageBody, projection);
  const temperature = fitTemperature(messageBody, projection);
  const lowercase = projection.frontendVoiceprint.prefersLowercase
    ? clamp01(lowercaseRatio(messageBody))
    : clamp01(1 - Math.max(0, lowercaseRatio(messageBody) - 0.85));

  const score01 = clamp01(
    signature.opener * 0.10 +
      signature.closer * 0.10 +
      punctuation * 0.24 +
      sentenceShape * 0.18 +
      lexicon * 0.22 +
      temperature * 0.10 +
      lowercase * 0.06,
  );

  const reasons: string[] = [];
  if (signature.opener >= 0.9) reasons.push('Opening signature matches voiceprint.');
  if (signature.closer >= 0.9) reasons.push('Closing signature matches voiceprint.');
  if (punctuation >= 0.7) reasons.push('Punctuation cadence fits persona policy.');
  if (sentenceShape >= 0.7) reasons.push('Sentence shape fits persona policy.');
  if (lexicon >= 0.6) reasons.push('Lexicon intersects persona signature tags.');
  if (temperature >= 0.6) reasons.push('Thermal posture aligns with persona emotion band.');
  if (lowercase >= 0.7 && projection.frontendVoiceprint.prefersLowercase) {
    reasons.push('Lowercase discipline aligns with persona preference.');
  }
  if (!reasons.length) reasons.push('Message weakly matches persona law; fallback fit only.');

  return {
    npcKey: projection.npcKey,
    score01,
    openerMatch01: signature.opener,
    closerMatch01: signature.closer,
    punctuationMatch01: punctuation,
    sentenceShapeMatch01: sentenceShape,
    lexiconMatch01: lexicon,
    temperatureMatch01: temperature,
    lowercaseMatch01: lowercase,
    reasons,
  };
}

export function resolvePersonaVoiceprintProjectionForMessage(
  state: ChatEngineState,
  npcKey: ChatKnownNpcKey,
  message: ChatMessage,
  now: number = Date.now(),
): PersonaVoiceprintProjection {
  return resolvePersonaVoiceprintProjection(state, npcKey, {
    channelId: getMessageChannel(message, state.activeVisibleChannel),
    renderMode: 'MESSAGE_RENDER',
    now,
    messageBody: message.body,
    sceneId: message.sceneId,
    momentId: message.momentId,
    allowOpeners: false,
    allowClosers: false,
  });
}

export function summarizePersonaVoiceForMessage(
  state: ChatEngineState,
  npcKey: ChatKnownNpcKey,
  message: ChatMessage,
  now: number = Date.now(),
): PersonaMessageVoiceFit {
  const projection = resolvePersonaVoiceprintProjectionForMessage(state, npcKey, message, now);
  return fitMessageToPersonaVoiceprint(projection, message.body);
}

// ============================================================================
// MARK: Engine class
// ============================================================================

export class PersonaVoiceprintEngine {
  private readonly projectionCache = new Map<string, PersonaProjectionCacheEntry>();
  private readonly fitCache = new Map<string, PersonaFitCacheEntry>();
  private readonly lastProjectionKeys: string[] = [];
  private readonly lastFitKeys: string[] = [];

  resolveForNpc(
    state: ChatEngineState,
    npcKey: ChatKnownNpcKey,
    context: PersonaProjectionContext,
  ): PersonaVoiceprintProjection {
    const cacheKey = this.buildProjectionCacheKey(state, npcKey, context);
    const cached = this.projectionCache.get(cacheKey);
    if (cached) return cached.projection;

    const projection = resolvePersonaVoiceprintProjection(state, npcKey, context);
    this.writeProjectionCache(cacheKey, projection, context.now);
    return projection;
  }

  resolveForDescriptor(
    state: ChatEngineState,
    descriptor: ChatAnyNpcDescriptor,
    context: PersonaProjectionContext,
  ): PersonaVoiceprintProjection {
    const cacheKey = this.buildProjectionCacheKey(state, descriptor.npcKey, context);
    const cached = this.projectionCache.get(cacheKey);
    if (cached) return cached.projection;

    const projection = resolvePersonaVoiceprintProjectionForDescriptor(state, descriptor, context);
    this.writeProjectionCache(cacheKey, projection, context.now);
    return projection;
  }

  fitMessage(
    projection: PersonaVoiceprintProjection,
    messageBody: string,
    now: number = Date.now(),
  ): PersonaMessageVoiceFit {
    const cacheKey = `${projection.npcId}::${projection.channelId}::${hashString(messageBody)}`;
    const cached = this.fitCache.get(cacheKey);
    if (cached) return cached.fit;

    const fit = fitMessageToPersonaVoiceprint(projection, messageBody);
    this.writeFitCache(cacheKey, fit, now);
    return fit;
  }

  summarizeExistingMessage(
    state: ChatEngineState,
    npcKey: ChatKnownNpcKey,
    message: ChatMessage,
    now: number = Date.now(),
  ): PersonaMessageVoiceFit {
    const projection = this.resolveForNpc(state, npcKey, {
      channelId: message.channel,
      renderMode: 'MESSAGE_RENDER',
      now,
      messageBody: message.body,
      sceneId: message.sceneId,
      momentId: message.momentId,
      allowOpeners: false,
      allowClosers: false,
    });
    return this.fitMessage(projection, message.body, now);
  }

  clear(): void {
    this.projectionCache.clear();
    this.fitCache.clear();
    this.lastProjectionKeys.length = 0;
    this.lastFitKeys.length = 0;
  }

  diagnostics(): PersonaVoiceprintDiagnostics {
    return {
      cacheEntries: this.projectionCache.size + this.fitCache.size,
      lastProjectionKeys: [...this.lastProjectionKeys],
      lastFitKeys: [...this.lastFitKeys],
    };
  }

  private buildProjectionCacheKey(
    state: ChatEngineState,
    npcKey: ChatKnownNpcKey,
    context: PersonaProjectionContext,
  ): string {
    const heat = state.audienceHeat[context.channelId];
    const mood = state.channelMoodByChannel[context.channelId];
    const descriptor = getNpcDescriptor(npcKey);
    const relationship = getRelationshipForDescriptor(state, descriptor);
    return [
      npcKey,
      context.channelId,
      context.renderMode,
      context.preferShortForm ? 'short' : 'std',
      context.preferLongForm ? 'long' : 'std',
      context.forcePrivateBias ? 'private' : 'normal',
      context.forcePublicBias ? 'public' : 'normal',
      heat.heat,
      heat.hype,
      heat.ridicule,
      heat.scrutiny,
      mood.mood,
      relationship?.vector.rivalryIntensity ?? 0,
      relationship?.vector.trust ?? 0,
      relationship?.callbacksAvailable.length ?? 0,
      state.reputation.publicAura,
      state.reputation.comebackRespect,
      state.liveOps.activeWorldEvents.length,
      state.currentSilence ? 'silence' : 'open',
      state.pendingReveals.length,
      state.continuity.carriedPersonaIds.includes(descriptor.personaId) ? 'carry' : 'fresh',
      hashString((context.preferredLexiconTags ?? []).join('|')),
      hashString((context.excludedLexiconTags ?? []).join('|')),
    ].join('::');
  }

  private writeProjectionCache(
    cacheKey: string,
    projection: PersonaVoiceprintProjection,
    createdAt: number,
  ): void {
    this.projectionCache.set(cacheKey, { cacheKey, projection, createdAt });
    this.lastProjectionKeys.unshift(cacheKey);
    if (this.lastProjectionKeys.length > 24) this.lastProjectionKeys.pop();
    while (this.projectionCache.size > PERSONA_PROJECTION_CACHE_LIMIT) {
      const oldestKey = this.projectionCache.keys().next().value;
      if (!oldestKey) break;
      this.projectionCache.delete(oldestKey);
    }
  }

  private writeFitCache(cacheKey: string, fit: PersonaMessageVoiceFit, createdAt: number): void {
    this.fitCache.set(cacheKey, { cacheKey, fit, createdAt });
    this.lastFitKeys.unshift(cacheKey);
    if (this.lastFitKeys.length > 24) this.lastFitKeys.pop();
    while (this.fitCache.size > PERSONA_FIT_CACHE_LIMIT) {
      const oldestKey = this.fitCache.keys().next().value;
      if (!oldestKey) break;
      this.fitCache.delete(oldestKey);
    }
  }
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

export const personaVoiceprintEngine = new PersonaVoiceprintEngine();

// ============================================================================
// MARK: Convenience exports for consumers
// ============================================================================

export function createPersonaProjectionContext(
  channelId: ChatVisibleChannel,
  renderMode: PersonaRenderMode,
  now: number,
  overrides: Omit<Partial<PersonaProjectionContext>, 'channelId' | 'renderMode' | 'now'> = {},
): PersonaProjectionContext {
  return {
    channelId,
    renderMode,
    now,
    ...overrides,
  };
}

export function resolvePersonaProjectionNotes(
  state: ChatEngineState,
  npcKey: ChatKnownNpcKey,
  context: PersonaProjectionContext,
): readonly string[] {
  return personaVoiceprintEngine.resolveForNpc(state, npcKey, context).notes;
}

export function resolvePersonaLexiconPreview(
  state: ChatEngineState,
  npcKey: ChatKnownNpcKey,
  context: PersonaProjectionContext,
): readonly string[] {
  return personaVoiceprintEngine
    .resolveForNpc(state, npcKey, context)
    .lexiconWeights
    .slice(0, 8)
    .map((entry) => entry.tag);
}

export function resolvePersonaSignaturePreview(
  state: ChatEngineState,
  npcKey: ChatKnownNpcKey,
  context: PersonaProjectionContext,
): PersonaSignaturePacket {
  return personaVoiceprintEngine.resolveForNpc(state, npcKey, context).signature;
}

export function resolvePersonaPressureMode(
  state: ChatEngineState,
  npcKey: ChatKnownNpcKey,
  context: PersonaProjectionContext,
): PersonaPressureMode {
  return personaVoiceprintEngine.resolveForNpc(state, npcKey, context).pressureMode;
}
