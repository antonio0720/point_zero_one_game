/**
 * Bloodline Contract Interface
 */

export enum FamilyTrait {
  STRONG = "strong",
  WEAK = "weak",
  CLEVER = "clever",
  STUPID = "stupid"
}

export interface InheritedAsset {
  wealth: number;
  reputationScore: ReputationScore;
}

export interface BloodlineState {
  familyTrait: FamilyTrait;
  inheritedAssets: InheritedAsset[];
}

export interface Generation {
  id: number;
  bloodlineId: number;
  parentGenerationId?: number; // nullable, optional
  runOutcome: RunOutcome;
  state: BloodlineState;
}

export type RunOutcome = "success" | "failure";

export interface GenerationTransferEvent {
  fromGenerationId: number;
  toGenerationId: number;
  transferredAssets: InheritedAsset[];
}

/**
 * Deterministic inheritance computation from parent run outcome
 */
export function computeInheritance(parentRunOutcome: RunOutcome): InheritedAsset[] {
  let wealth = 0;
  let reputationScore = ReputationScore.NEUTRAL;

  if (parentRunOutcome === "success") {
    wealth = 100;
    reputationScore = ReputationScore.HIGH;
  } else if (parentRunOutcome === "failure") {
    wealth = -50;
    reputationScore = ReputationScore.LOW;
  }

  return [{ wealth, reputationScore }];
}
