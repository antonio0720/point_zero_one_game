import { DeckBalance } from '../deck-balance';
import { Card } from '../../cards/card';
import { Deck } from '../../decks/deck';

describe('Deck systems - deck-balance-6', () => {
let deckBalance: DeckBalance;

beforeEach(() => {
deckBalance = new DeckBalance();
});

it('should correctly balance a deck with 6 cards', () => {
const card1 = new Card({ suit: 'Spades', rank: 'Ace' });
const card2 = new Card({ suit: 'Hearts', rank: 'Two' });
const card3 = new Card({ suit: 'Diamonds', rank: 'Three' });
const card4 = new Card({ suit: 'Clubs', rank: 'Four' });
const card5 = new Card({ suit: 'Spades', rank: 'Five' });
const card6 = new Card({ suit: 'Hearts', rank: 'Six' });

const deck = new Deck();
deck.push(card1);
deck.push(card2);
deck.push(card3);
deck.push(card4);
deck.push(card5);
deck.push(card6);

const balancedDeck = deckBalance.balance(deck);

expect(balancedDeck).toHaveLength(6);
expect(balancedDeck[0].suit).toEqual('Spades');
expect(balancedDeck[1].suit).toEqual('Hearts');
expect(balancedDeck[2].suit).toEqual('Diamonds');
expect(balancedDeck[3].suit).toEqual('Clubs');
expect(balancedDeck[4].suit).toEqual('Spades');
expect(balancedDeck[5].suit).toEqual('Hearts');
});

it('should correctly balance a deck with more than 6 cards', () => {
const card1 = new Card({ suit: 'Spades', rank: 'Ace' });
const card2 = new Card({ suit: 'Hearts', rank: 'Two' });
const card3 = new Card({ suit: 'Diamonds', rank: 'Three' });
const card4 = new Card({ suit: 'Clubs', rank: 'Four' });
const card5 = new Card({ suit: 'Spades', rank: 'Five' });
const card6 = new Card({ suit: 'Hearts', rank: 'Six' });
const card7 = new Card({ suit: 'Diamonds', rank: 'Seven' });
const card8 = new Card({ suit: 'Clubs', rank: 'Eight' });

const deck = new Deck();
deck.push(card1);
deck.push(card2);
deck.push(card3);
deck.push(card4);
deck.push(card5);
deck.push(card6);
deck.push(card7);
deck.push(card8);

const balancedDeck = deckBalance.balance(deck);

expect(balancedDeck).toHaveLength(8);
expect(balancedDeck[0].suit).toEqual('Spades');
expect(balancedDeck[1].suit).toEqual('Hearts');
expect(balancedDeck[2].suit).toEqual('Diamonds');
expect(balancedDeck[3].suit).toEqual('Clubs');
expect(balancedDeck[4].suit).toEqual('Spades');
expect(balancedDeck[5].suit).toEqual('Hearts');
expect(balancedDeck[6].suit).toEqual('Diamonds');
expect(balancedDeck[7].suit).toEqual('Clubs');
});
});
