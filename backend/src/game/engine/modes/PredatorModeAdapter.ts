/*
 * POINT ZERO ONE — PREDATOR / HEAD TO HEAD MODE ADAPTER
 * /backend/src/game/engine/modes/PredatorModeAdapter.ts
 *
 * Doctrine:
 * - pvp is a combat economy, not parallel solo
 * - battle budget is exclusive and must be server-owned
 * - aggression is rewarded, hoarding is punished
 * - rivalry pressure should materially affect the run
 */

import type { AttackCategory, ShieldLayerId } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type {
  ModeActionId,
  ModeAdapter,
  ModeConfigureOptions,
} from './ModeContracts';

const EXTRACTION_COSTS: Readonly<Record<string, number>> = {
  MARKET_DUMP: 30,
  CREDIT_REPORT_PULL: 25,
  REGULATORY_FILING: 35,
  MISINFORMATION_FLOOD: 20,
  DEBT_INJECTION: 40,
  HOSTILE_TAKEOVER: 60,
  LIQUIDATION_NOTICE: 45,
};

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class PredatorModeAdapter implements ModeAdapter {
  public readonly modeCode = 'pvp' as const;

  public configure(
    snapshot: RunStateSnapshot,
    options?: ModeConfigureOptions,
  ): RunStateSnapshot {
    const rivalryHeatCarry = clamp(options?.rivalryHeatCarry ?? 0, 0, 25);
    const battleBudgetStart = clamp(options?.battleBudgetStart ?? 40, 0, 200);
    const spectatorLimit = clamp(options?.spectatorLimit ?? 50, 0, 50);

    return {
      ...snapshot,
      tags: uniqueStrings([
        ...snapshot.tags,
        'mode:predator',
        'battle_budget:enabled',
        'shared_opportunity_deck:enabled',
        'spectators:enabled',
      ]),
      economy: {
        ...snapshot.economy,
        haterHeat: snapshot.economy.haterHeat + rivalryHeatCarry,
      },
      battle: {
        ...snapshot.battle,
        battleBudget: battleBudgetStart,
        battleBudgetCap: 200,
        extractionCooldownTicks: 0,
        rivalryHeatCarry,
        sharedOpportunityDeckCursor: 0,
      },
      modeState: {
        ...snapshot.modeState,
        holdEnabled: false,
        loadoutEnabled: false,
        sharedTreasury: false,
        sharedTreasuryBalance: 0,
        legendMarkersEnabled: false,
        communityHeatModifier: 0,
        sharedOpportunityDeck: true,
        counterIntelTier: 1,
        spectatorLimit,
        phaseBoundaryWindowsRemaining: 0,
        bleedMode: false,
        handicapIds: [],
        advantageId: null,
        disabledBots: [],
        modePresentation: 'predator',
        roleLockEnabled: false,
        extractionActionsRemaining: 1,
        ghostBaselineRunId: null,
        legendOwnerUserId: null,
      },
      timers: {
        ...snapshot.timers,
        holdCharges: 0,
      },
    };
  }

  public onTickStart(snapshot: RunStateSnapshot): RunStateSnapshot {
    let extractionActionsRemaining = snapshot.modeState.extractionActionsRemaining;

    if (snapshot.tick > 0 && snapshot.tick % 3 === 0) {
      extractionActionsRemaining = 1;
    }

    return {
      ...snapshot,
      modeState: {
        ...snapshot.modeState,
        extractionActionsRemaining,
      },
    };
  }

  public onTickEnd(snapshot: RunStateSnapshot): RunStateSnapshot {
    let next = snapshot;

    const passiveIncome =
      snapshot.pressure.tier === 'T0' || snapshot.pressure.tier === 'T1'
        ? 8
        : snapshot.pressure.tier === 'T2'
        ? 6
        : 4;

    next = {
      ...next,
      battle: {
        ...next.battle,
        battleBudget: clamp(
          next.battle.battleBudget + passiveIncome,
          0,
          next.battle.battleBudgetCap,
        ),
        extractionCooldownTicks: Math.max(0, next.battle.extractionCooldownTicks - 1),
      },
    };

    if (next.battle.battleBudget >= 150) {
      next = {
        ...next,
        economy: {
          ...next.economy,
          haterHeat: next.economy.haterHeat + 2,
        },
        tags: uniqueStrings([...next.tags, 'predator:hoarding_penalty']),
      };
    }

    if (next.tick % 5 === 0 && next.modeState.spectatorLimit > 0) {
      next = {
        ...next,
        tags: uniqueStrings([...next.tags, `predator:spectator_projection:${next.tick}`]),
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
      case 'FIRE_EXTRACTION': {
        const extractionId =
          typeof payload?.extractionId === 'string' ? payload.extractionId : 'MARKET_DUMP';
        const cost = EXTRACTION_COSTS[extractionId] ?? EXTRACTION_COSTS['MARKET_DUMP'];

        if (
          snapshot.modeState.extractionActionsRemaining <= 0 ||
          snapshot.battle.extractionCooldownTicks > 0 ||
          snapshot.battle.battleBudget < cost
        ) {
          return snapshot;
        }

        return {
          ...snapshot,
          tags: uniqueStrings([
            ...snapshot.tags,
            `predator:extraction_fired:${extractionId}`,
            `predator:last_extraction_tick:${snapshot.tick}`,
          ]),
          battle: {
            ...snapshot.battle,
            battleBudget: snapshot.battle.battleBudget - cost,
            extractionCooldownTicks: 3,
          },
          modeState: {
            ...snapshot.modeState,
            extractionActionsRemaining:
              Math.max(0, snapshot.modeState.extractionActionsRemaining - 1),
          },
          economy: {
            ...snapshot.economy,
            haterHeat: snapshot.economy.haterHeat + 2,
          },
        };
      }

      case 'COUNTER_PLAY': {
        if (snapshot.battle.pendingAttacks.length === 0 || snapshot.battle.battleBudget < 10) {
          return snapshot;
        }

        return {
          ...snapshot,
          tags: uniqueStrings([...snapshot.tags, 'predator:counter_play:successful']),
          battle: {
            ...snapshot.battle,
            battleBudget: snapshot.battle.battleBudget - 10,
            pendingAttacks: snapshot.battle.pendingAttacks.slice(1),
          },
        };
      }

      case 'CLAIM_FIRST_BLOOD': {
        if (snapshot.battle.firstBloodClaimed) {
          return snapshot;
        }

        return {
          ...snapshot,
          tags: uniqueStrings([...snapshot.tags, 'predator:first_blood']),
          battle: {
            ...snapshot.battle,
            firstBloodClaimed: true,
            battleBudget: clamp(
              snapshot.battle.battleBudget + 25,
              0,
              snapshot.battle.battleBudgetCap,
            ),
          },
        };
      }

      default:
        return snapshot;
    }
  }

  public finalize(snapshot: RunStateSnapshot): RunStateSnapshot {
    let multiplier = 1;
    const badges = new Set(snapshot.sovereignty.proofBadges);

    if (snapshot.battle.firstBloodClaimed) {
      multiplier += 0.05;
      badges.add('FIRST_BLOOD');
    }

    if (snapshot.battle.rivalryHeatCarry >= 20) {
      multiplier += 0.10;
      badges.add('ARCH_RIVAL_PRESSURE');
    }

    if (snapshot.battle.neutralizedBotIds.length > 0) {
      multiplier += Math.min(0.25, snapshot.battle.neutralizedBotIds.length * 0.05);
      badges.add('ARENA_CONTROL');
    }

    if (snapshot.battle.battleBudget < 40 && snapshot.outcome === 'FREEDOM') {
      multiplier += 0.10;
      badges.add('AGGRESSOR');
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