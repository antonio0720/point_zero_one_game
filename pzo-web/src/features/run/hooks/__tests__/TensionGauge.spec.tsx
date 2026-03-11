/**
 * ============================================================================
 * FILE: pzo-web/src/features/run/hooks/__tests__/TensionGauge.spec.tsx
 * ============================================================================
 *
 * Purpose:
 * - verify Engine 3 gauge presentation against the live hook contract
 * - keep tests compatible with the repo's current Vitest node environment
 * - assert pulse state, disclosure state, queue metrics, and visibility-driven
 *   dominant threat labels without browser-only helpers
 *
 * Doctrine:
 * - mock the hook, not the store
 * - render via react-dom/server
 * - assert meaningful HUD output and modifier classes
 * ============================================================================
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../useTensionEngine', () => ({
  useTensionEngine: vi.fn(),
}));

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  EntryState,
  ThreatSeverity,
  ThreatType,
  VisibilityState,
} from '../../../../engines/tension/types';
import { useTensionEngine } from '../useTensionEngine';
import { TensionGauge } from '../../components/TensionGauge';

type UseTensionEngineMock = {
  mockReturnValue: (value: MockTensionHookResult) => unknown;
  mockReset: () => unknown;
};

const useTensionEngineMock =
  useTensionEngine as unknown as UseTensionEngineMock;

interface MockTensionHookResult {
  readonly score: number;
  readonly scorePct: number;
  readonly scoreHistory: readonly number[];
  readonly tensionBand: 'CALM' | 'RISING' | 'HIGH' | 'CRISIS' | 'PULSE';
  readonly trend: 'FALLING' | 'FLAT' | 'RISING';
  readonly visibilityState: VisibilityState;
  readonly previousVisibilityState: VisibilityState | null;
  readonly visibilityConfig: {
    readonly showsThreatType: boolean;
    readonly showsArrivalTick: boolean;
    readonly showsMitigationPath: boolean;
    readonly showsWorstCase: boolean;
  };
  readonly queueLength: number;
  readonly arrivedCount: number;
  readonly queuedCount: number;
  readonly expiredCount: number;
  readonly activeThreatCount: number;
  readonly unresolvedThreatCount: number;
  readonly hasThreats: boolean;
  readonly hasQueuedThreats: boolean;
  readonly hasArrivedThreats: boolean;
  readonly hasExpiredThreats: boolean;
  readonly isPulseActive: boolean;
  readonly pulseTicksActive: number;
  readonly isSustainedPulse: boolean;
  readonly isNearPulse: boolean;
  readonly isEscalating: boolean;
  readonly isRunActive: boolean;
  readonly currentTick: number;
  readonly threatUrgency: 'CLEAR' | 'BUILDING' | 'URGENT' | 'COLLAPSE_IMMINENT';
  readonly sortedQueue: readonly ReturnType<typeof makeEntry>[];
  readonly dominantEntry: ReturnType<typeof makeEntry> | null;
  readonly nextQueuedEntry: ReturnType<typeof makeEntry> | null;
  readonly nextThreatEta: number | null;
  readonly lastArrivedEntry: ReturnType<typeof makeEntry> | null;
  readonly lastExpiredEntry: ReturnType<typeof makeEntry> | null;
  readonly canSeeThreatTypes: boolean;
  readonly canSeeArrivalTicks: boolean;
  readonly canSeeMitigationPaths: boolean;
  readonly canSeeWorstCase: boolean;
}

function makeEntry(
  overrides: Partial<ReturnType<typeof buildBaseEntry>> = {},
): ReturnType<typeof buildBaseEntry> {
  return {
    ...buildBaseEntry(),
    ...overrides,
    mitigationCardTypes: Object.freeze([
      ...(overrides.mitigationCardTypes ?? ['INCOME_SHIELD']),
    ]),
  };
}

function buildBaseEntry() {
  return {
    entryId: 'entry-1',
    threatId: 'threat-1',
    threatType: ThreatType.DEBT_SPIRAL,
    threatSeverity: ThreatSeverity.MODERATE,
    enqueuedAtTick: 3,
    arrivalTick: 8,
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

function buildHookResult(
  overrides: Partial<MockTensionHookResult> = {},
): MockTensionHookResult {
  const dominantEntry =
    overrides.dominantEntry ??
    makeEntry({
      entryId: 'dominant-entry',
      threatId: 'dominant-threat',
      threatType: ThreatType.SABOTAGE,
      threatSeverity: ThreatSeverity.CRITICAL,
      arrivalTick: 7,
      state: EntryState.ARRIVED,
      isArrived: true,
    });

  return {
    score: 0.73,
    scorePct: 73,
    scoreHistory: Object.freeze([0.21, 0.54, 0.73]),
    tensionBand: 'HIGH',
    trend: 'RISING',
    visibilityState: VisibilityState.TELEGRAPHED,
    previousVisibilityState: VisibilityState.SIGNALED,
    visibilityConfig: {
      showsThreatType: true,
      showsArrivalTick: true,
      showsMitigationPath: false,
      showsWorstCase: false,
    },
    queueLength: 4,
    arrivedCount: 1,
    queuedCount: 3,
    expiredCount: 2,
    activeThreatCount: 4,
    unresolvedThreatCount: 6,
    hasThreats: true,
    hasQueuedThreats: true,
    hasArrivedThreats: true,
    hasExpiredThreats: true,
    isPulseActive: false,
    pulseTicksActive: 0,
    isSustainedPulse: false,
    isNearPulse: false,
    isEscalating: true,
    isRunActive: true,
    currentTick: 12,
    threatUrgency: 'URGENT',
    sortedQueue: Object.freeze([dominantEntry]),
    dominantEntry,
    nextQueuedEntry: makeEntry({
      entryId: 'next-entry',
      threatId: 'next-threat',
      arrivalTick: 15,
    }),
    nextThreatEta: 3,
    lastArrivedEntry: dominantEntry,
    lastExpiredEntry: null,
    canSeeThreatTypes: true,
    canSeeArrivalTicks: true,
    canSeeMitigationPaths: false,
    canSeeWorstCase: false,
    ...overrides,
  };
}

function renderGauge(
  props: React.ComponentProps<typeof TensionGauge> = {},
): string {
  return renderToStaticMarkup(React.createElement(TensionGauge, props));
}

describe('TensionGauge', () => {
  beforeEach(() => {
    useTensionEngineMock.mockReset();
  });

  it('renders the full horizontal HUD readout from the hook contract', () => {
    useTensionEngineMock.mockReturnValue(
      buildHookResult({
        score: 0.73,
        scorePct: 73,
        tensionBand: 'HIGH',
        trend: 'RISING',
        visibilityState: VisibilityState.TELEGRAPHED,
        threatUrgency: 'URGENT',
        queueLength: 4,
        arrivedCount: 1,
        expiredCount: 2,
        nextThreatEta: 3,
        currentTick: 12,
        canSeeThreatTypes: true,
        dominantEntry: makeEntry({
          entryId: 'dominant',
          threatId: 'dominant-threat',
          threatType: ThreatType.SABOTAGE,
          threatSeverity: ThreatSeverity.CRITICAL,
          arrivalTick: 7,
          state: EntryState.ARRIVED,
          isArrived: true,
        }),
      }),
    );

    const markup = renderGauge({ orientation: 'horizontal' });

    expect(markup).toContain('TENSION');
    expect(markup).toContain('TELEGRAPHED');
    expect(markup).toContain('URGENT');
    expect(markup).toContain('RISING');
    expect(markup).toMatch(/73\s*%/);
    expect(markup).toContain('HIGH');

    expect(markup).toContain('Queue');
    expect(markup).toContain('4');
    expect(markup).toContain('Active');
    expect(markup).toContain('1');
    expect(markup).toContain('Expired');
    expect(markup).toContain('2');
    expect(markup).toContain('Next ETA');
    expect(markup).toContain('3T');

    expect(markup).toContain('Last');
    expect(markup).toContain('Tick');
    expect(markup).toContain('12');

    expect(markup).toContain('Dominant');
    expect(markup).toContain('SABOTAGE');
    expect(markup).toContain('Pulse');
    expect(markup).toContain('OFF');
    expect(markup).toContain('0T');

    expect(markup).toContain('pzo-tension-gauge__layout--horizontal');
    expect(markup).toContain('pzo-tension-gauge__sparkline');
  });

  it('renders pulse modifiers and hides the dominant threat label when visibility is masked', () => {
    useTensionEngineMock.mockReturnValue(
      buildHookResult({
        score: 0.96,
        scorePct: 96,
        scoreHistory: Object.freeze([0.82, 0.91, 0.96]),
        tensionBand: 'PULSE',
        trend: 'RISING',
        visibilityState: VisibilityState.SHADOWED,
        threatUrgency: 'COLLAPSE_IMMINENT',
        isPulseActive: true,
        pulseTicksActive: 4,
        isSustainedPulse: true,
        canSeeThreatTypes: false,
        dominantEntry: makeEntry({
          entryId: 'hidden-dominant',
          threatId: 'hidden-dominant-threat',
          threatType: ThreatType.SOVEREIGNTY,
          threatSeverity: ThreatSeverity.EXISTENTIAL,
        }),
      }),
    );

    const markup = renderGauge({
      label: 'DREAD',
      orientation: 'vertical',
      showHistory: false,
      showQueueStats: false,
    });

    expect(markup).toContain('DREAD');
    expect(markup).toContain('SHADOWED');
    expect(markup).toContain('COLLAPSE_IMMINENT');
    expect(markup).toContain('PULSE');
    expect(markup).toMatch(/96\s*%/);

    expect(markup).toContain('Dominant');
    expect(markup).toContain('HIDDEN');
    expect(markup).not.toContain('SOVEREIGNTY');

    expect(markup).toContain('Pulse');
    expect(markup).toContain('ON');
    expect(markup).toContain('4T');

    expect(markup).toContain('pzo-tension-gauge--pulse');
    expect(markup).toContain('pzo-tension-gauge--sustained');
    expect(markup).toContain('pzo-tension-gauge__fill--pulse');
    expect(markup).toContain('pzo-tension-gauge__layout--vertical');

    expect(markup).not.toContain('Next ETA');
    expect(markup).not.toContain('Last');
    expect(markup).not.toContain('Queue');
  });
});