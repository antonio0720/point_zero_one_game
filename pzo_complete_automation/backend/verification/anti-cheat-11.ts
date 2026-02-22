import crypto from 'crypto';
import { Player } from './Player';

class AntiCheat {
private players: Map<string, Player>;
private salt: string;

constructor(salt: string) {
this.players = new Map();
this.salt = salt;
}

addPlayer(id: string, positionX: number, positionY: number): void {
const playerHash = this.hashPosition(positionX, positionY);
const player = new Player(id, positionX, positionY, playerHash);
this.players.set(id, player);
}

updatePlayerPosition(id: string, newPositionX: number, newPositionY: number): void {
const currentPlayer = this.players.get(id);
if (!currentPlayer) return;

const oldPlayerHash = currentPlayer.playerHash;
const newPlayerHash = this.hashPosition(newPositionX, newPositionY);

if (oldPlayerHash !== newPlayerHash) {
throw new Error('Position has been tampered with');
}

currentPlayer.updatePosition(newPositionX, newPositionY);
}

private hashPosition(x: number, y: number): string {
return crypto.createHash('sha256')
.update(`${this.salt}${x}-${y}`)
.digest('hex');
}
}
