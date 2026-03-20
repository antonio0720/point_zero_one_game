/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT ENGINE
 * FILE: backend/src/game/engine/chat/channels/LobbyChannelPolicy.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative backend policy for LOBBY.
 * This file owns pre-run social law, ready-state chat gating, and lobby-stage injections.
 *
 * Doctrine
 * --------
 * - LOBBY is the staging lane for matchmaking, ready-check, countdown, and pre-run mood.
 * - Hater taunts and helper onboarding may appear here because donor chat logic includes lobby taunts and cold-start helper behavior.
 * - LOBBY remains lower-proof and faster than DEAL_ROOM, but still backend-authoritative.
 * - Spectators may read more than they can write, and countdown phases narrow what messages are legal.
 */

export type LobbyChannelId = 'LOBBY';

export type LobbyModeId =
  | 'solo'
  | 'co-op'
  | 'asymmetric-pvp'
  | 'ghost'
  | 'syndicate'
  | 'tournament'
  | 'sandbox'
  | 'unknown';

export type LobbyActorKind =
  | 'player'
  | 'system'
  | 'helper'
  | 'hater'
  | 'ambient_npc'
  | 'moderator'
  | 'admin'
  | 'service'
  | 'spectator';

export type LobbyRole =
  | 'host'
  | 'member'
  | 'guest'
  | 'spectator'
  | 'moderator'
  | 'observer'
  | 'none';

export type LobbyPhase =
  | 'open'
  | 'matchmaking'
  | 'ready_check'
  | 'countdown'
  | 'launching'
  | 'post_cancel'
  | 'closed'
  | 'spectating';

export type LobbyVisibilityClass =
  | 'room_only'
  | 'room_plus_moderation'
  | 'spectator_read'
  | 'shadow_only'
  | 'no_emit';

export type LobbyMessageKind =
  | 'PLAYER'
  | 'PLAYER_RESPONSE'
  | 'SYSTEM'
  | 'HELPER_TIP'
  | 'BOT_TAUNT'
  | 'NPC_AMBIENT'
  | 'MARKET_ALERT'
  | 'READY_STATE'
  | 'COUNTDOWN'
  | 'MATCH_STATUS'
  | 'ADMIN_NOTICE'
  | 'PARTY_INVITE'
  | 'PARTY_ACCEPT'
  | 'PARTY_REJECT'
  | 'COMMAND'
  | 'CURSOR'
  | 'TYPING'
  | 'PRESENCE';

export type LobbyCommand =
  | '/ready'
  | '/unready'
  | '/start'
  | '/cancel'
  | '/invite'
  | '/leave'
  | '/mute'
  | '/unmute'
  | '/help'
  | '/taunt';

export type LobbyIngressStatus =
  | 'allow'
  | 'allow_shadow'
  | 'reject'
  | 'defer';

export type LobbyRejectionCode =
  | 'MODE_NOT_ALLOWED'
  | 'PHASE_LOCKED'
  | 'ROLE_NOT_ALLOWED'
  | 'ROOM_NOT_JOINED'
  | 'COUNTDOWN_RESTRICTED'
  | 'SPECTATOR_READ_ONLY'
  | 'KIND_NOT_ALLOWED'
  | 'COMMAND_NOT_ALLOWED'
  | 'EMPTY_BODY'
  | 'MAX_LENGTH'
  | 'BURST_LIMIT'
  | 'HELPER_SUPPRESSED'
  | 'HATER_SUPPRESSED'
  | 'AMBIENT_SUPPRESSED'
  | 'UNKNOWN';

export interface LobbyActorProfile {
  actorId: string;
  actorKind: LobbyActorKind;
  teamId?: string;
  trustScore?: number;
  newPlayer?: boolean;
  muted?: boolean;
  shadowMuted?: boolean;
  haterTargeted?: boolean;
  helperEligible?: boolean;
}

export interface LobbyMembership {
  actorId: string;
  role: LobbyRole;
  joinedAtMs: number;
  isReady?: boolean;
  partyId?: string;
  canModerate?: boolean;
  canSeeShadow?: boolean;
}

export interface LobbyChannelState {
  roomId: string;
  modeId: LobbyModeId;
  phase: LobbyPhase;
  roomRevision: number;
  memberships: readonly LobbyMembership[];
  playerCount: number;
  spectatorCount: number;
  allowHaterTaunts: boolean;
  allowHelperTips: boolean;
  allowAmbient: boolean;
  countdownEndsAtMs?: number;
  launchAtMs?: number;
  maxBodyLength: number;
}

export interface LobbyMessageDraft {
  channelId: LobbyChannelId;
  actorId: string;
  actorKind: LobbyActorKind;
  role: LobbyRole;
  kind: LobbyMessageKind;
  command?: LobbyCommand;
  roomId: string;
  body: string;
  ts: number;
  metadata?: Readonly<Record<string, unknown>>;
  isEdit?: boolean;
  isDelete?: boolean;
}

export interface LobbyIngressContext {
  actor: LobbyActorProfile;
  room: LobbyChannelState;
  nowMs: number;
  recentSendTimestampsMs: readonly number[];
  recentKinds: readonly LobbyMessageKind[];
}

export interface LobbyRateWindow {
  burstLimit: number;
  burstWindowMs: number;
  sustainedLimit: number;
  sustainedWindowMs: number;
  cooldownMs: number;
}

export interface LobbyIngressDecision {
  status: LobbyIngressStatus;
  code?: LobbyRejectionCode;
  reasons: readonly string[];
  visibility: LobbyVisibilityClass;
  rateWindow: LobbyRateWindow;
  shouldPersist: boolean;
  shouldFanout: boolean;
  shouldEmitTelemetry: boolean;
  shouldEmitReplay: boolean;
  normalizedBody: string;
  auditLabels: readonly string[];
}

export interface LobbyPolicySnapshot {
  channelId: LobbyChannelId;
  availableInModes: readonly LobbyModeId[];
  phase: LobbyPhase;
  playerCount: number;
  spectatorCount: number;
  allowHaterTaunts: boolean;
  allowHelperTips: boolean;
  allowAmbient: boolean;
}

const LOBBY_CHANNEL_ID: LobbyChannelId = 'LOBBY';

const LOBBY_ALLOWED_MODES = [
  'solo',
  'co-op',
  'asymmetric-pvp',
  'ghost',
  'syndicate',
  'tournament',
  'sandbox',
] satisfies readonly LobbyModeId[];

const LOBBY_ALLOWED_BY_PHASE: Readonly<Record<LobbyPhase, readonly LobbyMessageKind[]>> = {
  open: [
    'PLAYER',
    'PLAYER_RESPONSE',
    'SYSTEM',
    'HELPER_TIP',
    'BOT_TAUNT',
    'NPC_AMBIENT',
    'MARKET_ALERT',
    'PARTY_INVITE',
    'PARTY_ACCEPT',
    'PARTY_REJECT',
    'COMMAND',
    'CURSOR',
    'TYPING',
    'PRESENCE',
  ],
  matchmaking: [
    'PLAYER',
    'PLAYER_RESPONSE',
    'SYSTEM',
    'HELPER_TIP',
    'BOT_TAUNT',
    'NPC_AMBIENT',
    'MATCH_STATUS',
    'PARTY_INVITE',
    'PARTY_ACCEPT',
    'PARTY_REJECT',
    'COMMAND',
    'TYPING',
    'PRESENCE',
  ],
  ready_check: [
    'PLAYER',
    'PLAYER_RESPONSE',
    'SYSTEM',
    'HELPER_TIP',
    'BOT_TAUNT',
    'READY_STATE',
    'MATCH_STATUS',
    'COMMAND',
    'TYPING',
    'PRESENCE',
  ],
  countdown: [
    'PLAYER_RESPONSE',
    'SYSTEM',
    'HELPER_TIP',
    'BOT_TAUNT',
    'COUNTDOWN',
    'READY_STATE',
    'COMMAND',
    'TYPING',
    'PRESENCE',
  ],
  launching: [
    'SYSTEM',
    'COUNTDOWN',
    'MATCH_STATUS',
    'PRESENCE',
  ],
  post_cancel: [
    'PLAYER',
    'PLAYER_RESPONSE',
    'SYSTEM',
    'HELPER_TIP',
    'NPC_AMBIENT',
    'MATCH_STATUS',
    'COMMAND',
    'TYPING',
    'PRESENCE',
  ],
  closed: [
    'SYSTEM',
    'PRESENCE',
  ],
  spectating: [
    'PLAYER_RESPONSE',
    'SYSTEM',
    'BOT_TAUNT',
    'NPC_AMBIENT',
    'MATCH_STATUS',
    'PRESENCE',
  ],
};

const LOBBY_ROLE_MATRIX: Readonly<Record<LobbyRole, readonly LobbyMessageKind[]>> = {
  host: [
    'PLAYER',
    'PLAYER_RESPONSE',
    'SYSTEM',
    'READY_STATE',
    'PARTY_INVITE',
    'PARTY_ACCEPT',
    'PARTY_REJECT',
    'COMMAND',
    'TYPING',
    'PRESENCE',
  ],
  member: [
    'PLAYER',
    'PLAYER_RESPONSE',
    'READY_STATE',
    'PARTY_ACCEPT',
    'PARTY_REJECT',
    'COMMAND',
    'TYPING',
    'PRESENCE',
  ],
  guest: [
    'PLAYER',
    'PLAYER_RESPONSE',
    'PARTY_ACCEPT',
    'PARTY_REJECT',
    'COMMAND',
    'TYPING',
    'PRESENCE',
  ],
  spectator: [
    'PLAYER_RESPONSE',
    'PRESENCE',
  ],
  moderator: [
    'SYSTEM',
    'ADMIN_NOTICE',
    'COMMAND',
    'PRESENCE',
  ],
  observer: [
    'PLAYER_RESPONSE',
    'PRESENCE',
  ],
  none: [
  ],
};

const LOBBY_ACTOR_MATRIX: Readonly<Record<LobbyActorKind, readonly LobbyMessageKind[]>> = {
  player: [
    'PLAYER',
    'PLAYER_RESPONSE',
    'READY_STATE',
    'PARTY_INVITE',
    'PARTY_ACCEPT',
    'PARTY_REJECT',
    'COMMAND',
    'CURSOR',
    'TYPING',
    'PRESENCE',
  ],
  system: [
    'SYSTEM',
    'COUNTDOWN',
    'MATCH_STATUS',
    'MARKET_ALERT',
    'ADMIN_NOTICE',
    'PRESENCE',
  ],
  helper: [
    'HELPER_TIP',
    'PRESENCE',
  ],
  hater: [
    'BOT_TAUNT',
    'PRESENCE',
  ],
  ambient_npc: [
    'NPC_AMBIENT',
    'PRESENCE',
  ],
  moderator: [
    'SYSTEM',
    'ADMIN_NOTICE',
    'COMMAND',
    'PRESENCE',
  ],
  admin: [
    'SYSTEM',
    'ADMIN_NOTICE',
    'COMMAND',
    'PRESENCE',
  ],
  service: [
    'SYSTEM',
    'MATCH_STATUS',
    'COUNTDOWN',
    'PRESENCE',
  ],
  spectator: [
    'PRESENCE',
  ],
};

const LOBBY_RATE_WINDOWS: Readonly<Record<LobbyActorKind, LobbyRateWindow>> = {
  player: { burstLimit: 6, burstWindowMs: 8000, sustainedLimit: 20, sustainedWindowMs: 60000, cooldownMs: 800 },
  system: { burstLimit: 12, burstWindowMs: 3000, sustainedLimit: 60, sustainedWindowMs: 60000, cooldownMs: 0 },
  helper: { burstLimit: 2, burstWindowMs: 20000, sustainedLimit: 6, sustainedWindowMs: 120000, cooldownMs: 15000 },
  hater: { burstLimit: 2, burstWindowMs: 30000, sustainedLimit: 4, sustainedWindowMs: 120000, cooldownMs: 25000 },
  ambient_npc: { burstLimit: 2, burstWindowMs: 45000, sustainedLimit: 4, sustainedWindowMs: 180000, cooldownMs: 30000 },
  moderator: { burstLimit: 12, burstWindowMs: 3000, sustainedLimit: 60, sustainedWindowMs: 60000, cooldownMs: 0 },
  admin: { burstLimit: 12, burstWindowMs: 3000, sustainedLimit: 60, sustainedWindowMs: 60000, cooldownMs: 0 },
  service: { burstLimit: 12, burstWindowMs: 3000, sustainedLimit: 60, sustainedWindowMs: 60000, cooldownMs: 0 },
  spectator: { burstLimit: 0, burstWindowMs: 10000, sustainedLimit: 0, sustainedWindowMs: 60000, cooldownMs: 0 },
};

const LOBBY_KIND_LABELS: Readonly<Record<LobbyMessageKind, readonly string[]>> = {
  PLAYER: ['player', 'freeform'],
  PLAYER_RESPONSE: ['player', 'response'],
  SYSTEM: ['system'],
  HELPER_TIP: ['helper'],
  BOT_TAUNT: ['hater'],
  NPC_AMBIENT: ['ambient'],
  MARKET_ALERT: ['market'],
  READY_STATE: ['ready'],
  COUNTDOWN: ['countdown'],
  MATCH_STATUS: ['match'],
  ADMIN_NOTICE: ['admin'],
  PARTY_INVITE: ['party'],
  PARTY_ACCEPT: ['party'],
  PARTY_REJECT: ['party'],
  COMMAND: ['command'],
  CURSOR: ['ephemeral'],
  TYPING: ['ephemeral'],
  PRESENCE: ['ephemeral'],
};

const LOBBY_BODY_LIMITS: Readonly<Record<LobbyMessageKind, number>> = {
  PLAYER: 420,
  PLAYER_RESPONSE: 420,
  SYSTEM: 280,
  HELPER_TIP: 220,
  BOT_TAUNT: 220,
  NPC_AMBIENT: 180,
  MARKET_ALERT: 220,
  READY_STATE: 80,
  COUNTDOWN: 80,
  MATCH_STATUS: 180,
  ADMIN_NOTICE: 320,
  PARTY_INVITE: 120,
  PARTY_ACCEPT: 120,
  PARTY_REJECT: 120,
  COMMAND: 180,
  CURSOR: 0,
  TYPING: 0,
  PRESENCE: 0,
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function unique<T>(items: readonly T[]): T[] {
  return Array.from(new Set(items));
}

function countRecent(windowMs: number, nowMs: number, timestamps: readonly number[]): number {
  const floor = nowMs - windowMs;
  return timestamps.filter((value) => value >= floor).length;
}

function getMembership(room: LobbyChannelState, actorId: string): LobbyMembership | undefined {
  return room.memberships.find((membership) => membership.actorId === actorId);
}

function kindAllowedForPhase(phase: LobbyPhase, kind: LobbyMessageKind): boolean {
  return LOBBY_ALLOWED_BY_PHASE[phase].includes(kind);
}

function kindAllowedForRole(role: LobbyRole, kind: LobbyMessageKind): boolean {
  return LOBBY_ROLE_MATRIX[role].includes(kind);
}

function kindAllowedForActor(actorKind: LobbyActorKind, kind: LobbyMessageKind): boolean {
  return LOBBY_ACTOR_MATRIX[actorKind].includes(kind);
}

export class LobbyChannelPolicy {
  public readonly channelId: LobbyChannelId = LOBBY_CHANNEL_ID;

  public getAvailableModes(): readonly LobbyModeId[] {
    return LOBBY_ALLOWED_MODES;
  }

  public isModeSupported(modeId: LobbyModeId): boolean {
    return (LOBBY_ALLOWED_MODES as readonly LobbyModeId[]).includes(modeId);
  }

  public buildSnapshot(room: LobbyChannelState): LobbyPolicySnapshot {
    return {
      channelId: this.channelId,
      availableInModes: LOBBY_ALLOWED_MODES,
      phase: room.phase,
      playerCount: room.playerCount,
      spectatorCount: room.spectatorCount,
      allowHaterTaunts: room.allowHaterTaunts,
      allowHelperTips: room.allowHelperTips,
      allowAmbient: room.allowAmbient,
    };
  }

  public getVisibilityClass(actor: LobbyActorProfile): LobbyVisibilityClass {
    if (actor.shadowMuted) {
      return 'shadow_only';
    }
    if (actor.actorKind === 'moderator' || actor.actorKind === 'admin') {
      return 'room_plus_moderation';
    }
    if (actor.actorKind === 'spectator') {
      return 'spectator_read';
    }
    return 'room_only';
  }

  public evaluateIngress(
    draft: LobbyMessageDraft,
    context: LobbyIngressContext,
  ): LobbyIngressDecision {
    const labels: string[] = [...(LOBBY_KIND_LABELS[draft.kind] ?? [])];
    const visibility = this.getVisibilityClass(context.actor);
    const rateWindow = LOBBY_RATE_WINDOWS[draft.actorKind];
    const normalizedBody = normalizeWhitespace(draft.body ?? '');

    if (draft.channelId !== LOBBY_CHANNEL_ID) {
      return this.reject('KIND_NOT_ALLOWED', ['wrong channel specialist received draft'], rateWindow, visibility, normalizedBody, labels);
    }

    if (!this.isModeSupported(context.room.modeId)) {
      return this.reject('MODE_NOT_ALLOWED', [`mode ${context.room.modeId} does not expose LOBBY`], rateWindow, visibility, normalizedBody, labels);
    }

    const membership = getMembership(context.room, draft.actorId);
    if (!membership && draft.actorKind !== 'system' && draft.actorKind !== 'service' && draft.actorKind !== 'moderator' && draft.actorKind !== 'admin') {
      return this.reject('ROOM_NOT_JOINED', ['actor is not joined to this lobby'], rateWindow, visibility, normalizedBody, labels);
    }

    if (!kindAllowedForActor(draft.actorKind, draft.kind)) {
      const code: LobbyRejectionCode = draft.actorKind === 'helper'
        ? 'HELPER_SUPPRESSED'
        : draft.actorKind === 'hater'
          ? 'HATER_SUPPRESSED'
          : draft.actorKind === 'ambient_npc'
            ? 'AMBIENT_SUPPRESSED'
            : 'KIND_NOT_ALLOWED';
      return this.reject(code, [`actor kind ${draft.actorKind} may not emit ${draft.kind} in lobby`], rateWindow, visibility, normalizedBody, labels);
    }

    if (!kindAllowedForPhase(context.room.phase, draft.kind)) {
      const code: LobbyRejectionCode = context.room.phase === 'countdown' || context.room.phase === 'launching'
        ? 'COUNTDOWN_RESTRICTED'
        : 'PHASE_LOCKED';
      return this.reject(code, [`kind ${draft.kind} is not allowed during phase ${context.room.phase}`], rateWindow, visibility, normalizedBody, labels);
    }

    if (membership && !kindAllowedForRole(membership.role, draft.kind)) {
      return this.reject(membership.role === 'spectator' ? 'SPECTATOR_READ_ONLY' : 'ROLE_NOT_ALLOWED', [`role ${membership.role} may not emit ${draft.kind}`], rateWindow, visibility, normalizedBody, labels);
    }

    if ((draft.isEdit || draft.isDelete) && draft.actorKind !== 'admin' && draft.actorKind !== 'moderator') {
      return this.reject('PHASE_LOCKED', ['lobby policy does not allow edit/delete through normal ingress'], rateWindow, visibility, normalizedBody, labels);
    }

    if (context.actor.muted || context.actor.shadowMuted) {
      labels.push('muted');
      return {
        status: 'allow_shadow',
        reasons: ['actor is muted or shadow-muted; emit only to shadow lane'],
        visibility: 'shadow_only',
        rateWindow,
        shouldPersist: draft.kind !== 'CURSOR' && draft.kind !== 'TYPING' && draft.kind !== 'PRESENCE',
        shouldFanout: false,
        shouldEmitTelemetry: true,
        shouldEmitReplay: false,
        normalizedBody,
        auditLabels: unique(labels),
      };
    }

    const limit = Math.min(context.room.maxBodyLength, LOBBY_BODY_LIMITS[draft.kind]);
    if (limit > 0 && normalizedBody.length === 0) {
      return this.reject('EMPTY_BODY', ['body is empty after normalization'], rateWindow, visibility, normalizedBody, labels);
    }
    if (limit > 0 && normalizedBody.length > limit) {
      return this.reject('MAX_LENGTH', [`body length ${normalizedBody.length} exceeds limit ${limit}`], rateWindow, visibility, normalizedBody, labels);
    }

    if ((draft.kind === 'HELPER_TIP' && !context.room.allowHelperTips) || (draft.actorKind === 'helper' && !context.actor.helperEligible)) {
      return this.reject('HELPER_SUPPRESSED', ['helper intervention is disabled for this lobby or actor'], rateWindow, visibility, normalizedBody, labels);
    }

    if ((draft.kind === 'BOT_TAUNT' && !context.room.allowHaterTaunts) || (draft.actorKind === 'hater' && !context.actor.haterTargeted)) {
      return this.reject('HATER_SUPPRESSED', ['hater taunts are disabled for this lobby or actor'], rateWindow, visibility, normalizedBody, labels);
    }

    if (draft.kind === 'NPC_AMBIENT' && !context.room.allowAmbient) {
      return this.reject('AMBIENT_SUPPRESSED', ['ambient chatter is disabled for this lobby'], rateWindow, visibility, normalizedBody, labels);
    }

    const burst = countRecent(rateWindow.burstWindowMs, context.nowMs, context.recentSendTimestampsMs);
    const sustained = countRecent(rateWindow.sustainedWindowMs, context.nowMs, context.recentSendTimestampsMs);
    if (rateWindow.burstLimit > 0 && burst >= rateWindow.burstLimit) {
      return this.reject('BURST_LIMIT', [`burst limit ${rateWindow.burstLimit} exceeded within ${rateWindow.burstWindowMs}ms`], rateWindow, visibility, normalizedBody, labels);
    }
    if (rateWindow.sustainedLimit > 0 && sustained >= rateWindow.sustainedLimit) {
      return this.reject('BURST_LIMIT', [`sustained limit ${rateWindow.sustainedLimit} exceeded within ${rateWindow.sustainedWindowMs}ms`], rateWindow, visibility, normalizedBody, labels);
    }

    if (draft.kind === 'COMMAND' && !this.isCommandAllowed(draft.command, membership?.role ?? draft.role, context.room.phase)) {
      return this.reject('COMMAND_NOT_ALLOWED', [`command ${draft.command ?? '(none)'} is not legal in phase ${context.room.phase}`], rateWindow, visibility, normalizedBody, labels);
    }

    if (draft.kind === 'READY_STATE') {
      labels.push('ready_state');
    }
    if (draft.kind === 'COUNTDOWN' || draft.kind === 'MATCH_STATUS') {
      labels.push('phase_signal');
    }
    if (draft.kind === 'HELPER_TIP' && context.actor.newPlayer) {
      labels.push('cold_start_helper');
    }
    if (draft.kind === 'BOT_TAUNT') {
      labels.push('lobby_taunt');
    }

    return {
      status: 'allow',
      reasons: ['message satisfies role, phase, and rate law for LOBBY'],
      visibility,
      rateWindow,
      shouldPersist: draft.kind !== 'CURSOR' && draft.kind !== 'TYPING' && draft.kind !== 'PRESENCE',
      shouldFanout: visibility !== 'shadow_only' && draft.kind !== 'CURSOR',
      shouldEmitTelemetry: true,
      shouldEmitReplay: draft.kind !== 'CURSOR' && draft.kind !== 'TYPING' && draft.kind !== 'PRESENCE',
      normalizedBody,
      auditLabels: unique(labels),
    };
  }

  public isCommandAllowed(command: LobbyCommand | undefined, role: LobbyRole, phase: LobbyPhase): boolean {
    if (!command) {
      return false;
    }
    switch (command) {
      case '/ready':
      case '/unready':
        return role === 'host' || role === 'member' || role === 'guest';
      case '/start':
        return role === 'host' && phase !== 'launching' && phase !== 'closed';
      case '/cancel':
        return role === 'host' || role === 'moderator';
      case '/invite':
        return role === 'host' || role === 'member';
      case '/leave':
        return role !== 'none';
      case '/mute':
      case '/unmute':
        return role === 'moderator' || role === 'host';
      case '/help':
      case '/taunt':
        return role !== 'spectator' && role !== 'none';
      default:
        return false;
    }
  }

  public describePhase(phase: LobbyPhase): string {
    switch (phase) {
      case 'open':
        return 'open social staging before matchmaking pressure tightens';
      case 'matchmaking':
        return 'players are assembling and party state is in flux';
      case 'ready_check':
        return 'members are expected to confirm readiness';
      case 'countdown':
        return 'countdown law narrows legal messages and increases urgency';
      case 'launching':
        return 'launch handoff is in progress and chat is mostly system-only';
      case 'post_cancel':
        return 'room remains open after cancellation for debrief and requeue';
      case 'closed':
        return 'room is closed and social append is finished';
      case 'spectating':
        return 'spectator law applies and participants are mostly read-only';
      default:
        return 'unknown lobby phase';
    }
  }

  public summarizeRestrictions(room: LobbyChannelState): readonly string[] {
    const restrictions: string[] = [];
    restrictions.push(`phase=${room.phase}`);
    restrictions.push(`allowHaterTaunts=${String(room.allowHaterTaunts)}`);
    restrictions.push(`allowHelperTips=${String(room.allowHelperTips)}`);
    restrictions.push(`allowAmbient=${String(room.allowAmbient)}`);
    restrictions.push(`playerCount=${String(room.playerCount)}`);
    restrictions.push(`spectatorCount=${String(room.spectatorCount)}`);
    if (typeof room.countdownEndsAtMs === 'number') {
      restrictions.push(`countdownEndsAtMs=${String(room.countdownEndsAtMs)}`);
    }
    if (typeof room.launchAtMs === 'number') {
      restrictions.push(`launchAtMs=${String(room.launchAtMs)}`);
    }
    return restrictions;
  }

  private reject(
    code: LobbyRejectionCode,
    reasons: readonly string[],
    rateWindow: LobbyRateWindow,
    visibility: LobbyVisibilityClass,
    normalizedBody: string,
    labels: readonly string[],
  ): LobbyIngressDecision {
    return {
      status: 'reject',
      code,
      reasons,
      visibility,
      rateWindow,
      shouldPersist: false,
      shouldFanout: false,
      shouldEmitTelemetry: true,
      shouldEmitReplay: false,
      normalizedBody,
      auditLabels: unique([...labels, 'rejected', code.toLowerCase()]),
    };
  }
}

export const lobbyChannelPolicy = new LobbyChannelPolicy();

export function inspectLobbyPhaseMatrix(): Readonly<Record<LobbyPhase, readonly LobbyMessageKind[]>> {
  return LOBBY_ALLOWED_BY_PHASE;
}

export function inspectLobbyRoleMatrix(): Readonly<Record<LobbyRole, readonly LobbyMessageKind[]>> {
  return LOBBY_ROLE_MATRIX;
}

export function inspectLobbyActorMatrix(): Readonly<Record<LobbyActorKind, readonly LobbyMessageKind[]>> {
  return LOBBY_ACTOR_MATRIX;
}

export function inspectLobbyBodyLimits(): Readonly<Record<LobbyMessageKind, number>> {
  return LOBBY_BODY_LIMITS;
}

export const LOBBY_SCENARIO_1_SOCIAL_OPEN = {
  phase: 'open' as LobbyPhase,
  role: 'member' as LobbyRole,
  kind: 'PLAYER' as LobbyMessageKind,
  allowedByPhase: LOBBY_ALLOWED_BY_PHASE['open'].includes('PLAYER' as LobbyMessageKind),
  allowedByActor: LOBBY_ACTOR_MATRIX['player' as LobbyActorKind] ?? [],
};

export const LOBBY_SCENARIO_2_READY_SIGNAL = {
  phase: 'ready_check' as LobbyPhase,
  role: 'member' as LobbyRole,
  kind: 'READY_STATE' as LobbyMessageKind,
  allowedByPhase: LOBBY_ALLOWED_BY_PHASE['ready_check'].includes('READY_STATE' as LobbyMessageKind),
  allowedByActor: LOBBY_ACTOR_MATRIX['player' as LobbyActorKind] ?? [],
};

export const LOBBY_SCENARIO_3_COUNTDOWN_TAUNT = {
  phase: 'countdown' as LobbyPhase,
  role: 'hater' as LobbyRole,
  kind: 'BOT_TAUNT' as LobbyMessageKind,
  allowedByPhase: LOBBY_ALLOWED_BY_PHASE['countdown'].includes('BOT_TAUNT' as LobbyMessageKind),
  allowedByActor: LOBBY_ACTOR_MATRIX['hater' as LobbyActorKind] ?? [],
};

export const LOBBY_SCENARIO_4_HELPER_ONBOARD = {
  phase: 'open' as LobbyPhase,
  role: 'helper' as LobbyRole,
  kind: 'HELPER_TIP' as LobbyMessageKind,
  allowedByPhase: LOBBY_ALLOWED_BY_PHASE['open'].includes('HELPER_TIP' as LobbyMessageKind),
  allowedByActor: LOBBY_ACTOR_MATRIX['helper' as LobbyActorKind] ?? [],
};

export const LOBBY_SCENARIO_5_POST_CANCEL_RESET = {
  phase: 'post_cancel' as LobbyPhase,
  role: 'host' as LobbyRole,
  kind: 'COMMAND' as LobbyMessageKind,
  allowedByPhase: LOBBY_ALLOWED_BY_PHASE['post_cancel'].includes('COMMAND' as LobbyMessageKind),
  allowedByActor: LOBBY_ACTOR_MATRIX['player' as LobbyActorKind] ?? [],
};

