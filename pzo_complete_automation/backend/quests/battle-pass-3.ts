interface User {
id: number;
username: string;
battlePassLevel: number;
battlePassXP: number;
}

interface Achievement {
id: number;
title: string;
description: string;
rewardXP: number;
}

interface Quest {
id: number;
title: string;
description: string;
requiredAchievements: Achievement[];
rewardXP: number;
}

class BattlePass {
users: User[];
achievements: Achievement[];
quests: Quest[];

constructor() {
this.users = [];
this.achievements = [
// ... list of achievements here
];
this.quests = [
// ... list of quests here
];
}

addUser(username: string): void {
const user = { id: Date.now(), username, battlePassLevel: 1, battlePassXP: 0 };
this.users.push(user);
}

updateUserProgress(userId: number, xp: number): void {
const user = this.users.find((u) => u.id === userId);
if (user) {
user.battlePassXP += xp;
const nextLevelXP = this.calculateNextLevelXP(user.battlePassLevel);
if (user.battlePassXP >= nextLevelXP) {
user.battlePassLevel++;
user.battlePassXP -= nextLevelXP;
}
}
}

calculateNextLevelXP(currentLevel: number): number {
// Calculate the XP required for the next level (e.g., linear progression)
return Math.pow(2, currentLevel + 1) - Math.pow(2, currentLevel);
}

completeAchievement(userId: number, achievementId: number): void {
const user = this.users.find((u) => u.id === userId);
if (user) {
const achievement = this.achievements.find((a) => a.id === achievementId);
if (achievement) {
user.battlePassXP += achievement.rewardXP;
achievement.completedBy.push(userId);
}
}
}

completeQuest(userId: number, questId: number): void {
const user = this.users.find((u) => u.id === userId);
if (user) {
const quest = this.quests.find((q) => q.id === questId);
if (quest) {
let completedAchievementsCount = 0;
for (const requiredAchievement of quest.requiredAchievements) {
if (user.achievementsCompleted.includes(requiredAchievement.id)) {
completedAchievementsCount++;
}
}
if (completedAchievementsCount === quest.requiredAchievements.length) {
user.battlePassXP += quest.rewardXP;
user.questsCompleted.push(questId);
}
}
}
}
}
