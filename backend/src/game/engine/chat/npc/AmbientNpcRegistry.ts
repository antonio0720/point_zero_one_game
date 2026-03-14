
/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT NPC REGISTRY
 * FILE: backend/src/game/engine/chat/npc/AmbientNpcRegistry.ts
 * ============================================================================
 *
 * Doctrine
 * --------
 * - this file is the canonical backend registry for non-critical, atmosphere-rich NPC voices
 * - ambient speech is not filler; it is social telemetry rendered as authored room presence
 * - ambient lines may witness, foreshadow, cool, or intensify a room without stealing authority
 * - backend owns when ambient chatter is legal, how often it may surface, and which channels it fits
 * - frontend may mirror these personas visually, but only backend decides what ambient speech enters truth
 *
 * Design Goals
 * ------------
 * 1. keep GLOBAL feeling watched, theatrical, and reactive to heat
 * 2. keep SYNDICATE feeling quiet, selective, and reputation-sensitive
 * 3. keep DEAL_ROOM feeling formal, predatory, and timing-aware
 * 4. keep LOBBY feeling alive before the run without letting it become the brain of the run
 * 5. let ambient speech carry memory, threat, witness, and rescue tone without impersonating helpers
 */

export type AmbientNpcPersonaId =
  | 'GLOBAL_PIT'
  | 'FLOOR_RUNNER'
  | 'CROWD_BROKER'
  | 'LEAGUE_OBSERVER'
  | 'SYNDICATE_WHISPER'
  | 'DEAL_ROOM_CLERK'
  | 'LOBBY_RUNNER'
  | 'MARKET_HISTORIAN'
  | 'THREAT_SPOTTER'
  | 'RESCUE_LOOKOUT'
;

export type AmbientNpcContext =
  | 'GAME_START'
  | 'LOBBY_QUEUE'
  | 'PLAYER_IDLE'
  | 'PLAYER_INCOME_UP'
  | 'PLAYER_SHIELD_BREAK'
  | 'PLAYER_COMEBACK'
  | 'PLAYER_LOST'
  | 'NEAR_SOVEREIGNTY'
  | 'TIME_PRESSURE'
  | 'CASCADE_CHAIN'
  | 'DEAL_ROOM_OFFER'
  | 'DEAL_ROOM_STALL'
  | 'SYNDICATE_JOIN'
  | 'ATTACK_DEFLECTED'
;

export type AmbientChannelAffinity = 'GLOBAL' | 'SYNDICATE' | 'DEAL_ROOM' | 'LOBBY';

export interface AmbientNpcLine {
  readonly id: string;
  readonly personaId: AmbientNpcPersonaId;
  readonly context: AmbientNpcContext;
  readonly text: string;
  readonly weight: number;
  readonly minTick?: number;
  readonly maxUses?: number;
  readonly tags: readonly string[];
  readonly heatFit: number;
  readonly pressureFit: number;
  readonly crowdFit: number;
  readonly silenceFit: number;
  readonly shadowEligible: boolean;
  readonly cadenceFloorMs: number;
}

export interface AmbientNpcProfile {
  readonly id: AmbientNpcPersonaId;
  readonly displayName: string;
  readonly archetype: string;
  readonly channelAffinity: AmbientChannelAffinity;
  readonly modeTags: readonly string[];
  readonly heatWeight: number;
  readonly pressureWeight: number;
  readonly silenceTolerance: number;
  readonly occupancyFloor: number;
  readonly tags: readonly string[];
}

export interface AmbientSelectionInput {
  readonly personaId?: AmbientNpcPersonaId;
  readonly context: AmbientNpcContext;
  readonly tick?: number;
  readonly heat?: number;
  readonly pressure?: number;
  readonly occupancy?: number;
  readonly silenceDebt?: number;
  readonly channel?: AmbientChannelAffinity;
  readonly modeId?: string;
  readonly useCountByLineId?: Readonly<Record<string, number>>;
  readonly bannedTags?: readonly string[];
  readonly allowShadow?: boolean;
}

export interface AmbientScenarioCandidate {
  readonly persona: AmbientNpcProfile;
  readonly line: AmbientNpcLine;
  readonly score: number;
}

export interface AmbientRegistrySnapshot {
  readonly personas: readonly AmbientNpcProfile[];
  readonly totalLines: number;
  readonly contexts: readonly AmbientNpcContext[];
  readonly linesByPersona: Readonly<Record<AmbientNpcPersonaId, number>>;
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

const DEFAULT_CONTEXTS = Object.freeze([
  'GAME_START',
  'LOBBY_QUEUE',
  'PLAYER_IDLE',
  'PLAYER_INCOME_UP',
  'PLAYER_SHIELD_BREAK',
  'PLAYER_COMEBACK',
  'PLAYER_LOST',
  'NEAR_SOVEREIGNTY',
  'TIME_PRESSURE',
  'CASCADE_CHAIN',
  'DEAL_ROOM_OFFER',
  'DEAL_ROOM_STALL',
  'SYNDICATE_JOIN',
  'ATTACK_DEFLECTED',
] as const satisfies readonly AmbientNpcContext[]);

const AMBIENT_PERSONA_PROFILES = Object.freeze({

GLOBAL_PIT: Object.freeze({
  id: 'GLOBAL_PIT' as const,
  displayName: 'GLOBAL PIT',
  archetype: 'public floor commentator',
  channelAffinity: 'GLOBAL' as const,
  modeTags: Object.freeze(['battle', 'run', 'global']),
  heatWeight: 0.75,
  pressureWeight: 0.60,
  silenceTolerance: 0.35,
  occupancyFloor: 2,
  tags: Object.freeze(['ambient', 'crowd', 'public']),
}),
FLOOR_RUNNER: Object.freeze({
  id: 'FLOOR_RUNNER' as const,
  displayName: 'FLOOR RUNNER',
  archetype: 'fast market messenger',
  channelAffinity: 'GLOBAL' as const,
  modeTags: Object.freeze(['battle', 'run', 'lobby']),
  heatWeight: 0.62,
  pressureWeight: 0.72,
  silenceTolerance: 0.25,
  occupancyFloor: 1,
  tags: Object.freeze(['ambient', 'runner', 'alert']),
}),
CROWD_BROKER: Object.freeze({
  id: 'CROWD_BROKER' as const,
  displayName: 'CROWD BROKER',
  archetype: 'swarm sentiment reader',
  channelAffinity: 'GLOBAL' as const,
  modeTags: Object.freeze(['global', 'battle']),
  heatWeight: 0.90,
  pressureWeight: 0.40,
  silenceTolerance: 0.48,
  occupancyFloor: 3,
  tags: Object.freeze(['ambient', 'crowd', 'heat']),
}),
LEAGUE_OBSERVER: Object.freeze({
  id: 'LEAGUE_OBSERVER' as const,
  displayName: 'LEAGUE OBSERVER',
  archetype: 'competitive season watcher',
  channelAffinity: 'GLOBAL' as const,
  modeTags: Object.freeze(['league', 'battle', 'run']),
  heatWeight: 0.54,
  pressureWeight: 0.58,
  silenceTolerance: 0.52,
  occupancyFloor: 2,
  tags: Object.freeze(['ambient', 'league', 'scoreboard']),
}),
SYNDICATE_WHISPER: Object.freeze({
  id: 'SYNDICATE_WHISPER' as const,
  displayName: 'SYNDICATE WHISPER',
  archetype: 'quiet alliance watcher',
  channelAffinity: 'SYNDICATE' as const,
  modeTags: Object.freeze(['syndicate', 'deal', 'war']),
  heatWeight: 0.38,
  pressureWeight: 0.66,
  silenceTolerance: 0.72,
  occupancyFloor: 1,
  tags: Object.freeze(['ambient', 'syndicate', 'private']),
}),
DEAL_ROOM_CLERK: Object.freeze({
  id: 'DEAL_ROOM_CLERK' as const,
  displayName: 'DEAL ROOM CLERK',
  archetype: 'negotiation room registrar',
  channelAffinity: 'DEAL_ROOM' as const,
  modeTags: Object.freeze(['deal', 'negotiation']),
  heatWeight: 0.30,
  pressureWeight: 0.80,
  silenceTolerance: 0.68,
  occupancyFloor: 1,
  tags: Object.freeze(['ambient', 'deal-room', 'formal']),
}),
LOBBY_RUNNER: Object.freeze({
  id: 'LOBBY_RUNNER' as const,
  displayName: 'LOBBY RUNNER',
  archetype: 'queue and pre-run energy handler',
  channelAffinity: 'LOBBY' as const,
  modeTags: Object.freeze(['lobby', 'queue', 'pre-run']),
  heatWeight: 0.48,
  pressureWeight: 0.26,
  silenceTolerance: 0.42,
  occupancyFloor: 1,
  tags: Object.freeze(['ambient', 'lobby', 'queue']),
}),
MARKET_HISTORIAN: Object.freeze({
  id: 'MARKET_HISTORIAN' as const,
  displayName: 'MARKET HISTORIAN',
  archetype: 'memory-rich systems archivist',
  channelAffinity: 'GLOBAL' as const,
  modeTags: Object.freeze(['global', 'history', 'postrun']),
  heatWeight: 0.28,
  pressureWeight: 0.44,
  silenceTolerance: 0.84,
  occupancyFloor: 1,
  tags: Object.freeze(['ambient', 'memory', 'history']),
}),
THREAT_SPOTTER: Object.freeze({
  id: 'THREAT_SPOTTER' as const,
  displayName: 'THREAT SPOTTER',
  archetype: 'breach and escalation watcher',
  channelAffinity: 'GLOBAL' as const,
  modeTags: Object.freeze(['battle', 'threat', 'run']),
  heatWeight: 0.66,
  pressureWeight: 0.92,
  silenceTolerance: 0.18,
  occupancyFloor: 1,
  tags: Object.freeze(['ambient', 'threat', 'alert']),
}),
RESCUE_LOOKOUT: Object.freeze({
  id: 'RESCUE_LOOKOUT' as const,
  displayName: 'RESCUE LOOKOUT',
  archetype: 'quiet watcher for frustration and recovery windows',
  channelAffinity: 'GLOBAL' as const,
  modeTags: Object.freeze(['rescue', 'recovery', 'run']),
  heatWeight: 0.34,
  pressureWeight: 0.78,
  silenceTolerance: 0.58,
  occupancyFloor: 1,
  tags: Object.freeze(['ambient', 'rescue', 'recovery']),
}),
} as const satisfies Record<AmbientNpcPersonaId, AmbientNpcProfile>);

const scoreLine = (line: AmbientNpcLine, input: AmbientSelectionInput): number => {
  const tick = typeof input.tick === 'number' ? input.tick : 0;
  if (typeof line.minTick === 'number' && tick < line.minTick) return Number.NEGATIVE_INFINITY;

  const useCount = input.useCountByLineId?.[line.id] ?? 0;
  if (typeof line.maxUses === 'number' && useCount >= line.maxUses) return Number.NEGATIVE_INFINITY;

  if (Array.isArray(input.bannedTags) && input.bannedTags.some((tag) => line.tags.includes(tag))) {
    return Number.NEGATIVE_INFINITY;
  }

  if (!input.allowShadow && line.shadowEligible && input.context === 'DEAL_ROOM_STALL') {
    return Number.NEGATIVE_INFINITY;
  }

  const heat = clamp01(input.heat);
  const pressure = clamp01(input.pressure);
  const silenceDebt = clamp01(input.silenceDebt);
  const occupancy = clamp01(typeof input.occupancy === 'number' ? input.occupancy / 12 : 0);

  const heatScore = 1 - Math.abs(line.heatFit - heat);
  const pressureScore = 1 - Math.abs(line.pressureFit - pressure);
  const crowdScore = 1 - Math.abs(line.crowdFit - occupancy);
  const silenceScore = 1 - Math.abs(line.silenceFit - silenceDebt);

  let modeScore = 0.5;
  const normalizedMode = (input.modeId ?? '').toLowerCase();
  if (normalizedMode.length > 0) {
    modeScore = line.tags.some((tag) => normalizedMode.includes(tag)) ? 1 : 0.55;
  }

  let channelScore = 0.5;
  if (input.channel) {
    channelScore = line.tags.includes(input.channel.toLowerCase()) ? 1 : 0.2;
  }

  const reusePenalty = useCount * 0.12;
  const base = line.weight;
  return Number(((base * 1.8) + heatScore + pressureScore + crowdScore + silenceScore + modeScore + channelScore - reusePenalty).toFixed(6));
};

const AMBIENT_DIALOGUE_LINES: Readonly<Record<AmbientNpcPersonaId, Record<AmbientNpcContext, readonly AmbientNpcLine[]>>> = Object.freeze({

      GLOBAL_PIT: Object.freeze({

          GAME_START: Object.freeze([

Object.freeze({
  id: 'amb_global_pit_game_start_1_af6b147864',
  personaId: 'GLOBAL_PIT' as const,
  context: 'GAME_START' as const,
  text: "Global pit's awake. First ticks decide who gets hunted and who earns a little breathing room.",
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'public', 'game_start', 'global']),
  heatFit: 0.75,
  pressureFit: 0.60,
  crowdFit: 0.59,
  silenceFit: 0.35,
  shadowEligible: false,
  cadenceFloorMs: 10900,
}),
Object.freeze({
  id: 'amb_global_pit_game_start_2_d8e45e47ac',
  personaId: 'GLOBAL_PIT' as const,
  context: 'GAME_START' as const,
  text: 'Boards are open. Crowd is calm now. By the next pressure swing, every mistake will have witnesses.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'public', 'game_start', 'global']),
  heatFit: 0.75,
  pressureFit: 0.60,
  crowdFit: 0.59,
  silenceFit: 0.35,
  shadowEligible: false,
  cadenceFloorMs: 12100,
}),
          ]),
          LOBBY_QUEUE: Object.freeze([

Object.freeze({
  id: 'amb_global_pit_lobby_queue_1_d9281c42b7',
  personaId: 'GLOBAL_PIT' as const,
  context: 'LOBBY_QUEUE' as const,
  text: "Queue's moving. People talk big in the lobby; the ledger remembers who survives once the clock starts.",
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'public', 'lobby_queue', 'global']),
  heatFit: 0.75,
  pressureFit: 0.60,
  crowdFit: 0.59,
  silenceFit: 0.35,
  shadowEligible: false,
  cadenceFloorMs: 10900,
}),
Object.freeze({
  id: 'amb_global_pit_lobby_queue_2_e83809ef3b',
  personaId: 'GLOBAL_PIT' as const,
  context: 'LOBBY_QUEUE' as const,
  text: 'Lobby noise is cheap. Real status starts when the first shield layer gets tested.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'public', 'lobby_queue', 'global']),
  heatFit: 0.75,
  pressureFit: 0.60,
  crowdFit: 0.59,
  silenceFit: 0.35,
  shadowEligible: false,
  cadenceFloorMs: 12100,
}),
          ]),
          PLAYER_IDLE: Object.freeze([

Object.freeze({
  id: 'amb_global_pit_player_idle_1_987e2e7c98',
  personaId: 'GLOBAL_PIT' as const,
  context: 'PLAYER_IDLE' as const,
  text: 'Pit sees the freeze. Silence this early reads like uncertainty, and uncertainty draws teeth.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'public', 'player_idle', 'global']),
  heatFit: 0.75,
  pressureFit: 0.60,
  crowdFit: 0.59,
  silenceFit: 0.65,
  shadowEligible: true,
  cadenceFloorMs: 10900,
}),
Object.freeze({
  id: 'amb_global_pit_player_idle_2_e613873fd8',
  personaId: 'GLOBAL_PIT' as const,
  context: 'PLAYER_IDLE' as const,
  text: "Global doesn't mind a pause, but long pauses become public narratives fast.",
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'public', 'player_idle', 'global']),
  heatFit: 0.75,
  pressureFit: 0.60,
  crowdFit: 0.59,
  silenceFit: 0.65,
  shadowEligible: true,
  cadenceFloorMs: 12100,
}),
          ]),
          PLAYER_INCOME_UP: Object.freeze([

Object.freeze({
  id: 'amb_global_pit_player_income_up_1_c0d14fb001',
  personaId: 'GLOBAL_PIT' as const,
  context: 'PLAYER_INCOME_UP' as const,
  text: 'Income spike registered. Global heat usually follows the first clean climb.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'public', 'player_income_up', 'global']),
  heatFit: 0.75,
  pressureFit: 0.60,
  crowdFit: 0.59,
  silenceFit: 0.35,
  shadowEligible: false,
  cadenceFloorMs: 10900,
}),
Object.freeze({
  id: 'amb_global_pit_player_income_up_2_214e99d071',
  personaId: 'GLOBAL_PIT' as const,
  context: 'PLAYER_INCOME_UP' as const,
  text: 'Nice bump. The crowd loves growth right up until it becomes a target signal.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'public', 'player_income_up', 'global']),
  heatFit: 0.75,
  pressureFit: 0.60,
  crowdFit: 0.59,
  silenceFit: 0.35,
  shadowEligible: false,
  cadenceFloorMs: 12100,
}),
          ]),
          PLAYER_SHIELD_BREAK: Object.freeze([

Object.freeze({
  id: 'amb_global_pit_player_shield_break_1_6c0be55a78',
  personaId: 'GLOBAL_PIT' as const,
  context: 'PLAYER_SHIELD_BREAK' as const,
  text: 'Shield breach on the floor. Crowd just leaned forward.',
  weight: 0.88,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'crowd', 'public', 'player_shield_break', 'global']),
  heatFit: 0.75,
  pressureFit: 0.60,
  crowdFit: 0.59,
  silenceFit: 0.35,
  shadowEligible: false,
  cadenceFloorMs: 10900,
}),
Object.freeze({
  id: 'amb_global_pit_player_shield_break_2_66b4a308cb',
  personaId: 'GLOBAL_PIT' as const,
  context: 'PLAYER_SHIELD_BREAK' as const,
  text: 'Public board saw that crack. Whatever happens next will echo wider than the damage itself.',
  weight: 0.68,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'crowd', 'public', 'player_shield_break', 'global']),
  heatFit: 0.75,
  pressureFit: 0.60,
  crowdFit: 0.59,
  silenceFit: 0.35,
  shadowEligible: false,
  cadenceFloorMs: 12100,
}),
          ]),
          PLAYER_COMEBACK: Object.freeze([

Object.freeze({
  id: 'amb_global_pit_player_comeback_1_a65252846f',
  personaId: 'GLOBAL_PIT' as const,
  context: 'PLAYER_COMEBACK' as const,
  text: "Comeback energy reached the pit. That's the kind of turn people quote later.",
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'public', 'player_comeback', 'global']),
  heatFit: 0.75,
  pressureFit: 0.60,
  crowdFit: 0.59,
  silenceFit: 0.35,
  shadowEligible: false,
  cadenceFloorMs: 10900,
}),
Object.freeze({
  id: 'amb_global_pit_player_comeback_2_989019f737',
  personaId: 'GLOBAL_PIT' as const,
  context: 'PLAYER_COMEBACK' as const,
  text: 'Global likes a survivor, but only if the rebound keeps holding under pressure.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'public', 'player_comeback', 'global']),
  heatFit: 0.75,
  pressureFit: 0.60,
  crowdFit: 0.59,
  silenceFit: 0.35,
  shadowEligible: false,
  cadenceFloorMs: 12100,
}),
          ]),
          PLAYER_LOST: Object.freeze([

Object.freeze({
  id: 'amb_global_pit_player_lost_1_be6aaaf6ee',
  personaId: 'GLOBAL_PIT' as const,
  context: 'PLAYER_LOST' as const,
  text: 'Floor went quiet for half a beat. Losses that sharp always leave a mark in the room.',
  weight: 0.88,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'crowd', 'public', 'player_lost', 'global']),
  heatFit: 0.75,
  pressureFit: 0.60,
  crowdFit: 0.59,
  silenceFit: 0.35,
  shadowEligible: false,
  cadenceFloorMs: 10900,
}),
Object.freeze({
  id: 'amb_global_pit_player_lost_2_b2d574dd83',
  personaId: 'GLOBAL_PIT' as const,
  context: 'PLAYER_LOST' as const,
  text: "Run's over. Global will move on, but it won't forget how the collapse started.",
  weight: 0.68,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'crowd', 'public', 'player_lost', 'global']),
  heatFit: 0.75,
  pressureFit: 0.60,
  crowdFit: 0.59,
  silenceFit: 0.35,
  shadowEligible: false,
  cadenceFloorMs: 12100,
}),
          ]),
          NEAR_SOVEREIGNTY: Object.freeze([

Object.freeze({
  id: 'amb_global_pit_near_sovereignty_1_7f7b872a1d',
  personaId: 'GLOBAL_PIT' as const,
  context: 'NEAR_SOVEREIGNTY' as const,
  text: 'Final stretch. Whole floor can feel the air tighten when sovereignty gets this close.',
  weight: 0.88,
  minTick: 400,
  maxUses: 2,
  tags: Object.freeze(['ambient', 'crowd', 'public', 'near_sovereignty', 'global']),
  heatFit: 0.75,
  pressureFit: 0.60,
  crowdFit: 0.59,
  silenceFit: 0.35,
  shadowEligible: false,
  cadenceFloorMs: 10900,
}),
Object.freeze({
  id: 'amb_global_pit_near_sovereignty_2_2f3368f414',
  personaId: 'GLOBAL_PIT' as const,
  context: 'NEAR_SOVEREIGNTY' as const,
  text: "You're in sight of the threshold now. Public rooms become theaters at this distance.",
  weight: 0.68,
  minTick: 400,
  maxUses: 2,
  tags: Object.freeze(['ambient', 'crowd', 'public', 'near_sovereignty', 'global']),
  heatFit: 0.75,
  pressureFit: 0.60,
  crowdFit: 0.59,
  silenceFit: 0.35,
  shadowEligible: false,
  cadenceFloorMs: 12100,
}),
          ]),
          TIME_PRESSURE: Object.freeze([

Object.freeze({
  id: 'amb_global_pit_time_pressure_1_911aee9272',
  personaId: 'GLOBAL_PIT' as const,
  context: 'TIME_PRESSURE' as const,
  text: 'Tick pressure rising. The pit always gets louder when people start paying for hesitation.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'public', 'time_pressure', 'global']),
  heatFit: 0.75,
  pressureFit: 0.60,
  crowdFit: 0.59,
  silenceFit: 0.35,
  shadowEligible: false,
  cadenceFloorMs: 10900,
}),
Object.freeze({
  id: 'amb_global_pit_time_pressure_2_3202384c43',
  personaId: 'GLOBAL_PIT' as const,
  context: 'TIME_PRESSURE' as const,
  text: 'Clock just changed the room temperature. Cheap decisions got expensive.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'public', 'time_pressure', 'global']),
  heatFit: 0.75,
  pressureFit: 0.60,
  crowdFit: 0.59,
  silenceFit: 0.35,
  shadowEligible: false,
  cadenceFloorMs: 12100,
}),
          ]),
          CASCADE_CHAIN: Object.freeze([

Object.freeze({
  id: 'amb_global_pit_cascade_chain_1_a0ca14735b',
  personaId: 'GLOBAL_PIT' as const,
  context: 'CASCADE_CHAIN' as const,
  text: 'Cascade on the board. Floor chatter just turned into witness testimony.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'public', 'cascade_chain', 'global']),
  heatFit: 0.75,
  pressureFit: 0.60,
  crowdFit: 0.59,
  silenceFit: 0.35,
  shadowEligible: false,
  cadenceFloorMs: 10900,
}),
Object.freeze({
  id: 'amb_global_pit_cascade_chain_2_ea2d9619a4',
  personaId: 'GLOBAL_PIT' as const,
  context: 'CASCADE_CHAIN' as const,
  text: 'Chain reaction confirmed. Public sentiment moves faster than cards when cascades start.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'public', 'cascade_chain', 'global']),
  heatFit: 0.75,
  pressureFit: 0.60,
  crowdFit: 0.59,
  silenceFit: 0.35,
  shadowEligible: false,
  cadenceFloorMs: 12100,
}),
          ]),
          DEAL_ROOM_OFFER: Object.freeze([

Object.freeze({
  id: 'amb_global_pit_deal_room_offer_1_5329a90e6e',
  personaId: 'GLOBAL_PIT' as const,
  context: 'DEAL_ROOM_OFFER' as const,
  text: 'Offer flashed out of the deal room. Global already started guessing who blinked first.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'public', 'deal_room_offer', 'global']),
  heatFit: 0.75,
  pressureFit: 0.60,
  crowdFit: 0.59,
  silenceFit: 0.35,
  shadowEligible: false,
  cadenceFloorMs: 10900,
}),
Object.freeze({
  id: 'amb_global_pit_deal_room_offer_2_ebb7702bf7',
  personaId: 'GLOBAL_PIT' as const,
  context: 'DEAL_ROOM_OFFER' as const,
  text: 'That number left the private room and hit the public imagination immediately.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'public', 'deal_room_offer', 'global']),
  heatFit: 0.75,
  pressureFit: 0.60,
  crowdFit: 0.59,
  silenceFit: 0.35,
  shadowEligible: false,
  cadenceFloorMs: 12100,
}),
          ]),
          DEAL_ROOM_STALL: Object.freeze([

Object.freeze({
  id: 'amb_global_pit_deal_room_stall_1_be89b5ca5a',
  personaId: 'GLOBAL_PIT' as const,
  context: 'DEAL_ROOM_STALL' as const,
  text: 'Deal room slowed down. Global reads stalled negotiation like blood in water.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'public', 'deal_room_stall', 'global']),
  heatFit: 0.75,
  pressureFit: 0.60,
  crowdFit: 0.59,
  silenceFit: 0.35,
  shadowEligible: true,
  cadenceFloorMs: 10900,
}),
Object.freeze({
  id: 'amb_global_pit_deal_room_stall_2_7281c6057c',
  personaId: 'GLOBAL_PIT' as const,
  context: 'DEAL_ROOM_STALL' as const,
  text: 'Silence from a hot room always creates stories. None of them are neutral.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'public', 'deal_room_stall', 'global']),
  heatFit: 0.75,
  pressureFit: 0.60,
  crowdFit: 0.59,
  silenceFit: 0.35,
  shadowEligible: true,
  cadenceFloorMs: 12100,
}),
          ]),
          SYNDICATE_JOIN: Object.freeze([

Object.freeze({
  id: 'amb_global_pit_syndicate_join_1_5ecc6e6b5f',
  personaId: 'GLOBAL_PIT' as const,
  context: 'SYNDICATE_JOIN' as const,
  text: 'New syndicate motion crossed the floor. Alignment changes are never invisible for long.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'public', 'syndicate_join', 'global']),
  heatFit: 0.75,
  pressureFit: 0.60,
  crowdFit: 0.59,
  silenceFit: 0.35,
  shadowEligible: true,
  cadenceFloorMs: 10900,
}),
Object.freeze({
  id: 'amb_global_pit_syndicate_join_2_0102a389d5',
  personaId: 'GLOBAL_PIT' as const,
  context: 'SYNDICATE_JOIN' as const,
  text: 'Pit caught the coalition shift. Public rooms hate being the last to know.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'public', 'syndicate_join', 'global']),
  heatFit: 0.75,
  pressureFit: 0.60,
  crowdFit: 0.59,
  silenceFit: 0.35,
  shadowEligible: true,
  cadenceFloorMs: 12100,
}),
          ]),
          ATTACK_DEFLECTED: Object.freeze([

Object.freeze({
  id: 'amb_global_pit_attack_deflected_1_bf88e8f08f',
  personaId: 'GLOBAL_PIT' as const,
  context: 'ATTACK_DEFLECTED' as const,
  text: 'Clean deflection. Global respects receipts more than speeches.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'public', 'attack_deflected', 'global']),
  heatFit: 0.75,
  pressureFit: 0.60,
  crowdFit: 0.59,
  silenceFit: 0.35,
  shadowEligible: false,
  cadenceFloorMs: 10900,
}),
Object.freeze({
  id: 'amb_global_pit_attack_deflected_2_c5629e5490',
  personaId: 'GLOBAL_PIT' as const,
  context: 'ATTACK_DEFLECTED' as const,
  text: 'That counter landed in public view. Floor just updated its ranking of you.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'public', 'attack_deflected', 'global']),
  heatFit: 0.75,
  pressureFit: 0.60,
  crowdFit: 0.59,
  silenceFit: 0.35,
  shadowEligible: false,
  cadenceFloorMs: 12100,
}),
          ]),
      }),
      FLOOR_RUNNER: Object.freeze({

          GAME_START: Object.freeze([

Object.freeze({
  id: 'amb_floor_runner_game_start_1_52a229ad9f',
  personaId: 'FLOOR_RUNNER' as const,
  context: 'GAME_START' as const,
  text: 'Runner note: early cards tell me more than the opening taunts do. Show the room your real lane fast.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'runner', 'alert', 'game_start', 'global']),
  heatFit: 0.62,
  pressureFit: 0.72,
  crowdFit: 0.47,
  silenceFit: 0.25,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_floor_runner_game_start_2_6848bf3f4c',
  personaId: 'FLOOR_RUNNER' as const,
  context: 'GAME_START' as const,
  text: "I'm already carrying signals between tables. First read says tempo matters more than confidence here.",
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'runner', 'alert', 'game_start', 'global']),
  heatFit: 0.62,
  pressureFit: 0.72,
  crowdFit: 0.47,
  silenceFit: 0.25,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          LOBBY_QUEUE: Object.freeze([

Object.freeze({
  id: 'amb_floor_runner_lobby_queue_1_798c8ccae7',
  personaId: 'FLOOR_RUNNER' as const,
  context: 'LOBBY_QUEUE' as const,
  text: 'Queue check: half the room is performing, half the room is reading. Guess which half lasts longer.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'runner', 'alert', 'lobby_queue', 'global']),
  heatFit: 0.62,
  pressureFit: 0.72,
  crowdFit: 0.47,
  silenceFit: 0.25,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_floor_runner_lobby_queue_2_02ed6bb5f6',
  personaId: 'FLOOR_RUNNER' as const,
  context: 'LOBBY_QUEUE' as const,
  text: 'Pre-run pulse is noisy, but you can still spot who came in with an actual plan.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'runner', 'alert', 'lobby_queue', 'global']),
  heatFit: 0.62,
  pressureFit: 0.72,
  crowdFit: 0.47,
  silenceFit: 0.25,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_IDLE: Object.freeze([

Object.freeze({
  id: 'amb_floor_runner_player_idle_1_9f2a362cb5',
  personaId: 'FLOOR_RUNNER' as const,
  context: 'PLAYER_IDLE' as const,
  text: 'Hold too long and somebody else writes the story for you. Runner sees that all day.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'runner', 'alert', 'player_idle', 'global']),
  heatFit: 0.62,
  pressureFit: 0.72,
  crowdFit: 0.47,
  silenceFit: 0.75,
  shadowEligible: true,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_floor_runner_player_idle_2_c2bcc33bb2',
  personaId: 'FLOOR_RUNNER' as const,
  context: 'PLAYER_IDLE' as const,
  text: 'No move yet. In this room, hesitation has a signature.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'runner', 'alert', 'player_idle', 'global']),
  heatFit: 0.62,
  pressureFit: 0.72,
  crowdFit: 0.47,
  silenceFit: 0.75,
  shadowEligible: true,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_INCOME_UP: Object.freeze([

Object.freeze({
  id: 'amb_floor_runner_player_income_up_1_c983bad950',
  personaId: 'FLOOR_RUNNER' as const,
  context: 'PLAYER_INCOME_UP' as const,
  text: "Income signal's real. I'll give it three beats before a predator answers.",
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'runner', 'alert', 'player_income_up', 'global']),
  heatFit: 0.62,
  pressureFit: 0.72,
  crowdFit: 0.47,
  silenceFit: 0.25,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_floor_runner_player_income_up_2_53f424120b',
  personaId: 'FLOOR_RUNNER' as const,
  context: 'PLAYER_INCOME_UP' as const,
  text: "Marked the increase. When money appears, pursuit isn't usually far behind.",
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'runner', 'alert', 'player_income_up', 'global']),
  heatFit: 0.62,
  pressureFit: 0.72,
  crowdFit: 0.47,
  silenceFit: 0.25,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_SHIELD_BREAK: Object.freeze([

Object.freeze({
  id: 'amb_floor_runner_player_shield_break_1_d3a10881bf',
  personaId: 'FLOOR_RUNNER' as const,
  context: 'PLAYER_SHIELD_BREAK' as const,
  text: 'Runner call: breach happened clean and public. Expect follow-up fast.',
  weight: 0.88,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'runner', 'alert', 'player_shield_break', 'global']),
  heatFit: 0.62,
  pressureFit: 0.72,
  crowdFit: 0.47,
  silenceFit: 0.25,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_floor_runner_player_shield_break_2_5468468920',
  personaId: 'FLOOR_RUNNER' as const,
  context: 'PLAYER_SHIELD_BREAK' as const,
  text: 'One layer down. Messages like that travel quicker than repair windows do.',
  weight: 0.68,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'runner', 'alert', 'player_shield_break', 'global']),
  heatFit: 0.62,
  pressureFit: 0.72,
  crowdFit: 0.47,
  silenceFit: 0.25,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_COMEBACK: Object.freeze([

Object.freeze({
  id: 'amb_floor_runner_player_comeback_1_dfbf5b745e',
  personaId: 'FLOOR_RUNNER' as const,
  context: 'PLAYER_COMEBACK' as const,
  text: 'Momentum flipped. I can feel rooms resetting their math already.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'runner', 'alert', 'player_comeback', 'global']),
  heatFit: 0.62,
  pressureFit: 0.72,
  crowdFit: 0.47,
  silenceFit: 0.25,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_floor_runner_player_comeback_2_9953da81d6',
  personaId: 'FLOOR_RUNNER' as const,
  context: 'PLAYER_COMEBACK' as const,
  text: 'Comeback registered. Fast recoveries change how enemies schedule their next push.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'runner', 'alert', 'player_comeback', 'global']),
  heatFit: 0.62,
  pressureFit: 0.72,
  crowdFit: 0.47,
  silenceFit: 0.25,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_LOST: Object.freeze([

Object.freeze({
  id: 'amb_floor_runner_player_lost_1_e2c8aa7303',
  personaId: 'FLOOR_RUNNER' as const,
  context: 'PLAYER_LOST' as const,
  text: "Hard stop. I'm logging the last clean decision because that's usually the real turning point.",
  weight: 0.88,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'runner', 'alert', 'player_lost', 'global']),
  heatFit: 0.62,
  pressureFit: 0.72,
  crowdFit: 0.47,
  silenceFit: 0.25,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_floor_runner_player_lost_2_ee542720bc',
  personaId: 'FLOOR_RUNNER' as const,
  context: 'PLAYER_LOST' as const,
  text: 'Loss came in quicker than the room expected. Those are the ones people study later.',
  weight: 0.68,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'runner', 'alert', 'player_lost', 'global']),
  heatFit: 0.62,
  pressureFit: 0.72,
  crowdFit: 0.47,
  silenceFit: 0.25,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          NEAR_SOVEREIGNTY: Object.freeze([

Object.freeze({
  id: 'amb_floor_runner_near_sovereignty_1_f0973c3e9c',
  personaId: 'FLOOR_RUNNER' as const,
  context: 'NEAR_SOVEREIGNTY' as const,
  text: "You're close enough that every micro-delay matters now. Runner traffic always spikes here.",
  weight: 0.88,
  minTick: 400,
  maxUses: 2,
  tags: Object.freeze(['ambient', 'runner', 'alert', 'near_sovereignty', 'global']),
  heatFit: 0.62,
  pressureFit: 0.72,
  crowdFit: 0.47,
  silenceFit: 0.25,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_floor_runner_near_sovereignty_2_bcdd16cffe',
  personaId: 'FLOOR_RUNNER' as const,
  context: 'NEAR_SOVEREIGNTY' as const,
  text: 'Threshold proximity confirmed. Whole network starts carrying your name differently at this range.',
  weight: 0.68,
  minTick: 400,
  maxUses: 2,
  tags: Object.freeze(['ambient', 'runner', 'alert', 'near_sovereignty', 'global']),
  heatFit: 0.62,
  pressureFit: 0.72,
  crowdFit: 0.47,
  silenceFit: 0.25,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          TIME_PRESSURE: Object.freeze([

Object.freeze({
  id: 'amb_floor_runner_time_pressure_1_1614f6345c',
  personaId: 'FLOOR_RUNNER' as const,
  context: 'TIME_PRESSURE' as const,
  text: 'Tempo warning. The board is accelerating faster than conversation can hide it.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'runner', 'alert', 'time_pressure', 'global']),
  heatFit: 0.62,
  pressureFit: 0.72,
  crowdFit: 0.47,
  silenceFit: 0.25,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_floor_runner_time_pressure_2_097af14e88',
  personaId: 'FLOOR_RUNNER' as const,
  context: 'TIME_PRESSURE' as const,
  text: 'Pressure tier climbed. Slow hands get punished before slow minds even notice.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'runner', 'alert', 'time_pressure', 'global']),
  heatFit: 0.62,
  pressureFit: 0.72,
  crowdFit: 0.47,
  silenceFit: 0.25,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          CASCADE_CHAIN: Object.freeze([

Object.freeze({
  id: 'amb_floor_runner_cascade_chain_1_21d883d294',
  personaId: 'FLOOR_RUNNER' as const,
  context: 'CASCADE_CHAIN' as const,
  text: 'Cascade signal in motion. Once the first piece falls, traffic doubles.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'runner', 'alert', 'cascade_chain', 'global']),
  heatFit: 0.62,
  pressureFit: 0.72,
  crowdFit: 0.47,
  silenceFit: 0.25,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_floor_runner_cascade_chain_2_cd6a82f201',
  personaId: 'FLOOR_RUNNER' as const,
  context: 'CASCADE_CHAIN' as const,
  text: 'Chain opened. I stop calling them isolated events after the second echo.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'runner', 'alert', 'cascade_chain', 'global']),
  heatFit: 0.62,
  pressureFit: 0.72,
  crowdFit: 0.47,
  silenceFit: 0.25,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          DEAL_ROOM_OFFER: Object.freeze([

Object.freeze({
  id: 'amb_floor_runner_deal_room_offer_1_c73ba3f01e',
  personaId: 'FLOOR_RUNNER' as const,
  context: 'DEAL_ROOM_OFFER' as const,
  text: 'Runner saw the offer. Weight on that number says somebody needs resolution soon.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'runner', 'alert', 'deal_room_offer', 'global']),
  heatFit: 0.62,
  pressureFit: 0.72,
  crowdFit: 0.47,
  silenceFit: 0.25,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_floor_runner_deal_room_offer_2_7e092a083c',
  personaId: 'FLOOR_RUNNER' as const,
  context: 'DEAL_ROOM_OFFER' as const,
  text: "Offer moved across the room with urgency attached. That's usually the part people miss.",
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'runner', 'alert', 'deal_room_offer', 'global']),
  heatFit: 0.62,
  pressureFit: 0.72,
  crowdFit: 0.47,
  silenceFit: 0.25,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          DEAL_ROOM_STALL: Object.freeze([

Object.freeze({
  id: 'amb_floor_runner_deal_room_stall_1_563cbfb35b',
  personaId: 'FLOOR_RUNNER' as const,
  context: 'DEAL_ROOM_STALL' as const,
  text: "Negotiation's dragging. Stalls like this mean somebody's trying to buy clarity with silence.",
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'runner', 'alert', 'deal_room_stall', 'global']),
  heatFit: 0.62,
  pressureFit: 0.72,
  crowdFit: 0.47,
  silenceFit: 0.25,
  shadowEligible: true,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_floor_runner_deal_room_stall_2_cf50f080bf',
  personaId: 'FLOOR_RUNNER' as const,
  context: 'DEAL_ROOM_STALL' as const,
  text: 'Nothing moving in deal room. That kind of stillness is almost never neutral.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'runner', 'alert', 'deal_room_stall', 'global']),
  heatFit: 0.62,
  pressureFit: 0.72,
  crowdFit: 0.47,
  silenceFit: 0.25,
  shadowEligible: true,
  cadenceFloorMs: 11750,
}),
          ]),
          SYNDICATE_JOIN: Object.freeze([

Object.freeze({
  id: 'amb_floor_runner_syndicate_join_1_9b2749a785',
  personaId: 'FLOOR_RUNNER' as const,
  context: 'SYNDICATE_JOIN' as const,
  text: "Fresh join signal. Network's already measuring loyalty against timing.",
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'runner', 'alert', 'syndicate_join', 'global']),
  heatFit: 0.62,
  pressureFit: 0.72,
  crowdFit: 0.47,
  silenceFit: 0.25,
  shadowEligible: true,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_floor_runner_syndicate_join_2_24a98c2d49',
  personaId: 'FLOOR_RUNNER' as const,
  context: 'SYNDICATE_JOIN' as const,
  text: 'Syndicate door opened and closed. Fast entries always trigger slower questions.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'runner', 'alert', 'syndicate_join', 'global']),
  heatFit: 0.62,
  pressureFit: 0.72,
  crowdFit: 0.47,
  silenceFit: 0.25,
  shadowEligible: true,
  cadenceFloorMs: 11750,
}),
          ]),
          ATTACK_DEFLECTED: Object.freeze([

Object.freeze({
  id: 'amb_floor_runner_attack_deflected_1_812ecb2ae9',
  personaId: 'FLOOR_RUNNER' as const,
  context: 'ATTACK_DEFLECTED' as const,
  text: 'Deflection clean. Runner lanes just shifted from alarm to attention.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'runner', 'alert', 'attack_deflected', 'global']),
  heatFit: 0.62,
  pressureFit: 0.72,
  crowdFit: 0.47,
  silenceFit: 0.25,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_floor_runner_attack_deflected_2_cef891e746',
  personaId: 'FLOOR_RUNNER' as const,
  context: 'ATTACK_DEFLECTED' as const,
  text: 'That counter was crisp. Rooms remember defensive timing better than bravado.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'runner', 'alert', 'attack_deflected', 'global']),
  heatFit: 0.62,
  pressureFit: 0.72,
  crowdFit: 0.47,
  silenceFit: 0.25,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
      }),
      CROWD_BROKER: Object.freeze({

          GAME_START: Object.freeze([

Object.freeze({
  id: 'amb_crowd_broker_game_start_1_ca4b7618ba',
  personaId: 'CROWD_BROKER' as const,
  context: 'GAME_START' as const,
  text: 'Crowd temperature is low, which means every strong move will print larger than usual.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'heat', 'game_start', 'global']),
  heatFit: 0.90,
  pressureFit: 0.40,
  crowdFit: 0.71,
  silenceFit: 0.48,
  shadowEligible: false,
  cadenceFloorMs: 11250,
}),
Object.freeze({
  id: 'amb_crowd_broker_game_start_2_e741edb4fc',
  personaId: 'CROWD_BROKER' as const,
  context: 'GAME_START' as const,
  text: 'Public mood is undecided. First clean sequence can own the narrative early.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'heat', 'game_start', 'global']),
  heatFit: 0.90,
  pressureFit: 0.40,
  crowdFit: 0.71,
  silenceFit: 0.48,
  shadowEligible: false,
  cadenceFloorMs: 12450,
}),
          ]),
          LOBBY_QUEUE: Object.freeze([

Object.freeze({
  id: 'amb_crowd_broker_lobby_queue_1_6dad71bf0f',
  personaId: 'CROWD_BROKER' as const,
  context: 'LOBBY_QUEUE' as const,
  text: 'Lobby has that pre-show energy where everybody wants to be seen and nobody wants to be measured.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'heat', 'lobby_queue', 'global']),
  heatFit: 0.90,
  pressureFit: 0.40,
  crowdFit: 0.71,
  silenceFit: 0.48,
  shadowEligible: false,
  cadenceFloorMs: 11250,
}),
Object.freeze({
  id: 'amb_crowd_broker_lobby_queue_2_7ea89b47cd',
  personaId: 'CROWD_BROKER' as const,
  context: 'LOBBY_QUEUE' as const,
  text: "Queue sentiment says people are ready to believe in a winner. They're just waiting for proof.",
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'heat', 'lobby_queue', 'global']),
  heatFit: 0.90,
  pressureFit: 0.40,
  crowdFit: 0.71,
  silenceFit: 0.48,
  shadowEligible: false,
  cadenceFloorMs: 12450,
}),
          ]),
          PLAYER_IDLE: Object.freeze([

Object.freeze({
  id: 'amb_crowd_broker_player_idle_1_2289e11b63',
  personaId: 'CROWD_BROKER' as const,
  context: 'PLAYER_IDLE' as const,
  text: "Crowd punishes empty space by filling it with assumption. Don't donate too much of it.",
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'heat', 'player_idle', 'global']),
  heatFit: 0.90,
  pressureFit: 0.40,
  crowdFit: 0.71,
  silenceFit: 0.52,
  shadowEligible: true,
  cadenceFloorMs: 11250,
}),
Object.freeze({
  id: 'amb_crowd_broker_player_idle_2_33ec1e33f6',
  personaId: 'CROWD_BROKER' as const,
  context: 'PLAYER_IDLE' as const,
  text: 'Too much stillness and public mood starts leaning hostile, even before any enemy speaks.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'heat', 'player_idle', 'global']),
  heatFit: 0.90,
  pressureFit: 0.40,
  crowdFit: 0.71,
  silenceFit: 0.52,
  shadowEligible: true,
  cadenceFloorMs: 12450,
}),
          ]),
          PLAYER_INCOME_UP: Object.freeze([

Object.freeze({
  id: 'amb_crowd_broker_player_income_up_1_56ea2954a0',
  personaId: 'CROWD_BROKER' as const,
  context: 'PLAYER_INCOME_UP' as const,
  text: 'Income climb always raises crowd appetite. Public approval and public danger travel together.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'heat', 'player_income_up', 'global']),
  heatFit: 0.90,
  pressureFit: 0.40,
  crowdFit: 0.71,
  silenceFit: 0.48,
  shadowEligible: false,
  cadenceFloorMs: 11250,
}),
Object.freeze({
  id: 'amb_crowd_broker_player_income_up_2_caf2700553',
  personaId: 'CROWD_BROKER' as const,
  context: 'PLAYER_INCOME_UP' as const,
  text: 'The room likes momentum, but it also likes seeing momentum tested.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'heat', 'player_income_up', 'global']),
  heatFit: 0.90,
  pressureFit: 0.40,
  crowdFit: 0.71,
  silenceFit: 0.48,
  shadowEligible: false,
  cadenceFloorMs: 12450,
}),
          ]),
          PLAYER_SHIELD_BREAK: Object.freeze([

Object.freeze({
  id: 'amb_crowd_broker_player_shield_break_1_8fd4344b23',
  personaId: 'CROWD_BROKER' as const,
  context: 'PLAYER_SHIELD_BREAK' as const,
  text: 'That breach shifted crowd heat hard. Public rooms love vulnerability almost as much as victory.',
  weight: 0.88,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'crowd', 'heat', 'player_shield_break', 'global']),
  heatFit: 0.90,
  pressureFit: 0.40,
  crowdFit: 0.71,
  silenceFit: 0.48,
  shadowEligible: false,
  cadenceFloorMs: 11250,
}),
Object.freeze({
  id: 'amb_crowd_broker_player_shield_break_2_3adc7dc656',
  personaId: 'CROWD_BROKER' as const,
  context: 'PLAYER_SHIELD_BREAK' as const,
  text: 'Temperature jumped the moment the shield cracked. Swarm behavior usually starts here.',
  weight: 0.68,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'crowd', 'heat', 'player_shield_break', 'global']),
  heatFit: 0.90,
  pressureFit: 0.40,
  crowdFit: 0.71,
  silenceFit: 0.48,
  shadowEligible: false,
  cadenceFloorMs: 12450,
}),
          ]),
          PLAYER_COMEBACK: Object.freeze([

Object.freeze({
  id: 'amb_crowd_broker_player_comeback_1_dfe5e9d941',
  personaId: 'CROWD_BROKER' as const,
  context: 'PLAYER_COMEBACK' as const,
  text: 'Sentiment reversal confirmed. People who were laughing are switching to watch mode.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'heat', 'player_comeback', 'global']),
  heatFit: 0.90,
  pressureFit: 0.40,
  crowdFit: 0.71,
  silenceFit: 0.48,
  shadowEligible: false,
  cadenceFloorMs: 11250,
}),
Object.freeze({
  id: 'amb_crowd_broker_player_comeback_2_62ce2117a9',
  personaId: 'CROWD_BROKER' as const,
  context: 'PLAYER_COMEBACK' as const,
  text: "Crowd loves a turn. Comebacks don't just repair state; they rewrite tone.",
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'heat', 'player_comeback', 'global']),
  heatFit: 0.90,
  pressureFit: 0.40,
  crowdFit: 0.71,
  silenceFit: 0.48,
  shadowEligible: false,
  cadenceFloorMs: 12450,
}),
          ]),
          PLAYER_LOST: Object.freeze([

Object.freeze({
  id: 'amb_crowd_broker_player_lost_1_e7c261406b',
  personaId: 'CROWD_BROKER' as const,
  context: 'PLAYER_LOST' as const,
  text: "Heat collapsed after the loss. That's not mercy. That's recalibration.",
  weight: 0.88,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'crowd', 'heat', 'player_lost', 'global']),
  heatFit: 0.90,
  pressureFit: 0.40,
  crowdFit: 0.71,
  silenceFit: 0.48,
  shadowEligible: false,
  cadenceFloorMs: 11250,
}),
Object.freeze({
  id: 'amb_crowd_broker_player_lost_2_dcb909e12e',
  personaId: 'CROWD_BROKER' as const,
  context: 'PLAYER_LOST' as const,
  text: 'Public mood cooled the second the board stopped fighting back.',
  weight: 0.68,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'crowd', 'heat', 'player_lost', 'global']),
  heatFit: 0.90,
  pressureFit: 0.40,
  crowdFit: 0.71,
  silenceFit: 0.48,
  shadowEligible: false,
  cadenceFloorMs: 12450,
}),
          ]),
          NEAR_SOVEREIGNTY: Object.freeze([

Object.freeze({
  id: 'amb_crowd_broker_near_sovereignty_1_3fcf8b0bfa',
  personaId: 'CROWD_BROKER' as const,
  context: 'NEAR_SOVEREIGNTY' as const,
  text: "You're at the range where crowds stop heckling and start witnessing.",
  weight: 0.88,
  minTick: 400,
  maxUses: 2,
  tags: Object.freeze(['ambient', 'crowd', 'heat', 'near_sovereignty', 'global']),
  heatFit: 0.90,
  pressureFit: 0.40,
  crowdFit: 0.71,
  silenceFit: 0.48,
  shadowEligible: false,
  cadenceFloorMs: 11250,
}),
Object.freeze({
  id: 'amb_crowd_broker_near_sovereignty_2_c109842294',
  personaId: 'CROWD_BROKER' as const,
  context: 'NEAR_SOVEREIGNTY' as const,
  text: 'Sentiment is peaking. Final stretch rooms become almost ceremonial when the run is this real.',
  weight: 0.68,
  minTick: 400,
  maxUses: 2,
  tags: Object.freeze(['ambient', 'crowd', 'heat', 'near_sovereignty', 'global']),
  heatFit: 0.90,
  pressureFit: 0.40,
  crowdFit: 0.71,
  silenceFit: 0.48,
  shadowEligible: false,
  cadenceFloorMs: 12450,
}),
          ]),
          TIME_PRESSURE: Object.freeze([

Object.freeze({
  id: 'amb_crowd_broker_time_pressure_1_e8dd4252f6',
  personaId: 'CROWD_BROKER' as const,
  context: 'TIME_PRESSURE' as const,
  text: "Pressure makes the crowd less patient and more theatrical. Bad mix if you're drifting.",
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'heat', 'time_pressure', 'global']),
  heatFit: 0.90,
  pressureFit: 0.40,
  crowdFit: 0.71,
  silenceFit: 0.48,
  shadowEligible: false,
  cadenceFloorMs: 11250,
}),
Object.freeze({
  id: 'amb_crowd_broker_time_pressure_2_61fd348dba',
  personaId: 'CROWD_BROKER' as const,
  context: 'TIME_PRESSURE' as const,
  text: "Public appetite for decisive action just spiked. Room won't forgive sleepy timing here.",
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'heat', 'time_pressure', 'global']),
  heatFit: 0.90,
  pressureFit: 0.40,
  crowdFit: 0.71,
  silenceFit: 0.48,
  shadowEligible: false,
  cadenceFloorMs: 12450,
}),
          ]),
          CASCADE_CHAIN: Object.freeze([

Object.freeze({
  id: 'amb_crowd_broker_cascade_chain_1_c2c4037202',
  personaId: 'CROWD_BROKER' as const,
  context: 'CASCADE_CHAIN' as const,
  text: 'Cascades pour fuel straight into public mood. Even neutral rooms pick a side when chains start.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'heat', 'cascade_chain', 'global']),
  heatFit: 0.90,
  pressureFit: 0.40,
  crowdFit: 0.71,
  silenceFit: 0.48,
  shadowEligible: false,
  cadenceFloorMs: 11250,
}),
Object.freeze({
  id: 'amb_crowd_broker_cascade_chain_2_da977d7dd7',
  personaId: 'CROWD_BROKER' as const,
  context: 'CASCADE_CHAIN' as const,
  text: "The chain altered crowd velocity. Momentum is social long before it's numerical.",
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'heat', 'cascade_chain', 'global']),
  heatFit: 0.90,
  pressureFit: 0.40,
  crowdFit: 0.71,
  silenceFit: 0.48,
  shadowEligible: false,
  cadenceFloorMs: 12450,
}),
          ]),
          DEAL_ROOM_OFFER: Object.freeze([

Object.freeze({
  id: 'amb_crowd_broker_deal_room_offer_1_6a69850499',
  personaId: 'CROWD_BROKER' as const,
  context: 'DEAL_ROOM_OFFER' as const,
  text: "Offer leaked enough shape to move sentiment outside the room. That's usually leverage, not accident.",
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'heat', 'deal_room_offer', 'global']),
  heatFit: 0.90,
  pressureFit: 0.40,
  crowdFit: 0.71,
  silenceFit: 0.48,
  shadowEligible: false,
  cadenceFloorMs: 11250,
}),
Object.freeze({
  id: 'amb_crowd_broker_deal_room_offer_2_aeae717bc5',
  personaId: 'CROWD_BROKER' as const,
  context: 'DEAL_ROOM_OFFER' as const,
  text: 'Public mood just priced the offer before the signatures even dried.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'heat', 'deal_room_offer', 'global']),
  heatFit: 0.90,
  pressureFit: 0.40,
  crowdFit: 0.71,
  silenceFit: 0.48,
  shadowEligible: false,
  cadenceFloorMs: 12450,
}),
          ]),
          DEAL_ROOM_STALL: Object.freeze([

Object.freeze({
  id: 'amb_crowd_broker_deal_room_stall_1_09343e0942',
  personaId: 'CROWD_BROKER' as const,
  context: 'DEAL_ROOM_STALL' as const,
  text: 'Stalled rooms always create whisper markets. Crowd hates missing information.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'heat', 'deal_room_stall', 'global']),
  heatFit: 0.90,
  pressureFit: 0.40,
  crowdFit: 0.71,
  silenceFit: 0.48,
  shadowEligible: true,
  cadenceFloorMs: 11250,
}),
Object.freeze({
  id: 'amb_crowd_broker_deal_room_stall_2_8f2cc6037f',
  personaId: 'CROWD_BROKER' as const,
  context: 'DEAL_ROOM_STALL' as const,
  text: 'When offers stop moving, public rooms start inventing reasons. None of them help.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'heat', 'deal_room_stall', 'global']),
  heatFit: 0.90,
  pressureFit: 0.40,
  crowdFit: 0.71,
  silenceFit: 0.48,
  shadowEligible: true,
  cadenceFloorMs: 12450,
}),
          ]),
          SYNDICATE_JOIN: Object.freeze([

Object.freeze({
  id: 'amb_crowd_broker_syndicate_join_1_502578bf70',
  personaId: 'CROWD_BROKER' as const,
  context: 'SYNDICATE_JOIN' as const,
  text: 'Coalition move nudged sentiment private-to-public. That drift matters.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'heat', 'syndicate_join', 'global']),
  heatFit: 0.90,
  pressureFit: 0.40,
  crowdFit: 0.71,
  silenceFit: 0.48,
  shadowEligible: true,
  cadenceFloorMs: 11250,
}),
Object.freeze({
  id: 'amb_crowd_broker_syndicate_join_2_9275584368',
  personaId: 'CROWD_BROKER' as const,
  context: 'SYNDICATE_JOIN' as const,
  text: "Syndicate growth changed the room balance. Crowd can feel alignment even when it can't hear it.",
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'heat', 'syndicate_join', 'global']),
  heatFit: 0.90,
  pressureFit: 0.40,
  crowdFit: 0.71,
  silenceFit: 0.48,
  shadowEligible: true,
  cadenceFloorMs: 12450,
}),
          ]),
          ATTACK_DEFLECTED: Object.freeze([

Object.freeze({
  id: 'amb_crowd_broker_attack_deflected_1_399c0c1778',
  personaId: 'CROWD_BROKER' as const,
  context: 'ATTACK_DEFLECTED' as const,
  text: 'Deflection landed and sentiment snapped in your favor for a beat.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'heat', 'attack_deflected', 'global']),
  heatFit: 0.90,
  pressureFit: 0.40,
  crowdFit: 0.71,
  silenceFit: 0.48,
  shadowEligible: false,
  cadenceFloorMs: 11250,
}),
Object.freeze({
  id: 'amb_crowd_broker_attack_deflected_2_80e706d896',
  personaId: 'CROWD_BROKER' as const,
  context: 'ATTACK_DEFLECTED' as const,
  text: 'Public rooms reward visible survival. That counter bought more than safety.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'crowd', 'heat', 'attack_deflected', 'global']),
  heatFit: 0.90,
  pressureFit: 0.40,
  crowdFit: 0.71,
  silenceFit: 0.48,
  shadowEligible: false,
  cadenceFloorMs: 12450,
}),
          ]),
      }),
      LEAGUE_OBSERVER: Object.freeze({

          GAME_START: Object.freeze([

Object.freeze({
  id: 'amb_league_observer_game_start_1_c8e4675300',
  personaId: 'LEAGUE_OBSERVER' as const,
  context: 'GAME_START' as const,
  text: 'Season eye says this opener matters. Early runs create expectations that echo for weeks.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'league', 'scoreboard', 'game_start', 'global']),
  heatFit: 0.54,
  pressureFit: 0.58,
  crowdFit: 0.59,
  silenceFit: 0.52,
  shadowEligible: false,
  cadenceFloorMs: 10900,
}),
Object.freeze({
  id: 'amb_league_observer_game_start_2_cc6b48233e',
  personaId: 'LEAGUE_OBSERVER' as const,
  context: 'GAME_START' as const,
  text: "League board doesn't just track wins; it tracks how fast you stabilize under noise.",
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'league', 'scoreboard', 'game_start', 'global']),
  heatFit: 0.54,
  pressureFit: 0.58,
  crowdFit: 0.59,
  silenceFit: 0.52,
  shadowEligible: false,
  cadenceFloorMs: 12100,
}),
          ]),
          LOBBY_QUEUE: Object.freeze([

Object.freeze({
  id: 'amb_league_observer_lobby_queue_1_0fb6525c71',
  personaId: 'LEAGUE_OBSERVER' as const,
  context: 'LOBBY_QUEUE' as const,
  text: 'Queue looks ordinary until you remember most standings start right here, in pre-run discipline.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'league', 'scoreboard', 'lobby_queue', 'global']),
  heatFit: 0.54,
  pressureFit: 0.58,
  crowdFit: 0.59,
  silenceFit: 0.52,
  shadowEligible: false,
  cadenceFloorMs: 10900,
}),
Object.freeze({
  id: 'amb_league_observer_lobby_queue_2_289b5eb11c',
  personaId: 'LEAGUE_OBSERVER' as const,
  context: 'LOBBY_QUEUE' as const,
  text: 'People treat the lobby like dead time and then wonder why their season always starts slow.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'league', 'scoreboard', 'lobby_queue', 'global']),
  heatFit: 0.54,
  pressureFit: 0.58,
  crowdFit: 0.59,
  silenceFit: 0.52,
  shadowEligible: false,
  cadenceFloorMs: 12100,
}),
          ]),
          PLAYER_IDLE: Object.freeze([

Object.freeze({
  id: 'amb_league_observer_player_idle_1_8ca99f06a6',
  personaId: 'LEAGUE_OBSERVER' as const,
  context: 'PLAYER_IDLE' as const,
  text: 'League note: empty beats tend to become ranking leaks over long samples.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'league', 'scoreboard', 'player_idle', 'global']),
  heatFit: 0.54,
  pressureFit: 0.58,
  crowdFit: 0.59,
  silenceFit: 0.48,
  shadowEligible: true,
  cadenceFloorMs: 10900,
}),
Object.freeze({
  id: 'amb_league_observer_player_idle_2_0df1641b86',
  personaId: 'LEAGUE_OBSERVER' as const,
  context: 'PLAYER_IDLE' as const,
  text: 'The ladder rarely punishes one pause. It punishes the pattern behind it.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'league', 'scoreboard', 'player_idle', 'global']),
  heatFit: 0.54,
  pressureFit: 0.58,
  crowdFit: 0.59,
  silenceFit: 0.48,
  shadowEligible: true,
  cadenceFloorMs: 12100,
}),
          ]),
          PLAYER_INCOME_UP: Object.freeze([

Object.freeze({
  id: 'amb_league_observer_player_income_up_1_f5f8f16bc3',
  personaId: 'LEAGUE_OBSERVER' as const,
  context: 'PLAYER_INCOME_UP' as const,
  text: 'Income mark posted. Strong economies always change how the season reads you.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'league', 'scoreboard', 'player_income_up', 'global']),
  heatFit: 0.54,
  pressureFit: 0.58,
  crowdFit: 0.59,
  silenceFit: 0.52,
  shadowEligible: false,
  cadenceFloorMs: 10900,
}),
Object.freeze({
  id: 'amb_league_observer_player_income_up_2_74f9e13ae1',
  personaId: 'LEAGUE_OBSERVER' as const,
  context: 'PLAYER_INCOME_UP' as const,
  text: "That's the kind of climb that gets annotated on serious boards.",
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'league', 'scoreboard', 'player_income_up', 'global']),
  heatFit: 0.54,
  pressureFit: 0.58,
  crowdFit: 0.59,
  silenceFit: 0.52,
  shadowEligible: false,
  cadenceFloorMs: 12100,
}),
          ]),
          PLAYER_SHIELD_BREAK: Object.freeze([

Object.freeze({
  id: 'amb_league_observer_player_shield_break_1_7476ba0597',
  personaId: 'LEAGUE_OBSERVER' as const,
  context: 'PLAYER_SHIELD_BREAK' as const,
  text: 'Defensive integrity just became a season question, not just a run question.',
  weight: 0.88,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'league', 'scoreboard', 'player_shield_break', 'global']),
  heatFit: 0.54,
  pressureFit: 0.58,
  crowdFit: 0.59,
  silenceFit: 0.52,
  shadowEligible: false,
  cadenceFloorMs: 10900,
}),
Object.freeze({
  id: 'amb_league_observer_player_shield_break_2_c62114db25',
  personaId: 'LEAGUE_OBSERVER' as const,
  context: 'PLAYER_SHIELD_BREAK' as const,
  text: 'League memory is cruel with breaches. People remember where your structure started slipping.',
  weight: 0.68,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'league', 'scoreboard', 'player_shield_break', 'global']),
  heatFit: 0.54,
  pressureFit: 0.58,
  crowdFit: 0.59,
  silenceFit: 0.52,
  shadowEligible: false,
  cadenceFloorMs: 12100,
}),
          ]),
          PLAYER_COMEBACK: Object.freeze([

Object.freeze({
  id: 'amb_league_observer_player_comeback_1_0c2466ef30',
  personaId: 'LEAGUE_OBSERVER' as const,
  context: 'PLAYER_COMEBACK' as const,
  text: 'Comebacks rate higher than smooth wins in most serious circles. Harder to fake.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'league', 'scoreboard', 'player_comeback', 'global']),
  heatFit: 0.54,
  pressureFit: 0.58,
  crowdFit: 0.59,
  silenceFit: 0.52,
  shadowEligible: false,
  cadenceFloorMs: 10900,
}),
Object.freeze({
  id: 'amb_league_observer_player_comeback_2_4bcb02fa1a',
  personaId: 'LEAGUE_OBSERVER' as const,
  context: 'PLAYER_COMEBACK' as const,
  text: 'Season board loves proof of recovery. Plenty can build; fewer can return.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'league', 'scoreboard', 'player_comeback', 'global']),
  heatFit: 0.54,
  pressureFit: 0.58,
  crowdFit: 0.59,
  silenceFit: 0.52,
  shadowEligible: false,
  cadenceFloorMs: 12100,
}),
          ]),
          PLAYER_LOST: Object.freeze([

Object.freeze({
  id: 'amb_league_observer_player_lost_1_365072c53e',
  personaId: 'LEAGUE_OBSERVER' as const,
  context: 'PLAYER_LOST' as const,
  text: 'Loss goes down, but so does the manner of it. Good boards keep both.',
  weight: 0.88,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'league', 'scoreboard', 'player_lost', 'global']),
  heatFit: 0.54,
  pressureFit: 0.58,
  crowdFit: 0.59,
  silenceFit: 0.52,
  shadowEligible: false,
  cadenceFloorMs: 10900,
}),
Object.freeze({
  id: 'amb_league_observer_player_lost_2_d0e9692f97',
  personaId: 'LEAGUE_OBSERVER' as const,
  context: 'PLAYER_LOST' as const,
  text: "League memory won't erase the defeat, but it will remember whether you folded or fought.",
  weight: 0.68,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'league', 'scoreboard', 'player_lost', 'global']),
  heatFit: 0.54,
  pressureFit: 0.58,
  crowdFit: 0.59,
  silenceFit: 0.52,
  shadowEligible: false,
  cadenceFloorMs: 12100,
}),
          ]),
          NEAR_SOVEREIGNTY: Object.freeze([

Object.freeze({
  id: 'amb_league_observer_near_sovereignty_1_426d57c270',
  personaId: 'LEAGUE_OBSERVER' as const,
  context: 'NEAR_SOVEREIGNTY' as const,
  text: 'Closing on sovereignty. Those are the runs that re-rank a whole season.',
  weight: 0.88,
  minTick: 400,
  maxUses: 2,
  tags: Object.freeze(['ambient', 'league', 'scoreboard', 'near_sovereignty', 'global']),
  heatFit: 0.54,
  pressureFit: 0.58,
  crowdFit: 0.59,
  silenceFit: 0.52,
  shadowEligible: false,
  cadenceFloorMs: 10900,
}),
Object.freeze({
  id: 'amb_league_observer_near_sovereignty_2_4c7f202dde',
  personaId: 'LEAGUE_OBSERVER' as const,
  context: 'NEAR_SOVEREIGNTY' as const,
  text: 'Final approach detected. League rooms always get strangely quiet when legitimacy is about to print.',
  weight: 0.68,
  minTick: 400,
  maxUses: 2,
  tags: Object.freeze(['ambient', 'league', 'scoreboard', 'near_sovereignty', 'global']),
  heatFit: 0.54,
  pressureFit: 0.58,
  crowdFit: 0.59,
  silenceFit: 0.52,
  shadowEligible: false,
  cadenceFloorMs: 12100,
}),
          ]),
          TIME_PRESSURE: Object.freeze([

Object.freeze({
  id: 'amb_league_observer_time_pressure_1_5eb089cbbc',
  personaId: 'LEAGUE_OBSERVER' as const,
  context: 'TIME_PRESSURE' as const,
  text: 'Pressure tiers are where ladder quality separates from lobby quality.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'league', 'scoreboard', 'time_pressure', 'global']),
  heatFit: 0.54,
  pressureFit: 0.58,
  crowdFit: 0.59,
  silenceFit: 0.52,
  shadowEligible: false,
  cadenceFloorMs: 10900,
}),
Object.freeze({
  id: 'amb_league_observer_time_pressure_2_bc1d3ec196',
  personaId: 'LEAGUE_OBSERVER' as const,
  context: 'TIME_PRESSURE' as const,
  text: 'Clock compression is the part standings secretly care about most.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'league', 'scoreboard', 'time_pressure', 'global']),
  heatFit: 0.54,
  pressureFit: 0.58,
  crowdFit: 0.59,
  silenceFit: 0.52,
  shadowEligible: false,
  cadenceFloorMs: 12100,
}),
          ]),
          CASCADE_CHAIN: Object.freeze([

Object.freeze({
  id: 'amb_league_observer_cascade_chain_1_ff44c30d70',
  personaId: 'LEAGUE_OBSERVER' as const,
  context: 'CASCADE_CHAIN' as const,
  text: 'Chains like that show structural fluency. League watchers track the second reaction more than the first.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'league', 'scoreboard', 'cascade_chain', 'global']),
  heatFit: 0.54,
  pressureFit: 0.58,
  crowdFit: 0.59,
  silenceFit: 0.52,
  shadowEligible: false,
  cadenceFloorMs: 10900,
}),
Object.freeze({
  id: 'amb_league_observer_cascade_chain_2_5b394a9609',
  personaId: 'LEAGUE_OBSERVER' as const,
  context: 'CASCADE_CHAIN' as const,
  text: 'Cascade registered. That kind of sequence can change how analysts seed you.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'league', 'scoreboard', 'cascade_chain', 'global']),
  heatFit: 0.54,
  pressureFit: 0.58,
  crowdFit: 0.59,
  silenceFit: 0.52,
  shadowEligible: false,
  cadenceFloorMs: 12100,
}),
          ]),
          DEAL_ROOM_OFFER: Object.freeze([

Object.freeze({
  id: 'amb_league_observer_deal_room_offer_1_b15f90c39e',
  personaId: 'LEAGUE_OBSERVER' as const,
  context: 'DEAL_ROOM_OFFER' as const,
  text: 'Negotiation competence affects standings more than people admit. Offer quality is signal.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'league', 'scoreboard', 'deal_room_offer', 'global']),
  heatFit: 0.54,
  pressureFit: 0.58,
  crowdFit: 0.59,
  silenceFit: 0.52,
  shadowEligible: false,
  cadenceFloorMs: 10900,
}),
Object.freeze({
  id: 'amb_league_observer_deal_room_offer_2_8794eb9720',
  personaId: 'LEAGUE_OBSERVER' as const,
  context: 'DEAL_ROOM_OFFER' as const,
  text: 'That number tells the league you understand value timing, not just value claims.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'league', 'scoreboard', 'deal_room_offer', 'global']),
  heatFit: 0.54,
  pressureFit: 0.58,
  crowdFit: 0.59,
  silenceFit: 0.52,
  shadowEligible: false,
  cadenceFloorMs: 12100,
}),
          ]),
          DEAL_ROOM_STALL: Object.freeze([

Object.freeze({
  id: 'amb_league_observer_deal_room_stall_1_b6a30e7569',
  personaId: 'LEAGUE_OBSERVER' as const,
  context: 'DEAL_ROOM_STALL' as const,
  text: 'Stalls in live negotiation show up later as trust penalties, even when nobody says it out loud.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'league', 'scoreboard', 'deal_room_stall', 'global']),
  heatFit: 0.54,
  pressureFit: 0.58,
  crowdFit: 0.59,
  silenceFit: 0.52,
  shadowEligible: true,
  cadenceFloorMs: 10900,
}),
Object.freeze({
  id: 'amb_league_observer_deal_room_stall_2_796e937822',
  personaId: 'LEAGUE_OBSERVER' as const,
  context: 'DEAL_ROOM_STALL' as const,
  text: 'League rooms read prolonged silence as incomplete control.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'league', 'scoreboard', 'deal_room_stall', 'global']),
  heatFit: 0.54,
  pressureFit: 0.58,
  crowdFit: 0.59,
  silenceFit: 0.52,
  shadowEligible: true,
  cadenceFloorMs: 12100,
}),
          ]),
          SYNDICATE_JOIN: Object.freeze([

Object.freeze({
  id: 'amb_league_observer_syndicate_join_1_85c31a96b9',
  personaId: 'LEAGUE_OBSERVER' as const,
  context: 'SYNDICATE_JOIN' as const,
  text: 'Alliance shifts matter because every season eventually becomes relational.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'league', 'scoreboard', 'syndicate_join', 'global']),
  heatFit: 0.54,
  pressureFit: 0.58,
  crowdFit: 0.59,
  silenceFit: 0.52,
  shadowEligible: true,
  cadenceFloorMs: 10900,
}),
Object.freeze({
  id: 'amb_league_observer_syndicate_join_2_4e655e8501',
  personaId: 'LEAGUE_OBSERVER' as const,
  context: 'SYNDICATE_JOIN' as const,
  text: "The join isn't just social; it's strategic data for everyone watching the ladder.",
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'league', 'scoreboard', 'syndicate_join', 'global']),
  heatFit: 0.54,
  pressureFit: 0.58,
  crowdFit: 0.59,
  silenceFit: 0.52,
  shadowEligible: true,
  cadenceFloorMs: 12100,
}),
          ]),
          ATTACK_DEFLECTED: Object.freeze([

Object.freeze({
  id: 'amb_league_observer_attack_deflected_1_306a18a9c4',
  personaId: 'LEAGUE_OBSERVER' as const,
  context: 'ATTACK_DEFLECTED' as const,
  text: 'Counter noted. Season boards credit clean survivals more than loud attacks.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'league', 'scoreboard', 'attack_deflected', 'global']),
  heatFit: 0.54,
  pressureFit: 0.58,
  crowdFit: 0.59,
  silenceFit: 0.52,
  shadowEligible: false,
  cadenceFloorMs: 10900,
}),
Object.freeze({
  id: 'amb_league_observer_attack_deflected_2_3fa2b1817c',
  personaId: 'LEAGUE_OBSERVER' as const,
  context: 'ATTACK_DEFLECTED' as const,
  text: 'A visible deflection tells the league your structure is learning in public.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'league', 'scoreboard', 'attack_deflected', 'global']),
  heatFit: 0.54,
  pressureFit: 0.58,
  crowdFit: 0.59,
  silenceFit: 0.52,
  shadowEligible: false,
  cadenceFloorMs: 12100,
}),
          ]),
      }),
      SYNDICATE_WHISPER: Object.freeze({

          GAME_START: Object.freeze([

Object.freeze({
  id: 'amb_syndicate_whisper_game_start_1_0ca62afe4e',
  personaId: 'SYNDICATE_WHISPER' as const,
  context: 'GAME_START' as const,
  text: 'Private rooms are listening. Early tells decide who gets trusted with real information.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'syndicate', 'private', 'game_start']),
  heatFit: 0.38,
  pressureFit: 0.66,
  crowdFit: 0.47,
  silenceFit: 0.72,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_syndicate_whisper_game_start_2_95f49011c1',
  personaId: 'SYNDICATE_WHISPER' as const,
  context: 'GAME_START' as const,
  text: 'Syndicates never enter at the first sound. They enter at the first useful pattern.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'syndicate', 'private', 'game_start']),
  heatFit: 0.38,
  pressureFit: 0.66,
  crowdFit: 0.47,
  silenceFit: 0.72,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          LOBBY_QUEUE: Object.freeze([

Object.freeze({
  id: 'amb_syndicate_whisper_lobby_queue_1_27299f80c7',
  personaId: 'SYNDICATE_WHISPER' as const,
  context: 'LOBBY_QUEUE' as const,
  text: 'Lobby chatter leaks more than people think. Quiet rooms harvest it.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'syndicate', 'private', 'lobby_queue']),
  heatFit: 0.38,
  pressureFit: 0.66,
  crowdFit: 0.47,
  silenceFit: 0.72,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_syndicate_whisper_lobby_queue_2_c5564943a2',
  personaId: 'SYNDICATE_WHISPER' as const,
  context: 'LOBBY_QUEUE' as const,
  text: "Every queue has a few players already being profiled by rooms they'll never notice.",
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'syndicate', 'private', 'lobby_queue']),
  heatFit: 0.38,
  pressureFit: 0.66,
  crowdFit: 0.47,
  silenceFit: 0.72,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_IDLE: Object.freeze([

Object.freeze({
  id: 'amb_syndicate_whisper_player_idle_1_b9c5f9a130',
  personaId: 'SYNDICATE_WHISPER' as const,
  context: 'PLAYER_IDLE' as const,
  text: 'Stillness can mean fear. It can also mean calculation. Syndicates watch long enough to know the difference.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'syndicate', 'private', 'player_idle']),
  heatFit: 0.38,
  pressureFit: 0.66,
  crowdFit: 0.47,
  silenceFit: 0.28,
  shadowEligible: true,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_syndicate_whisper_player_idle_2_29bf75a0d0',
  personaId: 'SYNDICATE_WHISPER' as const,
  context: 'PLAYER_IDLE' as const,
  text: 'We notice pauses, but only fools rush to interpret them.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'syndicate', 'private', 'player_idle']),
  heatFit: 0.38,
  pressureFit: 0.66,
  crowdFit: 0.47,
  silenceFit: 0.28,
  shadowEligible: true,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_INCOME_UP: Object.freeze([

Object.freeze({
  id: 'amb_syndicate_whisper_player_income_up_1_bdf7f03c70',
  personaId: 'SYNDICATE_WHISPER' as const,
  context: 'PLAYER_INCOME_UP' as const,
  text: 'A clean economy attracts offers and surveillance in equal measure.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'syndicate', 'private', 'player_income_up']),
  heatFit: 0.38,
  pressureFit: 0.66,
  crowdFit: 0.47,
  silenceFit: 0.72,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_syndicate_whisper_player_income_up_2_7599a11bf9',
  personaId: 'SYNDICATE_WHISPER' as const,
  context: 'PLAYER_INCOME_UP' as const,
  text: "Income rising. Private rooms won't congratulate you; they'll model you.",
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'syndicate', 'private', 'player_income_up']),
  heatFit: 0.38,
  pressureFit: 0.66,
  crowdFit: 0.47,
  silenceFit: 0.72,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_SHIELD_BREAK: Object.freeze([

Object.freeze({
  id: 'amb_syndicate_whisper_player_shield_break_1_11943a1fb9',
  personaId: 'SYNDICATE_WHISPER' as const,
  context: 'PLAYER_SHIELD_BREAK' as const,
  text: "Breach events change who speaks about you when you're not in the room.",
  weight: 0.88,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'syndicate', 'private', 'player_shield_break']),
  heatFit: 0.38,
  pressureFit: 0.66,
  crowdFit: 0.47,
  silenceFit: 0.72,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_syndicate_whisper_player_shield_break_2_5646e4928a',
  personaId: 'SYNDICATE_WHISPER' as const,
  context: 'PLAYER_SHIELD_BREAK' as const,
  text: 'One crack is enough for certain allies to become analysts and certain analysts to become predators.',
  weight: 0.68,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'syndicate', 'private', 'player_shield_break']),
  heatFit: 0.38,
  pressureFit: 0.66,
  crowdFit: 0.47,
  silenceFit: 0.72,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_COMEBACK: Object.freeze([

Object.freeze({
  id: 'amb_syndicate_whisper_player_comeback_1_c7cba7ac7e',
  personaId: 'SYNDICATE_WHISPER' as const,
  context: 'PLAYER_COMEBACK' as const,
  text: 'Recovery after exposure earns more respect here than comfort ever could.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'syndicate', 'private', 'player_comeback']),
  heatFit: 0.38,
  pressureFit: 0.66,
  crowdFit: 0.47,
  silenceFit: 0.72,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_syndicate_whisper_player_comeback_2_ea94401f4e',
  personaId: 'SYNDICATE_WHISPER' as const,
  context: 'PLAYER_COMEBACK' as const,
  text: 'Private rooms remember who can rebuild under watch.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'syndicate', 'private', 'player_comeback']),
  heatFit: 0.38,
  pressureFit: 0.66,
  crowdFit: 0.47,
  silenceFit: 0.72,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_LOST: Object.freeze([

Object.freeze({
  id: 'amb_syndicate_whisper_player_lost_1_48cf9f9f85',
  personaId: 'SYNDICATE_WHISPER' as const,
  context: 'PLAYER_LOST' as const,
  text: 'A clean defeat teaches more about a player than a padded win.',
  weight: 0.88,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'syndicate', 'private', 'player_lost']),
  heatFit: 0.38,
  pressureFit: 0.66,
  crowdFit: 0.47,
  silenceFit: 0.72,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_syndicate_whisper_player_lost_2_eaafc5d38b',
  personaId: 'SYNDICATE_WHISPER' as const,
  context: 'PLAYER_LOST' as const,
  text: 'Loss closes one room and opens another. Depends who was watching.',
  weight: 0.68,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'syndicate', 'private', 'player_lost']),
  heatFit: 0.38,
  pressureFit: 0.66,
  crowdFit: 0.47,
  silenceFit: 0.72,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          NEAR_SOVEREIGNTY: Object.freeze([

Object.freeze({
  id: 'amb_syndicate_whisper_near_sovereignty_1_7239c527dc',
  personaId: 'SYNDICATE_WHISPER' as const,
  context: 'NEAR_SOVEREIGNTY' as const,
  text: 'At this distance, every invitation becomes conditional and every condition becomes visible.',
  weight: 0.88,
  minTick: 400,
  maxUses: 2,
  tags: Object.freeze(['ambient', 'syndicate', 'private', 'near_sovereignty']),
  heatFit: 0.38,
  pressureFit: 0.66,
  crowdFit: 0.47,
  silenceFit: 0.72,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_syndicate_whisper_near_sovereignty_2_9fd1d8ac56',
  personaId: 'SYNDICATE_WHISPER' as const,
  context: 'NEAR_SOVEREIGNTY' as const,
  text: 'You are near enough now that private rooms stop guessing and start positioning.',
  weight: 0.68,
  minTick: 400,
  maxUses: 2,
  tags: Object.freeze(['ambient', 'syndicate', 'private', 'near_sovereignty']),
  heatFit: 0.38,
  pressureFit: 0.66,
  crowdFit: 0.47,
  silenceFit: 0.72,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          TIME_PRESSURE: Object.freeze([

Object.freeze({
  id: 'amb_syndicate_whisper_time_pressure_1_b76cd704ce',
  personaId: 'SYNDICATE_WHISPER' as const,
  context: 'TIME_PRESSURE' as const,
  text: 'Compressed clocks reveal loyalty fractures fast.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'syndicate', 'private', 'time_pressure']),
  heatFit: 0.38,
  pressureFit: 0.66,
  crowdFit: 0.47,
  silenceFit: 0.72,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_syndicate_whisper_time_pressure_2_f83fe40a1e',
  personaId: 'SYNDICATE_WHISPER' as const,
  context: 'TIME_PRESSURE' as const,
  text: "Pressure doesn't create character; it announces it.",
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'syndicate', 'private', 'time_pressure']),
  heatFit: 0.38,
  pressureFit: 0.66,
  crowdFit: 0.47,
  silenceFit: 0.72,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          CASCADE_CHAIN: Object.freeze([

Object.freeze({
  id: 'amb_syndicate_whisper_cascade_chain_1_c67e39cb00',
  personaId: 'SYNDICATE_WHISPER' as const,
  context: 'CASCADE_CHAIN' as const,
  text: 'When chains start, syndicates measure not the event but who benefited from the confusion.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'syndicate', 'private', 'cascade_chain']),
  heatFit: 0.38,
  pressureFit: 0.66,
  crowdFit: 0.47,
  silenceFit: 0.72,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_syndicate_whisper_cascade_chain_2_48d4e9572e',
  personaId: 'SYNDICATE_WHISPER' as const,
  context: 'CASCADE_CHAIN' as const,
  text: 'Private rooms respect cascades only when control survives the noise.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'syndicate', 'private', 'cascade_chain']),
  heatFit: 0.38,
  pressureFit: 0.66,
  crowdFit: 0.47,
  silenceFit: 0.72,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          DEAL_ROOM_OFFER: Object.freeze([

Object.freeze({
  id: 'amb_syndicate_whisper_deal_room_offer_1_51e1aefab2',
  personaId: 'SYNDICATE_WHISPER' as const,
  context: 'DEAL_ROOM_OFFER' as const,
  text: 'Offer terms matter. Offer timing matters more.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'syndicate', 'private', 'deal_room_offer']),
  heatFit: 0.38,
  pressureFit: 0.66,
  crowdFit: 0.47,
  silenceFit: 0.72,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_syndicate_whisper_deal_room_offer_2_833c426e5a',
  personaId: 'SYNDICATE_WHISPER' as const,
  context: 'DEAL_ROOM_OFFER' as const,
  text: 'A well-timed number says more about power than a loud one ever will.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'syndicate', 'private', 'deal_room_offer']),
  heatFit: 0.38,
  pressureFit: 0.66,
  crowdFit: 0.47,
  silenceFit: 0.72,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          DEAL_ROOM_STALL: Object.freeze([

Object.freeze({
  id: 'amb_syndicate_whisper_deal_room_stall_1_fe2fa8f931',
  personaId: 'SYNDICATE_WHISPER' as const,
  context: 'DEAL_ROOM_STALL' as const,
  text: 'Long silence in a hot room usually means somebody is deciding whether to lie or leave.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'syndicate', 'private', 'deal_room_stall']),
  heatFit: 0.38,
  pressureFit: 0.66,
  crowdFit: 0.47,
  silenceFit: 0.72,
  shadowEligible: true,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_syndicate_whisper_deal_room_stall_2_8e1ec6540c',
  personaId: 'SYNDICATE_WHISPER' as const,
  context: 'DEAL_ROOM_STALL' as const,
  text: "Negotiation stalls are rarely dead space. Usually they're filtration.",
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'syndicate', 'private', 'deal_room_stall']),
  heatFit: 0.38,
  pressureFit: 0.66,
  crowdFit: 0.47,
  silenceFit: 0.72,
  shadowEligible: true,
  cadenceFloorMs: 11750,
}),
          ]),
          SYNDICATE_JOIN: Object.freeze([

Object.freeze({
  id: 'amb_syndicate_whisper_syndicate_join_1_8a96eba9c3',
  personaId: 'SYNDICATE_WHISPER' as const,
  context: 'SYNDICATE_JOIN' as const,
  text: 'Entry acknowledged. Trust remains unwritten for now.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'syndicate', 'private', 'syndicate_join']),
  heatFit: 0.38,
  pressureFit: 0.66,
  crowdFit: 0.47,
  silenceFit: 0.72,
  shadowEligible: true,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_syndicate_whisper_syndicate_join_2_c454aa467a',
  personaId: 'SYNDICATE_WHISPER' as const,
  context: 'SYNDICATE_JOIN' as const,
  text: 'Doors open easier than records do. Keep that in mind.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'syndicate', 'private', 'syndicate_join']),
  heatFit: 0.38,
  pressureFit: 0.66,
  crowdFit: 0.47,
  silenceFit: 0.72,
  shadowEligible: true,
  cadenceFloorMs: 11750,
}),
          ]),
          ATTACK_DEFLECTED: Object.freeze([

Object.freeze({
  id: 'amb_syndicate_whisper_attack_deflected_1_865ea79b06',
  personaId: 'SYNDICATE_WHISPER' as const,
  context: 'ATTACK_DEFLECTED' as const,
  text: 'Useful. Quiet rooms prefer counters to speeches.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'syndicate', 'private', 'attack_deflected']),
  heatFit: 0.38,
  pressureFit: 0.66,
  crowdFit: 0.47,
  silenceFit: 0.72,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_syndicate_whisper_attack_deflected_2_250c10042c',
  personaId: 'SYNDICATE_WHISPER' as const,
  context: 'ATTACK_DEFLECTED' as const,
  text: 'A clean deflection is one of the few things private observers respect immediately.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'syndicate', 'private', 'attack_deflected']),
  heatFit: 0.38,
  pressureFit: 0.66,
  crowdFit: 0.47,
  silenceFit: 0.72,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
      }),
      DEAL_ROOM_CLERK: Object.freeze({

          GAME_START: Object.freeze([

Object.freeze({
  id: 'amb_deal_room_clerk_game_start_1_e8145b238d',
  personaId: 'DEAL_ROOM_CLERK' as const,
  context: 'GAME_START' as const,
  text: 'Records open. Deals made after the opening ticks always price in what you revealed too early.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'deal-room', 'formal', 'game_start', 'deal_room']),
  heatFit: 0.30,
  pressureFit: 0.80,
  crowdFit: 0.47,
  silenceFit: 0.68,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_deal_room_clerk_game_start_2_8042845bcd',
  personaId: 'DEAL_ROOM_CLERK' as const,
  context: 'GAME_START' as const,
  text: 'Negotiation desk is live. Precision beats charm in this room.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'deal-room', 'formal', 'game_start', 'deal_room']),
  heatFit: 0.30,
  pressureFit: 0.80,
  crowdFit: 0.47,
  silenceFit: 0.68,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          LOBBY_QUEUE: Object.freeze([

Object.freeze({
  id: 'amb_deal_room_clerk_lobby_queue_1_dc70149ebd',
  personaId: 'DEAL_ROOM_CLERK' as const,
  context: 'LOBBY_QUEUE' as const,
  text: 'Pre-room posture matters. People enter negotiation already discounted by how they waited.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'deal-room', 'formal', 'lobby_queue', 'deal_room']),
  heatFit: 0.30,
  pressureFit: 0.80,
  crowdFit: 0.47,
  silenceFit: 0.68,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_deal_room_clerk_lobby_queue_2_36560cb177',
  personaId: 'DEAL_ROOM_CLERK' as const,
  context: 'LOBBY_QUEUE' as const,
  text: 'Queue behavior leaks urgency. Urgency leaks margin.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'deal-room', 'formal', 'lobby_queue', 'deal_room']),
  heatFit: 0.30,
  pressureFit: 0.80,
  crowdFit: 0.47,
  silenceFit: 0.68,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_IDLE: Object.freeze([

Object.freeze({
  id: 'amb_deal_room_clerk_player_idle_1_23ee7739b1',
  personaId: 'DEAL_ROOM_CLERK' as const,
  context: 'PLAYER_IDLE' as const,
  text: 'Silence can strengthen price if it feels deliberate. Drift only weakens it.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'deal-room', 'formal', 'player_idle', 'deal_room']),
  heatFit: 0.30,
  pressureFit: 0.80,
  crowdFit: 0.47,
  silenceFit: 0.32,
  shadowEligible: true,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_deal_room_clerk_player_idle_2_fcbec62614',
  personaId: 'DEAL_ROOM_CLERK' as const,
  context: 'PLAYER_IDLE' as const,
  text: 'No move filed. I cannot distinguish patience from confusion until the next line lands.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'deal-room', 'formal', 'player_idle', 'deal_room']),
  heatFit: 0.30,
  pressureFit: 0.80,
  crowdFit: 0.47,
  silenceFit: 0.32,
  shadowEligible: true,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_INCOME_UP: Object.freeze([

Object.freeze({
  id: 'amb_deal_room_clerk_player_income_up_1_754586ff97',
  personaId: 'DEAL_ROOM_CLERK' as const,
  context: 'PLAYER_INCOME_UP' as const,
  text: 'Improved cash position noted. Rooms like this always ask whether growth changed your floor or only your confidence.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'deal-room', 'formal', 'player_income_up', 'deal_room']),
  heatFit: 0.30,
  pressureFit: 0.80,
  crowdFit: 0.47,
  silenceFit: 0.68,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_deal_room_clerk_player_income_up_2_4c5691d677',
  personaId: 'DEAL_ROOM_CLERK' as const,
  context: 'PLAYER_INCOME_UP' as const,
  text: 'The balance sheet got stronger. Expect counterparties to test whether the backbone did too.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'deal-room', 'formal', 'player_income_up', 'deal_room']),
  heatFit: 0.30,
  pressureFit: 0.80,
  crowdFit: 0.47,
  silenceFit: 0.68,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_SHIELD_BREAK: Object.freeze([

Object.freeze({
  id: 'amb_deal_room_clerk_player_shield_break_1_accc196b0d',
  personaId: 'DEAL_ROOM_CLERK' as const,
  context: 'PLAYER_SHIELD_BREAK' as const,
  text: 'Defensive breach changes leverage. That is not opinion; that is arithmetic.',
  weight: 0.88,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'deal-room', 'formal', 'player_shield_break', 'deal_room']),
  heatFit: 0.30,
  pressureFit: 0.80,
  crowdFit: 0.47,
  silenceFit: 0.68,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_deal_room_clerk_player_shield_break_2_e62720183c',
  personaId: 'DEAL_ROOM_CLERK' as const,
  context: 'PLAYER_SHIELD_BREAK' as const,
  text: 'One broken layer turns a clean negotiation into a pressure negotiation.',
  weight: 0.68,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'deal-room', 'formal', 'player_shield_break', 'deal_room']),
  heatFit: 0.30,
  pressureFit: 0.80,
  crowdFit: 0.47,
  silenceFit: 0.68,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_COMEBACK: Object.freeze([

Object.freeze({
  id: 'amb_deal_room_clerk_player_comeback_1_89dec98e66',
  personaId: 'DEAL_ROOM_CLERK' as const,
  context: 'PLAYER_COMEBACK' as const,
  text: 'Recovery improves your paper. Consistency improves your price.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'deal-room', 'formal', 'player_comeback', 'deal_room']),
  heatFit: 0.30,
  pressureFit: 0.80,
  crowdFit: 0.47,
  silenceFit: 0.68,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_deal_room_clerk_player_comeback_2_7e7ce2d040',
  personaId: 'DEAL_ROOM_CLERK' as const,
  context: 'PLAYER_COMEBACK' as const,
  text: 'A comeback repairs posture, but counterparties still inspect the seams.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'deal-room', 'formal', 'player_comeback', 'deal_room']),
  heatFit: 0.30,
  pressureFit: 0.80,
  crowdFit: 0.47,
  silenceFit: 0.68,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_LOST: Object.freeze([

Object.freeze({
  id: 'amb_deal_room_clerk_player_lost_1_062b6ef61f',
  personaId: 'DEAL_ROOM_CLERK' as const,
  context: 'PLAYER_LOST' as const,
  text: 'Terminal outcome filed. Most failed deals were visible long before the final number.',
  weight: 0.88,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'deal-room', 'formal', 'player_lost', 'deal_room']),
  heatFit: 0.30,
  pressureFit: 0.80,
  crowdFit: 0.47,
  silenceFit: 0.68,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_deal_room_clerk_player_lost_2_f54d405c3b',
  personaId: 'DEAL_ROOM_CLERK' as const,
  context: 'PLAYER_LOST' as const,
  text: 'The room closes on results, not intentions.',
  weight: 0.68,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'deal-room', 'formal', 'player_lost', 'deal_room']),
  heatFit: 0.30,
  pressureFit: 0.80,
  crowdFit: 0.47,
  silenceFit: 0.68,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          NEAR_SOVEREIGNTY: Object.freeze([

Object.freeze({
  id: 'amb_deal_room_clerk_near_sovereignty_1_e4f6244e6b',
  personaId: 'DEAL_ROOM_CLERK' as const,
  context: 'NEAR_SOVEREIGNTY' as const,
  text: 'At threshold range, every term becomes expensive and every concession becomes public memory.',
  weight: 0.88,
  minTick: 400,
  maxUses: 2,
  tags: Object.freeze(['ambient', 'deal-room', 'formal', 'near_sovereignty', 'deal_room']),
  heatFit: 0.30,
  pressureFit: 0.80,
  crowdFit: 0.47,
  silenceFit: 0.68,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_deal_room_clerk_near_sovereignty_2_bdf56b205a',
  personaId: 'DEAL_ROOM_CLERK' as const,
  context: 'NEAR_SOVEREIGNTY' as const,
  text: "You're close enough that bad pricing now will echo after the celebration ends.",
  weight: 0.68,
  minTick: 400,
  maxUses: 2,
  tags: Object.freeze(['ambient', 'deal-room', 'formal', 'near_sovereignty', 'deal_room']),
  heatFit: 0.30,
  pressureFit: 0.80,
  crowdFit: 0.47,
  silenceFit: 0.68,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          TIME_PRESSURE: Object.freeze([

Object.freeze({
  id: 'amb_deal_room_clerk_time_pressure_1_216e3061ba',
  personaId: 'DEAL_ROOM_CLERK' as const,
  context: 'TIME_PRESSURE' as const,
  text: 'Compressed windows create bad signatures. Read before you reach.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'deal-room', 'formal', 'time_pressure', 'deal_room']),
  heatFit: 0.30,
  pressureFit: 0.80,
  crowdFit: 0.47,
  silenceFit: 0.68,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_deal_room_clerk_time_pressure_2_5527ba7529',
  personaId: 'DEAL_ROOM_CLERK' as const,
  context: 'TIME_PRESSURE' as const,
  text: 'Urgency raises cost faster than it raises value.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'deal-room', 'formal', 'time_pressure', 'deal_room']),
  heatFit: 0.30,
  pressureFit: 0.80,
  crowdFit: 0.47,
  silenceFit: 0.68,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          CASCADE_CHAIN: Object.freeze([

Object.freeze({
  id: 'amb_deal_room_clerk_cascade_chain_1_2fe47ec88e',
  personaId: 'DEAL_ROOM_CLERK' as const,
  context: 'CASCADE_CHAIN' as const,
  text: 'Chains distort valuation. Good rooms slow down just enough to keep math honest.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'deal-room', 'formal', 'cascade_chain', 'deal_room']),
  heatFit: 0.30,
  pressureFit: 0.80,
  crowdFit: 0.47,
  silenceFit: 0.68,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_deal_room_clerk_cascade_chain_2_8b59686bb2',
  personaId: 'DEAL_ROOM_CLERK' as const,
  context: 'CASCADE_CHAIN' as const,
  text: 'Cascade activity noted. Temporary noise often hides permanent concessions.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'deal-room', 'formal', 'cascade_chain', 'deal_room']),
  heatFit: 0.30,
  pressureFit: 0.80,
  crowdFit: 0.47,
  silenceFit: 0.68,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          DEAL_ROOM_OFFER: Object.freeze([

Object.freeze({
  id: 'amb_deal_room_clerk_deal_room_offer_1_7374c54d1e',
  personaId: 'DEAL_ROOM_CLERK' as const,
  context: 'DEAL_ROOM_OFFER' as const,
  text: 'Offer logged. Tone says anchored. Timing says maybe not.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'deal-room', 'formal', 'deal_room_offer', 'deal_room']),
  heatFit: 0.30,
  pressureFit: 0.80,
  crowdFit: 0.47,
  silenceFit: 0.68,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_deal_room_clerk_deal_room_offer_2_f009b42a59',
  personaId: 'DEAL_ROOM_CLERK' as const,
  context: 'DEAL_ROOM_OFFER' as const,
  text: 'Number received. The gap between what is said and what is needed remains visible.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'deal-room', 'formal', 'deal_room_offer', 'deal_room']),
  heatFit: 0.30,
  pressureFit: 0.80,
  crowdFit: 0.47,
  silenceFit: 0.68,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          DEAL_ROOM_STALL: Object.freeze([

Object.freeze({
  id: 'amb_deal_room_clerk_deal_room_stall_1_e928ee8d0c',
  personaId: 'DEAL_ROOM_CLERK' as const,
  context: 'DEAL_ROOM_STALL' as const,
  text: 'Stall recorded. Silence is now part of the offer structure.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'deal-room', 'formal', 'deal_room_stall', 'deal_room']),
  heatFit: 0.30,
  pressureFit: 0.80,
  crowdFit: 0.47,
  silenceFit: 0.68,
  shadowEligible: true,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_deal_room_clerk_deal_room_stall_2_9a8a4141db',
  personaId: 'DEAL_ROOM_CLERK' as const,
  context: 'DEAL_ROOM_STALL' as const,
  text: 'No movement. Delay itself has become a negotiating term.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'deal-room', 'formal', 'deal_room_stall', 'deal_room']),
  heatFit: 0.30,
  pressureFit: 0.80,
  crowdFit: 0.47,
  silenceFit: 0.68,
  shadowEligible: true,
  cadenceFloorMs: 11750,
}),
          ]),
          SYNDICATE_JOIN: Object.freeze([

Object.freeze({
  id: 'amb_deal_room_clerk_syndicate_join_1_b3d539c8c6',
  personaId: 'DEAL_ROOM_CLERK' as const,
  context: 'SYNDICATE_JOIN' as const,
  text: 'Coalition change affects bargaining posture immediately.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'deal-room', 'formal', 'syndicate_join', 'deal_room']),
  heatFit: 0.30,
  pressureFit: 0.80,
  crowdFit: 0.47,
  silenceFit: 0.68,
  shadowEligible: true,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_deal_room_clerk_syndicate_join_2_6cd9a0de84',
  personaId: 'DEAL_ROOM_CLERK' as const,
  context: 'SYNDICATE_JOIN' as const,
  text: 'Additional affiliation noted. Counterparties will reprice trust before they reprice assets.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'deal-room', 'formal', 'syndicate_join', 'deal_room']),
  heatFit: 0.30,
  pressureFit: 0.80,
  crowdFit: 0.47,
  silenceFit: 0.68,
  shadowEligible: true,
  cadenceFloorMs: 11750,
}),
          ]),
          ATTACK_DEFLECTED: Object.freeze([

Object.freeze({
  id: 'amb_deal_room_clerk_attack_deflected_1_fa7be0c70a',
  personaId: 'DEAL_ROOM_CLERK' as const,
  context: 'ATTACK_DEFLECTED' as const,
  text: 'Deflection strengthened your leverage for one narrow window.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'deal-room', 'formal', 'attack_deflected', 'deal_room']),
  heatFit: 0.30,
  pressureFit: 0.80,
  crowdFit: 0.47,
  silenceFit: 0.68,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_deal_room_clerk_attack_deflected_2_758a73439a',
  personaId: 'DEAL_ROOM_CLERK' as const,
  context: 'ATTACK_DEFLECTED' as const,
  text: 'That counter matters because it restored optionality, not just dignity.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'deal-room', 'formal', 'attack_deflected', 'deal_room']),
  heatFit: 0.30,
  pressureFit: 0.80,
  crowdFit: 0.47,
  silenceFit: 0.68,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
      }),
      LOBBY_RUNNER: Object.freeze({

          GAME_START: Object.freeze([

Object.freeze({
  id: 'amb_lobby_runner_game_start_1_72662b3d3a',
  personaId: 'LOBBY_RUNNER' as const,
  context: 'GAME_START' as const,
  text: "Match door's open. Leave the lobby version of yourself here or it'll cost you later.",
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'lobby', 'queue', 'game_start']),
  heatFit: 0.48,
  pressureFit: 0.26,
  crowdFit: 0.47,
  silenceFit: 0.42,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_lobby_runner_game_start_2_a0d990980b',
  personaId: 'LOBBY_RUNNER' as const,
  context: 'GAME_START' as const,
  text: 'Pre-run energy is high. Best use of it is organization, not noise.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'lobby', 'queue', 'game_start']),
  heatFit: 0.48,
  pressureFit: 0.26,
  crowdFit: 0.47,
  silenceFit: 0.42,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          LOBBY_QUEUE: Object.freeze([

Object.freeze({
  id: 'amb_lobby_runner_lobby_queue_1_4c35f7f397',
  personaId: 'LOBBY_RUNNER' as const,
  context: 'LOBBY_QUEUE' as const,
  text: 'Queue keeps moving for people who arrive ready.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'lobby', 'queue', 'lobby_queue']),
  heatFit: 0.48,
  pressureFit: 0.26,
  crowdFit: 0.47,
  silenceFit: 0.42,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_lobby_runner_lobby_queue_2_4e5c740ec1',
  personaId: 'LOBBY_RUNNER' as const,
  context: 'LOBBY_QUEUE' as const,
  text: 'You can usually tell who practiced in quiet by how little they need the room right now.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'lobby', 'queue', 'lobby_queue']),
  heatFit: 0.48,
  pressureFit: 0.26,
  crowdFit: 0.47,
  silenceFit: 0.42,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_IDLE: Object.freeze([

Object.freeze({
  id: 'amb_lobby_runner_player_idle_1_e5605b8581',
  personaId: 'LOBBY_RUNNER' as const,
  context: 'PLAYER_IDLE' as const,
  text: 'Lobby habit sneaking into live play. Happens more than people admit.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'lobby', 'queue', 'player_idle']),
  heatFit: 0.48,
  pressureFit: 0.26,
  crowdFit: 0.47,
  silenceFit: 0.58,
  shadowEligible: true,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_lobby_runner_player_idle_2_dc32e4ee3e',
  personaId: 'LOBBY_RUNNER' as const,
  context: 'PLAYER_IDLE' as const,
  text: "Still waiting like the run hasn't started. It started.",
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'lobby', 'queue', 'player_idle']),
  heatFit: 0.48,
  pressureFit: 0.26,
  crowdFit: 0.47,
  silenceFit: 0.58,
  shadowEligible: true,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_INCOME_UP: Object.freeze([

Object.freeze({
  id: 'amb_lobby_runner_player_income_up_1_bca1c4f12a',
  personaId: 'LOBBY_RUNNER' as const,
  context: 'PLAYER_INCOME_UP' as const,
  text: 'Good sign. Early growth makes the whole entrance look smarter.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'lobby', 'queue', 'player_income_up']),
  heatFit: 0.48,
  pressureFit: 0.26,
  crowdFit: 0.47,
  silenceFit: 0.42,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_lobby_runner_player_income_up_2_1f37463db9',
  personaId: 'LOBBY_RUNNER' as const,
  context: 'PLAYER_INCOME_UP' as const,
  text: 'That kind of bump calms a room that was ready to doubt you.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'lobby', 'queue', 'player_income_up']),
  heatFit: 0.48,
  pressureFit: 0.26,
  crowdFit: 0.47,
  silenceFit: 0.42,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_SHIELD_BREAK: Object.freeze([

Object.freeze({
  id: 'amb_lobby_runner_player_shield_break_1_986099b12c',
  personaId: 'LOBBY_RUNNER' as const,
  context: 'PLAYER_SHIELD_BREAK' as const,
  text: 'Lobby air just vanished. Everyone felt that one.',
  weight: 0.88,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'lobby', 'queue', 'player_shield_break']),
  heatFit: 0.48,
  pressureFit: 0.26,
  crowdFit: 0.47,
  silenceFit: 0.42,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_lobby_runner_player_shield_break_2_3c887f9409',
  personaId: 'LOBBY_RUNNER' as const,
  context: 'PLAYER_SHIELD_BREAK' as const,
  text: 'Nothing sobers a room like hearing a shield layer disappear early.',
  weight: 0.68,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'lobby', 'queue', 'player_shield_break']),
  heatFit: 0.48,
  pressureFit: 0.26,
  crowdFit: 0.47,
  silenceFit: 0.42,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_COMEBACK: Object.freeze([

Object.freeze({
  id: 'amb_lobby_runner_player_comeback_1_88e05043dc',
  personaId: 'LOBBY_RUNNER' as const,
  context: 'PLAYER_COMEBACK' as const,
  text: "Now that's better. Rooms love being wrong when the correction is dramatic.",
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'lobby', 'queue', 'player_comeback']),
  heatFit: 0.48,
  pressureFit: 0.26,
  crowdFit: 0.47,
  silenceFit: 0.42,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_lobby_runner_player_comeback_2_cda1533e5b',
  personaId: 'LOBBY_RUNNER' as const,
  context: 'PLAYER_COMEBACK' as const,
  text: 'Good recovery. You just changed how the door crew says your name.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'lobby', 'queue', 'player_comeback']),
  heatFit: 0.48,
  pressureFit: 0.26,
  crowdFit: 0.47,
  silenceFit: 0.42,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_LOST: Object.freeze([

Object.freeze({
  id: 'amb_lobby_runner_player_lost_1_254d1123b5',
  personaId: 'LOBBY_RUNNER' as const,
  context: 'PLAYER_LOST' as const,
  text: "Run ended. Lobby's already splitting between mockery and note-taking.",
  weight: 0.88,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'lobby', 'queue', 'player_lost']),
  heatFit: 0.48,
  pressureFit: 0.26,
  crowdFit: 0.47,
  silenceFit: 0.42,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_lobby_runner_player_lost_2_a5c17a8f16',
  personaId: 'LOBBY_RUNNER' as const,
  context: 'PLAYER_LOST' as const,
  text: 'That finish is going to be replayed in queue talk for a while.',
  weight: 0.68,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'lobby', 'queue', 'player_lost']),
  heatFit: 0.48,
  pressureFit: 0.26,
  crowdFit: 0.47,
  silenceFit: 0.42,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          NEAR_SOVEREIGNTY: Object.freeze([

Object.freeze({
  id: 'amb_lobby_runner_near_sovereignty_1_8fb73abaab',
  personaId: 'LOBBY_RUNNER' as const,
  context: 'NEAR_SOVEREIGNTY' as const,
  text: "You're close enough that even the queue got quiet.",
  weight: 0.88,
  minTick: 400,
  maxUses: 2,
  tags: Object.freeze(['ambient', 'lobby', 'queue', 'near_sovereignty']),
  heatFit: 0.48,
  pressureFit: 0.26,
  crowdFit: 0.47,
  silenceFit: 0.42,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_lobby_runner_near_sovereignty_2_3b99ba044c',
  personaId: 'LOBBY_RUNNER' as const,
  context: 'NEAR_SOVEREIGNTY' as const,
  text: "Final approach. Lobby folks act casual, but they're all watching now.",
  weight: 0.68,
  minTick: 400,
  maxUses: 2,
  tags: Object.freeze(['ambient', 'lobby', 'queue', 'near_sovereignty']),
  heatFit: 0.48,
  pressureFit: 0.26,
  crowdFit: 0.47,
  silenceFit: 0.42,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          TIME_PRESSURE: Object.freeze([

Object.freeze({
  id: 'amb_lobby_runner_time_pressure_1_c1a6c349bc',
  personaId: 'LOBBY_RUNNER' as const,
  context: 'TIME_PRESSURE' as const,
  text: "Queue talk says don't chase the clock. Clock loves being chased.",
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'lobby', 'queue', 'time_pressure']),
  heatFit: 0.48,
  pressureFit: 0.26,
  crowdFit: 0.47,
  silenceFit: 0.42,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_lobby_runner_time_pressure_2_c21e39439a',
  personaId: 'LOBBY_RUNNER' as const,
  context: 'TIME_PRESSURE' as const,
  text: "Pressure's up. People from the lobby usually overplay this section.",
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'lobby', 'queue', 'time_pressure']),
  heatFit: 0.48,
  pressureFit: 0.26,
  crowdFit: 0.47,
  silenceFit: 0.42,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          CASCADE_CHAIN: Object.freeze([

Object.freeze({
  id: 'amb_lobby_runner_cascade_chain_1_c9dcc0f7af',
  personaId: 'LOBBY_RUNNER' as const,
  context: 'CASCADE_CHAIN' as const,
  text: 'Cascade hit and even the late arrivals noticed.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'lobby', 'queue', 'cascade_chain']),
  heatFit: 0.48,
  pressureFit: 0.26,
  crowdFit: 0.47,
  silenceFit: 0.42,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_lobby_runner_cascade_chain_2_e8b82f21cc',
  personaId: 'LOBBY_RUNNER' as const,
  context: 'CASCADE_CHAIN' as const,
  text: 'Chain reactions travel all the way back to the entrance in this place.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'lobby', 'queue', 'cascade_chain']),
  heatFit: 0.48,
  pressureFit: 0.26,
  crowdFit: 0.47,
  silenceFit: 0.42,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          DEAL_ROOM_OFFER: Object.freeze([

Object.freeze({
  id: 'amb_lobby_runner_deal_room_offer_1_5c0706c6d7',
  personaId: 'LOBBY_RUNNER' as const,
  context: 'DEAL_ROOM_OFFER' as const,
  text: 'Offer floated out and the queue started betting on the answer.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'lobby', 'queue', 'deal_room_offer']),
  heatFit: 0.48,
  pressureFit: 0.26,
  crowdFit: 0.47,
  silenceFit: 0.42,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_lobby_runner_deal_room_offer_2_93f98a2c0b',
  personaId: 'LOBBY_RUNNER' as const,
  context: 'DEAL_ROOM_OFFER' as const,
  text: "You'd be amazed how fast a number gets distorted on its walk back from the room.",
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'lobby', 'queue', 'deal_room_offer']),
  heatFit: 0.48,
  pressureFit: 0.26,
  crowdFit: 0.47,
  silenceFit: 0.42,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          DEAL_ROOM_STALL: Object.freeze([

Object.freeze({
  id: 'amb_lobby_runner_deal_room_stall_1_f1d954adfd',
  personaId: 'LOBBY_RUNNER' as const,
  context: 'DEAL_ROOM_STALL' as const,
  text: "Nothing from the room yet. That's when the lobby starts inventing secrets.",
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'lobby', 'queue', 'deal_room_stall']),
  heatFit: 0.48,
  pressureFit: 0.26,
  crowdFit: 0.47,
  silenceFit: 0.42,
  shadowEligible: true,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_lobby_runner_deal_room_stall_2_cecc83c17a',
  personaId: 'LOBBY_RUNNER' as const,
  context: 'DEAL_ROOM_STALL' as const,
  text: 'Stall detected. Entrance chatter just got ten times less reliable.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'lobby', 'queue', 'deal_room_stall']),
  heatFit: 0.48,
  pressureFit: 0.26,
  crowdFit: 0.47,
  silenceFit: 0.42,
  shadowEligible: true,
  cadenceFloorMs: 11750,
}),
          ]),
          SYNDICATE_JOIN: Object.freeze([

Object.freeze({
  id: 'amb_lobby_runner_syndicate_join_1_437e839675',
  personaId: 'LOBBY_RUNNER' as const,
  context: 'SYNDICATE_JOIN' as const,
  text: "Join confirmed. Queue's acting like it means less than it does.",
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'lobby', 'queue', 'syndicate_join']),
  heatFit: 0.48,
  pressureFit: 0.26,
  crowdFit: 0.47,
  silenceFit: 0.42,
  shadowEligible: true,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_lobby_runner_syndicate_join_2_243ed3708d',
  personaId: 'LOBBY_RUNNER' as const,
  context: 'SYNDICATE_JOIN' as const,
  text: "People always pretend coalition moves are casual. They're never casual.",
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'lobby', 'queue', 'syndicate_join']),
  heatFit: 0.48,
  pressureFit: 0.26,
  crowdFit: 0.47,
  silenceFit: 0.42,
  shadowEligible: true,
  cadenceFloorMs: 11750,
}),
          ]),
          ATTACK_DEFLECTED: Object.freeze([

Object.freeze({
  id: 'amb_lobby_runner_attack_deflected_1_b7055e725a',
  personaId: 'LOBBY_RUNNER' as const,
  context: 'ATTACK_DEFLECTED' as const,
  text: 'Nice save. Lobby respects survival when it can see the timing.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'lobby', 'queue', 'attack_deflected']),
  heatFit: 0.48,
  pressureFit: 0.26,
  crowdFit: 0.47,
  silenceFit: 0.42,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_lobby_runner_attack_deflected_2_8a9a53d392',
  personaId: 'LOBBY_RUNNER' as const,
  context: 'ATTACK_DEFLECTED' as const,
  text: 'That counter bought your name another round of goodwill at the door.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'lobby', 'queue', 'attack_deflected']),
  heatFit: 0.48,
  pressureFit: 0.26,
  crowdFit: 0.47,
  silenceFit: 0.42,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
      }),
      MARKET_HISTORIAN: Object.freeze({

          GAME_START: Object.freeze([

Object.freeze({
  id: 'amb_market_historian_game_start_1_47d16425c7',
  personaId: 'MARKET_HISTORIAN' as const,
  context: 'GAME_START' as const,
  text: 'Openings matter because memory loves first impressions and hates revisions.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'memory', 'history', 'game_start', 'global']),
  heatFit: 0.28,
  pressureFit: 0.44,
  crowdFit: 0.47,
  silenceFit: 0.84,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_market_historian_game_start_2_6f68276603',
  personaId: 'MARKET_HISTORIAN' as const,
  context: 'GAME_START' as const,
  text: 'Every significant run begins looking ordinary for a few ticks.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'memory', 'history', 'game_start', 'global']),
  heatFit: 0.28,
  pressureFit: 0.44,
  crowdFit: 0.47,
  silenceFit: 0.84,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          LOBBY_QUEUE: Object.freeze([

Object.freeze({
  id: 'amb_market_historian_lobby_queue_1_9a45d0cc73',
  personaId: 'MARKET_HISTORIAN' as const,
  context: 'LOBBY_QUEUE' as const,
  text: 'History says queues are where overconfidence speaks loudest and preparation says least.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'memory', 'history', 'lobby_queue', 'global']),
  heatFit: 0.28,
  pressureFit: 0.44,
  crowdFit: 0.47,
  silenceFit: 0.84,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_market_historian_lobby_queue_2_b8ccc76cd9',
  personaId: 'MARKET_HISTORIAN' as const,
  context: 'LOBBY_QUEUE' as const,
  text: 'The entrance has always been a museum of unnecessary tells.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'memory', 'history', 'lobby_queue', 'global']),
  heatFit: 0.28,
  pressureFit: 0.44,
  crowdFit: 0.47,
  silenceFit: 0.84,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_IDLE: Object.freeze([

Object.freeze({
  id: 'amb_market_historian_player_idle_1_541c0cd8c8',
  personaId: 'MARKET_HISTORIAN' as const,
  context: 'PLAYER_IDLE' as const,
  text: 'Pauses become lore when they happen before the irreversible move.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'memory', 'history', 'player_idle', 'global']),
  heatFit: 0.28,
  pressureFit: 0.44,
  crowdFit: 0.47,
  silenceFit: 0.16,
  shadowEligible: true,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_market_historian_player_idle_2_3d9b809eee',
  personaId: 'MARKET_HISTORIAN' as const,
  context: 'PLAYER_IDLE' as const,
  text: 'Memory records the space around decisions almost as carefully as the decisions themselves.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'memory', 'history', 'player_idle', 'global']),
  heatFit: 0.28,
  pressureFit: 0.44,
  crowdFit: 0.47,
  silenceFit: 0.16,
  shadowEligible: true,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_INCOME_UP: Object.freeze([

Object.freeze({
  id: 'amb_market_historian_player_income_up_1_6c678047b9',
  personaId: 'MARKET_HISTORIAN' as const,
  context: 'PLAYER_INCOME_UP' as const,
  text: 'Many remembered runs are built on small early climbs that looked boring at the time.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'memory', 'history', 'player_income_up', 'global']),
  heatFit: 0.28,
  pressureFit: 0.44,
  crowdFit: 0.47,
  silenceFit: 0.84,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_market_historian_player_income_up_2_fb6c92d0f2',
  personaId: 'MARKET_HISTORIAN' as const,
  context: 'PLAYER_INCOME_UP' as const,
  text: 'This is how real trajectories begin: not with fireworks, but with repeatable gain.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'memory', 'history', 'player_income_up', 'global']),
  heatFit: 0.28,
  pressureFit: 0.44,
  crowdFit: 0.47,
  silenceFit: 0.84,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_SHIELD_BREAK: Object.freeze([

Object.freeze({
  id: 'amb_market_historian_player_shield_break_1_e1237fce9c',
  personaId: 'MARKET_HISTORIAN' as const,
  context: 'PLAYER_SHIELD_BREAK' as const,
  text: 'Every archive of hard-won sovereignty includes at least one visible fracture.',
  weight: 0.88,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'memory', 'history', 'player_shield_break', 'global']),
  heatFit: 0.28,
  pressureFit: 0.44,
  crowdFit: 0.47,
  silenceFit: 0.84,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_market_historian_player_shield_break_2_70dd7680da',
  personaId: 'MARKET_HISTORIAN' as const,
  context: 'PLAYER_SHIELD_BREAK' as const,
  text: "History doesn't shame the breach. It studies what answered it.",
  weight: 0.68,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'memory', 'history', 'player_shield_break', 'global']),
  heatFit: 0.28,
  pressureFit: 0.44,
  crowdFit: 0.47,
  silenceFit: 0.84,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_COMEBACK: Object.freeze([

Object.freeze({
  id: 'amb_market_historian_player_comeback_1_74eaa15c60',
  personaId: 'MARKET_HISTORIAN' as const,
  context: 'PLAYER_COMEBACK' as const,
  text: 'Recoveries are where narrative stops belonging to spectators and starts belonging to the player.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'memory', 'history', 'player_comeback', 'global']),
  heatFit: 0.28,
  pressureFit: 0.44,
  crowdFit: 0.47,
  silenceFit: 0.84,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_market_historian_player_comeback_2_8f5e2dacc3',
  personaId: 'MARKET_HISTORIAN' as const,
  context: 'PLAYER_COMEBACK' as const,
  text: 'Combacks age well in memory because they expose structure, not just luck.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'memory', 'history', 'player_comeback', 'global']),
  heatFit: 0.28,
  pressureFit: 0.44,
  crowdFit: 0.47,
  silenceFit: 0.84,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_LOST: Object.freeze([

Object.freeze({
  id: 'amb_market_historian_player_lost_1_4063086b13',
  personaId: 'MARKET_HISTORIAN' as const,
  context: 'PLAYER_LOST' as const,
  text: 'Defeat closes a page, not the file.',
  weight: 0.88,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'memory', 'history', 'player_lost', 'global']),
  heatFit: 0.28,
  pressureFit: 0.44,
  crowdFit: 0.47,
  silenceFit: 0.84,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_market_historian_player_lost_2_920cccdbaf',
  personaId: 'MARKET_HISTORIAN' as const,
  context: 'PLAYER_LOST' as const,
  text: 'Losses that teach cleanly often matter more than wins that explain nothing.',
  weight: 0.68,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'memory', 'history', 'player_lost', 'global']),
  heatFit: 0.28,
  pressureFit: 0.44,
  crowdFit: 0.47,
  silenceFit: 0.84,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          NEAR_SOVEREIGNTY: Object.freeze([

Object.freeze({
  id: 'amb_market_historian_near_sovereignty_1_c2e9dcc04c',
  personaId: 'MARKET_HISTORIAN' as const,
  context: 'NEAR_SOVEREIGNTY' as const,
  text: 'Threshold moments alter not only a run but every earlier scene that led here.',
  weight: 0.88,
  minTick: 400,
  maxUses: 2,
  tags: Object.freeze(['ambient', 'memory', 'history', 'near_sovereignty', 'global']),
  heatFit: 0.28,
  pressureFit: 0.44,
  crowdFit: 0.47,
  silenceFit: 0.84,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_market_historian_near_sovereignty_2_8d32fa7546',
  personaId: 'MARKET_HISTORIAN' as const,
  context: 'NEAR_SOVEREIGNTY' as const,
  text: 'When sovereignty comes close, memory begins arranging the story in advance.',
  weight: 0.68,
  minTick: 400,
  maxUses: 2,
  tags: Object.freeze(['ambient', 'memory', 'history', 'near_sovereignty', 'global']),
  heatFit: 0.28,
  pressureFit: 0.44,
  crowdFit: 0.47,
  silenceFit: 0.84,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          TIME_PRESSURE: Object.freeze([

Object.freeze({
  id: 'amb_market_historian_time_pressure_1_ba0d65c87c',
  personaId: 'MARKET_HISTORIAN' as const,
  context: 'TIME_PRESSURE' as const,
  text: 'Clock compression is the ancient instrument of truth in games like this.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'memory', 'history', 'time_pressure', 'global']),
  heatFit: 0.28,
  pressureFit: 0.44,
  crowdFit: 0.47,
  silenceFit: 0.84,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_market_historian_time_pressure_2_983754e82a',
  personaId: 'MARKET_HISTORIAN' as const,
  context: 'TIME_PRESSURE' as const,
  text: 'Time reveals what preparation merely claimed.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'memory', 'history', 'time_pressure', 'global']),
  heatFit: 0.28,
  pressureFit: 0.44,
  crowdFit: 0.47,
  silenceFit: 0.84,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          CASCADE_CHAIN: Object.freeze([

Object.freeze({
  id: 'amb_market_historian_cascade_chain_1_0528902b23',
  personaId: 'MARKET_HISTORIAN' as const,
  context: 'CASCADE_CHAIN' as const,
  text: 'Archives love cascades because they make causality legible.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'memory', 'history', 'cascade_chain', 'global']),
  heatFit: 0.28,
  pressureFit: 0.44,
  crowdFit: 0.47,
  silenceFit: 0.84,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_market_historian_cascade_chain_2_0729a4a114',
  personaId: 'MARKET_HISTORIAN' as const,
  context: 'CASCADE_CHAIN' as const,
  text: 'Chains are rare gifts to memory: the room can see consequence walking in real time.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'memory', 'history', 'cascade_chain', 'global']),
  heatFit: 0.28,
  pressureFit: 0.44,
  crowdFit: 0.47,
  silenceFit: 0.84,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          DEAL_ROOM_OFFER: Object.freeze([

Object.freeze({
  id: 'amb_market_historian_deal_room_offer_1_1c954ff256',
  personaId: 'MARKET_HISTORIAN' as const,
  context: 'DEAL_ROOM_OFFER' as const,
  text: 'Some offers outlive the rooms that made them.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'memory', 'history', 'deal_room_offer', 'global']),
  heatFit: 0.28,
  pressureFit: 0.44,
  crowdFit: 0.47,
  silenceFit: 0.84,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_market_historian_deal_room_offer_2_9724e741d8',
  personaId: 'MARKET_HISTORIAN' as const,
  context: 'DEAL_ROOM_OFFER' as const,
  text: 'Negotiation leaves a longer shadow in memory than most combat does.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'memory', 'history', 'deal_room_offer', 'global']),
  heatFit: 0.28,
  pressureFit: 0.44,
  crowdFit: 0.47,
  silenceFit: 0.84,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          DEAL_ROOM_STALL: Object.freeze([

Object.freeze({
  id: 'amb_market_historian_deal_room_stall_1_63f44877ca',
  personaId: 'MARKET_HISTORIAN' as const,
  context: 'DEAL_ROOM_STALL' as const,
  text: 'Stalled rooms often hide the most important decision of the night.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'memory', 'history', 'deal_room_stall', 'global']),
  heatFit: 0.28,
  pressureFit: 0.44,
  crowdFit: 0.47,
  silenceFit: 0.84,
  shadowEligible: true,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_market_historian_deal_room_stall_2_06f420b528',
  personaId: 'MARKET_HISTORIAN' as const,
  context: 'DEAL_ROOM_STALL' as const,
  text: 'History is full of silences that mattered more than speeches.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'memory', 'history', 'deal_room_stall', 'global']),
  heatFit: 0.28,
  pressureFit: 0.44,
  crowdFit: 0.47,
  silenceFit: 0.84,
  shadowEligible: true,
  cadenceFloorMs: 11750,
}),
          ]),
          SYNDICATE_JOIN: Object.freeze([

Object.freeze({
  id: 'amb_market_historian_syndicate_join_1_123a6b0fbc',
  personaId: 'MARKET_HISTORIAN' as const,
  context: 'SYNDICATE_JOIN' as const,
  text: 'Alliances are how memory becomes collective instead of personal.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'memory', 'history', 'syndicate_join', 'global']),
  heatFit: 0.28,
  pressureFit: 0.44,
  crowdFit: 0.47,
  silenceFit: 0.84,
  shadowEligible: true,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_market_historian_syndicate_join_2_d6896d21d9',
  personaId: 'MARKET_HISTORIAN' as const,
  context: 'SYNDICATE_JOIN' as const,
  text: 'Private bonds always reshape public histories later.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'memory', 'history', 'syndicate_join', 'global']),
  heatFit: 0.28,
  pressureFit: 0.44,
  crowdFit: 0.47,
  silenceFit: 0.84,
  shadowEligible: true,
  cadenceFloorMs: 11750,
}),
          ]),
          ATTACK_DEFLECTED: Object.freeze([

Object.freeze({
  id: 'amb_market_historian_attack_deflected_1_c884dd62ca',
  personaId: 'MARKET_HISTORIAN' as const,
  context: 'ATTACK_DEFLECTED' as const,
  text: 'Counters become legend when they arrive exactly one beat before collapse.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'memory', 'history', 'attack_deflected', 'global']),
  heatFit: 0.28,
  pressureFit: 0.44,
  crowdFit: 0.47,
  silenceFit: 0.84,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_market_historian_attack_deflected_2_6916c74bd1',
  personaId: 'MARKET_HISTORIAN' as const,
  context: 'ATTACK_DEFLECTED' as const,
  text: 'That was the kind of save archives keep because it changed what followed.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'memory', 'history', 'attack_deflected', 'global']),
  heatFit: 0.28,
  pressureFit: 0.44,
  crowdFit: 0.47,
  silenceFit: 0.84,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
      }),
      THREAT_SPOTTER: Object.freeze({

          GAME_START: Object.freeze([

Object.freeze({
  id: 'amb_threat_spotter_game_start_1_f2c830827f',
  personaId: 'THREAT_SPOTTER' as const,
  context: 'GAME_START' as const,
  text: "Threat board green for now. Doesn't stay green long around ambition.",
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'threat', 'alert', 'game_start', 'global']),
  heatFit: 0.66,
  pressureFit: 0.92,
  crowdFit: 0.47,
  silenceFit: 0.18,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_threat_spotter_game_start_2_1c48c607e2',
  personaId: 'THREAT_SPOTTER' as const,
  context: 'GAME_START' as const,
  text: 'I watch for patterns that arrive before damage does. Opening is already saying things.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'threat', 'alert', 'game_start', 'global']),
  heatFit: 0.66,
  pressureFit: 0.92,
  crowdFit: 0.47,
  silenceFit: 0.18,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          LOBBY_QUEUE: Object.freeze([

Object.freeze({
  id: 'amb_threat_spotter_lobby_queue_1_a6c7dfff6c',
  personaId: 'THREAT_SPOTTER' as const,
  context: 'LOBBY_QUEUE' as const,
  text: 'Pre-run scans show bravado exceeding protection in several lanes.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'threat', 'alert', 'lobby_queue', 'global']),
  heatFit: 0.66,
  pressureFit: 0.92,
  crowdFit: 0.47,
  silenceFit: 0.18,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_threat_spotter_lobby_queue_2_5f4895e862',
  personaId: 'THREAT_SPOTTER' as const,
  context: 'LOBBY_QUEUE' as const,
  text: "Queue energy often hides the first real vulnerability: people think the threat isn't live yet.",
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'threat', 'alert', 'lobby_queue', 'global']),
  heatFit: 0.66,
  pressureFit: 0.92,
  crowdFit: 0.47,
  silenceFit: 0.18,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_IDLE: Object.freeze([

Object.freeze({
  id: 'amb_threat_spotter_player_idle_1_625c683ba5',
  personaId: 'THREAT_SPOTTER' as const,
  context: 'PLAYER_IDLE' as const,
  text: 'Idle posture increases attack quality for anyone watching closely.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'threat', 'alert', 'player_idle', 'global']),
  heatFit: 0.66,
  pressureFit: 0.92,
  crowdFit: 0.47,
  silenceFit: 0.82,
  shadowEligible: true,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_threat_spotter_player_idle_2_48d4afed3b',
  personaId: 'THREAT_SPOTTER' as const,
  context: 'PLAYER_IDLE' as const,
  text: 'Stillness confirmed. Predators treat waiting like an invitation if it repeats.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'threat', 'alert', 'player_idle', 'global']),
  heatFit: 0.66,
  pressureFit: 0.92,
  crowdFit: 0.47,
  silenceFit: 0.82,
  shadowEligible: true,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_INCOME_UP: Object.freeze([

Object.freeze({
  id: 'amb_threat_spotter_player_income_up_1_b40fe23435',
  personaId: 'THREAT_SPOTTER' as const,
  context: 'PLAYER_INCOME_UP' as const,
  text: 'Growth signal emitted. Threat likelihood just stepped up a tier.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'threat', 'alert', 'player_income_up', 'global']),
  heatFit: 0.66,
  pressureFit: 0.92,
  crowdFit: 0.47,
  silenceFit: 0.18,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_threat_spotter_player_income_up_2_bd17bb7f87',
  personaId: 'THREAT_SPOTTER' as const,
  context: 'PLAYER_INCOME_UP' as const,
  text: "Bigger numbers make cleaner targets. That's not pessimism; that's routing.",
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'threat', 'alert', 'player_income_up', 'global']),
  heatFit: 0.66,
  pressureFit: 0.92,
  crowdFit: 0.47,
  silenceFit: 0.18,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_SHIELD_BREAK: Object.freeze([

Object.freeze({
  id: 'amb_threat_spotter_player_shield_break_1_63128c45b0',
  personaId: 'THREAT_SPOTTER' as const,
  context: 'PLAYER_SHIELD_BREAK' as const,
  text: 'Alert: exposed surface increased. Secondary pressure likely.',
  weight: 0.88,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'threat', 'alert', 'player_shield_break', 'global']),
  heatFit: 0.66,
  pressureFit: 0.92,
  crowdFit: 0.47,
  silenceFit: 0.18,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_threat_spotter_player_shield_break_2_81406b2dc5',
  personaId: 'THREAT_SPOTTER' as const,
  context: 'PLAYER_SHIELD_BREAK' as const,
  text: 'Breach verified. Threat map now assumes appetite on the other side of that crack.',
  weight: 0.68,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'threat', 'alert', 'player_shield_break', 'global']),
  heatFit: 0.66,
  pressureFit: 0.92,
  crowdFit: 0.47,
  silenceFit: 0.18,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_COMEBACK: Object.freeze([

Object.freeze({
  id: 'amb_threat_spotter_player_comeback_1_1ff4ded13e',
  personaId: 'THREAT_SPOTTER' as const,
  context: 'PLAYER_COMEBACK' as const,
  text: 'Threat table re-evaluating. Survivors force enemies to spend smarter.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'threat', 'alert', 'player_comeback', 'global']),
  heatFit: 0.66,
  pressureFit: 0.92,
  crowdFit: 0.47,
  silenceFit: 0.18,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_threat_spotter_player_comeback_2_6a4f7f505e',
  personaId: 'THREAT_SPOTTER' as const,
  context: 'PLAYER_COMEBACK' as const,
  text: "Recovery changed attack math. That's useful, but temporary if structure doesn't follow.",
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'threat', 'alert', 'player_comeback', 'global']),
  heatFit: 0.66,
  pressureFit: 0.92,
  crowdFit: 0.47,
  silenceFit: 0.18,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_LOST: Object.freeze([

Object.freeze({
  id: 'amb_threat_spotter_player_lost_1_2c5e269563',
  personaId: 'THREAT_SPOTTER' as const,
  context: 'PLAYER_LOST' as const,
  text: "Threat state collapsed with the run. Root cause wasn't the final hit alone.",
  weight: 0.88,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'threat', 'alert', 'player_lost', 'global']),
  heatFit: 0.66,
  pressureFit: 0.92,
  crowdFit: 0.47,
  silenceFit: 0.18,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_threat_spotter_player_lost_2_ae0cd327cd',
  personaId: 'THREAT_SPOTTER' as const,
  context: 'PLAYER_LOST' as const,
  text: 'Terminal failure noted. Early signals were visible, just expensive to believe.',
  weight: 0.68,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'threat', 'alert', 'player_lost', 'global']),
  heatFit: 0.66,
  pressureFit: 0.92,
  crowdFit: 0.47,
  silenceFit: 0.18,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          NEAR_SOVEREIGNTY: Object.freeze([

Object.freeze({
  id: 'amb_threat_spotter_near_sovereignty_1_82af379f13',
  personaId: 'THREAT_SPOTTER' as const,
  context: 'NEAR_SOVEREIGNTY' as const,
  text: 'High-risk window. Final stretch invites coordinated denial behavior.',
  weight: 0.88,
  minTick: 400,
  maxUses: 2,
  tags: Object.freeze(['ambient', 'threat', 'alert', 'near_sovereignty', 'global']),
  heatFit: 0.66,
  pressureFit: 0.92,
  crowdFit: 0.47,
  silenceFit: 0.18,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_threat_spotter_near_sovereignty_2_68980269a7',
  personaId: 'THREAT_SPOTTER' as const,
  context: 'NEAR_SOVEREIGNTY' as const,
  text: "You're near enough that even weak enemies start sharing a motive.",
  weight: 0.68,
  minTick: 400,
  maxUses: 2,
  tags: Object.freeze(['ambient', 'threat', 'alert', 'near_sovereignty', 'global']),
  heatFit: 0.66,
  pressureFit: 0.92,
  crowdFit: 0.47,
  silenceFit: 0.18,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          TIME_PRESSURE: Object.freeze([

Object.freeze({
  id: 'amb_threat_spotter_time_pressure_1_6feacc4f9d',
  personaId: 'THREAT_SPOTTER' as const,
  context: 'TIME_PRESSURE' as const,
  text: 'Compressed time amplifies threat quality because defenses stop layering correctly.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'threat', 'alert', 'time_pressure', 'global']),
  heatFit: 0.66,
  pressureFit: 0.92,
  crowdFit: 0.47,
  silenceFit: 0.18,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_threat_spotter_time_pressure_2_9b42112003',
  personaId: 'THREAT_SPOTTER' as const,
  context: 'TIME_PRESSURE' as const,
  text: 'Pressure tier rising. Watch for attacks disguised as normal variance.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'threat', 'alert', 'time_pressure', 'global']),
  heatFit: 0.66,
  pressureFit: 0.92,
  crowdFit: 0.47,
  silenceFit: 0.18,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          CASCADE_CHAIN: Object.freeze([

Object.freeze({
  id: 'amb_threat_spotter_cascade_chain_1_ef7c152bd4',
  personaId: 'THREAT_SPOTTER' as const,
  context: 'CASCADE_CHAIN' as const,
  text: 'Cascade increases threat surface across systems, not just the visible lane.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'threat', 'alert', 'cascade_chain', 'global']),
  heatFit: 0.66,
  pressureFit: 0.92,
  crowdFit: 0.47,
  silenceFit: 0.18,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_threat_spotter_cascade_chain_2_b0a9234d0f',
  personaId: 'THREAT_SPOTTER' as const,
  context: 'CASCADE_CHAIN' as const,
  text: 'Chain confirmed. Threat model just widened from local to room-scale.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'threat', 'alert', 'cascade_chain', 'global']),
  heatFit: 0.66,
  pressureFit: 0.92,
  crowdFit: 0.47,
  silenceFit: 0.18,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          DEAL_ROOM_OFFER: Object.freeze([

Object.freeze({
  id: 'amb_threat_spotter_deal_room_offer_1_1f9d24c623',
  personaId: 'THREAT_SPOTTER' as const,
  context: 'DEAL_ROOM_OFFER' as const,
  text: 'Offers create openings whenever urgency exceeds verification.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'threat', 'alert', 'deal_room_offer', 'global']),
  heatFit: 0.66,
  pressureFit: 0.92,
  crowdFit: 0.47,
  silenceFit: 0.18,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_threat_spotter_deal_room_offer_2_245b928826',
  personaId: 'THREAT_SPOTTER' as const,
  context: 'DEAL_ROOM_OFFER' as const,
  text: 'Negotiation event marked. Pressure often hides inside attractive numbers.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'threat', 'alert', 'deal_room_offer', 'global']),
  heatFit: 0.66,
  pressureFit: 0.92,
  crowdFit: 0.47,
  silenceFit: 0.18,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          DEAL_ROOM_STALL: Object.freeze([

Object.freeze({
  id: 'amb_threat_spotter_deal_room_stall_1_528c9844e0',
  personaId: 'THREAT_SPOTTER' as const,
  context: 'DEAL_ROOM_STALL' as const,
  text: 'Stalls lengthen exposure. People forget silence is also a threat vector.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'threat', 'alert', 'deal_room_stall', 'global']),
  heatFit: 0.66,
  pressureFit: 0.92,
  crowdFit: 0.47,
  silenceFit: 0.18,
  shadowEligible: true,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_threat_spotter_deal_room_stall_2_257f514566',
  personaId: 'THREAT_SPOTTER' as const,
  context: 'DEAL_ROOM_STALL' as const,
  text: 'No movement in room. That gives hostile timing more space than you think.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'threat', 'alert', 'deal_room_stall', 'global']),
  heatFit: 0.66,
  pressureFit: 0.92,
  crowdFit: 0.47,
  silenceFit: 0.18,
  shadowEligible: true,
  cadenceFloorMs: 11750,
}),
          ]),
          SYNDICATE_JOIN: Object.freeze([

Object.freeze({
  id: 'amb_threat_spotter_syndicate_join_1_88130151a9',
  personaId: 'THREAT_SPOTTER' as const,
  context: 'SYNDICATE_JOIN' as const,
  text: 'Coalition update changes attack surface: more cover, more leak paths.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'threat', 'alert', 'syndicate_join', 'global']),
  heatFit: 0.66,
  pressureFit: 0.92,
  crowdFit: 0.47,
  silenceFit: 0.18,
  shadowEligible: true,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_threat_spotter_syndicate_join_2_a7b82ebce7',
  personaId: 'THREAT_SPOTTER' as const,
  context: 'SYNDICATE_JOIN' as const,
  text: 'New affiliation cuts one kind of danger and opens another.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'threat', 'alert', 'syndicate_join', 'global']),
  heatFit: 0.66,
  pressureFit: 0.92,
  crowdFit: 0.47,
  silenceFit: 0.18,
  shadowEligible: true,
  cadenceFloorMs: 11750,
}),
          ]),
          ATTACK_DEFLECTED: Object.freeze([

Object.freeze({
  id: 'amb_threat_spotter_attack_deflected_1_056c37ee0d',
  personaId: 'THREAT_SPOTTER' as const,
  context: 'ATTACK_DEFLECTED' as const,
  text: 'Threat spike absorbed. Good. Stay disciplined; deflections attract retests.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'threat', 'alert', 'attack_deflected', 'global']),
  heatFit: 0.66,
  pressureFit: 0.92,
  crowdFit: 0.47,
  silenceFit: 0.18,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_threat_spotter_attack_deflected_2_1b5e337508',
  personaId: 'THREAT_SPOTTER' as const,
  context: 'ATTACK_DEFLECTED' as const,
  text: "Nice counter. Spotters don't celebrate until the follow-up misses too.",
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'threat', 'alert', 'attack_deflected', 'global']),
  heatFit: 0.66,
  pressureFit: 0.92,
  crowdFit: 0.47,
  silenceFit: 0.18,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
      }),
      RESCUE_LOOKOUT: Object.freeze({

          GAME_START: Object.freeze([

Object.freeze({
  id: 'amb_rescue_lookout_game_start_1_b6d00f0645',
  personaId: 'RESCUE_LOOKOUT' as const,
  context: 'GAME_START' as const,
  text: "I watch the edge of frustration from the first tick because players rarely announce when they're slipping.",
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'rescue', 'recovery', 'game_start', 'global']),
  heatFit: 0.34,
  pressureFit: 0.78,
  crowdFit: 0.47,
  silenceFit: 0.58,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_rescue_lookout_game_start_2_9c3734242b',
  personaId: 'RESCUE_LOOKOUT' as const,
  context: 'GAME_START' as const,
  text: 'No rescue needed yet. Good. Clean starts save a lot of grief later.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'rescue', 'recovery', 'game_start', 'global']),
  heatFit: 0.34,
  pressureFit: 0.78,
  crowdFit: 0.47,
  silenceFit: 0.58,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          LOBBY_QUEUE: Object.freeze([

Object.freeze({
  id: 'amb_rescue_lookout_lobby_queue_1_730410946e',
  personaId: 'RESCUE_LOOKOUT' as const,
  context: 'LOBBY_QUEUE' as const,
  text: "Queues are where some players burn the calm they'll need later.",
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'rescue', 'recovery', 'lobby_queue', 'global']),
  heatFit: 0.34,
  pressureFit: 0.78,
  crowdFit: 0.47,
  silenceFit: 0.58,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_rescue_lookout_lobby_queue_2_d4ed82976b',
  personaId: 'RESCUE_LOOKOUT' as const,
  context: 'LOBBY_QUEUE' as const,
  text: 'Pre-run nerves are normal. The trick is not spending all your patience before the real test.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'rescue', 'recovery', 'lobby_queue', 'global']),
  heatFit: 0.34,
  pressureFit: 0.78,
  crowdFit: 0.47,
  silenceFit: 0.58,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_IDLE: Object.freeze([

Object.freeze({
  id: 'amb_rescue_lookout_player_idle_1_822573927d',
  personaId: 'RESCUE_LOOKOUT' as const,
  context: 'PLAYER_IDLE' as const,
  text: "Long pause noted. Sometimes that's planning. Sometimes it's the first sign the room got too loud.",
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'rescue', 'recovery', 'player_idle', 'global']),
  heatFit: 0.34,
  pressureFit: 0.78,
  crowdFit: 0.47,
  silenceFit: 0.42,
  shadowEligible: true,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_rescue_lookout_player_idle_2_a4be3b741c',
  personaId: 'RESCUE_LOOKOUT' as const,
  context: 'PLAYER_IDLE' as const,
  text: "I don't interrupt every silence. Only the ones that smell like drift instead of thought.",
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'rescue', 'recovery', 'player_idle', 'global']),
  heatFit: 0.34,
  pressureFit: 0.78,
  crowdFit: 0.47,
  silenceFit: 0.42,
  shadowEligible: true,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_INCOME_UP: Object.freeze([

Object.freeze({
  id: 'amb_rescue_lookout_player_income_up_1_6416aae472',
  personaId: 'RESCUE_LOOKOUT' as const,
  context: 'PLAYER_INCOME_UP' as const,
  text: 'Good. Small wins reduce panic if they happen before the first real hit.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'rescue', 'recovery', 'player_income_up', 'global']),
  heatFit: 0.34,
  pressureFit: 0.78,
  crowdFit: 0.47,
  silenceFit: 0.58,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_rescue_lookout_player_income_up_2_8bc874ff29',
  personaId: 'RESCUE_LOOKOUT' as const,
  context: 'PLAYER_INCOME_UP' as const,
  text: 'That climb buys breathing room, not immunity. Still, breathing room matters.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'rescue', 'recovery', 'player_income_up', 'global']),
  heatFit: 0.34,
  pressureFit: 0.78,
  crowdFit: 0.47,
  silenceFit: 0.58,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_SHIELD_BREAK: Object.freeze([

Object.freeze({
  id: 'amb_rescue_lookout_player_shield_break_1_1ae1166d05',
  personaId: 'RESCUE_LOOKOUT' as const,
  context: 'PLAYER_SHIELD_BREAK' as const,
  text: 'Breach confirmed. This is usually where frustration tries to take control of sequencing.',
  weight: 0.88,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'rescue', 'recovery', 'player_shield_break', 'global']),
  heatFit: 0.34,
  pressureFit: 0.78,
  crowdFit: 0.47,
  silenceFit: 0.58,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_rescue_lookout_player_shield_break_2_a028f32f00',
  personaId: 'RESCUE_LOOKOUT' as const,
  context: 'PLAYER_SHIELD_BREAK' as const,
  text: 'One broken layer can make people rush. Watch the urge before you watch the board.',
  weight: 0.68,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'rescue', 'recovery', 'player_shield_break', 'global']),
  heatFit: 0.34,
  pressureFit: 0.78,
  crowdFit: 0.47,
  silenceFit: 0.58,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_COMEBACK: Object.freeze([

Object.freeze({
  id: 'amb_rescue_lookout_player_comeback_1_eff56a2536',
  personaId: 'RESCUE_LOOKOUT' as const,
  context: 'PLAYER_COMEBACK' as const,
  text: "Recovery is more than state; it's proof you didn't let the room decide your pace.",
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'rescue', 'recovery', 'player_comeback', 'global']),
  heatFit: 0.34,
  pressureFit: 0.78,
  crowdFit: 0.47,
  silenceFit: 0.58,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_rescue_lookout_player_comeback_2_0bf17be8cf',
  personaId: 'RESCUE_LOOKOUT' as const,
  context: 'PLAYER_COMEBACK' as const,
  text: 'Nice rebound. People stay in runs because of moments exactly like that.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'rescue', 'recovery', 'player_comeback', 'global']),
  heatFit: 0.34,
  pressureFit: 0.78,
  crowdFit: 0.47,
  silenceFit: 0.58,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          PLAYER_LOST: Object.freeze([

Object.freeze({
  id: 'amb_rescue_lookout_player_lost_1_543a14e0fa',
  personaId: 'RESCUE_LOOKOUT' as const,
  context: 'PLAYER_LOST' as const,
  text: "Run's done. Let the board stop moving before you decide what the loss means.",
  weight: 0.88,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'rescue', 'recovery', 'player_lost', 'global']),
  heatFit: 0.34,
  pressureFit: 0.78,
  crowdFit: 0.47,
  silenceFit: 0.58,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_rescue_lookout_player_lost_2_e647e1106e',
  personaId: 'RESCUE_LOOKOUT' as const,
  context: 'PLAYER_LOST' as const,
  text: 'End state reached. Bad exits happen when players interpret pain faster than evidence.',
  weight: 0.68,

  maxUses: 2,
  tags: Object.freeze(['ambient', 'rescue', 'recovery', 'player_lost', 'global']),
  heatFit: 0.34,
  pressureFit: 0.78,
  crowdFit: 0.47,
  silenceFit: 0.58,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          NEAR_SOVEREIGNTY: Object.freeze([

Object.freeze({
  id: 'amb_rescue_lookout_near_sovereignty_1_6051a1ff0e',
  personaId: 'RESCUE_LOOKOUT' as const,
  context: 'NEAR_SOVEREIGNTY' as const,
  text: 'Close now. Final stretch failures often begin as emotional overreach, not strategic ignorance.',
  weight: 0.88,
  minTick: 400,
  maxUses: 2,
  tags: Object.freeze(['ambient', 'rescue', 'recovery', 'near_sovereignty', 'global']),
  heatFit: 0.34,
  pressureFit: 0.78,
  crowdFit: 0.47,
  silenceFit: 0.58,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_rescue_lookout_near_sovereignty_2_8a15c43fe8',
  personaId: 'RESCUE_LOOKOUT' as const,
  context: 'NEAR_SOVEREIGNTY' as const,
  text: 'Almost there. Guard your breathing as much as your shields.',
  weight: 0.68,
  minTick: 400,
  maxUses: 2,
  tags: Object.freeze(['ambient', 'rescue', 'recovery', 'near_sovereignty', 'global']),
  heatFit: 0.34,
  pressureFit: 0.78,
  crowdFit: 0.47,
  silenceFit: 0.58,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          TIME_PRESSURE: Object.freeze([

Object.freeze({
  id: 'amb_rescue_lookout_time_pressure_1_b52852553a',
  personaId: 'RESCUE_LOOKOUT' as const,
  context: 'TIME_PRESSURE' as const,
  text: "Pressure compresses attention first, then judgment. Don't give it both.",
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'rescue', 'recovery', 'time_pressure', 'global']),
  heatFit: 0.34,
  pressureFit: 0.78,
  crowdFit: 0.47,
  silenceFit: 0.58,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_rescue_lookout_time_pressure_2_271b022a7a',
  personaId: 'RESCUE_LOOKOUT' as const,
  context: 'TIME_PRESSURE' as const,
  text: 'Fast clocks create fake emergencies. Learn which urgency is real.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'rescue', 'recovery', 'time_pressure', 'global']),
  heatFit: 0.34,
  pressureFit: 0.78,
  crowdFit: 0.47,
  silenceFit: 0.58,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          CASCADE_CHAIN: Object.freeze([

Object.freeze({
  id: 'amb_rescue_lookout_cascade_chain_1_c7b1348810',
  personaId: 'RESCUE_LOOKOUT' as const,
  context: 'CASCADE_CHAIN' as const,
  text: 'Chains are where overwhelmed players stop distinguishing signal from tempo.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'rescue', 'recovery', 'cascade_chain', 'global']),
  heatFit: 0.34,
  pressureFit: 0.78,
  crowdFit: 0.47,
  silenceFit: 0.58,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_rescue_lookout_cascade_chain_2_7a2626eeec',
  personaId: 'RESCUE_LOOKOUT' as const,
  context: 'CASCADE_CHAIN' as const,
  text: "If the board feels loud, narrow your next decision until it's quiet again.",
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'rescue', 'recovery', 'cascade_chain', 'global']),
  heatFit: 0.34,
  pressureFit: 0.78,
  crowdFit: 0.47,
  silenceFit: 0.58,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          DEAL_ROOM_OFFER: Object.freeze([

Object.freeze({
  id: 'amb_rescue_lookout_deal_room_offer_1_4bf6f8a334',
  personaId: 'RESCUE_LOOKOUT' as const,
  context: 'DEAL_ROOM_OFFER' as const,
  text: "Offers land harder when you're tired. Tired players overpay for closure.",
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'rescue', 'recovery', 'deal_room_offer', 'global']),
  heatFit: 0.34,
  pressureFit: 0.78,
  crowdFit: 0.47,
  silenceFit: 0.58,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_rescue_lookout_deal_room_offer_2_cf289ed0dc',
  personaId: 'RESCUE_LOOKOUT' as const,
  context: 'DEAL_ROOM_OFFER' as const,
  text: 'A tempting number is not the same thing as a safe number.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'rescue', 'recovery', 'deal_room_offer', 'global']),
  heatFit: 0.34,
  pressureFit: 0.78,
  crowdFit: 0.47,
  silenceFit: 0.58,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
          DEAL_ROOM_STALL: Object.freeze([

Object.freeze({
  id: 'amb_rescue_lookout_deal_room_stall_1_716b6d893b',
  personaId: 'RESCUE_LOOKOUT' as const,
  context: 'DEAL_ROOM_STALL' as const,
  text: 'Long stalls can push people into self-betrayal just to end uncertainty.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'rescue', 'recovery', 'deal_room_stall', 'global']),
  heatFit: 0.34,
  pressureFit: 0.78,
  crowdFit: 0.47,
  silenceFit: 0.58,
  shadowEligible: true,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_rescue_lookout_deal_room_stall_2_27f4070647',
  personaId: 'RESCUE_LOOKOUT' as const,
  context: 'DEAL_ROOM_STALL' as const,
  text: 'Nothing moving yet. Good time to protect judgment from impatience.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'rescue', 'recovery', 'deal_room_stall', 'global']),
  heatFit: 0.34,
  pressureFit: 0.78,
  crowdFit: 0.47,
  silenceFit: 0.58,
  shadowEligible: true,
  cadenceFloorMs: 11750,
}),
          ]),
          SYNDICATE_JOIN: Object.freeze([

Object.freeze({
  id: 'amb_rescue_lookout_syndicate_join_1_ce3b3a9b0d',
  personaId: 'RESCUE_LOOKOUT' as const,
  context: 'SYNDICATE_JOIN' as const,
  text: 'Joining rooms helps only if it reduces noise instead of adding another stage to perform on.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'rescue', 'recovery', 'syndicate_join', 'global']),
  heatFit: 0.34,
  pressureFit: 0.78,
  crowdFit: 0.47,
  silenceFit: 0.58,
  shadowEligible: true,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_rescue_lookout_syndicate_join_2_2b1a4e46e4',
  personaId: 'RESCUE_LOOKOUT' as const,
  context: 'SYNDICATE_JOIN' as const,
  text: 'New allies are useful. New expectations are heavy. Carry only what helps.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'rescue', 'recovery', 'syndicate_join', 'global']),
  heatFit: 0.34,
  pressureFit: 0.78,
  crowdFit: 0.47,
  silenceFit: 0.58,
  shadowEligible: true,
  cadenceFloorMs: 11750,
}),
          ]),
          ATTACK_DEFLECTED: Object.freeze([

Object.freeze({
  id: 'amb_rescue_lookout_attack_deflected_1_f6b275e0f9',
  personaId: 'RESCUE_LOOKOUT' as const,
  context: 'ATTACK_DEFLECTED' as const,
  text: 'Good. Counters like that lower panic in the body before they lower danger on the board.',
  weight: 0.88,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'rescue', 'recovery', 'attack_deflected', 'global']),
  heatFit: 0.34,
  pressureFit: 0.78,
  crowdFit: 0.47,
  silenceFit: 0.58,
  shadowEligible: false,
  cadenceFloorMs: 10550,
}),
Object.freeze({
  id: 'amb_rescue_lookout_attack_deflected_2_672c7b35cd',
  personaId: 'RESCUE_LOOKOUT' as const,
  context: 'ATTACK_DEFLECTED' as const,
  text: 'Deflection clean. Take the win as information, not permission to drift.',
  weight: 0.68,

  maxUses: 3,
  tags: Object.freeze(['ambient', 'rescue', 'recovery', 'attack_deflected', 'global']),
  heatFit: 0.34,
  pressureFit: 0.78,
  crowdFit: 0.47,
  silenceFit: 0.58,
  shadowEligible: false,
  cadenceFloorMs: 11750,
}),
          ]),
      }),
});

export class AmbientNpcRegistry {
  private readonly profiles = AMBIENT_PERSONA_PROFILES;
  private readonly lines = AMBIENT_DIALOGUE_LINES;

  public listPersonaIds(): readonly AmbientNpcPersonaId[] {
    return Object.freeze(Object.keys(this.profiles) as AmbientNpcPersonaId[]);
  }

  public listProfiles(): readonly AmbientNpcProfile[] {
    return Object.freeze(this.listPersonaIds().map((id) => this.profiles[id]));
  }

  public hasPersona(personaId: string): personaId is AmbientNpcPersonaId {
    return Object.prototype.hasOwnProperty.call(this.profiles, personaId);
  }

  public getProfile(personaId: AmbientNpcPersonaId): AmbientNpcProfile {
    return this.profiles[personaId];
  }

  public listContexts(): readonly AmbientNpcContext[] {
    return DEFAULT_CONTEXTS;
  }

  public getLines(personaId: AmbientNpcPersonaId, context: AmbientNpcContext): readonly AmbientNpcLine[] {
    return this.lines[personaId][context];
  }

  public getAllLinesForPersona(personaId: AmbientNpcPersonaId): readonly AmbientNpcLine[] {
    return Object.freeze(DEFAULT_CONTEXTS.flatMap((context) => this.lines[personaId][context]));
  }

  public resolveChannelCast(channel: AmbientChannelAffinity): readonly AmbientNpcPersonaId[] {
    return Object.freeze(
      this.listPersonaIds().filter((personaId) => this.profiles[personaId].channelAffinity === channel),
    );
  }

  public resolveModeCast(modeId: string | undefined): readonly AmbientNpcPersonaId[] {
    const normalized = (modeId ?? '').toLowerCase();
    if (normalized.includes('deal')) return Object.freeze(['DEAL_ROOM_CLERK', 'SYNDICATE_WHISPER', 'MARKET_HISTORIAN']);
    if (normalized.includes('lobby')) return Object.freeze(['LOBBY_RUNNER', 'FLOOR_RUNNER', 'GLOBAL_PIT']);
    if (normalized.includes('syndicate')) return Object.freeze(['SYNDICATE_WHISPER', 'MARKET_HISTORIAN', 'RESCUE_LOOKOUT']);
    if (normalized.includes('league')) return Object.freeze(['LEAGUE_OBSERVER', 'GLOBAL_PIT', 'CROWD_BROKER']);
    if (normalized.includes('battle') || normalized.includes('run')) return Object.freeze(['THREAT_SPOTTER', 'GLOBAL_PIT', 'FLOOR_RUNNER', 'RESCUE_LOOKOUT']);
    return this.listPersonaIds();
  }

  public selectBestLine(input: AmbientSelectionInput): AmbientNpcLine | null {
    const personas = input.personaId
      ? [input.personaId]
      : (input.channel ? this.resolveChannelCast(input.channel) : this.listPersonaIds());

    let best: AmbientNpcLine | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const personaId of personas) {
      for (const line of this.lines[personaId][input.context]) {
        const score = scoreLine(line, input);
        if (score > bestScore) {
          best = line;
          bestScore = score;
        }
      }
    }

    return best;
  }

  public rankScenario(input: AmbientSelectionInput): readonly AmbientScenarioCandidate[] {
    const personas = input.personaId
      ? [input.personaId]
      : (input.channel ? this.resolveChannelCast(input.channel) : this.listPersonaIds());

    const candidates: AmbientScenarioCandidate[] = [];
    for (const personaId of personas) {
      for (const line of this.lines[personaId][input.context]) {
        const score = scoreLine(line, input);
        if (Number.isFinite(score)) {
          candidates.push({ persona: this.profiles[personaId], line, score });
        }
      }
    }

    candidates.sort((left, right) => right.score - left.score || stableHash(left.line.id) - stableHash(right.line.id));
    return Object.freeze(candidates);
  }

  public resolveWitnessPersona(input: AmbientSelectionInput): AmbientNpcPersonaId {
    const pressure = clamp01(input.pressure);
    const heat = clamp01(input.heat);
    const silenceDebt = clamp01(input.silenceDebt);
    const normalizedMode = (input.modeId ?? '').toLowerCase();

    if (input.context === 'PLAYER_SHIELD_BREAK') return 'THREAT_SPOTTER';
    if (input.context === 'PLAYER_LOST') return pressure >= 0.55 ? 'RESCUE_LOOKOUT' : 'MARKET_HISTORIAN';
    if (input.context === 'NEAR_SOVEREIGNTY') return heat >= 0.6 ? 'GLOBAL_PIT' : 'LEAGUE_OBSERVER';
    if (input.context === 'DEAL_ROOM_OFFER' || input.context === 'DEAL_ROOM_STALL' || normalizedMode.includes('deal')) return 'DEAL_ROOM_CLERK';
    if (input.context === 'SYNDICATE_JOIN' || normalizedMode.includes('syndicate')) return 'SYNDICATE_WHISPER';
    if (input.context === 'PLAYER_IDLE' && silenceDebt >= 0.55) return 'RESCUE_LOOKOUT';
    if (input.context === 'TIME_PRESSURE') return 'FLOOR_RUNNER';
    if (input.context === 'CASCADE_CHAIN') return heat >= 0.7 ? 'CROWD_BROKER' : 'MARKET_HISTORIAN';
    return 'GLOBAL_PIT';
  }

  public getSnapshot(): AmbientRegistrySnapshot {
    const linesByPersona = {} as Record<AmbientNpcPersonaId, number>;
    let totalLines = 0;
    for (const personaId of this.listPersonaIds()) {
      const count = this.getAllLinesForPersona(personaId).length;
      linesByPersona[personaId] = count;
      totalLines += count;
    }

    return Object.freeze({
      personas: this.listProfiles(),
      totalLines,
      contexts: this.listContexts(),
      linesByPersona: Object.freeze(linesByPersona),
    });
  }

  public buildOccupancyMatrix(): Readonly<Record<AmbientNpcPersonaId, number>> {
    const output: Partial<Record<AmbientNpcPersonaId, number>> = {};
    for (const personaId of this.listPersonaIds()) {
      output[personaId] = this.profiles[personaId].occupancyFloor;
    }
    return Object.freeze(output as Record<AmbientNpcPersonaId, number>);
  }
}

export const createAmbientNpcRegistry = (): AmbientNpcRegistry => new AmbientNpcRegistry();
export const ambientNpcRegistry = new AmbientNpcRegistry();
