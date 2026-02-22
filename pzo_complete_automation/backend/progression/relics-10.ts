import { Relic } from './Relic';
import { Player } from './Player';
import { Achievement } from './Achievement';

class ProgressionSystem {
private relics: Map<number, Relic> = new Map();
private players: Map<string, Player> = new Map();
private achievements: Array<Achievement> = [];

addRelic(id: number, name: string, acquisitionCost: number) {
this.relics.set(id, new Relic(id, name, acquisitionCost));
}

addPlayer(name: string): Player {
const player = new Player(name);
this.players.set(name, player);
return player;
}

addAchievement(name: string, criteria: (player: Player) => boolean) {
this.achievements.push(new Achievement(name, criteria));
}

acquireRelic(player: Player, relicId: number): void {
const relic = this.relics.get(relicId);
if (!relic) return;

if (player.gold >= relic.acquisitionCost) {
player.spendGold(relic.acquisitionCost);
player.addRelic(relic);
}
}

checkAchievements(player: Player): Array<string> {
return this.achievements
.filter((achievement) => achievement.criteria(player))
.map((achievement) => achievement.name);
}
}

export default ProgressionSystem;

// Example usage:
const progression = new ProgressionSystem();
progression.addRelic(1, 'Relic of Strength', 100);
progression.addPlayer('John');
progression.acquireRelic(progression.players.get('John')!, 1);
const johnsAchievements = progression.checkAchievements(progression.players.get('John')!);
console.log(johnsAchievements); // Output: ['Relic of Strength']
