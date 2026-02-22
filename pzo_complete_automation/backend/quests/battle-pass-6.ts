interface Achievement {
id: string;
name: string;
description: string;
points: number;
}

interface Quest {
id: string;
name: string;
description: string;
reward: number;
requiredAchievements?: Achievement[];
completionCriteria: (user: User) => boolean;
}

interface BattlePass {
id: string;
name: string;
description: string;
startDate: Date;
endDate: Date;
quests: Quest[];
achievements: Achievement[];
}

interface User {
id: string;
battlePass: BattlePass | null;
achievements: Map<string, Achievement>;
quests: Map<string, Quest>;
points: number;
}

function awardAchievement(user: User, achievement: Achievement) {
if (!user.achievements.has(achievement.id)) {
user.achievements.set(achievement.id, achievement);
user.points += achievement.points;
}
}

function completeQuest(user: User, quest: Quest) {
if (quest.completionCriteria(user)) {
user.points += quest.reward;
user.quests.delete(quest.id);
}
}

const battlePass6: BattlePass = {
id: 'battle-pass-6',
name: 'Battle Pass 6',
description: 'The sixth season of the Battle Pass!',
startDate: new Date('2023-05-15'),
endDate: new Date('2023-08-31'),
quests: [
{
id: 'quest1',
name: 'Kill 100 enemies',
description: 'Eliminate 100 enemies in battle.',
reward: 50,
completionCriteria: (user) => user.points >= 50,
},
{
id: 'quest2',
name: 'Unlock achievement X',
description: 'Unlock the X achievement to complete this quest.',
reward: 100,
requiredAchievements: ['achievement-x'],
completionCriteria: (user) => user.achievements.has('achievement-x'),
},
],
achievements: [
{
id: 'achievement-x',
name: 'Achievement X',
description: 'Description for achievement X.',
points: 25,
},
],
};

const user1: User = {
id: 'user1',
battlePass: null,
achievements: new Map<string, Achievement>(),
quests: new Map<string, Quest>(),
points: 0,
};

// Award an achievement and complete a quest for the user.
awardAchievement(user1, battlePass6.achievements[0]);
completeQuest(user1, battlePass6.quests[0]);
