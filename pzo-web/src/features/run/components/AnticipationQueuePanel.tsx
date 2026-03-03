// FILE: pzo-web/src/features/run/components/AnticipationQueuePanel.tsx
//
// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — ANTICIPATION QUEUE (HUD-MATCHED)
//
// Updated:
//   - Removed dependency on external tension-engine.css
//   - HUD token + mono label styling matches GameHUD
//
// Density6 LLC · Point Zero One · Engine 3 of 7 · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import { useAnticipationQueue } from '../hooks/useAnticipationQueue';
import { VisibilityState } from '../../../engines/tension/types';
import type { QueueDisplayEntry } from '../hooks/useAnticipationQueue';

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const QUEUE_STYLES = `
  .pzo-queue-panel{
    --hud-bg:           var(--hud-bg, #080a0d);
    --hud-panel:        var(--hud-panel, #0c0f14);
    --hud-border:       var(--hud-border, #1a2030);
    --hud-amber:        var(--hud-amber, #c9a84c);
    --hud-crimson:      var(--hud-crimson, #c0392b);
    --hud-teal:         var(--hud-teal, #1de9b6);
    --hud-text:         var(--hud-text, #8fa0b8);
    --hud-text-bright:  var(--hud-text-bright, #c8d8f0);
    --font-mono:        var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace);
    --font-ui:          var(--font-ui, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif);

    background: linear-gradient(180deg, rgba(12,15,20,0.92), rgba(8,10,13,0.88));
    border: 1px solid rgba(26,32,48,0.95);
    border-radius: 10px;
    padding: 10px;
    box-shadow: 0 10px 26px rgba(0,0,0,0.45);
    color: var(--hud-text-bright);
    font-family: var(--font-ui);
  }

  .pzo-queue-header{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    margin-bottom: 8px;
  }

  .pzo-queue-title{
    display:flex;
    align-items:center;
    gap:10px;
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: .22em;
    color: var(--hud-amber);
    text-transform: uppercase;
  }

  .pzo-queue-active{
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: .16em;
    color: var(--hud-crimson);
    text-transform: uppercase;
  }

  .pzo-vis-badge{
    font-family: var(--font-mono);
    font-size: 8px;
    letter-spacing: .18em;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 6px;
    border: 1px solid rgba(26,32,48,0.95);
    color: var(--hud-text);
    background: rgba(17,24,32,0.85);
  }

  .pzo-vis-badge--shadowed{ border-color: rgba(58,74,96,0.85); color: rgba(143,160,184,0.9); }
  .pzo-vis-badge--signaled{ border-color: rgba(201,168,76,0.55); color: var(--hud-amber); }
  .pzo-vis-badge--telegraphed{ border-color: rgba(56,189,248,0.55); color: rgba(56,189,248,0.95); }
  .pzo-vis-badge--exposed{ border-color: rgba(29,233,182,0.55); color: var(--hud-teal); }

  .pzo-queue-shadowed{
    display:flex;
    align-items:baseline;
    justify-content:center;
    gap:10px;
    padding: 12px 10px;
    border-radius: 8px;
    background: rgba(17,24,32,0.65);
    border: 1px solid rgba(26,32,48,0.95);
  }
  .pzo-queue-shadowed__count{
    font-family: var(--font-mono);
    font-size: 22px;
    font-weight: 900;
    color: var(--hud-amber);
    letter-spacing: .06em;
  }
  .pzo-queue-shadowed__lbl{
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: .18em;
    color: var(--hud-text);
    text-transform: uppercase;
  }

  .pzo-queue-entries{
    display:flex;
    flex-direction:column;
    gap:6px;
  }

  .pzo-q-entry{
    border-radius: 8px;
    background: rgba(17,24,32,0.65);
    border: 1px solid rgba(26,32,48,0.95);
    padding: 8px;
    display:flex;
    flex-direction:column;
    gap:4px;
  }
  .pzo-q-entry--arrived{
    border-color: rgba(192,57,43,0.75);
    box-shadow: 0 0 14px rgba(192,57,43,0.18);
  }
  .pzo-q-entry--overdue{
    border-color: rgba(192,57,43,0.95);
    box-shadow: 0 0 18px rgba(192,57,43,0.24);
  }
  .pzo-q-entry--cascade{
    border-color: rgba(192,57,43,0.95);
  }

  .pzo-q-head{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
  }
  .pzo-q-type{
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: .14em;
    color: var(--hud-text-bright);
    text-transform: uppercase;
  }
  .pzo-q-type--hidden{
    color: rgba(143,160,184,0.8);
  }
  .pzo-q-sev{
    font-family: var(--font-mono);
    font-size: 8px;
    letter-spacing: .18em;
    text-transform: uppercase;
    padding: 1px 6px;
    border-radius: 6px;
    border: 1px solid rgba(26,32,48,0.95);
    color: var(--hud-text);
  }
  .pzo-q-sev--low{    border-color: rgba(29,233,182,0.55); color: var(--hud-teal); }
  .pzo-q-sev--mid{    border-color: rgba(201,168,76,0.55); color: var(--hud-amber); }
  .pzo-q-sev--high{   border-color: rgba(249,115,22,0.65); color: rgba(249,115,22,0.95); }
  .pzo-q-sev--urgent{ border-color: rgba(192,57,43,0.85); color: var(--hud-crimson); }

  .pzo-q-countdown{
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: .14em;
    color: var(--hud-amber);
    text-transform: uppercase;
  }

  .pzo-q-worst{
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: .10em;
    color: var(--hud-crimson);
  }

  .pzo-q-mitig{
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: .10em;
    color: var(--hud-teal);
    text-transform: uppercase;
  }

  .pzo-q-overflow{
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: .18em;
    color: var(--hud-text);
    text-transform: uppercase;
    text-align:center;
    padding-top: 6px;
  }

  .pzo-queue-empty{
    text-align:center;
    padding: 14px 10px;
    border-radius: 10px;
    background: rgba(12,15,20,0.92);
    border: 1px solid rgba(26,32,48,0.95);
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: .22em;
    color: var(--hud-text);
    text-transform: uppercase;
  }
`;

function injectStylesOnce(id: string, css: string) {
  if (typeof document === 'undefined') return;
  if (document.getElementById(id)) return;
  const el = document.createElement('style');
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY
// ─────────────────────────────────────────────────────────────────────────────

function EmptyQueuePanel(): React.ReactElement {
  return (
    <div className="pzo-queue-empty" role="status">
      NO ACTIVE THREATS
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTRY
// ─────────────────────────────────────────────────────────────────────────────

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
    'pzo-q-entry',
    entry.isArrived ? 'pzo-q-entry--arrived' : '',
    entry.ticksOverdue > 0 ? 'pzo-q-entry--overdue' : '',
    entry.isCascade ? 'pzo-q-entry--cascade' : '',
  ].filter(Boolean).join(' ');

  const countdownLabel = entry.isArrived
    ? `ACTIVE +${entry.ticksOverdue}t`
    : entry.arrivalTick !== null
      ? `IN ${Math.max(0, entry.arrivalTick - currentTick)}t`
      : null;

  const typeLabel = showsThreatType && entry.threatType !== null
    ? entry.threatType.replace(/_/g, ' ')
    : 'UNKNOWN THREAT';

  const sev = entry.threatSeverity ? entry.threatSeverity.toLowerCase() : null;

  return (
    <div className={entryClasses} role="listitem">
      <div className="pzo-q-head">
        <span className={`pzo-q-type ${typeLabel === 'UNKNOWN THREAT' ? 'pzo-q-type--hidden' : ''}`}>
          {typeLabel}
        </span>
        {entry.threatSeverity && (
          <span className={`pzo-q-sev pzo-q-sev--${sev}`}>
            {entry.threatSeverity}
          </span>
        )}
      </div>

      {showsArrivalTick && countdownLabel && (
        <span className="pzo-q-countdown">{countdownLabel}</span>
      )}

      {showsWorstCase && entry.worstCase && (
        <div className="pzo-q-worst">⚠ {entry.worstCase}</div>
      )}

      {showsMitigation && entry.mitigationPath && entry.mitigationPath.length > 0 && (
        <div className="pzo-q-mitig">
          USE: {entry.mitigationPath.join(' OR ')}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PANEL
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  showHeader?: boolean;
  maxVisible?: number;
}

export function AnticipationQueuePanel({ showHeader = true, maxVisible = 10 }: Props): React.ReactElement {
  useEffect(() => {
    injectStylesOnce('pzo-anticipation-queue-styles', QUEUE_STYLES);
  }, []);

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
    currentTick,
  } = useAnticipationQueue();

  if (isEmpty) return <EmptyQueuePanel />;

  const visibleEntries = entries.slice(0, maxVisible);
  const hiddenCount = Math.max(0, entries.length - maxVisible);

  const badgeClass = [
    'pzo-vis-badge',
    visibilityState === VisibilityState.SHADOWED ? 'pzo-vis-badge--shadowed' : '',
    visibilityState === VisibilityState.SIGNALED ? 'pzo-vis-badge--signaled' : '',
    visibilityState === VisibilityState.TELEGRAPHED ? 'pzo-vis-badge--telegraphed' : '',
    visibilityState === VisibilityState.EXPOSED ? 'pzo-vis-badge--exposed' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="pzo-queue-panel" role="list" aria-label="Anticipation Queue">
      {showHeader && (
        <div className="pzo-queue-header">
          <div className="pzo-queue-title">
            <span>ANTICIPATION QUEUE</span>
            {arrivedEntries.length > 0 && (
              <span className="pzo-queue-active">{arrivedEntries.length} ACTIVE</span>
            )}
          </div>
          <span className={badgeClass} title={`Visibility: ${visibilityState}`}>
            {visibilityState}
          </span>
        </div>
      )}

      {visibilityState === VisibilityState.SHADOWED && (
        <div className="pzo-queue-shadowed">
          <span className="pzo-queue-shadowed__count">{entries.length}</span>
          <span className="pzo-queue-shadowed__lbl">
            {entries.length === 1 ? 'THREAT ACTIVE' : 'THREATS ACTIVE'}
          </span>
        </div>
      )}

      {visibilityState !== VisibilityState.SHADOWED && (
        <div className="pzo-queue-entries">
          {visibleEntries.map((entry) => (
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
            <div className="pzo-q-overflow">+{hiddenCount} MORE</div>
          )}
        </div>
      )}

      {(visibilityState === VisibilityState.TELEGRAPHED || visibilityState === VisibilityState.EXPOSED) &&
        arrivedEntries.length > 0 &&
        queuedEntries.length > 0 && (
        <div style={{ marginTop: 8, fontFamily: 'var(--font-mono, monospace)', fontSize: 9, letterSpacing: '.18em', color: 'var(--hud-text, #8fa0b8)', textTransform: 'uppercase' }}>
          INCOMING ({queuedEntries.length})
        </div>
      )}
    </div>
  );
}

export default AnticipationQueuePanel;