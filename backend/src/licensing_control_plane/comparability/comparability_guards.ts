Here is the TypeScript code for the comparability guards as per your specifications:

```typescript
/**
 * Comparability Guards for Sovereign Infrastructure Architecture
 */

type ContentVersion = {
  episodeId: string;
  rulesetId: string;
  version: string;
}

interface Episode {
  id: string;
  name: string;
  contentVersions?: ContentVersion[];
}

interface Ruleset {
  id: string;
  name: string;
  episodeId: string;
  contentVersions?: ContentVersion[];
}

type Assessment = {
  episodeId: string;
  rulesetId: string;
  contentVersion: ContentVersion;
}

/**
 * Check if the provided assessment has a valid content version for both episode and ruleset.
 */
function isValidAssessment(assessment: Assessment): boolean {
  const { episodeId, rulesetId, contentVersion } = assessment;
  return (
    !!episodeWithVersion(episodes, episodeId, contentVersion.version) &&
    !!rulesetWithVersion(ruleSets, rulesetId, contentVersion.version)
  );
}

/**
 * Get the episode with the provided id and version.
 */
function episodeWithVersion(episodes: Episode[], episodeId: string, version: string): Episode | undefined {
  return episodes.find((episode) => episode.id === episodeId && episode.contentVersions?.some((cv) => cv.version === version));
}

/**
 * Get the ruleset with the provided id and version.
 */
function ruleSetWithVersion(ruleSets: Ruleset[], ruleSetId: string, version: string): Ruleset | undefined {
  return ruleSets.find((ruleset) => ruleset.id === ruleSetId && ruleset.contentVersions?.some((cv) => cv.version === version));
}

/**
 * Export public symbols.
 */
export { ContentVersion, Episode, Ruleset, Assessment, isValidAssessment, episodeWithVersion, ruleSetWithVersion };
