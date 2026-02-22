import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Moment Bridge', () => {
  let momentBridge: any;

  beforeEach(() => {
    momentBridge = new (require('../moment-bridge'))();
  });

  afterEach(() => {
    // Reset any state or mocks here if needed
  });

  it('maps FUBAR to HOS-B01', () => {
    expect(momentBridge.eventCodeToHostCode('FUBAR')).toEqual('HOS-B01');
  });

  it('maps OPPORTUNITY_FLIP to HOS-A01', () => {
    expect(momentBridge.eventCodeToHostCode('OPPORTUNITY_FLIP')).toEqual('HOS-A01');
  });

  it('maps MISSED_THE_BAG to HOS-C01', () => {
    expect(momentBridge.eventCodeToHostCode('MISSED_THE_BAG')).toEqual('HOS-C01');
  });

  it('returns null for unknown event codes', () => {
    const unknownEvent = 'UNKNOWN_EVENT';
    expect(momentBridge.eventCodeToHostCode(unknownEvent)).toBeNull();
  });

  it('ensures callout line is non-empty for all codes', () => {
    const validCodes = [
      'FUBAR',
      'OPPORTUNITY_FLIP',
      'MISSED_THE_BAG',
      // Add more valid event codes here if needed
    ];

    validCodes.forEach((eventCode) => {
      expect(momentBridge.getCalloutLineForEventCode(eventCode)).not.toBeEmpty();
    });
  });
});
