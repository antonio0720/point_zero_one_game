/*
 * POINT ZERO ONE — BACKEND ENGINE 15X GENERATOR
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/game/engine/battle/BattleEngine.ts
 *
 * Doctrine:
 * - backend becomes the authoritative simulation surface
 * - seven engines remain distinct
 * - mode-native rules are enforced at runtime
 * - cards are backend-validated, not UI-trusted
 * - proof / integrity / CORD remain backend-owned
 */

import type { EngineHealth, SimulationEngine, TickContext } from '../core/EngineContracts';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import { BotProfileRegistry } from './BotProfileRegistry';
import { HaterBotController } from './HaterBotController';
import { BattleBudgetManager } from './BattleBudgetManager';
import { AttackInjector } from './AttackInjector';

export class BattleEngine implements SimulationEngine {
  public readonly engineId = 'battle' as const;
  private readonly profiles = new BotProfileRegistry();
  private readonly controller = new HaterBotController();
  private readonly budget = new BattleBudgetManager();
  private readonly injector = new AttackInjector();

  public reset(): void {}

  public tick(snapshot: RunStateSnapshot, context: TickContext): RunStateSnapshot {
    const runtimeBots = snapshot.battle.bots.length > 0
      ? snapshot.battle.bots
      : this.profiles.all().map((profile) => ({
          botId: profile.botId,
          label: profile.label,
          state: 'DORMANT' as const,
          heat: 0,
          lastAttackTick: null,
          attacksLanded: 0,
          attacksBlocked: 0,
          neutralized: false,
        }));

    const compositeHeatBase = snapshot.economy.haterHeat + snapshot.modeState.communityHeatModifier + snapshot.battle.rivalryHeatCarry;
    const nextBots = runtimeBots.map((runtime) => {
      const profile = this.profiles.all().find((entry) => entry.botId === runtime.botId)!;
      return this.controller.evolve(runtime, profile, compositeHeatBase + snapshot.pressure.score, snapshot.tick);
    });

    const injected = nextBots
      .filter((bot) => bot.state === 'ATTACKING')
      .filter((bot) => snapshot.tick === 1 || (bot.lastAttackTick === null || snapshot.tick - bot.lastAttackTick >= 3))
      .map((bot) => {
        const profile = this.profiles.all().find((entry) => entry.botId === bot.botId)!;
        const attack = this.injector.create(snapshot.runId, snapshot.tick, profile, snapshot.pressure.score, snapshot.mode);
        context.bus.emit('battle.attack.injected', { attack });
        return attack;
      });

    const updatedBots = nextBots.map((bot) => injected.some((attack) => attack.source === bot.botId) ? { ...bot, lastAttackTick: snapshot.tick } : bot);

    return {
      ...snapshot,
      battle: {
        ...snapshot.battle,
        bots: updatedBots,
        battleBudget: snapshot.mode === 'pvp' ? this.budget.accrue(snapshot.battle.battleBudget, snapshot.pressure.tier, snapshot.battle.battleBudgetCap) : snapshot.battle.battleBudget,
        extractionCooldownTicks: Math.max(0, snapshot.battle.extractionCooldownTicks - 1),
        pendingAttacks: [...snapshot.battle.pendingAttacks, ...injected],
      },
    };
  }

  public getHealth(): EngineHealth {
    return { engineId: this.engineId, status: 'HEALTHY', updatedAt: Date.now() };
  }
}
