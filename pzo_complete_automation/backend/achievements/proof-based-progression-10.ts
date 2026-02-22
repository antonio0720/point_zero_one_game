interface Proof {
id: number;
playerId: number;
content: string; // Base64 encoded image or text
}

interface Achievement {
id: number;
name: string;
description: string;
proofCount: number;
isCompleted: boolean;
}

class ProofBasedProgressionSystem {
private achievements: Map<number, Achievement> = new Map();

constructor() {
this.initAchievements();
}

private initAchievements(): void {
const achievement1: Achievement = {
id: 1,
name: 'First Proof',
description: 'Submit your first proof.',
proofCount: 1,
isCompleted: false,
};

this.achievements.set(achievement1.id, achievement1);
}

public addProof(proof: Proof): void {
const playerAchievements = this.getPlayerAchievements(proof.playerId);

for (const [achievementId, achievement] of playerAchievements) {
if (achievement.proofCount > 0 && !achievement.isCompleted) {
if (achievement.proofCount <= proof.id) {
this.markAchievementAsCompleted(achievementId);
}
}
}
}

private getPlayerAchievements(playerId: number): Map<number, Achievement> {
return this.achievements.filter(([id, achievement]) => achievement.id === playerId).values();
}

private markAchievementAsCompleted(achievementId: number): void {
const achievement = this.achievements.get(achievementId);

if (achievement) {
achievement.isCompleted = true;
}
}
}
