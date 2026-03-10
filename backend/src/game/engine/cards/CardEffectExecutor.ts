/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/cards/CardEffectExecutor.ts
 *
 * Doctrine:
 * - backend applies card state changes immutably
 * - effect execution must preserve deterministic replay
 * - card lifecycle side effects must not corrupt snapshot invariants
 * - mode-specific card behavior is enforced backend-side
 */

import type { CardInstance } from '../core/GamePrimitives';
import type {
  BotRuntimeState,
  EconomyState,
  RunStateSnapshot,
  ShieldLayerState,
  ShieldState,
} from '../core/RunStateSnapshot';
import {
  CardEffectCompiler,
  type CompiledOperation,
} from './CardEffectCompiler';

const LAST_PLAYED_LIMIT = 16;
const DRAW_HISTORY_LIMIT = 256;
const POSITIVE_TRACKER_LIMIT = 64;
const TRUST_DEFAULT = 70;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function toMoney(value: number): number {
  return Math.round(value);
}

function appendBounded<T>(
  existing: readonly T[],
  additions: readonly T[],
  limit: number,
): T[] {
  const merged = [...existing, ...additions];
  return merged.slice(Math.max(0, merged.length - limit));
}

function withEconomyPatch(
  economy: EconomyState,
  patch: Partial<EconomyState>,
): EconomyState {
  const cash = toMoney(patch.cash ?? economy.cash);
  const debt = toMoney(patch.debt ?? economy.debt);
  const incomePerTick = toMoney(
    Math.max(0, patch.incomePerTick ?? economy.incomePerTick),
  );
  const expensesPerTick = toMoney(
    Math.max(0, patch.expensesPerTick ?? economy.expensesPerTick),
  );
  const haterHeat = Math.max(0, patch.haterHeat ?? economy.haterHeat);

  return {
    ...economy,
    ...patch,
    cash,
    debt,
    incomePerTick,
    expensesPerTick,
    haterHeat,
    netWorth: toMoney(cash - debt),
  };
}

function updateShieldLayer(
  layer: ShieldLayerState,
  delta: number,
  tick: number,
): ShieldLayerState {
  const nextCurrent = clamp(layer.current + delta, 0, layer.max);
  const damaged = nextCurrent < layer.current;
  const recovered = nextCurrent > layer.current;

  return {
    ...layer,
    current: nextCurrent,
    breached: nextCurrent <= 0,
    integrityRatio: layer.max <= 0 ? 0 : round4(nextCurrent / layer.max),
    lastDamagedTick: damaged ? tick : layer.lastDamagedTick,
    lastRecoveredTick: recovered ? tick : layer.lastRecoveredTick,
  };
}

function resolveWeakestLayer(
  layers: readonly ShieldLayerState[],
): ShieldLayerState {
  return layers.reduce((weakest, current) => {
    if (current.integrityRatio < weakest.integrityRatio) {
      return current;
    }

    if (current.integrityRatio === weakest.integrityRatio) {
      if (current.current < weakest.current) {
        return current;
      }

      if (current.current === weakest.current) {
        return current.layerId < weakest.layerId ? current : weakest;
      }
    }

    return weakest;
  }, layers[0]);
}

function withShieldDelta(
  shield: ShieldState,
  delta: number,
  tick: number,
): ShieldState {
  if (!Number.isFinite(delta) || delta === 0 || shield.layers.length === 0) {
    return shield;
  }

  const layers = shield.layers.map((layer) => updateShieldLayer(layer, delta, tick));
  const weakest = resolveWeakestLayer(layers);

  return {
    ...shield,
    layers,
    weakestLayerId: weakest.layerId,
    weakestLayerRatio: weakest.integrityRatio,
  };
}

function resetBotForSystemicOverride(bot: BotRuntimeState): BotRuntimeState {
  if (bot.neutralized) {
    return {
      ...bot,
      heat: 0,
      state: 'NEUTRALIZED',
      lastAttackTick: bot.lastAttackTick,
    };
  }

  return {
    ...bot,
    heat: 0,
    state: 'DORMANT',
    lastAttackTick: null,
  };
}

function isDefectionCard(definitionId: string): boolean {
  return (
    definitionId === 'BREAK_PACT' ||
    definitionId === 'SILENT_EXIT' ||
    definitionId === 'ASSET_SEIZURE'
  );
}

function resolveDefectionStep(definitionId: string): 1 | 2 | 3 | null {
  if (definitionId === 'BREAK_PACT') {
    return 1;
  }

  if (definitionId === 'SILENT_EXIT') {
    return 2;
  }

  if (definitionId === 'ASSET_SEIZURE') {
    return 3;
  }

  return null;
}

export class CardEffectExecutor {
  private readonly compiler = new CardEffectCompiler();

  public apply(
    snapshot: RunStateSnapshot,
    card: CardInstance,
    actorId: string,
  ): RunStateSnapshot {
    this.assertExecutionPreconditions(snapshot, card, actorId);

    let next: RunStateSnapshot = {
      ...snapshot,
      cards: {
        ...snapshot.cards,
        lastPlayed: appendBounded(
          snapshot.cards.lastPlayed,
          [card.definitionId],
          LAST_PLAYED_LIMIT,
        ),
      },
      economy: withEconomyPatch(snapshot.economy, {
        cash: snapshot.economy.cash - card.cost,
      }),
    };

    for (const operation of this.compiler.compile(card)) {
      next = this.applyOperation(next, operation, actorId);
    }

    next = this.applySpecialCardRules(next, card, actorId);

    return next;
  }

  private assertExecutionPreconditions(
    snapshot: RunStateSnapshot,
    card: CardInstance,
    actorId: string,
  ): void {
    if (snapshot.economy.cash < card.cost) {
      throw new Error(
        `Insufficient cash to execute ${card.definitionId}. Required ${card.cost}, current ${snapshot.economy.cash}.`,
      );
    }

    if (!isDefectionCard(card.definitionId)) {
      return;
    }

    if (snapshot.mode !== 'coop') {
      throw new Error(
        `Defection card ${card.definitionId} cannot execute outside coop mode.`,
      );
    }

    const expectedStep = resolveDefectionStep(card.definitionId);
    const currentStep = snapshot.modeState.defectionStepByPlayer[actorId] ?? 0;

    if (expectedStep === null || expectedStep !== currentStep + 1) {
      throw new Error(
        `Defection card ${card.definitionId} is out of sequence for actor ${actorId}. Current step ${currentStep}.`,
      );
    }
  }

  private applyOperation(
    snapshot: RunStateSnapshot,
    operation: CompiledOperation,
    actorId: string,
  ): RunStateSnapshot {
    switch (operation.kind) {
      case 'cash':
        return {
          ...snapshot,
          economy: withEconomyPatch(snapshot.economy, {
            cash: snapshot.economy.cash + operation.magnitude,
          }),
        };

      case 'income':
        return {
          ...snapshot,
          economy: withEconomyPatch(snapshot.economy, {
            incomePerTick: snapshot.economy.incomePerTick + operation.magnitude,
          }),
        };

      case 'shield':
        return {
          ...snapshot,
          shield: withShieldDelta(
            snapshot.shield,
            operation.magnitude,
            snapshot.tick,
          ),
        };

      case 'heat':
        return {
          ...snapshot,
          economy: withEconomyPatch(snapshot.economy, {
            haterHeat: snapshot.economy.haterHeat + operation.magnitude,
          }),
        };

      case 'trust':
        return {
          ...snapshot,
          modeState: {
            ...snapshot.modeState,
            trustScores: {
              ...snapshot.modeState.trustScores,
              [actorId]: clamp(
                (snapshot.modeState.trustScores[actorId] ?? TRUST_DEFAULT) +
                  operation.magnitude,
                0,
                100,
              ),
            },
          },
        };

      case 'time':
        return {
          ...snapshot,
          timers: {
            ...snapshot.timers,
            extensionBudgetMs: Math.max(
              0,
              snapshot.timers.extensionBudgetMs + operation.magnitude,
            ),
          },
        };

      case 'divergence':
        return {
          ...snapshot,
          sovereignty: {
            ...snapshot.sovereignty,
            gapVsLegend: round4(
              snapshot.sovereignty.gapVsLegend + operation.magnitude,
            ),
          },
        };

      case 'inject':
        return {
          ...snapshot,
          cards: {
            ...snapshot.cards,
            drawHistory: appendBounded(
              snapshot.cards.drawHistory,
              operation.magnitude,
              DRAW_HISTORY_LIMIT,
            ),
          },
        };

      case 'cascadeTag':
        return this.applyCascadeTag(snapshot, operation.magnitude);
    }
  }

  private applyCascadeTag(
    snapshot: RunStateSnapshot,
    cascadeTag: string,
  ): RunStateSnapshot {
    const alreadyTracked = snapshot.cascade.positiveTrackers.includes(cascadeTag);

    return {
      ...snapshot,
      cascade: {
        ...snapshot.cascade,
        positiveTrackers: alreadyTracked
          ? [...snapshot.cascade.positiveTrackers]
          : appendBounded(
              snapshot.cascade.positiveTrackers,
              [cascadeTag],
              POSITIVE_TRACKER_LIMIT,
            ),
        repeatedTriggerCounts: {
          ...snapshot.cascade.repeatedTriggerCounts,
          [cascadeTag]:
            (snapshot.cascade.repeatedTriggerCounts[cascadeTag] ?? 0) + 1,
        },
        lastResolvedTick: snapshot.tick,
      },
    };
  }

  private applySpecialCardRules(
    snapshot: RunStateSnapshot,
    card: CardInstance,
    actorId: string,
  ): RunStateSnapshot {
    let next = snapshot;

    if (card.definitionId === 'SYSTEMIC_OVERRIDE') {
      next = {
        ...next,
        battle: {
          ...next.battle,
          bots: next.battle.bots.map(resetBotForSystemicOverride),
          pendingAttacks: [],
          rivalryHeatCarry: 0,
          extractionCooldownTicks: 0,
          firstBloodClaimed: false,
        },
      };
    }

    if (card.definitionId === 'CASCADE_BREAK') {
      next = {
        ...next,
        cascade: {
          ...next.cascade,
          brokenChains:
            next.cascade.brokenChains + next.cascade.activeChains.length,
          activeChains: [],
          positiveTrackers: [],
          repeatedTriggerCounts: {},
          lastResolvedTick: next.tick,
        },
      };
    }

    const defectionStep = resolveDefectionStep(card.definitionId);
    if (defectionStep !== null) {
      next = this.applyDefectionProgression(next, defectionStep, actorId);
    }

    return next;
  }

  private applyDefectionProgression(
    snapshot: RunStateSnapshot,
    step: 1 | 2 | 3,
    actorId: string,
  ): RunStateSnapshot {
    let next: RunStateSnapshot = {
      ...snapshot,
      modeState: {
        ...snapshot.modeState,
        defectionStepByPlayer: {
          ...snapshot.modeState.defectionStepByPlayer,
          [actorId]: step,
        },
      },
    };

    if (step !== 3) {
      return next;
    }

    const treasury = snapshot.modeState.sharedTreasuryBalance;
    const theft = Math.floor(treasury * 0.4);

    next = {
      ...next,
      economy: withEconomyPatch(next.economy, {
        cash: next.economy.cash + theft,
      }),
      modeState: {
        ...next.modeState,
        sharedTreasuryBalance: Math.max(0, treasury - theft),
      },
      sovereignty: {
        ...next.sovereignty,
        sovereigntyScore: round4(
          Math.max(0, next.sovereignty.sovereigntyScore - 0.15),
        ),
      },
    };

    return next;
  }
}