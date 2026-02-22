import { DeckBuilder } from '../src/deck-builder';
import { Card } from '../src/card';

describe('Deck Builder', () => {
let deckBuilder: DeckBuilder;

beforeEach(() => {
deckBuilder = new DeckBuilder();
});

it('should create an instance of DeckBuilder', () => {
expect(deckBuilder).toBeInstanceOf(DeckBuilder);
});

it('should add a card to the deck', () => {
const testCard = new Card('Test Card');
deckBuilder.addCard(testCard);
expect(deckBuilder.getCards().length).toEqual(1);
});

// Add more test cases as needed...
});
