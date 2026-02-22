/**
 * M125a — No-Ghost Hardcore (ML/DL Companion: Hardcore Integrity Monitor)
 * PZO_T00389 | Phase: PZO_P05_ML_MONETIZATION
 * File: pzo_ml/src/models/m125a.ts
 * Enforces: bounded nudges + audit_hash + ml_enabled kill-switch
 */

import { createHash } from 'crypto';

let ML_ENABLED = true;
export function setMLEnabled(enabled: boolean): void { ML_ENABLED = enabled; }
export function isMLEnabled(): boolean { return ML_ENABLED; }

export type ViolationType =
  | 'ghost_account'         // inactive player proxy holding assets
  | 'collusion_signal'      // statistically improbable co-op
  | 'sandbagging'           // deliberately losing to manipulate seeding
  | 'action_replay'         // submitting duplicate action hash
  | 'time_anomaly';         // action timestamp outside valid window

export interface ActionRecord {
  actionId: string;
  playerId: string;
  actionHash: string;       // deterministic hash of action params
  timestamp: number;        // epoch ms
  turn: number;
  actionType: string;
  counterpartyId?: string;
}

export interface IntegrityFlag {
  flagId: string;
  playerId: string;
  violationType: ViolationType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;       // 0–1
  evidence: string[];
  turn: number;
  resolved: boolean;
  auditHash: string;
}

export interface HardcoreMonitorState {
  tableId: string;
  sessionId: string;
  actionLog: ActionRecord[];
  flags: IntegrityFlag[];
  seenActionHashes: Set<string>;
  playerActivityMap: Map<string, number[]>;   // playerId → turns active
  turnWindowMs: number;    // valid action submission window
}

export function initMonitor(tableId: string, sessionId: string, turnWindowMs = 30000): HardcoreMonitorState {
  return {
    tableId,
    sessionId,
    actionLog: [],
    flags: [],
    seenActionHashes: new Set(),
    playerActivityMap: new Map(),
    turnWindowMs,
  };
}

export function submitAction(
  state: HardcoreMonitorState,
  action: ActionRecord,
  currentTurnStartMs: number
): { accepted: boolean; flags: IntegrityFlag[] } {
  if (!ML_ENABLED) {
    state.actionLog.push(action);
    return { accepted: true, flags: [] };
  }

  const newFlags: IntegrityFlag[] = [];

  // 1. Replay detection
  if (state.seenActionHashes.has(action.actionHash)) {
    newFlags.push(createFlag(
      action.playerId, 'action_replay', 'critical', 0.99,
      [`Duplicate action hash: ${action.actionHash}`, `Turn: ${action.turn}`],
      action.turn
    ));
    state.flags.push(...newFlags);
    return { accepted: false, flags: newFlags };
  }

  // 2. Time anomaly
  const windowEnd = currentTurnStartMs + state.turnWindowMs;
  if (action.timestamp > windowEnd || action.timestamp < currentTurnStartMs - 5000) {
    newFlags.push(createFlag(
      action.playerId, 'time_anomaly', 'medium', 0.85,
      [`Action timestamp ${action.timestamp} outside window [${currentTurnStartMs}, ${windowEnd}]`],
      action.turn
    ));
  }

  // 3. Ghost account — player with zero activity for 5+ turns then sudden action
  const activity = state.playerActivityMap.get(action.playerId) ?? [];
  const lastActive = activity.length > 0 ? Math.max(...activity) : -1;
  if (lastActive !== -1 && action.turn - lastActive > 5 && action.actionType !== 'heartbeat') {
    newFlags.push(createFlag(
      action.playerId, 'ghost_account', 'high', 0.70,
      [`No activity since turn ${lastActive}, sudden action at turn ${action.turn}`],
      action.turn
    ));
  }

  // 4. Collusion signal — same two players trading back-and-forth >3 times in 5 turns
  if (action.counterpartyId) {
    const pairTrades = state.actionLog.filter(
      a =>
        ((a.playerId === action.playerId && a.counterpartyId === action.counterpartyId) ||
         (a.playerId === action.counterpartyId && a.counterpartyId === action.playerId)) &&
        action.turn - a.turn <= 5
    );
    if (pairTrades.length >= 3) {
      newFlags.push(createFlag(
        action.playerId, 'collusion_signal', 'high', 0.65,
        [`${pairTrades.length + 1} trades with ${action.counterpartyId} in 5 turns`],
        action.turn
      ));
    }
  }

  // Accept action
  state.seenActionHashes.add(action.actionHash);
  state.actionLog.push(action);
  const turns = state.playerActivityMap.get(action.playerId) ?? [];
  turns.push(action.turn);
  state.playerActivityMap.set(action.playerId, turns);

  if (newFlags.length > 0) state.flags.push(...newFlags);

  const criticalBlocked = newFlags.some(f => f.severity === 'critical');
  return { accepted: !criticalBlocked, flags: newFlags };
}

export function resolveFlag(state: HardcoreMonitorState, flagId: string): boolean {
  const flag = state.flags.find(f => f.flagId === flagId);
  if (!flag) return false;
  flag.resolved = true;
  return true;
}

export function getOpenFlags(state: HardcoreMonitorState): IntegrityFlag[] {
  return state.flags.filter(f => !f.resolved);
}

export function getPlayerIntegrityScore(state: HardcoreMonitorState, playerId: string): number {
  if (!ML_ENABLED) return 100;
  const playerFlags = state.flags.filter(f => f.playerId === playerId && !f.resolved);
  const severityPenalty: Record<IntegrityFlag['severity'], number> = {
    low: 5, medium: 15, high: 30, critical: 50,
  };
  const penalty = playerFlags.reduce((s, f) => s + severityPenalty[f.severity] * f.confidence, 0);
  return Math.max(0, Math.round(100 - penalty));
}

function createFlag(
  playerId: string,
  type: ViolationType,
  severity: IntegrityFlag['severity'],
  confidence: number,
  evidence: string[],
  turn: number
): IntegrityFlag {
  const flagId = `FLAG_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const auditHash = createHash('sha256')
    .update(JSON.stringify({ flagId, playerId, type, severity, turn }))
    .digest('hex').slice(0, 16);
  return { flagId, playerId, violationType: type, severity, confidence, evidence, turn, resolved: false, auditHash };
}
