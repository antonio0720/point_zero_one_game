interface Proof {
id: string;
evidenceUrl: string;
}

class Achievement {
name: string;
description: string;
points: number;
requiredProofIds: string[];
completed: boolean;

constructor(name: string, description: string, points: number, requiredProofIds: string[]) {
this.name = name;
this.description = description;
this.points = points;
this.requiredProofIds = requiredProofIds;
this.completed = false;
}

checkCompletion(proofs: Proof[]): void {
for (const proofId of this.requiredProofIds) {
const foundProof = proofs.find((p) => p.id === proofId);
if (!foundProof) {
throw new Error(`Missing required proof with id ${proofId}`);
}
}
this.completed = true;
}
}

class Quest {
name: string;
description: string;
points: number;
rewards: any[]; // replace with actual reward objects
requiredAchievementsIds: string[];
completed: boolean;

constructor(name: string, description: string, points: number, rewards: any[], requiredAchievementsIds: string[]) {
this.name = name;
this.description = description;
this.points = points;
this.rewards = rewards;
this.requiredAchievementsIds = requiredAchievementsIds;
this.completed = false;
}

checkCompletion(achievements: Achievement[]): void {
for (const achievementId of this.requiredAchievementsIds) {
const foundAchievement = achievements.find((a) => a.id === achievementId);
if (!foundAchievement || !foundAchievement.completed) {
throw new Error(`Missing required achievement with id ${achievementId}`);
}
}
this.completed = true;
}
}

class BattlePass {
name: string;
currentTier: number;
totalTiers: number;
quests: Quest[];
achievements: Achievement[];

constructor(name: string, currentTier: number, totalTiers: number, quests: Quest[], achievements: Achievement[]) {
this.name = name;
this.currentTier = currentTier;
this.totalTiers = totalTiers;
this.quests = quests;
this.achievements = achievements;
}
}
