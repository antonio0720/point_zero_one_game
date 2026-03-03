// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/syndicate/rescueWindowEngine.ts
// Sprint 5 — Rescue Window System — SOVEREIGN EDITION
// Density6 LLC · Confidential
//
// Rescue windows open when any player drops below bankruptcy threshold.
// Alliance members have N ticks to contribute or dismiss.
// SHIELD_ARCHITECT role gets stronger rescue windows.
// Contribution sources: shared treasury + individual cash donations.
//
// CHANGE LOG:
//   • getRescueEffectiveness() now matches SyndicateCardMode exactly
//   • Added rescueWindowDurationMs() converter (tick ↔ ms bridge)
//   • GUARDIAN role → renamed SHIELD_ARCHITECT role
//   • Added multi-contributor merge (4 members can contribute simultaneously)
//   • Added computeRescueWithTrustMultiplier() — trust gates rescue power
//   • Added autoTreasuryDisbursement() — shared treasury auto-funds if available
//   • Added emitWarAlert() hook for War Alert System (bible spec)
//   • Added RescueWindowSummary for CORD/leaderboard export
// ═══════════════════════════════════════════════════════════════════════════

import { SYNDICATE_CONFIG } from './syndicateConfig';
import { getTrustMultiplier } from './trustScoreEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RescueWindowStatus = 'OPEN' | 'FUNDED' | 'DISMISSED' | 'EXPIRED' | 'FAILED';

export interface RescueContribution {
  playerId: string;
  amount: number;
  fromTreasury: boolean;
  tick: number;
  /** Was SHIELD_ARCHITECT bonus applied to this contribution? */
  shieldArchitectAmplified: boolean;
}

export interface RescueWindow {
  id: string;
  recipientId: string;
  openedAtTick: number;
  openedAtMs: number;          // wall clock time (for effectiveness decay)
  expiresAtTick: number;
  expiresAtMs: number;         // wall clock expiry (for SyndicateCardMode compat)
  status: RescueWindowStatus;
  cashNeeded: number;
  contributionRequired: number;
  totalContributed: number;
  contributions: RescueContribution[];
  resolvedAtTick: number | null;
  /** SHIELD_ARCHITECT role bonus: +20% effectiveness, regen speed +50% during rescue */
  shieldArchitectPresent: boolean;
  /** Last computed effectiveness value (0.4–1.0) */
  effectivenessCached: number;
  /** Was auto-funded from shared treasury? */
  autoFundedFromTreasury: boolean;
}

export interface OpenRescueWindowInput {
  recipientId: string;
  currentTick: number;
  nowMs: number;
  recipientCash: number;
  recipientIncome: number;
  recipientExpenses: number;
  senderTrustValue: number;
  shieldArchitectPresent: boolean;
}

/** Lightweight export for CORD/leaderboard */
export interface RescueWindowSummary {
  id: string;
  recipientId: string;
  status: RescueWindowStatus;
  contributionRequired: number;
  totalContributed: number;
  openedAtTick: number;
  shieldArchitectPresent: boolean;
}

/** War Alert event dispatched to entire team when rescue window opens */
export interface WarAlertEvent {
  type: 'RESCUE_WINDOW_OPENED';
  recipientId: string;
  cashNeeded: number;
  ticksAvailable: number;
  urgencyLevel: 'LOW' | 'MEDIUM' | 'CRITICAL';
}

// ─── Effectiveness Decay ──────────────────────────────────────────────────────

/**
 * Compute rescue effectiveness at the given wall-clock time.
 * Mirrors SyndicateCardMode.getRescueEffectiveness() exactly.
 *
 * Linear decay: 1.0× immediately → 0.4× at window expiry.
 * Multiplied by sender's Trust Score multiplier.
 */
export function getRescueEffectiveness(
  window: RescueWindow,
  nowMs: number,
  senderTrustValue: number,
): number {
  if (window.status !== 'OPEN') return SYNDICATE_CONFIG.rescueEffectivenessMin;

  const elapsed   = Math.max(0, nowMs - window.openedAtMs);
  const duration  = window.expiresAtMs - window.openedAtMs;
  const progress  = Math.min(1.0, elapsed / Math.max(1, duration));
  const base      = SYNDICATE_CONFIG.rescueEffectivenessMax
                    - progress * (SYNDICATE_CONFIG.rescueEffectivenessMax - SYNDICATE_CONFIG.rescueEffectivenessMin);
  const trustMult = getTrustMultiplier(senderTrustValue);

  const effectiveness = parseFloat(Math.min(1.0, base * trustMult).toFixed(3));
  return effectiveness;
}

/**
 * Convert tick duration to milliseconds for SyndicateCardMode compatibility.
 */
export function rescueWindowDurationMs(): number {
  return SYNDICATE_CONFIG.rescueWindowDurationMs;
}

// ─── Operations ───────────────────────────────────────────────────────────────

export function openRescueWindow(input: OpenRescueWindowInput): RescueWindow {
  const {
    recipientId, currentTick, nowMs, recipientCash,
    recipientIncome, recipientExpenses, senderTrustValue, shieldArchitectPresent,
  } = input;

  const cashflow      = recipientIncome - recipientExpenses;
  // Rescue covers 2 months of negative cashflow minimum
  const baseRequired  = Math.max(5_000, Math.abs(cashflow) * 2);

  // SHIELD_ARCHITECT reduces requirement by 20%
  const contributionRequired = shieldArchitectPresent
    ? Math.round(baseRequired * 0.8)
    : baseRequired;

  // Expiry in both tick space and ms space
  const expiresAtTick = currentTick + SYNDICATE_CONFIG.rescueWindowDuration;
  const expiresAtMs   = nowMs + SYNDICATE_CONFIG.rescueWindowDurationMs;

  return {
    id:                       `rescue-${currentTick}-${recipientId}`,
    recipientId,
    openedAtTick:             currentTick,
    openedAtMs:               nowMs,
    expiresAtTick,
    expiresAtMs,
    status:                   'OPEN',
    cashNeeded:               Math.abs(cashflow) * 3,
    contributionRequired,
    totalContributed:         0,
    contributions:            [],
    resolvedAtTick:           null,
    shieldArchitectPresent,
    effectivenessCached:      1.0,
    autoFundedFromTreasury:   false,
  };
}

/** Build the War Alert event to broadcast to the entire team */
export function emitWarAlert(window: RescueWindow): WarAlertEvent {
  const urgencyLevel: WarAlertEvent['urgencyLevel'] =
    window.cashNeeded > 20_000 ? 'CRITICAL' :
    window.cashNeeded > 5_000  ? 'MEDIUM'   : 'LOW';

  return {
    type:          'RESCUE_WINDOW_OPENED',
    recipientId:   window.recipientId,
    cashNeeded:    window.cashNeeded,
    ticksAvailable: SYNDICATE_CONFIG.rescueWindowDuration,
    urgencyLevel,
  };
}

export function contributeToRescue(
  window: RescueWindow,
  playerId: string,
  amount: number,
  fromTreasury: boolean,
  tick: number,
  shieldArchitectAmplified: boolean = false,
): RescueWindow {
  // SHIELD_ARCHITECT amplifies contributions by 20% when present
  const amplifiedAmount = shieldArchitectAmplified && window.shieldArchitectPresent
    ? Math.round(amount * 1.2)
    : amount;

  const contribution: RescueContribution = {
    playerId,
    amount: amplifiedAmount,
    fromTreasury,
    tick,
    shieldArchitectAmplified,
  };

  const totalContributed = window.totalContributed + amplifiedAmount;
  const funded = totalContributed >= window.contributionRequired;

  return {
    ...window,
    totalContributed,
    contributions:    [...window.contributions, contribution],
    status:           funded ? 'FUNDED' : window.status,
    resolvedAtTick:   funded ? tick : null,
  };
}

/**
 * Auto-fund rescue from shared treasury if sufficient balance.
 * Called automatically when window opens if treasury >= contributionRequired.
 */
export function autoTreasuryDisbursement(
  window: RescueWindow,
  treasuryBalance: number,
  tick: number,
): { window: RescueWindow; disbursed: number } {
  if (treasuryBalance < window.contributionRequired) {
    return { window, disbursed: 0 };
  }

  const disbursed  = window.contributionRequired;
  const funded     = contributeToRescue(window, 'TREASURY', disbursed, true, tick);

  return {
    window: { ...funded, autoFundedFromTreasury: true },
    disbursed,
  };
}

/**
 * Multi-contributor merge — apply all contributions atomically.
 * Supports 4 alliance members contributing simultaneously.
 */
export function applyMultiContributorBatch(
  window: RescueWindow,
  contributions: Array<{ playerId: string; amount: number; fromTreasury: boolean }>,
  tick: number,
): RescueWindow {
  let current = window;
  for (const c of contributions) {
    current = contributeToRescue(current, c.playerId, c.amount, c.fromTreasury, tick);
    if (current.status === 'FUNDED') break;
  }
  return current;
}

export function dismissRescueWindow(window: RescueWindow, tick: number): RescueWindow {
  return { ...window, status: 'DISMISSED', resolvedAtTick: tick };
}

export function expireRescueWindow(window: RescueWindow, currentTick: number): RescueWindow {
  if (window.status !== 'OPEN') return window;
  if (currentTick < window.expiresAtTick) return window;
  const status = window.totalContributed > 0 ? 'FAILED' : 'EXPIRED';
  return { ...window, status, resolvedAtTick: currentTick };
}

// ─── Derived ──────────────────────────────────────────────────────────────────

export function isFunded(window: RescueWindow): boolean {
  return window.status === 'FUNDED';
}

export function rescueWindowProgress(window: RescueWindow): number {
  if (window.contributionRequired === 0) return 1;
  return Math.min(1, window.totalContributed / window.contributionRequired);
}

export function computeRescueWithTrustMultiplier(
  baseAmount: number,
  senderTrustValue: number,
): number {
  const mult = getTrustMultiplier(senderTrustValue);
  return Math.round(baseAmount * mult);
}

export function buildRescueWindowSummary(window: RescueWindow): RescueWindowSummary {
  return {
    id:                     window.id,
    recipientId:            window.recipientId,
    status:                 window.status,
    contributionRequired:   window.contributionRequired,
    totalContributed:       window.totalContributed,
    openedAtTick:           window.openedAtTick,
    shieldArchitectPresent: window.shieldArchitectPresent,
  };
}