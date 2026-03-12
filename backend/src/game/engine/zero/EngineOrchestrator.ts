/*
 * POINT ZERO ONE — BACKEND ENGINE 15X GENERATOR
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/game/engine/zero/EngineOrchestrator.ts
 *
 * Doctrine:
 * - backend becomes the authoritative simulation surface
 * - seven engines remain distinct
 * - mode-native rules are enforced at runtime
 * - cards are backend-validated, not UI-trusted
 * - proof / integrity / CORD remain backend-owned
 */

import { EventBus } from '../core/EventBus';
import { SystemClock } from '../core/ClockSource';
import { checksumSnapshot, createDeterministicId, deepFrozenClone } from '../core/Deterministic';
import { createInitialRunState } from '../core/RunStateFactory';
import type { EngineEventMap, ModeCode, Targeting } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import { TICK_SEQUENCE } from '../core/TickSequence';
import { EngineRegistry } from '../core/EngineRegistry';
import { TimeEngine } from '../time/TimeEngine';
import { PressureEngine } from '../pressure/PressureEngine';
import { TensionEngine } from '../tension/TensionEngine';
import { ShieldEngine } from '../shield/ShieldEngine';
import { BattleEngine } from '../battle/BattleEngine';
import { CascadeEngine } from '../cascade/CascadeEngine';
import { SovereigntyEngine } from '../sovereignty/SovereigntyEngine';
import { ModeRegistry } from '../modes/ModeRegistry';
import { EmpireModeAdapter } from '../modes/EmpireModeAdapter';
import { PredatorModeAdapter } from '../modes/PredatorModeAdapter';
import { SyndicateModeAdapter } from '../modes/SyndicateModeAdapter';
import { PhantomModeAdapter } from '../modes/PhantomModeAdapter';
import { CardRegistry } from '../cards/CardRegistry';
import { CardLegalityService } from '../cards/CardLegalityService';
import { CardEffectExecutor } from '../cards/CardEffectExecutor';

export interface StartRunInput {
  userId: string;
  mode: ModeCode;
  seed?: string;
  communityHeatModifier?: number;
}

export class EngineOrchestrator {
  private readonly clock = new SystemClock();
  private readonly bus = new EventBus<EngineEventMap>();
  private readonly registry = new EngineRegistry();
  private readonly modeRegistry = new ModeRegistry();
  private readonly cardRegistry = new CardRegistry();
  private readonly cardLegality = new CardLegalityService(this.cardRegistry);
  private readonly cardExecutor = new CardEffectExecutor();
  private readonly time = new TimeEngine();
  private readonly pressure = new PressureEngine();
  private readonly tension = new TensionEngine();
  private readonly shield = new ShieldEngine();
  private readonly battle = new BattleEngine();
  private readonly cascade = new CascadeEngine();
  private readonly sovereignty = new SovereigntyEngine();
  private current: RunStateSnapshot | null = null;

  public constructor() {
    for (const engine of [this.time, this.pressure, this.tension, this.shield, this.battle, this.cascade, this.sovereignty]) {
      this.registry.register(engine);
    }
    for (const adapter of [new EmpireModeAdapter(), new PredatorModeAdapter(), new SyndicateModeAdapter(), new PhantomModeAdapter()]) {
      this.modeRegistry.register(adapter);
    }
  }

  public startRun(input: StartRunInput): RunStateSnapshot {
    const seed = input.seed ?? createDeterministicId(input.userId, input.mode, Date.now());
    const runId = createDeterministicId(seed, 'run');
    let snapshot = createInitialRunState({ runId, userId: input.userId, seed, mode: input.mode, communityHeatModifier: input.communityHeatModifier });
    snapshot = this.modeRegistry.mustGet(input.mode).configure(snapshot);
    this.registry.reset();
    this.bus.clear();
    this.bus.emit('run.started', { runId, mode: input.mode, seed });
    this.current = deepFrozenClone(snapshot);
    return this.current;
  }

  public getSnapshot(): RunStateSnapshot {
    if (!this.current) {
      throw new Error('No active run. Call startRun() first.');
    }
    return this.current;
  }

  public playCard(definitionId: string, actorId: string, targeting: Targeting = 'SELF'): RunStateSnapshot {
    const current = this.getSnapshot();
    const card = this.cardLegality.mustResolve(current, definitionId, targeting);
    let next = this.cardExecutor.apply(current, card, actorId);
    next.cards.lastPlayed = [card.definitionId, ...next.cards.lastPlayed].slice(0, 3);
    next.cards.discard = [...next.cards.discard, card.definitionId];
    next.cards.hand = next.cards.hand.filter((entry) => entry.instanceId !== card.instanceId);
    next.telemetry.decisions = [
      ...next.telemetry.decisions,
      {
        tick: next.tick,
        actorId,
        cardId: card.definitionId,
        latencyMs: card.card.decisionTimerOverrideMs ?? next.timers.currentTickDurationMs,
        timingClass: card.timingClass,
        accepted: true,
      },
    ];
    this.bus.emit('card.played', { runId: next.runId, actorId, cardId: card.definitionId, tick: next.tick, mode: next.mode });
    this.current = deepFrozenClone(next);
    return this.current;
  }

  public advanceTick(): RunStateSnapshot {
    let snapshot = this.getSnapshot();
    const nowMs = this.clock.now();
    this.bus.emit('tick.started', { runId: snapshot.runId, tick: snapshot.tick + 1, phase: snapshot.phase });

    for (const step of TICK_SEQUENCE) {
      const context = { step, nowMs, clock: this.clock, bus: this.bus } as const;
      switch (step) {
        case 'STEP_02_TIME':
          snapshot = this.time.tick(snapshot, context);
          break;
        case 'STEP_03_PRESSURE':
          snapshot = this.pressure.tick(snapshot, context);
          break;
        case 'STEP_04_TENSION':
          snapshot = this.tension.tick(snapshot, context);
          break;
        case 'STEP_05_BATTLE':
          snapshot = this.battle.tick(snapshot, context);
          break;
        case 'STEP_06_SHIELD':
          snapshot = this.shield.tick(snapshot, context);
          break;
        case 'STEP_07_CASCADE':
          snapshot = this.cascade.tick(snapshot, context);
          break;
        case 'STEP_10_SOVEREIGNTY_SNAPSHOT':
          snapshot = this.sovereignty.tick(snapshot, context);
          break;
        case 'STEP_11_OUTCOME_GATE':
          snapshot = this.resolveOutcome(snapshot);
          break;
        case 'STEP_12_EVENT_SEAL': {
          const checksum = checksumSnapshot({
            tick: snapshot.tick,
            phase: snapshot.phase,
            economy: snapshot.economy,
            pressure: snapshot.pressure,
            tension: snapshot.tension,
            shield: snapshot.shield,
            battle: { ...snapshot.battle, pendingAttacks: snapshot.battle.pendingAttacks.map((attack) => attack.attackId) },
            cascade: snapshot.cascade.activeChains.map((chain) => ({ chainId: chain.chainId, status: chain.status, links: chain.links.map((link) => link.linkId) })),
          });
          snapshot.sovereignty.tickChecksums = [...snapshot.sovereignty.tickChecksums, checksum];
          snapshot.telemetry.lastTickChecksum = checksum;
          this.bus.emit('tick.completed', { runId: snapshot.runId, tick: snapshot.tick, phase: snapshot.phase, checksum });
          break;
        }
        case 'STEP_13_FLUSH':
          this.bus.flush();
          break;
        default:
          break;
      }
    }

    if (snapshot.outcome !== null && snapshot.sovereignty.proofHash === null) {
      snapshot = this.sovereignty.finalizeRun(snapshot, this.bus, this.clock.now());
    }

    this.current = deepFrozenClone(snapshot);
    return this.current;
  }

  private resolveOutcome(snapshot: RunStateSnapshot): RunStateSnapshot {
    if (snapshot.outcome !== null) {
      return snapshot;
    }
    if (snapshot.economy.netWorth >= snapshot.economy.freedomTarget) {
      return { ...snapshot, outcome: 'FREEDOM' };
    }
    if (snapshot.economy.cash < 0) {
      return { ...snapshot, outcome: 'BANKRUPT' };
    }
    if (snapshot.timers.elapsedMs >= snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs) {
      return { ...snapshot, outcome: 'TIMEOUT' };
    }
    return snapshot;
  }
}
