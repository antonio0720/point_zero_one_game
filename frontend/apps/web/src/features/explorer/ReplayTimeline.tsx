/**
 * ReplayTimeline component for Point Zero One Digital's financial roguelike game.
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/frontend/apps/web/src/features/explorer/ReplayTimeline.tsx
 *
 * Sovereign implementation:
 *   - Full TypeScript types — no `any`
 *   - Standalone useReducer instead of global Redux slice (can be lifted later)
 *   - Fetches real run replay from /api/runs/:runId/replay
 *   - Turn-indexed scrubber — not moment/time-based (runs are turn-counted, not clock-based)
 *   - Keyboard nav (ArrowLeft/ArrowRight) for rapid autopsy
 */

import React, { useCallback, useEffect, useReducer, useRef } from 'react';
import axios from 'axios';

// ── Domain types ──────────────────────────────────────────────────────────────

export interface TurnSnapshot {
  /** 1-based turn index */
  turnIndex:   number;
  cashAtTurn:  number;
  netWorth:    number;
  incomeRate:  number;
  expenseRate: number;
  /** Card played this turn */
  cardId:      string | null;
  cardName:    string | null;
  /** Outcome delta vs previous turn */
  delta:       number;
  /** True if this turn was identified as a pivotal fork */
  isPivotal:   boolean;
  eventLabel?: string;
}

export interface ReplayWindow {
  id:          number;
  /** 1-based turn index where this window starts */
  startTurn:   number;
  /** 1-based turn index where this window ends (inclusive) */
  endTurn:     number;
  snapshots:   TurnSnapshot[];
}

// ── State machine ─────────────────────────────────────────────────────────────

interface ReplayState {
  windows:          ReplayWindow[];
  activeTurnIndex:  number;      // 1-based
  totalTurns:       number;
  loading:          boolean;
  error:            string | null;
}

const INITIAL_STATE: ReplayState = {
  windows:         [],
  activeTurnIndex: 1,
  totalTurns:      0,
  loading:         false,
  error:           null,
};

type ReplayAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; windows: ReplayWindow[]; totalTurns: number }
  | { type: 'FETCH_ERROR';   error: string }
  | { type: 'SET_TURN';      turnIndex: number };

export function replayReducer(state: ReplayState, action: ReplayAction): ReplayState {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS':
      return {
        ...state,
        loading:         false,
        windows:         action.windows,
        totalTurns:      action.totalTurns,
        activeTurnIndex: 1,
      };
    case 'FETCH_ERROR':
      return { ...state, loading: false, error: action.error };
    case 'SET_TURN':
      return {
        ...state,
        activeTurnIndex: Math.max(1, Math.min(action.turnIndex, state.totalTurns)),
      };
    default:
      return state;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useReplayData(runId: string | null) {
  const [state, dispatch] = useReducer(replayReducer, INITIAL_STATE);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;

    (async () => {
      dispatch({ type: 'FETCH_START' });
      try {
        const { data } = await axios.get<{ windows: ReplayWindow[]; totalTurns: number }>(
          `/api/runs/${runId}/replay`,
        );
        if (!cancelled) {
          dispatch({ type: 'FETCH_SUCCESS', windows: data.windows, totalTurns: data.totalTurns });
        }
      } catch (err) {
        if (!cancelled) {
          dispatch({
            type:  'FETCH_ERROR',
            error: err instanceof Error ? err.message : 'Failed to load replay',
          });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [runId]);

  const setTurn = useCallback((turnIndex: number) => {
    dispatch({ type: 'SET_TURN', turnIndex });
  }, []);

  return { state, setTurn };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the TurnSnapshot for the active turn index, searching across windows. */
function getActiveSnapshot(
  windows:    ReplayWindow[],
  turnIndex:  number,
): TurnSnapshot | null {
  for (const window of windows) {
    if (turnIndex >= window.startTurn && turnIndex <= window.endTurn) {
      const snap = window.snapshots.find(s => s.turnIndex === turnIndex);
      return snap ?? null;
    }
  }
  return null;
}

function formatCash(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ReplayTimelineProps {
  runId: string;
  /** Called when user scrubs to a turn — lets parent components sync */
  onTurnChange?: (snapshot: TurnSnapshot | null) => void;
}

const ReplayTimeline: React.FC<ReplayTimelineProps> = ({ runId, onTurnChange }) => {
  const { state, setTurn } = useReplayData(runId);
  const { windows, activeTurnIndex, totalTurns, loading, error } = state;

  const trackRef = useRef<HTMLDivElement>(null);

  // Notify parent
  useEffect(() => {
    if (!onTurnChange) return;
    onTurnChange(getActiveSnapshot(windows, activeTurnIndex));
  }, [windows, activeTurnIndex, onTurnChange]);

  // Keyboard scrubbing
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setTurn(activeTurnIndex + 1);
      if (e.key === 'ArrowLeft')  setTurn(activeTurnIndex - 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTurnIndex, setTurn]);

  // Click on track to scrub
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current || totalTurns === 0) return;
    const { left, width } = trackRef.current.getBoundingClientRect();
    const ratio     = Math.max(0, Math.min(1, (e.clientX - left) / width));
    const turnIndex = Math.round(1 + ratio * (totalTurns - 1));
    setTurn(turnIndex);
  };

  if (loading) return <TimelineSkeleton />;
  if (error)   return <p style={{ color: '#f87171' }}>Error: {error}</p>;
  if (!windows.length) return null;

  const activeSnap = getActiveSnapshot(windows, activeTurnIndex);
  const progress   = totalTurns > 1 ? (activeTurnIndex - 1) / (totalTurns - 1) : 0;

  // Build pivotal markers
  const pivotalTurns = windows
    .flatMap(w => w.snapshots)
    .filter(s => s.isPivotal)
    .map(s => s.turnIndex);

  return (
    <section
      aria-label="Replay Timeline"
      style={{ display: 'flex', flexDirection: 'column', gap: 12, userSelect: 'none' }}
    >
      {/* Turn header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>
          Turn {activeTurnIndex} / {totalTurns}
        </span>
        {activeSnap && (
          <span style={{ fontSize: 12, color: '#9ca3af' }}>
            Net Worth: {formatCash(activeSnap.netWorth)}
            {' · '}
            Card: {activeSnap.cardName ?? '—'}
            {activeSnap.isPivotal && (
              <span style={{ marginLeft: 6, color: '#f59e0b', fontWeight: 700 }}>
                ⚡ Pivotal
              </span>
            )}
          </span>
        )}
      </div>

      {/* Scrub track */}
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        role="slider"
        aria-valuemin={1}
        aria-valuemax={totalTurns}
        aria-valuenow={activeTurnIndex}
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'ArrowRight') setTurn(activeTurnIndex + 1);
          if (e.key === 'ArrowLeft')  setTurn(activeTurnIndex - 1);
        }}
        style={{
          position: 'relative',
          height:   12,
          background: '#1f2937',
          borderRadius: 6,
          cursor: 'pointer',
        }}
      >
        {/* Filled portion */}
        <div
          style={{
            position:     'absolute',
            left:         0,
            top:          0,
            height:       '100%',
            width:        `${progress * 100}%`,
            background:   '#2563eb',
            borderRadius: 6,
            transition:   'width 80ms ease',
          }}
        />

        {/* Pivotal markers */}
        {totalTurns > 1 && pivotalTurns.map(t => (
          <div
            key={t}
            title={`Pivotal turn ${t}`}
            style={{
              position:     'absolute',
              top:          -2,
              height:       16,
              width:        3,
              background:   '#f59e0b',
              borderRadius: 2,
              left:         `${((t - 1) / (totalTurns - 1)) * 100}%`,
              transform:    'translateX(-50%)',
            }}
          />
        ))}

        {/* Thumb */}
        <div
          style={{
            position:     'absolute',
            top:          '50%',
            left:         `${progress * 100}%`,
            transform:    'translate(-50%, -50%)',
            width:        18,
            height:       18,
            background:   '#fff',
            border:       '2px solid #2563eb',
            borderRadius: '50%',
            transition:   'left 80ms ease',
            boxShadow:    '0 1px 4px rgba(0,0,0,0.4)',
          }}
        />
      </div>

      {/* Delta chip + card info */}
      {activeSnap && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <DeltaChip label="Δ Net Worth" value={activeSnap.delta} isCurrency />
          <DeltaChip label="Cash"        value={activeSnap.cashAtTurn} isCurrency />
          <DeltaChip label="Income"      value={activeSnap.incomeRate} isCurrency />
          <DeltaChip label="Expenses"    value={-activeSnap.expenseRate} isCurrency />
        </div>
      )}

      {/* Pagination: window-level prev/next */}
      <div style={{ display: 'flex', gap: 8 }}>
        <NavButton
          label="◀ Prev"
          disabled={activeTurnIndex <= 1}
          onClick={() => setTurn(activeTurnIndex - 1)}
        />
        {windows.map(w => (
          <NavButton
            key={w.id}
            label={`${w.startTurn}–${w.endTurn}`}
            disabled={activeTurnIndex >= w.startTurn && activeTurnIndex <= w.endTurn}
            onClick={() => setTurn(w.startTurn)}
          />
        ))}
        <NavButton
          label="Next ▶"
          disabled={activeTurnIndex >= totalTurns}
          onClick={() => setTurn(activeTurnIndex + 1)}
        />
      </div>
    </section>
  );
};

// ── Sub-components ─────────────────────────────────────────────────────────────

const DeltaChip: React.FC<{
  label:      string;
  value:      number;
  isCurrency?: boolean;
}> = ({ label, value, isCurrency }) => {
  const isPos = value > 0;
  const isNeg = value < 0;
  const color = isPos ? '#4ade80' : isNeg ? '#f87171' : '#9ca3af';
  const formatted = isCurrency ? formatCash(value) : String(value);

  return (
    <span
      style={{
        display:    'inline-flex',
        alignItems: 'center',
        gap:        4,
        padding:    '3px 10px',
        borderRadius: 999,
        background:   '#1f2937',
        fontSize:     11,
        fontWeight:   600,
        color,
      }}
    >
      {label}: {isPos ? '+' : ''}{formatted}
    </span>
  );
};

const NavButton: React.FC<{
  label:    string;
  disabled: boolean;
  onClick:  () => void;
}> = ({ label, disabled, onClick }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      padding:      '4px 12px',
      fontSize:     12,
      background:   disabled ? '#111827' : '#1f2937',
      color:        disabled ? '#374151' : '#e5e7eb',
      border:       '1px solid #374151',
      borderRadius: 6,
      cursor:       disabled ? 'default' : 'pointer',
    }}
  >
    {label}
  </button>
);

const TimelineSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ height: 20, borderRadius: 4, background: '#1f2937', width: '40%' }} />
    <div style={{ height: 12, borderRadius: 6, background: '#1f2937', width: '100%' }} />
    <div style={{ height: 24, borderRadius: 4, background: '#1f2937', width: '60%' }} />
  </div>
);

// ── Exports ───────────────────────────────────────────────────────────────────
export { ReplayTimeline };
export default ReplayTimeline;
