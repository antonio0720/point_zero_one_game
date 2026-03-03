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

import { useEngineStore } from '../../../store/engineStore';
import type {
  RunGrade,
  IntegrityStatus,
  GradeReward,
  SovereigntyScoreComponents,
} from '../../../engines/sovereignty/types';

// ── RETURN SHAPE ──────────────────────────────────────────────────────────────

export interface UseSovereigntyEngineResult {
  // Core identity
  proofHash:        string | null;
  grade:            RunGrade | null;
  sovereigntyScore: number | null;
  integrityStatus:  IntegrityStatus | null;

  // Pipeline status
  /** 'IDLE' | 'RUNNING' | 'COMPLETE' | 'FAILED' */
  pipelineStatus: 'IDLE' | 'RUNNING' | 'COMPLETE' | 'FAILED';

  // Reward data
  reward: GradeReward | null;

  // Score breakdown (all five components, 0.0–1.0 each)
  components: SovereigntyScoreComponents | null;

  // Derived boolean helpers — use these in components instead of raw status comparisons
  isVerified:        boolean;  // integrityStatus === 'VERIFIED'
  isTampered:        boolean;  // integrityStatus === 'TAMPERED'
  isUnverified:      boolean;  // integrityStatus === 'UNVERIFIED'
  isComplete:        boolean;  // pipelineStatus === 'COMPLETE'
  isPipelineRunning: boolean;  // pipelineStatus === 'RUNNING'
  isPipelineFailed:  boolean;  // pipelineStatus === 'FAILED'
  hasGrade:          boolean;  // grade !== null
  canExportProof:    boolean;  // reward?.canExportProof === true

  // Grade convenience flags
  isSovereign:  boolean;  // grade === 'A'
  isResilient:  boolean;  // grade === 'B'
  isBuilding:   boolean;  // grade === 'C'
  isStruggling: boolean;  // grade === 'D'
  isFailed:     boolean;  // grade === 'F'
}

// ── HOOK ──────────────────────────────────────────────────────────────────────

/**
 * useSovereigntyEngine
 *
 * Subscribe to all sovereignty state from engineStore.
 *
 * Usage:
 *   const { grade, sovereigntyScore, isVerified, canExportProof } = useSovereigntyEngine();
 *
 * Components that only need one field should use a targeted selector instead:
 *   const grade = useEngineStore(s => s.sovereignty.grade);
 */
export function useSovereigntyEngine(): UseSovereigntyEngineResult {
  const proofHash        = useEngineStore(s => s.sovereignty.proofHash);
  const grade            = useEngineStore(s => s.sovereignty.grade);
  const sovereigntyScore = useEngineStore(s => s.sovereignty.sovereigntyScore);
  const integrityStatus  = useEngineStore(s => s.sovereignty.integrityStatus);
  const pipelineStatus   = useEngineStore(s => s.sovereignty.pipelineStatus);
  const reward           = useEngineStore(s => s.sovereignty.reward);
  const components       = useEngineStore(s => s.sovereignty.components);

  return {
    // Raw state
    proofHash,
    grade,
    sovereigntyScore,
    integrityStatus,
    pipelineStatus,
    reward,
    components,

    // Integrity status helpers
    isVerified:   integrityStatus === 'VERIFIED',
    isTampered:   integrityStatus === 'TAMPERED',
    isUnverified: integrityStatus === 'UNVERIFIED',

    // Pipeline status helpers
    isComplete:        pipelineStatus === 'COMPLETE',
    isPipelineRunning: pipelineStatus === 'RUNNING',
    isPipelineFailed:  pipelineStatus === 'FAILED',

    // Grade presence
    hasGrade:      grade !== null,
    canExportProof: reward?.canExportProof === true,

    // Grade tier helpers
    isSovereign:  grade === 'A',
    isResilient:  grade === 'B',
    isBuilding:   grade === 'C',
    isStruggling: grade === 'D',
    isFailed:     grade === 'F',
  };
}