/*
 * POINT ZERO ONE — BACKEND SHIELD ENGINE TYPES
 * /backend/src/game/engine/shield/types.ts
 *
 * Doctrine:
 * - backend shield simulation is authoritative and deterministic
 * - shield routing belongs exclusively to AttackRouter
 * - shield damage never writes economy consequences directly
 * - L4 breach emits downstream cascade signals; it does not hard-call CascadeEngine
 * - repair scheduling must be replay-safe and queue-bounded
 */

import type {
  AttackCategory,
  AttackEvent,
  ShieldLayerId,
  ShieldLayerLabel,
} from '../core/GamePrimitives';
import type { ShieldLayerState } from '../core/RunStateSnapshot';

export type RepairLayerId = ShieldLayerId | 'ALL';

export type ShieldDoctrineAttackType =
  | 'FINANCIAL_SABOTAGE'
  | 'EXPENSE_INJECTION'
  | 'DEBT_ATTACK'
  | 'ASSET_STRIP'
  | 'REPUTATION_ATTACK'
  | 'REGULATORY_ATTACK'
  | 'HATER_INJECTION'
  | 'OPPORTUNITY_KILL';

export interface ShieldLayerConfig {
  readonly layerId: ShieldLayerId;
  readonly label: ShieldLayerLabel;
  readonly doctrineName: string;
  readonly max: number;
  readonly passiveRegenRate: number;
  readonly breachedRegenRate: number;
  readonly cascadeGate: boolean;
  readonly breachConsequenceText: string;
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

export interface QueueRejection {
  readonly tick: number;
  readonly layerId: RepairLayerId;
  readonly amount: number;
  readonly durationTicks: number;
  readonly source: 'CARD' | 'SYSTEM' | 'ADMIN';
}

export interface RoutedAttack {
  readonly attackId: string;
  readonly source: AttackEvent['source'];
  readonly category: AttackCategory;
  readonly doctrineType: ShieldDoctrineAttackType;
  readonly requestedLayer: ShieldLayerId | 'DIRECT';
  readonly targetLayer: ShieldLayerId;
  readonly fallbackLayer: ShieldLayerId | null;
  readonly magnitude: number;
  readonly createdAtTick: number;
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
      breachConsequenceText:
        'Liquidity buffer breached. Downstream systems should model income disruption.',
    }),
    L2: Object.freeze({
      layerId: 'L2',
      label: 'CREDIT_LINE',
      doctrineName: 'CREDIT_LINE',
      max: 80,
      passiveRegenRate: 2,
      breachedRegenRate: 1,
      cascadeGate: false,
      breachConsequenceText:
        'Credit line breached. Downstream systems should model debt pressure and expense spike.',
    }),
    L3: Object.freeze({
      layerId: 'L3',
      label: 'INCOME_BASE',
      doctrineName: 'ASSET_FLOOR',
      max: 60,
      passiveRegenRate: 1,
      breachedRegenRate: 0,
      cascadeGate: false,
      breachConsequenceText:
        'Asset floor breached. Downstream systems should model opportunity or income loss.',
    }),
    L4: Object.freeze({
      layerId: 'L4',
      label: 'NETWORK_CORE',
      doctrineName: 'NETWORK_CORE',
      max: 40,
      passiveRegenRate: 1,
      breachedRegenRate: 0,
      cascadeGate: true,
      breachConsequenceText:
        'Network core breached. Downstream systems should trigger the highest-severity cascade.',
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
  MAX_HISTORY_DEPTH: 64,
});

export const SHIELD_ATTACK_ALIASES: Readonly<Record<string, ShieldDoctrineAttackType>> =
  Object.freeze({
    'financial-sabotage': 'FINANCIAL_SABOTAGE',
    financial_sabotage: 'FINANCIAL_SABOTAGE',
    embezzler: 'FINANCIAL_SABOTAGE',
    sabotage: 'FINANCIAL_SABOTAGE',

    'expense-injection': 'EXPENSE_INJECTION',
    expense_injection: 'EXPENSE_INJECTION',
    overhead: 'EXPENSE_INJECTION',
    lifestyle_creep: 'EXPENSE_INJECTION',

    'debt-attack': 'DEBT_ATTACK',
    debt_attack: 'DEBT_ATTACK',
    predatory_lender: 'DEBT_ATTACK',
    debt_daemon: 'DEBT_ATTACK',

    'asset-strip': 'ASSET_STRIP',
    asset_strip: 'ASSET_STRIP',
    liquidator: 'ASSET_STRIP',
    stripper: 'ASSET_STRIP',

    'reputation-attack': 'REPUTATION_ATTACK',
    reputation_attack: 'REPUTATION_ATTACK',
    reputation: 'REPUTATION_ATTACK',
    lawsuit: 'REPUTATION_ATTACK',

    'regulatory-attack': 'REGULATORY_ATTACK',
    regulatory_attack: 'REGULATORY_ATTACK',
    regulatory: 'REGULATORY_ATTACK',
    auditor: 'REGULATORY_ATTACK',
    tax_daemon: 'REGULATORY_ATTACK',
    compliance: 'REGULATORY_ATTACK',

    'hater-injection': 'HATER_INJECTION',
    hater_injection: 'HATER_INJECTION',
    weakest_layer: 'HATER_INJECTION',
    weakest: 'HATER_INJECTION',

    'opportunity-kill': 'OPPORTUNITY_KILL',
    opportunity_kill: 'OPPORTUNITY_KILL',
    opportunity_block: 'OPPORTUNITY_KILL',
    blocker: 'OPPORTUNITY_KILL',

    critical: 'HATER_INJECTION',
  });

export function isShieldLayerId(value: unknown): value is ShieldLayerId {
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

export function normalizeShieldNoteTags(
  notes: readonly string[],
): readonly string[] {
  return Object.freeze(
    notes
      .map((note) =>
        note
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '-'),
      )
      .filter((note) => note.length > 0),
  );
}

export function resolveShieldAlias(
  noteTags: readonly string[],
): ShieldDoctrineAttackType | null {
  for (const tag of noteTags) {
    const resolved = SHIELD_ATTACK_ALIASES[tag];
    if (resolved !== undefined) {
      return resolved;
    }
  }

  return null;
}

export function layerOrderIndex(layerId: ShieldLayerId): number {
  return SHIELD_LAYER_ORDER.indexOf(layerId);
}