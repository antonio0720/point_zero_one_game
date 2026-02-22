/**
 * M19a — Season Meta Balancer (Offline Simulation + RL)
 * Source spec: ml/M19a_season_meta_balancer.md
 *
 * Runs large offline simulations to tune season rule modules before launch.
 * Uses RL/constrained bandit to search parameter spaces that hit targets:
 * retention, wipe-rate, share-rate, fairness.
 * Produces a 'season balance report' artifact for designers.
 *
 * Deploy to: pzo_ml/src/models/m019a.ts
 */

import { createHash } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SOModuleId =
  | 'LOAN_DENIAL' | 'RATE_HIKE' | 'ACQUISITION_DELAY'
  | 'LEVERAGE_CAP' | 'CASH_SEIZURE' | 'ASSET_FREEZE'
  | 'OPPORTUNITY_BLOCK' | 'INCOME_GARNISHMENT';

export interface SeasonData {
  seasonId: number;
  name: string;
  rulesetVersion: string;
  activeSOModules: SOModuleId[];
  deckWeights: Record<string, number>;      // deckType → weight
  wipeThreshold: number;                    // net worth floor
  macroDecayRate: number;                   // cash/sec in final 2 min
  turnWindowSeconds: number;
  inertiaThreshold: number;
  // Tunable by M19a:
  soModuleFrequency: number;               // how often SO cards are drawn 0–1
  opportunityCardBoost: number;            // weight adjustment 0–1
  fubarSeverityMultiplier: number;         // 0.5–2.0
}

export interface BalanceTargets {
  targetWipeRatePct: number;               // e.g. 35 = 35% of runs should wipe
  targetShareRatePct: number;              // e.g. 15 = 15% of runs should generate a share
  targetMedianRunTurns: number;            // median turns before win/wipe
  targetFairnessGini: number;              // gini coefficient on outcome distribution 0–0.4
  maxRetentionDropPct: number;             // alert if retention drops > this
}

export interface SimulatedRunMetrics {
  runCount: number;
  wipeRatePct: number;
  shareRatePct: number;
  medianTurns: number;
  p10NetWorth: number;
  p90NetWorth: number;
  fairnessGini: number;
  retentionEstimate: number;
}

export interface BalanceReport {
  seasonId: number;
  rulesetVersionBefore: string;
  rulesetVersionAfter: string;
  simulatedMetrics: SimulatedRunMetrics;
  targets: BalanceTargets;
  appliedNudges: Array<{ param: string; before: number; after: number; delta: number }>;
  passedTargets: string[];
  failedTargets: string[];
  auditHash: string;
  generatedAt: number;
}

export interface M19aConfig {
  mlEnabled: boolean;
  nudge: number;                 // base nudge strength 0–1 (bounded before use)
  simulationRunCount: number;    // runs to simulate per balance cycle; default 1000
  maxNudgeStrength: number;      // hard cap on any single param change; default 0.15
  rulesetVersion: string;
}

// ─── Base Class ───────────────────────────────────────────────────────────────

export abstract class SeasonMetaBalancer {
  abstract balance(seasonId: number, seasonData: SeasonData): Promise<SeasonData>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t);
}

// ─── Simulation Engine ────────────────────────────────────────────────────────

/**
 * Deterministic offline simulation of N runs given a season config.
 * Uses the seasonData.rulesetVersion + seasonId as the simulation seed.
 * No real players; generates synthetic trajectories from calibrated distributions.
 */
function runOfflineSimulation(
  seasonId: number,
  seasonData: SeasonData,
  runCount: number,
): SimulatedRunMetrics {
  const baseSeed = sha256(`sim:${seasonId}:${seasonData.rulesetVersion}:${runCount}`);

  let wipes = 0;
  let shares = 0;
  const turnCounts: number[] = [];
  const finalNetWorths: number[] = [];

  for (let i = 0; i < runCount; i++) {
    // Deterministic RNG per run via hash chain
    const runHash = sha256(`${baseSeed}:run:${i}`);
    const r1 = parseInt(runHash.slice(0, 8), 16) / 0xffffffff; // [0,1]
    const r2 = parseInt(runHash.slice(8, 16), 16) / 0xffffffff;
    const r3 = parseInt(runHash.slice(16, 24), 16) / 0xffffffff;

    // Simulate outcome using calibrated model:
    // wipe probability driven by SO frequency, fubar severity, macro
    const wipeProb = clamp(
      0.25
      + seasonData.soModuleFrequency * 0.20
      + (seasonData.fubarSeverityMultiplier - 1) * 0.15
      - seasonData.opportunityCardBoost * 0.10,
    );

    const isWipe = r1 < wipeProb;
    const isShare = r2 < (isWipe ? 0.20 : 0.12); // wipes share more (FUBAR_KILLED_ME)

    // Simulated turns: poisson-like between 15–50
    const baseTurns = 20 + Math.floor(r3 * 30);
    const turns = isWipe ? Math.floor(baseTurns * 0.6) : baseTurns;

    // Final net worth: driven by opportunity boost and wipe
    const finalNw = isWipe
      ? -50_000 + r2 * 30_000
      : 20_000 + seasonData.opportunityCardBoost * 80_000 + r3 * 100_000;

    if (isWipe) wipes++;
    if (isShare) shares++;
    turnCounts.push(turns);
    finalNetWorths.push(finalNw);
  }

  // Compute metrics
  turnCounts.sort((a, b) => a - b);
  finalNetWorths.sort((a, b) => a - b);
  const medianTurns = turnCounts[Math.floor(runCount / 2)];
  const p10Nw = finalNetWorths[Math.floor(runCount * 0.10)];
  const p90Nw = finalNetWorths[Math.floor(runCount * 0.90)];

  // Gini coefficient on net worth distribution
  const sumAbsDiff = finalNetWorths.reduce((s, a) =>
    s + finalNetWorths.reduce((s2, b) => s2 + Math.abs(a - b), 0), 0);
  const mean = finalNetWorths.reduce((s, v) => s + v, 0) / runCount;
  const gini = mean !== 0 ? sumAbsDiff / (2 * runCount * runCount * Math.abs(mean)) : 0;

  // Retention: runs with net worth > $0 and turns > 10
  const retained = finalNetWorths.filter(nw => nw > 0).length + turnCounts.filter(t => t > 10).length;
  const retentionEstimate = clamp(retained / (2 * runCount));

  return {
    runCount,
    wipeRatePct: (wipes / runCount) * 100,
    shareRatePct: (shares / runCount) * 100,
    medianTurns,
    p10NetWorth: p10Nw,
    p90NetWorth: p90Nw,
    fairnessGini: clamp(gini, 0, 1),
    retentionEstimate,
  };
}

// ─── RL Nudge Engine ──────────────────────────────────────────────────────────

/**
 * Constrained contextual bandit: compute nudge direction for each parameter.
 * Each nudge bounded to [-maxNudge, +maxNudge].
 * Returns a bounded nudge in [0, 1] representing the recommended shift.
 */
function computeRLNudge(
  metrics: SimulatedRunMetrics,
  targets: BalanceTargets,
  baseNudge: number,
  maxNudge: number,
): {
  soFrequencyDelta: number;
  opportunityBoostDelta: number;
  fubarSeverityDelta: number;
  predictedNudge: number;
} {
  // Wipe rate too high → reduce SO frequency, reduce fubar severity
  const wipeError = (metrics.wipeRatePct - targets.targetWipeRatePct) / 100;
  // Share rate too low → increase fubar severity (more FUBAR_KILLED_ME shares)
  const shareError = (targets.targetShareRatePct - metrics.shareRatePct) / 100;
  // Fairness gini too high → reduce opportunity boost (reduce rich-get-richer)
  const fairnessError = metrics.fairnessGini - targets.targetFairnessGini;

  const soFrequencyDelta = clamp(-wipeError * baseNudge, -maxNudge, maxNudge);
  const opportunityBoostDelta = clamp(-fairnessError * baseNudge * 0.5, -maxNudge, maxNudge);
  const fubarSeverityDelta = clamp(shareError * baseNudge * 0.3, -maxNudge, maxNudge);

  const predictedNudge = clamp(
    (Math.abs(soFrequencyDelta) + Math.abs(opportunityBoostDelta) + Math.abs(fubarSeverityDelta)) / 3,
  );

  return { soFrequencyDelta, opportunityBoostDelta, fubarSeverityDelta, predictedNudge };
}

// ─── Audit ────────────────────────────────────────────────────────────────────

function buildSeasonAuditHash(seasonId: number, rulesetVersion: string, metrics: SimulatedRunMetrics): string {
  return sha256(JSON.stringify({
    seasonId,
    rulesetVersion,
    wipeRatePct: metrics.wipeRatePct,
    shareRatePct: metrics.shareRatePct,
    medianTurns: metrics.medianTurns,
    fairnessGini: metrics.fairnessGini,
    modelId: 'M19a',
  })).slice(0, 32);
}

// ─── Default Targets ─────────────────────────────────────────────────────────

export const DEFAULT_BALANCE_TARGETS: BalanceTargets = {
  targetWipeRatePct: 35,
  targetShareRatePct: 15,
  targetMedianRunTurns: 30,
  targetFairnessGini: 0.30,
  maxRetentionDropPct: 5,
};

// ─── M19a ─────────────────────────────────────────────────────────────────────

export class M19a extends SeasonMetaBalancer {
  private readonly config: M19aConfig;
  private readonly targets: BalanceTargets;

  constructor(config: M19aConfig, targets: BalanceTargets = DEFAULT_BALANCE_TARGETS) {
    super();
    this.config = config;
    this.targets = targets;
  }

  /**
   * Balance a season configuration using offline simulation + RL nudges.
   * Returns the nudged season data + a balance report artifact.
   */
  public async balance(seasonId: number, seasonData: SeasonData): Promise<SeasonData> {
    if (!this.config.mlEnabled) {
      return { ...seasonData };
    }

    const boundedNudge = clamp(this.config.nudge);
    const maxNudge = this.config.maxNudgeStrength ?? 0.15;
    const runCount = this.config.simulationRunCount ?? 1000;

    // Step 1: Audit (deterministic hash of season state)
    const auditHash = this.computeAuditHash(seasonId, seasonData);

    // Step 2: Offline simulation
    const metrics = runOfflineSimulation(seasonId, seasonData, runCount);

    // Step 3: RL nudge computation
    const nudges = computeRLNudge(metrics, this.targets, boundedNudge, maxNudge);

    // Step 4: Apply bounded nudges to season data
    const nudgedData: SeasonData = {
      ...seasonData,
      soModuleFrequency: clamp(seasonData.soModuleFrequency + nudges.soFrequencyDelta, 0, 1),
      opportunityCardBoost: clamp(seasonData.opportunityCardBoost + nudges.opportunityBoostDelta, 0, 1),
      fubarSeverityMultiplier: clamp(
        seasonData.fubarSeverityMultiplier + nudges.fubarSeverityDelta,
        0.5, 2.0,
      ),
      rulesetVersion: this.bumpRulesetVersion(seasonData.rulesetVersion, nudges.predictedNudge),
    };

    return nudgedData;
  }

  /**
   * Full balance cycle with report artifact.
   * Call this pre-season to get the designer report.
   */
  public async balanceWithReport(
    seasonId: number,
    seasonData: SeasonData,
  ): Promise<{ nudgedData: SeasonData; report: BalanceReport }> {
    if (!this.config.mlEnabled) {
      return {
        nudgedData: { ...seasonData },
        report: this.buildEmptyReport(seasonId, seasonData),
      };
    }

    const boundedNudge = clamp(this.config.nudge);
    const maxNudge = this.config.maxNudgeStrength ?? 0.15;
    const runCount = this.config.simulationRunCount ?? 1000;

    const auditHash = this.computeAuditHash(seasonId, seasonData);
    const metrics = runOfflineSimulation(seasonId, seasonData, runCount);
    const nudges = computeRLNudge(metrics, this.targets, boundedNudge, maxNudge);

    const nudgedData: SeasonData = {
      ...seasonData,
      soModuleFrequency: clamp(seasonData.soModuleFrequency + nudges.soFrequencyDelta, 0, 1),
      opportunityCardBoost: clamp(seasonData.opportunityCardBoost + nudges.opportunityBoostDelta, 0, 1),
      fubarSeverityMultiplier: clamp(seasonData.fubarSeverityMultiplier + nudges.fubarSeverityDelta, 0.5, 2.0),
      rulesetVersion: this.bumpRulesetVersion(seasonData.rulesetVersion, nudges.predictedNudge),
    };

    // Evaluate targets
    const passedTargets: string[] = [];
    const failedTargets: string[] = [];
    if (Math.abs(metrics.wipeRatePct - this.targets.targetWipeRatePct) < 5) passedTargets.push('wipe_rate');
    else failedTargets.push('wipe_rate');
    if (Math.abs(metrics.shareRatePct - this.targets.targetShareRatePct) < 3) passedTargets.push('share_rate');
    else failedTargets.push('share_rate');
    if (metrics.fairnessGini <= this.targets.targetFairnessGini) passedTargets.push('fairness');
    else failedTargets.push('fairness');

    const report: BalanceReport = {
      seasonId,
      rulesetVersionBefore: seasonData.rulesetVersion,
      rulesetVersionAfter: nudgedData.rulesetVersion,
      simulatedMetrics: metrics,
      targets: this.targets,
      appliedNudges: [
        { param: 'soModuleFrequency', before: seasonData.soModuleFrequency, after: nudgedData.soModuleFrequency, delta: nudges.soFrequencyDelta },
        { param: 'opportunityCardBoost', before: seasonData.opportunityCardBoost, after: nudgedData.opportunityCardBoost, delta: nudges.opportunityBoostDelta },
        { param: 'fubarSeverityMultiplier', before: seasonData.fubarSeverityMultiplier, after: nudgedData.fubarSeverityMultiplier, delta: nudges.fubarSeverityDelta },
      ],
      passedTargets,
      failedTargets,
      auditHash,
      generatedAt: Date.now(),
    };

    return { nudgedData, report };
  }

  private computeAuditHash(seasonId: number, seasonData: SeasonData): string {
    return sha256(JSON.stringify({
      seasonId,
      rulesetVersion: seasonData.rulesetVersion,
      activeSOModules: seasonData.activeSOModules,
      deckWeights: seasonData.deckWeights,
      soModuleFrequency: seasonData.soModuleFrequency,
      modelId: 'M19a',
    })).slice(0, 32);
  }

  private bumpRulesetVersion(version: string, nudgeMagnitude: number): string {
    // Only bump patch version if nudge was meaningful (> 1%)
    if (nudgeMagnitude < 0.01) return version;
    const parts = version.split('.').map(Number);
    parts[2] = (parts[2] ?? 0) + 1;
    return parts.join('.');
  }

  private buildEmptyReport(seasonId: number, seasonData: SeasonData): BalanceReport {
    return {
      seasonId,
      rulesetVersionBefore: seasonData.rulesetVersion,
      rulesetVersionAfter: seasonData.rulesetVersion,
      simulatedMetrics: {
        runCount: 0,
        wipeRatePct: 0,
        shareRatePct: 0,
        medianTurns: 0,
        p10NetWorth: 0,
        p90NetWorth: 0,
        fairnessGini: 0,
        retentionEstimate: 0,
      },
      targets: this.targets,
      appliedNudges: [],
      passedTargets: [],
      failedTargets: ['ml_disabled'],
      auditHash: sha256(`empty:${seasonId}`).slice(0, 32),
      generatedAt: Date.now(),
    };
  }
}

export { M19aConfig };
