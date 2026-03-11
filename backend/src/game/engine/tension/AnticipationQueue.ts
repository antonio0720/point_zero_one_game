/* ========================================================================
 * POINT ZERO ONE — BACKEND ANTICIPATION QUEUE
 * /backend/src/game/engine/tension/AnticipationQueue.ts
 * ====================================================================== */

import { createDeterministicId } from '../core/Deterministic';
import {
  ENTRY_STATE,
  THREAT_SEVERITY,
  THREAT_TYPE,
  TENSION_CONSTANTS,
  type AnticipationEntry,
  type EntryState,
  type QueueProcessResult,
  type QueueUpsertInput,
  type ThreatSeverity,
  type ThreatType,
} from './types';

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
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
          const updated = this.mergeQueuedEntry(existing, input);
          this.entries.set(updated.entryId, updated);
          return updated;
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

    for (const entry of this.entries.values()) {
      if (entry.state === ENTRY_STATE.MITIGATED || entry.state === ENTRY_STATE.NULLIFIED) {
        if (entry.decayTicksRemaining > 0) {
          relievedEntries.push(entry);
          entry.decayTicksRemaining = Math.max(0, entry.decayTicksRemaining - 1);
        }
        continue;
      }

      if (entry.state === ENTRY_STATE.EXPIRED) {
        continue;
      }

      if (entry.state === ENTRY_STATE.QUEUED && currentTick >= entry.arrivalTick) {
        entry.state = ENTRY_STATE.ARRIVED;
        entry.isArrived = true;
        entry.baseTensionPerTick = TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK;
        newArrivals.push(entry);
      }

      if (entry.state === ENTRY_STATE.ARRIVED) {
        entry.ticksOverdue = Math.max(0, currentTick - entry.arrivalTick);
        const actionWindow = this.getActionWindow(entry.threatType);
        if (entry.ticksOverdue > actionWindow) {
          entry.state = ENTRY_STATE.EXPIRED;
          entry.isExpired = true;
          entry.expiredAtTick = currentTick;
          newExpirations.push(entry);
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

    entry.state = ENTRY_STATE.MITIGATED;
    entry.isMitigated = true;
    entry.mitigatedAtTick = currentTick;
    entry.decayTicksRemaining = TENSION_CONSTANTS.MITIGATION_DECAY_TICKS;
    return entry;
  }

  public nullifyEntry(entryId: string): AnticipationEntry | null {
    const entry = this.entries.get(entryId);
    if (
      entry === undefined ||
      (entry.state !== ENTRY_STATE.QUEUED && entry.state !== ENTRY_STATE.ARRIVED)
    ) {
      return null;
    }

    entry.state = ENTRY_STATE.NULLIFIED;
    entry.isNullified = true;
    entry.decayTicksRemaining = TENSION_CONSTANTS.NULLIFY_DECAY_TICKS;
    return entry;
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
            this.severityRank(right.threatSeverity) - this.severityRank(left.threatSeverity);
          if (severityGap !== 0) {
            return severityGap;
          }
          return left.arrivalTick - right.arrivalTick;
        }

        if (left.arrivalTick !== right.arrivalTick) {
          return left.arrivalTick - right.arrivalTick;
        }

        return (
          this.severityRank(right.threatSeverity) - this.severityRank(left.threatSeverity)
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
      severityWeight: input.severityWeight ?? this.defaultSeverityWeight(input.threatSeverity),
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
      summary: input.summary.length > existing.summary.length ? input.summary : existing.summary,
      severityWeight: Math.max(existing.severityWeight, input.severityWeight ?? 0),
      threatSeverity:
        this.severityRank(input.threatSeverity) > this.severityRank(existing.threatSeverity)
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
}