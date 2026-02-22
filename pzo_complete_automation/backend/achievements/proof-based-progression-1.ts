interface IProof {
id: string;
data: any;
}

interface IProgressionRequirements {
proofId?: string;
count?: number;
uniqueCount?: number;
}

class Proof implements IProof {
id: string;
data: any;

constructor(id: string, data: any) {
this.id = id;
this.data = data;
}
}

class ProgressionRequirements implements IProgressionRequirements {
proofId?: string;
count?: number;
uniqueCount?: number;

constructor(reqs: IProgressionRequirements) {
Object.assign(this, reqs);
}
}

class Achievement {
id: string;
name: string;
description: string;
requirements: ProgressionRequirements;
completed: boolean;

constructor(id: string, name: string, description: string, reqs: IProgressionRequirements) {
this.id = id;
this.name = name;
this.description = description;
this.requirements = new ProgressionRequirements(reqs);
this.completed = false;
}
}

class Player {
achievements: Map<string, Achievement>;
proofs: Map<string, Proof>;

constructor() {
this.achievements = new Map();
this.proofs = new Map();
}

addProof(proof: Proof) {
this.proofs.set(proof.id, proof);
}

checkAchievementProgress(achievementId: string): boolean {
const achievement = this.achievements.get(achievementId);

if (!achievement) return false;

if (achievement.requirements.proofId) {
const proof = this.proofs.get(achievement.requirements.proofId);
if (!proof) return false;

if (this.requirementsMetForCountBasedProgression(achievement)) return true;
if (this.requirementsMetForUniqueProgression(achievement)) return true;
}

return false;
}

private requirementsMetForCountBasedProgression(achievement: Achievement): boolean {
const proof = this.proofs.get(achievement.requirements.proofId);
if (!proof) throw new Error('Proof not found');

let count = 0;
for (const playerProof of this.proofs.values()) {
if (playerProof.id === proof.id) count++;
}

return count >= achievement.requirements.count;
}

private requirementsMetForUniqueProgression(achievement: Achievement): boolean {
const proof = this.proofs.get(achievement.requirements.proofId);
if (!proof) throw new Error('Proof not found');

let uniqueCount = 0;
for (const playerProof of this.proofs.values()) {
if (playerProof.id === proof.id && !this.proofs.has(playerProof.id)) uniqueCount++;
}

return uniqueCount >= achievement.requirements.uniqueCount;
}
}
