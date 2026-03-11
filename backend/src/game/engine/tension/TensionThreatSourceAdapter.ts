/* ========================================================================
 * POINT ZERO ONE — BACKEND TENSION THREAT SOURCE ADAPTER
 * /backend/src/game/engine/tension/TensionThreatSourceAdapter.ts
 * ====================================================================== */

import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import {
  THREAT_SEVERITY,
  THREAT_SEVERITY_WEIGHTS,
  THREAT_TYPE,
  THREAT_TYPE_DEFAULT_MITIGATIONS,
  type QueueUpsertInput,
  type ThreatSeverity,
  type ThreatType,
} from './types';

export class TensionThreatSourceAdapter {
  public discover(snapshot: RunStateSnapshot): readonly QueueUpsertInput[] {
    const threats: QueueUpsertInput[] = [];

    for (const attack of snapshot.battle.pendingAttacks) {
      threats.push(this.buildAttackThreat(snapshot, attack));
    }

    for (const chain of snapshot.cascade.activeChains) {
      for (const link of chain.links) {
        if (link.scheduledTick < snapshot.tick) {
          continue;
        }
        threats.push(this.buildCascadeThreat(snapshot, chain.templateId, link));
      }
    }

    const sovereigntyThreat = this.buildSovereigntyThreat(snapshot);
    if (sovereigntyThreat !== null) {
      threats.push(sovereigntyThreat);
    }

    return Object.freeze(threats);
  }

  private buildAttackThreat(
    snapshot: RunStateSnapshot,
    attack: {
      readonly attackId: string;
      readonly source: string;
      readonly magnitude: number;
      readonly category: string;
    },
  ): QueueUpsertInput {
    const threatType = this.resolveAttackThreatType(attack.category);
    const threatSeverity = this.resolveSeverityFromMagnitude(snapshot, attack.magnitude);
    const arrivalTick = this.resolveAttackArrivalTick(snapshot, threatType);

    return {
      runId: snapshot.runId,
      sourceKey: `attack:${attack.attackId}`,
      threatId: attack.attackId,
      source: attack.source,
      threatType,
      threatSeverity,
      currentTick: snapshot.tick,
      arrivalTick,
      isCascadeTriggered: false,
      cascadeTriggerEventId: null,
      worstCaseOutcome: this.buildAttackWorstCase(threatType, attack),
      mitigationCardTypes: THREAT_TYPE_DEFAULT_MITIGATIONS[threatType],
      summary: `${attack.category} inbound from ${attack.source}`,
      severityWeight: Math.max(
        THREAT_SEVERITY_WEIGHTS[threatSeverity],
        this.normalizeMagnitude(snapshot, attack.magnitude),
      ),
    };
  }

  private buildCascadeThreat(
    snapshot: RunStateSnapshot,
    templateId: string,
    link: {
      readonly linkId: string;
      readonly scheduledTick: number;
      readonly summary: string;
      readonly effect: {
        readonly cashDelta?: number;
        readonly shieldDelta?: number;
        readonly heatDelta?: number;
      };
    },
  ): QueueUpsertInput {
    const impactScore =
      Math.abs(link.effect.cashDelta ?? 0) +
      Math.abs(link.effect.shieldDelta ?? 0) +
      Math.abs(link.effect.heatDelta ?? 0);

    const threatSeverity = this.resolveSeverityFromMagnitude(snapshot, impactScore);

    return {
      runId: snapshot.runId,
      sourceKey: `cascade:${templateId}:${link.linkId}:${link.scheduledTick}`,
      threatId: link.linkId,
      source: templateId,
      threatType: THREAT_TYPE.CASCADE,
      threatSeverity,
      currentTick: snapshot.tick,
      arrivalTick: Math.max(snapshot.tick + 1, link.scheduledTick),
      isCascadeTriggered: true,
      cascadeTriggerEventId: link.linkId,
      worstCaseOutcome: link.summary,
      mitigationCardTypes: THREAT_TYPE_DEFAULT_MITIGATIONS[THREAT_TYPE.CASCADE],
      summary: link.summary,
      severityWeight: Math.max(
        THREAT_SEVERITY_WEIGHTS[threatSeverity],
        this.normalizeMagnitude(snapshot, impactScore),
      ),
    };
  }

  private buildSovereigntyThreat(
    snapshot: RunStateSnapshot,
  ): QueueUpsertInput | null {
    const integrityHot =
      snapshot.sovereignty.integrityStatus === 'QUARANTINED' ||
      snapshot.sovereignty.auditFlags.length > 0;
    const legendGapHot = snapshot.sovereignty.gapVsLegend >= 0.8;

    if (!integrityHot && !legendGapHot) {
      return null;
    }

    const severity =
      snapshot.sovereignty.gapVsLegend >= 0.95
        ? THREAT_SEVERITY.EXISTENTIAL
        : THREAT_SEVERITY.CRITICAL;

    return {
      runId: snapshot.runId,
      sourceKey: `sovereignty:${snapshot.runId}`,
      threatId: `sovereignty-${snapshot.runId}`,
      source: 'sovereignty',
      threatType: THREAT_TYPE.SOVEREIGNTY,
      threatSeverity: severity,
      currentTick: snapshot.tick,
      arrivalTick: snapshot.tick + 5,
      isCascadeTriggered: false,
      cascadeTriggerEventId: null,
      worstCaseOutcome:
        'Proof chain fracture, legend gap hardens, and wealth freedom path destabilizes.',
      mitigationCardTypes: THREAT_TYPE_DEFAULT_MITIGATIONS[THREAT_TYPE.SOVEREIGNTY],
      summary: 'Long-window sovereignty fracture forming.',
      severityWeight: THREAT_SEVERITY_WEIGHTS[severity],
    };
  }

  private resolveAttackThreatType(category: string): ThreatType {
    const normalized = category.trim().toLowerCase();

    if (normalized.includes('debt')) {
      return THREAT_TYPE.DEBT_SPIRAL;
    }
    if (normalized.includes('sabotage')) {
      return THREAT_TYPE.SABOTAGE;
    }
    if (normalized.includes('reputation') || normalized.includes('heat')) {
      return THREAT_TYPE.REPUTATION_BURN;
    }
    if (normalized.includes('shield') || normalized.includes('pierce')) {
      return THREAT_TYPE.SHIELD_PIERCE;
    }
    if (normalized.includes('opportunity')) {
      return THREAT_TYPE.OPPORTUNITY_KILL;
    }
    if (normalized.includes('inject') || normalized.includes('hater')) {
      return THREAT_TYPE.HATER_INJECTION;
    }

    return THREAT_TYPE.SABOTAGE;
  }

  private resolveAttackArrivalTick(
    snapshot: RunStateSnapshot,
    threatType: ThreatType,
  ): number {
    if (
      threatType === THREAT_TYPE.HATER_INJECTION ||
      threatType === THREAT_TYPE.SHIELD_PIERCE
    ) {
      return snapshot.tick + 1;
    }

    const extractionBias = Math.max(1, snapshot.battle.extractionCooldownTicks + 1);
    return snapshot.tick + extractionBias;
  }

  private resolveSeverityFromMagnitude(
    snapshot: RunStateSnapshot,
    magnitude: number,
  ): ThreatSeverity {
    const normalized = this.normalizeMagnitude(snapshot, magnitude);

    if (normalized >= 0.75) {
      return THREAT_SEVERITY.EXISTENTIAL;
    }
    if (normalized >= 0.5) {
      return THREAT_SEVERITY.CRITICAL;
    }
    if (normalized >= 0.3) {
      return THREAT_SEVERITY.SEVERE;
    }
    if (normalized >= 0.12) {
      return THREAT_SEVERITY.MODERATE;
    }
    return THREAT_SEVERITY.MINOR;
  }

  private normalizeMagnitude(snapshot: RunStateSnapshot, magnitude: number): number {
    const baseline = Math.max(
      1,
      Math.abs(snapshot.economy.incomePerTick) +
        Math.abs(snapshot.economy.expensesPerTick) +
        Math.max(1, Math.abs(snapshot.economy.netWorth) * 0.05),
    );
    return Math.min(1, Math.max(0, Math.abs(magnitude) / baseline));
  }

  private buildAttackWorstCase(
    threatType: ThreatType,
    attack: {
      readonly source: string;
      readonly magnitude: number;
      readonly category: string;
    },
  ): string {
    switch (threatType) {
      case THREAT_TYPE.DEBT_SPIRAL:
        return `Debt spiral compounds from ${attack.source}; projected loss ${attack.magnitude.toFixed(2)}.`;
      case THREAT_TYPE.REPUTATION_BURN:
        return `Heat spike from ${attack.source}; long-tail trust drag activates.`;
      case THREAT_TYPE.SHIELD_PIERCE:
        return `Defense bypass from ${attack.source}; shield layer integrity can drop immediately.`;
      case THREAT_TYPE.OPPORTUNITY_KILL:
        return `Upside path is at risk; ${attack.source} can erase a positive lane.`;
      case THREAT_TYPE.HATER_INJECTION:
        return `Hostile payload enters the run surface from ${attack.source}.`;
      case THREAT_TYPE.SABOTAGE:
      default:
        return `${attack.category} from ${attack.source} can wipe momentum and liquidity.`;
    }
  }
}