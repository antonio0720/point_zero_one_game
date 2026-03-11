// FILE: backend/src/game/engine/tension/__tests__/ThreatRoutingService.tension.spec.ts

import { describe, expect, it } from 'vitest';

import type { ThreatEnvelope } from '../../core/GamePrimitives';
import { createInitialRunState } from '../../core/RunStateFactory';
import type {
  BotRuntimeState,
  RunStateSnapshot,
} from '../../core/RunStateSnapshot';
import { ThreatRoutingService } from '../../core/ThreatRoutingService';

let threatSequence = 0;

function createSnapshot(
  mode: RunStateSnapshot['mode'] = 'solo',
): RunStateSnapshot {
  return createInitialRunState({
    runId: `run-routing-${mode}`,
    userId: `user-routing-${mode}`,
    seed: `seed-routing-${mode}`,
    mode,
  });
}

function createThreat(
  overrides: Partial<ThreatEnvelope> = {},
): ThreatEnvelope {
  threatSequence += 1;

  return {
    threatId: overrides.threatId ?? `threat-routing-${threatSequence}`,
    source: overrides.source ?? 'SYSTEM_PRESSURE',
    etaTicks: overrides.etaTicks ?? 0,
    severity: overrides.severity ?? 6,
    visibleAs: overrides.visibleAs ?? 'PARTIAL',
    summary: overrides.summary ?? 'Debt pressure window is now active.',
  };
}

function createBot(
  overrides: Partial<BotRuntimeState> = {},
): BotRuntimeState {
  return {
    botId: overrides.botId ?? 'BOT_01',
    label: overrides.label ?? 'Liquidator',
    state: overrides.state ?? 'ATTACKING',
    heat: overrides.heat ?? 72,
    lastAttackTick: overrides.lastAttackTick ?? null,
    attacksLanded: overrides.attacksLanded ?? 0,
    attacksBlocked: overrides.attacksBlocked ?? 0,
    neutralized: overrides.neutralized ?? false,
  };
}

describe('ThreatRoutingService — tension surfaces', () => {
  it('routes matured tension threats into battle attacks while preserving deferred threats', () => {
    const service = new ThreatRoutingService();
    const base = createSnapshot('solo');

    const snapshot: RunStateSnapshot = {
      ...base,
      tick: 7,
      tension: {
        ...base.tension,
        visibleThreats: [
          createThreat({
            threatId: 'matured-threat',
            etaTicks: 0,
            severity: 8,
            visibleAs: 'PARTIAL',
            summary: 'Debt breach arrives now.',
          }),
          createThreat({
            threatId: 'deferred-threat',
            etaTicks: 2,
            severity: 4,
            visibleAs: 'SILHOUETTE',
            summary: 'Freeze filing arrives later.',
          }),
        ],
      },
      battle: {
        ...base.battle,
        pendingAttacks: [],
      },
    };

    const result = service.apply(snapshot, {
      spawnAmbientThreats: false,
      allowBotRouting: false,
    });

    expect(result.routes).toHaveLength(1);
    expect(result.injectedAttacks).toHaveLength(1);
    expect(result.deferredThreats).toHaveLength(1);

    expect(result.routes[0]?.threatId).toBe('matured-threat');
    expect(result.routes[0]?.category).toBe('DEBT');

    expect(result.injectedAttacks[0]?.createdAtTick).toBe(7);
    expect(result.snapshot.battle.pendingAttacks).toHaveLength(1);
    expect(result.snapshot.tension.visibleThreats).toHaveLength(1);
    expect(result.snapshot.tension.visibleThreats[0]?.threatId).toBe(
      'deferred-threat',
    );
  });

  it('deduplicates identical tension threats only when strictDedup is enabled', () => {
    const service = new ThreatRoutingService();
    const base = createSnapshot('solo');

    const duplicatedThreats: readonly ThreatEnvelope[] = [
      createThreat({
        threatId: 'dup-threat',
        source: 'SYSTEM_PRESSURE',
        etaTicks: 0,
        severity: 4,
        visibleAs: 'SILHOUETTE',
        summary: 'Debt lock window active.',
      }),
      createThreat({
        threatId: 'dup-threat',
        source: 'SYSTEM_PRESSURE',
        etaTicks: 0,
        severity: 9,
        visibleAs: 'EXPOSED',
        summary: 'Debt lock window active.',
      }),
    ];

    const snapshot: RunStateSnapshot = {
      ...base,
      tick: 5,
      tension: {
        ...base.tension,
        visibleThreats: duplicatedThreats,
      },
      battle: {
        ...base.battle,
        pendingAttacks: [],
      },
    };

    const strict = service.apply(snapshot, {
      spawnAmbientThreats: false,
      allowBotRouting: false,
      strictDedup: true,
    });

    const permissive = service.apply(snapshot, {
      spawnAmbientThreats: false,
      allowBotRouting: false,
      strictDedup: false,
    });

    expect(strict.routes).toHaveLength(1);
    expect(permissive.routes).toHaveLength(2);
    expect(strict.routes[0]?.threatId).toBe('dup-threat');
    expect(
      permissive.routes.every((route) => route.threatId === 'dup-threat'),
    ).toBe(true);

    expect(strict.injectedAttacks).toHaveLength(1);
    expect(permissive.injectedAttacks).toHaveLength(2);
  });

  it('honors disabled bots so tension-adjacent routing never turns them into attacks', () => {
    const service = new ThreatRoutingService();
    const base = createSnapshot('solo');

    const snapshot: RunStateSnapshot = {
      ...base,
      tension: {
        ...base.tension,
        visibleThreats: [],
      },
      battle: {
        ...base.battle,
        pendingAttacks: [],
        bots: [
          createBot({
            botId: 'BOT_01',
            state: 'ATTACKING',
            heat: 90,
          }),
        ],
      },
      modeState: {
        ...base.modeState,
        disabledBots: ['BOT_01'],
      },
    };

    const result = service.apply(snapshot, {
      spawnAmbientThreats: false,
      allowBotRouting: true,
    });

    expect(result.routes).toHaveLength(0);
    expect(result.injectedAttacks).toHaveLength(0);
    expect(result.snapshot.battle.pendingAttacks).toEqual([]);
  });

  it('caps injected attacks by maxNewAttacks while preserving deterministic ordering', () => {
    const service = new ThreatRoutingService();
    const base = createSnapshot('solo');

    const snapshot: RunStateSnapshot = {
      ...base,
      tick: 11,
      tension: {
        ...base.tension,
        visibleThreats: [
          createThreat({
            threatId: 'threat-a',
            etaTicks: 0,
            severity: 10,
            visibleAs: 'EXPOSED',
            summary: 'Debt rupture is live now.',
          }),
          createThreat({
            threatId: 'threat-b',
            etaTicks: 0,
            severity: 8,
            visibleAs: 'PARTIAL',
            summary: 'Credit breach is live now.',
          }),
          createThreat({
            threatId: 'threat-c',
            etaTicks: 0,
            severity: 7,
            visibleAs: 'PARTIAL',
            summary: 'Freeze filing is live now.',
          }),
        ],
      },
      battle: {
        ...base.battle,
        pendingAttacks: [],
      },
    };

    const result = service.apply(snapshot, {
      spawnAmbientThreats: false,
      allowBotRouting: false,
      maxNewAttacks: 2,
    });

    expect(result.routes).toHaveLength(3);
    expect(result.injectedAttacks).toHaveLength(2);
    expect(result.snapshot.battle.pendingAttacks).toHaveLength(2);

    expect(result.injectedAttacks[0]?.createdAtTick).toBe(11);
    expect(result.injectedAttacks[1]?.createdAtTick).toBe(11);
  });
});