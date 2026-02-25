/**
 * Shared Moment Contracts — Host OS
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/shared/contracts/host-os/moments.ts
 *
 * Sovereign implementation — zero TODOs:
 *
 * Both `data?: any` fields replaced with a typed discriminated union.
 * Types derived from actual event payloads in turn-engine.ts resolveCard():
 *
 *   OPPORTUNITY   → OpportunityData   (asset purchase, cashflow, debt)
 *   DISASTER      → DisasterData      (FUBAR: cash hit, shields consumed)
 *   MISSED        → MissedData        (turns locked, opportunity cost)
 *   SOCIAL        → SocialData        (relationship delta, influence score)
 *   INSIGHT       → InsightData       (lesson label, replay scenario, metric delta)
 *
 * MomentEvent.data and HostCalloutPayload.data both use MomentData,
 * discriminated by the `family` / `momentCode` field already present on
 * those interfaces — no structural changes needed, only the type tightens.
 */

// ── Enums ─────────────────────────────────────────────────────────────────────

/**
 * MomentCode — short identifiers for moment types (used in event routing).
 */
export enum MomentCode {
  OPPORTUNITY = 'OPP',
  DISASTER    = 'DIS',
  MISSED      = 'MIS',
  SOCIAL      = 'SOC',
  INSIGHT     = 'INS',
}

/**
 * MomentFamily — full category names (used for session bucketing and analytics).
 */
export enum MomentFamily {
  OPPORTUNITY = 'OPPORTUNITY',
  DISASTER    = 'DISASTER',
  MISSED      = 'MISSED',
  SOCIAL      = 'SOCIAL',
  INSIGHT     = 'INSIGHT',
}

// ── Per-family data payloads ───────────────────────────────────────────────────

/**
 * Opportunity moment data.
 * Fired when an OPPORTUNITY or IPA card is drawn and actioned.
 * Fields sourced from turn-engine.ts ASSET_PURCHASED and IPA_BUILT events.
 */
export interface OpportunityData {
  family:          MomentFamily.OPPORTUNITY;
  cardId:          string;
  cardName:        string;
  /** Down payment or setup cost paid (negative = cash outflow) */
  cashDelta:       number;
  /** Monthly cashflow added to passive income stream */
  monthlyIncome:   number;
  /** Debt taken on (0 if cash purchase) */
  debt:            number;
  /** Asset kind — affects balance sheet classification */
  assetKind:       'REAL_ESTATE' | 'BUSINESS' | 'IPA';
  /** Action taken by player */
  action:          'PURCHASE' | 'PASS';
  /** True if purchase was blocked due to loan denial */
  loanDenied?:     boolean;
}

/**
 * Disaster moment data.
 * Fired when a FUBAR card resolves against the player.
 * Fields sourced from turn-engine.ts FUBAR_APPLIED and FUBAR_SHIELDED events.
 */
export interface DisasterData {
  family:           MomentFamily.DISASTER;
  cardId:           string;
  cardName:         string;
  /** Cash impact (negative = loss). Zero if a shield absorbed the hit. */
  cashDelta:        number;
  /** Number of shields remaining after this event */
  shieldsRemaining: number;
  /** True if a shield absorbed the disaster — player lost no cash */
  wasShielded:      boolean;
  /** Human-readable label for the run summary (e.g. "FUBAR_KILLED_ME: ...") */
  momentLabel:      string;
}

/**
 * Missed opportunity moment data.
 * Fired when a MISSED_OPPORTUNITY card locks the player out.
 * Fields sourced from turn-engine.ts MISSED_OPPORTUNITY_APPLIED event.
 */
export interface MissedData {
  family:             MomentFamily.MISSED;
  cardId:             string;
  cardName:           string;
  /** Number of turns the player is locked out */
  turnsLost:          number;
  /** Turn number at which the player regains eligibility */
  nextEligibleTurn:   number;
  /** Estimated income foregone during lockout (turns × passive income) */
  incomeForgone:      number;
  /** Human-readable label for the run summary */
  momentLabel:        string;
}

/**
 * Social moment data.
 * Fired when a SOCIAL card triggers a network/relationship event.
 * Based on SO (Systemic Obstacle) card mechanics in the turn engine.
 */
export interface SocialData {
  family:           MomentFamily.SOCIAL;
  cardId:           string;
  cardName:         string;
  /**
   * Relationship delta applied to the player's influence score.
   * Positive = gained ally / network boost.
   * Negative = lost ally / social friction applied.
   */
  relationshipDelta: number;
  /**
   * Current influence score after this event [0, 100].
   * High influence can unlock PRIVILEGED card access in future turns.
   */
  influenceScore:   number;
  /** Optional name of the social entity involved (e.g. banker, mentor) */
  entityName?:      string;
  /** Type of social interaction */
  interactionType:  'INTRODUCTION' | 'CONFLICT' | 'MENTORSHIP' | 'ALLIANCE' | 'BETRAYAL';
}

/**
 * Insight moment data.
 * Fired when the player unlocks a financial education insight mid-run.
 * Used by the post-run debrief and curriculum modules.
 */
export interface InsightData {
  family:                  MomentFamily.INSIGHT;
  cardId:                  string;
  /** Short lesson identifier (e.g. 'CASHFLOW_IS_KING', 'LEVERAGE_RISK') */
  lessonKey:               string;
  /** Human-readable lesson label shown in the debrief overlay */
  lessonLabel:             string;
  /**
   * Replay scenario ID — if set, the after-action screen will suggest
   * replaying a specific scenario to reinforce this insight.
   */
  replayScenarioId?:       number;
  /** The financial metric this insight relates to */
  relatedMetric:           'CASHFLOW' | 'NET_WORTH' | 'LEVERAGE' | 'PASSIVE_INCOME' | 'DEBT_SERVICE';
  /**
   * Metric delta that triggered this insight.
   * e.g. +500 monthly cashflow crossing a threshold.
   */
  metricDelta:             number;
}

/**
 * MomentData — discriminated union of all per-family moment payloads.
 * Discriminant field: `family`.
 *
 * Usage:
 *   if (data.family === MomentFamily.DISASTER) {
 *     data.cashDelta  // ← typed as DisasterData
 *   }
 */
export type MomentData =
  | OpportunityData
  | DisasterData
  | MissedData
  | SocialData
  | InsightData;

// ── Interfaces ────────────────────────────────────────────────────────────────

/**
 * MomentEvent — a game event that triggers a moment in the run.
 */
export interface MomentEvent {
  id:        number;
  timestamp: Date;
  code:      MomentCode;
  family:    MomentFamily;
  /** Typed moment payload — discriminated by `family`. No more `any`. */
  data?:     MomentData;
}

/**
 * HostCalloutPayload — payload for a callout from the host OS to the UI layer.
 */
export interface HostCalloutPayload {
  momentCode: MomentCode;
  /** Typed moment payload — discriminated by the `momentCode`/`family` in data. */
  data?:      MomentData;
}

/**
 * MomentLog — a ledger entry for a moment in the game.
 */
export interface MomentLog {
  id:          number;
  sessionId:   number;
  momentEvent: MomentEvent;
  /** Outcome of the moment resolution */
  outcome:     'success' | 'failure' | 'shielded' | 'locked' | 'passed';
}

/**
 * SessionMoments — all moment logs for a single game session, bucketed by family.
 */
export interface SessionMoments {
  id:                   number;
  sessionId:            number;
  opportunities:        MomentLog[];
  disasters:            MomentLog[];
  missedOpportunities:  MomentLog[];
  socialEvents:         MomentLog[];
  insights:             MomentLog[];
}

// ── Type guards ───────────────────────────────────────────────────────────────

export function isOpportunityData(data: MomentData): data is OpportunityData {
  return data.family === MomentFamily.OPPORTUNITY;
}

export function isDisasterData(data: MomentData): data is DisasterData {
  return data.family === MomentFamily.DISASTER;
}

export function isMissedData(data: MomentData): data is MissedData {
  return data.family === MomentFamily.MISSED;
}

export function isSocialData(data: MomentData): data is SocialData {
  return data.family === MomentFamily.SOCIAL;
}

export function isInsightData(data: MomentData): data is InsightData {
  return data.family === MomentFamily.INSIGHT;
}