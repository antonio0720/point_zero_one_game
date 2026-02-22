import { Arbitrator } from "../arbitration";
import { Player1, Player2 } from "../../player";
import { GameState } from "../../game-state";

describe("Arbitrator", () => {
let arbitrator: Arbitrator;
let player1: Player1;
let player2: Player2;
let gameState: GameState;

beforeEach(() => {
arbitrator = new Arbitrator();
player1 = new Player1("Player1");
player2 = new Player2("Player2");
gameState = new GameState(player1, player2);
});

it("should resolve a tie", () => {
// Arrange
gameState.playRound();
gameState.playRound();
gameState.playRound();
gameState.currentScore = { [player1.name]: 3, [player2.name]: 3 };

// Act
const winner = arbitrator.resolveTie(gameState);

// Assert
expect(winner).toEqual(expect.any(Player1));
expect(winner).not.toBe(player2);
});

it("should not resolve a tie if no rounds have been played", () => {
// Act and Assert
expect(() => arbitrator.resolveTie(gameState)).toThrow();
});

it("should return the player with more points when one player has more points than the other", () => {
// Arrange
gameState.playRound();
gameState.playRound();
gameState.currentScore = { [player1.name]: 4, [player2.name]: 3 };

// Act
const winner = arbitrator.resolveTie(gameState);

// Assert
expect(winner).toEqual(expect.any(Player1));
});
});
