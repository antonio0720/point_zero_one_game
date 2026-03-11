/**
 * ============================================================================
 * FILE: pzo-web/src/features/run/hooks/useAnticipationQueue.ts
 * ============================================================================
 *
 * Purpose:
 * - visibility-aware queue display hook for Engine 3
 * - transforms raw AnticipationEntry objects into presentation-safe records
 * - guarantees SHADOWED / SIGNALED / TELEGRAPHED / EXPOSED disclosure rules
 *
 * Doctrine:
 * - components consume display records, not raw engine semantics
 * - no engine imports; store-only read surface
 * - output is frozen to discourage accidental UI mutation
 * ============================================================================
 */

import { useMemo } from 'react';
import {
  useEngineStore,
  type EngineStoreState,
} from '../../../store/engineStore';
import {
  VISIBILITY_CONFIGS,
  type AnticipationEntry,
  type EntryState,
  type ThreatSeverity,
  type ThreatType,
  type VisibilityConfig,
  type VisibilityState,
} from '../../../engines/tension/types';

export interface QueueDisplayEntry {
  readonly entryId: string;
  readonly state: EntryState;
  readonly isArrived: boolean;
  readonly isCascade: boolean;
  readonly isOverdue: boolean;

  readonly threatType: ThreatType | null;
  readonly threatLabel: string;

  readonly threatSeverity: ThreatSeverity | null;
  readonly severityLabel: string | null;

  readonly arrivalTick: number | null;
  readonly countdownTicks: number | null;

  readonly worstCase: string | null;
  readonly mitigationPath: readonly string[] | null;

  readonly ticksOverdue: number;
  readonly statusLabel: string;
  readonly emphasis: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface UseAnticipationQueueResult {
  readonly entries: readonly QueueDisplayEntry[];
  readonly rawEntries: readonly AnticipationEntry[];

  readonly visibilityState: VisibilityState;
  readonly visibilityConfig: VisibilityConfig;

  readonly currentTick: number;
  readonly visibleThreatCount: number;
  readonly hiddenThreatCount: number;

  readonly showsThreatType: boolean;
  readonly showsArrivalTick: boolean;
  readonly showsMitigation: boolean;
  readonly showsWorstCase: boolean;

  readonly hasArrivedThreats: boolean;
  readonly hasQueuedThreats: boolean;
  readonly isEmpty: boolean;

  readonly threatCountLabel: string;
}

function humanizeToken(value: string): string {
  return value.replace(/_/g, ' ');
}

function resolveEntryEmphasis(entry: AnticipationEntry): QueueDisplayEntry['emphasis'] {
  if (entry.isArrived && entry.ticksOverdue > 0) return 'CRITICAL';

  switch (entry.threatSeverity) {
    case 'EXISTENTIAL':
    case 'CRITICAL':
      return 'CRITICAL';
    case 'SEVERE':
      return 'HIGH';
    case 'MODERATE':
      return 'MEDIUM';
    default:
      return entry.isArrived ? 'HIGH' : 'LOW';
  }
}

function resolveThreatCountLabel(
  count: number,
  visibilityState: VisibilityState,
  hasArrivedThreats: boolean,
): string {
  if (count === 0) return 'NO ACTIVE THREATS';
  if (visibilityState === 'SHADOWED') {
    return `${count} THREAT${count === 1 ? '' : 'S'} DETECTED`;
  }
  if (hasArrivedThreats) {
    return `${count} THREAT${count === 1 ? '' : 'S'} IN FIELD`;
  }
  return `${count} THREAT${count === 1 ? '' : 'S'} TRACKED`;
}

export function useAnticipationQueue(): UseAnticipationQueueResult {
  const rawEntries = useEngineStore(
    (s: EngineStoreState) => s.tension.sortedQueue,
  );
  const visibilityState = useEngineStore(
    (s: EngineStoreState) => s.tension.visibilityState,
  );
  const currentTick = useEngineStore(
    (s: EngineStoreState) => s.tension.currentTick,
  );
  const arrivedCount = useEngineStore(
    (s: EngineStoreState) => s.tension.arrivedCount,
  );
  const queuedCount = useEngineStore(
    (s: EngineStoreState) => s.tension.queuedCount,
  );

  return useMemo<UseAnticipationQueueResult>(() => {
    const visibilityConfig = VISIBILITY_CONFIGS[visibilityState];

    const entries: readonly QueueDisplayEntry[] = Object.freeze(
      rawEntries.map((entry) => {
        const countdownTicks = entry.isArrived
          ? 0
          : Math.max(0, entry.arrivalTick - currentTick);

        const threatType = visibilityConfig.showsThreatType
          ? entry.threatType
          : null;

        const threatSeverity = visibilityConfig.showsThreatType
          ? entry.threatSeverity
          : null;

        const arrivalTick = visibilityConfig.showsArrivalTick
          ? entry.arrivalTick
          : null;

        const mitigationPath = visibilityConfig.showsMitigationPath
          ? Object.freeze([...entry.mitigationCardTypes])
          : null;

        const worstCase = visibilityConfig.showsWorstCase
          ? entry.worstCaseOutcome
          : null;

        const threatLabel =
          threatType === null ? 'UNKNOWN THREAT' : humanizeToken(threatType);

        const severityLabel =
          threatSeverity === null ? null : humanizeToken(threatSeverity);

        const statusLabel = entry.isArrived
          ? entry.ticksOverdue > 0
            ? `ACTIVE +${entry.ticksOverdue}T`
            : 'ACTIVE'
          : arrivalTick !== null
            ? `IN ${countdownTicks}T`
            : 'TRACKED';

        return Object.freeze({
          entryId: entry.entryId,
          state: entry.state,
          isArrived: entry.isArrived,
          isCascade: entry.isCascadeTriggered,
          isOverdue: entry.ticksOverdue > 0,

          threatType,
          threatLabel,

          threatSeverity,
          severityLabel,

          arrivalTick,
          countdownTicks: arrivalTick === null ? null : countdownTicks,

          worstCase,
          mitigationPath,

          ticksOverdue: entry.ticksOverdue,
          statusLabel,
          emphasis: resolveEntryEmphasis(entry),
        });
      }),
    );

    const visibleThreatCount = entries.filter(
      (entry) => entry.threatType !== null || visibilityState === 'SHADOWED',
    ).length;

    return {
      entries,
      rawEntries: Object.freeze([...rawEntries]),

      visibilityState,
      visibilityConfig,

      currentTick,
      visibleThreatCount,
      hiddenThreatCount: Math.max(0, rawEntries.length - visibleThreatCount),

      showsThreatType: visibilityConfig.showsThreatType,
      showsArrivalTick: visibilityConfig.showsArrivalTick,
      showsMitigation: visibilityConfig.showsMitigationPath,
      showsWorstCase: visibilityConfig.showsWorstCase,

      hasArrivedThreats: arrivedCount > 0,
      hasQueuedThreats: queuedCount > 0,
      isEmpty: rawEntries.length === 0,

      threatCountLabel: resolveThreatCountLabel(
        rawEntries.length,
        visibilityState,
        arrivedCount > 0,
      ),
    };
  }, [
    rawEntries,
    visibilityState,
    currentTick,
    arrivedCount,
    queuedCount,
  ]);
}