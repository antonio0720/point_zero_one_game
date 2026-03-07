import type { RunState } from '../types/runState';
import type { RunEvent } from '../types/events';
export interface EmpireModeExt {
    bleedActive: boolean;
    bleedSeverity: 'NONE' | 'WATCH' | 'CRITICAL' | 'TERMINAL';
    bleedActivatedAt: number;
    bleedDurationTicks: number;
    totalBleedTicks: number;
    reactivationCount: number;
    isolationTaxPaid: number;
    comebackSurgeCount: number;
    currentWave: number;
    botCount: number;
}
export interface PredatorModeExt {
    psycheValue: number;
    inTilt: boolean;
    tiltCount: number;
    battleBudgetLeft: number;
    rivalryTier: number;
    counterplayPending: boolean;
    counterplayEventLabel: string;
    counterplayAdjustedHit: number;
}
export interface PhantomModeExt {
    ghostLoaded: boolean;
    legendDisplayName: string;
    netWorthGap: number;
    netWorthGapPct: number;
    cordGap: number;
    isAhead: boolean;
    pressureIntensity: number;
    gapZone: 'FAR_AHEAD' | 'AHEAD' | 'EVEN' | 'BEHIND' | 'CRITICAL';
    legendBeaten: boolean;
    proofBadgeHash: string;
}
export interface SyndicateModeExt {
    trustValue: number;
    leakageRate: number;
    suspicionLevel: number;
    defectionStep: number;
    activeAidContracts: number;
    rescueFunded: boolean;
}
export interface RunStateExt extends RunState {
    pendingCounterplay: {
        active: boolean;
        eventLabel: string;
        adjustedHit: number;
        offeredAtTick: number;
    } | null;
    lastCheckpointTick: number;
    empireExt: EmpireModeExt;
    predatorExt: PredatorModeExt;
    phantomExt: PhantomModeExt;
    syndicateExt: SyndicateModeExt;
}
export declare function runReducer(state: RunStateExt, event: RunEvent): RunStateExt;
//# sourceMappingURL=runReducer.d.ts.map