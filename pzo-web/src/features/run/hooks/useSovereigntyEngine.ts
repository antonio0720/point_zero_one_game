//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/features/run/hooks/useSovereigntyEngine.ts

/**
 * FILE: pzo-web/src/features/run/hooks/useSovereigntyEngine.ts
 *
 * Read-only React hook for Sovereignty Engine state.
 * Single entry point for any UI component that needs sovereignty data.
 *
 * Architecture rules:
 *   ✦ Reads ONLY from engineStore (Zustand) — never from SovereigntyEngine class directly.
 *   ✦ Zero write operations — this hook is read-only.
 *   ✦ All derived booleans are computed here so components stay clean.
 *   ✦ Components subscribe to individual selectors for minimal re-render surface.
 *
 * Density6 LLC · Point Zero One · Engine 7 of 7 · Confidential
 */

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import {
  useEngineStore,
  type EngineStoreState,
} from '../../../store/engineStore';
import type {
  GradeReward,
  IntegrityStatus,
  RunGrade,
  SovereigntyScoreComponents,
} from '../../../engines/sovereignty/types';

export type SovereigntyGradeBand =
  | 'SOVEREIGN'
  | 'RESILIENT'
  | 'BUILDING'
  | 'STRUGGLING'
  | 'FAILED'
  | 'UNGRADED';

export interface UseSovereigntyEngineResult {
  readonly proofHash: string | null;
  readonly proofHashShort: string | null;
  readonly grade: RunGrade | null;
  readonly gradeBand: SovereigntyGradeBand;
  readonly sovereigntyScore: number | null;
  readonly sovereigntyScorePct: number | null;
  readonly integrityStatus: IntegrityStatus | null;

  readonly pipelineStatus: 'IDLE' | 'RUNNING' | 'COMPLETE' | 'FAILED';
  readonly reward: GradeReward | null;
  readonly components: SovereigntyScoreComponents | null;
  readonly componentPct: Record<keyof SovereigntyScoreComponents, number> | null;

  readonly lastFailureReason: string | null;
  readonly lastFailureStep: 1 | 2 | 3 | null;
  readonly isRunActive: boolean;

  readonly isVerified: boolean;
  readonly isTampered: boolean;
  readonly isUnverified: boolean;

  readonly isIdle: boolean;
  readonly isComplete: boolean;
  readonly isPipelineRunning: boolean;
  readonly isPipelineFailed: boolean;

  readonly hasGrade: boolean;
  readonly hasReward: boolean;
  readonly hasFailure: boolean;
  readonly hasComponents: boolean;
  readonly canExportProof: boolean;
  readonly isExportReady: boolean;

  readonly isSovereign: boolean;
  readonly isResilient: boolean;
  readonly isBuilding: boolean;
  readonly isStruggling: boolean;
  readonly isFailed: boolean;

  readonly cosmeticsUnlockedCount: number;
  readonly badgeTierEarned: GradeReward['badgeTierEarned'] | null;
  readonly xpAwarded: number;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(999, value * 100));
}

function shortenHash(value: string | null, size = 12): string | null {
  if (!value) return null;
  if (value.length <= size) return value;
  return `${value.slice(0, Math.max(4, size))}…`;
}

function resolveGradeBand(grade: RunGrade | null): SovereigntyGradeBand {
  switch (grade) {
    case 'A':
      return 'SOVEREIGN';
    case 'B':
      return 'RESILIENT';
    case 'C':
      return 'BUILDING';
    case 'D':
      return 'STRUGGLING';
    case 'F':
      return 'FAILED';
    default:
      return 'UNGRADED';
  }
}

export function useSovereigntyEngine(): UseSovereigntyEngineResult {
  const sovereignty = useEngineStore(
    useShallow((state: EngineStoreState) => ({
      proofHash: state.sovereignty.proofHash,
      grade: state.sovereignty.grade,
      sovereigntyScore: state.sovereignty.sovereigntyScore,
      integrityStatus: state.sovereignty.integrityStatus,
      pipelineStatus: state.sovereignty.pipelineStatus,
      reward: state.sovereignty.reward,
      components: state.sovereignty.components,
      lastFailureReason: state.sovereignty.lastFailureReason,
      lastFailureStep: state.sovereignty.lastFailureStep,
      isRunActive: state.sovereignty.isRunActive,
    })),
  );

  return useMemo<UseSovereigntyEngineResult>(() => {
    const grade = sovereignty.grade ?? null;
    const reward = sovereignty.reward ?? null;
    const components = sovereignty.components ?? null;

    const componentPct = components
      ? {
          ticksSurvivedPct: clampPercent(components.ticksSurvivedPct),
          shieldsMaintainedPct: clampPercent(components.shieldsMaintainedPct),
          haterBlockRate: clampPercent(components.haterBlockRate),
          decisionSpeedScore: clampPercent(components.decisionSpeedScore),
          cascadeBreakRate: clampPercent(components.cascadeBreakRate),
        }
      : null;

    const integrityStatus = sovereignty.integrityStatus ?? null;
    const pipelineStatus = sovereignty.pipelineStatus;

    return {
      proofHash: sovereignty.proofHash ?? null,
      proofHashShort: shortenHash(sovereignty.proofHash ?? null),
      grade,
      gradeBand: resolveGradeBand(grade),
      sovereigntyScore: sovereignty.sovereigntyScore ?? null,
      sovereigntyScorePct:
        sovereignty.sovereigntyScore === null
          ? null
          : clampPercent(sovereignty.sovereigntyScore),
      integrityStatus,

      pipelineStatus,
      reward,
      components,
      componentPct,

      lastFailureReason: sovereignty.lastFailureReason ?? null,
      lastFailureStep: sovereignty.lastFailureStep ?? null,
      isRunActive: Boolean(sovereignty.isRunActive),

      isVerified: integrityStatus === 'VERIFIED',
      isTampered: integrityStatus === 'TAMPERED',
      isUnverified: integrityStatus === 'UNVERIFIED',

      isIdle: pipelineStatus === 'IDLE',
      isComplete: pipelineStatus === 'COMPLETE',
      isPipelineRunning: pipelineStatus === 'RUNNING',
      isPipelineFailed: pipelineStatus === 'FAILED',

      hasGrade: grade !== null,
      hasReward: reward !== null,
      hasFailure:
        sovereignty.lastFailureReason !== null || sovereignty.lastFailureStep !== null,
      hasComponents: components !== null,
      canExportProof: reward?.canExportProof === true,
      isExportReady:
        reward?.canExportProof === true &&
        integrityStatus === 'VERIFIED' &&
        pipelineStatus === 'COMPLETE' &&
        grade !== null,

      isSovereign: grade === 'A',
      isResilient: grade === 'B',
      isBuilding: grade === 'C',
      isStruggling: grade === 'D',
      isFailed: grade === 'F',

      cosmeticsUnlockedCount: reward?.cosmeticsUnlocked.length ?? 0,
      badgeTierEarned: reward?.badgeTierEarned ?? null,
      xpAwarded: reward?.xpAwarded ?? 0,
    };
  }, [sovereignty]);
}

export function useSovereigntyGrade(): RunGrade | null {
  return useEngineStore((state) => state.sovereignty.grade ?? null);
}

export function useSovereigntyProofHash(): string | null {
  return useEngineStore((state) => state.sovereignty.proofHash ?? null);
}

export default useSovereigntyEngine;
