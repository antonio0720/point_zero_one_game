import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Versioning and Rollout Gating', () => {
  let patchNotesService: any;

  beforeEach(() => {
    patchNotesService = new (require('../patch_notes'))();
  });

  afterEach(() => {
    // Reset any state or mocks here if needed
  });

  it('should return the correct version number for a valid release', () => {
    const releaseData = {
      version: '1.2.3',
      rolloutPercentage: 100,
      startTime: new Date(),
      endTime: null,
    };

    expect(patchNotesService.getVersionNumber(releaseData)).toEqual('1.2.3');
  });

  it('should return the correct rollout percentage for a valid release', () => {
    const releaseData = {
      version: '1.2.3',
      rolloutPercentage: 50,
      startTime: new Date(),
      endTime: null,
    };

    expect(patchNotesService.getRolloutPercentage(releaseData)).toEqual(50);
  });

  it('should return null for an invalid release with no version number', () => {
    const invalidReleaseData = {
      rolloutPercentage: 100,
      startTime: new Date(),
      endTime: null,
    };

    expect(patchNotesService.getVersionNumber(invalidReleaseData)).toBeNull();
  });

  it('should return the correct version number for a release with an end time', () => {
    const releaseData = {
      version: '1.2.3',
      rolloutPercentage: 100,
      startTime: new Date(),
      endTime: new Date(Date.now() + 86400000), // One day in the future
    };

    expect(patchNotesService.getVersionNumber(releaseData)).toEqual('1.2.3');
  });

  it('should return null for a release that has ended', () => {
    const releaseData = {
      version: '1.2.3',
      rolloutPercentage: 100,
      startTime: new Date(),
      endTime: new Date(Date.now() - 86400000), // One day in the past
    };

    expect(patchNotesService.getVersionNumber(releaseData)).toBeNull();
  });

  it('should return the correct rollout percentage for a release with an end time', () => {
    const releaseData = {
      version: '1.2.3',
      rolloutPercentage: 50,
      startTime: new Date(),
      endTime: new Date(Date.now() + 86400000), // One day in the future
    };

    expect(patchNotesService.getRolloutPercentage(releaseData)).toEqual(50);
  });

  it('should return 0 for a release that has ended and is below its rollout percentage', () => {
    const releaseData = {
      version: '1.2.3',
      rolloutPercentage: 50,
      startTime: new Date(),
      endTime: new Date(Date.now() - 86400000), // One day in the past
    };

    expect(patchNotesService.getRolloutPercentageForUser(releaseData, 1)).toEqual(0);
  });

  it('should return the correct rollout percentage for a release that has not ended and is above its rollout percentage', () => {
    const releaseData = {
      version: '1.2.3',
      rolloutPercentage: 50,
      startTime: new Date(),
      endTime: null,
    };

    expect(patchNotesService.getRolloutPercentageForUser(releaseData, 2)).toEqual(100);
  });

  it('should return the correct rollout percentage for a release that has not ended and is at its rollout percentage', () => {
    const releaseData = {
      version: '1.2.3',
      rolloutPercentage: 50,
      startTime: new Date(),
      endTime: null,
    };

    expect(patchNotesService.getRolloutPercentageForUser(releaseData, 1)).toEqual(50);
  });
});
