class Achievement {
id: number;
name: string;
description: string;
isCompleted: boolean;

constructor(id: number, name: string, description: string) {
this.id = id;
this.name = name;
this.description = description;
this.isCompleted = false;
}
}

class Quest {
id: number;
name: string;
description: string;
reward: any;
isCompleted: boolean;
achievementId: number;

constructor(id: number, name: string, description: string, reward: any, achievementId: number) {
this.id = id;
this.name = name;
this.description = description;
this.reward = reward;
this.isCompleted = false;
this.achievementId = achievementId;
}
}

class BattlePass {
currentTier: number;
maxTier: number;
tiers: any[];
activeQuests: Quest[];

constructor(currentTier: number, maxTier: number, tiers: any[], activeQuests: Quest[]) {
this.currentTier = currentTier;
this.maxTier = maxTier;
this.tiers = tiers;
this.activeQuests = activeQuests;
}

completeQuest(questId: number): void {
const quest = this.activeQuests.find((q) => q.id === questId);

if (quest) {
this.activeQuests = this.activeQuests.filter((q) => q.id !== questId);
quest.isCompleted = true;
const reward = quest.reward;
// Handle reward distribution here
console.log(`Congratulations! You completed ${quest.name} and received ${JSON.stringify(reward)}`);
} else {
console.log("There's no active quest with the provided ID.");
}
}

upgradeTier(): void {
if (this.currentTier < this.maxTier) {
this.currentTier++;
const currentTierData = this.tiers[this.currentTier - 1];
// Handle unlocking new quests and rewards here based on the current tier data
console.log(`You've reached Tier ${this.currentTier}. Congratulations!`);
} else {
console.log("You have already reached the maximum Battle Pass tier.");
}
}
}
