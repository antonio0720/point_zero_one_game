type Relic = {
id: number;
name: string;
description: string;
requiredAchievements:number[];
acquired: boolean;
};

type Achievement = {
id: number;
name: string;
description: string;
unlocked: boolean;
};

class Player {
achievements: Achievement[];
relics: Relic[];

constructor() {
this.achievements = [];
this.relics = [];
}

acquireAchievement(achievementId: number) {
const achievement = this.findAchievementById(achievementId);
if (!achievement || achievement.unlocked) return;

achievement.unlocked = true;
}

findRelicById(relicId: number): Relic | undefined {
return this.relics.find((relic) => relic.id === relicId);
}

findAchievementById(achievementId: number): Achievement | undefined {
return this.achievements.find((achievement) => achievement.id === achievementId);
}

acquireRelic(relicId: number) {
const relic = this.findRelicById(relicId);
if (!relic) return;

for (const requiredAchievementId of relic.requiredAchievements) {
const requiredAchievement = this.findAchievementById(requiredAchievementId);
if (!requiredAchievement || !requiredAchievement.unlocked) {
throw new Error('Missing required achievement');
}
}

relic.acquired = true;
}
}
