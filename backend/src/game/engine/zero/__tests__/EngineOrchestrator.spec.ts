// backend/src/game/engine/zero/__tests__/EngineOrchestrator.spec.ts

import { describe, expect, it } from 'vitest';

import { createInitialRunState } from '../../core/RunStateFactory';
import type { RunStateSnapshot } from '../../core/RunStateSnapshot';
import { EngineOrchestrator } from '../EngineOrchestrator';

function cloneSnapshot(snapshot: RunStateSnapshot): RunStateSnapshot {
  return structuredClone(snapshot) as RunStateSnapshot;
}

describe.sequential('EngineOrchestrator', () => {
  it('throws when getSnapshot() is called before startRun()', () => {
    const orchestrator = new EngineOrchestrator();

    expect(() => orchestrator.getSnapshot()).toThrow(/No active run/i);
  });

  it('startRun() seeds a deeply frozen authoritative snapshot and queues run.started', () => {
    const orchestrator = new EngineOrchestrator();

    const snapshot = orchestrator.startRun({
      userId: 'user-engine-zero',
      mode: 'solo',
      seed: 'seed-engine-zero-start',
    });

    const bus = (orchestrator as any).bus;
    const registry = (orchestrator as any).registry;

    expect(snapshot.schemaVersion).toBe('engine-run-state.v2');
    expect(snapshot.userId).toBe('user-engine-zero');
    expect(snapshot.mode).toBe('solo');
    expect(snapshot.seed).toBe('seed-engine-zero-start');
    expect(snapshot.tick).toBe(0);
    expect(snapshot.phase).toBe('FOUNDATION');
    expect(snapshot.outcome).toBeNull();

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.economy)).toBe(true);
    expect(Object.isFrozen(snapshot.shield.layers)).toBe(true);

    expect(registry.snapshot().missingFromCanonicalOrder).toEqual([]);
    expect(registry.snapshot().executionOrder).toEqual([
      'time',
      'pressure',
      'tension',
      'shield',
      'battle',
      'cascade',
      'sovereignty',
    ]);

    expect(bus.queuedCount()).toBeGreaterThanOrEqual(1);
    expect(bus.last('run.started')?.payload).toMatchObject({
      runId: snapshot.runId,
      mode: 'solo',
      seed: 'seed-engine-zero-start',
    });
  });

  it('advanceTick() seals the tick, flushes the queue, and persists the completed snapshot', () => {
    const orchestrator = new EngineOrchestrator();

    const initial = orchestrator.startRun({
      userId: 'user-engine-zero-advance',
      mode: 'solo',
      seed: 'seed-engine-zero-advance',
    });

    const advanced = orchestrator.advanceTick();
    const bus = (orchestrator as any).bus;

    expect(advanced).not.toBe(initial);
    expect(advanced.tick).toBeGreaterThan(initial.tick);
    expect(advanced.telemetry.lastTickChecksum).toBeTruthy();
    expect(advanced.sovereignty.tickChecksums.length).toBeGreaterThan(0);

    expect(bus.queuedCount()).toBe(0);
    expect(bus.last('tick.started')?.payload).toMatchObject({
      runId: advanced.runId,
    });
    expect(bus.last('tick.completed')?.payload).toMatchObject({
      runId: advanced.runId,
      tick: advanced.tick,
      checksum: advanced.telemetry.lastTickChecksum,
    });

    expect(orchestrator.getSnapshot()).toEqual(advanced);
  });

  it('finalizes proof exactly once when a terminal snapshot is already present before the tick completes', () => {
    const orchestrator = new EngineOrchestrator();

    orchestrator.startRun({
      userId: 'user-engine-zero-proof',
      mode: 'solo',
      seed: 'seed-engine-zero-proof',
    });

    const terminal = cloneSnapshot(orchestrator.getSnapshot());
    terminal.outcome = 'FREEDOM';
    terminal.sovereignty = {
      ...terminal.sovereignty,
      proofHash: null,
      verifiedGrade: null,
      proofBadges: [],
      lastVerifiedTick: null,
    };

    (orchestrator as any).current = terminal;

    const first = orchestrator.advanceTick();
    const firstProofHash = first.sovereignty.proofHash;

    expect(first.outcome).toBe('FREEDOM');
    expect(firstProofHash).toBeTruthy();
    expect(first.sovereignty.verifiedGrade).toBeTruthy();

    const second = orchestrator.advanceTick();

    expect(second.sovereignty.proofHash).toBe(firstProofHash);
    expect(second.sovereignty.proofHash).not.toBeNull();
  });

  it('resolveOutcome path can surface BANKRUPT and TIMEOUT from mutated runtime state', () => {
    const orchestrator = new EngineOrchestrator();

    orchestrator.startRun({
      userId: 'user-engine-zero-outcomes',
      mode: 'solo',
      seed: 'seed-engine-zero-outcomes',
    });

    const bankrupt = cloneSnapshot(orchestrator.getSnapshot());
    bankrupt.economy = {
      ...bankrupt.economy,
      cash: -1,
    };
    (orchestrator as any).current = bankrupt;

    const afterBankruptTick = orchestrator.advanceTick();
    expect(afterBankruptTick.outcome).toBe('BANKRUPT');

    orchestrator.startRun({
      userId: 'user-engine-zero-timeout',
      mode: 'solo',
      seed: 'seed-engine-zero-timeout',
    });

    const timedOut = cloneSnapshot(orchestrator.getSnapshot());
    timedOut.timers = {
      ...timedOut.timers,
      elapsedMs: timedOut.timers.seasonBudgetMs + timedOut.timers.extensionBudgetMs,
    };
    (orchestrator as any).current = timedOut;

    const afterTimeoutTick = orchestrator.advanceTick();
    expect(afterTimeoutTick.outcome).toBe('TIMEOUT');
  });

  it('playCard() writes the card into discard + telemetry and emits card.played when a legal card can be resolved', () => {
    const orchestrator = new EngineOrchestrator();

    const started = orchestrator.startRun({
      userId: 'user-engine-zero-play-card',
      mode: 'solo',
      seed: 'seed-engine-zero-play-card',
    });

    const cardInstance = {
      instanceId: 'instance-test-card',
      definitionId: 'TEST_CARD',
      label: 'Test Card',
      timingClass: ['ACTION'],
      tags: ['TEST'],
      rarity: 'COMMON',
      price: 0,
      counterIntelCost: 0,
      decisionTimerOverrideMs: 500,
      legalTargets: ['SELF'],
      text: 'test',
    };

    const current = cloneSnapshot(started);
    current.cards = {
      ...current.cards,
      hand: [cardInstance as any],
    };

    (orchestrator as any).current = current;

    const legality = (orchestrator as any).cardLegality;
    const executor = (orchestrator as any).cardExecutor;
    const bus = (orchestrator as any).bus;

    const originalResolve = legality.mustResolve.bind(legality);
    const originalApply = executor.apply.bind(executor);

    legality.mustResolve = () =>
      ({
        definitionId: 'TEST_CARD',
        instanceId: 'instance-test-card',
        timingClass: ['ACTION'],
        card: {
          decisionTimerOverrideMs: 500,
        },
      }) as any;

    executor.apply = (snapshot: RunStateSnapshot) =>
      ({
        ...snapshot,
      }) as RunStateSnapshot;

    try {
      const afterPlay = orchestrator.playCard('TEST_CARD', 'user-engine-zero-play-card');

      expect(afterPlay.cards.hand).toHaveLength(0);
      expect(afterPlay.cards.discard).toContain('TEST_CARD');
      expect(afterPlay.cards.lastPlayed[0]).toBe('TEST_CARD');
      expect(afterPlay.telemetry.decisions.at(-1)).toMatchObject({
        actorId: 'user-engine-zero-play-card',
        cardId: 'TEST_CARD',
        accepted: true,
      });
      expect(bus.last('card.played')?.payload).toMatchObject({
        runId: afterPlay.runId,
        actorId: 'user-engine-zero-play-card',
        cardId: 'TEST_CARD',
        mode: afterPlay.mode,
      });
    } finally {
      legality.mustResolve = originalResolve;
      executor.apply = originalApply;
    }
  });
});