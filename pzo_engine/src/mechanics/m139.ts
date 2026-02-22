/**
 * M139 — Offline Queue Runs (Play Now, Verify Later)
 * Source spec: mechanics/M139_offline_queue_runs_play_now_verify_later.md
 *
 * Limited offline mode: actions recorded locally with cryptographic signatures;
 * uploaded on reconnect. Offline runs are PENDING until server validates.
 * Prevents dead time without sacrificing ledger integrity or competitive rank.
 *
 * Deploy to: pzo_engine/src/mechanics/m139.ts
 */

import { createHash, createHmac } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type QueueRunStatus =
  | 'PENDING'        // locally recorded, not yet uploaded
  | 'UPLOADING'      // in-flight to server
  | 'VALIDATING'     // server is replaying the run
  | 'VALIDATED'      // server confirmed deterministic replay matches
  | 'REJECTED'       // replay mismatch or integrity failure
  | 'EXPIRED';       // offline run exceeded TTL without upload

export type QueuedActionType =
  | 'PURCHASE'
  | 'PASS'
  | 'SELL'
  | 'EXECUTE_EVENT'
  | 'FORCED_ACTION';

export interface QueuedAction {
  actionId: string;
  turnNumber: number;
  tickIndex: number;
  actionType: QueuedActionType;
  cardId: string | null;
  payload: Record<string, unknown>;
  clientTimestamp: number;       // unix ms; not trusted by server, used for ordering
  signature: string;             // HMAC-SHA256(runSeed + actionId + payload)
}

export interface QueueRun {
  runId: string;
  runSeed: string;
  rulesetVersion: string;
  playerDeviceId: string;
  actions: QueuedAction[];
  startedAt: number;             // unix ms
  endedAt: number | null;
  status: QueueRunStatus;
  finalStateHash: string;        // SHA256 of terminal player state
  uploadAttempts: number;
  lastUploadAttemptAt: number | null;
  validationReceiptHash: string | null; // set by server on VALIDATED
  rejectionReason: string | null;
}

export interface M139Config {
  mlEnabled: boolean;
  queueRuns: QueueRun[];
  maxOfflineTtlMs: number;       // default 72h; runs older than this are EXPIRED
  maxActionsPerRun: number;      // cap to prevent abuse; default 500
  hmacSecret: string;            // shared secret for action signing
}

export interface M139ValidationResult {
  runId: string;
  status: QueueRunStatus;
  validatedActions: number;
  rejectedActions: string[];     // actionIds that failed signature check
  replayStateHash: string;       // server-computed; must match finalStateHash
  receiptHash: string;
  ledgerEvent: M139LedgerEvent;
}

export interface M139LedgerEvent {
  rule: 'M139';
  rule_version: '1.0';
  eventType:
    | 'RUN_QUEUED'
    | 'RUN_UPLOADED'
    | 'RUN_VALIDATED'
    | 'RUN_REJECTED'
    | 'RUN_EXPIRED'
    | 'ACTION_SIGNATURE_FAILED';
  runId: string;
  runSeed: string;
  status: QueueRunStatus;
  actionCount: number;
  auditHash: string;
}

export interface M139State {
  runs: Map<string, QueueRun>;
  auditHash: string;
  totalQueued: number;
  totalValidated: number;
  totalRejected: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const DEFAULT_MAX_OFFLINE_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours
export const DEFAULT_MAX_ACTIONS_PER_RUN = 500;
export const MAX_UPLOAD_ATTEMPTS = 5;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function hmacSign(secret: string, data: string): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

function buildAuditHash(runId: string, status: QueueRunStatus, actionCount: number, rulesetVersion: string): string {
  return sha256(JSON.stringify({ runId, status, actionCount, rulesetVersion, rule: 'M139' })).slice(0, 32);
}

function buildLedgerEvent(
  eventType: M139LedgerEvent['eventType'],
  run: QueueRun,
): M139LedgerEvent {
  return {
    rule: 'M139',
    rule_version: '1.0',
    eventType,
    runId: run.runId,
    runSeed: run.runSeed,
    status: run.status,
    actionCount: run.actions.length,
    auditHash: buildAuditHash(run.runId, run.status, run.actions.length, run.rulesetVersion),
  };
}

// ─── Action Signing ───────────────────────────────────────────────────────────

/**
 * Sign a queued action with HMAC-SHA256.
 * Client calls this before recording each offline action.
 */
export function signAction(
  action: Omit<QueuedAction, 'signature'>,
  runSeed: string,
  hmacSecret: string,
): string {
  const data = JSON.stringify({
    runSeed,
    actionId: action.actionId,
    turnNumber: action.turnNumber,
    tickIndex: action.tickIndex,
    actionType: action.actionType,
    cardId: action.cardId,
    payload: action.payload,
  });
  return hmacSign(hmacSecret, data);
}

/**
 * Verify an action signature server-side.
 */
export function verifyActionSignature(
  action: QueuedAction,
  runSeed: string,
  hmacSecret: string,
): boolean {
  const expected = signAction(
    {
      actionId: action.actionId,
      turnNumber: action.turnNumber,
      tickIndex: action.tickIndex,
      actionType: action.actionType,
      cardId: action.cardId,
      payload: action.payload,
      clientTimestamp: action.clientTimestamp,
    },
    runSeed,
    hmacSecret,
  );
  return expected === action.signature;
}

// ─── Run Lifecycle ────────────────────────────────────────────────────────────

export function createQueueRun(
  runId: string,
  runSeed: string,
  rulesetVersion: string,
  playerDeviceId: string,
): QueueRun {
  return {
    runId,
    runSeed,
    rulesetVersion,
    playerDeviceId,
    actions: [],
    startedAt: Date.now(),
    endedAt: null,
    status: 'PENDING',
    finalStateHash: '',
    uploadAttempts: 0,
    lastUploadAttemptAt: null,
    validationReceiptHash: null,
    rejectionReason: null,
  };
}

export function appendAction(
  run: QueueRun,
  action: QueuedAction,
  maxActionsPerRun: number,
): { success: boolean; reason?: string } {
  if (run.status !== 'PENDING') {
    return { success: false, reason: `Run is ${run.status}, cannot append actions` };
  }
  if (run.actions.length >= maxActionsPerRun) {
    return { success: false, reason: `Max actions per run (${maxActionsPerRun}) reached` };
  }
  run.actions.push(action);
  return { success: true };
}

export function finalizeQueueRun(run: QueueRun, terminalStateHash: string): void {
  run.endedAt = Date.now();
  run.finalStateHash = terminalStateHash;
}

export function markExpired(run: QueueRun, maxTtlMs: number): boolean {
  const age = Date.now() - run.startedAt;
  if (age > maxTtlMs && run.status === 'PENDING') {
    run.status = 'EXPIRED';
    run.rejectionReason = `TTL exceeded (${Math.round(age / 3600000)}h old; max ${Math.round(maxTtlMs / 3600000)}h)`;
    return true;
  }
  return false;
}

// ─── Server-Side Validation ───────────────────────────────────────────────────

/**
 * Server validates all signatures and replays the run deterministically.
 * replayFn must be the same deterministic engine used in live runs.
 * Returns VALIDATED if replayStateHash === run.finalStateHash.
 */
export function validateQueueRun(
  run: QueueRun,
  hmacSecret: string,
  replayFn: (runSeed: string, rulesetVersion: string, actions: QueuedAction[]) => string,
): M139ValidationResult {
  run.status = 'VALIDATING';
  run.uploadAttempts += 1;
  run.lastUploadAttemptAt = Date.now();

  // Step 1: Verify all action signatures
  const rejectedActions: string[] = [];
  for (const action of run.actions) {
    if (!verifyActionSignature(action, run.runSeed, hmacSecret)) {
      rejectedActions.push(action.actionId);
    }
  }

  if (rejectedActions.length > 0) {
    run.status = 'REJECTED';
    run.rejectionReason = `${rejectedActions.length} action signature(s) failed`;
    const receiptHash = sha256(`rejected:${run.runId}:${rejectedActions.join(',')}`).slice(0, 32);
    return {
      runId: run.runId,
      status: 'REJECTED',
      validatedActions: run.actions.length - rejectedActions.length,
      rejectedActions,
      replayStateHash: '',
      receiptHash,
      ledgerEvent: buildLedgerEvent('ACTION_SIGNATURE_FAILED', run),
    };
  }

  // Step 2: Deterministic replay
  const replayStateHash = replayFn(run.runSeed, run.rulesetVersion, run.actions);

  // Step 3: Compare replay result to client-reported final state
  if (replayStateHash !== run.finalStateHash) {
    run.status = 'REJECTED';
    run.rejectionReason = `Replay state mismatch: expected ${run.finalStateHash}, got ${replayStateHash}`;
    const receiptHash = sha256(`mismatch:${run.runId}:${replayStateHash}`).slice(0, 32);
    return {
      runId: run.runId,
      status: 'REJECTED',
      validatedActions: run.actions.length,
      rejectedActions: [],
      replayStateHash,
      receiptHash,
      ledgerEvent: buildLedgerEvent('RUN_REJECTED', run),
    };
  }

  // Step 4: Validated
  const receiptHash = sha256(JSON.stringify({
    runId: run.runId,
    runSeed: run.runSeed,
    finalStateHash: run.finalStateHash,
    actionCount: run.actions.length,
    rulesetVersion: run.rulesetVersion,
  })).slice(0, 32);

  run.status = 'VALIDATED';
  run.validationReceiptHash = receiptHash;

  return {
    runId: run.runId,
    status: 'VALIDATED',
    validatedActions: run.actions.length,
    rejectedActions: [],
    replayStateHash,
    receiptHash,
    ledgerEvent: buildLedgerEvent('RUN_VALIDATED', run),
  };
}

// ─── M139 Engine ──────────────────────────────────────────────────────────────

export class M139Engine {
  private readonly config: M139Config;
  private readonly state: M139State;

  constructor(config: M139Config) {
    this.config = config;
    this.state = {
      runs: new Map(),
      auditHash: sha256('M139:init').slice(0, 32),
      totalQueued: 0,
      totalValidated: 0,
      totalRejected: 0,
    };

    // Load initial queue runs from config
    for (const run of config.queueRuns) {
      this.state.runs.set(run.runId, run);
      this.state.totalQueued += 1;
    }
  }

  /**
   * Process all PENDING runs: expire old ones, validate uploadable ones.
   * replayFn injected externally to preserve engine separation.
   */
  public processQueue(
    replayFn: (runSeed: string, rulesetVersion: string, actions: QueuedAction[]) => string,
  ): M139LedgerEvent[] {
    if (!this.config.mlEnabled) {
      // Still process queue in deterministic mode; ML features just disabled
    }

    const events: M139LedgerEvent[] = [];

    for (const run of this.state.runs.values()) {
      if (run.status !== 'PENDING' && run.status !== 'UPLOADING') continue;

      // Check TTL
      if (markExpired(run, this.config.maxOfflineTtlMs ?? DEFAULT_MAX_OFFLINE_TTL_MS)) {
        events.push(buildLedgerEvent('RUN_EXPIRED', run));
        this.state.totalRejected += 1;
        continue;
      }

      // Skip if upload attempts exhausted
      if (run.uploadAttempts >= MAX_UPLOAD_ATTEMPTS) {
        run.status = 'REJECTED';
        run.rejectionReason = 'Max upload attempts exceeded';
        events.push(buildLedgerEvent('RUN_REJECTED', run));
        this.state.totalRejected += 1;
        continue;
      }

      // Validate
      const result = validateQueueRun(run, this.config.hmacSecret, replayFn);
      events.push(result.ledgerEvent);

      if (result.status === 'VALIDATED') {
        this.state.totalValidated += 1;
      } else {
        this.state.totalRejected += 1;
      }
    }

    this.state.auditHash = this.computeStateHash();
    return events;
  }

  public enqueueRun(run: QueueRun): M139LedgerEvent {
    this.state.runs.set(run.runId, run);
    this.state.totalQueued += 1;
    this.state.auditHash = this.computeStateHash();
    return buildLedgerEvent('RUN_QUEUED', run);
  }

  public getAuditHash(): string {
    return this.state.auditHash;
  }

  public getStats(): { queued: number; validated: number; rejected: number; pending: number } {
    let pending = 0;
    for (const run of this.state.runs.values()) {
      if (run.status === 'PENDING') pending += 1;
    }
    return {
      queued: this.state.totalQueued,
      validated: this.state.totalValidated,
      rejected: this.state.totalRejected,
      pending,
    };
  }

  private computeStateHash(): string {
    return sha256(JSON.stringify({
      totalQueued: this.state.totalQueued,
      totalValidated: this.state.totalValidated,
      totalRejected: this.state.totalRejected,
      runIds: [...this.state.runs.keys()].sort(),
    })).slice(0, 32);
  }
}
