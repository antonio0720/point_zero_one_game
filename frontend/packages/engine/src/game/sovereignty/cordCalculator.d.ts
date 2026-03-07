export type GameMode = 'EMPIRE' | 'PREDATOR' | 'SYNDICATE' | 'PHANTOM';
export interface ModeWeights {
    primary: number;
    secondary: number;
    tertiary: number;
    bonus: number;
    penalty: number;
}
export declare const CORD_WEIGHTS_BY_MODE: Record<GameMode, ModeWeights>;
export interface EmpireCordInput {
    decisionQualityScore: number;
    pressureResilienceScore: number;
    consistencyScore: number;
    taxBurdenRate: number;
    bleedSurvived: boolean;
    /** Severity of bleed mode at peak: 'NONE' | 'WATCH' | 'CRITICAL' | 'TERMINAL' */
    bleedPeakSeverity: 'NONE' | 'WATCH' | 'CRITICAL' | 'TERMINAL';
    bleedDurationRatio: number;
    comebackSurgeCount: number;
    totalTicks: number;
}
export interface PredatorCordInput {
    extractionsLanded: number;
    extractionsFired: number;
    counterplaysBlocked: number;
    counterplaysReceived: number;
    bbEfficiencyRatio: number;
    /** rivalryModel.ts RivalryTier: 'NONE' | 'EMERGING' | 'ACTIVE' | 'INTENSE' | 'LEGENDARY' */
    rivalryTier: 'NONE' | 'EMERGING' | 'ACTIVE' | 'INTENSE' | 'LEGENDARY';
    matchOutcome: 'WIN' | 'LOSS' | 'DRAW';
    tiltTicksRatio: number;
    /** psycheMeter.cordPenaltyAccumulated — accumulated via 0.001/tilt-tick */
    cordPenaltyAccumulated: number;
}
export interface SyndicateCordInput {
    trustFinalityScore: number;
    cooperationScore: number;
    integrityScore: number;
    aidFulfillmentRate: number;
    /** Whether player ATTEMPTED defection (regardless of detection) */
    defectionAttempted: boolean;
    /** Whether defection was detected by allies — caught = less severe than escaped */
    defectionDetected: boolean;
    defectionCount: number;
    verdict: string;
    /** syndicateCORDCalculator.ts CORD_MULTIPLIERS earned this run */
    earnedMultipliers: Array<'BETRAYAL_SURVIVOR' | 'FULL_SYNERGY' | 'CASCADE_ABSORBER' | 'SYNDICATE_CHAMPION'>;
    /** trustAuditBuilder.trustFinalityWeight output (0.40–1.20) */
    trustFinalityWeight: number;
}
export interface PhantomCordInput {
    peakGapPct: number;
    gapClosingTicks: number;
    totalTicks: number;
    nerveStabilityScore: number;
    legendDecayFactor: number;
    beaten: boolean;
    dynastyStackDepth: number;
    /** gapIndicatorEngine.totalCordAdjustment — DIRECTIONAL (can be negative) */
    totalCordAdjustment: number;
    /** Phantom proof badge tier earned: 'NONE' | 'BRONZE' | 'SILVER' | 'GOLD' | 'IMMORTAL_SLAYER' */
    proofBadgeTier: 'NONE' | 'BRONZE' | 'SILVER' | 'GOLD' | 'IMMORTAL_SLAYER';
}
export interface CordSubScores {
    primary: number;
    secondary: number;
    tertiary: number;
    bonus: number;
    penalty: number;
    raw: number;
    final: number;
}
export interface CordResult {
    mode: GameMode;
    subScores: CordSubScores;
    finalScore: number;
    tier: CordTier;
    tierColor: string;
    tierIcon: string;
    label: string;
}
export type CordTier = 'UNRANKED' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'SOVEREIGN';
export interface PartialCordInput {
    mode: GameMode;
    currentTick: number;
    totalTicks: number;
    cash: number;
    income: number;
    expenses: number;
    netWorth: number;
    startNetWorth: number;
    shieldsActive: number;
    pressureScore: number;
}
export declare function computeEmpireCord(input: EmpireCordInput): CordResult;
export declare function computePredatorCord(input: PredatorCordInput): CordResult;
export declare function computeSyndicateCord(input: SyndicateCordInput): CordResult;
export declare function computePhantomCord(input: PhantomCordInput): CordResult;
export type AnyCordInput = {
    mode: 'EMPIRE';
    data: EmpireCordInput;
} | {
    mode: 'PREDATOR';
    data: PredatorCordInput;
} | {
    mode: 'SYNDICATE';
    data: SyndicateCordInput;
} | {
    mode: 'PHANTOM';
    data: PhantomCordInput;
};
/**
 * Single routing function — call this from SovereigntyEngine pipeline.
 * Eliminates the need for mode-specific dispatch in the engine layer.
 */
export declare function computeUnifiedCord(input: AnyCordInput): CordResult;
/**
 * Compute a live CORD estimate during the run — no completed run required.
 * Used by: in-run HUD score strip, PhantomGameScreen gap indicator, EngineOrchestrator telemetry.
 *
 * Based purely on financial performance + tick progress.
 * Not used for any final grade computation — estimate only.
 */
export declare function computePartialCord(input: PartialCordInput): number;
export declare function cordTier(score: number): CordTier;
export declare function cordTierColor(tier: CordTier): string;
export declare function cordTierIcon(tier: CordTier): string;
/** Tier label with optional mode context for display. */
export declare function cordLabel(score: number, mode?: GameMode): string;
/** Mode-aware tier icon — combines tier icon + mode flavor. */
export declare function cordTierIconForMode(tier: CordTier, mode: GameMode): string;
/**
 * Return the CORD weight registry for a given mode.
 * Consumed by ProofCardV2.tsx for weight breakdown rendering.
 */
export declare function getCordWeightsForMode(mode: GameMode): ModeWeights;
export interface CordBreakdownForUI {
    mode: GameMode;
    finalScore: number;
    finalPct: number;
    tier: CordTier;
    tierColor: string;
    tierIcon: string;
    label: string;
    bars: Array<{
        label: string;
        value: number;
        weight: number;
        color: string;
        pct: string;
    }>;
    bonusLine: string;
    penaltyLine: string;
}
/**
 * Convert a CordResult into a structured display object for UI components.
 * Eliminates inline reconstruction in ResultScreen, ProofCardV2, etc.
 */
export declare function getCordBreakdownForUI(result: CordResult): CordBreakdownForUI;
/**
 * Compute CORD delta from personal best for ResultScreen display.
 * Returns positive if improved, negative if lower, 0 if no previous record.
 */
export declare function cordDelta(currentScore: number, previousBest: number | null): number;
/**
 * Bleed severity → CORD bonus.
 * TERMINAL survival is a remarkable feat and earns the highest bonus.
 */
export declare function bleedSeverityBonus(severity: 'NONE' | 'WATCH' | 'CRITICAL' | 'TERMINAL'): number;
//# sourceMappingURL=cordCalculator.d.ts.map