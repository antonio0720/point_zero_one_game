import { Achievement, Quest, BattlePass } from './interfaces';

class ProofBasedProgressionSystem {
achievements: Map<string, Achievement>;
quests: Map<string, Quest>;
battlePass: BattlePass;

constructor() {
this.achievements = new Map();
this.quests = new Map();
this.battlePass = new BattlePass();
}

addAchievement(id: string, achievement: Achievement) {
this.achievements.set(id, achievement);
}

addQuest(id: string, quest: Quest) {
this.quests.set(id, quest);
}

addBattlePass(battlePass: BattlePass) {
this.battlePass = battlePass;
}

completeAchievement(playerId: string, achievementId: string, proof: any): void {
const achievement = this.achievements.get(achievementId);

if (achievement) {
achievement.complete(playerId, proof);
} else {
console.error(`No such achievement with ID ${achievementId}`);
}
}

completeQuest(playerId: string, questId: string, proof: any): void {
const quest = this.quests.get(questId);

if (quest) {
quest.complete(playerId, proof);
} else {
console.error(`No such quest with ID ${questId}`);
}
}

updateBattlePass(playerId: string, progress: any): void {
this.battlePass.update(playerId, progress);
}
}
