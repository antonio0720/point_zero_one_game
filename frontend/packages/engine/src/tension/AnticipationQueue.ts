/**
 * FILE: /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/tension/AnticipationQueue.ts
 * Manages the lifecycle of queued threats.
 * All entry creation and mutation happens here.
 * TensionEngine calls processArrivalTick() each tick and reads the results.
 *
 * IMPORTS: types.ts only. Never imports any other engine module.
 *
 * Density6 LLC · Point Zero One · Engine 3 of 7 · Confidential
 */
import { v4 as uuidv4 } from 'uuid';
import {
  AnticipationEntry,
  EntryState,
  ThreatType,
  ThreatSeverity,
  TENSION_CONSTANTS,
} from './types';

// ── Input for enqueue ─────────────────────────────────────────────────────
export interface EnqueueInput {
  threatId: string;                       // matches Threat object in game state
  threatType: ThreatType;
  threatSeverity: ThreatSeverity;
  currentTick: number;                    // tick this is being enqueued
  arrivalTick: number;                    // when it should arrive
  isCascadeTriggered: boolean;
  cascadeTriggerEventId: string | null;
  worstCaseOutcome: string;
  mitigationCardTypes: readonly string[];
}

// ── Output of processArrivalTick ──────────────────────────────────────────
export interface ArrivalTickResult {
  newArrivals: AnticipationEntry[];       // entries that transitioned to ARRIVED this tick
  newExpirations: AnticipationEntry[];    // entries that transitioned to EXPIRED this tick
  activeQueue: AnticipationEntry[];       // all entries NOT in MITIGATED/EXPIRED/NULLIFIED
  mitigatingEntries: AnticipationEntry[]; // entries mid-decay (post-mitigation)
}

export class AnticipationQueue {
  private entries: Map<string, AnticipationEntry> = new Map();

  // ── Enqueue ────────────────────────────────────────────────────────────

  /**
   * Add a new threat to the queue.
   * All fields must be provided at enqueue time. No lazy initialization.
   * Cascade-triggered threats always get at least 1 tick of warning.
   * Returns the created entry.
   */
  public enqueue(input: EnqueueInput): AnticipationEntry {
    // RULE: Cascade-triggered threats always get 1 tick of warning regardless of arrivalTick.
    // This prevents invisible instakills from cascade chain reactions.
    const effectiveArrivalTick = input.isCascadeTriggered
      ? Math.max(input.currentTick + 1, input.arrivalTick)
      : input.arrivalTick;

    const entry: AnticipationEntry = {
      // Immutable fields — all set here, never mutated after creation
      entryId:               uuidv4(),
      threatId:              input.threatId,
      threatType:            input.threatType,
      threatSeverity:        input.threatSeverity,
      enqueuedAtTick:        input.currentTick,
      arrivalTick:           effectiveArrivalTick,
      isCascadeTriggered:    input.isCascadeTriggered,
      cascadeTriggerEventId: input.cascadeTriggerEventId,
      worstCaseOutcome:      input.worstCaseOutcome,
      mitigationCardTypes:   Object.freeze([...input.mitigationCardTypes]),
      baseTensionPerTick:    TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK,
      // Mutable lifecycle fields
      state:               EntryState.QUEUED,
      isArrived:           false,
      isMitigated:         false,
      isExpired:           false,
      isNullified:         false,
      mitigatedAtTick:     null,
      expiredAtTick:       null,
      ticksOverdue:        0,
      decayTicksRemaining: 0,
    };

    this.entries.set(entry.entryId, entry);
    return entry;
  }

  // ── Tick Processing ────────────────────────────────────────────────────

  /**
   * Process arrivals and expirations for the current tick.
   * Called by TensionEngine at Step 1 of computeTension().
   *
   * Transitions:
   *   QUEUED   → ARRIVED  when currentTick >= arrivalTick
   *   ARRIVED  → EXPIRED  when ticksOverdue > actionWindow (per ThreatType)
   *   MITIGATED           decayTicksRemaining is decremented here
   */
  public processArrivalTick(currentTick: number): ArrivalTickResult {
    const newArrivals: AnticipationEntry[] = [];
    const newExpirations: AnticipationEntry[] = [];
    const mitigatingEntries: AnticipationEntry[] = [];

    for (const entry of this.entries.values()) {
      // Terminal states — skip entirely
      if (entry.state === EntryState.EXPIRED || entry.state === EntryState.NULLIFIED) {
        continue;
      }

      // Post-mitigation decay countdown
      if (entry.state === EntryState.MITIGATED) {
        if (entry.decayTicksRemaining > 0) {
          entry.decayTicksRemaining--;
          mitigatingEntries.push(entry);
        }
        continue;
      }

      // QUEUED → ARRIVED transition
      if (entry.state === EntryState.QUEUED && currentTick >= entry.arrivalTick) {
        entry.state = EntryState.ARRIVED;
        entry.isArrived = true;
        newArrivals.push(entry);
        continue;
      }

      // ARRIVED → EXPIRED check
      if (entry.state === EntryState.ARRIVED) {
        entry.ticksOverdue = currentTick - entry.arrivalTick;
        const actionWindow = this.getActionWindow(entry.threatType);
        if (entry.ticksOverdue > actionWindow) {
          entry.state = EntryState.EXPIRED;
          entry.isExpired = true;
          entry.expiredAtTick = currentTick;
          newExpirations.push(entry);
        }
      }
    }

    const activeQueue = this.getActiveEntries();
    return { newArrivals, newExpirations, activeQueue, mitigatingEntries };
  }

  // ── Action Window ──────────────────────────────────────────────────────

  /**
   * How many ticks a player has to mitigate an arrived threat before it expires.
   * Window is fixed by ThreatType at enqueue — does NOT change if pressure escalates.
   */
  private getActionWindow(threatType: ThreatType): number {
    switch (threatType) {
      case ThreatType.HATER_INJECTION:  return 0; // expires same tick it arrives
      case ThreatType.SHIELD_PIERCE:    return 0; // immediate — no window
      case ThreatType.SABOTAGE:         return 1; // 1 tick window
      case ThreatType.REPUTATION_BURN:  return 1;
      case ThreatType.CASCADE:          return 1;
      case ThreatType.DEBT_SPIRAL:      return 2; // 2 tick window
      case ThreatType.OPPORTUNITY_KILL: return 2;
      case ThreatType.SOVEREIGNTY:      return 3; // 3 tick window — existential threat
      default:                          return 2;
    }
  }

  // ── Mitigation & Nullification ─────────────────────────────────────────

  /**
   * Mark an entry as mitigated. Only valid for ARRIVED entries.
   * Returns true on success, false if entry not found or not in ARRIVED state.
   * EXPIRED entries cannot be mitigated — consequence already applied by CascadeEngine.
   */
  public mitigateEntry(entryId: string, currentTick: number): boolean {
    const entry = this.entries.get(entryId);
    if (!entry || entry.state !== EntryState.ARRIVED) return false;
    entry.state = EntryState.MITIGATED;
    entry.isMitigated = true;
    entry.mitigatedAtTick = currentTick;
    entry.decayTicksRemaining = TENSION_CONSTANTS.MITIGATION_DECAY_TICKS;
    return true;
  }

  /**
   * Nullify an entry via card effect (not player mitigation).
   * Valid for QUEUED or ARRIVED entries. Grants partial decay (-0.04/tick).
   * Less relief than active mitigation (-0.08/tick).
   */
  public nullifyEntry(entryId: string, _currentTick: number): boolean {
    const entry = this.entries.get(entryId);
    if (!entry) return false;
    if (entry.state !== EntryState.QUEUED && entry.state !== EntryState.ARRIVED) {
      return false;
    }
    entry.state = EntryState.NULLIFIED;
    entry.isNullified = true;
    entry.decayTicksRemaining = TENSION_CONSTANTS.NULLIFY_DECAY_TICKS;
    return true;
  }

  // ── Read Accessors ─────────────────────────────────────────────────────

  public getEntry(entryId: string): AnticipationEntry | undefined {
    return this.entries.get(entryId);
  }

  /** QUEUED + ARRIVED entries only. Terminal states excluded. */
  public getActiveEntries(): AnticipationEntry[] {
    return Array.from(this.entries.values()).filter(
      e => e.state === EntryState.QUEUED || e.state === EntryState.ARRIVED
    );
  }

  public getArrivedEntries(): AnticipationEntry[] {
    return Array.from(this.entries.values()).filter(
      e => e.state === EntryState.ARRIVED
    );
  }

  public getQueuedEntries(): AnticipationEntry[] {
    return Array.from(this.entries.values()).filter(
      e => e.state === EntryState.QUEUED
    );
  }

  /** All expired entries — ghost penalties reference this list each tick. */
  public getExpiredEntries(): AnticipationEntry[] {
    return Array.from(this.entries.values()).filter(
      e => e.state === EntryState.EXPIRED
    );
  }

  public getMitigatingEntries(): AnticipationEntry[] {
    return Array.from(this.entries.values()).filter(
      e => e.state === EntryState.MITIGATED && e.decayTicksRemaining > 0
    );
  }

  /**
   * Sorted active queue for frontend display:
   * ARRIVED threats first (sorted by severity DESC),
   * then QUEUED threats (sorted by arrivalTick ASC).
   */
  public getSortedActiveQueue(): AnticipationEntry[] {
    const severityOrder: Record<string, number> = {
      EXISTENTIAL: 4,
      CRITICAL:    3,
      SEVERE:      2,
      MODERATE:    1,
      MINOR:       0,
    };

    const arrived = this.getArrivedEntries().sort(
      (a, b) => (severityOrder[b.threatSeverity] ?? 0) - (severityOrder[a.threatSeverity] ?? 0)
    );
    const queued = this.getQueuedEntries().sort(
      (a, b) => a.arrivalTick - b.arrivalTick
    );

    return [...arrived, ...queued];
  }

  /** Count of QUEUED + ARRIVED entries (active threats only). */
  public getQueueLength(): number {
    return this.getActiveEntries().length;
  }

  /** Total expired entries this run. Ghost penalty count derives from this. */
  public getTotalExpiredCount(): number {
    return this.getExpiredEntries().length;
  }

  // ── Reset ──────────────────────────────────────────────────────────────

  /** Full reset — clears all entries. Called at run start by TensionEngine.reset(). */
  public reset(): void {
    this.entries.clear();
  }
}