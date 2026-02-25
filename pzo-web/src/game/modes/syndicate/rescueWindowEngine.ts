// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/syndicate/rescueWindowEngine.ts
// Sprint 5 — Rescue Window System
//
// Rescue windows open when any player drops below bankruptcy threshold.
// Alliance members have N ticks to contribute or dismiss.
// GUARDIAN role gets stronger rescue windows.
// Contribution sources: shared treasury + individual cash donations.
// ═══════════════════════════════════════════════════════════════════════════

import { SYNDICATE_CONFIG } from './syndicateConfig';

export type RescueWindowStatus = 'OPEN' | 'FUNDED' | 'DISMISSED' | 'EXPIRED' | 'FAILED';

export interface RescueContribution {
  playerId: string;
  amount: number;
  fromTreasury: boolean;
  tick: number;
}

export interface RescueWindow {
  id: string;
  recipientId: string;
  openedAtTick: number;
  expiresAtTick: number;
  status: RescueWindowStatus;
  cashNeeded: number;
  contributionRequired: number;
  totalContributed: number;
  contributions: RescueContribution[];
  resolvedAtTick: number | null;
  /** GUARDIAN role bonus: +20% effectiveness */
  guardianAmplified: boolean;
}

export interface OpenRescueWindowInput {
  recipientId: string;
  currentTick: number;
  recipientCash: number;
  recipientIncome: number;
  recipientExpenses: number;
  hasGuardian: boolean;
}

// ─── Operations ───────────────────────────────────────────────────────────────

export function openRescueWindow(input: OpenRescueWindowInput): RescueWindow {
  const { recipientId, currentTick, recipientCash, recipientIncome, recipientExpenses, hasGuardian } = input;

  const cashflow = recipientIncome - recipientExpenses;
  const monthsToBreakeven = cashflow < 0 ? Math.abs(recipientCash / cashflow) : 12;
  // Rescue covers 2 months of negative cashflow minimum
  const baseRequired = Math.max(5_000, Math.abs(cashflow) * 2);
  const contributionRequired = hasGuardian
    ? Math.round(baseRequired * 0.8)  // GUARDIAN reduces requirement by 20%
    : baseRequired;

  return {
    id: `rescue-${currentTick}-${recipientId}`,
    recipientId,
    openedAtTick: currentTick,
    expiresAtTick: currentTick + SYNDICATE_CONFIG.rescueWindowDuration,
    status: 'OPEN',
    cashNeeded: Math.abs(cashflow) * 3,
    contributionRequired,
    totalContributed: 0,
    contributions: [],
    resolvedAtTick: null,
    guardianAmplified: hasGuardian,
  };
}

export function contributeToRescue(
  window: RescueWindow,
  playerId: string,
  amount: number,
  fromTreasury: boolean,
  tick: number,
): RescueWindow {
  const contribution: RescueContribution = { playerId, amount, fromTreasury, tick };
  const totalContributed = window.totalContributed + amount;
  const funded = totalContributed >= window.contributionRequired;

  return {
    ...window,
    totalContributed,
    contributions: [...window.contributions, contribution],
    status: funded ? 'FUNDED' : window.status,
    resolvedAtTick: funded ? tick : null,
  };
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

export function isFunded(window: RescueWindow): boolean {
  return window.status === 'FUNDED';
}

export function rescueWindowProgress(window: RescueWindow): number {
  if (window.contributionRequired === 0) return 1;
  return Math.min(1, window.totalContributed / window.contributionRequired);
}
