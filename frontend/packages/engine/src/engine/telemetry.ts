/**
 * telemetry.ts — PZO Frontend Telemetry Instrumentation
 * PZO_FE_T0171 — Correlation ID tracking, event emission, performance hooks.
 *
 * Design: Zero external deps. Batched flush every 5s or 50 events.
 * All events are fire-and-forget. Never blocks the game loop.
 *
 * FIXES:
 *  - perfEnd now emits 'perf.mark' instead of 'ui.error'
 *  - useTelemetrySession uses a tickRef to avoid stale closure in cleanup
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type TelemetryEventKind =
  | 'session.start'
  | 'session.end'
  | 'run.start'
  | 'run.end'
  | 'card.played'
  | 'card.expired'
  | 'fate.triggered'
  | 'sabotage.received'
  | 'counterplay.chosen'
  | 'alliance.aid_sent'
  | 'battle.started'
  | 'battle.ended'
  | 'milestone.crossed'
  | 'bankruptcy.triggered'
  | 'policy.denied'
  | 'perf.mark'   // ← FIXED: was incorrectly 'ui.error' in original
  | 'ui.error';

export interface TelemetryEvent {
  kind: TelemetryEventKind;
  correlationId: string;
  sessionId: string;
  tick: number;
  ts: number;
  payload?: Record<string, unknown>;
}

// ─── State ────────────────────────────────────────────────────────────────────

let _sessionId: string = '';
let _correlationId: string = '';
let _queue: TelemetryEvent[] = [];
let _flushTimer: ReturnType<typeof setTimeout> | null = null;
let _endpoint: string = '';
let _enabled = false;

const BATCH_SIZE = 50;
const FLUSH_MS   = 5000;

// ─── Core ─────────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function initTelemetry(opts: { endpoint: string; enabled?: boolean }): void {
  _endpoint      = opts.endpoint;
  _enabled       = opts.enabled ?? true;
  _sessionId     = generateId();
  _correlationId = generateId();

  if (_enabled) scheduleFlush();
}

export function getSessionId(): string    { return _sessionId; }
export function getCorrelationId(): string { return _correlationId; }

/** Rotate correlation ID at run boundaries */
export function rotateCorrelationId(): string {
  _correlationId = generateId();
  return _correlationId;
}

export function emit(
  kind: TelemetryEventKind,
  tick: number,
  payload?: Record<string, unknown>,
): void {
  if (!_enabled) return;

  _queue.push({
    kind,
    correlationId: _correlationId,
    sessionId:     _sessionId,
    tick,
    ts: Date.now(),
    payload,
  });

  if (_queue.length >= BATCH_SIZE) flush();
}

export function flush(): void {
  if (_queue.length === 0 || !_endpoint) return;

  const batch = _queue.splice(0, _queue.length);

  // Fire-and-forget — never await in game loop
  try {
    navigator.sendBeacon(
      _endpoint,
      JSON.stringify({ events: batch }),
    );
  } catch {
    // Fallback to fetch (no await — intentional)
    fetch(_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    }).catch(() => {}); // swallow — telemetry must never throw
  }
}

function scheduleFlush(): void {
  if (_flushTimer) clearTimeout(_flushTimer);
  _flushTimer = setTimeout(() => {
    flush();
    if (_enabled) scheduleFlush();
  }, FLUSH_MS);
}

export function destroyTelemetry(): void {
  if (_flushTimer) clearTimeout(_flushTimer);
  flush();
  _enabled       = false;
  _queue         = [];
  _sessionId     = '';
  _correlationId = '';
}

// ─── Performance hooks ────────────────────────────────────────────────────────

export interface PerfMark {
  name: string;
  start: number;
}

export function perfStart(name: string): PerfMark {
  return { name, start: performance.now() };
}

/**
 * FIXED: was emitting 'ui.error' — now correctly emits 'perf.mark'
 * Original had: emit('ui.error', tick, { perfMark: mark.name, durationMs: duration })
 */
export function perfEnd(mark: PerfMark, tick: number): void {
  const duration = performance.now() - mark.start;
  emit('perf.mark', tick, { perfMark: mark.name, durationMs: duration });
}

// ─── React hook ───────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react';

/**
 * FIXED: original captured `tick` via closure in cleanup — stale on unmount.
 * Now uses tickRef to always read the current tick at cleanup time.
 */
export function useTelemetrySession(tick: number): void {
  const emitted = useRef(false);
  const tickRef = useRef(tick);

  // Keep ref current on every render
  tickRef.current = tick;

  useEffect(() => {
    if (!emitted.current) {
      emit('session.start', tickRef.current, { userAgent: navigator.userAgent });
      emitted.current = true;
    }
    return () => {
      // Use ref — not the closed-over `tick` which would be stale
      emit('session.end', tickRef.current);
      flush();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
