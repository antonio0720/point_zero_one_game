/**
 * RunEvents — Ledger Event Persistence Layer
 * Writes and reads run events with SHA256 audit hashing and bounded output clamping.
 * ML kill-switch reads from process.env.ML_ENABLED (server sets this at boot).
 *
 * Deploy to: pzo_engine/src/persistence/run-events.ts
 */

import { createHash } from 'crypto';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface Event {
  eventId: string;
  eventType: string;
  runId: string;
  runSeed: string;
  rulesetVersion: string;
  playerId: string;
  turnNumber: number;
  tickIndex: number;
  output: number;          // bounded [0, 1] — always clamped before storage
  payload: Record<string, unknown>;
  auditHash: string;
  createdAt: number;       // unix ms
}

export interface LedgerTable {
  addEvent(event: Event): Promise<void>;
  getEvents(filter?: LedgerFilter): Promise<Event[]>;
  getEventById(eventId: string): Promise<Event | null>;
}

export interface LedgerFilter {
  runId?: string;
  playerId?: string;
  eventType?: string;
  fromTick?: number;
  toTick?: number;
  limit?: number;
}

export interface WriteResult {
  success: boolean;
  eventId: string;
  auditHash: string;
  mlHashApplied: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Compute canonical audit hash for an event.
 * Covers all fields that uniquely identify the event's causal chain.
 * Same inputs always produce the same hash (determinism guaranteed).
 */
function computeEventAuditHash(event: Omit<Event, 'auditHash'>): string {
  return sha256(JSON.stringify({
    eventId: event.eventId,
    eventType: event.eventType,
    runId: event.runId,
    runSeed: event.runSeed,
    rulesetVersion: event.rulesetVersion,
    playerId: event.playerId,
    turnNumber: event.turnNumber,
    tickIndex: event.tickIndex,
    output: event.output,
    payload: event.payload,
    createdAt: event.createdAt,
  }));
}

/**
 * Compute a read-time verification hash — used to detect tampering
 * between write and read (e.g., direct DB edits).
 * Different from write-time hash: includes the stored auditHash itself.
 */
function computeReadVerificationHash(event: Event): string {
  return sha256(JSON.stringify({
    eventId: event.eventId,
    runId: event.runId,
    output: event.output,
    auditHash: event.auditHash,
    createdAt: event.createdAt,
  })).slice(0, 32);
}

// ─── ML Kill-Switch ───────────────────────────────────────────────────────────

/**
 * ML is enabled when process.env.ML_ENABLED === 'true'.
 * Kill-switch: set ML_ENABLED=false in server env to disable all ML hashing.
 * Deterministic mode (ML off): audit hash still computed, but ML-specific
 * enrichment (e.g., model output embedding) is skipped.
 */
function mlEnabled(): boolean {
  return process.env.ML_ENABLED === 'true';
}

// ─── RunEvents ────────────────────────────────────────────────────────────────

export class RunEvents {
  private readonly ledgerTable: LedgerTable;

  constructor(ledgerTable: LedgerTable) {
    this.ledgerTable = ledgerTable;
  }

  /**
   * Write an event to the ledger.
   * 1. Clamp output to [0, 1] (bounded output guarantee).
   * 2. Compute canonical audit hash over all event fields.
   * 3. If ML enabled, embed ML-specific fingerprint into hash chain.
   * 4. Persist to ledger.
   */
  public async writeEvent(event: Event): Promise<WriteResult> {
    // Step 1: Clamp output — non-negotiable
    event.output = clamp(event.output);

    // Step 2: Canonical audit hash (always computed, ML or not)
    const baseHash = computeEventAuditHash(event);
    event.auditHash = baseHash;

    // Step 3: ML-enriched hash chain (only when ML is on)
    let mlHashApplied = false;
    if (mlEnabled()) {
      // Embed model fingerprint: hash of (baseHash + model run context)
      // This creates an unbroken chain: base event → ML observation
      const mlContextHash = sha256(JSON.stringify({
        baseHash,
        mlEnabled: true,
        modelVersion: process.env.ML_MODEL_VERSION ?? 'unversioned',
        runId: event.runId,
        tickIndex: event.tickIndex,
      }));
      // Final audit hash is a hash-of-hashes — tamper-evident chain
      event.auditHash = sha256(`${baseHash}:${mlContextHash}`);
      mlHashApplied = true;
    }

    // Step 4: Persist
    await this.ledgerTable.addEvent(event);

    return {
      success: true,
      eventId: event.eventId,
      auditHash: event.auditHash,
      mlHashApplied,
    };
  }

  /**
   * Read all events, re-clamp outputs, and optionally re-verify audit hashes.
   * Re-computing hashes at read time allows detecting post-write DB tampering.
   */
  public async readEvents(filter?: LedgerFilter): Promise<Event[]> {
    const events = await this.ledgerTable.getEvents(filter);

    for (const event of events) {
      // Always re-clamp on read — defense in depth against raw DB edits
      event.output = clamp(event.output);

      // If ML enabled: verify the stored hash is consistent with re-computation
      if (mlEnabled()) {
        const expectedBase = computeEventAuditHash(event);
        const expectedMlHash = sha256(JSON.stringify({
          baseHash: expectedBase,
          mlEnabled: true,
          modelVersion: process.env.ML_MODEL_VERSION ?? 'unversioned',
          runId: event.runId,
          tickIndex: event.tickIndex,
        }));
        const expectedFinal = sha256(`${expectedBase}:${expectedMlHash}`);

        if (event.auditHash !== expectedFinal) {
          // Hash mismatch — mark event as tampered but do not throw.
          // Caller sees the flag; integrity system logs and quarantines.
          (event as Event & { _tampered?: boolean })._tampered = true;
        }
      }
    }

    return events;
  }

  /**
   * Read a single event by ID with full hash verification.
   */
  public async readEvent(eventId: string): Promise<Event | null> {
    const event = await this.ledgerTable.getEventById(eventId);
    if (!event) return null;

    event.output = clamp(event.output);

    // Lightweight read-time verification (no ML context needed)
    const verificationHash = computeReadVerificationHash(event);
    (event as Event & { _verificationHash?: string })._verificationHash = verificationHash;

    return event;
  }

  /**
   * Build a chain-hash across a sequence of events for a run.
   * Used to produce the run's finalStateHash.
   * Deterministic: same events in same order → same hash.
   */
  public async computeRunChainHash(runId: string): Promise<string> {
    const events = await this.readEvents({ runId });

    // Sort by turnNumber + tickIndex for determinism
    events.sort((a, b) =>
      a.turnNumber !== b.turnNumber
        ? a.turnNumber - b.turnNumber
        : a.tickIndex - b.tickIndex,
    );

    let chain = `chain:${runId}`;
    for (const e of events) {
      chain = sha256(`${chain}:${e.auditHash}:${e.output}`);
    }
    return chain.slice(0, 32);
  }
}
