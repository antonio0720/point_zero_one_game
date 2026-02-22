/**
 * M35a — Portfolio Heat Controller (Overconcentration + Friction Escalation)
 * PZO_T00299 | Phase: PZO_P05_ML_MONETIZATION
 * File: pzo_ml/src/models/m035a.ts
 * Enforces: bounded nudges + audit_hash + ml_enabled kill-switch
 */

import { createHash } from 'crypto';

// ── Kill-switch ──────────────────────────────────────────────────────────────
let ML_ENABLED = true;
export function setMLEnabled(enabled: boolean): void { ML_ENABLED = enabled; }
export function isMLEnabled(): boolean { return ML_ENABLED; }

// ── Types ────────────────────────────────────────────────────────────────────
export interface PortfolioPosition {
  assetId: string;
  sector: string;
  value: number;
}

export interface HeatInput {
  playerId: string;
  turn: number;
  positions: PortfolioPosition[];
  totalPortfolioValue: number;
  recentTradeCount: number;     // trades in last 3 turns
  cashReserveRatio: number;     // 0–1
}

export interface HeatOutput {
  heatScore: number;            // 0–100 (100 = maximum heat/friction)
  concentrationRisk: number;    // 0–1
  frictionMultiplier: number;   // 1.0 = normal, >1 = additional cost on new buys
  nudges: HeatNudge[];
  auditHash: string;
  mlEnabled: boolean;
}

export interface HeatNudge {
  type: 'reduce_concentration' | 'increase_cash' | 'slow_trading' | 'diversify_sector';
  message: string;
  urgency: 'low' | 'medium' | 'high';
  suggestedDeltaBP: number;     // BOUNDED: max ±500 BP adjustment suggestion
}

// ── Constants ────────────────────────────────────────────────────────────────
const MAX_NUDGE_BP = 500;
const CONCENTRATION_THRESHOLD = 0.40;   // single asset > 40% = high risk
const SECTOR_CONCENTRATION_THRESHOLD = 0.60;
const HIGH_TRADE_VELOCITY = 5;          // trades/3-turns
const MIN_CASH_RATIO = 0.10;
const MAX_FRICTION = 2.5;               // cap friction multiplier

// ── Core engine ──────────────────────────────────────────────────────────────
export function computePortfolioHeat(input: HeatInput): HeatOutput {
  const nudges: HeatNudge[] = [];
  let heatScore = 0;

  // 1. Single-asset concentration
  const concentrationRisk = computeConcentrationRisk(input.positions, input.totalPortfolioValue);
  if (concentrationRisk > CONCENTRATION_THRESHOLD) {
    const severity = concentrationRisk > 0.6 ? 'high' : concentrationRisk > 0.5 ? 'medium' : 'low';
    const bp = clampNudge(Math.round((concentrationRisk - CONCENTRATION_THRESHOLD) * 2000));
    nudges.push({
      type: 'reduce_concentration',
      message: `Single asset at ${(concentrationRisk * 100).toFixed(1)}% of portfolio — reduce to <40%`,
      urgency: severity,
      suggestedDeltaBP: bp,
    });
    heatScore += concentrationRisk * 40;
  }

  // 2. Sector concentration
  const sectorConc = computeSectorConcentration(input.positions, input.totalPortfolioValue);
  if (sectorConc > SECTOR_CONCENTRATION_THRESHOLD) {
    nudges.push({
      type: 'diversify_sector',
      message: `Sector overweight at ${(sectorConc * 100).toFixed(1)}% — diversify across sectors`,
      urgency: sectorConc > 0.8 ? 'high' : 'medium',
      suggestedDeltaBP: clampNudge(Math.round((sectorConc - SECTOR_CONCENTRATION_THRESHOLD) * 1000)),
    });
    heatScore += sectorConc * 20;
  }

  // 3. Trade velocity
  if (input.recentTradeCount >= HIGH_TRADE_VELOCITY) {
    nudges.push({
      type: 'slow_trading',
      message: `${input.recentTradeCount} trades in 3 turns — velocity friction active`,
      urgency: 'medium',
      suggestedDeltaBP: clampNudge(input.recentTradeCount * 30),
    });
    heatScore += Math.min(input.recentTradeCount * 4, 25);
  }

  // 4. Low cash reserve
  if (input.cashReserveRatio < MIN_CASH_RATIO) {
    nudges.push({
      type: 'increase_cash',
      message: `Cash reserve at ${(input.cashReserveRatio * 100).toFixed(1)}% — below 10% minimum`,
      urgency: input.cashReserveRatio < 0.05 ? 'high' : 'medium',
      suggestedDeltaBP: clampNudge(Math.round((MIN_CASH_RATIO - input.cashReserveRatio) * 2000)),
    });
    heatScore += (MIN_CASH_RATIO - input.cashReserveRatio) * 150;
  }

  heatScore = Math.min(100, Math.round(heatScore));
  const frictionMultiplier = Math.min(MAX_FRICTION, 1 + (heatScore / 100) * 1.5);

  const auditHash = computeAuditHash(input, heatScore, nudges);

  if (!ML_ENABLED) {
    return {
      heatScore: 0,
      concentrationRisk: 0,
      frictionMultiplier: 1.0,
      nudges: [],
      auditHash,
      mlEnabled: false,
    };
  }

  return {
    heatScore,
    concentrationRisk,
    frictionMultiplier: parseFloat(frictionMultiplier.toFixed(4)),
    nudges,
    auditHash,
    mlEnabled: true,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function computeConcentrationRisk(positions: PortfolioPosition[], total: number): number {
  if (total === 0 || positions.length === 0) return 0;
  return Math.max(...positions.map(p => p.value / total));
}

function computeSectorConcentration(positions: PortfolioPosition[], total: number): number {
  if (total === 0) return 0;
  const sectorMap = new Map<string, number>();
  for (const p of positions) {
    sectorMap.set(p.sector, (sectorMap.get(p.sector) ?? 0) + p.value);
  }
  return Math.max(...Array.from(sectorMap.values()).map(v => v / total));
}

function clampNudge(bp: number): number {
  return Math.max(-MAX_NUDGE_BP, Math.min(MAX_NUDGE_BP, bp));
}

function computeAuditHash(input: HeatInput, heatScore: number, nudges: HeatNudge[]): string {
  const payload = JSON.stringify({
    playerId: input.playerId,
    turn: input.turn,
    totalPortfolioValue: input.totalPortfolioValue,
    positionCount: input.positions.length,
    heatScore,
    nudgeCount: nudges.length,
  });
  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}
