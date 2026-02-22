import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Public Distribution Service - Verified-Only Publishing and Version Pinning', () => {
  let publicDistributionService: any;

  beforeEach(() => {
    // Initialize the service for each test
    publicDistributionService = new PublicDistributionImpl();
  });

  afterEach(() => {
    // Reset any state or mock dependencies as needed
  });

  it('should only publish verified content', () => {
    // Arrange - Set up the content to be published with and without verification
    const verifiedContent = { id: 'verified-content', verification: true };
    const unverifiedContent = { id: 'unverified-content', verification: false };

    // Act - Attempt to publish both pieces of content
    publicDistributionService.publish(verifiedContent);
    publicDistributionService.publish(unverifiedContent);

    // Assert - Verify that only the verified content is published
    expect(publicDistributionService.getPublishedContent()).toEqual([verifiedContent]);
  });

  it('should pin version when publishing', () => {
    // Arrange - Set up content to be published multiple times with different versions
    const content = { id: 'pinnable-content' };
    publicDistributionService.publish(content);
    publicDistributionService.publish({ ...content, version: 2 });
    publicDistributionService.publish({ ...content, version: 3 });

    // Act - Get the published content
    const publishedContent = publicDistributionService.getPublishedContent();

    // Assert - Verify that each piece of content has its respective version pinned
    expect(publishedContent).toEqual([
      { id: 'pinnable-content', version: 1 },
      { id: 'pinnable-content', version: 2 },
      { id: 'pinnable-content', version: 3 }
    ]);
  });

  it('should not allow publishing overwritten content without confirmation', () => {
    // Arrange - Set up content to be published with the same ID multiple times
    const content = { id: 'overwritable-content' };
    publicDistributionService.publish(content);

    // Act - Attempt to publish an overwritten piece of content without confirmation
    expect(() => publicDistributionService.publish({ ...content })).toThrowError('Content already exists');
  });

  it('should allow publishing overwritten content with confirmation', () => {
    // Arrange - Set up content to be published with the same ID multiple times
    const content = { id: 'overwritable-content' };
    publicDistributionService.publish(content);

    // Act - Attempt to publish an overwritten piece of content with confirmation
    publicDistributionService.confirmOverwrite('overwritable-content');
    publicDistributionService.publish({ ...content });

    // Assert - Verify that the overwritten content is published
    expect(publicDistributionService.getPublishedContent()).toEqual([{ id: 'overwritable-content' }]);
  });

  it('should not allow pinning a non-existent version', () => {
    // Act - Attempt to pin a non-existent version of content
    expect(() => publicDistributionService.pinVersion('non-existent-content', 10)).toThrowError('Content does not exist');
  });

  it('should allow unpublishing content', () => {
    // Arrange - Set up content to be published and then unpublished
    const content = { id: 'unpublishable-content' };
    publicDistributionService.publish(content);
    publicDistributionService.unpublish(content.id);

    // Assert - Verify that the content is no longer published
    expect(publicDistributionService.getPublishedContent()).toEqual([]);
  });
});
