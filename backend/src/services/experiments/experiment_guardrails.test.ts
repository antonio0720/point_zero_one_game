import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Experiment Guardrails', () => {
  let experimentGuardrails;

  beforeEach(() => {
    experimentGuardrails = new ExperimentGuardrails();
  });

  afterEach(() => {
    // Reset any state or mocks here if necessary
  });

  it('rejects invalid experiment configs', () => {
    const invalidConfig1 = { name: '', impact: 'high' };
    const invalidConfig2 = { name: 'valid_experiment', impact: 'invalid_impact' };
    const invalidConfig3 = { name: 'valid_experiment', impact: 'high', participants: -1 };

    expect(experimentGuardrails.validateExperimentConfig(invalidConfig1)).toBeFalsy();
    expect(experimentGuardrails.validateExperimentConfig(invalidConfig2)).toBeFalsy();
    expect(experimentGuardrails.validateExperimentConfig(invalidConfig3)).toBeFalsy();
  });

  it('accepts valid experiment configs', () => {
    const validConfig1 = { name: 'valid_experiment', impact: 'high', participants: 100 };
    const validConfig2 = { name: 'valid_experiment', impact: 'low', participants: 1000 };

    expect(experimentGuardrails.validateExperimentConfig(validConfig1)).toBeTruthy();
    expect(experimentGuardrails.validateExperimentConfig(validConfig2)).toBeTruthy();
  });

  it('rejects experiment configs with zero or negative participants', () => {
    const invalidParticipants = [-1, 0];

    for (const participants of invalidParticipants) {
      const validConfig = { name: 'valid_experiment', impact: 'high', participants };
      expect(experimentGuardrails.validateExperimentConfig(validConfig)).toBeFalsy();
    }
  });

  it('rejects experiment configs with invalid impacts', () => {
    const invalidImpacts = ['lowest', 'highest', 'medium_high'];

    for (const impact of invalidImpacts) {
      const validConfig = { name: 'valid_experiment', impact, participants: 100 };
      expect(experimentGuardrails.validateExperimentConfig(validConfig)).toBeFalsy();
    }
  });
});
