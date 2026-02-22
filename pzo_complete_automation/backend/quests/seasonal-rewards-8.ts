interface Achievement {
id: number;
name: string;
description: string;
}

interface Quest {
id: number;
name: string;
description: string;
reward: any;
progress: number;
completed: boolean;
}

interface BattlePass {
tier: number;
rewards: Array<{ item: any; unlockAtTier: number }>;
}

type SeasonalRewards = {
achievements: Array<Achievement>;
quests: Array<Quest>;
battlePass: BattlePass;
};

const seasonalRewards8: SeasonalRewards = {
achievements: [
{ id: 1, name: 'Ice Breaker', description: 'Destroy 500 enemy structures in Winter Wonderland event.' },
// Add more achievements here...
],
quests: [
{
id: 1,
name: 'Frostbite Frenzy',
description: 'Earn 3 victories in the Frostbite Arena during the Winter Wonderland event.',
reward: { item: 'Frostbite Trophy', unlockAtTier: 0 },
progress: 0,
completed: false,
},
// Add more quests here...
],
battlePass: {
tier: 1,
rewards: [
{ item: 'Frostbite Emote', unlockAtTier: 1 },
{ item: 'Cool Ice Glider Skin', unlockAtTier: 5 },
// Add more rewards here...
],
},
};
