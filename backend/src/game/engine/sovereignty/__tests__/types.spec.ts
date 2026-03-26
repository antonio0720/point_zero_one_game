import { describe, expect, it } from 'vitest';

import {
  CORD_WEIGHTS,
  OUTCOME_MULTIPLIER,
  SOVEREIGNTY_ML_FEATURE_COUNT,
  SOVEREIGNTY_DL_FEATURE_COUNT,
  SOVEREIGNTY_DL_TENSOR_SHAPE,
  computeCordComponentScore,
  computeWeightedCordScore,
  computeCordScoreFromRawInputs,
  computeCordVariance,
  rateCordComponent,
  analyzeCordComponents,
  computeCordScoreWithOutcome,
  classifyOutcome,
  classifyAllOutcomes,
  computeExpectedScoreRange,
  rankOutcomesByMultiplier,
  computeOutcomeDifferential,
  isOutcomeDestructive,
  getModeSovereigntyRules,
  getAllModeSovereigntyRules,
  applyCordModeBonus,
  hasMinimumDecisionsForGrade,
  computeModePressureSurvivalContribution,
  computeModeCascadeRecoveryContribution,
  computeModeShieldMaintenanceContribution,
  computeModeLegendMarkerBonus,
  computeGradeFromScore,
  getGradeBracket,
  computeBadgeTierFromGrade,
  getQualifiedBadges,
  computeDistanceToNextGrade,
  computeGradeNumericScore,
  resolveGradeBadgePair,
  classifyIntegrityRisk,
  isIntegrityReviewRequired,
  computeIntegrityScoreAdjustment,
  computeIntegrityCappedScore,
  extractSovereigntySignals,
  extractCordRawValues,
  computeSnapshotEffectiveStakes,
  computeDecisionSpeedPercentile,
  computeBotNeutralizationRatio,
  computeShieldBreachDensity,
  computeCascadeBrokenRatio,
  computeCascadeRecoveryRate,
  computeSnapshotSovereigntyHealth,
  computeSovereigntyMLVector,
  computeSovereigntyDLTensor,
  generateSovereigntyLabel,
  generateCordComponentLabel,
  generateOutcomeLabel,
  generateIntegrityRiskLabel,
  generateSovereigntyUXBundle,
  generateSovereigntySummary,
  generateGradeComparisonLabel,
  validateSovereigntyTypes,
  validateCordRawValues,
  validateOutcomeKey,
  validateGrade,
  validateIntegrityStatus,
  validateSovereigntyScore,
  validateModeForSovereignty,
  validateSovereigntySignals,
  serializeSovereigntyConfig,
  deserializeSovereigntyConfig,
  serializeCordScoreResult,
  serializeSovereigntySignals,
  computeSovereigntyConfigFingerprint,
  serializeGradeBadgePair,
  hashSovereigntySignals,
  signSovereigntyConfigDigest,
  serializeMLVectorResult,
  serializeDLTensorResult,
  computeSovereigntyTypesChecksum,
  runSovereigntyTypesSelfTest,
} from '../types';
import { applyCanonicalProofHash, createBaseSnapshot } from './fixtures';

describe('sovereignty/types', () => {
  it('preserves core constants and dimensionality', () => {
    const weightSum = Object.values(CORD_WEIGHTS).reduce((sum, value) => sum + value, 0);

    expect(weightSum).toBeCloseTo(1, 8);
    expect(OUTCOME_MULTIPLIER.FREEDOM).toBe(1.5);
    expect(OUTCOME_MULTIPLIER.BANKRUPT).toBe(0.4);
    expect(SOVEREIGNTY_ML_FEATURE_COUNT).toBe(32);
    expect(SOVEREIGNTY_DL_FEATURE_COUNT).toBe(48);
    expect(SOVEREIGNTY_DL_TENSOR_SHAPE).toEqual([1, 48]);
  });

  it('scores cord components, variance, labels, and outcome multipliers', () => {
    const raw = {
      decision_speed_score: 0.82,
      shields_maintained_pct: 0.7,
      hater_sabotages_blocked: 0.66,
      cascade_chains_broken: 0.74,
      pressure_survived_score: 0.58,
    };

    const weighted = computeWeightedCordScore(raw);
    const fromRaw = computeCordScoreFromRawInputs(
      raw.decision_speed_score,
      raw.shields_maintained_pct,
      raw.hater_sabotages_blocked,
      raw.cascade_chains_broken,
      raw.pressure_survived_score,
    );
    const variance = computeCordVariance(raw);
    const analysis = analyzeCordComponents(raw);
    const withOutcome = computeCordScoreWithOutcome(raw, 'FREEDOM');

    expect(computeCordComponentScore('decision_speed_score', 0.82)).toBeGreaterThan(0);
    expect(weighted.normalizedScore).toBeGreaterThan(0);
    expect(fromRaw.normalizedScore).toBeCloseTo(weighted.normalizedScore, 8);
    expect(variance).toBeGreaterThanOrEqual(0);
    expect(analysis).toHaveLength(5);
    expect(rateCordComponent(0.9)).toBe('EXCELLENT');
    expect(withOutcome).toBeGreaterThan(weighted.normalizedScore);
    expect(serializeCordScoreResult(weighted)).toContain(weighted.dominantComponent);
  });

  it('classifies outcomes, orders multipliers, and describes destructive states', () => {
    const freedom = classifyOutcome('FREEDOM');
    const timeout = classifyOutcome('TIMEOUT');
    const allOutcomes = classifyAllOutcomes();
    const ranked = rankOutcomesByMultiplier();

    expect(freedom.multiplier).toBe(1.5);
    expect(timeout.label).toContain('Time');
    expect(allOutcomes.size).toBe(4);
    expect(ranked[0]).toBe('FREEDOM');
    expect(computeOutcomeDifferential('FREEDOM', 'BANKRUPT')).toBeGreaterThan(0);
    expect(isOutcomeDestructive('BANKRUPT')).toBe(true);
    expect(computeExpectedScoreRange('TIMEOUT', 0.2, 0.8).max).toBeGreaterThan(
      computeExpectedScoreRange('TIMEOUT', 0.2, 0.8).min,
    );
  });

  it('applies mode sovereignty rules without flattening the repo’s mode law', () => {
    const rules = getModeSovereigntyRules('coop');
    const allRules = getAllModeSovereigntyRules();

    expect(rules.mode).toBe('coop');
    expect(rules.minDecisionsForGrade).toBeGreaterThan(0);
    expect(allRules.some((entry) => entry.mode === 'ghost')).toBe(true);
    expect(applyCordModeBonus(0.6, 'coop')).toBeGreaterThanOrEqual(0.6);
    expect(hasMinimumDecisionsForGrade(rules.minDecisionsForGrade, 'coop')).toBe(true);
    expect(computeModePressureSurvivalContribution(0.5, 'coop')).toBeGreaterThanOrEqual(0);
    expect(computeModeCascadeRecoveryContribution(0.5, 'coop')).toBeGreaterThanOrEqual(0);
    expect(computeModeShieldMaintenanceContribution(0.5, 'coop')).toBeGreaterThanOrEqual(0);
    expect(computeModeLegendMarkerBonus(3, 100, 'ghost')).toBeGreaterThanOrEqual(0);
    expect(validateModeForSovereignty('coop')).toBe(true);
  });

  it('maps scores into grades, badges, and grade deltas', () => {
    const grade = computeGradeFromScore(0.91);
    const bracket = getGradeBracket(grade);
    const badgeTier = computeBadgeTierFromGrade(grade);
    const pair = resolveGradeBadgePair(0.91);

    expect(['S', 'A', 'B', 'C', 'D', 'F']).toContain(grade);
    expect(bracket.grade).toBe(grade);
    expect(typeof bracket.label).toBe('string');
    expect(badgeTier).toMatch(/PLATINUM|GOLD|SILVER|BRONZE|IRON/);
    expect(getQualifiedBadges(0.91).length).toBeGreaterThanOrEqual(0);
    expect(computeDistanceToNextGrade(0.91)).toBeGreaterThanOrEqual(0);
    expect(computeGradeNumericScore(grade)).toBeGreaterThanOrEqual(0);
    expect(pair.grade).toBe(grade);
    expect(generateGradeComparisonLabel(0.7, 0.9)).toContain('B');
  });

  it('classifies integrity risk and score capping behavior', () => {
    const none = classifyIntegrityRisk('VERIFIED', 0, 1.0);
    const high = classifyIntegrityRisk('QUARANTINED', 2, 0.5);

    expect(none.level).toBe('NONE');
    expect(high.score).toBeGreaterThanOrEqual(none.score);
    expect(isIntegrityReviewRequired('QUARANTINED', 2)).toBe(true);
    expect(computeIntegrityScoreAdjustment('VERIFIED')).toBeGreaterThanOrEqual(0);
    expect(computeIntegrityCappedScore(0.8, 'QUARANTINED', 2)).toBeLessThanOrEqual(0.8);
    expect(generateIntegrityRiskLabel('QUARANTINED', 2, 0.5)).toContain(high.level);
    expect(validateIntegrityStatus('VERIFIED')).toBe(true);
  });

  it('extracts sovereignty signals and snapshot-derived ratios from canonical snapshots', () => {
    const snapshot = applyCanonicalProofHash(createBaseSnapshot());
    const signals = extractSovereigntySignals(snapshot);
    const rawValues = extractCordRawValues(snapshot);

    expect(signals.cordScore).toBeGreaterThanOrEqual(0);
    expect(signals.tickCheckpointCoverage).toBeGreaterThanOrEqual(0);
    expect(validateSovereigntySignals(signals)).toBe(true);
    expect(rawValues.decision_speed_score).toBeGreaterThanOrEqual(0);
    expect(computeSnapshotEffectiveStakes(snapshot)).toBeGreaterThanOrEqual(0);
    expect(computeDecisionSpeedPercentile(snapshot.telemetry.decisions)).toBeGreaterThanOrEqual(0);
    expect(computeBotNeutralizationRatio(snapshot.battle)).toBeGreaterThanOrEqual(0);
    expect(computeShieldBreachDensity(snapshot.shield, snapshot.tick)).toBeGreaterThanOrEqual(0);
    expect(computeCascadeBrokenRatio(snapshot.cascade)).toBeGreaterThanOrEqual(0);
    expect(computeCascadeRecoveryRate(snapshot.cascade)).toBeGreaterThanOrEqual(0);
    expect(computeSnapshotSovereigntyHealth(snapshot)).toBeGreaterThanOrEqual(0);
  });

  it('produces 32-dim ML vectors and 48-dim DL tensors from snapshots', () => {
    const snapshot = applyCanonicalProofHash(createBaseSnapshot());
    const ml = computeSovereigntyMLVector(snapshot);
    const dl = computeSovereigntyDLTensor(snapshot);

    expect(ml.featureCount).toBe(SOVEREIGNTY_ML_FEATURE_COUNT);
    expect(dl.featureCount).toBe(SOVEREIGNTY_DL_FEATURE_COUNT);
    expect(ml.vector).toHaveLength(32);
    expect(dl.tensor).toHaveLength(48);
    expect(ml.vector.every(Number.isFinite)).toBe(true);
    expect(dl.tensor.every(Number.isFinite)).toBe(true);
    expect(serializeMLVectorResult(ml)).toContain(snapshot.runId);
    expect(serializeDLTensorResult(dl)).toContain(snapshot.runId);
  });

  it('generates sovereignty UX labels and summaries that preserve product meaning', () => {
    const snapshot = applyCanonicalProofHash(createBaseSnapshot());
    const signals = extractSovereigntySignals(snapshot);
    const grade = computeGradeFromScore(snapshot.sovereignty.sovereigntyScore);
    const bundle = generateSovereigntyUXBundle(snapshot);

    expect(generateSovereigntyLabel(snapshot)).toContain(snapshot.mode);
    expect(generateCordComponentLabel('decision_speed_score', 0.75)).toContain('Decision');
    expect(generateOutcomeLabel(snapshot.outcome!)).toContain('Time');
    expect(bundle.gradeLabel).toContain(grade);
    expect(bundle.summaryParagraph.length).toBeGreaterThan(20);
    expect(serializeSovereigntySignals(signals)).toContain('cordScore');
    expect(generateSovereigntySummary(snapshot.sovereignty.sovereigntyScore, snapshot.mode, snapshot.outcome!)).toContain(snapshot.mode);
  });

  it('validates, serializes, fingerprints, hashes, and signs sovereignty configuration', () => {
    const validation = validateSovereigntyTypes();
    const serialized = serializeSovereigntyConfig();
    const deserialized = deserializeSovereigntyConfig(serialized);
    const fingerprint = computeSovereigntyConfigFingerprint();
    const checksum = computeSovereigntyTypesChecksum();
    const signature = signSovereigntyConfigDigest('unit-test-secret');

    expect(validation.valid).toBe(true);
    expect(validateCordRawValues({
      decision_speed_score: 0.5,
      shields_maintained_pct: 0.5,
      hater_sabotages_blocked: 0.5,
      cascade_chains_broken: 0.5,
      pressure_survived_score: 0.5,
    })).toBe(true);
    expect(validateOutcomeKey('FREEDOM')).toBe(true);
    expect(validateGrade('A')).toBe(true);
    expect(validateSovereigntyScore(0.75)).toBe(true);
    expect(deserialized.config!.version).toBeTruthy();
    expect(fingerprint).toHaveLength(64);
    expect(checksum).toHaveLength(64);
    expect(signature).toHaveLength(64);
    expect(serializeGradeBadgePair('A', 0.9)).toContain('A');
    expect(hashSovereigntySignals(extractSovereigntySignals(applyCanonicalProofHash(createBaseSnapshot())))).toHaveLength(64);
  });

  it('passes the sovereignty types self-test', () => {
    const result = runSovereigntyTypesSelfTest();
    expect(result.ok).toBe(true);
    expect(result.failedCount).toBe(0);
    expect(result.checksCount).toBeGreaterThan(0);
  });
});
