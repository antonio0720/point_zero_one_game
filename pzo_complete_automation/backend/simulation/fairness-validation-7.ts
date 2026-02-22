import { expect } from 'chai';
import { describe, it } from 'mocha';
import { Game, Player } from './game';

class GameFairnessValidator {
private game: Game;

constructor(numPlayers: number, numRounds: number) {
this.game = new Game(numPlayers);
this.game.setNumRounds(numRounds);
}

public validateFairness() {
const scores = this.game.playGame();
let totalSum = scores.reduce((acc, cur) => acc + cur, 0);

for (let playerScore of scores) {
const avgScore = totalSum / this.game.numPlayers;
const diff = Math.abs(playerScore - avgScore);

if (diff > 1) {
throw new Error(`Fairness violation: Player's score is too far from the average. Score: ${playerScore}, Average: ${avgScore}`);
}
}
}
}

describe('Game Simulation', () => {
it('should validate fairness', () => {
const validator = new GameFairnessValidator(4, 1000);
validator.validateFairness();
});
});
