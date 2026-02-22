import { GameEngine } from "../game-engine";
import { GameBoard } from "../game-board";
import { Player } from "../player";
import { CoreRules13 } from "../core-rules-13";
import { Card, Deck } from "../card";

describe("Deterministic run engine - core-rules-13", () => {
let gameEngine: GameEngine;
let gameBoard: GameBoard;
let player1: Player;
let player2: Player;
let deck: Deck;

beforeEach(() => {
gameEngine = new GameEngine(new CoreRules13());
gameBoard = new GameBoard();
player1 = new Player("Player 1", gameBoard);
player2 = new Player("Player 2", gameBoard);
deck = new Deck();

// Initialize game state, e.g., deck and players' hands
// ...
});

it("should correctly handle a simple run", () => {
// Add cards to players' hands
// ...

// Run the game
const result = gameEngine.run(player1, player2);

expect(result).toEqual({ winner: expectedWinner, score: expectedScore });
});

it("should correctly handle a complex run", () => {
// Add cards to players' hands
// ...

// Run the game
const result = gameEngine.run(player1, player2);

expect(result).toEqual({ winner: expectedWinner, score: expectedScore });
});
});
