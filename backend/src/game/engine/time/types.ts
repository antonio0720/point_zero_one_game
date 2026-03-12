/**
 * FILE: pzo-web/src/engines/time/types.ts
 * All types for the Time Engine. No runtime logic.
 */

/** Five adaptive tick rate tiers. T0 = winning, T4 = collapsing. */
export enum TickTier {
  SOVEREIGN = 'T0', // net worth > 3× freedom threshold, zero active threats
  STABLE = 'T1', // default: positive cashflow, no active threats
  COMPRESSED = 'T2', // cashflow neutral OR mild threat active
  CRISIS = 'T3', // negative cashflow OR hater_heat > 60
  COLLAPSE_IMMINENT = 'T4', // negative cash balance OR shield fully broken
}

/** Per-tier timing + presentation configuration. */
export interface TickTierConfig {
  tier: TickTier;
  minDurationMs: number; // fastest this tier ever fires
  maxDurationMs: number; // slowest this tier ever fires
  defaultDurationMs: number; // target duration used in interpolation
  decisionWindowMs: number; // how long player has to respond to a forced card
  visualBorderClass: string; // CSS class name applied to TickPressureBorder component
  audioSignal: string | null; // audio cue key. null if no sound at this tier
  screenShake: boolean; // true only at T4 COLLAPSE_IMMINENT
}

/** Ground-truth timing config for all five tiers. */
export const TICK_TIER_CONFIGS: Record<TickTier, TickTierConfig> = {
  [TickTier.SOVEREIGN]: {
    tier: TickTier.SOVEREIGN,
    minDurationMs: 18_000,
    maxDurationMs: 22_000,
    defaultDurationMs: 20_000,
    decisionWindowMs: 12_000,
    visualBorderClass: 'border-sovereign',
    audioSignal: 'tick_sovereign',
    screenShake: false,
  },
  [TickTier.STABLE]: {
    tier: TickTier.STABLE,
    minDurationMs: 12_000,
    maxDurationMs: 14_000,
    defaultDurationMs: 13_000,
    decisionWindowMs: 8_000,
    visualBorderClass: 'border-stable',
    audioSignal: 'tick_standard',
    screenShake: false,
  },
  [TickTier.COMPRESSED]: {
    tier: TickTier.COMPRESSED,
    minDurationMs: 7_000,
    maxDurationMs: 9_000,
    defaultDurationMs: 8_000,
    decisionWindowMs: 5_000,
    visualBorderClass: 'border-compressed',
    audioSignal: 'tick_compressed',
    screenShake: false,
  },
  [TickTier.CRISIS]: {
    tier: TickTier.CRISIS,
    minDurationMs: 3_000,
    maxDurationMs: 5_000,
    defaultDurationMs: 4_000,
    decisionWindowMs: 3_000,
    visualBorderClass: 'border-crisis',
    audioSignal: 'tick_crisis',
    screenShake: false,
  },
  [TickTier.COLLAPSE_IMMINENT]: {
    tier: TickTier.COLLAPSE_IMMINENT,
    minDurationMs: 1_000,
    maxDurationMs: 2_000,
    defaultDurationMs: 1_500,
    decisionWindowMs: 1_500,
    visualBorderClass: 'border-collapse',
    audioSignal: 'tick_collapse',
    screenShake: true,
  },
} as const;

/** Mirror of PressureEngine PressureTier. Keep in sync with pressure/types.ts. */
export enum PressureTier {
  CALM = 'CALM', // pressure 0.00–0.20
  BUILDING = 'BUILDING', // 0.21–0.40
  ELEVATED = 'ELEVATED', // 0.41–0.60
  HIGH = 'HIGH', // 0.61–0.80
  CRITICAL = 'CRITICAL', // 0.81–1.00
}

/** Read-only bridge used by TimeEngine instead of importing PressureEngine directly. */
export interface PressureReader {
  readonly score: number; // 0.0–1.0
  readonly tier: PressureTier;
}

/** Maps PressureTier to corresponding TickTier. */
export function pressureTierToTickTier(p: PressureTier): TickTier {
  const map: Record<PressureTier, TickTier> = {
    [PressureTier.CALM]: TickTier.SOVEREIGN,
    [PressureTier.BUILDING]: TickTier.STABLE,
    [PressureTier.ELEVATED]: TickTier.COMPRESSED,
    [PressureTier.HIGH]: TickTier.CRISIS,
    [PressureTier.CRITICAL]: TickTier.COLLAPSE_IMMINENT,
  };
  return map[p];
}

/** Time-sensitive forced-decision card categories. */
export enum DecisionCardType {
  FORCED_FATE = 'FORCED_FATE', // scenario / historical fate card
  HATER_INJECTION = 'HATER_INJECTION', // injected by an active hater bot
  CRISIS_EVENT = 'CRISIS_EVENT', // macro economic shock or policy change
}

/** Per-card countdown state. */
export interface DecisionWindow {
  windowId: string; // uuid — unique per window instance, not per card
  cardId: string; // the card this window is attached to
  cardType: DecisionCardType; // FORCED_FATE | HATER_INJECTION | CRISIS_EVENT
  durationMs: number; // total window duration set at open time
  remainingMs: number; // countdown — decremented every 100ms by DecisionTimer
  openedAtMs: number; // Date.now() when window was created
  expiresAtMs: number; // Date.now() + durationMs at creation time
  isOnHold: boolean; // true while hold action is active on this window
  holdExpiresAtMs: number | null; // epoch ms when hold freeze ends. null if not on hold
  worstOptionIndex: number; // option index used on auto-resolve
  isExpired: boolean; // true after auto-resolve fires
  isResolved: boolean; // true if player chose an option before expiry
}

/** Generic helper payload for stores / UI that need countdown deltas. */
export interface DecisionWindowTickEvent {
  eventType: 'DECISION_WINDOW_TICK';
  windowId: string;
  remainingMs: number;
  timestamp: number;
}

/** Emitted at end of every tick cycle. */
export interface TickEvent {
  eventType: 'TICK_COMPLETE';
  tickNumber: number; // 1-indexed immutable run counter
  tickDurationMs: number; // actual ms of the tick that just completed
  tier: TickTier; // tier active during this tick
  tierChangedThisTick: boolean; // true if setTierFromPressure() changed tier this tick
  previousTier: TickTier | null; // null if no change or first tick
  timestamp: number; // Date.now() at emission
  decisionsExpiredThisTick: string[]; // windowIds that expired this tick
  decisionsResolvedThisTick: string[]; // windowIds player manually resolved
  holdActionUsedThisTick: boolean;
}

/** Emitted when time tier changes. */
export interface TierChangeEvent {
  eventType: 'TICK_TIER_CHANGED';
  from: TickTier;
  to: TickTier;
  interpolationTicks: number;
  timestamp: number;
}

/** Emitted when a decision window opens. */
export interface DecisionWindowOpenedEvent {
  eventType: 'DECISION_WINDOW_OPENED';
  window: DecisionWindow;
}

/** Emitted when a decision window expires and auto-resolves. */
export interface DecisionWindowExpiredEvent {
  eventType: 'DECISION_WINDOW_EXPIRED';
  windowId: string;
  cardId: string;
  autoResolvedToOptionIndex: number;
  holdWasActive: boolean;
}

/** Emitted when a decision window resolves manually or is nullified. */
export interface DecisionWindowResolvedEvent {
  eventType: 'DECISION_WINDOW_RESOLVED';
  windowId: string;
  cardId: string;
  chosenOptionIndex: number; // -1 allowed for nullified resolution
  msRemainingAtResolution: number;
}

/** Emitted when the run’s single hold is consumed. */
export interface HoldActionUsedEvent {
  eventType: 'HOLD_ACTION_USED';
  windowId: string;
  holdDurationMs: number;
  holdExpiresAtMs: number;
  holdsRemainingInRun: number;
}

/** Emitted when the season tick budget is exhausted. */
export interface RunTimeoutEvent {
  eventType: 'RUN_TIMEOUT';
  ticksElapsed: number;
  outcome: 'TIMEOUT';
}

/** Emitted when a tier is forcibly overridden by tutorial/admin logic. */
export interface TickTierForcedEvent {
  eventType: 'TICK_TIER_FORCED';
  tier: TickTier;
  durationTicks: number;
  timestamp: number;
}

/** Real-world season window categories. */
export enum SeasonWindowType {
  KICKOFF = 'KICKOFF',
  LIVEOPS_EVENT = 'LIVEOPS_EVENT',
  SEASON_FINALE = 'SEASON_FINALE', // last 72 hours of season
  ARCHIVE_CLOSE = 'ARCHIVE_CLOSE', // when past season closes for purchase
  REENGAGE_WINDOW = 'REENGAGE_WINDOW', // triggered after 14+ day lapse
}

/** Real-world season window definition. */
export interface SeasonTimeWindow {
  windowId: string;
  type: SeasonWindowType;
  startsAtMs: number; // epoch ms
  endsAtMs: number; // epoch ms
  isActive: boolean;
  pressureMultiplier: number; // 1.0 = no effect. 1.3 = 30% pressure boost during finale
}

/** Shared union of all Time Engine events for strongly typed consumers. */
export type TimeEngineEvent =
  | TickEvent
  | TierChangeEvent
  | DecisionWindowOpenedEvent
  | DecisionWindowExpiredEvent
  | DecisionWindowResolvedEvent
  | DecisionWindowTickEvent
  | HoldActionUsedEvent
  | RunTimeoutEvent
  | TickTierForcedEvent;

/** Event-name → payload map for adapters that want keyed typing. */
export interface TimeEngineEventMap {
  TICK_COMPLETE: TickEvent;
  TICK_TIER_CHANGED: TierChangeEvent;
  DECISION_WINDOW_OPENED: DecisionWindowOpenedEvent;
  DECISION_WINDOW_EXPIRED: DecisionWindowExpiredEvent;
  DECISION_WINDOW_RESOLVED: DecisionWindowResolvedEvent;
  DECISION_WINDOW_TICK: DecisionWindowTickEvent;
  HOLD_ACTION_USED: HoldActionUsedEvent;
  RUN_TIMEOUT: RunTimeoutEvent;
  TICK_TIER_FORCED: TickTierForcedEvent;
}