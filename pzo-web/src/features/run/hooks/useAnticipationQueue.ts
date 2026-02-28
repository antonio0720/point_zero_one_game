/**
 * FILE: pzo-web/src/features/run/hooks/useAnticipationQueue.ts
 * Provides queue entries with visibility-filtered display data.
 * Components read from displayEntries — NOT raw AnticipationEntry fields.
 * Visibility filtering happens here, not in components.
 *
 * Density6 LLC · Point Zero One · Engine 3 of 7 · Confidential
 */
import { useEngineStore, type EngineStoreState } from '../../../store/engineStore';
import {
  type VisibilityState,
  VISIBILITY_CONFIGS,
  type ThreatType,
  type ThreatSeverity,
  type EntryState,
} from '../../../engines/tension/types';
import type { AnticipationEntry } from '../../../engines/tension/types';

// ── Display Entry ──────────────────────────────────────────────────────────
// All visibility-gated fields are nullable — null = not yet revealed.
// Components must check null before rendering conditional content.

export interface QueueDisplayEntry {
  entryId: string;
  state: EntryState;
  isArrived: boolean;
  ticksOverdue: number;
  isCascade: boolean;
  // Visibility-gated
  threatType: ThreatType | null;
  threatSeverity: ThreatSeverity | null;
  arrivalTick: number | null;
  worstCase: string | null;
  mitigationPath: readonly string[] | null;
}

export function useAnticipationQueue(): {
  entries: QueueDisplayEntry[];
  rawEntries: AnticipationEntry[];
  visibilityState: VisibilityState;
  currentTick: number;
  showsThreatType: boolean;
  showsArrivalTick: boolean;
  showsMitigation: boolean;
  showsWorstCase: boolean;
  isEmpty: boolean;
  arrivedEntries: QueueDisplayEntry[];
  queuedEntries: QueueDisplayEntry[];
} {
  const sortedQueue  = useEngineStore((s: EngineStoreState) => s.tension.sortedQueue);
  const visibility   = useEngineStore((s: EngineStoreState) => s.tension.visibilityState);
  const currentTick  = useEngineStore((s: EngineStoreState) => s.tension.currentTick);
  const config       = VISIBILITY_CONFIGS[visibility];

  const displayEntries: QueueDisplayEntry[] = sortedQueue.map((entry: AnticipationEntry) => ({
    entryId:        entry.entryId,
    state:          entry.state,
    isArrived:      entry.isArrived,
    ticksOverdue:   entry.ticksOverdue,
    isCascade:      entry.isCascadeTriggered,
    threatType:     config.showsThreatType      ? entry.threatType          : null,
    threatSeverity: config.showsThreatType      ? entry.threatSeverity      : null,
    arrivalTick:    config.showsArrivalTick     ? entry.arrivalTick         : null,
    worstCase:      config.showsWorstCase       ? entry.worstCaseOutcome    : null,
    mitigationPath: config.showsMitigationPath  ? entry.mitigationCardTypes : null,
  }));

  const arrivedEntries = displayEntries.filter(e => e.isArrived);
  const queuedEntries  = displayEntries.filter(e => !e.isArrived);

  return {
    entries: displayEntries,
    rawEntries: sortedQueue,
    visibilityState: visibility,
    currentTick,
    showsThreatType:  config.showsThreatType,
    showsArrivalTick: config.showsArrivalTick,
    showsMitigation:  config.showsMitigationPath,
    showsWorstCase:   config.showsWorstCase,
    isEmpty: sortedQueue.length === 0,
    arrivedEntries,
    queuedEntries,
  };
}