/**
 * ==========================================================================
 * FILE: pzo-web/src/features/run/useRunEntry.ts
 * ==========================================================================
 *
 * POINT ZERO ONE — ENGINE 0 RUN ENTRY HOOK
 *
 * Purpose:
 * - provide the dedicated play-gate hook the roadmap calls for
 * - keep App / Lobby / mode launch surfaces from inlining lifecycle wiring
 * - let callers start through ZeroFacade with either full StartRunParams or
 *   a lighter request object that carries mode + seed + overrides
 * - keep Engine 0 as the lawful lifecycle owner while preserving existing
 *   useEngineZero + useRunLifecycle selector surfaces
 * ==========================================================================
 */

import { useCallback } from 'react';

import {
  zeroFacade,
  ZeroFacade,
  type ZeroStartRunRequest,
} from '../../engines/zero/ZeroFacade';
import type { RunOutcome } from '../../engines/zero/types';
import { useEngineZero } from './hooks/useEngineZero';
import { useRunLifecycle } from './hooks/useRunLifecycle';

export interface UseRunEntryResult {
  readonly facade: ZeroFacade;
  readonly lifecycleState: ReturnType<typeof useRunLifecycle>['lifecycleState'];
  readonly isRunActive: ReturnType<typeof useRunLifecycle>['isRunActive'];
  readonly currentMode: ReturnType<typeof useRunLifecycle>['currentMode'];
  readonly runLifecycle: ReturnType<typeof useRunLifecycle>;
  readonly startRun: (request: ZeroStartRunRequest) => Promise<void>;
  readonly endRun: (outcome?: RunOutcome | null) => Promise<void>;
}

export function useRunEntry(facade: ZeroFacade = zeroFacade): UseRunEntryResult {
  const engineZero = useEngineZero(facade);
  const runLifecycle = useRunLifecycle(facade);

  const startRun = useCallback(
    async (request: ZeroStartRunRequest) => {
      await facade.startRun(request);
    },
    [facade],
  );

  const endRun = useCallback(
    async (outcome?: RunOutcome | null) => {
      await facade.endRun(outcome);
    },
    [facade],
  );

  return {
    facade,
    lifecycleState: engineZero.lifecycle.lifecycleState,
    isRunActive: engineZero.lifecycle.isRunActive,
    currentMode: engineZero.lifecycle.currentMode,
    runLifecycle,
    startRun,
    endRun,
  };
}

export default useRunEntry;
