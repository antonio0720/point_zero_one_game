import { Validation, DeckReactorError } from '../validation';
import { DeckDto } from '../../deck';
import { expect } from 'chai';

describe('Deck reactor - validation-9', () => {
const validation = new Validation();

it('should throw an error when the deck has more than 30 cards and no jokers', () => {
const invalidDeck: DeckDto = {
cards: Array.from({ length: 31 }, (_, i) => i + 1),
jokerCount: 0,
};

expect(() => validation.validateDeck(invalidDeck)).to.throw(
DeckReactorError,
'The deck has more than 30 cards and no jokers.'
);
});

it('should validate a deck with more than 30 cards when there are jokers', () => {
const validDeck: DeckDto = {
cards: Array.from({ length: 32 }, (_, i) => (i === 31 ? 'Joker' : i + 1)),
jokerCount: 2,
};

expect(validation.validateDeck(validDeck)).to.not.throw();
});
});
