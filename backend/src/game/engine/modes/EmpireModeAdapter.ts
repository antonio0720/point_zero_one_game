/*
 * POINT ZERO ONE — EMPIRE / GO ALONE MODE ADAPTER
 * /backend/src/game/engine/modes/EmpireModeAdapter.ts
 *
 * Doctrine:
 * - solo is the harshest foundational battleground
 * - loadout and handicap doctrine is exclusive to solo
 * - phase transitions materially change danger posture
 * - bleed mode is a real ruleset, not a cosmetic flag
 */

import type {
  HaterBotId,
  RunPhase,
  ShieldLayerId,
} from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type {
  ModeActionId,
  ModeAdapter,
  ModeConfigureOptions,
  SoloAdvantageId,
  SoloHandicapId,
} from './ModeContracts';

const PHASE_WINDOW_TICKS = 5;
const TEN_MINUTES_MS = 10 * 60 * 1000;
const ELEVEN_MINUTES_MS = 11 * 60 * 1000;
const ELEVEN_THIRTY_MS = 11 * 60 * 1000 + 30 * 1000;

const ALL_HANDICAPS: readonly SoloHandicapId[] = [
  'NO_CREDIT_HISTORY',
  'SINGLE_INCOME',
  'TARGETED',
  'CASH_POOR',
  'CLOCK_CURSED',
  'DISADVANTAGE_DRAFT',
] as const;

const HANDICAP_CORD_BONUS: Readonly<Record<SoloHandicapId, number>> = {
  NO_CREDIT_HISTORY: 0.15,
  SINGLE_INCOME: 0.15,
  TARGETED: 0.15,
  CASH_POOR: 0.20,
  CLOCK_CURSED: 0.30,
  DISADVANTAGE_DRAFT: 0.80,
};

const PHASE_TWO_BOTS: readonly HaterBotId[] = ['BOT_01', 'BOT_02'] as const;
const PHASE_THREE_BOTS: readonly HaterBotId[] = ['BOT_03', 'BOT_04', 'BOT_05'] as const;

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function removeTagsByPrefix(tags: readonly string[], prefix: string): string[] {
  return tags.filter((tag) => !tag.startsWith(prefix));
}

function upsertNumericTag(
  tags: readonly string[],
  prefix: string,
  value: number,
): string[] {
  return [...removeTagsByPrefix(tags, `${prefix}:`), `${prefix}:${value}`];
}

function readNumericTag(
  tags: readonly string[],
  prefix: string,
): number | null {
  const entry = tags.find((tag) => tag.startsWith(`${prefix}:`));
  if (!entry) {
    return null;
  }
  const raw = entry.slice(prefix.length + 1);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasTag(tags: readonly string[], tag: string): boolean {
  return tags.includes(tag);
}

function recalcShield(snapshot: RunStateSnapshot): RunStateSnapshot {
  const layers = snapshot.shield.layers.map((layer) => {
    const current = Math.max(0, Math.min(layer.max, layer.current));
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

function adjustShieldLayer(
  snapshot: RunStateSnapshot,
  layerId: ShieldLayerId,
  updater: (current: number, max: number) => { current: number; max: number },
): RunStateSnapshot {
  const next = {
    ...snapshot,
    shield: {
      ...snapshot.shield,
      layers: snapshot.shield.layers.map((layer) => {
        if (layer.layerId !== layerId) {
          return layer;
        }
        const updated = updater(layer.current, layer.max);
        return {
          ...layer,
          current: updated.current,
          max: updated.max,
        };
      }),
    },
  };

  return recalcShield(next);
}

function setCash(snapshot: RunStateSnapshot, cash: number): RunStateSnapshot {
  const delta = cash - snapshot.economy.cash;
  return {
    ...snapshot,
    economy: {
      ...snapshot.economy,
      cash,
      netWorth: snapshot.economy.netWorth + delta,
    },
  };
}

function determinePhase(snapshot: RunStateSnapshot): RunPhase {
  const totalMs = Math.max(1, snapshot.timers.seasonBudgetMs);
  const elapsedRatio = snapshot.timers.elapsedMs / totalMs;

  if (elapsedRatio < 1 / 3) {
    return 'FOUNDATION';
  }
  if (elapsedRatio < 2 / 3) {
    return 'ESCALATION';
  }
  return 'SOVEREIGNTY';
}

function activateBots(
  snapshot: RunStateSnapshot,
  botIds: readonly HaterBotId[],
  minimumHeat: number,
): RunStateSnapshot {
  const disabled = new Set(snapshot.modeState.disabledBots);
  return {
    ...snapshot,
    battle: {
      ...snapshot.battle,
      bots: snapshot.battle.bots.map((bot) => {
        if (disabled.has(bot.botId) || !botIds.includes(bot.botId)) {
          return bot;
        }
        return {
          ...bot,
          state: bot.neutralized ? 'NEUTRALIZED' : 'WATCHING',
          heat: Math.max(bot.heat, minimumHeat),
        };
      }),
    },
  };
}

function applyAdvantage(
  snapshot: RunStateSnapshot,
  advantageId: SoloAdvantageId | null,
): RunStateSnapshot {
  if (!advantageId) {
    return snapshot;
  }

  let next = snapshot;

  switch (advantageId) {
    case 'MOMENTUM_CAPITAL':
      next = setCash(next, next.economy.cash + 10000);
      break;

    case 'NETWORK_ACTIVATED':
      next = adjustShieldLayer(next, 'L4', (current, max) => ({
        current: Math.round(current * 1.5),
        max: Math.round(max * 1.5),
      }));
      break;

    case 'FORECLOSURE_BLOCK':
      next = {
        ...next,
        tags: uniqueStrings([...next.tags, 'solo:foreclosure_block:active']),
      };
      break;

    case 'INTEL_PASS':
      next = {
        ...next,
        tension: {
          ...next.tension,
          visibleThreats: next.tension.visibleThreats.map((threat, index) =>
            index < 3 ? { ...threat, visibleAs: 'EXPOSED' } : threat,
          ),
        },
        tags: uniqueStrings([...next.tags, 'solo:intel_pass:active']),
      };
      break;

    case 'PHANTOM_SEED':
      next = {
        ...next,
        tags: uniqueStrings([...next.tags, 'solo:phantom_seed:active']),
      };
      break;

    case 'DEBT_SHIELD':
      next = {
        ...next,
        tags: uniqueStrings([...next.tags, 'solo:auto_debt_counter:1']),
      };
      break;
  }

  return next;
}

function applyHandicaps(
  snapshot: RunStateSnapshot,
  handicapIds: readonly SoloHandicapId[],
): RunStateSnapshot {
  let next = snapshot;

  for (const handicapId of handicapIds) {
    switch (handicapId) {
      case 'NO_CREDIT_HISTORY':
        next = adjustShieldLayer(next, 'L2', (current, max) => ({
          current: Math.min(current, 40),
          max: Math.min(max, 40),
        }));
        next = {
          ...next,
          tags: uniqueStrings([...next.tags, 'solo:no_credit_history']),
        };
        break;

      case 'SINGLE_INCOME':
        next = {
          ...next,
          tags: uniqueStrings([...next.tags, 'solo:single_income']),
        };
        break;

      case 'TARGETED':
        next = {
          ...next,
          battle: {
            ...next.battle,
            bots: next.battle.bots.map((bot) =>
              bot.botId === 'BOT_01'
                ? {
                    ...bot,
                    heat: Math.max(bot.heat, 20),
                    state: bot.neutralized ? 'NEUTRALIZED' : 'WATCHING',
                  }
                : bot,
            ),
          },
          tags: uniqueStrings([...next.tags, 'solo:targeted']),
        };
        break;

      case 'CASH_POOR':
        next = setCash(next, Math.min(next.economy.cash, 10000));
        next = {
          ...next,
          tags: uniqueStrings([...next.tags, 'solo:cash_poor']),
        };
        break;

      case 'CLOCK_CURSED':
        next = {
          ...next,
          timers: {
            ...next.timers,
            seasonBudgetMs: Math.min(next.timers.seasonBudgetMs, 9 * 60 * 1000),
          },
          tags: uniqueStrings([...next.tags, 'solo:clock_cursed']),
        };
        break;

      case 'DISADVANTAGE_DRAFT':
        next = {
          ...next,
          tags: uniqueStrings([...next.tags, 'solo:bleed_mode']),
        };
        break;
    }
  }

  return next;
}

export class EmpireModeAdapter implements ModeAdapter {
  public readonly modeCode = 'solo' as const;

  public configure(
    snapshot: RunStateSnapshot,
    options?: ModeConfigureOptions,
  ): RunStateSnapshot {
    const requestedHandicaps = options?.handicapIds ?? [];
    const bleedMode =
      options?.bleedMode === true ||
      requestedHandicaps.includes('DISADVANTAGE_DRAFT');

    const handicapIds = bleedMode
      ? ALL_HANDICAPS
      : uniqueStrings([...requestedHandicaps]) as SoloHandicapId[];

    const disabledBots = uniqueStrings([...(options?.disabledBots ?? [])]) as HaterBotId[];

    let next: RunStateSnapshot = {
      ...snapshot,
      tags: uniqueStrings([
        ...snapshot.tags,
        'mode:empire',
        'solo:authoritative',
        'loadout:enabled',
        bleedMode ? 'bleed:enabled' : 'bleed:disabled',
      ]),
      modeState: {
        ...snapshot.modeState,
        holdEnabled: !bleedMode,
        loadoutEnabled: true,
        sharedTreasury: false,
        sharedTreasuryBalance: 0,
        legendMarkersEnabled: false,
        communityHeatModifier: 0,
        sharedOpportunityDeck: false,
        counterIntelTier: 0,
        spectatorLimit: 0,
        phaseBoundaryWindowsRemaining: 0,
        bleedMode,
        handicapIds,
        advantageId: options?.advantageId ?? null,
        disabledBots,
        modePresentation: 'empire',
        roleLockEnabled: false,
        extractionActionsRemaining: 0,
        ghostBaselineRunId: null,
        legendOwnerUserId: null,
      },
      battle: {
        ...snapshot.battle,
        battleBudget: 0,
        battleBudgetCap: 0,
        extractionCooldownTicks: 0,
        rivalryHeatCarry: 0,
        sharedOpportunityDeckCursor: 0,
        pendingAttacks: [],
      },
      cards: {
        ...snapshot.cards,
        ghostMarkers: [],
      },
      timers: {
        ...snapshot.timers,
        holdCharges: bleedMode ? 0 : Math.max(snapshot.timers.holdCharges, 1),
      },
    };

    next = applyHandicaps(next, handicapIds);
    next = applyAdvantage(next, options?.advantageId ?? null);

    next = {
      ...next,
      battle: {
        ...next.battle,
        bots: next.battle.bots.map((bot) =>
          disabledBots.includes(bot.botId)
            ? {
                ...bot,
                state: 'DORMANT',
                heat: 0,
              }
            : {
                ...bot,
                state: bleedMode ? 'WATCHING' : 'DORMANT',
                heat: bleedMode ? Math.max(bot.heat, 25) : bot.heat,
              },
        ),
      },
    };

    if (disabledBots.length > 0) {
      next = {
        ...next,
        tags: uniqueStrings([
          ...next.tags,
          `solo:cord_cap:reduced:${disabledBots.length}`,
        ]),
      };
    }

    if (bleedMode) {
      next = {
        ...next,
        tags: uniqueStrings([...next.tags, 'solo:bleed_mode:hard']),
        timers: {
          ...next.timers,
          frozenWindowIds: uniqueStrings([
            ...next.timers.frozenWindowIds,
            'BLEED_MODE_LOCK',
          ]),
        },
      };
    }

    return next;
  }

  public onTickStart(snapshot: RunStateSnapshot): RunStateSnapshot {
    let next = snapshot;
    const currentPhase = determinePhase(next);

    if (currentPhase !== next.phase) {
      next = {
        ...next,
        phase: currentPhase,
        modeState: {
          ...next.modeState,
          phaseBoundaryWindowsRemaining: PHASE_WINDOW_TICKS,
        },
        tags: uniqueStrings([
          ...next.tags,
          `solo:phase_transition:${next.phase}->${currentPhase}`,
        ]),
      };

      if (currentPhase === 'ESCALATION') {
        next = activateBots(next, PHASE_TWO_BOTS, 12);
      } else if (currentPhase === 'SOVEREIGNTY') {
        next = activateBots(next, PHASE_THREE_BOTS, 18);
        next = {
          ...next,
          tension: {
            ...next.tension,
            visibleThreats: next.tension.visibleThreats.map((threat) => ({
              ...threat,
              visibleAs: 'EXPOSED',
            })),
          },
        };
      }
    }

    if (
      next.timers.elapsedMs >= TEN_MINUTES_MS &&
      !hasTag(next.tags, 'solo:clock_active')
    ) {
      next = {
        ...next,
        tags: uniqueStrings([...next.tags, 'solo:clock_active']),
        tension: {
          ...next.tension,
          visibleThreats: next.tension.visibleThreats.map((threat) => ({
            ...threat,
            visibleAs: 'EXPOSED',
          })),
        },
      };
    }

    if (
      next.timers.elapsedMs >= ELEVEN_MINUTES_MS &&
      !hasTag(next.tags, 'solo:minute_11_heat_spike_applied')
    ) {
      next = {
        ...next,
        tags: uniqueStrings([...next.tags, 'solo:minute_11_heat_spike_applied']),
        battle: {
          ...next.battle,
          bots: next.battle.bots.map((bot) =>
            bot.state === 'DORMANT' || bot.state === 'NEUTRALIZED'
              ? bot
              : { ...bot, heat: bot.heat + 20 },
          ),
        },
      };
    }

    if (
      next.timers.elapsedMs >= ELEVEN_THIRTY_MS &&
      !hasTag(next.tags, 'solo:sovereignty_decision_ready')
    ) {
      next = {
        ...next,
        tags: uniqueStrings([...next.tags, 'solo:sovereignty_decision_ready']),
      };
    }

    const lowCashStreak = readNumericTag(next.tags, 'solo:cash_low_streak') ?? 0;

    if (next.economy.cash < 2000) {
      next = {
        ...next,
        tags: upsertNumericTag(next.tags, 'solo:cash_low_streak', lowCashStreak + 1),
      };
    } else if (lowCashStreak >= 15) {
      next = {
        ...next,
        tags: uniqueStrings([
          ...removeTagsByPrefix(next.tags, 'solo:cash_low_streak:'),
          'solo:comeback_surge_armed',
        ]),
        sovereignty: {
          ...next.sovereignty,
          sovereigntyScore: Number((next.sovereignty.sovereigntyScore + 0.01).toFixed(6)),
        },
      };
    } else {
      next = {
        ...next,
        tags: removeTagsByPrefix(next.tags, 'solo:cash_low_streak:'),
      };
    }

    return next;
  }

  public onTickEnd(snapshot: RunStateSnapshot): RunStateSnapshot {
    let next = snapshot;

    if (next.modeState.phaseBoundaryWindowsRemaining > 0) {
      next = {
        ...next,
        modeState: {
          ...next.modeState,
          phaseBoundaryWindowsRemaining:
            next.modeState.phaseBoundaryWindowsRemaining - 1,
        },
      };
    }

    if (next.modeState.bleedMode && (next.pressure.tier === 'T3' || next.pressure.tier === 'T4')) {
      next = {
        ...next,
        economy: {
          ...next.economy,
          haterHeat: next.economy.haterHeat + 1,
        },
      };
    }

    if (hasTag(next.tags, 'solo:comeback_surge_armed')) {
      next = {
        ...next,
        tags: uniqueStrings([...next.tags, 'solo:comeback_realized']),
        shield: {
          ...next.shield,
          layers: next.shield.layers.map((layer) => ({
            ...layer,
            regenPerTick: layer.regenPerTick + 1,
          })),
        },
      };
    }

    return next;
  }

  public resolveAction(
    snapshot: RunStateSnapshot,
    actionId: ModeActionId,
    payload?: Readonly<Record<string, unknown>>,
  ): RunStateSnapshot {
    if (actionId !== 'USE_HOLD' || !snapshot.modeState.holdEnabled) {
      return snapshot;
    }

    if (snapshot.timers.holdCharges <= 0) {
      return snapshot;
    }

    const rawWindowId = payload?.windowId;
    const windowId =
      typeof rawWindowId === 'string' && rawWindowId.length > 0
        ? rawWindowId
        : `hold-${snapshot.tick}`;

    return {
      ...snapshot,
      tags: uniqueStrings([...snapshot.tags, 'solo:hold_used']),
      timers: {
        ...snapshot.timers,
        holdCharges: snapshot.timers.holdCharges - 1,
        frozenWindowIds: uniqueStrings([...snapshot.timers.frozenWindowIds, windowId]),
      },
    };
  }

  public finalize(snapshot: RunStateSnapshot): RunStateSnapshot {
    let multiplier = 1;
    const badges = new Set(snapshot.sovereignty.proofBadges);

    for (const handicapId of snapshot.modeState.handicapIds as SoloHandicapId[]) {
      multiplier += HANDICAP_CORD_BONUS[handicapId] ?? 0;
    }

    if (snapshot.modeState.disabledBots.length > 0) {
      multiplier *= Math.max(0.35, 1 - snapshot.modeState.disabledBots.length * 0.2);
    }

    if (snapshot.modeState.bleedMode && snapshot.outcome === 'FREEDOM') {
      multiplier = Math.max(multiplier, 1.8);
      badges.add('BLEED_S_GRADE_ELIGIBLE');
    }

    if (hasTag(snapshot.tags, 'solo:comeback_realized')) {
      multiplier += 0.05;
      badges.add('COMEBACK_SURGE');
    }

    if (snapshot.modeState.disabledBots.length === 0) {
      badges.add('FULL_BOT_GAUNTLET');
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