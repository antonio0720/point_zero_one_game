/**
 * M125a — No-Ghost Hardcore (ML/DL Companion: Hardcore Integrity Monitor)
 * Source spec: ml/M125a_no_ghost_hardcore_ml_dl_companion_hardcore_integrity_monitor.md
 * Design law: Gating is deterministic; ML only estimates difficulty label.
 * Enforce: bounded nudges + audit_hash + ml_enabled kill-switch
 *
 * Deploy to: pzo_ml/src/models/m125a.ts
 */

import { createHash } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type HardcorePrestigeTier = 'NONE' | 'BRONZE' | 'SILVER' | 'GOLD' | 'SOVEREIGN';

export type HardcoreViolationCode =
  | 'UI_ASSIST_ENABLED'       // any UI aid flag was active
  | 'GHOST_RUN_DETECTED'      // replay ghost was enabled
  | 'ML_COACHING_ON'          // ML coaching mode active (only integrity ML allowed)
  | 'PRACTICE_MODE_LEAK'      // practice sandbox flags leaked
  | 'CONFIG_TAMPER_SUSPECTED' // integrity signal anomaly in config
  | 'REPLAY_MISMATCH';        // post-run replay didn't match declared config

export interface HardcoreRunConfig {
  runSeed: string;
  rulesetVersion: string;
  seasonModules: string[];
  // Flags that MUST be false for hardcore compliance
  uiAssistEnabled: boolean;
  ghostRunEnabled: boolean;
  mlCoachingEnabled: boolean;
  practiceSandboxEnabled: boolean;
}

export interface HardcoreGateResult {
  passed: boolean;
  violationCodes: HardcoreViolationCode[];
  receiptHash: string;
}

export interface HardcoreRunOutcome {
  runSeed: string;
  ticksElapsed: number;
  wipeOccurred: boolean;
  wipeReason: string | null;
  finalEquity: number;
  macroShocksEncountered: number;
  uniqueDecisionTypes: string[];
  proofHash: string;
}

export interface IntegrityMonitorInputs {
  runConfig: HardcoreRunConfig;
  runOutcome: HardcoreRunOutcome;
  configFlagsAtRuntime: Record<string, boolean>; // server-verified config snapshot
  replayValidated: boolean;  // verifier-service confirmed replay matches declared config
  mlEnabled: boolean;
}

export interface IntegrityMonitorOutputs {
  gateResult: HardcoreGateResult;
  prestigeTier: HardcorePrestigeTier;     // cosmetic only
  prestigeLabel: string;
  postMortemDossier: HardcoreDossier | null;
  recommendation: 'PRESTIGE_GRANTED' | 'GATE_FAILED' | 'ML_OFF_RULE_ONLY';
  topFactors: string[];
  audit_hash: string;
  modelId: 'M125a';
  policyVersion: '1.0';
}

export interface HardcoreDossier {
  runSeed: string;
  wipeReason: string | null;
  keyDecisions: string[];
  difficultyScore: number;   // 0–1; estimated by ML
  prestigeTier: HardcorePrestigeTier;
  receiptHash: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POLICY_VERSION = '1.0';

const PRESTIGE_THRESHOLDS: Array<{ tier: HardcorePrestigeTier; minDifficulty: number; requiresNoWipe: boolean }> = [
  { tier: 'SOVEREIGN', minDifficulty: 0.85, requiresNoWipe: true },
  { tier: 'GOLD',      minDifficulty: 0.70, requiresNoWipe: true },
  { tier: 'SILVER',    minDifficulty: 0.50, requiresNoWipe: false },
  { tier: 'BRONZE',    minDifficulty: 0.00, requiresNoWipe: false },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ─── Deterministic Gate (ML-free; always runs) ────────────────────────────────

export function hardcoreComplianceGate(
  config: HardcoreRunConfig,
  runtimeFlags: Record<string, boolean>,
  replayValidated: boolean,
): HardcoreGateResult {
  const violations: HardcoreViolationCode[] = [];

  if (config.uiAssistEnabled || runtimeFlags['uiAssist']) violations.push('UI_ASSIST_ENABLED');
  if (config.ghostRunEnabled || runtimeFlags['ghostRun']) violations.push('GHOST_RUN_DETECTED');
  if (config.mlCoachingEnabled || runtimeFlags['mlCoaching']) violations.push('ML_COACHING_ON');
  if (config.practiceSandboxEnabled || runtimeFlags['practiceSandbox']) violations.push('PRACTICE_MODE_LEAK');
  if (!replayValidated) violations.push('REPLAY_MISMATCH');

  // Config tamper: any unexpected flag set in runtime snapshot
  const unexpectedFlags = Object.entries(runtimeFlags).filter(
    ([key, val]) => val === true && !['uiAssist', 'ghostRun', 'mlCoaching', 'practiceSandbox'].includes(key),
  );
  if (unexpectedFlags.length > 0) violations.push('CONFIG_TAMPER_SUSPECTED');

  const receiptHash = sha256(JSON.stringify({ violations, runSeed: config.runSeed, rulesetVersion: config.rulesetVersion })).slice(0, 24);

  return { passed: violations.length === 0, violationCodes: violations, receiptHash };
}

// ─── Difficulty Estimator (ML) ────────────────────────────────────────────────

function estimateDifficulty(outcome: HardcoreRunOutcome, config: HardcoreRunConfig): number {
  let score = 0;

  // Longer run = harder
  score += clamp(outcome.ticksElapsed / 720, 0, 0.25); // 720 ticks = max 12-min run

  // More macro shocks survived
  score += clamp(outcome.macroShocksEncountered * 0.05, 0, 0.20);

  // Wipe happened but player still completed course (e.g. partial run)
  if (outcome.wipeOccurred) score -= 0.15;

  // Decision variety
  score += clamp(outcome.uniqueDecisionTypes.length * 0.04, 0, 0.20);

  // High final equity (survived and thrived)
  score += clamp(outcome.finalEquity / 500_000, 0, 0.25);

  // Season module complexity bonus
  score += clamp(config.seasonModules.length * 0.02, 0, 0.10);

  return clamp(score, 0, 1);
}

// ─── Prestige Assignment ──────────────────────────────────────────────────────

function assignPrestige(difficultyScore: number, noWipe: boolean): HardcorePrestigeTier {
  for (const { tier, minDifficulty, requiresNoWipe } of PRESTIGE_THRESHOLDS) {
    if (difficultyScore >= minDifficulty && (!requiresNoWipe || noWipe)) {
      return tier;
    }
  }
  return 'NONE';
}

const PRESTIGE_LABELS: Record<HardcorePrestigeTier, string> = {
  NONE: 'Attempted',
  BRONZE: 'Hardcore Survivor',
  SILVER: 'No Ghost',
  GOLD: 'Ironclad',
  SOVEREIGN: 'Sovereign Operator',
};

// ─── Dossier Builder ──────────────────────────────────────────────────────────

function buildDossier(
  outcome: HardcoreRunOutcome,
  prestigeTier: HardcorePrestigeTier,
  difficultyScore: number,
): HardcoreDossier {
  const keyDecisions: string[] = [];
  if (outcome.wipeOccurred && outcome.wipeReason) keyDecisions.push(`WIPE: ${outcome.wipeReason}`);
  if (outcome.macroShocksEncountered > 0) keyDecisions.push(`Survived ${outcome.macroShocksEncountered} macro shocks`);
  keyDecisions.push(...outcome.uniqueDecisionTypes.slice(0, 3).map(d => `Decision: ${d}`));

  const receiptHash = sha256(JSON.stringify({ runSeed: outcome.runSeed, prestigeTier, difficultyScore })).slice(0, 24);

  return {
    runSeed: outcome.runSeed,
    wipeReason: outcome.wipeReason,
    keyDecisions,
    difficultyScore,
    prestigeTier,
    receiptHash,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function runHardcoreIntegrityMonitor(inputs: IntegrityMonitorInputs): IntegrityMonitorOutputs {
  const { runConfig, runOutcome, configFlagsAtRuntime, replayValidated, mlEnabled } = inputs;

  // Gate is always deterministic — no kill-switch here
  const gateResult = hardcoreComplianceGate(runConfig, configFlagsAtRuntime, replayValidated);

  const topFactors: string[] = [];
  if (!gateResult.passed) {
    topFactors.push(...gateResult.violationCodes.map(c => `violation:${c}`));
  }

  if (!mlEnabled || !gateResult.passed) {
    const audit_hash = sha256(JSON.stringify({
      runSeed: runConfig.runSeed, gateResult, policy_version: POLICY_VERSION,
    }));
    return {
      gateResult,
      prestigeTier: 'NONE',
      prestigeLabel: PRESTIGE_LABELS.NONE,
      postMortemDossier: null,
      recommendation: !mlEnabled ? 'ML_OFF_RULE_ONLY' : 'GATE_FAILED',
      topFactors,
      audit_hash,
      modelId: 'M125a',
      policyVersion: '1.0',
    };
  }

  // ML: estimate difficulty + assign prestige
  const difficultyScore = estimateDifficulty(runOutcome, runConfig);
  const prestigeTier = assignPrestige(difficultyScore, !runOutcome.wipeOccurred);
  const dossier = buildDossier(runOutcome, prestigeTier, difficultyScore);

  topFactors.push(
    `difficulty:${Math.round(difficultyScore * 100)}%`,
    `prestige:${prestigeTier}`,
    runOutcome.wipeOccurred ? 'wipe_occurred' : 'wipe_free',
    `shocks_survived:${runOutcome.macroShocksEncountered}`,
  );

  const audit_hash = sha256(JSON.stringify({
    runSeed: runConfig.runSeed,
    gateResult: { passed: gateResult.passed, violationCodes: gateResult.violationCodes },
    prestigeTier,
    difficultyScore,
    policy_version: POLICY_VERSION,
    caps: { PRESTIGE_THRESHOLDS },
  }));

  return {
    gateResult,
    prestigeTier,
    prestigeLabel: PRESTIGE_LABELS[prestigeTier],
    postMortemDossier: dossier,
    recommendation: 'PRESTIGE_GRANTED',
    topFactors,
    audit_hash,
    modelId: 'M125a',
    policyVersion: '1.0',
  };
}
