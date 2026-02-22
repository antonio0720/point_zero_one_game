/**
 * Creator Levels Contract
 */

export enum CreatorLevel {
  Beginner = "Beginner",
  Intermediate = "Intermediate",
  Advanced = "Advanced",
  Expert = "Expert"
}

export interface PermissionsMatrix {
  [creatorLevel: CreatorLevel]: string[];
}

export interface GateCondition {
  creatorLevel: CreatorLevel;
  requirement: string;
}

export interface UpgradeReceipt {
  creatorId: number;
  levelBeforeUpgrade: CreatorLevel;
  levelAfterUpgrade: CreatorLevel;
  timestamp: Date;
}

// Permissions Matrix for each Creator Level
export const PERMISSIONS_MATRIX: PermissionsMatrix = {
  Beginner: ["viewProfile", "editProfile"],
  Intermediate: ["manageCreators", "moderateContent"],
  Advanced: ["manageGames", "manageFinances"],
  Expert: ["administerPlatform"]
};

// Gate Conditions for level upgrades
export const GATE_CONDITIONS: GateCondition[] = [
  { creatorLevel: CreatorLevel.Intermediate, requirement: "100 reputation points" },
  { creatorLevel: CreatorLevel.Advanced, requirement: "50 approved creations" },
  { creatorLevel: CreatorLevel.Expert, requirement: "1 year of platform activity" }
];
