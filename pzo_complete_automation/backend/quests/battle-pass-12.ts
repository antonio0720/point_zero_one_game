interface User {
id: string;
username: string;
level: number;
experience: number;
achievements: Achievement[];
quests: Quest[];
}

enum AchievementType {
FirstWin,
LevelUp10,
OneMillionCoins
}

interface Achievement {
type: AchievementType;
completed: boolean;
}

enum QuestType {
DefeatEnemies,
CompletePuzzles,
GatherResources,
FirstWin,
LevelUp5,
WinThreeMatches
}

interface Quest {
type: QuestType;
progress: number;
objective: number;
completed: boolean;
}

type Reward = {
coins: number;
experience: number;
cosmeticItem?: string;
};

const battlePass = (user: User): User => {
const levelUp = (user: User) => {
if (user.experience >= 100) {
user.level++;
user.experience -= 100;
return { ...user, achievements: [...user.achievements, { type: AchievementType.LevelUp10, completed: true }] };
} else {
return user;
}
};

const awardRewards = (rewards: Reward) => ({ ...user, experience: user.experience + rewards.experience, coins: user.coins + rewards.coins });

// Initial achievements and quests
const initialUser: User = {
id: 'user-id',
username: 'username',
level: 1,
experience: 0,
achievements: [
{ type: AchievementType.FirstWin, completed: false },
{ type: AchievementType.LevelUp10, completed: false },
{ type: AchievementType.OneMillionCoins, completed: false }
],
quests: [
{ type: QuestType.DefeatEnemies, progress: 0, objective: 50, completed: false },
{ type: QuestType.CompletePuzzles, progress: 0, objective: 10, completed: false },
{ type: QuestType.GatherResources, progress: 0, objective: 200, completed: false },
{ type: QuestType.FirstWin, progress: 0, objective: 1, completed: false },
{ type: QuestType.LevelUp5, progress: 0, objective: 5, completed: false },
{ type: QuestType.WinThreeMatches, progress: 0, objective: 3, completed: false }
]
};

// Battle Pass rewards for each level
const battlePassRewards = [
{ coins: 100, experience: 50 },
{ coins: 200, experience: 100 },
{ coins: 300, experience: 150 },
{ coins: 400, experience: 200 },
{ coins: 500, experience: 250 },
{ coins: 600, experience: 300 },
{ coins: 700, experience: 350 },
{ coins: 800, experience: 400 },
{ coins: 900, experience: 450 },
{ coins: 1000, experience: 500 },
{ coins: 1200, experience: 600 },
{ coins: 1400, experience: 700 }
];

// Function to update quest progress
const updateQuestProgress = (user: User, quest: Quest) => {
if (quest.type === QuestType.DefeatEnemies || quest.type === QuestType.CompletePuzzles || quest.type === QuestType.GatherResources) {
return { ...user, quests: user.quests.map(uq => uq.id === quest.id ? { ...quest, progress: uq.progress + 1 } : uq) };
} else if (quest.type === QuestType.FirstWin && user.achievements[0].completed) {
return { ...user, quests: user.quests.map(uq => uq.id === quest.id ? { ...quest, completed: true } : uq) };
} else if (quest.type === QuestType.LevelUp5 && user.level >= 5) {
return { ...user, quests: user.quests.map(uq => uq.id === quest.id ? { ...quest, completed: true } : uq) };
} else if (quest.type === QuestType.WinThreeMatches) {
const wins = user.quests.filter(uq => uq.type === QuestType.FirstWin).map(uq => uq.objective);
if (wins.length >= 3) {
return { ...user, quests: user.quests.map(uq => uq.id === quest.id ? { ...quest, completed: true } : uq) };
} else {
return user;
}
}
return user;
};

// Function to update user's achievements and quests when they level up
const updateAchievementsAndQuests = (user: User): User => {
const leveledUser = levelUp(user);

leveledUser.quests = leveledUser.quests.map((quest) => {
if (!quest.completed && quest.type !== QuestType.WinThreeMatches) {
return updateQuestProgress(leveledUser, quest);
} else {
return quest;
}
});

leveledUser.achievements = leveledUser.achievements.map((achievement) => {
if (achievement.type === AchievementType.FirstWin && user.quests.some(q => q.type === QuestType.FirstWin)) {
return { ...achievement, completed: true };
} else if (achievement.type === AchievementType.LevelUp10) {
return achievement; // Level Up 10 is already awarded with level up
} else if (achievement.type === AchievementType.OneMillionCoins && user.coins >= 1_000_000) {
return { ...achievement, completed: true };
} else {
return achievement;
}
});

const rewards = battlePassRewards[leveledUser.level - 1];
return awardRewards(leveledUser);
};

// Function to perform all the updates in a single transaction (you'd want to use database transactions in production)
const updateUser = (user: User, action?: (user: User) => User): User => {
return action ? updateUser(action(user), updateAchievementsAndQuests) : updateAchievementsAndQuests(user);
};

// Initializing the user with some progress
let user = initialUser;
for (let i = 1; i <= 50; i++) {
user = updateUser(user, updateQuestProgress)(user);
}

return user;
};
