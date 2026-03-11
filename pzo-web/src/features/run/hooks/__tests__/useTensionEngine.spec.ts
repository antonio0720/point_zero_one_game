/**
 * ============================================================================
 * FILE: pzo-web/src/features/run/hooks/__tests__/useTensionEngine.spec.ts
 * ============================================================================
 *
 * Purpose:
 * - validate Engine 3 frontend selector logic without depending on DOM helpers
 * - keep tests compatible with the repo's current Vitest node environment
 * - verify derived tension semantics from the Zustand slice:
 *   score clamping, trend, urgency, visibility, queue selection, and pulse state
 *
 * Doctrine:
 * - mock store selector surface only
 * - render a minimal SSR harness so React hooks execute legally
 * - assert production-facing derived outputs, not implementation trivia
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
import { useTensionEngine, type UseTensionEngineResult } from '../useTensionEngine';

interface MinimalTensionStoreState {
  tension: {
    score: number;
    scoreHistory: readonly number[];
    visibilityState: VisibilityState;
    previousVisibilityState: VisibilityState | null;
    queueLength: number;
    arrivedCount: number;
    queuedCount: number;
    expiredCount: number;
    isPulseActive: boolean;
    pulseTicksActive: number;
    isSustainedPulse: boolean;
    isEscalating: boolean;
    sortedQueue: readonly ReturnType<typeof makeEntry>[];
    lastArrivedEntry: ReturnType<typeof makeEntry> | null;
    lastExpiredEntry: ReturnType<typeof makeEntry> | null;
    currentTick: number;
    isRunActive: boolean;
  };
}

type StoreSelectorResult = unknown;

type UseEngineStoreMock = {
  mockImplementation: (
    fn: (selector: (state: MinimalTensionStoreState) => StoreSelectorResult) => StoreSelectorResult,
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
  overrides: Partial<MinimalTensionStoreState['tension']> = {},
): MinimalTensionStoreState {
  return {
    tension: {
      score: 0.42,
      scoreHistory: Object.freeze([0.21, 0.31, 0.42]),
      visibilityState: VisibilityState.SIGNALED,
      previousVisibilityState: VisibilityState.SHADOWED,
      queueLength: 1,
      arrivedCount: 0,
      queuedCount: 1,
      expiredCount: 0,
      isPulseActive: false,
      pulseTicksActive: 0,
      isSustainedPulse: false,
      isEscalating: true,
      sortedQueue: Object.freeze([
        makeEntry({
          entryId: 'entry-queued',
          threatId: 'threat-queued',
          arrivalTick: 9,
        }),
      ]),
      lastArrivedEntry: null,
      lastExpiredEntry: null,
      currentTick: 6,
      isRunActive: true,
      ...overrides,
    },
  };
}

function primeStore(state: MinimalTensionStoreState): void {
  useEngineStoreMock.mockImplementation(
    (
      selector: (store: MinimalTensionStoreState) => StoreSelectorResult,
    ): StoreSelectorResult => selector(state),
  );
}

function captureHook(): UseTensionEngineResult {
  let captured: UseTensionEngineResult | null = null;

  function Harness(): null {
    captured = useTensionEngine();
    return null;
  }

  renderToStaticMarkup(React.createElement(Harness));

  if (captured === null) {
    throw new Error('Failed to capture useTensionEngine() result.');
  }

  return captured;
}

describe('useTensionEngine', () => {
  beforeEach(() => {
    useEngineStoreMock.mockReset();
  });

  it('derives production-ready queue, urgency, trend, and visibility selectors', () => {
    const arrived = makeEntry({
      entryId: 'entry-arrived',
      threatId: 'threat-arrived',
      threatType: ThreatType.SABOTAGE,
      threatSeverity: ThreatSeverity.CRITICAL,
      arrivalTick: 5,
      state: EntryState.ARRIVED,
      isArrived: true,
      ticksOverdue: 1,
      worstCaseOutcome: 'Income source wiped out',
      mitigationCardTypes: Object.freeze(['LEGAL_DEFENSE', 'CASH_BUFFER']),
    });

    const queued = makeEntry({
      entryId: 'entry-queued',
      threatId: 'threat-queued',
      threatType: ThreatType.DEBT_SPIRAL,
      threatSeverity: ThreatSeverity.SEVERE,
      arrivalTick: 11,
      worstCaseOutcome: 'Debt spiral triggers cascade',
      mitigationCardTypes: Object.freeze(['INCOME_SHIELD']),
    });

    primeStore(
      buildState({
        score: 0.86,
        scoreHistory: Object.freeze([0.33, 0.61, 0.86]),
        visibilityState: VisibilityState.TELEGRAPHED,
        previousVisibilityState: VisibilityState.SIGNALED,
        queueLength: 2,
        arrivedCount: 1,
        queuedCount: 1,
        expiredCount: 1,
        sortedQueue: Object.freeze([arrived, queued]),
        lastArrivedEntry: arrived,
        currentTick: 8,
      }),
    );

    const result = captureHook();

    expect(result.score).toBeCloseTo(0.86, 5);
    expect(result.scorePct).toBe(86);
    expect(result.tensionBand).toBe('CRISIS');
    expect(result.trend).toBe('RISING');
    expect(result.visibilityState).toBe(VisibilityState.TELEGRAPHED);
    expect(result.previousVisibilityState).toBe(VisibilityState.SIGNALED);

    expect(result.queueLength).toBe(2);
    expect(result.arrivedCount).toBe(1);
    expect(result.queuedCount).toBe(1);
    expect(result.expiredCount).toBe(1);
    expect(result.activeThreatCount).toBe(2);
    expect(result.unresolvedThreatCount).toBe(3);

    expect(result.hasThreats).toBe(true);
    expect(result.hasQueuedThreats).toBe(true);
    expect(result.hasArrivedThreats).toBe(true);
    expect(result.hasExpiredThreats).toBe(true);

    expect(result.threatUrgency).toBe('URGENT');
    expect(result.isPulseActive).toBe(false);
    expect(result.isSustainedPulse).toBe(false);
    expect(result.isNearPulse).toBe(true);
    expect(result.isEscalating).toBe(true);
    expect(result.isRunActive).toBe(true);

    expect(result.dominantEntry?.entryId).toBe('entry-arrived');
    expect(result.nextQueuedEntry?.entryId).toBe('entry-queued');
    expect(result.nextThreatEta).toBe(3);
    expect(result.lastArrivedEntry?.entryId).toBe('entry-arrived');
    expect(result.lastExpiredEntry).toBeNull();

    expect(result.canSeeThreatTypes).toBe(true);
    expect(result.canSeeArrivalTicks).toBe(true);
    expect(result.canSeeMitigationPaths).toBe(false);
    expect(result.canSeeWorstCase).toBe(false);

    expect(Object.isFrozen(result.scoreHistory)).toBe(true);
    expect(Object.isFrozen(result.sortedQueue)).toBe(true);
  });

  it('clamps invalid score inputs and resolves calm/clear state correctly', () => {
    primeStore(
      buildState({
        score: Number.NaN,
        scoreHistory: Object.freeze([]),
        visibilityState: VisibilityState.SHADOWED,
        previousVisibilityState: null,
        queueLength: 0,
        arrivedCount: 0,
        queuedCount: 0,
        expiredCount: 0,
        isPulseActive: false,
        pulseTicksActive: 0,
        isSustainedPulse: false,
        isEscalating: false,
        sortedQueue: Object.freeze([]),
        lastArrivedEntry: null,
        lastExpiredEntry: null,
        currentTick: 0,
        isRunActive: false,
      }),
    );

    const result = captureHook();

    expect(result.score).toBe(0);
    expect(result.scorePct).toBe(0);
    expect(result.tensionBand).toBe('CALM');
    expect(result.trend).toBe('FLAT');
    expect(result.threatUrgency).toBe('CLEAR');
    expect(result.hasThreats).toBe(false);
    expect(result.nextQueuedEntry).toBeNull();
    expect(result.nextThreatEta).toBeNull();
    expect(result.dominantEntry).toBeNull();
    expect(result.canSeeThreatTypes).toBe(false);
    expect(result.canSeeArrivalTicks).toBe(false);
    expect(result.canSeeMitigationPaths).toBe(false);
    expect(result.canSeeWorstCase).toBe(false);
  });

  it('elevates to pulse state when score crosses the threshold', () => {
    const pulseEntry = makeEntry({
      entryId: 'entry-pulse',
      threatId: 'threat-pulse',
      threatType: ThreatType.SOVEREIGNTY,
      threatSeverity: ThreatSeverity.EXISTENTIAL,
      arrivalTick: 15,
      mitigationCardTypes: Object.freeze(['SOVEREIGNTY_LOCK']),
    });

    primeStore(
      buildState({
        score: 0.97,
        scoreHistory: Object.freeze([0.71, 0.88, 0.97]),
        visibilityState: VisibilityState.EXPOSED,
        previousVisibilityState: VisibilityState.TELEGRAPHED,
        queueLength: 1,
        arrivedCount: 0,
        queuedCount: 1,
        expiredCount: 2,
        isPulseActive: true,
        pulseTicksActive: 4,
        isSustainedPulse: true,
        sortedQueue: Object.freeze([pulseEntry]),
        currentTick: 12,
      }),
    );

    const result = captureHook();

    expect(result.score).toBeCloseTo(0.97, 5);
    expect(result.tensionBand).toBe('PULSE');
    expect(result.threatUrgency).toBe('COLLAPSE_IMMINENT');
    expect(result.isPulseActive).toBe(true);
    expect(result.pulseTicksActive).toBe(4);
    expect(result.isSustainedPulse).toBe(true);
    expect(result.visibilityState).toBe(VisibilityState.EXPOSED);
    expect(result.canSeeThreatTypes).toBe(true);
    expect(result.canSeeArrivalTicks).toBe(true);
    expect(result.canSeeMitigationPaths).toBe(true);
    expect(result.canSeeWorstCase).toBe(true);
  });
});