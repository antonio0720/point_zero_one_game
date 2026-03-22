/* eslint-disable max-lines, max-lines-per-function, max-statements, complexity */
/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT LIVEOPS WORLD EVENT OVERLAY POLICY
 * FILE: pzo-web/src/engines/chat/liveops/WorldEventOverlayPolicy.ts
 * VERSION: 2026.03.21-world-event-overlay-policy.15x
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Deep pure projection policy that converts seasonal liveops runtime state
 * into mount-safe, explainable, multi-surface overlay models for chat-adjacent
 * UI surfaces.
 *
 * This file remains presentation law only. It does not own authoritative
 * transcript truth, scheduling truth, or persistence. It translates already
 * derived runtime state into deterministic overlay decisions, cards, queues,
 * diagnostics, and export-safe policy manifests.
 * ============================================================================
 */

import type {
  ChatBridgeChannel,
  ChatBridgeMountTarget,
  ChatBridgeRuntimeSnapshot,
  ChatBridgeSeverity,
} from '../ChatEventBridge';
import type { ChatChannelId } from '../../../../../shared/contracts/chat/ChatChannels';
import type { ChatLiveOpsSummary } from '../../../../../shared/contracts/chat/ChatLiveOps';
import type {
  ChatWorldEventAnnouncementMode,
  ChatWorldEventKind,
  ChatWorldEventPressureBand,
  ChatWorldEventVisibilityMode,
} from '../../../../../shared/contracts/chat/ChatWorldEvent';
import { CHAT_WORLD_EVENT_REGISTRY_MANIFEST } from '../../../../../shared/contracts/chat/ChatWorldEvent';
import type {
  SeasonalChatEventDirectorSnapshot,
  SeasonalChatEventRuntimeState,
} from './SeasonalChatEventDirector';

export const WORLD_EVENT_OVERLAY_POLICY_VERSION = '2026.03.21-world-event-overlay-policy.15x' as const;
export type LiveOpsOverlayTone = 'CEREMONIAL' | 'ALARM' | 'PREDATORY' | 'WHISPER' | 'DEBATE' | 'SURGE' | 'SUPPRESSED';
export type LiveOpsOverlayUrgencyBand = 'DORMANT' | 'WATCH' | 'ACTIVE' | 'HOT' | 'FLASHPOINT';
export type LiveOpsOverlayPanelMode = 'BANNER' | 'PANEL' | 'STRIP' | 'PROOF' | 'TACTICAL' | 'RESCUE' | 'SHADOW';
export type LiveOpsOverlayWorldPosture = 'CALM' | 'TENSE' | 'HOSTILE' | 'PREDATORY' | 'CEREMONIAL' | 'WITHHELD' | 'ARGUMENTATIVE';
export type LiveOpsOverlayPulseClass = 'NONE' | 'SOFT' | 'STEADY' | 'HARD' | 'SIREN';
export type LiveOpsOverlayPublicness = 'PUBLIC' | 'HYBRID' | 'SHADOW' | 'HIDDEN';
export type LiveOpsOverlaySelectionReason = 'VISIBLE_PRIORITY' | 'SHADOW_PRIORITY' | 'PRESSURE_BAND' | 'ANNOUNCEMENT_MODE' | 'MOUNT_BIAS' | 'HELPER_SUPPRESSION' | 'CROWD_HEAT' | 'URGENT_RUNTIME' | 'LEGEND_PREFERENCE' | 'QUIET_WORLD_FALLBACK';

export interface ChatWorldEventOverlayBadge {
  readonly badgeId: string;
  readonly label: string;
  readonly tone: LiveOpsOverlayTone;
  readonly severity: ChatBridgeSeverity;
  readonly explanation: string;
}

export interface ChatWorldEventOverlayChannelScore {
  readonly channelId: ChatChannelId;
  readonly visibleWeight: number;
  readonly shadowWeight: number;
  readonly totalWeight: number;
  readonly recommended: boolean;
  readonly reasons: readonly string[];
}

export interface ChatWorldEventOverlayMountScore {
  readonly mount: ChatBridgeMountTarget;
  readonly weight: number;
  readonly severity: ChatBridgeSeverity;
  readonly recommended: boolean;
  readonly explanation: string;
}

export interface ChatWorldEventOverlayExplainability {
  readonly selectionReasons: readonly LiveOpsOverlaySelectionReason[];
  readonly summaryHeadline: string;
  readonly summaryBody: string;
  readonly pressureNotes: readonly string[];
  readonly mountNotes: readonly string[];
  readonly channelNotes: readonly string[];
  readonly runtimeNotes: readonly string[];
}

export interface ChatWorldEventOverlayRenderAdvice {
  readonly panelMode: LiveOpsOverlayPanelMode;
  readonly worldPosture: LiveOpsOverlayWorldPosture;
  readonly pulseClass: LiveOpsOverlayPulseClass;
  readonly urgencyBand: LiveOpsOverlayUrgencyBand;
  readonly publicness: LiveOpsOverlayPublicness;
  readonly primaryMount: ChatBridgeMountTarget;
  readonly recommendedMounts: readonly ChatBridgeMountTarget[];
}

export interface ChatWorldEventOverlayCard {
  readonly overlayId: string;
  readonly eventId: string;
  readonly headline: string;
  readonly body: string;
  readonly detailLines: readonly string[];
  readonly severity: ChatBridgeSeverity;
  readonly tone: LiveOpsOverlayTone;
  readonly visibilityMode: ChatWorldEventVisibilityMode;
  readonly pressureBand: ChatWorldEventPressureBand;
  readonly announcementMode: ChatWorldEventAnnouncementMode;
  readonly mounts: readonly ChatBridgeMountTarget[];
  readonly visibleChannels: readonly ChatChannelId[];
  readonly shadowChannels: readonly ChatChannelId[];
  readonly sticky: boolean;
  readonly dismissible: boolean;
  readonly shouldPulse: boolean;
  readonly helperSuppressed: boolean;
  readonly whisperOnly: boolean;
  readonly crowdHeatScore: number;
  readonly priorityScore: number;
  readonly activatedAt: number;
  readonly deactivatesAt: number;
  readonly label?: string;
  readonly kind?: ChatWorldEventKind;
  readonly shadowPriorityScore?: number;
  readonly publicPriorityScore?: number;
  readonly urgencyScore?: number;
  readonly noveltyScore?: number;
  readonly pressureScore?: number;
  readonly worldPosture?: LiveOpsOverlayWorldPosture;
  readonly panelMode?: LiveOpsOverlayPanelMode;
  readonly pulseClass?: LiveOpsOverlayPulseClass;
  readonly publicness?: LiveOpsOverlayPublicness;
  readonly badges?: readonly ChatWorldEventOverlayBadge[];
  readonly tags?: readonly string[];
  readonly channelScores?: readonly ChatWorldEventOverlayChannelScore[];
  readonly mountScores?: readonly ChatWorldEventOverlayMountScore[];
  readonly renderAdvice?: ChatWorldEventOverlayRenderAdvice;
  readonly explainability?: ChatWorldEventOverlayExplainability;
  readonly notes?: readonly string[];
}

export interface ChatWorldEventOverlayDiagnostics {
  readonly generatedAt: number;
  readonly totalCards: number;
  readonly publicCards: number;
  readonly shadowCards: number;
  readonly helperBlackoutActive: boolean;
  readonly highestPriorityScore: number;
  readonly highestVisiblePressure: number;
  readonly highestShadowPressure: number;
  readonly headline: string;
  readonly subline: string;
  readonly recommendedMounts: readonly ChatBridgeMountTarget[];
  readonly recommendedChannels: readonly ChatChannelId[];
  readonly cardsByTone: Readonly<Record<LiveOpsOverlayTone, number>>;
  readonly cardsBySeverity: Readonly<Record<ChatBridgeSeverity, number>>;
  readonly cardsByKind: Readonly<Record<ChatWorldEventKind, number>>;
  readonly cardsByVisibility: Readonly<Record<ChatWorldEventVisibilityMode, number>>;
  readonly quietWorldReason: string;
  readonly notes: readonly string[];
}

export interface ChatWorldEventOverlayManifest {
  readonly version: typeof WORLD_EVENT_OVERLAY_POLICY_VERSION;
  readonly generatedAt: number;
  readonly activeEventCount: number;
  readonly quietWorld: boolean;
  readonly helperBlackoutActive: boolean;
  readonly headline: string;
  readonly subline: string;
  readonly mounts: readonly ChatBridgeMountTarget[];
  readonly channelVisibility: Readonly<Record<ChatChannelId, number>>;
  readonly cards: readonly ChatWorldEventOverlayCard[];
  readonly diagnostics: ChatWorldEventOverlayDiagnostics;
}

export interface ChatWorldEventOverlayStack {
  readonly primary: ChatWorldEventOverlayCard | null;
  readonly secondary: readonly ChatWorldEventOverlayCard[];
  readonly shadow: readonly ChatWorldEventOverlayCard[];
  readonly quietWorld: boolean;
  readonly helperBlackoutActive: boolean;
  readonly cards?: readonly ChatWorldEventOverlayCard[];
  readonly headline?: string;
  readonly subline?: string;
  readonly severity?: ChatBridgeSeverity;
  readonly mounts?: readonly ChatBridgeMountTarget[];
  readonly channelVisibility?: Readonly<Record<ChatChannelId, number>>;
  readonly diagnostics?: ChatWorldEventOverlayDiagnostics;
  readonly manifest?: ChatWorldEventOverlayManifest;
}

export interface WorldEventOverlayPolicyOptions {
  readonly maxSecondaryCards?: number;
  readonly maxShadowCards?: number;
  readonly showWarmupCards?: boolean;
  readonly preferCeremonialForLegendCharge?: boolean;
  readonly primaryDetailLineBudget?: number;
  readonly secondaryDetailLineBudget?: number;
  readonly shadowDetailLineBudget?: number;
  readonly shadowAttenuation?: number;
  readonly visiblePriorityWeight?: number;
  readonly shadowPriorityWeight?: number;
  readonly pressureWeight?: number;
  readonly urgencyWeight?: number;
  readonly noveltyWeight?: number;
  readonly audienceWeight?: number;
  readonly quietWorldHeadline?: string;
  readonly quietWorldSubline?: string;
  readonly renderShadowOnPrimaryWhenNoPublic?: boolean;
  readonly collapseShadowToSingleCard?: boolean;
  readonly includeDiagnostics?: boolean;
  readonly includeManifest?: boolean;
  readonly maxRecommendedMounts?: number;
  readonly maxRecommendedChannels?: number;
}

interface WorldEventOverlayToneProfile {
  readonly tone: LiveOpsOverlayTone;
  readonly worldPosture: LiveOpsOverlayWorldPosture;
  readonly panelMode: LiveOpsOverlayPanelMode;
  readonly pulseClass: LiveOpsOverlayPulseClass;
  readonly stickyBias: number;
  readonly shadowBias: number;
  readonly explanation: string;
}

interface WorldEventOverlayKindProfile {
  readonly kind: ChatWorldEventKind;
  readonly defaultTone: LiveOpsOverlayTone;
  readonly defaultBadgeLabel: string;
  readonly posture: LiveOpsOverlayWorldPosture;
  readonly preferredMounts: readonly ChatBridgeMountTarget[];
  readonly highPressureMounts: readonly ChatBridgeMountTarget[];
  readonly bodyClauses: readonly string[];
  readonly detailClauses: readonly string[];
  readonly headlineSuffixes: readonly string[];
  readonly tags: readonly string[];
  readonly quietBias: number;
  readonly shadowBias: number;
  readonly ceremonyBias: number;
  readonly rescueBias: number;
  readonly debateBias: number;
  readonly threatBias: number;
  readonly proofBias: number;
  readonly mountBias: Readonly<Record<ChatBridgeMountTarget, number>>;
  readonly detailMode: LiveOpsOverlayPanelMode;
  readonly summaryNotes: readonly string[];
}

const DEFAULT_OPTIONS: Required<WorldEventOverlayPolicyOptions> = Object.freeze({
  maxSecondaryCards: 3,
  maxShadowCards: 3,
  showWarmupCards: true,
  preferCeremonialForLegendCharge: true,
  primaryDetailLineBudget: 6,
  secondaryDetailLineBudget: 4,
  shadowDetailLineBudget: 3,
  shadowAttenuation: 0.72,
  visiblePriorityWeight: 0.34,
  shadowPriorityWeight: 0.16,
  pressureWeight: 0.18,
  urgencyWeight: 0.12,
  noveltyWeight: 0.05,
  audienceWeight: 0.15,
  quietWorldHeadline: 'World pressure stable',
  quietWorldSubline: 'No liveops surge currently targeted at this mount.',
  renderShadowOnPrimaryWhenNoPublic: true,
  collapseShadowToSingleCard: false,
  includeDiagnostics: true,
  includeManifest: true,
  maxRecommendedMounts: 4,
  maxRecommendedChannels: 5,
});

const TONE_PROFILES: Readonly<Record<LiveOpsOverlayTone, WorldEventOverlayToneProfile>> = Object.freeze({
  'CEREMONIAL': Object.freeze({
    tone: 'CEREMONIAL',
    worldPosture: 'CEREMONIAL',
    panelMode: 'PROOF',
    pulseClass: 'STEADY',
    stickyBias: 0.12,
    shadowBias: 0.04,
    explanation: 'Witness-heavy, stately, and memorable.',
  }),
  'ALARM': Object.freeze({
    tone: 'ALARM',
    worldPosture: 'TENSE',
    panelMode: 'BANNER',
    pulseClass: 'HARD',
    stickyBias: 0.16,
    shadowBias: 0.09,
    explanation: 'Fast-readable and operational.',
  }),
  'PREDATORY': Object.freeze({
    tone: 'PREDATORY',
    worldPosture: 'PREDATORY',
    panelMode: 'TACTICAL',
    pulseClass: 'HARD',
    stickyBias: 0.2,
    shadowBias: 0.15,
    explanation: 'Hunting posture with threat-led mounting.',
  }),
  'WHISPER': Object.freeze({
    tone: 'WHISPER',
    worldPosture: 'WITHHELD',
    panelMode: 'SHADOW',
    pulseClass: 'SOFT',
    stickyBias: 0.05,
    shadowBias: 0.24,
    explanation: 'Low-volume, implication-rich, and selective.',
  }),
  'DEBATE': Object.freeze({
    tone: 'DEBATE',
    worldPosture: 'ARGUMENTATIVE',
    panelMode: 'PANEL',
    pulseClass: 'STEADY',
    stickyBias: 0.09,
    shadowBias: 0.08,
    explanation: 'Counter-claim and proof oriented.',
  }),
  'SURGE': Object.freeze({
    tone: 'SURGE',
    worldPosture: 'TENSE',
    panelMode: 'STRIP',
    pulseClass: 'STEADY',
    stickyBias: 0.11,
    shadowBias: 0.1,
    explanation: 'General acceleration without singular hostility.',
  }),
  'SUPPRESSED': Object.freeze({
    tone: 'SUPPRESSED',
    worldPosture: 'HOSTILE',
    panelMode: 'RESCUE',
    pulseClass: 'SOFT',
    stickyBias: 0.18,
    shadowBias: 0.19,
    explanation: 'Designed to make the absence of help legible.',
  }),
});

const PRESSURE_BAND_WEIGHTS: Readonly<Record<ChatWorldEventPressureBand, number>> = Object.freeze({
  'NONE': 0.0,
  'LIGHT': 0.18,
  'MODERATE': 0.38,
  'HEAVY': 0.58,
  'SEVERE': 0.8,
  'WORLD_CLASS': 1.0,
});

const ANNOUNCEMENT_MODE_WEIGHTS: Readonly<Record<ChatWorldEventAnnouncementMode, number>> = Object.freeze({
  'NONE': 0.02,
  'HEADLINE': 0.18,
  'BANNER': 0.42,
  'SYSTEM_NOTICE': 0.46,
  'INTERRUPTION': 0.72,
  'SCENE': 0.8,
});
const VISIBILITY_MODE_WEIGHTS: Readonly<Record<ChatWorldEventVisibilityMode, number>> = Object.freeze({
  'PUBLIC': 1.0,
  'SHADOW_ONLY': 0.44,
  'PUBLIC_WITH_SHADOW': 0.94,
  'REVEAL_LATER': 0.62,
  'OPERATOR_HIDDEN': 0.08,
});

const MOUNT_PROFILE_EXPLANATIONS: Readonly<Record<ChatBridgeMountTarget, string>> = Object.freeze({
  'PRIMARY_DOCK': 'The canonical top-level dock. Use when the world should be felt instantly.',
  'COUNTERPLAY_MODAL': 'Best when the event benefits from interpretation, guidance, or direct response.',
  'EMPIRE_BLEED_BANNER': 'A soft but high-legibility strip for economic or ambient pressure drift.',
  'MOMENT_FLASH': 'Use for short high-severity shocks that must interrupt attention.',
  'PROOF_CARD': 'Supports evidence-bearing or callback-heavy narrative pressure.',
  'PROOF_CARD_V2': 'Higher-fidelity proof surface used for spotlight or consequence-heavy events.',
  'RESCUE_WINDOW_BANNER': 'Best when rescue posture or intervention loss must be made legible.',
  'SABOTAGE_IMPACT_PANEL': 'Fits structural, economic, or persistent sabotage pressure.',
  'THREAT_RADAR_PANEL': 'Primary tactical readout for hunting, raid, and low-shield pressure.',
});

const PREDATOR_SWEEP_BODY_CLAUSES = Object.freeze([
  'Hunters are rotating across exposed rooms.',
  'Predator lines are tightening around public mistakes.',
  'The room is treating hesitation as a scent trail.',
  'Aggressive patterning is spilling into visible channels.',
  'Pressure is moving with deliberate, coordinated appetite.',
  'Attack-watch surfaces deserve priority over quiet mounts.',
] as const);
const PREDATOR_SWEEP_DETAIL_CLAUSES = Object.freeze([
  'Keep threat radar elevated for fast reading.',
  'Favor urgent language over ceremonial framing.',
  'Shadow spillover should remain visible but contained.',
  'Body copy should tell the player the room is hunting.',
  'Counterplay mounts matter only if the player can still act.',
  'Do not flatten predator pressure into generic alarm text.',
] as const);
const PREDATOR_SWEEP_HEADLINE_SUFFIXES = Object.freeze([
  'pressure re-ordered the room',
  'the room is reclassifying risk',
  'witness is intensifying',
  'the world is not staying neutral',
  'channels are reacting unevenly',
  'shadow spill is now part of the story',
] as const);
const PREDATOR_SWEEP_SUMMARY_NOTES = Object.freeze([
  'Predator Sweep keeps its own presentation law.',
  'Projection should preserve visible-vs-shadow separation.',
  'Mount routing must remain deterministic under equal priority.',
  'Cards should explain why this event surfaced now.',
  'High drama deserves speed, not noise.',
  'Fallback copy should stay grounded in runtime pressure.',
] as const);
const PREDATOR_SWEEP_TAGS = Object.freeze([
  'predator_sweep',
  'predatory',
  'hunter_grid',
  'liveops',
  'overlay',
  'world-event',
] as const);
const PREDATOR_SWEEP_MOUNT_BIAS: Readonly<Record<ChatBridgeMountTarget, number>> = Object.freeze({
  'PRIMARY_DOCK': 0.57,
  'COUNTERPLAY_MODAL': 0.22,
  'EMPIRE_BLEED_BANNER': 0.22,
  'MOMENT_FLASH': 0.57,
  'PROOF_CARD': 0.22,
  'PROOF_CARD_V2': 0.22,
  'RESCUE_WINDOW_BANNER': 0.22,
  'SABOTAGE_IMPACT_PANEL': 0.22,
  'THREAT_RADAR_PANEL': 0.83,
});
const PREDATOR_SWEEP_PROFILE: WorldEventOverlayKindProfile = Object.freeze({
  kind: 'PREDATOR_SWEEP',
  defaultTone: 'PREDATORY',
  defaultBadgeLabel: 'HUNTER_GRID',
  posture: 'PREDATORY',
  preferredMounts: Object.freeze(['THREAT_RADAR_PANEL', 'MOMENT_FLASH', 'PRIMARY_DOCK']) as readonly ChatBridgeMountTarget[],
  highPressureMounts: Object.freeze(['THREAT_RADAR_PANEL', 'MOMENT_FLASH', 'PRIMARY_DOCK']) as readonly ChatBridgeMountTarget[],
  bodyClauses: PREDATOR_SWEEP_BODY_CLAUSES,
  detailClauses: PREDATOR_SWEEP_DETAIL_CLAUSES,
  headlineSuffixes: PREDATOR_SWEEP_HEADLINE_SUFFIXES,
  tags: PREDATOR_SWEEP_TAGS,
  quietBias: 0.1,
  shadowBias: 0.1,
  ceremonyBias: 0.02,
  rescueBias: 0.04,
  debateBias: 0.04,
  threatBias: 0.32,
  proofBias: 0.05,
  mountBias: PREDATOR_SWEEP_MOUNT_BIAS,
  detailMode: 'TACTICAL',
  summaryNotes: PREDATOR_SWEEP_SUMMARY_NOTES,
});

const SYNDICATE_PANIC_BODY_CLAUSES = Object.freeze([
  'Syndicate trust is destabilizing under active pressure.',
  'Alliance posture is fragmenting and coordination is slipping.',
  'Rooms are reacting as if the floor just moved.',
  'This is a cohesion event more than a single-channel spike.',
  'Players need clarity fast because coordination debt is rising.',
  'Visible systems should frame panic without becoming noise.',
] as const);
const SYNDICATE_PANIC_DETAIL_CLAUSES = Object.freeze([
  'Elevate proof and instructions over spectacle.',
  'The body should warn about coordination risk.',
  'Secondary cards should show who is affected, not just that risk exists.',
  'Public overlays should stay legible for teams under stress.',
  'Whisper spill can exist, but public trust damage is the main story.',
  'Keep modal escalation available when trust repair is possible.',
] as const);
const SYNDICATE_PANIC_HEADLINE_SUFFIXES = Object.freeze([
  'pressure re-ordered the room',
  'the room is reclassifying risk',
  'witness is intensifying',
  'the world is not staying neutral',
  'channels are reacting unevenly',
  'shadow spill is now part of the story',
] as const);
const SYNDICATE_PANIC_SUMMARY_NOTES = Object.freeze([
  'Syndicate Panic keeps its own presentation law.',
  'Projection should preserve visible-vs-shadow separation.',
  'Mount routing must remain deterministic under equal priority.',
  'Cards should explain why this event surfaced now.',
  'High drama deserves speed, not noise.',
  'Fallback copy should stay grounded in runtime pressure.',
] as const);
const SYNDICATE_PANIC_TAGS = Object.freeze([
  'syndicate_panic',
  'alarm',
  'trust_stress',
  'liveops',
  'overlay',
  'world-event',
] as const);
const SYNDICATE_PANIC_MOUNT_BIAS: Readonly<Record<ChatBridgeMountTarget, number>> = Object.freeze({
  'PRIMARY_DOCK': 0.69,
  'COUNTERPLAY_MODAL': 0.57,
  'EMPIRE_BLEED_BANNER': 0.57,
  'MOMENT_FLASH': 0.22,
  'PROOF_CARD': 0.22,
  'PROOF_CARD_V2': 0.22,
  'RESCUE_WINDOW_BANNER': 0.22,
  'SABOTAGE_IMPACT_PANEL': 0.22,
  'THREAT_RADAR_PANEL': 0.22,
});
const SYNDICATE_PANIC_PROFILE: WorldEventOverlayKindProfile = Object.freeze({
  kind: 'SYNDICATE_PANIC',
  defaultTone: 'ALARM',
  defaultBadgeLabel: 'TRUST_STRESS',
  posture: 'TENSE',
  preferredMounts: Object.freeze(['PRIMARY_DOCK', 'COUNTERPLAY_MODAL', 'EMPIRE_BLEED_BANNER']) as readonly ChatBridgeMountTarget[],
  highPressureMounts: Object.freeze(['PRIMARY_DOCK', 'COUNTERPLAY_MODAL', 'EMPIRE_BLEED_BANNER']) as readonly ChatBridgeMountTarget[],
  bodyClauses: SYNDICATE_PANIC_BODY_CLAUSES,
  detailClauses: SYNDICATE_PANIC_DETAIL_CLAUSES,
  headlineSuffixes: SYNDICATE_PANIC_HEADLINE_SUFFIXES,
  tags: SYNDICATE_PANIC_TAGS,
  quietBias: 0.1,
  shadowBias: 0.1,
  ceremonyBias: 0.02,
  rescueBias: 0.18,
  debateBias: 0.04,
  threatBias: 0.06,
  proofBias: 0.05,
  mountBias: SYNDICATE_PANIC_MOUNT_BIAS,
  detailMode: 'BANNER',
  summaryNotes: SYNDICATE_PANIC_SUMMARY_NOTES,
});

const MARKET_RUMOR_BURST_BODY_CLAUSES = Object.freeze([
  'Rumor pressure is moving faster than verified proof.',
  'Public interpretation is drifting ahead of facts.',
  'This event should feel contagious rather than singular.',
  'Overlays should reveal spread and suspicion, not certainty.',
  'Rooms are reacting to narrative volatility more than direct attack.',
  'The system should show rumor spread without overstating certainty.',
] as const);
const MARKET_RUMOR_BURST_DETAIL_CLAUSES = Object.freeze([
  'Use language that suggests acceleration and crowd relay.',
  'Detail lines should distinguish rumor from confirmed loss.',
  'This event can animate bleed banners without hard interruption.',
  'Keep mounts broad but avoid treating every room as equally compromised.',
  'Shadow lanes can deepen suspicion even when the public line stays soft.',
  'Crowd heat should matter more than direct helper suppression here.',
] as const);
const MARKET_RUMOR_BURST_HEADLINE_SUFFIXES = Object.freeze([
  'pressure re-ordered the room',
  'the room is reclassifying risk',
  'witness is intensifying',
  'the world is not staying neutral',
  'channels are reacting unevenly',
  'shadow spill is now part of the story',
] as const);
const MARKET_RUMOR_BURST_SUMMARY_NOTES = Object.freeze([
  'Market Rumor Burst keeps its own presentation law.',
  'Projection should preserve visible-vs-shadow separation.',
  'Mount routing must remain deterministic under equal priority.',
  'Cards should explain why this event surfaced now.',
  'High drama deserves speed, not noise.',
  'Fallback copy should stay grounded in runtime pressure.',
] as const);
const MARKET_RUMOR_BURST_TAGS = Object.freeze([
  'market_rumor_burst',
  'surge',
  'rumor_field',
  'liveops',
  'overlay',
  'world-event',
] as const);
const MARKET_RUMOR_BURST_MOUNT_BIAS: Readonly<Record<ChatBridgeMountTarget, number>> = Object.freeze({
  'PRIMARY_DOCK': 0.69,
  'COUNTERPLAY_MODAL': 0.22,
  'EMPIRE_BLEED_BANNER': 0.66,
  'MOMENT_FLASH': 0.22,
  'PROOF_CARD': 0.22,
  'PROOF_CARD_V2': 0.22,
  'RESCUE_WINDOW_BANNER': 0.22,
  'SABOTAGE_IMPACT_PANEL': 0.57,
  'THREAT_RADAR_PANEL': 0.22,
});
const MARKET_RUMOR_BURST_PROFILE: WorldEventOverlayKindProfile = Object.freeze({
  kind: 'MARKET_RUMOR_BURST',
  defaultTone: 'SURGE',
  defaultBadgeLabel: 'RUMOR_FIELD',
  posture: 'TENSE',
  preferredMounts: Object.freeze(['PRIMARY_DOCK', 'EMPIRE_BLEED_BANNER', 'SABOTAGE_IMPACT_PANEL']) as readonly ChatBridgeMountTarget[],
  highPressureMounts: Object.freeze(['PRIMARY_DOCK', 'EMPIRE_BLEED_BANNER', 'SABOTAGE_IMPACT_PANEL']) as readonly ChatBridgeMountTarget[],
  bodyClauses: MARKET_RUMOR_BURST_BODY_CLAUSES,
  detailClauses: MARKET_RUMOR_BURST_DETAIL_CLAUSES,
  headlineSuffixes: MARKET_RUMOR_BURST_HEADLINE_SUFFIXES,
  tags: MARKET_RUMOR_BURST_TAGS,
  quietBias: 0.1,
  shadowBias: 0.18,
  ceremonyBias: 0.02,
  rescueBias: 0.04,
  debateBias: 0.14,
  threatBias: 0.06,
  proofBias: 0.05,
  mountBias: MARKET_RUMOR_BURST_MOUNT_BIAS,
  detailMode: 'STRIP',
  summaryNotes: MARKET_RUMOR_BURST_SUMMARY_NOTES,
});

const HELPER_BLACKOUT_BODY_CLAUSES = Object.freeze([
  'Helper intervention is being intentionally suppressed.',
  'The absence of rescue is part of the event, not a bug.',
  'Silence is the signal: expected support is not arriving.',
  'This overlay should make the missing helper posture legible.',
  'Negative cashflow or exposure should increase rescue emphasis.',
  'Players must understand that quiet is now hostile.',
] as const);
const HELPER_BLACKOUT_DETAIL_CLAUSES = Object.freeze([
  'Use concise, high-clarity copy.',
  'If rescue windows are available, surface them aggressively.',
  'Do not over-decorate; blackout events gain power through absence.',
  'Detail lines should call out intervention loss and channel suppression.',
  'Shadow projections should still exist even when public cards go spare.',
  'Pulse should be strong when the player is financially exposed.',
] as const);
const HELPER_BLACKOUT_HEADLINE_SUFFIXES = Object.freeze([
  'pressure re-ordered the room',
  'the room is reclassifying risk',
  'witness is intensifying',
  'the world is not staying neutral',
  'channels are reacting unevenly',
  'shadow spill is now part of the story',
] as const);
const HELPER_BLACKOUT_SUMMARY_NOTES = Object.freeze([
  'Helper Blackout keeps its own presentation law.',
  'Projection should preserve visible-vs-shadow separation.',
  'Mount routing must remain deterministic under equal priority.',
  'Cards should explain why this event surfaced now.',
  'High drama deserves speed, not noise.',
  'Fallback copy should stay grounded in runtime pressure.',
] as const);
const HELPER_BLACKOUT_TAGS = Object.freeze([
  'helper_blackout',
  'suppressed',
  'aid_denial',
  'liveops',
  'overlay',
  'world-event',
] as const);
const HELPER_BLACKOUT_MOUNT_BIAS: Readonly<Record<ChatBridgeMountTarget, number>> = Object.freeze({
  'PRIMARY_DOCK': 0.57,
  'COUNTERPLAY_MODAL': 0.57,
  'EMPIRE_BLEED_BANNER': 0.22,
  'MOMENT_FLASH': 0.22,
  'PROOF_CARD': 0.22,
  'PROOF_CARD_V2': 0.22,
  'RESCUE_WINDOW_BANNER': 0.85,
  'SABOTAGE_IMPACT_PANEL': 0.22,
  'THREAT_RADAR_PANEL': 0.22,
});
const HELPER_BLACKOUT_PROFILE: WorldEventOverlayKindProfile = Object.freeze({
  kind: 'HELPER_BLACKOUT',
  defaultTone: 'SUPPRESSED',
  defaultBadgeLabel: 'AID_DENIAL',
  posture: 'HOSTILE',
  preferredMounts: Object.freeze(['RESCUE_WINDOW_BANNER', 'PRIMARY_DOCK', 'COUNTERPLAY_MODAL']) as readonly ChatBridgeMountTarget[],
  highPressureMounts: Object.freeze(['RESCUE_WINDOW_BANNER', 'PRIMARY_DOCK', 'COUNTERPLAY_MODAL']) as readonly ChatBridgeMountTarget[],
  bodyClauses: HELPER_BLACKOUT_BODY_CLAUSES,
  detailClauses: HELPER_BLACKOUT_DETAIL_CLAUSES,
  headlineSuffixes: HELPER_BLACKOUT_HEADLINE_SUFFIXES,
  tags: HELPER_BLACKOUT_TAGS,
  quietBias: 0.2,
  shadowBias: 0.22,
  ceremonyBias: 0.02,
  rescueBias: 0.36,
  debateBias: 0.04,
  threatBias: 0.06,
  proofBias: 0.05,
  mountBias: HELPER_BLACKOUT_MOUNT_BIAS,
  detailMode: 'RESCUE',
  summaryNotes: HELPER_BLACKOUT_SUMMARY_NOTES,
});

const DOUBLE_HEAT_BODY_CLAUSES = Object.freeze([
  'Visible and shadow heat are both elevated.',
  'The room is watching harder and judging faster.',
  'Pressure is stacking across multiple channels at once.',
  'This event should feel cumulative, not singular.',
  'Public overlay copy should communicate layered exposure.',
  'The main UI job is to say the room got hotter everywhere.',
] as const);
const DOUBLE_HEAT_DETAIL_CLAUSES = Object.freeze([
  'Treat intensity as a multiplier, not just another badge.',
  'Body text should mention multiple fronts.',
  'Detail lines can name pressure categories rather than mechanics.',
  'If crowd heat is high, make the pulse class aggressive.',
  'Shadow lanes should retain their own severity, not collapse into public heat.',
  'Escalate mounts when active threats already exist.',
] as const);
const DOUBLE_HEAT_HEADLINE_SUFFIXES = Object.freeze([
  'pressure re-ordered the room',
  'the room is reclassifying risk',
  'witness is intensifying',
  'the world is not staying neutral',
  'channels are reacting unevenly',
  'shadow spill is now part of the story',
] as const);
const DOUBLE_HEAT_SUMMARY_NOTES = Object.freeze([
  'Double Heat keeps its own presentation law.',
  'Projection should preserve visible-vs-shadow separation.',
  'Mount routing must remain deterministic under equal priority.',
  'Cards should explain why this event surfaced now.',
  'High drama deserves speed, not noise.',
  'Fallback copy should stay grounded in runtime pressure.',
] as const);
const DOUBLE_HEAT_TAGS = Object.freeze([
  'double_heat',
  'alarm',
  'heat_stack',
  'liveops',
  'overlay',
  'world-event',
] as const);
const DOUBLE_HEAT_MOUNT_BIAS: Readonly<Record<ChatBridgeMountTarget, number>> = Object.freeze({
  'PRIMARY_DOCK': 0.69,
  'COUNTERPLAY_MODAL': 0.22,
  'EMPIRE_BLEED_BANNER': 0.22,
  'MOMENT_FLASH': 0.57,
  'PROOF_CARD': 0.22,
  'PROOF_CARD_V2': 0.22,
  'RESCUE_WINDOW_BANNER': 0.22,
  'SABOTAGE_IMPACT_PANEL': 0.22,
  'THREAT_RADAR_PANEL': 0.57,
});
const DOUBLE_HEAT_PROFILE: WorldEventOverlayKindProfile = Object.freeze({
  kind: 'DOUBLE_HEAT',
  defaultTone: 'ALARM',
  defaultBadgeLabel: 'HEAT_STACK',
  posture: 'TENSE',
  preferredMounts: Object.freeze(['PRIMARY_DOCK', 'MOMENT_FLASH', 'THREAT_RADAR_PANEL']) as readonly ChatBridgeMountTarget[],
  highPressureMounts: Object.freeze(['PRIMARY_DOCK', 'MOMENT_FLASH', 'THREAT_RADAR_PANEL']) as readonly ChatBridgeMountTarget[],
  bodyClauses: DOUBLE_HEAT_BODY_CLAUSES,
  detailClauses: DOUBLE_HEAT_DETAIL_CLAUSES,
  headlineSuffixes: DOUBLE_HEAT_HEADLINE_SUFFIXES,
  tags: DOUBLE_HEAT_TAGS,
  quietBias: 0.1,
  shadowBias: 0.1,
  ceremonyBias: 0.08,
  rescueBias: 0.04,
  debateBias: 0.04,
  threatBias: 0.18,
  proofBias: 0.05,
  mountBias: DOUBLE_HEAT_MOUNT_BIAS,
  detailMode: 'BANNER',
  summaryNotes: DOUBLE_HEAT_SUMMARY_NOTES,
});

const WHISPER_ONLY_BODY_CLAUSES = Object.freeze([
  'Public speech is intentionally thin while whispers deepen.',
  'This overlay should feel partial, withheld, and deliberate.',
  'The room knows something but is not saying it plainly.',
  'Whisper events should privilege shadow explanation over loud alerts.',
  'Public presentation can stay minimal while shadow channels stay dense.',
  'Silence and implication are the main mechanics here.',
] as const);
const WHISPER_ONLY_DETAIL_CLAUSES = Object.freeze([
  'Favor understated bodies with suggestive detail lines.',
  'Do not push moment flash unless severity is extreme.',
  'Public cards may exist only to imply missing context.',
  'When visible, pulse should stay restrained.',
  'Channel projections should emphasize shadow pressure over public pressure.',
  'Keep mounts selective to preserve tension.',
] as const);
const WHISPER_ONLY_HEADLINE_SUFFIXES = Object.freeze([
  'pressure re-ordered the room',
  'the room is reclassifying risk',
  'witness is intensifying',
  'the world is not staying neutral',
  'channels are reacting unevenly',
  'shadow spill is now part of the story',
] as const);
const WHISPER_ONLY_SUMMARY_NOTES = Object.freeze([
  'Whisper Only keeps its own presentation law.',
  'Projection should preserve visible-vs-shadow separation.',
  'Mount routing must remain deterministic under equal priority.',
  'Cards should explain why this event surfaced now.',
  'High drama deserves speed, not noise.',
  'Fallback copy should stay grounded in runtime pressure.',
] as const);
const WHISPER_ONLY_TAGS = Object.freeze([
  'whisper_only',
  'whisper',
  'rumor_veil',
  'liveops',
  'overlay',
  'world-event',
] as const);
const WHISPER_ONLY_MOUNT_BIAS: Readonly<Record<ChatBridgeMountTarget, number>> = Object.freeze({
  'PRIMARY_DOCK': 0.69,
  'COUNTERPLAY_MODAL': 0.57,
  'EMPIRE_BLEED_BANNER': 0.57,
  'MOMENT_FLASH': 0.22,
  'PROOF_CARD': 0.22,
  'PROOF_CARD_V2': 0.22,
  'RESCUE_WINDOW_BANNER': 0.22,
  'SABOTAGE_IMPACT_PANEL': 0.22,
  'THREAT_RADAR_PANEL': 0.22,
});
const WHISPER_ONLY_PROFILE: WorldEventOverlayKindProfile = Object.freeze({
  kind: 'WHISPER_ONLY',
  defaultTone: 'WHISPER',
  defaultBadgeLabel: 'RUMOR_VEIL',
  posture: 'WITHHELD',
  preferredMounts: Object.freeze(['PRIMARY_DOCK', 'EMPIRE_BLEED_BANNER', 'COUNTERPLAY_MODAL']) as readonly ChatBridgeMountTarget[],
  highPressureMounts: Object.freeze(['PRIMARY_DOCK', 'EMPIRE_BLEED_BANNER', 'COUNTERPLAY_MODAL']) as readonly ChatBridgeMountTarget[],
  bodyClauses: WHISPER_ONLY_BODY_CLAUSES,
  detailClauses: WHISPER_ONLY_DETAIL_CLAUSES,
  headlineSuffixes: WHISPER_ONLY_HEADLINE_SUFFIXES,
  tags: WHISPER_ONLY_TAGS,
  quietBias: 0.28,
  shadowBias: 0.32,
  ceremonyBias: 0.02,
  rescueBias: 0.04,
  debateBias: 0.04,
  threatBias: 0.06,
  proofBias: 0.05,
  mountBias: WHISPER_ONLY_MOUNT_BIAS,
  detailMode: 'SHADOW',
  summaryNotes: WHISPER_ONLY_SUMMARY_NOTES,
});

const FACTION_DEBATE_BODY_CLAUSES = Object.freeze([
  'Competing narratives are fighting in public.',
  'This event is best framed as argument pressure, not brute attack.',
  'Debate overlays should surface claims, factions, and contested meaning.',
  'The room is splitting around interpretation.',
  'Counterplay and proof surfaces matter because persuasion is active.',
  'This is a rhetorical pressure event.',
] as const);
const FACTION_DEBATE_DETAIL_CLAUSES = Object.freeze([
  'Prefer modal or proof support over pure warning banners.',
  'Detail lines can show dispute vectors and channel spread.',
  'Public presentation should feel argumentative, not panicked.',
  'Pulse should be moderate unless pressure bands move into severe territory.',
  'Body copy should imply competing camps rather than one attacker.',
  'Keep mounts suited to evidence and counterplay.',
] as const);
const FACTION_DEBATE_HEADLINE_SUFFIXES = Object.freeze([
  'pressure re-ordered the room',
  'the room is reclassifying risk',
  'witness is intensifying',
  'the world is not staying neutral',
  'channels are reacting unevenly',
  'shadow spill is now part of the story',
] as const);
const FACTION_DEBATE_SUMMARY_NOTES = Object.freeze([
  'Faction Debate keeps its own presentation law.',
  'Projection should preserve visible-vs-shadow separation.',
  'Mount routing must remain deterministic under equal priority.',
  'Cards should explain why this event surfaced now.',
  'High drama deserves speed, not noise.',
  'Fallback copy should stay grounded in runtime pressure.',
] as const);
const FACTION_DEBATE_TAGS = Object.freeze([
  'faction_debate',
  'debate',
  'public_argument',
  'liveops',
  'overlay',
  'world-event',
] as const);
const FACTION_DEBATE_MOUNT_BIAS: Readonly<Record<ChatBridgeMountTarget, number>> = Object.freeze({
  'PRIMARY_DOCK': 0.57,
  'COUNTERPLAY_MODAL': 0.84,
  'EMPIRE_BLEED_BANNER': 0.22,
  'MOMENT_FLASH': 0.22,
  'PROOF_CARD': 0.57,
  'PROOF_CARD_V2': 0.22,
  'RESCUE_WINDOW_BANNER': 0.22,
  'SABOTAGE_IMPACT_PANEL': 0.22,
  'THREAT_RADAR_PANEL': 0.22,
});
const FACTION_DEBATE_PROFILE: WorldEventOverlayKindProfile = Object.freeze({
  kind: 'FACTION_DEBATE',
  defaultTone: 'DEBATE',
  defaultBadgeLabel: 'PUBLIC_ARGUMENT',
  posture: 'ARGUMENTATIVE',
  preferredMounts: Object.freeze(['COUNTERPLAY_MODAL', 'PRIMARY_DOCK', 'PROOF_CARD']) as readonly ChatBridgeMountTarget[],
  highPressureMounts: Object.freeze(['COUNTERPLAY_MODAL', 'PRIMARY_DOCK', 'PROOF_CARD']) as readonly ChatBridgeMountTarget[],
  bodyClauses: FACTION_DEBATE_BODY_CLAUSES,
  detailClauses: FACTION_DEBATE_DETAIL_CLAUSES,
  headlineSuffixes: FACTION_DEBATE_HEADLINE_SUFFIXES,
  tags: FACTION_DEBATE_TAGS,
  quietBias: 0.12,
  shadowBias: 0.1,
  ceremonyBias: 0.02,
  rescueBias: 0.04,
  debateBias: 0.4,
  threatBias: 0.06,
  proofBias: 0.24,
  mountBias: FACTION_DEBATE_MOUNT_BIAS,
  detailMode: 'PANEL',
  summaryNotes: FACTION_DEBATE_SUMMARY_NOTES,
});

const COORDINATED_HATER_RAID_BODY_CLAUSES = Object.freeze([
  'Multiple hostile actors are pressing at once.',
  'This is not isolated negativity; it is coordinated pressure.',
  'Raid events justify the fastest visible escalation.',
  'The player should feel surrounded, not merely criticized.',
  'Threat surfaces need immediate emphasis.',
  'Public copy can be blunt because ambiguity weakens the signal.',
] as const);
const COORDINATED_HATER_RAID_DETAIL_CLAUSES = Object.freeze([
  'Escalate severity rapidly when crowd heat also rises.',
  'Pulse should be hard unless whisper-only rules apply.',
  'Detail lines should clarify coordination and channel spread.',
  'Mount advice should prioritize threat radar and primary dock.',
  'Secondary cards may still matter for spillover channels.',
  'Keep detail copy direct and short.',
] as const);
const COORDINATED_HATER_RAID_HEADLINE_SUFFIXES = Object.freeze([
  'pressure re-ordered the room',
  'the room is reclassifying risk',
  'witness is intensifying',
  'the world is not staying neutral',
  'channels are reacting unevenly',
  'shadow spill is now part of the story',
] as const);
const COORDINATED_HATER_RAID_SUMMARY_NOTES = Object.freeze([
  'Coordinated Hater Raid keeps its own presentation law.',
  'Projection should preserve visible-vs-shadow separation.',
  'Mount routing must remain deterministic under equal priority.',
  'Cards should explain why this event surfaced now.',
  'High drama deserves speed, not noise.',
  'Fallback copy should stay grounded in runtime pressure.',
] as const);
const COORDINATED_HATER_RAID_TAGS = Object.freeze([
  'coordinated_hater_raid',
  'predatory',
  'raid_grid',
  'liveops',
  'overlay',
  'world-event',
] as const);
const COORDINATED_HATER_RAID_MOUNT_BIAS: Readonly<Record<ChatBridgeMountTarget, number>> = Object.freeze({
  'PRIMARY_DOCK': 0.57,
  'COUNTERPLAY_MODAL': 0.22,
  'EMPIRE_BLEED_BANNER': 0.22,
  'MOMENT_FLASH': 0.57,
  'PROOF_CARD': 0.22,
  'PROOF_CARD_V2': 0.22,
  'RESCUE_WINDOW_BANNER': 0.22,
  'SABOTAGE_IMPACT_PANEL': 0.22,
  'THREAT_RADAR_PANEL': 0.83,
});
const COORDINATED_HATER_RAID_PROFILE: WorldEventOverlayKindProfile = Object.freeze({
  kind: 'COORDINATED_HATER_RAID',
  defaultTone: 'PREDATORY',
  defaultBadgeLabel: 'RAID_GRID',
  posture: 'PREDATORY',
  preferredMounts: Object.freeze(['THREAT_RADAR_PANEL', 'PRIMARY_DOCK', 'MOMENT_FLASH']) as readonly ChatBridgeMountTarget[],
  highPressureMounts: Object.freeze(['THREAT_RADAR_PANEL', 'PRIMARY_DOCK', 'MOMENT_FLASH']) as readonly ChatBridgeMountTarget[],
  bodyClauses: COORDINATED_HATER_RAID_BODY_CLAUSES,
  detailClauses: COORDINATED_HATER_RAID_DETAIL_CLAUSES,
  headlineSuffixes: COORDINATED_HATER_RAID_HEADLINE_SUFFIXES,
  tags: COORDINATED_HATER_RAID_TAGS,
  quietBias: 0.1,
  shadowBias: 0.1,
  ceremonyBias: 0.02,
  rescueBias: 0.04,
  debateBias: 0.04,
  threatBias: 0.38,
  proofBias: 0.05,
  mountBias: COORDINATED_HATER_RAID_MOUNT_BIAS,
  detailMode: 'TACTICAL',
  summaryNotes: COORDINATED_HATER_RAID_SUMMARY_NOTES,
});

const LOW_SHIELD_HUNT_BODY_CLAUSES = Object.freeze([
  'Low defensive posture is attracting hostile attention.',
  'This event should feel like predators smelling weakness.',
  'Players need to see both danger and the path to stabilization.',
  'Rescue and threat surfaces should activate together when possible.',
  'The room is hunting on vulnerability, not just timing.',
  'Copy should frame exposure clearly.',
] as const);
const LOW_SHIELD_HUNT_DETAIL_CLAUSES = Object.freeze([
  'Sticky behavior is appropriate for low-shield hunts.',
  'If cashflow is bad, rescue emphasis increases further.',
  'Detail lines should mention defensive weakness and audience behavior.',
  'Keep threat radar active even when public card volume is low.',
  'Pulse should stay high until pressure drops.',
  'Body copy should imply vulnerability without overexplaining mechanics.',
] as const);
const LOW_SHIELD_HUNT_HEADLINE_SUFFIXES = Object.freeze([
  'pressure re-ordered the room',
  'the room is reclassifying risk',
  'witness is intensifying',
  'the world is not staying neutral',
  'channels are reacting unevenly',
  'shadow spill is now part of the story',
] as const);
const LOW_SHIELD_HUNT_SUMMARY_NOTES = Object.freeze([
  'Low Shield Hunt keeps its own presentation law.',
  'Projection should preserve visible-vs-shadow separation.',
  'Mount routing must remain deterministic under equal priority.',
  'Cards should explain why this event surfaced now.',
  'High drama deserves speed, not noise.',
  'Fallback copy should stay grounded in runtime pressure.',
] as const);
const LOW_SHIELD_HUNT_TAGS = Object.freeze([
  'low_shield_hunt',
  'predatory',
  'breach_scent',
  'liveops',
  'overlay',
  'world-event',
] as const);
const LOW_SHIELD_HUNT_MOUNT_BIAS: Readonly<Record<ChatBridgeMountTarget, number>> = Object.freeze({
  'PRIMARY_DOCK': 0.57,
  'COUNTERPLAY_MODAL': 0.22,
  'EMPIRE_BLEED_BANNER': 0.22,
  'MOMENT_FLASH': 0.22,
  'PROOF_CARD': 0.22,
  'PROOF_CARD_V2': 0.22,
  'RESCUE_WINDOW_BANNER': 0.57,
  'SABOTAGE_IMPACT_PANEL': 0.22,
  'THREAT_RADAR_PANEL': 0.83,
});
const LOW_SHIELD_HUNT_PROFILE: WorldEventOverlayKindProfile = Object.freeze({
  kind: 'LOW_SHIELD_HUNT',
  defaultTone: 'PREDATORY',
  defaultBadgeLabel: 'BREACH_SCENT',
  posture: 'PREDATORY',
  preferredMounts: Object.freeze(['THREAT_RADAR_PANEL', 'RESCUE_WINDOW_BANNER', 'PRIMARY_DOCK']) as readonly ChatBridgeMountTarget[],
  highPressureMounts: Object.freeze(['THREAT_RADAR_PANEL', 'RESCUE_WINDOW_BANNER', 'PRIMARY_DOCK', 'MOMENT_FLASH']) as readonly ChatBridgeMountTarget[],
  bodyClauses: LOW_SHIELD_HUNT_BODY_CLAUSES,
  detailClauses: LOW_SHIELD_HUNT_DETAIL_CLAUSES,
  headlineSuffixes: LOW_SHIELD_HUNT_HEADLINE_SUFFIXES,
  tags: LOW_SHIELD_HUNT_TAGS,
  quietBias: 0.1,
  shadowBias: 0.1,
  ceremonyBias: 0.02,
  rescueBias: 0.24,
  debateBias: 0.04,
  threatBias: 0.34,
  proofBias: 0.05,
  mountBias: LOW_SHIELD_HUNT_MOUNT_BIAS,
  detailMode: 'TACTICAL',
  summaryNotes: LOW_SHIELD_HUNT_SUMMARY_NOTES,
});

const LEGEND_SPOTLIGHT_BODY_CLAUSES = Object.freeze([
  'The world is turning this moment into legend.',
  'This is the most ceremonial of the core event families.',
  'Spotlight events should feel elevated, visible, and memorable.',
  'Proof surfaces deserve emphasis because witness matters here.',
  'The room is not only reacting; it is recording.',
  'Presentation should feel authored without losing urgency.',
] as const);
const LEGEND_SPOTLIGHT_DETAIL_CLAUSES = Object.freeze([
  'Prefer proof and ceremonial mounts over threat-first framing.',
  'Body copy should elevate witness and consequence.',
  'Detail lines can mention attention, myth, and amplification.',
  'Pulse may be present, but rhythm should stay stately.',
  'If the option prefers ceremonial legend charge, honor it.',
  'Do not flatten legend events into generic success banners.',
] as const);
const LEGEND_SPOTLIGHT_HEADLINE_SUFFIXES = Object.freeze([
  'pressure re-ordered the room',
  'the room is reclassifying risk',
  'witness is intensifying',
  'the world is not staying neutral',
  'channels are reacting unevenly',
  'shadow spill is now part of the story',
] as const);
const LEGEND_SPOTLIGHT_SUMMARY_NOTES = Object.freeze([
  'Legend Spotlight keeps its own presentation law.',
  'Projection should preserve visible-vs-shadow separation.',
  'Mount routing must remain deterministic under equal priority.',
  'Cards should explain why this event surfaced now.',
  'High drama deserves speed, not noise.',
  'Fallback copy should stay grounded in runtime pressure.',
] as const);
const LEGEND_SPOTLIGHT_TAGS = Object.freeze([
  'legend_spotlight',
  'ceremonial',
  'legend_aura',
  'liveops',
  'overlay',
  'world-event',
] as const);
const LEGEND_SPOTLIGHT_MOUNT_BIAS: Readonly<Record<ChatBridgeMountTarget, number>> = Object.freeze({
  'PRIMARY_DOCK': 0.57,
  'COUNTERPLAY_MODAL': 0.22,
  'EMPIRE_BLEED_BANNER': 0.22,
  'MOMENT_FLASH': 0.22,
  'PROOF_CARD': 0.72,
  'PROOF_CARD_V2': 0.84,
  'RESCUE_WINDOW_BANNER': 0.22,
  'SABOTAGE_IMPACT_PANEL': 0.22,
  'THREAT_RADAR_PANEL': 0.22,
});
const LEGEND_SPOTLIGHT_PROFILE: WorldEventOverlayKindProfile = Object.freeze({
  kind: 'LEGEND_SPOTLIGHT',
  defaultTone: 'CEREMONIAL',
  defaultBadgeLabel: 'LEGEND_AURA',
  posture: 'CEREMONIAL',
  preferredMounts: Object.freeze(['PROOF_CARD_V2', 'PROOF_CARD', 'PRIMARY_DOCK']) as readonly ChatBridgeMountTarget[],
  highPressureMounts: Object.freeze(['PROOF_CARD_V2', 'PROOF_CARD', 'PRIMARY_DOCK']) as readonly ChatBridgeMountTarget[],
  bodyClauses: LEGEND_SPOTLIGHT_BODY_CLAUSES,
  detailClauses: LEGEND_SPOTLIGHT_DETAIL_CLAUSES,
  headlineSuffixes: LEGEND_SPOTLIGHT_HEADLINE_SUFFIXES,
  tags: LEGEND_SPOTLIGHT_TAGS,
  quietBias: 0.08,
  shadowBias: 0.1,
  ceremonyBias: 0.4,
  rescueBias: 0.04,
  debateBias: 0.04,
  threatBias: 0.06,
  proofBias: 0.38,
  mountBias: LEGEND_SPOTLIGHT_MOUNT_BIAS,
  detailMode: 'PROOF',
  summaryNotes: LEGEND_SPOTLIGHT_SUMMARY_NOTES,
});

const RIVALRY_ESCALATION_BODY_CLAUSES = Object.freeze([
  "A rivalry is becoming the room's organizing story.",
  'Escalation here is personal, remembered, and sticky.',
  'The player should feel targeted by identity, not only by risk.',
  'Rivalry overlays should foreground witness and repeat friction.',
  'The room is aligning around a feud.',
  'This event can sit between alarm and debate depending on pressure.',
] as const);
const RIVALRY_ESCALATION_DETAIL_CLAUSES = Object.freeze([
  'Detail lines should surface repetition, callback, or targeted hostility.',
  'Use counterplay surfaces when agency still exists.',
  'If severity spikes, threat radar may outrank modal surfaces.',
  'Body copy should feel personal rather than purely systemic.',
  'Public presentation can be sharper than whisper events but less blunt than raids.',
  'Preserve continuity language where possible.',
] as const);
const RIVALRY_ESCALATION_HEADLINE_SUFFIXES = Object.freeze([
  'pressure re-ordered the room',
  'the room is reclassifying risk',
  'witness is intensifying',
  'the world is not staying neutral',
  'channels are reacting unevenly',
  'shadow spill is now part of the story',
] as const);
const RIVALRY_ESCALATION_SUMMARY_NOTES = Object.freeze([
  'Rivalry Escalation keeps its own presentation law.',
  'Projection should preserve visible-vs-shadow separation.',
  'Mount routing must remain deterministic under equal priority.',
  'Cards should explain why this event surfaced now.',
  'High drama deserves speed, not noise.',
  'Fallback copy should stay grounded in runtime pressure.',
] as const);
const RIVALRY_ESCALATION_TAGS = Object.freeze([
  'rivalry_escalation',
  'alarm',
  'personal_feud',
  'liveops',
  'overlay',
  'world-event',
] as const);
const RIVALRY_ESCALATION_MOUNT_BIAS: Readonly<Record<ChatBridgeMountTarget, number>> = Object.freeze({
  'PRIMARY_DOCK': 0.69,
  'COUNTERPLAY_MODAL': 0.57,
  'EMPIRE_BLEED_BANNER': 0.22,
  'MOMENT_FLASH': 0.22,
  'PROOF_CARD': 0.22,
  'PROOF_CARD_V2': 0.22,
  'RESCUE_WINDOW_BANNER': 0.22,
  'SABOTAGE_IMPACT_PANEL': 0.22,
  'THREAT_RADAR_PANEL': 0.57,
});
const RIVALRY_ESCALATION_PROFILE: WorldEventOverlayKindProfile = Object.freeze({
  kind: 'RIVALRY_ESCALATION',
  defaultTone: 'ALARM',
  defaultBadgeLabel: 'PERSONAL_FEUD',
  posture: 'TENSE',
  preferredMounts: Object.freeze(['PRIMARY_DOCK', 'COUNTERPLAY_MODAL', 'THREAT_RADAR_PANEL']) as readonly ChatBridgeMountTarget[],
  highPressureMounts: Object.freeze(['PRIMARY_DOCK', 'COUNTERPLAY_MODAL', 'THREAT_RADAR_PANEL']) as readonly ChatBridgeMountTarget[],
  bodyClauses: RIVALRY_ESCALATION_BODY_CLAUSES,
  detailClauses: RIVALRY_ESCALATION_DETAIL_CLAUSES,
  headlineSuffixes: RIVALRY_ESCALATION_HEADLINE_SUFFIXES,
  tags: RIVALRY_ESCALATION_TAGS,
  quietBias: 0.1,
  shadowBias: 0.15,
  ceremonyBias: 0.02,
  rescueBias: 0.04,
  debateBias: 0.18,
  threatBias: 0.06,
  proofBias: 0.16,
  mountBias: RIVALRY_ESCALATION_MOUNT_BIAS,
  detailMode: 'BANNER',
  summaryNotes: RIVALRY_ESCALATION_SUMMARY_NOTES,
});

const CUSTOM_BODY_CLAUSES = Object.freeze([
  'A custom authored world condition is active.',
  'Custom events should still obey the overlay grammar.',
  'Presentation should stay legible even when the content is bespoke.',
  'Unknown events need strong explainability surfaces.',
  'The system should not collapse custom logic into generic fallback text.',
  'Authorial intent matters, but deterministic mounts still apply.',
] as const);
const CUSTOM_DETAIL_CLAUSES = Object.freeze([
  'Use registry-aware fallback descriptions.',
  'Detail lines should expose visible and shadow reach.',
  'Severity should remain derived from runtime pressure, not arbitrary labeling.',
  'Body copy should stay grounded in audience and channel effects.',
  'Fallback mounts should prioritize primary dock unless stronger evidence exists.',
  'Custom does not mean vague.',
] as const);
const CUSTOM_HEADLINE_SUFFIXES = Object.freeze([
  'pressure re-ordered the room',
  'the room is reclassifying risk',
  'witness is intensifying',
  'the world is not staying neutral',
  'channels are reacting unevenly',
  'shadow spill is now part of the story',
] as const);
const CUSTOM_SUMMARY_NOTES = Object.freeze([
  'Custom keeps its own presentation law.',
  'Projection should preserve visible-vs-shadow separation.',
  'Mount routing must remain deterministic under equal priority.',
  'Cards should explain why this event surfaced now.',
  'High drama deserves speed, not noise.',
  'Fallback copy should stay grounded in runtime pressure.',
] as const);
const CUSTOM_TAGS = Object.freeze([
  'custom',
  'surge',
  'custom_field',
  'liveops',
  'overlay',
  'world-event',
] as const);
const CUSTOM_MOUNT_BIAS: Readonly<Record<ChatBridgeMountTarget, number>> = Object.freeze({
  'PRIMARY_DOCK': 0.69,
  'COUNTERPLAY_MODAL': 0.57,
  'EMPIRE_BLEED_BANNER': 0.57,
  'MOMENT_FLASH': 0.22,
  'PROOF_CARD': 0.22,
  'PROOF_CARD_V2': 0.22,
  'RESCUE_WINDOW_BANNER': 0.22,
  'SABOTAGE_IMPACT_PANEL': 0.22,
  'THREAT_RADAR_PANEL': 0.22,
});
const CUSTOM_PROFILE: WorldEventOverlayKindProfile = Object.freeze({
  kind: 'CUSTOM',
  defaultTone: 'SURGE',
  defaultBadgeLabel: 'CUSTOM_FIELD',
  posture: 'TENSE',
  preferredMounts: Object.freeze(['PRIMARY_DOCK', 'COUNTERPLAY_MODAL', 'EMPIRE_BLEED_BANNER']) as readonly ChatBridgeMountTarget[],
  highPressureMounts: Object.freeze(['PRIMARY_DOCK', 'COUNTERPLAY_MODAL', 'EMPIRE_BLEED_BANNER']) as readonly ChatBridgeMountTarget[],
  bodyClauses: CUSTOM_BODY_CLAUSES,
  detailClauses: CUSTOM_DETAIL_CLAUSES,
  headlineSuffixes: CUSTOM_HEADLINE_SUFFIXES,
  tags: CUSTOM_TAGS,
  quietBias: 0.1,
  shadowBias: 0.1,
  ceremonyBias: 0.05,
  rescueBias: 0.04,
  debateBias: 0.04,
  threatBias: 0.06,
  proofBias: 0.08,
  mountBias: CUSTOM_MOUNT_BIAS,
  detailMode: 'STRIP',
  summaryNotes: CUSTOM_SUMMARY_NOTES,
});

const KIND_PROFILES: Readonly<Record<ChatWorldEventKind, WorldEventOverlayKindProfile>> = Object.freeze({
  'PREDATOR_SWEEP': PREDATOR_SWEEP_PROFILE,
  'SYNDICATE_PANIC': SYNDICATE_PANIC_PROFILE,
  'MARKET_RUMOR_BURST': MARKET_RUMOR_BURST_PROFILE,
  'HELPER_BLACKOUT': HELPER_BLACKOUT_PROFILE,
  'DOUBLE_HEAT': DOUBLE_HEAT_PROFILE,
  'WHISPER_ONLY': WHISPER_ONLY_PROFILE,
  'FACTION_DEBATE': FACTION_DEBATE_PROFILE,
  'COORDINATED_HATER_RAID': COORDINATED_HATER_RAID_PROFILE,
  'LOW_SHIELD_HUNT': LOW_SHIELD_HUNT_PROFILE,
  'LEGEND_SPOTLIGHT': LEGEND_SPOTLIGHT_PROFILE,
  'RIVALRY_ESCALATION': RIVALRY_ESCALATION_PROFILE,
  'CUSTOM': CUSTOM_PROFILE,
});


function clamp01(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function stableNumber(value: number | null | undefined, fallback = 0): number {
  return Number.isFinite(value ?? NaN) ? Number(value) : fallback;
}

function sum(values: readonly number[]): number {
  let total = 0;
  for (const value of values) {
    total += stableNumber(value);
  }
  return total;
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return sum(values) / values.length;
}

function uniqueStrings<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values.filter((value): value is T => value.length > 0))]);
}

function compactStrings(values: readonly (string | null | undefined)[]): readonly string[] {
  return Object.freeze(values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0).map((value) => value.trim()));
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}

function sortNumbersDescending(left: number, right: number): number {
  return right - left;
}

function coerceVisibilityMode(event: SeasonalChatEventRuntimeState): ChatWorldEventVisibilityMode {
  const disposition = String(event.visibilityDisposition ?? '');
  if (event.summary.shadowOnly || (!event.preview.visible && event.targeting.visibleChannels.length === 0 && event.targeting.shadowChannels.length > 0)) {
    return 'SHADOW_ONLY';
  }
  if (disposition.includes('REVEAL')) {
    return 'REVEAL_LATER';
  }
  if (event.preview.visible && event.targeting.shadowChannels.length > 0) {
    return 'PUBLIC_WITH_SHADOW';
  }
  if (event.preview.visible) {
    return 'PUBLIC';
  }
  if (event.targeting.visibleChannels.length === 0 && event.targeting.shadowChannels.length === 0) {
    return 'OPERATOR_HIDDEN';
  }
  return 'SHADOW_ONLY';
}

function coercePublicness(visibilityMode: ChatWorldEventVisibilityMode): LiveOpsOverlayPublicness {
  switch (visibilityMode) {
    case 'PUBLIC':
      return 'PUBLIC';
    case 'PUBLIC_WITH_SHADOW':
      return 'HYBRID';
    case 'SHADOW_ONLY':
    case 'REVEAL_LATER':
      return 'SHADOW';
    case 'OPERATOR_HIDDEN':
    default:
      return 'HIDDEN';
  }
}

function normalizeSeverity(priority: number): ChatBridgeSeverity {
  if (priority >= 0.86) {
    return 'CRITICAL';
  }
  if (priority >= 0.56) {
    return 'WARNING';
  }
  if (priority <= 0.18) {
    return 'SUCCESS';
  }
  return 'INFO';
}

function severityWeight(severity: ChatBridgeSeverity): number {
  switch (severity) {
    case 'CRITICAL':
      return 1;
    case 'WARNING':
      return 0.66;
    case 'INFO':
      return 0.4;
    case 'SUCCESS':
    default:
      return 0.22;
  }
}

function chooseSummaryIntensityWeight(summary: ChatLiveOpsSummary): number {
  switch (summary.dominantIntensity) {
    case 'WORLD_CLASS':
      return 1;
    case 'SEVERE':
      return 0.76;
    case 'ACTIVE':
      return 0.52;
    case 'QUIET':
      return 0.22;
    case 'NONE':
    default:
      return 0;
  }
}

function chooseUrgencyBand(score: number): LiveOpsOverlayUrgencyBand {
  if (score >= 0.92) {
    return 'FLASHPOINT';
  }
  if (score >= 0.72) {
    return 'HOT';
  }
  if (score >= 0.48) {
    return 'ACTIVE';
  }
  if (score >= 0.2) {
    return 'WATCH';
  }
  return 'DORMANT';
}

function pulseForPriority(priorityScore: number, tone: LiveOpsOverlayTone): LiveOpsOverlayPulseClass {
  if (tone === 'WHISPER') {
    return priorityScore >= 0.72 ? 'STEADY' : 'SOFT';
  }
  if (tone === 'SUPPRESSED') {
    return priorityScore >= 0.64 ? 'STEADY' : 'SOFT';
  }
  if (priorityScore >= 0.95) {
    return 'SIREN';
  }
  if (priorityScore >= 0.74) {
    return 'HARD';
  }
  if (priorityScore >= 0.46) {
    return 'STEADY';
  }
  if (priorityScore >= 0.22) {
    return 'SOFT';
  }
  return 'NONE';
}

function isWarmupVisible(event: SeasonalChatEventRuntimeState, options: Required<WorldEventOverlayPolicyOptions>): boolean {
  return options.showWarmupCards || event.lifecycle !== 'WARMUP';
}

function shouldPreferCeremonialLegendCharge(
  event: SeasonalChatEventRuntimeState,
  options: Required<WorldEventOverlayPolicyOptions>,
): boolean {
  return options.preferCeremonialForLegendCharge && event.preview.kind === 'LEGEND_SPOTLIGHT';
}

function deriveTone(event: SeasonalChatEventRuntimeState, options: Required<WorldEventOverlayPolicyOptions>): LiveOpsOverlayTone {
  const profile = KIND_PROFILES[event.preview.kind];
  if (shouldPreferCeremonialLegendCharge(event, options)) {
    return 'CEREMONIAL';
  }
  if (event.helperSuppressionScore >= 0.82 && event.preview.kind !== 'LEGEND_SPOTLIGHT') {
    return 'SUPPRESSED';
  }
  if (event.audience.shadowPressure > event.audience.visiblePressure + 0.24 && event.preview.kind !== 'COORDINATED_HATER_RAID') {
    return 'WHISPER';
  }
  if (event.visiblePriority >= 0.9 && profile.defaultTone === 'SURGE') {
    return 'ALARM';
  }
  return profile.defaultTone;
}

function describeVisibilityMode(visibilityMode: ChatWorldEventVisibilityMode): string {
  switch (visibilityMode) {
    case 'PUBLIC':
      return 'publicly legible';
    case 'PUBLIC_WITH_SHADOW':
      return 'publicly legible with shadow spill';
    case 'SHADOW_ONLY':
      return 'shadow-only';
    case 'REVEAL_LATER':
      return 'held for reveal';
    case 'OPERATOR_HIDDEN':
    default:
      return 'operator hidden';
  }
}

function buildKindFallbackDescription(kind: ChatWorldEventKind): string {
  const found = CHAT_WORLD_EVENT_REGISTRY_MANIFEST.kinds.find((entry) => entry === kind);
  return found ? titleCase(found) : 'Custom world event';
}

export function describeWorldEventKindForUi(kind: SeasonalChatEventRuntimeState['preview']['kind']): string {
  return buildKindFallbackDescription(kind);
}

function buildBadge(
  label: string,
  tone: LiveOpsOverlayTone,
  severity: ChatBridgeSeverity,
  explanation: string,
): ChatWorldEventOverlayBadge {
  return Object.freeze({
    badgeId: `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}:${tone}:${severity}`,
    label,
    tone,
    severity,
    explanation,
  });
}

function channelProjectionFor(
  snapshot: SeasonalChatEventDirectorSnapshot,
  channelId: ChatChannelId,
) {
  return snapshot.diagnostics.channelProjections.find((projection) => projection.channelId === channelId) ?? null;
}

function mountProjectionFor(
  snapshot: SeasonalChatEventDirectorSnapshot,
  mount: ChatBridgeMountTarget,
) {
  return snapshot.diagnostics.mountProjections.find((projection) => projection.target === mount) ?? null;
}

function runtimeThreatWeight(runtime: ChatBridgeRuntimeSnapshot): number {
  const threatCards = stableNumber(runtime.activeThreatCardCount, 0);
  const haterHeat = clamp01(stableNumber(runtime.haterHeat, 0));
  const cashflowPenalty = stableNumber(runtime.cashflow, 0) < 0 ? 0.12 : 0;
  return clamp01((threatCards * 0.08) + (haterHeat * 0.34) + cashflowPenalty);
}


function bodyClauseFor(profile: WorldEventOverlayKindProfile, event: SeasonalChatEventRuntimeState): string {
  const index = Math.abs(Math.floor((stableNumber(event.visiblePriority) + stableNumber(event.shadowPriority) + stableNumber(event.urgencyScore)) * 1000)) % profile.bodyClauses.length;
  return profile.bodyClauses[index] ?? profile.bodyClauses[0] ?? 'World pressure is active.';
}

function headlineSuffixFor(profile: WorldEventOverlayKindProfile, event: SeasonalChatEventRuntimeState): string {
  const index = Math.abs(Math.floor((stableNumber(event.pressureScore) + stableNumber(event.noveltyScore)) * 1000)) % profile.headlineSuffixes.length;
  return profile.headlineSuffixes[index] ?? profile.headlineSuffixes[0] ?? 'pressure is active';
}

function detailClausesFor(profile: WorldEventOverlayKindProfile, budget: number): readonly string[] {
  return Object.freeze(profile.detailClauses.slice(0, Math.max(0, budget)));
}

function computePriorityScore(
  event: SeasonalChatEventRuntimeState,
  snapshot: SeasonalChatEventDirectorSnapshot,
  options: Required<WorldEventOverlayPolicyOptions>,
  tone: LiveOpsOverlayTone,
  visibilityMode: ChatWorldEventVisibilityMode,
): number {
  const profile = KIND_PROFILES[event.preview.kind];
  const toneProfile = TONE_PROFILES[tone];
  const intensityWeight = chooseSummaryIntensityWeight(snapshot.summary);
  const base =
    (clamp01(event.visiblePriority) * options.visiblePriorityWeight)
    + (clamp01(event.shadowPriority) * options.shadowPriorityWeight)
    + (clamp01(event.pressureScore) * options.pressureWeight)
    + (clamp01(event.urgencyScore) * options.urgencyWeight)
    + (clamp01(event.noveltyScore) * options.noveltyWeight)
    + (clamp01(event.audience.attentionWeight) * options.audienceWeight)
    + (PRESSURE_BAND_WEIGHTS[event.summary.pressureBand] * 0.12)
    + (ANNOUNCEMENT_MODE_WEIGHTS[event.preview.announcementMode] * 0.08)
    + (VISIBILITY_MODE_WEIGHTS[visibilityMode] * 0.1)
    + (intensityWeight * 0.08)
    + (runtimeThreatWeight(snapshot.runtime) * 0.07)
    + toneProfile.stickyBias
    + profile.quietBias * (event.preview.visible ? 0 : 0.18);
  return clamp01(base);
}

function computePublicPriorityScore(
  event: SeasonalChatEventRuntimeState,
  visibilityMode: ChatWorldEventVisibilityMode,
  priorityScore: number,
): number {
  if (visibilityMode === 'SHADOW_ONLY') {
    return clamp01(priorityScore * 0.42);
  }
  if (visibilityMode === 'REVEAL_LATER') {
    return clamp01(priorityScore * 0.72);
  }
  if (visibilityMode === 'OPERATOR_HIDDEN') {
    return clamp01(priorityScore * 0.18);
  }
  if (visibilityMode === 'PUBLIC_WITH_SHADOW') {
    return clamp01(priorityScore * 0.94);
  }
  return clamp01(priorityScore);
}

function computeShadowPriorityScore(
  event: SeasonalChatEventRuntimeState,
  options: Required<WorldEventOverlayPolicyOptions>,
  tone: LiveOpsOverlayTone,
): number {
  const profile = KIND_PROFILES[event.preview.kind];
  const toneProfile = TONE_PROFILES[tone];
  const raw =
    (clamp01(event.shadowPriority) * 0.46)
    + (clamp01(event.audience.shadowPressure) * 0.22)
    + (clamp01(event.helperSuppressionScore) * 0.1)
    + (clamp01(event.crowdHeatScore) * 0.08)
    + profile.shadowBias
    + toneProfile.shadowBias;
  return clamp01(raw * options.shadowAttenuation);
}

function shouldBeSticky(
  event: SeasonalChatEventRuntimeState,
  severity: ChatBridgeSeverity,
  priorityScore: number,
): boolean {
  return severity === 'CRITICAL'
    || priorityScore >= 0.9
    || event.preview.kind === 'LOW_SHIELD_HUNT'
    || event.preview.kind === 'HELPER_BLACKOUT'
    || event.preview.kind === 'COORDINATED_HATER_RAID';
}

function shouldBeDismissible(
  event: SeasonalChatEventRuntimeState,
  tone: LiveOpsOverlayTone,
  severity: ChatBridgeSeverity,
): boolean {
  if (tone === 'SUPPRESSED' || event.preview.kind === 'LOW_SHIELD_HUNT') {
    return false;
  }
  if (severity === 'CRITICAL' && event.audience.visiblePressure >= 0.8) {
    return false;
  }
  return true;
}

function shouldPulse(
  tone: LiveOpsOverlayTone,
  pulseClass: LiveOpsOverlayPulseClass,
): boolean {
  return tone !== 'WHISPER' && tone !== 'CEREMONIAL' ? pulseClass !== 'NONE' : pulseClass === 'HARD' || pulseClass === 'SIREN';
}

function coerceBody(
  event: SeasonalChatEventRuntimeState,
  profile: WorldEventOverlayKindProfile,
  snapshot: SeasonalChatEventDirectorSnapshot,
  publicness: LiveOpsOverlayPublicness,
): string {
  const parts = compactStrings([
    bodyClauseFor(profile, event),
    publicness === 'SHADOW'
      ? 'The loudest part of this event is happening off the main stage.'
      : publicness === 'HYBRID'
        ? 'Public witness is active, but shadow channels are carrying extra pressure.'
        : null,
    event.helperSuppressionScore >= 0.7 ? 'Helper posture is suppressed.' : null,
    event.crowdHeatScore >= 0.74 ? 'Crowd heat is amplifying interpretation.' : null,
    snapshot.summary.doubleHeatChannels.length > 0 && event.preview.kind === 'DOUBLE_HEAT'
      ? `Double-heat channels: ${snapshot.summary.doubleHeatChannels.length}.`
      : null,
  ]);
  return parts.join(' ');
}

function buildDetailLines(
  event: SeasonalChatEventRuntimeState,
  snapshot: SeasonalChatEventDirectorSnapshot,
  options: Required<WorldEventOverlayPolicyOptions>,
  profile: WorldEventOverlayKindProfile,
  severity: ChatBridgeSeverity,
  visibilityMode: ChatWorldEventVisibilityMode,
  publicness: LiveOpsOverlayPublicness,
): readonly string[] {
  const budget = publicness === 'SHADOW'
    ? options.shadowDetailLineBudget
    : severity === 'CRITICAL'
      ? options.primaryDetailLineBudget
      : options.secondaryDetailLineBudget;

  const detailLines = compactStrings([
    ...detailClausesFor(profile, Math.max(1, budget - 4)),
    `${buildKindFallbackDescription(event.preview.kind)} is ${describeVisibilityMode(visibilityMode)}.`,
    `Visible channels: ${event.targeting.visibleChannels.length}. Shadow channels: ${event.targeting.shadowChannels.length}.`,
    `Pressure band: ${event.summary.pressureBand}. Crowd heat: ${Math.round(clamp01(event.crowdHeatScore) * 100)}%.`,
    event.helperSuppressionScore >= 0.5 ? `Helper suppression: ${Math.round(clamp01(event.helperSuppressionScore) * 100)}%.` : null,
    snapshot.health.failingEventIds.includes(event.eventId) ? 'Health snapshot marks this event as failing.' : null,
    snapshot.summary.whisperOnlyChannels.length > 0 && event.preview.kind === 'WHISPER_ONLY'
      ? `Whisper-only channels active: ${snapshot.summary.whisperOnlyChannels.length}.`
      : null,
    event.notes[0] ?? null,
    event.notes[1] ?? null,
    event.notes[2] ?? null,
  ]);

  return Object.freeze(detailLines.slice(0, budget));
}

function buildHeadline(
  event: SeasonalChatEventRuntimeState,
  profile: WorldEventOverlayKindProfile,
  severity: ChatBridgeSeverity,
): string {
  const base = event.preview.headline || event.summary.headline || event.summary.displayName || buildKindFallbackDescription(event.preview.kind);
  if (severity === 'CRITICAL') {
    return `${base} — ${headlineSuffixFor(profile, event)}`;
  }
  return base;
}

function buildBadges(
  event: SeasonalChatEventRuntimeState,
  profile: WorldEventOverlayKindProfile,
  tone: LiveOpsOverlayTone,
  severity: ChatBridgeSeverity,
): readonly ChatWorldEventOverlayBadge[] {
  const badges: ChatWorldEventOverlayBadge[] = [];
  badges.push(buildBadge(profile.defaultBadgeLabel, tone, severity, `${buildKindFallbackDescription(event.preview.kind)} default policy badge.`));
  badges.push(buildBadge(event.summary.pressureBand, tone, severity, 'Pressure band derived from shared world-event summary.'));
  if (event.helperSuppressionScore >= 0.5) {
    badges.push(buildBadge('HELPER SUPPRESSED', 'SUPPRESSED', severity, 'Helper pressure crossed the suppression threshold.'));
  }
  if (event.summary.shadowOnly) {
    badges.push(buildBadge('SHADOW ONLY', 'WHISPER', severity, 'This event is intentionally not fully public.'));
  }
  if (event.crowdHeatScore >= 0.7) {
    badges.push(buildBadge('CROWD HEAT', 'ALARM', severity, 'Audience heat is materially shaping presentation.'));
  }
  return Object.freeze(badges);
}

function buildTags(event: SeasonalChatEventRuntimeState, profile: WorldEventOverlayKindProfile): readonly string[] {
  return uniqueStrings([
    ...profile.tags,
    event.lifecycle.toLowerCase(),
    event.summary.pressureBand.toLowerCase(),
    event.preview.announcementMode.toLowerCase(),
    event.summary.shadowOnly ? 'shadow-only' : 'public-visible',
    event.targeting.visibleChannels.length > 0 ? 'visible-channels' : 'no-visible-channels',
    event.targeting.shadowChannels.length > 0 ? 'shadow-channels' : 'no-shadow-channels',
  ]);
}


function buildChannelScores(
  event: SeasonalChatEventRuntimeState,
  snapshot: SeasonalChatEventDirectorSnapshot,
  severity: ChatBridgeSeverity,
): readonly ChatWorldEventOverlayChannelScore[] {
  const allChannels = uniqueStrings([...event.targeting.visibleChannels, ...event.targeting.shadowChannels]);
  return Object.freeze(
    allChannels.map((channelId) => {
      const projection = channelProjectionFor(snapshot, channelId);
      const visibleWeight = clamp01(
        (event.targeting.visibleChannels.includes(channelId) ? 0.48 : 0)
        + clamp01(projection?.visiblePressure ?? 0) * 0.28
        + (projection?.noticeBias ?? 0) * 0.12
        + severityWeight(severity) * 0.12,
      );
      const shadowWeight = clamp01(
        (event.targeting.shadowChannels.includes(channelId) ? 0.52 : 0)
        + clamp01(projection?.shadowPressure ?? 0) * 0.28
        + clamp01(projection?.helperSuppression ?? 0) * 0.08
        + clamp01(projection?.crowdHeat ?? 0) * 0.12,
      );
      const totalWeight = clamp01((visibleWeight * 0.6) + (shadowWeight * 0.4));
      const reasons = compactStrings([
        event.targeting.visibleChannels.includes(channelId) ? 'Explicit visible target.' : null,
        event.targeting.shadowChannels.includes(channelId) ? 'Explicit shadow target.' : null,
        projection ? `Channel projection mount bias: ${projection.mountBias}.` : null,
        projection ? `Channel pressure band: ${projection.pressureBand}.` : null,
      ]);
      return Object.freeze({
        channelId,
        visibleWeight,
        shadowWeight,
        totalWeight,
        recommended: totalWeight >= 0.36,
        reasons,
      });
    }).sort((left, right) => sortNumbersDescending(left.totalWeight, right.totalWeight)),
  );
}

function buildMountScores(
  event: SeasonalChatEventRuntimeState,
  snapshot: SeasonalChatEventDirectorSnapshot,
  profile: WorldEventOverlayKindProfile,
  severity: ChatBridgeSeverity,
  publicPriorityScore: number,
  shadowPriorityScore: number,
): readonly ChatWorldEventOverlayMountScore[] {
  return Object.freeze(
    (Object.keys(profile.mountBias) as ChatBridgeMountTarget[])
      .map((mount) => {
        const mountProjection = mountProjectionFor(snapshot, mount);
        const mountBias = profile.mountBias[mount] ?? 0.22;
        const visibilityBoost = event.targeting.visibleChannels.length > 0 ? publicPriorityScore * 0.32 : shadowPriorityScore * 0.28;
        const projectionBoost = mountProjection ? severityWeight(mountProjection.severity) * 0.18 : 0;
        const weight = clamp01(mountBias + visibilityBoost + projectionBoost);
        return Object.freeze({
          mount,
          weight,
          severity,
          recommended: weight >= 0.46,
          explanation: compactStrings([
            MOUNT_PROFILE_EXPLANATIONS[mount],
            mountProjection ? `Director mount projection severity: ${mountProjection.severity}.` : null,
            profile.preferredMounts.includes(mount) ? 'Preferred mount for this event family.' : null,
            profile.highPressureMounts.includes(mount) ? 'Escalates cleanly under high pressure.' : null,
          ]).join(' '),
        });
      })
      .sort((left, right) => sortNumbersDescending(left.weight, right.weight)),
  );
}

function collectRecommendedMounts(mountScores: readonly ChatWorldEventOverlayMountScore[], options: Required<WorldEventOverlayPolicyOptions>): readonly ChatBridgeMountTarget[] {
  const recommended = mountScores.filter((entry) => entry.recommended).slice(0, options.maxRecommendedMounts);
  if (recommended.length > 0) {
    return Object.freeze(recommended.map((entry) => entry.mount));
  }
  return Object.freeze(mountScores.slice(0, Math.max(1, options.maxRecommendedMounts)).map((entry) => entry.mount));
}

function collectRecommendedChannels(channelScores: readonly ChatWorldEventOverlayChannelScore[], options: Required<WorldEventOverlayPolicyOptions>): readonly ChatChannelId[] {
  const recommended = channelScores.filter((entry) => entry.recommended).slice(0, options.maxRecommendedChannels);
  if (recommended.length > 0) {
    return Object.freeze(recommended.map((entry) => entry.channelId));
  }
  return Object.freeze(channelScores.slice(0, Math.max(1, options.maxRecommendedChannels)).map((entry) => entry.channelId));
}

function buildExplainability(
  event: SeasonalChatEventRuntimeState,
  snapshot: SeasonalChatEventDirectorSnapshot,
  profile: WorldEventOverlayKindProfile,
  severity: ChatBridgeSeverity,
  visibilityMode: ChatWorldEventVisibilityMode,
  priorityScore: number,
  publicPriorityScore: number,
  shadowPriorityScore: number,
  mountScores: readonly ChatWorldEventOverlayMountScore[],
  channelScores: readonly ChatWorldEventOverlayChannelScore[],
): ChatWorldEventOverlayExplainability {
  const selectionReasons: LiveOpsOverlaySelectionReason[] = [];
  if (publicPriorityScore >= shadowPriorityScore) {
    selectionReasons.push('VISIBLE_PRIORITY');
  }
  if (shadowPriorityScore > publicPriorityScore) {
    selectionReasons.push('SHADOW_PRIORITY');
  }
  if (PRESSURE_BAND_WEIGHTS[event.summary.pressureBand] >= 0.58) {
    selectionReasons.push('PRESSURE_BAND');
  }
  if (ANNOUNCEMENT_MODE_WEIGHTS[event.preview.announcementMode] >= 0.42) {
    selectionReasons.push('ANNOUNCEMENT_MODE');
  }
  if (mountScores[0]?.recommended) {
    selectionReasons.push('MOUNT_BIAS');
  }
  if (event.helperSuppressionScore >= 0.5) {
    selectionReasons.push('HELPER_SUPPRESSION');
  }
  if (event.crowdHeatScore >= 0.6) {
    selectionReasons.push('CROWD_HEAT');
  }
  if (runtimeThreatWeight(snapshot.runtime) >= 0.34) {
    selectionReasons.push('URGENT_RUNTIME');
  }
  if (event.preview.kind === 'LEGEND_SPOTLIGHT') {
    selectionReasons.push('LEGEND_PREFERENCE');
  }

  return Object.freeze({
    selectionReasons: uniqueStrings(selectionReasons),
    summaryHeadline: `${buildKindFallbackDescription(event.preview.kind)} overlay selected at ${Math.round(priorityScore * 100)}% priority.`,
    summaryBody: compactStrings([
      `Visibility mode: ${visibilityMode}.`,
      `Severity: ${severity}.`,
      `Visible priority: ${Math.round(publicPriorityScore * 100)}%.`,
      `Shadow priority: ${Math.round(shadowPriorityScore * 100)}%.`,
    ]).join(' '),
    pressureNotes: compactStrings([
      `Pressure band is ${event.summary.pressureBand}.`,
      `Visible pressure: ${Math.round(clamp01(event.audience.visiblePressure) * 100)}%.`,
      `Shadow pressure: ${Math.round(clamp01(event.audience.shadowPressure) * 100)}%.`,
      event.helperSuppressionScore >= 0.5 ? `Helper suppression: ${Math.round(clamp01(event.helperSuppressionScore) * 100)}%.` : null,
      event.crowdHeatScore >= 0.5 ? `Crowd heat: ${Math.round(clamp01(event.crowdHeatScore) * 100)}%.` : null,
    ]),
    mountNotes: compactStrings([
      mountScores[0]?.explanation,
      mountScores[1]?.explanation,
      profile.summaryNotes[0],
      profile.summaryNotes[1],
    ]),
    channelNotes: compactStrings([
      channelScores[0]?.reasons.join(' '),
      channelScores[1]?.reasons.join(' '),
      `Visible targets: ${event.targeting.visibleChannels.length}.`,
      `Shadow targets: ${event.targeting.shadowChannels.length}.`,
    ]),
    runtimeNotes: compactStrings([
      snapshot.health.safeModeReason ? `Health safe-mode reason: ${snapshot.health.safeModeReason}.` : null,
      snapshot.runtime.cashflow != null ? `Cashflow snapshot: ${snapshot.runtime.cashflow}.` : null,
      snapshot.runtime.activeThreatCardCount != null ? `Active threats: ${snapshot.runtime.activeThreatCardCount}.` : null,
      snapshot.health.notes?.[0] ?? null,
      snapshot.health.notes?.[1] ?? null,
    ]),
  });
}

function buildRenderAdvice(
  tone: LiveOpsOverlayTone,
  visibilityMode: ChatWorldEventVisibilityMode,
  mountScores: readonly ChatWorldEventOverlayMountScore[],
  priorityScore: number,
): ChatWorldEventOverlayRenderAdvice {
  const toneProfile = TONE_PROFILES[tone];
  const primaryMount = mountScores[0]?.mount ?? 'PRIMARY_DOCK';
  return Object.freeze({
    panelMode: toneProfile.panelMode,
    worldPosture: toneProfile.worldPosture,
    pulseClass: pulseForPriority(priorityScore, tone),
    urgencyBand: chooseUrgencyBand(priorityScore),
    publicness: coercePublicness(visibilityMode),
    primaryMount,
    recommendedMounts: Object.freeze(mountScores.filter((entry) => entry.recommended).map((entry) => entry.mount)),
  });
}


function buildOverlayCard(
  event: SeasonalChatEventRuntimeState,
  snapshot: SeasonalChatEventDirectorSnapshot,
  options: Required<WorldEventOverlayPolicyOptions>,
): ChatWorldEventOverlayCard {
  const visibilityMode = coerceVisibilityMode(event);
  const tone = deriveTone(event, options);
  const profile = KIND_PROFILES[event.preview.kind];
  const priorityScore = computePriorityScore(event, snapshot, options, tone, visibilityMode);
  const publicPriorityScore = computePublicPriorityScore(event, visibilityMode, priorityScore);
  const shadowPriorityScore = computeShadowPriorityScore(event, options, tone);
  const severity = normalizeSeverity(Math.max(publicPriorityScore, shadowPriorityScore));
  const channelScores = buildChannelScores(event, snapshot, severity);
  const mountScores = buildMountScores(event, snapshot, profile, severity, publicPriorityScore, shadowPriorityScore);
  const renderAdvice = buildRenderAdvice(tone, visibilityMode, mountScores, priorityScore);
  const publicness = renderAdvice.publicness;
  const body = coerceBody(event, profile, snapshot, publicness);
  const detailLines = buildDetailLines(event, snapshot, options, profile, severity, visibilityMode, publicness);
  const badges = buildBadges(event, profile, tone, severity);
  const tags = buildTags(event, profile);
  const explainability = buildExplainability(
    event,
    snapshot,
    profile,
    severity,
    visibilityMode,
    priorityScore,
    publicPriorityScore,
    shadowPriorityScore,
    mountScores,
    channelScores,
  );
  const mounts = collectRecommendedMounts(mountScores, options);
  const shouldPulseNow = shouldPulse(tone, renderAdvice.pulseClass);

  return Object.freeze({
    overlayId: `overlay:${event.eventId}:${event.activatedAt}`,
    eventId: event.eventId,
    headline: buildHeadline(event, profile, severity),
    body,
    detailLines,
    severity,
    tone,
    visibilityMode,
    pressureBand: event.summary.pressureBand,
    announcementMode: event.preview.announcementMode,
    mounts,
    visibleChannels: collectRecommendedChannels(channelScores.filter((entry) => event.targeting.visibleChannels.includes(entry.channelId)), options),
    shadowChannels: collectRecommendedChannels(channelScores.filter((entry) => event.targeting.shadowChannels.includes(entry.channelId)), options),
    sticky: shouldBeSticky(event, severity, priorityScore),
    dismissible: shouldBeDismissible(event, tone, severity),
    shouldPulse: shouldPulseNow,
    helperSuppressed: event.helperSuppressionScore >= 0.5,
    whisperOnly: visibilityMode === 'SHADOW_ONLY' || tone === 'WHISPER' || event.preview.kind === 'WHISPER_ONLY',
    crowdHeatScore: clamp01(event.crowdHeatScore),
    priorityScore,
    activatedAt: event.activatedAt,
    deactivatesAt: event.deactivatesAt,
    label: event.preview.label,
    kind: event.preview.kind,
    shadowPriorityScore,
    publicPriorityScore,
    urgencyScore: clamp01(event.urgencyScore),
    noveltyScore: clamp01(event.noveltyScore),
    pressureScore: clamp01(event.pressureScore),
    worldPosture: renderAdvice.worldPosture,
    panelMode: renderAdvice.panelMode,
    pulseClass: renderAdvice.pulseClass,
    publicness,
    badges,
    tags,
    channelScores,
    mountScores,
    renderAdvice,
    explainability,
    notes: compactStrings([
      ...profile.summaryNotes,
      `Summary intensity: ${event.summary.intensity}.`,
      `Visibility disposition: ${String(event.visibilityDisposition)}.`,
      event.batchTriggerEventType ? `Batch trigger: ${event.batchTriggerEventType}.` : null,
      event.notes[0] ?? null,
      event.notes[1] ?? null,
      event.notes[2] ?? null,
    ]),
  });
}

function sortCards(left: ChatWorldEventOverlayCard, right: ChatWorldEventOverlayCard): number {
  return (right.priorityScore - left.priorityScore)
    || (stableNumber(right.publicPriorityScore) - stableNumber(left.publicPriorityScore))
    || (severityWeight(right.severity) - severityWeight(left.severity))
    || (Number(right.sticky) - Number(left.sticky))
    || (right.activatedAt - left.activatedAt)
    || left.overlayId.localeCompare(right.overlayId);
}

function collectAllCards(stack: ChatWorldEventOverlayStack): readonly ChatWorldEventOverlayCard[] {
  return Object.freeze([stack.primary, ...stack.secondary, ...stack.shadow].filter((card): card is ChatWorldEventOverlayCard => Boolean(card)));
}

export function buildChannelVisibilityMap(stack: ChatWorldEventOverlayStack): Readonly<Record<ChatChannelId, number>> {
  const map = new Map<ChatChannelId, number>();
  const cards = collectAllCards(stack);
  for (const card of cards) {
    for (const channel of card.visibleChannels) {
      map.set(channel, Math.max(map.get(channel) ?? 0, stableNumber(card.publicPriorityScore, card.priorityScore)));
    }
    for (const channel of card.shadowChannels) {
      map.set(channel, Math.max(map.get(channel) ?? 0, stableNumber(card.shadowPriorityScore, card.priorityScore * 0.72)));
    }
  }
  return Object.freeze(Object.fromEntries(map.entries()) as Record<ChatChannelId, number>);
}

export function collectOverlayMountTargets(stack: ChatWorldEventOverlayStack): readonly ChatBridgeMountTarget[] {
  const mounts = new Set<ChatBridgeMountTarget>();
  for (const card of collectAllCards(stack)) {
    for (const mount of card.mounts) {
      mounts.add(mount);
    }
  }
  return Object.freeze([...mounts]);
}

export function projectOverlaySeverityForChannel(
  stack: ChatWorldEventOverlayStack,
  channel: ChatBridgeChannel,
): ChatBridgeSeverity {
  const cards = collectAllCards(stack).filter(
    (card) => card.visibleChannels.includes(channel as ChatChannelId) || card.shadowChannels.includes(channel as ChatChannelId),
  );
  if (cards.length === 0) {
    return 'INFO';
  }
  return cards.sort(sortCards)[0]?.severity ?? 'INFO';
}

export function shouldRenderOverlayOnMount(
  stack: ChatWorldEventOverlayStack,
  mount: ChatBridgeMountTarget,
): boolean {
  return collectAllCards(stack).some((card) => card.mounts.includes(mount));
}

export function selectPrimaryWorldEventOverlay(
  snapshot: SeasonalChatEventDirectorSnapshot,
  options: WorldEventOverlayPolicyOptions = {},
): ChatWorldEventOverlayCard | null {
  return buildWorldEventOverlayStack(snapshot, options).primary;
}

export function buildOverlayHeadline(summary: ChatLiveOpsSummary, stack: ChatWorldEventOverlayStack): string {
  if (stack.primary) {
    return stack.primary.headline;
  }
  if (summary.headline.trim().length > 0) {
    return summary.headline;
  }
  if (summary.eventCount > 0) {
    return `${summary.eventCount} live ${pluralize('world event', summary.eventCount)} active`;
  }
  return 'World pressure stable';
}

export function buildOverlaySubline(summary: ChatLiveOpsSummary, stack: ChatWorldEventOverlayStack): string {
  if (stack.primary) {
    return stack.primary.body;
  }
  if (summary.activeSeasonId) {
    return `Season ${summary.activeSeasonId} is active.`;
  }
  if (summary.shadowEventCount > 0 && summary.visibleEventCount === 0) {
    return 'Pressure is active, but it is staying mostly in shadow lanes.';
  }
  return 'No liveops surge currently targeted at this mount.';
}


function buildCardsByTone(cards: readonly ChatWorldEventOverlayCard[]): Readonly<Record<LiveOpsOverlayTone, number>> {
  const counts: Record<LiveOpsOverlayTone, number> = {
    CEREMONIAL: 0,
    ALARM: 0,
    PREDATORY: 0,
    WHISPER: 0,
    DEBATE: 0,
    SURGE: 0,
    SUPPRESSED: 0,
  };
  for (const card of cards) {
    counts[card.tone] += 1;
  }
  return Object.freeze(counts);
}

function buildCardsBySeverity(cards: readonly ChatWorldEventOverlayCard[]): Readonly<Record<ChatBridgeSeverity, number>> {
  const counts: Record<ChatBridgeSeverity, number> = {
    INFO: 0,
    WARNING: 0,
    CRITICAL: 0,
    SUCCESS: 0,
  };
  for (const card of cards) {
    counts[card.severity] += 1;
  }
  return Object.freeze(counts);
}

function buildCardsByKind(cards: readonly ChatWorldEventOverlayCard[]): Readonly<Record<ChatWorldEventKind, number>> {
  const counts = Object.fromEntries(CHAT_WORLD_EVENT_REGISTRY_MANIFEST.kinds.map((kind) => [kind, 0])) as Record<ChatWorldEventKind, number>;
  for (const card of cards) {
    if (card.kind) {
      counts[card.kind] += 1;
    }
  }
  return Object.freeze(counts);
}

function buildCardsByVisibility(cards: readonly ChatWorldEventOverlayCard[]): Readonly<Record<ChatWorldEventVisibilityMode, number>> {
  const counts: Record<ChatWorldEventVisibilityMode, number> = {
    PUBLIC: 0,
    SHADOW_ONLY: 0,
    PUBLIC_WITH_SHADOW: 0,
    REVEAL_LATER: 0,
    OPERATOR_HIDDEN: 0,
  };
  for (const card of cards) {
    counts[card.visibilityMode] += 1;
  }
  return Object.freeze(counts);
}

export function buildWorldEventOverlayDiagnostics(
  snapshot: SeasonalChatEventDirectorSnapshot,
  stack: ChatWorldEventOverlayStack,
): ChatWorldEventOverlayDiagnostics {
  const cards = collectAllCards(stack);
  const primary = stack.primary;
  const headline = buildOverlayHeadline(snapshot.summary, stack);
  const subline = buildOverlaySubline(snapshot.summary, stack);
  const mounts = collectOverlayMountTargets(stack);
  const channelVisibility = buildChannelVisibilityMap(stack);
  const sortedChannels = Object.entries(channelVisibility)
    .sort((left, right) => sortNumbersDescending(left[1], right[1]))
    .map(([channelId]) => channelId as ChatChannelId);

  return Object.freeze({
    generatedAt: snapshot.now,
    totalCards: cards.length,
    publicCards: [stack.primary, ...stack.secondary].filter((card) => Boolean(card)).length,
    shadowCards: stack.shadow.length,
    helperBlackoutActive: stack.helperBlackoutActive,
    highestPriorityScore: cards.length > 0 ? Math.max(...cards.map((card) => card.priorityScore)) : 0,
    highestVisiblePressure: snapshot.diagnostics.metrics.highestVisiblePressure,
    highestShadowPressure: snapshot.diagnostics.metrics.highestShadowPressure,
    headline,
    subline,
    recommendedMounts: mounts,
    recommendedChannels: Object.freeze(sortedChannels.slice(0, 5)),
    cardsByTone: buildCardsByTone(cards),
    cardsBySeverity: buildCardsBySeverity(cards),
    cardsByKind: buildCardsByKind(cards),
    cardsByVisibility: buildCardsByVisibility(cards),
    quietWorldReason: primary
      ? 'No quiet-world fallback needed because a primary overlay was selected.'
      : snapshot.summary.eventCount === 0
        ? 'No active liveops events are present.'
        : 'Events exist, but none currently deserve a public primary card.',
    notes: compactStrings([
      `Director active events: ${snapshot.activeEvents.length}.`,
      `Visible events: ${snapshot.summary.visibleEventCount}. Shadow events: ${snapshot.summary.shadowEventCount}.`,
      `Channels under pressure: ${snapshot.diagnostics.metrics.channelsUnderPressure}.`,
      `Queued derived effects: ${snapshot.diagnostics.metrics.queuedEffects}.`,
      snapshot.health.safeModeReason ? `Health safe mode: ${snapshot.health.safeModeReason}.` : null,
    ]),
  });
}

export function buildWorldEventOverlayManifest(
  snapshot: SeasonalChatEventDirectorSnapshot,
  stack: ChatWorldEventOverlayStack,
): ChatWorldEventOverlayManifest {
  const diagnostics = stack.diagnostics ?? buildWorldEventOverlayDiagnostics(snapshot, stack);
  return Object.freeze({
    version: WORLD_EVENT_OVERLAY_POLICY_VERSION,
    generatedAt: snapshot.now,
    activeEventCount: snapshot.activeEvents.length,
    quietWorld: stack.quietWorld,
    helperBlackoutActive: stack.helperBlackoutActive,
    headline: buildOverlayHeadline(snapshot.summary, stack),
    subline: buildOverlaySubline(snapshot.summary, stack),
    mounts: collectOverlayMountTargets(stack),
    channelVisibility: buildChannelVisibilityMap(stack),
    cards: collectAllCards(stack),
    diagnostics,
  });
}

export function serializeWorldEventOverlayManifestToNdjson(manifest: ChatWorldEventOverlayManifest): string {
  const lines = [
    JSON.stringify({ type: 'manifest', version: manifest.version, generatedAt: manifest.generatedAt }),
    ...manifest.cards.map((card) => JSON.stringify({
      type: 'card',
      overlayId: card.overlayId,
      eventId: card.eventId,
      headline: card.headline,
      severity: card.severity,
      priorityScore: card.priorityScore,
      tone: card.tone,
      kind: card.kind,
      mounts: card.mounts,
      visibleChannels: card.visibleChannels,
      shadowChannels: card.shadowChannels,
    })),
  ];
  return `${lines.join('\n')}\n`;
}

export function buildWorldEventOverlayStack(
  snapshot: SeasonalChatEventDirectorSnapshot,
  options: WorldEventOverlayPolicyOptions = {},
): ChatWorldEventOverlayStack {
  const resolved: Required<WorldEventOverlayPolicyOptions> = Object.freeze({ ...DEFAULT_OPTIONS, ...options });
  const cards = Object.freeze(
    snapshot.activeEvents
      .filter((event) => isWarmupVisible(event, resolved))
      .map((event) => buildOverlayCard(event, snapshot, resolved))
      .sort(sortCards),
  );

  const shadowCardsUncollapsed = cards.filter((card) => card.visibilityMode === 'SHADOW_ONLY' || card.whisperOnly);
  const shadowCards = Object.freeze(
    (resolved.collapseShadowToSingleCard ? shadowCardsUncollapsed.slice(0, 1) : shadowCardsUncollapsed)
      .slice(0, resolved.maxShadowCards),
  );

  const publicCards = cards.filter((card) => !shadowCards.includes(card));
  const primary = publicCards[0] ?? (resolved.renderShadowOnPrimaryWhenNoPublic ? shadowCards[0] ?? null : null);
  const secondary = Object.freeze(publicCards.filter((card) => card !== primary).slice(0, resolved.maxSecondaryCards));
  const stackBase: ChatWorldEventOverlayStack = Object.freeze({
    primary,
    secondary,
    shadow: shadowCards,
    quietWorld: publicCards.length === 0 && shadowCards.length === 0,
    helperBlackoutActive: cards.some((card) => card.helperSuppressed),
  });

  const diagnostics = resolved.includeDiagnostics ? buildWorldEventOverlayDiagnostics(snapshot, stackBase) : undefined;
  const stackForManifest = diagnostics ? { ...stackBase, diagnostics } : stackBase;
  const manifest = resolved.includeManifest ? buildWorldEventOverlayManifest(snapshot, stackForManifest) : undefined;

  return Object.freeze({
    ...stackBase,
    cards,
    headline: buildOverlayHeadline(snapshot.summary, stackBase),
    subline: buildOverlaySubline(snapshot.summary, stackBase),
    severity: primary?.severity ?? 'INFO',
    mounts: collectOverlayMountTargets(stackBase),
    channelVisibility: buildChannelVisibilityMap(stackBase),
    ...(diagnostics ? { diagnostics } : {}),
    ...(manifest ? { manifest } : {}),
  });
}


export function findWorldEventOverlayByEventId(
  stack: ChatWorldEventOverlayStack,
  eventId: string,
): ChatWorldEventOverlayCard | null {
  return collectAllCards(stack).find((card) => card.eventId === eventId) ?? null;
}

export function collectWorldEventOverlaysForChannel(
  stack: ChatWorldEventOverlayStack,
  channelId: ChatChannelId,
): readonly ChatWorldEventOverlayCard[] {
  return Object.freeze(
    collectAllCards(stack)
      .filter((card) => card.visibleChannels.includes(channelId) || card.shadowChannels.includes(channelId))
      .sort(sortCards),
  );
}

export function collectWorldEventOverlaysForMount(
  stack: ChatWorldEventOverlayStack,
  mount: ChatBridgeMountTarget,
): readonly ChatWorldEventOverlayCard[] {
  return Object.freeze(collectAllCards(stack).filter((card) => card.mounts.includes(mount)).sort(sortCards));
}

export function selectHighestSeverityOverlay(
  stack: ChatWorldEventOverlayStack,
): ChatWorldEventOverlayCard | null {
  const cards = [...collectAllCards(stack)].sort((left, right) => (severityWeight(right.severity) - severityWeight(left.severity)) || sortCards(left, right));
  return cards[0] ?? null;
}

export function selectMostPressuredChannel(
  stack: ChatWorldEventOverlayStack,
): ChatChannelId | null {
  const entries = Object.entries(buildChannelVisibilityMap(stack)).sort((left, right) => sortNumbersDescending(left[1], right[1]));
  return (entries[0]?.[0] as ChatChannelId | undefined) ?? null;
}

export function selectDominantMount(
  stack: ChatWorldEventOverlayStack,
): ChatBridgeMountTarget | null {
  const mountCounts = new Map<ChatBridgeMountTarget, number>();
  for (const card of collectAllCards(stack)) {
    for (const mount of card.mounts) {
      mountCounts.set(mount, (mountCounts.get(mount) ?? 0) + stableNumber(card.priorityScore));
    }
  }
  const sorted = [...mountCounts.entries()].sort((left, right) => sortNumbersDescending(left[1], right[1]));
  return sorted[0]?.[0] ?? null;
}

export function buildOverlayHeadlineFromStack(stack: ChatWorldEventOverlayStack): string {
  return stack.headline ?? stack.primary?.headline ?? 'World pressure stable';
}

export function buildOverlaySublineFromStack(stack: ChatWorldEventOverlayStack): string {
  return stack.subline ?? stack.primary?.body ?? 'No liveops surge currently targeted at this mount.';
}

export function serializeWorldEventOverlayStackToNdjson(stack: ChatWorldEventOverlayStack): string {
  const cards = collectAllCards(stack);
  const lines = [
    JSON.stringify({
      type: 'stack',
      quietWorld: stack.quietWorld,
      helperBlackoutActive: stack.helperBlackoutActive,
      primaryOverlayId: stack.primary?.overlayId ?? null,
      headline: buildOverlayHeadlineFromStack(stack),
      subline: buildOverlaySublineFromStack(stack),
    }),
    ...cards.map((card) => JSON.stringify({
      type: 'card',
      overlayId: card.overlayId,
      eventId: card.eventId,
      headline: card.headline,
      body: card.body,
      severity: card.severity,
      tone: card.tone,
      visibilityMode: card.visibilityMode,
      pressureBand: card.pressureBand,
      mounts: card.mounts,
      visibleChannels: card.visibleChannels,
      shadowChannels: card.shadowChannels,
      priorityScore: card.priorityScore,
    })),
  ];
  return `${lines.join('\n')}\n`;
}

export class WorldEventOverlayPolicy {
  private readonly options: Required<WorldEventOverlayPolicyOptions>;

  public constructor(options: WorldEventOverlayPolicyOptions = {}) {
    this.options = Object.freeze({ ...DEFAULT_OPTIONS, ...options });
  }

  public build(snapshot: SeasonalChatEventDirectorSnapshot): ChatWorldEventOverlayStack {
    return buildWorldEventOverlayStack(snapshot, this.options);
  }

  public buildManifest(snapshot: SeasonalChatEventDirectorSnapshot): ChatWorldEventOverlayManifest {
    const stack = this.build(snapshot);
    return buildWorldEventOverlayManifest(snapshot, stack);
  }

  public buildDiagnostics(snapshot: SeasonalChatEventDirectorSnapshot): ChatWorldEventOverlayDiagnostics {
    const stack = this.build(snapshot);
    return stack.diagnostics ?? buildWorldEventOverlayDiagnostics(snapshot, stack);
  }

  public selectPrimary(snapshot: SeasonalChatEventDirectorSnapshot): ChatWorldEventOverlayCard | null {
    return selectPrimaryWorldEventOverlay(snapshot, this.options);
  }

  public selectHighestSeverity(snapshot: SeasonalChatEventDirectorSnapshot): ChatWorldEventOverlayCard | null {
    return selectHighestSeverityOverlay(this.build(snapshot));
  }

  public collectForChannel(snapshot: SeasonalChatEventDirectorSnapshot, channelId: ChatChannelId): readonly ChatWorldEventOverlayCard[] {
    return collectWorldEventOverlaysForChannel(this.build(snapshot), channelId);
  }

  public collectForMount(snapshot: SeasonalChatEventDirectorSnapshot, mount: ChatBridgeMountTarget): readonly ChatWorldEventOverlayCard[] {
    return collectWorldEventOverlaysForMount(this.build(snapshot), mount);
  }

  public serializeManifest(snapshot: SeasonalChatEventDirectorSnapshot): string {
    return serializeWorldEventOverlayManifestToNdjson(this.buildManifest(snapshot));
  }

  public serializeStack(snapshot: SeasonalChatEventDirectorSnapshot): string {
    return serializeWorldEventOverlayStackToNdjson(this.build(snapshot));
  }

  public getOptions(): Required<WorldEventOverlayPolicyOptions> {
    return this.options;
  }
}

export function createWorldEventOverlayPolicy(
  options: WorldEventOverlayPolicyOptions = {},
): WorldEventOverlayPolicy {
  return new WorldEventOverlayPolicy(options);
}
