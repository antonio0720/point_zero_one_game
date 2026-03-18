/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT SURFACE REALIZER
 * FILE: backend/src/game/engine/chat/intelligence/ChatSurfaceRealizer.ts
 * ============================================================================
 *
 * Backend-authoritative mirror of constrained authored surface realization.
 * ============================================================================
 */

import type {
  SharedCanonicalChatLine,
  SharedChatRealizationContext,
  SharedChatRealizationResult,
  SharedChatRealizationTransform,
} from '../../../../../../shared/contracts/chat/surface-realization';

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

function replaceLead(text: string, replacements: readonly string[], seed: number): string {
  const lead = replacements[Math.abs(seed) % replacements.length];
  return `${lead}${text.startsWith(' ') ? '' : ' '}${text}`.trim();
}

export class ChatSurfaceRealizer {
  realize(
    line: SharedCanonicalChatLine,
    context: SharedChatRealizationContext,
  ): SharedChatRealizationResult {
    const transforms = [...new Set(context.transforms ?? [])] as SharedChatRealizationTransform[];
    let text = normalizeSpace(line.text);

    for (const transform of transforms) {
      switch (transform) {
        case 'MORE_PUBLIC':
          text = replaceLead(text, ['The room saw it.', 'Everyone watched that.'], hashSeed(`public|${text}`));
          break;
        case 'CALLBACK_REWRITE':
          if (context.callbackText) {
            text = `${text} You said "${normalizeSpace(context.callbackText)}." The room kept that.`;
          }
          break;
        case 'PRESSURE_REWRITE':
          if (context.pressureBand) {
            text = replaceLead(text, [`Pressure tier ${context.pressureBand}.`, 'The structure is tightening.'], hashSeed(`pressure|${text}`));
          }
          break;
        case 'MORE_DIRECT':
          text = text.replace(/\bYou are not\b/g, 'You are no longer');
          break;
        case 'MORE_MOCKING':
          text = text.replace(/\bInteresting\./g, 'Cute.');
          break;
        case 'PERSONAL_HISTORY_REWRITE':
          text = replaceLead(text, ['This is not our first unfinished conversation.', 'You repeat more cleanly than you realize.'], hashSeed(`history|${text}`));
          break;
        case 'SHORTER_COLDER':
          text = normalizeSpace(text.replace(/\bVery well\.\s*/g, '').replace(/\bInteresting\.\s*/g, ''));
          break;
        case 'LONGER_CEREMONIAL':
          text = replaceLead(text, ['For the record,', 'Let the room hear this plainly,'], hashSeed(`ceremony|${text}`));
          break;
        case 'MORE_INTIMATE':
          if (context.playerAlias) {
            text = text.replace(/\bYou\b/g, context.playerAlias).replace(/\byour\b/g, `${context.playerAlias}'s`);
          }
          break;
        case 'MORE_POST_EVENT':
          text = replaceLead(text, ['After what just happened,', 'Now that the event has landed,'], hashSeed(`post|${text}`));
          break;
        case 'MORE_PRE_EVENT':
          text = replaceLead(text, ['Before this opens beneath you,', 'While you still think this is negotiable,'], hashSeed(`pre|${text}`));
          break;
        default:
          break;
      }
    }

    text = normalizeSpace(text);
    const strategy = [
      context.sceneArchetype ?? 'freeplay',
      context.sceneRole ?? 'line',
      context.pressureBand ?? 'CALM',
      context.relationshipEscalationTier ?? 'NONE',
    ].join('|');
    const surfaceVariantId = `${line.canonicalLineId}:${hashSeed(`${strategy}|${text}|${context.now}`).toString(16)}`;

    return {
      canonicalLineId: line.canonicalLineId,
      surfaceVariantId,
      strategy,
      realizedText: text,
      transformsApplied: transforms,
      rhetoricalTemplateIds: [
        line.rhetoricalForm ?? 'authored-base',
        ...transforms.map((item) => `transform:${item.toLowerCase()}`),
      ],
      semanticClusterIds: [
        line.motifId ?? line.category,
        context.sceneArchetype ?? 'scene-generic',
        context.sceneRole ?? 'role-generic',
      ],
      tags: [...(line.tags ?? [])],
    };
  }
}

export function createChatSurfaceRealizer(): ChatSurfaceRealizer {
  return new ChatSurfaceRealizer();
}
