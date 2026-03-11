/**
 * ============================================================================
 * FILE: pzo-web/src/features/run/components/__tests__/AnticipationQueuePanel.spec.tsx
 * ============================================================================
 *
 * Purpose:
 * - verify Engine 3 queue panel rendering against the live hook contracts
 * - keep the test compatible with the repo's current Vitest node environment
 * - assert SHADOWED / TELEGRAPHED / EXPOSED / EMPTY states without browser-only
 *   testing helpers
 *
 * Doctrine:
 * - mock hooks, not engine internals
 * - render through react-dom/server
 * - validate visibility discipline, queue overflow, and footer telemetry
 * ============================================================================
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../hooks/useAnticipationQueue', () => ({
  useAnticipationQueue: vi.fn(),
}));

vi.mock('../../hooks/useTensionEngine', () => ({
  useTensionEngine: vi.fn(),
}));

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { VisibilityState, EntryState, ThreatSeverity, ThreatType } from '../../../../engines/tension/types';
import { useAnticipationQueue } from '../../hooks/useAnticipationQueue';
import { useTensionEngine } from '../../hooks/useTensionEngine';
import { AnticipationQueuePanel } from '../AnticipationQueuePanel';

type UseAnticipationQueueMock = {
  mockReturnValue: (value: MockQueueHookResult) => unknown;
  mockReset: () => unknown;
};

type UseTensionEngineMock = {
  mockReturnValue: (value: MockTensionHookResult) => unknown;
  mockReset: () => unknown;
};

const useAnticipationQueueMock = useAnticipationQueue as unknown as UseAnticipationQueueMock;
const useTensionEngineMock = useTensionEngine as unknown as UseTensionEngineMock;

type QueueEntryEmphasis = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface MockQueueDisplayEntry {
  readonly entryId: string;
  readonly state: EntryState;
  readonly isArrived: boolean;
  readonly isCascade: boolean;
  readonly isOverdue: boolean;
  readonly threatType: ThreatType | null;
  readonly threatLabel: string;
  readonly threatSeverity: ThreatSeverity | null;
  readonly severityLabel: string | null;
  readonly arrivalTick: number | null;
  readonly countdownTicks: number | null;
  readonly worstCase: string | null;
  readonly mitigationPath: readonly string[] | null;
  readonly ticksOverdue: number;
  readonly statusLabel: string;
  readonly emphasis: QueueEntryEmphasis;
}

interface MockQueueHookResult {
  readonly entries: readonly MockQueueDisplayEntry[];
  readonly rawEntries?: readonly unknown[];
  readonly visibilityState: VisibilityState;
  readonly visibilityConfig?: {
    readonly showsThreatType: boolean;
    readonly showsArrivalTick: boolean;
    readonly showsMitigationPath: boolean;
    readonly showsWorstCase: boolean;
  };
  readonly currentTick?: number;
  readonly visibleThreatCount?: number;
  readonly hiddenThreatCount: number;
  readonly showsThreatType: boolean;
  readonly showsArrivalTick: boolean;
  readonly showsMitigation: boolean;
  readonly showsWorstCase: boolean;
  readonly hasArrivedThreats?: boolean;
  readonly hasQueuedThreats?: boolean;
  readonly isEmpty: boolean;
  readonly threatCountLabel: string;
}

interface MockDominantEntry {
  readonly threatType: ThreatType;
}

interface MockTensionHookResult {
  readonly scorePct: number;
  readonly isPulseActive: boolean;
  readonly isSustainedPulse: boolean;
  readonly isEscalating: boolean;
  readonly threatUrgency: 'CLEAR' | 'BUILDING' | 'URGENT' | 'COLLAPSE_IMMINENT';
  readonly tensionBand: 'CALM' | 'RISING' | 'HIGH' | 'CRISIS' | 'PULSE';
  readonly trend: 'FALLING' | 'FLAT' | 'RISING';
  readonly arrivedCount: number;
  readonly queuedCount: number;
  readonly expiredCount: number;
  readonly currentTick: number;
  readonly nextThreatEta: number | null;
  readonly dominantEntry: MockDominantEntry | null;
}

function buildEntry(overrides: Partial<MockQueueDisplayEntry> = {}): MockQueueDisplayEntry {
  return {
    entryId: 'entry-1',
    state: EntryState.QUEUED,
    isArrived: false,
    isCascade: false,
    isOverdue: false,
    threatType: ThreatType.DEBT_SPIRAL,
    threatLabel: 'DEBT SPIRAL',
    threatSeverity: ThreatSeverity.MODERATE,
    severityLabel: 'MODERATE',
    arrivalTick: 12,
    countdownTicks: 3,
    worstCase: null,
    mitigationPath: null,
    ticksOverdue: 0,
    statusLabel: 'IN 3T',
    emphasis: 'MEDIUM',
    ...overrides,
  };
}

function buildQueueHookResult(overrides: Partial<MockQueueHookResult> = {}): MockQueueHookResult {
  return {
    entries: Object.freeze([]),
    rawEntries: Object.freeze([]),
    visibilityState: VisibilityState.SHADOWED,
    visibilityConfig: {
      showsThreatType: false,
      showsArrivalTick: false,
      showsMitigationPath: false,
      showsWorstCase: false,
    },
    currentTick: 0,
    visibleThreatCount: 0,
    hiddenThreatCount: 0,
    showsThreatType: false,
    showsArrivalTick: false,
    showsMitigation: false,
    showsWorstCase: false,
    hasArrivedThreats: false,
    hasQueuedThreats: false,
    isEmpty: true,
    threatCountLabel: 'NO ACTIVE THREATS',
    ...overrides,
  };
}

function buildTensionHookResult(overrides: Partial<MockTensionHookResult> = {}): MockTensionHookResult {
  return {
    scorePct: 0,
    isPulseActive: false,
    isSustainedPulse: false,
    isEscalating: false,
    threatUrgency: 'CLEAR',
    tensionBand: 'CALM',
    trend: 'FLAT',
    arrivedCount: 0,
    queuedCount: 0,
    expiredCount: 0,
    currentTick: 0,
    nextThreatEta: null,
    dominantEntry: null,
    ...overrides,
  };
}

function renderPanel(props: React.ComponentProps<typeof AnticipationQueuePanel> = {}): string {
  return renderToStaticMarkup(React.createElement(AnticipationQueuePanel, props));
}

describe('AnticipationQueuePanel', () => {
  beforeEach(() => {
    useAnticipationQueueMock.mockReset();
    useTensionEngineMock.mockReset();
  });

  it('renders the empty state cleanly when the queue is clear', () => {
    useAnticipationQueueMock.mockReturnValue(
      buildQueueHookResult({
        isEmpty: true,
        visibilityState: VisibilityState.SHADOWED,
        threatCountLabel: 'NO ACTIVE THREATS',
      }),
    );

    useTensionEngineMock.mockReturnValue(buildTensionHookResult());

    const markup = renderPanel();

    expect(markup).toContain('NO ACTIVE THREATS');
    expect(markup).toContain('QUEUE CLEAR · DREAD SUPPRESSED');
    expect(markup).toContain('pzo-tension-queue--empty');
  });

  it('renders SHADOWED mode without leaking threat detail', () => {
    useAnticipationQueueMock.mockReturnValue(
      buildQueueHookResult({
        isEmpty: false,
        visibilityState: VisibilityState.SHADOWED,
        entries: Object.freeze([
          buildEntry({ entryId: 'entry-a', threatType: null, threatLabel: 'UNKNOWN THREAT' }),
          buildEntry({ entryId: 'entry-b', threatType: null, threatLabel: 'UNKNOWN THREAT' }),
          buildEntry({ entryId: 'entry-c', threatType: null, threatLabel: 'UNKNOWN THREAT' }),
        ]),
        hiddenThreatCount: 2,
        showsThreatType: false,
        showsArrivalTick: false,
        showsMitigation: false,
        showsWorstCase: false,
        threatCountLabel: '3 THREATS DETECTED',
      }),
    );

    useTensionEngineMock.mockReturnValue(
      buildTensionHookResult({
        scorePct: 34,
        threatUrgency: 'BUILDING',
        tensionBand: 'RISING',
        trend: 'RISING',
        arrivedCount: 1,
        queuedCount: 2,
        expiredCount: 0,
        currentTick: 7,
        nextThreatEta: 2,
      }),
    );

    const markup = renderPanel();

    expect(markup).toContain('ANTICIPATION QUEUE');
    expect(markup).toContain('3 THREATS DETECTED');
    expect(markup).toContain('TENSION');
    expect(markup).toContain('34%');
    expect(markup).toContain('SHADOWED');
    expect(markup).toContain('BUILDING');
    expect(markup).toContain('RISING');
    expect(markup).toContain('ACTIVE');
    expect(markup).toContain('TRACKED');
    expect(markup).toContain('INTEL MASKED');
    expect(markup).not.toContain('DEBT SPIRAL');
    expect(markup).not.toContain('MITIGATE WITH');
    expect(markup).toContain('pzo-tension-queue--shadowed');
  });

  it('renders TELEGRAPHED mode with countdowns, overflow, and footer telemetry', () => {
    const arrived = buildEntry({
      entryId: 'entry-arrived',
      state: EntryState.ARRIVED,
      isArrived: true,
      isOverdue: true,
      threatType: ThreatType.CASCADE,
      threatLabel: 'CASCADE',
      threatSeverity: ThreatSeverity.CRITICAL,
      severityLabel: 'CRITICAL',
      arrivalTick: 8,
      countdownTicks: 0,
      ticksOverdue: 1,
      statusLabel: 'ACTIVE +1T',
      emphasis: 'CRITICAL',
      isCascade: true,
    });

    const queuedA = buildEntry({
      entryId: 'entry-queued-a',
      threatType: ThreatType.DEBT_SPIRAL,
      threatLabel: 'DEBT SPIRAL',
      threatSeverity: ThreatSeverity.SEVERE,
      severityLabel: 'SEVERE',
      arrivalTick: 12,
      countdownTicks: 3,
      statusLabel: 'IN 3T',
      emphasis: 'HIGH',
    });

    const queuedB = buildEntry({
      entryId: 'entry-queued-b',
      threatType: ThreatType.SABOTAGE,
      threatLabel: 'SABOTAGE',
      threatSeverity: ThreatSeverity.MODERATE,
      severityLabel: 'MODERATE',
      arrivalTick: 13,
      countdownTicks: 4,
      statusLabel: 'IN 4T',
      emphasis: 'MEDIUM',
    });

    useAnticipationQueueMock.mockReturnValue(
      buildQueueHookResult({
        isEmpty: false,
        visibilityState: VisibilityState.TELEGRAPHED,
        entries: Object.freeze([arrived, queuedA, queuedB]),
        hiddenThreatCount: 0,
        showsThreatType: true,
        showsArrivalTick: true,
        showsMitigation: false,
        showsWorstCase: false,
        threatCountLabel: '3 THREATS IN FIELD',
      }),
    );

    useTensionEngineMock.mockReturnValue(
      buildTensionHookResult({
        scorePct: 82,
        isPulseActive: false,
        isSustainedPulse: false,
        isEscalating: true,
        threatUrgency: 'URGENT',
        tensionBand: 'CRISIS',
        trend: 'RISING',
        arrivedCount: 1,
        queuedCount: 2,
        expiredCount: 1,
        currentTick: 9,
        nextThreatEta: 3,
        dominantEntry: { threatType: ThreatType.CASCADE },
      }),
    );

    const markup = renderPanel({ maxVisible: 2 });

    expect(markup).toContain('3 THREATS IN FIELD');
    expect(markup).toContain('TELEGRAPHED');
    expect(markup).toContain('URGENT');
    expect(markup).toContain('CRISIS');
    expect(markup).toContain('RISING');

    expect(markup).toContain('CASCADE');
    expect(markup).toContain('OVERDUE');
    expect(markup).toContain('ACTIVE +1T');
    expect(markup).toContain('ACTION WINDOW MISSED BY 1T');

    expect(markup).toContain('DEBT SPIRAL');
    expect(markup).toContain('ARRIVAL');
    expect(markup).toContain('TICK 12 · IN 3T');

    expect(markup).toContain('+1 MORE THREAT TRACKED');
    expect(markup).toContain('NEXT ETA');
    expect(markup).toContain('3T');
    expect(markup).toContain('PULSE');
    expect(markup).toContain('OFF');
    expect(markup).toContain('DOMINANT');
    expect(markup).toContain('CASCADE');
    expect(markup).toContain('pzo-tension-queue--telegraphed');
    expect(markup).not.toContain('WORST CASE');
    expect(markup).not.toContain('MITIGATE WITH');
  });

  it('renders EXPOSED mode with mitigation paths, worst-case text, and pulse classes', () => {
    const exposed = buildEntry({
      entryId: 'entry-exposed',
      threatType: ThreatType.SOVEREIGNTY,
      threatLabel: 'SOVEREIGNTY',
      threatSeverity: ThreatSeverity.EXISTENTIAL,
      severityLabel: 'EXISTENTIAL',
      arrivalTick: 15,
      countdownTicks: 2,
      worstCase: 'Full wealth wipe risk',
      mitigationPath: Object.freeze(['SOVEREIGNTY_LOCK', 'LEGAL_DEFENSE']),
      statusLabel: 'IN 2T',
      emphasis: 'CRITICAL',
    });

    useAnticipationQueueMock.mockReturnValue(
      buildQueueHookResult({
        isEmpty: false,
        visibilityState: VisibilityState.EXPOSED,
        entries: Object.freeze([exposed]),
        showsThreatType: true,
        showsArrivalTick: true,
        showsMitigation: true,
        showsWorstCase: true,
        threatCountLabel: '1 THREAT TRACKED',
      }),
    );

    useTensionEngineMock.mockReturnValue(
      buildTensionHookResult({
        scorePct: 96,
        isPulseActive: true,
        isSustainedPulse: true,
        isEscalating: true,
        threatUrgency: 'COLLAPSE_IMMINENT',
        tensionBand: 'PULSE',
        trend: 'RISING',
        arrivedCount: 0,
        queuedCount: 1,
        expiredCount: 3,
        currentTick: 13,
        nextThreatEta: 2,
        dominantEntry: { threatType: ThreatType.SOVEREIGNTY },
      }),
    );

    const markup = renderPanel();

    expect(markup).toContain('EXPOSED');
    expect(markup).toContain('COLLAPSE_IMMINENT');
    expect(markup).toContain('PULSE');
    expect(markup).toContain('96%');

    expect(markup).toContain('SOVEREIGNTY');
    expect(markup).toContain('EXISTENTIAL');
    expect(markup).toContain('WORST CASE');
    expect(markup).toContain('Full wealth wipe risk');
    expect(markup).toContain('MITIGATE WITH');
    expect(markup).toContain('SOVEREIGNTY_LOCK');
    expect(markup).toContain('LEGAL_DEFENSE');

    expect(markup).toContain('pzo-tension-queue--pulse');
    expect(markup).toContain('pzo-tension-queue--pulse-sustained');
    expect(markup).toContain('pzo-tension-queue--escalating');
    expect(markup).toContain('pzo-tension-queue--exposed');
  });
});