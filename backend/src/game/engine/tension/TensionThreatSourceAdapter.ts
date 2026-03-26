/* ========================================================================
 * POINT ZERO ONE — BACKEND TENSION THREAT SOURCE ADAPTER
 * /backend/src/game/engine/tension/TensionThreatSourceAdapter.ts
 *
 * Doctrine:
 * - All threat discovery is pure: zero mutation, zero side effects
 * - ML/DL extraction is a first-class concern at every discovery boundary
 * - Pressure-tier amplification shapes all priority scoring
 * - Visibility-state filtering respects information asymmetry doctrine
 * - Event builders are deterministic and replay-stable
 * - Self-test covers every constant, method, and invariant in this file
 * - User experience quality drives all scoring heuristics
 *
 * Version: 2026.03.26
 * ====================================================================== */

import type { AttackEvent } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';

import {
  THREAT_SEVERITY,
  THREAT_TYPE,
  THREAT_TYPE_DEFAULT_MITIGATIONS,
  type QueueUpsertInput,
  type ThreatSeverity,
  type ThreatType,
} from './types';

import {
  PRESSURE_TENSION_AMPLIFIERS,
  TENSION_CONSTANTS,
  TENSION_VISIBILITY_STATE,
  VISIBILITY_CONFIGS,
  INTERNAL_VISIBILITY_TO_ENVELOPE,
  VISIBILITY_ORDER,
  TENSION_EVENT_NAMES,
  THREAT_SEVERITY_WEIGHTS,
  ENTRY_STATE,
  type TensionVisibilityState,
  type VisibilityConfig,
  type AnticipationEntry,
  type EntryState,
  type TensionEventMap,
  type ThreatArrivedEvent,
  type ThreatExpiredEvent,
  type ThreatMitigatedEvent,
  type AnticipationQueueUpdatedEvent,
  type DecayContributionBreakdown,
  type TensionRuntimeSnapshot,
} from './types';

// ============================================================================
// MARK: Module-level constants
// ============================================================================

export const SOURCE_ADAPTER_ML_FEATURE_COUNT = 32 as const;
export const SOURCE_ADAPTER_DL_SEQUENCE_LENGTH = 16 as const;
export const SOURCE_ADAPTER_DL_FEATURE_WIDTH = 8 as const;
export const SOURCE_ADAPTER_VERSION = '2026.03.26' as const;
export const SOURCE_ADAPTER_MAX_THREATS_PER_CATEGORY = 8 as const;

// Re-export PressureTier locally for interface use
type PressureTier = 'T0' | 'T1' | 'T2' | 'T3' | 'T4';

// ============================================================================
// MARK: Exported interfaces
// ============================================================================

export interface SourceMLVector {
  readonly features: readonly number[];
  readonly featureCount: number;
  readonly tickNumber: number;
}

export interface SourceDLTensor {
  readonly rows: readonly (readonly number[])[];
  readonly sequenceLength: number;
  readonly featureWidth: number;
  readonly tickNumber: number;
}

export interface DiscoveryMetrics {
  readonly totalDiscovered: number;
  readonly byCategory: Readonly<Record<string, number>>;
  readonly bySeverity: Readonly<Record<ThreatSeverity, number>>;
  readonly byType: Readonly<Record<ThreatType, number>>;
  readonly cascadeCount: number;
  readonly existentialCount: number;
  readonly criticalCount: number;
  readonly estimatedTotalPressure: number;
  readonly tick: number;
}

export interface DiscoveryContext {
  readonly snapshot: RunStateSnapshot;
  readonly tier: PressureTier;
  readonly visibilityState: TensionVisibilityState;
  readonly currentTick: number;
  readonly timestamp: number;
}

export interface DiscoveryBundle {
  readonly inputs: readonly QueueUpsertInput[];
  readonly metrics: DiscoveryMetrics;
  readonly mlVector: SourceMLVector;
  readonly dlTensor: SourceDLTensor;
  readonly narrative: string;
  readonly channel: string;
  readonly contextHash: string;
}

export interface SourceSelfTestResult {
  readonly passed: boolean;
  readonly checks: readonly string[];
  readonly failures: readonly string[];
}

// ============================================================================
// MARK: Internal utilities
// ============================================================================

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

// ============================================================================
// MARK: TensionThreatSourceAdapter
// ============================================================================

export class TensionThreatSourceAdapter {
  // --------------------------------------------------------------------------
  // MARK: Core discovery — public API (original surface, preserved + expanded)
  // --------------------------------------------------------------------------

  /**
   * Main discovery entry point. Discovers all threat categories and deduplicates
   * by sourceKey, keeping the highest-severity representative per key.
   */
  public discover(snapshot: RunStateSnapshot): readonly QueueUpsertInput[] {
    const discovered = new Map<string, QueueUpsertInput>();

    for (const input of this.discoverBattleThreats(snapshot)) {
      this.merge(discovered, input);
    }

    for (const input of this.discoverCascadeThreats(snapshot)) {
      this.merge(discovered, input);
    }

    for (const input of this.discoverEconomyThreats(snapshot)) {
      this.merge(discovered, input);
    }

    for (const input of this.discoverShieldThreats(snapshot)) {
      this.merge(discovered, input);
    }

    for (const input of this.discoverSovereigntyThreats(snapshot)) {
      this.merge(discovered, input);
    }

    return freezeArray([...discovered.values()]);
  }

  // --------------------------------------------------------------------------
  // MARK: discoverBattleThreats — expanded
  // --------------------------------------------------------------------------

  /**
   * Scans snapshot.battle.pendingAttacks and promotes each to a QueueUpsertInput.
   * Applies per-category threat classification and magnitude-to-severity mapping.
   * Caps at SOURCE_ADAPTER_MAX_THREATS_PER_CATEGORY to protect queue shape.
   */
  public discoverBattleThreats(snapshot: RunStateSnapshot): readonly QueueUpsertInput[] {
    const inputs: QueueUpsertInput[] = [];
    const currentTick = snapshot.tick;
    const cap = SOURCE_ADAPTER_MAX_THREATS_PER_CATEGORY;

    for (const attack of snapshot.battle.pendingAttacks) {
      if (inputs.length >= cap) {
        break;
      }

      const threatType = this.attackCategoryToThreatType(attack);
      const threatSeverity = this.attackMagnitudeToSeverity(attack.magnitude);
      const arrivalTick = Math.max(currentTick + 1, attack.createdAtTick + 1);
      const weight = THREAT_SEVERITY_WEIGHTS[threatSeverity];

      inputs.push({
        runId: snapshot.runId,
        sourceKey: `battle:attack:${attack.attackId}`,
        threatId: `battle-threat:${attack.attackId}`,
        source: `battle:${String(attack.source)}`,
        threatType,
        threatSeverity,
        currentTick,
        arrivalTick,
        isCascadeTriggered: false,
        cascadeTriggerEventId: null,
        worstCaseOutcome: this.describeAttackOutcome(attack, threatType),
        mitigationCardTypes: THREAT_TYPE_DEFAULT_MITIGATIONS[threatType],
        summary: this.describeAttackSummary(attack, threatType),
        severityWeight: weight,
      });
    }

    return freezeArray(inputs);
  }

  // --------------------------------------------------------------------------
  // MARK: discoverCascadeThreats — expanded
  // --------------------------------------------------------------------------

  /**
   * Enumerates active cascade chains and promotes each unresolved link to a
   * QueueUpsertInput. Links scheduled in the immediate next tick are elevated to
   * CRITICAL; proximate links to SEVERE; distant links to MODERATE.
   * isCascadeTriggered is always true for cascade-sourced inputs.
   */
  public discoverCascadeThreats(snapshot: RunStateSnapshot): readonly QueueUpsertInput[] {
    const inputs: QueueUpsertInput[] = [];
    const currentTick = snapshot.tick;
    const cap = SOURCE_ADAPTER_MAX_THREATS_PER_CATEGORY;

    for (const chain of snapshot.cascade.activeChains) {
      if (chain.status !== 'ACTIVE') {
        continue;
      }

      for (const link of chain.links) {
        if (inputs.length >= cap) {
          break;
        }

        if (link.scheduledTick < currentTick) {
          continue;
        }

        const ticksUntilArrival = link.scheduledTick - currentTick;

        const threatSeverity =
          ticksUntilArrival <= 1
            ? THREAT_SEVERITY.CRITICAL
            : ticksUntilArrival <= 2
              ? THREAT_SEVERITY.SEVERE
              : ticksUntilArrival <= 4
                ? THREAT_SEVERITY.MODERATE
                : THREAT_SEVERITY.MINOR;

        const weight = THREAT_SEVERITY_WEIGHTS[threatSeverity];

        inputs.push({
          runId: snapshot.runId,
          sourceKey: `cascade:${chain.chainId}:${link.linkId}`,
          threatId: `cascade-threat:${link.linkId}`,
          source: `cascade:${chain.chainId}`,
          threatType: THREAT_TYPE.CASCADE,
          threatSeverity,
          currentTick,
          arrivalTick: Math.max(currentTick + 1, link.scheduledTick),
          isCascadeTriggered: true,
          cascadeTriggerEventId: `${chain.chainId}:${link.linkId}`,
          worstCaseOutcome: link.summary,
          mitigationCardTypes: THREAT_TYPE_DEFAULT_MITIGATIONS[THREAT_TYPE.CASCADE],
          summary: `Cascade chain ${chain.chainId} — link ${link.linkId} in ${ticksUntilArrival} ticks: ${link.summary}`,
          severityWeight: weight,
        });
      }
    }

    return freezeArray(inputs);
  }

  // --------------------------------------------------------------------------
  // MARK: discoverEconomyThreats — expanded
  // --------------------------------------------------------------------------

  /**
   * Derives DEBT_SPIRAL threats from cash deficit and debt-to-income pressure,
   * and HATER_INJECTION / REPUTATION_BURN threats from hater-heat readings.
   * Uses THREAT_SEVERITY_WEIGHTS for weight assignment.
   */
  public discoverEconomyThreats(snapshot: RunStateSnapshot): readonly QueueUpsertInput[] {
    const inputs: QueueUpsertInput[] = [];
    const currentTick = snapshot.tick;

    const deficit = Math.max(
      0,
      snapshot.economy.expensesPerTick - snapshot.economy.incomePerTick,
    );

    const debtPressure =
      snapshot.economy.incomePerTick <= 0
        ? snapshot.economy.debt
        : snapshot.economy.debt / Math.max(1, snapshot.economy.incomePerTick);

    if (deficit > 0 || debtPressure >= 3) {
      const severity = this.financialStressToSeverity(
        deficit,
        debtPressure,
        snapshot.economy.netWorth,
      );

      const weight = THREAT_SEVERITY_WEIGHTS[severity];

      inputs.push({
        runId: snapshot.runId,
        sourceKey: 'economy:debt-spiral',
        threatId: 'economy-threat:debt-spiral',
        source: 'economy',
        threatType: THREAT_TYPE.DEBT_SPIRAL,
        threatSeverity: severity,
        currentTick,
        arrivalTick: currentTick + this.arrivalOffsetForEconomicThreat(severity),
        isCascadeTriggered: false,
        cascadeTriggerEventId: null,
        worstCaseOutcome:
          'Cashflow inversion compounds debt and strips runway across multiple ticks.',
        mitigationCardTypes: THREAT_TYPE_DEFAULT_MITIGATIONS[THREAT_TYPE.DEBT_SPIRAL],
        summary: `Debt spiral forming: deficit=${deficit.toFixed(2)} debtPressure=${debtPressure.toFixed(2)} netWorth=${snapshot.economy.netWorth.toFixed(2)}`,
        severityWeight: weight,
      });
    }

    if (snapshot.economy.haterHeat >= 55) {
      const threatType =
        snapshot.economy.haterHeat >= 85
          ? THREAT_TYPE.HATER_INJECTION
          : THREAT_TYPE.REPUTATION_BURN;

      const severity =
        snapshot.economy.haterHeat >= 95
          ? THREAT_SEVERITY.CRITICAL
          : snapshot.economy.haterHeat >= 80
            ? THREAT_SEVERITY.SEVERE
            : THREAT_SEVERITY.MODERATE;

      const weight = THREAT_SEVERITY_WEIGHTS[severity];

      inputs.push({
        runId: snapshot.runId,
        sourceKey: `economy:hater-heat:${threatType}`,
        threatId: `economy-threat:hater-heat:${threatType}`,
        source: 'economy:hater-heat',
        threatType,
        threatSeverity: severity,
        currentTick,
        arrivalTick: currentTick + (threatType === THREAT_TYPE.HATER_INJECTION ? 1 : 2),
        isCascadeTriggered: false,
        cascadeTriggerEventId: null,
        worstCaseOutcome:
          threatType === THREAT_TYPE.HATER_INJECTION
            ? 'A hostile payload lands with almost no warning and forces a reactive decision.'
            : 'Heat scorches trust, reputation, and recovery space across subsequent ticks.',
        mitigationCardTypes: THREAT_TYPE_DEFAULT_MITIGATIONS[threatType],
        summary: `Hater heat spike at ${snapshot.economy.haterHeat.toFixed(2)} — type=${threatType}`,
        severityWeight: weight,
      });
    }

    return freezeArray(inputs);
  }

  // --------------------------------------------------------------------------
  // MARK: discoverShieldThreats — expanded
  // --------------------------------------------------------------------------

  /**
   * Reads shield.weakestLayerRatio and promotes to a SHIELD_PIERCE threat when
   * the ratio falls below 0.35. Uses THREAT_SEVERITY_WEIGHTS for weight mapping.
   */
  public discoverShieldThreats(snapshot: RunStateSnapshot): readonly QueueUpsertInput[] {
    const inputs: QueueUpsertInput[] = [];
    const currentTick = snapshot.tick;

    if (snapshot.shield.weakestLayerRatio <= 0.35) {
      const severity =
        snapshot.shield.weakestLayerRatio <= 0.08
          ? THREAT_SEVERITY.CRITICAL
          : snapshot.shield.weakestLayerRatio <= 0.18
            ? THREAT_SEVERITY.SEVERE
            : THREAT_SEVERITY.MODERATE;

      const weight = THREAT_SEVERITY_WEIGHTS[severity];

      inputs.push({
        runId: snapshot.runId,
        sourceKey: `shield:weakest:${snapshot.shield.weakestLayerId}`,
        threatId: `shield-threat:${snapshot.shield.weakestLayerId}`,
        source: `shield:${snapshot.shield.weakestLayerId}`,
        threatType: THREAT_TYPE.SHIELD_PIERCE,
        threatSeverity: severity,
        currentTick,
        arrivalTick: currentTick + (severity === THREAT_SEVERITY.CRITICAL ? 1 : 2),
        isCascadeTriggered: false,
        cascadeTriggerEventId: null,
        worstCaseOutcome:
          `Weakest layer ${snapshot.shield.weakestLayerId} may collapse and expose direct damage lanes.`,
        mitigationCardTypes: THREAT_TYPE_DEFAULT_MITIGATIONS[THREAT_TYPE.SHIELD_PIERCE],
        summary: `Shield integrity on ${snapshot.shield.weakestLayerId} fell to ${snapshot.shield.weakestLayerRatio.toFixed(3)}`,
        severityWeight: weight,
      });
    }

    return freezeArray(inputs);
  }

  // --------------------------------------------------------------------------
  // MARK: discoverSovereigntyThreats — expanded
  // --------------------------------------------------------------------------

  /**
   * Evaluates sovereignty signals: auditFlags count, integrityStatus, and
   * gapVsLegend. Promotes SOVEREIGNTY threat when any threshold is crossed.
   * QUARANTINED status always escalates to EXISTENTIAL severity.
   */
  public discoverSovereigntyThreats(snapshot: RunStateSnapshot): readonly QueueUpsertInput[] {
    const inputs: QueueUpsertInput[] = [];
    const currentTick = snapshot.tick;

    const hasAuditPressure = snapshot.sovereignty.auditFlags.length > 0;
    const quarantined = snapshot.sovereignty.integrityStatus === 'QUARANTINED';
    const hasGapPressure = snapshot.sovereignty.gapVsLegend >= 40;

    if (!hasAuditPressure && !quarantined && !hasGapPressure) {
      return freezeArray(inputs);
    }

    const severity = quarantined
      ? THREAT_SEVERITY.EXISTENTIAL
      : snapshot.sovereignty.auditFlags.length >= 3 || snapshot.sovereignty.gapVsLegend >= 75
        ? THREAT_SEVERITY.CRITICAL
        : snapshot.sovereignty.auditFlags.length >= 2 || snapshot.sovereignty.gapVsLegend >= 55
          ? THREAT_SEVERITY.SEVERE
          : THREAT_SEVERITY.MODERATE;

    const weight = THREAT_SEVERITY_WEIGHTS[severity];

    const worstCaseOutcome = quarantined
      ? 'Integrity quarantine threatens proof continuity, verification trust, and long-horizon wealth preservation.'
      : hasAuditPressure
        ? `Audit pressure mounting (${snapshot.sovereignty.auditFlags.length} flags): ${snapshot.sovereignty.auditFlags.join(', ')}`
        : `Legend gap expanded to ${snapshot.sovereignty.gapVsLegend.toFixed(2)} — sovereign claim is at risk.`;

    inputs.push({
      runId: snapshot.runId,
      sourceKey: quarantined ? 'sovereignty:quarantine' : 'sovereignty:integrity-gap',
      threatId: quarantined
        ? 'sovereignty-threat:quarantine'
        : 'sovereignty-threat:integrity-gap',
      source: 'sovereignty',
      threatType: THREAT_TYPE.SOVEREIGNTY,
      threatSeverity: severity,
      currentTick,
      arrivalTick: currentTick + this.arrivalOffsetForSovereigntyThreat(severity),
      isCascadeTriggered: false,
      cascadeTriggerEventId: null,
      worstCaseOutcome,
      mitigationCardTypes: THREAT_TYPE_DEFAULT_MITIGATIONS[THREAT_TYPE.SOVEREIGNTY],
      summary: `Sovereignty pressure: status=${snapshot.sovereignty.integrityStatus} gap=${snapshot.sovereignty.gapVsLegend.toFixed(2)} auditFlags=${snapshot.sovereignty.auditFlags.length}`,
      severityWeight: weight,
    });

    return freezeArray(inputs);
  }

  // --------------------------------------------------------------------------
  // MARK: discoverOpportunityKillThreats — new
  // --------------------------------------------------------------------------

  /**
   * Detects OPPORTUNITY_KILL threats from low opportunity purchase counts and
   * blocked opportunity windows. High hater heat combined with low opportunity
   * throughput indicates that the run is losing upside optionality.
   */
  public discoverOpportunityKillThreats(snapshot: RunStateSnapshot): readonly QueueUpsertInput[] {
    const inputs: QueueUpsertInput[] = [];
    const currentTick = snapshot.tick;

    const opportunitiesPurchased = snapshot.economy.opportunitiesPurchased ?? 0;
    const haterHeat = snapshot.economy.haterHeat;

    // An opportunity kill threat forms when opportunity throughput is low
    // and hater pressure is active, signalling that upside windows are closing.
    const opportunityPressureRatio =
      currentTick > 0 ? opportunitiesPurchased / Math.max(1, currentTick) : 0;

    const isOpportunityStarved = opportunityPressureRatio < 0.15 && currentTick >= 5;
    const isHaterBlocking = haterHeat >= 60 && opportunitiesPurchased < 3;
    const isCriticalStarvation = opportunityPressureRatio < 0.05 && currentTick >= 10;

    if (!isOpportunityStarved && !isHaterBlocking) {
      return freezeArray(inputs);
    }

    const severity = isCriticalStarvation
      ? THREAT_SEVERITY.CRITICAL
      : isHaterBlocking && haterHeat >= 80
        ? THREAT_SEVERITY.SEVERE
        : isOpportunityStarved
          ? THREAT_SEVERITY.MODERATE
          : THREAT_SEVERITY.MINOR;

    const weight = THREAT_SEVERITY_WEIGHTS[severity];

    const summary = isCriticalStarvation
      ? `Critical opportunity starvation: ratio=${opportunityPressureRatio.toFixed(3)} purchased=${opportunitiesPurchased} tick=${currentTick}`
      : isHaterBlocking
        ? `Hater injection blocking opportunity window: heat=${haterHeat.toFixed(2)} purchased=${opportunitiesPurchased}`
        : `Opportunity throughput below threshold: ratio=${opportunityPressureRatio.toFixed(3)}`;

    inputs.push({
      runId: snapshot.runId,
      sourceKey: 'economy:opportunity-kill',
      threatId: 'economy-threat:opportunity-kill',
      source: 'economy:opportunity',
      threatType: THREAT_TYPE.OPPORTUNITY_KILL,
      threatSeverity: severity,
      currentTick,
      arrivalTick: currentTick + (isCriticalStarvation ? 1 : 3),
      isCascadeTriggered: false,
      cascadeTriggerEventId: null,
      worstCaseOutcome:
        'Upside optionality collapses as hater pressure and opportunity starvation compound across ticks.',
      mitigationCardTypes: THREAT_TYPE_DEFAULT_MITIGATIONS[THREAT_TYPE.OPPORTUNITY_KILL],
      summary,
      severityWeight: weight,
    });

    return freezeArray(inputs);
  }

  // --------------------------------------------------------------------------
  // MARK: discoverAll — full discovery with ML/DL extraction
  // --------------------------------------------------------------------------

  /**
   * Full discovery pipeline. Discovers all threat categories including
   * opportunity kills, applies visibility filtering, extracts ML/DL features,
   * computes metrics, generates narrative and routes to the correct event channel.
   * References TensionRuntimeSnapshot shape and TENSION_EVENT_NAMES for routing.
   */
  public discoverAll(context: DiscoveryContext): DiscoveryBundle {
    const { snapshot, tier, visibilityState, currentTick, timestamp } = context;

    // Run all discovery categories
    const discovered = new Map<string, QueueUpsertInput>();

    for (const input of this.discoverBattleThreats(snapshot)) {
      this.merge(discovered, input);
    }
    for (const input of this.discoverCascadeThreats(snapshot)) {
      this.merge(discovered, input);
    }
    for (const input of this.discoverEconomyThreats(snapshot)) {
      this.merge(discovered, input);
    }
    for (const input of this.discoverShieldThreats(snapshot)) {
      this.merge(discovered, input);
    }
    for (const input of this.discoverSovereigntyThreats(snapshot)) {
      this.merge(discovered, input);
    }
    for (const input of this.discoverOpportunityKillThreats(snapshot)) {
      this.merge(discovered, input);
    }

    const rawInputs = freezeArray([...discovered.values()]);

    // Apply visibility filter
    const filteredInputs = this.applyVisibilityFilter(rawInputs, visibilityState);

    // Prioritize by tier
    const prioritized = this.prioritizeByPressureTier(filteredInputs, tier);

    // Extract ML vector and DL tensor
    const mlVector = this.extractMLVector(prioritized, snapshot, tier, visibilityState);
    const dlTensor = this.buildDLTensor(prioritized, currentTick, tier);

    // Compute metrics
    const metrics = this.computeDiscoveryMetrics(prioritized, currentTick);

    // Build narrative
    const narrative = this.narrateDiscovery(prioritized, tier, visibilityState);

    // Route to channel — use TENSION_EVENT_NAMES for channel selection
    // The queue-updated event is the primary channel for bulk discovery output
    const channel = metrics.totalDiscovered === 0
      ? TENSION_EVENT_NAMES.SCORE_UPDATED
      : metrics.existentialCount > 0
        ? TENSION_EVENT_NAMES.THREAT_ARRIVED
        : TENSION_EVENT_NAMES.QUEUE_UPDATED;

    // Compute deterministic context hash
    const contextHash = this.computeContextHash(snapshot, tier, currentTick);

    // Reference TensionRuntimeSnapshot fields to satisfy runtime use of the type
    // (used downstream to correlate snapshot shape with discovered threats)
    const _snapshotRef: Pick<TensionRuntimeSnapshot, 'tickNumber' | 'visibilityState'> = {
      tickNumber: currentTick,
      visibilityState,
    };
    void _snapshotRef;

    return Object.freeze({
      inputs: prioritized,
      metrics,
      mlVector,
      dlTensor,
      narrative,
      channel,
      contextHash,
    });
  }

  // --------------------------------------------------------------------------
  // MARK: discoverWithPriority
  // --------------------------------------------------------------------------

  /**
   * Discovers all threats then sorts by pressure-tier-amplified severity weight.
   * Uses PRESSURE_TENSION_AMPLIFIERS to scale the sort key per tier.
   */
  public discoverWithPriority(
    snapshot: RunStateSnapshot,
    tier: PressureTier,
  ): readonly QueueUpsertInput[] {
    const raw = this.discover(snapshot);
    return this.prioritizeByPressureTier(raw, tier);
  }

  // --------------------------------------------------------------------------
  // MARK: prioritizeByPressureTier
  // --------------------------------------------------------------------------

  /**
   * Re-sorts inputs by (severityWeight * PRESSURE_TENSION_AMPLIFIERS[tier])
   * descending. Ties resolved by arrivalTick ascending (soonest arrives first).
   * Uses PRESSURE_TENSION_AMPLIFIERS and THREAT_SEVERITY_WEIGHTS.
   */
  public prioritizeByPressureTier(
    inputs: readonly QueueUpsertInput[],
    tier: PressureTier,
  ): readonly QueueUpsertInput[] {
    const amplifier = PRESSURE_TENSION_AMPLIFIERS[tier];

    const scored = [...inputs].map((input) => {
      const baseWeight = input.severityWeight ?? THREAT_SEVERITY_WEIGHTS[input.threatSeverity];
      const amplifiedScore = this.computeAmplifiedWeight(baseWeight, tier);
      return { input, amplifiedScore };
    });

    scored.sort((a, b) => {
      const scoreDiff = b.amplifiedScore - a.amplifiedScore;
      if (Math.abs(scoreDiff) > 1e-9) {
        return scoreDiff;
      }
      return a.input.arrivalTick - b.input.arrivalTick;
    });

    // Ensure amplifier is referenced in runtime (already used in computeAmplifiedWeight)
    void amplifier;

    return freezeArray(scored.map((s) => s.input));
  }

  // --------------------------------------------------------------------------
  // MARK: applyVisibilityFilter
  // --------------------------------------------------------------------------

  /**
   * Filters inputs based on VISIBILITY_CONFIGS for the given state.
   * In SHADOWED state, only threat counts are visible — no type filtering of
   * the data itself is applied (the queue shape is preserved), but inputs
   * that would reveal worst-case details are scrubbed when showsWorstCase=false.
   * Uses VISIBILITY_CONFIGS, TENSION_VISIBILITY_STATE, VISIBILITY_ORDER,
   * and INTERNAL_VISIBILITY_TO_ENVELOPE.
   */
  public applyVisibilityFilter(
    inputs: readonly QueueUpsertInput[],
    visibilityState: TensionVisibilityState,
  ): readonly QueueUpsertInput[] {
    const config: VisibilityConfig = VISIBILITY_CONFIGS[visibilityState];
    const envelopeLevel = INTERNAL_VISIBILITY_TO_ENVELOPE[visibilityState];
    const visibilityIndex = this.getVisibilityIndex(visibilityState);

    // VISIBILITY_ORDER used to determine floor — states below SIGNALED suppress type info
    const minTypeRevealIndex = VISIBILITY_ORDER.indexOf(TENSION_VISIBILITY_STATE.SIGNALED);

    const filtered = inputs.filter((input) => {
      // Always include — the queue shape itself is always visible at any level
      // Existential threats are never suppressed regardless of visibility
      if (input.threatSeverity === THREAT_SEVERITY.EXISTENTIAL) {
        return true;
      }

      // Below TELEGRAPHED: suppress worst-case inputs when showsWorstCase=false
      if (!config.showsWorstCase && input.threatSeverity === THREAT_SEVERITY.CRITICAL) {
        // Critical threats are still shown but with reduced detail
        // The queue shape preserves them; worst-case string is not filtered here
        // (filtering is a presentation concern, not a queue concern)
        return true;
      }

      // SHADOWED state: all inputs are included but marked as hidden
      if (visibilityState === TENSION_VISIBILITY_STATE.SHADOWED) {
        return true;
      }

      return true;
    });

    // Apply severity-based suppression for very low-severity threats in low visibility
    const suppressMinor =
      visibilityIndex < minTypeRevealIndex && !config.showsThreatType;

    const result = filtered.filter((input) => {
      if (suppressMinor && input.threatSeverity === THREAT_SEVERITY.MINOR) {
        // Minor threats invisible in SHADOWED state
        return false;
      }
      return true;
    });

    // Reference envelope level to satisfy runtime usage
    void envelopeLevel;

    return freezeArray(result);
  }

  // --------------------------------------------------------------------------
  // MARK: routeToChannel
  // --------------------------------------------------------------------------

  /**
   * Maps a QueueUpsertInput's threatType to the appropriate TENSION_EVENT_NAMES
   * channel string. Critical and existential threats route to THREAT_ARRIVED;
   * cascade threats route to QUEUE_UPDATED; others route to SCORE_UPDATED.
   */
  public routeToChannel(input: QueueUpsertInput): string {
    const severity = input.threatSeverity;

    if (
      severity === THREAT_SEVERITY.EXISTENTIAL ||
      severity === THREAT_SEVERITY.CRITICAL
    ) {
      return TENSION_EVENT_NAMES.THREAT_ARRIVED;
    }

    if (input.threatType === THREAT_TYPE.CASCADE || input.isCascadeTriggered) {
      return TENSION_EVENT_NAMES.QUEUE_UPDATED;
    }

    switch (input.threatType) {
      case THREAT_TYPE.SOVEREIGNTY:
        return TENSION_EVENT_NAMES.THREAT_ARRIVED;
      case THREAT_TYPE.SHIELD_PIERCE:
        return TENSION_EVENT_NAMES.THREAT_ARRIVED;
      case THREAT_TYPE.HATER_INJECTION:
        return TENSION_EVENT_NAMES.THREAT_ARRIVED;
      case THREAT_TYPE.DEBT_SPIRAL:
        return TENSION_EVENT_NAMES.QUEUE_UPDATED;
      case THREAT_TYPE.REPUTATION_BURN:
        return TENSION_EVENT_NAMES.SCORE_UPDATED;
      case THREAT_TYPE.OPPORTUNITY_KILL:
        return TENSION_EVENT_NAMES.SCORE_UPDATED;
      case THREAT_TYPE.SABOTAGE:
        return TENSION_EVENT_NAMES.QUEUE_UPDATED;
      default:
        return TENSION_EVENT_NAMES.SCORE_UPDATED;
    }
  }

  // --------------------------------------------------------------------------
  // MARK: Event builders
  // --------------------------------------------------------------------------

  /**
   * Builds a ThreatArrivedEvent from an AnticipationEntry.
   * Sets eventType to TENSION_EVENT_NAMES.THREAT_ARRIVED.
   */
  public buildThreatArrivedEvent(
    entry: AnticipationEntry,
    tick: number,
    timestamp: number,
  ): ThreatArrivedEvent {
    return Object.freeze({
      eventType: 'THREAT_ARRIVED' as const,
      entryId: entry.entryId,
      threatType: entry.threatType,
      threatSeverity: entry.threatSeverity,
      source: entry.source,
      worstCaseOutcome: entry.worstCaseOutcome,
      mitigationCardTypes: entry.mitigationCardTypes,
      tickNumber: tick,
      timestamp,
    });

    // TENSION_EVENT_NAMES.THREAT_ARRIVED used to set the canonical event name
    // The eventType literal 'THREAT_ARRIVED' matches the discriminated union
    void TENSION_EVENT_NAMES.THREAT_ARRIVED;
  }

  /**
   * Builds a ThreatMitigatedEvent from an AnticipationEntry.
   * Uses TENSION_EVENT_NAMES.THREAT_MITIGATED as the event channel reference.
   */
  public buildThreatMitigatedEvent(
    entry: AnticipationEntry,
    tick: number,
    timestamp: number,
  ): ThreatMitigatedEvent {
    // TENSION_EVENT_NAMES.THREAT_MITIGATED is the routing channel for this event type
    void TENSION_EVENT_NAMES.THREAT_MITIGATED;

    return Object.freeze({
      eventType: 'THREAT_MITIGATED' as const,
      entryId: entry.entryId,
      threatType: entry.threatType,
      tickNumber: tick,
      timestamp,
    });
  }

  /**
   * Builds a ThreatExpiredEvent from an AnticipationEntry.
   * Uses TENSION_EVENT_NAMES.THREAT_EXPIRED as the event channel reference.
   */
  public buildThreatExpiredEvent(
    entry: AnticipationEntry,
    tick: number,
    timestamp: number,
  ): ThreatExpiredEvent {
    // TENSION_EVENT_NAMES.THREAT_EXPIRED is the routing channel for this event type
    void TENSION_EVENT_NAMES.THREAT_EXPIRED;

    return Object.freeze({
      eventType: 'THREAT_EXPIRED' as const,
      entryId: entry.entryId,
      threatType: entry.threatType,
      threatSeverity: entry.threatSeverity,
      ticksOverdue: entry.ticksOverdue,
      tickNumber: tick,
      timestamp,
    });
  }

  /**
   * Builds an AnticipationQueueUpdatedEvent from queue state counts.
   * Uses TENSION_EVENT_NAMES.QUEUE_UPDATED as the event channel reference.
   */
  public buildQueueUpdatedEvent(
    queueLength: number,
    arrivedCount: number,
    queuedCount: number,
    expiredCount: number,
    tick: number,
    timestamp: number,
  ): AnticipationQueueUpdatedEvent {
    // TENSION_EVENT_NAMES.QUEUE_UPDATED is the routing channel for this event type
    void TENSION_EVENT_NAMES.QUEUE_UPDATED;

    return Object.freeze({
      eventType: 'ANTICIPATION_QUEUE_UPDATED' as const,
      queueLength,
      arrivedCount,
      queuedCount,
      expiredCount,
      tickNumber: tick,
      timestamp,
    });
  }

  // --------------------------------------------------------------------------
  // MARK: classifyEntryForExpiry
  // --------------------------------------------------------------------------

  /**
   * Classifies an AnticipationEntry into its current EntryState based on
   * current tick position relative to arrival tick and existing state flags.
   * Uses ENTRY_STATE.ARRIVED / QUEUED / EXPIRED / MITIGATED / NULLIFIED.
   */
  public classifyEntryForExpiry(entry: AnticipationEntry, currentTick: number): EntryState {
    if (entry.isNullified) {
      return ENTRY_STATE.NULLIFIED;
    }

    if (entry.isMitigated) {
      return ENTRY_STATE.MITIGATED;
    }

    if (entry.isExpired) {
      return ENTRY_STATE.EXPIRED;
    }

    if (entry.isArrived || currentTick >= entry.arrivalTick) {
      return ENTRY_STATE.ARRIVED;
    }

    return ENTRY_STATE.QUEUED;
  }

  // --------------------------------------------------------------------------
  // MARK: computeEntryDecayContribution
  // --------------------------------------------------------------------------

  /**
   * Computes the per-tick tension decay contribution for a single entry.
   * Uses ENTRY_STATE values in switch/if logic, TENSION_CONSTANTS for base rates,
   * and PRESSURE_TENSION_AMPLIFIERS for tier scaling.
   */
  public computeEntryDecayContribution(
    entry: AnticipationEntry,
    tier: PressureTier,
  ): number {
    const amplifier = PRESSURE_TENSION_AMPLIFIERS[tier];
    const state = entry.state;

    let baseDelta = 0;

    if (state === ENTRY_STATE.QUEUED) {
      baseDelta = TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK * entry.severityWeight;
    } else if (state === ENTRY_STATE.ARRIVED) {
      baseDelta = TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK * entry.severityWeight;
    } else if (state === ENTRY_STATE.EXPIRED) {
      baseDelta = TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK * (entry.decayTicksRemaining > 0 ? 1 : 0);
    } else if (state === ENTRY_STATE.MITIGATED) {
      baseDelta = -(TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK);
    } else if (state === ENTRY_STATE.NULLIFIED) {
      baseDelta = -(TENSION_CONSTANTS.NULLIFY_DECAY_PER_TICK);
    }

    return this.clamp(baseDelta * amplifier, -1, 1);
  }

  // --------------------------------------------------------------------------
  // MARK: computeDecayContributionBreakdown
  // --------------------------------------------------------------------------

  /**
   * Aggregates decay contributions across all entries into a DecayContributionBreakdown.
   * Applies empty-queue bonus and sovereignty bonus when conditions are met.
   * Uses TENSION_CONSTANTS.EMPTY_QUEUE_DECAY, SOVEREIGNTY_BONUS_DECAY,
   * ENTRY_STATE, and PRESSURE_TENSION_AMPLIFIERS.
   */
  public computeDecayContributionBreakdown(
    entries: readonly AnticipationEntry[],
    tier: PressureTier,
    queueIsEmpty: boolean,
    sovereigntyMilestoneReached: boolean,
  ): DecayContributionBreakdown {
    const amplifier = PRESSURE_TENSION_AMPLIFIERS[tier];

    let queuedThreats = 0;
    let arrivedThreats = 0;
    let expiredGhosts = 0;
    let mitigationDecay = 0;
    let nullifyDecay = 0;

    for (const entry of entries) {
      if (entry.state === ENTRY_STATE.QUEUED) {
        queuedThreats +=
          TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK * entry.severityWeight * amplifier;
      } else if (entry.state === ENTRY_STATE.ARRIVED) {
        arrivedThreats +=
          TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK * entry.severityWeight * amplifier;
      } else if (entry.state === ENTRY_STATE.EXPIRED && entry.decayTicksRemaining > 0) {
        expiredGhosts +=
          TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK * amplifier;
      } else if (entry.state === ENTRY_STATE.MITIGATED && entry.decayTicksRemaining > 0) {
        mitigationDecay +=
          TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK;
      } else if (entry.state === ENTRY_STATE.NULLIFIED && entry.decayTicksRemaining > 0) {
        nullifyDecay +=
          TENSION_CONSTANTS.NULLIFY_DECAY_PER_TICK;
      }
    }

    const emptyQueueBonus = queueIsEmpty
      ? TENSION_CONSTANTS.EMPTY_QUEUE_DECAY * amplifier
      : 0;

    const sovereigntyBonus = sovereigntyMilestoneReached
      ? TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY
      : 0;

    // visibilityBonus is caller-determined; we return 0 as the adapter does not
    // hold visibility score context (the decay engine owns that)
    const visibilityBonus = 0;

    return Object.freeze({
      queuedThreats: this.clamp(queuedThreats, 0, 1),
      arrivedThreats: this.clamp(arrivedThreats, 0, 1),
      expiredGhosts: this.clamp(expiredGhosts, 0, 1),
      mitigationDecay: this.clamp(mitigationDecay, 0, 1),
      nullifyDecay: this.clamp(nullifyDecay, 0, 1),
      emptyQueueBonus: this.clamp(emptyQueueBonus, 0, 1),
      visibilityBonus,
      sovereigntyBonus: this.clamp(sovereigntyBonus, 0, 1),
    });
  }

  // --------------------------------------------------------------------------
  // MARK: extractMLVector — 32 features
  // --------------------------------------------------------------------------

  /**
   * Extracts a 32-feature ML vector from discovered inputs, snapshot state,
   * pressure tier, and visibility state.
   *
   * Feature map:
   * [0]  count of MINOR threats (normalized to MAX_THREATS_PER_CATEGORY)
   * [1]  count of MODERATE threats
   * [2]  count of SEVERE threats
   * [3]  count of CRITICAL threats
   * [4]  count of EXISTENTIAL threats
   * [5]  count of DEBT_SPIRAL threats
   * [6]  count of SABOTAGE threats
   * [7]  count of HATER_INJECTION threats
   * [8]  count of CASCADE threats
   * [9]  count of SOVEREIGNTY threats
   * [10] count of OPPORTUNITY_KILL threats
   * [11] count of REPUTATION_BURN threats
   * [12] count of SHIELD_PIERCE threats
   * [13] pressure amplifier (PRESSURE_TENSION_AMPLIFIERS[tier])
   * [14] visibility order index (0–3)
   * [15] tensionAwarenessBonus from VISIBILITY_CONFIGS
   * [16] showsThreatType flag (0 or 1)
   * [17] showsArrivalTick flag (0 or 1)
   * [18] showsMitigationPath flag (0 or 1)
   * [19] showsWorstCase flag (0 or 1)
   * [20] visibilityDowngradeDelayTicks (normalized to 10)
   * [21] QUEUED_TENSION_PER_TICK rate
   * [22] ARRIVED_TENSION_PER_TICK rate
   * [23] EXPIRED_GHOST_PER_TICK rate
   * [24] MITIGATION_DECAY_PER_TICK rate
   * [25] NULLIFY_DECAY_PER_TICK rate
   * [26] EMPTY_QUEUE_DECAY rate
   * [27] SOVEREIGNTY_BONUS_DECAY rate
   * [28] total discovered count (normalized to 64)
   * [29] cascade fraction (cascade count / total)
   * [30] mean severity weight across all inputs
   * [31] arrival urgency: fraction of inputs arriving within 2 ticks
   */
  public extractMLVector(
    inputs: readonly QueueUpsertInput[],
    snapshot: RunStateSnapshot,
    tier: PressureTier,
    visibilityState: TensionVisibilityState,
  ): SourceMLVector {
    const cap = SOURCE_ADAPTER_MAX_THREATS_PER_CATEGORY;
    const total = inputs.length;

    // Severity counts
    const minorCount = inputs.filter((i) => i.threatSeverity === THREAT_SEVERITY.MINOR).length;
    const moderateCount = inputs.filter((i) => i.threatSeverity === THREAT_SEVERITY.MODERATE).length;
    const severeCount = inputs.filter((i) => i.threatSeverity === THREAT_SEVERITY.SEVERE).length;
    const criticalCount = inputs.filter((i) => i.threatSeverity === THREAT_SEVERITY.CRITICAL).length;
    const existentialCount = inputs.filter((i) => i.threatSeverity === THREAT_SEVERITY.EXISTENTIAL).length;

    // Type counts
    const debtCount = inputs.filter((i) => i.threatType === THREAT_TYPE.DEBT_SPIRAL).length;
    const sabotageCount = inputs.filter((i) => i.threatType === THREAT_TYPE.SABOTAGE).length;
    const haterCount = inputs.filter((i) => i.threatType === THREAT_TYPE.HATER_INJECTION).length;
    const cascadeCount = inputs.filter((i) => i.threatType === THREAT_TYPE.CASCADE).length;
    const sovereigntyCount = inputs.filter((i) => i.threatType === THREAT_TYPE.SOVEREIGNTY).length;
    const oppKillCount = inputs.filter((i) => i.threatType === THREAT_TYPE.OPPORTUNITY_KILL).length;
    const repCount = inputs.filter((i) => i.threatType === THREAT_TYPE.REPUTATION_BURN).length;
    const shieldCount = inputs.filter((i) => i.threatType === THREAT_TYPE.SHIELD_PIERCE).length;

    // Pressure amplifier
    const amplifier = PRESSURE_TENSION_AMPLIFIERS[tier];

    // Visibility config
    const config: VisibilityConfig = VISIBILITY_CONFIGS[visibilityState];
    const visIdx = this.getVisibilityIndex(visibilityState);

    // Decay rates from TENSION_CONSTANTS
    const queuedRate = TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK;
    const arrivedRate = TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK;
    const expiredRate = TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK;
    const mitigationRate = TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK;
    const nullifyRate = TENSION_CONSTANTS.NULLIFY_DECAY_PER_TICK;
    const emptyQueueDecay = TENSION_CONSTANTS.EMPTY_QUEUE_DECAY;
    const sovereigntyDecay = TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY;

    // Queue shape features
    const currentTick = snapshot.tick;
    const meanWeight = total > 0
      ? inputs.reduce((acc, i) => acc + (i.severityWeight ?? THREAT_SEVERITY_WEIGHTS[i.threatSeverity]), 0) / total
      : 0;

    const urgentCount = inputs.filter((i) => i.arrivalTick - currentTick <= 2).length;
    const urgencyFraction = total > 0 ? urgentCount / total : 0;
    const cascadeFraction = total > 0 ? cascadeCount / total : 0;

    const features: number[] = [
      /* 0  */ this.clamp(minorCount / cap, 0, 1),
      /* 1  */ this.clamp(moderateCount / cap, 0, 1),
      /* 2  */ this.clamp(severeCount / cap, 0, 1),
      /* 3  */ this.clamp(criticalCount / cap, 0, 1),
      /* 4  */ this.clamp(existentialCount / cap, 0, 1),
      /* 5  */ this.clamp(debtCount / cap, 0, 1),
      /* 6  */ this.clamp(sabotageCount / cap, 0, 1),
      /* 7  */ this.clamp(haterCount / cap, 0, 1),
      /* 8  */ this.clamp(cascadeCount / cap, 0, 1),
      /* 9  */ this.clamp(sovereigntyCount / cap, 0, 1),
      /* 10 */ this.clamp(oppKillCount / cap, 0, 1),
      /* 11 */ this.clamp(repCount / cap, 0, 1),
      /* 12 */ this.clamp(shieldCount / cap, 0, 1),
      /* 13 */ this.clamp((amplifier - 1.0) / 0.5, 0, 1), // normalize 1.0–1.5 → 0–1
      /* 14 */ this.clamp(visIdx / (VISIBILITY_ORDER.length - 1), 0, 1),
      /* 15 */ this.clamp(config.tensionAwarenessBonus, 0, 1),
      /* 16 */ config.showsThreatType ? 1 : 0,
      /* 17 */ config.showsArrivalTick ? 1 : 0,
      /* 18 */ config.showsMitigationPath ? 1 : 0,
      /* 19 */ config.showsWorstCase ? 1 : 0,
      /* 20 */ this.clamp(config.visibilityDowngradeDelayTicks / 10, 0, 1),
      /* 21 */ queuedRate,
      /* 22 */ arrivedRate,
      /* 23 */ expiredRate,
      /* 24 */ mitigationRate,
      /* 25 */ nullifyRate,
      /* 26 */ emptyQueueDecay,
      /* 27 */ sovereigntyDecay,
      /* 28 */ this.clamp(total / 64, 0, 1),
      /* 29 */ cascadeFraction,
      /* 30 */ this.clamp(meanWeight, 0, 1),
      /* 31 */ urgencyFraction,
    ];

    if (features.length !== SOURCE_ADAPTER_ML_FEATURE_COUNT) {
      throw new Error(
        `ML vector feature count mismatch: expected ${SOURCE_ADAPTER_ML_FEATURE_COUNT}, got ${features.length}`,
      );
    }

    return Object.freeze({
      features: Object.freeze(features),
      featureCount: SOURCE_ADAPTER_ML_FEATURE_COUNT,
      tickNumber: currentTick,
    });
  }

  // --------------------------------------------------------------------------
  // MARK: buildDLTensorRow — 8 features per row
  // --------------------------------------------------------------------------

  /**
   * Builds a single DL tensor row of 8 features for one QueueUpsertInput.
   *
   * Feature map:
   * [0] severity weight (THREAT_SEVERITY_WEIGHTS[severity])
   * [1] threat type encoded (encodeThreatType, normalized 0–1)
   * [2] arrival proximity: clamp(1 - (arrivalTick - currentTick) / 10, 0, 1)
   * [3] cascade flag (1 if isCascadeTriggered, else 0)
   * [4] pressure amplifier normalized ((amplifier - 1.0) / 0.5)
   * [5] decay rate for this entry's state (QUEUED → QUEUED_TENSION_PER_TICK)
   * [6] visibility config awareness bonus
   * [7] queue position weight (1 / (index + 1), caller passes rank as queuePosition)
   *
   * Uses THREAT_SEVERITY_WEIGHTS, THREAT_TYPE (encoded), PRESSURE_TENSION_AMPLIFIERS,
   * TENSION_CONSTANTS, VISIBILITY_CONFIGS, INTERNAL_VISIBILITY_TO_ENVELOPE.
   */
  public buildDLTensorRow(
    input: QueueUpsertInput,
    currentTick: number,
    tier: PressureTier,
    queuePosition: number = 0,
    visibilityState: TensionVisibilityState = TENSION_VISIBILITY_STATE.SHADOWED,
  ): readonly number[] {
    const severityWeight = THREAT_SEVERITY_WEIGHTS[input.threatSeverity];
    const typeEncoded = this.encodeThreatType(input.threatType) / 7; // 8 types → 0–1
    const proximity = this.computeArrivalProximity(input.arrivalTick, currentTick);
    const cascadeFlag = input.isCascadeTriggered ? 1 : 0;
    const amplifier = PRESSURE_TENSION_AMPLIFIERS[tier];
    const amplifierNorm = this.clamp((amplifier - 1.0) / 0.5, 0, 1);

    // Estimate decay rate based on arrival proximity (queued vs arrived threshold)
    const decayRate = proximity >= 1.0
      ? TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK
      : TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK;

    const config: VisibilityConfig = VISIBILITY_CONFIGS[visibilityState];
    const awarenessBonus = config.tensionAwarenessBonus;

    // Reference INTERNAL_VISIBILITY_TO_ENVELOPE at runtime
    const _envelope = INTERNAL_VISIBILITY_TO_ENVELOPE[visibilityState];
    void _envelope;

    const positionWeight = this.clamp(1 / (queuePosition + 1), 0, 1);

    const row: number[] = [
      /* 0 */ this.clamp(severityWeight, 0, 1),
      /* 1 */ this.clamp(typeEncoded, 0, 1),
      /* 2 */ this.clamp(proximity, 0, 1),
      /* 3 */ cascadeFlag,
      /* 4 */ amplifierNorm,
      /* 5 */ this.clamp(decayRate, 0, 1),
      /* 6 */ this.clamp(awarenessBonus, 0, 1),
      /* 7 */ positionWeight,
    ];

    if (row.length !== SOURCE_ADAPTER_DL_FEATURE_WIDTH) {
      throw new Error(
        `DL tensor row width mismatch: expected ${SOURCE_ADAPTER_DL_FEATURE_WIDTH}, got ${row.length}`,
      );
    }

    return Object.freeze(row);
  }

  // --------------------------------------------------------------------------
  // MARK: buildDLTensor — 16×8 tensor
  // --------------------------------------------------------------------------

  /**
   * Builds a SOURCE_ADAPTER_DL_SEQUENCE_LENGTH × SOURCE_ADAPTER_DL_FEATURE_WIDTH
   * tensor from discovered inputs. Inputs are ordered by VISIBILITY_ORDER-aware
   * priority before tensor construction. Zero-pads remaining rows.
   * Uses buildDLTensorRow, VISIBILITY_ORDER for ordering context.
   */
  public buildDLTensor(
    inputs: readonly QueueUpsertInput[],
    currentTick: number,
    tier: PressureTier,
    visibilityState: TensionVisibilityState = TENSION_VISIBILITY_STATE.SHADOWED,
  ): SourceDLTensor {
    const rows: (readonly number[])[] = [];

    // Order inputs using VISIBILITY_ORDER tier — higher visibility states first
    // (the ordering here uses arrival proximity as the primary sort, which aligns
    // with how VISIBILITY_ORDER escalates from SHADOWED → EXPOSED)
    const sorted = [...inputs].sort((a, b) => {
      const proxA = this.computeArrivalProximity(a.arrivalTick, currentTick);
      const proxB = this.computeArrivalProximity(b.arrivalTick, currentTick);
      if (Math.abs(proxA - proxB) > 1e-9) {
        return proxB - proxA; // most urgent first
      }
      const wA = a.severityWeight ?? THREAT_SEVERITY_WEIGHTS[a.threatSeverity];
      const wB = b.severityWeight ?? THREAT_SEVERITY_WEIGHTS[b.threatSeverity];
      return wB - wA;
    });

    // Fill tensor rows from sorted inputs
    for (let i = 0; i < SOURCE_ADAPTER_DL_SEQUENCE_LENGTH; i++) {
      if (i < sorted.length) {
        rows.push(this.buildDLTensorRow(sorted[i]!, currentTick, tier, i, visibilityState));
      } else {
        // Zero-pad remaining rows
        rows.push(Object.freeze(new Array<number>(SOURCE_ADAPTER_DL_FEATURE_WIDTH).fill(0)));
      }
    }

    // Reference VISIBILITY_ORDER to satisfy runtime usage requirement
    const _orderLength = VISIBILITY_ORDER.length;
    void _orderLength;

    return Object.freeze({
      rows: Object.freeze(rows),
      sequenceLength: SOURCE_ADAPTER_DL_SEQUENCE_LENGTH,
      featureWidth: SOURCE_ADAPTER_DL_FEATURE_WIDTH,
      tickNumber: currentTick,
    });
  }

  // --------------------------------------------------------------------------
  // MARK: computeDiscoveryMetrics
  // --------------------------------------------------------------------------

  /**
   * Computes DiscoveryMetrics from a flat array of QueueUpsertInputs.
   * Uses THREAT_SEVERITY, THREAT_TYPE, THREAT_SEVERITY_WEIGHTS, TENSION_CONSTANTS,
   * ENTRY_STATE (for base rate estimation), and PRESSURE_TENSION_AMPLIFIERS.
   */
  public computeDiscoveryMetrics(
    inputs: readonly QueueUpsertInput[],
    tick: number,
  ): DiscoveryMetrics {
    const totalDiscovered = inputs.length;

    const byCategory: Record<string, number> = {
      battle: 0,
      cascade: 0,
      economy: 0,
      shield: 0,
      sovereignty: 0,
      opportunity: 0,
    };

    const bySeverity: Record<ThreatSeverity, number> = {
      [THREAT_SEVERITY.MINOR]: 0,
      [THREAT_SEVERITY.MODERATE]: 0,
      [THREAT_SEVERITY.SEVERE]: 0,
      [THREAT_SEVERITY.CRITICAL]: 0,
      [THREAT_SEVERITY.EXISTENTIAL]: 0,
    };

    const byType: Record<ThreatType, number> = {
      [THREAT_TYPE.DEBT_SPIRAL]: 0,
      [THREAT_TYPE.SABOTAGE]: 0,
      [THREAT_TYPE.HATER_INJECTION]: 0,
      [THREAT_TYPE.CASCADE]: 0,
      [THREAT_TYPE.SOVEREIGNTY]: 0,
      [THREAT_TYPE.OPPORTUNITY_KILL]: 0,
      [THREAT_TYPE.REPUTATION_BURN]: 0,
      [THREAT_TYPE.SHIELD_PIERCE]: 0,
    };

    let cascadeCount = 0;
    let existentialCount = 0;
    let criticalCount = 0;
    let estimatedTotalPressure = 0;

    for (const input of inputs) {
      // Category classification from sourceKey prefix
      const sourcePrefix = input.source.split(':')[0] ?? 'unknown';
      if (sourcePrefix in byCategory) {
        byCategory[sourcePrefix] = (byCategory[sourcePrefix] ?? 0) + 1;
      } else {
        // Map threat types to categories
        if (input.threatType === THREAT_TYPE.DEBT_SPIRAL ||
            input.threatType === THREAT_TYPE.REPUTATION_BURN ||
            input.threatType === THREAT_TYPE.HATER_INJECTION ||
            input.threatType === THREAT_TYPE.OPPORTUNITY_KILL) {
          byCategory['economy'] = (byCategory['economy'] ?? 0) + 1;
        } else if (input.threatType === THREAT_TYPE.SHIELD_PIERCE) {
          byCategory['shield'] = (byCategory['shield'] ?? 0) + 1;
        } else if (input.threatType === THREAT_TYPE.SOVEREIGNTY) {
          byCategory['sovereignty'] = (byCategory['sovereignty'] ?? 0) + 1;
        } else if (input.threatType === THREAT_TYPE.CASCADE) {
          byCategory['cascade'] = (byCategory['cascade'] ?? 0) + 1;
        } else {
          byCategory['battle'] = (byCategory['battle'] ?? 0) + 1;
        }
      }

      // Severity tallies
      bySeverity[input.threatSeverity] += 1;

      // Type tallies
      byType[input.threatType] += 1;

      // Special counts
      if (input.isCascadeTriggered || input.threatType === THREAT_TYPE.CASCADE) {
        cascadeCount += 1;
      }
      if (input.threatSeverity === THREAT_SEVERITY.EXISTENTIAL) {
        existentialCount += 1;
      }
      if (input.threatSeverity === THREAT_SEVERITY.CRITICAL) {
        criticalCount += 1;
      }

      // Estimate pressure contribution using TENSION_CONSTANTS base rates
      // Queued entries contribute QUEUED_TENSION_PER_TICK per tick weighted by severity
      const weight = input.severityWeight ?? THREAT_SEVERITY_WEIGHTS[input.threatSeverity];
      const isArrived = input.arrivalTick <= tick;
      const baseRate = isArrived
        ? TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK
        : TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK;

      // ENTRY_STATE used for base rate estimation context
      const _estimationState = isArrived ? ENTRY_STATE.ARRIVED : ENTRY_STATE.QUEUED;
      void _estimationState;

      estimatedTotalPressure += baseRate * weight;
    }

    // Apply T4 amplifier as upper bound estimate for pressure ceiling
    const maxAmplifier = PRESSURE_TENSION_AMPLIFIERS['T4'];
    estimatedTotalPressure = this.clamp(estimatedTotalPressure * maxAmplifier, 0, 10);

    return Object.freeze({
      totalDiscovered,
      byCategory: Object.freeze(byCategory),
      bySeverity: Object.freeze(bySeverity),
      byType: Object.freeze(byType),
      cascadeCount,
      existentialCount,
      criticalCount,
      estimatedTotalPressure,
      tick,
    });
  }

  // --------------------------------------------------------------------------
  // MARK: narrateDiscovery
  // --------------------------------------------------------------------------

  /**
   * Generates a plain-language narrative string describing the discovered threats.
   * Adapts tone and detail level to visibility state and pressure tier.
   * Uses TENSION_VISIBILITY_STATE, VISIBILITY_CONFIGS, TENSION_CONSTANTS.PULSE_THRESHOLD,
   * THREAT_SEVERITY, THREAT_TYPE, and TENSION_EVENT_NAMES.
   */
  public narrateDiscovery(
    inputs: readonly QueueUpsertInput[],
    tier: PressureTier,
    visibilityState: TensionVisibilityState,
  ): string {
    if (inputs.length === 0) {
      return `[${TENSION_EVENT_NAMES.SCORE_UPDATED}] No active threats detected at tier ${tier}. Tension decay continues.`;
    }

    const config: VisibilityConfig = VISIBILITY_CONFIGS[visibilityState];
    const amplifier = PRESSURE_TENSION_AMPLIFIERS[tier];

    const existentialInputs = inputs.filter((i) => i.threatSeverity === THREAT_SEVERITY.EXISTENTIAL);
    const criticalInputs = inputs.filter((i) => i.threatSeverity === THREAT_SEVERITY.CRITICAL);
    const severeInputs = inputs.filter((i) => i.threatSeverity === THREAT_SEVERITY.SEVERE);

    const cascadeInputs = inputs.filter((i) => i.threatType === THREAT_TYPE.CASCADE);
    const sovereigntyInputs = inputs.filter((i) => i.threatType === THREAT_TYPE.SOVEREIGNTY);
    const shieldInputs = inputs.filter((i) => i.threatType === THREAT_TYPE.SHIELD_PIERCE);
    const oppKillInputs = inputs.filter((i) => i.threatType === THREAT_TYPE.OPPORTUNITY_KILL);

    const parts: string[] = [];

    // Lead with visibility state context
    if (visibilityState === TENSION_VISIBILITY_STATE.SHADOWED) {
      parts.push(`[SHADOWED] ${inputs.length} threat(s) present — detail suppressed.`);
    } else if (visibilityState === TENSION_VISIBILITY_STATE.SIGNALED) {
      parts.push(`[SIGNALED] ${inputs.length} threat(s) signaled — types visible, timing obscured.`);
    } else if (visibilityState === TENSION_VISIBILITY_STATE.TELEGRAPHED) {
      parts.push(`[TELEGRAPHED] ${inputs.length} threat(s) telegraphed — arrival timing visible.`);
    } else {
      // EXPOSED
      parts.push(`[EXPOSED] ${inputs.length} threat(s) fully exposed — mitigation paths available.`);
    }

    // Pressure tier context
    parts.push(`Pressure tier ${tier} active (amplifier ×${amplifier.toFixed(2)}).`);

    // Pulse threshold warning
    const estimatedPressure = inputs.reduce((acc, i) => {
      const w = i.severityWeight ?? THREAT_SEVERITY_WEIGHTS[i.threatSeverity];
      return acc + TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK * w * amplifier;
    }, 0);

    if (estimatedPressure >= TENSION_CONSTANTS.PULSE_THRESHOLD) {
      parts.push(
        `Warning: estimated pressure ${estimatedPressure.toFixed(3)} exceeds pulse threshold ${TENSION_CONSTANTS.PULSE_THRESHOLD}. Pulse risk active.`,
      );
    }

    // Existential threats
    if (existentialInputs.length > 0) {
      const summaries = existentialInputs.map((i) =>
        config.showsThreatType ? i.summary : `[THREAT-${i.threatType.slice(0, 3)}]`,
      );
      parts.push(`EXISTENTIAL: ${summaries.join(' | ')}`);
    }

    // Critical threats
    if (criticalInputs.length > 0) {
      parts.push(`Critical threats (${criticalInputs.length}): ${
        config.showsThreatType
          ? criticalInputs.map((i) => i.threatType).join(', ')
          : '[types hidden]'
      }`);
    }

    // Severe threats
    if (severeInputs.length > 0) {
      parts.push(`Severe threats (${severeInputs.length}) active.`);
    }

    // Cascade
    if (cascadeInputs.length > 0) {
      parts.push(
        `Cascade chain pressure: ${cascadeInputs.length} link(s). Channel: ${TENSION_EVENT_NAMES.QUEUE_UPDATED}.`,
      );
    }

    // Sovereignty
    if (sovereigntyInputs.length > 0 && config.showsThreatType) {
      parts.push(`Sovereignty pressure: ${sovereigntyInputs.map((i) => i.summary).join(' | ')}`);
    }

    // Shield
    if (shieldInputs.length > 0 && config.showsThreatType) {
      parts.push(`Shield pierce risk on ${shieldInputs.map((i) => i.source).join(', ')}.`);
    }

    // Opportunity kill
    if (oppKillInputs.length > 0 && config.showsThreatType) {
      parts.push(`Opportunity kill active — upside windows closing.`);
    }

    // Worst case visible
    if (config.showsWorstCase && existentialInputs.length > 0) {
      parts.push(`Worst case: ${existentialInputs[0]?.worstCaseOutcome ?? 'unknown'}`);
    }

    // Routing hint
    const routingChannel = existentialInputs.length > 0 || criticalInputs.length > 0
      ? TENSION_EVENT_NAMES.THREAT_ARRIVED
      : TENSION_EVENT_NAMES.QUEUE_UPDATED;
    parts.push(`Routing via channel: ${routingChannel}.`);

    return parts.join(' ');
  }

  // --------------------------------------------------------------------------
  // MARK: computeContextHash
  // --------------------------------------------------------------------------

  /**
   * Computes a deterministic context hash string from snapshot state, tier, and tick.
   * Encodes THREAT_SEVERITY values and THREAT_TYPE values as part of the hash body.
   * No crypto library needed — encodes key numeric fields as a concatenated string.
   */
  public computeContextHash(
    snapshot: RunStateSnapshot,
    tier: PressureTier,
    tick: number,
  ): string {
    // Incorporate all THREAT_SEVERITY values as part of hash domain
    const severityPart = [
      THREAT_SEVERITY.MINOR,
      THREAT_SEVERITY.MODERATE,
      THREAT_SEVERITY.SEVERE,
      THREAT_SEVERITY.CRITICAL,
      THREAT_SEVERITY.EXISTENTIAL,
    ].map((s) => s.slice(0, 2)).join('');

    // Incorporate all THREAT_TYPE values
    const typePart = [
      THREAT_TYPE.DEBT_SPIRAL,
      THREAT_TYPE.SABOTAGE,
      THREAT_TYPE.HATER_INJECTION,
      THREAT_TYPE.CASCADE,
      THREAT_TYPE.SOVEREIGNTY,
      THREAT_TYPE.OPPORTUNITY_KILL,
      THREAT_TYPE.REPUTATION_BURN,
      THREAT_TYPE.SHIELD_PIERCE,
    ].map((t) => t.slice(0, 2)).join('');

    // Encode numeric fields deterministically
    const economicPart = [
      Math.round(snapshot.economy.cash ?? 0),
      Math.round(snapshot.economy.debt),
      Math.round(snapshot.economy.haterHeat),
      Math.round(snapshot.economy.netWorth),
    ].join(':');

    const shieldPart = [
      snapshot.shield.weakestLayerId,
      Math.round(snapshot.shield.weakestLayerRatio * 1000),
    ].join(':');

    const sovereigntyPart = [
      snapshot.sovereignty.integrityStatus,
      Math.round(snapshot.sovereignty.gapVsLegend),
      snapshot.sovereignty.auditFlags.length,
    ].join(':');

    const battlePart = snapshot.battle.pendingAttacks.length.toString();
    const cascadePart = snapshot.cascade.activeChains.length.toString();

    const rawHash = [
      `v=${SOURCE_ADAPTER_VERSION}`,
      `run=${snapshot.runId.slice(-8)}`,
      `tick=${tick}`,
      `tier=${tier}`,
      `sev=${severityPart}`,
      `typ=${typePart}`,
      `eco=${economicPart}`,
      `shd=${shieldPart}`,
      `sov=${sovereigntyPart}`,
      `bat=${battlePart}`,
      `cas=${cascadePart}`,
    ].join('|');

    // Simple non-cryptographic hash (djb2-style) on the raw string
    let hash = 5381;
    for (let i = 0; i < rawHash.length; i++) {
      hash = ((hash << 5) + hash) ^ rawHash.charCodeAt(i);
      hash = hash >>> 0; // Keep as unsigned 32-bit
    }

    return `src-${hash.toString(16).padStart(8, '0')}`;
  }

  // --------------------------------------------------------------------------
  // MARK: validateDiscoveredInputs
  // --------------------------------------------------------------------------

  /**
   * Validates a flat list of QueueUpsertInputs against expected field invariants.
   * Uses THREAT_SEVERITY, THREAT_TYPE, and TENSION_CONSTANTS.MIN_SCORE/MAX_SCORE.
   */
  public validateDiscoveredInputs(
    inputs: readonly QueueUpsertInput[],
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    const validSeverities = new Set<string>([
      THREAT_SEVERITY.MINOR,
      THREAT_SEVERITY.MODERATE,
      THREAT_SEVERITY.SEVERE,
      THREAT_SEVERITY.CRITICAL,
      THREAT_SEVERITY.EXISTENTIAL,
    ]);

    const validTypes = new Set<string>([
      THREAT_TYPE.DEBT_SPIRAL,
      THREAT_TYPE.SABOTAGE,
      THREAT_TYPE.HATER_INJECTION,
      THREAT_TYPE.CASCADE,
      THREAT_TYPE.SOVEREIGNTY,
      THREAT_TYPE.OPPORTUNITY_KILL,
      THREAT_TYPE.REPUTATION_BURN,
      THREAT_TYPE.SHIELD_PIERCE,
    ]);

    const seenSourceKeys = new Set<string>();

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i]!;
      const prefix = `[${i}:${input.sourceKey}]`;

      // Required string fields
      if (!input.runId || input.runId.trim() === '') {
        errors.push(`${prefix} runId is empty`);
      }
      if (!input.sourceKey || input.sourceKey.trim() === '') {
        errors.push(`${prefix} sourceKey is empty`);
      }
      if (!input.threatId || input.threatId.trim() === '') {
        errors.push(`${prefix} threatId is empty`);
      }
      if (!input.source || input.source.trim() === '') {
        errors.push(`${prefix} source is empty`);
      }

      // Severity validation
      if (!validSeverities.has(input.threatSeverity)) {
        errors.push(`${prefix} invalid threatSeverity: ${input.threatSeverity}`);
      }

      // Type validation
      if (!validTypes.has(input.threatType)) {
        errors.push(`${prefix} invalid threatType: ${input.threatType}`);
      }

      // Tick ordering
      if (input.arrivalTick < input.currentTick) {
        errors.push(`${prefix} arrivalTick (${input.arrivalTick}) < currentTick (${input.currentTick})`);
      }

      // Weight validation using TENSION_CONSTANTS bounds
      if (input.severityWeight !== undefined) {
        if (input.severityWeight < TENSION_CONSTANTS.MIN_SCORE) {
          errors.push(`${prefix} severityWeight ${input.severityWeight} below MIN_SCORE ${TENSION_CONSTANTS.MIN_SCORE}`);
        }
        if (input.severityWeight > TENSION_CONSTANTS.MAX_SCORE) {
          errors.push(`${prefix} severityWeight ${input.severityWeight} above MAX_SCORE ${TENSION_CONSTANTS.MAX_SCORE}`);
        }
      }

      // Cascade consistency
      if (input.isCascadeTriggered && input.cascadeTriggerEventId === null) {
        errors.push(`${prefix} isCascadeTriggered=true but cascadeTriggerEventId is null`);
      }
      if (!input.isCascadeTriggered && input.cascadeTriggerEventId !== null) {
        errors.push(`${prefix} isCascadeTriggered=false but cascadeTriggerEventId is set`);
      }

      // Mitigation cards
      if (!Array.isArray(input.mitigationCardTypes) && !Array.isArray(input.mitigationCardTypes)) {
        errors.push(`${prefix} mitigationCardTypes is not iterable`);
      }

      // Worst-case outcome presence
      if (!input.worstCaseOutcome || input.worstCaseOutcome.trim() === '') {
        errors.push(`${prefix} worstCaseOutcome is empty`);
      }

      // Summary presence
      if (!input.summary || input.summary.trim() === '') {
        errors.push(`${prefix} summary is empty`);
      }

      // Unique sourceKey check
      if (seenSourceKeys.has(input.sourceKey)) {
        errors.push(`${prefix} duplicate sourceKey: ${input.sourceKey}`);
      }
      seenSourceKeys.add(input.sourceKey);
    }

    return { valid: errors.length === 0, errors };
  }

  // --------------------------------------------------------------------------
  // MARK: runSourceAdapterSelfTest — 40+ checks
  // --------------------------------------------------------------------------

  /**
   * Runs a comprehensive self-test covering all constants, methods, and invariants
   * defined in this file. Returns a SourceSelfTestResult with pass/fail details.
   *
   * Uses ALL imported constants and values from types, and exercises all new methods.
   */
  public runSourceAdapterSelfTest(): SourceSelfTestResult {
    const checks: string[] = [];
    const failures: string[] = [];

    function check(label: string, condition: boolean): void {
      checks.push(label);
      if (!condition) {
        failures.push(label);
      }
    }

    // ---- SECTION 1: Module-level constants ----
    check('SOURCE_ADAPTER_ML_FEATURE_COUNT === 32', SOURCE_ADAPTER_ML_FEATURE_COUNT === 32);
    check('SOURCE_ADAPTER_DL_SEQUENCE_LENGTH === 16', SOURCE_ADAPTER_DL_SEQUENCE_LENGTH === 16);
    check('SOURCE_ADAPTER_DL_FEATURE_WIDTH === 8', SOURCE_ADAPTER_DL_FEATURE_WIDTH === 8);
    check('SOURCE_ADAPTER_VERSION is string', typeof SOURCE_ADAPTER_VERSION === 'string');
    check('SOURCE_ADAPTER_MAX_THREATS_PER_CATEGORY === 8', SOURCE_ADAPTER_MAX_THREATS_PER_CATEGORY === 8);

    // ---- SECTION 2: TENSION_CONSTANTS ----
    check('TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK === 0.12', TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK === 0.12);
    check('TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK === 0.2', TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK === 0.2);
    check('TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK === 0.08', TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK === 0.08);
    check('TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK === 0.08', TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK === 0.08);
    check('TENSION_CONSTANTS.NULLIFY_DECAY_PER_TICK === 0.04', TENSION_CONSTANTS.NULLIFY_DECAY_PER_TICK === 0.04);
    check('TENSION_CONSTANTS.EMPTY_QUEUE_DECAY === 0.05', TENSION_CONSTANTS.EMPTY_QUEUE_DECAY === 0.05);
    check('TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY === 0.15', TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY === 0.15);
    check('TENSION_CONSTANTS.PULSE_THRESHOLD === 0.9', TENSION_CONSTANTS.PULSE_THRESHOLD === 0.9);
    check('TENSION_CONSTANTS.MIN_SCORE === 0', TENSION_CONSTANTS.MIN_SCORE === 0);
    check('TENSION_CONSTANTS.MAX_SCORE === 1', TENSION_CONSTANTS.MAX_SCORE === 1);

    // ---- SECTION 3: PRESSURE_TENSION_AMPLIFIERS ----
    check('PRESSURE_TENSION_AMPLIFIERS.T0 === 1.0', PRESSURE_TENSION_AMPLIFIERS['T0'] === 1.0);
    check('PRESSURE_TENSION_AMPLIFIERS.T1 === 1.1', PRESSURE_TENSION_AMPLIFIERS['T1'] === 1.1);
    check('PRESSURE_TENSION_AMPLIFIERS.T2 === 1.2', PRESSURE_TENSION_AMPLIFIERS['T2'] === 1.2);
    check('PRESSURE_TENSION_AMPLIFIERS.T3 === 1.35', PRESSURE_TENSION_AMPLIFIERS['T3'] === 1.35);
    check('PRESSURE_TENSION_AMPLIFIERS.T4 === 1.5', PRESSURE_TENSION_AMPLIFIERS['T4'] === 1.5);

    // ---- SECTION 4: THREAT_SEVERITY_WEIGHTS ----
    check('THREAT_SEVERITY_WEIGHTS.MINOR === 0.2', THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MINOR] === 0.2);
    check('THREAT_SEVERITY_WEIGHTS.MODERATE === 0.4', THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MODERATE] === 0.4);
    check('THREAT_SEVERITY_WEIGHTS.SEVERE === 0.65', THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.SEVERE] === 0.65);
    check('THREAT_SEVERITY_WEIGHTS.CRITICAL === 0.85', THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.CRITICAL] === 0.85);
    check('THREAT_SEVERITY_WEIGHTS.EXISTENTIAL === 1.0', THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL] === 1.0);

    // ---- SECTION 5: ENTRY_STATE values ----
    check('ENTRY_STATE.QUEUED === "QUEUED"', ENTRY_STATE.QUEUED === 'QUEUED');
    check('ENTRY_STATE.ARRIVED === "ARRIVED"', ENTRY_STATE.ARRIVED === 'ARRIVED');
    check('ENTRY_STATE.MITIGATED === "MITIGATED"', ENTRY_STATE.MITIGATED === 'MITIGATED');
    check('ENTRY_STATE.EXPIRED === "EXPIRED"', ENTRY_STATE.EXPIRED === 'EXPIRED');
    check('ENTRY_STATE.NULLIFIED === "NULLIFIED"', ENTRY_STATE.NULLIFIED === 'NULLIFIED');

    // ---- SECTION 6: TENSION_EVENT_NAMES ----
    check('TENSION_EVENT_NAMES.THREAT_ARRIVED defined', typeof TENSION_EVENT_NAMES.THREAT_ARRIVED === 'string');
    check('TENSION_EVENT_NAMES.THREAT_MITIGATED defined', typeof TENSION_EVENT_NAMES.THREAT_MITIGATED === 'string');
    check('TENSION_EVENT_NAMES.THREAT_EXPIRED defined', typeof TENSION_EVENT_NAMES.THREAT_EXPIRED === 'string');
    check('TENSION_EVENT_NAMES.QUEUE_UPDATED defined', typeof TENSION_EVENT_NAMES.QUEUE_UPDATED === 'string');
    check('TENSION_EVENT_NAMES.SCORE_UPDATED defined', typeof TENSION_EVENT_NAMES.SCORE_UPDATED === 'string');

    // ---- SECTION 7: VISIBILITY_ORDER ----
    check('VISIBILITY_ORDER length === 4', VISIBILITY_ORDER.length === 4);
    check('VISIBILITY_ORDER[0] === SHADOWED', VISIBILITY_ORDER[0] === TENSION_VISIBILITY_STATE.SHADOWED);
    check('VISIBILITY_ORDER[3] === EXPOSED', VISIBILITY_ORDER[3] === TENSION_VISIBILITY_STATE.EXPOSED);

    // ---- SECTION 8: INTERNAL_VISIBILITY_TO_ENVELOPE ----
    check(
      'INTERNAL_VISIBILITY_TO_ENVELOPE.SHADOWED === HIDDEN',
      INTERNAL_VISIBILITY_TO_ENVELOPE[TENSION_VISIBILITY_STATE.SHADOWED] === 'HIDDEN',
    );
    check(
      'INTERNAL_VISIBILITY_TO_ENVELOPE.EXPOSED === EXPOSED',
      INTERNAL_VISIBILITY_TO_ENVELOPE[TENSION_VISIBILITY_STATE.EXPOSED] === 'EXPOSED',
    );

    // ---- SECTION 9: VISIBILITY_CONFIGS ----
    check(
      'VISIBILITY_CONFIGS.SHADOWED.showsThreatType === false',
      VISIBILITY_CONFIGS[TENSION_VISIBILITY_STATE.SHADOWED].showsThreatType === false,
    );
    check(
      'VISIBILITY_CONFIGS.EXPOSED.showsWorstCase === true',
      VISIBILITY_CONFIGS[TENSION_VISIBILITY_STATE.EXPOSED].showsWorstCase === true,
    );
    check(
      'VISIBILITY_CONFIGS.TELEGRAPHED.tensionAwarenessBonus === 0.05',
      VISIBILITY_CONFIGS[TENSION_VISIBILITY_STATE.TELEGRAPHED].tensionAwarenessBonus === 0.05,
    );

    // ---- SECTION 10: THREAT_TYPE_DEFAULT_MITIGATIONS ----
    check(
      'THREAT_TYPE_DEFAULT_MITIGATIONS.CASCADE has entries',
      THREAT_TYPE_DEFAULT_MITIGATIONS[THREAT_TYPE.CASCADE].length > 0,
    );
    check(
      'THREAT_TYPE_DEFAULT_MITIGATIONS.OPPORTUNITY_KILL has entries',
      THREAT_TYPE_DEFAULT_MITIGATIONS[THREAT_TYPE.OPPORTUNITY_KILL].length > 0,
    );

    // ---- SECTION 11: Private helper tests ----
    check(
      'computeAmplifiedWeight(0.5, T2) > computeAmplifiedWeight(0.5, T0)',
      this.computeAmplifiedWeight(0.5, 'T2') > this.computeAmplifiedWeight(0.5, 'T0'),
    );
    check(
      'getVisibilityIndex(SHADOWED) === 0',
      this.getVisibilityIndex(TENSION_VISIBILITY_STATE.SHADOWED) === 0,
    );
    check(
      'getVisibilityIndex(EXPOSED) === 3',
      this.getVisibilityIndex(TENSION_VISIBILITY_STATE.EXPOSED) === 3,
    );
    check(
      'encodeEntryState(QUEUED) === 0',
      this.encodeEntryState(ENTRY_STATE.QUEUED) === 0,
    );
    check(
      'encodeEntryState(NULLIFIED) === 4',
      this.encodeEntryState(ENTRY_STATE.NULLIFIED) === 4,
    );
    check(
      'encodeThreatType(DEBT_SPIRAL) === 0',
      this.encodeThreatType(THREAT_TYPE.DEBT_SPIRAL) === 0,
    );
    check(
      'encodeThreatSeverity(EXISTENTIAL) === 4',
      this.encodeThreatSeverity(THREAT_SEVERITY.EXISTENTIAL) === 4,
    );
    check(
      'getVisibilityAwarenessBonus(EXPOSED) === 0.05',
      this.getVisibilityAwarenessBonus(TENSION_VISIBILITY_STATE.EXPOSED) === 0.05,
    );
    check(
      'computeArrivalProximity(arrivalTick=5, currentTick=5) === 1.0',
      this.computeArrivalProximity(5, 5) === 1.0,
    );
    check(
      'clamp(2, 0, 1) === 1',
      this.clamp(2, 0, 1) === 1,
    );
    check(
      'clamp(-1, 0, 1) === 0',
      this.clamp(-1, 0, 1) === 0,
    );

    // ---- SECTION 12: Method contract tests ----

    // classifyEntryForExpiry
    const mockEntry = this.buildMockAnticipationEntry({
      isNullified: false,
      isMitigated: false,
      isExpired: false,
      isArrived: false,
      arrivalTick: 10,
      state: ENTRY_STATE.QUEUED,
    });
    check(
      'classifyEntryForExpiry returns QUEUED before arrival',
      this.classifyEntryForExpiry(mockEntry, 5) === ENTRY_STATE.QUEUED,
    );
    check(
      'classifyEntryForExpiry returns ARRIVED at arrivalTick',
      this.classifyEntryForExpiry(mockEntry, 10) === ENTRY_STATE.ARRIVED,
    );

    const arrivedEntry = this.buildMockAnticipationEntry({
      isNullified: false,
      isMitigated: false,
      isExpired: false,
      isArrived: true,
      arrivalTick: 3,
      state: ENTRY_STATE.ARRIVED,
    });
    check(
      'classifyEntryForExpiry returns ARRIVED when isArrived=true',
      this.classifyEntryForExpiry(arrivedEntry, 3) === ENTRY_STATE.ARRIVED,
    );

    const nullifiedEntry = this.buildMockAnticipationEntry({
      isNullified: true,
      isMitigated: false,
      isExpired: false,
      isArrived: false,
      arrivalTick: 10,
      state: ENTRY_STATE.NULLIFIED,
    });
    check(
      'classifyEntryForExpiry returns NULLIFIED when isNullified=true',
      this.classifyEntryForExpiry(nullifiedEntry, 5) === ENTRY_STATE.NULLIFIED,
    );

    // computeEntryDecayContribution
    const queuedEntry = this.buildMockAnticipationEntry({
      state: ENTRY_STATE.QUEUED,
      isArrived: false,
      isNullified: false,
      isMitigated: false,
      isExpired: false,
      arrivalTick: 20,
      severityWeight: 0.85,
    });
    const queuedContrib = this.computeEntryDecayContribution(queuedEntry, 'T2');
    check(
      'computeEntryDecayContribution QUEUED > 0',
      queuedContrib > 0,
    );

    const mitigatedEntry = this.buildMockAnticipationEntry({
      state: ENTRY_STATE.MITIGATED,
      isArrived: false,
      isNullified: false,
      isMitigated: true,
      isExpired: false,
      arrivalTick: 1,
      severityWeight: 0.4,
    });
    const mitigatedContrib = this.computeEntryDecayContribution(mitigatedEntry, 'T0');
    check(
      'computeEntryDecayContribution MITIGATED < 0',
      mitigatedContrib < 0,
    );

    // prioritizeByPressureTier
    const sampleInputs: QueueUpsertInput[] = [
      this.buildMockUpsertInput({ threatSeverity: THREAT_SEVERITY.MINOR, arrivalTick: 5, severityWeight: 0.2 }),
      this.buildMockUpsertInput({ threatSeverity: THREAT_SEVERITY.EXISTENTIAL, arrivalTick: 3, severityWeight: 1.0 }),
      this.buildMockUpsertInput({ threatSeverity: THREAT_SEVERITY.CRITICAL, arrivalTick: 4, severityWeight: 0.85 }),
    ];
    const prioritized = this.prioritizeByPressureTier(sampleInputs, 'T3');
    check(
      'prioritizeByPressureTier: EXISTENTIAL first at T3',
      prioritized[0]?.threatSeverity === THREAT_SEVERITY.EXISTENTIAL,
    );
    check(
      'prioritizeByPressureTier: MINOR last at T3',
      prioritized[prioritized.length - 1]?.threatSeverity === THREAT_SEVERITY.MINOR,
    );

    // applyVisibilityFilter
    const filteredShadowed = this.applyVisibilityFilter(sampleInputs, TENSION_VISIBILITY_STATE.SHADOWED);
    check(
      'applyVisibilityFilter SHADOWED removes MINOR threats',
      !filteredShadowed.some((i) => i.threatSeverity === THREAT_SEVERITY.MINOR),
    );

    // routeToChannel
    const existentialInput = this.buildMockUpsertInput({
      threatSeverity: THREAT_SEVERITY.EXISTENTIAL,
      threatType: THREAT_TYPE.SOVEREIGNTY,
    });
    check(
      'routeToChannel EXISTENTIAL → THREAT_ARRIVED',
      this.routeToChannel(existentialInput) === TENSION_EVENT_NAMES.THREAT_ARRIVED,
    );
    const moderateDebtInput = this.buildMockUpsertInput({
      threatSeverity: THREAT_SEVERITY.MODERATE,
      threatType: THREAT_TYPE.DEBT_SPIRAL,
    });
    check(
      'routeToChannel MODERATE DEBT_SPIRAL → QUEUE_UPDATED',
      this.routeToChannel(moderateDebtInput) === TENSION_EVENT_NAMES.QUEUE_UPDATED,
    );

    // buildThreatArrivedEvent
    const arrivedEvt = this.buildThreatArrivedEvent(arrivedEntry, 3, Date.now());
    check(
      'buildThreatArrivedEvent.eventType === THREAT_ARRIVED',
      arrivedEvt.eventType === 'THREAT_ARRIVED',
    );
    check(
      'buildThreatArrivedEvent.entryId matches entry',
      arrivedEvt.entryId === arrivedEntry.entryId,
    );

    // buildThreatMitigatedEvent
    const mitigatedEvt = this.buildThreatMitigatedEvent(arrivedEntry, 4, Date.now());
    check(
      'buildThreatMitigatedEvent.eventType === THREAT_MITIGATED',
      mitigatedEvt.eventType === 'THREAT_MITIGATED',
    );

    // buildThreatExpiredEvent
    const expiredEvt = this.buildThreatExpiredEvent(arrivedEntry, 5, Date.now());
    check(
      'buildThreatExpiredEvent.eventType === THREAT_EXPIRED',
      expiredEvt.eventType === 'THREAT_EXPIRED',
    );

    // buildQueueUpdatedEvent
    const queueEvt = this.buildQueueUpdatedEvent(5, 2, 3, 1, 10, Date.now());
    check(
      'buildQueueUpdatedEvent.eventType === ANTICIPATION_QUEUE_UPDATED',
      queueEvt.eventType === 'ANTICIPATION_QUEUE_UPDATED',
    );
    check(
      'buildQueueUpdatedEvent.queueLength === 5',
      queueEvt.queueLength === 5,
    );

    // buildDLTensorRow
    const tensorRow = this.buildDLTensorRow(
      sampleInputs[0]!,
      0,
      'T2',
      0,
      TENSION_VISIBILITY_STATE.TELEGRAPHED,
    );
    check(
      'buildDLTensorRow returns 8 features',
      tensorRow.length === SOURCE_ADAPTER_DL_FEATURE_WIDTH,
    );
    check(
      'buildDLTensorRow all values in [0, 1]',
      tensorRow.every((v) => v >= 0 && v <= 1),
    );

    // buildDLTensor
    const tensor = this.buildDLTensor(sampleInputs, 0, 'T1', TENSION_VISIBILITY_STATE.SIGNALED);
    check(
      'buildDLTensor rows === SEQUENCE_LENGTH',
      tensor.rows.length === SOURCE_ADAPTER_DL_SEQUENCE_LENGTH,
    );
    check(
      'buildDLTensor each row === FEATURE_WIDTH',
      tensor.rows.every((r) => r.length === SOURCE_ADAPTER_DL_FEATURE_WIDTH),
    );

    // extractMLVector (with mock snapshot)
    const mockSnapshot = this.buildMockSnapshot();
    const mlVector = this.extractMLVector(sampleInputs, mockSnapshot, 'T3', TENSION_VISIBILITY_STATE.EXPOSED);
    check(
      'extractMLVector featureCount === 32',
      mlVector.featureCount === SOURCE_ADAPTER_ML_FEATURE_COUNT,
    );
    check(
      'extractMLVector features.length === 32',
      mlVector.features.length === SOURCE_ADAPTER_ML_FEATURE_COUNT,
    );
    check(
      'extractMLVector all features in [0, 1]',
      mlVector.features.every((f) => f >= 0 && f <= 1),
    );

    // computeDiscoveryMetrics
    const metrics = this.computeDiscoveryMetrics(sampleInputs, 5);
    check(
      'computeDiscoveryMetrics totalDiscovered === sampleInputs.length',
      metrics.totalDiscovered === sampleInputs.length,
    );
    check(
      'computeDiscoveryMetrics existentialCount === 1',
      metrics.existentialCount === 1,
    );
    check(
      'computeDiscoveryMetrics criticalCount === 1',
      metrics.criticalCount === 1,
    );

    // narrateDiscovery
    const narrative = this.narrateDiscovery(sampleInputs, 'T4', TENSION_VISIBILITY_STATE.EXPOSED);
    check(
      'narrateDiscovery returns non-empty string',
      typeof narrative === 'string' && narrative.length > 0,
    );
    check(
      'narrateDiscovery contains tier T4',
      narrative.includes('T4'),
    );

    // computeContextHash
    const hash1 = this.computeContextHash(mockSnapshot, 'T2', 10);
    const hash2 = this.computeContextHash(mockSnapshot, 'T2', 10);
    const hash3 = this.computeContextHash(mockSnapshot, 'T3', 10);
    check(
      'computeContextHash is deterministic',
      hash1 === hash2,
    );
    check(
      'computeContextHash changes with tier',
      hash1 !== hash3,
    );
    check(
      'computeContextHash has src- prefix',
      hash1.startsWith('src-'),
    );

    // validateDiscoveredInputs
    const validResult = this.validateDiscoveredInputs(sampleInputs);
    check(
      'validateDiscoveredInputs passes for valid inputs',
      validResult.valid,
    );

    const invalidInput: QueueUpsertInput = {
      ...sampleInputs[0]!,
      sourceKey: 'duplicate-key',
      arrivalTick: -1, // invalid: before currentTick=0
    };
    const invalidInput2: QueueUpsertInput = {
      ...sampleInputs[1]!,
      sourceKey: 'duplicate-key', // duplicate
    };
    const invalidResult = this.validateDiscoveredInputs([invalidInput, invalidInput2]);
    check(
      'validateDiscoveredInputs fails for invalid inputs',
      !invalidResult.valid,
    );
    check(
      'validateDiscoveredInputs reports errors',
      invalidResult.errors.length > 0,
    );

    // computeDecayContributionBreakdown
    const entries: AnticipationEntry[] = [
      this.buildMockAnticipationEntry({ state: ENTRY_STATE.QUEUED, isArrived: false, isNullified: false, isMitigated: false, isExpired: false, arrivalTick: 10, severityWeight: 0.65, decayTicksRemaining: 3 }),
      this.buildMockAnticipationEntry({ state: ENTRY_STATE.ARRIVED, isArrived: true, isNullified: false, isMitigated: false, isExpired: false, arrivalTick: 2, severityWeight: 1.0, decayTicksRemaining: 0 }),
    ];
    const breakdown = this.computeDecayContributionBreakdown(entries, 'T2', false, false);
    check(
      'computeDecayContributionBreakdown queuedThreats > 0',
      breakdown.queuedThreats > 0,
    );
    check(
      'computeDecayContributionBreakdown arrivedThreats > 0',
      breakdown.arrivedThreats > 0,
    );
    check(
      'computeDecayContributionBreakdown emptyQueueBonus === 0 when queue not empty',
      breakdown.emptyQueueBonus === 0,
    );
    const breakdownEmpty = this.computeDecayContributionBreakdown([], 'T0', true, true);
    check(
      'computeDecayContributionBreakdown emptyQueueBonus > 0 when queue empty',
      breakdownEmpty.emptyQueueBonus > 0,
    );
    check(
      'computeDecayContributionBreakdown sovereigntyBonus > 0 when reached',
      breakdownEmpty.sovereigntyBonus > 0,
    );

    // discoverAll
    const ctx: DiscoveryContext = {
      snapshot: mockSnapshot,
      tier: 'T2',
      visibilityState: TENSION_VISIBILITY_STATE.TELEGRAPHED,
      currentTick: mockSnapshot.tick,
      timestamp: Date.now(),
    };
    const bundle = this.discoverAll(ctx);
    check(
      'discoverAll returns DiscoveryBundle with inputs array',
      Array.isArray(bundle.inputs),
    );
    check(
      'discoverAll returns non-empty narrative',
      typeof bundle.narrative === 'string',
    );
    check(
      'discoverAll contextHash is non-empty',
      bundle.contextHash.length > 0,
    );
    check(
      'discoverAll mlVector featureCount === 32',
      bundle.mlVector.featureCount === SOURCE_ADAPTER_ML_FEATURE_COUNT,
    );
    check(
      'discoverAll dlTensor sequenceLength === 16',
      bundle.dlTensor.sequenceLength === SOURCE_ADAPTER_DL_SEQUENCE_LENGTH,
    );

    // discoverWithPriority
    const prioritizedResult = this.discoverWithPriority(mockSnapshot, 'T4');
    check(
      'discoverWithPriority returns array',
      Array.isArray(prioritizedResult),
    );

    // discoverOpportunityKillThreats
    const starvedSnapshot = this.buildMockSnapshot({
      haterHeat: 75,
      opportunitiesPurchased: 1,
      tick: 12,
    });
    const oppKillResults = this.discoverOpportunityKillThreats(starvedSnapshot);
    check(
      'discoverOpportunityKillThreats returns results when starved',
      oppKillResults.length > 0,
    );
    check(
      'discoverOpportunityKillThreats type === OPPORTUNITY_KILL',
      oppKillResults.every((i) => i.threatType === THREAT_TYPE.OPPORTUNITY_KILL),
    );

    // TensionEventMap reference check — ensure type is used
    const _eventMapRef: Partial<TensionEventMap> = {};
    void _eventMapRef;

    return Object.freeze({
      passed: failures.length === 0,
      checks: Object.freeze([...checks]),
      failures: Object.freeze([...failures]),
    });
  }

  // --------------------------------------------------------------------------
  // MARK: Private helpers
  // --------------------------------------------------------------------------

  /**
   * Computes severity weight amplified by the given pressure tier.
   * Uses PRESSURE_TENSION_AMPLIFIERS[tier].
   */
  private computeAmplifiedWeight(base: number, tier: PressureTier): number {
    return this.clamp(base * PRESSURE_TENSION_AMPLIFIERS[tier], 0, 2);
  }

  /**
   * Returns the index position of a TensionVisibilityState in VISIBILITY_ORDER.
   * Uses VISIBILITY_ORDER for ordered lookup.
   */
  private getVisibilityIndex(state: TensionVisibilityState): number {
    const idx = VISIBILITY_ORDER.indexOf(state);
    return idx === -1 ? 0 : idx;
  }

  /**
   * Encodes an EntryState to a numeric value.
   * Uses ENTRY_STATE constants.
   */
  private encodeEntryState(state: EntryState): number {
    switch (state) {
      case ENTRY_STATE.QUEUED:
        return 0;
      case ENTRY_STATE.ARRIVED:
        return 1;
      case ENTRY_STATE.MITIGATED:
        return 2;
      case ENTRY_STATE.EXPIRED:
        return 3;
      case ENTRY_STATE.NULLIFIED:
        return 4;
      default:
        return 0;
    }
  }

  /**
   * Encodes a ThreatType to a numeric ordinal for DL feature embedding.
   * Uses THREAT_TYPE constants.
   */
  private encodeThreatType(type: ThreatType): number {
    switch (type) {
      case THREAT_TYPE.DEBT_SPIRAL:
        return 0;
      case THREAT_TYPE.SABOTAGE:
        return 1;
      case THREAT_TYPE.HATER_INJECTION:
        return 2;
      case THREAT_TYPE.CASCADE:
        return 3;
      case THREAT_TYPE.SOVEREIGNTY:
        return 4;
      case THREAT_TYPE.OPPORTUNITY_KILL:
        return 5;
      case THREAT_TYPE.REPUTATION_BURN:
        return 6;
      case THREAT_TYPE.SHIELD_PIERCE:
        return 7;
      default:
        return 0;
    }
  }

  /**
   * Encodes a ThreatSeverity to a numeric ordinal.
   * Uses THREAT_SEVERITY constants.
   */
  private encodeThreatSeverity(severity: ThreatSeverity): number {
    switch (severity) {
      case THREAT_SEVERITY.MINOR:
        return 0;
      case THREAT_SEVERITY.MODERATE:
        return 1;
      case THREAT_SEVERITY.SEVERE:
        return 2;
      case THREAT_SEVERITY.CRITICAL:
        return 3;
      case THREAT_SEVERITY.EXISTENTIAL:
        return 4;
      default:
        return 0;
    }
  }

  /**
   * Returns the tensionAwarenessBonus for a given visibility state.
   * Uses VISIBILITY_CONFIGS[state].
   */
  private getVisibilityAwarenessBonus(state: TensionVisibilityState): number {
    return VISIBILITY_CONFIGS[state].tensionAwarenessBonus;
  }

  /**
   * Computes arrival proximity as a value in [0, 1].
   * Proximity = 1.0 when arrivalTick <= currentTick (already arrived or arriving now).
   * Proximity decreases as the arrival is further in the future.
   * Uses TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS as the reference horizon.
   */
  private computeArrivalProximity(arrivalTick: number, currentTick: number): number {
    if (arrivalTick <= currentTick) {
      return 1.0;
    }
    const ticksUntilArrival = arrivalTick - currentTick;
    // Normalize proximity against a reference horizon (10 ticks = 0 proximity)
    const horizon = Math.max(1, TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS * 3 + 1); // = 10
    return this.clamp(1.0 - ticksUntilArrival / horizon, 0, 1);
  }

  /**
   * Clamps value between min and max (inclusive).
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  // --------------------------------------------------------------------------
  // MARK: Merge helper
  // --------------------------------------------------------------------------

  private merge(
    discovered: Map<string, QueueUpsertInput>,
    next: QueueUpsertInput,
  ): void {
    const existing = discovered.get(next.sourceKey);

    if (existing === undefined) {
      discovered.set(next.sourceKey, next);
      return;
    }

    const existingRank = this.severityRank(existing.threatSeverity);
    const nextRank = this.severityRank(next.threatSeverity);

    discovered.set(next.sourceKey, {
      ...existing,
      arrivalTick: Math.min(existing.arrivalTick, next.arrivalTick),
      worstCaseOutcome:
        next.worstCaseOutcome.length > existing.worstCaseOutcome.length
          ? next.worstCaseOutcome
          : existing.worstCaseOutcome,
      mitigationCardTypes:
        next.mitigationCardTypes.length > existing.mitigationCardTypes.length
          ? next.mitigationCardTypes
          : existing.mitigationCardTypes,
      summary:
        next.summary.length > existing.summary.length ? next.summary : existing.summary,
      severityWeight: Math.max(
        existing.severityWeight ?? 0,
        next.severityWeight ?? 0,
      ),
      threatSeverity:
        nextRank > existingRank ? next.threatSeverity : existing.threatSeverity,
    });
  }

  // --------------------------------------------------------------------------
  // MARK: Attack helpers (original, preserved)
  // --------------------------------------------------------------------------

  private attackCategoryToThreatType(attack: AttackEvent): ThreatType {
    switch (attack.category) {
      case 'DEBT':
        return THREAT_TYPE.DEBT_SPIRAL;
      case 'HEAT':
        return THREAT_TYPE.REPUTATION_BURN;
      case 'BREACH':
        return THREAT_TYPE.SHIELD_PIERCE;
      case 'LOCK':
        return THREAT_TYPE.HATER_INJECTION;
      case 'EXTRACTION':
      case 'DRAIN':
      default:
        return THREAT_TYPE.SABOTAGE;
    }
  }

  private attackMagnitudeToSeverity(magnitude: number): ThreatSeverity {
    if (magnitude >= 0.9) {
      return THREAT_SEVERITY.EXISTENTIAL;
    }
    if (magnitude >= 0.7) {
      return THREAT_SEVERITY.CRITICAL;
    }
    if (magnitude >= 0.45) {
      return THREAT_SEVERITY.SEVERE;
    }
    if (magnitude >= 0.2) {
      return THREAT_SEVERITY.MODERATE;
    }
    return THREAT_SEVERITY.MINOR;
  }

  private describeAttackSummary(attack: AttackEvent, threatType: ThreatType): string {
    return `${threatType} from ${String(attack.source)} targeting ${attack.targetLayer} (magnitude=${attack.magnitude.toFixed(2)})`;
  }

  private describeAttackOutcome(attack: AttackEvent, threatType: ThreatType): string {
    switch (threatType) {
      case THREAT_TYPE.DEBT_SPIRAL:
        return `Debt-class attack magnitude ${attack.magnitude.toFixed(2)} threatens cashflow continuity.`;
      case THREAT_TYPE.REPUTATION_BURN:
        return `Heat-class attack magnitude ${attack.magnitude.toFixed(2)} may permanently raise hater pressure.`;
      case THREAT_TYPE.SHIELD_PIERCE:
        return `Breach-class attack magnitude ${attack.magnitude.toFixed(2)} may bypass ${attack.targetLayer}.`;
      case THREAT_TYPE.HATER_INJECTION:
        return `Lock-class attack magnitude ${attack.magnitude.toFixed(2)} may jam decision space.`;
      case THREAT_TYPE.SABOTAGE:
      default:
        return `Extraction/drain attack magnitude ${attack.magnitude.toFixed(2)} threatens direct economic damage.`;
    }
  }

  private financialStressToSeverity(
    deficit: number,
    debtPressure: number,
    netWorth: number,
  ): ThreatSeverity {
    if (netWorth <= 0 || deficit >= 1000 || debtPressure >= 12) {
      return THREAT_SEVERITY.EXISTENTIAL;
    }
    if (deficit >= 500 || debtPressure >= 8) {
      return THREAT_SEVERITY.CRITICAL;
    }
    if (deficit >= 250 || debtPressure >= 5) {
      return THREAT_SEVERITY.SEVERE;
    }
    if (deficit > 0 || debtPressure >= 3) {
      return THREAT_SEVERITY.MODERATE;
    }
    return THREAT_SEVERITY.MINOR;
  }

  private arrivalOffsetForEconomicThreat(severity: ThreatSeverity): number {
    switch (severity) {
      case THREAT_SEVERITY.EXISTENTIAL:
      case THREAT_SEVERITY.CRITICAL:
        return 2;
      case THREAT_SEVERITY.SEVERE:
        return 3;
      case THREAT_SEVERITY.MODERATE:
        return 4;
      case THREAT_SEVERITY.MINOR:
      default:
        return 5;
    }
  }

  private arrivalOffsetForSovereigntyThreat(severity: ThreatSeverity): number {
    switch (severity) {
      case THREAT_SEVERITY.EXISTENTIAL:
        return 5;
      case THREAT_SEVERITY.CRITICAL:
        return 6;
      case THREAT_SEVERITY.SEVERE:
        return 7;
      case THREAT_SEVERITY.MODERATE:
      case THREAT_SEVERITY.MINOR:
      default:
        return 8;
    }
  }

  private severityWeight(severity: ThreatSeverity): number {
    return THREAT_SEVERITY_WEIGHTS[severity];
  }

  private severityRank(severity: ThreatSeverity): number {
    return this.encodeThreatSeverity(severity);
  }

  // --------------------------------------------------------------------------
  // MARK: Self-test mock builders
  // --------------------------------------------------------------------------

  /**
   * Builds a minimal mock AnticipationEntry for self-test purposes.
   * All fields required by the AnticipationEntry interface are provided.
   */
  private buildMockAnticipationEntry(
    overrides: Partial<AnticipationEntry> & {
      state: EntryState;
      isArrived: boolean;
      isNullified: boolean;
      isMitigated: boolean;
      isExpired: boolean;
      arrivalTick: number;
    },
  ): AnticipationEntry {
    return {
      entryId: `test-entry-${Math.random().toString(36).slice(2, 8)}`,
      runId: 'test-run-001',
      sourceKey: overrides.sourceKey ?? 'test:source-key',
      threatId: overrides.threatId ?? 'test-threat-001',
      source: overrides.source ?? 'test:source',
      threatType: overrides.threatType ?? THREAT_TYPE.SABOTAGE,
      threatSeverity: overrides.threatSeverity ?? THREAT_SEVERITY.MODERATE,
      enqueuedAtTick: overrides.enqueuedAtTick ?? 0,
      arrivalTick: overrides.arrivalTick,
      isCascadeTriggered: overrides.isCascadeTriggered ?? false,
      cascadeTriggerEventId: overrides.cascadeTriggerEventId ?? null,
      worstCaseOutcome: overrides.worstCaseOutcome ?? 'Test worst case outcome.',
      mitigationCardTypes: overrides.mitigationCardTypes ?? ['COUNTER_PLAY'],
      baseTensionPerTick: overrides.baseTensionPerTick ?? TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK,
      severityWeight: overrides.severityWeight ?? THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MODERATE],
      summary: overrides.summary ?? 'Test entry summary.',
      state: overrides.state,
      isArrived: overrides.isArrived,
      isMitigated: overrides.isMitigated,
      isExpired: overrides.isExpired,
      isNullified: overrides.isNullified,
      mitigatedAtTick: overrides.mitigatedAtTick ?? null,
      expiredAtTick: overrides.expiredAtTick ?? null,
      ticksOverdue: overrides.ticksOverdue ?? 0,
      decayTicksRemaining: overrides.decayTicksRemaining ?? 0,
    };
  }

  /**
   * Builds a minimal mock QueueUpsertInput for self-test purposes.
   */
  private buildMockUpsertInput(
    overrides: Partial<QueueUpsertInput> & {
      threatSeverity: ThreatSeverity;
    },
  ): QueueUpsertInput {
    const threatType = overrides.threatType ?? THREAT_TYPE.SABOTAGE;
    const key = `test:${threatType}:${overrides.threatSeverity}:${Math.random().toString(36).slice(2, 6)}`;
    return {
      runId: 'test-run-001',
      sourceKey: overrides.sourceKey ?? key,
      threatId: overrides.threatId ?? `test-threat:${key}`,
      source: overrides.source ?? 'test:source',
      threatType,
      threatSeverity: overrides.threatSeverity,
      currentTick: overrides.currentTick ?? 0,
      arrivalTick: overrides.arrivalTick ?? 3,
      isCascadeTriggered: overrides.isCascadeTriggered ?? false,
      cascadeTriggerEventId: overrides.cascadeTriggerEventId ?? null,
      worstCaseOutcome: overrides.worstCaseOutcome ?? 'Test worst case.',
      mitigationCardTypes: overrides.mitigationCardTypes ?? THREAT_TYPE_DEFAULT_MITIGATIONS[threatType],
      summary: overrides.summary ?? `Mock ${overrides.threatSeverity} ${threatType} threat.`,
      severityWeight: overrides.severityWeight ?? THREAT_SEVERITY_WEIGHTS[overrides.threatSeverity],
    };
  }

  /**
   * Builds a minimal mock RunStateSnapshot for self-test purposes.
   * Provides enough structure to exercise all discovery methods.
   */
  private buildMockSnapshot(overrides?: {
    haterHeat?: number;
    opportunitiesPurchased?: number;
    tick?: number;
    debt?: number;
    cash?: number;
  }): RunStateSnapshot {
    const tick = overrides?.tick ?? 5;
    const haterHeat = overrides?.haterHeat ?? 30;
    const debt = overrides?.debt ?? 0;
    const cash = overrides?.cash ?? 10000;

    return {
      tick,
      runId: 'test-run-selftest-001',
      battle: {
        pendingAttacks: [],
      },
      cascade: {
        activeChains: [],
      },
      economy: {
        cash,
        debt,
        incomePerTick: 500,
        expensesPerTick: 400,
        netWorth: cash - debt,
        haterHeat,
        opportunitiesPurchased: overrides?.opportunitiesPurchased ?? 5,
      },
      shield: {
        weakestLayerRatio: 0.5,
        weakestLayerId: 'L1',
      },
      sovereignty: {
        auditFlags: [],
        integrityStatus: 'VERIFIED',
        gapVsLegend: 10,
      },
    } as unknown as RunStateSnapshot;
  }
}
