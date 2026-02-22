import { Player } from "./player";

export class RewardsEngine {
private static instance: RewardsEngine;

private constructor() {}

public static getInstance(): RewardsEngine {
if (!RewardsEngine.instance) {
RewardsEngine.instance = new RewardsEngine();
}

return RewardsEngine.instance;
}

private pointSystem: Record<string, number> = {
EXP: 10,
GOLD: 5,
SPELL_POINTS: 3,
REPUTATION: 20,
};

public rewardPlayer(player: Player, action: string): void {
if (this.pointSystem[action]) {
player.addPoints(this.pointSystem[action]);
console.log(`Player ${player.username} received ${this.pointSystem[action]} points for ${action}`);
} else {
console.error(`Action ${action} not found in the rewards system`);
}
}

public isPlayerEligibleForReward(player: Player, action: string): boolean {
return this.pointSystem[action] !== undefined;
}
}
