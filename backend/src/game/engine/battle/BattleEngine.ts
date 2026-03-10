/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/battle/BattleEngine.ts
 *
 * Doctrine:
 * - battle is backend-authoritative and immutable-input compliant
 * - engine output must be a new snapshot, never an in-place mutation
 * - hostile posture, injections, and counterplay economy are deterministic
 * - do not duplicate baseline budget accrual or cooldown decay already handled by EngineRuntime
 */

import type {
  EngineHealth,
  EngineTickResult,
  SimulationEngine,
  TickContext,
} from '../core/EngineContracts';
import type { AttackEvent, HaterBotId } from '../core/GamePrimitives';
import type {
  BotRuntimeState,
  RunStateSnapshot,
} from '../core/RunStateSnapshot';
import {
  createEngineHealth,
  createEngineSignal,
} from '../core/EngineContracts';
import { BotProfileRegistry } from './BotProfileRegistry';
import { HaterBotController } from './HaterBotController';
import { BattleBudgetManager } from './BattleBudgetManager';
import { AttackInjector } from './AttackInjector';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export class BattleEngine implements SimulationEngine {
  public readonly engineId = 'battle' as const;

  private readonly profiles = new BotProfileRegistry();
  private readonly controller = new HaterBotController();
  private readonly budget = new BattleBudgetManager();
  private readonly injector = new AttackInjector();

  public reset(): void {}

  public canRun(snapshot: RunStateSnapshot, context: TickContext): boolean {
    return context.step === 'STEP_05_BATTLE' && snapshot.outcome === null;
  }

  public tick(
    snapshot: RunStateSnapshot,
    context: TickContext,
  ): RunStateSnapshot | EngineTickResult {
    if (!this.canRun(snapshot, context)) {
      return {
        snapshot,
        signals: [
          createEngineSignal(
            this.engineId,
            'INFO',
            'BATTLE_SKIPPED',
            'BattleEngine skipped for this step or terminal state.',
            snapshot.tick,
          ),
        ],
      };
    }

    const runtimeBots = this.hydrateRuntimeBots(snapshot);
    const baseHeat = this.computeBaseHeat(snapshot);

    const evolutions = runtimeBots.map((runtime) => {
      const profile = this.profiles.byId(runtime.botId);

      return this.controller.evolve(runtime, profile, {
        baseHeat,
        pressureScore: snapshot.pressure.score,
        rivalryHeatCarry: snapshot.battle.rivalryHeatCarry,
        mode: snapshot.mode,
        tick: snapshot.tick,
      });
    });

    const nextBotsPreAttack = evolutions.map((entry) => entry.runtime);
    const signals = evolutions
      .filter((entry) => entry.stateChanged)
      .map((entry) =>
        createEngineSignal(
          this.engineId,
          'INFO',
          'BOT_STATE_CHANGED',
          `${entry.runtime.botId} changed from ${entry.previousState} to ${entry.nextState}.`,
          snapshot.tick,
          [entry.runtime.botId, entry.previousState, entry.nextState],
        ),
      );

    for (const entry of evolutions) {
      if (!entry.stateChanged) {
        continue;
      }

      context.bus.emit('battle.bot.state_changed', {
        botId: entry.runtime.botId,
        from: entry.previousState,
        to: entry.nextState,
        tick: snapshot.tick,
      });
    }

    const injectedAttacks = evolutions
      .filter((entry) => {
        const profile = this.profiles.byId(entry.runtime.botId);

        return this.canInjectAttack({
          bot: entry.runtime,
          profile,
          snapshot,
        });
      })
      .map((entry, index) => {
        const profile = this.profiles.byId(entry.runtime.botId);

        return this.injector.create({
          runId: snapshot.runId,
          tick: snapshot.tick,
          attackIndex: index + 1,
          mode: snapshot.mode,
          profile,
          pressureScore: snapshot.pressure.score,
          compositeThreat: entry.compositeThreat,
          firstBloodClaimed: snapshot.battle.firstBloodClaimed,
        });
      });

    for (const attack of injectedAttacks) {
      context.bus.emit('battle.attack.injected', { attack });
      context.bus.emit('threat.routed', {
        threatId: attack.attackId,
        source: attack.source,
        category: attack.category,
        targetLayer: attack.targetLayer,
        targetEntity: attack.targetEntity,
      });
    }

    const botsAfterInjection = nextBotsPreAttack.map((bot) =>
      injectedAttacks.some((attack) => attack.source === bot.botId)
        ? {
            ...bot,
            lastAttackTick: snapshot.tick,
          }
        : bot,
    );

    const budgetResolution = this.budget.resolveAfterInjection({
      current: snapshot.battle.battleBudget,
      cap: snapshot.battle.battleBudgetCap,
      mode: snapshot.mode,
      injectedAttacks,
      firstBloodClaimed: snapshot.battle.firstBloodClaimed,
    });

    const nextPendingAttacks = this.mergePendingAttacks(
      snapshot.battle.pendingAttacks,
      injectedAttacks,
    );

    const nextSnapshot: RunStateSnapshot = {
      ...snapshot,
      battle: {
        ...snapshot.battle,
        bots: botsAfterInjection,
        battleBudget: budgetResolution.battleBudget,
        extractionCooldownTicks: this.resolveExtractionCooldown(
          snapshot,
          injectedAttacks,
        ),
        firstBloodClaimed: budgetResolution.firstBloodClaimed,
        pendingAttacks: nextPendingAttacks,
        sharedOpportunityDeckCursor: snapshot.modeState.sharedOpportunityDeck
          ? snapshot.battle.sharedOpportunityDeckCursor + injectedAttacks.length
          : snapshot.battle.sharedOpportunityDeckCursor,
        rivalryHeatCarry: this.resolveRivalryHeatCarry(
          snapshot,
          botsAfterInjection,
          injectedAttacks,
        ),
        neutralizedBotIds: botsAfterInjection
          .filter((bot) => bot.neutralized)
          .map((bot) => bot.botId),
      },
    };

    const projectedPressureTax = this.budget.resolveProjectedPressureTax(
      nextPendingAttacks,
    );

    const resultSignals = [
      ...signals,
      ...(budgetResolution.notes.length > 0
        ? [
            createEngineSignal(
              this.engineId,
              'INFO',
              'COUNTERPLAY_BUDGET_UPDATED',
              'Battle counterplay budget adjusted by hostile injections.',
              snapshot.tick,
              budgetResolution.notes,
            ),
          ]
        : []),
      ...(injectedAttacks.length > 0
        ? [
            createEngineSignal(
              this.engineId,
              'WARN',
              'HOSTILE_ATTACKS_INJECTED',
              `${injectedAttacks.length} hostile attack(s) injected.`,
              snapshot.tick,
              [
                `count:${String(injectedAttacks.length)}`,
                `projected-pressure-tax:${String(projectedPressureTax)}`,
              ],
            ),
          ]
        : []),
    ];

    return {
      snapshot: nextSnapshot,
      signals: resultSignals,
    };
  }

  public getHealth(): EngineHealth {
    return createEngineHealth(this.engineId, 'HEALTHY', Date.now(), [
      'battle-engine-online',
      'immutable-input-compliant',
    ]);
  }

  private hydrateRuntimeBots(snapshot: RunStateSnapshot): BotRuntimeState[] {
    const existingById = new Map<HaterBotId, BotRuntimeState>(
      snapshot.battle.bots.map((bot) => [bot.botId, bot]),
    );

    const disabled = new Set<HaterBotId>(snapshot.modeState.disabledBots);
    const neutralized = new Set<HaterBotId>(snapshot.battle.neutralizedBotIds);

    return this.profiles.all().map((profile) => {
      const existing = existingById.get(profile.botId);
      const isNeutralized =
        disabled.has(profile.botId) || neutralized.has(profile.botId);

      if (!existing) {
        return {
          botId: profile.botId,
          label: profile.label,
          state: isNeutralized ? 'NEUTRALIZED' : 'DORMANT',
          heat: 0,
          lastAttackTick: null,
          attacksLanded: 0,
          attacksBlocked: 0,
          neutralized: isNeutralized,
        };
      }

      return isNeutralized
        ? {
            ...existing,
            state: 'NEUTRALIZED',
            neutralized: true,
            heat: 0,
          }
        : existing;
    });
  }

  private computeBaseHeat(snapshot: RunStateSnapshot): number {
    const community =
      snapshot.economy.haterHeat +
      snapshot.modeState.communityHeatModifier +
      snapshot.battle.rivalryHeatCarry;

    const projectedAttackTax = this.budget.resolveProjectedPressureTax(
      snapshot.battle.pendingAttacks,
    );

    return round2(clamp(community + projectedAttackTax, 0, 100));
  }

  private canInjectAttack(args: {
    readonly bot: BotRuntimeState;
    readonly profile: ReturnType<BotProfileRegistry['byId']>;
    readonly snapshot: RunStateSnapshot;
  }): boolean {
    const { bot, profile, snapshot } = args;

    if (bot.neutralized) {
      return false;
    }

    if (snapshot.modeState.disabledBots.includes(bot.botId)) {
      return false;
    }

    if (bot.state !== 'ATTACKING') {
      return false;
    }

    if (bot.lastAttackTick !== null) {
      const elapsed = snapshot.tick - bot.lastAttackTick;
      if (elapsed < profile.cooldownTicks) {
        return false;
      }
    }

    if (
      snapshot.mode === 'pvp' &&
      profile.preferredCategory === 'EXTRACTION' &&
      snapshot.battle.extractionCooldownTicks > 0
    ) {
      return false;
    }

    if (
      snapshot.mode === 'ghost' &&
      profile.preferredCategory === 'BREACH' &&
      snapshot.cards.ghostMarkers.length === 0
    ) {
      return false;
    }

    return true;
  }

  private mergePendingAttacks(
    existing: readonly AttackEvent[],
    injected: readonly AttackEvent[],
  ): AttackEvent[] {
    const map = new Map<string, AttackEvent>();

    const ordered = [...existing, ...injected].sort((left, right) => {
      if (left.createdAtTick !== right.createdAtTick) {
        return left.createdAtTick - right.createdAtTick;
      }

      return left.attackId.localeCompare(right.attackId);
    });

    for (const attack of ordered) {
      map.set(attack.attackId, attack);
    }

    const merged = Array.from(map.values());
    return merged.slice(Math.max(0, merged.length - 64));
  }

  private resolveExtractionCooldown(
    snapshot: RunStateSnapshot,
    injected: readonly AttackEvent[],
  ): number {
    if (snapshot.mode !== 'pvp') {
      return snapshot.battle.extractionCooldownTicks;
    }

    const hostileExtraction = injected.some(
      (attack) => attack.category === 'EXTRACTION',
    );

    if (!hostileExtraction) {
      return snapshot.battle.extractionCooldownTicks;
    }

    return Math.max(snapshot.battle.extractionCooldownTicks, 3);
  }

  private resolveRivalryHeatCarry(
    snapshot: RunStateSnapshot,
    bots: readonly BotRuntimeState[],
    injected: readonly AttackEvent[],
  ): number {
    const decayed = Math.max(
      0,
      Math.round(snapshot.battle.rivalryHeatCarry * 0.82) -
        (snapshot.mode === 'coop' ? 2 : 1),
    );

    const postureContribution = bots.reduce((sum, bot) => {
      if (bot.state === 'WATCHING') {
        return sum + 1;
      }

      if (bot.state === 'TARGETING') {
        return sum + 2;
      }

      if (bot.state === 'ATTACKING') {
        return sum + 5;
      }

      return sum;
    }, 0);

    const injectionContribution = injected.length * 4;
    const modeBias =
      snapshot.mode === 'pvp' ? 3 : snapshot.mode === 'ghost' ? 2 : 0;

    return clamp(
      decayed + postureContribution + injectionContribution + modeBias,
      0,
      100,
    );
  }
}