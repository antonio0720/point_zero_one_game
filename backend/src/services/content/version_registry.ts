/**
 * Immutable version registry service for content management.
 */

import { sha256 } from 'js-sha256';

export interface ContentJson {
  /** Unique identifier for the content item */
  id: string;
  /** JSON representation of the content */
  data: object;
}

/**
 * Version registry entry representing a pinned version of a content item.
 */
export interface VersionRegistryEntry {
  /** Content hash calculated from the content JSON */
  contentHash: string;
  /** Deployed ruleset version this version is pinned to */
  rulesetVersion?: string;
}

/**
 * Interface for the VersionRegistry service.
 */
export interface VersionRegistryService {
  /**
   * Adds a new version of the content item with the given JSON data.
   * @param contentJson - The JSON representation of the content to add.
   */
  addContent(contentJson: ContentJson): void;

  /**
   * Retrieves the pinned version for the given content hash, if any.
   * @param contentHash - The content hash to search for.
   */
  getPinnedVersion(contentHash: string): VersionRegistryEntry | undefined;
}

/**
 * In-memory implementation of the VersionRegistryService.
 */
export class InMemoryVersionRegistry implements VersionRegistryService {
  private readonly versions: Map<string, VersionRegistryEntry> = new Map();

  public addContent(contentJson: ContentJson): void {
    const contentHash = sha256(JSON.stringify(contentJson));
    this.versions.set(contentHash, { contentHash, rulesetVersion: undefined });
  }

  public getPinnedVersion(contentHash: string): VersionRegistryEntry | undefined {
    return this.versions.get(contentHash);
  }
}
