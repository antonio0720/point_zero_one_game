import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Guide Retrieval and Prompt Tagging', () => {
  let service;

  beforeEach(() => {
    service = new (require('../guides'))();
  });

  afterEach(() => {
    // Reset any state or mock dependencies as needed
  });

  it('retrieves guides successfully', async () => {
    const guides = await service.getGuides();
    expect(guides).not.toBeNull();
    expect(Array.isArray(guides)).toBeTruthy();
  });

  it('tags prompts correctly for a valid guide', async () => {
    const guide = await service.getGuideById('example-guide');
    const taggedPrompts = service.tagPrompts(guide.prompts);
    expect(taggedPrompts).not.toBeNull();
    expect(Array.isArray(taggedPrompts)).toBeTruthy();
  });

  it('handles null or undefined guide input', () => {
    expect(service.tagPrompts(null)).toEqual([]);
    expect(service.tagPrompts(undefined)).toEqual([]);
  });

  it('handles empty prompt array for a guide', () => {
    const guide = { id: 'empty-guide', prompts: [] };
    const taggedPrompts = service.tagPrompts(guide.prompts);
    expect(taggedPrompts).toEqual([]);
  });

  it('handles invalid prompt types in a guide', () => {
    const invalidGuide = { id: 'invalid-guide', prompts: ['not an object'] };
    expect(() => service.tagPrompts(invalidGuide.prompts)).toThrow();
  });

  it('handles missing prompt properties in a guide', () => {
    const missingPropertyGuide = { id: 'missing-property-guide', prompts: [{ text: 'Missing property' }] };
    expect(() => service.tagPrompts(missingPropertyGuide.prompts)).toThrow();
  });
});
