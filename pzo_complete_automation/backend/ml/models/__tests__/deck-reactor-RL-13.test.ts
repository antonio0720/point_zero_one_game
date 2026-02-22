import { deckReactorRL_13 } from '../deck-reactor-RL-13';
import { describe, it, expect } from '@jest/globals';
import { RandomGenerator } from '../../random-generator';

let model: ReturnType<typeof deckReactorRL_13>;
let randomGenerator: RandomGenerator;

beforeAll(() => {
// Initialize the model and random generator here
model = deckReactorRL_13();
randomGenerator = new RandomGenerator();
});

describe('deck-reactor-RL-13', () => {
it('should correctly initialize', () => {
expect(model).toBeDefined();
expect(randomGenerator).toBeDefined();
});

// Add more test cases here to test the different functionalities of the model

});
