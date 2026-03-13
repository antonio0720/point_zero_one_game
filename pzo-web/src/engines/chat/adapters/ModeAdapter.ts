/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT ENGINE MODE ADAPTER
 * FILE: pzo-web/src/engines/chat/adapters/ModeAdapter.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical adapter that translates the real frontend mode donor lane into the
 * canonical frontend chat engine spine.
 *
 * Why this file exists
 * --------------------
 * The repo already has a real frontend mode estate under pzo-web/src/game/modes:
 *   - FrontendModeDirector.ts
 *   - ModeCatalog.ts
 *   - ModeRegistry.ts
 *   - contracts.ts
 *   - useFrontendModeDirector.ts
 *
 * That estate is not chat. It is mode truth projected for frontend screens.
 * Chat must consume that truth without re-owning it. This file is the bridge.
 *
 * Repo truths preserved here
 * --------------------------
 * - FrontendRunMode is already locked to:
 *     'solo' | 'asymmetric-pvp' | 'co-op' | 'ghost'
 * - FrontendModeCode is already locked to:
 *     'empire' | 'predator' | 'syndicate' | 'phantom'
 * - ModeRegistry already maps:
 *     solo           -> EmpireModeModel
 *     asymmetric-pvp -> PredatorModeModel
 *     co-op          -> SyndicateModeModel
 *     ghost          -> PhantomModeModel
 * - FrontendModeDirector already exposes:
 *     createInitialState()
 *     reduce()
 *     getCatalog()
 *     getModeMetadata()
 *     createEngineConfig()
 *     getEngineRouter()
 * - ModeRouter.startRunWithCards() is already the canonical mode-run entry point.
 *
 * What this adapter owns
 * ----------------------
 * - mode-to-chat snapshot projection
 * - mount-surface interpretation
 * - allowed channel posture by run mode / screen / phase
 * - mode transition witness
 * - mode-native helper and hater escalation hints
 * - mode-native invasion routing
 * - lightweight narrative witness and recommendation generation
 * - boot-channel resolution that preserves mode authority
 * - route continuity between lobby / board / battle / post-run surfaces
 *
 * What this adapter does NOT own
 * ------------------------------
 * - it does not replace FrontendModeDirector
 * - it does not replace ModeRouter
 * - it does not decide mechanical outcomes
 * - it does not persist transcript truth
 * - it does not own permanent learning profile updates
 *
 * Design laws
 * -----------
 * - Consume mode truth. Do not invent a second mode language.
 * - One dock, many surfaces, zero per-screen chat brains.
 * - Mode transitions should feel authored without becoming spam.
 * - Not every phase shift deserves text.
 * - Predator should feel predatory.
 * - Syndicate should feel intimate.
 * - Phantom should feel haunted.
 * - Empire should feel isolated, surveilled, and pressure-shaped.
 *
 * Density6 LLC · Point Zero One · Production-first architecture
 * ============================================================================
 */

import {
  ChatSocketClient,
  type ChatChannel,
} from '../ChatSocketClient';

import {
  ChatChannelPolicy,
  type ChatModeSnapshot,
} from '../ChatChannelPolicy';

import {
  ChatInvasionDirector,
  type ChatInvasionPlan,
} from '../ChatInvasionDirector';

import {
  ChatNpcDirector,
} from '../ChatNpcDirector';

import {
  ChatNotificationController,
  type ChatNotificationSeverity,
} from '../ChatNotificationController';

import {
  ChatTranscriptBuffer,
} from '../ChatTranscriptBuffer';

// -----------------------------------------------------------------------------
// Mode-donor compatibility surface preserved from pzo-web/src/game/modes/*
// -----------------------------------------------------------------------------

export type FrontendRunMode =
  | 'solo'
  | 'asymmetric-pvp'
  | 'co-op'
  | 'ghost';

export type FrontendModeCode =
  | 'empire'
  | 'predator'
  | 'syndicate'
  | 'phantom';

export type ModeOutcome =
  | 'FREEDOM'
  | 'TIMEOUT'
  | 'BANKRUPT'
  | 'ABANDONED';

export type PressureTier =
  | 'T0'
  | 'T1'
  | 'T2'
  | 'T3'
  | 'T4';

export type SoloPhase =
  | 'FOUNDATION'
  | 'ESCALATION'
  | 'SOVEREIGNTY';

export type PsycheState =
  | 'COMPOSED'
  | 'STRESSED'
  | 'CRACKING'
  | 'BREAKING'
  | 'DESPERATE';

export type TrustBand =
  | 'BROKEN'
  | 'FRACTURED'
  | 'WORKING'
  | 'STRONG'
  | 'SOVEREIGN_TRUST';

export type GapDirection = 'UP' | 'DOWN' | 'FLAT';

export interface BaseCardLike {
  id: string;
  name: string;
  deck_type: string;
  base_cost: number;
  tags: string[];
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'LEGENDARY';
  auto_resolve?: boolean;
  educational_tag?: string;
}

export interface MetricBar {
  id: string;
  label: string;
  current: number;
  max: number;
  pct: number;
  colorToken: string;
  subtitle?: string;
}

export interface EventFeedItem {
  id: string;
  tick: number;
  title: string;
  body: string;
  severity: 'info' | 'warn' | 'danger' | 'success';
  lane: 'system' | 'cards' | 'combat' | 'team' | 'ghost';
}

export interface CORDProjection {
  projectedCord: number;
  projectedGrade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  outcome: ModeOutcome;
  componentBreakdown: Record<string, number>;
  appliedBonuses: string[];
  ceiling: number;
}

export interface LegendMarker {
  id: string;
  tick: number;
  type: 'GOLD' | 'RED' | 'PURPLE' | 'SILVER' | 'BLACK';
  note: string;
}

export interface TeamPlayerState {
  playerId: string;
  displayName: string;
  role: string;
  trustScore: number;
  personalPressureTier: PressureTier;
  freedom: boolean;
  defected?: boolean;
  contribution?: number;
}

export interface EngineSnapshotLike {
  runId: string;
  seed: string | number;
  tick: number;
  elapsedMs: number;
  totalRunMs: number;
  cash: number;
  netWorth: number;
  incomePerTick: number;
  expensePerTick: number;
  freedomThreshold: number;
  pressureTier: PressureTier;
  pressureValue?: number;
  shields: Record<'L1' | 'L2' | 'L3' | 'L4', number>;
  haterHeats?: Record<string, number>;
  blockedSabotages?: number;
  cascadeChainsBroken?: number;
  decisionSpeedScore?: number;
  pressureSurvivedScore?: number;
  battleBudget?: number;
  opponent?: {
    cash: number;
    netWorth: number;
    shields: Record<'L1' | 'L2' | 'L3' | 'L4', number>;
    battleBudget?: number;
    decisionSpeedScore?: number;
    cascadeChainsActive?: number;
  };
  team?: {
    treasury: number;
    trustScores: Record<string, number>;
    players: TeamPlayerState[];
    criticalAlerts?: number;
  };
  ghost?: {
    legendCord: number;
    legendAgeHours: number;
    challengersBeaten?: number;
    challengeCount?: number;
    beatRate?: number;
    averageClosingGap?: number;
    markers: LegendMarker[];
  };
}

export interface SoloProjection {
  phase: SoloPhase;
  isolationTaxActive: boolean;
  isolationTaxRate: number;
  bleedMode: boolean;
  comebackSurgeActive: boolean;
  comebackTicks: number;
  pressureJournalEntry: string;
  holdState?: {
    baseHolds: number;
    bonusHolds: number;
    usedHolds: number;
    holdAllowed: boolean;
    noHoldBonusEligible: boolean;
  };
}

export interface PredatorProjection {
  battleBudget: number;
  battleBudgetCap: number;
  psycheState: PsycheState;
  firstBloodAvailable: boolean;
  counterWindowOpen: boolean;
  visibleThreatQueue: string[];
  spectatorProjection: {
    liveViewers: number;
    predictionBiasPct: number;
    cordLead: number;
  };
}

export interface SyndicateProjection {
  treasury: number;
  treasuryCritical: boolean;
  trustBand: TrustBand;
  synergyActive: boolean;
  warAlert: boolean;
  defectionRisk: number;
  roles: TeamPlayerState[];
  proofShareReady: boolean;
}

export interface PhantomProjection {
  gapDirection: GapDirection;
  gapValue: number;
  legendDecayTier: string;
  markerWindowOpen: boolean;
  currentMarker: LegendMarker | null;
  proofBadges: string[];
  historicalDifficultyRating: number;
}

export interface FrontendModeState {
  runMode: FrontendRunMode;
  modeCode: FrontendModeCode;
  uiLabel: string;
  screenName: string;
  tick: number;
  elapsedMs: number;
  totalRunMs: number;
  pressureTier: PressureTier;
  shieldBars: MetricBar[];
  primaryBars: MetricBar[];
  eventFeed: EventFeedItem[];
  cord: CORDProjection;
  runtimeCards: BaseCardLike[];
  solo?: SoloProjection;
  predator?: PredatorProjection;
  syndicate?: SyndicateProjection;
  phantom?: PhantomProjection;
}

export interface FrontendModeCatalogEntry {
  runMode: FrontendRunMode;
  uiLabel: string;
  screenName: string;
  description: string;
  playerRange: [number, number];
}

export interface FrontendModeDirectorLike {
  createInitialState(
    mode: FrontendRunMode,
    snapshot: EngineSnapshotLike,
    cards?: BaseCardLike[],
  ): FrontendModeState;
  reduce(
    mode: FrontendRunMode,
    previous: FrontendModeState,
    snapshot: EngineSnapshotLike,
    cards?: BaseCardLike[],
  ): FrontendModeState;
  getCatalog(): FrontendModeCatalogEntry[];
  getModeMetadata(mode: FrontendRunMode): FrontendModeCatalogEntry;
  createEngineConfig(
    mode: FrontendRunMode,
    seed: string | number,
    overrides?: Record<string, unknown>,
  ): Record<string, unknown>;
  getEngineRouter(): unknown;
}

export interface ModeRouterLike {
  getMetadata?(mode: FrontendRunMode): {
    mode: FrontendRunMode;
    engineLabel: string;
    uiLabel: string;
    description: string;
    minPlayers: number;
    maxPlayers: number;
  };
  getAllModes?(): Array<{
    mode: FrontendRunMode;
    engineLabel: string;
    uiLabel: string;
    description: string;
    minPlayers: number;
    maxPlayers: number;
  }>;
  getActiveMode?(): string | null;
  toGameMode?(mode: FrontendRunMode): string;
  startRunWithCards?(
    mode: FrontendRunMode,
    config: Record<string, unknown>,
    userId?: string,
  ): Promise<unknown>;
}

// -----------------------------------------------------------------------------
// Canonical mode adapter contracts
// -----------------------------------------------------------------------------

export type ModeAdapterSurfaceId =
  | 'LobbyScreen'
  | 'GameBoard'
  | 'BattleHUD'
  | 'EmpireGameScreen'
  | 'PredatorGameScreen'
  | 'SyndicateGameScreen'
  | 'PhantomGameScreen'
  | 'ClubUI'
  | 'LeagueUI'
  | 'CounterplayModal'
  | 'EmpireBleedBanner'
  | 'MomentFlash'
  | 'ProofCard'
  | 'ProofCardV2'
  | 'RescueWindowBanner'
  | 'SabotageImpactPanel'
  | 'ThreatRadarPanel'
  | 'UNKNOWN';

export type ModeAdapterScreenFamily =
  | 'LOBBY'
  | 'BOARD'
  | 'RUN'
  | 'BATTLE'
  | 'SOCIAL'
  | 'OVERLAY'
  | 'POST_RUN'
  | 'UNKNOWN';

export type ModeAdapterNarrativeBand =
  | 'ISOLATION'
  | 'PREDATION'
  | 'TRUST'
  | 'HAUNT'
  | 'NEUTRAL';

export type ModeAdapterTransitionReason =
  | 'bootstrap'
  | 'mode_change'
  | 'surface_change'
  | 'phase_change'
  | 'tick_reduce'
  | 'run_outcome_change'
  | 'manual'
  | 'rehydrate';

export type ModeAdapterRecommendationIntent =
  | 'join_channel'
  | 'switch_channel'
  | 'collapse_channel'
  | 'open_transcript'
  | 'expect_invasion'
  | 'watch_helper'
  | 'suppress_noise'
  | 'observe_deal_room';

export interface ModeAdapterRecommendation {
  id: string;
  channel: ChatChannel;
  title: string;
  body: string;
  intent: ModeAdapterRecommendationIntent;
  weight: number;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
}

export interface ModeAdapterHistoryEntry {
  id: string;
  at: number;
  runMode: FrontendRunMode;
  modeCode: FrontendModeCode;
  screenName: string;
  surfaceId: ModeAdapterSurfaceId;
  reason: ModeAdapterTransitionReason;
  tick?: number;
  pressureTier?: string;
  outcome?: string;
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface ModeAdapterSnapshot {
  readonly runMode: FrontendRunMode;
  readonly modeCode: FrontendModeCode;
  readonly uiLabel: string;
  readonly screenName: string;
  readonly screenFamily: ModeAdapterScreenFamily;
  readonly narrativeBand: ModeAdapterNarrativeBand;
  readonly surfaceId: ModeAdapterSurfaceId;
  readonly tick?: number;
  readonly runId?: string;
  readonly seed?: string;
  readonly roomId?: string;
  readonly syndicateId?: string;
  readonly dealId?: string;
  readonly preferredChannel: ChatChannel;
  readonly allowedChannels: ChatChannel[];
  readonly visibleChannels: ChatChannel[];
  readonly activeRecommendations: ModeAdapterRecommendation[];
  readonly recentHistory: ModeAdapterHistoryEntry[];
  readonly modeSnapshot: ChatModeSnapshot;
  readonly lastSystemWitness?: string;
}

export interface ModeAdapterContext {
  runId?: string;
  roomId?: string;
  syndicateId?: string;
  dealId?: string;
  seed?: string | number;
  surfaceId?: ModeAdapterSurfaceId;
  screenNameOverride?: string;
  preferredChannel?: ChatChannel;
  forceMultiplayer?: boolean;
  forceMounted?: boolean;
  isPostRun?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ModeAdapterCallbacks {
  onModeStateReduced?(state: FrontendModeState): void;
  onModeSnapshotApplied?(snapshot: ChatModeSnapshot): void;
  onRecommendationSetChanged?(recommendations: ModeAdapterRecommendation[]): void;
  onHistoryEntry?(entry: ModeAdapterHistoryEntry): void;
}

export interface ModeAdapterConfig {
  readonly maxHistory: number;
  readonly maxRecommendations: number;
  readonly emitTranscriptWitness: boolean;
  readonly emitSocketGameEvents: boolean;
  readonly emitNotifications: boolean;
  readonly allowNpcHandling: boolean;
  readonly allowInvasionHandling: boolean;
  readonly phaseWitnessCooldownMs: number;
  readonly surfaceWitnessCooldownMs: number;
  readonly recommendationTtlMs: number;
  readonly highPressureThreshold: number;
  readonly criticalPressureThreshold: number;
  readonly negotiationUrgencyThreshold: number;
  readonly hauntGapThreshold: number;
  readonly suppressWitnessOnRapidTickReduce: boolean;
  readonly namespace: string;
}

export interface ModeAdapterOptions {
  channelPolicy: ChatChannelPolicy;
  npcDirector?: ChatNpcDirector;
  invasionDirector?: ChatInvasionDirector;
  transcriptBuffer?: ChatTranscriptBuffer;
  notificationController?: ChatNotificationController;
  socketClient?: ChatSocketClient;
  modeDirector?: FrontendModeDirectorLike;
  modeRouter?: ModeRouterLike;
  callbacks?: ModeAdapterCallbacks;
  config?: Partial<ModeAdapterConfig>;
}

// -----------------------------------------------------------------------------
// Canonical mode descriptors
// -----------------------------------------------------------------------------

export interface ModeAdapterModeDescriptor {
  readonly runMode: FrontendRunMode;
  readonly modeCode: FrontendModeCode;
  readonly uiLabel: string;
  readonly screenName: string;
  readonly description: string;
  readonly narrativeBand: ModeAdapterNarrativeBand;
  readonly playerRange: [number, number];
  readonly defaultChannel: ChatChannel;
  readonly allowedChannels: readonly ChatChannel[];
  readonly visibleChannels: readonly ChatChannel[];
  readonly screenFamily: ModeAdapterScreenFamily;
  readonly engineLabel: string;
}

const MODE_DESCRIPTORS: Readonly<Record<FrontendRunMode, ModeAdapterModeDescriptor>> = deepFreeze({
  solo: {
    runMode: 'solo',
    modeCode: 'empire',
    uiLabel: 'EMPIRE',
    screenName: 'EmpireGameScreen',
    description: 'Isolation tax, private pressure, shield decay, and authored self-mastery.',
    narrativeBand: 'ISOLATION',
    playerRange: [1, 1],
    defaultChannel: 'GLOBAL',
    allowedChannels: ['GLOBAL', 'LOBBY'],
    visibleChannels: ['GLOBAL', 'LOBBY'],
    screenFamily: 'RUN',
    engineLabel: 'EmpireEngine',
  },
  'asymmetric-pvp': {
    runMode: 'asymmetric-pvp',
    modeCode: 'predator',
    uiLabel: 'PREDATOR',
    screenName: 'PredatorGameScreen',
    description: 'Shared deck, battle budget, sabotage windows, and direct rivalry.',
    narrativeBand: 'PREDATION',
    playerRange: [2, 2],
    defaultChannel: 'DEAL_ROOM',
    allowedChannels: ['GLOBAL', 'DEAL_ROOM', 'LOBBY'],
    visibleChannels: ['GLOBAL', 'DEAL_ROOM', 'LOBBY'],
    screenFamily: 'BATTLE',
    engineLabel: 'PredatorEngine',
  },
  'co-op': {
    runMode: 'co-op',
    modeCode: 'syndicate',
    uiLabel: 'SYNDICATE',
    screenName: 'SyndicateGameScreen',
    description: 'Shared treasury, trust strain, aid windows, and collapse/recovery as a team.',
    narrativeBand: 'TRUST',
    playerRange: [2, 4],
    defaultChannel: 'SYNDICATE',
    allowedChannels: ['GLOBAL', 'SYNDICATE', 'LOBBY'],
    visibleChannels: ['GLOBAL', 'SYNDICATE', 'LOBBY'],
    screenFamily: 'RUN',
    engineLabel: 'SyndicateEngine',
  },
  ghost: {
    runMode: 'ghost',
    modeCode: 'phantom',
    uiLabel: 'PHANTOM',
    screenName: 'PhantomGameScreen',
    description: 'Ghost pressure, legend markers, divergence scoring, and haunted pacing.',
    narrativeBand: 'HAUNT',
    playerRange: [1, 1],
    defaultChannel: 'GLOBAL',
    allowedChannels: ['GLOBAL', 'LOBBY'],
    visibleChannels: ['GLOBAL', 'LOBBY'],
    screenFamily: 'RUN',
    engineLabel: 'PhantomEngine',
  },
});

const SURFACE_FAMILY_MAP: Readonly<Record<ModeAdapterSurfaceId, ModeAdapterScreenFamily>> = deepFreeze({
  LobbyScreen: 'LOBBY',
  GameBoard: 'BOARD',
  BattleHUD: 'BATTLE',
  EmpireGameScreen: 'RUN',
  PredatorGameScreen: 'RUN',
  SyndicateGameScreen: 'RUN',
  PhantomGameScreen: 'RUN',
  ClubUI: 'SOCIAL',
  LeagueUI: 'SOCIAL',
  CounterplayModal: 'OVERLAY',
  EmpireBleedBanner: 'OVERLAY',
  MomentFlash: 'OVERLAY',
  ProofCard: 'OVERLAY',
  ProofCardV2: 'OVERLAY',
  RescueWindowBanner: 'OVERLAY',
  SabotageImpactPanel: 'OVERLAY',
  ThreatRadarPanel: 'OVERLAY',
  UNKNOWN: 'UNKNOWN',
});

const DEFAULT_CONFIG: ModeAdapterConfig = deepFreeze({
  maxHistory: 160,
  maxRecommendations: 10,
  emitTranscriptWitness: true,
  emitSocketGameEvents: true,
  emitNotifications: true,
  allowNpcHandling: true,
  allowInvasionHandling: true,
  phaseWitnessCooldownMs: 4_500,
  surfaceWitnessCooldownMs: 3_500,
  recommendationTtlMs: 30_000,
  highPressureThreshold: 0.64,
  criticalPressureThreshold: 0.84,
  negotiationUrgencyThreshold: 0.72,
  hauntGapThreshold: 0.55,
  suppressWitnessOnRapidTickReduce: true,
  namespace: 'mode-adapter',
});

// -----------------------------------------------------------------------------
// ModeAdapter
// -----------------------------------------------------------------------------

export class ModeAdapter {
  private readonly channelPolicy: ChatChannelPolicy;
  private readonly npcDirector?: ChatNpcDirector;
  private readonly invasionDirector?: ChatInvasionDirector;
  private readonly transcriptBuffer?: ChatTranscriptBuffer;
  private readonly notificationController?: ChatNotificationController;
  private readonly socketClient?: ChatSocketClient;
  private readonly modeDirector?: FrontendModeDirectorLike;
  private readonly modeRouter?: ModeRouterLike;
  private readonly callbacks?: ModeAdapterCallbacks;
  private readonly config: ModeAdapterConfig;

  private destroyed = false;
  private lastState: FrontendModeState | null = null;
  private currentContext: ModeAdapterContext = {};
  private currentSnapshot: ModeAdapterSnapshot = this.createEmptySnapshot();
  private recommendations: ModeAdapterRecommendation[] = [];
  private history: ModeAdapterHistoryEntry[] = [];
  private lastPhaseWitnessAt = 0;
  private lastSurfaceWitnessAt = 0;
  private lastSystemWitness: string | undefined;

  public constructor(options: ModeAdapterOptions) {
    this.channelPolicy = options.channelPolicy;
    this.npcDirector = options.npcDirector;
    this.invasionDirector = options.invasionDirector;
    this.transcriptBuffer = options.transcriptBuffer;
    this.notificationController = options.notificationController;
    this.socketClient = options.socketClient;
    this.modeDirector = options.modeDirector;
    this.modeRouter = options.modeRouter;
    this.callbacks = options.callbacks;
    this.config = mergeConfig(DEFAULT_CONFIG, options.config);
  }

  // ---------------------------------------------------------------------------
  // Public lifecycle
  // ---------------------------------------------------------------------------

  public destroy(): void {
    this.destroyed = true;
    this.recommendations = [];
    this.history = [];
    this.lastState = null;
    this.currentContext = {};
    this.lastSystemWitness = undefined;
  }

  public getSnapshot(): ModeAdapterSnapshot {
    this.assertNotDestroyed('getSnapshot');
    return cloneSnapshot(this.currentSnapshot);
  }

  public getRecommendations(): ModeAdapterRecommendation[] {
    this.assertNotDestroyed('getRecommendations');
    return this.recommendations.map(cloneRecommendation);
  }

  public getHistory(limit = 40): ModeAdapterHistoryEntry[] {
    this.assertNotDestroyed('getHistory');
    return this.history.slice(-Math.max(1, limit)).map(cloneHistoryEntry);
  }

  public setSurface(surfaceId: ModeAdapterSurfaceId, reason: ModeAdapterTransitionReason = 'surface_change'): void {
    this.assertNotDestroyed('setSurface');
    this.currentContext = {
      ...this.currentContext,
      surfaceId,
    };

    if (!this.lastState) {
      this.rebuildSnapshot({
        runMode: 'solo',
        modeCode: 'empire',
        uiLabel: MODE_DESCRIPTORS.solo.uiLabel,
        screenName: MODE_DESCRIPTORS.solo.screenName,
        tick: 0,
        elapsedMs: 0,
        totalRunMs: 0,
        pressureTier: 'T0',
        shieldBars: [],
        primaryBars: [],
        eventFeed: [],
        cord: {
          projectedCord: 0,
          projectedGrade: 'F',
          outcome: 'ABANDONED',
          componentBreakdown: {},
          appliedBonuses: [],
          ceiling: 0,
        },
        runtimeCards: [],
      }, reason);
      return;
    }

    this.rebuildSnapshot(this.lastState, reason);
  }

  public applyContext(next: Partial<ModeAdapterContext>, reason: ModeAdapterTransitionReason = 'manual'): void {
    this.assertNotDestroyed('applyContext');
    this.currentContext = {
      ...this.currentContext,
      ...stripUndefined(next),
    };

    if (this.lastState) {
      this.rebuildSnapshot(this.lastState, reason);
    }
  }

  // ---------------------------------------------------------------------------
  // Frontend-mode donor integration
  // ---------------------------------------------------------------------------

  public bootstrap(input: {
    runMode: FrontendRunMode;
    snapshot: EngineSnapshotLike;
    cards?: BaseCardLike[];
    context?: Partial<ModeAdapterContext>;
  }): FrontendModeState {
    this.assertNotDestroyed('bootstrap');

    const state = this.modeDirector
      ? this.modeDirector.createInitialState(input.runMode, input.snapshot, input.cards ?? [])
      : this.createFallbackModeState(input.runMode, input.snapshot, input.cards ?? []);

    this.currentContext = {
      ...this.currentContext,
      ...stripUndefined(input.context ?? {}),
      runId: input.context?.runId ?? input.snapshot.runId,
      seed: input.context?.seed ?? String(input.snapshot.seed),
    };

    this.lastState = state;
    this.rebuildSnapshot(state, 'bootstrap');
    this.callbacks?.onModeStateReduced?.(state);
    return cloneModeState(state);
  }

  public reduce(input: {
    runMode: FrontendRunMode;
    snapshot: EngineSnapshotLike;
    cards?: BaseCardLike[];
    context?: Partial<ModeAdapterContext>;
  }): FrontendModeState {
    this.assertNotDestroyed('reduce');

    const previous = this.lastState
      ?? this.bootstrap({
        runMode: input.runMode,
        snapshot: input.snapshot,
        cards: input.cards,
        context: input.context,
      });

    const next = this.modeDirector
      ? this.modeDirector.reduce(
          input.runMode,
          previous,
          input.snapshot,
          input.cards ?? [],
        )
      : this.reduceFallbackModeState(previous, input.snapshot, input.cards ?? []);

    this.currentContext = {
      ...this.currentContext,
      ...stripUndefined(input.context ?? {}),
      runId: input.context?.runId ?? input.snapshot.runId,
      seed: input.context?.seed ?? String(input.snapshot.seed),
    };

    this.lastState = next;
    this.rebuildSnapshot(next, 'tick_reduce');
    this.callbacks?.onModeStateReduced?.(next);
    return cloneModeState(next);
  }

  public ingestModeState(
    state: FrontendModeState,
    context: Partial<ModeAdapterContext> = {},
    reason: ModeAdapterTransitionReason = 'manual',
  ): void {
    this.assertNotDestroyed('ingestModeState');

    this.lastState = cloneModeState(state);
    this.currentContext = {
      ...this.currentContext,
      ...stripUndefined(context),
    };
    this.rebuildSnapshot(this.lastState, reason);
    this.callbacks?.onModeStateReduced?.(this.lastState);
  }

  // ---------------------------------------------------------------------------
  // Mode-router helpers
  // ---------------------------------------------------------------------------

  public buildRouterCompatibleConfig(
    mode: FrontendRunMode,
    seed: string | number,
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    this.assertNotDestroyed('buildRouterCompatibleConfig');

    if (this.modeDirector?.createEngineConfig) {
      return {
        ...this.modeDirector.createEngineConfig(mode, seed, overrides),
      };
    }

    const base: Record<string, unknown> = {
      seed,
      runId: overrides.runId ?? `run_${now()}_${mode}`,
      runTicks: overrides.runTicks ?? 720,
      mode,
    };

    switch (mode) {
      case 'solo':
        return {
          ...base,
          empireLoadout: overrides.empireLoadout ?? 'BUILDER',
          ...overrides,
        };
      case 'asymmetric-pvp':
        return {
          ...base,
          battleBudgetMax: overrides.battleBudgetMax ?? 200,
          localRole: overrides.localRole ?? 'builder',
          ...overrides,
        };
      case 'co-op':
        return {
          ...base,
          syndicateRole: overrides.syndicateRole ?? 'INCOME_BUILDER',
          trustScoreInit: overrides.trustScoreInit ?? 50,
          ...overrides,
        };
      case 'ghost':
        return {
          ...base,
          ghostChampionRunId: overrides.ghostChampionRunId ?? `champion_seed_${seed}`,
          championAgeDays: overrides.championAgeDays ?? 3,
          ...overrides,
        };
      default:
        return { ...base, ...overrides };
    }
  }

  public getModeCatalog(): FrontendModeCatalogEntry[] {
    this.assertNotDestroyed('getModeCatalog');

    if (this.modeDirector?.getCatalog) {
      return this.modeDirector.getCatalog().map((entry) => ({ ...entry }));
    }

    return Object.values(MODE_DESCRIPTORS).map((entry) => ({
      runMode: entry.runMode,
      uiLabel: entry.uiLabel,
      screenName: entry.screenName,
      description: entry.description,
      playerRange: [...entry.playerRange] as [number, number],
    }));
  }

  public getModeDescriptor(mode: FrontendRunMode): ModeAdapterModeDescriptor {
    this.assertNotDestroyed('getModeDescriptor');
    return cloneDescriptor(MODE_DESCRIPTORS[mode]);
  }

  // ---------------------------------------------------------------------------
  // Internal orchestration
  // ---------------------------------------------------------------------------

  private rebuildSnapshot(
    state: FrontendModeState,
    reason: ModeAdapterTransitionReason,
  ): void {
    const previous = this.currentSnapshot;
    const next = this.materializeSnapshot(state);
    this.currentSnapshot = next;

    this.channelPolicy.updateModeSnapshot({
      ...next.modeSnapshot,
    });

    this.pushHistory(this.buildHistoryEntry(state, next, reason));
    this.recommendations = this.buildRecommendations(state, next);
    this.callbacks?.onRecommendationSetChanged?.(this.getRecommendations());
    this.callbacks?.onModeSnapshotApplied?.({ ...next.modeSnapshot });

    this.emitWitnessIfNeeded(previous, next, state, reason);
    this.emitNarrativeSignals(next, state, reason);
  }

  private materializeSnapshot(state: FrontendModeState): ModeAdapterSnapshot {
    const descriptor = MODE_DESCRIPTORS[state.runMode];
    const surfaceId = this.resolveSurfaceId(state);
    const screenFamily = SURFACE_FAMILY_MAP[surfaceId];
    const roomId = this.currentContext.roomId;
    const runId = this.currentContext.runId;
    const syndicateId = this.currentContext.syndicateId;
    const dealId = this.currentContext.dealId;
    const seed = normalizeSeed(this.currentContext.seed);

    const preferredChannel = this.resolvePreferredChannel(state, surfaceId);
    const allowedChannels = this.resolveAllowedChannels(state, descriptor, surfaceId, syndicateId, dealId);
    const visibleChannels = this.resolveVisibleChannels(state, descriptor, surfaceId, allowedChannels);
    const modeSnapshot = this.buildChatModeSnapshot({
      state,
      descriptor,
      surfaceId,
      screenFamily,
      runId,
      roomId,
      syndicateId,
      dealId,
      preferredChannel,
      allowedChannels,
      visibleChannels,
    });

    return {
      runMode: state.runMode,
      modeCode: state.modeCode,
      uiLabel: state.uiLabel,
      screenName: state.screenName,
      screenFamily,
      narrativeBand: descriptor.narrativeBand,
      surfaceId,
      tick: state.tick,
      runId,
      seed,
      roomId,
      syndicateId,
      dealId,
      preferredChannel,
      allowedChannels,
      visibleChannels,
      activeRecommendations: this.recommendations.map(cloneRecommendation),
      recentHistory: this.getHistory(24),
      modeSnapshot,
      lastSystemWitness: this.lastSystemWitness,
    };
  }

  private buildChatModeSnapshot(input: {
    state: FrontendModeState;
    descriptor: ModeAdapterModeDescriptor;
    surfaceId: ModeAdapterSurfaceId;
    screenFamily: ModeAdapterScreenFamily;
    runId?: string;
    roomId?: string;
    syndicateId?: string;
    dealId?: string;
    preferredChannel: ChatChannel;
    allowedChannels: ChatChannel[];
    visibleChannels: ChatChannel[];
  }): ChatModeSnapshot {
    const { state, descriptor, surfaceId, screenFamily } = input;
    const isLobbyVisible = surfaceId === 'LobbyScreen';
    const isDealVisible = visibleHas(input.visibleChannels, 'DEAL_ROOM');
    const isSyndicateVisible = visibleHas(input.visibleChannels, 'SYNDICATE');

    return {
      modeId: descriptor.runMode,
      modeFamily: descriptor.modeCode,
      screenId: surfaceId,
      runId: input.runId,
      roomId: input.roomId,
      syndicateId: input.syndicateId,
      dealId: input.dealId,
      gamePhase: this.resolveGamePhase(state, screenFamily),
      isMounted: this.currentContext.forceMounted ?? true,
      isPreRun: screenFamily === 'LOBBY',
      isInRun: screenFamily === 'RUN' || screenFamily === 'BATTLE' || screenFamily === 'BOARD',
      isPostRun: Boolean(this.currentContext.isPostRun),
      isMultiplayer: this.currentContext.forceMultiplayer ?? descriptor.playerRange[1] > 1,
      isNegotiationWindow: isDealVisible || surfaceId === 'CounterplayModal' || surfaceId === 'SabotageImpactPanel',
      isDealVisible,
      isSyndicateVisible,
      isLobbyVisible,
      allowGlobal: input.allowedChannels.includes('GLOBAL'),
      allowSyndicate: input.allowedChannels.includes('SYNDICATE'),
      allowDealRoom: input.allowedChannels.includes('DEAL_ROOM'),
      allowLobby: input.allowedChannels.includes('LOBBY'),
      pressureTier: state.pressureTier,
      tickTier: this.resolveTickTier(state),
      runOutcome: state.cord.outcome,
      haterHeat: this.estimateHaterHeat(state),
      negotiationUrgency: this.estimateNegotiationUrgency(state, surfaceId),
      metadata: {
        uiLabel: state.uiLabel,
        screenName: state.screenName,
        narrativeBand: descriptor.narrativeBand,
        preferredChannel: input.preferredChannel,
        visibleChannels: input.visibleChannels,
        primaryBars: state.primaryBars.map((bar) => ({
          id: bar.id,
          pct: round(bar.pct, 3),
        })),
        shieldBars: state.shieldBars.map((bar) => ({
          id: bar.id,
          pct: round(bar.pct, 3),
        })),
        screenFamily,
      },
    };
  }

  private buildRecommendations(
    state: FrontendModeState,
    snapshot: ModeAdapterSnapshot,
  ): ModeAdapterRecommendation[] {
    const recommendations: ModeAdapterRecommendation[] = [];
    const nowTs = now();

    const push = (rec: Omit<ModeAdapterRecommendation, 'id' | 'expiresAt'> & { ttlMs?: number }) => {
      recommendations.push({
        id: hashKey([
          this.config.namespace,
          state.runMode,
          snapshot.surfaceId,
          rec.intent,
          rec.channel,
          rec.title,
        ]),
        channel: rec.channel,
        title: rec.title,
        body: rec.body,
        intent: rec.intent,
        weight: clamp(rec.weight, 0, 1),
        expiresAt: nowTs + (rec.ttlMs ?? this.config.recommendationTtlMs),
        metadata: rec.metadata,
      });
    };

    if (snapshot.surfaceId === 'LobbyScreen') {
      push({
        channel: 'LOBBY',
        title: 'Stay in the staging lane',
        body: 'Use lobby witness for setup and transition messaging; do not flood the run channels before the run starts.',
        intent: 'join_channel',
        weight: 0.86,
      });
    }

    if (state.runMode === 'co-op' && snapshot.allowedChannels.includes('SYNDICATE')) {
      push({
        channel: 'SYNDICATE',
        title: 'Trust belongs in Syndicate',
        body: 'Keep rescue, trust, treasury, and betrayal signals inside the syndicate lane first.',
        intent: 'join_channel',
        weight: 0.91,
      });
    }

    if (state.runMode === 'asymmetric-pvp' && snapshot.allowedChannels.includes('DEAL_ROOM')) {
      push({
        channel: 'DEAL_ROOM',
        title: 'Predator pressure belongs in Deal Room',
        body: 'Counterplay, bait, threat, and duel posture should route into the predatory negotiation lane.',
        intent: 'observe_deal_room',
        weight: 0.95,
      });
    }

    if (this.isHighPressure(state)) {
      push({
        channel: snapshot.preferredChannel,
        title: 'Expect escalation',
        body: 'Pressure is high enough that helper timing and invasion posture should tighten immediately.',
        intent: 'expect_invasion',
        weight: 0.88,
      });
    }

    if (state.runMode === 'ghost' && this.isHauntWindow(state)) {
      push({
        channel: 'GLOBAL',
        title: 'Ghost pressure is active',
        body: 'Legend markers and divergence gaps should be surfaced as haunted witness, not normal crowd chatter.',
        intent: 'watch_helper',
        weight: 0.84,
      });
    }

    if (snapshot.surfaceId === 'ProofCard' || snapshot.surfaceId === 'ProofCardV2') {
      push({
        channel: snapshot.preferredChannel,
        title: 'Open transcript context',
        body: 'Proof-bearing surfaces gain value when the player can recall exactly who saw the turning point.',
        intent: 'open_transcript',
        weight: 0.72,
      });
    }

    return recommendations
      .sort((a, b) => b.weight - a.weight)
      .slice(0, this.config.maxRecommendations)
      .map(cloneRecommendation);
  }

  private emitWitnessIfNeeded(
    previous: ModeAdapterSnapshot,
    next: ModeAdapterSnapshot,
    state: FrontendModeState,
    reason: ModeAdapterTransitionReason,
  ): void {
    if (!this.config.emitTranscriptWitness && !this.config.emitNotifications && !this.config.emitSocketGameEvents) {
      return;
    }

    const phaseChanged = previous.modeSnapshot.gamePhase !== next.modeSnapshot.gamePhase;
    const surfaceChanged = previous.surfaceId !== next.surfaceId;
    const modeChanged = previous.runMode !== next.runMode;
    const outcomeChanged = previous.modeSnapshot.runOutcome !== next.modeSnapshot.runOutcome;

    if (modeChanged) {
      const body = this.composeModeTransitionBody(next);
      this.emitSystemWitness({
        channel: next.preferredChannel,
        title: `${next.uiLabel} engaged`,
        body,
        severity: 'INFO',
        event: 'MODE_CHANGED',
        metadata: {
          fromMode: previous.runMode,
          toMode: next.runMode,
          screenId: next.surfaceId,
        },
      });
      this.lastSurfaceWitnessAt = now();
      this.lastPhaseWitnessAt = now();
      return;
    }

    if (outcomeChanged && next.modeSnapshot.runOutcome) {
      this.emitSystemWitness({
        channel: next.preferredChannel,
        title: `Run outcome: ${next.modeSnapshot.runOutcome}`,
        body: this.composeOutcomeWitness(state, next),
        severity: next.modeSnapshot.runOutcome === 'FREEDOM' ? 'INFO' : 'WARN',
        event: 'MODE_OUTCOME_CHANGED',
        metadata: {
          outcome: next.modeSnapshot.runOutcome,
          tick: next.tick,
          modeId: next.runMode,
        },
      });
      return;
    }

    if (phaseChanged && this.phaseWitnessReady()) {
      if (!(this.config.suppressWitnessOnRapidTickReduce && reason === 'tick_reduce' && this.shouldSuppressRapidReduceWitness(previous, next))) {
        this.emitSystemWitness({
          channel: next.preferredChannel,
          title: `Phase: ${next.modeSnapshot.gamePhase ?? 'RUN'}`,
          body: this.composePhaseWitness(state, next),
          severity: this.isHighPressure(state) ? 'WARN' : 'INFO',
          event: 'MODE_PHASE_CHANGED',
          metadata: {
            phase: next.modeSnapshot.gamePhase,
            tickTier: next.modeSnapshot.tickTier,
            pressureTier: state.pressureTier,
          },
        });
        this.lastPhaseWitnessAt = now();
      }
    }

    if (surfaceChanged && this.surfaceWitnessReady()) {
      this.emitSystemWitness({
        channel: next.preferredChannel,
        title: `Surface: ${next.surfaceId}`,
        body: this.composeSurfaceWitness(previous, next),
        severity: 'INFO',
        event: 'MODE_SURFACE_CHANGED',
        metadata: {
          fromSurface: previous.surfaceId,
          toSurface: next.surfaceId,
          modeId: next.runMode,
        },
      });
      this.lastSurfaceWitnessAt = now();
    }
  }

  private emitNarrativeSignals(
    snapshot: ModeAdapterSnapshot,
    state: FrontendModeState,
    reason: ModeAdapterTransitionReason,
  ): void {
    const preferredChannels = snapshot.visibleChannels.length > 0
      ? snapshot.visibleChannels
      : [snapshot.preferredChannel];

    if (this.npcDirector && this.config.allowNpcHandling) {
      this.npcDirector.handleGameEvent({
        eventType: this.resolveNpcEventName(snapshot, state, reason),
        payload: this.buildNarrativePayload(snapshot, state, reason),
        preferredChannel: preferredChannels[0],
        metadata: { visibleChannels: preferredChannels },
      });
    }

    if (this.invasionDirector && this.config.allowInvasionHandling && this.shouldSignalInvasion(snapshot, state, reason)) {
      const invasion = this.invasionDirector.handleGameEvent({
        event: this.resolveInvasionEventName(snapshot, state, reason),
        payload: this.buildNarrativePayload(snapshot, state, reason),
        preferredChannels,
      });
      if (invasion) {
        this.emitInvasionSideEffects(invasion, snapshot);
      }
    }
  }

  private emitSystemWitness(input: {
    channel: ChatChannel;
    title: string;
    body: string;
    severity: ChatNotificationSeverity;
    event: string;
    metadata?: Record<string, unknown>;
  }): void {
    const channel = input.channel;

    this.lastSystemWitness = `${input.title}: ${input.body}`;

    if (this.config.emitTranscriptWitness && this.transcriptBuffer) {
      this.transcriptBuffer.insertSystemMessage({
        id: hashKey([
          this.config.namespace,
          input.event,
          channel,
          input.title,
          input.body,
          String(now()),
        ]),
        channel,
        kind: 'SYSTEM',
        senderId: 'SYSTEM',
        senderName: 'SYSTEM',
        body: `${input.title} — ${input.body}`,
        ts: now(),
        metadata: {
          ...(input.metadata ?? {}),
          source: 'ModeAdapter',
          event: input.event,
        },
      });
    }

    if (this.config.emitNotifications && this.notificationController) {
      this.notificationController.noteSystem({
        channel,
        title: input.title,
        body: input.body,
        severity: input.severity,
        metadata: {
          ...(input.metadata ?? {}),
          source: 'ModeAdapter',
          event: input.event,
        },
      });
    }

    if (this.config.emitSocketGameEvents && this.socketClient) {
      this.socketClient.queueGameEvent({
        event: input.event,
        channel,
        metadata: {
          ...(input.metadata ?? {}),
          source: 'ModeAdapter',
        },
      });
    }
  }

  private emitInvasionSideEffects(plan: ChatInvasionPlan, snapshot: ModeAdapterSnapshot): void {
    this.channelPolicy.noteInvasion({
      id: plan.id,
      channel: plan.channel,
      title: plan.title,
      body: plan.body,
      ts: plan.createdAt,
      sourceId: plan.sourceId,
      severity: plan.severity,
      metadata: plan.metadata,
    });

    if (this.config.emitNotifications && this.notificationController) {
      this.notificationController.noteInvasion({
        id: plan.id,
        channel: plan.channel,
        title: plan.title,
        body: plan.body,
        ts: plan.createdAt,
        severity: plan.severity,
        metadata: {
          ...(plan.metadata ?? {}),
          source: 'ModeAdapter',
          modeId: snapshot.runMode,
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Snapshot helpers
  // ---------------------------------------------------------------------------

  private resolveSurfaceId(state: FrontendModeState): ModeAdapterSurfaceId {
    const explicit = normalizeSurfaceId(this.currentContext.surfaceId);
    if (explicit !== 'UNKNOWN') return explicit;

    const fromScreen = normalizeScreenName(state.screenName);
    if (fromScreen !== 'UNKNOWN') return fromScreen;

    switch (state.runMode) {
      case 'solo':
        return 'EmpireGameScreen';
      case 'asymmetric-pvp':
        return 'PredatorGameScreen';
      case 'co-op':
        return 'SyndicateGameScreen';
      case 'ghost':
        return 'PhantomGameScreen';
      default:
        return 'UNKNOWN';
    }
  }

  private resolvePreferredChannel(
    state: FrontendModeState,
    surfaceId: ModeAdapterSurfaceId,
  ): ChatChannel {
    if (this.currentContext.preferredChannel) {
      return this.currentContext.preferredChannel;
    }

    switch (surfaceId) {
      case 'LobbyScreen':
        return 'LOBBY';
      case 'BattleHUD':
      case 'CounterplayModal':
      case 'SabotageImpactPanel':
      case 'ThreatRadarPanel':
        return state.runMode === 'co-op' ? 'SYNDICATE' : 'DEAL_ROOM';
      case 'ProofCard':
      case 'ProofCardV2':
        return state.runMode === 'co-op' ? 'SYNDICATE' : 'GLOBAL';
      case 'RescueWindowBanner':
        return state.runMode === 'co-op' ? 'SYNDICATE' : 'GLOBAL';
      case 'ClubUI':
      case 'LeagueUI':
        return 'GLOBAL';
      default:
        return MODE_DESCRIPTORS[state.runMode].defaultChannel;
    }
  }

  private resolveAllowedChannels(
    state: FrontendModeState,
    descriptor: ModeAdapterModeDescriptor,
    surfaceId: ModeAdapterSurfaceId,
    syndicateId?: string,
    dealId?: string,
  ): ChatChannel[] {
    const base = [...descriptor.allowedChannels];

    if (state.runMode === 'co-op' && !syndicateId) {
      removeValue(base, 'SYNDICATE');
    }

    if (state.runMode === 'asymmetric-pvp' && !dealId && surfaceId !== 'BattleHUD' && surfaceId !== 'CounterplayModal') {
      removeValue(base, 'DEAL_ROOM');
    }

    if (surfaceId === 'LobbyScreen') {
      return uniqueOrdered(['LOBBY', ...base]);
    }

    if (surfaceId === 'ClubUI' || surfaceId === 'LeagueUI') {
      return uniqueOrdered(['GLOBAL', 'LOBBY']);
    }

    if (surfaceId === 'BattleHUD') {
      if (state.runMode === 'co-op') {
        return uniqueOrdered(['SYNDICATE', 'GLOBAL']);
      }
      if (state.runMode === 'asymmetric-pvp') {
        return uniqueOrdered(['DEAL_ROOM', 'GLOBAL']);
      }
    }

    return uniqueOrdered(base);
  }

  private resolveVisibleChannels(
    state: FrontendModeState,
    descriptor: ModeAdapterModeDescriptor,
    surfaceId: ModeAdapterSurfaceId,
    allowed: ChatChannel[],
  ): ChatChannel[] {
    if (surfaceId === 'LobbyScreen') return uniqueOrdered(['LOBBY', ...allowed]);
    if (surfaceId === 'BattleHUD' && state.runMode === 'asymmetric-pvp') return uniqueOrdered(['DEAL_ROOM', 'GLOBAL']);
    if (surfaceId === 'BattleHUD' && state.runMode === 'co-op') return uniqueOrdered(['SYNDICATE', 'GLOBAL']);
    if (surfaceId === 'CounterplayModal') return uniqueOrdered(['DEAL_ROOM']);
    if (surfaceId === 'ThreatRadarPanel') return uniqueOrdered(['GLOBAL']);
    if (surfaceId === 'ProofCard' || surfaceId === 'ProofCardV2') return uniqueOrdered([descriptor.defaultChannel, 'GLOBAL']);
    return uniqueOrdered(allowed);
  }

  private resolveGamePhase(
    state: FrontendModeState,
    screenFamily: ModeAdapterScreenFamily,
  ): string {
    if (screenFamily === 'LOBBY') return 'LOBBY';
    if (screenFamily === 'POST_RUN') return 'POST_RUN';
    if (state.runMode === 'solo') return state.solo?.phase ?? 'RUN';
    if (state.runMode === 'asymmetric-pvp') return state.predator?.counterWindowOpen ? 'COUNTER_WINDOW' : 'DUEL';
    if (state.runMode === 'co-op') return state.syndicate?.warAlert ? 'WAR_ALERT' : 'SYNDICATE_RUN';
    if (state.runMode === 'ghost') return state.phantom?.markerWindowOpen ? 'MARKER_WINDOW' : 'GHOST_RUN';
    return 'RUN';
  }

  private resolveTickTier(state: FrontendModeState): string {
    if (state.tick <= 0) return 'TICK_0';
    if (state.tick < 60) return 'EARLY';
    if (state.tick < 240) return 'MID';
    if (state.tick < 480) return 'LATE';
    return 'ENDGAME';
  }

  private estimateHaterHeat(state: FrontendModeState): number {
    if (state.runMode === 'asymmetric-pvp') {
      const psyche = state.predator?.psycheState ?? 'COMPOSED';
      return psyche === 'DESPERATE'
        ? 0.94
        : psyche === 'BREAKING'
        ? 0.82
        : psyche === 'CRACKING'
        ? 0.68
        : psyche === 'STRESSED'
        ? 0.52
        : 0.28;
    }

    if (state.runMode === 'ghost') {
      return clamp((state.phantom?.gapValue ?? 0) / 100, 0, 1);
    }

    if (state.runMode === 'co-op') {
      return clamp((state.syndicate?.defectionRisk ?? 0) / 100, 0, 1);
    }

    const primaryPressure = metricPct(state.primaryBars, 'pressure')
      ?? pressureTierToScalar(state.pressureTier);

    return clamp(primaryPressure, 0, 1);
  }

  private estimateNegotiationUrgency(
    state: FrontendModeState,
    surfaceId: ModeAdapterSurfaceId,
  ): number {
    if (state.runMode === 'asymmetric-pvp') {
      const battleBudget = state.predator?.battleBudget ?? 0;
      const cap = state.predator?.battleBudgetCap ?? 1;
      const budgetPct = battleBudget / Math.max(cap, 1);
      const psychePenalty = state.predator?.psycheState === 'DESPERATE'
        ? 0.3
        : state.predator?.psycheState === 'BREAKING'
        ? 0.2
        : 0;
      const counterBoost = state.predator?.counterWindowOpen ? 0.18 : 0;
      return clamp((1 - budgetPct) + psychePenalty + counterBoost, 0, 1);
    }

    if (surfaceId === 'CounterplayModal' || surfaceId === 'SabotageImpactPanel') {
      return 0.8;
    }

    return 0;
  }

  private isHighPressure(state: FrontendModeState): boolean {
    return this.estimateHaterHeat(state) >= this.config.highPressureThreshold
      || pressureTierToScalar(state.pressureTier) >= this.config.highPressureThreshold;
  }

  private isCriticalPressure(state: FrontendModeState): boolean {
    return this.estimateHaterHeat(state) >= this.config.criticalPressureThreshold
      || pressureTierToScalar(state.pressureTier) >= this.config.criticalPressureThreshold;
  }

  private isHauntWindow(state: FrontendModeState): boolean {
    if (state.runMode !== 'ghost') return false;
    return clamp((state.phantom?.gapValue ?? 0) / 100, 0, 1) >= this.config.hauntGapThreshold
      || Boolean(state.phantom?.markerWindowOpen);
  }

  private shouldSignalInvasion(
    snapshot: ModeAdapterSnapshot,
    state: FrontendModeState,
    reason: ModeAdapterTransitionReason,
  ): boolean {
    if (reason === 'surface_change' && snapshot.surfaceId === 'LobbyScreen') return false;
    if (state.runMode === 'co-op' && Boolean(state.syndicate?.warAlert)) return true;
    if (state.runMode === 'asymmetric-pvp' && this.estimateNegotiationUrgency(state, snapshot.surfaceId) >= this.config.negotiationUrgencyThreshold) return true;
    if (state.runMode === 'ghost' && this.isHauntWindow(state)) return true;
    return this.isCriticalPressure(state);
  }

  private resolveNpcEventName(
    snapshot: ModeAdapterSnapshot,
    state: FrontendModeState,
    reason: ModeAdapterTransitionReason,
  ): string {
    if (reason === 'bootstrap') return `${snapshot.runMode.toUpperCase()}_BOOTSTRAP`;
    if (reason === 'surface_change') return `${snapshot.surfaceId.toUpperCase()}_SURFACE_ENTER`;
    if (state.runMode === 'co-op' && Boolean(state.syndicate?.warAlert)) return 'SYNDICATE_WAR_ALERT';
    if (state.runMode === 'asymmetric-pvp' && state.predator?.counterWindowOpen) return 'PREDATOR_COUNTER_WINDOW';
    if (state.runMode === 'ghost' && state.phantom?.markerWindowOpen) return 'PHANTOM_MARKER_WINDOW';
    if (this.isHighPressure(state)) return 'MODE_HIGH_PRESSURE';
    return 'MODE_STATE_OBSERVED';
  }

  private resolveInvasionEventName(
    snapshot: ModeAdapterSnapshot,
    state: FrontendModeState,
    reason: ModeAdapterTransitionReason,
  ): string {
    if (state.runMode === 'asymmetric-pvp') {
      return this.estimateNegotiationUrgency(state, snapshot.surfaceId) >= this.config.negotiationUrgencyThreshold
        ? 'PREDATOR_DEALROOM_AMBUSH'
        : 'PREDATOR_DUEL_HEAT';
    }
    if (state.runMode === 'co-op') {
      return Boolean(state.syndicate?.warAlert)
        ? 'SYNDICATE_WAR_ALERT'
        : 'SYNDICATE_TRUST_STRAIN';
    }
    if (state.runMode === 'ghost') {
      return this.isHauntWindow(state)
        ? 'PHANTOM_GHOST_SURGE'
        : 'PHANTOM_PRESSURE_RISE';
    }
    if (reason === 'phase_change' && state.solo?.phase === 'SOVEREIGNTY') {
      return 'EMPIRE_SOVEREIGNTY_WINDOW';
    }
    return this.isCriticalPressure(state)
      ? 'EMPIRE_PRESSURE_SURGE'
      : 'MODE_INCREASED_PRESSURE';
  }

  private buildNarrativePayload(
    snapshot: ModeAdapterSnapshot,
    state: FrontendModeState,
    reason: ModeAdapterTransitionReason,
  ): Record<string, unknown> {
    return {
      modeId: snapshot.runMode,
      modeCode: snapshot.modeCode,
      screenId: snapshot.surfaceId,
      screenFamily: snapshot.screenFamily,
      runId: snapshot.runId,
      roomId: snapshot.roomId,
      seed: snapshot.seed,
      tick: state.tick,
      pressureTier: state.pressureTier,
      narrativeBand: snapshot.narrativeBand,
      preferredChannel: snapshot.preferredChannel,
      visibleChannels: snapshot.visibleChannels,
      reason,
      outcome: state.cord.outcome,
      projectedCord: state.cord.projectedCord,
      projectedGrade: state.cord.projectedGrade,
      haterHeat: this.estimateHaterHeat(state),
      negotiationUrgency: this.estimateNegotiationUrgency(state, snapshot.surfaceId),
      modeSpecific: {
        solo: state.solo,
        predator: state.predator,
        syndicate: state.syndicate,
        phantom: state.phantom,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Witness composition
  // ---------------------------------------------------------------------------

  private composeModeTransitionBody(snapshot: ModeAdapterSnapshot): string {
    switch (snapshot.runMode) {
      case 'solo':
        return 'Empire is active. Isolation, shield posture, and private pressure now shape witness and helper timing.';
      case 'asymmetric-pvp':
        return 'Predator is active. Rival posture, battle budget, and counter windows now govern routing and escalation.';
      case 'co-op':
        return 'Syndicate is active. Trust, treasury, and rescue logic now become the primary social lane.';
      case 'ghost':
        return 'Phantom is active. Divergence, legend markers, and haunted pacing now shape witness and silence.';
      default:
        return 'Mode engaged.';
    }
  }

  private composeOutcomeWitness(
    state: FrontendModeState,
    _snapshot: ModeAdapterSnapshot,
  ): string {
    const grade = state.cord.projectedGrade;
    const cord = state.cord.projectedCord;
    switch (state.cord.outcome) {
      case 'FREEDOM':
        return `Freedom threshold crossed with projected CORD ${cord} (${grade}). Preserve the witness and let the room remember the turn.`;
      case 'BANKRUPT':
        return `Collapse confirmed at tick ${state.tick}. Preserve the turning point, the pressure posture, and the witness trail.`;
      case 'TIMEOUT':
        return `Time expired before extraction. The room should feel the narrow miss, not a generic stop condition.`;
      case 'ABANDONED':
      default:
        return `Run ended without authored closure. Keep witness lean and let post-run narrative absorb the residue.`;
    }
  }

  private composePhaseWitness(
    state: FrontendModeState,
    _snapshot: ModeAdapterSnapshot,
  ): string {
    if (state.runMode === 'solo') {
      return `Empire phase ${state.solo?.phase ?? 'RUN'} at tick ${state.tick}. Pressure tier ${state.pressureTier} with isolation logic still active.`;
    }

    if (state.runMode === 'asymmetric-pvp') {
      return `Predator posture shifted. Psyche is ${state.predator?.psycheState ?? 'COMPOSED'} and counter window is ${state.predator?.counterWindowOpen ? 'open' : 'closed'}.`;
    }

    if (state.runMode === 'co-op') {
      return `Syndicate trust band is ${state.syndicate?.trustBand ?? 'WORKING'} with treasury ${state.syndicate?.treasury ?? 0}.`;
    }

    return `Phantom divergence is ${state.phantom?.gapDirection ?? 'FLAT'} at ${state.phantom?.gapValue ?? 0}. Haunted witness should remain precise.`;
  }

  private composeSurfaceWitness(
    previous: ModeAdapterSnapshot,
    next: ModeAdapterSnapshot,
  ): string {
    return `Surface changed from ${previous.surfaceId} to ${next.surfaceId}. Chat should follow the world without becoming a second UI brain.`;
  }

  // ---------------------------------------------------------------------------
  // History
  // ---------------------------------------------------------------------------

  private buildHistoryEntry(
    state: FrontendModeState,
    snapshot: ModeAdapterSnapshot,
    reason: ModeAdapterTransitionReason,
  ): ModeAdapterHistoryEntry {
    return {
      id: hashKey([
        this.config.namespace,
        'history',
        state.runMode,
        snapshot.surfaceId,
        String(state.tick),
        reason,
        String(now()),
      ]),
      at: now(),
      runMode: state.runMode,
      modeCode: state.modeCode,
      screenName: state.screenName,
      surfaceId: snapshot.surfaceId,
      reason,
      tick: state.tick,
      pressureTier: state.pressureTier,
      outcome: state.cord.outcome,
      summary: this.summarizeHistory(state, snapshot, reason),
      metadata: {
        preferredChannel: snapshot.preferredChannel,
        allowedChannels: snapshot.allowedChannels,
        visibleChannels: snapshot.visibleChannels,
        screenFamily: snapshot.screenFamily,
      },
    };
  }

  private summarizeHistory(
    state: FrontendModeState,
    snapshot: ModeAdapterSnapshot,
    reason: ModeAdapterTransitionReason,
  ): string {
    switch (reason) {
      case 'bootstrap':
        return `${state.runMode} bootstrapped on ${snapshot.surfaceId}.`;
      case 'surface_change':
        return `Surface changed to ${snapshot.surfaceId}.`;
      case 'phase_change':
        return `Phase changed to ${snapshot.modeSnapshot.gamePhase ?? 'RUN'}.`;
      case 'run_outcome_change':
        return `Run outcome changed to ${state.cord.outcome}.`;
      case 'mode_change':
        return `Mode changed to ${state.runMode}.`;
      case 'tick_reduce':
        return `Mode reduced on tick ${state.tick}.`;
      case 'rehydrate':
        return `Mode state rehydrated.`;
      default:
        return `Mode state updated.`;
    }
  }

  private pushHistory(entry: ModeAdapterHistoryEntry): void {
    this.history.push(entry);
    while (this.history.length > this.config.maxHistory) this.history.shift();
    this.callbacks?.onHistoryEntry?.(cloneHistoryEntry(entry));
  }

  // ---------------------------------------------------------------------------
  // Fallback mode-state creation
  // ---------------------------------------------------------------------------

  private createFallbackModeState(
    mode: FrontendRunMode,
    snapshot: EngineSnapshotLike,
    cards: BaseCardLike[],
  ): FrontendModeState {
    const descriptor = MODE_DESCRIPTORS[mode];

    return {
      runMode: mode,
      modeCode: descriptor.modeCode,
      uiLabel: descriptor.uiLabel,
      screenName: descriptor.screenName,
      tick: snapshot.tick,
      elapsedMs: snapshot.elapsedMs,
      totalRunMs: snapshot.totalRunMs,
      pressureTier: snapshot.pressureTier,
      shieldBars: buildShieldBars(snapshot),
      primaryBars: buildPrimaryBars(snapshot),
      eventFeed: [],
      cord: buildFallbackCord(snapshot),
      runtimeCards: cards.map(cloneCard),
      solo: mode === 'solo'
        ? {
            phase: 'FOUNDATION',
            isolationTaxActive: false,
            isolationTaxRate: 0,
            bleedMode: false,
            comebackSurgeActive: false,
            comebackTicks: 0,
            pressureJournalEntry: '',
          }
        : undefined,
      predator: mode === 'asymmetric-pvp'
        ? {
            battleBudget: snapshot.battleBudget ?? 0,
            battleBudgetCap: Math.max(snapshot.battleBudget ?? 0, 1),
            psycheState: 'COMPOSED',
            firstBloodAvailable: true,
            counterWindowOpen: false,
            visibleThreatQueue: [],
            spectatorProjection: {
              liveViewers: 0,
              predictionBiasPct: 0,
              cordLead: 0,
            },
          }
        : undefined,
      syndicate: mode === 'co-op'
        ? {
            treasury: snapshot.team?.treasury ?? 0,
            treasuryCritical: false,
            trustBand: 'WORKING',
            synergyActive: false,
            warAlert: false,
            defectionRisk: 0,
            roles: snapshot.team?.players ?? [],
            proofShareReady: false,
          }
        : undefined,
      phantom: mode === 'ghost'
        ? {
            gapDirection: 'FLAT',
            gapValue: 0,
            legendDecayTier: 'STABLE',
            markerWindowOpen: false,
            currentMarker: null,
            proofBadges: [],
            historicalDifficultyRating: 0,
          }
        : undefined,
    };
  }

  private reduceFallbackModeState(
    previous: FrontendModeState,
    snapshot: EngineSnapshotLike,
    cards: BaseCardLike[],
  ): FrontendModeState {
    const next = this.createFallbackModeState(previous.runMode, snapshot, cards);
    next.eventFeed = previous.eventFeed.slice(-11);
    return next;
  }

  // ---------------------------------------------------------------------------
  // Guards
  // ---------------------------------------------------------------------------

  private phaseWitnessReady(): boolean {
    return now() - this.lastPhaseWitnessAt >= this.config.phaseWitnessCooldownMs;
  }

  private surfaceWitnessReady(): boolean {
    return now() - this.lastSurfaceWitnessAt >= this.config.surfaceWitnessCooldownMs;
  }

  private shouldSuppressRapidReduceWitness(
    previous: ModeAdapterSnapshot,
    next: ModeAdapterSnapshot,
  ): boolean {
    if ((next.tick ?? 0) <= (previous.tick ?? 0)) return false;
    return (next.tick ?? 0) - (previous.tick ?? 0) < 3;
  }

  private assertNotDestroyed(method: string): void {
    if (this.destroyed) {
      throw new Error(`[ModeAdapter] ${method} called after destroy()`);
    }
  }

  private createEmptySnapshot(): ModeAdapterSnapshot {
    const descriptor = MODE_DESCRIPTORS.solo;
    const modeSnapshot: ChatModeSnapshot = {
      modeId: descriptor.runMode,
      modeFamily: descriptor.modeCode,
      screenId: 'UNKNOWN',
      isMounted: false,
      isPreRun: false,
      isInRun: false,
      isPostRun: false,
      isMultiplayer: false,
      isNegotiationWindow: false,
      isDealVisible: false,
      isSyndicateVisible: false,
      isLobbyVisible: false,
      allowGlobal: true,
      allowSyndicate: false,
      allowDealRoom: false,
      allowLobby: false,
      pressureTier: 'T0',
      tickTier: 'TICK_0',
      runOutcome: 'ABANDONED',
      haterHeat: 0,
      negotiationUrgency: 0,
      metadata: {},
    };

    return {
      runMode: descriptor.runMode,
      modeCode: descriptor.modeCode,
      uiLabel: descriptor.uiLabel,
      screenName: descriptor.screenName,
      screenFamily: 'UNKNOWN',
      narrativeBand: descriptor.narrativeBand,
      surfaceId: 'UNKNOWN',
      tick: 0,
      preferredChannel: descriptor.defaultChannel,
      allowedChannels: [...descriptor.allowedChannels],
      visibleChannels: [...descriptor.visibleChannels],
      activeRecommendations: [],
      recentHistory: [],
      modeSnapshot,
    };
  }
}

export function createModeAdapter(options: ModeAdapterOptions): ModeAdapter {
  return new ModeAdapter(options);
}

// -----------------------------------------------------------------------------
// Internal utilities
// -----------------------------------------------------------------------------

function normalizeSurfaceId(surfaceId: ModeAdapterSurfaceId | undefined): ModeAdapterSurfaceId {
  return surfaceId ?? 'UNKNOWN';
}

function normalizeScreenName(screenName: string | undefined): ModeAdapterSurfaceId {
  if (!screenName) return 'UNKNOWN';

  switch (screenName) {
    case 'LobbyScreen':
    case 'GameBoard':
    case 'BattleHUD':
    case 'EmpireGameScreen':
    case 'PredatorGameScreen':
    case 'SyndicateGameScreen':
    case 'PhantomGameScreen':
    case 'ClubUI':
    case 'LeagueUI':
    case 'CounterplayModal':
    case 'EmpireBleedBanner':
    case 'MomentFlash':
    case 'ProofCard':
    case 'ProofCardV2':
    case 'RescueWindowBanner':
    case 'SabotageImpactPanel':
    case 'ThreatRadarPanel':
      return screenName;
    default:
      return 'UNKNOWN';
  }
}

function buildShieldBars(snapshot: EngineSnapshotLike): MetricBar[] {
  const ordered: Array<'L1' | 'L2' | 'L3' | 'L4'> = ['L1', 'L2', 'L3', 'L4'];
  return ordered.map((layer) => {
    const current = snapshot.shields[layer] ?? 0;
    const max = 100;
    return {
      id: layer,
      label: layer,
      current,
      max,
      pct: clamp(current / max, 0, 1),
      colorToken: current > 66 ? 'shield-safe' : current > 33 ? 'shield-strained' : 'shield-broken',
    };
  });
}

function buildPrimaryBars(snapshot: EngineSnapshotLike): MetricBar[] {
  const freedomDenom = Math.max(snapshot.freedomThreshold, 1);
  return [
    {
      id: 'cash',
      label: 'Cash',
      current: snapshot.cash,
      max: Math.max(snapshot.cash, 1),
      pct: 1,
      colorToken: 'cash',
    },
    {
      id: 'net-worth',
      label: 'Net Worth',
      current: snapshot.netWorth,
      max: Math.max(snapshot.netWorth, 1),
      pct: 1,
      colorToken: 'net-worth',
    },
    {
      id: 'pressure',
      label: 'Pressure',
      current: Math.round(pressureTierToScalar(snapshot.pressureTier) * 100),
      max: 100,
      pct: pressureTierToScalar(snapshot.pressureTier),
      colorToken: 'pressure',
    },
    {
      id: 'freedom-threshold',
      label: 'Freedom',
      current: snapshot.netWorth,
      max: freedomDenom,
      pct: clamp(snapshot.netWorth / freedomDenom, 0, 1),
      colorToken: 'freedom',
    },
  ];
}

function buildFallbackCord(snapshot: EngineSnapshotLike): CORDProjection {
  const projectedCord = Math.round(
    clamp(
      (
        (snapshot.netWorth / Math.max(snapshot.freedomThreshold, 1)) * 45
        + (1 - pressureTierToScalar(snapshot.pressureTier)) * 25
        + ((snapshot.blockedSabotages ?? 0) * 3)
        + ((snapshot.cascadeChainsBroken ?? 0) * 2)
      ),
      0,
      100,
    ),
  );

  return {
    projectedCord,
    projectedGrade: cordToGrade(projectedCord),
    outcome: projectedCord >= 70 ? 'FREEDOM' : 'ABANDONED',
    componentBreakdown: {
      netWorth: round((snapshot.netWorth / Math.max(snapshot.freedomThreshold, 1)) * 45, 2),
      pressure: round((1 - pressureTierToScalar(snapshot.pressureTier)) * 25, 2),
      blockedSabotages: round((snapshot.blockedSabotages ?? 0) * 3, 2),
      cascadeChainsBroken: round((snapshot.cascadeChainsBroken ?? 0) * 2, 2),
    },
    appliedBonuses: [],
    ceiling: 100,
  };
}

function cordToGrade(value: number): CORDProjection['projectedGrade'] {
  if (value >= 93) return 'S';
  if (value >= 85) return 'A';
  if (value >= 75) return 'B';
  if (value >= 65) return 'C';
  if (value >= 55) return 'D';
  return 'F';
}

function pressureTierToScalar(tier: PressureTier | string | undefined): number {
  switch (tier) {
    case 'T4': return 1;
    case 'T3': return 0.76;
    case 'T2': return 0.54;
    case 'T1': return 0.28;
    case 'T0':
    default:
      return 0.08;
  }
}

function metricPct(metrics: MetricBar[], id: string): number | undefined {
  return metrics.find((entry) => entry.id === id)?.pct;
}

function visibleHas(visibleChannels: ChatChannel[], channel: ChatChannel): boolean {
  return visibleChannels.includes(channel);
}

function normalizeSeed(seed: string | number | undefined): string | undefined {
  if (seed === undefined || seed === null) return undefined;
  return String(seed);
}

function cloneDescriptor(entry: ModeAdapterModeDescriptor): ModeAdapterModeDescriptor {
  return {
    ...entry,
    playerRange: [...entry.playerRange] as [number, number],
    allowedChannels: [...entry.allowedChannels],
    visibleChannels: [...entry.visibleChannels],
  };
}

function cloneModeState(state: FrontendModeState): FrontendModeState {
  return {
    ...state,
    shieldBars: state.shieldBars.map((entry) => ({ ...entry })),
    primaryBars: state.primaryBars.map((entry) => ({ ...entry })),
    eventFeed: state.eventFeed.map((entry) => ({ ...entry })),
    cord: {
      ...state.cord,
      componentBreakdown: { ...state.cord.componentBreakdown },
      appliedBonuses: [...state.cord.appliedBonuses],
    },
    runtimeCards: state.runtimeCards.map(cloneCard),
    solo: state.solo ? {
      ...state.solo,
      holdState: state.solo.holdState ? { ...state.solo.holdState } : undefined,
    } : undefined,
    predator: state.predator ? {
      ...state.predator,
      visibleThreatQueue: [...state.predator.visibleThreatQueue],
      spectatorProjection: { ...state.predator.spectatorProjection },
    } : undefined,
    syndicate: state.syndicate ? {
      ...state.syndicate,
      roles: state.syndicate.roles.map((entry) => ({ ...entry })),
    } : undefined,
    phantom: state.phantom ? {
      ...state.phantom,
      currentMarker: state.phantom.currentMarker ? { ...state.phantom.currentMarker } : null,
      proofBadges: [...state.phantom.proofBadges],
    } : undefined,
  };
}

function cloneCard(card: BaseCardLike): BaseCardLike {
  return {
    ...card,
    tags: [...card.tags],
  };
}

function cloneHistoryEntry(entry: ModeAdapterHistoryEntry): ModeAdapterHistoryEntry {
  return {
    ...entry,
    metadata: entry.metadata ? { ...entry.metadata } : undefined,
  };
}

function cloneRecommendation(entry: ModeAdapterRecommendation): ModeAdapterRecommendation {
  return {
    ...entry,
    metadata: entry.metadata ? { ...entry.metadata } : undefined,
  };
}

function cloneSnapshot(entry: ModeAdapterSnapshot): ModeAdapterSnapshot {
  return {
    ...entry,
    allowedChannels: [...entry.allowedChannels],
    visibleChannels: [...entry.visibleChannels],
    activeRecommendations: entry.activeRecommendations.map(cloneRecommendation),
    recentHistory: entry.recentHistory.map(cloneHistoryEntry),
    modeSnapshot: {
      ...entry.modeSnapshot,
      metadata: entry.modeSnapshot.metadata ? { ...entry.modeSnapshot.metadata } : undefined,
    },
  };
}

function mergeConfig(
  base: ModeAdapterConfig,
  next: Partial<ModeAdapterConfig> | undefined,
): ModeAdapterConfig {
  if (!next) return { ...base };
  return {
    ...base,
    ...stripUndefined(next),
  };
}

function stripUndefined<T extends Record<string, unknown>>(input: T): T {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) output[key] = value;
  }
  return output as T;
}

function hashKey(parts: readonly string[]): string {
  let hash = 2166136261;
  for (const segment of parts) {
    for (let i = 0; i < segment.length; i += 1) {
      hash ^= segment.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
  }
  return `mode_${(hash >>> 0).toString(16)}`;
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  Object.freeze(value);
  for (const key of Object.keys(value as object)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const child = (value as any)[key];
    if (child && typeof child === 'object' && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return value;
}

function uniqueOrdered<T>(items: readonly T[]): T[] {
  const seen = new Set<T>();
  const output: T[] = [];
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    output.push(item);
  }
  return output;
}

function removeValue<T>(items: T[], value: T): void {
  const index = items.indexOf(value);
  if (index >= 0) items.splice(index, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function now(): number {
  return Date.now();
}
