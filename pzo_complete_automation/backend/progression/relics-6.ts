interface Achievement {
id: string;
name: string;
description: string;
requirements: any[]; // Replace with a specific type if you know the requirement format
}

class RelicProgression {
private relics: Map<string, number>;
private achievements: Map<string, Achievement>;

constructor() {
this.relics = new Map();
this.achievements = new Map();

// Add predefined relics and their initial quantities
this.relics.set("Relic1", 0);
this.relics.set("Relic2", 0);
this.relics.set("Relic3", 0);

// Add predefined achievements and their requirements
const achievement1: Achievement = {
id: "Achievement1",
name: "First Relic",
description: "Collect your first relic.",
requirements: [
{ relicId: "Relic1", quantity: 1 },
],
};

const achievement2: Achievement = {
id: "Achievement2",
name: "Complete Collection",
description: "Collect all relics.",
requirements: [
{ relicId: "Relic1", quantity: 5 }, // Replace with the actual quantity needed to unlock this achievement
{ relicId: "Relic2", quantity: 5 },
{ relicId: "Relic3", quantity: 5 },
],
};

this.achievements.set(achievement1.id, achievement1);
this.achievements.set(achievement2.id, achievement2);
}

addRelic(relicId: string, quantity: number): void {
this.relics.set(relicId, (this.relics.get(relicId) || 0) + quantity);
this.checkAchievements();
}

private checkAchievements(): void {
for (const [achievementId, achievement] of this.achievements.entries()) {
let unlocked = true;
for (const requirement of achievement.requirements) {
if (!this.relics.get(requirement.relicId) || this.relics.get(requirement.relicId) < requirement.quantity) {
unlocked = false;
break;
}
}

if (unlocked) {
console.log(`Congratulations! You unlocked achievement ${achievementId}`);
}
}
}
}
