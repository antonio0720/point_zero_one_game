/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT SURFACE REALIZER
 * FILE: pzo-web/src/engines/chat/intelligence/ChatSurfaceRealizer.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Deterministically transform a canonical authored line into a realized surface
 * line that still sounds authored, but reflects:
 * - scene role,
 * - pressure,
 * - relationship heat,
 * - callback context,
 * - public vs private theater,
 * - and long-horizon familiarity.
 *
 * This is not open-ended generation.
 * This is constrained authored mutation.
 * ============================================================================
 */

import type {
  ChatRelationshipState,
  PressureTier,
} from '../types';

export type ChatSurfaceTransform =
  | 'SHORTER_COLDER'
  | 'LONGER_CEREMONIAL'
  | 'MORE_DIRECT'
  | 'MORE_MOCKING'
  | 'MORE_INTIMATE'
  | 'MORE_PUBLIC'
  | 'MORE_POST_EVENT'
  | 'MORE_PRE_EVENT'
  | 'PRESSURE_REWRITE'
  | 'CALLBACK_REWRITE'
  | 'PERSONAL_HISTORY_REWRITE';

export interface CanonicalChatLine {
  readonly canonicalLineId: string;
  readonly botId: string;
  readonly category: string;
  readonly text: string;
  readonly tags?: readonly string[];
  readonly motifId?: string;
  readonly rhetoricalForm?: string;
  readonly sceneRoles?: readonly string[];
  readonly botObjective?: string;
  readonly emotionPayload?: string;
  readonly targetPlayerTrait?: string;
}

export interface ChatSurfaceRealizationContext {
  readonly now: number;
  readonly sceneId?: string;
  readonly sceneArchetype?: string;
  readonly sceneRole?: string;
  readonly pressureBand?: PressureTier;
  readonly relationship?: ChatRelationshipState;
  readonly callbackText?: string;
  readonly callbackAnchorId?: string;
  readonly playerAlias?: string;
  readonly publicFacing?: boolean;
  readonly transforms?: readonly ChatSurfaceTransform[];
}

export interface ChatSurfaceRealizationResult {
  readonly canonicalLineId: string;
  readonly surfaceVariantId: string;
  readonly strategy: string;
  readonly realizedText: string;
  readonly transformsApplied: readonly ChatSurfaceTransform[];
  readonly rhetoricalTemplateIds: readonly string[];
  readonly semanticClusterIds: readonly string[];
  readonly tags: readonly string[];
}

function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clampText(value: string): string {
  return normalizeSpace(value)
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/\s{2,}/g, ' ');
}

function choose<T>(seed: number, values: readonly T[]): T {
  return values[Math.abs(seed) % values.length];
}

function replaceLead(text: string, replacements: readonly string[], seed: number): string {
  const lead = choose(seed, replacements);
  return `${lead}${text.startsWith(' ') ? '' : ' '}${text}`.trim();
}

function moreDirect(text: string): string {
  return text
    .replace(/^The room is not asking whether you are right\./i, 'The room does not care whether you are right.')
    .replace(/\bthere is a difference between\b/i, 'There is a line between')
    .replace(/\bPeople call it\b/i, 'They call it')
    .replace(/\bI do not need\b/i, 'I do not require')
    .replace(/\bYou are not\b/i, 'You are no longer');
}

function moreMocking(text: string): string {
  return text
    .replace(/\bI respect\b/gi, 'I almost respect')
    .replace(/\bInteresting\./gi, 'Adorable.')
    .replace(/\bWell played\./gi, 'Cute.')
    .replace(/\bYou survived\b/gi, 'You managed not to disappear')
    .replace(/\bVery well\./gi, 'Fine.');
}

function moreIntimate(text: string, alias?: string): string {
  if (!alias) return text.replace(/\byou\b/gi, 'you');
  return text.replace(/\bYou\b/g, alias).replace(/\byour\b/g, `${alias}'s`);
}

function morePublic(text: string): string {
  return replaceLead(text, ['Everyone saw this.', 'The room saw that.', 'Witnesses matter here.'], hashSeed(text));
}

function shorterColder(text: string): string {
  return clampText(
    text
      .replace(/The room is not asking whether you are right\. /g, '')
      .replace(/That is /g, '')
      .replace(/Very well\. /g, '')
      .replace(/Interesting\. /g, ''),
  );
}

function longerCeremonial(text: string): string {
  return clampText(
    replaceLead(text, [
      'Let the record keep this straight.',
      'For the sake of precision, hear it clearly.',
      'Since the room insists on performance, let us name what happened.',
    ], hashSeed(`ceremony|${text}`)),
  );
}

function postEvent(text: string): string {
  return replaceLead(text, [
    'Now that the damage is visible,',
    'After the room watched that happen,',
    'The event is over. The consequences are not.',
  ], hashSeed(`post|${text}`));
}

function preEvent(text: string): string {
  return replaceLead(text, [
    'Before the floor opens beneath you,',
    'While you still think this can be contained,',
    'Before the room finishes understanding what is coming,',
  ], hashSeed(`pre|${text}`));
}

function pressureRewrite(text: string, pressureBand?: PressureTier): string {
  switch (pressureBand) {
    case 'BREAKPOINT':
      return replaceLead(text, ['This is the collapse layer.', 'This is what the edge sounds like.'], hashSeed(`bp|${text}`));
    case 'CRITICAL':
      return replaceLead(text, ['The room is out of patience.', 'Your margin for theatre is gone.'], hashSeed(`critical|${text}`));
    case 'PRESSURED':
      return replaceLead(text, ['Pressure has already entered the structure.', 'Your breathing room is measurable now.'], hashSeed(`pressured|${text}`));
    case 'WATCHFUL':
      return replaceLead(text, ['The warning phase has already begun.', 'The room is still smiling. That changes nothing.'], hashSeed(`watchful|${text}`));
    default:
      return text;
  }
}

function callbackRewrite(text: string, callbackText?: string): string {
  if (!callbackText) return text;
  return clampText(`${text} You said "${normalizeSpace(callbackText)}." The room kept that.`);
}

function personalHistoryRewrite(text: string, relationship?: ChatRelationshipState): string {
  if (!relationship) return text;
  const vector = relationship.vector;
  if (vector.fascination >= 75 && vector.rivalryIntensity >= 75) {
    return replaceLead(text, ['I have been watching you for longer than you think.', 'This is not our first unfinished conversation.'], hashSeed(`history:fascination|${text}`));
  }
  if (vector.contempt >= 75) {
    return replaceLead(text, ['You keep making the same mistake in new clothing.', 'I was counting on this from you.'], hashSeed(`history:contempt|${text}`));
  }
  if (vector.respect >= 75) {
    return replaceLead(text, ['You have made this more difficult than most.', 'You forced a cleaner line from me than I intended.'], hashSeed(`history:respect|${text}`));
  }
  return text;
}

function inferTransforms(context: ChatSurfaceRealizationContext): ChatSurfaceTransform[] {
  const transforms: ChatSurfaceTransform[] = [...(context.transforms ?? [])];

  if (context.publicFacing) transforms.push('MORE_PUBLIC');
  if (context.sceneRole === 'CALLBACK' && context.callbackText) transforms.push('CALLBACK_REWRITE');
  if (context.sceneRole === 'OPEN') transforms.push('MORE_PRE_EVENT');
  if (context.sceneRole === 'ECHO' || context.sceneRole === 'CLOSE') transforms.push('MORE_POST_EVENT');
  if (context.sceneArchetype === 'DEAL_ROOM_PRESSURE_SCENE') transforms.push('MORE_DIRECT');
  if (context.relationship?.vector.contempt && context.relationship.vector.contempt >= 70) {
    transforms.push('MORE_MOCKING');
  }
  if (context.relationship?.vector.fascination && context.relationship.vector.fascination >= 65) {
    transforms.push('PERSONAL_HISTORY_REWRITE');
  }
  if (context.pressureBand && context.pressureBand !== 'CALM') transforms.push('PRESSURE_REWRITE');

  return [...new Set(transforms)];
}

function inferSemanticClusterIds(line: CanonicalChatLine, context: ChatSurfaceRealizationContext): string[] {
  return [
    line.motifId ?? line.category,
    context.sceneArchetype ?? 'scene-generic',
    context.sceneRole ?? 'role-generic',
    context.pressureBand ?? 'CALM',
  ].filter(Boolean);
}

function inferRhetoricalTemplateIds(line: CanonicalChatLine, transforms: readonly ChatSurfaceTransform[]): string[] {
  return [
    line.rhetoricalForm ?? 'authored-base',
    ...transforms.map((item) => `transform:${item.toLowerCase()}`),
  ];
}

export class ChatSurfaceRealizer {
  realize(
    line: CanonicalChatLine,
    context: ChatSurfaceRealizationContext,
  ): ChatSurfaceRealizationResult {
    const transforms = inferTransforms(context);
    let text = normalizeSpace(line.text);

    for (const transform of transforms) {
      switch (transform) {
        case 'SHORTER_COLDER':
          text = shorterColder(text);
          break;
        case 'LONGER_CEREMONIAL':
          text = longerCeremonial(text);
          break;
        case 'MORE_DIRECT':
          text = moreDirect(text);
          break;
        case 'MORE_MOCKING':
          text = moreMocking(text);
          break;
        case 'MORE_INTIMATE':
          text = moreIntimate(text, context.playerAlias);
          break;
        case 'MORE_PUBLIC':
          text = morePublic(text);
          break;
        case 'MORE_POST_EVENT':
          text = postEvent(text);
          break;
        case 'MORE_PRE_EVENT':
          text = preEvent(text);
          break;
        case 'PRESSURE_REWRITE':
          text = pressureRewrite(text, context.pressureBand);
          break;
        case 'CALLBACK_REWRITE':
          text = callbackRewrite(text, context.callbackText);
          break;
        case 'PERSONAL_HISTORY_REWRITE':
          text = personalHistoryRewrite(text, context.relationship);
          break;
        default:
          break;
      }
    }

    text = clampText(text);
    const strategy = [
      context.sceneArchetype ?? 'freeplay',
      context.sceneRole ?? 'line',
      context.pressureBand ?? 'CALM',
      context.relationship?.escalationTier ?? 'NONE',
    ].join('|');
    const surfaceVariantId = [
      line.canonicalLineId,
      hashSeed(`${strategy}|${text}|${context.now}`).toString(16),
    ].join(':');

    return {
      canonicalLineId: line.canonicalLineId,
      surfaceVariantId,
      strategy,
      realizedText: text,
      transformsApplied: transforms,
      rhetoricalTemplateIds: inferRhetoricalTemplateIds(line, transforms),
      semanticClusterIds: inferSemanticClusterIds(line, context),
      tags: [...(line.tags ?? [])],
    };
  }

  realizeBatch(
    lines: readonly CanonicalChatLine[],
    context: ChatSurfaceRealizationContext,
  ): readonly ChatSurfaceRealizationResult[] {
    return lines.map((line, index) =>
      this.realize(line, {
        ...context,
        now: context.now + index,
      }),
    );
  }
}

export function createChatSurfaceRealizer(): ChatSurfaceRealizer {
  return new ChatSurfaceRealizer();
}
