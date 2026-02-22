import { Achievement, Quest, BattlePass } from './interfaces';

interface Player {
id: string;
achievements: Map<string, boolean>;
quests: Map<string, Quest>;
battlePass: BattlePass;
}

interface Game {
players: Map<string, Player>;
currentTime: number;

addPlayer(player: Player): void;
updateTime(timeDelta: number): void;

scheduleQuests(): void;
completeQuest(playerId: string, questId: string): void;
unlockAchievement(playerId: string, achievementId: string): void;
}

interface Interface {
Achievement: typeof Achievement;
Quest: typeof Quest;
BattlePass: typeof BattlePass;
}

const interfaces: Interface = {
Achievement: require('./interfaces/Achievement').default,
Quest: require('./interfaces/Quest').default,
BattlePass: require('./interfaces/BattlePass').default,
};

class GameImplementation implements Game {
players: Map<string, Player>;
currentTime: number;

constructor() {
this.players = new Map();
this.currentTime = 0;
}

addPlayer(player: Player): void {
this.players.set(player.id, player);
}

updateTime(timeDelta: number): void {
this.currentTime += timeDelta;
this.scheduleQuests();
}

scheduleQuests(): void {
for (const [playerId, player] of this.players) {
const quests = Array.from(player.quests.values());

for (let i = 0; i < quests.length; ++i) {
const quest = quests[i];

if (!quest.isCompleted && this.currentTime >= quest.startTime && this.currentTime <= quest.endTime) {
console.log(`Scheduled Quest ${quest.id} for player ${playerId}`);
player.battlePass.addXP(quest.rewardXP);
}
}
}
}

completeQuest(playerId: string, questId: string): void {
const player = this.players.get(playerId) as Player;
const quest = player.quests.get(questId);

if (quest && !quest.isCompleted) {
quest.complete();
console.log(`Completed Quest ${questId} for player ${playerId}`);
this.unlockAchievement(playerId, quest.achievementId);
} else {
console.log(`Quest ${questId} not found or already completed for player ${playerId}`);
}
}

unlockAchievement(playerId: string, achievementId: string): void {
const player = this.players.get(playerId) as Player;

if (player.achievements.get(achievementId) === undefined) {
player.achievements.set(achievementId, true);
console.log(`Unlocked Achievement ${achievementId} for player ${playerId}`);
} else {
console.log(`Achievement ${achievementId} already unlocked for player ${playerId}`);
}
}
}

const game = new GameImplementation();

// Example of adding a player and updating the time
game.addPlayer({
id: '123',
achievements: new Map<string, boolean>(),
quests: new Map<string, Quest>(),
battlePass: interfaces.BattlePass(),
});

game.updateTime(60 * 60 * 24); // update the time by one day (86400 seconds)
