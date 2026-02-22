type UserID = string;

interface Proof {
id: number;
userID: UserID;
type: string;
timestamp: Date;
}

interface Achievement {
id: number;
name: string;
description: string;
proofRequirements: Proof[];
currentProgress: number;
isCompleted: boolean;
}

interface Quest {
id: number;
name: string;
description: string;
reward: any;
proofRequirements: Proof[];
status: 'active' | 'completed';
}

interface BattlePass {
seasonID: number;
startDate: Date;
endDate: Date;
rewards: any[];
currentProgress: number;
isActive: boolean;
proofRequirements: Proof[];
}

class User {
id: UserID;
achievements: Achievement[];
quests: Quest[];
battlePasses: BattlePass[];
proofs: Proof[];

constructor(id: UserID) {
this.id = id;
this.achievements = [];
this.quests = [];
this.battlePasses = [];
this.proofs = [];
}

addProof(proof: Proof) {
this.proofs.push(proof);
this.updateProgressions();
}

updateProgressions() {
this.achievements.forEach((achievement) => {
let progress = 0;
achievement.proofRequirements.forEach((reqProof) => {
if (this.proofs.includes(reqProof)) {
progress++;
}
});
achievement.currentProgress = progress;
achievement.isCompleted = progress === achievement.proofRequirements.length;
});

this.quests.forEach((quest) => {
let proofsMet = quest.proofRequirements.every((reqProof) =>
this.proofs.includes(reqProof)
);
if (proofsMet) {
quest.status = 'completed';
// apply the reward
}
});

this.battlePasses.forEach((battlePass) => {
let progress = 0;
battlePass.proofRequirements.forEach((reqProof) => {
if (this.proofs.includes(reqProof)) {
progress++;
}
});
battlePass.currentProgress = progress;
// check if the battle pass is completed and apply rewards
});
}
}
