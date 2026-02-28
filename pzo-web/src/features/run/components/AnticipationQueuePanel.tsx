/**
 * FILE: pzo-web/src/features/run/components/AnticipationQueuePanel.tsx
 * Displays the Anticipation Queue with full visibility-aware filtering.
 *
 * SHADOWED:    Threat count only — all entries show "UNKNOWN THREAT"
 * SIGNALED:    Threat type labels revealed
 * TELEGRAPHED: Arrival countdown ticks revealed
 * EXPOSED:     Mitigation paths and worst-case outcomes revealed
 *
 * No game logic in this file. Reads from useAnticipationQueue hook only.
 * currentTick comes from the tension store snapshot — no useTimeEngine dependency.
 * CSS lives in: pzo-web/src/styles/tension-engine.css
 *
 * Density6 LLC · Point Zero One · Engine 3 of 7 · Confidential
 */
import React from 'react';
import { useAnticipationQueue } from '../hooks/useAnticipationQueue';
import { VisibilityState } from '../../../engines/tension/types';
import type { QueueDisplayEntry } from '../hooks/useAnticipationQueue';

// ── Empty State ────────────────────────────────────────────────────────────

function EmptyQueuePanel(): React.ReactElement {
  return (
    <div className="queue-panel queue-panel--empty" role="status">
      <span className="queue-empty-label">NO ACTIVE THREATS</span>
    </div>
  );
}

// ── Single Queue Entry ─────────────────────────────────────────────────────

interface QueueEntryProps {
  entry: QueueDisplayEntry;
  currentTick: number;
  showsArrivalTick: boolean;
  showsThreatType: boolean;
  showsMitigation: boolean;
  showsWorstCase: boolean;
}

function QueueEntry({
  entry,
  currentTick,
  showsArrivalTick,
  showsThreatType,
  showsMitigation,
  showsWorstCase,
}: QueueEntryProps): React.ReactElement {
  const entryClasses = [
    'queue-entry',
    entry.isArrived        ? 'queue-entry--arrived' : 'queue-entry--queued',
    entry.ticksOverdue > 0 ? 'queue-entry--overdue' : '',
    entry.isCascade        ? 'queue-entry--cascade'  : '',
  ]
    .filter(Boolean)
    .join(' ');

  const countdownLabel = entry.isArrived
    ? `ACTIVE +${entry.ticksOverdue}t`
    : entry.arrivalTick !== null
      ? `IN ${Math.max(0, entry.arrivalTick - currentTick)}t`
      : null;

  return (
    <div className={entryClasses} role="listitem">

      {/* Threat type — revealed at SIGNALED+ */}
      {showsThreatType && entry.threatType !== null ? (
        <div className="entry-header">
          <span className="entry-type">{entry.threatType.replace(/_/g, ' ')}</span>
          {entry.threatSeverity && (
            <span className={`entry-severity entry-severity--${entry.threatSeverity.toLowerCase()}`}>
              {entry.threatSeverity}
            </span>
          )}
          {entry.isCascade && (
            <span className="entry-cascade-badge" title="Cascade triggered">⚡</span>
          )}
        </div>
      ) : (
        <div className="entry-header">
          <span className="entry-type entry-type--hidden">UNKNOWN THREAT</span>
          {entry.isCascade && (
            <span className="entry-cascade-badge" title="Cascade triggered">⚡</span>
          )}
        </div>
      )}

      {/* Arrival countdown — revealed at TELEGRAPHED+ */}
      {showsArrivalTick && countdownLabel && (
        <span className="entry-countdown">{countdownLabel}</span>
      )}

      {/* Worst case — revealed at EXPOSED only */}
      {showsWorstCase && entry.worstCase && (
        <div className="entry-worst-case">⚠ {entry.worstCase}</div>
      )}

      {/* Mitigation path — revealed at EXPOSED only */}
      {showsMitigation && entry.mitigationPath && entry.mitigationPath.length > 0 && (
        <div className="entry-mitigation">
          USE: {entry.mitigationPath.join(' or ')}
        </div>
      )}
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────

interface Props {
  showHeader?: boolean;
  maxVisible?: number;
}

export function AnticipationQueuePanel({
  showHeader = true,
  maxVisible = 10,
}: Props): React.ReactElement {
  const {
    entries,
    visibilityState,
    showsArrivalTick,
    showsThreatType,
    showsMitigation,
    showsWorstCase,
    isEmpty,
    arrivedEntries,
    queuedEntries,
    currentTick,              // ← from tension snapshot, no useTimeEngine needed
  } = useAnticipationQueue();

  if (isEmpty) return <EmptyQueuePanel />;

  const panelClass      = `queue-panel queue-panel--${visibilityState.toLowerCase()}`;
  const visibleEntries  = entries.slice(0, maxVisible);
  const hiddenCount     = Math.max(0, entries.length - maxVisible);

  return (
    <div className={panelClass} role="list" aria-label="Anticipation Queue">

      {showHeader && (
        <div className="queue-panel__header">
          <div className="queue-panel__title">
            <span>ANTICIPATION QUEUE</span>
            {arrivedEntries.length > 0 && (
              <span className="queue-arrived-count">{arrivedEntries.length} ACTIVE</span>
            )}
          </div>
          <span className="visibility-badge" title={`Visibility: ${visibilityState}`}>
            {visibilityState}
          </span>
        </div>
      )}

      {/* SHADOWED — count only */}
      {visibilityState === VisibilityState.SHADOWED && (
        <div className="queue-shadowed-summary">
          <span className="shadowed-count">{entries.length}</span>
          <span className="shadowed-label">
            {entries.length === 1 ? 'threat active' : 'threats active'}
          </span>
        </div>
      )}

      {/* SIGNALED / TELEGRAPHED / EXPOSED — individual entries */}
      {visibilityState !== VisibilityState.SHADOWED && (
        <div className="queue-panel__entries">
          {visibleEntries.map(entry => (
            <QueueEntry
              key={entry.entryId}
              entry={entry}
              currentTick={currentTick}
              showsArrivalTick={showsArrivalTick}
              showsThreatType={showsThreatType}
              showsMitigation={showsMitigation}
              showsWorstCase={showsWorstCase}
            />
          ))}
          {hiddenCount > 0 && (
            <div className="queue-overflow-indicator">+{hiddenCount} more</div>
          )}
        </div>
      )}

      {/* Section divider in TELEGRAPHED / EXPOSED */}
      {(visibilityState === VisibilityState.TELEGRAPHED ||
        visibilityState === VisibilityState.EXPOSED) &&
        arrivedEntries.length > 0 &&
        queuedEntries.length > 0 && (
        <div className="queue-section-divider">
          <span>INCOMING ({queuedEntries.length})</span>
        </div>
      )}
    </div>
  );
}

export default AnticipationQueuePanel;