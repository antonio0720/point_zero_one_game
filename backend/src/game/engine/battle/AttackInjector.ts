/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/battle/AttackInjector.ts
 *
 * Doctrine:
 * - attack generation is deterministic and mode-aware
 * - pressureScore is normalized (0..1) and must be expanded intentionally
 * - attack IDs must remain stable under replay for the same run/tick/order
 * - this file is battle-policy, not randomness; identical inputs must emit
 *   identical attack objects and identical diagnostic notes
 * - notes are intentional: backend operators, replay systems, proof surfaces,
 *   and chat staging can all inspect them without touching the battle runtime
 */

import type {
  AttackCategory,
  AttackEvent,
  AttackTargetEntity,
  ModeCode,
  ShieldLayerId,
} from '../core/GamePrimitives';
import type { AttackBuildInput, BotProfile } from './types';

type AttackLayerTarget = ShieldLayerId | 'DIRECT';

type PressureBand = 'CALM' | 'BUILDING' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
type ThreatBand = 'LOW' | 'ACTIVE' | 'HOT' | 'EXTREME';

type MagnitudeBreakdown = {
  readonly normalizedPressure: number;
  readonly normalizedThreat: number;
  readonly normalizedAggression: number;
  readonly pressureCurve: number;
  readonly threatCurve: number;
  readonly aggressionCurve: number;
  readonly profileBias: number;
  readonly modeBias: number;
  readonly categoryBias: number;
  readonly cadenceBias: number;
  readonly targetBias: number;
  readonly firstStrikeBonus: number;
  readonly directnessBias: number;
  readonly subtotal: number;
  readonly scaled: number;
  readonly clamped: number;
};

const CATEGORY_MAGNITUDE_FLOOR: Readonly<Record<AttackCategory, number>> = Object.freeze({
  EXTRACTION: 16,
  LOCK: 12,
  DRAIN: 10,
  HEAT: 8,
  BREACH: 18,
  DEBT: 14,
});

const CATEGORY_MAGNITUDE_CAP: Readonly<Record<AttackCategory, number>> = Object.freeze({
  EXTRACTION: 96,
  LOCK: 85,
  DRAIN: 80,
  HEAT: 72,
  BREACH: 99,
  DEBT: 90,
});

const CATEGORY_BASE_BIAS: Readonly<Record<AttackCategory, number>> = Object.freeze({
  EXTRACTION: 7.25,
  LOCK: 5.75,
  DRAIN: 4.5,
  HEAT: 3.5,
  BREACH: 8.5,
  DEBT: 6.5,
});

const CATEGORY_SCALAR: Readonly<Record<AttackCategory, number>> = Object.freeze({
  EXTRACTION: 1.18,
  LOCK: 1.06,
  DRAIN: 1.02,
  HEAT: 0.92,
  BREACH: 1.24,
  DEBT: 1.1,
});

const MODE_SCALAR: Readonly<Record<ModeCode, number>> = Object.freeze({
  solo: 1.04,
  pvp: 1.12,
  coop: 0.98,
  ghost: 1.08,
});

const MODE_TARGETING_NOTE: Readonly<Record<ModeCode, string>> = Object.freeze({
  solo: 'mode:isolated-sovereign',
  pvp: 'mode:predator-duel',
  coop: 'mode:syndicate-pressure',
  ghost: 'mode:legend-chase',
});

const CATEGORY_TACTICAL_NOTE: Readonly<Record<AttackCategory, string>> = Object.freeze({
  EXTRACTION: 'category:capital-removal',
  LOCK: 'category:friction-lock',
  DRAIN: 'category:liquidity-erosion',
  HEAT: 'category:visibility-escalation',
  BREACH: 'category:shield-breaker',
  DEBT: 'category:liability-injection',
});

const CATEGORY_DEFAULT_LAYER: Readonly<Record<AttackCategory, AttackLayerTarget>> = Object.freeze({
  EXTRACTION: 'DIRECT',
  LOCK: 'L2',
  DRAIN: 'L1',
  HEAT: 'DIRECT',
  BREACH: 'L3',
  DEBT: 'L2',
});

const CATEGORY_LAYER_FALLBACK_BY_MODE: Readonly<
  Record<ModeCode, Readonly<Record<AttackCategory, AttackLayerTarget>>>
> = Object.freeze({
  solo: Object.freeze({
    EXTRACTION: 'L1',
    LOCK: 'L2',
    DRAIN: 'L1',
    HEAT: 'DIRECT',
    BREACH: 'L3',
    DEBT: 'L2',
  }),
  pvp: Object.freeze({
    EXTRACTION: 'DIRECT',
    LOCK: 'L2',
    DRAIN: 'L1',
    HEAT: 'DIRECT',
    BREACH: 'DIRECT',
    DEBT: 'L2',
  }),
  coop: Object.freeze({
    EXTRACTION: 'L1',
    LOCK: 'L2',
    DRAIN: 'L1',
    HEAT: 'DIRECT',
    BREACH: 'L3',
    DEBT: 'L2',
  }),
  ghost: Object.freeze({
    EXTRACTION: 'L3',
    LOCK: 'L4',
    DRAIN: 'L1',
    HEAT: 'DIRECT',
    BREACH: 'L4',
    DEBT: 'L2',
  }),
});

const CATEGORY_TARGET_ENTITY_BY_MODE: Readonly<
  Record<ModeCode, Readonly<Record<AttackCategory, AttackTargetEntity>>>
> = Object.freeze({
  solo: Object.freeze({
    EXTRACTION: 'PLAYER',
    LOCK: 'PLAYER',
    DRAIN: 'PLAYER',
    HEAT: 'PLAYER',
    BREACH: 'PLAYER',
    DEBT: 'PLAYER',
  }),
  pvp: Object.freeze({
    EXTRACTION: 'OPPONENT',
    LOCK: 'OPPONENT',
    DRAIN: 'OPPONENT',
    HEAT: 'OPPONENT',
    BREACH: 'OPPONENT',
    DEBT: 'OPPONENT',
  }),
  coop: Object.freeze({
    EXTRACTION: 'PLAYER',
    LOCK: 'PLAYER',
    DRAIN: 'PLAYER',
    HEAT: 'TEAM',
    BREACH: 'TEAM',
    DEBT: 'TEAM',
  }),
  ghost: Object.freeze({
    EXTRACTION: 'PLAYER',
    LOCK: 'PLAYER',
    DRAIN: 'PLAYER',
    HEAT: 'PLAYER',
    BREACH: 'PLAYER',
    DEBT: 'PLAYER',
  }),
});

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, digits: number): number {
  const scalar = 10 ** digits;
  return Math.round(value * scalar) / scalar;
}

function normalizeThreatScore(value: number): number {
  return clamp(value / 100, 0, 1);
}

function normalizeAggression(value: number): number {
  return clamp(value / 100, 0, 1);
}

function formatFixed(value: number, digits = 2): string {
  return roundTo(value, digits).toFixed(digits);
}

function resolvePressureBand(score: number): PressureBand {
  if (score >= 0.85) {
    return 'CRITICAL';
  }

  if (score >= 0.65) {
    return 'HIGH';
  }

  if (score >= 0.4) {
    return 'ELEVATED';
  }

  if (score >= 0.2) {
    return 'BUILDING';
  }

  return 'CALM';
}

function resolveThreatBand(score: number): ThreatBand {
  if (score >= 0.85) {
    return 'EXTREME';
  }

  if (score >= 0.65) {
    return 'HOT';
  }

  if (score >= 0.35) {
    return 'ACTIVE';
  }

  return 'LOW';
}

function buildAttackId(input: AttackBuildInput): string {
  return `${input.runId}_${input.profile.botId}_${String(input.tick)}_${String(
    input.attackIndex,
  ).padStart(2, '0')}`;
}

function sanitizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function isSameEntity(a: AttackTargetEntity, b: AttackTargetEntity): boolean {
  return a === b;
}

function resolveDirectnessBias(category: AttackCategory, targetLayer: AttackLayerTarget): number {
  if (targetLayer === 'DIRECT') {
    if (category === 'EXTRACTION' || category === 'BREACH') {
      return 4.25;
    }

    if (category === 'HEAT') {
      return 2.25;
    }

    return 1.5;
  }

  if (category === 'LOCK' && targetLayer === 'L2') {
    return 2.15;
  }

  if (category === 'DRAIN' && targetLayer === 'L1') {
    return 1.95;
  }

  if (category === 'BREACH' && (targetLayer === 'L3' || targetLayer === 'L4')) {
    return 2.5;
  }

  return 0;
}

function resolvePressureCurve(normalizedPressure: number): number {
  if (normalizedPressure >= 0.9) {
    return 28 + (normalizedPressure - 0.9) * 70;
  }

  if (normalizedPressure >= 0.75) {
    return 20 + (normalizedPressure - 0.75) * 53.3333333333;
  }

  if (normalizedPressure >= 0.5) {
    return 11 + (normalizedPressure - 0.5) * 36;
  }

  if (normalizedPressure >= 0.25) {
    return 4 + (normalizedPressure - 0.25) * 28;
  }

  return normalizedPressure * 16;
}

function resolveThreatCurve(normalizedThreat: number): number {
  if (normalizedThreat >= 0.9) {
    return 31 + (normalizedThreat - 0.9) * 80;
  }

  if (normalizedThreat >= 0.7) {
    return 22 + (normalizedThreat - 0.7) * 45;
  }

  if (normalizedThreat >= 0.4) {
    return 11 + (normalizedThreat - 0.4) * 36.6666666667;
  }

  return normalizedThreat * 27.5;
}

function resolveAggressionCurve(normalizedAggression: number): number {
  if (normalizedAggression >= 0.85) {
    return 24 + (normalizedAggression - 0.85) * 66.6666666667;
  }

  if (normalizedAggression >= 0.6) {
    return 14 + (normalizedAggression - 0.6) * 40;
  }

  if (normalizedAggression >= 0.3) {
    return 6 + (normalizedAggression - 0.3) * 26.6666666667;
  }

  return normalizedAggression * 20;
}

function resolveCadenceBias(profile: BotProfile): number {
  const cooldownPressure = clamp((12 - profile.cooldownTicks) / 12, 0, 1);
  const watchPressure = clamp(profile.watchWindow / 30, 0, 1);
  const targetPressure = clamp(profile.targetWindow / 30, 0, 1);

  return roundTo(cooldownPressure * 3.4 + watchPressure * 1.45 + targetPressure * 2.15, 3);
}

function resolveProfileBias(profile: BotProfile): number {
  const weightFootprint = profile.pressureWeight + profile.heatWeight + profile.rivalryWeight;
  const normalizedWeightFootprint = clamp(weightFootprint / 6, 0, 1);
  const thresholdBias = clamp((100 - profile.activationThreshold) / 100, 0, 1) * 2.2;

  return roundTo(normalizedWeightFootprint * 4.75 + thresholdBias, 3);
}

function resolveModeBias(mode: ModeCode, profile: BotProfile): number {
  const explicitModeWeight = profile.modeWeight[mode] ?? 0;
  const scalarBias = (MODE_SCALAR[mode] - 1) * 14;

  return roundTo(explicitModeWeight + scalarBias, 3);
}

function resolveCategoryBias(category: AttackCategory, mode: ModeCode): number {
  const base = CATEGORY_BASE_BIAS[category];
  const modeScalar = MODE_SCALAR[mode];

  return roundTo(base * (0.75 + (modeScalar - 0.85)), 3);
}

function resolveFirstStrikeBonus(input: AttackBuildInput): number {
  if (input.mode !== 'pvp' || input.firstBloodClaimed) {
    return 0;
  }

  if (input.profile.preferredCategory === 'EXTRACTION') {
    return 6;
  }

  if (input.profile.preferredCategory === 'BREACH' || input.profile.preferredCategory === 'DEBT') {
    return 4;
  }

  if (input.profile.preferredCategory === 'LOCK' || input.profile.preferredCategory === 'DRAIN') {
    return 2;
  }

  return 1;
}

function resolveTargetEntity(mode: ModeCode, profile: BotProfile): AttackTargetEntity {
  const categoryDefault = CATEGORY_TARGET_ENTITY_BY_MODE[mode][profile.preferredCategory];

  if (mode === 'pvp') {
    if (profile.preferredTargetEntity === 'OPPONENT') {
      return 'OPPONENT';
    }

    if (profile.preferredTargetEntity === 'PLAYER') {
      return 'PLAYER';
    }

    return categoryDefault;
  }

  if (mode === 'coop') {
    if (profile.preferredTargetEntity === 'TEAM') {
      return 'TEAM';
    }

    if (profile.preferredTargetEntity === 'OPPONENT') {
      return categoryDefault;
    }

    return profile.preferredCategory === 'HEAT' || profile.preferredCategory === 'BREACH'
      ? 'TEAM'
      : 'PLAYER';
  }

  if (mode === 'ghost') {
    return 'PLAYER';
  }

  if (profile.preferredTargetEntity === 'PLAYER') {
    return 'PLAYER';
  }

  return categoryDefault;
}

function resolveTargetLayer(mode: ModeCode, profile: BotProfile): AttackLayerTarget {
  const preferredLayer = profile.preferredLayer;

  if (preferredLayer !== 'DIRECT') {
    if (mode === 'pvp' && profile.preferredCategory === 'EXTRACTION') {
      return preferredLayer;
    }

    if (mode === 'ghost' && profile.preferredCategory === 'BREACH' && preferredLayer === 'L3') {
      return 'L4';
    }

    return preferredLayer;
  }

  return CATEGORY_LAYER_FALLBACK_BY_MODE[mode][profile.preferredCategory] ?? CATEGORY_DEFAULT_LAYER[profile.preferredCategory];
}

function resolveTargetBias(targetEntity: AttackTargetEntity, targetLayer: AttackLayerTarget): number {
  let bias = 0;

  if (targetEntity === 'OPPONENT') {
    bias += 2.5;
  }

  if (targetEntity === 'TEAM') {
    bias += 1.75;
  }

  if (targetLayer === 'DIRECT') {
    bias += 1.9;
  } else if (targetLayer === 'L4') {
    bias += 2.4;
  } else if (targetLayer === 'L3') {
    bias += 1.7;
  } else if (targetLayer === 'L2') {
    bias += 1.25;
  } else if (targetLayer === 'L1') {
    bias += 0.95;
  }

  return roundTo(bias, 3);
}

function collapseDiagnosticNotes(notes: readonly string[]): string[] {
  const seen = new Set<string>();
  const collapsed: string[] = [];

  for (const note of notes) {
    const normalized = note.trim();

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    collapsed.push(normalized);
  }

  return collapsed;
}

function createMagnitudeBreakdown(
  input: AttackBuildInput,
  targetEntity: AttackTargetEntity,
  targetLayer: AttackLayerTarget,
): MagnitudeBreakdown {
  const normalizedPressure = clamp(input.pressureScore, 0, 1);
  const normalizedThreat = normalizeThreatScore(input.compositeThreat);
  const normalizedAggression = normalizeAggression(input.profile.aggression);

  const pressureCurve = resolvePressureCurve(normalizedPressure);
  const threatCurve = resolveThreatCurve(normalizedThreat);
  const aggressionCurve = resolveAggressionCurve(normalizedAggression);
  const profileBias = resolveProfileBias(input.profile);
  const modeBias = resolveModeBias(input.mode, input.profile);
  const categoryBias = resolveCategoryBias(input.profile.preferredCategory, input.mode);
  const cadenceBias = resolveCadenceBias(input.profile);
  const targetBias = resolveTargetBias(targetEntity, targetLayer);
  const firstStrikeBonus = resolveFirstStrikeBonus(input);
  const directnessBias = resolveDirectnessBias(input.profile.preferredCategory, targetLayer);

  const subtotal =
    pressureCurve +
    threatCurve +
    aggressionCurve +
    profileBias +
    modeBias +
    categoryBias +
    cadenceBias +
    targetBias +
    firstStrikeBonus +
    directnessBias;

  const scaled = subtotal * CATEGORY_SCALAR[input.profile.preferredCategory] * MODE_SCALAR[input.mode];
  const floor = CATEGORY_MAGNITUDE_FLOOR[input.profile.preferredCategory];
  const cap = CATEGORY_MAGNITUDE_CAP[input.profile.preferredCategory];
  const clamped = clamp(Math.round(scaled), floor, cap);

  return {
    normalizedPressure,
    normalizedThreat,
    normalizedAggression,
    pressureCurve: roundTo(pressureCurve, 3),
    threatCurve: roundTo(threatCurve, 3),
    aggressionCurve: roundTo(aggressionCurve, 3),
    profileBias,
    modeBias,
    categoryBias,
    cadenceBias,
    targetBias,
    firstStrikeBonus,
    directnessBias,
    subtotal: roundTo(subtotal, 3),
    scaled: roundTo(scaled, 3),
    clamped,
  };
}

function buildAttackNotes(
  input: AttackBuildInput,
  targetEntity: AttackTargetEntity,
  targetLayer: AttackLayerTarget,
  breakdown: MagnitudeBreakdown,
): string[] {
  const pressureBand = resolvePressureBand(breakdown.normalizedPressure);
  const threatBand = resolveThreatBand(breakdown.normalizedThreat);
  const profileNotes = input.profile.notes.slice(0, 4).map((note) => `profile:${sanitizeToken(note)}`);
  const targetReason =
    targetLayer === 'DIRECT'
      ? `target-layer:direct-${sanitizeToken(input.profile.preferredCategory)}`
      : `target-layer:${targetLayer.toLowerCase()}`;

  const notes = collapseDiagnosticNotes([
    input.profile.label,
    input.profile.archetype,
    MODE_TARGETING_NOTE[input.mode],
    CATEGORY_TACTICAL_NOTE[input.profile.preferredCategory],
    `pressure:${formatFixed(breakdown.normalizedPressure)}`,
    `pressure-band:${pressureBand.toLowerCase()}`,
    `threat:${Math.round(input.compositeThreat)}`,
    `threat-band:${threatBand.toLowerCase()}`,
    `aggression:${formatFixed(breakdown.normalizedAggression)}`,
    `weights:p${formatFixed(input.profile.pressureWeight)}|h${formatFixed(input.profile.heatWeight)}|r${formatFixed(input.profile.rivalryWeight)}`,
    `mode-bias:${formatFixed(breakdown.modeBias)}`,
    `category-bias:${formatFixed(breakdown.categoryBias)}`,
    `cadence-bias:${formatFixed(breakdown.cadenceBias)}`,
    `profile-bias:${formatFixed(breakdown.profileBias)}`,
    `target-bias:${formatFixed(breakdown.targetBias)}`,
    `directness-bias:${formatFixed(breakdown.directnessBias)}`,
    `curve:p${formatFixed(breakdown.pressureCurve)}|t${formatFixed(breakdown.threatCurve)}|a${formatFixed(breakdown.aggressionCurve)}`,
    `subtotal:${formatFixed(breakdown.subtotal)}`,
    `scaled:${formatFixed(breakdown.scaled)}`,
    `magnitude:${String(breakdown.clamped)}`,
    `cooldown:${String(input.profile.cooldownTicks)}`,
    `windows:w${String(input.profile.watchWindow)}|t${String(input.profile.targetWindow)}`,
    `target-entity:${targetEntity.toLowerCase()}`,
    targetReason,
    ...(breakdown.firstStrikeBonus > 0 ? [`first-strike:+${String(breakdown.firstStrikeBonus)}`] : []),
    ...profileNotes,
  ]);

  return notes;
}

function resolveFinalTargetEntity(
  mode: ModeCode,
  profile: BotProfile,
  categoryEntity: AttackTargetEntity,
): AttackTargetEntity {
  if (mode === 'pvp') {
    if (profile.preferredTargetEntity === 'TEAM') {
      return 'OPPONENT';
    }

    return categoryEntity;
  }

  if (mode === 'solo' || mode === 'ghost') {
    return 'PLAYER';
  }

  if (mode === 'coop' && isSameEntity(categoryEntity, 'PLAYER') && profile.preferredTargetEntity === 'TEAM') {
    return 'TEAM';
  }

  return categoryEntity;
}

export class AttackInjector {
  public create(input: AttackBuildInput): AttackEvent {
    const attackId = buildAttackId(input);
    const categoryEntity = resolveTargetEntity(input.mode, input.profile);
    const targetEntity = resolveFinalTargetEntity(input.mode, input.profile, categoryEntity);
    const targetLayer = resolveTargetLayer(input.mode, input.profile);
    const breakdown = createMagnitudeBreakdown(input, targetEntity, targetLayer);
    const notes = buildAttackNotes(input, targetEntity, targetLayer, breakdown);

    return {
      attackId,
      source: input.profile.botId,
      targetEntity,
      targetLayer,
      category: input.profile.preferredCategory,
      magnitude: breakdown.clamped,
      createdAtTick: input.tick,
      notes,
    };
  }
}
