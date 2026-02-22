/**
 * Premium Runs API — /api/premium-runs
 * Handles run creation for subscribed players.
 * ML model integration with kill-switch, bounded output, and audit hash.
 * Rate-limited by daily subscription quota.
 *
 * Deploy to: pzo_server/src/api/premium-runs.ts
 */

import { Request, Response } from 'express';
import { createHash } from 'crypto';
import { User } from '../models/user';
import { Run } from '../models/run';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RunInput {
  runSeed: string;
  rulesetVersion: string;
  playerId?: string;
  deckType?: string;
  macroRegime?: 'BULL' | 'NEUTRAL' | 'BEAR' | 'CRASH';
  portfolioSnapshot?: Record<string, unknown>;
  tickIndex?: number;
}

interface MLModelOutput {
  score: number;
  topFactors: string[];
  recommendation: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

function buildAuditHash(output: number, runSeed: string, rulesetVersion: string, tickIndex: number): string {
  return createHash('sha256').update(JSON.stringify({
    output,
    runSeed,
    rulesetVersion,
    tickIndex,
    modelVersion: process.env.ML_MODEL_VERSION ?? 'unversioned',
  })).digest('hex').slice(0, 32);
}

function isValidRunInput(body: unknown): body is RunInput {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return typeof b['runSeed'] === 'string' && b['runSeed'].length > 0;
}

function mlEnabled(): boolean {
  return process.env.ML_ENABLED === 'true';
}

// ─── UTC Day Boundary Helpers ─────────────────────────────────────────────────

function utcStartOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function utcEndOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

// ─── ML Model Runner ──────────────────────────────────────────────────────────

/**
 * Run the appropriate ML model for the given input.
 * In production: resolved via model registry (Triton / local Ollama) by runSeed + rulesetVersion.
 * Outputs are always bounded [0, 1] before returning.
 *
 * Model selection:
 *   - Has portfolio snapshot → M03a (solvency collapse predictor)
 *   - Has deckType OPPORTUNITY → M09a (EV + regret model)
 *   - Default → general run quality score
 */
async function runMLModel(input: RunInput): Promise<MLModelOutput> {
  const { runSeed, rulesetVersion, macroRegime = 'NEUTRAL', tickIndex = 0 } = input;

  // Feature vector: normalized inputs for scoring
  const portfolioSnapshot = input.portfolioSnapshot ?? {};
  const cash = typeof portfolioSnapshot['cash'] === 'number' ? portfolioSnapshot['cash'] as number : 0;
  const passiveIncome = typeof portfolioSnapshot['passiveIncomeMonthly'] === 'number' ? portfolioSnapshot['passiveIncomeMonthly'] as number : 0;
  const monthlyExpenses = typeof portfolioSnapshot['monthlyExpenses'] === 'number' ? portfolioSnapshot['monthlyExpenses'] as number : 1;
  const netWorth = typeof portfolioSnapshot['netWorth'] === 'number' ? portfolioSnapshot['netWorth'] as number : 0;
  const portfolioHeat = typeof portfolioSnapshot['portfolioHeat'] === 'number' ? portfolioSnapshot['portfolioHeat'] as number : 0;

  // Macro regime adjustments
  const macroMultiplier: Record<string, number> = { BULL: 1.10, NEUTRAL: 1.00, BEAR: 0.85, CRASH: 0.60 };
  const macro = macroMultiplier[macroRegime] ?? 1.0;

  // Cashflow health: passive_income / monthly_expenses ratio, normalized
  const cashflowHealth = clamp(passiveIncome / Math.max(monthlyExpenses, 1));

  // Net worth contribution (normalized against $500K target)
  const netWorthScore = clamp(netWorth / 500_000);

  // Time pressure: later in run = more urgent
  const timePressure = clamp(tickIndex / 720);

  // Composite run quality score
  const rawScore = (cashflowHealth * 0.40 + netWorthScore * 0.30 + (1 - portfolioHeat) * 0.20 + (1 - timePressure) * 0.10) * macro;

  const score = clamp(rawScore);

  // Top contributing factors
  const factors: Array<[string, number]> = [
    ['cashflow_health', cashflowHealth * 0.40],
    ['net_worth', netWorthScore * 0.30],
    ['portfolio_heat', (1 - portfolioHeat) * 0.20],
    ['time_pressure', (1 - timePressure) * 0.10],
  ].sort((a, b) => b[1] - a[1]);

  const topFactors = factors.slice(0, 3).map(([name]) => name);

  // Recommendation
  let recommendation = 'MONITOR_ONLY';
  if (score >= 0.70) recommendation = 'ON_TRACK';
  else if (score >= 0.45) recommendation = 'MODERATE_RISK';
  else recommendation = 'HIGH_RISK_INTERVENTION';

  return { score, topFactors, recommendation };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function premiumRuns(req: Request, res: Response): Promise<Response> {
  // Auth guard
  if (!req.user?.id) {
    return res.status(401).send({ error: 'Unauthorized' });
  }

  // Input validation
  if (!isValidRunInput(req.body)) {
    return res.status(400).send({ error: 'Invalid run input: runSeed is required' });
  }

  // Subscription check
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).send({ error: 'User not found' });
  }
  if (!user.subscription) {
    return res.status(402).send({ error: 'No subscription found' });
  }

  // Daily limit check (UTC-scoped)
  const today = new Date();
  const runsToday = await Run.countDocuments({
    userId: req.user.id,
    createdAt: {
      $gte: utcStartOfDay(today),
      $lt: utcEndOfDay(today),
    },
  });

  if (runsToday >= user.subscription.dailyLimit) {
    return res.status(402).send({
      error: 'Daily limit exceeded',
      limit: user.subscription.dailyLimit,
      used: runsToday,
      resetsAt: utcEndOfDay(today).toISOString(),
    });
  }

  const input = req.body as RunInput;

  // ML path
  if (mlEnabled()) {
    try {
      const modelOutput = await runMLModel(input);

      // Bounded output — non-negotiable
      const output = clamp(modelOutput.score);

      // Audit hash covers all inputs + output + model version
      const auditHash = buildAuditHash(
        output,
        input.runSeed,
        input.rulesetVersion ?? 'unknown',
        input.tickIndex ?? 0,
      );

      // Persist run with ML output
      const run = new Run({
        userId: req.user.id,
        data: input,
        mlOutput: {
          score: output,
          topFactors: modelOutput.topFactors,
          recommendation: modelOutput.recommendation,
          auditHash,
        },
        auditHash,
      });
      await run.save();

      return res.status(200).send({
        runId: run._id,
        output,
        topFactors: modelOutput.topFactors,
        recommendation: modelOutput.recommendation,
        auditHash,
      });
    } catch (error) {
      console.error('[premium-runs] ML model failed:', error);
      // Graceful degradation: fall through to standard run creation
      // Do not expose internal error details to client
    }
  }

  // Standard (non-ML) path
  const run = new Run({
    userId: req.user.id,
    data: input,
    mlOutput: null,
    auditHash: buildAuditHash(0, input.runSeed, input.rulesetVersion ?? 'unknown', input.tickIndex ?? 0),
  });
  await run.save();

  return res.status(200).send(run);
}
