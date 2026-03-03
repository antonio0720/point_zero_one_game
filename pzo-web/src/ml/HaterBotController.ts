/**
 * HaterBotController — src/ml/HaterBotController.ts
 * Point Zero One · Density6 LLC · Confidential
 *
 * Upgrade #3: RL-Constrained Adversarial Bot Behavior
 *
 * Hater bots target player weaknesses with guardrails to prevent
 * hopelessness. Behavior policy is derived from player model outputs
 * rather than fixed scripts.
 *
 * RL objective: "maximize hard decisions, minimize player abandonment"
 * Constraints:
 *   - capped burst damage (never exceed BURST_CAP in one tick)
 *   - minimum counterplay frequency (player must always have an out)
 *   - adaptive difficulty ceiling (backs off if churn risk > 0.7)
 */

import type { IntelligenceOutput } from './PlayerModelEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BotAction =
  | 'INJECT_FUBAR'
  | 'INJECT_OBLIGATION'
  | 'SABOTAGE_CASHFLOW'
  | 'TRIGGER_ISOLATION_TAX'
  | 'FORCE_BIAS_STATE'
  | 'ACCELERATE_TICK_TIER'
  | 'SPAWN_RIVAL_BOT'
  | 'COUNTERPLAY_BLOCK'
  | 'BACK_OFF';             // guardrail — do nothing this tick

export interface BotDecision {
  action:          BotAction;
  severity:        'MINOR' | 'MAJOR' | 'CRITICAL';
  targetWeakness:  string;
  damage:          number;
  hasCounterplay:  boolean;
  reasoning:       string;
}

export interface BotConstraints {
  /** Max total damage per tick window */
  burstCap:                number;
  /** Minimum ticks between CRITICAL actions */
  criticalCooldownTicks:   number;
  /** Churn risk above this → back off */
  churnRiskCeiling:        number;
  /** Fraction of actions that must have counterplay available */
  minCounterplayRate:      number;
}

const DEFAULT_CONSTRAINTS: BotConstraints = {
  burstCap:                12_000,
  criticalCooldownTicks:   48,
  churnRiskCeiling:        0.72,
  minCounterplayRate:      0.60,
};

// ─── Weakness → Action Mapping ────────────────────────────────────────────────

function selectTargetAction(intel: IntelligenceOutput): {
  action: BotAction;
  weakness: string;
  baseDamage: number;
} {
  // Target highest risk signal
  const signals: Array<{ action: BotAction; signal: number; weakness: string; damage: number }> = [
    { action: 'INJECT_FUBAR',          signal: intel.risk,           weakness: 'low_resilience',     damage: 8_000  },
    { action: 'FORCE_BIAS_STATE',      signal: intel.biasScore,      weakness: 'bias_susceptibility', damage: 0     },
    { action: 'SABOTAGE_CASHFLOW',     signal: intel.bankruptcyRisk60, weakness: 'cashflow_fragility', damage: 3_000 },
    { action: 'INJECT_OBLIGATION',     signal: 1 - intel.convergenceSignal, weakness: 'poor_planning', damage: 1_500 },
    { action: 'COUNTERPLAY_BLOCK',     signal: intel.windowFailRisk, weakness: 'window_timing',       damage: 0     },
    { action: 'TRIGGER_ISOLATION_TAX', signal: intel.volatility,     weakness: 'market_exposure',     damage: 5_000 },
    { action: 'ACCELERATE_TICK_TIER',  signal: intel.tiltRisk,       weakness: 'tilt_vulnerable',     damage: 0     },
  ];

  const sorted = signals.sort((a, b) => b.signal - a.signal);
  const top = sorted[0];
  return { action: top.action, weakness: top.weakness, baseDamage: top.damage };
}

// ─── Bot Controller ───────────────────────────────────────────────────────────

export class HaterBotController {
  private lastCriticalTick = -999;
  private recentActions:    BotAction[] = [];
  private constraints:      BotConstraints;

  constructor(constraints: Partial<BotConstraints> = {}) {
    this.constraints = { ...DEFAULT_CONSTRAINTS, ...constraints };
  }

  decide(
    intel:       IntelligenceOutput,
    currentTick: number,
    pressureTier: 1 | 2 | 3 | 4 | 5,
  ): BotDecision {
    // Guardrail 1: back off if churn risk is too high
    if (intel.churnRisk > this.constraints.churnRiskCeiling) {
      return this.backOff('Churn risk ceiling reached — protecting player retention');
    }

    // Guardrail 2: critical cooldown
    const critCooldownActive =
      currentTick - this.lastCriticalTick < this.constraints.criticalCooldownTicks;

    const { action, weakness, baseDamage } = selectTargetAction(intel);

    // Scale severity by pressure tier and intel risk
    const severity: BotDecision['severity'] =
      pressureTier >= 4 && intel.risk > 0.6 && !critCooldownActive ? 'CRITICAL' :
      pressureTier >= 3 && intel.risk > 0.4 ? 'MAJOR' : 'MINOR';

    // Scale damage
    const tierMult  = [1.0, 1.1, 1.3, 1.6, 2.0][pressureTier - 1];
    const damage    = Math.min(
      this.constraints.burstCap,
      Math.round(baseDamage * tierMult * (0.8 + intel.risk * 0.4)),
    );

    // Counterplay rate enforcement
    const recentCounterplayRate =
      this.recentActions.length > 0
        ? this.recentActions.filter(a => a !== 'INJECT_FUBAR' && a !== 'TRIGGER_ISOLATION_TAX').length /
          this.recentActions.length
        : 1;

    const hasCounterplay =
      recentCounterplayRate >= this.constraints.minCounterplayRate ||
      action === 'FORCE_BIAS_STATE' ||
      action === 'COUNTERPLAY_BLOCK';

    if (!hasCounterplay && severity === 'CRITICAL') {
      return this.backOff('Counterplay rate below minimum — must give player an out');
    }

    if (severity === 'CRITICAL') {
      this.lastCriticalTick = currentTick;
    }

    this.recentActions = [...this.recentActions.slice(-9), action];

    return {
      action,
      severity,
      targetWeakness: weakness,
      damage,
      hasCounterplay,
      reasoning: `Targeting ${weakness} (risk=${intel.risk.toFixed(2)}, tier=${pressureTier})`,
    };
  }

  private backOff(reasoning: string): BotDecision {
    this.recentActions = [...this.recentActions.slice(-9), 'BACK_OFF'];
    return {
      action: 'BACK_OFF',
      severity: 'MINOR',
      targetWeakness: 'none',
      damage: 0,
      hasCounterplay: true,
      reasoning,
    };
  }

  reset(): void {
    this.lastCriticalTick = -999;
    this.recentActions    = [];
  }
}