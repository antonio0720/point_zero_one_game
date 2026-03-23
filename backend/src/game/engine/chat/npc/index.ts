/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT NPC DOMAIN INDEX
 * FILE: backend/src/game/engine/chat/npc/index.ts
 * ============================================================================
 *
 * Doctrine
 * --------
 * - this file is not a thin barrel; it is the backend npc domain façade for the chat engine
 * - the rest of the backend should not know how hater, helper, ambient, cadence, and suppression are wired together
 * - all npc selection must pass through one place so transcript truth stays coherent across room, channel, pressure, witness, and replay law
 * - the frontend may mirror candidate scenes, but backend index owns the final ranked npc plan surface
 *
 * Operational Contract
 * --------------------
 * This file answers five questions for the rest of backend chat:
 * 1. which npc voices are even eligible in this room right now?
 * 2. which registry line is strongest for each eligible voice?
 * 3. which of those candidates survive cadence and suppression?
 * 4. which candidate wins when multiple npc lanes compete for transcript truth?
 * 5. what diagnostics, snapshots, and audit structures should the engine emit around that decision?
 */

import type {
  AmbientChannelAffinity,
  AmbientNpcContext,
  AmbientNpcLine,
  AmbientNpcPersonaId,
  AmbientNpcProfile,
  AmbientRegistrySnapshot,
  AmbientScenarioCandidate,
} from './AmbientNpcRegistry';
import {
  AmbientNpcRegistry,
  ambientNpcRegistry,
  createAmbientNpcRegistry,
} from './AmbientNpcRegistry';
import type {
  HaterDialogueContext,
  HaterDialogueLine,
  HaterPersonaProfile,
  HaterRegistryPersonaId,
  HaterRegistrySnapshot,
  HaterScenarioCandidate,
} from './HaterDialogueRegistry';
import {
  HaterDialogueRegistry,
  createHaterDialogueRegistry,
  haterDialogueRegistry,
} from './HaterDialogueRegistry';
import type {
  HelperDialogueContext,
  HelperDialogueLine,
  HelperPersonaId,
  HelperPersonaProfile,
  HelperRegistrySnapshot,
  HelperScenarioCandidate,
} from './HelperDialogueRegistry';
import {
  HelperDialogueRegistry,
  createHelperDialogueRegistry,
  helperDialogueRegistry,
} from './HelperDialogueRegistry';
import type {
  CadenceChannel,
  CadenceContext,
  CadenceLedger,
  CadenceSceneState,
  NpcActorKind,
  NpcCadenceDecision,
  NpcCadenceRequest,
  RankedCadenceDecision,
  RoomCadenceSnapshot,
} from './NpcCadencePolicy';
import {
  NpcCadencePolicy,
  createNpcCadencePolicy,
  npcCadencePolicy,
} from './NpcCadencePolicy';
import type {
  NpcSuppressionActorId,
  NpcSuppressionBatchResult,
  NpcSuppressionDecision,
  NpcSuppressionLedger,
  NpcSuppressionRequest,
  NpcSuppressionRoomState,
  RankedSuppressionDecision,
} from './NpcSuppressionPolicy';
import {
  createNpcSuppressionPolicy,
  NpcSuppressionPolicy,
  npcSuppressionPolicy,
} from './NpcSuppressionPolicy';
import {
  ChatBotPersonaEvolutionService,
  createChatBotPersonaEvolutionService,
  type ChatPersonaEvolutionEvent,
  type ChatPersonaEvolutionProfile,
  type ChatPersonaEvolutionSignal,
  type ChatPersonaEvolutionSnapshot,
  type ChatPersonaStageId,
  type ChatPlayerFingerprintSnapshot,
  type ChatLiveOpsOverlayContext,
  type ChatRelationshipSummaryView,
  type EvolutionBatchObserveInput,
  type EvolutionBatchObserveResult,
  type EvolutionBatchProjectResult,
  type EvolutionProjectionInput,
  type BotEvolutionStats,
  type EvolutionSystemStats,
  type PersonaInsight,
  type BotCounterplayHint,
  type EvolutionStageTransitionRecord,
  type EvolutionServiceCompactSnapshot,
} from './ChatBotPersonaEvolutionService';

export * from './AmbientNpcRegistry';
export * from './HaterDialogueRegistry';
export * from './HelperDialogueRegistry';
export * from './NpcCadencePolicy';
export * from './NpcSuppressionPolicy';
export * from './ChatBotPersonaEvolutionService';

export type BackendNpcPersonaId = AmbientNpcPersonaId | HelperPersonaId | HaterRegistryPersonaId;
export type BackendNpcChannel = CadenceChannel;

export interface BackendNpcRoomState extends NpcSuppressionRoomState {}

export interface BackendNpcDomainLedger {
  readonly cadence: CadenceLedger;
  readonly suppression: NpcSuppressionLedger;
}

export interface BackendNpcRequestBase {
  readonly requestId: string;
  readonly channel: BackendNpcChannel;
  readonly context: CadenceContext;
  readonly desiredAtMs: number;
  readonly createdAtMs: number;
  readonly priorityHint?: number;
  readonly sourceEventKind?: string;
  readonly sourceEventId?: string;
  readonly force?: boolean;
  readonly allowShadow?: boolean;
  readonly moderationQuarantine?: boolean;
  readonly sessionMuted?: boolean;
  readonly witnessPreferred?: boolean;
  readonly rescueProtected?: boolean;
  readonly proofProtected?: boolean;
  readonly tagHints?: readonly string[];
}

export interface BackendAmbientPlanRequest extends BackendNpcRequestBase {
  readonly actorKind: 'AMBIENT';
  readonly personaId?: AmbientNpcPersonaId;
  readonly context: AmbientNpcContext;
}

export interface BackendHelperPlanRequest extends BackendNpcRequestBase {
  readonly actorKind: 'HELPER';
  readonly personaId?: HelperPersonaId;
  readonly context: HelperDialogueContext;
}

export interface BackendHaterPlanRequest extends BackendNpcRequestBase {
  readonly actorKind: 'HATER';
  readonly personaId?: HaterRegistryPersonaId;
  readonly context: HaterDialogueContext;
}

export interface BackendInvasionPlanRequest extends BackendNpcRequestBase {
  readonly actorKind: 'INVASION';
  readonly personaId?: never;
  readonly context: 'INVASION_OPEN' | 'INVASION_CLOSE';
}

export type BackendNpcPlanRequest =
  | BackendAmbientPlanRequest
  | BackendHelperPlanRequest
  | BackendHaterPlanRequest
  | BackendInvasionPlanRequest;

export interface AmbientPreparedCandidate {
  readonly actorKind: 'AMBIENT';
  readonly persona: AmbientNpcProfile;
  readonly line: AmbientNpcLine;
  readonly registryScore: number;
  readonly request: BackendAmbientPlanRequest;
}

export interface HelperPreparedCandidate {
  readonly actorKind: 'HELPER';
  readonly persona: HelperPersonaProfile;
  readonly line: HelperDialogueLine;
  readonly registryScore: number;
  readonly request: BackendHelperPlanRequest;
}

export interface HaterPreparedCandidate {
  readonly actorKind: 'HATER';
  readonly persona: HaterPersonaProfile;
  readonly line: HaterDialogueLine;
  readonly registryScore: number;
  readonly request: BackendHaterPlanRequest;
}

export interface InvasionPreparedCandidate {
  readonly actorKind: 'INVASION';
  readonly persona: null;
  readonly line: null;
  readonly registryScore: number;
  readonly request: BackendInvasionPlanRequest;
}

export type PreparedNpcCandidate =
  | AmbientPreparedCandidate
  | HelperPreparedCandidate
  | HaterPreparedCandidate
  | InvasionPreparedCandidate;

export interface BackendNpcPlanDecision {
  readonly allow: boolean;
  readonly actorKind: NpcActorKind;
  readonly channel: BackendNpcChannel;
  readonly context: CadenceContext;
  readonly personaId?: BackendNpcPersonaId;
  readonly lineId?: string;
  readonly text?: string;
  readonly request: BackendNpcPlanRequest;
  readonly registryScore: number;
  readonly cadence: NpcCadenceDecision;
  readonly suppression: NpcSuppressionDecision;
}

export interface BackendNpcBatchPlan {
  readonly ranked: readonly BackendNpcPlanDecision[];
  readonly winner: BackendNpcPlanDecision | null;
  readonly rejected: readonly BackendNpcPlanDecision[];
  readonly shadowed: readonly BackendNpcPlanDecision[];
  readonly deferred: readonly BackendNpcPlanDecision[];
  readonly diagnostics: Readonly<Record<string, unknown>>;
}

export interface BackendNpcRegistryAudit {
  readonly ambient: AmbientRegistrySnapshot;
  readonly helper: HelperRegistrySnapshot;
  readonly hater: HaterRegistrySnapshot;
  readonly ambientOccupancyMatrix: Readonly<Record<AmbientNpcPersonaId, number>>;
  readonly helperTriggerMatrix: Readonly<Record<HelperPersonaId, Readonly<Record<HelperDialogueContext, boolean>>>>;
  readonly haterAuditMatrix: Readonly<Record<HaterRegistryPersonaId, Readonly<Record<HaterDialogueContext, number>>>>;
}

export interface BackendNpcDomainSnapshot {
  readonly registryAudit: BackendNpcRegistryAudit;
  readonly cadenceDiagnostics: Readonly<Record<string, number | string | boolean>>;
  readonly suppressionDiagnostics: Readonly<Record<string, number | string | boolean>>;
  readonly witnessPlan: Readonly<Record<string, string | boolean | number>>;
  readonly channelSuppressionMap: Readonly<Record<CadenceChannel, Readonly<Record<NpcActorKind, boolean>>>>;
}

const clamp01 = (value: number | undefined): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
};

const stableHash = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
};

const inferAmbientChannel = (channel: BackendNpcChannel): AmbientChannelAffinity => {
  switch (channel) {
    case 'GLOBAL': return 'GLOBAL';
    case 'SYNDICATE': return 'SYNDICATE';
    case 'DEAL_ROOM': return 'DEAL_ROOM';
    case 'LOBBY': return 'LOBBY';
    default: return 'GLOBAL';
  }
};

const isAmbientContext = (context: CadenceContext): context is AmbientNpcContext => {
  return ambientNpcRegistry.listContexts().includes(context as AmbientNpcContext);
};

const isHelperContext = (context: CadenceContext): context is HelperDialogueContext => {
  return helperDialogueRegistry.listContexts().includes(context as HelperDialogueContext);
};

const isHaterContext = (context: CadenceContext): context is HaterDialogueContext => {
  return haterDialogueRegistry.listContexts().includes(context as HaterDialogueContext);
};

const actorIdOf = (request: BackendNpcPlanRequest): string => {
  if (request.actorKind === 'INVASION') return 'INVASION';
  return request.personaId ?? request.actorKind;
};

const mapToSuppressionRequest = (request: BackendNpcPlanRequest): NpcSuppressionRequest => {
  return Object.freeze({
    requestId: request.requestId,
    actorKind: request.actorKind,
    actorId: actorIdOf(request),
    personaId: request.actorKind === 'INVASION' ? undefined : request.personaId,
    channel: request.channel,
    context: request.context,
    desiredAtMs: request.desiredAtMs,
    createdAtMs: request.createdAtMs,
    priorityHint: request.priorityHint,
    sourceEventKind: request.sourceEventKind,
    sourceEventId: request.sourceEventId,
    force: request.force,
    allowShadow: request.allowShadow,
    moderationQuarantine: request.moderationQuarantine,
    sessionMuted: request.sessionMuted,
    witnessPreferred: request.witnessPreferred,
    rescueProtected: request.rescueProtected,
    proofProtected: request.proofProtected,
    tagHints: request.tagHints,
  });
};

const mapToCadenceRequest = (request: BackendNpcPlanRequest, floorMs: number): NpcCadenceRequest => {
  return Object.freeze({
    requestId: request.requestId,
    actorKind: request.actorKind,
    actorId: actorIdOf(request),
    personaId: request.actorKind === 'INVASION' ? undefined : request.personaId,
    channel: request.channel,
    context: request.context,
    createdAtMs: request.createdAtMs,
    desiredAtMs: request.desiredAtMs,
    lineCadenceFloorMs: floorMs,
    priorityHint: request.priorityHint,
    force: request.force,
    shadowPreferred: request.allowShadow,
    sourceEventKind: request.sourceEventKind,
    sourceEventId: request.sourceEventId,
  });
};

const decisionFromCandidate = (
  candidate: PreparedNpcCandidate,
  cadence: NpcCadenceDecision,
  suppression: NpcSuppressionDecision,
): BackendNpcPlanDecision => {
  if (candidate.actorKind === 'INVASION') {
    return Object.freeze({
      allow: suppression.allow,
      actorKind: candidate.actorKind,
      channel: candidate.request.channel,
      context: candidate.request.context,
      request: candidate.request,
      registryScore: candidate.registryScore,
      cadence,
      suppression,
    });
  }

  return Object.freeze({
    allow: suppression.allow,
    actorKind: candidate.actorKind,
    channel: candidate.request.channel,
    context: candidate.request.context,
    personaId: candidate.persona.id,
    lineId: candidate.line.id,
    text: candidate.line.text,
    request: candidate.request,
    registryScore: candidate.registryScore,
    cadence,
    suppression,
  });
};

const boostRegistryScore = (base: number, request: BackendNpcPlanRequest, room: BackendNpcRoomState): number => {
  const pressure = clamp01(room.pressure);
  const heat = clamp01(room.heat);
  const frustration = clamp01(room.frustration);
  const confidence = clamp01(room.confidence);
  let score = base;
  if (request.actorKind === 'HELPER') score += (frustration * 0.35) + ((1 - confidence) * 0.15);
  if (request.actorKind === 'HATER') score += (pressure * 0.25) + (heat * 0.2);
  if (request.actorKind === 'AMBIENT') score += (room.silenceDebt * 0.2) + ((1 - pressure) * 0.1);
  if (request.witnessPreferred) score += 0.35;
  return Number(score.toFixed(6));
};

export class BackendChatNpcDomain {
  public readonly ambientRegistry: AmbientNpcRegistry;
  public readonly helperRegistry: HelperDialogueRegistry;
  public readonly haterRegistry: HaterDialogueRegistry;
  public readonly cadencePolicy: NpcCadencePolicy;
  public readonly suppressionPolicy: NpcSuppressionPolicy;

  public constructor(input?: {
    readonly ambientRegistry?: AmbientNpcRegistry;
    readonly helperRegistry?: HelperDialogueRegistry;
    readonly haterRegistry?: HaterDialogueRegistry;
    readonly cadencePolicy?: NpcCadencePolicy;
    readonly suppressionPolicy?: NpcSuppressionPolicy;
  }) {
    this.ambientRegistry = input?.ambientRegistry ?? ambientNpcRegistry;
    this.helperRegistry = input?.helperRegistry ?? helperDialogueRegistry;
    this.haterRegistry = input?.haterRegistry ?? haterDialogueRegistry;
    this.cadencePolicy = input?.cadencePolicy ?? npcCadencePolicy;
    this.suppressionPolicy = input?.suppressionPolicy ?? npcSuppressionPolicy;
  }

  public createEmptyLedger(): BackendNpcDomainLedger {
    return Object.freeze({
      cadence: this.cadencePolicy.createEmptyLedger(),
      suppression: this.suppressionPolicy.createEmptyLedger(),
    });
  }

  public fromCadenceRoom(room: RoomCadenceSnapshot, extra?: Partial<BackendNpcRoomState>): BackendNpcRoomState {
    return this.suppressionPolicy.fromCadenceRoom(room, extra);
  }

  public buildRegistryAudit(): BackendNpcRegistryAudit {
    return Object.freeze({
      ambient: this.ambientRegistry.getSnapshot(),
      helper: this.helperRegistry.getSnapshot(),
      hater: this.haterRegistry.getSnapshot(),
      ambientOccupancyMatrix: this.ambientRegistry.buildOccupancyMatrix(),
      helperTriggerMatrix: this.helperRegistry.buildTriggerMatrix(),
      haterAuditMatrix: this.haterRegistry.buildAuditMatrix(),
    });
  }

  public buildSnapshot(room: BackendNpcRoomState, ledger: BackendNpcDomainLedger, nowMs: number): BackendNpcDomainSnapshot {
    return Object.freeze({
      registryAudit: this.buildRegistryAudit(),
      cadenceDiagnostics: this.cadencePolicy.buildDiagnostics(room, ledger.cadence, nowMs),
      suppressionDiagnostics: this.suppressionPolicy.buildDiagnostics(room, ledger.suppression, nowMs),
      witnessPlan: this.suppressionPolicy.buildWitnessPlan(room),
      channelSuppressionMap: this.suppressionPolicy.buildChannelSuppressionMap(room),
    });
  }

  public listAmbientCastForChannel(channel: AmbientChannelAffinity): readonly AmbientNpcPersonaId[] {
    return this.ambientRegistry.resolveChannelCast(channel);
  }

  public listAmbientCastForMode(modeId: string | undefined): readonly AmbientNpcPersonaId[] {
    return this.ambientRegistry.resolveModeCast(modeId);
  }

  public listHaterCastForMode(modeId: string | undefined): readonly HaterRegistryPersonaId[] {
    return this.haterRegistry.resolvePersonaByMode(modeId);
  }

  public inferAmbientWitnessPersona(request: BackendAmbientPlanRequest, room: BackendNpcRoomState): AmbientNpcPersonaId {
    return this.ambientRegistry.resolveWitnessPersona({
      personaId: request.personaId,
      context: request.context,
      tick: room.runTick,
      heat: room.heat,
      pressure: room.pressure,
      occupancy: room.occupancy,
      silenceDebt: room.silenceDebt,
      channel: inferAmbientChannel(request.channel),
      modeId: room.modeId,
      useCountByLineId: Object.freeze({}),
      allowShadow: request.allowShadow,
    });
  }

  public inferHelperPersona(request: BackendHelperPlanRequest, room: BackendNpcRoomState): HelperPersonaId {
    if (request.personaId) return request.personaId;
    return this.helperRegistry.resolveInterventionPersona({
      personaId: request.personaId,
      context: request.context,
      tick: room.runTick,
      frustration: room.frustration,
      confidence: room.confidence,
      coldStart: room.coldStart,
      urgency: room.playerNearBankruptcy || room.shieldBreached || room.nearSovereignty ? 1 : room.pressure,
      useCountByLineId: Object.freeze({}),
    });
  }

  public inferHaterPersona(request: BackendHaterPlanRequest, room: BackendNpcRoomState): HaterRegistryPersonaId {
    if (request.personaId) return request.personaId;
    return this.haterRegistry.resolveDefaultPersonaForContext(request.context);
  }

  public prepareAmbientCandidate(request: BackendAmbientPlanRequest, room: BackendNpcRoomState, ledger: BackendNpcDomainLedger): AmbientPreparedCandidate | null {
    const personaId = request.personaId ?? this.inferAmbientWitnessPersona(request, room);
    const ranked = this.ambientRegistry.rankScenario({
      personaId,
      context: request.context,
      tick: room.runTick,
      heat: room.heat,
      pressure: room.pressure,
      occupancy: room.occupancy,
      silenceDebt: room.silenceDebt,
      channel: inferAmbientChannel(request.channel),
      modeId: room.modeId,
      useCountByLineId: Object.freeze({}),
      allowShadow: request.allowShadow,
    });
    const winner = ranked[0];
    if (!winner) return null;
    return Object.freeze({
      actorKind: 'AMBIENT',
      persona: winner.persona,
      line: winner.line,
      registryScore: boostRegistryScore(winner.score, request, room),
      request: Object.freeze({ ...request, personaId: winner.persona.id }),
    });
  }

  public prepareHelperCandidate(request: BackendHelperPlanRequest, room: BackendNpcRoomState, ledger: BackendNpcDomainLedger): HelperPreparedCandidate | null {
    const personaId = this.inferHelperPersona(request, room);
    const ranked = this.helperRegistry.rankScenario({
      personaId,
      context: request.context,
      tick: room.runTick,
      frustration: room.frustration,
      confidence: room.confidence,
      coldStart: room.coldStart,
      urgency: room.playerNearBankruptcy || room.shieldBreached || room.nearSovereignty ? 1 : room.pressure,
      useCountByLineId: Object.freeze({}),
    });
    const winner = ranked[0];
    if (!winner) return null;
    return Object.freeze({
      actorKind: 'HELPER',
      persona: winner.persona,
      line: winner.line,
      registryScore: boostRegistryScore(winner.score, request, room),
      request: Object.freeze({ ...request, personaId: winner.persona.id }),
    });
  }

  public prepareHaterCandidate(request: BackendHaterPlanRequest, room: BackendNpcRoomState, ledger: BackendNpcDomainLedger): HaterPreparedCandidate | null {
    const personaId = this.inferHaterPersona(request, room);
    const ranked = this.haterRegistry.rankScenario({
      personaId,
      context: request.context,
      tick: room.runTick,
      pressure: room.pressure,
      heat: room.heat,
      rivalry: clamp01(room.confidence + (room.recentComebackCount ?? 0) * 0.1),
      useCountByLineId: Object.freeze({}),
      shadowMode: request.allowShadow,
    });
    const winner = ranked[0];
    if (!winner) return null;
    return Object.freeze({
      actorKind: 'HATER',
      persona: winner.persona,
      line: winner.line,
      registryScore: boostRegistryScore(winner.score, request, room),
      request: Object.freeze({ ...request, personaId: winner.persona.id }),
    });
  }

  public prepareInvasionCandidate(request: BackendInvasionPlanRequest): InvasionPreparedCandidate {
    return Object.freeze({
      actorKind: 'INVASION',
      persona: null,
      line: null,
      registryScore: 10,
      request,
    });
  }

  public prepareCandidate(request: BackendNpcPlanRequest, room: BackendNpcRoomState, ledger: BackendNpcDomainLedger): PreparedNpcCandidate | null {
    switch (request.actorKind) {
      case 'AMBIENT': return this.prepareAmbientCandidate(request, room, ledger);
      case 'HELPER': return this.prepareHelperCandidate(request, room, ledger);
      case 'HATER': return this.prepareHaterCandidate(request, room, ledger);
      case 'INVASION': return this.prepareInvasionCandidate(request);
      default: return null;
    }
  }

  public evaluateCandidate(candidate: PreparedNpcCandidate, room: BackendNpcRoomState, ledger: BackendNpcDomainLedger): BackendNpcPlanDecision {
    const request = candidate.request;
    const cadence = this.cadencePolicy.evaluate(
      mapToCadenceRequest(request, candidate.actorKind === 'INVASION' ? 9_000 : candidate.line?.cadenceFloorMs ?? 12_000),
      room,
      ledger.cadence,
    );
    const suppression = this.suppressionPolicy.evaluate(
      mapToSuppressionRequest(request),
      room,
      ledger.suppression,
    );
    return decisionFromCandidate(candidate, cadence, suppression);
  }

  public rankCandidates(
    candidates: readonly PreparedNpcCandidate[],
    room: BackendNpcRoomState,
    ledger: BackendNpcDomainLedger,
  ): readonly BackendNpcPlanDecision[] {
    const ranked = candidates
      .map((candidate) => this.evaluateCandidate(candidate, room, ledger))
      .sort((left, right) => {
        if (left.allow !== right.allow) return left.allow ? -1 : 1;
        if (left.suppression.visibility !== right.suppression.visibility) {
          const weight = { public: 0, shadow: 1, deferred: 2, dropped: 3 } as const;
          return weight[left.suppression.visibility] - weight[right.suppression.visibility];
        }
        if (left.suppression.priorityScore !== right.suppression.priorityScore) return right.suppression.priorityScore - left.suppression.priorityScore;
        if (left.registryScore !== right.registryScore) return right.registryScore - left.registryScore;
        return stableHash(`${left.request.requestId}:${left.personaId ?? 'inv'}`) - stableHash(`${right.request.requestId}:${right.personaId ?? 'inv'}`);
      });
    return Object.freeze(ranked);
  }

  public planBatch(
    requests: readonly BackendNpcPlanRequest[],
    room: BackendNpcRoomState,
    ledger: BackendNpcDomainLedger,
  ): BackendNpcBatchPlan {
    const prepared = requests
      .map((request) => this.prepareCandidate(request, room, ledger))
      .filter((candidate): candidate is PreparedNpcCandidate => Boolean(candidate));

    const ranked = this.rankCandidates(prepared, room, ledger);
    const winner = ranked.find((decision) => decision.allow) ?? null;
    const rejected = ranked.filter((decision) => decision.suppression.visibility === 'dropped');
    const shadowed = ranked.filter((decision) => decision.suppression.visibility === 'shadow');
    const deferred = ranked.filter((decision) => decision.suppression.visibility === 'deferred');

    return Object.freeze({
      ranked,
      winner,
      rejected: Object.freeze(rejected),
      shadowed: Object.freeze(shadowed),
      deferred: Object.freeze(deferred),
      diagnostics: Object.freeze({
        requests: requests.length,
        prepared: prepared.length,
        allowed: ranked.filter((decision) => decision.allow).length,
        rejected: rejected.length,
        deferred: deferred.length,
        shadowed: shadowed.length,
      }),
    });
  }

  public applyWinner(
    plan: BackendNpcBatchPlan,
    ledger: BackendNpcDomainLedger,
  ): BackendNpcDomainLedger {
    if (!plan.winner) return ledger;

    const winner = plan.winner;
    const request = winner.request;
    const cadenceLedger = winner.allow
      ? this.cadencePolicy.recordEmission(ledger.cadence, winner.cadence, mapToCadenceRequest(request, winner.cadence.effectiveCooldownMs), request.desiredAtMs)
      : this.cadencePolicy.recordSuppression(ledger.cadence, mapToCadenceRequest(request, winner.cadence.effectiveCooldownMs));

    const suppressionLedger = this.suppressionPolicy.recordDecision(
      ledger.suppression,
      mapToSuppressionRequest(request),
      winner.suppression,
      request.desiredAtMs,
    );

    return Object.freeze({ cadence: cadenceLedger, suppression: suppressionLedger });
  }

  public planSingle(
    request: BackendNpcPlanRequest,
    room: BackendNpcRoomState,
    ledger: BackendNpcDomainLedger,
  ): BackendNpcPlanDecision | null {
    const candidate = this.prepareCandidate(request, room, ledger);
    return candidate ? this.evaluateCandidate(candidate, room, ledger) : null;
  }

  public planCollapseWitness(room: BackendNpcRoomState, nowMs: number): readonly BackendNpcPlanRequest[] {
    if (!room.playerNearBankruptcy && !room.shieldBreached) return Object.freeze([]);
    return Object.freeze([
      Object.freeze({
        requestId: `npc_helper_collapse_${room.roomId}_${nowMs}`,
        actorKind: 'HELPER',
        channel: 'GLOBAL',
        context: 'PLAYER_NEAR_BANKRUPTCY',
        desiredAtMs: nowMs,
        createdAtMs: nowMs,
        priorityHint: 1.5,
        witnessPreferred: true,
      } satisfies BackendHelperPlanRequest),
      Object.freeze({
        requestId: `npc_hater_breach_${room.roomId}_${nowMs}`,
        actorKind: 'HATER',
        channel: 'GLOBAL',
        context: room.shieldBreached ? 'PLAYER_SHIELD_BREAK' : 'PLAYER_NEAR_BANKRUPTCY',
        desiredAtMs: nowMs + 650,
        createdAtMs: nowMs,
        priorityHint: 1.15,
      } satisfies BackendHaterPlanRequest),
      Object.freeze({
        requestId: `npc_ambient_breach_${room.roomId}_${nowMs}`,
        actorKind: 'AMBIENT',
        channel: 'GLOBAL',
        context: room.shieldBreached ? 'PLAYER_SHIELD_BREAK' : 'PLAYER_LOST',
        desiredAtMs: nowMs + 1_350,
        createdAtMs: nowMs,
        priorityHint: 0.85,
        allowShadow: true,
      } satisfies BackendAmbientPlanRequest),
    ]);
  }

  public planComebackWitness(room: BackendNpcRoomState, nowMs: number): readonly BackendNpcPlanRequest[] {
    if ((room.recentComebackCount ?? 0) <= 0 && room.confidence < 0.55) return Object.freeze([]);
    return Object.freeze([
      Object.freeze({
        requestId: `npc_ambient_comeback_${room.roomId}_${nowMs}`,
        actorKind: 'AMBIENT',
        channel: 'GLOBAL',
        context: 'PLAYER_COMEBACK',
        desiredAtMs: nowMs,
        createdAtMs: nowMs,
        priorityHint: 1.1,
        witnessPreferred: true,
      } satisfies BackendAmbientPlanRequest),
      Object.freeze({
        requestId: `npc_helper_comeback_${room.roomId}_${nowMs}`,
        actorKind: 'HELPER',
        channel: 'GLOBAL',
        context: 'PLAYER_COMEBACK',
        desiredAtMs: nowMs + 950,
        createdAtMs: nowMs,
        priorityHint: 0.8,
      } satisfies BackendHelperPlanRequest),
    ]);
  }

  public planIdleNudge(room: BackendNpcRoomState, nowMs: number): readonly BackendNpcPlanRequest[] {
    const lastPlayer = room.lastPlayerMessageAtMs ?? 0;
    if ((nowMs - lastPlayer) < 6_000) return Object.freeze([]);
    return Object.freeze([
      Object.freeze({
        requestId: `npc_idle_helper_${room.roomId}_${nowMs}`,
        actorKind: 'HELPER',
        channel: room.modeId.toLowerCase().includes('deal') ? 'DEAL_ROOM' : 'GLOBAL',
        context: 'PLAYER_IDLE',
        desiredAtMs: nowMs,
        createdAtMs: nowMs,
        priorityHint: 0.65,
        allowShadow: room.modeId.toLowerCase().includes('deal') || room.modeId.toLowerCase().includes('syndicate'),
      } satisfies BackendHelperPlanRequest),
      Object.freeze({
        requestId: `npc_idle_ambient_${room.roomId}_${nowMs}`,
        actorKind: 'AMBIENT',
        channel: room.modeId.toLowerCase().includes('lobby') ? 'LOBBY' : 'GLOBAL',
        context: 'PLAYER_IDLE',
        desiredAtMs: nowMs + 1_000,
        createdAtMs: nowMs,
        priorityHint: 0.35,
        allowShadow: true,
      } satisfies BackendAmbientPlanRequest),
    ]);
  }

  public planDealRoomScene(room: BackendNpcRoomState, nowMs: number): readonly BackendNpcPlanRequest[] {
    if (!room.modeId.toLowerCase().includes('deal') && !room.dealStalled) return Object.freeze([]);
    const stalled = room.dealStalled;
    return Object.freeze([
      Object.freeze({
        requestId: `npc_deal_hater_${room.roomId}_${nowMs}`,
        actorKind: 'HATER',
        channel: 'DEAL_ROOM',
        context: stalled ? 'PLAYER_IDLE' : 'PLAYER_CARD_PLAY',
        desiredAtMs: nowMs,
        createdAtMs: nowMs,
        priorityHint: stalled ? 1.2 : 0.8,
        allowShadow: true,
      } satisfies BackendHaterPlanRequest),
      Object.freeze({
        requestId: `npc_deal_helper_${room.roomId}_${nowMs}`,
        actorKind: 'HELPER',
        channel: 'DEAL_ROOM',
        context: stalled ? 'PLAYER_NEAR_BANKRUPTCY' : 'PLAYER_CARD_PLAY',
        desiredAtMs: nowMs + 700,
        createdAtMs: nowMs,
        priorityHint: 0.75,
        allowShadow: true,
      } satisfies BackendHelperPlanRequest),
    ]);
  }

  public planSyndicateScene(room: BackendNpcRoomState, nowMs: number): readonly BackendNpcPlanRequest[] {
    if (!room.modeId.toLowerCase().includes('syndicate')) return Object.freeze([]);
    return Object.freeze([
      Object.freeze({
        requestId: `npc_syn_ambient_${room.roomId}_${nowMs}`,
        actorKind: 'AMBIENT',
        channel: 'SYNDICATE',
        context: 'SYNDICATE_JOIN',
        desiredAtMs: nowMs,
        createdAtMs: nowMs,
        priorityHint: 0.6,
        allowShadow: true,
      } satisfies BackendAmbientPlanRequest),
      Object.freeze({
        requestId: `npc_syn_helper_${room.roomId}_${nowMs}`,
        actorKind: 'HELPER',
        channel: 'SYNDICATE',
        context: room.nearSovereignty ? 'NEAR_SOVEREIGNTY' : 'GAME_START',
        desiredAtMs: nowMs + 800,
        createdAtMs: nowMs,
        priorityHint: 0.55,
        allowShadow: true,
      } satisfies BackendHelperPlanRequest),
    ]);
  }

  public planPostRunScene(room: BackendNpcRoomState, nowMs: number): readonly BackendNpcPlanRequest[] {
    if (!room.postRun) return Object.freeze([]);
    return Object.freeze([
      Object.freeze({
        requestId: `npc_post_helper_${room.roomId}_${nowMs}`,
        actorKind: 'HELPER',
        channel: 'GLOBAL',
        context: room.playerNearBankruptcy || room.recentCollapseCount ? 'PLAYER_LOST' : 'NEAR_SOVEREIGNTY',
        desiredAtMs: nowMs,
        createdAtMs: nowMs,
        priorityHint: 0.95,
      } satisfies BackendHelperPlanRequest),
      Object.freeze({
        requestId: `npc_post_ambient_${room.roomId}_${nowMs}`,
        actorKind: 'AMBIENT',
        channel: 'GLOBAL',
        context: room.playerNearBankruptcy || room.recentCollapseCount ? 'PLAYER_LOST' : 'NEAR_SOVEREIGNTY',
        desiredAtMs: nowMs + 850,
        createdAtMs: nowMs,
        priorityHint: 0.7,
      } satisfies BackendAmbientPlanRequest),
    ]);
  }

  public planInvasionScene(room: BackendNpcRoomState, nowMs: number): readonly BackendNpcPlanRequest[] {
    if (!room.invasionActive) return Object.freeze([]);
    return Object.freeze([
      Object.freeze({
        requestId: `npc_invasion_open_${room.roomId}_${nowMs}`,
        actorKind: 'INVASION',
        channel: 'GLOBAL',
        context: 'INVASION_OPEN',
        desiredAtMs: nowMs,
        createdAtMs: nowMs,
        priorityHint: 2,
        witnessPreferred: true,
      } satisfies BackendInvasionPlanRequest),
      Object.freeze({
        requestId: `npc_invasion_hater_${room.roomId}_${nowMs}`,
        actorKind: 'HATER',
        channel: 'GLOBAL',
        context: 'BOT_WINNING',
        desiredAtMs: nowMs + 650,
        createdAtMs: nowMs,
        priorityHint: 1.5,
      } satisfies BackendHaterPlanRequest),
    ]);
  }

  public planWitnessPack(room: BackendNpcRoomState, nowMs: number): readonly BackendNpcPlanRequest[] {
    const output: BackendNpcPlanRequest[] = [];
    output.push(...this.planCollapseWitness(room, nowMs));
    output.push(...this.planComebackWitness(room, nowMs));
    output.push(...this.planIdleNudge(room, nowMs));
    output.push(...this.planDealRoomScene(room, nowMs));
    output.push(...this.planSyndicateScene(room, nowMs));
    output.push(...this.planPostRunScene(room, nowMs));
    output.push(...this.planInvasionScene(room, nowMs));
    return Object.freeze(output);
  }

  public reduceToWinner(plan: BackendNpcBatchPlan): BackendNpcPlanDecision | null {
    return plan.winner;
  }

  public buildNarrativeSummary(plan: BackendNpcBatchPlan): string {
    if (!plan.winner) return 'no_npc_winner';
    const winner = plan.winner;
    return `${winner.actorKind}:${winner.personaId ?? 'INVASION'}:${winner.context}:${winner.suppression.visibility}:${winner.registryScore.toFixed(3)}`;
  }

  public buildPreparedDiagnostics(candidate: PreparedNpcCandidate): Readonly<Record<string, unknown>> {
    if (candidate.actorKind === 'INVASION') {
      return Object.freeze({
        actorKind: candidate.actorKind,
        requestId: candidate.request.requestId,
        registryScore: candidate.registryScore,
        lineId: null,
      });
    }

    return Object.freeze({
      actorKind: candidate.actorKind,
      requestId: candidate.request.requestId,
      personaId: candidate.persona.id,
      lineId: candidate.line.id,
      registryScore: candidate.registryScore,
      channel: candidate.request.channel,
      context: candidate.request.context,
    });
  }

  public buildPlanDiagnostics(plan: BackendNpcBatchPlan): Readonly<Record<string, unknown>> {
    return Object.freeze({
      ranked: plan.ranked.length,
      allowed: plan.ranked.filter((decision) => decision.allow).length,
      rejected: plan.rejected.length,
      deferred: plan.deferred.length,
      shadowed: plan.shadowed.length,
      summary: this.buildNarrativeSummary(plan),
      winner: plan.winner ? {
        actorKind: plan.winner.actorKind,
        personaId: plan.winner.personaId ?? null,
        context: plan.winner.context,
        visibility: plan.winner.suppression.visibility,
      } : null,
    });
  }
}

export const createBackendChatNpcDomain = (): BackendChatNpcDomain => new BackendChatNpcDomain({
  ambientRegistry: createAmbientNpcRegistry(),
  helperRegistry: createHelperDialogueRegistry(),
  haterRegistry: createHaterDialogueRegistry(),
  cadencePolicy: createNpcCadencePolicy(),
  suppressionPolicy: createNpcSuppressionPolicy(),
});

export const backendChatNpcDomain = new BackendChatNpcDomain();

// ─── Evolution service interface ──────────────────────────────────────────────
// Structural interface so BackendChatNpcDomainWithEvolution compiles against the
// full method surface without depending on the TS language server having already
// indexed the freshly-written ChatBotPersonaEvolutionService.ts.

export interface IBackendEvolutionService {
  observe(event: ChatPersonaEvolutionEvent): ChatPersonaEvolutionProfile;
  observeBatch(input: EvolutionBatchObserveInput): EvolutionBatchObserveResult;
  project(input: EvolutionProjectionInput): ChatPersonaEvolutionSignal;
  projectBatch(inputs: readonly EvolutionProjectionInput[]): EvolutionBatchProjectResult;
  getProfile(botId: string, playerId: string | null | undefined, now: number): ChatPersonaEvolutionProfile;
  getSnapshot(now?: number): ChatPersonaEvolutionSnapshot;
  listTransitions(): readonly EvolutionStageTransitionRecord[];
  getTransitionHistoryForBot(botId: string): readonly EvolutionStageTransitionRecord[];
  computeBotStats(botId: string, now?: number): BotEvolutionStats;
  computeSystemStats(now?: number): EvolutionSystemStats;
  hasReachedStage(botId: string, playerId: string | null | undefined, targetStage: ChatPersonaStageId, now?: number): boolean;
  scoreBotAggressionLevel(botId: string, playerId: string | null | undefined, now?: number): number;
  inferBotObjective(
    botId: string,
    playerId: string | null | undefined,
    relationship?: ChatRelationshipSummaryView | null,
    fingerprint?: ChatPlayerFingerprintSnapshot | null,
    now?: number,
  ): string;
  buildPersonaInsight(
    botId: string,
    playerId: string | null | undefined,
    now?: number,
    channelId?: string | null,
    fingerprint?: ChatPlayerFingerprintSnapshot | null,
    relationship?: ChatRelationshipSummaryView | null,
    overlay?: ChatLiveOpsOverlayContext | null,
  ): PersonaInsight;
  buildCounterplayHint(
    botId: string,
    playerId: string,
    fingerprint: ChatPlayerFingerprintSnapshot,
    now?: number,
  ): BotCounterplayHint;
  serializeCompact(now?: number): EvolutionServiceCompactSnapshot;
  hydrateFromSnapshot(snapshot: EvolutionServiceCompactSnapshot, now?: number): void;
  flushProjectionCache(): void;
}

// ─── Evolution-aware domain types ─────────────────────────────────────────────

/** Input for a combined NPC plan + persona evolution projection. */
export interface BackendNpcEvolutionRequest {
  readonly planRequests: readonly BackendNpcPlanRequest[];
  readonly room: BackendNpcRoomState;
  readonly ledger: BackendNpcDomainLedger;
  readonly nowMs: number;
  readonly botId: string;
  readonly playerId?: string | null;
  readonly channelId?: string | null;
  readonly fingerprint?: ChatPlayerFingerprintSnapshot | null;
  readonly relationship?: ChatRelationshipSummaryView | null;
  readonly overlay?: ChatLiveOpsOverlayContext | null;
}

/** Combined output of a plan + evolution projection pass. */
export interface BackendNpcEvolutionResult {
  readonly plan: BackendNpcBatchPlan;
  readonly evolutionSignal: ChatPersonaEvolutionSignal;
  readonly personaInsight: PersonaInsight;
  readonly counterplayHint?: BotCounterplayHint;
  readonly inferredObjective: string;
  readonly botAggressionScore: number;
}

/** An NPC plan decision enriched with evolution signal metadata. */
export interface BackendNpcEvolutionEnrichedDecision extends BackendNpcPlanDecision {
  readonly evolutionStage: ChatPersonaStageId;
  readonly evolutionTemperament: string;
  readonly evolutionCallbackAggression: number;
  readonly evolutionTransformBiases: readonly string[];
  readonly evolutionSelectionBias: number;
}

/** Full domain snapshot including evolution state. */
export interface BackendNpcFullDomainSnapshot extends BackendNpcDomainSnapshot {
  readonly evolutionSnapshot: ChatPersonaEvolutionSnapshot;
  readonly evolutionSystemStats: EvolutionSystemStats;
  readonly evolutionTransitionCount: number;
}

/** Planning statistics for a room within a time window. */
export interface BackendNpcPlanningStats {
  readonly roomId: string;
  readonly modeId: string;
  readonly windowMs: number;
  readonly totalPlansRan: number;
  readonly winnersFound: number;
  readonly winnersByKind: Readonly<Record<NpcActorKind, number>>;
  readonly shadowEmissions: number;
  readonly deferredEmissions: number;
  readonly droppedEmissions: number;
  readonly suppressionRate: number;
  readonly computedAtMs: number;
}

/** NPC system health summary. */
export interface BackendNpcSystemHealth {
  readonly registryLinesTotal: number;
  readonly ambientLines: number;
  readonly helperLines: number;
  readonly haterLines: number;
  readonly ambientPersonas: number;
  readonly helperPersonas: number;
  readonly haterPersonas: number;
  readonly evolutionProfilesTotal: number;
  readonly evolutionMythicProfiles: number;
  readonly evolutionRivalricProfiles: number;
  readonly suppressionPolicyReady: boolean;
  readonly cadencePolicyReady: boolean;
  readonly computedAtMs: number;
}

// ─── Evolution-aware domain orchestration ─────────────────────────────────────

/**
 * BackendChatNpcDomainWithEvolution extends the base domain with full
 * persona evolution integration. This is the production authority class for
 * all NPC planning when evolution context is available.
 *
 * Usage pattern:
 *   const domain = new BackendChatNpcDomainWithEvolution();
 *   const result = await domain.planWithEvolution({ planRequests, room, ledger, nowMs, botId, playerId, ... });
 *   applyWinner(result.plan, ledger);
 *   observeEvolutionEvent(domain.evolutionService, winner, room);
 */
export class BackendChatNpcDomainWithEvolution extends BackendChatNpcDomain {
  public readonly evolutionService: IBackendEvolutionService;

  public constructor(input?: {
    readonly ambientRegistry?: AmbientNpcRegistry;
    readonly helperRegistry?: HelperDialogueRegistry;
    readonly haterRegistry?: HaterDialogueRegistry;
    readonly cadencePolicy?: NpcCadencePolicy;
    readonly suppressionPolicy?: NpcSuppressionPolicy;
    readonly evolutionService?: IBackendEvolutionService;
  }) {
    super(input);
    this.evolutionService = input?.evolutionService ?? (createChatBotPersonaEvolutionService() as unknown as IBackendEvolutionService);
  }

  /**
   * Run a full NPC plan pass with persona evolution signal projection.
   * Returns the batch plan AND the evolution signal, enriched persona insight,
   * optional counterplay hint, inferred bot objective, and aggression score.
   */
  public planWithEvolution(request: BackendNpcEvolutionRequest): BackendNpcEvolutionResult {
    const plan = this.planBatch(request.planRequests, request.room, request.ledger);
    const projectionInput: EvolutionProjectionInput = {
      botId: request.botId,
      playerId: request.playerId,
      now: request.nowMs,
      channelId: request.channelId,
      fingerprint: request.fingerprint,
      relationship: request.relationship,
      overlay: request.overlay,
    };
    const evolutionSignal = this.evolutionService.project(projectionInput);
    const personaInsight = this.evolutionService.buildPersonaInsight(
      request.botId,
      request.playerId,
      request.nowMs,
      request.channelId,
      request.fingerprint,
      request.relationship,
      request.overlay,
    );
    const counterplayHint = request.fingerprint
      ? this.evolutionService.buildCounterplayHint(
          request.botId,
          request.playerId ?? request.botId,
          request.fingerprint,
          request.nowMs,
        )
      : undefined;
    const inferredObjective = this.evolutionService.inferBotObjective(
      request.botId,
      request.playerId,
      request.relationship,
      request.fingerprint,
      request.nowMs,
    );
    const botAggressionScore = this.evolutionService.scoreBotAggressionLevel(
      request.botId,
      request.playerId,
      request.nowMs,
    );

    return Object.freeze({
      plan,
      evolutionSignal,
      personaInsight,
      counterplayHint,
      inferredObjective,
      botAggressionScore: Number(botAggressionScore.toFixed(6)),
    });
  }

  /**
   * Enrich a BackendNpcPlanDecision with the current evolution signal metadata.
   */
  public enrichDecisionWithEvolution(
    decision: BackendNpcPlanDecision,
    signal: ChatPersonaEvolutionSignal,
  ): BackendNpcEvolutionEnrichedDecision {
    return Object.freeze({
      ...decision,
      evolutionStage: signal.stage,
      evolutionTemperament: signal.temperament,
      evolutionCallbackAggression: signal.callbackAggression01,
      evolutionTransformBiases: signal.transformBiases,
      evolutionSelectionBias: signal.selectionBias01,
    });
  }

  /**
   * Observe a game event in the evolution service for a given bot+player pair,
   * triggered by a NPC plan winner being applied.
   */
  public observePlanResult(
    winner: BackendNpcPlanDecision | null,
    room: BackendNpcRoomState,
    botId: string,
    playerId: string | null | undefined,
    nowMs: number,
  ): ChatPersonaEvolutionProfile | null {
    if (!winner || !winner.allow) return null;

    let eventType: ChatPersonaEvolutionEvent['eventType'] | null = null;
    const context = winner.context;

    if (context === 'PLAYER_SHIELD_BREAK' || context === 'PLAYER_NEAR_BANKRUPTCY') {
      eventType = 'PLAYER_COLLAPSE';
    } else if (context === 'PLAYER_COMEBACK') {
      eventType = 'PLAYER_COMEBACK';
    } else if (context === 'NEAR_SOVEREIGNTY') {
      eventType = 'PLAYER_PERFECT_DEFENSE';
    } else if (context === 'BOT_WINNING' || context === 'BOT_DEFEATED') {
      eventType = winner.actorKind === 'HATER' ? 'BOT_TAUNT_EMITTED' : 'BOT_RETREAT_EMITTED';
    } else if (context === 'INVASION_OPEN' || context === 'INVASION_CLOSE') {
      eventType = 'LIVEOPS_INTRUSION';
    } else if (winner.actorKind === 'HATER') {
      eventType = 'BOT_TAUNT_EMITTED';
    } else if (winner.suppression.visibility === 'public' && winner.actorKind === 'AMBIENT') {
      eventType = 'PUBLIC_WITNESS';
    } else {
      return null; // Not every emission deserves an evolution event
    }

    if (!eventType) return null;

    const event: ChatPersonaEvolutionEvent = Object.freeze({
      eventId: `evo_${winner.request.requestId}_${nowMs}`,
      botId,
      playerId: playerId ?? null,
      eventType,
      createdAt: nowMs,
      intensity01: clamp01(room.pressure * 0.4 + room.heat * 0.3 + room.confidence * 0.3),
      publicWitness01: winner.suppression.visibility === 'public' ? 0.85 : 0.25,
      pressureBand: room.pressure >= 0.72
        ? 'CRITICAL'
        : room.pressure >= 0.50
          ? 'HIGH'
          : room.pressure >= 0.28
            ? 'MEDIUM'
            : 'LOW',
    });

    return this.evolutionService.observe(event);
  }

  /**
   * Observe a batch of game events in the evolution service.
   */
  public observeEvolutionBatch(input: EvolutionBatchObserveInput): EvolutionBatchObserveResult {
    return this.evolutionService.observeBatch(input);
  }

  /**
   * Project evolution signals for multiple bots in one call.
   */
  public projectEvolutionBatch(inputs: readonly EvolutionProjectionInput[]): EvolutionBatchProjectResult {
    return this.evolutionService.projectBatch(inputs);
  }

  /**
   * Build the full domain snapshot including evolution state.
   */
  public buildFullSnapshot(
    room: BackendNpcRoomState,
    ledger: BackendNpcDomainLedger,
    nowMs: number,
  ): BackendNpcFullDomainSnapshot {
    const base = this.buildSnapshot(room, ledger, nowMs);
    const evolutionSnapshot = this.evolutionService.getSnapshot(nowMs);
    const evolutionSystemStats = this.evolutionService.computeSystemStats(nowMs);
    const evolutionTransitionCount = this.evolutionService.listTransitions().length;
    return Object.freeze({
      ...base,
      evolutionSnapshot,
      evolutionSystemStats,
      evolutionTransitionCount,
    });
  }

  /**
   * Get the current system health summary for this domain instance.
   */
  public buildSystemHealth(nowMs = Date.now()): BackendNpcSystemHealth {
    const ambientSnap = this.ambientRegistry.getSnapshot();
    const helperSnap = this.helperRegistry.getSnapshot();
    const haterSnap = this.haterRegistry.getSnapshot();
    const evolutionStats = this.evolutionService.computeSystemStats(nowMs);
    return Object.freeze({
      registryLinesTotal: ambientSnap.totalLines + helperSnap.totalLines + haterSnap.totalLines,
      ambientLines: ambientSnap.totalLines,
      helperLines: helperSnap.totalLines,
      haterLines: haterSnap.totalLines,
      ambientPersonas: ambientSnap.personas.length,
      helperPersonas: helperSnap.personas.length,
      haterPersonas: haterSnap.personas.length,
      evolutionProfilesTotal: evolutionStats.totalProfiles,
      evolutionMythicProfiles: evolutionStats.stageCounts.MYTHIC,
      evolutionRivalricProfiles: evolutionStats.stageCounts.RIVALRIC,
      suppressionPolicyReady: true,
      cadencePolicyReady: true,
      computedAtMs: nowMs,
    });
  }

  /**
   * Get the persona evolution profile for a bot+player pair.
   */
  public getEvolutionProfile(botId: string, playerId: string | null | undefined, nowMs = Date.now()): ChatPersonaEvolutionProfile {
    return this.evolutionService.getProfile(botId, playerId, nowMs);
  }

  /**
   * Project the evolution signal for a bot+player pair.
   */
  public projectEvolution(input: EvolutionProjectionInput): ChatPersonaEvolutionSignal {
    return this.evolutionService.project(input);
  }

  /**
   * Get the evolution stage for a bot+player pair.
   */
  public getEvolutionStage(botId: string, playerId: string | null | undefined, nowMs = Date.now()): ChatPersonaStageId {
    return this.evolutionService.getProfile(botId, playerId, nowMs).stage;
  }

  /**
   * Check whether a bot+player pair has reached a given stage.
   */
  public hasEvolutionStage(botId: string, playerId: string | null | undefined, targetStage: ChatPersonaStageId, nowMs = Date.now()): boolean {
    return this.evolutionService.hasReachedStage(botId, playerId, targetStage, nowMs);
  }

  /**
   * Get all stage transitions recorded for a bot.
   */
  public getEvolutionTransitions(botId: string): readonly EvolutionStageTransitionRecord[] {
    return this.evolutionService.getTransitionHistoryForBot(botId);
  }

  /**
   * Get bot evolution stats across all its profiles.
   */
  public getBotEvolutionStats(botId: string, nowMs = Date.now()): BotEvolutionStats {
    return this.evolutionService.computeBotStats(botId, nowMs);
  }

  /**
   * Build a human-readable persona insight for a bot+player pair.
   */
  public buildEvolutionInsight(
    botId: string,
    playerId: string | null | undefined,
    nowMs = Date.now(),
    channelId?: string | null,
    fingerprint?: ChatPlayerFingerprintSnapshot | null,
    relationship?: ChatRelationshipSummaryView | null,
    overlay?: ChatLiveOpsOverlayContext | null,
  ): PersonaInsight {
    return this.evolutionService.buildPersonaInsight(botId, playerId, nowMs, channelId, fingerprint, relationship, overlay);
  }

  /**
   * Produce a compact serializable snapshot of the evolution service state.
   */
  public serializeEvolutionCompact(nowMs = Date.now()): EvolutionServiceCompactSnapshot {
    return this.evolutionService.serializeCompact(nowMs);
  }

  /**
   * Hydrate the evolution service from a previously persisted snapshot.
   */
  public hydrateEvolution(snapshot: EvolutionServiceCompactSnapshot, nowMs = Date.now()): void {
    this.evolutionService.hydrateFromSnapshot(snapshot, nowMs);
  }

  /**
   * Flush the projection cache.
   */
  public flushEvolutionCache(): void {
    this.evolutionService.flushProjectionCache();
  }
}

// ─── Domain-level standalone utilities ────────────────────────────────────────

/**
 * Build a narrative summary for an evolution-enriched plan decision.
 */
export function narrativeSummaryForEnrichedDecision(decision: BackendNpcEvolutionEnrichedDecision): string {
  const kind = decision.actorKind;
  const persona = decision.personaId ?? 'INVASION';
  const context = decision.context;
  const visibility = decision.suppression.visibility;
  const stage = decision.evolutionStage;
  const temperament = decision.evolutionTemperament;
  const agg = decision.evolutionCallbackAggression.toFixed(3);
  return `${kind}:${persona} [${stage}/${temperament}] ctx=${context} vis=${visibility} cbAgg=${agg}`;
}

/**
 * Convert a BackendNpcPlanDecision into a terse one-line log string.
 */
export function formatPlanDecisionForLog(decision: BackendNpcPlanDecision): string {
  const allowed = decision.allow ? 'ALLOW' : 'DENY';
  const persona = decision.personaId ?? (decision.actorKind === 'INVASION' ? 'INVASION' : 'unknown');
  const text = decision.text
    ? ` text="${decision.text.slice(0, 40)}${decision.text.length > 40 ? '...' : ''}"`
    : '';
  return (
    `[${allowed}] ${decision.actorKind}:${persona} channel=${decision.channel}` +
    ` ctx=${decision.context} vis=${decision.suppression.visibility}` +
    ` score=${decision.suppression.priorityScore.toFixed(3)}${text}`
  );
}

/**
 * Build a planning statistics summary from a series of batch plans.
 */
export function buildPlanningStats(
  roomId: string,
  modeId: string,
  plans: readonly BackendNpcBatchPlan[],
  nowMs: number,
  windowMs = 300_000,
): BackendNpcPlanningStats {
  const winnersByKind: Record<NpcActorKind, number> = { AMBIENT: 0, HELPER: 0, HATER: 0, INVASION: 0 };
  let totalPlans = 0;
  let winnersFound = 0;
  let shadowEmissions = 0;
  let deferredEmissions = 0;
  let droppedEmissions = 0;

  for (const plan of plans) {
    totalPlans += 1;
    if (plan.winner) {
      winnersFound += 1;
      winnersByKind[plan.winner.actorKind] = (winnersByKind[plan.winner.actorKind] ?? 0) + 1;
    }
    shadowEmissions += plan.shadowed.length;
    deferredEmissions += plan.deferred.length;
    droppedEmissions += plan.rejected.length;
  }

  const totalDecisions = plans.reduce((sum, p) => sum + p.ranked.length, 0);
  const suppressionRate = totalDecisions > 0
    ? Number(((totalDecisions - winnersFound) / totalDecisions).toFixed(4))
    : 0;

  return Object.freeze({
    roomId,
    modeId,
    windowMs,
    totalPlansRan: totalPlans,
    winnersFound,
    winnersByKind: Object.freeze(winnersByKind),
    shadowEmissions,
    deferredEmissions,
    droppedEmissions,
    suppressionRate,
    computedAtMs: nowMs,
  });
}

/**
 * Check whether a BackendNpcBatchPlan has a winner that should trigger an evolution event.
 */
export function planHasEvolutionTrigger(plan: BackendNpcBatchPlan): boolean {
  const winner = plan.winner;
  if (!winner) return false;
  return (
    winner.actorKind === 'HATER' ||
    winner.context === 'PLAYER_SHIELD_BREAK' ||
    winner.context === 'PLAYER_NEAR_BANKRUPTCY' ||
    winner.context === 'PLAYER_COMEBACK' ||
    winner.context === 'NEAR_SOVEREIGNTY' ||
    winner.context === 'INVASION_OPEN' ||
    winner.context === 'POSTRUN_DEBRIEF'
  );
}

/**
 * Build the default BackendNpcRoomState from minimal parameters.
 * Useful for test setup and cold-start replay.
 */
export function buildMinimalRoomState(
  roomId: string,
  modeId: string,
  nowMs: number,
  overrides?: Partial<BackendNpcRoomState>,
): BackendNpcRoomState {
  return Object.freeze({
    roomId,
    modeId,
    runTick: 0,
    occupancy: 1,
    heat: 0.25,
    pressure: 0.20,
    frustration: 0.15,
    confidence: 0.50,
    coldStart: 0.80,
    silenceDebt: 0.30,
    invasionActive: false,
    helperLock: false,
    playerNearBankruptcy: false,
    shieldBreached: false,
    nearSovereignty: false,
    dealStalled: false,
    postRun: false,
    lastPlayerMessageAtMs: nowMs - 5_000,
    lastIncomingSystemEventAtMs: nowMs - 3_000,
    ...overrides,
  });
}

/**
 * Build a BackendNpcPlanRequest for a single rapid-fire NPC emission.
 * A convenience factory for callers that don't need full control.
 */
export function buildSimplePlanRequest(
  actorKind: NpcActorKind,
  channel: BackendNpcChannel,
  context: CadenceContext,
  nowMs: number,
  roomId: string,
  options?: {
    readonly personaId?: BackendNpcPersonaId;
    readonly priorityHint?: number;
    readonly force?: boolean;
    readonly allowShadow?: boolean;
    readonly witnessPreferred?: boolean;
    readonly tagHints?: readonly string[];
  },
): BackendNpcPlanRequest {
  const requestId = `npc_${actorKind.toLowerCase()}_${roomId}_${nowMs}_${Math.floor(Math.random() * 0xffff).toString(16)}`;
  const base = {
    requestId,
    channel,
    context,
    desiredAtMs: nowMs,
    createdAtMs: nowMs,
    priorityHint: options?.priorityHint ?? 0.5,
    force: options?.force,
    allowShadow: options?.allowShadow,
    witnessPreferred: options?.witnessPreferred,
    tagHints: options?.tagHints,
  };
  if (actorKind === 'AMBIENT') {
    return Object.freeze({ ...base, actorKind: 'AMBIENT', personaId: options?.personaId as AmbientNpcPersonaId | undefined } as unknown as BackendAmbientPlanRequest);
  }
  if (actorKind === 'HELPER') {
    return Object.freeze({ ...base, actorKind: 'HELPER', personaId: options?.personaId as HelperPersonaId | undefined } as unknown as BackendHelperPlanRequest);
  }
  if (actorKind === 'HATER') {
    return Object.freeze({ ...base, actorKind: 'HATER', personaId: options?.personaId as HaterRegistryPersonaId | undefined } as unknown as BackendHaterPlanRequest);
  }
  return Object.freeze({ ...base, actorKind: 'INVASION', context: context as 'INVASION_OPEN' | 'INVASION_CLOSE' } as unknown as BackendInvasionPlanRequest);
}

/**
 * Determine if a room state justifies an immediate helper intervention.
 */
export function shouldTriggerHelperIntervention(room: BackendNpcRoomState): boolean {
  if (room.helperLock) return false;
  if (room.invasionActive) return false;
  if (room.postRun) return true; // post-run debrief is a helper mandate
  if (room.playerNearBankruptcy) return true;
  if (room.shieldBreached) return true;
  if (room.frustration >= 0.70) return true;
  if (room.coldStart >= 0.80 && room.runTick <= 10) return true;
  return false;
}

/**
 * Determine if a room state justifies an immediate hater emission.
 */
export function shouldTriggerHaterEmission(room: BackendNpcRoomState): boolean {
  if (room.postRun) return false;
  if (room.helperLock) return false;
  if (room.pressure >= 0.65 && room.heat >= 0.50) return true;
  if (room.nearSovereignty) return true;
  if (room.invasionActive) return true;
  return false;
}

/**
 * Determine whether a room state mandates an ambient witness emission.
 */
export function shouldTriggerAmbientWitness(room: BackendNpcRoomState, silenceGapMs: number): boolean {
  if (room.invasionActive) return false;
  if (room.shieldBreached) return true;
  if (room.nearSovereignty) return true;
  if (room.postRun) return true;
  if (room.silenceDebt >= 0.70) return true;
  if (silenceGapMs >= 45_000 && room.occupancy >= 3) return true;
  return false;
}

/**
 * Build the optimal plan request set for a given room state from scratch.
 * This is a high-level convenience for planners that want intelligent defaults.
 */
export function buildAutoPlanRequests(
  room: BackendNpcRoomState,
  nowMs: number,
  silenceGapMs = 20_000,
): readonly BackendNpcPlanRequest[] {
  const domain = backendChatNpcDomain;
  const requests: BackendNpcPlanRequest[] = [];

  if (room.invasionActive) {
    requests.push(...domain.planInvasionScene(room, nowMs));
    return Object.freeze(requests);
  }

  if (room.postRun) {
    requests.push(...domain.planPostRunScene(room, nowMs));
    return Object.freeze(requests);
  }

  if (room.playerNearBankruptcy || room.shieldBreached) {
    requests.push(...domain.planCollapseWitness(room, nowMs));
  }

  if ((room.recentComebackCount ?? 0) > 0 || room.confidence >= 0.60) {
    requests.push(...domain.planComebackWitness(room, nowMs));
  }

  if (room.modeId.toLowerCase().includes('deal')) {
    requests.push(...domain.planDealRoomScene(room, nowMs));
  } else if (room.modeId.toLowerCase().includes('syndicate')) {
    requests.push(...domain.planSyndicateScene(room, nowMs));
  }

  if (shouldTriggerAmbientWitness(room, silenceGapMs)) {
    const channel: BackendNpcChannel = room.modeId.toLowerCase().includes('lobby') ? 'LOBBY' : 'GLOBAL';
    const ctx: CadenceContext = room.nearSovereignty ? 'NEAR_SOVEREIGNTY' : room.shieldBreached ? 'PLAYER_SHIELD_BREAK' : 'PLAYER_IDLE';
    requests.push(buildSimplePlanRequest('AMBIENT', channel, ctx, nowMs, room.roomId, { priorityHint: 0.7, allowShadow: true }));
  }

  if (shouldTriggerHelperIntervention(room)) {
    const ctx: CadenceContext = room.postRun ? 'POSTRUN_DEBRIEF' : room.playerNearBankruptcy ? 'PLAYER_NEAR_BANKRUPTCY' : 'PLAYER_IDLE';
    requests.push(buildSimplePlanRequest('HELPER', 'GLOBAL', ctx, nowMs, room.roomId, { priorityHint: 1.0, witnessPreferred: room.playerNearBankruptcy }));
  }

  if (shouldTriggerHaterEmission(room)) {
    const ctx: CadenceContext = room.nearSovereignty ? 'NEAR_SOVEREIGNTY' : room.pressure >= 0.65 ? 'BOT_WINNING' : 'PLAYER_IDLE';
    requests.push(buildSimplePlanRequest('HATER', 'GLOBAL', ctx, nowMs, room.roomId, { priorityHint: 0.9 }));
  }

  return Object.freeze(requests);
}

// ─── NAMESPACE export ──────────────────────────────────────────────────────────

export const BackendChatNpcDomainNS = Object.freeze({
  // Internal helpers
  clamp01,
  stableHash,
  inferAmbientChannel,
  isAmbientContext,
  isHelperContext,
  isHaterContext,
  actorIdOf,
  mapToSuppressionRequest,
  mapToCadenceRequest,
  decisionFromCandidate,
  boostRegistryScore,

  // Standalone utilities
  narrativeSummaryForEnrichedDecision,
  formatPlanDecisionForLog,
  buildPlanningStats,
  planHasEvolutionTrigger,
  buildMinimalRoomState,
  buildSimplePlanRequest,
  shouldTriggerHelperIntervention,
  shouldTriggerHaterEmission,
  shouldTriggerAmbientWitness,
  buildAutoPlanRequests,

  // Registries
  ambientNpcRegistry,
  helperDialogueRegistry,
  haterDialogueRegistry,
  AmbientNpcRegistry,
  HelperDialogueRegistry,
  HaterDialogueRegistry,
  createAmbientNpcRegistry,
  createHelperDialogueRegistry,
  createHaterDialogueRegistry,

  // Cadence and suppression
  npcCadencePolicy,
  npcSuppressionPolicy,
  NpcCadencePolicy,
  NpcSuppressionPolicy,
  createNpcCadencePolicy,
  createNpcSuppressionPolicy,

  // Evolution
  ChatBotPersonaEvolutionService,
  createChatBotPersonaEvolutionService,

  // Domain classes and singletons
  BackendChatNpcDomain,
  BackendChatNpcDomainWithEvolution,
  backendChatNpcDomain,
  createBackendChatNpcDomain,
});

// ─── Extended singleton with evolution ────────────────────────────────────────

export const createBackendChatNpcDomainWithEvolution = (): BackendChatNpcDomainWithEvolution =>
  new BackendChatNpcDomainWithEvolution({
    ambientRegistry: createAmbientNpcRegistry(),
    helperRegistry: createHelperDialogueRegistry(),
    haterRegistry: createHaterDialogueRegistry(),
    cadencePolicy: createNpcCadencePolicy(),
    suppressionPolicy: createNpcSuppressionPolicy(),
    evolutionService: createChatBotPersonaEvolutionService() as unknown as IBackendEvolutionService,
  });

export const backendChatNpcDomainWithEvolution = new BackendChatNpcDomainWithEvolution();
