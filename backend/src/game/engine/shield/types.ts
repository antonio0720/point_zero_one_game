/*
 * POINT ZERO ONE — BACKEND SHIELD ENGINE TYPES
 * /backend/src/game/engine/shield/types.ts
 *
 * Doctrine:
 * - backend remains the authoritative shield simulation surface
 * - shield routing is owned by AttackRouter
 * - shield damage never mutates economy directly
 * - cascade effects are emitted to downstream engines rather than hard-calling them
 * - repair scheduling is deterministic and replay-safe
 */

import type {
  AttackCategory,
  AttackEvent,
  ShieldLayerId,
  ShieldLayerLabel,
} from '../core/GamePrimitives';
import type { ShieldLayerState } from '../core/RunStateSnapshot';

export type RepairLayerId = ShieldLayerId | 'ALL';

export interface ShieldLayerConfig {
  readonly layerId: ShieldLayerId;
  readonly label: ShieldLayerLabel;
  readonly doctrineName: string;
  readonly max: number;
  readonly passiveRegenRate: number;
  readonly breachedRegenRate: number;
  readonly cascadeGate: boolean;
}

export interface RepairJob {
  readonly jobId: string;
  readonly tick: number;
  readonly layerId: RepairLayerId;
  readonly amount: number;
  readonly durationTicks: number;
  readonly amountPerTick: number;
  readonly createdAtTick: number;
  readonly source: 'CARD' | 'SYSTEM' | 'ADMIN';
  readonly tags: readonly string[];
  ticksRemaining: number;
  delivered: number;
}

export interface PendingRepairSlice {
  readonly jobId: string;
  readonly layerId: RepairLayerId;
  readonly amount: number;
  readonly completed: boolean;
  readonly sourceTick: number;
}

export interface RoutedAttack {
  readonly attackId: string;
  readonly source: AttackEvent['source'];
  readonly category: AttackCategory;
  readonly requestedLayer: ShieldLayerId | 'DIRECT';
  readonly targetLayer: ShieldLayerId;
  readonly fallbackLayer: ShieldLayerId | null;
  readonly magnitude: number;
  readonly noteTags: readonly string[];
  readonly bypassDeflection: boolean;
}

export interface DamageResolution {
  readonly layers: readonly ShieldLayerState[];
  readonly actualLayerId: ShieldLayerId;
  readonly fallbackLayerId: ShieldLayerId | null;
  readonly effectiveDamage: number;
  readonly deflectionApplied: number;
  readonly preHitIntegrity: number;
  readonly postHitIntegrity: number;
  readonly breached: boolean;
  readonly wasAlreadyBreached: boolean;
  readonly blocked: boolean;
}

export interface CascadeResolution {
  readonly layers: readonly ShieldLayerState[];
  readonly triggered: boolean;
  readonly chainId: string | null;
  readonly templateId: string | null;
  readonly cascadeCount: number;
}

export const SHIELD_LAYER_ORDER = Object.freeze([
  'L1',
  'L2',
  'L3',
  'L4',
] as const satisfies readonly ShieldLayerId[]);

export const SHIELD_LAYER_CONFIGS: Readonly<Record<ShieldLayerId, ShieldLayerConfig>> =
  Object.freeze({
    L1: Object.freeze({
      layerId: 'L1',
      label: 'CASH_RESERVE',
      doctrineName: 'LIQUIDITY_BUFFER',
      max: 100,
      passiveRegenRate: 2,
      breachedRegenRate: 1,
      cascadeGate: false,
    }),
    L2: Object.freeze({
      layerId: 'L2',
      label: 'CREDIT_LINE',
      doctrineName: 'CREDIT_LINE',
      max: 80,
      passiveRegenRate: 2,
      breachedRegenRate: 1,
      cascadeGate: false,
    }),
    L3: Object.freeze({
      layerId: 'L3',
      label: 'INCOME_BASE',
      doctrineName: 'ASSET_FLOOR',
      max: 60,
      passiveRegenRate: 1,
      breachedRegenRate: 0,
      cascadeGate: false,
    }),
    L4: Object.freeze({
      layerId: 'L4',
      label: 'NETWORK_CORE',
      doctrineName: 'NETWORK_CORE',
      max: 40,
      passiveRegenRate: 1,
      breachedRegenRate: 0,
      cascadeGate: true,
    }),
  });

export const SHIELD_CONSTANTS = Object.freeze({
  LOW_WARNING_THRESHOLD: 0.30,
  CRITICAL_WARNING_THRESHOLD: 0.10,
  FORTIFIED_THRESHOLD: 0.80,
  DEFLECTION_FULL_INTEGRITY: 0.10,
  FORTIFIED_BONUS_DEFLECT: 0.15,
  DEFLECTION_MAX: 0.25,
  CASCADE_CRACK_RATIO: 0.20,
  MAX_ACTIVE_REPAIR_JOBS_PER_LAYER: 3,
});

export function isShieldLayerId(value: string): value is ShieldLayerId {
  return value === 'L1' || value === 'L2' || value === 'L3' || value === 'L4';
}

export function getLayerConfig(layerId: ShieldLayerId): ShieldLayerConfig {
  return SHIELD_LAYER_CONFIGS[layerId];
}

export function buildShieldLayerState(
  layerId: ShieldLayerId,
  current: number,
  lastDamagedTick: number | null,
  lastRecoveredTick: number | null,
): ShieldLayerState {
  const config = getLayerConfig(layerId);
  const clamped = Math.max(0, Math.min(config.max, Math.round(current)));
  const breached = clamped <= 0;
  const regenPerTick = breached
    ? config.breachedRegenRate
    : config.passiveRegenRate;

  return {
    layerId,
    label: config.label,
    current: clamped,
    max: config.max,
    regenPerTick,
    breached,
    integrityRatio: config.max === 0 ? 0 : clamped / config.max,
    lastDamagedTick,
    lastRecoveredTick,
  };
}

export function inferCriticalTags(notes: readonly string[]): readonly string[] {
  return Object.freeze(
    notes.map((note) => note.trim().toLowerCase()).filter((note) => note.length > 0),
  );
}