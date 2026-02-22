/**
 * Enums for in-game SKU classes.
 */

export enum COSMETIC {
  COSMETIC_1 = "COSMETIC_1",
  COSMETIC_2 = "COSMETIC_2",
  // Add more cosmetic items as needed
}

export enum ACCESS_CONTENT {
  ACCESS_CONTENT_1 = "ACCESS_CONTENT_1",
  ACCESS_CONTENT_2 = "ACCESS_CONTENT_2",
  // Add more access content items as needed
}

export enum CONVENIENCE_NONCOMPETITIVE {
  CONVENIENCE_NONCOMPETITIVE_1 = "CONVENIENCE_NONCOMPETITIVE_1",
  CONVENIENCE_NONCOMPETITIVE_2 = "CONVENIENCE_NONCOMPETITIVE_2",
  // Add more convenience non-competitive items as needed
}

export enum SOCIAL_FEATURE {
  SOCIAL_FEATURE_1 = "SOCIAL_FEATURE_1",
  SOCIAL_FEATURE_2 = "SOCIAL_FEATURE_2",
  // Add more social feature items as needed
}

export enum ARCHIVE_PROOF {
  ARCHIVE_PROOF_1 = "ARCHIVE_PROOF_1",
  ARCHIVE_PROOF_2 = "ARCHIVE_PROOF_2",
  // Add more archive proof items as needed
}

export enum SUBSCRIPTION_PASS {
  SUBSCRIPTION_PASS_1 = "SUBSCRIPTION_PASS_1",
  SUBSCRIPTION_PASS_2 = "SUBSCRIPTION_PASS_2",
  // Add more subscription passes as needed
}

/**
 * Forbidden SKU classes. These items should never be sold or offered in the game.
 */
export const FORBIDDEN_SKU_CLASSES: readonly string[] = [
  "POWER",
  "BOOST",
  "TIME_SKIP",
  "RNG_REROLL",
  "INSURANCE",
  "ADVANTAGE_INFERENCE"
];
