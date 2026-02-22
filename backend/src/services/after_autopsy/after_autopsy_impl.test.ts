import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('AfterAutopsyImpl', () => {
  let afterAutopsyImpl: AfterAutopsyImpl;

  beforeEach(() => {
    afterAutopsyImpl = new AfterAutopsyImpl();
  });

  afterEach(() => {
    // Reset any state or mocks here if necessary
  });

  describe('singleInsightOutput', () => {
    it('should return the correct single insight output', () => {
      const input = { stage: 'stage1', insights: [{ id: 'insight1', value: 'value1' }] };
      const expectedOutput = { stage: 'stage1', insights: [{'id': 'insight1', 'output': 'value1'}] };

      expect(afterAutopsyImpl.singleInsightOutput(input)).toEqual(expectedOutput);
    });

    it('should handle empty insight array', () => {
      const input = { stage: 'stage1', insights: [] };
      const expectedOutput = { stage: 'stage1', insights: [] };

      expect(afterAutopsyImpl.singleInsightOutput(input)).toEqual(expectedOutput);
    });
  });

  describe('stageSpecificPayloads', () => {
    it('should return the correct stage-specific payload for a single stage', () => {
      const input = { stages: [{ id: 'stage1', insights: [] }] };
      const expectedOutput = { stage1: {} };

      expect(afterAutopsyImpl.stageSpecificPayloads(input)).toEqual(expectedOutput);
    });

    it('should return the correct stage-specific payload for multiple stages', () => {
      const input = {
        stages: [
          { id: 'stage1', insights: [] },
          { id: 'stage2', insights: [] }
        ]
      };
      const expectedOutput = { stage1: {}, stage2: {} };

      expect(afterAutopsyImpl.stageSpecificPayloads(input)).toEqual(expectedOutput);
    });
  });
});
