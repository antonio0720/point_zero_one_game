import { Quest } from './quest';
import { BattlePass } from './battle-pass';
import moment = require('moment');

interface ScheduledQuest {
quest: Quest;
startTime: moment.Moment;
endTime: moment.Moment;
}

class QuestScheduler {
private battlePass: BattlePass;
private scheduledQuests: ScheduledQuest[] = [];

constructor(battlePass: BattlePass) {
this.battlePass = battlePass;
}

public scheduleQuest(quest: Quest, startTime: moment.Moment, endTime: moment.Moment): void {
if (this.overlapsWithScheduledQuests(startTime, endTime)) {
throw new Error('Cannot schedule a quest that overlaps with other scheduled quests.');
}

this.scheduledQuests.push({ quest, startTime, endTime });
}

public getScheduledQuestAtIndex(index: number): Quest | null {
return index >= 0 && index < this.scheduledQuests.length ? this.scheduledQuests[index].quest : null;
}

public getScheduledQuests(): ScheduledQuest[] {
return [...this.scheduledQuests];
}

private overlapsWithScheduledQuests(startTime: moment.Moment, endTime: moment.Moment): boolean {
const currentQuests = this.getScheduledQuests();

for (const quest of currentQuests) {
if (quest.endTime >= startTime && quest.startTime <= endTime) {
return true;
}
}

return false;
}
}
