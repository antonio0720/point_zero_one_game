/**
 * M137 — Mid-Run Hotfix Lock (No Surprise Changes Inside A Run)
 * Source spec: mechanics/M137_mid_run_hotfix_lock_no_surprise_changes_inside_a_run.md
 *
 * Once a run begins, its ruleset is frozen until finality.
 * Hotfixes apply only to NEW runs.
 * Emergency disables route to quarantine rules transparently.
 * Preserves trust and replay determinism.
 *
 * Deploy to: pzo_engine/src/mechanics/m137.ts
 */

import { createHash } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type HotfixStatus = 'PENDING' | 'QUEUED' | 'APPLIED' | 'REJECTED' | 'EMERGENCY_QUARANTINE';

export type HotfixScope =
  | 'RULE_BALANCE'         // gameplay balance tweak (applies to new runs only)
  | 'BUG_FIX'             // deterministic bug correction
  | 'EMERGENCY_DISABLE'   // kill a broken feature; active runs quarantined
  | 'ECONOMY_PATCH'       // trophy/sink adjustment
  | 'EXPLOIT_RESPONSE';   // anti-cheat counter-measure

export type HotfixTarget =
  | 'DECK_WEIGHTS'
  | 'SO_MODULE_PARAMS'
  | 'CLOCK_CONSTANTS'
  | 'WIPE_THRESHOLDS'
  | 'ML_CAPS'
  | 'CARD_ECON'
  | 'FRICTION_PARAMS'
  | 'CONTRACT_RULES';

export interface Hotfix {
  hotfixId: string;
  scope: HotfixScope;
  target: HotfixTarget;
  description: string;            // human-readable; shown to players in ruleset diff
  rulesetVersionBefore: string;
  rulesetVersionAfter: string;
  patchPayload: Record<string, unknown>; // the actual changes
  authorId: string;               // system or admin ID
  createdAt: number;              // unix ms
  effectiveAfterRunId: string | null; // null = apply to all new runs
  status: HotfixStatus;
  signatureHash: string;          // SHA256 of (hotfixId + payload + versions)
}

export interface RunRulesetLock {
  runId: string;
  runSeed: string;
  rulesetVersion: string;         // frozen at run start
  lockedAt: number;               // unix ms
  hotfixesApplied: string[];      // hotfixIds baked in before lock
  isLocked: boolean;
  lockHash: string;               // SHA256 of (runId + rulesetVersion + hotfixIds)
}

export interface HotfixApplication {
  hotfixId: string;
  targetRunIds: 'NEW_RUNS_ONLY' | string[]; // which runs get this
  appliedAt: number;
  newRulesetVersion: string;
  quarantinedRunIds: string[];     // active runs forced into quarantine (emergency only)
  ledgerEvent: HotfixLedgerEvent;
}

export interface GameState {
  runId: string;
  runSeed: string;
  tick: number;
  rulesetVersion: string;
  playerId: string;
  phase: 'ACTIVE' | 'FINALIZED' | 'QUARANTINED';
  cashFlow: number;
  netWorth: number;
  turnNumber: number;
}

export interface SurpriseChange {
  changeType: string;
  affectedRunIds: string[];
  detectedAt: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export type Outcome = 'SUCCESS' | 'FAILURE' | 'QUARANTINE' | 'HOTFIX_BLOCKED';

export interface HotfixRunResult {
  outcome: Outcome;
  appliedHotfixIds: string[];
  surpriseChangesDetected: SurpriseChange[];
  runWasModified: boolean;         // always false for active runs (lock enforced)
  auditHash: string;
}

export interface HotfixLedgerEvent {
  rule: 'M137';
  rule_version: '1.0';
  eventType:
    | 'HOTFIX_QUEUED'
    | 'HOTFIX_APPLIED_NEW_RUNS'
    | 'HOTFIX_REJECTED_ACTIVE_RUN'
    | 'EMERGENCY_QUARANTINE'
    | 'SURPRISE_CHANGE_BLOCKED'
    | 'LOCK_CREATED'
    | 'LOCK_VERIFIED';
  hotfixId: string | null;
  runId: string | null;
  rulesetVersionBefore: string;
  rulesetVersionAfter: string;
  tick: number;
  payload: Record<string, unknown>;
  auditHash: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function signatureHash(hotfix: Pick<Hotfix, 'hotfixId' | 'patchPayload' | 'rulesetVersionBefore' | 'rulesetVersionAfter'>): string {
  return sha256(JSON.stringify({
    hotfixId: hotfix.hotfixId,
    payload: hotfix.patchPayload,
    before: hotfix.rulesetVersionBefore,
    after: hotfix.rulesetVersionAfter,
  })).slice(0, 32);
}

function buildAuditHash(
  eventType: HotfixLedgerEvent['eventType'],
  hotfixId: string | null,
  runId: string | null,
  tick: number,
  payload: unknown,
): string {
  return sha256(JSON.stringify({ eventType, hotfixId, runId, tick, payload })).slice(0, 32);
}

function buildLedgerEvent(
  eventType: HotfixLedgerEvent['eventType'],
  hotfixId: string | null,
  runId: string | null,
  rulesetVersionBefore: string,
  rulesetVersionAfter: string,
  tick: number,
  payload: Record<string, unknown>,
): HotfixLedgerEvent {
  const auditHash = buildAuditHash(eventType, hotfixId, runId, tick, payload);
  return {
    rule: 'M137',
    rule_version: '1.0',
    eventType,
    hotfixId,
    runId,
    rulesetVersionBefore,
    rulesetVersionAfter,
    tick,
    payload,
    auditHash,
  };
}

// ─── Ruleset Lock ──────────────────────────────────────────────────────────────

/**
 * Freeze the ruleset for a run at start time.
 * All hotfixes that arrived before this moment are baked in.
 * Any hotfix after this point is blocked for this run.
 */
export function createRulesetLock(
  runId: string,
  runSeed: string,
  rulesetVersion: string,
  hotfixesApplied: string[],
  lockedAt: number,
  tick: number,
): { lock: RunRulesetLock; event: HotfixLedgerEvent } {
  const lockHash = sha256(JSON.stringify({ runId, rulesetVersion, hotfixesApplied: hotfixesApplied.sort() })).slice(0, 32);

  const lock: RunRulesetLock = {
    runId,
    runSeed,
    rulesetVersion,
    lockedAt,
    hotfixesApplied,
    isLocked: true,
    lockHash,
  };

  const event = buildLedgerEvent(
    'LOCK_CREATED',
    null,
    runId,
    rulesetVersion,
    rulesetVersion,
    tick,
    { lockHash, hotfixCount: hotfixesApplied.length, runSeed },
  );

  return { lock, event };
}

/**
 * Verify the lock hasn't been tampered with.
 * Returns true if lockHash is consistent with stored fields.
 */
export function verifyRulesetLock(lock: RunRulesetLock): { valid: boolean; event: HotfixLedgerEvent } {
  const expected = sha256(JSON.stringify({
    runId: lock.runId,
    rulesetVersion: lock.rulesetVersion,
    hotfixesApplied: lock.hotfixesApplied.sort(),
  })).slice(0, 32);

  const valid = expected === lock.lockHash;

  const event = buildLedgerEvent(
    'LOCK_VERIFIED',
    null,
    lock.runId,
    lock.rulesetVersion,
    lock.rulesetVersion,
    0,
    { valid, lockHash: lock.lockHash, expectedHash: expected },
  );

  return { valid, event };
}

// ─── Hotfix Lifecycle ─────────────────────────────────────────────────────────

/**
 * Create and sign a new hotfix. Does not apply it — only queues it.
 * Signature hash allows players to verify the hotfix is unmodified.
 */
export function createHotfix(
  hotfixId: string,
  scope: HotfixScope,
  target: HotfixTarget,
  description: string,
  rulesetVersionBefore: string,
  rulesetVersionAfter: string,
  patchPayload: Record<string, unknown>,
  authorId: string,
  createdAt: number,
): Hotfix {
  const draft = { hotfixId, patchPayload, rulesetVersionBefore, rulesetVersionAfter };
  return {
    hotfixId,
    scope,
    target,
    description,
    rulesetVersionBefore,
    rulesetVersionAfter,
    patchPayload,
    authorId,
    createdAt,
    effectiveAfterRunId: null,
    status: 'PENDING',
    signatureHash: signatureHash(draft),
  };
}

/**
 * Attempt to apply a hotfix to an active run.
 *
 * Rules:
 *  - RULE_BALANCE / BUG_FIX / ECONOMY_PATCH / EXPLOIT_RESPONSE → REJECTED for active runs.
 *    Queued; applies to new runs only.
 *  - EMERGENCY_DISABLE → run is quarantined, not modified in-place.
 *    Active run finishes in quarantine mode; results flagged for review.
 *  - SurpriseChanges (undeclared mid-run changes) → always blocked + logged.
 */
export function applyHotfixToRun(
  hotfix: Hotfix,
  runLock: RunRulesetLock,
  activeGameState: GameState,
  surpriseChanges: SurpriseChange[],
  tick: number,
): HotfixRunResult {
  const appliedHotfixIds: string[] = [];
  const events: HotfixLedgerEvent[] = [];
  let outcome: Outcome = 'SUCCESS';
  let quarantine = false;

  // ── Surprise change detection ─────────────────────────────────────────────
  if (surpriseChanges.length > 0) {
    const criticalChanges = surpriseChanges.filter(c => c.severity === 'CRITICAL' || c.severity === 'HIGH');
    for (const change of criticalChanges) {
      events.push(buildLedgerEvent(
        'SURPRISE_CHANGE_BLOCKED',
        hotfix.hotfixId,
        runLock.runId,
        runLock.rulesetVersion,
        hotfix.rulesetVersionAfter,
        tick,
        { changeType: change.changeType, severity: change.severity },
      ));
    }
    if (criticalChanges.length > 0) {
      return {
        outcome: 'HOTFIX_BLOCKED',
        appliedHotfixIds: [],
        surpriseChangesDetected: surpriseChanges,
        runWasModified: false,
        auditHash: buildAuditHash('SURPRISE_CHANGE_BLOCKED', hotfix.hotfixId, runLock.runId, tick, surpriseChanges),
      };
    }
  }

  // ── Emergency disable → quarantine ───────────────────────────────────────
  if (hotfix.scope === 'EMERGENCY_DISABLE') {
    quarantine = true;
    outcome = 'QUARANTINE';
    events.push(buildLedgerEvent(
      'EMERGENCY_QUARANTINE',
      hotfix.hotfixId,
      runLock.runId,
      runLock.rulesetVersion,
      hotfix.rulesetVersionAfter,
      tick,
      {
        reason: hotfix.description,
        target: hotfix.target,
        runSeed: runLock.runSeed,
      },
    ));
  } else {
    // All other hotfix types: BLOCKED for this run (applies to new runs only)
    outcome = 'FAILURE';
    events.push(buildLedgerEvent(
      'HOTFIX_REJECTED_ACTIVE_RUN',
      hotfix.hotfixId,
      runLock.runId,
      runLock.rulesetVersion,
      hotfix.rulesetVersionAfter,
      tick,
      {
        reason: 'RUN_IS_LOCKED',
        scope: hotfix.scope,
        lockHash: runLock.lockHash,
        willApplyToNewRuns: true,
      },
    ));
  }

  const auditHash = buildAuditHash(
    quarantine ? 'EMERGENCY_QUARANTINE' : 'HOTFIX_REJECTED_ACTIVE_RUN',
    hotfix.hotfixId,
    runLock.runId,
    tick,
    { outcome, surpriseChanges },
  );

  return {
    outcome,
    appliedHotfixIds,
    surpriseChangesDetected: surpriseChanges,
    runWasModified: false, // NEVER true; lock enforced
    auditHash,
  };
}

/**
 * Apply hotfix to the global ruleset for NEW runs.
 * Returns the application record — server queues this for distribution.
 */
export function applyHotfixToNewRuns(
  hotfix: Hotfix,
  activeRunIds: string[],
  tick: number,
): HotfixApplication {
  const quarantinedRunIds = hotfix.scope === 'EMERGENCY_DISABLE' ? activeRunIds : [];

  const ledgerEvent = buildLedgerEvent(
    'HOTFIX_APPLIED_NEW_RUNS',
    hotfix.hotfixId,
    null,
    hotfix.rulesetVersionBefore,
    hotfix.rulesetVersionAfter,
    tick,
    {
      scope: hotfix.scope,
      target: hotfix.target,
      description: hotfix.description,
      quarantinedRunCount: quarantinedRunIds.length,
      signatureHash: hotfix.signatureHash,
    },
  );

  return {
    hotfixId: hotfix.hotfixId,
    targetRunIds: 'NEW_RUNS_ONLY',
    appliedAt: Date.now(),
    newRulesetVersion: hotfix.rulesetVersionAfter,
    quarantinedRunIds,
    ledgerEvent,
  };
}

/**
 * Full M137 run — validates the game state against hotfix and surprise changes.
 * Called by the run-orchestrator before each turn to confirm nothing has shifted.
 */
export function runHotfixLockCheck(
  gameState: GameState,
  hotfixes: Hotfix[],
  surpriseChanges: SurpriseChange[],
  runLock: RunRulesetLock,
  tick: number,
): HotfixRunResult {
  // Verify lock integrity first
  const { valid } = verifyRulesetLock(runLock);
  if (!valid) {
    const auditHash = buildAuditHash('SURPRISE_CHANGE_BLOCKED', null, gameState.runId, tick, { reason: 'LOCK_TAMPERED' });
    return {
      outcome: 'HOTFIX_BLOCKED',
      appliedHotfixIds: [],
      surpriseChangesDetected: [{
        changeType: 'LOCK_HASH_MISMATCH',
        affectedRunIds: [gameState.runId],
        detectedAt: Date.now(),
        severity: 'CRITICAL',
      }],
      runWasModified: false,
      auditHash,
    };
  }

  // No hotfixes = clean pass
  if (hotfixes.length === 0 && surpriseChanges.length === 0) {
    return {
      outcome: 'SUCCESS',
      appliedHotfixIds: [],
      surpriseChangesDetected: [],
      runWasModified: false,
      auditHash: buildAuditHash('LOCK_VERIFIED', null, gameState.runId, tick, {}),
    };
  }

  // Process the most severe hotfix (emergency first)
  const emergency = hotfixes.find(h => h.scope === 'EMERGENCY_DISABLE');
  const target = emergency ?? hotfixes[0];

  return applyHotfixToRun(target, runLock, gameState, surpriseChanges, tick);
}

/**
 * Determine outcome for a run given a game state.
 * Called during determineOutcome in the full turn engine.
 */
export function determineRunOutcome(
  gameState: GameState,
  hotfixes: Hotfix[],
  runLock: RunRulesetLock,
): Outcome {
  // If lock is invalid → force quarantine
  const { valid } = verifyRulesetLock(runLock);
  if (!valid) return 'QUARANTINE';

  // If any emergency disable hotfix touches this run
  const emergency = hotfixes.find(
    h => h.scope === 'EMERGENCY_DISABLE' && h.status !== 'REJECTED',
  );
  if (emergency) return 'QUARANTINE';

  // Standard outcome based on game state
  if (gameState.phase === 'FINALIZED' && gameState.netWorth > 0) return 'SUCCESS';
  return 'FAILURE';
}
