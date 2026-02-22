import { Injectable } from '@nestjs/common';

@Injectable()
export class BattlePassService {
private battlePass: any = {};
private quests: any[] = [];
private achievements: any[] = [];

constructor() {
// Initialize battle pass, quests and achievements data here.
}

async getBattlePass() {
return this.battlePass;
}

async getQuests() {
return this.quests;
}

async getAchievements() {
return this.achievements;
}

async addQuest(quest: any) {
this.quests.push(quest);
}

async addAchievement(achievement: any) {
this.achievements.push(achievement);
}
}
