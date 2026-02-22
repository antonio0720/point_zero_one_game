import { Game } from "./game";
import { Player } from "./player";
import { Unit } from "./unit";
import { MapGenerator } from "./map-generator";

const MAX_PLAYERS = 10;
const MAX_TURNS = 100;

function runStressTest(playersCount: number, mapSize: number) {
console.log(`Running stress test with ${playersCount} players and a ${mapSize}x${mapSize} map...`);

const mapGenerator = new MapGenerator(mapSize);
const map = mapGenerator.generate();
const game = new Game(map, MAX_TURNS);

const players: Player[] = [];

for (let i = 0; i < playersCount; ++i) {
players.push(new Player(`Player${i + 1}`));
}

game.addPlayers(players);

game.start();
}

// Example runs:
runStressTest(MAX_PLAYERS, 20);
