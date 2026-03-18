/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT BOT PERSONA EVOLUTION
 * FILE: pzo-web/src/engines/chat/npc/ChatBotPersonaEvolution.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Deterministic runtime evolution layer for authored rival personas.
 *
 * This file does not replace bark authorship or relationship logic. It sits on
 * top of both and converts long-horizon player history into:
 * - posture drift,
 * - transform bias drift,
 * - callback appetite,
 * - public vs private pressure split,
 * - and season-aware myth-building.
 * ============================================================================
 */

import {
  CHAT_PERSONA_STAGE_PROFILES,
  type ChatPersonaEvolutionEvent,
  type ChatPersonaEvolutionProfile,
  type ChatPersonaEvolutionSignal,
  type ChatPersonaEvolutionSnapshot,
  type ChatPersonaSplitMode,
  type ChatPersonaTemperament,
  buildDefaultPersonaEvolutionProfile,
  clamp01,
  resolvePersonaStage,
} from '../../../../../shared/contracts/chat/persona-evolution';
import type { ChatPlayerFingerprintSnapshot } from '../../../../../shared/contracts/chat/player-fingerprint';
import type { ChatLiveOpsOverlayContext } from '../../../../../shared/contracts/chat/liveops';
import type { ChatRelationshipSummaryView } from '../../../../../shared/contracts/chat/relationship';

const MAX_EVENT_TAIL = 64;

export interface ChatBotPersonaEvolutionProjectionRequest {
  readonly botId: string;
  readonly playerId?: string | null;
  readonly now: number;
  readonly channelId?: string | null;
  readonly fingerprint?: ChatPlayerFingerprintSnapshot | null;
  readonly relationship?: ChatRelationshipSummaryView | null;
  readonly overlay?: ChatLiveOpsOverlayContext | null;
}

export class ChatBotPersonaEvolution {
  private readonly profiles = new Map<string, ChatPersonaEvolutionProfile>();

  observe(event: ChatPersonaEvolutionEvent): ChatPersonaEvolutionProfile {
    const key = this.keyFor(event.botId, event.playerId);
    const current = this.profiles.get(key) ?? buildDefaultPersonaEvolutionProfile(event.botId, event.createdAt, event.playerId);

    let careerRuns = current.careerRuns;
    let meaningfulEvents = current.meaningfulEvents;
    let collapseWitnessCount = current.collapseWitnessCount;
    let comebackWitnessCount = current.comebackWitnessCount;
    let callbackUsageCount = current.callbackUsageCount;

    if (event.eventType === 'RUN_START') careerRuns += 1;
    if (this.isMeaningful(event)) meaningfulEvents += 1;
    if (event.eventType === 'PLAYER_COLLAPSE') collapseWitnessCount += 1;
    if (event.eventType === 'PLAYER_COMEBACK') comebackWitnessCount += 1;
    if (event.eventType === 'BOT_CALLBACK_USED') callbackUsageCount += 1;

    const stage = resolvePersonaStage(careerRuns, meaningfulEvents);
    const stageProfile = CHAT_PERSONA_STAGE_PROFILES.find((candidate) => candidate.stageId === stage)!;

    const next: ChatPersonaEvolutionProfile = {
      ...current,
      stage,
      splitMode: this.resolveSplitMode(current, event, stage),
      temperament: this.resolveTemperament(current, event, stage),
      vector: this.nextVector(current, event, stageProfile),
      activeTransformBiases: this.resolveTransformBiases(
        stage,
        this.resolveSplitMode(current, event, stage),
        this.resolveTemperament(current, event, stage),
      ),
      careerRuns,
      meaningfulEvents,
      collapseWitnessCount,
      comebackWitnessCount,
      callbackUsageCount,
      lastEvolvedAt: event.createdAt,
      lastMeaningfulEventAt: this.isMeaningful(event) ? event.createdAt : current.lastMeaningfulEventAt,
      lastSeasonId: event.eventType === 'SEASONAL_WORLD_EVENT' ? (event.tags?.[0] ?? current.lastSeasonId ?? null) : (current.lastSeasonId ?? null),
      eventTail: [...current.eventTail, event].slice(-MAX_EVENT_TAIL),
    };

    this.profiles.set(key, next);
    return next;
  }

  project(request: ChatBotPersonaEvolutionProjectionRequest): ChatPersonaEvolutionSignal {
    const profile = this.getProfile(request.botId, request.playerId, request.now);
    const notes: string[] = [];
    let selectionBias01 = 0.25 + profile.vector.playerSpecificity01 * 0.40;
    let callbackAggression01 = profile.vector.callbackAggression01;
    let publicPressureBias01 = profile.vector.publicPressureBias01;
    let privatePressureBias01 = profile.vector.privatePressureBias01;
    let prophecyCadence01 = profile.vector.prophecyCadence01;
    let playerSpecificity01 = profile.vector.playerSpecificity01;
    let seasonalAbsorption01 = profile.vector.seasonalAbsorption01;
    const transformBiases = new Set(profile.activeTransformBiases);

    if (request.relationship) {
      callbackAggression01 = clamp01(callbackAggression01 + request.relationship.unfinishedBusiness01 * 0.18);
      playerSpecificity01 = clamp01(playerSpecificity01 + request.relationship.familiarity01 * 0.22);
      if (request.relationship.obsession01 >= 0.58) {
        transformBiases.add('CALLBACK_REWRITE');
        transformBiases.add('PERSONAL_HISTORY_REWRITE');
        notes.push('Relationship obsession is high; callback appetite widened.');
      }
      if (request.relationship.contempt01 >= 0.62) {
        transformBiases.add('MORE_MOCKING');
        notes.push('Contempt elevated; mocking bias enabled.');
      }
      if (request.relationship.respect01 >= 0.62) {
        transformBiases.add('MORE_POST_EVENT');
        notes.push('Respect elevated; witness-oriented language favored.');
      }
    }

    if (request.fingerprint) {
      const fp = request.fingerprint.vector;
      selectionBias01 = clamp01(selectionBias01 + fp.publicness01 * 0.15 + fp.riskAppetite01 * 0.10);
      callbackAggression01 = clamp01(callbackAggression01 + fp.tilt01 * 0.12);
      prophecyCadence01 = clamp01(prophecyCadence01 + fp.noveltySeeking01 * 0.10);
      playerSpecificity01 = clamp01(playerSpecificity01 + request.fingerprint.confidence01 * 0.16);

      if (fp.publicness01 >= 0.62) transformBiases.add('MORE_PUBLIC');
      if (fp.publicness01 <= 0.38) transformBiases.add('MORE_INTIMATE');
      if (fp.procedureAwareness01 >= 0.62) transformBiases.add('LONGER_CEREMONIAL');
      if (fp.tilt01 >= 0.62) transformBiases.add('PRESSURE_REWRITE');
      if (fp.recoveryStrength01 >= 0.62) transformBiases.add('MORE_POST_EVENT');

      notes.push(`Player archetype: ${request.fingerprint.archetype}.`);
    }

    if (request.overlay) {
      seasonalAbsorption01 = clamp01(seasonalAbsorption01 + 0.18);
      publicPressureBias01 = clamp01(publicPressureBias01 + request.overlay.publicnessDelta);
      callbackAggression01 = clamp01(callbackAggression01 + request.overlay.callbackAggressionDelta);
      prophecyCadence01 = clamp01(prophecyCadence01 + Math.max(request.overlay.pressureDelta, 0) * 0.10);
      for (const transform of request.overlay.transformBiases) {
        transformBiases.add(transform as typeof profile.activeTransformBiases[number]);
      }
      notes.push(`LiveOps overlay active: ${request.overlay.displayName}.`);
    }

    if (request.channelId === 'GLOBAL') {
      publicPressureBias01 = clamp01(publicPressureBias01 + 0.12);
      transformBiases.add('MORE_PUBLIC');
      notes.push('Global channel: public witness split increased.');
    }

    if (request.channelId === 'SYNDICATE') {
      privatePressureBias01 = clamp01(privatePressureBias01 + 0.12);
      transformBiases.add('MORE_INTIMATE');
      notes.push('Syndicate channel: private pressure split increased.');
    }

    return {
      botId: request.botId,
      playerId: request.playerId ?? null,
      stage: profile.stage,
      splitMode: profile.splitMode,
      temperament: profile.temperament,
      transformBiases: [...transformBiases],
      selectionBias01: clamp01(selectionBias01),
      callbackAggression01,
      publicPressureBias01,
      privatePressureBias01,
      prophecyCadence01,
      playerSpecificity01,
      seasonalAbsorption01,
      notes,
    };
  }

  getProfile(botId: string, playerId: string | null | undefined, now: number): ChatPersonaEvolutionProfile {
    const key = this.keyFor(botId, playerId);
    const existing = this.profiles.get(key);
    if (existing) return existing;
    const created = buildDefaultPersonaEvolutionProfile(botId, now, playerId);
    this.profiles.set(key, created);
    return created;
  }

  getSnapshot(now = Date.now()): ChatPersonaEvolutionSnapshot {
    return {
      createdAt: now,
      updatedAt: now,
      profiles: [...this.profiles.values()],
    };
  }

  private nextVector(
    current: ChatPersonaEvolutionProfile,
    event: ChatPersonaEvolutionEvent,
    stageProfile: typeof CHAT_PERSONA_STAGE_PROFILES[number],
  ): ChatPersonaEvolutionProfile['vector'] {
    const intensity = clamp01(event.intensity01 ?? 0.50);
    const witness = clamp01(event.publicWitness01 ?? 0.50);
    const vector = { ...current.vector };
    const nudge = (value: number, delta: number): number => clamp01(value + delta * (0.25 + intensity * 0.75));

    vector.vocabularyWidening01 = clamp01(
      Math.max(nudge(vector.vocabularyWidening01, 0.02), stageProfile.vocabularyWidening01),
    );
    vector.callbackAggression01 = clamp01(
      Math.max(vector.callbackAggression01, stageProfile.callbackAggressionFloor01),
    );
    vector.playerSpecificity01 = nudge(vector.playerSpecificity01, 0.03);
    vector.seasonalAbsorption01 = nudge(vector.seasonalAbsorption01, event.eventType === 'SEASONAL_WORLD_EVENT' ? 0.22 : 0.01);

    switch (event.eventType) {
      case 'PLAYER_COMEBACK':
      case 'PLAYER_PERFECT_DEFENSE':
        vector.intimacyEscalation01 = nudge(vector.intimacyEscalation01, 0.06);
        vector.prophecyCadence01 = nudge(vector.prophecyCadence01, 0.05);
        vector.callbackAggression01 = nudge(vector.callbackAggression01, 0.08);
        break;
      case 'PLAYER_COLLAPSE':
      case 'PLAYER_BREACH':
        vector.toneHardening01 = nudge(vector.toneHardening01, 0.08);
        vector.publicPressureBias01 = nudge(vector.publicPressureBias01, 0.06 + witness * 0.10);
        vector.callbackAggression01 = nudge(vector.callbackAggression01, 0.10);
        break;
      case 'PLAYER_DISCIPLINE':
        vector.patienceShift01 = nudge(vector.patienceShift01, 0.08);
        vector.playerSpecificity01 = nudge(vector.playerSpecificity01, 0.05);
        break;
      case 'PLAYER_GREED':
      case 'PLAYER_OVERCONFIDENCE':
        vector.toneHardening01 = nudge(vector.toneHardening01, 0.05);
        vector.publicPressureBias01 = nudge(vector.publicPressureBias01, 0.04);
        break;
      case 'BOT_CALLBACK_USED':
        vector.callbackAggression01 = nudge(vector.callbackAggression01, 0.04);
        vector.playerSpecificity01 = nudge(vector.playerSpecificity01, 0.06);
        break;
      case 'PUBLIC_WITNESS':
        vector.publicPressureBias01 = nudge(vector.publicPressureBias01, 0.10 + witness * 0.08);
        break;
      case 'PRIVATE_WITNESS':
        vector.privatePressureBias01 = nudge(vector.privatePressureBias01, 0.12);
        break;
      case 'LIVEOPS_INTRUSION':
      case 'SEASONAL_WORLD_EVENT':
        vector.seasonalAbsorption01 = nudge(vector.seasonalAbsorption01, 0.20);
        vector.prophecyCadence01 = nudge(vector.prophecyCadence01, 0.08);
        break;
      default:
        vector.patienceShift01 = nudge(vector.patienceShift01, 0.01);
        break;
    }

    return vector;
  }

  private resolveSplitMode(
    current: ChatPersonaEvolutionProfile,
    event: ChatPersonaEvolutionEvent,
    stage: ChatPersonaEvolutionProfile['stage'],
  ): ChatPersonaSplitMode {
    if (event.eventType === 'PUBLIC_WITNESS') return 'PUBLIC';
    if (event.eventType === 'PRIVATE_WITNESS') return 'PRIVATE';
    if (stage === 'MYTHIC' && current.vector.privatePressureBias01 > current.vector.publicPressureBias01 + 0.10) {
      return 'PRIVATE';
    }
    if (stage === 'RIVALRIC' || stage === 'MYTHIC') return 'BALANCED';
    return current.splitMode;
  }

  private resolveTemperament(
    current: ChatPersonaEvolutionProfile,
    event: ChatPersonaEvolutionEvent,
    stage: ChatPersonaEvolutionProfile['stage'],
  ): ChatPersonaTemperament {
    if (event.eventType === 'PLAYER_COMEBACK' || event.eventType === 'PLAYER_PERFECT_DEFENSE') {
      return stage === 'MYTHIC' ? 'CEREMONIAL' : 'ADMIRING';
    }
    if (event.eventType === 'PLAYER_COLLAPSE' || event.eventType === 'PLAYER_BREACH') {
      return stage === 'INTRODUCTORY' ? 'COLD' : 'PREDATORY';
    }
    if (event.eventType === 'PLAYER_BLUFF' || event.eventType === 'PLAYER_ANGER') {
      return 'SARDONIC';
    }
    if (stage === 'RIVALRIC' || stage === 'MYTHIC') return 'HUNTING';
    return current.temperament;
  }

  private resolveTransformBiases(
    stage: ChatPersonaEvolutionProfile['stage'],
    splitMode: ChatPersonaSplitMode,
    temperament: ChatPersonaTemperament,
  ): ReadonlyArray<ChatPersonaEvolutionSignal['transformBiases'][number]> {
    const biases = new Set<ChatPersonaEvolutionSignal['transformBiases'][number]>();

    biases.add('MORE_DIRECT');
    if (temperament === 'PREDATORY' || temperament === 'HUNTING') biases.add('PRESSURE_REWRITE');
    if (temperament === 'SARDONIC') biases.add('MORE_MOCKING');
    if (temperament === 'CEREMONIAL') biases.add('LONGER_CEREMONIAL');
    if (temperament === 'ADMIRING') biases.add('MORE_POST_EVENT');
    if (splitMode === 'PUBLIC') biases.add('MORE_PUBLIC');
    if (splitMode === 'PRIVATE') biases.add('MORE_INTIMATE');
    if (stage === 'PERSONAL' || stage === 'RIVALRIC' || stage === 'MYTHIC') {
      biases.add('CALLBACK_REWRITE');
      biases.add('PERSONAL_HISTORY_REWRITE');
    }
    if (stage === 'MYTHIC') biases.add('MORE_PRE_EVENT');

    return [...biases];
  }

  private isMeaningful(event: ChatPersonaEvolutionEvent): boolean {
    return event.eventType !== 'BOT_TAUNT_EMITTED' && event.eventType !== 'BOT_RETREAT_EMITTED';
  }

  private keyFor(botId: string, playerId?: string | null): string {
    return `${playerId ?? 'GLOBAL'}::${botId}`;
  }
}

export function createChatBotPersonaEvolution(): ChatBotPersonaEvolution {
  return new ChatBotPersonaEvolution();
}
