/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT TELEGRAPH POLICY
 * FILE: backend/src/game/engine/chat/combat/ChatTelegraphPolicy.ts
 * VERSION: 2026.03.23
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Backend authority for conversational attack telegraphs.
 *
 * This module is the server-side law that determines how a hostile chat attack
 * should announce itself before resolution. In this stack, the telegraph is not
 * flavor text. It is the readable pressure envelope that makes language combat
 * fair, legible, theatrical, and replayable.
 *
 * What this file owns
 * -------------------
 * - selecting the authoritative telegraph profile for a fight / round / attack,
 * - determining whether the player should see the threat, feel it, or only infer it,
 * - staging beat-by-beat lead-in timing, reveal timing, typing theater, and silence,
 * - projecting witness density, crowd posture, helper intercept risk, and proof cues,
 * - mapping telegraph semantics onto overlay-oriented payloads such as threat radar,
 *   moment flash, proof-oriented hinting, rescue banners, and counterplay prompts,
 * - and returning deterministic projections the rest of the backend can trust.
 *
 * What this file does not own
 * ---------------------------
 * - transcript mutation,
 * - socket fanout,
 * - frontend-specific rendering decisions,
 * - counter resolution itself,
 * - or fight-level final authority.
 *
 * Design doctrine
 * ---------------
 * - Telegraphs must make attacks legible without flattening psychological tension.
 * - Silence is a beat, not an absence.
 * - Visibility, pacing, and witness behavior are as important as the attack text.
 * - Helpers may haunt a telegraph before they fully intervene.
 * - Deal room telegraphs should feel predatory; global ones should feel theatrical.
 * - Determinism matters: the same inputs should produce the same telegraph law.
 * ============================================================================
 */

import type {
  ChatBossAttack,
  ChatBossAttackClass,
  ChatBossAttackSeverity,
  ChatBossCounterDemand,
  ChatBossCounterWindowBinding,
  ChatBossFightKind,
  ChatBossFightPlan,
  ChatBossOpeningMode,
  ChatBossRound,
  ChatBossTelegraph,
} from '../../../../../../shared/contracts/chat/ChatBossFight';
import {
  deriveBossTelegraph,
  toScore01 as toBossScore01,
  toScore100 as toBossScore100,
} from '../../../../../../shared/contracts/chat/ChatBossFight';

import type {
  ChatCounterTimingClass,
} from '../../../../../../shared/contracts/chat/ChatCounterplay';

import type {
  ChatAffectSnapshot,
  ChatAudienceHeat,
  ChatChannelId,
  ChatEventId,
  ChatMessage,
  ChatRoomId,
  ChatRoomState,
  ChatSessionId,
  ChatSessionState,
  ChatSignalEnvelope,
  ChatState,
  ChatVisibleChannel,
  JsonValue,
  Nullable,
  PressureTier,
  Score01,
  Score100,
  UnixMs,
} from '../types';
import {
  asUnixMs,
  clamp01,
  clamp100,
  isVisibleChannelId,
} from '../types';

// ============================================================================
// MARK: Public contracts
// ============================================================================

export interface ChatTelegraphPolicyClock {
  now(): number;
}

export interface ChatTelegraphPolicyLogger {
  debug(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
  info(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface ChatTelegraphPolicyOptions {
  readonly clock?: ChatTelegraphPolicyClock;
  readonly logger?: ChatTelegraphPolicyLogger;
  readonly strongVisibilityFloor01?: number;
  readonly helperHauntFloor01?: number;
  readonly witnessEscalationFloor01?: number;
  readonly maintainPerRoomHistory?: number;
  readonly publicWitnessWeight01?: number;
  readonly dealRoomWitnessWeight01?: number;
  readonly silenceBiasWeight01?: number;
  readonly pressureBiasWeight01?: number;
}

export type ChatTelegraphVisibilityClass =
  | 'VISIBLE'
  | 'FELT'
  | 'INFERRED'
  | 'SHADOWED';

export type ChatTelegraphBeatKind =
  | 'PRELOAD'
  | 'SILENCE'
  | 'READ_GHOST'
  | 'TYPING'
  | 'PUBLIC_TILT'
  | 'PRIVATE_TILT'
  | 'REVEAL'
  | 'PROOF_TELL'
  | 'HELPER_HAUNT'
  | 'COUNTER_WINDOW'
  | 'AFTERMATH_HINT';

export type ChatTelegraphOverlayCode =
  | 'THREAT_RADAR'
  | 'MOMENT_FLASH'
  | 'PROOF_CUE'
  | 'RESCUE_BANNER'
  | 'COUNTERPLAY_PROMPT'
  | 'WITNESS_PRESSURE'
  | 'DEALROOM_SQUEEZE'
  | 'QUOTE_RISK'
  | 'SILENCE_TENSION';

export interface ChatTelegraphBeat {
  readonly beatId: string;
  readonly kind: ChatTelegraphBeatKind;
  readonly order: number;
  readonly atMs: UnixMs;
  readonly visibleToPlayer: boolean;
  readonly emphasis01: Score01;
  readonly witnessWeight01: Score01;
  readonly helperWeight01: Score01;
  readonly label: string;
  readonly body: string;
  readonly metadata?: JsonValue;
}

export interface ChatTelegraphOverlayCue {
  readonly code: ChatTelegraphOverlayCode;
  readonly active: boolean;
  readonly confidence01: Score01;
  readonly priority100: Score100;
  readonly title: string;
  readonly subtitle: string;
  readonly payload?: JsonValue;
}

export interface ChatTelegraphDemandCue {
  readonly demand: ChatBossCounterDemand;
  readonly timing: ChatCounterTimingClass;
  readonly urgency01: Score01;
  readonly readableLabel: string;
  readonly rationale: string;
}

export interface ChatTelegraphWitnessProjection {
  readonly visibleWitnessCount: number;
  readonly latentWitnessCount: number;
  readonly witnessDensity01: Score01;
  readonly crowdLean: 'HOSTILE' | 'CURIOUS' | 'NEUTRAL' | 'SUPPORTIVE';
  readonly roomWatching: boolean;
  readonly reputationExposure100: Score100;
}

export interface ChatTelegraphHelperProjection {
  readonly helperHaunt01: Score01;
  readonly helperInterventionRisk01: Score01;
  readonly helperShadowing: boolean;
  readonly readableLabel: string;
  readonly rationale: string;
}

export interface ChatTelegraphTimingProjection {
  readonly visibleToPlayer: boolean;
  readonly visibilityClass: ChatTelegraphVisibilityClass;
  readonly revealDelayMs: number;
  readonly silenceLeadInMs: number;
  readonly typingLeadInMs: number;
  readonly beatCount: number;
  readonly readableThreat01: Score01;
  readonly theatricality100: Score100;
}

export interface ChatTelegraphProjection {
  readonly projectionId: string;
  readonly roomId: ChatRoomId;
  readonly sessionId?: ChatSessionId;
  readonly causeEventId?: ChatEventId | null;
  readonly fightKind: ChatBossFightKind;
  readonly attackId: string;
  readonly roundId?: string;
  readonly channelId: ChatChannelId;
  readonly visibleChannelId: ChatVisibleChannel;
  readonly pressureTier: PressureTier;
  readonly telegraph: ChatBossTelegraph;
  readonly timing: ChatTelegraphTimingProjection;
  readonly witness: ChatTelegraphWitnessProjection;
  readonly helper: ChatTelegraphHelperProjection;
  readonly counterplay: readonly ChatTelegraphDemandCue[];
  readonly overlays: readonly ChatTelegraphOverlayCue[];
  readonly beats: readonly ChatTelegraphBeat[];
  readonly authoredSummary: string;
  readonly authoredHint: string;
  readonly debug: JsonValue;
  readonly projectedAt: UnixMs;
}

export interface ChatTelegraphPolicyRequest {
  readonly state: ChatState;
  readonly roomId: ChatRoomId;
  readonly sessionId?: ChatSessionId;
  readonly causeEventId?: ChatEventId | null;
  readonly fightPlan?: ChatBossFightPlan | null;
  readonly round?: ChatBossRound | null;
  readonly attack: ChatBossAttack;
  readonly counterWindow?: ChatBossCounterWindowBinding | null;
  readonly sourceMessage?: ChatMessage | null;
  readonly signal?: ChatSignalEnvelope | null;
  readonly preferredChannelId?: ChatChannelId | null;
  readonly affect?: ChatAffectSnapshot | null;
  readonly audienceHeat?: ChatAudienceHeat | null;
  readonly now?: UnixMs;
  readonly traceLabel?: string;
}

export interface ChatTelegraphPolicyLedger {
  readonly roomId: ChatRoomId;
  readonly projections: readonly ChatTelegraphProjection[];
  readonly byAttackId: Readonly<Record<string, readonly ChatTelegraphProjection[]>>;
  readonly lastProjectedAt?: UnixMs;
}

// ============================================================================
// MARK: Defaults
// ============================================================================

const DEFAULT_CLOCK: ChatTelegraphPolicyClock = {
  now: () => Date.now(),
};

const NOOP_LOGGER: ChatTelegraphPolicyLogger = {
  debug() {},
  info() {},
  warn() {},
};

const DEFAULT_OPTIONS: Required<Omit<ChatTelegraphPolicyOptions, 'clock' | 'logger'>> = {
  strongVisibilityFloor01: 0.62,
  helperHauntFloor01: 0.36,
  witnessEscalationFloor01: 0.52,
  maintainPerRoomHistory: 180,
  publicWitnessWeight01: 0.68,
  dealRoomWitnessWeight01: 0.52,
  silenceBiasWeight01: 0.58,
  pressureBiasWeight01: 0.64,
};

const NEUTRAL_AFFECT: ChatAffectSnapshot = {
  confidence01: clamp01(0.5),
  frustration01: clamp01(0.18),
  intimidation01: clamp01(0.2),
  attachment01: clamp01(0.12),
  curiosity01: clamp01(0.25),
  embarrassment01: clamp01(0.1),
  relief01: clamp01(0.08),
};

const CHANNEL_WEIGHT_TABLE: Readonly<Record<ChatVisibleChannel, number>> = Object.freeze({
  GLOBAL: 1.0,
  DEAL_ROOM: 0.92,
  SYNDICATE: 0.66,
  LOBBY: 0.5,
});

const ROOM_WITNESS_FLOOR: Readonly<Record<ChatRoomState['roomKind'], number>> = Object.freeze({
  GLOBAL: 0.88,
  SYNDICATE: 0.56,
  DEAL_ROOM: 0.42,
  LOBBY: 0.5,
  PRIVATE: 0.22,
  SYSTEM: 0.08,
});

const ATTACK_TEXT_HINTS: Readonly<Record<ChatBossAttackClass, { readonly summary: string; readonly hint: string }>> = Object.freeze({
  PUBLIC_SHAME: {
    summary: 'The attack wants witnesses before it wants damage.',
    hint: 'Answer cleanly or the room will answer for you.',
  },
  QUOTE_TRAP: {
    summary: 'The attack is waiting to weaponize memory.',
    hint: 'A loose reply becomes a future receipt.',
  },
  PROOF_CHALLENGE: {
    summary: 'The attack is narrowing the lane to verifiable proof.',
    hint: 'Pressure does not care what you meant. It cares what you can prove.',
  },
  SILENCE_BAIT: {
    summary: 'The attack is making delay itself feel incriminating.',
    hint: 'The silence is part of the move.',
  },
  DEAL_ROOM_SQUEEZE: {
    summary: 'The attack is compressing terms, time, and leverage together.',
    hint: 'Predatory timing is trying to do half the work.',
  },
  CROWD_SIGNAL: {
    summary: 'The attack is delegating pressure to the room.',
    hint: 'Witness energy is the amplifier, not the attack text alone.',
  },
  CASCADE_TRIGGER: {
    summary: 'The attack is trying to make one failure echo into several.',
    hint: 'A rushed reply can widen the blast radius.',
  },
  TAUNT_SPIKE: {
    summary: 'The attack is a sharp insult intended to provoke immediate reaction.',
    hint: 'Short, biting replies escalate fast — consider defusing or ignoring.',
  },
  FALSE_RESPECT: {
    summary: 'The attack masquerades as deference while pressuring for concession.',
    hint: 'Don\'t mistake politeness for safety; check the terms and keep distance.',
  },
  TIMEBOXED_DEMAND: {
    summary: 'The attack imposes an artificial deadline to force rushed choices.',
    hint: 'Slow the pace and verify terms before answering under pressure.',
  },
  SHIELD_CRACKER: {
    summary: 'The attack probes for a weakness in posture or prior claims.',
    hint: 'Guard credentials and avoid volunteering details that widen the lane.',
  },
  HELPER_DENIAL: {
    summary: 'The attack tries to sever or intimidate potential helpers before they act.',
    hint: 'Look for ways to re-enable aid or document the exchange to attract witnesses.',
  },
});

// ============================================================================
// MARK: Mutable ledgers
// ============================================================================

interface MutableTelegraphLedger {
  projections: ChatTelegraphProjection[];
  byAttackId: Map<string, ChatTelegraphProjection[]>;
  lastProjectedAt?: UnixMs;
}

// ============================================================================
// MARK: Policy
// ============================================================================

export class ChatTelegraphPolicy {
  private readonly clock: ChatTelegraphPolicyClock;
  private readonly logger: ChatTelegraphPolicyLogger;
  private readonly options: Required<Omit<ChatTelegraphPolicyOptions, 'clock' | 'logger'>>;
  private readonly roomLedgers = new Map<string, MutableTelegraphLedger>();

  public constructor(options: ChatTelegraphPolicyOptions = {}) {
    const { clock = DEFAULT_CLOCK, logger = NOOP_LOGGER, ...rest } = options;
    this.clock = clock;
    this.logger = logger;
    this.options = {
      ...DEFAULT_OPTIONS,
      ...rest,
    };
  }

  public project(request: ChatTelegraphPolicyRequest): ChatTelegraphProjection {
    const now = request.now ?? asUnixMs(this.clock.now());
    const room = resolveRoomState(request.state, request.roomId);
    const session = resolveSessionState(request.state, request.sessionId);
    const fightKind = resolveFightKind(request, room);
    const channelId = resolveChannelId(request, room, request.attack);
    const visibleChannelId = resolveVisibleChannelId(channelId, room);
    const pressureTier = derivePressureTier(request.signal, request.attack, request.round, request.fightPlan);
    const affect = resolveAffect(request);
    const audienceHeat = resolveAudienceHeat(request.state, request.roomId, request.audienceHeat, visibleChannelId, now);
    const baseTelegraph = deriveBaseTelegraph(request.attack, request.fightPlan, fightKind);
    const witness = buildWitnessProjection({
      state: request.state,
      room,
      session,
      visibleChannelId,
      attack: request.attack,
      fightKind,
      fightPlan: request.fightPlan,
      audienceHeat,
    }, this.options);
    const helper = buildHelperProjection({
      affect,
      attack: request.attack,
      fightPlan: request.fightPlan,
      round: request.round,
      signal: request.signal,
      session,
      witness,
      pressureTier,
    }, this.options);

    const telegraph = authorTelegraph({
      attack: request.attack,
      fightKind,
      baseTelegraph,
      room,
      session,
      visibleChannelId,
      witness,
      helper,
      affect,
      pressureTier,
      fightPlan: request.fightPlan,
      round: request.round,
      counterWindow: request.counterWindow,
      sourceMessage: request.sourceMessage,
    }, now, this.options);

    const counterplay = buildCounterplayDemandCues(
      request.attack,
      request.counterWindow ?? request.round?.counterWindow ?? null,
      affect,
      pressureTier,
      witness,
    );

    const timing = buildTimingProjection({
      telegraph,
      attack: request.attack,
      fightKind,
      visibleChannelId,
      room,
      affect,
      witness,
      helper,
      pressureTier,
      counterplay,
    }, this.options);

    const beats = buildBeatPlan({
      now,
      telegraph,
      attack: request.attack,
      fightKind,
      visibleChannelId,
      pressureTier,
      timing,
      witness,
      helper,
      counterplay,
      sourceMessage: request.sourceMessage,
      causeEventId: request.causeEventId,
      room,
      session,
    });

    const overlays = buildOverlayCues({
      telegraph,
      attack: request.attack,
      fightKind,
      room,
      visibleChannelId,
      pressureTier,
      witness,
      helper,
      affect,
      counterplay,
      timing,
      sourceMessage: request.sourceMessage,
      counterWindow: request.counterWindow ?? request.round?.counterWindow ?? null,
    });

    const authoredSummary = authorSummary(request.attack, fightKind, timing, witness, helper);
    const authoredHint = authorHint(request.attack, fightKind, counterplay, helper, timing);

    const projection: ChatTelegraphProjection = {
      projectionId: createProjectionId(request.attack.attackId, request.round?.roundId, now),
      roomId: request.roomId,
      sessionId: request.sessionId,
      causeEventId: request.causeEventId ?? null,
      fightKind,
      attackId: String(request.attack.attackId),
      roundId: request.round ? String(request.round.roundId) : undefined,
      channelId,
      visibleChannelId,
      pressureTier,
      telegraph,
      timing,
      witness,
      helper,
      counterplay,
      overlays,
      beats,
      authoredSummary,
      authoredHint,
      debug: {
        traceLabel: request.traceLabel ?? null,
        roomKind: room?.roomKind ?? null,
        pressureTier,
        audienceHeat01: audienceHeat ? Number(audienceHeat.heat01) : null,
        witnessVisible: witness.visibleWitnessCount,
        witnessLatent: witness.latentWitnessCount,
        helperHaunt01: Number(helper.helperHaunt01),
        readableThreat01: Number(timing.readableThreat01),
        visibilityClass: timing.visibilityClass,
        channelId,
        visibleChannelId,
        sourceMessageId: request.sourceMessage ? String(request.sourceMessage.id) : null,
        causeEventId: request.causeEventId ?? null,
        counterDemandCount: counterplay.length,
        beatCount: beats.length,
        overlayCount: overlays.filter((entry) => entry.active).length,
      },
      projectedAt: now,
    };

    this.recordProjection(projection);

    this.logger.debug('chat.combat.telegraph.projected', {
      roomId: request.roomId as unknown as string,
      sessionId: request.sessionId ? (request.sessionId as unknown as string) : null,
      attackId: String(request.attack.attackId),
      fightKind,
      visibilityClass: timing.visibilityClass,
      readableThreat01: Number(timing.readableThreat01),
      helperHaunt01: Number(helper.helperHaunt01),
      witnessDensity01: Number(witness.witnessDensity01),
      pressureTier,
      visibleChannelId,
    });

    return projection;
  }

  public getRoomLedger(roomId: ChatRoomId): ChatTelegraphPolicyLedger {
    const ledger = this.roomLedgers.get(String(roomId));
    if (!ledger) {
      return {
        roomId,
        projections: [],
        byAttackId: {},
        lastProjectedAt: undefined,
      };
    }
    return freezeLedger(roomId, ledger);
  }

  public clearRoom(roomId: ChatRoomId): void {
    this.roomLedgers.delete(String(roomId));
  }

  public reset(): void {
    this.roomLedgers.clear();
  }

  private recordProjection(projection: ChatTelegraphProjection): void {
    const key = String(projection.roomId);
    const ledger = this.ensureRoomLedger(key);
    ledger.projections.push(projection);
    trimMutableList(ledger.projections, this.options.maintainPerRoomHistory);

    const byAttack = ledger.byAttackId.get(projection.attackId) ?? [];
    byAttack.push(projection);
    trimMutableList(byAttack, this.options.maintainPerRoomHistory);
    ledger.byAttackId.set(projection.attackId, byAttack);
    ledger.lastProjectedAt = projection.projectedAt;
  }

  private ensureRoomLedger(roomKey: string): MutableTelegraphLedger {
    let ledger = this.roomLedgers.get(roomKey);
    if (!ledger) {
      ledger = {
        projections: [],
        byAttackId: new Map(),
        lastProjectedAt: undefined,
      };
      this.roomLedgers.set(roomKey, ledger);
    }
    return ledger;
  }
}

// ============================================================================
// MARK: Factories + module
// ============================================================================

export function createChatTelegraphPolicy(
  options: ChatTelegraphPolicyOptions = {},
): ChatTelegraphPolicy {
  return new ChatTelegraphPolicy(options);
}

export const ChatTelegraphPolicyModule = {
  moduleId: 'backend.chat.combat.ChatTelegraphPolicy',
  create: createChatTelegraphPolicy,
  ChatTelegraphPolicy,
} as const;

// ============================================================================
// MARK: Resolution helpers
// ============================================================================

function resolveRoomState(
  state: ChatState,
  roomId: ChatRoomId,
): ChatRoomState | null {
  return state.rooms[roomId] ?? null;
}

function resolveSessionState(
  state: ChatState,
  sessionId?: ChatSessionId,
): ChatSessionState | null {
  if (!sessionId) {
    return null;
  }
  return state.sessions[sessionId] ?? null;
}

function resolveFightKind(
  request: ChatTelegraphPolicyRequest,
  room: ChatRoomState | null,
): ChatBossFightKind {
  if (request.fightPlan?.kind) {
    return request.fightPlan.kind;
  }
  if (request.round?.attack.attackType === 'LIQUIDITY_STRIKE') {
    return 'DEAL_ROOM_AMBUSH';
  }
  if (room?.roomKind === 'DEAL_ROOM') {
    return 'DEAL_ROOM_AMBUSH';
  }
  if (request.attack.attackClass === 'QUOTE_TRAP') {
    return 'PUBLIC_HUMILIATION';
  }
  if (request.attack.attackClass === 'PROOF_CHALLENGE') {
    return 'ARCHIVIST_RECKONING';
  }
  if (request.attack.attackClass === 'SILENCE_BAIT') {
    return 'FINAL_WORD_DUEL';
  }
  return 'PUBLIC_HUMILIATION';
}

function resolveChannelId(
  request: ChatTelegraphPolicyRequest,
  room: ChatRoomState | null,
  attack: ChatBossAttack,
): ChatChannelId {
  const preferred = request.preferredChannelId;
  if (preferred) {
    return preferred;
  }
  if (request.fightPlan?.channelId) {
    return request.fightPlan.channelId;
  }
  if (room) {
    return room.activeVisibleChannel;
  }
  if (attack.attackType === 'LIQUIDITY_STRIKE') {
    return 'DEAL_ROOM';
  }
  if (attack.attackClass === 'SILENCE_BAIT') {
    return 'NPC_SHADOW';
  }
  return 'LOBBY';
}

function resolveVisibleChannelId(
  channelId: ChatChannelId,
  room: ChatRoomState | null,
): ChatVisibleChannel {
  if (isVisibleChannelId(channelId)) {
    return channelId;
  }
  if (room) {
    return room.activeVisibleChannel;
  }
  return 'LOBBY';
}

function resolveAffect(
  request: ChatTelegraphPolicyRequest,
): ChatAffectSnapshot {
  if (request.affect) {
    return request.affect;
  }
  const fromMessage = request.sourceMessage?.learning.affectAfterMessage;
  if (fromMessage) {
    return fromMessage;
  }
  return NEUTRAL_AFFECT;
}

function resolveAudienceHeat(
  state: ChatState,
  roomId: ChatRoomId,
  provided: ChatAudienceHeat | null | undefined,
  visibleChannelId: ChatVisibleChannel,
  now: UnixMs,
): ChatAudienceHeat {
  if (provided) {
    return provided;
  }
  const fromState = state.audienceHeatByRoom[roomId];
  if (fromState) {
    return fromState;
  }
  return {
    roomId,
    channelId: visibleChannelId,
    heat01: clamp01(0.24),
    swarmDirection: 'NEUTRAL',
    updatedAt: now,
  };
}

function deriveBaseTelegraph(
  attack: ChatBossAttack,
  fightPlan: ChatBossFightPlan | null | undefined,
  fightKind: ChatBossFightKind,
): ChatBossTelegraph {
  const openingMode = resolveOpeningMode(attack, fightPlan, fightKind);
  const baseline = deriveBossTelegraph(attack.attackClass, openingMode);
  return {
    ...baseline,
    demandHints: dedupeDemands([...
      baseline.demandHints,
      ...attack.counterDemands,
    ]),
    beatCount: Math.max(baseline.beatCount, suggestedBeatCount(attack, openingMode, fightKind)),
  };
}

function resolveOpeningMode(
  attack: ChatBossAttack,
  fightPlan: ChatBossFightPlan | null | undefined,
  fightKind: ChatBossFightKind,
): ChatBossOpeningMode {
  const fromPattern = fightPlan?.pattern.openingMode;
  if (fromPattern) {
    return fromPattern;
  }
  if (attack.attackType === 'LIQUIDITY_STRIKE') {
    return 'NEGOTIATION_READ_DELAYED';
  }
  if (attack.attackClass === 'SILENCE_BAIT') {
    return 'SILENCE_LURE';
  }
  if (fightKind === 'PUBLIC_HUMILIATION' || attack.crowdAmplified) {
    return 'CROWD_PRIMED';
  }
  if (attack.attackClass === 'QUOTE_TRAP') {
    return 'STAGGERED';
  }
  return attack.telegraph.openingMode;
}

function suggestedBeatCount(
  attack: ChatBossAttack,
  openingMode: ChatBossOpeningMode,
  fightKind: ChatBossFightKind,
): number {
  let beats = Number(attack.telegraph.beatCount ?? 1);
  if (openingMode === 'SILENCE_LURE') {
    beats += 1;
  }
  if (fightKind === 'DEAL_ROOM_AMBUSH') {
    beats += 1;
  }
  if (attack.crowdAmplified) {
    beats += 1;
  }
  if (attack.proofWeighted || attack.quoteWeighted) {
    beats += 1;
  }
  return Math.max(1, Math.min(5, beats));
}

function derivePressureTier(
  signal: Nullable<ChatSignalEnvelope> | undefined,
  attack: ChatBossAttack,
  round: ChatBossRound | null | undefined,
  fightPlan: ChatBossFightPlan | null | undefined,
): PressureTier {
  const hostileMomentum = Number(signal?.battle?.hostileMomentum ?? 0);
  const planExposure = Number(fightPlan?.publicExposure01 ?? toBossScore01(0.2));
  const severityWeight = severityScalar(attack.severity);
  const crowdBias = attack.crowdAmplified ? 0.08 : 0;
  const roundWeight = round ? Math.min(0.16, round.order * 0.04) : 0;
  const total = clamp01(
    hostileMomentum / 100 * 0.42 +
      severityWeight * 0.36 +
      planExposure * 0.16 +
      crowdBias +
      roundWeight,
  );
  if (total >= 0.84) return 'CRITICAL';
  if (total >= 0.64) return 'HIGH';
  if (total >= 0.44) return 'ELEVATED';
  if (total >= 0.18) return 'BUILDING';
  return 'NONE';
}

function buildWitnessProjection(
  input: {
    readonly state: ChatState;
    readonly room: ChatRoomState | null;
    readonly session: ChatSessionState | null;
    readonly visibleChannelId: ChatVisibleChannel;
    readonly attack: ChatBossAttack;
    readonly fightKind: ChatBossFightKind;
    readonly fightPlan?: ChatBossFightPlan | null;
    readonly audienceHeat: ChatAudienceHeat;
  },
  options: Required<Omit<ChatTelegraphPolicyOptions, 'clock' | 'logger'>>,
): ChatTelegraphWitnessProjection {
  const audienceHeat01 = Number(input.audienceHeat.heat01);
  const roomFloor = input.room ? ROOM_WITNESS_FLOOR[input.room.roomKind] : 0.35;
  const channelWeight = CHANNEL_WEIGHT_TABLE[input.visibleChannelId];
  const publicWeight = input.fightPlan?.pattern.publicEncounter
    ? options.publicWitnessWeight01
    : input.fightKind === 'DEAL_ROOM_AMBUSH'
      ? options.dealRoomWitnessWeight01
      : 0.44;
  const sessionInvisibilityPenalty = input.session?.invisible ? 0.08 : 0;
  const visibleWitnessCount = inferVisibleWitnessCount(input.state, input.room?.roomId ?? input.audienceHeat.roomId, input.visibleChannelId);
  const latentWitnessCount = inferLatentWitnessCount(input, roomFloor, audienceHeat01, publicWeight);
  const roomWatching = audienceHeat01 >= options.witnessEscalationFloor01 || visibleWitnessCount >= 3;
  const witnessDensity01 = clamp01(
    roomFloor * 0.25 +
      audienceHeat01 * 0.3 +
      channelWeight * 0.2 +
      publicWeight * 0.2 +
      Math.min(0.25, visibleWitnessCount / 10) +
      Math.min(0.18, latentWitnessCount / 14) -
      sessionInvisibilityPenalty,
  );

  return {
    visibleWitnessCount,
    latentWitnessCount,
    witnessDensity01: toBossScore01(witnessDensity01),
    crowdLean: deriveCrowdLean(input.attack, input.audienceHeat),
    roomWatching,
    reputationExposure100: toBossScore100(clamp100(witnessDensity01 * 100)),
  };
}

function buildHelperProjection(
  input: {
    readonly affect: ChatAffectSnapshot;
    readonly attack: ChatBossAttack;
    readonly fightPlan?: ChatBossFightPlan | null;
    readonly round?: ChatBossRound | null;
    readonly signal?: ChatSignalEnvelope | null;
    readonly session: ChatSessionState | null;
    readonly witness: ChatTelegraphWitnessProjection;
    readonly pressureTier: PressureTier;
  },
  options: Required<Omit<ChatTelegraphPolicyOptions, 'clock' | 'logger'>>,
): ChatTelegraphHelperProjection {
  const frustration = Number(input.affect.frustration01);
  const intimidation = Number(input.affect.intimidation01);
  const embarrassment = Number(input.affect.embarrassment01);
  const rescueAllowed = Boolean(input.fightPlan?.rescueAllowed ?? input.attack.allowsHelperAssistance);
  const signalPressure = Number(input.signal?.battle?.hostileMomentum ?? 0) / 100;
  const helperBias = rescueAllowed ? 0.18 : 0.02;
  const roundRisk = input.round ? Math.min(0.18, input.round.order * 0.05) : 0;
  const invisibilityPenalty = input.session?.invisible ? 0.06 : 0;
  const pressureBias = input.pressureTier === 'CRITICAL'
    ? 0.24
    : input.pressureTier === 'HIGH'
      ? 0.16
      : input.pressureTier === 'ELEVATED'
        ? 0.08
        : 0;

  const helperHaunt01 = clamp01(
    helperBias +
      frustration * 0.16 +
      intimidation * 0.18 +
      embarrassment * 0.14 +
      signalPressure * 0.12 +
      roundRisk +
      Number(input.witness.witnessDensity01) * 0.12 +
      pressureBias -
      invisibilityPenalty,
  );

  const helperInterventionRisk01 = clamp01(
    helperHaunt01 * 0.68 +
      (rescueAllowed ? 0.18 : 0) +
      (input.attack.allowsHelperAssistance ? 0.1 : -0.08),
  );

  return {
    helperHaunt01: toBossScore01(helperHaunt01),
    helperInterventionRisk01: toBossScore01(helperInterventionRisk01),
    helperShadowing: helperHaunt01 >= options.helperHauntFloor01,
    readableLabel: helperHaunt01 >= 0.6
      ? 'Helper presence is near the edge of intervention.'
      : helperHaunt01 >= 0.38
        ? 'A helper may already be reading the field.'
        : 'Helper intervention is possible but not foregrounded.',
    rationale: buildHelperRationale(helperHaunt01, helperInterventionRisk01, rescueAllowed, input.pressureTier),
  };
}

function authorTelegraph(
  input: {
    readonly attack: ChatBossAttack;
    readonly fightKind: ChatBossFightKind;
    readonly baseTelegraph: ChatBossTelegraph;
    readonly room: ChatRoomState | null;
    readonly session: ChatSessionState | null;
    readonly visibleChannelId: ChatVisibleChannel;
    readonly witness: ChatTelegraphWitnessProjection;
    readonly helper: ChatTelegraphHelperProjection;
    readonly affect: ChatAffectSnapshot;
    readonly pressureTier: PressureTier;
    readonly fightPlan?: ChatBossFightPlan | null;
    readonly round?: ChatBossRound | null;
    readonly counterWindow?: ChatBossCounterWindowBinding | null;
    readonly sourceMessage?: ChatMessage | null;
  },
  now: UnixMs,
  options: Required<Omit<ChatTelegraphPolicyOptions, 'clock' | 'logger'>>,
): ChatBossTelegraph {
  const visibleToPlayer = resolvePlayerVisibility(input);
  const canFakeOut = resolveFakeOutAllowance(input, visibleToPlayer);
  const revealDelayMs = resolveRevealDelayMs(input, options);
  const silenceLeadInMs = resolveSilenceLeadInMs(input, options);
  const beatCount = resolveBeatCount(input, visibleToPlayer);
  const typingTheaterRecommended = shouldRecommendTypingTheater(input, visibleToPlayer, options);
  const label = authorTelegraphLabel(input, visibleToPlayer);
  const notes = buildTelegraphNotes(input, visibleToPlayer, canFakeOut, revealDelayMs, silenceLeadInMs);

  return {
    telegraphId: (`telegraph:${String(now)}:${String(input.attack.attackId)}`) as ChatBossTelegraph['telegraphId'],
    label,
    attackClass: input.attack.attackClass,
    openingMode: input.baseTelegraph.openingMode,
    visibleToPlayer,
    canFakeOut,
    typingTheaterRecommended,
    silenceLeadInMs,
    revealDelayMs,
    beatCount,
    demandHints: dedupeDemands([
      ...input.baseTelegraph.demandHints,
      ...input.attack.counterDemands,
      ...(input.counterWindow?.requiredDemands ?? []),
    ]),
    notes,
  };
}

function buildCounterplayDemandCues(
  attack: ChatBossAttack,
  counterWindow: ChatBossCounterWindowBinding | null,
  affect: ChatAffectSnapshot,
  pressureTier: PressureTier,
  witness: ChatTelegraphWitnessProjection,
): readonly ChatTelegraphDemandCue[] {
  const timing = counterWindow?.idealTiming ?? attack.preferredCounterTiming;
  const demands = dedupeDemands([
    ...attack.counterDemands,
    ...(counterWindow?.requiredDemands ?? []),
  ]);

  return demands.map((demand, index) => {
    const urgency01 = clamp01(
      demandUrgencyBase(demand) +
        timingUrgencyBonus(timing) +
        pressureTierUrgencyBonus(pressureTier) +
        Number(affect.embarrassment01) * 0.08 +
        Number(witness.witnessDensity01) * 0.1 +
        index * 0.02,
    );
    return {
      demand,
      timing,
      urgency01: toBossScore01(urgency01),
      readableLabel: demandReadableLabel(demand),
      rationale: demandRationale(demand, timing, attack),
    };
  });
}

function buildTimingProjection(
  input: {
    readonly telegraph: ChatBossTelegraph;
    readonly attack: ChatBossAttack;
    readonly fightKind: ChatBossFightKind;
    readonly visibleChannelId: ChatVisibleChannel;
    readonly room: ChatRoomState | null;
    readonly affect: ChatAffectSnapshot;
    readonly witness: ChatTelegraphWitnessProjection;
    readonly helper: ChatTelegraphHelperProjection;
    readonly pressureTier: PressureTier;
    readonly counterplay: readonly ChatTelegraphDemandCue[];
  },
  options: Required<Omit<ChatTelegraphPolicyOptions, 'clock' | 'logger'>>,
): ChatTelegraphTimingProjection {
  const visibilityClass = resolveVisibilityClass(input.telegraph, input.visibleChannelId, input.room, input.witness, input.attack, options);
  const typingLeadInMs = resolveTypingLeadInMs(input.telegraph, input.attack, input.helper, visibilityClass);
  const readableThreat01 = clamp01(
    Number(input.witness.witnessDensity01) * 0.2 +
      Number(input.helper.helperHaunt01) * 0.1 +
      Number(input.affect.intimidation01) * 0.12 +
      Number(input.affect.embarrassment01) * 0.1 +
      severityScalar(input.attack.severity) * 0.25 +
      pressureTierScalar(input.pressureTier) * 0.15 +
      Math.min(0.12, input.counterplay.length * 0.03) +
      (visibilityClass === 'VISIBLE' ? 0.08 : visibilityClass === 'FELT' ? 0.05 : 0.02),
  );

  const theatricality100 = clamp100(
    input.telegraph.silenceLeadInMs / 30 +
      input.telegraph.revealDelayMs / 26 +
      typingLeadInMs / 28 +
      Number(input.witness.reputationExposure100) * 0.18 +
      Number(input.helper.helperInterventionRisk01) * 18,
  );

  return {
    visibleToPlayer: input.telegraph.visibleToPlayer,
    visibilityClass,
    revealDelayMs: input.telegraph.revealDelayMs,
    silenceLeadInMs: input.telegraph.silenceLeadInMs,
    typingLeadInMs,
    beatCount: input.telegraph.beatCount,
    readableThreat01: toBossScore01(readableThreat01),
    theatricality100: toBossScore100(theatricality100),
  };
}

function buildBeatPlan(
  input: {
    readonly now: UnixMs;
    readonly telegraph: ChatBossTelegraph;
    readonly attack: ChatBossAttack;
    readonly fightKind: ChatBossFightKind;
    readonly visibleChannelId: ChatVisibleChannel;
    readonly pressureTier: PressureTier;
    readonly timing: ChatTelegraphTimingProjection;
    readonly witness: ChatTelegraphWitnessProjection;
    readonly helper: ChatTelegraphHelperProjection;
    readonly counterplay: readonly ChatTelegraphDemandCue[];
    readonly sourceMessage?: ChatMessage | null;
    readonly causeEventId?: ChatEventId | null;
    readonly room: ChatRoomState | null;
    readonly session: ChatSessionState | null;
  },
): readonly ChatTelegraphBeat[] {
  const beats: ChatTelegraphBeat[] = [];
  let order = 0;
  let cursor = Number(input.now);

  beats.push(createBeat({
    attack: input.attack,
    kind: 'PRELOAD',
    order: order++,
    atMs: asUnixMs(cursor),
    visibleToPlayer: input.timing.visibilityClass !== 'SHADOWED',
    emphasis01: 0.28,
    witnessWeight01: Number(input.witness.witnessDensity01) * 0.4,
    helperWeight01: 0,
    label: 'Threat posture loads.',
    body: preloadBody(input.attack, input.fightKind, input.visibleChannelId),
    metadata: {
      causeEventId: input.causeEventId ?? null,
      sourceMessageId: input.sourceMessage ? String(input.sourceMessage.id) : null,
    },
  }));

  cursor += Math.max(60, Math.floor(input.timing.silenceLeadInMs * 0.32));

  if (input.telegraph.silenceLeadInMs > 0) {
    beats.push(createBeat({
      attack: input.attack,
      kind: 'SILENCE',
      order: order++,
      atMs: asUnixMs(cursor),
      visibleToPlayer: input.timing.visibilityClass !== 'VISIBLE' ? false : true,
      emphasis01: Math.min(0.86, input.telegraph.silenceLeadInMs / 1800),
      witnessWeight01: Number(input.witness.witnessDensity01) * 0.38,
      helperWeight01: Number(input.helper.helperHaunt01) * 0.12,
      label: 'Silence takes the lane.',
      body: silenceBeatBody(input.attack, input.pressureTier, input.telegraph),
      metadata: {
        silenceLeadInMs: input.telegraph.silenceLeadInMs,
        visibilityClass: input.timing.visibilityClass,
      },
    }));
    cursor += input.telegraph.silenceLeadInMs;
  }

  if (input.telegraph.typingTheaterRecommended) {
    beats.push(createBeat({
      attack: input.attack,
      kind: 'TYPING',
      order: order++,
      atMs: asUnixMs(cursor),
      visibleToPlayer: input.timing.visibilityClass === 'SHADOWED' ? false : true,
      emphasis01: Math.min(0.92, input.timing.typingLeadInMs / 1400),
      witnessWeight01: Number(input.witness.witnessDensity01) * 0.2,
      helperWeight01: Number(input.helper.helperHaunt01) * 0.1,
      label: 'Presence theater begins.',
      body: typingBeatBody(input.attack, input.visibleChannelId, input.witness),
      metadata: {
        typingLeadInMs: input.timing.typingLeadInMs,
        channel: input.visibleChannelId,
      },
    }));
    cursor += input.timing.typingLeadInMs;
  } else {
    beats.push(createBeat({
      attack: input.attack,
      kind: input.visibleChannelId === 'DEAL_ROOM' ? 'PRIVATE_TILT' : 'PUBLIC_TILT',
      order: order++,
      atMs: asUnixMs(cursor),
      visibleToPlayer: input.timing.visibilityClass !== 'SHADOWED',
      emphasis01: 0.42,
      witnessWeight01: Number(input.witness.witnessDensity01) * 0.3,
      helperWeight01: 0.04,
      label: input.visibleChannelId === 'DEAL_ROOM' ? 'Terms tighten.' : 'The room tilts.',
      body: tiltBeatBody(input.attack, input.visibleChannelId, input.witness),
      metadata: {
        roomKind: input.room?.roomKind ?? null,
        sessionInvisible: input.session?.invisible ?? false,
      },
    }));
    cursor += Math.max(120, Math.floor(input.telegraph.revealDelayMs * 0.25));
  }

  if (input.attack.proofWeighted) {
    beats.push(createBeat({
      attack: input.attack,
      kind: 'PROOF_TELL',
      order: order++,
      atMs: asUnixMs(cursor),
      visibleToPlayer: true,
      emphasis01: 0.68,
      witnessWeight01: Number(input.witness.witnessDensity01) * 0.22,
      helperWeight01: Number(input.helper.helperInterventionRisk01) * 0.08,
      label: 'Proof demand becomes legible.',
      body: 'The telegraph narrows toward receipts, hashes, or evidence-backed reply lanes.',
      metadata: {
        proofWeighted: true,
      },
    }));
    cursor += 110;
  }

  if (input.helper.helperShadowing) {
    beats.push(createBeat({
      attack: input.attack,
      kind: 'HELPER_HAUNT',
      order: order++,
      atMs: asUnixMs(cursor),
      visibleToPlayer: input.timing.visibilityClass !== 'SHADOWED',
      emphasis01: Number(input.helper.helperHaunt01),
      witnessWeight01: Number(input.witness.witnessDensity01) * 0.16,
      helperWeight01: Number(input.helper.helperInterventionRisk01),
      label: 'Helper shadow enters the edge of frame.',
      body: input.helper.readableLabel,
      metadata: {
        rationale: input.helper.rationale,
      },
    }));
    cursor += 90;
  }

  beats.push(createBeat({
    attack: input.attack,
    kind: 'REVEAL',
    order: order++,
    atMs: asUnixMs(Number(input.now) + input.timing.revealDelayMs),
    visibleToPlayer: input.timing.visibilityClass !== 'SHADOWED',
    emphasis01: Number(input.timing.readableThreat01),
    witnessWeight01: Number(input.witness.witnessDensity01),
    helperWeight01: Number(input.helper.helperHaunt01) * 0.4,
    label: input.telegraph.label,
    body: revealBeatBody(input.attack, input.timing.visibilityClass, input.witness, input.pressureTier),
    metadata: {
      revealDelayMs: input.timing.revealDelayMs,
      visibilityClass: input.timing.visibilityClass,
    },
  }));

  if (input.counterplay.length > 0) {
    beats.push(createBeat({
      attack: input.attack,
      kind: 'COUNTER_WINDOW',
      order: order++,
      atMs: asUnixMs(Number(input.now) + input.timing.revealDelayMs + 40),
      visibleToPlayer: true,
      emphasis01: 0.72,
      witnessWeight01: Number(input.witness.witnessDensity01) * 0.22,
      helperWeight01: Number(input.helper.helperInterventionRisk01) * 0.18,
      label: 'Counter lane opens.',
      body: input.counterplay.map((entry) => entry.readableLabel).join(' · '),
      metadata: {
        demands: input.counterplay.map((entry) => entry.demand),
      },
    }));
  }

  beats.push(createBeat({
    attack: input.attack,
    kind: 'AFTERMATH_HINT',
    order: order++,
    atMs: asUnixMs(Number(input.now) + input.timing.revealDelayMs + 220),
    visibleToPlayer: input.timing.visibilityClass !== 'SHADOWED',
    emphasis01: 0.34,
    witnessWeight01: Number(input.witness.witnessDensity01) * 0.26,
    helperWeight01: Number(input.helper.helperHaunt01) * 0.12,
    label: 'The pressure keeps moving.',
    body: aftermathHintBody(input.attack, input.fightKind, input.witness, input.helper),
    metadata: {
      roundPressure: input.pressureTier,
    },
  }));

  return beats;
}

function buildOverlayCues(
  input: {
    readonly telegraph: ChatBossTelegraph;
    readonly attack: ChatBossAttack;
    readonly fightKind: ChatBossFightKind;
    readonly room: ChatRoomState | null;
    readonly visibleChannelId: ChatVisibleChannel;
    readonly pressureTier: PressureTier;
    readonly witness: ChatTelegraphWitnessProjection;
    readonly helper: ChatTelegraphHelperProjection;
    readonly affect: ChatAffectSnapshot;
    readonly counterplay: readonly ChatTelegraphDemandCue[];
    readonly timing: ChatTelegraphTimingProjection;
    readonly sourceMessage?: ChatMessage | null;
    readonly counterWindow?: ChatBossCounterWindowBinding | null;
  },
): readonly ChatTelegraphOverlayCue[] {
  const overlays: ChatTelegraphOverlayCue[] = [];

  overlays.push(overlayCue(
    'THREAT_RADAR',
    true,
    input.timing.readableThreat01,
    input.timing.theatricality100,
    'Threat radar rises.',
    `${input.attack.label} is staging as ${input.timing.visibilityClass.toLowerCase()} pressure.`,
    {
      severity: input.attack.severity,
      pressureTier: input.pressureTier,
    },
  ));

  overlays.push(overlayCue(
    'MOMENT_FLASH',
    input.attack.crowdAmplified || input.witness.roomWatching,
    toBossScore01(clamp01(Number(input.witness.witnessDensity01) * 0.9)),
    input.witness.reputationExposure100,
    'Witness pressure spikes.',
    `${input.witness.visibleWitnessCount} visible witness lanes and ${input.witness.latentWitnessCount} latent lanes shape the read.`,
    {
      crowdLean: input.witness.crowdLean,
    },
  ));

  overlays.push(overlayCue(
    'PROOF_CUE',
    input.attack.proofWeighted,
    toBossScore01(input.attack.proofWeighted ? 0.74 : 0.1),
    toBossScore100(input.attack.proofWeighted ? 82 : 10),
    'Proof lane highlighted.',
    input.attack.proofWeighted
      ? 'This telegraph is explicitly biasing toward evidence-backed reply shapes.'
      : 'Proof is not the primary read on this telegraph.',
    {
      sourceMessageId: input.sourceMessage ? String(input.sourceMessage.id) : null,
      proofHash: input.sourceMessage?.proof.proofHash ?? null,
    },
  ));

  overlays.push(overlayCue(
    'RESCUE_BANNER',
    Number(input.helper.helperInterventionRisk01) >= 0.55,
    input.helper.helperInterventionRisk01,
    toBossScore100(Number(input.helper.helperInterventionRisk01) * 100),
    'Helper lane warming.',
    input.helper.rationale,
    {
      helperShadowing: input.helper.helperShadowing,
    },
  ));

  overlays.push(overlayCue(
    'COUNTERPLAY_PROMPT',
    input.counterplay.length > 0,
    toBossScore01(Math.min(1, input.counterplay.length * 0.24 + 0.18)),
    toBossScore100(Math.min(100, 34 + input.counterplay.length * 16)),
    'Counter window is readable.',
    input.counterplay.length > 0
      ? input.counterplay.map((entry) => entry.readableLabel).join(' • ')
      : 'No explicit counter demand is foregrounded.',
    {
      timing: input.counterWindow?.idealTiming ?? input.attack.preferredCounterTiming,
    },
  ));

  overlays.push(overlayCue(
    'WITNESS_PRESSURE',
    input.witness.roomWatching,
    toBossScore01(clamp01(Number(input.witness.witnessDensity01) * 0.86)),
    input.witness.reputationExposure100,
    'Reputation exposure is active.',
    input.witness.crowdLean === 'HOSTILE'
      ? 'The room is leaning hostile. Delay compounds the read.'
      : 'Witness density is high enough to influence how the threat lands.',
  ));

  overlays.push(overlayCue(
    'DEALROOM_SQUEEZE',
    input.fightKind === 'DEAL_ROOM_AMBUSH' || input.visibleChannelId === 'DEAL_ROOM',
    toBossScore01(input.visibleChannelId === 'DEAL_ROOM' ? 0.82 : 0.14),
    toBossScore100(input.visibleChannelId === 'DEAL_ROOM' ? 90 : 12),
    'Term compression detected.',
    input.visibleChannelId === 'DEAL_ROOM'
      ? 'The telegraph is making timing and leverage feel like the same weapon.'
      : 'This is not primarily a deal-room squeeze.',
  ));

  overlays.push(overlayCue(
    'QUOTE_RISK',
    input.attack.quoteWeighted,
    toBossScore01(input.attack.quoteWeighted ? 0.76 : 0.08),
    toBossScore100(input.attack.quoteWeighted ? 84 : 8),
    'Quote trap risk rises.',
    input.attack.quoteWeighted
      ? 'Language itself may be harvested as the next attack surface.'
      : 'Quote leverage is not the main weapon on this telegraph.',
  ));

  overlays.push(overlayCue(
    'SILENCE_TENSION',
    input.telegraph.silenceLeadInMs >= 500,
    toBossScore01(clamp01(input.telegraph.silenceLeadInMs / 1400)),
    toBossScore100(clamp100(input.telegraph.silenceLeadInMs / 12)),
    'Silence is being used as force.',
    input.telegraph.silenceLeadInMs >= 500
      ? 'The quiet before reveal is a measurable part of the attack.'
      : 'Silence is present but not dominant.',
    {
      silenceLeadInMs: input.telegraph.silenceLeadInMs,
      affectEmbarrassment01: Number(input.affect.embarrassment01),
    },
  ));

  return overlays.sort((a, b) => Number(b.priority100) - Number(a.priority100));
}

function authorSummary(
  attack: ChatBossAttack,
  fightKind: ChatBossFightKind,
  timing: ChatTelegraphTimingProjection,
  witness: ChatTelegraphWitnessProjection,
  helper: ChatTelegraphHelperProjection,
): string {
  const contractSummary = ATTACK_TEXT_HINTS[attack.attackClass]?.summary ?? 'The attack is shaping the room before it resolves.';
  const visibilitySummary =
    timing.visibilityClass === 'VISIBLE'
      ? 'The player should be able to read the danger directly.'
      : timing.visibilityClass === 'FELT'
        ? 'The player should feel the danger before the text fully arrives.'
        : timing.visibilityClass === 'INFERRED'
          ? 'The player must infer the threat from posture, delay, and witness movement.'
          : 'The threat is intentionally withheld from direct presentation.';
  const witnessSummary = witness.roomWatching
    ? 'Witness pressure is part of the attack payload.'
    : 'Witness pressure is present but not dominant.';
  const helperSummary = helper.helperShadowing
    ? 'Helper shadowing is legible in the read.'
    : 'Helper presence stays peripheral.';

  return [
    `${fightKind} telegraph.`,
    contractSummary,
    visibilitySummary,
    witnessSummary,
    helperSummary,
  ].join(' ');
}

function authorHint(
  attack: ChatBossAttack,
  fightKind: ChatBossFightKind,
  counterplay: readonly ChatTelegraphDemandCue[],
  helper: ChatTelegraphHelperProjection,
  timing: ChatTelegraphTimingProjection,
): string {
  const contractHint = ATTACK_TEXT_HINTS[attack.attackClass]?.hint ?? 'Respond for the field you are actually in, not the text you wish it were.';
  const counterHint = counterplay.length > 0
    ? `Primary readable reply: ${counterplay[0].readableLabel}.`
    : 'No explicit reply lane is foregrounded yet.';
  const helperHint = Number(helper.helperInterventionRisk01) >= 0.55
    ? 'A helper may arrive if the player posture collapses.'
    : 'Do not assume helper cover.';
  const timingHint = timing.visibilityClass === 'INFERRED' || timing.visibilityClass === 'SHADOWED'
    ? 'Read the pacing as carefully as the words.'
    : 'The telegraph is readable enough to punish a rushed answer.';

  return [
    `${fightKind} hint.`,
    contractHint,
    counterHint,
    helperHint,
    timingHint,
  ].join(' ');
}

// ============================================================================
// MARK: Visibility, timing, and authorship heuristics
// ============================================================================

function resolvePlayerVisibility(input: {
  readonly attack: ChatBossAttack;
  readonly fightKind: ChatBossFightKind;
  readonly baseTelegraph: ChatBossTelegraph;
  readonly room: ChatRoomState | null;
  readonly session: ChatSessionState | null;
  readonly visibleChannelId: ChatVisibleChannel;
  readonly witness: ChatTelegraphWitnessProjection;
  readonly helper: ChatTelegraphHelperProjection;
  readonly affect: ChatAffectSnapshot;
  readonly pressureTier: PressureTier;
  readonly fightPlan?: ChatBossFightPlan | null;
}): boolean {
  if (!input.baseTelegraph.visibleToPlayer) {
    if (input.fightKind === 'FINAL_WORD_DUEL' || input.attack.attackClass === 'SILENCE_BAIT') {
      return false;
    }
  }

  const dealRoomLift = input.visibleChannelId === 'DEAL_ROOM' ? 0.1 : 0;
  const helperLift = Number(input.helper.helperHaunt01) * 0.12;
  const witnessLift = Number(input.witness.witnessDensity01) * 0.14;
  const confidencePenalty = (1 - Number(input.affect.confidence01)) * 0.08;
  const pressurePenalty = pressureTierScalar(input.pressureTier) * -0.04;
  const invisiblePenalty = input.session?.invisible ? 0.12 : 0;
  const total = clamp01(
    Number(input.baseTelegraph.visibleToPlayer ? toBossScore01(0.58) : toBossScore01(0.18)) +
      dealRoomLift +
      helperLift +
      witnessLift +
      confidencePenalty +
      pressurePenalty -
      invisiblePenalty,
  );
  return total >= 0.34;
}

function resolveFakeOutAllowance(
  input: {
    readonly attack: ChatBossAttack;
    readonly fightKind: ChatBossFightKind;
    readonly baseTelegraph: ChatBossTelegraph;
    readonly room: ChatRoomState | null;
    readonly session: ChatSessionState | null;
    readonly visibleChannelId: ChatVisibleChannel;
    readonly witness: ChatTelegraphWitnessProjection;
    readonly helper: ChatTelegraphHelperProjection;
    readonly affect: ChatAffectSnapshot;
    readonly pressureTier: PressureTier;
    readonly fightPlan?: ChatBossFightPlan | null;
    readonly round?: ChatBossRound | null;
    readonly counterWindow?: ChatBossCounterWindowBinding | null;
    readonly sourceMessage?: ChatMessage | null;
  },
  visibleToPlayer: boolean,
): boolean {
  if (!input.baseTelegraph.canFakeOut) {
    return false;
  }
  if (input.attack.proofWeighted) {
    return false;
  }
  if (input.counterWindow?.requiredDemands.includes('PROOF_REPLY')) {
    return false;
  }
  if (!visibleToPlayer && input.attack.attackClass === 'SILENCE_BAIT') {
    return true;
  }
  if (input.visibleChannelId === 'GLOBAL' || input.attack.crowdAmplified) {
    return true;
  }
  return Number(input.witness.witnessDensity01) >= 0.45;
}

function resolveRevealDelayMs(
  input: {
    readonly attack: ChatBossAttack;
    readonly fightKind: ChatBossFightKind;
    readonly baseTelegraph: ChatBossTelegraph;
    readonly room: ChatRoomState | null;
    readonly session: ChatSessionState | null;
    readonly visibleChannelId: ChatVisibleChannel;
    readonly witness: ChatTelegraphWitnessProjection;
    readonly helper: ChatTelegraphHelperProjection;
    readonly affect: ChatAffectSnapshot;
    readonly pressureTier: PressureTier;
    readonly fightPlan?: ChatBossFightPlan | null;
    readonly round?: ChatBossRound | null;
    readonly counterWindow?: ChatBossCounterWindowBinding | null;
    readonly sourceMessage?: ChatMessage | null;
  },
  options: Required<Omit<ChatTelegraphPolicyOptions, 'clock' | 'logger'>>,
): number {
  const base = input.baseTelegraph.revealDelayMs;
  const silenceBias = input.attack.attackClass === 'SILENCE_BAIT'
    ? options.silenceBiasWeight01 * 400
    : 0;
  const dealRoomBias = input.visibleChannelId === 'DEAL_ROOM' ? 110 : 0;
  const publicWitnessBias = Number(input.witness.witnessDensity01) >= options.strongVisibilityFloor01 ? 80 : 0;
  const criticalCompression = input.pressureTier === 'CRITICAL' ? -160 : input.pressureTier === 'HIGH' ? -80 : 0;
  const helperDrag = input.helper.helperShadowing ? 70 : 0;
  const sourceProofCompression = input.sourceMessage?.proof.proofHash && input.attack.proofWeighted ? -120 : 0;
  return Math.max(120, Math.round(base + silenceBias + dealRoomBias + publicWitnessBias + helperDrag + criticalCompression + sourceProofCompression));
}

function resolveSilenceLeadInMs(
  input: {
    readonly attack: ChatBossAttack;
    readonly fightKind: ChatBossFightKind;
    readonly baseTelegraph: ChatBossTelegraph;
    readonly room: ChatRoomState | null;
    readonly session: ChatSessionState | null;
    readonly visibleChannelId: ChatVisibleChannel;
    readonly witness: ChatTelegraphWitnessProjection;
    readonly helper: ChatTelegraphHelperProjection;
    readonly affect: ChatAffectSnapshot;
    readonly pressureTier: PressureTier;
    readonly fightPlan?: ChatBossFightPlan | null;
    readonly round?: ChatBossRound | null;
    readonly counterWindow?: ChatBossCounterWindowBinding | null;
    readonly sourceMessage?: ChatMessage | null;
  },
  options: Required<Omit<ChatTelegraphPolicyOptions, 'clock' | 'logger'>>,
): number {
  const base = input.baseTelegraph.silenceLeadInMs;
  const attackBias = input.attack.allowsSilenceOutplay ? 140 : -90;
  const quoteBias = input.attack.quoteWeighted ? 110 : 0;
  const helperBias = input.helper.helperShadowing ? 80 : 0;
  const pressureCompression = input.pressureTier === 'CRITICAL' ? -220 : input.pressureTier === 'HIGH' ? -110 : 0;
  const curiosityLift = Number(input.affect.curiosity01) * 100;
  const witnessBias = Number(input.witness.witnessDensity01) >= options.witnessEscalationFloor01 ? 60 : 0;
  return Math.max(0, Math.round(base + attackBias + quoteBias + helperBias + curiosityLift + witnessBias + pressureCompression));
}

function resolveBeatCount(
  input: {
    readonly attack: ChatBossAttack;
    readonly fightKind: ChatBossFightKind;
    readonly baseTelegraph: ChatBossTelegraph;
    readonly room: ChatRoomState | null;
    readonly session: ChatSessionState | null;
    readonly visibleChannelId: ChatVisibleChannel;
    readonly witness: ChatTelegraphWitnessProjection;
    readonly helper: ChatTelegraphHelperProjection;
    readonly affect: ChatAffectSnapshot;
    readonly pressureTier: PressureTier;
    readonly fightPlan?: ChatBossFightPlan | null;
    readonly round?: ChatBossRound | null;
    readonly counterWindow?: ChatBossCounterWindowBinding | null;
    readonly sourceMessage?: ChatMessage | null;
  },
  visibleToPlayer: boolean,
): number {
  let count = input.baseTelegraph.beatCount;
  if (input.attack.proofWeighted) count += 1;
  if (input.attack.quoteWeighted) count += 1;
  if (input.helper.helperShadowing) count += 1;
  if (input.counterWindow) count += 1;
  if (!visibleToPlayer) count = Math.max(1, count - 1);
  return Math.max(1, Math.min(7, count));
}

function shouldRecommendTypingTheater(
  input: {
    readonly attack: ChatBossAttack;
    readonly fightKind: ChatBossFightKind;
    readonly baseTelegraph: ChatBossTelegraph;
    readonly room: ChatRoomState | null;
    readonly session: ChatSessionState | null;
    readonly visibleChannelId: ChatVisibleChannel;
    readonly witness: ChatTelegraphWitnessProjection;
    readonly helper: ChatTelegraphHelperProjection;
    readonly affect: ChatAffectSnapshot;
    readonly pressureTier: PressureTier;
    readonly fightPlan?: ChatBossFightPlan | null;
    readonly round?: ChatBossRound | null;
    readonly counterWindow?: ChatBossCounterWindowBinding | null;
    readonly sourceMessage?: ChatMessage | null;
  },
  visibleToPlayer: boolean,
  options: Required<Omit<ChatTelegraphPolicyOptions, 'clock' | 'logger'>>,
): boolean {
  if (!visibleToPlayer) {
    return input.attack.attackClass === 'SILENCE_BAIT';
  }
  if (input.attack.proofWeighted) {
    return false;
  }
  const score = clamp01(
    Number(input.baseTelegraph.typingTheaterRecommended ? toBossScore01(0.5) : toBossScore01(0.18)) +
      Number(input.witness.witnessDensity01) * 0.15 +
      Number(input.helper.helperHaunt01) * 0.1 +
      (input.visibleChannelId === 'GLOBAL' ? 0.1 : 0) +
      options.pressureBiasWeight01 * pressureTierScalar(input.pressureTier) * 0.14,
  );
  return score >= 0.42;
}

function authorTelegraphLabel(
  input: {
    readonly attack: ChatBossAttack;
    readonly fightKind: ChatBossFightKind;
    readonly baseTelegraph: ChatBossTelegraph;
    readonly room: ChatRoomState | null;
    readonly session: ChatSessionState | null;
    readonly visibleChannelId: ChatVisibleChannel;
    readonly witness: ChatTelegraphWitnessProjection;
    readonly helper: ChatTelegraphHelperProjection;
    readonly affect: ChatAffectSnapshot;
    readonly pressureTier: PressureTier;
    readonly fightPlan?: ChatBossFightPlan | null;
    readonly round?: ChatBossRound | null;
    readonly counterWindow?: ChatBossCounterWindowBinding | null;
    readonly sourceMessage?: ChatMessage | null;
  },
  visibleToPlayer: boolean,
): string {
  if (!visibleToPlayer && input.attack.attackClass === 'SILENCE_BAIT') {
    return 'Pressure gathers off-screen.';
  }
  if (input.visibleChannelId === 'DEAL_ROOM' && input.attack.attackType === 'LIQUIDITY_STRIKE') {
    return 'Terms tighten.';
  }
  if (input.attack.proofWeighted) {
    return 'Receipts requested.';
  }
  if (input.attack.quoteWeighted) {
    return 'History stirs.';
  }
  if (input.attack.crowdAmplified && Number(input.witness.witnessDensity01) >= 0.58) {
    return 'The room turns.';
  }
  if (input.pressureTier === 'CRITICAL') {
    return 'Pressure spikes.';
  }
  return input.baseTelegraph.label;
}

function buildTelegraphNotes(
  input: {
    readonly attack: ChatBossAttack;
    readonly fightKind: ChatBossFightKind;
    readonly baseTelegraph: ChatBossTelegraph;
    readonly room: ChatRoomState | null;
    readonly session: ChatSessionState | null;
    readonly visibleChannelId: ChatVisibleChannel;
    readonly witness: ChatTelegraphWitnessProjection;
    readonly helper: ChatTelegraphHelperProjection;
    readonly affect: ChatAffectSnapshot;
    readonly pressureTier: PressureTier;
    readonly fightPlan?: ChatBossFightPlan | null;
    readonly round?: ChatBossRound | null;
    readonly counterWindow?: ChatBossCounterWindowBinding | null;
    readonly sourceMessage?: ChatMessage | null;
  },
  visibleToPlayer: boolean,
  canFakeOut: boolean,
  revealDelayMs: number,
  silenceLeadInMs: number,
): readonly string[] {
  const notes: string[] = [
    `fightKind=${input.fightKind}`,
    `pressureTier=${input.pressureTier}`,
    `visibleChannel=${input.visibleChannelId}`,
    `visibleToPlayer=${String(visibleToPlayer)}`,
    `witnessDensity01=${Number(input.witness.witnessDensity01).toFixed(3)}`,
    `helperHaunt01=${Number(input.helper.helperHaunt01).toFixed(3)}`,
    `revealDelayMs=${String(revealDelayMs)}`,
    `silenceLeadInMs=${String(silenceLeadInMs)}`,
  ];
  if (canFakeOut) notes.push('Fake-out legally allowed under current witness/proof state.');
  if (input.attack.proofWeighted) notes.push('Proof-weighted attack compresses theater and foregrounds evidence.');
  if (input.attack.quoteWeighted) notes.push('Quote leverage increases memory pressure inside the telegraph.');
  if (input.helper.helperShadowing) notes.push(input.helper.rationale);
  if (input.counterWindow) notes.push(`Counter window ideal timing=${input.counterWindow.idealTiming}`);
  if (input.room?.roomKind === 'DEAL_ROOM') notes.push('Deal room posture favors predatory squeeze aesthetics over theatrical crowd flourish.');
  return notes;
}

function resolveVisibilityClass(
  telegraph: ChatBossTelegraph,
  visibleChannelId: ChatVisibleChannel,
  room: ChatRoomState | null,
  witness: ChatTelegraphWitnessProjection,
  attack: ChatBossAttack,
  options: Required<Omit<ChatTelegraphPolicyOptions, 'clock' | 'logger'>>,
): ChatTelegraphVisibilityClass {
  if (!telegraph.visibleToPlayer) {
    return attack.attackClass === 'SILENCE_BAIT' ? 'SHADOWED' : 'INFERRED';
  }
  const density = Number(witness.witnessDensity01);
  if (visibleChannelId === 'DEAL_ROOM' && density < options.strongVisibilityFloor01) {
    return 'FELT';
  }
  if (room?.roomKind === 'PRIVATE' && attack.quoteWeighted) {
    return 'INFERRED';
  }
  if (density >= options.strongVisibilityFloor01 || attack.proofWeighted) {
    return 'VISIBLE';
  }
  if (attack.attackClass === 'SILENCE_BAIT') {
    return 'FELT';
  }
  return 'FELT';
}

function resolveTypingLeadInMs(
  telegraph: ChatBossTelegraph,
  attack: ChatBossAttack,
  helper: ChatTelegraphHelperProjection,
  visibilityClass: ChatTelegraphVisibilityClass,
): number {
  if (!telegraph.typingTheaterRecommended) {
    return 0;
  }
  const base =
    visibilityClass === 'VISIBLE' ? 160 :
    visibilityClass === 'FELT' ? 240 :
    visibilityClass === 'INFERRED' ? 320 :
    420;
  const quoteLift = attack.quoteWeighted ? 140 : 0;
  const helperLift = helper.helperShadowing ? 90 : 0;
  const proofCompression = attack.proofWeighted ? -120 : 0;
  return Math.max(0, Math.round(base + quoteLift + helperLift + proofCompression));
}

// ============================================================================
// MARK: Demand helpers
// ============================================================================

function demandUrgencyBase(demand: ChatBossCounterDemand): number {
  switch (demand) {
    case 'PROOF_REPLY':
      return 0.58;
    case 'QUOTE_REPLY':
      return 0.52;
    case 'NEGOTIATION_REPLY':
      return 0.56;
    case 'SILENCE_REPLY':
      return 0.34;
    case 'TIMED_REPLY':
      return 0.48;
    case 'VISIBLE_REPLY':
    default:
      return 0.4;
  }
}

function timingUrgencyBonus(timing: ChatCounterTimingClass): number {
  switch (timing) {
    case 'INSTANT':
      return 0.24;
    case 'FAST':
      return 0.18;
    case 'BEAT_LOCKED':
      return 0.14;
    case 'READ_PRESSURE_DELAYED':
      return 0.12;
    case 'LATE_BUT_VALID':
      return 0.08;
    case 'POST_SCENE':
      return 0.03;
    case 'SHADOW_ONLY':
      return 0.02;
    default:
      return 0;
  }
}

function pressureTierUrgencyBonus(tier: PressureTier): number {
  switch (tier) {
    case 'CRITICAL':
      return 0.22;
    case 'HIGH':
      return 0.16;
    case 'ELEVATED':
      return 0.1;
    case 'BUILDING':
      return 0.05;
    case 'NONE':
    default:
      return 0;
  }
}

function demandReadableLabel(demand: ChatBossCounterDemand): string {
  switch (demand) {
    case 'PROOF_REPLY':
      return 'Answer with proof, not posture.';
    case 'QUOTE_REPLY':
      return 'Answer with the quote lane in mind.';
    case 'NEGOTIATION_REPLY':
      return 'Answer by repricing or reframing the deal.';
    case 'SILENCE_REPLY':
      return 'The legal answer may be a disciplined non-reply.';
    case 'TIMED_REPLY':
      return 'Timing is part of the counter, not only wording.';
    case 'VISIBLE_REPLY':
    default:
      return 'A visible answer is expected.';
  }
}

function demandRationale(
  demand: ChatBossCounterDemand,
  timing: ChatCounterTimingClass,
  attack: ChatBossAttack,
): string {
  switch (demand) {
    case 'PROOF_REPLY':
      return `This ${attack.attackClass} attack is narrowing the lane to proof, ideally on ${timing}.`;
    case 'QUOTE_REPLY':
      return `This ${attack.attackClass} attack is memory-shaped; careless language becomes ammunition.`;
    case 'NEGOTIATION_REPLY':
      return `This ${attack.attackType} attack wants the player trapped in hostile terms unless they reprice the scene.`;
    case 'SILENCE_REPLY':
      return `This ${attack.attackClass} attack is using response compulsion as pressure.`;
    case 'TIMED_REPLY':
      return `The counter window is timing-sensitive under ${timing}.`;
    case 'VISIBLE_REPLY':
    default:
      return `The attack is socially legible enough that a visible answer matters.`;
  }
}

function dedupeDemands(
  demands: readonly ChatBossCounterDemand[],
): readonly ChatBossCounterDemand[] {
  const seen = new Set<ChatBossCounterDemand>();
  const result: ChatBossCounterDemand[] = [];
  for (const demand of demands) {
    if (!seen.has(demand)) {
      seen.add(demand);
      result.push(demand);
    }
  }
  return result;
}

// ============================================================================
// MARK: Beat authoring bodies
// ============================================================================

function preloadBody(
  attack: ChatBossAttack,
  fightKind: ChatBossFightKind,
  visibleChannelId: ChatVisibleChannel,
): string {
  if (visibleChannelId === 'DEAL_ROOM') {
    return `Deal-room posture loads for ${attack.attackType} inside ${fightKind}.`;
  }
  return `Pressure posture loads for ${attack.attackClass} inside ${fightKind}.`;
}

function silenceBeatBody(
  attack: ChatBossAttack,
  pressureTier: PressureTier,
  telegraph: ChatBossTelegraph,
): string {
  return [
    `Silence lead-in: ${telegraph.silenceLeadInMs}ms.`,
    `${attack.attackClass} is using quiet as pressure instead of empty space.`,
    `Current tier: ${pressureTier}.`,
  ].join(' ');
}

function typingBeatBody(
  attack: ChatBossAttack,
  visibleChannelId: ChatVisibleChannel,
  witness: ChatTelegraphWitnessProjection,
): string {
  return [
    `${attack.attackClass} recommends typing theater on ${visibleChannelId}.`,
    `Witness density=${Number(witness.witnessDensity01).toFixed(2)}.`,
  ].join(' ');
}

function tiltBeatBody(
  attack: ChatBossAttack,
  visibleChannelId: ChatVisibleChannel,
  witness: ChatTelegraphWitnessProjection,
): string {
  return visibleChannelId === 'DEAL_ROOM'
    ? `The negotiation lane narrows while ${witness.visibleWitnessCount} visible witness lanes remain in play.`
    : `${attack.attackClass} starts shifting witness posture before direct reveal.`;
}

function revealBeatBody(
  attack: ChatBossAttack,
  visibilityClass: ChatTelegraphVisibilityClass,
  witness: ChatTelegraphWitnessProjection,
  pressureTier: PressureTier,
): string {
  return [
    `${attack.label} resolves into ${visibilityClass.toLowerCase()} threat readability.`,
    `Pressure tier=${pressureTier}.`,
    `Crowd lean=${witness.crowdLean}.`,
  ].join(' ');
}

function aftermathHintBody(
  attack: ChatBossAttack,
  fightKind: ChatBossFightKind,
  witness: ChatTelegraphWitnessProjection,
  helper: ChatTelegraphHelperProjection,
): string {
  return [
    `${fightKind} aftermath hint for ${attack.attackClass}.`,
    witness.roomWatching ? 'Witness memory will matter.' : 'Witness memory is limited.',
    helper.helperShadowing ? 'Helper scrutiny remains active.' : 'Helper scrutiny stays backgrounded.',
  ].join(' ');
}

function createBeat(input: {
  readonly attack: ChatBossAttack;
  readonly kind: ChatTelegraphBeatKind;
  readonly order: number;
  readonly atMs: UnixMs;
  readonly visibleToPlayer: boolean;
  readonly emphasis01: number;
  readonly witnessWeight01: number;
  readonly helperWeight01: number;
  readonly label: string;
  readonly body: string;
  readonly metadata?: JsonValue;
}): ChatTelegraphBeat {
  return {
    beatId: `beat:${String(input.attack.attackId)}:${input.kind}:${String(input.order)}:${String(input.atMs)}`,
    kind: input.kind,
    order: input.order,
    atMs: input.atMs,
    visibleToPlayer: input.visibleToPlayer,
    emphasis01: toBossScore01(clamp01(input.emphasis01)),
    witnessWeight01: toBossScore01(clamp01(input.witnessWeight01)),
    helperWeight01: toBossScore01(clamp01(input.helperWeight01)),
    label: input.label,
    body: input.body,
    metadata: input.metadata,
  };
}

function overlayCue(
  code: ChatTelegraphOverlayCode,
  active: boolean,
  confidence01: Score01,
  priority100: Score100,
  title: string,
  subtitle: string,
  payload?: JsonValue,
): ChatTelegraphOverlayCue {
  return {
    code,
    active,
    confidence01,
    priority100,
    title,
    subtitle,
    payload,
  };
}

// ============================================================================
// MARK: Lower-level scalar helpers
// ============================================================================

function inferVisibleWitnessCount(
  state: ChatState,
  roomId: ChatRoomId,
  visibleChannelId: ChatVisibleChannel,
): number {
  const roomPresence = state.presence.byRoom[roomId] ?? {};
  let count = 0;
  for (const presence of Object.values(roomPresence)) {
    if (presence.visibleToRoom && !presence.spectating) {
      count += 1;
    }
  }
  if (visibleChannelId === 'GLOBAL') {
    count += 2;
  }
  return Math.max(0, count);
}

function inferLatentWitnessCount(
  input: {
    readonly state: ChatState;
    readonly room: ChatRoomState | null;
    readonly session: ChatSessionState | null;
    readonly visibleChannelId: ChatVisibleChannel;
    readonly attack: ChatBossAttack;
    readonly fightKind: ChatBossFightKind;
    readonly fightPlan?: ChatBossFightPlan | null;
    readonly audienceHeat: ChatAudienceHeat;
  },
  roomFloor: number,
  audienceHeat01: number,
  publicWeight: number,
): number {
  const transcriptCount = input.room
    ? (input.state.transcript.byRoom[input.room.roomId]?.length ?? 0)
    : 0;
  const transcriptWitnessBias = Math.min(6, Math.floor(transcriptCount / 14));
  const crowdBias = Math.floor(audienceHeat01 * 7);
  const publicBias = Math.floor(publicWeight * 5);
  const fightBias = input.fightKind === 'DEAL_ROOM_AMBUSH' ? 1 : input.attack.crowdAmplified ? 3 : 2;
  return Math.max(0, Math.floor(roomFloor * 4) + transcriptWitnessBias + crowdBias + publicBias + fightBias);
}

function deriveCrowdLean(
  attack: ChatBossAttack,
  audienceHeat: ChatAudienceHeat,
): ChatTelegraphWitnessProjection['crowdLean'] {
  if (audienceHeat.swarmDirection === 'POSITIVE') {
    return attack.crowdAmplified ? 'CURIOUS' : 'SUPPORTIVE';
  }
  if (audienceHeat.swarmDirection === 'NEGATIVE') {
    return 'HOSTILE';
  }
  if (attack.crowdAmplified) {
    return 'CURIOUS';
  }
  return 'NEUTRAL';
}

function buildHelperRationale(
  helperHaunt01: number,
  helperInterventionRisk01: number,
  rescueAllowed: boolean,
  pressureTier: PressureTier,
): string {
  const posture = rescueAllowed ? 'Rescue is legally on the board.' : 'Rescue is not formally enabled.';
  const visibility = helperHaunt01 >= 0.6
    ? 'Helper posture is near-surface.'
    : helperHaunt01 >= 0.38
      ? 'Helper posture is ghosting the lane.'
      : 'Helper posture remains dim.';
  const timing = helperInterventionRisk01 >= 0.66
    ? 'Intervention risk is high.'
    : helperInterventionRisk01 >= 0.42
      ? 'Intervention risk is moderate.'
      : 'Intervention risk is low.';
  return [posture, visibility, timing, `Pressure tier=${pressureTier}.`].join(' ');
}

function severityScalar(severity: ChatBossAttackSeverity): number {
  switch (severity) {
    case 'EXECUTION':
      return 1;
    case 'CRITICAL':
      return 0.82;
    case 'HEAVY':
      return 0.62;
    case 'PROBING':
    default:
      return 0.38;
  }
}

function pressureTierScalar(tier: PressureTier): number {
  switch (tier) {
    case 'CRITICAL':
      return 1;
    case 'HIGH':
      return 0.76;
    case 'ELEVATED':
      return 0.52;
    case 'BUILDING':
      return 0.28;
    case 'NONE':
    default:
      return 0.1;
  }
}

function createProjectionId(
  attackId: unknown,
  roundId: unknown,
  now: UnixMs,
): string {
  return `telegraph:${String(attackId)}:${String(roundId ?? 'roundless')}:${String(now)}`;
}

function trimMutableList<T>(list: T[], max: number): void {
  if (list.length <= max) {
    return;
  }
  list.splice(0, list.length - max);
}

function freezeLedger(
  roomId: ChatRoomId,
  ledger: MutableTelegraphLedger,
): ChatTelegraphPolicyLedger {
  const byAttackId: Record<string, readonly ChatTelegraphProjection[]> = {};
  for (const [key, value] of ledger.byAttackId.entries()) {
    byAttackId[key] = [...value];
  }
  return {
    roomId,
    projections: [...ledger.projections],
    byAttackId,
    lastProjectedAt: ledger.lastProjectedAt,
  };
}
