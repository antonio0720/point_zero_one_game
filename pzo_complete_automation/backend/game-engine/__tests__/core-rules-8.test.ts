import { GameEngine, Player, Move, Game, Rule } from '../game-engine';
import { CoreRules8 } from '../rules/core-rules-8';
import { Random } from 'random-js';

describe('Deterministic run engine - core-rules-8', () => {
const rng = new Random();
const engine = new GameEngine(new CoreRules8(), rng);

describe('Given an initial game state', () => {
let player1: Player;
let player2: Player;
let game: Game;

beforeEach(() => {
player1 = new Player('Player 1');
player2 = new Player('Player 2');
const board = Array(9).fill(null).map((_, i) => i + 1);
game = new Game(board, [player1, player2], engine);
});

it('should determine the winner correctly', () => {
// Test winning scenarios for each player horizontally, vertically, and diagonally
// Add test cases as needed to cover all possibilities

// Horizontal win for Player 1
game.makeMove(player1, 0);
game.makeMove(player1, 1);
game.makeMove(player1, 2);
expect(game.winner).toBe(player1);

// Vertical win for Player 1
game.reset();
game.makeMove(player1, 3);
game.makeMove(player1, 6);
game.makeMove(player1, 9);
expect(game.winner).toBe(player1);

// Diagonal win for Player 1 (positive slope)
game.reset();
game.makeMove(player1, 0);
game.makeMove(player1, 4);
game.makeMove(player1, 8);
expect(game.winner).toBe(player1);

// Diagonal win for Player 1 (negative slope)
game.reset();
game.makeMove(player1, 2);
game.makeMove(player1, 4);
game.makeMove(player1, 6);
expect(game.winner).toBe(player1);

// Horizontal win for Player 2
game.reset();
game.makeMove(player2, 5);
game.makeMove(player2, 4);
game.makeMove(player2, 3);
expect(game.winner).toBe(player2);

// Vertical win for Player 2
game.reset();
game.makeMove(player2, 1);
game.makeMove(player2, 4);
game.makeMove(player2, 7);
expect(game.winner).toBe(player2);

// Diagonal win for Player 2 (positive slope)
game.reset();
game.makeMove(player2, 5);
game.makeMove(player2, 3);
game.makeMove(player2, 7);
expect(game.winner).toBe(player2);

// Diagonal win for Player 2 (negative slope)
game.reset();
game.makeMove(player2, 7);
game.makeMove(player2, 5);
game.makeMove(player2, 3);
expect(game.winner).toBe(player2);
});

it('should determine a draw correctly', () => {
// Test for draw scenarios when all squares are filled without a winner
const maxMoves = 9;
for (let i = 0; i < maxMoves; i++) {
game.makeMove(player1, Math.floor(rng.integer(0, 8)));
if (game.winner || !game.isPlayable()) break;
}
expect(game.winner).toBeUndefined();

// Test for draw scenarios when players alternate moves until a square is filled twice
game.reset();
let moveCount = 0;
while (!game.isDraw() && moveCount < maxMoves * 2) {
const playerIndex = moveCount % 2;
const move = Math.floor(rng.integer(0, 9));
if (moveCount > 1 && game.board[move] !== null && game.board[move] === playerIndex + 1) break;
game.makeMove(playerIndex >= 1 ? player1 : player2, move);
moveCount++;
}
expect(game.winner).toBeUndefined();
});
});
});
