import crypto from 'crypto';

interface Player {
id: string;
name: string;
}

class GameServer {
private players: Map<string, Player>;

constructor() {
this.players = new Map();
}

addPlayer(player: Player) {
const hashedPlayer = this.hashPlayerData(player);
this.players.set(hashedPlayer, player);
}

updatePlayer(playerId: string, updatedPlayer: Partial<Player>) {
const player = this.players.get(playerId);

if (!player) return false;

Object.assign(player, updatedPlayer);
const hashedPlayer = this.hashPlayerData({ ...player });

if (hashedPlayer !== playerId) {
this.players.delete(playerId);
this.addPlayer({ id: hashedPlayer, name: player.name });
}

return true;
}

private hashPlayerData(player: Player): string {
return crypto.createHash('md5').update(JSON.stringify(player)).digest('hex');
}
}
