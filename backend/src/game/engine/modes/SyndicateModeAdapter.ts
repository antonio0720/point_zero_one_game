/**
 * POINT ZERO ONE — SYNDICATE / TEAM UP MODE ADAPTER
 * backend/src/game/engine/modes/SyndicateModeAdapter.ts
 *
 * Doctrine:
 * - co-op is treasury + trust + betrayal pressure
 * - role doctrine must be represented in authoritative state
 * - full synergy must create a real run advantage
 * - cascade absorption and defection must have mechanical consequences
 * - every transformation must remain deterministic and serialization-safe
 * - tags are authoritative receipts, not decorative metadata
 */

import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type {
  ModeActionId,
  ModeAdapter,
  ModeConfigureOptions,
  TeamRoleId,
} from './ModeContracts';

const ROLE_IDS: readonly TeamRoleId[] = [
  'INCOME_BUILDER',
  'SHIELD_ARCHITECT',
  'OPPORTUNITY_HUNTER',
  'COUNTER_INTEL',
] as const;

const TAGS = {
  mode: 'mode:syndicate',
  sharedTreasury: 'shared_treasury:enabled',
  defection: 'defection:enabled',
  roleLock: 'role_lock:enabled',
  fullSynergy: 'coop:full_synergy',
  firstCascadeAbsorb: 'coop:first_cascade_absorb_available',
  trustFracture: 'coop:trust_fracture',
  trustPeak: 'coop:trust_peak',
  treasuryStress: 'coop:treasury_stress',
  treasuryStable: 'coop:treasury_stable',
  treasuryHealthy: 'coop:treasury_healthy',
  cascadeAbsorbed: 'coop:cascade_absorbed',
  defectionCommitted: 'coop:defection_committed',
  loanOutstanding: 'coop:loan_outstanding',
  rolesNormalized: 'coop:roles_normalized',
  counterIntelOnline: 'coop:counter_intel_online',
  shieldDoctrineOnline: 'coop:shield_doctrine_online',
  incomeDoctrineOnline: 'coop:income_doctrine_online',
  opportunityDoctrineOnline: 'coop:opportunity_doctrine_online',
  sharedTreasurySynchronized: 'coop:shared_treasury_sync',
  betrayalRiskRising: 'coop:betrayal_risk_rising',
  betrayalRecovered: 'coop:betrayal_recovered',
  defectionPressure: 'coop:defection_pressure',
} as const;

const TAG_PREFIX = {
  defectionStep: 'coop:defection_step',
  loanOutstandingAmount: 'coop:loan_outstanding_amount',
  lastLoanApproved: 'coop:last_loan_approved',
  absorptions: 'coop:absorptions',
  trustAverage: 'coop:trust_average',
  trustMin: 'coop:trust_min',
  trustMax: 'coop:trust_max',
  trustDelta: 'coop:trust_delta',
  players: 'coop:players',
  counterIntelTier: 'coop:counter_intel_tier',
  treasuryBand: 'coop:treasury_band',
  treasuryBalance: 'coop:treasury_balance',
  heatModifier: 'coop:community_heat_modifier',
} as const;

const BADGES = {
  fullSynergy: 'FULL_SYNERGY',
  cascadeAbsorber: 'CASCADE_ABSORBER',
  betrayalSurvivor: 'BETRAYAL_SURVIVOR',
  trustArchitect: 'TRUST_ARCHITECT',
  treasurySteward: 'TREASURY_STEWARD',
  counterIntelMesh: 'COUNTER_INTEL_MESH',
} as const;

const NUMERIC_LIMITS = {
  baseTrust: 70,
  trustMin: 0,
  trustMax: 100,
  trustFractureThreshold: 45,
  trustPeakThreshold: 85,
  trustRecoveryThreshold: 50,
  treasuryFloor: 30_000,
  synergyTreasuryBonus: 8_000,
  synergyShieldMultiplier: 1.10,
  lowTreasuryAbsoluteThreshold: 5_000,
  treasuryRunwayMultiplier: 3,
  loanCapRatio: 0.25,
  defectionSplitRemainingRatio: 0.65,
  absorptionSovereigntyBonus: 0.05,
  trustHeatPenalty: 1,
  defectionHeatPenalty: 1,
  defectionTrustPenalty: 8,
  postDefectionCommunityHeatBonus: 1,
  stableCommunityHeatBonus: 0,
  healthyTreasuryRunwayMultiplier: 6,
  treasuryHealthyAbsoluteThreshold: 10_000,
} as const;

const ZERO = 0;

type RoleAssignments = Readonly<Record<string, TeamRoleId>>;
type MutableRoleAssignments = Record<string, TeamRoleId>;
type TrustScores = Readonly<Record<string, number>>;
type MutableTrustScores = Record<string, number>;
type DefectionSteps = Readonly<Record<string, number>>;
type MutableDefectionSteps = Record<string, number>;

interface SyndicateAudit {
  readonly playerIds: readonly string[];
  readonly averageTrust: number;
  readonly minimumTrust: number;
  readonly maximumTrust: number;
  readonly trustSpread: number;
  readonly activeDefectionCount: number;
  readonly completedDefectionCount: number;
  readonly treasuryBalance: number;
  readonly treasuryStressThreshold: number;
  readonly treasuryRunwayTicks: number;
  readonly treasuryBand: 'BROKE' | 'TIGHT' | 'STABLE' | 'HEALTHY';
  readonly underTreasuryStress: boolean;
  readonly criticallyPressured: boolean;
  readonly cascadeStabilizing: boolean;
  readonly roleAssignments: RoleAssignments;
  readonly fullSynergy: boolean;
  readonly counterIntelTier: number;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > ZERO))];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundScore(value: number, precision = 6): number {
  return Number(value.toFixed(precision));
}

function floorCurrency(value: number): number {
  return Math.floor(Number.isFinite(value) ? value : ZERO);
}

function positiveIntegerOrZero(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return ZERO;
  }

  return Math.max(ZERO, Math.floor(value));
}

function removeTagsByPrefix(tags: readonly string[], prefix: string): string[] {
  return tags.filter((tag) => !tag.startsWith(prefix));
}

function removeTag(tags: readonly string[], tagToRemove: string): string[] {
  return tags.filter((tag) => tag !== tagToRemove);
}

function hasTag(tags: readonly string[], tag: string): boolean {
  return tags.includes(tag);
}

function withUniqueTag(tags: readonly string[], tag: string): string[] {
  return uniqueStrings([...tags, tag]);
}

function withoutUniqueTag(tags: readonly string[], tag: string): string[] {
  return uniqueStrings(removeTag(tags, tag));
}

function readNumericTag(tags: readonly string[], prefix: string): number | null {
  const entry = tags.find((tag) => tag.startsWith(`${prefix}:`));
  if (!entry) {
    return null;
  }

  const value = Number(entry.slice(prefix.length + 1));
  return Number.isFinite(value) ? value : null;
}

function upsertNumericTag(tags: readonly string[], prefix: string, value: number): string[] {
  return [...removeTagsByPrefix(tags, `${prefix}:`), `${prefix}:${value}`];
}

function withTags(snapshot: RunStateSnapshot, tags: readonly string[]): RunStateSnapshot {
  return {
    ...snapshot,
    tags: uniqueStrings(tags),
  };
}

function upsertSnapshotNumericTag(
  snapshot: RunStateSnapshot,
  prefix: string,
  value: number,
): RunStateSnapshot {
  return withTags(snapshot, upsertNumericTag(snapshot.tags, prefix, value));
}

function removeSnapshotTag(snapshot: RunStateSnapshot, tag: string): RunStateSnapshot {
  return withTags(snapshot, withoutUniqueTag(snapshot.tags, tag));
}

function addSnapshotTag(snapshot: RunStateSnapshot, tag: string): RunStateSnapshot {
  return withTags(snapshot, withUniqueTag(snapshot.tags, tag));
}

function normalizePlayerIds(
  userId: string,
  teammateUserIds?: readonly string[],
): readonly string[] {
  return uniqueStrings([userId, ...(teammateUserIds ?? [])]);
}

function rotateRole(index: number): TeamRoleId {
  return ROLE_IDS[index % ROLE_IDS.length];
}

function normalizeRoleAssignments(
  playerIds: readonly string[],
  provided?: Readonly<Record<string, TeamRoleId>>,
): RoleAssignments {
  const next: MutableRoleAssignments = {};

  for (const [index, playerId] of playerIds.entries()) {
    next[playerId] = provided?.[playerId] ?? rotateRole(index);
  }

  return next;
}

function hasFullSynergy(roleAssignments: Readonly<Record<string, string>>): boolean {
  const values = new Set(Object.values(roleAssignments));
  return ROLE_IDS.every((roleId) => values.has(roleId));
}

function buildTrustScores(playerIds: readonly string[], baseTrust: number): MutableTrustScores {
  const next: MutableTrustScores = {};

  for (const playerId of playerIds) {
    next[playerId] = baseTrust;
  }

  return next;
}

function buildDefectionSteps(playerIds: readonly string[]): MutableDefectionSteps {
  const next: MutableDefectionSteps = {};

  for (const playerId of playerIds) {
    next[playerId] = ZERO;
  }

  return next;
}

function computeCounterIntelTier(roleAssignments: RoleAssignments): number {
  return Object.values(roleAssignments).filter((role) => role === 'COUNTER_INTEL').length;
}

function computeTreasuryStressThreshold(snapshot: RunStateSnapshot): number {
  return Math.max(
    NUMERIC_LIMITS.lowTreasuryAbsoluteThreshold,
    floorCurrency(snapshot.economy.expensesPerTick * NUMERIC_LIMITS.treasuryRunwayMultiplier),
  );
}

function computeHealthyTreasuryThreshold(snapshot: RunStateSnapshot): number {
  return Math.max(
    NUMERIC_LIMITS.treasuryHealthyAbsoluteThreshold,
    floorCurrency(snapshot.economy.expensesPerTick * NUMERIC_LIMITS.healthyTreasuryRunwayMultiplier),
  );
}

function computeTreasuryRunwayTicks(snapshot: RunStateSnapshot): number {
  if (snapshot.economy.expensesPerTick <= ZERO) {
    return Number.MAX_SAFE_INTEGER;
  }

  return floorCurrency(snapshot.modeState.sharedTreasuryBalance / snapshot.economy.expensesPerTick);
}

function computeTreasuryBand(snapshot: RunStateSnapshot): 'BROKE' | 'TIGHT' | 'STABLE' | 'HEALTHY' {
  const balance = snapshot.modeState.sharedTreasuryBalance;
  const stressed = computeTreasuryStressThreshold(snapshot);
  const healthy = computeHealthyTreasuryThreshold(snapshot);

  if (balance <= NUMERIC_LIMITS.lowTreasuryAbsoluteThreshold) {
    return 'BROKE';
  }

  if (balance <= stressed) {
    return 'TIGHT';
  }

  if (balance >= healthy) {
    return 'HEALTHY';
  }

  return 'STABLE';
}

function normalizeEconomyToTreasury(snapshot: RunStateSnapshot, treasuryBalance: number): RunStateSnapshot {
  const normalizedTreasury = Math.max(ZERO, floorCurrency(treasuryBalance));
  const priorCash = snapshot.economy.cash;
  const cashDelta = normalizedTreasury - priorCash;

  return {
    ...snapshot,
    economy: {
      ...snapshot.economy,
      cash: normalizedTreasury,
      netWorth: snapshot.economy.netWorth + cashDelta,
    },
    modeState: {
      ...snapshot.modeState,
      sharedTreasuryBalance: normalizedTreasury,
    },
  };
}

function recalcShield(snapshot: RunStateSnapshot): RunStateSnapshot {
  const layers = snapshot.shield.layers.map((layer) => {
    const current = clamp(layer.current, ZERO, layer.max);
    const integrityRatio = layer.max <= ZERO ? ZERO : current / layer.max;

    return {
      ...layer,
      current,
      breached: current <= ZERO,
      integrityRatio,
    };
  });

  const weakest = layers.reduce((lowest, current) =>
    current.integrityRatio < lowest.integrityRatio ? current : lowest,
  );

  return {
    ...snapshot,
    shield: {
      ...snapshot.shield,
      layers,
      weakestLayerId: weakest.layerId,
      weakestLayerRatio: weakest.integrityRatio,
      repairQueueDepth: layers.filter((layer) => layer.current < layer.max).length,
    },
  };
}

function boostShieldForSynergy(snapshot: RunStateSnapshot): RunStateSnapshot {
  const shieldBoosted: RunStateSnapshot = {
    ...snapshot,
    shield: {
      ...snapshot.shield,
      layers: snapshot.shield.layers.map((layer) => ({
        ...layer,
        current: Math.round(layer.current * NUMERIC_LIMITS.synergyShieldMultiplier),
        max: Math.round(layer.max * NUMERIC_LIMITS.synergyShieldMultiplier),
      })),
    },
  };

  return recalcShield(shieldBoosted);
}

function summarizeTrust(trustScores: TrustScores): {
  readonly averageTrust: number;
  readonly minimumTrust: number;
  readonly maximumTrust: number;
  readonly trustSpread: number;
} {
  const values = Object.values(trustScores);

  if (values.length === ZERO) {
    return {
      averageTrust: ZERO,
      minimumTrust: ZERO,
      maximumTrust: ZERO,
      trustSpread: ZERO,
    };
  }

  const total = values.reduce((sum, value) => sum + value, ZERO);
  const minimumTrust = Math.min(...values);
  const maximumTrust = Math.max(...values);

  return {
    averageTrust: total / values.length,
    minimumTrust,
    maximumTrust,
    trustSpread: maximumTrust - minimumTrust,
  };
}

function countDefections(defectionSteps: DefectionSteps): {
  readonly activeDefectionCount: number;
  readonly completedDefectionCount: number;
} {
  const values = Object.values(defectionSteps);
  return {
    activeDefectionCount: values.filter((value) => value > ZERO).length,
    completedDefectionCount: values.filter((value) => value >= 3).length,
  };
}

function auditSyndicateState(snapshot: RunStateSnapshot): SyndicateAudit {
  const playerIds = uniqueStrings([
    snapshot.userId,
    ...Object.keys(snapshot.modeState.trustScores),
    ...Object.keys(snapshot.modeState.roleAssignments),
    ...Object.keys(snapshot.modeState.defectionStepByPlayer),
  ]);

  const trustSummary = summarizeTrust(snapshot.modeState.trustScores);
  const defectionSummary = countDefections(snapshot.modeState.defectionStepByPlayer);
  const treasuryStressThreshold = computeTreasuryStressThreshold(snapshot);
  const treasuryBand = computeTreasuryBand(snapshot);
  const treasuryRunwayTicks = computeTreasuryRunwayTicks(snapshot);
  const criticallyPressured = snapshot.pressure.tier === 'T3' || snapshot.pressure.tier === 'T4';
  const cascadeStabilizing =
    snapshot.cascade.completedChains > snapshot.cascade.brokenChains &&
    snapshot.shield.weakestLayerRatio >= 0.60;
  const roleAssignments = normalizeRoleAssignments(playerIds, snapshot.modeState.roleAssignments as RoleAssignments);

  return {
    playerIds,
    averageTrust: trustSummary.averageTrust,
    minimumTrust: trustSummary.minimumTrust,
    maximumTrust: trustSummary.maximumTrust,
    trustSpread: trustSummary.trustSpread,
    activeDefectionCount: defectionSummary.activeDefectionCount,
    completedDefectionCount: defectionSummary.completedDefectionCount,
    treasuryBalance: snapshot.modeState.sharedTreasuryBalance,
    treasuryStressThreshold,
    treasuryRunwayTicks,
    treasuryBand,
    underTreasuryStress: snapshot.modeState.sharedTreasuryBalance <= treasuryStressThreshold,
    criticallyPressured,
    cascadeStabilizing,
    roleAssignments,
    fullSynergy: hasFullSynergy(roleAssignments),
    counterIntelTier: computeCounterIntelTier(roleAssignments),
  };
}

function writeAuditTags(snapshot: RunStateSnapshot, audit: SyndicateAudit, trustDelta: number): RunStateSnapshot {
  let next = snapshot;

  next = withTags(next, [
    ...removeTagsByPrefix(next.tags, `${TAG_PREFIX.players}:`),
    `${TAG_PREFIX.players}:${audit.playerIds.length}`,
  ]);
  next = withTags(next, upsertNumericTag(next.tags, TAG_PREFIX.counterIntelTier, audit.counterIntelTier));
  next = withTags(next, upsertNumericTag(next.tags, TAG_PREFIX.trustAverage, Math.round(audit.averageTrust)));
  next = withTags(next, upsertNumericTag(next.tags, TAG_PREFIX.trustMin, Math.round(audit.minimumTrust)));
  next = withTags(next, upsertNumericTag(next.tags, TAG_PREFIX.trustMax, Math.round(audit.maximumTrust)));
  next = withTags(next, upsertNumericTag(next.tags, TAG_PREFIX.trustDelta, trustDelta));
  next = withTags(next, upsertNumericTag(next.tags, TAG_PREFIX.treasuryBalance, audit.treasuryBalance));
  next = withTags(next, [
    ...removeTagsByPrefix(next.tags, `${TAG_PREFIX.treasuryBand}:`),
    `${TAG_PREFIX.treasuryBand}:${audit.treasuryBand}`,
  ]);
  next = withTags(next, upsertNumericTag(next.tags, TAG_PREFIX.heatModifier, next.modeState.communityHeatModifier));

  return next;
}

function applyCommunityHeat(snapshot: RunStateSnapshot, modifier: number): RunStateSnapshot {
  return {
    ...snapshot,
    modeState: {
      ...snapshot.modeState,
      communityHeatModifier: modifier,
    },
  };
}

function applyTreasuryBandTags(snapshot: RunStateSnapshot, band: SyndicateAudit['treasuryBand']): RunStateSnapshot {
  let next = removeSnapshotTag(removeSnapshotTag(removeSnapshotTag(snapshot, TAGS.treasuryStress), TAGS.treasuryStable), TAGS.treasuryHealthy);

  if (band === 'BROKE' || band === 'TIGHT') {
    next = addSnapshotTag(next, TAGS.treasuryStress);
    return next;
  }

  if (band === 'HEALTHY') {
    next = addSnapshotTag(next, TAGS.treasuryHealthy);
    return next;
  }

  return addSnapshotTag(next, TAGS.treasuryStable);
}

function applyRoleDoctrineTags(snapshot: RunStateSnapshot, roles: RoleAssignments): RunStateSnapshot {
  let next = snapshot;
  const roleSet = new Set(Object.values(roles));

  if (roleSet.has('COUNTER_INTEL')) {
    next = addSnapshotTag(next, TAGS.counterIntelOnline);
  }

  if (roleSet.has('SHIELD_ARCHITECT')) {
    next = addSnapshotTag(next, TAGS.shieldDoctrineOnline);
  }

  if (roleSet.has('INCOME_BUILDER')) {
    next = addSnapshotTag(next, TAGS.incomeDoctrineOnline);
  }

  if (roleSet.has('OPPORTUNITY_HUNTER')) {
    next = addSnapshotTag(next, TAGS.opportunityDoctrineOnline);
  }

  return next;
}

function applyTrustScores(snapshot: RunStateSnapshot, trustScores: MutableTrustScores): RunStateSnapshot {
  return {
    ...snapshot,
    modeState: {
      ...snapshot.modeState,
      trustScores,
    },
  };
}

function applyDefectionSteps(snapshot: RunStateSnapshot, defectionStepByPlayer: MutableDefectionSteps): RunStateSnapshot {
  return {
    ...snapshot,
    modeState: {
      ...snapshot.modeState,
      defectionStepByPlayer,
    },
  };
}

function applyRoleAssignments(snapshot: RunStateSnapshot, roleAssignments: RoleAssignments): RunStateSnapshot {
  return {
    ...snapshot,
    modeState: {
      ...snapshot.modeState,
      roleAssignments,
      counterIntelTier: computeCounterIntelTier(roleAssignments),
    },
  };
}

function integerPayloadAmount(payload?: Readonly<Record<string, unknown>>): number {
  return positiveIntegerOrZero(payload?.amount);
}

function currentOutstandingLoanAmount(snapshot: RunStateSnapshot): number {
  return readNumericTag(snapshot.tags, TAG_PREFIX.loanOutstandingAmount) ?? ZERO;
}

function applySharedTreasuryLoan(snapshot: RunStateSnapshot, approvedAmount: number): RunStateSnapshot {
  const nextOutstandingAmount = currentOutstandingLoanAmount(snapshot) + approvedAmount;
  let next = normalizeEconomyToTreasury(
    snapshot,
    snapshot.modeState.sharedTreasuryBalance - approvedAmount,
  );

  next = withTags(next, uniqueStrings([
    ...next.tags,
    TAGS.loanOutstanding,
  ]));
  next = withTags(next, upsertNumericTag(next.tags, TAG_PREFIX.loanOutstandingAmount, nextOutstandingAmount));
  next = withTags(next, upsertNumericTag(next.tags, TAG_PREFIX.lastLoanApproved, approvedAmount));

  return next;
}

function applyCascadeAbsorption(snapshot: RunStateSnapshot): RunStateSnapshot {
  if (snapshot.cascade.activeChains.length === ZERO) {
    return snapshot;
  }

  const absorbedCount = (readNumericTag(snapshot.tags, TAG_PREFIX.absorptions) ?? ZERO) + 1;

  let next: RunStateSnapshot = {
    ...snapshot,
    cascade: {
      ...snapshot.cascade,
      activeChains: snapshot.cascade.activeChains.slice(1),
      brokenChains: snapshot.cascade.brokenChains + 1,
    },
    sovereignty: {
      ...snapshot.sovereignty,
      sovereigntyScore: roundScore(
        snapshot.sovereignty.sovereigntyScore + NUMERIC_LIMITS.absorptionSovereigntyBonus,
      ),
    },
  };

  next = addSnapshotTag(next, TAGS.cascadeAbsorbed);
  next = withTags(next, upsertNumericTag(next.tags, TAG_PREFIX.absorptions, absorbedCount));

  if (hasTag(next.tags, TAGS.firstCascadeAbsorb)) {
    next = removeSnapshotTag(next, TAGS.firstCascadeAbsorb);
  }

  return next;
}

function applyDefectionStep(snapshot: RunStateSnapshot, userId: string): RunStateSnapshot {
  const currentStep = snapshot.modeState.defectionStepByPlayer[userId] ?? ZERO;
  const nextStep = clamp(currentStep + 1, ZERO, 3);

  let next = applyDefectionSteps(snapshot, {
    ...snapshot.modeState.defectionStepByPlayer,
    [userId]: nextStep,
  });

  next = withTags(next, [
    ...removeTagsByPrefix(next.tags, `${TAG_PREFIX.defectionStep}:`),
    `${TAG_PREFIX.defectionStep}:${nextStep}`,
  ]);

  if (nextStep > ZERO) {
    next = addSnapshotTag(next, TAGS.defectionPressure);
  }

  if (nextStep < 3) {
    return next;
  }

  const postSplitTreasury = floorCurrency(
    snapshot.modeState.sharedTreasuryBalance * NUMERIC_LIMITS.defectionSplitRemainingRatio,
  );

  const penalizedTrustScores: MutableTrustScores = {};
  for (const [playerId, trust] of Object.entries(next.modeState.trustScores)) {
    if (playerId === userId) {
      penalizedTrustScores[playerId] = clamp(trust, NUMERIC_LIMITS.trustMin, NUMERIC_LIMITS.trustMax);
      continue;
    }

    penalizedTrustScores[playerId] = clamp(
      trust - NUMERIC_LIMITS.defectionTrustPenalty,
      NUMERIC_LIMITS.trustMin,
      NUMERIC_LIMITS.trustMax,
    );
  }

  next = applyTrustScores(next, penalizedTrustScores);
  next = normalizeEconomyToTreasury(next, postSplitTreasury);
  next = addSnapshotTag(next, TAGS.defectionCommitted);
  next = addSnapshotTag(next, TAGS.betrayalRiskRising);
  next = applyCommunityHeat(
    next,
    next.modeState.communityHeatModifier + NUMERIC_LIMITS.postDefectionCommunityHeatBonus,
  );
  next = {
    ...next,
    economy: {
      ...next.economy,
      haterHeat: next.economy.haterHeat + NUMERIC_LIMITS.defectionHeatPenalty,
    },
  };

  return next;
}

export class SyndicateModeAdapter implements ModeAdapter {
  public readonly modeCode = 'coop' as const;

  public configure(
    snapshot: RunStateSnapshot,
    options?: ModeConfigureOptions,
  ): RunStateSnapshot {
    const playerIds = normalizePlayerIds(snapshot.userId, options?.teammateUserIds);
    const baseTrust = clamp(
      positiveIntegerOrZero(options?.initialTrustScore ?? NUMERIC_LIMITS.baseTrust),
      NUMERIC_LIMITS.trustMin,
      NUMERIC_LIMITS.trustMax,
    );
    const roleAssignments = normalizeRoleAssignments(playerIds, options?.roleAssignments);
    const trustScores = buildTrustScores(playerIds, baseTrust);
    const defectionStepByPlayer = buildDefectionSteps(playerIds);
    const openingTreasuryBalance = Math.max(
      options?.sharedTreasuryStart ?? NUMERIC_LIMITS.treasuryFloor,
      snapshot.economy.cash,
    );

    let next: RunStateSnapshot = {
      ...snapshot,
      tags: uniqueStrings([
        ...snapshot.tags,
        TAGS.mode,
        TAGS.sharedTreasury,
        TAGS.defection,
        TAGS.roleLock,
        TAGS.rolesNormalized,
      ]),
      economy: {
        ...snapshot.economy,
        cash: openingTreasuryBalance,
        netWorth: snapshot.economy.netWorth + (openingTreasuryBalance - snapshot.economy.cash),
      },
      modeState: {
        ...snapshot.modeState,
        holdEnabled: false,
        loadoutEnabled: false,
        sharedTreasury: true,
        sharedTreasuryBalance: openingTreasuryBalance,
        trustScores,
        roleAssignments,
        defectionStepByPlayer,
        legendMarkersEnabled: false,
        communityHeatModifier: ZERO,
        sharedOpportunityDeck: false,
        counterIntelTier: computeCounterIntelTier(roleAssignments),
        spectatorLimit: ZERO,
        phaseBoundaryWindowsRemaining: ZERO,
        bleedMode: false,
        handicapIds: [],
        advantageId: null,
        disabledBots: [],
        modePresentation: 'syndicate',
        roleLockEnabled: true,
        extractionActionsRemaining: ZERO,
        ghostBaselineRunId: null,
        legendOwnerUserId: null,
      },
      timers: {
        ...snapshot.timers,
        holdCharges: ZERO,
      },
      battle: {
        ...snapshot.battle,
        battleBudget: ZERO,
        battleBudgetCap: ZERO,
        extractionCooldownTicks: ZERO,
        rivalryHeatCarry: ZERO,
      },
      cards: {
        ...snapshot.cards,
        ghostMarkers: [],
      },
    };

    next = applyRoleDoctrineTags(next, roleAssignments);
    next = addSnapshotTag(next, TAGS.sharedTreasurySynchronized);

    if (hasFullSynergy(roleAssignments)) {
      next = {
        ...next,
        tags: uniqueStrings([
          ...next.tags,
          TAGS.fullSynergy,
          TAGS.firstCascadeAbsorb,
        ]),
        economy: {
          ...next.economy,
          cash: next.economy.cash + NUMERIC_LIMITS.synergyTreasuryBonus,
          netWorth: next.economy.netWorth + NUMERIC_LIMITS.synergyTreasuryBonus,
        },
        modeState: {
          ...next.modeState,
          sharedTreasuryBalance:
            next.modeState.sharedTreasuryBalance + NUMERIC_LIMITS.synergyTreasuryBonus,
        },
      };

      next = boostShieldForSynergy(next);
    }

    const audit = auditSyndicateState(next);
    next = applyTreasuryBandTags(next, audit.treasuryBand);
    next = writeAuditTags(next, audit, ZERO);

    return next;
  }

  public onTickStart(snapshot: RunStateSnapshot): RunStateSnapshot {
    let next = normalizeEconomyToTreasury(snapshot, snapshot.modeState.sharedTreasuryBalance);
    next = addSnapshotTag(next, TAGS.sharedTreasurySynchronized);

    const audit = auditSyndicateState(next);
    next = applyTreasuryBandTags(next, audit.treasuryBand);
    next = writeAuditTags(next, audit, ZERO);

    return next;
  }

  public onTickEnd(snapshot: RunStateSnapshot): RunStateSnapshot {
    const auditBefore = auditSyndicateState(snapshot);
    const trustScores = { ...snapshot.modeState.trustScores };

    let trustDelta = ZERO;
    if (auditBefore.underTreasuryStress && auditBefore.criticallyPressured) {
      trustDelta = -1;
    } else if (auditBefore.cascadeStabilizing) {
      trustDelta = 1;
    }

    const nextTrustScores: MutableTrustScores = {};
    for (const [playerId, current] of Object.entries(trustScores)) {
      nextTrustScores[playerId] = clamp(
        current + trustDelta,
        NUMERIC_LIMITS.trustMin,
        NUMERIC_LIMITS.trustMax,
      );
    }

    let next = applyTrustScores(snapshot, nextTrustScores);
    next = applyRoleAssignments(next, auditBefore.roleAssignments);

    const auditAfter = auditSyndicateState(next);
    next = applyTreasuryBandTags(next, auditAfter.treasuryBand);

    if (auditAfter.averageTrust < NUMERIC_LIMITS.trustFractureThreshold) {
      next = addSnapshotTag(next, TAGS.trustFracture);
      next = removeSnapshotTag(next, TAGS.betrayalRecovered);
      next = {
        ...next,
        economy: {
          ...next.economy,
          haterHeat: next.economy.haterHeat + NUMERIC_LIMITS.trustHeatPenalty,
        },
      };
    } else if (hasTag(next.tags, TAGS.trustFracture) && auditAfter.averageTrust >= NUMERIC_LIMITS.trustRecoveryThreshold) {
      next = removeSnapshotTag(next, TAGS.trustFracture);
      next = addSnapshotTag(next, TAGS.betrayalRecovered);
    }

    if (auditAfter.averageTrust >= NUMERIC_LIMITS.trustPeakThreshold) {
      next = addSnapshotTag(next, TAGS.trustPeak);
    } else {
      next = removeSnapshotTag(next, TAGS.trustPeak);
    }

    if (auditAfter.activeDefectionCount > ZERO && auditAfter.averageTrust < NUMERIC_LIMITS.trustRecoveryThreshold) {
      next = addSnapshotTag(next, TAGS.betrayalRiskRising);
    } else if (auditAfter.averageTrust >= NUMERIC_LIMITS.trustRecoveryThreshold) {
      next = removeSnapshotTag(next, TAGS.betrayalRiskRising);
    }

    const heatModifier = auditAfter.averageTrust >= NUMERIC_LIMITS.trustPeakThreshold
      ? NUMERIC_LIMITS.stableCommunityHeatBonus
      : auditAfter.averageTrust < NUMERIC_LIMITS.trustFractureThreshold
        ? 1
        : ZERO;

    next = applyCommunityHeat(next, heatModifier);
    next = writeAuditTags(next, auditAfter, trustDelta);

    return next;
  }

  public resolveAction(
    snapshot: RunStateSnapshot,
    actionId: ModeActionId,
    payload?: Readonly<Record<string, unknown>>,
  ): RunStateSnapshot {
    switch (actionId) {
      case 'REQUEST_TREASURY_LOAN': {
        const requestedAmount = integerPayloadAmount(payload);
        if (requestedAmount <= ZERO) {
          return snapshot;
        }

        const maxLoan = floorCurrency(
          snapshot.modeState.sharedTreasuryBalance * NUMERIC_LIMITS.loanCapRatio,
        );
        const approvedAmount = Math.min(requestedAmount, maxLoan);
        if (approvedAmount <= ZERO) {
          return snapshot;
        }

        let next = applySharedTreasuryLoan(snapshot, approvedAmount);
        const audit = auditSyndicateState(next);
        next = applyTreasuryBandTags(next, audit.treasuryBand);
        next = writeAuditTags(next, audit, ZERO);
        return next;
      }

      case 'ABSORB_CASCADE': {
        let next = applyCascadeAbsorption(snapshot);
        if (next === snapshot) {
          return snapshot;
        }

        const audit = auditSyndicateState(next);
        next = writeAuditTags(next, audit, ZERO);
        return next;
      }

      case 'ADVANCE_DEFECTION': {
        let next = applyDefectionStep(snapshot, snapshot.userId);
        const audit = auditSyndicateState(next);
        next = applyTreasuryBandTags(next, audit.treasuryBand);
        next = writeAuditTags(next, audit, ZERO);
        return next;
      }

      default:
        return snapshot;
    }
  }

  public finalize(snapshot: RunStateSnapshot): RunStateSnapshot {
    const badges = new Set(snapshot.sovereignty.proofBadges);
    const absorptionCount = readNumericTag(snapshot.tags, TAG_PREFIX.absorptions) ?? ZERO;
    const audit = auditSyndicateState(snapshot);

    let multiplier = 1;

    if (hasTag(snapshot.tags, TAGS.fullSynergy) && snapshot.outcome === 'FREEDOM') {
      multiplier += 0.15;
      badges.add(BADGES.fullSynergy);
    }

    if (absorptionCount >= 3) {
      multiplier += 0.35;
      badges.add(BADGES.cascadeAbsorber);
    }

    if (hasTag(snapshot.tags, TAGS.defectionCommitted) && snapshot.outcome === 'FREEDOM') {
      multiplier += 0.20;
      badges.add(BADGES.betrayalSurvivor);
    }

    if (audit.averageTrust >= NUMERIC_LIMITS.trustPeakThreshold) {
      multiplier += 0.10;
      badges.add(BADGES.trustArchitect);
    }

    if (audit.treasuryBand === 'HEALTHY' && !hasTag(snapshot.tags, TAGS.loanOutstanding)) {
      multiplier += 0.05;
      badges.add(BADGES.treasurySteward);
    }

    if (audit.counterIntelTier > ZERO && audit.fullSynergy) {
      multiplier += 0.00;
      badges.add(BADGES.counterIntelMesh);
    }

    return {
      ...snapshot,
      sovereignty: {
        ...snapshot.sovereignty,
        cordScore: roundScore(snapshot.sovereignty.cordScore * multiplier),
        proofBadges: [...badges],
      },
    };
  }
}
