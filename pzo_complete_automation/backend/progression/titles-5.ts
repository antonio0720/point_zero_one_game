interface Title {
id: number;
name: string;
description: string;
}

interface Achievement {
id: number;
titleId: number;
name: string;
description: string;
points: number;
}

type Titles = Map<number, Title>;
type Achievements = Map<number, Array<Achievement>>;

class Progression {
private titles: Titles = new Map();
private achievements: Achievements = new Map();

constructor() {
this.initializeTitles();
this.initializeAchievements();
}

private initializeTitles(): void {
const title1: Title = { id: 1, name: 'Apprentice', description: 'Starting Title' };
const title2: Title = { id: 2, name: 'Journeyman', description: 'First Achievement Unlocked' };
const title3: Title = { id: 3, name: 'Expert', description: 'X Number of Achievements Unlocked' };
this.titles.set(title1.id, title1);
this.titles.set(title2.id, title2);
this.titles.set(title3.id, title3);
}

private initializeAchievements(): void {
const achievement1: Achievement = { id: 1, titleId: 1, name: 'Welcome to the Game', description: 'Complete the tutorial', points: 5 };
const achievement2: Achievement = { id: 2, titleId: 1, name: 'First Step', description: 'Reach level 5', points: 10 };
const achievement3: Achievement = { id: 3, titleId: 2, name: 'Fast Learner', description: 'Complete Level 1 in under 60 seconds', points: 15 };
this.achievements.set(title1.id, [achievement1, achievement2]);
this.achievements.set(title2.id, [achievement3]);
}

public getTitles(): Title[] {
return Array.from(this.titles.values());
}

public getAchievementsForTitle(titleId: number): Achievement[] {
const achievements = this.achievements.get(titleId);
if (!achievements) {
throw new Error('No achievements found for the given title.');
}
return achievements;
}
}
