interface Relic {
id: number;
name: string;
acquisitionCost: number;
}

class Player {
private relics: Relic[] = [];
private gold: number = 0;

acquireRelic(relic: Relic) {
if (this.gold >= relic.acquisitionCost) {
this.relics.push(relic);
this.gold -= relic.acquisitionCost;
}
}

addGold(amount: number) {
this.gold += amount;
}

getRelicProgression() {
const progression = {};

for (const relic of this.relics) {
if (!progression[relic.id]) {
progression[relic.id] = { acquired: false, progress: 0 };
}

progression[relic.id].acquired = true;
progression[relic.id].progress++;
}

return progression;
}
}
