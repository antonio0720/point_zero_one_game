interface Badge {
id: number;
name: string;
description: string;
}

interface Achievement {
id: number;
name: string;
badges: Badge[];
}

class ProgressionService {
private badges: Badge[] = [];
private achievements: Achievement[] = [];

addBadge(badge: Badge) {
this.badges.push(badge);
}

addAchievement(achievement: Achievement) {
this.achievements.push(achievement);
}

getBadges() {
return this.badges;
}

getAchievements() {
return this.achievements;
}
}

class BadgeFactory {
private service: ProgressionService;

constructor(service: ProgressionService) {
this.service = service;
}

createBadge({ id, name, description }: Badge) {
const badge = { ...badge, id: this.generateId() };
this.service.addBadge(badge);
return badge;
}

private generateId(): number {
// Implement your unique ID generation logic here.
// For simplicity, I'm using a simple incrementing ID.
static counter = 1;
return BadgeFactory.counter++;
}
}

class AchievementFactory {
private service: ProgressionService;
private badgeFactory: BadgeFactory;

constructor(service: ProgressionService, badgeFactory: BadgeFactory) {
this.service = service;
this.badgeFactory = badgeFactory;
}

createAchievement({ id, name, badges }: Achievement) {
const achievement = { ...achievement, id: this.generateId() };
this.service.addAchievement(achievement);
return achievement;
}

private generateId(): number {
// Implement your unique ID generation logic here.
// For simplicity, I'm using a simple incrementing ID.
static counter = 1;
return AchievementFactory.counter++;
}
}
