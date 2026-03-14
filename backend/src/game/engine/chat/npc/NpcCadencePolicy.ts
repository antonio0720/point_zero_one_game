/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT NPC CADENCE POLICY
 * FILE: backend/src/game/engine/chat/npc/NpcCadencePolicy.ts
 * ============================================================================
 *
 * Doctrine
 * --------
 * - cadence is law, not a cosmetic delay helper
 * - backend decides who may speak, when they may speak, and when silence is stronger than text
 * - cadence must preserve room identity across GLOBAL, SYNDICATE, DEAL_ROOM, and LOBBY
 * - helper timing protects recovery windows; hater timing protects threat credibility
 * - ambient timing protects atmosphere without letting filler overpower signal
 * - all decisions must be deterministic enough for replay and auditable enough for proof chains
 *
 * Behavioral Laws Encoded Here
 * ----------------------------
 * 1. first meaningful reaction should feel fast
 * 2. second reaction should prove the world noticed something specific
 * 3. not every event deserves text; some deserve silence
 * 4. every major collapse needs a witness
 * 5. every major comeback needs a witness
 * 6. helpers should feel timely, not spammy
 * 7. haters should feel personal, not random
 * 8. ambient lines should intensify room identity, not dilute it
 * 9. deal room silence is a mechanic, not an absence of implementation
 * 10. syndicate rooms reward restraint more than volume
 */

import type { AmbientChannelAffinity, AmbientNpcContext, AmbientNpcPersonaId } from './AmbientNpcRegistry';
import { ambientNpcRegistry } from './AmbientNpcRegistry';
import type { HaterDialogueContext, HaterRegistryPersonaId } from './HaterDialogueRegistry';
import { haterDialogueRegistry } from './HaterDialogueRegistry';
import type { HelperDialogueContext, HelperPersonaId } from './HelperDialogueRegistry';
import { helperDialogueRegistry } from './HelperDialogueRegistry';

export type NpcActorKind = 'AMBIENT' | 'HELPER' | 'HATER' | 'INVASION';

export type CadenceChannel = AmbientChannelAffinity | 'SYSTEM_SHADOW' | 'NPC_SHADOW';

export type CadenceContext =
  | AmbientNpcContext
  | HelperDialogueContext
  | HaterDialogueContext
  | 'INVASION_OPEN'
  | 'INVASION_CLOSE'
  | 'POSTRUN_DEBRIEF'
  | 'POSTRUN_MOURN'
  | 'POSTRUN_CELEBRATE'
  | 'DEAL_CONFIRM'
  | 'DEAL_RETRACT'
;

export type CadenceSceneState =
  | 'OPENING'
  | 'QUEUE'
  | 'NEGOTIATION'
  | 'MIDRUN'
  | 'PRESSURE'
  | 'BREACH'
  | 'RECOVERY'
  | 'ENDGAME'
  | 'POSTRUN'
  | 'INVASION'
;

export type CadenceSuppressionReason =
  | 'UNKNOWN_ACTOR'
  | 'UNKNOWN_CHANNEL'
  | 'CHANNEL_DISABLED'
  | 'CHANNEL_IDENTITY_MISMATCH'
  | 'ACTOR_COOLDOWN'
  | 'CHANNEL_COOLDOWN'
  | 'KIND_COOLDOWN'
  | 'BURST_LIMIT'
  | 'ROOM_TOO_EMPTY'
  | 'ROOM_TOO_HOT_FOR_AMBIENT'
  | 'SILENCE_PREFERRED'
  | 'HELPER_WINDOW_RESERVED'
  | 'HATER_WINDOW_RESERVED'
  | 'INCOMPATIBLE_SCENE'
  | 'INCOMPATIBLE_MODE'
  | 'INVASION_LOCK'
  | 'DEAL_ROOM_RESTRAINT'
  | 'SYNDICATE_RESTRAINT'
  | 'LOBBY_RESTRAINT'
  | 'AMBIENT_RESTRAINT'
  | 'SHADOW_ONLY'
  | 'SUPPRESSED_BY_PRIORITY'
  | 'SUPPRESSED_BY_WITNESS_RULE'
  | 'FORCED_DISABLED'
;

export interface NpcCadenceRequest {
  readonly requestId: string;
  readonly actorKind: NpcActorKind;
  readonly actorId: string;
  readonly personaId?: AmbientNpcPersonaId | HelperPersonaId | HaterRegistryPersonaId;
  readonly channel: CadenceChannel;
  readonly context: CadenceContext;
  readonly createdAtMs: number;
  readonly desiredAtMs: number;
  readonly lineCadenceFloorMs: number;
  readonly priorityHint?: number;
  readonly force?: boolean;
  readonly shadowPreferred?: boolean;
  readonly sourceEventKind?: string;
  readonly sourceEventId?: string;
}

export interface RoomCadenceSnapshot {
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
}

export interface CadenceEmissionRecord {
  readonly requestId: string;
  readonly actorKey: string;
  readonly actorKind: NpcActorKind;
  readonly channel: CadenceChannel;
  readonly context: CadenceContext;
  readonly emittedAtMs: number;
  readonly sceneState: CadenceSceneState;
  readonly priorityScore: number;
  readonly shadowOnly: boolean;
}

export interface CadenceLedger {
  readonly lastEmissionAtByActor: Readonly<Record<string, number>>;
  readonly lastEmissionAtByChannel: Readonly<Record<CadenceChannel, number>>;
  readonly lastEmissionAtByKind: Readonly<Record<NpcActorKind, number>>;
  readonly recentEmissionLog: readonly CadenceEmissionRecord[];
  readonly suppressionCountsByActor: Readonly<Record<string, number>>;
}

export interface NpcCadenceDecision {
  readonly allow: boolean;
  readonly actorKey: string;
  readonly actorKind: NpcActorKind;
  readonly channel: CadenceChannel;
  readonly context: CadenceContext;
  readonly sceneState: CadenceSceneState;
  readonly suppressionReason?: CadenceSuppressionReason;
  readonly nextAllowedAtMs: number;
  readonly effectiveCooldownMs: number;
  readonly priorityScore: number;
  readonly budgetCost: number;
  readonly shadowOnly: boolean;
  readonly witnessRequired: boolean;
  readonly diagnostics: readonly string[];
}

export interface RankedCadenceDecision {
  readonly request: NpcCadenceRequest;
  readonly decision: NpcCadenceDecision;
}

interface ChannelProfile {
  readonly enabled: boolean;
  readonly minGapMs: number;
  readonly hardBurstCapPerMinute: number;
  readonly identityBias: number;
  readonly prefersSilence: boolean;
  readonly ambientScale: number;
  readonly helperScale: number;
  readonly haterScale: number;
}

interface KindBaseline {
  readonly minGapMs: number;
  readonly kindGapMs: number;
  readonly hardBurstCapPerMinute: number;
  readonly budgetCost: number;
  readonly sceneAggression: number;
  readonly silenceRespect: number;
}

interface ContextProfile {
  readonly sceneState: CadenceSceneState;
  readonly cooldownFactor: number;
  readonly priorityBias: number;
  readonly witnessRequired: boolean;
  readonly ambientFriendly: boolean;
  readonly helperFriendly: boolean;
  readonly haterFriendly: boolean;
  readonly negotiationOnly: boolean;
  readonly queueOnly: boolean;
}

interface ModeModifier {
  readonly modeMatch: readonly string[];
  readonly channelBias: Readonly<Partial<Record<CadenceChannel, number>>>;
  readonly ambientScale: number;
  readonly helperScale: number;
  readonly haterScale: number;
  readonly silenceScale: number;
}

const CHANNEL_PROFILES = Object.freeze({
  GLOBAL: Object.freeze({
    enabled: true,
    minGapMs: 4_000,
    hardBurstCapPerMinute: 18,
    identityBias: 0.95,
    prefersSilence: false,
    ambientScale: 1.00,
    helperScale: 0.95,
    haterScale: 1.05,
  }),
  SYNDICATE: Object.freeze({
    enabled: true,
    minGapMs: 6_500,
    hardBurstCapPerMinute: 10,
    identityBias: 1.10,
    prefersSilence: true,
    ambientScale: 0.80,
    helperScale: 0.95,
    haterScale: 0.65,
  }),
  DEAL_ROOM: Object.freeze({
    enabled: true,
    minGapMs: 7_500,
    hardBurstCapPerMinute: 8,
    identityBias: 1.15,
    prefersSilence: true,
    ambientScale: 0.60,
    helperScale: 0.70,
    haterScale: 0.55,
  }),
  LOBBY: Object.freeze({
    enabled: true,
    minGapMs: 4_800,
    hardBurstCapPerMinute: 12,
    identityBias: 0.85,
    prefersSilence: false,
    ambientScale: 1.10,
    helperScale: 0.80,
    haterScale: 0.55,
  }),
  SYSTEM_SHADOW: Object.freeze({
    enabled: true,
    minGapMs: 2_500,
    hardBurstCapPerMinute: 40,
    identityBias: 1.20,
    prefersSilence: true,
    ambientScale: 0.40,
    helperScale: 0.60,
    haterScale: 0.75,
  }),
  NPC_SHADOW: Object.freeze({
    enabled: true,
    minGapMs: 2_500,
    hardBurstCapPerMinute: 40,
    identityBias: 1.20,
    prefersSilence: true,
    ambientScale: 0.40,
    helperScale: 0.60,
    haterScale: 0.75,
  }),
} as const satisfies Record<CadenceChannel, ChannelProfile>);

const KIND_BASELINES = Object.freeze({
  AMBIENT: Object.freeze({
    minGapMs: 9_000,
    kindGapMs: 3_500,
    hardBurstCapPerMinute: 6,
    budgetCost: 1,
    sceneAggression: 0.35,
    silenceRespect: 0.95,
  }),
  HELPER: Object.freeze({
    minGapMs: 7_000,
    kindGapMs: 3_000,
    hardBurstCapPerMinute: 7,
    budgetCost: 2,
    sceneAggression: 0.58,
    silenceRespect: 0.60,
  }),
  HATER: Object.freeze({
    minGapMs: 8_500,
    kindGapMs: 4_200,
    hardBurstCapPerMinute: 6,
    budgetCost: 3,
    sceneAggression: 0.92,
    silenceRespect: 0.30,
  }),
  INVASION: Object.freeze({
    minGapMs: 12_000,
    kindGapMs: 5_500,
    hardBurstCapPerMinute: 3,
    budgetCost: 5,
    sceneAggression: 1.00,
    silenceRespect: 0.10,
  }),
} as const satisfies Record<NpcActorKind, KindBaseline>);

const CONTEXT_PROFILES = Object.freeze({
  GAME_START: Object.freeze({
    sceneState: 'OPENING' as const,
    cooldownFactor: 0.84,
    priorityBias: 0.82,
    witnessRequired: false,
    ambientFriendly: true,
    helperFriendly: true,
    haterFriendly: true,
    negotiationOnly: false,
    queueOnly: false,
  }),
  LOBBY_QUEUE: Object.freeze({
    sceneState: 'QUEUE' as const,
    cooldownFactor: 0.92,
    priorityBias: 0.48,
    witnessRequired: false,
    ambientFriendly: true,
    helperFriendly: false,
    haterFriendly: false,
    negotiationOnly: false,
    queueOnly: true,
  }),
  PLAYER_IDLE: Object.freeze({
    sceneState: 'MIDRUN' as const,
    cooldownFactor: 1.05,
    priorityBias: 0.44,
    witnessRequired: false,
    ambientFriendly: true,
    helperFriendly: true,
    haterFriendly: true,
    negotiationOnly: false,
    queueOnly: false,
  }),
  PLAYER_INCOME_UP: Object.freeze({
    sceneState: 'MIDRUN' as const,
    cooldownFactor: 0.96,
    priorityBias: 0.68,
    witnessRequired: false,
    ambientFriendly: true,
    helperFriendly: true,
    haterFriendly: true,
    negotiationOnly: false,
    queueOnly: false,
  }),
  PLAYER_SHIELD_BREAK: Object.freeze({
    sceneState: 'BREACH' as const,
    cooldownFactor: 0.64,
    priorityBias: 0.96,
    witnessRequired: true,
    ambientFriendly: true,
    helperFriendly: true,
    haterFriendly: true,
    negotiationOnly: false,
    queueOnly: false,
  }),
  PLAYER_COMEBACK: Object.freeze({
    sceneState: 'RECOVERY' as const,
    cooldownFactor: 0.78,
    priorityBias: 0.90,
    witnessRequired: true,
    ambientFriendly: true,
    helperFriendly: true,
    haterFriendly: true,
    negotiationOnly: false,
    queueOnly: false,
  }),
  PLAYER_LOST: Object.freeze({
    sceneState: 'POSTRUN' as const,
    cooldownFactor: 0.70,
    priorityBias: 0.95,
    witnessRequired: true,
    ambientFriendly: true,
    helperFriendly: true,
    haterFriendly: false,
    negotiationOnly: false,
    queueOnly: false,
  }),
  NEAR_SOVEREIGNTY: Object.freeze({
    sceneState: 'ENDGAME' as const,
    cooldownFactor: 0.66,
    priorityBias: 0.98,
    witnessRequired: true,
    ambientFriendly: true,
    helperFriendly: true,
    haterFriendly: true,
    negotiationOnly: false,
    queueOnly: false,
  }),
  TIME_PRESSURE: Object.freeze({
    sceneState: 'PRESSURE' as const,
    cooldownFactor: 0.74,
    priorityBias: 0.84,
    witnessRequired: false,
    ambientFriendly: true,
    helperFriendly: true,
    haterFriendly: true,
    negotiationOnly: false,
    queueOnly: false,
  }),
  CASCADE_CHAIN: Object.freeze({
    sceneState: 'PRESSURE' as const,
    cooldownFactor: 0.72,
    priorityBias: 0.88,
    witnessRequired: false,
    ambientFriendly: true,
    helperFriendly: true,
    haterFriendly: true,
    negotiationOnly: false,
    queueOnly: false,
  }),
  DEAL_ROOM_OFFER: Object.freeze({
    sceneState: 'NEGOTIATION' as const,
    cooldownFactor: 0.82,
    priorityBias: 0.78,
    witnessRequired: false,
    ambientFriendly: true,
    helperFriendly: false,
    haterFriendly: false,
    negotiationOnly: true,
    queueOnly: false,
  }),
  DEAL_ROOM_STALL: Object.freeze({
    sceneState: 'NEGOTIATION' as const,
    cooldownFactor: 1.18,
    priorityBias: 0.60,
    witnessRequired: false,
    ambientFriendly: true,
    helperFriendly: true,
    haterFriendly: false,
    negotiationOnly: true,
    queueOnly: false,
  }),
  SYNDICATE_JOIN: Object.freeze({
    sceneState: 'MIDRUN' as const,
    cooldownFactor: 1.12,
    priorityBias: 0.52,
    witnessRequired: false,
    ambientFriendly: true,
    helperFriendly: false,
    haterFriendly: false,
    negotiationOnly: false,
    queueOnly: false,
  }),
  ATTACK_DEFLECTED: Object.freeze({
    sceneState: 'RECOVERY' as const,
    cooldownFactor: 0.76,
    priorityBias: 0.86,
    witnessRequired: false,
    ambientFriendly: true,
    helperFriendly: true,
    haterFriendly: false,
    negotiationOnly: false,
    queueOnly: false,
  }),
  BOT_WINNING: Object.freeze({
    sceneState: 'PRESSURE' as const,
    cooldownFactor: 0.86,
    priorityBias: 0.80,
    witnessRequired: false,
    ambientFriendly: false,
    helperFriendly: true,
    haterFriendly: true,
    negotiationOnly: false,
    queueOnly: false,
  }),
  BOT_DEFEATED: Object.freeze({
    sceneState: 'RECOVERY' as const,
    cooldownFactor: 0.90,
    priorityBias: 0.74,
    witnessRequired: false,
    ambientFriendly: true,
    helperFriendly: true,
    haterFriendly: true,
    negotiationOnly: false,
    queueOnly: false,
  }),
  PLAYER_RESPONSE_ANGRY: Object.freeze({
    sceneState: 'PRESSURE' as const,
    cooldownFactor: 0.92,
    priorityBias: 0.72,
    witnessRequired: false,
    ambientFriendly: false,
    helperFriendly: true,
    haterFriendly: true,
    negotiationOnly: false,
    queueOnly: false,
  }),
  PLAYER_RESPONSE_TROLL: Object.freeze({
    sceneState: 'MIDRUN' as const,
    cooldownFactor: 1.00,
    priorityBias: 0.48,
    witnessRequired: false,
    ambientFriendly: false,
    helperFriendly: false,
    haterFriendly: true,
    negotiationOnly: false,
    queueOnly: false,
  }),
  PLAYER_RESPONSE_FLEX: Object.freeze({
    sceneState: 'MIDRUN' as const,
    cooldownFactor: 0.98,
    priorityBias: 0.56,
    witnessRequired: false,
    ambientFriendly: false,
    helperFriendly: true,
    haterFriendly: true,
    negotiationOnly: false,
    queueOnly: false,
  }),
  INVASION_OPEN: Object.freeze({
    sceneState: 'INVASION' as const,
    cooldownFactor: 0.58,
    priorityBias: 1.00,
    witnessRequired: true,
    ambientFriendly: false,
    helperFriendly: false,
    haterFriendly: true,
    negotiationOnly: false,
    queueOnly: false,
  }),
  INVASION_CLOSE: Object.freeze({
    sceneState: 'INVASION' as const,
    cooldownFactor: 0.80,
    priorityBias: 0.90,
    witnessRequired: true,
    ambientFriendly: false,
    helperFriendly: true,
    haterFriendly: false,
    negotiationOnly: false,
    queueOnly: false,
  }),
  POSTRUN_DEBRIEF: Object.freeze({
    sceneState: 'POSTRUN' as const,
    cooldownFactor: 1.00,
    priorityBias: 0.84,
    witnessRequired: true,
    ambientFriendly: true,
    helperFriendly: true,
    haterFriendly: false,
    negotiationOnly: false,
    queueOnly: false,
  }),
  POSTRUN_MOURN: Object.freeze({
    sceneState: 'POSTRUN' as const,
    cooldownFactor: 1.08,
    priorityBias: 0.78,
    witnessRequired: true,
    ambientFriendly: true,
    helperFriendly: true,
    haterFriendly: false,
    negotiationOnly: false,
    queueOnly: false,
  }),
  POSTRUN_CELEBRATE: Object.freeze({
    sceneState: 'POSTRUN' as const,
    cooldownFactor: 0.94,
    priorityBias: 0.86,
    witnessRequired: true,
    ambientFriendly: true,
    helperFriendly: true,
    haterFriendly: false,
    negotiationOnly: false,
    queueOnly: false,
  }),
  DEAL_CONFIRM: Object.freeze({
    sceneState: 'NEGOTIATION' as const,
    cooldownFactor: 0.88,
    priorityBias: 0.72,
    witnessRequired: false,
    ambientFriendly: true,
    helperFriendly: false,
    haterFriendly: false,
    negotiationOnly: true,
    queueOnly: false,
  }),
  DEAL_RETRACT: Object.freeze({
    sceneState: 'NEGOTIATION' as const,
    cooldownFactor: 1.02,
    priorityBias: 0.74,
    witnessRequired: false,
    ambientFriendly: true,
    helperFriendly: true,
    haterFriendly: false,
    negotiationOnly: true,
    queueOnly: false,
  }),
} as const satisfies Record<string, ContextProfile>);

const MODE_MODIFIERS = Object.freeze([
  Object.freeze({
    modeMatch: Object.freeze(['battle', 'run', 'phantom', 'predator', 'empire']),
    channelBias: Object.freeze({ GLOBAL: 1.00, SYNDICATE: 0.88, DEAL_ROOM: 0.72, LOBBY: 0.58, SYSTEM_SHADOW: 1.00, NPC_SHADOW: 1.00 }),
    ambientScale: 0.95,
    helperScale: 1.00,
    haterScale: 1.08,
    silenceScale: 0.94,
  }),
  Object.freeze({
    modeMatch: Object.freeze(['syndicate', 'league']),
    channelBias: Object.freeze({ GLOBAL: 0.82, SYNDICATE: 1.10, DEAL_ROOM: 0.86, LOBBY: 0.62, SYSTEM_SHADOW: 1.05, NPC_SHADOW: 1.05 }),
    ambientScale: 0.82,
    helperScale: 0.94,
    haterScale: 0.72,
    silenceScale: 1.12,
  }),
  Object.freeze({
    modeMatch: Object.freeze(['deal', 'war-room', 'negotiation']),
    channelBias: Object.freeze({ GLOBAL: 0.66, SYNDICATE: 0.92, DEAL_ROOM: 1.18, LOBBY: 0.48, SYSTEM_SHADOW: 1.10, NPC_SHADOW: 1.10 }),
    ambientScale: 0.68,
    helperScale: 0.76,
    haterScale: 0.56,
    silenceScale: 1.20,
  }),
  Object.freeze({
    modeMatch: Object.freeze(['lobby', 'queue']),
    channelBias: Object.freeze({ GLOBAL: 0.90, SYNDICATE: 0.62, DEAL_ROOM: 0.44, LOBBY: 1.16, SYSTEM_SHADOW: 0.92, NPC_SHADOW: 0.92 }),
    ambientScale: 1.12,
    helperScale: 0.72,
    haterScale: 0.52,
    silenceScale: 0.84,
  }),
] as const satisfies readonly ModeModifier[]);

const PRIORITY_CLASS = Object.freeze({
  witness: 1.00,
  recovery: 0.86,
  threat: 0.84,
  atmospheric: 0.46,
  queue: 0.32,
  negotiation: 0.64,
  postrun: 0.72,
});

const CHANNELS: readonly CadenceChannel[] = Object.freeze([
  'GLOBAL',
  'SYNDICATE',
  'DEAL_ROOM',
  'LOBBY',
  'SYSTEM_SHADOW',
  'NPC_SHADOW',
]);

const KINDS: readonly NpcActorKind[] = Object.freeze([
  'AMBIENT',
  'HELPER',
  'HATER',
  'INVASION',
]);

const clamp01 = (value: number | undefined): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
};

const coalesce = (value: number | undefined, fallback: number): number => (
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
);

const actorKeyOf = (request: NpcCadenceRequest): string => `${request.actorKind}:${request.actorId}`;

const recordCountWithinWindow = (
  records: readonly CadenceEmissionRecord[],
  nowMs: number,
  predicate: (record: CadenceEmissionRecord) => boolean,
  windowMs = 60_000,
): number => {
  let count = 0;
  for (const record of records) {
    if (nowMs - record.emittedAtMs > windowMs) continue;
    if (predicate(record)) count += 1;
  }
  return count;
};

const resolveModeModifier = (modeId: string): ModeModifier | null => {
  const normalized = modeId.toLowerCase();
  for (const modifier of MODE_MODIFIERS) {
    if (modifier.modeMatch.some((match) => normalized.includes(match))) return modifier;
  }
  return null;
};

const resolveContextProfile = (context: CadenceContext): ContextProfile => {
  return CONTEXT_PROFILES[context] ?? Object.freeze({
    sceneState: 'MIDRUN' as const,
    cooldownFactor: 1,
    priorityBias: 0.5,
    witnessRequired: false,
    ambientFriendly: true,
    helperFriendly: true,
    haterFriendly: true,
    negotiationOnly: false,
    queueOnly: false,
  });
};

const buildEmptyKindRecord = <T>(factory: () => T): Record<NpcActorKind, T> => ({
  AMBIENT: factory(),
  HELPER: factory(),
  HATER: factory(),
  INVASION: factory(),
});

const buildEmptyChannelRecord = <T>(factory: () => T): Record<CadenceChannel, T> => ({
  GLOBAL: factory(),
  SYNDICATE: factory(),
  DEAL_ROOM: factory(),
  LOBBY: factory(),
  SYSTEM_SHADOW: factory(),
  NPC_SHADOW: factory(),
});

const createEmptyLedger = (): CadenceLedger => Object.freeze({
  lastEmissionAtByActor: Object.freeze({}),
  lastEmissionAtByChannel: Object.freeze(buildEmptyChannelRecord(() => 0)),
  lastEmissionAtByKind: Object.freeze(buildEmptyKindRecord(() => 0)),
  recentEmissionLog: Object.freeze([]),
  suppressionCountsByActor: Object.freeze({}),
});

const defaultChannelOccupancy = (room: RoomCadenceSnapshot, channel: CadenceChannel): number => {
  return room.channelOccupancy?.[channel] ?? room.occupancy;
};

const deriveSceneState = (room: RoomCadenceSnapshot, request: NpcCadenceRequest, contextProfile: ContextProfile): CadenceSceneState => {
  if (room.invasionActive || request.context === 'INVASION_OPEN' || request.context === 'INVASION_CLOSE') return 'INVASION';
  if (room.postRun || contextProfile.sceneState === 'POSTRUN') return 'POSTRUN';
  if (contextProfile.queueOnly || request.channel === 'LOBBY' && room.runTick <= 0) return 'QUEUE';
  if (contextProfile.negotiationOnly || request.channel === 'DEAL_ROOM') return 'NEGOTIATION';
  if (room.nearSovereignty || contextProfile.sceneState === 'ENDGAME') return 'ENDGAME';
  if (room.shieldBreached || contextProfile.sceneState === 'BREACH') return 'BREACH';
  if (room.pressure >= 0.72 || contextProfile.sceneState === 'PRESSURE') return 'PRESSURE';
  if (room.frustration >= 0.55 || contextProfile.sceneState === 'RECOVERY') return 'RECOVERY';
  if (room.runTick <= 50 || contextProfile.sceneState === 'OPENING') return 'OPENING';
  return 'MIDRUN';
};

const resolveActorExists = (request: NpcCadenceRequest): boolean => {
  switch (request.actorKind) {
    case 'AMBIENT':
      return typeof request.personaId === 'string' && ambientNpcRegistry.hasPersona(request.personaId);
    case 'HELPER':
      return typeof request.personaId === 'string' && helperDialogueRegistry.hasPersona(request.personaId);
    case 'HATER':
      return typeof request.personaId === 'string' && haterDialogueRegistry.hasPersona(request.personaId);
    case 'INVASION':
      return true;
    default:
      return false;
  }
};

const actorChannelIdentityScore = (request: NpcCadenceRequest): number => {
  switch (request.actorKind) {
    case 'AMBIENT': {
      if (typeof request.personaId !== 'string' || !ambientNpcRegistry.hasPersona(request.personaId)) return 0;
      const profile = ambientNpcRegistry.getProfile(request.personaId);
      return profile.channelAffinity === request.channel ? 1 : 0.2;
    }
    case 'HELPER': {
      if (typeof request.personaId !== 'string' || !helperDialogueRegistry.hasPersona(request.personaId)) return 0;
      const profile = helperDialogueRegistry.getProfile(request.personaId);
      return profile.channelAffinity === request.channel ? 1 : 0.45;
    }
    case 'HATER': {
      if (typeof request.personaId !== 'string' || !haterDialogueRegistry.hasPersona(request.personaId)) return 0;
      const profile = haterDialogueRegistry.getProfile(request.personaId);
      return profile.channelAffinity === request.channel ? 1 : 0.35;
    }
    case 'INVASION':
      return 1;
    default:
      return 0;
  }
};

const derivePriorityClass = (request: NpcCadenceRequest, room: RoomCadenceSnapshot, contextProfile: ContextProfile): number => {
  if (contextProfile.witnessRequired) return PRIORITY_CLASS.witness;
  if (room.postRun || contextProfile.sceneState === 'POSTRUN') return PRIORITY_CLASS.postrun;
  if (contextProfile.sceneState === 'NEGOTIATION') return PRIORITY_CLASS.negotiation;
  if (request.actorKind === 'HATER' || request.actorKind === 'INVASION') return PRIORITY_CLASS.threat;
  if (request.actorKind === 'HELPER') return PRIORITY_CLASS.recovery;
  if (contextProfile.sceneState === 'QUEUE') return PRIORITY_CLASS.queue;
  return PRIORITY_CLASS.atmospheric;
};

const isContextAllowedForKind = (kind: NpcActorKind, contextProfile: ContextProfile): boolean => {
  if (kind === 'AMBIENT') return contextProfile.ambientFriendly;
  if (kind === 'HELPER') return contextProfile.helperFriendly;
  if (kind === 'HATER') return contextProfile.haterFriendly;
  return true;
};

const computeSilencePreference = (
  request: NpcCadenceRequest,
  room: RoomCadenceSnapshot,
  channelProfile: ChannelProfile,
  kindBaseline: KindBaseline,
  contextProfile: ContextProfile,
): number => {
  const silenceDebt = clamp01(room.silenceDebt);
  const timeSincePlayerMs = request.desiredAtMs - coalesce(room.lastPlayerMessageAtMs, request.desiredAtMs - 60_000);
  const immediateAfterPlayer = timeSincePlayerMs <= 2_500;
  const immediateAfterEvent = request.desiredAtMs - coalesce(room.lastIncomingSystemEventAtMs, 0) <= 2_000;

  let preference = channelProfile.prefersSilence ? 0.20 : 0;
  preference += kindBaseline.silenceRespect * 0.25;
  preference += contextProfile.sceneState === 'NEGOTIATION' ? 0.30 : 0;
  preference += contextProfile.sceneState === 'QUEUE' ? 0.10 : 0;
  preference += request.actorKind === 'AMBIENT' ? 0.18 : 0;
  preference -= request.actorKind === 'HATER' ? 0.24 : 0;
  preference -= request.force ? 0.35 : 0;
  preference -= silenceDebt * 0.28;
  preference -= immediateAfterEvent && contextProfile.witnessRequired ? 0.26 : 0;
  preference += immediateAfterPlayer && request.actorKind === 'AMBIENT' ? 0.14 : 0;
  preference += room.dealStalled && request.channel === 'DEAL_ROOM' ? 0.18 : 0;
  return preference;
};

const computeEffectiveCooldownMs = (
  request: NpcCadenceRequest,
  room: RoomCadenceSnapshot,
  channelProfile: ChannelProfile,
  kindBaseline: KindBaseline,
  contextProfile: ContextProfile,
  modeModifier: ModeModifier | null,
): number => {
  const pressure = clamp01(room.pressure);
  const heat = clamp01(room.heat);
  const frustration = clamp01(room.frustration);
  const coldStart = clamp01(room.coldStart);
  const silenceDebt = clamp01(room.silenceDebt);

  let cooldown = Math.max(request.lineCadenceFloorMs, kindBaseline.minGapMs, channelProfile.minGapMs);
  cooldown *= contextProfile.cooldownFactor;

  if (request.actorKind === 'AMBIENT') {
    cooldown *= 1 + (pressure * 0.35);
    cooldown *= 1 + (heat * 0.12);
    cooldown *= 1 + (channelProfile.prefersSilence ? 0.16 : 0);
    cooldown *= 1 - (silenceDebt * 0.20);
    cooldown *= room.dealStalled && request.channel === 'DEAL_ROOM' ? 1.12 : 1;
    cooldown *= contextProfile.witnessRequired ? 0.72 : 1;
  }

  if (request.actorKind === 'HELPER') {
    cooldown *= 1 - (frustration * 0.24);
    cooldown *= 1 - (coldStart * 0.10);
    cooldown *= room.playerNearBankruptcy ? 0.78 : 1;
    cooldown *= room.helperLock ? 1.18 : 1;
    cooldown *= room.invasionActive ? 1.20 : 1;
  }

  if (request.actorKind === 'HATER') {
    cooldown *= 1 - (heat * 0.18);
    cooldown *= 1 - (pressure * 0.16);
    cooldown *= room.nearSovereignty ? 0.84 : 1;
    cooldown *= room.postRun ? 1.60 : 1;
    cooldown *= request.channel === 'DEAL_ROOM' ? 1.25 : 1;
    cooldown *= request.channel === 'LOBBY' ? 1.18 : 1;
  }

  if (request.actorKind === 'INVASION') {
    cooldown *= 0.74;
    cooldown *= room.invasionActive ? 1.35 : 1;
  }

  if (modeModifier) {
    if (request.actorKind === 'AMBIENT') cooldown *= 1 / modeModifier.ambientScale;
    if (request.actorKind === 'HELPER') cooldown *= 1 / modeModifier.helperScale;
    if (request.actorKind === 'HATER') cooldown *= 1 / modeModifier.haterScale;
    cooldown *= modeModifier.silenceScale;
  }

  return Math.max(1_800, Math.round(cooldown));
};

const computePriorityScore = (
  request: NpcCadenceRequest,
  room: RoomCadenceSnapshot,
  channelProfile: ChannelProfile,
  kindBaseline: KindBaseline,
  contextProfile: ContextProfile,
  modeModifier: ModeModifier | null,
): number => {
  const pressure = clamp01(room.pressure);
  const heat = clamp01(room.heat);
  const frustration = clamp01(room.frustration);
  const confidence = clamp01(room.confidence);
  const silenceDebt = clamp01(room.silenceDebt);

  let score = derivePriorityClass(request, room, contextProfile);
  score += contextProfile.priorityBias;
  score += request.priorityHint ?? 0;
  score += kindBaseline.sceneAggression * 0.22;
  score += channelProfile.identityBias * 0.12;
  score += request.force ? 0.65 : 0;
  score += contextProfile.witnessRequired ? 0.50 : 0;
  score += room.nearSovereignty && request.context === 'NEAR_SOVEREIGNTY' ? 0.40 : 0;
  score += room.shieldBreached && request.context === 'PLAYER_SHIELD_BREAK' ? 0.36 : 0;
  score += room.postRun && (request.context === 'POSTRUN_DEBRIEF' || request.context === 'POSTRUN_MOURN' || request.context === 'POSTRUN_CELEBRATE') ? 0.34 : 0;
  score += request.actorKind === 'HATER' ? (pressure * 0.22) + (heat * 0.16) : 0;
  score += request.actorKind === 'HELPER' ? (frustration * 0.24) + ((1 - confidence) * 0.10) : 0;
  score += request.actorKind === 'AMBIENT' ? (silenceDebt * 0.18) : 0;
  score += request.channel === 'DEAL_ROOM' && contextProfile.sceneState === 'NEGOTIATION' ? 0.18 : 0;
  score += request.channel === 'SYNDICATE' && request.actorKind === 'AMBIENT' ? -0.12 : 0;

  if (modeModifier) {
    score += (modeModifier.channelBias[request.channel] ?? 1) * 0.10;
  }

  return Number(score.toFixed(6));
};

const computeBudgetCost = (
  request: NpcCadenceRequest,
  channelProfile: ChannelProfile,
  kindBaseline: KindBaseline,
  contextProfile: ContextProfile,
): number => {
  let cost = kindBaseline.budgetCost;
  cost += contextProfile.witnessRequired ? 1 : 0;
  cost += request.channel === 'DEAL_ROOM' && contextProfile.sceneState === 'NEGOTIATION' ? 1 : 0;
  cost += request.actorKind === 'INVASION' ? 2 : 0;
  cost += channelProfile.prefersSilence && request.actorKind === 'AMBIENT' ? 1 : 0;
  return cost;
};

const shouldShadowOnly = (
  request: NpcCadenceRequest,
  room: RoomCadenceSnapshot,
  contextProfile: ContextProfile,
): boolean => {
  if (request.channel === 'SYSTEM_SHADOW' || request.channel === 'NPC_SHADOW') return true;
  if (request.shadowPreferred && request.actorKind === 'AMBIENT') return true;
  if (request.context === 'DEAL_ROOM_STALL' && room.dealStalled && request.actorKind === 'AMBIENT') return true;
  if (request.context === 'SYNDICATE_JOIN' && request.channel === 'SYNDICATE' && request.actorKind === 'AMBIENT') return true;
  if (contextProfile.sceneState === 'NEGOTIATION' && request.actorKind === 'AMBIENT' && room.silenceDebt < 0.45) return true;
  return false;
};

const trimRecentLog = (records: readonly CadenceEmissionRecord[], nowMs: number, windowMs = 90_000): readonly CadenceEmissionRecord[] => {
  return Object.freeze(records.filter((record) => nowMs - record.emittedAtMs <= windowMs));
};

export class NpcCadencePolicy {
  public createEmptyLedger(): CadenceLedger {
    return createEmptyLedger();
  }

  public listKnownAmbientPersonas(): readonly AmbientNpcPersonaId[] {
    return ambientNpcRegistry.listPersonaIds();
  }

  public listKnownHelperPersonas(): readonly HelperPersonaId[] {
    return helperDialogueRegistry.listPersonaIds();
  }

  public listKnownHaterPersonas(): readonly HaterRegistryPersonaId[] {
    return haterDialogueRegistry.listPersonaIds();
  }

  public evaluate(request: NpcCadenceRequest, room: RoomCadenceSnapshot, ledger: CadenceLedger): NpcCadenceDecision {
    const diagnostics: string[] = [];
    const actorKey = actorKeyOf(request);

    if (!resolveActorExists(request)) {
      diagnostics.push('actor not recognized by canonical registry');
      return Object.freeze({
        allow: false,
        actorKey,
        actorKind: request.actorKind,
        channel: request.channel,
        context: request.context,
        sceneState: 'MIDRUN',
        suppressionReason: 'UNKNOWN_ACTOR',
        nextAllowedAtMs: request.desiredAtMs,
        effectiveCooldownMs: request.lineCadenceFloorMs,
        priorityScore: 0,
        budgetCost: 0,
        shadowOnly: false,
        witnessRequired: false,
        diagnostics: Object.freeze(diagnostics),
      });
    }

    const channelProfile = CHANNEL_PROFILES[request.channel];
    if (!channelProfile) {
      diagnostics.push('channel missing from policy profiles');
      return Object.freeze({
        allow: false,
        actorKey,
        actorKind: request.actorKind,
        channel: request.channel,
        context: request.context,
        sceneState: 'MIDRUN',
        suppressionReason: 'UNKNOWN_CHANNEL',
        nextAllowedAtMs: request.desiredAtMs,
        effectiveCooldownMs: request.lineCadenceFloorMs,
        priorityScore: 0,
        budgetCost: 0,
        shadowOnly: false,
        witnessRequired: false,
        diagnostics: Object.freeze(diagnostics),
      });
    }

    if (!channelProfile.enabled && !request.force) {
      diagnostics.push('channel disabled by runtime policy');
      return Object.freeze({
        allow: false,
        actorKey,
        actorKind: request.actorKind,
        channel: request.channel,
        context: request.context,
        sceneState: 'MIDRUN',
        suppressionReason: 'CHANNEL_DISABLED',
        nextAllowedAtMs: request.desiredAtMs,
        effectiveCooldownMs: request.lineCadenceFloorMs,
        priorityScore: 0,
        budgetCost: 0,
        shadowOnly: false,
        witnessRequired: false,
        diagnostics: Object.freeze(diagnostics),
      });
    }

    const contextProfile = resolveContextProfile(request.context);
    const modeModifier = resolveModeModifier(room.modeId);
    const kindBaseline = KIND_BASELINES[request.actorKind];
    const sceneState = deriveSceneState(room, request, contextProfile);
    const shadowOnly = shouldShadowOnly(request, room, contextProfile);
    const witnessRequired = contextProfile.witnessRequired;
    const identityScore = actorChannelIdentityScore(request);

    diagnostics.push(`scene=${sceneState}`);
    diagnostics.push(`identityScore=${identityScore.toFixed(2)}`);

    if (identityScore < 0.25 && !request.force) {
      diagnostics.push('actor does not fit channel identity strongly enough');
      return Object.freeze({
        allow: false,
        actorKey,
        actorKind: request.actorKind,
        channel: request.channel,
        context: request.context,
        sceneState,
        suppressionReason: 'CHANNEL_IDENTITY_MISMATCH',
        nextAllowedAtMs: request.desiredAtMs,
        effectiveCooldownMs: request.lineCadenceFloorMs,
        priorityScore: 0,
        budgetCost: 0,
        shadowOnly,
        witnessRequired,
        diagnostics: Object.freeze(diagnostics),
      });
    }

    if (!isContextAllowedForKind(request.actorKind, contextProfile) && !request.force) {
      diagnostics.push('context profile rejects this actor kind');
      return Object.freeze({
        allow: false,
        actorKey,
        actorKind: request.actorKind,
        channel: request.channel,
        context: request.context,
        sceneState,
        suppressionReason: 'INCOMPATIBLE_SCENE',
        nextAllowedAtMs: request.desiredAtMs,
        effectiveCooldownMs: request.lineCadenceFloorMs,
        priorityScore: 0,
        budgetCost: 0,
        shadowOnly,
        witnessRequired,
        diagnostics: Object.freeze(diagnostics),
      });
    }

    if (contextProfile.negotiationOnly && request.channel !== 'DEAL_ROOM' && request.channel !== 'SYSTEM_SHADOW' && request.channel !== 'NPC_SHADOW' && !request.force) {
      diagnostics.push('context reserved for negotiation rooms');
      return Object.freeze({
        allow: false,
        actorKey,
        actorKind: request.actorKind,
        channel: request.channel,
        context: request.context,
        sceneState,
        suppressionReason: 'INCOMPATIBLE_MODE',
        nextAllowedAtMs: request.desiredAtMs,
        effectiveCooldownMs: request.lineCadenceFloorMs,
        priorityScore: 0,
        budgetCost: 0,
        shadowOnly,
        witnessRequired,
        diagnostics: Object.freeze(diagnostics),
      });
    }

    if (contextProfile.queueOnly && sceneState !== 'QUEUE' && !request.force) {
      diagnostics.push('queue-only line rejected outside queue scene');
      return Object.freeze({
        allow: false,
        actorKey,
        actorKind: request.actorKind,
        channel: request.channel,
        context: request.context,
        sceneState,
        suppressionReason: 'INCOMPATIBLE_SCENE',
        nextAllowedAtMs: request.desiredAtMs,
        effectiveCooldownMs: request.lineCadenceFloorMs,
        priorityScore: 0,
        budgetCost: 0,
        shadowOnly,
        witnessRequired,
        diagnostics: Object.freeze(diagnostics),
      });
    }

    const channelOccupancy = defaultChannelOccupancy(room, request.channel);
    if (request.actorKind === 'AMBIENT' && request.channel !== 'SYSTEM_SHADOW' && request.channel !== 'NPC_SHADOW') {
      const requiredOccupancy = request.personaId && ambientNpcRegistry.hasPersona(request.personaId)
        ? ambientNpcRegistry.getProfile(request.personaId).occupancyFloor
        : 1;
      diagnostics.push(`channelOccupancy=${channelOccupancy}`);
      diagnostics.push(`requiredOccupancy=${requiredOccupancy}`);
      if (channelOccupancy < requiredOccupancy && !request.force) {
        return Object.freeze({
          allow: false,
          actorKey,
          actorKind: request.actorKind,
          channel: request.channel,
          context: request.context,
          sceneState,
          suppressionReason: 'ROOM_TOO_EMPTY',
          nextAllowedAtMs: request.desiredAtMs,
          effectiveCooldownMs: request.lineCadenceFloorMs,
          priorityScore: 0,
          budgetCost: 0,
          shadowOnly,
          witnessRequired,
          diagnostics: Object.freeze(diagnostics),
        });
      }
    }

    const silencePreference = computeSilencePreference(request, room, channelProfile, kindBaseline, contextProfile);
    diagnostics.push(`silencePreference=${silencePreference.toFixed(2)}`);

    if (request.actorKind === 'AMBIENT' && room.pressure >= 0.82 && !contextProfile.witnessRequired && !request.force) {
      diagnostics.push('ambient suppressed because pressure is too high for non-witness chatter');
      return Object.freeze({
        allow: false,
        actorKey,
        actorKind: request.actorKind,
        channel: request.channel,
        context: request.context,
        sceneState,
        suppressionReason: 'ROOM_TOO_HOT_FOR_AMBIENT',
        nextAllowedAtMs: request.desiredAtMs,
        effectiveCooldownMs: request.lineCadenceFloorMs,
        priorityScore: 0,
        budgetCost: 0,
        shadowOnly,
        witnessRequired,
        diagnostics: Object.freeze(diagnostics),
      });
    }

    if (silencePreference >= 0.82 && !contextProfile.witnessRequired && !request.force) {
      diagnostics.push('policy prefers silence over new speech in current room state');
      return Object.freeze({
        allow: false,
        actorKey,
        actorKind: request.actorKind,
        channel: request.channel,
        context: request.context,
        sceneState,
        suppressionReason: shadowOnly ? 'SHADOW_ONLY' : 'SILENCE_PREFERRED',
        nextAllowedAtMs: request.desiredAtMs,
        effectiveCooldownMs: request.lineCadenceFloorMs,
        priorityScore: 0,
        budgetCost: 0,
        shadowOnly,
        witnessRequired,
        diagnostics: Object.freeze(diagnostics),
      });
    }

    if (room.invasionActive && request.actorKind === 'AMBIENT' && !contextProfile.witnessRequired && !request.force) {
      diagnostics.push('ambient traffic locked while invasion is active');
      return Object.freeze({
        allow: false,
        actorKey,
        actorKind: request.actorKind,
        channel: request.channel,
        context: request.context,
        sceneState,
        suppressionReason: 'INVASION_LOCK',
        nextAllowedAtMs: request.desiredAtMs,
        effectiveCooldownMs: request.lineCadenceFloorMs,
        priorityScore: 0,
        budgetCost: 0,
        shadowOnly,
        witnessRequired,
        diagnostics: Object.freeze(diagnostics),
      });
    }

    if (request.channel === 'SYNDICATE' && request.actorKind === 'AMBIENT' && silencePreference >= 0.60 && !contextProfile.witnessRequired && !request.force) {
      diagnostics.push('syndicate channel prefers restraint over ambient speech');
      return Object.freeze({
        allow: false,
        actorKey,
        actorKind: request.actorKind,
        channel: request.channel,
        context: request.context,
        sceneState,
        suppressionReason: 'SYNDICATE_RESTRAINT',
        nextAllowedAtMs: request.desiredAtMs,
        effectiveCooldownMs: request.lineCadenceFloorMs,
        priorityScore: 0,
        budgetCost: 0,
        shadowOnly,
        witnessRequired,
        diagnostics: Object.freeze(diagnostics),
      });
    }

    if (request.channel === 'DEAL_ROOM' && request.actorKind !== 'INVASION' && silencePreference >= 0.72 && !contextProfile.witnessRequired && !request.force) {
      diagnostics.push('deal room protects negotiation silence');
      return Object.freeze({
        allow: false,
        actorKey,
        actorKind: request.actorKind,
        channel: request.channel,
        context: request.context,
        sceneState,
        suppressionReason: 'DEAL_ROOM_RESTRAINT',
        nextAllowedAtMs: request.desiredAtMs,
        effectiveCooldownMs: request.lineCadenceFloorMs,
        priorityScore: 0,
        budgetCost: 0,
        shadowOnly,
        witnessRequired,
        diagnostics: Object.freeze(diagnostics),
      });
    }

    if (request.channel === 'LOBBY' && request.actorKind === 'HATER' && !request.force) {
      diagnostics.push('lobby lane suppresses most hater traffic until authoritative play begins');
      return Object.freeze({
        allow: false,
        actorKey,
        actorKind: request.actorKind,
        channel: request.channel,
        context: request.context,
        sceneState,
        suppressionReason: 'LOBBY_RESTRAINT',
        nextAllowedAtMs: request.desiredAtMs,
        effectiveCooldownMs: request.lineCadenceFloorMs,
        priorityScore: 0,
        budgetCost: 0,
        shadowOnly,
        witnessRequired,
        diagnostics: Object.freeze(diagnostics),
      });
    }

    if (room.helperLock && request.actorKind === 'HELPER' && !request.force) {
      diagnostics.push('helper lock active; preserve current rescue lane');
      return Object.freeze({
        allow: false,
        actorKey,
        actorKind: request.actorKind,
        channel: request.channel,
        context: request.context,
        sceneState,
        suppressionReason: 'HELPER_WINDOW_RESERVED',
        nextAllowedAtMs: request.desiredAtMs,
        effectiveCooldownMs: request.lineCadenceFloorMs,
        priorityScore: 0,
        budgetCost: 0,
        shadowOnly,
        witnessRequired,
        diagnostics: Object.freeze(diagnostics),
      });
    }

    const effectiveCooldownMs = computeEffectiveCooldownMs(request, room, channelProfile, kindBaseline, contextProfile, modeModifier);
    const nextActorAllowedAtMs = (ledger.lastEmissionAtByActor[actorKey] ?? 0) + effectiveCooldownMs;
    const nextChannelAllowedAtMs = (ledger.lastEmissionAtByChannel[request.channel] ?? 0) + Math.max(channelProfile.minGapMs, Math.round(effectiveCooldownMs * 0.35));
    const nextKindAllowedAtMs = (ledger.lastEmissionAtByKind[request.actorKind] ?? 0) + kindBaseline.kindGapMs;

    diagnostics.push(`effectiveCooldownMs=${effectiveCooldownMs}`);
    diagnostics.push(`nextActorAllowedAtMs=${nextActorAllowedAtMs}`);
    diagnostics.push(`nextChannelAllowedAtMs=${nextChannelAllowedAtMs}`);
    diagnostics.push(`nextKindAllowedAtMs=${nextKindAllowedAtMs}`);

    const nowMs = request.desiredAtMs;
    if (nowMs < nextActorAllowedAtMs && !request.force) {
      return Object.freeze({
        allow: false,
        actorKey,
        actorKind: request.actorKind,
        channel: request.channel,
        context: request.context,
        sceneState,
        suppressionReason: 'ACTOR_COOLDOWN',
        nextAllowedAtMs: nextActorAllowedAtMs,
        effectiveCooldownMs,
        priorityScore: 0,
        budgetCost: 0,
        shadowOnly,
        witnessRequired,
        diagnostics: Object.freeze(diagnostics),
      });
    }

    if (nowMs < nextChannelAllowedAtMs && !request.force) {
      return Object.freeze({
        allow: false,
        actorKey,
        actorKind: request.actorKind,
        channel: request.channel,
        context: request.context,
        sceneState,
        suppressionReason: 'CHANNEL_COOLDOWN',
        nextAllowedAtMs: nextChannelAllowedAtMs,
        effectiveCooldownMs,
        priorityScore: 0,
        budgetCost: 0,
        shadowOnly,
        witnessRequired,
        diagnostics: Object.freeze(diagnostics),
      });
    }

    if (nowMs < nextKindAllowedAtMs && !request.force) {
      return Object.freeze({
        allow: false,
        actorKey,
        actorKind: request.actorKind,
        channel: request.channel,
        context: request.context,
        sceneState,
        suppressionReason: 'KIND_COOLDOWN',
        nextAllowedAtMs: nextKindAllowedAtMs,
        effectiveCooldownMs,
        priorityScore: 0,
        budgetCost: 0,
        shadowOnly,
        witnessRequired,
        diagnostics: Object.freeze(diagnostics),
      });
    }

    const recentLog = ledger.recentEmissionLog;
    const channelBurst = recordCountWithinWindow(recentLog, nowMs, (record) => record.channel === request.channel);
    const kindBurst = recordCountWithinWindow(recentLog, nowMs, (record) => record.actorKind === request.actorKind);
    const actorBurst = recordCountWithinWindow(recentLog, nowMs, (record) => record.actorKey === actorKey);

    diagnostics.push(`channelBurst=${channelBurst}`);
    diagnostics.push(`kindBurst=${kindBurst}`);
    diagnostics.push(`actorBurst=${actorBurst}`);

    if ((channelBurst >= channelProfile.hardBurstCapPerMinute || kindBurst >= kindBaseline.hardBurstCapPerMinute) && !request.force) {
      return Object.freeze({
        allow: false,
        actorKey,
        actorKind: request.actorKind,
        channel: request.channel,
        context: request.context,
        sceneState,
        suppressionReason: 'BURST_LIMIT',
        nextAllowedAtMs: nowMs + Math.max(5_000, Math.round(effectiveCooldownMs * 0.5)),
        effectiveCooldownMs,
        priorityScore: 0,
        budgetCost: 0,
        shadowOnly,
        witnessRequired,
        diagnostics: Object.freeze(diagnostics),
      });
    }

    const priorityScore = computePriorityScore(request, room, channelProfile, kindBaseline, contextProfile, modeModifier);
    const budgetCost = computeBudgetCost(request, channelProfile, kindBaseline, contextProfile);

    diagnostics.push(`priorityScore=${priorityScore.toFixed(3)}`);
    diagnostics.push(`budgetCost=${budgetCost}`);

    return Object.freeze({
      allow: true,
      actorKey,
      actorKind: request.actorKind,
      channel: request.channel,
      context: request.context,
      sceneState,
      nextAllowedAtMs: Math.max(nextActorAllowedAtMs, nextChannelAllowedAtMs, nextKindAllowedAtMs, nowMs),
      effectiveCooldownMs,
      priorityScore,
      budgetCost,
      shadowOnly,
      witnessRequired,
      diagnostics: Object.freeze(diagnostics),
    });
  }

  public rankRequests(requests: readonly NpcCadenceRequest[], room: RoomCadenceSnapshot, ledger: CadenceLedger): readonly RankedCadenceDecision[] {
    const ranked = requests.map((request) => ({ request, decision: this.evaluate(request, room, ledger) }));
    ranked.sort((left, right) => {
      if (left.decision.allow !== right.decision.allow) return left.decision.allow ? -1 : 1;
      if (left.decision.priorityScore !== right.decision.priorityScore) return right.decision.priorityScore - left.decision.priorityScore;
      if (left.decision.witnessRequired !== right.decision.witnessRequired) return left.decision.witnessRequired ? -1 : 1;
      if (left.request.desiredAtMs !== right.request.desiredAtMs) return left.request.desiredAtMs - right.request.desiredAtMs;
      return left.request.requestId.localeCompare(right.request.requestId);
    });
    return Object.freeze(ranked);
  }

  public selectWinner(requests: readonly NpcCadenceRequest[], room: RoomCadenceSnapshot, ledger: CadenceLedger): RankedCadenceDecision | null {
    const ranked = this.rankRequests(requests, room, ledger);
    return ranked.find((entry) => entry.decision.allow) ?? null;
  }

  public recordEmission(ledger: CadenceLedger, decision: NpcCadenceDecision, request: NpcCadenceRequest, emittedAtMs = request.desiredAtMs): CadenceLedger {
    const actorKey = decision.actorKey;
    const lastEmissionAtByActor = Object.freeze({
      ...ledger.lastEmissionAtByActor,
      [actorKey]: emittedAtMs,
    });

    const lastEmissionAtByChannel = Object.freeze({
      ...ledger.lastEmissionAtByChannel,
      [request.channel]: emittedAtMs,
    });

    const lastEmissionAtByKind = Object.freeze({
      ...ledger.lastEmissionAtByKind,
      [request.actorKind]: emittedAtMs,
    });

    const recentEmissionLog = trimRecentLog(
      Object.freeze([
        ...ledger.recentEmissionLog,
        Object.freeze({
          requestId: request.requestId,
          actorKey,
          actorKind: request.actorKind,
          channel: request.channel,
          context: request.context,
          emittedAtMs,
          sceneState: decision.sceneState,
          priorityScore: decision.priorityScore,
          shadowOnly: decision.shadowOnly,
        }),
      ]),
      emittedAtMs,
    );

    return Object.freeze({
      lastEmissionAtByActor,
      lastEmissionAtByChannel,
      lastEmissionAtByKind,
      recentEmissionLog,
      suppressionCountsByActor: ledger.suppressionCountsByActor,
    });
  }

  public recordSuppression(ledger: CadenceLedger, request: NpcCadenceRequest): CadenceLedger {
    const actorKey = actorKeyOf(request);
    const suppressionCountsByActor = Object.freeze({
      ...ledger.suppressionCountsByActor,
      [actorKey]: (ledger.suppressionCountsByActor[actorKey] ?? 0) + 1,
    });

    return Object.freeze({
      lastEmissionAtByActor: ledger.lastEmissionAtByActor,
      lastEmissionAtByChannel: ledger.lastEmissionAtByChannel,
      lastEmissionAtByKind: ledger.lastEmissionAtByKind,
      recentEmissionLog: ledger.recentEmissionLog,
      suppressionCountsByActor,
    });
  }

  public computeAmbientGap(room: RoomCadenceSnapshot, ledger: CadenceLedger, nowMs: number, channel: CadenceChannel): number {
    const lastAmbient = [...ledger.recentEmissionLog]
      .filter((record) => record.actorKind === 'AMBIENT' && record.channel === channel)
      .sort((left, right) => right.emittedAtMs - left.emittedAtMs)[0]?.emittedAtMs ?? 0;
    return Math.max(0, nowMs - lastAmbient);
  }

  public computeHelperOpportunity(room: RoomCadenceSnapshot, ledger: CadenceLedger, nowMs: number): number {
    const lastHelper = ledger.lastEmissionAtByKind.HELPER ?? 0;
    const gap = Math.max(0, nowMs - lastHelper);
    const frustration = clamp01(room.frustration);
    const coldStart = clamp01(room.coldStart);
    const pressure = clamp01(room.pressure);
    return Number(((gap / 10_000) + (frustration * 1.2) + (coldStart * 0.5) + (pressure * 0.2)).toFixed(6));
  }

  public computeHaterOpportunity(room: RoomCadenceSnapshot, ledger: CadenceLedger, nowMs: number): number {
    const lastHater = ledger.lastEmissionAtByKind.HATER ?? 0;
    const gap = Math.max(0, nowMs - lastHater);
    const heat = clamp01(room.heat);
    const pressure = clamp01(room.pressure);
    const confidence = clamp01(room.confidence);
    return Number(((gap / 12_000) + (heat * 0.9) + (pressure * 0.8) + (confidence * 0.3)).toFixed(6));
  }

  public computeChannelBudget(room: RoomCadenceSnapshot, ledger: CadenceLedger, nowMs: number, channel: CadenceChannel): number {
    const profile = CHANNEL_PROFILES[channel];
    const used = recordCountWithinWindow(ledger.recentEmissionLog, nowMs, (record) => record.channel === channel);
    const capacity = Math.max(0, profile.hardBurstCapPerMinute - used);
    return capacity;
  }

  public buildDiagnostics(room: RoomCadenceSnapshot, ledger: CadenceLedger, nowMs: number): Readonly<Record<string, number | string | boolean>> {
    return Object.freeze({
      modeId: room.modeId,
      occupancy: room.occupancy,
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
      globalBudget: this.computeChannelBudget(room, ledger, nowMs, 'GLOBAL'),
      syndicateBudget: this.computeChannelBudget(room, ledger, nowMs, 'SYNDICATE'),
      dealRoomBudget: this.computeChannelBudget(room, ledger, nowMs, 'DEAL_ROOM'),
      lobbyBudget: this.computeChannelBudget(room, ledger, nowMs, 'LOBBY'),
      ambientGapGlobal: this.computeAmbientGap(room, ledger, nowMs, 'GLOBAL'),
      helperOpportunity: this.computeHelperOpportunity(room, ledger, nowMs),
      haterOpportunity: this.computeHaterOpportunity(room, ledger, nowMs),
      recentEvents: ledger.recentEmissionLog.length,
    });
  }
}

export const createNpcCadencePolicy = (): NpcCadencePolicy => new NpcCadencePolicy();
export const npcCadencePolicy = new NpcCadencePolicy();
