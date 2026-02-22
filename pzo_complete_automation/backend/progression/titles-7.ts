interface Achievement {
id: string;
title: string;
description: string;
}

interface Progression {
achievements: Map<string, Achievement>;
currentTitleId?: string;
titles: Map<string, string[]>;
}

const defaultAchievements: Achievement[] = [
{ id: 'achievement1', title: 'Newbie', description: 'Complete the tutorial' },
// Add more achievements as needed...
];

const defaultTitles: Map<string, string[]> = new Map([
['newbie', ['achievement1']],
['apprentice', ['achievement2', 'achievement3']],
// Add more titles and required achievements as needed...
]);

class PlayerProgression implements Progression {
achievements: Map<string, Achievement>;
currentTitleId?: string;
titles: Map<string, string[]>;

constructor() {
this.achievements = new Map(defaultAchievements.map((a) => [a.id, a]));
this.titles = defaultTitles;
}

checkAchievement(achievementId: string): boolean {
return this.achievements.has(achievementId);
}

unlockAchievement(achievementId: string) {
if (!this.checkAchievement(achievementId)) {
throw new Error(`Achievement with id ${achievementId} does not exist`);
}

this.achievements.delete(achievementId);
const currentTitle = this.getCurrentTitle();
if (this.titles.get(currentTitle)!.includes(achievementId)) {
this.advanceTitle(currentTitle);
}
}

getCurrentTitle(): string | undefined {
return this.titles.keys().next().done ? undefined : this.titles.keys().next().value;
}

advanceTitle(title: string): void {
const nextTitle = this.titles.get(title)!.slice(1);
if (nextTitle.length > 0) {
this.currentTitleId = nextTitle[0];
} else {
this.currentTitleId = undefined;
}

const achievementsToUnlock = this.titles.get(title)!;
achievementsToUnlock.forEach((achievementId) => {
if (!this.checkAchievement(achievementId)) {
this.unlockAchievement(achievementId);
}
});
}
}
