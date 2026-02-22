/**
 * M113a — Order Priority Stack (ML/DL Companion: Sacrifice Planner)
 * PZO_T00377 | Phase: PZO_P05_ML_MONETIZATION
 * File: pzo_ml/src/models/m113a.ts
 * Enforces: bounded nudges + audit_hash + ml_enabled kill-switch
 */

import { createHash } from 'crypto';

let ML_ENABLED = true;
export function setMLEnabled(enabled: boolean): void { ML_ENABLED = enabled; }
export function isMLEnabled(): boolean { return ML_ENABLED; }

export type OrderType = 'buy' | 'sell' | 'bid' | 'offer' | 'swap';
export type PriorityTier = 'critical' | 'high' | 'standard' | 'low' | 'deferred';

export interface PendingOrder {
  orderId: string;
  playerId: string;
  type: OrderType;
  assetId: string;
  amount: number;
  maxCost: number;
  priorityTier: PriorityTier;
  turnSubmitted: number;
  expiryTurn: number;
  sacrificeWeight: number;  // 0–1: how much player is willing to concede
}

export interface SacrificePlan {
  orderId: string;
  recommendedSacrifice: number;   // suggested value to give up to secure deal
  confidenceScore: number;        // 0–1
  alternativeOrders: string[];    // order IDs that could be deferred instead
  nudges: SacrificeNudge[];
  auditHash: string;
  mlEnabled: boolean;
}

export interface SacrificeNudge {
  type: 'reduce_ask' | 'defer_order' | 'increase_sacrifice' | 'split_order';
  message: string;
  deltaBP: number;   // BOUNDED: ±500 BP max
}

export interface OrderStack {
  playerId: string;
  turn: number;
  orders: PendingOrder[];
  totalExposure: number;
  cashAvailable: number;
}

const PRIORITY_WEIGHTS: Record<PriorityTier, number> = {
  critical: 1.0,
  high: 0.75,
  standard: 0.50,
  low: 0.25,
  deferred: 0.0,
};

const MAX_NUDGE_BP = 500;

export function buildSacrificePlan(
  stack: OrderStack,
  targetOrderId: string
): SacrificePlan {
  const nullPlan = (reason: string): SacrificePlan => ({
    orderId: targetOrderId,
    recommendedSacrifice: 0,
    confidenceScore: 0,
    alternativeOrders: [],
    nudges: [],
    auditHash: hashPlan(targetOrderId, reason, 0),
    mlEnabled: false,
  });

  if (!ML_ENABLED) return nullPlan('ml_disabled');

  const target = stack.orders.find(o => o.orderId === targetOrderId);
  if (!target) return nullPlan('order_not_found');

  const nudges: SacrificeNudge[] = [];
  const alternatives: string[] = [];

  // 1. Can we afford without sacrifice?
  const canAfford = stack.cashAvailable >= target.maxCost;
  if (canAfford) {
    return {
      orderId: targetOrderId,
      recommendedSacrifice: 0,
      confidenceScore: 0.95,
      alternativeOrders: [],
      nudges: [],
      auditHash: hashPlan(targetOrderId, 'no_sacrifice_needed', 0),
      mlEnabled: true,
    };
  }

  // 2. Find deferrable orders to free up cash
  const deferrable = stack.orders
    .filter(o => o.orderId !== targetOrderId && o.priorityTier !== 'critical')
    .sort((a, b) => PRIORITY_WEIGHTS[a.priorityTier] - PRIORITY_WEIGHTS[b.priorityTier]);

  let freed = stack.cashAvailable;
  for (const ord of deferrable) {
    if (freed >= target.maxCost) break;
    freed += ord.maxCost;
    alternatives.push(ord.orderId);
    nudges.push({
      type: 'defer_order',
      message: `Defer ${ord.orderId} (${ord.type} ${ord.assetId}) to free ${ord.maxCost}`,
      deltaBP: clamp(Math.round(PRIORITY_WEIGHTS[ord.priorityTier] * -200)),
    });
  }

  // 3. If still can't afford, compute recommended sacrifice
  const gap = Math.max(0, target.maxCost - freed);
  const recommendedSacrifice = gap > 0
    ? Math.round(gap * (1 + target.sacrificeWeight * 0.5))
    : 0;

  if (recommendedSacrifice > 0) {
    nudges.push({
      type: 'increase_sacrifice',
      message: `Gap of ${gap} remains — increase sacrifice by ~${recommendedSacrifice} to close deal`,
      deltaBP: clamp(Math.round((recommendedSacrifice / target.maxCost) * 500)),
    });
  }

  // 4. Split order suggestion if sacrifice is >20% of ask
  if (recommendedSacrifice > target.maxCost * 0.2) {
    nudges.push({
      type: 'split_order',
      message: 'Sacrifice >20% of ask — consider splitting order into two smaller tranches',
      deltaBP: clamp(-150),
    });
  }

  const shortfall = target.maxCost - stack.cashAvailable;
  const confidenceScore = Math.max(0, Math.min(1, 1 - shortfall / target.maxCost));

  return {
    orderId: targetOrderId,
    recommendedSacrifice,
    confidenceScore: parseFloat(confidenceScore.toFixed(4)),
    alternativeOrders: alternatives,
    nudges,
    auditHash: hashPlan(targetOrderId, 'plan_generated', recommendedSacrifice),
    mlEnabled: true,
  };
}

export function prioritizeStack(stack: OrderStack): PendingOrder[] {
  return [...stack.orders].sort((a, b) => {
    const pw = PRIORITY_WEIGHTS[b.priorityTier] - PRIORITY_WEIGHTS[a.priorityTier];
    if (pw !== 0) return pw;
    return a.turnSubmitted - b.turnSubmitted; // FIFO within same tier
  });
}

export function expireOrders(stack: OrderStack, currentTurn: number): string[] {
  const expired: string[] = [];
  stack.orders = stack.orders.filter(o => {
    if (currentTurn > o.expiryTurn) { expired.push(o.orderId); return false; }
    return true;
  });
  return expired;
}

function clamp(bp: number): number {
  return Math.max(-MAX_NUDGE_BP, Math.min(MAX_NUDGE_BP, bp));
}

function hashPlan(orderId: string, note: string, sacrifice: number): string {
  return createHash('sha256')
    .update(JSON.stringify({ orderId, note, sacrifice }))
    .digest('hex').slice(0, 16);
}
