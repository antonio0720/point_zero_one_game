/**
 * KnowledgeTracer — src/ml/KnowledgeTracer.ts
 * Point Zero One · Density6 LLC · Confidential
 *
 * Upgrade #2: Knowledge Tracing via educational_tag
 *
 * Bayesian Knowledge Tracing (BKT) approximation per financial principle.
 * Tracks mastery across plays — under pressure results matter more.
 *
 * Each card carries an educational_tag (e.g. "cashflow_management",
 * "leverage_risk", "diversification"). This module models whether the
 * player has internalized the principle based on correct vs incorrect
 * decisions involving that tag under varying pressure levels.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type KnowledgeTag =
  | 'cashflow_management'
  | 'leverage_risk'
  | 'diversification'
  | 'obligation_coverage'
  | 'opportunity_cost'
  | 'tax_efficiency'
  | 'insurance_timing'
  | 'market_timing'
  | 'network_effects'
  | 'behavioral_bias'
  | 'due_diligence'
  | 'liquidity_management'
  | string; // extensible

export interface KnowledgeState {
  tag:             KnowledgeTag;
  /** 0–1 mastery probability */
  mastery:         number;
  /** Total exposures (plays involving this tag) */
  exposures:       number;
  /** Correct applications under normal pressure */
  correctNormal:   number;
  /** Correct applications under high pressure (tier 3+) */
  correctPressure: number;
  /** Total failures under high pressure */
  failsPressure:   number;
  /** Last tick this was updated */
  lastUpdatedTick: number;
}

export interface PlayOutcome {
  tag:              KnowledgeTag;
  wasCorrect:       boolean;
  pressureTier:     1 | 2 | 3 | 4 | 5;
  tick:             number;
  /** How fast the decision was made (0–1, 1 = optimal) */
  speedScore:       number;
}

export interface TrainingRecommendation {
  tag:         KnowledgeTag;
  mastery:     number;
  drill:       string;
  priority:    'HIGH' | 'MEDIUM' | 'LOW';
}

// ─── BKT Parameters ──────────────────────────────────────────────────────────
// Standard BKT: p(L0)=prior, p(T)=learn, p(S)=slip, p(G)=guess

const BKT_LEARN  = 0.18;  // probability of mastery gain per correct
const BKT_FORGET = 0.02;  // probability of mastery decay per tick (slow)
const BKT_SLIP   = 0.10;  // probability of error despite mastery
const BKT_GUESS  = 0.08;  // probability of correct despite no mastery

const PRESSURE_WEIGHT = 1.8; // correct under pressure counts more

// ─── Knowledge Tracer ────────────────────────────────────────────────────────

export class KnowledgeTracer {
  private states = new Map<KnowledgeTag, KnowledgeState>();

  private initState(tag: KnowledgeTag): KnowledgeState {
    return {
      tag,
      mastery:         0.3, // prior — slight default mastery assumed
      exposures:       0,
      correctNormal:   0,
      correctPressure: 0,
      failsPressure:   0,
      lastUpdatedTick: 0,
    };
  }

  private getOrCreate(tag: KnowledgeTag): KnowledgeState {
    if (!this.states.has(tag)) {
      this.states.set(tag, this.initState(tag));
    }
    return this.states.get(tag)!;
  }

  // ── Core BKT Update ─────────────────────────────────────────────────────────

  record(outcome: PlayOutcome): void {
    const s = this.getOrCreate(outcome.tag);
    const isHighPressure = outcome.pressureTier >= 3;

    s.exposures++;
    s.lastUpdatedTick = outcome.tick;

    if (outcome.wasCorrect) {
      if (isHighPressure) s.correctPressure++;
      else s.correctNormal++;
    } else if (isHighPressure) {
      s.failsPressure++;
    }

    // BKT update
    const weight   = isHighPressure ? PRESSURE_WEIGHT : 1.0;
    const speedMod = 0.8 + outcome.speedScore * 0.4; // fast + correct = stronger update

    if (outcome.wasCorrect) {
      // P(L|correct) = P(L) * (1 - P(S)) / P(correct)
      const pCorrect = s.mastery * (1 - BKT_SLIP) + (1 - s.mastery) * BKT_GUESS;
      const pLGivenCorrect = (s.mastery * (1 - BKT_SLIP)) / Math.max(0.001, pCorrect);
      s.mastery = pLGivenCorrect + (1 - pLGivenCorrect) * BKT_LEARN * weight * speedMod;
    } else {
      // P(L|wrong) = P(L) * P(S) / P(wrong)
      const pWrong = s.mastery * BKT_SLIP + (1 - s.mastery) * (1 - BKT_GUESS);
      const pLGivenWrong = (s.mastery * BKT_SLIP) / Math.max(0.001, pWrong);
      s.mastery = pLGivenWrong + (1 - pLGivenWrong) * BKT_LEARN * 0.2;
    }

    s.mastery = Math.max(0, Math.min(1, s.mastery));

    // Apply decay for tags not seen recently
    const tickGap = outcome.tick - s.lastUpdatedTick;
    if (tickGap > 120) {
      s.mastery = Math.max(0.05, s.mastery - BKT_FORGET * (tickGap / 120));
    }
  }

  getMastery(tag: KnowledgeTag): number {
    return this.getOrCreate(tag).mastery;
  }

  getAllStates(): KnowledgeState[] {
    return Array.from(this.states.values());
  }

  /** Weakest 3 tags under pressure — used for training plan */
  getWeakestUnderPressure(n = 3): KnowledgeState[] {
    return this.getAllStates()
      .filter(s => s.exposures >= 2)
      .sort((a, b) => {
        const aScore = a.mastery - (a.failsPressure / Math.max(1, a.exposures)) * 0.5;
        const bScore = b.mastery - (b.failsPressure / Math.max(1, b.exposures)) * 0.5;
        return aScore - bScore;
      })
      .slice(0, n);
  }

  /** Generate next-run training plan */
  getTrainingPlan(): TrainingRecommendation[] {
    const weak = this.getWeakestUnderPressure(3);
    return weak.map((s, i) => ({
      tag:      s.tag,
      mastery:  s.mastery,
      drill:    buildDrill(s.tag, s.mastery),
      priority: i === 0 ? 'HIGH' : i === 1 ? 'MEDIUM' : 'LOW',
    }));
  }

  snapshot(): Record<KnowledgeTag, number> {
    const out: Record<string, number> = {};
    for (const [tag, state] of this.states) {
      out[tag] = state.mastery;
    }
    return out;
  }
}

// ─── Drill Generator ──────────────────────────────────────────────────────────

const DRILL_MAP: Record<string, string> = {
  cashflow_management:   'Play 3 consecutive BUILD zone cards under Tier 3+ pressure without missing a window',
  leverage_risk:         'Complete a run without letting obligation coverage drop below 1.2×',
  diversification:       'Hold assets across 4 distinct asset classes before tick 600',
  obligation_coverage:   'Maintain 2× obligation coverage through an ACCELERATION phase',
  opportunity_cost:      'Resolve 5 consecutive decision windows before the halfway mark',
  tax_efficiency:        'Use a compliance mitigation card within 24 ticks of a FUBAR hit',
  insurance_timing:      'Have an active insurance mitigation before any FUBAR in tier 4+',
  market_timing:         'Play a FLIP zone card inside a GBM alignment window',
  network_effects:       'Complete a Syndicate rescue while maintaining positive trust',
  behavioral_bias:       'Clear an active bias within 60 ticks of activation 3 times',
  due_diligence:         'Avoid all fraudulent counterparty cards in a full run',
  liquidity_management:  'Never let cash reserves drop below $5,000 through CRISIS phase',
};

function buildDrill(tag: KnowledgeTag, mastery: number): string {
  const base = DRILL_MAP[tag] ?? `Practice decisions involving ${tag} under Tier 3+ pressure`;
  const intensifier = mastery < 0.3 ? ' (Critical — do this first)' :
                      mastery < 0.5 ? ' (Focus drill)' : '';
  return base + intensifier;
}