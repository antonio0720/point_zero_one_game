import { Observable } from 'rxjs';

class Player {
id: number;
name: string;
connection: any; // Replace this with the actual connection object

constructor(id: number, name: string, connection: any) {
this.id = id;
this.name = name;
this.connection = connection;
}
}

class GameServer {
private players: Map<number, Player> = new Map();
private games: Map<number, Game> = new Map();

public addPlayer(player: Player) {
this.players.set(player.id, player);
}

public removePlayer(playerId: number): void {
const player = this.players.get(playerId);
if (player) {
this.players.delete(playerId);
player.connection.close(); // Close the connection when a player leaves
}
}

public startMatch(): Game {
const players = Array.from(this.players.values());
if (players.length < 2) return null;

const game = new Game(this);
this.games.set(game.id, game);
game.start();

// Notify all players about the new game
for (const player of players) {
player.connection.send(`New match started with game ID: ${game.id}`);
}

return game;
}
}

class Game {
id: number;
server: GameServer;
players: Player[];

constructor(server: GameServer) {
this.server = server;
this.players = [];
this.id = Math.floor(Math.random() * 100000); // Generate unique game ID
}

start(): void {
// Start the game logic here
console.log(`Game started with ID: ${this.id}`);
}
}
