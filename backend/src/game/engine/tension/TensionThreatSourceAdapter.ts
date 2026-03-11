/* ========================================================================
 * POINT ZERO ONE — BACKEND TENSION THREAT SOURCE ADAPTER
 * /backend/src/game/engine/tension/TensionThreatSourceAdapter.ts
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

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

export class TensionThreatSourceAdapter {
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

  private discoverBattleThreats(snapshot: RunStateSnapshot): readonly QueueUpsertInput[] {
    const inputs: QueueUpsertInput[] = [];
    const currentTick = snapshot.tick;

    for (const attack of snapshot.battle.pendingAttacks) {
      const threatType = this.attackCategoryToThreatType(attack);
      const threatSeverity = this.attackMagnitudeToSeverity(attack.magnitude);
      const arrivalTick = Math.max(currentTick + 1, attack.createdAtTick + 1);

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
        severityWeight: this.severityWeight(threatSeverity),
      });
    }

    return freezeArray(inputs);
  }

  private discoverCascadeThreats(snapshot: RunStateSnapshot): readonly QueueUpsertInput[] {
    const inputs: QueueUpsertInput[] = [];
    const currentTick = snapshot.tick;

    for (const chain of snapshot.cascade.activeChains) {
      if (chain.status !== 'ACTIVE') {
        continue;
      }

      for (const link of chain.links) {
        if (link.scheduledTick < currentTick) {
          continue;
        }

        const threatSeverity =
          link.scheduledTick <= currentTick + 1
            ? THREAT_SEVERITY.CRITICAL
            : link.scheduledTick <= currentTick + 2
              ? THREAT_SEVERITY.SEVERE
              : THREAT_SEVERITY.MODERATE;

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
          summary: `Cascade chain ${chain.chainId} queued: ${link.summary}`,
          severityWeight: this.severityWeight(threatSeverity),
        });
      }
    }

    return freezeArray(inputs);
  }

  private discoverEconomyThreats(snapshot: RunStateSnapshot): readonly QueueUpsertInput[] {
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
        summary: `Debt spiral forming: deficit=${deficit.toFixed(2)} debtPressure=${debtPressure.toFixed(2)}`,
        severityWeight: this.severityWeight(severity),
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
        summary: `Hater heat spike at ${snapshot.economy.haterHeat.toFixed(2)}`,
        severityWeight: this.severityWeight(severity),
      });
    }

    return freezeArray(inputs);
  }

  private discoverShieldThreats(snapshot: RunStateSnapshot): readonly QueueUpsertInput[] {
    const inputs: QueueUpsertInput[] = [];
    const currentTick = snapshot.tick;

    if (snapshot.shield.weakestLayerRatio <= 0.35) {
      const severity =
        snapshot.shield.weakestLayerRatio <= 0.08
          ? THREAT_SEVERITY.CRITICAL
          : snapshot.shield.weakestLayerRatio <= 0.18
            ? THREAT_SEVERITY.SEVERE
            : THREAT_SEVERITY.MODERATE;

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
        severityWeight: this.severityWeight(severity),
      });
    }

    return freezeArray(inputs);
  }

  private discoverSovereigntyThreats(snapshot: RunStateSnapshot): readonly QueueUpsertInput[] {
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
        : THREAT_SEVERITY.SEVERE;

    const worstCaseOutcome = quarantined
      ? 'Integrity quarantine threatens proof continuity, verification trust, and long-horizon wealth preservation.'
      : hasAuditPressure
        ? `Audit pressure mounting: ${snapshot.sovereignty.auditFlags.join(', ')}`
        : `Legend gap expanded to ${snapshot.sovereignty.gapVsLegend.toFixed(2)}`;

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
      summary: `Sovereignty pressure: status=${snapshot.sovereignty.integrityStatus} gap=${snapshot.sovereignty.gapVsLegend.toFixed(2)}`,
      severityWeight: this.severityWeight(severity),
    });

    return freezeArray(inputs);
  }

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
      summary: next.summary.length > existing.summary.length
        ? next.summary
        : existing.summary,
      severityWeight: Math.max(existing.severityWeight ?? 0, next.severityWeight ?? 0),
      threatSeverity: nextRank > existingRank ? next.threatSeverity : existing.threatSeverity,
    });
  }

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
    return `${threatType} from ${String(attack.source)} targeting ${attack.targetLayer}`;
  }

  private describeAttackOutcome(
    attack: AttackEvent,
    threatType: ThreatType,
  ): string {
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
    switch (severity) {
      case THREAT_SEVERITY.EXISTENTIAL:
        return 1;
      case THREAT_SEVERITY.CRITICAL:
        return 0.85;
      case THREAT_SEVERITY.SEVERE:
        return 0.65;
      case THREAT_SEVERITY.MODERATE:
        return 0.4;
      case THREAT_SEVERITY.MINOR:
      default:
        return 0.2;
    }
  }

  private severityRank(severity: ThreatSeverity): number {
    switch (severity) {
      case THREAT_SEVERITY.EXISTENTIAL:
        return 5;
      case THREAT_SEVERITY.CRITICAL:
        return 4;
      case THREAT_SEVERITY.SEVERE:
        return 3;
      case THREAT_SEVERITY.MODERATE:
        return 2;
      case THREAT_SEVERITY.MINOR:
      default:
        return 1;
    }
  }
}