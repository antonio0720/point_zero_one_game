// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — ENGINE PERSISTENCE LAYER
// pzo_engine/src/persistence/run-events.ts
//
// Ledger Event Persistence Layer
//
// UPDATED FROM SPRINT 0:
//   ✦ Event interface: +mode, +rulesetVersion, +isDemoRun, +tensionScore
//   ✦ LedgerFilter: +mode, +isDemoRun
//   ✦ Mode-specific event enrichment in ML context hash chain
//
// Writes and reads run events with SHA-256 audit hashing and bounded output
// clamping. ML kill-switch reads from process.env.ML_ENABLED.
//
// Density6 LLC · Point Zero One · Persistence Layer · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import { createHash } from 'node:crypto';
import { getDb }      from './db';
import type { GameMode } from './types';

// =============================================================================
// INTERFACES
// =============================================================================

export interface Event {
  eventId:        string;
  eventType:      string;
  runId:          string;
  runSeed:        string;
  rulesetVersion: string;
  mode:           GameMode;
  playerId:       string;
  turnNumber:     number;
  tickIndex:      number;
  output:         number;          // bounded [0, 1]
  tensionScore:   number;          // 0.0–1.0 at event time
  isDemoRun:      boolean;
  payload:        Record<string, unknown>;
  auditHash:      string;
  createdAt:      number;          // unix ms
}

export interface LedgerFilter {
  runId?:     string;
  playerId?:  string;
  eventType?: string;
  mode?:      GameMode;
  fromTick?:  number;
  toTick?:    number;
  isDemoRun?: boolean;
  limit?:     number;
}

export interface WriteResult {
  success:        boolean;
  eventId:        string;
  auditHash:      string;
  mlHashApplied:  boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

function computeEventAuditHash(event: Omit<Event, 'auditHash'>): string {
  return sha256(JSON.stringify({
    eventId:        event.eventId,
    eventType:      event.eventType,
    runId:          event.runId,
    runSeed:        event.runSeed,
    rulesetVersion: event.rulesetVersion,
    mode:           event.mode,
    playerId:       event.playerId,
    turnNumber:     event.turnNumber,
    tickIndex:      event.tickIndex,
    output:         event.output,
    tensionScore:   event.tensionScore,
    isDemoRun:      event.isDemoRun,
    payload:        event.payload,
    createdAt:      event.createdAt,
  }));
}

function computeReadVerificationHash(event: Event): string {
  return sha256(JSON.stringify({
    eventId:   event.eventId,
    runId:     event.runId,
    output:    event.output,
    auditHash: event.auditHash,
    createdAt: event.createdAt,
    mode:      event.mode,
  })).slice(0, 32);
}

function mlEnabled(): boolean {
  return process.env['ML_ENABLED'] === 'true';
}

// =============================================================================
// RUN EVENTS CLASS
// =============================================================================

export class RunEvents {

  // ── Write ─────────────────────────────────────────────────────────────────

  public async writeEvent(event: Event): Promise<WriteResult> {
    event.output = clamp(event.output);

    const baseHash = computeEventAuditHash(event);
    event.auditHash = baseHash;

    let mlHashApplied = false;

    if (mlEnabled()) {
      const mlContextHash = sha256(JSON.stringify({
        baseHash,
        mlEnabled:    true,
        modelVersion: process.env['ML_MODEL_VERSION'] ?? 'unversioned',
        runId:        event.runId,
        tickIndex:    event.tickIndex,
        mode:         event.mode,
        isDemoRun:    event.isDemoRun,
      }));
      event.auditHash = sha256(`${baseHash}:${mlContextHash}`);
      mlHashApplied = true;
    }

    // Persist to SQLite
    const db = getDb();
    db.prepare(`
      INSERT OR REPLACE INTO run_events (
        event_id, event_type, run_id, run_seed, ruleset_version,
        player_id, turn_number, tick_index, output, payload_json,
        audit_hash, created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      event.eventId, event.eventType, event.runId, event.runSeed, event.rulesetVersion,
      event.playerId, event.turnNumber, event.tickIndex, event.output,
      JSON.stringify(event.payload), event.auditHash, event.createdAt,
    );

    return {
      success:       true,
      eventId:       event.eventId,
      auditHash:     event.auditHash,
      mlHashApplied,
    };
  }

  // ── Read (all) ────────────────────────────────────────────────────────────

  public async readEvents(filter?: LedgerFilter): Promise<Event[]> {
    const db = getDb();

    const conditions: string[] = [];
    const bindings:   unknown[] = [];

    if (filter?.runId)     { conditions.push('run_id = ?');     bindings.push(filter.runId); }
    if (filter?.playerId)  { conditions.push('player_id = ?');  bindings.push(filter.playerId); }
    if (filter?.eventType) { conditions.push('event_type = ?'); bindings.push(filter.eventType); }
    if (filter?.fromTick != null) { conditions.push('tick_index >= ?'); bindings.push(filter.fromTick); }
    if (filter?.toTick   != null) { conditions.push('tick_index <= ?'); bindings.push(filter.toTick); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filter?.limit ? `LIMIT ${filter.limit}` : '';

    const rows = db.prepare(`
      SELECT * FROM run_events ${where} ORDER BY turn_number, tick_index ${limit}
    `).all(...bindings) as Record<string, unknown>[];

    const events: Event[] = rows.map(r => ({
      eventId:        r['event_id'] as string,
      eventType:      r['event_type'] as string,
      runId:          r['run_id'] as string,
      runSeed:        r['run_seed'] as string,
      rulesetVersion: r['ruleset_version'] as string,
      mode:           'GO_ALONE' as GameMode,    // DB didn't have mode column before M008
      playerId:       r['player_id'] as string,
      turnNumber:     r['turn_number'] as number,
      tickIndex:      r['tick_index'] as number,
      output:         clamp(r['output'] as number),
      tensionScore:   0,
      isDemoRun:      false,
      payload:        JSON.parse(r['payload_json'] as string ?? '{}'),
      auditHash:      r['audit_hash'] as string,
      createdAt:      r['created_at'] as number,
    }));

    if (mlEnabled()) {
      for (const event of events) {
        const expectedBase = computeEventAuditHash(event);
        const expectedMlHash = sha256(JSON.stringify({
          baseHash:     expectedBase,
          mlEnabled:    true,
          modelVersion: process.env['ML_MODEL_VERSION'] ?? 'unversioned',
          runId:        event.runId,
          tickIndex:    event.tickIndex,
          mode:         event.mode,
          isDemoRun:    event.isDemoRun,
        }));
        const expectedFinal = sha256(`${expectedBase}:${expectedMlHash}`);
        if (event.auditHash !== expectedFinal) {
          (event as Event & { _tampered?: boolean })._tampered = true;
        }
      }
    }

    return events;
  }

  // ── Read (single) ─────────────────────────────────────────────────────────

  public async readEvent(eventId: string): Promise<Event | null> {
    const row = getDb()
      .prepare('SELECT * FROM run_events WHERE event_id = ?')
      .get(eventId) as Record<string, unknown> | undefined;

    if (!row) return null;

    const event: Event = {
      eventId:        row['event_id'] as string,
      eventType:      row['event_type'] as string,
      runId:          row['run_id'] as string,
      runSeed:        row['run_seed'] as string,
      rulesetVersion: row['ruleset_version'] as string,
      mode:           'GO_ALONE' as GameMode,
      playerId:       row['player_id'] as string,
      turnNumber:     row['turn_number'] as number,
      tickIndex:      row['tick_index'] as number,
      output:         clamp(row['output'] as number),
      tensionScore:   0,
      isDemoRun:      false,
      payload:        JSON.parse(row['payload_json'] as string ?? '{}'),
      auditHash:      row['audit_hash'] as string,
      createdAt:      row['created_at'] as number,
    };

    const verificationHash = computeReadVerificationHash(event);
    (event as Event & { _verificationHash?: string })._verificationHash = verificationHash;

    return event;
  }

  // ── Chain hash ────────────────────────────────────────────────────────────

  public async computeRunChainHash(runId: string): Promise<string> {
    const events = await this.readEvents({ runId });

    events.sort((a, b) =>
      a.turnNumber !== b.turnNumber
        ? a.turnNumber - b.turnNumber
        : a.tickIndex - b.tickIndex
    );

    let chain = `chain:${runId}`;
    for (const e of events) {
      chain = sha256(`${chain}:${e.auditHash}:${e.output}`);
    }
    return chain.slice(0, 32);
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let _runEvents: RunEvents | null = null;

export function getRunEvents(): RunEvents {
  if (!_runEvents) _runEvents = new RunEvents();
  return _runEvents;
}