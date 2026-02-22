// ruleset-version.ts

/**
 * @file Ruleset version string (semver + optional git sha fallback)
 */

export interface RulesetVersion {
  /**
   * Semver of the current ruleset
   */
  semver: string;
  /**
   * Optional git sha hash for deterministic builds
   */
  gitSha?: string;
}

/**
 * @description Deterministic ruleset version string (semver + optional git sha fallback)
 */
export const RULESET_VERSION: RulesetVersion = {
  semver: '1.0.0',
};

// ML models
export interface MlModel {
  /**
   * Whether the model is enabled or not
   */
  mlEnabled: boolean;
  /**
   * Bounded output of the model (0-1)
   */
  boundedOutput: number;
  /**
   * Audit hash for proof/audit purposes
   */
  auditHash: string;
}

export const ML_MODEL: MlModel = {
  mlEnabled: false,
  boundedOutput: 0.5,
  auditHash: '1234567890abcdef',
};

// Engine
/**
 * @description Preserve determinism by exporting all public symbols
 */
export { RULESET_VERSION, ML_MODEL };
