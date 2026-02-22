import { GameManager } from './game-manager';
import { Player, Move } from './entities';

const NUM_GAMES = 1000;
const NUM_TURNS_PER_GAME = 10000;

function runStressTest() {
const players: Player[] = Array.from({ length: NUM_GAMES }, () => new Player('Player'));
const games: GameManager[] = Array.from({ length: NUM_GAMES }, () => new GameManager(players));

for (let turn = 0; turn < NUM_TURNS_PER_GAME; turn++) {
games.forEach((game) => game.processTurn());
}
}

runStressTest();
