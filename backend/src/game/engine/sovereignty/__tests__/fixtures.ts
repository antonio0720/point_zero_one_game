import type { RunStateSnapshot, DecisionRecord } from '../../core/RunStateSnapshot';
import type {
  AttackEvent,
  CardDefinition,
  CardInstance,
  CascadeChainInstance,
  LegendMarker,
  ThreatEnvelope,
} from '../../core/GamePrimitives';
import type {
  SovereigntyAdapterContext,
  SovereigntyPersistenceTarget,
  SovereigntyArtifactWriteRecord,
  SovereigntyAuditWriteRecord,
  SovereigntyRunWriteRecord,
  SovereigntyTickWriteRecord,
} from '../contracts';
import { ProofGenerator } from '../ProofGenerator';

export interface InMemoryPersistenceBuckets {
  readonly ticks: SovereigntyTickWriteRecord[];
  readonly runs: SovereigntyRunWriteRecord[];
  readonly artifacts: SovereigntyArtifactWriteRecord[];
  readonly audits: SovereigntyAuditWriteRecord[];
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function deepMerge<T>(base: T, override?: Partial<T>): T {
  if (!override) {
    return deepClone(base);
  }

  const baseClone = deepClone(base) as unknown;

  const merge = (left: unknown, right: unknown): unknown => {
    if (Array.isArray(right)) {
      return deepClone(right);
    }

    if (isPlainObject(left) && isPlainObject(right)) {
      const output: Record<string, unknown> = { ...left };
      for (const [key, value] of Object.entries(right)) {
        output[key] = key in output ? merge(output[key], value) : deepClone(value);
      }
      return output;
    }

    return deepClone(right);
  };

  return merge(baseClone, override) as T;
}

export function createCardDefinition(id = 'card-1'): CardDefinition {
  return {
    id,
    name: `Card ${id}`,
    deckType: 'OPPORTUNITY',
    baseCost: 100,
    baseEffect: {
      cashDelta: 250,
      incomePerTickDelta: 10,
    },
    tags: ['income', 'starter'],
    timingClass: ['ANY'],
    rarity: 'COMMON',
    autoResolve: false,
    counterability: 'SOFT',
    targeting: 'SELF',
    decisionTimerOverrideMs: null,
    decayTicks: null,
    modeLegal: ['solo', 'pvp', 'coop', 'ghost'],
    educationalTag: 'cashflow',
  } as unknown as CardDefinition;
}

export function createCardInstance(
  id = 'ci-1',
  tags: string[] = ['income', 'starter'],
): CardInstance {
  return {
    instanceId: id,
    definitionId: 'card-1',
    card: createCardDefinition('card-1'),
    cost: 100,
    targeting: 'SELF',
    timingClass: ['ANY'],
    tags,
    overlayAppliedForMode: 'coop',
    decayTicksRemaining: null,
    divergencePotential: 'LOW',
  } as unknown as CardInstance;
}

export function createThreat(id = 'th-1'): ThreatEnvelope {
  return {
    threatId: id,
    source: 'BOT_01',
    etaTicks: 2,
    severity: 1,
    visibleAs: 'HIDDEN',
    summary: 'Incoming threat',
  } as unknown as ThreatEnvelope;
}

export function createLegendMarker(id = 'lm-1'): LegendMarker {
  return {
    markerId: id,
    tick: 5,
    kind: 'GOLD',
    cardId: null,
    summary: 'Legend moved here',
  } as unknown as LegendMarker;
}

export function createAttack(id = 'atk-1'): AttackEvent {
  return {
    attackId: id,
    source: 'BOT_01',
    targetEntity: 'TEAM',
    targetLayer: 'L1',
    category: 'HEAT',
    magnitude: 5,
    createdAtTick: 0,
    notes: ['test'],
  } as unknown as AttackEvent;
}

export function createCascadeChain(id = 'chain-1'): CascadeChainInstance {
  return {
    chainId: id,
    templateId: 'LIQUIDITY_SPIRAL',
    trigger: 'shield:L1',
    positive: false,
    status: 'ACTIVE',
    createdAtTick: 1,
    recoveryTags: ['income'],
    links: [
      {
        linkId: 'link-1',
        scheduledTick: 2,
        effect: {
          cashDelta: -500,
          heatDelta: 1,
        },
        summary: 'Chain step 1',
      },
    ],
  } as unknown as CascadeChainInstance;
}

export function createDecision(
  tick = 0,
  accepted = true,
  latencyMs = 280,
): DecisionRecord {
  return {
    tick,
    actorId: 'user-1',
    cardId: 'card-1',
    latencyMs,
    accepted,
    timingClass: ['ANY'],
    responseWindowMs: 1_000,
    source: 'PLAYER',
    target: 'SELF',
  } as unknown as DecisionRecord;
}

export function createAdapterContext(
  override: Partial<SovereigntyAdapterContext> = {},
): SovereigntyAdapterContext {
  return {
    startedAtMs: 1_700_000_000_000,
    completedAtMs: 1_700_000_010_000,
    clientVersion: 'vitest-client',
    engineVersion: 'vitest-engine',
    playerHandle: 'Antonio',
    seasonTickBudget: 720,
    artifactBaseUrl: 'https://example.com/pzo/artifacts',
    artifactFormat: 'JSON',
    extraTags: ['test-run', 'sovereignty'],
    ...override,
  };
}

export function createBusMock(): {
  readonly events: Array<{ readonly event: string; readonly payload: unknown }>;
  emit: (event: string, payload: unknown) => void;
} {
  const events: Array<{ readonly event: string; readonly payload: unknown }> = [];
  return {
    events,
    emit(event: string, payload: unknown) {
      events.push({ event, payload });
    },
  };
}

export function createInMemoryPersistenceTarget(): {
  readonly target: SovereigntyPersistenceTarget;
  readonly buckets: InMemoryPersistenceBuckets;
} {
  const buckets: InMemoryPersistenceBuckets = {
    ticks: [],
    runs: [],
    artifacts: [],
    audits: [],
  };

  const target: SovereigntyPersistenceTarget = {
    tickRepository: {
      append(record) {
        buckets.ticks.push(record);
      },
      appendMany(records) {
        buckets.ticks.push(...records);
      },
    },
    runRepository: {
      upsert(record) {
        buckets.runs.push(record);
      },
    },
    artifactRepository: {
      upsert(record) {
        buckets.artifacts.push(record);
      },
    },
    auditRepository: {
      append(record) {
        buckets.audits.push(record);
      },
    },
  };

  return { target, buckets };
}

export function createBaseSnapshot(
  override: Partial<RunStateSnapshot> = {},
): RunStateSnapshot {
  const base: RunStateSnapshot = {
    schemaVersion: 'engine-run-state.v2',
    runId: 'run-1',
    userId: 'user-1',
    seed: 'seed-1',
    mode: 'coop',
    tick: 12,
    phase: 'FOUNDATION',
    outcome: 'TIMEOUT',
    tags: ['test', 'sovereignty'],
    economy: {
      cash: 20_000,
      debt: 5_000,
      incomePerTick: 100,
      expensesPerTick: 50,
      netWorth: 15_000,
      freedomTarget: 100_000,
      haterHeat: 12,
      opportunitiesPurchased: 3,
      privilegePlays: 1,
    },
    pressure: {
      score: 0.52,
      tier: 'T2',
      band: 'ELEVATED',
      previousTier: 'T1',
      previousBand: 'BUILDING',
      upwardCrossings: 1,
      survivedHighPressureTicks: 4,
      lastEscalationTick: 10,
      maxScoreSeen: 0.67,
    },
    tension: {
      score: 0.38,
      anticipation: 0.33,
      visibleThreats: [createThreat()],
      maxPulseTriggered: false,
      lastSpikeTick: 9,
    },
    shield: {
      layers: [
        {
          layerId: 'L1',
          label: 'CASH_RESERVE',
          current: 40,
          max: 50,
          regenPerTick: 1,
          breached: false,
          integrityRatio: 0.8,
          lastDamagedTick: 10,
          lastRecoveredTick: 11,
        },
        {
          layerId: 'L2',
          label: 'CREDIT_LINE',
          current: 45,
          max: 50,
          regenPerTick: 1,
          breached: false,
          integrityRatio: 0.9,
          lastDamagedTick: 8,
          lastRecoveredTick: 11,
        },
        {
          layerId: 'L3',
          label: 'INCOME_BASE',
          current: 50,
          max: 50,
          regenPerTick: 1,
          breached: false,
          integrityRatio: 1,
          lastDamagedTick: null,
          lastRecoveredTick: null,
        },
        {
          layerId: 'L4',
          label: 'NETWORK_CORE',
          current: 48,
          max: 50,
          regenPerTick: 1,
          breached: false,
          integrityRatio: 0.96,
          lastDamagedTick: 7,
          lastRecoveredTick: 12,
        },
      ],
      weakestLayerId: 'L1',
      weakestLayerRatio: 0.8,
      blockedThisRun: 4,
      damagedThisRun: 3,
      breachesThisRun: 0,
      repairQueueDepth: 1,
    },
    battle: {
      bots: [
        {
          botId: 'BOT_01',
          label: 'Liquidator',
          state: 'ACTIVE',
          heat: 1,
          lastAttackTick: 10,
          attacksLanded: 1,
          attacksBlocked: 2,
          neutralized: false,
        },
        {
          botId: 'BOT_02',
          label: 'Manipulator',
          state: 'DORMANT',
          heat: 0,
          lastAttackTick: null,
          attacksLanded: 0,
          attacksBlocked: 0,
          neutralized: false,
        },
        {
          botId: 'BOT_03',
          label: 'Crash Prophet',
          state: 'DORMANT',
          heat: 0,
          lastAttackTick: null,
          attacksLanded: 0,
          attacksBlocked: 0,
          neutralized: false,
        },
        {
          botId: 'BOT_04',
          label: 'Collector',
          state: 'DORMANT',
          heat: 0,
          lastAttackTick: null,
          attacksLanded: 0,
          attacksBlocked: 0,
          neutralized: true,
        },
        {
          botId: 'BOT_05',
          label: 'Saboteur',
          state: 'ACTIVE',
          heat: 1,
          lastAttackTick: 11,
          attacksLanded: 1,
          attacksBlocked: 1,
          neutralized: false,
        },
      ],
      battleBudget: 500,
      battleBudgetCap: 2_000,
      extractionCooldownTicks: 0,
      firstBloodClaimed: true,
      pendingAttacks: [createAttack()],
      sharedOpportunityDeckCursor: 1,
      rivalryHeatCarry: 1,
      neutralizedBotIds: ['BOT_04'],
    },
    cascade: {
      activeChains: [createCascadeChain()],
      positiveTrackers: [],
      brokenChains: 1,
      completedChains: 2,
      repeatedTriggerCounts: {
        'shield:L1': 1,
      },
      lastResolvedTick: 11,
    },
    sovereignty: {
      integrityStatus: 'UNVERIFIED',
      tickChecksums: ['deadbeef', 'cafebabe'],
      proofHash: null,
      sovereigntyScore: 0.64,
      verifiedGrade: 'B',
      proofBadges: ['CASCADE_ABSORBER'],
      gapVsLegend: 8,
      gapClosingRate: 0.12,
      cordScore: 0.58,
      auditFlags: ['missing-proof'],
      lastVerifiedTick: 8,
    },
    cards: {
      hand: [createCardInstance()],
      discard: [createCardInstance('discard-1', ['repair'])],
      exhaust: [],
      drawHistory: ['card-1'],
      lastPlayed: [createCardInstance('last-1', ['counter'])],
      ghostMarkers: [createLegendMarker()],
      drawPileSize: 30,
      deckEntropy: 0.5,
    },
    modeState: {
      holdEnabled: false,
      loadoutEnabled: true,
      sharedTreasury: true,
      sharedTreasuryBalance: 22_500,
      trustScores: {
        'user-1': 76,
        'user-2': 73,
      },
      roleAssignments: {
        'user-1': 'INCOME_BUILDER',
        'user-2': 'SHIELD_ARCHITECT',
      },
      defectionStepByPlayer: {},
      legendMarkersEnabled: true,
      communityHeatModifier: 1,
      sharedOpportunityDeck: true,
      counterIntelTier: 2,
      spectatorLimit: 200,
      phaseBoundaryWindowsRemaining: 1,
      bleedMode: false,
      handicapIds: [],
      advantageId: null,
      disabledBots: [],
      modePresentation: 'syndicate',
      roleLockEnabled: true,
      extractionActionsRemaining: 1,
      ghostBaselineRunId: 'ghost-base-1',
      legendOwnerUserId: 'user-1',
    },
    timers: {
      seasonBudgetMs: 12 * 60 * 1_000,
      extensionBudgetMs: 0,
      elapsedMs: 12_000,
      currentTickDurationMs: 1_000,
      nextTickAtMs: null,
      holdCharges: 1,
      activeDecisionWindows: {
        'window-1': {
          closesAtMs: 1_700_000_000_999,
        },
      },
      frozenWindowIds: [],
    },
    telemetry: {
      decisions: [
        createDecision(12, true, 180),
        createDecision(12, false, 780),
        createDecision(11, true, 350),
      ],
      outcomeReason: 'budget expired',
      outcomeReasonCode: 'SEASON_BUDGET_EXHAUSTED',
      lastTickChecksum: 'cafebabe',
      forkHints: [],
      emittedEventCount: 6,
      warnings: [],
    },
    decisionsThisTick: [createDecision(12, true, 180)],
  } as unknown as RunStateSnapshot;

  return deepMerge(base, override);
}

export function createSnapshotHistory(
  count = 3,
  seed = 'seed-1',
): RunStateSnapshot[] {
  const history: RunStateSnapshot[] = [];

  for (let i = 0; i < count; i += 1) {
    const tick = i + 1;
    history.push(
      createBaseSnapshot({
        seed,
        tick,
        phase: tick < count ? 'FOUNDATION' : 'SOVEREIGNTY',
        economy: {
          cash: 20_000 + tick * 1_250,
          debt: 5_000,
          incomePerTick: 100 + tick * 10,
          expensesPerTick: 50 + tick,
          netWorth: 15_000 + tick * 2_000,
          freedomTarget: 100_000,
          haterHeat: 8 + tick,
          opportunitiesPurchased: 3 + tick,
          privilegePlays: 1,
        },
        pressure: {
          score: 0.3 + tick * 0.05,
          tier: tick >= count ? 'T3' : 'T2',
          band: tick >= count ? 'HIGH' : 'ELEVATED',
          previousTier: 'T1',
          previousBand: 'BUILDING',
          upwardCrossings: tick,
          survivedHighPressureTicks: Math.max(0, tick - 1),
          lastEscalationTick: tick - 1,
          maxScoreSeen: 0.3 + tick * 0.05,
        },
        sovereignty: {
          integrityStatus: tick === count ? 'VERIFIED' : 'UNVERIFIED',
          tickChecksums: Array.from({ length: tick }, (_, index) =>
            `${(0xabc00000 + index).toString(16)}`,
          ),
          proofHash: null,
          sovereigntyScore: 0.55 + tick * 0.05,
          verifiedGrade: tick === count ? 'A' : 'B',
          proofBadges: tick === count ? ['TRUST_ARCHITECT', 'CASCADE_ABSORBER'] : ['CASCADE_ABSORBER'],
          gapVsLegend: Math.max(0, 12 - tick * 2),
          gapClosingRate: Number((0.05 * tick).toFixed(3)),
          cordScore: Number((0.5 + tick * 0.04).toFixed(3)),
          auditFlags: tick === count ? [] : ['pending-verification'],
          lastVerifiedTick: tick === count ? tick : null,
        },
        telemetry: {
          decisions: [
            createDecision(tick, true, 180 + tick * 10),
            createDecision(tick, tick % 2 === 0, 420 + tick * 20),
          ],
          outcomeReason: tick === count ? 'graded for history' : null,
          outcomeReasonCode: tick === count ? 'TARGET_REACHED' : null,
          lastTickChecksum: `${(0xabc00000 + (tick - 1)).toString(16)}`,
          forkHints: [],
          emittedEventCount: 4 + tick,
          warnings: [],
        },
      } as Partial<RunStateSnapshot>),
    );
  }

  return history;
}

export function applyCanonicalProofHash(
  snapshot: RunStateSnapshot,
): RunStateSnapshot {
  const cloned = deepClone(snapshot);
  const proof = new ProofGenerator();
  const sov = cloned.sovereignty as unknown as { proofHash: string | null; integrityStatus: string; auditFlags: string[] };
  sov.proofHash = proof.generate(cloned);
  sov.integrityStatus = 'VERIFIED';
  sov.auditFlags = [];
  return cloned as RunStateSnapshot;
}
