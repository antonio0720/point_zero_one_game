import { MLBalancingStrategy } from '../ML-driven-balancing';
import { Deck, Card } from '../../deck';
import { expect } from 'chai';
import 'mocha';

describe('ML-driven balancing', () => {
let deck: Deck;
let strategy: MLBalancingStrategy;

beforeEach(() => {
deck = new Deck();
strategy = new MLBalancingStrategy();
});

it('should balance deck when unbalanced', () => {
// Arrange (unbalanced deck)
const cardA = new Card('CardA');
const cardB = new Card('CardB');
deck.addCards([cardA, cardB, cardA, cardA, cardB]);

// Act (apply balancing strategy)
strategy.balance(deck);

// Assert (check if the deck is balanced)
const countA = deck.getCardsByLabel('CardA').length;
const countB = deck.getCardsByLabel('CardB').length;
expect(countA).to.equal(countB);
});

it('should not change the deck when balanced', () => {
// Arrange (balanced deck)
const cardA = new Card('CardA');
const cardB = new Card('CardB');
deck.addCards([cardA, cardB, cardA, cardB]);

// Act (apply balancing strategy)
strategy.balance(deck);

// Assert (check if the deck is still balanced)
const countA = deck.getCardsByLabel('CardA').length;
const countB = deck.getCardsByLabel('CardB').length;
expect(countA).to.equal(countB);
});
});
