/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT PLAYER FINGERPRINT MODEL
 * FILE: pzo-web/src/engines/chat/intelligence/ChatPlayerFingerprintModel.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Runtime-safe player fingerprint estimator for the frontend chat lane.
 *
 * This model is deliberately deterministic and side-effect-light so the UI can
 * adapt chat planning, transform bias, helper cadence, and rival targeting
 * before backend authority replies.
 * ============================================================================
 */

import {
  type ChatPlayerArchetypeId,
  type ChatPlayerCounterplayHint,
  type ChatPlayerFingerprintAxisId,
  type ChatPlayerFingerprintEvent,
  type ChatPlayerFingerprintSnapshot,
  type ChatPlayerFingerprintVector,
  clamp01,
  emptyPlayerFingerprintVector,
} from '../../../../../shared/contracts/chat/player-fingerprint';

const MAX_EVENT_TAIL = 96;

export interface ChatPlayerFingerprintModelOptions {
  readonly tailSize?: number;
}

interface PlayerState {
  readonly playerId: string;
  readonly updatedAt: number;
  readonly careerEventCount: number;
  readonly vector: ChatPlayerFingerprintVector;
  readonly eventTail: readonly ChatPlayerFingerprintEvent[];
}

export class ChatPlayerFingerprintModel {
  private readonly tailSize: number;
  private readonly states = new Map<string, PlayerState>();

  constructor(options: ChatPlayerFingerprintModelOptions = {}) {
    this.tailSize = Math.max(24, options.tailSize ?? MAX_EVENT_TAIL);
  }

  observe(event: ChatPlayerFingerprintEvent): ChatPlayerFingerprintSnapshot {
    const current = this.states.get(event.playerId) ?? this.createState(event.playerId, event.createdAt);
    const vector = this.applyEvent(current.vector, event);
    const next: PlayerState = {
      playerId: event.playerId,
      updatedAt: event.createdAt,
      careerEventCount: current.careerEventCount + 1,
      vector,
      eventTail: [...current.eventTail, event].slice(-this.tailSize),
    };
    this.states.set(event.playerId, next);
    return this.toSnapshot(next);
  }

  observeMessage(
    playerId: string,
    messageId: string,
    text: string,
    createdAt: number,
    channelId?: string | null,
    roomId?: string | null,
  ): ChatPlayerFingerprintSnapshot {
    const normalized = text.trim().toLowerCase();
    let eventType: ChatPlayerFingerprintEvent['eventType'] = 'MESSAGE_SENT';

    if (normalized.includes('?')) eventType = 'MESSAGE_QUESTION';
    if (/(lol|lmao|cope|skill issue|cry|owned)/i.test(text)) eventType = 'MESSAGE_TAUNT';
    if (/(watch me|i got this|easy|light work|i never miss)/i.test(text)) eventType = 'MESSAGE_BOAST';
    if (/(whatever|sure|fine|k)/i.test(text)) eventType = 'MESSAGE_DEFLECTION';
    if (/(breathe|steady|calm|wait|hold)/i.test(text)) eventType = 'MESSAGE_CALM';

    return this.observe({
      eventId: messageId,
      playerId,
      eventType,
      createdAt,
      text,
      channelId: channelId ?? null,
      roomId: roomId ?? null,
      intensity01: this.estimateIntensityFromText(text),
      publicWitness01: this.estimatePublicness(channelId),
      tags: this.deriveTags(text),
    });
  }

  getSnapshot(playerId: string): ChatPlayerFingerprintSnapshot {
    const current = this.states.get(playerId) ?? this.createState(playerId, Date.now());
    return this.toSnapshot(current);
  }

  getCounterplayHint(playerId: string): ChatPlayerCounterplayHint {
    const snapshot = this.getSnapshot(playerId);
    switch (snapshot.archetype) {
      case 'THE_SPECULATOR':
        return {
          archetype: snapshot.archetype,
          idealBotObjectives: ['PRESSURE', 'REPRICE', 'PROVOKE'],
          idealSceneArchetypes: ['TRAP_SCENE', 'DEAL_ROOM_PRESSURE_SCENE'],
          transformBiases: ['MORE_DIRECT', 'PRESSURE_REWRITE', 'CALLBACK_REWRITE'],
          notes: ['High appetite for risk framing.', 'Punish timing greed and premature conviction.'],
        };
      case 'THE_LAWYER':
        return {
          archetype: snapshot.archetype,
          idealBotObjectives: ['DELAY', 'TEST', 'NEGOTIATE'],
          idealSceneArchetypes: ['FALSE_CALM_SCENE', 'DEAL_ROOM_PRESSURE_SCENE'],
          transformBiases: ['LONGER_CEREMONIAL', 'MORE_PRE_EVENT'],
          notes: ['Procedure-aware player.', 'Precision language beats raw hostility.'],
        };
      case 'THE_SHOWMAN':
        return {
          archetype: snapshot.archetype,
          idealBotObjectives: ['HUMILIATE', 'PUBLIC_WITNESS', 'PROVOKE'],
          idealSceneArchetypes: ['PUBLIC_HUMILIATION_SCENE', 'COMEBACK_WITNESS_SCENE'],
          transformBiases: ['MORE_PUBLIC', 'MORE_MOCKING'],
          notes: ['Public witness matters here.', 'Crowd-facing lines will land harder.'],
        };
      case 'THE_GHOST':
        return {
          archetype: snapshot.archetype,
          idealBotObjectives: ['STUDY', 'TEST', 'CALLBACK'],
          idealSceneArchetypes: ['LONG_ARC_CALLBACK_SCENE', 'FALSE_CALM_SCENE'],
          transformBiases: ['MORE_INTIMATE', 'PERSONAL_HISTORY_REWRITE'],
          notes: ['Low-noise player.', 'Sparse, intimate callbacks are stronger than chatter.'],
        };
      case 'THE_COUNTERPUNCHER':
        return {
          archetype: snapshot.archetype,
          idealBotObjectives: ['CONTAIN', 'PRESSURE', 'TEST'],
          idealSceneArchetypes: ['BREACH_SCENE', 'COMEBACK_WITNESS_SCENE'],
          transformBiases: ['MORE_POST_EVENT', 'CALLBACK_REWRITE'],
          notes: ['Respect survival strength, but deny rhythm resets.'],
        };
      case 'THE_PERFECTIONIST':
        return {
          archetype: snapshot.archetype,
          idealBotObjectives: ['PROVOKE', 'WITNESS', 'PRESSURE'],
          idealSceneArchetypes: ['FALSE_CALM_SCENE', 'END_OF_RUN_RECKONING_SCENE'],
          transformBiases: ['SHORTER_COLDER', 'MORE_DIRECT'],
          notes: ['Micro-errors matter to this player.', 'Cold precision outperforms volume.'],
        };
      case 'THE_SHARK_BAIT':
        return {
          archetype: snapshot.archetype,
          idealBotObjectives: ['PRESSURE', 'HUMILIATE', 'REPRICE'],
          idealSceneArchetypes: ['TRAP_SCENE', 'PUBLIC_HUMILIATION_SCENE'],
          transformBiases: ['MORE_MOCKING', 'PRESSURE_REWRITE'],
          notes: ['Instability creates easy bait windows.', 'Escalate when the player self-tilts.'],
        };
      default:
        return {
          archetype: snapshot.archetype,
          idealBotObjectives: ['WITNESS', 'TEST', 'PRESSURE'],
          idealSceneArchetypes: ['COMEBACK_WITNESS_SCENE', 'BREACH_SCENE'],
          transformBiases: ['MORE_POST_EVENT', 'MORE_DIRECT'],
          notes: ['Recovery-capable player.', 'Force the next decision after the save.'],
        };
    }
  }

  private createState(playerId: string, now: number): PlayerState {
    return {
      playerId,
      updatedAt: now,
      careerEventCount: 0,
      vector: emptyPlayerFingerprintVector(),
      eventTail: [],
    };
  }

  private applyEvent(
    current: ChatPlayerFingerprintVector,
    event: ChatPlayerFingerprintEvent,
  ): ChatPlayerFingerprintVector {
    const next = { ...current };
    const intensity = clamp01(event.intensity01 ?? 0.45);
    const witness = clamp01(event.publicWitness01 ?? this.estimatePublicness(event.channelId));
    const adjust = (value: number, delta: number): number => clamp01(value + delta * (0.35 + intensity * 0.65));

    switch (event.eventType) {
      case 'MESSAGE_TAUNT':
        next.bluff01 = adjust(next.bluff01, 0.10);
        next.publicness01 = adjust(next.publicness01, 0.08 + witness * 0.12);
        next.tilt01 = adjust(next.tilt01, 0.04);
        break;
      case 'MESSAGE_BOAST':
        next.riskAppetite01 = adjust(next.riskAppetite01, 0.12);
        next.greed01 = adjust(next.greed01, 0.08);
        next.publicness01 = adjust(next.publicness01, 0.12 + witness * 0.10);
        break;
      case 'MESSAGE_DEFLECTION':
        next.bluff01 = adjust(next.bluff01, 0.08);
        next.procedureAwareness01 = adjust(next.procedureAwareness01, -0.03);
        break;
      case 'MESSAGE_CALM':
        next.impulsive01 = adjust(next.impulsive01, -0.10);
        next.tilt01 = adjust(next.tilt01, -0.12);
        next.recoveryStrength01 = adjust(next.recoveryStrength01, 0.08);
        break;
      case 'TURN_TIMEOUT':
        next.impulsive01 = adjust(next.impulsive01, -0.05);
        next.tilt01 = adjust(next.tilt01, 0.04);
        break;
      case 'SHIELD_BROKEN':
      case 'CASCADE_TRIGGERED':
      case 'COLLAPSE':
        next.tilt01 = adjust(next.tilt01, 0.14);
        next.comeback01 = adjust(next.comeback01, -0.08);
        break;
      case 'CASCADE_ESCAPED':
      case 'COMEBACK':
      case 'PERFECT_DEFENSE':
        next.comeback01 = adjust(next.comeback01, 0.14);
        next.recoveryStrength01 = adjust(next.recoveryStrength01, 0.12);
        next.tilt01 = adjust(next.tilt01, -0.06);
        break;
      case 'FAILED_GAMBLE':
      case 'BIG_SWING':
        next.riskAppetite01 = adjust(next.riskAppetite01, 0.14);
        next.greed01 = adjust(next.greed01, 0.10);
        break;
      case 'SMALL_DISCIPLINED_PLAY':
      case 'NEGOTIATION_REJECTED':
        next.procedureAwareness01 = adjust(next.procedureAwareness01, 0.10);
        next.impulsive01 = adjust(next.impulsive01, -0.08);
        break;
      case 'NEGOTIATION_ACCEPTED':
        next.procedureAwareness01 = adjust(next.procedureAwareness01, 0.04);
        next.publicness01 = adjust(next.publicness01, -0.02);
        break;
      case 'MESSAGE_QUESTION':
        next.procedureAwareness01 = adjust(next.procedureAwareness01, 0.05);
        break;
      default:
        break;
    }

    next.noveltySeeking01 = clamp01(
      next.noveltySeeking01 * 0.92 + this.deriveNoveltySeekingBoost(event) * 0.08,
    );

    return next;
  }

  private toSnapshot(state: PlayerState): ChatPlayerFingerprintSnapshot {
    const archetype = this.classifyArchetype(state.vector);
    const dominantAxes = this.resolveDominantAxes(state.vector);
    const exploitableSeams = this.resolveExploitableSeams(state.vector);
    const resilienceTags = this.resolveResilienceTags(state.vector);
    const pressureResponseTags = this.resolvePressureResponseTags(state.vector);
    const confidence01 = clamp01(Math.min(1, state.careerEventCount / 40));

    return {
      playerId: state.playerId,
      updatedAt: state.updatedAt,
      careerEventCount: state.careerEventCount,
      recentEventCount: state.eventTail.length,
      archetype,
      confidence01,
      vector: state.vector,
      dominantAxes,
      pressureResponseTags,
      exploitableSeams,
      resilienceTags,
      eventTail: state.eventTail,
    };
  }

  private classifyArchetype(vector: ChatPlayerFingerprintVector): ChatPlayerArchetypeId {
    if (vector.procedureAwareness01 >= 0.68 && vector.impulsive01 <= 0.44) return 'THE_LAWYER';
    if (vector.publicness01 >= 0.68 && vector.bluff01 >= 0.60) return 'THE_SHOWMAN';
    if (vector.recoveryStrength01 >= 0.66 && vector.comeback01 >= 0.62) return 'THE_COUNTERPUNCHER';
    if (vector.impulsive01 <= 0.38 && vector.publicness01 <= 0.36) return 'THE_GHOST';
    if (vector.riskAppetite01 >= 0.70 && vector.greed01 >= 0.60) return 'THE_SPECULATOR';
    if (vector.tilt01 >= 0.70 && vector.recoveryStrength01 <= 0.42) return 'THE_SHARK_BAIT';
    if (vector.procedureAwareness01 >= 0.60 && vector.tilt01 <= 0.40) return 'THE_PERFECTIONIST';
    return 'THE_SURVIVOR';
  }

  private resolveDominantAxes(vector: ChatPlayerFingerprintVector): readonly ChatPlayerFingerprintAxisId[] {
    const scored: Array<[ChatPlayerFingerprintAxisId, number]> = [
      ['IMPULSIVE_VS_PATIENT', Math.abs(vector.impulsive01 - 0.5)],
      ['GREED_VS_DEFENSE', Math.abs(vector.greed01 - 0.5)],
      ['BLUFF_VS_LITERAL', Math.abs(vector.bluff01 - 0.5)],
      ['COMEBACK_VS_COLLAPSE', Math.abs(vector.comeback01 - 0.5)],
      ['PUBLIC_VS_PRIVATE', Math.abs(vector.publicness01 - 0.5)],
      ['PROCEDURE_AWARE_VS_CARELESS', Math.abs(vector.procedureAwareness01 - 0.5)],
      ['NOVELTY_SEEKING_VS_STABILITY', Math.abs(vector.noveltySeeking01 - 0.5)],
      ['TILT_VS_DISCIPLINE', Math.abs(vector.tilt01 - 0.5)],
      ['RISK_APPETITE', Math.abs(vector.riskAppetite01 - 0.5)],
      ['RECOVERY_STRENGTH', Math.abs(vector.recoveryStrength01 - 0.5)],
    ];

    return scored
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([axis]) => axis);
  }

  private resolveExploitableSeams(vector: ChatPlayerFingerprintVector): readonly string[] {
    const seams: string[] = [];
    if (vector.greed01 >= 0.62) seams.push('High greed susceptibility under momentum framing.');
    if (vector.publicness01 >= 0.62) seams.push('Public witness pressure amplifies mistakes.');
    if (vector.tilt01 >= 0.60) seams.push('Escalation after setbacks is likely.');
    if (vector.bluff01 >= 0.62) seams.push('Deflection and theater can be baited into overexposure.');
    if (vector.procedureAwareness01 <= 0.40) seams.push('Administrative hostility may land cleanly.');
    return seams;
  }

  private resolveResilienceTags(vector: ChatPlayerFingerprintVector): readonly string[] {
    const tags: string[] = [];
    if (vector.recoveryStrength01 >= 0.60) tags.push('RECOVERS_UNDER_PRESSURE');
    if (vector.impulsive01 <= 0.42) tags.push('DELIBERATE');
    if (vector.procedureAwareness01 >= 0.62) tags.push('READS_THE_FINE_PRINT');
    if (vector.comeback01 >= 0.60) tags.push('COMEBACK_CAPABLE');
    return tags;
  }

  private resolvePressureResponseTags(vector: ChatPlayerFingerprintVector): readonly string[] {
    const tags: string[] = [];
    if (vector.tilt01 >= 0.60) tags.push('TILT_SPIKE');
    if (vector.publicness01 >= 0.62) tags.push('PERFORMS_FOR_THE_ROOM');
    if (vector.bluff01 >= 0.58) tags.push('MASKS_WITH_TONE');
    if (vector.impulsive01 >= 0.60) tags.push('RUSHES_EDGE_CASES');
    if (vector.recoveryStrength01 >= 0.60) tags.push('STABILIZES_AFTER_DAMAGE');
    return tags;
  }

  private deriveNoveltySeekingBoost(event: ChatPlayerFingerprintEvent): number {
    switch (event.eventType) {
      case 'BIG_SWING':
      case 'MESSAGE_TAUNT':
      case 'MESSAGE_BOAST':
        return 0.80;
      case 'SMALL_DISCIPLINED_PLAY':
      case 'NEGOTIATION_REJECTED':
        return 0.30;
      default:
        return 0.50;
    }
  }

  private estimateIntensityFromText(text: string): number {
    const upper = [...text].filter((char) => char >= 'A' && char <= 'Z').length;
    const exclamations = (text.match(/!/g) ?? []).length;
    const words = text.trim().split(/\s+/).filter(Boolean).length || 1;
    return clamp01((upper / words) * 0.8 + exclamations * 0.08 + Math.min(words / 18, 0.25));
  }

  private estimatePublicness(channelId?: string | null): number {
    switch (channelId) {
      case 'GLOBAL':
        return 0.95;
      case 'DEAL_ROOM':
        return 0.55;
      case 'LOBBY':
        return 0.68;
      case 'SYNDICATE':
        return 0.30;
      default:
        return 0.50;
    }
  }

  private deriveTags(text: string): readonly string[] {
    const tags: string[] = [];
    if (/(wait|steady|hold|breathe)/i.test(text)) tags.push('CALM_SIGNAL');
    if (/(easy|light work|free|cooked)/i.test(text)) tags.push('FLEX_SIGNAL');
    if (/(why|how|what|where|when)/i.test(text)) tags.push('QUESTION_SIGNAL');
    if (/(lol|lmao|cope|cry)/i.test(text)) tags.push('TAUNT_SIGNAL');
    return tags;
  }
}

export function createChatPlayerFingerprintModel(
  options?: ChatPlayerFingerprintModelOptions,
): ChatPlayerFingerprintModel {
  return new ChatPlayerFingerprintModel(options);
}
