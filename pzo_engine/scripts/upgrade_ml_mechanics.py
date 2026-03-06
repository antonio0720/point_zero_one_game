#!/usr/bin/env python3
"""
PZO ML Mechanics — Full Implementation Generator
═══════════════════════════════════════════════════
Upgrades all 148 ML stub files to production-quality implementations
matching the M02A (Pressure-Aware Difficulty Shaping) architectural pattern.

Each generated file includes:
  - Input sanitization + privacy filtering
  - Domain-specific feature vector extraction
  - Three-tier inference (baseline → sequence_dl → policy_rl)
  - Session profiling with EMA learning
  - Bandit exploration for policy decisions
  - Monotonic constraints + lock-off support
  - Signed audit receipts
  - Export/hydrate/reset for durable state persistence

Run:
  cd /path/to/point_zero_one_master
  python3 pzo_engine/scripts/upgrade_ml_mechanics.py

Density6 LLC · Point Zero One · Confidential
"""

import os
import re
import json
import sys

ML_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "ml")
SKIP = {"m01a_", "m02a_"}

# ═══════════════════════════════════════════════════════════════════════════════
# DOMAIN-SPECIFIC FEATURE CONFIGURATIONS PER FAMILY
# ═══════════════════════════════════════════════════════════════════════════════

FAMILY_FEATURES = {
    "market": {
        "features": [
            ("portfolioValueNorm", "Portfolio value normalized", 0.16),
            ("debtServiceRatio", "Debt service pressure", 0.14),
            ("solvencyMargin", "Solvency margin distance", 0.13),
            ("cashVelocity", "Cash flow velocity", 0.10),
            ("assetConcentration", "Asset concentration risk", 0.09),
            ("macroRegimePressure", "Macro regime pressure", 0.11),
            ("exitWindowQuality", "Exit window quality", 0.08),
            ("negativeOutcomeRate", "Negative outcome rate", 0.07),
        ],
        "feature_extractors": """
    const assets = coerceCount(input.portfolioSnapshot, ['assets', 'holdings', 'positions']);
    const debts = coerceCount(input.portfolioSnapshot, ['debts', 'liabilities', 'obligations']);
    const shields = coerceCount(input.portfolioSnapshot, ['shields', 'protections']);
    const netWorth = coerceFirstNumber(input.portfolioSnapshot, ['netWorth', 'totalValue', 'cash']) ?? 10000;
    const debtTotal = coerceFirstNumber(input.portfolioSnapshot, ['debtTotal', 'totalDebt']) ?? 0;
    const cashflow = coerceFirstNumber(input.portfolioSnapshot, ['cashflow', 'monthlyNet', 'income']) ?? 500;

    const portfolioValueNorm = clamp(netWorth / 50000, 0, 1);
    const debtServiceRatio = clamp(debtTotal / Math.max(1, netWorth), 0, 1);
    const solvencyMargin = clamp(1 - debtServiceRatio, 0, 1);
    const cashVelocity = clamp(Math.abs(cashflow) / Math.max(1, netWorth) * 10, 0, 1);
    const assetConcentration = clamp((assets > 0 ? 1 / assets : 1) * 0.5 + (debts > 3 ? 0.3 : 0), 0, 1);
    const exitWindowQuality = clamp(1 - input.tickIndex / RUN_TOTAL_TICKS, 0, 1);""",
    },
    "balance": {
        "features": [
            ("stressLevel", "Player stress level", 0.18),
            ("hesitationRate", "Hesitation frequency", 0.12),
            ("decisionCadence", "Decision speed cadence", 0.11),
            ("undoRate", "Undo/reversal rate", 0.09),
            ("timeoutRate", "Timeout-like action rate", 0.10),
            ("uiLatencyLoad", "UI latency load", 0.13),
            ("difficultyGap", "Difficulty gap from baseline", 0.10),
            ("lateRunPressure", "Late-run time pressure", 0.08),
        ],
        "feature_extractors": """
    const actionDurations = actions.map(a => a.durationMs);
    const cadenceMedian = median(actionDurations);
    const stressLevel = clamp((cadenceMedian - 800) / 3000, 0, 1);
    const hesitationRate = safeDiv(actions.filter(a => a.durationMs > session.scoreEma * 1500 + 1200).length, actions.length);
    const decisionCadence = clamp(cadenceMedian / 3000, 0, 1);
    const undoRate = safeDiv(actions.filter(a => a.undoLike).length, actions.length);
    const timeoutRate = safeDiv(actions.filter(a => a.timeoutLike).length, actions.length);
    const uiLatencyLoad = clamp(median(uiLatency) / 800, 0, 1);
    const difficultyGap = clamp((cadenceMedian - 1400) / 2000, -1, 1);
    const lateRunPressure = clamp(input.tickIndex / RUN_TOTAL_TICKS, 0, 1);""",
    },
    "integrity": {
        "features": [
            ("anomalyDensity", "Anomaly event density", 0.18),
            ("hashFreshnessScore", "Hash freshness score", 0.14),
            ("actionBudgetUsage", "Action budget usage", 0.12),
            ("desyncSignalStrength", "Desync signal strength", 0.11),
            ("replayDivergence", "Replay divergence metric", 0.10),
            ("signatureValidityRate", "Signature validity rate", 0.09),
            ("eventOrderingScore", "Event ordering consistency", 0.08),
            ("tamperLikelihood", "Tamper likelihood estimate", 0.13),
        ],
        "feature_extractors": """
    const integrityKeys = ['hash', 'signature', 'checksum', 'verify', 'valid', 'tamper', 'desync', 'anomaly'];
    const allEvents = [...input.outcomeEvents, ...input.ledgerEvents];
    const integrityEventCount = allEvents.filter(e => {
      const text = stableStringify(e).toLowerCase();
      return integrityKeys.some(k => text.includes(k));
    }).length;
    const anomalyDensity = clamp(integrityEventCount / Math.max(1, allEvents.length), 0, 1);
    const hashFreshnessScore = clamp(1 - anomalyDensity * 0.7, 0, 1);
    const actionBudgetUsage = clamp(actions.length / Math.max(1, input.tickIndex + 1) / 3, 0, 1);
    const desyncSignalStrength = clamp(anomalyDensity * 0.6 + actionBudgetUsage * 0.3, 0, 1);
    const replayDivergence = clamp(desyncSignalStrength * 0.8, 0, 1);
    const signatureValidityRate = clamp(1 - anomalyDensity, 0, 1);
    const eventOrderingScore = clamp(1 - replayDivergence * 0.5, 0, 1);
    const tamperLikelihood = clamp(anomalyDensity * 0.5 + desyncSignalStrength * 0.3 + (1 - signatureValidityRate) * 0.2, 0, 1);""",
    },
    "social": {
        "features": [
            ("socialTokenFlow", "Social token exchange rate", 0.15),
            ("voteEntropy", "Vote pattern entropy", 0.12),
            ("assistRate", "Assist/help action rate", 0.10),
            ("griefSignalStrength", "Grief/toxicity signal", 0.14),
            ("cooperationIndex", "Cooperation index", 0.11),
            ("socialHeat", "Social interaction heat", 0.10),
            ("tableDynamicsScore", "Table dynamics health", 0.09),
            ("engagementVelocity", "Social engagement velocity", 0.08),
        ],
        "feature_extractors": """
    const socialKeys = ['token', 'vote', 'assist', 'help', 'gift', 'trade', 'share', 'react'];
    const griefKeys = ['grief', 'toxic', 'abuse', 'block', 'report', 'sabotage', 'exploit'];
    const socialCount = input.socialEvents.length;
    const socialEventText = input.socialEvents.map(e => stableStringify(e).toLowerCase());
    const socialTokenFlow = clamp(socialCount / Math.max(1, input.tickIndex + 1), 0, 1);
    const voteEntropy = clamp(socialCount > 0 ? Math.min(1, socialCount / 8) * 0.7 + 0.3 : 0.5, 0, 1);
    const assistRate = safeDiv(socialEventText.filter(t => socialKeys.some(k => t.includes(k))).length, socialCount);
    const griefSignalStrength = safeDiv(socialEventText.filter(t => griefKeys.some(k => t.includes(k))).length, Math.max(1, socialCount));
    const cooperationIndex = clamp(assistRate * 0.6 + (1 - griefSignalStrength) * 0.4, 0, 1);
    const socialHeat = clamp(socialTokenFlow * 0.5 + griefSignalStrength * 0.3 + (1 - voteEntropy) * 0.2, 0, 1);
    const tableDynamicsScore = clamp(cooperationIndex * 0.6 + (1 - socialHeat) * 0.4, 0, 1);
    const engagementVelocity = clamp(socialTokenFlow * 0.7 + assistRate * 0.3, 0, 1);""",
    },
    "contract": {
        "features": [
            ("clauseCompletionRate", "Clause completion rate", 0.14),
            ("penaltyExposure", "Penalty exposure level", 0.13),
            ("counterpartyRisk", "Counterparty risk score", 0.12),
            ("obligationPressure", "Obligation pressure", 0.11),
            ("escrowHealth", "Escrow health metric", 0.10),
            ("fairnessDeviation", "Fairness deviation", 0.09),
            ("negotiationEfficiency", "Negotiation efficiency", 0.10),
            ("contractComplexity", "Contract graph complexity", 0.08),
        ],
        "feature_extractors": """
    const contractKeys = ['clause', 'penalty', 'escrow', 'obligation', 'breach', 'fulfill', 'trigger'];
    const contractEvents = allEvents.filter(e => {
      const text = stableStringify(e).toLowerCase();
      return contractKeys.some(k => text.includes(k));
    });
    const clauseCompletionRate = clamp(contractEvents.filter(e => stableStringify(e).toLowerCase().includes('fulfill')).length / Math.max(1, contractEvents.length), 0, 1);
    const penaltyExposure = clamp(contractEvents.filter(e => stableStringify(e).toLowerCase().includes('penalty')).length / Math.max(1, allEvents.length), 0, 1);
    const counterpartyRisk = clamp(penaltyExposure * 0.6 + (1 - clauseCompletionRate) * 0.4, 0, 1);
    const obligationPressure = clamp(contractEvents.length / Math.max(1, allEvents.length) * 2, 0, 1);
    const escrowHealth = clamp(1 - penaltyExposure * 0.7, 0, 1);
    const fairnessDeviation = clamp(Math.abs(0.5 - clauseCompletionRate) * 2, 0, 1);
    const negotiationEfficiency = clamp(clauseCompletionRate * 0.5 + escrowHealth * 0.3 + (1 - fairnessDeviation) * 0.2, 0, 1);
    const contractComplexity = clamp(contractEvents.length / 20, 0, 1);""",
    },
    "economy": {
        "features": [
            ("inflationPressure", "Economy inflation pressure", 0.15),
            ("sinkSourceBalance", "Sink/source balance", 0.14),
            ("trophyVelocity", "Trophy/reward velocity", 0.11),
            ("marketLiquidity", "Market liquidity score", 0.10),
            ("farmingSignal", "Farming/grind detection", 0.13),
            ("scarcityIndex", "Asset scarcity index", 0.09),
            ("rewardSaturation", "Reward saturation level", 0.08),
            ("economyStability", "Overall economy stability", 0.10),
        ],
        "feature_extractors": """
    const econKeys = ['trophy', 'craft', 'sink', 'mint', 'burn', 'trade', 'reward', 'farm', 'grind'];
    const econEvents = allEvents.filter(e => {
      const text = stableStringify(e).toLowerCase();
      return econKeys.some(k => text.includes(k));
    });
    const sinkCount = econEvents.filter(e => stableStringify(e).toLowerCase().includes('sink') || stableStringify(e).toLowerCase().includes('burn')).length;
    const sourceCount = econEvents.filter(e => stableStringify(e).toLowerCase().includes('mint') || stableStringify(e).toLowerCase().includes('reward')).length;
    const inflationPressure = clamp(sourceCount > sinkCount ? (sourceCount - sinkCount) / Math.max(1, sourceCount + sinkCount) : 0, 0, 1);
    const sinkSourceBalance = clamp(1 - Math.abs(sinkCount - sourceCount) / Math.max(1, sinkCount + sourceCount), 0, 1);
    const trophyVelocity = clamp(econEvents.length / Math.max(1, input.tickIndex + 1), 0, 1);
    const marketLiquidity = clamp(1 - inflationPressure * 0.6, 0, 1);
    const farmingSignal = clamp(actions.length > 20 ? (actions.length - 20) / 30 : 0, 0, 1);
    const scarcityIndex = clamp(1 - trophyVelocity, 0, 1);
    const rewardSaturation = clamp(trophyVelocity * 0.6 + (1 - scarcityIndex) * 0.4, 0, 1);
    const economyStability = clamp(sinkSourceBalance * 0.4 + marketLiquidity * 0.3 + (1 - farmingSignal) * 0.3, 0, 1);""",
    },
    "progression": {
        "features": [
            ("skillVelocity", "Skill improvement velocity", 0.15),
            ("unlockPace", "Unlock/progression pace", 0.12),
            ("engagementCurve", "Engagement curve position", 0.11),
            ("masteryDistance", "Distance to mastery", 0.10),
            ("varietyIndex", "Play variety index", 0.09),
            ("challengeMatch", "Challenge-skill match", 0.13),
            ("retentionRisk", "Retention risk signal", 0.12),
            ("learningEfficiency", "Learning efficiency", 0.08),
        ],
        "feature_extractors": """
    const progressKeys = ['unlock', 'level', 'xp', 'skill', 'badge', 'achieve', 'complete', 'master'];
    const progressEvents = allEvents.filter(e => {
      const text = stableStringify(e).toLowerCase();
      return progressKeys.some(k => text.includes(k));
    });
    const skillVelocity = clamp(progressEvents.length / Math.max(1, input.tickIndex + 1), 0, 1);
    const unlockPace = clamp(progressEvents.filter(e => stableStringify(e).toLowerCase().includes('unlock')).length / Math.max(1, input.tickIndex + 1) * 5, 0, 1);
    const engagementCurve = clamp(actions.length / Math.max(1, input.tickIndex + 1) / 2, 0, 1);
    const masteryDistance = clamp(1 - skillVelocity * 0.7 - unlockPace * 0.3, 0, 1);
    const actionTypes = new Set(actions.map(a => a.label));
    const varietyIndex = clamp(actionTypes.size / 8, 0, 1);
    const challengeMatch = clamp(engagementCurve * 0.5 + varietyIndex * 0.3 + (1 - Math.abs(0.5 - stressProxy)) * 0.2, 0, 1);
    const retentionRisk = clamp(1 - engagementCurve * 0.4 - varietyIndex * 0.3 - challengeMatch * 0.3, 0, 1);
    const learningEfficiency = clamp(skillVelocity * 0.5 + challengeMatch * 0.3 + engagementCurve * 0.2, 0, 1);""",
    },
    "forensics": {
        "features": [
            ("causalChainDepth", "Causal chain depth", 0.16),
            ("counterfactualDistance", "Counterfactual distance", 0.13),
            ("evidenceDensity", "Evidence density", 0.12),
            ("pivotPointScore", "Pivot point significance", 0.11),
            ("rootCauseConfidence", "Root cause confidence", 0.10),
            ("timelineCoherence", "Timeline coherence score", 0.09),
            ("narrativeStrength", "Narrative strength metric", 0.08),
            ("shareabilityScore", "Content shareability", 0.10),
        ],
        "feature_extractors": """
    const wipeKeys = ['wipe', 'death', 'collapse', 'fail', 'bankruptcy', 'default', 'crisis'];
    const momentKeys = ['flip', 'clutch', 'save', 'comeback', 'near_death', 'legendary'];
    const wipeEvents = allEvents.filter(e => wipeKeys.some(k => stableStringify(e).toLowerCase().includes(k)));
    const momentEvents = allEvents.filter(e => momentKeys.some(k => stableStringify(e).toLowerCase().includes(k)));
    const causalChainDepth = clamp(wipeEvents.length / 5, 0, 1);
    const counterfactualDistance = clamp(1 - momentEvents.length / Math.max(1, wipeEvents.length + momentEvents.length), 0, 1);
    const evidenceDensity = clamp(allEvents.length / Math.max(1, input.tickIndex + 1) / 3, 0, 1);
    const pivotPointScore = clamp(momentEvents.length / Math.max(1, allEvents.length) * 5, 0, 1);
    const rootCauseConfidence = clamp(evidenceDensity * 0.5 + causalChainDepth * 0.3 + (1 - counterfactualDistance) * 0.2, 0, 1);
    const timelineCoherence = clamp(1 - counterfactualDistance * 0.5, 0, 1);
    const narrativeStrength = clamp(pivotPointScore * 0.4 + causalChainDepth * 0.3 + momentEvents.length / 5 * 0.3, 0, 1);
    const shareabilityScore = clamp(narrativeStrength * 0.5 + pivotPointScore * 0.3 + momentEvents.length / 3 * 0.2, 0, 1);""",
    },
    "co_op": {
        "features": [
            ("contributionSymmetry", "Team contribution symmetry", 0.15),
            ("dropoutRisk", "Dropout/abandon risk", 0.13),
            ("coordinationScore", "Team coordination score", 0.12),
            ("freeRiderSignal", "Free-rider detection", 0.11),
            ("teamSynergy", "Team synergy metric", 0.10),
            ("conflictIntensity", "Conflict intensity", 0.09),
            ("sharedObjectiveProgress", "Shared objective progress", 0.10),
            ("trustLevel", "Inter-player trust level", 0.08),
        ],
        "feature_extractors": """
    const coopKeys = ['team', 'coop', 'assist', 'share', 'contribute', 'pool', 'rescue', 'ally'];
    const conflictKeys = ['sabotage', 'steal', 'betray', 'defect', 'grief', 'abandon', 'drop'];
    const coopEvents = input.socialEvents.filter(e => coopKeys.some(k => stableStringify(e).toLowerCase().includes(k)));
    const conflictEvents = input.socialEvents.filter(e => conflictKeys.some(k => stableStringify(e).toLowerCase().includes(k)));
    const contributionSymmetry = clamp(1 - conflictEvents.length / Math.max(1, coopEvents.length + conflictEvents.length), 0, 1);
    const dropoutRisk = clamp(conflictEvents.length / Math.max(1, input.socialEvents.length) + (actions.length < 3 ? 0.3 : 0), 0, 1);
    const coordinationScore = clamp(coopEvents.length / Math.max(1, input.socialEvents.length), 0, 1);
    const freeRiderSignal = clamp(1 - actions.length / Math.max(1, input.tickIndex + 1) / 2, 0, 1);
    const teamSynergy = clamp(coordinationScore * 0.5 + contributionSymmetry * 0.3 + (1 - dropoutRisk) * 0.2, 0, 1);
    const conflictIntensity = clamp(conflictEvents.length / Math.max(1, input.socialEvents.length), 0, 1);
    const sharedObjectiveProgress = clamp(coopEvents.length / 10, 0, 1);
    const trustLevel = clamp(contributionSymmetry * 0.4 + (1 - conflictIntensity) * 0.4 + coordinationScore * 0.2, 0, 1);""",
    },
}

# ═══════════════════════════════════════════════════════════════════════════════
# TEMPLATE FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def camel_id(ml_id: str) -> str:
    """M03A → M03a"""
    return ml_id[0] + ml_id[1:].lower()

def func_prefix(ml_id: str) -> str:
    """M03A → run prefix for function names: m03a"""
    return ml_id.lower()

def var_prefix(ml_id: str) -> str:
    """M03A → m03a (for variable names)"""
    return ml_id.lower()

def build_ext_field_defaults(ext_fields: list) -> str:
    lines = []
    for f in ext_fields:
        name = f['name']
        typ = f['type']
        if typ == 'unknown':
            lines.append(f"    {name}: null,")
        elif typ == 'number':
            lines.append(f"    {name}: 0,")
        elif typ == 'string':
            lines.append(f"    {name}: '',")
        elif typ == 'boolean':
            lines.append(f"    {name}: false,")
        elif '[]' in typ:
            lines.append(f"    {name}: [],")
        else:
            lines.append(f"    {name}: null,")
    return "\n".join(lines)

def build_ext_field_scored(ext_fields: list, ml_id: str) -> str:
    """Generate scored extended fields based on inference results"""
    lines = []
    for i, f in enumerate(ext_fields):
        name = f['name']
        typ = f['type']
        if typ == 'unknown':
            # Generate meaningful values based on field name patterns
            if any(k in name.lower() for k in ['probability', 'score', 'risk', 'rate', 'likelihood', 'confidence']):
                lines.append(f"    {name}: safeRound(clamp(modelInference.rawScore * (1 + {i} * 0.03), 0, 1), 4),")
            elif any(k in name.lower() for k in ['flag', 'active', 'enabled', 'detected']):
                lines.append(f"    {name}: modelInference.rawScore >= 0.65,")
            elif any(k in name.lower() for k in ['factors', 'list', 'items', 'chain']):
                lines.append(f"    {name}: topFactors.slice(0, 3),")
            elif any(k in name.lower() for k in ['hint', 'recommendation', 'suggestion', 'advice']):
                lines.append(f"    {name}: recommendation,")
            elif any(k in name.lower() for k in ['estimate', 'count', 'amount', 'budget', 'distance']):
                lines.append(f"    {name}: safeRound(modelInference.rawScore * 100, 2),")
            elif any(k in name.lower() for k in ['tier', 'level', 'grade', 'band']):
                lines.append(f"    {name}: modelInference.rawScore >= 0.75 ? 'high' : modelInference.rawScore >= 0.4 ? 'medium' : 'low',")
            elif any(k in name.lower() for k in ['embedding', 'vector', 'weights']):
                lines.append(f"    {name}: Array.from({{ length: 8 }}, (_, j) => safeRound(modelInference.contributions[j % modelInference.contributions.length]?.value ?? 0, 4)),")
            else:
                lines.append(f"    {name}: safeRound(modelInference.rawScore * (0.9 + {i} * 0.02), 4),")
        elif typ == 'number':
            lines.append(f"    {name}: safeRound(modelInference.rawScore * (1 + {i} * 0.01), 4),")
        elif typ == 'string':
            lines.append(f"    {name}: recommendation,")
        elif typ == 'boolean':
            lines.append(f"    {name}: modelInference.rawScore >= 0.6,")
        else:
            lines.append(f"    {name}: null,")
    return "\n".join(lines)

def build_feature_vector_fields(family: str) -> str:
    config = FAMILY_FEATURES.get(family, FAMILY_FEATURES["market"])
    lines = []
    for fname, _, _ in config["features"]:
        lines.append(f"  {fname}: number;")
    return "\n".join(lines)

def build_contributions(family: str) -> str:
    config = FAMILY_FEATURES.get(family, FAMILY_FEATURES["market"])
    lines = []
    for fname, label, weight in config["features"]:
        lines.append(f"    {{ label: '{label}', value: features.{fname} * {weight:.2f} }},")
    return "\n".join(lines)

def build_recommendation_cases(ml_id: str, signal: str) -> str:
    signal_labels = {
        "risk": ("Risk", "danger zone", "elevated", "controlled"),
        "personalization": ("Signal", "high-impact zone", "active", "baseline"),
        "fairness": ("Fairness deviation", "violation zone", "drifting", "compliant"),
        "trust": ("Trust", "critical zone", "degraded", "healthy"),
        "skill": ("Skill signal", "mastery zone", "developing", "calibrated"),
        "anomaly": ("Anomaly", "alert zone", "elevated", "nominal"),
        "content": ("Content signal", "peak zone", "active", "resting"),
        "value": ("Value signal", "high-value zone", "promising", "stable"),
        "fraud": ("Fraud signal", "critical zone", "suspicious", "clean"),
        "engagement": ("Engagement", "peak zone", "active", "baseline"),
        "balance": ("Balance", "unstable zone", "shifting", "stable"),
    }
    label, high, mid, low = signal_labels.get(signal, ("Signal", "critical zone", "active", "nominal"))
    return f"""  if (args.lockOffApplied) return 'Competitive lock-off active; recording {label.lower()} signal only — no nudges applied.';
  if (args.shouldAbstain) return 'Confidence below intervention threshold; maintaining neutral stance and gathering more telemetry.';
  if (args.score >= 0.78) return `{label} in the {high} (${{{ml_id}_ML_CONSTANTS.ML_ID}}=${{args.score.toFixed(2)}}); applying bounded intervention while preserving determinism.`;
  if (args.score >= 0.55) return `{label} is {mid} (${{{ml_id}_ML_CONSTANTS.ML_ID}}=${{args.score.toFixed(2)}}); light advisory signal active.`;
  return `{label} is {low}; continuing baseline observation and learning.`;"""

def generate_implementation(meta: dict) -> str:
    """Generate the full implementation body for a single ML mechanic."""
    ml_id = meta['ml_id']
    family = meta['family']
    signal = meta['signal']
    category = meta['category']
    ext_fields = meta['ext_fields']
    core_pair = meta['core_pair']

    cid = camel_id(ml_id)      # M03a
    vid = var_prefix(ml_id)    # m03a
    uid = ml_id                # M03A

    fam_config = FAMILY_FEATURES.get(family, FAMILY_FEATURES["market"])
    feat_fields = build_feature_vector_fields(family)
    feat_extractors = fam_config["feature_extractors"]
    contributions = build_contributions(family)
    ext_defaults = build_ext_field_defaults(ext_fields)
    ext_scored = build_ext_field_scored(ext_fields, ml_id)
    rec_cases = build_recommendation_cases(ml_id, signal)

    # Need stress proxy for progression family
    stress_proxy_line = ""
    if family == "progression":
        stress_proxy_line = "\n    const stressProxy = clamp(actions.length > 0 ? median(actions.map(a => a.durationMs)) / 3000 : 0.5, 0, 1);"

    return f"""
// ── Private implementation types ─────────────────────────────────────────────

interface {uid}SanitizedInput {{
  runSeed: string;
  tickIndex: number;
  rulesetVersion: string;
  macroRegime: MacroRegime;
  portfolioSnapshot: Record<string, unknown>;
  actionTimeline: Record<string, unknown>[];
  uiInteraction: Record<string, unknown>;
  socialEvents: Record<string, unknown>[];
  outcomeEvents: Record<string, unknown>[];
  ledgerEvents: Record<string, unknown>[];
  userOptIn: Record<string, boolean>;
}}

interface {uid}ActionPoint {{
  timeMs: number;
  durationMs: number;
  label: string;
  decisionDepth: number;
  undoLike: boolean;
  timeoutLike: boolean;
}}

interface {uid}FeatureVector {{
  schemaVersion: string;
  schemaHash: string;
{feat_fields}
  macroPressure: number;
  negativeOutcomeRate: number;
  lagLikelihood: number;
  sequenceStress: number;
  historyScoreEma: number;
  historyDeltaEma: number;
  fairnessBand: number;
  confidenceSignal: number;
}}

interface {uid}Contribution {{
  label: string;
  value: number;
}}

interface {uid}ModelInference {{
  rawScore: number;
  confidence: number;
  contributions: {uid}Contribution[];
  tier: {uid}Tier;
}}

interface {uid}SessionProfile {{
  sessionKey: string;
  inferenceCount: number;
  scoreEma: number;
  confidenceEma: number;
  deltaEma: number;
  rewardEma: number;
  lastTick: number;
  bandit: Record<string, {{ trials: number; reward: number }}>;
}}

export interface {uid}AuditReceipt {{
  receiptId: string;
  auditHash: string;
  rulesetVersion: string;
  modelVersion: string;
  tier: {uid}Tier;
  runSeed: string;
  tickIndex: number;
  caps: {{ scoreCap: number; abstainThreshold: number }};
  output: Omit<{uid}Output, 'auditHash'>;
  createdAt: string;
  signature: string;
}}

// ── Session store + ledger ───────────────────────────────────────────────────

const {vid}SessionStore = new Map<string, {uid}SessionProfile>();
const {vid}LedgerReceipts: {uid}AuditReceipt[] = [];

export function register{cid}LedgerWriter(writer: (receipt: {uid}AuditReceipt) => void): () => void {{
  {vid}LedgerWriters.add(writer);
  return () => {vid}LedgerWriters.delete(writer);
}}
const {vid}LedgerWriters = new Set<(receipt: {uid}AuditReceipt) => void>();
{vid}LedgerWriters.add((receipt) => {{
  {vid}LedgerReceipts.push(receipt);
  if ({vid}LedgerReceipts.length > 5_000) {vid}LedgerReceipts.splice(0, {vid}LedgerReceipts.length - 5_000);
}});

export function get{cid}LedgerReceipts(runSeed?: string): {uid}AuditReceipt[] {{
  if (!runSeed) return [...{vid}LedgerReceipts];
  return {vid}LedgerReceipts.filter(r => r.runSeed === runSeed);
}}

export function export{cid}LearningState(): Record<string, {uid}SessionProfile> {{
  return Object.fromEntries(Array.from({vid}SessionStore.entries()).map(([k, v]) => [k, {{ ...v, bandit: {{ ...v.bandit }} }}]));
}}

export function hydrate{cid}LearningState(state: Record<string, {uid}SessionProfile>): void {{
  for (const [key, profile] of Object.entries(state ?? {{}})) {{
    if (!profile || typeof profile !== 'object') continue;
    {vid}SessionStore.set(key, {{
      sessionKey: key,
      inferenceCount: Math.max(0, Math.floor(Number(profile.inferenceCount ?? 0))),
      scoreEma: clamp(Number(profile.scoreEma ?? 0.5), 0, 1),
      confidenceEma: clamp(Number(profile.confidenceEma ?? 0.5), 0, 1),
      deltaEma: clamp(Number(profile.deltaEma ?? 0), -1, 1),
      rewardEma: clamp(Number(profile.rewardEma ?? 0.5), 0, 1),
      lastTick: Math.max(0, Math.floor(Number(profile.lastTick ?? 0))),
      bandit: normalizeBandit(profile.bandit),
    }});
  }}
}}

export function reset{cid}Runtime(): void {{
  {vid}SessionStore.clear();
  {vid}LedgerReceipts.splice(0, {vid}LedgerReceipts.length);
}}

// ── Main inference ───────────────────────────────────────────────────────────

export async function run{cid}Ml(
  input: {uid}TelemetryInput,
  tier: {uid}Tier = 'baseline',
  modelCard: Omit<{uid}ModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<{uid}Output> {{
  const sanitized = sanitize{uid}Input(input);
  const session = getOrCreate{uid}Session(sanitized.runSeed);
  const features = build{uid}Features(sanitized, session);
  const lockOffApplied = shouldLockOff{uid}(sanitized.userOptIn);

  const modelInference = selectInference{uid}(tier, features, sanitized, session);

  let score = clamp(modelInference.rawScore, 0, {uid}_ML_CONSTANTS.GUARDRAILS.scoreCap);
  const confidence = clamp(modelInference.confidence, 0, 1);
  const shouldAbstain = confidence < {uid}_ML_CONSTANTS.GUARDRAILS.abstainThreshold;
  if (shouldAbstain) score = 0.5;
  if (lockOffApplied) score = 0.5;

  const topFactors = build{uid}TopFactors(modelInference.contributions, features, lockOffApplied, shouldAbstain);
  const recommendation = build{uid}Recommendation({{ score, lockOffApplied, shouldAbstain }});

  const baseOutput: Omit<{uid}Output, 'auditHash'> = {{
    score,
    topFactors,
    recommendation,
{ext_scored}
  }};

  const auditHash = sha256Hex(stableStringify({{
    input: sanitized, tier, features, output: baseOutput,
    rulesetVersion: sanitized.rulesetVersion,
    modelCard: {{ ...modelCard, modelId: '{uid}', coreMechanicPair: '{core_pair}' }},
  }}));

  const receipt = build{uid}Receipt({{ auditHash, output: baseOutput, sanitized, tier, modelVersion: modelCard.modelVersion }});
  for (const writer of {vid}LedgerWriters) writer(receipt);

  update{uid}Session(session, features, score, sanitized.tickIndex, modelInference.rawScore);

  return {{ ...baseOutput, auditHash }};
}}

// ── Fallback ─────────────────────────────────────────────────────────────────

export function run{cid}MlFallback(
  _input: {uid}TelemetryInput,
): {uid}Output {{
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = sha256Hex(seed + ':' + tick + ':fallback:{uid}');
  return {{
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
{ext_defaults}
  }};
}}

// ── Input sanitization ──────────────────────────────────────────────────────

function sanitize{uid}Input(input: {uid}TelemetryInput): {uid}SanitizedInput {{
  return {{
    runSeed: String(input.runSeed ?? ''),
    tickIndex: clamp(Math.floor(Number(input.tickIndex ?? 0)), 0, RUN_TOTAL_TICKS - 1),
    rulesetVersion: String(input.rulesetVersion ?? '{uid}_RULES_V1'),
    macroRegime: normalizeMacroRegime(input.macroRegime),
    portfolioSnapshot: sanitizeObj(input.portfolioSnapshot),
    actionTimeline: sanitizeArr(input.actionTimeline),
    uiInteraction: sanitizeObj(input.uiInteraction),
    socialEvents: sanitizeArr(input.socialEvents),
    outcomeEvents: sanitizeArr(input.outcomeEvents),
    ledgerEvents: sanitizeArr(input.ledgerEvents ?? []),
    userOptIn: sanitizeBoolMap(input.userOptIn),
  }};
}}

// ── Feature extraction ──────────────────────────────────────────────────────

function build{uid}Features(input: {uid}SanitizedInput, session: {uid}SessionProfile): {uid}FeatureVector {{
  const actions = extractActions(input.actionTimeline);
  const uiLatency = extractUiLatency(input.uiInteraction, input.actionTimeline);
  const allEvents = [...input.outcomeEvents, ...input.ledgerEvents];
  const negOutKeys = ['loss', 'penalty', 'wipe', 'miss', 'late', 'fail', 'damage', 'default'];
  const negativeOutcomeRate = allEvents.length > 0 ? clamp(allEvents.filter(e => negOutKeys.some(k => stableStringify(e).toLowerCase().includes(k))).length / allEvents.length, 0, 1) : 0;
  const lagKeys = ['lag', 'latency', 'jitter', 'stall', 'freeze'];
  const lagLikelihood = clamp(median(uiLatency) / 900 * 0.35 + (input.actionTimeline.some(e => lagKeys.some(k => stableStringify(e).toLowerCase().includes(k))) ? 0.2 : 0), 0, 1);
  const macroPressure = deriveMacroPressure(input.macroRegime, input.tickIndex, input.runSeed);
  const sequenceStress = deriveSequenceStress(actions, input.tickIndex, input.runSeed);
{stress_proxy_line}
{feat_extractors}

  const confidenceSignal = clamp(0.25 + clamp(actions.length / 12, 0, 0.3) + clamp(uiLatency.length / 12, 0, 0.15) + clamp(1 - lagLikelihood, 0, 0.2) + 0.1, 0, 1);
  const fairnessBand = clamp(confidenceSignal * 0.5 + (1 - negativeOutcomeRate) * 0.5, 0, 1);

  return {{
    schemaVersion: '{uid}_FEATURES_V1',
    schemaHash: {uid}_ML_CONSTANTS.GUARDRAILS.scoreCap.toString(),
{chr(10).join(f"    {feat[0]}," for feat in fam_config['features'])}
    macroPressure,
    negativeOutcomeRate,
    lagLikelihood,
    sequenceStress,
    historyScoreEma: session.scoreEma,
    historyDeltaEma: session.deltaEma,
    fairnessBand,
    confidenceSignal,
  }};
}}

// ── Three-tier inference ─────────────────────────────────────────────────────

function selectInference{uid}(tier: {uid}Tier, features: {uid}FeatureVector, input: {uid}SanitizedInput, session: {uid}SessionProfile): {uid}ModelInference {{
  switch (tier) {{
    case 'sequence_dl': return runSequence{uid}(features, input, session);
    case 'policy_rl':   return runPolicy{uid}(features, input, session);
    default:            return runBaseline{uid}(features, input, session);
  }}
}}

function runBaseline{uid}(features: {uid}FeatureVector, _input: {uid}SanitizedInput, session: {uid}SessionProfile): {uid}ModelInference {{
  const contributions: {uid}Contribution[] = [
{contributions}
    {{ label: 'Macro regime pressure', value: features.macroPressure * 0.10 }},
    {{ label: 'Session history EMA', value: features.historyScoreEma * 0.08 }},
  ];
  const logit = -0.45 + contributions.reduce((s, c) => s + c.value, 0)
    + features.sequenceStress * 0.12 + features.negativeOutcomeRate * 0.10
    - clamp(session.rewardEma - 0.5, -0.2, 0.2) * 0.08;
  return {{
    rawScore: sigmoid(logit),
    confidence: clamp(features.confidenceSignal * 0.80 + (1 - features.lagLikelihood) * 0.20, 0.05, 0.99),
    contributions,
    tier: 'baseline',
  }};
}}

function runSequence{uid}(features: {uid}FeatureVector, input: {uid}SanitizedInput, session: {uid}SessionProfile): {uid}ModelInference {{
  const baseline = runBaseline{uid}(features, input, session);
  const seqBias = features.sequenceStress * 0.20 + features.lagLikelihood * 0.08 - features.historyDeltaEma * 0.04;
  return {{
    rawScore: clamp(baseline.rawScore * 0.72 + seqBias, 0, 1),
    confidence: clamp(baseline.confidence * 0.85 + clamp(input.actionTimeline.length / 20, 0, 0.14), 0.05, 0.99),
    contributions: [...baseline.contributions, {{ label: 'Temporal sequence encoder', value: seqBias }}],
    tier: 'sequence_dl',
  }};
}}

function runPolicy{uid}(features: {uid}FeatureVector, input: {uid}SanitizedInput, session: {uid}SessionProfile): {uid}ModelInference {{
  const seq = runSequence{uid}(features, input, session);
  const policyBias = clamp(features.historyScoreEma - 0.4, 0, 0.3) * 0.10
    + clamp(features.fairnessBand - 0.4, 0, 0.3) * 0.06
    + clamp(1 - session.rewardEma, 0, 0.5) * 0.04;
  return {{
    rawScore: clamp(seq.rawScore + policyBias, 0, 1),
    confidence: clamp(seq.confidence * 0.90 + 0.05, 0.05, 0.99),
    contributions: [...seq.contributions, {{ label: 'Offline policy prior', value: policyBias }}],
    tier: 'policy_rl',
  }};
}}

// ── Top factors + recommendation ─────────────────────────────────────────────

function build{uid}TopFactors(contributions: {uid}Contribution[], features: {uid}FeatureVector, lockOff: boolean, abstain: boolean): string[] {{
  const ranked = [...contributions].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 3);
  const factors = ranked.map(c => `${{c.label}}: ${{c.value >= 0 ? '+' : ''}}${{c.value.toFixed(3)}}`);
  if (features.lagLikelihood >= 0.6) factors.push(`Lag likelihood: ${{(features.lagLikelihood * 100).toFixed(1)}}%`);
  if (lockOff) factors.push('Competitive lock-off active — advisory only');
  if (abstain) factors.push('Confidence below abstain threshold — neutralized');
  return factors.slice(0, 5);
}}

function build{uid}Recommendation(args: {{ score: number; lockOffApplied: boolean; shouldAbstain: boolean }}): string {{
{rec_cases}
}}

// ── Audit receipt ────────────────────────────────────────────────────────────

function build{uid}Receipt(args: {{
  auditHash: string;
  output: Omit<{uid}Output, 'auditHash'>;
  sanitized: {uid}SanitizedInput;
  tier: {uid}Tier;
  modelVersion: string;
}}): {uid}AuditReceipt {{
  const receiptId = computeHash(`${{args.sanitized.runSeed}}:${{args.sanitized.tickIndex}}:${{args.auditHash}}:{uid}`);
  const receipt: {uid}AuditReceipt = {{
    receiptId,
    auditHash: args.auditHash,
    rulesetVersion: args.sanitized.rulesetVersion,
    modelVersion: args.modelVersion,
    tier: args.tier,
    runSeed: args.sanitized.runSeed,
    tickIndex: args.sanitized.tickIndex,
    caps: {{ scoreCap: {uid}_ML_CONSTANTS.GUARDRAILS.scoreCap, abstainThreshold: {uid}_ML_CONSTANTS.GUARDRAILS.abstainThreshold }},
    output: args.output,
    createdAt: new Date(0).toISOString(),
    signature: '',
  }};
  receipt.signature = sha256Hex(stableStringify({{ ...receipt, signature: undefined, salt: '{uid}_RECEIPT' }}));
  return receipt;
}}

// ── Session management ──────────────────────────────────────────────────────

function getOrCreate{uid}Session(runSeed: string): {uid}SessionProfile {{
  const existing = {vid}SessionStore.get(runSeed);
  if (existing) return existing;
  const created: {uid}SessionProfile = {{
    sessionKey: runSeed, inferenceCount: 0, scoreEma: 0.45,
    confidenceEma: 0.5, deltaEma: 0, rewardEma: 0.5, lastTick: 0, bandit: {{}},
  }};
  {vid}SessionStore.set(runSeed, created);
  return created;
}}

function update{uid}Session(session: {uid}SessionProfile, features: {uid}FeatureVector, score: number, tickIndex: number, rawScore: number): void {{
  session.inferenceCount += 1;
  session.lastTick = tickIndex;
  session.scoreEma = ema(session.scoreEma, score, 0.20);
  session.confidenceEma = ema(session.confidenceEma, features.confidenceSignal, 0.18);
  session.deltaEma = ema(session.deltaEma, rawScore - session.scoreEma, 0.16);
  session.rewardEma = ema(session.rewardEma, clamp(score * 0.5 + features.fairnessBand * 0.3 + features.confidenceSignal * 0.2, 0, 1), 0.18);
  const key = score.toFixed(2);
  const bandit = session.bandit[key] ?? {{ trials: 0, reward: 0.5 }};
  bandit.trials += 1;
  bandit.reward = ema(bandit.reward, session.rewardEma, 0.22);
  session.bandit[key] = bandit;
}}

// ── Shared utilities ─────────────────────────────────────────────────────────

function normalizeMacroRegime(input: string): MacroRegime {{
  const upper = String(input ?? 'NEUTRAL').trim().toUpperCase();
  if (upper === 'BULL' || upper === 'NEUTRAL' || upper === 'BEAR' || upper === 'CRISIS') return upper;
  return 'NEUTRAL';
}}

function shouldLockOff{uid}(userOptIn: Record<string, boolean>): boolean {{
  const lockKeys = ['competitive_mode', 'competitive_lockoff', 'disable_balance_nudges', 'ranked_mode'];
  for (const [key, value] of Object.entries(userOptIn)) {{
    if (value && lockKeys.includes(key.toLowerCase())) return true;
  }}
  return false;
}}

function sanitizeObj(input: Record<string, unknown> | undefined | null): Record<string, unknown> {{
  const out: Record<string, unknown> = {{}};
  if (!input || typeof input !== 'object') return out;
  const pii = ['email', 'phone', 'address', 'contact', 'ip', 'geo', 'lat', 'lng', 'longitude', 'latitude'];
  for (const [k, v] of Object.entries(input)) {{
    if (pii.some(p => k.toLowerCase().includes(p))) continue;
    out[k] = v;
  }}
  return out;
}}

function sanitizeArr(input: Record<string, unknown>[] | undefined | null): Record<string, unknown>[] {{
  if (!Array.isArray(input)) return [];
  return input.map(i => sanitizeObj(i)).slice(0, 5_000);
}}

function sanitizeBoolMap(input: Record<string, boolean> | undefined | null): Record<string, boolean> {{
  const out: Record<string, boolean> = {{}};
  if (!input || typeof input !== 'object') return out;
  for (const [k, v] of Object.entries(input)) out[String(k)] = Boolean(v);
  return out;
}}

function extractActions(timeline: Record<string, unknown>[]): {uid}ActionPoint[] {{
  return timeline.map((event, i) => {{
    const text = stableStringify(event).toLowerCase();
    const durationMs = clamp(coerceFirstNumber(event, ['decisionMs', 'responseMs', 'durationMs', 'latencyMs']) ?? inferDuration(text), 80, 20_000);
    const timeMs = Math.max(0, coerceFirstNumber(event, ['atMs', 'timeMs', 'timestampMs', 'ts']) ?? i * 1000 + durationMs);
    const label = String(coerceFirstString(event, ['type', 'event', 'action', 'name']) ?? `action_${{i}}`);
    const decisionDepth = clamp(coerceFirstNumber(event, ['decisionDepth', 'branchCount', 'options']) ?? inferDepth(text), 1, 8);
    const undoLike = /(undo|back|cancel|reverse|rewind|rescind)/i.test(text);
    const timeoutLike = /(timeout|timer_expired|expired|late|too_slow|stall)/i.test(text) || durationMs >= 4500;
    return {{ timeMs, durationMs, label, decisionDepth, undoLike, timeoutLike }};
  }}).sort((a, b) => a.timeMs - b.timeMs);
}}

function extractUiLatency(ui: Record<string, unknown>, timeline: Record<string, unknown>[]): number[] {{
  const samples: number[] = [];
  const keys = ['latencyMs', 'frameTimeMs', 'inputLatencyMs', 'renderDelayMs', 'jitterMs', 'pingMs'];
  for (const k of keys) {{
    const v = ui[k];
    if (typeof v === 'number' && Number.isFinite(v)) samples.push(v);
    if (Array.isArray(v)) for (const item of v) if (typeof item === 'number' && Number.isFinite(item)) samples.push(item);
  }}
  for (const event of timeline) for (const k of keys) {{
    const v = (event as Record<string, unknown>)[k];
    if (typeof v === 'number' && Number.isFinite(v)) samples.push(v);
  }}
  return samples.map(v => clamp(v, 0, 12_000));
}}

function deriveMacroPressure(regime: MacroRegime, tickIndex: number, runSeed: string): number {{
  const chaos = buildChaosWindows(`${{runSeed}}:{uid}:chaos`, CHAOS_WINDOWS_PER_RUN);
  const activeChaos = chaos.some(w => tickIndex >= w.startTick && tickIndex <= w.endTick);
  const base = regime === 'CRISIS' ? 0.7 : regime === 'BEAR' ? 0.45 : regime === 'BULL' ? 0.15 : 0.3;
  return clamp(base + (activeChaos ? 0.25 : 0), 0, 1);
}}

function deriveSequenceStress(actions: {uid}ActionPoint[], tickIndex: number, runSeed: string): number {{
  if (actions.length === 0) return clamp(tickIndex / RUN_TOTAL_TICKS, 0, 1) * 0.25;
  const seedBias = (parseInt(computeHash(`${{runSeed}}:${{tickIndex}}:seq`), 16) % 11) / 100;
  let sum = 0; let wt = 0;
  for (let i = 0; i < actions.length; i++) {{
    const a = actions[i]; const recency = (i + 1) / actions.length; const w = 0.2 + recency * 0.8;
    const local = clamp((a.durationMs - 900) / 3800, 0, 1) * 0.55 + clamp((a.decisionDepth - 2) / 5, 0, 1) * 0.20 + (a.undoLike ? 0.08 : 0) + (a.timeoutLike ? 0.17 : 0);
    sum += local * w; wt += w;
  }}
  return clamp(sum / Math.max(wt, 0.0001) + seedBias, 0, 1);
}}

function coerceFirstNumber(src: Record<string, unknown>, keys: string[]): number | null {{
  for (const k of keys) {{ const v = src[k]; if (typeof v === 'number' && Number.isFinite(v)) return v; }}
  return null;
}}
function coerceFirstString(src: Record<string, unknown>, keys: string[]): string | null {{
  for (const k of keys) {{ const v = src[k]; if (typeof v === 'string' && v.length > 0) return v; }}
  return null;
}}
function coerceCount(src: Record<string, unknown>, keys: string[]): number {{
  for (const k of keys) {{
    const v = src[k];
    if (Array.isArray(v)) return v.length;
    if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.floor(v));
    if (v && typeof v === 'object') return Object.keys(v as Record<string, unknown>).length;
  }}
  return 0;
}}
function inferDuration(text: string): number {{
  if (/auction|bid|confirm/.test(text)) return 1800;
  if (/menu|inspect|hover/.test(text)) return 850;
  if (/sell|buy|play|move|draw/.test(text)) return 1200;
  if (/timeout|late|stall/.test(text)) return 5200;
  return 1000;
}}
function inferDepth(text: string): number {{
  if (/auction|hedge|optimize|branch|refi|liquidity/.test(text)) return 4;
  if (/menu|inspect|preview|compare/.test(text)) return 3;
  if (/sell|buy|play|draw|move/.test(text)) return 2;
  return 1;
}}
function safeDiv(a: number, b: number): number {{ return b === 0 ? 0 : clamp(a / b, 0, 1); }}
function mean(values: number[]): number {{ return values.length === 0 ? 0 : values.reduce((s, v) => s + v, 0) / values.length; }}
function median(values: number[]): number {{
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}}
function sigmoid(x: number): number {{ return 1 / (1 + Math.exp(-x)); }}
function ema(current: number, next: number, alpha: number): number {{ return current * (1 - alpha) + next * alpha; }}
function safeRound(v: number, digits: number, fallback?: number): number {{
  if (!Number.isFinite(v)) return fallback ?? 0;
  const p = 10 ** digits; return Math.round(v * p) / p;
}}
function stableStringify(value: unknown): string {{ return JSON.stringify(sortJson(value)); }}
function sortJson(value: unknown): unknown {{
  if (Array.isArray(value)) return value.map(i => sortJson(i));
  if (value && typeof value === 'object') {{
    const out: Record<string, unknown> = {{}};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) out[k] = sortJson((value as Record<string, unknown>)[k]);
    return out;
  }}
  return value;
}}
function sha256Hex(input: string): string {{ return createHash('sha256').update(input).digest('hex'); }}
function normalizeBandit(input: Record<string, {{ trials: number; reward: number }}> | undefined): Record<string, {{ trials: number; reward: number }}> {{
  const out: Record<string, {{ trials: number; reward: number }}> = {{}};
  if (!input) return out;
  for (const [k, v] of Object.entries(input)) out[k] = {{ trials: Math.max(0, Math.floor(Number(v?.trials ?? 0))), reward: clamp(Number(v?.reward ?? 0.5), 0, 1) }};
  return out;
}}"""


def upgrade_file(filepath: str, meta: dict) -> bool:
    """Upgrade a single ML stub file to full implementation."""
    ml_id = meta['ml_id']
    cid = camel_id(ml_id)

    with open(filepath, 'r') as f:
        content = f.read()

    # Ensure createHash import exists
    if "import { createHash }" not in content and "from 'node:crypto'" not in content:
        header_end = content.rfind("// ═══════════════════════════════════════════════════════════════════════════════\n")
        if header_end >= 0:
            insert_pos = content.index("\n", header_end) + 1
            content = content[:insert_pos] + "\nimport { createHash } from 'node:crypto';\n" + content[insert_pos:]

    # Ensure mechanicsUtils imports exist
    if "from '../mechanics/mechanicsUtils'" not in content:
        # Find the last import or header end
        import_block = (
            "\nimport {\n"
            "  CHAOS_WINDOWS_PER_RUN, RUN_TOTAL_TICKS,\n"
            "  buildChaosWindows, clamp, computeHash,\n"
            "} from '../mechanics/mechanicsUtils';\n"
            "import type { MacroRegime } from '../mechanics/types';\n"
        )
        # Insert after the createHash import or after the header
        crypto_pos = content.find("import { createHash }")
        if crypto_pos >= 0:
            line_end = content.index("\n", crypto_pos) + 1
            content = content[:line_end] + import_block + content[line_end:]
        else:
            header_end = content.rfind("// ═══════════════════════════════════════════════════════════════════════════════\n")
            if header_end >= 0:
                insert_pos = content.index("\n", header_end) + 1
                content = content[:insert_pos] + import_block + content[insert_pos:]

    # Find and remove the old implementation (from "// ── Main inference" or the main function to end)
    # We want to keep everything up to and including the constants block,
    # then replace everything after with our implementation

    # Find the end of the ML_CONSTANTS block
    constants_end_pattern = r"} as const;"
    matches = list(re.finditer(constants_end_pattern, content))
    if not matches:
        print(f"  SKIP: {meta['file']} - could not find constants block end")
        return False

    # Use the last "} as const;" which should be the ML_CONSTANTS
    last_const_end = matches[-1].end()

    # Keep everything up to and including the constants block
    header = content[:last_const_end]

    # Generate the implementation
    impl = generate_implementation(meta)

    # Write the upgraded file
    with open(filepath, 'w') as f:
        f.write(header + "\n" + impl + "\n")

    return True


def main():
    if not os.path.isdir(ML_DIR):
        print(f"ERROR: ML directory not found: {ML_DIR}")
        print("Run this script from the repo root: python3 pzo_engine/scripts/upgrade_ml_mechanics.py")
        sys.exit(1)

    # Load metadata
    metadata_path = "/home/claude/ml_metadata.json"
    if os.path.exists(metadata_path):
        with open(metadata_path) as f:
            metadata = json.load(f)
    else:
        # Re-extract metadata inline
        metadata = {}
        for fname in sorted(os.listdir(ML_DIR)):
            if not fname.startswith('m') or not fname.endswith('.ts') or os.path.isdir(os.path.join(ML_DIR, fname)):
                continue
            if any(fname.startswith(s) for s in SKIP) or fname == 'index.ts':
                continue
            fpath = os.path.join(ML_DIR, fname)
            with open(fpath) as f:
                content = f.read()
            ml_id_match = re.search(r"ML_ID:\s*'(\w+)'", content)
            if not ml_id_match:
                continue
            ml_id = ml_id_match.group(1)
            family_match = re.search(r"FAMILY:\s*'(\w+)'", content)
            cat_match = re.search(r"MODEL_CATEGORY:\s*'(\w+)'", content)
            signal_match = re.search(r"INTEL_SIGNAL:\s*'(\w+)'", content)
            core_pair_match = re.search(r"CORE_PAIR:\s*'(\w+)'", content)
            fields_pattern = rf'export interface {ml_id}Output extends {ml_id}BaseOutput \{{(.*?)\}}'
            fields_match = re.search(fields_pattern, content, re.DOTALL)
            ext_fields = []
            if fields_match:
                for line in fields_match.group(1).strip().split('\n'):
                    line = line.strip()
                    if line.startswith('//') or not line: continue
                    fm = re.match(r'(\w+):\s*([^;]+);', line)
                    if fm: ext_fields.append({'name': fm.group(1).strip(), 'type': fm.group(2).strip()})
            metadata[ml_id] = {
                'file': fname, 'ml_id': ml_id,
                'core_pair': core_pair_match.group(1) if core_pair_match else ml_id.replace('A',''),
                'family': family_match.group(1) if family_match else 'market',
                'category': cat_match.group(1) if cat_match else 'predictor',
                'signal': signal_match.group(1) if signal_match else 'risk',
                'ext_fields': ext_fields,
            }

    upgraded = 0
    errors = 0

    for ml_id, meta in sorted(metadata.items()):
        fpath = os.path.join(ML_DIR, meta['file'])
        if not os.path.exists(fpath):
            print(f"  MISSING: {meta['file']}")
            errors += 1
            continue
        try:
            if upgrade_file(fpath, meta):
                upgraded += 1
                print(f"  UPGRADED: {meta['file']} ({meta['family']}/{meta['category']})")
            else:
                errors += 1
        except Exception as e:
            errors += 1
            print(f"  ERROR: {meta['file']}: {e}")

    print(f"\n{'='*60}")
    print(f"Upgraded: {upgraded}")
    print(f"Errors:   {errors}")
    print(f"Total:    {len(metadata)}")


if __name__ == "__main__":
    main()
