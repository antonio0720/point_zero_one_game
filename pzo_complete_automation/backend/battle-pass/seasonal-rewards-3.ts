class SeasonalRewards3 {
private achievements: Map<string, boolean> = new Map();
private quests: Map<string, boolean> = new Map();
private battlePass: Map<number, Reward> = new Map();

constructor(private rewards: Array<{ achievement: string; reward: Reward }>, private questsData: Array<{ id: string; reward: Reward }>, private battlePassData: Array<{ tier: number; reward: Reward }>) {
this.rewards.forEach(({ achievement, reward }) => {
this.achievements.set(achievement, false);
});

this.questsData.forEach(({ id, reward }) => {
this.quests.set(id, false);
});

this.battlePassData.forEach(({ tier, reward }) => {
this.battlePass.set(tier, reward);
});
}

claimReward(type: 'achievement' | 'quest' | 'battlePass', idOrTier?: string | number) {
if (type === 'achievement') {
const achievement = this.achievements.get(idOrTier);
if (!achievement) return null;

this.achievements.set(idOrTier, true);
return this.rewards.find(({ achievement }) => achievement === idOrTier).reward;
} else if (type === 'quest') {
const quest = this.quests.get(idOrTier);
if (!quest) return null;

this.quests.set(idOrTier, true);
return this.questsData.find(({ id }) => id === idOrTier).reward;
} else if (type === 'battlePass') {
const battlePassReward = this.battlePass.get(idOrTier as number);
if (!battlePassReward) return null;

// Implement logic to deduct Battle Pass points or levels

return battlePassReward;
}
}
}

interface Reward {
type: string;
value?: any;
}
