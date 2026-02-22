import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Restricted surfaces not served during onboarding stages', () => {
  let safetyRailsService;

  beforeEach(() => {
    safetyRailsService = new (require('../safety-rails'))();
  });

  afterEach(() => {
    // Reset any state or mocks here if necessary
  });

  it('should not serve restricted surfaces during onboarding stage 1', () => {
    const surface = { restricted: true, stage: 1 };
    expect(safetyRailsService.serveSurface(surface)).toBeFalsy();
  });

  it('should not serve restricted surfaces during onboarding stage 2', () => {
    const surface = { restricted: true, stage: 2 };
    expect(safetyRailsService.serveSurface(surface)).toBeFalsy();
  });

  it('should serve non-restricted surfaces during onboarding stage 1', () => {
    const surface = { restricted: false, stage: 1 };
    expect(safetyRailsService.serveSurface(surface)).toBeTruthy();
  });

  it('should serve non-restricted surfaces during onboarding stage 2', () => {
    const surface = { restricted: false, stage: 2 };
    expect(safetyRailsService.serveSurface(surface)).toBeTruthy();
  });

  it('should not serve restricted surfaces after onboarding', () => {
    const surface = { restricted: true };
    expect(safetyRailsService.serveSurface(surface)).toBeFalsy();
  });

  it('should serve non-restricted surfaces after onboarding', () => {
    const surface = { restricted: false };
    expect(safetyRailsService.serveSurface(surface)).toBeTruthy();
  });
});
