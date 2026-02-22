import { Game } from './Game'; // Import the Game class

// Stress test configurations
const numPlayers = 100;
const iterations = 10000;
const gameWidth = 800;
const gameHeight = 600;

function stressTest(numPlayers: number, iterations: number) {
console.time(`Stress Test - ${numPlayers} Players`);

const games: Game[] = Array.from({ length: numPlayers }, () => new Game(gameWidth, gameHeight));

for (let i = 0; i < iterations; i++) {
games.forEach((game) => game.update());
}

console.timeEnd(`Stress Test - ${numPlayers} Players`);
}

// Run the stress test with the specified configurations
stressTest(numPlayers, iterations);
