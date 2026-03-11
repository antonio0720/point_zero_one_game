/* ========================================================================
 * POINT ZERO ONE — BACKEND ANTICIPATION QUEUE
 * /backend/src/game/engine/tension/AnticipationQueue.ts
 * ====================================================================== */

import { createHash } from 'node:crypto';

import {
  ENTRY_STATE,
  THREAT_SEVERITY,
  THREAT_SEVERITY_WEIGHTS,
  THREAT_TYPE,
  TENSION_CONSTANTS,
  type AnticipationEntry,
  type QueueProcessResult,
  type QueueUpsertInput,
  type ThreatSeverity,
  type ThreatType,
} from './types';

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function createDeterministicId(namespace: string, ...parts: readonly string[]): string {
  return createHash('sha256')
    .update([namespace, ...parts].join('::'))
    .digest('hex')
    .slice(0, 32);
}

export class AnticipationQueue {
  private readonly entries = new Map<string, AnticipationEntry>();

  private readonly sourceIndex = new Map<string, string>();

  public upsert(input: QueueUpsertInput): AnticipationEntry {
    const existingId = this.sourceIndex.get(input.sourceKey);

    if (existingId !== undefined) {
      const existing = this.entries.get(existingId);

      if (existing !== undefined) {
        if (existing.state === ENTRY_STATE.QUEUED) {
          const merged = this.mergeQueuedEntry(existing, input);
          this.entries.set(merged.entryId, merged);
          return merged;
        }

        return existing;
      }
    }

    const entry = this.createEntry(input);
    this.entries.set(entry.entryId, entry);
    this.sourceIndex.set(entry.sourceKey, entry.entryId);

    return entry;
  }

  public upsertMany(inputs: readonly QueueUpsertInput[]): readonly AnticipationEntry[] {
    const created: AnticipationEntry[] = [];

    for (const input of inputs) {
      created.push(this.upsert(input));
    }

    return freezeArray(created);
  }

  public processTick(currentTick: number): QueueProcessResult {
    const newArrivals: AnticipationEntry[] = [];
    const newExpirations: AnticipationEntry[] = [];
    const relievedEntries: AnticipationEntry[] = [];

    for (const entryId of this.entries.keys()) {
      const entry = this.entries.get(entryId);

      if (entry === undefined) {
        continue;
      }

      if (entry.state === ENTRY_STATE.MITIGATED || entry.state === ENTRY_STATE.NULLIFIED) {
        if (entry.decayTicksRemaining > 0) {
          relievedEntries.push(entry);

          const updated: AnticipationEntry = {
            ...entry,
            decayTicksRemaining: Math.max(0, entry.decayTicksRemaining - 1),
          };

          this.entries.set(updated.entryId, updated);
        }

        continue;
      }

      if (entry.state === ENTRY_STATE.EXPIRED) {
        continue;
      }

      let workingEntry = entry;

      if (workingEntry.state === ENTRY_STATE.QUEUED && currentTick >= workingEntry.arrivalTick) {
        const arrived: AnticipationEntry = {
          ...workingEntry,
          state: ENTRY_STATE.ARRIVED,
          isArrived: true,
          baseTensionPerTick: TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK,
        };

        this.entries.set(arrived.entryId, arrived);
        newArrivals.push(arrived);
        workingEntry = arrived;
      }

      if (workingEntry.state === ENTRY_STATE.ARRIVED) {
        const ticksOverdue = Math.max(0, currentTick - workingEntry.arrivalTick);
        const actionWindow = this.getActionWindow(workingEntry.threatType);

        if (ticksOverdue > actionWindow) {
          const expired: AnticipationEntry = {
            ...workingEntry,
            state: ENTRY_STATE.EXPIRED,
            isExpired: true,
            expiredAtTick: currentTick,
            ticksOverdue,
          };

          this.entries.set(expired.entryId, expired);
          newExpirations.push(expired);
        } else {
          const updated: AnticipationEntry = {
            ...workingEntry,
            ticksOverdue,
          };

          this.entries.set(updated.entryId, updated);
        }
      }
    }

    return {
      newArrivals: freezeArray(newArrivals),
      newExpirations: freezeArray(newExpirations),
      activeEntries: this.getActiveEntries(),
      relievedEntries: freezeArray(relievedEntries),
    };
  }

  public mitigateEntry(entryId: string, currentTick: number): AnticipationEntry | null {
    const entry = this.entries.get(entryId);

    if (entry === undefined || entry.state !== ENTRY_STATE.ARRIVED) {
      return null;
    }

    const updated: AnticipationEntry = {
      ...entry,
      state: ENTRY_STATE.MITIGATED,
      isMitigated: true,
      mitigatedAtTick: currentTick,
      decayTicksRemaining: TENSION_CONSTANTS.MITIGATION_DECAY_TICKS,
    };

    this.entries.set(updated.entryId, updated);
    return updated;
  }

  public nullifyEntry(entryId: string): AnticipationEntry | null {
    const entry = this.entries.get(entryId);

    if (
      entry === undefined ||
      (entry.state !== ENTRY_STATE.QUEUED && entry.state !== ENTRY_STATE.ARRIVED)
    ) {
      return null;
    }

    const updated: AnticipationEntry = {
      ...entry,
      state: ENTRY_STATE.NULLIFIED,
      isNullified: true,
      decayTicksRemaining: TENSION_CONSTANTS.NULLIFY_DECAY_TICKS,
    };

    this.entries.set(updated.entryId, updated);
    return updated;
  }

  public getEntry(entryId: string): AnticipationEntry | null {
    return this.entries.get(entryId) ?? null;
  }

  public getActiveEntries(): readonly AnticipationEntry[] {
    return freezeArray(
      [...this.entries.values()].filter(
        (entry) =>
          entry.state === ENTRY_STATE.QUEUED || entry.state === ENTRY_STATE.ARRIVED,
      ),
    );
  }

  public getQueuedEntries(): readonly AnticipationEntry[] {
    return freezeArray(
      [...this.entries.values()].filter((entry) => entry.state === ENTRY_STATE.QUEUED),
    );
  }

  public getArrivedEntries(): readonly AnticipationEntry[] {
    return freezeArray(
      [...this.entries.values()].filter((entry) => entry.state === ENTRY_STATE.ARRIVED),
    );
  }

  public getExpiredEntries(): readonly AnticipationEntry[] {
    return freezeArray(
      [...this.entries.values()].filter((entry) => entry.state === ENTRY_STATE.EXPIRED),
    );
  }

  public getSortedActiveQueue(): readonly AnticipationEntry[] {
    return freezeArray(
      [...this.getActiveEntries()].sort((left, right) => {
        if (left.state !== right.state) {
          return left.state === ENTRY_STATE.ARRIVED ? -1 : 1;
        }

        if (left.state === ENTRY_STATE.ARRIVED) {
          const severityGap =
            this.severityRank(right.threatSeverity) -
            this.severityRank(left.threatSeverity);

          if (severityGap !== 0) {
            return severityGap;
          }

          return left.arrivalTick - right.arrivalTick;
        }

        if (left.arrivalTick !== right.arrivalTick) {
          return left.arrivalTick - right.arrivalTick;
        }

        return (
          this.severityRank(right.threatSeverity) -
          this.severityRank(left.threatSeverity)
        );
      }),
    );
  }

  public getQueueLength(): number {
    return this.getActiveEntries().length;
  }

  public getExpiredCount(): number {
    return this.getExpiredEntries().length;
  }

  public reset(): void {
    this.entries.clear();
    this.sourceIndex.clear();
  }

  private createEntry(input: QueueUpsertInput): AnticipationEntry {
    const effectiveArrivalTick = input.isCascadeTriggered
      ? Math.max(input.currentTick + 1, input.arrivalTick)
      : input.arrivalTick;

    return {
      entryId: createDeterministicId('tension-entry', input.runId, input.sourceKey),
      runId: input.runId,
      sourceKey: input.sourceKey,
      threatId: input.threatId,
      source: input.source,
      threatType: input.threatType,
      threatSeverity: input.threatSeverity,
      enqueuedAtTick: input.currentTick,
      arrivalTick: effectiveArrivalTick,
      isCascadeTriggered: input.isCascadeTriggered,
      cascadeTriggerEventId: input.cascadeTriggerEventId,
      worstCaseOutcome: input.worstCaseOutcome,
      mitigationCardTypes: freezeArray(input.mitigationCardTypes),
      baseTensionPerTick: TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK,
      severityWeight:
        input.severityWeight ?? this.defaultSeverityWeight(input.threatSeverity),
      summary: input.summary,
      state: ENTRY_STATE.QUEUED,
      isArrived: false,
      isMitigated: false,
      isExpired: false,
      isNullified: false,
      mitigatedAtTick: null,
      expiredAtTick: null,
      ticksOverdue: 0,
      decayTicksRemaining: 0,
    };
  }

  private mergeQueuedEntry(
    existing: AnticipationEntry,
    input: QueueUpsertInput,
  ): AnticipationEntry {
    const nextArrival = input.isCascadeTriggered
      ? Math.max(input.currentTick + 1, input.arrivalTick)
      : input.arrivalTick;

    return {
      ...existing,
      arrivalTick: Math.min(existing.arrivalTick, nextArrival),
      worstCaseOutcome:
        input.worstCaseOutcome.length > existing.worstCaseOutcome.length
          ? input.worstCaseOutcome
          : existing.worstCaseOutcome,
      mitigationCardTypes:
        input.mitigationCardTypes.length > existing.mitigationCardTypes.length
          ? freezeArray(input.mitigationCardTypes)
          : existing.mitigationCardTypes,
      summary: input.summary.length > existing.summary.length
        ? input.summary
        : existing.summary,
      severityWeight: Math.max(
        existing.severityWeight,
        input.severityWeight ?? this.defaultSeverityWeight(input.threatSeverity),
      ),
      threatSeverity:
        this.severityRank(input.threatSeverity) >
        this.severityRank(existing.threatSeverity)
          ? input.threatSeverity
          : existing.threatSeverity,
    };
  }

  private getActionWindow(threatType: ThreatType): number {
    switch (threatType) {
      case THREAT_TYPE.HATER_INJECTION:
      case THREAT_TYPE.SHIELD_PIERCE:
        return 0;
      case THREAT_TYPE.SABOTAGE:
      case THREAT_TYPE.REPUTATION_BURN:
      case THREAT_TYPE.CASCADE:
        return 1;
      case THREAT_TYPE.DEBT_SPIRAL:
      case THREAT_TYPE.OPPORTUNITY_KILL:
        return 2;
      case THREAT_TYPE.SOVEREIGNTY:
        return 3;
      default:
        return 2;
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

  private defaultSeverityWeight(severity: ThreatSeverity): number {
    return THREAT_SEVERITY_WEIGHTS[severity];
  }
}