/**
 * ============================================================================
 * FILE: pzo-web/src/features/run/components/AnticipationQueuePanel.tsx
 * ============================================================================
 *
 * Purpose:
 * - production-ready Engine 3 queue panel for the run HUD
 * - fully aligned to the live useAnticipationQueue() + useTensionEngine() hooks
 * - respects visibility doctrine without re-implementing engine logic in React
 *
 * Doctrine:
 * - components stay thin
 * - hooks own transformation / disclosure logic
 * - styles come from pzo-web/src/styles/tension-engine.css
 * - no inline style injection, no cross-engine imports
 * ============================================================================
 */

'use client';

import React, { useMemo } from 'react';
import '../../../styles/tension-engine.css';

import {
  useAnticipationQueue,
  type QueueDisplayEntry,
} from '../hooks/useAnticipationQueue';
import { useTensionEngine } from '../hooks/useTensionEngine';

export interface AnticipationQueuePanelProps {
  readonly title?: string;
  readonly showHeader?: boolean;
  readonly showFooter?: boolean;
  readonly maxVisible?: number;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

function severityClass(entry: QueueDisplayEntry): string {
  switch (entry.emphasis) {
    case 'CRITICAL':
      return 'pzo-tension-queue__entry--critical';
    case 'HIGH':
      return 'pzo-tension-queue__entry--high';
    case 'MEDIUM':
      return 'pzo-tension-queue__entry--medium';
    default:
      return 'pzo-tension-queue__entry--low';
  }
}

function urgencyClass(urgency: string): string {
  switch (urgency) {
    case 'COLLAPSE_IMMINENT':
      return 'pzo-tension-queue__badge--collapse';
    case 'URGENT':
      return 'pzo-tension-queue__badge--urgent';
    case 'BUILDING':
      return 'pzo-tension-queue__badge--building';
    default:
      return 'pzo-tension-queue__badge--clear';
  }
}

function visibilityClass(visibilityState: string): string {
  return `pzo-tension-queue__badge--${visibilityState.toLowerCase()}`;
}

function markerGlyph(entry: QueueDisplayEntry): string {
  if (entry.isCascade) return '↯';
  if (entry.isArrived && entry.isOverdue) return '▲';
  if (entry.isArrived) return '●';
  return '◌';
}

function renderEta(entry: QueueDisplayEntry): string {
  if (entry.isArrived) {
    return entry.ticksOverdue > 0
      ? `ACTIVE +${entry.ticksOverdue}T`
      : 'ACTIVE NOW';
  }

  if (typeof entry.countdownTicks === 'number') {
    return `ETA ${entry.countdownTicks}T`;
  }

  return entry.statusLabel;
}

function ShadowedThreatView(props: {
  readonly total: number;
  readonly arrivedCount: number;
  readonly queuedCount: number;
  readonly hiddenThreatCount: number;
}): React.ReactElement {
  const { total, arrivedCount, queuedCount, hiddenThreatCount } = props;

  const pipCount = Math.min(12, total);
  const pips = Array.from({ length: pipCount }, (_, index) => {
    const isHot = index < Math.min(arrivedCount, pipCount);
    return (
      <span
        key={`shadow-pip-${index}`}
        className={cx(
          'pzo-tension-queue__shadow-pip',
          isHot && 'pzo-tension-queue__shadow-pip--hot',
        )}
      />
    );
  });

  return (
    <div className="pzo-tension-queue__shadowed" aria-live="polite">
      <div className="pzo-tension-queue__shadowed-main">
        <div className="pzo-tension-queue__shadowed-count">{total}</div>
        <div className="pzo-tension-queue__shadowed-copy">
          <div className="pzo-tension-queue__shadowed-label">
            THREAT{total === 1 ? '' : 'S'} DETECTED
          </div>
          <div className="pzo-tension-queue__shadowed-meta">
            <span>{arrivedCount} ACTIVE</span>
            <span>{queuedCount} TRACKED</span>
            {hiddenThreatCount > 0 && <span>INTEL MASKED</span>}
          </div>
        </div>
      </div>

      <div className="pzo-tension-queue__shadow-pips" aria-hidden="true">
        {pips}
      </div>
    </div>
  );
}

function QueueEntryCard(props: {
  readonly entry: QueueDisplayEntry;
  readonly showsThreatType: boolean;
  readonly showsArrivalTick: boolean;
  readonly showsMitigation: boolean;
  readonly showsWorstCase: boolean;
}): React.ReactElement {
  const { entry, showsThreatType, showsArrivalTick, showsMitigation, showsWorstCase } = props;

  const title = showsThreatType ? entry.threatLabel : 'UNKNOWN THREAT';
  const etaLabel = showsArrivalTick ? renderEta(entry) : entry.statusLabel;

  return (
    <article
      className={cx(
        'pzo-tension-queue__entry',
        entry.isArrived && 'pzo-tension-queue__entry--arrived',
        entry.isOverdue && 'pzo-tension-queue__entry--overdue',
        entry.isCascade && 'pzo-tension-queue__entry--cascade',
        severityClass(entry),
      )}
      aria-label={title}
    >
      <div className="pzo-tension-queue__entry-top">
        <div className="pzo-tension-queue__entry-title-group">
          <span
            className={cx(
              'pzo-tension-queue__entry-marker',
              entry.isArrived && 'pzo-tension-queue__entry-marker--active',
            )}
            aria-hidden="true"
          >
            {markerGlyph(entry)}
          </span>

          <div className="pzo-tension-queue__entry-heading">
            <div
              className={cx(
                'pzo-tension-queue__entry-title',
                !showsThreatType && 'pzo-tension-queue__entry-title--masked',
              )}
            >
              {title}
            </div>

            <div className="pzo-tension-queue__entry-subline">
              {entry.severityLabel && (
                <span className="pzo-tension-queue__severity-pill">
                  {entry.severityLabel}
                </span>
              )}

              {entry.isCascade && (
                <span className="pzo-tension-queue__chip pzo-tension-queue__chip--cascade">
                  CASCADE
                </span>
              )}

              {entry.isOverdue && (
                <span className="pzo-tension-queue__chip pzo-tension-queue__chip--overdue">
                  OVERDUE
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="pzo-tension-queue__entry-status-group">
          <span className="pzo-tension-queue__status-pill">{entry.state}</span>
          <span className="pzo-tension-queue__eta">{etaLabel}</span>
        </div>
      </div>

      <div className="pzo-tension-queue__entry-body">
        {showsArrivalTick && typeof entry.countdownTicks === 'number' && !entry.isArrived && (
          <div className="pzo-tension-queue__row">
            <span className="pzo-tension-queue__row-label">ARRIVAL</span>
            <span className="pzo-tension-queue__row-value">
              TICK {entry.arrivalTick} · IN {entry.countdownTicks}T
            </span>
          </div>
        )}

        {entry.isArrived && (
          <div className="pzo-tension-queue__row">
            <span className="pzo-tension-queue__row-label">STATUS</span>
            <span className="pzo-tension-queue__row-value">
              {entry.ticksOverdue > 0
                ? `ACTION WINDOW MISSED BY ${entry.ticksOverdue}T`
                : 'ACTION WINDOW OPEN'}
            </span>
          </div>
        )}

        {showsWorstCase && entry.worstCase && (
          <div className="pzo-tension-queue__alert">
            <span className="pzo-tension-queue__alert-label">WORST CASE</span>
            <span className="pzo-tension-queue__alert-value">{entry.worstCase}</span>
          </div>
        )}

        {showsMitigation && entry.mitigationPath && entry.mitigationPath.length > 0 && (
          <div className="pzo-tension-queue__mitigation">
            <span className="pzo-tension-queue__mitigation-label">MITIGATE WITH</span>
            <div className="pzo-tension-queue__mitigation-chips">
              {entry.mitigationPath.map((cardType) => (
                <span key={`${entry.entryId}-${cardType}`} className="pzo-tension-queue__mitigation-chip">
                  {cardType}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export function AnticipationQueuePanel({
  title = 'ANTICIPATION QUEUE',
  showHeader = true,
  showFooter = true,
  maxVisible = 8,
  className,
  style,
}: AnticipationQueuePanelProps): React.ReactElement {
  const queue = useAnticipationQueue();
  const tension = useTensionEngine();

  const visibleEntries = useMemo<readonly QueueDisplayEntry[]>(
    () => Object.freeze(queue.entries.slice(0, Math.max(1, maxVisible))),
    [queue.entries, maxVisible],
  );

  const overflowCount = Math.max(0, queue.entries.length - visibleEntries.length);

  const rootClassName = cx(
    'pzo-tension-queue',
    `pzo-tension-queue--${queue.visibilityState.toLowerCase()}`,
    tension.isPulseActive && 'pzo-tension-queue--pulse',
    tension.isSustainedPulse && 'pzo-tension-queue--pulse-sustained',
    tension.isEscalating && 'pzo-tension-queue--escalating',
    className,
  );

  if (queue.isEmpty) {
    return (
      <section className={cx(rootClassName, 'pzo-tension-queue--empty')} style={style}>
        <div className="pzo-tension-queue__empty">
          <div className="pzo-tension-queue__empty-title">NO ACTIVE THREATS</div>
          <div className="pzo-tension-queue__empty-subtitle">
            QUEUE CLEAR · DREAD SUPPRESSED
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={rootClassName}
      style={style}
      aria-label={title}
      aria-live={tension.isPulseActive ? 'assertive' : 'polite'}
    >
      {showHeader && (
        <header className="pzo-tension-queue__header">
          <div className="pzo-tension-queue__header-left">
            <div className="pzo-tension-queue__title">{title}</div>
            <div className="pzo-tension-queue__subtitle">{queue.threatCountLabel}</div>
          </div>

          <div className="pzo-tension-queue__header-right">
            <div className="pzo-tension-queue__score-block">
              <span className="pzo-tension-queue__score-label">TENSION</span>
              <span className="pzo-tension-queue__score-value">
                {Math.round(tension.scorePct)}%
              </span>
            </div>

            <div className="pzo-tension-queue__badges">
              <span
                className={cx(
                  'pzo-tension-queue__badge',
                  visibilityClass(queue.visibilityState),
                )}
              >
                {queue.visibilityState}
              </span>

              <span
                className={cx(
                  'pzo-tension-queue__badge',
                  urgencyClass(tension.threatUrgency),
                )}
              >
                {tension.threatUrgency}
              </span>

              <span className="pzo-tension-queue__badge pzo-tension-queue__badge--band">
                {tension.tensionBand}
              </span>

              <span className="pzo-tension-queue__badge pzo-tension-queue__badge--trend">
                {tension.trend}
              </span>
            </div>
          </div>
        </header>
      )}

      <div className="pzo-tension-queue__metrics" aria-hidden="true">
        <div className="pzo-tension-queue__metric">
          <span className="pzo-tension-queue__metric-key">ACTIVE</span>
          <span className="pzo-tension-queue__metric-value">{tension.arrivedCount}</span>
        </div>
        <div className="pzo-tension-queue__metric">
          <span className="pzo-tension-queue__metric-key">TRACKED</span>
          <span className="pzo-tension-queue__metric-value">{tension.queuedCount}</span>
        </div>
        <div className="pzo-tension-queue__metric">
          <span className="pzo-tension-queue__metric-key">SCARS</span>
          <span className="pzo-tension-queue__metric-value">{tension.expiredCount}</span>
        </div>
        <div className="pzo-tension-queue__metric">
          <span className="pzo-tension-queue__metric-key">TICK</span>
          <span className="pzo-tension-queue__metric-value">{tension.currentTick}</span>
        </div>
      </div>

      {queue.visibilityState === 'SHADOWED' ? (
        <ShadowedThreatView
          total={queue.entries.length}
          arrivedCount={tension.arrivedCount}
          queuedCount={tension.queuedCount}
          hiddenThreatCount={queue.hiddenThreatCount}
        />
      ) : (
        <div className="pzo-tension-queue__list">
          {visibleEntries.map((entry) => (
            <QueueEntryCard
              key={entry.entryId}
              entry={entry}
              showsThreatType={queue.showsThreatType}
              showsArrivalTick={queue.showsArrivalTick}
              showsMitigation={queue.showsMitigation}
              showsWorstCase={queue.showsWorstCase}
            />
          ))}

          {overflowCount > 0 && (
            <div className="pzo-tension-queue__overflow">
              +{overflowCount} MORE THREAT{overflowCount === 1 ? '' : 'S'} TRACKED
            </div>
          )}
        </div>
      )}

      {showFooter && (
        <footer className="pzo-tension-queue__footer">
          <div className="pzo-tension-queue__footer-line">
            <span>NEXT ETA</span>
            <strong>
              {tension.nextThreatEta === null ? 'CLEAR' : `${tension.nextThreatEta}T`}
            </strong>
          </div>

          <div className="pzo-tension-queue__footer-line">
            <span>PULSE</span>
            <strong>
              {tension.isPulseActive ? 'ON' : 'OFF'}
              {tension.isPulseActive ? ` · ${tension.pulseTicksActive}T` : ''}
            </strong>
          </div>

          <div className="pzo-tension-queue__footer-line">
            <span>DOMINANT</span>
            <strong>
              {tension.dominantEntry ? tension.dominantEntry.threatType : 'NONE'}
            </strong>
          </div>
        </footer>
      )}
    </section>
  );
}

export default AnticipationQueuePanel;