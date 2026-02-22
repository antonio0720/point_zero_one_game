type Suit = 'Hearts' | 'Diamonds' | 'Clubs' | 'Spades';
type Value = number | 'Ace' | 'Two' | 'Three' | 'Four' | 'Five' | 'Six' | 'Seven' | 'Eight' | 'Nine' | 'Ten' | 'Jack' | 'Queen' | 'King';
type Card = { suit: Suit; value: Value };
type Deck = Array<Card>;

function isValidCard(card: Card): card is Card {
return typeof card.suit === 'string' && typeof card.value === 'string' || typeof card.value === 'number';
}

function validateDeck(deck: Deck): deck is Deck {
return deck.every((card) => isValidCard(card));
}
