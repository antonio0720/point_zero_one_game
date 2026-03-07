//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/shield/types.ts

/**
 * FILE: pzo-web/src/engines/shield/types.ts
 * Single source of truth for all Shield Engine types, enums, constants, and interfaces.
 * Density6 LLC · Point Zero One · Engine 4 of 7 · Confidential
 */
import { v4 as uuidv4 } from 'uuid';

// ── Layer Identity ───────────────────────────────────────────────────────────

export enum ShieldLayerId {
  LIQUIDITY_BUFFER = 'LIQUIDITY_BUFFER',
  CREDIT_LINE      = 'CREDIT_LINE',
  ASSET_FLOOR      = 'ASSET_FLOOR',
  NETWORK_CORE     = 'NETWORK_CORE',
}

// Ordered outer → inner. DO NOT reorder. SHIELD_LAYER_ORDER[0] = first hit.
export const SHIELD_LAYER_ORDER: Readonly<ShieldLayerId[]> = Object.freeze([
  ShieldLayerId.LIQUIDITY_BUFFER,
  ShieldLayerId.CREDIT_LINE,
  ShieldLayerId.ASSET_FLOOR,
  ShieldLayerId.NETWORK_CORE,
]);

// ── Layer Config ─────────────────────────────────────────────────────────────

export interface ShieldLayerConfig {
  readonly id: ShieldLayerId;
  readonly name: string;
  readonly maxIntegrity: number;
  readonly passiveRegenRate: number;       // pts/tick when not breached
  readonly breachedRegenRate: number;      // pts/tick when at 0 (L3/L4 = 0 — frozen)
  readonly colorHex: string;
  readonly breachConsequenceText: string;
  readonly isInnerCascadeGate: boolean;    // true only for NETWORK_CORE
}

export const SHIELD_LAYER_CONFIGS: Readonly<Record<ShieldLayerId, ShieldLayerConfig>> = Object.freeze({
  [ShieldLayerId.LIQUIDITY_BUFFER]: {
    id: ShieldLayerId.LIQUIDITY_BUFFER,
    name: 'LIQUIDITY BUFFER',
    maxIntegrity: 100,
    passiveRegenRate: 2,
    breachedRegenRate: 1,
    colorHex: '#4A9ECC',
    breachConsequenceText: 'Income reduced 25% for 3 ticks. Liquidity crunch.',
    isInnerCascadeGate: false,
  },
  [ShieldLayerId.CREDIT_LINE]: {
    id: ShieldLayerId.CREDIT_LINE,
    name: 'CREDIT LINE',
    maxIntegrity: 80,
    passiveRegenRate: 2,
    breachedRegenRate: 1,
    colorHex: '#4ACC7A',
    breachConsequenceText: 'DEBT CARD forced into hand. Expenses spike +15% for 2 ticks.',
    isInnerCascadeGate: false,
  },
  [ShieldLayerId.ASSET_FLOOR]: {
    id: ShieldLayerId.ASSET_FLOOR,
    name: 'ASSET FLOOR',
    maxIntegrity: 60,
    passiveRegenRate: 1,
    breachedRegenRate: 0,
    colorHex: '#C9A84C',
    breachConsequenceText: 'Best income card auto-removed from hand. Asset stripped.',
    isInnerCascadeGate: false,
  },
  [ShieldLayerId.NETWORK_CORE]: {
    id: ShieldLayerId.NETWORK_CORE,
    name: 'NETWORK CORE',
    maxIntegrity: 40,
    passiveRegenRate: 1,
    breachedRegenRate: 0,
    colorHex: '#7B5EA7',
    breachConsequenceText: 'CASCADE TRIGGERED. Hater heat maximized. All layers crack.',
    isInnerCascadeGate: true,
  },
});

// ── Attack Types ─────────────────────────────────────────────────────────────

export enum AttackType {
  FINANCIAL_SABOTAGE  = 'FINANCIAL_SABOTAGE',
  EXPENSE_INJECTION   = 'EXPENSE_INJECTION',
  DEBT_ATTACK         = 'DEBT_ATTACK',
  ASSET_STRIP         = 'ASSET_STRIP',
  REPUTATION_ATTACK   = 'REPUTATION_ATTACK',
  REGULATORY_ATTACK   = 'REGULATORY_ATTACK',
  HATER_INJECTION     = 'HATER_INJECTION',
  OPPORTUNITY_KILL    = 'OPPORTUNITY_KILL',
}

// ── Core Attack / Damage Types ───────────────────────────────────────────────

export interface AttackEvent {
  readonly attackId: string;
  readonly attackType: AttackType;
  readonly rawPower: number;
  readonly sourceHaterId: string;
  readonly isCritical: boolean;   // bypasses all deflection
  readonly tickNumber: number;
}

export interface DamageResult {
  readonly attackId: string;
  readonly targetLayerId: ShieldLayerId;
  readonly fallbackLayerId: ShieldLayerId | null;
  readonly rawPower: number;
  readonly deflectionApplied: number;
  readonly effectiveDamage: number;
  readonly preHitIntegrity: number;
  readonly postHitIntegrity: number;
  readonly breachOccurred: boolean;
  readonly cascadeTriggered: boolean;
  readonly wasAlreadyBreached: boolean;
  readonly isCriticalHit: boolean;
}

// ── Layer Runtime State ───────────────────────────────────────────────────────

export interface ShieldLayerState {
  readonly id: ShieldLayerId;
  readonly name: string;
  readonly maxIntegrity: number;
  readonly colorHex: string;
  currentIntegrity: number;
  isBreached: boolean;
  integrityPct: number;
  isCriticalWarning: boolean;   // integrityPct < 0.10
  isLowWarning: boolean;        // integrityPct < 0.30
  lastBreachTick: number | null;
  totalBreachCount: number;
  pendingRepairPts: number;
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

export interface ShieldSnapshot {
  readonly layers: Readonly<Record<ShieldLayerId, ShieldLayerState>>;
  readonly overallIntegrityPct: number;   // unweighted average of 4 layers
  readonly weakestLayerId: ShieldLayerId;
  readonly isFortified: boolean;          // all layers >= 80%
  readonly isInBreachCascade: boolean;
  readonly cascadeCount: number;
  readonly tickNumber: number;
  readonly timestamp: number;
}

// ── ShieldReader Interface (cross-engine contract) ────────────────────────────

export interface ShieldReader {
  getLayerState(id: ShieldLayerId): ShieldLayerState;
  getOverallIntegrityPct(): number;     // used by PressureEngine signal collector
  getWeakestLayerId(): ShieldLayerId;   // used by BattleEngine for HATER_INJECTION routing
  isFortified(): boolean;               // used by BattleEngine (harder to attack when fortified)
  isLayerBreached(id: ShieldLayerId): boolean;
  getSnapshot(): ShieldSnapshot;
}

// ── Repair Types ──────────────────────────────────────────────────────────────

export interface RepairCard {
  readonly cardId: string;
  readonly targetLayerId: ShieldLayerId;
  readonly repairPts: number;
  readonly durationTicks: number;   // 1 or 2
}

export interface RepairJob {
  readonly jobId: string;
  readonly targetLayerId: ShieldLayerId;
  readonly totalRepairPts: number;
  readonly ptsPerTick: number;
  readonly durationTicks: number;
  ticksRemaining: number;
  ptsDelivered: number;
}

// ── Event Types ───────────────────────────────────────────────────────────────

export interface ShieldHitEvent {
  eventType: 'SHIELD_HIT';
  damageResult: DamageResult;
  layerColorHex: string;
  tickNumber: number;
  timestamp: number;
}

export interface ShieldLayerBreachedEvent {
  eventType: 'SHIELD_LAYER_BREACHED';
  layerId: ShieldLayerId;
  layerName: string;
  breachConsequenceText: string;
  cascadeTriggered: boolean;
  tickNumber: number;
  timestamp: number;
}

export interface ShieldRepairEvent {
  eventType: 'SHIELD_REPAIR';
  layerId: ShieldLayerId;
  ptsRepaired: number;
  newIntegrity: number;
  isFullyRepaired: boolean;
  tickNumber: number;
  timestamp: number;
}

export interface ShieldFortifiedEvent {
  eventType: 'SHIELD_FORTIFIED';
  tickNumber: number;
  timestamp: number;
}

export interface CascadeTriggeredEvent {
  eventType: 'CASCADE_TRIGGERED';
  sourceLayerId: ShieldLayerId;
  haterHeatSetTo: number;
  allLayersCrackedTo: number;
  tickNumber: number;
  timestamp: number;
}

export interface ShieldSnapshotUpdatedEvent {
  eventType: 'SHIELD_SNAPSHOT_UPDATED';
  snapshot: ShieldSnapshot;
  tickNumber: number;
  timestamp: number;
}

export interface ShieldRepairQueueFullEvent {
  eventType: 'SHIELD_REPAIR_QUEUE_FULL';
  layerId: ShieldLayerId;
  tickNumber: number;
  timestamp: number;
}

export type ShieldEvent =
  | ShieldHitEvent
  | ShieldLayerBreachedEvent
  | ShieldRepairEvent
  | ShieldFortifiedEvent
  | CascadeTriggeredEvent
  | ShieldSnapshotUpdatedEvent
  | ShieldRepairQueueFullEvent;

// ── Constants ─────────────────────────────────────────────────────────────────

export const SHIELD_CONSTANTS = Object.freeze({
  LOW_WARNING_THRESHOLD:      0.30,
  CRITICAL_WARNING_THRESHOLD: 0.10,
  DEFLECTION_FULL_INTEGRITY:  0.10,
  DEFLECTION_MAX:             0.25,
  FORTIFIED_THRESHOLD:        0.80,
  FORTIFIED_BONUS_DEFLECT:    0.15,
  CASCADE_CRACK_PCT:          0.20,
  MAX_ACTIVE_REPAIR_JOBS:     3,
});

// Exported so consumers can generate IDs consistently
export { uuidv4 };