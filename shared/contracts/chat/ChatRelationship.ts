
/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT RELATIONSHIP GRAPH CONTRACTS
 * FILE: shared/contracts/chat/ChatRelationship.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Capitalized relationship authority for the drama-first chat stack.
 *
 * The repo already contains `shared/contracts/chat/relationship.ts`, which owns
 * the current relationship vector and legacy projection shape. This file does
 * not replace that contract. It elevates it into a richer graph-based surface
 * used by frontend experience planners, backend authority, and future learning
 * lanes.
 *
 * This file is responsible for:
 * - graph topology
 * - player-to-counterpart link state
 * - channel focus / carryover / unresolved tension
 * - callback anchors and rescue debt carryover
 * - relationship policy snapshots
 * - deterministic projection helpers
 * - compatibility bridges back to the lowercase contract
 *
 * Design laws
 * -----------
 * 1. Shared-only. No runtime engine imports.
 * 2. Deterministic helpers only.
 * 3. Preserve lowercase relationship.ts as the compatibility floor.
 * 4. Graph law beats flat law when both exist.
 * 5. Visible chat and shadow chat must both be representable.
 * ============================================================================
 */

import type {
  ChatRelationshipAxisId,
  ChatRelationshipCallbackHint,
  ChatRelationshipCounterpartKind,
  ChatRelationshipCounterpartState,
  ChatRelationshipEventDescriptor,
  ChatRelationshipEventType,
  ChatRelationshipLegacyProjection,
  ChatRelationshipNpcSignal,
  ChatRelationshipObjective,
  ChatRelationshipPressureBand,
  ChatRelationshipSnapshot,
  ChatRelationshipStance,
  ChatRelationshipSummaryView,
  ChatRelationshipVector,
} from './relationship';
import {
  clamp01 as clampRelationship01,
  emptyRelationshipVector,
  weightedBlend,
} from './relationship';
import type {
  ChatAffinityCounterpartClass,
  ChatAffinityEvaluation,
  ChatAffinityEvaluationInput,
  ChatAffinityLaneId,
  ChatAffinitySignal,
  ChatAffinityZone,
} from './ChatAffinity';
import {
  CHAT_AFFINITY_LANE_DESCRIPTORS,
  CHAT_AFFINITY_REGISTRY,
  axisZone,
  buildAffinitySignalForLane,
  clamp01 as clampAffinity01,
  createAffinityEvaluationInputFromVector,
  dominantAxesFromVector,
  evaluateAffinity,
  preferredAffinityLaneForCounterpartKind,
  relationshipVectorFromSeed,
  safePreferredLaneForEventType,
  vectorAffinitySignature,
} from './ChatAffinity';

// ============================================================================
// MARK: Core ids / enums
// ============================================================================

export type ChatRelationshipNodeId = string;
export type ChatRelationshipEdgeId = string;
export type ChatRelationshipGraphId = string;
export type ChatRelationshipThreadId = string;
export type ChatRelationshipAnchorId = string;
export type ChatRelationshipPolicyId = string;
export type ChatRelationshipContinuityKey = string;

export type ChatRelationshipNodeKind =
  | 'PLAYER'
  | 'COUNTERPART'
  | 'CHANNEL'
  | 'ROOM'
  | 'SCENE'
  | 'MOMENT'
  | 'MEMORY'
  | 'WORLD_EVENT';

export type ChatRelationshipEdgeKind =
  | 'PLAYER_TO_COUNTERPART'
  | 'COUNTERPART_TO_COUNTERPART'
  | 'COUNTERPART_TO_CHANNEL'
  | 'COUNTERPART_TO_SCENE'
  | 'COUNTERPART_TO_MEMORY'
  | 'COUNTERPART_TO_WORLD_EVENT'
  | 'PLAYER_TO_CHANNEL';

export type ChatRelationshipLinkState =
  | 'LATENT'
  | 'EMERGING'
  | 'ACTIVE'
  | 'BURNING'
  | 'RUPTURED'
  | 'ARCHIVED';

export type ChatRelationshipBondRole =
  | 'HELPER_BOND'
  | 'RIVAL_BOND'
  | 'ARCHIVIST_BOND'
  | 'CROWD_BOND'
  | 'SYSTEM_BOND'
  | 'NEGOTIATION_BOND'
  | 'WITNESS_BOND';

export type ChatRelationshipTemporalState =
  | 'FRESH'
  | 'STABLE'
  | 'VOLATILE'
  | 'RECURRENT'
  | 'LONG_ARC'
  | 'FOSSILIZED';

export type ChatRelationshipVisibilityMode =
  | 'VISIBLE'
  | 'SHADOW'
  | 'HYBRID'
  | 'REVEAL_READY';

export type ChatRelationshipCarryoverMode =
  | 'NONE'
  | 'SCENE_TO_SCENE'
  | 'MODE_TO_MODE'
  | 'RUN_TO_RUN'
  | 'SEASON_TO_SEASON';

export type ChatRelationshipMemoryMode =
  | 'NONE'
  | 'CALLBACK_READY'
  | 'PRESSURE_STORED'
  | 'TRAUMA_STORED'
  | 'LEGEND_STORED'
  | 'RESCUE_STORED';

export type ChatRelationshipRepairMode =
  | 'IMPOSSIBLE'
  | 'COSTLY'
  | 'CONDITIONAL'
  | 'OPEN'
  | 'ALREADY_REPAIRING';

export type ChatRelationshipEscalationGrade =
  | 'NONE'
  | 'LOW'
  | 'MODERATE'
  | 'HIGH'
  | 'SEVERE'
  | 'MYTHIC';

export type ChatRelationshipCallbackRole =
  | 'THREAT'
  | 'WITNESS'
  | 'TAUNT'
  | 'RESCUE'
  | 'FORESHADOW'
  | 'DEAL_ROOM_LEVER'
  | 'LEGEND_ECHO';

export type ChatRelationshipAffinityDisposition =
  | 'ALLYING'
  | 'STUDYING'
  | 'HUNTING'
  | 'SHAMING'
  | 'NEGOTIATING'
  | 'RESCUING'
  | 'ARCHIVING'
  | 'MYTHOLOGIZING';

// ============================================================================
// MARK: Core graph structures
// ============================================================================

export interface ChatRelationshipNodeRef {
  readonly nodeId: ChatRelationshipNodeId;
  readonly kind: ChatRelationshipNodeKind;
  readonly counterpartId?: string | null;
  readonly playerId?: string | null;
  readonly channelId?: string | null;
  readonly roomId?: string | null;
  readonly sceneId?: string | null;
  readonly momentId?: string | null;
  readonly memoryId?: string | null;
  readonly displayName?: string | null;
  readonly tags?: readonly string[];
}

export interface ChatRelationshipAnchor {
  readonly anchorId: ChatRelationshipAnchorId;
  readonly role: ChatRelationshipCallbackRole;
  readonly sourceEventId?: string | null;
  readonly sourceMessageId?: string | null;
  readonly sourceSceneId?: string | null;
  readonly sourceMomentId?: string | null;
  readonly summary: string;
  readonly text?: string | null;
  readonly salience01: number;
  readonly pressureBand?: ChatRelationshipPressureBand;
  readonly visibilityMode: ChatRelationshipVisibilityMode;
  readonly createdAt: number;
  readonly expiresAt?: number | null;
  readonly tags: readonly string[];
}

export interface ChatRelationshipThreadSummary {
  readonly threadId: ChatRelationshipThreadId;
  readonly title: string;
  readonly bondRole: ChatRelationshipBondRole;
  readonly continuityKey: ChatRelationshipContinuityKey;
  readonly unresolved: boolean;
  readonly visibilityMode: ChatRelationshipVisibilityMode;
  readonly lastSceneId?: string | null;
  readonly lastMomentId?: string | null;
  readonly lastTouchedAt: number;
  readonly anchorIds: readonly ChatRelationshipAnchorId[];
  readonly noteCount: number;
}

export interface ChatRelationshipTrajectorySnapshot {
  readonly createdAt: number;
  readonly respect01: number;
  readonly fear01: number;
  readonly contempt01: number;
  readonly fascination01: number;
  readonly obsession01: number;
  readonly patience01: number;
  readonly familiarity01: number;
  readonly predictiveConfidence01: number;
  readonly traumaDebt01: number;
  readonly unfinishedBusiness01: number;
  readonly intensity01: number;
  readonly volatility01: number;
  readonly publicPressureBias01: number;
  readonly privatePressureBias01: number;
  readonly dominantAxes: readonly ChatRelationshipAxisId[];
  readonly affinitySignature: string;
}

export interface ChatRelationshipRepairWindow {
  readonly repairMode: ChatRelationshipRepairMode;
  readonly recoveryCost01: number;
  readonly silenceRecommended: boolean;
  readonly witnessSuppressionRecommended: boolean;
  readonly rescueRecommended: boolean;
  readonly notes: readonly string[];
}

export interface ChatRelationshipContinuityState {
  readonly continuityKey: ChatRelationshipContinuityKey;
  readonly carryoverMode: ChatRelationshipCarryoverMode;
  readonly unresolved: boolean;
  readonly unresolvedReason?: string | null;
  readonly priorModeId?: string | null;
  readonly currentModeId?: string | null;
  readonly priorSceneId?: string | null;
  readonly currentSceneId?: string | null;
  readonly priorMomentId?: string | null;
  readonly currentMomentId?: string | null;
  readonly carryoverWeight01: number;
  readonly recommendedOpenRole?:
    | 'OPEN'
    | 'PRESSURE'
    | 'MOCK'
    | 'DEFEND'
    | 'WITNESS'
    | 'CALLBACK'
    | 'REVEAL'
    | 'SILENCE'
    | 'ECHO'
    | 'CLOSE';
  readonly notes: readonly string[];
}

export interface ChatRelationshipPolicySurface {
  readonly policyId: ChatRelationshipPolicyId;
  readonly preferredLaneId: ChatAffinityLaneId;
  readonly preferredZone: ChatAffinityZone;
  readonly visibilityMode: ChatRelationshipVisibilityMode;
  readonly escalationGrade: ChatRelationshipEscalationGrade;
  readonly memoryMode: ChatRelationshipMemoryMode;
  readonly carryoverMode: ChatRelationshipCarryoverMode;
  readonly rescueEligible: boolean;
  readonly revealEligible: boolean;
  readonly crowdEligible: boolean;
  readonly negotiationEligible: boolean;
  readonly legendEligible: boolean;
  readonly silenceBias01: number;
  readonly revealBias01: number;
  readonly rescueBias01: number;
  readonly mockBias01: number;
  readonly witnessBias01: number;
  readonly notes: readonly string[];
}

export interface ChatRelationshipGraphEdge {
  readonly edgeId: ChatRelationshipEdgeId;
  readonly graphId: ChatRelationshipGraphId;
  readonly kind: ChatRelationshipEdgeKind;
  readonly sourceNodeId: ChatRelationshipNodeId;
  readonly targetNodeId: ChatRelationshipNodeId;
  readonly counterpartId?: string | null;
  readonly playerId?: string | null;
  readonly bondRole: ChatRelationshipBondRole;
  readonly linkState: ChatRelationshipLinkState;
  readonly temporalState: ChatRelationshipTemporalState;
  readonly visibilityMode: ChatRelationshipVisibilityMode;
  readonly counterpartClass: ChatAffinityCounterpartClass;
  readonly preferredLaneId: ChatAffinityLaneId;
  readonly affinityEvaluation: ChatAffinityEvaluation;
  readonly legacy: ChatRelationshipLegacyProjection;
  readonly vector: ChatRelationshipVector;
  readonly intensity01: number;
  readonly volatility01: number;
  readonly witnessLoad01: number;
  readonly pressureLoad01: number;
  readonly callbackLoad01: number;
  readonly rescueDebt01: number;
  readonly negotiationHeat01: number;
  readonly legendPotential01: number;
  readonly callbackHints: readonly ChatRelationshipCallbackHint[];
  readonly anchors: readonly ChatRelationshipAnchor[];
  readonly trajectoryTail: readonly ChatRelationshipTrajectorySnapshot[];
  readonly repairWindow: ChatRelationshipRepairWindow;
  readonly continuity: ChatRelationshipContinuityState;
  readonly policy: ChatRelationshipPolicySurface;
  readonly eventHistoryTail: readonly ChatRelationshipEventDescriptor[];
  readonly threadSummary: ChatRelationshipThreadSummary;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface ChatRelationshipGraphView {
  readonly graphId: ChatRelationshipGraphId;
  readonly playerId?: string | null;
  readonly roomId?: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly nodes: readonly ChatRelationshipNodeRef[];
  readonly edges: readonly ChatRelationshipGraphEdge[];
  readonly activeEdgeIds: readonly ChatRelationshipEdgeId[];
  readonly unresolvedEdgeIds: readonly ChatRelationshipEdgeId[];
  readonly focusedEdgeByChannel: Readonly<Record<string, string | undefined>>;
  readonly focusedEdgeId?: string | null;
  readonly globalAffinitySummary: Readonly<Record<ChatAffinityLaneId, number>>;
  readonly notes: readonly string[];
}

export interface ChatRelationshipCounterpartProjection {
  readonly counterpartId: string;
  readonly counterpartKind: ChatRelationshipCounterpartKind;
  readonly bondRole: ChatRelationshipBondRole;
  readonly linkState: ChatRelationshipLinkState;
  readonly temporalState: ChatRelationshipTemporalState;
  readonly visibilityMode: ChatRelationshipVisibilityMode;
  readonly preferredLaneId: ChatAffinityLaneId;
  readonly preferredZone: ChatAffinityZone;
  readonly disposition: ChatRelationshipAffinityDisposition;
  readonly stance: ChatRelationshipStance;
  readonly objective: ChatRelationshipObjective;
  readonly intensity01: number;
  readonly volatility01: number;
  readonly rescueDebt01: number;
  readonly callbackLoad01: number;
  readonly witnessLoad01: number;
  readonly legendPotential01: number;
  readonly dominantAxes: readonly ChatRelationshipAxisId[];
  readonly affinitySignature: string;
  readonly summary: string;
  readonly notes: readonly string[];
}

export interface ChatRelationshipMomentImpact {
  readonly eventType: ChatRelationshipEventType;
  readonly preferredLaneId: ChatAffinityLaneId;
  readonly escalationDelta: number;
  readonly volatilityDelta: number;
  readonly witnessDelta: number;
  readonly legendDelta: number;
  readonly rescueDebtDelta: number;
  readonly traumaDelta: number;
  readonly unfinishedBusinessDelta: number;
  readonly notes: readonly string[];
}

export interface ChatRelationshipLegacyBridge {
  readonly counterpartId: string;
  readonly summaryView: ChatRelationshipSummaryView;
  readonly counterpartState: ChatRelationshipCounterpartState;
  readonly npcSignal: ChatRelationshipNpcSignal;
  readonly projection: ChatRelationshipCounterpartProjection;
  readonly edge: ChatRelationshipGraphEdge;
}

// ============================================================================
// MARK: Static maps / defaults
// ============================================================================

export const CHAT_RELATIONSHIP_FILE_PATH =
  'shared/contracts/chat/ChatRelationship.ts' as const;
export const CHAT_RELATIONSHIP_VERSION = '1.0.0' as const;

export const CHAT_RELATIONSHIP_LINK_STATES = [
  'LATENT',
  'EMERGING',
  'ACTIVE',
  'BURNING',
  'RUPTURED',
  'ARCHIVED',
] as const satisfies readonly ChatRelationshipLinkState[];

export const CHAT_RELATIONSHIP_TEMPORAL_STATES = [
  'FRESH',
  'STABLE',
  'VOLATILE',
  'RECURRENT',
  'LONG_ARC',
  'FOSSILIZED',
] as const satisfies readonly ChatRelationshipTemporalState[];

export const CHAT_RELATIONSHIP_BOND_ROLES = [
  'HELPER_BOND',
  'RIVAL_BOND',
  'ARCHIVIST_BOND',
  'CROWD_BOND',
  'SYSTEM_BOND',
  'NEGOTIATION_BOND',
  'WITNESS_BOND',
] as const satisfies readonly ChatRelationshipBondRole[];

export const CHAT_RELATIONSHIP_VISIBILITY_MODES = [
  'VISIBLE',
  'SHADOW',
  'HYBRID',
  'REVEAL_READY',
] as const satisfies readonly ChatRelationshipVisibilityMode[];

export const CHAT_RELATIONSHIP_ESCALATION_GRADES = [
  'NONE',
  'LOW',
  'MODERATE',
  'HIGH',
  'SEVERE',
  'MYTHIC',
] as const satisfies readonly ChatRelationshipEscalationGrade[];

export const CHAT_RELATIONSHIP_MEMORY_MODES = [
  'NONE',
  'CALLBACK_READY',
  'PRESSURE_STORED',
  'TRAUMA_STORED',
  'LEGEND_STORED',
  'RESCUE_STORED',
] as const satisfies readonly ChatRelationshipMemoryMode[];

export const CHAT_RELATIONSHIP_CARRYOVER_MODES = [
  'NONE',
  'SCENE_TO_SCENE',
  'MODE_TO_MODE',
  'RUN_TO_RUN',
  'SEASON_TO_SEASON',
] as const satisfies readonly ChatRelationshipCarryoverMode[];

export const CHAT_RELATIONSHIP_REPAIR_MODES = [
  'IMPOSSIBLE',
  'COSTLY',
  'CONDITIONAL',
  'OPEN',
  'ALREADY_REPAIRING',
] as const satisfies readonly ChatRelationshipRepairMode[];

// ============================================================================
// MARK: Primitive helpers
// ============================================================================

export function clamp01(value: number): number {
  return clampRelationship01(value);
}

export function clampCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

export function clampProbability(value: number): number {
  return clampAffinity01(value);
}

export function stableString(value?: string | null): string | undefined {
  if (value == null) return undefined;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : undefined;
}

export function stableList<T>(value?: readonly T[] | null): readonly T[] {
  return Array.isArray(value) ? value.slice() : [];
}

export function average01(values: readonly number[]): number {
  if (!values.length) return 0;
  return clamp01(values.reduce((sum, value) => sum + clamp01(value), 0) / values.length);
}

export function max01(values: readonly number[]): number {
  if (!values.length) return 0;
  return clamp01(Math.max(...values.map((value) => clamp01(value))));
}

export function pickLinkState(intensity01: number, volatility01: number): ChatRelationshipLinkState {
  const intensity = clamp01(intensity01);
  const volatility = clamp01(volatility01);
  if (intensity < 0.08 && volatility < 0.12) return 'LATENT';
  if (intensity < 0.28) return 'EMERGING';
  if (intensity < 0.66) return 'ACTIVE';
  if (intensity < 0.86 || volatility >= 0.48) return 'BURNING';
  return 'RUPTURED';
}

export function pickTemporalState(
  touches: number,
  unfinishedBusiness01: number,
  callbackLoad01: number,
): ChatRelationshipTemporalState {
  const touchCount = clampCount(touches);
  const unfinished = clamp01(unfinishedBusiness01);
  const callbackLoad = clamp01(callbackLoad01);
  if (touchCount <= 1) return 'FRESH';
  if (touchCount <= 3 && unfinished < 0.3) return 'STABLE';
  if (callbackLoad >= 0.6 && unfinished >= 0.55) return 'LONG_ARC';
  if (unfinished >= 0.45) return 'RECURRENT';
  if (callbackLoad >= 0.42) return 'VOLATILE';
  if (touchCount >= 12 && unfinished < 0.16) return 'FOSSILIZED';
  return 'STABLE';
}

export function pickVisibilityMode(
  intensity01: number,
  traumaDebt01: number,
  prediction01: number,
  revealBias01 = 0,
): ChatRelationshipVisibilityMode {
  const intensity = clamp01(intensity01);
  const trauma = clamp01(traumaDebt01);
  const prediction = clamp01(prediction01);
  const revealBias = clamp01(revealBias01);

  if (prediction >= 0.66 || trauma >= 0.72) return revealBias >= 0.45 ? 'REVEAL_READY' : 'SHADOW';
  if (intensity >= 0.58 && revealBias >= 0.36) return 'HYBRID';
  return 'VISIBLE';
}

export function pickCarryoverMode(
  unresolved01: number,
  legendPotential01: number,
  callbackLoad01: number,
): ChatRelationshipCarryoverMode {
  const unresolved = clamp01(unresolved01);
  const legend = clamp01(legendPotential01);
  const callback = clamp01(callbackLoad01);
  if (legend >= 0.84) return 'SEASON_TO_SEASON';
  if (unresolved >= 0.66 || callback >= 0.7) return 'RUN_TO_RUN';
  if (unresolved >= 0.42) return 'MODE_TO_MODE';
  if (unresolved >= 0.22) return 'SCENE_TO_SCENE';
  return 'NONE';
}

export function pickRepairMode(
  contempt01: number,
  traumaDebt01: number,
  respect01: number,
  rescueDebt01: number,
): ChatRelationshipRepairMode {
  const contempt = clamp01(contempt01);
  const trauma = clamp01(traumaDebt01);
  const respect = clamp01(respect01);
  const rescue = clamp01(rescueDebt01);
  if (contempt >= 0.86 && trauma >= 0.76) return 'IMPOSSIBLE';
  if (contempt >= 0.7 || trauma >= 0.62) return rescue >= 0.45 ? 'CONDITIONAL' : 'COSTLY';
  if (respect >= 0.56 || rescue >= 0.52) return 'ALREADY_REPAIRING';
  return 'OPEN';
}

export function pickEscalationGrade(
  intensity01: number,
  obsession01: number,
  legendPotential01: number,
): ChatRelationshipEscalationGrade {
  const intensity = clamp01(intensity01);
  const obsession = clamp01(obsession01);
  const legend = clamp01(legendPotential01);
  const weighted = intensity * 0.56 + obsession * 0.28 + legend * 0.16;
  if (weighted < 0.12) return 'NONE';
  if (weighted < 0.28) return 'LOW';
  if (weighted < 0.48) return 'MODERATE';
  if (weighted < 0.68) return 'HIGH';
  if (weighted < 0.84) return 'SEVERE';
  return 'MYTHIC';
}

export function pickBondRole(kind: ChatRelationshipCounterpartKind, channelId?: string | null): ChatRelationshipBondRole {
  switch (kind) {
    case 'HELPER':
      return 'HELPER_BOND';
    case 'RIVAL':
      return 'RIVAL_BOND';
    case 'ARCHIVIST':
      return 'ARCHIVIST_BOND';
    case 'AMBIENT':
      return 'CROWD_BOND';
    case 'SYSTEM':
      return 'SYSTEM_BOND';
    case 'BOT':
      return channelId === 'DEAL_ROOM' ? 'NEGOTIATION_BOND' : 'RIVAL_BOND';
    case 'NPC':
    default:
      return channelId === 'DEAL_ROOM' ? 'NEGOTIATION_BOND' : 'WITNESS_BOND';
  }
}

export function pickCounterpartClass(
  kind: ChatRelationshipCounterpartKind,
  bondRole: ChatRelationshipBondRole,
): ChatAffinityCounterpartClass {
  if (bondRole === 'NEGOTIATION_BOND') return 'DEAL_ROOM_ENTITY';
  switch (kind) {
    case 'HELPER':
      return 'CORE_HELPER';
    case 'RIVAL':
      return 'CORE_RIVAL';
    case 'ARCHIVIST':
      return 'ARCHIVIST';
    case 'AMBIENT':
      return 'CROWD_SWARM';
    case 'SYSTEM':
      return 'BROADCAST_SYSTEM';
    case 'BOT':
      return 'CORE_RIVAL';
    case 'NPC':
    default:
      return 'AMBIENT_WITNESS';
  }
}

export function pickDisposition(
  laneId: ChatAffinityLaneId,
): ChatRelationshipAffinityDisposition {
  switch (laneId) {
    case 'DOMINANCE':
      return 'HUNTING';
    case 'DEVOTION':
      return 'ALLYING';
    case 'RIVALRY':
      return 'HUNTING';
    case 'TRUST':
      return 'ALLYING';
    case 'HUMILIATION':
      return 'SHAMING';
    case 'RESCUE':
      return 'RESCUING';
    case 'CURIOSITY':
      return 'STUDYING';
    case 'TRAUMA':
      return 'ARCHIVING';
    case 'PREDICTION':
      return 'STUDYING';
    case 'LEGEND':
      return 'MYTHOLOGIZING';
    default:
      return 'STUDYING';
  }
}

// ============================================================================
// MARK: Vector / bridge helpers
// ============================================================================

export function relationshipLegacyProjectionFromVector(
  counterpartId: string,
  vector: ChatRelationshipVector,
): ChatRelationshipLegacyProjection {
  const respect = clamp01(vector.respect01);
  const fear = clamp01(vector.fear01);
  const contempt = clamp01(vector.contempt01);
  const fascination = clamp01(vector.fascination01);
  const trust = clamp01((respect * 0.46 + vector.patience01 * 0.28 + vector.familiarity01 * 0.26) - contempt * 0.18);
  const familiarity = clamp01(vector.familiarity01);
  const rivalryIntensity = clamp01(vector.obsession01 * 0.55 + contempt * 0.25 + fear * 0.2);
  const rescueDebt = clamp01(vector.traumaDebt01 * 0.48 + (1 - contempt) * 0.14 + respect * 0.18);
  const adviceObedience = clamp01(vector.predictiveConfidence01 * 0.2 + trust * 0.35 + (1 - contempt) * 0.12 + vector.patience01 * 0.33);
  const escalationTier: ChatRelationshipLegacyProjection['escalationTier'] =
    rivalryIntensity < 0.18
      ? 'NONE'
      : rivalryIntensity < 0.42
        ? 'MILD'
        : rivalryIntensity < 0.72
          ? 'ACTIVE'
          : 'OBSESSIVE';

  return {
    counterpartId,
    respect,
    fear,
    contempt,
    fascination,
    trust,
    familiarity,
    rivalryIntensity,
    rescueDebt,
    adviceObedience,
    escalationTier,
  };
}

export function relationshipSummaryViewFromState(
  state: ChatRelationshipCounterpartState,
): ChatRelationshipSummaryView {
  return {
    counterpartId: state.counterpartId,
    stance: state.stance,
    objective: state.objective,
    intensity01: clamp01(state.intensity01),
    volatility01: clamp01(state.volatility01),
    obsession01: clamp01(state.vector.obsession01),
    predictiveConfidence01: clamp01(state.vector.predictiveConfidence01),
    unfinishedBusiness01: clamp01(state.vector.unfinishedBusiness01),
    respect01: clamp01(state.vector.respect01),
    fear01: clamp01(state.vector.fear01),
    contempt01: clamp01(state.vector.contempt01),
    familiarity01: clamp01(state.vector.familiarity01),
    callbackCount: state.callbackHints.length,
    legacy: relationshipLegacyProjectionFromVector(state.counterpartId, state.vector),
  };
}

export function relationshipNpcSignalFromState(
  state: ChatRelationshipCounterpartState,
): ChatRelationshipNpcSignal {
  const legacy = relationshipLegacyProjectionFromVector(state.counterpartId, state.vector);
  const notes: string[] = [];
  if (state.vector.obsession01 >= 0.6) notes.push('Obsession is materially active.');
  if (state.vector.unfinishedBusiness01 >= 0.5) notes.push('Unfinished business is driving callbacks.');
  if (state.publicPressureBias01 > state.privatePressureBias01) notes.push('Public pressure bias dominates.');
  if (legacy.escalationTier === 'OBSESSIVE') notes.push('Legacy escalation tier is obsessive.');

  return {
    counterpartId: state.counterpartId,
    stance: state.stance,
    objective: state.objective,
    intensity01: clamp01(state.intensity01),
    volatility01: clamp01(state.volatility01),
    selectionWeight01: clamp01((state.intensity01 * 0.55) + (state.vector.obsession01 * 0.25) + (state.vector.fascination01 * 0.2)),
    publicPressureBias01: clamp01(state.publicPressureBias01),
    privatePressureBias01: clamp01(state.privatePressureBias01),
    predictiveConfidence01: clamp01(state.vector.predictiveConfidence01),
    obsession01: clamp01(state.vector.obsession01),
    unfinishedBusiness01: clamp01(state.vector.unfinishedBusiness01),
    respect01: clamp01(state.vector.respect01),
    fear01: clamp01(state.vector.fear01),
    contempt01: clamp01(state.vector.contempt01),
    familiarity01: clamp01(state.vector.familiarity01),
    callbackHint: state.callbackHints[0],
    notes,
  };
}

export function counterpartStateFromGraphEdge(
  edge: ChatRelationshipGraphEdge,
): ChatRelationshipCounterpartState {
  return {
    counterpartId: edge.counterpartId ?? edge.targetNodeId,
    counterpartKind: inferCounterpartKindFromBondRole(edge.bondRole),
    playerId: edge.playerId,
    botId: undefined,
    actorRole: edge.bondRole,
    lastChannelId: edge.threadSummary.continuityKey,
    vector: edge.vector,
    stance: inferStanceFromLane(edge.preferredLaneId, edge.linkState),
    objective: inferObjectiveFromLane(edge.preferredLaneId),
    intensity01: clamp01(edge.intensity01),
    volatility01: clamp01(edge.volatility01),
    publicPressureBias01: clamp01(edge.witnessLoad01),
    privatePressureBias01: clamp01(1 - edge.witnessLoad01),
    callbackHints: edge.callbackHints,
    eventHistoryTail: edge.eventHistoryTail,
    dominantAxes: dominantAxesFromVector(edge.vector, 4),
    lastTouchedAt: edge.updatedAt,
  };
}

export function relationshipSnapshotFromGraph(
  graph: ChatRelationshipGraphView,
): ChatRelationshipSnapshot {
  const counterparts = graph.edges.map((edge) => counterpartStateFromGraphEdge(edge));
  const totalEventCount = graph.edges.reduce((sum, edge) => sum + edge.eventHistoryTail.length, 0);
  return {
    createdAt: graph.createdAt,
    updatedAt: graph.updatedAt,
    playerId: graph.playerId,
    counterparts,
    totalEventCount,
    focusedCounterpartByChannel: Object.fromEntries(
      Object.entries(graph.focusedEdgeByChannel).map(([channelId, edgeId]) => {
        const edge = graph.edges.find((candidate) => candidate.edgeId === edgeId);
        return [channelId, edge?.counterpartId ?? undefined];
      }),
    ) as Readonly<Record<string, string | undefined>>,
  };
}

// ============================================================================
// MARK: Inference helpers
// ============================================================================

export function inferCounterpartKindFromBondRole(
  role: ChatRelationshipBondRole,
): ChatRelationshipCounterpartKind {
  switch (role) {
    case 'HELPER_BOND':
      return 'HELPER';
    case 'RIVAL_BOND':
      return 'RIVAL';
    case 'ARCHIVIST_BOND':
      return 'ARCHIVIST';
    case 'CROWD_BOND':
      return 'AMBIENT';
    case 'SYSTEM_BOND':
      return 'SYSTEM';
    case 'NEGOTIATION_BOND':
      return 'NPC';
    case 'WITNESS_BOND':
    default:
      return 'NPC';
  }
}

export function inferStanceFromLane(
  laneId: ChatAffinityLaneId,
  linkState: ChatRelationshipLinkState,
): ChatRelationshipStance {
  switch (laneId) {
    case 'DOMINANCE':
      return linkState === 'BURNING' || linkState === 'RUPTURED' ? 'HUNTING' : 'PREDATORY';
    case 'DEVOTION':
      return 'PROTECTIVE';
    case 'RIVALRY':
      return linkState === 'BURNING' ? 'OBSESSED' : 'HUNTING';
    case 'TRUST':
      return 'RESPECTFUL';
    case 'HUMILIATION':
      return 'DISMISSIVE';
    case 'RESCUE':
      return 'PROTECTIVE';
    case 'CURIOSITY':
      return 'CURIOUS';
    case 'TRAUMA':
      return 'WOUNDED';
    case 'PREDICTION':
      return 'CLINICAL';
    case 'LEGEND':
      return 'CURIOUS';
    default:
      return 'PROBING';
  }
}

export function inferObjectiveFromLane(laneId: ChatAffinityLaneId): ChatRelationshipObjective {
  switch (laneId) {
    case 'DOMINANCE':
      return 'CONTAIN';
    case 'DEVOTION':
      return 'RESCUE';
    case 'RIVALRY':
      return 'PROVOKE';
    case 'TRUST':
      return 'TEST';
    case 'HUMILIATION':
      return 'HUMILIATE';
    case 'RESCUE':
      return 'RESCUE';
    case 'CURIOSITY':
      return 'STUDY';
    case 'TRAUMA':
      return 'WITNESS';
    case 'PREDICTION':
      return 'PRESSURE';
    case 'LEGEND':
      return 'WITNESS';
    default:
      return 'STUDY';
  }
}

export function inferPolicySurface(
  laneId: ChatAffinityLaneId,
  evaluation: ChatAffinityEvaluation,
): ChatRelationshipPolicySurface {
  const dominant = evaluation.scores[0];
  const escalationGrade = pickEscalationGrade(
    evaluation.aggregateIntensity01,
    dominant?.triggeredAxes.includes('OBSESSION') ? 0.75 : 0.2,
    dominant?.laneId === 'LEGEND' ? 0.92 : dominant?.laneId === 'HUMILIATION' ? 0.52 : 0.22,
  );
  const visibilityMode: ChatRelationshipVisibilityMode =
    dominant?.laneId === 'TRAUMA' || dominant?.laneId === 'PREDICTION'
      ? 'SHADOW'
      : dominant?.laneId === 'RESCUE' || dominant?.laneId === 'TRUST'
        ? 'HYBRID'
        : dominant?.laneId === 'LEGEND'
          ? 'REVEAL_READY'
          : 'VISIBLE';

  return {
    policyId: `policy/${laneId}/${visibilityMode}`,
    preferredLaneId: laneId,
    preferredZone: axisZone(CHAT_AFFINITY_LANE_DESCRIPTORS[laneId].primaryAxes[0] ?? 'RESPECT'),
    visibilityMode,
    escalationGrade,
    memoryMode:
      laneId === 'TRAUMA'
        ? 'TRAUMA_STORED'
        : laneId === 'LEGEND'
          ? 'LEGEND_STORED'
          : laneId === 'RESCUE'
            ? 'RESCUE_STORED'
            : laneId === 'DOMINANCE' || laneId === 'HUMILIATION'
              ? 'PRESSURE_STORED'
              : 'CALLBACK_READY',
    carryoverMode:
      laneId === 'LEGEND'
        ? 'RUN_TO_RUN'
        : laneId === 'TRAUMA'
          ? 'MODE_TO_MODE'
          : laneId === 'RIVALRY'
            ? 'SCENE_TO_SCENE'
            : 'NONE',
    rescueEligible: laneId === 'TRAUMA' || laneId === 'RESCUE' || laneId === 'DEVOTION',
    revealEligible: laneId === 'PREDICTION' || laneId === 'LEGEND' || laneId === 'RIVALRY',
    crowdEligible: laneId === 'HUMILIATION' || laneId === 'LEGEND',
    negotiationEligible: laneId === 'PREDICTION' || laneId === 'DOMINANCE',
    legendEligible: laneId === 'LEGEND' || laneId === 'RIVALRY' || laneId === 'HUMILIATION',
    silenceBias01:
      laneId === 'TRAUMA' || laneId === 'RESCUE'
        ? 0.72
        : laneId === 'TRUST'
          ? 0.46
          : 0.18,
    revealBias01:
      laneId === 'PREDICTION' || laneId === 'LEGEND'
        ? 0.82
        : laneId === 'RIVALRY'
          ? 0.66
          : 0.24,
    rescueBias01:
      laneId === 'RESCUE' || laneId === 'DEVOTION'
        ? 0.92
        : laneId === 'TRAUMA'
          ? 0.58
          : 0.06,
    mockBias01:
      laneId === 'HUMILIATION' || laneId === 'RIVALRY' || laneId === 'DOMINANCE'
        ? 0.88
        : 0.1,
    witnessBias01:
      laneId === 'LEGEND' || laneId === 'HUMILIATION' || laneId === 'TRAUMA'
        ? 0.84
        : 0.28,
    notes: [`Affinity registry version: ${CHAT_AFFINITY_REGISTRY.version}.`],
  };
}

// ============================================================================
// MARK: Anchors / trajectory helpers
// ============================================================================

export function createRelationshipAnchor(
  summary: string,
  patch?: Partial<Omit<ChatRelationshipAnchor, 'anchorId' | 'summary' | 'salience01' | 'visibilityMode' | 'createdAt' | 'role' | 'tags'>> & {
    role?: ChatRelationshipCallbackRole;
    salience01?: number;
    visibilityMode?: ChatRelationshipVisibilityMode;
    createdAt?: number;
    tags?: readonly string[];
  },
): ChatRelationshipAnchor {
  const createdAt = patch?.createdAt ?? Date.now();
  return {
    anchorId: patch?.sourceEventId
      ? `anchor/${patch.sourceEventId}`
      : `anchor/${createdAt}/${Math.random().toString(36).slice(2, 8)}`,
    role: patch?.role ?? 'WITNESS',
    sourceEventId: patch?.sourceEventId,
    sourceMessageId: patch?.sourceMessageId,
    sourceSceneId: patch?.sourceSceneId,
    sourceMomentId: patch?.sourceMomentId,
    summary,
    text: patch?.text,
    salience01: clamp01(patch?.salience01 ?? 0.42),
    pressureBand: patch?.pressureBand,
    visibilityMode: patch?.visibilityMode ?? 'VISIBLE',
    createdAt,
    expiresAt: patch?.expiresAt,
    tags: stableList(patch?.tags),
  };
}

export function createTrajectorySnapshot(
  vector: ChatRelationshipVector,
  patch?: Partial<
    Pick<
      ChatRelationshipTrajectorySnapshot,
      'createdAt' | 'intensity01' | 'volatility01' | 'publicPressureBias01' | 'privatePressureBias01'
    >
  >,
): ChatRelationshipTrajectorySnapshot {
  const intensity01 = clamp01(
    patch?.intensity01 ??
      average01([
        vector.respect01,
        vector.fear01,
        vector.contempt01,
        vector.fascination01,
        vector.obsession01,
        vector.traumaDebt01,
        vector.unfinishedBusiness01,
      ]),
  );
  const volatility01 = clamp01(
    patch?.volatility01 ??
      average01([
        Math.abs(vector.contempt01 - vector.respect01),
        Math.abs(vector.fear01 - vector.patience01),
        vector.obsession01,
        vector.traumaDebt01,
        vector.unfinishedBusiness01,
      ]),
  );
  return {
    createdAt: patch?.createdAt ?? Date.now(),
    respect01: clamp01(vector.respect01),
    fear01: clamp01(vector.fear01),
    contempt01: clamp01(vector.contempt01),
    fascination01: clamp01(vector.fascination01),
    obsession01: clamp01(vector.obsession01),
    patience01: clamp01(vector.patience01),
    familiarity01: clamp01(vector.familiarity01),
    predictiveConfidence01: clamp01(vector.predictiveConfidence01),
    traumaDebt01: clamp01(vector.traumaDebt01),
    unfinishedBusiness01: clamp01(vector.unfinishedBusiness01),
    intensity01,
    volatility01,
    publicPressureBias01: clamp01(patch?.publicPressureBias01 ?? 0.5),
    privatePressureBias01: clamp01(patch?.privatePressureBias01 ?? 0.5),
    dominantAxes: dominantAxesFromVector(vector, 4),
    affinitySignature: vectorAffinitySignature(vector),
  };
}

export function createRepairWindow(
  vector: ChatRelationshipVector,
  rescueDebt01: number,
): ChatRelationshipRepairWindow {
  const repairMode = pickRepairMode(
    vector.contempt01,
    vector.traumaDebt01,
    vector.respect01,
    rescueDebt01,
  );
  const recoveryCost01 = clamp01(
    vector.contempt01 * 0.42 + vector.traumaDebt01 * 0.38 + (1 - vector.respect01) * 0.2,
  );
  return {
    repairMode,
    recoveryCost01,
    silenceRecommended: repairMode === 'COSTLY' || repairMode === 'CONDITIONAL',
    witnessSuppressionRecommended:
      repairMode === 'COSTLY' || repairMode === 'IMPOSSIBLE' || vector.traumaDebt01 >= 0.55,
    rescueRecommended:
      repairMode === 'ALREADY_REPAIRING' || repairMode === 'CONDITIONAL' || rescueDebt01 >= 0.48,
    notes: [
      `Repair mode: ${repairMode}.`,
      recoveryCost01 >= 0.6 ? 'Recovery cost is materially high.' : 'Recovery cost is manageable.',
    ],
  };
}

export function createContinuityState(
  unresolved01: number,
  legendPotential01: number,
  callbackLoad01: number,
  patch?: Partial<Omit<ChatRelationshipContinuityState, 'continuityKey' | 'carryoverMode' | 'unresolved' | 'carryoverWeight01' | 'notes'>> & {
    continuityKey?: string;
    notes?: readonly string[];
  },
): ChatRelationshipContinuityState {
  const carryoverMode = pickCarryoverMode(unresolved01, legendPotential01, callbackLoad01);
  return {
    continuityKey: stableString(patch?.continuityKey) ?? `continuity/${carryoverMode}`,
    carryoverMode,
    unresolved: clamp01(unresolved01) >= 0.22,
    unresolvedReason: patch?.unresolvedReason,
    priorModeId: patch?.priorModeId,
    currentModeId: patch?.currentModeId,
    priorSceneId: patch?.priorSceneId,
    currentSceneId: patch?.currentSceneId,
    priorMomentId: patch?.priorMomentId,
    currentMomentId: patch?.currentMomentId,
    carryoverWeight01: clamp01(unresolved01 * 0.55 + legendPotential01 * 0.25 + callbackLoad01 * 0.2),
    recommendedOpenRole:
      carryoverMode === 'SCENE_TO_SCENE'
        ? 'CALLBACK'
        : carryoverMode === 'MODE_TO_MODE'
          ? 'REVEAL'
          : carryoverMode === 'RUN_TO_RUN'
            ? 'WITNESS'
            : carryoverMode === 'SEASON_TO_SEASON'
              ? 'ECHO'
              : 'OPEN',
    notes: stableList(patch?.notes),
  };
}

export function createThreadSummary(
  bondRole: ChatRelationshipBondRole,
  continuity: ChatRelationshipContinuityState,
  patch?: Partial<Omit<ChatRelationshipThreadSummary, 'bondRole' | 'continuityKey' | 'unresolved' | 'visibilityMode' | 'anchorIds' | 'noteCount'>> & {
    title?: string;
    anchorIds?: readonly string[];
    noteCount?: number;
  },
): ChatRelationshipThreadSummary {
  return {
    threadId: stableString(patch?.threadId) ?? `thread/${bondRole}/${continuity.continuityKey}`,
    title: stableString(patch?.title) ?? bondRole.replace(/_/g, ' '),
    bondRole,
    continuityKey: continuity.continuityKey,
    unresolved: continuity.unresolved,
    visibilityMode:
      continuity.carryoverMode === 'NONE'
        ? 'VISIBLE'
        : continuity.carryoverMode === 'SCENE_TO_SCENE'
          ? 'HYBRID'
          : 'REVEAL_READY',
    lastSceneId: patch?.lastSceneId,
    lastMomentId: patch?.lastMomentId,
    lastTouchedAt: patch?.lastTouchedAt ?? Date.now(),
    anchorIds: stableList(patch?.anchorIds),
    noteCount: clampCount(patch?.noteCount ?? 0),
  };
}

// ============================================================================
// MARK: Event impact helpers
// ============================================================================

export function momentImpactForEventType(
  eventType: ChatRelationshipEventType,
): ChatRelationshipMomentImpact {
  switch (eventType) {
    case 'PLAYER_COMEBACK':
      return {
        eventType,
        preferredLaneId: 'LEGEND',
        escalationDelta: 0.22,
        volatilityDelta: -0.06,
        witnessDelta: 0.24,
        legendDelta: 0.38,
        rescueDebtDelta: -0.1,
        traumaDelta: -0.08,
        unfinishedBusinessDelta: 0.14,
        notes: ['Comeback increases witness and legend value.'],
      };
    case 'PLAYER_COLLAPSE':
      return {
        eventType,
        preferredLaneId: 'TRAUMA',
        escalationDelta: 0.1,
        volatilityDelta: 0.26,
        witnessDelta: 0.14,
        legendDelta: 0.06,
        rescueDebtDelta: 0.24,
        traumaDelta: 0.36,
        unfinishedBusinessDelta: 0.18,
        notes: ['Collapse increases trauma and rescue debt.'],
      };
    case 'HELPER_RESCUE_EMITTED':
      return {
        eventType,
        preferredLaneId: 'RESCUE',
        escalationDelta: -0.08,
        volatilityDelta: -0.14,
        witnessDelta: -0.04,
        legendDelta: 0.08,
        rescueDebtDelta: 0.2,
        traumaDelta: -0.16,
        unfinishedBusinessDelta: -0.05,
        notes: ['Rescue dampens volatility and stores helper debt.'],
      };
    case 'NEGOTIATION_WINDOW':
      return {
        eventType,
        preferredLaneId: 'PREDICTION',
        escalationDelta: 0.08,
        volatilityDelta: 0.04,
        witnessDelta: -0.08,
        legendDelta: 0.02,
        rescueDebtDelta: 0,
        traumaDelta: 0,
        unfinishedBusinessDelta: 0.1,
        notes: ['Negotiation favors prediction and future leverage.'],
      };
    case 'PLAYER_PERFECT_DEFENSE':
      return {
        eventType,
        preferredLaneId: 'TRUST',
        escalationDelta: -0.08,
        volatilityDelta: -0.12,
        witnessDelta: 0.12,
        legendDelta: 0.16,
        rescueDebtDelta: -0.06,
        traumaDelta: -0.04,
        unfinishedBusinessDelta: 0.05,
        notes: ['Perfect defense increases earned respect and witness memory.'],
      };
    case 'PLAYER_FAILED_GAMBLE':
      return {
        eventType,
        preferredLaneId: 'HUMILIATION',
        escalationDelta: 0.14,
        volatilityDelta: 0.2,
        witnessDelta: 0.32,
        legendDelta: 0.08,
        rescueDebtDelta: 0.1,
        traumaDelta: 0.12,
        unfinishedBusinessDelta: 0.2,
        notes: ['Failed gamble creates crowd-visible wound space.'],
      };
    default:
      return {
        eventType,
        preferredLaneId: safePreferredLaneForEventType(eventType),
        escalationDelta: 0.04,
        volatilityDelta: 0.02,
        witnessDelta: 0.02,
        legendDelta: 0.01,
        rescueDebtDelta: 0,
        traumaDelta: 0,
        unfinishedBusinessDelta: 0.04,
        notes: ['Default relationship impact applied.'],
      };
  }
}

export function applyMomentImpactToVector(
  vector: ChatRelationshipVector,
  impact: ChatRelationshipMomentImpact,
): ChatRelationshipVector {
  return {
    contempt01: clamp01(weightedBlend(vector.contempt01, impact.preferredLaneId === 'HUMILIATION' ? 0.24 : 0, 1)),
    fascination01: clamp01(weightedBlend(vector.fascination01, impact.legendDelta * 0.5 + impact.witnessDelta * 0.25, 1)),
    respect01: clamp01(weightedBlend(vector.respect01, impact.preferredLaneId === 'TRUST' || impact.preferredLaneId === 'LEGEND' ? 0.18 : 0, 1)),
    fear01: clamp01(weightedBlend(vector.fear01, impact.preferredLaneId === 'DOMINANCE' ? 0.2 : impact.traumaDelta * 0.2, 1)),
    obsession01: clamp01(weightedBlend(vector.obsession01, impact.unfinishedBusinessDelta * 0.4 + impact.legendDelta * 0.12, 1)),
    patience01: clamp01(weightedBlend(vector.patience01, impact.preferredLaneId === 'RESCUE' ? 0.14 : -impact.volatilityDelta * 0.18, 1)),
    familiarity01: clamp01(weightedBlend(vector.familiarity01, impact.witnessDelta * 0.08 + impact.legendDelta * 0.1, 1)),
    predictiveConfidence01: clamp01(weightedBlend(vector.predictiveConfidence01, impact.preferredLaneId === 'PREDICTION' ? 0.22 : 0.02, 1)),
    traumaDebt01: clamp01(weightedBlend(vector.traumaDebt01, impact.traumaDelta, 1)),
    unfinishedBusiness01: clamp01(weightedBlend(vector.unfinishedBusiness01, impact.unfinishedBusinessDelta, 1)),
  };
}

// ============================================================================
// MARK: Graph constructors
// ============================================================================

export interface CreateRelationshipGraphEdgeInput {
  readonly graphId: ChatRelationshipGraphId;
  readonly sourceNodeId: ChatRelationshipNodeId;
  readonly targetNodeId: ChatRelationshipNodeId;
  readonly counterpartId: string;
  readonly counterpartKind: ChatRelationshipCounterpartKind;
  readonly playerId?: string | null;
  readonly channelId?: string | null;
  readonly roomId?: string | null;
  readonly vector?: Partial<ChatRelationshipVector>;
  readonly eventHistoryTail?: readonly ChatRelationshipEventDescriptor[];
  readonly callbackHints?: readonly ChatRelationshipCallbackHint[];
  readonly anchors?: readonly ChatRelationshipAnchor[];
  readonly createdAt?: number;
  readonly updatedAt?: number;
  readonly publicWitness01?: number;
  readonly rescueDebt01?: number;
  readonly negotiationHeat01?: number;
  readonly legendPotential01?: number;
  readonly callbackLoad01?: number;
  readonly priorModeId?: string | null;
  readonly currentModeId?: string | null;
  readonly priorSceneId?: string | null;
  readonly currentSceneId?: string | null;
  readonly priorMomentId?: string | null;
  readonly currentMomentId?: string | null;
  readonly notes?: readonly string[];
}

export function createRelationshipGraphEdge(
  input: CreateRelationshipGraphEdgeInput,
): ChatRelationshipGraphEdge {
  const vector = relationshipVectorFromSeed(input.vector);
  const createdAt = input.createdAt ?? Date.now();
  const updatedAt = input.updatedAt ?? createdAt;
  const eventHistoryTail = stableList(input.eventHistoryTail);
  const callbackHints = stableList(input.callbackHints);
  const anchors = stableList(input.anchors);
  const publicWitness01 = clamp01(input.publicWitness01 ?? average01(eventHistoryTail.map((event) => event.publicWitness01 ?? 0)));
  const rescueDebt01 = clamp01(input.rescueDebt01 ?? relationshipLegacyProjectionFromVector(input.counterpartId, vector).rescueDebt);
  const negotiationHeat01 = clamp01(input.negotiationHeat01 ?? 0);
  const callbackLoad01 = clamp01(input.callbackLoad01 ?? Math.min(1, callbackHints.length / 5));
  const legendPotential01 = clamp01(
    input.legendPotential01 ??
      (vector.fascination01 * 0.34 + vector.respect01 * 0.2 + vector.unfinishedBusiness01 * 0.22 + publicWitness01 * 0.24),
  );
  const intensity01 = clamp01(
    average01([
      vector.respect01,
      vector.fear01,
      vector.contempt01,
      vector.fascination01,
      vector.obsession01,
      vector.traumaDebt01,
      vector.unfinishedBusiness01,
    ]),
  );
  const volatility01 = clamp01(
    average01([
      Math.abs(vector.respect01 - vector.contempt01),
      Math.abs(vector.patience01 - vector.fear01),
      vector.obsession01,
      vector.traumaDebt01,
      vector.unfinishedBusiness01,
    ]),
  );
  const bondRole = pickBondRole(input.counterpartKind, input.channelId);
  const linkState = pickLinkState(intensity01, volatility01);
  const preferredLaneId = preferredAffinityLaneForCounterpartKind(input.counterpartKind);
  const affinityInput: ChatAffinityEvaluationInput = createAffinityEvaluationInputFromVector(vector, {
    counterpartKind: input.counterpartKind,
    pressureBand: inferPressureBandFromVector(vector, intensity01),
    sceneRole: continuityRoleHint(input.currentSceneId, callbackLoad01, publicWitness01),
    witness01: publicWitness01,
    unresolvedMemoryCount: eventHistoryTail.filter((event) => isEventOpenLoop(event.eventType)).length,
    callbackDensity01: callbackLoad01,
    rescueDebt01,
    negotiationHeat01,
    publicPressureBias01: publicWitness01,
    privatePressureBias01: 1 - publicWitness01,
    legendPotential01,
    notes: input.notes,
  });
  const affinityEvaluation = evaluateAffinity(affinityInput);
  const continuity = createContinuityState(
    vector.unfinishedBusiness01,
    legendPotential01,
    callbackLoad01,
    {
      continuityKey: `${input.counterpartId}:${input.channelId ?? 'GLOBAL'}`,
      priorModeId: input.priorModeId,
      currentModeId: input.currentModeId,
      priorSceneId: input.priorSceneId,
      currentSceneId: input.currentSceneId,
      priorMomentId: input.priorMomentId,
      currentMomentId: input.currentMomentId,
      notes: input.notes,
    },
  );
  const threadSummary = createThreadSummary(bondRole, continuity, {
    title: `${input.counterpartId} ${bondRole.replace(/_/g, ' ').toLowerCase()}`,
    lastSceneId: input.currentSceneId,
    lastMomentId: input.currentMomentId,
    lastTouchedAt: updatedAt,
    anchorIds: anchors.map((anchor) => anchor.anchorId),
    noteCount: (input.notes ?? []).length,
  });
  const policy = inferPolicySurface(preferredLaneId, affinityEvaluation);
  const repairWindow = createRepairWindow(vector, rescueDebt01);
  const trajectoryTail = [
    createTrajectorySnapshot(vector, {
      createdAt,
      intensity01,
      volatility01,
      publicPressureBias01: publicWitness01,
      privatePressureBias01: 1 - publicWitness01,
    }),
  ];

  return {
    edgeId: `edge/${input.counterpartId}/${input.channelId ?? 'GLOBAL'}`,
    graphId: input.graphId,
    kind: bondRole === 'NEGOTIATION_BOND' ? 'COUNTERPART_TO_CHANNEL' : 'PLAYER_TO_COUNTERPART',
    sourceNodeId: input.sourceNodeId,
    targetNodeId: input.targetNodeId,
    counterpartId: input.counterpartId,
    playerId: input.playerId,
    bondRole,
    linkState,
    temporalState: pickTemporalState(eventHistoryTail.length, vector.unfinishedBusiness01, callbackLoad01),
    visibilityMode: pickVisibilityMode(intensity01, vector.traumaDebt01, vector.predictiveConfidence01, policy.revealBias01),
    counterpartClass: pickCounterpartClass(input.counterpartKind, bondRole),
    preferredLaneId,
    affinityEvaluation,
    legacy: relationshipLegacyProjectionFromVector(input.counterpartId, vector),
    vector,
    intensity01,
    volatility01,
    witnessLoad01: publicWitness01,
    pressureLoad01: inferPressureLoadFromVector(vector, intensity01),
    callbackLoad01,
    rescueDebt01,
    negotiationHeat01,
    legendPotential01,
    callbackHints,
    anchors,
    trajectoryTail,
    repairWindow,
    continuity,
    policy,
    eventHistoryTail,
    threadSummary,
    createdAt,
    updatedAt,
  };
}

export interface CreateRelationshipGraphInput {
  readonly graphId?: string;
  readonly playerId?: string | null;
  readonly roomId?: string | null;
  readonly edges?: readonly ChatRelationshipGraphEdge[];
  readonly notes?: readonly string[];
  readonly createdAt?: number;
  readonly updatedAt?: number;
}

export function createRelationshipGraph(
  input?: CreateRelationshipGraphInput,
): ChatRelationshipGraphView {
  const createdAt = input?.createdAt ?? Date.now();
  const updatedAt = input?.updatedAt ?? createdAt;
  const edges = stableList(input?.edges);
  const activeEdgeIds = edges
    .filter((edge) => edge.linkState === 'ACTIVE' || edge.linkState === 'BURNING')
    .map((edge) => edge.edgeId);
  const unresolvedEdgeIds = edges
    .filter((edge) => edge.continuity.unresolved)
    .map((edge) => edge.edgeId);
  const nodes = buildNodesFromEdges(edges, input?.playerId, input?.roomId);
  const globalAffinitySummary = buildAffinitySummary(edges);
  return {
    graphId: stableString(input?.graphId) ?? `graph/${input?.playerId ?? 'anonymous'}/${createdAt}`,
    playerId: input?.playerId,
    roomId: input?.roomId,
    createdAt,
    updatedAt,
    nodes,
    edges,
    activeEdgeIds,
    unresolvedEdgeIds,
    focusedEdgeByChannel: buildFocusedEdgeByChannel(edges),
    focusedEdgeId: activeEdgeIds[0] ?? edges[0]?.edgeId,
    globalAffinitySummary,
    notes: stableList(input?.notes),
  };
}

// ============================================================================
// MARK: Graph utilities
// ============================================================================

export function buildNodesFromEdges(
  edges: readonly ChatRelationshipGraphEdge[],
  playerId?: string | null,
  roomId?: string | null,
): readonly ChatRelationshipNodeRef[] {
  const nodeMap = new Map<string, ChatRelationshipNodeRef>();
  if (playerId) {
    nodeMap.set(`player:${playerId}`, {
      nodeId: `player:${playerId}`,
      kind: 'PLAYER',
      playerId,
      displayName: 'Player',
      tags: ['PLAYER'],
    });
  }
  if (roomId) {
    nodeMap.set(`room:${roomId}`, {
      nodeId: `room:${roomId}`,
      kind: 'ROOM',
      roomId,
      displayName: roomId,
      tags: ['ROOM'],
    });
  }
  for (const edge of edges) {
    nodeMap.set(edge.sourceNodeId, {
      nodeId: edge.sourceNodeId,
      kind: edge.sourceNodeId.startsWith('player:') ? 'PLAYER' : 'COUNTERPART',
      playerId: edge.playerId,
      displayName: edge.sourceNodeId,
      tags: [edge.bondRole],
    });
    nodeMap.set(edge.targetNodeId, {
      nodeId: edge.targetNodeId,
      kind: 'COUNTERPART',
      counterpartId: edge.counterpartId,
      playerId: edge.playerId,
      displayName: edge.counterpartId,
      tags: [edge.bondRole, edge.preferredLaneId],
    });
  }
  return [...nodeMap.values()];
}

export function buildFocusedEdgeByChannel(
  edges: readonly ChatRelationshipGraphEdge[],
): Readonly<Record<string, string | undefined>> {
  const map: Record<string, string | undefined> = {};
  for (const edge of edges) {
    const channelKey = edge.threadSummary.continuityKey.split(':')[1] ?? 'GLOBAL';
    const current = map[channelKey];
    if (!current) {
      map[channelKey] = edge.edgeId;
      continue;
    }
    const currentEdge = edges.find((candidate) => candidate.edgeId === current);
    if (!currentEdge || edge.intensity01 > currentEdge.intensity01) {
      map[channelKey] = edge.edgeId;
    }
  }
  return map;
}

export function buildAffinitySummary(
  edges: readonly ChatRelationshipGraphEdge[],
): Readonly<Record<ChatAffinityLaneId, number>> {
  const seed = Object.fromEntries(
    Object.keys(CHAT_AFFINITY_LANE_DESCRIPTORS).map((laneId) => [laneId, 0]),
  ) as Record<ChatAffinityLaneId, number>;
  for (const edge of edges) {
    const dominantLane = edge.affinityEvaluation.dominantLaneId;
    seed[dominantLane] = clamp01(seed[dominantLane] + edge.affinityEvaluation.aggregateIntensity01 * 0.2);
  }
  return seed;
}

export function sortEdgesByHeat(
  edges: readonly ChatRelationshipGraphEdge[],
): readonly ChatRelationshipGraphEdge[] {
  return edges
    .slice()
    .sort(
      (a, b) =>
        b.intensity01 - a.intensity01 ||
        b.legendPotential01 - a.legendPotential01 ||
        b.callbackLoad01 - a.callbackLoad01,
    );
}

export function findEdgeByCounterpartId(
  graph: ChatRelationshipGraphView,
  counterpartId: string,
): ChatRelationshipGraphEdge | undefined {
  return graph.edges.find((edge) => edge.counterpartId === counterpartId);
}

export function projectCounterpart(
  edge: ChatRelationshipGraphEdge,
): ChatRelationshipCounterpartProjection {
  const dominant = edge.affinityEvaluation.scores[0];
  const disposition = pickDisposition(edge.preferredLaneId);
  const dominantAxes = dominantAxesFromVector(edge.vector, 4);
  const summary = [
    `${edge.counterpartId} is in ${edge.linkState.toLowerCase()} state.`,
    `Lane ${edge.preferredLaneId.toLowerCase()} is dominant.`,
    dominantAxes.length ? `Axes: ${dominantAxes.join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    counterpartId: edge.counterpartId ?? edge.targetNodeId,
    counterpartKind: inferCounterpartKindFromBondRole(edge.bondRole),
    bondRole: edge.bondRole,
    linkState: edge.linkState,
    temporalState: edge.temporalState,
    visibilityMode: edge.visibilityMode,
    preferredLaneId: edge.preferredLaneId,
    preferredZone: axisZone(CHAT_AFFINITY_LANE_DESCRIPTORS[edge.preferredLaneId].primaryAxes[0] ?? 'RESPECT'),
    disposition,
    stance: inferStanceFromLane(edge.preferredLaneId, edge.linkState),
    objective: inferObjectiveFromLane(edge.preferredLaneId),
    intensity01: edge.intensity01,
    volatility01: edge.volatility01,
    rescueDebt01: edge.rescueDebt01,
    callbackLoad01: edge.callbackLoad01,
    witnessLoad01: edge.witnessLoad01,
    legendPotential01: edge.legendPotential01,
    dominantAxes,
    affinitySignature: vectorAffinitySignature(edge.vector),
    summary,
    notes: dominant?.notes ?? [],
  };
}

export function projectGraphCounterparts(
  graph: ChatRelationshipGraphView,
): readonly ChatRelationshipCounterpartProjection[] {
  return sortEdgesByHeat(graph.edges).map((edge) => projectCounterpart(edge));
}

// ============================================================================
// MARK: Update / merge helpers
// ============================================================================

export function mergeRelationshipVector(
  base: ChatRelationshipVector,
  patch: Partial<ChatRelationshipVector>,
): ChatRelationshipVector {
  return relationshipVectorFromSeed({
    contempt01: patch.contempt01 ?? base.contempt01,
    fascination01: patch.fascination01 ?? base.fascination01,
    respect01: patch.respect01 ?? base.respect01,
    fear01: patch.fear01 ?? base.fear01,
    obsession01: patch.obsession01 ?? base.obsession01,
    patience01: patch.patience01 ?? base.patience01,
    familiarity01: patch.familiarity01 ?? base.familiarity01,
    predictiveConfidence01: patch.predictiveConfidence01 ?? base.predictiveConfidence01,
    traumaDebt01: patch.traumaDebt01 ?? base.traumaDebt01,
    unfinishedBusiness01: patch.unfinishedBusiness01 ?? base.unfinishedBusiness01,
  });
}

export function pushEventIntoEdge(
  edge: ChatRelationshipGraphEdge,
  event: ChatRelationshipEventDescriptor,
): ChatRelationshipGraphEdge {
  const impact = momentImpactForEventType(event.eventType);
  const nextVector = applyMomentImpactToVector(edge.vector, impact);
  const nextEvents = [...edge.eventHistoryTail, event].slice(-24);
  const nextCallbackLoad01 = clamp01(edge.callbackLoad01 + (impact.unfinishedBusinessDelta * 0.1));
  const nextLegendPotential01 = clamp01(edge.legendPotential01 + impact.legendDelta);
  const nextRescueDebt01 = clamp01(edge.rescueDebt01 + impact.rescueDebtDelta);
  const nextWitness01 = clamp01(edge.witnessLoad01 + impact.witnessDelta);
  const nextIntensity01 = clamp01(edge.intensity01 + impact.escalationDelta * 0.3 + impact.legendDelta * 0.1);
  const nextVolatility01 = clamp01(edge.volatility01 + impact.volatilityDelta * 0.5);
  const nextAffinityInput = createAffinityEvaluationInputFromVector(nextVector, {
    counterpartKind: inferCounterpartKindFromBondRole(edge.bondRole),
    pressureBand: event.pressureBand,
    witness01: nextWitness01,
    callbackDensity01: nextCallbackLoad01,
    rescueDebt01: nextRescueDebt01,
    legendPotential01: nextLegendPotential01,
    notes: [event.summary ?? event.eventType],
  });
  const nextEvaluation = evaluateAffinity(nextAffinityInput);
  const nextPolicy = inferPolicySurface(edge.preferredLaneId, nextEvaluation);
  const nextContinuity = createContinuityState(
    nextVector.unfinishedBusiness01,
    nextLegendPotential01,
    nextCallbackLoad01,
    {
      continuityKey: edge.continuity.continuityKey,
      priorModeId: edge.continuity.priorModeId,
      currentModeId: edge.continuity.currentModeId,
      priorSceneId: edge.continuity.priorSceneId,
      currentSceneId: event.sceneId ?? edge.continuity.currentSceneId,
      priorMomentId: edge.continuity.priorMomentId,
      currentMomentId: edge.continuity.currentMomentId,
      notes: [...edge.continuity.notes, ...impact.notes].slice(-16),
    },
  );
  const nextTrajectoryTail = [
    ...edge.trajectoryTail,
    createTrajectorySnapshot(nextVector, {
      createdAt: event.createdAt,
      intensity01: nextIntensity01,
      volatility01: nextVolatility01,
      publicPressureBias01: nextWitness01,
      privatePressureBias01: 1 - nextWitness01,
    }),
  ].slice(-12);

  return {
    ...edge,
    vector: nextVector,
    intensity01: nextIntensity01,
    volatility01: nextVolatility01,
    witnessLoad01: nextWitness01,
    callbackLoad01: nextCallbackLoad01,
    rescueDebt01: nextRescueDebt01,
    legendPotential01: nextLegendPotential01,
    affinityEvaluation: nextEvaluation,
    linkState: pickLinkState(nextIntensity01, nextVolatility01),
    temporalState: pickTemporalState(nextEvents.length, nextVector.unfinishedBusiness01, nextCallbackLoad01),
    visibilityMode: pickVisibilityMode(nextIntensity01, nextVector.traumaDebt01, nextVector.predictiveConfidence01, nextPolicy.revealBias01),
    legacy: relationshipLegacyProjectionFromVector(edge.counterpartId ?? edge.targetNodeId, nextVector),
    eventHistoryTail: nextEvents,
    continuity: nextContinuity,
    policy: nextPolicy,
    repairWindow: createRepairWindow(nextVector, nextRescueDebt01),
    trajectoryTail: nextTrajectoryTail,
    updatedAt: event.createdAt,
    threadSummary: {
      ...edge.threadSummary,
      unresolved: nextContinuity.unresolved,
      visibilityMode:
        nextContinuity.carryoverMode === 'NONE'
          ? 'VISIBLE'
          : nextContinuity.carryoverMode === 'SCENE_TO_SCENE'
            ? 'HYBRID'
            : 'REVEAL_READY',
      lastSceneId: event.sceneId ?? edge.threadSummary.lastSceneId,
      lastTouchedAt: event.createdAt,
      anchorIds: edge.anchors.map((anchor) => anchor.anchorId),
    },
  };
}

export function addAnchorToEdge(
  edge: ChatRelationshipGraphEdge,
  anchor: ChatRelationshipAnchor,
): ChatRelationshipGraphEdge {
  const anchors = [...edge.anchors, anchor].slice(-16);
  const callbackLoad01 = clamp01(Math.max(edge.callbackLoad01, Math.min(1, anchors.length / 6)));
  const legendPotential01 = clamp01(edge.legendPotential01 + anchor.role === 'LEGEND_ECHO' ? 0.08 : 0.02);
  return {
    ...edge,
    anchors,
    callbackLoad01,
    legendPotential01,
    threadSummary: {
      ...edge.threadSummary,
      anchorIds: anchors.map((item) => item.anchorId),
      noteCount: edge.threadSummary.noteCount + 1,
    },
  };
}

// ============================================================================
// MARK: Compatibility bridges
// ============================================================================

export function edgeToLegacyBridge(
  edge: ChatRelationshipGraphEdge,
): ChatRelationshipLegacyBridge {
  const counterpartState = counterpartStateFromGraphEdge(edge);
  return {
    counterpartId: edge.counterpartId ?? edge.targetNodeId,
    summaryView: relationshipSummaryViewFromState(counterpartState),
    counterpartState,
    npcSignal: relationshipNpcSignalFromState(counterpartState),
    projection: projectCounterpart(edge),
    edge,
  };
}

export function graphToLegacySnapshot(
  graph: ChatRelationshipGraphView,
): ChatRelationshipSnapshot {
  return relationshipSnapshotFromGraph(graph);
}

export function stateToAffinitySignals(
  state: ChatRelationshipCounterpartState,
  patch?: Omit<Partial<ChatAffinityEvaluationInput>, 'vector'>,
): readonly ChatAffinitySignal[] {
  const evaluation = evaluateAffinity(
    createAffinityEvaluationInputFromVector(state.vector, {
      counterpartKind: state.counterpartKind,
      pressureBand: patch?.pressureBand,
      sceneRole: patch?.sceneRole,
      witness01: patch?.witness01,
      callbackDensity01: patch?.callbackDensity01 ?? Math.min(1, state.callbackHints.length / 6),
      rescueDebt01: patch?.rescueDebt01,
      negotiationHeat01: patch?.negotiationHeat01,
      publicPressureBias01: patch?.publicPressureBias01 ?? state.publicPressureBias01,
      privatePressureBias01: patch?.privatePressureBias01 ?? state.privatePressureBias01,
      legendPotential01: patch?.legendPotential01,
      unresolvedMemoryCount: patch?.unresolvedMemoryCount,
      notes: patch?.notes,
    }),
  );
  return evaluation.surfacedSignals;
}

// ============================================================================
// MARK: Additional deterministic helpers
// ============================================================================

export function inferPressureBandFromVector(
  vector: ChatRelationshipVector,
  intensity01?: number,
): ChatRelationshipPressureBand {
  const intensity = clamp01(intensity01 ?? average01([
    vector.fear01,
    vector.contempt01,
    vector.obsession01,
    vector.traumaDebt01,
    vector.unfinishedBusiness01,
  ]));
  if (intensity < 0.2) return 'LOW';
  if (intensity < 0.48) return 'MEDIUM';
  if (intensity < 0.76) return 'HIGH';
  return 'CRITICAL';
}

export function inferPressureLoadFromVector(
  vector: ChatRelationshipVector,
  intensity01?: number,
): number {
  return clamp01(
    (intensity01 ?? 0) * 0.3 +
      vector.fear01 * 0.2 +
      vector.contempt01 * 0.14 +
      vector.obsession01 * 0.14 +
      vector.traumaDebt01 * 0.1 +
      vector.unfinishedBusiness01 * 0.12,
  );
}

export function isEventOpenLoop(eventType: ChatRelationshipEventType): boolean {
  switch (eventType) {
    case 'PLAYER_COLLAPSE':
    case 'PLAYER_FAILED_GAMBLE':
    case 'PLAYER_NEAR_SOVEREIGNTY':
    case 'NEGOTIATION_WINDOW':
    case 'BOT_TAUNT_EMITTED':
    case 'RIVAL_WITNESS_EMITTED':
    case 'PUBLIC_WITNESS':
      return true;
    default:
      return false;
  }
}

export function continuityRoleHint(
  currentSceneId?: string | null,
  callbackLoad01 = 0,
  witness01 = 0,
): ChatAffinityEvaluationInput['sceneRole'] {
  if (!currentSceneId && callbackLoad01 < 0.2) return 'OPEN';
  if (callbackLoad01 >= 0.66) return 'CALLBACK';
  if (witness01 >= 0.72) return 'WITNESS';
  return 'PRESSURE';
}

export function strongestAffinitySignalForEdge(
  edge: ChatRelationshipGraphEdge,
): ChatAffinitySignal | undefined {
  return edge.affinityEvaluation.surfacedSignals[0] ?? buildAffinitySignalForLane(edge.preferredLaneId, createAffinityEvaluationInputFromVector(edge.vector, {
    counterpartKind: inferCounterpartKindFromBondRole(edge.bondRole),
    pressureBand: inferPressureBandFromVector(edge.vector, edge.intensity01),
    witness01: edge.witnessLoad01,
    callbackDensity01: edge.callbackLoad01,
    rescueDebt01: edge.rescueDebt01,
    negotiationHeat01: edge.negotiationHeat01,
    legendPotential01: edge.legendPotential01,
  }));
}

export function strongestEdgesByLane(
  graph: ChatRelationshipGraphView,
): Readonly<Record<ChatAffinityLaneId, ChatRelationshipGraphEdge | undefined>> {
  const seed = Object.fromEntries(
    Object.keys(CHAT_AFFINITY_LANE_DESCRIPTORS).map((laneId) => [laneId, undefined]),
  ) as Record<ChatAffinityLaneId, ChatRelationshipGraphEdge | undefined>;

  for (const edge of sortEdgesByHeat(graph.edges)) {
    const laneId = edge.affinityEvaluation.dominantLaneId;
    if (!seed[laneId]) seed[laneId] = edge;
  }
  return seed;
}

export function unresolvedGraphEdgeCount(graph: ChatRelationshipGraphView): number {
  return graph.edges.filter((edge) => edge.continuity.unresolved).length;
}

export function relationshipGraphHeat(graph: ChatRelationshipGraphView): number {
  return clamp01(average01(graph.edges.map((edge) => edge.intensity01)));
}

export function relationshipGraphLegendWeight(graph: ChatRelationshipGraphView): number {
  return clamp01(average01(graph.edges.map((edge) => edge.legendPotential01)));
}

export function relationshipGraphCallbackWeight(graph: ChatRelationshipGraphView): number {
  return clamp01(average01(graph.edges.map((edge) => edge.callbackLoad01)));
}

export function mergeGraphs(
  base: ChatRelationshipGraphView,
  incoming: ChatRelationshipGraphView,
): ChatRelationshipGraphView {
  const edgeMap = new Map<string, ChatRelationshipGraphEdge>();
  for (const edge of base.edges) edgeMap.set(edge.edgeId, edge);
  for (const edge of incoming.edges) {
    const existing = edgeMap.get(edge.edgeId);
    if (!existing || edge.updatedAt >= existing.updatedAt) edgeMap.set(edge.edgeId, edge);
  }
  const mergedEdges = [...edgeMap.values()];
  return createRelationshipGraph({
    graphId: incoming.graphId || base.graphId,
    playerId: incoming.playerId ?? base.playerId,
    roomId: incoming.roomId ?? base.roomId,
    edges: mergedEdges,
    createdAt: Math.min(base.createdAt, incoming.createdAt),
    updatedAt: Math.max(base.updatedAt, incoming.updatedAt),
    notes: [...base.notes, ...incoming.notes].slice(-32),
  });
}

export function createInitialCounterpartState(
  counterpartId: string,
  counterpartKind: ChatRelationshipCounterpartKind,
  patch?: Partial<ChatRelationshipCounterpartState>,
): ChatRelationshipCounterpartState {
  const vector = relationshipVectorFromSeed(patch?.vector);
  const preferredLaneId = preferredAffinityLaneForCounterpartKind(counterpartKind);
  return {
    counterpartId,
    counterpartKind,
    playerId: patch?.playerId,
    botId: patch?.botId,
    actorRole: patch?.actorRole,
    lastChannelId: patch?.lastChannelId,
    vector,
    stance: patch?.stance ?? inferStanceFromLane(preferredLaneId, 'EMERGING'),
    objective: patch?.objective ?? inferObjectiveFromLane(preferredLaneId),
    intensity01: clamp01(patch?.intensity01 ?? average01([vector.fascination01, vector.respect01, vector.fear01, vector.contempt01])),
    volatility01: clamp01(patch?.volatility01 ?? average01([vector.obsession01, vector.traumaDebt01, vector.unfinishedBusiness01])),
    publicPressureBias01: clamp01(patch?.publicPressureBias01 ?? 0.5),
    privatePressureBias01: clamp01(patch?.privatePressureBias01 ?? 0.5),
    callbackHints: stableList(patch?.callbackHints),
    eventHistoryTail: stableList(patch?.eventHistoryTail),
    dominantAxes: dominantAxesFromVector(vector, 4),
    lastTouchedAt: patch?.lastTouchedAt ?? Date.now(),
  };
}

export const CHAT_RELATIONSHIP_REGISTRY = Object.freeze({
  filePath: CHAT_RELATIONSHIP_FILE_PATH,
  version: CHAT_RELATIONSHIP_VERSION,
  linkStates: CHAT_RELATIONSHIP_LINK_STATES,
  temporalStates: CHAT_RELATIONSHIP_TEMPORAL_STATES,
  bondRoles: CHAT_RELATIONSHIP_BOND_ROLES,
  visibilityModes: CHAT_RELATIONSHIP_VISIBILITY_MODES,
  escalationGrades: CHAT_RELATIONSHIP_ESCALATION_GRADES,
  memoryModes: CHAT_RELATIONSHIP_MEMORY_MODES,
  carryoverModes: CHAT_RELATIONSHIP_CARRYOVER_MODES,
  repairModes: CHAT_RELATIONSHIP_REPAIR_MODES,
});
