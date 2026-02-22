interface Relic {
id: string;
name: string;
description: string;
baseLevel: number;
maxLevel: number;
experienceRequiredPerLevel: number[];
}

class Player {
relics: Map<string, Relic>;

constructor() {
this.relics = new Map();
}

addRelic(relic: Relic) {
if (!this.relics.has(relic.id)) {
this.relics.set(relic.id, relic);
}
}

levelUpRelic(relicId: string) {
const relic = this.relics.get(relicId);
if (relic && relic.level < relic.maxLevel) {
const currentXP = relic.experience;
const nextLevelXP = relic.experienceRequiredPerLevel[relic.level];

if (currentXP >= nextLevelXP) {
relic.level++;
this.updateRelicExperience(relicId, nextLevelXP);
}
}
}

updateRelicExperience(relicId: string, experience: number) {
const relic = this.relics.get(relicId);
if (relic) {
relic.experience += experience;
}
}
}

// Example Relics
const exampleRelics: Relic[] = [
{
id: 'example-relic-1',
name: 'Example Relic 1',
description: 'An example relic.',
baseLevel: 1,
maxLevel: 5,
experienceRequiredPerLevel: [10, 20, 35, 60, 100],
},
// Add more relics as needed...
];

// Initialize Player and add example relics
const player = new Player();
exampleRelics.forEach((relic) => {
player.addRelic(relic);
});
