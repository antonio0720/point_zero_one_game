import * as assert from 'assert';
import * as math from 'mathjs';

interface Player {
name: string;
strategy: (state: number[]) => number[];
}

const players: Player[] = [
{ name: 'Player 1', strategy: strategy1 },
{ name: 'Player 2', strategy: strategy2 },
];

function playGame(player1Strategy: (state: number[]) => number[], player2Strategy: (state: number[]) => number[]): number[] {
const state = [0, 0, 11]; // Initial state: Player 1 has 0 dollars, Player 2 has 0 dollars, and the dice roll is 11.

for (let roll = 11; roll > 2 && state[0] < 6 && state[1] < 6; roll = math.rollDice(6).reduce((a, b) => a + b)) {
const player1Action = player1Strategy(state);
const player2Action = player2Strategy(state);

// Update the game state based on actions and dice roll result.
state[0] += player1Action[0];
state[1] += player1Action[1];
state[2] -= roll;

if (state[2] <= 0) break;

state[0] -= player2Action[0];
state[1] -= player2Action[1];
state[2] += roll;
}

// The game ends when one player has more than 6 dollars or the dice total is less than or equal to 2.
return state.map((value, index) => index === 2 ? (state[index] <= 0 ? 1 : 0) : value);
}

function strategy1(state: number[]): [number, number] {
// Your custom strategy for Player 1 goes here.
return [Math.floor(state[0] / 3), Math.floor((state[2] * 5) / 6)];
}

function strategy2(state: number[]): [number, number] {
// Your custom strategy for Player 2 goes here.
return [Math.floor(state[1] / 3), Math.floor((state[2] * 5) / 6)];
}

// Helper function to simulate multiple games and calculate statistics.
function simulateGames(numGames: number, player1Strategy: (state: number[]) => number[], player2Strategy: (state: number[]) => number[]): { wins: number; ties: number } {
const results = Array(numGames).fill(0).map(() => playGame(player1Strategy, player2Strategy));
let wins = 0;
let ties = 0;

for (const result of results) {
if (result[0] === 1 && result[1] === 0) wins++;
else if (result[0] === 0 && result[1] === 1) wins++;
else ties++;
}

return { wins, ties };
}

// Test your strategies against each other.
const simulationResults = simulateGames(10000, strategy1, strategy2);
console.log(`Simulation results: Player 1 wins ${simulationResults.wins} games and ties ${simulationResults.ties} games.`);
