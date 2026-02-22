enum AchievementIds {
DiscoverRelic7 = "DiscoverRelic7",
UpgradeRelic7 = "UpgradeRelic7",
FullyUpgradedRelic7 = "FullyUpgradedRelic7"
}

interface IAchievement {
id: AchievementIds;
name: string;
description: string;
isUnlocked: boolean;
}

class Achievement implements IAchievement {
constructor(public id: AchievementIds, public name: string, public description: string, public isUnlocked: boolean) {}
}

interface IProgression {
relicLevel: number;
relicPoints: number;
achievements: IAchievement[];
}

class Progression implements IProgression {
constructor(public relicLevel: number, public relicPoints: number, public achievements: IAchievement[]) {}

unlockAchievement(achievementId: AchievementIds) {
const achievement = this.achievements.find((a) => a.id === achievementId);
if (achievement) {
achievement.isUnlocked = true;
}
}

spendRelicPoints(points: number) {
if (this.relicPoints >= points) {
this.relicPoints -= points;
}
}
}

const achievements: IAchievement[] = [
new Achievement(AchievementIds.DiscoverRelic7, "Discover Relic 7", "Uncover the secrets of this powerful relic."),
new Achievement(AchievementIds.UpgradeRelic7, "Upgrade Relic 7", "Upgrade your Relic 7 to a higher level."),
new Achievement(AchievementIds.FullyUpgradedRelic7, "Fully Upgraded Relic 7", "Max out the power of your Relic 7!"),
];

const defaultProgression: IProgression = {
relicLevel: 1,
relicPoints: 0,
achievements,
};
