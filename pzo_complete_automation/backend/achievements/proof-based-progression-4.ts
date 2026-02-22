import { Player } from "./player";

interface Achievement {
id: string;
name: string;
description: string;
proofType: string;
requirements: any[]; // Custom requirement validation based on the proofType
}

interface Quest {
id: string;
name: string;
description: string;
reward: Achievement[];
requirements: any[]; // Custom requirement validation for quest completion
}

interface BattlePassTier {
tier: number;
rewards: (Achievement | Quest)[]
}

interface BattlePass {
id: string;
name: string;
tiers: BattlePassTier[];
}

class ProgressionSystem {
private players: Map<string, Player>;

constructor() {
this.players = new Map();
}

addPlayer(player: Player): void {
this.players.set(player.id, player);
}

removePlayer(playerId: string): void {
this.players.delete(playerId);
}

getPlayer(playerId: string): Player | undefined {
return this.players.get(playerId);
}

grantAchievement(player: Player, achievement: Achievement): void {
player.achievements.push(achievement);
}

completeQuest(player: Player, quest: Quest): void {
player.questsCompleted.push(quest);
this.grantAchievements(player, quest.reward);
}

progressBattlePass(player: Player, battlePass: BattlePass): void {
const currentTier = player.battlePassProgress;
if (currentTier < battlePass.tiers.length) {
player.battlePassProgress++;
this.grantRewards(player, battlePass.tiers[currentTier].rewards);
}
}

private grantAchievements(player: Player, achievements: Achievement[]): void {
for (const achievement of achievements) {
if (this.meetsRequirements(player, achievement)) {
this.grantAchievement(player, achievement);
}
}
}

private meetsRequirements(player: Player, achievement: Achievement): boolean {
// Custom requirement validation based on the proofType and requirements of the achievement
return true; // Replace this with your own logic.
}

private grantRewards(player: Player, rewards: (Achievement | Quest)[]): void {
for (const reward of rewards) {
if ("quest" in reward) {
this.completeQuest(player, reward as Quest);
} else {
this.grantAchievement(player, reward as Achievement);
}
}
}
}
