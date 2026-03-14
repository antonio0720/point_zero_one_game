/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT NPC SUPPRESSION POLICY
 * FILE: backend/src/game/engine/chat/npc/NpcSuppressionPolicy.ts
 * ============================================================================
 *
 * Doctrine
 * --------
 * - suppression is not censorship glue; it is backend authorship law
 * - cadence answers "when may an NPC speak"; suppression answers "should this NPC be allowed to exist at all"
 * - the backend must preserve channel identity, rescue windows, intimidation credibility, and witness integrity
 * - frontend may preview a likely line, but backend owns final silence, shadowing, deferral, reroute, and rejection
 * - a room that never suppresses is noisy; a room that suppresses correctly feels authored, observant, and dangerous
 *
 * Strategic Purpose
 * -----------------
 * 1. keep helpers from diluting hard moments with spam comfort
 * 2. keep haters from firing too generically when the room needs precision
 * 3. keep ambient from becoming filler when the room is too hot, too empty, or too intimate
 * 4. protect deal-room restraint and syndicate confidentiality
 * 5. enforce witness laws so collapse and comeback moments feel seen by the right voice
 * 6. preserve shadow-only states so the world can remember more than it currently reveals
 * 7. create an audit-friendly suppression plane suitable for proof chains, replay, and live balancing
 */

import type {
  AmbientChannelAffinity,
  AmbientNpcContext,
  AmbientNpcPersonaId,
} from './AmbientNpcRegistry';
import { ambientNpcRegistry } from './AmbientNpcRegistry';
import type {
  HaterDialogueContext,
  HaterRegistryPersonaId,
} from './HaterDialogueRegistry';
import { haterDialogueRegistry } from './HaterDialogueRegistry';
import type {
  HelperDialogueContext,
  HelperPersonaId,
} from './HelperDialogueRegistry';
import { helperDialogueRegistry } from './HelperDialogueRegistry';
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
import { npcCadencePolicy } from './NpcCadencePolicy';

export type NpcSuppressionReason =
  | 'NONE'
  | 'CHANNEL_DISABLED'
  | 'CHANNEL_POLICY_MISMATCH'
  | 'MODE_POLICY_MISMATCH'
  | 'SCENE_POLICY_MISMATCH'
  | 'ROOM_TOO_EMPTY'
  | 'ROOM_TOO_HOT'
  | 'ROOM_TOO_PRIVATE'
  | 'AMBIENT_DISALLOWED'
  | 'AMBIENT_NEEDS_OCCUPANCY'
  | 'AMBIENT_TOO_MUCH_HEAT'
  | 'AMBIENT_TOO_MUCH_PRESSURE'
  | 'AMBIENT_TOO_MUCH_FRUSTRATION'
  | 'HELPER_LOCK_ACTIVE'
  | 'HELPER_NOT_NEEDED'
  | 'HELPER_TOO_EARLY'
  | 'HELPER_TOO_LATE'
  | 'HELPER_DUPLICATE_AXIS'
  | 'HELPER_WINDOW_RESERVED'
  | 'HATER_NOT_EARNED'
  | 'HATER_TOO_NOISY'
  | 'HATER_NEEDS_TARGET_SIGNAL'
  | 'HATER_WINDOW_RESERVED'
  | 'HATER_CONTEXT_ILLEGAL'
  | 'WITNESS_REQUIRED_BY_OTHER_KIND'
  | 'COLLAPSE_REQUIRES_WITNESS'
  | 'COMEBACK_REQUIRES_WITNESS'
  | 'SOVEREIGNTY_REQUIRES_WITNESS'
  | 'DEAL_ROOM_RESTRAINT'
  | 'SYNDICATE_RESTRAINT'
  | 'LOBBY_RESTRAINT'
  | 'POSTRUN_RESTRAINT'
  | 'INVASION_LOCK'
  | 'PRIORITY_PREEMPTED'
  | 'SHADOW_ONLY'
  | 'SHADOW_ONLY_AND_DEFER'
  | 'MODERATION_QUARANTINE'
  | 'SESSION_MUTED'
  | 'RECENT_DUPLICATE'
  | 'REPETITION_OVERHEAT'
  | 'PROOF_PROTECTION'
  | 'RECOVERY_PROTECTION'
  | 'MANUAL_DISABLE'
  | 'UNKNOWN_PERSONA'
  | 'UNKNOWN_KIND'
;

export type NpcSuppressionVisibility = 'public' | 'shadow' | 'deferred' | 'dropped';

export type NpcSuppressionActorId = AmbientNpcPersonaId | HelperPersonaId | HaterRegistryPersonaId;

export interface NpcSuppressionRequest {
  readonly requestId: string;
  readonly actorKind: NpcActorKind;
  readonly actorId: string;
  readonly personaId?: NpcSuppressionActorId;
  readonly channel: CadenceChannel;
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

export interface NpcSuppressionRoomState {
  readonly roomId: string;
  readonly modeId: string;
  readonly runTick: number;
  readonly occupancy: number;
  readonly heat: number;
  readonly pressure: number;
  readonly frustration: number;
  readonly confidence: number;
  readonly coldStart: number;
  readonly silenceDebt: number;
  readonly invasionActive: boolean;
  readonly helperLock: boolean;
  readonly playerNearBankruptcy: boolean;
  readonly shieldBreached: boolean;
  readonly nearSovereignty: boolean;
  readonly dealStalled: boolean;
  readonly postRun: boolean;
  readonly lastPlayerMessageAtMs?: number;
  readonly lastIncomingSystemEventAtMs?: number;
  readonly channelOccupancy?: Readonly<Partial<Record<CadenceChannel, number>>>;
  readonly recentByKind?: Readonly<Partial<Record<NpcActorKind, number>>>;
  readonly openDealCount?: number;
  readonly unresolvedThreatCount?: number;
  readonly recentCollapseCount?: number;
  readonly recentComebackCount?: number;
  readonly recentSuppressionByKind?: Readonly<Partial<Record<NpcActorKind, number>>>;
}

export interface NpcSuppressionHistoryRecord {
  readonly requestId: string;
  readonly actorKey: string;
  readonly actorKind: NpcActorKind;
  readonly channel: CadenceChannel;
  readonly context: CadenceContext;
  readonly reason: NpcSuppressionReason;
  readonly visibility: NpcSuppressionVisibility;
  readonly createdAtMs: number;
  readonly sceneState: CadenceSceneState;
  readonly witnessRequired: boolean;
  readonly priorityScore: number;
}

export interface NpcSuppressionLedger {
  readonly lastAllowedAtByActor: Readonly<Record<string, number>>;
  readonly lastSuppressedAtByActor: Readonly<Record<string, number>>;
  readonly suppressionCountsByActor: Readonly<Record<string, number>>;
  readonly suppressionCountsByReason: Readonly<Record<NpcSuppressionReason, number>>;
  readonly recentHistory: readonly NpcSuppressionHistoryRecord[];
  readonly lastWitnessAtByChannel: Readonly<Partial<Record<CadenceChannel, number>>>;
  readonly lastHelperAxisAtByChannel: Readonly<Record<string, number>>;
}

export interface NpcSuppressionDecision {
  readonly allow: boolean;
  readonly actorKey: string;
  readonly actorKind: NpcActorKind;
  readonly personaId?: NpcSuppressionActorId;
  readonly channel: CadenceChannel;
  readonly context: CadenceContext;
  readonly sceneState: CadenceSceneState;
  readonly reason: NpcSuppressionReason;
  readonly visibility: NpcSuppressionVisibility;
  readonly shadowOnly: boolean;
  readonly witnessRequired: boolean;
  readonly suppressUntilMs: number;
  readonly priorityScore: number;
  readonly deferMs: number;
  readonly channelBudget: number;
  readonly diagnostics: readonly string[];
  readonly cadence?: NpcCadenceDecision;
}

export interface RankedSuppressionDecision {
  readonly request: NpcSuppressionRequest;
  readonly decision: NpcSuppressionDecision;
}

export interface NpcSuppressionBatchResult {
  readonly ranked: readonly RankedSuppressionDecision[];
  readonly winner: RankedSuppressionDecision | null;
  readonly dropped: readonly RankedSuppressionDecision[];
  readonly deferred: readonly RankedSuppressionDecision[];
  readonly shadowed: readonly RankedSuppressionDecision[];
}

interface ChannelSuppressionProfile {
  readonly enabled: boolean;
  readonly occupancyFloor: number;
  readonly ambientAllowed: boolean;
  readonly helperAllowed: boolean;
  readonly haterAllowed: boolean;
  readonly prefersSilence: boolean;
  readonly heatCapForAmbient: number;
  readonly pressureCapForAmbient: number;
  readonly privateRoomBias: number;
  readonly witnessGapMs: number;
}

interface ModeSuppressionProfile {
  readonly id: string;
  readonly ambientScale: number;
  readonly helperScale: number;
  readonly haterScale: number;
  readonly dealRestraint: boolean;
  readonly syndicateRestraint: boolean;
  readonly lobbyLenience: boolean;
  readonly postRunNarrativeBias: number;
}

interface ActorSuppressionProfile {
  readonly actorKind: NpcActorKind;
  readonly minimumPressure: number;
  readonly maximumAmbientPressure: number;
  readonly minimumOccupancy: number;
  readonly repeatGapMs: number;
  readonly shadowBias: number;
  readonly witnessBias: number;
}

interface SceneSuppressionProfile {
  readonly sceneState: CadenceSceneState;
  readonly ambientAllowed: boolean;
  readonly helperBias: number;
  readonly haterBias: number;
  readonly silenceBias: number;
  readonly witnessRequiredForCollapse: boolean;
  readonly witnessRequiredForComeback: boolean;
}

interface ContextWitnessRule {
  readonly context: CadenceContext;
  readonly preferredKind: NpcActorKind;
  readonly witnessRequired: boolean;
  readonly publicPreferred: boolean;
  readonly suppressOtherKindsForMs: number;
}

const clamp01 = (value: number | undefined): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
};

const clampNonNegative = (value: number | undefined): number => {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) return 0;
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

const freezeRecord = <T extends Record<string, unknown>>(value: T): Readonly<T> => Object.freeze(value);

const actorKeyOf = (request: Pick<NpcSuppressionRequest, 'actorKind' | 'actorId' | 'personaId'>): string => {
  return `${request.actorKind}:${request.personaId ?? request.actorId}`;
};

const inferSceneState = (room: NpcSuppressionRoomState): CadenceSceneState => {
  if (room.invasionActive) return 'INVASION';
  if (room.postRun) return 'POSTRUN';
  if (room.dealStalled || room.modeId.toLowerCase().includes('deal')) return 'NEGOTIATION';
  if (room.runTick <= 25 || room.modeId.toLowerCase().includes('lobby')) return room.occupancy > 0 ? 'QUEUE' : 'OPENING';
  if (room.nearSovereignty) return 'ENDGAME';
  if (room.shieldBreached || room.playerNearBankruptcy) return 'BREACH';
  if (room.frustration >= 0.55 || room.pressure >= 0.72) return 'PRESSURE';
  if (room.confidence >= 0.55 && room.pressure <= 0.45) return 'RECOVERY';
  return 'MIDRUN';
};

const determineModeProfile = (modeId: string | undefined): ModeSuppressionProfile => {
  const normalized = (modeId ?? '').toLowerCase();
  if (normalized.includes('deal')) {
    return Object.freeze({
      id: 'deal',
      ambientScale: 0.55,
      helperScale: 0.85,
      haterScale: 1.15,
      dealRestraint: true,
      syndicateRestraint: false,
      lobbyLenience: false,
      postRunNarrativeBias: 0.7,
    });
  }

  if (normalized.includes('syndicate')) {
    return Object.freeze({
      id: 'syndicate',
      ambientScale: 0.6,
      helperScale: 0.8,
      haterScale: 0.95,
      dealRestraint: false,
      syndicateRestraint: true,
      lobbyLenience: false,
      postRunNarrativeBias: 0.8,
    });
  }

  if (normalized.includes('lobby')) {
    return Object.freeze({
      id: 'lobby',
      ambientScale: 1.15,
      helperScale: 0.55,
      haterScale: 0.75,
      dealRestraint: false,
      syndicateRestraint: false,
      lobbyLenience: true,
      postRunNarrativeBias: 0.3,
    });
  }

  if (normalized.includes('battle') || normalized.includes('run')) {
    return Object.freeze({
      id: 'run',
      ambientScale: 0.85,
      helperScale: 1,
      haterScale: 1.05,
      dealRestraint: false,
      syndicateRestraint: false,
      lobbyLenience: false,
      postRunNarrativeBias: 1,
    });
  }

  return Object.freeze({
    id: 'default',
    ambientScale: 0.9,
    helperScale: 0.9,
    haterScale: 0.9,
    dealRestraint: false,
    syndicateRestraint: false,
    lobbyLenience: false,
    postRunNarrativeBias: 0.75,
  });
};

const CHANNEL_PROFILES = freezeRecord<Record<CadenceChannel, ChannelSuppressionProfile>>({
  GLOBAL: Object.freeze({
    enabled: true,
    occupancyFloor: 3,
    ambientAllowed: true,
    helperAllowed: true,
    haterAllowed: true,
    prefersSilence: false,
    heatCapForAmbient: 0.82,
    pressureCapForAmbient: 0.75,
    privateRoomBias: 0,
    witnessGapMs: 6_500,
  }),
  SYNDICATE: Object.freeze({
    enabled: true,
    occupancyFloor: 2,
    ambientAllowed: true,
    helperAllowed: true,
    haterAllowed: true,
    prefersSilence: true,
    heatCapForAmbient: 0.58,
    pressureCapForAmbient: 0.62,
    privateRoomBias: 0.85,
    witnessGapMs: 8_500,
  }),
  DEAL_ROOM: Object.freeze({
    enabled: true,
    occupancyFloor: 2,
    ambientAllowed: false,
    helperAllowed: true,
    haterAllowed: true,
    prefersSilence: true,
    heatCapForAmbient: 0.35,
    pressureCapForAmbient: 0.4,
    privateRoomBias: 1,
    witnessGapMs: 9_500,
  }),
  LOBBY: Object.freeze({
    enabled: true,
    occupancyFloor: 1,
    ambientAllowed: true,
    helperAllowed: false,
    haterAllowed: true,
    prefersSilence: false,
    heatCapForAmbient: 0.9,
    pressureCapForAmbient: 0.55,
    privateRoomBias: 0.15,
    witnessGapMs: 5_000,
  }),
  SYSTEM_SHADOW: Object.freeze({
    enabled: true,
    occupancyFloor: 0,
    ambientAllowed: false,
    helperAllowed: true,
    haterAllowed: true,
    prefersSilence: true,
    heatCapForAmbient: 0,
    pressureCapForAmbient: 0,
    privateRoomBias: 1,
    witnessGapMs: 4_000,
  }),
  NPC_SHADOW: Object.freeze({
    enabled: true,
    occupancyFloor: 0,
    ambientAllowed: true,
    helperAllowed: true,
    haterAllowed: true,
    prefersSilence: true,
    heatCapForAmbient: 1,
    pressureCapForAmbient: 1,
    privateRoomBias: 1,
    witnessGapMs: 3_500,
  }),
});

const ACTOR_PROFILES = freezeRecord<Record<NpcActorKind, ActorSuppressionProfile>>({
  AMBIENT: Object.freeze({
    actorKind: 'AMBIENT',
    minimumPressure: 0,
    maximumAmbientPressure: 0.72,
    minimumOccupancy: 2,
    repeatGapMs: 18_000,
    shadowBias: 0.35,
    witnessBias: 0.4,
  }),
  HELPER: Object.freeze({
    actorKind: 'HELPER',
    minimumPressure: 0.12,
    maximumAmbientPressure: 1,
    minimumOccupancy: 1,
    repeatGapMs: 14_000,
    shadowBias: 0.15,
    witnessBias: 0.85,
  }),
  HATER: Object.freeze({
    actorKind: 'HATER',
    minimumPressure: 0.2,
    maximumAmbientPressure: 1,
    minimumOccupancy: 1,
    repeatGapMs: 12_000,
    shadowBias: 0.28,
    witnessBias: 0.75,
  }),
  INVASION: Object.freeze({
    actorKind: 'INVASION',
    minimumPressure: 0,
    maximumAmbientPressure: 1,
    minimumOccupancy: 0,
    repeatGapMs: 10_000,
    shadowBias: 0,
    witnessBias: 1,
  }),
});

const SCENE_PROFILES = freezeRecord<Record<CadenceSceneState, SceneSuppressionProfile>>({
  OPENING: Object.freeze({
    sceneState: 'OPENING',
    ambientAllowed: true,
    helperBias: 0.35,
    haterBias: 0.55,
    silenceBias: 0.1,
    witnessRequiredForCollapse: false,
    witnessRequiredForComeback: false,
  }),
  QUEUE: Object.freeze({
    sceneState: 'QUEUE',
    ambientAllowed: true,
    helperBias: 0.2,
    haterBias: 0.45,
    silenceBias: 0.2,
    witnessRequiredForCollapse: false,
    witnessRequiredForComeback: false,
  }),
  NEGOTIATION: Object.freeze({
    sceneState: 'NEGOTIATION',
    ambientAllowed: false,
    helperBias: 0.55,
    haterBias: 0.8,
    silenceBias: 0.9,
    witnessRequiredForCollapse: false,
    witnessRequiredForComeback: false,
  }),
  MIDRUN: Object.freeze({
    sceneState: 'MIDRUN',
    ambientAllowed: true,
    helperBias: 0.6,
    haterBias: 0.6,
    silenceBias: 0.25,
    witnessRequiredForCollapse: false,
    witnessRequiredForComeback: false,
  }),
  PRESSURE: Object.freeze({
    sceneState: 'PRESSURE',
    ambientAllowed: true,
    helperBias: 0.9,
    haterBias: 0.9,
    silenceBias: 0.45,
    witnessRequiredForCollapse: true,
    witnessRequiredForComeback: false,
  }),
  BREACH: Object.freeze({
    sceneState: 'BREACH',
    ambientAllowed: false,
    helperBias: 1,
    haterBias: 1,
    silenceBias: 0.55,
    witnessRequiredForCollapse: true,
    witnessRequiredForComeback: false,
  }),
  RECOVERY: Object.freeze({
    sceneState: 'RECOVERY',
    ambientAllowed: true,
    helperBias: 0.75,
    haterBias: 0.45,
    silenceBias: 0.2,
    witnessRequiredForCollapse: false,
    witnessRequiredForComeback: true,
  }),
  ENDGAME: Object.freeze({
    sceneState: 'ENDGAME',
    ambientAllowed: false,
    helperBias: 0.95,
    haterBias: 0.95,
    silenceBias: 0.4,
    witnessRequiredForCollapse: true,
    witnessRequiredForComeback: true,
  }),
  POSTRUN: Object.freeze({
    sceneState: 'POSTRUN',
    ambientAllowed: true,
    helperBias: 0.8,
    haterBias: 0.35,
    silenceBias: 0.35,
    witnessRequiredForCollapse: false,
    witnessRequiredForComeback: false,
  }),
  INVASION: Object.freeze({
    sceneState: 'INVASION',
    ambientAllowed: false,
    helperBias: 0.65,
    haterBias: 1,
    silenceBias: 0.3,
    witnessRequiredForCollapse: true,
    witnessRequiredForComeback: true,
  }),
});

const WITNESS_RULES = Object.freeze<readonly ContextWitnessRule[]>([
  Object.freeze({ context: 'PLAYER_NEAR_BANKRUPTCY', preferredKind: 'HELPER', witnessRequired: true, publicPreferred: true, suppressOtherKindsForMs: 7_500 }),
  Object.freeze({ context: 'PLAYER_SHIELD_BREAK', preferredKind: 'HATER', witnessRequired: true, publicPreferred: true, suppressOtherKindsForMs: 7_500 }),
  Object.freeze({ context: 'PLAYER_COMEBACK', preferredKind: 'AMBIENT', witnessRequired: true, publicPreferred: true, suppressOtherKindsForMs: 5_500 }),
  Object.freeze({ context: 'NEAR_SOVEREIGNTY', preferredKind: 'AMBIENT', witnessRequired: true, publicPreferred: true, suppressOtherKindsForMs: 9_000 }),
  Object.freeze({ context: 'PLAYER_LOST', preferredKind: 'HELPER', witnessRequired: true, publicPreferred: true, suppressOtherKindsForMs: 8_500 }),
  Object.freeze({ context: 'DEAL_ROOM_STALL', preferredKind: 'HATER', witnessRequired: false, publicPreferred: false, suppressOtherKindsForMs: 4_000 }),
  Object.freeze({ context: 'DEAL_ROOM_OFFER', preferredKind: 'HATER', witnessRequired: false, publicPreferred: false, suppressOtherKindsForMs: 3_500 }),
  Object.freeze({ context: 'INVASION_OPEN', preferredKind: 'INVASION', witnessRequired: true, publicPreferred: true, suppressOtherKindsForMs: 10_000 }),
  Object.freeze({ context: 'INVASION_CLOSE', preferredKind: 'INVASION', witnessRequired: false, publicPreferred: true, suppressOtherKindsForMs: 4_500 }),
  Object.freeze({ context: 'POSTRUN_MOURN', preferredKind: 'HELPER', witnessRequired: false, publicPreferred: true, suppressOtherKindsForMs: 4_500 }),
  Object.freeze({ context: 'POSTRUN_CELEBRATE', preferredKind: 'AMBIENT', witnessRequired: false, publicPreferred: true, suppressOtherKindsForMs: 4_500 }),
]);

const HELPER_AXES_BY_ID = freezeRecord<Record<HelperPersonaId, string>>({
  MENTOR: 'grounding',
  INSIDER: 'mechanics',
  SURVIVOR: 'resilience',
  RIVAL: 'competitive_motivation',
  ARCHIVIST: 'memory',
});

const trimHistory = (history: readonly NpcSuppressionHistoryRecord[], nowMs: number): readonly NpcSuppressionHistoryRecord[] => {
  const threshold = nowMs - 90_000;
  return Object.freeze(history.filter((record) => record.createdAtMs >= threshold).slice(-240));
};

const countHistory = (
  history: readonly NpcSuppressionHistoryRecord[],
  nowMs: number,
  predicate: (record: NpcSuppressionHistoryRecord) => boolean,
  windowMs = 60_000,
): number => {
  const threshold = nowMs - windowMs;
  let total = 0;
  for (const record of history) {
    if (record.createdAtMs >= threshold && predicate(record)) total += 1;
  }
  return total;
};

const lastHistoryTime = (
  history: readonly NpcSuppressionHistoryRecord[],
  predicate: (record: NpcSuppressionHistoryRecord) => boolean,
): number => {
  let best = 0;
  for (const record of history) {
    if (predicate(record) && record.createdAtMs > best) best = record.createdAtMs;
  }
  return best;
};

const channelOccupancyOf = (room: NpcSuppressionRoomState, channel: CadenceChannel): number => {
  return room.channelOccupancy?.[channel] ?? room.occupancy;
};

const recentByKindOf = (room: NpcSuppressionRoomState, actorKind: NpcActorKind): number => {
  return room.recentByKind?.[actorKind] ?? 0;
};

const getWitnessRule = (context: CadenceContext): ContextWitnessRule | null => {
  for (const rule of WITNESS_RULES) {
    if (rule.context === context) return rule;
  }
  return null;
};

const isAmbientPersona = (value: string | undefined): value is AmbientNpcPersonaId => Boolean(value && ambientNpcRegistry.hasPersona(value));
const isHelperPersona = (value: string | undefined): value is HelperPersonaId => Boolean(value && helperDialogueRegistry.hasPersona(value));
const isHaterPersona = (value: string | undefined): value is HaterRegistryPersonaId => Boolean(value && haterDialogueRegistry.hasPersona(value));

const ambientContexts = new Set<AmbientNpcContext>(ambientNpcRegistry.listContexts());
const helperContexts = new Set<HelperDialogueContext>(helperDialogueRegistry.listContexts());
const haterContexts = new Set<HaterDialogueContext>(haterDialogueRegistry.listContexts());

const contextBelongsToKind = (actorKind: NpcActorKind, context: CadenceContext): boolean => {
  switch (actorKind) {
    case 'AMBIENT': return ambientContexts.has(context as AmbientNpcContext);
    case 'HELPER': return helperContexts.has(context as HelperDialogueContext);
    case 'HATER': return haterContexts.has(context as HaterDialogueContext);
    case 'INVASION': return context === 'INVASION_OPEN' || context === 'INVASION_CLOSE';
    default: return false;
  }
};

const scorePriority = (
  request: NpcSuppressionRequest,
  room: NpcSuppressionRoomState,
  scene: SceneSuppressionProfile,
  mode: ModeSuppressionProfile,
  cadence: NpcCadenceDecision,
): number => {
  const pressure = clamp01(room.pressure);
  const heat = clamp01(room.heat);
  const frustration = clamp01(room.frustration);
  const confidence = clamp01(room.confidence);
  const coldStart = clamp01(room.coldStart);
  const witness = getWitnessRule(request.context);
  const priorityHint = clampNonNegative(request.priorityHint);

  let score = 0;
  score += cadence.priorityScore;
  score += priorityHint;
  score += witness?.witnessRequired ? 1.25 : 0;
  score += request.witnessPreferred ? 0.5 : 0;
  score += request.actorKind === 'HELPER' ? ((frustration * 1.3) + ((1 - confidence) * 0.4) + (coldStart * 0.6)) : 0;
  score += request.actorKind === 'HATER' ? ((pressure * 1.1) + (heat * 0.9) + (confidence * 0.2)) : 0;
  score += request.actorKind === 'AMBIENT' ? ((heat * 0.55) + ((1 - pressure) * 0.25) + (room.silenceDebt * 0.4)) : 0;
  score += scene.helperBias * (request.actorKind === 'HELPER' ? 0.4 : 0);
  score += scene.haterBias * (request.actorKind === 'HATER' ? 0.4 : 0);
  score += mode.postRunNarrativeBias * (room.postRun ? 0.3 : 0);
  return Number(score.toFixed(6));
};

const visibilityFromReason = (reason: NpcSuppressionReason): NpcSuppressionVisibility => {
  switch (reason) {
    case 'NONE': return 'public';
    case 'SHADOW_ONLY': return 'shadow';
    case 'SHADOW_ONLY_AND_DEFER': return 'deferred';
    case 'RECENT_DUPLICATE':
    case 'PRIORITY_PREEMPTED':
    case 'HELPER_TOO_EARLY':
    case 'HELPER_TOO_LATE':
    case 'HATER_NOT_EARNED':
    case 'DEAL_ROOM_RESTRAINT':
    case 'SYNDICATE_RESTRAINT':
    case 'LOBBY_RESTRAINT':
    case 'POSTRUN_RESTRAINT':
    case 'AMBIENT_TOO_MUCH_HEAT':
    case 'AMBIENT_TOO_MUCH_PRESSURE':
    case 'AMBIENT_TOO_MUCH_FRUSTRATION':
    case 'WITNESS_REQUIRED_BY_OTHER_KIND':
    case 'HELPER_WINDOW_RESERVED':
    case 'HATER_WINDOW_RESERVED':
      return 'deferred';
    default:
      return 'dropped';
  }
};

const buildAllowDecision = (
  request: NpcSuppressionRequest,
  cadence: NpcCadenceDecision,
  reason: NpcSuppressionReason,
  diagnostics: readonly string[],
  priorityScore: number,
): NpcSuppressionDecision => {
  return Object.freeze({
    allow: true,
    actorKey: actorKeyOf(request),
    actorKind: request.actorKind,
    personaId: request.personaId,
    channel: request.channel,
    context: request.context,
    sceneState: cadence.sceneState,
    reason,
    visibility: 'public',
    shadowOnly: cadence.shadowOnly,
    witnessRequired: cadence.witnessRequired,
    suppressUntilMs: cadence.nextAllowedAtMs,
    priorityScore,
    deferMs: 0,
    channelBudget: cadence.budgetCost,
    diagnostics,
    cadence,
  });
};

const buildRejectDecision = (
  request: NpcSuppressionRequest,
  cadence: NpcCadenceDecision | undefined,
  sceneState: CadenceSceneState,
  reason: NpcSuppressionReason,
  diagnostics: readonly string[],
  priorityScore: number,
  suppressUntilMs: number,
  deferMs: number,
): NpcSuppressionDecision => {
  const visibility = visibilityFromReason(reason);
  return Object.freeze({
    allow: false,
    actorKey: actorKeyOf(request),
    actorKind: request.actorKind,
    personaId: request.personaId,
    channel: request.channel,
    context: request.context,
    sceneState,
    reason,
    visibility,
    shadowOnly: visibility === 'shadow' || cadence?.shadowOnly === true,
    witnessRequired: cadence?.witnessRequired ?? false,
    suppressUntilMs,
    priorityScore,
    deferMs,
    channelBudget: cadence?.budgetCost ?? 0,
    diagnostics,
    cadence,
  });
};

const helperAxisKey = (channel: CadenceChannel, personaId: HelperPersonaId | undefined): string => {
  return `${channel}:${personaId ? HELPER_AXES_BY_ID[personaId] : 'unknown'}`;
};

export class NpcSuppressionPolicy {
  public createEmptyLedger(): NpcSuppressionLedger {
    return Object.freeze({
      lastAllowedAtByActor: Object.freeze({}),
      lastSuppressedAtByActor: Object.freeze({}),
      suppressionCountsByActor: Object.freeze({}),
      suppressionCountsByReason: Object.freeze({}) as Readonly<Record<NpcSuppressionReason, number>>,
      recentHistory: Object.freeze([]),
      lastWitnessAtByChannel: Object.freeze({}),
      lastHelperAxisAtByChannel: Object.freeze({}),
    });
  }

  public fromCadenceRoom(room: RoomCadenceSnapshot, extra?: Partial<NpcSuppressionRoomState>): NpcSuppressionRoomState {
    return Object.freeze({
      roomId: room.roomId,
      modeId: room.modeId,
      runTick: room.runTick,
      occupancy: room.occupancy,
      heat: clamp01(room.heat),
      pressure: clamp01(room.pressure),
      frustration: clamp01(room.frustration),
      confidence: clamp01(room.confidence),
      coldStart: clamp01(room.coldStart),
      silenceDebt: clamp01(room.silenceDebt),
      invasionActive: room.invasionActive,
      helperLock: room.helperLock,
      playerNearBankruptcy: room.playerNearBankruptcy,
      shieldBreached: room.shieldBreached,
      nearSovereignty: room.nearSovereignty,
      dealStalled: room.dealStalled,
      postRun: room.postRun,
      lastPlayerMessageAtMs: room.lastPlayerMessageAtMs,
      lastIncomingSystemEventAtMs: room.lastIncomingSystemEventAtMs,
      channelOccupancy: room.channelOccupancy,
      recentByKind: room.recentByKind,
      openDealCount: extra?.openDealCount ?? 0,
      unresolvedThreatCount: extra?.unresolvedThreatCount ?? 0,
      recentCollapseCount: extra?.recentCollapseCount ?? 0,
      recentComebackCount: extra?.recentComebackCount ?? 0,
      recentSuppressionByKind: extra?.recentSuppressionByKind ?? Object.freeze({}),
    });
  }

  public evaluate(request: NpcSuppressionRequest, room: NpcSuppressionRoomState, ledger: NpcSuppressionLedger): NpcSuppressionDecision {
    const diagnostics: string[] = [];
    const actorKey = actorKeyOf(request);
    const channelProfile = CHANNEL_PROFILES[request.channel];
    const actorProfile = ACTOR_PROFILES[request.actorKind];
    const modeProfile = determineModeProfile(room.modeId);
    const sceneState = inferSceneState(room);
    const sceneProfile = SCENE_PROFILES[sceneState];
    const nowMs = request.desiredAtMs;

    diagnostics.push(`actorKey=${actorKey}`);
    diagnostics.push(`sceneState=${sceneState}`);
    diagnostics.push(`modeProfile=${modeProfile.id}`);
    diagnostics.push(`occupancy=${room.occupancy}`);
    diagnostics.push(`channelOccupancy=${channelOccupancyOf(room, request.channel)}`);
    diagnostics.push(`heat=${clamp01(room.heat).toFixed(3)}`);
    diagnostics.push(`pressure=${clamp01(room.pressure).toFixed(3)}`);
    diagnostics.push(`frustration=${clamp01(room.frustration).toFixed(3)}`);
    diagnostics.push(`confidence=${clamp01(room.confidence).toFixed(3)}`);

    if (!actorProfile) {
      return buildRejectDecision(request, undefined, sceneState, 'UNKNOWN_KIND', Object.freeze(diagnostics), 0, nowMs, 0);
    }

    if (!channelProfile?.enabled) {
      diagnostics.push('channel disabled');
      return buildRejectDecision(request, undefined, sceneState, 'CHANNEL_DISABLED', Object.freeze(diagnostics), 0, nowMs + 30_000, 0);
    }

    if (request.moderationQuarantine) {
      diagnostics.push('moderation quarantine');
      return buildRejectDecision(request, undefined, sceneState, 'MODERATION_QUARANTINE', Object.freeze(diagnostics), 0, nowMs + 60_000, 0);
    }

    if (request.sessionMuted) {
      diagnostics.push('session muted');
      return buildRejectDecision(request, undefined, sceneState, 'SESSION_MUTED', Object.freeze(diagnostics), 0, nowMs + 45_000, 0);
    }

    const cadenceRequest: NpcCadenceRequest = Object.freeze({
      requestId: request.requestId,
      actorKind: request.actorKind,
      actorId: request.actorId,
      personaId: request.personaId,
      channel: request.channel,
      context: request.context,
      createdAtMs: request.createdAtMs,
      desiredAtMs: request.desiredAtMs,
      lineCadenceFloorMs: actorProfile.repeatGapMs,
      priorityHint: request.priorityHint,
      force: request.force,
      shadowPreferred: request.allowShadow,
      sourceEventKind: request.sourceEventKind,
      sourceEventId: request.sourceEventId,
    });

    const cadence = npcCadencePolicy.evaluate(cadenceRequest, room, {
      lastEmissionAtByActor: ledger.lastAllowedAtByActor,
      lastEmissionAtByChannel: Object.freeze({
        GLOBAL: 0,
        SYNDICATE: 0,
        DEAL_ROOM: 0,
        LOBBY: 0,
        SYSTEM_SHADOW: 0,
        NPC_SHADOW: 0,
        ...Object.fromEntries(
          (['GLOBAL','SYNDICATE','DEAL_ROOM','LOBBY','SYSTEM_SHADOW','NPC_SHADOW'] as const)
            .map((channel) => [channel, lastHistoryTime(ledger.recentHistory, (record) => record.channel === channel && record.visibility === 'public')]),
        ),
      }),
      lastEmissionAtByKind: Object.freeze({
        AMBIENT: lastHistoryTime(ledger.recentHistory, (record) => record.actorKind === 'AMBIENT' && record.visibility === 'public'),
        HELPER: lastHistoryTime(ledger.recentHistory, (record) => record.actorKind === 'HELPER' && record.visibility === 'public'),
        HATER: lastHistoryTime(ledger.recentHistory, (record) => record.actorKind === 'HATER' && record.visibility === 'public'),
        INVASION: lastHistoryTime(ledger.recentHistory, (record) => record.actorKind === 'INVASION' && record.visibility === 'public'),
      }),
      recentEmissionLog: Object.freeze(
        ledger.recentHistory
          .filter((record) => record.visibility === 'public')
          .map((record) => Object.freeze({
            requestId: record.requestId,
            actorKey: record.actorKey,
            actorKind: record.actorKind,
            channel: record.channel,
            context: record.context,
            emittedAtMs: record.createdAtMs,
            sceneState: record.sceneState,
            priorityScore: record.priorityScore,
            shadowOnly: false,
          }))
          .slice(-160),
      ),
      suppressionCountsByActor: ledger.suppressionCountsByActor,
    });

    diagnostics.push(...cadence.diagnostics.map((item) => `cadence:${item}`));

    const priorityScore = scorePriority(request, room, sceneProfile, modeProfile, cadence);
    const witnessRule = getWitnessRule(request.context);
    const actorOccupancy = channelOccupancyOf(room, request.channel);
    const recentSuppressionCount = ledger.suppressionCountsByActor[actorKey] ?? 0;
    const recentDuplicateCount = countHistory(ledger.recentHistory, nowMs, (record) => record.actorKey === actorKey && record.context === request.context, 45_000);
    const roomPrivate = channelProfile.privateRoomBias >= 0.8 && actorOccupancy <= 2;

    diagnostics.push(`priorityScore=${priorityScore.toFixed(3)}`);
    diagnostics.push(`recentSuppressionCount=${recentSuppressionCount}`);
    diagnostics.push(`recentDuplicateCount=${recentDuplicateCount}`);
    diagnostics.push(`roomPrivate=${roomPrivate}`);

    if (!contextBelongsToKind(request.actorKind, request.context) && request.actorKind !== 'INVASION') {
      diagnostics.push('context does not belong to actor kind');
      return buildRejectDecision(request, cadence, sceneState, 'CHANNEL_POLICY_MISMATCH', Object.freeze(diagnostics), priorityScore, nowMs + 30_000, 0);
    }

    if (request.personaId) {
      const validPersona = (
        (request.actorKind === 'AMBIENT' && isAmbientPersona(request.personaId))
        || (request.actorKind === 'HELPER' && isHelperPersona(request.personaId))
        || (request.actorKind === 'HATER' && isHaterPersona(request.personaId))
      );
      if (!validPersona && request.actorKind !== 'INVASION') {
        diagnostics.push('unknown persona');
        return buildRejectDecision(request, cadence, sceneState, 'UNKNOWN_PERSONA', Object.freeze(diagnostics), priorityScore, nowMs + 30_000, 0);
      }
    }

    if (!cadence.allow && !request.force) {
      const mappedReason: NpcSuppressionReason = cadence.suppressionReason === 'SILENCE_PREFERRED'
        ? 'SHADOW_ONLY_AND_DEFER'
        : cadence.suppressionReason === 'DEAL_ROOM_RESTRAINT'
          ? 'DEAL_ROOM_RESTRAINT'
          : cadence.suppressionReason === 'SYNDICATE_RESTRAINT'
            ? 'SYNDICATE_RESTRAINT'
            : cadence.suppressionReason === 'LOBBY_RESTRAINT'
              ? 'LOBBY_RESTRAINT'
              : cadence.shadowOnly
                ? 'SHADOW_ONLY'
                : 'PRIORITY_PREEMPTED';
      diagnostics.push(`cadence blocked with ${mappedReason}`);
      return buildRejectDecision(request, cadence, sceneState, mappedReason, Object.freeze(diagnostics), priorityScore, cadence.nextAllowedAtMs, Math.max(0, cadence.nextAllowedAtMs - nowMs));
    }

    if (request.proofProtected) {
      diagnostics.push('proof protection active');
      return buildRejectDecision(request, cadence, sceneState, 'PROOF_PROTECTION', Object.freeze(diagnostics), priorityScore, nowMs + 5_500, 5_500);
    }

    if (request.rescueProtected) {
      diagnostics.push('recovery protection active');
      return buildRejectDecision(request, cadence, sceneState, 'RECOVERY_PROTECTION', Object.freeze(diagnostics), priorityScore, nowMs + 7_500, 7_500);
    }

    if (room.invasionActive && request.actorKind === 'AMBIENT') {
      diagnostics.push('ambient blocked during invasion');
      return buildRejectDecision(request, cadence, sceneState, 'INVASION_LOCK', Object.freeze(diagnostics), priorityScore, nowMs + 8_000, 8_000);
    }

    if (actorOccupancy < Math.max(channelProfile.occupancyFloor, actorProfile.minimumOccupancy) && request.actorKind === 'AMBIENT') {
      diagnostics.push('ambient needs occupancy');
      return buildRejectDecision(request, cadence, sceneState, 'AMBIENT_NEEDS_OCCUPANCY', Object.freeze(diagnostics), priorityScore, nowMs + 12_000, 12_000);
    }

    if (request.actorKind === 'AMBIENT' && !channelProfile.ambientAllowed) {
      diagnostics.push('ambient disallowed in channel');
      return buildRejectDecision(request, cadence, sceneState, 'AMBIENT_DISALLOWED', Object.freeze(diagnostics), priorityScore, nowMs + 18_000, 18_000);
    }

    if (request.actorKind === 'AMBIENT' && !sceneProfile.ambientAllowed) {
      diagnostics.push('ambient disallowed in scene');
      return buildRejectDecision(request, cadence, sceneState, 'SCENE_POLICY_MISMATCH', Object.freeze(diagnostics), priorityScore, nowMs + 10_000, 10_000);
    }

    if (request.actorKind === 'AMBIENT' && clamp01(room.heat) > channelProfile.heatCapForAmbient) {
      diagnostics.push('ambient blocked by heat cap');
      return buildRejectDecision(request, cadence, sceneState, 'AMBIENT_TOO_MUCH_HEAT', Object.freeze(diagnostics), priorityScore, nowMs + 9_000, 9_000);
    }

    if (request.actorKind === 'AMBIENT' && clamp01(room.pressure) > Math.min(channelProfile.pressureCapForAmbient, actorProfile.maximumAmbientPressure)) {
      diagnostics.push('ambient blocked by pressure cap');
      return buildRejectDecision(request, cadence, sceneState, 'AMBIENT_TOO_MUCH_PRESSURE', Object.freeze(diagnostics), priorityScore, nowMs + 9_000, 9_000);
    }

    if (request.actorKind === 'AMBIENT' && clamp01(room.frustration) >= 0.68 && !room.postRun) {
      diagnostics.push('ambient blocked by frustration');
      return buildRejectDecision(request, cadence, sceneState, 'AMBIENT_TOO_MUCH_FRUSTRATION', Object.freeze(diagnostics), priorityScore, nowMs + 8_000, 8_000);
    }

    if (request.actorKind === 'HELPER' && !channelProfile.helperAllowed) {
      diagnostics.push('helper disallowed in channel');
      return buildRejectDecision(request, cadence, sceneState, 'CHANNEL_POLICY_MISMATCH', Object.freeze(diagnostics), priorityScore, nowMs + 10_000, 10_000);
    }

    if (request.actorKind === 'HELPER' && room.helperLock && !request.force) {
      diagnostics.push('helper lock active');
      return buildRejectDecision(request, cadence, sceneState, 'HELPER_LOCK_ACTIVE', Object.freeze(diagnostics), priorityScore, nowMs + 10_000, 10_000);
    }

    if (request.actorKind === 'HELPER' && clamp01(room.frustration) < 0.16 && !room.playerNearBankruptcy && !room.shieldBreached && !room.postRun && !room.nearSovereignty) {
      diagnostics.push('helper not needed');
      return buildRejectDecision(request, cadence, sceneState, 'HELPER_NOT_NEEDED', Object.freeze(diagnostics), priorityScore, nowMs + 6_000, 6_000);
    }

    if (request.actorKind === 'HELPER' && room.modeId.toLowerCase().includes('lobby')) {
      diagnostics.push('helper restrained in lobby');
      return buildRejectDecision(request, cadence, sceneState, 'LOBBY_RESTRAINT', Object.freeze(diagnostics), priorityScore, nowMs + 5_000, 5_000);
    }

    if (request.actorKind === 'HELPER' && room.postRun && request.context !== 'POSTRUN_MOURN' && request.context !== 'POSTRUN_CELEBRATE' && request.context !== 'POSTRUN_DEBRIEF') {
      diagnostics.push('helper context too early for postrun');
      return buildRejectDecision(request, cadence, sceneState, 'HELPER_TOO_EARLY', Object.freeze(diagnostics), priorityScore, nowMs + 5_000, 5_000);
    }

    if (request.actorKind === 'HELPER' && isHelperPersona(request.personaId)) {
      const axisKey = helperAxisKey(request.channel, request.personaId);
      const lastAxisAt = ledger.lastHelperAxisAtByChannel[axisKey] ?? 0;
      if ((nowMs - lastAxisAt) < 20_000 && !request.force) {
        diagnostics.push(`helper axis duplicate ${axisKey}`);
        return buildRejectDecision(request, cadence, sceneState, 'HELPER_DUPLICATE_AXIS', Object.freeze(diagnostics), priorityScore, lastAxisAt + 20_000, Math.max(0, (lastAxisAt + 20_000) - nowMs));
      }
    }

    if (request.actorKind === 'HATER' && !channelProfile.haterAllowed) {
      diagnostics.push('hater disallowed in channel');
      return buildRejectDecision(request, cadence, sceneState, 'CHANNEL_POLICY_MISMATCH', Object.freeze(diagnostics), priorityScore, nowMs + 10_000, 10_000);
    }

    if (request.actorKind === 'HATER' && clamp01(room.pressure) < actorProfile.minimumPressure && !room.modeId.toLowerCase().includes('lobby')) {
      diagnostics.push('hater not earned by pressure');
      return buildRejectDecision(request, cadence, sceneState, 'HATER_NOT_EARNED', Object.freeze(diagnostics), priorityScore, nowMs + 7_000, 7_000);
    }

    if (request.actorKind === 'HATER' && recentByKindOf(room, 'HATER') >= 3 && clamp01(room.frustration) > 0.72) {
      diagnostics.push('hater too noisy for frustration');
      return buildRejectDecision(request, cadence, sceneState, 'HATER_TOO_NOISY', Object.freeze(diagnostics), priorityScore, nowMs + 11_000, 11_000);
    }

    if (request.actorKind === 'HATER' && request.context === 'PLAYER_RESPONSE_FLEX' && clamp01(room.confidence) < 0.25) {
      diagnostics.push('hater flex context lacks target signal');
      return buildRejectDecision(request, cadence, sceneState, 'HATER_NEEDS_TARGET_SIGNAL', Object.freeze(diagnostics), priorityScore, nowMs + 8_000, 8_000);
    }

    if (request.actorKind === 'HATER' && room.postRun && request.context !== 'POSTRUN_MOURN') {
      diagnostics.push('hater restrained postrun');
      return buildRejectDecision(request, cadence, sceneState, 'POSTRUN_RESTRAINT', Object.freeze(diagnostics), priorityScore, nowMs + 6_500, 6_500);
    }

    if (roomPrivate && request.actorKind === 'AMBIENT') {
      diagnostics.push('private room blocks ambient');
      return buildRejectDecision(request, cadence, sceneState, 'ROOM_TOO_PRIVATE', Object.freeze(diagnostics), priorityScore, nowMs + 20_000, 20_000);
    }

    if (modeProfile.dealRestraint && request.channel === 'DEAL_ROOM' && request.actorKind === 'AMBIENT') {
      diagnostics.push('deal room ambient restraint');
      return buildRejectDecision(request, cadence, sceneState, 'DEAL_ROOM_RESTRAINT', Object.freeze(diagnostics), priorityScore, nowMs + 12_000, 12_000);
    }

    if (modeProfile.syndicateRestraint && request.channel === 'SYNDICATE' && request.actorKind === 'AMBIENT' && clamp01(room.silenceDebt) < 0.45) {
      diagnostics.push('syndicate ambient restraint');
      return buildRejectDecision(request, cadence, sceneState, 'SYNDICATE_RESTRAINT', Object.freeze(diagnostics), priorityScore, nowMs + 10_000, 10_000);
    }

    if (recentDuplicateCount >= 2 && !request.force) {
      diagnostics.push('recent duplicate across history');
      return buildRejectDecision(request, cadence, sceneState, 'RECENT_DUPLICATE', Object.freeze(diagnostics), priorityScore, nowMs + 9_000, 9_000);
    }

    const repeatOverheat = countHistory(ledger.recentHistory, nowMs, (record) => record.actorKey === actorKey, 90_000) >= 5;
    if (repeatOverheat && request.actorKind !== 'INVASION' && !request.force) {
      diagnostics.push('repetition overheat');
      return buildRejectDecision(request, cadence, sceneState, 'REPETITION_OVERHEAT', Object.freeze(diagnostics), priorityScore, nowMs + 15_000, 15_000);
    }

    if (witnessRule) {
      const lastWitnessAt = ledger.lastWitnessAtByChannel[request.channel] ?? 0;
      const withinWitnessLock = (nowMs - lastWitnessAt) < witnessRule.suppressOtherKindsForMs;
      diagnostics.push(`witnessRule=${witnessRule.preferredKind}:${withinWitnessLock}`);

      if (witnessRule.witnessRequired && request.actorKind !== witnessRule.preferredKind && withinWitnessLock && !request.force) {
        diagnostics.push('witness reserved by other kind');
        return buildRejectDecision(request, cadence, sceneState, 'WITNESS_REQUIRED_BY_OTHER_KIND', Object.freeze(diagnostics), priorityScore, lastWitnessAt + witnessRule.suppressOtherKindsForMs, Math.max(0, (lastWitnessAt + witnessRule.suppressOtherKindsForMs) - nowMs));
      }

      if (room.playerNearBankruptcy && witnessRule.context === 'PLAYER_NEAR_BANKRUPTCY' && request.actorKind !== 'HELPER' && witnessRule.witnessRequired) {
        diagnostics.push('collapse requires helper witness');
        return buildRejectDecision(request, cadence, sceneState, 'COLLAPSE_REQUIRES_WITNESS', Object.freeze(diagnostics), priorityScore, nowMs + 7_500, 7_500);
      }

      if (room.nearSovereignty && witnessRule.context === 'NEAR_SOVEREIGNTY' && request.actorKind === 'HATER' && !request.force) {
        diagnostics.push('sovereignty witness suppresses hater');
        return buildRejectDecision(request, cadence, sceneState, 'SOVEREIGNTY_REQUIRES_WITNESS', Object.freeze(diagnostics), priorityScore, nowMs + 8_500, 8_500);
      }
    }

    if ((request.allowShadow || cadence.shadowOnly) && request.channel !== 'GLOBAL' && request.actorKind !== 'INVASION') {
      diagnostics.push('shadow eligible but public not required');
      if (request.actorKind === 'AMBIENT' || room.modeId.toLowerCase().includes('deal') || room.modeId.toLowerCase().includes('syndicate')) {
        return buildRejectDecision(request, cadence, sceneState, 'SHADOW_ONLY', Object.freeze(diagnostics), priorityScore, cadence.nextAllowedAtMs, 0);
      }
    }

    return buildAllowDecision(request, cadence, 'NONE', Object.freeze(diagnostics), priorityScore);
  }

  public rankRequests(
    requests: readonly NpcSuppressionRequest[],
    room: NpcSuppressionRoomState,
    ledger: NpcSuppressionLedger,
  ): readonly RankedSuppressionDecision[] {
    const ranked = requests.map((request) => ({ request, decision: this.evaluate(request, room, ledger) }));
    ranked.sort((left, right) => {
      if (left.decision.allow !== right.decision.allow) return left.decision.allow ? -1 : 1;
      if (left.decision.visibility !== right.decision.visibility) {
        const weight = { public: 0, shadow: 1, deferred: 2, dropped: 3 } as const;
        return weight[left.decision.visibility] - weight[right.decision.visibility];
      }
      if (left.decision.priorityScore !== right.decision.priorityScore) return right.decision.priorityScore - left.decision.priorityScore;
      if (left.decision.witnessRequired !== right.decision.witnessRequired) return left.decision.witnessRequired ? -1 : 1;
      if (left.request.desiredAtMs !== right.request.desiredAtMs) return left.request.desiredAtMs - right.request.desiredAtMs;
      return left.request.requestId.localeCompare(right.request.requestId);
    });
    return Object.freeze(ranked);
  }

  public selectWinner(
    requests: readonly NpcSuppressionRequest[],
    room: NpcSuppressionRoomState,
    ledger: NpcSuppressionLedger,
  ): RankedSuppressionDecision | null {
    const ranked = this.rankRequests(requests, room, ledger);
    return ranked.find((entry) => entry.decision.allow) ?? null;
  }

  public evaluateBatch(
    requests: readonly NpcSuppressionRequest[],
    room: NpcSuppressionRoomState,
    ledger: NpcSuppressionLedger,
  ): NpcSuppressionBatchResult {
    const ranked = this.rankRequests(requests, room, ledger);
    const winner = ranked.find((entry) => entry.decision.allow) ?? null;
    const dropped = ranked.filter((entry) => entry.decision.visibility === 'dropped');
    const deferred = ranked.filter((entry) => entry.decision.visibility === 'deferred');
    const shadowed = ranked.filter((entry) => entry.decision.visibility === 'shadow');
    return Object.freeze({
      ranked,
      winner,
      dropped: Object.freeze(dropped),
      deferred: Object.freeze(deferred),
      shadowed: Object.freeze(shadowed),
    });
  }

  public recordDecision(
    ledger: NpcSuppressionLedger,
    request: NpcSuppressionRequest,
    decision: NpcSuppressionDecision,
    atMs = request.desiredAtMs,
  ): NpcSuppressionLedger {
    const actorKey = decision.actorKey;

    const lastAllowedAtByActor = decision.allow
      ? Object.freeze({ ...ledger.lastAllowedAtByActor, [actorKey]: atMs })
      : ledger.lastAllowedAtByActor;

    const lastSuppressedAtByActor = !decision.allow
      ? Object.freeze({ ...ledger.lastSuppressedAtByActor, [actorKey]: atMs })
      : ledger.lastSuppressedAtByActor;

    const suppressionCountsByActor = !decision.allow
      ? Object.freeze({ ...ledger.suppressionCountsByActor, [actorKey]: (ledger.suppressionCountsByActor[actorKey] ?? 0) + 1 })
      : ledger.suppressionCountsByActor;

    const suppressionCountsByReason = !decision.allow
      ? Object.freeze({
          ...ledger.suppressionCountsByReason,
          [decision.reason]: (ledger.suppressionCountsByReason[decision.reason] ?? 0) + 1,
        }) as Readonly<Record<NpcSuppressionReason, number>>
      : ledger.suppressionCountsByReason;

    const recentHistory = trimHistory(Object.freeze([
      ...ledger.recentHistory,
      Object.freeze({
        requestId: request.requestId,
        actorKey,
        actorKind: request.actorKind,
        channel: request.channel,
        context: request.context,
        reason: decision.reason,
        visibility: decision.visibility,
        createdAtMs: atMs,
        sceneState: decision.sceneState,
        witnessRequired: decision.witnessRequired,
        priorityScore: decision.priorityScore,
      }),
    ]), atMs);

    const lastWitnessAtByChannel = (decision.allow && decision.witnessRequired)
      ? Object.freeze({ ...ledger.lastWitnessAtByChannel, [request.channel]: atMs })
      : ledger.lastWitnessAtByChannel;

    const lastHelperAxisAtByChannel = (decision.allow && request.actorKind === 'HELPER' && isHelperPersona(request.personaId))
      ? Object.freeze({
          ...ledger.lastHelperAxisAtByChannel,
          [helperAxisKey(request.channel, request.personaId)]: atMs,
        })
      : ledger.lastHelperAxisAtByChannel;

    return Object.freeze({
      lastAllowedAtByActor,
      lastSuppressedAtByActor,
      suppressionCountsByActor,
      suppressionCountsByReason,
      recentHistory,
      lastWitnessAtByChannel,
      lastHelperAxisAtByChannel,
    });
  }

  public buildRoomPressureLock(room: NpcSuppressionRoomState): Readonly<Record<string, boolean>> {
    const sceneState = inferSceneState(room);
    return Object.freeze({
      ambientLocked: room.invasionActive || sceneState === 'BREACH' || sceneState === 'NEGOTIATION',
      helperLocked: room.helperLock,
      haterLocked: room.postRun && !room.invasionActive,
      witnessNeeded: room.playerNearBankruptcy || room.shieldBreached || room.nearSovereignty,
      privateRoom: channelOccupancyOf(room, 'SYNDICATE') <= 2 || channelOccupancyOf(room, 'DEAL_ROOM') <= 2,
    });
  }

  public buildChannelSuppressionMap(room: NpcSuppressionRoomState): Readonly<Record<CadenceChannel, Readonly<Record<NpcActorKind, boolean>>>> {
    const sceneState = inferSceneState(room);
    const sceneProfile = SCENE_PROFILES[sceneState];
    const output: Partial<Record<CadenceChannel, Readonly<Record<NpcActorKind, boolean>>>> = {};
    const channels = ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY', 'SYSTEM_SHADOW', 'NPC_SHADOW'] as const;
    const kinds = ['AMBIENT', 'HELPER', 'HATER', 'INVASION'] as const;

    for (const channel of channels) {
      const profile = CHANNEL_PROFILES[channel];
      const perKind: Partial<Record<NpcActorKind, boolean>> = {};
      for (const kind of kinds) {
        if (!profile.enabled) {
          perKind[kind] = false;
          continue;
        }
        if (kind === 'AMBIENT') perKind[kind] = profile.ambientAllowed && sceneProfile.ambientAllowed;
        else if (kind === 'HELPER') perKind[kind] = profile.helperAllowed;
        else if (kind === 'HATER') perKind[kind] = profile.haterAllowed;
        else perKind[kind] = true;
      }
      output[channel] = Object.freeze(perKind as Record<NpcActorKind, boolean>);
    }

    return Object.freeze(output as Record<CadenceChannel, Readonly<Record<NpcActorKind, boolean>>>);
  }

  public buildWitnessPlan(room: NpcSuppressionRoomState): Readonly<Record<string, string | boolean | number>> {
    const sceneState = inferSceneState(room);
    const witnessContext = room.playerNearBankruptcy
      ? 'PLAYER_NEAR_BANKRUPTCY'
      : room.shieldBreached
        ? 'PLAYER_SHIELD_BREAK'
        : room.nearSovereignty
          ? 'NEAR_SOVEREIGNTY'
          : room.postRun
            ? 'POSTRUN_MOURN'
            : 'GAME_START';
    const witnessRule = getWitnessRule(witnessContext);
    return Object.freeze({
      sceneState,
      witnessContext,
      witnessRequired: witnessRule?.witnessRequired ?? false,
      preferredKind: witnessRule?.preferredKind ?? 'AMBIENT',
      publicPreferred: witnessRule?.publicPreferred ?? true,
      suppressOtherKindsForMs: witnessRule?.suppressOtherKindsForMs ?? 0,
      collapseCount: room.recentCollapseCount ?? 0,
      comebackCount: room.recentComebackCount ?? 0,
    });
  }

  public explainDecision(decision: NpcSuppressionDecision): string {
    const header = `${decision.actorKind}:${decision.personaId ?? 'unknown'}:${decision.context}`;
    if (decision.allow) {
      return `${header} allowed as ${decision.visibility} in ${decision.channel} with score=${decision.priorityScore.toFixed(3)}`;
    }
    return `${header} suppressed by ${decision.reason} as ${decision.visibility} until ${decision.suppressUntilMs}`;
  }

  public buildDiagnostics(
    room: NpcSuppressionRoomState,
    ledger: NpcSuppressionLedger,
    nowMs: number,
  ): Readonly<Record<string, number | string | boolean>> {
    const sceneState = inferSceneState(room);
    return Object.freeze({
      roomId: room.roomId,
      modeId: room.modeId,
      sceneState,
      occupancy: room.occupancy,
      globalOccupancy: channelOccupancyOf(room, 'GLOBAL'),
      syndicateOccupancy: channelOccupancyOf(room, 'SYNDICATE'),
      dealRoomOccupancy: channelOccupancyOf(room, 'DEAL_ROOM'),
      lobbyOccupancy: channelOccupancyOf(room, 'LOBBY'),
      heat: Number(clamp01(room.heat).toFixed(3)),
      pressure: Number(clamp01(room.pressure).toFixed(3)),
      frustration: Number(clamp01(room.frustration).toFixed(3)),
      confidence: Number(clamp01(room.confidence).toFixed(3)),
      coldStart: Number(clamp01(room.coldStart).toFixed(3)),
      silenceDebt: Number(clamp01(room.silenceDebt).toFixed(3)),
      invasionActive: room.invasionActive,
      helperLock: room.helperLock,
      playerNearBankruptcy: room.playerNearBankruptcy,
      shieldBreached: room.shieldBreached,
      nearSovereignty: room.nearSovereignty,
      dealStalled: room.dealStalled,
      postRun: room.postRun,
      recentHistory: ledger.recentHistory.length,
      recentAmbientSuppressions: countHistory(ledger.recentHistory, nowMs, (record) => record.actorKind === 'AMBIENT' && !record.visibility.startsWith('public' as never), 60_000),
      recentHelperSuppressions: countHistory(ledger.recentHistory, nowMs, (record) => record.actorKind === 'HELPER' && record.visibility !== 'public', 60_000),
      recentHaterSuppressions: countHistory(ledger.recentHistory, nowMs, (record) => record.actorKind === 'HATER' && record.visibility !== 'public', 60_000),
      lastGlobalWitnessAt: ledger.lastWitnessAtByChannel.GLOBAL ?? 0,
      lastSyndicateWitnessAt: ledger.lastWitnessAtByChannel.SYNDICATE ?? 0,
      lastDealWitnessAt: ledger.lastWitnessAtByChannel.DEAL_ROOM ?? 0,
      lastLobbyWitnessAt: ledger.lastWitnessAtByChannel.LOBBY ?? 0,
    });
  }
}

export const createNpcSuppressionPolicy = (): NpcSuppressionPolicy => new NpcSuppressionPolicy();
export const npcSuppressionPolicy = new NpcSuppressionPolicy();
