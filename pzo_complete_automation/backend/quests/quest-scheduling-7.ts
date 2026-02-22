import { Achievement, Quest, BattlePass } from './dataStructures';

class QuestScheduler {
private quests: Map<string, Quest> = new Map();
private battlePasses: Map<string, BattlePass> = new Map();

public addQuest(id: string, quest: Quest): void {
this.quests.set(id, quest);
}

public addBattlePass(id: string, battlePass: BattlePass): void {
this.battlePasses.set(id, battlePass);
}

public getQuest(id: string): Quest | undefined {
return this.quests.get(id);
}

public getBattlePass(id: string): BattlePass | undefined {
return this.battlePasses.get(id);
}

public scheduleQuests(): void {
const scheduledQuests: Quest[] = [];

for (const quest of this.quests.values()) {
if (quest.canStart()) {
scheduledQuests.push(quest);
}
}

// Sort quests by startTime, earlier quests first
scheduledQuests.sort((a, b) => a.startTime - b.startTime);

scheduledQuests.forEach((quest) => {
console.log(`Starting quest: ${quest.id}`);
// Perform quest logic here
});
}

public scheduleBattlePass(): void {
const battlePass = this.getBattlePass('default');

if (!battlePass) {
console.error("No Battle Pass found");
return;
}

if (battlePass.canStart()) {
console.log(`Starting Battle Pass: ${battlePass.id}`);
// Perform Battle Pass logic here
} else {
console.log(`Battle Pass not yet available`);
}
}
}
