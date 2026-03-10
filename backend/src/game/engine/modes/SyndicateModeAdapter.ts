/*
 * POINT ZERO ONE — SYNDICATE / TEAM UP MODE ADAPTER
 * /backend/src/game/engine/modes/SyndicateModeAdapter.ts
 *
 * Doctrine:
 * - co-op is treasury + trust + betrayal pressure
 * - role doctrine must be represented in authoritative state
 * - full synergy must create a real run advantage
 * - cascade absorption and defection must have mechanical consequences
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

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function removeTagsByPrefix(tags: readonly string[], prefix: string): string[] {
  return tags.filter((tag) => !tag.startsWith(prefix));
}

function readNumericTag(tags: readonly string[], prefix: string): number | null {
  const entry = tags.find((tag) => tag.startsWith(`${prefix}:`));
  if (!entry) {
    return null;
  }
  const value = Number(entry.slice(prefix.length + 1));
  return Number.isFinite(value) ? value : null;
}

function upsertNumericTag(
  tags: readonly string[],
  prefix: string,
  value: number,
): string[] {
  return [...removeTagsByPrefix(tags, `${prefix}:`), `${prefix}:${value}`];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hasFullSynergy(roleAssignments: Readonly<Record<string, string>>): boolean {
  const values = new Set(Object.values(roleAssignments));
  return ROLE_IDS.every((roleId) => values.has(roleId));
}

function recalcShield(snapshot: RunStateSnapshot): RunStateSnapshot {
  const layers = snapshot.shield.layers.map((layer) => {
    const current = Math.max(0, Math.min(layer.current, layer.max));
    const integrityRatio = layer.max <= 0 ? 0 : current / layer.max;
    return {
      ...layer,
      current,
      breached: current <= 0,
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

export class SyndicateModeAdapter implements ModeAdapter {
  public readonly modeCode = 'coop' as const;

  public configure(
    snapshot: RunStateSnapshot,
    options?: ModeConfigureOptions,
  ): RunStateSnapshot {
    const players = uniqueStrings([
      snapshot.userId,
      ...(options?.teammateUserIds ?? []),
    ]);

    const baseTrust = clamp(options?.initialTrustScore ?? 70, 0, 100);
    const configuredRoles = options?.roleAssignments ?? { [snapshot.userId]: 'INCOME_BUILDER' };
    const trustScores: Record<string, number> = {};
    const defectionStepByPlayer: Record<string, number> = {};

    for (const playerId of players) {
      trustScores[playerId] = baseTrust;
      defectionStepByPlayer[playerId] = 0;
    }

    const sharedTreasuryBalance = Math.max(
      options?.sharedTreasuryStart ?? 30000,
      snapshot.economy.cash,
    );

    let next: RunStateSnapshot = {
      ...snapshot,
      tags: uniqueStrings([
        ...snapshot.tags,
        'mode:syndicate',
        'shared_treasury:enabled',
        'defection:enabled',
        'role_lock:enabled',
      ]),
      economy: {
        ...snapshot.economy,
        cash: sharedTreasuryBalance,
        netWorth: snapshot.economy.netWorth + (sharedTreasuryBalance - snapshot.economy.cash),
      },
      modeState: {
        ...snapshot.modeState,
        holdEnabled: false,
        loadoutEnabled: false,
        sharedTreasury: true,
        sharedTreasuryBalance,
        trustScores,
        roleAssignments: configuredRoles,
        defectionStepByPlayer,
        legendMarkersEnabled: false,
        communityHeatModifier: 0,
        sharedOpportunityDeck: false,
        counterIntelTier: Object.values(configuredRoles).filter(
          (value) => value === 'COUNTER_INTEL',
        ).length,
        spectatorLimit: 0,
        phaseBoundaryWindowsRemaining: 0,
        bleedMode: false,
        handicapIds: [],
        advantageId: null,
        disabledBots: [],
        modePresentation: 'syndicate',
        roleLockEnabled: true,
        extractionActionsRemaining: 0,
        ghostBaselineRunId: null,
        legendOwnerUserId: null,
      },
      timers: {
        ...snapshot.timers,
        holdCharges: 0,
      },
      battle: {
        ...snapshot.battle,
        battleBudget: 0,
        battleBudgetCap: 0,
        extractionCooldownTicks: 0,
        rivalryHeatCarry: 0,
      },
      cards: {
        ...snapshot.cards,
        ghostMarkers: [],
      },
    };

    if (hasFullSynergy(configuredRoles)) {
      next = {
        ...next,
        tags: uniqueStrings([
          ...next.tags,
          'coop:full_synergy',
          'coop:first_cascade_absorb_available',
        ]),
        economy: {
          ...next.economy,
          cash: next.economy.cash + 8000,
          netWorth: next.economy.netWorth + 8000,
        },
        modeState: {
          ...next.modeState,
          sharedTreasuryBalance: next.modeState.sharedTreasuryBalance + 8000,
        },
        shield: {
          ...next.shield,
          layers: next.shield.layers.map((layer) => ({
            ...layer,
            current: Math.round(layer.current * 1.1),
            max: Math.round(layer.max * 1.1),
          })),
        },
      };

      next = recalcShield(next);
    }

    return next;
  }

  public onTickStart(snapshot: RunStateSnapshot): RunStateSnapshot {
    return {
      ...snapshot,
      economy: {
        ...snapshot.economy,
        cash: snapshot.modeState.sharedTreasuryBalance,
      },
    };
  }

  public onTickEnd(snapshot: RunStateSnapshot): RunStateSnapshot {
    const trustScores = { ...snapshot.modeState.trustScores };
    const averageTrust =
      Object.values(trustScores).reduce((sum, value) => sum + value, 0) /
      Math.max(1, Object.keys(trustScores).length);

    let trustDelta = 0;

    if (
      snapshot.modeState.sharedTreasuryBalance <= Math.max(5000, snapshot.economy.expensesPerTick * 3) &&
      (snapshot.pressure.tier === 'T3' || snapshot.pressure.tier === 'T4')
    ) {
      trustDelta = -1;
    } else if (
      snapshot.cascade.completedChains > snapshot.cascade.brokenChains &&
      snapshot.shield.weakestLayerRatio >= 0.60
    ) {
      trustDelta = +1;
    }

    const nextTrustScores: Record<string, number> = {};
    for (const [playerId, current] of Object.entries(trustScores)) {
      nextTrustScores[playerId] = clamp(current + trustDelta, 0, 100);
    }

    let next = {
      ...snapshot,
      modeState: {
        ...snapshot.modeState,
        trustScores: nextTrustScores,
      },
    };

    if (averageTrust < 45) {
      next = {
        ...next,
        economy: {
          ...next.economy,
          haterHeat: next.economy.haterHeat + 1,
        },
        tags: uniqueStrings([...next.tags, 'coop:trust_fracture']),
      };
    }

    return next;
  }

  public resolveAction(
    snapshot: RunStateSnapshot,
    actionId: ModeActionId,
    payload?: Readonly<Record<string, unknown>>,
  ): RunStateSnapshot {
    switch (actionId) {
      case 'REQUEST_TREASURY_LOAN': {
        const requestedAmount =
          typeof payload?.amount === 'number' ? Math.floor(payload.amount) : 0;

        if (requestedAmount <= 0) {
          return snapshot;
        }

        const maxLoan = Math.floor(snapshot.modeState.sharedTreasuryBalance * 0.25);
        const approvedAmount = Math.min(requestedAmount, maxLoan);

        if (approvedAmount <= 0) {
          return snapshot;
        }

        return {
          ...snapshot,
          tags: upsertNumericTag(
            uniqueStrings([...snapshot.tags, 'coop:loan_outstanding']),
            'coop:loan_outstanding_amount',
            approvedAmount,
          ),
          modeState: {
            ...snapshot.modeState,
            sharedTreasuryBalance: snapshot.modeState.sharedTreasuryBalance - approvedAmount,
          },
          economy: {
            ...snapshot.economy,
            cash: snapshot.modeState.sharedTreasuryBalance - approvedAmount,
            netWorth: snapshot.economy.netWorth,
          },
        };
      }

      case 'ABSORB_CASCADE': {
        if (snapshot.cascade.activeChains.length === 0) {
          return snapshot;
        }

        const absorbedCount = (readNumericTag(snapshot.tags, 'coop:absorptions') ?? 0) + 1;

        return {
          ...snapshot,
          tags: upsertNumericTag(
            uniqueStrings([...snapshot.tags, 'coop:cascade_absorbed']),
            'coop:absorptions',
            absorbedCount,
          ),
          cascade: {
            ...snapshot.cascade,
            activeChains: snapshot.cascade.activeChains.slice(1),
            brokenChains: snapshot.cascade.brokenChains + 1,
          },
          sovereignty: {
            ...snapshot.sovereignty,
            sovereigntyScore: Number((snapshot.sovereignty.sovereigntyScore + 0.05).toFixed(6)),
          },
        };
      }

      case 'ADVANCE_DEFECTION': {
        const currentStep =
          snapshot.modeState.defectionStepByPlayer[snapshot.userId] ?? 0;
        const nextStep = clamp(currentStep + 1, 0, 3);

        const defectionStepByPlayer = {
          ...snapshot.modeState.defectionStepByPlayer,
          [snapshot.userId]: nextStep,
        };

        let next = {
          ...snapshot,
          tags: uniqueStrings([...snapshot.tags, `coop:defection_step:${nextStep}`]),
          modeState: {
            ...snapshot.modeState,
            defectionStepByPlayer,
          },
        };

        if (nextStep >= 3) {
          const postSplitTreasury = Math.floor(snapshot.modeState.sharedTreasuryBalance * 0.65);
          next = {
            ...next,
            tags: uniqueStrings([...next.tags, 'coop:defection_committed']),
            modeState: {
              ...next.modeState,
              sharedTreasuryBalance: postSplitTreasury,
            },
            economy: {
              ...next.economy,
              cash: postSplitTreasury,
            },
          };
        }

        return next;
      }

      default:
        return snapshot;
    }
  }

  public finalize(snapshot: RunStateSnapshot): RunStateSnapshot {
    let multiplier = 1;
    const badges = new Set(snapshot.sovereignty.proofBadges);
    const absorptionCount = readNumericTag(snapshot.tags, 'coop:absorptions') ?? 0;
    const trustValues = Object.values(snapshot.modeState.trustScores);
    const averageTrust =
      trustValues.reduce((sum, value) => sum + value, 0) / Math.max(1, trustValues.length);

    if (snapshot.tags.includes('coop:full_synergy') && snapshot.outcome === 'FREEDOM') {
      multiplier += 0.15;
      badges.add('FULL_SYNERGY');
    }

    if (absorptionCount >= 3) {
      multiplier += 0.35;
      badges.add('CASCADE_ABSORBER');
    }

    if (snapshot.tags.includes('coop:defection_committed') && snapshot.outcome === 'FREEDOM') {
      multiplier += 0.20;
      badges.add('BETRAYAL_SURVIVOR');
    }

    if (averageTrust >= 85) {
      multiplier += 0.10;
      badges.add('TRUST_ARCHITECT');
    }

    return {
      ...snapshot,
      sovereignty: {
        ...snapshot.sovereignty,
        cordScore: Number((snapshot.sovereignty.cordScore * multiplier).toFixed(6)),
        proofBadges: [...badges],
      },
    };
  }
}