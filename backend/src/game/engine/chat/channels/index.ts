/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT CHANNEL SUITE BARREL
 * FILE: backend/src/game/engine/chat/channels/index.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend-chat channel barrel and orchestration surface for the
 * authoritative channel-policy subtree:
 *
 * - GlobalChannelPolicy
 * - SyndicateChannelPolicy
 * - DealRoomChannelPolicy
 * - LobbyChannelPolicy
 *
 * This file is intentionally large because it does more than re-export the
 * four channel-policy files. It is the authoritative suite-level entry point
 * for backend chat channel law. It exists so the backend chat engine can treat
 * channel policy as one coherent sovereign subsystem while still preserving the
 * different semantics of each channel lane.
 *
 * Backend-truth question
 * ----------------------
 *   "How does backend chat expose all authoritative channel functionality
 *    through one backend-pure suite without flattening the distinct law of
 *    GLOBAL, SYNDICATE, DEAL_ROOM, and LOBBY?"
 *
 * This file answers that by owning:
 * - the canonical barrel exports for the channel-policy subtree,
 * - suite-level construction and configuration law,
 * - typed routing to the correct channel-policy authority,
 * - shared manifests, capability matrices, and support tables,
 * - dispatch helpers for ingress/snapshot/compose access,
 * - suite-level diagnostics and audit record shaping,
 * - scenario and matrix aggregation,
 * - and one stable entry point for ChatChannelPolicy / ChatEngine usage.
 *
 * It does not own:
 * - transcript mutation,
 * - moderation redaction implementation,
 * - rate-window storage,
 * - socket/session transport,
 * - NPC line generation,
 * - or replay persistence.
 *
 * Design laws
 * -----------
 * - GLOBAL stays public-theater law.
 * - SYNDICATE stays trust/reputation/tactical law.
 * - DEAL_ROOM stays proof-bearing negotiation law.
 * - LOBBY stays pre-run staging and ready-state law.
 * - The suite may unify access, but it may not genericize semantics.
 * - Channel routing must remain inspectable at runtime.
 * - Any aggregated helper must still point back to the owning channel file.
 * - The backend suite must remain pure authority: no UI, no socket ownership.
 *
 * Canonical tree alignment
 * ------------------------
 * This file belongs under:
 *   backend/src/game/engine/chat/channels/index.ts
 *
 * and serves the authoritative backend lane described by the locked backend
 * simulation tree under:
 *   /backend/src/game/engine/chat
 * ============================================================================
 */

import * as Global from './GlobalChannelPolicy';
import * as Syndicate from './SyndicateChannelPolicy';
import * as DealRoom from './DealRoomChannelPolicy';
import * as Lobby from './LobbyChannelPolicy';

// ============================================================================
// MARK: Barrel exports — the suite must expose all underlying functionality
// ============================================================================

export * from './GlobalChannelPolicy';
export * from './SyndicateChannelPolicy';
export * from './DealRoomChannelPolicy';
export * from './LobbyChannelPolicy';

// ============================================================================
// MARK: Suite versions, paths, and identity
// ============================================================================

export const BACKEND_CHAT_CHANNEL_SUITE_VERSION = '2026.03.14' as const;
export const BACKEND_CHAT_CHANNEL_SUITE_PUBLIC_API_VERSION = '1.0.0-alpha' as const;

export const BACKEND_CHAT_CHANNEL_TREE_PATHS = Object.freeze({
  root: 'backend/src/game/engine/chat/channels',
  index: 'backend/src/game/engine/chat/channels/index.ts',
  global: 'backend/src/game/engine/chat/channels/GlobalChannelPolicy.ts',
  syndicate: 'backend/src/game/engine/chat/channels/SyndicateChannelPolicy.ts',
  dealRoom: 'backend/src/game/engine/chat/channels/DealRoomChannelPolicy.ts',
  lobby: 'backend/src/game/engine/chat/channels/LobbyChannelPolicy.ts',
} as const);

export const BACKEND_CHAT_CHANNEL_IDS = Object.freeze([
  'GLOBAL',
  'SYNDICATE',
  'DEAL_ROOM',
  'LOBBY',
] as const);

export type BackendChatChannelId =
  | Global.GlobalChannelId
  | Syndicate.SyndicateChannelId
  | DealRoom.DealRoomChannelId
  | Lobby.LobbyChannelId;

export type BackendChatSurfaceClass =
  | 'PUBLIC_THEATER'
  | 'TACTICAL_TRUST'
  | 'PRIVATE_NEGOTIATION'
  | 'PRE_RUN_STAGING';

export type BackendChatPrivacyClass =
  | 'PUBLIC'
  | 'SEMI_PRIVATE'
  | 'PRIVATE'
  | 'PRIVATE_PROOF_BEARING';

export type BackendChatAuthorityOwner =
  | 'GLOBAL_CHANNEL_POLICY'
  | 'SYNDICATE_CHANNEL_POLICY'
  | 'DEAL_ROOM_CHANNEL_POLICY'
  | 'LOBBY_CHANNEL_POLICY';

export type BackendChatSuiteOperation =
  | 'GET_POLICY'
  | 'GET_MANIFEST'
  | 'CHECK_MODE_SUPPORT'
  | 'EVALUATE_INGRESS'
  | 'EVALUATE_SNAPSHOT'
  | 'EVALUATE_COMPOSE_CAPABILITY'
  | 'CHECK_READ'
  | 'CHECK_WRITE'
  | 'BUILD_AUDIT'
  | 'GET_SCENARIOS'
  | 'GET_POLICY_MATRIX'
  | 'GET_RESTRICTIONS'
  | 'GET_HEALTH';

export type BackendChatSupportStatus =
  | 'SUPPORTED'
  | 'SUPPORTED_WITH_CONTEXT'
  | 'UNSUPPORTED'
  | 'CHANNEL_SPECIFIC';

export interface BackendChatChannelDescriptor {
  readonly id: BackendChatChannelId;
  readonly owner: BackendChatAuthorityOwner;
  readonly surfaceClass: BackendChatSurfaceClass;
  readonly privacyClass: BackendChatPrivacyClass;
  readonly path: string;
  readonly description: string;
  readonly supportsComposeCapability: boolean;
  readonly supportsNegotiation: boolean;
  readonly supportsReadyState: boolean;
  readonly supportsProofBearingTranscript: boolean;
  readonly supportsPublicWitnessAmplification: boolean;
}

export const BACKEND_CHAT_CHANNEL_DESCRIPTORS = Object.freeze<
  readonly BackendChatChannelDescriptor[]
>([
  {
    id: 'GLOBAL',
    owner: 'GLOBAL_CHANNEL_POLICY',
    surfaceClass: 'PUBLIC_THEATER',
    privacyClass: 'PUBLIC',
    path: BACKEND_CHAT_CHANNEL_TREE_PATHS.global,
    description:
      'Public witness lane for event theater, crowd heat, helper visibility, and hater pressure.',
    supportsComposeCapability: true,
    supportsNegotiation: false,
    supportsReadyState: false,
    supportsProofBearingTranscript: true,
    supportsPublicWitnessAmplification: true,
  },
  {
    id: 'SYNDICATE',
    owner: 'SYNDICATE_CHANNEL_POLICY',
    surfaceClass: 'TACTICAL_TRUST',
    privacyClass: 'SEMI_PRIVATE',
    path: BACKEND_CHAT_CHANNEL_TREE_PATHS.syndicate,
    description:
      'Trusted tactical lane for co-op, war-room, mentor, resource, and reputation-sensitive signals.',
    supportsComposeCapability: true,
    supportsNegotiation: false,
    supportsReadyState: false,
    supportsProofBearingTranscript: true,
    supportsPublicWitnessAmplification: false,
  },
  {
    id: 'DEAL_ROOM',
    owner: 'DEAL_ROOM_CHANNEL_POLICY',
    surfaceClass: 'PRIVATE_NEGOTIATION',
    privacyClass: 'PRIVATE_PROOF_BEARING',
    path: BACKEND_CHAT_CHANNEL_TREE_PATHS.dealRoom,
    description:
      'Private negotiation lane with lifecycle-locked proof directives and settlement-sensitive transcript law.',
    supportsComposeCapability: false,
    supportsNegotiation: true,
    supportsReadyState: false,
    supportsProofBearingTranscript: true,
    supportsPublicWitnessAmplification: false,
  },
  {
    id: 'LOBBY',
    owner: 'LOBBY_CHANNEL_POLICY',
    surfaceClass: 'PRE_RUN_STAGING',
    privacyClass: 'SEMI_PRIVATE',
    path: BACKEND_CHAT_CHANNEL_TREE_PATHS.lobby,
    description:
      'Pre-run social and ready-state lane for staging, onboarding, countdown, and launch gating.',
    supportsComposeCapability: false,
    supportsNegotiation: false,
    supportsReadyState: true,
    supportsProofBearingTranscript: false,
    supportsPublicWitnessAmplification: false,
  },
]);

export const BACKEND_CHAT_CHANNEL_DESCRIPTOR_MAP = Object.freeze(
  BACKEND_CHAT_CHANNEL_DESCRIPTORS.reduce(
    (accumulator, descriptor) => {
      accumulator[descriptor.id] = descriptor;
      return accumulator;
    },
    {} as Record<BackendChatChannelId, BackendChatChannelDescriptor>,
  ),
);

// ============================================================================
// MARK: Shared channel suite unions
// ============================================================================

export type BackendChatModeId =
  | Global.GlobalRunMode
  | Syndicate.SyndicateRunMode
  | DealRoom.DealRoomModeId
  | Lobby.LobbyModeId;

export type BackendChatIngressRequest =
  | {
      readonly channelId: 'GLOBAL';
      readonly input: Global.GlobalPolicyInput;
    }
  | {
      readonly channelId: 'SYNDICATE';
      readonly input: Syndicate.SyndicatePolicyInput;
    }
  | {
      readonly channelId: 'DEAL_ROOM';
      readonly room: DealRoom.DealRoomChannelState;
      readonly draft: DealRoom.DealRoomMessageDraft;
      readonly context: DealRoom.DealRoomIngressContext;
    }
  | {
      readonly channelId: 'LOBBY';
      readonly room: Lobby.LobbyChannelState;
      readonly draft: Lobby.LobbyMessageDraft;
      readonly context: Lobby.LobbyIngressContext;
    };

export type BackendChatSnapshotRequest =
  | {
      readonly channelId: 'GLOBAL';
      readonly input: Global.GlobalChannelSnapshotInput;
    }
  | {
      readonly channelId: 'SYNDICATE';
      readonly input: Syndicate.SyndicateSnapshotInput;
    }
  | {
      readonly channelId: 'DEAL_ROOM';
      readonly room: DealRoom.DealRoomChannelState;
    }
  | {
      readonly channelId: 'LOBBY';
      readonly room: Lobby.LobbyChannelState;
    };

export type BackendChatComposeCapabilityRequest =
  | {
      readonly channelId: 'GLOBAL';
      readonly gameplay: Global.GlobalGameplayState;
      readonly health: Global.GlobalChannelHealth;
      readonly audience: Global.GlobalAudienceState;
      readonly actor: Global.GlobalActorRef;
      readonly moderation?: Global.GlobalModerationSnapshot;
      readonly rate?: Global.GlobalRateState;
      readonly invasion?: Global.GlobalInvasionState;
      readonly surface?: Global.GlobalSurfaceContext;
    }
  | {
      readonly channelId: 'SYNDICATE';
      readonly gameplay: Syndicate.SyndicateGameplayState;
      readonly health: Syndicate.SyndicateChannelHealth;
      readonly membership: Syndicate.SyndicateMembershipState;
      readonly actor?: Syndicate.SyndicateIdentity;
    }
  | {
      readonly channelId: 'DEAL_ROOM';
      readonly room: DealRoom.DealRoomChannelState;
      readonly actor: DealRoom.DealRoomActorProfile;
      readonly kind: DealRoom.DealRoomMessageKind;
    }
  | {
      readonly channelId: 'LOBBY';
      readonly room: Lobby.LobbyChannelState;
      readonly actor: Lobby.LobbyActorProfile;
      readonly kind: Lobby.LobbyMessageKind;
    };

export type BackendChatAccessRequest =
  | {
      readonly channelId: 'DEAL_ROOM';
      readonly operation: 'JOIN' | 'READ' | 'WRITE';
      readonly room: DealRoom.DealRoomChannelState;
      readonly actor: DealRoom.DealRoomActorProfile;
      readonly kind?: DealRoom.DealRoomMessageKind;
    }
  | {
      readonly channelId: 'LOBBY';
      readonly operation: 'READ' | 'WRITE';
      readonly room: Lobby.LobbyChannelState;
      readonly actor: Lobby.LobbyActorProfile;
      readonly kind?: Lobby.LobbyMessageKind;
    };

export type BackendChatAuditRequest =
  | {
      readonly channelId: 'GLOBAL';
      readonly input: Global.GlobalPolicyInput;
      readonly decision: Global.GlobalIngressDecision;
    }
  | {
      readonly channelId: 'SYNDICATE';
      readonly input: Syndicate.SyndicatePolicyInput;
      readonly decision: Syndicate.SyndicateIngressDecision;
    }
  | {
      readonly channelId: 'DEAL_ROOM';
      readonly room: DealRoom.DealRoomChannelState;
      readonly draft: DealRoom.DealRoomMessageDraft;
      readonly context: DealRoom.DealRoomIngressContext;
      readonly decision: DealRoom.DealRoomIngressDecision;
    }
  | {
      readonly channelId: 'LOBBY';
      readonly room: Lobby.LobbyChannelState;
      readonly draft: Lobby.LobbyMessageDraft;
      readonly context: Lobby.LobbyIngressContext;
      readonly decision: Lobby.LobbyIngressDecision;
    };

export type BackendChatIngressDecision =
  | Global.GlobalIngressDecision
  | Syndicate.SyndicateIngressDecision
  | DealRoom.DealRoomIngressDecision
  | Lobby.LobbyIngressDecision;

export type BackendChatSnapshot =
  | Global.GlobalChannelSnapshot
  | Syndicate.SyndicateChannelSnapshot
  | DealRoom.DealRoomPolicySnapshot
  | Lobby.LobbyPolicySnapshot;

export type BackendChatComposeCapability =
  | Global.GlobalComposeCapability
  | Syndicate.SyndicateComposeCapability
  | BackendChatSyntheticComposeCapability;

export type BackendChatAuditRecord =
  | Global.GlobalPolicyAuditRecord
  | Syndicate.SyndicatePolicyAuditRecord
  | DealRoom.DealRoomAuditRecord
  | BackendChatSyntheticAuditRecord;

export interface BackendChatSyntheticComposeCapability {
  readonly channelId: DealRoom.DealRoomChannelId | Lobby.LobbyChannelId;
  readonly canCompose: boolean;
  readonly maxBodyLength: number;
  readonly availableKinds: readonly string[];
  readonly reasons: readonly string[];
}

export interface BackendChatSyntheticAuditRecord {
  readonly channelId: DealRoom.DealRoomChannelId | Lobby.LobbyChannelId;
  readonly summary: string;
  readonly status: string;
  readonly reasons: readonly string[];
}

export interface BackendChatChannelManifestRecord {
  readonly channelId: BackendChatChannelId;
  readonly manifest:
    | Global.GlobalChannelPolicyManifest
    | Syndicate.SyndicateChannelPolicyManifest
    | BackendChatSyntheticManifest;
}

export interface BackendChatSyntheticManifest {
  readonly id: DealRoom.DealRoomChannelId | Lobby.LobbyChannelId;
  readonly version: string;
  readonly supportedModes: readonly string[];
  readonly notes: readonly string[];
}

export interface BackendChatScenarioBundle {
  readonly channelId: BackendChatChannelId;
  readonly scenarios: readonly BackendChatScenarioDescriptor[];
}

export interface BackendChatScenarioDescriptor {
  readonly channelId: BackendChatChannelId;
  readonly id: string;
  readonly title: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface BackendChatPolicyMatrixBundle {
  readonly channelId: BackendChatChannelId;
  readonly rows: readonly BackendChatPolicyMatrixRow[];
}

export interface BackendChatPolicyMatrixRow {
  readonly channelId: BackendChatChannelId;
  readonly actorClass: string;
  readonly messageKind: string;
  readonly expectation: string;
}

export interface BackendChatAvailabilityProbe {
  readonly channelId: BackendChatChannelId;
  readonly mode: BackendChatModeId;
  readonly result: boolean;
  readonly reasons: readonly string[];
}

export interface BackendChatSuiteOptions {
  readonly global?: Global.GlobalChannelPolicyOptions;
  readonly syndicate?: Syndicate.SyndicateChannelPolicyOptions;
  readonly dealRoom?: never;
  readonly lobby?: never;
}

export interface BackendChatSuiteHealthReport {
  readonly version: string;
  readonly channelCount: number;
  readonly channels: readonly BackendChatSuiteHealthRow[];
}

export interface BackendChatSuiteHealthRow {
  readonly channelId: BackendChatChannelId;
  readonly owner: BackendChatAuthorityOwner;
  readonly supportsComposeCapability: boolean;
  readonly supportsNegotiation: boolean;
  readonly supportsReadyState: boolean;
  readonly proofBearing: boolean;
  readonly policyObjectPresent: boolean;
}

// ============================================================================
// MARK: Suite constants, notes, and capability matrices
// ============================================================================

export const BACKEND_CHAT_CHANNEL_NOTES: Readonly<Record<BackendChatChannelId, readonly string[]>> = {
  GLOBAL: Object.freeze([
    'Owns public theater admission and witness amplification.',
    'Supports helper and hater public visibility under policy control.',
    'Can escalate legend-eligible moments without bypassing moderation or rate law.',
  ]),
  SYNDICATE: Object.freeze([
    'Owns trust, clearance, room posture, and tactical compose law.',
    'Treats co-op and war-room identity as first-class channel constraints.',
    'Rejects direct hater intrusion as a default trust-preserving posture.',
  ]),
  DEAL_ROOM: Object.freeze([
    'Owns private negotiation lifecycle and proof-bearing transcript law.',
    'Suppresses casual NPC/helper/hater chatter unless the room doctrine explicitly allows it.',
    'Supports settlement locks, dispute escalation, and archive restrictions.',
  ]),
  LOBBY: Object.freeze([
    'Owns pre-run staging, ready-check, countdown, and lobby taunt/helper windows.',
    'Narrows write legality as launch approaches.',
    'Allows faster social traffic than DEAL_ROOM while staying backend-authoritative.',
  ]),
};

export const BACKEND_CHAT_CHANNEL_CAPABILITY_MATRIX = Object.freeze({
  GLOBAL: {
    composeCapability: true,
    snapshot: true,
    ingress: true,
    negotiation: false,
    readyState: false,
    proofBearing: true,
    audit: true,
  },
  SYNDICATE: {
    composeCapability: true,
    snapshot: true,
    ingress: true,
    negotiation: false,
    readyState: false,
    proofBearing: true,
    audit: true,
  },
  DEAL_ROOM: {
    composeCapability: true,
    snapshot: true,
    ingress: true,
    negotiation: true,
    readyState: false,
    proofBearing: true,
    audit: true,
  },
  LOBBY: {
    composeCapability: true,
    snapshot: true,
    ingress: true,
    negotiation: false,
    readyState: true,
    proofBearing: false,
    audit: true,
  },
} as const);

export const BACKEND_CHAT_MODE_CHANNEL_AFFINITY = Object.freeze({
  solo: ['GLOBAL', 'DEAL_ROOM', 'LOBBY'] as const,
  'asymmetric-pvp': ['GLOBAL', 'DEAL_ROOM', 'LOBBY'] as const,
  'co-op': ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY'] as const,
  ghost: ['GLOBAL', 'DEAL_ROOM', 'LOBBY'] as const,
  syndicate: ['SYNDICATE', 'DEAL_ROOM', 'LOBBY'] as const,
  tournament: ['DEAL_ROOM', 'LOBBY'] as const,
  sandbox: ['DEAL_ROOM', 'LOBBY'] as const,
  unknown: ['LOBBY'] as const,
} as const);

export const BACKEND_CHAT_POLICY_ROUTING_NOTES = Object.freeze([
  'GLOBAL and SYNDICATE expose native compose-capability APIs.',
  'DEAL_ROOM and LOBBY expose authoritative write-check APIs, so suite compose-capability is synthesized from those channel laws rather than invented independently.',
  'DEAL_ROOM and LOBBY snapshots are built from room state directly.',
  'Suite-level mode support keeps channel-specific context explicit where needed.',
] as const);

// ============================================================================
// MARK: Utility helpers
// ============================================================================

function assertNever(value: never): never {
  throw new Error(`Unhandled channel branch: ${String(value)}`);
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function normalizeModeId(mode: BackendChatModeId): BackendChatModeId {
  return mode;
}

function descriptorForChannel(channelId: BackendChatChannelId): BackendChatChannelDescriptor {
  return BACKEND_CHAT_CHANNEL_DESCRIPTOR_MAP[channelId];
}

function syntheticManifestForDealRoom(): BackendChatSyntheticManifest {
  return {
    id: 'DEAL_ROOM',
    version: BACKEND_CHAT_CHANNEL_SUITE_VERSION,
    supportedModes: [...new DealRoom.DealRoomChannelPolicy().getAvailableModes()],
    notes: BACKEND_CHAT_CHANNEL_NOTES.DEAL_ROOM,
  };
}

function syntheticManifestForLobby(): BackendChatSyntheticManifest {
  return {
    id: 'LOBBY',
    version: BACKEND_CHAT_CHANNEL_SUITE_VERSION,
    supportedModes: [...new Lobby.LobbyChannelPolicy().getAvailableModes()],
    notes: BACKEND_CHAT_CHANNEL_NOTES.LOBBY,
  };
}

function createSyntheticComposeCapabilityForDealRoom(
  policy: DealRoom.DealRoomChannelPolicy,
  room: DealRoom.DealRoomChannelState,
  actor: DealRoom.DealRoomActorProfile,
  kind: DealRoom.DealRoomMessageKind,
): BackendChatSyntheticComposeCapability {
  const canJoin = policy.canJoin(room, actor);
  const canRead = policy.canRead(room, actor);
  const canWrite = policy.canWrite(room, actor, kind);
  const proof = policy.getProofDirective(room, kind);
  const bodyLimitMatrix = DealRoom.inspectDealRoomBodyLimits();
  const maxBodyLength = bodyLimitMatrix[kind];
  const reasons = uniqueStrings([
    ...policy.summarizeRestrictions(room),
    canJoin ? 'join_allowed' : 'join_blocked',
    canRead ? 'read_allowed' : 'read_blocked',
    canWrite ? 'write_allowed' : 'write_blocked',
    `proof_requirement:${proof.requirement}`,
    `visibility:${policy.getVisibilityClass(room, actor)}`,
    `transcript_mode:${room.proof.transcriptMode}`,
  ]);

  return {
    channelId: 'DEAL_ROOM',
    canCompose: canJoin && canRead && canWrite,
    maxBodyLength,
    availableKinds: DealRoom.inspectDealRoomRoleMatrix()[(room.memberships.find((membership) => membership.actorId === actor.actorId)?.role ?? 'none') as DealRoom.DealRoomMembershipRole],
    reasons,
  };
}

function createSyntheticComposeCapabilityForLobby(
  policy: Lobby.LobbyChannelPolicy,
  room: Lobby.LobbyChannelState,
  actor: Lobby.LobbyActorProfile,
  kind: Lobby.LobbyMessageKind,
): BackendChatSyntheticComposeCapability {
  const role = room.memberships.find((membership) => membership.actorId === actor.actorId)?.role ?? 'none';

  const draft: Lobby.LobbyMessageDraft = {
    channelId: 'LOBBY',
    actorId: actor.actorId,
    actorKind: actor.actorKind,
    role,
    roomId: room.roomId,
    body: 'compose-capability-probe',
    kind,
    ts: Date.now(),
  };

  const context: Lobby.LobbyIngressContext = {
    actor,
    room,
    nowMs: draft.ts,
    recentSendTimestampsMs: [],
    recentKinds: [],
  };

  const ingress = policy.evaluateIngress(draft, context);
  const reasons = uniqueStrings([
    ...policy.summarizeRestrictions(room),
    ingress.status,
    ingress.code ?? 'none',
    `visibility:${policy.getVisibilityClass(actor)}`,
    `phase:${room.phase}`,
  ]);

  return {
    channelId: 'LOBBY',
    canCompose: ingress.status === 'allow' || ingress.status === 'allow_shadow',
    maxBodyLength: Lobby.inspectLobbyBodyLimits()[kind],
    availableKinds: Lobby.inspectLobbyRoleMatrix()[role as Lobby.LobbyRole],
    reasons,
  };
}

function createSyntheticAuditRecordForLobby(
  room: Lobby.LobbyChannelState,
  draft: Lobby.LobbyMessageDraft,
  context: Lobby.LobbyIngressContext,
  decision: Lobby.LobbyIngressDecision,
): BackendChatSyntheticAuditRecord {
  return {
    channelId: 'LOBBY',
    summary: `lobby:${room.phase}:${draft.kind}:${decision.status}`,
    status: decision.status,
    reasons: uniqueStrings([
      decision.code ?? 'none',
      `phase:${room.phase}`,
      `mode:${context.room.modeId}`,
      `actor:${draft.actorKind}`,
    ]),
  };
}

function createSyntheticAuditRecordForDealRoom(
  room: DealRoom.DealRoomChannelState,
  draft: DealRoom.DealRoomMessageDraft,
  context: DealRoom.DealRoomIngressContext,
  decision: DealRoom.DealRoomIngressDecision,
): BackendChatSyntheticAuditRecord {
  return {
    channelId: 'DEAL_ROOM',
    summary: `deal_room:${room.negotiation.lifecycle}:${draft.kind}:${decision.status}`,
    status: decision.status,
    reasons: uniqueStrings([
      decision.code ?? 'none',
      `lifecycle:${room.negotiation.lifecycle}`,
      `mode:${context.room.modeId}`,
      `role:${draft.role}`,
      `proof:${decision.proof.requirement}`,
    ]),
  };
}

function mapGlobalMatrixRows(): readonly BackendChatPolicyMatrixRow[] {
  return Global.GLOBAL_POLICY_MATRIX.map((row) => ({
    channelId: 'GLOBAL',
    actorClass: row.actor,
    messageKind: row.kind,
    expectation: String('defaultDecision' in row ? row.defaultDecision : (row as any).baseDecision ?? ''),
  }));
}

function mapSyndicateMatrixRows(): readonly BackendChatPolicyMatrixRow[] {
  return Syndicate.SYNDICATE_POLICY_MATRIX.map((row) => ({
    channelId: 'SYNDICATE',
    actorClass: row.actor,
    messageKind: row.kind,
    expectation: String('defaultDecision' in row ? row.defaultDecision : (row as any).baseDecision ?? ''),
  }));
}

function mapDealRoomMatrixRows(): readonly BackendChatPolicyMatrixRow[] {
  const actorMatrix = DealRoom.inspectDealRoomActorMatrix();
  const rows: BackendChatPolicyMatrixRow[] = [];
  (Object.keys(actorMatrix) as DealRoom.DealRoomActorKind[]).forEach((actorClass) => {
    actorMatrix[actorClass].forEach((messageKind) => {
      rows.push({
        channelId: 'DEAL_ROOM',
        actorClass,
        messageKind,
        expectation: 'CHANNEL_SPECIFIC_ROLE_AND_LIFECYCLE_CHECK',
      });
    });
  });
  return rows;
}

function mapLobbyMatrixRows(): readonly BackendChatPolicyMatrixRow[] {
  const actorMatrix = Lobby.inspectLobbyActorMatrix();
  const rows: BackendChatPolicyMatrixRow[] = [];
  (Object.keys(actorMatrix) as Lobby.LobbyActorKind[]).forEach((actorClass) => {
    actorMatrix[actorClass].forEach((messageKind) => {
      rows.push({
        channelId: 'LOBBY',
        actorClass,
        messageKind,
        expectation: 'CHANNEL_SPECIFIC_ROLE_AND_PHASE_CHECK',
      });
    });
  });
  return rows;
}

function scenarioBundleForGlobal(): BackendChatScenarioBundle {
  return {
    channelId: 'GLOBAL',
    scenarios: [
      {
        channelId: 'GLOBAL',
        id: 'GLOBAL_MATRIX_SAMPLE_1',
        title: 'Public outcome witness',
        payload: {
          matrixRows: Global.listGlobalMatrixRowsForActor('PLAYER').slice(0, 3),
          spotlightEligibleKinds: Global.GLOBAL_SPOTLIGHT_ELIGIBILITY,
          publicWitnessNotes: Global.GLOBAL_PUBLIC_WITNESS_NOTES,
        },
      },
      {
        channelId: 'GLOBAL',
        id: 'GLOBAL_MATRIX_SAMPLE_2',
        title: 'Global crowd and helper priorities',
        payload: {
          helperPriorities: Global.GLOBAL_HELPER_PUBLIC_PRIORITIES,
          haterPriorities: Global.GLOBAL_HATER_PUBLIC_PRIORITIES,
          crowdMutedSurfaces: Global.GLOBAL_CROWD_MUTING_SURFACES,
        },
      },
    ],
  };
}

function scenarioBundleForSyndicate(): BackendChatScenarioBundle {
  return {
    channelId: 'SYNDICATE',
    scenarios: [
      {
        channelId: 'SYNDICATE',
        id: 'SYNDICATE_MATRIX_SAMPLE_1',
        title: 'Syndicate trust and tactical sample',
        payload: {
          matrixRows: Syndicate.listSyndicateMatrixRowsForActor('PLAYER').slice(0, 3),
          blockedHaterKinds: Syndicate.SYNDICATE_BLOCKED_HATER_KINDS,
          primaryModes: Syndicate.SYNDICATE_PRIMARY_MODES,
        },
      },
      {
        channelId: 'SYNDICATE',
        id: 'SYNDICATE_MATRIX_SAMPLE_2',
        title: 'Syndicate audience and rate sample',
        payload: {
          rateLimits: Syndicate.SYNDICATE_RATE_LIMITS,
          trustScores: Syndicate.SYNDICATE_TRUST_SCORE,
          clearanceScores: Syndicate.SYNDICATE_CLEARANCE_SCORE,
        },
      },
    ],
  };
}

function scenarioBundleForDealRoom(): BackendChatScenarioBundle {
  return {
    channelId: 'DEAL_ROOM',
    scenarios: [
      {
        channelId: 'DEAL_ROOM',
        id: 'DEAL_ROOM_SCENARIO_1_OPENING_OFFER',
        title: 'Opening offer',
        payload: DealRoom.DEAL_ROOM_SCENARIO_1_OPENING_OFFER,
      },
      {
        channelId: 'DEAL_ROOM',
        id: 'DEAL_ROOM_SCENARIO_2_COUNTER_WINDOW',
        title: 'Counter window',
        payload: DealRoom.DEAL_ROOM_SCENARIO_2_COUNTER_WINDOW,
      },
      {
        channelId: 'DEAL_ROOM',
        id: 'DEAL_ROOM_SCENARIO_3_ACCEPTANCE_WINDOW',
        title: 'Acceptance window',
        payload: DealRoom.DEAL_ROOM_SCENARIO_3_ACCEPTANCE_WINDOW,
      },
      {
        channelId: 'DEAL_ROOM',
        id: 'DEAL_ROOM_SCENARIO_4_DISPUTE_ESCALATION',
        title: 'Dispute escalation',
        payload: DealRoom.DEAL_ROOM_SCENARIO_4_DISPUTE_ESCALATION,
      },
      {
        channelId: 'DEAL_ROOM',
        id: 'DEAL_ROOM_SCENARIO_5_ARCHIVE_PROOF',
        title: 'Archive proof',
        payload: DealRoom.DEAL_ROOM_SCENARIO_5_ARCHIVE_PROOF,
      },
    ],
  };
}

function scenarioBundleForLobby(): BackendChatScenarioBundle {
  return {
    channelId: 'LOBBY',
    scenarios: [
      {
        channelId: 'LOBBY',
        id: 'LOBBY_SCENARIO_1_SOCIAL_OPEN',
        title: 'Social open',
        payload: Lobby.LOBBY_SCENARIO_1_SOCIAL_OPEN,
      },
      {
        channelId: 'LOBBY',
        id: 'LOBBY_SCENARIO_2_READY_SIGNAL',
        title: 'Ready signal',
        payload: Lobby.LOBBY_SCENARIO_2_READY_SIGNAL,
      },
      {
        channelId: 'LOBBY',
        id: 'LOBBY_SCENARIO_3_COUNTDOWN_TAUNT',
        title: 'Countdown taunt',
        payload: Lobby.LOBBY_SCENARIO_3_COUNTDOWN_TAUNT,
      },
      {
        channelId: 'LOBBY',
        id: 'LOBBY_SCENARIO_4_HELPER_ONBOARD',
        title: 'Helper onboard',
        payload: Lobby.LOBBY_SCENARIO_4_HELPER_ONBOARD,
      },
      {
        channelId: 'LOBBY',
        id: 'LOBBY_SCENARIO_5_POST_CANCEL_RESET',
        title: 'Post-cancel reset',
        payload: Lobby.LOBBY_SCENARIO_5_POST_CANCEL_RESET,
      },
    ],
  };
}

// ============================================================================
// MARK: BackendChatChannelSuite
// ============================================================================

export class BackendChatChannelSuite {
  private readonly globalPolicy: Global.GlobalChannelPolicy;
  private readonly syndicatePolicy: Syndicate.SyndicateChannelPolicy;
  private readonly dealRoomPolicy: DealRoom.DealRoomChannelPolicy;
  private readonly lobbyPolicy: Lobby.LobbyChannelPolicy;

  public constructor(options: BackendChatSuiteOptions = {}) {
    this.globalPolicy = new Global.GlobalChannelPolicy(options.global ?? {});
    this.syndicatePolicy = new Syndicate.SyndicateChannelPolicy(options.syndicate ?? {});
    this.dealRoomPolicy = DealRoom.dealRoomChannelPolicy;
    this.lobbyPolicy = Lobby.lobbyChannelPolicy;
  }

  public getVersion(): string {
    return BACKEND_CHAT_CHANNEL_SUITE_VERSION;
  }

  public listChannelIds(): readonly BackendChatChannelId[] {
    return BACKEND_CHAT_CHANNEL_IDS;
  }

  public getDescriptor(channelId: BackendChatChannelId): BackendChatChannelDescriptor {
    return descriptorForChannel(channelId);
  }

  public getPolicyById(channelId: 'GLOBAL'): Global.GlobalChannelPolicy;
  public getPolicyById(channelId: 'SYNDICATE'): Syndicate.SyndicateChannelPolicy;
  public getPolicyById(channelId: 'DEAL_ROOM'): DealRoom.DealRoomChannelPolicy;
  public getPolicyById(channelId: 'LOBBY'): Lobby.LobbyChannelPolicy;
  public getPolicyById(channelId: BackendChatChannelId):
    | Global.GlobalChannelPolicy
    | Syndicate.SyndicateChannelPolicy
    | DealRoom.DealRoomChannelPolicy
    | Lobby.LobbyChannelPolicy {
    switch (channelId) {
      case 'GLOBAL':
        return this.globalPolicy;
      case 'SYNDICATE':
        return this.syndicatePolicy;
      case 'DEAL_ROOM':
        return this.dealRoomPolicy;
      case 'LOBBY':
        return this.lobbyPolicy;
      default:
        return assertNever(channelId);
    }
  }

  public getManifest(channelId: 'GLOBAL'): Global.GlobalChannelPolicyManifest;
  public getManifest(channelId: 'SYNDICATE'): Syndicate.SyndicateChannelPolicyManifest;
  public getManifest(channelId: 'DEAL_ROOM' | 'LOBBY'): BackendChatSyntheticManifest;
  public getManifest(channelId: BackendChatChannelId):
    | Global.GlobalChannelPolicyManifest
    | Syndicate.SyndicateChannelPolicyManifest
    | BackendChatSyntheticManifest {
    switch (channelId) {
      case 'GLOBAL':
        return this.globalPolicy.getManifest();
      case 'SYNDICATE':
        return this.syndicatePolicy.getManifest();
      case 'DEAL_ROOM':
        return syntheticManifestForDealRoom();
      case 'LOBBY':
        return syntheticManifestForLobby();
      default:
        return assertNever(channelId);
    }
  }

  public getAllManifests(): readonly BackendChatChannelManifestRecord[] {
    return [
      {
        channelId: 'GLOBAL',
        manifest: this.getManifest('GLOBAL'),
      },
      {
        channelId: 'SYNDICATE',
        manifest: this.getManifest('SYNDICATE'),
      },
      {
        channelId: 'DEAL_ROOM',
        manifest: this.getManifest('DEAL_ROOM'),
      },
      {
        channelId: 'LOBBY',
        manifest: this.getManifest('LOBBY'),
      },
    ];
  }

  public isChannelAvailableForMode(
    channelId: BackendChatChannelId,
    mode: BackendChatModeId,
    context?: {
      readonly syndicateMembership?: Syndicate.SyndicateMembershipState;
    },
  ): BackendChatAvailabilityProbe {
    const normalizedMode = normalizeModeId(mode);
    switch (channelId) {
      case 'GLOBAL': {
        const castMode = normalizedMode as Global.GlobalRunMode;
        const result = this.globalPolicy.isAvailableInMode(castMode);
        return {
          channelId,
          mode: normalizedMode,
          result,
          reasons: result
            ? ['mode_supported_by_global']
            : ['mode_not_supported_by_global'],
        };
      }
      case 'SYNDICATE': {
        const membership = context?.syndicateMembership ?? {
          roomId: 'suite-default-room',
          roomType: 'UNKNOWN',
          roomPosture: 'BRIEFING',
          securityTier: 'OPEN',
          members: [],
        };
        const castMode = normalizedMode as Syndicate.SyndicateRunMode;
        const result = this.syndicatePolicy.isAvailableInMode(castMode, membership);
        return {
          channelId,
          mode: normalizedMode,
          result,
          reasons: result
            ? ['mode_supported_by_syndicate']
            : ['mode_requires_coop_or_war_room'],
        };
      }
      case 'DEAL_ROOM': {
        const castMode = normalizedMode as DealRoom.DealRoomModeId;
        const result = this.dealRoomPolicy.isModeSupported(castMode);
        return {
          channelId,
          mode: normalizedMode,
          result,
          reasons: result
            ? ['mode_supported_by_deal_room']
            : ['mode_not_supported_by_deal_room'],
        };
      }
      case 'LOBBY': {
        const castMode = normalizedMode as Lobby.LobbyModeId;
        const result = this.lobbyPolicy.isModeSupported(castMode);
        return {
          channelId,
          mode: normalizedMode,
          result,
          reasons: result
            ? ['mode_supported_by_lobby']
            : ['mode_not_supported_by_lobby'],
        };
      }
      default:
        return assertNever(channelId);
    }
  }

  public evaluateIngress(request: BackendChatIngressRequest): BackendChatIngressDecision {
    switch (request.channelId) {
      case 'GLOBAL':
        return this.globalPolicy.evaluateIngress(request.input);
      case 'SYNDICATE':
        return this.syndicatePolicy.evaluateIngress(request.input);
      case 'DEAL_ROOM':
        return this.dealRoomPolicy.evaluateIngress(
          request.draft,
          request.context,
        );
      case 'LOBBY':
        return this.lobbyPolicy.evaluateIngress(
          request.draft,
          request.context,
        );
      default:
        return assertNever(request);
    }
  }

  public evaluateSnapshot(request: BackendChatSnapshotRequest): BackendChatSnapshot {
    switch (request.channelId) {
      case 'GLOBAL':
        return this.globalPolicy.evaluateSnapshot(request.input);
      case 'SYNDICATE':
        return this.syndicatePolicy.evaluateSnapshot(request.input);
      case 'DEAL_ROOM':
        return this.dealRoomPolicy.buildSnapshot(request.room);
      case 'LOBBY':
        return this.lobbyPolicy.buildSnapshot(request.room);
      default:
        return assertNever(request);
    }
  }

  public evaluateComposeCapability(
    request: BackendChatComposeCapabilityRequest,
  ): BackendChatComposeCapability {
    switch (request.channelId) {
      case 'GLOBAL':
        return this.globalPolicy.evaluateComposeCapability(
          request.gameplay,
          request.health,
        );
      case 'SYNDICATE':
        return this.syndicatePolicy.evaluateComposeCapability(
          request.gameplay,
          request.health,
          request.membership,
          request.actor,
        );
      case 'DEAL_ROOM':
        return createSyntheticComposeCapabilityForDealRoom(
          this.dealRoomPolicy,
          request.room,
          request.actor,
          request.kind,
        );
      case 'LOBBY':
        return createSyntheticComposeCapabilityForLobby(
          this.lobbyPolicy,
          request.room,
          request.actor,
          request.kind,
        );
      default:
        return assertNever(request);
    }
  }

  public evaluateAccess(request: BackendChatAccessRequest): boolean {
    switch (request.channelId) {
      case 'DEAL_ROOM': {
        if (request.operation === 'JOIN') {
          return this.dealRoomPolicy.canJoin(request.room, request.actor);
        }
        if (request.operation === 'READ') {
          return this.dealRoomPolicy.canRead(request.room, request.actor);
        }
        if (!request.kind) return false;
        return this.dealRoomPolicy.canWrite(request.room, request.actor, request.kind);
      }
      case 'LOBBY': {
        if (request.operation === 'READ') {
          const visibility = this.lobbyPolicy.getVisibilityClass(request.actor);
          return visibility !== 'no_emit' && visibility !== 'shadow_only';
        }
        if (!request.kind) return false;
        const derivedRole = request.room.memberships.find((membership) => membership.actorId === request.actor.actorId)?.role ?? 'none';
        const probeDecision = this.lobbyPolicy.evaluateIngress(
          {
            channelId: 'LOBBY',
            actorId: request.actor.actorId,
            actorKind: request.actor.actorKind,
            role: derivedRole,
            roomId: request.room.roomId,
            body: 'write-capability-probe',
            kind: request.kind,
            ts: Date.now(),
          },
          {
            actor: request.actor,
            room: request.room,
            nowMs: Date.now(),
            recentSendTimestampsMs: [],
            recentKinds: [],
          },
        );
        return probeDecision.status === 'allow' || probeDecision.status === 'allow_shadow';
      }
      default:
        return assertNever(request);
    }
  }

  public buildAuditRecord(request: BackendChatAuditRequest): BackendChatAuditRecord {
    switch (request.channelId) {
      case 'GLOBAL':
        return Global.createGlobalPolicyAuditRecord(request.input, request.decision);
      case 'SYNDICATE':
        return Syndicate.createSyndicatePolicyAuditRecord(request.input, request.decision);
      case 'DEAL_ROOM':
        return this.dealRoomPolicy.buildAuditRecord(
          request.draft,
          request.room,
          request.decision,
        );
      case 'LOBBY':
        return createSyntheticAuditRecordForLobby(
          request.room,
          request.draft,
          request.context,
          request.decision,
        );
      default:
        return assertNever(request);
    }
  }

  public summarizeRestrictions(channelId: 'DEAL_ROOM', room: DealRoom.DealRoomChannelState): readonly string[];
  public summarizeRestrictions(channelId: 'LOBBY', room: Lobby.LobbyChannelState): readonly string[];
  public summarizeRestrictions(
    channelId: 'GLOBAL',
    room?: undefined,
  ): readonly string[];
  public summarizeRestrictions(
    channelId: 'SYNDICATE',
    room?: undefined,
  ): readonly string[];
  public summarizeRestrictions(
    channelId: BackendChatChannelId,
    room?: DealRoom.DealRoomChannelState | Lobby.LobbyChannelState,
  ): readonly string[] {
    switch (channelId) {
      case 'GLOBAL':
        return BACKEND_CHAT_CHANNEL_NOTES.GLOBAL;
      case 'SYNDICATE':
        return BACKEND_CHAT_CHANNEL_NOTES.SYNDICATE;
      case 'DEAL_ROOM':
        return room ? this.dealRoomPolicy.summarizeRestrictions(room as DealRoom.DealRoomChannelState) : BACKEND_CHAT_CHANNEL_NOTES.DEAL_ROOM;
      case 'LOBBY':
        return room ? this.lobbyPolicy.summarizeRestrictions(room as Lobby.LobbyChannelState) : BACKEND_CHAT_CHANNEL_NOTES.LOBBY;
      default:
        return assertNever(channelId);
    }
  }

  public getScenarioBundle(channelId: BackendChatChannelId): BackendChatScenarioBundle {
    switch (channelId) {
      case 'GLOBAL':
        return scenarioBundleForGlobal();
      case 'SYNDICATE':
        return scenarioBundleForSyndicate();
      case 'DEAL_ROOM':
        return scenarioBundleForDealRoom();
      case 'LOBBY':
        return scenarioBundleForLobby();
      default:
        return assertNever(channelId);
    }
  }

  public getAllScenarioBundles(): readonly BackendChatScenarioBundle[] {
    return [
      this.getScenarioBundle('GLOBAL'),
      this.getScenarioBundle('SYNDICATE'),
      this.getScenarioBundle('DEAL_ROOM'),
      this.getScenarioBundle('LOBBY'),
    ];
  }

  public getPolicyMatrixBundle(channelId: BackendChatChannelId): BackendChatPolicyMatrixBundle {
    switch (channelId) {
      case 'GLOBAL':
        return {
          channelId,
          rows: mapGlobalMatrixRows(),
        };
      case 'SYNDICATE':
        return {
          channelId,
          rows: mapSyndicateMatrixRows(),
        };
      case 'DEAL_ROOM':
        return {
          channelId,
          rows: mapDealRoomMatrixRows(),
        };
      case 'LOBBY':
        return {
          channelId,
          rows: mapLobbyMatrixRows(),
        };
      default:
        return assertNever(channelId);
    }
  }

  public getAllPolicyMatrices(): readonly BackendChatPolicyMatrixBundle[] {
    return [
      this.getPolicyMatrixBundle('GLOBAL'),
      this.getPolicyMatrixBundle('SYNDICATE'),
      this.getPolicyMatrixBundle('DEAL_ROOM'),
      this.getPolicyMatrixBundle('LOBBY'),
    ];
  }

  public buildHealthReport(): BackendChatSuiteHealthReport {
    const channels = this.listChannelIds().map((channelId) => {
      const descriptor = descriptorForChannel(channelId);
      return {
        channelId,
        owner: descriptor.owner,
        supportsComposeCapability: descriptor.supportsComposeCapability,
        supportsNegotiation: descriptor.supportsNegotiation,
        supportsReadyState: descriptor.supportsReadyState,
        proofBearing: descriptor.supportsProofBearingTranscript,
        policyObjectPresent: true,
      } satisfies BackendChatSuiteHealthRow;
    });

    return {
      version: BACKEND_CHAT_CHANNEL_SUITE_VERSION,
      channelCount: channels.length,
      channels,
    };
  }

  public explainOperationSupport(
    channelId: BackendChatChannelId,
    operation: BackendChatSuiteOperation,
  ): BackendChatSupportStatus {
    const capabilities = BACKEND_CHAT_CHANNEL_CAPABILITY_MATRIX[channelId];

    switch (operation) {
      case 'GET_POLICY':
      case 'GET_MANIFEST':
      case 'EVALUATE_INGRESS':
      case 'EVALUATE_SNAPSHOT':
      case 'GET_SCENARIOS':
      case 'GET_POLICY_MATRIX':
      case 'GET_RESTRICTIONS':
      case 'GET_HEALTH':
        return 'SUPPORTED';
      case 'CHECK_MODE_SUPPORT':
        return channelId === 'SYNDICATE' ? 'SUPPORTED_WITH_CONTEXT' : 'SUPPORTED';
      case 'EVALUATE_COMPOSE_CAPABILITY':
        return capabilities.composeCapability ? 'SUPPORTED' : 'UNSUPPORTED';
      case 'CHECK_READ':
      case 'CHECK_WRITE':
        return channelId === 'GLOBAL' || channelId === 'SYNDICATE'
          ? 'CHANNEL_SPECIFIC'
          : 'SUPPORTED';
      case 'BUILD_AUDIT':
        return capabilities.audit ? 'SUPPORTED' : 'UNSUPPORTED';
      default:
        return assertNever(operation);
    }
  }
}

// ============================================================================
// MARK: Singleton suite and top-level helper functions
// ============================================================================

export const backendChatChannelSuite = new BackendChatChannelSuite();

export function createBackendChatChannelSuite(
  options: BackendChatSuiteOptions = {},
): BackendChatChannelSuite {
  return new BackendChatChannelSuite(options);
}

export function getBackendChatChannelDescriptor(
  channelId: BackendChatChannelId,
): BackendChatChannelDescriptor {
  return backendChatChannelSuite.getDescriptor(channelId);
}

export function getBackendChatChannelManifest(
  channelId: BackendChatChannelId,
):
  | Global.GlobalChannelPolicyManifest
  | Syndicate.SyndicateChannelPolicyManifest
  | BackendChatSyntheticManifest {
  switch (channelId) {
    case 'GLOBAL':
      return backendChatChannelSuite.getManifest('GLOBAL');
    case 'SYNDICATE':
      return backendChatChannelSuite.getManifest('SYNDICATE');
    case 'DEAL_ROOM':
      return backendChatChannelSuite.getManifest('DEAL_ROOM');
    case 'LOBBY':
      return backendChatChannelSuite.getManifest('LOBBY');
    default:
      return assertNever(channelId);
  }
}

export function listBackendChatChannelIds(): readonly BackendChatChannelId[] {
  return backendChatChannelSuite.listChannelIds();
}

export function evaluateBackendChatChannelIngress(
  request: BackendChatIngressRequest,
): BackendChatIngressDecision {
  return backendChatChannelSuite.evaluateIngress(request);
}

export function evaluateBackendChatChannelSnapshot(
  request: BackendChatSnapshotRequest,
): BackendChatSnapshot {
  return backendChatChannelSuite.evaluateSnapshot(request);
}

export function evaluateBackendChatComposeCapability(
  request: BackendChatComposeCapabilityRequest,
): BackendChatComposeCapability {
  return backendChatChannelSuite.evaluateComposeCapability(request);
}

export function evaluateBackendChatAccess(
  request: BackendChatAccessRequest,
): boolean {
  return backendChatChannelSuite.evaluateAccess(request);
}

export function buildBackendChatAuditRecord(
  request: BackendChatAuditRequest,
): BackendChatAuditRecord {
  return backendChatChannelSuite.buildAuditRecord(request);
}

export function getBackendChatScenarioBundle(
  channelId: BackendChatChannelId,
): BackendChatScenarioBundle {
  return backendChatChannelSuite.getScenarioBundle(channelId);
}

export function getBackendChatPolicyMatrixBundle(
  channelId: BackendChatChannelId,
): BackendChatPolicyMatrixBundle {
  return backendChatChannelSuite.getPolicyMatrixBundle(channelId);
}

export function getBackendChatSuiteHealthReport(): BackendChatSuiteHealthReport {
  return backendChatChannelSuite.buildHealthReport();
}

export function explainBackendChatOperationSupport(
  channelId: BackendChatChannelId,
  operation: BackendChatSuiteOperation,
): BackendChatSupportStatus {
  return backendChatChannelSuite.explainOperationSupport(channelId, operation);
}

// ============================================================================
// MARK: Inspectable suite tables for ops, replay, and debug
// ============================================================================

export interface BackendChatChannelSummaryRow {
  readonly channelId: BackendChatChannelId;
  readonly surfaceClass: BackendChatSurfaceClass;
  readonly privacyClass: BackendChatPrivacyClass;
  readonly owner: BackendChatAuthorityOwner;
  readonly supportedModes: readonly string[];
  readonly notableFunctions: readonly string[];
}

export const BACKEND_CHAT_CHANNEL_SUMMARY_ROWS: readonly BackendChatChannelSummaryRow[] = [
  {
    channelId: 'GLOBAL',
    surfaceClass: 'PUBLIC_THEATER',
    privacyClass: 'PUBLIC',
    owner: 'GLOBAL_CHANNEL_POLICY',
    supportedModes: [...Global.GLOBAL_ALLOWED_MODES],
    notableFunctions: [
      'evaluateIngress',
      'evaluateSnapshot',
      'evaluateComposeCapability',
      'explainAvailability',
      'createDefaultSnapshotInput',
      'createGlobalPolicyAuditRecord',
    ],
  },
  {
    channelId: 'SYNDICATE',
    surfaceClass: 'TACTICAL_TRUST',
    privacyClass: 'SEMI_PRIVATE',
    owner: 'SYNDICATE_CHANNEL_POLICY',
    supportedModes: [...Syndicate.SYNDICATE_PRIMARY_MODES, 'WAR_ROOM_CONTEXT'],
    notableFunctions: [
      'evaluateIngress',
      'evaluateSnapshot',
      'evaluateComposeCapability',
      'createSyndicatePolicyAuditRecord',
      'listSyndicateMatrixRowsForActor',
    ],
  },
  {
    channelId: 'DEAL_ROOM',
    surfaceClass: 'PRIVATE_NEGOTIATION',
    privacyClass: 'PRIVATE_PROOF_BEARING',
    owner: 'DEAL_ROOM_CHANNEL_POLICY',
    supportedModes: [...syntheticManifestForDealRoom().supportedModes],
    notableFunctions: [
      'evaluateIngress',
      'buildSnapshot',
      'canJoin',
      'canRead',
      'canWrite',
      'getProofDirective',
      'buildAuditRecord',
    ],
  },
  {
    channelId: 'LOBBY',
    surfaceClass: 'PRE_RUN_STAGING',
    privacyClass: 'SEMI_PRIVATE',
    owner: 'LOBBY_CHANNEL_POLICY',
    supportedModes: [...syntheticManifestForLobby().supportedModes],
    notableFunctions: [
      'evaluateIngress',
      'buildSnapshot',
      'getVisibilityClass',
      'isCommandAllowed',
      'summarizeRestrictions',
    ],
  },
];

export interface BackendChatSuiteOperationMatrixRow {
  readonly operation: BackendChatSuiteOperation;
  readonly GLOBAL: BackendChatSupportStatus;
  readonly SYNDICATE: BackendChatSupportStatus;
  readonly DEAL_ROOM: BackendChatSupportStatus;
  readonly LOBBY: BackendChatSupportStatus;
}

export const BACKEND_CHAT_SUITE_OPERATION_MATRIX: readonly BackendChatSuiteOperationMatrixRow[] = [
  {
    operation: 'GET_POLICY',
    GLOBAL: 'SUPPORTED',
    SYNDICATE: 'SUPPORTED',
    DEAL_ROOM: 'SUPPORTED',
    LOBBY: 'SUPPORTED',
  },
  {
    operation: 'GET_MANIFEST',
    GLOBAL: 'SUPPORTED',
    SYNDICATE: 'SUPPORTED',
    DEAL_ROOM: 'SUPPORTED',
    LOBBY: 'SUPPORTED',
  },
  {
    operation: 'CHECK_MODE_SUPPORT',
    GLOBAL: 'SUPPORTED',
    SYNDICATE: 'SUPPORTED_WITH_CONTEXT',
    DEAL_ROOM: 'SUPPORTED',
    LOBBY: 'SUPPORTED',
  },
  {
    operation: 'EVALUATE_INGRESS',
    GLOBAL: 'SUPPORTED',
    SYNDICATE: 'SUPPORTED',
    DEAL_ROOM: 'SUPPORTED',
    LOBBY: 'SUPPORTED',
  },
  {
    operation: 'EVALUATE_SNAPSHOT',
    GLOBAL: 'SUPPORTED',
    SYNDICATE: 'SUPPORTED',
    DEAL_ROOM: 'SUPPORTED',
    LOBBY: 'SUPPORTED',
  },
  {
    operation: 'EVALUATE_COMPOSE_CAPABILITY',
    GLOBAL: 'SUPPORTED',
    SYNDICATE: 'SUPPORTED',
    DEAL_ROOM: 'SUPPORTED',
    LOBBY: 'SUPPORTED',
  },
  {
    operation: 'CHECK_READ',
    GLOBAL: 'CHANNEL_SPECIFIC',
    SYNDICATE: 'CHANNEL_SPECIFIC',
    DEAL_ROOM: 'SUPPORTED',
    LOBBY: 'SUPPORTED',
  },
  {
    operation: 'CHECK_WRITE',
    GLOBAL: 'CHANNEL_SPECIFIC',
    SYNDICATE: 'CHANNEL_SPECIFIC',
    DEAL_ROOM: 'SUPPORTED',
    LOBBY: 'SUPPORTED',
  },
  {
    operation: 'BUILD_AUDIT',
    GLOBAL: 'SUPPORTED',
    SYNDICATE: 'SUPPORTED',
    DEAL_ROOM: 'SUPPORTED',
    LOBBY: 'SUPPORTED',
  },
  {
    operation: 'GET_SCENARIOS',
    GLOBAL: 'SUPPORTED',
    SYNDICATE: 'SUPPORTED',
    DEAL_ROOM: 'SUPPORTED',
    LOBBY: 'SUPPORTED',
  },
  {
    operation: 'GET_POLICY_MATRIX',
    GLOBAL: 'SUPPORTED',
    SYNDICATE: 'SUPPORTED',
    DEAL_ROOM: 'SUPPORTED',
    LOBBY: 'SUPPORTED',
  },
  {
    operation: 'GET_RESTRICTIONS',
    GLOBAL: 'SUPPORTED',
    SYNDICATE: 'SUPPORTED',
    DEAL_ROOM: 'SUPPORTED',
    LOBBY: 'SUPPORTED',
  },
  {
    operation: 'GET_HEALTH',
    GLOBAL: 'SUPPORTED',
    SYNDICATE: 'SUPPORTED',
    DEAL_ROOM: 'SUPPORTED',
    LOBBY: 'SUPPORTED',
  },
];

export interface BackendChatModeAffinityRow {
  readonly mode: string;
  readonly channels: readonly BackendChatChannelId[];
}

export const BACKEND_CHAT_MODE_AFFINITY_ROWS: readonly BackendChatModeAffinityRow[] = [
  { mode: 'solo', channels: BACKEND_CHAT_MODE_CHANNEL_AFFINITY.solo },
  { mode: 'asymmetric-pvp', channels: BACKEND_CHAT_MODE_CHANNEL_AFFINITY['asymmetric-pvp'] },
  { mode: 'co-op', channels: BACKEND_CHAT_MODE_CHANNEL_AFFINITY['co-op'] },
  { mode: 'ghost', channels: BACKEND_CHAT_MODE_CHANNEL_AFFINITY.ghost },
  { mode: 'syndicate', channels: BACKEND_CHAT_MODE_CHANNEL_AFFINITY.syndicate },
  { mode: 'tournament', channels: BACKEND_CHAT_MODE_CHANNEL_AFFINITY.tournament },
  { mode: 'sandbox', channels: BACKEND_CHAT_MODE_CHANNEL_AFFINITY.sandbox },
  { mode: 'unknown', channels: BACKEND_CHAT_MODE_CHANNEL_AFFINITY.unknown },
];

export function inspectBackendChatChannelSummaryRows(): readonly BackendChatChannelSummaryRow[] {
  return BACKEND_CHAT_CHANNEL_SUMMARY_ROWS;
}

export function inspectBackendChatSuiteOperationMatrix(): readonly BackendChatSuiteOperationMatrixRow[] {
  return BACKEND_CHAT_SUITE_OPERATION_MATRIX;
}

export function inspectBackendChatModeAffinityRows(): readonly BackendChatModeAffinityRow[] {
  return BACKEND_CHAT_MODE_AFFINITY_ROWS;
}

export function inspectBackendChatRoutingNotes(): readonly string[] {
  return BACKEND_CHAT_POLICY_ROUTING_NOTES;
}

export function inspectBackendChatChannelNotes(
  channelId: BackendChatChannelId,
): readonly string[] {
  return BACKEND_CHAT_CHANNEL_NOTES[channelId];
}
