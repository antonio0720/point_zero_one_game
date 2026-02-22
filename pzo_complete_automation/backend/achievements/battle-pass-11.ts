import { Achievement, Quest } from './achievement';
import { User } from '../user';

enum BattlePassLevel {
FREE = 1,
BRONZE = 2,
SILVER = 3,
GOLD = 4,
DIAMOND = 5,
}

interface BattlePassTier {
level: BattlePassLevel;
rewards: string[];
quests: Quest[];
achievements: Achievement[];
cost: number;
}

class BattlePass {
private tiers: BattlePassTier[] = [
// Define the tiers with their respective levels, rewards, quests, and achievements.
{
level: BattlePassLevel.BRONZE,
rewards: ['Reward 1', 'Reward 2'],
quests: [
new Quest('Quest 1', 50),
new Quest('Quest 2', 100),
],
achievements: [
new Achievement('Achievement 1', 10),
new Achievement('Achievement 2', 20),
],
cost: 500,
},
// Add more tiers as necessary.
];

private user: User;
private currentTierIndex: number = 0;
private xp: number = 0;

constructor(user: User) {
this.user = user;
}

public purchase(amount: number): void {
if (this.currentTierIndex < this.tiers.length - 1 && amount >= this.tiers[this.currentTierIndex].cost) {
this.user.spendCoins(this.tiers[this.currentTierIndex].cost);
this.levelUp();
} else if (amount < this.tiers[this.currentTierIndex].cost) {
console.log('Insufficient funds.');
}
}

private levelUp(): void {
while (this.xp >= this.tiers[this.currentTierIndex + 1].xpRequirementsToLevelUp()) {
this.xp -= this.tiers[this.currentTierIndex + 1].xpRequirementsToLevelUp();
this.currentTierIndex++;
}
}

public completeQuest(quest: Quest): void {
const questIndex = this.tiers[this.currentTierIndex].quests.findIndex((q) => q.id === quest.id);
if (questIndex !== -1) {
this.tiers[this.currentTierIndex].quests[questIndex].complete();
this.gainXP(quest.xpReward);
}
}

public completeAchievement(achievement: Achievement): void {
const achievementIndex = this.tiers[this.currentTierIndex].achievements.findIndex((a) => a.id === achievement.id);
if (achievementIndex !== -1) {
this.tiers[this.currentTierIndex].achievements[achievementIndex].complete();
this.gainXP(achievement.xpReward);
}
}

private gainXP(amount: number): void {
this.xp += amount;
if (this.xp >= this.tiers[this.currentTierIndex + 1].xpRequirementsToLevelUp()) {
this.levelUp();
}
}

private BattlePassTier.prototype.xpRequirementsToLevelUp = function (): number {
if (this.level === BattlePassLevel.FREE) return 0;

const multiplier = this.level === BattlePassLevel.BRONZE ? 1 : this.level * 2 - 3;
return Math.pow(10, multiplier);
};
}
