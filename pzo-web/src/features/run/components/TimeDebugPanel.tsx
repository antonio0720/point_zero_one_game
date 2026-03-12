// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/features/run/components/TimeDebugPanel.tsx

/**
 * FILE: pzo-web/src/features/run/components/TimeDebugPanel.tsx
 * Density6 LLC · Point Zero One · Engine 1 — Time Engine · Confidential
 *
 * TimeDebugPanel
 * - dev-only inspector for adaptive tick timing, decision windows, and season clock state
 * - reads from useTimeEngine() and useSeasonClock()
 * - avoids engine imports and tolerates partial store hydration
 * - derives missing transition/window details locally from the live hook surface
 */

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { coerceTickTierId, type TickTierId } from '../../../engines/time/types';
import { useTimeEngine } from '../hooks/useTimeEngine';
import { useSeasonClock } from '../hooks/useSeasonClock';

const TIME_DEBUG_STYLES = `
  .pzo-time-debug {
    --bg: #080a0d;
    --panel: #0c0f14;
    --panel-2: #111821;
    --border: #1a2030;
    --gold: #c9a84c;
    --amber: #b97d27;
    --crimson: #b92b27;
    --teal: #1de9b6;
    --text: #8fa0b8;
    --textHi: #d5e1f1;
    --mono: 'Share Tech Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    position: fixed;
    left: 10px;
    bottom: 10px;
    z-index: 9999;
    width: 392px;
    max-width: calc(100vw - 20px);
    border: 1px solid var(--border);
    background: linear-gradient(180deg, rgba(12,15,20,.97), rgba(8,10,13,.97));
    border-radius: 8px;
    box-shadow: 0 14px 40px rgba(0,0,0,.55);
    overflow: hidden;
    user-select: none;
  }

  .pzo-time-debug__hdr {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 10px 8px 10px;
    border-bottom: 1px solid var(--border);
  }

  .pzo-time-debug__title {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: .18em;
    color: var(--gold);
    text-transform: uppercase;
    flex: 1;
  }

  .pzo-time-debug__btn {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: .12em;
    color: var(--textHi);
    background: #111820;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 6px 8px;
    cursor: pointer;
  }

  .pzo-time-debug__btn:hover {
    border-color: var(--gold);
  }

  .pzo-time-debug__body {
    padding: 10px;
    display: grid;
    gap: 10px;
  }

  .pzo-time-debug__section {
    display: grid;
    gap: 8px;
    padding: 9px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: rgba(17,24,32,.48);
  }

  .pzo-time-debug__section-title {
    font-family: var(--mono);
    font-size: 9px;
    line-height: 1;
    letter-spacing: .16em;
    text-transform: uppercase;
    color: var(--gold);
  }

  .pzo-time-debug__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .pzo-time-debug__kv {
    display: grid;
    gap: 3px;
    padding: 7px 8px;
    border: 1px solid rgba(255,255,255,.05);
    border-radius: 6px;
    background: rgba(255,255,255,.025);
    min-width: 0;
  }

  .pzo-time-debug__label {
    font-family: var(--mono);
    font-size: 8px;
    line-height: 1;
    letter-spacing: .14em;
    color: var(--text);
    text-transform: uppercase;
  }

  .pzo-time-debug__value {
    color: var(--textHi);
    font-size: 13px;
    line-height: 1.15;
    font-weight: 800;
    overflow-wrap: anywhere;
  }

  .pzo-time-debug__pill-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .pzo-time-debug__pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: rgba(17,24,32,.82);
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: .12em;
    color: var(--textHi);
    width: fit-content;
  }

  .pzo-time-debug__json {
    border: 1px solid var(--border);
    background: rgba(17,24,32,.78);
    border-radius: 6px;
    padding: 8px;
    color: var(--textHi);
    font-family: var(--mono);
    font-size: 9px;
    line-height: 1.35;
    max-height: 240px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .pzo-time-debug__accent--T0 { color: #c9a84c; }
  .pzo-time-debug__accent--T1 { color: #d0d7e2; }
  .pzo-time-debug__accent--T2 { color: #d99838; }
  .pzo-time-debug__accent--T3 { color: #ff7a64; }
  .pzo-time-debug__accent--T4 { color: #ff4b4b; }

  @media (max-width: 640px) {
    .pzo-time-debug__grid {
      grid-template-columns: 1fr;
    }
  }
`;

function injectTimeDebugStyles(): void {
  if (typeof document === 'undefined') return;
  const id = 'pzo-time-debug-styles';
  if (document.getElementById(id)) return;

  const el = document.createElement('style');
  el.id = id;
  el.textContent = TIME_DEBUG_STYLES;
  document.head.appendChild(el);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function formatMs(ms: number): string {
  if (!Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)}s`;

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

interface NormalizedDecisionWindowDebug {
  windowId: string;
  cardId: string;
  durationMs: number | null;
  remainingMs: number | null;
  openedAtMs: number | null;
  expiresAtMs: number | null;
  isOnHold: boolean;
  isExpired: boolean;
  isResolved: boolean;
}

function normalizeActiveWindows(rawWindows: readonly unknown[]): NormalizedDecisionWindowDebug[] {
  return rawWindows
    .map((rawWindow, index) => {
      if (!isRecord(rawWindow)) return null;

      const cardId = typeof rawWindow.cardId === 'string' ? rawWindow.cardId : null;
      if (!cardId) return null;

      const windowId =
        typeof rawWindow.windowId === 'string' && rawWindow.windowId.length > 0
          ? rawWindow.windowId
          : `${cardId}::${index}`;

      const durationMs =
        typeof rawWindow.durationMs === 'number' && Number.isFinite(rawWindow.durationMs)
          ? rawWindow.durationMs
          : null;

      const remainingMs =
        typeof rawWindow.remainingMs === 'number' && Number.isFinite(rawWindow.remainingMs)
          ? rawWindow.remainingMs
          : null;

      const openedAtMs =
        typeof rawWindow.openedAtMs === 'number' && Number.isFinite(rawWindow.openedAtMs)
          ? rawWindow.openedAtMs
          : null;

      const expiresAtMs =
        typeof rawWindow.expiresAtMs === 'number' && Number.isFinite(rawWindow.expiresAtMs)
          ? rawWindow.expiresAtMs
          : null;

      return {
        windowId,
        cardId,
        durationMs,
        remainingMs,
        openedAtMs,
        expiresAtMs,
        isOnHold: Boolean(rawWindow.isOnHold),
        isExpired: Boolean(rawWindow.isExpired),
        isResolved: Boolean(rawWindow.isResolved),
      };
    })
    .filter((window): window is NormalizedDecisionWindowDebug => window !== null)
    .sort((a, b) => {
      const aRemaining = a.remainingMs ?? Number.POSITIVE_INFINITY;
      const bRemaining = b.remainingMs ?? Number.POSITIVE_INFINITY;
      if (aRemaining !== bRemaining) return aRemaining - bRemaining;

      const aOpened = a.openedAtMs ?? Number.POSITIVE_INFINITY;
      const bOpened = b.openedAtMs ?? Number.POSITIVE_INFINITY;
      if (aOpened !== bOpened) return aOpened - bOpened;

      return a.windowId.localeCompare(b.windowId);
    });
}

function pickRepresentativeDecisionWindowMs(
  windows: readonly NormalizedDecisionWindowDebug[],
): number | null {
  const durations = windows
    .map((window) => window.durationMs)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);

  if (durations.length === 0) {
    return null;
  }

  return Math.min(...durations);
}

export interface TimeDebugPanelProps {
  readonly defaultOpen?: boolean;
  readonly showRawJSON?: boolean;
}

export default function TimeDebugPanel({
  defaultOpen = false,
  showRawJSON = true,
}: TimeDebugPanelProps) {
  const time = useTimeEngine();
  const season = useSeasonClock();

  useEffect(() => {
    injectTimeDebugStyles();
  }, []);

  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);

  const currentTier = coerceTickTierId(time.currentTier, 'T1');
  const previousTierRef = useRef<TickTierId | null>(null);
  const [previousTier, setPreviousTier] = useState<TickTierId | null>(null);

  useEffect(() => {
    const lastTier = previousTierRef.current;
    if (lastTier !== null && lastTier !== currentTier) {
      setPreviousTier(lastTier);
    }
    previousTierRef.current = currentTier;
  }, [currentTier]);

  const tickProgressPct = clamp01(time.tickProgressPct);
  const seasonProgressPct = clamp01(season.seasonProgressPct);
  const normalizedActiveWindows = useMemo(
    () => normalizeActiveWindows(Array.isArray(time.activeWindows) ? time.activeWindows : []),
    [time.activeWindows],
  );
  const decisionWindowMs = useMemo(
    () => pickRepresentativeDecisionWindowMs(normalizedActiveWindows),
    [normalizedActiveWindows],
  );

  const snapshot = useMemo(() => {
    return {
      time: {
        currentTier,
        previousTier,
        isTierTransitioning: time.isTierTransitioning,
        tickDurationMs: time.tickDurationMs,
        secondsPerTick: time.secondsPerTick,
        decisionWindowMs,
        ticksElapsed: time.ticksElapsed,
        ticksRemaining: time.ticksRemaining,
        tickBudget: time.tickBudget,
        tickProgressPct,
        activeDecisionCount: time.activeDecisionCount,
        holdsLeft: time.holdsLeft,
        hasActiveDecision: time.hasActiveDecision,
        seasonTimeoutImminent: time.seasonTimeoutImminent,
        ticksUntilTimeout: time.ticksUntilTimeout,
        activeWindows: normalizedActiveWindows,
      },
      season: {
        seasonId: season.seasonId,
        seasonStartMs: season.seasonStartMs,
        seasonEndMs: season.seasonEndMs,
        nowMs: season.nowMs,
        isManifestLoaded: season.isManifestLoaded,
        isSeasonActive: season.isSeasonActive,
        msUntilSeasonStart: season.msUntilSeasonStart,
        msUntilSeasonEnd: season.msUntilSeasonEnd,
        seasonProgressPct,
        pressureMultiplier: season.pressureMultiplier,
        activeWindows: season.activeWindows,
        hasKickoffWindow: season.hasKickoffWindow,
        hasLiveopsWindow: season.hasLiveopsWindow,
        hasFinaleWindow: season.hasFinaleWindow,
        hasArchiveCloseWindow: season.hasArchiveCloseWindow,
        hasReengageWindow: season.hasReengageWindow,
      },
    };
  }, [
    currentTier,
    decisionWindowMs,
    normalizedActiveWindows,
    previousTier,
    season.activeWindows,
    season.hasArchiveCloseWindow,
    season.hasFinaleWindow,
    season.hasKickoffWindow,
    season.hasLiveopsWindow,
    season.hasReengageWindow,
    season.isManifestLoaded,
    season.isSeasonActive,
    season.msUntilSeasonEnd,
    season.msUntilSeasonStart,
    season.nowMs,
    season.pressureMultiplier,
    season.seasonEndMs,
    season.seasonId,
    season.seasonStartMs,
    seasonProgressPct,
    tickProgressPct,
    time.activeDecisionCount,
    time.hasActiveDecision,
    time.holdsLeft,
    time.isTierTransitioning,
    time.secondsPerTick,
    time.seasonTimeoutImminent,
    time.tickBudget,
    time.tickDurationMs,
    time.ticksElapsed,
    time.ticksRemaining,
    time.ticksUntilTimeout,
  ]);

  const snapshotJSON = useMemo(() => {
    try {
      return JSON.stringify(snapshot, null, 2);
    } catch {
      return '{"error":"time snapshot not serializable"}';
    }
  }, [snapshot]);

  const copyJSON = async (): Promise<void> => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(snapshotJSON);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 900);
      }
    } catch {
      // silent
    }
  };

  return (
    <div className="pzo-time-debug" aria-label="Time debug panel">
      <div className="pzo-time-debug__hdr">
        <div className="pzo-time-debug__title">Time Engine Debug</div>

        <button
          type="button"
          className="pzo-time-debug__btn"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? 'HIDE' : 'SHOW'}
        </button>

        {showRawJSON && open ? (
          <button type="button" className="pzo-time-debug__btn" onClick={() => void copyJSON()}>
            {copied ? 'COPIED' : 'COPY JSON'}
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="pzo-time-debug__body">
          <section className="pzo-time-debug__section">
            <div className="pzo-time-debug__section-title">Adaptive Tick State</div>

            <div className="pzo-time-debug__pill-row">
              <span className="pzo-time-debug__pill">
                TIER
                <span className={`pzo-time-debug__accent--${currentTier}`}>{String(currentTier)}</span>
              </span>

              {previousTier ? (
                <span className="pzo-time-debug__pill">PREV {String(previousTier)}</span>
              ) : null}

              <span className="pzo-time-debug__pill">
                TRANSITION {time.isTierTransitioning ? 'YES' : 'NO'}
              </span>

              <span className="pzo-time-debug__pill">
                HOLD {time.holdsLeft}
              </span>

              {time.seasonTimeoutImminent ? (
                <span className="pzo-time-debug__pill">TIMEOUT NEAR</span>
              ) : null}
            </div>

            <div className="pzo-time-debug__grid">
              <div className="pzo-time-debug__kv">
                <div className="pzo-time-debug__label">Tick Duration</div>
                <div className="pzo-time-debug__value">{formatMs(time.tickDurationMs)}</div>
              </div>

              <div className="pzo-time-debug__kv">
                <div className="pzo-time-debug__label">Decision Window</div>
                <div className="pzo-time-debug__value">
                  {decisionWindowMs !== null ? formatMs(decisionWindowMs) : '—'}
                </div>
              </div>

              <div className="pzo-time-debug__kv">
                <div className="pzo-time-debug__label">Tick Budget</div>
                <div className="pzo-time-debug__value">
                  {time.ticksElapsed}/{time.tickBudget}
                </div>
              </div>

              <div className="pzo-time-debug__kv">
                <div className="pzo-time-debug__label">Ticks Remaining</div>
                <div className="pzo-time-debug__value">{time.ticksRemaining}</div>
              </div>

              <div className="pzo-time-debug__kv">
                <div className="pzo-time-debug__label">Tick Progress</div>
                <div className="pzo-time-debug__value">{Math.round(tickProgressPct * 100)}%</div>
              </div>

              <div className="pzo-time-debug__kv">
                <div className="pzo-time-debug__label">Open Windows</div>
                <div className="pzo-time-debug__value">{time.activeDecisionCount}</div>
              </div>

              <div className="pzo-time-debug__kv">
                <div className="pzo-time-debug__label">Seconds / Tick</div>
                <div className="pzo-time-debug__value">{time.secondsPerTick}</div>
              </div>

              <div className="pzo-time-debug__kv">
                <div className="pzo-time-debug__label">Timeout Horizon</div>
                <div className="pzo-time-debug__value">
                  {Number.isFinite(time.ticksUntilTimeout) ? `${time.ticksUntilTimeout} ticks` : '—'}
                </div>
              </div>

              <div className="pzo-time-debug__kv">
                <div className="pzo-time-debug__label">Has Active Decision</div>
                <div className="pzo-time-debug__value">{time.hasActiveDecision ? 'YES' : 'NO'}</div>
              </div>

              <div className="pzo-time-debug__kv">
                <div className="pzo-time-debug__label">Timeout Imminent</div>
                <div className="pzo-time-debug__value">
                  {time.seasonTimeoutImminent ? 'YES' : 'NO'}
                </div>
              </div>
            </div>
          </section>

          <section className="pzo-time-debug__section">
            <div className="pzo-time-debug__section-title">Active Decision Windows</div>

            <div className="pzo-time-debug__pill-row">
              <span className="pzo-time-debug__pill">{normalizedActiveWindows.length} WINDOWS</span>
            </div>

            <pre className="pzo-time-debug__json">
              {normalizedActiveWindows.length > 0
                ? JSON.stringify(normalizedActiveWindows, null, 2)
                : '[]'}
            </pre>
          </section>

          <section className="pzo-time-debug__section">
            <div className="pzo-time-debug__section-title">Season Clock</div>

            <div className="pzo-time-debug__pill-row">
              <span className="pzo-time-debug__pill">
                MANIFEST {season.isManifestLoaded ? 'LOADED' : 'NONE'}
              </span>
              <span className="pzo-time-debug__pill">
                SEASON {season.isSeasonActive ? 'ACTIVE' : 'INACTIVE'}
              </span>
              <span className="pzo-time-debug__pill">
                PRESSURE ×{season.pressureMultiplier.toFixed(2)}
              </span>
            </div>

            <div className="pzo-time-debug__grid">
              <div className="pzo-time-debug__kv">
                <div className="pzo-time-debug__label">Season ID</div>
                <div className="pzo-time-debug__value">{season.seasonId ?? '—'}</div>
              </div>

              <div className="pzo-time-debug__kv">
                <div className="pzo-time-debug__label">Season Progress</div>
                <div className="pzo-time-debug__value">{Math.round(seasonProgressPct * 100)}%</div>
              </div>

              <div className="pzo-time-debug__kv">
                <div className="pzo-time-debug__label">Until Start</div>
                <div className="pzo-time-debug__value">
                  {Number.isFinite(season.msUntilSeasonStart) ? formatMs(season.msUntilSeasonStart) : '∞'}
                </div>
              </div>

              <div className="pzo-time-debug__kv">
                <div className="pzo-time-debug__label">Until End</div>
                <div className="pzo-time-debug__value">
                  {Number.isFinite(season.msUntilSeasonEnd) ? formatMs(season.msUntilSeasonEnd) : '∞'}
                </div>
              </div>

              <div className="pzo-time-debug__kv">
                <div className="pzo-time-debug__label">Active Windows</div>
                <div className="pzo-time-debug__value">{season.activeWindows.length}</div>
              </div>

              <div className="pzo-time-debug__kv">
                <div className="pzo-time-debug__label">Window Flags</div>
                <div className="pzo-time-debug__value">
                  {[
                    season.hasKickoffWindow ? 'KICKOFF' : null,
                    season.hasLiveopsWindow ? 'LIVEOPS' : null,
                    season.hasFinaleWindow ? 'FINALE' : null,
                    season.hasArchiveCloseWindow ? 'ARCHIVE' : null,
                    season.hasReengageWindow ? 'REENGAGE' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </div>
              </div>
            </div>
          </section>

          {showRawJSON ? (
            <section className="pzo-time-debug__section">
              <div className="pzo-time-debug__section-title">Snapshot JSON</div>
              <pre className="pzo-time-debug__json">{snapshotJSON}</pre>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}