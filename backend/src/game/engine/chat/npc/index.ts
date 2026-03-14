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

export * from './AmbientNpcRegistry';
export * from './HaterDialogueRegistry';
export * from './HelperDialogueRegistry';
export * from './NpcCadencePolicy';
export * from './NpcSuppressionPolicy';

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
