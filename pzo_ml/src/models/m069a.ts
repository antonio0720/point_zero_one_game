/**
 * M69a — Choice Drill Generator + Skill Rating (Micro-Sim Tests)
 * Source spec: ml/M69a_choice_drill_generator_skill_rating_micro_sim_tests.md
 * Design law: ML suggests + scores; deterministic rules + ledger decide.
 * Enforce: bounded nudges + audit_hash + ml_enabled kill-switch
 *
 * Deploy to: pzo_ml/src/models/m069a.ts
 */

import { createHash } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DrillDecisionType =
  | 'BUY_OR_PASS'
  | 'EXIT_OR_HOLD'
  | 'HEDGE_OR_PRESS'
  | 'SYNDICATE_OR_SOLO'
  | 'PAY_DEBT_OR_ACQUIRE';

export type DrillDifficulty = 'BEGINNER' | 'STANDARD' | 'ADVANCED' | 'EXPERT';

export interface DrillScenario {
  drillId: string;
  decisionType: DrillDecisionType;
  difficulty: DrillDifficulty;
  durationSeconds: number;          // 30–60s
  runSeed: string;                  // deterministic; same drill reproducible
  tickStart: number;
  scenarioState: Record<string, unknown>; // minimal game state for the drill
  choices: DrillChoice[];
  correctChoiceId: string;
  explanationKey: string;           // points to static explanation doc
}

export interface DrillChoice {
  choiceId: string;
  label: string;
  shortRationale: string;
}

export interface DrillResult {
  drillId: string;
  accountId: string;
  chosenId: string;
  isCorrect: boolean;
  completionMs: number;
  botLikelihood: number;           // 0–1; high = suspicious speed/pattern
  newSkillRating: number;          // ELO-style update
  auditHash: string;
}

export interface SkillProfile {
  accountId: string;
  rating: number;                  // ELO-like; starts at 1000
  drillsCompleted: number;
  lastUpdatedTick: number;
  cooldownUntilTick: number;       // bot detection cooldown
}

export interface DrillGeneratorInputs {
  accountId: string;
  skillProfile: SkillProfile;
  runSeed: string;
  tickIndex: number;
  rulesetVersion: string;
  seasonId: string;
  ledgerEventCount: number;
  onboardingSignals: { bootRunsCompleted: number; drillsThisSession: number };
  integritySignals: { actionBudgetAnomalies: number; validatorFlags: number };
  userOptIn: boolean;  // privacy: coaching toggled on
  mlEnabled: boolean;  // kill-switch
}

export interface DrillGeneratorOutputs {
  drill: DrillScenario | null;       // null if mlEnabled=false or cooldown active
  recommendation: 'SERVE_DRILL' | 'SKIP_TOO_EASY' | 'SKIP_COOLDOWN' | 'SKIP_ML_OFF';
  topFactors: string[];
  audit_hash: string;
  modelId: 'M69a';
  policyVersion: '1.0';
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_RATING = 1000;
const K_FACTOR = 32;                     // ELO K factor
const MAX_DRILLS_PER_SESSION = 5;        // anti-grind cap
const BOT_SPEED_THRESHOLD_MS = 800;      // sub-800ms completion is suspicious
const BOT_LIKE_COOLDOWN_TICKS = 50;
const MAX_RATING = 2500;
const MIN_RATING = 400;

// Difficulty gates by rating
const DIFFICULTY_THRESHOLDS: Record<DrillDifficulty, [number, number]> = {
  BEGINNER:  [0,    1100],
  STANDARD:  [1050, 1400],
  ADVANCED:  [1350, 1800],
  EXPERT:    [1750, 9999],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function deterministicFloat(seed: string, key: string): number {
  return parseInt(sha256(`${seed}:${key}`).slice(0, 8), 16) / 0xffffffff;
}

// ─── Skill Rating (ELO-like) ──────────────────────────────────────────────────

export function expectedScore(playerRating: number, drillRating: number): number {
  return 1 / (1 + Math.pow(10, (drillRating - playerRating) / 400));
}

export function updateRating(
  profile: SkillProfile,
  isCorrect: boolean,
  drillDifficulty: DrillDifficulty,
  completionMs: number,
  tick: number,
): SkillProfile {
  // Map difficulty to a notional "opponent" rating
  const drillOpponentRating: Record<DrillDifficulty, number> = {
    BEGINNER: 800, STANDARD: 1100, ADVANCED: 1500, EXPERT: 1900,
  };
  const oppRating = drillOpponentRating[drillDifficulty];
  const expected = expectedScore(profile.rating, oppRating);
  const actual = isCorrect ? 1 : 0;
  const delta = Math.round(K_FACTOR * (actual - expected));
  const newRating = clamp(profile.rating + delta, MIN_RATING, MAX_RATING);

  return {
    ...profile,
    rating: newRating,
    drillsCompleted: profile.drillsCompleted + 1,
    lastUpdatedTick: tick,
    cooldownUntilTick: completionMs < BOT_SPEED_THRESHOLD_MS ? tick + BOT_LIKE_COOLDOWN_TICKS : profile.cooldownUntilTick,
  };
}

// ─── Drill Selection ──────────────────────────────────────────────────────────

export function selectDifficulty(rating: number): DrillDifficulty {
  for (const [diff, [min, max]] of Object.entries(DIFFICULTY_THRESHOLDS) as Array<[DrillDifficulty, [number, number]]>) {
    if (rating >= min && rating < max) return diff;
  }
  return 'EXPERT';
}

export function selectDecisionType(
  runSeed: string,
  tickIndex: number,
  skillProfile: SkillProfile,
): DrillDecisionType {
  const types: DrillDecisionType[] = [
    'BUY_OR_PASS', 'EXIT_OR_HOLD', 'HEDGE_OR_PRESS', 'SYNDICATE_OR_SOLO', 'PAY_DEBT_OR_ACQUIRE',
  ];
  const idx = Math.floor(deterministicFloat(runSeed, `drill_type:${tickIndex}:${skillProfile.drillsCompleted}`) * types.length);
  return types[idx];
}

/**
 * Generate a deterministic drill scenario from the current game state context.
 * Drill is fully reproducible from runSeed + tickIndex.
 */
export function generateDrill(
  decisionType: DrillDecisionType,
  difficulty: DrillDifficulty,
  runSeed: string,
  tickStart: number,
): DrillScenario {
  const drillId = sha256(`drill:${runSeed}:${decisionType}:${difficulty}:${tickStart}`).slice(0, 18);

  // Deterministic scenario generation — real implementation populates from scenario lib
  const scenarios: Record<DrillDecisionType, { choices: DrillChoice[]; correctIdx: number; explanation: string }> = {
    BUY_OR_PASS: {
      choices: [
        { choiceId: 'A', label: 'Buy the deal (ROI 18%, Heat +0.15)', shortRationale: 'Adds cashflow but increases heat' },
        { choiceId: 'B', label: 'Pass — no liquid rung', shortRationale: 'Preserves liquidity ladder' },
      ],
      correctIdx: 1,
      explanation: 'drills/buy_or_pass_no_liquid_rung',
    },
    EXIT_OR_HOLD: {
      choices: [
        { choiceId: 'A', label: 'Exit now — take 12% ROI', shortRationale: 'Locks gain; frees rung' },
        { choiceId: 'B', label: 'Hold — macro expansion active', shortRationale: 'Higher ceiling; more risk' },
      ],
      correctIdx: 0,
      explanation: 'drills/exit_or_hold_macro',
    },
    HEDGE_OR_PRESS: {
      choices: [
        { choiceId: 'A', label: 'Hedge with correlation pair', shortRationale: 'Reduces cascade risk' },
        { choiceId: 'B', label: 'Press — add same-class asset', shortRationale: 'Doubles down on thesis' },
      ],
      correctIdx: 0,
      explanation: 'drills/hedge_vs_press',
    },
    SYNDICATE_OR_SOLO: {
      choices: [
        { choiceId: 'A', label: 'Form syndicate (3 players)', shortRationale: 'Shares risk; dilutes upside' },
        { choiceId: 'B', label: 'Solo — full ownership', shortRationale: 'Full upside; full liability' },
      ],
      correctIdx: difficulty === 'BEGINNER' ? 0 : 1,
      explanation: 'drills/syndicate_vs_solo',
    },
    PAY_DEBT_OR_ACQUIRE: {
      choices: [
        { choiceId: 'A', label: 'Pay down liability — reduce heat', shortRationale: 'Lowers forced-sale risk' },
        { choiceId: 'B', label: 'Acquire new IPA — grow cashflow', shortRationale: 'Higher cashflow; more debt load' },
      ],
      correctIdx: 0,
      explanation: 'drills/pay_vs_acquire',
    },
  };

  const s = scenarios[decisionType];
  const seed_idx = Math.floor(deterministicFloat(runSeed, `correct_variance:${tickStart}`) * 2); // slight variance
  const correctIdx = clamp(s.correctIdx + (difficulty === 'EXPERT' ? seed_idx : 0), 0, s.choices.length - 1);

  return {
    drillId,
    decisionType,
    difficulty,
    durationSeconds: difficulty === 'BEGINNER' ? 60 : difficulty === 'EXPERT' ? 30 : 45,
    runSeed,
    tickStart,
    scenarioState: { difficulty, decisionType }, // engine injects full state at runtime
    choices: s.choices,
    correctChoiceId: s.choices[correctIdx].choiceId,
    explanationKey: s.explanation,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function runDrillGenerator(inputs: DrillGeneratorInputs): DrillGeneratorOutputs {
  const { skillProfile, runSeed, tickIndex, mlEnabled, onboardingSignals, integritySignals } = inputs;

  const topFactors: string[] = [];

  // Kill-switch
  if (!mlEnabled) {
    return {
      drill: null,
      recommendation: 'SKIP_ML_OFF',
      topFactors: [],
      audit_hash: sha256(JSON.stringify({ inputs: { runSeed, tickIndex }, policy_version: '1.0' })),
      modelId: 'M69a',
      policyVersion: '1.0',
    };
  }

  // Bot detection cooldown
  if (tickIndex < skillProfile.cooldownUntilTick) {
    topFactors.push(`bot_cooldown_active:until_tick_${skillProfile.cooldownUntilTick}`);
    const audit_hash = sha256(JSON.stringify({ reason: 'COOLDOWN', tickIndex, policy_version: '1.0' }));
    return { drill: null, recommendation: 'SKIP_COOLDOWN', topFactors, audit_hash, modelId: 'M69a', policyVersion: '1.0' };
  }

  // Session drill cap (anti-grind)
  if (onboardingSignals.drillsThisSession >= MAX_DRILLS_PER_SESSION) {
    topFactors.push(`session_cap_reached:${MAX_DRILLS_PER_SESSION}`);
    const audit_hash = sha256(JSON.stringify({ reason: 'SESSION_CAP', policy_version: '1.0' }));
    return { drill: null, recommendation: 'SKIP_TOO_EASY', topFactors, audit_hash, modelId: 'M69a', policyVersion: '1.0' };
  }

  if (integritySignals.actionBudgetAnomalies > 3) topFactors.push('integrity_anomalies_detected');
  if (skillProfile.rating > 1800) topFactors.push('expert_track');

  const difficulty = selectDifficulty(skillProfile.rating);
  const decisionType = selectDecisionType(runSeed, tickIndex, skillProfile);
  const drill = generateDrill(decisionType, difficulty, runSeed, tickIndex);

  topFactors.push(`difficulty:${difficulty}`, `type:${decisionType}`, `rating:${skillProfile.rating}`);

  const outputsWithoutHash = {
    drill,
    recommendation: 'SERVE_DRILL' as const,
    topFactors,
    modelId: 'M69a' as const,
    policyVersion: '1.0' as const,
  };

  const audit_hash = sha256(JSON.stringify({
    inputs: { runSeed, tickIndex, rulesetVersion: inputs.rulesetVersion, rating: skillProfile.rating },
    outputs: { drillId: drill.drillId, difficulty, decisionType },
    policy_version: '1.0',
    caps: { MAX_DRILLS_PER_SESSION, BOT_SPEED_THRESHOLD_MS },
  }));

  return { ...outputsWithoutHash, audit_hash };
}

/**
 * Evaluate a completed drill. Returns updated skill profile + result.
 */
export function evaluateDrillResult(
  drill: DrillScenario,
  accountId: string,
  chosenId: string,
  completionMs: number,
  profile: SkillProfile,
  tick: number,
): DrillResult {
  const isCorrect = chosenId === drill.correctChoiceId;
  const botLikelihood = completionMs < BOT_SPEED_THRESHOLD_MS ? clamp(1 - completionMs / BOT_SPEED_THRESHOLD_MS, 0, 1) : 0;

  const updatedProfile = updateRating(profile, isCorrect, drill.difficulty, completionMs, tick);

  const auditHash = sha256(JSON.stringify({
    drillId: drill.drillId, accountId, chosenId, isCorrect, completionMs, botLikelihood, newRating: updatedProfile.rating,
    policy_version: '1.0',
  }));

  return {
    drillId: drill.drillId,
    accountId,
    chosenId,
    isCorrect,
    completionMs,
    botLikelihood,
    newSkillRating: updatedProfile.rating,
    auditHash,
  };
}
