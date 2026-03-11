/**
 * ============================================================================
 * FILE: pzo-web/src/features/run/hooks/__tests__/useAnticipationQueue.spec.ts
 * ============================================================================
 *
 * Purpose:
 * - validate Engine 3 queue disclosure doctrine at the hook layer
 * - ensure UI consumers receive visibility-safe records instead of raw entries
 * - keep tests compatible with the current node-based Vitest environment
 *
 * Doctrine:
 * - mock Zustand selector surface only
 * - execute hook inside an SSR harness
 * - assert SHADOWED / TELEGRAPHED / EXPOSED behavior and immutable outputs
 * ============================================================================
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../store/engineStore', () => ({
  useEngineStore: vi.fn(),
}));

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  EntryState,
  ThreatSeverity,
  ThreatType,
  VisibilityState,
} from '../../../../engines/tension/types';
import { useEngineStore } from '../../../../store/engineStore';
import {
  useAnticipationQueue,
  type UseAnticipationQueueResult,
} from '../useAnticipationQueue';

interface MinimalQueueStoreState {
  tension: {
    sortedQueue: readonly ReturnType<typeof makeEntry>[];
    visibilityState: VisibilityState;
    currentTick: number;
    arrivedCount: number;
    queuedCount: number;
  };
}

type UseEngineStoreMock = {
  mockImplementation: (
    fn: (selector: (state: MinimalQueueStoreState) => unknown) => unknown,
  ) => unknown;
  mockReset: () => unknown;
};

const useEngineStoreMock = useEngineStore as unknown as UseEngineStoreMock;

function makeEntry(
  overrides: Partial<ReturnType<typeof buildBaseEntry>> = {},
): ReturnType<typeof buildBaseEntry> {
  return {
    ...buildBaseEntry(),
    ...overrides,
    mitigationCardTypes: Object.freeze(
      [...(overrides.mitigationCardTypes ?? ['INCOME_SHIELD'])],
    ),
  };
}

function buildBaseEntry() {
  return {
    entryId: 'entry-1',
    threatId: 'threat-1',
    threatType: ThreatType.DEBT_SPIRAL,
    threatSeverity: ThreatSeverity.MODERATE,
    enqueuedAtTick: 4,
    arrivalTick: 9,
    isCascadeTriggered: false,
    cascadeTriggerEventId: null,
    worstCaseOutcome: 'Lose 500 monthly income',
    mitigationCardTypes: Object.freeze(['INCOME_SHIELD']),
    baseTensionPerTick: 0.12,
    state: EntryState.QUEUED,
    isArrived: false,
    isMitigated: false,
    isExpired: false,
    isNullified: false,
    mitigatedAtTick: null,
    expiredAtTick: null,
    ticksOverdue: 0,
    decayTicksRemaining: 0,
  };
}

function buildState(
  overrides: Partial<MinimalQueueStoreState['tension']> = {},
): MinimalQueueStoreState {
  return {
    tension: {
      sortedQueue: Object.freeze([
        makeEntry({
          entryId: 'entry-default',
          threatId: 'threat-default',
        }),
      ]),
      visibilityState: VisibilityState.SHADOWED,
      currentTick: 6,
      arrivedCount: 0,
      queuedCount: 1,
      ...overrides,
    },
  };
}

function primeStore(state: MinimalQueueStoreState): void {
  useEngineStoreMock.mockImplementation(
    (selector: (store: MinimalQueueStoreState) => unknown): unknown => selector(state),
  );
}

function captureHook(): UseAnticipationQueueResult {
  let captured: UseAnticipationQueueResult | null = null;

  function Harness(): null {
    captured = useAnticipationQueue();
    return null;
  }

  renderToStaticMarkup(React.createElement(Harness));

  if (captured === null) {
    throw new Error('Failed to capture useAnticipationQueue() result.');
  }

  return captured;
}

describe('useAnticipationQueue', () => {
  beforeEach(() => {
    useEngineStoreMock.mockReset();
  });

  it('masks threat detail in SHADOWED visibility while preserving aggregate awareness', () => {
    const queuedA = makeEntry({
      entryId: 'entry-a',
      threatId: 'threat-a',
      threatType: ThreatType.DEBT_SPIRAL,
      threatSeverity: ThreatSeverity.SEVERE,
      arrivalTick: 10,
      worstCaseOutcome: 'Debt service consumes runway',
      mitigationCardTypes: Object.freeze(['INCOME_SHIELD']),
    });

    const queuedB = makeEntry({
      entryId: 'entry-b',
      threatId: 'threat-b',
      threatType: ThreatType.SABOTAGE,
      threatSeverity: ThreatSeverity.CRITICAL,
      arrivalTick: 12,
      worstCaseOutcome: 'Revenue source disabled',
      mitigationCardTypes: Object.freeze(['LEGAL_DEFENSE', 'CASH_BUFFER']),
    });

    primeStore(
      buildState({
        sortedQueue: Object.freeze([queuedA, queuedB]),
        visibilityState: VisibilityState.SHADOWED,
        currentTick: 7,
        arrivedCount: 0,
        queuedCount: 2,
      }),
    );

    const result = captureHook();

    expect(result.visibilityState).toBe(VisibilityState.SHADOWED);
    expect(result.showsThreatType).toBe(false);
    expect(result.showsArrivalTick).toBe(false);
    expect(result.showsMitigation).toBe(false);
    expect(result.showsWorstCase).toBe(false);

    expect(result.isEmpty).toBe(false);
    expect(result.hasArrivedThreats).toBe(false);
    expect(result.hasQueuedThreats).toBe(true);
    expect(result.threatCountLabel).toBe('2 THREATS DETECTED');
    expect(result.visibleThreatCount).toBe(2);
    expect(result.hiddenThreatCount).toBe(0);

    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]?.threatType).toBeNull();
    expect(result.entries[0]?.threatLabel).toBe('UNKNOWN THREAT');
    expect(result.entries[0]?.threatSeverity).toBeNull();
    expect(result.entries[0]?.severityLabel).toBeNull();
    expect(result.entries[0]?.arrivalTick).toBeNull();
    expect(result.entries[0]?.countdownTicks).toBeNull();
    expect(result.entries[0]?.mitigationPath).toBeNull();
    expect(result.entries[0]?.worstCase).toBeNull();

    expect(Object.isFrozen(result.entries)).toBe(true);
    expect(Object.isFrozen(result.rawEntries)).toBe(true);
    expect(Object.isFrozen(result.entries[0] as object)).toBe(true);
  });

  it('reveals threat type and countdown in TELEGRAPHED visibility', () => {
    const queued = makeEntry({
      entryId: 'entry-queued',
      threatId: 'threat-queued',
      threatType: ThreatType.DEBT_SPIRAL,
      threatSeverity: ThreatSeverity.SEVERE,
      arrivalTick: 13,
      worstCaseOutcome: 'Debt spiral triggers cascade',
      mitigationCardTypes: Object.freeze(['INCOME_SHIELD']),
    });

    const arrived = makeEntry({
      entryId: 'entry-arrived',
      threatId: 'threat-arrived',
      threatType: ThreatType.CASCADE,
      threatSeverity: ThreatSeverity.CRITICAL,
      arrivalTick: 8,
      isCascadeTriggered: true,
      state: EntryState.ARRIVED,
      isArrived: true,
      ticksOverdue: 1,
      worstCaseOutcome: 'Cascade breaks shields',
      mitigationCardTypes: Object.freeze(['PATCH_LAYER', 'CASH_BUFFER']),
    });

    primeStore(
      buildState({
        sortedQueue: Object.freeze([arrived, queued]),
        visibilityState: VisibilityState.TELEGRAPHED,
        currentTick: 10,
        arrivedCount: 1,
        queuedCount: 1,
      }),
    );

    const result = captureHook();

    expect(result.visibilityState).toBe(VisibilityState.TELEGRAPHED);
    expect(result.showsThreatType).toBe(true);
    expect(result.showsArrivalTick).toBe(true);
    expect(result.showsMitigation).toBe(false);
    expect(result.showsWorstCase).toBe(false);

    expect(result.threatCountLabel).toBe('2 THREATS IN FIELD');
    expect(result.entries[0]?.threatType).toBe(ThreatType.CASCADE);
    expect(result.entries[0]?.threatLabel).toBe('CASCADE');
    expect(result.entries[0]?.statusLabel).toBe('ACTIVE +1T');
    expect(result.entries[0]?.isCascade).toBe(true);
    expect(result.entries[0]?.isOverdue).toBe(true);
    expect(result.entries[0]?.emphasis).toBe('CRITICAL');

    expect(result.entries[1]?.threatType).toBe(ThreatType.DEBT_SPIRAL);
    expect(result.entries[1]?.threatLabel).toBe('DEBT SPIRAL');
    expect(result.entries[1]?.arrivalTick).toBe(13);
    expect(result.entries[1]?.countdownTicks).toBe(3);
    expect(result.entries[1]?.statusLabel).toBe('IN 3T');
    expect(result.entries[1]?.severityLabel).toBe('SEVERE');
    expect(result.entries[1]?.worstCase).toBeNull();
    expect(result.entries[1]?.mitigationPath).toBeNull();
  });

  it('reveals mitigation path and worst-case outcome in EXPOSED visibility', () => {
    const exposed = makeEntry({
      entryId: 'entry-exposed',
      threatId: 'threat-exposed',
      threatType: ThreatType.SOVEREIGNTY,
      threatSeverity: ThreatSeverity.EXISTENTIAL,
      arrivalTick: 17,
      worstCaseOutcome: 'Full wealth wipe risk',
      mitigationCardTypes: Object.freeze(['SOVEREIGNTY_LOCK', 'LEGAL_DEFENSE']),
    });

    primeStore(
      buildState({
        sortedQueue: Object.freeze([exposed]),
        visibilityState: VisibilityState.EXPOSED,
        currentTick: 12,
        arrivedCount: 0,
        queuedCount: 1,
      }),
    );

    const result = captureHook();
    const entry = result.entries[0];

    expect(result.visibilityState).toBe(VisibilityState.EXPOSED);
    expect(result.showsThreatType).toBe(true);
    expect(result.showsArrivalTick).toBe(true);
    expect(result.showsMitigation).toBe(true);
    expect(result.showsWorstCase).toBe(true);

    expect(entry?.threatType).toBe(ThreatType.SOVEREIGNTY);
    expect(entry?.threatLabel).toBe('SOVEREIGNTY');
    expect(entry?.severityLabel).toBe('EXISTENTIAL');
    expect(entry?.arrivalTick).toBe(17);
    expect(entry?.countdownTicks).toBe(5);
    expect(entry?.statusLabel).toBe('IN 5T');
    expect(entry?.worstCase).toBe('Full wealth wipe risk');
    expect(entry?.mitigationPath).toEqual(['SOVEREIGNTY_LOCK', 'LEGAL_DEFENSE']);
    expect(entry?.emphasis).toBe('CRITICAL');
    expect(Object.isFrozen(entry?.mitigationPath ?? [])).toBe(true);
  });
});