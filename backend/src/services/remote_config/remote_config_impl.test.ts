import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RemoteConfigImpl } from '../remote_config_impl';
import { Segmentation, Defaults, KillSwitch } from '../constants';

describe('Remote Config Service', () => {
  let remoteConfig: RemoteConfigImpl;

  beforeEach(() => {
    remoteConfig = new RemoteConfigImpl();
  });

  afterEach(() => {
    // Reset any state or mocks here if needed
  });

  describe('Segmentation', () => {
    it('should return the correct segment for a valid segment ID', () => {
      expect(remoteConfig.getSegment(Segmentation.STAGE)).toEqual(Segmentation.STAGE);
      expect(remoteConfig.getSegment(Segmentation.PRODUCTION)).toEqual(Segmentation.PRODUCTION);
    });

    it('should throw an error for an invalid segment ID', () => {
      expect(() => remoteConfig.getSegment('INVALID_SEGMENT')).toThrowError();
    });
  });

  describe('Defaults', () => {
    it('should return the correct default value for a valid key', () => {
      expect(remoteConfig.getDefault(Defaults.API_URL)).toEqual(Defaults.API_URL);
      expect(remoteConfig.getDefault(Defaults.API_KEY)).toEqual(Defaults.API_KEY);
    });

    it('should return undefined for an invalid key', () => {
      expect(remoteConfig.getDefault('INVALID_KEY')).toBeUndefined();
    });
  });

  describe('Kill Switch', () => {
    it('should return true when the kill switch is enabled', () => {
      remoteConfig.setKillSwitch(KillSwitch.ENABLED);
      expect(remoteConfig.isKillSwitchEnabled()).toBeTruthy();
    });

    it('should return false when the kill switch is disabled', () => {
      remoteConfig.setKillSwitch(KillSwitch.DISABLED);
      expect(remoteConfig.isKillSwitchEnabled()).toBeFalsy();
    });
  });
});
